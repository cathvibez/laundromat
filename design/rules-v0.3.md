# Laundromat — Formal Rules v0.3

**Supersedes:** `rules-v0.1.md`, `rules-v0.2.md` (both retained on disk unchanged as a record).
**Formalizes:** `design/game-brief.md`. **[!] Version discrepancy:** the file's title line reads
*Design Brief v4* but its Jimothy section is marked *REVISED v5* and the coordinator refers to it
as v5. This document specs the file **as it stands**; the header should be corrected to v5.
**Informed by:** `design/comparables.md` (separate research agent), whose top-5 risk list is
referenced throughout as **[C-risk-n]** and whose recommendations as **[R-n.n]**.

**Purpose:** precise enough to (a) resolve at a physical table with no hidden bookkeeping, and
(b) implement directly as pure reducer functions in boardgame.io.

**Tags.** **[A-nn]** assumption I introduced, collected in §6, awaiting sign-off. **[!]**
integrity problem, see §7. **[CONFLICT]** hand-resolvability vs implementation. **[v5]** changed
this pass.

### Designer rulings absorbed this pass

| v0.2 question | Ruling | Effect here |
|---|---|---|
| **P0 linen in tiers** | **Fixed.** Tiers operate on all items. A dark blanket washes on tier 3 exactly as a dark shirt does; linen constraints are filters on top. | §5.5 collapses from a blocking defect to a one-line statement. The game is winnable. |
| **P0 Electricity self-defeat** | **Fixed** by moving *all* events before reckoning. | §7.3's option (b) — the one I called the higher-value two-for-one — was taken. Both Gang and Electricity now do what their text says. |
| **Tier 2 inversion** | **Confirmed as written. Closed.** Shoes are their own dirtiness class above all garments; teaching line *"shoes first, then dark, then light."* | Recorded in §5.4 as settled. Not reopened. |
| **Crowding `kind`** | `kind = garment type, any color or shade`. | §5.7. My arithmetic-death finding for the owner-based readings is confirmed and retained as justification. |
| **One-day card delay** | fresh/ready two-zone mechanism **adopted as the actual rule**. | §3.4 promotes from implementation note to rules text. |
| **Handwash basket** | **Extraction model confirmed.** | §5.3, and it is what keeps the commutativity result intact (§5.1). |

### New this pass

1. **Machine count cut** to 3/3/4/4. Occupancy arithmetic independently verified in §2.2 — the
   designer's figure is correct and the case is actually *stronger* than stated.
2. **Capacity 4** per machine, uniform.
3. **New dice table** — every face loads; loading is now **"up to"**, i.e. optional.
4. **Victory extended** by a rotation-completion rule. §7.4 shows it **cannot change the winner**.
5. **Snack** and **Animal control** special items.
6. **Jimothy fully specified** — hostage mechanic. §5.11 and §7.5 stress-test him.

---

## 1. GLOSSARY

### 1.1 Canonical terms

| Term | Status | Definition |
|---|---|---|
| **item** | **CANONICAL** | The atomic unit of laundry: one card. Attributes `owner`, `shade` (`dark`\|`light`), `type` (one of eight, §2.1), `id`, and — bedding only — `washCount`. Brief v5's §1 now says "**Item** = any of the above. The reckoning tiers operate on **items**", which adopts this term. |
| **garment** | **ALIAS — deprecated** | Still used in the brief for the roll of 4 and the Handwash basket. Treat every occurrence as *item*. **Do not read it as "clothes but not linen"** — under that reading roll-4 could not move a blanket and the basket could not take bedding, both of which would be arbitrary. [A-01] |
| **clothes** | **CANONICAL (category)** | `{shoes, socks, pants, shirts, hats}`. Now used *only* for taxonomy and flavour — **[v5]** it no longer appears in any rule, because the tiers operate on items. |
| **linen** | **CANONICAL (category)** | `{underwear, blanket, bedding}`. Likewise now taxonomy only; the three linen *constraints* name their types directly. |
| **shade** | **CANONICAL** | `dark` \| `light`. Intrinsic, printed, never mutated. |
| **effective shade** | **CANONICAL** | The shade an item is treated as having for **one reckoning of one machine**, after Bleach. Never persists. |
| **type** | **CANONICAL** | One of the eight values in §2.1. The crowding rule's equivalence class. |
| **kind** | **RETIRED** | **[v5]** Resolved to `type`. The word is no longer needed; the crowding rule says *type* directly. |
| **machine** | **CANONICAL** | Board zone with identity `M1..M(M)`, `power ∈ {ON, OFF}`, up to **4** loaded items, attached special item cards, and possibly Jimothy. Fully public. |
| **capacity** | **CANONICAL, NEW [v5]** | 4 items per machine, at every player count. Counts **items only** — Jimothy does not consume a slot [A-14]. A machine holding a blanket has occupancy 1 but accepts nothing (§4.7). |
| **loaded** | **CANONICAL** | An item is loaded iff it is in a machine. Public. |
| **washed** | **CANONICAL** | Terminal verdict: the item leaves play to its owner's **clean pile** and counts toward victory. Bedding excepted (see *wash event*). |
| **wash event** | **CANONICAL** | One successful wash of one item, by a machine or by the Handwash basket. Every type but bedding: one event = clean. Bedding needs two. |
| **sent back** | **CANONICAL** | Terminal verdict: removed from the machine to the owner's **hand**, no penalty. Bedding keeps its `washCount`. |
| **retained** | **CANONICAL** | Non-verdict: the item stays loaded into the next day because its machine did not run (power OFF). |
| **hostage** | **CANONICAL, NEW [v5]** | An item in Jimothy's machine. **Derived, never stored:** `isHostage(i) ≡ (jimothy ≠ null ∧ i.machine == jimothy.machine)`. A hostage item is not washed, not sent back, and not retained-in-the-ordinary-sense: it is frozen until Jimothy leaves, at which point it is **released**. See §5.11 and §7.5. |
| **released** | **CANONICAL, NEW [v5]** | What happens to hostage items when Jimothy leaves: they are **sent back to their owners' hands**, immediately, no penalty. Release is not a wash and never was a chance at one. |
| **fright** | **CANONICAL, NEW [v5]** | The departure of Jimothy caused by resolving **Gang** or **Electricity** while he is in play. |
| **day** | **CANONICAL** | = round. One pass of §3's six phases. |
| **reckoning** | **CANONICAL** | Phase 5: independent resolution of every ON machine without Jimothy. |
| **event resolution** | **CANONICAL** | Phase 4 — **[v5] now *before* reckoning**, which is what makes Electricity and Gang work. |
| **pending event** | **CANONICAL** | A face-down event card laid in Phase 1, awaiting Phase 4. Its existence is public; its identity is hidden from **every** player including the one who laid it. Max one per day. |
| **turn order** | **CANONICAL** | Fixed clockwise seating, set at setup, never changes. |
| **acting order** | **CANONICAL** | Order within a phase: keyholder first, then clockwise [A-11]. Because the key rotates daily, the valuable last-actor slot rotates with it — see §7.2. |
| **keyholder** | **CANONICAL** | Holder of the key for the current day. Passes at end of day. |
| **hand** | **CANONICAL** | Unloaded, unwashed items plus **ready** special item cards. Hidden [A-12]. |
| **fresh** | **CANONICAL [v5, now rules text]** | A **face-up** zone in front of each player holding special item cards drawn **today**. Cannot be played. Promoted wholesale to *ready* at end of day. Face-up per the brief — so card identity in the fresh zone is **public**, unlike the ready hand. [A-02] |
| **ready** | **CANONICAL [v5]** | Special item cards drawn on an earlier day. Playable. Held hidden. |
| **clean pile** | **CANONICAL** | Public, face-up, per player. Monotone — nothing ever removes a card from it. This is the property that decides §7.4. |
| **must-wash set** | **CANONICAL** | The exactly 10 items dealt at setup. Fixed. |
| **finished** | **CANONICAL, NEW [v5]** | A player whose clean pile equals their must-wash set (all 10). Finishing does **not** end the game — see §3.1 Phase 6 and §7.4. |
| **rotation** | **CANONICAL, NEW [v5]** | A block of `P` consecutive days in which each player holds the key exactly once. Since the key passes strictly and starts at seat 1 on day 1, **a rotation is complete exactly when `round mod P == 0`** (§3.5). |

### 1.2 Eliminated

**garment**, **piece** → *item*. **kind** → *type*. **"special item"** as a name for linen →
*linen* (already fixed by the brief). The word **basic** in the taxonomy table carries no meaning
and is dropped.

---

## 2. COMPONENT MANIFEST

### 2.1 Item types

| `type` | category | per shade | per color |
|---|---|---|---|
| `shoes` | clothes | 1 | 2 |
| `socks` (a pair, one card) | clothes | 1 | 2 |
| `pants` | clothes | 1 | 2 |
| `shirts` | clothes | 1 | 2 |
| `hats` | clothes | 1 | 2 |
| `underwear` | linen | 1 | 2 |
| `blanket` | linen | 1 | 2 |
| `bedding` | linen | 1 | 2 |
| **TOTAL** | | **8** | **16** |

A color holds at most **2 cards of any type** (one per shade) and **1 card of any (type, shade)**.
This is what makes the crowding rule's resolved reading the only workable one (§5.7).

### 2.2 Machines — independent verification of the occupancy arithmetic

**The designer's claim:** expected occupancy at `players+1` machines was ~0.86 items per machine
per day, each player loading 1.0 items/day in expectation under the old dice table.

**Step 1 — old load rate.** Old table: faces 1/2/3 load 1/2/3 items (mandatory), faces 4/5/6 load
none. `E[load] = (1+2+3+0+0+0)/6 = 6/6 = 1.0` items per player per day. **Confirmed.**

**Step 2 — old occupancy.** ON machines empty every reckoning, so standing occupancy at reckoning
≈ the day's inflow. `O = L·P/M` with `M = P+1`:

| P | M(old) | O(old) |
|---|---|---|
| 3 | 4 | 0.750 |
| 4 | 5 | 0.800 |
| 5 | 6 | 0.833 |
| 6 | 7 | **0.857** |

**The 0.86 figure is correct — and it is specifically the 6-player case, i.e. the most crowded
configuration the old rules could produce.** The 3-player game sat at 0.75. So the diagnosis was
right and if anything **understated**: the designer quoted their own worst case as though it were
typical.

**Step 3 — the sharper statistic.** Occupancy alone undersells it. Modelling per-machine
occupancy as Poisson(`O`), the fraction of machines sitting **completely empty** at reckoning:

| P | M(old) | O | P(machine empty) | **expected empty machines** |
|---|---|---|---|---|
| 3 | 4 | 0.750 | 47.2% | **1.89** |
| 4 | 5 | 0.800 | 44.9% | **2.25** |
| 5 | 6 | 0.833 | 43.5% | **2.61** |
| 6 | 7 | 0.857 | 42.4% | **2.97** |

**Under the old rules roughly 45% of the board was empty every single day, and at 6 players
almost exactly three machines sat unused.** A player who wanted to avoid everyone could nearly
always find a private machine. That is the number that proves the "multiplayer solitaire"
diagnosis, and it is a far more damning statistic than 0.86. **The reduction is justified.**

**Step 4 — redo for the new dice table and machine counts.** New table: faces 1/2/3 load up to
1/2/3, faces 4/5/6 load up to 1. `E[load]` at full loading `= (1+2+3+1+1+1)/6 = 9/6 = 1.5`.
**Because loading is now optional ("up to"), 1.5 is a ceiling, not an expectation** — see the
caveat below.

| P | M(new) | O(new) @ L=1.5 | P(empty) | expected empty machines | **ratio to old** |
|---|---|---|---|---|---|
| 3 | 3 | **1.500** | 22.3% | 0.67 | 2.00× |
| 4 | 3 | **2.000** | 13.5% | 0.41 | 2.50× |
| 5 | 4 | **1.875** | 15.3% | 0.61 | 2.25× |
| 6 | 4 | **2.250** | 10.5% | 0.42 | 2.62× |

**Verdict: the new counts achieve the intent.** Occupancy rises 2.0×–2.6×, and the "free machine"
disappears — expected empty machines fall from ~1.9–3.0 down to ~0.4–0.7. A player can no longer
reliably find an uncontested machine, which is exactly [C-risk-1]'s prescribed direction and
[R-1.3].

**Step 5 — capacity pressure.** Total board capacity `4M`; daily inflow `1.5P`:

| P | M | inflow/day | board capacity | utilisation |
|---|---|---|---|---|
| 3 | 3 | 4.5 | 12 | 37.5% |
| 4 | 3 | 6.0 | 12 | 50.0% |
| 5 | 4 | 7.5 | 16 | 46.9% |
| 6 | 4 | 9.0 | 16 | **56.2%** |

Capacity 4 sits above mean occupancy (1.5–2.25) and above the crowding threshold (3), so it does
what the brief intends: **crowding can fire before a machine fills.** Under Poisson(O), capacity
blocks a placement roughly 7% of the time at 3 players and 19% at 6 — present but not oppressive.

**Two findings the designer should see:**

- **[!] Non-monotonicity at P=4.** Occupancy runs 1.50 → **2.00** → 1.875 → 2.25. **The 4-player
  game is more contested than the 5-player game.** Adding a fifth player makes the board *looser*,
  which is counter-intuitive and will read as a tuning bug at the table. With integer machine
  counts and `L = 1.5` it cannot be fully removed, but the designer should know P=4 is the tightest
  configuration relative to its neighbour. `M = 3/4/4/5` would give 1.50/1.50/1.875/1.80 — flatter
  and monotone-ish, at the cost of a looser 4-player game. **No change recommended; flagged.**
- **[!] L = 1.5 is a ceiling, not an expectation.** Every occupancy figure above assumes players
  always load the maximum. **They will not**, because loading is now optional and a bad load is
  strictly worse than no load. If realized `L` drops to, say, 1.0, occupancy falls back to
  1.00/1.33/1.25/1.50 — better than the old 0.86 but well short of the target. **The machine
  counts are correct *conditional on players actually loading*, and the "up to" rule is precisely
  what puts that in doubt.** This is the single most important thing for the balance simulation to
  measure (§8).

### 2.3 Totals by player count

| Players | Machines | Board capacity | Item cards in play | Cards dealt | Cards inert |
|---|---|---|---|---|---|
| 3 | 3 | 12 | 48 | 30 | 18 |
| 4 | 3 | 12 | 64 | 40 | 24 |
| 5 | 4 | 16 | 80 | 50 | 30 |
| 6 | 4 | 16 | 96 | 60 | 36 |

**[A-03]** The 6 undealt cards of each color are set aside face-down and are **inert** — never
drawn, revealed, or referenced.

### 2.4 Setup

1. Establish seating. Each player takes their 16-card color deck.
2. Each shuffles and draws **10 items** — their must-wash set, fixed for the game. The other 6 go
   face-down and inert.
3. Place `M` machines per §2.2, all **ON** and empty.
4. Seat 1 takes the key and holds it for all of day 1 (the key passes at *end* of day).
5. Shuffle the special item deck and the event deck. Deal nothing from either.

### 2.5 Deal statistics that drive later sections

```
P(dealt zero linen)           = C(10,10)/C(16,10) = 1/8008 = 0.0125%
P(dealt at least one blanket) = 1 − C(14,10)/C(16,10)      = 87.5%
P(dealt at least one bedding) = same                        = 87.5%
Expected linen per player     = 10 × 6/16                   = 3.75 items
Expected blankets per player  = 10 × 2/16                   = 1.25 cards
Expected bedding per player   = 1.25 cards
Expected wash events needed   ≈ 10 + 1.25                   = 11.25
```

The first line is why the linen ruling was P0: under the old literal tiers, 7999 deals in 8000
were unwinnable. **Now resolved.** The blanket line drives §7.6's opening-book problem; the
bedding line means the nominal 10-item task is really ~11.25 wash events.

### 2.6 Special item deck — **P0, deliberately unresolved**

**Seven card types [v5]:** Coloring, Color catcher, Bleach, Wash net, Handwash basket, **Snack**,
**Animal control**. Copy counts are **P0 and are not proposed here** — a balance simulation is
running to inform them. §8 states exactly what that simulation must measure.

Structural facts that hold regardless of composition:
- One shared deck. Drawn on a roll of 5, into the **fresh** zone (face-up).
- Played cards attach to a machine (or resolve immediately, for basket/Snack/Animal control) and
  shuffle back into the deck. There is no discard pile.
- Draw rate is exactly `P/6` cards per day (0.50 at 3 players, 1.00 at 6) — one face in six, per
  player, unchanged across every brief version.
- **[!] Two of the seven types are Jimothy-only.** Snack and Animal control are held indefinitely
  with no redraw and no discard-for-value clause (explicit in the brief), so drawing one while
  Jimothy is absent is a **wasted draw**. Their combined share of the deck must be matched to
  Jimothy's uptime, which couples the two P0 deck compositions to each other. See §8.

### 2.7 Event deck — **P0, deliberately unresolved**

Three card types: **Gang**, **Electricity**, **Jimothy**. Straw proposal in the brief is
Gang ×2, Electricity ×2, Jimothy ×3 — **not adopted here**, but §7.5.9 works through its
consequences because they are severe and the simulation should start from them.

### 2.8 Other components

| Component | Count | Purpose |
|---|---|---|
| Key | 1 | Marks the keyholder. |
| Die | 1 (d6) | Rolled once per player per day. The only randomiser in play besides the two decks. |
| Machine power markers | M | ON/OFF. |
| **Jimothy figure** | **1** | **[v5]** A physical token. Exactly two locations: **on a machine**, or **off-board**. When off-board his event card is in the event deck. See §5.11.1 for why this resolves an apparent contradiction in the brief. |
| Bedding wash tokens | 2 per player | One accrued wash event. Public [A-04]. |
| Fresh-zone marker | 1 per player | Physically separates fresh (face-up) from ready (hidden). |
| Capacity markers | optional | 4 printed slots per machine mat make capacity self-enforcing. Recommended. |

---

## 3. ROUND STATE MACHINE

### 3.1 Phase list — **[v5] six phases, events now before reckoning**

`order(k)` = keyholder first, then clockwise [A-11].

**PHASE 1 — ROLL**
- *Actors:* every player once, in `order(k)`, sequentially.
- *Effect:* roll 1d6, resolve per §4. Every face loads up to some number of items; some faces add
  a second action.
- *Exit:* all players have rolled and resolved.

**PHASE 2 — SPECIAL ITEM**
- *Actors:* every player once, in `order(k)`, sequentially [A-13].
- *Legal actions, choose one:* play **one** card from the **ready** hand, or pass.
- *Constraints:* cards in the **fresh** zone cannot be played. One play per player per day. No
  hand limit [A-05]. Handwash basket, Snack, and Animal control resolve **immediately on play,
  here in Phase 2**; Coloring, Color catcher, Bleach, and Wash net **attach** to a machine and
  resolve during Phase 5.
- *Exit:* all players played or passed.

**PHASE 3 — KEY**
- *Actor:* keyholder only.
- *Legal actions, choose one:* turn one machine ON; turn one machine OFF; pass.
- No bonus roll. No other key power exists.
- *Exit:* acted or passed.

**PHASE 4 — EVENT RESOLUTION [v5, moved before reckoning]**
- *Effect:* if a pending event exists, reveal it and resolve it fully (§5.11), then shuffle it
  back into the event deck. If none, skip.
- *Actor:* none for Gang and Electricity (fully automatic). **Jimothy requires one choice** — the
  machine he occupies, chosen by the player who laid the card [A-15].
- *Exit:* event resolved or absent.

**PHASE 5 — RECKONING**
- *Suppression:* if Electricity resolved in Phase 4 this day, **Phase 5 is skipped entirely** and
  every machine retains its contents. **[v5] This now works as the card text says**, because the
  event precedes the reckoning it cancels.
- *Effect:* for each machine in ascending index order, run `RESOLVE_MACHINE` (§5.2). Machines are
  mutually independent — no machine's resolution reads or writes another's state — so index order
  exists only for replay tidiness and orderly table procedure.
- *Post-effect:* **every ON machine without Jimothy is empty of items.** Special item cards
  attached to those machines shuffle back into the deck; cards on OFF or Jimothy machines stay
  attached [A-06].
- *Exit:* all machines resolved or skipped.

**PHASE 6 — END OF DAY**
- *Effects, in this order:*
  1. **Finish check.** Any player whose clean pile equals their must-wash set is marked
     **finished** (recording the day). Finishing does not end the game.
  2. **Fresh → ready.** Every card in every fresh zone promotes.
  3. **Key passes** to the next player in turn order.
  4. `round += 1`.
  5. **Game-end check.** If at least one player is finished **and** `round mod P == 0` (§3.5),
     the game ends and §3.6 determines the winner. Otherwise the next day begins.
- *Note the ordering of 3, 4 and 5:* the game-end test is evaluated **after** the round counter
  advances, so `round mod P == 0` names the number of *completed* days. See §3.5.

### 3.2 State-transition table

| # | State | ctx.actor | Legal moves | Guard | Next | Exit |
|---|---|---|---|---|---|---|
| 0 | `DAY_START` | — | — | — | `ROLL(0)` | auto |
| 1 | `ROLL(i)` | `order(k)[i]` | `rollDie()` | not yet rolled today | `ROLL_RESOLVE(i,face)` | rolled |
| 2 | `ROLL_RESOLVE(i,1..3)` | `order(k)[i]` | `loadItem(itemId, machineId)` × 0..face | item ∈ hand; `machineAccepts` (§4.7) | next | player declares done |
| 3 | `ROLL_RESOLVE(i,4)` | `order(k)[i]` | `loadItem` × 0..1 **and/or** `moveItem(itemId,from,to)` × 0..1, in either order [A-08] | move: item loaded; `to ≠ from`; `machineAccepts(to,item)`; `¬isHostage(item)` | next | declared done |
| 4 | `ROLL_RESOLVE(i,5)` | `order(k)[i]` | `loadItem` × 0..1; then `drawSpecial()` → **fresh** | deck non-empty | next | declared done |
| 5 | `ROLL_RESOLVE(i,6)` | `order(k)[i]` | `loadItem` × 0..1; then `layEvent()` | `pendingEvent == null`, else strict no-op | next | declared done |
| 6 | `SPECIAL(i)` | `order(k)[i]` | `playSpecial(cardId, target…)` or `pass()` | card ∈ **ready**; ≤1 play today; target legal (§5.3, §5.11) | `SPECIAL(i+1)` or `KEY` | played/passed |
| 7 | `KEY` | keyholder | `setPower(machineId, ON\|OFF)` or `pass()` | one machine; new ≠ old | `EVENT_RESOLVE` | acted/passed |
| 8 | `EVENT_RESOLVE` | — (Jimothy: the layer) | `revealAndResolveEvent()` | pending ≠ null, else skip | `RECKON(0)` | resolved |
| 9 | `RECKON(j)` | — | `resolveMachine(M[j])` | skipped wholesale if Electricity resolved today | `RECKON(j+1)` or `END_OF_DAY` | `j > M` |
| 10 | `END_OF_DAY` | — | finish check → promote → key passes → `round++` → game-end test | — | `GAME_OVER` or `DAY_START` | auto |
| 11 | `GAME_OVER` | — | — | — | terminal | — |

**boardgame.io mapping.** States 1–5 are one turn per player in a `roll` phase with `turn.order`
starting at the keyholder; note each turn now contains **two sub-actions on faces 4/5/6** and needs
an explicit `endTurn` because loading is optional and variable-length. State 6 is a `special`
phase. State 7 is a `key` phase, single turn. States 8–10 take no player input except Jimothy's
placement — put Phase 4's Jimothy choice in a short `event` phase owned by the laying player, and
put 9–10 in that phase's `onEnd`.

**[!] `pendingEvent` must be hidden from *every* client, including its creator** — it lives in
`G.secret` and `playerView` must strip it for all `playerID`s, not just opponents. Trivial
physically (a face-down card nobody looked at), and the one place a naive playerView leaks.

### 3.3 What changed structurally from v0.2

| | v0.2 | v0.3 |
|---|---|---|
| Phase order | roll → special → key → reckon → event → end | **roll → special → key → event → reckon → end** |
| Electricity | broken; needed a next-day hack | **works as written** |
| Gang | could only reach OFF machines | **reaches everything, pre-reckoning** |
| Dead die faces | 0 (but 3 faces loaded nothing) | 0, and **every face loads** |
| Loading | mandatory, maximal | **optional ("up to")** |
| Machines | `P+1` | **3/3/4/4** |
| Capacity | none | **4** |
| Game end | first to finish | **first to finish + complete the rotation** |

### 3.4 Fresh / ready — now rules text, not an implementation note

Each player's special item cards sit in one of two physically separated zones:

- **fresh** — drawn today, **face-up** (per the brief: "publicly auditable"). Cannot be played.
- **ready** — drawn earlier, held hidden. Playable.

A card drawn in Phase 1 enters `fresh`. In Phase 6 step 2, **every** card in **every** fresh zone
promotes to `ready`. One gesture per player per day, no memory required, publicly auditable.

**This is exactly equivalent to a per-card day-stamp** and should be implemented as a boolean, not
an integer: the only query the rule makes is `drawnOnDay == currentDay`, and the promotion step
preserves the mapping. A day-stamp would be correct digitally and *unimplementable physically* —
nothing is printed on the card and no player could audit a claim. **[A-02]**

**[!] Note the information asymmetry the brief creates:** fresh cards are **face-up** (identity
public) and ready cards are hidden. So a card is public for exactly one day, then becomes secret.
That is backwards from most games and worth confirming — it means opponents always know what you
*just* drew but never what you *hold*. It does give a real, bounded read: everyone can see a
Handwash basket coming one day out. **Recommend keeping it** — it is a cheap, legible tell and it
supports the open-information positioning in §10 of the brief. [A-02]

### 3.5 The rotation-completion condition reduces to `round mod P == 0`

The brief says play continues "until every player has held the key an equal number of times."
Given that (i) seat 1 holds the key on day 1, (ii) it passes exactly once per day, and (iii) the
order is fixed, the keyholder on day `d` is seat `((d−1) mod P) + 1`. Every player has held it
equally often exactly when the number of completed days is a multiple of `P`.

**Implementations must not track per-player key counts.** The condition is `round mod P == 0`,
O(1), and at the table it is "we stop at the end of the day the key comes back round to the player
who started." **[A-16]**

Consequence: if a player finishes on day `D`, the game ends at the end of day `D' = P·⌈D/P⌉`, so
**at most `P−1` extra days**. It is deterministic and bounded — **the rotation rule cannot fail to
terminate** (§7.4).

### 3.6 Winner determination

At game end: the winner is the player with the most washed items; ties are broken in favour of
whoever finished first.

**[A-17]** If two or more players finish during the **same reckoning**, "finished first" is
undefined — reckoning resolves machines simultaneously in semantics. Recommend **joint victory**
for players finishing on the same day. Resolving it by machine index would make the winner depend
on an arbitrary board ordering, and resolving it by seat would reward seating.

§7.4 proves that the winner is fully determined the moment the first player finishes, so this
tiebreak is the only part of §8 of the brief that can ever matter.

---

## 4. DICE OUTCOME TABLE

**[v5]** One die, once per player per day, in Phase 1. **Every face loads. No dead faces.
Loading is "up to" — never mandatory.**

### 4.1 Full table

| Face | Effect | Precise rule | Degenerate cases |
|---|---|---|---|
| **1** | Load up to 1 | Load 0 or 1 items from hand. | Hand empty or no machine accepts → 0. |
| **2** | Load up to 2 | Load 0, 1, or 2. Each item independently targeted; they may go to different machines [A-07]. | As above. |
| **3** | Load up to 3 | Load 0–3. | As above. |
| **4** | Load up to 1, **and** move one item between machines — **including your own** | The move is **optional** [A-08]. Source and destination must differ; destination must satisfy `machineAccepts`; the item must not be a hostage (§5.11). The item can never leave the machines. | No legal move → the move is simply skipped; the load still happens. |
| **5** | Load up to 1, **and** draw a special item card | The card enters the **fresh** zone face-up and cannot be played today. | Special deck empty → no draw, no compensation. |
| **6** | Load up to 1, **and** lay a face-down event card | Only if `pendingEvent == null`. Drawn blind from the event deck — **nobody looks, including the roller** — and laid on the table, not at a machine. Resolves in Phase 4. | **A pending event already exists → the event part is a complete no-op; the player still loads up to 1.** Explicit in the brief. |

**Maximum load rate:** `(1+2+3+1+1+1)/6 = 1.5` items per player per day, up from 1.0. Realized rate
is lower and player-dependent — see §2.2 step 5, and §7.2.

### 4.2 "Up to" — the consequences the brief does not draw out

Making loading optional is the biggest behavioural change in v5, and it cuts three ways.

1. **It fixes the output-randomness complaint [C-risk-3].** Previously the die told you *how many*
   items you must commit before you chose *which* — textbook output randomness. Now the die sets a
   ceiling and the player chooses their exposure. This is a genuine and well-targeted improvement.
2. **[!] It reintroduces the stall equilibrium.** v0.2 §7.2 identified mandatory loading as the
   only thing preventing "nobody loads anything dangerous, forever." That guard is now gone.
   Nobody is ever forced to put an item at risk. See §7.2.
3. **[!] It converts the dark shoe from a liability into a chosen weapon.** Under mandatory
   loading, dumping a dark shoe into a contested machine was often something the die *made* you do
   — non-targeted, blameless, exactly the Coloretto shape the comparables praise [R-3.3]. Under
   optional loading, every dark shoe placed into a machine holding three opponents' items is a
   deliberate, targeted, gain-free attack. **The die's fix for [C-risk-3] partially re-opens
   [C-risk-4] through a different door.** The mitigating factor is that the attacker also burns
   their own dark shoe, which they must eventually wash — so the attack has a real opportunity
   cost, which is precisely what the comparables report says makes interference healthy. On
   balance I judge this acceptable, but it should be watched in playtest and measured by the sim.

### 4.3 Face 4 — displacement, precisely

**[v5] The v0.2 targeting problem is fixed exactly as [R-3.1(b)] prescribed:** the move may take
*any* item including your own, so it is a positioning tool rather than a mandatory attack.

- Any item in any machine, any owner, including the mover's own.
- Source ≠ destination; destination must satisfy `machineAccepts` (§4.7), which now includes
  capacity and Jimothy.
- The item can never return to a hand this way.
- **[A-08]** The move is **optional**, and the load and the move may be taken **in either order**,
  the player declaring which. Order matters: moving an item out of a full machine frees a slot to
  load into, and loading first may fill the slot you wanted to move into. The reducer should expose
  them as two ordered sub-moves within one turn.
- **[A-09]** A blanket may be moved, but only into an **empty** machine.
- Hostage items cannot be moved (§7.5.4).

### 4.4 Face 6 — the pending event

- Drawn blind. **Nobody sees it, including the roller.**
- At most one per day; the first 6 creates it, later 6s load only.
- Global, on the table, not at a machine. No card peeks at, redirects, or cancels it.
- **[A-10]** It never carries over — it always resolves in Phase 4 of the same day.

**Event frequency** `= 1 − (5/6)^P`: **42.1% / 51.8% / 59.8% / 66.5%** at 3/4/5/6 players.
Unchanged from v0.2 in probability but now far more consequential, because events resolve before
reckoning and one of them is Jimothy.

**[!] Face-down is now the wrong choice — see [OQ-05].** Events were moved before reckoning
specifically so they could matter. But the card is laid in Phase 1 and revealed in Phase 4, which
means **every decision in the day — loading, special items, the key — is made before anyone knows
what the event is.** That is precisely the shape [R-2.2] criticises: an unannounced global wipe
that "nobody at the table can plan around." Laying it **face-up** would cost nothing structurally
and would convert Phases 2 and 3 into genuine decisions under a known threat. This is now the
single cheapest high-value change available. Recommended in §6, flagged as awaiting sign-off.

### 4.5 Universal no-op rule

Any die outcome that cannot be legally executed is discarded with no effect: no re-roll, no
substitution, no compensation. Covers an empty hand, a full or blocked board, no legal move on a
4, an empty special deck on a 5, and an already-pending event on a 6.

### 4.6 `machineAccepts(machine, item)` — the sole placement-legality predicate

Governs loads (all faces) and moves (face 4) identically.

```
machineAccepts(machine, item):
    if machine has Jimothy                        -> FALSE   # cannot be loaded [v5]
    if machine contains a blanket                 -> FALSE   # nothing joins a blanket
    if item.type == blanket and machine non-empty -> FALSE   # a blanket joins nothing
    if occupancy(machine) >= 4                    -> FALSE   # capacity [v5]
    otherwise                                     -> TRUE
```

`occupancy` counts **items only**; Jimothy occupies no capacity slot [A-14] (moot, since his
machine rejects everything anyway, but the reducer needs the definition). Power state does not
affect placement legality. The Handwash basket's extraction is not a placement and is not governed
by this predicate.

---

## 5. THE RECKONING ALGORITHM

### 5.1 Structure — and whether HOSTAGE breaks the commutativity result

**The result, restated.** Rules bearing on a machine's resolution fall into three classes:

| Class | Rules | Direction |
|---|---|---|
| **(a) Shade remapping** | Bleach | Changes the input to tier selection. Must run first. |
| **(b) Tier selection + provisional verdict** | the four-tier ladder | The baseline. |
| **(c) Monotone downgrades** | underwear isolation, blanket exclusivity, crowding, Coloring/Color catcher | Can only turn `WASHED → SENT_BACK`. |

Each class-(c) rule computes its demotion set from the machine's contents and attached cards only —
never from another item's current verdict. So the outcome is a conjunction:

```
washed(i) = tierMatch(i) ∧ ¬isolationViolated(i) ∧ ¬crowded(i) ∧ ¬ruined(i)
```

Order-independent. **The only load-bearing ordering constraint inside a machine remains Bleach
before tier selection.**

---

**Does HOSTAGE break it? — No, and for a clean structural reason.**

The coordinator asks because HOSTAGE looks like a third verdict alongside WASHED and SENT_BACK,
and a third value in the codomain would ordinarily threaten a boolean conjunction.

**It is not a verdict. It is a gate, and it sits at S0 alongside `power == OFF`.**

A machine occupied by Jimothy **cannot run** (brief, §7). `RESOLVE_MACHINE` returns at S0 before
any shade is computed, before any tier is selected, and before any filter is applied. The items in
that machine never enter the ladder. So the function's *effective* codomain over items that reach
S1 is unchanged: `{WASHED, SENT_BACK}`. The conjunction above is untouched, and the S4–S7 filters
still commute.

More precisely, the reckoning has two gate outcomes and two verdicts:

| Outcome | Produced at | Meaning | Reached the ladder? |
|---|---|---|---|
| `RETAINED` | S0, `power == OFF` | Stays loaded; may reckon on a later day. | No |
| `HOSTAGE` | S0, Jimothy present | Stays loaded; **cannot** reckon on any day while he is there; released to hands when he leaves. | No |
| `WASHED` | S8 | Clean pile (or a bedding wash event). | Yes |
| `SENT_BACK` | S8 | Owner's hand. | Yes |

`RETAINED` and `HOSTAGE` are both "the machine did not resolve" and are indistinguishable *within*
the reckoning; they differ only in what may happen to the items afterwards (a retained item can be
freed by the keyholder turning the machine on; a hostage item cannot be moved by a roll-4 and is
guaranteed to end in its owner's hand). Keeping two names is worthwhile outside the reckoning and
irrelevant inside it.

**Two corollaries worth stating explicitly, because they answer the stress-test questions in
§7.5.8 for free:**

1. **`RESOLVE_MACHINE` needs no hostage awareness beyond the S0 gate.** No filter, no tier, no
   crowding count ever inspects hostage status.
2. **A hostage item can never participate in tier selection or crowding, on any day** — not while
   Jimothy is present (the machine does not run) and not on the day he leaves (release sends the
   items to hands *before* Phase 5). Proof in §7.5.8.

**Hand-resolvability bonus:** because `isHostage` is derived (`item.machine == jimothy.machine`),
the physical game needs **no hostage tokens**. The raccoon figure sitting on the machine *is* the
marker, and every item under him is hostage by inspection. Nothing to track, nothing to forget.

### 5.2 `RESOLVE_MACHINE` — deterministic pseudocode

Pure. Input: machine `m`, cards attached to `m`, global `jimothy`. Output: a verdict map.
(Electricity is handled one level up, at the phase, not here.)

```
FUNCTION RESOLVE_MACHINE(m, cards, jimothy) -> verdicts

  # ---- S0. Gates -----------------------------------------------------------
  IF jimothy != null AND jimothy.machine == m.id:
      RETURN { every item in m -> HOSTAGE }         # machine cannot run [v5]
  IF m.power == OFF:
      RETURN { every item in m -> RETAINED }
  IF m.items is empty:
      RETURN { }                                    # attached cards still recycle

  # ---- S1. Effective shade (Bleach) ---------------------------------------
  # MUST precede S2. The ONLY forced ordering in the whole function.
  bleached := (cards contains >= 1 Bleach)          # 2+ do NOT cancel [A-18]
  FOR each item i IN m.items:
      i.eff := IF bleached THEN swap(i.shade) ELSE i.shade

  # ---- S2. Tier selection --------------------------------------------------
  # Tiers operate on ALL items -- linen included. RESOLVED by the designer.
  IF   EXISTS i: i.eff == dark  AND i.type == shoes:  tier := 1
  ELIF EXISTS i: i.eff == light AND i.type == shoes:  tier := 2
  ELIF EXISTS i: i.eff == dark:                       tier := 3
  ELSE:                                               tier := 4

  # ---- S3. Provisional verdict --------------------------------------------
  FOR each item i IN m.items:
      i.washed := CASE tier OF
          1 -> (i.eff == dark  AND i.type == shoes)
          2 -> (i.eff == light AND i.type == shoes)
          3 -> (i.eff == dark)
          4 -> (i.eff == light)

  # ---- S4..S7: MONOTONE DOWNGRADES. THEY COMMUTE (proof in 5.1) -----------

  # ---- S4. Underwear isolation --------------------------------------------
  hasNonUnderwear := EXISTS i IN m.items: i.type != underwear
  netOwners := { c.owner : c IN cards, c.name == "Wash net" }
  FOR each i WHERE i.type == underwear AND i.washed:
      IF hasNonUnderwear AND i.owner NOT IN netOwners:
          i.washed := FALSE

  # ---- S5. Blanket exclusivity (defensive assert) -------------------------
  IF EXISTS i: i.type == blanket AND |m.items| > 1:
      FOR each i: i.washed := FALSE
      LOG INVARIANT_VIOLATION                       # machineAccepts should prevent this

  # ---- S6. Crowding --------------------------------------------------------
  FOR each type t IN typesPresent(m):
      IF count(i : i.type == t) >= 3:               # >=3, not exactly 3 [A-19]
          FOR each i WHERE i.type == t: i.washed := FALSE
  # type only, any color or shade. RESOLVED by the designer.

  # ---- S7. Coloring / Color catcher ---------------------------------------
  coloringOwners := { c.owner : c IN cards, c.name == "Coloring" }
  catcherOwners  := { c.owner : c IN cards, c.name == "Color catcher" }
  FOR each p IN coloringOwners:
      FOR each i WHERE i.owner != p AND i.owner NOT IN catcherOwners:
          i.washed := FALSE                         # "ruined" == SENT_BACK [A-20]

  # ---- S8. Emit ------------------------------------------------------------
  FOR each i IN m.items:
      IF NOT i.washed:              verdict[i] := SENT_BACK
      ELSE IF i.type == bedding:
          i.washCount += 1
          verdict[i] := IF i.washCount >= 2 THEN WASHED ELSE SENT_BACK
      ELSE:                          verdict[i] := WASHED

  # ---- S9. Recycle ---------------------------------------------------------
  shuffle all cards attached to m back into the special item deck

  RETURN verdicts
END
```

Note the capacity limit appears nowhere in the reckoning. It is purely a placement constraint
(§4.6) and has no resolution semantics.

### 5.3 Handwash basket — extraction, confirmed

**[A-21]** A per-play effect, not a component. Played in Phase 2, it resolves immediately:

1. The owner names **one item they own** [A-22], in their hand or loaded in **any** machine —
   including an OFF machine, a blanket machine, a full machine, **and Jimothy's machine**
   (§7.5.3).
2. The item is **removed at once** and set aside.
3. In Phase 5, before any machine resolves, it receives a wash event **unconditionally**. "Immune
   to all other rules" is absolute: tiers, crowding, isolation, blanket exclusivity, attached
   cards, machine power, **hostage status**, and a suppressed reckoning all fail to touch it. Gang
   cannot reach it (it is no longer in a machine).
4. **[A-23]** Under absolute immunity, bedding's two-wash rule is *another rule*, so a basketed
   bedding becomes **clean outright**. Flagged as the largest single balance lever in the deck.
5. Because step 2 physically removes the item, it does **not** count for that machine's tier
   selection, crowding, or capacity. The basket is therefore also a surgical defusal tool, and
   **[v5] the only way to convert a hostage item into a wash.**

### 5.4 The four-tier ladder — settled

| Tier | Fires when | Washes | Everything else |
|---|---|---|---|
| 1 | any dark shoes | dark shoes | SENT BACK |
| 2 | else any light shoes | light shoes | SENT BACK |
| 3 | else any dark item | all dark items | SENT BACK |
| 4 | else light items only | all light items | — |

**Tier 2 is confirmed as written and is closed.** Designer's rationale, recorded here as the
canonical justification: *shoes are dirtier than everything else and act as joker cards, forming
their own dirtiness class above all garments.* Teaching line: **"shoes first, then dark, then
light."** That formulation is accurate and should replace "dark taints light" in all
player-facing text, since the latter is false at tier 2 and was the source of the confusion.

Tiers operate on **all items**. A dark blanket washes on tier 3 exactly as a dark shirt does. The
linen constraints in §5.6–§5.9 are filters applied on top.

### 5.5 Linen in the tiers — resolved

The v0.1/v0.2 P0 defect is **fixed**. For the record, the defect was: under the literal reading
where tiers washed *clothes* only, no tier ever washed linen, and since
`P(dealt zero linen) = 1/8008`, essentially no player could ever win. The repair (tiers over all
items) changes nothing for clothes-only machines and makes the linen rules operative.

Live consequences, all intended:
- Dark underwear beats light underwear; shade precedence operates inside linen.
- A blanket is always alone, always wins its own tier, and **always washes if its machine is ON
  and Jimothy-free**. See §7.6 — a balance concern, not a correctness one.
- Light bedding among dark items is sent back; dark bedding gets its wash event.

### 5.6 Underwear isolation

Underwear `u` washes only if **every other loaded item in the machine is also `underwear`** (any
owner, any shade), **or** `u.owner` has a Wash net attached to that machine.

- The test is on **contents**, not on what is washing. Two dark underwear plus one light shirt:
  the shirt is not washing, but it is present, so the underwear goes back too. Nothing washes.
- Wash net protects only its owner's underwear.
- **[A-24]** Wash net waives isolation **only**; underwear must still win its tier.

### 5.7 Crowding — resolved

**3 or more items of the same `type`, any color or shade, in one machine → all of them sent back.**

The designer's ruling matches my v0.2 finding, retained here as justification: with socks unsplit,
a color holds at most 2 cards of a type and 1 of a (type, shade), so `type+owner` caps at 2 and
`type+shade+owner` caps at 1 — **neither can ever reach 3, so both readings were dead text.** The
live choice was `type` (needs 2+ owners) versus `type+shade` (needs 3 distinct owners); `type` was
chosen, and it is the only one that keeps crowding live in a 3-player game.

- **[A-19]** Threshold is **≥3**, not exactly 3. Under "exactly 3" a 4th copy would rescue all
  four — absurd, and now reachable, since capacity is 4.
- **[v5] Capacity 4 against threshold 3 is a deliberate and good fit:** a machine can crowd
  (3 of a type) with a slot still free, so crowding is a live hazard rather than a full-machine
  edge case. This is [R-1.3] working as intended.
- Applies to linen types. Blankets can never crowd (exclusivity caps them at 1).
- Demoting an already-demoted item is a harmless no-op, so it may be applied blindly.

### 5.8 Bleach

Bleach swaps `dark ↔ light` as the **effective shade** of every item in the machine; the ladder
then runs normally. Equivalently the rungs relabel to
`light shoes → dark shoes → light items → dark items`. The formulations are identical for all
inputs.

**Bleach does not disarm dark shoes.** A dark shoe becomes an effective light shoe, still the top
occupied rung once tier 1 is empty. Bleach reverses the shade axis and does not touch the shoe
axis — which is now the *correct and intended* behaviour, given the designer's confirmed rationale
that shoes form their own class above the shade system. The v0.2 alternative "Bleach kills dark"
reading is **withdrawn**: it would have Bleach override the shoe class, which the tier-2 ruling
establishes it must not.

Bleach is machine-wide and ownership-blind. **[A-18]** Two Bleach cards do not cancel.

### 5.9 Bedding

`washCount ∈ {0,1,2}`, persistent, publicly tokened [A-04]. Each `washed = TRUE` increments it.
At 1 it returns to hand with a token; at 2 it is clean. A Handwash basket cleans it outright
[A-23]. It never decreases — not on sent-back, Gang, Electricity, release from hostage, or
displacement.

### 5.10 Coloring and Color catcher

- **Coloring** (owner `p`) demotes every item in the machine whose `owner ≠ p`.
- **Color catcher** (owner `q`) **[A-25]** exempts `q`'s items from **every** Coloring at that
  machine while attached — blanket immunity, avoiding a pairing rule for 3 Colorings vs 2 catchers.
- **[A-26]** Coloring neither washes nor protects its owner's items; they face the ladder,
  crowding, and isolation normally.
- Two Colorings by different owners, no catchers → **nothing washes**.
- **[A-20]** "Ruins" = `SENT_BACK`. The only removal outcome in the game is sent-back and it is
  penalty-free, so Coloring costs its victims one day and nothing more. It reads far scarier than
  it plays. Retained as-is because [R-3.3] correctly identifies Coloring as one of the
  better-designed pieces — it is symmetric and non-targeted, and it should not gain a "choose a
  player" clause.
- **[A-27]** Coloring is applied **after** tier selection and does not remove items from the
  machine; a ruined item still taints. It cannot be used to clear an opponent's dark shoes.

### 5.11 Event cards — **[v5] resolved in Phase 4, before reckoning**

| Card | Effect |
|---|---|
| **Gang** | Every item in **every** machine is sent back to its owner's hand — ON, OFF, and (see §7.5.5) Jimothy's. Every special item card attached to any machine is shuffled back into the deck. Machine power states are **not** changed [A-28]. Bedding `washCount` is not reset. **[v5]** Because this now precedes reckoning, Phase 5 then finds every machine empty: Gang is once again a total board wipe and a total progress denial for the day. |
| **Electricity** | Reckoning is **skipped entirely this day**. Every machine — ON and OFF — retains its contents and attached cards. Power states unchanged. **[v5] Works exactly as written.** |
| **Jimothy** | The raccoon is placed in a machine. See §5.11.1. |

Both Gang and Electricity **frighten** Jimothy if he is in play (§5.11.4).

#### 5.11.1 Jimothy — object model, and the apparent contradiction

The brief says Jimothy "can only ever occupy a machine — never a deck", and then says Animal
control and fright "shuffle him back into the event deck." Taken literally these contradict.

**[A-29] Repair — two objects, one name:**
- **Jimothy the raccoon** is a *token* with exactly two locations: **on a machine**, or
  **off-board**.
- **The Jimothy event card** is a card in the event deck.
- The token is on a machine iff a Jimothy card has been resolved and he has not yet left. "Shuffled
  back into the event deck" refers to the **card**; "never a deck" means the **token** is never
  shuffled, held in hand, or drawn — you cannot hold Jimothy, only meet him.

This reading satisfies both sentences and is what the rules below assume. It also gives the right
physical picture: a raccoon meeple that lives on the board or in the box, never in the deck.

#### 5.11.2 While Jimothy is in play

- The machine **cannot run**: it is gated out at S0 of every reckoning, regardless of power.
- The machine **cannot be loaded**: `machineAccepts` returns FALSE (§4.6), which blocks both loads
  and roll-4 moves *into* it.
- Every item in it is **hostage**: not washed, not sent back, frozen. Hostage status is derived,
  never stored.
- Hostage items **cannot be moved out by a roll-4** (§7.5.4).
- Hostage items **can** be extracted by a Handwash basket (§7.5.3).
- **[A-14]** Jimothy occupies no capacity slot. Moot in practice; needed for the reducer.
- **[A-30]** Special item cards may still be **attached** to his machine (cards are not items and
  `machineAccepts` governs items only). They sit there as a long fuse and resolve whenever the
  machine eventually runs — or return to the deck on a Gang.

#### 5.11.3 Placement

**[A-15]** The machine Jimothy occupies is chosen by **the player who laid the face-down event
card**, at the moment of reveal in Phase 4. Grounded in the brief's own straw proposal for the
already-in-play case ("he relocates to another machine, chosen by the player who drew him") — the
same chooser should govern both.

He may be placed in **any** machine, including:
- a machine at capacity (§7.5.7) — his best target, maximising hostages;
- a machine holding a **blanket** (§7.5.6) — thematically perfect and the natural counter to an
  otherwise guaranteed wash;
- an OFF machine, an empty machine, or a machine holding only the chooser's own items.

**[!] Placement is a targeted attack** and is the one piece of the current design that most
directly matches [C-risk-4]. Unlike Coloring — which the comparables report praises for hitting
every other color symmetrically — Jimothy's placement lets one player point at one machine and
freeze it. The mitigation is that the layer did not choose to draw him. Flagged in §7.5.10 with
non-targeted alternatives, none adopted.

#### 5.11.4 Departure

Three ways, exhaustively:

| Route | Phase | Where he goes | Hostages |
|---|---|---|---|
| **Snack** | 2 | Relocates to **another** machine of the player's choice. | The machine he leaves **releases** its hostages to hands. The machine he arrives at now holds **its** contents hostage. |
| **Animal control** | 2 | Off-board; his card shuffles back into the event deck. | Released to hands. |
| **Fright** | 4 | Off-board; his card shuffles back into the event deck. Triggered by resolving **Gang** or **Electricity** while he is in play. | Released to hands. |

**The fright rule is the safety valve.** Every event card either *is* Jimothy or frightens him, so
he cannot squat permanently and no separate timer rule is needed. **Verified in §7.5.9** — the
mechanism is sound, but the straw event deck makes his expected residence long enough to matter.

**[A-31] Release means sent back to hands, not "un-frozen in place."** The brief is explicit
("sent back to their owners when Jimothy leaves"). Consequence, which players will find
counter-intuitive: **neither Snack nor Animal control ever rescues laundry into a wash.** They
free a machine for future days and return the hostages to hand — nothing more. See §7.5.2.

#### 5.11.5 Jimothy drawn while already in play

**[A-32]** Adopt the brief's straw proposal: he **relocates** to another machine chosen by the
player who laid the card, with the same release/capture semantics as Snack. The newly drawn
Jimothy card is shuffled straight back into the event deck (there is only one raccoon), and no
fright occurs — Jimothy does not frighten himself.

This case is reachable only if the event deck holds ≥2 Jimothy cards, which the straw composition
does.

#### 5.11.6 Snack and Animal control

- **Snack:** relocate Jimothy to a *different* machine of the player's choice. Legal only while
  Jimothy is in play — otherwise the card has no legal target and **cannot be played** [A-33].
- **Animal control:** remove Jimothy outright. Likewise unplayable while he is absent.
- Both are **held indefinitely** — no redraw, no discard-for-value. Explicit in the brief.
- **[!]** Therefore both are **dead cards** whenever Jimothy is absent, which by §7.5.9 is ~61% of
  days under the straw event deck. Two of seven special item types being dead 61% of the time is a
  significant drag on the value of a roll of 5. This is a joint constraint between the two P0 deck
  compositions and is the single most important thing the balance sim must resolve (§8).

### 5.12 Invariants

| ID | Invariant |
|---|---|
| I-1 | Every item is in exactly one of: a hand, a machine, a clean pile, the inert remainder, or basket-set-aside (transient, Phase 2→5). |
| I-2 | No machine holds a blanket alongside anything else. |
| I-3 | `occupancy(m) ≤ 4` for every machine, always. |
| I-4 | After Phase 5, every ON machine **without Jimothy** holds zero items. |
| I-5 | `washCount > 0` only for `type == bedding`. |
| I-6 | Clean pile ⊆ must-wash set, and **clean piles are monotone non-decreasing**. (This single invariant decides §7.4.) |
| I-7 | Exactly one player holds the key; the day-`d` keyholder is seat `((d−1) mod P)+1`. |
| I-8 | At most one pending event, and only between Phase 1 and Phase 4 of the same day. |
| I-9 | At most one Jimothy token, on at most one machine. |
| I-10 | `isHostage(i)` is derived, never stored: `jimothy ≠ null ∧ i.machine == jimothy.machine`. |
| I-11 | No card is in a fresh zone at the start of Phase 1. |
| I-12 | Hand ∪ loaded ∪ clean pile ∪ basket-set-aside = must-wash set, per player, always. |

---

### 5.13 WORKED EXAMPLES — regenerated from scratch against v5

Notation: `A-D-shoes` = player A's dark shoes. `[Bleach:A]` = a Bleach card attached, owner A.
Machine ON, no Jimothy, reckoning not suppressed, unless stated. Capacity 4.

#### Table A — machine reckoning (Phase 5)

| # | Contents | Cards | Tier | Verdicts | Reason |
|---|---|---|---|---|---|
| 1 | `A-D-shoes`, `B-L-shirt`, `C-D-pants` | — | 1 | `A-D-shoes` **WASHED**; others SENT BACK | Shoes are their own dirtiness class. Dark shoes beat even other dark items. |
| 2 | `A-L-shoes`, `B-D-shirt` | — | 2 | `A-L-shoes` **WASHED**; `B-D-shirt` SENT BACK | **Tier 2, confirmed by the designer.** Shoes outrank all garments; only *within* a class does dark beat light. "Shoes first, then dark, then light." |
| 3 | `A-D-shirt`, `A-D-pants`, `B-L-hat` | — | 3 | both dark **WASHED**; `B-L-hat` SENT BACK | The ordinary case. |
| 4 | `A-L-shirt`, `B-L-pants` | — | 4 | both **WASHED** | Light-only machine. |
| 5 | `A-D-blanket` (alone, as required) | — | 3 | **WASHED** | **Linen ruling in action.** Tier 3 now covers all items, so a dark blanket washes exactly as a dark shirt would. Under the old literal reading this was impossible and the game was unwinnable. |
| 6 | `A-L-bedding` (count 0), `B-L-hat` | — | 4 | `B-L-hat` **WASHED**; bedding takes **wash event #1**, `washCount → 1`, returns to hand with a token | **Bedding, first wash.** It leaves the machine exactly like a sent-back item but has made progress — which is why *wash event* is a defined term distinct from *washed*. |
| 7 | `A-L-bedding` (count 1), `B-D-hat` | — | 3 | `B-D-hat` **WASHED**; `A-L-bedding` SENT BACK, still at count 1 | **Bedding, second wash denied.** Identical machine logic to row 6; the dark hat simply takes tier 3 and the light bedding loses. Bedding's real cost is needing to win a tier *twice*. |
| 8 | `A-D-bedding` (count 1), `B-L-hat` | — | 3 | `A-D-bedding` **WASHED (clean)**, `washCount → 2`, to clean pile; `B-L-hat` SENT BACK | **Bedding, second wash achieved.** Implementations must not special-case bedding in the ladder — only in S8. |
| 9 | `A-D-shoes`, `B-D-shoes`, `C-D-shoes`, `D-L-shirt` (machine full, 4/4) | — | 1 | **all four SENT BACK** | **Crowding alongside a tier-1 wash.** Tier 1 provisionally washes all three shoes; crowding then demotes all three; the light shirt is *not* promoted, because crowding does not re-run tier selection [A-27]. Nothing washes. Note this needs 3 owners and exactly fills the machine. |
| 10 | `A-D-shirt`, `A-L-shirt`, `B-D-shirt` | — | 3 | **all three SENT BACK** | **Crowding at the resolved reading.** A contributes the maximum any one color can (2 shirts, one per shade); B's third triggers it. Under `type+shade` this would not crowd and the two dark shirts would wash — which is exactly the reading the designer rejected. |
| 11 | `A-D-underwear`, `B-D-underwear` | — | 3 | both **WASHED** | All-underwear machine, both dark, isolation satisfied. |
| 12 | `A-D-underwear`, `B-L-underwear` | — | 3 | `A-D` **WASHED**; `B-L` SENT BACK | Shade precedence operates *inside* linen. An all-underwear machine is not automatically safe. |
| 13 | `A-D-underwear`, `A-D-shirt` | — | 3 | `A-D-shirt` **WASHED**; `A-D-underwear` SENT BACK | Isolation tests **contents**, not what is washing — and both items are A's own. Entirely self-inflicted. |
| 14 | `A-D-underwear`, `B-L-shirt` | `[Wash net:A]` | 3 | `A-D-underwear` **WASHED**; `B-L-shirt` SENT BACK | The net waives isolation and tier 3 covers linen. The intended use. |
| 15 | `A-D-underwear`, `B-D-shoes` | `[Wash net:A]` | 1 | `B-D-shoes` **WASHED**; `A-D-underwear` SENT BACK | **Net + underwear + dark shoes.** The net waives isolation only [A-24]; the underwear still fails the ladder. Net wasted. |
| 16 | `A-D-underwear`, `B-D-underwear`, `C-D-underwear` | — | 3 | **all three SENT BACK** | Isolation satisfied, ladder satisfied, but **crowding applies to linen types too**. |
| 17 | `A-D-shoes`, `B-L-shirt` | `[Bleach:A]` | 2 | `A-D-shoes` **WASHED**; `B-L-shirt` SENT BACK | **Bleach + dark shoes.** The swap makes the dark shoes *effectively light* — still the top occupied rung. Bleach reverses the shade axis and cannot touch the shoe class, which the tier-2 ruling establishes sits above it. |
| 18 | `A-D-shirt`, `B-L-shirt` | `[Bleach:A]` | 3 | `B-L-shirt` **WASHED**; `A-D-shirt` SENT BACK | Bleach doing exactly what its text says, in the clothes-only domain the text is about. Note A played it and lost their own shirt — the card is ownership-blind. |
| 19 | `A-L-shoes`, `B-L-shoes`, `C-L-shoes` | `[Bleach:A]` | 1 | **all three SENT BACK** | Swap makes them effectively *dark* shoes → tier 1 → all provisionally wash → crowding demotes all three. Bleach changed the rung's label; crowding did not care. |
| 20 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]` | 4 | `A-L-shirt` **WASHED**; others SENT BACK | All three would otherwise have washed. Symmetric, non-targeted — the good shape per [R-3.3]. |
| 21 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]`, `[Color catcher:B]` | 4 | `A` **WASHED**; `B` **WASHED**; `C` SENT BACK | **Coloring + catcher + third player.** The catcher protects only B; C is unprotected. |
| 22 | `A-L-shirt`, `B-L-pants`, `C-L-hat` | `[Coloring:A]`, `[Coloring:B]` | 4 | **all three SENT BACK** | A ruins B and C; B ruins A and C. Nothing survives both. |
| 23 | `A-L-shirt`, `B-D-shoes` | `[Bleach:A]`, `[Coloring:A]`, `[Color catcher:B]` | 2 | `B-D-shoes` **WASHED**; `A-L-shirt` SENT BACK | Full stack. Bleach swaps: shoes → effectively light, shirt → effectively dark. Tier 2 fires. Coloring:A would ruin B's shoes but B holds the catcher. A's own shirt loses to the ladder, since Coloring protects nobody [A-26]. **A spent three cards' worth of effect and washed nothing.** |
| 24 | `A-D-shoes`, `B-D-hat` — A basketed `A-D-shoes` in Phase 2 | `[Handwash basket:A]` (resolved) | 3 | `A-D-shoes` **WASHED** (basket); machine now holds only `B-D-hat` → **WASHED** | **The basket defuses a tier-1 bomb by removing it.** A washes their shoes for free *and* accidentally rescues B. Only works under the confirmed extraction model. |
| 25 | `A-D-shirt`, `A-L-shirt`, `B-D-shirt` — A basketed `A-L-shirt` in Phase 2 | `[Handwash basket:A]` | 3 | `A-L-shirt` **WASHED** (basket); 2 shirts remain → no crowd → `A-D-shirt` **WASHED**, `B-D-shirt` **WASHED** | **The basket defuses a crowd.** Same board as row 10, which washes nothing. One card turned a triple loss into three washes, one of them an opponent's. |
| 26 | `A-D-bedding` (count 0) — basketed from hand | `[Handwash basket:A]` | n/a | **WASHED (clean)**, `washCount` bypassed | **[A-23] Absolute immunity beats the two-wash rule.** 87.5% of players hold bedding, so this is consistently the card's best use — the largest balance lever in the deck. |
| 27 | machine at capacity: `A-D-hat`,`B-D-hat`,`C-L-hat`,`D-L-hat` | — | 3 | **all four SENT BACK** | Four of one type. Crowding is ≥3, not exactly 3 [A-19] — the fourth hat does not rescue the others. Reachable now that capacity is exactly 4. |
| 28 | (empty, ON) | `[Bleach:A]` | — | no verdicts | Empty machines are a no-op; the card still recycles. Playing at a machine that stays empty simply wastes it. |

#### Table B — day-level, event, and **Jimothy** scenarios

| # | Scenario | Resolution | Point |
|---|---|---|---|
| B1 | Player C rolls a 6 (first of the day); player E later rolls a 6. | C loads up to 1 and lays a face-down event. **E loads up to 1 and nothing else** — no second event, no draw, no compensation. | "Only the first 6" as a hard no-op on the *event* half only. **[v5] E is not robbed of a turn** — the load still happens. This is the no-dead-faces principle. |
| B2 | Pending event is **Electricity**. | Phase 4 sets skip-reckoning. Phase 5 is skipped wholesale; every machine ON and OFF **retains** its contents into tomorrow. | **[v5] Electricity now works as written.** Contrast v0.2, where it resolved after reckoning and did literally nothing. The phase-order change fixed it. |
| B3 | Pending event is **Gang**. Machines hold 7 items across the board, one machine OFF. | Phase 4 sends **all 7** items back to hands, ON and OFF alike, and returns every attached special card to the deck. Phase 5 then finds every machine empty. | **[v5] Gang is a real board wipe again**, and total progress denial for the day. Contrast v0.2 where I-4 meant it could only reach OFF machines. |
| B4 | Player D rolls a 5 on day 3, drawing Bleach. D wants to play it in Phase 2 of day 3. | **Illegal.** The card sits face-up in D's fresh zone. It promotes at end of day 3 and is playable from day 4. **Everyone can see it is a Bleach** while it is fresh. | The one-day delay, and the information asymmetry it creates (§3.4): cards are public for one day, then secret. |
| **B5** | **Jimothy is revealed. Player C laid the card.** Machines: M1 holds `A-D-shirt` + `B-L-pants`; M2 empty; M3 holds `C-D-hat`. | C chooses. C places him on **M1**. `A-D-shirt` and `B-L-pants` become **hostage**. M1 cannot run and cannot be loaded. Phase 5: M1 gated at S0; M2 empty; M3 reckons normally and `C-D-hat` **WASHED**. | **Placement is a choice, and it is targeted** [A-15]. C froze two opponents' items and washed their own. §7.5.10 flags this as the design's sharpest remaining take-that vector. |
| **B6** | Continuing B5. Next day the keyholder turns **M1 OFF**. | Legal but **completely inert**. M1 already could not run because of Jimothy. The power state is recorded and has no effect until he leaves. | **[!] Jimothy and OFF stack redundantly** (§7.5.1). The keyholder has wasted their only action, and at M=3 they have burned the day's single most valuable decision on a no-op. Worth a UI warning digitally and a rules note physically. |
| **B7** | Continuing B5. The keyholder had **already** turned M1 OFF *before* Jimothy arrived. | No interaction. Items were `RETAINED`; they are now `HOSTAGE`. Both are S0 gates; neither reaches the ladder. When Jimothy leaves they are **released to hands** — the OFF state does not preserve them for a later wash. | **Hostage strictly overrides retained.** A player who turned a machine off to protect a good configuration loses that configuration entirely if Jimothy lands on it. |
| **B8** | Continuing B5. Player A plays a **Handwash basket** in Phase 2 naming `A-D-shirt`, currently hostage in M1. | **Legal. The shirt is extracted and WASHED.** "Immune to all other rules" is absolute and hostage status is another rule. M1 now holds only `B-L-pants`, still hostage. | **[A-21/§7.5.3] The basket is the only way to convert a hostage item into a wash** — Snack and Animal control merely release to hand. This is now the card's most valuable niche after bedding. |
| **B9** | Continuing B5. Player B rolls a 4 and tries to move `B-L-pants` out of M1; also tries to move `C-D-hat` *into* M1. | **Both illegal.** Out: hostages are frozen (§7.5.4). In: `machineAccepts` returns FALSE for a Jimothy machine. B loads up to 1 elsewhere and skips the move. | If roll-4 could free hostages, any player rolling a 4 would trivially undo Jimothy every day and the card would have no teeth. |
| **B10** | Player A plays **Snack** in Phase 2, moving Jimothy from M1 (holding `A-D-shirt`, `B-L-pants`) to M3 (holding `C-D-hat`, loaded this morning and about to wash). | M1 **releases**: `A-D-shirt` and `B-L-pants` go to their owners' **hands**, not to a wash. M3's `C-D-hat` becomes hostage. Phase 5: M1 is empty and reckons to nothing; M3 is gated. | **[A-31] Snack never rescues laundry into a wash** — release means sent back. What Snack actually is: a **redirect weapon**. A spent a card to move the freeze onto C's about-to-wash hat. Players will expect Snack to save their laundry; it does not, and the card text should say so. |
| **B11** | Player A plays **Animal control** while Jimothy sits on M1 holding A's own two items. | Jimothy is removed; his card shuffles back into the event deck. `A`'s two items are **released to A's hand**. M1 is empty and free to load tomorrow. | Same lesson as B10: the counter-cards unlock the *machine*, they do not save the *laundry*. Animal control's value is board tempo, not item recovery. |
| **B12** | **Gang is revealed while Jimothy sits on M1 holding hostages.** Both the wipe and the fright happen in Phase 4. | **[A-34] Resolve the event's own effect first, then the fright.** Gang sends every item in every machine — including M1's hostages — back to hands and returns all attached cards. Then Jimothy is frightened, leaves, and his card shuffles back. M1 releases nothing (already empty). | **The two orders give identical outcomes** — under fright-first the hostages are released to hands and Gang then finds M1 empty; under Gang-first the hostages are sent back and there is nothing left to release. Both end with every item in its owner's hand and Jimothy in the deck. **Nothing hinges on the order**, but one must be fixed for determinism, and "the event happens, *then* he reacts to it" is the reading under which the phrase *"resolving Gang while Jimothy is in play"* is literally true. |
| **B13** | **Electricity is revealed while Jimothy is in play.** | Same order [A-34]: reckoning is suppressed for the day, **then** Jimothy is frightened and leaves, releasing hostages to hands. Every other machine retains its contents into tomorrow. | Note the asymmetry: Electricity *retains* ordinary machines' contents but *releases* Jimothy's. The hostages go to hands even though nothing washed. |
| **B14** | Jimothy is in play on M1. A second **Jimothy** card is drawn as the day's event. | **[A-32]** He **relocates** to another machine chosen by the layer, with Snack semantics: M1 releases its hostages to hands, the destination's contents become hostage. The newly drawn card shuffles straight back (there is one raccoon). **No fright** — Jimothy does not frighten himself. | Reachable only if the event deck holds ≥2 Jimothy cards, which the straw composition does. |
| **B15** | Jimothy is placed on a machine holding **only `A-D-blanket`**. | **Legal** [§7.5.6]. Blanket exclusivity governs *items*; Jimothy is a token. The blanket becomes hostage and does not wash. | **The single best counter to the blanket problem** (§7.6). A blanket alone in an ON machine is otherwise a guaranteed wash, and this is one of very few things that stops it. Thematically ideal — of course the raccoon sits on the blanket. |
| **B16** | Jimothy is placed on a machine at **full capacity** (4 items, three owners). | **Legal** [§7.5.7]. He consumes no capacity slot [A-14]. All 4 items become hostage. | His highest-value target by construction. Note the interaction: a machine that is full is also the most likely to be crowding-doomed anyway, so freezing it may sometimes *help* its occupants by denying a reckoning that would have sent everything back regardless. |
| B17 | Player B finishes (10th item washed) during Phase 5 of day 7, in a 4-player game. | B is marked finished. The game does **not** end. `round` advances to 8; `8 mod 4 = 0`, so the game ends at the end of day 8 — **one extra day.** B wins: no one can exceed 10, and ties go to the first finisher. | §3.5 and §7.4. Had B finished on day 5, the game would have run to day 8 — three extra days in which the outcome is already decided. |
| B18 | Same as B17, but player D also reaches 10 during day 8. | Both have 10. Tiebreak: **B finished first (day 7), B wins.** | **§7.4: a second finisher can never overtake, only tie and lose the tiebreak.** The rotation extension cannot change the winner. |

---

## 6. OPEN QUESTIONS AND PROPOSED DEFAULTS

★ marks questions the brief has not flagged. Deck compositions are **excluded by instruction** and
handled in §8.

### Highest value

★ **[OQ-05] Should the event card be laid FACE-UP instead of face-down?**
Events were moved before reckoning precisely so they could influence the day. But the card is laid
in Phase 1 and revealed in Phase 4, **after** loading, special items, and the key — so no decision
in the entire day is made with knowledge of it.
(a) **Face-up on placement** (recommended). Everyone plans the day around a known Gang, a known
Electricity, or a known incoming Jimothy. The key phase becomes a real decision under threat.
Directly implements [R-2.2(a)], which names an unannounced global wipe drawn by a player who does
not know what they drew as uncompensated output randomness.
(b) Keep face-down. Preserves suspense and a nice one-of-a-kind hidden-from-everyone state, but the
suspense buys nothing because no decision is exposed to it.
Consequence of (a): Gang stops being weather and starts being a threat players can hedge against;
Jimothy's arrival becomes anticipated rather than a bolt from the blue; and Snack/Animal control
holders get a day of warning, which materially improves those cards' dead-card problem.
**Recommend (a). This is the cheapest high-value change available and it costs no new rules.**
Labelled as an assumption awaiting sign-off — the designer chose face-down deliberately.

★ **[OQ-06] Should finished players keep taking turns during the rotation extension?**
Once a player finishes, their hand is empty. Under the rules as written they still roll (loading
nothing), still draw and play special items, still hold the key, and still take roll-4 moves.
(a) **They stop acting** (recommended) — skip their rolls and card plays; they still hold the key
when it reaches them, or the key skips them.
(b) They keep acting, as written.
Consequence of (b): **a finished player is a zero-stake, fully-armed kingmaker for up to `P−1`
days.** They can Coloring the runner-up, Snack Jimothy onto their machine, and roll-4 their items
into a dark-shoe machine, with literally nothing to lose. This is the exact configuration the
comparables report identifies as the worst multiplayer defect, in a survey where **42% of
respondents named kingmaking the single worst issue** [C-risk-2].
Since §7.4 proves the extension cannot change the winner anyway, (b) buys pure downside.
**Recommend (a). This is the most serious new problem introduced this pass.**

★ **[OQ-07] Should the rotation-completion rule be kept at all?**
§7.4 proves it cannot change the winner, because clean piles are monotone and capped at 10.
(a) **Keep it** for the stated fairness flavour, accepting that it adds up to `P−1` decided days.
(b) **Drop it**; the game ends the day someone finishes.
(c) Keep it but **end the game immediately once the outcome is arithmetically settled** — i.e.
as soon as one player finishes, since no one can catch them. Formally identical to (b).
Consequence: (a) is the Munchkin failure the comparables report warns about [C-risk-2] — an
endgame everyone knows is over that refuses to stop. It also does not fix the defect it was
imported to fix, because equalising key access *after* the race is decided is too late (§7.4).
**Recommend (b)** — or, if the fairness goal matters, adopt the comparables' actual prescription
[R-4.2]: make the key contestable at a self-balancing cost, which fixes access fairness *during*
the game where it can still matter. Flagged as a real designer decision, not a technicality.

### Jimothy

★ **[OQ-08] Who chooses Jimothy's machine?** (a) **The player who laid the card**, at reveal
(recommended; grounded in the brief's own straw proposal for relocation). (b) Random. (c) The
keyholder. (d) Deterministic — the fullest machine, ties to lowest index.
Consequence: (a) is targeted (§7.5.10 and [C-risk-4]) but gives the event some agency and matches
the relocation rule. (d) is non-targeted and thematic (most laundry attracts the raccoon), and
would be my choice if the designer wants to reduce take-that; it also removes a decision from a
player who did nothing to earn it. **Recommend (a) for consistency with the brief; flag (d) as the
low-conflict alternative.** [A-15]

★ **[OQ-09] Can a roll-4 move a hostage item out?** (a) **No** (recommended). (b) Yes.
Consequence of (b): any player rolling a 4 trivially undoes Jimothy, and with `P` rolls per day the
probability at least one 4 appears is 42–67% — Jimothy would rarely hold anyone hostage for a full
day and the card would lose its teeth entirely. **Recommend (a).**

★ **[OQ-10] Can a Handwash basket extract a hostage item?** (a) **Yes** (recommended) — "immune to
all other rules" is absolute and has been confirmed as such. (b) No.
Consequence of (a): the basket gains a strong, thematic, and *unique* niche as the only conversion
of hostage into wash, which also gives players a real answer to a targeted freeze. **Recommend (a).**
[§7.5.3]

★ **[OQ-11] Gang/Electricity vs fright — which resolves first?** (a) **The event's own effect
first, then fright** (recommended). (b) Fright first.
Consequence: **none — the outcomes are provably identical** (§7.5.5). Fix (a) for determinism only,
because it makes "resolving Gang while Jimothy is in play" literally true. [A-34]

★ **[OQ-12] Can Jimothy occupy a blanket machine / a full machine?** (a) **Yes to both**
(recommended). (b) No.
Consequence of (a): he becomes the natural counter to the blanket problem (§7.6), and his best
target is the fullest machine, which is the most dramatic and most thematic outcome. Exclusivity
and capacity govern *items*; he is a token. **Recommend (a).** [§7.5.6, §7.5.7]

★ **[OQ-13] Does release ever wash anything?** (a) **No — release means sent back to hands**
(recommended; explicit in the brief). (b) Release un-freezes items in place so the machine can
reckon them.
Consequence of (b): Animal control and Snack become rescue cards, which is what players will
*expect* them to be, and considerably stronger. (a) is what the brief says.
**Recommend (a), and rewrite the card text to make it unmistakable**, because the intuitive reading
is (b) and players will get this wrong at the table. [A-31]

★ **[OQ-14] Jimothy drawn while in play.** Adopt the brief's straw proposal: relocate, chooser =
the layer, second card shuffled straight back, no fright. **[A-32]**

★ **[OQ-15] Can special item cards attach to Jimothy's machine?** (a) **Yes** (recommended) — cards
are not items. They wait as a long fuse. (b) No.
**Recommend (a).** [A-30]

### Structure

★ **[OQ-01] Does "garment" exclude linen in roll-4 and the Handwash basket?**
If read strictly, roll-4 could not move a blanket and the basket could not take bedding — both
arbitrary, and the latter removes the card's best use. **Recommend garment = item throughout.**
[A-01]

★ **[OQ-02] Load and move on a roll of 4 — fixed order or player's choice?**
(a) **Player's choice, declared** (recommended). (b) Load then move. (c) Move then load.
Consequence: order genuinely matters under capacity 4 — moving an item out frees a slot to load
into, and loading first can fill a slot you wanted. Fixing an order silently removes a real
decision. **Recommend (a).** [A-08]

★ **[OQ-03] Is the roll-4 move optional?** (a) **Yes** (recommended). (b) Mandatory.
Consequence: (b) restores the forced-target-selection problem [C-risk-4] that including your own
items was meant to solve — you would still have to move *something*, and on many boards the only
legal move is an opponent's. **Recommend (a).** [A-08]

★ **[OQ-04] Fresh zone face-up — confirm the asymmetry?**
The brief says fresh is publicly auditable. That makes a card public for one day, then secret once
it promotes. Unusual but legible, and it supports the open-information positioning.
**Recommend keeping it, and stating it explicitly in the rules** so players do not assume fresh
cards are hidden. [A-02]

★ **[OQ-16] Simultaneous finishers.** (a) **Joint victory** (recommended). (b) Tiebreak by machine
index — makes the winner depend on arbitrary board ordering. (c) By seat — rewards seating.
**Recommend (a).** [A-17]

★ **[OQ-17] Acting order within a phase.** (a) **Keyholder first, then clockwise** (recommended).
(b) Fixed seat 1. (c) Independent rotation.
Consequence: with sequential loading and few machines, **the last actor in Phase 1 has a real
informational advantage** — they see the whole board before committing. Under (a) that advantage
rotates daily with the key, which is a genuine and free mitigation. Under (b) it is fixed to one
seat all game. **Recommend (a).** [A-11]

★ **[OQ-18] Is the special item phase sequential or simultaneous?**
(a) **Sequential** (recommended for v0.3). (b) Simultaneous secret commit then reveal.
**[CONFLICT]** — (b) is the better game per [R-1.1]/[R-3.4], which name simultaneity as the
highest-leverage change available, and the worse implementation (needs a commit/reveal sub-phase).
**Recommend (a) for now and flag (b) as the top candidate for the next design pass.** [A-13]

★ **[OQ-19] Are hands hidden?** (a) **Item hands and ready cards hidden; fresh cards and clean
piles public** (recommended). (b) Everything public.
(b) would make the game fully open-information, which is the brief's stated positioning (§10) —
worth considering seriously, since it would maximise the differentiator against *Dirty Laundry*'s
concealed-item design. But it also removes all bluff and makes leader-targeting trivially precise.
**Recommend (a).** [A-12]

★ **[OQ-20] Bedding progress public?** (a) **Yes**, token on the card. (b) Private.
(b) is hidden bookkeeping the platform goals forbid and a table cannot police.
**[CONFLICT]** — trivial digitally, impossible physically. **Recommend (a).** [A-04]

★ **[OQ-21] Blanket displaceable by a roll-4?** (a) **Yes, into an empty machine only**
(recommended). (b) Never. **Recommend (a).** [A-09]

★ **[OQ-22] Do two Bleach cards cancel?** (a) **No** — a flag, not a toggle. **Recommend (a).**
[A-18]

★ **[OQ-23] Does Coloring protect its owner's items?** (a) **No** (recommended). (b) Yes, they
auto-wash — which would make it the best card in the game. **Recommend (a).** [A-26]

★ **[OQ-24] Crowding threshold ≥3 or exactly 3?** (a) **≥3** (recommended). (b) Exactly 3, so a
4th copy rescues all four — now reachable at capacity 4 and clearly unintended. **Recommend (a).**
[A-19]

★ **[OQ-25] Does Gang change power states?** **No.** [A-28]

★ **[OQ-26] Do cards on OFF or Jimothy machines persist?** (a) **Yes**, until that machine actually
runs, or until a Gang returns them (recommended). (b) Recycle every day.
**Recommend (a).** [A-06]

★ **[OQ-27] Hand limit on special item cards?** (a) **None** (recommended) — one play per day
already throttles it, and Snack/Animal control must be holdable indefinitely by explicit rule.
[A-05]

★ **[OQ-28] Machine count non-monotonicity at P=4.** §2.2 shows occupancy runs
1.50 / **2.00** / 1.875 / 2.25, so the 4-player game is tighter than the 5-player game.
(a) Accept. (b) Move to `3/4/4/5` for a flatter 1.50/1.50/1.875/1.80.
**Recommend (a) — accept and measure**, since the sim will settle it better than argument, but the
designer should know the 4-player configuration is the outlier.

---

## 7. RULES INTEGRITY REVIEW

### 7.1 Resolved since v0.2

| Was | Now |
|---|---|
| **P0** — literal tiers made the game unwinnable in 7999/8000 deals | **FIXED.** Tiers operate on all items. |
| **P0** — Electricity resolved after the reckoning it was meant to cancel | **FIXED** by moving events before reckoning. |
| Gang could only reach OFF machines | **FIXED** by the same change; Gang is a real wipe again. |
| Jimothy had no effect and was unimplementable | **FIXED** — fully specified, and now the most intricate object in the game. |
| Crowding `kind` ambiguous across four readings | **FIXED** — `type`, any color or shade. |
| One-day delay needed unimplementable per-card timestamps | **FIXED** — fresh/ready zones are now rules text. |
| Uncontested board (~45% of machines empty daily) | **FIXED** — see §2.2. Empty machines fall from ~1.9–3.0 to ~0.4–0.7. |

Four blocking defects closed in one pass. The remaining P0s are the two deck compositions, which
are correctly deferred to simulation.

### 7.2 Termination under the new dice table and machine counts

**Verdict: worse than v0.2 on net, and the regression is specifically the "up to" rule.**

| Factor | Direction | Magnitude |
|---|---|---|
| Max load rate 1.0 → 1.5 items/player/day | **better** | +50% inflow, the single biggest positive |
| Occupancy 0.75–0.86 → 1.50–2.25 | **better** for contention, **worse** for throughput | more items per machine means more mutual voiding |
| Capacity 4 | **better** | bounds the damage of any one reckoning to 4 items |
| Crowding threshold 3 vs capacity 4 | **worse** for throughput | crowding now fires often, and it fires *before* a machine fills |
| Events before reckoning | **worse** | Gang is a real wipe again; Electricity costs a whole day |
| Jimothy freezes a machine | **worse** | at M=3 that is **33% of the board**, for ~2.3–3.6 days at a time (§7.5.9) |
| Special deck diluted 5 → 7 types | **worse** | the Handwash basket ratchet is diluted (see below) |
| Rotation-completion rule | **worse** | up to `P−1` guaranteed dead days per game |
| **Loading now optional** | **worse — structurally** | see below |

**[!] The stall equilibrium is back.** v0.2 §7.2 identified mandatory loading as the only thing
preventing "nobody loads anything dangerous, ever." That guard is gone. Nothing now forces any item
into any machine. The counter-argument is that a player cannot win without loading, so someone must
eventually move — but that argument establishes only that *rational players who want to win* will
load, not that the rules guarantee it, and it does not rule out long mutual stand-offs where
everyone waits for a safe moment that few machines and many players make rare. **This is
[C-risk-1]'s Deep Sea Adventure death spiral with a new door into it.**

Note the tension with §2.2: **the machine counts are calibrated on `L = 1.5`, which assumes players
always load the maximum, and the "up to" rule is precisely what makes that assumption doubtful.**
If realized `L` falls to 1.0, occupancy drops to 1.00/1.33/1.25/1.50 and much of the contention the
machine cut was meant to create evaporates. These two changes were made in the same pass and pull
against each other. **This is the most important interaction for the simulation to measure.**

**The only monotone ratchet is still the Handwash basket, and it got weaker.** It is the sole rule
that guarantees forward progress: one item, any item, immune to everything, unreversible. Rate:
`P/6` special draws per day × (basket's share of the deck). At 5 equally weighted types that was
`P/30`; at 7 it is `P/42` — **a 30% dilution** from adding Snack and Animal control. Under any
composition it is far too slow to be the practical engine of termination (order of hundreds of
days); real games end because reckonings actually wash things, which no rule guarantees.

**Rough length estimate, for calibration only.** At `L = 1.5` and modal occupancy ~2, a typical
2-item machine washes both items only when they share an effective shade class with no shoe
conflict, and washes one otherwise; netting crowding, linen filters, Gang, Electricity, and Jimothy
downtime, a plausible throughput is 0.6–0.9 washes per player per day, giving **~13–19 days** to
11.25 wash events, plus up to `P−1` rotation days. That is a long session for a game whose tonal
comparable (Trash Pandas) runs 20 minutes [R-5.4]. **The sim should treat total day count as a
primary output, not a diagnostic.**

**Structural conclusion, unchanged across three versions: there is still no potential function that
strictly decreases, and therefore still no termination guarantee.** Sent-back is penalty-free, no
deck depletes, no resource is consumed, and there is no day cap. Three cheap options remain: (i) a
hard day cap with a most-washed tiebreak — which would *also* cap [C-risk-2]'s whack-a-mole
endgame, making it a two-for-one; (ii) a pity rule (an item sent back N days running washes
automatically); (iii) accept and measure. **I recommend (i) be seriously considered**, because it
answers two of the comparables' top-5 risks at once.

### 7.3 Loading is optional — the second-order effects

Beyond termination, "up to" changes who is responsible for harm.

- **It fixes [C-risk-3] cleanly.** The die now sets a ceiling and the player sizes their own
  exposure. That is the input/output randomness distinction the comparables report leans on, and
  the fix is correct and well-aimed.
- **[!] It converts the dark shoe from blameless liability into deliberate weapon.** Under mandatory
  loading, dumping a dark shoe into a contested machine was often forced — non-targeted and
  blameless, the Coloretto shape [R-3.3] praises. Now every such placement is a choice, made with
  full information, against identifiable victims. **The [C-risk-3] fix partially re-opens
  [C-risk-4] through a different door**, even though roll-4 itself was correctly repaired.
  Mitigating: the attacker burns their own dark shoe, which they must eventually wash, so the
  attack carries a real opportunity cost — exactly the property the report says makes interference
  healthy. **Judged acceptable; must be measured.**
- **Turn order in Phase 1 now matters much more.** Sequential rolling plus optional loading plus
  few machines means the last actor commits with full information about everyone else's day. Under
  [A-11] that slot rotates daily with the key, which is a free and genuine mitigation — but it is
  also an argument for [R-1.1] simultaneous loading, which the design has not adopted and which the
  comparables report names as the single highest-value change available.

### 7.4 Victory: can a second finisher overtake, and can the rotation rule hang?

**Question 1 — can a second finisher overtake the first? No. Provably not.**

The winner is "the player with the most washed items." A player's clean pile is a subset of their
10-item must-wash set (I-6), so **10 is a hard ceiling**, and clean piles are **monotone
non-decreasing** — no rule in the game removes a card from a clean pile. Sent-back, Gang,
Electricity, hostage release, and displacement all act on items in hands or machines, never on
washed items.

Therefore, the instant player X finishes, X has 10 — the maximum attainable. Any other player can
at best also reach 10, in which case the tiebreak ("whoever finished first") awards it to X.
**A second finisher can only tie, and a tie is a loss.** No player who has not finished can exceed
10 either. **The winner is fully determined at the moment of first finish.**

**Corollary, and it is the important one: the rotation-completion rule cannot change the outcome of
any game.** It was imported to answer [C-risk-5] — that strict key rotation plus a variable-length
game gives early seats up to twice the access to the strongest action. But equalising key access
*after* the race is already decided does not give anyone a chance to use it. **The rule is
decorative with respect to the winner.**

What it *does* do is add up to `P−1` days in which the outcome is known and nothing is at stake —
which is precisely [C-risk-2]'s Munchkin failure (a 20-minute game that "awkwardly stretches"),
introduced deliberately. And per [OQ-06] those days hand a finished, zero-stake player full
interference powers.

**If the fairness goal is real, the fix has to act during the race, not after it.** The comparables
report's own preferred prescription is [R-4.2]: make the key contestable at a self-balancing cost
(Kingdomino model). That fixes access fairness where it can still matter. The rotation-completion
rule is [R-4.1(a)], the report's *fallback*, and it turns out to be a null in this game because the
victory metric is capped and monotone — a property the report could not have known about.

**Question 2 — can the rotation rule fail to terminate? No. It is deterministic and bounded.**

The key passes exactly once per day, unconditionally, in fixed order, with no rule that can skip,
hold, or redirect it. Given seat 1 on day 1, every player has held it equally often exactly when
`round mod P == 0` (§3.5). If a player finishes on day `D`, the game ends at the end of day
`P·⌈D/P⌉`, so **at most `P−1` extra days**, and it cannot hang. Note this is a bound on the
*extension*, not on the game — the underlying non-termination risk in §7.2 is untouched by it.

**Edge case:** if a player finishes on a day `D` with `D mod P == 0`, the rotation is already
complete and the game ends that same day with no extension.

### 7.5 Jimothy stress test

#### 7.5.1 The keyholder turns his machine OFF, or had already
**Both are legal and both are inert.** Jimothy's machine "cannot run" regardless of power; the OFF
state adds nothing while he is present. `RESOLVE_MACHINE` gates on Jimothy *before* it gates on
power, so the outcome is `HOSTAGE`, not `RETAINED`, in both cases (worked examples B6, B7).

Consequences:
- A keyholder who spends their one action powering a Jimothy machine has **wasted the day's single
  most valuable decision**. At M=3 that is a costly mistake and one a new player will make. Worth
  an explicit rules note and a UI warning.
- **Hostage strictly overrides retained.** A player who turned a machine OFF to protect a good
  configuration loses it entirely if Jimothy lands there: on his departure the items are *released
  to hands*, not preserved for a later wash. Turning a machine off is therefore **not** protection
  against Jimothy — it is protection against reckoning only.
- The power state is still *recorded* and takes effect the moment he leaves. If he leaves in
  Phase 2 (Snack/Animal control) and the machine is ON, it will run in Phase 5 — but it will be
  empty, because release already sent the hostages to hands.

#### 7.5.2 Can hostage items ever be washed by their own machine? **No.**
Release always precedes any reckoning of that machine:
- Snack / Animal control resolve in **Phase 2**; reckoning is **Phase 5**. Released items are in
  hands by then; the machine reckons empty.
- Fright resolves in **Phase 4**; same conclusion.
- While he is present, the machine is gated at S0 every day.

So **the only route from hostage to washed is the Handwash basket** (§7.5.3). This is a sharp and
slightly counter-intuitive property that the card texts should state plainly — see [OQ-13].

#### 7.5.3 Can a hostage item be extracted by a Handwash basket? **Yes.**
"Immune to all other rules" has been confirmed as absolute, and hostage status is another rule. The
owner names their own hostage item in Phase 2; it is removed from the machine and washed
unconditionally in Phase 5 (worked example B8).

This is the card's most valuable niche after bedding, and it matters for design health: it is the
**only player-side answer to a targeted freeze**, which partially offsets the take-that concern in
§7.5.10.

Note it does not free the *machine* — the machine remains occupied and the other hostages remain
frozen.

#### 7.5.4 Can a roll-4 move an item into or out of his machine? **No, in both directions.**
- **In:** `machineAccepts` returns FALSE for a Jimothy machine (§4.6). The brief says the machine
  "cannot be loaded", and a roll-4 move is a placement.
- **Out:** hostage items are frozen [A-35]. This is an assumption, not brief text, and it is
  load-bearing: with `P` rolls per day, at least one 4 appears on 42–67% of days, so if roll-4 could
  free hostages, **Jimothy would almost never hold anyone for a full day and the hostage mechanic
  would be decorative.** Recommend blocking. (Worked example B9.)

#### 7.5.5 Gang while Jimothy is in play — the order, and why it does not matter
Both the wipe and the fright resolve in Phase 4. **[A-34] Fix the order as: the event's own effect
first, then the fright.**

**The two orders are provably equivalent for hostages:**
- *Event first:* Gang sends every item in every machine — hostages included — back to hands. Then
  fright fires; Jimothy leaves; his machine is already empty so release is a no-op.
- *Fright first:* Jimothy leaves; hostages are released to hands. Then Gang sweeps every machine and
  finds his former machine empty.

Both terminate with **every item in its owner's hand and Jimothy's card back in the event deck.**
Attached special item cards return to the deck under both. So nothing hinges on the choice — but one
must be fixed for determinism and replay, and "the event happens, then he reacts to it" makes the
brief's phrase *"resolving Gang or Electricity while Jimothy is in play"* literally true.

The same argument holds for **Electricity + fright** (worked example B13), with one asymmetry worth
noting: Electricity *retains* ordinary machines' contents into tomorrow but Jimothy's hostages are
*released to hands*. Nothing washed, yet those specific items still moved.

#### 7.5.6 Can he be placed into a machine holding a blanket? **Yes.**
Blanket exclusivity governs **items** ("cannot be *added* to a non-empty machine, and nothing may
be *added* to a machine containing a blanket"), and Jimothy is a token, not an item. He does not
join the load; he sits on the machine.

**Recommend yes, emphatically**, for three reasons: (i) it is the correct reading of the rule as
written; (ii) it is thematically ideal; (iii) it is **the single best counter to the blanket
problem** in §7.6 — a blanket alone in an ON machine is otherwise an unconditional wash, and Jimothy
is one of very few things that can stop it. (Worked example B15.)

#### 7.5.7 Can he be placed into a machine at capacity? **Yes.**
Capacity counts items (§4.6) and **[A-14]** Jimothy consumes no slot. A full machine is by
construction his highest-value target — four hostages.

One interesting wrinkle: a full machine is also the most likely to be crowding-doomed, so freezing
it can occasionally *help* its occupants by denying a reckoning that would have sent everything back
anyway. That is a nice piece of emergent texture, not a bug. (Worked example B16.)

#### 7.5.8 Do hostage items count for crowding and tier selection on the day he leaves? **No — and
they never count on any day.**

Proof, by the phase order:
- **Days when he is present:** the machine is gated at S0. Neither tier selection nor crowding is
  ever evaluated for it.
- **The day he leaves via Snack or Animal control (Phase 2):** release sends the hostages to
  **hands**. Reckoning is Phase 5. By then those items are not in the machine at all, so they cannot
  contribute to its occupancy, its tier, or any crowding count. The machine reckons empty (unless
  something else was placed there — impossible, since loading happened in Phase 1 while he was
  still present and the machine rejected everything).
- **The day he leaves via fright (Phase 4):** identical, one phase later. Still before Phase 5.

**Therefore hostage items never participate in tier selection or crowding, on any day, under any
departure route.** This is exactly why `RESOLVE_MACHINE` needs no hostage awareness beyond the S0
gate, and why the commutativity result survives untouched (§5.1).

Corollary for the destination machine under **Snack**: items that *become* hostage in Phase 2 are
likewise removed from that day's reckoning. Snack therefore deletes a machine from the day's
reckoning, which is its real tactical function (worked example B10).

#### 7.5.9 Does the fright safety valve actually work? **Yes — but the straw deck makes him a
long-term tenant.**

The mechanism is sound: every event card either *is* Jimothy or frightens him, so his residence is
geometrically distributed and cannot be indefinite. Quantifying under the brief's straw composition
(Gang ×2, Electricity ×2, Jimothy ×3 — **not adopted**, analysed because the sim should start here):

Event fires with probability `1 − (5/6)^P` per day. When he is **absent**, the deck holds all 7
cards and 3 are Jimothy. When he is **present**, his card is out, leaving 6 cards of which 4
frighten.

| P | P(event/day) | arrival/day | fright/day | **mean squat** | **steady-state P(in play)** |
|---|---|---|---|---|---|
| 3 | 42.1% | 0.181 | 0.281 | **3.6 days** | **39.1%** |
| 4 | 51.8% | 0.222 | 0.345 | **2.9 days** | **39.1%** |
| 5 | 59.8% | 0.256 | 0.399 | **2.5 days** | **39.1%** |
| 6 | 66.5% | 0.285 | 0.443 | **2.3 days** | **39.1%** |

The steady-state figure is **independent of player count** — both rates scale by the same event
probability, so it reduces to `(3/7) / (3/7 + 4/6) = 39.1%` exactly. A pleasing invariant, and a
convenient one for the sim.

**[!] The finding: under the straw deck, Jimothy is in play on ~39% of all days, and each visit
lasts 2.3–3.6 days.** At M=3 he freezes **a third of the board** for that entire time; at M=4, a
quarter. Combined with §2.2, this means the effective machine count is roughly `M − 0.39` — enough
to materially undo part of the contention gain the machine cut was designed to produce, and enough
to make the board genuinely cramped at 4 players (effectively ~2.6 machines).

That is very likely too Jimothy-heavy. **The event deck composition is P0 and I am not resolving
it**, but the sim should treat *Jimothy uptime* as a first-class output, and the designer should
know that "Jimothy ×3 of 7" implies he is present two days in five.

#### 7.5.10 Jimothy's remaining design risk
**Placement is a targeted, gain-free attack** — one player points at one machine and freezes it,
choosing the victim. That is the archetype [C-risk-4] identifies as the worst-documented take-that
shape, and it is notable that the design just *fixed* exactly this problem in roll-4 (by allowing
your own items) only to reintroduce it in Jimothy.

Three mitigations, in ascending cost:
1. **The layer did not choose to draw him** — the target selection is downstream of a blind draw,
   so it is not a repeatable, on-demand attack. This is real and probably sufficient at low Jimothy
   frequency.
2. **[OQ-08(d)] Deterministic placement** — the fullest machine, ties to lowest index. Removes
   target selection entirely, is thematic (most laundry attracts the raccoon), and is the
   low-conflict alternative if playtests show targeting friction.
3. Restrict placement by a barrier (a machine the layer also has items in), per [R-3.1(c)].

**No change recommended; flagged for playtest.** Note that the Handwash basket's ability to extract
hostages (§7.5.3) already gives victims a defensive option, which is precisely what the comparables
report says targeted attacks need.

### 7.6 The blanket problem — now sharper at M=3

A blanket must occupy a machine **alone**, so it consumes an entire machine, not one of four slots.
With `M = 3` at 3–4 players, **one blanket is 33% of the board.**

- **87.5% of players are dealt at least one blanket; 37.5% are dealt both.**
- A blanket alone in an ON, Jimothy-free machine **always wins its own tier and always washes**
  (§5.5). It cannot crowd, cannot be tainted, and cannot fail.
- **[!] Day 1 is therefore close to solved.** All machines start ON and empty. Every player holding
  a blanket should load it into an empty machine on day 1 for a guaranteed wash. At `M = 3` with
  `P = 4`, only three can — **decided by acting order**, which on day 1 is seat 1 first. That is a
  scripted opening and a first-mover advantage on the single most valuable free action in the game.
- **[!] Board-lock is now reachable.** If every machine holds a blanket, `machineAccepts` is FALSE
  everywhere: nobody can load, and roll-4 has no legal destination. At `M = 3` this needs only three
  blanket loads on one day. It **self-clears** at reckoning (all blankets wash, machines empty), so
  it is a one-day denial rather than a deadlock — but a keyholder who turns one of those machines
  OFF removes a third of the board for at least another day, and Jimothy on a blanket machine does
  the same for 2.3–3.6 days.

Mitigations exist within current rules (Jimothy on the blanket, §7.5.6; Coloring attached to a
blanket machine; a roll-4 displacing the blanket; a keyholder turning it off) but all are reactive
and none are available on day 1.

**Recommend the designer consider one of:** machines start OFF; or blankets may not be loaded on
day 1; or a blanket occupies a machine but does not prevent *other* blankets. **No change proposed
here** — this is a balance decision and the sim should quantify how often the day-1 blanket rush
decides the game by seat.

### 7.7 Other integrity findings

1. **[!] Version header.** The brief's title says v4; its Jimothy section says "REVISED v5". Fix
   the header.
2. **[!] "Never a deck" vs "shuffled back into the event deck"** — a literal contradiction in the
   Jimothy section, repaired in §5.11.1 by distinguishing the token from the card. The brief's text
   should adopt that distinction explicitly.
3. **[!] Release is counter-intuitive and the card texts do not warn about it.** Players will read
   "Animal control removes Jimothy" and expect their laundry to be saved. It is not — it goes back
   to hand. Snack and Animal control should say "the machine's items return to their owners' hands"
   in so many words. See [OQ-13].
4. **Snack and Animal control are unplayable when Jimothy is absent** (no legal target) and are
   held with no redraw — dead cards ~61% of the time under the straw deck. This is a real cost on
   the roll of 5 and is the tightest coupling between the two P0 deck compositions.
5. **"No capacity limit" is gone, but crowding is still a *soft* cap of 2 per type**, now sitting
   under a hard cap of 4 items. Player-facing text should present both together or players will be
   surprised by the interaction.
6. **The key is weak and now weaker in relative terms.** It confers one power toggle per day. With
   `M = 3`, toggling one machine is proportionally a bigger deal than it was at `M = 7`, which
   partly compensates — but §7.5.1 shows a toggle can also be silently wasted on a Jimothy machine.
   [R-4.3] argues the key needs either more counterweight or contestability; neither is present.
7. **Nothing changes a machine's contents between the last load and reckoning except cards, the
   key, and events** — all of which sit in Phases 2–4, *after* Phase 1 loading. [R-1.2] flags this
   as making the load a gamble rather than a decision. The face-up event proposal [OQ-05] would
   substantially reduce it; simultaneous loading [OQ-18] would reduce it further.

### 7.8 Hand-resolvability audit

| Requirement | Status |
|---|---|
| No hidden bookkeeping | **PASS.** Three persistent per-card states exist and all three are physical: bedding tokens on the card [A-04], fresh/ready as separated zones [A-02], and hostage status as *the raccoon figure sitting on the machine* (I-10, derived, needs no marker at all). |
| Reckoning inputs visible at the machine | **PASS.** `RESOLVE_MACHINE` reads only the machine's items, its attached cards, and whether Jimothy is on it. All three are visible by looking at it. |
| Bounded per-machine scan | **PASS.** Two gates then four commuting passes: tier, isolation, crowding count, Coloring ownership. Because they commute (§5.1), a table may do them in any order and get the same answer. |
| Capacity self-enforcing | **PASS**, if machine mats print 4 slots. Recommended (§2.8). |
| HOSTAGE does not add table burden | **PASS.** It is a gate, not a verdict, and it is derived from the raccoon's position. Nothing to track. |
| Rotation-completion trackable | **PASS.** `round mod P == 0` is "stop when the key returns to whoever started." No per-player counting. |
| Face-down event administrable | **PASS** physically (trivial); the one thing *harder* digitally, since it must be hidden from every client including its creator. |
| Deterministic, replayable | **PASS**, with seeded RNG for the die, both decks, and the deal. Machine index order in Phase 5 is for tidiness only; results are order-independent. |
| Pure reducers | **PASS.** `RESOLVE_MACHINE` is pure. Impure steps per day: `P` die rolls and at most two deck draws. |

**[CONFLICT] — where the two goals genuinely diverge:**
- **[OQ-18] simultaneity.** Simultaneous loading and/or special-item play is the better game
  ([R-1.1], [R-3.4] name it the highest-leverage change available) and the worse implementation
  (commit/reveal sub-phase). v0.3 stays sequential; this is a real design cost, not a neutral
  choice.
- **[OQ-19] hidden hands.** Good for tension; requires `playerView` stripping and gives any MCTS bot
  imperfect information needing determinization. Note the brief's own §10 positioning argues for
  *open* information, which cuts the other way and is worth revisiting.
- **The pending event, inverted.** Trivial physically, fiddly digitally.
- **[OQ-20] bedding progress.** Trivial digitally if private, impossible physically. Resolved public.

---

## 8. WHAT THE BALANCE SIMULATION MUST MEASURE

The two remaining P0s — special item deck composition and event deck composition — are **not
resolved here**. They are coupled to each other (Snack and Animal control are dead cards whose
value depends entirely on Jimothy's frequency), and both are coupled to the machine-count
calibration in §2.2. Below is what the simulation needs to produce to set them well.

### 8.1 Primary outputs — the game must clear these before deck tuning means anything

| Metric | Why | Target / red flag |
|---|---|---|
| **Realized load rate `L`** (items loaded per player per day) | §2.2 calibrated machine counts on `L = 1.5`; "up to" makes that a ceiling. **Everything else depends on this number.** | If `L < 1.2`, the machine reduction has not achieved its goal and counts should be revisited before deck tuning. |
| **Items washed per player per day** | [C-risk-1]. | Red flag below ~0.5; implies a >20-day game. |
| **Dead-reckoning rate** — fraction of ON machine-resolutions washing **nothing** | The Deep Sea Adventure failure mode, named as risk #1. | Red flag above ~40%. |
| **Total game length in days**, full distribution not just mean | §7.2 estimates 13–19 days + up to `P−1`. Tonal comparable runs 20 minutes. | Report P90, not just the mean. |
| **Non-termination rate** — games exceeding a large day cap | §7.2: no termination guarantee exists. | Any non-zero rate is a finding. |

### 8.2 Jimothy and the event deck

| Metric | Why |
|---|---|
| **Jimothy uptime** — fraction of days in play | §7.5.9 predicts 39.1% under the straw deck, independent of `P`. Verify, then decide if that is acceptable. |
| **Mean and max consecutive squat length** | Predicted 2.3–3.6 days. At `M = 3` each day is 33% of the board. |
| **Effective machine count** = `M − (uptime × 1)` | The number that actually governs contention. Feed it back into §2.2. |
| **P(a Jimothy counter is in someone's *ready* hand when he arrives)** | **The joint constraint between the two decks.** If low, Snack and Animal control are ornamental; if high, Jimothy never sticks. Note the one-day fresh delay means a counter drawn the same day cannot answer him. |
| **Dead-card rate for Snack / Animal control** — fraction of player-days holding one with Jimothy absent | §7.7.4. These are 2 of 7 types with no redraw and no discard-for-value. |
| **Gang frequency and mean items destroyed per Gang** | Now a real pre-reckoning wipe (§7.3 of the brief's new order). [R-2.2] says uncompensated global wipes are the failure mode. |
| **Electricity frequency and days lost** | Each one is a full day of zero progress for everyone. |

### 8.3 Special item deck

| Metric | Why |
|---|---|
| **Marginal effect of each card's count** on washes/day and game length | The deck is the primary balance dial; measure each card's contribution separately. |
| **Handwash basket frequency** | §7.2: it is the game's **only monotone progress ratchet**, and adding two card types diluted it ~30%. Its count is the single strongest lever on termination. |
| **Basket usage split** — bedding / hostage rescue / crowd defusal / tier defusal | [A-23] lets it clean bedding outright; §7.5.3 lets it free hostages. If bedding dominates, that assumption is carrying too much weight and should be re-examined. |
| **Coloring's realized impact** — items ruined per play | [A-20] makes "ruins" mean sent-back-with-no-penalty, so it may read far scarier than it plays. |
| **Wash net dead-play rate** | Narrow card; may be dead as often as Snack. |

### 8.4 Fairness and endgame — the comparables' risks, measured

| Metric | Why |
|---|---|
| **Win rate by seat** | [C-risk-5]. Especially day-1 blanket rush (§7.6) — measure P(seat 1 washes a blanket on day 1) versus later seats. |
| **P(the day-1 blanket rush occurs)** and its correlation with winning | §7.6 argues day 1 is close to solved. If seat correlation is strong, the opening needs a rule. |
| **Board-lock frequency** — days where every machine refuses all loads | §7.6. At `M = 3` this needs only three blanket loads. |
| **Leader-targeting rate** — Coloring / roll-4 / Jimothy placements aimed at the leader in the final 3 days | [C-risk-2], the Munchkin whack-a-mole endgame. |
| **Rotation-extension length and what happens in it** | §7.4 proves it cannot change the winner. Measure how many days are spent in a decided game, and how often a **finished** player interferes ([OQ-06] — the kingmaking exposure). |
| **Turn-order advantage within Phase 1** | §7.3: the last actor commits with full information. Under [A-11] the slot rotates with the key; verify the rotation actually neutralises it. |
| **Capacity-block rate** — how often a player cannot load where they want | Confirms capacity 4 is biting without being oppressive. Predicted ~7% at `P=3`, ~19% at `P=6`. |

### 8.5 Sensitivity runs worth doing regardless of deck tuning

1. **`L` sweep** (players load 100% / 75% / 50% of their ceiling) — isolates the "up to" risk in
   §7.2, which is the biggest single unknown in the design.
2. **Face-up vs face-down events** [OQ-05] — measure decision quality and variance, not just
   outcomes.
3. **With and without the rotation-completion rule** [OQ-07] — confirm empirically that outcomes are
   identical, which §7.4 proves analytically, and measure the added length.
4. **Finished players acting vs not acting** [OQ-06] — measure how often the runner-up changes.
5. **Machine counts `3/3/4/4` vs `3/4/4/5`** [OQ-28] — the P=4 non-monotonicity.
6. **A hard day cap** — §7.2 recommends considering one; measure what cap value would bind, and
   whether it also shortens the whack-a-mole endgame.

---

## 9. SIGN-OFF CHECKLIST

| Pri | ID | Question | v0.3 default |
|---|---|---|---|
| **P0** | §2.6 | Special item deck composition | **Deferred to simulation** (§8) |
| **P0** | §2.7 | Event deck composition | **Deferred to simulation** (§8); straw deck implies 39% Jimothy uptime |
| **P1** | OQ-06 | Do finished players keep acting during the extension? | **No — they stop.** Otherwise a zero-stake kingmaker for `P−1` days |
| **P1** | OQ-07 | Keep the rotation-completion rule at all? | **Drop it** — §7.4 proves it cannot change the winner |
| **P1** | OQ-05 | Event card face-up instead of face-down? | **Face-up** — cheapest high-value change now that events precede reckoning |
| **P1** | §7.6 | Day-1 blanket rush and board-lock at `M=3` | **No change; measure.** Flagged as a possibly-solved opening |
| **P1** | §7.2 | Termination — "up to" reintroduces the stall equilibrium | **No change; measure.** Day cap recommended for consideration |
| **P1** | OQ-08 | Who chooses Jimothy's machine? | **The player who laid the card** [A-15]; deterministic-fullest is the low-conflict alternative |
| **P2** | OQ-09 | Roll-4 move a hostage out? | **No** [A-35] |
| **P2** | OQ-10 | Basket extract a hostage? | **Yes** [§7.5.3] |
| **P2** | OQ-11 | Gang vs fright order | **Event effect, then fright** [A-34]; outcomes provably identical |
| **P2** | OQ-12 | Jimothy on a blanket / full machine? | **Yes to both** |
| **P2** | OQ-13 | Does release ever wash? | **No — rewrite the card text** [A-31] |
| **P2** | OQ-02/03 | Roll-4 load/move order and optionality | **Player's choice; optional** [A-08] |
| **P2** | OQ-28 | Machine-count non-monotonicity at P=4 | **Accept; measure** |
| **P3** | OQ-17 | Acting order | **Keyholder first, then clockwise** [A-11] |
| **P3** | OQ-18 | Simultaneous special item phase? | **Sequential for now**; top candidate for the next pass |
| **P3** | OQ-19 | Hidden hands? | **Yes** [A-12] — but the brief's open-information positioning cuts the other way |
| **P3** | OQ-04 | Fresh zone face-up | **Yes, state it explicitly** [A-02] |
| **P3** | OQ-16 | Simultaneous finishers | **Joint victory** [A-17] |
| **P3** | OQ-01/14/15/20–27 | Minor, as listed in §6 | as listed |
| **P3** | §7.7.1/2 | Brief version header; "never a deck" contradiction | **Fix both in the brief** |
