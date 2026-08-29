/**
 * End-to-end smoke test against a REAL running server.
 *
 * Unlike tests/server/wire.test.ts — which builds the server in-process — this
 * drives whatever is listening on the given URL over ordinary HTTP and
 * SocketIO. Point it at the production bundle, at a container, or at a deploy:
 *
 *   npm run build:all
 *   PORT=8125 npm start &
 *   npm run smoke -- http://127.0.0.1:8125
 *   npm run smoke -- https://laundromat.fly.dev
 *
 * `npm run smoke` runs the BUNDLED copy in server-dist/, because this file
 * imports boardgame.io's directory subpaths and the TypeScript game definition,
 * neither of which bare `node` can resolve. `npm run build:server` builds it
 * alongside the server.
 *
 * It creates a room, seats three players, starts, connects three sockets, makes
 * a move as whoever holds the turn, and refuses to exit 0 until the OTHER two
 * clients have seen it. Then it checks that neither of them received the
 * mover's cards, and that a dropped player can get their seat back.
 */

import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Laundromat } from '../src/game/Laundromat';

const BASE = process.argv[2] ?? process.env.BASE ?? 'http://127.0.0.1:8000';

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function api(path, { method = 'GET', body, auth } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    headers['x-player-id'] = auth.playerID;
    headers['x-credentials'] = auth.credentials;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function until(label, test, ms = 15000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (test()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timed out waiting for: ${label}`);
}

function connect(seat) {
  const c = Client({
    game: Laundromat,
    matchID: seat.code,
    playerID: seat.playerID,
    credentials: seat.credentials,
    multiplayer: SocketIO({ server: BASE }),
    debug: false,
  });
  c.start();
  return c;
}

async function main() {
  console.log(`\nLaundromat multiplayer smoke test against ${BASE}\n`);

  const health = await api('/api/health');
  check('server is up', health.status === 200, JSON.stringify(health.body));

  const created = await api('/api/rooms', { method: 'POST', body: { nickname: 'Ada' } });
  check('room created', created.status === 200, `code=${created.body?.code}`);
  const code = created.body.code;
  check(
    'code is 4 unambiguous characters',
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/.test(code),
    code,
  );

  const seats = [created.body];
  for (const name of ['Grace', 'Alan']) {
    const j = await api(`/api/rooms/${code}/join`, { method: 'POST', body: { nickname: name } });
    check(`${name} joined`, j.status === 200, `seat ${j.body?.playerID}`);
    seats.push(j.body);
  }

  const admin = { playerID: seats[0].playerID, credentials: seats[0].credentials };

  const patched = await api(`/api/rooms/${code}/settings`, {
    method: 'PATCH',
    auth: admin,
    // Any key the lobby still accepts. circuitBreak/eventTiming used to live
    // here and were removed with their rules in v10 — patching a deleted key
    // now returns 400 and would fail this check against a live server.
    body: { dayCap: 300 },
  });
  check('admin changed the rules', patched.status === 200, JSON.stringify(patched.body?.settings));

  const badPatch = await api(`/api/rooms/${code}/settings`, {
    method: 'PATCH',
    auth: { playerID: seats[1].playerID, credentials: seats[1].credentials },
    body: { dayCap: 250 },
  });
  check('non-admin refused', badPatch.status === 403);

  const started = await api(`/api/rooms/${code}/start`, { method: 'POST', auth: admin });
  check('game started', started.status === 200 && started.body?.started === true);

  const late = await api(`/api/rooms/${code}/join`, { method: 'POST', body: { nickname: 'Late' } });
  check('latecomer refused', late.status === 409, late.body?.error);

  const clients = seats.map(connect);
  await until('all three clients to sync', () =>
    clients.every((c) => c.getState() && c.getState().isConnected),
  );
  check('three clients connected and synced', true);

  const before = clients.map((c) => c.getState());
  check(
    'all three see the same board',
    new Set(before.map((s) => JSON.stringify(s.G.machines))).size === 1,
  );
  check(
    'the admin’s ruleset reached setup',
    before[0].G.cfg.dayCap === 300,
    String(before[0].G.cfg.dayCap),
  );

  // ---- the actual claim ---------------------------------------------------
  const turn = Number(before[0].ctx.currentPlayer);
  const watching = clients.map((_, i) => i).filter((i) => i !== turn);
  const watchers = watching.map((i) => clients[i]);
  const stateIDBefore = before[0]._stateID;

  check('nobody has rolled yet', before.every((s) => s.G.turn?.face == null));
  console.log(`\n  → player ${turn} rolls; watching players ${watching.join(' and ')}\n`);

  clients[turn].moves.roll();

  await until('the move to cross the wire', () =>
    watchers.every((c) => c.getState().G.turn?.face != null),
  );

  const after = clients.map((c) => c.getState());
  const faces = after.map((s) => s.G.turn.face);
  check('every client saw the move', new Set(faces).size === 1, `die = ${faces[0]}`);
  check('the die is a real face', faces[0] >= 1 && faces[0] <= 6);
  check('the server ordered the update', after.every((s) => s._stateID > stateIDBefore));
  check(
    'the server’s log entry reached everyone',
    new Set(after.map((s) => s.G.log.length)).size === 1 &&
      after[0].G.log.length > before[0].G.log.length,
  );

  // ---- hidden information -------------------------------------------------
  let leaked = false;
  for (let me = 0; me < 3; me++) {
    const G = after[me].G;
    if (!G.players[me].hand.every((id) => id.startsWith(`${me}-`))) leaked = true;
    for (let other = 0; other < 3; other++) {
      if (other === me) continue;
      const seen = G.players[other].hand;
      if (!seen.every((c) => c === 'hidden')) leaked = true;
      if (seen.length !== after[other].G.players[other].hand.length) leaked = true;
    }
  }
  check('no client received another player’s card identities', !leaked);

  // ---- reconnection -------------------------------------------------------
  const mine = after[2].G.players[2].hand;
  clients[2].stop();
  await new Promise((r) => setTimeout(r, 150));

  const rejoin = await api(`/api/rooms/${code}/join`, {
    method: 'POST',
    auth: { playerID: seats[2].playerID, credentials: seats[2].credentials },
    body: { nickname: 'Alan' },
  });
  check('rejoin returns the same seat', rejoin.status === 200 && rejoin.body.playerID === '2');

  const back = connect(rejoin.body);
  await until('the reconnected client to resync', () => back.getState() && back.getState().isConnected);
  check(
    'the reconnected player got their own hand back',
    JSON.stringify(back.getState().G.players[2].hand) === JSON.stringify(mine),
  );

  for (const c of [...clients.slice(0, 2), back]) {
    try {
      c.stop();
    } catch {
      /* already stopped */
    }
  }

  console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`} — room ${code}\n`);
  return failures === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`\nFAIL — ${e.message}\n`);
    process.exit(1);
  },
);
