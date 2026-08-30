/**
 * Drives the REAL boardgame.io client -- the same reducer, phases, turn order
 * and moves the browser uses -- through complete games, headlessly.
 *
 * This is what justifies the claim "a full game can be played to victory".
 */

import { describe, expect, test } from 'vitest';
import { Client } from 'boardgame.io/client';
import { makeLaundromat } from '../../src/game/Laundromat';
import type { LaundromatG } from '../../src/game/Laundromat';
import { anyLegalLoad, firstBlockedDisplacement } from '../../src/rules/driver';
import { canPlaySpecial } from '../../src/rules/phases';
import { assertInvariants } from '../../src/rules/phases';
import type { LaundromatConfig } from '../../src/rules/types';

interface Played {
  days: number;
  winners: number[];
  G: LaundromatG;
  steps: number;
}

/**
 * Plays one whole game by issuing legal moves, exactly as a human would through
 * the UI.  Returns when boardgame.io reports gameover.
 */
function playThrough(
  numPlayers: number,
  cfg: Partial<LaundromatConfig> = {},
  maxSteps = 200000,
): Played {
  const client = Client<LaundromatG>({
    game: makeLaundromat(cfg),
    numPlayers,
    debug: false,
  });
  client.start();

  let steps = 0;
  for (;;) {
    const s = client.getState()!;
    if (s.ctx.gameover) {
      client.stop();
      return {
        days: s.G.day,
        winners: s.ctx.gameover.winners,
        G: s.G,
        steps,
      };
    }
    if (steps++ > maxSteps) {
      client.stop();
      throw new Error(`game did not finish in ${maxSteps} steps (day ${s.G.day})`);
    }

    const { G, ctx } = s;
    const m = client.moves;

    if (ctx.phase === 'key') {
      // The keyholder's action is compulsory (v11): restore a washer if one is
      // off, otherwise switch one off. passKey is legal only when the Gang has
      // destroyed everything.
      const off = G.machines.find((x) => !x.dead && !x.on);
      const live = G.machines.filter((x) => !x.dead);
      if (off) m.setMachinePower(off.id, true);
      else if (live.length > 0) m.setMachinePower(live[live.length - 1].id, false);
      else m.passKey();
      continue;
    }

    if (ctx.phase === 'event') {
      const cands = G.machines.filter((x) => !x.dead).map((x) => x.id);
      if (cands.length === 0) throw new Error('no live machines for an event choice');
      const target = cands[0];
      if (G.revealedEvent === 'Gang' && G.machines[target].jimothy) {
        const other = cands.find((c) => c !== target);
        m.resolveEvent(target, other);
      } else {
        m.resolveEvent(target);
      }
      continue;
    }

    // ---- roll phase --------------------------------------------------------
    const t = G.turn;
    if (!t) throw new Error('roll phase with no turn scratch');
    const pid = t.player;

    if (t.stage === 'roll') {
      m.roll();
    } else if (t.stage === 'card') {
      const playable = G.players[pid].ready.filter((n) => canPlaySpecial(G, pid, n));
      const live = G.machines.filter((x) => !x.dead);
      if (playable.length > 0 && live.length > 0 && steps % 3 === 0) {
        const name = playable[0];
        if (name === 'Coin') m.playCard(name, { machine: live[0].id, on: !live[0].on });
        else if (name === 'Snacc') {
          const dest = live.find((x) => x.id !== G.jimothyAt);
          if (dest) m.playCard(name, dest.id);
          else m.passCard();
        } else m.playCard(name, live[0].id);
      } else {
        m.passCard();
      }
    } else if (t.stage === 'load') {
      const choice = anyLegalLoad(G, pid);
      if (choice) m.load(choice.item, choice.machine);
      else {
        /*
         * The board can refuse everything. Since v11 the player then MOVES one of
         * their own items between washers instead, and skipping is legal only when
         * even that is impossible — skipLoad refuses otherwise, which deadlocks a
         * harness that has not been told.
         */
        const sub = firstBlockedDisplacement(G);
        if (sub) m.displaceInsteadOfLoad(sub.from, sub.item, sub.to);
        else m.skipLoad();
      }
    } else if (t.stage === 'extra') {
      if (t.pendingEvent) {
        // Events resolve the moment they are drawn: name a washer now.
        const cands = G.machines.filter((x) => !x.dead).map((x) => x.id);
        const target = cands[0];
        if (G.revealedEvent === 'Gang' && G.machines[target].jimothy) {
          m.resolveDrawnEvent(target, cands.find((c) => c !== target));
        } else {
          m.resolveDrawnEvent(target);
        }
      } else if (t.face === 4) m.passMove();
      else if (t.face === 5 && t.pendingDraw && t.pendingDraw.length > 0) m.keepCard(t.pendingDraw[0]);
      else m.passMove();
    } else {
      throw new Error(`unexpected stage ${t.stage}`);
    }
  }
}

describe('boardgame.io adapter', () => {
  test('a complete 4-player game runs to an ending through the real client', () => {
    const r = playThrough(4);
    /*
     * Not "to victory": since v11 a tie ends the game with NOBODY winning, and this
     * client plays unseeded, so roughly one run in eleven legitimately finishes with
     * an empty winners list. Asserting a winner made this test fail at that rate and
     * look flaky when it was reporting a rule working.
     */
    expect(r.G.over).toBe(true);
    expect(r.winners.length).toBeLessThan(2);
    expect(r.days).toBeGreaterThan(1);
    for (const w of r.winners) {
      expect(r.G.players[w].clean.length).toBe(r.G.players[w].mustWash.length);
    }
    assertInvariants(r.G);
  });

  test('every supported player count finishes', () => {
    for (const n of [3, 4, 5, 6]) {
      const r = playThrough(n);
      /*
       * REVISED v11: zero winners is a legitimate ending, not a stalled game — a
       * tie means nobody wins. What matters is that the game ENDED and that it
       * never reports a shared win.
       */
      expect(r.G.over, `P=${n} did not finish`).toBe(true);
      expect(r.winners.length, `P=${n} reported a shared win`).toBeLessThan(2);
      assertInvariants(r.G);
    }
  });

  /*
   * The two "every arm finishes" sweeps are gone with the arms.  There is one
   * circuit break and one event timing now, and the games-terminate tests above
   * already exercise both on every seat count and seed.
   */

  test('the key rotates one seat per day', () => {
    const client = Client<LaundromatG>({ game: makeLaundromat(), numPlayers: 4, debug: false });
    client.start();
    const seen: number[] = [];
    let steps = 0;
    while (steps++ < 4000) {
      const s = client.getState()!;
      if (s.ctx.gameover) break;
      if (s.G.day >= 1 && seen[s.G.day - 1] === undefined) seen[s.G.day - 1] = s.G.key;
      if (s.G.day > 5) break;
      const { G, ctx } = s;
      const m = client.moves;
      if (ctx.phase === 'key') {
        const off = G.machines.find((x) => !x.dead && !x.on);
        const live = G.machines.filter((x) => !x.dead);
        if (off) m.setMachinePower(off.id, true);
        else if (live.length > 0) m.setMachinePower(live[live.length - 1].id, false);
        else m.passKey();
      } else if (ctx.phase === 'event') {
        m.resolveEvent(G.machines.find((x) => !x.dead)!.id);
      } else {
        const t = G.turn!;
        if (t.stage === 'roll') m.roll();
        else if (t.stage === 'card') m.passCard();
        else if (t.stage === 'load') {
          const c = anyLegalLoad(G, t.player);
          if (c) m.load(c.item, c.machine);
          else {
            const sub = firstBlockedDisplacement(G);
            if (sub) m.displaceInsteadOfLoad(sub.from, sub.item, sub.to);
            else m.skipLoad();
          }
        } else if (t.pendingEvent) {
          m.resolveDrawnEvent(G.machines.find((x) => !x.dead)!.id);
        } else if (t.face === 5 && t.pendingDraw?.length) m.keepCard(t.pendingDraw[0]);
        else m.passMove();
      }
    }
    client.stop();
    for (let d = 1; d < seen.length; d++) {
      if (seen[d] === undefined) continue;
      expect(seen[d]).toBe((seen[d - 1] + 1) % 4);
    }
  });

  test('mandatory loading is enforced by the move layer, not the UI', () => {
    const client = Client<LaundromatG>({ game: makeLaundromat(), numPlayers: 3, debug: false });
    client.start();
    client.moves.roll();
    let s = client.getState()!;
    // Skip past the card stage if the engine parked us there.
    if (s.G.turn?.stage === 'card') {
      client.moves.passCard();
      s = client.getState()!;
    }
    expect(s.G.turn?.stage).toBe('load');
    const required = s.G.turn!.loadsRequired;
    // Attempting to jump straight to the die's extra effect is rejected.
    client.moves.passMove();
    s = client.getState()!;
    expect(s.G.turn?.stage).toBe('load');
    expect(s.G.turn?.loadsDone).toBe(0);
    expect(required).toBeGreaterThanOrEqual(1);
    client.stop();
  });
});
