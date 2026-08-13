/**
 * ART MANIFEST — the single place that knows where card pictures come from.
 *
 * ============================ THE POINT OF THIS FILE ============================
 * No component may reference an image path. They ask for `garmentArt(item)` or
 * `specialArt(name)` and get back an `ArtSource`, which is either
 *
 *   - a SPRITE: one cell of a print sheet, cropped with background-position, or
 *   - a PLATE:  a standalone image file, drawn whole.
 *
 * Today every garment is a sprite cut out of the three COLOR GROUP print sheets,
 * because that cost nothing to set up. When the designer delivers individual
 * card PNGs, change ONLY this file — swap the sprite lookups for plate lookups
 * pointing at `art/cards/<id>.png` — and every component picks them up unchanged.
 *
 * Missing art is a first-class case, not a bug. `underwear` and `blanket` have no
 * illustrations yet, and three of the four events do not either. Those return
 * `null` and the Card component falls back to a typographic card. That fallback
 * is permanent infrastructure: it is also what renders if an image 404s.
 * ===============================================================================
 */

import type { ItemCard, ItemType, PlayerId, Shade, SpecialName } from '../rules/types';

export interface Sprite {
  /** Grid dimensions of the sheet. */
  cols: number;
  rows: number;
  /** Zero-based cell to show. */
  c: number;
  r: number;
}

export interface ArtSource {
  url: string;
  /** Absent means the file is a single card, drawn whole. */
  sprite?: Sprite;
}

// ---------------------------------------------------------------------------
// Player colour ↔ art sheet
// ---------------------------------------------------------------------------

/**
 * The six colours that exist in the artwork, in seat order. These are the names
 * the UI shows; `selectors.playerColorName` still returns the old engine names
 * and should be reconciled when the designer confirms the palette.
 */
export const ART_COLOR_NAMES = ['Purple', 'Tan', 'Blue', 'Orange', 'Green', 'Pink'] as const;

export const ART_COLOR_HEX: Record<number, { dark: string; light: string }> = {
  0: { dark: '#6E52A3', light: '#B9A7DA' }, // purple
  1: { dark: '#B0762E', light: '#D8C7A5' }, // tan
  2: { dark: '#3F6F90', light: '#A9C5D7' }, // blue
  3: { dark: '#F0642B', light: '#F4B9A1' }, // orange
  4: { dark: '#3F9C48', light: '#A9CFA8' }, // green
  5: { dark: '#E63A8B', light: '#F4A9C6' }, // pink
};

/** Which sheet a seat's colour lives on, and which row pair within it. */
const SHEET_OF_OWNER: Record<number, { url: string; darkRow: number }> = {
  0: { url: 'art/sheet1.jpg', darkRow: 0 }, // purple
  1: { url: 'art/sheet1.jpg', darkRow: 2 }, // tan
  2: { url: 'art/sheet2.jpg', darkRow: 0 }, // blue
  3: { url: 'art/sheet2.jpg', darkRow: 2 }, // orange
  4: { url: 'art/sheet3.jpg', darkRow: 0 }, // green
  5: { url: 'art/sheet3.jpg', darkRow: 2 }, // pink
};

/** Column within a sheet row. Underwear and blanket are not drawn yet. */
const COLUMN_OF_TYPE: Partial<Record<ItemType, number>> = {
  hats: 0,
  shirts: 1,
  pants: 2,
  socks: 3,
  shoes: 4,
};

export function garmentArt(owner: PlayerId, type: ItemType, shade: Shade): ArtSource | null {
  const sheet = SHEET_OF_OWNER[owner % 6];
  const col = COLUMN_OF_TYPE[type];
  if (!sheet || col === undefined) return null; // underwear, blanket — no art yet
  return {
    url: sheet.url,
    sprite: { cols: 5, rows: 4, c: col, r: sheet.darkRow + (shade === 'L' ? 1 : 0) },
  };
}

export function artForItem(item: ItemCard): ArtSource | null {
  return garmentArt(item.owner, item.type, item.shade);
}

// ---------------------------------------------------------------------------
// Special items and events
// ---------------------------------------------------------------------------

/**
 * `items.png` is a print sheet with a margin, so its cells are addressed in
 * source pixels rather than as an even grid. Kept as a sprite with an explicit
 * grid because the margin is small enough not to show at card size.
 */
const ITEMS_SHEET = 'art/items.png';

const SPECIAL_CELL: Partial<Record<SpecialName, { c: number; r: number }>> = {
  Bleach: { c: 0, r: 0 },
  Coloring: { c: 1, r: 0 },
  Sanitizer: { c: 2, r: 0 },
  'Wash net': { c: 3, r: 0 }, // displayed as "Mesh bag"
  'Color catcher': { c: 4, r: 0 },
  Snacc: { c: 0, r: 1 },
  Coin: { c: 1, r: 1 }, // drawn as "Laundry Token"
};

export function specialArt(name: SpecialName): ArtSource | null {
  const cell = SPECIAL_CELL[name];
  if (!cell) return null;
  return { url: ITEMS_SHEET, sprite: { cols: 5, rows: 2, c: cell.c, r: cell.r } };
}

/** Only Jimothy is drawn. Gang, Circuit break and Animal control are pending. */
export function eventArt(name: string): ArtSource | null {
  if (name !== 'Jimothy') return null;
  return { url: ITEMS_SHEET, sprite: { cols: 5, rows: 2, c: 2, r: 1 } };
}

// ---------------------------------------------------------------------------
// Turning an ArtSource into inline styles
// ---------------------------------------------------------------------------

/**
 * CSS for the picture layer. Sprites are positioned as a percentage of the
 * sheet, so they scale with the card and need no pixel measurements.
 */
export function artStyle(src: ArtSource | null): React.CSSProperties {
  if (!src) return {};
  if (!src.sprite) {
    return { backgroundImage: `url('${src.url}')`, backgroundSize: 'cover' };
  }
  const { cols, rows, c, r } = src.sprite;
  return {
    backgroundImage: `url('${src.url}')`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${(c / (cols - 1)) * 100}% ${(r / (rows - 1)) * 100}%`,
  };
}
