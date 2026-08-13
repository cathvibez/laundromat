/**
 * Boots a real server on an ephemeral port for the server tests.
 *
 * Deliberately NOT a mock of Koa: the things most likely to be wrong here are
 * status codes, body parsing and middleware order, none of which a mock would
 * catch.  Port 0 lets the OS pick, so tests never collide with a dev server or
 * with each other.
 */

import { buildServer, type BuildOptions } from '../../server/app';
import { RoomStore } from '../../server/rooms';

export interface Harness {
  url: string;
  port: number;
  rooms: RoomStore;
  close(): Promise<void>;
  api<T = unknown>(
    path: string,
    init?: { method?: string; body?: unknown; playerID?: string; credentials?: string },
  ): Promise<{ status: number; body: T }>;
}

export async function startHarness(opts: BuildOptions = {}): Promise<Harness> {
  const rooms = opts.rooms ?? new RoomStore();
  const { server } = buildServer({ ...opts, rooms });
  const servers = await server.run(0);
  const address = servers.appServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    port,
    rooms,
    async close() {
      server.kill(servers);
      // The SocketIO transport keeps its own io() instance on the http server;
      // closing the koa server is enough for the process to exit under vitest.
      await new Promise((r) => setTimeout(r, 10));
    },
    async api(path, init = {}) {
      const headers: Record<string, string> = {};
      if (init.body !== undefined) headers['Content-Type'] = 'application/json';
      if (init.playerID !== undefined) headers['x-player-id'] = init.playerID;
      if (init.credentials !== undefined) headers['x-credentials'] = init.credentials;
      const res = await fetch(`${url}${path}`, {
        method: init.method ?? 'GET',
        headers,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return { status: res.status, body: body as never };
    },
  };
}

export interface SeatPayload {
  code: string;
  playerID: string;
  credentials: string;
  settings: Record<string, unknown>;
}

/** Create a room and fill it to `n` seats.  Returns every seat in order. */
export async function seatRoom(h: Harness, n: number): Promise<SeatPayload[]> {
  const first = await h.api<SeatPayload>('/api/rooms', {
    method: 'POST',
    body: { nickname: 'p0' },
  });
  const seats = [first.body];
  for (let i = 1; i < n; i++) {
    const r = await h.api<SeatPayload>(`/api/rooms/${first.body.code}/join`, {
      method: 'POST',
      body: { nickname: `p${i}` },
    });
    seats.push(r.body);
  }
  return seats;
}
