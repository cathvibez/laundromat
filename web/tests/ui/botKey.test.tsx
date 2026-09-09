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
import { botPolicy, type BotLevel } from '../../src/game/bot';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/*
 * A PINNED SEED, because this file is a regression test and not a fuzzer.
 *
 * Without one boardgame.io picks a fresh seed per run, so every assertion below
 * is made against a different game — and this test duly went green on the runs
 * that proved the fix and red on the deploy. What it is pinning is a specific
 * dead end (a bot keyholder with nothing it wants to flip), which needs a
 * reproducible board, not a random one. The bots' own randomness is unaffected;
 * `normal` still picks at random, which is what makes the loop below tolerant
 * of whichever legal move it takes.
 */
const game = { ...makeLaundromat(), seed: 's4' };

/** The policy under test, used here to RECOGNISE the situation being pinned. */
const hell = botPolicy('hell');

/**
 * The exact reported situation: a bot holds the key, and its policy declines to
 * flip anything. `chooseKey` returns null only at 'hell', and only when every
 * available flip scores <= 0 — that null is what used to become an illegal
 * `passKey` and stop the game dead.
 */
function isTheReportedSituation(G: LaundromatG, phase: string | null): boolean {
  return phase === 'key' && G.day >= 2 && G.key !== 0 && hell.chooseKey!(G, G.key) === null;
}

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

function propsFor(c: ReturnType<typeof driver>, bots: Record<number, BotLevel>) {
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
    playUntil(c, ({ ctx, G }) => isTheReportedSituation(G, ctx.phase), 'a declining bot keyholder');
    const G = c.getState()!.G as LaundromatG;
    const ctx = c.getState()!.ctx as unknown as { currentPlayer: string };

    // The seat to act in the key phase is the KEYHOLDER, not whoever moved last.
    expect(Number(ctx.currentPlayer)).toBe(G.key);
    expect(G.key).not.toBe(0);
  });

  test('a bot keyholder is offered a gate, and taking it makes the bot act', () => {
    vi.useFakeTimers();
    const c = driver();
    /*
     * Stop on the SITUATION, not on "day 2". The predicate asks the real policy
     * whether it declines here, so the test cannot quietly come to rest in a
     * game where the bot happily flips a washer — which is what an earlier
     * "day >= 2" version did, passing against the very bug it was written for.
     */
    playUntil(c, ({ ctx, G }) => isTheReportedSituation(G, ctx.phase), 'a declining bot keyholder');

    const keyholder = (c.getState()!.G as LaundromatG).key;
    /*
     * HELL BOTS, and that is the whole point of the test.
     *
     * `chooseKey` in bot.ts returns null only at 'hell' — the level scores its
     * options and declines outright when the best one does not help it
     * ("passing beats a move that does not help", bot.ts). Every other level
     * always names a flip, so the fallback this file exists to cover is never
     * reached and the test passes against the bug. An earlier version used
     * 'normal' and did exactly that.
     */
    const bots = { 1: 'hell', 2: 'hell' } as Record<number, BotLevel>;
    expect(bots[keyholder]).toBeDefined(); // the keyholder really is a bot

    const before = c.getState()!.ctx.phase;
    const powerBefore = (c.getState()!.G as LaundromatG).machines.map((m) => m.on).join('');
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
    for (let i = 0; i < 40; i++) {
      /*
       * CLICK THE LAST BUTTON, DO NOT MATCH ITS LABEL. The reckoning review is
       * a sequence — "Skip" to jump to the end, then "Continue to day N" — and
       * an earlier version of this loop matched on a list of labels that
       * happened to omit "Skip". It therefore sat on the first screen of the
       * overlay forever, bots frozen behind it (they are held while a modal is
       * open, by design), and reported the bug it was written to disprove.
       * The advancing control is the last button in the row in every one of
       * these dialogs; that is the thing to press.
       */
      const buttons = [...document.querySelectorAll<HTMLElement>('.overlay button')];
      if (buttons.length > 0) {
        fireEvent.click(buttons[buttons.length - 1]);
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
    const powerAfter = G.machines.map((m) => m.on).join('');

    /*
     * THE FAILURE IS "NOTHING HAPPENED", so assert on the two things that can
     * happen rather than on the day. The bot flips a washer (power changes) and
     * the key phase ends (the phase moves on); either one proves it acted. The
     * previous version of this test checked `G.day > 2`, which is a CONSEQUENCE
     * of acting and needs the reckoning and the next day's setup to run inside
     * the loop's budget — so it could fail on a game where the bot had plainly
     * moved. Sitting in the key phase with every washer as it was is the bug.
     */
    expect(
      powerAfter !== powerBefore || after !== before,
      `bot keyholder never acted: phase ${before} -> ${after}, power ${powerBefore} -> ${powerAfter}`,
    ).toBe(true);
  });
});
