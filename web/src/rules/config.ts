/**
 * THE config object.  Every rule the designer has not committed to lives here and
 * nowhere else.  Nothing in src/rules/ may hardcode any of these values.
 */

import type {
  CircuitBreakArm,
  EventName,
  LaundromatConfig,
  SpecialName,
} from './types';
import { FIXED_EVENT_DECK } from './types';

/** Brief v8 section 1: machine count = P + 1, capacity flat 4. */
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
export const SPECIAL_DECK_TOTAL = 20;

export const SPECIAL_DECK_IS_PROVISIONAL = true;

/**
 * Circuit break A/B arms.  The designer has not committed.
 *   V1 "blackout"      only tonight's reckoning is cancelled; power untouched.
 *   V2 "all off"       every live washer OFF, keyholder restores one per day.
 *                      This is what brief v8 currently says.
 *   V3 "auto-restore"  every live washer OFF, all back ON at the end of the
 *                      FOLLOWING day's reckoning.
 *                      This is what sim/out/experiment-A-circuit-break.txt
 *                      recommends, and is the default here.
 * Contents are retained in every arm.
 */
export const CIRCUIT_BREAK_ARMS: Readonly<Record<CircuitBreakArm, string>> = {
  V1: 'Blackout - only tonight’s reckoning is cancelled. Power is untouched.',
  V2: 'All off - every washer switches off. The keyholder restores one per day. (Brief as written.)',
  V3: 'Auto-restore - every washer switches off, all return at the end of the following day. (Experiment recommendation.)',
};

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
    capacity: 4,
    handSize: 10,
    crowdThreshold: 3, // >= N of a garment type sends them all back [A-22]

    circuitBreak: 'V3',
    turnOrder: 'cardLoadExtra', // designer-confirmed: card -> load -> extra [A-W03]

    specialDeck: { ...PLACEHOLDER_SPECIAL_DECK },
    eventDeck: { ...FIXED_EVENT_DECK } as Record<EventName, number>,

    keyholderFirst: false, // [A-W01] fixed seat order; the key rotates independently
    sanitizerOwnerOnly: false, // [A-W05] default is machine-wide
    bleachKillsDark: false, // rules-v0.2 [OQ-05] alternative reading
    socksBlanketExtraWash: true, // v8 core rule; switch exists for ablation
    publicDampZone: true, // [A-28]

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
