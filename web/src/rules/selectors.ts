/**
 * Read-only views for the UI.  These never mutate.
 *
 * The "TONIGHT" narration runs the REAL reckoning function against the current
 * board, so what the UI promises and what the reckoning does cannot disagree.
 */

import { cardsKeyOf, currentTier, machineContents, opts } from './phases';
import { TIER_TEXT, machineVerdicts } from './reckoning';
import { REFUSAL_TEXT, refusalFor } from './placement';
import type { GameState, ItemCard, ItemId, ItemType, Machine, PlayerId } from './types';

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

export interface TonightSummary {
  status: MachineStatus;
  headline: string;
  tierText: string | null;
  lines: TonightLine[];
}

export function tonight(st: GameState, m: Machine): TonightSummary {
  const status = machineStatus(m);
  const contents = machineContents(st, m);

  if (status === 'destroyed') {
    return { status, headline: 'Out of the game. The Gang shot it.', tierText: null, lines: [] };
  }
  if (status === 'raccoon') {
    return {
      status,
      headline:
        contents.length > 0
          ? `Jimothy is here. ${contents.length} item(s) held hostage - nothing washes, nothing may be loaded.`
          : 'Jimothy is here. It cannot run and cannot be loaded.',
      tierText: null,
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
      lines: contents.map((item) => ({ item, willWash: false })),
    };
  }
  if (st.cbBlackout) {
    return { status, headline: 'The power tripped. Nothing reckons tonight.', tierText: null, lines: contents.map((item) => ({ item, willWash: false })) };
  }
  if (contents.length === 0) {
    return { status, headline: 'Empty. Nothing to wash.', tierText: null, lines: [] };
  }

  const verdicts = machineVerdicts(contents, cardsKeyOf(m), opts(st));
  const tier = currentTier(st, m);
  const lines = contents.map((item, i) => ({ item, willWash: verdicts[i] }));
  const washCount = lines.filter((l) => l.willWash).length;
  const headline =
    washCount === 0
      ? 'Tonight: nothing washes. Everything goes back.'
      : `Tonight: ${washCount} of ${contents.length} wash.`;
  return { status, headline, tierText: tier ? TIER_TEXT[tier] : null, lines };
}

/** Will these socks come out damp rather than clean?  [A-24] keyed on contents. */
export function willBeDamp(st: GameState, m: Machine, item: ItemCard): boolean {
  if (!st.cfg.socksBlanketExtraWash) return false;
  if (item.type !== 'socks' || item.damp) return false;
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

export const SPECIAL_TEXT: Record<string, string> = {
  Coloring: 'Play on a machine. Every other player’s items there are ruined and sent back.',
  'Color catcher': 'Play on a machine. Your items there ignore Coloring.',
  Bleach: 'Play on a machine. This wash runs backwards: light washes, dark is sent back.',
  'Wash net':
    'Play on a machine as you load. Underwear you load THIS TURN washes there even among other garments.',
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
 * Hand sort order, by how the reckoning treats things:
 *   shoes first (their own class, above the shade system)
 *   then the rest of the clothes, dark before light
 *   then linen: underwear, then blanket
 * Within a rank, dark sorts before light, then alphabetically by type.
 */
const SORT_RANK: Record<ItemType, number> = {
  shoes: 0,
  socks: 1,
  pants: 1,
  shirts: 1,
  hats: 1,
  underwear: 2,
  blanket: 3,
};

export function sortItems(st: GameState, ids: ItemId[]): ItemId[] {
  return [...ids].sort((a, b) => {
    const x = st.items[a];
    const y = st.items[b];
    if (SORT_RANK[x.type] !== SORT_RANK[y.type]) return SORT_RANK[x.type] - SORT_RANK[y.type];
    if (x.shade !== y.shade) return x.shade === 'D' ? -1 : 1;
    if (x.type !== y.type) return x.type < y.type ? -1 : 1;
    return 0;
  });
}

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
      '2. Event — the card drawn on the first 6 of the day resolves.',
      '3. Key — the keyholder turns one machine on, one off, or passes.',
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
      'The tier is chosen for the WHOLE machine, and it ignores who owns what.',
    ],
  },
  {
    heading: 'Filters on top of the ladder',
    lines: [
      'Crowding — 3 or more of the same garment type, any colour: all of them go back.',
      'Underwear washes only among underwear (unless a Wash net covers it).',
      'A blanket must be alone, except that socks may share with it.',
      'Socks washed beside a blanket come out DAMP: they need one more wash anywhere.',
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
      'You may play at most one ready card per turn, and it returns to the deck afterwards.',
      'Everything on the floor is public. Only your hand and your ready cards are private.',
    ],
  },
];

export function playerColorName(pid: PlayerId): string {
  return ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'][pid] ?? `P${pid + 1}`;
}
