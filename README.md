# Laundromat

Rush to get all your dirty laundry washed before your friends do.

A board game for 3–6 players, in development. Everyone shares a bank of washing
machines; you load your own dirty items in, but so does everybody else, and the
machine does not care whose clothes are ruining whose. Get ten items clean first.

This repository holds the whole project: the game rules as executable code, a
playable digital version you can host and play with friends over the internet, a
simulator used to balance it, and the design documents and print rulebook.

---

## What is here

| Directory | What it is |
|---|---|
| `web/` | The playable implementation — React + TypeScript + Vite client and a Node game server. Hot-seat on one device, or online with a four-character room code. **This is the main codebase.** |
| `sim/` | Python. `rules.py` is the reference implementation of the ruleset and serves as the oracle the TypeScript version is tested against; `run.py` runs seeded balance sweeps with bot policies; `test_rules.py` is its unit suite. |
| `design/` | The design record: the brief, superseded rule drafts, research, the divergence register, and the print rulebook source. |
| `assets/` | Art sheets — item cards and colour groups. |
| `board-game-research.md` | Background research on engines, frameworks and how to build an interactive board game at all. Written before the implementation started; it is why the app is boardgame.io + React. |

## Play it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

That gives you hot-seat: everyone plays on one screen, with a "pass the device"
interstitial between turns because hands are the only hidden information in the
game.

For online play you need the server as well as the client:

```bash
cd web
npm run build:all
PORT=8000 npm start        # http://localhost:8000
```

One process serves the client, the lobby API and the game socket on one port.
Create a room, share the code, and everyone plays from their own device.

## Deploy it

`web/DEPLOY.md` covers Fly.io, Render and plain Docker end to end. The committed
`web/fly.toml` targets app `play-laundromat` in region `sjc`.

Two things about it are worth knowing before you start, because they shape every
platform setting:

- **Rooms live in memory.** There is no database — a deliberate v1 decision. A
  restart, redeploy or crash ends every game in progress. Deploy between
  sessions, not during one.
- **Run exactly one instance.** boardgame.io's default store is per-process, so
  two instances behind one hostname means two disjoint sets of rooms, and two
  players typing the same code land in different games.

## The three artefacts, and why they disagree

There are three descriptions of this game and they are not identical:

1. `design/game-brief.md` — the brief, currently **v9**. Ground truth for design.
2. `sim/rules.py` — the Python oracle, still on brief v8 in several places.
3. `web/src/rules/` — the prototype, which the designer plays and steers
   directly, and which is ahead of both on some rules.

`design/implementation-status.md` is the register of exactly where they diverge,
rule by rule, and which simulation results are still safe to cite. Read it before
quoting a balance number at anybody — several published figures in `sim/out/`
describe a game the app no longer plays.

The one thing that *is* pinned across the divide is the reckoning. `web/`'s
`machineVerdicts()` is checked against `sim/rules.py` on ~60 worked examples, an
exhaustive enumeration of every 1–3 item machine, and a 5,000-machine random
sweep with cards attached. That suite is a pure-function comparison, so none of
the divergences above can reach it.

## Working on it

Start with **[`web/README.md`](web/README.md)**. It is thorough: the code layout
and the reasoning behind it, the full state shape, every configurable rule and
its default, how the reckoning works, what the parity suite does and does not
guarantee, and what is not built yet.

`CLAUDE.md` at the root is the short version aimed at coding agents — commands,
where things live, and the traps.

The rulebook is built from `design/rulebook/`:

```bash
python3 design/rulebook/build.py     # -> design/rulebook/rulebook.html
```

It inlines every art sheet as a data URI, so the output is a single file with no
external dependency of any kind.

## Status

Physically playtested many times with paper cards; the core loop is confirmed
fun. The digital version plays complete games at 3–6 players, hot-seat and
online, with the full v8/v9 ruleset. The name is a placeholder and is expected to
change before print.
