/**
 * THE RECKONING -- pure, memoised, order-independent.
 *
 * Direct port of rules.py `machine_verdicts`, implementing rules-v0.4 section 6.2
 * RESOLVE_MACHINE steps S1..S7.
 *
 * rules-v0.4 section 6.1 proves the post-ladder filters form a PURE CONJUNCTION:
 *
 *     washed(i) = tierMatch(i)
 *               AND NOT isolationViolated(i)
 *               AND NOT blanketViolation(i)
 *               AND NOT crowded(i)
 *               AND NOT ruined(i)
 *
 * Every one of those terms is computed from the machine's CONTENTS and ATTACHED
 * CARDS only -- never from another item's current verdict -- so they commute and
 * are implemented below as an order-independent filter chain.  The single
 * load-bearing ordering constraint is that the pre-ladder modifiers (Bleach,
 * Sanitizer) run before tier selection.
 *
 * The socks-with-blanket damp transform is deliberately NOT here: it mutates a
 * per-card counter, which would poison the memo table.  It is a caller concern
 * (see phases.ts, S8), exactly as in the Python.
 */

import type { ItemType, PlayerId, Shade } from './types';

export interface ItemKey {
  owner: PlayerId;
  type: ItemType;
  shade: Shade;
}

export interface CardsKey {
  bleached: boolean;
  coloringOwners: PlayerId[];
  catcherOwners: PlayerId[];
  /** Item ids protected by a Wash net, per-card (invariant I-11). */
  netKeys: string[];
  sanitizerOwners: PlayerId[];
}

export type MeshBagRule = 'v8net' | 'guaranteed';

export interface ReckoningOpts {
  bleachKillsDark: boolean;
  sanitizerOwnerOnly: boolean;
  crowdThreshold: number;
  /**
   * What `cards.netKeys` MEANS.  Absent is treated as 'v8net', so fixtures
   * generated from the Python oracle keep their original semantics.
   *
   * 'v8net'      — brief v8 Wash net: the listed items are underwear, and the
   *                only thing they are exempt from is underwear isolation.
   * 'guaranteed' — Mesh bag (designer revision): the listed items are everything
   *                their owner loaded into this machine on the turn the bag was
   *                played, and they ALL WASH if the machine reckons at all.
   *                Nothing can stop them: not the tier ladder, not crowding, not
   *                underwear isolation, not blanket exclusivity, not Coloring.
   */
  meshBag?: MeshBagRule;
  /**
   * DESIGNER REVISION.  Absent is treated as false, so oracle fixtures keep
   * brief v8 semantics.
   *
   * When true, YOUR OWN ITEMS NEVER TAINT YOUR OWN ITEMS BY SHADE.  Two things
   * happen together:
   *
   *  (a) Every item is judged against the machine MINUS its owner's other
   *      items, so only OTHER players can taint you.  Opponents still taint you
   *      exactly as before, by shoes and by shade.
   *  (b) Among your own items a shade-blind category ladder applies instead:
   *          shoes (D = L)  >  clothing and blanket (D = L)  >  underwear (D = L)
   *      Only your top occupied category washes.  So your own shoes still stop
   *      your own shirt, and your own shirt still stops your own underwear --
   *      but your dark shirt no longer stops your light one.
   */
  ownItemsDontTaint?: boolean;
}

/** The shade-blind ladder that applies among a single owner's items. */
export function ownCategory(type: ItemType, sanitized: boolean): number {
  if (type === 'shoes') return sanitized ? 1 : 0; // Sanitizer stops shoes dominating here too
  if (type === 'underwear') return 2;
  return 1; // socks, pants, shirts, hats, blanket
}

export const DEFAULT_RECKONING_OPTS: ReckoningOpts = {
  bleachKillsDark: false,
  sanitizerOwnerOnly: false,
  crowdThreshold: 3,
};

export function emptyCardsKey(): CardsKey {
  return {
    bleached: false,
    coloringOwners: [],
    catcherOwners: [],
    netKeys: [],
    sanitizerOwners: [],
  };
}

// ---------------------------------------------------------------------------
// Memoisation
// ---------------------------------------------------------------------------

const VERDICT_MEMO = new Map<string, boolean[]>();

function memoKey(items: ItemKey[], cards: CardsKey, opts: ReckoningOpts, sanitized: boolean): string {
  const i = items.map((x) => `${x.owner}${x.type}${x.shade}`).join(',');
  const c = [
    cards.bleached ? '1' : '0',
    [...cards.coloringOwners].sort().join('.'),
    [...cards.catcherOwners].sort().join('.'),
    [...cards.netKeys].sort().join('.'),
    sanitized ? '1' : '0',
  ].join('|');
  const o = `${opts.bleachKillsDark ? 1 : 0}${opts.sanitizerOwnerOnly ? 1 : 0}${opts.crowdThreshold}`;
  return `${i}#${c}#${o}`;
}

/** Test helper: the memo must never change an answer, only its cost. */
export function clearVerdictMemo(): void {
  VERDICT_MEMO.clear();
}

// ---------------------------------------------------------------------------
// The algorithm
// ---------------------------------------------------------------------------

/**
 * Returns a boolean per item, aligned with `items`, saying whether it WASHES.
 * Pure: identical inputs always give identical outputs, and item order is
 * irrelevant (the verdict of item i is invariant under permutation of the rest).
 */
export function machineVerdicts(
  items: ItemKey[],
  cards: CardsKey = emptyCardsKey(),
  opts: ReckoningOpts = DEFAULT_RECKONING_OPTS,
): boolean[] {
  if (items.length === 0) return [];

  // [A-W05] owner-only Sanitizer: splice the sanitized verdict into the base
  // verdict for the sanitizer owners' items only.  rules-v0.4 [OQ-01] argues
  // this reading is disqualifying because it puts two tiers in one machine; it
  // is kept solely as a sensitivity switch.
  if (opts.sanitizerOwnerOnly && cards.sanitizerOwners.length > 0) {
    const base = core(items, cards, opts, false);
    const san = core(items, cards, opts, true);
    const owners = new Set(cards.sanitizerOwners);
    return items.map((it, i) => (owners.has(it.owner) ? san[i] : base[i]));
  }

  const sanitized = cards.sanitizerOwners.length > 0;

  // ---- Own items never taint own items (designer revision) ----------------
  // Each item is resolved in a virtual machine holding everything EXCEPT its
  // owner's other items, and then filtered by the shade-blind own-item ladder.
  //
  // Every verdict is still a pure function of the machine's contents and cards,
  // never of another item's verdict, so the filters still commute and item order
  // still cannot matter (see the permutation tests).
  //
  // The cost, stated plainly: the machine no longer resolves at a single tier.
  // Each owner can be on a different rung at once.  rules-v0.4 section 6.10
  // rejected that shape when it was proposed for Sanitizer, on the grounds that
  // it stops the reckoning being resolvable by eye at a table.  That objection
  // applies here too, and more broadly.
  // Under the Mesh bag rule netKeys mark membership only and carry no isolation
  // waiver, so everything outside the bag resolves as if no net were attached.
  const meshGuaranteed = (opts.meshBag ?? 'v8net') === 'guaranteed' && cards.netKeys.length > 0;
  const effCards: CardsKey = meshGuaranteed ? { ...cards, netKeys: [] } : cards;

  let base: boolean[];
  if (opts.ownItemsDontTaint) {
    base = items.map((x) => {
      const others = items.filter((y) => y.owner !== x.owner);
      const virtual = [...others, x];
      const crossPlayer = core(virtual, effCards, opts, sanitized)[virtual.length - 1];
      if (!crossPlayer) return false;
      // The owner's own shade-blind ladder: only their top category washes.
      const mine = items.filter((y) => y.owner === x.owner);
      const top = Math.min(...mine.map((y) => ownCategory(y.type, sanitized)));
      return ownCategory(x.type, sanitized) === top;
    });
  } else {
    base = core(items, effCards, opts, sanitized);
  }

  // ---- Mesh bag (designer revision) --------------------------------------
  // "Anything put into the mesh bag will get washed if the washer is reckoned."
  // So a bagged item's verdict is simply TRUE.  Everything outside the bag
  // resolves exactly as it always did, WITH the bagged items still present and
  // still counting towards tier selection and crowding -- the bag protects its
  // contents, it does not remove them from the wash.
  //
  // Verdicts remain a pure function of the machine's contents and cards, never
  // of another item's verdict, so the filter chain still commutes and item order
  // still cannot matter (see the permutation tests).
  // The bag is the LAST word: it overrides the ladder, every filter, the
  // own-item ladder and Coloring alike.
  if (meshGuaranteed) {
    const bagged = new Set(cards.netKeys);
    return items.map((x, i) =>
      bagged.has(`${x.owner}-${x.type}-${x.shade}`) ? true : base[i],
    );
  }

  return base;
}

function core(
  items: ItemKey[],
  cards: CardsKey,
  opts: ReckoningOpts,
  sanitized: boolean,
): boolean[] {
  const mk = memoKey(items, cards, opts, sanitized);
  const hit = VERDICT_MEMO.get(mk);
  if (hit) return hit;

  const n = items.length;

  // ---- S1. Pre-ladder modifiers.  These commute with each other. -----------
  // Bleach swaps effective shade.  Two Bleaches do not cancel: it is a flag,
  // not a toggle [A-20].
  let eff: Shade[];
  let killed: boolean[];
  if (opts.bleachKillsDark && cards.bleached) {
    // Sensitivity reading (rules-v0.2 [OQ-05]): bleach destroys dark instead of
    // swapping.  Killed items never wash and never select a tier.
    eff = items.map((x) => x.shade);
    killed = items.map((x) => x.shade === 'D');
  } else {
    eff = items.map((x) => (cards.bleached ? (x.shade === 'D' ? 'L' : 'D') : x.shade));
    killed = new Array(n).fill(false);
  }

  // ---- S2. Tier selection.  Sanitizer suppresses the two shoe rungs. -------
  let tier = 4;
  if (!sanitized) {
    for (let i = 0; i < n; i++) {
      if (killed[i]) continue;
      if (eff[i] === 'D' && items[i].type === 'shoes') {
        tier = 1;
        break;
      }
    }
    if (tier === 4) {
      for (let i = 0; i < n; i++) {
        if (killed[i]) continue;
        if (eff[i] === 'L' && items[i].type === 'shoes') {
          tier = 2;
          break;
        }
      }
    }
  }
  if (tier === 4) {
    for (let i = 0; i < n; i++) {
      if (killed[i]) continue;
      if (eff[i] === 'D') {
        tier = 3;
        break;
      }
    }
  }

  // ---- S3. Provisional verdict from the ladder alone. ----------------------
  const washing: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (killed[i]) continue;
    const t = items[i].type;
    switch (tier) {
      case 1:
        washing[i] = eff[i] === 'D' && t === 'shoes';
        break;
      case 2:
        washing[i] = eff[i] === 'L' && t === 'shoes';
        break;
      case 3:
        washing[i] = eff[i] === 'D';
        break;
      default:
        washing[i] = eff[i] === 'L';
        break;
    }
  }

  // ---- S4..S7.  MONOTONE DOWNGRADES.  THEY COMMUTE. -----------------------
  // Each filter returns the set of indices it demotes, computed from contents
  // and cards only.  Applying them in any order gives the same answer; the
  // reduce below makes that structure explicit rather than incidental.
  const ctx: FilterCtx = { items, cards, opts, tier };
  const filters: MonotoneFilter[] = [
    underwearIsolation,
    blanketExclusivity,
    crowding,
    coloring,
  ];
  for (const f of filters) {
    const demote = f(ctx);
    for (const i of demote) washing[i] = false;
  }

  Object.freeze(washing);
  VERDICT_MEMO.set(mk, washing);
  return washing;
}

// ---------------------------------------------------------------------------
// The monotone filters (class (c) of rules-v0.4 section 6.1)
// ---------------------------------------------------------------------------

interface FilterCtx {
  items: ItemKey[];
  cards: CardsKey;
  opts: ReckoningOpts;
  tier: number;
}

/** Returns the indices this rule sends back.  Never promotes anything. */
type MonotoneFilter = (ctx: FilterCtx) => number[];

/**
 * S4.  Underwear washes only among underwear, unless net-protected.
 * The test is on CONTENTS, not on what is washing (rules-v0.4 6.4).
 */
const underwearIsolation: MonotoneFilter = ({ items, cards }) => {
  const hasNonUnderwear = items.some((x) => x.type !== 'underwear');
  if (!hasNonUnderwear) return [];
  const net = new Set(cards.netKeys);
  const out: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const x = items[i];
    if (x.type !== 'underwear') continue;
    if (net.has(`${x.owner}-${x.type}-${x.shade}`)) continue;
    out.push(i);
  }
  return out;
};

/**
 * S5.  A blanket must be alone except for socks [A-W11].  machineAccepts should
 * make an illegal board unreachable; this is the defensive assert, and it is a
 * total loss for the machine when it fires.
 */
const blanketExclusivity: MonotoneFilter = ({ items }) => {
  const blankets = items.filter((x) => x.type === 'blanket').length;
  if (blankets === 0) return [];
  const bad = blankets > 1 || items.some((x) => x.type !== 'blanket' && x.type !== 'socks');
  return bad ? items.map((_, i) => i) : [];
};

/**
 * S6.  Crowding: >= threshold items of the same TYPE, any colour or shade, are
 * all sent back.  >=3 not exactly 3 [A-22] -- under "exactly 3" a fourth copy
 * would rescue all four.
 */
const crowding: MonotoneFilter = ({ items, opts }) => {
  const counts = new Map<ItemType, number>();
  for (const x of items) counts.set(x.type, (counts.get(x.type) ?? 0) + 1);
  const crowded = new Set<ItemType>();
  for (const [t, c] of counts) if (c >= opts.crowdThreshold) crowded.add(t);
  if (crowded.size === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < items.length; i++) if (crowded.has(items[i].type)) out.push(i);
  return out;
};

/**
 * S7.  Coloring ruins every OTHER colour in the machine; Color catcher exempts
 * its own owner.  "Ruined" means SENT_BACK [A-23]; Coloring protects nobody,
 * including its player, from anything else.
 */
const coloring: MonotoneFilter = ({ items, cards }) => {
  if (cards.coloringOwners.length === 0) return [];
  const catchers = new Set(cards.catcherOwners);
  const out: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const own = items[i].owner;
    if (catchers.has(own)) continue;
    if (cards.coloringOwners.some((p) => p !== own)) out.push(i);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Which tier fired -- for the UI's "TONIGHT" narration
// ---------------------------------------------------------------------------

export function tierOf(
  items: ItemKey[],
  cards: CardsKey = emptyCardsKey(),
  opts: ReckoningOpts = DEFAULT_RECKONING_OPTS,
): 1 | 2 | 3 | 4 | null {
  if (items.length === 0) return null;
  const sanitized = cards.sanitizerOwners.length > 0 && !opts.sanitizerOwnerOnly;
  const killed = (x: ItemKey) => opts.bleachKillsDark && cards.bleached && x.shade === 'D';
  const eff = (x: ItemKey): Shade =>
    opts.bleachKillsDark && cards.bleached ? x.shade : cards.bleached ? (x.shade === 'D' ? 'L' : 'D') : x.shade;

  const live = items.filter((x) => !killed(x));
  if (!sanitized && live.some((x) => eff(x) === 'D' && x.type === 'shoes')) return 1;
  if (!sanitized && live.some((x) => eff(x) === 'L' && x.type === 'shoes')) return 2;
  if (live.some((x) => eff(x) === 'D')) return 3;
  return 4;
}

export const TIER_TEXT: Readonly<Record<number, string>> = {
  1: 'Tier 1 - dark shoes wash, everything else goes back',
  2: 'Tier 2 - light shoes wash, everything else goes back',
  3: 'Tier 3 - dark items wash, light items go back',
  4: 'Tier 4 - light items only, they all wash',
};
