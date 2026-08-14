/**
 * A very small static file server for the built client.
 *
 * Written by hand rather than pulled in as a dependency: it is forty lines, it
 * has one job, and adding a package to serve six files is not a trade worth
 * making.  Two middlewares, because a single-page app needs both halves:
 *
 *   serveStatic  runs BEFORE the router.  Real files win over everything.
 *   spaFallback  registered before the router but acting after it, so that
 *                /join/ABCD — a client route, not a file and not an API route —
 *                gets index.html instead of a 404.
 *
 * `/api/*` and boardgame.io's own routes never reach the fallback: they are
 * matched by the router, so the 404 test below fails for them.
 */

import { createReadStream, promises as fs } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Context, Next } from 'koa';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
};

/** Resolve a URL path inside `root`, or null if it tries to escape it. */
function safeJoin(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const rel = normalize(decoded).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const full = resolve(join(root, rel));
  const base = resolve(root);
  if (full !== base && !full.startsWith(base + sep)) return null;
  return full;
}

/** `name-<base64url hash>.ext`, which is what Vite emits into dist/assets/. */
export function isFingerprinted(file: string): boolean {
  return /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(file);
}

async function send(ctx: Context, file: string): Promise<boolean> {
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  ctx.type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  ctx.length = stat.size;
  ctx.set('Last-Modified', stat.mtime.toUTCString());
  // Vite fingerprints asset filenames (`index-B-6EWwvY.js`), so those are
  // immutable forever; index.html must never be cached or a deploy strands
  // people on old code pointing at deleted chunks.
  //
  // The hash is base64url, NOT hex: it contains upper case, `-` and `_`. A
  // hex-only pattern silently matches nothing and every asset gets `no-cache`.
  ctx.set('Cache-Control', isFingerprinted(file) ? 'public, max-age=31536000, immutable' : 'no-cache');
  ctx.status = 200;
  if (ctx.method === 'HEAD') {
    ctx.body = null;
    return true;
  }
  ctx.body = createReadStream(file);
  return true;
}

export function serveStatic(root: string) {
  return async (ctx: Context, next: Next): Promise<void> => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return next();
    const file = safeJoin(root, ctx.path === '/' ? '/index.html' : ctx.path);
    if (!file) {
      ctx.status = 400;
      return;
    }
    if (await send(ctx, file)) return;
    return next();
  };
}

export function spaFallback(root: string) {
  const index = join(root, 'index.html');
  return async (ctx: Context, next: Next): Promise<void> => {
    await next();
    if (ctx.status !== 404 || ctx.body != null) return;
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return;
    if (ctx.path.startsWith('/api/')) return;
    if (!ctx.accepts('html')) return;
    await send(ctx, index);
  };
}
