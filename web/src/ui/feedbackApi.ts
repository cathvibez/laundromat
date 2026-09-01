/**
 * Posting a sign-up or a review.
 *
 * Deliberately NOT part of `NetApi` in src/online/api.ts. That interface is the
 * multiplayer transport, it is loaded lazily through a glob, and every entry on
 * its REQUIRED list has to exist or online play reports itself broken — a
 * feedback form has no business being able to do that. This is a plain fetch
 * with no dependencies.
 *
 * The base URL is resolved the same way the transport resolves it: empty in
 * production, where the Node server serves the page and the API from one
 * origin, and VITE_SERVER_URL when the client is somewhere else (Vercel, or
 * `npm run dev` on 5173 against a server on 8000).
 */

const BASE: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SERVER_URL ?? '';

export interface FeedbackPayload {
  kind: 'signup' | 'review';
  name?: string;
  email?: string;
  stars?: number;
  comment?: string;
}

export class FeedbackError extends Error {}

/** Resolves on success; throws a sentence a person can act on. */
export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new FeedbackError('Could not reach the server. Check your connection and try again.');
  }

  if (res.ok) return;

  let message = '';
  try {
    message = ((await res.json()) as { message?: string }).message ?? '';
  } catch {
    /* a body that will not parse tells us nothing useful */
  }
  if (res.status === 503) {
    throw new FeedbackError(
      message || 'This is not switched on right now. Try again in a little while.',
    );
  }
  throw new FeedbackError(message || 'That did not send. Try again in a moment.');
}
