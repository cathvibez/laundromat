import { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { LaundromatG } from '../game/Laundromat';
import { MachineCard, Swatch } from './MachineCard';
import { DieDock } from './Die';
import { RulesGuide } from './RulesGuide';
import { LeaveReview, StayInTouch } from './Contact';
import { EventCard, GarmentCard, SpecialCard } from './Card';
import { BasketIcon, FoldedStackIcon, SpinningWasher } from './Icons';
import { DICE_TEXT, canPlaySpecial, loadBlocked, loadsOutstanding } from '../rules/phases';
import { firstBlockedDisplacement } from '../rules/driver';
import {
  EVENT_TEXT,
  SORT_EXPLAINER,
  SPECIAL_TEXT,
  cardName,
  itemLabel,
  loadTargets,
  sortItems,
  tonight,
  willTangle,
} from '../rules/selectors';
import { hasLegalPlacement, loadableItems, machineAccepts } from '../rules/placement';
import { ATTACHING } from '../rules/types';
import type { ItemId, SpecialName } from '../rules/types';

type Props = BoardProps<LaundromatG>;

type Pending =
  | { kind: 'none' }
  | { kind: 'card'; name: SpecialName }
  | { kind: 'moveFrom' }
  | { kind: 'moveTo'; from: number; item: ItemId };

/** Nothing that changes the board happens without passing through one of these. */
interface Confirmation {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  act: () => void;
}

/**
 * Bring a washer into view on the phone carousel. jsdom has no layout and no
 * `scrollIntoView`, so this is a no-op under test rather than a crash.
 */
function scrollToMachine(index: number): void {
  if (typeof document === 'undefined') return;
  const el = document.querySelectorAll('.floor .machine')[index] as HTMLElement | undefined;
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

/**
 * Who is who. Online, boardgame.io hands us `matchData` with the nicknames from
 * the lobby; hot-seat has none, and "Player 3" is exactly right there.
 */
type MatchRow = { id: number; name?: string; isConnected?: boolean };

export function Board({ G, ctx, moves, playerID, matchData, isConnected }: Props) {
  const [selectedItem, setSelectedItem] = useState<ItemId | null>(null);
  /** Which washer a dragged card is currently over, for the drop highlight. */
  const [dropOver, setDropOver] = useState<number | null>(null);
  /** Loads chosen but NOT yet committed. Confirm sends them all; deselect removes one. */
  const [staged, setStaged] = useState<{ item: ItemId; machine: number }[]>([]);
  const [pending, setPending] = useState<Pending>({ kind: 'none' });
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [seenReckoning, setSeenReckoning] = useState<number | null>(null);
  const [briefedReveal, setBriefedReveal] = useState<number | null>(null);
  const [briefedResolved, setBriefedResolved] = useState<number | null>(null);
  // Dev: `?autostart` also skips the pass-the-device interstitial, which is
  // meaningless for a single operator and blocks automated screenshots.
  const [hideBetweenTurns, setHideBetweenTurns] = useState(
    () =>
      typeof window === 'undefined' ||
      !new URLSearchParams(window.location.search).has('autostart'),
  );
  const [revealed, setRevealed] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showTouch, setShowTouch] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const current = Number(ctx.currentPlayer);
  const phase = ctx.phase;
  const turn = G.turn;

  // ---- online vs hot-seat -------------------------------------------------
  /**
   * The one distinction the whole file turns on. Hot-seat has no playerID: one
   * screen speaks for everybody, so the seat on show is always the seat whose
   * turn it is. Online, `seat` is ME and never moves, `current` is whoever is
   * acting, and the two are equal only when it is my turn.
   */
  const online = playerID !== null && playerID !== undefined;
  const seat = online ? Number(playerID) : current;
  const myTurn = !online || seat === current;
  const rows = (matchData ?? []) as MatchRow[];

  function nameOf(i: number): string {
    const row = rows.find((m) => Number(m.id) === i);
    return row?.name?.trim() ? row.name.trim() : `Player ${i + 1}`;
  }
  /** Second person for yourself, but only online — hot-seat is read aloud. */
  const youOrName = (i: number) => (online && i === seat ? 'you' : nameOf(i));

  const away = online ? rows.filter((m) => m.isConnected === false && Number(m.id) !== seat) : [];
  const offline = online && isConnected === false;

  useEffect(() => {
    setSelectedItem(null);
    setStaged([]);
    setPending({ kind: 'none' });
    setConfirm(null);
  }, [ctx.currentPlayer, phase, turn?.stage]);

  useEffect(() => {
    if (phase === 'roll' && turn?.stage === 'roll') setRevealed(null);
  }, [ctx.currentPlayer, phase, turn?.stage]);

  // ---- what is asking for attention, in priority order --------------------
  const showReckoning =
    G.lastReckoning !== null && G.lastReckoningDay !== null && seenReckoning !== G.lastReckoningDay;

  // An event was drawn during the roll phase and revealed at once.
  const showReveal = G.revealedEvent !== null && briefedReveal !== G.day && !showReckoning;

  // An event resolved without asking anybody anything.
  const showResolved =
    G.lastEvent !== null &&
    G.lastEvent.auto &&
    briefedResolved !== G.lastEvent.day &&
    !showReckoning &&
    !showReveal;

  /**
   * The pass-the-device screen hides one hand from the person sitting next to
   * you. Online there is nobody next to you and your hand was never on their
   * device in the first place — the server strips it. Showing it there would
   * be a lie AND a dead end, since there is no one to pass to.
   */
  const needsPass =
    !online &&
    hideBetweenTurns &&
    phase === 'roll' &&
    turn?.stage === 'roll' &&
    revealed !== ctx.currentPlayer &&
    !showReckoning &&
    !showReveal &&
    !showResolved &&
    !ctx.gameover;

  const modalUp =
    showReckoning || showReveal || showResolved || confirm !== null || showRules || showLog || showTouch || showReview;

  /**
   * The board as it WOULD be with the staged loads applied.  Legality for the
   * next staged item has to be judged against this, not against the committed
   * board, or you could stage five items into a machine that holds four.
   */
  const shadow: LaundromatG = staged.length
    ? {
        ...G,
        machines: G.machines.map((m) => ({
          ...m,
          items: [...m.items, ...staged.filter((s) => s.machine === m.id).map((s) => s.item)],
        })),
      }
    : G;

  const stagedItems = new Set(staged.map((s) => s.item));
  const loadsLeft = Math.max(0, loadsOutstanding(G) - staged.length);
  const stagingBlocked =
    turn?.stage === 'load' && loadsLeft > 0 && !hasLegalPlacement(shadow, current);

  // ---- machine interaction ------------------------------------------------
  /**
   * An event is waiting for the drawer to choose a washer. This happens in TWO
   * places and they must behave identically:
   *   'phase'   — arms E2/E3, where the whole event phase is a separate step;
   *   'midturn' — arm E1, where the event fires on draw and the turn parks at
   *               turn.pendingEvent until the drawer answers.
   * The mid-turn case was unhandled: the banner said "pick a washer above"
   * while machineSelectable refused every one of them.
   */
  const eventChoice: 'phase' | 'midturn' | null =
    phase === 'event'
      ? 'phase'
      : phase === 'roll' && turn?.stage === 'extra' && turn.pendingEvent
        ? 'midturn'
        : null;

  /** The two paths take different moves but ask exactly the same question. */
  function submitEventChoice(machine: number, jimothyTo?: number) {
    if (eventChoice === 'midturn') moves.resolveDrawnEvent(machine, jimothyTo);
    else moves.resolveEvent(machine, jimothyTo);
  }

  function machineSelectable(mi: number): { ok: boolean; refused: string | null } {
    // Not your turn: the board is a spectator view. The engine would reject the
    // move anyway; offering it and then silently swallowing the tap is worse.
    if (!myTurn) return { ok: false, refused: null };
    if (ctx.gameover || modalUp) return { ok: false, refused: null };
    const m = G.machines[mi];

    if (phase === 'key') return { ok: !m.dead, refused: m.dead ? 'Destroyed' : null };

    if (eventChoice) {
      if (G.revealedEvent === 'Gang' || G.revealedEvent === 'Jimothy') {
        return { ok: !m.dead, refused: m.dead ? 'Already destroyed' : null };
      }
      return { ok: false, refused: null };
    }

    if (phase !== 'roll' || !turn) return { ok: false, refused: null };

    if (pending.kind === 'card') {
      if (pending.name === 'Snacc') return { ok: !m.dead && mi !== G.jimothyAt, refused: null };
      return { ok: !m.dead, refused: null };
    }
    if (pending.kind === 'moveTo' && turn.stage === 'extra') {
      const t = loadTargets(G, current, pending.item).find((x) => x.machine === mi)!;
      return { ok: t.ok && mi !== pending.from, refused: t.reason };
    }
    if (turn.stage === 'load' && selectedItem) {
      const t = loadTargets(shadow, current, selectedItem).find((x) => x.machine === mi)!;
      return { ok: t.ok, refused: t.reason };
    }
    return { ok: false, refused: null };
  }

  function onMachine(mi: number) {
    if (!myTurn) return;
    const m = G.machines[mi];

    // ---- key phase: confirm the toggle ------------------------------------
    if (phase === 'key') {
      const to = m.on ? 'OFF' : 'ON';
      setConfirm({
        title: `Switch Washer ${mi + 1} ${to}?`,
        body: (
          <>
            <p>
              This is the keyholder's single action for the day.{' '}
              {to === 'OFF'
                ? 'It will not reckon tonight and will keep whatever is inside it.'
                : 'It will reckon tonight.'}
            </p>
            {m.jimothy && (
              <p className="note warn">
                Jimothy is in this machine, so it already cannot run. Switching it does nothing.
              </p>
            )}
            <MachinePreview G={G} mi={mi} />
          </>
        ),
        confirmLabel: `Switch ${to}`,
        act: () => moves.setMachinePower(mi, !m.on),
      });
      return;
    }

    // ---- event phase: confirm the target ----------------------------------
    if (eventChoice) {
      if (G.revealedEvent === 'Gang') {
        const others = G.machines.filter((x) => !x.dead && x.id !== mi);
        if (m.jimothy && others.length > 0) {
          setConfirm({
            title: `Shoot Washer ${mi + 1}, and send Jimothy where?`,
            body: (
              <>
                <p>
                  Washer {mi + 1} is destroyed permanently and its {m.items.length} item(s) go back to
                  their owners. Jimothy is not removed — he relocates. Choose his new machine:
                </p>
                <div className="row">
                  {others.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setConfirm(null);
                        submitEventChoice(mi, o.id);
                      }}
                    >
                      Send him to Washer {o.id + 1}
                    </button>
                  ))}
                </div>
              </>
            ),
            confirmLabel: '',
            act: () => {},
          });
          return;
        }
        setConfirm({
          title: `Shoot Washer ${mi + 1}?`,
          body: (
            <>
              <p>
                This washer is destroyed <b>permanently</b> — it is out of the game for good. Its{' '}
                {m.items.length} item(s) go back to their owners' hands. This cannot be undone.
              </p>
              <MachinePreview G={G} mi={mi} />
            </>
          ),
          confirmLabel: 'Shoot it',
          act: () => submitEventChoice(mi),
        });
        return;
      }
      if (G.revealedEvent === 'Jimothy') {
        setConfirm({
          title: `Put Jimothy in Washer ${mi + 1}?`,
          body: (
            <>
              <p>
                It cannot run and cannot be loaded while he is there. Its {m.items.length} item(s)
                are held hostage until he leaves — and release never washes anything.
              </p>
              <MachinePreview G={G} mi={mi} />
            </>
          ),
          confirmLabel: 'Put him there',
          act: () => submitEventChoice(mi),
        });
      }
      return;
    }

    if (!turn) return;

    // ---- playing a card ---------------------------------------------------
    if (pending.kind === 'card') {
      const name = pending.name;
      const coinTo = !m.on;
      setConfirm({
        title: `Play ${cardName(name)} on Washer ${mi + 1}?`,
        body: (
          <>
            <p>{SPECIAL_TEXT[name]}</p>
            {name === 'Coin' && (
              <p>
                Washer {mi + 1} will switch <b>{coinTo ? 'ON' : 'OFF'}</b>. The keyholder acts after you
                and can undo it.
              </p>
            )}
            <p className="note">
              This is your one card for the turn, and it returns to the deck afterwards.
            </p>
            <MachinePreview G={G} mi={mi} />
          </>
        ),
        confirmLabel: `Play ${cardName(name)}`,
        act: () => {
          if (name === 'Coin') moves.playCard(name, { machine: mi, on: coinTo });
          else moves.playCard(name, mi);
          setPending({ kind: 'none' });
        },
      });
      return;
    }

    // ---- face 4 displacement ---------------------------------------------
    if (pending.kind === 'moveTo') {
      const item = G.items[pending.item];
      setConfirm({
        title: `Move ${itemLabel(item)} to Washer ${mi + 1}?`,
        body: (
          <>
            <p>
              It leaves Washer {pending.from + 1} and joins Washer {mi + 1}.
            </p>
            <MachinePreview G={G} mi={mi} adding={pending.item} />
          </>
        ),
        confirmLabel: 'Move it',
        act: () => {
          moves.moveItem(pending.from, pending.item, mi);
          setPending({ kind: 'none' });
        },
      });
      return;
    }

    // ---- loading: stage it, commit later ---------------------------------
    if (turn.stage === 'load' && selectedItem) {
      setStaged((prev) => [...prev, { item: selectedItem, machine: mi }]);
      setSelectedItem(null);
    }
  }

  /**
   * Send staged loads, in order. The engine validates each one again.
   * `only` commits a single staged entry; omitted, it commits all of them.
   */
  function commitStaged(only?: number) {
    const send = only === undefined ? staged : [staged[only]];
    for (const s of send) moves.load(s.item, s.machine);
    setStaged(only === undefined ? [] : staged.filter((_, i) => i !== only));
    setSelectedItem(null);
  }

  const phaseLabel = ctx.gameover
    ? 'Game over'
    : phase === 'roll'
      ? 'Roll phase'
      : phase === 'event'
        ? 'Event resolution'
        : 'Key phase';

  return (
    <div className="app board">
      {/*
        THE BOARD IS ONE VIEWPORT TALL. Three rows: this head, the main row that
        takes what is left, and the hand. Nothing here scrolls the page — the
        washer floor scrolls inside itself if it ever has to. Note the class is
        `app board`, not `app`: `.app` is shared with the setup screen and the
        whole lobby, and those must go on scrolling normally.
      */}
      <div className="board-head">
      <header className="top">
        <h1>Laundromat</h1>
        <span className="day">Day {G.day}</span>
        <span className="badge phase">{phaseLabel}</span>
        <span className="badge key">Key: Player {G.key + 1}</span>
        {G.revealedEvent && <span className="badge provisional">Event: {G.revealedEvent}</span>}
        <span className="spacer" />
        <button className="top-btn" onClick={() => setShowLog(true)}>
          <span aria-hidden="true">&#9776;</span>
          <span className="top-btn-label opt">Log</span>
        </button>
        <button className="top-btn" onClick={() => setShowRules(true)}>
          Rulebook
        </button>
        <button className="top-btn" onClick={() => setShowTouch(true)}>
          Stay in touch
        </button>
        <button className="top-btn" onClick={() => setShowReview(true)}>
          <span className="top-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9734;</span>
          <span className="top-btn-label">Review</span>
        </button>
        {online ? (
          <span
            className={`badge conn ${offline ? 'bad' : 'ok'}`}
            title={
              offline
                ? 'Your device has lost the connection to the game'
                : 'Connected to the game'
            }
          >
            {offline ? 'Reconnecting…' : 'Connected'}
          </span>
        ) : (
          <label className="rules-help" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={hideBetweenTurns}
              onChange={(e) => setHideBetweenTurns(e.target.checked)}
            />
            hide hands between turns
          </label>
        )}
      </header>

      {/*
        Online, this is the most important thing on the screen: a phone comes
        out of a pocket and has to answer "is it me?" before anything else.
      */}
      {online && !ctx.gameover && (
        <div className={`turn-strip ${myTurn ? 'yours' : 'theirs'}`} role="status">
          <span className="turn-strip-main">
            {myTurn ? 'Your turn' : `${nameOf(current)}’s turn`}
          </span>
          <span className="turn-strip-sub">{doingNow(G, ctx.phase, myTurn)}</span>
        </div>
      )}

      {offline && (
        <div className="banner error" role="alert">
          <h3>You are offline</h3>
          <div>
            This device has lost its connection. The game is still running for everyone else —
            nothing you tap now will be sent. It reconnects on its own as soon as the network is
            back.
          </div>
        </div>
      )}

      {!offline && away.length > 0 && (
        <div className="banner" role="status">
          <h3>{away.length === 1 ? 'A player has dropped out' : 'Players have dropped out'}</h3>
          <div>
            {away.map((m) => nameOf(Number(m.id))).join(', ')}{' '}
            {away.length === 1 ? 'has' : 'have'} lost connection.
            {away.some((m) => Number(m.id) === current)
              ? ' The game is waiting on them, so nothing will move until they are back.'
              : ' Play carries on; their turn will wait for them when it comes.'}
          </div>
        </div>
      )}

      </div>

      {needsPass ? (
        <div className="pass-screen">
          <h2>Pass the device to Player {current + 1}</h2>
          <p className="note">Hands are the only private information in this game.</p>
          <button className="primary" onClick={() => setRevealed(ctx.currentPlayer)}>
            I am Player {current + 1}
          </button>
        </div>
      ) : (
        <>
          <div className="board-main">
            <div className="board-floor">
              <div className="section-title">The floor · capacity {G.cfg.capacity} per machine</div>

              {/*
                Phone only (CSS decides), and only once the floor is big enough
                to get lost in. At six players the floor is seven washers and a
                stacked column means the one you want is never on screen.
              */}
              {shadow.machines.length >= 5 && (
                <div className="floor-strip" role="group" aria-label="Jump to a washer">
                  {shadow.machines.map((m) => {
                    const sel = machineSelectable(m.id);
                    const cls = m.dead ? 'dead' : sel.ok ? 'pick' : m.on ? 'on' : 'off';
                    return (
                      <button
                        key={m.id}
                        className={`floor-chip ${cls}`}
                        title={
                          m.dead
                            ? `Washer ${m.id + 1} is destroyed`
                            : sel.ok
                              ? `Washer ${m.id + 1} will take it`
                              : `Washer ${m.id + 1} is ${m.on ? 'on' : 'off'}`
                        }
                        onClick={() => scrollToMachine(m.id)}
                      >
                        W{m.id + 1} · {m.items.length}/{G.cfg.capacity}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* data-odd, not a class: an odd washer count leaves a hole in
                  the second row, and the CSS lets the last one span both rather
                  than sit above empty space. The parity belongs in the
                  stylesheet, not in a conditional className here. */}
              <div className="floor" data-odd={shadow.machines.length % 2 === 1 ? '' : undefined}>
                {shadow.machines.map((m) => {
                  const sel = machineSelectable(m.id);
                  return (
                    <MachineCard
                      key={m.id}
                      G={shadow}
                      machine={m}
                      ghosts={staged.filter((s) => s.machine === m.id).map((s) => s.item)}
                      selectable={sel.ok}
                      refused={sel.ok ? null : sel.refused}
                      onSelect={() => onMachine(m.id)}
                      /*
                       * DRAG REUSES THE CLICK PATH ENTIRELY. dragstart sets
                       * selectedItem, which is the same state a click sets — so
                       * the washers light up, refusals are computed and the drop
                       * is staged by exactly the code that already validated a
                       * click. There is one set of loading rules, not two.
                       */
                      dropActive={dropOver === m.id && sel.ok}
                      onDragOver={(e) => {
                        if (!sel.ok) return;
                        e.preventDefault(); // without this the drop never fires
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDragEnter={() => sel.ok && setDropOver(m.id)}
                      onDragLeave={(e) => {
                        // Leaving for a CHILD of this washer is not leaving it.
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        setDropOver((cur) => (cur === m.id ? null : cur));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDropOver(null);
                        if (sel.ok) onMachine(m.id);
                      }}
                      onItemClick={
                        turn?.stage === 'extra' &&
                        pending.kind === 'moveFrom' &&
                        !m.dead &&
                        !m.jimothy &&
                        !modalUp
                          ? (id) => setPending({ kind: 'moveTo', from: m.id, item: id })
                          : undefined
                      }
                      footer={
                        phase === 'key' && !m.dead && !modalUp ? (
                          <div style={{ marginTop: 6 }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMachine(m.id);
                              }}
                            >
                              Turn {m.on ? 'OFF' : 'ON'}
                            </button>
                          </div>
                        ) : null
                      }
                    />
                  );
                })}
              </div>

          {phase === 'event' && G.revealedEvent && (
            <div className="banner">
              <h3>Resolve: {G.revealedEvent}</h3>
              <div>{EVENT_TEXT[G.revealedEvent]}</div>
              <div className="note">
                {online && myTurn
                  ? 'You drew it, so you choose. Pick a washer above.'
                  : `${nameOf(G.eventDrawer ?? 0)} picks a washer above.`}
              </div>
            </div>
          )}

          {phase === 'key' && (
            <div className="banner">
              <h3>Key phase</h3>
              <div>
                {online
                  ? `${youOrName(G.key)} ${G.key === seat ? 'hold' : 'holds'} the key: turn one machine on, turn one off, or pass.`
                  : `Player ${G.key + 1} holds the key: turn one machine on, turn one off, or pass.`}
              </div>
              {!myTurn && (
                <div className="note">
                  Nothing for you to do — the day ends when they have chosen.
                </div>
              )}
              {myTurn && (
                <div className="row" style={{ marginTop: 8 }}>
                  <button
                    onClick={() =>
                      setConfirm({
                        title: 'Pass the key phase?',
                        body: (
                          <p>No machine changes power today. The reckoning follows immediately.</p>
                        ),
                        confirmLabel: 'Pass',
                        act: () => moves.passKey(),
                      })
                    }
                  >
                    Let it spin
                  </button>
                </div>
              )}
            </div>
          )}

          {online && !myTurn && !ctx.gameover && (
            <WaitingBar
              G={G}
              phase={phase}
              name={nameOf(current)}
              disconnected={rows.some((m) => Number(m.id) === current && m.isConnected === false)}
            />
          )}

          {phase === 'roll' && turn && !ctx.gameover && myTurn && (
            <TurnBar
              G={G}
              turn={turn}
              current={seat}
              heading={online ? 'Your turn' : `Player ${current + 1}, it is your turn`}
              moves={moves}
              pending={pending}
              setPending={setPending}
              selectedItem={selectedItem}
              setConfirm={setConfirm}
              staged={staged}
              setStaged={setStaged}
              loadsLeft={loadsLeft}
              stagingBlocked={stagingBlocked}
              commitStaged={commitStaged}
            />
          )}
            </div>

            {/*
              The right column. The rail scrolls if the table is big; the die
              dock is pinned under it so the thing you act with never moves as
              washers reflow, and it sits directly above your hand — die, then
              hand, in the order you actually use them.
            */}
            <aside className="board-side">
              <ProgressRail
                G={G}
                current={current}
                seat={online ? seat : null}
                nameOf={online ? nameOf : null}
                awayIds={new Set(away.map((m) => Number(m.id)))}
              />
              <DieDock
                face={turn?.face ?? null}
                /* Exactly the guard the roll button carried inside TurnBar
                   before it moved here. Deliberately NOT `&& !modalUp`: a modal
                   is a full-screen overlay, so it already blocks the click, and
                   adding the term here would make the button vanish and reappear
                   underneath it. */
                canRoll={myTurn && phase === 'roll' && turn?.stage === 'roll' && !ctx.gameover}
                onRoll={() => moves.roll()}
              />
            </aside>
          </div>

          {/*
            ALWAYS `seat`, never `current`. Online, the server has already
            removed every other hand from G; asking for one would render a row
            of undefined items. This is your hand and nobody else's.
          */}
          <Zones
            G={G}
            shadow={shadow}
            current={seat}
            label={online ? 'Your' : `Player ${seat + 1} ·`}
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            onDragItem={setSelectedItem}
            stagedItems={stagedItems}
            canLoad={
              myTurn && phase === 'roll' && turn?.stage === 'load' && !modalUp && loadsLeft > 0
            }
            asleepReason={
              !myTurn
                ? `Your hand is asleep — it is ${nameOf(current)}’s turn. You will be able to load when your turn comes round.`
                : null
            }
          />

        </>
      )}

      {/* ---------------- modals, in priority order ---------------- */}

      {showReckoning && G.lastReckoning && (
        <ReckoningReview G={G} onDone={() => setSeenReckoning(G.lastReckoningDay)} />
      )}

      {!showReckoning && showReveal && G.revealedEvent && (
        <div className="overlay">
          <div className="modal">
            <h2>Event drawn: {G.revealedEvent}</h2>
            <p>{EVENT_TEXT[G.revealedEvent]}</p>
            {/*
              This text used to say "it resolves after every player has taken
              their turn" unconditionally. That is only true of arms E2/E3. Under
              E1 (the default) the event fires NOW and may be waiting on the
              drawer to name a washer — telling them to wait left the turn stuck.
            */}
            <p className="note">
              Drawn by Player {(G.eventDrawer ?? 0) + 1} and revealed at once.{' '}
              {turn?.pendingEvent
                ? 'You drew it, so you choose where it lands. Close this and pick a washer — the day cannot go on until you do.'
                : 'It takes effect immediately, before anyone else takes their turn.'}
            </p>
            <div className="row">
              <button className="primary" onClick={() => setBriefedReveal(G.day)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {!showReckoning && !showReveal && showResolved && G.lastEvent && (
        <div className="overlay">
          <div className="modal">
            <h2>{G.lastEvent.name} resolved</h2>
            <p>{EVENT_TEXT[G.lastEvent.name]}</p>
            <div className="note">
              {G.log
                .filter((l) => l.day === G.lastEvent!.day)
                .slice(-3)
                .map((l, i) => (
                  <div key={i}>{l.text}</div>
                ))}
            </div>
            <div className="row">
              <button className="primary" onClick={() => setBriefedResolved(G.lastEvent!.day)}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="overlay">
          <div className="modal">
            <h2>{confirm.title}</h2>
            {confirm.body}
            <div className="row" style={{ marginTop: 14 }}>
              {confirm.confirmLabel && (
                <button
                  className="primary"
                  onClick={() => {
                    const act = confirm.act;
                    setConfirm(null);
                    act();
                  }}
                >
                  {confirm.confirmLabel}
                </button>
              )}
              <button onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showLog && (
        <div className="overlay" onClick={() => setShowLog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>What has happened</h2>
            <div className="log">
              {[...G.log]
                .slice(-40)
                .reverse()
                .map((l, i) => (
                  <div key={i} className={i < 3 ? 'recent' : ''}>
                    <span style={{ opacity: 0.5 }}>d{l.day} </span>
                    {l.text}
                  </div>
                ))}
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button onClick={() => setShowLog(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showTouch && <StayInTouch onClose={() => setShowTouch(false)} />}
      {showReview && <LeaveReview onClose={() => setShowReview(false)} />}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close the rulebook" onClick={() => setShowRules(false)}>
              &times;
            </button>
            <RulesGuide players={G.players.length} />
            <div className="row">
              <button className="primary" onClick={() => setShowRules(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {ctx.gameover && !showReckoning && (
        <div className="overlay">
          <div className="modal">
            {/*
              An EMPTY winners list is a real ending since v11, not a bug: two
              players finishing on the same night means nobody wins. It has to be
              the first case tested, because every other branch indexes winners[0].
            */}
            <h2>
              {ctx.gameover.winners.length === 0
                ? 'Nobody wins'
                : online && ctx.gameover.winners[0] === seat
                  ? 'You win'
                  : `${nameOf(ctx.gameover.winners[0])} wins`}
            </h2>
            <p>
              {ctx.gameover.winners.length === 0
                ? `Two players finished together on day ${G.day}, so the laundromat keeps them all.`
                : `Everything washed on day ${G.day}.`}
            </p>
            <table>
              <tbody>
                {G.players.map((p) => (
                  <tr key={p.id}>
                    <td>{online ? nameOf(p.id) : `Player ${p.id + 1}`}</td>
                    <td>
                      {p.clean.length}/{p.mustWash.length} clean
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "What is actually happening right now", in one clause.
//
// A screen that says nothing while you wait is indistinguishable from a screen
// that has frozen, which is the single most common way an online board game
// looks broken. Every phase and stage has to produce a sentence here.
// ---------------------------------------------------------------------------

export function doingNow(G: LaundromatG, phase: string | null, mine: boolean): string {
  if (phase === 'event') {
    return mine
      ? `Resolve ${G.revealedEvent ?? 'the event'} — pick a washer.`
      : `Resolving ${G.revealedEvent ?? 'an event'}.`;
  }
  if (phase === 'key') {
    return mine
      ? 'You hold the key: switch one washer on, one off, or pass.'
      : 'The keyholder is deciding what to switch.';
  }
  const stage = G.turn?.stage;
  if (G.turn?.pendingEvent) {
    return mine ? `${G.revealedEvent} is waiting on you.` : `${G.revealedEvent} is being resolved.`;
  }
  switch (stage) {
    case 'roll':
      return mine ? 'Roll the die.' : 'Rolling the die.';
    case 'card':
      return mine ? 'Play a card, or pass.' : 'Choosing whether to play a card.';
    case 'load':
      return mine ? 'Load the washers.' : 'Loading the washers.';
    case 'extra':
      return mine ? 'Resolve the die.' : 'Resolving the die.';
    case 'done':
      return mine ? 'Turn complete.' : 'Finishing their turn.';
    default:
      return mine ? 'Your move.' : 'Taking their turn.';
  }
}

/**
 * The sticky bar when the turn is not yours. It occupies exactly the place the
 * turn bar occupies, so the answer to "what now?" is always in the same spot
 * under your thumb.
 */
function WaitingBar({
  G,
  phase,
  name,
  disconnected,
}: {
  G: LaundromatG;
  phase: string | null;
  name: string;
  disconnected: boolean;
}) {
  return (
    <div className="turnbar waiting" role="status">
      <h2>Waiting for {name}</h2>
      <div className="sub">{doingNow(G, phase, false)}</div>
      {disconnected ? (
        <div className="note warn">
          {name} has lost connection. The game cannot go on until they are back — nobody can act on
          their behalf.
        </div>
      ) : (
        <div className="note">
          Everything on the floor is public, so you can plan while you wait. Only hands are secret.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A small "what this machine looks like, and what tonight would do" preview,
// shown inside every confirmation so the choice is made with full information.
// ---------------------------------------------------------------------------

function MachinePreview({ G, mi, adding }: { G: LaundromatG; mi: number; adding?: ItemId }) {
  const m = G.machines[mi];
  const preview = adding ? { ...m, items: [...m.items, adding] } : m;
  const t = tonight(G, preview);
  return (
    <div className="preview">
      <div className="preview-head">
        Washer {mi + 1} · {preview.items.length}/{G.cfg.capacity}
      </div>
      {preview.items.length === 0 && <div className="rules-help">empty</div>}
      {preview.items.map((id) => {
        const line = t.lines.find((l) => l.item.id === id);
        const wash = line?.willWash ?? false;
        const tangled = wash && willTangle(G, preview, G.items[id]);
        return (
          <div key={id} className="preview-line">
            <Swatch owner={G.items[id].owner} shade={G.items[id].shade} />
            <span>
              P{G.items[id].owner + 1} {itemLabel(G.items[id])}
              {id === adding ? ' (new)' : ''}
            </span>
            <span className={`verdict ${tangled ? 'damp' : wash ? 'wash' : 'back'}`}>
              {tangled ? 'tangles' : wash ? 'washes' : 'back'}
            </span>
          </div>
        );
      })}
      <div className="rules-help" style={{ marginTop: 4 }}>
        {t.headline} {t.tierText ? `· ${t.tierText}` : ''}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reckoning, revealed one machine at a time.
// ---------------------------------------------------------------------------

function ReckoningReview({ G, onDone }: { G: LaundromatG; onDone: () => void }) {
  const results = G.lastReckoning!;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= results.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), 850);
    return () => clearTimeout(id);
  }, [shown, results.length]);

  const done = shown >= results.length;
  const washedTotal = results.reduce(
    (n, r) => n + r.outcomes.filter((o) => o.outcome === 'washed').length,
    0,
  );
  const SKIP_TEXT: Record<string, string> = {
    dead: 'destroyed',
    off: 'switched off',
    raccoon: 'Jimothy is in it',
    blackout: 'the power tripped',
    empty: 'empty',
  };

  return (
    <div className="overlay">
      <div className="modal">
        <h2>Day {G.lastReckoningDay} reckoning</h2>
        {results.slice(0, Math.max(shown, 1)).map((r, idx) => (
          <div
            key={r.machine}
            className={`result-machine${idx === shown - 1 && !done ? ' active' : ''}`}
          >
            <h4>
              <SpinningWasher
                size={30}
                spinning={idx === shown - 1 && !done && !r.skipped}
                colours={r.outcomes.map((o) => `var(--p${G.items[o.item].owner})`)}
              />
              Washer {r.machine + 1}
              {r.skipped ? ` — skipped: ${SKIP_TEXT[r.skipped]}` : r.tier ? ` — tier ${r.tier}` : ''}
            </h4>
            {r.outcomes.length === 0 ? (
              <div className="rules-help">nothing inside</div>
            ) : (
              <table>
                <tbody>
                  {r.outcomes.map((o) => (
                    <tr key={o.item}>
                      <td>
                        <Swatch owner={G.items[o.item].owner} shade={G.items[o.item].shade} /> P
                        {G.items[o.item].owner + 1} {itemLabel(G.items[o.item])}
                      </td>
                      <td
                        style={{
                          color:
                            o.outcome === 'washed'
                              ? 'var(--ok)'
                              : o.outcome === 'tangled'
                                ? 'var(--warn)'
                                : 'var(--bad)',
                        }}
                      >
                        {o.outcome === 'washed'
                          ? 'clean'
                          : o.outcome === 'tangled'
                            ? 'tangled — stays in for one more round'
                            : 'sent back'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        <div className="row" style={{ marginTop: 12 }}>
          {done ? (
            <>
              <span className="sub">{washedTotal} item(s) came out clean.</span>
              <button className="primary" onClick={onDone}>
                Continue to day {G.day}
              </button>
            </>
          ) : (
            <>
              <span className="sub">
                Machine {Math.min(shown + 1, results.length)} of {results.length}…
              </span>
              <button onClick={() => setShown(results.length)}>Skip</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TurnBar({
  G,
  turn,
  current,
  heading,
  moves,
  pending,
  setPending,
  selectedItem,
  setConfirm,
  staged,
  setStaged,
  loadsLeft,
  stagingBlocked,
  commitStaged,
}: {
  G: LaundromatG;
  turn: NonNullable<LaundromatG['turn']>;
  current: number;
  heading: string;
  moves: Props['moves'];
  pending: Pending;
  setPending: (p: Pending) => void;
  selectedItem: ItemId | null;
  setConfirm: (c: Confirmation | null) => void;
  staged: { item: ItemId; machine: number }[];
  setStaged: (s: { item: ItemId; machine: number }[]) => void;
  loadsLeft: number;
  stagingBlocked: boolean;
  /** `only` commits a single staged entry; omitted, it commits all of them. */
  commitStaged: (only?: number) => void;
}) {
  const stage = turn.stage;
  /*
   * The move a blocked player takes instead of loading (v11).  The engine picks
   * the same first legal move the bots would, so the button can name it concretely
   * — "move your dark hats to M3" reads far better than "move something somewhere",
   * and a blocked player is already confused enough.
   */
  const substitute = loadBlocked(G) ? firstBlockedDisplacement(G) : null;
  const ready = G.players[current].ready;

  return (
    <div className="turnbar">
      <h2>{heading}</h2>

      <div className="row">
        <div>
          {turn.face ? (
            <>
              <div className="instruction">{DICE_TEXT[turn.face]}</div>
              <div className="sub">
                {stage === 'card' && 'You may play one ready card, or pass.'}
                {stage === 'load' &&
                  `Loading is mandatory: ${loadsOutstanding(G)} of ${turn.loadsRequired} still to load.`}
                {stage === 'extra' && 'Resolve the die.'}
                {stage === 'done' && 'Turn complete.'}
              </div>
            </>
          ) : (
            <div className="instruction">Roll the die to begin.</div>
          )}
        </div>
      </div>

      {/* The die and its button live in the right-hand dock now (see Die.tsx).
          Exactly one 'Roll the die' node may exist in the document. */}

      {stage === 'card' && (
        <div className="row">
          {ready.length === 0 && <span className="sub">No ready cards.</span>}
          {ready.map((name, i) => {
            const playable = canPlaySpecial(G, current, name);
            return (
              <button
                key={`${name}${i}`}
                disabled={!playable}
                title={SPECIAL_TEXT[name]}
                className={pending.kind === 'card' && pending.name === name ? 'primary' : ''}
                onClick={() => setPending({ kind: 'card', name })}
              >
                {cardName(name)}
                {!playable && name === 'Snacc' ? ' (no raccoon)' : ''}
              </button>
            );
          })}
          <button onClick={() => moves.passCard()}>Play no card</button>
          {pending.kind === 'card' && (
            <div className="card-explainer">
              <b>{cardName(pending.name)}</b> — {SPECIAL_TEXT[pending.name]}
              <div className="sub">
                {ATTACHING.has(pending.name)
                  ? 'Pick the machine to play it on. You will be asked to confirm.'
                  : pending.name === 'Coin'
                    ? 'Pick a machine to flip its power. You will be asked to confirm.'
                    : 'Pick the machine to lure him to. You will be asked to confirm.'}
              </div>
              <button onClick={() => setPending({ kind: 'none' })}>Choose a different card</button>
            </div>
          )}
        </div>
      )}

      {stage === 'load' && (
        <div className="load-panel">
          {loadBlocked(G) && staged.length === 0 ? (
            <div className="blocked">
              <b>No washer will take anything you are holding.</b>
              <div className="sub">
                Every machine is full, destroyed, occupied by Jimothy, or refuses what you hold
                (a blanket needs a washer holding at most one other item). You rolled {turn.face}{' '}
                but may load {turn.loadsDone}.
              </div>
              {/*
                v11: being stuck gives you something to do rather than nothing —
                you move one of your OWN items between washers instead. It is the
                substitute for the load, so it is offered FIRST and skipping is
                only legal when even this is impossible (the engine refuses
                skipLoad while a move exists, so offering them the other way round
                would show a button that cannot work).
              */}
              {substitute ? (
                <>
                  <div className="sub">
                    You may move one of your own items from one washer to another instead. Click
                    the item in the washer it is in, then click where you want it.
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      setConfirm({
                        title: 'Move one of your items instead?',
                        body: (
                          <p>
                            Nothing you hold can be loaded, so you move{' '}
                            {itemLabel(G.items[substitute.item])} from Washer {substitute.from + 1} to
                            Washer {substitute.to + 1}. That is your whole turn's loading spent.
                          </p>
                        ),
                        confirmLabel: 'Move it',
                        act: () =>
                          moves.displaceInsteadOfLoad(
                            substitute.from,
                            substitute.item,
                            substitute.to,
                          ),
                      })
                    }
                  >
                    Move {itemLabel(G.items[substitute.item])} to Washer {substitute.to + 1}
                  </button>
                </>
              ) : (
                <button
                  className="primary"
                  onClick={() =>
                    setConfirm({
                      title: 'Load nothing this turn?',
                      body: (
                        <>
                          <p>
                            You rolled {turn.face} and have loaded {turn.loadsDone}. No washer will
                            accept anything you are holding, and you have nothing in a washer to
                            move, so the rest of your loading is skipped.
                          </p>
                          <p className="note">
                            This is legal — loading is "as many as you can" — but it cannot be
                            undone. Check the floor once more before you confirm.
                          </p>
                        </>
                      ),
                      confirmLabel: 'Yes, load nothing',
                      act: () => moves.skipLoad(),
                    })
                  }
                >
                  Load nothing and carry on
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="sub">
                {/*
                  The long form is a tutorial and is only worth its height the
                  FIRST time. Once a card is staged you have plainly understood
                  it, and every line here comes out of the washers above.
                */}
                {selectedItem
                  ? `${itemLabel(G.items[selectedItem])} is in your hand — drop it on a washer, or click one. Click the card again to put it back.`
                  : loadsLeft === 0
                    ? 'Everything is placed. Load them when you are ready.'
                    : staged.length > 0
                      ? `${loadsLeft} more to place.`
                      : `${loadsLeft} to load. Drag a card onto a washer, or click the card and then the washer. You may spread them around and load them one at a time or all together.`}
              </div>

              {staged.length > 0 && (
                <div className="staged">
                  <div className="zone-label">
                    Not yet committed
                    {loadsLeft > staged.length && (
                      <span className="staged-owed">
                        {' '}
                        · {loadsLeft - staged.length} more still to place
                      </span>
                    )}
                  </div>
                  <div className="staged-note">
                    Once loaded, only a roll of 4 can move them.
                  </div>
                  {staged.map((sg, i) => (
                    <div key={`${sg.item}${i}`} className="staged-row">
                      <Swatch owner={G.items[sg.item].owner} shade={G.items[sg.item].shade} />
                      <span>
                        {itemLabel(G.items[sg.item])} → Washer {sg.machine + 1}
                      </span>
                      <button
                        onClick={() => setStaged(staged.filter((_, j) => j !== i))}
                        title="Take it back"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => commitStaged(i)}
                        title="Send just this one into the washer now"
                        style={{ marginLeft: 6 }}
                      >
                        Load just this
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="row">
                {/*
                  Loading is mandatory but it does NOT have to happen in one go:
                  the button lights up as soon as one card is staged, and the
                  turn simply stays on the load stage until the quota is met.
                */}
                <button
                  className="primary"
                  disabled={staged.length === 0}
                  title={
                    staged.length === 0
                      ? 'Put at least one card in a washer first'
                      : loadsLeft > 0
                        ? `Loads ${staged.length} now. You will still owe ${loadsLeft}.`
                        : undefined
                  }
                  /*
                    COMMITS DIRECTLY. There used to be a confirm modal here, so
                    loading a card took two confirmations: placing it in the
                    staging list below, then agreeing to a dialog that repeated
                    what the list already said. The list IS the confirmation —
                    it names every card and its washer and offers Remove — and
                    the washers themselves now show tonight's forecast in dotted
                    tags. The per-row "Load just this" never had a dialog, so
                    this also makes the two buttons behave the same way.
                  */
                  onClick={() => commitStaged()}
                >
                  {staged.length === 0
                    ? 'Load'
                    : staged.length === 1
                      ? 'Load this one'
                      : `Load all ${staged.length}`}
                </button>
                {staged.length > 0 && <button onClick={() => setStaged([])}>Clear all</button>}
                {stagingBlocked && staged.length > 0 && (
                  <span className="sub">
                    No washer will take anything else you hold — commit what you have.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {stage === 'extra' && turn.pendingEvent && G.revealedEvent && (
        <div className="banner" style={{ marginTop: 10 }}>
          <h3>{G.revealedEvent} — happening now</h3>
          <div>{EVENT_TEXT[G.revealedEvent]}</div>
          <div className="note">
            You drew it, so you choose. Pick a washer above — it takes effect immediately, before
            anyone else takes their turn.
          </div>
        </div>
      )}

      {stage === 'extra' && !turn.pendingEvent && turn.face === 4 && (
        <div className="row">
          {pending.kind === 'moveFrom' || pending.kind === 'moveTo' ? (
            <span className="sub">
              {pending.kind === 'moveFrom'
                ? 'Click any item in any machine to move it.'
                : `Moving ${itemLabel(G.items[pending.item])}. Click its destination.`}
            </span>
          ) : (
            <button onClick={() => setPending({ kind: 'moveFrom' })}>Move an item</button>
          )}
          <button
            onClick={() =>
              setConfirm({
                title: 'Skip the move?',
                body: (
                  <p>Your roll of 4 lets you move one item between machines. This gives it up.</p>
                ),
                confirmLabel: 'Skip it',
                act: () => moves.passMove(),
              })
            }
          >
            Skip the move
          </button>
          {pending.kind !== 'none' && (
            <button onClick={() => setPending({ kind: 'none' })}>Cancel</button>
          )}
        </div>
      )}

      {stage === 'extra' && turn.face === 5 && turn.pendingDraw && (
        <div className="draw-choice">
          <div className="sub">
            Draw two, keep one. The other goes to the bottom of the deck. Whatever you keep is fresh
            and cannot be played until tomorrow.
          </div>
          <div className="draw-options">
            {turn.pendingDraw.map((name, i) => (
              <div key={`${name}${i}`} className="draw-card">
                <h4>{cardName(name)}</h4>
                <div className="rules-help">{SPECIAL_TEXT[name]}</div>
                {name === 'Snacc' && G.jimothyAt === null && (
                  <div className="note warn">
                    Jimothy is not in play, so this would do nothing right now.
                  </div>
                )}
                <button className="primary" onClick={() => moves.keepCard(name)}>
                  Keep {cardName(name)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Everybody's public position. Hands appear here as a COUNT and only a count —
 * online the server has already replaced other players' item ids with
 * placeholders, and there is deliberately no face-down card row: a row of card
 * backs would imply the information is there to be had. It is not.
 */
function ProgressRail({
  G,
  current,
  seat,
  nameOf,
  awayIds,
}: {
  G: LaundromatG;
  current: number;
  seat: number | null;
  nameOf: ((i: number) => string) | null;
  awayIds: Set<number>;
}) {
  return (
    <div className="panel rail">
      <div className="zone-label">
        Race to {G.players[0]?.mustWash.length ?? 10}
      </div>
      {G.players.map((p) => {
        const pct = Math.round((p.clean.length / Math.max(1, p.mustWash.length)) * 100);
        return (
          <div key={p.id} className={`rail-row${p.id === current ? ' current' : ''}`}>
            <div className="rail-name">
              <Swatch owner={p.id} shade="D" />
              <span>{nameOf ? nameOf(p.id) : `P${p.id + 1}`}</span>
              {p.id === seat && <span className="badge phase">you</span>}
              {G.key === p.id && <span className="badge key">key</span>}
              {awayIds.has(p.id) && <span className="badge provisional">away</span>}
            </div>
            <div className="progress">
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="rail-nums">
              <span>
                {p.clean.length}/{p.mustWash.length} clean
              </span>
              <span
                className="rules-help"
                title={
                  seat === null || p.id === seat
                    ? 'Items in hand'
                    : 'How many items they are holding. Which ones is the only secret in the game.'
                }
              >
                hand {p.hand.length}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Zones({
  G,
  shadow,
  current,
  label,
  selectedItem,
  setSelectedItem,
  onDragItem,
  stagedItems,
  canLoad,
  asleepReason,
}: {
  G: LaundromatG;
  shadow: LaundromatG;
  current: number;
  label: string;
  selectedItem: ItemId | null;
  setSelectedItem: (id: ItemId | null) => void;
  /** Called on dragstart. Same setter a click uses — see the note on the floor. */
  onDragItem: (id: ItemId | null) => void;
  stagedItems: Set<ItemId>;
  canLoad: boolean;
  /** Online: why the hand is inert when the reason is not "you have not rolled". */
  asleepReason: string | null;
}) {
  const p = G.players[current];
  // An item is only offerable if some machine would actually take it, judged
  // against the board INCLUDING anything already staged this turn.
  const loadable = new Set(
    loadableItems(G, current).filter(
      (id) => !stagedItems.has(id) && shadow.machines.some((m) => machineAccepts(shadow, m.id, id)),
    ),
  );
  const pct = Math.round((p.clean.length / Math.max(1, p.mustWash.length)) * 100);

  /** Every special card you hold, whichever side of the one-day wait. */
  const specials = [...p.ready, ...p.fresh];

  return (
    <div className={`zones${specials.length === 0 && !G.revealedEvent ? ' zones-solo' : ''}`}>
      <div className="panel">
        <div className="zone-label" title={SORT_EXPLAINER}>
          <BasketIcon size={16} className="label-icon" />
          {label} hand ({p.hand.length}) · sorted {SORT_EXPLAINER}
        </div>
        {!canLoad && p.hand.length > 0 && (
          <div className="hand-hint">
            {asleepReason ??
              'Your hand is asleep — you can only pick cards up during the loading part of your turn. Roll the die first.'}
          </div>
        )}
        <div className="items scroll">
          {sortItems(G, p.hand).filter((id) => !stagedItems.has(id)).map((id) => {
            const usable = canLoad && loadable.has(id);
            return (
              <GarmentCard
                key={id}
                item={G.items[id]}
                size="md"
                selected={selectedItem === id}
                className={usable ? 'item-btn' : 'item-btn disabled'}
                title={
                  selectedItem === id
                    ? 'Click again to put it back'
                    : usable
                      ? `${itemLabel(G.items[id])} — click to pick it up`
                      : `${itemLabel(G.items[id])} — no washer will take this right now`
                }
                onClick={usable ? () => setSelectedItem(selectedItem === id ? null : id) : undefined}
                draggable={usable}
                onDragStart={
                  usable
                    ? (e) => {
                        // Picking the card up IS selecting it, so a drag that is
                        // abandoned halfway leaves the card held rather than
                        // silently dropped — the same place a click leaves it.
                        onDragItem(id);
                        e.dataTransfer.effectAllowed = 'move';
                        // Firefox refuses to start a drag with no payload set.
                        e.dataTransfer.setData('text/plain', id);
                      }
                    : undefined
                }
              />
            );
          })}
          {p.hand.length === 0 && <span className="rules-help">empty</span>}
        </div>

        <div className="zone-label">
          <FoldedStackIcon size={16} className="label-icon" />
          Clean pile ({p.clean.length} of {p.mustWash.length})
        </div>
        <div className="progress">
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="items scroll" style={{ marginTop: 8 }}>
          {sortItems(G, p.clean).map((id) => (
            <GarmentCard key={id} item={G.items[id]} size="xs" />
          ))}
          {p.clean.length === 0 && <span className="rules-help">nothing washed yet</span>}
        </div>
      </div>

      <div className="panel">
        {/*
          Today's event, as a CARD rather than only a badge in the top bar. It
          is not yours and cannot be played — it is drawn from a shared deck and
          happens TO everyone — so it sits above your cards with a label saying
          so, rather than among them where it would read as something you hold.
          Art is pending for three of the four; EventCard draws the placeholder.
        */}
        {G.revealedEvent && (
          <>
            <div className="zone-label">Tonight&rsquo;s event · happens to everyone</div>
            <div className="items event-row">
              <EventCard name={G.revealedEvent} size="sm" />
            </div>
          </>
        )}
        {/*
          ONE SECTION, NOT TWO. This used to be "Fresh · drawn today,
          unplayable" and "Ready · playable" as separate headings, which named
          a mechanic without ever saying WHAT these cards are or where they come
          from — and showed two empty lists for most of the first day. It is one
          list of special items now; the card itself says when it wakes up.
        */}
        <div className="zone-label">
          Special items ({p.fresh.length + p.ready.length})
        </div>
        {specials.length > 0 ? (
          <>
            <div className="items scroll">
              {p.ready.map((n, i) => (
                <SpecialCard key={`r${n}${i}`} name={n} size="sm" title={SPECIAL_TEXT[n]} />
              ))}
              {p.fresh.map((n, i) => (
                <SpecialCard key={`f${n}${i}`} name={n} size="sm" fresh title={SPECIAL_TEXT[n]} />
              ))}
            </div>
            {p.ready.length > 0 && (
              <div className="rules-help" style={{ marginTop: 8 }}>
                {p.ready.map((n, i) => (
                  <div key={`${n}${i}`} style={{ marginBottom: 3 }}>
                    <b>{cardName(n)}</b> — {SPECIAL_TEXT[n]}
                  </div>
                ))}
              </div>
            )}
            {p.fresh.length > 0 && (
              <div className="rules-help" style={{ marginTop: 6 }}>
                Cards marked <b>tomorrow</b> were drawn today and cannot be played until the
                next day.
              </div>
            )}
          </>
        ) : (
          /* The empty state teaches the rule, because this panel is empty for
             most of the first day and a bare "nothing" taught nobody. */
          <div className="rules-help">
            None yet. Roll a <b>5</b> to draw two and keep one. A card you have just drawn
            cannot be played until the next day.
          </div>
        )}
      </div>
    </div>
  );
}
