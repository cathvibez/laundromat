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
 * The five CLOTHING types are still sprites cut out of the three COLOR GROUP
 * print sheets. Everything else — underwear, blanket, the seven specials and the
 * four events — is a plate under `art/cards/`, cut from
 * `assets/LAUNDRY PRINT FILE.pdf` pages 4-7. That is exactly the swap this
 * header always anticipated, and it happened in this file alone.
 *
 * The plates are cropped to the ILLUSTRATION ONLY. The printed cards carry a
 * title above and rules text below; the app draws its own name band (`.nm`) and
 * writes its own rules elsewhere, so lifting the picture out and letting the
 * card supply the words is the only way the two do not fight. Each plate is
 * 248x400 on white — the 92:148 card aspect, so `background-size: cover` scales
 * it without cropping — with the picture placed between 10% and 80% of the
 * height, clear of the colour dot at the top left and the name band at the foot.
 *
 * `reciept.jpg` is cut from the same sheet and deliberately unreferenced. That
 * card is printed but has no rule in the engine — RECIEPT is the printed
 * spelling — and giving it one is a design decision, not a line in this file.
 *
 * Missing art is a first-class case, not a bug. Nothing returns `null` today,
 * but the Card component still falls back to a typographic card when something
 * does. That fallback is permanent infrastructure: it is also what renders if an
 * image 404s.
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

/** Column within a sheet row. The two LINEN types are plates, not sprites. */
const COLUMN_OF_TYPE: Partial<Record<ItemType, number>> = {
  hats: 0,
  shirts: 1,
  pants: 2,
  socks: 3,
  shoes: 4,
};

/**
 * Underwear and blanket were drawn later than the rest, one card per colour and
 * shade rather than gathered onto a sheet, so they are 24 plates named
 * `<type>-<colour>-<shade>`. The colour comes from `ART_COLOR_NAMES`, which is
 * the seat order the artwork itself uses.
 */
const PLATE_TYPES: ReadonlySet<ItemType> = new Set<ItemType>(['underwear', 'blanket']);

export function garmentArt(owner: PlayerId, type: ItemType, shade: Shade): ArtSource | null {
  const seat = owner % 6;
  if (PLATE_TYPES.has(type)) {
    const colour = ART_COLOR_NAMES[seat].toLowerCase();
    return { url: `art/cards/${type}-${colour}-${shade === 'L' ? 'l' : 'd'}.jpg` };
  }
  const sheet = SHEET_OF_OWNER[seat];
  const col = COLUMN_OF_TYPE[type];
  if (!sheet || col === undefined) return null;
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
 * The printed names and the engine's names diverged and are not going to be
 * reconciled — `sim/rules.py`, the fixtures and the save format all speak the
 * engine's. The file names follow the ENGINE, and the printed wording is
 * recorded here so the next person can find the card on the sheet.
 *
 * These replace the old `art/items.png` sprite sheet, which held rough versions
 * of the same seven items plus Jimothy on one uneven grid. It is still on disk;
 * nothing references it.
 */
const SPECIAL_PLATE: Record<SpecialName, string> = {
  Bleach: 'bleach', // "BLEACH"
  Coloring: 'coloring', // "DYE"
  Sanitizer: 'sanitizer', // "SANITIZER"
  'Wash net': 'wash-net', // "MESHBAG", displayed as "Mesh bag"
  'Color catcher': 'color-catcher', // "COLOR CATCHER"
  Snacc: 'snacc', // "SNACC"
  Coin: 'coin', // "LAUNDRY TOKEN"
  Coffee: 'coffee', // "COFFEE"
};

export function specialArt(name: SpecialName): ArtSource | null {
  const plate = SPECIAL_PLATE[name];
  if (!plate) return null;
  return { url: `art/cards/${plate}.jpg` };
}

const EVENT_PLATE: Record<string, string> = {
  Jimothy: 'jimothy', // "HERE COMES JIMOTHY!"
  'Circuit break': 'circuit-break', // "POWER OUTAGE!"
  Gang: 'gang', // "NEIGHBORHOOD SHOOTOUT!"
  'Animal control': 'animal-control', // "ANIMAL CONTROL!"
};

/** Takes a plain string: the log and the banner both hand it raw event names. */
export function eventArt(name: string): ArtSource | null {
  const plate = EVENT_PLATE[name];
  if (!plate) return null;
  return { url: `art/cards/${plate}.jpg` };
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
