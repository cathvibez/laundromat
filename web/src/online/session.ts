/**
 * The stored seat.
 *
 * Phones lock, browsers reload, and a tab that loses its credentials loses the
 * game — boardgame.io will not let you back into a seat without them. So the
 * seat is written to localStorage the moment it exists and is offered back on
 * the next load.
 */

import { normaliseCode } from './api';
import type { OnlineSettings } from './api';

const KEY = 'laundromat.session.v1';

export interface StoredSession {
  code: string;
  playerID: string;
  credentials: string;
  nickname: string;
  /** ms epoch, for expiry. */
  savedAt: number;
  settings?: OnlineSettings;
}

/** A day is long enough for "I locked my phone", short enough to not haunt. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * `window.localStorage` being present does not mean it works. Safari's private
 * mode throws on access, some embedded webviews expose an object with no
 * methods at all, and this project's own test runner supplies exactly such a
 * stub. Every path here treats a bad store as no store: the player loses the
 * rejoin offer and nothing else.
 */
function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const st = window.localStorage;
    if (!st || typeof st.getItem !== 'function' || typeof st.setItem !== 'function') return null;
    return st;
  } catch {
    return null;
  }
}

export function saveSession(s: Omit<StoredSession, 'savedAt'>): void {
  const st = storage();
  if (!st) return;
  try {
    st.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {
    /* a full or disabled store is not worth a crash */
  }
}

export function loadSession(): StoredSession | null {
  const st = storage();
  if (!st) return null;
  let raw: string | null;
  try {
    raw = st.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as StoredSession;
    if (!s || typeof s.code !== 'string' || typeof s.credentials !== 'string') return null;
    if (typeof s.playerID !== 'string') return null;
    if (typeof s.savedAt === 'number' && Date.now() - s.savedAt > SESSION_TTL_MS) {
      clearSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  const st = storage();
  if (!st) return;
  try {
    st.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Remembered between visits so nobody types their name twice. */
const NICK_KEY = 'laundromat.nickname.v1';

export function rememberNickname(n: string): void {
  const st = storage();
  if (!st) return;
  try {
    st.setItem(NICK_KEY, n);
  } catch {
    /* ignore */
  }
}

export function recallNickname(): string {
  const st = storage();
  if (!st) return '';
  try {
    return st.getItem(NICK_KEY) ?? '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// The share link
// ---------------------------------------------------------------------------

/**
 * `/join/ABCD` is the shape people paste into a group chat. `?join=ABCD` is
 * accepted too, because a static host without a history fallback will 404 on
 * the path form and the code should still survive.
 */
export function codeFromUrl(loc?: { pathname: string; search: string }): string | null {
  const l = loc ?? (typeof window === 'undefined' ? null : window.location);
  if (!l) return null;
  const m = /\/join\/([^/?#]+)/i.exec(l.pathname);
  if (m) {
    const code = normaliseCode(decodeURIComponent(m[1]));
    if (code.length === 4) return code;
  }
  try {
    const q = new URLSearchParams(l.search).get('join');
    if (q) {
      const code = normaliseCode(q);
      if (code.length === 4) return code;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function shareLink(code: string): string {
  if (typeof window === 'undefined') return `/join/${code}`;
  return `${window.location.origin}/join/${code}`;
}

/**
 * Drop `/join/ABCD` from the address bar once it has been consumed, so a
 * reload does not drag the player back into a join form they have left.
 */
export function clearJoinUrl(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const { pathname, search } = window.location;
  if (!/\/join\//i.test(pathname) && !/[?&]join=/.test(search)) return;
  try {
    window.history.replaceState({}, '', '/');
  } catch {
    /* ignore */
  }
}
