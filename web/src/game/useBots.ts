/**
 * PLAYING THE BOT SEATS.
 *
 * `bot.ts` decides; this drives. It watches the boardgame.io state and, when
 * the seat to act is a bot, makes one move after a short pause, then lets the
 * next render decide the next one.
 *
 * ONE MOVE PER TICK, deliberately. Looping until the bot's turn is over would
 * mean reading state this component has not been re-rendered with yet, and
 * boardgame.io moves are asynchronous — the classic way to write a bot that
 * plays its whole turn against a stale board. Doing one thing and waiting to be
 * told the result is slower and correct.
 *
 * The pause is not decoration either. Bots resolving instantly makes a solo
 * game feel like a cutscene you cannot read; a beat between moves is what lets
 * a playtester see what the opponent did.
 */

import { useEffect, useRef } from 'react';
import type { Ctx } from 'boardgame.io';
import type { LaundromatG } from './Laundromat';
import { botPolicy, type BotLevel } from './bot';
import { DICE, gangTargets, loadBlocked, mustStillLoad } from '../rules/phases';
import { anyLegalLoad, firstBlockedDisplacement } from '../rules/driver';

/** How long a bot appears to think. Long enough to follow, short enough to play. */
const BEAT_MS = 700;

export interface BotSeats {
  /** Seat index -> difficulty. Seats absent from this are humans. */
  [seat: number]: BotLevel;
}

export function useBots(
  G: LaundromatG,
  ctx: Ctx,
  moves: Record<string, (...args: never[]) => void>,
  bots: BotSeats | null,
): void {
  /*
   * The latest G/ctx/moves, without them being dependencies.
   *
   * boardgame.io hands the board a NEW `moves` object every render, so an
   * effect that depends on it re-runs constantly — and its cleanup cancelled
   * the pending timer every time, which meant the bot never actually moved.
   * The effect below depends on a string describing the DECISION instead, so it
   * fires once per thing-to-decide and reads current values out of the ref.
   */
  const latest = useRef({ G, ctx, moves });
  latest.current = { G, ctx, moves };

  const seat = Number(ctx.currentPlayer);
  const level: BotLevel | undefined = bots?.[seat];

  /*
   * What counts as "a new decision". The item counts matter: within one load
   * stage the bot loads several items, and each load leaves the phase, stage
   * and turn counter untouched — without them the bot would place one item and
   * then sit there believing it had already acted.
   */
  const decision = [
    ctx.phase,
    ctx.currentPlayer,
    ctx.gameover ? 'over' : '',
    G.day,
    G.turn?.stage ?? '',
    G.turn?.face ?? '',
    G.turn?.loadsDone ?? '',
    G.turn?.pendingDraw?.length ?? 0,
    G.turn?.pendingEvent ? 'ev' : '',
    G.machines.reduce((a, m) => a + m.items.length, 0),
  ].join('|');

  useEffect(() => {
    if (level === undefined) return; // a human is up, or there are no bots
    if (ctx.gameover) return;

    const timer = window.setTimeout(() => {
      const cur = latest.current;
      // Re-check on the way in: the state may have moved on while we waited.
      if (cur.ctx.gameover) return;
      if (Number(cur.ctx.currentPlayer) !== seat) return;
      step(cur.G, cur.ctx, cur.moves, seat, level);
    }, BEAT_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, level, seat]);
}

/** Exactly one move, chosen for whatever the game is currently asking. */
function step(
  G: LaundromatG,
  ctx: Ctx,
  moves: Record<string, (...args: never[]) => void>,
  seat: number,
  level: BotLevel,
): void {
  const p = botPolicy(level);
  const call = (name: string, ...args: unknown[]) =>
    (moves[name] as unknown as (...a: unknown[]) => void)?.(...args);

  // ---- the keyholder decides what runs ----------------------------------
  if (ctx.phase === 'key') {
    const k = p.chooseKey?.(G, seat) ?? null;
    if (k) call('setMachinePower', k.machine, k.on);
    else call('passKey');
    return;
  }

  // ---- an event is on the table -----------------------------------------
  if (ctx.phase === 'event' && G.revealedEvent) {
    const cands = gangTargets(G);
    if (cands.length === 0) return;
    const machine = p.chooseGang?.(G, seat, cands) ?? cands[0];
    const elsewhere = cands.filter((c) => c !== machine);
    const jimothyTo =
      G.revealedEvent === 'Gang' && elsewhere.length > 0
        ? (p.chooseJimothy?.(G, seat, elsewhere) ?? elsewhere[0])
        : undefined;
    call('resolveEvent', machine, jimothyTo);
    return;
  }

  const turn = G.turn;
  if (!turn) return;

  // ---- the roll ----------------------------------------------------------
  if (turn.face === null) {
    call('roll');
    return;
  }

  if (turn.stage === 'card') {
    const play = p.chooseSpecial?.(G, seat) ?? null;
    if (play) call('playCard', play.name, play.target);
    else call('passCard');
    return;
  }

  if (turn.stage === 'load') {
    if (loadBlocked(G)) {
      // v11: moving one of your own items takes precedence over skipping, and
      // the engine refuses the skip while such a move exists.
      const sub = firstBlockedDisplacement(G);
      if (sub) call('displaceInsteadOfLoad', sub.from, sub.item, sub.to);
      else call('skipLoad');
      return;
    }
    if (!mustStillLoad(G)) return; // the engine advances on its own
    const choice = p.chooseLoad(G, seat) ?? anyLegalLoad(G, seat);
    if (choice) call('load', choice.item, choice.machine);
    else call('skipLoad');
    return;
  }

  if (turn.stage === 'extra') {
    const extra = DICE[turn.face].extra;
    if (turn.pendingDraw && turn.pendingDraw.length > 0) {
      call('keepCard', p.chooseKeep?.(G, seat, turn.pendingDraw) ?? turn.pendingDraw[0]);
      return;
    }
    if (turn.pendingEvent) {
      const cands = gangTargets(G);
      if (cands.length === 0) return;
      const machine = p.chooseGang?.(G, seat, cands) ?? cands[0];
      const elsewhere = cands.filter((c) => c !== machine);
      const jimothyTo =
        G.revealedEvent === 'Gang' && elsewhere.length > 0
          ? (p.chooseJimothy?.(G, seat, elsewhere) ?? elsewhere[0])
          : undefined;
      call('resolveDrawnEvent', machine, jimothyTo);
      return;
    }
    if (extra === 'displace') {
      const d = p.chooseDisplace?.(G, seat) ?? null;
      if (d) call('moveItem', d.from, d.item, d.to);
      else call('passMove');
      return;
    }
    call('passMove');
  }
}
