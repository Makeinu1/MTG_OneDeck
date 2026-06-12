import { useDroppable } from '@dnd-kit/core';
import type { GameState } from '../../engine/types';
import { CardView } from '../CardView';

export interface HandProps {
  state: GameState;
  onCardClick: (cardId: string, e: React.MouseEvent) => void;
}

/** The hand row, rendered along the bottom of the playmat. Droppable for D&D. */
export function Hand({ state, onCardClick }: HandProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'hand-zone', data: { zone: 'hand' } });
  const ids = state.zones.hand;

  return (
    <div
      ref={setNodeRef}
      className={`hand ${isOver ? 'hand--over' : ''}`}
      data-testid="zone-hand"
    >
      <span className="hand__label">手札 ({ids.length})</span>
      <div className="hand__cards">
        {ids.length === 0 && <div className="hand__placeholder">手札はありません</div>}
        {ids.map((id) => {
          const card = state.cards[id];
          const def = state.defs[card.defId];
          return (
            <CardView
              key={id}
              instance={card}
              def={def}
              size="hand"
              draggable
              onClick={(e) => onCardClick(id, e)}
            />
          );
        })}
      </div>
    </div>
  );
}
