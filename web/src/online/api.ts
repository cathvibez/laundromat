/**
 * The client's view of the networking layer.
 *
 * `src/net/` belongs to the transport work and is written separately; this file
 * is the ONLY place that knows how to reach it, so the lobby components import
 * from here and never from `../net` directly.
 *
 * Why it is loaded through `import.meta.glob` rather than a plain import:
 * the two halves of multiplayer are built in parallel, and a hard
 * `import ... from '../net'` makes the whole app fail to typecheck and every
 * existing test fail whenever that directory is absent or mid-edit. The glob is
 * statically analysed by Vite (so the real module IS bundled when it exists),
 * matches nothing when the directory is missing, and gives us one honest place
 * to say "the online service is not available" instead of a white screen.
 */

import type { LaundromatConfig } from '../rules/types';

export type OnlineSettings = Partial<LaundromatConfig>;

export interface Auth {
  playerID: string;
  credentials: string;
}

/** A seat in a room. `playerID` is a string because boardgame.io's are. */
export interface RoomPlayer {
  playerID: string;
  nickname: string;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  started: boolean;
  settings: OnlineSettings;
  players: RoomPlayer[];
}

export interface Seat {
  code: string;
  playerID: string;
  credentials: string;
  settings: OnlineSettings;
}

/** boardgame.io's `Client()` return value: a React component. */
export type GameClient = React.ComponentType<Record<string, unknown>>;

export interface NetApi {
  createRoom(nickname: string): Promise<Seat>;
  joinRoom(code: string, nickname: string): Promise<Seat>;
  getRoom(code: string): Promise<RoomInfo>;
  updateSettings(
    code: string,
    auth: Auth,
    partial: OnlineSettings,
  ): Promise<{ settings: OnlineSettings }>;
  startGame(code: string, auth: Auth): Promise<{ started: boolean }>;
  makeClient(seat: { code: string; playerID: string; credentials: string }): GameClient;
}

const REQUIRED: (keyof NetApi)[] = [
  'createRoom',
  'joinRoom',
  'getRoom',
  'updateSettings',
  'startGame',
  'makeClient',
];

/** Room codes avoid I, O, 0 and 1 — they are read aloud and photographed. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export function normaliseCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH);
}

export function isCompleteCode(code: string): boolean {
  return code.length === CODE_LENGTH;
}

// ---------------------------------------------------------------------------
// Loading the real module
// ---------------------------------------------------------------------------

/** Tests inject a fake here; nothing else may. */
let injected: NetApi | null = null;

export function __setNetForTests(impl: NetApi | null): void {
  injected = impl;
  cached = impl;
}

let cached: NetApi | null = null;

/**
 * Preferred first, then anything else the directory offers. `server.ts` is
 * skipped by name: pulling a node-only module into the browser bundle would
 * take the whole page down.
 */
const PREFERRED = ['index', 'client', 'api', 'net', 'room', 'lobby', 'multiplayer'];

function baseName(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.tsx?$/, '');
}

export class NetUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetUnavailable';
  }
}

export async function loadNet(): Promise<NetApi> {
  if (injected) return injected;
  if (cached) return cached;

  const modules = import.meta.glob('../net/*.{ts,tsx}') as Record<
    string,
    () => Promise<Record<string, unknown>>
  >;

  const paths = Object.keys(modules)
    .filter((p) => !/(^|\/)(server|index\.server)\.tsx?$/.test(p))
    .filter((p) => !/\.(test|spec|d)\.tsx?$/.test(p))
    .sort((a, b) => {
      const ia = PREFERRED.indexOf(baseName(a));
      const ib = PREFERRED.indexOf(baseName(b));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  if (paths.length === 0) {
    throw new NetUnavailable(
      'Online play is not available in this build — the networking module is missing.',
    );
  }

  const found: Partial<NetApi> = {};
  for (const p of paths) {
    let mod: Record<string, unknown>;
    try {
      mod = await modules[p]();
    } catch {
      continue; // a module that will not even load cannot contribute
    }
    for (const key of REQUIRED) {
      if (found[key] === undefined && typeof mod[key] === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (found as any)[key] = mod[key];
      }
    }
    if (REQUIRED.every((k) => found[k] !== undefined)) break;
  }

  const missing = REQUIRED.filter((k) => found[k] === undefined);
  if (missing.length > 0) {
    throw new NetUnavailable(
      `Online play is not available in this build — the networking module is incomplete (missing ${missing.join(', ')}).`,
    );
  }

  cached = found as NetApi;
  return cached;
}

// ---------------------------------------------------------------------------
// Turning failures into sentences
// ---------------------------------------------------------------------------

export type NetContext = 'create' | 'join' | 'lobby' | 'settings' | 'start';

interface CodedError {
  code?: unknown;
  status?: unknown;
  message?: unknown;
  reason?: unknown;
}

function textOf(e: unknown): string {
  const c = (e ?? {}) as CodedError;
  return [c.code, c.reason, c.message, String(e)]
    .filter((x) => typeof x === 'string')
    .join(' ')
    .toLowerCase();
}

/**
 * Every failure the player can hit has to arrive as a sentence. A status code
 * on screen is a dead end — the player cannot tell whether to retype the code,
 * wait, or start again.
 */
export function humanNetError(e: unknown, ctx: NetContext): string {
  if (e instanceof NetUnavailable) return e.message;
  const t = textOf(e);
  const status = Number((e as CodedError)?.status ?? NaN);

  if (t.includes('not_found') || t.includes('not found') || t.includes('no such') || status === 404) {
    return ctx === 'join'
      ? 'No room with that code. Codes are four characters and expire when the room is closed — check with whoever set it up.'
      : 'That room is gone. Whoever set it up may have closed it.';
  }
  if (t.includes('full') || status === 409) {
    return 'That room is full. Laundromat seats six players at most.';
  }
  if (t.includes('started') || t.includes('in progress') || status === 410) {
    return ctx === 'join'
      ? 'That game has already started, and Laundromat has no spectator seats. You can only rejoin a game you were already in.'
      : 'The game has already started, so that can no longer be changed.';
  }
  if (t.includes('forbidden') || t.includes('not admin') || t.includes('unauthor') || status === 401 || status === 403) {
    return 'Only the player who created the room can change that.';
  }
  if (t.includes('min') && t.includes('player')) {
    return 'Laundromat needs at least three players.';
  }
  if (t.includes('nickname') || t.includes('name taken')) {
    return 'Someone in that room is already using that name. Pick another.';
  }
  if (
    t.includes('failed to fetch') ||
    t.includes('networkerror') ||
    t.includes('network error') ||
    t.includes('econnrefused') ||
    t.includes('load failed')
  ) {
    return 'Could not reach the game server. Check your connection and try again.';
  }

  const raw = typeof (e as CodedError)?.message === 'string' ? ((e as CodedError).message as string) : '';
  const tail = raw && raw.length < 140 ? ` (${raw})` : '';
  switch (ctx) {
    case 'create':
      return `Could not open a room${tail}. Try again in a moment.`;
    case 'join':
      return `Could not join that room${tail}. Try again in a moment.`;
    case 'settings':
      return `That setting did not save${tail}. It is unchanged for everyone else too.`;
    case 'start':
      return `Could not start the game${tail}. Try again in a moment.`;
    default:
      return `Lost touch with the room${tail}. Retrying.`;
  }
}
