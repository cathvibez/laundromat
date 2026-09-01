import type { GameState, Machine } from '../rules/types';
import { cardName, itemLabel, tonight, willTangle } from '../rules/selectors';
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

      <div className="slots">
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
        {Array.from({ length: empties }, (_, i) => (
          <div key={`e${i}`} className="slot">
            empty
          </div>
        ))}
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
      <div className="tonight">
        <div className="tonight-text">
          <div>{t.headline}</div>
          {t.tierText && <div className="tier">{t.tierText}</div>}
        </div>
        {footer}
      </div>
    </div>
  );
}
