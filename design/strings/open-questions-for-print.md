# Open Questions for Print

Every place where the card text or the rulebook had to be written around a rule that is not
settled. **Nothing in this list may go to print as it stands.** Ordered by how much text each one
changes.

Sources: `design/game-brief.md` v10, `design/implementation-status.md`, `design/rules-v0.4.md`,
`design/publishing-research.md` §6, and `web/src/rules/`.

**Seven of the twelve are closed.** Items 7, 9(b), 11 and 12 were documentation errors and
staleness rather than open design questions, and were **fixed in place**. Items **2, 3 and 8** were
real design questions and were **decided in v10 (2026-08-29)** — event timing, Circuit break, and
whether damp socks need a component (they do not; there is nothing left to mark). Item 5 lost one
of its three sub-questions to the same change. All are left in the list rather than deleted so the
record survives. **Items 1, 4, 5, 6 and 10 still need a decision from the designer.**

---

## 1. The game's name — decide first

"Laundromat" is used throughout both deliverables as a placeholder.

`publishing-research.md` §6 recommends renaming, on three grounds: the word is a genericized former
trademark and almost certainly **unregistrable** for a board game about a laundromat; there is
**already a published game called *Laundromat*** on BGG (#153641), plus *Goblin Laundromat*; and the
search position is unwinnable. Its leading concrete suggestion is *Jimothy's Laundromat*.

**What changes when it is decided:** the rulebook title, the running header, every place the word
appears in prose (three), and every asset outside these files. **Rename before any art or layout
money is spent.**

---

## 2. Event timing — ✅ RESOLVED v10 (2026-08-29)

**An event resolves the moment its card is drawn**, mid-turn, and the drawer names the washer for
the Gang and for Jimothy. This was arm E1; E2 (deferred until everyone had loaded) and E3 (split)
are deleted from the app.

The case that won: it is the only reading under which a special item can answer an event at all.
Under the deferred arms no Coin could restore power after a Circuit break and no Snacc could move
Jimothy on the day he landed — two cards dead against the events they most obviously address.

The known cost is a seat-order asymmetry: players who have already acted lose their loading with
no recourse. The mitigation, **keyholder-first acting order**, is a settled rule and is what the
app ships, so the unmitigated pairing is not what anybody plays.

**Nothing here was simulated.** `sim/rules.py` still implements the deferred arm only, so every
day-level figure in `sim/out/` still describes a different game.

**What this unblocks for print:** `rulebook.md` §4.3 and §4's day sequence are now final.

---

## 3. Circuit break — ✅ RESOLVED v10 (2026-08-29)

**The night is cancelled and nothing else happens.** No washer changes power, every washer keeps
its contents, and the following night runs exactly as it would have. This was arm V1; V2 (all off,
keyholder restores one per day — which was the printed card text) and V3 (all off, all back at the
end of the following day) are deleted.

**The old recommendation was V3 and must not be re-cited.**
`sim/out/experiment-A-circuit-break.txt` is void twice over: no valid control, and it measured the
event timing that v10 also replaced. Its central subject — whether a Coin can undo a Circuit
break — is a question about an arm that lost.

**A Circuit break is now a cheaper card than anything the simulation modelled**: one night's
washing, with no recovery to manage. Any prior intuition about what that makes Coin and Snacc
worth is stale rather than merely unmeasured.

**What this unblocks for print:** the card face in `card-text.md` is final, and `rulebook.md` §9
no longer carries three variants.

---

## 4. Special item deck composition (P0)

Exactly **20 cards** across the seven specials — a real manufacturing constraint
(`publishing-research.md` §1.4: 84 item + 4 event = 88 fixed, 108 is the sheet-efficient total).
The split is **unset**. The app ships a flat 3/3/3/3/3/3/2 that `config.ts` labels arbitrary and
explicitly not a recommendation. The simulation still runs 14 cards, 2 of each.

**Written around it by:** `card-text.md` §1 states the total and marks the split unresolved. No
count appears on any card.

Blocked behind §3 (blackout frequency sets the value of Coin and Snacc) and §5 (the Mesh bag cannot
be swept as one card among seven while its power is unsettled).

---

## 5. The Mesh bag — keep, weaken, or revert

The brief itself carries a balance flag: the Mesh bag is judged **comfortably the strongest card in
the game**, guaranteeing up to three washes per play against a baseline of ~1.5 loads per
player-day, with no counterplay. The precedent named in the brief is the Handwash basket, deleted in
v8 for exactly this failure mode at *one* item per play.

Three separate decisions:

- **(a) Keep it, weaken it, or revert to v8's Wash net?** Revert text is written and intact in
  `card-text.md`.
- **(b) Do bagged items still set the ladder and count for crowding for everyone else?** Currently
  **yes**. Alternative: lift them out of consideration entirely.
- ~~**(c) Do bagged socks beside a blanket still come out damp?**~~ **Closed by v10**, and
  structurally rather than by ruling: the bag guarantees a *verdict*, and a blanket stranding socks
  happens after the verdict, to items that passed it. Bagged socks stay in the washer like any others.

**Written around it by:** `card-text.md` Mesh bag entry (all three flagged); `rulebook.md` §6.4 line
7, §8, and worked examples 11 and 12 in §13.

---

## 6. "Mesh bag" versus "Wash net" — the name is split across the codebases

The card's internal id in both the app and the simulation is `Wash net`; only the app's *display*
name is "Mesh bag". This was deliberate, to keep the constants parity check honest — but it means
the two implementations now disagree about the card's **name** as well as its **effect**.

**Decision:** confirm "Mesh bag" is the printed name, then rename both sides together or not at all.
Until then, anyone reading `sim/rules.py` will see a different card. Both deliverables print **Mesh
bag** and say so.

---

## 7. Bleach's card text — ✅ FIXED 2026-08-06, confirm the wording

Brief v9 §6 and §11 described Bleach as *"light items wash, dark items are sent back."* The rule as
specified in `rules-v0.4` §6.8 and implemented in `reckoning.ts` step S1 is a **shade swap before
the ladder is read**, which is not the same thing whenever shoes are in the washer: bleached dark
shoes read as *light shoes*, and still wash (worked example 12). The brief's shorthand gave the
wrong answer on a board that comes up often.

**Both places in `game-brief.md` have been corrected**, with a note recording that the description
was wrong and the rule was not. `card-text.md` prints the swap wording. **Nothing to decide except
whether you like the sentence.**

---

## 8. Damp socks have no component — ✅ CLOSED v10 (2026-08-29), none needed

The question was which component marks a damp sock. **There is nothing to mark.**

v10 changed the rule: socks in a washer with a blanket simply do not wash, and they stay in that
washer. Damp stopped being a lasting property that travels with a sock and became a fact about a
situation — these socks, in this washer, with that blanket — which is readable straight off the
board by anybody at the table.

The old worry is gone with it. It was that "a damp sock in a washer is indistinguishable from a
dry one, and that is exactly when it matters"; under the new rule a sock in a washer holding a
blanket *is* the damp case, and there is no other kind.

**Consequences:** no punchboard token, no player mat, no damp zone at all. `rulebook.md` §2 loses
the `Damp markers | ?` row, and the manifest in `publishing-research.md` needs nothing added.

---

## 9. Two smaller gaps the rulebook could not close

**(a) How the first keyholder is chosen.** Nothing in the design says. `rulebook.md` §3 step 5
carries a flag and no invented rule. One line of text is needed.

**(b) Acting order — ✅ FIXED 2026-08-06. Nothing to decide.** Brief v9 §4 says keyholder-first is
**RESOLVED and no longer a switch**, and `web/src/rules/config.ts` ships `keyholderFirst: true`. The
three documents that still said otherwise were stale, not the code: `implementation-status.md`'s
divergence row and decision 5, `rules-v0.4.md`'s superseded-banner line, and `web/README.md`'s
config table have all been corrected. The rulebook is written keyholder-first. The one real
remaining item is a **port**: `sim/rules.py` still runs fixed seat order, so its fairness numbers
describe a game nobody plays.

---

## 10. Crowding — does the rule survive at all?

It fires in roughly 0–1% of reckonings. `rules-v0.4` §8.7 questions whether it earns its rules text;
`implementation-status.md` lists it as open by value rather than by divergence.

**If it is cut, delete:** `rulebook.md` §6.3 crowding paragraph, §6.4 line 5, §13 worked examples 5
and 6, the crowding row of the §15 quick reference, and the glossary entry. Nothing on any card
changes.

Note that the own-items rule (§11) has already changed what crowding does — your own copies no
longer crowd you — which makes it rarer still.

---

## 11. "Own items don't taint own items" is in the code and not in the brief

**The largest documentation gap found — a status problem rather than a design question.**
**Partly fixed 2026-08-06:** the stale entry in `implementation-status.md` (which still described
this as an unmade decision) has been corrected to describe what actually ships, including the two
side effects below and the fact that the parity fixtures no longer test the reckoning the app plays.
**The brief has not been touched — promoting this rule into it is a designer's call, not an
editor's, and it remains the one outstanding item here.**

The rule is live and on by default in the app (`config.ts: ownItemsDontTaint: true`), fully tested
(`web/tests/ported/ownTaint.test.ts`, 21 cases), and is the rule both deliverables are written
around. But **brief v9 does not contain it**, and `implementation-status.md` §4 item 7 still lists
it as "proposed by the designer… never ruled on… should be costed before it is considered."

Two consequences a reader should sign off on explicitly, because neither is stated anywhere as an
intention:

- **A washer no longer resolves at a single tier.** Each owner can be on a different rung at once.
  `rules-v0.4` §6.10 rejected exactly this shape when it was proposed for Sanitizer, on the grounds
  that it stops the reckoning being resolvable by eye at a table. The rulebook's §6.4 checklist is
  the mitigation; it needs testing on a real table with real strangers.
- **Underwear isolation and crowding are now partly redundant.** Your own clothing already outranks
  your own underwear on the category ladder, so isolation only bites across players; your own copies
  no longer crowd you. Both rules still do work, but less of it than the brief implies.

**Action:** promote the rule into the brief (it should be v10), or rule it out. The rulebook cannot
be finalised while its central mechanic is absent from the ground-truth document.

---

## 12. Two errors in `rules-v0.4.md` — ✅ BOTH FIXED 2026-08-06

Found while mining that document's worked examples. Both are now corrected in place, with a
**corrections log** added at the head of the file distinguishing "this was wrong" from "this was
overtaken by v9". Neither affects any card or any rule — only the documentation of rules that were
already implemented correctly.

- **Table A row 14 was wrong.** It claimed a washer holding A's dark shoes, B's light shirt and C's
  light hat with a Sanitizer resolved at **tier 4** with the shoes sent back. Sanitizer suppresses
  the two *shoe* rungs only; a dark shoe is still a dark item, so that board resolves at tier 3 and
  **the shoes wash alone** — contradicting §6.10 of the same document ("a dark shoe washes with the
  dark items") and row 13 beside it. Verified by running `machineVerdicts` on the board. No test or
  parity fixture asserted the old value, so nothing else was affected.
  **Replaced** with `A-L-shoes` + `B-D-shirt` + `[Sanitizer:A]` → the dark shirt washes and A's own
  light shoes go back, which does support the row's point that Sanitizer can hurt the player who
  played it. Verified the same way.
- **The turn order was wrong in three places** — §3.1's numbered turn, §3.2's state-transition table
  rows 1–4, and §4.3's [A-03]. All had roll → extra → load → card. The settled order is **roll →
  card → load → extra** (brief v9 §4; `sim/rules.py` [A-W03]; `config.ts: turnOrder:
  'cardLoadExtra'`). All four sites are corrected, [OQ-09] is marked closed *against* this
  document's own recommendation with the reasoning recorded, and the sign-off table row is updated.
  The consequence worth knowing: **a roll of 4 can no longer free a slot for your own load**, since
  the move happens after you load. The rulebook (§4.3) says so.
