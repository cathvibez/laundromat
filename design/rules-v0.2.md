# Laundromat — Formal Rules v0.2

**Supersedes:** `rules-v0.1.md` (retained on disk as a record; do not edit it).
**Formalizes:** `design/game-brief.md` — Design Brief **v2**.
**Purpose:** A specification precise enough to (a) resolve at a physical table with no hidden
bookkeeping, and (b) implement directly as pure reducer functions in boardgame.io.

**Tags used throughout.**
**[A-nn]** — an assumption I introduced to close a gap. All are collected in §6 and await
designer sign-off.
**[!]** — a rules-integrity problem; see §7.
**[CONFLICT]** — a point where hand-resolvability and clean implementation genuinely diverge.
**[v2]** — a rule that changed from Brief v1, called out where the change has consequences.

### What changed from v0.1 — reader's summary

| # | Change | Where it bites |
|---|---|---|
| 1 | Socks are one card. 16 cards/color, must-wash set is exactly 10. | §2. **Kills two of the four candidate readings of the crowding rule outright** (§5.7). The v0.1 "sock trap" no longer exists. All hypergeometric hand-size analysis is deleted. |
| 2 | New dice table: 5 draws a special item, 6 lays a face-down event. First 6 of the day only. | §4. Events go from ~17% of days to **42–67% of days** depending on player count. Special item throughput roughly doubles. |
| 3 | Events resolve **after** reckoning. | §5.11, §7.3. **Transforms Gang and breaks Electricity.** Gang now hits only OFF machines. |
| 4 | Keyholder bonus roll deleted. | §3. Phase 3 collapses to a single optional action. Simplification, no side effects. |
| 5 | Key passes at end of day, after events. | §3. Resolves v0.1's [OQ-03] cleanly: seat 1 is keyholder on day 1, unambiguously. |
| 6 | Special items cannot be played the day drawn. | §3.4. Needs a *fresh/ready* two-zone hand, **not** a per-card day-stamp (§3.4 argues why). |
| 7 | Handwash basket: "immune to all other rules", absolute. | §5.3. Non-monotone. **Commutativity result survives — see §5.1 for the proof and the one modelling choice it depends on.** |

Carried forward unchanged: machines start ON; OFF skips reckoning and retains contents;
crowding (3 of a kind → all 3 sent back); sent back to hand with no penalty; Jimothy blank;
the four-tier ladder; linen constraints; blanket exclusivity; no capacity limit.

---

## 1. GLOSSARY

Brief v2 has already adopted **linen** as the category name (good — v0.1 proposed it). It still
uses *garment*, *item*, and *clothes* loosely. This section fixes one canonical term per concept;
all later sections use only canonical terms.

### 1.1 Canonical terms

| Term | Status | Definition |
|---|---|---|
| **item** | **CANONICAL** | The atomic unit of laundry: exactly one card. Attributes: `owner` (player color), `shade` (`dark`\|`light`), `type` (one of the eight in §2.1), `id`, and — for bedding only — `washCount`. **[v2]** A pair of socks is one item; there is no sub-item structure anywhere in the game. |
| **garment** | **ALIAS — deprecated** | The brief uses it for the roll of 4 and for the Handwash basket. Treat every occurrence as *item*. **Do not read it as "clothes but not linen"** — under that reading the Handwash basket could not touch bedding, which would remove the only clean answer to the double-wash rule. See [A-17]. |
| **piece** | **ALIAS — deprecated** | No longer appears in Brief v2. Retired. |
| **clothes / clothing** | **CANONICAL (category)** | `{shoes, socks, pants, shirts, hats}`. Never a synonym for *item*. A single one is a *clothing item*. |
| **linen** | **CANONICAL (category)** | `{underwear, blanket, bedding}`. Brief v2 adopts this term. |
| **shade** | **CANONICAL** | `dark` \| `light`. Intrinsic, printed, never mutated. |
| **effective shade** | **CANONICAL** | The shade an item is treated as having for **one reckoning of one machine**, after Bleach. Equals `shade` unless a Bleach card is attached there. Never persists. |
| **type** | **CANONICAL** | One of the eight values in §2.1. |
| **kind** | **CANONICAL (crowding only)** | The equivalence class for the crowding rule. **[A-06]: `kind(item) = item.type`.** Used nowhere else. |
| **pair** | **RETIRED** | **[v2]** Socks are no longer split, so a "pair" is not a game object at any level. The word survives only on the card face ("Socks (a pair)") as flavour. |
| **machine** | **CANONICAL** | Board zone with identity `M1..M(P+1)`, `power ∈ {ON, OFF}`, a multiset of loaded items, and a multiset of attached special item cards. Fully public. |
| **loaded** | **CANONICAL** | An item is *loaded* iff it is in a machine. Loaded items are public. |
| **washed** | **CANONICAL** | Terminal verdict: the item leaves play into its owner's **clean pile** and counts toward victory. Bedding is the sole exception (see *wash event*). |
| **wash event** | **CANONICAL** | One successful wash of one item by one machine, or one Handwash basket resolution. For every type but bedding, one wash event = washed = clean. Bedding needs two. The term exists solely to keep bedding's arithmetic unambiguous. |
| **sent back** | **CANONICAL** | Terminal verdict: removed from the machine, returned to the owner's **hand**, no penalty, no state change. Bedding keeps its `washCount`. |
| **retained** | **CANONICAL** | The *non*-verdict: the item stays loaded into the next day. Occurs only when the machine does not reckon (power OFF, or a suppressed reckoning under Electricity). Distinct from both other verdicts. |
| **day** | **CANONICAL** | = round. One full pass of §3's six phases. This spec says *day* game-facing, `round` for the state field. |
| **reckoning** | **CANONICAL** | Phase 4: independent resolution of every ON machine. |
| **event resolution** | **CANONICAL, NEW [v2]** | Phase 5: the face-down event card, if one was laid this day, is revealed and resolved. |
| **pending event** | **CANONICAL, NEW [v2]** | A face-down event card lying on the table, laid during Phase 1, awaiting Phase 5. Its *existence* is public; its *identity* is hidden from every player including the one who laid it. At most one per day. |
| **turn order** | **CANONICAL** | Fixed clockwise seating order, set at setup, never changes. |
| **acting order** | **CANONICAL** | The sequence in which players act within a phase: keyholder first, then clockwise [A-13]. |
| **keyholder** | **CANONICAL** | The player holding the key for the current day. **[v2]** Holds it through reckoning *and* event resolution; the key passes only at the very end of the day. |
| **hand** | **CANONICAL** | A player's unloaded, unwashed items plus their held special item cards. Hidden [A-18]. Partitioned into two zones — see *ready* / *fresh*. |
| **ready** | **CANONICAL, NEW [v2]** | The zone of a hand holding special item cards that are legal to play. |
| **fresh** | **CANONICAL, NEW [v2]** | The zone holding special item cards drawn **this day**. Fresh cards cannot be played. All fresh cards move to *ready* at the end of the day (§3.4). Item cards are never fresh — only special item cards are. |
| **clean pile** | **CANONICAL** | Public, face-up, per-player pile of washed items. Public so victory is verifiable without inspecting hands. |
| **must-wash set** | **CANONICAL** | **[v2]** The **exactly 10** items dealt at setup. Fixed for the game. Victory = clean pile equals must-wash set. Items outside it never enter play. |

### 1.2 Terms eliminated

- **"garment"**, **"piece"** → **item**.
- **"basic"** vs **"linen"** in the taxonomy table → these are exactly `clothes` vs `linen`
  and carry no further meaning. The word *basic* is dropped.
- **"special item"** as a name for linen → already fixed by Brief v2.

---

## 2. COMPONENT MANIFEST

### 2.1 Item types — **[v2] socks unsplit**

| `type` | category | cards per shade | cards per color |
|---|---|---|---|
| `shoes` | clothes | 1 | 2 |
| `socks` | clothes | **1** (the pair is one card) | 2 |
| `pants` | clothes | 1 | 2 |
| `shirts` | clothes | 1 | 2 |
| `hats` | clothes | 1 | 2 |
| `underwear` | linen | 1 | 2 |
| `blanket` | linen | 1 | 2 |
| `bedding` | linen | 1 | 2 |
| **TOTAL** | | **8 cards / 8 types** | **16** |

`8 types × 2 shades = 16 cards per color.` No arithmetic dispute remains. The v0.1 16-vs-18
analysis is void and is not carried forward.

**The most important structural consequence: a color can now contribute at most 2 cards of any
one type** (one dark, one light), and at most **1** of any (type, shade) combination. This single
fact resolves the crowding-rule ambiguity by elimination — see §5.7 and [OQ-06].

### 2.2 Totals by player count

Machines = players + 1.

| Players | Item cards in play | Cards actually dealt (10/player) | Cards inert | Machines |
|---|---|---|---|---|
| 3 | 48 | 30 | 18 | 4 |
| 4 | 64 | 40 | 24 | 5 |
| 5 | 80 | 50 | 30 | 6 |
| 6 | 96 | 60 | 36 | 7 |

**[A-02]** The 6 undealt cards of each color are set aside face-down and are **inert** for the
rest of the game: never drawn, never revealed, never referenced by any effect. (With the sock
fetch deleted there is no longer any rule that reaches into them at all.)

### 2.3 Setup

1. Establish seating (turn order). Each player takes their 16-card color deck.
2. Each player shuffles their own deck and draws **10 items**. That is their **must-wash set**,
   fixed for the game. The remaining 6 go face-down, inert [A-02].
3. All machines start **ON** and empty.
4. Seat 1 takes the key. **[v2] Unambiguous now:** the key passes at the *end* of the day, so
   seat 1 is keyholder for the whole of day 1. (v0.1's [OQ-03] is closed by the brief.)
5. Special item deck and event deck are shuffled. No cards are dealt from either.

### 2.4 What a player is actually dealt — the numbers that matter

10 items drawn from 16, of which 6 are linen and 10 are clothes:

```
P(dealt zero linen)          = C(10,10)·C(6,0) / C(16,10) =    1 / 8008  =  0.0125%
P(dealt at least one blanket)= 1 − C(14,10)/C(16,10)      = 1 − 1001/8008 = 87.5%
P(dealt both blankets)       = C(14,8) /C(16,10)          = 3003/8008     = 37.5%
P(dealt at least one bedding)= same as blanket             =                87.5%
Expected linen per player    = 10 × 6/16                   =                3.75 items
```

Three consequences, all load-bearing:

- **§7.1 (unwinnable linen) is now worse, not better.** Only 1 deal in 8008 avoids linen —
  0.0125%. Under the brief's literal tier text, effectively every player in every game holds a
  permanently unwashable item.
- **7 players in 8 hold a blanket**, and a blanket in an ON machine is a near-guaranteed wash
  (§7.5). Expect blankets to be the opening move of most games.
- **7 players in 8 hold bedding**, which needs two wash events. The nominal "10 items" is
  effectively **~10.9 wash events** (10 + 0.875 × ... ≈ 10 + 1.25 expected bedding cards ×1 extra
  event = 11.25 wash events on average, since expected bedding count is 2×10/16 = 1.25).
  **Expected wash events per player ≈ 11.25.** Worth putting in player-facing text.

### 2.5 Special item card deck

**[!] Brief v2 explicitly flags this as unspecified and as "the primary balance dial".** It is
now *more* load-bearing than in v1, because the draw moved from a 6 to a **5** — no, the draw
rate per player is identical (1 face in 6), but a 5 used to be a dead face and is not any more,
so the *net* rate of cards entering the game is unchanged at ≈ P/6 per day while the rate of
dead turns fell. See §4.6.

**[A-03] ASSUMPTION:** one shared deck, **3 copies of each of the 5 cards = 15 cards**, shuffled.
Drawn cards enter the drawer's **fresh** zone. Played cards attach to a machine, stay attached
until that machine reckons (or until Gang), then shuffle back into the deck. There is no discard
pile. Expected draws ≈ P/6 per day (0.50 at 3 players, 1.00 at 6).

### 2.6 Event card deck

3 cards: **Gang**, **Jimothy**, **Electricity**. At most one is out of the deck at any time
(as a face-down pending event). Resolved cards shuffle straight back. The deck therefore **can
never be empty when a 6 is rolled** — there is always at least 2 cards in it. **[!] Jimothy has
no defined effect**; see §7.4.

### 2.7 Other components

| Component | Count | Purpose |
|---|---|---|
| Key | 1 | Marks the keyholder. |
| Die | 1 (d6) | Shared. **[v2]** Rolled exactly once per player per day. No other roll exists in the game. |
| Machine power markers | P+1 | ON/OFF per machine. |
| **Bedding wash tokens** | 2 per player | Ride on a bedding card to record one accrued wash event. **[A-04]** Public even while the bedding is in a hidden hand: the token stays on the card and players must answer truthfully if asked. Any other reading is hidden bookkeeping a table cannot police. |
| **Fresh-card zone marker** | 1 per player (a mat line, a coaster, anything) | Physically separates *fresh* from *ready* special item cards. **[v2] Required** — see §3.4. |
| Handwash basket | none needed | **[A-17]** The basket is a per-play effect, not a persistent component. |

---

## 3. ROUND STATE MACHINE

### 3.1 Phase list (strict order) — **[v2] six phases**

`P` = players, `M = P + 1` = machines. `order(k)` = acting order: keyholder first, then
clockwise [A-13].

---

**PHASE 1 — ROLL PHASE**
- *Entry:* start of a day.
- *Actors:* every player, once each, in `order(k)`.
- *Effect:* roll 1d6; resolve per §4.
- *Exit:* every player has rolled and fully resolved.
- *Note:* the key does **not** rotate here. **[v2]** Rotation is Phase 6.

**PHASE 2 — SPECIAL ITEM PHASE**
- *Entry:* Phase 1 complete.
- *Actors:* every player, once each, in `order(k)`, **sequentially** [A-15].
- *Legal actions, choose exactly one:*
  - play **one** special item card **from the `ready` zone**, attaching it to one machine
    (ON or OFF), or
  - pass.
- *Constraints:* **[v2] a card in the `fresh` zone cannot be played.** At most one card played
  per player per day. No limit on cards held [A-07]. Handwash basket resolves its extraction
  **immediately on play**, here in Phase 2 (§5.3).
- *Exit:* every player has played or passed.

**PHASE 3 — KEY PHASE**
- *Entry:* Phase 2 complete.
- *Actor:* the keyholder only.
- *Legal actions, choose exactly one:* turn one machine ON; turn one machine OFF; pass.
- **[v2] There is no bonus roll.** Phase 3 is now a single decision and nothing else.
- *Exit:* the keyholder has acted or passed.

**PHASE 4 — RECKONING**
- *Entry:* Phase 3 complete.
- *Suppression:* if `dayFlags.reckoningSuppressed` is set (by an Electricity resolved on the
  *previous* day — see [A-11]), Phase 4 is skipped entirely and every machine RETAINS its
  contents. The flag is cleared on use.
- *Actor:* none. Fully automatic and deterministic.
- *Effect:* for each machine in ascending index order `M1..M(P+1)`, run `RESOLVE_MACHINE` (§5.2).
  Machines are mutually independent — no machine's resolution reads or writes another's state —
  so index order is arbitrary and exists only for replay tidiness and orderly table procedure.
- *Post-effect:* **every ON machine is empty of items** (invariant I-3). Special item cards
  attached to ON machines shuffle back into the deck; cards on OFF machines stay attached [A-09].
- *Exit:* all machines resolved (or skipped).

**PHASE 5 — EVENT RESOLUTION [v2, NEW]**
- *Entry:* Phase 4 complete.
- *Effect:* if a pending event exists, reveal it, resolve it fully (§5.11), then shuffle it back
  into the event deck. If none, skip.
- *Actor:* none — all three events are fully automatic. Jimothy currently does nothing [A-12].
- *Exit:* event resolved and returned, or no pending event.

**PHASE 6 — END OF DAY [v2]**
- *Entry:* Phase 5 complete.
- *Effects, in this order:*
  1. **Victory check.** For each player, if `cleanPile == mustWashSet`, they win. If more than
     one qualifies, **all of them win jointly** [A-19].
  2. **Fresh → ready.** Every special item card in every player's `fresh` zone moves to `ready`.
  3. **Key passes** to the next player in turn order. The new keyholder holds it "from the dawn"
     of the next day.
  4. `round += 1`.
- *Exit:* `GAME_OVER` if any winner, else Phase 1 of the next day.

**Where the victory check goes — a small theorem.** No event card can revoke a wash: Gang only
sends back items *still in machines*; washed items are already in a clean pile. Electricity only
suppresses a future reckoning. Jimothy is blank. Therefore **the set of winners is identical
whether the victory check runs immediately after Phase 4 or at the end of Phase 6.** Implementers
may put it wherever is convenient; this spec puts it in Phase 6 for a single clean exit point.
If Jimothy is ever defined as something that can un-wash an item, this theorem dies and the check
must move to Phase 6 by necessity.

---

### 3.2 State-transition table

`k` = keyholder seat, `i` = index into `order(k)`. `—` for `ctx.actor` means auto-advance.

| # | State | ctx.actor | Legal moves | Guard | Next state | Exit condition |
|---|---|---|---|---|---|---|
| 0 | `DAY_START` | — | — | — | `ROLL(0)` | auto |
| 1 | `ROLL(i)` | `order(k)[i]` | `rollDie()` | actor has not rolled today | `ROLL_RESOLVE(i, face)` | rolled |
| 2 | `ROLL_RESOLVE(i, 1..3)` | `order(k)[i]` | `loadItem(itemId, machineId)` × `n`, `n = min(face, legalLoads)` | item ∈ actor's hand; `machineAccepts` (§4.7) | next | `n` loads done |
| 3 | `ROLL_RESOLVE(i, 4)` | `order(k)[i]` | `moveItem(itemId, from, to)` × 1, or auto-skip | `item.owner ≠ actor`; item loaded; `to ≠ from`; `machineAccepts(to, item)` | next | moved, or no legal move |
| 4 | `ROLL_RESOLVE(i, 5)` | — | `drawSpecial()` → **fresh** zone | special deck non-empty | next | drawn, or deck empty |
| 5 | `ROLL_RESOLVE(i, 6)` | — | `layEvent()` | **`pendingEvent == null`** — else strict no-op | next | laid, or already pending |
| 6 | `SPECIAL(i)` | `order(k)[i]` | `playSpecial(cardId, machineId[, targetItemId])` or `pass()` | card ∈ actor's **ready** zone; ≤1 play today; basket target legal (§5.3) | `SPECIAL(i+1)` or `KEY` | played or passed |
| 7 | `KEY` | player `k` | `setPower(machineId, ON\|OFF)` or `pass()` | exactly one machine; new value ≠ old | `RECKON(0)` | acted or passed |
| 8 | `RECKON(j)` | — | `resolveMachine(M[j])` | skipped wholesale if `reckoningSuppressed` | `RECKON(j+1)` or `EVENT_RESOLVE` | `j > P` |
| 9 | `EVENT_RESOLVE` | — | `revealAndResolveEvent()` | `pendingEvent ≠ null`, else skip | `END_OF_DAY` | resolved |
| 10 | `END_OF_DAY` | — | victory check → fresh→ready → key passes → `round++` | — | `GAME_OVER` if winner, else `DAY_START` | auto |
| 11 | `GAME_OVER` | — | — | — | terminal | — |

**boardgame.io mapping.** States 1–5 are one turn per player in a `roll` phase with
`turn.order` starting at the keyholder. State 6 is a `special` phase, same order. State 7 is a
`key` phase with a single turn belonging to the keyholder. States 8–10 take **no player input**
and belong in the `key` phase's `onEnd` — they must not be exposed as moves. `RESOLVE_MACHINE`
must be a pure function of `(machine, attachedCards, dayFlags)` so it is unit-testable outside
the framework.

**[!] `pendingEvent` is the first and only state in the game hidden from *every* player**,
including its own creator. In boardgame.io it must live in `G.secret` and be stripped by
`playerView` for all `playerID`s — not merely stripped for opponents. **[CONFLICT], inverted:**
this is *trivial* at a physical table (a card is face-down and nobody looked) and *non-trivial*
digitally (it is the one place where the server knows something no client may know, and where a
naive `playerView` that only hides "other players' private data" leaks). Note it in
implementation; it is not a design problem.

### 3.3 Deleted from v0.1

- The Phase 0 key-rotation step (rotation is now Phase 6).
- The keyholder bonus roll and its outcome table.
- The pre-reckoning event slot.
- The sock-fetch setup step.

### 3.4 "Cannot be played the day it is drawn" — is this hand-trackable? **Yes, but only one way.**

The brief's rule requires knowing, for each held special item card, whether it was acquired
today. The obvious encoding is a per-card `drawnOnDay` timestamp. **At a physical table a
timestamp is not trackable** — nothing is printed on the card, players would have to remember
day numbers for a variable number of cards across a game of unbounded length, and there is no
way for opponents to audit a claim. That is precisely the "hidden bookkeeping" the platform
goals forbid.

**[A-05] ASSUMPTION: implement the rule as a two-zone hand, not a timestamp.**

Each player's special item cards sit in one of two physically separated zones in front of them:

- **`fresh`** — drawn today. Cannot be played.
- **`ready`** — drawn on any earlier day. Playable.

A card drawn in Phase 1 goes to `fresh`. In Phase 6 step 2, **every** card in **every** `fresh`
zone slides to `ready`. That is one gesture per player per day, requires no memory, and is
publicly auditable — an opponent can see *how many* cards are fresh (though not what they are)
because the zones are physically distinct.

**This is exactly equivalent to the timestamp.** The only query the rule ever makes is
`drawnOnDay == currentDay`, which the zone answers as a boolean. Formally: the map
`z(card) = (card.drawnOnDay == currentDay ? fresh : ready)` is preserved by the Phase 6
promotion, so the two representations are isomorphic. Implement the boolean; it is O(1), it
survives serialization, and it matches the table.

**Sub-question [A-06b]:** are the *counts* of fresh vs ready cards public? Recommend **yes** —
zone membership is public, card identity is private. This is what physical separation naturally
produces and it gives opponents a real read ("she has two ready cards, something is coming")
without leaking which cards.

---

## 4. DICE OUTCOME TABLE

**[v2]** One die. Rolled exactly once per player per day, in Phase 1. **There is no other die
roll anywhere in the game** — the keyholder bonus roll is deleted.

### 4.1 Full table

| Face | Outcome | Precise rule | Degenerate cases |
|---|---|---|---|
| **1** | Load 1 item | Actor loads exactly 1 item from hand into any one machine. | Hand empty, or no machine accepts any held item → load 0, no-op. |
| **2** | Load 2 items | Loads exactly 2. Each chosen independently; each may go to a **different** machine [A-08]. | Hand has 1 → load 1. Fewer legal placements than items → load as many as legal. |
| **3** | Load 3 items | As above with 3. | As above. |
| **4** | Displace | Move **one item owned by another player** from its machine to a *different* machine. **It can never leave the machines.** | No other player's item is loaded anywhere → **no effect**. Every other machine refuses the item (all hold blankets) → **no effect**. |
| **5** | **[v2] Draw special item** | Draw 1 special item card into the **fresh** zone. **Cannot be played today** (§3.4). | Special deck empty → **no effect**, no compensation, no reshuffle (there is no discard pile to reshuffle). |
| **6** | **[v2] Lay a face-down event** | If no pending event exists, take the top card of the event deck **without looking at it** and lay it face-down on the table. It resolves in Phase 5. | **A pending event already exists (an earlier player rolled a 6 today) → nothing happens at all.** Explicit in the brief. Not a re-roll, not a second event, not a draw. |

**Rolling 4, 5, or 6 loads zero items.** Expected items loaded per player per day = (1+2+3)/6 =
**1.0**, unchanged from v1. This is still the game's only pacing throttle.

### 4.2 Faces 1–3 — loading is mandatory and maximal

**[A-08]** The actor must load `min(face, |legal placements|)` items. They choose *which* items
and *which* machines; they do **not** choose how many. The brief's word is "exactly", and
optional loading would make "never load anything you can't guarantee" dominant, stalling the
game outright (§7.2).

Consequence: a player can be forced to load an item into a machine that will destroy it. That is
the game's core tension and is intended.

**[A-08b]** On a 2 or 3, the items may be split across different machines. The brief says
"machines", plural. The alternative (all into one machine) makes a 3 dramatically more dangerous
to roll and is a materially different game.

### 4.3 Face 4 — displacement, precisely

- Target must satisfy `item.owner ≠ actor`. Any other player's item, in any machine, ON or OFF.
- Destination must differ from the source and must satisfy `machineAccepts` (§4.7).
- **The item can never be returned to a hand this way.** Displacement is machine-to-machine only.
- **[A-16]** A blanket *may* be displaced, but only into an **empty** machine, since exclusivity
  binds destinations as well as loads. If no machine is empty, blankets are not legal targets.
- Displacing into an **OFF** machine is legal and is the main way to freeze another player's item
  — or, read the other way, to shelter it. Both readings are live and that ambiguity is the point.

### 4.4 Face 6 — the pending event, precisely

- **Nobody looks at the card, including the roller.** It is drawn blind from the top of the deck
  and placed face-down.
- **At most one pending event per day.** The *first* 6 of the day creates it; every subsequent 6
  that day is a **complete no-op** — not a draw, not a second card, not a re-roll, no compensation.
- Existence is public, identity is hidden from all.
- The pending event does **not** attach to a machine. It is global, on the table.
- It cannot be interacted with: no card removes, peeks at, redirects, or cancels it.
- **[A-10]** A pending event never carries over. It always resolves in Phase 5 of the same day.
  There is no state in which two events are pending.

**Event frequency [v2] — the single biggest tuning change in the brief:**

```
P(an event fires on a given day) = 1 − (5/6)^P

  3 players → 1 − 125/216   = 42.1%
  4 players → 1 − 625/1296  = 51.8%
  5 players → 1 − 3125/7776 = 59.8%
  6 players → 1 − 15625/46656 = 66.5%
```

Compare v1, where the sole event source was the keyholder's single bonus roll: a flat **16.7%**
regardless of player count. **Events are now 2.5×–4× more frequent and scale with player count.**
Gang alone (1/3 of the deck) now fires on **14%–22% of days**. The brief's v1 line "events are now
rare — roughly once every six rounds" is no longer true and should be struck from player-facing
text. Whether this is desirable is a designer call — see [OQ-10].

### 4.5 Universal no-op rule

**Any die outcome that cannot be legally executed is discarded with no effect.** No re-roll, no
substitution, no compensation. Covers: empty hand on 1–3; no valid displacement on 4; empty
special deck on 5; an already-pending event on 6. Stated once so implementations need not
special-case each face.

### 4.6 Dead-face analysis [v2]

| | Brief v1 | Brief v2 |
|---|---|---|
| Faces that do nothing for you | 5 (nothing) | **none** |
| Faces that do nothing *for you specifically* | 5 | 6 (you lay an event you cannot see, benefiting nobody in particular) |
| Expected items loaded / player / day | 1.0 | 1.0 |
| Expected special cards drawn / player / day | 1/6 | 1/6 |
| Expected events / day | 1/6 (flat) | 1 − (5/6)^P (**scales with P**) |

The 5-face is no longer a wasted turn, which is a real improvement in moment-to-moment feel. But
note the die's *aggregate* output is nearly unchanged: the same 1.0 items and the same 1/6 special
cards per player. **What actually changed is event frequency**, by a large factor. See §7.2 for
what that does to termination.

### 4.7 `machineAccepts(machine, item)` — the sole placement-legality predicate

Applies to loads (faces 1–3) and displacements (face 4) identically.

```
machineAccepts(machine, item):
    if machine contains a blanket                 -> FALSE   (nothing joins a blanket)
    if item.type == blanket and machine non-empty -> FALSE   (a blanket joins nothing)
    otherwise                                     -> TRUE    (no capacity limit)
```

Power state does not affect placement legality. Both clauses are needed; neither implies the
other. The Handwash basket's extraction is **not** a placement and is not governed by this
predicate.

---

## 5. THE RECKONING ALGORITHM

### 5.1 Structure of the algorithm — and whether the Handwash basket breaks it

**The v0.1 commutativity result, restated.** The rules bearing on a machine's resolution fall
into three classes:

| Class | Rules | Direction |
|---|---|---|
| **(a) Shade remapping** | Bleach | Changes the *inputs* to tier selection. Must run first. |
| **(b) Tier selection + provisional verdict** | the four-tier ladder | Establishes the baseline. |
| **(c) Monotone downgrades** | underwear isolation, blanket exclusivity, crowding, Coloring/Color catcher | Can only turn `WASHED → SENT_BACK`, never the reverse. |

Every class-(c) rule computes its demotion set from the machine's **contents and attached cards
only** — never from another item's current verdict. So no class-(c) rule can change another's
input, and the final verdict is a conjunction:

```
washed(i) = tierMatch(i) ∧ ¬isolationViolated(i) ∧ ¬crowded(i) ∧ ¬ruined(i)
```

Conjunction is order-independent. **The only load-bearing ordering constraint inside a machine is
Bleach before tier selection.** This is what makes the reckoning both a clean filter chain in a
reducer and fast to resolve by hand in any order at a table.

---

**Does the Handwash basket break this? — Plainly: no, and here is exactly why.**

The basket is unambiguously **non-monotone**: it turns a would-be `SENT_BACK` into `WASHED`, which
is the one direction class (c) forbids. If it sat inside the filter chain, the chain would stop
being a conjunction. So the question is real and deserves a straight answer rather than a
reassurance.

The answer turns on **one modelling choice**, and I want to be explicit that the result depends
on it:

- **Model E — extraction (recommended, [A-17]).** The basket *removes* the item from the machine
  at the moment the card is played (Phase 2). By the time Phase 4 runs, the item **is not in the
  machine**. `RESOLVE_MACHINE` never sees it and never assigns it a verdict. The basketed item's
  `WASHED` is produced by a separate, trivial function outside the reckoning entirely.
  → **Commutativity is untouched.** The theorem above holds verbatim, because the theorem quantifies
  over items in the machine and the basketed item is not one of them. The basket is not an
  exception to the reckoning; it is *outside* the reckoning.

- **Model O — in-machine override (rejected).** The item stays in the drum, flagged immune, and the
  flag is honoured at the end. Then:
  ```
  washed(i) = immune(i) ∨ (tierMatch(i) ∧ ¬isolation(i) ∧ ¬crowded(i) ∧ ¬ruined(i))
  ```
  This is *still* well-defined and *still* order-independent — an outermost OR over an
  order-independent conjunction has a unique value regardless of evaluation order. So even under
  Model O the practical property survives: a table can apply the downgrades in any order and get
  the same answer. **What is lost under Model O is not commutativity but the shape of the
  function** — it is no longer a pure filter chain, and an implementer who writes it as a chain of
  `if (...) washed = false` statements will get it wrong unless the immunity check runs last. That
  is a real footgun.

**They are not equivalent games**, and this is the substantive reason to choose Model E:

| | Model E (extraction) | Model O (in-machine) |
|---|---|---|
| Does the basketed item count for tier selection? | **No** | Yes |
| Does it count for crowding? | **No** | Yes |
| Can basketing a dark shoe rescue the rest of the machine? | **Yes** | No |
| Can basketing one of 3 shirts defuse the crowd? | **Yes** | No |

The brief's verb decides it: "the owner **takes** 1 garment from a machine". *Takes* means removes.
**Model E is adopted.** The basket therefore has two effects — it guarantees one wash, and it
surgically removes one item from a machine's calculus. That second effect is the more interesting
one and is deliberately preserved.

**Bottom line for the coordinator's question: the commutativity result survives intact under the
recommended model, and survives in weakened form (unique value, non-chain shape) even under the
rejected one. The basket does not make the reckoning order-dependent under either reading.**

### 5.2 `RESOLVE_MACHINE` — deterministic pseudocode

Input: machine `m`, cards attached to `m`, `dayFlags`. Output: `verdict : itemId → WASHED |
SENT_BACK | RETAINED`, plus bedding token updates. Pure; reads and writes nothing else.

```
FUNCTION RESOLVE_MACHINE(m, cards, dayFlags) -> verdicts

  # ---- S0. Gating ---------------------------------------------------------
  # NOTE [v2]: Electricity no longer gates here. It is resolved in Phase 5 and
  # sets dayFlags.reckoningSuppressed for the NEXT day, which is checked at the
  # PHASE level (Phase 4 is skipped wholesale), not per machine. See [A-11].
  IF m.power == OFF:
      RETURN { every item in m -> RETAINED }        # contents persist to next day
  IF m.items is empty:
      RETURN { }                                    # no-op; attached cards still recycle

  # ---- S1. Effective shade (Bleach) ---------------------------------------
  # MUST precede S2: it changes which tier fires. The ONLY forced ordering.
  bleached := (cards contains >= 1 Bleach)          # 2+ Bleach do NOT cancel [A-20]
  FOR each item i IN m.items:
      i.eff := IF bleached THEN swap(i.shade) ELSE i.shade    # swap: dark <-> light

  # ---- S2. Tier selection --------------------------------------------------
  # Exactly one tier fires. Evaluated on eff shade, over ALL types -- see [A-01].
  IF   EXISTS i: i.eff == dark  AND i.type == shoes:  tier := 1
  ELIF EXISTS i: i.eff == light AND i.type == shoes:  tier := 2
  ELIF EXISTS i: i.eff == dark:                       tier := 3
  ELSE:                                               tier := 4    # light only

  # ---- S3. Provisional verdict --------------------------------------------
  FOR each item i IN m.items:
      i.washed := CASE tier OF
          1 -> (i.eff == dark  AND i.type == shoes)
          2 -> (i.eff == light AND i.type == shoes)
          3 -> (i.eff == dark)
          4 -> (i.eff == light)

  # ---- S4..S7 are MONOTONE DOWNGRADES and COMMUTE (proof in 5.1) ----------

  # ---- S4. Underwear isolation --------------------------------------------
  hasNonUnderwear := EXISTS i IN m.items: i.type != underwear
  netOwners := { c.owner : c IN cards, c.name == "Wash net" }
  FOR each i IN m.items WHERE i.type == underwear AND i.washed:
      IF hasNonUnderwear AND i.owner NOT IN netOwners:
          i.washed := FALSE

  # ---- S5. Blanket exclusivity (defensive assert) -------------------------
  IF EXISTS i: i.type == blanket AND |m.items| > 1:
      FOR each i IN m.items: i.washed := FALSE
      LOG INVARIANT_VIOLATION                       # machineAccepts should make this unreachable

  # ---- S6. Crowding --------------------------------------------------------
  FOR each type t IN typesPresent(m):
      IF count(i IN m.items : i.type == t) >= 3:    # >=3, not exactly 3 [A-21]
          FOR each i WHERE i.type == t: i.washed := FALSE
  # kind == type only; owner and shade ignored [A-06]

  # ---- S7. Coloring / Color catcher ---------------------------------------
  coloringOwners := { c.owner : c IN cards, c.name == "Coloring" }
  catcherOwners  := { c.owner : c IN cards, c.name == "Color catcher" }
  FOR each p IN coloringOwners:
      FOR each i IN m.items WHERE i.owner != p AND i.owner NOT IN catcherOwners:
          i.washed := FALSE                         # "ruined" == SENT_BACK [A-22]
  # A Coloring owner gains NO protection for their own items [A-23]

  # ---- S8. Emit verdicts ---------------------------------------------------
  FOR each i IN m.items:
      IF NOT i.washed:
          verdict[i] := SENT_BACK                   # to owner's hand, no penalty
      ELSE IF i.type == bedding:
          i.washCount += 1                          # one WASH EVENT
          verdict[i] := IF i.washCount >= 2 THEN WASHED ELSE SENT_BACK
      ELSE:
          verdict[i] := WASHED

  # ---- S9. Card recycling --------------------------------------------------
  shuffle all cards attached to m back into the special item deck

  RETURN verdicts
END
```

### 5.3 Handwash basket — resolved OUTSIDE this function [v2, fully specified]

**[A-17]** A per-play effect, not a component. When played in Phase 2:

1. The owner names **one item they own** [A-17b], either in their hand or loaded in **any**
   machine (ON or OFF, including a machine holding a blanket, including a machine holding only
   that blanket).
2. The item is **immediately removed** from wherever it is and set aside in front of the owner.
3. In Phase 4, before any machine resolves, the set-aside item receives a wash event
   **unconditionally**. "Immune to all other rules" is absolute:

   | Rule | Does it affect a basketed item? |
   |---|---|
   | Four-tier ladder | No |
   | Crowding | No |
   | Underwear isolation | No |
   | Blanket exclusivity | No |
   | Coloring / Bleach / any attached card | No |
   | Machine power (OFF) | No |
   | Electricity-suppressed reckoning | **No — it washes anyway** |
   | Gang | No — it is already in the clean pile by Phase 5 |
   | **Bedding's two-wash rule** | **No — see [A-17c] below** |

4. **[A-17c] Bedding and the basket.** Under "immune to all other rules" read absolutely — as
   the coordinator directs — the two-wash requirement is *another rule*, so **a basketed bedding
   becomes clean outright from `washCount = 0`.** The alternative reading (the basket grants one
   guaranteed wash *event*, and bedding still needs two) is defensible and is what v0.1 assumed,
   but it is not "immune to all other rules". **Recommend the absolute reading**, and note the
   consequence: the Handwash basket is now *the* answer to bedding, and since 87.5% of players
   are dealt bedding, the basket's value is very high and very consistent. See [OQ-17].
5. Because step 2 physically removes the item, it **does not count** for the machine's tier
   selection or crowding. The basket is therefore also a surgical defusal tool (worked examples
   19 and 20).

### 5.4 The four-tier ladder

| Tier | Fires when | Washes | Everything else |
|---|---|---|---|
| 1 | any dark shoes present | dark shoes only | SENT BACK |
| 2 | else any light shoes present | light shoes only | SENT BACK |
| 3 | else any dark item present | all dark items | SENT BACK |
| 4 | else (light items only) | all light items | — |

Brief's slogan: *dark taints light; shoes taint everything.* Tier 2 is a **known inversion** of
the slogan (a light shoe washes while a dark shirt is sent back), preserved as written and
flagged at [OQ-04]. The accurate statement of the rule is: *shoes outrank non-shoes; within a
rank, dark outranks light.*

### 5.5 P0 — tier membership of linen. **Still unresolved. Still blocking.**

**[A-01] ASSUMPTION: tiers 3 and 4 read "dark item" / "light item", NOT "dark clothing item".**

Brief v2 now *quotes* this finding in its own §1 OPEN block and agrees it is P0 and blocking —
but has not ruled. Restating, with v2's sharper numbers:

> Under the brief's literal tier text, tiers 3 and 4 wash *clothes*, and *clothes* is explicitly
> defined to exclude underwear, blankets, and bedding. **No tier ever washes linen.** Victory
> requires washing all 10 dealt items. A player dealt any linen therefore can never win.
> `P(dealt zero linen) = C(10,10)/C(16,10) = 1/8008 = 0.0125%`.
> **In 7999 games out of 8000, no player can win. The game does not terminate.**

The repair is minimal and changes nothing for clothes-only machines: generalize tiers 3/4 to all
item types. The linen-specific rules (isolation, exclusivity, double wash) then do the work of
making linen *hard* to wash, which is evidently the design intent — the brief writes those rules
as though linen washes.

Consequences of the repair, all intended:
- Dark underwear beats light underwear. `{A-dark-underwear, B-light-underwear}` fires tier 3 and
  sends B's back. Shade precedence operates *inside* linen.
- A blanket is always alone (I-2), always wins its own tier, and **always washes if its machine is
  ON**. See §7.5 — this is a balance concern, not a correctness one.
- Bedding among dark clothes: light bedding is sent back, dark bedding gets a wash event.

**This remains the single most important sign-off in the document.** Everything else is tuning.

### 5.6 Underwear isolation

Underwear `u` washes only if **every other loaded item in the machine is also type `underwear`**
(any owner, any shade), **or** `u.owner` has a Wash net attached to that machine.

- The test is on the machine's **contents**, not on what is washing. Two dark underwear plus one
  light shirt: the shirt is not washing (tier 3), but it is *present*, so isolation still bites
  and the underwear goes back too. Nothing washes.
- Wash net protects **only its owner's** underwear. A net played by A does not save B's.
- **[A-24]** Wash net waives isolation **only**. It does not override the ladder — underwear must
  still win its tier. Wash net + dark underwear + dark shoes → tier 1 → underwear sent back, net
  wasted.

### 5.7 Crowding — **[v2] the ambiguity is now half-resolved by arithmetic**

Rule: ≥3 items of the same `kind` in a machine → all of them sent back.

With socks unsplit, **a color contains at most 2 cards of any type** (one dark, one light) and
**at most 1 card of any (type, shade)**. Feed that into the four candidate readings of *kind*:

| Reading | Max copies one player can contribute | Minimum distinct owners to trigger | Verdict |
|---|---|---|---|
| **(a) `type`** | 2 | **2** | **Live. Recommended [A-06].** |
| **(b) `type` + `shade`** | 1 | **3** | Live, but requires three different players to load the same type *and* shade into one machine. Rare at 3 players. |
| (c) `type` + `owner` | 2 | n/a — **max reachable is 2** | **Mathematically dead.** The rule can never fire. |
| (d) `type` + `shade` + `owner` | 1 | n/a — **max reachable is 1** | **Mathematically dead.** |

**Unsplitting the socks killed two of the four readings outright.** Readings (c) and (d) reduce
the crowding rule to dead text and can be discarded without a designer ruling — this is arithmetic,
not preference. The live choice is (a) vs (b), and it is a frequency dial: (a) triggers on 2+
owners, (b) requires 3.

**Recommend (a), `kind = type`.** It is the plainest reading of the words, and it is the only one
that makes crowding a live consideration in a 3-player game.

Other crowding details:
- **[A-21]** Threshold is **≥3, not exactly 3**. Under "exactly 3", adding a 4th copy would
  *rescue* all four, which is absurd at the table and certainly unintended.
- Applies to linen types too. Three underwear jam the drum even in an all-underwear machine.
- Blankets can never crowd (exclusivity caps them at 1).
- Applies regardless of whether the items were washing; demoting an already-demoted item is a
  harmless no-op, so it can be applied blindly.
- **[v2]** The v0.1 "sock trap" (a split pair plus any third sock card) **no longer exists**.
  Socks are now exactly as crowd-prone as shirts. This was a real improvement.

### 5.8 Bleach

Bleach swaps `dark ↔ light` as the **effective shade** of every item in the machine, then the
normal ladder runs. Equivalently the ladder's rungs are relabelled
`light shoes → dark shoes → light items → dark items`. **These two formulations are identical for
all inputs**; implement either.

The consequence readers trip over: **Bleach does not disarm dark shoes.** A dark shoe becomes an
effective *light* shoe, which is still the highest occupied rung once tier 1 is empty. It washes
and everything else still goes back. Bleach reverses the *shade* axis and does not touch the
*shoe* axis. The alternative "Bleach hard-kills all dark items" reading is at [OQ-05].

Bleach is machine-wide and ownership-blind — it hits the player who played it exactly as hard.
**[A-20]** Two Bleach cards at one machine do **not** cancel; the effect is a flag, not a toggle.

### 5.9 Bedding

- `washCount ∈ {0, 1, 2}`, persistent on the card, publicly tokened [A-04].
- Each `washed = TRUE` in S8 increments it by one **wash event**.
- At `washCount == 1` the bedding returns to the owner's hand carrying a token. Not clean, not in
  the clean pile, does not count for victory, must be re-loaded.
- At `washCount == 2` it is clean and enters the clean pile.
- **[A-17c]** A Handwash basket cleans it outright from any count (absolute-immunity reading).
- `washCount` never decreases. Sent back, Gang, Electricity, and displacement never reset it.
- Expected bedding per player = 1.25 cards, so the nominal 10-item task is **≈11.25 wash events**.

### 5.10 Coloring and Color catcher

- **Coloring**, owner `p`: demotes to `SENT_BACK` every item in that machine whose `owner ≠ p`.
- **Color catcher**, owner `q`: **[A-25]** exempts `q`'s items from **every** Coloring at that
  machine, for as long as it is attached. Blanket immunity, not a one-shot — this avoids needing
  a pairing rule when 3 Colorings meet 2 catchers.
- **[A-23]** Coloring does **not** wash or protect its owner's items; they face the ladder,
  crowding, and isolation normally. Coloring is purely destructive.
- Two Colorings by different owners at one machine: each ruins the other's, plus everyone else's.
  With no catchers present, **nothing washes**.
- A Color catcher with no Coloring present does nothing and is wasted.
- **[A-22]** "Ruins" is defined as `SENT_BACK`. The game's only removal-from-machine outcome is
  sent-back, and sent-back is explicitly penalty-free, so **Coloring is much weaker than its name
  suggests**. Flagged at [OQ-13].
- **[A-26]** Coloring is applied **after** tier selection and does **not** remove items from the
  machine. A ruined item is still in the drum and still taints. Coloring cannot be used to clear
  another player's dark shoes and let your own light shirt through.

### 5.11 Event cards — **[v2] resolved in Phase 5, AFTER reckoning**

This timing change transforms two of the three cards. Neither transformation appears to have been
intended.

| Card | Effect as written | What Phase-5 timing actually does |
|---|---|---|
| **Gang** | "Everything in every machine is sent back. Clothing returns to owners; special item cards return to the deck." | **[!] By Phase 5, every ON machine is already empty** (invariant I-3 — reckoning gives every item in an ON machine a terminal verdict). So Gang's entire remaining effect is: **empty the OFF machines.** It has silently become a targeted anti-turtling card rather than a board wipe. See §7.3. |
| **Jimothy** | Blank. | Unaffected — it was already unimplementable. [A-12]: null event for now. |
| **Electricity** | "No machine runs tonight. Proceed to the next day." | **[!] Self-defeating.** The machines have already run by the time it is revealed. As written it does literally nothing. See §7.3 and [OQ-11]. |

**Gang, precisely [A-27]:** every item in **every** machine — ON and OFF — is sent back to its
owner's hand. In practice this only ever finds items in OFF machines. Every special item card
attached to **any** machine is shuffled back into the deck (this *does* still bite on OFF machines,
where cards otherwise persist indefinitely under [A-09]). Machine **power states are not changed**
[A-28]. Bedding `washCount` is not reset.

**Electricity, precisely [A-11]:** see §7.3 for the option analysis. Recommended default: it sets
`dayFlags.reckoningSuppressed = TRUE`, which causes **the following day's Phase 4 to be skipped
entirely**; every machine RETAINS its contents that day; the flag clears on use.

### 5.12 Invariants to assert

| ID | Invariant |
|---|---|
| I-1 | Every item is in exactly one of: a hand, a machine, a clean pile, the inert remainder, or basket-set-aside (transient, Phase 2→4). |
| I-2 | No machine ever holds a blanket alongside anything else. |
| I-3 | After Phase 4, every ON machine holds zero items. (Every item in an ON machine receives a terminal verdict; there is no third outcome.) **This invariant is what neuters Gang — see §7.3.** |
| I-4 | `washCount > 0` only for `type == bedding`. |
| I-5 | Clean pile ⊆ must-wash set. Items outside the must-wash set never enter play. |
| I-6 | Exactly one player holds the key. |
| I-7 | At most one pending event exists, and only between Phase 1 and Phase 5 of the same day. |
| I-8 | No card is in a `fresh` zone at the start of Phase 1 (Phase 6 always drains them). |
| I-9 | Hand ∪ loaded ∪ clean pile ∪ basket-set-aside = must-wash set, for every player, at every moment. |

---

### 5.13 WORKED EXAMPLES — regenerated against v2

Notation: `A-D-shoes` = player A's dark shoes. `[Bleach:A]` = a Bleach card attached to this
machine, owned by A. Machine is ON and reckoning is not suppressed unless stated.
Defaults assumed: [A-01] linen in tiers 3/4; [A-06] `kind = type`; [A-21] threshold ≥3; Bleach =
shade swap; [A-26] Coloring after tier, no removal; [A-17] basket = extraction, absolute immunity.

#### Table A — machine reckoning (Phase 4)

| # | Contents | Cards | Tier | Verdicts | Reason |
|---|---|---|---|---|---|
| 1 | `A-D-shoes`, `B-L-shirt`, `C-D-pants` | — | 1 | `A-D-shoes` **WASHED**; other two SENT BACK | Dark shoes taint everything, including other dark items. |
| 2 | `A-L-shoes`, `B-D-shirt` | — | 2 | `A-L-shoes` **WASHED**; `B-D-shirt` SENT BACK | The known tier-2 inversion. No dark shoes, so light shoes take the rung and the dark shirt loses. |
| 3 | `A-D-shirt`, `A-D-pants`, `B-L-hat` | — | 3 | both dark **WASHED**; `B-L-hat` SENT BACK | The ordinary case. Dark wins, light is tainted. |
| 4 | `A-L-shirt`, `B-L-pants` | — | 4 | both **WASHED** | Light-only machine. |
| 5 | `A-D-shoes`, `B-L-shirt` | `[Bleach:A]` | 2 | `A-D-shoes` **WASHED**; `B-L-shirt` SENT BACK | **Bleach + dark shoes.** The swap makes the dark shoes *effectively light* — still the top occupied rung. Bleach does not disarm shoes. Under the alternative [OQ-05] "Bleach kills dark" reading this flips to: shoes SENT BACK, shirt **WASHED**. |
| 6 | `A-D-shirt`, `B-L-shirt` | `[Bleach:A]` | 3 | `B-L-shirt` **WASHED**; `A-D-shirt` SENT BACK | Bleach doing exactly what its text says. Note A played it and lost their own shirt — the card is ownership-blind. |
| 7 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]` | 4 | `A-L-shirt` **WASHED**; other two SENT BACK | All three would otherwise have washed. Coloring ruins every other color. |
| 8 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]`, `[Color catcher:B]` | 4 | `A-L-shirt` **WASHED**; `B-L-pants` **WASHED**; `C-L-hat` SENT BACK | **Coloring + catcher + third player.** The catcher protects only B. C is unprotected and ruined. |
| 9 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]`, `[Coloring:B]` | 4 | **all three SENT BACK** | A ruins B and C; B ruins A and C. Nothing survives both. Two Colorings, no catchers, total loss. |
| 10 | `A-D-underwear`, `B-L-shirt` | `[Wash net:A]` | 3 | `A-D-underwear` **WASHED**; `B-L-shirt` SENT BACK | Tier 3 covers linen [A-01]; the net waives isolation. The intended use of Wash net. |
| 11 | `A-D-underwear`, `B-D-shoes` | `[Wash net:A]` | 1 | `B-D-shoes` **WASHED**; `A-D-underwear` SENT BACK | **Wash net + underwear + dark shoes.** The net waives *isolation only*; the underwear still fails the ladder. Net wasted. |
| 12 | `A-D-underwear`, `B-D-underwear` | — | 3 | both **WASHED** | All-underwear machine, both dark, isolation satisfied. |
| 13 | `A-D-underwear`, `B-L-underwear` | — | 3 | `A-D-underwear` **WASHED**; `B-L-underwear` SENT BACK | Shade precedence operates *inside* linen. An all-underwear machine is not automatically safe. |
| 14 | `A-D-underwear`, `A-D-shirt` | — | 3 | `A-D-shirt` **WASHED**; `A-D-underwear` SENT BACK | Isolation is about *contents*, not about what is washing — and both items belong to A. Self-inflicted. |
| 15 | `A-D-shoes`, `B-D-shoes`, `C-D-shoes`, `D-L-shirt` | — | 1 | **all four SENT BACK** | **Crowding alongside a tier-1 wash.** Tier 1 provisionally washes all three shoes; crowding then demotes all three; the light shirt is *not* promoted, because crowding does not re-run tier selection [A-26/§6 OQ-14]. Nothing washes. |
| 16 | `A-D-shirt`, `A-L-shirt`, `B-D-shirt` | — | 3 | **all three SENT BACK** | **[v2] Crowding now needs 2+ owners.** A contributes the maximum any single color can (2 shirts, one per shade); B's third shirt triggers it. Under reading (b) `type+shade` this would *not* crowd — only two are dark — and `A-D-shirt` + `B-D-shirt` would wash. |
| 17 | `A-D-bedding` (count 0), `A-D-shirt` | — | 3 | `A-D-shirt` **WASHED**; bedding gets **wash event #1**, `washCount → 1`, returns to hand with a token | **Bedding, first wash.** Mechanically it leaves the machine exactly like a sent-back item but it has made progress. This dual nature is why *wash event* is a defined term. |
| 18 | `A-D-bedding` (count 1), `B-L-hat` | — | 3 | bedding **WASHED (clean)**, `washCount → 2`, to clean pile; `B-L-hat` SENT BACK | **Bedding, second wash.** Identical machine logic; only the counter differs. Implementations must not special-case bedding in the ladder — only in S8. |
| 19 | `A-D-shoes`, `B-D-hat` — A played Handwash basket in Phase 2 naming `A-D-shoes` | `[Handwash basket:A]` (already resolved) | 3 | `A-D-shoes` **WASHED** (basket, unconditional); machine now holds only `B-D-hat` → **WASHED** | **The basket defuses a tier-1 bomb by removing it.** A washes their shoes for free *and* accidentally rescues B. This only works under Model E (extraction) — under Model O the shoes would still taint and B's hat would go back. |
| 20 | `A-D-shirt`, `A-L-shirt`, `B-D-shirt` — A basketed `A-L-shirt` in Phase 2 | `[Handwash basket:A]` | 3 | `A-L-shirt` **WASHED** (basket); machine holds 2 shirts → no crowd → `A-D-shirt` **WASHED**, `B-D-shirt` **WASHED** | **The basket defuses a crowd.** Compare row 16, which is the same board without the basket and washes nothing. A single card turned a triple loss into three washes, two of them for an opponent. |
| 21 | `A-D-bedding` (count 0) — A basketed it from **hand** in Phase 2 | `[Handwash basket:A]` | n/a | bedding **WASHED (clean)** immediately, `washCount` bypassed | **[A-17c] Basket + bedding under absolute immunity.** The two-wash rule is "another rule". This makes the basket the premium answer to bedding — and 87.5% of players hold bedding. Under the alternative reading it would instead grant one wash event and return to hand at count 1. |
| 22 | `A-D-underwear`, `B-D-underwear`, `C-D-underwear` | — | 3 | **all three SENT BACK** | Isolation satisfied (all underwear), ladder satisfied (all dark), but **crowding applies to linen too**. |
| 23 | `A-D-blanket` (alone, as required) | — | 3 | `A-D-blanket` **WASHED** | A blanket is always alone (I-2), so it always wins its own tier. **Guaranteed wash if the machine is ON.** See §7.5. |
| 24 | `A-D-shoes`, `B-D-shoes` — machine is **OFF** | `[Coloring:C]` | — | **all RETAINED** | An OFF machine does not reckon. The Coloring stays attached [A-09] and fires whenever the machine is eventually switched on. Attached cards are a persistent fuse, not a per-day effect. **[v2]** But note: a Gang in Phase 5 would empty this machine *and* return the Coloring — see Table B row 3. |
| 25 | `A-L-shoes`, `B-L-shoes`, `C-L-shoes` | `[Bleach:A]` | 1 | **all three SENT BACK** | Swap makes them effectively *dark* shoes → tier 1 → all provisionally wash → crowding (3 shoes) demotes all. Bleach changed the rung's label; crowding did not care. |
| 26 | `A-L-shirt`, `B-D-shoes` | `[Bleach:A]`, `[Coloring:A]`, `[Color catcher:B]` | 2 | `B-D-shoes` **WASHED**; `A-L-shirt` SENT BACK | Full stack. Bleach swaps: shoes → effectively light, shirt → effectively dark. Tier 2 fires on the shoes. Coloring:A would ruin them but B holds the catcher. A's own shirt loses to the ladder, since Coloring gives its owner no protection [A-23]. **A spent three cards' worth of effect and washed nothing.** |
| 27 | (empty, ON) | `[Bleach:A]` | — | no verdicts | Empty machines are a no-op. The Bleach still recycles — playing a card at a machine that stays empty simply wastes it. |

#### Table B — day-level and event-timing scenarios [v2]

These exercise the new phase order, which the per-machine table cannot reach.

| # | Scenario | Resolution | Point |
|---|---|---|---|
| B1 | Day 4. Player C rolls a 6 in Phase 1 (first 6 of the day). Player E later also rolls a 6. | C's 6 lays one face-down event. **E's 6 does nothing whatsoever** — no draw, no second card, no compensation, no re-roll. | The brief's "only the first 6" rule, stated as a hard no-op. |
| B2 | The pending event turns out to be **Gang**. At Phase 4, machines M1–M3 were ON and M4 was OFF holding `A-D-shirt` and `B-L-pants` plus `[Coloring:C]`. | Phase 4 empties M1–M3 normally. Phase 5 reveals Gang: **only M4 has anything left.** `A-D-shirt` and `B-L-pants` return to hands; `[Coloring:C]` returns to the deck. | **[!] Gang's entire effect is now "empty the OFF machines".** Invariant I-3 guarantees the ON machines are already bare. See §7.3. |
| B3 | Same as B2 but **no machine is OFF**. | Phase 5 reveals Gang. **It does nothing at all.** Every machine is already empty. | Gang is a *complete blank* on any day where nobody turned a machine off — which, at 3 players, is most days. |
| B4 | The pending event is **Electricity**, revealed in Phase 5 of day 7. | **As literally written: nothing happens.** The machines already ran in Phase 4. Under the recommended repair [A-11]: `reckoningSuppressed` is set, and **day 8's Phase 4 is skipped entirely** — every machine, ON and OFF, retains its contents through day 8. The flag then clears. | The self-defeat and the repair, side by side. |
| B5 | Day 8 is Electricity-suppressed (from B4). Player A plays a Handwash basket in Phase 2 of day 8 naming `A-L-hat`. | Phase 4 is skipped for all machines. **`A-L-hat` is still WASHED** — the basket is immune to all other rules, including a suppressed reckoning. | The basket is the **only** way to make progress on a suppressed day. Combined with §7.2, this is the game's only unconditional progress mechanism. |
| B6 | Player D rolls a 5 on day 3 and draws Bleach. In Phase 2 of day 3, D wants to play it. | **Illegal.** The card is in D's `fresh` zone. It moves to `ready` in Phase 6 of day 3 and is playable from Phase 2 of day 4 onward. | The one-day delay, and why the fresh/ready zones exist rather than a remembered timestamp (§3.4). |
| B7 | Player B completes their 10th washed item during Phase 4 of day 5. A Gang is pending. | B wins. Gang still resolves in Phase 5 (harmlessly — it cannot touch a clean pile), then the victory check fires in Phase 6. | No event can revoke a wash, so the check's placement is immaterial (§3.1 theorem). Implementations may short-circuit at Phase 4 if they prefer. |
| B8 | Keyholder A turns M2 OFF in Phase 3 of day 6, protecting `A-D-bedding` at `washCount 1`. Day 6 ends; the key passes to B. | M2 skips Phase 4 and retains the bedding. On day 7, **B is keyholder and may turn M2 back ON**, and it will reckon that same day (Phase 3 precedes Phase 4). | **[v2] The key now passes at end of day, so a protective OFF survives exactly one full reckoning and then falls to the next keyholder.** Turning a machine off buys precisely one day. |

---

## 6. OPEN QUESTIONS AND PROPOSED DEFAULTS

Each entry: the question, the candidate readings with their play consequences, a recommendation,
and the assumption tag used above. **All are assumptions awaiting designer sign-off.** ★ marks
questions the brief has not flagged.

### Blocking

**[OQ-01] P0 — Do tiers 3/4 cover linen?** *(brief-flagged, still unruled)*
(a) Yes — tiers range over all item types. (b) No, literal — linen is excluded from every tier.
Consequence of (b): **the game is unwinnable in 7999 of 8000 deals and never terminates** (§5.5,
§7.1). (b) is a drafting error, not a design option.
**Recommend (a). [A-01] — highest priority in this document.**

**[OQ-02] Jimothy.** *(brief-flagged)*
No effect defined; unimplementable as a reducer and unresolvable at a table. Candidates that
invent nothing new: (i) remove the card from the deck until defined — event deck becomes 2 cards,
raising Gang and Electricity to 50% each; (ii) **null event** — draw it, nothing happens, so events
are ~2/3 as impactful as they appear; (iii) a raccoon-in-the-drum displacement of one random item.
**Recommend (ii). [A-12]** It is the zero-invention option, keeps the deck at 3 as written, and
costs nothing to replace. Note that under (ii) roughly **one day in three that produces an event
produces a visible non-event**, which is a genuine (and arguably desirable) bluff-texture effect.

**[OQ-03] Special item deck composition.** *(brief-flagged as "the primary balance dial")*
No counts given. (a) shared deck, 3 of each of 5 = 15; (b) 5 each = 25; (c) five separate
single-name piles the drawer chooses from.
Consequence: (c) removes all randomness from the 5-face and makes Handwash basket an auto-pick,
which — given §5.3's absolute immunity — is far and away the strongest card and would be taken
every time. Reject (c) firmly.
**Recommend (a): shared, 15 cards, 3 each. [A-03]** Draw rate is ≈P/6 per day (0.5–1.0).

### Reckoning

**[OQ-04] Tier 2 inversion — intended?** *(brief-flagged)*
(a) Keep as written: shoes outrank non-shoes, and within a rank dark outranks light. Internally
consistent; the slogan is imprecise, not the rule. (b) Repair to
`dark shoes → dark items → light shoes → light items`: then light shoes become nearly unwashable,
since *any* dark item in the machine blocks them, and each player has exactly one light shoe card.
That is a serious victory bottleneck on a specific card.
**Recommend (a): keep as written.**

★ **[OQ-05] Bleach — swap, or kill-dark?**
(a) **Swap** (recommended): effective shades invert, ladder runs normally. Dark shoes become
effective light shoes and still dominate. (b) **Kill-dark**: no dark item can wash under Bleach;
the ladder runs over light items only. Then Bleach *is* the counter to a dark-shoe bomb.
Consequence: (b) is a much stronger and more targeted card; (a) is symmetric and composes cleanly
with every tier. The card text ("light gets washed, dark is sent back") describes exactly what (a)
produces in the clothes-only case that the text is evidently about; (b) additionally overrides the
shoe axis, which the text never mentions.
**Recommend (a) — the minimal-invention reading. [see §5.8]** Worked example 5 shows both.

**[OQ-06] `kind` for crowding.** *(brief-flagged)*
**[v2]: two of the four candidate readings are now mathematically dead** (§5.7) — with socks
unsplit, `type+owner` caps at 2 and `type+shade+owner` caps at 1, so neither can ever reach 3.
Live options: (a) `type` — needs 2+ owners; (b) `type+shade` — needs 3 distinct owners.
Consequence: (b) makes crowding rare-to-vanishing at 3 players (all three players must load the
same type and shade into the same machine).
**Recommend (a). [A-06]**

★ **[OQ-14] Crowding before or after tier selection?**
(a) **After**, no re-trigger — the brief says "on top". 3 dark shoes + light shirt → nothing
washes. (b) Before — crowded items removed from consideration, then the tier is picked, so the
light shirt washes.
Consequence: (b) turns crowding into a *tool* (deliberately triple a type to clear the tier),
which is genuinely interesting but is invention. It also preserves the fiction less well: three
jammed shirts do not remove the dark shoes from the drum.
**Recommend (a). [A-26]**

★ **[OQ-15] Coloring before or after tier selection?**
(a) **After**, ruined items remain in the drum and keep tainting. (b) Before — ruined items are
treated as removed, so Coloring can clear other players' dark shoes and let the Coloring owner's
light items wash.
Consequence: (b) makes Coloring a powerful constructive combo rather than a denial card — a
different and much stronger card.
**Recommend (a). [A-26]**

★ **[OQ-13] What does "ruins" mean?**
The only removal-from-machine outcome in the game is `SENT_BACK`, and sent-back is explicitly
penalty-free. So "ruins" has no teeth: Coloring costs its victims one day, nothing more.
(a) Accept: ruins = sent back. (b) Add a penalty (e.g. the item cannot be re-loaded next day) —
that is new mechanics and out of scope for formalization.
**Recommend (a) [A-22], and flag to the designer that Coloring reads far scarier than it plays.**

★ **[OQ-16] Wash net — does it override the ladder too?**
(a) Isolation only; underwear must still win its tier. (b) Unconditional wash of the owner's
underwear.
The card says "may wash their underwear **even if other garment types are present**", which
addresses exactly and only the isolation restriction. (b) would make it a second Handwash basket.
**Recommend (a). [A-24]**

★ **[OQ-18] Color catcher — blanket immunity or one-shot?**
(a) Blanket at that machine, for as long as attached. (b) One-shot, cancels one Coloring.
(b) needs a pairing rule for 3 Colorings vs 2 catchers, which nothing supplies.
**Recommend (a). [A-25]**

★ **[OQ-19] Do two Bleach cards cancel?** (a) No — flag, not toggle. (b) Yes — even counts cancel.
(b) creates counter-play but is unstated and fiddly. **Recommend (a). [A-20]**

★ **[OQ-20] Does Coloring protect its owner's items?** (a) No. (b) Yes, they auto-wash.
(b) makes it a guaranteed personal wash plus mass denial — easily the best card in the game.
**Recommend (a). [A-23]**

★ **[OQ-21] Crowding threshold: ≥3 or exactly 3?** (a) ≥3. (b) exactly 3, so a 4th copy rescues
all four. (b) is absurd at the table. **Recommend (a). [A-21]**

### Handwash basket — **[v2] now the most consequential card**

**[OQ-17] Basket scope, four sub-questions.**

- **Component or effect?** (a) Per-play effect, resolves on play, no board component. (b) A
  persistent shared basket zone — needs rules for when it empties, whether its contents can be
  attacked, and what Gang does to it, none of which exist. **Recommend (a). [A-17]**
- **Own items only, or any item?** (a) Own only. (b) Any — but the basket *washes* the target, so
  taking an opponent's item **helps them**; it would be used as a gift or to strip a taint out of a
  machine you care about. Interesting, but it inverts the plain reading ("the **owner** takes…")
  and every other card in the set is owner-scoped. **Recommend (a). [A-17b]**
- **Does "garment" here exclude linen?** If read strictly, the basket could not take underwear,
  blanket, or bedding — removing its best use. **Recommend garment = item, no exclusion. [§1.1]**
- **★ Does absolute immunity clean bedding in one shot?** (a) **Yes** — the two-wash rule is
  "another rule", so a basketed bedding goes straight to the clean pile. (b) No — the basket grants
  one guaranteed *wash event*, and bedding still needs two.
  Consequence: under (a) the basket becomes the definitive answer to bedding, and 87.5% of players
  hold bedding, so the card's value is both high and extremely consistent — likely the strongest
  card in the deck by a clear margin. Under (b) it is merely very good.
  **Recommend (a)**, per the direction that "immune to all other rules" is absolute, **but flag it
  loudly as the largest single balance lever in the game. [A-17c]**

### Structure, timing, information

**[OQ-11] P0-adjacent — Electricity is self-defeating.** *(brief-flagged)* Full analysis in §7.3.
Options: (a) suppress the **following** day's reckoning; (b) move event resolution to a
pre-reckoning slot; (c) retire the card; (d) retroactively undo the reckoning that just happened.
**Recommend (a). [A-11]** Rationale and the case for (b) are in §7.3.

★ **[OQ-10] Is the new event frequency intended?**
Events moved from a flat 16.7% of days to 42–67%, scaling with player count (§4.4). Gang alone now
fires on 14–22% of days. This is a 2.5×–4× increase and was not called out in the brief.
(a) Accept — events are now a texture rather than a rare shock. (b) Reduce, e.g. only the *keyholder's*
6 lays an event (returns to a flat 16.7%). (c) Accept but re-cost the event deck (e.g. add more
Jimothy-style null cards to dilute).
**Recommend (a) provisionally and playtest**, but the designer should know the number changed by
this much, because the v1 brief's stated intent was explicitly "events are now rare".

★ **[OQ-12] Acting order within a phase.**
(a) Keyholder first, then clockwise. (b) Fixed seat 1 every day. (c) Independent rotation.
(a) gives the key a second, subtler benefit (first pick of machines in the roll phase, and first
crack at the special item phase) and keeps a single rotating pointer in state. (b) permanently
advantages seat 1. **[v2] note:** with the bonus roll deleted, the key is now *weaker* than in v1
— it confers only a single power toggle — so folding acting-order priority into it is a reasonable
rebalance rather than a pile-on.
**Recommend (a). [A-13]**

★ **[OQ-22] Fresh/ready zones — public or private counts?**
(a) Zone membership public, card identity private (what physical separation naturally produces).
(b) Fully private. (b) is unauditable at a table and is hidden bookkeeping.
**Recommend (a). [A-06b]**

★ **[OQ-23] Is the special item phase sequential or simultaneous?**
(a) Sequential in acting order — later players see earlier plays and can answer a visible Coloring
with a catcher. (b) Simultaneous secret selection then reveal — makes catchers a read/bluff, which
is a better game, but needs a commit/reveal sub-phase.
**[CONFLICT]** — (b) is the better game and the worse implementation.
**Recommend (a) for v0.2, revisit after playtest. [A-15]**

★ **[OQ-24] Are hands hidden?**
The brief never says. (a) Items and cards both hidden. (b) Items public (they are just laundry),
cards hidden. (b) makes displacement and key decisions fully calculable and removes almost all
bluff; it also makes "who is close to winning" trivial. Clean piles are public under both, so
victory is always verifiable.
**Recommend (a). [A-18]**

★ **[OQ-25] Is bedding wash progress public?**
(a) Token rides on the card, publicly declarable even in hand. (b) Private.
(b) is exactly the hidden bookkeeping the platform goals forbid and is unpoliceable at a table.
**[CONFLICT]** — (b) is trivial digitally, impossible physically. **Recommend (a). [A-04]**

★ **[OQ-26] Simultaneous victory.** (a) Joint win. (b) Keyholder wins ties. Reckoning resolves all
machines together, so genuine ties are reachable. **Recommend (a). [A-19]**

★ **[OQ-27] Is loading on 1–3 mandatory?** (a) Mandatory and maximal. (b) "Up to" that many.
(b) lets everyone hold back whenever the board looks dangerous, which can stall the game outright
(§7.2). The brief's word is "exactly". **Recommend (a). [A-08]**

★ **[OQ-28] On a 2 or 3, may items go to different machines?** (a) Yes, independently targeted
(the brief says "machines"). (b) All into one machine — far more brutal, makes a 3 dangerous to
roll. **Recommend (a). [A-08b]**

★ **[OQ-29] Roll of 4 with no legal target.** (a) No-op. (b) Re-roll. (c) May move own item.
(b) is unbounded in principle; (c) contradicts "one other player's".
**Recommend (a), generalized as the universal no-op rule §4.5.**

★ **[OQ-30] Can a blanket be displaced by a 4?** (a) Yes, into an empty machine only. (b) Never.
(c) Yes, anywhere — creates illegal states, reject. (b) makes a blanket a permanent machine-lock
its owner fully controls. **Recommend (a). [A-16]**

★ **[OQ-31] Do special item cards on an OFF machine persist?**
(a) Yes — attached until that machine actually reckons, then recycle. (b) No — recycle at the end
of every day regardless.
(a) makes attaching a Coloring to a machine that is about to be switched off a long fuse, and
preserves the brief's framing that turning a machine on "detonates" it — there must be something
to detonate. **[v2] note:** under (a) a card can sit on an OFF machine indefinitely; Gang is the
only thing that clears it (§5.11), which is now one of Gang's few remaining functions.
**Recommend (a). [A-09]**

★ **[OQ-32] Does Gang change power states?** **Recommend no. [A-28]** Nothing in its text does.

★ **[OQ-33] Does Gang empty OFF machines?** (a) Yes — "every machine" is literal, and post-reckoning
it is the *only* thing Gang can do (§7.3). (b) Only ON machines — under which **Gang becomes a
complete blank card, always, with no exceptions**, since I-3 guarantees ON machines are empty.
(b) is not a viable reading. **Recommend (a). [A-27]**

★ **[OQ-34] Can a pending event carry over to the next day?** No — it always resolves in Phase 5 of
the day it was laid. There is never more than one. **[A-10]**

★ **[OQ-35] Can special item cards attach to a machine holding a blanket?**
Cards are not items, so `machineAccepts` does not apply. **Recommend yes** — a Coloring on a
blanket machine is the natural punish for an otherwise guaranteed wash (§7.5). Exclusivity governs
*items*.

★ **[OQ-36] Hand limit on special item cards?** (a) None. (b) A cap.
One play per player per day already throttles this heavily. **Recommend (a). [A-07]**

---

## 7. RULES INTEGRITY REVIEW

### 7.1 P0, UNCHANGED AND WORSE — the game as literally written is unwinnable

Brief v2 now quotes this finding in its own §1, agrees it is blocking, and has **not yet ruled**.
Restated because it remains the single thing that must be fixed before anything can be built:

Tiers 3 and 4 wash "dark clothes" / "light clothes". *Clothes* is explicitly defined to exclude
underwear, blankets, and bedding. **No tier ever washes linen.** Victory requires washing all 10
dealt items. 6 of the 16 cards in a color are linen.

```
P(a player is dealt zero linen) = C(10,10)·C(6,0) / C(16,10) = 1 / 8008 = 0.0125%
```

**In 7999 deals out of 8000 the player holds a permanently unwashable item and can never win.**
For *no* player to be blocked, every player at the table must independently hit that 1-in-8008;
at 4 players that is roughly 1 in 4×10¹⁵. The game, as written, does not terminate.

This got **worse** in v2, not better: v0.1's 18-card colors gave `C(12,10)/C(18,10) = 0.15%`, an
order of magnitude more forgiving than v2's 0.0125%, because the linen fraction rose from 6/18 to
6/16.

**Recommended repair, unchanged: generalize tiers 3 and 4 to all item types [A-01].** It changes
nothing for clothes-only machines and makes the linen rules — which the brief writes as though
linen washes — operative.

### 7.2 Termination re-examined under the v2 dice table

The coordinator asks whether termination gets better or worse. **Better in kind, but there is
still no guarantee — and one of the two improvements is smaller than it looks.**

**What the numbers actually did:**

| Quantity | v1 | v2 | Direction |
|---|---|---|---|
| Items loaded / player / day | 1.0 | 1.0 | **unchanged** |
| Special cards drawn / player / day | 1/6 | 1/6 | **unchanged** |
| Events / day | 16.7% flat | 42–67%, scaling with P | **much higher** |
| Must-wash set size | ~11.05 items | exactly 10 items | **~10% shorter** |
| Expected wash events / player | ~12.3 | **~11.25** | **~9% shorter** |
| Dead die faces | 1 (the 5) | 0 | better feel, no throughput change |

**The improvements:**

1. **The game is ~9–10% shorter by construction.** Must-wash sets are exactly 10 rather than
   averaging 11.05, and expected wash events fall from ~12.3 to ~11.25. This is the single most
   reliable termination improvement in v2 and it came for free from unsplitting the socks.
2. **[!] The Handwash basket is now the game's only monotone progress ratchet.** Under absolute
   immunity [A-17c] it converts one item — any item, including a two-wash bedding — to clean
   unconditionally, immune even to a suppressed reckoning (worked example B5). Nothing in the game
   can undo it. This is the first and only rule in either brief that *guarantees* forward progress.
   Rate: `P/6` special draws per day × `1/5` of the deck being baskets = **P/30 baskets per day**,
   i.e. 0.10/day at 3 players to 0.20/day at 6. Spread across all players who between them need
   `10P` washes, the basket alone would take on the order of 300 days. **So it prevents absolute
   deadlock in the limit but is far too slow to be the practical engine of termination.** Real
   games end because reckonings actually wash things, which is not guaranteed by any rule.

**The regressions:**

3. **The 5-face is no longer dead, and that is bad for throughput.** A 5 used to waste a turn;
   now it injects a special item card. Of the five special items, **three are net-destructive**
   (Coloring ruins, Bleach usually flips someone's washing items to sent-back, Color catcher is
   purely reactive), one is narrow (Wash net), and one is constructive (Handwash basket). More
   cards in circulation means more mass send-backs, so **per-day wash throughput probably goes
   down.** The improved *feel* of the 5-face is bought with slower resolution.
4. **Events at 42–67% of days is a large increase**, and 1/3 of the event deck is Jimothy, which
   does nothing [A-12]. So a substantial fraction of days now contain a visible, tension-building
   non-event. That is arguably good texture and arguably noise; either way it does not advance
   the game.
5. **Gang no longer clears gridlock** (§7.3). In v1 it was the release valve for a frozen board.
   Post-reckoning it can only empty OFF machines. It is now a *targeted* anti-turtling tool, which
   is more precise but much narrower.

**The verdict.** The structural non-termination finding stands: there is still no potential
function that strictly decreases. Sent-back is penalty-free, no deck depletes, no resource is
consumed, there is no day limit, no score, and no elimination. The only monotone quantities in the
entire game are `bedding.washCount` (bounded, at most 2 per bedding card) and basket-produced
washes (rate-limited to ~P/30 per day). A non-terminating cycle remains constructible: with
mandatory loading [A-08], players *are* forced to put items in, so pure stalling is prevented —
but if every player's remaining item is a dark shoe and they all load into one machine each day,
crowding sends all three back every day, forever.

**Net: v2 is meaningfully better than v1 — shorter target, a real (if slow) ratchet, and no dead
faces — but it still has no termination guarantee.** Not fixed here, since that would be redesign.
Three cheap options for the designer: (i) a day cap with a most-clean-items tiebreak; (ii) a pity
rule (an item sent back N days running washes automatically); (iii) nothing — accept it and watch
playtests. **[!]**

### 7.3 The event-timing change broke two of three event cards

Moving event resolution to **after** reckoning was presented as a scheduling change. It is not —
it materially rewrites two cards.

**Electricity is now a null card.** "No machine runs tonight" is revealed in Phase 5, after Phase 4
has already run every machine. As written it does nothing at all, ever. Options:

| Option | Consequence | Verdict |
|---|---|---|
| **(a) Suppress the *following* day's reckoning.** Set a flag; day N+1 skips Phase 4 wholesale; every machine ON and OFF retains contents; flag clears on use. | Preserves all three cards, respects the designer's explicit phase order, and turns Electricity into a *delay* — distinct from Gang, and thematically fine ("proceed to the next day"). Hand-trackable at zero cost: leave the revealed card face-up on the table until it is spent, which is self-documenting. Costs one boolean in state and one line in Phase 4. Note it interacts cleanly with the key passing at end of day — the flag belongs to the *board*, not to a player. | **RECOMMENDED. [A-11]** |
| **(b) Move event resolution to a pre-reckoning slot.** | Fixes Electricity outright *and* — see §7.4 — makes the face-down mechanic meaningful, because the keyholder would then be setting machine power with a live, unknown threat on the table. **This is the higher-value fix and it is a two-for-one.** But it reverts an explicit v2 design decision, and it re-creates the v1 problem that Gang wipes boards before they can wash, which the designer may have moved events specifically to avoid. | **Strong alternative. Raise with the designer.** |
| (c) Retire Electricity. | Event deck drops to 2 cards, one of which is blank. Simplest, but loses a card and makes Jimothy half the deck. | Fallback. |
| (d) Retroactively undo the reckoning that just resolved. | Would require un-washing items, decrementing bedding counters, and reversing sent-backs. **Breaks event sourcing and replay, and is not expressible as a forward reducer.** Also unresolvable at a table once cards have physically moved. | **Reject firmly.** |

**Gang has been silently rewritten.** Invariant I-3 guarantees that after Phase 4 every ON machine
is empty — every item in an ON machine receives a terminal verdict, there is no third outcome. So
when Gang resolves in Phase 5, the only items it can possibly find are those in **OFF** machines.

- Gang's text ("everything in every machine is sent back") is now technically true and practically
  narrow.
- On any day where no machine is OFF, **Gang is a complete blank** (worked example B3). At 3
  players, where a single keyholder makes at most one toggle per day, that will be most days.
- What Gang *does* still do is: dump every OFF machine, and — importantly — **return special item
  cards attached to OFF machines**, which under [A-09] otherwise persist indefinitely. Gang is now
  the only garbage collector for long-fused cards.
- Read charitably, this is elegant: **Gang has become the designated counter to turtling.** Read
  literally, the card's name and text promise a board wipe it can no longer deliver.

**Recommend:** if the designer keeps the post-reckoning slot, **rewrite Gang's card text** to say
what it now does ("Every machine that did not run tonight is emptied; its contents return to their
owners and any special item cards return to the deck"). Leaving the current text on the card will
mislead every player who reads it.

### 7.4 Face-down events — information analysis. **Weak as placed; the device is good, the slot is wrong.**

The mechanic: from the moment a 6 is rolled in Phase 1, every player knows an event is coming and
nobody — including the roller — knows which. That uncertainty persists through Phase 2 (special
items), Phase 3 (key), and Phase 4 (reckoning): **three full phases of anticipation**, which is a
long runway and a genuinely well-chosen piece of design.

**Does it make holding a machine OFF more attractive? No — it makes it *less* attractive.**
This is the opposite of the intuitive answer, and it follows directly from §7.3:

- Post-reckoning, the only thing a Gang can touch is an OFF machine.
- So a pending event is, with probability 1/3, **specifically a threat to exactly the thing OFF is
  for.** Turning a machine off while an event is pending is the one circumstance in which OFF can
  be punished.
- Electricity (1/3) does not care about power states at all — under [A-11] it freezes ON and OFF
  machines alike next day.
- Jimothy (1/3) does nothing.

So the keyholder in Phase 3, looking at a face-down card, faces: 1/3 chance my OFF machine gets
dumped anyway, 2/3 chance the card is irrelevant to my decision. And note that "dumped anyway" is
not even catastrophic — sent back is penalty-free, and it is the *same outcome* a bad reckoning
would have produced. **The pending event changes the keyholder's decision only in the narrow case
where they are protecting a configuration that would otherwise wash next day.**

**Assessment: weak as currently placed.** The face-down device generates atmosphere but rarely
changes a decision, because (i) two of three events are inert or future-facing, (ii) the one live
event resolves after every decision it could have influenced, and (iii) the worst outcome it
threatens is identical to an ordinary bad reckoning.

**It would be a strong addition if events resolved before reckoning** (§7.3 option (b)). Then the
keyholder would set machine power, and players would load and play cards, under a live unknown
threat that could wipe the board before it washes. That is real tension and real decision pressure.
**The face-down mechanic and the post-reckoning slot are working against each other**; the
mechanic's whole value is in the decisions made while the card is face-down, and the current
ordering places almost no meaningful decisions there.

One genuine benefit that survives regardless: it is **the only hidden-from-everyone state in the
game**, which is a nice texture and, at a physical table, costs nothing to administer.

### 7.5 Other integrity findings

1. **A blanket in an ON machine is very close to a free win.** It is always alone (I-2), always
   takes its own tier, always washes. 87.5% of players are dealt at least one; 37.5% are dealt
   both. Counterplay is thin: a keyholder turning that machine off, a Coloring attached to it
   [OQ-35], a Gang (which now only works if the machine is OFF), or a roll-4 displacement into
   another empty machine. **Expect blankets to be the first thing every player washes, every game.**
   Playtest flag, not a bug.
2. **"No capacity limit" versus the crowding rule.** They coexist, but crowding *is* a soft cap of
   2 per type. Player-facing text should say so or players will be surprised.
3. **Blanket exclusivity versus mandatory loading.** A hand of `{blanket, blanket, shirt}` facing a
   board with no empty machine can load only the shirt on a roll of 3. §4.7 plus [A-08] handle it
   (load as many as legal), but it must be stated or implementations will throw.
4. **[v2] The key is materially weaker than in v1.** It lost the bonus roll and now confers only a
   single power toggle per day. Under [A-13] it also confers acting-order priority, which partly
   compensates. Whether the key is now *too* weak — a whole rotating role reduced to one on/off
   switch — is a playtest question worth watching, especially at 6 players where a given player is
   keyholder only 1 day in 6.
5. **[v2] Turning a machine OFF now buys exactly one day.** The key passes at end of day, so the
   next keyholder can immediately switch it back on and it reckons that same day (Phase 3 precedes
   Phase 4). Combined with Gang targeting OFF machines, defensive play is considerably weaker in
   v2 than v1. That is probably healthy for termination and is worth stating explicitly to players.
6. **No permanent lockout exists.** The key rotates unconditionally, so every player is keyholder
   every P days and no player can be denied it. Machines outnumber players by one and each player
   loads only 1.0 items/day on average, so machine denial is not sustainable. The full-blanket
   board lock (every machine holding a blanket, so `machineAccepts` is false everywhere) is
   reachable transiently but **self-clears**, because every ON blanket machine washes its blanket
   that same reckoning; sustaining it would require all P+1 machines OFF, and only one toggle
   happens per day while ON blanket machines empty themselves. Not a stalemate.

### 7.6 Unimplementable as written

| Item | Problem | Status |
|---|---|---|
| **Tier 3/4 linen exclusion** | Game unwinnable in 7999/8000 deals (§7.1). | **BLOCKING.** Repair: [A-01]. |
| **Jimothy** | No effect defined. Not representable as a reducer, not resolvable at a table. | **BLOCKING.** Default: null event [A-12]. |
| **Special item deck composition** | No counts anywhere; brief flags it as the primary balance dial. | **BLOCKING.** Default: 15 cards, 3 each [A-03]. |
| **Electricity** | Resolves after the thing it is supposed to prevent. Does nothing as written. | **BLOCKING.** Default: suppress the following day [A-11]. |
| **Gang's card text** | Describes a board wipe; delivers an OFF-machine purge. Not unimplementable, but the text is now false. | Rewrite the card text (§7.3). |
| **"Ruins"** (Coloring) | Undefined verb with no available penalty mechanism. | Resolved as `SENT_BACK` [A-22]; card is weaker than its name. |
| **"Immune to all other rules"** (basket) | Absolute, so it also overrides bedding's two-wash rule. | Resolved as absolute [A-17c]; flag as the largest balance lever. |
| **"Cannot be played the day drawn"** | A per-card day-stamp is not hand-trackable. | Resolved via fresh/ready zones [A-05]; isomorphic and table-friendly. |

### 7.7 Hand-resolvability audit

| Requirement | Status |
|---|---|
| No hidden bookkeeping | **PASS**, given [A-04] (bedding tokens public) and [A-05] (fresh/ready as physical zones, not remembered dates). These are the only two persistent per-card states in the game and both are now physical objects on the table. |
| All reckoning inputs visible at the machine | **PASS.** `RESOLVE_MACHINE` reads only the machine's items and attached cards. A player can resolve a machine by looking at it. |
| Bounded per-machine scan | **PASS.** Four passes: pick the tier, check underwear isolation, count types for crowding, check Coloring/catcher ownership. All four commute (§5.1), so a table may do them in any order and get the same answer — this is what makes it fast to resolve by hand. |
| Handwash basket does not break the above | **PASS.** Under Model E the basketed item is physically removed before reckoning, so it is never part of any machine's scan (§5.1). |
| Face-down event administrable | **PASS**, and easier physically than digitally — a card lies face-down and nobody looked. Digitally it is the one piece of state that must be hidden from *every* client including its creator (§3.2). |
| Deterministic, replayable | **PASS**, given seeded RNG for the die, both decks, and the opening deal. Machine index order in Phase 4 is fixed only for tidiness; results are order-independent. |
| Pure reducers | **PASS.** `RESOLVE_MACHINE` is pure. The only impure steps per day are P die rolls and up to two deck draws, all covered by boardgame.io's seeded `ctx.random`. |

**[CONFLICT] — the three places the two goals genuinely diverge:**
- **[OQ-23] special item phase simultaneity.** Simultaneous secret play is the better game;
  sequential is the simpler reducer. v0.2 chooses sequential. This is a real design cost, not a
  neutral choice.
- **[OQ-24] hidden hands.** Good for the game; means the digital build needs `playerView` stripping
  (routine) and that any MCTS bot faces imperfect information and needs determinization.
- **[v2] the pending event, inverted.** Trivial physically, fiddly digitally — the only state the
  server holds that *no* client may see. A naive `playerView` that only hides opponents' private
  data will leak it to the roller.

---

## 8. SIGN-OFF CHECKLIST

Ordered by downstream dependency.

| Pri | ID | Question | v0.2 default |
|---|---|---|---|
| **P0** | OQ-01 | Do tiers 3/4 cover linen? *(game unwinnable if no)* | **Yes** [A-01] |
| **P0** | OQ-11 | Electricity resolves after reckoning and does nothing | **Suppress the following day's reckoning** [A-11] |
| **P0** | OQ-02 | Jimothy's effect | **Null event** [A-12] |
| **P0** | OQ-03 | Special item deck composition | **15 cards, 3 of each** [A-03] |
| **P1** | §7.3 | Gang now only empties OFF machines — accept and rewrite the card text, or move events pre-reckoning? | **Accept + rewrite text**; flag pre-reckoning as the higher-value alternative |
| **P1** | OQ-17 | Basket: does absolute immunity clean bedding in one shot? | **Yes** [A-17c] — largest balance lever in the game |
| **P1** | OQ-06 | `kind` for crowding *(2 of 4 readings now dead by arithmetic)* | **`type`** [A-06] |
| **P1** | OQ-10 | Event frequency rose from 16.7% to 42–67% of days — intended? | **Accept provisionally, playtest** |
| **P1** | OQ-27 | Is loading mandatory? | **Yes, maximal** [A-08] |
| **P1** | OQ-14 | Crowding after tier, no re-trigger? | **Yes** [A-26] |
| **P1** | OQ-15 | Coloring after tier, no removal? | **Yes** [A-26] |
| **P1** | OQ-05 | Bleach: swap or kill-dark? | **Swap** |
| **P2** | OQ-04 | Keep the tier-2 inversion? | **Keep** |
| **P2** | OQ-31 | Cards persist on OFF machines? | **Yes** [A-09] |
| **P2** | OQ-33 | Gang empties OFF machines? *(if no, Gang is always blank)* | **Yes** [A-27] |
| **P2** | OQ-12 | Acting order within a phase | **Keyholder first, then clockwise** [A-13] |
| **P2** | OQ-16 | Wash net overrides the ladder? | **No, isolation only** [A-24] |
| **P2** | OQ-17 | Basket: own items only? component or effect? | **Own only; pure effect** [A-17/17b] |
| **P3** | OQ-22 | Fresh/ready counts public? | **Yes** [A-06b] |
| **P3** | OQ-23 | Special phase sequential or simultaneous? | **Sequential** [A-15] |
| **P3** | OQ-24 | Hidden hands? | **Yes** [A-18] |
| **P3** | OQ-25 | Bedding progress public? | **Yes** [A-04] |
| **P3** | OQ-30 | Blankets displaceable by a 4? | **Yes, into empty machines only** [A-16] |
| **P3** | OQ-13/18/19/20/21/26/28/29/32/34/35/36 | Minor, as listed in §6 | as listed |
| **P3** | §7.2 | Does the game need a termination guarantee? | **None added; flagged** |
| **P3** | §7.5.4 | Is the key now too weak without the bonus roll? | **Playtest** |
