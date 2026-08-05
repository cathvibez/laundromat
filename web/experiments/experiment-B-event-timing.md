================================================================================
EXPERIMENT B -- EVENT TIMING
================================================================================
Date written  : 2026-08-04
Rules version : brief v8 (design/game-brief.md)
Engine        : web/src/rules/ (TypeScript), oracle sim/rules.py (Python)
Status        : ARMS IMPLEMENTED AND PLAYABLE. NO SIMULATION HAS BEEN RUN.
                Everything below the "Predictions" heading is reasoning, not
                measurement. Do not cite it as a result.
Raised by     : the designer, during hot-seat playtesting of the web prototype.

--------------------------------------------------------------------------------
1. THE QUESTION
--------------------------------------------------------------------------------

When does a drawn event RESOLVE?

State the question precisely, because it is easy to state it wrongly. Brief v8
already settled that the event card is **revealed the instant it is drawn** --
the face-down pending event of rules-v0.3 is gone and is not coming back. So
this experiment is not about hidden information. It is about the gap between
reveal and resolution, and what fits inside that gap.

Under every arm, at most one event happens per day: only the first 6 of the day
draws, and later 6s load only.

--------------------------------------------------------------------------------
2. ARMS
--------------------------------------------------------------------------------

E1  "immediate"   The event fires the moment it is drawn, in the middle of the
                  roll phase. The drawer names Gang's or Jimothy's washer there
                  and then. Players who have not yet taken their turn play into
                  the changed board.

E2  "deferred"    The event is revealed on draw but fires after every player has
                  taken their turn, immediately before the keyholder acts.
                  *** This is brief v8 section 4 as written, and it is what
                  sim/rules.py implements. Every simulation number produced so
                  far assumes E2. ***

E3  "split"       Untargeted events (Circuit break, Animal control) fire on
                  draw. Targeted events (Gang, Jimothy) are deferred to after
                  all loading. A middle option, added because each pure arm has
                  one good half; see section 6.

Selected via cfg.eventTiming = 'E1' | 'E2' | 'E3'.
Playable from the web app's setup screen before starting a game.
Default in the web prototype is currently E1, at the designer's instruction.

--------------------------------------------------------------------------------
3. WHAT ACTUALLY CHANGES, CARD BY CARD
--------------------------------------------------------------------------------

GANG (destroys one washer permanently, contents back to owners' hands)

  E1  The drawer picks from a half-loaded board and therefore chooses with
      partial information. Returned items can be re-loaded the same day by
      players who have not yet acted. Players who have already acted lose their
      loading for the day with no recourse. Everyone acting later faces one
      fewer washer for the rest of the day.
  E2  The drawer sees the entire day's loading and deletes the washer about to
      wash the most. Nobody re-loads. This is a precision strike.

JIMOTHY (occupies a washer: it cannot run, cannot be loaded, contents hostage)

  E1  He blocks a washer for the remainder of today's loading, which is a real
      spatial constraint on the players still to act. He takes hostage only what
      is loaded so far.
  E2  Nobody's loading is affected at all. He takes maximum hostages and freezes
      the fullest machine immediately before it would have run. This is a heist.

CIRCUIT BREAK (every washer off, contents retained)

  E1  Everything switches off mid-day. Later players must still load -- loading
      is mandatory and OFF machines remain loadable -- but they choose WHERE
      knowing nothing will run tonight.
  E2  Identical end state; everyone loaded blind.
  This is the card where the two arms differ least in outcome, and most in the
  availability of a counter (see section 4, argument 1).

ANIMAL CONTROL (removes Jimothy, hostages back to hands unwashed)

  E1  Hostages return mid-day and can be re-loaded today by players yet to act.
      The rescue lands in time to matter.
  E2  Hostages return after all loading, so they sit in hand until tomorrow.

SUMMARY OF THE PATTERN

  E2 roughly doubles the collateral and sharpens the targeting. Occupancy at
  reckoning was measured at roughly 1.3 items per live machine; mid-roll-phase
  it is on the order of half that. So an E2 Gang returns about twice the items
  an E1 Gang does, and an E2 Jimothy takes about twice the hostages -- and picks
  its victim with full information rather than half.

  THAT FACTOR OF TWO IS AN ESTIMATE DERIVED FROM AN EXISTING OCCUPANCY
  MEASUREMENT, NOT A MEASUREMENT OF THIS EXPERIMENT. It is the first thing the
  simulation should check.

--------------------------------------------------------------------------------
4. THE ARGUMENTS THAT MATTER
--------------------------------------------------------------------------------

ARGUMENT 1 -- Only E1 lets counter-cards answer anything. [strongest for E1]

  Special items are played on your own turn, during the roll phase. Under E2
  every event resolves after every turn has been taken, so NO CARD PLAYED THAT
  DAY CAN RESPOND TO IT:
    - a Coin cannot restore a washer after a Circuit break;
    - a Snacc cannot move Jimothy on the day he lands.
  Under E1 any player acting after the drawer can do exactly those things.

  This matters more than it first appears because rules-v0.4 section 8.4 calls
  slow Circuit-break recovery THE most serious balance problem in v8, and
  section 4.4 notes that the one-shot Coin's weakness is partly justified by the
  keyholder being able to overrule it. E1 gives the Coin a real job. E2 leaves
  Snacc and Coin as cards you hold while the thing they counter happens beyond
  your reach.

ARGUMENT 2 -- E1 has a seat-order fairness problem; E2 does not. [strongest for E2]

  Under E1 the event's harm lands unevenly. If Gang fires mid-day, players who
  already acted lose their loading with no recourse, while players who have not
  yet acted get their items back and re-load them. That harm tracks seat
  position, and under fixed seat order ([A-W01], cfg.keyholderFirst = false) it
  is the SAME players every game.

  Mitigation, and it is cheap: set cfg.keyholderFirst = true, so acting order
  rotates daily with the key and the asymmetry averages out across a game. E1
  and keyholder-first should be treated as a package.

  E2 has no such problem: the event lands after everyone has had an identical
  opportunity to load.

ARGUMENT 3 -- E2 buys dread, but only for about half the table.

  The genuinely good thing about E2 is that a revealed event LOOMS. You load
  knowing Jimothy will land somewhere without knowing where; you load knowing
  the power will trip tonight. That is a real decision under uncertainty and E1
  destroys it completely.

  But it only applies to players acting AFTER the drawer, which averages
  (P-1)/2. When the last player rolls the 6, E1 and E2 are literally identical.
  So it is roughly a half-strength effect. The same caveat applies to E1's
  unfairness in argument 2, for exactly the same reason -- both effects are
  scaled by the same expected fraction of the table.

  rules-v0.4 section 3.3 already named and accepted this turn-order information
  asymmetry under E2. E1 converts it from an INFORMATION asymmetry into a
  MATERIAL one, which is a genuine escalation and the honest cost of E1.

ARGUMENT 4 -- E1 is markedly easier at a physical table.

  E1: draw the card, do what it says, done. No held state, nothing to remember.
  E2: leave the card face up, finish the round, and remember to resolve it
  before the keyholder acts.

  "We forgot to resolve the event" is the single most likely procedural error in
  this game, and brief section 9 commits to a hand-resolvable physical version
  with no hidden bookkeeping. This argument is worth more for the paper game
  than for the digital one, where the app simply cannot forget.

ARGUMENT 5 -- E2 rewards skill; E1 blunts take-that.

  Informed targeting is skill expression: "I watched you fill M3 all round and
  then I shot it" is a better story than "I shot a mostly-empty washer." If
  playtests have felt too gentle, E2 is the knob that adds teeth. Conversely the
  comparables review [R-3.3] favours symmetric, non-targeted effects, and E1
  blunts the two sharpest targeted effects in the game by denying the drawer
  information. Which of these is a feature depends on what Laundromat wants to
  be, and that is the designer's call, not the engine's.

--------------------------------------------------------------------------------
5. RECOMMENDATION
--------------------------------------------------------------------------------

E1, paired with cfg.keyholderFirst = true. Confidence: moderate, and explicitly
subject to the measurements in section 7.

Reasoning: argument 1 is concrete and mechanical -- it changes whether two of
the seven special items function at all against the events they exist to
counter. Argument 4 is free. Argument 2 is the only serious cost and rotation
largely neutralises it. Argument 3's loss is real but half-strength.

The honest counter-case: if Laundromat should be a sharp, political,
read-the-table game, E2 is better, and arguments 3 and 5 are the reason. E2 is
also the status quo, is what the brief says, and is what every existing
simulation number assumes -- so it wins any tie by default.

--------------------------------------------------------------------------------
6. ON THE SPLIT ARM (E3)
--------------------------------------------------------------------------------

E3 exists because each pure arm has one good half. Deferring Gang and Jimothy
preserves the dread and the skill expression on the two cards that deserve them,
while firing Circuit break on draw keeps the Coin live against the game's worst
balance problem and lets Animal control's rescue land in time to be used.

Its cost is a card-dependent timing rule -- one more sentence of rules text, and
exactly the kind of exception that trips up a paper game (argument 4). It is
implemented and playable, but it should be treated as a fallback to reach for
only if both pure arms are tried and each is found wanting in the predicted way.

--------------------------------------------------------------------------------
7. WHAT THE SIMULATION SHOULD MEASURE
--------------------------------------------------------------------------------

Design, mirroring experiment A so the two are comparable: common random numbers
(identical seeds across arms), CLUSTERING policy, player counts 3/4/5/6,
machines P+1, capacity 4, 500 games per cell.

PRIMARY
  counter_plays        times a Coin or Snacc is played in RESPONSE to an event
                       the same day. Expected to be ~0 under E2 by construction.
                       This is the metric that settles argument 1 empirically
                       rather than by reasoning, and it requires new telemetry.
  gang_items           items returned by Gang. Tests the "factor of two" claim.
  jimothy_hostage_item_days
                       hostages held. Same test, for the other targeted card.

SECONDARY
  days                 game length. E2 should be slightly longer if it destroys
                       more washes.
  wash_events / (d*P)  throughput per player-day.
  machines_avail_days / d
                       the primary metric of experiment A; check the arms do not
                       interact with the circuit-break arms.
  win rate by seat     THE fairness test for argument 2. Run it twice, once with
                       keyholder_first false and once true. If E1's seat skew is
                       real, it should show here and rotation should remove it.

INTERACTION
  Cross experiment A (circuit break V1/V2/V3) with experiment B (E1/E2/E3). The
  interaction is not hypothetical: E1's whole claim in argument 1 is that a Coin
  can undo a Circuit break, which is a direct interaction with arm V2, where
  recovery is the binding constraint. 9 cells; consider dropping E3 to 6.

--------------------------------------------------------------------------------
8. IMPLEMENTATION AND PARITY NOTE -- IMPORTANT
--------------------------------------------------------------------------------

The web engine (web/src/rules/) implements all three arms and defaults to E1.
sim/rules.py implements E2 ONLY, and has no switch.

So the two implementations currently diverge at the day level whenever the web
app is run on E1 or E3. Consequences, stated plainly:

  - The reckoning parity suite is UNAFFECTED. It tests machineVerdicts(), which
    is a pure function of a machine's contents and attached cards and knows
    nothing about when events fire. All 17,434 fixtures still pass.
  - Day-level behaviour is NOT comparable across the two implementations unless
    the web app is set to E2.
  - Every balance number in sim/out/ assumes E2. If E1 is adopted, those numbers
    describe a game that is no longer the one being played, and the circuit
    break experiment in particular would need re-running, because argument 1 is
    precisely a claim about circuit-break recovery.

REQUIRED FOLLOW-UP IF ANY ARM OTHER THAN E2 IS ADOPTED: port cfg['event_timing']
into sim/rules.py so the simulation can measure the arm actually being played.
That file is owned outside this project directory and has not been touched.

--------------------------------------------------------------------------------
9. STATUS
--------------------------------------------------------------------------------

  [x] Three arms implemented in the web engine
  [x] Selectable from the setup screen before a game starts
  [x] All three arms verified to play through to victory (tests/game/)
  [x] Reckoning parity with the Python oracle unaffected and still green
  [ ] Ported to sim/rules.py
  [ ] Simulated -- NO RUN HAS BEEN PERFORMED
  [ ] Decided by the designer
