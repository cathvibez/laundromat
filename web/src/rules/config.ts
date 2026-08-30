/**
 * THE config object.  Every rule the designer has not committed to lives here and
 * nowhere else.  Nothing in src/rules/ may hardcode any of these values.
 */

import type { EventName, LaundromatConfig, SpecialName } from './types';
import { FIXED_EVENT_DECK } from './types';

/** Machine count = P + 1. */
export const MACHINES_BY_PLAYERS: Readonly<Record<number, number>> = {
  3: 4,
  4: 5,
  5: 6,
  6: 7,
};

/**
 * ============================ PLACEHOLDER ============================
 * SPECIAL ITEM DECK COMPOSITION IS UNRESOLVED.  Brief v8 section 6 marks the
 * copy counts as P0 and rules-v0.4 section 2.5 declines to propose any.
 *
 * The ONLY hard constraint is from manufacturing (design/publishing-research.md
 * line 187): the deck must be EXACTLY 20 cards across the seven special items.
 *
 * The split below is FLAT AND DELIBERATELY ARBITRARY.  It is not a
 * recommendation, it has not been simulated, and no conclusion about card
 * balance drawn from playing this deck is worth anything.  The simulation
 * sweep (rules-v0.4 section 9.3) decides this.
 * =====================================================================
 */
export const PLACEHOLDER_SPECIAL_DECK: Readonly<Record<SpecialName, number>> = {
  Coloring: 3,
  'Color catcher': 3,
  Bleach: 3,
  'Wash net': 3,
  Snacc: 3,
  Sanitizer: 3,
  Coin: 2,
};

/** Manufacturing constraint.  Asserted at setup; see assertDeckSize(). */
/**
 * Washer capacity, REVISED v11 — it scales with the table instead of being a flat 4.
 *
 * It happens to equal the washer count at every player count, but that is a
 * coincidence of these four numbers and not a rule; keep the two tables separate so
 * nobody derives one from the other and is surprised when they diverge.
 *
 * Consequence worth watching: at six players a washer holds seven items while
 * `crowdThreshold` stays at three, so crowding — which fired in about one reckoning
 * in a hundred — gets substantially more likely at the big end of the table.
 */
export const CAPACITY_BY_PLAYERS: Readonly<Record<number, number>> = {
  3: 4,
  4: 5,
  5: 6,
  6: 7,
};

/**
 * How many items each player must wash, REVISED v11.  Was a flat 10.
 *
 * The big tables drop to eight.  More players means more contention for every
 * washer, so ten each would make a six-player game drag rather than make it harder.
 */
export const MUST_WASH_BY_PLAYERS: Readonly<Record<number, number>> = {
  3: 10,
  4: 10,
  5: 8,
  6: 8,
};

export const SPECIAL_DECK_TOTAL = 20;

export const SPECIAL_DECK_IS_PROVISIONAL = true;

/*
 * The circuit-break and event-timing A/B tables used to live here. Both closed
 * in v10 and their arms are deleted, not defaulted — see the note in types.ts.
 * Circuit break is "the night is cancelled, power untouched"; every event
 * resolves the moment it is drawn.
 */

export function defaultConfig(
  players: number,
  overrides: Partial<LaundromatConfig> = {},
): LaundromatConfig {
  const machines = MACHINES_BY_PLAYERS[players];
  if (machines === undefined) {
    throw new Error(`Laundromat supports 3-6 players, got ${players}`);
  }
  const cfg: LaundromatConfig = {
    players,
    machines,
    capacity: CAPACITY_BY_PLAYERS[players],
    handSize: MUST_WASH_BY_PLAYERS[players],
    crowdThreshold: 3, // >= N of a garment type sends them all back [A-22]

    turnOrder: 'cardLoadExtra', // designer-confirmed: card -> load -> extra [A-W03]

    specialDeck: { ...PLACEHOLDER_SPECIAL_DECK },
    eventDeck: { ...FIXED_EVENT_DECK } as Record<EventName, number>,

    /**
     * RESOLVED v9, no longer provisional and no longer an experiment.
     *
     * The roll phase begins with whoever holds the key and proceeds around the
     * table, so the player immediately before the keyholder -- yesterday's
     * keyholder -- acts last. The key passes every night, so acting order
     * rotates with it. On day 2 the second player rolls and loads first, the
     * first player acts last, and the second player also takes the key phase.
     *
     * This supersedes [A-W01]'s fixed seat order. It closes the seat-1 win-rate
     * skew the simulation measured (38.4% at three players against a 33.3% fair
     * share) and is the mitigation experiment B recommends pairing with E1.
     *
     * The false path is retained for ablation only and is not offered in the UI.
     */
    keyholderFirst: true,
    bleachKillsDark: false, // rules-v0.2 [OQ-05] alternative reading
    // RESOLVED v10: socks beside a blanket do not wash and stay in the machine.
    socksBlanketExtraWash: true,
    // Designer revision. 'v8net' restores brief v8's Wash net exactly.
    meshBagRule: 'guaranteed',
    // Designer revision. false restores brief v8's machine-wide shade ladder.
    ownItemsDontTaint: true,

    dayCap: 400,
    ...overrides,
  };
  return cfg;
}

export function assertDeckSize(cfg: LaundromatConfig): void {
  const total = Object.values(cfg.specialDeck).reduce((a, b) => a + b, 0);
  if (total !== SPECIAL_DECK_TOTAL) {
    throw new Error(
      `Special item deck must be exactly ${SPECIAL_DECK_TOTAL} cards ` +
        `(manufacturing constraint, publishing-research.md:187); got ${total}.`,
    );
  }
  const events = Object.values(cfg.eventDeck).reduce((a, b) => a + b, 0);
  if (events !== 4) {
    throw new Error(`Event deck is fixed at exactly 4 cards; got ${events}.`);
  }
}
