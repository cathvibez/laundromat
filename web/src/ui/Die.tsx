/**
 * THE DIE, and the dock it sits in.
 *
 * Two things worth knowing before changing anything here.
 *
 * THE ANIMATION NEVER DECIDES THE NUMBER. The face is rolled by `rollDie()` in
 * rules/phases.ts, off the seeded Rng, and arrives here through `G.turn.face` —
 * online it has already been agreed by the server and every other client is
 * looking at it. So the tumble is a DELAY ON THE REVEAL and nothing else: it
 * spins through arbitrary faces for ~600ms, then shows the real one. If you are
 * ever tempted to make this component pick a number, the bug you will file
 * afterwards is "my die says 4 and my friend's says 6".
 *
 * The trigger is the `null -> N` transition on `face`, not the click, because
 * online the click and the answer are two different moments and only the second
 * one is the die landing.
 */

import { useEffect, useRef, useState } from 'react';

/** Pip positions on a 100x100 face, in reading order. */
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};

const TUMBLE_MS = 620;
const FLICKER_MS = 70;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function DieFace({ face }: { face: number }) {
  const pips = PIPS[face] ?? [];
  return (
    <svg className="die-face" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={8.5} />
      ))}
    </svg>
  );
}

export function Die({ face, rolling }: { face: number | null; rolling?: boolean }) {
  return (
    <div
      className={`die${rolling ? ' rolling' : ''}`}
      role="img"
      aria-label={face === null ? 'The die has not been rolled' : `Die showing ${face}`}
    >
      {face === null ? <span className="die-blank" aria-hidden="true" /> : <DieFace face={face} />}
    </div>
  );
}

export interface DieDockProps {
  /** The authoritative face from game state. `null` before the roll. */
  face: number | null;
  /** Whether THIS seat may roll right now. */
  canRoll: boolean;
  onRoll: () => void;
}

export function DieDock({ face, canRoll, onRoll }: DieDockProps) {
  const [shown, setShown] = useState<number | null>(face);
  const [rolling, setRolling] = useState(false);
  const prev = useRef<number | null>(face);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const wasNull = prev.current === null;
    prev.current = face;

    // Only a fresh roll animates. Arriving at a board mid-turn, or a re-render
    // with the same face, must not replay it.
    if (face === null || !wasNull) {
      setShown(face);
      return;
    }
    if (prefersReducedMotion()) {
      setShown(face);
      return;
    }

    setRolling(true);
    const flicker = window.setInterval(() => {
      setShown(1 + Math.floor(Math.random() * 6));
    }, FLICKER_MS);
    const settle = window.setTimeout(() => {
      window.clearInterval(flicker);
      setRolling(false);
      setShown(face); // the real one, always
    }, TUMBLE_MS);

    timers.current.push(flicker, settle);
    return () => {
      window.clearInterval(flicker);
      window.clearTimeout(settle);
    };
  }, [face]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => {
        window.clearInterval(t);
        window.clearTimeout(t);
      });
    },
    [],
  );

  return (
    <div className="die-dock">
      <Die face={shown} rolling={rolling} />
      {canRoll ? (
        <button className="primary roll-btn" onClick={onRoll}>
          Roll the die
        </button>
      ) : (
        <div className="die-caption">
          {face === null ? 'Waiting on the roll' : `Rolled ${face}`}
        </div>
      )}
    </div>
  );
}

export default DieDock;
