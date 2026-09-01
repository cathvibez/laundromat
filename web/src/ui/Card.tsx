/**
 * THE CARD — one component for every card the game shows.
 *
 * Everything that renders a garment, a special item or an event goes through
 * here, so the paper-cutout look is defined once. Where the picture comes from
 * is `art.ts`'s problem, not this file's; when real card PNGs arrive nothing
 * here changes.
 *
 * Missing art degrades to a typographic card rather than a hole. Every card in
 * the game has an illustration now, so that path is only reached when an image
 * 404s — which is exactly why it stays.
 *
 * ---------------------------------------------------------------------------
 * THE CARD IS THREE BANDS, AND THE PICTURE IS NOT ONE OF THE OTHER TWO.
 *
 * The name used to be an absolutely-positioned plate lying across the bottom of
 * the illustration. That was survivable while the pictures were placeholders and
 * stopped being survivable the day real art arrived: on the five sprite-sheet
 * garment types the cell is a full-bleed drawing and the plate ate its feet.
 *
 * So the card is a flex column now — owner rule, picture, name band — and the
 * only thing still drawn OVER the picture is the verdict stamp, which is
 * supposed to look stuck on top of it.
 *
 * The cost, stated plainly: `.pic` no longer has the card's 92:148 aspect, and
 * `artStyle`'s sprite maths sizes each sheet cell to the box it is painted in.
 * Sheet garments are therefore ~13% shorter than the printed cell. That is a
 * uniform squash on every sprite card at every size, which reads as a style;
 * a name plate across the shoes did not.
 *
 * ---------------------------------------------------------------------------
 * SHADE AND OWNER ARE TWO VARIABLES AND GET TWO MARKS.
 *
 * Both matter to the reckoning — the ladder is decided by shade, and whose item
 * it is decides who it can taint — and they used to share one 9px dot: filled
 * for dark, a hollow ring for light, tinted by owner either way. At the size the
 * drums use, a hollow ring sitting on top of a circular illustration reads as
 * two overlapping circles and neither variable survives.
 *
 *   owner — the coloured rule between the picture and the name. Full width, so
 *           it survives the 18px overlap the drum slots stack cards with, and
 *           it is a line rather than a shape, so it cannot be read as part of
 *           the art.
 *   shade — a square value chip at the head of the name band: solid ink for
 *           dark, paper for light. Value, not hue, and never a circle. The word
 *           beside it says the same thing wherever there is room for it, and
 *           `itemLabel` puts the shade FIRST so the truncation at 62px keeps it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ItemCard, ItemType, SpecialName } from '../rules/types';
import { EVENT_TEXT, SPECIAL_TEXT, cardName, itemLabel } from '../rules/selectors';
import { ART_COLOR_HEX, artForItem, artStyle, eventArt, specialArt } from './art';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

/** WASHES / BACK / DAMP, stamped across the face at reckoning time. */
/*
 * `tangled` was `damp` until v11.  The CSS CLASS is still `damp` — `.stamp.damp`
 * is asserted on in the UI tests and its amber is the right colour either way —
 * so only the word players read changed.  See stampClass below.
 */
export type Verdict = 'wash' | 'back' | 'tangled' | null;

/** The verdict's CSS class, which kept its old name on purpose. */
function stampClass(v: Exclude<Verdict, null>): string {
  return v === 'tangled' ? 'damp' : v;
}

interface GarmentProps {
  item: ItemCard;
  size?: CardSize;
  verdict?: Verdict;
  /**
   * True where the verdict is a FORECAST of tonight rather than what happened.
   * Draws the tag with a dotted edge, so a guess never looks like a result —
   * the washers are full of predictions that change as people load.
   */
  provisional?: boolean;
  /** Extra note under the name — "in the bag", "not committed". */
  note?: string;
  selected?: boolean;
  ghost?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  className?: string;
  /** Dragging is an ADDITION to clicking, never a replacement: HTML5 drag does
   *  nothing at all on touch, and this game's online client is a phone. */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  /**
   * Inert card: no detail view, no press handling. Set on the big card the
   * detail view itself draws, so inspecting a card cannot open another copy of
   * the thing you are already looking at.
   */
  plain?: boolean;
}

/** First letter up, rest untouched. */
function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Deterministic small rotation, so a row of cards never looks machine-set. */
function tiltOf(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const deg = ((Math.abs(h) % 7) - 3) * 0.55; // -1.65deg .. +1.65deg
  return `rotate(${deg.toFixed(2)}deg)`;
}

// ---------------------------------------------------------------------------
// Opening the detail view without stealing the gestures the game already owns
// ---------------------------------------------------------------------------

/**
 * WHY NOT A PLAIN CLICK.
 *
 * A click on a card already means three different things depending on where the
 * card is: pick it up out of the hand, choose it as the source of a roll-of-4
 * move, or — in a drum, where the item card does NOT stop propagation — click
 * the WASHER underneath it, which is how the keyholder toggles power and how an
 * event picks its target. There is no context in which a plain click is reliably
 * free, and a detail view that swallowed any one of those would be a worse bug
 * than the one it fixes.
 *
 * So the detail view is opened by a gesture the board has never used: a long
 * press, plus the right-click that means the same thing on a desktop. Both are
 * additive — the timer is cancelled by the movement that starts a drag and by
 * the pointerup that completes a click, and a press that DID open the detail
 * swallows exactly one following click so the card is not also picked up.
 *
 * That is not discoverable on its own, so cards big enough to show it also carry
 * an explicit ⓘ button in the name band (see `.card-i`); it stops propagation,
 * so it is the one place on a card that means only this. The 62px drum cards
 * have no room for it and rely on the press.
 */
const LONG_PRESS_MS = 420;
const PRESS_SLOP_PX = 8;

interface Press {
  open: boolean;
  show: () => void;
  close: () => void;
  /** Abandon a press in progress. Exposed so a card that also DRAGS can call it
   *  from its own `onDragStart` — spreading `handlers` cannot, because the
   *  caller's drag handler and the press's own would occupy the same prop. */
  cancel: () => void;
  handlers: Record<string, unknown>;
}

function usePress(enabled: boolean, onClick?: (e: React.MouseEvent) => void): Press {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  /** A press that opened the detail must eat the click that follows it. */
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  if (!enabled) {
    return { open: false, show, close, cancel, handlers: onClick ? { onClick } : {} };
  }

  return {
    open,
    show,
    close,
    cancel,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button > 0) return; // the right button arrives as oncontextmenu
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        cancel();
        timer.current = window.setTimeout(() => {
          timer.current = null;
          fired.current = true;
          setOpen(true);
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e: React.PointerEvent) => {
        const o = origin.current;
        if (!o || timer.current === null) return;
        if (Math.abs(e.clientX - o.x) > PRESS_SLOP_PX || Math.abs(e.clientY - o.y) > PRESS_SLOP_PX) {
          cancel();
        }
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onDragStart: cancel,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        cancel();
        fired.current = true;
        setOpen(true);
      },
      onClick: (e: React.MouseEvent) => {
        if (fired.current) {
          fired.current = false;
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        onClick?.(e);
      },
    },
  };
}

/** The ⓘ affordance, in the card's top-right corner. Absent at `s-xs`, which is
 *  62px wide in a drum and has room for nothing; the press covers it there. */
function InfoButton({ size, onOpen, label }: { size: CardSize; onOpen: () => void; label: string }) {
  if (size === 'xs') return null;
  return (
    <button
      type="button"
      className="card-i"
      aria-label={`What ${label} does`}
      title={`What ${label} does`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpen();
      }}
    >
      i
    </button>
  );
}

export function GarmentCard({
  item,
  size = 'sm',
  verdict = null,
  provisional,
  note,
  selected,
  ghost,
  onClick,
  title,
  className,
  draggable,
  onDragStart,
  onDragEnd,
  plain,
}: GarmentProps) {
  const art = artForItem(item);
  const hex = ART_COLOR_HEX[item.owner % 6];
  const label = itemLabel(item);
  /* `itemLabel` is lower case because it is written into sentences elsewhere.
     The card is not a sentence. */
  const press = usePress(!plain, onClick);

  const cls = [
    'gcard',
    'garment',
    `s-${size}`,
    selected ? 'selected' : '',
    ghost ? 'ghost' : '',
    onClick ? 'clickable' : '',
    art ? '' : 'noart',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      style={{ transform: tiltOf(item.id), ['--dotc' as string]: hex.dark }}
      title={title ?? label}
      role={onClick ? 'button' : undefined}
      {...press.handlers}
      /* AFTER the spread, and composed: `handlers` also owns onDragStart (a
         drag must abandon a press in flight) and a bare override would drop the
         caller's, which is what picks the card up. */
      draggable={draggable}
      onDragStart={(e) => {
        press.cancel();
        onDragStart?.(e);
      }}
      onDragEnd={onDragEnd}
    >
      {art ? (
        <div className="pic" style={artStyle(art)} />
      ) : (
        <div className="pic placeholder">
          <span>{label}</span>
          <small>art pending</small>
        </div>
      )}

      <div className="nm">
        <span className={`shd ${item.shade === 'D' ? 'd' : 'l'}`} aria-hidden="true" />
        <span className="nm-t">
          {sentence(label)}
          {note ? <em>{note}</em> : null}
        </span>
      </div>

      {!plain && <InfoButton size={size} onOpen={press.show} label={label} />}

      {verdict && (
        <span className={`stamp ${stampClass(verdict)}${provisional ? ' provisional' : ''}`}>
          {verdict === 'wash' ? 'Washed' : verdict === 'tangled' ? 'Tangled' : 'Back'}
        </span>
      )}

      {press.open && <GarmentDetail item={item} onClose={press.close} />}
    </div>
  );
}

interface SpecialProps {
  name: SpecialName;
  size?: CardSize;
  /** Drawn today and unplayable. */
  fresh?: boolean;
  owner?: number;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  plain?: boolean;
}

export function SpecialCard({
  name,
  size = 'sm',
  fresh,
  owner,
  selected,
  onClick,
  title,
  plain,
}: SpecialProps) {
  const art = specialArt(name);
  const label = cardName(name);
  const press = usePress(!plain, onClick);
  const cls = [
    'gcard',
    'special',
    `s-${size}`,
    fresh ? 'fresh' : '',
    selected ? 'selected' : '',
    onClick ? 'clickable' : '',
    art ? '' : 'noart',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      style={{ transform: tiltOf(name) }}
      title={title ?? label}
      role={onClick ? 'button' : undefined}
      {...press.handlers}
    >
      {art ? (
        <div className="pic" style={artStyle(art)} />
      ) : (
        <div className="pic placeholder">
          <span>{label}</span>
          <small>art pending</small>
        </div>
      )}
      <div className="nm">
        <span className="nm-t">
          {label}
          {owner !== undefined ? <em>P{owner + 1}</em> : null}
          {fresh ? <em>fresh — tomorrow</em> : null}
        </span>
      </div>

      {!plain && <InfoButton size={size} onOpen={press.show} label={label} />}

      {press.open && (
        <CardDetail
          onClose={press.close}
          title={label}
          kind={fresh ? 'Special item · drawn today, playable tomorrow' : 'Special item'}
          card={<SpecialCard name={name} size="lg" plain />}
        >
          <p>{SPECIAL_TEXT[name] ?? 'No rule text for this card.'}</p>
          <p className="cardx-note">
            One ready card per turn, and it goes back to the deck once it is played. A card drawn
            today cannot be played until tomorrow.
          </p>
        </CardDetail>
      )}
    </div>
  );
}

export function EventCard({
  name,
  size = 'md',
  plain,
}: {
  name: string;
  size?: CardSize;
  plain?: boolean;
}) {
  const art = eventArt(name);
  const press = usePress(!plain);
  return (
    <div className={`gcard event s-${size}${art ? '' : ' noart'}`} title={name} {...press.handlers}>
      {art ? (
        <div className="pic" style={artStyle(art)} />
      ) : (
        <div className="pic placeholder">
          <span>{name}</span>
          <small>art pending</small>
        </div>
      )}
      <div className="nm">
        <span className="nm-t">{name}</span>
      </div>

      {!plain && <InfoButton size={size} onOpen={press.show} label={name} />}

      {press.open && (
        <CardDetail
          onClose={press.close}
          title={name}
          kind="Event · happens to everyone"
          card={<EventCard name={name} size="lg" plain />}
        >
          <p>{EVENT_TEXT[name] ?? 'No rule text for this event.'}</p>
          <p className="cardx-note">
            Events are drawn on the first 6 of the day and resolve immediately, in the middle of
            that player's turn. Only one event a day.
          </p>
        </CardDetail>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The detail view
// ---------------------------------------------------------------------------

/**
 * The shell. It is a portal to `document.body` because cards live inside
 * `overflow: hidden` drums and horizontally scrolling item rows, and an overlay
 * rendered in place would be clipped by both.
 *
 * The class names are its own rather than the board's `.overlay`/`.modal`, which
 * several UI tests use as "is a confirmation up?". Inspecting a card is not a
 * confirmation and must not be mistaken for one.
 */
function CardDetail({
  title,
  kind,
  card,
  children,
  onClose,
}: {
  title: string;
  kind: string;
  card: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="cardx"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      /* A portal is still a child in the REACT tree, so every event in here
         bubbles back to the card that opened it. Stop all of them at the
         overlay or closing the detail also picks the card up. */
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="cardx-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cardx-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="cardx-art">{card}</div>
        <div className="cardx-body">
          <h2>{title}</h2>
          <p className="cardx-kind">{kind}</p>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * What a garment does in the reckoning.
 *
 * Every sentence below is a reading of `reckoning.ts` — the tier ladder in
 * `core`'s S2/S3, the `underwearIsolation`, `blanketExclusivity` and `crowding`
 * filters, the `ownItemsDontTaint` branch in `machineVerdicts`, and `willTangle`
 * in `selectors.ts`. It describes the game as `defaultConfig()` sets it up
 * (`ownItemsDontTaint: true`, `socksBlanketExtraWash: true`, `crowdThreshold: 3`,
 * `meshBagRule: 'guaranteed'`), which is the only way the app is ever played.
 * If one of those defaults moves, this text moves with it.
 */

const ORDINARY =
  'Ordinary clothing. It has no rule of its own: it washes when its shade wins the ladder and nothing above it is in the drum.';

const TYPE_NOTE: Record<ItemType, string> = {
  hats: ORDINARY,
  shirts: ORDINARY,
  pants: ORDINARY,
  socks: ORDINARY,
  shoes:
    'Shoes decide the whole washer. If a dark pair is in there, only dark shoes wash. If there is no dark pair but a light one, only light shoes wash. Either way every other garment in that washer goes back. A Sanitizer suspends it for one wash.',
  underwear:
    'Underwear washes only among underwear. One garment of any other type anywhere in the washer sends every piece of underwear back — it does not matter whose, or what the ladder said. A Mesh bag is the only exemption.',
  blanket:
    'A blanket wants the washer to itself and will share with at most one other item. Two blankets, or a blanket with two or more companions, and nothing in that washer washes at all. The companion is tangled: it does not wash and it stays in the drum for tomorrow. The blanket itself is never tangled.',
};

function shadeNote(item: ItemCard): string {
  if (item.type === 'shoes') {
    return item.shade === 'D'
      ? 'Dark, and shoes: the top of the ladder. They wash, and everything else in the washer goes back.'
      : 'Light, and shoes. They wash unless a dark pair is in the washer with them — and either way every non-shoe in there goes back.';
  }
  return item.shade === 'D'
    ? 'Dark. Against other players it washes when the washer holds no shoes at all: then every dark item washes and every light one goes back. Dark is the thing that taints light.'
    : 'Light. Against other players it washes only when the washer holds no shoes and nothing dark. It is the easiest thing in the game to spoil.';
}

function GarmentDetail({ item, onClose }: { item: ItemCard; onClose: () => void }) {
  const label = itemLabel(item);
  return (
    <CardDetail
      onClose={onClose}
      title={sentence(label)}
      kind={`Garment · Player ${item.owner + 1}'s, and only Player ${item.owner + 1} can wash it`}
      card={<GarmentCard item={item} size="lg" plain />}
    >
      <h3>The ladder</h3>
      <p className="cardx-note">Every washer that is on resolves at one rung, chosen like this:</p>
      <ol className="cardx-ladder">
        <li>Any dark shoes — dark shoes wash, everything else goes back.</li>
        <li>Otherwise any light shoes — light shoes wash, everything else goes back.</li>
        <li>Otherwise any dark item — all dark washes, light goes back.</li>
        <li>Light only — everything washes.</li>
      </ol>

      <h3>This one</h3>
      <p>{shadeNote(item)}</p>
      <p>{TYPE_NOTE[item.type]}</p>

      <h3>Your own items never taint each other</h3>
      <p>
        The ladder above is what OTHER players do to you. Among only your own items the order is
        shade-blind: shoes, then clothing and blanket, then underwear — your top category washes and
        the rest go back. Your dark shirt no longer stops your light one; your own shoes still stop
        both.
      </p>

      <h3>Whatever else is true</h3>
      <p className="cardx-note">
        Crowding: three or more items of the same type in one washer — any owner, any shade — and
        all of them go back. Coloring ruins every other player's items there. Bleach runs the wash
        backwards, light for dark. Anything in a Mesh bag washes regardless.
      </p>
    </CardDetail>
  );
}
