import { useState } from 'react';
import { Client } from 'boardgame.io/react';
import type { BoardProps } from 'boardgame.io/react';
import { makeLaundromat } from './game/Laundromat';
import type { LaundromatG } from './game/Laundromat';
import { Board } from './ui/Board';
import { Online } from './online/Online';
import { codeFromUrl, loadSession } from './online/session';
import { RulesGuide } from './ui/RulesGuide';
import { BOT_LEVELS, type BotLevel } from './game/bot';
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
  /** Seat -> difficulty for any seat a bot is playing. Absent = all human. */
  bots?: Record<number, BotLevel>;
  /** Seat -> display name. Absent seats fall back to "Player N". */
  names?: Record<number, string>;
  /** Seat -> colour index into the six printed colours. Identity by default. */
  colours?: Record<number, number>;
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
  /*
   * The board is wrapped rather than passed the seat data directly: Client()
   * decides what props the board gets, so anything of ours has to be closed
   * over here. The wrapper is also where the bot driver lives, because it needs
   * the same G/ctx/moves the board is rendering from.
   */
  const SeatedBoard = (props: BoardProps<LaundromatG>) => (
    <Board
      {...props}
      bots={settings.bots ?? null}
      seatNames={settings.names ?? null}
      seatColours={settings.colours ?? null}
    />
  );

  const LaundromatClient = Client({
    game: makeLaundromat(),
    board: SeatedBoard,
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
  /*
   * THREE WAYS IN, and they are genuinely different games rather than three
   * doors to the same setup:
   *
   *   solo    you and two bots. Three is the game's minimum, so this is the
   *           smallest real game rather than a practice mode.
   *   local   people around one screen, taking turns on this device.
   *   online  a room with a link to send.
   *
   * `mode` is null until one is chosen, so the screen asks a question rather
   * than presenting a default someone has to notice and undo.
   */
  const [mode, setMode] = useState<'solo' | 'local' | 'online' | null>(null);
  const [players, setPlayers] = useState<number | null>(null);
  const [level, setLevel] = useState<BotLevel>('normal');
  const [names, setNames] = useState<Record<number, string>>({});
  const [colours, setColours] = useState<Record<number, number>>({});

  const seats = players ?? 0;

  /** Which of the six printed colours a seat is wearing. */
  const colourOf = (seat: number) => colours[seat] ?? seat;
  /** Tapping a swatch takes the next colour nobody else is using. */
  function cycleColour(seat: number) {
    const taken = new Set(
      Array.from({ length: seats }, (_, i) => (i === seat ? -1 : colourOf(i))),
    );
    for (let step = 1; step <= 6; step++) {
      const next = (colourOf(seat) + step) % 6;
      if (!taken.has(next)) {
        setColours((c) => ({ ...c, [seat]: next }));
        return;
      }
    }
  }

  function startLocal() {
    if (players === null) return;
    onStart({ players, names, colours });
  }

  function startSolo() {
    // Seat 0 is you; the other two are bots at the chosen level.
    onStart({
      players: 3,
      bots: { 1: level, 2: level },
      names: { 0: names[0]?.trim() || 'You', 1: 'Bot one', 2: 'Bot two' },
      colours,
    });
  }

  return (
    <div className="app setup">
      <h1 style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>Laundromat</h1>

      <div className="modes" role="group" aria-label="How do you want to play?">
        <button
          type="button"
          className={`mode-card${mode === 'solo' ? ' on' : ''}`}
          aria-pressed={mode === 'solo'}
          onClick={() => setMode('solo')}
        >
          <b>Play by myself</b>
          <span>You and two bots. Best for a quick playtest.</span>
          <em className="mode-tag">recommended</em>
        </button>

        <button
          type="button"
          className={`mode-card${mode === 'local' ? ' on' : ''}`}
          aria-pressed={mode === 'local'}
          onClick={() => setMode('local')}
        >
          <b>Play with friends here</b>
          <span>Everyone in the room, taking turns on this device.</span>
        </button>

        <button
          type="button"
          className={`mode-card${mode === 'online' ? ' on' : ''}`}
          aria-pressed={mode === 'online'}
          onClick={() => {
            setMode('online');
            onGoOnline();
          }}
        >
          <b>Play online</b>
          <span>Open a room and send your friends the link.</span>
        </button>
      </div>

      {/* ---------------------------------------------------------- solo */}
      {mode === 'solo' && (
        <div className="mode-panel">
          <label className="pick-label" htmlFor="solo-name">
            Your name
          </label>
          <input
            id="solo-name"
            className="contact-input"
            placeholder="You"
            value={names[0] ?? ''}
            onChange={(e) => setNames((n) => ({ ...n, 0: e.target.value }))}
          />

          <span className="pick-label" style={{ marginTop: 14 }}>
            How hard should the bots be?
          </span>
          <div className="pick-row">
            {BOT_LEVELS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`pick-btn wide${level === b.id ? ' on' : ''}`}
                aria-pressed={level === b.id}
                onClick={() => setLevel(b.id)}
              >
                <b>{b.label}</b>
                <span>{b.blurb}</span>
              </button>
            ))}
          </div>

          <div className="mode-choice">
            <button className="mode-btn primary" onClick={startSolo}>
              Start the day
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- local */}
      {mode === 'local' && (
        <div className="mode-panel">
          <span className="pick-label">How many players?</span>
          <div className="pick-row">
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                className={`pick-btn${players === n ? ' on' : ''}`}
                aria-pressed={players === n}
                aria-label={`${n} players`}
                onClick={() => setPlayers(n)}
              >
                <b>{n}</b>
                <span>{n + 1} washers</span>
              </button>
            ))}
          </div>

          {players !== null && (
            <>
              <span className="pick-label" style={{ marginTop: 16 }}>
                Who is playing?
              </span>
              <div className="seat-list">
                {Array.from({ length: players }, (_, seat) => (
                  <div className="seat-row" key={seat}>
                    {/* Colours are assigned already so nobody is blocked
                        choosing; tapping takes the next unused one. */}
                    <button
                      type="button"
                      className="seat-swatch"
                      style={{ background: `var(--p${colourOf(seat)})` }}
                      onClick={() => cycleColour(seat)}
                      aria-label={`Change colour for player ${seat + 1}`}
                      title="Tap for another colour"
                    />
                    <input
                      className="contact-input"
                      placeholder={`Player ${seat + 1}`}
                      value={names[seat] ?? ''}
                      onChange={(e) => setNames((n) => ({ ...n, [seat]: e.target.value }))}
                      aria-label={`Name for player ${seat + 1}`}
                    />
                  </div>
                ))}
              </div>

              <div className="mode-choice">
                <button className="mode-btn primary" onClick={startLocal}>
                  Start the day
                </button>
              </div>
              <p className="note">
                Names are optional — anyone left blank plays as Player N.
              </p>
            </>
          )}
        </div>
      )}

      <RulesGuide players={players} onPlayersChange={setPlayers} />

      {/*
        The provisional-deck banner used to sit here: a warning that the 20-card
        composition is a placeholder being settled by simulation, with the copy
        counts listed. That is a note to the DESIGNER, and it was being shown to
        every player on the way into a game. SPECIAL_DECK_IS_PROVISIONAL is still
        true and still lives in config.ts, where the people it concerns will
        find it.
      */}

    </div>
  );
}
