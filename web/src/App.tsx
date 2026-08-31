import { useState } from 'react';
import { Client } from 'boardgame.io/react';
import { makeLaundromat } from './game/Laundromat';
import { Board } from './ui/Board';
import { Online } from './online/Online';
import { codeFromUrl, loadSession } from './online/session';
import { PLACEHOLDER_SPECIAL_DECK, SPECIAL_DECK_IS_PROVISIONAL } from './rules/config';
import { RulesGuide } from './ui/RulesGuide';
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
  /*
   * NULL until the player picks, deliberately. It used to default to 4, which
   * meant the commonest way to start a game was to never notice the control and
   * always play four-handed. The count changes the washer count, the capacity
   * and how many items you must wash, so it is a real decision and the screen
   * now asks for it before it will start.
   *
   * Only the hot-seat button waits for it. An online room takes its count from
   * whoever actually joins (`Online.tsx`, `count = players.length`), so gating
   * that button would be demanding a number the game then throws away.
   */
  const [players, setPlayers] = useState<number | null>(null);

  const deckTotal = Object.values(PLACEHOLDER_SPECIAL_DECK).reduce((a, b) => a + b, 0);

  return (
    <div className="app setup">
      <h1 style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>Laundromat</h1>

      <div className="player-pick" role="group" aria-label="Number of players">
        <span className="pick-label">How many players?</span>
        <div className="pick-row">
          {[3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              className={`pick-btn${players === n ? ' on' : ''}`}
              aria-pressed={players === n}
              /* Without this the accessible name reads "5 6 washers", which is
                 the two halves of the label run together and useless aloud. */
              aria-label={`${n} players`}
              onClick={() => setPlayers(n)}
            >
              <b>{n}</b>
              <span>{n + 1} washers</span>
            </button>
          ))}
        </div>
      </div>

      {/* Both buttons are actions now. "Play on this device" used to be an inert
          toggle whose aria-pressed never changed, with the real start button
          below the whole rules guide — so the way to begin a game was to scroll
          past everything. */}
      <div className="mode-choice" role="group" aria-label="How to play">
        <button
          className="mode-btn primary"
          disabled={players === null}
          onClick={() => players !== null && onStart({ players })}
        >
          Play on this device
        </button>
        <button className="mode-btn" onClick={onGoOnline}>
          Play online
        </button>
      </div>

      <p className="note">
        {players === null
          ? 'Choose a player count to start on this device. Playing online, the room fills as people join.'
          : `Hot-seat for ${players}. Everyone shares this screen, and hands stay private between turns.`}
      </p>

      <RulesGuide players={players} onPlayersChange={setPlayers} />

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

    </div>
  );
}
