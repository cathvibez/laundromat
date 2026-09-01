/**
 * Headless day driver.  Mirrors rules.py `play_day` / `play_game`.
 *
 * The React app does NOT use this: boardgame.io drives the same phase functions
 * turn by turn.  This exists so the test suite can play thousands of complete
 * games without a framework, which is how the invariants and termination
 * properties are checked.
 */

import { hasLegalPlacement, loadableItems, machineAccepts } from './placement';
import {
  advanceIfDone,
  assertInvariants,
  beginTurn,
  canPlaySpecial,
  displace,
  drawSpecialPair,
  eventNeedsChoice,
  gangTargets,
  keepSpecial,
  loadItem,
  loadsOutstanding,
  mustStillLoad,
  phaseEndOfDay,
  phaseEvent,
  phaseReckon,
  loadBlocked,
  skipBlockedLoad,
  blockedDisplace,
  canBlockedDisplace,
  resolveEventNow,
  playSpecial,
  setPower,
  skipCard,
  skipExtra,
  DICE,
  rollDie,
} from './phases';
import { coffeeTargets } from './phases';
import type { SpecialTarget } from './phases';
import type { Rng } from './rng';
import { actingOrder } from './setup';
import type { GameState, ItemId, PlayerId, SpecialName } from './types';

export interface Policy {
  chooseLoad(st: GameState, pid: PlayerId): { item: ItemId; machine: number } | null;
  chooseSpecial?(st: GameState, pid: PlayerId): { name: SpecialName; target: SpecialTarget } | null;
  chooseKeep?(st: GameState, pid: PlayerId, pair: SpecialName[]): SpecialName;
  chooseDisplace?(st: GameState, pid: PlayerId): { from: number; item: ItemId; to: number } | null;
  chooseKey?(st: GameState, pid: PlayerId): { machine: number; on: boolean } | null;
  chooseGang?(st: GameState, pid: PlayerId, cands: number[]): number;
  chooseJimothy?(st: GameState, pid: PlayerId, cands: number[]): number;
}

export function playDay(st: GameState, policy: Policy, rng: Rng): void {
  st.day += 1;

  // ---- PHASE 1: roll ------------------------------------------------------
  for (const pid of actingOrder(st)) {
    beginTurn(st, pid);
    rollDie(st, rng);
    let guard = 0;
    while (st.turn!.stage !== 'done') {
      if (guard++ > 200) throw new Error('turn did not terminate');
      const t = st.turn!;
      if (t.stage === 'card') {
        const play = policy.chooseSpecial?.(st, pid) ?? null;
        if (play && canPlaySpecial(st, pid, play.name)) playSpecial(st, pid, play.name, play.target, rng);
        else skipCard(st, rng);
      } else if (t.stage === 'load') {
        if (loadBlocked(st)) {
          /*
           * v11: moving one of your own items is the substitute for a load you
           * cannot make, and it takes precedence — skipBlockedLoad now refuses
           * while such a move exists, so the driver would spin forever if it did
           * not try this first.
           */
          const sub = firstBlockedDisplacement(st);
          if (sub) blockedDisplace(st, sub.from, sub.item, sub.to, rng);
          else skipBlockedLoad(st, rng);
          continue;
        }
        if (!mustStillLoad(st)) {
          advanceIfDone(st, rng);
          continue;
        }
        const choice = policy.chooseLoad(st, pid) ?? anyLegalLoad(st, pid);
        if (!choice) {
          // mandatory loading is "as many as you can" [A-W15]
          st.turn!.loadsRequired = st.turn!.loadsDone;
          advanceIfDone(st, rng);
          continue;
        }
        loadItem(st, pid, choice.item, choice.machine, rng);
      } else if (t.stage === 'extra') {
        const extra = DICE[t.face!].extra;
        if (t.pendingEvent) {
          // cfg.resolveEventsImmediately: the drawer names a washer mid-turn.
          const cands = gangTargets(st);
          const choice: { machine?: number; jimothyTo?: number } = {};
          if (st.revealedEvent === 'Gang') {
            choice.machine = policy.chooseGang?.(st, pid, cands) ?? cands[0];
            const elsewhere = cands.filter((c) => c !== choice.machine);
            if (elsewhere.length > 0) {
              choice.jimothyTo = policy.chooseJimothy?.(st, pid, elsewhere) ?? elsewhere[0];
            }
          } else {
            choice.machine = policy.chooseJimothy?.(st, pid, cands) ?? cands[0];
          }
          resolveEventNow(st, choice, rng);
          continue;
        }
        if (extra === 'displace') {
          const mv = policy.chooseDisplace?.(st, pid) ?? null;
          if (mv) displace(st, mv.from, mv.item, mv.to, rng);
          else skipExtra(st, rng);
        } else if (extra === 'special') {
          const pair = t.pendingDraw ?? drawSpecialPair(st);
          if (pair.length === 0) skipExtra(st, rng);
          else keepSpecial(st, policy.chooseKeep?.(st, pid, pair) ?? pair[0], rng);
        } else {
          skipExtra(st, rng);
        }
      }
    }
  }

  // ---- PHASE 2: event -----------------------------------------------------
  if (st.revealedEvent !== null) {
    const drawer = st.eventDrawer ?? 0;
    const ev = st.revealedEvent;
    const choice: { machine?: number; jimothyTo?: number } = {};
    if (eventNeedsChoice(st)) {
      const cands = gangTargets(st);
      if (ev === 'Gang') {
        choice.machine = policy.chooseGang?.(st, drawer, cands) ?? cands[0];
        const elsewhere = cands.filter((c) => c !== choice.machine);
        if (elsewhere.length > 0) {
          choice.jimothyTo = policy.chooseJimothy?.(st, drawer, elsewhere) ?? elsewhere[0];
        }
      } else {
        choice.machine = policy.chooseJimothy?.(st, drawer, cands) ?? cands[0];
      }
    }
    phaseEvent(st, choice, rng);
  }

  /* ---- PHASE 3: key -------------------------------------------------------
   *
   * REVISED v11: the keyholder MUST switch a washer.  A policy that declines used
   * to mean "nothing happens"; now it means the driver has to pick, because a day
   * cannot end with the action unspent.  If everything is already on, the only
   * legal action is to turn one OFF — which is the real bite of making this
   * compulsory, and it is the rule as written.
   */
  const act = policy.chooseKey?.(st, st.key) ?? forcedPowerChange(st);
  if (act) setPower(st, act.machine, act.on);

  // ---- PHASE 4 and 5 ------------------------------------------------------
  phaseReckon(st, rng);
  phaseEndOfDay(st);
  st.turn = null;
  assertInvariants(st);
}

/** The first legal "move instead of loading", or null.  Mirrors anyLegalLoad. */
export function firstBlockedDisplacement(
  st: GameState,
): { from: number; item: ItemId; to: number } | null {
  for (const src of st.machines) {
    for (const item of src.items) {
      for (let to = 0; to < st.machines.length; to++) {
        if (canBlockedDisplace(st, src.id, item, to)) return { from: src.id, item, to };
      }
    }
  }
  return null;
}

export function anyLegalLoad(st: GameState, pid: PlayerId): { item: ItemId; machine: number } | null {
  if (!hasLegalPlacement(st, pid)) return null;
  for (const item of loadableItems(st, pid)) {
    for (let mi = 0; mi < st.machines.length; mi++) {
      if (machineAccepts(st, mi, item)) return { item, machine: mi };
    }
  }
  return null;
}

export function playGame(st: GameState, policy: Policy, rng: Rng): GameState {
  while (!st.over && st.day < st.cfg.dayCap) playDay(st, policy, rng);
  return st;
}

/**
 * The keyholder's compulsory action, when the policy will not choose one.
 *
 * Prefers restoring power, because a washer that is off helps nobody.  Falls back
 * to switching one off — with everything on that is the only legal move, and a
 * player at a table would face the same choice.  Returns null only when the Gang
 * has destroyed every washer, which is the one board where passing stays legal.
 */
function forcedPowerChange(st: GameState): { machine: number; on: boolean } | null {
  const off = st.machines.find((m) => !m.dead && !m.on);
  if (off) return { machine: off.id, on: true };
  const live = st.machines.filter((m) => !m.dead);
  if (live.length === 0) return null;
  return { machine: live[live.length - 1].id, on: false };
}

/** Deliberately simple reference bot: load the first legal thing, always. */
export const GreedyPolicy: Policy = {
  chooseLoad: (st, pid) => anyLegalLoad(st, pid),
  // Restore power if anything is off; otherwise the driver's forced choice
  // applies, because the action is compulsory.
  chooseKey: (st) => {
    const off = st.machines.find((m) => !m.dead && !m.on);
    if (off) return { machine: off.id, on: true };
    return null;
  },
  chooseSpecial: (st, pid) => {
    const ready = st.players[pid].ready.filter((n) => canPlaySpecial(st, pid, n));
    if (ready.length === 0) return null;
    const name = ready[0];
    /*
     * COFFEE FIRST, because it is the one card whose target is not a machine.
     * Every branch below assumes a machine id, so a card with a different
     * target shape reaches applySpecial as `{player: undefined}` and takes the
     * whole game down — which is exactly what adding Coffee did to the
     * integrity suite before this branch existed.
     */
    if (name === 'Coffee') {
      const victim = coffeeTargets(st, pid).find((t) => t.items.length > 0);
      if (!victim) return null;
      return { name, target: { player: victim.player, item: victim.items[0] } };
    }
    const live = st.machines.filter((m) => !m.dead);
    if (live.length === 0) return null;
    if (name === 'Coin') return { name, target: { machine: live[0].id, on: true } };
    if (name === 'Snacc') {
      const dest = live.find((m) => m.id !== st.jimothyAt);
      return dest ? { name, target: dest.id } : null;
    }
    return { name, target: live[0].id };
  },
  chooseKeep: (_st, _pid, pair) => pair[0],
};

/** Suppresses loading entirely; used to hold a rigged board still. */
export const InertPolicy: Policy = {
  chooseLoad: () => null,
};

export { loadsOutstanding };
