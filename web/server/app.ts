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
import { mountFeedback } from './feedbackRoutes';
import { openFeedbackDb } from './feedback';
import { RoomStore } from './rooms';
import { serveStatic, spaFallback } from './static';
import { attachLog, fingerprint, forRoom, forUser } from './log';

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

  /*
   * Tag every request with who and where, before anything else runs.
   *
   * `user` is the client's stored id, hashed (see fingerprint()). `room` is
   * lifted off the path, because that is the field a bug report actually gives
   * you — people say "room 8U3W is stuck", never a request id. Both land on
   * ctx.state so the handlers below inherit them without passing anything down.
   *
   * The completion line is `debug`: clients poll the lobby every few seconds,
   * so at info this would drown everything worth reading. Failures are logged
   * at their own level in `handled`.
   */
  server.app.use(async (ctx, next) => {
    const user = fingerprint(ctx.get('x-fingerprint') || undefined);
    const match = /^\/api\/rooms\/([A-Za-z0-9]{4})\b/.exec(ctx.path);
    const child = match ? forRoom(match[1].toUpperCase(), user) : forUser(user);
    attachLog(ctx, child);

    const started = Date.now();
    try {
      await next();
    } finally {
      child.debug(
        { method: ctx.method, path: ctx.path, status: ctx.status, ms: Date.now() - started },
        'request',
      );
    }
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

  // Sign-ups and reviews. Opened here rather than at import time so a server
  // built for a test does not touch the disk, and so a failure to open the
  // store disables the feature instead of stopping the game server.
  openFeedbackDb();
  mountFeedback(server.router);

  server.router.get('/api/health', (ctx) => {
    ctx.body = { ok: true, rooms: rooms.size(), uptime: process.uptime() };
  });

  return { server, rooms };
}
