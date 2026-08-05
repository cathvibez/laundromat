#!/usr/bin/env python3
"""
Laundromat -- simulation harness.  BRIEF v8.

    python3 run.py main       -n 10000     # length, table time, throughput, termination
    python3 run.py occupancy  -n 10000     # THE occupancy distribution study
    python3 run.py contention -n 10000     # capacity, crowding, interference
    python3 run.py deck       -n 10000     # special-deck composition sweep (the P0)
    python3 run.py newcards   -n 10000     # Sanitizer and Coin, incl. persistent Coin
    python3 run.py jimothy    -n 10000
    python3 run.py events     -n 10000     # Circuit break and Gang
    python3 run.py seat       -n 20000     # seat-order fairness
    python3 run.py keyhazard  -n 5000      # the retired NAIVEKEY OFF-drift hazard
    python3 run.py all        -n 10000

Everything is seeded: `--seed0 S` fixes the first game's seed, game k uses seed S+k.
Re-running with the same arguments reproduces every number exactly.
"""

from __future__ import division

import argparse
import math
from concurrent.futures import ProcessPoolExecutor

import rules as R
import bots

PLAYER_COUNTS = (3, 4, 5, 6)
CORE_POLICIES = ("RANDOM", "GREEDY", "CAUTIOUS", "MEAN", "CLUSTERING")


# --------------------------------------------------------------------------------------
# plumbing
# --------------------------------------------------------------------------------------

def summarize_game(res, cfg):
    s = res["stats"]
    st = res["state"]
    P = cfg["players"]
    days = res["days"]
    pd = max(1, s["player_days"])
    M = cfg["machines"]

    hands = []
    for p in st["players"]:
        h = {"shoes": 0, "socks": 0, "blanket": 0, "underwear": 0, "dark": 0}
        for iid in p["must_wash"]:
            _o, t, sh = iid
            for nm, tt in (("shoes", R.SHOES), ("socks", R.SOCKS),
                           ("blanket", R.BLANKET), ("underwear", R.UNDERWEAR)):
                if t == tt:
                    h[nm] += 1
            if sh == R.DARK:
                h["dark"] += 1
        hands.append(h)

    return {
        "days": days,
        "capped": 1 if res["capped"] else 0,
        "winners": res["winners"],
        "n_winners": res["n_winners"],
        "clean": res["clean_by_player"],
        "L": s["loads"] / pd,
        "short_load_rate": s["short_loads"] / max(1, s["load_opportunities"]),
        "wash_per_player_day": s["wash_events"] / pd,
        "cleaned_per_day": s["items_cleaned"] / days,
        "zero_reck_frac": s["zero_wash_reckonings"] / max(1, s["nonempty_reckonings"]),
        "zero_reck_all_frac": s["zero_wash_all_reckonings"] / max(1, s["machine_reckonings"]),
        "empty_reck_frac": 1 - (s["nonempty_reckonings"] / max(1, s["machine_reckonings"])),
        "player_day_zero": s["player_day_zero"] / pd,
        # occupancy
        "occ": s["occ_sum"] / max(1, s["occ_n"]),
        "occ_avail": s["avail_occ_sum"] / max(1, s["avail_occ_n"]),
        "occ_hist": dict(s["occ_hist"]),
        "avail_occ_hist": dict(s["avail_occ_hist"]),
        "peak_hist": dict(s["peak_hist"]),
        "day_max_hist": dict(s["day_max_hist"]),
        "at_cap_frac": s["at_capacity"] / max(1, s["occ_n"]),
        "peak_at_cap_frac": s["peak_at_capacity"] / max(1, s["occ_n"]),
        "third_machine_frac": s["third_machine_days"] / days,
        "avail_machines": s["machines_avail_days"] / days,
        "live_machines": s["machines_live_days"] / days,
        # contention
        "crowd_per_reck": s["crowd_fires"] / max(1, s["nonempty_reckonings"]),
        "crowd_items": s["crowd_items"],
        "interf_per_reck": s["interference_items"] / max(1, s["nonempty_reckonings"]),
        "interf_share": s["interference_items"] / max(1, s["sent_back"]),
        "cap_block_rate": s["cap_block_offers"] / max(1, s["load_opportunities"]),
        "board_lock_rate": s["board_lock_offers"] / max(1, s["load_opportunities"]),
        # events
        "event_day_frac": s["event_days"] / days,
        "gang_fired": s["events_fired"]["Gang"],
        "gang_day": s["gang_day"],
        "gang_items": s["gang_items"],
        "cb_days": s["cb_days"],
        "cb_recovery": list(s["cb_recovery_days"]),
        "cb_lost_machine_days": s["cb_lost_machine_days"],
        "ac_blanks": s["ac_blanks"],
        # Jimothy
        "jim_uptime": s["jimothy_machine_days"] / days,
        "jim_machine_days": s["jimothy_machine_days"],
        "jim_hostage_item_days": s["jimothy_hostage_item_days"],
        "jim_squats": list(s["jimothy_squats"]),
        "jim_stints": list(s["jimothy_stints"]),
        "jim_arrivals": s["jim_arrivals"],
        "jim_relocations": s["jim_relocations"],
        "jim_exit": dict(s["jim_exit"]),
        "jim_released": s["jim_hostages_released"],
        # specials
        "specials_played": dict(s["specials_played"]),
        "specials_kept": dict(s["specials_kept"]),
        "specials_drawn": dict(s["specials_drawn"]),
        "specials_held_days": dict(s["specials_held_days"]),
        "specials_dead_days": dict(s["specials_dead_days"]),
        "specials_by_player": [dict(d) for d in s["specials_by_player"]],
        "draw_events": s["draw_events"],
        "coloring_ruined": s["coloring_ruined"],
        "net_saved": s["net_saved"],
        "sanitizer_saved": s["sanitizer_saved"],
        "coin_toggles": s["coin_toggles"],
        # misc
        "socks_extra_wash": s["socks_extra_wash"],
        "socks_blanket_pairings": s["socks_blanket_pairings"],
        "key_toggles": s["key_toggles"] / days,
        "machines_off_days": s["machines_off_days"] / days,
        "wash_hist": dict(s["wash_hist"]),
        "hands": hands,
        "players": P,
        "machines": M,
    }


def _worker(args):
    cfg, seeds, pol = args
    return [summarize_game(R.play_game(cfg, sd, bots.make(pol)), cfg) for sd in seeds]


def run_batch(cfg, pol, n, seed0=0, jobs=8):
    seeds = list(range(seed0, seed0 + n))
    if jobs <= 1 or n < 400:
        return _worker((cfg, seeds, pol))
    chunk = int(math.ceil(n / jobs))
    parts = [(cfg, seeds[i:i + chunk], pol) for i in range(0, n, chunk)]
    out = []
    with ProcessPoolExecutor(max_workers=jobs) as ex:
        for r in ex.map(_worker, parts):
            out.extend(r)
    return out


_CACHE = {}


def _cache(a, pol, P, **over):
    k = (pol, P, tuple(sorted((kk, str(vv)) for kk, vv in over.items())), a.n, a.seed0)
    if k not in _CACHE:
        cfg = R.default_config(P, **over)
        _CACHE[k] = run_batch(cfg, pol, a.n, a.seed0, a.jobs)
    return _CACHE[k]


# --------------------------------------------------------------------------------------
# statistics helpers
# --------------------------------------------------------------------------------------

def pct(xs, q):
    if not xs:
        return float("nan")
    ys = sorted(xs)
    i = min(len(ys) - 1, max(0, int(round(q * (len(ys) - 1)))))
    return ys[i]


def mean(xs):
    return sum(xs) / len(xs) if xs else float("nan")


def ci95(xs):
    n = len(xs)
    if n < 2:
        return float("nan")
    m = mean(xs)
    var = sum((x - m) ** 2 for x in xs) / (n - 1)
    return 1.96 * math.sqrt(var / n)


def table(headers, rows):
    print("| " + " | ".join(headers) + " |")
    print("|" + "|".join("---" for _ in headers) + "|")
    for r in rows:
        print("| " + " | ".join(str(x) for x in r) + " |")
    print("")


def f(x, d=2):
    if x != x:
        return "n/a"
    return ("%." + str(d) + "f") % x


def hist_pct(recs, field, kmax=4):
    """Pool a per-game histogram dict into percentages over 0..kmax."""
    tot = {}
    n = 0
    for r in recs:
        for k, v in r[field].items():
            tot[k] = tot.get(k, 0) + v
            n += v
    return [100.0 * tot.get(k, 0) / max(1, n) for k in range(kmax + 1)]


def _chisq(wins):
    n = sum(wins)
    if n == 0:
        return "n/a"
    e = n / len(wins)
    x2 = sum((w - e) ** 2 / e for w in wins)
    crit = {2: 5.99, 3: 7.81, 4: 9.49, 5: 11.07}[len(wins) - 1]
    return "X2=%.1f %s" % (x2, "SIGNIFICANT" if x2 > crit else "ns")


# --------------------------------------------------------------------------------------
# 1. MAIN
# --------------------------------------------------------------------------------------

def cmd_main(a):
    print("\n## 1. GAME LENGTH (days), brief v8\n")
    rows = []
    for pol in CORE_POLICIES:
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            d = [r["days"] for r in recs]
            rows.append([pol, P, f(mean(d), 2), f(ci95(d), 2), pct(d, 0.5), pct(d, 0.10),
                         pct(d, 0.90), pct(d, 0.99), max(d),
                         f(100 * sum(1 for x in d if x > 20) / len(d), 1) + "%",
                         f(100 * sum(1 for x in d if x > 40) / len(d), 2) + "%",
                         sum(r["capped"] for r in recs),
                         f(mean([r["n_winners"] for r in recs]), 3)])
    table(["policy", "P", "mean", "+/-95%", "median", "p10", "p90", "p99", "max",
           ">20d", ">40d", "capped", "winners/game"], rows)

    print("\n### Estimated table time (minutes). A day costs 60-90s PER PLAYER.\n")
    rows = []
    for pol in CORE_POLICIES:
        for P in PLAYER_COUNTS:
            d = [r["days"] for r in _cache(a, pol, P)]
            rows.append([pol, P, f(mean(d) * P * 60 / 60.0, 0), f(mean(d) * P * 90 / 60.0, 0),
                         f(pct(d, 0.5) * P * 75 / 60.0, 0),
                         f(pct(d, 0.9) * P * 60 / 60.0, 0), f(pct(d, 0.9) * P * 90 / 60.0, 0),
                         f(pct(d, 0.99) * P * 90 / 60.0, 0)])
    table(["policy", "P", "mean @60s", "mean @90s", "median @75s", "p90 @60s", "p90 @90s",
           "p99 @90s"], rows)

    print("\n### 1c. WASH THROUGHPUT\n")
    rows = []
    for pol in CORE_POLICIES:
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            wh = {}
            tot = 0
            for r in recs:
                for k, v in r["wash_hist"].items():
                    wh[k] = wh.get(k, 0) + v
                    tot += v
            rows.append([pol, P,
                         f(mean([r["L"] for r in recs])),
                         f(100 * mean([r["short_load_rate"] for r in recs]), 2) + "%",
                         f(mean([r["wash_per_player_day"] for r in recs])),
                         f(mean([r["cleaned_per_day"] for r in recs])),
                         f(100 * mean([r["zero_reck_frac"] for r in recs]), 1),
                         f(100 * mean([r["zero_reck_all_frac"] for r in recs]), 1),
                         f(100 * mean([r["player_day_zero"] for r in recs]), 1),
                         " ".join("%d:%d%%" % (k, round(100 * wh.get(k, 0) / max(1, tot)))
                                  for k in sorted(wh))])
    table(["policy", "P", "L (loads/pl/day)", "short-load rate", "wash ev/pl/day",
           "items clean/day", "dead reck % (non-empty)", "dead reck % (all ON)",
           "player-days w/ 0 washes %", "items washed per non-empty reckoning"], rows)

    print("\n### 1d. TERMINATION -- the Handwash ratchet is gone; do games still end?\n")
    rows = []
    for pol in CORE_POLICIES:
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            d = [r["days"] for r in recs]
            rows.append([pol, P, len(recs), sum(r["capped"] for r in recs), max(d),
                         f(100 * sum(1 for x in d if x > 30) / len(d), 2) + "%",
                         f(100 * sum(1 for x in d if x > 50) / len(d), 3) + "%",
                         f(100 * mean([r["board_lock_rate"] for r in recs]), 3) + "%"])
    table(["policy", "P", "games", "hit day cap (400)", "longest game", ">30d", ">50d",
           "board-lock load offers"], rows)


# --------------------------------------------------------------------------------------
# 2. OCCUPANCY
# --------------------------------------------------------------------------------------

def cmd_occupancy(a):
    print("\n## 2. OCCUPANCY -- the full distribution, not the mean\n")

    print("### 2a. Occupancy at reckoning time, ALL live machines (% of machine-days)\n")
    rows = []
    for pol in CORE_POLICIES:
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            h = hist_pct(recs, "occ_hist")
            rows.append([pol, P, P + 1, f(mean([r["occ"] for r in recs])),
                         f(mean([r["occ_avail"] for r in recs]))]
                        + [f(x, 1) for x in h])
    table(["policy", "P", "M", "mean occ (live)", "mean occ (available)",
           "0 items", "1", "2", "3", "4 (FULL)"], rows)

    print("### 2b. Occupancy over AVAILABLE machines only "
          "(live, ON, no raccoon) -- what a player can actually load into\n")
    rows = []
    for pol in CORE_POLICIES:
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            h = hist_pct(recs, "avail_occ_hist")
            rows.append([pol, P, f(mean([r["avail_machines"] for r in recs])),
                         f(mean([r["occ_avail"] for r in recs]))] + [f(x, 1) for x in h])
    table(["policy", "P", "available machines/day", "mean occ", "0", "1", "2", "3",
           "4 (FULL)"], rows)

    print("### 2c. PEAK occupancy reached at any moment in the day "
          "(the number a player at the table actually sees)\n")
    rows = []
    for pol in CORE_POLICIES:
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            h = hist_pct(recs, "peak_hist")
            rows.append([pol, P] + [f(x, 1) for x in h]
                        + [f(100 * mean([r["peak_at_cap_frac"] for r in recs]), 1) + "%"])
    table(["policy", "P", "0", "1", "2", "3", "4", "machine-days that TOUCHED capacity"],
          rows)

    print("### 2d. The fullest machine on the board each day -- "
          "'did anyone see a full washer today?'\n")
    rows = []
    for pol in CORE_POLICIES:
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            h = hist_pct(recs, "day_max_hist")
            rows.append([pol, P] + [f(x, 1) for x in h]
                        + [f(h[3] + h[4], 1) + "%",
                           f(100 * mean([r["third_machine_frac"] for r in recs]), 1) + "%"])
    table(["policy", "P", "max 0", "1", "2", "3", "4", "days with a 3+ machine",
           "days using >=3 machines"], rows)

    print("### 2e. Why the mean is misleading: the arithmetic identity\n")
    rows = []
    for pol in ("GREEDY", "CLUSTERING"):
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            L = mean([r["L"] for r in recs])
            M = P + 1
            avail = mean([r["avail_machines"] for r in recs])
            rows.append([pol, P, M, f(L), f(L * P / M), f(L * P / max(0.01, avail)),
                         f(mean([r["occ"] for r in recs])),
                         f(mean([r["occ_avail"] for r in recs]))])
    table(["policy", "P", "M", "realized L", "naive L*P/M", "L*P/available",
           "measured occ (live)", "measured occ (available)"], rows)

    print("### 2f. Ablation: which v8 change moved occupancy? (GREEDY)\n")
    variants = [
        ("v8 baseline", {}),
        ("optional loading (v5 behaviour)", {"load_fraction": 0.55}),
        ("v5 machine counts 3/3/4/4", "v5m"),
        ("no Gang (machine never destroyed)", {"event_deck": {"Circuit break": 1,
                                                              "Jimothy": 1,
                                                              "Animal control": 1}}),
        ("no Jimothy", {"event_deck": {"Gang": 1, "Circuit break": 1}}),
        ("no events at all", {"event_deck": {}}),
    ]
    rows = []
    for P in PLAYER_COUNTS:
        for label, over in variants:
            o = dict(machines=R.V5_MACHINES_BY_PLAYERS[P]) if over == "v5m" else dict(over)
            recs = _cache(a, "GREEDY", P, **o)
            h = hist_pct(recs, "occ_hist")
            rows.append([P, label, f(mean([r["L"] for r in recs])),
                         f(mean([r["occ"] for r in recs])),
                         f(h[4], 1) + "%",
                         f(100 * mean([r["peak_at_cap_frac"] for r in recs]), 1) + "%",
                         f(mean([r["days"] for r in recs]), 1)])
    table(["P", "variant", "realized L", "mean occ", "% machine-days FULL at reckoning",
           "% that touched full", "mean days"], rows)


# --------------------------------------------------------------------------------------
# 3. CONTENTION
# --------------------------------------------------------------------------------------

def cmd_contention(a):
    print("\n## 3. CONTENTION\n")
    rows = []
    for pol in CORE_POLICIES:
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            rows.append([pol, P,
                         f(100 * mean([r["crowd_per_reck"] for r in recs]), 2) + "%",
                         f(mean([r["crowd_items"] / max(1, r["days"]) for r in recs]), 3),
                         f(100 * mean([r["at_cap_frac"] for r in recs]), 1) + "%",
                         f(100 * mean([r["peak_at_cap_frac"] for r in recs]), 1) + "%",
                         f(100 * mean([r["cap_block_rate"] for r in recs]), 1) + "%",
                         f(100 * mean([r["board_lock_rate"] for r in recs]), 3) + "%",
                         f(mean([r["interf_per_reck"] for r in recs]), 3),
                         f(100 * mean([r["interf_share"] for r in recs]), 1) + "%"])
    table(["policy", "P", "reckonings where crowding fires", "items crowded out/day",
           "machine-days AT capacity (reckoning)", "machine-days that touched capacity",
           "load offers with a full machine on the board", "board-lock offers",
           "items/reckoning sent back BY ANOTHER PLAYER",
           "share of send-backs that are interference"], rows)

    print("### 3b. Crowding by garment type -- which types actually collide\n")
    rows = []
    for P in PLAYER_COUNTS:
        recs = _cache(a, "CLUSTERING", P)
        rows.append([P, f(mean([r["crowd_items"] for r in recs]), 2),
                     f(100 * mean([r["crowd_per_reck"] for r in recs]), 2) + "%",
                     f(mean([r["socks_blanket_pairings"] for r in recs]), 2),
                     f(mean([r["socks_extra_wash"] for r in recs]), 2)])
    table(["P", "items crowded out per game", "reckonings where crowding fires",
           "socks-with-blanket load events/game", "socks needing the extra wash/game"], rows)


# --------------------------------------------------------------------------------------
# 4. SPECIAL DECK
# --------------------------------------------------------------------------------------

def _mk(over, default=2):
    d = dict((s, default) for s in R.SPECIALS)
    d.update(over)
    return d


def cmd_deck(a):
    print("\n## 4. SPECIAL ITEM DECK -- the remaining P0\n")

    print("### 4a. Per-card play rates under the default uniform x2 deck (14 cards)\n")
    for pol in ("GREEDY", "MEAN", "CLUSTERING"):
        rows = []
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            n = len(recs)
            row = [pol, P, f(mean([r["draw_events"] for r in recs]), 2),
                   f(mean([sum(r["specials_played"].values()) for r in recs]), 2)]
            for s in R.SPECIALS:
                row.append(f(sum(r["specials_played"][s] for r in recs) / n, 2))
            rows.append(row)
        table(["policy", "P", "draw events/game", "cards played/game"] + list(R.SPECIALS),
              rows)

    print("### 4b. Keep rate -- of the two cards drawn, how often is each KEPT?\n")
    rows = []
    for P in PLAYER_COUNTS:
        recs = _cache(a, "MEAN", P)
        row = [P]
        for s in R.SPECIALS:
            dr = sum(r["specials_drawn"][s] for r in recs)
            kp = sum(r["specials_kept"][s] for r in recs)
            row.append(f(100 * kp / max(1, dr), 1) + "%")
        rows.append(row)
    table(["P"] + list(R.SPECIALS), rows)

    print("### 4c. Conversion -- of cards KEPT, how many are ever PLAYED?\n")
    rows = []
    for P in PLAYER_COUNTS:
        recs = _cache(a, "MEAN", P)
        row = [P]
        for s in R.SPECIALS:
            kp = sum(r["specials_kept"][s] for r in recs)
            pl = sum(r["specials_played"][s] for r in recs)
            row.append(f(100 * pl / max(1, kp), 1) + "%")
        rows.append(row)
    table(["P"] + list(R.SPECIALS), rows)

    print("### 4d. Win-rate impact: win % of a player who played card X at least once,\n"
          "### against that player count's fair share (MEAN policy)\n")
    rows = []
    for P in PLAYER_COUNTS:
        recs = _cache(a, "MEAN", P)
        fair = 100.0 / P
        row = [P, f(fair, 1) + "%"]
        for s in R.SPECIALS:
            played = won = 0
            for r in recs:
                ws = set(r["winners"])
                for pid in range(P):
                    if r["specials_by_player"][pid][s] > 0:
                        played += 1
                        if pid in ws:
                            won += 1
            row.append((f(100 * won / max(1, played), 1) + "%"
                        + (" (n=%d)" % played if played < 500 else "")))
        rows.append(row)
    table(["P", "fair share"] + list(R.SPECIALS), rows)

    print("### 4e. COMPOSITION SWEEP (P=4, MEAN policy)\n")
    cands = [
        ("uniform x1 (7 cards)", _mk({}, 1)),
        ("uniform x2 (14 cards) -- default", _mk({}, 2)),
        ("uniform x3 (21 cards)", _mk({}, 3)),
        ("uniform x4 (28 cards)", _mk({}, 4)),
        ("no Coin", _mk({"Coin": 0})),
        ("no Snacc", _mk({"Snacc": 0})),
        ("no Wash net", _mk({"Wash net": 0})),
        ("no Coloring/Catcher", _mk({"Coloring": 0, "Color catcher": 0})),
        ("Sanitizer-heavy (San4)", _mk({"Sanitizer": 4})),
        ("Coin-heavy (Coin4)", _mk({"Coin": 4})),
        ("destructive-heavy (Col4 Bl4)", _mk({"Coloring": 4, "Bleach": 4})),
        ("REC-A San3 Bl3 Coin2 Cat2 Col2 Net1 Snacc1",
         {"Sanitizer": 3, "Bleach": 3, "Coin": 2, "Color catcher": 2, "Coloring": 2,
          "Wash net": 1, "Snacc": 1}),
        ("REC-B San3 Bl2 Coin2 Cat2 Col3 Net1 Snacc1",
         {"Sanitizer": 3, "Bleach": 2, "Coin": 2, "Color catcher": 2, "Coloring": 3,
          "Wash net": 1, "Snacc": 1}),
    ]
    rows = []
    for name, deck in cands:
        recs = _cache(a, "MEAN", 4, special_deck=deck)
        d = [r["days"] for r in recs]
        played = mean([sum(r["specials_played"].values()) for r in recs])
        rows.append([name, sum(deck.values()), f(mean(d), 2), pct(d, 0.5), pct(d, 0.9),
                     f(played, 2),
                     f(mean([r["wash_per_player_day"] for r in recs])),
                     f(100 * mean([r["zero_reck_frac"] for r in recs]), 1) + "%",
                     f(100 * mean([r["jim_uptime"] for r in recs]), 1) + "%"])
    table(["special deck", "cards", "mean days", "median", "p90", "cards played/game",
           "wash ev/pl/day", "dead reck %", "Jimothy uptime"], rows)

    print("### 4f. Deck size vs subsystem engagement (uniform, P=4 and P=6, MEAN)\n")
    rows = []
    for P in (4, 6):
        for k in (1, 2, 3, 4, 5):
            recs = _cache(a, "MEAN", P, special_deck=_mk({}, k))
            rows.append([P, k, 7 * k,
                         f(mean([r["draw_events"] for r in recs]), 2),
                         f(mean([sum(r["specials_played"].values()) for r in recs]), 2),
                         f(mean([r["days"] for r in recs]), 2)])
    table(["P", "copies per card", "deck size", "draw events/game", "cards played/game",
           "mean days"], rows)


# --------------------------------------------------------------------------------------
# 5. NEW CARDS
# --------------------------------------------------------------------------------------

def cmd_newcards(a):
    print("\n## 5. THE TWO NEW CARDS\n")

    print("### 5a. Sanitizer -- is it played, and does it do anything?\n")
    rows = []
    for pol in ("GREEDY", "MEAN", "CLUSTERING"):
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            pl = mean([r["specials_played"]["Sanitizer"] for r in recs])
            rows.append([pol, P, f(pl, 2),
                         f(mean([r["sanitizer_saved"] for r in recs]), 2),
                         f(mean([r["sanitizer_saved"] for r in recs]) / max(0.001, pl), 2)])
    table(["policy", "P", "Sanitizer plays/game", "items rescued/game",
           "items rescued per play"], rows)

    print("### 5b. Sanitizer scope: machine-wide (default) vs owner-only (P=4, MEAN)\n")
    rows = []
    for P in PLAYER_COUNTS:
        for label, over in (("machine-wide", {}), ("owner-only", {"sanitizer_owner_only": True})):
            recs = _cache(a, "MEAN", P, **over)
            rows.append([P, label, f(mean([r["days"] for r in recs]), 2),
                         f(mean([r["specials_played"]["Sanitizer"] for r in recs]), 2),
                         f(mean([r["sanitizer_saved"] for r in recs]), 2),
                         f(mean([r["wash_per_player_day"] for r in recs]))])
    table(["P", "scope", "mean days", "plays/game", "items rescued/game",
           "wash ev/pl/day"], rows)

    print("### 5c. Coin -- one-shot (default) vs persistent second key\n")
    rows = []
    for P in PLAYER_COUNTS:
        for label, over in (("one-shot", {}), ("persistent", {"coin_persistent": True})):
            recs = _cache(a, "MEAN", P, **over)
            fair = 100.0 / P
            played = won = 0
            for r in recs:
                ws = set(r["winners"])
                for pid in range(P):
                    if r["specials_by_player"][pid]["Coin"] > 0:
                        played += 1
                        if pid in ws:
                            won += 1
            rows.append([P, label, f(mean([r["days"] for r in recs]), 2),
                         f(mean([r["specials_played"]["Coin"] for r in recs]), 2),
                         f(mean([r["coin_toggles"] for r in recs]), 2),
                         f(mean([r["key_toggles"] for r in recs]), 2),
                         f(fair, 1) + "%",
                         f(100 * won / max(1, played), 1) + "%",
                         f(100 * won / max(1, played) - fair, 2)])
    table(["P", "Coin reading", "mean days", "Coin plays/game", "coin toggles/game",
           "key toggles/day", "fair share", "win% of a Coin player", "edge (pp)"], rows)

    print("### 5d. Coin removed entirely, as a control (MEAN)\n")
    rows = []
    for P in PLAYER_COUNTS:
        base = _cache(a, "MEAN", P)
        no = _cache(a, "MEAN", P, special_deck=_mk({"Coin": 0}))
        rows.append([P, f(mean([r["days"] for r in base]), 2),
                     f(mean([r["days"] for r in no]), 2),
                     f(mean([r["machines_off_days"] for r in base]), 2),
                     f(mean([r["machines_off_days"] for r in no]), 2)])
    table(["P", "mean days with Coin", "without Coin", "machine-days OFF/day with",
           "without"], rows)


# --------------------------------------------------------------------------------------
# 6. JIMOTHY
# --------------------------------------------------------------------------------------

def cmd_jimothy(a):
    print("\n## 6. JIMOTHY -- fright deleted; only Snacc moves him, only "
          "Animal control removes him\n")
    for pol in ("GREEDY", "MEAN"):
        rows = []
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            squats, stints = [], []
            exits = {}
            for r in recs:
                squats.extend(r["jim_squats"])
                stints.extend(r["jim_stints"])
                for k, v in r["jim_exit"].items():
                    exits[k] = exits.get(k, 0) + v
            M = P + 1
            up = mean([r["jim_uptime"] for r in recs])
            tot = sum(exits.values()) or 1
            rows.append([pol, P, M, f(100 * up, 1) + "%", f(M - up, 2),
                         f(mean([r["jim_machine_days"] for r in recs]), 2),
                         f(mean(stints), 2) if stints else "n/a",
                         pct(stints, 0.5), pct(stints, 0.9), pct(stints, 0.99),
                         max(stints) if stints else 0,
                         f(mean([r["jim_hostage_item_days"] for r in recs]), 2),
                         " ".join("%s %d%%" % (k, round(100 * v / tot))
                                  for k, v in sorted(exits.items()) if v)])
        table(["policy", "P", "M", "uptime (% of days)", "effective machines",
               "machine-days removed/game", "mean STINT (days in play)", "median", "p90",
               "p99", "worst", "hostage item-days/game", "how the stint ends"], rows)

    print("### 6b. Squat length on a single machine (Snacc relocation splits a stint)\n")
    rows = []
    for P in PLAYER_COUNTS:
        recs = _cache(a, "MEAN", P)
        sq = []
        for r in recs:
            sq.extend(r["jim_squats"])
        rows.append([P, f(mean(sq), 2) if sq else "n/a", pct(sq, 0.5), pct(sq, 0.9),
                     pct(sq, 0.99), max(sq) if sq else 0,
                     f(mean([r["jim_relocations"] for r in recs]), 2),
                     f(mean([r["jim_released"] for r in recs]), 2)])
    table(["P", "mean squat", "median", "p90", "p99", "max", "Snacc relocations/game",
           "hostages released/game"], rows)

    print("### 6c. Is he oppressive? Games with and without Jimothy in the event deck\n")
    rows = []
    for P in PLAYER_COUNTS:
        base = _cache(a, "MEAN", P)
        no = _cache(a, "MEAN", P, event_deck={"Gang": 1, "Circuit break": 1})
        d1 = [r["days"] for r in base]
        d0 = [r["days"] for r in no]
        rows.append([P, f(mean(d1), 2), f(mean(d0), 2), f(mean(d1) - mean(d0), 2),
                     pct(d1, 0.9), pct(d0, 0.9),
                     f(100 * mean([r["jim_uptime"] for r in base]), 1) + "%",
                     f(mean([r["ac_blanks"] for r in base]), 3)])
    table(["P", "mean days with Jimothy", "without", "cost in days", "p90 with",
           "p90 without", "uptime", "Animal control blanks/game"], rows)


# --------------------------------------------------------------------------------------
# 7. EVENTS
# --------------------------------------------------------------------------------------

def cmd_events(a):
    print("\n## 7. EVENTS -- Circuit break and Gang\n")

    print("### 7a. Event pressure\n")
    rows = []
    for P in PLAYER_COUNTS:
        recs = _cache(a, "MEAN", P)
        rows.append([P, f(100 * mean([r["event_day_frac"] for r in recs]), 1) + "%",
                     f(mean([r["cb_days"] for r in recs]), 2),
                     f(100 * mean([r["gang_fired"] for r in recs]), 1) + "%",
                     f(mean([r["gang_day"] for r in recs if r["gang_day"]]), 2),
                     f(mean([r["ac_blanks"] for r in recs]), 2)])
    table(["P", "days with an event", "Circuit breaks/game", "games where Gang fires",
           "mean day Gang fires", "Animal control blanks/game"], rows)

    print("### 7b. CIRCUIT BREAK -- recovery scales with machine count\n")
    rows = []
    for P in PLAYER_COUNTS:
        recs = _cache(a, "MEAN", P)
        rec = []
        for r in recs:
            rec.extend(r["cb_recovery"])
        rows.append([P, P + 1, f(mean([r["cb_days"] for r in recs]), 2),
                     f(mean(rec), 2) if rec else "n/a",
                     pct(rec, 0.5), pct(rec, 0.9), max(rec) if rec else 0,
                     f(mean([r["cb_lost_machine_days"] for r in recs]), 2),
                     f(mean([r["cb_lost_machine_days"] / max(1, r["days"]) for r in recs]), 3)])
    table(["P", "M", "Circuit breaks/game", "mean days to full recovery", "median", "p90",
           "worst", "machine-days lost OFF per game", "per day"], rows)

    print("### 7c. Circuit break removed, as a control (MEAN)\n")
    rows = []
    for P in PLAYER_COUNTS:
        base = _cache(a, "MEAN", P)
        no = _cache(a, "MEAN", P, event_deck={"Gang": 1, "Jimothy": 1, "Animal control": 1})
        rows.append([P, f(mean([r["days"] for r in base]), 2),
                     f(mean([r["days"] for r in no]), 2),
                     f(mean([r["days"] for r in base]) - mean([r["days"] for r in no]), 2),
                     f(mean([r["wash_per_player_day"] for r in base])),
                     f(mean([r["wash_per_player_day"] for r in no]))])
    table(["P", "mean days with Circuit break", "without", "cost in days",
           "wash ev/pl/day with", "without"], rows)

    print("### 7d. GANG -- the cost of permanently losing a washer\n")
    rows = []
    for P in PLAYER_COUNTS:
        base = _cache(a, "MEAN", P)
        no = _cache(a, "MEAN", P,
                    event_deck={"Circuit break": 1, "Jimothy": 1, "Animal control": 1})
        fired = [r for r in base if r["gang_fired"]]
        rows.append([P, P + 1, f(100 * len(fired) / len(base), 1) + "%",
                     f(mean([r["gang_day"] for r in fired]), 2) if fired else "n/a",
                     f(mean([r["gang_items"] for r in fired]), 2) if fired else "n/a",
                     f(mean([r["days"] for r in base]), 2),
                     f(mean([r["days"] for r in no]), 2),
                     f(mean([r["days"] for r in base]) - mean([r["days"] for r in no]), 2),
                     f(mean([r["occ"] for r in base])), f(mean([r["occ"] for r in no]))])
    table(["P", "M", "games where Gang fires", "mean day it fires", "items returned",
           "mean days with Gang", "without", "cost in days", "occ with", "occ without"],
          rows)

    print("### 7e. Occupancy before and after Gang, within Gang games (CLUSTERING)\n")
    rows = []
    for P in PLAYER_COUNTS:
        recs = [r for r in _cache(a, "CLUSTERING", P) if r["gang_fired"]]
        if not recs:
            continue
        rows.append([P, P + 1, len(recs), f(mean([r["live_machines"] for r in recs]), 2),
                     f(mean([r["occ"] for r in recs])),
                     f(mean([r["peak_at_cap_frac"] for r in recs]) * 100, 1) + "%"])
    table(["P", "M at start", "games", "mean LIVE machines/day", "mean occ",
           "machine-days touching capacity"], rows)


# --------------------------------------------------------------------------------------
# 8. SEAT ORDER
# --------------------------------------------------------------------------------------

def cmd_seat(a):
    print("\n## 8. SEAT ORDER\n")
    for label, over in (("turn order fixed (v8 literal)", {}),
                        ("keyholder acts first", {"keyholder_first": True})):
        rows = []
        for pol in CORE_POLICIES:
            for P in PLAYER_COUNTS:
                recs = _cache(a, pol, P, **over)
                wins = [0] * P
                n = 0
                for r in recs:
                    for w in r["winners"]:
                        wins[w] += 1
                    n += len(r["winners"])
                exp = 100.0 / P
                rows.append([label, pol, P, f(exp, 1) + "%",
                             " ".join(f(100 * w / max(1, n), 1) for w in wins),
                             f(max(100 * w / max(1, n) for w in wins) - exp, 2),
                             f(100 * mean([r["n_winners"] for r in recs]) / P, 1) + "%",
                             _chisq(wins)])
        table(["variant", "policy", "P", "fair share", "win % by seat (1..P)",
               "max seat edge (pp)", "shared-win rate", "chi-sq"], rows)

    print("### 8b. Simultaneous victories\n")
    rows = []
    for pol in ("GREEDY", "MEAN", "CLUSTERING"):
        for P in PLAYER_COUNTS:
            recs = _cache(a, pol, P)
            multi = sum(1 for r in recs if r["n_winners"] > 1)
            rows.append([pol, P, f(100 * multi / len(recs), 2) + "%",
                         f(mean([r["n_winners"] for r in recs]), 3),
                         max(r["n_winners"] for r in recs)])
    table(["policy", "P", "games with >1 winner", "mean winners/game", "max winners"],
          rows)


# --------------------------------------------------------------------------------------
# 9. KEY HAZARD (the retired NAIVEKEY policy, measured on purpose)
# --------------------------------------------------------------------------------------

def cmd_keyhazard(a):
    print("\n## 9. THE OFF-DRIFT HAZARD (retired NAIVEKEY policy, measured deliberately)\n")
    print("A keyholder who values an ON-but-empty machine at zero never switches one back\n"
          "on: it pays nothing on the day they spend the action. Nothing else in the rules\n"
          "restores power except the Coin. This is what the archived v5 run's NAIVEKEY\n"
          "numbers were actually measuring.\n")
    rows = []
    for P in PLAYER_COUNTS:
        for pol in ("GREEDY", "NAIVEKEY"):
            recs = _cache(a, pol, P)
            d = [r["days"] for r in recs]
            rows.append([P, pol, f(mean(d), 2), pct(d, 0.5), pct(d, 0.9), pct(d, 0.99),
                         max(d), sum(r["capped"] for r in recs),
                         f(mean([r["machines_off_days"] for r in recs]), 2),
                         f(mean([r["L"] for r in recs]))])
    table(["P", "policy", "mean days", "median", "p90", "p99", "max", "capped",
           "machine-days OFF per day", "realized L"], rows)

    print("### 9b. Does the Coin rescue a myopic table?\n")
    rows = []
    for P in PLAYER_COUNTS:
        for label, over in (("no Coin in deck", {"special_deck": _mk({"Coin": 0})}),
                            ("Coin x2 (default)", {}),
                            ("Coin x4", {"special_deck": _mk({"Coin": 4})})):
            recs = _cache(a, "NAIVEKEY", P, **over)
            d = [r["days"] for r in recs]
            rows.append([P, label, f(mean(d), 2), pct(d, 0.9),
                         f(mean([r["machines_off_days"] for r in recs]), 2)])
    table(["P", "variant", "mean days", "p90", "machine-days OFF per day"], rows)


# --------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    cmds = {"main": cmd_main, "occupancy": cmd_occupancy, "contention": cmd_contention,
            "deck": cmd_deck, "newcards": cmd_newcards, "jimothy": cmd_jimothy,
            "events": cmd_events, "seat": cmd_seat, "keyhazard": cmd_keyhazard}
    ap.add_argument("cmd", choices=sorted(cmds) + ["all"])
    ap.add_argument("-n", type=int, default=10000)
    ap.add_argument("--seed0", type=int, default=0)
    ap.add_argument("--jobs", type=int, default=10)
    a = ap.parse_args()
    if a.cmd == "all":
        for k in ("main", "occupancy", "contention", "jimothy", "events", "newcards",
                  "deck", "seat", "keyhazard"):
            cmds[k](a)
    else:
        cmds[a.cmd](a)


if __name__ == "__main__":
    main()
