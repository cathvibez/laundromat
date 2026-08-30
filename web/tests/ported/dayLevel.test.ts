/**
 * Ported from sim/test_rules.py -- classes SocksAndBlankets (placement half),
 * Gang, CircuitBreak, Jimothy, Coin, Victory, DeckAndTurn.
 */

import { describe, expect, test } from 'vitest';
import { card as it_, cleanOf, fire, handOf, id, put, rig, toHand } from '../helpers';
import { machineAccepts } from '../../src/rules/placement';
import {
  applySpecial,
  beginTurn,
  drawSpecialPair,
  keepSpecial,
  loadItem,
  loadBlocked,
  loadsOutstanding,
  moveJimothy,
  skipBlockedLoad,
  blockedDisplace,
  canBlockedDisplace,
  anyBlockedDisplacement,
  mustStillLoad,
  phaseEndOfDay,
  phaseReckon,
  playSpecial,
  rollDie,
  setPower,
  DICE,
} from '../../src/rules/phases';
import { defaultConfig, MACHINES_BY_PLAYERS, SPECIAL_DECK_TOTAL } from '../../src/rules/config';
import { newGame } from '../../src/rules/setup';
import { seededRng } from '../../src/rules/rng';
import { FIXED_EVENT_DECK } from '../../src/rules/types';
import type { Rng } from '../../src/rules/rng';

function fixedDie(face: number, base: Rng = seededRng(7)): Rng {
  return { ...base, die: () => face };
}

describe('SocksAndBlankets (placement, and socks stranded by a blanket)', () => {
  /*
   * REVISED v11.  A blanket is BIG: it shares with exactly ONE other item, of any
   * type except another blanket.  S1 used to assert "socks yes, hats no"; the type
   * no longer matters and the COUNT does.
   */
  test('S1 any single item may join a blanket machine, but only one', () => {
    const rg = rig();
    put(rg, 0, it_('A-D-blanket'));
    rg.st.items['1-socks-D'] = it_('B-D-socks');
    rg.st.items['1-hats-D'] = it_('B-D-hats');
    rg.st.items['1-blanket-D'] = it_('B-D-blanket');
    // Any type is welcome as the one companion — hats as much as socks.
    expect(machineAccepts(rg.st, 0, '1-socks-D')).toBe(true);
    expect(machineAccepts(rg.st, 0, '1-hats-D')).toBe(true);
    // A second blanket never is.
    expect(machineAccepts(rg.st, 0, '1-blanket-D')).toBe(false);

    // Once the blanket has its companion, the washer is closed to everything else.
    put(rg, 0, it_('B-D-hats'));
    rg.st.items['2-socks-D'] = it_('C-D-socks');
    expect(machineAccepts(rg.st, 0, '2-socks-D')).toBe(false);
  });

  /*
   * REVISED v11.  Both directions have to agree, because this predicate governs
   * loading and the roll-4 move identically: whichever half of the pair arrives
   * second, the answer must be the same.
   */
  test('S2 a blanket may join a machine holding at most one item', () => {
    const rg = rig();
    put(rg, 0, it_('A-D-socks'));
    rg.st.items['2-blanket-D'] = it_('C-D-blanket');
    expect(machineAccepts(rg.st, 0, '2-blanket-D')).toBe(true);

    // A hat is as good a companion as a sock, now.
    const rg2 = rig();
    put(rg2, 0, it_('A-D-hats'));
    rg2.st.items['1-blanket-D'] = it_('B-D-blanket');
    expect(machineAccepts(rg2.st, 0, '1-blanket-D')).toBe(true);

    // But not into a machine that already holds two things.
    const rg3 = rig();
    put(rg3, 0, it_('A-D-socks'));
    put(rg3, 0, it_('B-L-socks'));
    rg3.st.items['2-blanket-D'] = it_('C-D-blanket');
    expect(machineAccepts(rg3.st, 0, '2-blanket-D')).toBe(false);
  });

  /*
   * S4-S12 pin the v10 socks rule.  It replaced "washed beside a blanket, comes
   * out damp, needs a second wash somewhere" with "does not wash beside a
   * blanket, and stays in the machine until a night without one".  The ids are
   * kept because this suite is name-matched to sim/test_rules.py.
   */
  test('S4 socks beside a blanket do not wash and stay in the machine', () => {
    const rg = rig();
    const b = put(rg, 0, it_('A-D-blanket'));
    const s = put(rg, 0, it_('B-D-socks'));
    phaseReckon(rg.st, rg.rng);
    expect(cleanOf(rg, 0).has(b.id)).toBe(true);
    // The socks went nowhere: not clean, not in a hand, still in the drum.
    expect(cleanOf(rg, 1).has(s.id)).toBe(false);
    expect(handOf(rg, 1).has(s.id)).toBe(false);
    expect(rg.st.machines[0].items).toEqual([s.id]);
  });

  test('S5 socks left behind wash on a later night with no blanket', () => {
    const rg = rig();
    put(rg, 0, it_('A-D-blanket'));
    const s = put(rg, 0, it_('B-D-socks'));
    phaseReckon(rg.st, rg.rng); // blanket washes away, socks stay
    expect(rg.st.machines[0].items).toEqual([s.id]);

    phaseReckon(rg.st, rg.rng); // same machine, no blanket in it now
    expect(cleanOf(rg, 1).has(s.id)).toBe(true);
    expect(rg.st.machines[0].items).toEqual([]);
  });

  test('S6 socks without a blanket are clean in one wash', () => {
    const rg = rig();
    const s = put(rg, 0, it_('B-D-socks'));
    phaseReckon(rg.st, rg.rng);
    expect(cleanOf(rg, 1).has(s.id)).toBe(true);
  });

  test('S9 a blanket loaded in again strands the same socks again', () => {
    const rg = rig();
    put(rg, 0, it_('A-D-blanket'));
    const s = put(rg, 0, it_('B-D-socks'));
    phaseReckon(rg.st, rg.rng);
    expect(rg.st.machines[0].items).toEqual([s.id]);

    const b2 = put(rg, 0, it_('C-D-blanket'));
    phaseReckon(rg.st, rg.rng);
    expect(cleanOf(rg, 2).has(b2.id)).toBe(true);
    expect(rg.st.machines[0].items).toEqual([s.id]);
    expect(cleanOf(rg, 1).has(s.id)).toBe(false);
  });

  test('S10 stranded socks are ordinary contents: they take up room and crowd', () => {
    const rg = rig();
    put(rg, 0, it_('A-D-blanket'));
    const s = put(rg, 0, it_('B-D-socks'));
    phaseReckon(rg.st, rg.rng);
    expect(rg.st.machines[0].items).toEqual([s.id]);

    // They occupy a slot like anything else.
    expect(rg.st.machines[0].items.length).toBe(1);

    // And they count for crowding: a third pair sends all three back.
    put(rg, 0, it_('A-D-socks'));
    put(rg, 0, it_('C-D-socks'));
    phaseReckon(rg.st, rg.rng);
    expect(cleanOf(rg, 1).has(s.id)).toBe(false);
    expect(handOf(rg, 1).has(s.id)).toBe(true);
  });

  test('S11 socks the verdict SENDS BACK are not stranded — they go home', () => {
    const rg = rig();
    // A dark blanket beats light socks on the ladder, so the socks lose the
    // verdict.  Losing the verdict is not the same as being held by the
    // blanket, and only the latter keeps an item in the drum.
    put(rg, 0, it_('A-D-blanket'));
    const s = put(rg, 0, it_('B-L-socks'));
    phaseReckon(rg.st, rg.rng);
    expect(handOf(rg, 1).has(s.id)).toBe(true);
    expect(rg.st.machines[0].items).toEqual([]);
  });

  test('S12 the Gang frees socks stranded in the machine it destroys', () => {
    const rg = rig();
    put(rg, 0, it_('A-D-blanket'));
    const s = put(rg, 0, it_('B-D-socks'));
    phaseReckon(rg.st, rg.rng);
    expect(rg.st.machines[0].items).toEqual([s.id]);

    fire(rg, 'Gang', { machine: 0 });
    expect(handOf(rg, 1).has(s.id)).toBe(true);
    expect(rg.st.machines[0].dead).toBe(true);
    expect(rg.st.machines[0].items).toEqual([]);
  });
});

describe('Blocked loads (NEW v11)', () => {
  /*
   * "If you have no items in your hands to load, move 1 of your item from washer
   * to washer."  It is a substitute for the load, not a bonus, so it is available
   * only while blocked and it costs the whole remaining load.
   */
  function blockedRig() {
    const rg = rig(3);
    // Empty hand, one item of the player's own already in a washer, and a second
    // washer to move it to.
    rg.st.players[0].hand = [];
    put(rg, 0, it_('A-D-hats'));
    beginTurn(rg.st, 0);
    rg.st.turn!.face = 1;
    rg.st.turn!.loadsRequired = 1;
    rg.st.turn!.loadsDone = 0;
    rg.st.turn!.stage = 'load';
    return rg;
  }

  test('B1 an empty-handed player is blocked, and the move is offered', () => {
    const rg = blockedRig();
    expect(loadBlocked(rg.st)).toBe(true);
    expect(anyBlockedDisplacement(rg.st)).toBe(true);
  });

  test('B2 the move relocates the item and spends the load', () => {
    const rg = blockedRig();
    const ok = blockedDisplace(rg.st, 0, id('A-D-hats'), 1, rg.rng);
    expect(ok).toBe(true);
    expect(rg.st.machines[0].items).toEqual([]);
    expect(rg.st.machines[1].items).toEqual([id('A-D-hats')]);
    expect(loadsOutstanding(rg.st)).toBe(0);
  });

  test('B3 it is your OWN items only, unlike the roll of 4', () => {
    const rg = blockedRig();
    put(rg, 0, it_('B-D-pants'));
    expect(canBlockedDisplace(rg.st, 0, id('B-D-pants'), 1)).toBe(false);
    expect(canBlockedDisplace(rg.st, 0, id('A-D-hats'), 1)).toBe(true);
  });

  test('B4 skipping is refused while the move is available', () => {
    const rg = blockedRig();
    expect(skipBlockedLoad(rg.st, rg.rng)).toBe(false);
    expect(loadsOutstanding(rg.st)).toBe(1);
  });

  test('B5 skipping is allowed when there is nothing to move either', () => {
    const rg = rig(3);
    rg.st.players[0].hand = [];
    beginTurn(rg.st, 0);
    rg.st.turn!.face = 1;
    rg.st.turn!.loadsRequired = 1;
    rg.st.turn!.loadsDone = 0;
    rg.st.turn!.stage = 'load';
    expect(anyBlockedDisplacement(rg.st)).toBe(false);
    expect(skipBlockedLoad(rg.st, rg.rng)).toBe(true);
  });

  test('B6 a player who CAN load is not offered the move', () => {
    const rg = rig(3);
    toHand(rg, 0, it_('A-D-hats'));
    beginTurn(rg.st, 0);
    rg.st.turn!.face = 1;
    rg.st.turn!.loadsRequired = 1;
    rg.st.turn!.loadsDone = 0;
    rg.st.turn!.stage = 'load';
    expect(loadBlocked(rg.st)).toBe(false);
    expect(anyBlockedDisplacement(rg.st)).toBe(false);
  });
});

describe('Gang', () => {
  test('G1 gang destroys one machine and returns its contents', () => {
    const rg = rig();
    const a = put(rg, 1, it_('A-D-shirts'));
    const b = put(rg, 1, it_('B-L-pants'));
    const c = put(rg, 0, it_('C-D-hats'));
    fire(rg, 'Gang', { machine: 1 });
    expect(rg.st.machines[1].dead).toBe(true);
    expect(handOf(rg, 0).has(a.id)).toBe(true);
    expect(handOf(rg, 1).has(b.id)).toBe(true);
    expect(rg.st.machines[0].items).toContain(c.id);
    phaseReckon(rg.st, rg.rng);
    expect(cleanOf(rg, 2).has(c.id)).toBe(true);
  });

  test('G2 gang never returns to the deck', () => {
    const rg = rig();
    fire(rg, 'Gang', { machine: 0 });
    expect(rg.st.eventDeck).not.toContain('Gang');
    expect(rg.st.gangUsed).toBe(true);
  });

  test('G3 a dead machine accepts nothing and never reckons', () => {
    const rg = rig();
    fire(rg, 'Gang', { machine: 2 });
    rg.st.items['0-hats-D'] = it_('A-D-hats');
    expect(machineAccepts(rg.st, 2, '0-hats-D')).toBe(false);
    const results = phaseReckon(rg.st, rg.rng);
    expect(results.filter((r) => r.skipped === 'dead').length).toBe(1);
    expect(results.filter((r) => r.skipped !== 'dead').length).toBe(rg.st.machines.length - 1);
  });

  test('G4 gang may shoot jimothys machine', () => {
    const rg = rig();
    moveJimothy(rg.st, 0, rg.rng);
    const x = put(rg, 0, it_('A-D-hats'));
    fire(rg, 'Gang', { machine: 0, jimothyTo: 2 });

    expect(rg.st.machines[0].dead).toBe(true);
    expect(rg.st.machines.filter((m) => m.dead).length).toBe(1);
    expect(rg.st.machines[0].items).toEqual([]);
    expect(handOf(rg, 0).has(x.id)).toBe(true);
    expect(cleanOf(rg, 0).has(x.id)).toBe(false);
    expect(rg.st.jimothyAt).toBe(2);
    expect(rg.st.machines[2].jimothy).toBe(true);
    expect(rg.st.machines[0].jimothy).toBe(false);
    expect(rg.st.machines[2].dead).toBe(false);
  });

  test('G5 gang no longer wipes the board', () => {
    const rg = rig();
    for (let mi = 0; mi < 4; mi++) {
      put(rg, mi, mi === 0 ? it_('A-D-hats') : it_(`${'ABC'[mi % 3]}-D-pants`));
    }
    fire(rg, 'Gang', { machine: 3 });
    const alive = rg.st.machines.filter((m) => !m.dead).reduce((n, m) => n + m.items.length, 0);
    expect(alive).toBe(3);
  });
});

describe('CircuitBreak', () => {
  /*
   * C1/C2/C6 tested arms V2 and V3, which v10 deleted.  What replaced them is
   * one rule, and C5 below is now the whole of it: the night is cancelled and
   * NOTHING ELSE HAPPENS.  The property worth pinning hardest is the negative
   * one — no machine changes power — because that is exactly what the two
   * deleted arms did do, and it is the thing a future "fix" would reintroduce.
   */
  test('C1 a circuit break changes no machine\'s power, on or off', () => {
    const rg = rig();
    // One machine deliberately already off: it must still be off afterwards,
    // and must not be switched on by any restore logic either.
    setPower(rg.st, 1, false);
    fire(rg, 'Circuit break');
    expect(rg.st.machines[0].on).toBe(true);
    expect(rg.st.machines[1].on).toBe(false);
    expect(rg.st.machines.slice(2).every((m) => m.on)).toBe(true);
  });

  test('C3 circuit break returns to the deck', () => {
    const rg = rig();
    rg.st.eventDeck = ['Gang'];
    fire(rg, 'Circuit break');
    expect(rg.st.eventDeck).toContain('Circuit break');
  });

  test('C4 circuit break does not frighten jimothy', () => {
    const rg = rig();
    moveJimothy(rg.st, 0, rg.rng);
    fire(rg, 'Circuit break');
    expect(rg.st.jimothyAt).toBe(0);
  });

  test('C5 the blackout cancels tonight only, and tomorrow is normal', () => {
    const rg = rig();
    const x = put(rg, 0, it_('C-D-hats'));
    fire(rg, 'Circuit break');
    expect(rg.st.machines.every((m) => m.on)).toBe(true);
    const results = phaseReckon(rg.st, rg.rng);
    expect(results.every((r) => r.skipped === 'blackout')).toBe(true);
    expect(rg.st.machines[0].items).toContain(x.id);
    // and the very next day it reckons normally
    phaseReckon(rg.st, rg.rng);
    expect(cleanOf(rg, 2).has(x.id)).toBe(true);
  });

  test('C6 contents are kept, and there is nothing to restore afterwards', () => {
    const rg = rig();
    const x = put(rg, 0, it_('C-D-hats'));
    rg.st.day = 5;
    fire(rg, 'Circuit break');
    phaseReckon(rg.st, rg.rng);
    expect(rg.st.machines[0].items).toContain(x.id);
    // phaseEndOfDay used to restore power here under V3.  Nothing was ever
    // switched off, so there is nothing for it to do and the board is unchanged.
    phaseEndOfDay(rg.st);
    expect(rg.st.machines.every((m) => m.on)).toBe(true);
  });
});

describe('Jimothy', () => {
  test('J1 blocks loading and running and holds hostages', () => {
    const rg = rig();
    const x = put(rg, 0, it_('A-D-hats'));
    moveJimothy(rg.st, 0, rg.rng);
    rg.st.items['1-hats-D'] = it_('B-D-hats');
    expect(machineAccepts(rg.st, 0, '1-hats-D')).toBe(false);
    phaseReckon(rg.st, rg.rng);
    expect(rg.st.machines[0].items.length).toBe(1);
    expect(handOf(rg, 0).has(x.id)).toBe(false);
  });

  test('J2 snacc relocates him and releases hostages unwashed', () => {
    const rg = rig();
    const x = put(rg, 0, it_('A-D-hats'));
    rg.st.eventDeck = rg.st.eventDeck.filter((e) => e !== 'Jimothy');
    moveJimothy(rg.st, 0, rg.rng);
    applySpecial(rg.st, 1, 'Snacc', 1, rg.rng);
    expect(rg.st.jimothyAt).toBe(1);
    expect(handOf(rg, 0).has(x.id)).toBe(true);
    expect(cleanOf(rg, 0).size).toBe(0);
    expect(rg.st.eventDeck).not.toContain('Jimothy');
  });

  test('J3 only animal control removes him', () => {
    const rg = rig();
    moveJimothy(rg.st, 0, rg.rng);
    fire(rg, 'Animal control');
    expect(rg.st.jimothyAt).toBeNull();
    expect(rg.st.eventDeck).toContain('Jimothy');
  });

  test('J4 gang does not frighten him', () => {
    const rg = rig();
    moveJimothy(rg.st, 1, rg.rng);
    fire(rg, 'Gang', { machine: 0 });
    expect(rg.st.jimothyAt).toBe(1);
  });

  test('J5 animal control is a blank with no raccoon', () => {
    const rg = rig();
    fire(rg, 'Animal control');
    expect(rg.st.jimothyAt).toBeNull();
    expect(rg.st.log.some((l) => l.text.includes('no raccoon'))).toBe(true);
  });

  test('J6 he may sit on a blanket or a full machine', () => {
    const rg = rig();
    put(rg, 0, it_('A-D-blanket'));
    moveJimothy(rg.st, 0, rg.rng);
    phaseReckon(rg.st, rg.rng);
    expect(rg.st.machines[0].items.length).toBe(1);
  });

  test('J7 only one jimothy card exists', () => {
    expect(FIXED_EVENT_DECK.Jimothy).toBe(1);
    expect(Object.values(FIXED_EVENT_DECK).reduce((a, b) => a + b, 0)).toBe(4);
  });
});

describe('Coin', () => {
  test('K1 one shot coin toggles and recycles', () => {
    const rg = rig();
    rg.st.machines[2].on = false;
    const n = rg.st.specialDeck.length;
    applySpecial(rg.st, 0, 'Coin', { machine: 2, on: true }, rg.rng);
    expect(rg.st.machines[2].on).toBe(true);
    expect(rg.st.specialDeck.length).toBe(n + 1);
  });

  test('K2 coin is definitively a one shot', () => {
    const rg = rig();
    beginTurn(rg.st, 0);
    rg.st.turn!.stage = 'card';
    rg.st.players[0].ready = ['Coin'];
    rg.st.machines[1].on = false;
    const n = rg.st.specialDeck.length;
    playSpecial(rg.st, 0, 'Coin', { machine: 1, on: true }, rg.rng);
    expect(rg.st.players[0].ready).toEqual([]);
    expect(rg.st.specialDeck.length).toBe(n + 1);
    expect(rg.st.machines[1].on).toBe(true);
  });

  test('K3 coin cannot revive a dead machine', () => {
    const rg = rig();
    rg.st.machines[1].dead = true;
    rg.st.machines[1].on = false;
    applySpecial(rg.st, 0, 'Coin', { machine: 1, on: true }, rg.rng);
    expect(rg.st.machines[1].on).toBe(false);
  });
});

describe('Victory', () => {
  test('V1 victory is immediate', () => {
    const rg = rig();
    rg.st.day = 7;
    const p = rg.st.players[1];
    p.mustWash = ['1-hats-L'];
    p.clean = ['1-hats-L'];
    phaseEndOfDay(rg.st);
    expect(rg.st.over).toBe(true);
    expect(rg.st.winners).toEqual([1]);
  });

  /*
   * REVISED v11.  Was "simultaneous victory is allowed", and both finishers were
   * recorded as co-winners.  A tie now means NOBODY wins — the game is over and
   * the winners list is empty, which is a distinct ending rather than a bug.
   */
  test('V2 a tie means nobody wins', () => {
    const rg = rig();
    rg.st.day = 7;
    for (const pid of [0, 2]) {
      rg.st.players[pid].mustWash = [`${pid}-hats-L`];
      rg.st.players[pid].clean = [`${pid}-hats-L`];
    }
    phaseEndOfDay(rg.st);
    expect(rg.st.over).toBe(true);
    expect(rg.st.winners).toEqual([]);
  });

  test('V2b a lone finisher still wins outright', () => {
    const rg = rig();
    rg.st.day = 7;
    rg.st.players[1].mustWash = ['1-hats-L'];
    rg.st.players[1].clean = ['1-hats-L'];
    phaseEndOfDay(rg.st);
    expect(rg.st.over).toBe(true);
    expect(rg.st.winners).toEqual([1]);
  });

  test('V3 no rotation extension', () => {
    const rg = rig(4);
    rg.st.day = 1;
    rg.st.players[3].mustWash = ['3-hats-L'];
    rg.st.players[3].clean = ['3-hats-L'];
    phaseEndOfDay(rg.st);
    expect(rg.st.over).toBe(true);
  });
});

describe('DeckAndTurn', () => {
  test('D1 draw two keep one returns the other to the bottom', () => {
    const rg = rig();
    rg.st.specialDeck = ['Coloring', 'Bleach', 'Sanitizer'];
    beginTurn(rg.st, 0);
    rg.st.turn!.face = 5;
    rg.st.turn!.stage = 'extra';
    const pair = drawSpecialPair(rg.st);
    expect(new Set(pair)).toEqual(new Set(['Sanitizer', 'Bleach']));
    keepSpecial(rg.st, 'Bleach', rg.rng);
    expect(rg.st.players[0].fresh).toEqual(['Bleach']);
    expect(rg.st.specialDeck[0]).toBe('Sanitizer');
    expect(rg.st.specialDeck.length).toBe(2);
  });

  test('D2 single card deck draws one', () => {
    const rg = rig();
    rg.st.specialDeck = ['Coin'];
    beginTurn(rg.st, 0);
    rg.st.turn!.face = 5;
    rg.st.turn!.stage = 'extra';
    const pair = drawSpecialPair(rg.st);
    expect(pair).toEqual(['Coin']);
    keepSpecial(rg.st, 'Coin', rg.rng);
    expect(rg.st.players[0].fresh).toEqual(['Coin']);
    expect(rg.st.specialDeck).toEqual([]);
  });

  test('D3 empty deck is a noop', () => {
    const rg = rig();
    rg.st.specialDeck = [];
    beginTurn(rg.st, 0);
    rg.st.turn!.face = 5;
    rg.st.turn!.stage = 'extra';
    expect(drawSpecialPair(rg.st)).toEqual([]);
    expect(rg.st.players[0].fresh).toEqual([]);
  });

  test('D4 fresh cards cannot be played today', () => {
    const rg = rig();
    rg.st.players[0].fresh.push('Bleach');
    expect(rg.st.players[0].ready).toEqual([]);
    phaseEndOfDay(rg.st);
    expect(rg.st.players[0].ready).toEqual(['Bleach']);
    expect(rg.st.players[0].fresh).toEqual([]);
  });

  test('D5 the key passes at end of day', () => {
    const rg = rig();
    rg.st.key = 0;
    phaseEndOfDay(rg.st);
    expect(rg.st.key).toBe(1);
  });

  test('D6 dice expected loading is exactly one and a half', () => {
    const total = Object.values(DICE).reduce((n, d) => n + d.load, 0);
    expect(total / 6).toBeCloseTo(1.5);
  });

  test('D7 loading is mandatory: exactly the number rolled', () => {
    const rg = rig();
    toHand(rg, 0, it_('A-D-shirts'));
    toHand(rg, 0, it_('A-L-pants'));
    toHand(rg, 0, it_('A-D-hats'));
    beginTurn(rg.st, 0);
    rollDie(rg.st, fixedDie(3, rg.rng));
    expect(rg.st.turn!.loadsRequired).toBe(3);
    expect(rg.st.turn!.stage).toBe('load');
    expect(mustStillLoad(rg.st)).toBe(true);
    loadItem(rg.st, 0, '0-shirts-D', 0, rg.rng);
    expect(loadsOutstanding(rg.st)).toBe(2);
    expect(rg.st.turn!.stage).toBe('load');
    loadItem(rg.st, 0, '0-pants-L', 0, rg.rng);
    loadItem(rg.st, 0, '0-hats-D', 0, rg.rng);
    expect(loadsOutstanding(rg.st)).toBe(0);
    expect(rg.st.turn!.stage).toBe('done');
  });

  test('D7b a blocked player is parked at the load stage and must skip explicitly', () => {
    const rg = rig();
    beginTurn(rg.st, 0);
    rollDie(rg.st, fixedDie(2, rg.rng));
    // Empty hand: nothing can be loaded, so the turn waits rather than silently
    // moving on -- the player is shown that no washer will take anything.
    expect(rg.st.turn!.stage).toBe('load');
    expect(loadBlocked(rg.st)).toBe(true);
    expect(skipBlockedLoad(rg.st, rg.rng)).toBe(true);
    expect(rg.st.turn!.stage).toBe('done');
    expect(rg.st.turn!.loadsDone).toBe(0);
  });

  test('D7c skipping is refused while a legal load exists', () => {
    const rg = rig();
    toHand(rg, 0, it_('A-D-shirts'));
    beginTurn(rg.st, 0);
    rollDie(rg.st, fixedDie(1, rg.rng));
    expect(rg.st.turn!.stage).toBe('load');
    expect(loadBlocked(rg.st)).toBe(false);
    expect(skipBlockedLoad(rg.st, rg.rng)).toBe(false);
    expect(rg.st.turn!.stage).toBe('load');
  });

  test('D8 off machine retains contents and cards', () => {
    const rg = rig();
    put(rg, 0, it_('A-D-shoes'));
    put(rg, 0, it_('B-D-shoes'));
    rg.st.machines[0].cards.push({ name: 'Coloring', owner: 2 });
    rg.st.machines[0].on = false;
    phaseReckon(rg.st, rg.rng);
    expect(rg.st.machines[0].items.length).toBe(2);
    expect(rg.st.machines[0].cards).toEqual([{ name: 'Coloring', owner: 2 }]);
  });

  /*
   * REVISED v11.  Capacity was a flat 4; it now scales with the table, and so does
   * the number of items each player has to wash.
   */
  test('D9 machine count and capacity both scale with the table', () => {
    for (const p of [3, 4, 5, 6]) {
      expect(defaultConfig(p).machines).toBe(p + 1);
      expect(defaultConfig(p).capacity).toBe(p + 1);
      expect(MACHINES_BY_PLAYERS[p]).toBe(p + 1);
    }
    expect(defaultConfig(3).handSize).toBe(10);
    expect(defaultConfig(4).handSize).toBe(10);
    expect(defaultConfig(5).handSize).toBe(8);
    expect(defaultConfig(6).handSize).toBe(8);
  });

  /*
   * REVISED v11.  Was "capacity four blocks a fifth load"; at five players a washer
   * takes six, so it is the seventh that is refused.
   */
  test('D10 capacity blocks the load that overflows', () => {
    const rg = rig(5);
    expect(rg.st.cfg.capacity).toBe(6);
    // Six distinct cards out of four owners: shade makes A-D-hats and A-L-hats
    // different items.
    for (const spec of ['A-D-hats', 'B-D-hats', 'C-D-hats', 'D-D-hats', 'A-L-hats', 'B-L-hats']) {
      put(rg, 0, it_(spec));
    }
    rg.st.items['0-pants-L'] = it_('A-L-pants');
    expect(machineAccepts(rg.st, 0, '0-pants-L')).toBe(false);
    expect(machineAccepts(rg.st, 1, '0-pants-L')).toBe(true);
  });

  test('D11 opening hand is ten of fourteen', () => {
    const st = newGame(defaultConfig(4), seededRng(3));
    for (const p of st.players) {
      expect(p.hand.length).toBe(10);
      expect(p.mustWash.length).toBe(10);
    }
    expect(Object.keys(st.items).length).toBe(4 * 14);
  });

  test('D12 the special item deck is exactly 20 cards', () => {
    const cfg = defaultConfig(4);
    const total = Object.values(cfg.specialDeck).reduce((a, b) => a + b, 0);
    expect(total).toBe(SPECIAL_DECK_TOTAL);
    expect(total).toBe(20);
    const st = newGame(cfg, seededRng(1));
    expect(st.specialDeck.length).toBe(20);
  });

  test('D13 a deck that is not 20 cards is rejected at setup', () => {
    const cfg = defaultConfig(4, {
      specialDeck: { Coloring: 1, 'Color catcher': 1, Bleach: 1, 'Wash net': 1, Snacc: 1, Sanitizer: 1, Coin: 1 },
    });
    expect(() => newGame(cfg, seededRng(1))).toThrow(/exactly 20/);
  });
});
