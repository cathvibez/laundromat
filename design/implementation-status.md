# Laundromat — Implementation Status

**Three-way divergence register.** Brief `design/game-brief.md` **v10** · oracle
`sim/rules.py` · prototype `web/`.

Written 2026-08-05. Last revised 2026-08-29 for v10, which CLOSED three of the
decisions below (event timing, circuit break, Sanitizer scope) and changed the
damp-socks rule outright. Regenerate this whenever any of the three moves.

The three artefacts do not agree. This file exists so that nobody has to reverse-engineer
how far apart they are, and — more urgently — so that nobody quotes a simulation number at
a game the simulation is no longer describing.

**Verification state of the web app at the time of writing:** `npx tsc --noEmit` clean,
`npm test` **136/136 green** (six suites), `npm run build` clean. Everything recorded below
as "implemented" was read in the source, not inferred from a comment. Where a config flag
and the code it gates disagree, that is called out explicitly.

---

## 1. What simulation results are still valid

### Still valid — trust these

| Result | Why it survives |
|---|---|
| **The reckoning parity suite** (17,434 fixtures: ~60 worked examples, exhaustive enumeration of all 1–3 item machines over a 42-key alphabet, a 5,000-machine random sweep with attached cards). | It tests `machineVerdicts()` / `machine_verdicts` — a **pure function of a machine's contents and attached cards**. It knows nothing about when events fire, who acts first, or how big the deck is. None of the divergences below can reach it. |
| **The parity suite specifically survived the Mesh bag rewrite.** | The new rule is gated behind `cfg.meshBagRule`, and every fixture runs on the `'v8net'` setting, which still behaves as brief v8's Wash net. There is a test (`M12`) pinning that the *default* semantics are the old ones. This is why a rules change did not cost us the oracle. |
| **Component constants** — taxonomy, machines-per-player, capacity, hand size, crowd threshold, dice table, event deck. | Checked against the oracle and unchanged in v9. |
| **`realized L` correlates −0.90 with game length**, and the capacity-contention data. | Behavioural relationships independent of every rule that has changed. |
| **Crowding fires 0.0–1.1% of reckonings**, directionally. | Capacity and type counts are untouched. |

### No longer valid — do not cite

| Result | Why it is void |
|---|---|
| **Every day-level number in `sim/out/`.** | They all assume event timing **E2**. The app defaults to **E1**, under which events fire mid-turn. Gang returns roughly half as many items, Jimothy takes roughly half as many hostages, and — the point of the change — a Coin or Snacc played later the same day can *answer* the event. That is a different game at the day level. |
| **`experiment-A-circuit-break.txt` in particular.** | Its whole subject is circuit-break recovery, and E1's central claim is that a Coin can undo a Circuit break. The experiment measured a world where that is impossible by construction. It must be re-run under whichever event-timing arm is adopted. |
| **Anything involving special-item frequency, value or draw rates.** | The simulation runs a **14-card** deck (2 of each). The app runs **20** (manufacturing constraint). Per-card draw probability differs by ~30%, and the deck now contains a card (the Mesh bag) whose power the simulation does not model at all. |
| **Any judgement about the Wash net / Mesh bag's value.** | Two different cards with the same internal id. `net_saved` in the simulation counts a rule that no longer exists in the app. |
| **`experiment-B-event-timing.md`'s numbers.** | There are none. **No simulation has been run.** Everything below its "Predictions" heading is reasoning. The "factor of two" is extrapolated from an old occupancy measurement, not measured. |

### Prerequisite before any of it can be trusted again

`sim/rules.py` needs **six** ports, in this order of impact: **event timing** (now fixed
at resolve-on-draw, not an arm), the **new damp-socks rule** (the first port that changes
item flow rather than verdicts — a machine is no longer empty after a reckoning), the
**Mesh bag** rule, **"own items don't taint own items"**, the **20-card deck constraint**,
and **keyholder-first acting order**. Until then the simulation and the prototype are not even the same
*reckoning* — the own-items rule changes verdicts — let alone the same *game*.

> **Note added 2026-08-06.** The own-items rule is the one that hurts. Every fixture in the parity
> suite runs with `ownItemsDontTaint: false`, so parity is still honest about what it tests, but it
> now tests **brief v8's reckoning, which is not the reckoning the app plays.** Porting it into the
> oracle and regenerating the fixtures should happen in one change.

---

## 2. Divergence register

Legend: **=** agrees · **≠** diverges · **—** not modelled.

| Rule | Brief v9 | `sim/rules.py` | web app | Canonical? | Notes |
|---|---|---|---|---|---|
| **Event timing** | **RESOLVED v10: every event resolves on draw. No arms.** | **E2 only. No switch.** | Resolves on draw, always; E2/E3 and `cfg.eventTiming` deleted | **brief + web** | **CLOSED 2026-08-29.** The drawer picks the washer for Gang and Jimothy, which every arm always did. The oracle is still E2, so every day-level number it produces still describes a different game — this row stops being a fork and becomes a straight **port owed**. |
| **Mesh bag** (internal id `Wash net`) | New v9 text: everything you load that turn washes, any type | **v8 Wash net: same-turn underwear only, waives underwear isolation only** | Both. `cfg.meshBagRule = 'guaranteed'` is the default; `'v8net'` restores v8 exactly | **web** | Verified in `reckoning.ts:133-152` and `phases.ts:loadItem`. A bagged item's verdict is unconditionally `true`. Bag membership set at load time, per-item; items already in the machine excluded. |
| — *card display name* | "Mesh bag" | **"Wash net"** | id `'Wash net'`, displayed "Mesh bag" via `SPECIAL_DISPLAY` | **web** | Deliberate: keeps the deck vocabulary matching the oracle so the constants parity check stays honest. **Rename both sides together, or not at all.** Easy to trip over — the two implementations disagree on the card's *name* as well as its *effect*. |
| — *do bagged items still set the tier / count for crowding?* | OPEN, currently yes | n/a | **Yes** — the bag protects its contents, it does not remove them from the wash | **OPEN** | Tests `M3`, `M7` pin the current behaviour. Alternative: lift bagged items out of consideration entirely. Not ruled on. |
| — *does a Mesh bag save socks from a blanket?* | **No (v10, by construction)** | n/a | **No** — the bag decides the verdict; being stranded happens after it | settled by the v10 rule | Was OPEN as "are bagged socks still damp". The new rule makes it structural rather than a judgement call: the bag guarantees a *verdict*, and stranding is not a verdict. |
| **Circuit break** | **RESOLVED v10: the night is cancelled, power untouched. No arms.** | **V2** | Cancels the night only; V2/V3 and `cfg.circuitBreak` deleted | **brief + web** | **CLOSED 2026-08-29** in favour of what was arm V1. `sim/out/experiment-A-circuit-break.txt` recommended V3, but it is void twice over: an invalid V0 control, and it measured E2. Do not re-cite it. |
| **Special deck size** | OPEN (P0); records the 20-card manufacturing constraint | **14 cards** (2 of each); no constraint | **20 cards**, flat 3/3/3/3/3/3/2, **asserted at setup** (`assertDeckSize`) | **web** for the total, **nobody** for the split | The 20-card constraint comes from `publishing-research.md:187` and is real. The split is explicitly labelled arbitrary in `config.ts` and is not a recommendation. **OPEN (P0).** |
| **Turn order within a turn** | roll → card → load → extra | roll → card → load → extra `[A-W03]` | roll → card → load → extra (`cfg.turnOrder = 'cardLoadExtra'`) | **all three agree** | Included because it was contested: **`rules-v0.4.md §3.1` still says roll → extra → load → card** and is stale. The app keeps that reading as a dead ablation switch. |
| **Acting order** | **RESOLVED v9 §4: keyholder acts first, always. No longer a switch.** | `keyholder_first = False` | **`keyholderFirst = true`** | **brief + web** | **Corrected 2026-08-06** — this row previously recorded all three as fixed seat order and marked it OPEN. Verified in `config.ts:119` (`keyholderFirst: true`, commented "RESOLVED v9") and `setup.ts:actingOrder`. This is the mitigation `experiment-B` recommends pairing with E1, so the app is **no longer** shipping the unmitigated combination. `sim/rules.py` is now the only artefact on fixed seat order and needs the port. `web/README.md`'s config table was stale on this and has been corrected. |
| **Damp socks** | **REVISED v10: socks beside a blanket do not wash and STAY IN THE MACHINE.** | `wash_count` int on the item, kept in `hand` | Socks that pass the verdict beside a blanket stay in `m.items`; no damp zone, no `Item.damp`, no `PlayerState.damp` | **web** | **The newest divergence, and the first that changes ITEM FLOW rather than verdicts.** A machine is no longer empty after a reckoning. Verified in `phases.ts:phaseReckon` (`m.items = stuck`). Damp is now derived by `selectors.willBeDamp()` — socks in a machine containing a blanket — and stored nowhere. |
| **Card sort order** | Documented in v9 §1 | — | `selectors.ts:sortRank` + `SORT_EXPLAINER`, used by the hand/damp/clean zones | **web** | Was documented *nowhere but the code* until v9. dark shoes → light shoes → dark clothing+blanket → light clothing+blanket → dark underwear → light underwear. Cosmetic, but should match on printed cards. |
| **Sanitizer scope** | **RESOLVED v10: machine-wide, always.** | `sanitizer_owner_only = False` (still switchable) | `LaundromatConfig.sanitizerOwnerOnly` deleted; the game always passes `false` | agrees | **CLOSED 2026-08-29**, as `rules-v0.4 [OQ-01]` argued. NOTE: `ReckoningOpts.sanitizerOwnerOnly` and the owner-only branch in `reckoning.ts` SURVIVE deliberately — 733 parity fixtures set the flag and the oracle implements it, so deleting the branch would cost coverage or force an oracle edit. Unreachable from play, exercised by parity. |
| **Coin** | One-shot, resolved immediately, returns to deck | one-shot `[A-W06]` | one-shot (`applySpecial`, `IMMEDIATE` set) | agrees | RESOLVED v8, no drift. |
| **Gang on Jimothy's machine** | Machine destroyed, hostages released, Jimothy relocates; drawer picks both | `[A-W07]` same | `resolveGang` same | agrees | RESOLVED v8, no drift. |
| **Socks/blanket keying** | Keys on the machine *containing* a blanket | same `[A-W12]` | same, `phaseReckon` S8, `cfg.socksBlanketExtraWash` | agrees on the KEY, diverges on the EFFECT | The trigger is unchanged and still keys on contents rather than the blanket's verdict, which is what preserves commutativity. What the trigger now *does* is the row above. |
| **Mandatory loading when nothing is placeable** | "load fewer only if their hand holds fewer" | loads as many as it can, silently | **stays on the load stage and makes the player skip explicitly** (`loadBlocked` / `skipBlockedLoad`) | **web** (UX only) | Same outcome, different presentation. The app refuses to move on silently because the situation is confusing. No rules impact. |
| **Blanket + socks placement** | Blanket alone except socks | `[A-W11]` same | `placement.ts:refusalReason`, both directions | agrees | No drift. |
| **Victory** | First to wash all 10, immediate, simultaneous allowed | `[A-W14]` same | `phaseEndOfDay`, checked after the full reckoning | agrees | No drift. |
| **Crowding threshold** | ≥3 of a garment type | `crowd_threshold = 3` | `crowdThreshold = 3` | agrees | **OPEN by value, not by divergence:** it fires in ~0–1% of reckonings. Whether it earns its rules text is unresolved. |

---

## 3. Implementation notes worth knowing

These are not divergences. They are things that will confuse the next person.

- **The Mesh bag's purity is preserved.** A bagged item's verdict does not depend on any
  other item's verdict, so the filter chain still commutes and item order still cannot
  matter. There is a permutation test (`M9`). This was the constraint the implementation
  was designed around and it held.
- **`meshBag` is absent from the verdict memo key** (`reckoning.ts:memoKey`). It is
  currently unreachable as a bug, because the `'guaranteed'` path clears `netKeys` before
  calling `core()`, so the two modes cannot produce colliding keys. It is fragile rather
  than wrong. Worth a defensive fix if that path is ever touched.
- **`sanitizerOwnerOnly` short-circuits before the Mesh bag branch** (`reckoning.ts:124`),
  so with both set, bagged items get no protection. **v10 made this unreachable from play
  rather than fixing it**: there is no config field any longer and the game always passes
  `false`. The hole still exists for a direct `machineVerdicts` caller that sets the opt,
  which is exactly what the parity fixtures do — harmless, because the oracle has the same
  behaviour, which is the point of comparing them.
- **`sim/rules.py` must not be edited to chase the app.** It is the oracle; the parity suite
  is only meaningful because it is independent. Port rules into it deliberately, with the
  fixtures regenerated in the same change.
- **There is no seed-for-seed parity of whole games** between the two implementations and
  there cannot be — different RNG streams. They are the same rules, not the same game
  generator.

---

## 4. Decisions the designer needs to make

Ordered by how much downstream work each one unblocks.

1. ~~**Event timing arm — E1, E2 or E3.**~~ **CLOSED v10 (2026-08-29):** every event
   resolves on draw; the arms are deleted. This does NOT un-void the simulation numbers —
   the oracle is still E2, so the port is still owed and every day-level figure still
   describes a different game. It was closed by instruction, unmeasured.
2. **Mesh bag — keep, weaken, or revert to v8's Wash net.** It is judged the strongest card
   in the game and the deck sweep cannot be meaningfully run around a card whose power is
   unsettled. Includes the two sub-questions: do bagged items still set the tier for
   everyone else, and do bagged socks beside a blanket still come out damp.
3. ~~**Circuit break arm — V1, V2 or V3.**~~ **CLOSED v10 (2026-08-29):** the night is
   cancelled and no washer changes power. This unblocks the deck sweep, which was waiting
   on blackout frequency to price Coin and Snacc — but note the new rule makes a Circuit
   break *cheaper* than V2 or V3 did, so any prior intuition about Coin's value is stale
   rather than merely unmeasured.
4. **Special item deck composition (P0).** Exactly 20 cards, split unset. Blocked behind
   decisions 2 and 3. This is the last big balance lever.
5. ~~**Acting order — fixed seat or keyholder-first.**~~ **CLOSED** (brief v9 §4, and the app now
   ships it). Keyholder-first is permanent and is no longer a design decision. What remains is a
   **port**: `sim/rules.py` still runs `keyholder_first = False`, so any fairness or seat-order
   number it produces describes a game nobody plays.
6. **Does the crowding rule earn its complexity?** It fires in ~0–1% of reckonings. Removing
   it simplifies the reckoning; keeping it costs a paragraph of rules text. Low urgency,
   trivially reversible.
7. **"Own items don't taint own items." — NO LONGER HYPOTHETICAL. Corrected 2026-08-06.**
   This entry used to read "never ruled on; should be costed before it is considered." It has
   since been **built and turned on by default**: `config.ts` ships `ownItemsDontTaint: true`,
   `reckoning.ts:176-186` implements it, and `tests/ported/ownTaint.test.ts` pins 21 cases.
   Every item is judged against the machine minus its owner's other items, and among your own
   items a shade-blind ladder applies: shoes > clothing and blanket > underwear.
   **The cost was paid, not avoided.** Purity survived — verdicts still never read another
   item's verdict, and the permutation test (`O20`) passes — but **a machine no longer resolves
   at a single tier**, which is the property `rules-v0.4 §6.10` called load-bearing for
   resolving the reckoning by eye at a table. Two side effects nobody has signed off on: your
   own copies no longer crowd you (`O17`), and underwear isolation now only bites across
   players.
   **What is actually outstanding is documentation, not code:** brief v9 does not mention this
   rule at all, and it is the central mechanic of the rulebook in `design/strings/`. Promote it
   into the brief (v10) or rule it out.
8. ~~**Sanitizer scope.**~~ **CLOSED v10 (2026-08-29):** machine-wide, always. The config
   field is gone. The owner-only code path stays in `reckoning.ts` for the parity fixtures
   only — see the register row.

9. **NEW — does a machine ever silt up?** Stranded socks are the first mechanic that can
   hold an item in a machine indefinitely: a player who keeps loading blankets into the
   same washer keeps someone else's socks hostage there. 200 bot games across 3–6 players
   terminate well inside the day cap, so it is not a livelock, but nobody has judged
   whether it is a good *play* pattern. Watch it at the table before the deck sweep.
