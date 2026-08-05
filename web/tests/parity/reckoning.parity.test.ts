/**
 * PARITY SUITE.
 *
 * Every case in tests/parity/fixtures/reckoning.json was produced by calling
 * `machine_verdicts` in sim/rules.py -- the trusted Python oracle.  This file
 * replays each one through src/rules/reckoning.ts and asserts the verdicts are
 * identical.  If the two implementations ever drift, this goes red.
 *
 * Regenerate with:   python3 tools/gen_fixtures.py
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { machineVerdicts } from '../../src/rules/reckoning';
import type { CardsKey, ItemKey, ReckoningOpts } from '../../src/rules/reckoning';
import { DICE } from '../../src/rules/phases';
import { MACHINES_BY_PLAYERS, defaultConfig } from '../../src/rules/config';
import {
  ATTACHING,
  EVENTS,
  FIXED_EVENT_DECK,
  IMMEDIATE,
  SPECIALS,
  TYPE_NAMES,
} from '../../src/rules/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');

interface Case {
  id: string;
  note: string;
  items: ItemKey[];
  cards: CardsKey;
  opts: ReckoningOpts;
  expected: boolean[];
}

interface Payload {
  counts: Record<string, number>;
  cases: Case[];
}

function loadJson<T>(name: string): T | null {
  const p = path.join(FIXTURES, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

const payload = loadJson<Payload>('reckoning.json');
const constants = loadJson<Record<string, unknown>>('constants.json');

const MISSING =
  'Parity fixtures are absent. Generate them from the Python oracle with:\n' +
  '    cd web && python3 tools/gen_fixtures.py\n' +
  'The parity suite is a hard requirement; do not delete this test to make it green.';

describe('reckoning parity with sim/rules.py', () => {
  test('fixtures exist', () => {
    expect(payload, MISSING).not.toBeNull();
  });

  if (!payload) return;

  test('fixture file is substantial', () => {
    expect(payload.cases.length).toBeGreaterThan(10000);
    expect(payload.counts.named).toBeGreaterThan(50);
    expect(payload.counts.random).toBeGreaterThanOrEqual(5000);
  });

  test('every named worked example matches the oracle', () => {
    const named = payload.cases.filter((c) => !c.id.startsWith('EX') && !c.id.startsWith('RND'));
    const failures: string[] = [];
    for (const c of named) {
      const got = machineVerdicts(c.items, c.cards, c.opts);
      if (JSON.stringify([...got]) !== JSON.stringify(c.expected)) {
        failures.push(`${c.id} (${c.note}): expected ${JSON.stringify(c.expected)}, got ${JSON.stringify([...got])}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test('every exhaustive 1-3 item machine matches the oracle', () => {
    const ex = payload.cases.filter((c) => c.id.startsWith('EX'));
    let checked = 0;
    const failures: string[] = [];
    for (const c of ex) {
      const got = machineVerdicts(c.items, c.cards, c.opts);
      checked++;
      if (JSON.stringify([...got]) !== JSON.stringify(c.expected)) {
        failures.push(`${c.id}: ${JSON.stringify(c.items)} -> ${JSON.stringify([...got])} vs ${JSON.stringify(c.expected)}`);
        if (failures.length > 20) break;
      }
    }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(10000);
  });

  test('the random sweep, with cards and both sensitivity readings, matches the oracle', () => {
    const rnd = payload.cases.filter((c) => c.id.startsWith('RND'));
    const failures: string[] = [];
    for (const c of rnd) {
      const got = machineVerdicts(c.items, c.cards, c.opts);
      if (JSON.stringify([...got]) !== JSON.stringify(c.expected)) {
        failures.push(`${c.id}: ${JSON.stringify(c)} -> ${JSON.stringify([...got])}`);
        if (failures.length > 20) break;
      }
    }
    expect(failures).toEqual([]);
    expect(rnd.length).toBeGreaterThanOrEqual(5000);
  });
});

describe('component constants parity', () => {
  test('constants fixture exists', () => {
    expect(constants, MISSING).not.toBeNull();
  });

  if (!constants) return;

  test('item taxonomy matches', () => {
    expect(constants.typeNames).toEqual([...TYPE_NAMES]);
  });

  test('card lists match', () => {
    expect(constants.specials).toEqual([...SPECIALS]);
    expect(constants.attaching).toEqual([...ATTACHING].sort());
    expect(constants.immediate).toEqual([...IMMEDIATE].sort());
    expect(constants.events).toEqual([...EVENTS]);
    expect(constants.fixedEventDeck).toEqual(FIXED_EVENT_DECK);
  });

  test('board totals match', () => {
    const byPlayers = constants.machinesByPlayers as Record<string, number>;
    for (const [p, m] of Object.entries(byPlayers)) {
      expect(MACHINES_BY_PLAYERS[Number(p)]).toBe(m);
    }
    expect(constants.capacity).toBe(defaultConfig(4).capacity);
    expect(constants.handSize).toBe(defaultConfig(4).handSize);
    expect(constants.crowdThreshold).toBe(defaultConfig(4).crowdThreshold);
  });

  test('the dice table matches', () => {
    const dice = constants.dice as Record<string, { load: number; extra: string | null }>;
    for (const [face, spec] of Object.entries(dice)) {
      expect(DICE[Number(face)].load).toBe(spec.load);
      expect(DICE[Number(face)].extra).toBe(spec.extra);
    }
  });
});
