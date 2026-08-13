/**
 * THE CARD — one component for every card the game shows.
 *
 * Everything that renders a garment, a special item or an event goes through
 * here, so the paper-cutout look is defined once. Where the picture comes from
 * is `art.ts`'s problem, not this file's; when real card PNGs arrive nothing
 * here changes.
 *
 * Missing art degrades to a typographic card rather than a hole. That path is
 * live today for underwear and blanket.
 */

import type { ItemCard, SpecialName } from '../rules/types';
import { cardName, itemLabel } from '../rules/selectors';
import { ART_COLOR_HEX, artForItem, artStyle, eventArt, specialArt } from './art';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

/** WASHES / BACK / DAMP, stamped across the face at reckoning time. */
export type Verdict = 'wash' | 'back' | 'damp' | null;

interface GarmentProps {
  item: ItemCard;
  size?: CardSize;
  verdict?: Verdict;
  /** Extra note under the name — "in the bag", "not committed". */
  note?: string;
  selected?: boolean;
  ghost?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  className?: string;
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
  note,
  selected,
  ghost,
  onClick,
  title,
  className,
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
      style={{ transform: tiltOf(item.id), ['--dotc' as string]: hex.dark }}
      onClick={onClick}
      title={title ?? label}
      role={onClick ? 'button' : undefined}
    >
      {art ? (
        <div className="pic" style={artStyle(art)} />
      ) : (
        <div className="pic placeholder">
          <span>{item.type === 'underwear' ? 'Underwear' : 'Blanket'}</span>
          <small>art pending</small>
        </div>
      )}

      <span className={`dot ${item.shade === 'D' ? 'd' : 'l'}`} />

      <div className="nm">
        {label}
        {note ? <em>{note}</em> : null}
      </div>

      {verdict && (
        <span className={`stamp ${verdict}`}>
          {verdict === 'wash' ? 'Washed' : verdict === 'damp' ? 'Damp' : 'Back'}
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
