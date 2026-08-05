/**
 * Test rig, mirroring the helpers at the top of sim/test_rules.py so that the
 * ported assertions read the same in both languages.
 */

import { defaultConfig } from '../src/rules/config';
import { newGame } from '../src/rules/setup';
import { seededRng } from '../src/rules/rng';
import type { Rng } from '../src/rules/rng';
import { machineVerdicts, emptyCardsKey } from '../src/rules/reckoning';
import type { CardsKey, ItemKey, ReckoningOpts } from '../src/rules/reckoning';
import { cardsKeyOf, phaseEvent } from '../src/rules/phases';
import type { EventChoice } from '../src/rules/phases';
import type {
  AttachedCard,
  GameState,
  ItemCard,
  ItemId,
  ItemType,
  LaundromatConfig,
  Shade,
} from '../src/rules/types';

export const OWNERS: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

/** 'A-D-shoes' -> ItemCard, exactly like test_rules.py's `it()`. */
export function card(spec: string, damp = false): ItemCard {
  const [who, sh, typ] = spec.split('-');
  const owner = OWNERS[who];
  const shade = (sh === 'D' ? 'D' : 'L') as Shade;
  const type = typ as ItemType;
  return { id: `${owner}-${type}-${shade}`, owner, type, shade, damp };
}

export function id(spec: string): ItemId {
  const [who, sh, typ] = spec.split('-');
  return `${OWNERS[who]}-${typ}-${sh}`;
}

export function specs(...ss: string[]): Set<string> {
  return new Set(ss.map(id));
}

export interface ResolveOpts {
  cards?: AttachedCard[];
  net?: string[];
  bleachKillsDark?: boolean;
  sanitizerOwnerOnly?: boolean;
}

/** Returns the SET of item ids that wash.  Mirrors test_rules.py `resolve()`. */
export function resolve(items: ItemCard[], o: ResolveOpts = {}): Set<string> {
  const machine = {
    id: 0,
    items: items.map((x) => x.id),
    on: true,
    dead: false,
    jimothy: false,
    cards: o.cards ?? [],
    netProtected: o.net ?? [],
  };
  const ck: CardsKey = cardsKeyOf(machine);
  const opts: ReckoningOpts = {
    bleachKillsDark: o.bleachKillsDark ?? false,
    sanitizerOwnerOnly: o.sanitizerOwnerOnly ?? false,
    crowdThreshold: 3,
  };
  const verdicts = machineVerdicts(items as ItemKey[], ck, opts);
  const out = new Set<string>();
  items.forEach((x, i) => {
    if (verdicts[i]) out.add(x.id);
  });
  return out;
}

export function verdictsOf(items: ItemCard[], cards: CardsKey = emptyCardsKey()): boolean[] {
  return machineVerdicts(items as ItemKey[], cards);
}

// ---------------------------------------------------------------------------
// Day-level rig
// ---------------------------------------------------------------------------

export interface Rig {
  st: GameState;
  rng: Rng;
}

/**
 * A blank board with empty hands and a single placeholder must-wash item per
 * player, so `clean == mustWash` is never vacuously true.  Same shape as
 * test_rules.py `rig()`.
 */
export function rig(players = 3, over: Partial<LaundromatConfig> = {}): Rig {
  const cfg = defaultConfig(players, over);
  const rng = seededRng(1);
  const st = newGame(cfg, rng);
  for (const m of st.machines) {
    m.items = [];
    m.cards = [];
    m.on = true;
    m.jimothy = false;
    m.dead = false;
    m.netProtected = [];
  }
  for (const p of st.players) {
    p.hand = [];
    p.damp = [];
    p.clean = [];
    p.mustWash = [`${p.id}-pants-D`];
  }
  return { st, rng };
}

/** Put an item into a machine and make it part of its owner's must-wash set. */
export function put(rg: Rig, mi: number, c: ItemCard): ItemCard {
  const { st } = rg;
  st.items[c.id] = c;
  st.machines[mi].items.push(c.id);
  const p = st.players[c.owner];
  p.hand = p.hand.filter((x) => x !== c.id);
  p.damp = p.damp.filter((x) => x !== c.id);
  if (!p.mustWash.includes(c.id)) p.mustWash.push(c.id);
  return c;
}

/** Put an item into a player's hand. */
export function toHand(rg: Rig, pid: number, c: ItemCard): ItemCard {
  const { st } = rg;
  st.items[c.id] = c;
  st.players[pid].hand.push(c.id);
  if (!st.players[pid].mustWash.includes(c.id)) st.players[pid].mustWash.push(c.id);
  return c;
}

/** Draw `ev` the way the roll phase would, then resolve it. */
export function fire(
  rg: Rig,
  ev: GameState['revealedEvent'],
  choice: EventChoice = {},
  drawer = 0,
): void {
  const { st, rng } = rg;
  const i = st.eventDeck.indexOf(ev as never);
  if (i !== -1) st.eventDeck.splice(i, 1);
  st.revealedEvent = ev;
  st.eventDrawer = drawer;
  phaseEvent(st, choice, rng);
}

export function handOf(rg: Rig, pid: number): Set<string> {
  return new Set([...rg.st.players[pid].hand, ...rg.st.players[pid].damp]);
}

export function cleanOf(rg: Rig, pid: number): Set<string> {
  return new Set(rg.st.players[pid].clean);
}
