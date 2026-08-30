import { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { LaundromatG } from '../game/Laundromat';
import { MachineCard, Swatch } from './MachineCard';
import { GarmentCard, SpecialCard } from './Card';
import { DICE_TEXT, canPlaySpecial, loadBlocked, loadsOutstanding } from '../rules/phases';
import {
  EVENT_TEXT,
  RULES_SUMMARY,
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

  const modalUp = showReckoning || showReveal || showResolved || confirm !== null || showRules;

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
        title: `Switch M${mi + 1} ${to}?`,
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
            title: `Shoot M${mi + 1}, and send Jimothy where?`,
            body: (
              <>
                <p>
                  M{mi + 1} is destroyed permanently and its {m.items.length} item(s) go back to
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
                      Send him to M{o.id + 1}
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
          title: `Shoot M${mi + 1}?`,
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
          title: `Put Jimothy in M${mi + 1}?`,
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
        title: `Play ${cardName(name)} on M${mi + 1}?`,
        body: (
          <>
            <p>{SPECIAL_TEXT[name]}</p>
            {name === 'Coin' && (
              <p>
                M{mi + 1} will switch <b>{coinTo ? 'ON' : 'OFF'}</b>. The keyholder acts after you
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
        title: `Move ${itemLabel(item)} to M${mi + 1}?`,
        body: (
          <>
            <p>
              It leaves M{pending.from + 1} and joins M{mi + 1}.
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
    <div className="app">
      <header className="top">
        <h1>Laundromat</h1>
        <span className="day">Day {G.day}</span>
        <span className="badge phase">{phaseLabel}</span>
        <span className="badge key">Key: Player {G.key + 1}</span>
        {G.revealedEvent && <span className="badge provisional">Event: {G.revealedEvent}</span>}
        <span className="spacer" />
        <button className="info-btn" title="Show the rules" onClick={() => setShowRules(true)}>
          i
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
          <div className="main-grid">
            <div>
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
                            ? `M${m.id + 1} is destroyed`
                            : sel.ok
                              ? `M${m.id + 1} will take it`
                              : `M${m.id + 1} is ${m.on ? 'on' : 'off'}`
                        }
                        onClick={() => scrollToMachine(m.id)}
                      >
                        M{m.id + 1} · {m.items.length}/{G.cfg.capacity}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="floor">
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
            </div>

            <ProgressRail
              G={G}
              current={current}
              seat={online ? seat : null}
              nameOf={online ? nameOf : null}
              awayIds={new Set(away.map((m) => Number(m.id)))}
            />
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
                    Pass, and go to the reckoning
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
              shadow={shadow}
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

          <div className="section-title">Log</div>
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

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>How Laundromat works</h2>
            {RULES_SUMMARY.map((s) => (
              <div key={s.heading} style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '10px 0 4px' }}>{s.heading}</h4>
                {s.lines.map((l, i) => (
                  <div key={i} className="rules-help" style={{ marginBottom: 2 }}>
                    {l}
                  </div>
                ))}
              </div>
            ))}
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
            <h2>
              {ctx.gameover.winners.length > 1
                ? `${ctx.gameover.winners.map((w: number) => nameOf(w)).join(' and ')} win together`
                : online && ctx.gameover.winners[0] === seat
                  ? 'You win'
                  : `${nameOf(ctx.gameover.winners[0])} wins`}
            </h2>
            <p>All ten items washed on day {G.day}.</p>
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
        M{mi + 1} · {preview.items.length}/{G.cfg.capacity}
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
              M{r.machine + 1}
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
  shadow,
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
  shadow: LaundromatG;
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
  const ready = G.players[current].ready;

  return (
    <div className="turnbar">
      <h2>{heading}</h2>

      <div className="row">
        {turn.face && <div className="die">{turn.face}</div>}
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

      {stage === 'roll' && (
        <div className="row">
          <button className="primary" onClick={() => moves.roll()}>
            Roll the die
          </button>
        </div>
      )}

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
                (a blanket needs a machine holding nothing but socks). You rolled {turn.face} but
                may load {turn.loadsDone}. That is allowed — loading is "as many as you can".
              </div>
              <button
                className="primary"
                onClick={() =>
                  setConfirm({
                    title: 'Load nothing this turn?',
                    body: (
                      <>
                        <p>
                          You rolled {turn.face} and have loaded {turn.loadsDone}. No washer will
                          accept anything you are holding, so the rest of your loading is skipped.
                        </p>
                        <p className="note">
                          This is legal — loading is "as many as you can" — but it cannot be undone,
                          and it is a wasted turn. Check the floor once more before you confirm.
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
            </div>
          ) : (
            <>
              <div className="sub">
                {selectedItem
                  ? `${itemLabel(G.items[selectedItem])} is in your hand — now click a washer to put it there. Click the card again to put it back.`
                  : loadsLeft > 0
                    ? `${loadsLeft} more to load. Click a card, then click the washer you want it in. You may spread them across different washers, and load them one at a time or all together.`
                    : 'Everything is placed. Load them when you are ready.'}
              </div>

              {staged.length > 0 && (
                <div className="staged">
                  <div className="zone-label">Not yet committed</div>
                  {staged.map((sg, i) => (
                    <div key={`${sg.item}${i}`} className="staged-row">
                      <Swatch owner={G.items[sg.item].owner} shade={G.items[sg.item].shade} />
                      <span>
                        {itemLabel(G.items[sg.item])} → M{sg.machine + 1}
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
                  onClick={() =>
                    setConfirm({
                      title:
                        staged.length === 1
                          ? 'Load this one?'
                          : `Load these ${staged.length} together?`,
                      body: (
                        <>
                          <p>Once loaded, only a roll of 4 can move them.</p>
                          {loadsLeft > 0 && (
                            <p className="note warn">
                              You will still owe {loadsLeft} more load
                              {loadsLeft === 1 ? '' : 's'} this turn.
                            </p>
                          )}
                          {[...new Set(staged.map((sg) => sg.machine))].map((mi) => (
                            <MachinePreview key={mi} G={shadow} mi={mi} />
                          ))}
                        </>
                      ),
                      confirmLabel: staged.length === 1 ? 'Load it' : `Load all ${staged.length}`,
                      act: () => commitStaged(),
                    })
                  }
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
      <div className="zone-label">Race to ten</div>
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

  return (
    <div className="zones">
      <div className="panel">
        <div className="zone-label" title={SORT_EXPLAINER}>
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
              />
            );
          })}
          {p.hand.length === 0 && <span className="rules-help">empty</span>}
        </div>

        <div className="zone-label">
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
        <div className="zone-label">Fresh · drawn today, unplayable ({p.fresh.length})</div>
        <div className="items scroll">
          {p.fresh.map((n, i) => (
            <SpecialCard key={`${n}${i}`} name={n} size="sm" fresh title={SPECIAL_TEXT[n]} />
          ))}
          {p.fresh.length === 0 && <span className="rules-help">nothing fresh</span>}
        </div>

        <div className="zone-label">Ready · playable ({p.ready.length})</div>
        <div className="items scroll">
          {p.ready.map((n, i) => (
            <SpecialCard key={`${n}${i}`} name={n} size="sm" title={SPECIAL_TEXT[n]} />
          ))}
          {p.ready.length === 0 && <span className="rules-help">nothing ready</span>}
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
      </div>
    </div>
  );
}
