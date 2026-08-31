import type { GameState, Machine } from '../rules/types';
import { cardName, itemLabel, tonight, willTangle } from '../rules/selectors';
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
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={selectable && onSelect ? onSelect : undefined}
    >
      <div className="head">
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

      <div className="tonight">
        <div>{t.headline}</div>
        {t.tierText && <div className="tier">{t.tierText}</div>}
        {footer}
      </div>
    </div>
  );
}
