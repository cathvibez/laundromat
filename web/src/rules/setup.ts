/**
 * Game setup.  Port of rules.py `new_game`.
 */

import { assertDeckSize } from './config';
import type { Rng } from './rng';
import type {
  EventName,
  GameState,
  ItemCard,
  ItemId,
  LaundromatConfig,
  Machine,
  PlayerState,
  SpecialName,
} from './types';
import { SHADES, TYPE_NAMES, itemId } from './types';

export function newMachine(id: number): Machine {
  return { id, items: [], on: true, dead: false, jimothy: false, cards: [], netProtected: [] };
}

export function newGame(cfg: LaundromatConfig, rng: Rng): GameState {
  assertDeckSize(cfg);

  const items: Record<ItemId, ItemCard> = {};
  const players: PlayerState[] = [];

  for (let pid = 0; pid < cfg.players; pid++) {
    // 7 types x 2 shades = 14 cards per colour.
    const deck: ItemCard[] = [];
    for (const type of TYPE_NAMES) {
      for (const shade of SHADES) {
        deck.push({ id: itemId(pid, type, shade), owner: pid, type, shade, damp: false });
      }
    }
    for (const card of deck) items[card.id] = card;

    // Each player draws 10 of their 14 at random.  Only those 10 must be washed.
    const drawn = rng.shuffle(deck).slice(0, cfg.handSize);
    const hand = drawn.map((x) => x.id);
    players.push({
      id: pid,
      hand,
      damp: [],
      clean: [],
      mustWash: [...hand],
      fresh: [],
      ready: [],
      finishedDay: null,
      keyHolds: 0,
    });
  }

  const specialDeck: SpecialName[] = [];
  for (const [name, n] of Object.entries(cfg.specialDeck) as [SpecialName, number][]) {
    for (let i = 0; i < n; i++) specialDeck.push(name);
  }

  const eventDeck: EventName[] = [];
  for (const [name, n] of Object.entries(cfg.eventDeck) as [EventName, number][]) {
    for (let i = 0; i < n; i++) eventDeck.push(name);
  }

  return {
    cfg,
    items,
    machines: Array.from({ length: cfg.machines }, (_, i) => newMachine(i)),
    players,
    specialDeck: rng.shuffle(specialDeck),
    eventDeck: rng.shuffle(eventDeck),
    key: 0,
    day: 0,
    revealedEvent: null,
    eventDrawer: null,
    jimothyAt: null,
    jimothySince: null,
    jimothyArrived: null,
    gangUsed: false,
    cbBlackout: false,
    cbRestoreDay: null,
    over: false,
    winners: [],
    turn: null,
    log: [],
  };
}

/** Acting order for the roll phase.  [A-W01]: fixed seat order by default. */
export function actingOrder(st: GameState): number[] {
  const P = st.cfg.players;
  if (st.cfg.keyholderFirst) {
    return Array.from({ length: P }, (_, i) => (st.key + i) % P);
  }
  return Array.from({ length: P }, (_, i) => i);
}
