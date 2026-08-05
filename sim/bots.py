"""
Laundromat -- bot policies.  BRIEF v8.

Strictly separated from rules.py: a policy may READ state and must return a legal move,
but never mutates state (the one exception is a scratch mutation that is undone before
returning).  All randomness comes from st["rng"].

Policies
--------
RANDOM      Uniform over legal moves.  Loading is mandatory under v8, so RANDOM can no
            longer decline; it only picks badly.
GREEDY      Loads into whichever machine maximises its OWN expected washes this
            reckoning, ignoring what other players will do next.  Never plays a purely
            destructive card, because destruction yields it no washes.
CAUTIOUS    As GREEDY, but avoids machines containing a shoe or anything that would
            taint its item -- unless mandatory loading leaves it no choice.
MEAN        As GREEDY, plus it plays the destructive cards (Coloring, Bleach) and uses
            the face-4 displacement offensively.  A deck-composition study needs an
            agent that actually fires the destructive half of the deck.
CLUSTERING  NEW in this run.  As GREEDY, but with a standing bonus for loading into a
            machine that already holds items -- a model of the human table behaviour the
            designer reports (players converge on the same washer rather than spreading
            out).  Built specifically to test whether bot spreading, not the rules, was
            hiding the occupancy right tail.

RETIRED
-------
NAIVEKEY (a GREEDY variant with board_value = 0) is DELETED.  Its long games came from
an "OFF-drift deadlock" -- a myopic keyholder switching machines off and never back on --
and its length figures were reported to the designer as if they were representative play.
They were not.  The underlying hazard is real and is now covered by a dedicated
sensitivity run (`run.py keyhazard`) rather than by a headline policy.
"""

from rules import (BLANKET, SHOES, SOCKS, UNDERWEAR, ATTACHING, SPECIALS,
                   machine_accepts, machine_washing)


def _value(item, washing, blanket_here):
    """Progress value of a wash verdict: socks beside a blanket pay half per event."""
    if not washing:
        return 0.0
    if item.typ == SOCKS and blanket_here and item.wash_count == 0:
        return 0.5
    return 1.0


def _net_scope(st, mi, pid, extra):
    """Would `extra` be protected by a Wash net played this turn?  Returns key or None."""
    if extra is None or extra.typ != UNDERWEAR:
        return None
    if st.get("_net_turn") == (pid, mi):
        return extra.key()
    return None


def _verdicts(st, mi, pid, extra=None, drop=None):
    m = st["machines"][mi]
    k = _net_scope(st, mi, pid, extra)
    if k is not None:
        m["net"].add(k)
        try:
            return machine_washing(st, m, extra=extra, drop=drop)
        finally:
            m["net"].discard(k)
    return machine_washing(st, m, extra=extra, drop=drop)


def _runnable(st, mi):
    m = st["machines"][mi]
    return (not m["dead"]) and m["on"] and (not m["jimothy"])


def own_score(st, mi, pid, extra=None):
    """Progress this player would bank if machine `mi` reckoned right now."""
    m = st["machines"][mi]
    if not _runnable(st, mi):
        return 0.0
    items = m["items"] if extra is None else m["items"] + [extra]
    if not items:
        return 0.0
    blanket_here = any(x.typ == BLANKET for x in items)
    verd = _verdicts(st, mi, pid, extra=extra)
    return sum(_value(x, verd.get(x.iid, False), blanket_here)
               for x in items if x.owner == pid)


def table_score(st, mi, pid, extra=None):
    """(own progress, best single opponent's progress) if machine `mi` reckoned now."""
    m = st["machines"][mi]
    if not _runnable(st, mi):
        return (0.0, 0.0)
    items = m["items"] if extra is None else m["items"] + [extra]
    if not items:
        return (0.0, 0.0)
    blanket_here = any(x.typ == BLANKET for x in items)
    verd = _verdicts(st, mi, pid, extra=extra)
    own = 0.0
    opp = {}
    for x in items:
        v = _value(x, verd.get(x.iid, False), blanket_here)
        if x.owner == pid:
            own += v
        else:
            opp[x.owner] = opp.get(x.owner, 0.0) + v
    return (own, max(opp.values()) if opp else 0.0)


def own_score_without(st, mi, pid, item):
    m = st["machines"][mi]
    if not _runnable(st, mi):
        return 0.0
    rest = [x for x in m["items"] if x.iid != item.iid]
    if not rest:
        return 0.0
    blanket_here = any(x.typ == BLANKET for x in rest)
    verd = machine_washing(st, m, drop=set([item.iid]))
    return sum(_value(x, verd.get(x.iid, False), blanket_here)
               for x in rest if x.owner == pid)


def table_score_without(st, mi, pid, item):
    m = st["machines"][mi]
    if not _runnable(st, mi):
        return (0.0, 0.0)
    rest = [x for x in m["items"] if x.iid != item.iid]
    if not rest:
        return (0.0, 0.0)
    blanket_here = any(x.typ == BLANKET for x in rest)
    verd = machine_washing(st, m, drop=set([item.iid]))
    own = 0.0
    opp = {}
    for x in rest:
        v = _value(x, verd.get(x.iid, False), blanket_here)
        if x.owner == pid:
            own += v
        else:
            opp[x.owner] = opp.get(x.owner, 0.0) + v
    return (own, max(opp.values()) if opp else 0.0)


# --------------------------------------------------------------------------------------

def special_targets(st, pid, name):
    """All legal targets for a ready special card.  Empty list => unplayable today."""
    ms = st["machines"]
    live = [i for i, m in enumerate(ms) if not m["dead"]]
    if name in ATTACHING:
        return [i for i in live if not ms[i]["jimothy"]]
    if name == "Snacc":                                     # [A-W09]
        j = st["jimothy_at"]
        if j is None:
            return []
        return [i for i in live if i != j]
    if name == "Coin":
        return [(i, not ms[i]["on"]) for i in live]
    return []


class Policy(object):
    name = "BASE"

    def choose_load(self, st, pid):
        raise NotImplementedError

    def choose_displace(self, st, pid):
        return None

    def choose_special(self, st, pid):
        return None

    def choose_key(self, st, pid, coin=False):
        return None

    def choose_keep(self, st, pid, a, b):
        return a

    def choose_gang(self, st, pid, cands):
        return cands[0]

    def choose_jimothy(self, st, pid, cands):
        return cands[0]

    # ---- shared helpers ------------------------------------------------------------
    @staticmethod
    def legal_loads(st, pid):
        hand = st["players"][pid]["hand"]
        out = []
        for mi in range(len(st["machines"])):
            for x in hand:
                if machine_accepts(st, mi, x):
                    out.append((x, mi))
        return out

    @staticmethod
    def legal_displacements(st, pid):
        out = []
        ms = st["machines"]
        for src in range(len(ms)):
            if ms[src]["jimothy"] or ms[src]["dead"]:
                continue
            for x in ms[src]["items"]:
                for dst in range(len(ms)):
                    if dst == src:
                        continue
                    if machine_accepts(st, dst, x):
                        out.append((src, x, dst))
        return out


# --------------------------------------------------------------------------------------

class RandomPolicy(Policy):
    name = "RANDOM"

    def choose_load(self, st, pid):
        opts = self.legal_loads(st, pid)
        if not opts:
            return None
        return st["rng"].choice(opts)

    def choose_displace(self, st, pid):
        opts = self.legal_displacements(st, pid)
        if not opts or st["rng"].random() < 0.5:
            return None
        return st["rng"].choice(opts)

    def choose_special(self, st, pid):
        p = st["players"][pid]
        rng = st["rng"]
        opts = []
        for name in set(p["ready"]):
            for tgt in special_targets(st, pid, name):
                opts.append((name, tgt))
        if not opts or rng.random() < 0.3:
            return None
        return rng.choice(opts)

    def choose_key(self, st, pid, coin=False):
        rng = st["rng"]
        if rng.random() < 0.5:
            return None
        live = [i for i, m in enumerate(st["machines"]) if not m["dead"]]
        if not live:
            return None
        mi = rng.choice(live)
        return (mi, not st["machines"][mi]["on"])

    def choose_keep(self, st, pid, a, b):
        return st["rng"].choice([a, b])

    def choose_gang(self, st, pid, cands):
        return st["rng"].choice(cands)

    def choose_jimothy(self, st, pid, cands):
        return st["rng"].choice(cands)


# --------------------------------------------------------------------------------------

class GreedyPolicy(Policy):
    name = "GREEDY"
    avoid_shoes = False
    offensive = False
    cluster_bonus = 0.0
    board_value = 0.6

    # ---- loading -------------------------------------------------------------------
    def _load_candidates(self, st, pid, filtered=True):
        hand = st["players"][pid]["hand"]
        out = []
        seen = set()
        for x in hand:
            k = (x.typ, x.shade, x.wash_count)
            if k in seen:
                continue
            seen.add(k)
            for mi in range(len(st["machines"])):
                if not machine_accepts(st, mi, x):
                    continue
                if filtered and self.avoid_shoes and self._risky(st, mi, pid, x):
                    continue
                base = own_score(st, mi, pid)
                after = own_score(st, mi, pid, extra=x)
                score = after - base
                if self.cluster_bonus:
                    score += self.cluster_bonus * len(st["machines"][mi]["items"])
                out.append((score, x, mi))
        return out

    def _risky(self, st, mi, pid, item):
        m = st["machines"][mi]
        if not _runnable(st, mi):
            return True
        for other in m["items"]:
            if other.typ == SHOES:
                return True
        if m["items"]:
            verd = _verdicts(st, mi, pid, extra=item)
            if not verd.get(item.iid, False):
                return True
        return False

    def choose_load(self, st, pid):
        cands = self._load_candidates(st, pid)
        if not cands:
            cands = self._load_candidates(st, pid, filtered=False)
        if not cands:
            return None                       # board lock: nothing accepts anything
        best = max(c[0] for c in cands)
        top = [c for c in cands if c[0] == best]
        _s, x, mi = st["rng"].choice(top)
        return (x, mi)

    # ---- displacement ---------------------------------------------------------------
    def choose_displace(self, st, pid):
        opts = self.legal_displacements(st, pid)
        if not opts:
            return None
        best = None
        for src, x, dst in opts:
            b_own = own_score(st, src, pid) + own_score(st, dst, pid)
            a_src = own_score_without(st, src, pid, x)
            a_dst = own_score(st, dst, pid, extra=x)
            gain = (a_src + a_dst) - b_own
            if self.offensive:
                o_b = table_score(st, src, pid)[1] + table_score(st, dst, pid)[1]
                o_a = (table_score_without(st, src, pid, x)[1]
                       + table_score(st, dst, pid, extra=x)[1])
                gain += (o_b - o_a)
            if best is None or gain > best[0]:
                best = (gain, (src, x, dst))
        if best is None or best[0] <= 0.0:
            return None
        return best[1]

    # ---- specials --------------------------------------------------------------------
    def choose_special(self, st, pid):
        p = st["players"][pid]
        best = None
        for name in sorted(set(p["ready"])):
            for tgt in special_targets(st, pid, name):
                v = self._special_value(st, pid, name, tgt)
                if v is None:
                    continue
                if best is None or v > best[0]:
                    best = (v, name, tgt)
        if best is None or best[0] <= 0.0:
            return None
        return (best[1], best[2])

    def _special_value(self, st, pid, name, tgt):
        ms = st["machines"]
        if name == "Snacc":
            j = st["jimothy_at"]
            if j is None:
                return None
            mine = sum(1 for x in ms[j]["items"] if x.owner == pid)
            v = 0.5 * mine + 0.4          # freeing the machine is worth something
            if self.offensive:
                v += 0.3 * sum(1 for x in ms[tgt]["items"] if x.owner != pid)
            v -= 0.8 * sum(1 for x in ms[tgt]["items"] if x.owner == pid)
            # never park him where my own laundry is about to wash
            v -= own_score(st, tgt, pid)
            return v if v > 0 else None

        if name == "Coin":
            mi, on = tgt
            m = ms[mi]
            if m["dead"] or m["on"] == on:
                return None
            if on:
                m["on"] = True
                v = own_score(st, mi, pid) + (self.board_value if
                                              st["players"][pid]["hand"] else 0.0)
                m["on"] = False
                return v if v > 0 else None
            # turning OFF: protect my items that would be sent back
            cur = own_score(st, mi, pid)
            mine = sum(1.0 for x in m["items"] if x.owner == pid)
            v = (mine - cur) * 0.5
            if self.offensive:
                v += 0.5 * table_score(st, mi, pid)[1]
            return v if v > 0 else None

        if name == "Wash net":
            m = ms[tgt]
            if not _runnable(st, tgt):
                return None
            und = [x for x in st["players"][pid]["hand"] if x.typ == UNDERWEAR]
            if not und:
                return None
            if not machine_accepts(st, tgt, und[0]):
                return None
            has_other = any(x.typ != UNDERWEAR for x in m["items"])
            if not has_other:
                return None               # isolation is already satisfied; net wasted
            m["net"].add(und[0].key())
            try:
                v = machine_washing(st, m, extra=und[0]).get(und[0].iid, False)
            finally:
                m["net"].discard(und[0].key())
            return 1.0 if v else None

        if name in ("Bleach", "Coloring", "Color catcher", "Sanitizer"):
            m = ms[tgt]
            if not _runnable(st, tgt) or not m["items"]:
                return None
            before_own, before_opp = table_score(st, tgt, pid)
            m["cards"].append((name, pid))
            after_own, after_opp = table_score(st, tgt, pid)
            m["cards"].pop()
            gain = after_own - before_own
            if self.offensive:
                gain += (before_opp - after_opp)
            return gain if gain > 0 else None
        return None

    # ---- draw two, keep one ----------------------------------------------------------
    _KEEP_PRIOR = {"Sanitizer": 3.0, "Bleach": 2.5, "Coin": 2.4, "Wash net": 1.6,
                   "Color catcher": 1.2, "Coloring": 1.0, "Snacc": 0.6}

    def choose_keep(self, st, pid, a, b):
        def val(name):
            v = self._KEEP_PRIOR[name]
            if name == "Snacc" and st["jimothy_at"] is None:
                v = 0.15
            if name == "Coloring" and not self.offensive:
                v = 0.3
            if name == "Wash net":
                if not any(x.typ == UNDERWEAR for x in st["players"][pid]["hand"]):
                    v = 0.2
            if name == "Sanitizer":
                if not any(x.typ == SHOES for x in st["players"][pid]["hand"]):
                    v = 1.1
            return v
        return a if val(a) >= val(b) else b

    # ---- key --------------------------------------------------------------------------
    #
    # board_value: what an ON-but-empty machine is worth as future loading capacity.
    # At board_value = 0 the policy is myopic -- switching a machine ON pays nothing
    # today -- and the board drifts permanently OFF.  That degenerate variant is measured
    # separately (run.py keyhazard); it is NOT a headline policy.
    def choose_key(self, st, pid, coin=False):
        ms = st["machines"]
        hand = st["players"][pid]["hand"]
        best = None
        for mi, m in enumerate(ms):
            if m["dead"] or m["jimothy"]:
                continue
            if m["on"]:
                cur = own_score(st, mi, pid)
                mine = sum(1.0 for x in m["items"] if x.owner == pid)
                gain = (mine - cur) * 0.5
                if self.offensive:
                    gain += 0.5 * table_score(st, mi, pid)[1]
                gain -= self.board_value if hand else 0.0
                cand = (gain, (mi, False))
            else:
                m["on"] = True
                gain = own_score(st, mi, pid)
                m["on"] = False
                if hand:
                    gain += self.board_value
                cand = (gain, (mi, True))
            if best is None or cand[0] > best[0]:
                best = cand
        if best is None or best[0] <= 0.0:
            return None
        return best[1]

    # ---- event choices -----------------------------------------------------------------
    def choose_gang(self, st, pid, cands):
        """Shoot the washer that costs me least and my opponents most."""
        best = None
        for mi in cands:
            m = st["machines"][mi]
            own = sum(1 for x in m["items"] if x.owner == pid)
            opp = len(m["items"]) - own
            score = opp - 2.0 * own
            if best is None or score > best[0]:
                best = (score, mi)
        return best[1]

    def choose_jimothy(self, st, pid, cands):
        """Park him where he freezes the most opponent laundry and none of mine."""
        best = None
        for mi in cands:
            m = st["machines"][mi]
            own = sum(1 for x in m["items"] if x.owner == pid)
            opp = len(m["items"]) - own
            score = 1.5 * opp - 2.5 * own - 0.1 * (1 if m["on"] else 0)
            if best is None or score > best[0]:
                best = (score, mi)
        return best[1]


class CautiousPolicy(GreedyPolicy):
    name = "CAUTIOUS"
    avoid_shoes = True


class MeanPolicy(GreedyPolicy):
    name = "MEAN"
    offensive = True


class ClusteringPolicy(GreedyPolicy):
    """Deliberately contests machines: a standing bonus for joining an occupied washer.

    This models the human table behaviour the designer reports -- players converge on a
    washer rather than spreading across the board -- and is the control for the question
    "was the low measured occupancy a property of the rules or of the bots?"
    """
    name = "CLUSTERING"
    cluster_bonus = 0.40


class NaiveKeyPolicy(GreedyPolicy):
    """RETIRED.  Kept only so the OFF-drift hazard can be measured on demand by
    `run.py keyhazard`.  Never appears in headline tables."""
    name = "NAIVEKEY"
    board_value = 0.0


POLICIES = {
    "RANDOM": RandomPolicy,
    "GREEDY": GreedyPolicy,
    "CAUTIOUS": CautiousPolicy,
    "MEAN": MeanPolicy,
    "CLUSTERING": ClusteringPolicy,
    "NAIVEKEY": NaiveKeyPolicy,
}


def make(name):
    return POLICIES[name]()
