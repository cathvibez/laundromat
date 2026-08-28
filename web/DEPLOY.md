# Deploying Laundromat

One process, one port, one origin. The Node server serves three things:

| Path | What |
|---|---|
| `/`, `/assets/*`, `/join/ABCD` | the built React client (Vite output in `dist/`) |
| `/api/rooms/*`, `/api/health` | the lobby REST API |
| `/laundromat/*` (socket.io) | boardgame.io's SocketIO transport |

**That is why there is no CORS configuration anywhere in this project.** The
page, the API and the WebSocket share an origin, so nothing is cross-origin and
there is nothing to allow. If you split the client onto a CDN or a separate
static host you inherit both a CORS problem and a WebSocket-origin problem, and
you will need to set `ORIGINS` on the server and `VITE_SERVER_URL` at build
time. Don't, unless you have a reason.

---

## Build and run locally

```bash
cd web
npm ci
npm run build:all          # tsc -b && vite build, then esbuild the server
PORT=8000 npm start        # http://localhost:8000
```

Then, in another shell, prove it actually works:

```bash
npm run smoke -- http://127.0.0.1:8000
```

`npm run smoke` opens a room, seats three players, starts the game, connects
three real SocketIO clients, makes a move as whoever holds the turn, and fails
unless the other two clients receive it. It also checks that no client received
another player's card identities, and that a dropped player can reclaim their
seat. Run it against a deploy too — it takes a URL.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on 5173 (hot-seat, and online against `dev:server`) |
| `npm run dev:server` | rebuilds the server bundle (~10ms) and runs it |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run build:server` | esbuild → `server-dist/index.cjs` (+ the smoke test) |
| `npm run build:all` | both |
| `npm start` / `npm run serve` | runs the built server |
| `npm run smoke -- <url>` | end-to-end multiplayer check against a running server |
| `npm test` | the whole vitest suite |

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8000` | The one port everything is served on. Every platform below injects this. |
| `CLIENT_DIR` | `<cwd>/dist` | Where the built client lives. |
| `ORIGINS` | *(empty)* | Extra CORS origins, comma-separated. **Not needed** for a single-origin deploy. |
| `API_SECRET` | *(unset)* | boardgame.io honours this and will require an `api-secret` header on every API request if set. Leave it unset — it would lock out the browser client. |

### Developing the client against a live server

`npm run dev` serves the client from 5173 while the game server is on 8000, which
*is* cross-origin. Both sides already allow for it:

```bash
PORT=8000 npm run dev:server &
VITE_SERVER_URL=http://localhost:8000 npm run dev
```

The server allows `localhost` origins unconditionally (`Origins.LOCALHOST`), and
`src/net/index.ts` reads `VITE_SERVER_URL`. In production both are absent and
everything is same-origin.

---

## How a deploy normally happens

Develop on `main`; `prod` is a release pointer. Pushing `prod` triggers
`.github/workflows/deploy.yml`, which deploys, forces the machine count back to
one and smoke-tests the live server. Promote with:

```bash
scripts/deploy.sh            # main -> prod, push, wait, verify
scripts/deploy.sh --local    # skip CI, deploy from this machine
scripts/deploy.sh --check    # verify what is live, deploy nothing
```

The script refuses a dirty tree or a branch other than `main`, runs the suite
first, and asks for confirmation if `/api/health` reports any open room —
because a deploy ends every game in progress. The rest of this section is what
those steps do underneath.

---

## Fly.io

`fly.toml` is committed, and lives here in `web/`. The Dockerfile does **not** —
it sits at the repository root alongside `.dockerignore`, because Docker only
reads the ignore file at the build-context root. So `fly deploy` runs from the
repository root and is pointed at this config:

```bash
# once
brew install flyctl                 # or: curl -L https://fly.io/install.sh | sh
fly auth login
fly launch --no-deploy --copy-config --name play-laundromat --region sjc

# every deploy — normally you do NOT run this by hand. Use scripts/deploy.sh
# from the repo root, which runs the tests, warns if anyone is mid-game, and
# verifies afterwards. The raw command, for reference, is:
fly deploy --config web/fly.toml

# check it
fly status
fly logs
curl https://play-laundromat.fly.dev/api/health
npm run smoke -- https://play-laundromat.fly.dev
```

`fly launch` will offer to add Postgres and Redis — **decline both.** Rooms are
in memory by design for v1 (see "State and restarts" below).

Notes baked into `fly.toml`:

- `PORT = "8080"` and `internal_port = 8080` must agree.
- `auto_stop_machines = false` and `min_machines_running = 1`. A stopped machine
  loses every room and every game in progress.
- One machine only. Do not `fly scale count 2` — see "Scaling".

**`min_machines_running = 1` will not keep you at one machine.** It is a floor,
not a ceiling. `fly deploy` prints "Creating a second machine for high
availability and zero downtime deployments" and does it, which is precisely the
split-brain described under "Scaling" — players typing the same code land in
different games. Check and correct after every deploy:

```bash
fly machines list -a play-laundromat   # expect exactly one
fly scale count 1                      # if there are two
```

Custom domain:

```bash
fly certs add laundromat.example.com
fly certs show laundromat.example.com    # shows the DNS records to create
```

---

## Render

`render.yaml` is committed as a blueprint. Either connect the repo in the Render
dashboard and let it read the blueprint, or configure a Web Service by hand with:

- **Runtime:** Node
- **Root directory:** `web`
- **Build command:** `npm ci && npm run build:all`
- **Start command:** `npm start`
- **Health check path:** `/api/health`
- **Instance type:** Starter or better — **not Free.** Free instances sleep after
  15 minutes of inactivity, and a sleeping instance loses every room.
- **Instances:** 1. See "Scaling".

With the CLI:

```bash
# once
brew install render                  # or see https://render.com/docs/cli
render login
render blueprint launch              # reads render.yaml

# afterwards
render deploys create <service-id> --wait
render logs --resources <service-id> --tail

curl https://laundromat.onrender.com/api/health
npm run smoke -- https://laundromat.onrender.com
```

Render sets `PORT` itself and the server reads it; do not hardcode one.

---

## Who builds the image

**Fly builds it.** `fly deploy --remote-only` uploads the build context to a
Fly builder, builds there, and pushes the result to `registry.fly.io`. Nothing
is built on your machine or in GitHub Actions, which is why deploying works
with no local Docker daemon at all.

This was chosen over building in CI and pushing to a registry ourselves. The
reasoning, so nobody re-opens it without new information:

- **The build is not a bottleneck.** Vite builds the client in about 2.5s and
  esbuild produces the server bundle in single-digit milliseconds; the finished
  image is 48MB. Moving that into CI to make it faster would save nothing.
- **It is one step with no registry plumbing** — no second registry to
  authenticate to, no image tags to keep in sync with the deploy, and no second
  failure mode when the tag and the release drift apart.
- **The remote builder is not costing anything measurable.** It does not appear
  as a persistent app in `fly apps list`.

### When to revisit

Build in CI and deploy a prebuilt image with `fly deploy -i <ref>` if any of
these become true:

- You want the image as a **consumable artifact** — so a playtester can
  `docker run` it without a toolchain, or so it can run somewhere other than
  Fly.
- You add a **second environment**. Building once and deploying the identical
  digest to staging and then production is a real guarantee; rebuilding for
  each is not.
- You want **build logs and provenance in GitHub** next to the rest of CI.
- The build gets slow enough that GitHub Actions layer caching would help.

`ghcr.io` is the natural home if that day comes, and it works here *because
this repository is public* — the package can be public too, so Fly pulls it
anonymously. **That is load-bearing:** Fly has no clean way to hold
private-registry pull credentials, so if the repo is ever made private, a
ghcr-based deploy stops working until the image moves to `registry.fly.io`.

---

## Docker (anywhere else)

```bash
# From the repo root: the Dockerfile is there and expects the root as context.
docker build -t laundromat .
docker run --rm -p 8000:8000 -e PORT=8000 laundromat
cd web && npm run smoke -- http://127.0.0.1:8000
```

Two stages: the first runs `npm ci` and `npm run build:all`, the second installs
production dependencies only and copies `dist/` and `server-dist/` across. The
image runs as the `node` user and carries a `HEALTHCHECK` against `/api/health`.

The server bundle is **CommonJS**, and that is load-bearing rather than
stylistic: boardgame.io publishes `boardgame.io/server` as a bare directory with
a `main` field and no `exports` map, which Node's ESM resolver refuses outright
(`ERR_UNSUPPORTED_DIR_IMPORT`). An ESM bundle builds cleanly and then dies on its
first line at run time.

---

## State and restarts

**Rooms and games live in memory.** There is no database, deliberately (v1
scope). The consequences are worth stating plainly, because they drive every
platform setting above:

- A restart, a redeploy or a crash **ends every game in progress.** Players get
  a disconnected client and there is nothing to reconnect to.
- Rooms expire four hours after creation regardless.
- Deploy between sessions, not during one.

Reconnection within a *running* server works and is tested: the client stores
`{code, playerID, credentials}` and re-enters with the same credentials, landing
back in the same seat with the same hand. That survives a phone locking, a tab
reload and a flaky network. It does not survive the server process going away.

### Scaling

**Run exactly one instance.** boardgame.io's default storage is per-process, so
two instances behind one hostname means two disjoint sets of rooms: two players
typing the same four-character code land in different games, and the bug looks
like "my friend's code doesn't work". A single shared-CPU instance is ample —
this is a six-player turn-based game with a handful of messages per turn.

To scale past one process later you need two things together, not one:

1. shared match storage (boardgame.io ships a `FlatFile` store and there are
   community Postgres/Redis adapters), and
2. a shared pub/sub for the SocketIO transport (`GenericPubSub` is the seam),
   plus sticky sessions at the proxy.

The `RoomStore` in `server/rooms.ts` would also have to move out of process. It
is deliberately a small class with a narrow interface (`get`, `create`, `join`,
`authenticate`, `sweep`) so that swap is a contained change.

---

## What to check after a deploy

```bash
BASE=https://your-deploy.example.com

curl -s $BASE/api/health                      # {"ok":true,...}
curl -s -o /dev/null -w '%{http_code}\n' $BASE/         # 200, the client
curl -s -o /dev/null -w '%{http_code}\n' $BASE/join/ABCD  # 200 (SPA fallback)
npm run smoke -- $BASE                        # the real test
```

If `/` serves but the game never connects, the socket is the thing to look at:
the transport connects to `/laundromat/` on the same origin, so a proxy that
does not forward WebSocket upgrades will produce exactly that symptom. Both
Fly and Render forward upgrades by default.
