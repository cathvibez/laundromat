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
  if (item.type === 'blanket') {
    // A blanket may join an empty machine or one holding only socks [A-W11].
    return contents.every((x) => x.type === 'socks') ? null : 'blanket-needs-room';
  }
  if (contents.some((x) => x.type === 'blanket')) {
    // Socks are the one legal companion for a blanket, in both directions.
    return item.type === 'socks' ? null : 'blanket-inside';
  }
  return null;
}

export const REFUSAL_TEXT: Readonly<Record<Exclude<RefusalReason, null>, string>> = {
  destroyed: 'Destroyed by the Gang - out of the game',
  raccoon: 'Jimothy is in there',
  full: 'Full (4 of 4)',
  'blanket-inside': 'A blanket is inside - only socks may join it',
  'blanket-needs-room': 'A blanket needs a machine holding nothing but socks',
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

/** Every item the player may load right now: hand plus the public damp zone. */
export function loadableItems(st: GameState, pid: number): ItemId[] {
  const p = st.players[pid];
  return st.cfg.publicDampZone ? [...p.hand, ...p.damp] : [...p.hand];
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
