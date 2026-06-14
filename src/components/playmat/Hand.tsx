import { useDroppable } from '@dnd-kit/core';
import type { CSSProperties, ReactNode } from 'react';
import type { GameState } from '../../engine/types';
import { CardView } from '../CardView';
import type { HoverPreviewState } from '../../hooks/useHoverPreview';

export interface HandProps {
  state: GameState;
  onCardContextMenu: (
    cardId: string,
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  onCardDoubleClick: (cardId: string, e: React.MouseEvent) => void;
  hoverPreview: HoverPreviewState;
  overlay?: ReactNode;
}

/** The hand row, rendered along the bottom of the playmat. Droppable for D&D.
 *  Cards overlap when there isn't enough room and lift on hover. */
export function Hand({ state, onCardContextMenu, onCardDoubleClick, hoverPreview, overlay }: HandProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'hand-zone', data: { zone: 'hand' } });
  const ids = state.zones.hand;

  return (
    <div ref={setNodeRef} className={`hand ${isOver ? 'hand--over' : ''}`} data-testid="zone-hand">
      <div className="hand__topbar">
        <span className="hand__label">手札 ({ids.length})</span>
        {overlay && <div className="hand__overlay">{overlay}</div>}
      </div>
      <div className="hand__cards">
        {ids.length === 0 && <div className="hand__placeholder">手札はありません</div>}
        {ids.map((id, index) => {
          const card = state.cards[id];
          const def = state.defs[card.defId];
          return (
            <div
              key={id}
              className="hand__slot"
              style={
                {
                  '--hand-index': index,
                  '--hand-count': ids.length,
                } as CSSProperties
              }
            >
              <CardView
                instance={card}
                def={def}
                size="hand"
                draggable
                onContextMenu={(e) => onCardContextMenu(id, e)}
                onDoubleClick={(e) => onCardDoubleClick(id, e)}
                onMouseEnter={(e) => hoverPreview.onMouseEnter(id, e)}
                onMouseLeave={hoverPreview.onMouseLeave}
                onPointerDown={(e) => hoverPreview.onPointerDown(id, e)}
                onPointerMove={hoverPreview.onPointerMove}
                onPointerUp={hoverPreview.onPointerUp}
                onPointerCancel={hoverPreview.onPointerCancel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
