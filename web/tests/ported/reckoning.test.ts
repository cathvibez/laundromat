/**
 * Ported from sim/test_rules.py -- classes TableA, SocksAndBlankets, Sanitizer,
 * WashNet.  Test names are kept identical to the Python so a failure maps
 * one-to-one onto the oracle's suite.
 */

import { describe, expect, test } from 'vitest';
import { card as it_, resolve, specs } from '../helpers';
import { TYPE_NAMES, SPECIALS } from '../../src/rules/types';
import { machineVerdicts } from '../../src/rules/reckoning';

const bleach = [{ name: 'Bleach' as const, owner: 0 }];

describe('TableA', () => {
  test('A01 dark shoes taint everything', () => {
    expect(resolve([it_('A-D-shoes'), it_('B-L-shirts'), it_('C-D-pants')])).toEqual(
      specs('A-D-shoes'),
    );
  });

  test('A02 tier2 inversion', () => {
    expect(resolve([it_('A-L-shoes'), it_('B-D-shirts')])).toEqual(specs('A-L-shoes'));
  });

  test('A03 ordinary dark wins', () => {
    expect(resolve([it_('A-D-shirts'), it_('A-D-pants'), it_('B-L-hats')])).toEqual(
      specs('A-D-shirts', 'A-D-pants'),
    );
  });

  test('A04 light only', () => {
    expect(resolve([it_('A-L-shirts'), it_('B-L-pants')])).toEqual(
      specs('A-L-shirts', 'B-L-pants'),
    );
  });

  test('A05 blanket alone washes on tier3', () => {
    expect(resolve([it_('A-D-blanket')])).toEqual(specs('A-D-blanket'));
  });

  test('A06 solo underwear washes -- the solo-wash guarantee', () => {
    expect(resolve([it_('A-D-underwear')])).toEqual(specs('A-D-underwear'));
  });

  test('A09 crowding beats tier1 at capacity', () => {
    const items = [it_('A-D-shoes'), it_('B-D-shoes'), it_('C-D-shoes'), it_('D-L-shirts')];
    expect(items.length).toBe(4);
    expect(resolve(items)).toEqual(new Set());
  });

  test('A10 crowding is type only', () => {
    expect(resolve([it_('A-D-shirts'), it_('A-L-shirts'), it_('B-D-shirts')])).toEqual(new Set());
  });

  test('A10b alternative type plus shade reading would not fire', () => {
    const items = [it_('A-D-shirts'), it_('A-L-shirts'), it_('B-D-shirts')];
    const byTs = new Map<string, number>();
    for (const x of items) {
      const k = `${x.type}${x.shade}`;
      byTs.set(k, (byTs.get(k) ?? 0) + 1);
    }
    expect(Math.max(...byTs.values())).toBeLessThan(3);
  });

  test('A11 all underwear both dark', () => {
    expect(resolve([it_('A-D-underwear'), it_('B-D-underwear')])).toEqual(
      specs('A-D-underwear', 'B-D-underwear'),
    );
  });

  test('A12 shade precedence inside linen', () => {
    expect(resolve([it_('A-D-underwear'), it_('B-L-underwear')])).toEqual(specs('A-D-underwear'));
  });

  test('A13 self inflicted isolation', () => {
    expect(resolve([it_('A-D-underwear'), it_('A-D-shirts')])).toEqual(specs('A-D-shirts'));
  });

  test('A16 crowding applies to linen', () => {
    expect(
      resolve([it_('A-D-underwear'), it_('B-D-underwear'), it_('C-D-underwear')]),
    ).toEqual(new Set());
  });

  test('A17 bleach does not disarm shoes', () => {
    expect(resolve([it_('A-D-shoes'), it_('B-L-shirts')], { cards: bleach })).toEqual(
      specs('A-D-shoes'),
    );
  });

  test('A17b sensitivity bleach kills dark', () => {
    expect(
      resolve([it_('A-D-shoes'), it_('B-L-shirts')], { cards: bleach, bleachKillsDark: true }),
    ).toEqual(specs('B-L-shirts'));
  });

  test('A18 bleach is ownership blind', () => {
    expect(resolve([it_('A-D-shirts'), it_('B-L-shirts')], { cards: bleach })).toEqual(
      specs('B-L-shirts'),
    );
  });

  test('A19 bleach then crowding', () => {
    expect(
      resolve([it_('A-L-shoes'), it_('B-L-shoes'), it_('C-L-shoes')], { cards: bleach }),
    ).toEqual(new Set());
  });

  test('A20 coloring', () => {
    expect(
      resolve([it_('A-L-shirts'), it_('B-L-pants'), it_('C-L-hats')], {
        cards: [{ name: 'Coloring', owner: 0 }],
      }),
    ).toEqual(specs('A-L-shirts'));
  });

  test('A21 coloring plus catcher', () => {
    expect(
      resolve([it_('A-L-shirts'), it_('B-L-pants'), it_('C-L-hats')], {
        cards: [
          { name: 'Coloring', owner: 0 },
          { name: 'Color catcher', owner: 1 },
        ],
      }),
    ).toEqual(specs('A-L-shirts', 'B-L-pants'));
  });

  test('A22 two colorings total loss', () => {
    expect(
      resolve([it_('A-L-shirts'), it_('B-L-pants'), it_('C-L-hats')], {
        cards: [
          { name: 'Coloring', owner: 0 },
          { name: 'Coloring', owner: 1 },
        ],
      }),
    ).toEqual(new Set());
  });

  test('A23 full stack', () => {
    expect(
      resolve([it_('A-L-shirts'), it_('B-D-shoes')], {
        cards: [
          { name: 'Bleach', owner: 0 },
          { name: 'Coloring', owner: 0 },
          { name: 'Color catcher', owner: 1 },
        ],
      }),
    ).toEqual(specs('B-D-shoes'));
  });

  test('A27 four of a type still crowds', () => {
    expect(
      resolve([it_('A-D-hats'), it_('B-D-hats'), it_('C-L-hats'), it_('D-L-hats')]),
    ).toEqual(new Set());
  });

  test('A28 empty machine is noop', () => {
    expect(resolve([], { cards: bleach })).toEqual(new Set());
  });

  test('A void bedding type is gone', () => {
    expect(TYPE_NAMES).not.toContain('bedding');
    expect(TYPE_NAMES.length).toBe(7);
    expect(TYPE_NAMES.length * 2).toBe(14);
  });

  test('A void handwash basket is gone', () => {
    expect(SPECIALS as readonly string[]).not.toContain('Handwash basket');
  });
});

describe('SocksAndBlankets (reckoning half)', () => {
  test('S3 blanket plus socks resolves by the ladder', () => {
    expect(resolve([it_('A-D-blanket'), it_('B-L-socks')])).toEqual(specs('A-D-blanket'));
    expect(resolve([it_('A-D-blanket'), it_('B-D-socks')])).toEqual(
      specs('A-D-blanket', 'B-D-socks'),
    );
  });

  /*
   * REVISED v11.  S7 used to assert a blanket beside a non-sock was a total loss,
   * because a blanket admitted socks and nothing else.  A blanket now shares with
   * exactly one item of ANY type, and that pair is read on the ladder like any other
   * machine.  What happens to the companion afterwards — it tangles and stays in the
   * drum — is a day-level concern and deliberately invisible to this pure function.
   */
  test('S7 a blanket with one companion of any type is judged normally', () => {
    expect(resolve([it_('A-D-blanket'), it_('B-D-hats')])).toEqual(
      specs('A-D-blanket', 'B-D-hats'),
    );
  });

  /*
   * REVISED v11.  Was "three socks still crowd beside a blanket".  Placement should
   * never produce this board; the filter stays the defensive assert it always was and
   * simply guards a different boundary — more than one companion, rather than a
   * companion that is not socks.
   */
  test('S8 a blanket with two or more companions is a total loss', () => {
    expect(
      resolve([it_('A-D-blanket'), it_('A-D-socks'), it_('B-D-socks'), it_('C-D-socks')]),
    ).toEqual(new Set());
  });
});

describe('Sanitizer', () => {
  const san = (owner: number) => [{ name: 'Sanitizer' as const, owner }];

  test('N1 sanitizer suppresses tier1', () => {
    const items = [it_('A-D-shoes'), it_('B-L-shirts'), it_('C-D-pants')];
    expect(resolve(items)).toEqual(specs('A-D-shoes'));
    expect(resolve(items, { cards: san(1) })).toEqual(specs('A-D-shoes', 'C-D-pants'));
  });

  test('N2 sanitizer suppresses tier2', () => {
    const items = [it_('A-L-shoes'), it_('B-D-shirts')];
    expect(resolve(items)).toEqual(specs('A-L-shoes'));
    expect(resolve(items, { cards: san(1) })).toEqual(specs('B-D-shirts'));
  });

  test('N3 sanitizer does not waive any other rule', () => {
    expect(
      resolve([it_('A-D-shoes'), it_('B-D-shoes'), it_('C-D-shoes')], { cards: san(3) }),
    ).toEqual(new Set());
    expect(resolve([it_('A-D-underwear'), it_('B-D-shirts')], { cards: san(0) })).toEqual(
      specs('B-D-shirts'),
    );
    // blanket exclusivity still fires — v11 boundary: two companions, not a
    // companion that is not socks.
    expect(
      resolve([it_('A-D-blanket'), it_('B-D-hats'), it_('C-D-pants')], { cards: san(0) }),
    ).toEqual(new Set());
  });

  test('N4 sanitizer is a noop without shoes', () => {
    const items = [it_('A-D-shirts'), it_('B-L-pants')];
    expect(resolve(items, { cards: san(0) })).toEqual(resolve(items));
  });

  test('N5 light only machine with light shoes', () => {
    const items = [it_('A-L-shoes'), it_('B-L-hats')];
    expect(resolve(items)).toEqual(specs('A-L-shoes'));
    expect(resolve(items, { cards: san(1) })).toEqual(specs('A-L-shoes', 'B-L-hats'));
  });

  test('N6 owner only reading protects only the player', () => {
    const items = [it_('A-D-shoes'), it_('B-D-pants'), it_('C-D-hats')];
    expect(resolve(items, { cards: san(1), sanitizerOwnerOnly: true })).toEqual(
      specs('A-D-shoes', 'B-D-pants'),
    );
    expect(resolve(items, { cards: san(1) })).toEqual(
      specs('A-D-shoes', 'B-D-pants', 'C-D-hats'),
    );
  });

  test('N7 sanitizer interacts with bleach on shade only', () => {
    const items = [it_('A-D-shoes'), it_('B-L-shirts')];
    expect(
      resolve(items, {
        cards: [
          { name: 'Sanitizer', owner: 0 },
          { name: 'Bleach', owner: 0 },
        ],
      }),
    ).toEqual(specs('B-L-shirts'));
  });
});

describe('WashNet', () => {
  const net = [{ name: 'Wash net' as const, owner: 0 }];

  test('W1 net waives isolation for a protected card', () => {
    const u = it_('A-D-underwear');
    expect(resolve([u, it_('B-L-shirts')], { cards: net, net: [u.id] })).toEqual(
      specs('A-D-underwear'),
    );
  });

  test('W2 net does not protect underwear already in the machine', () => {
    expect(resolve([it_('A-D-underwear'), it_('B-L-shirts')], { cards: net })).toEqual(new Set());
  });

  test('W3 net does not beat the ladder', () => {
    const u = it_('A-D-underwear');
    expect(resolve([u, it_('B-D-shoes')], { cards: net, net: [u.id] })).toEqual(
      specs('B-D-shoes'),
    );
  });

  test('W4 protection is per card not per owner', () => {
    const u1 = it_('A-D-underwear');
    const u2 = it_('A-L-underwear');
    expect(resolve([u1, u2, it_('B-D-shirts')], { cards: net, net: [u1.id] })).toEqual(
      specs('A-D-underwear', 'B-D-shirts'),
    );
  });
});

describe('order independence', () => {
  function permutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const out: T[][] = [];
    arr.forEach((x, i) => {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of permutations(rest)) out.push([x, ...p]);
    });
    return out;
  }

  test('the verdict is a conjunction, so item order cannot matter', () => {
    const base = [it_('A-D-shirts'), it_('B-L-shirts'), it_('C-D-underwear'), it_('A-L-shirts')];
    const ref = resolve(base);
    for (const perm of permutations(base)) expect(resolve(perm)).toEqual(ref);
  });

  test('order independence holds with the new cards', () => {
    const base = [it_('A-D-shoes'), it_('B-L-socks'), it_('C-D-blanket')];
    const cards = [{ name: 'Sanitizer' as const, owner: 0 }];
    const ref = resolve(base, { cards });
    for (const perm of permutations(base)) expect(resolve(perm, { cards })).toEqual(ref);
  });

  test('machineVerdicts is pure', () => {
    const k = [it_('A-D-shoes'), it_('B-L-shirts')];
    const a = machineVerdicts(k);
    const b = machineVerdicts(k);
    expect(a).toEqual(b);
    expect([...a]).toEqual([true, false]);
  });
});
