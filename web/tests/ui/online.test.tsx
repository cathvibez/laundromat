/**
 * THE LOBBY, AND EVERY WAY IT CAN GO WRONG.
 *
 * Three bugs on this project have lived in states the suite never constructed.
 * Multiplayer's version of that is: not your turn, someone dropped, you
 * rejoined mid-game, the host left, the room filled while you were typing your
 * name. Every one of those is built here, and the assertion is not just "it did
 * not crash" — it is that the screen SAYS something true about the situation.
 *
 * The transport is faked at the `src/online/api` seam, which is the same seam
 * the real `src/net/` module is loaded through.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/App';
import { __setNetForTests, humanNetError } from '../../src/online/api';
import type { NetApi, RoomInfo, Seat } from '../../src/online/api';

function player(id: number, nickname: string, connected = true) {
  return { playerID: String(id), nickname, connected };
}

interface FakeOpts {
  room?: Partial<RoomInfo>;
  createRoom?: NetApi['createRoom'];
  joinRoom?: NetApi['joinRoom'];
  getRoom?: NetApi['getRoom'];
  startGame?: NetApi['startGame'];
  updateSettings?: NetApi['updateSettings'];
}

/** A room that answers the contract, plus whatever the test wants to break. */
function fakeNet(opts: FakeOpts = {}) {
  const room: RoomInfo = {
    code: 'ABCD',
    started: false,
    settings: {},
    players: [player(0, 'Nina')],
    ...opts.room,
  };
  const seatFor = (playerID: string): Seat => ({
    code: room.code,
    playerID,
    credentials: `cred-${playerID}`,
    settings: room.settings,
  });
  const calls = { updateSettings: [] as unknown[], startGame: 0 };

  const net: NetApi = {
    createRoom: opts.createRoom ?? (async () => seatFor('0')),
    joinRoom: opts.joinRoom ?? (async () => seatFor(String(room.players.length))),
    getRoom: opts.getRoom ?? (async () => ({ ...room, players: [...room.players] })),
    updateSettings:
      opts.updateSettings ??
      (async (_c, _a, partial) => {
        calls.updateSettings.push(partial);
        room.settings = { ...room.settings, ...partial };
        return { settings: room.settings };
      }),
    startGame:
      opts.startGame ??
      (async () => {
        calls.startGame += 1;
        room.started = true;
        return { started: true };
      }),
    makeClient: () => () => <div data-testid="game-board">the board</div>,
  };
  __setNetForTests(net);
  return { net, room, calls };
}

/** Land on the online entry screen the way a player does: by choosing it. */
async function goOnline() {
  render(<App />);
  fireEvent.click(screen.getByText('Play online'));
  await screen.findByText('Start a room');
}

/**
 * This runner's `window.localStorage` is a stub with no methods on it (the
 * `--localstorage-file` warning in the test output is the same problem). The
 * app copes — it treats a broken store as no store — but these tests need a
 * real one to assert against, so install one.
 */
function installStorage(): void {
  const map = new Map<string, string>();
  const store: Storage = {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(window, 'localStorage', { value: store, configurable: true });
}

beforeEach(() => {
  installStorage();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
  __setNetForTests(null);
  window.localStorage.clear();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------

/**
 * The server answers 409 for FOUR different situations. These are its real
 * codes and its real sentences, copied from a running instance, and each one
 * has to come out the other side as advice the player can act on.
 */
describe('every server failure becomes a sentence', () => {
  const cases: [string, { status: number; code: string; message: string }, RegExp][] = [
    ['404 not-found', { status: 404, code: 'not-found', message: 'No room with that code.' }, /No room with that code/],
    ['409 full', { status: 409, code: 'full', message: 'That room is full.' }, /seats six players at most/],
    // The transport remaps a started-room 409 to 410; both must land right,
    // because a 409 read as "full" would be a lie to a locked-out player.
    ['409 started', { status: 409, code: 'started', message: 'That game has already started.' }, /already started/],
    ['410 started', { status: 410, code: 'started', message: 'That game has already started.' }, /already started/],
    [
      '409 nickname-taken',
      { status: 409, code: 'nickname-taken', message: 'Someone in that room already uses that name.' },
      /already using that name/,
    ],
    [
      '409 not-enough-players',
      { status: 409, code: 'not-enough-players', message: 'Laundromat needs at least three players.' },
      /at least three players/,
    ],
    [
      '403 not-admin',
      { status: 403, code: 'not-admin', message: 'Only the player who opened the room can do that.' },
      /Only the player who created the room/,
    ],
    [
      '400 bad-nickname',
      { status: 400, code: 'bad-nickname', message: 'A nickname is required.' },
      /^A nickname is required\.$/,
    ],
    ['network down', { status: 0, code: '', message: 'Failed to fetch' }, /Could not reach the game server/],
  ];

  test.each(cases)('%s', (_label, wire, expected) => {
    const err = Object.assign(new Error(wire.message), { status: wire.status, code: wire.code });
    const msg = humanNetError(err, 'join');
    expect(msg).toMatch(expected);
    expect(msg).not.toMatch(/\b(404|403|409|410|undefined|null)\b/);
  });

  test('an error nobody anticipated still says what to do next', () => {
    const msg = humanNetError(new Error('kaboom'), 'create');
    expect(msg).toMatch(/Try again/);
  });

  test('the whole networking layer being absent is its own message', async () => {
    __setNetForTests(null);
    // No fake injected and no `src/net` match under test: the loader must say
    // so rather than leaving a spinner up forever.
    const { NetUnavailable } = await import('../../src/online/api');
    expect(humanNetError(new NetUnavailable('Online play is not available in this build.'), 'create')).toBe(
      'Online play is not available in this build.',
    );
  });
});

describe('mode chooser', () => {
  test('the landing screen offers both modes and defaults to hot-seat', () => {
    fakeNet();
    render(<App />);
    // The hot-seat setup is still the thing you land on, unchanged.
    expect(screen.getByText('Start the day')).toBeTruthy();
    expect(screen.getByText('Play on this device')).toBeTruthy();
    expect(screen.getByText('Play online')).toBeTruthy();
  });

  test('online is a detour, not a trap — Back returns to hot-seat', async () => {
    fakeNet();
    await goOnline();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Start the day')).toBeTruthy();
  });
});

describe('creating a room', () => {
  test('the code is shown large, with a link, and the roster names you', async () => {
    fakeNet();
    await goOnline();

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Nina' } });
    fireEvent.click(screen.getByText('Create a room'));

    const code = await screen.findByText('ABCD');
    expect(code.className).toContain('code-big');
    expect((screen.getByLabelText('Join link') as HTMLInputElement).value).toMatch(/\/join\/ABCD$/);
    await waitFor(() => expect(screen.getByText('Nina')).toBeTruthy());
    expect(screen.getByText('host')).toBeTruthy();
  });

  test('a nameless player is told to type a name rather than silently failing', async () => {
    fakeNet();
    await goOnline();
    fireEvent.click(screen.getByText('Create a room'));
    expect(screen.getByText(/Type a name first/)).toBeTruthy();
  });

  test('start is refused below three players AND says how many are missing', async () => {
    fakeNet(); // one player in the room
    await goOnline();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Nina' } });
    fireEvent.click(screen.getByText('Create a room'));

    const start = (await screen.findByText(/^Start the day with/)) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    await waitFor(() => expect(screen.getByText(/2 more to go/)).toBeTruthy());
  });

  test('with three aboard the host can start, and the board replaces the lobby', async () => {
    const { calls } = fakeNet({
      room: { players: [player(0, 'Nina'), player(1, 'Ravi'), player(2, 'Jo')] },
    });
    await goOnline();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Nina' } });
    fireEvent.click(screen.getByText('Create a room'));

    const start = (await screen.findByText(/^Start the day with 3 players$/)) as HTMLButtonElement;
    await waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.click(start);

    await screen.findByTestId('game-board');
    expect(calls.startGame).toBe(1);
  });

  test('the roster updates live as players arrive', async () => {
    vi.useFakeTimers();
    const { room } = fakeNet();
    render(<App />);
    fireEvent.click(screen.getByText('Play online'));
    // Under fake timers the net module's promise still needs a flush.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Nina' } });
    fireEvent.click(screen.getByText('Create a room'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.queryByText('Ravi')).toBeNull();

    room.players.push(player(1, 'Ravi'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });
    expect(screen.getByText('Ravi')).toBeTruthy();
  });
});

describe('joining a room', () => {
  test('codes are uppercased and stripped of characters that cannot be in one', async () => {
    fakeNet();
    await goOnline();
    const input = screen.getByLabelText('Room code') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ab1cd' } }); // 1 is not in the alphabet
    expect(input.value).toBe('ABCD');
  });

  test('a short code cannot be submitted', async () => {
    fakeNet();
    await goOnline();
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'AB' } });
    expect((screen.getByText('Join') as HTMLButtonElement).disabled).toBe(true);
  });

  /**
   * The three contracted failures. Each one has to arrive as a sentence a
   * player can act on: retype it, give up, or wait. A status code is a dead
   * end, and so is "something went wrong".
   */
  test.each([
    [
      'room not found',
      Object.assign(new Error('room not found'), { status: 404, code: 'NOT_FOUND' }),
      /No room with that code/,
    ],
    [
      'room full',
      Object.assign(new Error('room is full'), { status: 409, code: 'ROOM_FULL' }),
      /room is full/,
    ],
    [
      'already started',
      Object.assign(new Error('game already started'), { status: 410, code: 'ALREADY_STARTED' }),
      /already started/,
    ],
  ])('%s is explained in words', async (_label, thrown, expected) => {
    fakeNet({
      joinRoom: async () => {
        throw thrown;
      },
    });
    await goOnline();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ravi' } });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'abcd' } });
    fireEvent.click(screen.getByText('Join'));

    const msg = await screen.findByText(expected);
    expect(msg).toBeTruthy();
    // No status codes, no stack traces, no "undefined".
    expect(msg.textContent).not.toMatch(/\b(404|409|410|undefined|Error)\b/);
    // And you are still on the form, able to try again.
    expect(screen.getByLabelText('Room code')).toBeTruthy();
  });

  test('a room that fills while you are typing your name says exactly that', async () => {
    fakeNet({
      joinRoom: async () => {
        throw Object.assign(new Error('room is full'), { status: 409, code: 'ROOM_FULL' });
      },
    });
    await goOnline();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Late' } });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByText('Join'));
    expect(await screen.findByText(/seats six players at most/)).toBeTruthy();
    // The Join button comes back; a dead button after a failure reads as a hang.
    await waitFor(() => expect((screen.getByText('Join') as HTMLButtonElement).disabled).toBe(false));
  });

  test('a /join/ABCD link fills the code in and opens the online screen', async () => {
    window.history.replaceState({}, '', '/join/abcd');
    fakeNet();
    render(<App />);
    const input = (await screen.findByLabelText('Room code')) as HTMLInputElement;
    expect(input.value).toBe('ABCD');
  });
});

describe('the waiting lobby, for everyone who is not the host', () => {
  async function joinAsSecondSeat(extra: FakeOpts = {}) {
    fakeNet({
      room: { players: [player(0, 'Nina'), player(1, 'Ravi')] },
      joinRoom: async () => ({
        code: 'ABCD',
        playerID: '1',
        credentials: 'cred-1',
        settings: {},
      }),
      ...extra,
    });
    await goOnline();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ravi' } });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByText('Join'));
    await screen.findByText('Waiting room');
  }

  test('no start button, no settings controls, and a clear statement of who you wait for', async () => {
    await joinAsSecondSeat();
    expect(screen.queryByText(/^Start the day with/)).toBeNull();
    expect(document.querySelector('.settings-form')).toBeNull();
    await waitFor(() => expect(screen.getByText(/Waiting for Nina to start/)).toBeTruthy());
  });

  /*
   * There is nothing for the host to configure any more — every rule the lobby
   * used to offer was resolved in v10 — so what everyone needs from this panel
   * changed from "what did they pick" to "what am I about to play".
   */
  test('everyone sees the rules the game runs on', async () => {
    await joinAsSecondSeat();
    await waitFor(() => expect(screen.getByText(/Circuit break/)).toBeTruthy());
    expect(screen.getByText(/do not wash/)).toBeTruthy();
    expect(screen.getByText(/Nothing to choose/)).toBeTruthy();
  });

  test('when the host drops out, the room says so instead of looking idle', async () => {
    await joinAsSecondSeat({
      room: { players: [player(0, 'Nina', false), player(1, 'Ravi')] },
    });
    await waitFor(() => expect(screen.getByText('The host has dropped out')).toBeTruthy());
    expect(screen.getByText(/Only they can start the game/)).toBeTruthy();
  });

  test('a lobby that goes quiet admits it rather than showing a stale roster as fact', async () => {
    vi.useFakeTimers();
    let alive = true;
    fakeNet({
      room: { players: [player(0, 'Nina'), player(1, 'Ravi')] },
      joinRoom: async () => ({ code: 'ABCD', playerID: '1', credentials: 'c', settings: {} }),
      getRoom: async () => {
        if (!alive) throw Object.assign(new Error('Failed to fetch'), { status: 0 });
        return {
          code: 'ABCD',
          started: false,
          settings: {},
          players: [player(0, 'Nina'), player(1, 'Ravi')],
        };
      },
    });
    render(<App />);
    fireEvent.click(screen.getByText('Play online'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ravi' } });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByText('Join'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    alive = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000); // three failed polls
    });
    expect(screen.getByText('Not hearing from the room')).toBeTruthy();
    // The roster is still there, but labelled as the last thing we knew.
    expect(screen.getByText('Nina')).toBeTruthy();
    expect(screen.getByText(/last thing we knew for certain/)).toBeTruthy();
  });
});

/*
 * `describe('the host changing the rules')` lived here.  Both of its tests —
 * a change reaching the server, and a rejected change being rolled back rather
 * than left showing a lie — tested a settings form that no longer exists.  The
 * rollback logic went with it; there is nothing left to roll back.
 */

describe('reconnection', () => {
  function storeSeat(extra: Record<string, unknown> = {}) {
    window.localStorage.setItem(
      'laundromat.session.v1',
      JSON.stringify({
        code: 'ABCD',
        playerID: '1',
        credentials: 'cred-1',
        nickname: 'Ravi',
        savedAt: Date.now(),
        ...extra,
      }),
    );
  }

  test('a stored seat opens on an offer to rejoin, not on the landing screen', async () => {
    storeSeat();
    fakeNet();
    render(<App />);
    expect(await screen.findByText('You were in room ABCD')).toBeTruthy();
    expect(screen.getByText('Rejoin ABCD')).toBeTruthy();
  });

  test('rejoining a game already in progress goes straight to the board', async () => {
    storeSeat();
    fakeNet({ room: { started: true, players: [player(0, 'Nina'), player(1, 'Ravi')] } });
    render(<App />);
    fireEvent.click(await screen.findByText('Rejoin ABCD'));
    expect(await screen.findByTestId('game-board')).toBeTruthy();
  });

  test('rejoining a lobby that is still waiting returns you to the lobby', async () => {
    storeSeat();
    fakeNet({ room: { players: [player(0, 'Nina'), player(1, 'Ravi')] } });
    render(<App />);
    fireEvent.click(await screen.findByText('Rejoin ABCD'));
    expect(await screen.findByText('Waiting room')).toBeTruthy();
  });

  test('a seat whose room has vanished is explained and forgotten, not retried forever', async () => {
    storeSeat();
    fakeNet({
      getRoom: async () => {
        throw Object.assign(new Error('room not found'), { status: 404, code: 'NOT_FOUND' });
      },
    });
    render(<App />);
    fireEvent.click(await screen.findByText('Rejoin ABCD'));
    expect(await screen.findByText(/That room is gone/)).toBeTruthy();
    expect(screen.queryByText('Rejoin ABCD')).toBeNull();
    expect(window.localStorage.getItem('laundromat.session.v1')).toBeNull();
  });

  test('an expired seat is dropped silently and the player just sees the entry screen', async () => {
    storeSeat({ savedAt: Date.now() - 48 * 60 * 60 * 1000 });
    fakeNet();
    render(<App />);
    expect(screen.getByText('Start the day')).toBeTruthy(); // no stored seat -> hot-seat landing
  });

  test('joining stores the seat so a reload can get back in', async () => {
    fakeNet({
      joinRoom: async () => ({ code: 'ABCD', playerID: '2', credentials: 'zzz', settings: {} }),
      room: { players: [player(0, 'Nina'), player(1, 'Ravi'), player(2, 'Jo')] },
    });
    await goOnline();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByText('Join'));
    await screen.findByText('Waiting room');

    const stored = JSON.parse(window.localStorage.getItem('laundromat.session.v1')!);
    expect(stored).toMatchObject({ code: 'ABCD', playerID: '2', credentials: 'zzz', nickname: 'Jo' });
  });

  test('leaving the room forgets the seat', async () => {
    fakeNet();
    await goOnline();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Nina' } });
    fireEvent.click(screen.getByText('Create a room'));
    fireEvent.click(await screen.findByText('Leave the room'));
    expect(window.localStorage.getItem('laundromat.session.v1')).toBeNull();
    expect(await screen.findByText('Start a room')).toBeTruthy();
  });
});
