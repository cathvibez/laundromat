import { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { LaundromatG } from '../game/Laundromat';
import { MachineCard, Swatch } from './MachineCard';
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
  willBeDamp,
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

export function Board({ G, ctx, moves }: Props) {
  const [selectedItem, setSelectedItem] = useState<ItemId | null>(null);
  /** Loads chosen but NOT yet committed. Confirm sends them all; deselect removes one. */
  const [staged, setStaged] = useState<{ item: ItemId; machine: number }[]>([]);
  const [pending, setPending] = useState<Pending>({ kind: 'none' });
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [seenReckoning, setSeenReckoning] = useState<number | null>(null);
  const [briefedReveal, setBriefedReveal] = useState<number | null>(null);
  const [briefedResolved, setBriefedResolved] = useState<number | null>(null);
  const [hideBetweenTurns, setHideBetweenTurns] = useState(true);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  const current = Number(ctx.currentPlayer);
  const phase = ctx.phase;
  const turn = G.turn;

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

  const needsPass =
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
  function machineSelectable(mi: number): { ok: boolean; refused: string | null } {
    if (ctx.gameover || modalUp) return { ok: false, refused: null };
    const m = G.machines[mi];

    if (phase === 'key') return { ok: !m.dead, refused: m.dead ? 'Destroyed' : null };

    if (phase === 'event') {
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
    if (phase === 'event') {
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
                        moves.resolveEvent(mi, o.id);
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
          act: () => moves.resolveEvent(mi),
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
          act: () => moves.resolveEvent(mi),
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

  /** Send every staged load, in order.  The engine validates each one again. */
  function commitStaged() {
    for (const s of staged) moves.load(s.item, s.machine);
    setStaged([]);
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
        <label className="rules-help" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={hideBetweenTurns}
            onChange={(e) => setHideBetweenTurns(e.target.checked)}
          />
          hide hands between turns
        </label>
      </header>

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

            <ProgressRail G={G} current={current} />
          </div>

          {phase === 'event' && G.revealedEvent && (
            <div className="banner">
              <h3>Resolve: {G.revealedEvent}</h3>
              <div>{EVENT_TEXT[G.revealedEvent]}</div>
              <div className="note">Player {(G.eventDrawer ?? 0) + 1} picks a washer above.</div>
            </div>
          )}

          {phase === 'key' && (
            <div className="banner">
              <h3>Key phase</h3>
              <div>
                Player {G.key + 1} holds the key: turn one machine on, turn one off, or pass.
              </div>
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
            </div>
          )}

          {phase === 'roll' && turn && !ctx.gameover && (
            <TurnBar
              G={G}
              shadow={shadow}
              turn={turn}
              current={current}
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

          <Zones
            G={G}
            shadow={shadow}
            current={current}
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            stagedItems={stagedItems}
            canLoad={phase === 'roll' && turn?.stage === 'load' && !modalUp && loadsLeft > 0}
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
            <p className="note">
              Drawn by Player {(G.eventDrawer ?? 0) + 1} and revealed at once. It resolves after
              every player has taken their turn — so everyone acting after this knows it is coming.
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
                ? `Players ${ctx.gameover.winners.map((w: number) => w + 1).join(' and ')} win together`
                : `Player ${ctx.gameover.winners[0] + 1} wins`}
            </h2>
            <p>All ten items washed on day {G.day}.</p>
            <table>
              <tbody>
                {G.players.map((p) => (
                  <tr key={p.id}>
                    <td>Player {p.id + 1}</td>
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
        const damp = wash && willBeDamp(G, preview, G.items[id]);
        return (
          <div key={id} className="preview-line">
            <Swatch owner={G.items[id].owner} shade={G.items[id].shade} />
            <span>
              P{G.items[id].owner + 1} {itemLabel(G.items[id])}
              {id === adding ? ' (new)' : ''}
            </span>
            <span className={`verdict ${damp ? 'damp' : wash ? 'wash' : 'back'}`}>
              {damp ? 'damp' : wash ? 'washes' : 'back'}
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
                              : o.outcome === 'damp'
                                ? 'var(--warn)'
                                : 'var(--bad)',
                        }}
                      >
                        {o.outcome === 'washed'
                          ? 'clean'
                          : o.outcome === 'damp'
                            ? 'damp — needs one more wash'
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
  moves: Props['moves'];
  pending: Pending;
  setPending: (p: Pending) => void;
  selectedItem: ItemId | null;
  setConfirm: (c: Confirmation | null) => void;
  staged: { item: ItemId; machine: number }[];
  setStaged: (s: { item: ItemId; machine: number }[]) => void;
  loadsLeft: number;
  stagingBlocked: boolean;
  commitStaged: () => void;
}) {
  const stage = turn.stage;
  const ready = G.players[current].ready;

  return (
    <div className="turnbar">
      <h2>Player {current + 1}, it is your turn</h2>

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
              <button className="primary" onClick={() => moves.skipLoad()}>
                Load nothing and carry on
              </button>
            </div>
          ) : (
            <>
              <div className="sub">
                {selectedItem
                  ? `${itemLabel(G.items[selectedItem])} selected — now click a machine to place it. Click the item again to deselect.`
                  : loadsLeft > 0
                    ? `Place ${loadsLeft} more item${loadsLeft === 1 ? '' : 's'}: pick one from your hand, then pick its machine. You may spread them across different machines.`
                    : 'All placed. Check the board, then confirm.'}
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
                    </div>
                  ))}
                </div>
              )}

              <div className="row">
                <button
                  className="primary"
                  disabled={loadsLeft > 0 && !stagingBlocked}
                  title={
                    loadsLeft > 0 && !stagingBlocked
                      ? `Place ${loadsLeft} more item${loadsLeft === 1 ? '' : 's'} first — loading is mandatory`
                      : undefined
                  }
                  onClick={() =>
                    setConfirm({
                      title: `Commit ${staged.length} load${staged.length === 1 ? '' : 's'}?`,
                      body: (
                        <>
                          <p>Once committed, only a roll of 4 can move these.</p>
                          {[...new Set(staged.map((sg) => sg.machine))].map((mi) => (
                            <MachinePreview key={mi} G={shadow} mi={mi} />
                          ))}
                        </>
                      ),
                      confirmLabel: 'Commit',
                      act: commitStaged,
                    })
                  }
                >
                  Confirm {staged.length > 0 ? `${staged.length} load${staged.length === 1 ? '' : 's'}` : ''}
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

function ProgressRail({ G, current }: { G: LaundromatG; current: number }) {
  return (
    <div className="panel rail">
      <div className="zone-label">Race to ten</div>
      {G.players.map((p) => {
        const pct = Math.round((p.clean.length / Math.max(1, p.mustWash.length)) * 100);
        return (
          <div key={p.id} className={`rail-row${p.id === current ? ' current' : ''}`}>
            <div className="rail-name">
              <Swatch owner={p.id} shade="D" />
              <span>P{p.id + 1}</span>
              {G.key === p.id && <span className="badge key">key</span>}
            </div>
            <div className="progress">
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="rail-nums">
              <span>
                {p.clean.length}/{p.mustWash.length} clean
              </span>
              <span className="rules-help">
                hand {p.hand.length}
                {p.damp.length > 0 ? ` · damp ${p.damp.length}` : ''}
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
  selectedItem,
  setSelectedItem,
  stagedItems,
  canLoad,
}: {
  G: LaundromatG;
  shadow: LaundromatG;
  current: number;
  selectedItem: ItemId | null;
  setSelectedItem: (id: ItemId | null) => void;
  stagedItems: Set<ItemId>;
  canLoad: boolean;
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
          Player {current + 1} · hand ({p.hand.length}) · sorted {SORT_EXPLAINER}
        </div>
        <div className="items">
          {sortItems(G, p.hand).filter((id) => !stagedItems.has(id)).map((id) => (
            <button
              key={id}
              className={`item-btn${selectedItem === id ? ' selected' : ''}`}
              disabled={!canLoad || !loadable.has(id)}
              onClick={() => setSelectedItem(selectedItem === id ? null : id)}
              title={selectedItem === id ? 'Click again to deselect' : undefined}
            >
              <Swatch owner={G.items[id].owner} shade={G.items[id].shade} />
              {itemLabel(G.items[id])}
            </button>
          ))}
          {p.hand.length === 0 && <span className="rules-help">empty</span>}
        </div>

        <div className="zone-label">Damp zone · public ({p.damp.length})</div>
        <div className="items">
          {sortItems(G, p.damp).filter((id) => !stagedItems.has(id)).map((id) => (
            <button
              key={id}
              className={`item-btn damp${selectedItem === id ? ' selected' : ''}`}
              disabled={!canLoad}
              onClick={() => setSelectedItem(selectedItem === id ? null : id)}
            >
              <Swatch owner={G.items[id].owner} shade={G.items[id].shade} />
              {itemLabel(G.items[id])} · needs one more wash
            </button>
          ))}
          {p.damp.length === 0 && <span className="rules-help">nothing damp</span>}
        </div>

        <div className="zone-label">
          Clean pile ({p.clean.length} of {p.mustWash.length})
        </div>
        <div className="progress">
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="items" style={{ marginTop: 6 }}>
          {sortItems(G, p.clean).map((id) => (
            <span key={id} className="item-btn" style={{ opacity: 0.7 }}>
              <Swatch owner={G.items[id].owner} shade={G.items[id].shade} />
              {itemLabel(G.items[id])}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="zone-label">Fresh · drawn today, unplayable ({p.fresh.length})</div>
        <div className="items">
          {p.fresh.map((n, i) => (
            <span
              key={`${n}${i}`}
              className="item-btn"
              style={{ opacity: 0.65 }}
              title={SPECIAL_TEXT[n]}
            >
              {cardName(n)}
            </span>
          ))}
          {p.fresh.length === 0 && <span className="rules-help">nothing fresh</span>}
        </div>

        <div className="zone-label">Ready · playable ({p.ready.length})</div>
        <div className="items">
          {p.ready.map((n, i) => (
            <span key={`${n}${i}`} className="item-btn" title={SPECIAL_TEXT[n]}>
              {cardName(n)}
            </span>
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
