# How to Build an Interactive Board Game — Research Summary

---

## 1. Frameworks & Engines

### Comparison Matrix

| Scenario | Top Pick | Runner-Up |
|---|---|---|
| **Web, turn-based, multiplayer** | **boardgame.io + React** | Phaser |
| **Web, visually rich 2D** | **Phaser** | PixiJS + custom logic |
| **Web, simple/casual** | **Konva.js** or React + SVG | Plain Canvas |
| **Cross-platform indie** | **Godot 4** | Unity |
| **Cross-platform commercial** | **Unity** | Godot 4 |
| **3D tabletop simulation** | **Three.js** (web) or **Godot 4** (native) | Babylon.js / Unity |
| **TypeScript-first web game** | **Excalibur.js** | Phaser (has TS support) |
| **Fastest prototype** | **boardgame.io + React** | Godot 4 |

### Web-Based: Full Game Frameworks

#### Phaser (v3.x / v4)
- **Strengths:** Largest HTML5 game framework community. Rich plugin ecosystem. Built-in physics, input handling, scene management, tilemaps, tweens. Excellent documentation and tutorials. First-class support for tile/grid maps.
- **Weaknesses:** Opinionated architecture — harder to integrate into existing web apps (e.g., React). Bundle size is significant (~1 MB). Rendering abstraction means less low-level control.
- **Learning curve:** Moderate. Well-documented but has its own paradigms.
- **Community:** Very large — ~37k GitHub stars, active Discord, hundreds of tutorials.
- **Board game suitability:** Excellent. Native tilemap support, built-in drag-and-drop, scene system works well for turns/phases.

#### Excalibur.js
- **Strengths:** Written in TypeScript from the ground up. Clean, modern API. Entity-component architecture.
- **Weaknesses:** Smaller ecosystem, fewer tutorials. Less battle-tested for large projects.
- **Learning curve:** Low-to-moderate. TypeScript-native API is intuitive for web devs.
- **Community:** ~1.7k GitHub stars, active and responsive maintainers.
- **Board game suitability:** Good. Clean actor/scene model maps well to board game entities.

#### boardgame.io
- **Strengths:** Purpose-built for turn-based board games. Handles game state, turns, phases, moves, victory conditions, and multiplayer networking out of the box. Framework-agnostic. Built-in AI via MCTS.
- **Weaknesses:** Rendering is BYO. Not a visual engine. Limited to turn-based/discrete mechanics.
- **Learning curve:** Low for game logic; moderate overall since you need a separate rendering solution.
- **Community:** ~10k GitHub stars. Niche but dedicated.
- **Board game suitability:** Purpose-built. The single best option for truly turn-based games with discrete moves.

### Web-Based: Rendering Libraries

#### PixiJS (v7/v8)
- **Strengths:** Best-in-class 2D WebGL renderer. Extremely fast. Rich sprite, text, and filter support.
- **Weaknesses:** Not a game framework — no built-in physics, scene management, or game loop.
- **Learning curve:** Low for rendering; high for building a full game.
- **Community:** ~44k GitHub stars.
- **Board game suitability:** Good as a renderer. Pair with boardgame.io for game logic.

#### Konva.js
- **Strengths:** Canvas abstraction with a DOM-like node tree. Excellent drag-and-drop (first-class feature). React wrapper (react-konva).
- **Weaknesses:** Not GPU-accelerated (Canvas 2D). Performance degrades with many objects (>1000).
- **Learning curve:** Very low. Feels like working with DOM elements.
- **Community:** ~11k GitHub stars.
- **Board game suitability:** Surprisingly good for simpler board games. Native drag-and-drop, easy hit detection.

#### Three.js / Babylon.js
- **Strengths:** Full 3D WebGL/WebGPU engines. Babylon.js is more batteries-included.
- **Weaknesses:** Massive overkill for 2D board games. Steep learning curve.
- **Board game suitability:** Niche — only justified for 3D tabletop simulations.

### Cross-Platform: Native Engines

#### Godot (v4.x)
- **Strengths:** Free and open-source (MIT). Lightweight editor. GDScript is easy to learn. Excellent first-class 2D engine. Built-in tilemap editor. Exports to desktop, mobile, and web.
- **Weaknesses:** Smaller asset marketplace than Unity. Web export performance can lag behind native.
- **Learning curve:** Low-to-moderate. GDScript is Python-like.
- **Community:** ~92k GitHub stars, rapidly growing.
- **Board game suitability:** Excellent. TileMap node, signal system, built-in drag-and-drop, AnimationPlayer.

#### Unity
- **Strengths:** Largest game engine ecosystem. Massive asset store. C# scripting. Best tooling for multiplayer.
- **Weaknesses:** Heavy for simple 2D board games (1+ GB editor). Runtime fee controversy. Slower 2D iteration vs Godot.
- **Learning curve:** Moderate-to-high.
- **Board game suitability:** Good but heavy. Justified if you need polished multiplayer or plan to scale.

#### Unreal Engine
- **Board game suitability:** Poor. Not recommended for board games unless you want photorealistic 3D tabletop simulation.

### Key Insight

Board games split cleanly into **game logic** and **rendering**. The strongest web approach is to use **boardgame.io** for state/turns/multiplayer and pair it with your renderer of choice (React for simple, Phaser or PixiJS for rich). For native/cross-platform, **Godot 4** offers the best power-to-complexity ratio.

---

## 2. Architecture Patterns

### Game State Management

The most robust approach is a **single, serializable, immutable data structure**:

```
GameState {
  board: Board          // grid, graph, or spatial representation
  players: Player[]     // per-player state (hand, resources, score)
  currentPlayer: ID
  phase: Phase          // e.g., Setup, Playing, Scoring, GameOver
  turnNumber: int
  actionLog: Action[]   // history of all actions taken
  rng_seed: Seed        // deterministic randomness
}
```

**Key principles:**
- **Single source of truth.** All game state lives in one object.
- **Serializable.** The entire state can be JSON-serialized for saving, networking, or debugging.
- **Derive, don't store.** Computed values should be derived from state via pure functions, not stored redundantly.
- **Separate state from presentation.** The UI reads state and renders it; it never *is* the state.

**Board representation options:**
- **2D array** for grid-based games (chess, checkers, Go)
- **Adjacency list / graph** for territory or network games (Catan, Ticket to Ride)
- **Collection of entities** for card games or games with heterogeneous pieces

**Player state separation:**
- **Public state** — visible to all
- **Private state** — visible only to the owning player
- **Hidden state** — visible to no one (e.g., shuffled deck)

### Game Loop Design

Board games should use an **event-driven, async action-processing loop** (not a real-time game loop):

```
while game not over:
    valid_actions = rules.getValidActions(state)
    action = await currentPlayer.chooseAction(valid_actions)
    state = rules.applyAction(state, action)
    broadcast(state)
```

An **event bus** or observer pattern decouples the game engine from the UI:
- Game engine emits events: `PieceMoved`, `CardDrawn`, `PhaseChanged`, `GameOver`
- UI layer subscribes and updates visuals, plays animations, triggers sounds
- AI agents subscribe to the same events

### Rules Engine

#### Action/Reducer Pattern (Recommended)

```
newState = reducer(currentState, action)
```

- Each action type has a corresponding reducer function
- The reducer validates the action and returns a new state (or an error)
- Rules are expressed as validation functions and state transition functions

#### Rule Objects / Strategy Pattern

For complex games with many conditional rules:

```typescript
interface Rule {
  appliesTo(state, action): boolean
  validate(state, action): Result
  apply(state, action): State
}
```

**Separation advice:**
- Do not embed rules in UI code
- Do not embed rules in entity classes
- Make validation a first-class concept — expose `getValidMoves(state)`

### Undo/Redo and Replay

**Event Sourcing** is the most powerful and recommended pattern:
- State is immutable; each action produces a new state object
- The action log is the canonical history
- Undo = truncate the log and replay from scratch (or nearest cached snapshot)
- Replay = iterate through the log, applying actions one at a time
- Deterministic randomness (seeded RNG) ensures replays are identical

Alternative: **Command Pattern** for simpler games, or **State Snapshots (Memento)** at key intervals.

### ECS vs. Object-Oriented

**For most board games, a hybrid data-oriented approach works best:**
- Use plain data objects for state — not class hierarchies
- Use pure functions organized by concern (movement rules, capture rules, scoring)
- Reserve full ECS for games with complex, dynamic entity composition (e.g., deckbuilders with arbitrary card effect combinations)

### State Machines

Use **finite or hierarchical state machines** for game phase management:

```
Setup -> Playing -> Scoring -> GameOver

Within Playing:
RollDice -> MoveToken -> ResolveTile -> DrawCard -> EndTurn
```

- **XState** (TypeScript) is a popular, well-documented statechart library with visual tooling
- For simple games, a phase enum with a switch statement in the reducer is sufficient

### Summary Table

| Concern | Recommended Pattern | Key Benefit |
|---|---|---|
| State management | Single immutable state object | Predictable, serializable, debuggable |
| Game loop | Event-driven, async action processing | Decouples engine from UI and input |
| Rules engine | Action/Reducer + validation functions | Testable, composable, UI-independent |
| Undo/redo/replay | Event sourcing (action log + replay) | Undo, replay, networking, debugging for free |
| Entity modeling | Data-oriented (plain objects + pure functions) | Avoids inheritance pitfalls |
| Phase management | Finite/hierarchical state machines | Prevents illegal state transitions |

### Overarching Principles

1. **Separate state, rules, and presentation** into distinct layers
2. **Make state immutable and serializable**
3. **Express rules as pure functions** from (state, action) to new state
4. **Use state machines for phase management** — not ad-hoc boolean flags
5. **Log all actions** — enables event sourcing, replay, and analytics
6. **Design for determinism** — use seeded RNG

---

## 3. Multiplayer & Networking

### Networking Approaches

#### WebSockets (Client-Server) — Recommended

| Pros | Cons |
|------|------|
| Reliable, ordered delivery (TCP) | Requires a server |
| Broad browser support | Single point of failure |
| Simple event-based programming model | Server costs scale with player count |
| Low latency for turn-based (~tens of ms) | |
| Mature ecosystem (Socket.IO, ws) | |

#### WebRTC (Peer-to-Peer)

| Pros | Cons |
|------|------|
| No ongoing server cost after connection | Complex NAT traversal |
| Lower latency (UDP, direct path) | No authoritative server = harder anti-cheat |
| Good for 2-player games | Scales poorly beyond ~4-6 peers |

**Verdict:** Client-server with WebSockets is strongly recommended for board games — low bandwidth needs, simple reconnection, and anti-cheat for hidden information.

### State Synchronization

| Strategy | Best For | Key Trade-off |
|---|---|---|
| **Authoritative Server** | Games with hidden info (cards, roles) | Round-trip latency before confirmation |
| **Lockstep Simulation** | Deterministic replay needs | Cannot support hidden info easily |
| **Optimistic Updates** | Snappy drag-and-drop UI | Must handle server rejection rollbacks |

**Recommendation:** Authoritative server as foundation + optimistic UI updates for responsiveness.

### Frameworks Comparison

| Framework | Type | Best For | Notes |
|---|---|---|---|
| **boardgame.io** | Board game framework | Turn-based web games | Purpose-built; fastest path to playable |
| **Colyseus** | Game server framework | Flexible multiplayer | Room-based, Unity SDK, good docs |
| **Socket.IO** | General WebSocket lib | Full control needed | You build everything yourself |
| **Nakama** | Full game backend | Commercial products | Auth, matchmaking, leaderboards, chat |
| **Photon** | Commercial platform | Unity games at scale | Per-CCU pricing, managed infrastructure |

### Matchmaking & Lobbies

- **Private games:** Use short alphanumeric room codes (4-6 chars)
- **Public matchmaking:** ELO or Glicko-2 rating, match within widening rating window
- **Player readiness:** Require "ready" signal before starting
- **Spectators:** Read-only connections receiving state updates
- **Invite links:** `yourgame.com/join/ABCD` deep-linking into lobby

### Disconnection Handling

| Strategy | Details |
|---|---|
| **Reconnection window** | 30-120 seconds, persist state on server, send full state on reconnect |
| **Turn timeout** | Skip turn, default move, or forfeit after timeout |
| **AI substitution** | Replace disconnected player with bot (boardgame.io supports this) |
| **Async/persistent** | Store state in DB, push notifications when it's your turn |
| **Session tokens** | Reclaim seat on reconnect (don't rely on socket IDs) |
| **Heartbeats** | Ping every 5-10s to detect disconnections quickly |

**Recommended reconnection flow:**

```
1. Client detects disconnect (WebSocket close)
2. Client shows "Reconnecting...", exponential backoff retry
3. Server marks player disconnected, starts grace period
4. Other players see "[Player] disconnected, waiting..."
5a. Reconnect → session token → full state → resume
5b. Grace period expires → timeout policy (skip/bot/forfeit)
```

### Local Multiplayer (Hot-Seat)

- Show a "pass the device" interstitial to hide previous player's state
- Use the same game state engine as online play, skip the network layer
- For tablet: consider rotating UI 180 degrees for the opposite player
- Allow undo within a turn only (not after passing)

---

## 4. UI/UX Design

### Visual Design

- **Center the board** as the primary focal element; player dashboards and controls on the periphery
- **Clear visual hierarchy:** board > active zones/pieces > scores/logs
- **Distinct silhouettes** for every piece type — identifiable by shape alone (colorblind accessibility)
- **Consistent scale:** minimum 44x44px touch targets
- **State indication:** glow, outline, or subtle animation for selected/movable/threatened pieces
- **Card design:** prioritize scannability — title, cost, and primary effect visible at hand size; detail on zoom
- **Animations:** purposeful only (200-400ms for UI transitions, up to 1s for dramatic moments); provide skip/fast mode

### Interaction Patterns

- **Desktop:** Drag-and-drop with snap-to-grid and ghost/preview at target
- **Mobile:** Click-to-select (two-step) — tap piece, then tap destination; highlight valid targets
- **Touch targets:** 44x44pt (iOS) / 48x48dp (Android)
- **Pinch-to-zoom:** essential for complex boards on mobile
- **Long-press for info:** equivalent to hover on desktop
- **Never make critical info hover-only** — always provide tap/long-press alternative

### Accessibility

- **Colorblind modes:** patterns, shapes, or icons in addition to color
- **Screen reader support:** ARIA roles, live regions for state changes
- **Keyboard navigation:** Tab/arrow keys through board spaces and cards
- **Text scaling:** respect system font size, legible at 200% zoom
- **Reduced motion:** honor `prefers-reduced-motion`

### Information Display

- **Always visible:** current turn, active player, round/phase, primary resource counts
- **Turn indicator:** prominent colored banner + "Your Turn" text + optional sound
- **Scoreboard:** compact, always visible, with relative indicators
- **Game log:** scrollable chronological text with icons and color
- **Tooltips:** hover/long-press for detailed card text, piece abilities, space effects
- **Contextual rule reminders** when making decisions

### Responsive Design

| Breakpoint | Strategy |
|---|---|
| **Desktop (1200px+)** | Full board, player panels on sides, game log sidebar |
| **Tablet (768-1199px)** | Slightly reduced board, compact panels, log in pull-out drawer |
| **Mobile (<768px)** | Pinch-zoom + pan board, bottom sheet for hand, tabbed views |

- Use SVG or high-res sprites for scalable assets
- Use Canvas/WebGL (PixiJS, Phaser) when DOM rendering becomes sluggish

### Audio Design

- **Action confirmation:** short, satisfying sounds for placing pieces, drawing cards, rolling dice
- **State changes:** distinct sounds for turn start/end, scoring, game over
- **Invalid moves:** soft, non-harsh tone
- **Ambient music:** thematic, unobtrusive, with dynamic intensity layers
- **Mute by default in multiplayer** — many players use voice chat
- **Separate volume sliders** for music, SFX, and notifications

### Onboarding & Tutorials

- **Interactive tutorials:** guided first game, teaching one concept per step
- **Progressive disclosure:** introduce mechanics as they become relevant
- **In-game rulebook:** searchable, hyperlinked, accessible anytime
- **Contextual help:** "Why can't I do this?" explanations for invalid actions
- **Practice vs AI** before live multiplayer
- **Skip option** for experienced players
- **One-time tooltips** on first encounter with new UI elements

### Notable Examples to Study

| Game/Platform | Key Lesson |
|---|---|
| **Board Game Arena** | Clean, consistent UI framework across 700+ games; excellent game log |
| **Tabletop Simulator** | Power of physicality — 3D physics sandbox; freeform interaction |
| **Ticket to Ride** | Best-in-class mobile adaptation; simple interactions, pinch-zoom on large map |
| **Wingspan** | Beautiful art, smooth animations, excellent incremental tutorial |
| **Root** | Complex asymmetric game made approachable; strong contextual highlighting |
| **Slay the Spire** | Benchmark for card hand management and tooltip system |
| **Through the Ages** | Masterful adaptation of extreme complexity via tabbed views |

---

## 5. Open-Source Resources & AI

### Key Frameworks & Projects

| Project | Stars | Language | Description |
|---|---|---|---|
| **boardgame.io** | ~10k | JS/TS | Turn-based game framework; state reducers, phases, lobby, MCTS bot |
| **Lichess (lila)** | ~15k | Scala/TS | Gold standard open-source game platform |
| **OpenSpiel** | ~4k | C++/Python | DeepMind's game AI research framework; 70+ games, dozens of algorithms |
| **Ludii** | ~200 | Java | General game system; 1000+ historical games in a DSL |
| **Colyseus** | ~3k | TypeScript | Multiplayer game server; rooms, state sync, matchmaking |
| **VASSAL** | N/A | Java | Board game module engine; 20+ years, hundreds of existing modules |
| **Stockfish** | ~11k | C++ | World's strongest open-source chess engine |
| **KataGo** | ~3k | C++ | Leading open-source Go AI |
| **Leela Chess Zero** | ~2.5k | C++ | Open-source AlphaZero-style chess engine |

### Open-Source Game Implementations

| Project | Game | Notes |
|---|---|---|
| **Lichess** | Chess | Full-featured: puzzles, tournaments, analysis, Stockfish integration |
| **Sabaki** | Go | Board editor and SGF viewer (Electron) |
| **OGS** | Go | Open-source Go server |
| **FreeCiv** | Civilization | Complex turn-based strategy |
| Various small projects | Catan clones | Multiple exist but none achieved large-scale adoption |

### Prototyping Tools

| Tool | Type | Best For |
|---|---|---|
| **Tabletop Simulator** | Commercial (Steam) | 3D physics sandbox, Lua scripting, Steam Workshop |
| **Tabletop Playground** | Commercial (Steam) | Similar to TTS, Unreal-based, JS/TS scripting |
| **Screentop.gg** | Free web | Quick browser-based sandbox, no install |
| **playingcards.io** | Free web | Fast card game prototypes |
| **Tabletopia** | Freemium web | 3D browser-based tabletop |
| **VASSAL** | Free, open source | Wargames, large module library |
| **nanDECK** | Free (Windows) | Card generation from spreadsheets |

### AI/Bot Approaches

| Approach | Best For | Complexity |
|---|---|---|
| **Rule-based / Heuristic** | Prototyping, easy/medium opponents | Low |
| **Minimax + Alpha-Beta** | Two-player perfect-info games (chess, checkers) | Medium |
| **Monte Carlo Tree Search (MCTS)** | Large branching factor, no evaluation function needed | Medium |
| **Neural Networks + MCTS (AlphaZero)** | Superhuman play | High (significant compute for training) |
| **Counterfactual Regret Minimization (CFR)** | Imperfect-info games (poker, hidden roles) | High |

**Recommended ladder:** Start with rule-based bots for playtesting, graduate to MCTS for decent play without domain knowledge, consider AlphaZero-style training only if you need superhuman performance and have compute budget.

### Key AI Resources

| Project | Focus |
|---|---|
| **OpenSpiel** | Best single resource for game AI algorithms |
| **boardgame.io MCTSBot** | Plug-and-play MCTS for any boardgame.io game |
| **PettingZoo** | Gymnasium-style API for multi-agent RL |
| **Stockfish / KataGo / Leela Chess Zero** | State-of-the-art engines for chess and Go |

---

## Recommended Starting Stack

For a web-based board game prototype:

```
boardgame.io  →  game logic, turns, phases, multiplayer, bots
React         →  UI rendering (or Phaser for richer visuals)
XState        →  complex phase/turn state machines (optional)
```

This gives you state management, networking, AI opponents, undo/replay, and a lobby system with minimal custom code. You focus on designing the game rules and building the UI.

---

## Reference Links

- [Phaser](https://phaser.io/)
- [boardgame.io](https://boardgame.io/)
- [PixiJS](https://pixijs.com/)
- [Excalibur.js](https://excaliburjs.com/)
- [Konva.js](https://konvajs.org/)
- [Godot Engine](https://godotengine.org/)
- [Unity](https://unity.com/)
- [Three.js](https://threejs.org/)
- [Babylon.js](https://www.babylonjs.com/)
- [Colyseus](https://colyseus.io/)
- [Nakama](https://heroiclabs.com/)
- [XState](https://stately.ai/docs/xstate)
- [OpenSpiel (GitHub)](https://github.com/google-deepmind/open_spiel)
- [Ludii](https://ludii.games/)
- [Lichess (GitHub)](https://github.com/lichess-org/lila)
- [Martin Fowler — Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
