/**
 * FEEDBACK STORAGE — sign-ups and reviews, on disk, surviving deploys.
 *
 * This is the ONLY durable thing in the whole server, and it is deliberately
 * kept at arm's length from everything else. Rooms and matches stay in memory
 * on purpose (see rooms.ts); this exists because a review that vanishes on the
 * next deploy is not a review, it is a form that lied to someone.
 *
 * WHY node:sqlite AND NOT better-sqlite3. The server is bundled to CommonJS by
 * esbuild, and this project has already been bitten once by a dependency whose
 * hidden `require` built fine and died on the first line at run time (see the
 * pino-transport note in log.ts). A native module would be that trap again,
 * plus a python3/make/g++ toolchain in the build image. `node:sqlite` is a
 * BUILTIN: esbuild leaves `node:`-prefixed imports alone, there is nothing to
 * compile, and the dependency count stays where it is.
 *
 * It needs Node >= 24, which is why the Dockerfile pins node:24-alpine.
 *
 * DEGRADING, NOT DYING. Everything below is wrapped so that a missing module, a
 * missing volume or a read-only filesystem disables feedback and leaves the
 * GAME running. Nobody should lose a match because a review could not be
 * filed.
 */

import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { log } from './log';

export type FeedbackKind = 'signup' | 'review';

export interface FeedbackInput {
  kind: FeedbackKind;
  name?: string | null;
  email?: string | null;
  stars?: number | null;
  comment?: string | null;
  /** The hashed, anonymous per-browser id. Never a real identifier. */
  user?: string | null;
}

export interface FeedbackRow extends FeedbackInput {
  id: number;
  createdAt: string;
}

/* Trim and cap everything: this is the one endpoint that accepts free text from
 * the open internet, and an unbounded string is an unbounded row. */
const CAP = { name: 80, email: 200, comment: 2000 };
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

/** Deliberately permissive. The point is to catch a typo, not to police an RFC. */
export function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

interface Db {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
}

let db: Db | null = null;
let disabled: string | null = null;

/**
 * `DATA_DIR` is the Fly volume mount. With no volume the store falls back to a
 * path inside the container, which works and is wiped by the next deploy — fine
 * for `npm run dev`, useless in production, so it says so out loud on boot.
 */
export function openFeedbackDb(dir = process.env.DATA_DIR ?? ''): void {
  if (db || disabled) return;
  try {
    if (!dir) {
      log.warn(
        { detail: 'DATA_DIR unset' },
        'feedback: no volume configured — entries will not survive a deploy',
      );
    }
    const base = dir || join(process.cwd(), '.data');
    mkdirSync(base, { recursive: true });

    // Required at call time, not imported at the top: on a Node without
    // node:sqlite this must disable the feature, not take the process down.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (path: string) => Db;
    };
    const handle = new DatabaseSync(join(base, 'feedback.db'));
    handle.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        kind       TEXT NOT NULL,
        name       TEXT,
        email      TEXT,
        stars      INTEGER,
        comment    TEXT,
        user       TEXT,
        created_at TEXT NOT NULL
      );
    `);
    db = handle;
    log.info({ detail: base }, 'feedback: store ready');
  } catch (e) {
    disabled = e instanceof Error ? e.message : String(e);
    log.warn({ detail: disabled }, 'feedback: store unavailable — feature disabled');
  }
}

export function feedbackReady(): boolean {
  return db !== null;
}

export function addFeedback(input: FeedbackInput): FeedbackRow | null {
  if (!db) return null;
  const row: Omit<FeedbackRow, 'id'> = {
    kind: input.kind,
    name: clean(input.name, CAP.name),
    email: clean(input.email, CAP.email),
    stars:
      typeof input.stars === 'number' && input.stars >= 1 && input.stars <= 5
        ? Math.round(input.stars)
        : null,
    comment: clean(input.comment, CAP.comment),
    user: clean(input.user, 64),
    createdAt: new Date().toISOString(),
  };
  const res = db
    .prepare(
      `INSERT INTO feedback (kind, name, email, stars, comment, user, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.kind, row.name, row.email, row.stars, row.comment, row.user, row.createdAt) as {
    lastInsertRowid?: number | bigint;
  };
  return { ...row, id: Number(res?.lastInsertRowid ?? 0) };
}

export function listFeedback(limit = 500): FeedbackRow[] {
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT id, kind, name, email, stars, comment, user, created_at AS createdAt
       FROM feedback ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as FeedbackRow[];
  return rows;
}

export function feedbackCounts(): { signups: number; reviews: number; avgStars: number | null } {
  if (!db) return { signups: 0, reviews: 0, avgStars: null };
  const g = (sql: string) => (db!.prepare(sql).get() as { n?: number; a?: number }) ?? {};
  const s = g(`SELECT COUNT(*) AS n FROM feedback WHERE kind = 'signup'`);
  const r = g(`SELECT COUNT(*) AS n FROM feedback WHERE kind = 'review'`);
  const a = g(`SELECT AVG(stars) AS a FROM feedback WHERE stars IS NOT NULL`);
  return {
    signups: s.n ?? 0,
    reviews: r.n ?? 0,
    avgStars: a.a != null ? Math.round(a.a * 10) / 10 : null,
  };
}
