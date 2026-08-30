"""
Unit tests for the Laundromat engine.  BRIEF v8.

The worked-example tables of rules-v0.2/v0.3 §5.13 are still the backbone of this suite.
This header records, explicitly, which of those rows v8 INVALIDATES rather than silently
dropping them.  The same list appears in design/balance-report.md.

TABLE A -- 28 rows.  22 survive verbatim.  Invalidated:
  A6, A7, A8   VOID -- bedding is deleted from the game.  The two-wash mechanic they
               taught now lives on socks-beside-a-blanket and is re-encoded as S1-S5.
  A24, A25     VOID -- the Handwash basket is deleted.  Their lessons (a basket defuses
               a tier-1 bomb; a basket defuses a crowd) have no successor: v8 has no
               extraction effect at all.  Sanitizer defuses tier 1-2 *in place*, which is
               a different and weaker thing, tested as N1-N4.
  A26          VOID -- basket + bedding, both components deleted.
  A14, A15     AMENDED -- Wash net still waives isolation and still loses to the ladder,
               but protection is now per-CARD (same-turn loads only), not per-owner.
               Re-encoded as W1-W3; A15's lesson survives unchanged.
  A5, A23      SURVIVE and gain a companion: a blanket may now share with socks (S1).

TABLE B -- 18 rows.  Invalidated:
  B2   AMENDED.  Electricity -> Circuit break.  The observable outcome on the day is
       almost identical (nothing reckons, contents retained) but the mechanism and the
       persistence are different: machines stay off until a keyholder or Coin restores
       them, one per day.  Re-encoded as C1-C3.
  B3   VOID.  Gang is no longer a board wipe.  It destroys ONE washer permanently.
       Re-encoded as G1-G4.
  B8   VOID.  The basket was "the only way to convert a hostage item into a wash."
       In v8 there is no such way at all.  Recorded as a deliberate consequence.
  B12  VOID.  Gang + fright.  Fright is deleted; Gang does not affect Jimothy.
  B13  VOID.  Electricity + fright, same reason.
  B14  VOID.  A second Jimothy card cannot exist -- the deck holds exactly one and it
       sits on the board while he is in play.
  B17  VOID.  The rotation-completion victory rule is deleted; victory is immediate.
  B18  VOID.  A second finisher no longer "ties and loses" -- simultaneous victory is
       explicitly allowed.  Re-encoded as V1-V3.
  B11  AMENDED.  Animal control's effect is unchanged but it is now an EVENT card, so it
       fires automatically on reveal instead of being played from hand.
  B1, B4, B5, B6, B7, B9, B10, B15, B16 survive.
"""

import unittest
import rules as R
import bots


OWNERS = {"A": 0, "B": 1, "C": 2, "D": 3}


def it(spec, wash_count=0):
    """'A-D-shoes' -> Item."""
    who, sh, typ = spec.split("-")
    x = R.Item((OWNERS[who], R.TYPE_BY_NAME[typ], 0 if sh == "D" else 1),
               OWNERS[who], R.TYPE_BY_NAME[typ], 0 if sh == "D" else 1)
    x.wash_count = wash_count
    return x


def resolve(items, cards=(), net=(), bleach_kills=False, san_owner_only=False):
    """Returns the set of spec-strings that wash."""
    key = tuple(x.key() for x in items)
    m = {"items": list(items), "on": True, "cards": list(cards), "jimothy": False,
         "dead": False, "net": set(net), "peak": 0}
    verd = R.machine_verdicts(key, R.cards_key_of(m), bleach_kills, san_owner_only)
    return set(str(x) for i, x in enumerate(items) if verd[i])


def spec(s):
    who, sh, typ = s.split("-")
    return "%d-%s-%s" % (OWNERS[who], sh, typ)


def specs(*ss):
    return set(spec(s) for s in ss)


class _Scripted(bots.Policy):
    """A policy that answers event choices deterministically, for day-level tests."""
    def __init__(self, gang=0, jim=0):
        self._gang, self._jim = gang, jim

    def choose_load(self, st, pid):
        return None

    def choose_gang(self, st, pid, cands):
        return self._gang if self._gang in cands else cands[0]

    def choose_jimothy(self, st, pid, cands):
        return self._jim if self._jim in cands else cands[0]


def rig(players=3, machines=4, **cfg_over):
    cfg = R.default_config(players, machines=machines, **cfg_over)
    st = R.new_game(cfg, 1)
    for m in st["machines"]:
        m["items"], m["cards"], m["on"], m["jimothy"], m["dead"] = [], [], True, False, False
        m["net"] = set()
    for pid, p in enumerate(st["players"]):
        # a single unwashed placeholder, so "clean == must_wash" is not vacuously true
        p["hand"], p["clean"] = [], set()
        p["must_wash"] = set([(pid, R.PANTS, 0)])
    return st


def fire(st, ev, drawer=0, gang=0, jim=0):
    """Draw `ev` off the event deck the way phase_roll would, then resolve it."""
    if ev in st["event_deck"]:
        st["event_deck"].remove(ev)
    st["revealed_event"] = ev
    st["event_drawer"] = drawer
    R.phase_event(st, _Scripted(gang=gang, jim=jim))


def put(st, mi, item):
    st["machines"][mi]["items"].append(item)
    p = st["players"][item.owner]
    p["hand"] = [x for x in p["hand"] if x.iid != item.iid]
    p["must_wash"].add(item.iid)


def hand(st, pid, item):
    st["players"][pid]["hand"].append(item)
    st["players"][pid]["must_wash"].add(item.iid)


# --------------------------------------------------------------------------------------
# TABLE A -- machine reckoning (surviving rows)
# --------------------------------------------------------------------------------------

class TableA(unittest.TestCase):

    def test_A01_dark_shoes_taint_everything(self):
        self.assertEqual(resolve([it("A-D-shoes"), it("B-L-shirts"), it("C-D-pants")]),
                         specs("A-D-shoes"))

    def test_A02_tier2_inversion(self):
        self.assertEqual(resolve([it("A-L-shoes"), it("B-D-shirts")]), specs("A-L-shoes"))

    def test_A03_ordinary_dark_wins(self):
        self.assertEqual(resolve([it("A-D-shirts"), it("A-D-pants"), it("B-L-hats")]),
                         specs("A-D-shirts", "A-D-pants"))

    def test_A04_light_only(self):
        self.assertEqual(resolve([it("A-L-shirts"), it("B-L-pants")]),
                         specs("A-L-shirts", "B-L-pants"))

    def test_A05_blanket_alone_washes_on_tier3(self):
        self.assertEqual(resolve([it("A-D-blanket")]), specs("A-D-blanket"))

    def test_A09_crowding_beats_tier1_at_capacity(self):
        items = [it("A-D-shoes"), it("B-D-shoes"), it("C-D-shoes"), it("D-L-shirts")]
        self.assertEqual(len(items), 4, "capacity 4 boundary case")
        self.assertEqual(resolve(items), set())

    def test_A10_crowding_is_type_only(self):
        self.assertEqual(resolve([it("A-D-shirts"), it("A-L-shirts"), it("B-D-shirts")]),
                         set())

    def test_A10b_alternative_type_plus_shade_reading_would_not_fire(self):
        items = [it("A-D-shirts"), it("A-L-shirts"), it("B-D-shirts")]
        by_ts = {}
        for x in items:
            by_ts[(x.typ, x.shade)] = by_ts.get((x.typ, x.shade), 0) + 1
        self.assertTrue(max(by_ts.values()) < 3)

    def test_A11_all_underwear_both_dark(self):
        self.assertEqual(resolve([it("A-D-underwear"), it("B-D-underwear")]),
                         specs("A-D-underwear", "B-D-underwear"))

    def test_A12_shade_precedence_inside_linen(self):
        self.assertEqual(resolve([it("A-D-underwear"), it("B-L-underwear")]),
                         specs("A-D-underwear"))

    def test_A13_self_inflicted_isolation(self):
        self.assertEqual(resolve([it("A-D-underwear"), it("A-D-shirts")]),
                         specs("A-D-shirts"))

    def test_A16_crowding_applies_to_linen(self):
        self.assertEqual(resolve([it("A-D-underwear"), it("B-D-underwear"),
                                  it("C-D-underwear")]), set())

    def test_A17_bleach_does_not_disarm_shoes(self):
        self.assertEqual(resolve([it("A-D-shoes"), it("B-L-shirts")], [("Bleach", 0)]),
                         specs("A-D-shoes"))

    def test_A17b_sensitivity_bleach_kills_dark(self):
        self.assertEqual(resolve([it("A-D-shoes"), it("B-L-shirts")], [("Bleach", 0)],
                                 bleach_kills=True), specs("B-L-shirts"))

    def test_A18_bleach_is_ownership_blind(self):
        self.assertEqual(resolve([it("A-D-shirts"), it("B-L-shirts")], [("Bleach", 0)]),
                         specs("B-L-shirts"))

    def test_A19_bleach_then_crowding(self):
        self.assertEqual(resolve([it("A-L-shoes"), it("B-L-shoes"), it("C-L-shoes")],
                                 [("Bleach", 0)]), set())

    def test_A20_coloring(self):
        self.assertEqual(resolve([it("A-L-shirts"), it("B-L-pants"), it("C-L-hats")],
                                 [("Coloring", 0)]), specs("A-L-shirts"))

    def test_A21_coloring_plus_catcher(self):
        self.assertEqual(resolve([it("A-L-shirts"), it("B-L-pants"), it("C-L-hats")],
                                 [("Coloring", 0), ("Color catcher", 1)]),
                         specs("A-L-shirts", "B-L-pants"))

    def test_A22_two_colorings_total_loss(self):
        self.assertEqual(resolve([it("A-L-shirts"), it("B-L-pants"), it("C-L-hats")],
                                 [("Coloring", 0), ("Coloring", 1)]), set())

    def test_A23_full_stack(self):
        self.assertEqual(resolve([it("A-L-shirts"), it("B-D-shoes")],
                                 [("Bleach", 0), ("Coloring", 0), ("Color catcher", 1)]),
                         specs("B-D-shoes"))

    def test_A27_four_of_a_type_still_crowds(self):
        self.assertEqual(resolve([it("A-D-hats"), it("B-D-hats"), it("C-L-hats"),
                                  it("D-L-hats")]), set())

    def test_A28_empty_machine_is_noop(self):
        self.assertEqual(resolve([], [("Bleach", 0)]), set())

    def test_A_void_bedding_type_is_gone(self):
        self.assertNotIn("bedding", R.TYPE_NAMES)
        self.assertEqual(len(R.TYPE_NAMES), 7)
        self.assertEqual(len(R.ALL_TYPES) * 2, 14)

    def test_A_void_handwash_basket_is_gone(self):
        self.assertNotIn("Handwash basket", R.SPECIALS)


# --------------------------------------------------------------------------------------
# S -- socks and blankets (NEW v8)
# --------------------------------------------------------------------------------------

class SocksAndBlankets(unittest.TestCase):

    def test_S1_socks_may_join_a_blanket_machine(self):
        st = rig()
        put(st, 0, it("A-D-blanket"))
        self.assertTrue(R.machine_accepts(st, 0, it("B-D-socks")))
        self.assertFalse(R.machine_accepts(st, 0, it("B-D-hats")))
        self.assertFalse(R.machine_accepts(st, 0, it("B-D-blanket")))

    def test_S2_blanket_may_join_a_socks_machine(self):
        st = rig()
        put(st, 0, it("A-D-socks"))
        put(st, 0, it("B-L-socks"))
        self.assertTrue(R.machine_accepts(st, 0, it("C-D-blanket")))
        st2 = rig()
        put(st2, 0, it("A-D-hats"))
        self.assertFalse(R.machine_accepts(st2, 0, it("B-D-blanket")))

    def test_S3_blanket_plus_socks_resolves_by_the_ladder(self):
        # dark blanket takes tier 3; the light socks lose.
        self.assertEqual(resolve([it("A-D-blanket"), it("B-L-socks")]),
                         specs("A-D-blanket"))
        # both dark: both provisionally wash.
        self.assertEqual(resolve([it("A-D-blanket"), it("B-D-socks")]),
                         specs("A-D-blanket", "B-D-socks"))

    def test_S4_socks_beside_a_blanket_need_one_more_wash(self):
        st = rig()
        b, s = it("A-D-blanket"), it("B-D-socks")
        put(st, 0, b)
        put(st, 0, s)
        R.phase_reckon(st)
        self.assertIn(b.iid, st["players"][0]["clean"])         # blanket is clean
        self.assertEqual(s.wash_count, 1)
        self.assertNotIn(s.iid, st["players"][1]["clean"])      # socks are not
        self.assertIn(s, st["players"][1]["hand"])

    def test_S5_the_additional_wash_may_be_an_ordinary_one(self):
        st = rig()
        s = it("B-D-socks", wash_count=1)
        put(st, 0, s)
        R.phase_reckon(st)
        self.assertIn(s.iid, st["players"][1]["clean"])

    def test_S6_socks_without_a_blanket_are_clean_in_one_wash(self):
        st = rig()
        s = it("B-D-socks")
        put(st, 0, s)
        R.phase_reckon(st)
        self.assertIn(s.iid, st["players"][1]["clean"])

    def test_S7_blanket_with_one_companion_of_any_type_is_judged_normally(self):
        """REVISED v11.  This used to be a total loss: a blanket admitted socks only.

        A blanket now shares with exactly one item of ANY type, and that pair is read
        on the ladder like any other machine -- both are dark, neither outranks the
        other, so both wash.  What happens to the companion afterwards (it tangles and
        stays put) is a day-level concern and deliberately not visible here."""
        self.assertEqual(resolve([it("A-D-blanket"), it("B-D-hats")]),
                         specs("A-D-blanket", "B-D-hats"))

    def test_S8_a_blanket_with_two_companions_is_a_total_loss(self):
        """REVISED v11.  Was "three socks still crowd beside a blanket".

        Placement should never produce this board, so the filter stays a defensive
        assert -- it just guards a different boundary now: more than one companion
        rather than a companion that is not socks."""
        self.assertEqual(resolve([it("A-D-blanket"), it("A-D-socks"), it("B-D-socks"),
                                  it("C-D-socks")]), set())


# --------------------------------------------------------------------------------------
# N -- Sanitizer (NEW v8)
# --------------------------------------------------------------------------------------

class Sanitizer(unittest.TestCase):

    def test_N1_sanitizer_suppresses_tier1(self):
        """A1 with a Sanitizer: dark shoes stop dominating, tier 3 runs instead."""
        items = [it("A-D-shoes"), it("B-L-shirts"), it("C-D-pants")]
        self.assertEqual(resolve(items), specs("A-D-shoes"))
        self.assertEqual(resolve(items, [("Sanitizer", 1)]),
                         specs("A-D-shoes", "C-D-pants"))

    def test_N2_sanitizer_suppresses_tier2(self):
        items = [it("A-L-shoes"), it("B-D-shirts")]
        self.assertEqual(resolve(items), specs("A-L-shoes"))
        self.assertEqual(resolve(items, [("Sanitizer", 1)]), specs("B-D-shirts"))

    def test_N3_sanitizer_does_not_waive_any_other_rule(self):
        # crowding still fires
        self.assertEqual(resolve([it("A-D-shoes"), it("B-D-shoes"), it("C-D-shoes")],
                                 [("Sanitizer", 3)]), set())
        # underwear isolation still fires
        self.assertEqual(resolve([it("A-D-underwear"), it("B-D-shirts")],
                                 [("Sanitizer", 0)]), specs("B-D-shirts"))
        # blanket exclusivity still fires -- v11 boundary: two companions, not a
        # companion that is not socks.
        self.assertEqual(resolve([it("A-D-blanket"), it("B-D-hats"), it("C-D-pants")],
                                 [("Sanitizer", 0)]), set())

    def test_N4_sanitizer_is_a_noop_without_shoes(self):
        items = [it("A-D-shirts"), it("B-L-pants")]
        self.assertEqual(resolve(items, [("Sanitizer", 0)]), resolve(items))

    def test_N5_light_only_machine_with_light_shoes(self):
        items = [it("A-L-shoes"), it("B-L-hats")]
        self.assertEqual(resolve(items), specs("A-L-shoes"))
        self.assertEqual(resolve(items, [("Sanitizer", 1)]),
                         specs("A-L-shoes", "B-L-hats"))

    def test_N6_owner_only_reading_protects_only_the_player(self):
        items = [it("A-D-shoes"), it("B-D-pants"), it("C-D-hats")]
        self.assertEqual(resolve(items, [("Sanitizer", 1)], san_owner_only=True),
                         specs("A-D-shoes", "B-D-pants"))
        self.assertEqual(resolve(items, [("Sanitizer", 1)]),
                         specs("A-D-shoes", "B-D-pants", "C-D-hats"))

    def test_N7_sanitizer_interacts_with_bleach_on_shade_only(self):
        items = [it("A-D-shoes"), it("B-L-shirts")]
        # Bleach swaps first: shoes become effectively light, the shirt effectively dark.
        # Sanitizer then removes the shoe rungs, so tier 3 runs on effective shade and
        # the shirt wins.  The two cards compose on different axes.
        self.assertEqual(resolve(items, [("Sanitizer", 0), ("Bleach", 0)]),
                         specs("B-L-shirts"))


# --------------------------------------------------------------------------------------
# W -- Wash net, narrowed (AMENDS A14/A15)
# --------------------------------------------------------------------------------------

class WashNet(unittest.TestCase):

    def test_W1_net_waives_isolation_for_a_protected_card(self):
        u = it("A-D-underwear")
        self.assertEqual(resolve([u, it("B-L-shirts")], [("Wash net", 0)],
                                 net=[u.key()]), specs("A-D-underwear"))

    def test_W2_net_does_not_protect_underwear_already_in_the_machine(self):
        """The v8 narrowing.  Same board as W1 with no same-turn protection: nothing."""
        self.assertEqual(resolve([it("A-D-underwear"), it("B-L-shirts")],
                                 [("Wash net", 0)]), specs())

    def test_W3_net_does_not_beat_the_ladder(self):
        u = it("A-D-underwear")
        self.assertEqual(resolve([u, it("B-D-shoes")], [("Wash net", 0)], net=[u.key()]),
                         specs("B-D-shoes"))

    def test_W4_protection_is_per_card_not_per_owner(self):
        u1, u2 = it("A-D-underwear"), it("A-L-underwear")
        got = resolve([u1, u2, it("B-D-shirts")], [("Wash net", 0)], net=[u1.key()])
        self.assertEqual(got, specs("A-D-underwear", "B-D-shirts"))

    def test_W5_engine_only_protects_same_turn_loads(self):
        st = rig()
        stale = it("A-D-underwear")
        put(st, 0, stale)                                  # already sitting there
        st["_net_turn"] = None
        R.apply_special(st, 0, "Wash net", 0)
        self.assertEqual(st["_net_turn"], (0, 0))
        fresh = it("A-L-underwear")
        hand(st, 0, fresh)
        # emulate the loader
        st["players"][0]["hand"].remove(fresh)
        st["machines"][0]["items"].append(fresh)
        if st["_net_turn"] == (0, 0) and fresh.typ == R.UNDERWEAR:
            st["machines"][0]["net"].add(fresh.key())
        self.assertIn(fresh.key(), st["machines"][0]["net"])
        self.assertNotIn(stale.key(), st["machines"][0]["net"])


# --------------------------------------------------------------------------------------
# G -- Gang (REPLACES B3)
# --------------------------------------------------------------------------------------

class Gang(unittest.TestCase):

    def test_G1_gang_destroys_one_machine_and_returns_its_contents(self):
        st = rig()
        a, b = it("A-D-shirts"), it("B-L-pants")
        put(st, 1, a)
        put(st, 1, b)
        c = it("C-D-hats")
        put(st, 0, c)
        fire(st, "Gang", gang=1)
        self.assertTrue(st["machines"][1]["dead"])
        self.assertIn(a, st["players"][0]["hand"])
        self.assertIn(b, st["players"][1]["hand"])
        self.assertIn(c, st["machines"][0]["items"])       # the other machine is untouched
        R.phase_reckon(st)
        self.assertIn(c.iid, st["players"][2]["clean"])    # and it still washes

    def test_G2_gang_never_returns_to_the_deck(self):
        st = rig()
        fire(st, "Gang", gang=0)
        self.assertNotIn("Gang", st["event_deck"])
        self.assertTrue(st["gang_used"])

    def test_G3_a_dead_machine_accepts_nothing_and_never_reckons(self):
        st = rig()
        fire(st, "Gang", gang=2)
        self.assertFalse(R.machine_accepts(st, 2, it("A-D-hats")))
        before = st["stats"]["machine_reckonings"]
        R.phase_reckon(st)
        self.assertEqual(st["stats"]["machine_reckonings"] - before,
                         len(st["machines"]) - 1)

    def test_G4_gang_may_shoot_jimothys_machine(self):
        """[A-W07] Designer ruling: Gang MAY destroy the washer Jimothy is sitting in.
        The washer dies, the hostages are released to their owners' hands, and the
        raccoon RELOCATES.  The drawer picks both the washer shot and where he goes."""
        st = rig()
        R.move_jimothy(st, 0, "place")
        st["jimothy_since"] = st["day"]
        x = it("A-D-hats")
        put(st, 0, x)
        fire(st, "Gang", gang=0, jim=2)

        # the washer is destroyed, Jimothy notwithstanding
        self.assertTrue(st["machines"][0]["dead"])
        self.assertEqual(sum(1 for m in st["machines"] if m["dead"]), 1)

        # the hostage is released to its owner, unwashed
        self.assertEqual(st["machines"][0]["items"], [])
        self.assertIn(x, st["players"][x.owner]["hand"])
        self.assertNotIn(x.iid, st["players"][x.owner]["clean"])

        # the raccoon relocates to the washer the drawer named, which is still alive
        self.assertEqual(st["jimothy_at"], 2)
        self.assertTrue(st["machines"][2]["jimothy"])
        self.assertFalse(st["machines"][0]["jimothy"])
        self.assertFalse(st["machines"][2]["dead"])

    def test_G5_gang_no_longer_wipes_the_board(self):
        """VOIDS rules-v0.3 B3."""
        st = rig()
        for mi in range(4):
            put(st, mi, it("A-D-hats") if mi == 0 else it("B-D-pants"))
        fire(st, "Gang", gang=3)
        alive_loaded = sum(len(m["items"]) for m in st["machines"] if not m["dead"])
        self.assertEqual(alive_loaded, 3)


# --------------------------------------------------------------------------------------
# C -- Circuit break (AMENDS B2)
# --------------------------------------------------------------------------------------

class CircuitBreak(unittest.TestCase):

    def test_C1_every_machine_switches_off_and_keeps_its_contents(self):
        st = rig()
        x = it("C-D-hats")
        put(st, 0, x)
        fire(st, "Circuit break")
        self.assertTrue(all(not m["on"] for m in st["machines"]))
        R.phase_reckon(st)
        self.assertEqual(len(st["machines"][0]["items"]), 1)
        self.assertEqual(st["players"][2]["clean"], set())

    def test_C2_recovery_is_one_machine_per_day(self):
        st = rig(players=6, machines=7)
        fire(st, "Circuit break")
        pol = bots.make("GREEDY")
        for p in st["players"]:
            p["hand"] = [it("A-D-hats")]
        days = 0
        while any(m["on"] is False for m in st["machines"]) and days < 30:
            R.phase_key(st, pol)
            days += 1
        self.assertEqual(days, 7)

    def test_C3_circuit_break_returns_to_the_deck(self):
        st = rig()
        st["event_deck"] = ["Gang"]
        fire(st, "Circuit break")
        self.assertIn("Circuit break", st["event_deck"])

    def test_C4_circuit_break_does_not_frighten_jimothy(self):
        """VOIDS rules-v0.3 B13."""
        st = rig()
        R.move_jimothy(st, 0, "place")
        st["jimothy_since"] = st["day"]
        fire(st, "Circuit break")
        self.assertEqual(st["jimothy_at"], 0)


# --------------------------------------------------------------------------------------
# J -- Jimothy
# --------------------------------------------------------------------------------------

class Jimothy(unittest.TestCase):

    def test_J1_blocks_loading_and_running_and_holds_hostages(self):
        st = rig()
        x = it("A-D-hats")
        put(st, 0, x)
        R.move_jimothy(st, 0, "place")
        st["jimothy_since"] = st["day"]
        self.assertFalse(R.machine_accepts(st, 0, it("B-D-hats")))
        R.phase_reckon(st)
        self.assertEqual(len(st["machines"][0]["items"]), 1)
        self.assertNotIn(x, st["players"][0]["hand"])

    def test_J2_snacc_relocates_him_and_releases_hostages_unwashed(self):
        st = rig()
        x = it("A-D-hats")
        put(st, 0, x)
        st["event_deck"].remove("Jimothy")
        R.move_jimothy(st, 0, "place")
        st["jimothy_since"] = st["day"]
        R.apply_special(st, 1, "Snacc", 1)
        self.assertEqual(st["jimothy_at"], 1)               # still in play
        self.assertIn(x, st["players"][0]["hand"])
        self.assertEqual(st["players"][0]["clean"], set())
        self.assertNotIn("Jimothy", st["event_deck"])       # his card is still on the board

    def test_J3_only_animal_control_removes_him(self):
        st = rig()
        R.move_jimothy(st, 0, "place")
        st["jimothy_since"] = st["day"]
        st["jimothy_arrived"] = st["day"]
        fire(st, "Animal control")
        self.assertIsNone(st["jimothy_at"])
        self.assertIn("Jimothy", st["event_deck"])

    def test_J4_gang_does_not_frighten_him(self):
        """VOIDS rules-v0.3 B12."""
        st = rig()
        R.move_jimothy(st, 1, "place")
        st["jimothy_since"] = st["day"]
        fire(st, "Gang", gang=0)
        self.assertEqual(st["jimothy_at"], 1)

    def test_J5_animal_control_is_a_blank_with_no_raccoon(self):
        st = rig()
        fire(st, "Animal control")
        self.assertEqual(st["stats"]["ac_blanks"], 1)

    def test_J6_he_may_sit_on_a_blanket_or_a_full_machine(self):
        st = rig()
        put(st, 0, it("A-D-blanket"))
        R.move_jimothy(st, 0, "place")
        st["jimothy_since"] = st["day"]
        R.phase_reckon(st)
        self.assertEqual(len(st["machines"][0]["items"]), 1)

    def test_J7_only_one_jimothy_card_exists(self):
        self.assertEqual(R.FIXED_EVENT_DECK["Jimothy"], 1)
        self.assertEqual(sum(R.FIXED_EVENT_DECK.values()), 4)


# --------------------------------------------------------------------------------------
# K -- Coin
# --------------------------------------------------------------------------------------

class Coin(unittest.TestCase):

    def test_K1_one_shot_coin_toggles_and_recycles(self):
        st = rig()
        st["machines"][2]["on"] = False
        n = len(st["special_deck"])
        R.apply_special(st, 0, "Coin", (2, True))
        self.assertTrue(st["machines"][2]["on"])
        self.assertEqual(len(st["special_deck"]), n + 1)
        self.assertEqual(st["stats"]["coin_toggles"], 1)

    def test_K2_coin_is_definitively_a_one_shot(self):
        """Designer ruling: no persistent reading.  The card always leaves the hand and
        goes back into the deck the moment it resolves.  This is a property of the RULES,
        so it is driven by a forcing policy rather than by a bot's valuation -- whether
        GREEDY happens to want the Coin in a given rig is a separate question."""
        class _PlayCoin(bots.Policy):
            def choose_load(self, st, pid):
                return None

            def choose_special(self, st, pid):
                return ("Coin", (1, True))

        st = rig()
        st["players"][0]["ready"] = ["Coin"]
        st["machines"][1]["on"] = False
        n = len(st["special_deck"])
        R.play_one_special(st, _PlayCoin(), 0)

        self.assertEqual(st["players"][0]["ready"], [])       # left the hand
        self.assertEqual(len(st["special_deck"]), n + 1)      # returned to the deck
        self.assertTrue(st["machines"][1]["on"])              # and it actually resolved

    def test_K3_coin_cannot_revive_a_dead_machine(self):
        st = rig()
        st["machines"][1]["dead"] = True
        st["machines"][1]["on"] = False
        R.apply_special(st, 0, "Coin", (1, True))
        self.assertFalse(st["machines"][1]["on"])


# --------------------------------------------------------------------------------------
# V -- victory (REPLACES B17/B18)
# --------------------------------------------------------------------------------------

class Victory(unittest.TestCase):

    def test_V1_victory_is_immediate(self):
        st = rig()
        st["day"] = 7
        p = st["players"][1]
        p["must_wash"] = set([(1, R.HATS, 1)])
        p["clean"] = set([(1, R.HATS, 1)])
        R.phase_end_of_day(st)
        self.assertTrue(st["over"])
        self.assertEqual(st["winners"], [1])

    def test_V2_simultaneous_victory_is_allowed(self):
        st = rig()
        st["day"] = 7
        for pid in (0, 2):
            p = st["players"][pid]
            p["must_wash"] = set([(pid, R.HATS, 1)])
            p["clean"] = set([(pid, R.HATS, 1)])
        R.phase_end_of_day(st)
        self.assertTrue(st["over"])
        self.assertEqual(sorted(st["winners"]), [0, 2])

    def test_V3_no_rotation_extension(self):
        st = rig(players=4, machines=5)
        st["day"] = 1
        p = st["players"][3]
        p["must_wash"] = set([(3, R.HATS, 1)])
        p["clean"] = set([(3, R.HATS, 1)])
        R.phase_end_of_day(st)
        self.assertTrue(st["over"])


# --------------------------------------------------------------------------------------
# D -- deck handling and turn structure
# --------------------------------------------------------------------------------------

class DeckAndTurn(unittest.TestCase):

    def test_D1_draw_two_keep_one_returns_the_other_to_the_bottom(self):
        st = rig()
        st["special_deck"] = ["Coloring", "Bleach", "Sanitizer"]

        class P(bots.Policy):
            def choose_load(self, st, pid):
                return None

            def choose_keep(self, st, pid, a, b):
                return "Bleach" if "Bleach" in (a, b) else a

        R.draw_special(st, P(), 0)
        self.assertEqual(st["players"][0]["fresh"], ["Bleach"])
        self.assertEqual(st["special_deck"][0], "Sanitizer")
        self.assertEqual(len(st["special_deck"]), 2)

    def test_D2_single_card_deck_draws_one(self):
        st = rig()
        st["special_deck"] = ["Coin"]
        R.draw_special(st, bots.make("GREEDY"), 0)
        self.assertEqual(st["players"][0]["fresh"], ["Coin"])
        self.assertEqual(st["special_deck"], [])

    def test_D3_empty_deck_is_a_noop(self):
        st = rig()
        st["special_deck"] = []
        R.draw_special(st, bots.make("GREEDY"), 0)
        self.assertEqual(st["players"][0]["fresh"], [])

    def test_D4_fresh_cards_cannot_be_played_today(self):
        st = rig()
        st["players"][0]["fresh"].append("Bleach")
        self.assertEqual(st["players"][0]["ready"], [])
        R.phase_end_of_day(st)
        self.assertEqual(st["players"][0]["ready"], ["Bleach"])
        self.assertEqual(st["players"][0]["fresh"], [])

    def test_D5_the_key_passes_at_end_of_day(self):
        st = rig()
        st["key"] = 0
        R.phase_end_of_day(st)
        self.assertEqual(st["key"], 1)

    def test_D6_dice_expected_loading_is_exactly_one_and_a_half(self):
        self.assertAlmostEqual(sum(n for n, _ in R.DICE.values()) / 6.0, 1.5)

    def test_D7_loading_is_mandatory(self):
        """A GREEDY player with a hand always loads when any machine accepts."""
        st = rig()
        cfg = st["cfg"]
        self.assertTrue(cfg["mandatory_load"])
        for pid in range(3):
            hand(st, pid, it("%s-D-shoes" % "ABC"[pid]))
        pol = bots.make("GREEDY")
        for pid in range(3):
            self.assertIsNotNone(pol.choose_load(st, pid))

    def test_D8_off_machine_retains_contents_and_cards(self):
        st = rig()
        put(st, 0, it("A-D-shoes"))
        put(st, 0, it("B-D-shoes"))
        st["machines"][0]["cards"].append(("Coloring", 2))
        st["machines"][0]["on"] = False
        R.phase_reckon(st)
        self.assertEqual(len(st["machines"][0]["items"]), 2)
        self.assertEqual(st["machines"][0]["cards"], [("Coloring", 2)])

    def test_D9_machine_count_and_capacity_both_scale(self):
        """REVISED v11.  Capacity was a flat 4; it now scales with the table, and
        so does the number of items each player has to wash."""
        for p in (3, 4, 5, 6):
            self.assertEqual(R.default_config(p)["machines"], p + 1)
            self.assertEqual(R.default_config(p)["capacity"], p + 1)
        self.assertEqual(R.default_config(3)["hand_size"], 10)
        self.assertEqual(R.default_config(4)["hand_size"], 10)
        self.assertEqual(R.default_config(5)["hand_size"], 8)
        self.assertEqual(R.default_config(6)["hand_size"], 8)

    def test_D10_capacity_blocks_the_load_that_overflows(self):
        """REVISED v11.  Was "capacity four blocks a fifth load"; at five players a
        washer now takes six, so it is the seventh load that is refused."""
        st = rig(players=5, machines=6)
        self.assertEqual(st["cfg"]["capacity"], 6)
        # Six distinct items out of four owners: shade makes A-D-hats and A-L-hats
        # different cards.
        for spec in ("A-D-hats", "B-D-hats", "C-D-hats", "D-D-hats",
                     "A-L-hats", "B-L-hats"):
            put(st, 0, it(spec))
        x = it("A-L-pants")
        self.assertFalse(R.machine_accepts(st, 0, x))
        self.assertTrue(R.machine_accepts(st, 1, x))

    def test_D11_opening_hand_is_ten_of_fourteen(self):
        st = R.new_game(R.default_config(4), 3)
        for p in st["players"]:
            self.assertEqual(len(p["hand"]), 10)
            self.assertEqual(len(p["must_wash"]), 10)


# --------------------------------------------------------------------------------------
# integrity
# --------------------------------------------------------------------------------------

POLS = ("RANDOM", "GREEDY", "CAUTIOUS", "MEAN", "CLUSTERING")


class Integrity(unittest.TestCase):

    def test_seed_reproduces_exactly(self):
        for pol in POLS:
            for p in (3, 4, 5, 6):
                cfg = R.default_config(p)
                a = R.play_game(cfg, 12345, bots.make(pol))
                b = R.play_game(cfg, 12345, bots.make(pol))
                self.assertEqual(a["days"], b["days"], pol)
                self.assertEqual(a["winners"], b["winners"], pol)
                self.assertEqual(a["clean_by_player"], b["clean_by_player"], pol)

    def test_different_seeds_differ(self):
        cfg = R.default_config(4)
        a = R.play_game(cfg, 1, bots.make("GREEDY"))
        b = R.play_game(cfg, 2, bots.make("GREEDY"))
        self.assertTrue(a["days"] != b["days"]
                        or a["clean_by_player"] != b["clean_by_player"])

    def test_invariants_hold_over_many_games(self):
        for pol in POLS:
            for seed in range(20):
                for p in (3, 6):
                    R.play_game(R.default_config(p), seed, bots.make(pol))

    def test_games_terminate(self):
        for pol in POLS:
            for p in (3, 4, 5, 6):
                for seed in range(12):
                    res = R.play_game(R.default_config(p), seed, bots.make(pol))
                    self.assertFalse(res["capped"], "%s P=%d seed=%d" % (pol, p, seed))
                    self.assertTrue(res["winners"])

    def test_winners_have_everything_clean(self):
        for seed in range(30):
            res = R.play_game(R.default_config(4), seed, bots.make("GREEDY"))
            for w in res["winners"]:
                self.assertEqual(res["clean_by_player"][w], 10)

    def test_machine_verdicts_is_pure(self):
        k = ((0, R.SHOES, 0), (1, R.SHIRTS, 1))
        ck = (False, (), (), (), ())
        a = R.machine_verdicts(k, ck)
        b = R.machine_verdicts(k, ck)
        self.assertEqual(a, b)
        self.assertEqual(a, (True, False))

    def test_reckoning_order_independence(self):
        """rules-v0.2 §5.1: the verdict is a conjunction, so item order cannot matter."""
        import itertools
        base = [it("A-D-shirts"), it("B-L-shirts"), it("C-D-underwear"), it("A-L-shirts")]
        ref = resolve(base)
        for perm in itertools.permutations(base):
            self.assertEqual(resolve(list(perm)), ref)

    def test_order_independence_holds_with_the_new_cards(self):
        import itertools
        base = [it("A-D-shoes"), it("B-L-socks"), it("C-D-blanket")]
        cards = [("Sanitizer", 0)]
        ref = resolve(base, cards)
        for perm in itertools.permutations(base):
            self.assertEqual(resolve(list(perm), cards), ref)

    def test_no_dead_machine_ever_holds_items(self):
        for seed in range(40):
            res = R.play_game(R.default_config(5), seed, bots.make("MEAN"))
            for m in res["state"]["machines"]:
                if m["dead"]:
                    self.assertEqual(m["items"], [])

    def test_gang_fires_at_most_once(self):
        for seed in range(60):
            res = R.play_game(R.default_config(4), seed, bots.make("GREEDY"))
            self.assertLessEqual(res["stats"]["machines_destroyed"], 1)
            self.assertLessEqual(res["stats"]["events_fired"]["Gang"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
