/**
 * The lobby room store.
 *
 * A ROOM is not a boardgame.io match.  A room exists from the moment somebody
 * presses "new game" until four hours later; the match is only created at the
 * instant the admin starts, because that is the first moment the seat count and
 * the ruleset are both final and boardgame.io bakes both into `setup()`.
 *
 * Consequences worth stating, because they are the whole design:
 *   - joining is cheap and reversible: nobody is holding a seat in a reducer;
 *   - settings can change freely right up to the start;
 *   - `numPlayers` is the number of people actually sitting down, so a room
 *     opened for six and started by four is a four-player game, not a
 *     four-player game with two abandoned seats.
 *
 * Storage is in memory and deliberately so (v1, no database).  A restart drops
 * every room; the deploy notes say so out loud.
 */

import { randomBytes, randomInt } from 'node:crypto';
import { assertDeckSize, defaultConfig, MACHINES_BY_PLAYERS } from '../src/rules/config';
import type { LaundromatConfig } from '../src/rules/types';
import { EVENTS, SPECIALS } from '../src/rules/types';

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

/**
 * Read aloud across a room and photographed off a screen, so I, O, 0 and 1 are
 * all absent.  32 symbols ^ 4 = 1,048,576 codes; collisions are resolved by
 * retry, not by hope.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export function generateCode(taken: (code: string) => boolean): string {
  // 200 attempts is > 99.99% safe until the store holds ~800k live rooms, at
  // which point in-memory storage is the smaller problem.
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!taken(code)) return code;
  }
  throw new Error('Could not allocate a free room code.');
}

export function isWellFormedCode(code: string): boolean {
  return (
    typeof code === 'string' &&
    code.length === CODE_LENGTH &&
    [...code].every((c) => CODE_ALPHABET.includes(c))
  );
}

/** People type lowercase and paste whitespace. */
export function normaliseCode(raw: unknown): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface Seat {
  /** boardgame.io playerID: "0".."5".  Seat "0" is the admin. */
  playerID: string;
  nickname: string;
  /** Never leaves the server except to the one player it belongs to. */
  credentials: string;
  connected: boolean;
}

export type RoomSettings = Partial<LaundromatConfig>;

export interface Room {
  code: string;
  createdAt: number;
  started: boolean;
  /** Set at start; equals the code.  Kept explicit so the two can diverge. */
  matchID: string | null;
  settings: RoomSettings;
  seats: Seat[];
}

export const ADMIN_PLAYER_ID = '0';
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const ROOM_TTL_MS = 4 * 60 * 60 * 1000; // four hours from creation

/** Seat cap for a brand new room.  The admin may narrow it to 3. */
export const DEFAULT_SEATS = MAX_PLAYERS;

/** Thrown by the store, mapped onto HTTP status codes by the router. */
export class LobbyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'LobbyError';
  }
}

// ---------------------------------------------------------------------------
// Settings validation
// ---------------------------------------------------------------------------

/**
 * `machines` is absent on purpose: it is a function of the seat count
 * (MACHINES_BY_PLAYERS) and letting a lobby override it would put the board out
 * of step with the rulebook.  Everything else in config.ts is here.
 *
 * Four keys left this list in v10 — circuitBreak, eventTiming,
 * sanitizerOwnerOnly and publicDampZone.  They are not missing: the rules they
 * selected between no longer have alternatives, so the fields are gone from
 * LaundromatConfig entirely.  Do not add them back to "restore symmetry"; the
 * final gate below would reject them anyway, since it builds a real config.
 */
const BOOLEAN_KEYS = [
  'keyholderFirst',
  'bleachKillsDark',
  'socksBlanketExtraWash',
  'ownItemsDontTaint',
] as const;

const POSITIVE_INT_KEYS = ['capacity', 'handSize', 'crowdThreshold', 'dayCap'] as const;

const ENUM_KEYS = {
  turnOrder: ['cardLoadExtra', 'extraLoadCard'],
  meshBagRule: ['guaranteed', 'v8net'],
} as const;

export const SETTABLE_KEYS: readonly string[] = [
  'players',
  ...POSITIVE_INT_KEYS,
  ...BOOLEAN_KEYS,
  ...Object.keys(ENUM_KEYS),
  'specialDeck',
  'eventDeck',
];

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * Validate a PARTIAL update against the room's current settings, returning the
 * merged result.  Anything that would not survive `defaultConfig` +
 * `assertDeckSize` is rejected here rather than being allowed to reach setup(),
 * where it would take the match down after everyone has already sat down.
 */
export function validateSettings(current: RoomSettings, patch: unknown): RoomSettings {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new LobbyError(400, 'bad-settings', 'Settings must be an object.');
  }
  const input = patch as Record<string, unknown>;

  for (const key of Object.keys(input)) {
    if (!SETTABLE_KEYS.includes(key)) {
      throw new LobbyError(400, 'bad-settings', `Unknown or fixed setting: ${key}`);
    }
  }

  const merged: Record<string, unknown> = { ...current };

  if ('players' in input) {
    const seats = input.players;
    if (!isPositiveInt(seats) || seats < MIN_PLAYERS || seats > MAX_PLAYERS) {
      throw new LobbyError(400, 'bad-settings', `Seats must be ${MIN_PLAYERS}-${MAX_PLAYERS}.`);
    }
    merged.players = seats;
    // Keep the derived value honest even though it is not settable.
    merged.machines = MACHINES_BY_PLAYERS[seats];
  }

  for (const key of POSITIVE_INT_KEYS) {
    if (key in input) {
      if (!isPositiveInt(input[key])) {
        throw new LobbyError(400, 'bad-settings', `${key} must be a positive integer.`);
      }
      merged[key] = input[key];
    }
  }

  for (const key of BOOLEAN_KEYS) {
    if (key in input) {
      if (typeof input[key] !== 'boolean') {
        throw new LobbyError(400, 'bad-settings', `${key} must be true or false.`);
      }
      merged[key] = input[key];
    }
  }

  for (const [key, allowed] of Object.entries(ENUM_KEYS)) {
    if (key in input) {
      if (!(allowed as readonly string[]).includes(String(input[key]))) {
        throw new LobbyError(
          400,
          'bad-settings',
          `${key} must be one of ${(allowed as readonly string[]).join(', ')}.`,
        );
      }
      merged[key] = input[key];
    }
  }

  if ('specialDeck' in input) {
    merged.specialDeck = validateCounts(input.specialDeck, SPECIALS, 'specialDeck');
  }
  if ('eventDeck' in input) {
    merged.eventDeck = validateCounts(input.eventDeck, EVENTS, 'eventDeck');
  }

  // The real gate: run the exact assertions config.ts runs at setup.
  const seats = (merged.players as number | undefined) ?? DEFAULT_SEATS;
  let cfg: LaundromatConfig;
  try {
    cfg = defaultConfig(seats, merged as RoomSettings);
  } catch (e) {
    throw new LobbyError(400, 'bad-settings', (e as Error).message);
  }
  try {
    assertDeckSize(cfg);
  } catch (e) {
    throw new LobbyError(400, 'bad-settings', (e as Error).message);
  }

  return merged as RoomSettings;
}

function validateCounts(
  value: unknown,
  names: readonly string[],
  label: string,
): Record<string, number> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new LobbyError(400, 'bad-settings', `${label} must be an object of card counts.`);
  }
  const out: Record<string, number> = {};
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!names.includes(key)) {
      throw new LobbyError(400, 'bad-settings', `${label}: unknown card "${key}".`);
    }
  }
  for (const name of names) {
    const n = input[name];
    if (n === undefined) {
      throw new LobbyError(400, 'bad-settings', `${label}: missing count for "${name}".`);
    }
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
      throw new LobbyError(400, 'bad-settings', `${label}: "${name}" must be a whole number >= 0.`);
    }
    out[name] = n;
  }
  return out;
}

export function newRoomSettings(): RoomSettings {
  return { players: DEFAULT_SEATS, machines: MACHINES_BY_PLAYERS[DEFAULT_SEATS] };
}

/**
 * The config actually handed to `setup()`.  `players`/`machines` are RE-DERIVED
 * from the seat count of the people who actually started, so a room opened for
 * six and started by four gets a four-player board.  Passing a stale
 * `players: 6` through would win the spread in `defaultConfig` and give a
 * four-player game a six-player deal.
 */
export function configForStart(settings: RoomSettings): RoomSettings {
  const cfg: Record<string, unknown> = { ...settings };
  delete cfg.players;
  delete cfg.machines;
  return cfg as RoomSettings;
}

// ---------------------------------------------------------------------------
// Nicknames
// ---------------------------------------------------------------------------

export const MAX_NICKNAME = 24;

export function cleanNickname(raw: unknown): string {
  const n = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NICKNAME);
  if (n.length === 0) throw new LobbyError(400, 'bad-nickname', 'A nickname is required.');
  return n;
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

export function makeCredentials(): string {
  return randomBytes(24).toString('base64url');
}

export class RoomStore {
  private rooms = new Map<string, Room>();

  constructor(
    private readonly now: () => number = Date.now,
    readonly ttlMs: number = ROOM_TTL_MS,
  ) {}

  /** Rooms are swept lazily on every lookup and eagerly by the reaper. */
  private expired(room: Room): boolean {
    return this.now() - room.createdAt > this.ttlMs;
  }

  sweep(): number {
    let n = 0;
    for (const [code, room] of this.rooms) {
      if (this.expired(room)) {
        this.rooms.delete(code);
        n++;
      }
    }
    return n;
  }

  get(code: string): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    if (this.expired(room)) {
      this.rooms.delete(code);
      return undefined;
    }
    return room;
  }

  require(code: string): Room {
    const room = this.get(code);
    if (!room) throw new LobbyError(404, 'not-found', 'No room with that code.');
    return room;
  }

  size(): number {
    return this.rooms.size;
  }

  create(nickname: string): Room {
    const code = generateCode((c) => this.rooms.has(c));
    const room: Room = {
      code,
      createdAt: this.now(),
      started: false,
      matchID: null,
      settings: newRoomSettings(),
      seats: [
        {
          playerID: ADMIN_PLAYER_ID,
          nickname: cleanNickname(nickname),
          credentials: makeCredentials(),
          connected: true,
        },
      ],
    };
    this.rooms.set(code, room);
    return room;
  }

  seatCap(room: Room): number {
    const seats = room.settings.players;
    return typeof seats === 'number' ? seats : DEFAULT_SEATS;
  }

  /**
   * Join, or RE-join.  Reconnection is the common case, not the exception:
   * phones lock, tabs reload, and a player who is bounced must land back in the
   * same seat rather than being told the room is full of themselves.
   *
   * Three doors, in order:
   *   1. credentials for an existing seat  -> that seat, always, even mid-game.
   *   2. an unused nickname, pre-start     -> a new seat.
   *   3. the nickname of a DISCONNECTED seat, pre-start -> that seat back.
   *      (This is the "I cleared my browser storage" path.  It is deliberately
   *      not offered once the game has started, where a stolen seat would mean
   *      a stolen hand.)
   */
  join(
    room: Room,
    nickname: string,
    auth?: { playerID?: string; credentials?: string },
  ): Seat {
    const byCredentials = this.authenticate(room, auth);
    if (byCredentials) {
      byCredentials.connected = true;
      if (nickname) byCredentials.nickname = nickname;
      return byCredentials;
    }

    const name = cleanNickname(nickname);
    const sameName = room.seats.find((s) => s.nickname.toLowerCase() === name.toLowerCase());

    if (room.started) {
      // Reclaiming a seat mid-game requires credentials; a name is not enough.
      throw new LobbyError(409, 'started', 'That game has already started.');
    }

    if (sameName) {
      if (sameName.connected) {
        throw new LobbyError(409, 'nickname-taken', 'Someone in that room already uses that name.');
      }
      sameName.connected = true;
      return sameName;
    }

    if (room.seats.length >= this.seatCap(room)) {
      throw new LobbyError(409, 'full', 'That room is full.');
    }

    const seat: Seat = {
      playerID: String(room.seats.length),
      nickname: name,
      credentials: makeCredentials(),
      connected: true,
    };
    room.seats.push(seat);
    return seat;
  }

  /** Constant-time-ish credential check.  Returns the seat, or null. */
  authenticate(room: Room, auth?: { playerID?: string; credentials?: string }): Seat | null {
    if (!auth?.credentials) return null;
    const seat = auth.playerID
      ? room.seats.find((s) => s.playerID === String(auth.playerID))
      : room.seats.find((s) => s.credentials === auth.credentials);
    if (!seat) return null;
    return seat.credentials === auth.credentials ? seat : null;
  }

  requireAdmin(room: Room, auth?: { playerID?: string; credentials?: string }): Seat {
    const seat = this.authenticate(room, auth);
    if (!seat || seat.playerID !== ADMIN_PLAYER_ID) {
      throw new LobbyError(403, 'not-admin', 'Only the player who opened the room can do that.');
    }
    return seat;
  }

  /** Test seam. */
  put(room: Room): void {
    this.rooms.set(room.code, room);
  }

  clear(): void {
    this.rooms.clear();
  }
}
