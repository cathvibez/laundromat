/**
 * LINE DRAWINGS, in the same hand as everything else.
 *
 * The house style is cut paper: a flat fill, a 2px ink outline, no gradients and
 * no blur. These follow it, and they take their colour from `currentColor` so a
 * single CSS rule can tint one without a second copy of the file existing.
 *
 * They are drawn on a 24x24 grid with a 2px stroke, which is why the numbers are
 * all halves — a 2px line centred on a whole pixel straddles two of them and
 * comes out soft at the sizes these are used.
 *
 * Deliberately NOT in art.ts: that file maps to the printed art sheets and
 * returns null where a plate does not exist yet. These are interface furniture
 * and always render.
 */

interface IconProps {
  /** Rendered size in px. Everything scales from the 24-unit grid. */
  size?: number;
  className?: string;
}

/**
 * A front loader: body, control panel with two dials, and the porthole. The
 * porthole is the whole point — it is the shape that says "washing machine"
 * even at 16px, so it stays large relative to the body.
 */
export function WasherIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      className={`icon washer-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="2.5" width="18" height="19" rx="3" />
      <line x1="3" y1="8" x2="21" y2="8" />
      <circle cx="12" cy="15" r="4.2" />
      <circle cx="6.5" cy="5.25" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9.75" cy="5.25" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * A laundry basket: a tapered body with a weave, and a handle cut into each
 * side. The taper is what separates it from a box at small sizes.
 */
export function BasketIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      className={`icon basket-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* rim, then the tapered body */}
      <path d="M2.5 7.5 h19" />
      <path d="M4 7.5 L6 20.5 h12 L20 7.5" />
      {/* the weave */}
      <path d="M8.2 7.5 L9.2 20.5" />
      <path d="M12 7.5 v13" />
      <path d="M15.8 7.5 L14.8 20.5" />
      <path d="M5 13.5 h14" />
      {/* handles */}
      <path d="M4.6 10.5 h2.2" />
      <path d="M17.2 10.5 h2.2" />
    </svg>
  );
}

/**
 * A folded stack, for the clean pile. Three sheets, offset, so it reads as "more
 * than one" rather than "a card".
 */
export function FoldedStackIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      className={`icon stack-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="14.5" width="16" height="5.5" rx="1.6" />
      <rect x="5.5" y="9" width="13" height="5" rx="1.6" />
      <rect x="7" y="3.5" width="10" height="5" rx="1.6" />
    </svg>
  );
}

/**
 * A washer mid-cycle, for the reckoning.
 *
 * The clothes are a group rotating inside a clipped porthole, so they tumble
 * behind the glass rather than sliding out from under it — the clip is what
 * makes it read as a drum instead of a spinning sticker. The body rocks a
 * degree either way on a slightly different period from the drum, because two
 * motions that do not share a beat look mechanical and one shared beat looks
 * like a GIF.
 *
 * Colours come from the players whose clothes are actually in the machine, so
 * the animation is showing you your own laundry, not decoration.
 */
export function SpinningWasher({
  size = 96,
  colours = [],
  spinning = true,
  className,
}: {
  size?: number;
  /** CSS colours for the tumbling items, in load order. Up to five are drawn. */
  colours?: string[];
  spinning?: boolean;
  className?: string;
}) {
  const items = colours.slice(0, 5);
  // Spread whatever is in there evenly around the drum.
  const placed = items.map((c, i) => {
    const angle = (i / Math.max(items.length, 1)) * Math.PI * 2;
    return { c, x: 12 + Math.cos(angle) * 4.6, y: 15 + Math.sin(angle) * 4.6 };
  });

  return (
    <svg
      className={`spinner-washer${spinning ? ' spinning' : ''}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="drum-clip">
          <circle cx="12" cy="15" r="4.6" />
        </clipPath>
      </defs>

      <g className="washer-body" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <rect x="3" y="2.5" width="18" height="19" rx="3" fill="var(--card)" />
        <line x1="3" y1="8" x2="21" y2="8" />
        <circle cx="6.5" cy="5.25" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="9.75" cy="5.25" r="0.8" fill="currentColor" stroke="none" />

        {/* the glass */}
        <circle cx="12" cy="15" r="5.6" fill="var(--paper-2)" />

        <g clipPath="url(#drum-clip)">
          <circle cx="12" cy="15" r="4.6" fill="#eef4f7" stroke="none" />
          <g className="drum">
            {placed.map((p, i) => (
              <rect
                key={i}
                x={p.x - 1.5}
                y={p.y - 1.1}
                width="3"
                height="2.2"
                rx="0.8"
                fill={p.c}
                stroke="none"
              />
            ))}
          </g>
        </g>

        <circle cx="12" cy="15" r="4.6" />
      </g>
    </svg>
  );
}
