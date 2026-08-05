/**
 * Laundromat -- core vocabulary.  BRIEF v8.
 *
 * This file, and everything else in src/rules/, is a pure TypeScript port of
 * sim/rules.py (the tested Python oracle).  Nothing here may import boardgame.io
 * or React: the parity suite tests these functions directly.
 *
 * Naming deliberately mirrors the Python so that a reader can diff the two.
 */

export type Shade = 'D' | 'L';

export type ItemType =
  | 'shoes'
  | 'socks'
  | 'pants'
  | 'shirts'
  | 'hats'
  | 'underwear'
  | 'blanket';

/** Canonical order, matching rules.py `TYPE_NAMES`. */
export const TYPE_NAMES: readonly ItemType[] = [
  'shoes',
  'socks',
  'pants',
  'shirts',
  'hats',
  'underwear',
  'blanket',
] as const;

export const CLOTHES: ReadonlySet<ItemType> = new Set<ItemType>([
  'shoes',
  'socks',
  'pants',
  'shirts',
  'hats',
]);

export const LINEN: ReadonlySet<ItemType> = new Set<ItemType>(['underwear', 'blanket']);

export const SHADES: readonly Shade[] = ['D', 'L'] as const;

export type PlayerId = number;

/**
 * Item identity.  `${owner}-${type}-${shade}` is exactly Python's
 * `Item.key() == (owner, typ, shade)`, which is also its `iid`: each colour holds
 * exactly one card of each (type, shade), so the triple is unique.
 */
export type ItemId = string;

export function itemId(owner: PlayerId, type: ItemType, shade: Shade): ItemId {
  return `${owner}-${type}-${shade}`;
}

export interface ItemCard {
  id: ItemId;
  owner: PlayerId;
  type: ItemType;
  shade: Shade;
  /**
   * Socks that took a wash event in a machine containing a blanket are damp:
   * sent back, needing one further wash event anywhere (rules-v0.4 6.9, [A-27]).
   * Python models this as `wash_count`; a boolean is sufficient and is what
   * rules-v0.4 specifies.  Invariant I-5: only socks are ever damp.
   */
  damp: boolean;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type SpecialName =
  | 'Coloring'
  | 'Color catcher'
  | 'Bleach'
  | 'Wash net'
  | 'Snacc'
  | 'Sanitizer'
  | 'Coin';

export const SPECIALS: readonly SpecialName[] = [
  'Coloring',
  'Color catcher',
  'Bleach',
  'Wash net',
  'Snacc',
  'Sanitizer',
  'Coin',
] as const;

/** Cards that attach to a machine and are read by the reckoning. */
export const ATTACHING: ReadonlySet<SpecialName> = new Set<SpecialName>([
  'Coloring',
  'Color catcher',
  'Bleach',
  'Wash net',
  'Sanitizer',
]);

/** Cards that resolve immediately on play and never attach. */
export const IMMEDIATE: ReadonlySet<SpecialName> = new Set<SpecialName>(['Snacc', 'Coin']);

export type EventName = 'Gang' | 'Circuit break' | 'Jimothy' | 'Animal control';

export const EVENTS: readonly EventName[] = [
  'Gang',
  'Circuit break',
  'Jimothy',
  'Animal control',
] as const;

/** Brief v8 section 7: exactly four cards, one copy each.  Fixed and final. */
export const FIXED_EVENT_DECK: Readonly<Record<EventName, number>> = {
  Gang: 1,
  'Circuit break': 1,
  Jimothy: 1,
  'Animal control': 1,
};

export interface AttachedCard {
  name: SpecialName;
  owner: PlayerId;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface Machine {
  id: number;
  items: ItemId[];
  /** Power.  An OFF machine skips reckoning and keeps its contents. */
  on: boolean;
  /** Destroyed by Gang.  Permanent; not a machine any more [A-14]. */
  dead: boolean;
  jimothy: boolean;
  cards: AttachedCard[];
  /**
   * Wash net protection.  PER ITEM, set at load time, cleared when the item
   * leaves the machine (invariant I-11, worked example 22).  A per-machine or
   * per-player flag gets the OFF-machine carry-over case wrong.
   */
  netProtected: ItemId[];
}

export interface PlayerState {
  id: PlayerId;
  hand: ItemId[];
  /**
   * Public damp zone [A-28].  Loadable exactly like the hand.  This is a
   * partition of what Python keeps in `hand`, so no reckoning outcome changes;
   * it exists so the only persistent per-item state in the game stays public.
   * Set cfg.publicDampZone = false to keep damp socks in hand, Python-style.
   */
  damp: ItemId[];
  clean: ItemId[];
  /** The 10 of 14 drawn at setup.  Only these must be washed. */
  mustWash: ItemId[];
  /** Drawn today, face-up, UNPLAYABLE until end of day promotes them. */
  fresh: SpecialName[];
  ready: SpecialName[];
  finishedDay: number | null;
  keyHolds: number;
}

export type TurnStage = 'roll' | 'card' | 'load' | 'extra' | 'done';

export interface TurnScratch {
  player: PlayerId;
  face: number | null;
  stage: TurnStage;
  loadsRequired: number;
  loadsDone: number;
  cardPlayed: boolean;
  extraResolved: boolean;
  /** Python's `_net_turn`: the (player, machine) whose same-turn underwear the net protects. */
  netTurn: { player: PlayerId; machine: number } | null;
  /** Face 5: the two cards drawn, awaiting a keep decision. */
  pendingDraw: SpecialName[] | null;
  /**
   * Face 6 with cfg.resolveEventsImmediately: an event has been drawn and needs
   * a machine chosen by the drawer before the turn can continue.
   */
  pendingEvent: boolean;
}

export interface LogEntry {
  day: number;
  text: string;
}

export interface GameState {
  cfg: LaundromatConfig;
  items: Record<ItemId, ItemCard>;
  machines: Machine[];
  players: PlayerState[];
  /** index 0 is the BOTTOM of the deck; draws pop() from the end.  Matches Python. */
  specialDeck: SpecialName[];
  eventDeck: EventName[];
  key: PlayerId;
  day: number;
  revealedEvent: EventName | null;
  eventDrawer: PlayerId | null;
  jimothyAt: number | null;
  jimothySince: number | null;
  jimothyArrived: number | null;
  gangUsed: boolean;
  /** Circuit break arm V1: tonight's reckoning is cancelled. */
  cbBlackout: boolean;
  /** Circuit break arm V3: the day at whose end everything comes back ON. */
  cbRestoreDay: number | null;
  over: boolean;
  winners: PlayerId[];
  /** The event that most recently RESOLVED, so the UI can report what happened. */
  lastEvent: { name: EventName; day: number; auto: boolean } | null;
  turn: TurnScratch | null;
  log: LogEntry[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type CircuitBreakArm = 'V1' | 'V2' | 'V3';

/** Experiment B: when a drawn event RESOLVES.  See web/experiments/. */
export type EventTimingArm = 'E1' | 'E2' | 'E3';

// Type-only, so this does not create a runtime cycle with reckoning.ts.
import type { MeshBagRule } from './reckoning';
export type { MeshBagRule };
export type TurnOrder = 'cardLoadExtra' | 'extraLoadCard';

export interface LaundromatConfig {
  players: number;
  machines: number;
  capacity: number;
  handSize: number;
  crowdThreshold: number;

  circuitBreak: CircuitBreakArm;
  turnOrder: TurnOrder;
  /**
   * EXPERIMENT B — when a drawn event RESOLVES.  Under test; not settled.
   * The card is REVEALED the instant it is drawn in every arm; only the moment
   * of resolution differs.  At most one event happens per day in every arm.
   *
   *   E1 "immediate"  every event fires on draw, mid-roll-phase.
   *   E2 "deferred"   every event fires after all turns, before the keyholder.
   *                   This is brief v8 section 4, and what sim/rules.py does.
   *   E3 "split"      untargeted events (Circuit break, Animal control) fire on
   *                   draw; targeted ones (Gang, Jimothy) are deferred.
   *
   * See web/experiments/experiment-B-event-timing.md.
   */
  eventTiming: EventTimingArm;

  specialDeck: Record<SpecialName, number>;
  eventDeck: Record<EventName, number>;

  keyholderFirst: boolean;
  sanitizerOwnerOnly: boolean;
  bleachKillsDark: boolean;
  socksBlanketExtraWash: boolean;
  /**
   * DESIGNER REVISION.  Diverges from brief v8 and from sim/rules.py.
   *
   * 'v8net'      — Wash net: same-turn UNDERWEAR only, and all it waives is
   *                underwear isolation.
   * 'guaranteed' — Mesh bag: everything you load into that machine on the turn
   *                you play the bag goes in it, and all of it washes if the
   *                machine reckons.
   *
   * The card's internal id stays 'Wash net' so the deck still matches the
   * oracle's vocabulary and the constants parity check stays honest; it is
   * DISPLAYED as "Mesh bag".  Rename both sides together when sim/rules.py is
   * updated -- see README.
   */
  meshBagRule: MeshBagRule;
  /**
   * DESIGNER REVISION.  Diverges from brief v8 and from sim/rules.py.
   * Your own items never taint your own items by shade; among your own items a
   * shade-blind ladder applies instead:
   *     shoes (D = L) > clothing and blanket (D = L) > underwear (D = L)
   * Other players still taint you exactly as before.
   */
  ownItemsDontTaint: boolean;
  publicDampZone: boolean;

  dayCap: number;
}
