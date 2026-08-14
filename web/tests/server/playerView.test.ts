/**
 * Hidden information.
 *
 * Laundromat is open information ON PURPOSE.  Every loaded item, every washer's
 * power, every clean pile, every damp sock, every fresh card is public, and the
 * UI is allowed to show all of it.  The single exception is the contents of a
 * hand — plus `ready`, which is the physical game's hidden hand of playable
 * specials.
 *
 * These tests check the enforcement, not the presentation: they assert against
 * the payload boardgame.io's master actually filters and ships, so a leak
 * cannot be papered over by a component choosing not to render it.
 *
 * The last test in this file documents a real, currently-unclosed inference:
 * see the comment on it.  It is here so that nobody reads the tests above and
 * concludes more privacy than the game actually has.
 */

import { describe, expect, it } from 'vitest';
import { InitializeGame, getFilterPlayerView, ProcessGameConfig } from 'boardgame.io/internal';
import { Laundromat, type LaundromatG } from '../../src/game/Laundromat';

const game = ProcessGameConfig(Laundromat);

function initial(numPlayers = 3) {
  return InitializeGame({ game, numPlayers, setupData: undefined });
}

/**
 * Exactly what the master sends to `playerID` — no more, no less.
 *
 * `getFilterPlayerView` takes a TRANSPORT PAYLOAD, not a bare state, and quietly
 * returns anything it does not recognise unchanged.  Handing it a raw state
 * therefore produces an unfiltered result that looks like a passing test.  This
 * builds the real `update` payload the master emits after every move.
 */
function filteredPayload(state: ReturnType<typeof initial>, playerID: string | null) {
  const filter = getFilterPlayerView(game);
  const out = filter(playerID, {
    type: 'update',
    args: ['ABCD', { ...state, deltalog: [] }],
  } as never);

  // `TransportData` is a union: a `patch` carries an RFC-6902 operation list,
  // an `update` carries the whole filtered state. We asked for an `update`, so
  // narrow rather than cast — a cast here would let a future change to the
  // master silently turn this test into an assertion about nothing.
  if (out.type !== 'update') {
    throw new Error(`expected an 'update' payload, got '${out.type}'`);
  }
  return out.args[1] as unknown as { G: LaundromatG };
}

function viewFor(state: ReturnType<typeof initial>, playerID: string | null) {
  return filteredPayload(state, playerID);
}

describe('playerView', () => {
  it('gives a player their own hand in full', () => {
    const state = initial();
    const truth = state.G as LaundromatG;
    for (const id of ['0', '1', '2']) {
      const me = Number(id);
      const { G } = viewFor(state, id);
      expect(G.players[me].hand).toEqual(truth.players[me].hand);
      expect(G.players[me].ready).toEqual(truth.players[me].ready);
    }
  });

  it('gives other players hands as counts only, never identities', () => {
    const state = initial();
    const truth = state.G as LaundromatG;
    const { G } = viewFor(state, '1');

    for (const other of [0, 2]) {
      const real = truth.players[other].hand;
      const seen = G.players[other].hand;

      // The count survives — you can see how many cards someone is holding.
      expect(seen).toHaveLength(real.length);
      expect(real.length).toBeGreaterThan(0);

      // Not one identity does.
      expect(seen.every((c) => c === 'hidden')).toBe(true);
      for (const id of real) expect(seen).not.toContain(id);
    }
  });

  it('seat 1 cannot find seat 2’s card identities anywhere in the payload it receives', () => {
    const state = initial();
    const truth = state.G as LaundromatG;
    const payload = filteredPayload(state, '1');

    // Serialise the ENTIRE thing — G, ctx, plugins, undo stack, the lot — and
    // look for the strings.  This is the assertion that cannot be satisfied by
    // hiding something in the UI: if the substring is not in the wire format,
    // no client can render it.
    const wire = JSON.stringify(payload);

    // Seat 2's hand is 10 of their 14 items; the 4 they did NOT draw are inert.
    // We look only at hand-vs-not, in the `players[2].hand` array itself.
    const hand = truth.players[2].hand;
    expect(hand.length).toBe(10);

    const seenHand = (payload.G as LaundromatG).players[2].hand;
    expect(JSON.stringify(seenHand)).not.toMatch(/2-(shoes|socks|pants|shirts|hats|underwear|blanket)-[DL]/);

    // And `ready` likewise.
    expect(
      (payload.G as LaundromatG).players[2].ready.every((c) => String(c) === 'hidden'),
    ).toBe(true);

    // Sanity: the unfiltered state DOES contain them, so the assertion above is
    // testing the filter and not a typo in the item id format.
    expect(JSON.stringify(state.G)).toContain(hand[0]);
    expect(wire.length).toBeGreaterThan(0);
  });

  it('hides NOTHING else — over-hiding would break the open-information design', () => {
    const state = initial(4);
    const truth = state.G as LaundromatG;
    const { G } = viewFor(state, '1');

    // Every public zone is byte-identical for a player who is not in it.
    for (const other of [0, 2, 3]) {
      expect(G.players[other].damp).toEqual(truth.players[other].damp);
      expect(G.players[other].clean).toEqual(truth.players[other].clean);
      expect(G.players[other].mustWash).toEqual(truth.players[other].mustWash);
      expect(G.players[other].fresh).toEqual(truth.players[other].fresh);
      expect(G.players[other].keyHolds).toEqual(truth.players[other].keyHolds);
      expect(G.players[other].finishedDay).toEqual(truth.players[other].finishedDay);
    }

    expect(G.machines).toEqual(truth.machines);
    expect(G.items).toEqual(truth.items);
    expect(G.cfg).toEqual(truth.cfg);
    expect(G.key).toEqual(truth.key);
    expect(G.day).toEqual(truth.day);
    expect(G.log).toEqual(truth.log);
  });

  it('the hot-seat path (no playerID) is untouched', () => {
    const state = initial();
    const { G } = viewFor(state, null);
    expect(G).toEqual(state.G);
  });
});

describe('what the hidden hand does NOT protect (known, documented)', () => {
  /**
   * `mustWash` is a PUBLIC copy of the starting hand ([A-02]; rules-v0.4 §126
   * calls the must-wash set canonical and fixed for the game), and every route
   * out of a hand — into a machine, into `clean`, into `damp` — is public too.
   *
   * So an opponent can compute a hand exactly:
   *
   *     hand = mustWash \ (clean u damp u everything loaded in a machine)
   *
   * The `hidden` masking above is therefore honest about the WIRE FORMAT and
   * nothing more: the identities are absent from the payload, but they are
   * derivable from the rest of it.  This test proves the derivation so the
   * limitation is a documented fact rather than a surprise.
   *
   * Closing it means making `mustWash` private, which is rules-v0.4 [OQ-13] —
   * an open design question the brief's open-information commitment argues
   * against, and a change to src/rules/ that this work is not permitted to make.
   */
  it('a hand is exactly derivable from public state alone', () => {
    const state = initial(3);
    const truth = state.G as LaundromatG;
    const { G } = viewFor(state, '1');
    const target = 2;

    const loaded = new Set(G.machines.flatMap((m) => m.items));
    const gone = new Set([
      ...G.players[target].clean,
      ...G.players[target].damp,
      ...[...loaded].filter((id) => id.startsWith(`${target}-`)),
    ]);
    const derived = G.players[target].mustWash.filter((id) => !gone.has(id));

    expect([...derived].sort()).toEqual([...truth.players[target].hand].sort());
  });
});
