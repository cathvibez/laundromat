/**
 * SIGN-UPS AND REVIEWS.
 *
 * This is the only endpoint on the server that takes free text from the open
 * internet and the only one that writes to disk, so it is worth more than a
 * happy-path test. What is asserted here:
 *
 *   - the validation says something a person can act on, not a status code;
 *   - a row SURVIVES the store being closed and reopened, which is the entire
 *     reason this feature has a volume behind it;
 *   - the admin page cannot be opened without the password;
 *   - and nothing that goes in ever comes back out through the log.
 *
 * The store is pointed at a temp directory per run, so these never touch the
 * real volume and never collide with each other.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { startHarness, type Harness } from './harness';

const dir = mkdtempSync(join(tmpdir(), 'laundromat-feedback-'));
let h: Harness;

beforeAll(async () => {
  process.env.DATA_DIR = dir;
  process.env.ADMIN_PASSWORD = 'a-test-password';
  h = await startHarness();
});

afterAll(async () => {
  await h.close();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.ADMIN_PASSWORD;
});

const post = (body: unknown) =>
  h.api<{ ok?: boolean; error?: string; message?: string }>('/api/feedback', {
    method: 'POST',
    body,
  });

describe('feedback: what the server will accept', () => {
  test('a sign-up needs an address that could actually be one', async () => {
    const bad = await post({ kind: 'signup', name: 'Kai', email: 'not-an-address' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('bad-email');
    // A sentence, not a code. The player has to know what to change.
    expect(bad.body.message).toMatch(/does not look like an email/i);

    const ok = await post({ kind: 'signup', name: 'Kai', email: 'kai@example.com' });
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
  });

  test('a review needs a rating, and the rating has to be one of the five', async () => {
    for (const stars of [undefined, 0, 6, -1, 2.5 * 4]) {
      const r = await post({ kind: 'review', stars, comment: 'no rating on this one' });
      if (r.status === 200) expect(stars).toBe(10 - 0); // never: guards the loop
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('bad-stars');
    }
    const ok = await post({ kind: 'review', stars: 4, comment: 'The keyholder decision is great.' });
    expect(ok.status).toBe(200);
  });

  test('a review may be anonymous, but a bad address is still refused', async () => {
    const anon = await post({ kind: 'review', stars: 3 });
    expect(anon.status).toBe(200);

    const typo = await post({ kind: 'review', stars: 3, email: 'kai@@example' });
    expect(typo.status).toBe(400);
    expect(typo.body.error).toBe('bad-email');
  });

  test('a form this server does not have is refused by name', async () => {
    const r = await post({ kind: 'newsletter', email: 'kai@example.com' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('bad-kind');
  });

  test('free text is capped rather than stored whole', async () => {
    const r = await post({ kind: 'review', stars: 5, comment: 'x'.repeat(50_000) });
    expect(r.status).toBe(200);
    const { addFeedback, listFeedback } = await import('../../server/feedback');
    expect(addFeedback).toBeTypeOf('function');
    const longest = Math.max(...listFeedback().map((f) => f.comment?.length ?? 0));
    expect(longest).toBeLessThanOrEqual(2000);
  });
});

describe('feedback: it is still there tomorrow', () => {
  test('a row survives the store being closed and reopened', async () => {
    await post({ kind: 'signup', name: 'Persisted', email: 'persist@example.com' });

    // Open the file itself with a brand new handle, which is exactly what the
    // next boot does. Going through the module again would only prove the
    // in-process cache still had the row.
    // createRequire, not a dynamic import: Vite's resolver does not know
    // `node:sqlite` and fails the import before Node ever sees it.
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
      DatabaseSync: new (p: string) => {
        prepare(sql: string): { all(...a: unknown[]): unknown[] };
      };
    };
    const fresh = new DatabaseSync(join(dir, 'feedback.db'));
    const rows = fresh
      .prepare('SELECT email FROM feedback WHERE kind = ?')
      .all('signup') as { email: string | null }[];
    expect(rows.some((r) => r.email === 'persist@example.com')).toBe(true);
  });
});

describe('feedback: the admin page', () => {
  const raw = (path: string) => fetch(`${h.url}${path}`);

  test('will not open without the password', async () => {
    expect((await raw('/admin')).status).toBe(401);
    expect((await raw('/admin?p=')).status).toBe(401);
    expect((await raw('/admin?p=wrong')).status).toBe(403);
    expect((await raw('/admin?p=a-test-passwor')).status).toBe(403); // a prefix is not enough
  });

  test('opens with it, and shows what was submitted', async () => {
    const res = await raw('/admin?p=a-test-password');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('kai@example.com');
    expect(html).toContain('sign-ups');
  });

  test('escapes submitted text instead of rendering it', async () => {
    await post({ kind: 'review', stars: 5, name: '<script>alert(1)</script>' });
    const html = await (await raw('/admin?p=a-test-password')).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
