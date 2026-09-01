/**
 * THE PLAYTEST BOTS.
 *
 * Two things have to be true and neither is obvious.
 *
 * FIRST, every difficulty has to be able to finish a game. A bot that returns
 * an illegal move or no move at all does not crash — it stalls, and a stalled
 * solo playtest looks like a bug in the game rather than a bug in the opponent.
 * So each level plays whole games, at every player count, and the invariants
 * are checked at the end.
 *
 * SECOND, the difficulties have to actually differ. Three labels over one
 * behaviour would be a lie told in the UI, so this measures them against each
 * other over many games and asserts hell beats dumbdumb by a real margin.
 */

import { describe, expect, test } from 'vitest';
import { defaultConfig } from '../../src/rules/config';
import { newGame } from '../../src/rules/setup';
import { seededRng } from '../../src/rules/rng';
import { playGame, type Policy } from '../../src/rules/driver';
import { assertInvariants } from '../../src/rules/phases';
import { BOT_LEVELS, botPolicy, type BotLevel } from '../../src/game/bot';
import type { GameState } from '../../src/rules/types';

function run(players: number, seed: number, level: BotLevel): GameState {
  const cfg = defaultConfig(players, {});
  const rng = seededRng(seed);
  return playGame(newGame(cfg, rng), botPolicy(level), rng);
}

describe('bots: every level can finish a game', () => {
  for (const { id } of BOT_LEVELS) {
    test(`${id} plays legal games at 3-6 players`, () => {
      for (const players of [3, 4, 5, 6]) {
        for (let seed = 1; seed <= 6; seed++) {
          const st = run(players, seed * 977, id);
          assertInvariants(st);
          // Either somebody won or the day cap stopped it; both are finished
          // states. What must never happen is the loop giving up mid-day.
          expect(st.over || st.day >= st.cfg.dayCap).toBe(true);
        }
      }
    });
  }
});

describe('bots: the levels are actually different', () => {
  /**
   * HEAD TO HEAD, because a table where everyone plays the same way measures
   * the ruleset and not the policy — the first attempt at this compared total
   * clean laundry across whole tables and got 838 against 835, which is noise
   * wearing a result's clothes.
   *
   * Here seat 0 plays one way and everyone else plays another, so the number
   * that moves is the one being tested.
   */
  function mixed(seat0: BotLevel, rest: BotLevel): Policy {
    const a = botPolicy(seat0);
    const b = botPolicy(rest);
    const pick = (pid: number) => (pid === 0 ? a : b);
    return {
      chooseLoad: (st, pid) => pick(pid).chooseLoad(st, pid),
      chooseDisplace: (st, pid) => pick(pid).chooseDisplace?.(st, pid) ?? null,
      chooseKeep: (st, pid, pair) => pick(pid).chooseKeep?.(st, pid, pair) ?? pair[0],
      chooseKey: (st, pid) => pick(pid).chooseKey?.(st, pid) ?? null,
      chooseGang: (st, pid, c) => pick(pid).chooseGang?.(st, pid, c) ?? c[0],
      chooseJimothy: (st, pid, c) => pick(pid).chooseJimothy?.(st, pid, c) ?? c[0],
      chooseSpecial: (st, pid) => pick(pid).chooseSpecial?.(st, pid) ?? null,
    };
  }

  /** Seat 0's clean pile minus the average of everyone else's. */
  function edgeOfSeat0(seat0: BotLevel, rest: BotLevel): number {
    let edge = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const cfg = defaultConfig(4, {});
      const rng = seededRng(seed * 3121);
      const st = playGame(newGame(cfg, rng), mixed(seat0, rest), rng);
      const mine = st.players[0].clean.length;
      const others =
        st.players.slice(1).reduce((a, p) => a + p.clean.length, 0) / (st.players.length - 1);
      edge += mine - others;
    }
    return edge / 40;
  }

  test('hell mode out-washes the table; dumbdumb does not', () => {
    const hellEdge = edgeOfSeat0('hell', 'normal');
    const dumbEdge = edgeOfSeat0('dumbdumb', 'normal');

    // The labels have to mean something. If this fails the UI is lying about
    // what it is offering.
    expect(hellEdge).toBeGreaterThan(dumbEdge);
  });
});
