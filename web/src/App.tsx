import { useState } from 'react';
import { Client } from 'boardgame.io/react';
import { makeLaundromat } from './game/Laundromat';
import { Board } from './ui/Board';
import {
  CIRCUIT_BREAK_ARMS,
  EVENT_TIMING_ARMS,
  PLACEHOLDER_SPECIAL_DECK,
  SPECIAL_DECK_IS_PROVISIONAL,
} from './rules/config';
import type { CircuitBreakArm, EventTimingArm, LaundromatConfig } from './rules/types';
import './ui/styles.css';

interface Settings {
  players: number;
  circuitBreak: CircuitBreakArm;
  eventTiming: EventTimingArm;
  sanitizerOwnerOnly: boolean;
  keyholderFirst: boolean;
  publicDampZone: boolean;
}

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);

  if (!settings) return <Setup onStart={setSettings} />;

  const cfg: Partial<LaundromatConfig> = {
    circuitBreak: settings.circuitBreak,
    eventTiming: settings.eventTiming,
    sanitizerOwnerOnly: settings.sanitizerOwnerOnly,
    keyholderFirst: settings.keyholderFirst,
    publicDampZone: settings.publicDampZone,
  };

  const LaundromatClient = Client({
    game: makeLaundromat(cfg),
    board: Board,
    numPlayers: settings.players,
    debug: false,
  });

  return <LaundromatClient />;
}

function Setup({ onStart }: { onStart: (s: Settings) => void }) {
  const [players, setPlayers] = useState(4);
  const [arm, setArm] = useState<CircuitBreakArm>('V3');
  const [eventTiming, setEventTiming] = useState<EventTimingArm>('E1');
  const [sanitizerOwnerOnly, setSanitizerOwnerOnly] = useState(false);
  const [keyholderFirst, setKeyholderFirst] = useState(false);
  const [publicDampZone, setPublicDampZone] = useState(true);

  const deckTotal = Object.values(PLACEHOLDER_SPECIAL_DECK).reduce((a, b) => a + b, 0);

  return (
    <div className="app setup">
      <h1 style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>Laundromat</h1>
      <p className="note">
        Local hot-seat. Every player uses this one screen; hands are hidden between turns.
      </p>

      <label>Players</label>
      <select value={players} onChange={(e) => setPlayers(Number(e.target.value))}>
        {[3, 4, 5, 6].map((n) => (
          <option key={n} value={n}>
            {n} players - {n + 1} machines
          </option>
        ))}
      </select>

      <label>Circuit break variant (under A/B test)</label>
      <select value={arm} onChange={(e) => setArm(e.target.value as CircuitBreakArm)}>
        {(Object.keys(CIRCUIT_BREAK_ARMS) as CircuitBreakArm[]).map((k) => (
          <option key={k} value={k}>
            {k} - {CIRCUIT_BREAK_ARMS[k]}
          </option>
        ))}
      </select>
      <div className="note">
        V2 is what the brief currently says. V3 is what the simulation experiment recommends and is
        the default here. The designer has not committed.
      </div>

      <label>Event timing (experiment B, under test)</label>
      <select
        value={eventTiming}
        onChange={(e) => setEventTiming(e.target.value as EventTimingArm)}
      >
        {(Object.keys(EVENT_TIMING_ARMS) as EventTimingArm[]).map((k) => (
          <option key={k} value={k}>
            {k} - {EVENT_TIMING_ARMS[k]}
          </option>
        ))}
      </select>
      <div className="note">
        The event card is revealed the instant it is drawn in every arm; only the moment it
        RESOLVES differs. E2 is the brief as written and what the simulation assumes. E1 is the
        only arm in which a Coin can answer a Circuit break, or a Snacc move Jimothy, on the day it
        happens — but it lands unevenly on players who have already taken their turn, so it pairs
        well with the keyholder-first switch below. Full write-up in
        web/experiments/experiment-B-event-timing.md.
      </div>

      <label>Sensitivity switches</label>
      <div className="note" style={{ display: 'grid', gap: 6 }}>
        <label style={{ display: 'flex', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={sanitizerOwnerOnly}
            onChange={(e) => setSanitizerOwnerOnly(e.target.checked)}
          />
          Sanitizer protects only its owner (default is machine-wide)
        </label>
        <label style={{ display: 'flex', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={keyholderFirst}
            onChange={(e) => setKeyholderFirst(e.target.checked)}
          />
          Keyholder acts first each day (default is fixed seat order)
        </label>
        <label style={{ display: 'flex', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={publicDampZone}
            onChange={(e) => setPublicDampZone(e.target.checked)}
          />
          Damp socks sit in a public zone (default; the alternative hides them in hand)
        </label>
      </div>

      {SPECIAL_DECK_IS_PROVISIONAL && (
        <div className="banner" style={{ marginTop: 20 }}>
          <h3>Special item deck is provisional</h3>
          <div className="note warn">
            The {deckTotal}-card composition below is a FLAT PLACEHOLDER, not a design decision. Copy
            counts are still open and are being decided by simulation. Do not form an opinion about
            card balance from this deck.
          </div>
          <div className="note">
            {Object.entries(PLACEHOLDER_SPECIAL_DECK)
              .map(([k, v]) => `${k} x${v}`)
              .join(' · ')}
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <button
          className="primary"
          onClick={() =>
            onStart({
              players,
              circuitBreak: arm,
              eventTiming,
              sanitizerOwnerOnly,
              keyholderFirst,
              publicDampZone,
            })
          }
        >
          Start the day
        </button>
      </div>
    </div>
  );
}
