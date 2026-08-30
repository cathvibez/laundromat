/**
 * `machineAccepts` -- the SOLE placement-legality predicate (rules-v0.4 4.6).
 * Governs loads and roll-4 displacements identically.
 *
 * Port of rules.py `machine_accepts`.
 */

import type { GameState, ItemCard, ItemId, Machine } from './types';

export type RefusalReason =
  | 'destroyed'
  | 'raccoon'
  | 'full'
  | 'blanket-inside'
  | 'blanket-needs-room'
  | 'blanket-has-company'
  | null;

/** Why this machine will not take this item, or null if it will. */
export function refusalReason(
  machine: Machine,
  item: ItemCard,
  contents: ItemCard[],
  capacity: number,
): RefusalReason {
  if (machine.dead) return 'destroyed';
  if (machine.jimothy) return 'raccoon';
  if (contents.length >= capacity) return 'full';
  /*
   * A blanket is BIG [A-W11, REVISED v11].  It shares with exactly one other item,
   * of any type except another blanket — so a washer holding a blanket holds two
   * things at most, whatever that washer's capacity happens to be.
   *
   * Until v11 the rule was "a blanket plus any number of socks", which is why the
   * two branches below used to name socks.  Both directions have to agree, because
   * this predicate governs loading and the roll-4 move identically: whichever half
   * of the pair arrives second, the answer must be the same.
   */
  if (item.type === 'blanket') {
    if (contents.some((x) => x.type === 'blanket')) return 'blanket-inside';
    return contents.length <= 1 ? null : 'blanket-needs-room';
  }
  if (contents.some((x) => x.type === 'blanket')) {
    // The blanket is already here; it takes one companion and no more.
    return contents.length <= 1 ? null : 'blanket-has-company';
  }
  return null;
}

export const REFUSAL_TEXT: Readonly<Record<Exclude<RefusalReason, null>, string>> = {
  destroyed: 'Destroyed by the Gang - out of the game',
  raccoon: 'Jimothy is in there',
  full: 'Full (4 of 4)',
  'blanket-inside': 'A blanket is already in there - two will not fit',
  'blanket-needs-room': 'A blanket needs a machine holding at most one other item',
  'blanket-has-company': 'The blanket in there already has its one companion',
};

export function machineAccepts(st: GameState, machineIndex: number, itemId: ItemId): boolean {
  const m = st.machines[machineIndex];
  if (!m) return false;
  const item = st.items[itemId];
  if (!item) return false;
  const contents = m.items.map((id) => st.items[id]);
  return refusalReason(m, item, contents, st.cfg.capacity) === null;
}

export function refusalFor(st: GameState, machineIndex: number, itemId: ItemId): RefusalReason {
  const m = st.machines[machineIndex];
  const item = st.items[itemId];
  const contents = m.items.map((id) => st.items[id]);
  return refusalReason(m, item, contents, st.cfg.capacity);
}

export function liveMachines(st: GameState): number[] {
  return st.machines.filter((m) => !m.dead).map((m) => m.id);
}

/**
 * Every item the player may load right now: the hand, and only the hand.
 *
 * There used to be a second source, the public damp zone.  v10 deleted it —
 * damp socks stay in the machine they are in, so they are never in a player's
 * possession to re-load.
 */
export function loadableItems(st: GameState, pid: number): ItemId[] {
  return [...st.players[pid].hand];
}

/** Does any machine accept any item this player can load? */
export function hasLegalPlacement(st: GameState, pid: number): boolean {
  const items = loadableItems(st, pid);
  if (items.length === 0) return false;
  for (let mi = 0; mi < st.machines.length; mi++) {
    for (const id of items) {
      if (machineAccepts(st, mi, id)) return true;
    }
  }
  return false;
}
