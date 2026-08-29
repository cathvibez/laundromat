/**
 * Production entry point.
 *
 *   PORT        the one port everything is served on (default 8000)
 *   CLIENT_DIR  the built client (default `<cwd>/dist`)
 *   ORIGINS     comma-separated extra CORS origins. NOT needed for the normal
 *               single-origin deploy; useful only when the client is served
 *               from somewhere else, e.g. Vite on :5173 during development.
 *
 * This file is bundled to CommonJS (see tools/build-server.mjs), so it uses
 * neither `import.meta` nor top-level await: boardgame.io's server subpath
 * (`boardgame.io/server`) is a bare directory with no `exports` map, which
 * Node's ESM resolver refuses to import. CJS resolves it exactly as the library
 * intends. `npm run build:server` && `npm start`.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildServer } from './app';

const PORT = Number(process.env.PORT ?? 8000);

/**
 * Relative to the working directory, which is the repo root under `npm start`
 * and `/app` in the container. CLIENT_DIR overrides it for anything else.
 */
const clientDir = resolve(process.env.CLIENT_DIR ?? resolve(process.cwd(), 'dist'));

const origins = (process.env.ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const haveClient = existsSync(resolve(clientDir, 'index.html'));
if (!haveClient) {
  console.warn(
    `[laundromat] No built client at ${clientDir} — serving the API only. ` +
      `Run \`npm run build\` first, or set CLIENT_DIR.`,
  );
}

const { server, rooms } = buildServer({
  ...(haveClient ? { clientDir } : {}),
  origins,
});

// Rooms are in memory and live four hours; sweep periodically so an abandoned
// server does not accumulate them. `unref` so the timer never holds the
// process open on its own.
const reaper = setInterval(
  () => {
    const n = rooms.sweep();
    if (n > 0) console.log(`[laundromat] swept ${n} expired room(s)`);
  },
  15 * 60 * 1000,
);
reaper.unref?.();

/*
 * Stay up.
 *
 * Normally letting the process die on an unhandled rejection is right: the
 * state is suspect, and a supervisor restarts you clean. Here the calculus is
 * inverted, because THE STATE IS THE PRODUCT. Every room and every game in
 * progress lives in this process's memory, so an exit is not a clean restart —
 * it ends every game being played, and the players cannot reconnect to
 * anything.
 *
 * That is not hypothetical. A throw inside boardgame.io's async socket handler
 * (a stale client syncing to a match that no longer existed) became an
 * unhandled rejection, exited the process, and took every live game with it.
 * The reconnecting client then did it again, ten times, until Fly gave up.
 * `validateSetupData` in src/game/Laundromat.ts fixes that specific throw;
 * this makes the NEXT one an incident report instead of an outage.
 *
 * The trade is deliberate: a wedged server that logs loudly beats a dead one
 * that took six people's game with it. Anything logged here is a real bug and
 * should be fixed at its source, not left to this net.
 */
for (const event of ['unhandledRejection', 'uncaughtException'] as const) {
  process.on(event, (err: unknown) => {
    console.error(`[laundromat] ${event} — staying up, but this is a bug:`, err);
  });
}

async function main(): Promise<void> {
  const servers = await server.run(PORT, () => {
    console.log(`[laundromat] listening on :${PORT}`);
    console.log(`[laundromat] client: ${haveClient ? clientDir : '(none)'}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.log(`[laundromat] ${signal}, shutting down`);
      server.kill(servers);
      process.exit(0);
    });
  }
}

main().catch((e) => {
  console.error('[laundromat] failed to start', e);
  process.exit(1);
});
