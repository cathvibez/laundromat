# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

Laundromat is a 3–6 player board game in development. The repo holds four things:
the playable digital implementation (`web/`), a Python rules oracle and balance
simulator (`sim/`), the design documents and print rulebook (`design/`), and art
sheets (`assets/`).

`web/` is the main codebase and where nearly all work happens. Read
`web/README.md` before changing anything under `web/src/rules/`, `web/src/game/`
or `web/src/ui/` — it is long, accurate and explains the reasoning behind the
structure. Read `web/DEPLOY.md` before touching the server, `Dockerfile`,
`fly.toml` or `render.yaml`.

## Commands

All of these run from `web/`:

```bash
npm install
npm test                     # vitest, 302 tests across 17 files
npm run dev                  # Vite dev server on :5173 (hot-seat)
npm run build                # tsc -b && vite build  -> dist/
npm run build:server         # esbuild -> server-dist/index.cjs (+ smoke.cjs)
npm run build:all            # both
npm start                    # runs the built server (PORT, default 8000)
npm run dev:server           # rebuild the server bundle and run it
npm run smoke -- <url>       # end-to-end multiplayer check against a running server
```

Python side, from the repo root:

```bash
python3 sim/test_rules.py            # unittest, the oracle's own suite
python3 sim/run.py main -n 10000     # balance sweeps; see run.py's docstring
python3 web/tools/gen_fixtures.py    # regenerate the parity fixtures
python3 design/rulebook/build.py     # rebuild design/rulebook/rulebook.html
```

`npm run smoke` needs a server already running; it takes the base URL as an
argument and works against a deploy too.

## Architecture

Dependency direction is strictly `ui -> game -> rules`, and it matters.

- `web/src/rules/` — the ruleset as a plain TypeScript library with **zero
  framework dependencies**. It does not import boardgame.io. `reckoning.ts`
  (`machineVerdicts()`) is pure, memoised and order-independent; `config.ts` is
  the single home for every rule the designer has not committed to. Never call
  `Math.random` here — use the seeded `Rng` in `rng.ts`.
- `web/src/game/Laundromat.ts` — the boardgame.io adapter: phases, turn order,
  moves, `playerView`. A thin shell over `rules/`.
- `web/src/ui/` — React. `Board.tsx` serves both hot-seat and online; it keys
  every control off `playerID` (absent = hot-seat, present = online seat).
- `web/src/online/` — the online client screens and session storage.
  `api.ts` is the only module allowed to reach into `src/net/`.
- `web/src/net/index.ts` — the client transport: lobby HTTP plus the networked
  boardgame.io client factory.
- `web/server/` — Koa + boardgame.io server. `app.ts` wires it together,
  `lobby.ts` is the REST API (`/api/rooms/*`), `rooms.ts` is the room store,
  `static.ts` serves the built client with SPA fallback.
- `sim/rules.py` — the Python oracle the TS reckoning is checked against.
  `sim/run.py` is the balance harness; `sim/bots.py` the policies.

Tests live in `web/tests/`: `ported/` (Python suite rewritten in TS, same test
names), `parity/` (generated-from-oracle fixture replay), `game/` (whole games
through the driver and through the real bgio client), `server/`, `ui/`.

## Branches and deploying

Develop on **`main`**. `prod` is a release pointer, not a place to write code:
pushing to it triggers `.github/workflows/deploy.yml`, which deploys to Fly,
forces the machine count back to 1 and runs the smoke test against the live
server.

```bash
scripts/deploy.sh            # promote main -> prod and push; CI deploys
scripts/deploy.sh --local    # skip CI, fly deploy from this machine
scripts/deploy.sh --check    # verify the live deploy, change nothing
```

`deploy.sh` refuses to run on a dirty tree or off `main`, runs the suite first,
and **asks before deploying while any room is open** — a deploy ends every game
in progress, and no green test run can tell you that. Do not bypass that prompt
to save a minute.

**Fly builds the image, not CI.** `fly deploy --remote-only` uploads the build
context to a Fly builder and pushes to `registry.fly.io`, so nothing needs a
local Docker daemon. This is a considered choice, not an oversight — the build
is ~2.5s and the image 48MB, so building in CI would add registry plumbing and
a tag-drift failure mode to save nothing. `web/DEPLOY.md` has the full
reasoning and the conditions under which to revisit it (a second environment,
or wanting the image as a consumable artifact).

## Logging

Structured JSON on stdout via pino (`web/server/log.ts`). Every line caused by a
game carries `room`; every line caused by a person carries `user`, a hashed,
anonymous per-browser id the client sends as `x-fingerprint`. Those two fields
are the whole point — a bug report is "room 8U3W broke" or "it keeps dropping
me", and each becomes one filter.

```bash
scripts/logs.sh                  # live tail, readable
scripts/logs.sh --room 8U3W      # one game
scripts/logs.sh --user a1b2c3d4  # one person
scripts/logs.sh --errors         # warn and above
scripts/logs.sh --raw | jq ...   # untouched JSON
```

Traps worth knowing:

- **No pino transports.** The pretty/file transports run in worker threads and
  pull `thread-stream` through a `require` esbuild cannot see, which builds fine
  and dies at run time — the same shape as the CJS trap below. Production writes
  JSON to stdout and nothing else; pipe through `npx pino-pretty` locally.
- **Never log a credential.** They are bearer tokens for a seat. `REDACT_PATHS`
  in `log.ts` censors them and `tests/server/log.test.ts` asserts it against the
  real config.
- **Do not use pino's reserved keys as fields.** `level`, `msg` and `time` as
  your own field names produce duplicate JSON keys; `jq` silently takes the last
  one, so a filter reads the wrong value. Use `logLevel`, `detail`, and so on.
- **The crash guard arms only after the port is bound.** Arming it earlier turns
  a failure to start into a zombie that serves nothing while the platform waits
  on a health check that can never pass.

## Constraints and traps

**Exactly one server instance.** Rooms live in a `Map` in `server/rooms.ts` and
boardgame.io's default store is per-process. Two instances behind one hostname
means two disjoint sets of rooms — two players typing the same four-character
code land in different games. Do not `fly scale count 2`, do not add a second
region, and keep `auto_stop_machines = false` / `min_machines_running = 1` in
`fly.toml`. Scaling past one process requires shared match storage *and* shared
pub/sub for SocketIO *and* moving `RoomStore` out of process — all three, not
one.

`min_machines_running = 1` is a floor, **not a ceiling**, and it will not save
you: `fly deploy` announces "Creating a second machine for high availability"
and does exactly that, silently breaking multiplayer. Run
`fly machines list -a play-laundromat` after every deploy and
`fly scale count 1` if there are two.

**The Dockerfile and `.dockerignore` are at the repository root, not in
`web/`** — Docker only reads the ignore file at the build-context root, so the
two must live together. Consequences: every `COPY` in the Dockerfile is
`web/`-prefixed, `web/fly.toml` points at `../Dockerfile`, and the deploy runs
from the root as `fly deploy --config web/fly.toml`. Running it from `web/`
gives the build a context with no `web/` directory and every `COPY` fails.

**`web/tools/` must stay out of `.dockerignore`.** The Docker build stage runs
`npm run build:server`, which is `node tools/build-server.mjs`. Excluding
`tools/` makes every image build die with `MODULE_NOT_FOUND` while the client
build still succeeds, so the error looks like a server-bundle problem. It never
reaches the runtime image regardless — that stage copies only `dist/` and
`server-dist/`.

**State is in memory, on purpose (v1, no database).** A restart, redeploy or
crash ends every game in progress. Rooms expire four hours after creation
anyway. Deploy between sessions, not during one. Client-side reconnection
(`{code, playerID, credentials}` in localStorage) survives a tab reload but not
the process going away. Do not add Postgres or Redis "while you're in there" —
it is a scoped decision, not an oversight.

**The server bundle must be CommonJS.** `boardgame.io/server` is a bare
directory with a `main` field and no `exports` map; Node's ESM resolver rejects
it with `ERR_UNSUPPORTED_DIR_IMPORT`. An ESM bundle builds cleanly and dies on
its first line at run time. `tools/build-server.mjs` sets `format: 'cjs'` for
this reason; `server/*.ts` must therefore avoid `import.meta` and top-level
await.

**One origin, no CORS.** The Node server serves the client, the REST API and
the socket on one port, so there is nothing cross-origin to allow. `ORIGINS` and
`VITE_SERVER_URL` exist only for `npm run dev`, where Vite is on 5173 and the
server on 8000. Splitting the client onto a CDN buys a CORS problem and a
WebSocket-origin problem at once.

**Do not end the roll phase with a phase-level `endIf`.** boardgame.io evaluates
`endIf` on phase *entry*, before `onBegin`, so a counter-based test fires before
the counter resets and the game loops forever. The roll phase ends by returning
`undefined` from `turn.order.next`. This is commented in place in
`Laundromat.ts`; leave the comment.

**Parity fixtures are generated, not committed knowledge.** If
`tests/parity/fixtures/` is missing, two tests fail *by design* — run
`python3 web/tools/gen_fixtures.py`, do not delete the tests. Every fixture runs
with `ownItemsDontTaint: false` and `meshBagRule: 'v8net'`, i.e. brief v8's
reckoning, which is no longer the reckoning the app plays by default. Porting a
rule into the oracle and regenerating fixtures should happen in one change.

733 of them also set `sanitizerOwnerOnly: true`, a reading v10 removed from the
GAME but deliberately kept in `ReckoningOpts` and `reckoning.ts`. Deleting that
branch would fail those fixtures, and the only ways out would be regenerating
with less coverage or editing the oracle. It is unreachable from play —
`opts()` hardcodes `false` — and exists solely to keep comparing against
`sim/rules.py`. Leave it.

**The two `tests/server/` suites bind an ephemeral TCP port.** In a sandbox that
blocks `listen`, they skip and the run reports 2 failed files with `EPERM` —
that is the environment, not the code. The other 15 files pass regardless.

**There is no seed-for-seed parity between `web/` and `sim/`.** Python's
Mersenne Twister and boardgame.io's RNG are different streams. They are the same
rules, not the same game generator. Never claim a specific simulated game can be
reproduced in the app or vice versa.

**Simulation numbers are mostly stale.** `sim/rules.py` is behind the brief and
the app on six rules: event timing, the v10 damp-socks rule (the first that
changes item flow rather than verdicts — a machine is no longer empty after a
reckoning), the Mesh bag rule, own-items-don't-taint, the 20-card deck and
keyholder-first order. `design/implementation-status.md` is the
rule-by-rule divergence register; read it before quoting any balance figure from
`sim/out/`.

**Rule changes belong in `web/src/rules/config.ts`.** Anything the designer has
not committed to is a config flag with a documented default, not a hardcoded
branch. The converse is also true and is what v10 did: when a question is
CLOSED, the flag and the losing branches go, rather than lingering as switches
nobody selects. `circuitBreak`, `eventTiming`, `sanitizerOwnerOnly` and
`publicDampZone` were all deleted this way. The special deck must total exactly 20 cards (a manufacturing
constraint, asserted at setup).

## Conventions

- Comments in this codebase explain *why*, at length, where the reasoning is
  non-obvious. Match that voice: direct, no marketing register, no restating
  what the code already says. Several comments record an hour lost to a trap —
  do not tidy them away.
- `design/` documents are the design record. `game-brief.md` (currently v9) is
  ground truth; `rules-v0.*.md` are superseded history kept for citations.
- Do not commit unless asked.
