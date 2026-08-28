import { useState } from 'react';
import { Client } from 'boardgame.io/react';
import { makeLaundromat } from './game/Laundromat';
import { Board } from './ui/Board';
import { Online } from './online/Online';
import { codeFromUrl, loadSession } from './online/session';
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
  publicDampZone: boolean;
}

/**
 * Dev convenience: `?autostart` skips the setup screen with sane defaults, and
 * `?players=5` picks the count. Used for screenshots and manual testing; it
 * reads settings only and cannot reach any rule the setup screen cannot.
 */
function autoStartSettings(): Settings | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (!q.has('autostart')) return null;
  const n = Number(q.get('players') ?? 4);
  return {
    players: [3, 4, 5, 6].includes(n) ? n : 4,
    circuitBreak: 'V3',
    eventTiming: 'E1',
    sanitizerOwnerOnly: false,
    publicDampZone: true,
  };
}

/**
 * Two ways to play, and they share nothing but the rules.
 *
 * `local` is the hot-seat the designer tests with every day; it is the default
 * and is unchanged. `online` is the networked client. A stored seat or a
 * /join/ABCD link opens straight on `online`, because someone arriving that way
 * has already made the choice.
 */
type Mode = 'local' | 'online';

function initialMode(): Mode {
  if (typeof window === 'undefined') return 'local';
  if (new URLSearchParams(window.location.search).has('autostart')) return 'local';
  return codeFromUrl() !== null || loadSession() !== null ? 'online' : 'local';
}

export function App() {
  const [settings, setSettings] = useState<Settings | null>(autoStartSettings);
  const [mode, setMode] = useState<Mode>(initialMode);

  if (!settings && mode === 'online') return <Online onExit={() => setMode('local')} />;

  if (!settings) return <Setup onStart={setSettings} onGoOnline={() => setMode('online')} />;

  const cfg: Partial<LaundromatConfig> = {
    circuitBreak: settings.circuitBreak,
    eventTiming: settings.eventTiming,
    sanitizerOwnerOnly: settings.sanitizerOwnerOnly,
    // keyholderFirst is NOT overridable: brief v9 section 4 settles it as always true and
    // config.ts owns it. The setup screen used to offer it as a switch defaulting
    // to false, which silently overrode the config and made the app play fixed
    // seat order.
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

function Setup({
  onStart,
  onGoOnline,
}: {
  onStart: (s: Settings) => void;
  onGoOnline: () => void;
}) {
  const [players, setPlayers] = useState(4);
  const [arm, setArm] = useState<CircuitBreakArm>('V3');
  const [eventTiming, setEventTiming] = useState<EventTimingArm>('E1');
  const [sanitizerOwnerOnly, setSanitizerOwnerOnly] = useState(false);
  const [publicDampZone, setPublicDampZone] = useState(true);

  const deckTotal = Object.values(PLACEHOLDER_SPECIAL_DECK).reduce((a, b) => a + b, 0);

  return (
    <div className="app setup">
      <h1 style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>Laundromat</h1>

      <div className="mode-choice" role="group" aria-label="How to play">
        <button className="mode-btn active" aria-pressed="true">
          Play on this device
        </button>
        <button className="mode-btn" aria-pressed="false" onClick={onGoOnline}>
          Play online
        </button>
      </div>

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
