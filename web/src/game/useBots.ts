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
 * THE HUMAN STARTS EVERY BOT TURN. Bots used to play the moment their turn came
 * round, which turns a solo playtest into a cutscene: the point of playing
 * against them is to watch what they do and work out why, and you cannot do
 * that while the board is moving under you. So each bot turn opens a GATE — the
 * board draws "Player 2 is up. Play their turn." and nothing happens until the
 * human clicks. Once released, the turn plays out move by move on the beat
 * below, with its log lines appearing as they land.
 *
 * ONE GATE PER TURN, not per decision. A turn is a roll, maybe a card, one to
 * six loads and maybe an extra — six clicks to watch one opponent do one thing
 * would be unusable within a day. The gate key is the phase, seat, day and
 * boardgame.io turn number, all of which are constant for exactly as long as
 * one bot turn (or one bot key phase, or one bot event resolution) lasts.
 */

import { useEffect, useRef, useState } from 'react';
import type { Ctx } from 'boardgame.io';
import type { LaundromatG } from './Laundromat';
import { botPolicy, type BotLevel } from './bot';
import { DICE, gangTargets, loadBlocked, mustStillLoad } from '../rules/phases';
import { anyLegalLoad, firstBlockedDisplacement } from '../rules/driver';
import type { LogEntry } from '../rules/types';

/** How long a bot appears to think between two of its own moves. */
const BEAT_MS = 520;

export interface BotSeats {
  /** Seat index -> difficulty. Seats absent from this are humans. */
  [seat: number]: BotLevel;
}

export interface BotGate {
  seat: number;
  level: BotLevel;
  /** True while the game is waiting for the human to let this turn play. */
  waiting: boolean;
  /** What this bot is about to do, in one sentence. */
  about: string;
  /** Let it play. Harmless once released. */
  go: () => void;
}

export interface BotView {
  /**
   * Non-null exactly when a bot seat is the one to act. The board uses it both
   * to draw the gate AND to keep the human's hands off the controls — hot-seat
   * has no playerID, so without this every bot turn is one the human could take
   * on the bot's behalf.
   */
  gate: BotGate | null;
  /** Log lines this gate has produced so far — what the bot is doing, live. */
  did: LogEntry[];
  /** Log lines the PREVIOUS gate produced — what just happened, for the recap. */
  since: LogEntry[];
}

export function useBots(
  G: LaundromatG,
  ctx: Ctx,
  moves: Record<string, (...args: never[]) => void>,
  bots: BotSeats | null,
  /** Freeze everything: a modal is up and the board behind it must stay still. */
  hold = false,
): BotView {
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
   * The gate: one per bot turn. `ctx.turn` alone would do for the roll phase,
   * but the key phase and an event resolution are separate decisions inside the
   * same turn number, and each deserves its own "and now watch this".
   */
  const gateKey = [ctx.phase, ctx.currentPlayer, G.day, ctx.turn].join('|');
  const [released, setReleased] = useState<string | null>(null);
  const waiting = level !== undefined && !ctx.gameover && released !== gateKey;

  /*
   * Where the log stood when this gate opened, and when the previous one did.
   * Two numbers are enough to slice the log into "what is happening now" and
   * "what just happened", which is the whole recap. Written during render on
   * purpose: a state update here would render twice for every turn and the
   * value is a pure function of gateKey, so a second render computes the same
   * thing rather than a different one.
   */
  const marks = useRef({ key: gateKey, at: G.log.length, prev: G.log.length });
  if (marks.current.key !== gateKey) {
    marks.current = { key: gateKey, prev: marks.current.at, at: G.log.length };
  }

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
    if (waiting) return; // the human has not let this turn start yet
    if (hold) return; // a modal is up; the board behind it must not move

    const timer = window.setTimeout(() => {
      const cur = latest.current;
      // Re-check on the way in: the state may have moved on while we waited.
      if (cur.ctx.gameover) return;
      if (Number(cur.ctx.currentPlayer) !== seat) return;
      step(cur.G, cur.ctx, cur.moves, seat, level);
    }, BEAT_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, level, seat, waiting, hold]);

  if (level === undefined) {
    // No bot is up. The recap still matters — this is the human's own turn, and
    // the lines the bots just produced are exactly what they need to see.
    return { gate: null, did: [], since: G.log.slice(marks.current.prev, marks.current.at) };
  }

  return {
    gate: {
      seat,
      level,
      waiting,
      about: describe(G, ctx),
      go: () => setReleased(gateKey),
    },
    did: G.log.slice(marks.current.at),
    since: G.log.slice(marks.current.prev, marks.current.at),
  };
}

/**
 * What the bot is about to do, at the granularity of the gate. Deliberately NOT
 * a preview of the actual choice: 'normal' picks at random, so any move named
 * here would be re-rolled when the move is really made, and a gate that says
 * "it will switch Washer 3 off" and then switches Washer 1 off is worse than
 * one that promised nothing. What it DID is reported afterwards, from the log.
 */
function describe(G: LaundromatG, ctx: Ctx): string {
  if (ctx.phase === 'key') return 'They hold the key: one washer on, one off, or let it spin.';
  if (ctx.phase === 'event') {
    return `They drew ${G.revealedEvent ?? 'an event'} and choose where it lands.`;
  }
  const turn = G.turn;
  if (!turn || turn.face === null) return 'They roll, then load whatever the die allows.';
  if (turn.stage === 'card') return 'They decide whether to play a special item.';
  if (turn.stage === 'load') return `They rolled ${turn.face} and are loading the washers.`;
  if (turn.stage === 'extra') return `They rolled ${turn.face} and resolve what it grants.`;
  return 'They finish their turn.';
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
