#!/usr/bin/env python3
"""
Generate parity fixtures from the Python oracle (sim/rules.py).

READ-ONLY with respect to sim/.  It imports the module and calls the pure
`machine_verdicts` function; it writes nothing anywhere except
web/tests/parity/fixtures/.

Run:
    cd /Users/kld/Projects/laundromat/web
    python3 tools/gen_fixtures.py

Output:
    tests/parity/fixtures/reckoning.json    the verdict sweep
    tests/parity/fixtures/constants.json    component constants worth pinning

The TypeScript parity suite replays every row through src/rules/reckoning.ts and
asserts identical verdicts.  This is the guard against the digital game and the
simulation drifting apart.
"""

import itertools
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
SIM = os.path.normpath(os.path.join(WEB, '..', 'sim'))
OUT_DIR = os.path.join(WEB, 'tests', 'parity', 'fixtures')

sys.path.insert(0, SIM)
sys.dont_write_bytecode = True   # do not leave __pycache__ in sim/

import rules as R  # noqa: E402


SHADE_OF = {'D': R.DARK, 'L': R.LIGHT}
NAME_OF_SHADE = {R.DARK: 'D', R.LIGHT: 'L'}


def key_of(spec):
    """{'owner':0,'type':'shoes','shade':'D'} -> (owner, typ, shade)"""
    return (spec['owner'], R.TYPE_BY_NAME[spec['type']], SHADE_OF[spec['shade']])


def id_of(spec):
    return '%d-%s-%s' % (spec['owner'], spec['type'], spec['shade'])


def cards_key_of(cards):
    return (
        bool(cards['bleached']),
        tuple(sorted(set(cards['coloringOwners']))),
        tuple(sorted(set(cards['catcherOwners']))),
        tuple(sorted(set(key_of(parse_id(s)) for s in cards['netKeys']))),
        tuple(sorted(set(cards['sanitizerOwners']))),
    )


def parse_id(s):
    owner, typ, shade = s.split('-')
    return {'owner': int(owner), 'type': typ, 'shade': shade}


def empty_cards():
    return {'bleached': False, 'coloringOwners': [], 'catcherOwners': [],
            'netKeys': [], 'sanitizerOwners': []}


def default_opts():
    return {'bleachKillsDark': False, 'sanitizerOwnerOnly': False, 'crowdThreshold': 3}


def make_case(cid, items, cards=None, opts=None, note=''):
    cards = cards or empty_cards()
    opts = opts or default_opts()
    verdicts = R.machine_verdicts(
        tuple(key_of(x) for x in items),
        cards_key_of(cards),
        opts['bleachKillsDark'],
        opts['sanitizerOwnerOnly'],
        opts['crowdThreshold'],
    )
    return {
        'id': cid,
        'note': note,
        'items': items,
        'cards': cards,
        'opts': opts,
        'expected': list(verdicts),
    }


def item(owner, type_, shade):
    return {'owner': owner, 'type': type_, 'shade': shade}


# ---------------------------------------------------------------------------
# 1. The named worked examples: rules-v0.4 section 6.13 Table A, and the
#    S / N / W families from sim/test_rules.py.
# ---------------------------------------------------------------------------

def named_cases():
    A, B, C, D = 0, 1, 2, 3
    cases = []

    def add(cid, items, cards=None, opts=None, note=''):
        cases.append(make_case(cid, items, cards, opts, note))

    def cards(bleached=False, coloring=(), catcher=(), net=(), san=()):
        return {'bleached': bleached, 'coloringOwners': list(coloring),
                'catcherOwners': list(catcher), 'netKeys': list(net),
                'sanitizerOwners': list(san)}

    # ---- Table A ----------------------------------------------------------
    add('A01', [item(A, 'shoes', 'D'), item(B, 'shirts', 'L'), item(C, 'pants', 'D')],
        note='dark shoes taint everything')
    add('A02', [item(A, 'shoes', 'L'), item(B, 'shirts', 'D')], note='tier 2 inversion')
    add('A03', [item(A, 'shirts', 'D'), item(A, 'pants', 'D'), item(B, 'hats', 'L')],
        note='ordinary dark wins')
    add('A04', [item(A, 'shirts', 'L'), item(B, 'pants', 'L')], note='light only')
    add('A05', [item(A, 'blanket', 'D')], note='blanket alone washes on tier 3')
    add('A06', [item(A, 'underwear', 'D')], note='solo-wash guarantee')
    add('A07', [item(A, 'underwear', 'D'), item(B, 'underwear', 'L')],
        note='shade precedence inside linen')
    add('A08', [item(A, 'underwear', 'D'), item(A, 'shirts', 'D')],
        note='self-inflicted isolation')
    add('A09', [item(A, 'shoes', 'D'), item(B, 'shoes', 'D'), item(C, 'shoes', 'D'),
                item(D, 'shirts', 'L')], note='crowding beats tier 1 at capacity')
    add('A10', [item(A, 'shirts', 'D'), item(A, 'shirts', 'L'), item(B, 'shirts', 'D')],
        note='crowding is type-only')
    add('A11', [item(A, 'shirts', 'D'), item(B, 'shirts', 'L')], cards(bleached=True),
        note='bleach is ownership blind')
    add('A12', [item(A, 'shoes', 'D'), item(B, 'shirts', 'L')], cards(bleached=True),
        note='bleach does not disarm shoes')
    add('A13', [item(A, 'shoes', 'D'), item(B, 'shirts', 'L'), item(C, 'pants', 'D')],
        cards(san=[B]), note='sanitizer, the headline case')
    add('A14', [item(A, 'shoes', 'D'), item(B, 'shirts', 'L'), item(C, 'hats', 'L')],
        cards(san=[A]), note='sanitizer can hurt its own player')
    add('A15', [item(A, 'shoes', 'L'), item(B, 'shirts', 'D')], cards(bleached=True, san=[A]),
        note='the two pre-ladder modifiers compose and commute')
    add('A16', [item(A, 'blanket', 'D'), item(A, 'socks', 'D')],
        note='socks/blanket base case -- verdict is WASH here; the damp transform is S8, outside this function')
    add('A17', [item(A, 'socks', 'D'), item(B, 'hats', 'L')], note='the second wash')
    add('A18', [item(A, 'blanket', 'L'), item(A, 'socks', 'D')],
        note='the reading that matters: tier 3 splits socks from the blanket')
    add('A19', [item(A, 'blanket', 'D'), item(A, 'socks', 'D')], note='damp socks complete')
    add('A20', [item(A, 'blanket', 'D'), item(A, 'socks', 'D'), item(B, 'socks', 'L'),
                item(C, 'socks', 'D')], note='blanket plus three socks: crowding fires')
    add('A21', [item(A, 'underwear', 'D'), item(B, 'shirts', 'L')],
        cards(net=['0-underwear-D']), note='net waives isolation')
    add('A22', [item(A, 'underwear', 'D'), item(B, 'shirts', 'L')], cards(),
        note='the v8 narrowing bites: no same-turn protection')
    add('A23', [item(A, 'underwear', 'D'), item(B, 'shoes', 'D')],
        cards(net=['0-underwear-D']), note='net does not beat the ladder')
    add('A24', [item(A, 'underwear', 'D'), item(B, 'shoes', 'D')],
        cards(net=['0-underwear-D'], san=[C]), note='net + sanitizer combo')
    add('A25', [item(A, 'shirts', 'L'), item(B, 'pants', 'L'), item(C, 'hats', 'L')],
        cards(coloring=[A], catcher=[B]), note='coloring plus catcher')
    add('A26', [item(A, 'shirts', 'L'), item(B, 'pants', 'L'), item(C, 'hats', 'L')],
        cards(coloring=[A, B]), note='two colorings, total loss')
    add('A27', [item(A, 'shirts', 'L'), item(B, 'shoes', 'D')],
        cards(bleached=True, coloring=[A], catcher=[B]), note='full stack')
    add('A28', [], cards(san=[A]), note='empty machine is a no-op')

    # ---- extra rows from test_rules.py ------------------------------------
    add('A17b', [item(A, 'shoes', 'D'), item(B, 'shirts', 'L')], cards(bleached=True),
        {'bleachKillsDark': True, 'sanitizerOwnerOnly': False, 'crowdThreshold': 3},
        note='sensitivity: bleach kills dark')
    add('A19b', [item(A, 'shoes', 'L'), item(B, 'shoes', 'L'), item(C, 'shoes', 'L')],
        cards(bleached=True), note='bleach then crowding')
    add('A16b', [item(A, 'underwear', 'D'), item(B, 'underwear', 'D'),
                 item(C, 'underwear', 'D')], note='crowding applies to linen')
    add('A27b', [item(A, 'hats', 'D'), item(B, 'hats', 'D'), item(C, 'hats', 'L'),
                 item(D, 'hats', 'L')], note='four of a type still crowds')
    add('A11b', [item(A, 'underwear', 'D'), item(B, 'underwear', 'D')],
        note='all underwear, both dark')

    # ---- S: socks and blankets --------------------------------------------
    add('S3a', [item(A, 'blanket', 'D'), item(B, 'socks', 'L')], note='ladder splits them')
    add('S3b', [item(A, 'blanket', 'D'), item(B, 'socks', 'D')], note='both dark')
    add('S7', [item(A, 'blanket', 'D'), item(B, 'hats', 'D')],
        note='blanket with a non-sock is a total loss')
    add('S8', [item(A, 'blanket', 'D'), item(A, 'socks', 'D'), item(B, 'socks', 'D'),
               item(C, 'socks', 'D')], note='three socks crowd beside a blanket')

    # ---- N: sanitizer ------------------------------------------------------
    add('N1', [item(A, 'shoes', 'D'), item(B, 'shirts', 'L'), item(C, 'pants', 'D')],
        cards(san=[B]), note='suppresses tier 1')
    add('N2', [item(A, 'shoes', 'L'), item(B, 'shirts', 'D')], cards(san=[B]),
        note='suppresses tier 2')
    add('N3a', [item(A, 'shoes', 'D'), item(B, 'shoes', 'D'), item(C, 'shoes', 'D')],
        cards(san=[D]), note='crowding still fires')
    add('N3b', [item(A, 'underwear', 'D'), item(B, 'shirts', 'D')], cards(san=[A]),
        note='underwear isolation still fires')
    add('N3c', [item(A, 'blanket', 'D'), item(B, 'hats', 'D')], cards(san=[A]),
        note='blanket exclusivity still fires')
    add('N4', [item(A, 'shirts', 'D'), item(B, 'pants', 'L')], cards(san=[A]),
        note='no-op without shoes')
    add('N5', [item(A, 'shoes', 'L'), item(B, 'hats', 'L')], cards(san=[B]),
        note='light-only machine with light shoes')
    add('N6a', [item(A, 'shoes', 'D'), item(B, 'pants', 'D'), item(C, 'hats', 'D')],
        cards(san=[B]),
        {'bleachKillsDark': False, 'sanitizerOwnerOnly': True, 'crowdThreshold': 3},
        note='owner-only reading protects only the player')
    add('N6b', [item(A, 'shoes', 'D'), item(B, 'pants', 'D'), item(C, 'hats', 'D')],
        cards(san=[B]), note='machine-wide reading, same board')
    add('N7', [item(A, 'shoes', 'D'), item(B, 'shirts', 'L')], cards(bleached=True, san=[A]),
        note='sanitizer interacts with bleach on shade only')

    # ---- W: wash net -------------------------------------------------------
    add('W1', [item(A, 'underwear', 'D'), item(B, 'shirts', 'L')],
        cards(net=['0-underwear-D']), note='net waives isolation for a protected card')
    add('W2', [item(A, 'underwear', 'D'), item(B, 'shirts', 'L')], cards(),
        note='net does not protect underwear already in the machine')
    add('W3', [item(A, 'underwear', 'D'), item(B, 'shoes', 'D')],
        cards(net=['0-underwear-D']), note='net does not beat the ladder')
    add('W4', [item(A, 'underwear', 'D'), item(A, 'underwear', 'L'), item(B, 'shirts', 'D')],
        cards(net=['0-underwear-D']), note='protection is per card, not per owner')

    return cases


# ---------------------------------------------------------------------------
# 2. Exhaustive enumeration of every 1-, 2- and 3-item machine over a reduced
#    alphabet (3 owners x 7 types x 2 shades = 42 distinct item keys), no cards.
# ---------------------------------------------------------------------------

def exhaustive_cases():
    alphabet = [item(o, t, s)
                for o in (0, 1, 2)
                for t in R.TYPE_NAMES
                for s in ('D', 'L')]
    cases = []
    n = 0
    for size in (1, 2, 3):
        for combo in itertools.combinations(alphabet, size):
            cases.append(make_case('EX%05d' % n, list(combo), note='exhaustive'))
            n += 1
    return cases


# ---------------------------------------------------------------------------
# 3. Seeded random sweep, WITH cards and with both sensitivity readings.
# ---------------------------------------------------------------------------

def random_cases(count=5000, seed=20260804):
    rng = random.Random(seed)
    owners = (0, 1, 2, 3)
    alphabet = [item(o, t, s) for o in owners for t in R.TYPE_NAMES for s in ('D', 'L')]
    cases = []
    for i in range(count):
        size = rng.randint(1, 4)
        items = rng.sample(alphabet, size)

        def subset(p):
            return [o for o in owners if rng.random() < p]

        underwear_here = [id_of(x) for x in items if x['type'] == 'underwear']
        net = [s for s in underwear_here if rng.random() < 0.5]

        cards = {
            'bleached': rng.random() < 0.25,
            'coloringOwners': subset(0.10),
            'catcherOwners': subset(0.10),
            'netKeys': net,
            'sanitizerOwners': subset(0.10),
        }
        opts = {
            'bleachKillsDark': rng.random() < 0.10,
            'sanitizerOwnerOnly': rng.random() < 0.15,
            'crowdThreshold': 3,
        }
        cases.append(make_case('RND%05d' % i, items, cards, opts, note='random sweep'))
    return cases


# ---------------------------------------------------------------------------
# Constants worth pinning, so a component change in one implementation is caught
# ---------------------------------------------------------------------------

def constants():
    return {
        'typeNames': list(R.TYPE_NAMES),
        'specials': list(R.SPECIALS),
        'attaching': sorted(R.ATTACHING),
        'immediate': sorted(R.IMMEDIATE),
        'events': list(R.EVENTS),
        'fixedEventDeck': dict(R.FIXED_EVENT_DECK),
        'machinesByPlayers': {str(k): v for k, v in R.MACHINES_BY_PLAYERS.items()},
        'dice': {str(face): {'load': load, 'extra': extra}
                 for face, (load, extra) in R.DICE.items()},
        'capacity': R.default_config(4)['capacity'],
        'handSize': R.default_config(4)['hand_size'],
        'crowdThreshold': R.default_config(4)['crowd_threshold'],
    }


def main():
    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)

    named = named_cases()
    ex = exhaustive_cases()
    rnd = random_cases()
    cases = named + ex + rnd

    payload = {
        'generatedBy': 'web/tools/gen_fixtures.py',
        'oracle': 'sim/rules.py (brief v8)',
        'counts': {'named': len(named), 'exhaustive': len(ex), 'random': len(rnd),
                   'total': len(cases)},
        'cases': cases,
    }

    path = os.path.join(OUT_DIR, 'reckoning.json')
    with open(path, 'w') as fh:
        json.dump(payload, fh, indent=1, sort_keys=False)
    print('wrote %s  (%d cases: %d named, %d exhaustive, %d random)'
          % (path, len(cases), len(named), len(ex), len(rnd)))

    cpath = os.path.join(OUT_DIR, 'constants.json')
    with open(cpath, 'w') as fh:
        json.dump(constants(), fh, indent=1, sort_keys=True)
    print('wrote %s' % cpath)


if __name__ == '__main__':
    main()
