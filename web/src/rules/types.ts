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
}

/*
 * THERE IS NO `damp` FIELD, and that is the v10 rule rather than an omission.
 *
 * Damp used to be a property of a sock: it took a wash beside a blanket, came
 * out damp, went back to its owner, and needed a second wash anywhere. v10
 * makes it a property of a SITUATION instead — socks that would have washed
 * beside a blanket simply do not, and stay in the machine. They are ordinary
 * dirty socks sitting in a washer until a blanket turns up again, at which
 * point they are damp again for that night.
 *
 * So "is this sock damp" is not stored and must not be: it is derived, once,
 * by `selectors.willBeDamp()` — socks in a machine that currently contains a
 * blanket. Storing it as well would let the two disagree.
 */

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
  /*
   * The public damp zone is GONE in v10. Damp socks no longer come back to
   * their owner at all — they stay in the machine — so there is nothing for a
   * zone to hold. A sock leaves a machine only by washing (to `clean`) or by
   * being sent back on the verdict (to `hand`, like any other rejected item).
   */
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
  /**
   * Circuit break: tonight's reckoning is cancelled and nothing else changes.
   *
   * One-shot, whole-board, and deliberately NOT modelled as `Machine.on`. The
   * power is untouched — every washer keeps the on/off state it had, so the
   * next night runs exactly as it would have. Set when the card resolves, read
   * and cleared by the next `phaseReckon`.
   */
  cbBlackout: boolean;
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

/*
 * RESOLVED v10 — two A/B experiments closed, and their arms deleted rather than
 * left as switches.
 *
 * Circuit break was V1/V2/V3 and is now only what V1 did: the night's reckoning
 * is cancelled, no washer changes power state, the next day is normal. There is
 * no `circuitBreak` config field any more; `GameState.cbBlackout` is the whole
 * mechanism.
 *
 * Event timing was E1/E2/E3 and is now only E1: every event resolves the moment
 * its card is drawn. There is no `eventTiming` field and no deferred path. The
 * drawer chooses the target washer for Gang and Jimothy, which is what the code
 * already did in every arm.
 *
 * Both are recorded in design/game-brief.md v10. The arms live in git history
 * if an ablation ever needs them back.
 */

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

  turnOrder: TurnOrder;

  specialDeck: Record<SpecialName, number>;
  eventDeck: Record<EventName, number>;

  keyholderFirst: boolean;
  /*
   * No `sanitizerOwnerOnly` here. Sanitizer is always machine-wide: it stops
   * shoes dominating for EVERY item in the washer, whoever owns them.
   *
   * `ReckoningOpts` in reckoning.ts still carries the flag and still implements
   * the owner-only reading. That is not a leftover — 733 of the 17,434 parity
   * fixtures exercise it, and the oracle in sim/rules.py implements it, so
   * deleting the branch would either cost us those fixtures or require editing
   * the oracle to match the app. The game simply never sets it.
   */
  bleachKillsDark: boolean;
  /**
   * Socks do not wash beside a blanket.
   *
   * REVISED v10.  It used to mean "socks washed beside a blanket come out damp
   * and need a second wash somewhere".  It now means "socks that would have
   * washed beside a blanket do not, and stay in the machine" — no second wash,
   * no journey home, they simply sit there until a night with no blanket in
   * that washer.  The switch survives for ablation, as it always has.
   */
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

  dayCap: number;
}
