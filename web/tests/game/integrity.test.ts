/**
 * Integrity properties, ported from sim/test_rules.py class Integrity.
 *
 * These cannot be seed-for-seed parity with Python (different RNG streams), so
 * they assert the same PROPERTIES over many self-played games instead.
 */

import { describe, expect, test } from 'vitest';
import { defaultConfig } from '../../src/rules/config';
import { newGame } from '../../src/rules/setup';
import { seededRng } from '../../src/rules/rng';
import { GreedyPolicy, playGame } from '../../src/rules/driver';
import { assertInvariants, isFinished } from '../../src/rules/phases';
import type { GameState } from '../../src/rules/types';

function run(players: number, seed: number, over = {}): GameState {
  const cfg = defaultConfig(players, over);
  const rng = seededRng(seed);
  const st = newGame(cfg, rng);
  return playGame(st, GreedyPolicy, rng);
}

describe('Integrity', () => {
  test('seed reproduces exactly', () => {
    for (const p of [3, 4, 5, 6]) {
      const a = run(p, 12345);
      const b = run(p, 12345);
      expect(a.day).toBe(b.day);
      expect(a.winners).toEqual(b.winners);
      expect(a.players.map((x) => x.clean.length)).toEqual(b.players.map((x) => x.clean.length));
    }
  });

  test('different seeds differ', () => {
    const a = run(4, 1);
    const b = run(4, 2);
    expect(a.day !== b.day || JSON.stringify(a.winners) !== JSON.stringify(b.winners)).toBe(true);
  });

  test('invariants hold over many games', () => {
    for (const p of [3, 6]) {
      for (let seed = 0; seed < 20; seed++) {
        const st = run(p, seed);
        assertInvariants(st);
      }
    }
  });

  test('games terminate with a winner', () => {
    for (const p of [3, 4, 5, 6]) {
      for (let seed = 0; seed < 12; seed++) {
        const st = run(p, seed);
        expect(st.over, `P=${p} seed=${seed} hit the day cap at day ${st.day}`).toBe(true);
        expect(st.winners.length).toBeGreaterThan(0);
      }
    }
  });

  test('no event outlives the turn that drew it', () => {
    // Every event resolves on draw (v10), so an unresolved one is visible as a
    // non-null G.revealedEvent once the roll phase is over.  It must never be:
    // drawEvent only draws while revealedEvent is null, so a survivor would
    // silently suppress every later event for the rest of the game.
    for (let seed = 0; seed < 8; seed++) {
      const st = run(4, seed);
      expect(st.revealedEvent).toBeNull();
    }
  });

  test('winners have everything clean', () => {
    for (let seed = 0; seed < 30; seed++) {
      const st = run(4, seed);
      for (const w of st.winners) {
        const p = st.players[w];
        expect(p.clean.length).toBe(10);
        expect(isFinished(p.clean, p.mustWash)).toBe(true);
      }
    }
  });

  test('no dead machine ever holds items, and gang fires at most once', () => {
    for (let seed = 0; seed < 40; seed++) {
      const st = run(5, seed);
      const dead = st.machines.filter((m) => m.dead);
      expect(dead.length).toBeLessThanOrEqual(1); // I-13: M decreases at most once
      for (const m of dead) expect(m.items).toEqual([]);
      // Gang never returns to the deck: once it has fired, it is gone for good.
      // If it never fired, exactly one copy is still waiting there.
      expect(st.eventDeck.filter((e) => e === 'Gang').length).toBe(st.gangUsed ? 0 : 1);
      expect(st.gangUsed).toBe(dead.length === 1);
    }
  });

  test('at most one raccoon, and never on a dead machine', () => {
    for (let seed = 0; seed < 25; seed++) {
      const st = run(4, seed);
      const jim = st.machines.filter((m) => m.jimothy);
      expect(jim.length).toBeLessThanOrEqual(1);
      for (const m of jim) expect(m.dead).toBe(false);
    }
  });

  test('clean piles only ever contain must-wash items', () => {
    for (let seed = 0; seed < 15; seed++) {
      const st = run(6, seed);
      for (const p of st.players) {
        const must = new Set(p.mustWash);
        for (const id of p.clean) expect(must.has(id)).toBe(true);
      }
    }
  });

  test('a full game can be played to victory -- smoke', () => {
    const st = run(4, 99);
    expect(st.over).toBe(true);
    expect(st.day).toBeGreaterThan(1);
    expect(st.winners.length).toBeGreaterThanOrEqual(1);
  });

  test('turnOrder extraLoadCard also terminates', () => {
    for (let seed = 0; seed < 5; seed++) {
      const st = run(4, seed, { turnOrder: 'extraLoadCard' });
      expect(st.over).toBe(true);
    }
  });
});
