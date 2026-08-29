/**
 * boardgame.io adapter.
 *
 * This file is deliberately THIN.  Every rule lives in src/rules/; this maps the
 * five phases of a day onto boardgame.io's phase/turn machinery and exposes the
 * moves.  Nothing here decides anything about the rules.
 *
 * Milestone 1 is local hot-seat: one browser, no transport.  The same definition
 * runs unchanged over SocketIO for remote play, because the reducer is pure and
 * all randomness flows through the RandomPlugin.
 */

import type { Ctx, Game, MoveMap } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { defaultConfig } from '../rules/config';
import {
  advanceIfDone,
  beginTurn,
  canPlaySpecial,
  canSetPower,
  displace,
  drawSpecialPair,
  eventNeedsChoice,
  keepSpecial,
  loadItem,
  phaseEndOfDay,
  phaseEvent,
  phaseReckon,
  playSpecial,
  resolveEventNow,
  rollDie,
  setPower,
  skipBlockedLoad,
  skipCard,
  skipExtra,
  log,
} from '../rules/phases';
import type { MachineResult, SpecialTarget } from '../rules/phases';
import type { Rng } from '../rules/rng';
import { newGame } from '../rules/setup';
import type { GameState, ItemId, LaundromatConfig, SpecialName } from '../rules/types';

/** G is the rules state plus a little presentation bookkeeping. */
export interface LaundromatG extends GameState {
  turnsTaken: number;
  lastReckoning: MachineResult[] | null;
  lastReckoningDay: number | null;
}

interface RandomApi {
  Die(spec: number): number;
  Shuffle<T>(deck: T[]): T[];
  Number(): number;
}

function rngFrom(random: RandomApi): Rng {
  return {
    die: (sides: number) => random.Die(sides),
    shuffle: <T,>(items: T[]) => random.Shuffle(items),
    int: (n: number) => Math.min(n - 1, Math.floor(random.Number() * n)),
  };
}

export interface SetupData {
  cfg?: Partial<LaundromatConfig>;
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

type MoveCtx = { G: LaundromatG; ctx: Ctx; random: RandomApi; events: { endPhase(): void } };

const rollMoves: MoveMap<LaundromatG> = {
  roll: ({ G, random }: MoveCtx) => {
    if (!G.turn || G.turn.stage !== 'roll') return INVALID_MOVE;
    rollDie(G, rngFrom(random));
  },

  playCard: ({ G, random }: MoveCtx, name: SpecialName, target: SpecialTarget) => {
    if (!G.turn) return INVALID_MOVE;
    if (!canPlaySpecial(G, G.turn.player, name)) return INVALID_MOVE;
    playSpecial(G, G.turn.player, name, target, rngFrom(random));
    advanceIfDone(G, rngFrom(random));
    if (G.turn.stage === 'card') skipCard(G, rngFrom(random));
  },

  passCard: ({ G, random }: MoveCtx) => {
    if (!G.turn || G.turn.stage !== 'card') return INVALID_MOVE;
    skipCard(G, rngFrom(random));
  },

  load: ({ G, random }: MoveCtx, item: ItemId, machine: number) => {
    if (!G.turn || G.turn.stage !== 'load') return INVALID_MOVE;
    try {
      loadItem(G, G.turn.player, item, machine, rngFrom(random));
    } catch {
      return INVALID_MOVE;
    }
  },

  moveItem: ({ G, random }: MoveCtx, from: number, item: ItemId, to: number) => {
    if (!G.turn || G.turn.stage !== 'extra') return INVALID_MOVE;
    try {
      displace(G, from, item, to, rngFrom(random));
    } catch {
      return INVALID_MOVE;
    }
  },

  passMove: ({ G, random }: MoveCtx) => {
    if (!G.turn || G.turn.stage !== 'extra') return INVALID_MOVE;
    if (G.turn.pendingEvent) return INVALID_MOVE;
    skipExtra(G, rngFrom(random));
  },

  /**
   * Explicitly give up loads the board will not accept.  Guarded by
   * `loadBlocked`, so it cannot be used to dodge mandatory loading.
   */
  skipLoad: ({ G, random }: MoveCtx) => {
    if (!G.turn || G.turn.stage !== 'load') return INVALID_MOVE;
    if (!skipBlockedLoad(G, rngFrom(random))) return INVALID_MOVE;
  },

  /** cfg.resolveEventsImmediately: the drawer names Gang's or Jimothy's washer. */
  resolveDrawnEvent: ({ G, random }: MoveCtx, machine: number, jimothyTo?: number) => {
    if (!G.turn?.pendingEvent) return INVALID_MOVE;
    resolveEventNow(G, { machine, jimothyTo }, rngFrom(random));
  },

  keepCard: ({ G, random }: MoveCtx, name: SpecialName) => {
    if (!G.turn || G.turn.stage !== 'extra') return INVALID_MOVE;
    if (!G.turn.pendingDraw) drawSpecialPair(G);
    if (!G.turn.pendingDraw?.includes(name)) return INVALID_MOVE;
    keepSpecial(G, name, rngFrom(random));
  },
};

const eventMoves: MoveMap<LaundromatG> = {
  resolveEvent: ({ G, random, events }: MoveCtx, machine: number, jimothyTo?: number) => {
    if (G.revealedEvent === null) return INVALID_MOVE;
    phaseEvent(G, { machine, jimothyTo }, rngFrom(random));
    events.endPhase();
  },
};

const keyMoves: MoveMap<LaundromatG> = {
  setMachinePower: ({ G, events }: MoveCtx, machine: number, on: boolean) => {
    if (!canSetPower(G, machine, on)) return INVALID_MOVE;
    setPower(G, machine, on);
    events.endPhase();
  },
  passKey: ({ G, events }: MoveCtx) => {
    log(G, 'The keyholder passes.');
    events.endPhase();
  },
};

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

/**
 * Factory.  In hot-seat the config is baked in at client creation; over a
 * network the lobby would pass the same overrides as `setupData` instead, which
 * is why both routes are supported.
 */
export function makeLaundromat(overrides: Partial<LaundromatConfig> = {}): Game<LaundromatG> {
  return { ...Laundromat, setup: makeSetup(overrides) };
}

function makeSetup(overrides: Partial<LaundromatConfig> = {}) {
  return ({ ctx, random }: { ctx: Ctx; random: unknown }, setupData?: SetupData): LaundromatG => {
    const cfg = defaultConfig(ctx.numPlayers, { ...overrides, ...(setupData?.cfg ?? {}) });
    const st = newGame(cfg, rngFrom(random as RandomApi)) as LaundromatG;
    st.turnsTaken = 0;
    st.lastReckoning = null;
    st.lastReckoningDay = null;
    return st;
  };
}

export const Laundromat: Game<LaundromatG> = {
  name: 'laundromat',
  minPlayers: 3,
  maxPlayers: 6,

  /*
   * This is not decoration, and removing it takes the whole server down.
   *
   * boardgame.io's `Master.onSync` creates a match ON DEMAND when a client
   * syncs to a matchID the server does not have (its own comment reads "If the
   * game doesn't exist, then create one on demand. TODO: Move this out of the
   * sync call."). It builds that match with the numPlayers the CLIENT sent,
   * and `createMatch` silently defaults that to 2.
   *
   * Our state is in memory, so every restart empties it while browser tabs are
   * still holding a session in localStorage and reconnecting. Each of those
   * reconnects hit the on-demand path with numPlayers = 2, `setup` called
   * `defaultConfig(2)`, and that threw — inside an async socket handler, which
   * Node turns into an unhandled rejection and exits the process. The client
   * then reconnected and killed it again; Fly reported "machine has reached
   * its max restart count of 10". Any single stale tab could hold the server
   * down indefinitely.
   *
   * `minPlayers`/`maxPlayers` above do NOT prevent this: nothing on the sync
   * path consults them. `validateSetupData` is the one hook `createMatch` does
   * call, and it runs BEFORE `InitializeGame`, so returning a string here
   * turns a fatal throw into an error the client is handed politely.
   */
  validateSetupData: (_setupData, numPlayers) => {
    if (!Number.isInteger(numPlayers) || numPlayers < 3 || numPlayers > 6) {
      return `Laundromat seats 3-6 players, not ${numPlayers}`;
    }
    return undefined;
  },

  setup: makeSetup(),

  phases: {
    // ---- PHASE 1 ---------------------------------------------------------
    roll: {
      start: true,
      next: 'event',
      onBegin: ({ G }) => {
        G.day += 1;
        G.turnsTaken = 0;
        log(G, `--- Day ${G.day} begins. Player ${G.key + 1} holds the key. ---`);
      },
      turn: {
        order: {
          first: ({ G }) => (G.cfg.keyholderFirst ? G.key : 0),
          // Returning undefined after a full lap ends the phase.  Do NOT use a
          // phase-level endIf for this: boardgame.io evaluates endIf on ENTRY,
          // before onBegin, so a counter-based test fires before it is reset.
          next: ({ G, ctx }) => (G.turnsTaken >= ctx.numPlayers ? undefined : (ctx.playOrderPos + 1) % ctx.numPlayers),
        },
        onBegin: ({ G, ctx }) => {
          beginTurn(G, Number(ctx.currentPlayer));
        },
        onEnd: ({ G }) => {
          G.turnsTaken += 1;
        },
        endIf: ({ G }) => G.turn?.stage === 'done',
      },
      moves: rollMoves,
    },

    // ---- PHASE 2 ---------------------------------------------------------
    event: {
      next: 'key',
      onBegin: ({ G, random, events }) => {
        if (G.revealedEvent === null) {
          events.endPhase();
          return;
        }
        if (!eventNeedsChoice(G)) {
          phaseEvent(G, {}, rngFrom(random as unknown as RandomApi));
          events.endPhase();
        }
      },
      turn: {
        order: {
          first: ({ G }) => G.eventDrawer ?? 0,
          next: () => undefined,
        },
      },
      moves: eventMoves,
    },

    // ---- PHASE 3, then 4 and 5 in onEnd ----------------------------------
    key: {
      next: 'roll',
      turn: {
        order: {
          first: ({ G }) => G.key,
          next: () => undefined,
        },
      },
      moves: keyMoves,
      onEnd: ({ G, random }) => {
        const rng = rngFrom(random as unknown as RandomApi);
        G.lastReckoning = phaseReckon(G, rng);
        G.lastReckoningDay = G.day;
        phaseEndOfDay(G);
        G.turn = null;
      },
    },
  },

  endIf: ({ G }) => (G.over ? { winners: G.winners } : undefined),

  /**
   * Open information by design: every loaded item is visible to everyone.  The
   * ONLY private state is the contents of a hand (and a player's ready cards,
   * which are the physical game's hidden hand).  Fresh cards are face-up.
   */
  playerView: ({ G, playerID }) => {
    if (playerID === null || playerID === undefined) return G; // hot-seat: one screen
    const me = Number(playerID);
    return {
      ...G,
      players: G.players.map((p) =>
        p.id === me
          ? p
          : { ...p, hand: p.hand.map(() => 'hidden'), ready: p.ready.map(() => 'hidden' as SpecialName) },
      ),
    };
  },
};
