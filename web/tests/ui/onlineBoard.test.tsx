/**
 * THE BOARD, SEEN FROM A SEAT THAT IS NOT THE ACTIVE ONE.
 *
 * Hot-seat has exactly one state: the player looking at the screen is the
 * player whose turn it is. Online breaks that assumption everywhere, and every
 * one of these states is one the suite never used to construct:
 *
 *   - it is somebody else's turn
 *   - your own device is offline
 *   - another player has dropped out
 *   - you have just rejoined, mid-day, mid-turn
 *
 * The G here is a REAL game state driven through the real boardgame.io client
 * and then passed through the REAL `playerView`, so other players' hands are
 * genuinely stripped — not merely assumed to be.
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Client as PlainClient } from 'boardgame.io/client';
import { makeLaundromat } from '../../src/game/Laundromat';
import type { LaundromatG } from '../../src/game/Laundromat';
import { Board } from '../../src/ui/Board';
import { loadableItems, machineAccepts } from '../../src/rules/placement';

afterEach(cleanup);

const game = makeLaundromat();

/** A live game, driven far enough to be interesting, with nobody's view applied. */
function driver(numPlayers = 3) {
  const c = PlainClient({ game, numPlayers, debug: false });
  c.start();
  return c;
}

/**
 * Play the game forward legally, whatever the dice say, until `done` is true.
 *
 * The point is to reach a LATER state honestly — day two, items in washers,
 * the key phase, a seat that has already acted — rather than fabricating one.
 * A rejoining client mounts cold into exactly these, and a state reached by
 * hand would not prove the mount works on the real thing.
 */
function playUntil(
  c: ReturnType<typeof driver>,
  done: (s: { G: LaundromatG; ctx: { phase: string | null; currentPlayer: string } }) => boolean,
  label = 'the target state',
): void {
  for (let guard = 0; guard < 400; guard++) {
    const st = c.getState()!;
    const G = st.G as LaundromatG;
    const view = { G, ctx: st.ctx as unknown as { phase: string | null; currentPlayer: string } };
    if (done(view)) return;
    if (st.ctx.gameover) throw new Error(`game ended before reaching ${label}`);

    const firstAlive = G.machines.find((m) => !m.dead)!.id;

    if (st.ctx.phase === 'event') {
      c.moves.resolveEvent(firstAlive, G.machines.find((m) => !m.dead && m.id !== firstAlive)?.id);
      continue;
    }
    if (st.ctx.phase === 'key') {
      c.moves.passKey();
      continue;
    }

    const t = G.turn;
    if (!t) throw new Error('no turn in the roll phase');
    if (t.pendingEvent) {
      c.moves.resolveDrawnEvent(
        firstAlive,
        G.machines.find((m) => !m.dead && m.id !== firstAlive)?.id,
      );
      continue;
    }
    switch (t.stage) {
      case 'roll':
        c.moves.roll();
        break;
      case 'card':
        c.moves.passCard();
        break;
      case 'load': {
        const pick = loadableItems(G, t.player)
          .map((id) => ({ id, m: G.machines.find((m) => machineAccepts(G, m.id, id)) }))
          .find((x) => x.m !== undefined);
        if (pick?.m) c.moves.load(pick.id, pick.m.id);
        else c.moves.skipLoad();
        break;
      }
      case 'extra':
        if (t.face === 4) c.moves.passMove();
        else if (t.face === 5 && t.pendingDraw) c.moves.keepCard(t.pendingDraw[0]);
        else throw new Error(`stuck on the extra stage, face ${t.face}`);
        break;
      default:
        throw new Error(`unexpected stage ${t.stage}`);
    }
  }
  throw new Error(`could not reach ${label} in 400 moves`);
}

interface ViewOpts {
  /** Which seat is LOOKING. */
  seat: string;
  names?: string[];
  away?: number[];
  isConnected?: boolean;
}

/**
 * Exactly what the network client hands the Board: state filtered through
 * `playerView` for one seat, plus the lobby's nicknames as `matchData`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function propsFor(c: ReturnType<typeof driver>, o: ViewOpts): any {
  const state = c.getState()!;
  const G = game.playerView!({
    G: state.G as LaundromatG,
    ctx: state.ctx,
    playerID: o.seat,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as LaundromatG;
  const names = o.names ?? ['Nina', 'Ravi', 'Jo', 'Sam', 'Kit', 'Bo'];
  return {
    G,
    ctx: state.ctx,
    moves: new Proxy({}, { get: () => () => {} }),
    playerID: o.seat,
    isActive: state.ctx.currentPlayer === o.seat,
    isMultiplayer: true,
    isConnected: o.isConnected ?? true,
    matchData: names.slice(0, state.ctx.numPlayers).map((name, i) => ({
      id: i,
      name,
      isConnected: !(o.away ?? []).includes(i),
    })),
    gameID: 'ABCD',
    credentials: 'x',
  };
}

/** The top-of-screen turn strip, which is the first thing a phone shows. */
function strip() {
  return {
    main: document.querySelector('.turn-strip-main')?.textContent ?? null,
    sub: document.querySelector('.turn-strip-sub')?.textContent ?? null,
  };
}

// ---------------------------------------------------------------------------

describe('online: whose turn is it', () => {
  test('the seat that is NOT playing is told so, by name, without a pass screen', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '1' })} />);

    // The pass-the-device interstitial is hot-seat only. There is nobody to
    // pass to, and this player's hand was never on anyone else's device.
    expect(screen.queryByText(/^I am Player \d$/)).toBeNull();
    expect(screen.queryByText(/Pass the device/)).toBeNull();

    // Day 1 begins with the keyholder, seat 0 — Nina. The answer to "is it me?"
    // is at the top of the screen AND in the sticky bar under the thumb: those
    // are the two places a phone actually gets looked at, and they must agree.
    expect(strip().main).toBe('Nina’s turn');
    expect(strip().sub).toMatch(/Rolling the die/);
    expect(screen.getByText('Waiting for Nina')).toBeTruthy();
    expect(document.querySelector('.turnbar.waiting')!.textContent).toMatch(/Rolling the die/);
  });

  test('the strip says YOUR TURN, in those words, for the seat that is playing', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '0' })} />);
    expect(strip().main).toBe('Your turn');
    expect(document.querySelector('.turn-strip.yours')).toBeTruthy();
    expect(screen.getByText('Roll the die')).toBeTruthy();
  });

  test('a waiting seat is offered no controls it cannot use', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '1' })} />);
    expect(screen.queryByText('Roll the die')).toBeNull();
    // No washer is offered as a target: a tap the engine would refuse is worse
    // than no tap at all.
    expect(document.querySelectorAll('.machine.selectable').length).toBe(0);
  });

  test('a waiting seat is told WHY its hand is inert, naming the player it waits for', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '1' })} />);
    expect(screen.getByText(/it is Nina’s turn/)).toBeTruthy();
    // Not the hot-seat wording, which would tell them to roll a die they cannot roll.
    expect(screen.queryByText(/Roll the die first/)).toBeNull();
  });
});

describe('online: hands are the only secret, and they stay secret', () => {
  test('you see your own hand and no other', () => {
    const c = driver();
    const props = propsFor(c, { seat: '1' });
    render(<Board {...props} />);

    // My own hand is intact; the other seats' are placeholders in G.
    expect(props.G.players[1].hand.every((id: string) => id !== 'hidden')).toBe(true);
    expect(props.G.players[0].hand.every((id: string) => id === 'hidden')).toBe(true);

    // The hand zone is mine, labelled as mine, and holds exactly my cards.
    expect(screen.getByText(/Your hand \(10\)/)).toBeTruthy();
    const handCards = document.querySelectorAll('.zones .panel .items .gcard');
    expect(handCards.length).toBe(10);
    // Nothing anywhere renders a placeholder id, and nothing implies a hidden
    // card is there to be looked at.
    expect(document.body.textContent).not.toMatch(/hidden/i);
    expect(document.querySelectorAll('.gcard.facedown, .card-back').length).toBe(0);
  });

  test('other players appear as a COUNT, which is all the physical game gives you', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '1' })} />);
    const rail = document.querySelector('.rail')!;
    expect(rail.textContent).toContain('Nina');
    expect(rail.textContent).toMatch(/hand 10/);
  });

  test('the floor is public: what is in a washer is visible to a waiting seat', () => {
    const c = driver();
    c.moves.roll();
    const state = c.getState()!;
    const stage = (state.G as LaundromatG).turn?.stage;
    if (stage === 'card') c.moves.passCard();
    const G0 = c.getState()!.G as LaundromatG;
    const item = G0.players[0].hand[0];
    c.moves.load(item, 0);

    render(<Board {...propsFor(c, { seat: '2' })} />);
    // Someone else's item, loaded by someone else, rendered on my screen.
    expect(document.querySelectorAll('.slots .gcard').length).toBeGreaterThanOrEqual(1);
  });
});

describe('online: when the connection goes', () => {
  test('my own drop is stated plainly, and says what it means for my taps', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '0', isConnected: false })} />);
    expect(screen.getByText('You are offline')).toBeTruthy();
    expect(screen.getByText(/nothing you tap now will be sent/)).toBeTruthy();
    expect(screen.getByText('Reconnecting…')).toBeTruthy();
  });

  test('someone else dropping is announced — nobody should sit wondering', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '1', away: [2] })} />);
    expect(screen.getByText('A player has dropped out')).toBeTruthy();
    expect(screen.getByText(/Jo has lost connection/)).toBeTruthy();
    // It is not their turn, so the game is not stuck, and it says so.
    expect(screen.getByText(/Play carries on/)).toBeTruthy();
  });

  test('when the ACTIVE player drops, the screen says the game is stuck on them', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '1', away: [0] })} />);
    expect(screen.getByText(/nothing will move until they are back/)).toBeTruthy();
    expect(screen.getByText(/Nina has lost connection. The game cannot go on/)).toBeTruthy();
  });

  test('a dropped player is flagged in the standings too, not only in the banner', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '1', away: [2] })} />);
    const rail = document.querySelector('.rail')!;
    expect(rail.querySelectorAll('.badge.provisional').length).toBe(1);
  });
});

describe('online: rejoining in the middle of things', () => {
  /**
   * A rejoin is a cold mount at an arbitrary point in the day. Nothing may
   * depend on having seen the states that led here.
   */
  test('a cold mount mid-turn tells the returning player exactly what they owe', () => {
    const c = driver();
    c.moves.roll();
    if ((c.getState()!.G as LaundromatG).turn?.stage === 'card') c.moves.passCard();

    render(<Board {...propsFor(c, { seat: '0' })} />);
    expect(strip().main).toBe('Your turn');
    expect(strip().sub).toBe('Load the washers.');
    expect(screen.getByText(/Loading is mandatory/)).toBeTruthy();
  });

  test('a cold mount while another seat is mid-turn is a legible spectator view', () => {
    const c = driver();
    c.moves.roll();
    if ((c.getState()!.G as LaundromatG).turn?.stage === 'card') c.moves.passCard();

    render(<Board {...propsFor(c, { seat: '2' })} />);
    expect(screen.getByText('Waiting for Nina')).toBeTruthy();
    expect(strip().sub).toBe('Loading the washers.');
    expect(document.querySelector('.turnbar.waiting')!.textContent).toContain('Loading the washers.');
    expect(document.querySelectorAll('.machine').length).toBe(4);
  });
});

describe('online: the turn arriving while you were not looking', () => {
  /**
   * A backgrounded tab does not re-render a phone into your hand. When it comes
   * back the seat has to answer "is it me now?" with no history to lean on —
   * and the answer has to differ VISIBLY from the one it gave a minute ago,
   * because the player is glancing, not reading.
   */
  test('the same seat, before and after its turn comes round, is unmistakably different', () => {
    const c = driver();
    // Before: seat 1 is waiting.
    const before = render(<Board {...propsFor(c, { seat: '1' })} />);
    expect(document.querySelector('.turn-strip.theirs')).toBeTruthy();
    expect(document.querySelector('.turn-strip.yours')).toBeNull();
    expect(document.querySelector('.turnbar.waiting')).toBeTruthy();
    expect(screen.queryByText('Roll the die')).toBeNull();
    before.unmount();

    // Seat 0 plays a whole legal turn; now it really is seat 1's.
    playUntil(c, ({ ctx }) => ctx.phase === 'roll' && ctx.currentPlayer === '1', "seat 1's turn");
    render(<Board {...propsFor(c, { seat: '1' })} />);

    expect(document.querySelector('.turn-strip.yours')).toBeTruthy();
    expect(document.querySelector('.turn-strip.theirs')).toBeNull();
    expect(strip().main).toBe('Your turn');
    expect(document.querySelector('.turnbar.waiting')).toBeNull();
    expect(screen.getByText('Roll the die')).toBeTruthy();
    // Still no pass-the-device screen, even on a turn boundary — that is the
    // exact moment hot-seat raises it.
    expect(screen.queryByText(/^I am Player \d$/)).toBeNull();
  });

  test('a seat that has already acted is not told it can act again', () => {
    const c = driver();
    playUntil(c, ({ ctx }) => ctx.phase === 'roll' && ctx.currentPlayer === '1', "seat 1's turn");
    render(<Board {...propsFor(c, { seat: '0' })} />);
    expect(strip().main).toBe('Ravi’s turn');
    expect(screen.queryByText('Roll the die')).toBeNull();
    expect(document.querySelectorAll('.machine.selectable').length).toBe(0);
  });
});

describe('online: the key phase, rejoined cold', () => {
  test('the keyholder gets the controls and is told what they are for', () => {
    const c = driver();
    playUntil(c, ({ ctx }) => ctx.phase === 'key', 'the key phase');
    const keyholder = String((c.getState()!.G as LaundromatG).key);
    render(<Board {...propsFor(c, { seat: keyholder })} />);

    expect(screen.getAllByText('Key phase').length).toBeGreaterThan(0);
    // Said in both places a thumb looks: the banner by the washers and the strip.
    expect(screen.getAllByText(/you hold the key/i).length).toBe(2);
    expect(screen.getByText('Pass, and go to the reckoning')).toBeTruthy();
    expect(strip().main).toBe('Your turn');
  });

  test('everyone else is told there is nothing for them to do, and why', () => {
    const c = driver();
    playUntil(c, ({ ctx }) => ctx.phase === 'key', 'the key phase');
    const G = c.getState()!.G as LaundromatG;
    const other = String((G.key + 1) % G.players.length);
    render(<Board {...propsFor(c, { seat: other })} />);

    expect(screen.getByText(/Nothing for you to do/)).toBeTruthy();
    expect(screen.queryByText('Pass, and go to the reckoning')).toBeNull();
    expect(strip().sub).toMatch(/keyholder is deciding/);
    // And the keyholder is named, not left as "someone".
    expect(document.querySelector('.turnbar.waiting')!.textContent).toContain('Waiting for');
  });
});

describe('online: the game ending without you', () => {
  /**
   * Someone wins while your phone is asleep. The result must be on screen when
   * you come back — an offline client that shows a live board and no outcome
   * is the "silently does nothing" failure in its purest form.
   */
  test('a finished game shows its result even to a disconnected client', () => {
    const c = driver();
    const props = propsFor(c, { seat: '1', isConnected: false });
    props.ctx = { ...props.ctx, gameover: { winners: [2] } };
    render(<Board {...props} />);

    expect(screen.getByText('Jo wins')).toBeTruthy();
    expect(screen.getByText(/All ten items washed/)).toBeTruthy();
    // The turn strip is gone — there is no turn any more, and leaving it up
    // would be the interface saying something untrue.
    expect(document.querySelector('.turn-strip')).toBeNull();
    // The offline notice stays: it explains why nothing else responds.
    expect(screen.getByText('You are offline')).toBeTruthy();
  });

  test('winning is addressed to you in the second person', () => {
    const c = driver();
    const props = propsFor(c, { seat: '1' });
    props.ctx = { ...props.ctx, gameover: { winners: [1] } };
    render(<Board {...props} />);
    expect(screen.getByText('You win')).toBeTruthy();
  });

  test('a shared win names both winners', () => {
    const c = driver();
    const props = propsFor(c, { seat: '0' });
    props.ctx = { ...props.ctx, gameover: { winners: [1, 2] } };
    render(<Board {...props} />);
    expect(screen.getByText('Ravi and Jo win together')).toBeTruthy();
  });
});

describe('online: names', () => {
  test('lobby nicknames replace "Player 3" everywhere they appear', () => {
    const c = driver();
    render(<Board {...propsFor(c, { seat: '1', names: ['Ada', 'Bea', 'Cy'] })} />);
    expect(strip().main).toBe('Ada’s turn');
    expect(screen.getByText('Waiting for Ada')).toBeTruthy();
    expect(document.querySelector('.rail')!.textContent).toContain('Cy');
  });

  test('a seat with no nickname still gets a name rather than a blank', () => {
    const c = driver();
    const props = propsFor(c, { seat: '1' });
    props.matchData = [{ id: 0, isConnected: true }, { id: 1, isConnected: true }, { id: 2, isConnected: true }];
    render(<Board {...props} />);
    expect(strip().main).toBe('Player 1’s turn');
  });
});

describe('hot-seat is untouched by any of this', () => {
  /**
   * The local game is how the designer plays and tests. Online is an addition,
   * not a replacement, and the tell is `playerID`: absent means one screen
   * speaking for everybody, and every online affordance must vanish.
   */
  function hotSeatProps(c: ReturnType<typeof driver>) {
    const state = c.getState()!;
    return {
      G: state.G as LaundromatG,
      ctx: state.ctx,
      moves: new Proxy({}, { get: () => () => {} }),
      playerID: null,
      isActive: true,
      isMultiplayer: false,
      isConnected: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  test('the pass-the-device screen is still there, and the online chrome is not', () => {
    const c = driver();
    render(<Board {...hotSeatProps(c)} />);
    expect(screen.getByText('Pass the device to Player 1')).toBeTruthy();
    expect(document.querySelector('.turn-strip')).toBeNull();
    expect(screen.queryByText('Connected')).toBeNull();
  });

  test('past the pass screen, the hot-seat board still speaks in seat numbers', () => {
    const c = driver();
    render(<Board {...hotSeatProps(c)} />);
    screen.getByText('I am Player 1').click();
    expect(screen.getByText(/hide hands between turns/)).toBeTruthy();
  });
});

describe('the floor stays navigable at six players', () => {
  test('seven washers get a jump strip; four do not need one', () => {
    const big = driver(6);
    const { unmount } = render(<Board {...propsFor(big, { seat: '1' })} />);
    expect(document.querySelectorAll('.machine').length).toBe(7);
    expect(document.querySelectorAll('.floor-strip .floor-chip').length).toBe(7);
    unmount();

    const small = driver(3);
    render(<Board {...propsFor(small, { seat: '1' })} />);
    expect(document.querySelectorAll('.floor-strip').length).toBe(0);
  });
});
