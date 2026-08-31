# Vercel — the client only

Vercel serves the **built React client**. The game server stays on Fly.

That split is not a preference, it is forced by what the server is. Rooms live in
a `Map` in `web/server/rooms.ts` and boardgame.io's match store is per-process,
so the server needs exactly one long-lived instance. Vercel Functions scale out
across instances with no shared memory and no shared pub/sub for the socket, so
two players typing the same four-character code would land in **different
rooms** and each would sit waiting for someone who never arrives. Moving the
server here needs Redis *and* a boardgame.io storage adapter *and* shared pub/sub
— all three, and none of them are written.

```
   browser ──▶ Vercel          the page, the JS, the CSS   (static)
           └─▶ Fly             /api/rooms/*, the socket    (stateful, 1 machine)
```

## What makes it work

Two settings, and the code already had both — they existed for `npm run dev`,
where Vite is on 5173 and the server on 8000, which is the same cross-origin
shape as this.

| Where | Setting | Value |
|---|---|---|
| Vercel (build time) | `VITE_SERVER_URL` | `https://play-laundromat.fly.dev` |
| Fly (runtime) | `ORIGINS` | the Vercel origin(s), comma-separated |

`VITE_SERVER_URL` is read in `web/src/net/index.ts` and **baked into the bundle at
build time**, so changing it needs a rebuild, not a restart. `ORIGINS` is read in
`web/server/index.ts` and needs a Fly restart.

Miss either one and the symptom is the same: the page loads perfectly and then
every lobby call fails. That is the CORS preflight, not the game.

## Deploying

```bash
# from the repo root
vercel deploy --prod

# after the first deploy, tell the Fly server the new origin exists
fly secrets set ORIGINS=https://<your-vercel-domain> -a play-laundromat
```

Preview deployments get a **new URL every time**, and each one is a fresh origin
the server has not been told about. Either add them to `ORIGINS` or accept that
previews cannot reach the lobby. This is the tax the split buys you.

## The cost of this arrangement

`web/DEPLOY.md` argues for one origin, and it is right: Fly alone serves the
page, the API and the socket from one process, and there is nothing to configure.
This setup trades that for a Vercel URL and Vercel's build pipeline, and pays for
it with a CORS surface, a WebSocket-origin surface, a build-time variable, and
two places to deploy instead of one.

If the Vercel URL stops being worth that, delete this file and `vercel.json`,
unset `ORIGINS`, rebuild without `VITE_SERVER_URL`, and Fly goes back to serving
everything on its own.
