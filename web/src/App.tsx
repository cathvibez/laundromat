import { useState } from 'react';
import { Client } from 'boardgame.io/react';
import { makeLaundromat } from './game/Laundromat';
import { Board } from './ui/Board';
import { Online } from './online/Online';
import { codeFromUrl, loadSession } from './online/session';
import { PLACEHOLDER_SPECIAL_DECK, SPECIAL_DECK_IS_PROVISIONAL } from './rules/config';
import './ui/styles.css';

/*
 * Just the seat count.
 *
 * This used to carry four rule switches as well — two A/B arms and two
 * sensitivity toggles. All four were resolved in v10 and deleted from the
 * config, so there is nothing left for a player to choose before a game but
 * how many of them are playing. config.ts owns the rules now, alone.
 */
interface Settings {
  players: number;
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
  return { players: [3, 4, 5, 6].includes(n) ? n : 4 };
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

  /*
   * No overrides at all: every rule lives in config.ts.
   *
   * The setup screen used to pass four of them through, and once passed a
   * switch it should not have (keyholderFirst) and silently overrode the
   * config with it. There is nothing to get wrong now.
   */
  const LaundromatClient = Client({
    game: makeLaundromat(),
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

      <div className="banner" style={{ marginTop: 20 }}>
        <h3>The rules for this game</h3>
        <div className="note">
          Circuit break cancels the night — nothing washes, and no washer changes power.
          <br />
          Every event card takes effect the moment it is drawn; whoever drew it picks the
          washer for the Gang and for Jimothy.
          <br />
          Sanitizer stops shoes dominating everything in that washer, whoever owns them.
          <br />
          Socks loaded beside a blanket do not wash and stay in the washer until a night
          without one.
        </div>
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
          onClick={() => onStart({ players })}
        >
          Start the day
        </button>
      </div>
    </div>
  );
}
