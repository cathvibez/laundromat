/**
 * PLAYTEST BOTS.
 *
 * One brain, three temperaments. Every decision below is made the same way:
 * enumerate the legal options, score each from the bot's own point of view,
 * then pick from that ranking according to difficulty —
 *
 *   'dumbdumb'  the WORST legal option. Not random: actively unhelpful, which
 *               is a different and much easier opponent than a careless one.
 *   'normal'    a legal option at random. No plan, no malice.
 *   'hell'      the best option it can see.
 *
 * Building it as one scorer with three selectors rather than three policies is
 * the whole trick: the difficulties cannot drift apart, and a rule learned by
 * one is learned by all three.
 *
 * It lives in `game/` and not `rules/` on purpose. A bot READS the rules and
 * returns a legal move; it must never be something the rules consult, or the
 * ruleset starts depending on how well somebody plays it.
 *
 * It implements the EXISTING `Policy` interface from rules/driver.ts rather
 * than inventing a second shape, which buys two things: `playGame` can run
 * whole games against it headlessly, so the bots are testable without a
 * browser; and the app and the test harness cannot end up with two different
 * ideas of what a bot is.
 */

import type {
  GameState,
  ItemId,
  PlayerId,
  SpecialName,
} from '../rules/types';
import type { SpecialTarget } from '../rules/phases';
import type { Policy } from '../rules/driver';
import { canDisplace, canPlaySpecial, coffeeTargets } from '../rules/phases';
import { machineAccepts } from '../rules/placement';
import { machineStatus, willTangle } from '../rules/selectors';
import { machineVerdicts } from '../rules/reckoning';
import { cardsKeyOf, opts } from '../rules/phases';

export type BotLevel = 'dumbdumb' | 'normal' | 'hell';

export const BOT_LEVELS: { id: BotLevel; label: string; blurb: string }[] = [
  { id: 'dumbdumb', label: 'Dumbdumb', blurb: 'Picks the worst thing it can find. Good for learning the shape of a turn.' },
  { id: 'normal', label: 'Normal', blurb: 'Plays legal moves at random. No plan, no malice.' },
  { id: 'hell', label: 'Hell mode', blurb: 'Loads where its own laundry washes and yours does not.' },
];

/** Deterministic-ish pick, so a bot is not re-rolled by every React render. */
function choose<T>(options: T[], scores: number[], level: BotLevel): T | null {
  if (options.length === 0) return null;
  if (level === 'normal') return options[Math.floor(Math.random() * options.length)];
  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    const better = level === 'hell' ? scores[i] > scores[best] : scores[i] < scores[best];
    if (better) best = i;
  }
  return options[best];
}

/* ------------------------------------------------------------------ scoring */

/**
 * What would happen to everything in machine `mi` if `extra` were added to it.
 * The bot asks the REAL reckoning rather than approximating it, so it cannot
 * develop beliefs the game does not share.
 */
function outcomeOf(
  st: GameState,
  mi: number,
  me: PlayerId,
  extra?: ItemId,
): { mine: number; theirs: number; myLosses: number } {
  const m = st.machines[mi];
  if (!m || machineStatus(m) !== 'on') return { mine: 0, theirs: 0, myLosses: 0 };

  const ids = extra ? [...m.items, extra] : m.items;
  const contents = ids.map((id) => st.items[id]);
  const verdicts = machineVerdicts(contents, cardsKeyOf(m), opts(st));

  let mine = 0;
  let theirs = 0;
  let myLosses = 0;
  contents.forEach((item, i) => {
    const washes = verdicts[i] && !willTangle(st, m, item);
    if (item.owner === me) {
      if (washes) mine += 1;
      else myLosses += 1;
    } else if (washes) {
      theirs += 1;
    }
  });
  return { mine, theirs, myLosses };
}

/**
 * Higher is better FOR THIS BOT. Its own clean laundry is the win condition, so
 * it dominates; other people's clean laundry is a real cost because this is a
 * race; and its own items coming back is the thing it should fear most, since
 * they occupy a machine and return dirty.
 */
function scoreLoad(st: GameState, me: PlayerId, item: ItemId, mi: number): number {
  const before = outcomeOf(st, mi, me);
  const after = outcomeOf(st, mi, me, item);
  return (
    (after.mine - before.mine) * 10 -
    (after.theirs - before.theirs) * 4 -
    (after.myLosses - before.myLosses) * 6
  );
}

/* ------------------------------------------------------------- the decisions */

export interface LoadChoice {
  item: ItemId;
  machine: number;
}

function chooseLoad(st: GameState, me: PlayerId, level: BotLevel): LoadChoice | null {
  const hand = st.players[me]?.hand ?? [];
  const options: LoadChoice[] = [];
  const scores: number[] = [];
  for (let mi = 0; mi < st.machines.length; mi++) {
    for (const item of hand) {
      if (!machineAccepts(st, mi, item)) continue;
      options.push({ item, machine: mi });
      scores.push(scoreLoad(st, me, item, mi));
    }
  }
  return choose(options, scores, level);
}

/** The roll of 4: move one item between machines. Passing is always allowed. */
function chooseDisplace(
  st: GameState,
  me: PlayerId,
  level: BotLevel,
): { from: number; item: ItemId; to: number } | null {
  const options: { from: number; item: ItemId; to: number }[] = [];
  const scores: number[] = [];
  for (let from = 0; from < st.machines.length; from++) {
    const src = st.machines[from];
    if (!src) continue;
    for (const item of src.items) {
      for (let to = 0; to < st.machines.length; to++) {
        // THE RULES DECIDE, not a copy of them here. Reimplementing this was
        // how the bot started proposing moves out of a machine Jimothy is
        // sitting in, which the engine rejects as illegal.
        if (!canDisplace(st, from, item, to)) continue;
        options.push({ from, item, to });
        // Moving it out of `from` and into `to`: score both ends.
        const gain =
          scoreLoad(st, me, item, to) -
          (outcomeOf(st, from, me).mine - outcomeOf(st, from, me, item).mine);
        scores.push(gain);
      }
    }
  }
  // A move that helps nobody is worse than not moving, so hell mode declines.
  const pick = choose(options, scores, level);
  if (!pick) return null;
  if (level === 'hell') {
    const i = options.indexOf(pick);
    if (scores[i] <= 0) return null;
  }
  return pick;
}

/** Of two drawn specials, which to keep. */
function chooseKeep(pair: SpecialName[], level: BotLevel): SpecialName {
  if (pair.length === 1) return pair[0];
  // Without modelling every card, order by how reliably each one helps.
  const RANK: Record<string, number> = {
    'Wash net': 5, Sanitizer: 4, Coin: 3, Bleach: 2, Snacc: 1, Gang: 0,
  };
  const scores = pair.map((n) => RANK[n] ?? 2);
  return choose(pair, scores, level) ?? pair[0];
}

/** Which machine to point an event at. */
function chooseMachine(
  st: GameState,
  me: PlayerId,
  level: BotLevel,
  candidates: number[],
): number | null {
  if (candidates.length === 0) return null;
  // Hurting a machine is good when it is full of OTHER people's laundry.
  const scores = candidates.map((mi) => {
    const o = outcomeOf(st, mi, me);
    return o.theirs * 4 - o.mine * 10;
  });
  return choose(candidates, scores, level);
}

/**
 * The keyholder's choice: which machine to switch, or pass.
 * Returns null to pass.
 */
function chooseKey(
  st: GameState,
  me: PlayerId,
  level: BotLevel,
): { machine: number; on: boolean } | null {
  const options: { machine: number; on: boolean }[] = [];
  const scores: number[] = [];
  for (let mi = 0; mi < st.machines.length; mi++) {
    const m = st.machines[mi];
    if (!m || m.dead || m.jimothy) continue;
    const o = outcomeOf(st, mi, me);
    if (m.on) {
      // Switching OFF denies whatever would have washed.
      options.push({ machine: mi, on: false });
      scores.push(o.theirs * 4 - o.mine * 10);
    } else {
      // Switching ON runs it.
      options.push({ machine: mi, on: true });
      scores.push(o.mine * 10 - o.theirs * 4);
    }
  }
  const pick = choose(options, scores, level);
  if (!pick) return null;
  if (level === 'hell') {
    const i = options.indexOf(pick);
    if (scores[i] <= 0) return null; // passing beats a move that does not help
  }
  return pick;
}


/* ------------------------------------------------------ the Policy it exposes */

/**
 * A bot at one difficulty, in the shape rules/driver.ts already understands.
 * `playGame(st, botPolicy('hell'), rng)` plays a whole game against it.
 */
export function botPolicy(level: BotLevel): Policy {
  return {
    chooseLoad: (st, pid) => chooseLoad(st, pid, level),
    chooseDisplace: (st, pid) => chooseDisplace(st, pid, level),
    chooseKeep: (_st, _pid, pair) => chooseKeep(pair, level),
    chooseKey: (st, pid) => chooseKey(st, pid, level),
    chooseGang: (st, pid, cands) => chooseMachine(st, pid, level, cands) ?? cands[0],
    chooseJimothy: (st, pid, cands) => chooseMachine(st, pid, level, cands) ?? cands[0],
    chooseSpecial: (st, pid) => {
      const ready = st.players[pid].ready.filter((n) => canPlaySpecial(st, pid, n));
      if (ready.length === 0) return null;
      // A dumbdumb holds on to everything; the others play the first thing they
      // can, aimed by chooseMachine.
      if (level === 'dumbdumb') return null;
      const name = ready[0];
      /*
       * COFFEE FIRST: it is the only card whose target is not a machine id, so
       * it has to be handled before the machine-shaped path below. Falling
       * through would hand applySpecial `{player: undefined}` and take the game
       * down — the same trap the driver's GreedyPolicy fell into.
       * A hell-mode bot spills on whoever is furthest along; the others take
       * the first available.
       */
      if (name === 'Coffee') {
        const victims = coffeeTargets(st, pid).filter((t) => t.items.length > 0);
        if (victims.length === 0) return null;
        const worst =
          level === 'hell'
            ? victims.reduce((a, b) => (b.items.length > a.items.length ? b : a))
            : victims[0];
        return { name, target: { player: worst.player, item: worst.items[0] } };
      }
      const live = st.machines.filter((m) => !m.dead).map((m) => m.id);
      if (live.length === 0) return null;
      const target = chooseMachine(st, pid, level, live) ?? live[0];
      const t: SpecialTarget =
        name === 'Coin' ? { machine: target, on: true } : (target as SpecialTarget);
      return { name, target: t };
    },
  };
}
