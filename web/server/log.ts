/**
 * Structured logging.
 *
 * Every line is JSON on stdout, which is what Fly captures. The point of the
 * structure is that a bug report is almost always "room 8U3W broke" or "it
 * keeps dropping me", and both of those need to become a filter, not a scroll
 * through interleaved output from six players at once. So every line that
 * belongs to a game carries `room`, and every line caused by a person carries
 * `user`. `scripts/logs.sh` filters on exactly those two fields.
 *
 * NO TRANSPORTS. pino's pretty/file transports run in worker threads and pull
 * `thread-stream` through a `require` that esbuild cannot see, which produces a
 * bundle that builds and then fails at run time — the same class of failure as
 * the CJS/ESM trap in tools/build-server.mjs. Production writes JSON to stdout
 * and nothing else. For readable local output, pipe through the pino-pretty
 * CLI, which is a devDependency and stays out of the runtime image:
 *
 *   npm run dev:server | npx pino-pretty
 */

import pino from 'pino';
import { createHash } from 'node:crypto';

/**
 * `info` in production, `debug` when developing. LOG_LEVEL overrides both —
 * set it to `debug` on Fly to chase something, then set it back, because debug
 * logs every lobby poll and every client polls constantly.
 */
const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

/**
 * Credentials are bearer tokens for a seat: anyone holding one can play as that
 * person. They must never reach a log line, and the fingerprint below exists so
 * that they never need to. Exported so the test asserts the REAL list rather
 * than a copy of it that can drift.
 */
export const REDACT_PATHS = ['credentials', '*.credentials', 'req.headers["x-credentials"]'];
export const REDACT_CENSOR = '[redacted]';

export const log = pino({
  level,
  base: { service: 'laundromat' },
  // ISO strings rather than epoch millis. These are read by a human next to
  // `fly logs`, whose own timestamps are ISO; matching them is worth the bytes.
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    // `level: "info"` rather than `level: 30`. Same reason.
    level: (label) => ({ level: label }),
  },
  redact: { paths: REDACT_PATHS, censor: REDACT_CENSOR },
});

export type Log = pino.Logger;

/**
 * A stable, anonymous id for one browser, used to follow a single person
 * across rooms and reconnects.
 *
 * The client generates a random id once and keeps it in localStorage (see
 * src/online/session.ts). It is NOT derived from anything about the device or
 * the network — it is not a device fingerprint in the tracking sense, it
 * carries no personal data, and a player clears it by clearing site data.
 *
 * It is hashed here anyway, and truncated. The raw value is a header a player
 * controls, so hashing means a hostile value cannot forge someone else's id in
 * the logs, and short means the log line stays readable. Twelve hex characters
 * is 48 bits: ample to tell apart the six people in one game.
 */
export function fingerprint(raw: string | undefined): string {
  if (!raw) return 'anon';
  return createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

/** The logger for one room, optionally for one person inside it. */
export function forRoom(code: string, user?: string): Log {
  return log.child(user ? { room: code, user } : { room: code });
}

/** The logger for one person, before they are in a room. */
export function forUser(user: string): Log {
  return log.child({ user });
}

/**
 * The per-request logger, carried on `ctx.state` so every line a request emits
 * is already tagged with its room and its person. `logOf` falls back to the
 * root logger rather than throwing: a missing tag is a worse log line, not a
 * reason to fail a request.
 */
interface LogState {
  log?: Log;
}

export function attachLog(ctx: { state: unknown }, l: Log): void {
  (ctx.state as LogState).log = l;
}

export function logOf(ctx: { state: unknown }): Log {
  return (ctx.state as LogState).log ?? log;
}
