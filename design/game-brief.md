# Laundromat — Design Brief v10

Ground truth for all design work. Supersedes v0–v9.
**Status: physically playtested many times with paper cards. The core loop is confirmed fun.**

**OPEN** = unresolved. Propose a default and flag it; do not invent silently.

> **v10 closes three long-open questions and changes one rule.** Event timing, the circuit
> break arm and Sanitizer scope are all resolved, and their alternatives are deleted rather
> than left as switches — the app no longer offers them at setup. The damp-socks rule is
> replaced outright: socks beside a blanket now stay in the washer instead of coming back
> damp. See §4, §5, §6 and §7.
>
> **v9 brought this document in line with the web prototype**, which the designer has been
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

Hands, washer contents and clean piles are displayed in one fixed order, by how much the item
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

### Event timing — RESOLVED v10

An event card is **revealed and resolved the instant it is drawn**, mid-turn. Players who
have not yet acted play into the changed board.

**The drawer chooses the washer** for the Gang and for Jimothy, on the spot.

> **RESOLVED v10.** This was arm E1 of a three-way A/B (immediate / deferred / split). E2
> and E3 are deleted from the app; git history keeps them.
>
> The case that won: this is the only reading under which a special item can answer an
> event at all. Under the deferred arms no Coin could restore power after a Circuit break
> and no Snacc could move Jimothy on the day he landed, which made two cards dead against
> the events they most obviously address.
>
> **The known cost is a seat-order asymmetry** — players who have already acted lose their
> loading with no recourse. The mitigation, **keyholder-first acting order**, is a settled
> rule (§4) and is what the app ships, so the unmitigated pairing the v9 brief worried
> about no longer exists.
>
> **Nothing here was simulated.** `sim/rules.py` still implements only the deferred arm, so
> every day-level number in `sim/out/` still describes a different game. The write-up in
> `web/experiments/experiment-B-event-timing.md` is reasoning, not measurement, and is kept
> for its argument rather than its conclusions.

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

**Socks do not wash in a machine containing a blanket — REVISED v10.** They are damp, and
they **stay in the washer**. They do not come back to their owner and they do not go to the
clean pile; they simply remain in the drum. The rule keys on the machine **containing** a
blanket, not on the blanket itself washing.

They sit there as ordinary dirty socks. The first night that washer runs **without** a
blanket in it, they wash normally. If a blanket is loaded in again first, they are damp
again that night and stay again.

> **This replaces v9's "one additional wash" plus a face-up damp zone.** Damp is no longer
> a property of a sock that travels with it — there is nothing to mark and nothing to
> track between zones. It is a property of the situation: socks, in that washer, with a
> blanket. At the table you can read it off the board, which is what the damp zone was
> trying to buy and now costs nothing.
>
> **Consequence worth playing before signing off:** stranded socks occupy a slot and count
> for crowding, and a player who keeps loading blankets into the same washer keeps someone
> else's socks hostage in it. Bot games terminate normally, but whether this is a good
> pattern is a table question, not a code one.

**Socks that the reckoning SENDS BACK are not stranded.** Losing the verdict and being held
by a blanket are different things: a sock the ladder rejects returns to its owner's hand
like any other rejected item.

Sent-back items return **straight to the owner's hand with no penalty.**

**Invariant:** every ON machine is empty after reckoning, **except for socks a blanket has
stranded in it.**

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

> **RESOLVED v10 — a Mesh bag does not save socks from a blanket.** It is structural rather
> than a ruling: the bag guarantees a **verdict**, and being stranded by a blanket happens
> after the verdict, to items that passed it. Bagged socks beside a blanket stay in the
> washer like any others.

> **[!] BALANCE FLAG — the Mesh bag is now comfortably the strongest card in the game.**
> Roll a 3, play the bag, load three items: three of the ten washes you need, guaranteed,
> with no counterplay — against a baseline of roughly **1.5 loads per player-day**, only
> some of which wash. It is also the only way to wash underwear and blankets on demand. At the placeholder 3-of-20 it is expected to dominate.
> **This is the web agent's judgement, not a measurement.** Note the precedent: the Handwash
> basket was deleted in v8 for exactly this failure mode, measured at 10–28 plays per game
> supplying 33–47% of all washing. The Mesh bag washes *three* items per play, not one.

> **RESOLVED v10 — Sanitizer is machine-wide.** It suppresses tiers 1–2 for **everything
> in that washer, whoever owns it**, and resolution proceeds at tier 3. The owner-only
> reading is rejected: as `rules-v0.4 [OQ-01]` argued, it puts two tiers in one machine,
> which is exactly the property that lets a table resolve a wash by eye.

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
| **Circuit break** | *(replaces Electricity)* **The night is cancelled: nothing reckons.** No washer changes power and every machine keeps its contents. The next day is normal. **REVISED v10 — see below.** |
| **Jimothy** | Jimothy occupies a machine. See below. |
| **Animal control** | Removes Jimothy outright; hostage items return to their owners' hands, unwashed. |

> **RESOLVED v10 — Circuit break cancels the night and nothing else.** Nothing washes that
> night. **No machine's power state changes**, so there is nothing to restore and the next
> day runs exactly as it would have. Contents stay in their machines.
>
> This was arm V1 of a three-way A/B. The alternatives — **V2 "all off"** (every washer
> off, keyholder restores one per day, which is what the card text below still described)
> and **V3 "auto-restore"** (all off, all back at the end of the following day) — are
> deleted from the app.
>
> **The old recommendation was V3 and it should not be re-cited.**
> `sim/out/experiment-A-circuit-break.txt` is void twice over: it had no valid control
> (500 games per cell, one bot policy, no confidence intervals), and it measured the
> deferred event timing that v10 also replaced. Its central subject — whether a Coin can
> undo a Circuit break — is a question about the arm that lost.
>
> **What changed in the card's value:** a Circuit break now costs exactly one night's
> washing, where V2 and V3 cost a night plus a recovery. It is a cheaper card than the
> simulation ever modelled, which makes any prior intuition about Coin and Snacc stale
> rather than merely unmeasured.

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

> **Circuit break** — The power trips. Nothing washes tonight. Every washer keeps whatever is inside it, and tomorrow is normal.

> **Jimothy** — Jimothy settles into a washer. It cannot run and cannot be loaded. Anything inside is stuck with him until he leaves. Only Snacc or Animal Control move him.

> **Animal control** — Jimothy is taken away. Anything stuck with him goes back to its owner's hand, unwashed.
