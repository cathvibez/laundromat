/**
 * The logging contract.
 *
 * Two things here are not cosmetic. Credentials are bearer tokens for a seat —
 * anyone holding one can play as that person — so a credential reaching a log
 * line is a security bug, not a tidiness one. And the fields `room` and `user`
 * are the whole debugging story: scripts/logs.sh filters on exactly those two
 * names, so renaming one silently breaks the tooling rather than a test.
 */

import { describe, expect, it } from 'vitest';
import pino from 'pino';
import {
  REDACT_CENSOR,
  REDACT_PATHS,
  fingerprint,
  forRoom,
  forUser,
} from '../../server/log';

/** Capture what pino actually serialises, which is the thing that matters. */
function capture(): { lines: Record<string, unknown>[]; stream: { write(s: string): void } } {
  const lines: Record<string, unknown>[] = [];
  return {
    lines,
    stream: {
      write(s: string) {
        lines.push(JSON.parse(s));
      },
    },
  };
}

describe('fingerprint', () => {
  it('is stable for the same input', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc'));
  });

  it('differs between people', () => {
    expect(fingerprint('alice')).not.toBe(fingerprint('bob'));
  });

  it('does not leak the raw value it was given', () => {
    // The client's id is a header a player controls. Hashing means a hostile
    // value cannot forge another player's id in the logs, and it means the
    // stored id itself never appears on disk anywhere.
    const raw = 'a-very-recognisable-value';
    expect(fingerprint(raw)).not.toContain(raw);
  });

  it('is short enough to read but wide enough not to collide', () => {
    const fp = fingerprint('someone');
    expect(fp).toHaveLength(12);
    expect(fp).toMatch(/^[0-9a-f]{12}$/);
  });

  it('degrades to a marker rather than throwing when there is no id', () => {
    expect(fingerprint(undefined)).toBe('anon');
    expect(fingerprint('')).toBe('anon');
  });
});

describe('child loggers carry the fields the tooling filters on', () => {
  it('tags room and user', () => {
    const { lines, stream } = capture();
    const base = pino({ base: null }, stream as never);
    base.child({ room: '8U3W', user: 'abc123' }).info('hello');

    expect(lines[0].room).toBe('8U3W');
    expect(lines[0].user).toBe('abc123');
  });

  it('forRoom omits user when there is not one, rather than writing undefined', () => {
    expect(forRoom('8U3W').bindings().user).toBeUndefined();
    expect(forRoom('8U3W', 'abc').bindings().user).toBe('abc');
    expect(forRoom('8U3W').bindings().room).toBe('8U3W');
  });

  it('forUser tags the person before they are in a room', () => {
    expect(forUser('abc').bindings()).toMatchObject({ user: 'abc' });
  });
});

describe('redaction', () => {
  it('never writes a credential', () => {
    const { lines, stream } = capture();
    const guarded = pino(
      {
        base: null,
        redact: { paths: ['credentials', '*.credentials'], censor: '[redacted]' },
      },
      stream as never,
    );

    guarded.info({ credentials: 'SUPERSECRET', seat: { credentials: 'ALSOSECRET' } }, 'joined');

    const text = JSON.stringify(lines[0]);
    expect(text).not.toContain('SUPERSECRET');
    expect(text).not.toContain('ALSOSECRET');
    expect(lines[0].credentials).toBe('[redacted]');
  });

  /*
   * Against the REAL exported config, not a copy — a copy would keep passing
   * after someone deleted the paths from the logger itself.
   */
  it('the production config censors credentials wherever they appear', () => {
    const { lines, stream } = capture();
    const real = pino(
      { base: null, redact: { paths: REDACT_PATHS, censor: REDACT_CENSOR } },
      stream as never,
    );

    real.info(
      {
        credentials: 'TOP_LEVEL_SECRET',
        seat: { credentials: 'NESTED_SECRET' },
        req: { headers: { 'x-credentials': 'HEADER_SECRET' } },
      },
      'start',
    );

    const text = JSON.stringify(lines[0]);
    for (const secret of ['TOP_LEVEL_SECRET', 'NESTED_SECRET', 'HEADER_SECRET']) {
      expect(text).not.toContain(secret);
    }
  });

  it('still guards the credential paths at all', () => {
    expect(REDACT_PATHS).toContain('credentials');
    expect(REDACT_PATHS.some((p) => p.includes('x-credentials'))).toBe(true);
  });
});
