/**
 * ONLINE PLAY — everything from "play online" up to the moment the board
 * appears.
 *
 * Three screens and no more: entry (create or join), lobby (who is here, what
 * the rules are, start), game. A stored seat short-circuits straight to a
 * rejoin offer, because the common case on a phone is not "I want to play",
 * it is "my screen locked and I am back".
 *
 * Nothing here knows how the transport works; it all goes through ./api.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CODE_LENGTH,
  humanNetError,
  isCompleteCode,
  loadNet,
  normaliseCode,
} from './api';
import type { NetApi, OnlineSettings, RoomInfo, Seat } from './api';
import {
  clearJoinUrl,
  clearSession,
  codeFromUrl,
  loadSession,
  recallNickname,
  rememberNickname,
  saveSession,
  shareLink,
} from './session';
import type { StoredSession } from './session';
import { CIRCUIT_BREAK_ARMS, EVENT_TIMING_ARMS } from '../rules/config';
import type { CircuitBreakArm, EventTimingArm } from '../rules/types';

export const ADMIN_SEAT = '0';
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

const POLL_MS = 2000;

type Screen =
  | { k: 'entry' }
  | { k: 'lobby'; seat: Seat; nickname: string }
  | { k: 'game'; seat: Seat; nickname: string };

export function Online({ onExit }: { onExit: () => void }) {
  const [net, setNet] = useState<NetApi | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ k: 'entry' });

  useEffect(() => {
    let live = true;
    loadNet().then(
      (n) => live && setNet(n),
      (e) => live && setNetError(humanNetError(e, 'create')),
    );
    return () => {
      live = false;
    };
  }, []);

  const enterRoom = useCallback((seat: Seat, nickname: string, started: boolean) => {
    saveSession({
      code: seat.code,
      playerID: seat.playerID,
      credentials: seat.credentials,
      nickname,
      settings: seat.settings,
    });
    rememberNickname(nickname);
    clearJoinUrl();
    setScreen(started ? { k: 'game', seat, nickname } : { k: 'lobby', seat, nickname });
  }, []);

  const leave = useCallback(() => {
    clearSession();
    setScreen({ k: 'entry' });
  }, []);

  if (netError) {
    return (
      <div className="app setup">
        <LobbyMasthead title="Online play is offline" />
        <div className="banner" role="alert">
          <h3>Cannot reach online play</h3>
          <div>{netError}</div>
          <div className="note">
            Play on this device still works — nothing about the game needs a server.
          </div>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary" onClick={onExit}>
            Back to play on this device
          </button>
          <button onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  if (!net) {
    return (
      <div className="app setup">
        <LobbyMasthead title="Online" />
        <p className="note">Reaching the game server…</p>
      </div>
    );
  }

  if (screen.k === 'entry') {
    return <Entry net={net} onEnter={enterRoom} onExit={onExit} />;
  }

  if (screen.k === 'lobby') {
    return (
      <Lobby
        net={net}
        seat={screen.seat}
        nickname={screen.nickname}
        onStarted={() => setScreen({ k: 'game', seat: screen.seat, nickname: screen.nickname })}
        onLeave={leave}
      />
    );
  }

  return <OnlineGame net={net} seat={screen.seat} onLeave={leave} />;
}

// ---------------------------------------------------------------------------
// Entry: rejoin, create, join
// ---------------------------------------------------------------------------

function Entry({
  net,
  onEnter,
  onExit,
}: {
  net: NetApi;
  onEnter: (seat: Seat, nickname: string, started: boolean) => void;
  onExit: () => void;
}) {
  const urlCode = useMemo(() => codeFromUrl(), []);
  const [stored, setStored] = useState<StoredSession | null>(() => loadSession());
  const [nickname, setNickname] = useState(() => recallNickname());
  const [code, setCode] = useState(() => urlCode ?? '');
  const [busy, setBusy] = useState<'create' | 'join' | 'rejoin' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanNick = nickname.trim().slice(0, 16);

  async function create() {
    if (!cleanNick) return setError('Type a name first, so the others know who they are waiting for.');
    setError(null);
    setBusy('create');
    try {
      const seat = await net.createRoom(cleanNick);
      onEnter(seat, cleanNick, false);
    } catch (e) {
      setError(humanNetError(e, 'create'));
      setBusy(null);
    }
  }

  async function join() {
    if (!cleanNick) return setError('Type a name first, so the others know who has arrived.');
    if (!isCompleteCode(code)) return setError(`Room codes are ${CODE_LENGTH} characters.`);
    setError(null);
    setBusy('join');
    try {
      const seat = await net.joinRoom(code, cleanNick);
      onEnter(seat, cleanNick, false);
    } catch (e) {
      setError(humanNetError(e, 'join'));
      setBusy(null);
    }
  }

  /** Rejoin is a getRoom first: the room may be gone, or already playing. */
  async function rejoin(s: StoredSession) {
    setError(null);
    setBusy('rejoin');
    try {
      const room = await net.getRoom(s.code);
      const seat: Seat = {
        code: s.code,
        playerID: s.playerID,
        credentials: s.credentials,
        settings: room.settings ?? s.settings ?? {},
      };
      onEnter(seat, s.nickname, room.started);
    } catch (e) {
      setError(humanNetError(e, 'lobby'));
      clearSession();
      setStored(null);
      setBusy(null);
    }
  }

  return (
    <div className="app setup">
      <LobbyMasthead title="Play online" />

      {stored && (
        <div className="rejoin-card">
          <h3>You were in room {stored.code}</h3>
          <p className="note">
            Playing as <b>{stored.nickname}</b>, seat {Number(stored.playerID) + 1}. Your seat is
            held — nobody else can take it.
          </p>
          <div className="row">
            <button className="primary" disabled={busy !== null} onClick={() => rejoin(stored)}>
              {busy === 'rejoin' ? 'Rejoining…' : `Rejoin ${stored.code}`}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => {
                clearSession();
                setStored(null);
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      <label htmlFor="nickname">Your name</label>
      <input
        id="nickname"
        value={nickname}
        maxLength={16}
        autoComplete="nickname"
        placeholder="Nina"
        onChange={(e) => setNickname(e.target.value)}
      />
      <div className="note">Everyone in the room sees this. Sixteen characters at most.</div>

      {error && (
        <div className="banner error" role="alert" style={{ marginTop: 16 }}>
          <h3>That did not work</h3>
          <div>{error}</div>
        </div>
      )}

      <div className="online-split">
        <div className="online-half">
          <h3>Start a room</h3>
          <p className="note">
            You become the host: you set the rules and press start. Three players minimum, six
            maximum.
          </p>
          <button className="primary" disabled={busy !== null} onClick={create}>
            {busy === 'create' ? 'Opening…' : 'Create a room'}
          </button>
        </div>

        <div className="online-half">
          <h3>Join a room</h3>
          <label htmlFor="code">Room code</label>
          <input
            id="code"
            className="code-input"
            value={code}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ABCD"
            aria-label="Room code"
            onChange={(e) => setCode(normaliseCode(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void join();
            }}
          />
          <div className="note">
            Four characters. Upper or lower case, it does not matter — there is no I, O, 0 or 1 in a
            code.
          </div>
          <button
            className="primary"
            disabled={busy !== null || !isCompleteCode(code)}
            onClick={join}
          >
            {busy === 'join' ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 22 }}>
        <button onClick={onExit}>Back</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Polling the room
// ---------------------------------------------------------------------------

interface RoomPoll {
  room: RoomInfo | null;
  /** Set only after repeated failures — one blip must not clear the roster. */
  trouble: string | null;
  refresh: () => void;
}

function useRoom(net: NetApi, code: string, active: boolean): RoomPoll {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const fails = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const r = await net.getRoom(code);
        if (!live) return;
        fails.current = 0;
        setTrouble(null);
        setRoom(r);
      } catch (e) {
        if (!live) return;
        fails.current += 1;
        if (fails.current >= 3) setTrouble(humanNetError(e, 'lobby'));
      } finally {
        if (live) timer = setTimeout(poll, POLL_MS);
      }
    };
    void poll();

    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [net, code, active, tick]);

  return { room, trouble, refresh: () => setTick((n) => n + 1) };
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

function Lobby({
  net,
  seat,
  nickname,
  onStarted,
  onLeave,
}: {
  net: NetApi;
  seat: Seat;
  nickname: string;
  onStarted: () => void;
  onLeave: () => void;
}) {
  const { room, trouble } = useRoom(net, seat.code, true);
  const isAdmin = seat.playerID === ADMIN_SEAT;
  const [settings, setSettings] = useState<OnlineSettings>(seat.settings ?? {});
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  // The server is the authority on settings; keep the local copy in step
  // except while a write of ours is in flight.
  const inflight = useRef(0);
  useEffect(() => {
    if (room?.settings && inflight.current === 0) setSettings(room.settings);
  }, [room?.settings]);

  useEffect(() => {
    if (room?.started) onStarted();
  }, [room?.started, onStarted]);

  const players = room?.players ?? [
    { playerID: seat.playerID, nickname, connected: true },
  ];
  const count = players.length;
  const enough = count >= MIN_PLAYERS;
  const adminSeat = players.find((p) => p.playerID === ADMIN_SEAT);
  const adminAway = adminSeat !== undefined && !adminSeat.connected;

  async function change(partial: OnlineSettings) {
    const before = settings;
    setSettings({ ...settings, ...partial });
    setSettingsError(null);
    inflight.current += 1;
    try {
      const res = await net.updateSettings(
        seat.code,
        { playerID: seat.playerID, credentials: seat.credentials },
        partial,
      );
      if (res?.settings) setSettings(res.settings);
    } catch (e) {
      setSettings(before); // never leave a lie on screen
      setSettingsError(humanNetError(e, 'settings'));
    } finally {
      inflight.current -= 1;
    }
  }

  async function start() {
    setStartError(null);
    setStarting(true);
    try {
      await net.startGame(seat.code, {
        playerID: seat.playerID,
        credentials: seat.credentials,
      });
      onStarted();
    } catch (e) {
      setStartError(humanNetError(e, 'start'));
      setStarting(false);
    }
  }

  const link = shareLink(seat.code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="app setup lobby">
      <LobbyMasthead title={isAdmin ? 'Your room' : 'Waiting room'} />

      <div className="code-card">
        <div className="code-label">Room code</div>
        <div className="code-big" aria-label={`Room code ${seat.code.split('').join(' ')}`}>
          {seat.code}
        </div>
        <div className="note">Read it out, or send the link.</div>
        <div className="row share-row">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Join link" />
          <button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
      </div>

      {trouble && (
        <div className="banner error" role="alert">
          <h3>Not hearing from the room</h3>
          <div>{trouble}</div>
          <div className="note">
            Still trying. The list below is the last thing we knew for certain.
          </div>
        </div>
      )}

      <div className="section-title">
        Players ({count} of {MAX_PLAYERS})
      </div>
      <div className="roster">
        {players.map((p) => (
          <div
            key={p.playerID}
            className={`roster-row${p.playerID === seat.playerID ? ' me' : ''}${p.connected ? '' : ' away'}`}
          >
            <span className="seat-dot" data-seat={p.playerID} />
            <span className="roster-name">{p.nickname}</span>
            {p.playerID === ADMIN_SEAT && <span className="badge key">host</span>}
            {p.playerID === seat.playerID && <span className="badge phase">you</span>}
            {!p.connected && <span className="badge provisional">away</span>}
          </div>
        ))}
        {Array.from({ length: Math.max(0, MIN_PLAYERS - count) }).map((_, i) => (
          <div key={`empty${i}`} className="roster-row empty">
            <span className="seat-dot ghost" />
            <span className="roster-name">waiting for a player…</span>
          </div>
        ))}
      </div>

      {adminAway && (
        <div className="banner" role="status">
          <h3>The host has dropped out</h3>
          <div>
            {isAdmin
              ? 'Your own connection looks unstable.'
              : `${adminSeat?.nickname ?? 'The host'} has lost their connection. Only they can start the game, so nothing will happen until they are back.`}
          </div>
        </div>
      )}

      <div className="section-title">Rules for this game</div>
      {isAdmin ? (
        <SettingsForm settings={settings} onChange={change} />
      ) : (
        <SettingsSummary settings={settings} />
      )}
      {settingsError && (
        <div className="banner error" role="alert">
          <h3>Setting not saved</h3>
          <div>{settingsError}</div>
        </div>
      )}

      {isAdmin ? (
        <div className="start-block">
          <button className="primary big" disabled={!enough || starting} onClick={start}>
            {starting ? 'Starting…' : `Start the day with ${count} players`}
          </button>
          <div className={`note${enough ? '' : ' warn'}`}>
            {enough
              ? 'Everyone in the room is dealt in. Nobody can join once it starts.'
              : `Laundromat needs ${MIN_PLAYERS} players. ${MIN_PLAYERS - count} more to go — send them the code.`}
          </div>
          {startError && (
            <div className="banner error" role="alert">
              <h3>Could not start</h3>
              <div>{startError}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="waiting-block">
          <div className="waiting-spinner" aria-hidden="true" />
          <div>
            <b>
              Waiting for {adminSeat?.nickname ?? 'the host'} to start
              {enough ? '' : ` — ${MIN_PLAYERS - count} more player${MIN_PLAYERS - count === 1 ? '' : 's'} needed`}
            </b>
            <div className="note">
              You are in. Nothing to do here but wait — the board appears for everyone at once.
            </div>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 24 }}>
        <button onClick={onLeave}>Leave the room</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings, editable and read-only. Same words in both, so that what the host
// picked and what you are told they picked can never drift apart.
// ---------------------------------------------------------------------------

function SettingsForm({
  settings,
  onChange,
}: {
  settings: OnlineSettings;
  onChange: (partial: OnlineSettings) => void;
}) {
  const cb = (settings.circuitBreak ?? 'V3') as CircuitBreakArm;
  const et = (settings.eventTiming ?? 'E1') as EventTimingArm;
  return (
    <div className="settings-form">
      <label htmlFor="cb">Circuit break variant</label>
      <select
        id="cb"
        value={cb}
        onChange={(e) => onChange({ circuitBreak: e.target.value as CircuitBreakArm })}
      >
        {(Object.keys(CIRCUIT_BREAK_ARMS) as CircuitBreakArm[]).map((k) => (
          <option key={k} value={k}>
            {k} - {CIRCUIT_BREAK_ARMS[k]}
          </option>
        ))}
      </select>

      <label htmlFor="et">Event timing</label>
      <select
        id="et"
        value={et}
        onChange={(e) => onChange({ eventTiming: e.target.value as EventTimingArm })}
      >
        {(Object.keys(EVENT_TIMING_ARMS) as EventTimingArm[]).map((k) => (
          <option key={k} value={k}>
            {k} - {EVENT_TIMING_ARMS[k]}
          </option>
        ))}
      </select>

      <label style={{ textTransform: 'none', letterSpacing: 0, display: 'flex', gap: 8 }}>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={settings.sanitizerOwnerOnly === true}
          onChange={(e) => onChange({ sanitizerOwnerOnly: e.target.checked })}
        />
        Sanitizer protects only its owner
      </label>
      <label style={{ textTransform: 'none', letterSpacing: 0, display: 'flex', gap: 8 }}>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={settings.publicDampZone !== false}
          onChange={(e) => onChange({ publicDampZone: e.target.checked })}
        />
        Damp socks sit in a public zone
      </label>
      <div className="note">
        Changes are saved for everyone as you make them. They lock when the game starts.
      </div>
    </div>
  );
}

function SettingsSummary({ settings }: { settings: OnlineSettings }) {
  const cb = (settings.circuitBreak ?? 'V3') as CircuitBreakArm;
  const et = (settings.eventTiming ?? 'E1') as EventTimingArm;
  return (
    <div className="settings-summary">
      <div className="summary-row">
        <span className="summary-key">Circuit break</span>
        <span>
          {cb} — {CIRCUIT_BREAK_ARMS[cb]}
        </span>
      </div>
      <div className="summary-row">
        <span className="summary-key">Event timing</span>
        <span>
          {et} — {EVENT_TIMING_ARMS[et]}
        </span>
      </div>
      <div className="summary-row">
        <span className="summary-key">Sanitizer</span>
        <span>{settings.sanitizerOwnerOnly ? 'protects its owner only' : 'protects the whole machine'}</span>
      </div>
      <div className="summary-row">
        <span className="summary-key">Damp socks</span>
        <span>{settings.publicDampZone === false ? 'return to your hand' : 'sit in a public zone'}</span>
      </div>
      <div className="note">The host chooses these. They lock when the game starts.</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The game itself
// ---------------------------------------------------------------------------

function OnlineGame({ net, seat, onLeave }: { net: NetApi; seat: Seat; onLeave: () => void }) {
  // Built ONCE. Rebuilding the client tears down the socket and drops the seat.
  const [Client] = useState(() =>
    net.makeClient({
      code: seat.code,
      playerID: seat.playerID,
      credentials: seat.credentials,
    }),
  );
  const [crashed, setCrashed] = useState<string | null>(null);

  useEffect(() => {
    if (typeof Client !== 'function') setCrashed('The game client could not be created.');
  }, [Client]);

  if (crashed) {
    return (
      <div className="app setup">
        <LobbyMasthead title="Something went wrong" />
        <div className="banner error" role="alert">
          <h3>Could not open the board</h3>
          <div>{crashed}</div>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button onClick={() => window.location.reload()}>Reload</button>
          <button onClick={onLeave}>Leave the room</button>
        </div>
      </div>
    );
  }

  return <Client />;
}

// ---------------------------------------------------------------------------

function LobbyMasthead({ title }: { title: string }) {
  return (
    <header className="lobby-head">
      <h1>Laundromat</h1>
      <span className="lobby-sub">{title}</span>
    </header>
  );
}
