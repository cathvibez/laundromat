/**
 * Bundles the TypeScript server to plain ESM in `server-dist/`.
 *
 * Why a bundler at all: `server/` imports `src/game/` and `src/rules/`, which
 * are TypeScript with extensionless relative imports. Node cannot run that, and
 * `tsc` cannot emit runnable ESM from it without rewriting every import path.
 * esbuild resolves and transpiles the local graph in one pass.
 *
 * `packages: 'external'` keeps node_modules OUT of the bundle: koa, socket.io
 * and boardgame.io are installed normally in the runtime image and resolved at
 * run time. Bundling them would mean chasing socket.io's dynamic requires for
 * no benefit.
 *
 * The output is COMMONJS, and that is not a stylistic choice. boardgame.io
 * publishes its server as `boardgame.io/server` — a bare directory carrying a
 * package.json with `main`/`module` and no `exports` map. Node's ESM resolver
 * rejects directory imports outright (ERR_UNSUPPORTED_DIR_IMPORT); its CJS
 * resolver handles them, which is the way the library is meant to be consumed.
 * Emitting ESM here produces a bundle that builds cleanly and then dies on the
 * first line at run time.
 *
 * esbuild is not a direct dependency — it arrives with Vite, which every build
 * of this project already needs. Deliberate: adding it to package.json would
 * desynchronise package-lock.json.
 */

import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

const outdir = 'server-dist';

await rm(outdir, { recursive: true, force: true });

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
};

await build({ ...common, entryPoints: ['server/index.ts'], outfile: `${outdir}/index.cjs` });

// The end-to-end smoke test travels with the server for the same reason: it
// imports boardgame.io's directory subpaths and the TypeScript game definition,
// so bare `node` cannot run the source form either.
await build({
  ...common,
  entryPoints: ['tools/smoke-multiplayer.mjs'],
  outfile: `${outdir}/smoke.cjs`,
});
