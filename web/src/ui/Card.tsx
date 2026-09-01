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
 */

import type { ItemCard, SpecialName } from '../rules/types';
import { cardName, itemLabel } from '../rules/selectors';
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
}

/** Deterministic small rotation, so a row of cards never looks machine-set. */
function tiltOf(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const deg = ((Math.abs(h) % 7) - 3) * 0.55; // -1.65deg .. +1.65deg
  return `rotate(${deg.toFixed(2)}deg)`;
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
}: GarmentProps) {
  const art = artForItem(item);
  const hex = ART_COLOR_HEX[item.owner % 6];
  const label = itemLabel(item);

  const cls = [
    'gcard',
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
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ transform: tiltOf(item.id), ['--dotc' as string]: hex.dark }}
      onClick={onClick}
      title={title ?? label}
      role={onClick ? 'button' : undefined}
    >
      {art ? (
        <div className="pic" style={artStyle(art)} />
      ) : (
        <div className="pic placeholder">
          <span>{label}</span>
          <small>art pending</small>
        </div>
      )}

      <span className={`dot ${item.shade === 'D' ? 'd' : 'l'}`} />

      <div className="nm">
        {label}
        {note ? <em>{note}</em> : null}
      </div>

      {verdict && (
        <span className={`stamp ${stampClass(verdict)}${provisional ? ' provisional' : ''}`}>
          {verdict === 'wash' ? 'Washed' : verdict === 'tangled' ? 'Tangled' : 'Back'}
        </span>
      )}
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
}

export function SpecialCard({
  name,
  size = 'sm',
  fresh,
  owner,
  selected,
  onClick,
  title,
}: SpecialProps) {
  const art = specialArt(name);
  const label = cardName(name);
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
      onClick={onClick}
      title={title ?? label}
      role={onClick ? 'button' : undefined}
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
        {label}
        {owner !== undefined ? <em>P{owner + 1}</em> : null}
        {fresh ? <em>fresh — tomorrow</em> : null}
      </div>
    </div>
  );
}

export function EventCard({ name, size = 'md' }: { name: string; size?: CardSize }) {
  const art = eventArt(name);
  return (
    <div className={`gcard event s-${size}${art ? '' : ' noart'}`} title={name}>
      {art ? (
        <div className="pic" style={artStyle(art)} />
      ) : (
        <div className="pic placeholder">
          <span>{name}</span>
          <small>art pending</small>
        </div>
      )}
      <div className="nm">{name}</div>
    </div>
  );
}
