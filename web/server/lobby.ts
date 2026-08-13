/**
 * The lobby REST API, mounted on the same Koa router boardgame.io uses for its
 * own match endpoints and served from the same origin as the client bundle and
 * the socket.  One origin means no CORS configuration anywhere, which is one
 * fewer thing to get wrong in a deploy.
 *
 *   POST  /api/rooms                  create, you are seat "0" and the admin
 *   POST  /api/rooms/:code/join       take a seat, or reclaim yours
 *   GET   /api/rooms/:code            who is here, what the rules are
 *   PATCH /api/rooms/:code/settings   admin only, pre-start only
 *   POST  /api/rooms/:code/start      admin only, >= 3 players
 */

import type Router from '@koa/router';
import type { Context } from 'koa';
import koaBody from 'koa-body';
import { createMatch } from 'boardgame.io/internal';
import type { Game, Server as ServerTypes, StorageAPI } from 'boardgame.io';
import {
  configForStart,
  LobbyError,
  MIN_PLAYERS,
  normaliseCode,
  validateSettings,
  type Room,
  type RoomStore,
  type Seat,
} from './rooms';

const body = koaBody();

interface LobbyDeps {
  rooms: RoomStore;
  db: StorageAPI.Sync | StorageAPI.Async;
  game: Game;
}

/** The half of a seat the owner is allowed to see about themselves. */
function seatPayload(room: Room, seat: Seat) {
  return {
    code: room.code,
    playerID: seat.playerID,
    credentials: seat.credentials,
    settings: room.settings,
  };
}

/**
 * The public view.  Credentials are stripped here and nowhere else, so there is
 * exactly one line to audit.
 */
function roomPayload(room: Room) {
  return {
    code: room.code,
    started: room.started,
    settings: room.settings,
    players: room.seats.map((s) => ({
      playerID: s.playerID,
      nickname: s.nickname,
      connected: s.connected,
    })),
  };
}

function authFrom(ctx: Context): { playerID?: string; credentials?: string } {
  const playerID = ctx.get('x-player-id');
  const credentials = ctx.get('x-credentials');
  return {
    playerID: playerID || undefined,
    credentials: credentials || undefined,
  };
}

function requestBody(ctx: Context): Record<string, unknown> {
  const b = (ctx.request as unknown as { body?: unknown }).body;
  if (b === null || b === undefined) return {};
  if (typeof b !== 'object' || Array.isArray(b)) {
    throw new LobbyError(400, 'bad-body', 'Expected a JSON object.');
  }
  return b as Record<string, unknown>;
}

/** Turns a thrown LobbyError into the documented status + `{ error }` body. */
async function handled(ctx: Context, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof LobbyError) {
      ctx.status = e.status;
      ctx.body = { error: e.code, message: e.message };
      return;
    }
    throw e;
  }
}

export function mountLobby(router: Router<unknown, ServerTypes.AppCtx>, deps: LobbyDeps): void {
  const { rooms, db, game } = deps;

  // -- create --------------------------------------------------------------
  router.post('/api/rooms', body, async (ctx) => {
    await handled(ctx, () => {
      const { nickname } = requestBody(ctx);
      const room = rooms.create(nickname as string);
      ctx.status = 200;
      ctx.body = seatPayload(room, room.seats[0]);
    });
  });

  // -- join / rejoin -------------------------------------------------------
  router.post('/api/rooms/:code/join', body, async (ctx) => {
    await handled(ctx, () => {
      const room = rooms.require(normaliseCode(ctx.params.code));
      const { nickname } = requestBody(ctx);
      const seat = rooms.join(room, nickname as string, authFrom(ctx));
      ctx.status = 200;
      ctx.body = seatPayload(room, seat);
    });
  });

  // -- read ----------------------------------------------------------------
  router.get('/api/rooms/:code', async (ctx) => {
    await handled(ctx, async () => {
      const room = rooms.require(normaliseCode(ctx.params.code));
      // Once the match exists, boardgame.io's transport is the authority on who
      // is actually holding a socket; the room record only knows who has ever
      // asked for a seat.
      if (room.started && room.matchID) {
        const { metadata } = await db.fetch(room.matchID, { metadata: true });
        if (metadata) {
          for (const seat of room.seats) {
            const meta = metadata.players[Number(seat.playerID)];
            if (meta) seat.connected = !!meta.isConnected;
          }
        }
      }
      ctx.status = 200;
      ctx.body = roomPayload(room);
    });
  });

  // -- settings ------------------------------------------------------------
  router.patch('/api/rooms/:code/settings', body, async (ctx) => {
    await handled(ctx, () => {
      const room = rooms.require(normaliseCode(ctx.params.code));
      rooms.requireAdmin(room, authFrom(ctx));
      if (room.started) {
        throw new LobbyError(409, 'started', 'The game has already started.');
      }
      const next = validateSettings(room.settings, requestBody(ctx));
      // A seat cap cannot be dropped below the people already sitting down.
      const cap = (next.players as number | undefined) ?? room.seats.length;
      if (cap < room.seats.length) {
        throw new LobbyError(
          400,
          'bad-settings',
          `There are already ${room.seats.length} players in the room.`,
        );
      }
      room.settings = next;
      ctx.status = 200;
      ctx.body = { settings: room.settings };
    });
  });

  // -- start ---------------------------------------------------------------
  router.post('/api/rooms/:code/start', body, async (ctx) => {
    await handled(ctx, async () => {
      const room = rooms.require(normaliseCode(ctx.params.code));
      rooms.requireAdmin(room, authFrom(ctx));

      if (room.started) {
        // Idempotent: a double-tapped start button is not an error.
        ctx.status = 200;
        ctx.body = { started: true };
        return;
      }
      if (room.seats.length < MIN_PLAYERS) {
        throw new LobbyError(409, 'not-enough-players', 'Laundromat needs at least three players.');
      }

      const numPlayers = room.seats.length;
      const match = createMatch({
        game,
        numPlayers,
        setupData: { cfg: configForStart(room.settings) },
        unlisted: true,
      });
      if ('setupDataError' in match) {
        throw new LobbyError(400, 'bad-settings', match.setupDataError);
      }

      // Stamp OUR credentials into the match metadata.  boardgame.io's socket
      // transport authenticates against exactly this, which is what makes the
      // lobby's credentials and the game's credentials the same secret and
      // makes reconnection work without a second handshake.
      for (const seat of room.seats) {
        match.metadata.players[Number(seat.playerID)] = {
          id: Number(seat.playerID),
          name: seat.nickname,
          credentials: seat.credentials,
        };
      }

      await db.createMatch(room.code, match);
      room.matchID = room.code;
      room.started = true;

      ctx.status = 200;
      ctx.body = { started: true };
    });
  });
}
