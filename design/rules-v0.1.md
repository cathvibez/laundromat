# Laundromat — Formal Rules v0.1

**Status:** Formalization of `design/game-brief.md` (Design Brief v1). Not a redesign.
**Purpose:** A specification precise enough to (a) resolve at a physical table without hidden
bookkeeping, and (b) implement directly as pure reducer functions in boardgame.io.

**How to read this document.**
Anything stated in plain text is a direct restatement of the brief.
Anything tagged **[A-nn]** is an *assumption I introduced* to close a gap the brief leaves open.
Every assumption is restated with its alternatives in §6 and awaits designer sign-off.
Anything tagged **[!]** is a rules-integrity problem — see §7.

Where hand-resolvability and clean reducer implementation pull in different directions,
the conflict is called out inline with **[CONFLICT]** rather than silently resolved.

---

## 1. GLOSSARY

The brief uses *clothes*, *garment*, *item*, and *piece* interchangeably. This section fixes
one canonical term per concept. **All later sections use only canonical terms.**

### 1.1 Canonical terms

| Term | Status | Definition |
|---|---|---|
| **item** | **CANONICAL** | The atomic unit of laundry: exactly one card. Every physical card that can be loaded into a machine is an item. An item has exactly four intrinsic attributes: `owner` (a player color), `shade` (`dark` or `light`), `type` (one of the eight in §2.1), and a unique `id`. Two sock cards of the same owner and shade are two *distinct items* with the same `type` and `shade`. |
| **garment** | **ALIAS — deprecated** | Used in the brief in §2 (roll of 4) and §5 as a synonym for *item*. Treat every occurrence as *item*. Do **not** read "garment" as excluding underwear/blanket/bedding; see [A-11]. |
| **piece** | **ALIAS — deprecated** | Used only in the Handwash basket text. Treat as *item*. |
| **clothes / clothing** | **CANONICAL (a category, not a unit)** | The set of item types `{shoes, socks, pants, shirts, hats}`. "Clothes" is never a synonym for "item". A single such item is a *clothing item*, never "a clothes". |
| **linen** | **NEW, CANONICAL** | The complement category: item types `{underwear, blanket, bedding}`. The brief calls these "special items", which collides fatally with **special item cards** (§6 of the brief). This spec uses **linen** for the laundry, and **special item card** only for the playable action cards. |
| **shade** | **CANONICAL** | The binary attribute `dark` \| `light`. Every item has exactly one. Shade is intrinsic and printed on the card; it is never mutated. Effects that "reverse" shade (Bleach) compute an **effective shade** at reckoning time and leave the printed shade untouched. |
| **effective shade** | **NEW, CANONICAL** | The shade an item is treated as having *for a single reckoning of a single machine*, after Bleach is applied. Equal to `shade` unless a Bleach card is at that machine. Never persists past reckoning. |
| **type** | **CANONICAL** | One of the eight values in §2.1. "Garment type" in the brief = `type`. |
| **kind** | **CANONICAL (crowding only)** | The equivalence class used by the crowding rule. **[A-07]: `kind(item) = item.type`** — same kind means same type, regardless of owner or shade. Used nowhere except the crowding rule. |
| **pair** | **CANONICAL** | The two sock items of one owner in one shade. A pair is *not* a game object — it has no state and is never loaded, washed, or sent back as a unit. It exists solely for the setup fetch rule (§2.4). Each of its two members is an independent item that washes or is sent back independently. |
| **machine** | **CANONICAL** | A washing machine. A board zone with: an ordered identity `M1..M(P+1)`, a `power` state (`ON`/`OFF`), a multiset of loaded items, and a multiset of attached special item cards. Machines are public information. |
| **loaded** | **CANONICAL** | An item is *loaded* iff it is physically in a machine. Loading is the act of moving an item from a hand to a machine. Loaded items are public information [A-19]. |
| **washed** | **CANONICAL** | A terminal per-item verdict from reckoning. A washed clothing item or washed linen (except bedding) leaves play into its owner's **clean pile** and counts toward victory. Bedding is the sole exception: see *wash event*. |
| **wash event** | **NEW, CANONICAL** | The act of a machine successfully washing an item once. For every item type except bedding, one wash event = washed = clean. Bedding requires two wash events (§5.9). This term exists solely to keep bedding's arithmetic unambiguous. |
| **sent back** | **CANONICAL** | The other terminal verdict from reckoning: the item is removed from the machine and returned to its owner's hand, with **no penalty** and no state change. It may be re-loaded on any later day. Bedding retains its accumulated wash-event count when sent back. |
| **retained** | **NEW, CANONICAL** | The *non*-verdict: the item stays loaded in the machine into the next day. Occurs only when the machine does not reckon (power OFF, or Electricity). Retained is not "sent back" and is not "washed". |
| **day** | **CANONICAL** | Synonym for **round**. The brief uses both. This spec uses **day** for the game-facing term and `round` for the state field; they are the same number. One day = one full pass of §3's five phases. |
| **round** | **ALIAS** | = day. |
| **reckoning** | **CANONICAL** | Phase 5 of a day: the simultaneous, independent resolution of every ON machine. "Simultaneous" is a claim about semantics, not sequencing — see [A-18]. |
| **turn order** | **CANONICAL** | Fixed clockwise seating order, established at setup, never changes. Distinct from the *acting order within a phase*, which starts at the current keyholder [A-14]. |
| **keyholder** | **CANONICAL** | The single player holding the key on the current day. |
| **clean pile** | **NEW, CANONICAL** | A public, face-up per-player pile of that player's washed items. Public so victory is verifiable without inspecting hands. |
| **hand** | **CANONICAL** | A player's unloaded, unwashed items. **[A-19]: hidden from other players.** Special item cards held but not yet played are also in hand and also hidden. |
| **must-wash set** | **NEW, CANONICAL** | The 10–12 items dealt to a player at setup (§2.4). Fixed for the whole game. Victory = clean pile equals must-wash set. Items outside a player's must-wash set never enter the game. |

### 1.2 Terms deliberately eliminated

- **"special item"** as a name for underwear/blanket/bedding → replaced by **linen**.
- **"garment"**, **"piece"** → replaced by **item**.
- **"basic"** vs **"special"** in the brief's taxonomy table → these two labels are exactly
  `clothes` vs `linen` and carry no further meaning. Dropped.

---

## 2. COMPONENT MANIFEST

### 2.1 Item types

| `type` | category | cards per shade | cards per color (2 shades) |
|---|---|---|---|
| `shoes` | clothes | 1 | 2 |
| `socks` | clothes | **2** (one pair) | 4 |
| `pants` | clothes | 1 | 2 |
| `shirts` | clothes | 1 | 2 |
| `hats` | clothes | 1 | 2 |
| `underwear` | linen | 1 | 2 |
| `blanket` | linen | 1 | 2 |
| `bedding` | linen | 1 | 2 |
| **TOTAL** | | **9 cards / 8 types** | **18** |

### 2.2 Resolving the 16-vs-18 arithmetic — showing the work

The designer believes the per-color total is 16. It is 16 **only if socks are one card per
shade**. The arithmetic:

```
Reading A — socks as ONE card per shade (the pre-split count, source of "16")
  per shade: shoes 1 + socks 1 + pants 1 + shirts 1 + hats 1
           + underwear 1 + blanket 1 + bedding 1            = 8 cards
  per color: 8 × 2 shades                                    = 16 cards   ← the "16"

Reading B — socks as TWO cards per shade (the brief's explicit rule)
  per shade: shoes 1 + socks 2 + pants 1 + shirts 1 + hats 1
           + underwear 1 + blanket 1 + bedding 1            = 9 cards
  per color: 9 × 2 shades                                    = 18 cards   ← the "18"

Delta = +1 card per shade = +2 cards per color, exactly the sock split.
```

**The 16 and the 18 are the same design counted before and after the sock split.**
They are not in conflict; the brief's "16" is simply stale. Under the rules as written,
**the per-color total is 18.**

If the designer wants to *preserve* 16 while keeping split socks, exactly two cards per color
must be removed. Three candidate cuts:

| Cut | Result | Cost to the design |
|---|---|---|
| **B1. Accept 18.** No cut. | 18/color | None. Starting hand becomes 10-of-18 rather than 10-of-16, i.e. a slightly larger unseen remainder. **Recommended [A-01].** |
| **B2. Drop `hats` entirely.** | 8/shade = 16/color | Loses a clothing type; reduces crowding-rule collisions; hats are mentioned only once in the brief and carry no unique rule. Cheapest cut. |
| **B3. Make `blanket` and `bedding` shade-neutral** (one of each per color, not per shade). | (7×2) + 1 + 1 = 16/color | Elegant — a blanket has no "dark shade" in the fiction — but it *breaks the reckoning ladder*, which classifies every item by shade. A shade-neutral item would need a third shade value and its own tier behavior. **Do not adopt without a matching ladder rule.** |

**[A-01] ASSUMPTION: adopt B1. Per-color total is 18.** Everything below assumes 18.

### 2.3 Totals by player count

Machines = players + 1.

| Players | Colors in play | Item cards in play (18/color) | Item cards under a 16/color cut | Machines |
|---|---|---|---|---|
| 3 | 3 | **54** | 48 | 4 |
| 4 | 4 | **72** | 64 | 5 |
| 5 | 5 | **90** | 80 | 6 |
| 6 | 6 | **108** | 96 | 7 |

Note that *most cards never enter play*: each player uses only 10–12 of their 18. The
undrawn remainder exists solely as (a) the pool the sock fetch draws from, and (b) the
randomizer for the opening deal. **[A-02]:** the undrawn remainder is set aside face-down and
is inert for the rest of the game — it is never drawn from again after setup, and its
contents are never revealed. (This matters: it means "3 shirts" for crowding can only ever be
3 *different players'* shirts of the same shade, or 2 shades × ... — see §5.7.)

### 2.4 Setup and the starting hand

1. Choose seating order (turn order). Give each player their 18-card color deck.
2. Each player shuffles their own color deck and draws **10 items** at random.
3. **Sock fetch.** For each shade *s* ∈ {dark, light}: if the player's 10 cards contain
   **exactly one** of their two `socks` items of shade *s*, they search the undrawn remainder,
   take the matching sock item, and add it to their hand. If they drew both or neither, no fetch.
4. The resulting hand is the player's **must-wash set**: 10, 11, or 12 items.
   It is fixed for the rest of the game.
5. The undrawn remainder is set aside face-down and is inert [A-02].
6. All machines start **ON** and empty.
7. The first player (seat 1) takes the key. **[A-03]:** the key does *not* rotate before day 1
   — seat 1 is keyholder on day 1, seat 2 on day 2, and so on.

**Must-wash set size distribution** (10 drawn from 18, per pair, hypergeometric):

```
P(exactly one of a given sock pair drawn) = C(2,1)·C(16,9) / C(18,10) = 2·11440 / 43758 = 0.5229
P(both drawn)                             =      C(16,8) / C(18,10) =   12870 / 43758 = 0.2941
P(neither drawn)                          =      C(16,10)/ C(18,10) =    8008 / 43758 = 0.1830
```

Each of the two pairs fetches independently-ish; expected must-wash set size ≈ **11.05 items**.
A player is therefore *more likely than not* to have a 12-card must-wash set. **[!]** This means
the "10 items" headline number is misleading and the game is ~10% longer than the brief implies.

**Invariant.** After setup, every sock item in any hand belongs to a complete pair. A player
never holds exactly one sock of a shade. (They may *load* one of the two, so a machine can
contain a single sock.)

### 2.5 Special item card deck

**[!] The brief specifies no quantities.** Five card names are given with no counts, no deck
size, and no draw/discard structure beyond "shuffled back into their deck after being played".

**[A-04] ASSUMPTION:** a single shared special item deck, **3 copies of each of the 5 cards = 15 cards**,
shuffled. Drawn cards go to hand (hidden). Played cards attach to a machine, remain attached
until that machine reckons, and are shuffled back into the deck at the end of that reckoning.
The deck is never reshuffled from a discard pile because there is no discard pile — cards go
straight back in. The deck can therefore only run dry if 15 cards are simultaneously in hands
and at machines, which requires 15 sixes with no plays.

### 2.6 Event card deck

3 cards: **Gang**, **Jimothy**, **Electricity**. Drawn one at a time, resolved immediately,
shuffled straight back. The deck never depletes. **[!] Jimothy has no defined effect** —
see §7.4.

### 2.7 Other components

| Component | Count | Purpose |
|---|---|---|
| Key | 1 | Marks the keyholder. |
| Die | 1 (d6) | Shared. |
| Machine power markers | P+1 | ON/OFF indicator per machine. |
| **Bedding wash tokens** | 2 per player | Placed on a bedding card to record 1 accrued wash event. Required — bedding's progress is the only per-item persistent state in the game and it *must* be physically visible. **[CONFLICT]** none: a token is honest public bookkeeping. **[A-05]:** bedding wash progress is **public**, even while the bedding is in a hidden hand — i.e. the token stays on the card and players may ask "is your bedding half-washed?" and must answer truthfully. Making it private would be hidden bookkeeping the physical game cannot police. |
| Handwash basket | 1 per player, or none | See [A-16] — under the recommended reading the basket is a pure effect and needs no component. |

---

## 3. ROUND STATE MACHINE

### 3.1 Phase list (strict order)

Let `P` = number of players, `M = P + 1` = number of machines.
Let `order(k)` = the acting sequence for a phase: the keyholder first, then clockwise [A-14].

---

**PHASE 0 — DAY START / KEY ROTATION**
- *Entry:* start of a day.
- *Actor:* none (automatic).
- *Effect:* `round += 1`. If `round > 1`, the key passes to the next player in turn order [A-03].
- *Legal actions:* none.
- *Exit:* immediately, unconditionally.

**PHASE 1 — ROLL PHASE**
- *Entry:* Phase 0 complete.
- *Actors:* every player, once each, in `order(k)`.
- *Effect per actor:* roll 1d6; resolve per §4. The resolution of a 1–3 requires the player to
  choose destination machines; a 4 requires choosing an item and a destination.
- *Legal actions:* exactly the ones enumerated in §4 for the rolled face, and nothing else.
  A player with no legal resolution of their roll produces a no-op (§4.6).
- *Exit:* every player has rolled and fully resolved their roll.

**PHASE 2 — SPECIAL ITEM PHASE**
- *Entry:* Phase 1 complete.
- *Actors:* every player, once each, in `order(k)`, **sequentially** [A-18].
- *Legal actions per actor, choose exactly one:*
  - play **one** special item card from hand, attaching it to **one** machine (ON or OFF), or
  - pass.
- *Constraints:* at most one card per player per day; a player may hold any number of cards.
  A card may be attached to a machine that already has cards, including cards of the same name
  [A-09]. Handwash basket resolves its extraction *at the moment it is played* (§5.10).
- *Exit:* every player has played or passed.

**PHASE 3 — KEY PHASE**
- *Entry:* Phase 2 complete.
- *Actor:* the keyholder only.
- *Step 3a — power action.* The keyholder does **exactly one** of:
  - turn one machine ON, or
  - turn one machine OFF, or
  - nothing.
  (One machine, one toggle, per day. Not one toggle per machine.)
- *Step 3b — bonus roll.* The keyholder rolls 1d6 **unconditionally**, whether or not they
  used the power action [A-06]. On a **6**, draw an event card and resolve it immediately,
  before Phase 4. On **1–5**, nothing happens [A-06].
- *Exit:* bonus roll resolved (and event, if any, fully resolved).

**PHASE 4 — RECKONING**
- *Entry:* Phase 3 complete and no Electricity event is active.
  If Electricity was drawn this day, Phase 4 is **skipped entirely** [A-22].
- *Actor:* none (automatic and deterministic).
- *Effect:* for each machine in ascending index order `M1..M(P+1)`, run `RESOLVE_MACHINE`
  (§5.2). Machines are mutually independent — no machine's resolution reads or writes another
  machine's state — so index order is arbitrary and exists only to make replay deterministic
  and table procedure orderly [A-18].
- *Post-effect:* every ON machine is empty of items afterward (invariant I-3, §5.12). All
  special item cards attached to ON machines are shuffled back into the special item deck.
  Cards attached to OFF machines stay attached [A-10].
- *Exit:* all machines resolved.

**PHASE 5 — VICTORY CHECK**
- *Entry:* Phase 4 complete (or skipped).
- *Effect:* for each player, if `cleanPile == mustWashSet`, they have won.
  If more than one player qualifies on the same day, **all of them win jointly** [A-20].
- *Exit:* if any winner, game ends (`GAME_OVER`). Otherwise return to Phase 0.

---

### 3.2 State-transition table

Machine-readable form. `k` = keyholder seat, `P` = player count, `i` = index into the acting
sequence. `ctx.actor` is the player whose input is required; `—` means no input (auto-advance).

| # | State | ctx.actor | Legal moves | Guard / validation | Next state | Exit condition |
|---|---|---|---|---|---|---|
| 0 | `DAY_START` | — | — | — | `ROLL(i=0)` | auto |
| 1 | `ROLL(i)` | `order(k)[i]` | `rollDie()` | actor has not yet rolled this day | `ROLL_RESOLVE(i, face)` | die rolled |
| 2 | `ROLL_RESOLVE(i, face∈1..3)` | `order(k)[i]` | `loadItem(itemId, machineId)` × `n` where `n = min(face, legalLoadCount)` | item ∈ actor's hand; machine accepts item (§4.7) | `ROLL(i+1)` or `SPECIAL(0)` | `n` loads performed |
| 3 | `ROLL_RESOLVE(i, 4)` | `order(k)[i]` | `moveItem(itemId, fromMachine, toMachine)` × 1, or auto-skip | `item.owner ≠ actor`; item is loaded; `toMachine ≠ fromMachine`; `toMachine` accepts item (§4.7) | next | move made or no legal move |
| 4 | `ROLL_RESOLVE(i, 5)` | — | — | — | next | auto |
| 5 | `ROLL_RESOLVE(i, 6)` | — | `drawSpecial()` | special deck non-empty | next | draw made or deck empty |
| 6 | `SPECIAL(i)` | `order(k)[i]` | `playSpecial(cardId, machineId[, targetItemId])` or `pass()` | card ∈ actor's hand; ≤1 play this day; basket target legal (§5.10) | `SPECIAL(i+1)` or `KEY_POWER` | played or passed |
| 7 | `KEY_POWER` | player `k` | `setPower(machineId, ON\|OFF)` or `pass()` | exactly one machine; new value ≠ old value | `KEY_ROLL` | acted or passed |
| 8 | `KEY_ROLL` | player `k` | `rollDie()` | — | `EVENT` if face=6 else `RECKON(0)` | die rolled |
| 9 | `EVENT` | — | `drawEvent()` → resolve | event deck non-empty (always true) | `RECKON(0)`, or `VICTORY_CHECK` if Electricity | event resolved |
| 10 | `RECKON(j)` | — | `resolveMachine(M[j])` | — | `RECKON(j+1)` or `VICTORY_CHECK` | `j > P` |
| 11 | `VICTORY_CHECK` | — | — | — | `GAME_OVER` if any winner, else `DAY_START` | auto |
| 12 | `GAME_OVER` | — | — | — | terminal | — |

**boardgame.io mapping.** States 1–5 are one boardgame.io *turn* per player inside a `roll`
phase (`turn.order` = custom, starting at keyholder). State 6 is a `special` phase with the
same custom order. States 7–9 are a `key` phase with `turn.order = { first: () => keyholder }`
and a single turn. States 10–11 belong in the `key` phase's `onEnd` — they take no player
input and must not be exposed as moves. `RECKON` must be a pure function of the machine's
contents (§5) so it can be unit-tested outside the framework.

---

## 4. DICE OUTCOME TABLE

One die, faces 1–6. Used in Phase 1 by every player, and again in Phase 3b by the keyholder
with a completely different (and much smaller) outcome table.

### 4.1 Phase 1 roll — full table

| Face | Nominal outcome | Precise rule | Degenerate cases |
|---|---|---|---|
| **1** | Load 1 item | Actor loads exactly 1 item from hand into any one machine. | Hand empty, or no machine accepts any held item → load 0. No-op turn. |
| **2** | Load 2 items | Actor loads exactly 2 items. Each item is chosen independently and each may go to a *different* machine [A-12]. | Hand has 1 → load 1. Hand empty → load 0. Fewer legal targets than items → load as many as legal (§4.7). |
| **3** | Load 3 items | As above with 3. | As above. |
| **4** | Displace | Actor moves **one item owned by another player** from the machine it is in to a *different* machine. | No other player's item is loaded anywhere → **no effect** [A-13]. Only one machine has contents and every other machine refuses the item (all hold blankets) → **no effect**. |
| **5** | Nothing | No effect. | — |
| **6** | Draw special | Draw 1 special item card into hand. | Special deck empty → **no effect**, no compensation, no reshuffle (there is nothing to reshuffle from) [A-04]. |

**Rolling 4, 5, or 6 loads zero items.** This is the brief's explicit note and is the game's
main pacing throttle: expected items loaded per player per day = (1+2+3)/6 = **1.0**.

### 4.2 Face 1–3 — is loading mandatory?

**[A-12] ASSUMPTION: loading is MANDATORY and maximal.** The actor must load
`min(face, |legal loads available|)` items. They choose *which* items and *which* machines;
they do not choose *how many*. The brief's word is "exactly", and an optional load would make
the dominant strategy "never load anything you can't guarantee", which stalls the game.

Consequence: a player can be forced to load an item into a machine that will destroy it.
This is intended — it is the game's entire tension.

### 4.3 Face 4 — displacement, precisely

- The moved item must satisfy `item.owner ≠ actor`. It may be *any* other player's item,
  in *any* machine, ON or OFF.
- The destination must be a different machine (`to ≠ from`) and must accept the item (§4.7).
- The item **cannot leave the machines** — it may never be returned to a hand this way.
- **[A-13]:** if no legal (item, destination) pair exists, the roll is a no-op. The player is
  not compensated and does not re-roll.
- **[A-15]:** a blanket *may* be displaced by a 4, but only into an **empty** machine, since
  blanket exclusivity binds destinations as well as loads. If no machine is empty, blankets
  are not legal targets.
- Displacing an item **into an OFF machine** is legal and is the primary way to protect
  another player's item — or, read the other way, the primary way to *deny* it a reckoning.

### 4.4 Face 6 — special item draw

Drawn card goes to hand, hidden. There is no hand limit on special item cards [A-08]. A card
drawn in Phase 1 may be played the same day in Phase 2.

### 4.5 Phase 3b — keyholder bonus roll table

| Face | Outcome |
|---|---|
| 1 | Nothing [A-06] |
| 2 | Nothing [A-06] |
| 3 | Nothing [A-06] |
| 4 | Nothing [A-06] |
| 5 | Nothing [A-06] |
| **6** | Draw 1 event card, resolve immediately, shuffle back. |

The bonus roll is taken **every day, unconditionally**, regardless of whether the keyholder
used their power action [A-06]. Expected event frequency: once per 6 days, independent of
player count. Over a ~15-day game, ≈2.5 events.

### 4.6 Universal no-op rule

**Any die outcome that cannot be legally executed is discarded with no effect.** No re-roll,
no substitution, no compensation. This single rule covers: empty hand on 1–3, no valid
displacement on 4, empty special deck on 6, and any future addition. It is stated once here so
implementations need not special-case each face.

### 4.7 `machineAccepts(machine, item)` — the single load/move legality predicate

An item may be placed into a machine (by load, by displacement, or by any future effect) iff:

```
machineAccepts(machine, item):
    if machine contains a blanket                 -> FALSE   (nothing joins a blanket)
    if item.type == blanket and machine non-empty -> FALSE   (a blanket joins nothing)
    otherwise                                     -> TRUE    (no capacity limit)
```

That is the *entire* legality check. Power state does not affect legality. Note the predicate
is symmetric-ish but not identical in its two clauses, and both are needed.

---

## 5. THE RECKONING ALGORITHM

### 5.1 Design of the algorithm — why this order

The reckoning has one job: given a machine's contents and attached cards, assign every loaded
item a verdict in `{WASHED, SENT_BACK}` (or `RETAINED` if the machine does not run).

The rules that bear on it fall into exactly three classes, and recognizing this is what makes
the ordering tractable:

| Class | Rules | Direction |
|---|---|---|
| **(a) Shade remapping** | Bleach | Changes the *inputs* to tier selection. Must run first. |
| **(b) Tier selection + provisional verdict** | the four-tier ladder | Establishes the baseline. Runs second. |
| **(c) Monotone downgrades** | underwear isolation, blanket exclusivity, crowding, Coloring, Color catcher | Can only turn `WASHED → SENT_BACK`. Never the reverse. |

**Key theorem (and the main implementation payoff): the class-(c) rules commute.**
Because every class-(c) rule is a monotone downgrade — each computes a set of items to demote
from a predicate that depends only on the machine's *contents and attached cards*, never on
other items' current verdicts — the final verdict for an item is:

```
washed(i)  =  tierMatch(i)  AND  NOT isolationViolated(i)  AND  NOT crowded(i)  AND  NOT ruined(i)
```

The order in which the downgrades are applied cannot change this conjunction. **This is why
the algorithm is safe to implement as a chain of filters and safe to resolve by hand in any
order at the table.** The only load-bearing ordering constraint in the whole reckoning is:
**Bleach before tier selection.**

Two ordering decisions that are *not* forced by the above and must be stated as assumptions:

- **[A-17] Crowding is applied AFTER tier selection, and does not re-trigger it.**
  The brief says crowding applies "on top". So 3 dark shoes + 1 light shirt → tier 1 fires,
  crowding then demotes all 3 shoes, and the light shirt is *not* promoted. Nothing washes.
  The alternative ("remove crowded items first, then pick a tier") would let the light shirt
  wash, and would require iterating to a fixed point (removal can create new crowds? no — but
  it can change the tier, which can change nothing further; it terminates in one pass). The
  "on top" reading is both simpler and matches the brief's wording. It also preserves the
  fiction: three shirts jamming the drum does not remove the dark shoes from the drum.
- **[A-21] Coloring is applied AFTER tier selection and does not remove items from the machine.**
  A ruined item is still physically in the drum and still taints. So Coloring cannot be used to
  "clear" another player's dark shoes and let your light shirt through.

### 5.2 `RESOLVE_MACHINE` — deterministic pseudocode

Input: one machine `m`; the set of special item cards attached to `m`; global day flags.
Output: a verdict map `verdict : itemId → WASHED | SENT_BACK`, plus bedding token updates.
Pure: reads nothing else, writes nothing else.

```
FUNCTION RESOLVE_MACHINE(m, cards, dayFlags) -> verdicts

  # ---- S0. Machine gating -------------------------------------------------
  IF dayFlags.electricity == TRUE:
      RETURN { every item in m -> RETAINED }        # machine does not run at all [A-22]
  IF m.power == OFF:
      RETURN { every item in m -> RETAINED }        # contents persist to next day
  IF m.items is empty:
      RETURN { }                                     # no-op; attached cards still recycle

  # ---- S1. Effective shade (Bleach) ---------------------------------------
  # MUST precede S2: it changes which tier fires.
  bleached := (cards contains at least one Bleach)   # 2+ Bleach cards do NOT cancel [A-24]
  FOR each item i IN m.items:
      i.eff := IF bleached THEN swap(i.shade) ELSE i.shade      # swap: dark<->light

  # ---- S2. Tier selection --------------------------------------------------
  # Exactly one tier fires. Ladder is evaluated on eff shade, over ALL item
  # types (clothes AND linen) -- see [A-11].
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

  # ---- S4..S7 are MONOTONE DOWNGRADES and COMMUTE (see 5.1) ---------------

  # ---- S4. Underwear isolation --------------------------------------------
  hasNonUnderwear := EXISTS i IN m.items: i.type != underwear
  FOR each item i IN m.items WHERE i.type == underwear AND i.washed:
      netOwners := { c.owner : c IN cards, c.name == "Wash net" }
      IF hasNonUnderwear AND i.owner NOT IN netOwners:
          i.washed := FALSE                          # underwear washes only among underwear

  # ---- S5. Blanket exclusivity (defensive) --------------------------------
  # machineAccepts() should make this unreachable; assert rather than trust.
  IF EXISTS i: i.type == blanket AND |m.items| > 1:
      FOR each item i IN m.items: i.washed := FALSE
      LOG INVARIANT_VIOLATION                         # illegal state reached

  # ---- S6. Crowding --------------------------------------------------------
  FOR each type t IN typesPresent(m):
      IF count(i IN m.items : i.type == t) >= 3:      # >=3, not exactly 3 [A-23]
          FOR each i WHERE i.type == t: i.washed := FALSE
  # kind == type only: owner and shade are ignored [A-07]

  # ---- S7. Coloring / Color catcher ---------------------------------------
  coloringOwners := { c.owner : c IN cards, c.name == "Coloring" }
  catcherOwners  := { c.owner : c IN cards, c.name == "Color catcher" }
  FOR each p IN coloringOwners:
      FOR each item i IN m.items WHERE i.owner != p:
          IF i.owner NOT IN catcherOwners:
              i.washed := FALSE                       # ruined
  # Note: a Coloring owner does NOT protect their own items from the ladder,
  # from crowding, or from another player's Coloring [A-25].

  # ---- S8. Emit verdicts ---------------------------------------------------
  FOR each item i IN m.items:
      IF NOT i.washed:
          verdict[i] := SENT_BACK                     # to owner's hand, no penalty
      ELSE IF i.type == bedding:
          i.washCount := i.washCount + 1              # one WASH EVENT
          IF i.washCount >= 2:
              verdict[i] := WASHED                    # clean, to clean pile
          ELSE:
              verdict[i] := SENT_BACK                 # back to hand, token attached [A-05]
      ELSE:
          verdict[i] := WASHED

  # ---- S9. Card recycling --------------------------------------------------
  shuffle all cards attached to m back into the special item deck

  RETURN verdicts
END
```

### 5.3 Handwash basket — resolved OUTSIDE this function

The basket is deliberately not in `RESOLVE_MACHINE`. **[A-16]:** it is a *per-play effect*, not
a board component. When played in Phase 2:

1. The owner names one item that is **their own**, either in their hand or loaded in any machine.
2. That item is immediately removed from wherever it is and set aside in front of the owner.
3. At Phase 4, before any machine resolves, the basketed item receives a **wash event**
   unconditionally — immune to tiers, crowding, isolation, Coloring, Bleach, machine power,
   and Electricity. "At all odds" = unconditional.
4. If it is bedding, it gains **one** wash event, not two. The basket guarantees a wash *event*,
   not cleanliness.
5. Because step 2 physically removes the item from the machine, the item **does not count** for
   that machine's tier selection or crowding. A player can therefore use the basket to defuse a
   crowd of 3 — but only by removing one of their own items.

### 5.4 The four-tier ladder, restated

| Tier | Fires when | Washes | All other items |
|---|---|---|---|
| 1 | any dark shoes present | dark shoes only | SENT BACK |
| 2 | else any light shoes present | light shoes only | SENT BACK |
| 3 | else any dark item present | all dark items | SENT BACK (i.e. all light) |
| 4 | else (light items only) | all light items | — (nothing else present) |

Governing idea per the brief: *dark taints light; shoes taint everything.*
Tier 2 is a **known inversion** of that idea (a light shoe washes while a dark shirt is sent
back). Preserved as written; flagged for confirmation in §6 [OQ-11].

### 5.5 Tier membership of linen — the critical resolution

**[A-11] ASSUMPTION: tiers 3 and 4 read "dark item" / "light item", NOT "dark clothing item".**

This is the single most consequential assumption in the document. Under the brief's literal
text, tiers 3 and 4 say "dark clothes" and "light clothes", and §1 of the brief defines
*clothes* as excluding underwear, blankets, and bedding. Taken literally:

> **No underwear, blanket, or bedding could ever be washed by any tier.**
> Since every player's 10–12 card must-wash set is drawn at random from 18 cards of which 6
> are linen, essentially every player would hold at least one unwashable item, and
> **the game would be unwinnable for everyone.** See §7.1.

This cannot be the intent — the brief gives underwear, blankets, and bedding their own washing
rules, which presupposes that they can wash. Generalizing tiers 3/4 to all item types is the
minimal repair: it changes nothing for clothes-only machines, and it makes the linen rules
operative. The linen-specific constraints (isolation, exclusivity, double wash) then do the
work of making linen hard to wash, which is clearly the design intent.

Consequences worth noticing:
- Dark underwear beats light underwear: a machine of `{A-dark-underwear, B-light-underwear}`
  fires tier 3 and sends B's underwear back. Shade precedence applies *within* linen.
- A blanket is always alone, so it always fires tier 3 or 4 on itself and always washes.
  **A blanket loaded into an ON machine is a guaranteed wash.** Its only cost is occupying a
  whole machine and being vulnerable to a keyholder turning that machine off, to Gang, and to
  being displaced by a 4.
- Bedding sitting with dark clothes: light bedding is sent back, dark bedding washes.

### 5.6 Underwear isolation, precisely

Underwear item `u` is washed only if **every other loaded item in the machine is also of type
`underwear`** (any owner, any shade), *or* `u.owner` has a Wash net attached to that machine.

Notes:
- The isolation test is about the *machine's contents*, not about which items are washing.
  Two dark underwear + one light shirt: the shirt is not washing (tier 3), but it is still
  present, so isolation still bites and the underwear is sent back too. **Nothing washes.**
- Wash net protects *only its owner's* underwear ("Owner may wash **their** underwear").
  A net played by A does not save B's underwear.
- Wash net waives isolation only. It does **not** override the ladder: underwear still has to
  win its tier. Wash net + dark underwear + dark shoes → tier 1 → underwear sent back. [A-26]

### 5.7 Crowding, precisely

- `kind = type` [A-07]. Three `shirts` of any owners and any shades trigger it.
- Threshold is **≥ 3, not exactly 3** [A-23]. Four shirts → all four sent back.
- Applies to linen types too: three underwear → all sent back, even in an all-underwear
  machine. Blankets can never crowd (exclusivity caps them at 1).
- Applies regardless of whether the items were washing. Demoting an already-sent-back item is
  a no-op, so it is harmless to apply blindly.

**Sock warning [!]:** because socks are 2 cards of the same type per shade, and `kind = type`,
a player who loads both of their dark socks plus *any third sock card from any player in any
shade* triggers crowding on all three. Given the setup invariant (§2.4) that sock pairs are
always complete, the sock type is the most crowd-prone type in the game by a wide margin: with
6 players there are up to 24 sock cards versus 6 of most other types. Under the alternative
readings of `kind` (type+shade, or type+shade+owner) crowding on socks becomes nearly
impossible instead. This is the sharpest practical consequence of [A-07] and needs a designer
decision — see [OQ-07].

### 5.8 Bleach, precisely

Bleach computes an effective shade by swapping `dark ↔ light` for **every item in the machine**,
then the normal ladder runs. Equivalently, and identically: the ladder's rungs are relabeled to
`light shoes → dark shoes → light items → dark items`. These two formulations produce the same
verdicts for all inputs; either may be implemented.

The consequence a reader will trip over: **Bleach does not disarm dark shoes.** A dark shoe under
Bleach becomes an effective *light* shoe, which is still the highest-priority rung available
once tier 1 is empty. It washes, and everything else is still sent back. Bleach reverses the
*shade* axis and does not touch the *shoe* axis. See [OQ-12] for the alternative reading in
which Bleach hard-kills all dark items.

Bleach is machine-wide and ownership-agnostic: it affects the player who played it exactly as
much as everyone else. Two Bleach cards at the same machine do **not** cancel out — the effect
is a flag, not a toggle [A-24].

### 5.9 Bedding, precisely

- `bedding.washCount ∈ {0, 1, 2}` and is persistent per card.
- Each time bedding survives to `washed = TRUE` in S8, `washCount += 1` — one **wash event**.
- At `washCount == 1` the bedding is **sent back to the owner's hand** carrying a token. It is
  not clean, does not enter the clean pile, does not count for victory, and must be re-loaded.
- At `washCount == 2` it is clean and enters the clean pile.
- Wash events from the Handwash basket count (one each).
- `washCount` never decreases. Sent-back, Gang, Electricity, and displacement do not reset it.
- A player with bedding in their must-wash set effectively has an 11–13 item task, since bedding
  must survive reckoning twice.

### 5.10 Coloring and Color catcher, precisely

- **Coloring** attaches to a machine and names no target. Its owner is `p`. It demotes to
  `SENT_BACK` every item in that machine whose `owner ≠ p`.
- **Color catcher** attaches to a machine, owner `q`. It exempts `q`'s items from *every*
  Coloring at that machine. It is a blanket immunity, not a one-shot [A-27].
- Coloring does **not** wash the owner's items — they still face the ladder, crowding, and
  isolation normally [A-25]. Coloring is purely destructive.
- Two Colorings by different owners at one machine: each ruins the other's items, plus everyone
  else's. Net effect is that only an item whose owner played a Coloring *and* is exempt from all
  other Colorings can wash — in practice, with 2+ Colorings and no catchers, **nothing washes**.
- A Color catcher with no Coloring present does nothing and is wasted.
- "Ruins" is defined as `SENT_BACK`. There is no destruction, no discard, no penalty, because
  the brief states sent-back items return "with no penalty" and provides no other sink. This
  makes Coloring notably weaker than its name suggests — see [OQ-13].

### 5.11 Event cards

| Card | Precise effect |
|---|---|
| **Gang** | Every item in **every** machine — ON *and* OFF [A-28] — is immediately SENT BACK to its owner's hand. Every special item card attached to any machine is shuffled back into the special item deck. All machines are left empty. Power states are **not** changed [A-29]. Bedding wash counts are **not** reset. Then the day continues to Phase 4, which now finds every machine empty and is a no-op. |
| **Jimothy** | **UNDEFINED.** Unimplementable as written. See §7.4. |
| **Electricity** | Phase 4 is skipped entirely this day. Every machine — ON and OFF — RETAINS its contents and its attached cards. Nothing washes, nothing is sent back. Power states unchanged. Proceed to Phase 5 (victory check, which cannot fire) and then to the next day. [A-22] |

### 5.12 Invariants an implementation should assert

| ID | Invariant |
|---|---|
| I-1 | Every item is in exactly one of: a hand, a machine, a clean pile, the inert remainder, or the basket-set-aside (transiently within Phase 2–4). |
| I-2 | No machine ever contains a blanket alongside anything else. |
| I-3 | After Phase 4, every ON machine contains zero items. (Every item in an ON machine gets a terminal verdict; there is no third outcome.) |
| I-4 | `washCount > 0` only for `type == bedding`. |
| I-5 | A player's clean pile ⊆ their must-wash set. Items outside the must-wash set never enter play. |
| I-6 | Exactly one player holds the key. |
| I-7 | Every attached special item card's owner is a player still in the game. |
| I-8 | The union of a player's hand, loaded items, clean pile, and basket-set-aside equals their must-wash set, at every moment. |

---

### 5.13 WORKED EXAMPLES

Notation: `A-D-shoes` = player A's dark shoes. Cards are written `[Bleach:A]` meaning a Bleach
card attached to this machine, owner A. All examples assume machine power ON, no Electricity,
and the recommended defaults ([A-07] kind=type, [A-11] linen in tiers 3/4, [A-17] crowding
after tier, [A-21] Coloring after tier, [A-23] crowd threshold ≥3, Bleach = shade swap).

| # | Machine contents | Attached cards | Tier | Verdicts | Reason |
|---|---|---|---|---|---|
| 1 | `A-D-shoes`, `B-L-shirt`, `C-D-pants` | — | 1 | `A-D-shoes` **WASHED**; `B-L-shirt` SENT BACK; `C-D-pants` SENT BACK | Dark shoes taint everything, including other dark items. |
| 2 | `A-L-shoes`, `B-D-shirt` | — | 2 | `A-L-shoes` **WASHED**; `B-D-shirt` SENT BACK | The known inversion: no dark shoes present, so light shoes take tier 2 and the dark shirt loses. "Dark taints light" does not hold at tier 2. |
| 3 | `A-D-shirt`, `A-D-pants`, `B-L-hat` | — | 3 | `A-D-shirt` **WASHED**; `A-D-pants` **WASHED**; `B-L-hat` SENT BACK | No shoes; dark wins; light is tainted. The normal case. |
| 4 | `A-L-shirt`, `B-L-pants` | — | 4 | both **WASHED** | Light-only machine, everything washes. |
| 5 | `A-D-shoes`, `B-L-shirt` | `[Bleach:A]` | 2 | `A-D-shoes` **WASHED**; `B-L-shirt` SENT BACK | **Bleach + dark shoes.** Swap makes the dark shoes *effectively light* — still the top non-empty rung. Bleach does not disarm shoes. Under the alternative "Bleach kills dark" reading [OQ-12] this instead becomes: shoes SENT BACK, `B-L-shirt` **WASHED**. |
| 6 | `A-D-shirt`, `B-L-shirt` | `[Bleach:A]` | 3 | `B-L-shirt` **WASHED**; `A-D-shirt` SENT BACK | Swap makes B's light shirt effectively dark, so it takes tier 3. This is Bleach doing exactly what its card text says. Note A played it and lost their own shirt — Bleach is ownership-blind. |
| 7 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]` | 4 | `A-L-shirt` **WASHED**; `B-L-pants` SENT BACK; `C-L-hat` SENT BACK | Coloring ruins every other color. All three would otherwise have washed. |
| 8 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]`, `[Color catcher:B]` | 4 | `A-L-shirt` **WASHED**; `B-L-pants` **WASHED**; `C-L-hat` SENT BACK | **Coloring + catcher + third player.** The catcher protects only B. C is unprotected and is ruined. This is the intended three-body case. |
| 9 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]`, `[Coloring:B]` | 4 | **all three SENT BACK** | A ruins B and C; B ruins A and C. No item survives both. Two Colorings with no catchers = total loss. |
| 10 | `A-D-underwear`, `B-L-shirt` | `[Wash net:A]` | 3 | `A-D-underwear` **WASHED**; `B-L-shirt` SENT BACK | Tier 3 selects dark items *including linen* [A-11]; the net waives isolation. This is the intended use of Wash net. |
| 11 | `A-D-underwear`, `B-D-shoes` | `[Wash net:A]` | 1 | `B-D-shoes` **WASHED**; `A-D-underwear` SENT BACK | **Wash net + underwear + dark shoes.** The net waives *isolation only*. The underwear still fails the ladder — it is not a dark shoe. The net is wasted. |
| 12 | `A-D-underwear`, `B-D-underwear` | — | 3 | both **WASHED** | All-underwear machine, both effectively dark, isolation satisfied. |
| 13 | `A-D-underwear`, `B-L-underwear` | — | 3 | `A-D-underwear` **WASHED**; `B-L-underwear` SENT BACK | Shade precedence operates *inside* linen. An all-underwear machine is not automatically safe. |
| 14 | `A-D-underwear`, `A-D-shirt` | — | 3 | `A-D-shirt` **WASHED**; `A-D-underwear` SENT BACK | Isolation is about *contents*, not about what is washing. The shirt is present, so the underwear is sent back — even though both belong to A and both are dark. |
| 15 | `A-D-shoes`, `B-D-shoes`, `C-D-shoes`, `D-L-shirt` | — | 1 | **all four SENT BACK** | **Crowding alongside a tier-1 wash.** Tier 1 provisionally washes all three shoes; crowding (3 of type `shoes`) then demotes all three. The light shirt is *not* promoted — crowding does not re-run tier selection [A-17]. Nothing washes at all. |
| 16 | `A-D-sock`, `A-D-sock`, `B-D-sock` | — | 3 | **all three SENT BACK** | The sock trap. A loaded a complete pair (2 cards of type `socks`); B added one more; `kind = type` so that is 3 of a kind. Under a `type+shade+owner` reading of kind [OQ-07] all three would instead have washed. |
| 17 | `A-D-bedding`, `A-D-shirt` (bedding washCount 0) | — | 3 | `A-D-shirt` **WASHED**; `A-D-bedding` gets **wash event #1**, `washCount → 1`, returns to hand with token | **Bedding, first wash.** Mechanically the bedding leaves the machine exactly like a sent-back item, but it has made progress. This dual nature is why the *wash event* term exists. |
| 18 | `A-D-bedding` (washCount 1), `B-L-hat` | — | 3 | `A-D-bedding` **WASHED (clean)**, `washCount → 2`, to clean pile; `B-L-hat` SENT BACK | **Bedding, second wash.** Identical machine logic; only the accumulated counter differs. Implementations must not special-case bedding in the ladder — only in S8. |
| 19 | `A-D-blanket` | — | 3 | `A-D-blanket` **WASHED** | A blanket is always alone (I-2), so it always wins its own tier. Guaranteed wash if the machine is ON. |
| 20 | `A-D-shoes`, `B-D-shoes` (only 2 machines have contents; this one is **OFF**) | `[Coloring:C]` | — | **all RETAINED** | An OFF machine does not reckon. The Coloring card stays attached [A-10] and will fire whenever this machine is eventually turned on. Attached cards are a persistent threat, not a per-day one. |
| 21 | `A-L-shoes`, `B-L-shoes`, `C-L-shoes` | `[Bleach:A]` | 1 | **all three SENT BACK** | Swap makes them effectively *dark* shoes → tier 1 → all provisionally wash → crowding (3 shoes) demotes all. Bleach changed the tier's label but crowding did not care. |
| 22 | `A-D-shoes`, `B-D-hat` — plus A plays Handwash basket naming `A-D-shoes`, removing it in Phase 2 | `[Handwash basket:A]` (resolved on play) | 3 | `A-D-shoes` **WASHED** (basket, unconditional); machine now holds only `B-D-hat` → tier 3 → `B-D-hat` **WASHED** | **The basket defuses a tier-1 bomb by removing it.** A washes their shoes for free *and* accidentally rescues B. Basket extraction happens before tier selection because the item is physically gone. |
| 23 | `A-D-underwear`, `B-D-underwear`, `C-D-underwear` | — | 3 | **all three SENT BACK** | Isolation is satisfied (all underwear) and the ladder is satisfied (all dark), but crowding applies to linen types too. Three underwear jam the drum. |
| 24 | `A-L-shirt`, `B-D-shoes` | `[Bleach:A]`, `[Coloring:A]`, `[Color catcher:B]` | 2 | `B-D-shoes` **WASHED**; `A-L-shirt` SENT BACK | Full stack. Bleach swaps: shoes → effectively light, shirt → effectively dark. Tier 2 fires on the shoes. Coloring:A would ruin B's shoes but B holds the catcher, so the shoes survive. A's own shirt loses to the ladder — Coloring gave it no protection [A-25]. A played three cards' worth of effect and washed nothing. |
| 25 | (empty machine, ON) | `[Bleach:A]` | — | no verdicts | Empty machines are a no-op. The Bleach is still shuffled back into the deck — playing a card at an empty machine that stays empty simply wastes it. |

---

## 6. OPEN QUESTIONS AND PROPOSED DEFAULTS

Every entry states the question, the candidate readings, the play consequence of each, my
recommendation, and the assumption tag used in this document. **All of these are assumptions
awaiting designer sign-off.** Entries marked ★ are ones the brief did *not* flag — they were
found during formalization.

### Component and setup

**[OQ-01] Per-color card count: 16 or 18?** *(brief-flagged)*
Readings: (a) accept 18, socks split as written; (b) keep 18 but rename the headline to 18;
(c) cut a type to return to 16; (d) make blanket/bedding shade-neutral to return to 16.
Consequences: (a)/(b) identical mechanically — the deal becomes 10-of-18, meaning ~44% of a
player's color never enters play, which slightly increases the variance of which linen a player
is saddled with. (c) removing hats costs a clothing type and *reduces* crowding collisions.
(d) breaks the shade-based ladder and needs a new rule for shade-neutral items.
**Recommend (a): 18. [A-01]**

★ **[OQ-02] Is the undrawn remainder inert after setup?**
Readings: (a) set aside face-down, never touched again; (b) it forms a draw pile some effect
could later access. No effect in the brief accesses it except the sock fetch.
Consequence of (b): none currently, but it would let a future "draw a new item" card exist.
**Recommend (a). [A-02]**

★ **[OQ-03] Does the key rotate before day 1?**
Readings: (a) seat 1 holds the key on day 1 (Phase 0 rotation is skipped on round 1);
(b) rotation happens immediately, so seat 2 is the first keyholder and seat 1's "first player
starts with the key" is a one-phase formality.
Consequence: purely who acts first; (b) makes the phrase "the first player starts with the key"
meaningless. **Recommend (a). [A-03]**

★ **[OQ-04] How many special item cards of each type, and is the deck shared?**
The brief gives no counts at all. Readings: (a) one shared deck, 3 of each of 5 = 15;
(b) one shared deck, 5 of each = 25 (events become common, games get swingy);
(c) five separate single-name piles the player chooses from on a 6 (removes all randomness from
the 6, makes Handwash basket auto-pick and dominant).
Consequence: (c) is strictly worse — a guaranteed Handwash basket every 6 makes the die's
face-6 the best roll by a mile. **Recommend (a): shared, 15 cards, 3 each. [A-04]**

★ **[OQ-05] Is bedding wash progress public?**
Readings: (a) the token rides on the card and is publicly declarable even in hand;
(b) private, tracked by the owner.
Consequence: (b) is exactly the "hidden bookkeeping" the brief forbids for the physical version
and is unpoliceable at a table. **[CONFLICT]** — (b) is trivially implementable digitally but
not physically. **Recommend (a). [A-05]**

### Round structure

**[OQ-06] Does the keyholder's bonus roll happen regardless of whether they toggled a machine? Does a non-6 do anything?** *(brief-flagged)*
Readings: (a) unconditional roll, non-6 does nothing; (b) roll only if they toggled — this makes
"do nothing" strictly worse and effectively forces a toggle every day, which drastically
destabilizes machines; (c) non-6 faces gain effects — pure invention, out of scope.
**Recommend (a). [A-06]**

★ **[OQ-14] In what order do players act within a phase?**
The brief says "each player takes a turn" without specifying a starting player. Readings:
(a) keyholder first, then clockwise; (b) fixed seat 1 first every day; (c) rotate independently.
Consequence: (a) gives the key a second, subtler benefit (first pick of machines in the roll
phase) and keeps a single rotating pointer in state. (b) permanently advantages seat 1.
**Recommend (a). [A-14]**

★ **[OQ-18] Is the special item phase simultaneous or sequential?**
Readings: (a) sequential in acting order — later players see earlier plays and can respond
(a Color catcher answering a visible Coloring); (b) simultaneous secret selection then reveal.
Consequence: (a) heavily favors acting last and makes catchers reliable; (b) makes catchers a
read/bluff and is more interesting, but requires a hidden-commit step that is awkward at a table
and adds a commit/reveal sub-phase to the reducer. **[CONFLICT]** — (b) is the better game and
the worse implementation. **Recommend (a) for v0.1, revisit after playtest. [A-18]**

★ **[OQ-19] Are hands hidden?**
The brief never says. Readings: (a) item hands and special item card hands both hidden;
(b) items public (they are just laundry), cards hidden.
Consequence: (b) makes the roll-4 displacement and the key toggle far more calculable and
reduces the game's bluff surface to nearly zero; it also makes victory tracking trivial. (a)
preserves tension about who is close to winning. Clean piles are public under both.
**Recommend (a). [A-19]**

★ **[OQ-20] Simultaneous victory.**
Readings: (a) joint win; (b) keyholder wins ties; (c) tie broken by fewest days... no data.
Consequence: reckoning is simultaneous across machines, so genuine ties are reachable and need
an answer. **Recommend (a) joint win. [A-20]**

### Dice

★ **[OQ-12A] Is loading on a 1–3 mandatory?**
Readings: (a) mandatory and maximal — you must load `min(face, legal)`; (b) "up to" that many.
Consequence: (b) lets every player hold everything back whenever the board looks dangerous,
which can stall the game indefinitely (see §7.2). (a) forces items into harm's way, which is the
core tension. The brief's word is "exactly".
**Recommend (a). [A-12]**

★ **[OQ-12B] On a 2 or 3, may the items go to different machines?**
Readings: (a) each item independently targeted; (b) all must go to one machine.
Consequence: (b) is far more brutal and makes 3s dangerous to roll. (a) matches the brief's
plural "machines". **Recommend (a). [A-12]**

★ **[OQ-13A] Roll of 4 with no legal target.**
Readings: (a) no-op; (b) re-roll; (c) may move own item instead.
Consequence: (b) is unbounded in principle; (c) contradicts "one other player's".
**Recommend (a) — and generalize it as the universal no-op rule §4.6. [A-13]**

★ **[OQ-15] Can a blanket be displaced by a 4?**
Readings: (a) yes, but only into an empty machine (exclusivity binds destinations);
(b) never — blankets are immovable; (c) yes, anywhere, breaking exclusivity.
Consequence: (c) creates illegal states and must be rejected. (b) makes a blanket a permanent
machine-lock its owner fully controls. (a) is the only reading consistent with I-2 that keeps
the blanket contestable. **Recommend (a). [A-15]**

★ **[OQ-08] Is there a hand limit on special item cards?**
Readings: (a) none; (b) a cap (e.g. 3), excess discarded.
Consequence: (a) with a 15-card deck lets a lucky player hoard and combo. Playing only one per
day already throttles this heavily. **Recommend (a) for v0.1. [A-08]**

### Reckoning

**[OQ-07] What does "3 of the same kind" mean?** *(brief-flagged)*
Readings and their consequences:
- (a) **`type` only** — three shirts of any colors/shades. Crowding is a frequent, shared,
  emergent hazard. Socks (2 cards/shade) become extremely crowd-prone (§5.7). Creates strong
  incentive to diversify what you load and to watch what others load. **This is the plainest
  reading of the words.**
- (b) **`type` + `shade`** — three *dark* shirts. Roughly halves crowding frequency; socks still
  crowd-prone but less so; adds a second thing to scan for at the table.
- (c) **`type` + `owner`** — three of *your own* shirts. Impossible for every type except socks
  (max 2 per owner per type across both shades... actually shirts max 2 per owner). So crowding
  would essentially never fire, except a player loading 2 dark socks + ... still only 2 per shade
  and 4 per type per owner, so possible but rare and entirely self-inflicted. **Crowding becomes
  vestigial.**
- (d) **`type` + `shade` + `owner`** — only socks can ever reach 2, never 3. **Crowding becomes
  dead rules text.** Reject.
**Recommend (a). [A-07]** It is the reading under which the rule actually does something, and it
is the only reading that makes crowding an *interaction* rather than a self-own.

**[OQ-11] Tier 2 inversion — is it intended?** *(brief-flagged)*
Reading (a): keep as written — light shoes wash while a dark shirt is sent back. The
"shoes taint everything" axis simply outranks the shade axis, and within the shoe axis dark
outranks light. Internally consistent; the "dark taints light" slogan is just imprecise.
Reading (b): repair it — light shoes wash only if no dark item of any type is present, giving a
ladder of `dark shoes → dark items → light shoes → light items`. Consequence: light shoes become
nearly unwashable (any dark item anywhere in the machine blocks them), and since each player has
exactly one light shoe card, that is a serious victory bottleneck.
**Recommend (a): keep as written.** (b) risks making light shoes the hardest item in the game.
Flagged because the brief explicitly asked.

**[OQ-09] Does "dark clothes" in tier 3 include dark underwear / blanket / bedding?** *(brief-flagged)*
Readings: (a) yes — tiers 3/4 range over all items; (b) no, literal — linen is excluded from
every tier.
Consequence of (b): **linen can never wash and the game is unwinnable** (§7.1). (b) is not a
viable reading; it is a drafting error, not a design choice.
**Recommend (a). [A-11] — this is the highest-priority sign-off in the document.**

★ **[OQ-17] Crowding before or after tier selection?**
Readings: (a) after, no re-trigger ("on top" per the brief) — 3 dark shoes + light shirt = nothing
washes; (b) before — crowded items are removed from consideration, then the tier is picked, so
the light shirt washes.
Consequence: (b) turns crowding into a *tool* (deliberately triple a type to clear the tier) which
is a genuinely interesting mechanic but is invention. (a) makes crowding purely destructive.
**Recommend (a). [A-17]**

★ **[OQ-21] Coloring before or after tier selection?**
Readings: (a) after — ruined items stay in the drum and keep tainting; (b) before — ruined items
are treated as removed, so Coloring can clear a machine of other players' dark shoes and let the
Coloring owner's light items wash.
Consequence: (b) makes Coloring a powerful *constructive* combo (Coloring + your own light clothes
= guaranteed wash) rather than a pure denial card. That is a much stronger card and probably a
different design. **Recommend (a). [A-21]**

★ **[OQ-23] Crowding threshold: exactly 3, or 3-or-more?**
Readings: (a) ≥3; (b) exactly 3, so a 4th copy *saves* all four.
Consequence: (b) is absurd at the table and creates a hilarious but almost certainly unintended
"add a fourth shirt to rescue the shirts" play. **Recommend (a). [A-23]**

★ **[OQ-24] Do two Bleach cards at one machine cancel?**
Readings: (a) no — Bleach is a flag, any number ≥1 behaves identically; (b) yes — each swaps, so
even counts cancel.
Consequence: (b) creates a counter-play but is unstated and fiddly. **Recommend (a). [A-24]**

★ **[OQ-25] Does Coloring protect or benefit its owner's items?**
Readings: (a) no — owner's items face the ladder normally; (b) yes — owner's items auto-wash.
Consequence: (b) makes Coloring a near-guaranteed personal wash plus mass denial, easily the
best card in the game. **Recommend (a). [A-25]**

★ **[OQ-26] Does Wash net override the ladder as well as isolation?**
Readings: (a) isolation only — underwear must still win its tier; (b) it unconditionally washes
the owner's underwear.
Consequence: (b) makes Wash net a second Handwash basket restricted to underwear. The card text
says "may wash their underwear *even if other garment types are present*", which addresses
exactly and only the isolation restriction. **Recommend (a). [A-26]**

★ **[OQ-27] Is Color catcher one-shot or blanket immunity at that machine?**
Readings: (a) blanket — exempts its owner from all Colorings there for as long as it is attached;
(b) one-shot — cancels exactly one Coloring.
Consequence: (b) needs a pairing rule when there are 3 Colorings and 2 catchers. (a) is simpler
and matches "mitigates Coloring for the catcher's owner". **Recommend (a). [A-27]**

**[OQ-16] Handwash basket: component or effect? Can it pull from a machine? Can it take another player's item?** *(brief-flagged)*
Readings:
- Component vs effect: (a) pure per-play effect, no board component, resolves on play;
  (b) a persistent shared basket zone items accumulate in. (b) needs rules for when the basket
  empties, whether items in it can be attacked, and what happens to it on Gang — none of which
  exist. **Recommend (a).**
- Pull from a machine: the card text says "from a machine or from their hand", so **yes**, and it
  resolves immediately on play (Phase 2), which is why it can defuse crowding and tiers
  (worked example 22).
- Another player's item: (a) own items only; (b) any item. Under (b) the basket *washes* the
  target, which helps them — so it would be used as a gift or as a way to strip a taint out of a
  machine you care about. That is an interesting card but it inverts the card's plain reading
  ("Owner adds 1 piece..." with everything else in the card set being owner-scoped).
  **Recommend (a): own items only.**
- "At all odds" = unconditionally washed, immune to every other rule, including machine power and
  Electricity. **Confirmed as the reading.** For bedding it grants **one** wash event, not clean
  status. **[A-16]**

### Events

★ **[OQ-28] Does Gang empty OFF machines too?**
Readings: (a) yes, "every machine" is literal; (b) only ON machines.
Consequence: (b) makes turning a machine OFF a hedge against Gang as well as against reckoning,
compounding an already strong defensive option. (a) makes Gang the one thing OFF cannot stop,
which is a good pressure-release valve — see §7.3.
**Recommend (a). [A-28]**

★ **[OQ-29] Does Gang or Electricity change machine power states?**
**Recommend no for both. [A-29]** Nothing in either card's text touches power.

★ **[OQ-22] Electricity — retained or sent back?**
Readings: (a) machines simply do not run; contents are RETAINED into the next day, exactly like
OFF; (b) contents are sent back.
Consequence: (b) makes Electricity a weaker Gang and duplicates it. (a) makes it a *delay*, which
is distinct and thematic ("proceed to the next day"). **Recommend (a). [A-22]**

★ **[OQ-30] Jimothy.**
No effect defined. Candidates that fit the existing vocabulary without inventing new systems:
(i) remove the card from the deck until defined (event deck = 2 cards, event chance unchanged at
1/6 per day but only two possible outcomes);
(ii) Jimothy is a null event — draw it and nothing happens, i.e. events are only ~2/3 as frequent
as they appear;
(iii) Jimothy displaces one random item from one machine to another (a raccoon in the drum).
**Recommend (ii) for v0.1** — it is the zero-invention option, it keeps the deck at 3 cards as
written, and it costs nothing to replace later. Flag loudly: **the card is currently unimplementable
as anything else.** See §7.4.

★ **[OQ-10] Do special item cards attached to an OFF machine persist?**
Readings: (a) yes — they stay attached until that machine actually reckons, then recycle;
(b) no — they recycle at the end of every day regardless.
Consequence: (a) makes attaching a Coloring to a machine someone is about to turn off a long fuse,
and means a player can be hit by a card played four days earlier. (b) makes turning a machine off
a clean way to nullify every card at it. (a) preserves the brief's framing that turning a machine
on is "a detonation" — there must be something to detonate.
**Recommend (a). [A-10]**

★ **[OQ-09B] Can special item cards be attached to a machine containing a blanket?**
Cards are not items, so `machineAccepts` does not apply. **Recommend yes** — a Coloring on a
blanket machine is a clean way to punish a blanket. Blanket exclusivity governs *items*.

---

## 7. RULES INTEGRITY REVIEW

### 7.1 CRITICAL — the game as literally written is unwinnable

Under the brief's literal text, tiers 3 and 4 wash "dark clothes" / "light clothes", and *clothes*
is explicitly defined to exclude underwear, blankets, and bedding. No tier ever washes linen.
Underwear's isolation rule, the blanket's exclusivity rule, and bedding's two-wash rule all
describe *how* those items wash — but no rule ever *lets* them wash.

Each player draws 10 of 18 cards, of which 6 are linen. The probability that a player's must-wash
set contains zero linen is `C(12,10)/C(18,10) = 66/43758 ≈ 0.15%`. Essentially every player in
essentially every game holds at least one permanently unwashable item, and since victory requires
washing *all* drawn items, **no player can ever win.** The game never terminates.

This is a drafting error, not a design choice. **[A-11]** repairs it by generalizing tiers 3/4 to
all item types. It is the single most important item for designer sign-off. Everything else in
this document is tuning; this is load-bearing.

### 7.2 Termination: the game has no progress guarantee

Even with §7.1 repaired, **nothing in the rules forces the game to end.** There is no ratchet:

- Sent-back items return to hand "with no penalty" and can be re-loaded forever.
- No deck depletes (special items and events both shuffle back; the item remainder is inert).
- No resource is consumed. There is no day limit, no score, no elimination.
- The only monotone quantity in the entire game is `bedding.washCount`, which is bounded and
  affects at most 2 cards per player.

So the state space is finite but has no potential function that strictly decreases. A cycle is
constructible: with `[A-12]` mandatory loading, players *are* forced to put items in, so pure
stalling is prevented — but if, say, every player's remaining item is a dark shoe and they all
load into the same machine every day, crowding sends all three back every day, forever. That is a
genuine non-terminating loop reachable by rational play, not just by adversarial play.

Mitigating factors: machines outnumber players by one, so players can spread out; the die forces
variety; and no player benefits from a stalemate since nobody wins. In practice games will end.
But the *rules* do not guarantee it.

**Not fixed here** (that would be redesign). Flagged for the designer with three cheap options:
(i) a day cap with a most-clean-items tiebreak; (ii) a "sent back twice in a row = wash it" pity
rule; (iii) nothing — accept it and watch playtests.

### 7.3 Lockout and stalemate analysis

**Can a player be permanently locked out of progress?** No, but it is close.

- *Machine denial.* Opponents can taint machines with dark shoes, but each player loads only 1.0
  items/day on average and there are `P+1` machines. There is always at least one machine that no
  opponent has touched on a given day in expectation. **Not a lockout.**
- *Key denial.* The key rotates unconditionally every day, so every player is keyholder every
  `P` days. No player can be denied the key. **Not a lockout.**
- *The OFF-machine + key-rotation stalemate.* This is the one the brief's structure most invites.
  Consider a machine `X` turned OFF while holding player A's items. A wants it to stay off (their
  items are safe but also frozen); B wants it on (it contains a Coloring that will ruin A).
  Each day exactly one player is keyholder and may make exactly one toggle. Because the key
  rotates deterministically and unconditionally, `X` cannot be held in either state by any single
  player: on B's key day, B turns it on and it reckons that same day (Phase 3 precedes Phase 4).
  **A machine can be held OFF for at most `P-1` consecutive days**, and only if every intervening
  keyholder chooses to spend their one toggle elsewhere or not at all. It is not a stalemate; it
  is a timer.
  The genuinely stuck configuration would require *every* keyholder to prefer OFF forever, which
  is a coordination equilibrium no player benefits from — the items in `X` are not washing, so
  their owner is not progressing either. **Freezing a machine freezes the freezer.**
- *Total blanket lock.* With up to 2 blankets per color there can be `2P` blankets against `P+1`
  machines, so in principle every machine could hold a blanket, at which point `machineAccepts`
  returns FALSE everywhere, all loads become no-ops, and roll-4 has no empty destination. **But
  this state self-clears:** every ON blanket machine washes its blanket that same reckoning
  (worked example 19) and empties. To sustain the lock, every one of the `P+1` machines would have
  to be OFF, and machines can only be turned off one per day while ON blanket machines empty
  themselves each day. The lock cannot be reached, let alone sustained. **Not a stalemate**, but
  worth a playtest note: a transient one-day full-blanket board is reachable and looks alarming.
- *Gang as a release valve.* Because Gang empties OFF machines too [A-28], there is a ~1/6·(1/3)
  ≈ 5.6% chance per day of a total board reset. Any long freeze is eventually broken by Gang. If
  the designer prefers [OQ-28] reading (b) (Gang spares OFF machines), **this release valve
  disappears** and the OFF-machine analysis above becomes materially more dangerous. That is the
  main reason to prefer (a).

### 7.4 Unimplementable as written

| Item | Problem | Status |
|---|---|---|
| **Jimothy** | No effect defined. Cannot be represented as a reducer, cannot be resolved at a table. | Blocking for implementation. Default [OQ-30](ii): null event. |
| **Special item deck composition** | No counts given anywhere. | Blocking. Default [A-04]: 15 cards, 3 each. |
| **"Ruins"** (Coloring) | Undefined verb. The only removal-from-machine outcome in the game is SENT_BACK, and sent-back is explicitly penalty-free, so "ruins" has no teeth. | Resolved as SENT_BACK [A-21]; note the card is weaker than its name. |
| **"At all odds"** (Handwash basket) | Idiom, not a rule. | Resolved as unconditional [A-16]. |
| **Tier 3/4 linen exclusion** | See §7.1. | Blocking. Resolved by [A-11]. |

### 7.5 Self-contradictions and tensions (non-blocking)

1. **Tier 2 contradicts the stated governing principle.** "Dark taints light" is false at tier 2.
   The principle should be restated as *"shoes outrank clothes; within a rank, dark outranks
   light"* — which is exactly what the four tiers encode. The slogan, not the rule, is wrong.
2. **"No capacity limit" versus the crowding rule.** These coexist fine, but the crowding rule
   *is* a soft capacity limit of 2 per type. Rules text should say so, or players will read "no
   capacity limit" and be surprised.
3. **Blanket exclusivity versus mandatory loading.** A player rolling a 3 whose hand is
   `{blanket, blanket, shirt}` and who faces a board with no empty machine can load only the
   shirt. §4.7 plus [A-12] handle this (load as many as legal), but it must be stated or
   implementations will throw.
4. **"10 items to wash" versus the real expected 11.05.** The brief's headline understates the
   game length by ~10%. Cosmetic but worth correcting in player-facing text.
5. **A blanket in an ON machine is a free win.** Blankets are always alone, always take their own
   tier, always wash. The *only* counterplay is a keyholder turning the machine off, a Coloring
   attached to it, a Gang, or a roll-4 displacement. That is thin, and there are 2 blankets per
   player. Expect blankets to be the first two items every player washes. **Playtest flag, not a
   bug.**
6. **The keyholder gets three distinct advantages** (sole power toggle, sole event access, first
   position in every phase under [A-14]) for one day in `P`. With 6 players that is a strong,
   rare, and possibly swingy burst. Worth watching.

### 7.6 Hand-resolvability audit

| Requirement | Status |
|---|---|
| No hidden bookkeeping | **PASS**, given [A-05] (bedding tokens public). The only persistent per-item state in the game is bedding's counter, and it rides visibly on the card. |
| All reckoning inputs visible at the machine | **PASS.** `RESOLVE_MACHINE` reads only the machine's loaded items and attached cards. Nothing else. A player can resolve a machine by looking at it. |
| Bounded per-machine scan | **PASS.** Four passes over the drum: pick the tier, check underwear isolation, count types for crowding, check Coloring/catcher ownership. All four commute (§5.1), so a table can do them in any order and get the same answer — this is the property that makes it hand-resolvable at speed. |
| Deterministic, replayable | **PASS**, given seeded RNG for the die, the special item deck, the event deck, and the opening deal. Machine index order (§3.1 Phase 4) is fixed only for replay tidiness; results are order-independent. |
| Pure reducers | **PASS.** `RESOLVE_MACHINE` is pure. The only impure steps in a day are the four RNG draws (Phase 1 die × P, Phase 3b die, deck draws), all of which boardgame.io's seeded `ctx.random` covers. |

**[CONFLICT] — the two places the goals diverge:**
- **[OQ-18] special item phase simultaneity.** Simultaneous secret play is the better game and
  requires a commit/reveal sub-phase that a physical table handles with fists-in-the-middle but a
  reducer handles with an extra hidden-state stage. v0.1 chooses sequential for implementation
  simplicity; this is a real design cost, not a neutral choice.
- **[OQ-19] hidden hands.** Hidden hands are good for the game and mean the digital version needs
  boardgame.io `playerView` stripping — routine, but it also means an MCTS bot has imperfect
  information and needs determinization. Making hands public would simplify both bots and the
  physical game at real cost to tension. v0.1 keeps them hidden.

---

## 8. SIGN-OFF CHECKLIST

Ordered by how much downstream work depends on the answer.

| Priority | ID | Question | v0.1 default |
|---|---|---|---|
| **P0** | OQ-09 | Do tiers 3/4 include linen? *(game is unwinnable if no)* | **Yes** [A-11] |
| **P0** | OQ-30 | What does Jimothy do? | **Null event** |
| **P0** | OQ-04 | Special item deck composition | **15 cards, 3 each** [A-04] |
| **P1** | OQ-07 | `kind` for crowding | **type only** [A-07] |
| **P1** | OQ-01 | 16 or 18 cards per color | **18** [A-01] |
| **P1** | OQ-12A | Is loading mandatory? | **Yes, maximal** [A-12] |
| **P1** | OQ-17 | Crowding after tier, no re-trigger? | **Yes** [A-17] |
| **P1** | OQ-21 | Coloring after tier, no removal? | **Yes** [A-21] |
| **P1** | OQ-16 | Handwash basket scope | **Effect; own items only; unconditional** [A-16] |
| **P2** | OQ-11 | Keep the tier-2 inversion? | **Keep** |
| **P2** | OQ-10 | Cards persist on OFF machines? | **Yes** [A-10] |
| **P2** | OQ-28 | Gang empties OFF machines? | **Yes** [A-28] |
| **P2** | OQ-22 | Electricity retains or sends back? | **Retains** [A-22] |
| **P2** | OQ-06 | Bonus roll unconditional? | **Yes; non-6 does nothing** [A-06] |
| **P2** | OQ-14 | Acting order within a phase | **Keyholder first, then clockwise** [A-14] |
| **P2** | OQ-26 | Wash net overrides the ladder? | **No, isolation only** [A-26] |
| **P3** | OQ-18 | Special phase sequential or simultaneous? | **Sequential** [A-18] |
| **P3** | OQ-19 | Hidden hands? | **Yes** [A-19] |
| **P3** | OQ-05 | Bedding progress public? | **Yes** [A-05] |
| **P3** | OQ-15 | Blankets displaceable by a 4? | **Yes, into empty machines only** [A-15] |
| **P3** | OQ-02/03/08/12B/13A/20/23/24/25/27/29/09B | Minor | as listed in §6 |
| **P3** | §7.2 | Does the game need a termination guarantee? | **None added; flagged** |
