# Laundromat — web (Milestone 1)

Playable **local hot-seat** implementation of Laundromat, brief **v8**.
Vite + React + TypeScript + boardgame.io. No networking yet; the architecture is
built so that remote multiplayer is a transport swap, not a rewrite.

---

## Running it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm test           # vitest, the whole suite
npm run build      # typecheck + production build to dist/
npm run preview    # serve the built bundle
```

Everyone plays on one screen. Between turns a "pass the device" interstitial hides
the hand of the player who just acted — hands are the only private information in
the game. That interstitial can be switched off from the header.

### Regenerating the parity fixtures

The parity suite compares this implementation against the Python oracle in
`../sim/rules.py`. The fixtures are generated, not hand-written:

```bash
cd web
python3 tools/gen_fixtures.py
```

This writes `tests/parity/fixtures/reckoning.json` and `constants.json`. It imports
`sim/rules.py` read-only and writes nothing outside `web/`. **Until it has been run,
two tests in `tests/parity/` fail by design** — that is the suite telling you the
fixtures are missing, and it should not be "fixed" by deleting the test.

---

## How the code is laid out

The single most important structural decision: **the ruleset is a plain TypeScript
library that does not import boardgame.io.** boardgame.io is a thin adapter over it.
That is what makes the parity suite possible (it tests functions, not a framework)
and what keeps remote multiplayer cheap later.

```
src/
  rules/            pure TS. Zero framework dependencies. Mirrors sim/rules.py.
    types.ts        vocabulary, state shape, config interface
    config.ts       THE config object: circuit break arm, deck composition, ablations
    reckoning.ts    machineVerdicts() — pure, memoised, order-independent
    placement.ts    machineAccepts() — the sole placement predicate
    setup.ts        newGame()
    phases.ts       the five phases, the turn machine, invariant checks
    driver.ts       headless day/game driver (tests and bots only; the app does not use it)
    selectors.ts    read-only views for the UI, including the "TONIGHT" narration
    rng.ts          Rng interface + seeded implementation (never Math.random)
  game/
    Laundromat.ts   boardgame.io Game: phases, turn order, moves, playerView
  ui/
    Board.tsx       layout, turn bar, zones, event/key panels, reckoning modal
    MachineCard.tsx one machine: contents, power, capacity, markers, tonight's verdict
tests/
  ported/           sim/test_rules.py rewritten in TS, same test names
  parity/           generated-from-oracle fixture replay
  game/             full games through the driver AND through the real bgio client
  ui/               jsdom render + interaction smoke tests
tools/
  gen_fixtures.py   fixture generator (run with python3)
experiments/
  experiment-B-event-timing.md   the event-timing A/B: arms, reasoning, metrics
```

Dependency direction is strictly `ui -> game -> rules`. Nothing in `rules/` imports
upward.

---

## State shape

`G` is the rules `GameState` plus three presentation fields.

```ts
// Item identity is `${owner}-${type}-${shade}` — exactly Python's (owner, typ, shade).
interface ItemCard { id; owner; type; shade; damp: boolean }

interface Machine {
  id: number;
  items: ItemId[];          // order is display-only; verdicts are order-independent
  on: boolean;              // OFF skips reckoning and keeps contents
  dead: boolean;            // Gang. permanent
  jimothy: boolean;
  cards: { name; owner }[]; // attached specials, read by the reckoning
  netProtected: ItemId[];   // Wash net, PER ITEM, set at load time (invariant I-11)
}

interface PlayerState {
  hand: ItemId[];           // private
  damp: ItemId[];           // PUBLIC zone, loadable exactly like the hand
  clean: ItemId[];
  mustWash: ItemId[];       // the 10 of 14 drawn at setup
  fresh: SpecialName[];     // drawn today, face-up, UNPLAYABLE
  ready: SpecialName[];     // playable
  finishedDay: number | null;
  keyHolds: number;
}

interface GameState {
  cfg; items: Record<ItemId, ItemCard>; machines; players;
  specialDeck; eventDeck;            // index 0 is the BOTTOM; draws pop() the end
  key; day;
  revealedEvent; eventDrawer;        // events are revealed the moment they are drawn
  jimothyAt; jimothySince; jimothyArrived;
  gangUsed;
  cbBlackout;                        // circuit break arm V1
  cbRestoreDay;                      // circuit break arm V3
  over; winners;
  turn: TurnScratch | null;          // per-turn: face, stage, loads outstanding, netTurn
  log: LogEntry[];
}
```

`GameState` plus `turnsTaken`, `lastReckoning`, `lastReckoningDay` is `LaundromatG`.

**Open information is enforced by the state shape.** The only private data is
`players[x].hand` and `players[x].ready` (the physical game's hidden hand). Loaded
items, fresh cards, damp socks, machine contents, power, markers and decks-in-play
are all public. `playerView` strips only those two arrays, and only when a `playerID`
is present — which today never happens, since hot-seat runs one client.

### Phase mapping

```
phase "roll"   one turn per player, starting with the keyholder and going around the table
               turn stages: roll -> card -> load -> extra
phase "event"  the drawn event resolves; Gang and Jimothy need a choice from the drawer
phase "key"    the keyholder turns one machine on, one off, or passes
               its onEnd runs PHASE 4 (reckoning) and PHASE 5 (end of day)
```

A note for whoever touches `Laundromat.ts` next: **do not end the roll phase with a
phase-level `endIf`.** boardgame.io evaluates `endIf` on phase *entry*, before
`onBegin`, so any counter-based test fires before the counter is reset and the game
loops forever between phases. The roll phase ends by returning `undefined` from
`turn.order.next` after a full lap. This cost an hour; it is now commented in place.

---

## Which rules are configurable

Everything the designer has not committed to lives in `src/rules/config.ts` and
nowhere else. The starred ones are selectable from the setup screen.

| Key | Default | Meaning |
|---|---|---|
| `circuitBreak` * | `'V3'` | **Under A/B test.** `V1` blackout: only tonight's reckoning is cancelled, power untouched. `V2` all-off: every washer off, keyholder restores one per day — **this is what brief v8 currently says**. `V3` auto-restore: all off, all back on at the end of the following day's reckoning — **this is what `sim/out/experiment-A-circuit-break.txt` recommends**, and the default here. The designer has not committed. |
| `specialDeck` | flat 3/3/3/3/3/3/2 | **PLACEHOLDER, NOT A DESIGN DECISION.** Copy counts are P0 and unresolved. The only hard constraint is manufacturing: **exactly 20 cards** (`publishing-research.md:187`), asserted at setup. The setup screen says so in as many words, so nobody forms an opinion about card balance from it. |
| `eventTiming` * | `'E1'` | **Under A/B test — experiment B.** When a drawn event RESOLVES (it is revealed on draw in every arm). `E1` immediate, mid-turn. `E2` deferred until everyone has loaded — **this is brief v8 as written and what `sim/rules.py` does**. `E3` split: untargeted events immediate, targeted ones deferred. Reasoning and what to measure: `experiments/experiment-B-event-timing.md`. |
| `turnOrder` | `'cardLoadExtra'` | Designer-confirmed: roll → play a card → load → the die's extra effect. `'extraLoadCard'` implements the (now stale) rules-v0.4 §3.1 reading and still passes the integrity tests. |
| `meshBagRule` | `'guaranteed'` | **Designer revision, diverges from brief v8 and from `sim/rules.py`.** `'guaranteed'` = Mesh bag: everything you load into that machine on the turn you play the card washes when the machine runs, whatever else is in there. `'v8net'` = brief v8's Wash net: same-turn underwear only, waiving underwear isolation and nothing else. **The oracle fixtures all run on `'v8net'`, which is why parity survives this change.** The card's internal id is still `'Wash net'`; it is displayed as "Mesh bag". Rename both sides together when the sim is updated. |
| `ownItemsDontTaint` | `true` | **Designer revision, diverges from brief v8 and from `sim/rules.py`.** Your own items never taint your own items by shade. Each item is judged against the machine minus its owner's other items, and among your own items a shade-blind ladder applies: shoes (D = L) > clothing and blanket (D = L) > underwear (D = L). Opponents still taint you normally. `false` restores brief v8's single machine-wide shade ladder, which is what all the oracle fixtures use. **This breaks single-tier-per-machine**: each owner can be on a different rung at once. |
| `sanitizerOwnerOnly` * | `false` | `false` = machine-wide, tiers 1–2 suppressed [A-21]. `true` = the owner-only reading rules-v0.4 [OQ-01] argues against. |
| `publicDampZone` * | `true` | `true` = damp socks sit in a face-up zone [A-28]. `false` = they go back to the hidden hand, Python-style. No reckoning outcome changes either way. |
| `keyholderFirst` | `true` | **RESOLVED in brief v9 §4 — no longer an experiment and no longer offered in the setup UI.** The roll phase begins with the keyholder and proceeds around the table, so yesterday's keyholder acts last; acting order rotates with the key. This closes the measured seat-1 skew (38.4% at three players against a 33.3% fair share) and is the mitigation experiment B recommends pairing with E1. `false` restores [A-W01]'s fixed seat order and is retained for ablation only. |
| `bleachKillsDark` | `false` | Sensitivity reading from rules-v0.2 [OQ-05]: Bleach destroys dark instead of swapping shades. |
| `socksBlanketExtraWash` | `true` | The v8 socks/blanket rule. Present as an ablation switch. |
| `crowdThreshold` | `3` | ≥N of a garment type sends them all back [A-22]. |
| `capacity`, `handSize`, `machines` | 4, 10, P+1 | Board totals. |
| `dayCap` | 400 | Safety valve for headless sweeps. |

---

## The reckoning

`machineVerdicts()` is a direct port of `rules.py:machine_verdicts`. rules-v0.4 §6.1
proves the post-ladder filters are a **pure conjunction of monotone downgrades** that
compute their demotion sets from machine contents and attached cards only — never
from another item's verdict — so they commute. The code says so literally:

```ts
const filters = [underwearIsolation, blanketExclusivity, crowding, coloring];
for (const f of filters) for (const i of f(ctx)) washing[i] = false;
```

The only load-bearing ordering constraint is that the pre-ladder modifiers (Bleach's
shade swap, Sanitizer's tier suppression) run before tier selection.

Two consequences worth stating because they are easy to get wrong:

- **The socks/blanket damp transform is NOT inside the pure function.** It mutates a
  per-card bit, which would poison the memo table. It runs in `phaseReckon` as step
  S8, exactly as in the Python.
- **It keys on the machine *containing* a blanket, not on the blanket *washing*
  [A-24].** Keying on another item's verdict is precisely what would break
  commutativity. Worked example 18 (dark socks + light blanket) is the case that
  distinguishes the two readings, and it is in the fixture set.

---

## What the parity suite guarantees, and what it does not

**Guaranteed.** Every verdict `machineVerdicts()` produces is identical to
`sim/rules.py`'s on:

- all ~60 named worked examples from rules-v0.4 §6.13 Table A and the S/N/W families
  of `test_rules.py`;
- an **exhaustive enumeration** of every 1-, 2- and 3-item machine over a 42-key
  alphabet (3 owners × 7 types × 2 shades) — 12,383 machines, no cards;
- a **5,000-machine seeded random sweep** with attached cards (Bleach, Coloring,
  Color catcher, Sanitizer, per-item Wash net protection), 1–4 items, four owners,
  and both the `bleachKillsDark` and `sanitizerOwnerOnly` sensitivity readings;
- the component constants: item taxonomy, card lists, event deck, machines-per-player,
  capacity, hand size, crowd threshold, and the full dice table.

Plus the whole of `test_rules.py` re-expressed as TypeScript in `tests/ported/`,
keeping the Python test names so a failure maps one-to-one onto the oracle's suite.

**A second, newer caveat.** `sim/rules.py` implements event timing arm `E2` only.
Running the web app on `E1` (the current default) or `E3` makes day-level behaviour
non-comparable with the simulation, and invalidates existing balance numbers for
any question that touches events. The reckoning parity suite is unaffected, because
it tests a pure function that knows nothing about when events fire. See
`experiments/experiment-B-event-timing.md` section 8.

**NOT guaranteed, and it cannot be.** There is **no seed-for-seed parity of whole
games** between this implementation and the Python simulation. Python's
`random.Random` (Mersenne Twister) and boardgame.io's RNG are different streams, and
neither can reproduce the other. Feeding the same seed to both produces different
dice, different deals and different games. The two are **the same rules, not the same
game generator.**

Do not use this implementation to reproduce a specific simulated game, and do not use
the simulation to reproduce a specific play session. Where whole-game behaviour needs
checking, `tests/game/` asserts the same *properties* the Python suite does
(termination, conservation, invariants I-1..I-13, at most one Gang, winners hold ten
clean items) over many self-played games, rather than claiming equality.

---

## Status: what works, what is not built

**Works and is verified by tests:**

- The complete v8 ruleset: four-tier ladder, all filters, all seven specials, all four
  events, Jimothy and hostages, Gang's permanent destruction and his relocation, all
  three circuit break arms, damp socks, mandatory loading, fresh→ready promotion,
  key rotation, simultaneous victory.
- Complete games play to victory through the **real boardgame.io client** at 3, 4, 5
  and 6 players and under every circuit break arm.
- The hot-seat UI renders, rolls, loads, plays cards and narrates each machine.

- The online client: mode chooser, create/join, lobby, reconnection, and the board
  played from one seat. See "Playing online" below.

**Not built:** bots in the UI, undo/replay, animation, spectator mode (there is
deliberately no way to watch a game you are not seated in).

---

## Playing online (the client half)

Hot-seat is unchanged and is still the default landing screen. Online is an
addition next to it, and the two share nothing but `src/rules/` and `Board.tsx`.

```
src/online/
  api.ts      the ONLY module that reaches src/net/. Declares NetApi, loads the
              transport, and turns every failure into a sentence a player can act on.
  session.ts  {code, playerID, credentials} in localStorage, the /join/ABCD link,
              and a store that copes with localStorage being broken or absent.
  Online.tsx  three screens: entry (create or join), lobby, game.
```

**The seat, not the turn.** `Board.tsx` keys everything off `playerID`. Absent
means hot-seat: one screen speaks for everybody and the hand on show is always
the active player's. Present means online: `seat` is you and never moves,
`current` is whoever is acting, and they are equal only on your turn. Every
control is gated on that, and the hand zone reads `seat` — never `current`,
because the server has already stripped the other hands out of `G` and asking
for one would render nothing at all.

**What the other players are.** A count. `playerView` replaces their item ids
with placeholders, so `hand.length` survives and the ids do not. There is
deliberately no row of card backs anywhere: a face-down card implies the
information is there to be had, and it is not. Everything else — washers,
loaded items, damp piles, clean piles, power, markers — is public and is drawn
in full for everyone, which is the point of the game.

**No pass-the-device screen online.** It exists to hide a hand from the person
sitting next to you. There is nobody sitting next to you, your hand was never on
their device, and there is nothing to pass — so it would be both a lie and a
dead end. `needsPass` is gated on `!online` for exactly that reason.

**Saying what is happening.** A screen that waits silently is indistinguishable
from one that has crashed, which is how an online board game usually looks
broken. Every phase and stage produces a sentence through `doingNow()`, shown in
two places at once: the turn strip at the top of the screen and the sticky bar
under the thumb. Disconnections are announced by name, and say whether the game
is waiting on that player or carrying on without them.

The server half is `server/` and `src/net/`; see their own notes for the wire
format and room lifecycle.

**Known rough edges:**

- The reckoning modal must be dismissed each day; there is no fast-forward.
- The face-4 displacement flow needs two clicks with no drag affordance.
- The log is plain text with no filtering.
- No confirmation before an irreversible choice (Gang's target, the keyholder's toggle).
