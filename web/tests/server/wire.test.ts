/**
 * Multiplayer, over an actual socket.
 *
 * Everything else in tests/server/ tests a piece.  This one tests the claim:
 * three real boardgame.io clients connect to a real server over real SocketIO,
 * one of them makes a move, and the others SEE it.  No mocks, no in-process
 * transport shim — if this passes, a state change crossed the wire.
 *
 * It also re-checks the hand masking at the far end, which is the only place
 * the check really counts: not "the filter function returns X" but "the bytes
 * that arrived in another player's process do not contain my cards".
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import type { Ctx } from 'boardgame.io';
import { Laundromat, type LaundromatG } from '../../src/game/Laundromat';
import { startHarness, seatRoom, type Harness, type SeatPayload } from './harness';

const TIMEOUT = 15_000;

/**
 * boardgame.io does not export `_ClientImpl`'s type from its public entry
 * points, so this is the slice of it these tests actually use.  Naming the
 * fields explicitly is worth more than `any` here: `G` is typed, so a leak
 * assertion that reaches for a field that no longer exists fails to compile.
 */
interface ClientState {
  G: LaundromatG;
  ctx: Ctx;
  _stateID: number;
  isConnected: boolean;
}

interface LaundromatClient {
  start(): void;
  stop(): void;
  getState(): ClientState | null;
  moves: Record<string, (...args: unknown[]) => void>;
}

/** Poll until `test` holds, or throw with a useful message. */
async function until(label: string, test: () => boolean, ms = 8000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (test()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for: ${label}`);
}

function connect(url: string, seat: SeatPayload): LaundromatClient {
  const client = Client({
    game: Laundromat,
    matchID: seat.code,
    playerID: seat.playerID,
    credentials: seat.credentials,
    multiplayer: SocketIO({ server: url }),
    debug: false,
  }) as unknown as LaundromatClient;
  client.start();
  return client;
}

let h: Harness;
let seats: SeatPayload[];
let clients: LaundromatClient[] = [];

beforeAll(async () => {
  h = await startHarness();
  seats = await seatRoom(h, 3);
  const admin = seats[0];
  const started = await h.api<{ started: boolean }>(`/api/rooms/${admin.code}/start`, {
    method: 'POST',
    playerID: admin.playerID,
    credentials: admin.credentials,
  });
  expect(started.body.started).toBe(true);

  clients = seats.map((s) => connect(h.url, s));
  await until(
    'all three clients to sync with the server',
    () => clients.every((c) => c.getState() !== null && c.getState()!.isConnected === true),
    TIMEOUT,
  );
}, TIMEOUT + 5000);

afterAll(async () => {
  for (const c of clients) {
    try {
      c.stop();
    } catch {
      /* already gone */
    }
  }
  await h.close();
});

describe('three clients on one server', () => {
  it('all three receive the same public board', () => {
    const states = clients.map((c) => c.getState()!);
    expect(states.every((s) => s !== null)).toBe(true);

    const machines = states.map((s) => JSON.stringify(s.G.machines));
    expect(new Set(machines).size).toBe(1);

    const day = states.map((s) => s.G.day);
    expect(new Set(day).size).toBe(1);

    // A three-player game gets four washers (MACHINES_BY_PLAYERS), which also
    // proves the lobby's seat count reached setup().
    expect(states[0].G.machines).toHaveLength(4);
    expect(states[0].G.players).toHaveLength(3);
  });

  it('the settings the admin chose reached setup over the wire', () => {
    const cfg = clients[0].getState()!.G.cfg;
    expect(cfg.players).toBe(3);
    expect(cfg.machines).toBe(4);
  });

  it(
    'a move made by one client is seen by the others',
    async () => {
      const before = clients.map((c) => c.getState()!);
      const current = Number(before[0].ctx.currentPlayer);
      const mover = clients[current];
      const watchers = clients.filter((_, i) => i !== current);

      // Everyone agrees nobody has rolled yet.
      expect(before.every((s) => s.G.turn?.face == null)).toBe(true);
      const stateIDBefore = before[0]._stateID;

      mover.moves.roll();

      await until(
        'the other clients to see the die',
        () => watchers.every((c) => c.getState()!.G.turn?.face != null),
        TIMEOUT,
      );

      const after = clients.map((c) => c.getState()!);
      const faces = after.map((s) => s.G.turn!.face);
      expect(new Set(faces).size).toBe(1); // one authoritative die, not three
      expect(faces[0]).toBeGreaterThanOrEqual(1);
      expect(faces[0]).toBeLessThanOrEqual(6);

      // The state ID advanced for everyone: this is a server-ordered update,
      // not three clients independently guessing.
      for (const s of after) expect(s._stateID).toBeGreaterThan(stateIDBefore);

      // And the log entry the server wrote is on every client.
      const logs = after.map((s) => s.G.log.length);
      expect(new Set(logs).size).toBe(1);
      expect(logs[0]).toBeGreaterThan(before[0].G.log.length);
    },
    TIMEOUT,
  );

  it('a client cannot move out of turn', async () => {
    const current = Number(clients[0].getState()!.ctx.currentPlayer);
    const notTheirTurn = clients[(current + 1) % clients.length];
    const before = notTheirTurn.getState()!._stateID;
    notTheirTurn.moves.roll();
    await new Promise((r) => setTimeout(r, 300));
    expect(notTheirTurn.getState()!._stateID).toBe(before);
  });

  it('the hands that actually arrived over the socket are masked', () => {
    for (let me = 0; me < 3; me++) {
      const state = clients[me].getState()!;

      // My own hand is real.
      const mine = state.G.players[me].hand;
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((id) => id.startsWith(`${me}-`))).toBe(true);

      for (let other = 0; other < 3; other++) {
        if (other === me) continue;
        const seen = state.G.players[other].hand;
        // Count preserved, identities gone.
        expect(seen).toHaveLength(clients[other].getState()!.G.players[other].hand.length);
        expect(seen.every((c) => c === 'hidden')).toBe(true);
        expect(state.G.players[other].ready.every((c) => String(c) === 'hidden')).toBe(true);
      }

      // Belt and braces: nothing anywhere in the received G names another
      // player's card. Item ids are `${owner}-${type}-${shade}`; `G.items` is a
      // public registry of all of them, so we scan the player zones only.
      const zones = JSON.stringify(state.G.players.map((p) => ({ hand: p.hand, ready: p.ready })));
      for (let other = 0; other < 3; other++) {
        if (other === me) continue;
        expect(zones).not.toMatch(new RegExp(`"${other}-[a-z]+-[DL]"`));
      }
    }
  });

  it('a reconnecting client lands back in its own seat with its own hand', async () => {
    const seat = seats[2];
    const original = clients[2].getState()!.G.players[2].hand;

    // What a page reload looks like: the socket goes away, and the stored
    // {code, playerID, credentials} is used to build a fresh client.
    clients[2].stop();
    await new Promise((r) => setTimeout(r, 100));

    const rejoined = await h.api<SeatPayload>(`/api/rooms/${seat.code}/join`, {
      method: 'POST',
      playerID: seat.playerID,
      credentials: seat.credentials,
      body: { nickname: 'p2' },
    });
    expect(rejoined.status).toBe(200);
    expect(rejoined.body.playerID).toBe('2');
    expect(rejoined.body.credentials).toBe(seat.credentials);

    const back = connect(h.url, rejoined.body);
    clients[2] = back;
    await until(
      'the reconnected client to resync',
      () => back.getState() !== null && back.getState()!.isConnected === true,
      TIMEOUT,
    );

    expect(back.getState()!.G.players[2].hand).toEqual(original);
    expect(back.getState()!.G.players[0].hand.every((c) => c === 'hidden')).toBe(true);
  }, TIMEOUT);

  it('a client with the wrong credentials is never given the game at all', async () => {
    const impostor = connect(h.url, { ...seats[1], credentials: 'wrong-secret' });
    try {
      const before = clients[0].getState()!._stateID;
      // Two seconds is an age on a loopback socket; the honest clients above
      // synced in under one.
      await new Promise((r) => setTimeout(r, 2000));

      // No state means no hand, no board, and nothing to leak.  The server
      // never sends the initial `sync`, so the client's local reducer has
      // nothing to run against — an impostor cannot even attempt a move.
      expect(impostor.getState()).toBeNull();

      // The honest game is unmoved.
      expect(clients[0].getState()!._stateID).toBe(before);
    } finally {
      impostor.stop();
    }
  }, TIMEOUT);
});
