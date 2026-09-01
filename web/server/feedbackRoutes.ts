/**
 * THE FEEDBACK ENDPOINTS.
 *
 *   POST /api/feedback   a sign-up or a review, from the game's own UI
 *   GET  /admin          the owner's read-only view, behind one password
 *
 * Kept out of lobby.ts on purpose: that file is the game's contract and this is
 * a side channel. Nothing here can touch a room.
 *
 * PRIVACY. Addresses submitted here are the only personal data the service
 * holds, and log.ts goes out of its way to keep the log stream anonymous — so
 * nothing below ever logs an address or a name. It logs that a row was written
 * and what kind, and that is all.
 */

import type Router from '@koa/router';
import type { Server as ServerTypes } from 'boardgame.io';
import koaBody from 'koa-body';
import { timingSafeEqual } from 'node:crypto';
import {
  addFeedback,
  feedbackCounts,
  feedbackReady,
  listFeedback,
  looksLikeEmail,
} from './feedback';
import { log } from './log';

const body = koaBody();

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Constant-time, so the password cannot be recovered a character at a time. */
function passwordMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function mountFeedback(router: Router<unknown, ServerTypes.AppCtx>): void {
  router.post('/api/feedback', body, async (ctx) => {
    if (!feedbackReady()) {
      ctx.status = 503;
      ctx.body = { error: 'unavailable', message: 'Feedback is not available right now.' };
      return;
    }

    const b = (ctx.request.body ?? {}) as Record<string, unknown>;
    const kind = b.kind === 'review' ? 'review' : b.kind === 'signup' ? 'signup' : null;
    if (!kind) {
      ctx.status = 400;
      ctx.body = { error: 'bad-kind', message: 'That form is not one this server knows.' };
      return;
    }

    const email = typeof b.email === 'string' ? b.email.trim() : '';
    // A sign-up IS an address; without one there is nothing to sign up. On a
    // review it is optional, but a wrong one is still worth catching.
    if (kind === 'signup' && !looksLikeEmail(email)) {
      ctx.status = 400;
      ctx.body = { error: 'bad-email', message: 'That does not look like an email address.' };
      return;
    }
    if (kind === 'review' && email && !looksLikeEmail(email)) {
      ctx.status = 400;
      ctx.body = { error: 'bad-email', message: 'That does not look like an email address.' };
      return;
    }
    const stars = typeof b.stars === 'number' ? b.stars : null;
    if (kind === 'review' && !(stars && stars >= 1 && stars <= 5)) {
      ctx.status = 400;
      ctx.body = { error: 'bad-stars', message: 'Pick a rating from one to five stars.' };
      return;
    }

    const row = addFeedback({
      kind,
      name: typeof b.name === 'string' ? b.name : null,
      email: email || null,
      stars,
      comment: typeof b.comment === 'string' ? b.comment : null,
      user: ctx.get('x-fingerprint') || null,
    });

    // NO ADDRESS, NO NAME, NO COMMENT in the log line. See the header.
    log.info({ detail: kind, stars: row?.stars ?? null }, 'feedback: stored');
    ctx.status = 200;
    ctx.body = { ok: true };
  });

  router.get('/admin', async (ctx) => {
    const expected = process.env.ADMIN_PASSWORD ?? '';
    if (!expected) {
      ctx.status = 503;
      ctx.body = 'ADMIN_PASSWORD is not set on this server.';
      return;
    }
    const given = String(ctx.query.p ?? '');
    if (!given || !passwordMatches(given, expected)) {
      ctx.status = given ? 403 : 401;
      ctx.type = 'html';
      ctx.body = page(
        'Sign in',
        `<form method="get" action="/admin">
           <label for="p">Password</label>
           <input id="p" name="p" type="password" autofocus>
           <button type="submit">Open</button>
           ${given ? '<p class="bad">That password is not right.</p>' : ''}
         </form>`,
      );
      return;
    }

    const rows = listFeedback();
    const c = feedbackCounts();
    const cells = rows
      .map(
        (r) => `<tr>
          <td>${esc(r.createdAt.replace('T', ' ').slice(0, 16))}</td>
          <td><span class="tag ${esc(r.kind)}">${esc(r.kind)}</span></td>
          <td>${r.stars ? '★'.repeat(r.stars) + '<span class="dim">' + '★'.repeat(5 - r.stars) + '</span>' : '<span class="dim">—</span>'}</td>
          <td>${esc(r.name) || '<span class="dim">—</span>'}</td>
          <td>${r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '<span class="dim">—</span>'}</td>
          <td>${esc(r.comment) || '<span class="dim">—</span>'}</td>
        </tr>`,
      )
      .join('');

    ctx.type = 'html';
    ctx.body = page(
      'Feedback',
      `<div class="stats">
         <b>${c.signups}</b> sign-ups &nbsp;·&nbsp; <b>${c.reviews}</b> reviews
         ${c.avgStars != null ? `&nbsp;·&nbsp; average <b>${c.avgStars}</b>/5` : ''}
       </div>
       ${
         rows.length
           ? `<table>
                <thead><tr><th>When</th><th>Kind</th><th>Stars</th><th>Name</th><th>Email</th><th>Comment</th></tr></thead>
                <tbody>${cells}</tbody>
              </table>`
           : '<p class="dim">Nothing yet.</p>'
       }`,
    );
  });
}

/** One page shell. Deliberately plain — this is a back office, not the game. */
function page(title: string, inner: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Laundromat</title><style>
  :root{color-scheme:light dark}
  body{margin:0;padding:28px 22px 60px;font:15px/1.5 ui-rounded,'Segoe UI',system-ui,sans-serif;
       background:#f7f1e4;color:#3b3330}
  h1{font-size:22px;margin:0 0 4px}
  .stats{margin:14px 0 18px;font-size:14px}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e3d8c4;vertical-align:top}
  th{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#6f6558}
  td:last-child{max-width:40ch}
  .dim{color:#9c9186}
  .tag{font-size:11px;padding:2px 8px;border-radius:999px;border:1.5px solid #d3c4aa}
  .tag.review{border-color:#5fa86b;color:#3d7a48}
  .tag.signup{border-color:#3f6f90;color:#3f6f90}
  form{max-width:280px;display:grid;gap:8px}
  label{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:#6f6558}
  input,button{font:inherit;padding:9px 12px;border:2px solid #3b3330;border-radius:11px;background:#fff}
  button{background:#ffe9a8;font-weight:600;cursor:pointer}
  .bad{color:#b24e3b;font-size:13px}
  @media (prefers-color-scheme:dark){
    body{background:#23201d;color:#ece4d6}
    th{color:#a2968a} .dim{color:#8a8078}
    th,td{border-bottom-color:#453f39}
    input,button{background:#2c2825;color:#ece4d6;border-color:#5b544c}
    button{background:#6b5a2a}
  }
</style></head><body><h1>${esc(title)}</h1>${inner}</body></html>`;
}
