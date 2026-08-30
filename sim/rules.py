"""
Laundromat -- reference rules engine.  BRIEF v8.

Authoritative source: design/game-brief.md (v8), with the formal apparatus of
design/rules-v0.2.md / rules-v0.3.md (reckoning algorithm, commutativity result,
worked-example tables) retained where v8 did not invalidate it.

DESIGN CONTRACT
---------------
  * `machine_verdicts()` -- the heart of the reckoning -- is a pure, memoised function
    of a canonical key.
  * All randomness flows through a single `random.Random` stored in the state.
    Identical (config, seed, policy) triples reproduce identical games.
  * Day-level transitions mutate state in place, but only through the named phase
    functions, each a total function of prior state + rng.

WHAT CHANGED v5 -> v8 (the engine was three revisions stale)
------------------------------------------------------------
  * FIVE phases: roll (load AND at most one card play, on your own turn) -> event
    resolution -> key -> reckoning -> end of day.  The separate special-item phase is
    gone; events moved from after the key phase to before it.
  * Events are revealed the instant they are drawn.  No face-down pending event.
  * LOADING IS MANDATORY.  Exactly the number rolled, fewer only if the hand is short.
  * Handwash basket DELETED.
  * Bedding DELETED.  7 types x 2 shades = 14 cards; opening draw 10 of 14.
  * Socks may share a machine with a blanket; such socks need ONE ADDITIONAL WASH.
  * Gang permanently destroys one washer chosen by the drawer; once per game; never
    returns to the deck.
  * Electricity -> CIRCUIT BREAK: every washer OFF, contents retained.
  * Jimothy: fright deleted.  Gang and Circuit break do not affect him.  Snacc
    relocates him; only Animal control removes him.  Animal control is an EVENT.
  * Event deck fixed at exactly four cards, one each.
  * New specials: Sanitizer, Coin.  Wash net narrowed to same-turn underwear.
  * Special item acquisition: draw two, keep one, other to the bottom of the deck.
  * Victory: first to wash all 10, game ends immediately; simultaneous victory allowed.
  * Machine count = P+1; capacity flat 4.

ASSUMPTION LOG  (every place brief v8 is ambiguous; repeated in the balance report)
----------------------------------------------------------------------------------
  [A-W01] Turn order is fixed seat order, not keyholder-first.  Brief v8 §4.1 says
          "each player, in turn order"; the key rotates independently.  Sensitivity
          switch: cfg['keyholder_first'].
  [A-W02] Faces 4/5/6 each load 1 item IN ADDITION to their effect, so expected
          mandatory loading is (1+2+3+1+1+1)/6 = 1.5 items/player/day exactly.
  [A-W03] Within a turn the order is: play at most one ready special card, THEN load,
          THEN the face-4/5/6 extra.  This is the only order under which Wash net's
          narrowed text ("underwear you load this turn") can ever be used.
  [A-W04] Wash net protects the specific underwear cards its owner loads into that
          machine after the net is played, on that turn.  Protection is per-card and
          dies when the machine empties.
  [A-W05] Sanitizer suppresses tiers 1-2 machine-wide; resolution proceeds at tier 3.
          Alternative (owner-only, Color-catcher-shaped) is cfg['sanitizer_owner_only'].
  [A-W06] RESOLVED by the designer: Coin is a ONE-SHOT.  Played on the owner's turn as
          they load, resolved immediately, returned to the special item deck.  It is not
          held and not reusable.  The persistent reading is closed and untested.
  [A-W07] RESOLVED by the designer: Gang MAY shoot Jimothy's machine.  The washer is
          destroyed, the hostages are released to their owners, and Jimothy RELOCATES to
          another washer.  The drawer chooses both the washer destroyed and the washer he
          moves to.  A dead machine is out of play permanently: no loading, no reckoning,
          no occupancy.  Gang may not target an already dead machine.
  [A-W08] Circuit break is under A/B test, cfg['circuit_break']:
            V1 "blackout"      -- only tonight's reckoning is cancelled; power untouched.
            V2 "all off"       -- every live washer OFF; the keyholder restores one a day.
            V3 "auto-restore"  -- every live washer OFF, all back ON at the end of the
                                  FOLLOWING day's reckoning.
          Contents are retained in every arm.
  [A-W09] Snacc RELOCATES Jimothy to a machine of the player's choice; his card stays
          on the board.  Only Animal control returns his card to the event deck.
          Relocation releases hostages to hands, unwashed (rules-v0.3 B10).
  [A-W10] Animal control, drawn as an event with Jimothy not in play, is a blank; the
          card shuffles back.  Measured as `ac_blanks`.
  [A-W11] Blanket exclusivity, REVISED v11: a machine may hold one blanket plus at
          most ONE other item, of any type.  Two blankets may not share.  Binds loads
          and face-4 moves.  (Until v11 this read "plus any number of socks".)
  [A-W12] Socks that wash in a machine that contained a blanket bank ONE wash event and
          return to hand; a second wash event (anywhere) finishes them.  Socks that wash
          in a blanket-free machine are clean outright regardless of banked count.
  [A-W13] Draw-two-keep-one: two cards off the top, the rejected one to the BOTTOM.
          With one card left, draw one.  Empty deck is a strict no-op.
  [A-W14] Victory is evaluated at end of day after reckoning.  Every player at 10 that
          day wins.  The game then ends immediately.
  [A-W15] A player with an empty hand and a full board simply loads nothing; mandatory
          loading is "as many as you can".
"""

import random

# --------------------------------------------------------------------------------------
# Component vocabulary
# --------------------------------------------------------------------------------------

DARK, LIGHT = 0, 1
SHADE_NAMES = ("D", "L")

SHOES, SOCKS, PANTS, SHIRTS, HATS, UNDERWEAR, BLANKET = range(7)
TYPE_NAMES = ("shoes", "socks", "pants", "shirts", "hats", "underwear", "blanket")
TYPE_BY_NAME = dict((n, i) for i, n in enumerate(TYPE_NAMES))

CLOTHES = frozenset((SHOES, SOCKS, PANTS, SHIRTS, HATS))
LINEN = frozenset((UNDERWEAR, BLANKET))
ALL_TYPES = tuple(range(7))

SPECIALS = ("Coloring", "Color catcher", "Bleach", "Wash net",
            "Snacc", "Sanitizer", "Coin")
# Cards that attach to a machine and are read by the reckoning.
ATTACHING = frozenset(("Coloring", "Color catcher", "Bleach", "Wash net", "Sanitizer"))
# Cards that resolve immediately on play and never attach.
IMMEDIATE = frozenset(("Snacc", "Coin"))

EVENTS = ("Gang", "Circuit break", "Jimothy", "Animal control")
FIXED_EVENT_DECK = {"Gang": 1, "Circuit break": 1, "Jimothy": 1, "Animal control": 1}

MACHINES_BY_PLAYERS = {3: 4, 4: 5, 5: 6, 6: 7}          # brief v8: P + 1
V5_MACHINES_BY_PLAYERS = {3: 3, 4: 3, 5: 4, 6: 4}       # the archived baseline's counts

DEFAULT_SPECIAL_DECK = dict((s, 2) for s in SPECIALS)   # 14 cards; P0 is swept


def default_config(players, **overrides):
    cfg = {
        "players": players,
        "machines": MACHINES_BY_PLAYERS[players],
        "capacity": 4,
        "hand_size": 10,
        "mandatory_load": True,           # v8: no longer optional
        "keyholder_first": False,         # [A-W01]
        "sanitizer_owner_only": False,    # [A-W05]
        "circuit_break": "V2",            # A/B arms: V1 blackout | V2 all-off | V3 auto-restore
        "crowd_threshold": 3,             # >=N of a garment type sends them all back
        "bleach_kills_dark": False,       # rules-v0.2 [OQ-05] alternative reading
        "socks_blanket_extra_wash": True, # v8 core rule; switch for ablation
        "special_deck": dict(DEFAULT_SPECIAL_DECK),
        "event_deck": dict(FIXED_EVENT_DECK),
        "day_cap": 400,
        "track_interference": True,
        "load_fraction": 1.0,             # ablation only; 1.0 == mandatory
    }
    cfg.update(overrides)
    return cfg


class Item(object):
    __slots__ = ("iid", "owner", "typ", "shade", "wash_count")

    def __init__(self, iid, owner, typ, shade):
        self.iid = iid
        self.owner = owner
        self.typ = typ
        self.shade = shade
        self.wash_count = 0

    def key(self):
        return (self.owner, self.typ, self.shade)

    def __repr__(self):
        return "%d-%s-%s" % (self.owner, SHADE_NAMES[self.shade], TYPE_NAMES[self.typ])


# --------------------------------------------------------------------------------------
# THE RECKONING -- pure, memoised
# --------------------------------------------------------------------------------------

_VERDICT_MEMO = {}


def machine_verdicts(items_key, cards_key, bleach_kills_dark=False,
                     sanitizer_owner_only=False, crowd_threshold=3):
    """Pure. Returns a tuple of booleans (`washing`) aligned with `items_key`.

    items_key : tuple of (owner, typ, shade), in caller's order.
    cards_key : (bleached, coloring_owners, catcher_owners, net_item_keys, san_owners)

    Implements rules-v0.3 §5.2 RESOLVE_MACHINE S1..S7, updated for v8:
      * S2 gains the Sanitizer gate (tiers 1-2 suppressed).
      * S4 reads a per-CARD Wash net protection set, not a per-owner one.
      * S5 blanket exclusivity now admits socks.
    The socks-with-blanket extra wash is NOT applied here -- it is a caller concern,
    because it depends on mutable per-card counters and would poison the memo table.
    """
    memo_k = (items_key, cards_key, bleach_kills_dark, sanitizer_owner_only,
              crowd_threshold)
    got = _VERDICT_MEMO.get(memo_k)
    if got is not None:
        return got

    n = len(items_key)
    if n == 0:
        _VERDICT_MEMO[memo_k] = ()
        return ()

    bleached, coloring_owners, catcher_owners, net_keys, san_owners = cards_key

    # [A-W05] owner-only Sanitizer: splice the sanitized verdict into the base verdict
    # for the sanitizer owners' items only.
    if san_owners and sanitizer_owner_only:
        base_ck = (bleached, coloring_owners, catcher_owners, net_keys, ())
        base = machine_verdicts(items_key, base_ck, bleach_kills_dark, False,
                                crowd_threshold)
        san_ck = (bleached, coloring_owners, catcher_owners, net_keys, ("*",))
        san = machine_verdicts(items_key, san_ck, bleach_kills_dark, False,
                               crowd_threshold)
        res = tuple(san[i] if items_key[i][0] in san_owners else base[i]
                    for i in range(n))
        _VERDICT_MEMO[memo_k] = res
        return res

    sanitized = bool(san_owners)

    # ---- S1. effective shade -------------------------------------------------------
    eff = [(1 - it[2]) if bleached else it[2] for it in items_key]

    if bleach_kills_dark and bleached:
        eff = [it[2] for it in items_key]
        killed = [it[2] == DARK for it in items_key]
    else:
        killed = [False] * n

    # ---- S2. tier selection --------------------------------------------------------
    tier = 4
    if not sanitized:
        for i in range(n):
            if killed[i]:
                continue
            if eff[i] == DARK and items_key[i][1] == SHOES:
                tier = 1
                break
        if tier == 4:
            for i in range(n):
                if killed[i]:
                    continue
                if eff[i] == LIGHT and items_key[i][1] == SHOES:
                    tier = 2
                    break
    if tier == 4:
        for i in range(n):
            if killed[i]:
                continue
            if eff[i] == DARK:
                tier = 3
                break

    # ---- S3. provisional verdict ---------------------------------------------------
    washing = [False] * n
    for i in range(n):
        if killed[i]:
            continue
        typ = items_key[i][1]
        if tier == 1:
            washing[i] = (eff[i] == DARK and typ == SHOES)
        elif tier == 2:
            washing[i] = (eff[i] == LIGHT and typ == SHOES)
        elif tier == 3:
            washing[i] = (eff[i] == DARK)
        else:
            washing[i] = (eff[i] == LIGHT)

    # ---- S4. underwear isolation ---------------------------------------------------
    has_non_underwear = any(it[1] != UNDERWEAR for it in items_key)
    if has_non_underwear:
        for i in range(n):
            if washing[i] and items_key[i][1] == UNDERWEAR and items_key[i] not in net_keys:
                washing[i] = False

    # ---- S5. blanket exclusivity [A-W11, REVISED v11] ------------------------------
    #
    # A blanket is big.  It may share a machine with exactly ONE other item, of any
    # type -- it used to be "any number of socks and nothing else", which is where the
    # SOCKS special case came from.  Two blankets still cannot share, and a blanket
    # with two or more companions is a board that placement should never have allowed,
    # so it stays a total loss and acts as the defensive assert it always was.
    #
    # What the companion SUFFERS is not decided here.  It is judged on the ladder like
    # anything else; getting tangled by the blanket happens afterwards, to items that
    # passed.  Keeping that out of this function is what keeps it a pure verdict.
    blankets = [i for i in range(n) if items_key[i][1] == BLANKET]
    if blankets:
        companions = n - len(blankets)
        if len(blankets) > 1 or companions > 1:
            washing = [False] * n

    # ---- S6. crowding (>=3 of a type, any colour/shade) ----------------------------
    counts = {}
    for it in items_key:
        counts[it[1]] = counts.get(it[1], 0) + 1
    crowded_types = set(t for t, c in counts.items() if c >= crowd_threshold)
    if crowded_types:
        for i in range(n):
            if items_key[i][1] in crowded_types:
                washing[i] = False

    # ---- S7. Coloring / Color catcher ----------------------------------------------
    if coloring_owners:
        for i in range(n):
            if not washing[i]:
                continue
            own = items_key[i][0]
            if own in catcher_owners:
                continue
            for p in coloring_owners:
                if own != p:
                    washing[i] = False
                    break

    res = tuple(washing)
    _VERDICT_MEMO[memo_k] = res
    return res


def cards_key_of(machine):
    bleached = False
    col, cat, san = [], [], []
    for name, owner in machine["cards"]:
        if name == "Bleach":
            bleached = True
        elif name == "Coloring":
            col.append(owner)
        elif name == "Color catcher":
            cat.append(owner)
        elif name == "Sanitizer":
            san.append(owner)
    net = tuple(sorted(machine["net"])) if machine["net"] else ()
    return (bleached, tuple(sorted(set(col))), tuple(sorted(set(cat))), net,
            tuple(sorted(set(san))))


def machine_washing(st, machine, extra=None, drop=None):
    """Which of `machine`'s items would wash right now?  Pure w.r.t. state.

    `extra` -- hypothetically add this Item.  `drop` -- remove items whose iid is in it.
    Returns dict iid -> bool.
    """
    cfg = st["cfg"]
    items = machine["items"]
    if drop:
        items = [x for x in items if x.iid not in drop]
    if extra is not None:
        items = items + [extra]
    if not items:
        return {}
    key = tuple(x.key() for x in items)
    verd = machine_verdicts(key, cards_key_of(machine), cfg["bleach_kills_dark"],
                            cfg["sanitizer_owner_only"], cfg["crowd_threshold"])
    return dict((items[i].iid, verd[i]) for i in range(len(items)))


# --------------------------------------------------------------------------------------
# Placement legality
# --------------------------------------------------------------------------------------

def machine_accepts(st, mi, item):
    """The sole placement-legality predicate. Governs loads AND face-4 displacements."""
    m = st["machines"][mi]
    if m["dead"] or m["jimothy"]:
        return False
    items = m["items"]
    if len(items) >= st["cfg"]["capacity"]:
        return False
    if item.typ == BLANKET:
        # a blanket may join an empty machine or one holding only socks [A-W11]
        return all(x.typ == SOCKS for x in items)
    for x in items:
        if x.typ == BLANKET:
            return item.typ == SOCKS
    return True


def live_machines(st):
    return [i for i, m in enumerate(st["machines"]) if not m["dead"]]


# --------------------------------------------------------------------------------------
# Setup
# --------------------------------------------------------------------------------------

def new_machine():
    return {"items": [], "on": True, "cards": [], "jimothy": False, "dead": False,
            "net": set(), "peak": 0}


def new_game(cfg, seed):
    rng = random.Random(seed)
    P = cfg["players"]
    machines = [new_machine() for _ in range(cfg["machines"])]

    players = []
    for pid in range(P):
        deck = [Item((pid, t, s), pid, t, s) for t in ALL_TYPES for s in (DARK, LIGHT)]
        rng.shuffle(deck)
        hand = deck[:cfg["hand_size"]]
        players.append({
            "pid": pid,
            "hand": hand,
            "must_wash": set(x.iid for x in hand),
            "clean": set(),
            "fresh": [],
            "ready": [],
            "finished_day": None,
            "key_holds": 0,
        })

    special_deck = []
    for name, n in cfg["special_deck"].items():
        special_deck.extend([name] * n)
    rng.shuffle(special_deck)

    event_deck = []
    for name, n in cfg["event_deck"].items():
        event_deck.extend([name] * n)
    rng.shuffle(event_deck)

    return {
        "cfg": cfg,
        "rng": rng,
        "day": 0,
        "players": players,
        "machines": machines,
        "special_deck": special_deck,
        "event_deck": event_deck,
        "key": 0,
        "revealed_event": None,
        "event_drawer": None,
        "jimothy_at": None,
        "jimothy_since": None,       # day he arrived on the CURRENT machine
        "jimothy_arrived": None,     # day he entered play
        "gang_used": False,
        "over": False,
        "winners": [],
        "_net_turn": None,
        "stats": new_stats(cfg),
    }


def new_stats(cfg):
    return {
        "days": 0,
        "machine_reckonings": 0,
        "nonempty_reckonings": 0,
        "zero_wash_reckonings": 0,
        "zero_wash_all_reckonings": 0,
        "wash_hist": {},
        "wash_events": 0,
        "items_cleaned": 0,
        "player_day_zero": 0,
        "player_days": 0,
        # ---- occupancy -------------------------------------------------------------
        "occ_sum": 0.0, "occ_n": 0, "occ_hist": {},          # live machines, at reckoning
        "avail_occ_sum": 0.0, "avail_occ_n": 0, "avail_occ_hist": {},  # live, ON, no raccoon
        "peak_hist": {},          # per machine-day peak occupancy reached at any moment
        "at_capacity": 0,         # live machine-days sitting at capacity at reckoning
        "peak_at_capacity": 0,    # live machine-days that TOUCHED capacity
        "day_max_hist": {},       # per day, the fullest machine on the board
        "machines_live_days": 0,
        "on_machines_hist": {},   # per day: how many live machines were ON at reckoning
        "on_machines_sum": 0,
        "machines_avail_days": 0,
        "third_machine_days": 0,  # days where >=3 machines held items
        # ---- contention ------------------------------------------------------------
        "crowd_fires": 0,
        "crowd_items": 0,
        "interference_items": 0,
        "sent_back": 0,
        "loads": 0,
        "load_opportunities": 0,
        "short_loads": 0,         # rolled N, loaded fewer
        "displacements": 0,
        "displace_offers": 0,
        "board_lock_offers": 0,
        "cap_block_offers": 0,
        # ---- events ----------------------------------------------------------------
        "events_fired": dict((e, 0) for e in EVENTS),
        "event_days": 0,
        "gang_items": 0,
        "gang_day": None,
        "machines_destroyed": 0,
        "cb_days": 0,
        "cb_recovery_days": [],
        "cb_lost_machine_days": 0,
        "ac_blanks": 0,
        # ---- Jimothy ---------------------------------------------------------------
        "jimothy_machine_days": 0,
        "jimothy_hostage_item_days": 0,
        "jimothy_squats": [],        # days on one machine
        "jimothy_stints": [],        # days in play
        "jim_arrivals": 0,
        "jim_relocations": 0,
        "jim_exit": {"Animal control": 0, "game_end": 0},
        "jim_hostages_released": 0,
        # ---- specials --------------------------------------------------------------
        "specials_drawn": dict((s, 0) for s in SPECIALS),
        "specials_kept": dict((s, 0) for s in SPECIALS),
        "specials_played": dict((s, 0) for s in SPECIALS),
        "specials_by_player": [dict((s, 0) for s in SPECIALS)
                               for _ in range(cfg["players"])],
        "specials_held_days": dict((s, 0) for s in SPECIALS),
        "specials_dead_days": dict((s, 0) for s in SPECIALS),
        "draw_events": 0,
        "coloring_ruined": 0,
        "net_saved": 0,
        "sanitizer_saved": 0,
        "coin_toggles": 0,
        # ---- key / misc ------------------------------------------------------------
        "key_toggles": 0,
        "machines_off_days": 0,
        "socks_blanket_pairings": 0,
        "socks_extra_wash": 0,
    }


def bump(d, k, n=1):
    d[k] = d.get(k, 0) + n


# --------------------------------------------------------------------------------------
# Phase 1: roll / turns
# --------------------------------------------------------------------------------------

def acting_order(st):
    P = st["cfg"]["players"]
    if st["cfg"]["keyholder_first"]:
        k = st["key"]
        return [(k + i) % P for i in range(P)]
    return list(range(P))


DICE = {1: (1, None), 2: (2, None), 3: (3, None),
        4: (1, "displace"), 5: (1, "special"), 6: (1, "event")}


def phase_roll(st, policy):
    cfg = st["cfg"]
    stats = st["stats"]
    for m in st["machines"]:
        m["peak"] = len(m["items"])
    for pid in acting_order(st):
        face = st["rng"].randint(1, 6)
        nload, extra = DICE[face]

        # ---- [A-W03] at most one ready special card, played BEFORE loading ---------
        st["_net_turn"] = None
        play_one_special(st, policy, pid)
        # ---- loading: MANDATORY, exactly `nload`, fewer only if the hand is short --
        got = 0
        for _ in range(nload):
            stats["load_opportunities"] += 1
            probe_placement(st, pid, stats)
            if cfg["load_fraction"] < 1.0 and st["rng"].random() >= cfg["load_fraction"]:
                continue
            choice = policy.choose_load(st, pid)
            if choice is None:
                continue
            item, mi = choice
            st["players"][pid]["hand"].remove(item)
            m = st["machines"][mi]
            m["items"].append(item)
            if len(m["items"]) > m["peak"]:
                m["peak"] = len(m["items"])
            if any(x.typ == BLANKET for x in m["items"]) and len(m["items"]) > 1:
                stats["socks_blanket_pairings"] += 1
            # [A-W04] Wash net protects same-turn underwear only
            if (item.typ == UNDERWEAR and st["_net_turn"] is not None
                    and st["_net_turn"] == (pid, mi)):
                m["net"].add(item.key())
            stats["loads"] += 1
            got += 1
        if got < nload:
            stats["short_loads"] += (nload - got)

        # ---- face effects ----------------------------------------------------------
        if extra == "displace":
            stats["displace_offers"] += 1
            mv = policy.choose_displace(st, pid)
            if mv is not None:
                src, item, dst = mv
                st["machines"][src]["items"].remove(item)
                st["machines"][src]["net"].discard(item.key())
                dm = st["machines"][dst]
                dm["items"].append(item)
                if len(dm["items"]) > dm["peak"]:
                    dm["peak"] = len(dm["items"])
                stats["displacements"] += 1
        elif extra == "special":
            draw_special(st, policy, pid)
        elif extra == "event":
            if st["revealed_event"] is None and st["event_deck"]:
                idx = st["rng"].randrange(len(st["event_deck"]))
                st["revealed_event"] = st["event_deck"].pop(idx)   # revealed at once
                st["event_drawer"] = pid


def draw_special(st, policy, pid):
    """[A-W13] draw two, keep one, the other to the bottom."""
    deck = st["special_deck"]
    if not deck:
        return
    stats = st["stats"]
    stats["draw_events"] += 1
    if len(deck) == 1:
        pair = [deck.pop()]
    else:
        pair = [deck.pop(), deck.pop()]
    for name in pair:
        bump(stats["specials_drawn"], name)
    keep = pair[0] if len(pair) == 1 else policy.choose_keep(st, pid, pair[0], pair[1])
    bump(stats["specials_kept"], keep)
    st["players"][pid]["fresh"].append(keep)
    for name in pair:
        if name != keep:
            deck.insert(0, name)
            break


def play_one_special(st, policy, pid):
    p = st["players"][pid]
    if not p["ready"]:
        return
    play = policy.choose_special(st, pid)
    if play is None:
        return
    name, target = play
    p["ready"].remove(name)
    bump(st["stats"]["specials_played"], name)
    bump(st["stats"]["specials_by_player"][pid], name)
    apply_special(st, pid, name, target)


def apply_special(st, pid, name, target):
    if name in ATTACHING:
        st["machines"][target]["cards"].append((name, pid))
        if name == "Wash net":
            st["_net_turn"] = (pid, target)
        return
    if name == "Snacc":                                   # [A-W09] relocate
        move_jimothy(st, target, reason="Snacc")
        recycle_special(st, name)
        return
    if name == "Coin":                                    # [A-W06] one-shot, resolved
        mi, on = target
        m = st["machines"][mi]
        if not m["dead"] and m["on"] != on:
            m["on"] = on
            st["stats"]["coin_toggles"] += 1
        recycle_special(st, name)
        return


def recycle_special(st, name):
    st["special_deck"].append(name)
    st["rng"].shuffle(st["special_deck"])


def probe_placement(st, pid, stats):
    """Telemetry: is the board refusing this player, and is capacity the reason?"""
    hand = st["players"][pid]["hand"]
    if not hand:
        return
    any_ok = False
    cap_blocked = False
    for mi, m in enumerate(st["machines"]):
        if m["dead"]:
            continue
        if not m["jimothy"] and len(m["items"]) >= st["cfg"]["capacity"]:
            cap_blocked = True
        for x in hand:
            if machine_accepts(st, mi, x):
                any_ok = True
                break
    if not any_ok:
        stats["board_lock_offers"] += 1
    if cap_blocked:
        stats["cap_block_offers"] += 1


# --------------------------------------------------------------------------------------
# Jimothy
# --------------------------------------------------------------------------------------

def move_jimothy(st, mi, reason):
    """Place or relocate.  Old machine releases hostages to hands, unwashed."""
    stats = st["stats"]
    old = st["jimothy_at"]
    if old is not None:
        st["machines"][old]["jimothy"] = False
        release_hostages(st, old)
        stats["jimothy_squats"].append(st["day"] - st["jimothy_since"] + 1)
        stats["jim_relocations"] += 1
    else:
        st["jimothy_arrived"] = st["day"]
        stats["jim_arrivals"] += 1
    st["machines"][mi]["jimothy"] = True
    st["jimothy_at"] = mi
    st["jimothy_since"] = st["day"]


def remove_jimothy(st, reason):
    mi = st["jimothy_at"]
    if mi is None:
        return
    stats = st["stats"]
    st["machines"][mi]["jimothy"] = False
    release_hostages(st, mi)
    stats["jimothy_squats"].append(st["day"] - st["jimothy_since"] + 1)
    stats["jimothy_stints"].append(st["day"] - st["jimothy_arrived"] + 1)
    stats["jim_exit"][reason] = stats["jim_exit"].get(reason, 0) + 1
    st["jimothy_at"] = None
    st["jimothy_since"] = None
    st["jimothy_arrived"] = None
    if reason == "Animal control":
        st["event_deck"].append("Jimothy")
        st["rng"].shuffle(st["event_deck"])


def release_hostages(st, mi):
    m = st["machines"][mi]
    st["stats"]["jim_hostages_released"] += len(m["items"])
    for x in m["items"]:
        st["players"][x.owner]["hand"].append(x)
    m["items"] = []
    m["net"] = set()
    recycle_cards(st, m)


# --------------------------------------------------------------------------------------
# Phase 2: event resolution
# --------------------------------------------------------------------------------------

def phase_event(st, policy):
    ev = st["revealed_event"]
    if ev is None:
        return
    drawer = st["event_drawer"]
    st["revealed_event"] = None
    st["event_drawer"] = None
    stats = st["stats"]
    stats["event_days"] += 1
    bump(stats["events_fired"], ev)

    if ev == "Gang":
        cands = [i for i, m in enumerate(st["machines"]) if not m["dead"]]   # [A-W07]
        if cands:
            mi = policy.choose_gang(st, drawer, cands)
            m = st["machines"][mi]
            for x in m["items"]:
                st["players"][x.owner]["hand"].append(x)
                stats["gang_items"] += 1
            m["items"] = []
            m["net"] = set()
            recycle_cards(st, m)
            if m["jimothy"]:
                # [A-W07] the raccoon relocates; the drawer picks where.
                m["jimothy"] = False
                st["jimothy_at"] = None
                elsewhere = [i for i, mm in enumerate(st["machines"])
                             if not mm["dead"] and i != mi]
                if elsewhere:
                    dest = policy.choose_jimothy(st, drawer, elsewhere)
                    st["machines"][dest]["jimothy"] = True
                    st["jimothy_at"] = dest
                    st["jimothy_since"] = st["day"]
                    stats["jim_relocations"] += 1
                    stats["jim_gang_relocations"] = stats.get("jim_gang_relocations", 0) + 1
                else:
                    stats["jimothy_squats"].append(st["day"] - st["jimothy_since"] + 1)
                    stats["jimothy_stints"].append(st["day"] - st["jimothy_arrived"] + 1)
                    stats["jim_exit"]["board_gone"] = stats["jim_exit"].get("board_gone", 0) + 1
                    st["jimothy_since"] = None
                    st["jimothy_arrived"] = None
            m["dead"] = True
            m["on"] = False
            stats["machines_destroyed"] += 1
            stats["gang_day"] = st["day"]
        st["gang_used"] = True
        # never returns to the deck

    elif ev == "Circuit break":                                   # [A-W08]
        stats["cb_days"] += 1
        arm = st["cfg"]["circuit_break"]
        if arm == "V1":
            st["cb_blackout"] = True          # tonight's reckoning is cancelled
            stats["cb_recovery_days"].append(0)
        else:
            n_on = 0
            for m in st["machines"]:
                if m["dead"]:
                    continue
                if m["on"]:
                    n_on += 1
                m["on"] = False
            st["cb_pending"] = st.get("cb_pending", [])
            st["cb_pending"].append((st["day"], n_on))
            if arm == "V3":
                st["cb_restore_day"] = st["day"] + 1
        st["event_deck"].append(ev)
        st["rng"].shuffle(st["event_deck"])

    elif ev == "Jimothy":
        cands = [i for i, m in enumerate(st["machines"]) if not m["dead"]]
        if cands:
            move_jimothy(st, policy.choose_jimothy(st, drawer, cands), reason="place")
        # his card stays on the board -- it does NOT return to the deck

    elif ev == "Animal control":
        if st["jimothy_at"] is None:
            stats["ac_blanks"] += 1                               # [A-W10]
        else:
            remove_jimothy(st, "Animal control")
        st["event_deck"].append(ev)
        st["rng"].shuffle(st["event_deck"])


# --------------------------------------------------------------------------------------
# Phase 3: key
# --------------------------------------------------------------------------------------

def phase_key(st, policy):
    act = policy.choose_key(st, st["key"])
    if act is not None:
        mi, on = act
        m = st["machines"][mi]
        if not m["dead"] and m["on"] != on:
            m["on"] = on
            st["stats"]["key_toggles"] += 1


# --------------------------------------------------------------------------------------
# Phase 4: reckoning
# --------------------------------------------------------------------------------------

def phase_reckon(st):
    cfg = st["cfg"]
    stats = st["stats"]
    P = cfg["players"]
    day_player_wash = [0] * P
    blackout = st.pop("cb_blackout", False)      # circuit-break arm V1

    # ---- occupancy sampling ----------------------------------------------------
    day_max = 0
    loaded_machines = 0
    for m in st["machines"]:
        if m["dead"]:
            continue
        n = len(m["items"])
        stats["machines_live_days"] += 1
        stats["occ_sum"] += n
        stats["occ_n"] += 1
        bump(stats["occ_hist"], n)
        bump(stats["peak_hist"], m["peak"])
        if n >= cfg["capacity"]:
            stats["at_capacity"] += 1
        if m["peak"] >= cfg["capacity"]:
            stats["peak_at_capacity"] += 1
        if n > day_max:
            day_max = n
        if n > 0:
            loaded_machines += 1
        if not m["on"]:
            stats["machines_off_days"] += 1
        if not m["jimothy"] and m["on"]:
            stats["machines_avail_days"] += 1
            stats["avail_occ_sum"] += n
            stats["avail_occ_n"] += 1
            bump(stats["avail_occ_hist"], n)
    bump(stats["day_max_hist"], day_max)
    n_on = sum(1 for m in st["machines"] if not m["dead"] and m["on"])
    bump(stats["on_machines_hist"], n_on)
    stats["on_machines_sum"] += n_on
    if loaded_machines >= 3:
        stats["third_machine_days"] += 1

    if st["jimothy_at"] is not None:
        stats["jimothy_machine_days"] += 1
        stats["jimothy_hostage_item_days"] += len(st["machines"][st["jimothy_at"]]["items"])

    # ---- resolution ------------------------------------------------------------
    for mi, m in enumerate(st["machines"]):
        if blackout or m["dead"] or not m["on"] or m["jimothy"]:
            continue
        stats["machine_reckonings"] += 1
        items = m["items"]
        if not items:
            stats["zero_wash_all_reckonings"] += 1
            recycle_cards(st, m)
            continue
        stats["nonempty_reckonings"] += 1

        key = tuple(x.key() for x in items)
        ck = cards_key_of(m)
        verd = machine_verdicts(key, ck, cfg["bleach_kills_dark"],
                                cfg["sanitizer_owner_only"], cfg["crowd_threshold"])
        blanket_here = any(x.typ == BLANKET for x in items)

        # telemetry
        counts = {}
        for x in items:
            counts[x.typ] = counts.get(x.typ, 0) + 1
        crowded = [t for t, c in counts.items() if c >= cfg["crowd_threshold"]]
        if crowded:
            stats["crowd_fires"] += 1
            stats["crowd_items"] += sum(counts[t] for t in crowded)

        if ck[1]:
            clean_ck = (ck[0], (), ck[2], ck[3], ck[4])
            v_no = machine_verdicts(key, clean_ck, cfg["bleach_kills_dark"],
                                    cfg["sanitizer_owner_only"], cfg["crowd_threshold"])
            stats["coloring_ruined"] += sum(1 for i in range(len(items))
                                            if v_no[i] and not verd[i])
        if ck[3]:
            no_net = (ck[0], ck[1], ck[2], (), ck[4])
            v_no = machine_verdicts(key, no_net, cfg["bleach_kills_dark"],
                                    cfg["sanitizer_owner_only"], cfg["crowd_threshold"])
            stats["net_saved"] += sum(1 for i in range(len(items))
                                      if verd[i] and not v_no[i])
        if ck[4]:
            no_san = (ck[0], ck[1], ck[2], ck[3], ())
            v_no = machine_verdicts(key, no_san, cfg["bleach_kills_dark"],
                                    cfg["sanitizer_owner_only"], cfg["crowd_threshold"])
            stats["sanitizer_saved"] += sum(1 for i in range(len(items))
                                            if verd[i] and not v_no[i])

        washed_here = 0
        for i, x in enumerate(items):
            p = st["players"][x.owner]
            if verd[i]:
                stats["wash_events"] += 1
                if (cfg["socks_blanket_extra_wash"] and x.typ == SOCKS
                        and blanket_here):
                    x.wash_count += 1
                    if x.wash_count >= 2:
                        p["clean"].add(x.iid)
                        stats["items_cleaned"] += 1
                        washed_here += 1
                    else:
                        stats["socks_extra_wash"] += 1
                        p["hand"].append(x)
                    day_player_wash[x.owner] += 1
                else:
                    p["clean"].add(x.iid)
                    stats["items_cleaned"] += 1
                    washed_here += 1
                    day_player_wash[x.owner] += 1
            else:
                p["hand"].append(x)
                stats["sent_back"] += 1
                if cfg["track_interference"]:
                    own_only = [y for y in items if y.owner == x.owner]
                    k2 = tuple(y.key() for y in own_only)
                    v2 = machine_verdicts(k2, ck, cfg["bleach_kills_dark"],
                                          cfg["sanitizer_owner_only"],
                                          cfg["crowd_threshold"])
                    for j, y in enumerate(own_only):
                        if y.iid == x.iid and v2[j]:
                            stats["interference_items"] += 1
                            break

        bump(stats["wash_hist"], washed_here)
        if washed_here == 0:
            stats["zero_wash_reckonings"] += 1
            stats["zero_wash_all_reckonings"] += 1
        m["items"] = []
        m["net"] = set()
        recycle_cards(st, m)

    for pid in range(P):
        stats["player_days"] += 1
        if day_player_wash[pid] == 0:
            stats["player_day_zero"] += 1


def recycle_cards(st, m):
    if m["cards"]:
        for name, _o in m["cards"]:
            st["special_deck"].append(name)
        m["cards"] = []
        st["rng"].shuffle(st["special_deck"])


# --------------------------------------------------------------------------------------
# Phase 5: end of day
# --------------------------------------------------------------------------------------

def phase_end_of_day(st):
    cfg = st["cfg"]
    stats = st["stats"]

    # circuit-break arm V3: everything comes back on after the following reckoning
    if st.get("cb_restore_day") == st["day"]:
        for m in st["machines"]:
            if not m["dead"]:
                m["on"] = True
        st["cb_restore_day"] = None

    # Circuit-break recovery telemetry: how many days until every live machine is ON
    pend = st.get("cb_pending")
    if pend:
        live_on = sum(1 for m in st["machines"] if not m["dead"] and m["on"])
        live = sum(1 for m in st["machines"] if not m["dead"])
        off = live - live_on
        stats["cb_lost_machine_days"] += off
        if off == 0:
            for d0, _n in pend:
                stats["cb_recovery_days"].append(st["day"] - d0)
            st["cb_pending"] = []

    for p in st["players"]:
        if p["finished_day"] is None and p["clean"] == p["must_wash"]:
            p["finished_day"] = st["day"]
        for name in p["fresh"]:
            p["ready"].append(name)
        p["fresh"] = []
        for name in p["ready"]:
            bump(stats["specials_held_days"], name)
            if name == "Snacc" and st["jimothy_at"] is None:
                bump(stats["specials_dead_days"], name)

    st["players"][st["key"]]["key_holds"] += 1
    st["key"] = (st["key"] + 1) % cfg["players"]

    winners = [p["pid"] for p in st["players"] if p["finished_day"] is not None]
    if winners:                                   # [A-W14] immediate, simultaneous
        st["over"] = True
        st["winners"] = winners


def play_day(st, policy):
    st["day"] += 1
    st["stats"]["days"] = st["day"]
    phase_roll(st, policy)
    phase_event(st, policy)
    phase_key(st, policy)
    phase_reckon(st)
    phase_end_of_day(st)
    assert_invariants(st)


def assert_invariants(st):
    if not __debug__:
        return
    for m in st["machines"]:
        blank = [x for x in m["items"] if x.typ == BLANKET]
        assert len(blank) <= 1, "I-2 at most one blanket"
        if blank:
            assert all(x.typ in (BLANKET, SOCKS) for x in m["items"]), \
                "I-2 blanket shares only with socks"
        assert len(m["items"]) <= st["cfg"]["capacity"], "capacity"
        assert not (m["dead"] and m["items"]), "dead machines hold nothing"
    for p in st["players"]:
        loaded = set()
        for m in st["machines"]:
            for x in m["items"]:
                if x.owner == p["pid"]:
                    loaded.add(x.iid)
        hand = set(x.iid for x in p["hand"])
        assert hand | loaded | p["clean"] == p["must_wash"], "I-9 conservation"
        assert not (hand & p["clean"]), "I-1 disjoint"


def play_game(cfg, seed, policy):
    st = new_game(cfg, seed)
    while not st["over"] and st["day"] < cfg["day_cap"]:
        play_day(st, policy)
    return finalize(st)


def finalize(st):
    s = st["stats"]
    if st["jimothy_at"] is not None:
        s["jimothy_squats"].append(st["day"] - st["jimothy_since"] + 1)
        s["jimothy_stints"].append(st["day"] - st["jimothy_arrived"] + 1)
        s["jim_exit"]["game_end"] += 1
    winners = st["winners"]
    return {
        "days": st["day"],
        "capped": not st["over"],
        "winners": list(winners),
        "winner": winners[0] if winners else None,
        "n_winners": len(winners),
        "clean_by_player": [len(p["clean"]) for p in st["players"]],
        "key_holds": [p["key_holds"] for p in st["players"]],
        "stats": s,
        "state": st,
    }
