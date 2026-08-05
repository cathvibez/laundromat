/**
 * Randomness abstraction.
 *
 * The rules library never calls Math.random.  In the app this is backed by
 * boardgame.io's RandomPlugin (server-authoritative and replayable); in tests it
 * is backed by the seeded implementation below.
 */

export interface Rng {
  /** Returns a NEW shuffled array. */
  shuffle<T>(items: T[]): T[];
  /** Uniform integer in [1, sides]. */
  die(sides: number): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
}

/** mulberry32 -- small, fast, adequate for tests and bot sweeps. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    int,
    die: (sides: number) => int(sides) + 1,
    shuffle<T>(items: T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
