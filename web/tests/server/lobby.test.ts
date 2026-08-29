/**
 * The lobby REST contract, exercised over real HTTP.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, seatRoom, type Harness, type SeatPayload } from './harness';
import { CODE_ALPHABET, RoomStore } from '../../server/rooms';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.close();
});

describe('POST /api/rooms', () => {
  it('returns a well-formed code, seat 0 and credentials', async () => {
    const { status, body } = await h.api<SeatPayload>('/api/rooms', {
      method: 'POST',
      body: { nickname: 'Ada' },
    });
    expect(status).toBe(200);
    expect(body.code).toHaveLength(4);
    expect(body.code).toMatch(/^[A-Z2-9]{4}$/);
    // The unambiguous alphabet: no I, O, 0 or 1.
    for (const c of body.code) expect(CODE_ALPHABET).toContain(c);
    expect(body.code).not.toMatch(/[IO01]/);
    expect(body.playerID).toBe('0');
    expect(typeof body.credentials).toBe('string');
    expect(body.credentials.length).toBeGreaterThan(16);
    expect(body.settings.players).toBe(6);
  });

  it('issues different codes and different credentials each time', async () => {
    const codes = new Set<string>();
    const creds = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const { body } = await h.api<SeatPayload>('/api/rooms', {
        method: 'POST',
        body: { nickname: 'x' },
      });
      codes.add(body.code);
      creds.add(body.credentials);
    }
    expect(codes.size).toBe(25);
    expect(creds.size).toBe(25);
  });

  it('rejects a blank nickname', async () => {
    const { status, body } = await h.api<{ error: string }>('/api/rooms', {
      method: 'POST',
      body: { nickname: '   ' },
    });
    expect(status).toBe(400);
    expect(body.error).toBe('bad-nickname');
  });
});

describe('POST /api/rooms/:code/join', () => {
  it('hands out seats 1, 2, ... in order', async () => {
    const seats = await seatRoom(h, 4);
    expect(seats.map((s) => s.playerID)).toEqual(['0', '1', '2', '3']);
    expect(new Set(seats.map((s) => s.credentials)).size).toBe(4);
  });

  it('404s an unknown code', async () => {
    const { status, body } = await h.api<{ error: string }>('/api/rooms/ZZZZ/join', {
      method: 'POST',
      body: { nickname: 'nobody' },
    });
    expect(status).toBe(404);
    expect(body.error).toBe('not-found');
  });

  it('409 full once the seat cap is reached', async () => {
    const seats = await seatRoom(h, 6);
    const { status, body } = await h.api<{ error: string }>(`/api/rooms/${seats[0].code}/join`, {
      method: 'POST',
      body: { nickname: 'seventh' },
    });
    expect(status).toBe(409);
    expect(body.error).toBe('full');
  });

  it('409 full against a narrowed seat cap, not just the hard maximum', async () => {
    const seats = await seatRoom(h, 3);
    const admin = seats[0];
    const patch = await h.api(`/api/rooms/${admin.code}/settings`, {
      method: 'PATCH',
      playerID: admin.playerID,
      credentials: admin.credentials,
      body: { players: 3 },
    });
    expect(patch.status).toBe(200);
    const { status, body } = await h.api<{ error: string }>(`/api/rooms/${admin.code}/join`, {
      method: 'POST',
      body: { nickname: 'fourth' },
    });
    expect(status).toBe(409);
    expect(body.error).toBe('full');
  });

  it('409 started once the game is running', async () => {
    const seats = await seatRoom(h, 3);
    const admin = seats[0];
    const started = await h.api(`/api/rooms/${admin.code}/start`, {
      method: 'POST',
      playerID: admin.playerID,
      credentials: admin.credentials,
    });
    expect(started.status).toBe(200);

    const { status, body } = await h.api<{ error: string }>(`/api/rooms/${admin.code}/join`, {
      method: 'POST',
      body: { nickname: 'latecomer' },
    });
    expect(status).toBe(409);
    expect(body.error).toBe('started');
  });

  it('refuses a nickname already in use by someone present', async () => {
    const seats = await seatRoom(h, 3);
    const { status, body } = await h.api<{ error: string }>(`/api/rooms/${seats[0].code}/join`, {
      method: 'POST',
      body: { nickname: 'p1' },
    });
    expect(status).toBe(409);
    expect(body.error).toBe('nickname-taken');
  });
});

describe('reconnection', () => {
  it('returns the same seat for the same credentials rather than a duplicate', async () => {
    const seats = await seatRoom(h, 3);
    const me = seats[1];
    const again = await h.api<SeatPayload>(`/api/rooms/${me.code}/join`, {
      method: 'POST',
      playerID: me.playerID,
      credentials: me.credentials,
      body: { nickname: 'p1' },
    });
    expect(again.status).toBe(200);
    expect(again.body.playerID).toBe(me.playerID);
    expect(again.body.credentials).toBe(me.credentials);

    const room = await h.api<{ players: unknown[] }>(`/api/rooms/${me.code}`);
    expect(room.body.players).toHaveLength(3);
  });

  it('lets a player back into a STARTED game with their credentials', async () => {
    const seats = await seatRoom(h, 3);
    const admin = seats[0];
    await h.api(`/api/rooms/${admin.code}/start`, {
      method: 'POST',
      playerID: admin.playerID,
      credentials: admin.credentials,
    });
    const me = seats[2];
    const again = await h.api<SeatPayload>(`/api/rooms/${me.code}/join`, {
      method: 'POST',
      playerID: me.playerID,
      credentials: me.credentials,
      body: { nickname: 'p2' },
    });
    expect(again.status).toBe(200);
    expect(again.body.playerID).toBe('2');
    expect(again.body.credentials).toBe(me.credentials);
  });

  it('does not let a stranger take a seat with the wrong credentials', async () => {
    const seats = await seatRoom(h, 3);
    const { status } = await h.api(`/api/rooms/${seats[0].code}/join`, {
      method: 'POST',
      playerID: '1',
      credentials: 'not-the-right-secret',
      body: { nickname: 'p1' },
    });
    expect(status).toBe(409); // falls through to the nickname check
  });
});

describe('GET /api/rooms/:code', () => {
  it('lists the players and never leaks a credential', async () => {
    const seats = await seatRoom(h, 3);
    const { status, body } = await h.api<{
      code: string;
      started: boolean;
      settings: Record<string, unknown>;
      players: { playerID: string; nickname: string; connected: boolean }[];
    }>(`/api/rooms/${seats[0].code}`);

    expect(status).toBe(200);
    expect(body.code).toBe(seats[0].code);
    expect(body.started).toBe(false);
    expect(body.players).toEqual([
      { playerID: '0', nickname: 'p0', connected: true },
      { playerID: '1', nickname: 'p1', connected: true },
      { playerID: '2', nickname: 'p2', connected: true },
    ]);

    const raw = JSON.stringify(body);
    for (const s of seats) expect(raw).not.toContain(s.credentials);
  });

  it('404s an unknown code', async () => {
    const { status } = await h.api('/api/rooms/ZZZZ');
    expect(status).toBe(404);
  });

  it('accepts a lowercase code', async () => {
    const seats = await seatRoom(h, 3);
    const { status, body } = await h.api<{ code: string }>(
      `/api/rooms/${seats[0].code.toLowerCase()}`,
    );
    expect(status).toBe(200);
    expect(body.code).toBe(seats[0].code);
  });
});

describe('PATCH /api/rooms/:code/settings', () => {
  it('lets the admin change the arms under test', async () => {
    const seats = await seatRoom(h, 3);
    const admin = seats[0];
    const { status, body } = await h.api<{ settings: Record<string, unknown> }>(
      `/api/rooms/${admin.code}/settings`,
      {
        method: 'PATCH',
        playerID: admin.playerID,
        credentials: admin.credentials,
        body: { dayCap: 300, keyholderFirst: true },
      },
    );
    expect(status).toBe(200);
    expect(body.settings.dayCap).toBe(300);
    expect(body.settings.keyholderFirst).toBe(true);

    // and it is visible to everyone
    const room = await h.api<{ settings: Record<string, unknown> }>(`/api/rooms/${admin.code}`);
    expect(room.body.settings.dayCap).toBe(300);
  });

  it('403s a non-admin', async () => {
    const seats = await seatRoom(h, 3);
    const notAdmin = seats[1];
    const { status, body } = await h.api<{ error: string }>(
      `/api/rooms/${notAdmin.code}/settings`,
      {
        method: 'PATCH',
        playerID: notAdmin.playerID,
        credentials: notAdmin.credentials,
        body: { dayCap: 300 },
      },
    );
    expect(status).toBe(403);
    expect(body.error).toBe('not-admin');
  });

  it('403s an anonymous request', async () => {
    const seats = await seatRoom(h, 3);
    const { status } = await h.api(`/api/rooms/${seats[0].code}/settings`, {
      method: 'PATCH',
      body: { dayCap: 300 },
    });
    expect(status).toBe(403);
  });

  it('403s seat 0 credentials replayed with a different playerID', async () => {
    const seats = await seatRoom(h, 3);
    const { status } = await h.api(`/api/rooms/${seats[0].code}/settings`, {
      method: 'PATCH',
      playerID: '1',
      credentials: seats[0].credentials,
      body: { dayCap: 300 },
    });
    expect(status).toBe(403);
  });

  it('409s once the game has started', async () => {
    const seats = await seatRoom(h, 3);
    const admin = seats[0];
    await h.api(`/api/rooms/${admin.code}/start`, {
      method: 'POST',
      playerID: admin.playerID,
      credentials: admin.credentials,
    });
    const { status, body } = await h.api<{ error: string }>(`/api/rooms/${admin.code}/settings`, {
      method: 'PATCH',
      playerID: admin.playerID,
      credentials: admin.credentials,
      body: { dayCap: 300 },
    });
    expect(status).toBe(409);
    expect(body.error).toBe('started');
  });

  describe('validation — the same assertions config.ts makes', () => {
    const bad: [string, unknown][] = [
      ['a special deck that is not exactly 20 cards', {
        specialDeck: {
          Coloring: 1, 'Color catcher': 1, Bleach: 1, 'Wash net': 1,
          Snacc: 1, Sanitizer: 1, Coin: 1,
        },
      }],
      ['an event deck that is not exactly 4 cards', {
        eventDeck: { Gang: 2, 'Circuit break': 1, Jimothy: 1, 'Animal control': 1 },
      }],
      ['an unknown mesh bag rule', { meshBagRule: 'v9bag' }],
      ['an unknown turn order', { turnOrder: 'loadCardExtra' }],
      // The rules these selected between were resolved in v10 and the fields
      // deleted, so the lobby must now refuse them like any other unknown key.
      ['a setting that was removed along with its rule', { circuitBreak: 'V1' }],
      ['another setting removed with its rule', { publicDampZone: true }],
      ['fewer than three seats', { players: 2 }],
      ['more than six seats', { players: 7 }],
      ['a non-integer capacity', { capacity: 2.5 }],
      ['a string where a boolean belongs', { keyholderFirst: 'yes' }],
      ['a setting that is not the lobby’s to change', { machines: 9 }],
      ['a setting that does not exist', { nonsense: true }],
      ['a special deck missing a card', { specialDeck: { Coloring: 20 } }],
      ['a special deck with an invented card', {
        specialDeck: {
          Coloring: 3, 'Color catcher': 3, Bleach: 3, 'Wash net': 3,
          Snacc: 3, Sanitizer: 3, Coin: 1, Fabreze: 1,
        },
      }],
    ];

    for (const [label, patch] of bad) {
      it(`400s ${label}`, async () => {
        const seats = await seatRoom(h, 3);
        const admin = seats[0];
        const { status, body } = await h.api<{ error: string }>(
          `/api/rooms/${admin.code}/settings`,
          {
            method: 'PATCH',
            playerID: admin.playerID,
            credentials: admin.credentials,
            body: patch,
          },
        );
        expect(status).toBe(400);
        expect(body.error).toBe('bad-settings');
      });
    }

    it('accepts a legal 20-card deck', async () => {
      const seats = await seatRoom(h, 3);
      const admin = seats[0];
      const { status } = await h.api(`/api/rooms/${admin.code}/settings`, {
        method: 'PATCH',
        playerID: admin.playerID,
        credentials: admin.credentials,
        body: {
          specialDeck: {
            Coloring: 4, 'Color catcher': 3, Bleach: 3, 'Wash net': 3,
            Snacc: 3, Sanitizer: 3, Coin: 1,
          },
        },
      });
      expect(status).toBe(200);
    });

    it('refuses to shrink the seat cap below the people already present', async () => {
      const seats = await seatRoom(h, 4);
      const admin = seats[0];
      const { status } = await h.api(`/api/rooms/${admin.code}/settings`, {
        method: 'PATCH',
        playerID: admin.playerID,
        credentials: admin.credentials,
        body: { players: 3 },
      });
      expect(status).toBe(400);
    });
  });
});

describe('POST /api/rooms/:code/start', () => {
  it('409s below three players', async () => {
    const seats = await seatRoom(h, 2);
    const admin = seats[0];
    const { status, body } = await h.api<{ error: string }>(`/api/rooms/${admin.code}/start`, {
      method: 'POST',
      playerID: admin.playerID,
      credentials: admin.credentials,
    });
    expect(status).toBe(409);
    expect(body.error).toBe('not-enough-players');
  });

  it('403s a non-admin', async () => {
    const seats = await seatRoom(h, 3);
    const { status, body } = await h.api<{ error: string }>(`/api/rooms/${seats[0].code}/start`, {
      method: 'POST',
      playerID: seats[2].playerID,
      credentials: seats[2].credentials,
    });
    expect(status).toBe(403);
    expect(body.error).toBe('not-admin');
  });

  it('starts at three and flips `started`', async () => {
    const seats = await seatRoom(h, 3);
    const admin = seats[0];
    const { status, body } = await h.api<{ started: boolean }>(`/api/rooms/${admin.code}/start`, {
      method: 'POST',
      playerID: admin.playerID,
      credentials: admin.credentials,
    });
    expect(status).toBe(200);
    expect(body.started).toBe(true);

    const room = await h.api<{ started: boolean }>(`/api/rooms/${admin.code}`);
    expect(room.body.started).toBe(true);
  });

  it('is idempotent — a double-tapped button is not an error', async () => {
    const seats = await seatRoom(h, 3);
    const admin = seats[0];
    const auth = { playerID: admin.playerID, credentials: admin.credentials };
    const a = await h.api(`/api/rooms/${admin.code}/start`, { method: 'POST', ...auth });
    const b = await h.api(`/api/rooms/${admin.code}/start`, { method: 'POST', ...auth });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });
});

describe('room expiry', () => {
  it('drops rooms four hours after creation', async () => {
    let now = 1_000_000;
    const store = new RoomStore(() => now);
    const room = store.create('Ada');
    expect(store.get(room.code)).toBeDefined();

    now += 4 * 60 * 60 * 1000 - 1000;
    expect(store.get(room.code)).toBeDefined();

    now += 2000; // just past four hours
    expect(store.get(room.code)).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it('an expired room 404s over HTTP', async () => {
    let now = Date.now();
    const store = new RoomStore(() => now);
    const local = await startHarness({ rooms: store });
    try {
      const created = await local.api<SeatPayload>('/api/rooms', {
        method: 'POST',
        body: { nickname: 'Ada' },
      });
      expect((await local.api(`/api/rooms/${created.body.code}`)).status).toBe(200);
      now += 4 * 60 * 60 * 1000 + 1;
      expect((await local.api(`/api/rooms/${created.body.code}`)).status).toBe(404);
    } finally {
      await local.close();
    }
  });
});

describe("boardgame.io's own lobby API", () => {
  it('is closed off, so rooms are the only way in', async () => {
    const create = await h.api('/games/laundromat/create', {
      method: 'POST',
      body: { numPlayers: 3 },
    });
    expect(create.status).toBe(404);
    const list = await h.api('/games');
    expect(list.status).toBe(404);
  });
});
