/**
 * The CLIENT half of the transport: lobby HTTP calls, and the factory that
 * builds a networked boardgame.io client.
 *
 * `src/online/api.ts` declares the interface this module fills (`NetApi`) and
 * loads it lazily, so nothing here may be imported directly by the UI.  The
 * six exports below are the whole contract:
 *
 *   createRoom  joinRoom  getRoom  updateSettings  startGame  makeClient
 *
 * Same origin by default.  The server serves the bundle, the REST API and the
 * socket from one port, so `''` as a base URL is correct in production and
 * VITE_SERVER_URL exists only for `npm run dev`, where Vite is on 5173 and the
 * game server is on 8000.
 */

import { createElement, type ComponentType } from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Laundromat } from '../game/Laundromat';
import { Board } from '../ui/Board';
import type { Auth, GameClient, OnlineSettings, RoomInfo, Seat } from '../online/api';

/** '' in production: the client is served by the game server itself. */
export const SERVER_URL: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SERVER_URL ?? '';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class NetError extends Error {
  /**
   * What `humanNetError` reads.  It is USUALLY the HTTP status, but see the
   * note on `statusFor` — one case is deliberately remapped so the player gets
   * the right sentence.
   */
  readonly status: number;
  /** The server's machine-readable `error` field, verbatim. */
  readonly code: string;
  /** The true HTTP status, for logs and for anyone who needs the wire truth. */
  readonly httpStatus: number;

  constructor(httpStatus: number, code: string, message: string) {
    super(message);
    this.name = 'NetError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.status = statusFor(httpStatus, code);
  }
}

/**
 * The contract says a join into a started room is 409, the same status as a
 * join into a full room.  The UI's error copy distinguishes them and checks
 * status before code, so a bare 409 would tell someone locked out of a game in
 * progress that the room is "full" — which is both wrong and unactionable.
 *
 * The WIRE keeps the contracted 409.  Only the thrown object is remapped, to
 * 410 Gone, which is what the UI already understands as "already started".
 * `httpStatus` still reports the truth.
 */
function statusFor(httpStatus: number, code: string): number {
  if (httpStatus === 409 && code === 'started') return 410;
  return httpStatus;
}

async function request<T>(
  path: string,
  init: { method?: string; auth?: Auth; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth) {
    headers['x-player-id'] = init.auth.playerID;
    headers['x-credentials'] = init.auth.credentials;
  }

  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch (e) {
    // fetch only rejects on a transport failure; humanNetError has copy for it.
    throw new NetError(0, 'network', (e as Error)?.message || 'Failed to fetch');
  }

  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const p = (payload ?? {}) as { error?: string; message?: string };
    throw new NetError(res.status, p.error ?? String(res.status), p.message ?? p.error ?? text);
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

export function createRoom(nickname: string): Promise<Seat> {
  return request<Seat>('/api/rooms', { method: 'POST', body: { nickname } });
}

export function joinRoom(code: string, nickname: string, auth?: Auth): Promise<Seat> {
  return request<Seat>(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: { nickname },
    ...(auth ? { auth } : {}),
  });
}

export function getRoom(code: string): Promise<RoomInfo> {
  return request<RoomInfo>(`/api/rooms/${encodeURIComponent(code)}`);
}

export function updateSettings(
  code: string,
  auth: Auth,
  partial: OnlineSettings,
): Promise<{ settings: OnlineSettings }> {
  return request(`/api/rooms/${encodeURIComponent(code)}/settings`, {
    method: 'PATCH',
    auth,
    body: partial,
  });
}

export function startGame(code: string, auth: Auth): Promise<{ started: boolean }> {
  return request(`/api/rooms/${encodeURIComponent(code)}/start`, {
    method: 'POST',
    auth,
    body: {},
  });
}

// ---------------------------------------------------------------------------
// The game client
// ---------------------------------------------------------------------------

/**
 * The room code IS the matchID, and the credentials are the same string the
 * lobby issued — the server stamped them into the match metadata at start, so
 * boardgame.io's socket authenticates against them directly.  That is what
 * makes reconnection a page reload rather than a handshake.
 *
 * `Laundromat` is used unmodified: no `makeLaundromat(overrides)`.  Over a
 * network the config travels as `setupData`, which the server wrote once at
 * start; a client-side override here would be ignored by the authoritative
 * reducer and would only desync the optimistic local one.
 */
export function makeClient(seat: {
  code: string;
  playerID: string;
  credentials: string;
}): GameClient {
  const Networked = Client({
    game: Laundromat,
    board: Board,
    multiplayer: SocketIO(SERVER_URL ? { server: SERVER_URL } : {}),
    debug: false,
  });

  // `matchID`, `playerID` and `credentials` are PROPS of the component
  // boardgame.io returns, not options to `Client()`.  Closing over the seat
  // here keeps `NetApi.makeClient(seat) => Component` true, and means the UI
  // never has to know that the room code doubles as the matchID.
  const Seated = (props: Record<string, unknown>) =>
    createElement(Networked as unknown as ComponentType<Record<string, unknown>>, {
      ...props,
      matchID: seat.code,
      playerID: seat.playerID,
      credentials: seat.credentials,
    });
  Seated.displayName = `Laundromat(${seat.code}/${seat.playerID})`;
  return Seated;
}
