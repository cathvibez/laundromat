import type { GameState, Machine } from '../rules/types';
import { cardName, itemLabel, tonight, willTangle } from '../rules/selectors';
import { useState } from 'react';
import { WasherIcon } from './Icons';
import { GarmentCard } from './Card';
import type { Verdict } from './Card';

const PLAYER_COLORS = ['var(--p0)', 'var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p5)'];

export function Swatch({ owner, shade }: { owner: number; shade: 'D' | 'L' }) {
  return (
    <span
      className={`swatch${shade === 'L' ? ' light' : ''}`}
      style={{ background: PLAYER_COLORS[owner % 6] }}
      title={`Player ${owner + 1}`}
    />
  );
}

interface Props {
  G: GameState;
  machine: Machine;
  selectable?: boolean;
  /**
   * Selectable AND the thing to do next. `selectable` alone can be true of six
   * washers for the whole load stage; the cue is what the board turns on only
   * while a click here is the move it is waiting for.
   */
  cue?: boolean;
  /** Ring the DRUM: the next click is on an item in here, not on the washer. */
  cueItems?: boolean;
  refused?: string | null;
  onSelect?: () => void;
  footer?: React.ReactNode;
  highlightItems?: string[];
  onItemClick?: (id: string) => void;
  /** Staged but uncommitted loads, drawn differently so they read as pending. */
  ghosts?: string[];
  /** True while a draggable item is hovering this washer. */
  dropActive?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function MachineCard({
  G,
  machine,
  selectable,
  cue,
  cueItems,
  refused,
  onSelect,
  footer,
  highlightItems,
  onItemClick,
  ghosts,
  dropActive,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}: Props) {
  const t = tonight(G, machine);
  /** L2: the sentence behind the chip, opened per washer. */
  const [why, setWhy] = useState(false);
  const capacity = G.cfg.capacity;
  const empties = Math.max(0, capacity - machine.items.length);

  const statusLabel =
    t.status === 'destroyed'
      ? 'DESTROYED'
      : t.status === 'raccoon'
        ? 'JIMOTHY'
        : t.status === 'on'
          ? 'ON'
          : 'OFF';

  return (
    <div
      className={[
        'machine',
        selectable ? 'selectable' : '',
        cue ? 'cue' : '',
        refused ? 'refused' : '',
        machine.dead ? 'dead' : '',
        dropActive ? 'drop-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={selectable && onSelect ? onSelect : undefined}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="head">
        <WasherIcon size={17} className="wname-icon" />
        <span className="name">Washer {machine.id + 1}</span>
        <span className={`power ${t.status}`}>{statusLabel}</span>
        <span className="cap">
          {machine.items.length}/{capacity}
        </span>
      </div>

      <div className={`slots${cueItems && onItemClick && machine.items.length > 0 ? ' cue-zone' : ''}`}>
        {machine.items.map((id) => {
          const item = G.items[id];
          const line = t.lines.find((l) => l.item.id === id);
          const wash = line?.willWash ?? false;
          const tangled = wash && willTangle(G, machine, item);
          const netted = machine.netProtected.includes(id);
          const ghost = ghosts?.includes(id);
          const live = t.status === 'on' && !G.cbBlackout;
          const verdict: Verdict = live ? (tangled ? 'tangled' : wash ? 'wash' : 'back') : null;
          const note = [
            netted ? 'in the bag' : '',
            // Tangling is the blanket's doing, not the item's: it stays put while
            // a blanket is in here, and washes on the first night without one.
            tangled ? 'tangled — stays in' : '',
            ghost ? 'not committed' : '',
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <GarmentCard
              key={id}
              item={item}
              size="xs"
              verdict={verdict}
              /* Everything in a washer is a forecast: it is what tonight WOULD
                 do if the day ended now, and it changes every time anyone
                 loads. The reckoning screen shows results and stays solid. */
              provisional
              note={note || undefined}
              ghost={ghost}
              selected={highlightItems?.includes(id)}
              title={`P${item.owner + 1} ${itemLabel(item)}${note ? ` — ${note}` : ''}`}
              onClick={
                onItemClick
                  ? (e) => {
                      e.stopPropagation();
                      onItemClick(id);
                    }
                  : undefined
              }
            />
          );
        })}
        {/*
          ONE FILLER, NOT N EMPTY BOXES.
          This used to draw a fixed-size placeholder per unused space, so a
          seven-capacity washer drew seven of them — and at six players the
          drum is 261px wide against 593px of content, clipped by
          `overflow: hidden` with no scrollbar. Thirty of those boxes sat
          outside their own drum, sliced mid-word, and the only honest answer
          on screen was the counter in the head.

          A single flexing remainder cannot overflow: it takes whatever is
          left after the real cards and says how much that is.
        */}
        {empties > 0 && (
          <div className="slot-rest" aria-label={`${empties} space${empties === 1 ? '' : 's'} free`}>
            {empties} free
          </div>
        )}
      </div>

      {machine.cards.length > 0 && (
        <div className="cards">
          {machine.cards.map((c, i) => (
            <span key={i} className={`card-chip${c.name === 'Wash net' ? ' net' : ''}`}>
              {cardName(c.name)} · P{c.owner + 1}
            </span>
          ))}
        </div>
      )}

      {refused && <div className="refusal">{refused}</div>}

      {/*
        The forecast text and the footer are SEPARATE boxes, and they have to
        stay that way. The board clamps this text to a couple of lines to buy
        the drum its height, and a clamp is `overflow: hidden` plus a height —
        so anything sharing that box with the text gets eaten when the text runs
        long. `footer` is the keyholder's Turn ON/OFF button, so when it lived
        in here it disappeared on exactly the washers with the most to say
        about themselves. Clamp text; never clamp a control.
      */}
      {/*
        THE FORECAST, TWO WORDS WIDE.
        This used to print the whole sentence — "Tonight: 2 of 3 wash · 1
        tangled and staying." plus a tier explanation — on every washer, which
        across seven of them was most of the reading on the board and got read
        on none of them. The chip carries the same judgement (both come from
        `tonight()`, so they cannot disagree) and the sentence is one tap away.
      */}
      <div className="tonight">
        <div className="tonight-text">
          <button
            type="button"
            className={`fc fc-${t.chip.tone}${why ? ' open' : ''}`}
            aria-expanded={why}
            title={t.headline}
            onClick={(e) => {
              // The washer itself is a click target during loading; asking why
              // must not also load a card into it.
              e.stopPropagation();
              setWhy((v) => !v);
            }}
          >
            {t.chip.text}
            <span className="fc-more" aria-hidden="true">
              {why ? '−' : '?'}
            </span>
          </button>
          {why && (
            <div className="fc-detail">
              <div>{t.headline}</div>
              {t.tierText && <div className="tier">{t.tierText}</div>}
            </div>
          )}
        </div>
        {footer}
      </div>
    </div>
  );
}
