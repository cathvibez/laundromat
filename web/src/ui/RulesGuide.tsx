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

import { useCallback, useEffect, useRef, useState } from 'react';
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
  players?: number | null;
  /**
   * When supplied, the 3P/4P/5P/6P buttons in the setup section stop being a
   * local preview control and become THE player-count control for whoever
   * rendered the guide. Leave it off and the guide keeps its own state, so it
   * still works standalone.
   */
  onPlayersChange?: (n: number) => void;
  className?: string;
}

/** The six sections, in reading order. Ids match the `Section` ids below. */
const PAGES = [
  { id: 'rg-about', label: 'About the game' },
  { id: 'rg-days', label: 'The days' },
  { id: 'rg-die', label: 'The die' },
  { id: 'rg-washers', label: 'Who comes out clean' },
  { id: 'rg-blankets', label: 'Blankets' },
];

export function RulesGuide({ players = 4, onPlayersChange, className }: RulesGuideProps) {
  /*
   * The count is EITHER ours or the caller's, never both. It used to be only
   * ours, which meant the setup screen's control and the 3P/4P/5P/6P buttons in
   * here held two separate numbers: changing one silently disagreed with the
   * other, and the guide could illustrate a four-player table for a game about
   * to start with six.
   */
  const ownN = players && TABLE[players] ? players : 4;
  const controlled = onPlayersChange !== undefined;
  /*
   * Two different numbers, and conflating them is a lie on screen. `n` is what
   * the diagrams are DRAWN at, which always needs a value. `picked` is what the
   * player has actually chosen, which starts as nothing — so before they choose,
   * the guide illustrates a four-player table without any of the 3P/4P/5P/6P
   * buttons claiming to be selected.
   */
  /*
   * The guide no longer OWNS a player-count control — the setup section that
   * held the 3P/4P/5P/6P buttons has gone, because it described laying out a
   * physical table. `players` still comes in, because the diagrams below draw a
   * washer at the right capacity for the table you are about to play.
   */
  const picked = controlled ? (players ?? null) : ownN;
  const n = (picked && TABLE[picked] ? picked : 4) as number;
  const cfg = TABLE[n];

  /* ---- the pager ---------------------------------------------------------
   * The sections are unchanged; only the container is. Each is a full-width
   * flex child of a scroll-snap track, so the browser does the paging and the
   * arrows/dots/keys are three ways of driving the same scroller. That means a
   * trackpad swipe stays in sync for free — the scroll listener is what keeps
   * the dots honest when someone does that instead of clicking.
   */
  const track = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(0);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(PAGES.length - 1, i));
    setAt(clamped);
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // jsdom has no layout and no scrollTo; guard so tests can still drive this.
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: clamped * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, []);

  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setAt((prev) => (i !== prev && i >= 0 && i < PAGES.length ? i : prev));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const el = track.current;
      if (!el) return;
      // Only when the guide is actually on screen, so the arrow keys are not
      // stolen from the rest of the page.
      const box = el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLSelectElement) return;
      e.preventDefault();
      goTo(at + (e.key === 'ArrowRight' ? 1 : -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, goTo]);

  return (
    <div className={`rules-guide${className ? ` ${className}` : ''}`}>
      <div className="rg-title">
        <h2>How to play</h2>
        <p>Everyone's laundry, one row of washers, and not enough of them.</p>
      </div>

      <div className="rg-pager">
        <button
          type="button"
          className="rg-nav prev"
          onClick={() => goTo(at - 1)}
          disabled={at === 0}
          aria-label="Previous section"
        >
          &lsaquo;
        </button>

        <div className="rg-track" ref={track} onScroll={onScroll}>

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
          You and your people all use the same laundromat, and what you put in a
          washer lands on everyone else&rsquo;s laundry as well as your own.
        </p>
        <p>
          Your dirty shoes can send someone&rsquo;s pants back for another wash. Your
          underwear is delicate and needs the machine to itself. Your dark clothes
          can dirty someone&rsquo;s light ones.
        </p>
        <p>
          {/* The old "To win" slide said only this, so it lives here instead of
              costing a page of its own. */}
          <b>First to get everything on their list washed wins.</b> Sabotage or
          collaborate — your choice.
        </p>
      </Section>

      {/*
        THE SETUP SECTION IS GONE. It told you to lay out N washers, deal ten
        items each and hand somebody the key — all of which the digital game has
        already done by the time anyone reads this. It belongs in the printed
        rulebook, which is where design/rulebook/ keeps it.
      */}

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
        {/*
          THE DIAGRAM LISTS THE STEPS; this says what they MEAN. The two used to
          say the same four things in the same order, so half the slide was
          reading itself back to you.
        */}
        <p>
          The game is a run of <b>days</b>. Each day is one lap of the table, and
          the day ends with every working washer spinning at once — so a day is
          also the unit of consequence: nothing you load takes effect until the
          end of the day you loaded it.
        </p>
        <p>
          Your <b>turn</b> is a roll and whatever the die says, plus at most{' '}
          <b>one special item</b> if you hold one.
        </p>
        <p>
          The <b>key</b> is the interesting part. Whoever holds it flips exactly one
          washer on or off after everyone has loaded — so the last word on what
          runs tonight belongs to one person, and it is not usually you. Then it
          passes left.
        </p>
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
        {/*
          The faces are printed beside this; repeating them here was the slide
          reading its own diagram aloud. What is left is the two things the
          diagram cannot say.
        */}
        <p>
          <b>Every face loads.</b> Four, five and six are not alternatives to
          loading — they are loading, plus a favour on top.
        </p>
        <p>
          <b>Only the first 6 of the day draws an event.</b> Later sixes that day
          just load and move on.
        </p>
        <p className="rg-small">
          Nothing left in hand to load? Move one of your own items between washers
          instead.
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
      </Section>

      {/* -------------------------------------------------- blankets */}
      {/*
        SPLIT OFF FROM THE WASHERS SLIDE, which carried the ladder, the shade
        rule, four worked examples and the blanket rule on one page — the single
        densest thing in the guide, and the one people most need to get right.
        Blankets are their own idea and now get their own page.
      */}
      <Section
        id="rg-blankets"
        kicker="Blankets"
        title="A blanket takes the whole drum"
        stacked
        figure={
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
        }
      >
        <p>
          A washer holding a blanket takes <b>at most one other item</b> — anything
          except a second blanket.
        </p>
        <p>
          That companion does not wash even when it deserves to. If it would
          otherwise have come out clean it gets <b>tangled</b> instead: it stays in
          the drum one more round while the blanket washes and leaves.
        </p>
        <p className="rg-small">
          An item that was going back anyway just goes back. Only a winner gets
          tangled.
        </p>
      </Section>

      {/*
        "TO WIN" IS GONE as a page of its own. It said one sentence — first to
        wash everything on their list — which is now the last line of the first
        slide, where somebody deciding whether to play can actually see it.
      */}
        </div>

        <button
          type="button"
          className="rg-nav next"
          onClick={() => goTo(at + 1)}
          disabled={at === PAGES.length - 1}
          aria-label="Next section"
        >
          &rsaquo;
        </button>
      </div>

      <div className="rg-dots" role="tablist" aria-label="Rules sections">
        {PAGES.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            className={`rg-dot${i === at ? ' on' : ''}`}
            aria-selected={i === at}
            aria-label={p.label}
            onClick={() => goTo(i)}
          />
        ))}
        <span className="rg-dot-label">{PAGES[at]?.label}</span>
      </div>
    </div>
  );
}

export default RulesGuide;
