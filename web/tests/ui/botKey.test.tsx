/**
 * A BOT HOLDING THE KEY.
 *
 * Reported bug: in a solo game the board stops when a bot is the keyholder and
 * has to turn a washer on or off. The key phase is the one place where the
 * seat to act is chosen by `G.key` rather than by turn order, so it is also the
 * one place a bot can be up without having just taken a turn.
 *
 * This pins the whole path: the gate appears for a bot keyholder, releasing it
 * makes the bot act, and the day actually moves on afterwards.
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Client as PlainClient } from 'boardgame.io/client';
import { makeLaundromat } from '../../src/game/Laundromat';
import type { LaundromatG } from '../../src/game/Laundromat';
import { Board } from '../../src/ui/Board';
import { loadableItems, machineAccepts } from '../../src/rules/placement';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const game = makeLaundromat();

function driver(numPlayers = 3) {
  const c = PlainClient({ game, numPlayers, debug: false });
  c.start();
  return c;
}

/** Play legally until `done`, whatever the dice say. */
function playUntil(
  c: ReturnType<typeof driver>,
  done: (s: { G: LaundromatG; ctx: { phase: string | null; currentPlayer: string } }) => boolean,
  label = 'the target state',
): void {
  for (let guard = 0; guard < 600; guard++) {
    const st = c.getState()!;
    const G = st.G as LaundromatG;
    const ctx = st.ctx as unknown as { phase: string | null; currentPlayer: string };
    if (done({ G, ctx })) return;
    if (st.ctx.gameover) throw new Error(`game ended before reaching ${label}`);
    const pid = Number(ctx.currentPlayer);

    if (ctx.phase === 'key') {
      // Flipping is compulsory since v11 — passKey is INVALID_MOVE while any
      // washer can still be switched, which is the very bug this file is about.
      const off = G.machines.find((m) => !m.dead && !m.on);
      const live = G.machines.filter((m) => !m.dead);
      if (off) c.moves.setMachinePower(off.id, true);
      else if (live.length > 0) c.moves.setMachinePower(live[live.length - 1].id, false);
      else c.moves.passKey();
      continue;
    }
    if (ctx.phase === 'event') {
      const alive = G.machines.find((m) => !m.dead)!;
      c.moves.resolveEvent(alive.id);
      continue;
    }
    const t = G.turn;
    if (!t) { c.moves.roll(); continue; }
    if (t.face === null) { c.moves.roll(); continue; }
    if (t.stage === 'card') { c.moves.passCard(); continue; }
    if (t.stage === 'load') {
      const hand = loadableItems(G, pid);
      const target = hand
        .map((id) => ({ id, mi: G.machines.findIndex((m) => machineAccepts(G, m.id, id)) }))
        .find((x) => x.mi >= 0);
      if (target) c.moves.load(target.id, target.mi);
      else c.moves.skipLoad();
      continue;
    }
    if (t.stage === 'extra') {
      if (t.pendingDraw && t.pendingDraw.length > 0) { c.moves.keepCard(t.pendingDraw[0]); continue; }
      if (t.pendingEvent) {
        const alive = G.machines.find((m) => !m.dead)!;
        c.moves.resolveDrawnEvent(alive.id);
        continue;
      }
      c.moves.passMove();
      continue;
    }
    c.moves.passMove();
  }
  const st = c.getState()!;
  const G = st.G as LaundromatG;
  throw new Error(
    `never reached ${label} — spinning at phase=${st.ctx.phase} player=${st.ctx.currentPlayer} ` +
      `day=${G.day} stage=${G.turn?.stage} face=${G.turn?.face} ` +
      `pendingEvent=${G.turn?.pendingEvent} pendingDraw=${G.turn?.pendingDraw?.length ?? 0}`,
  );
}

function propsFor(c: ReturnType<typeof driver>, bots: Record<number, 'normal'>) {
  const st = c.getState()!;
  return {
    G: st.G as LaundromatG,
    ctx: st.ctx,
    moves: c.moves,
    events: c.events,
    playerID: null,
    matchData: undefined,
    isConnected: true,
    bots,
    seatNames: { 0: 'You', 1: 'Bot one', 2: 'Bot two' },
    seatColours: null,
  } as unknown as Parameters<typeof Board>[0];
}

describe('a bot holding the key', () => {
  test('the key phase reaches a bot seat at all', () => {
    const c = driver();
    // Seat 0 starts with the key; it passes left each day, so day 2 is seat 1.
    playUntil(c, ({ ctx, G }) => ctx.phase === 'key' && G.day >= 2, 'a later key phase');
    const G = c.getState()!.G as LaundromatG;
    const ctx = c.getState()!.ctx as unknown as { currentPlayer: string };

    // The seat to act in the key phase is the KEYHOLDER, not whoever moved last.
    expect(Number(ctx.currentPlayer)).toBe(G.key);
    expect(G.key).not.toBe(0);
  });

  test('a bot keyholder is offered a gate, and taking it makes the bot act', () => {
    vi.useFakeTimers();
    const c = driver();
    playUntil(c, ({ ctx, G }) => ctx.phase === 'key' && G.day >= 2, 'a later key phase');

    const keyholder = (c.getState()!.G as LaundromatG).key;
    const bots = { 1: 'normal', 2: 'normal' } as Record<number, 'normal'>;
    expect(bots[keyholder]).toBeDefined(); // the keyholder really is a bot

    const before = c.getState()!.ctx.phase;
    const { rerender } = render(<Board {...propsFor(c, bots)} />);

    /*
     * Mounting on day 2 puts the previous day's reckoning review up, and bots
     * are held while any modal is open — deliberately, so the board cannot move
     * underneath a dialog you are reading. Dismiss it the way a player does.
     */
    const cont = [...document.querySelectorAll('button')].find((b) =>
      /Continue to day/.test(b.textContent ?? ''),
    );
    if (cont) {
      fireEvent.click(cont);
      rerender(<Board {...propsFor(c, bots)} />);
    }

    // The gate has to be there, or there is nothing for the human to press and
    // the game simply stops — which is the reported bug.
    const gate = document.querySelector<HTMLElement>('.botbar button');
    expect(gate).not.toBeNull();

    fireEvent.click(gate!);

    /*
     * Bots move on a timer and are held while a modal is open, so the loop does
     * what a player does: clear whatever dialog is up, let time pass, re-render.
     */
    for (let i = 0; i < 12; i++) {
      const dismiss = [...document.querySelectorAll('.overlay button')].find((b) =>
        /Continue to day|Close|Got it|OK/i.test(b.textContent ?? ''),
      );
      if (dismiss) {
        fireEvent.click(dismiss);
        rerender(<Board {...propsFor(c, bots)} />);
        continue;
      }
      const stillWaiting = document.querySelector<HTMLElement>('.botbar button');
      if (stillWaiting) fireEvent.click(stillWaiting);
      act(() => { vi.advanceTimersByTime(700); });
      rerender(<Board {...propsFor(c, bots)} />);
    }

    const after = c.getState()!.ctx.phase;
    const G = c.getState()!.G as LaundromatG;
    // Either the key phase resolved and the day moved on, or the bot at least
    // flipped a washer. Sitting in the key phase unchanged is the failure.
    expect(after !== before || G.day > 2).toBe(true);
  });
});
