# Laundromat — Design Brief v8

Ground truth for all design work. Supersedes v0–v7.
**Status: physically playtested many times with paper cards. The core loop is confirmed fun.**

**OPEN** = unresolved. Propose a default and flag it; do not invent silently.

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

   **Order within your turn — RESOLVED v8:**
   1. Roll the die.
   2. **Play a special item card** (optional, at most one, never one drawn today).
   3. **Load** exactly the number rolled.
   4. **Resolve the die's extra effect** — move a garment (4), draw two keep one (5),
      or reveal an event (6).

   Card play precedes loading. This is the only order under which *Wash net* functions as
   written, since it protects underwear "loaded on the same turn the net is played" — the
   net must be down before the underwear goes in.

   **Drawing a special item: draw two, keep one**, and return the other to the bottom of
   the deck.

   **Cards cannot be played on the day they are drawn.** A drawn card enters a face-up
   **fresh** zone and is promoted to the **ready** hand at end of day.

2. **Event resolution** — the revealed event card, if any, resolves. After every player has
   taken their turn and **immediately before** the keyholder acts.
3. **Key phase** — the keyholder may turn one machine on, turn one machine off, or pass.
4. **Reckoning** — each ON machine resolves.
5. **End of day** — fresh cards promote to ready; the key passes to the next player.

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

### Socks and blankets — NEW v8

**Socks may share a machine with a blanket.** Socks may be loaded into a machine already
holding a blanket, and a blanket may be added to a machine already holding socks. This is
the only exception to blanket exclusivity.

**Socks washed alongside a blanket require one additional wash.** After the blanket washes,
those socks are not yet clean — they need one more wash to finish.

Sent-back items return **straight to the owner's hand with no penalty.**

**Invariant:** every ON machine is empty after reckoning.

---

## 6. Special Item Deck — REVISED v8

Drawn **two, keep one** on a roll of 5. Played from hand on your own turn, at most one per
turn, never the day it was drawn. **After being played, shuffled back into its deck.**

| Card | Effect |
|---|---|
| **Coloring** | The owner ruins every other color in the same machine. |
| **Color catcher** | Mitigates *Coloring* for the color catcher's owner. |
| **Bleach** | Reverses dark/light roles — light washes, dark is sent back. |
| **Wash net** | Owner may wash their underwear even among other garment types. **Only underwear loaded on the same turn the net is played may go in — never underwear already sitting in the machine.** |
| **Snacc** | Lures Jimothy to another machine of the player's choice. |
| **Sanitizer** | **NEW.** Neutralizes shoe tainting in this machine — shoes no longer dominate. All other rules still apply. |
| **Coin** | **NEW.** A one-time card. Played on your turn as you load, used immediately to turn one machine on or off independently of the keyholder, then shuffled back into the special item deck. |

> **OPEN — Sanitizer scope.** Does it suppress tiers 1–2 so the machine resolves on
> dark/light alone (machine-wide), or does it protect only the player who played it
> (like Color catcher)? Default implemented: **machine-wide**, tiers 1–2 suppressed,
> resolution proceeds at tier 3.

> **RESOLVED v8 — Coin is a one-shot.** Played on the owner's turn as they load, resolved
> immediately, returned to the deck. It is not held or reusable. This avoids creating a
> second key that never rotates.

> **OPEN — P0.** Number of copies of each of the 7 cards. Still unset; the simulation
> should sweep it.

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

> **Circuit break is under A/B test.** Two variants are being simulated:
> **V1 "blackout"** — only that night's reckoning is cancelled; machine power states are
> untouched and everything resumes normally the next day.
> **V2 "all off"** — every washer switches OFF and the keyholder restores one per day
> (the rule as currently written).
> A third arm, **V3 "auto-restore"** (all off, but machines come back on at the end of the
> following day's reckoning), is included as a cheap middle option.

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

> **Bleach** — Play on a machine. This wash runs backwards: light items wash, dark items are sent back.

> **Wash net** — Play on a machine as you load. Underwear you load this turn washes here even among other garments. Underwear already in the machine is not protected.

> **Sanitizer** — Play on a machine. Shoes stop tainting this wash. Every other rule still applies.

> **Coin** — Turn any one machine on or off. You do not need the key.

> **Snacc** — Lure Jimothy to any other machine. Items he leaves behind go back to their owners' hands, unwashed.

### Events

> **Gang** — Pick a washer. The gang hides behind it and shoots it. That washer is out of the game. Leave this card on it. Gang happens only once.

> **Circuit break** — The power trips. Every washer switches off. Machines keep whatever is inside them.

> **Jimothy** — Jimothy settles into a washer. It cannot run and cannot be loaded. Anything inside is stuck with him until he leaves. Only Snacc or Animal Control move him.

> **Animal control** — Jimothy is taken away. Anything stuck with him goes back to its owner's hand, unwashed.
