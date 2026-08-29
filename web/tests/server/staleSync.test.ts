/**
 * A stale client must not be able to kill the server.
 *
 * THE INCIDENT THIS PINS DOWN. Rooms and matches live in memory, so a redeploy
 * empties them while browser tabs are still holding `{code, playerID,
 * credentials}` in localStorage and reconnecting. boardgame.io's `Master.onSync`
 * creates a match on demand when it does not recognise a matchID, using the
 * numPlayers the CLIENT sent — which `createMatch` defaults to 2. `setup` then
 * called `defaultConfig(2)`, which threw, inside an async socket handler. Node
 * turns that into an unhandled rejection and exits. The client reconnected and
 * did it again; Fly logged "machine has reached its max restart count of 10".
 *
 * One abandoned tab could hold the whole server down. These tests are the
 * regression net, and they assert the two halves separately: the game refuses
 * the bogus player count, and the process survives being asked.
 */

import { describe, expect, it } from 'vitest';
import { createMatch } from 'boardgame.io/internal';
import { Laundromat } from '../../src/game/Laundromat';
import { startHarness } from './harness';

/*
 * Only the last test binds a port. The rest are pure, deliberately: this is the
 * regression net for an outage, and it should still run in a sandbox that
 * refuses `listen` (where the other two tests/server/ suites fail with EPERM —
 * the environment, not the code).
 */
describe('a sync for a match the server does not have', () => {
  /*
   * The unit-level heart of it. This is the EXACT call boardgame.io makes on
   * the on-demand path — same helper, same defaulted player count — so if this
   * ever throws again rather than returning an error, the server is one stale
   * tab away from dying, whatever the socket tests say.
   */
  it('does not throw when boardgame.io auto-creates a match with its default 2 players', () => {
    expect(() =>
      createMatch({
        game: Laundromat,
        numPlayers: 2,
        setupData: undefined,
        unlisted: true,
      }),
    ).not.toThrow();
  });

  it('reports the bad player count instead of building an impossible game', () => {
    const match = createMatch({
      game: Laundromat,
      numPlayers: 2,
      setupData: undefined,
      unlisted: true,
    }) as { setupDataError?: string };

    expect(match.setupDataError).toMatch(/3-6/);
  });

  /*
   * `numPlayers` arrives off the wire, so it is not necessarily a sane integer.
   * Each of these reached `defaultConfig` unchecked before validateSetupData
   * existed.
   */
  it.each([0, 1, 2, 7, 100, -1, 3.5, NaN])(
    'refuses numPlayers = %s without throwing',
    (numPlayers) => {
      const match = createMatch({
        game: Laundromat,
        numPlayers,
        setupData: undefined,
        unlisted: true,
      }) as { setupDataError?: string };

      expect(match.setupDataError).toBeDefined();
    },
  );

  it.each([3, 4, 5, 6])('still creates a real match for %i players', (numPlayers) => {
    const match = createMatch({
      game: Laundromat,
      numPlayers,
      setupData: undefined,
      unlisted: true,
    }) as { setupDataError?: string; initialState?: { G: { players: unknown[] } } };

    expect(match.setupDataError).toBeUndefined();
    expect(match.initialState?.G.players).toHaveLength(numPlayers);
  });

  /*
   * The end-to-end claim: hit the running server the way an abandoned tab does
   * and confirm it is still answering afterwards. The health endpoint is the
   * proof — a process that died cannot serve it.
   */
  it('survives repeated syncs to a nonexistent match and keeps serving', async () => {
    const h = await startHarness();
    try {
      const before = await h.api<{ ok: boolean }>('/api/health');
      expect(before.body.ok).toBe(true);

      for (let i = 0; i < 5; i++) {
        await h.api(`/games/laundromat/GONE${i}`);
      }

      const after = await h.api<{ ok: boolean; uptime: number }>('/api/health');
      expect(after.body.ok).toBe(true);
      expect(after.body.uptime).toBeGreaterThan(0);
    } finally {
      await h.close();
    }
  });
});
