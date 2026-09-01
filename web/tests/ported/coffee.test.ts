/**
 * COFFEE — the only card that reaches into a pile somebody already won.
 *
 * Every other special acts on a machine. This one takes a washed item off
 * another player and hands it back dirty, which makes it the only way a
 * player's progress goes DOWN. That is worth pinning precisely: the win check
 * reads the clean pile, so a card that shrinks it can un-win a game if it is
 * wrong about which pile it touched.
 */

import { describe, expect, test } from 'vitest';
import { defaultConfig } from '../../src/rules/config';
import { newGame } from '../../src/rules/setup';
import { seededRng } from '../../src/rules/rng';
import { applySpecial, canPlaySpecial, coffeeTargets } from '../../src/rules/phases';
import type { GameState } from '../../src/rules/types';

function game(): GameState {
  const cfg = defaultConfig(4, {});
  return newGame(cfg, seededRng(7));
}

describe('Coffee', () => {
  test('takes a washed item off another player and returns it to their hand, dirty', () => {
    const st = game();
    const victim = 1;
    // Give the victim something washed to lose.
    const washed = st.players[victim].mustWash[0];
    st.players[victim].clean.push(washed);
    const handBefore = st.players[victim].hand.length;

    applySpecial(st, 0, 'Coffee', { player: victim, item: washed }, seededRng(1));

    expect(st.players[victim].clean).not.toContain(washed);
    expect(st.players[victim].hand).toContain(washed);
    expect(st.players[victim].hand.length).toBe(handBefore + 1);
  });

  test('progress can go backwards, which nothing else in the game does', () => {
    const st = game();
    const victim = 2;
    st.players[victim].clean.push(st.players[victim].mustWash[0]);
    st.players[victim].clean.push(st.players[victim].mustWash[1]);
    const before = st.players[victim].clean.length;

    applySpecial(
      st,
      0,
      'Coffee',
      { player: victim, item: st.players[victim].clean[0] },
      seededRng(1),
    );
    expect(st.players[victim].clean.length).toBe(before - 1);
  });

  test('your own laundry is safe from your own coffee', () => {
    const st = game();
    st.players[0].clean.push(st.players[0].mustWash[0]);
    const targets = coffeeTargets(st, 0);
    expect(targets.some((t) => t.player === 0)).toBe(false);
  });

  test('it cannot be played when nobody else has washed anything', () => {
    const st = game();
    st.turn = {
      player: 0,
      face: 3,
      stage: 'card',
      loadsRequired: 0,
      loadsDone: 0,
      cardPlayed: false,
      pendingDraw: null,
      pendingEvent: false,
      netTurn: null,
    } as GameState['turn'];
    st.players[0].ready.push('Coffee');

    // Nobody has a clean pile yet.
    expect(canPlaySpecial(st, 0, 'Coffee')).toBe(false);

    // Give somebody else one washed item and it becomes playable.
    st.players[1].clean.push(st.players[1].mustWash[0]);
    expect(canPlaySpecial(st, 0, 'Coffee')).toBe(true);
  });

  test('refuses an item that is not actually in that pile', () => {
    const st = game();
    expect(() =>
      applySpecial(st, 0, 'Coffee', { player: 1, item: st.players[1].mustWash[0] }, seededRng(1)),
    ).toThrow(/not in player/);
  });

  test('the deck is still exactly 20 cards', () => {
    const st = game();
    // newGame asserts this itself, so reaching here is most of the test; the
    // count is spelled out so a future edit that unbalances it fails loudly.
    const total = Object.values(st.cfg.specialDeck).reduce((a, b) => a + b, 0);
    expect(total).toBe(20);
  });
});
