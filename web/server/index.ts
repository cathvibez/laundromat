/**
 * Production entry point.
 *
 *   PORT        the one port everything is served on (default 8000)
 *   CLIENT_DIR  the built client (default ../dist relative to this file)
 *   ORIGINS     comma-separated extra CORS origins; unnecessary single-origin
 *
 * `npm run serve` runs this after `npm run build`.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer } from './app';

const here = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 8000);
const clientDir = resolve(process.env.CLIENT_DIR ?? resolve(here, '..', 'dist'));
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

// Rooms are in memory and live four hours; sweep hourly so an abandoned server
// does not accumulate them.  `unref` so the timer never holds the process open.
const reaper = setInterval(
  () => {
    const n = rooms.sweep();
    if (n > 0) console.log(`[laundromat] swept ${n} expired room(s)`);
  },
  15 * 60 * 1000,
);
reaper.unref?.();

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
