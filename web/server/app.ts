/**
 * Wires the pieces together.  Kept separate from `index.ts` so tests can build
 * a server, listen on an ephemeral port and kill it, without the entry point's
 * process-level concerns (signals, logging, env).
 *
 * ONE ORIGIN.  The Koa app serves the built client, the lobby REST API and
 * boardgame.io's SocketIO transport on a single port.  There is therefore no
 * CORS configuration in this file, and there should never need to be: `origins`
 * is left unset because same-origin requests do not carry an Origin header that
 * needs allowing.
 */

import { Server, Origins } from 'boardgame.io/server';
import type { StorageAPI } from 'boardgame.io';
import { Laundromat } from '../src/game/Laundromat';
import { mountLobby } from './lobby';
import { RoomStore } from './rooms';
import { serveStatic, spaFallback } from './static';

export interface BuildOptions {
  /** Directory of the built client.  Omit to serve no static files (tests). */
  clientDir?: string;
  /** Injected by tests to control expiry. */
  rooms?: RoomStore;
  db?: StorageAPI.Sync | StorageAPI.Async;
  /**
   * Extra allowed origins.  Not needed for the single-origin deploy; useful in
   * development when Vite is on :5173 and this server is on :8000.
   */
  origins?: string[];
}

export function buildServer(opts: BuildOptions = {}) {
  const rooms = opts.rooms ?? new RoomStore();

  const server = Server({
    games: [Laundromat],
    ...(opts.db ? { db: opts.db } : {}),
    // Same-origin in production; localhost is here so `npm run dev` (Vite on
    // 5173) can talk to `npm run serve` (this, on 8000) during development.
    origins: [...(opts.origins ?? []), Origins.LOCALHOST],
  });

  // boardgame.io's own lobby API is not part of our contract and would let a
  // stranger create matches or read match metadata outside a room.  The socket
  // transport does not use these routes at all, so closing them costs nothing.
  server.app.use(async (ctx, next) => {
    if (ctx.path === '/games' || ctx.path.startsWith('/games/')) {
      ctx.status = 404;
      ctx.body = { error: 'not-found' };
      return;
    }
    await next();
  });

  if (opts.clientDir) {
    // Outermost first: the fallback wraps everything and only acts on a 404
    // that nothing else claimed.
    server.app.use(spaFallback(opts.clientDir));
    server.app.use(serveStatic(opts.clientDir));
  }

  mountLobby(server.router, { rooms, db: server.db, game: Laundromat });

  server.router.get('/api/health', (ctx) => {
    ctx.body = { ok: true, rooms: rooms.size(), uptime: process.uptime() };
  });

  return { server, rooms };
}
