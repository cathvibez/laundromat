> ## ⚠ SUPERSEDED IN PART — written against Design Brief **v8**
>
> The brief is now at **v9** and this document has **not** been regenerated. It remains the
> best formal account of the reckoning algorithm, the invariants and the worked examples,
> all of which are unchanged. It is **stale** on:
>
> - **§3.1 / [OQ-09] turn order.** It recommends roll → extra → load → card. The designer
>   resolved this as **roll → card → load → extra**, and that is what both implementations do.
> - **§3.1 Phase 2 / §5.4 event timing.** It assumes events always resolve after all turns.
>   There are now three arms (E1 immediate / E2 deferred / E3 split); the prototype defaults
>   to **E1**. Open.
> - **§6.7 / [OQ-10] Wash net.** Narrowed-to-underwear is gone. The card is now the **Mesh
>   bag**: everything you load that turn washes, any type. Open sub-questions remain.
> - **§5.3 / §8.2 Circuit break.** Still open; the prototype defaults to arm **V3**, and
>   §8.2's analytical prediction was measured to be off by more than 2× (`sim/out/
>   experiment-A-circuit-break.txt`).
> - **§2.5 special item deck.** Manufacturing fixes the deck at **exactly 20 cards**.
> - **§3.1 acting order.** It says keyholder-first — and that is now **correct and settled**
>   (brief v9 §4; `web` ships `keyholderFirst: true`). `sim/rules.py` still runs fixed seat order
>   and is the one behind. *(Corrected 2026-08-06; this line previously said both implementations
>   used fixed seat order.)*
>
> **Current ground truth:** `design/game-brief.md` (v9).
> **Where the three implementations disagree:** `design/implementation-status.md`.

# Laundromat — Formal Rules v0.4

**Supersedes:** `rules-v0.1.md`, `v0.2`, `v0.3` (all retained on disk unchanged).
**Formalizes:** `design/game-brief.md` — Design Brief **v8**.
**Informed by:** `design/simulation-run-1.md` (v5-rules run; see §0.2 on which of its numbers still
transfer), and `design/comparables.md` (referenced as **[C-risk-n]** / **[R-n.n]**).

**Status change that matters:** the game has now been **physically playtested many times and the
core loop is confirmed fun.** This document treats the design as validated at the table. Where my
analysis and a table observation disagree, the table wins and my job is to explain the model's
error — see §2.4, which is exactly that case.

**Tags.** **[A-nn]** assumption I introduced, collected in §7. **[!]** integrity problem, §8.
**[CONFLICT]** hand-resolvability vs implementation. **[v8]** changed this pass.

**Corrections log.** This document is superseded in places by brief v9; the corrections below fix
statements that were *wrong or stale*, not statements that were merely overtaken.

| Date | Where | What |
|---|---|---|
| 2026-08-06 | §3.1, §3.2 rows 1–4, §4.3 [A-03] | **Turn order was wrong.** The document had roll → extra → load → card. The settled order is **roll → card → load → extra** (brief v9 §4; `sim/rules.py` [A-W03]; `web` `turnOrder: 'cardLoadExtra'`). The roll-4 move therefore happens *after* the load. |
| 2026-08-06 | §6.13 Table A row 14 | **Verdict was wrong.** The row claimed a Sanitizer put a machine holding dark shoes on tier 4 and sent the shoes back. Sanitizer suppresses the two *shoe* rungs only, so a dark shoe is still a dark item and tier 3 fires on it — contradicting §6.10 of this same document. Replaced with a board that does support the row's point. |

---

## 0. WHAT CHANGED, AND WHAT THE SIM STILL TELLS US

### 0.1 Deltas from v0.3

| # | Change | Consequence |
|---|---|---|
| 1 | **Five phases**; the separate special-item phase is deleted — card play folds into each player's own turn. Events resolve **before** the key phase. | §3. The keyholder now genuinely gets the last word before reckoning. |
| 2 | **Events revealed on draw.** The face-down pending-event object is gone. | My v0.3 [OQ-05] recommendation, adopted. Creates a new turn-order information asymmetry (§5.4). |
| 3 | **Loading is mandatory** again. "Up to N" deleted. | Restores the forcing function I flagged as lost in v0.3 §7.2. Justified by measurement (§0.2). |
| 4 | **Handwash basket deleted.** | Removes what I identified as the only monotone progress ratchet. Re-examined in §8.3 — and it makes the reckoning a **pure conjunction with no exceptions** for the first time (§6.1). |
| 5 | **Bedding removed.** 7 types × 2 shades = **14 cards/color**, draw 10 of 14. | §2.1. Linen-blockage class of bug re-checked in §2.3 — **clean**. |
| 6 | **Socks may share a machine with a blanket**, and then need one extra wash. | The only exception to blanket exclusivity. State representation and auditability worked out in §6.9. |
| 7 | **Gang** permanently destroys one washer, once per game, card left as a marker. | Monotone reduction of `M`. §8.5. |
| 8 | **Circuit break** (was Electricity) switches **every** washer OFF. | **The most consequential change in v8, and not in a good way — §8.4.** |
| 9 | **Jimothy: fright deleted.** Leaves only via Snacc or Animal control, which has moved to the event deck. | Roughly **doubles his mean squat** (§5.5). |
| 10 | **Event deck fixed and final:** 4 cards, one each. | Closes "Jimothy drawn while in play" by construction. Also produces a self-correcting counter-probability (§5.5) and a nasty late-game concentration (§8.4). |
| 11 | **Sanitizer** and **Coin** added. | §6.10, §4.4. Both have open questions; recommendations in §7. |
| 12 | **Wash net narrowed** to underwear loaded on the same turn. | §6.7 — needs a physical association between card and items. |
| 13 | **Draw two, keep one** for special items. | Substantially fixes the dead-card problem I flagged in v0.3 (§5.6). |
| 14 | **Victory:** first to 10 wins, game ends immediately, simultaneous victory allowed; rotation-completion rule deleted. | My v0.3 §7.4 proof adopted. One residual ordering hazard, §8.6. |
| 15 | Machines back to **P+1**, capacity flat **4**. | §2.2, §2.4. |

### 0.2 Which simulation numbers still transfer

The archived run used v5 rules. Its provenance header is honest about this; here is my reading of
what survives.

| Finding | Transfers? | Why |
|---|---|---|
| **realized `L` correlates −0.90 with game length**; short games `L=1.178`, long games `L=0.245` | **YES — the single most important result in the file** | A behavioural relationship between loading rate and length, independent of the rules that changed. It is the direct justification for mandatory loading. |
| **Capacity contention data** (`machine-days at capacity` 5.4–11.5%; `load offers with a full machine` 6.7–26.2%) | **YES, and it is decisive** | See §2.4 — this data **already refutes** the mean-occupancy model, and it was in the file all along. |
| **Crowding fires 0.0–1.1% of reckonings** | **YES, directionally** | Capacity and type-count are similar; v8 raises `L` so it will rise, but stays rare (§8.7). |
| Jimothy uptime 28.9–31.0%, squat 2.07–2.54 days | **NO — underestimates** | Fright accounted for 19–32% of departures and is now deleted; relocate (9–16%) is impossible with a one-card deck. Recomputed in §5.5. |
| Game length (GREEDY 12.6–17.7 days) | **Partially** — usable as a scaling base only | Machine counts, Gang, Electricity, and Animal control all changed. Rescaled in §8.3. |
| Handwash basket 9.85–28.29 plays/game; **corr +0.919 with length** | Historical only | The card is deleted. Note the correlation is mostly length *causing* basket plays, not the reverse. |
| NAIVEKEY long games (median 42 days) | **NO** | Diagnosed as an OFF-drift artefact of a deliberately weak policy. **But see §8.4** — v8's Circuit break creates a rules-level version of exactly that pathology, so the artefact is worth re-reading as a warning. |
| Seat-order edge (up to 5.09pp at P=3) | **Probably** | Turn order still matters and v8 adds an event-information asymmetry (§5.4). |
| `occ.txt` | **Void** — produced no output | Occupancy figures in the file come from `cont.txt`. |

---

## 1. GLOSSARY

### 1.1 Canonical terms

| Term | Status | Definition |
|---|---|---|
| **item** | **CANONICAL** | The atomic unit of laundry: one card. Attributes `owner`, `shade` (`dark`\|`light`), `type` (one of seven, §2.1), `id`, and — socks only — `damp` (§6.9). The brief's §1 confirms "**Item** = any of the above. The reckoning tiers operate on **items**." |
| **garment** | **ALIAS — deprecated** | Still used in the brief for the roll of 4 and the crowding rule. Treat as *item*. Do **not** read it as "clothes but not linen": under that reading a roll of 4 could not move a blanket, which is arbitrary. [A-01] |
| **clothes** | **CANONICAL (category)** | `{shoes, socks, pants, shirts, hats}`. Taxonomy and flavour only — no rule references it. |
| **linen** | **CANONICAL (category)** | `{underwear, blanket}`. **[v8]** Bedding removed. Also taxonomy only; the two linen constraints name their types directly. |
| **shade** | **CANONICAL** | `dark` \| `light`. Intrinsic, printed, never mutated. |
| **effective shade** | **CANONICAL** | The shade an item is treated as having for one reckoning of one machine, after Bleach. Never persists. |
| **type** | **CANONICAL** | One of the seven values in §2.1. The crowding rule's equivalence class. |
| **machine / washer** | **CANONICAL** | The brief uses both; **machine** is canonical, *washer* an alias. Board zone with identity, `power ∈ {ON, OFF}`, up to **4** items, attached special item cards, and possibly Jimothy or the Gang marker. Fully public. |
| **capacity** | **CANONICAL** | 4 items per machine at every player count. Counts **items only** — Jimothy occupies no slot [A-12]. |
| **destroyed** | **CANONICAL, NEW [v8]** | A machine removed from the game permanently by Gang. It is not OFF; it does not exist. It cannot be loaded, reckoned, toggled, or targeted by anything. The Gang card sits on it as a marker. |
| **loaded** | **CANONICAL** | An item is loaded iff it is in a machine. Public. |
| **washed** | **CANONICAL** | Terminal verdict: the item leaves play to its owner's **clean pile** and counts toward victory. Damp socks excepted (see *wash event*). |
| **wash event** | **CANONICAL** | One successful wash of one item by one machine. For every item except socks-alongside-a-blanket, one event = clean. |
| **damp** | **CANONICAL, NEW [v8]** | A socks card that has received a wash event in a machine that contained a blanket. It is not clean and needs one further wash event. The only persistent per-item state in the game. §6.9. |
| **sent back** | **CANONICAL** | Terminal verdict: removed to the owner's **hand**, no penalty. A damp socks card stays damp. |
| **retained** | **CANONICAL** | Non-verdict: the item stays loaded into the next day because its machine did not run (power OFF). |
| **hostage** | **CANONICAL** | An item in Jimothy's machine. **Derived, never stored:** `isHostage(i) ≡ jimothy ≠ null ∧ i.machine == jimothy.machine`. Frozen until he leaves. |
| **released** | **CANONICAL** | What happens to hostages when Jimothy leaves: **sent back to owners' hands, unwashed.** Release is never a wash. |
| **day** | **CANONICAL** | = round. One pass of §3's five phases. |
| **reckoning** | **CANONICAL** | Phase 4: independent resolution of every ON, Jimothy-free, undestroyed machine. |
| **turn** | **CANONICAL, NEW MEANING [v8]** | One player's action block inside the roll phase: roll, load, optionally play one special item card, plus any face-specific extra. Card play is no longer a separate phase. |
| **turn order** | **CANONICAL** | Fixed clockwise seating, set at setup, never changes. |
| **acting order** | **CANONICAL** | Order within the roll phase: keyholder first, then clockwise [A-09]. |
| **keyholder** | **CANONICAL** | Holder of the key for the current day. Passes at end of day. |
| **hand** | **CANONICAL** | Unloaded, unwashed items plus **ready** special item cards. Hidden [A-10]. |
| **fresh** | **CANONICAL** | Face-up zone holding special item cards drawn **today**. Cannot be played. Promotes wholesale at end of day. Card identity here is **public**. |
| **ready** | **CANONICAL** | Cards drawn earlier. Playable, held hidden. |
| **clean pile** | **CANONICAL** | Public, face-up, per player. Monotone — nothing ever removes a card from it. |
| **must-wash set** | **CANONICAL** | The exactly 10 items dealt at setup. Fixed for the game. |
| **event** | **CANONICAL** | One of four cards, drawn face-**up** on the first 6 of the day, resolved in Phase 2. |

### 1.2 Eliminated

**garment**, **piece** → *item*. **washer** → *machine*. **kind** → *type*. **bedding**, **Handwash
basket**, **Electricity**, **fright**, **pending event**, **rotation** → all removed from the game;
retained here only as history. The word **basic** in the taxonomy table carries no meaning; dropped.

---

## 2. COMPONENT MANIFEST

### 2.1 Item types — **[v8] bedding removed**

| `type` | category | per shade | per color |
|---|---|---|---|
| `shoes` | clothes | 1 | 2 |
| `socks` (a pair, one card) | clothes | 1 | 2 |
| `pants` | clothes | 1 | 2 |
| `shirts` | clothes | 1 | 2 |
| `hats` | clothes | 1 | 2 |
| `underwear` | linen | 1 | 2 |
| `blanket` | linen | 1 | 2 |
| **TOTAL** | | **7** | **14** |

A color holds at most **2 cards of any type** (one per shade) and **1 of any (type, shade)** —
unchanged, and still what makes the crowding rule's `type` reading the only workable one.

### 2.2 Machines and board totals

`M = P + 1`; capacity 4, flat.

| Players | Machines | Board capacity | Items in play | Dealt | Undealt (inert) |
|---|---|---|---|---|---|
| 3 | 4 | 16 | 42 | 30 | 12 |
| 4 | 5 | 20 | 56 | 40 | 16 |
| 5 | 6 | 24 | 70 | 50 | 20 |
| 6 | 7 | 28 | 84 | 60 | 24 |

**[A-02]** The 4 undealt cards per color are set aside face-down and inert.

**[v8] note:** each player now misses only **4 of their 14** cards, down from 6 of 16 and 8 of 18.
Deals are far more uniform than in any previous version — nearly every player holds nearly
everything. That materially reduces deal variance as a source of unfairness, which is a quiet
improvement worth recording.

### 2.3 Deal statistics, and the linen-blockage re-check

`C(14,10) = C(14,4) = 1001`. Linen is 4 cards (2 underwear, 2 blanket); clothes 10.

```
P(dealt zero linen)      = C(10,10)·C(4,0)/1001 =    1/1001 = 0.0999%
P(dealt ≥1 blanket)      = 1 − C(12,10)/1001    = 1 − 66/1001 = 93.41%
P(dealt both blankets)   = C(12,8)/1001          =  495/1001 = 49.45%
P(dealt exactly one)     =                          440/1001 = 43.96%
   check: 0·0.0659 + 1·0.4396 + 2·0.4945 = 1.4286 = 10×2/14 ✓
P(dealt ≥1 underwear)    = 93.41%   P(both) = 49.45%     (identical, both 2-card types)
P(dealt ≥1 socks)        = 93.41%   P(both) = 49.45%
E[linen per player]      = 10 × 4/14 = 2.857
E[blankets] = E[socks] = E[underwear] = 10 × 2/14 = 1.4286
```

**Linen-blockage re-check — CLEAN. [!]-free for the first time.**

My original P0 was that no tier could ever wash linen, making the game unwinnable in
7999/8000 deals. That is fixed (tiers operate on all items). With bedding gone and socks carrying a
*conditional* two-wash, I re-derived the whole class of bug from scratch:

> **Solo-wash guarantee.** Every item in the game washes when loaded **alone** into an ON,
> Jimothy-free, undestroyed machine:
>
> | Item loaded alone | Tier that fires | Washes? |
> |---|---|---|
> | dark shoes | 1 | ✓ |
> | light shoes | 2 (no dark shoes present) | ✓ |
> | any other dark item | 3 | ✓ |
> | any other light item | 4 | ✓ |
> | underwear | 3 or 4 | ✓ — isolation is trivially satisfied, nothing else is present |
> | blanket | 3 or 4 | ✓ — exclusivity is trivially satisfied |
> | socks | 3 or 4 | ✓ — **one** event, since no blanket is present |
>
> Crowding needs 3+ of a type and cannot fire on one item.
> **Therefore no item is structurally unwashable, and no player can be dealt a hand they cannot in
> principle complete.**

The new socks rule does **not** reintroduce the bug, because the two-wash requirement is
**opt-in**: socks need a second wash only if their owner *chose* to load them with a blanket. A
player who never does that never encounters it.

One residual risk, not a blockage but worth naming: **mandatory loading means a player cannot
always choose to load alone.** A roll of 3 forces three placements. With `M = P+1 ≥ 4` machines
there is normally somewhere sensible, but §8.4 shows Circuit break can shrink the usable set to
near zero, at which point forced loading becomes forced self-harm. That is a *balance* failure, not
a *correctness* one — the item is still washable in principle.

### 2.4 **Occupancy: why the model said "no contention" and the table says otherwise**

The designer reports capacity 4 **is** reached at the table, and players are forced into a third
washer, especially after Gang destroys one. The coordinator's occupancy model predicted average
occupancy far below capacity and concluded contention was too low. **The table is right and the
model is wrong.** Here is the arithmetic, and then five reasons the model missed it, ranked.

**Step 1 — the load rate is now exactly 1.5, and it is mandatory.**
`E[L] = (1+2+3+1+1+1)/6 = 9/6 = 1.5` items per player per day. Every face loads; loading is
compulsory; the only shortfall is a hand shorter than the roll, which is rare until the endgame.
So realized `L ≈ 1.45–1.5`, against `1.09–1.22` for the sim's GREEDY policy under optional loading
— **a 23–38% increase**, and against `1.0` in the old mandatory table — a 50% increase.

**Step 2 — the naive model.** `O = L·P/M` with `M = P+1`:

| P | M | `O = 1.5P/(P+1)` |
|---|---|---|
| 3 | 4 | 1.125 |
| 4 | 5 | 1.200 |
| 5 | 6 | 1.250 |
| 6 | 7 | 1.286 |

Against capacity 4 this looks like a board with room to spare. **That conclusion does not follow,
for five independent reasons.**

---

**Reason 1 — the simulation's own data already refutes it, and this is decisive.**

From `cont.txt`, GREEDY policy:

| P | measured occupancy | machine-days at capacity | **load offers facing a full machine** |
|---|---|---|---|
| 3 | 1.12 | 5.6% | 6.9% |
| 4 | 0.87 | 9.0% | **13.0%** |
| 5 | 0.89 | 9.8% | **18.7%** |
| 6 | 0.72 | 10.3% | **21.4%** |

At a **measured mean occupancy of 0.72** — one fifth of capacity — **more than one load offer in
five already faced a full machine.** The refutation was in the run all along; the mean-occupancy
summary buried it. Any model whose output is a single mean and whose conclusion is "capacity never
binds" is contradicted by the same file's contention table.

**Reason 2 — capacity is tested at the day's peak, not its mean.**

All loading happens in Phase 1. Reckoning is Phase 4. **Nothing leaves a machine between the first
load of the day and the last.** So the occupancy that capacity actually tests is
`carryover + full day's inflow`, measured at the end of the roll phase. A day-averaged statistic
includes the post-reckoning empty state and therefore systematically reports roughly half the
number that matters. This is a modelling error, not sampling noise — and it explains the gap
between the sim's *predicted* 1.635 and *measured* 0.72 at P=6 (the measurement was time-averaged
across a state that is empty for part of every day).

**Reason 3 — the mean is not what binds; the tail is. And the model's tail is a floor, not an
estimate.**

Even under Poisson allocation — items thrown at machines independently and uniformly, which is the
**least clustered arrangement possible** — capacity bites:

| P | O | `P(a given machine ≥ 4)` | **`P(≥1 machine at capacity on a day)`** |
|---|---|---|---|
| 3 | 1.125 | 2.76% | **10.6%** |
| 4 | 1.200 | 3.38% | **15.8%** |
| 5 | 1.250 | 3.83% | **20.9%** |
| 6 | 1.286 | 4.17% | **25.8%** |

*(worked for P=6: `e^−1.286 = 0.2765`; `1 + 1.286 + 0.827 + 0.354 = 3.466`; product `0.9583`;
so `P(≥4) = 0.0417`; `1 − 0.9583⁷ = 0.258`.)*

Note how closely the Poisson floor tracks the sim's measured "load offers facing a full machine"
(10.6/15.8/20.9/25.8 predicted vs 6.9/13.0/18.7/21.4 measured at *lower* `L`). **Uniform spreading
is the minimum-contention allocation; any clustering strictly fattens the tail.** So the model
does not estimate contention — it lower-bounds it.

**Reason 4 — `M_eff` is materially below `M`, and v8 made this much worse.**

Machines leave the usable pool four ways:

- **Gang destroys one permanently.** `M → M−1` for the rest of the game. It is 1 of 4 event cards
  and fires once; expect it early-to-mid game. This is the effect the designer specifically
  observed ("especially after Gang destroys one") and the model omits it entirely.
- **Jimothy** occupies one and it cannot be loaded. Uptime under v8 is **~38–41%** (§5.5), roughly
  a third higher than the sim's fright-era 29–31%.
- **Circuit break** switches every machine OFF, and the keyholder restores only **one per day**.
  §8.4 computes the steady state: **E[ON] is only 27–57% of the board.** This is by far the largest
  reducer and it is new in v8.
- **Blankets** monopolise a machine (only socks may join). 93.4% of players hold at least one;
  `E = 1.43` per player.

Late game at P=6 (`M=7`, Gang fired → 6, Circuit-break steady state ≈ 27% ON → **~1.6 machines
running**), the effective divisor is not 7. `O_eff = 9 / 2 ≈ 4.5`. **That is above capacity.**

**Reason 5 — the game rewards clustering, so bots that spread are not approximating human play,
they are inverting it.**

This is not a behavioural quirk to be smoothed over; it is a consequence of the reckoning rule.
**Tiers 3 and 4 wash every dark (or every light) item in the machine together.** If a machine
already holds dark items and you hold dark items, loading yours there is *strictly better* than
opening a fresh machine — you get a free ride on a tier that is already going to fire. A
spread-to-avoid-collisions heuristic systematically declines the best move in the game.

Compounding it: **machines are not interchangeable.** On any given day some are OFF, one may hold
Jimothy, one may hold a blanket, one may be destroyed, one may have a Coloring attached. The
*choice set* a player actually faces is much smaller than `M`, and everyone faces the same reduced
set, which concentrates load further.

---

**Plain answer to the question asked: yes, the flat capacity of 4 binds.**

It binds routinely, and it binds harder under v8 than under the rules the simulation measured,
because `L` rose from ~1.1 to 1.5 while `M_eff` fell (Gang's permanent destruction, Jimothy's
longer squats, and above all Circuit break). The designer's table observation is correct. The model
was not wrong in its arithmetic — `1.5P/(P+1)` is right — it was wrong in **choosing the mean as
the test statistic**, in **measuring across the whole day rather than at the load-time peak**, in
**using `M` rather than `M_eff`**, and in **assuming spreading when the rules reward clustering**.

**One caveat in the other direction, for honesty:** at 3–4 players, before Gang has fired and with
no Circuit break in effect, `O ≈ 1.1–1.2` across 4–5 machines really is loose, and capacity will
bite only in the tail (~11–16% of days). The binding case is *mid-to-late game at higher player
counts*, which is exactly when the designer reports feeling it.

### 2.5 Special item deck — **P0, deliberately unresolved**

**Seven types [v8]:** Coloring, Color catcher, Bleach, Wash net, Snacc, **Sanitizer**, **Coin**.
(Handwash basket deleted; Animal control moved to the event deck.) Copy counts remain **P0 and are
not proposed here** — §9 states what the simulation must measure.

Structural facts independent of composition:
- Drawn on a roll of 5: **draw two, keep one, other to the bottom of the deck.**
- Played from hand on your own turn, at most one per turn, never the day it was drawn.
- After play, shuffled back into the deck. No discard pile.
- Draw rate `P/6` per day (0.50 at 3 players → 1.00 at 6), unchanged across every brief version.

**[v8] Draw-two-keep-one substantially fixes the dead-card problem I flagged in v0.3.** Snacc is
dead whenever Jimothy is absent (~60% of days). With a single draw you were stuck with it; with two
you almost always have an alternative. The probability of being *forced* to take a dead card is
now `P(both draws are dead types)`, which for one dead type in seven is small. This is a good,
cheap fix and it should be noted as such.

### 2.6 Event deck — **fixed and final [v8]**

**Exactly four cards, one copy each: Gang, Circuit break, Jimothy, Animal control.**

Deck dynamics, which matter more than they look:

| Card | Returns to deck? |
|---|---|
| Gang | **Never.** Removed permanently after use. |
| Circuit break | Yes, after resolving. |
| Jimothy | His card sits **on the board** while he is in play; returns when he leaves. |
| Animal control | Yes, after resolving. |

So deck size ranges 2–4 and **can never be empty** (Circuit break and Animal control always
return). Two consequences worth flagging now and analysing later:

- **[+] The counter-probability is self-correcting.** When Jimothy is in play his card is out of
  the deck, so Animal control's share *rises exactly when it is needed* — up to 1-in-2 once Gang is
  also gone. That is an elegant property of the fixed deck and closes the "how do we guarantee a
  counter" problem by construction. Good design.
- **[!] The late-game deck concentrates into Circuit break.** Once Gang is spent and Jimothy is on
  the board, the deck is `{Circuit break, Animal control}` — **every second event is a Circuit
  break.** §8.4 shows why that is the most serious problem in v8.

**One Jimothy card closes the "drawn while already in play" question by construction** — my v0.3
[OQ-14] is now moot.

### 2.7 Other components

| Component | Count | Purpose |
|---|---|---|
| Key | 1 | Marks the keyholder. |
| Die | 1 (d6) | Once per player per day. The only randomiser besides the two decks. |
| Machine power markers | M | ON/OFF. |
| Jimothy figure | 1 | Token. Two locations: on a machine, or off-board. |
| Gang marker | — | The Gang card itself, left on the destroyed washer. Self-documenting. |
| **Damp tokens** | 2 per player | Mark a socks card that needs one further wash (§6.9). **The wash tokens freed by deleting bedding are exactly the component the new socks rule needs** — no new component is required. |
| Fresh-zone marker | 1 per player | Separates fresh (face-up) from ready (hidden). |
| Capacity slots | printed | 4 slots per machine mat make capacity self-enforcing. Recommended. |

---

## 3. ROUND STATE MACHINE

### 3.1 Phase list — **[v8] five phases**

**PHASE 1 — ROLL**
- *Actors:* every player once, in acting order (keyholder first, then clockwise [A-09]), sequentially.
- *Each player's turn, in this order [A-03] — **corrected 2026-08-06**, see below:*
  1. Roll 1d6.
  2. Optionally play **one** special item card from the **ready** hand.
  3. **Load exactly the number rolled** (§4.2), or as many as legally possible.
  4. Resolve the face's extra action, if any (§4): move an item (4), draw two/keep one (5), or draw
     and immediately reveal an event (6).

  > This list previously read roll → extra → load → card. That ordering is **superseded**: brief v9
  > §4 settles the turn as **roll → card → load → extra**, and it is what `sim/rules.py` `[A-W03]`
  > and `web/src/rules/config.ts` (`turnOrder: 'cardLoadExtra'`) both implement. Card play must
  > precede loading or the *Mesh bag* cannot function at all — the bag has to be open before the
  > laundry goes in. Two consequences: the roll-4 move happens **after** you load (§4.3), and an
  > event drawn on a 6 is revealed after that player has already loaded.
- *Constraints:* one card per player per turn; fresh cards are unplayable; the Coin, if one-shot
  [A-15], is played here like any other card.
- *Exit:* every player has taken a turn.

**PHASE 2 — EVENT RESOLUTION**
- *Effect:* the event revealed during Phase 1, if any, resolves now (§6.11). Then it returns to the
  deck — **except Gang, which is left on the destroyed washer.**
- *Actor:* none for Circuit break and Animal control. **Gang and Jimothy each require one choice** —
  which machine — made by the player who drew the card [A-13].
- *Exit:* resolved, or no event this day.

**PHASE 3 — KEY**
- *Actor:* keyholder only. Turn one machine ON, turn one machine OFF, or pass.
- **[v8] The keyholder now acts after the event**, so they get the last word before reckoning. This
  is a real improvement: the key's single action is now taken with complete information.
- *Exit:* acted or passed.

**PHASE 4 — RECKONING**
- *Effect:* for each machine in ascending index order, run `RESOLVE_MACHINE` (§6.2). Machines are
  mutually independent; index order exists only for replay tidiness and orderly table procedure.
- *Post-effect:* every ON, Jimothy-free, undestroyed machine is empty of items. Special item cards
  attached to those machines shuffle back into the deck; cards on OFF or Jimothy machines stay
  attached [A-06].
- **[!] The full reckoning must complete before any victory is declared** — §8.6.
- *Exit:* all machines resolved.

**PHASE 5 — END OF DAY**
1. **Victory check.** Any player whose clean pile equals their must-wash set wins. **If several
   qualify, they all win together.** If anyone wins, the game ends here.
2. **Fresh → ready.** Every card in every fresh zone promotes.
3. **Key passes** to the next player in turn order.
4. `round += 1`.

### 3.2 State-transition table

| # | State | ctx.actor | Legal moves | Guard | Next | Exit |
|---|---|---|---|---|---|---|
| 0 | `DAY_START` | — | — | — | `TURN(0)` | auto |
| 1 | `TURN(i).roll` | `order(k)[i]` | `rollDie()` | not yet rolled today | `TURN(i).card` | rolled |
| 2 | `TURN(i).card` | `order(k)[i]` | `playSpecial(cardId, target…)` or `pass()` | card ∈ **ready**; ≤1 this turn | `TURN(i).load` | played/passed |
| 3 | `TURN(i).load` | `order(k)[i]` | `loadItem(itemId, machineId)` × `n`, `n = min(face', handSize, legalPlacements)` where `face' = face if ≤3 else 1` | item ∈ hand or damp zone; `machineAccepts` (§4.6) | `TURN(i).extra` | `n` loads done |
| 4 | `TURN(i).extra` | `order(k)[i]` | face 4: `moveItem(id,from,to)`; face 5: `drawTwoKeepOne(keepId)`; face 6: `drawEvent()` (auto-reveal); faces 1–3: none | move: item loaded, `¬isHostage`, `to ≠ from`, `machineAccepts(to)`; face 6: `revealedEvent == null` else no-op | `TURN(i+1)` or `EVENT` | resolved |
| 5 | `EVENT` | drawer (Gang/Jimothy only) | `resolveEvent(choice?)` | `revealedEvent ≠ null` else skip | `KEY` | resolved |
| 6 | `KEY` | keyholder | `setPower(machineId, ON\|OFF)` or `pass()` | machine not destroyed; new ≠ old | `RECKON(0)` | acted/passed |
| 7 | `RECKON(j)` | — | `resolveMachine(M[j])` | — | `RECKON(j+1)` or `END_OF_DAY` | `j > M` |
| 8 | `END_OF_DAY` | — | victory → promote → key passes → `round++` | — | `GAME_OVER` or `DAY_START` | auto |
| 9 | `GAME_OVER` | — | — | — | terminal | — |

**boardgame.io mapping.** The whole of Phase 1 is one `roll` phase with `turn.order` starting at the
keyholder, and each player's turn now contains **up to four ordered sub-moves**, so it needs an
explicit `endTurn` rather than an auto-advance on move count. Phases 2–3 are short phases with a
single actor each. Phases 4–5 take no player input and belong in the `key` phase's `onEnd`.
`RESOLVE_MACHINE` must stay a pure function of `(machine, attachedCards, jimothy)` so it is
unit-testable outside the framework.

**[v8] The hidden-from-everyone state is gone.** Events are revealed on draw, so there is no
`G.secret` and no all-clients `playerView` strip. The only private state is players' hands and
ready cards — routine. This is a genuine implementation simplification.

### 3.3 Turn-order information asymmetry — new and worth naming

Because the event is revealed **the moment it is drawn**, and drawing happens mid-Phase-1:

- Players who act **after** the drawer take their turn knowing the event.
- Players who acted **before** the drawer did not.
- Everyone knows it before the key phase and before reckoning.

So a 6 rolled by the last player is nearly information-free; a 6 rolled by the first player informs
everyone else's whole day. **[A-04]** This is accepted as intended — it is a natural consequence of
open information and it is *strictly better* than v0.3's face-down card, under which nobody could
plan around anything. Under [A-09] the acting order rotates daily with the key, so the advantage
is not fixed to a seat. Flagged for measurement (§9.4), not for change.

---

## 4. DICE OUTCOME TABLE

One die, once per player per day. **Every face loads. Loading is mandatory.**

### 4.1 Full table

| Face | Effect | Precise rule | Degenerate cases |
|---|---|---|---|
| **1** | Load 1 | Load exactly 1 item from hand. | Hand empty → 0. No legal placement → as many as legal [A-05]. |
| **2** | Load 2 | Exactly 2. Independently targeted; may go to different machines [A-05]. | Hand holds 1 → load 1. |
| **3** | Load 3 | Exactly 3. | As above. |
| **4** | Load 1, **and** move one item between machines — **including your own** | The move is optional [A-07]; the load is not. Source ≠ destination; destination must satisfy `machineAccepts`; the item must not be a hostage. It can never leave the machines. | No legal move → skipped; the load still happens. |
| **5** | Load 1, **and** draw a special item card | **Draw two, keep one**; the other goes to the **bottom** of the deck. The kept card enters the **fresh** zone face-up and cannot be played today. | Deck holds 1 → draw and keep it. Deck empty → no draw. |
| **6** | Load 1, **and** draw an event card | **Revealed immediately.** Resolves in Phase 2. Only the first 6 of the day draws; later 6s load only. | An event is already revealed this day → the event half is a complete no-op; the load still happens. |

**`E[L] = (1+2+3+1+1+1)/6 = 1.5`**, mandatory. This is the game's pacing engine and, per §0.2, the
variable most strongly associated with game length.

### 4.2 Mandatory loading — the gap the brief does not cover

The brief says a player loads "fewer only if their hand holds fewer." It does not address the case
where the *board* has no room.

**[A-05] A player loads `min(rolled, handSize, legalPlacements)` items.** If no machine accepts any
held item, they load zero. No penalty, no substitution, no re-roll.

This matters because it is reachable: total board capacity is `4M` = 16–28, daily inflow `1.5P` =
4.5–9, and **Circuit break stops all draining** (§8.4). The board fills in ~3.1–3.6 days with
nothing reckoning. Without [A-05] an implementation throws and a table argues.

Note the socks-and-blanket rule (§6.9) is the one built-in pressure valve here: a blanket machine
that otherwise accepts nothing will still accept socks.

### 4.3 Face 4 — displacement

Unchanged from v0.3 and still correct per [R-3.1(b)]: because it may take *any* item including your
own, it is a positioning tool rather than a mandatory targeted attack.

- **[A-07]** The move is optional; the load is mandatory. **[A-03] — SUPERSEDED, corrected
  2026-08-06.** This clause used to say the move resolves **before** the load, so that a player
  could free a slot and then load into it. That is **not** the turn order the design settled on.
  Brief v9 §4 fixes the turn as **roll → play a card → load → the die's extra effect**, confirmed by
  `sim/rules.py` `[A-W03]` and by `web/src/rules/config.ts` (`turnOrder: 'cardLoadExtra'`, with the
  old reading retained only as a dead ablation switch). **The move therefore resolves *after* the
  load.** You cannot free a slot and then load into it on the same turn. §3.1 of this document is
  stale on the same point.
- **[A-08]** A blanket may be moved, but only into a machine that is empty **or contains only
  socks** — the same exception that governs loading.
- Hostage items cannot be moved (§5.5).
- Destroyed machines are not valid sources or destinations.

### 4.4 The Coin — timing

**[A-15] Recommended: one-shot.** Played from hand on your turn like any other special item; it
turns one machine ON or OFF and returns to the deck.

Three grounds, in order of weight:
1. **Consistency.** Every other special item is a one-shot that returns to the deck; the brief's own
   §6 header says so. A persistent Coin would be the only exception and would need new rules for
   whether it can be stolen, what happens on Gang, and whether it survives the holder winning.
2. **It would gut the key.** The key's *entire* remaining power is toggling one machine per day. A
   permanently held Coin is a second key that never rotates — strictly better than the key, since it
   is not shared. That inverts the game's power structure for whoever draws it.
3. **Rules economy.** "Turn any one machine on or off. You do not need the key." reads cleanly as a
   one-shot; the persistent reading requires the card to say "each turn."

**The counter-argument, and it is real:** a persistent Coin would double Circuit-break recovery from
1 machine/day to 2, materially softening §8.4. **My recommendation is therefore conditional:
one-shot, *provided* Circuit break's recovery problem is fixed on its own terms.** If Circuit break
is left as written, a persistent Coin becomes one of the few available pressure valves and the
choice gets much harder. These two open questions should be decided together, not separately.

Timing note: the Coin is played in Phase 1, so the keyholder (Phase 3) and the event (Phase 2) both
act *after* it and can undo it. That makes the one-shot Coin weaker than it first appears — a point
in favour of it being fine as a one-shot.

### 4.5 Universal no-op rule

Any die outcome that cannot be legally executed is discarded with no effect: no re-roll, no
substitution, no compensation. Covers an empty hand, a full board, no legal move on a 4, an empty
special deck on a 5, and an already-revealed event on a 6.

### 4.6 `machineAccepts(machine, item)` — the sole placement predicate

Governs loads and roll-4 moves identically.

```
machineAccepts(machine, item):
    if machine is DESTROYED                       -> FALSE   # Gang [v8]
    if machine has Jimothy                        -> FALSE
    if occupancy(machine) >= 4                    -> FALSE   # capacity
    if machine contains a blanket:
        return (item.type == socks)                          # [v8] the ONE exception
    if item.type == blanket:
        return (machine is empty)
            or (every item in machine is socks)              # [v8] the same exception, mirrored
    return TRUE
```

`occupancy` counts items only; Jimothy occupies no slot [A-12]. Power state does **not** affect
placement legality — an OFF machine can still be loaded, which is precisely why Circuit break jams
the board rather than merely pausing it (§8.4).

Note the blanket clauses are now **symmetric**: socks may join a blanket, and a blanket may join
socks. Both directions are explicit in the brief and both are needed.

---

## 5. JIMOTHY, EVENTS, AND MACHINE STATE

### 5.1 Machine states — now four, not two

| State | Reckons? | Loadable? | How reached | How left |
|---|---|---|---|---|
| **ON** | yes | yes | default | key, Coin, Circuit break |
| **OFF** | no, retains contents | **yes** | key, Coin, Circuit break | key, Coin |
| **Jimothy** | no, contents hostage | no | Jimothy event | Snacc, Animal control |
| **DESTROYED** | no, permanently | no | Gang | never |

**[!] OFF machines remain loadable.** This is unchanged from every previous version but it becomes
critical in v8 because Circuit break turns *everything* OFF while mandatory loading keeps pushing
items in. See §8.4.

### 5.2 Gang

The drawer picks one machine. Its contents return to their owners' hands. **The machine is out of
the game permanently**; the Gang card stays on it as a marker. Gang happens once per game and never
returns to the deck.

- **[A-13]** The drawer chooses, consistent with the card text ("The drawer picks one washer").
- **[A-14]** A destroyed machine cannot be loaded, reckoned, toggled by key or Coin, chosen by
  Jimothy, or targeted by any card. It is not a machine any more.
- **[A-16]** May Gang destroy the machine Jimothy occupies? **Recommend yes** — nothing forbids it,
  and it is the only interaction between the two. Hostages return to owners' hands (identical to
  release). **Jimothy is *not* removed** — fright is deleted, and Gang destroys the machine, not the
  raccoon. He must be relocated to another machine, chosen by the Gang drawer [A-16]. This case is
  not covered by the brief at all and needs a ruling; see [OQ-06].
- Bedding is gone, so no wash progress can be lost. Damp socks stay damp.

**Structural note:** Gang is the only permanent, monotone change to the board in the game. `M`
decreases by exactly 1, once, forever. That is a real and deliberate escalation of contention — and
it is the specific thing the designer observed forcing players into a third washer.

### 5.3 Circuit break

Every machine switches **OFF**. Machines retain their contents. Power states are otherwise
unchanged; nothing is destroyed; Jimothy is unaffected.

Recovery is the keyholder's one toggle per day (plus a Coin, if one is played). **§8.4 shows this is
the most serious balance problem in v8.**

### 5.4 Animal control

Removes Jimothy outright. Hostages return to their owners' hands, unwashed. His card returns to the
event deck.

**[!] It is a blank if Jimothy is not in play** — the brief flags this. Jimothy's uptime is ~38–41%
(§5.5), so a drawn Animal control does nothing ~60% of the time. **Recommend accepting it** [A-17],
for a reason the brief does not state: because Jimothy's card leaves the deck while he is on the
board, **Animal control's probability rises exactly when it is needed** — from 1-in-4 to 1-in-3 to
1-in-2 as the deck shrinks. The blank draws are the price of a self-correcting counter, and it is a
good trade. See §2.6.

### 5.5 Jimothy

While he is in a machine: it **cannot run** and **cannot be loaded**; items inside are **hostage**,
released to owners' hands (never washed) when he leaves. He leaves **only** via Snacc or Animal
control. Gang and Circuit break do not affect him.

Carried forward from v0.3, still correct and re-verified against v8:

- **[A-11]** He may be placed on a machine holding a blanket, or at capacity, or OFF. He may not be
  placed on a destroyed machine. Capacity and blanket exclusivity govern **items**; he is a token.
- **[A-12]** He occupies no capacity slot.
- **[A-18]** Hostage items cannot be moved out by a roll of 4. Without this, `P(some player rolls a
  4) = 42–67%` per day would let anyone trivially undo him and the mechanic would be decorative.
- **[A-06]** Special item cards may still be attached to his machine; they wait as a long fuse.
- **[A-13]** Placement is chosen by the drawer, consistent with Gang.
- **Hostage items never participate in tier selection or crowding, on any day.** The proof from
  v0.3 §7.5.8 still holds and is now simpler: while he is present the machine is gated at S0; when
  he leaves (Phase 1 via Snacc, or Phase 2 via Animal control) release sends the items to hands
  **before** Phase 4 reckoning. So `RESOLVE_MACHINE` needs no hostage awareness beyond the gate.

**[v8] Squat length and uptime — recomputed, because fright is gone.**

The sim measured 28.9–31.0% uptime and 2.07–2.54 day squats **with fright active**, which accounted
for 19–32% of departures, plus relocate at 9–16% which is now impossible with a one-card deck.
Removing routes that carried ~⅓ of all departures lengthens the stay proportionately.

Two-state Markov model. `e = P(event that day) = 1 − (5/6)^P` = 42.1% / 51.8% / 59.8% / 66.5%.
Arrival `a = e × P(Jimothy | deck)`; departure `f = e × P(Animal control | deck) + s`, with
`s ≈ 0.02/day` for Snacc (the sim measured Snacc at only 5% of departures and ~1 play/game).

| P | Gang unused (deck 4 / 3) uptime, squat | **Gang used (deck 3 / 2) uptime, squat** |
|---|---|---|
| 3 | 39.6%, 6.2 d | **37.8%, 4.3 d** |
| 4 | 40.2%, 5.2 d | **38.2%, 3.6 d** |
| 5 | 40.5%, 4.4 d | **38.5%, 3.1 d** |
| 6 | 40.8%, 4.1 d | **38.6%, 2.8 d** |

*(worked for P=4, Gang used: `a = 0.518/3 = 0.173`; `f = 0.518/2 + 0.02 = 0.279`;
uptime `= a/(a+f) = 38.2%`; squat `= 1/f = 3.6` days.)*

**Uptime is ~38–41% and remarkably flat across player counts** — both rates scale with `e`, so it
nearly cancels. Mean squat is **2.8–6.2 days, roughly double the sim's fright-era figure.**

So `M_eff` loses ~0.4 machines to Jimothy on average, and loses a whole machine ~40% of the time.
At `M = 4` (3 players) that is a tenth of the board on average and a quarter of it two days in five.
Feeds directly into §2.4 and §8.4.

### 5.6 Special items — summary of changes

| Card | Status | Notes |
|---|---|---|
| Coloring | unchanged | Symmetric, non-targeted; [R-3.3] praises this shape. Sim: ~0.6 items ruined per play — weaker than its name. |
| Color catcher | unchanged | Blanket immunity at that machine [A-19]. |
| Bleach | unchanged | Shade swap; does not touch the shoe class (§6.8). |
| **Wash net** | **narrowed [v8]** | Only underwear loaded on the same turn (§6.7). |
| **Snacc** | renamed from Snack | Relocates Jimothy. Unplayable when he is absent. |
| **Sanitizer** | **NEW** | §6.10. |
| **Coin** | **NEW** | §4.4. |
| ~~Handwash basket~~ | **DELETED** | §8.3. |
| ~~Animal control~~ | **moved to events** | §5.4. |

---

## 6. THE RECKONING ALGORITHM

### 6.1 Structure — now a pure conjunction, for the first time

| Class | Rules | Effect |
|---|---|---|
| **(a) Pre-ladder modifiers** | **Bleach** (shade swap), **Sanitizer** (tier suppression) | Change the inputs to tier selection. Must run first. |
| **(b) Tier selection + provisional verdict** | the four-tier ladder | The baseline. |
| **(c) Monotone downgrades** | underwear isolation, blanket exclusivity, crowding, Coloring/Color catcher | Can only turn `WASHED → SENT_BACK`. |
| **(d) Post-verdict transform** | socks-with-blanket | Converts one `WASHED` into a damp partial. |

Every class-(c) rule computes its demotion set from the machine's **contents and attached cards
only** — never from another item's current verdict. So:

```
washed(i) = tierMatch(i) ∧ ¬isolationViolated(i) ∧ ¬crowded(i) ∧ ¬ruined(i)
```

Order-independent.

**Three things to say about this that are new in v8:**

1. **Deleting the Handwash basket removes the only non-monotone element from the reckoning.** In
   v0.2 and v0.3 I had to argue that the basket didn't break the conjunction (it didn't, because it
   was modelled as an extraction outside the machine). That argument is no longer needed. **The
   reckoning is now a pure conjunction of monotone filters with no exceptions** — the cleanest it
   has been in four versions, and directly beneficial to both the reducer and the table.
2. **The two pre-ladder modifiers commute with each other.** Bleach swaps shades; Sanitizer
   suppresses tiers 1–2. Bleach's output does not depend on which tier fires, and Sanitizer's
   condition does not depend on shade. So `Bleach ∘ Sanitizer = Sanitizer ∘ Bleach`, and only their
   joint precedence over the ladder is load-bearing.
3. **The socks rule is deliberately keyed on machine contents, not on the blanket's verdict.** "Does
   this machine contain a blanket?" is a property of the machine; "did the blanket wash?" would be
   another item's verdict. Keying on the latter would make one item's outcome depend on another's —
   **exactly the property whose absence makes the filters commute.** Keying on contents preserves
   the conjunction. This is a technical argument for a reading, not just a preference (§6.9,
   [OQ-04]).

**The only load-bearing ordering constraint inside a machine remains: pre-ladder modifiers before
tier selection.**

### 6.2 `RESOLVE_MACHINE` — deterministic pseudocode

Pure. Input: machine `m`, attached cards, global `jimothy`. Output: a verdict map.

```
FUNCTION RESOLVE_MACHINE(m, cards, jimothy) -> verdicts

  # ---- S0. Gates -----------------------------------------------------------
  IF m is DESTROYED:                    RETURN { }          # not a machine [v8]
  IF jimothy != null AND jimothy.machine == m.id:
      RETURN { every item -> HOSTAGE }                       # cannot run
  IF m.power == OFF:                    RETURN { every item -> RETAINED }
  IF m.items is empty:                  RETURN { }           # cards still recycle

  # ---- S1. Pre-ladder modifiers (commute with each other) ------------------
  bleached  := (cards contains >= 1 Bleach)      # 2+ do NOT cancel [A-20]
  sanitized := (cards contains >= 1 Sanitizer)   # [v8], machine-wide [A-21]
  FOR each item i IN m.items:
      i.eff := IF bleached THEN swap(i.shade) ELSE i.shade

  # ---- S2. Tier selection --------------------------------------------------
  # Sanitizer suppresses the two shoe tiers; shoes become ordinary items.
  IF NOT sanitized AND EXISTS i: i.eff == dark  AND i.type == shoes:  tier := 1
  ELIF NOT sanitized AND EXISTS i: i.eff == light AND i.type == shoes: tier := 2
  ELIF EXISTS i: i.eff == dark:                                        tier := 3
  ELSE:                                                                tier := 4

  # ---- S3. Provisional verdict --------------------------------------------
  FOR each item i IN m.items:
      i.washed := CASE tier OF
          1 -> (i.eff == dark  AND i.type == shoes)
          2 -> (i.eff == light AND i.type == shoes)
          3 -> (i.eff == dark)
          4 -> (i.eff == light)

  # ---- S4..S7: MONOTONE DOWNGRADES. THEY COMMUTE. -------------------------

  # ---- S4. Underwear isolation --------------------------------------------
  hasNonUnderwear := EXISTS i IN m.items: i.type != underwear
  FOR each i WHERE i.type == underwear AND i.washed:
      IF hasNonUnderwear AND NOT i.netProtected:      # [v8] per-ITEM flag, §6.7
          i.washed := FALSE

  # ---- S5. Blanket exclusivity (defensive assert) -------------------------
  # [v8] socks are the one legal companion.
  IF EXISTS i: i.type == blanket
     AND EXISTS j: j.type != blanket AND j.type != socks:
      FOR each i: i.washed := FALSE
      LOG INVARIANT_VIOLATION                          # machineAccepts should prevent this

  # ---- S6. Crowding --------------------------------------------------------
  FOR each type t IN typesPresent(m):
      IF count(i : i.type == t) >= 3:                  # >=3, not exactly 3 [A-22]
          FOR each i WHERE i.type == t: i.washed := FALSE

  # ---- S7. Coloring / Color catcher ---------------------------------------
  coloringOwners := { c.owner : c IN cards, c.name == "Coloring" }
  catcherOwners  := { c.owner : c IN cards, c.name == "Color catcher" }
  FOR each p IN coloringOwners:
      FOR each i WHERE i.owner != p AND i.owner NOT IN catcherOwners:
          i.washed := FALSE                            # "ruined" == SENT_BACK [A-23]

  # ---- S8. Emit ------------------------------------------------------------
  machineHadBlanket := EXISTS i IN m.items: i.type == blanket   # contents, not verdict [A-24]
  FOR each i IN m.items:
      IF NOT i.washed:
          verdict[i] := SENT_BACK                      # damp socks stay damp
      ELSE IF i.type == socks AND machineHadBlanket AND NOT i.damp:
          i.damp := TRUE
          verdict[i] := SENT_BACK                      # one wash short [v8]
      ELSE:
          i.damp := FALSE
          verdict[i] := WASHED

  # ---- S9. Recycle ---------------------------------------------------------
  shuffle all cards attached to m back into the special item deck

  RETURN verdicts
END
```

Capacity appears nowhere in the reckoning — it is purely a placement constraint (§4.6).

### 6.3 The four-tier ladder — settled

| Tier | Fires when | Washes | Everything else |
|---|---|---|---|
| 1 | any dark shoes (unless Sanitizer) | dark shoes | SENT BACK |
| 2 | else any light shoes (unless Sanitizer) | light shoes | SENT BACK |
| 3 | else any dark item | all dark items | SENT BACK |
| 4 | else light items only | all light items | — |

Teaching line, confirmed by the designer and now in the brief: **"shoes first, then dark, then
light."** Tiers operate on all items; a dark blanket washes on tier 3 exactly as a dark shirt does.
Tier 2 is settled and not reopened.

### 6.4 Underwear isolation

Underwear `u` washes only if every other loaded item is also `underwear`, **or** `u` is net-protected
(§6.7). The test is on **contents**, not on what is washing: two dark underwear plus one light shirt
means the shirt is present, so the underwear goes back too, and nothing washes.

### 6.5 Crowding

3+ items of the same `type`, any color or shade → all sent back. **[A-22]** Threshold is ≥3, not
exactly 3 — under "exactly 3" a fourth copy would rescue all four, which is absurd and now easily
reachable at capacity 4. Applies to linen types. Blankets can never crowd. Demoting an
already-demoted item is a harmless no-op.

**[!] The sim measured crowding firing on 0.0–1.1% of reckonings.** With 7 types and mean occupancy
~1.3, most machines hold 0–2 items and cannot crowd at all. Even a *full* 4-item machine with
uniformly random types has only `175/2401 = 7.3%` chance of containing 3+ of a type; a 3-item
machine, `7/343 = 2.0%`. See §8.7 — this rule may not earn its rules text.

### 6.6 Blanket exclusivity — **[v8] with the socks exception**

A blanket must occupy a machine alone **except that socks may share with it**, in both directions
(§4.6). This is the only exception.

### 6.7 Wash net — **[v8] narrowed**

Only underwear **loaded on the same turn the net is played** is protected. Underwear already sitting
in the machine is not.

**Representation.** This requires a **per-item** flag (`netProtected`), not a per-machine or
per-player one, because two underwear of the same owner in the same machine can differ. The flag is
set at load time and persists until the item leaves the machine — including across days if the
machine is OFF.

**[A-25] Physical implementation:** the Wash net card is placed in the machine and **the underwear
loaded that turn is placed on top of it.** Self-documenting, survives an OFF machine carrying over,
requires no memory and no separate token. This is the cleanest available answer and it should be
written into the rules as the procedure, not left to players.

**[A-26]** The net waives **isolation only** — protected underwear must still win its tier. Wash net
+ dark underwear + dark shoes → tier 1 → the underwear is sent back and the net is wasted.

**[!] Note the card is now quite weak.** The sim measured Wash net at 0.18–0.26 plays per game
under the *old, broader* rule. Narrowing it further, plus the one-day fresh delay, plus the
requirement to coordinate the play with a load of underwear on the same turn, makes it the most
demanding card in the deck to use. Flagged for the composition sweep (§9.3).

### 6.8 Bleach

Swaps `dark ↔ light` as effective shade; the ladder then runs. **Bleach does not disarm shoes** — a
dark shoe becomes an effective light shoe, still the top occupied rung once tier 1 is empty. That is
correct and intended given that shoes form their own class above the shade system. **[v8] Sanitizer
is now the card that answers shoes**, which resolves the tension cleanly: Bleach owns the shade
axis, Sanitizer owns the shoe axis, and they compose.

**[A-20]** Two Bleach cards do not cancel; the effect is a flag, not a toggle.

### 6.9 **Socks and blankets — the two-wash state**

**Rule.** Socks may share a machine with a blanket. Socks that receive a wash event in a machine
that contained a blanket are **damp**: not clean, sent back to hand, needing one further wash event.

**State representation.** `socks.damp : bool`. One bit, on the card, persistent across sent-backs,
Gang, Circuit break, hostage release, and displacement. It clears only when the socks finally wash.
Formally `damp` is a wash counter with domain `{0,1}` and a *conditional* target — 1 event if
washed without a blanket present, 2 if with — but a boolean is sufficient because the second event
always completes regardless of where it happens [A-27].

**Physical tracking — and it costs nothing.** Put a token on the socks card. **The wash tokens
freed by deleting bedding are exactly this component**, at exactly the right count (2 per player,
matching the 2 socks cards per color). No new component is needed.

**Is it hand-auditable? Not quite, as written — and here is the fix.** The damp socks card returns
to a **hidden hand** carrying its token, so its state is known only to its owner. That is precisely
the hidden bookkeeping the platform goals forbid, and it is the same [CONFLICT] bedding had in
v0.2/v0.3.

Two ways out:

| Option | Auditable? | Cost |
|---|---|---|
| (a) Token on the card in a hidden hand, plus a rule that players must answer truthfully if asked | Relies on honesty; unpoliceable | Zero |
| **(b) Damp socks are kept in a face-up "damp" zone in front of the owner**, not returned to the hidden hand. They may be loaded from there exactly as from hand. | **Fully auditable** | One more public zone — but the game already has a face-up **fresh** zone, so the convention exists and costs nothing to learn |

**[A-28] Recommend (b).** It makes the only persistent per-item state in the game fully public, it
matches the game's committed open-information positioning (brief §10), and it reuses an existing
convention rather than inventing one. The information leak is trivial — everyone already knows you
put socks in with a blanket, because loading is public.

**Why would anyone ever do this?** Because a blanket machine otherwise accepts nothing, so it is
dead board space, and **socks are the only pressure valve when mandatory loading meets a full
board** (§4.2). The trade is explicit: use otherwise-wasted capacity, pay one extra wash. That is a
good, legible decision and it is the rule's real purpose.

**[A-24] The rule keys on the machine *containing* a blanket, not on the blanket *washing*.**
Justified in §6.1(3): keying on another item's verdict would break the commutativity of the filter
chain. It also matters in practice — dark socks + light blanket fires tier 3, so the socks wash
while the blanket is sent back. Under the contents reading the socks are damp; under the
blanket-washed reading they would be fully clean. See [OQ-04].

### 6.10 **Sanitizer**

*"Play on a machine. Shoes stop tainting this wash. Every other rule still applies."*

**[A-21] Recommend machine-wide: tiers 1 and 2 are suppressed and resolution proceeds at tier 3/4
on shade alone.** Shoes become ordinary items — a dark shoe washes with the dark items, a light
shoe with the light.

**The argument is structural, not aesthetic.** The alternative (owner-only, like Color catcher)
would require the ladder to be evaluated **per player**: tier 1 would fire for everyone except the
Sanitizer's owner, so the machine would have two simultaneous tiers and every item would need its
own tier lookup. That destroys the single-tier-per-machine property, which is the thing that makes
the reckoning (i) resolvable by eye at a table and (ii) a commuting conjunction in the reducer. It
would be the most expensive rule in the game to state and the most error-prone to resolve.

Machine-wide also has the design properties the comparables report favours: it is **symmetric and
non-targeted** — it changes the machine for everyone equally, like Coloring's good shape [R-3.3],
rather than singling anyone out.

Secondary points:
- It gives the shoe class its dedicated counter, which the game lacked. Every player holds exactly
  2 shoe cards of their 14, and dark shoes are the single most destructive item in the game.
- It composes cleanly with Bleach (§6.1(2)) and with everything else, since it only edits tier
  selection.
- **[A-29]** A Sanitizer at a machine with no shoes does nothing and is wasted — no special case
  needed.

### 6.11 Event cards

| Card | Effect |
|---|---|
| **Gang** | Drawer picks one machine. Contents to owners' hands. The machine is **destroyed permanently**; the card stays on it. Never returns to the deck. Happens once per game. §5.2. |
| **Circuit break** | Every machine switches OFF; all retain contents. Power otherwise unchanged; nothing destroyed; Jimothy unaffected. §5.3, §8.4. |
| **Jimothy** | Placed in a machine chosen by the drawer. §5.5. |
| **Animal control** | Removes Jimothy; hostages to owners' hands, unwashed. Blank if he is absent. §5.4. |

### 6.12 Invariants

| ID | Invariant |
|---|---|
| I-1 | Every item is in exactly one of: a hand, a damp zone, a machine, a clean pile, or the inert remainder. |
| I-2 | No machine holds a blanket alongside anything except socks. |
| I-3 | `occupancy(m) ≤ 4` for every machine, always. |
| I-4 | After Phase 4, every ON, Jimothy-free, undestroyed machine holds zero items. |
| I-5 | `damp == true` only for `type == socks`. |
| I-6 | Clean piles are monotone non-decreasing and ⊆ the must-wash set. |
| I-7 | Exactly one player holds the key; day-`d` keyholder is seat `((d−1) mod P)+1`. |
| I-8 | At most one event is revealed per day; at most one Gang is ever resolved per game. |
| I-9 | At most one Jimothy token, on at most one undestroyed machine. |
| I-10 | `isHostage(i)` is derived, never stored. |
| I-11 | `netProtected` is a per-item flag, set only at load time, cleared when the item leaves the machine. |
| I-12 | No card is in a fresh zone at the start of Phase 1. |
| I-13 | `M` is non-increasing over a game and decreases at most once. |

---

## 6.13 WORKED EXAMPLES — regenerated from scratch against v8

Notation: `A-D-shoes` = player A's dark shoes. `[Bleach:A]` = attached card, owner A.
Machine ON, undestroyed, Jimothy-free, unless stated. Capacity 4.

### Table A — machine reckoning

| # | Contents | Cards | Tier | Verdicts | Reason |
|---|---|---|---|---|---|
| 1 | `A-D-shoes`, `B-L-shirt`, `C-D-pants` | — | 1 | `A-D-shoes` **WASHED**; others SENT BACK | Shoes are their own dirtiness class; dark shoes beat even other dark items. |
| 2 | `A-L-shoes`, `B-D-shirt` | — | 2 | `A-L-shoes` **WASHED**; `B-D-shirt` SENT BACK | Tier 2, settled. "Shoes first, then dark, then light." |
| 3 | `A-D-shirt`, `A-D-pants`, `B-L-hat` | — | 3 | both dark **WASHED**; `B-L-hat` SENT BACK | The ordinary case. |
| 4 | `A-L-shirt`, `B-L-pants` | — | 4 | both **WASHED** | Light-only machine. |
| 5 | `A-D-blanket` (alone) | — | 3 | **WASHED** | Tiers cover all items. The linen ruling in action. |
| 6 | `A-D-underwear` (alone) | — | 3 | **WASHED** | **Solo-wash guarantee** (§2.3): isolation is trivially satisfied. No item is structurally unwashable. |
| 7 | `A-D-underwear`, `B-L-underwear` | — | 3 | `A-D` **WASHED**; `B-L` SENT BACK | Shade precedence operates *inside* linen. An all-underwear machine is not automatically safe. |
| 8 | `A-D-underwear`, `A-D-shirt` | — | 3 | shirt **WASHED**; underwear SENT BACK | Isolation tests **contents**, not what is washing — and both items are A's own. Self-inflicted. |
| 9 | `A-D-shoes`, `B-D-shoes`, `C-D-shoes`, `D-L-shirt` (full) | — | 1 | **all four SENT BACK** | Crowding alongside a tier-1 wash. All three shoes provisionally wash, crowding demotes all three, and the light shirt is *not* promoted — crowding does not re-run tier selection. |
| 10 | `A-D-shirt`, `A-L-shirt`, `B-D-shirt` | — | 3 | **all three SENT BACK** | Crowding at the resolved `type` reading. A contributes the maximum one color can (2 shirts); B's third triggers it. Needs ≥2 owners, always. |
| 11 | `A-D-shirt`, `B-L-shirt` | `[Bleach:A]` | 3 | `B-L-shirt` **WASHED**; `A-D-shirt` SENT BACK | Bleach doing what its text says. A played it and lost their own shirt — the card is ownership-blind. |
| 12 | `A-D-shoes`, `B-L-shirt` | `[Bleach:A]` | 2 | `A-D-shoes` **WASHED**; shirt SENT BACK | **Bleach does not disarm shoes.** The swap makes them effectively light shoes — still the top occupied rung. Shade axis only. |
| 13 | **`A-D-shoes`, `B-L-shirt`, `C-D-pants`** | **`[Sanitizer:B]`** | **3** | `C-D-pants` **WASHED**; `A-D-shoes` **WASHED**; `B-L-shirt` SENT BACK | **Sanitizer, the headline case.** Tiers 1–2 are suppressed, so the machine resolves on shade alone: both dark items wash *including the shoes*, which become ordinary. Compare row 1 — same machine, one card, two washes instead of one. Note B played it and still lost their light shirt: Sanitizer is machine-wide and shade-blind. |
| 14 | `A-L-shoes`, `B-D-shirt` | `[Sanitizer:A]` | 3 | `B-D-shirt` **WASHED**; `A-L-shoes` SENT BACK | **Sanitizer can hurt its own player.** Without the card this is row 2: tier 2 fires and A's light shoes wash alone. With shoes neutralised they are merely a *light* item, tier 3 fires on B's dark shirt, and A has spent a card to hand an opponent the wash and lose their own. **Corrected 2026-08-06** — this row previously used `A-D-shoes`, `B-L-shirt`, `C-L-hat` and claimed tier 4 with the shoes sent back. That is wrong: Sanitizer suppresses the two *shoe* rungs only, so a dark shoe is still a dark item and tier 3 fires on it (§6.10, "a dark shoe washes with the dark items"; verified against `machineVerdicts`, which washes `A-D-shoes` alone on that board). No test or fixture asserted the old value. |
| 15 | `A-L-shoes`, `B-D-shirt` | `[Sanitizer:A]`, `[Bleach:A]` | 3 | `A-L-shoes` **WASHED**; `B-D-shirt` SENT BACK | **The two pre-ladder modifiers compose and commute.** Bleach swaps: shoes→dark, shirt→light. Sanitizer suppresses tiers 1–2. Tier 3 fires on effective-dark = A's shoes. Applying them in either order gives the same answer (§6.1). |
| 16 | `A-D-blanket`, `A-D-socks` | — | 3 | blanket **WASHED**; **`A-D-socks` → DAMP**, sent back with a token | **The socks/blanket rule, base case.** Both would have washed on tier 3, but socks sharing with a blanket take a partial. A used dead board space and paid one extra wash. |
| 17 | `A-D-socks` (damp), `B-L-hat` | — | 3 | `A-D-socks` **WASHED (clean)**, token removed; `B-L-hat` SENT BACK | **The second wash.** Any wash event completes damp socks [A-27] — no special machine required. |
| 18 | `A-L-blanket`, `A-D-socks` | — | 3 | **`A-D-socks` → DAMP**, sent back; `A-L-blanket` SENT BACK | **The reading that matters.** Tier 3 fires on the dark socks; the *light blanket does not wash*. The socks are still damp, because the rule keys on the machine **containing** a blanket, not on the blanket washing [A-24]. Under the alternative reading they would be fully clean — see [OQ-04]. This is also why the contents reading preserves commutativity: no item's verdict depends on another's. |
| 19 | `A-D-blanket`, `A-D-socks` (already damp) | — | 3 | blanket **WASHED**; `A-D-socks` **WASHED (clean)** | Damp socks complete even in a second blanket machine [A-27]. The flag is a boolean, not a "must finish elsewhere" condition. |
| 20 | `A-D-blanket`, `A-D-socks`, `B-L-socks`, `C-D-socks` (full) | — | 3 | **all four SENT BACK** | Blanket + three socks is legal under the exception and exactly fills capacity — then **crowding fires on `socks`**. Nobody gets even a damp partial, because crowding demotes before S8. A genuinely nasty and reachable corner. |
| 21 | `A-D-underwear`, `B-L-shirt` | `[Wash net:A]`, net played as A loaded the underwear | 3 | `A-D-underwear` **WASHED**; `B-L-shirt` SENT BACK | Net waives isolation for underwear loaded **that turn**. The intended use. |
| 22 | `A-D-underwear` (loaded yesterday, machine was OFF), `B-L-shirt` | `[Wash net:A]` played today | 3 | **both SENT BACK** | **[v8] The narrowing bites.** The underwear was already sitting in the machine, so it is not net-protected. `netProtected` must be a per-item flag set at load time [A-25] — a per-machine or per-player flag would get this case wrong. |
| 23 | `A-D-underwear`, `B-D-shoes` | `[Wash net:A]` (loaded this turn) | 1 | `B-D-shoes` **WASHED**; underwear SENT BACK | Net waives isolation only [A-26]; the underwear still fails the ladder. Net wasted. Compare row 24. |
| 24 | `A-D-underwear`, `B-D-shoes` | `[Wash net:A]`, `[Sanitizer:C]` | 3 | **both WASHED** | **Net + Sanitizer combo.** Sanitizer suppresses the shoe tiers, so tier 3 fires on both dark items; the net waives isolation. Two cards from two different players, neither coordinating, produce the machine's best possible outcome. |
| 25 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]`, `[Color catcher:B]` | 4 | `A` **WASHED**, `B` **WASHED**, `C` SENT BACK | Coloring + catcher + third player. The catcher protects only B. |
| 26 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]`, `[Coloring:B]` | 4 | **all three SENT BACK** | A ruins B and C; B ruins A and C. Nothing survives both. |
| 27 | `A-L-shirt`, `B-D-shoes` | `[Bleach:A]`, `[Coloring:A]`, `[Color catcher:B]` | 2 | `B-D-shoes` **WASHED**; `A-L-shirt` SENT BACK | Full stack. Bleach swaps (shoes→light, shirt→dark); tier 2 fires; Coloring would ruin B's shoes but B holds the catcher; A's own shirt loses to the ladder, since Coloring protects nobody [A-23]. **A spent three cards' worth of effect and washed nothing.** |
| 28 | (empty, ON) | `[Sanitizer:A]` | — | no verdicts | Empty machines are a no-op; the card still recycles. Playing at a machine that stays empty simply wastes it. |

### Table B — day-level, event, and machine-state scenarios

| # | Scenario | Resolution | Point |
|---|---|---|---|
| B1 | Player C (3rd in order) rolls a 6. Player E (5th) also rolls a 6. | C draws an event and **reveals it immediately**. Players D, E, F take their turns knowing it. E's 6 loads 1 item and does nothing else. | **[v8] The turn-order information asymmetry** (§3.3). A 6 from the first player informs everyone; from the last, nobody. Under [A-09] the acting order rotates with the key. |
| B2 | The revealed event is **Gang**. Drawer C picks M2, which holds 3 items from three owners. | Phase 2: the 3 items return to their owners' hands. **M2 is destroyed permanently**; the Gang card is left on it. `M` drops from 5 to 4 for the rest of the game. Gang never returns to the deck. | The permanent contention step-change the designer observed. Also note the event deck is now 3 cards, raising every other event's frequency (§2.6). |
| B3 | The revealed event is **Circuit break**, day 6, `P=5`, `M=6`, all ON. | Phase 2: **all 6 machines switch OFF**, retaining contents. Phase 4: nothing reckons at all. Day 7 onwards the keyholder turns on **one per day**. | **§8.4.** Full recovery takes 6 days; the board fills in ~3.2. This is the most serious problem in v8. |
| B4 | Continuing B3, day 7. Every machine is OFF and holds 2–3 items. Player A rolls a 3. | Loading is mandatory and OFF machines **are loadable**, so A must load 3 items into machines that cannot run. If every machine is at capacity, A loads as many as legal, possibly zero [A-05]. | **Mandatory loading + loadable OFF machines + no draining = the board jams.** [A-05] is what stops an implementation throwing here. |
| B5 | Continuing B4. A holds socks and the only machine with room holds a blanket. | **Legal** — socks are the one exception. The socks go in and will come out damp. | The socks/blanket rule is the built-in pressure valve for exactly this situation (§6.9). |
| B6 | The revealed event is **Jimothy**. Drawer B places him on M3, holding `A-D-shirt` and `C-L-pants`. | Both become **hostage**. M3 cannot run, cannot be loaded, and its items cannot be moved by a roll of 4 [A-18]. | Placement is a drawer's choice and therefore targeted — the sharpest remaining take-that vector (§8.8). |
| B7 | Continuing B6, next day. Keyholder turns M3 **OFF**. | Legal but **completely inert** — M3 already could not run. The keyholder has wasted the day's single most valuable action. | Jimothy and OFF stack redundantly. Worth a rules note and a UI warning. |
| B8 | Continuing B6. Player A rolls a 4 and tries to move `A-D-shirt` out of M3; then tries to move `C-L-pants` *into* M3. | **Both illegal.** Hostages are frozen; `machineAccepts` rejects a Jimothy machine. A loads 1 elsewhere and skips the move. | If a 4 could free hostages, `P(some 4 today) = 42–67%` would make the mechanic decorative. |
| B9 | Continuing B6. **Circuit break** is drawn two days later. | Every machine switches OFF **including M3**. Jimothy is **unaffected** — fright is deleted. M3's items stay hostage. | **[v8] Gang and Circuit break no longer remove him.** Only Snacc or Animal control do. |
| B10 | Continuing B6. **Gang** is drawn and the drawer picks **M3, Jimothy's machine.** | Not covered by the brief. **[A-16] Recommended:** the machine is destroyed, hostages return to hands (identical to release), and **Jimothy is relocated** to another machine chosen by the Gang drawer — he is not removed, since fright is gone and Gang destroys machines, not raccoons. | **A genuine gap.** The alternative (Jimothy is destroyed with the machine) would make Gang a third exit route, partially restoring fright. Needs a ruling — [OQ-06]. |
| B11 | Jimothy sits on M1. **Animal control** is drawn. | He is removed; M1's hostages return to owners' hands **unwashed**; his card returns to the event deck. M1 is free to load tomorrow. | Release never washes. Players will expect Animal control to save their laundry; it does not. |
| B12 | Jimothy is **not** in play. **Animal control** is drawn. | **Nothing happens.** | Blank ~60% of the time [A-17] — the price of the self-correcting counter-probability (§2.6, §5.4). |
| B13 | Player D rolls a 5. | D draws **two** special items, keeps one, and puts the other on the **bottom** of the deck. The kept card sits face-up in D's **fresh** zone — **everyone can see what it is** — and is playable from tomorrow. | Draw-two-keep-one substantially fixes the dead-card problem: D can decline a Snacc while Jimothy is absent. |
| B14 | Player D holds the **Coin** (ready) and plays it on their turn, turning M2 ON. Later the same day the keyholder turns M2 OFF. | Both legal. The Coin resolves in Phase 1; the key acts in Phase 3. **The keyholder has the last word.** | Under the one-shot reading [A-15] D has spent a card to be overruled. This timing is a real argument that a one-shot Coin is appropriately costed. |
| B15 | Players A and B both complete their 10th item during the same reckoning, on different machines. | The **full reckoning completes**, then both are detected in Phase 5. **Both win together.** | **[!] §8.6** — if victory were declared mid-reckoning, machine index order would decide the winner. The reckoning must finish first. |
| B16 | Player A's last unwashed item is `A-D-socks`, currently **damp**, and it is sitting in A's face-up damp zone. | A loads it like any other item. Any wash event completes it and A wins. | [A-28] keeps the only persistent per-item state public and auditable. |

---

## 7. OPEN QUESTIONS AND PROPOSED DEFAULTS

★ marks questions the brief has not flagged. Deck composition is excluded by instruction (§9).

### The two the brief flags

**[OQ-01] Sanitizer scope — machine-wide or owner-only?**
(a) **Machine-wide** (brief's implemented default; **recommended**): tiers 1–2 suppressed, resolution
proceeds at tier 3/4 on shade alone.
(b) Owner-only, like Color catcher: only the player who played it ignores shoe tainting.
**Consequence of (b), and it is disqualifying:** the ladder would have to be evaluated **per
player** — tier 1 firing for everyone except the Sanitizer's owner — so a single machine would hold
two simultaneous tiers and every item would need its own tier lookup. That destroys the
single-tier-per-machine property that makes the reckoning eye-resolvable at a table and a commuting
conjunction in the reducer. It would be the most expensive rule in the game to state and the most
error-prone to resolve.
Machine-wide is also symmetric and non-targeted, the shape [R-3.3] favours, and it gives the shoe
class the dedicated counter the game lacked.
**Recommend (a), strongly. [A-21]**

**[OQ-02] Coin persistence — one-shot or held?**
(a) **One-shot** (brief's implemented default; **recommended, conditionally**): played from hand,
toggles one machine, returns to the deck.
(b) Persistent: its holder toggles a machine every turn.
Consequence of (b): a permanently held Coin is **a second key that never rotates**, which is
strictly better than the key itself, since the key's entire remaining power is one toggle per day.
It also breaks the "played cards return to the deck" rule that every other special item follows, and
needs new rules for stealing, Gang interaction, and what happens when its holder wins.
**Recommend (a) — but the recommendation is conditional on Circuit break being fixed** (§8.4). A
persistent Coin would double Circuit-break recovery from 1 machine/day to 2, and if Circuit break
stays as written the Coin becomes one of the few available pressure valves. **These two questions
should be decided together.** [A-15]

**[OQ-03] Animal control as a blank.**
(a) **Accept** (recommended). (b) Redraw if Jimothy is absent. (c) Give it a fallback effect.
Consequence: it is blank ~60% of the time. But because Jimothy's card leaves the deck while he is on
the board, **AC's probability rises exactly when it is needed** — 1-in-4 → 1-in-3 → 1-in-2. The blank
draws are the price of a self-correcting counter, and (b) or (c) would break that elegance for
little gain. **Recommend (a). [A-17]**

### New, and material

★ **[OQ-04] Does the socks rule key on the machine *containing* a blanket, or on the blanket
*washing*?**
(a) **Containing** (recommended): any socks that wash in a machine holding a blanket come out damp,
regardless of the blanket's own fate.
(b) Washing: socks are damp only if the blanket also washed.
Consequence: they differ whenever the tier splits them — dark socks + light blanket fires tier 3, so
the socks wash and the blanket does not (worked example 18). Under (b) those socks would be fully
clean, making "load your socks with a *mismatched* blanket" a free lunch that dodges the whole
penalty.
**The decisive argument is structural:** (b) makes one item's verdict depend on another item's
verdict, which is precisely the property whose absence makes the filter chain commute (§6.1). (a)
keys on machine contents and preserves it.
**Recommend (a). [A-24]**

★ **[OQ-05] Does a second wash in another blanket machine complete damp socks?**
(a) **Yes — any wash event completes them** (recommended). (b) No, only a blanket-free wash does.
Consequence: (b) makes `damp` a two-state counter with a location condition and creates a card that
can be *stuck* if a player keeps making the same mistake. (a) matches the card text ("they need one
more wash to finish") and keeps the state a single boolean.
**Recommend (a). [A-27]**

★ **[OQ-06] What happens if Gang destroys Jimothy's machine? — a genuine gap.**
The brief covers neither. Candidates:
(a) **Machine destroyed, hostages released to hands, Jimothy relocated by the Gang drawer**
(recommended). Consistent with "Gang destroys machines" and "fright is deleted"; keeps Jimothy's
exit routes at exactly two.
(b) Machine destroyed and **Jimothy removed with it** — this quietly restores a third exit route and
partially undoes the fright deletion, but it is thematically defensible (they shot the washer he was
in).
(c) Gang may not target Jimothy's machine.
Consequence: (b) shortens his squats and would need §5.5's uptime numbers recomputed; (c) is a
protection rule with no precedent elsewhere.
**Recommend (a). [A-16] — but flag that (b) is a legitimate design choice if squats prove too long.**

★ **[OQ-07] Is damp state public?**
(a) **Damp socks kept in a face-up damp zone** (recommended) — fully auditable, reuses the existing
face-up fresh-zone convention, matches the committed open-information positioning.
(b) Token on the card in a hidden hand, plus a truthfulness rule — unpoliceable, and exactly the
hidden bookkeeping the platform goals forbid.
**[CONFLICT]** — (b) is trivial digitally and unenforceable physically.
**Recommend (a). [A-28]**

★ **[OQ-08] Mandatory loading with no legal placement.**
The brief covers "hand holds fewer" but not "board has no room", which is reachable under Circuit
break (§8.4).
(a) **Load `min(rolled, handSize, legalPlacements)`; zero is allowed** (recommended).
(b) Force a load somewhere by relaxing a constraint — no.
**Recommend (a). [A-05]**

★ **[OQ-09] Order of the sub-actions within a turn. — CLOSED, and not in this document's favour.**
(a) Roll → face-extra → load → card (this document's original recommendation, [A-03]): the move on a
4 frees a slot before loading, and the event on a 6 is revealed before anyone loads, including the
drawer.
(b) **Roll → card → load → face-extra.** ← **this is the settled rule.**
(c) Player's choice of order.
**Resolved as (b)** by the designer (brief v9 §4), and implemented by `sim/rules.py` `[A-W03]` and by
the web prototype (`turnOrder: 'cardLoadExtra'`; (a) survives only as a dead ablation switch). The
deciding argument is the *Mesh bag*, which covers what you load "on the turn you play it" and
therefore cannot work unless card play precedes loading. Accepted costs: the roll-4 move can no
longer free a slot for your own load, and a 6 is revealed after the drawer has already loaded.
**[A-03] is superseded — see the corrections log at the head of this document.**

★ **[OQ-10] When is a Wash net's protection fixed?**
Must be a **per-item flag set at load time**, not per-machine or per-player — worked example 22
shows a per-machine flag gets the carry-over case wrong. Physically: the net card goes in the
machine and the protected underwear sits on top of it [A-25].
**Recommend as stated; write the physical procedure into the rules.**

★ **[OQ-11] Victory declared mid-reckoning or after it?**
(a) **After the full reckoning** (recommended) — otherwise machine index order decides who wins
among simultaneous finishers, and simultaneous victory is explicitly allowed.
**Recommend (a). [A-30]** See §8.6.

### Carried forward, unchanged

★ **[OQ-12] Acting order** — keyholder first, then clockwise [A-09]. Rotates the last-actor
advantage daily rather than fixing it to a seat. The sim measured a 5.09pp seat edge at P=3.

★ **[OQ-13] Hidden hands** — items and ready cards hidden; fresh zone, damp zone, machines, and
clean piles public [A-10]. Note the brief's §10 open-information commitment argues for going
further; worth revisiting deliberately rather than by default.

★ **[OQ-14] Roll-4 move optional, load mandatory** [A-07]. ★ **[OQ-15]** Blanket movable by a 4 only
into an empty or socks-only machine [A-08]. ★ **[OQ-16]** Two Bleach cards do not cancel [A-20].
★ **[OQ-17]** Coloring does not protect its owner [A-23]. ★ **[OQ-18]** Crowding threshold ≥3
[A-22]. ★ **[OQ-19]** Color catcher is blanket immunity, not one-shot [A-19]. ★ **[OQ-20]** Cards on
OFF/Jimothy machines persist until that machine runs [A-06]. ★ **[OQ-21]** Cards may attach to a
Jimothy machine [A-06]. ★ **[OQ-22]** Hostages immune to roll-4 [A-18]. ★ **[OQ-23]** Jimothy may
occupy a blanket or full machine, not a destroyed one [A-11]. ★ **[OQ-24]** No hand limit on
special items [A-31].

---

## 8. RULES INTEGRITY REVIEW

### 8.1 Resolved since v0.3

| Was | Now |
|---|---|
| Optional loading reintroduced the stall equilibrium | **FIXED** — mandatory loading, and the sim gives the measured justification. |
| Rotation-completion rule could not change the winner | **FIXED** — deleted, per my v0.3 §7.4 proof. |
| Face-down events meant no decision was informed by them | **FIXED** — revealed on draw, per my v0.3 [OQ-05]. |
| Electricity resolved after the reckoning it cancelled | **FIXED** in v5 and still correct: events precede reckoning. |
| Handwash basket was a non-monotone exception in the reckoning | **FIXED by deletion** — the reckoning is now a pure conjunction (§6.1). |
| Bedding's two-wash state was hidden bookkeeping | **Transformed** — bedding gone; the same issue recurs on damp socks and is answered by [A-28]. |
| Linen could be structurally unwashable (original P0) | **CLEAN** — solo-wash guarantee re-derived from scratch (§2.3). |

### 8.2 **[!] Circuit break is oppressive at 5–6 players. This is the most serious problem in v8.**

*(Full analysis; the coordinator asked specifically for recovery time.)*

**Recovery is one machine per day.** After a Circuit break, all `M` machines are OFF; the keyholder
restores one per day, so **full recovery takes `M = P+1` days: 4, 5, 6, 7.**

**But the board jams before it recovers.** Total capacity is `4M`; daily inflow is `1.5P` and
mandatory; OFF machines remain loadable and drain nothing:

| P | M | board capacity | daily inflow | **days to fill** | **days to recover** |
|---|---|---|---|---|---|
| 3 | 4 | 16 | 4.5 | **3.6** | 4 |
| 4 | 5 | 20 | 6.0 | **3.3** | 5 |
| 5 | 6 | 24 | 7.5 | **3.2** | 6 |
| 6 | 7 | 28 | 9.0 | **3.1** | 7 |

**At every player count the board fills faster than it recovers, and the gap widens with `P`.** At 3
players it is marginal (3.6 vs 4); at 6 players the board is jammed for four days before the last
machine comes back. Partial recovery drains some of this — with `d` machines ON they absorb and wash
perhaps 1.5 items each — but at P=6 that is ~2.9 washes/day against 9 loaded, so accumulation
continues throughout recovery.

**And it recurs faster than it recovers.** The event deck concentrates: once Gang is spent and
Jimothy is on the board it is `{Circuit break, Animal control}`, so **every second event is a
Circuit break.** Modelling ON-count as a process that gains +1/day and resets to 0 with probability
`p = P(event) × P(CB | deck)`:

`E[ON] = q(1 − q^M)/p` where `q = 1 − p`.

| P | M | `p` (late game, deck of 2) | **E[ON]** | **as % of board** | mean gap between breaks | recovery needed |
|---|---|---|---|---|---|---|
| 3 | 4 | 0.211 | 2.29 | **57%** | 4.7 d | 4 d |
| 4 | 5 | 0.259 | 2.22 | **44%** | 3.9 d | 5 d |
| 5 | 6 | 0.299 | 2.07 | **34%** | 3.3 d | 6 d |
| 6 | 7 | 0.333 | 1.89 | **27%** | 3.0 d | 7 d |

*(worked for P=6: `e = 0.665`, `p = e/2 = 0.333`, `q = 0.667`, `M = 7`;
`q⁷ = 0.059`; `E[ON] = 0.667 × 0.941 / 0.333 = 1.89`.)*

Mid-game with a three-card deck (`p = e/3`) it is less severe but still bad at high counts: 69% of
the board ON at P=3, **41% at P=6**.

**Read that table plainly: at 6 players, in the late game, an average of 1.9 of 7 washers are
running.** Recovery time exceeds the interval between breaks at every count from 4 up, so the board
never returns to full. This is a rules-level version of exactly the "OFF-drift deadlock" that the
sim's provenance note diagnosed as a *bug* in the NAIVEKEY policy — except here it is not a weak bot,
it is the rules.

**Recommended fixes, in order of preference:**

| Option | Effect | Cost |
|---|---|---|
| **(a) Machines automatically return ON at the end of the following day's reckoning.** | Circuit break costs exactly one day of washing while preserving the retain-contents flavour. Recovery becomes 1 day, decoupled from `M`. | Converges toward the old Electricity, which the designer moved away from — but keeps the OFF/retain semantics that motivated the change. **Recommended.** |
| (b) After a Circuit break, the keyholder's next action may turn on **any number** of machines. | Recovery 1 day; keeps the card's full-board drama and gives the key a genuine moment. | One extra clause on the key. Nearly as good as (a) and arguably more fun. |
| (c) Circuit break switches off only `⌈M/2⌉` machines, drawer's choice. | Recovery ~`M/2` days. | Halves the problem without fixing it at 6 players; adds a targeted choice. |
| (d) Make the Coin persistent [OQ-02]. | Doubles recovery to 2/day. | Only helps when someone holds a Coin, and creates the second-key problem. Not a fix on its own. |
| (e) Leave as written. | — | Fine at 3 players, degrading at 4, bad at 5–6. |

**Recommend (a) or (b).** Note this is the *one* place where the physical playtest may not have
caught the problem: the table has most likely been playing at 3–4 players, where recovery (4–5 days)
roughly matches the gap between breaks (3.9–4.7 days) and the pathology is mild. **It is specifically
a 5–6 player failure.**

### 8.3 Termination without the Handwash basket

**Does mandatory loading serve as the ratchet? No — but it removes the mechanism that actually
caused long games, which is better.**

The basket was a genuine **monotone ratchet**: one item, unconditionally, irreversibly clean.
Mandatory loading is not that. It is a **forcing function**: it guarantees items enter machines, not
that they become clean. An item can cycle in and out of hand forever. So formally, **there is still
no potential function that strictly decreases, and still no termination guarantee.**

But the sim identifies the *actual* mechanism of long games, and it is not the absence of a ratchet:

```
realized L        corr with game length = −0.90
short games (bottom quartile):  L = 1.178
long  games (top quartile):     L = 0.245
```

**Long games were low-loading games.** Mandatory loading pins `L` at 1.5 — *above* the short-game
value — by construction. The failure mode is eliminated at the source rather than patched with a
ratchet.

The basket's own correlation with length was **+0.919**, which is almost entirely length *causing*
basket plays (more days → more draws → more plays), not the reverse. So deleting it removes a
confound rather than a load-bearing mechanism. Its measured usage — 10–28 plays per game against
~1 for Coloring, with 72–75% of uses straight from hand — was a card doing far too much work; the
deletion is well-founded.

**Length extrapolation.** Scaling the sim's GREEDY results by `L` (days ∝ 1/L):

| P | GREEDY `L` | GREEDY days | **scaled to `L`=1.5** |
|---|---|---|---|
| 3 | 1.22 | 12.6 | **10.2** |
| 4 | 1.13 | 15.4 | **11.6** |
| 5 | 1.17 | 15.3 | **11.9** |
| 6 | 1.09 | 17.7 | **12.9** |

So **~10–13 days from the loading effect alone.** Adjustments in both directions: more machines
(`P+1` vs the sim's 3/3/4/4) reduce collisions and shorten further; Circuit break (§8.2), longer
Jimothy squats (§5.5), and Gang's permanent machine loss all lengthen. **A working estimate of
11–16 days**, which at 60–90 s per player-day is roughly 35–80 minutes at 3–4 players and 65–145 at
5–6. Acceptable at low counts; long at 6, and §8.2 is the main reason.

**New tail risk replacing the old one:** the long-game mechanism is no longer stalling, it is
**Circuit-break jamming**. Fixing §8.2 removes it.

### 8.4 What now guarantees progress — a weaker but real argument

With no ratchet, the honest statement is that progress is *statistically* rather than *structurally*
guaranteed. Two supports:

1. **The solo-wash guarantee** (§2.3): any machine that reckons with exactly one item **always**
   washes it. There is no configuration in which a lone item fails. So progress requires only that
   some machine occasionally reckon lightly loaded, which at `O ≈ 1.3` is the common case.
2. **Mandatory loading forces the attempt.** Under optional loading a player could decline forever;
   now they cannot.

What is *not* guaranteed: that any particular player's remaining items ever wash. A player whose
last item is dark shoes needs a machine with no other dark shoes; a player whose last item is
underwear needs isolation. Both are achievable but can be denied. **No permanent lockout exists**
(the denier must keep spending resources, and machines are public), but a hostile table can
lengthen an endgame — the [C-risk-2] Munchkin shape, unmitigated and now more available because
victory is fully public and the game ends the instant someone finishes.

### 8.5 Gang's permanent machine destruction

`M` decreases by exactly 1, once, irreversibly (I-13). Consequences:

- It is the **only monotone board change in the game**, and it makes contention permanently worse —
  deliberately, and it is the effect the designer observed at the table.
- **The player who draws Gang chooses the target**, which is a targeted, gain-free attack on whoever
  has most invested in that washer. The contents return to hands unharmed, so the damage is
  positional rather than material — much gentler than it sounds, and a point in the design's favour.
- **[!] Interaction gap:** Gang on Jimothy's machine is undefined (§5.2, [OQ-06]).
- **[!] Minor:** at `P=3`, `M` drops from 4 to 3, a 25% board reduction, and blanket monopolisation
  plus Jimothy uptime can then leave **one** usable machine. Worth watching at low player counts.

### 8.6 **[!] Victory must be checked after the full reckoning, not during it**

Simultaneous victory is explicitly allowed, and the brief says the game ends "immediately" when a
player finishes. Taken literally at the moment a machine resolves, **machine index order would
determine the winner**: if A completes on M1 and B completes on M3 in the same reckoning, ending at
M1 would rob B of a shared win.

**[A-30] The reckoning must complete for every machine, and victory is then checked in Phase 5.**
Machines are independent, so this is well-defined and order-free. This costs nothing and is required
for "simultaneous victory is possible" to mean anything.

### 8.7 **[!] The crowding rule may not earn its rules text**

The sim measured crowding firing on **0.0–1.1% of reckonings** — 0.0% for both competent policies at
every player count. The arithmetic explains why: with mean occupancy ~1.3, most machines hold 0–2
items and *cannot* crowd. Even a full 4-item machine with uniformly distributed types has only
`175/2401 = 7.3%` chance of containing 3+ of a type; a 3-item machine, `7/343 = 2.0%`.

v8 raises `L` to 1.5 and shrinks `M_eff`, so it will fire more often than the sim showed — but from
a base of essentially zero. **It is a rule every player must learn, that constrains every loading
decision, and that almost never resolves.**

Options: (a) keep it as a rare gotcha and legibility tax; (b) lower the threshold to 2 of a type,
making it a live constraint (and much harsher); (c) cut it and reclaim the rules budget — the
comparables report's [R-5.4] specifically notes the current rules load is heavier than the theme
promises. **No recommendation** — this is a design call, but the sim data should be put in front of
the designer, because a rule firing 0.0% of the time is worth knowing about.

### 8.8 Other findings

1. **[!] Targeted attacks now come from events, not the die.** Roll-4 was correctly repaired
   (any item, including your own). But **Gang's target and Jimothy's placement are both chosen by
   the drawer**, which is the [C-risk-4] shape — one player points at one machine. Mitigating: both
   are downstream of a blind draw, so neither is repeatable on demand, and Gang happens at most once
   per game. Acceptable; flagged for playtest.
2. **The Wash net is now the hardest card in the deck to use** (§6.7) — narrowed to same-turn loads,
   plus the one-day fresh delay, plus needing underwear in hand at the right moment. Sim measured it
   at 0.18–0.26 plays/game *before* the narrowing. It may now be close to unplayable; the composition
   sweep should check whether it deserves a slot.
3. **Jimothy squats roughly doubled** (§5.5) with fright deleted: 2.8–6.2 days at ~38–41% uptime.
   At `M = 4` (3 players, or 4 players after Gang) that is a quarter of the board, two days in five.
   Combined with §8.2 this is the second-largest contributor to `M_eff` collapse.
4. **The keyholder can waste their action** on a Jimothy machine or a destroyed one. The destroyed
   case should be an illegal move; the Jimothy case is legal but inert (worked example B7).
5. **Deals are now much more uniform** — each player misses only 4 of 14 cards, versus 6 of 16 and 8
   of 18 in earlier versions. Deal variance as a source of unfairness is largely gone. Good.
6. **The key is weak** and gets weaker as `M` grows: one toggle per day out of 7 machines at 6
   players. §8.2's fix (b) — letting it restore the board after a Circuit break — would give it a
   genuine moment without adding a permanent power.
7. **No hidden-from-everyone state remains** (§3.2), which is both an implementation simplification
   and a win for the brief's open-information positioning.

### 8.9 Hand-resolvability audit

| Requirement | Status |
|---|---|
| No hidden bookkeeping | **PASS, conditional on [A-28].** Persistent per-item state is now exactly one bit (`damp`, socks only), and [A-28] puts it in a public face-up zone. `netProtected` is encoded physically by stacking the underwear on the net card [A-25]. Hostage status is derived from the raccoon's position. Nothing requires memory. |
| Reckoning inputs visible at the machine | **PASS.** `RESOLVE_MACHINE` reads only the machine's items, its attached cards, and whether Jimothy sits on it. |
| Bounded per-machine scan | **PASS.** Gates, then two pre-ladder checks, then four commuting passes. Because they commute, a table may do them in any order. |
| **Pure conjunction, no exceptions** | **PASS — new in v8.** Deleting the Handwash basket removed the only non-monotone element (§6.1). |
| Capacity self-enforcing | **PASS** if machine mats print 4 slots. |
| Destroyed machines self-documenting | **PASS.** The Gang card sits on the washer. |
| Deterministic, replayable | **PASS** with seeded RNG for the die, both decks, and the deal. Machine index order is for tidiness only — except for victory, which must wait for the full reckoning [A-30]. |
| Pure reducers | **PASS.** Impure steps per day: `P` die rolls, at most one two-card special draw, at most one event draw. |

**[CONFLICT] — remaining divergences:**
- **[OQ-07] damp state.** Trivial digitally if private; unenforceable physically. Resolved public.
- **[OQ-13] hidden hands.** Good for tension, requires `playerView` stripping, and gives an MCTS bot
  imperfect information. The brief's own open-information commitment cuts the other way.
- **Turn structure.** Four ordered sub-moves per turn (§3.2) is natural at a table and needs an
  explicit `endTurn` in boardgame.io rather than a move counter.

---

## 9. WHAT THE BALANCE SIMULATION MUST MEASURE

Special item deck composition remains **P0 and unresolved**. Below is what a v8-rules run needs to
produce. **Note the archived run cannot be reused** — machine counts, Gang, Electricity/Circuit
break, Animal control's deck, fright, the basket, bedding, and loading mandate have all changed.

### 9.1 Validate the rules before tuning the deck

| Metric | Why | Red flag |
|---|---|---|
| **Realized `L`** | Predicted to pin at ~1.45–1.5. Everything downstream depends on it. | Below 1.4 means hand-shortage or board-jam is biting more than expected. |
| **Days to full recovery after a Circuit break, and E[ON] machines** | **§8.2 predicts E[ON] = 27–57% of the board.** This is the single most important number in the run. | E[ON] below 60% at any player count. |
| **Board-jam rate** — player-turns where `legalPlacements < rolled` | §4.2, [A-05]. Predicted to spike after Circuit break. | Any sustained rate above ~5%. |
| **Game length distribution** (P50, P90, P99), and table-time at 60–90 s/player-day | §8.3 predicts 11–16 days. | P90 above ~25 days at any count. |
| **Dead-reckoning rate** (ON machines washing nothing) | [C-risk-1]. | Above ~40%. |
| **Non-termination rate** at a large day cap | No formal guarantee exists (§8.3). | Any non-zero rate. |

### 9.2 Occupancy — measured the right way this time

§2.4 argues the previous model used the wrong statistic. The run should report:

- **Occupancy at the end of the roll phase** (the moment capacity is tested), not a day-average.
- **The full per-machine occupancy distribution**, not just the mean — specifically `P(occupancy = 4)`
  and `P(≥1 machine at capacity)` per day. Predicted Poisson *floor*: 10.6 / 15.8 / 20.9 / 25.8% at
  P = 3/4/5/6.
- **`M_eff`** = machines that are ON, undestroyed, Jimothy-free, and not blanket-monopolised —
  tracked over time, since Gang and Circuit break change it mid-game.
- **Load offers facing a full machine** — the sim's own best contention statistic, and the one that
  refuted the mean-occupancy model.
- **A clustering measure** — e.g. the Gini coefficient of items across machines, compared against
  the Poisson baseline. If bots cluster less than humans, their contention numbers are a lower bound
  and should be labelled as such (§2.4 reason 5).

### 9.3 Special item deck composition — the actual P0

Sweep copy counts for all seven cards, measuring for each:

| Card | Key question |
|---|---|
| **Sanitizer** | The only counter to the shoe class. What frequency makes dark shoes a threat rather than a wall? Measure washes-per-reckoning with and without it present. |
| **Coin** | Under the one-shot default [A-15], how often is it used to recover from a Circuit break? If that dominates its usage, that is evidence §8.2 needs fixing rather than the Coin being buffed. |
| **Coloring** | Sim measured ~0.6 items ruined per play — weaker than its name. Does the narrative match the effect? |
| **Wash net** | **Measure plays per game.** Predicted near-zero after the v8 narrowing (§8.8.2). If it is under ~0.2, it does not deserve a slot. |
| **Snacc** | Dead ~60% of days. Draw-two-keep-one should mostly fix it — verify by measuring how often a player is *forced* to keep a dead card. |
| **Color catcher** | Sim measured 0.13–0.23 plays/game — nearly dead. Depends entirely on Coloring's count. |
| **Bleach** | 0.39–0.62 plays/game. |
| **All** | Marginal effect of each card's count on wash throughput and game length. |

### 9.4 Fairness, events, and endgame

| Metric | Why |
|---|---|
| **Jimothy uptime and squat distribution** | §5.5 predicts 38–41% uptime, 2.8–6.2 day mean squat, long tail. Verify, and report P90/P99 squat. |
| **`P(Animal control or Snacc available when Jimothy arrives)`** | The self-correcting counter-probability (§2.6) is a design claim that should be measured. |
| **Gang timing and its effect on `M_eff`** | When does it fire, and what does the board look like after? Especially at `P=3`, where `M` 4→3 is a 25% cut (§8.5). |
| **Win rate by seat** | Sim showed up to 5.09pp edge at P=3. v8 adds the event-reveal asymmetry (§3.3) — does [A-09]'s rotating acting order neutralise it? |
| **Leader-targeting** — Gang, Jimothy placement, and Coloring aimed at the leader in the final 3 days | [C-risk-2]. Both event targets are drawer's choice (§8.8.1). |
| **Damp socks frequency** | How often is the socks/blanket exception used, and is it a real decision or a trap? If usage is near zero, it is a rule nobody needs; if it is the dominant response to board-jam, that confirms §8.2. |
| **Crowding fire rate under v8** | §8.7 — from a base of 0.0–1.1%. |

### 9.5 Sensitivity runs, independent of deck tuning

1. **Circuit break variants** — as written vs auto-restore vs half-board vs keyholder-restores-all
   (§8.2 options a–e). **This is the highest-priority run.**
2. **Coin one-shot vs persistent** [OQ-02], crossed with the Circuit break variants, since §4.4
   argues the two questions are coupled.
3. **Sanitizer machine-wide vs owner-only** [OQ-01] — mostly to confirm the structural argument is
   not costing anything the owner-only version would deliver.
4. **Gang on Jimothy's machine**, options (a) vs (b) [OQ-06] — measures whether restoring a third
   Jimothy exit is needed.
5. **Crowding threshold 3 vs 2 vs removed** [OQ-07 in §8.7].
6. **Player-count sweep with the §8.2 fix applied** — to check whether 5–6 player games become
   acceptable once Circuit break is repaired, or whether machine counts also need revisiting.

---

## 10. SIGN-OFF CHECKLIST

| Pri | ID | Question | v0.4 default |
|---|---|---|---|
| **P0** | §2.5 | Special item deck composition | **Deferred to simulation** (§9.3) |
| **P0** | §8.2 | **Circuit break recovery is oppressive at 5–6 players** | **Auto-restore after one day, or let the keyholder restore all.** Highest-priority fix |
| **P1** | OQ-01 | Sanitizer scope | **Machine-wide** [A-21] — owner-only breaks single-tier-per-machine |
| **P1** | OQ-02 | Coin persistence | **One-shot** [A-15] — *conditional on fixing §8.2; decide together* |
| **P1** | OQ-06 | Gang destroys Jimothy's machine — undefined | **Destroy, release, relocate Jimothy** [A-16] |
| **P1** | OQ-11 | Victory checked after the full reckoning | **Yes** [A-30] — otherwise index order picks the winner |
| **P1** | OQ-04 | Socks rule keys on contents, not the blanket's verdict | **Contents** [A-24] — preserves commutativity |
| **P1** | OQ-07 | Damp state public? | **Yes, face-up damp zone** [A-28] |
| **P1** | OQ-08 | Mandatory loading with no legal placement | **Load as many as legal, zero allowed** [A-05] |
| **P2** | §8.7 | Crowding fires 0.0–1.1% of the time — does it earn its rules text? | **No recommendation; put the data to the designer** |
| **P2** | OQ-03 | Animal control blank ~60% of the time | **Accept** [A-17] — the price of a self-correcting counter |
| **P2** | OQ-05 | Second blanket wash completes damp socks? | **Yes, any wash event** [A-27] |
| **P2** | OQ-10 | Wash net protection is a per-item flag | **Yes; stack the underwear on the card** [A-25] |
| **P2** | OQ-09 | Sub-action order within a turn | **CLOSED as roll → card → load → extra** (brief v9 §4). [A-03]'s recommendation was not adopted. |
| **P2** | §8.8.2 | Wash net may now be unplayable | **Measure before cutting** |
| **P3** | OQ-12 | Acting order | **Keyholder first, then clockwise** [A-09] |
| **P3** | OQ-13 | Hidden hands | **Yes** [A-10] — but §10 of the brief argues the other way |
| **P3** | OQ-14–24 | Minor, carried forward | as listed in §7 |
