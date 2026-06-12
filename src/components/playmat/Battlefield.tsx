import { useDroppable } from '@dnd-kit/core';
import type { GameState } from '../../engine/types';
import { CardView } from '../CardView';
import { isCommander } from '../../engine/commander';

export interface BattlefieldProps {
  state: GameState;
  onCardClick: (cardId: string, e: React.MouseEvent) => void;
}

/** The battlefield: lands on one row, non-lands on another, both droppable. */
export function Battlefield({ state, onCardClick }: BattlefieldProps) {
  const ids = state.zones.battlefield;
  const lands: string[] = [];
  const nonLands: string[] = [];

  for (const id of ids) {
    const card = state.cards[id];
    if (!card) continue;
    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    const typeLine = face?.typeLine ?? def?.typeLine ?? '';
    if (typeLine.includes('Land')) {
      lands.push(id);
    } else {
      nonLands.push(id);
    }
  }

  return (
    <div className="battlefield" data-testid="zone-battlefield">
      <BattlefieldRow title="非土地" cardIds={nonLands} state={state} onCardClick={onCardClick} dropId="battlefield-nonland" />
      <BattlefieldRow title="土地" cardIds={lands} state={state} onCardClick={onCardClick} dropId="battlefield-land" />
    </div>
  );
}

function BattlefieldRow({
  title,
  cardIds,
  state,
  onCardClick,
  dropId,
}: {
  title: string;
  cardIds: string[];
  state: GameState;
  onCardClick: (cardId: string, e: React.MouseEvent) => void;
  dropId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data: { zone: 'battlefield' } });

  return (
    <div ref={setNodeRef} className={`battlefield__row ${isOver ? 'battlefield__row--over' : ''}`}>
      <span className="battlefield__row-label">{title}</span>
      <div className="battlefield__cards">
        {cardIds.length === 0 && <div className="battlefield__placeholder" />}
        {cardIds.map((id) => {
          const card = state.cards[id];
          const def = state.defs[card.defId];
          const attachments = state.zones.battlefield.filter((other) => state.cards[other]?.attachedTo === id);
          return (
            <div key={id} className="battlefield__stack">
              <CardView
                instance={card}
                def={def}
                size="battlefield"
                draggable
                onClick={(e) => onCardClick(id, e)}
                badge={isCommander(state, id) ? '統率者' : undefined}
              />
              {attachments.map((attId) => {
                const attCard = state.cards[attId];
                const attDef = state.defs[attCard.defId];
                return (
                  <div key={attId} className="battlefield__attachment">
                    <CardView
                      instance={attCard}
                      def={attDef}
                      size="small"
                      onClick={(e) => onCardClick(attId, e)}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
