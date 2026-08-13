# Laundromat — Design Brief v9

Ground truth for all design work. Supersedes v0–v8.
**Status: physically playtested many times with paper cards. The core loop is confirmed fun.**

**OPEN** = unresolved. Propose a default and flag it; do not invent silently.

> **v9 brings this document in line with the web prototype**, which the designer has been
> playing and steering directly. The Python simulation (`sim/rules.py`) is **behind** on
> several of these rules and has not been updated. Before trusting any balance number,
> read `design/implementation-status.md` — it lists, rule by rule, where the brief, the
> simulation and the app disagree.

---

## 1. Players & Components

- **Players:** 3–6
- **Colors:** one per player
- **Items per color:** **14**

### Machines

**Machine count = `P + 1`. Capacity = 4 items per machine, flat at every player count.**

| Players | Machines | Capacity |
|---|---|---|
| 3 | 4 | 4 |
| 4 | 5 | 4 |
| 5 | 6 | 4 |
| 6 | 7 | 4 |

### Item taxonomy — REVISED v8

Each garment type exists in a **dark** and a **light** shade of the player's color.
A pair of socks is **one card**. **Bedding is removed from the game.**

| Type | Category | Cards per shade |
|---|---|---|
| Shoes | clothes | 1 |
| Socks (a pair) | clothes | 1 |
| Pants | clothes | 1 |
| Shirts | clothes | 1 |
| Hats | clothes | 1 |
| Underwear | linen | 1 |
| Blanket | linen | 1 |

7 types × 2 shades = **14 cards per color.**

### Starting hand

Each player draws **10 of their 14 items at random.** Only those 10 must be washed.

### Categories

- **Clothes** = shoes, socks, pants, shirts, hats.
- **Linen** = underwear, blanket.
- **Item** = any of the above. The reckoning tiers operate on **items**.

### Card sort order — NEW v9

Hands, damp zones and clean piles are displayed in one fixed order, by how much the item
dominates a reckoning:

> **dark shoes → light shoes → dark clothing and dark blanket → light clothing and light
> blanket → dark underwear → light underwear**

Shoes sort first because they decide the whole machine; underwear sorts last because it can
only ever wash among underwear, so it is the least flexible thing you can hold. Within a
rank, items sort by type name. This is presentation only — it changes no outcome — but it
is a teaching aid and should be the same on the cards, the app and the rulebook.

---

## 2. The Key

- The first player starts with the key.
- The keyholder is the only player who can switch a machine on or off — **except the holder
  of the Coin** (see §6).
- **The key passes at the end of the day**, after reckoning.

---

## 3. Machine State

- All machines **start ON.**
- An **OFF** machine skips reckoning and **keeps its contents loaded** into the next day.
- **Capacity 4.**

### Crowding rule

If a machine contains **3 or more items of the same garment type — regardless of color or
shade** — all of them are sent back during reckoning (if the machine is on).

---

## 4. Round Structure ("a day")

1. **Roll phase** — each player, in turn order, rolls one die and takes their turn.

   **Acting order starts with the keyholder — RESOLVED v9.** The keyholder rolls and loads
   first; play proceeds around the table; the player immediately before the keyholder (that
   is, the *previous* day's keyholder) acts last. The keyholder then also takes the key
   phase in step 3.

   Because the key passes every night, acting order rotates with it. On day 2 the second
   player leads the roll phase, the first player acts last, and the second player then
   adjusts a machine.

   This is no longer a configuration switch — `keyholderFirst` is **always true**. It
   removes a measured first-seat advantage (seat 1 won 38.4% against a 33.3% fair share at
   three players) and rotates the exposure that immediate event resolution creates for
   players who have already acted.

   | Roll | Effect |
   |---|---|
   | **1** | Load 1 item |
   | **2** | Load 2 items |
   | **3** | Load 3 items |
   | **4** | Load 1 item, **and** move any one garment between machines — **including your own** |
   | **5** | Load 1 item, **and** draw a special item card |
   | **6** | Load 1 item, **and** draw an event card. **Revealed the moment it is drawn.** Only the **first** 6 of the day draws an event; later 6s load only. |

   **Loading is mandatory.** A player must load exactly the number rolled, loading fewer
   only if their hand holds fewer.

   **On the same turn a player may ALSO play at most one special item card** — never one
   drawn that same day. Loading and card play both happen on your turn.

   **Order within your turn — RESOLVED v8, CONFIRMED v9:**
   1. Roll the die.
   2. **Play a special item card** (optional, at most one, never one drawn today).
   3. **Load** exactly the number rolled.
   4. **Resolve the die's extra effect** — move a garment (4), draw two keep one (5),
      or reveal an event (6).

   Card play precedes loading. This is the only order under which the *Mesh bag* functions
   at all, since it covers what you load "on the turn you play it" — the bag must be open
   before the laundry goes in. Confirmed implemented in the app and in the simulation. The
   opposite reading (roll → extra → load → card) survives in the app as a dead ablation
   switch and in `rules-v0.4.md §3.1`, which is stale on this point.

   **Drawing a special item: draw two, keep one**, and return the other to the bottom of
   the deck.

   **Cards cannot be played on the day they are drawn.** A drawn card enters a face-up
   **fresh** zone and is promoted to the **ready** hand at end of day.

2. **Event resolution** — the revealed event card, if any, resolves. **When it resolves is
   now an A/B test — see below.** At most one event happens per day under every arm.
3. **Key phase** — the keyholder may turn one machine on, turn one machine off, or pass.
4. **Reckoning** — each ON machine resolves.
5. **End of day** — fresh cards promote to ready; the key passes to the next player.

### Event timing — OPEN, NEW A/B in v9

The event card is **revealed the instant it is drawn** under every arm. That is settled and
is not what is being tested. What is being tested is the gap between reveal and resolution.

| Arm | Rule |
|---|---|
| **E1 "immediate"** | The event fires the moment it is drawn, mid-turn. The drawer names Gang's or Jimothy's washer there and then, and players who have not yet acted play into the changed board. |
| **E2 "deferred"** | The event fires after every player has taken their turn, immediately before the keyholder acts. **This is v8 as written, and the only arm `sim/rules.py` implements.** |
| **E3 "split"** | Circuit break and Animal control fire on draw; Gang and Jimothy wait until everyone has loaded. |

> **OPEN — event timing.** All three arms are implemented and playable in the app and are
> selectable at setup. **The app's default is E1**, at the designer's instruction. Nothing
> has been simulated; the write-up in `web/experiments/experiment-B-event-timing.md` is
> reasoning, not measurement.
>
> The case for **E1** is that it is the only arm under which a special item can answer an
> event at all: under E2 no Coin can restore power after a Circuit break and no Snacc can
> move Jimothy on the day he lands. The case for **E2** is fairness and dread — the event
> lands after everyone has had the same chance to load, and a revealed-but-unresolved event
> makes people load under real uncertainty.
>
> **E1's known cost is a seat-order asymmetry** — players who have already acted lose their
> loading with no recourse. The mitigation — **keyholder-first acting order** — is now a
> settled rule rather than a switch (see §4), so this objection is largely answered.
> *The app currently runs E1 with fixed seat order,
> i.e. the unmitigated combination.* That pairing is itself an open decision.

---

## 5. Reckoning

Evaluated per ON machine, in strict precedence. Tiers operate on **all items**.

1. **Dark shoes present** → dark shoes wash; everything else returns to its owner.
2. **Else light shoes present** → light shoes wash; everything else returns.
3. **Else dark items present** → dark items wash; everything else returns.
4. **Else light items only** → light items wash.

Teaching line: *"shoes first, then dark, then light."*

### Filters applied on top of the tiers

- **Crowding:** 3+ items of the same garment type (any color/shade) → all sent back.
- **Underwear** may only be washed among underwear.
- **Blanket** must occupy a machine alone — **except for socks** (see below).

Filters and tiers are both overridden by the **Mesh bag** (§6): a bagged item washes
regardless of any of the above.

### Socks and blankets — NEW v8

**Socks may share a machine with a blanket.** Socks may be loaded into a machine already
holding a blanket, and a blanket may be added to a machine already holding socks. This is
the only exception to blanket exclusivity.

**Socks washed alongside a blanket require one additional wash.** After the blanket washes,
those socks are not yet clean — they need one more wash to finish. The rule keys on the
machine **containing** a blanket, not on the blanket itself washing.

**Damp socks sit in a face-up damp zone — NEW v9.** They are loadable exactly like the hand,
but they are public. Damp is the only persistent per-item state in the game, and keeping it
public is what makes the physical version enforceable. No reckoning outcome changes either
way; the app can be switched back to keeping them hidden in hand.

Sent-back items return **straight to the owner's hand with no penalty.**

**Invariant:** every ON machine is empty after reckoning.

---

## 6. Special Item Deck — REVISED v9

Drawn **two, keep one** on a roll of 5. Played from hand on your own turn, at most one per
turn, never the day it was drawn. **After being played, shuffled back into its deck.**

| Card | Effect |
|---|---|
| **Coloring** | The owner ruins every other color in the same machine. |
| **Color catcher** | Mitigates *Coloring* for the color catcher's owner. |
| **Bleach** | **Swaps every item's shade** in that machine before the ladder is read: dark counts as light, light counts as dark. *(Corrected 2026-08-06 — this row read "light washes, dark is sent back", which is wrong whenever shoes are present. See below.)* |
| **Mesh bag** *(was Wash net)* | **REVISED v9.** Play it on a machine as you load. **Everything you load into that machine this turn goes in the bag, and all of it washes when that machine runs** — whatever else is in there. Items already sitting in the machine from earlier rounds are **not** in the bag. |
| **Snacc** | Lures Jimothy to another machine of the player's choice. |
| **Sanitizer** | **NEW.** Neutralizes shoe tainting in this machine — shoes no longer dominate. All other rules still apply. |
| **Coin** | **NEW.** A one-time card. Played on your turn as you load, used immediately to turn one machine on or off independently of the keyholder, then shuffled back into the special item deck. |

### The Mesh bag — REVISED v9

The v8 *Wash net* protected **underwear only**, and all it waived was underwear isolation.
The Mesh bag is much stronger: **a bagged item's verdict is simply "washes."** It beats the
tier ladder, crowding, underwear isolation, blanket exclusivity and Coloring, and it covers
**any item type**, not just underwear. Membership is fixed at load time and is per-item.

**The v8 Wash net is not deleted.** It survives in the app as a selectable ablation and is
what the entire simulation-parity fixture set still runs on. If the Mesh bag is rejected,
v8's text is intact and can be reinstated.

**Naming caution.** The card's internal id in both codebases is still `Wash net`; only its
display name is "Mesh bag". This was deliberate — it keeps the deck vocabulary matching the
Python oracle so the constants parity check stays meaningful. It also means `sim/rules.py`
and the app now disagree about this card's **name** as well as its **effect**.

> **OPEN — do bagged items still count for everyone else?** Currently **yes**: bagging your
> dark shoes wins them a guaranteed wash *and* still puts the machine on tier 1, sending
> everyone else's laundry back. The alternative is that bagged items are lifted out of
> consideration entirely, so the rest of the machine resolves as if they were not there.

> **OPEN — do bagged socks beside a blanket still come out damp?** Currently **yes**: damp
> is treated as "needs two washes" rather than as a taint, so the bag does not override it.

> **[!] BALANCE FLAG — the Mesh bag is now comfortably the strongest card in the game.**
> Roll a 3, play the bag, load three items: three of the ten washes you need, guaranteed,
> with no counterplay — against a baseline of roughly **1.5 loads per player-day**, only
> some of which wash. It is also the only way to wash underwear, blankets and damp socks on
> demand. At the placeholder 3-of-20 it is expected to dominate.
> **This is the web agent's judgement, not a measurement.** Note the precedent: the Handwash
> basket was deleted in v8 for exactly this failure mode, measured at 10–28 plays per game
> supplying 33–47% of all washing. The Mesh bag washes *three* items per play, not one.

> **OPEN — Sanitizer scope.** Does it suppress tiers 1–2 so the machine resolves on
> dark/light alone (machine-wide), or does it protect only the player who played it
> (like Color catcher)? Default implemented: **machine-wide**, tiers 1–2 suppressed,
> resolution proceeds at tier 3.

> **RESOLVED v8 — Coin is a one-shot.** Played on the owner's turn as they load, resolved
> immediately, returned to the deck. It is not held or reusable. This avoids creating a
> second key that never rotates.

> **OPEN — P0. Deck composition is still unset.** Number of copies of each of the 7 cards.
> **Manufacturing constrains the deck to exactly 20 cards** across the seven specials; the
> app asserts that total at setup and ships an arbitrary flat **3/3/3/3/3/3/2** placeholder
> that is explicitly *not* a recommendation. The simulation still uses 2-of-each = 14 cards
> and does not know about the 20-card constraint. **The sweep must now treat the Mesh bag as
> its own question**, not as one card among seven.

---

## 7. Event Deck — REVISED v8

**Exactly four cards, one copy each.** Drawn on the first 6 of the day and revealed
immediately; resolves in phase 2. Event cards shuffle back into the deck after resolving —
**except Gang, which never returns.**

| Card | Effect |
|---|---|
| **Gang** | The drawer picks one washer for the gang to hide behind. It is shot and **out of the game permanently.** Its contents return to their owners. The Gang card stays on that washer. Gang happens **only once** and never returns to the deck. |
| **Circuit break** | *(replaces Electricity)* Every washer switches **OFF.** Machines retain their contents. **Under A/B test — see below.** |
| **Jimothy** | Jimothy occupies a machine. See below. |
| **Animal control** | Removes Jimothy outright; hostage items return to their owners' hands, unwashed. |

> **OPEN — Circuit break is under A/B test.** All three arms are implemented in both the app
> and the simulation, and are selectable at setup. Contents are retained under every arm.
> **V1 "blackout"** — only that night's reckoning is cancelled; machine power states are
> untouched and everything resumes normally the next day.
> **V2 "all off"** — every washer switches OFF and the keyholder restores one per day.
> This is the rule as the card text below still reads, and it is the **simulation's**
> default.
> **V3 "auto-restore"** — all off, but every surviving washer comes back on at the end of
> the following day's reckoning.
>
> **The app defaults to V3**, following the smoke test in
> `sim/out/experiment-A-circuit-break.txt`. That run confirmed V2 degrades sharply and
> monotonically with player count — availability falls to 62% of live machines at 6 players
> versus 93% under V1, and V2 adds +2.18 days there — while V3 roughly halves the damage and
> keeps the card threatening. **That was a smoke test, not a decision run**: no V0 control,
> 500 games per cell, one bot policy, no confidence intervals. The designer has not
> committed, and the app and the simulation currently default to different arms.

> **RESOLVED v8 — Gang destroying Jimothy's machine.** The washer is destroyed, hostage
> items are released to their owners, and **Jimothy relocates** to another washer. The
> player who drew Gang chooses both the washer to destroy and the washer Jimothy moves to.

Because there is exactly one Jimothy card and it sits on the board while he is in play, he
can never be drawn while already present — that ambiguity is closed by deck composition.

> **OPEN — Animal control can be a blank.** As an event it fires automatically on reveal;
> if Jimothy is not in play it does nothing.

### Jimothy

Jimothy is placed in a machine. While he is there:

- The machine **cannot run** and **cannot be loaded.**
- Items already inside are **held hostage** — released to their owners **when he leaves.**
  Release never washes anything; hostages return to hand.

**He leaves only via Snacc or Animal control.** Gang and Circuit break do not affect him.

---

## 8. Victory — REVISED v8

**The first player to wash all 10 of their drawn items wins, and the game ends immediately.**

**Simultaneous victory is possible.** If more than one player completes their laundry on the
same day, they all win together.

---

## 9. Platform Goals

- **Digital, remote multiplayer** — also the playtesting vehicle
- **Physical card version** — hand-resolvable, no hidden bookkeeping. Paper prototype
  already exists and has been played many times.

---

## 10. Positioning — CONFIRMED

**Prior art:** *Dirty Laundry: Sabotage Shedding Game* (Quokka Games, 2021) shares the
premise, communal machines, red-sock mechanic, and victory condition — but its loaded items
are **concealed**, making it a memory and bluffing sabotage game.

**Laundromat is deliberately an open-information tactical game.** The whole board is visible
and the puzzle is solving it. This is the committed differentiator and design decisions
should defend it.

---

## 11. Card Text — DRAFT

Convention: bold trigger, then effect, then any lingering rule. Two lines maximum.

### Special items

> **Coloring** — Play on a machine. Every other player's items here are ruined and sent back.

> **Color catcher** — Play on a machine. Your items here ignore Coloring.

> **Bleach** — Play on a machine. Until it runs, every item inside counts as the opposite shade:
> dark counts as light, light counts as dark. Shoes are still shoes.

> **Corrected 2026-08-06.** Both this card face and the §6 table used to say "light items wash, dark
> items are sent back." That is a **shorthand that gives the wrong answer whenever shoes are in the
> machine.** Bleach swaps shade *before* tier selection, so bleached dark shoes read as **light
> shoes** — still shoes, still the top occupied rung, and they still wash. See `rules-v0.4` §6.8 and
> worked example 12, and `reckoning.ts` step S1, all three of which have always implemented the
> swap. **No rule changed here; only the description was wrong.** Final card wording lives in
> `design/strings/card-text.md`.

> **Mesh bag** — Play on a machine as you load. Everything you load into it this turn goes in the bag, and all of it washes when that machine runs — whatever else is in there.

*(Superseded, retained for reference — v8's* **Wash net** *: "Play on a machine as you load.
Underwear you load this turn washes here even among other garments. Underwear already in the
machine is not protected." This is still the wording the simulation implements.)*

> **Sanitizer** — Play on a machine. Shoes stop tainting this wash. Every other rule still applies.

> **Coin** — Turn any one machine on or off. You do not need the key. One shot.

> **Snacc** — Lure Jimothy to any other machine. Items he leaves behind go back to their owners' hands, unwashed.

### Events

> **Gang** — Pick a washer. The gang hides behind it and shoots it. That washer is out of the game. Leave this card on it. Gang happens only once.

> **Circuit break** — The power trips. Every washer switches off. Machines keep whatever is inside them.
> *(Final wording waits on the arm. This text is V2; under V1 it reads "nothing washes tonight", under V3 it gains "the power comes back at the end of tomorrow".)*

> **Jimothy** — Jimothy settles into a washer. It cannot run and cannot be loaded. Anything inside is stuck with him until he leaves. Only Snacc or Animal Control move him.

> **Animal control** — Jimothy is taken away. Anything stuck with him goes back to its owner's hand, unwashed.
