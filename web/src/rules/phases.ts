/**
 * Day-level transitions.  Port of rules.py phases 1-5.
 *
 * Every function here mutates the state in place (boardgame.io wraps these in
 * Immer, and the parity tests call them on plain objects).  All randomness flows
 * through the injected Rng.
 *
 * Phase order, brief v8 section 4:
 *   1 roll  ->  2 event resolution  ->  3 key  ->  4 reckoning  ->  5 end of day
 *
 * Within one player's turn, designer-confirmed order [A-W03]:
 *   roll  ->  play at most one ready card  ->  load exactly the number rolled
 *         ->  the face's extra effect
 * cfg.turnOrder === 'extraLoadCard' selects the rules-v0.4 section 3.1 reading
 * instead; that document is stale on this point but the switch is kept.
 */

import { machineAccepts, hasLegalPlacement, loadableItems } from './placement';
import type { CardsKey, ReckoningOpts } from './reckoning';
import { machineVerdicts, tierOf } from './reckoning';
import type { Rng } from './rng';
import type {

  GameState,
  ItemCard,
  ItemId,
  Machine,
  PlayerId,
  SpecialName,
  TurnScratch,
} from './types';
import { ATTACHING } from './types';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function log(st: GameState, text: string): void {
  st.log.push({ day: st.day, text });
  if (st.log.length > 400) st.log.splice(0, st.log.length - 400);
}

export function opts(st: GameState): ReckoningOpts {
  return {
    bleachKillsDark: st.cfg.bleachKillsDark,
    /*
     * Always false, and there is no config field to make it true. Sanitizer is
     * machine-wide (v10). The option survives on ReckoningOpts only because the
     * parity fixtures and the Python oracle both exercise the owner-only
     * reading; see the note on LaundromatConfig in types.ts.
     */
    sanitizerOwnerOnly: false,
    crowdThreshold: st.cfg.crowdThreshold,
    meshBag: st.cfg.meshBagRule,
    ownItemsDontTaint: st.cfg.ownItemsDontTaint,
  };
}

export function cardsKeyOf(m: Machine): CardsKey {
  const key: CardsKey = {
    bleached: false,
    coloringOwners: [],
    catcherOwners: [],
    netKeys: [...m.netProtected],
    sanitizerOwners: [],
  };
  for (const c of m.cards) {
    if (c.name === 'Bleach') key.bleached = true;
    else if (c.name === 'Coloring') key.coloringOwners.push(c.owner);
    else if (c.name === 'Color catcher') key.catcherOwners.push(c.owner);
    else if (c.name === 'Sanitizer') key.sanitizerOwners.push(c.owner);
  }
  return key;
}

export function machineContents(st: GameState, m: Machine): ItemCard[] {
  return m.items.map((id) => st.items[id]);
}

/** Which of this machine's items would wash if it reckoned right now. */
export function whatWouldWash(st: GameState, m: Machine): Record<ItemId, boolean> {
  const contents = machineContents(st, m);
  const verdicts = machineVerdicts(contents, cardsKeyOf(m), opts(st));
  const out: Record<ItemId, boolean> = {};
  contents.forEach((x, i) => (out[x.id] = verdicts[i]));
  return out;
}

export function currentTier(st: GameState, m: Machine) {
  return tierOf(machineContents(st, m), cardsKeyOf(m), opts(st));
}

/**
 * Where a returned item goes: the owner's hand, always.
 *
 * There used to be a second destination, a public damp zone. v10 removed it:
 * damp socks no longer come home at all, they stay in the machine, so the only
 * items that travel are ones the verdict sent back — and those are ordinary.
 */
function returnToOwner(st: GameState, id: ItemId): void {
  const item = st.items[id];
  const p = st.players[item.owner];
  if (!p.hand.includes(id)) p.hand.push(id);
}

function removeFromZones(st: GameState, pid: PlayerId, id: ItemId): void {
  const p = st.players[pid];
  p.hand = p.hand.filter((x) => x !== id);
}

function recycleCards(st: GameState, m: Machine, rng: Rng): void {
  if (m.cards.length === 0) return;
  for (const c of m.cards) st.specialDeck.push(c.name);
  m.cards = [];
  st.specialDeck = rng.shuffle(st.specialDeck);
}

function recycleSpecial(st: GameState, name: SpecialName, rng: Rng): void {
  st.specialDeck.push(name);
  st.specialDeck = rng.shuffle(st.specialDeck);
}

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

export type Extra = 'displace' | 'special' | 'event' | null;

export const DICE: Readonly<Record<number, { load: number; extra: Extra }>> = {
  1: { load: 1, extra: null },
  2: { load: 2, extra: null },
  3: { load: 3, extra: null },
  4: { load: 1, extra: 'displace' },
  5: { load: 1, extra: 'special' },
  6: { load: 1, extra: 'event' },
};

export const DICE_TEXT: Readonly<Record<number, string>> = {
  1: 'Load 1 item.',
  2: 'Load 2 items.',
  3: 'Load 3 items.',
  4: 'Load 1 item, and move any one item between machines - including your own.',
  5: 'Load 1 item, and draw a special item: two cards, keep one.',
  6: 'Load 1 item, and draw an event card. It is revealed at once.',
};

// ---------------------------------------------------------------------------
// PHASE 1 -- the turn
// ---------------------------------------------------------------------------

export function beginTurn(st: GameState, pid: PlayerId): void {
  st.turn = {
    player: pid,
    face: null,
    stage: 'roll',
    loadsRequired: 0,
    loadsDone: 0,
    cardPlayed: false,
    extraResolved: false,
    netTurn: null,
    pendingDraw: null,
    pendingEvent: false,
  };
}

function firstStage(st: GameState): TurnScratch['stage'] {
  return st.cfg.turnOrder === 'cardLoadExtra' ? 'card' : 'extra';
}

export function rollDie(st: GameState, rng: Rng): number {
  const t = st.turn!;
  const face = rng.die(6);
  t.face = face;
  t.loadsRequired = DICE[face].load;
  t.loadsDone = 0;
  t.stage = firstStage(st);
  log(st, `Player ${t.player + 1} rolled ${face}. ${DICE_TEXT[face]}`);
  advanceIfDone(st, rng);
  return face;
}

/** Loading is MANDATORY: exactly the number rolled, fewer only if you cannot. */
export function loadsOutstanding(st: GameState): number {
  const t = st.turn;
  if (!t) return 0;
  return Math.max(0, t.loadsRequired - t.loadsDone);
}

/** [A-05] a player loads min(rolled, handSize, legalPlacements).  Zero is allowed. */
export function mustStillLoad(st: GameState): boolean {
  const t = st.turn;
  if (!t || t.stage !== 'load') return false;
  if (loadsOutstanding(st) === 0) return false;
  return hasLegalPlacement(st, t.player);
}

/**
 * The player still owes loads, but no washer will accept anything they hold.
 * [A-05]: they load min(rolled, hand, legal placements), and zero is allowed —
 * but they should SEE that, not have the game quietly move on.
 */
export function loadBlocked(st: GameState): boolean {
  const t = st.turn;
  if (!t || t.stage !== 'load') return false;
  return loadsOutstanding(st) > 0 && !hasLegalPlacement(st, t.player);
}

/**
 * A player who cannot load moves one of their OWN items between washers instead
 * [NEW v11].
 *
 * The manual is plain about it: "if you have no items in your hands to load, move
 * 1 of your item from washer to washer".  It is a substitute for the load, not a
 * bonus — so it is available only while blocked, it costs the whole remaining
 * load, and it is MANDATORY when it is available, in the same way loading is.
 * Being stuck should give you something to do, not nothing.
 *
 * Note it is restricted to your own items, unlike the roll-4 move which may take
 * anybody's.  That is the manual's wording and it matters: a blocked player would
 * otherwise get a free shove at an opponent every time their hand jammed.
 */
export function canBlockedDisplace(st: GameState, from: number, id: ItemId, to: number): boolean {
  const t = st.turn;
  if (!t || !loadBlocked(st)) return false;
  if (st.items[id]?.owner !== t.player) return false;
  return canDisplace(st, from, id, to);
}

/** Is any such move on the board?  Decides whether skipping is still legal. */
export function anyBlockedDisplacement(st: GameState): boolean {
  const t = st.turn;
  if (!t || !loadBlocked(st)) return false;
  for (const src of st.machines) {
    for (const id of src.items) {
      if (st.items[id].owner !== t.player) continue;
      for (let to = 0; to < st.machines.length; to++) {
        if (canDisplace(st, src.id, id, to)) return true;
      }
    }
  }
  return false;
}

export function blockedDisplace(
  st: GameState,
  from: number,
  id: ItemId,
  to: number,
  rng: Rng,
): boolean {
  const t = st.turn;
  if (!t || !canBlockedDisplace(st, from, id, to)) return false;
  const src = st.machines[from];
  src.items = src.items.filter((x) => x !== id);
  src.netProtected = src.netProtected.filter((x) => x !== id); // I-11
  st.machines[to].items.push(id);
  t.loadsRequired = t.loadsDone; // the move is instead of the load, not as well
  log(
    st,
    `Player ${t.player + 1} could not load, so they moved ${describe(st.items[id])} ` +
      `from Washer ${from + 1} to Washer ${to + 1}.`,
  );
  advanceIfDone(st, rng);
  return true;
}

/**
 * Explicitly give up the remaining loads.  Legal only when truly blocked AND
 * there is no substitute move either — since v11 the move takes precedence, so
 * this is the genuinely-nothing-to-do case.
 */
export function skipBlockedLoad(st: GameState, rng: Rng): boolean {
  const t = st.turn;
  if (!t || !loadBlocked(st)) return false;
  if (anyBlockedDisplacement(st)) return false;
  const missed = loadsOutstanding(st);
  t.loadsRequired = t.loadsDone;
  log(
    st,
    `Player ${t.player + 1} could not load ${missed} item(s): no washer would take anything they hold.`,
  );
  advanceIfDone(st, rng);
  return true;
}

export function canPlaySpecial(st: GameState, pid: PlayerId, name: SpecialName): boolean {
  const t = st.turn;
  if (!t || t.player !== pid) return false;
  if (t.stage !== 'card') return false;
  if (t.cardPlayed) return false;
  if (!st.players[pid].ready.includes(name)) return false;
  if (name === 'Snacc' && st.jimothyAt === null) return false;
  // Coffee needs somebody ELSE to have washed something. Offering it with no
  // legal target is a card that cannot be put down and cannot be discarded.
  if (name === 'Coffee' && !coffeeTargets(st, pid).some((t) => t.items.length > 0)) return false;
  return true;
}

/**
 * Every washed item Coffee could be spilled on: other players only, and only
 * things already in a clean pile. Your own laundry is safe from your own
 * coffee, which is both funnier and the only reading that makes it an attack.
 */
export function coffeeTargets(
  st: GameState,
  pid: PlayerId,
): { player: PlayerId; items: ItemId[] }[] {
  return st.players
    .map((p, i) => ({ player: i as PlayerId, items: i === pid ? [] : [...p.clean] }))
    .filter((t) => t.player !== pid);
}

export type SpecialTarget =
  | number
  | { machine: number; on: boolean }
  /** Coffee: whose clean pile, and which item out of it. */
  | { player: PlayerId; item: ItemId };

export function playSpecial(
  st: GameState,
  pid: PlayerId,
  name: SpecialName,
  target: SpecialTarget,
  rng: Rng,
): void {
  const t = st.turn!;
  const p = st.players[pid];
  const idx = p.ready.indexOf(name);
  if (idx === -1) throw new Error(`Player ${pid} has no ready ${name}`);
  p.ready.splice(idx, 1);
  t.cardPlayed = true;
  applySpecial(st, pid, name, target, rng);
}

export function applySpecial(
  st: GameState,
  pid: PlayerId,
  name: SpecialName,
  target: SpecialTarget,
  rng: Rng,
): void {
  if (ATTACHING.has(name)) {
    const mi = target as number;
    st.machines[mi].cards.push({ name, owner: pid });
    if (name === 'Wash net' && st.turn) {
      // [A-W04] the net protects only underwear this player loads into this
      // machine on this turn.
      st.turn.netTurn = { player: pid, machine: mi };
    }
    log(st, `Player ${pid + 1} played ${name} on Washer ${mi + 1}.`);
    return;
  }
  if (name === 'Snacc') {
    const mi = target as number;
    moveJimothy(st, mi, rng);
    recycleSpecial(st, name, rng);
    log(st, `Player ${pid + 1} played Snacc: Jimothy is lured to Washer ${mi + 1}.`);
    return;
  }
  if (name === 'Coffee') {
    const { player, item } = target as { player: PlayerId; item: ItemId };
    const victim = st.players[player];
    const at = victim.clean.indexOf(item);
    if (at === -1) throw new Error(`${item} is not in player ${player}'s clean pile`);
    /*
     * OUT OF THE CLEAN PILE AND BACK INTO THE HAND. This is the only place in
     * the game where `clean` shrinks, so it is also the only way a player's
     * progress can go backwards — worth knowing when reading a rail that has
     * gone down rather than up.
     *
     * It returns to the HAND, not to a machine: the card says "one more wash",
     * which means they have to load it again themselves.
     */
    victim.clean.splice(at, 1);
    victim.hand.push(item);
    recycleSpecial(st, name, rng);
    log(
      st,
      `Player ${pid + 1} spilled Coffee on Player ${player + 1}'s ${describe(st.items[item])}. It needs washing again.`,
    );
    return;
  }
  if (name === 'Coin') {
    const { machine, on } = target as { machine: number; on: boolean };
    const m = st.machines[machine];
    if (!m.dead && m.on !== on) {
      m.on = on;
      log(st, `Player ${pid + 1} played the Coin: Washer ${machine + 1} switched ${on ? 'ON' : 'OFF'}.`);
    } else {
      log(st, `Player ${pid + 1} played the Coin with no effect.`);
    }
    recycleSpecial(st, name, rng);
  }
}

export function loadItem(st: GameState, pid: PlayerId, id: ItemId, mi: number, rng: Rng): void {
  const t = st.turn!;
  if (!machineAccepts(st, mi, id)) throw new Error(`Washer ${mi} will not accept ${id}`);
  if (!loadableItems(st, pid).includes(id)) throw new Error(`${id} is not loadable by ${pid}`);
  removeFromZones(st, pid, id);
  const m = st.machines[mi];
  m.items.push(id);
  const item = st.items[id];
  // Bag membership.  Under the Mesh bag rule ANY item loaded into that machine
  // on the turn the bag was played goes in; brief v8's Wash net took underwear
  // only.  Either way items already sitting in the machine are never covered --
  // that is the v8 narrowing and it survives (worked example 22).
  const bagOpen = !!t.netTurn && t.netTurn.player === pid && t.netTurn.machine === mi;
  if (bagOpen && (st.cfg.meshBagRule === 'guaranteed' || item.type === 'underwear')) {
    m.netProtected.push(id);
  }
  t.loadsDone += 1;
  log(st, `Player ${pid + 1} loaded ${describe(item)} into Washer ${mi + 1}.`);
  advanceIfDone(st, rng);
}

/*
 * No "(damp)" suffix any more.  Damp is a fact about a machine that contains a
 * blanket, not about the sock, so it cannot be read off an item in isolation —
 * `selectors.willBeDamp()` needs the machine.  The UI labels the sock where it
 * sits instead.
 */
export function describe(item: ItemCard): string {
  const shade = item.shade === 'D' ? 'dark' : 'light';
  return `${shade} ${item.type}`;
}

/** Face 4.  The move is optional; hostages are frozen; dead machines are out. */
export function canDisplace(st: GameState, from: number, id: ItemId, to: number): boolean {
  if (from === to) return false;
  const src = st.machines[from];
  if (!src || src.dead || src.jimothy) return false; // [A-18] hostages cannot move
  if (!src.items.includes(id)) return false;
  return machineAccepts(st, to, id);
}

export function displace(st: GameState, from: number, id: ItemId, to: number, rng: Rng): void {
  if (!canDisplace(st, from, id, to)) throw new Error('illegal move');
  const src = st.machines[from];
  src.items = src.items.filter((x) => x !== id);
  src.netProtected = src.netProtected.filter((x) => x !== id); // I-11
  st.machines[to].items.push(id);
  log(st, `${describe(st.items[id])} moved from Washer ${from + 1} to Washer ${to + 1}.`);
  finishExtra(st, rng);
}

/** Face 5 first half: [A-W13] draw two, keep one, the other to the BOTTOM. */
export function drawSpecialPair(st: GameState): SpecialName[] {
  const t = st.turn!;
  const deck = st.specialDeck;
  if (deck.length === 0) {
    t.pendingDraw = [];
    return [];
  }
  const pair: SpecialName[] = deck.length === 1 ? [deck.pop()!] : [deck.pop()!, deck.pop()!];
  t.pendingDraw = pair;
  return pair;
}

export function keepSpecial(st: GameState, keep: SpecialName, rng: Rng): void {
  const t = st.turn!;
  const pair = t.pendingDraw ?? [];
  st.players[t.player].fresh.push(keep);
  let returned = false;
  for (const name of pair) {
    if (name !== keep && !returned) {
      st.specialDeck.unshift(name); // to the bottom
      returned = true;
    }
  }
  t.pendingDraw = null;
  log(st, `Player ${t.player + 1} kept ${keep}. It is fresh and cannot be played today.`);
  finishExtra(st, rng);
}

/**
 * Face 6: only the FIRST 6 of the day draws.
 *
 * RESOLVED v10: every event resolves the moment its card is drawn, mid-turn.
 * There is no deferred path any more — the arms that waited until everyone had
 * loaded are gone.  What this buys is that a counter-card played later the same
 * day can still answer the event, which is the whole reason the arm was chosen.
 *
 * Gang and Jimothy need a washer chosen, and the DRAWER chooses it.  The turn
 * parks (`pendingEvent`) until they do; `resolveEventNow` below is their answer.
 * Everything else fires on the spot and the turn carries on.
 */
export function drawEvent(st: GameState, rng: Rng): void {
  const t = st.turn!;
  if (st.revealedEvent === null && st.eventDeck.length > 0) {
    const idx = rng.int(st.eventDeck.length);
    st.revealedEvent = st.eventDeck.splice(idx, 1)[0];
    st.eventDrawer = t.player;
    log(st, `Player ${t.player + 1} drew an event: ${st.revealedEvent}.`);

    if (eventNeedsChoice(st)) {
      t.pendingEvent = true; // wait for the drawer's choice
      return;
    }
    phaseEvent(st, {}, rng);
  } else {
    log(st, `Player ${t.player + 1} rolled a 6, but an event has already happened today.`);
  }
  finishExtra(st, rng);
}

/** The drawer's answer to an event that fired on draw and needed a choice. */
export function resolveEventNow(st: GameState, choice: EventChoice, rng: Rng): void {
  const t = st.turn!;
  if (!t.pendingEvent || st.revealedEvent === null) return;
  phaseEvent(st, choice, rng);
  t.pendingEvent = false;
  finishExtra(st, rng);
}

export function skipCard(st: GameState, rng: Rng): void {
  const t = st.turn!;
  t.cardPlayed = true;
  advanceStage(st, rng);
}

export function skipExtra(st: GameState, rng: Rng): void {
  finishExtra(st, rng);
}

function finishExtra(st: GameState, rng: Rng): void {
  const t = st.turn!;
  t.extraResolved = true;
  advanceStage(st, rng);
}

/** Auto-advance whenever the current stage has nothing left to decide. */
export function advanceIfDone(st: GameState, rng: Rng): void {
  const t = st.turn;
  if (!t) return;
  if (t.stage === 'card') {
    const p = st.players[t.player];
    const playable = p.ready.filter((n) => canPlaySpecial(st, t.player, n));
    if (t.cardPlayed || playable.length === 0) advanceStage(st, rng);
    return;
  }
  if (t.stage === 'load') {
    // Advance only when the quota is met.  If the quota is unmet but the board
    // refuses everything, STAY here: the player is shown that no washer will
    // take anything and skips explicitly (skipBlockedLoad).  Silently skipping
    // hid a real and confusing situation.
    if (loadsOutstanding(st) === 0) advanceStage(st, rng);
    return;
  }
  if (t.stage === 'extra') {
    const extra = DICE[t.face!].extra;
    if (t.pendingEvent) return; // waiting on the drawer to choose a washer
    if (t.extraResolved || extra === null) advanceStage(st, rng);
    else if (extra === 'displace' && !anyLegalDisplacement(st)) finishExtra(st, rng);
    else if (extra === 'special') {
      if (st.specialDeck.length === 0) finishExtra(st, rng);
      else if (t.pendingDraw === null) drawSpecialPair(st);
    } else if (extra === 'event') drawEvent(st, rng);
  }
}

function advanceStage(st: GameState, rng: Rng): void {
  const t = st.turn!;
  const order: TurnScratch['stage'][] =
    st.cfg.turnOrder === 'cardLoadExtra'
      ? ['roll', 'card', 'load', 'extra', 'done']
      : ['roll', 'extra', 'load', 'card', 'done'];
  const i = order.indexOf(t.stage);
  t.stage = order[Math.min(i + 1, order.length - 1)];
  if (t.stage !== 'done') advanceIfDone(st, rng);
}

export function anyLegalDisplacement(st: GameState): boolean {
  for (const src of st.machines) {
    if (src.dead || src.jimothy) continue;
    for (const id of src.items) {
      for (const dst of st.machines) {
        if (dst.id === src.id) continue;
        if (machineAccepts(st, dst.id, id)) return true;
      }
    }
  }
  return false;
}

export function turnComplete(st: GameState): boolean {
  return st.turn?.stage === 'done';
}

// ---------------------------------------------------------------------------
// Jimothy
// ---------------------------------------------------------------------------

export function moveJimothy(st: GameState, mi: number, rng: Rng): void {
  const old = st.jimothyAt;
  if (old !== null) {
    st.machines[old].jimothy = false;
    releaseHostages(st, old, rng);
  } else {
    st.jimothyArrived = st.day;
  }
  st.machines[mi].jimothy = true;
  st.jimothyAt = mi;
  st.jimothySince = st.day;
}

export function removeJimothy(st: GameState, reason: 'Animal control', rng: Rng): void {
  const mi = st.jimothyAt;
  if (mi === null) return;
  st.machines[mi].jimothy = false;
  releaseHostages(st, mi, rng);
  st.jimothyAt = null;
  st.jimothySince = null;
  st.jimothyArrived = null;
  if (reason === 'Animal control') {
    st.eventDeck.push('Jimothy');
    st.eventDeck = rng.shuffle(st.eventDeck);
  }
}

/** Release never washes anything: hostages go back to their owners, unwashed. */
export function releaseHostages(st: GameState, mi: number, rng: Rng): void {
  const m = st.machines[mi];
  if (m.items.length > 0) {
    log(st, `Washer ${mi + 1} releases ${m.items.length} item(s) to their owners, unwashed.`);
  }
  for (const id of m.items) returnToOwner(st, id);
  m.items = [];
  m.netProtected = [];
  recycleCards(st, m, rng);
}

// ---------------------------------------------------------------------------
// PHASE 2 -- event resolution
// ---------------------------------------------------------------------------

export interface EventChoice {
  /** Gang: the machine to destroy.  Jimothy: where he settles. */
  machine?: number;
  /** Gang shooting Jimothy's machine: where he relocates to [A-W07]. */
  jimothyTo?: number;
}

/** Does this event need a decision from the drawer before it can resolve? */
export function eventNeedsChoice(st: GameState): boolean {
  const ev = st.revealedEvent;
  if (ev === 'Gang') return true;
  if (ev === 'Jimothy') return st.machines.some((m) => !m.dead);
  return false;
}

export function gangTargets(st: GameState): number[] {
  return st.machines.filter((m) => !m.dead).map((m) => m.id);
}

export function phaseEvent(st: GameState, choice: EventChoice, rng: Rng): void {
  const ev = st.revealedEvent;
  if (ev === null) return;
  st.lastEvent = { name: ev, day: st.day, auto: !eventNeedsChoice(st) };
  st.revealedEvent = null;
  st.eventDrawer = null;

  if (ev === 'Gang') resolveGang(st, choice, rng);
  else if (ev === 'Circuit break') resolveCircuitBreak(st, rng);
  else if (ev === 'Jimothy') resolveJimothyEvent(st, choice, rng);
  else resolveAnimalControl(st, rng);
}

function resolveGang(st: GameState, choice: EventChoice, rng: Rng): void {
  const cands = gangTargets(st);
  if (cands.length > 0) {
    const mi = choice.machine !== undefined && cands.includes(choice.machine) ? choice.machine : cands[0];
    const m = st.machines[mi];
    for (const id of m.items) returnToOwner(st, id);
    m.items = [];
    m.netProtected = [];
    recycleCards(st, m, rng);
    if (m.jimothy) {
      // [A-W07] the washer dies, hostages are released, and the raccoon RELOCATES.
      m.jimothy = false;
      st.jimothyAt = null;
      const elsewhere = st.machines.filter((x) => !x.dead && x.id !== mi).map((x) => x.id);
      if (elsewhere.length > 0) {
        const dest =
          choice.jimothyTo !== undefined && elsewhere.includes(choice.jimothyTo)
            ? choice.jimothyTo
            : elsewhere[0];
        st.machines[dest].jimothy = true;
        st.jimothyAt = dest;
        st.jimothySince = st.day;
        log(st, `Jimothy relocates to Washer ${dest + 1}.`);
      } else {
        st.jimothySince = null;
        st.jimothyArrived = null;
      }
    }
    m.dead = true;
    m.on = false;
    log(st, `GANG: Washer ${mi + 1} is shot and out of the game permanently.`);
  }
  st.gangUsed = true;
  // never returns to the deck
}

/*
 * RESOLVED v10.  The night is cancelled and nothing else happens.
 *
 * Note what is deliberately absent: no machine's power is touched.  Two of the
 * three arms this replaces switched every washer OFF and then argued about how
 * they came back on; this one leaves the board exactly as it found it, so the
 * cost of a Circuit break is precisely one night's washing and tomorrow needs
 * no recovery at all.  Contents stay in their machines, as they always did.
 */
function resolveCircuitBreak(st: GameState, rng: Rng): void {
  st.cbBlackout = true;
  log(st, 'CIRCUIT BREAK: tonight nothing reckons. The power itself is untouched.');
  st.eventDeck.push('Circuit break');
  st.eventDeck = rng.shuffle(st.eventDeck);
}

function resolveJimothyEvent(st: GameState, choice: EventChoice, rng: Rng): void {
  const cands = st.machines.filter((m) => !m.dead).map((m) => m.id);
  if (cands.length === 0) return;
  const mi = choice.machine !== undefined && cands.includes(choice.machine) ? choice.machine : cands[0];
  moveJimothy(st, mi, rng);
  log(st, `JIMOTHY settles into Washer ${mi + 1}. It cannot run and cannot be loaded.`);
  // His card stays on the board; it does NOT return to the deck.
}

function resolveAnimalControl(st: GameState, rng: Rng): void {
  if (st.jimothyAt === null) {
    log(st, 'ANIMAL CONTROL: no raccoon in play. Nothing happens.'); // [A-W10] blank
  } else {
    log(st, `ANIMAL CONTROL: Jimothy is taken away from Washer ${st.jimothyAt + 1}.`);
    removeJimothy(st, 'Animal control', rng);
  }
  st.eventDeck.push('Animal control');
  st.eventDeck = rng.shuffle(st.eventDeck);
}

// ---------------------------------------------------------------------------
// PHASE 3 -- key
// ---------------------------------------------------------------------------

export function canSetPower(st: GameState, mi: number, on: boolean): boolean {
  const m = st.machines[mi];
  return !!m && !m.dead && m.on !== on;
}

/**
 * Is there any washer the keyholder could switch?
 *
 * The keyholder's action is compulsory (v11), so this is what decides whether
 * passing is legal: only when every washer is destroyed and there is nothing left
 * to switch.  A live washer can always be toggled — if it is on, it can go off —
 * so in practice this is false only on a board the Gang has emptied.
 */
export function anyPowerChangePossible(st: GameState): boolean {
  return st.machines.some((m) => !m.dead);
}

export function setPower(st: GameState, mi: number, on: boolean): void {
  if (!canSetPower(st, mi, on)) return;
  st.machines[mi].on = on;
  log(st, `The keyholder switches Washer ${mi + 1} ${on ? 'ON' : 'OFF'}.`);
}

// ---------------------------------------------------------------------------
// PHASE 4 -- reckoning
// ---------------------------------------------------------------------------

/**
 * `tangled` was called `damp` until v11, when a blanket started sharing with any
 * item rather than only socks.  A tangled shirt is not damp — the old word only
 * described what happened to the one item type that could ever be in there.
 */
export type Outcome = 'washed' | 'tangled' | 'sentBack';

export interface MachineResult {
  machine: number;
  skipped: null | 'dead' | 'off' | 'raccoon' | 'blackout' | 'empty';
  tier: number | null;
  outcomes: { item: ItemId; outcome: Outcome }[];
}

export function phaseReckon(st: GameState, rng: Rng): MachineResult[] {
  const results: MachineResult[] = [];
  const blackout = st.cbBlackout;
  st.cbBlackout = false;

  for (const m of st.machines) {
    if (m.dead) {
      results.push({ machine: m.id, skipped: 'dead', tier: null, outcomes: [] });
      continue;
    }
    if (blackout) {
      results.push({ machine: m.id, skipped: 'blackout', tier: null, outcomes: [] });
      continue;
    }
    if (m.jimothy) {
      results.push({ machine: m.id, skipped: 'raccoon', tier: null, outcomes: [] });
      continue;
    }
    if (!m.on) {
      results.push({ machine: m.id, skipped: 'off', tier: null, outcomes: [] });
      continue;
    }
    if (m.items.length === 0) {
      recycleCards(st, m, rng);
      results.push({ machine: m.id, skipped: 'empty', tier: null, outcomes: [] });
      continue;
    }

    const contents = machineContents(st, m);
    const ck = cardsKeyOf(m);
    const verdicts = machineVerdicts(contents, ck, opts(st));
    const tier = tierOf(contents, ck, opts(st));

    // S8 [A-24]: keyed on the machine CONTAINING a blanket, not on the blanket
    // washing.  Keying on another item's verdict would break commutativity.
    const machineHadBlanket = contents.some((x) => x.type === 'blanket');

    /*
     * REVISED v11.  A blanket is big, and whatever shares the washer with it gets
     * TANGLED: it does not wash, and it does not leave.  It stays in the drum as an
     * ordinary dirty item until a night that washer runs without a blanket in it —
     * which, since the blanket itself washes and leaves, is normally the very next
     * one.  Load another blanket in first and it is tangled again.
     *
     * Until v11 only socks could be in here at all, and the word was "damp".
     *
     * Note the interaction with the verdict, which is the part that is easy to get
     * wrong.  An item the verdict SENT BACK is not tangled — it goes home like any
     * other rejected item.  Only an item that earned its wash and was denied it by
     * the blanket stays behind.  So "sent back" keeps meaning exactly one thing.
     */
    const stuck: ItemId[] = [];

    const outcomes: MachineResult['outcomes'] = [];
    contents.forEach((item, i) => {
      const p = st.players[item.owner];
      if (!verdicts[i]) {
        returnToOwner(st, item.id);
        outcomes.push({ item: item.id, outcome: 'sentBack' });
        return;
      }
      if (st.cfg.socksBlanketExtraWash && machineHadBlanket && item.type !== 'blanket') {
        stuck.push(item.id);
        outcomes.push({ item: item.id, outcome: 'tangled' });
        return;
      }
      if (!p.clean.includes(item.id)) p.clean.push(item.id);
      outcomes.push({ item: item.id, outcome: 'washed' });
    });

    /*
     * Post-condition of the rule above.  A blanket shares with one item, so at most
     * one item can be tangled — and never the blanket itself, which washes or is
     * sent back like anything else.
     */
    if (stuck.length > 1) throw new Error('I-5: more than one item tangled in a machine');
    for (const id of stuck) {
      if (st.items[id].type === 'blanket') throw new Error('I-5: a blanket cannot tangle itself');
    }
    m.items = stuck;
    /*
     * Filtered, not cleared.  A bag protects what its owner loaded on the turn
     * it was played; the card itself is recycled below, so an id left in here
     * would silently guarantee a wash on some future night when no bag is in
     * play.  In practice `stuck` holds socks and bagged socks are rare, but the
     * cheap filter is worth more than the reasoning about when it cannot happen.
     */
    m.netProtected = m.netProtected.filter((id) => stuck.includes(id));
    recycleCards(st, m, rng);
    results.push({ machine: m.id, skipped: null, tier, outcomes });
  }

  const washed = results.reduce(
    (n, r) => n + r.outcomes.filter((o) => o.outcome === 'washed').length,
    0,
  );
  log(st, `Reckoning: ${washed} item(s) came out clean.`);
  return results;
}

// ---------------------------------------------------------------------------
// PHASE 5 -- end of day
// ---------------------------------------------------------------------------

export function phaseEndOfDay(st: GameState): void {
  // Nothing to restore: a Circuit break never switched anything off (v10).

  // 1. Victory check, AFTER the full reckoning [A-W14], section 8.6.
  for (const p of st.players) {
    if (p.finishedDay === null && isFinished(p.clean, p.mustWash)) p.finishedDay = st.day;
  }

  // 2. Fresh -> ready.
  for (const p of st.players) {
    if (p.fresh.length > 0) {
      p.ready.push(...p.fresh);
      p.fresh = [];
    }
  }

  // 3. The key passes.
  st.players[st.key].keyHolds += 1;
  st.key = (st.key + 1) % st.cfg.players;

  /*
   * REVISED v11: a tie is not a shared win, it is NO win.
   *
   * Two players finishing on the same night used to be recorded as co-winners.
   * The designer's ruling — "no one wins if there's a tie (muah ha ha ha)" — makes
   * the game end with nobody having won, which is a state the board has never had
   * to show before: `st.over` is true and `st.winners` is empty, and everything
   * downstream (the game-level endIf, the win screen) has to read that as an
   * ending rather than as "still playing".
   */
  const finished = st.players.filter((p) => p.finishedDay !== null).map((p) => p.id);
  if (finished.length > 0) {
    st.over = true;
    st.winners = finished.length === 1 ? finished : [];
    log(
      st,
      finished.length === 1
        ? `Player ${finished[0] + 1} has washed everything and wins.`
        : `Players ${finished.map((w) => w + 1).join(' and ')} finished together, ` +
            `so nobody wins. The laundromat keeps them all.`,
    );
  }
}

export function isFinished(clean: ItemId[], mustWash: ItemId[]): boolean {
  if (clean.length < mustWash.length) return false;
  const set = new Set(clean);
  return mustWash.every((id) => set.has(id));
}

// ---------------------------------------------------------------------------
// Invariants (rules-v0.4 section 6.12).  Asserted in tests and in dev builds.
// ---------------------------------------------------------------------------

export function assertInvariants(st: GameState): void {
  for (const m of st.machines) {
    const contents = machineContents(st, m);
    const blankets = contents.filter((x) => x.type === 'blanket');
    /*
     * I-2, REVISED v11.  A blanket is big: it shares with at most ONE other item, of
     * any type.  This used to read "with socks and nothing else", which is the rule
     * the blanket had before it started tangling whatever it was loaded beside.
     */
    if (blankets.length > 1) throw new Error('I-2: two blankets in one machine');
    if (blankets.length === 1 && contents.length > 2) {
      throw new Error('I-2: a blanket shares with at most one other item');
    }
    if (contents.length > st.cfg.capacity) throw new Error('I-3: over capacity');
    if (m.dead && m.items.length > 0) throw new Error('dead machines hold nothing');
  }
  /*
   * I-5 is gone with the field it guarded ("only socks are ever damp").  Damp is
   * no longer stored on an item, so there is nothing here to check: a machine
   * legitimately holds any mix of items all day long, and the fact that only
   * socks SURVIVE a reckoning is a post-condition of phaseReckon, asserted there
   * rather than at arbitrary moments by this function.
   */
  for (const p of st.players) {
    const loaded = st.machines.flatMap((m) => m.items).filter((id) => st.items[id].owner === p.id);
    const seen = new Set([...p.hand, ...loaded, ...p.clean]);
    if (seen.size !== p.mustWash.length || !p.mustWash.every((id) => seen.has(id))) {
      throw new Error(`I-1/I-9 conservation broken for player ${p.id}`);
    }
    const cleanSet = new Set(p.clean);
    if (p.hand.some((id) => cleanSet.has(id))) {
      throw new Error('I-1: an item is both clean and in hand');
    }
  }
  const jim = st.machines.filter((m) => m.jimothy);
  if (jim.length > 1) throw new Error('I-9: more than one Jimothy');
}
