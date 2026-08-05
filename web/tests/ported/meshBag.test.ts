/**
 * MESH BAG -- designer revision of the Wash net.
 *
 * "You can play the mesh bag after you roll, load clothes into the bag, and
 *  anything put into the bag gets washed if the washer is reckoned."
 *
 * These are NOT parity tests: sim/rules.py has no such rule. They pin the new
 * behaviour, and they pin that the old brief-v8 Wash net still works when
 * cfg.meshBagRule is 'v8net' -- which is what the 17,434 oracle fixtures run on.
 */

import { describe, expect, test } from 'vitest';
import { card as it_, id, rig, specs, toHand } from '../helpers';
import { machineVerdicts } from '../../src/rules/reckoning';
import type { CardsKey, ItemKey, ReckoningOpts } from '../../src/rules/reckoning';
import {
  applySpecial,
  beginTurn,
  loadItem,
  phaseReckon,
  rollDie,
} from '../../src/rules/phases';
import { seededRng } from '../../src/rules/rng';
import type { Rng } from '../../src/rules/rng';
import { cardName } from '../../src/rules/selectors';

const BAG: ReckoningOpts = {
  bleachKillsDark: false,
  sanitizerOwnerOnly: false,
  crowdThreshold: 3,
  meshBag: 'guaranteed',
};

function cards(net: string[], extra: Partial<CardsKey> = {}): CardsKey {
  return {
    bleached: false,
    coloringOwners: [],
    catcherOwners: [],
    netKeys: net,
    sanitizerOwners: [],
    ...extra,
  };
}

function washed(items: ReturnType<typeof it_>[], ck: CardsKey, opts = BAG): Set<string> {
  const v = machineVerdicts(items as ItemKey[], ck, opts);
  const out = new Set<string>();
  items.forEach((x, i) => {
    if (v[i]) out.add(x.id);
  });
  return out;
}

function fixedDie(face: number, base: Rng = seededRng(5)): Rng {
  return { ...base, die: () => face };
}

describe('Mesh bag — the card is displayed under its new name', () => {
  test('the internal id stays Wash net, the label is Mesh bag', () => {
    expect(cardName('Wash net')).toBe('Mesh bag');
    expect(cardName('Bleach')).toBe('Bleach');
  });
});

describe('Mesh bag — bagged items always wash', () => {
  test('M1 a bagged item beats the tier ladder outright', () => {
    // Dark shoes would normally send a light shirt back on tier 1.
    const shirt = it_('A-L-shirts');
    expect(washed([shirt, it_('B-D-shoes')], cards([shirt.id]))).toContain(id('A-L-shirts'));
  });

  test('M2 the whole bag washes even when its contents fight each other', () => {
    // Dark shoes + light shirt + dark pants: normally only the shoes wash.
    const a = it_('A-D-shoes');
    const b = it_('A-L-shirts');
    const c = it_('A-D-pants');
    expect(washed([a, b, c], cards([a.id, b.id, c.id]))).toEqual(
      specs('A-D-shoes', 'A-L-shirts', 'A-D-pants'),
    );
  });

  test('M3 a bagged item beats crowding', () => {
    const mine = it_('A-D-hats');
    const got = washed([mine, it_('B-D-hats'), it_('C-L-hats')], cards([mine.id]));
    expect(got).toEqual(specs('A-D-hats')); // the other two still crowd out
  });

  test('M4 a bagged item beats underwear isolation', () => {
    const u = it_('A-D-underwear');
    expect(washed([u, it_('B-D-shirts')], cards([u.id]))).toContain(id('A-D-underwear'));
  });

  test('M5 a bagged item beats blanket exclusivity', () => {
    const mine = it_('A-D-hats');
    expect(washed([mine, it_('B-D-blanket')], cards([mine.id]))).toContain(id('A-D-hats'));
  });

  test('M6 a bagged item beats Coloring', () => {
    const mine = it_('A-L-shirts');
    const ck = cards([mine.id], { coloringOwners: [1] });
    expect(washed([mine, it_('B-L-pants')], ck)).toContain(id('A-L-shirts'));
  });

  test('M7 the bag protects its contents, it does not remove them from the wash', () => {
    // A's dark shoes are bagged. They still put the machine on tier 1, so B's
    // light shirt is still sent back.
    const shoes = it_('A-D-shoes');
    const shirt = it_('B-L-shirts');
    expect(washed([shoes, shirt], cards([shoes.id]))).toEqual(specs('A-D-shoes'));
  });

  test('M8 unbagged items resolve exactly as they always did', () => {
    const bagged = it_('A-D-underwear');
    const got = washed([bagged, it_('B-D-shirts'), it_('C-L-hats')], cards([bagged.id]));
    // tier 3: B's dark shirt washes, C's light hat goes back, A's bagged underwear washes
    expect(got).toEqual(specs('A-D-underwear', 'B-D-shirts'));
  });

  test('M9 verdicts stay order-independent under the bag rule', () => {
    const base = [it_('A-D-shoes'), it_('B-L-socks'), it_('C-D-blanket')];
    const ck = cards([base[1].id]);
    const ref = washed(base, ck);
    const perms = [
      [base[0], base[2], base[1]],
      [base[1], base[0], base[2]],
      [base[2], base[1], base[0]],
    ];
    for (const p of perms) expect(washed(p, ck)).toEqual(ref);
  });
});

describe('Mesh bag — brief v8 Wash net is still available and unchanged', () => {
  const V8: ReckoningOpts = { ...BAG, meshBag: 'v8net' };

  test('M10 under v8net a bagged non-underwear item is not protected', () => {
    // Tier 1 still runs normally: the shoes wash, the listed shirt does not.
    const shirt = it_('A-L-shirts');
    expect(washed([shirt, it_('B-D-shoes')], cards([shirt.id]), V8)).toEqual(specs('B-D-shoes'));
  });

  test('M11 under v8net underwear is waived from isolation only, and loses to the ladder', () => {
    const u = it_('A-D-underwear');
    expect(washed([u, it_('B-L-shirts')], cards([u.id]), V8)).toEqual(specs('A-D-underwear'));
    expect(washed([u, it_('B-D-shoes')], cards([u.id]), V8)).toEqual(specs('B-D-shoes'));
  });

  test('M12 the default, used by every oracle fixture, is v8net', () => {
    const shirt = it_('A-L-shirts');
    const noOpts = machineVerdicts([shirt, it_('B-D-shoes')] as ItemKey[], cards([shirt.id]));
    expect([...noOpts]).toEqual([false, true]);
  });
});

describe('Mesh bag — membership is set at load time', () => {
  test('M13 everything loaded that turn into that machine goes in the bag', () => {
    const rg = rig(3);
    toHand(rg, 0, it_('A-D-shoes'));
    toHand(rg, 0, it_('A-L-shirts'));
    rg.st.players[0].ready = ['Wash net'];

    beginTurn(rg.st, 0);
    rollDie(rg.st, fixedDie(2, rg.rng));
    expect(rg.st.turn!.stage).toBe('card');
    applySpecial(rg.st, 0, 'Wash net', 0, rg.rng);
    rg.st.turn!.stage = 'load';

    loadItem(rg.st, 0, id('A-D-shoes'), 0, rg.rng);
    loadItem(rg.st, 0, id('A-L-shirts'), 0, rg.rng);

    expect(rg.st.machines[0].netProtected).toEqual([id('A-D-shoes'), id('A-L-shirts')]);

    // Both wash, despite the light shirt losing to the dark shoes on tier 1.
    phaseReckon(rg.st, rg.rng);
    expect(new Set(rg.st.players[0].clean)).toEqual(specs('A-D-shoes', 'A-L-shirts'));
  });

  test('M14 items already in the machine from earlier rounds are NOT in the bag', () => {
    const rg = rig(3);
    // Sitting there since yesterday.
    const stale = it_('A-L-shirts');
    rg.st.items[stale.id] = stale;
    rg.st.machines[0].items.push(stale.id);
    rg.st.players[0].mustWash.push(stale.id);

    toHand(rg, 0, it_('A-D-shoes'));
    beginTurn(rg.st, 0);
    rollDie(rg.st, fixedDie(1, rg.rng));
    applySpecial(rg.st, 0, 'Wash net', 0, rg.rng);
    rg.st.turn!.stage = 'load';
    loadItem(rg.st, 0, id('A-D-shoes'), 0, rg.rng);

    expect(rg.st.machines[0].netProtected).toEqual([id('A-D-shoes')]);
    phaseReckon(rg.st, rg.rng);
    // The bagged shoes wash; yesterday's shirt is sent back by tier 1.
    expect(new Set(rg.st.players[0].clean)).toEqual(specs('A-D-shoes'));
  });

  test('M15 the bag only covers the machine it was played on', () => {
    const rg = rig(3);
    toHand(rg, 0, it_('A-L-shirts'));
    beginTurn(rg.st, 0);
    rollDie(rg.st, fixedDie(1, rg.rng));
    applySpecial(rg.st, 0, 'Wash net', 0, rg.rng);
    rg.st.turn!.stage = 'load';
    loadItem(rg.st, 0, id('A-L-shirts'), 1, rg.rng); // different machine

    expect(rg.st.machines[1].netProtected).toEqual([]);
  });
});
