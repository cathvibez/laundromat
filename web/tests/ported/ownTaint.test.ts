/**
 * OWN ITEMS NEVER TAINT OWN ITEMS -- designer revision.
 *
 * Among your own items, shade is irrelevant and a category ladder applies:
 *     shoes (D = L)  >  clothing and blanket (D = L)  >  underwear (D = L)
 * Other players still taint you exactly as brief v8 says they do.
 *
 * NOT parity tests: sim/rules.py has no such rule. They pin the new behaviour,
 * and pin that brief v8's machine-wide ladder is still what runs when the flag
 * is off -- which is what all 17,434 oracle fixtures use.
 */

import { describe, expect, test } from 'vitest';
import { card as it_, specs } from '../helpers';
import { machineVerdicts, emptyCardsKey } from '../../src/rules/reckoning';
import type { CardsKey, ItemKey, ReckoningOpts } from '../../src/rules/reckoning';

const OWN: ReckoningOpts = {
  bleachKillsDark: false,
  sanitizerOwnerOnly: false,
  crowdThreshold: 3,
  ownItemsDontTaint: true,
};
const V8: ReckoningOpts = { ...OWN, ownItemsDontTaint: false };

function washed(
  items: ReturnType<typeof it_>[],
  opts = OWN,
  ck: CardsKey = emptyCardsKey(),
): Set<string> {
  const v = machineVerdicts(items as ItemKey[], ck, opts);
  const out = new Set<string>();
  items.forEach((x, i) => {
    if (v[i]) out.add(x.id);
  });
  return out;
}

describe('shade is irrelevant among your own items', () => {
  test('O1 your own dark shirt no longer stops your own light shirt', () => {
    const items = [it_('A-D-shirts'), it_('A-L-shirts')];
    expect(washed(items, V8)).toEqual(specs('A-D-shirts')); // brief v8
    expect(washed(items)).toEqual(specs('A-D-shirts', 'A-L-shirts'));
  });

  test('O2 dark shoes and light shoes are equals', () => {
    expect(washed([it_('A-D-shoes'), it_('A-L-shoes')])).toEqual(
      specs('A-D-shoes', 'A-L-shoes'),
    );
  });

  test('O3 a whole hand of your own clothing washes together', () => {
    const items = [it_('A-D-shirts'), it_('A-L-pants'), it_('A-D-hats'), it_('A-L-socks')];
    expect(washed(items)).toEqual(specs('A-D-shirts', 'A-L-pants', 'A-D-hats', 'A-L-socks'));
  });
});

describe('but category still ranks your own items', () => {
  test('O4 your own shoes still stop your own clothing, either shade', () => {
    expect(washed([it_('A-D-shoes'), it_('A-L-shirts')])).toEqual(specs('A-D-shoes'));
    expect(washed([it_('A-L-shoes'), it_('A-D-shirts')])).toEqual(specs('A-L-shoes'));
  });

  test('O5 your own clothing still stops your own underwear', () => {
    expect(washed([it_('A-D-shirts'), it_('A-L-underwear')])).toEqual(specs('A-D-shirts'));
  });

  test('O6 your own shoes stop your own underwear too', () => {
    expect(washed([it_('A-L-shoes'), it_('A-D-underwear')])).toEqual(specs('A-L-shoes'));
  });

  test('O7 a blanket ranks with clothing, not with underwear', () => {
    // Blanket plus socks is the one legal mix, and both are the top category.
    expect(washed([it_('A-L-blanket'), it_('A-D-socks')])).toEqual(
      specs('A-L-blanket', 'A-D-socks'),
    );
  });

  test('O8 underwear alone washes, being your top category', () => {
    expect(washed([it_('A-D-underwear'), it_('A-L-underwear')])).toEqual(
      specs('A-D-underwear', 'A-L-underwear'),
    );
  });
});

describe('other players still taint you exactly as before', () => {
  test('O9 an opponent dark item still sends your light item back', () => {
    expect(washed([it_('A-L-shirts'), it_('B-D-pants')])).toEqual(specs('B-D-pants'));
  });

  test('O10 an opponent dark shoe still ruins the room', () => {
    expect(washed([it_('A-L-shirts'), it_('A-D-pants'), it_('B-D-shoes')])).toEqual(
      specs('B-D-shoes'),
    );
  });

  test('O11 your shoes still taint everyone else', () => {
    expect(washed([it_('A-D-shoes'), it_('B-L-shirts'), it_('C-D-pants')])).toEqual(
      specs('A-D-shoes'),
    );
  });

  test('O12 the classic A01 row is unchanged for the tainted players', () => {
    const items = [it_('A-D-shoes'), it_('B-L-shirts'), it_('C-D-pants')];
    expect(washed(items, V8)).toEqual(specs('A-D-shoes'));
    expect(washed(items)).toEqual(specs('A-D-shoes'));
  });

  test('O13 your own pair survives an opponent of the same shade', () => {
    // B's dark pants set tier 3 for the machine. A's dark shirt matches it, and
    // A's light shirt is judged without A's dark shirt present -- but B's dark
    // pants are still there, so the light shirt still loses. Opponents bite.
    expect(washed([it_('A-D-shirts'), it_('A-L-shirts'), it_('B-D-pants')])).toEqual(
      specs('A-D-shirts', 'B-D-pants'),
    );
  });
});

describe('interaction with the rest of the chain', () => {
  test('O14 Sanitizer collapses shoes into clothing on your own ladder too', () => {
    const items = [it_('A-D-shoes'), it_('A-L-shirts')];
    expect(washed(items)).toEqual(specs('A-D-shoes'));
    expect(washed(items, OWN, { ...emptyCardsKey(), sanitizerOwners: [1] })).toEqual(
      specs('A-D-shoes', 'A-L-shirts'),
    );
  });

  test('O15 Bleach cannot touch the own-item ladder, which is shade-blind', () => {
    const items = [it_('A-D-shoes'), it_('A-L-shirts')];
    const bleached: CardsKey = { ...emptyCardsKey(), bleached: true };
    expect(washed(items, OWN, bleached)).toEqual(specs('A-D-shoes'));
  });

  test('O16 Coloring still ruins you, since it is about ownership not shade', () => {
    // B plays Coloring. Everything is light, so tier 4 would wash the lot;
    // instead only B's own item survives.
    const ck: CardsKey = { ...emptyCardsKey(), coloringOwners: [1] };
    expect(washed([it_('A-L-shirts'), it_('A-L-pants'), it_('B-L-hats')], OWN, ck)).toEqual(
      specs('B-L-hats'),
    );
  });

  test('O17 your own items no longer crowd you', () => {
    // Three shirts, two of them A's. Under brief v8 crowding sends all three
    // back. Under the revision each of A's shirts sees only B's one shirt
    // beside it, so no crowd fires for A. B's light shirt loses to tier 3.
    const items = [it_('A-D-shirts'), it_('A-L-shirts'), it_('B-L-shirts')];
    expect(washed(items, V8)).toEqual(new Set());
    expect(washed(items)).toEqual(specs('A-D-shirts', 'A-L-shirts'));
  });

  test('O18 but your items still crowd an opponent', () => {
    // B's dark shirt matches tier 3 and would wash, but it sees A's two shirts
    // beside it, which is three of a type, so crowding still takes it.
    // A's light shirt is taken by tier 3 instead -- B's dark shirt is an
    // opponent's item and still taints normally.
    const items = [it_('A-D-shirts'), it_('A-L-shirts'), it_('B-D-shirts')];
    expect(washed(items)).toEqual(specs('A-D-shirts'));
  });

  test('O19 the mesh bag still overrides everything, including your own ladder', () => {
    const shoes = it_('A-D-shoes');
    const shirt = it_('A-L-shirts');
    // Without the bag the shoes stop the shirt.
    expect(washed([shoes, shirt])).toEqual(specs('A-D-shoes'));
    // Bag the shirt and it washes anyway.
    const ck: CardsKey = { ...emptyCardsKey(), netKeys: [shirt.id] };
    expect(washed([shoes, shirt], { ...OWN, meshBag: 'guaranteed' }, ck)).toEqual(
      specs('A-D-shoes', 'A-L-shirts'),
    );
  });

  test('O20 verdicts stay order-independent', () => {
    const base = [it_('A-D-shirts'), it_('A-L-shirts'), it_('B-D-pants'), it_('C-L-hats')];
    const ref = washed(base);
    const perms = [
      [base[3], base[2], base[1], base[0]],
      [base[1], base[3], base[0], base[2]],
      [base[2], base[0], base[3], base[1]],
    ];
    for (const p of perms) expect(washed(p)).toEqual(ref);
  });

  test('O21 the default, used by every oracle fixture, is brief v8', () => {
    const items = [it_('A-D-shirts'), it_('A-L-shirts')];
    const v = machineVerdicts(items as ItemKey[], emptyCardsKey());
    expect([...v]).toEqual([true, false]);
  });
});
