/**
 * Read-only views for the UI.  These never mutate.
 *
 * The "TONIGHT" narration runs the REAL reckoning function against the current
 * board, so what the UI promises and what the reckoning does cannot disagree.
 */

import { cardsKeyOf, currentTier, machineContents, opts } from './phases';
import { TIER_TEXT, machineVerdicts } from './reckoning';
import { REFUSAL_TEXT, refusalFor } from './placement';
import type { GameState, ItemCard, ItemId, Machine, PlayerId, SpecialName } from './types';

export type MachineStatus = 'destroyed' | 'raccoon' | 'off' | 'on';

export function machineStatus(m: Machine): MachineStatus {
  if (m.dead) return 'destroyed';
  if (m.jimothy) return 'raccoon';
  return m.on ? 'on' : 'off';
}

export interface TonightLine {
  item: ItemCard;
  willWash: boolean;
}

/**
 * The forecast at a glance: two or three words and a colour, for the board.
 *
 * It is computed HERE rather than in the UI because it is the same judgement
 * the headline makes and they must never disagree — a chip that says "3 wash"
 * over a sentence that says two is worse than either alone. The UI picks which
 * one it has room for; both come from this function.
 */
export interface TonightChip {
  /** Two or three words. Never a sentence. */
  text: string;
  tone: 'good' | 'bad' | 'warn' | 'quiet';
}

export interface TonightSummary {
  status: MachineStatus;
  /** The full sentence. Kept for the reckoning and for the detail popover. */
  headline: string;
  tierText: string | null;
  /** The same thing, short enough to read without stopping. */
  chip: TonightChip;
  lines: TonightLine[];
}

export function tonight(st: GameState, m: Machine): TonightSummary {
  const status = machineStatus(m);
  const contents = machineContents(st, m);

  if (status === 'destroyed') {
    return {
      status,
      headline: 'Out of the game. The Gang shot it.',
      tierText: null,
      chip: { text: 'Shot', tone: 'bad' },
      lines: [],
    };
  }
  if (status === 'raccoon') {
    return {
      status,
      headline:
        contents.length > 0
          ? `Jimothy is here. ${contents.length} item(s) held hostage - nothing washes, nothing may be loaded.`
          : 'Jimothy is here. It cannot run and cannot be loaded.',
      tierText: null,
      chip: { text: 'Jimothy', tone: 'warn' },
      lines: contents.map((item) => ({ item, willWash: false })),
    };
  }
  if (status === 'off') {
    return {
      status,
      headline:
        contents.length > 0
          ? `Switched off. It keeps its ${contents.length} item(s) into tomorrow.`
          : 'Switched off. It will not run tonight.',
      tierText: null,
      chip: {
        text: contents.length > 0 ? `Off · keeps ${contents.length}` : 'Off',
        tone: 'quiet',
      },
      lines: contents.map((item) => ({ item, willWash: false })),
    };
  }
  if (st.cbBlackout) {
    return {
      status,
      headline: 'The power tripped. Nothing reckons tonight.',
      tierText: null,
      chip: { text: 'Power out', tone: 'bad' },
      lines: contents.map((item) => ({ item, willWash: false })),
    };
  }
  if (contents.length === 0) {
    return {
      status,
      headline: 'Empty. Nothing to wash.',
      tierText: null,
      chip: { text: 'Empty', tone: 'quiet' },
      lines: [],
    };
  }

  const verdicts = machineVerdicts(contents, cardsKeyOf(m), opts(st));
  const tier = currentTier(st, m);
  /*
   * A sock the blanket strands passes the VERDICT and still does not wash, so
   * the headline has to subtract it.  Promising "2 of 3 wash" and then handing
   * back one clean item is the sort of thing that makes people distrust the
   * whole panel, and this is the panel the reckoning has to keep faith with.
   */
  const lines = contents.map((item, i) => ({
    item,
    willWash: verdicts[i] && !willTangle(st, m, item),
  }));
  const stayCount = contents.filter((item, i) => verdicts[i] && willTangle(st, m, item)).length;
  const washCount = lines.filter((l) => l.willWash).length;
  // With ownItemsDontTaint the machine no longer resolves at one tier: the
  // ladder below is what OTHER players' items impose on you. The per-item
  // verdicts above are the truth and come from the real reckoning either way.
  const tierLabel =
    tier === null
      ? null
      : st.cfg.ownItemsDontTaint
        ? `${TIER_TEXT[tier]} — that is what the room does to you. Your own items never taint each other; among them it is shoes, then clothing and blanket, then underwear.`
        : TIER_TEXT[tier];
  const headline =
    washCount === 0
      ? stayCount > 0
        ? `Tonight: nothing washes. ${stayCount} item(s) tangle and stay; everything else goes back.`
        : 'Tonight: nothing washes. Everything goes back.'
      : stayCount > 0
        ? `Tonight: ${washCount} of ${contents.length} wash · ${stayCount} tangled and staying.`
        : `Tonight: ${washCount} of ${contents.length} wash.`;
  const chip: TonightChip =
    washCount === 0
      ? { text: stayCount > 0 ? `${stayCount} tangled` : 'None wash', tone: 'bad' }
      : stayCount > 0
        ? { text: `${washCount} wash · ${stayCount} tangled`, tone: 'warn' }
        : { text: `${washCount} of ${contents.length} wash`, tone: 'good' };

  return { status, headline, tierText: tierLabel, chip, lines };
}

/**
 * Will the blanket in here tangle this item and keep it?
 *
 * THE single source of truth for tangling.  It is not stored on the item; it is
 * this question, asked of the machine the item is sitting in, and the answer
 * changes the moment a blanket is loaded or removed.  [A-24] keys on the
 * machine's CONTENTS, never on the blanket's own verdict, which is what keeps
 * the reckoning commutative.
 *
 * REVISED v11: any item can be tangled, not only socks — a blanket now shares
 * with one item of any type.  The blanket itself is never tangled; it washes or
 * is sent back like anything else.
 */
export function willTangle(st: GameState, m: Machine, item: ItemCard): boolean {
  if (!st.cfg.socksBlanketExtraWash) return false;
  if (item.type === 'blanket') return false;
  return machineContents(st, m).some((x) => x.type === 'blanket');
}

export interface TargetInfo {
  machine: number;
  ok: boolean;
  reason: string | null;
}

/** Where may this player put this item right now, and why not otherwise. */
export function loadTargets(st: GameState, _pid: PlayerId, id: ItemId): TargetInfo[] {
  return st.machines.map((m) => {
    const r = refusalFor(st, m.id, id);
    return { machine: m.id, ok: r === null, reason: r === null ? null : REFUSAL_TEXT[r] };
  });
}

export function itemLabel(item: ItemCard): string {
  const shade = item.shade === 'D' ? 'dark' : 'light';
  return `${shade} ${item.type}`;
}

export function shortLabel(item: ItemCard): string {
  return `${item.shade} ${item.type}`;
}

/**
 * What each card is CALLED in the product.  The engine keeps brief v8's internal
 * ids so the deck still matches the Python oracle's vocabulary and the constants
 * parity check stays meaningful; only the label differs.  When sim/rules.py is
 * updated, rename both sides together and delete this map.
 */
export const SPECIAL_DISPLAY: Record<SpecialName, string> = {
  Coloring: 'Coloring',
  'Color catcher': 'Color catcher',
  Bleach: 'Bleach',
  'Wash net': 'Mesh bag',
  Snacc: 'Snacc',
  Sanitizer: 'Sanitizer',
  Coin: 'Coin',
};

export function cardName(n: SpecialName): string {
  return SPECIAL_DISPLAY[n] ?? n;
}

export const SPECIAL_TEXT: Record<string, string> = {
  Coloring: 'Play on a machine. Every other player’s items there are ruined and sent back.',
  'Color catcher': 'Play on a machine. Your items there ignore Coloring.',
  Bleach: 'Play on a machine. This wash runs backwards: light washes, dark is sent back.',
  'Wash net':
    'Play on a machine as you load. Everything you load into it this turn goes in the bag, and all of it washes when that machine runs — whatever else is in there.',
  Sanitizer: 'Play on a machine. Shoes stop tainting this wash. Every other rule still applies.',
  Coin: 'Turn any one machine on or off. You do not need the key. One shot.',
  Snacc: 'Lure Jimothy to another machine. Items he leaves go back to their owners, unwashed.',
};

export const EVENT_TEXT: Record<string, string> = {
  Gang: 'Pick a washer. It is shot and out of the game permanently. Its contents go back to their owners.',
  'Circuit break': 'The power trips.',
  Jimothy:
    'Jimothy settles into a washer. It cannot run and cannot be loaded. Anything inside is stuck with him.',
  'Animal control': 'Jimothy is taken away. Anything stuck with him goes back to its owner, unwashed.',
};

/**
 * Hand sort order, designer-specified, following how dominant each item is in
 * the reckoning:
 *
 *   dark shoes  >  light shoes
 *   >  dark clothing + dark blanket  >  light clothing + light blanket
 *   >  dark underwear  >  light underwear
 *
 * Underwear sorts last because it can only ever wash among underwear, so it is
 * the least flexible thing you can hold; shoes sort first because they decide
 * the whole machine.
 */
export function sortRank(item: ItemCard): number {
  const dark = item.shade === 'D';
  if (item.type === 'shoes') return dark ? 0 : 1;
  if (item.type === 'underwear') return dark ? 4 : 5;
  return dark ? 2 : 3; // all other clothing, and the blanket, ranked by shade
}

export function sortItems(st: GameState, ids: ItemId[]): ItemId[] {
  return [...ids].sort((a, b) => {
    const x = st.items[a];
    const y = st.items[b];
    const rx = sortRank(x);
    const ry = sortRank(y);
    if (rx !== ry) return rx - ry;
    if (x.type !== y.type) return x.type < y.type ? -1 : 1;
    return 0;
  });
}

export const SORT_EXPLAINER =
  'dark shoes, light shoes, dark clothing and blanket, light clothing and blanket, dark underwear, light underwear';

export const RULES_SUMMARY: { heading: string; lines: string[] }[] = [
  {
    heading: 'The goal',
    lines: [
      'Wash all ten of the items you were dealt. First to finish wins, and the game ends at once.',
      'If several players finish on the same day, they all win together.',
    ],
  },
  {
    heading: 'A day, in order',
    lines: [
      '1. Roll — each player rolls, may play one ready card, then MUST load.',
      '2. An event drawn on a 6 happens IMMEDIATELY, mid-turn. Only one event per day.',
      '3. Key — the keyholder turns one machine on, one off, or passes. This still',
      '   happens after a Circuit break, so one washer can come straight back on.',
      '4. Reckoning — every machine that is on resolves.',
      '5. End of day — fresh cards become ready, the key passes on.',
    ],
  },
  {
    heading: 'The die',
    lines: [
      '1 / 2 / 3 — load that many items.',
      '4 — load 1, and move any one item between machines, including your own.',
      '5 — load 1, and draw two special items, keep one.',
      '6 — load 1, and draw an event. Only the first 6 of the day draws one.',
      'Loading is mandatory. You load fewer only if your hand or the board will not allow it.',
    ],
  },
  {
    heading: 'The reckoning ladder — "shoes first, then dark, then light"',
    lines: [
      'Tier 1 — any dark shoes present: dark shoes wash, everything else goes back.',
      'Tier 2 — else any light shoes: light shoes wash, everything else goes back.',
      'Tier 3 — else any dark item: all dark items wash, light goes back.',
      'Tier 4 — light items only: they all wash.',
      'That ladder is what OTHER players impose on you.',
      'Your own items never taint each other by shade. Among your own items only:',
      '    shoes (dark = light) > clothing and blanket (dark = light) > underwear (dark = light).',
      'So your own dark shirt no longer stops your own light one, but your own shoes',
      'still stop your own shirt, and your own shirt still stops your own underwear.',
    ],
  },
  {
    heading: 'Filters on top of the ladder',
    lines: [
      'Crowding — 3 or more of the same garment type, any colour: all of them go back.',
      'Underwear washes only among underwear (unless a Wash net covers it).',
      'A blanket must be alone, except that socks may share with it.',
      'A blanket tangles the one item beside it: that item does not wash and stays in the washer.',
    ],
  },
  {
    heading: 'Machine states',
    lines: [
      'ON — reckons, and can be loaded.',
      'OFF — does not reckon, keeps its contents, and can still be loaded.',
      'Jimothy — cannot run, cannot be loaded, contents are hostage until he leaves.',
      'Destroyed — shot by the Gang, out of the game permanently.',
    ],
  },
  {
    heading: 'Cards',
    lines: [
      'A card drawn today sits face-up in your FRESH zone and cannot be played until tomorrow.',
      'Mesh bag: play it as you load, and everything you put in that machine this turn washes.',
      'You may play at most one ready card per turn, and it returns to the deck afterwards.',
      'Everything on the floor is public. Only your hand and your ready cards are private.',
    ],
  },
];

export function playerColorName(pid: PlayerId): string {
  return ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'][pid] ?? `P${pid + 1}`;
}
