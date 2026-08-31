/**
 * THE ILLUSTRATED RULES GUIDE — what a new player reads on the setup screen.
 *
 * ============================ WHY IT LOOKS LIKE THIS ============================
 * The diagrams are built out of the SAME `GarmentCard` the board renders. That is
 * the whole point of the file. A rules guide drawn with its own bespoke pictures
 * is a second source of truth: the day someone renames "socks" or restyles the
 * shade dot, the guide quietly starts lying and nobody notices, because nothing
 * imports it. Composing real cards means the guide cannot drift — it breaks
 * loudly, at compile time, or it stays correct.
 *
 * The washers are the exception, and deliberately so. `MachineCard` needs a whole
 * `GameState` (verdicts, power, the reckoning memo) and faking one here would be
 * a brittle lie that the type checker would happily wave through. So the washer
 * is redrawn as three CSS rules — `.rg-washer` / `.rg-whead` / `.rg-drum` — ported
 * straight from the print rulebook (design/rulebook/parts/00-head.html), which
 * solved exactly this problem for exactly this reason. A washer here is a frame
 * around real cards, not a simulation of one.
 *
 * ============================== THE HARD RULE ==================================
 * EVERY BOARD DRAWN BELOW MUST BE LEGAL. A reader learns the rules partly by
 * pattern-matching on the pictures, so an illegal picture teaches an illegal
 * rule more effectively than the prose next to it corrects. Specifically:
 *
 *   - a washer holding a blanket shows AT MOST ONE other card, never two, and
 *     never a second blanket;
 *   - no drum holds more cards than the capacity printed on its own header;
 *   - no drum holds three of one garment type unless it is illustrating
 *     crowding, in which case everything in it is going back.
 *
 * If you add a diagram, check it against `machineVerdicts()` in rules/reckoning.ts
 * before you check it against your intuition.
 *
 * TANGLED, NOT DAMP.  The companion of a blanket does not wash and stays in the
 * drum for one more round; it does not go home wet.  `GarmentCard` speaks the same
 * vocabulary — verdict="tangled" paints a TANGLED stamp — so the diagrams below
 * pass the verdict straight through rather than labelling it themselves.
 */

import { useState } from 'react';
import type { ItemCard, ItemType, PlayerId, Shade } from '../rules/types';
import { GarmentCard } from './Card';
import './rules-guide.css';

/* ------------------------------------------------------------------ helpers */

/**
 * A card to draw. Mirrors `itemId()` in rules/types.ts rather than importing it,
 * so this file depends on the rules module for TYPES only — nothing in a rules
 * guide should be able to break a rules test.
 */
function ex(owner: PlayerId, type: ItemType, shade: Shade): ItemCard {
  return { id: `${owner}-${type}-${shade}`, owner, type, shade };
}

/** The setup table from the manual. Washer count and capacity are equal at every
 *  player count; that is a coincidence of the current numbers, not a rule, so
 *  both columns are written out rather than derived from each other. */
const TABLE: Record<number, { washers: number; cap: number; items: number }> = {
  3: { washers: 4, cap: 4, items: 10 },
  4: { washers: 5, cap: 5, items: 10 },
  5: { washers: 6, cap: 6, items: 8 },
  6: { washers: 7, cap: 7, items: 8 },
};

/* -------------------------------------------------------------- the washer */

interface WasherProps {
  name: string;
  /** Printed on the header and used to draw the empty slots. Never render more
   *  cards than this — see THE HARD RULE at the top of the file. */
  cap: number;
  /** Cards in the drum, each with the verdict the reckoning would give it. */
  load?: { item: ItemCard; verdict?: 'wash' | 'back'; tangled?: boolean }[];
  /** Draw the unused capacity as dashed empty slots. Off by default: in an
   *  example about the ladder the empty space is noise, and in the setup
   *  diagram it is the entire subject. */
  showEmpty?: boolean;
  note?: React.ReactNode;
}

function Washer({ name, cap, load = [], showEmpty, note }: WasherProps) {
  const empty = showEmpty ? Math.max(0, cap - load.length) : 0;
  return (
    <div className="rg-washer">
      <div className="rg-whead">
        <span className="rg-wname">{name}</span>
        <span className="rg-power">On</span>
        <span className="rg-cap">
          {load.length}/{cap}
        </span>
      </div>
      <div className="rg-drum">
        {load.map(({ item, verdict, tangled }) => (
          <div className="rg-held" key={item.id}>
            <GarmentCard item={item} size="xs" verdict={tangled ? 'tangled' : (verdict ?? null)} />
          </div>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <div className="rg-slot" key={`e${i}`} />
        ))}
      </div>
      {note && <p className="rg-note">{note}</p>}
    </div>
  );
}

/* ----------------------------------------------------------------- the die */

/** Pip positions on a 3x3 grid, the arrangement every physical die uses. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ n }: { n: number }) {
  const on = new Set(PIPS[n] ?? []);
  return (
    <div className="rg-die" role="img" aria-label={`die face ${n}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.has(i) ? 'pip on' : 'pip'} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- the layout */

function Section({
  id,
  title,
  kicker,
  children,
  figure,
  stacked,
}: {
  id: string;
  title: string;
  kicker?: string;
  children: React.ReactNode;
  figure?: React.ReactNode;
  /** Put the figure under the prose at full width instead of beside it. Used
   *  where the figure is a row of washers that has no business in half a
   *  640px column. */
  stacked?: boolean;
}) {
  return (
    <section className={`rg-sec${stacked ? ' stacked' : ''}`} id={id}>
      <div className="rg-prose">
        {kicker && <div className="rg-kicker">{kicker}</div>}
        <h3>{title}</h3>
        {children}
      </div>
      {figure && <div className="rg-fig">{figure}</div>}
    </section>
  );
}

export interface RulesGuideProps {
  /** Which row of the setup table to illustrate. The reader can change it; this
   *  is only the starting point, so the guide opens on whatever the setup screen
   *  already has selected. */
  players?: number;
  className?: string;
}

export function RulesGuide({ players = 4, className }: RulesGuideProps) {
  const [n, setN] = useState<number>(TABLE[players] ? players : 4);
  const cfg = TABLE[n];

  return (
    <div className={`rules-guide${className ? ` ${className}` : ''}`}>
      <div className="rg-title">
        <h2>How to play</h2>
        <p>Everyone's laundry, one row of washers, and not enough of them.</p>
      </div>

      {/* ------------------------------------------------------ about */}
      <Section
        id="rg-about"
        kicker="About the game"
        title="One laundromat, everybody's washing"
        figure={
          <Washer
            name="Washer 2"
            cap={cfg.cap}
            load={[
              { item: ex(0, 'shirts', 'D') },
              { item: ex(2, 'pants', 'D') },
              { item: ex(4, 'hats', 'D') },
            ]}
            note="Three players' clothes, one drum. Nobody owns a washer."
          />
        }
      >
        <p>
          You and your people all use the same laundromat. The neighbourhood is not
          always safe, the washers are limited, and good things happen anyway.
        </p>
        <p>
          Rush to get your laundry done before your friends. Sabotage or collaborate
          — your choice. Special items give you power, special events bring chaos.
          The first person to get all their stuff washed wins.
        </p>
      </Section>

      {/* ------------------------------------------------------ setup */}
      <Section
        id="rg-setup"
        kicker="Setup"
        title="Lay out the table"
        stacked
        figure={
          <>
            <div className="rg-pcount" role="group" aria-label="player count">
              {[3, 4, 5, 6].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={p === n ? 'on' : ''}
                  onClick={() => setN(p)}
                >
                  {p}P
                </button>
              ))}
            </div>
            <div className="rg-facts">
              <div>
                <b>{cfg.washers}</b>
                <span>washers</span>
              </div>
              <div>
                <b>{cfg.cap}</b>
                <span>fit in each</span>
              </div>
              <div>
                <b>{cfg.items}</b>
                <span>items each</span>
              </div>
            </div>
            <Washer
              name="Washer 1"
              cap={cfg.cap}
              showEmpty
              note={
                <>
                  At {n} players a washer holds <b>{cfg.cap}</b> items. The drum
                  grows with the table — never assume four.
                </>
              }
            />
          </>
        }
      >
        <ol className="rg-steps">
          <li>
            Lay out <b>{cfg.washers}</b> washers and put the ON token on each.
          </li>
          <li>
            Everyone picks a colour and draws <b>{cfg.items}</b> items at random from
            their own colour deck. Those are your laundry for this game; the rest of
            the colour goes back in the box.
          </li>
          <li>Give the key to whoever did their laundry most recently.</li>
        </ol>
        <p className="rg-small">
          3–4 players wash 10 items each, 5–6 players wash 8. Fewer items at a
          bigger table, because a bigger table means more hands fighting over the
          same drums.
        </p>
      </Section>

      {/* ------------------------------------------------------- days */}
      <Section
        id="rg-days"
        kicker="The days"
        title="A day, start to finish"
        figure={
          <div className="rg-day">
            <div className="rg-seats">
              {Array.from({ length: n }, (_, i) => (
                <span className={`rg-seat p${i}`} key={i}>
                  {i === 0 && <span className="rg-key" aria-label="key holder" />}
                  P{i + 1}
                </span>
              ))}
            </div>
            <div className="rg-arrow">turns run this way, from the key</div>
            <ol className="rg-daysteps">
              <li>Everyone rolls and does what the die says.</li>
              <li>The key holder turns one machine on or off.</li>
              <li>The washers that are on and working run.</li>
              <li>The key passes left. Next day.</li>
            </ol>
          </div>
        }
      >
        <p>
          A day is one lap of the table. Starting from the key holder, each player
          rolls the die and does what it says. You may use at most{' '}
          <b>one special item</b> per turn, at any point during it.
        </p>
        <p>
          When the lap is done the key holder must flip exactly one machine — on or
          off, their choice — and then every washer that is on and working spins.
          Some clothes come out clean, some go back to their owner, some are stuck
          there another round. Then the key moves on.
        </p>
        <div className="rg-callout">
          <b>Events do not wait for the spin.</b> A drawn event resolves the moment
          it is turned over, in the middle of that player's turn. Where an event
          needs a washer chosen — the Gang, Jimothy — the player who drew it chooses.
        </div>
      </Section>

      {/* -------------------------------------------------------- die */}
      <Section
        id="rg-die"
        kicker="The die"
        title="What the six faces do"
        stacked
        figure={
          <div className="rg-faces">
            {[
              { n: 1, t: 'Load 1 item.' },
              { n: 2, t: 'Load 2 items.' },
              { n: 3, t: 'Load 3 items.' },
              { n: 4, t: 'Load 1 item, then move any one item from washer to washer.' },
              { n: 5, t: 'Load 1 item, then draw a special — two come up, you keep one.' },
              { n: 6, t: 'Load 1 item, then draw an event — only the first 6 of the day.' },
            ].map((f) => (
              <div className="rg-face" key={f.n}>
                <Die n={f.n} />
                <span>{f.t}</span>
              </div>
            ))}
          </div>
        }
      >
        <p>
          Every face loads laundry. Four, five and six load one item and then do
          something else on top — the high faces are not alternatives to loading,
          they are loading plus a favour.
        </p>
        <p className="rg-small">
          Only one event happens per day: the first 6 rolled draws one, and every 6
          after it that day just loads its item and moves the game along. If you
          have nothing left in hand to load, move one of your own items from one
          washer to another instead.
        </p>
      </Section>

      {/* ---------------------------------------------------- washers */}
      <Section
        id="rg-washers"
        kicker="The washers"
        title="Who comes out clean"
        stacked
        figure={
          <>
            <div className="rg-ladder">
              <div className="rg-rung dirty">
                <b>Shoes</b>
                <span>dirtiest — nothing else in the drum washes</span>
              </div>
              <div className="rg-rung">
                <b>Everything else</b>
                <span>socks, shirts, pants, hats, blankets</span>
              </div>
              <div className="rg-rung delicate">
                <b>Underwear</b>
                <span>most delicate — anything else present spoils it</span>
              </div>
            </div>

            <div className="rg-cases">
              <Washer
                name="Shoes spoil it"
                cap={cfg.cap}
                load={[
                  { item: ex(0, 'shoes', 'D'), verdict: 'wash' },
                  { item: ex(1, 'shirts', 'L'), verdict: 'back' },
                  { item: ex(2, 'hats', 'D'), verdict: 'back' },
                ]}
                note="Shoes wash. Nothing sharing the drum with them does — even their owner's own shirt."
              />
              <Washer
                name="Dark taints light"
                cap={cfg.cap}
                load={[
                  { item: ex(2, 'pants', 'D'), verdict: 'wash' },
                  { item: ex(5, 'hats', 'L'), verdict: 'back' },
                ]}
                note="P3's dark pants bleed onto P6's light hat. The dark item is fine."
              />
              <Washer
                name="Your own are kinder"
                cap={cfg.cap}
                load={[
                  { item: ex(4, 'pants', 'D'), verdict: 'wash' },
                  { item: ex(4, 'shirts', 'L'), verdict: 'wash' },
                ]}
                note="Both P5's. Your own items never taint each other by shade — among your own it is only shoes, then everything else, then underwear."
              />
              <Washer
                name="Too many of a kind"
                cap={cfg.cap}
                load={[
                  { item: ex(0, 'hats', 'D'), verdict: 'back' },
                  { item: ex(3, 'hats', 'L'), verdict: 'back' },
                  { item: ex(5, 'hats', 'D'), verdict: 'back' },
                ]}
                note="Three or more of one garment type crowd the drum and all go back, whoever owns them."
              />
            </div>

            <div className="rg-callout">
              <b>Shoes beat shade.</b> The shoes / everything-else / underwear ladder
              is checked before dark-versus-light, so light shoes still taint dark
              pants.
            </div>

            <h4 className="rg-subhead">Blankets are big</h4>
            <div className="rg-cases">
              <Washer
                name="Blanket, tangled"
                cap={cfg.cap}
                load={[
                  { item: ex(3, 'blanket', 'D'), verdict: 'wash' },
                  { item: ex(1, 'socks', 'D'), tangled: true },
                ]}
                note="The socks would have washed, so instead they tangle into the blanket and stay in the drum one more round. The blanket washes and leaves."
              />
              <Washer
                name="Blanket, tainted"
                cap={cfg.cap}
                load={[
                  { item: ex(3, 'blanket', 'D'), verdict: 'wash' },
                  { item: ex(1, 'hats', 'L'), verdict: 'back' },
                ]}
                note="The light hat loses to the dark blanket, so it goes home to its owner's hand as normal. Only an item that would have washed gets tangled."
              />
            </div>
          </>
        }
      >
        <p>
          Shoes are dirtier than everything. Underwear is more delicate than
          everything. If shoes are in a washer nothing else in it gets washed; if
          anything at all is in there beside underwear, the underwear does not wash.
        </p>
        <p>
          Dark items taint light ones — your dark green pants ruin someone's light
          pink hat. <b>Not your own, though:</b> among the items you own, shade does
          not matter at all, only the ladder does.
        </p>
        <p>
          A washer holding a blanket takes <b>at most one other item</b>, of any type
          except a second blanket. That companion, if it would otherwise have come
          out clean, gets <b>tangled</b> instead: it stays in the washer for one more
          round while the blanket washes and leaves.
        </p>
      </Section>

      {/* ------------------------------------------------------ to win */}
      <Section
        id="rg-win"
        kicker="To win"
        title="Everything clean"
        figure={
          <div className="rg-pile">
            <div className="rg-pilecards">
              <GarmentCard item={ex(2, 'hats', 'L')} size="xs" verdict="wash" />
              <GarmentCard item={ex(2, 'socks', 'D')} size="xs" verdict="wash" />
              <GarmentCard item={ex(2, 'shirts', 'D')} size="xs" verdict="wash" />
            </div>
            <span className="rg-pilelabel">P3's clean pile</span>
          </div>
        }
      >
        <p>
          The first player to get every one of their items into their clean pile
          wins. Nothing else scores.
        </p>
        <div className="rg-callout bad">
          <b>A tie is not a win.</b> If two players finish on the same day, nobody
          wins. Watch what the person to your right has left.
        </div>
      </Section>
    </div>
  );
}

export default RulesGuide;
