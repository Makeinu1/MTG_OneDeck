import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import type { GameState } from '../../engine/types';
import { CardView } from '../CardView';
import { isCommander } from '../../engine/commander';
import { isSummoningSick } from '../../engine/status';
import type { HoverPreviewState } from '../../hooks/useHoverPreview';

export interface BattlefieldProps {
  state: GameState;
  onCardContextMenu: (
    cardId: string,
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  onCardDoubleClick: (cardId: string, e: React.MouseEvent) => void;
  hoverPreview: HoverPreviewState;
  creatureOverlay?: ReactNode;
  landOverlay?: ReactNode;
}

/** The battlefield: three droppable regions sharing the same battlefield zone. */
export function Battlefield({
  state,
  onCardContextMenu,
  onCardDoubleClick,
  hoverPreview,
  creatureOverlay,
  landOverlay,
}: BattlefieldProps) {
  const ids = state.zones.battlefield;
  const creatures: string[] = [];
  const lands: string[] = [];
  const nonCreatures: string[] = [];

  for (const id of ids) {
    const card = state.cards[id];
    if (!card) continue;
    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    const typeLine = face?.typeLine ?? def?.typeLine ?? '';
    if (typeLine.includes('Land')) {
      lands.push(id);
    } else if (typeLine.includes('Creature')) {
      creatures.push(id);
    } else {
      nonCreatures.push(id);
    }
  }

  return (
    <div className="battlefield" data-testid="zone-battlefield">
      <BattlefieldSection
        title="クリーチャー"
        variant="creatures"
        cardIds={creatures}
        state={state}
        onCardContextMenu={onCardContextMenu}
        onCardDoubleClick={onCardDoubleClick}
        hoverPreview={hoverPreview}
        dropId="battlefield-creature"
        overlay={creatureOverlay}
      />
      <BattlefieldSection
        title="非クリーチャー"
        variant="noncreatures"
        cardIds={nonCreatures}
        state={state}
        onCardContextMenu={onCardContextMenu}
        onCardDoubleClick={onCardDoubleClick}
        hoverPreview={hoverPreview}
        dropId="battlefield-noncreature"
      />
      <BattlefieldSection
        title="土地"
        variant="lands"
        cardIds={lands}
        state={state}
        onCardContextMenu={onCardContextMenu}
        onCardDoubleClick={onCardDoubleClick}
        hoverPreview={hoverPreview}
        dropId="battlefield-land"
        overlay={landOverlay}
      />
    </div>
  );
}

function BattlefieldSection({
  title,
  variant,
  cardIds,
  state,
  onCardContextMenu,
  onCardDoubleClick,
  hoverPreview,
  dropId,
  overlay,
}: {
  title: string;
  variant: 'creatures' | 'noncreatures' | 'lands';
  cardIds: string[];
  state: GameState;
  onCardContextMenu: (
    cardId: string,
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  onCardDoubleClick: (cardId: string, e: React.MouseEvent) => void;
  hoverPreview: HoverPreviewState;
  dropId: string;
  overlay?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data: { zone: 'battlefield' } });

  return (
    <div
      ref={setNodeRef}
      className={`battlefield__section battlefield__section--${variant} ${
        isOver ? 'battlefield__section--over' : ''
      }`}
    >
      <div className="battlefield__section-header">
        <span className="battlefield__section-label">{title}</span>
        {overlay && <div className="battlefield__section-overlay">{overlay}</div>}
      </div>
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
                onContextMenu={(e) => onCardContextMenu(id, e)}
                onDoubleClick={(e) => onCardDoubleClick(id, e)}
                onMouseEnter={(e) => hoverPreview.onMouseEnter(id, e)}
                onMouseLeave={hoverPreview.onMouseLeave}
                onPointerDown={(e) => hoverPreview.onPointerDown(id, e)}
                onPointerMove={hoverPreview.onPointerMove}
                onPointerUp={hoverPreview.onPointerUp}
                onPointerCancel={hoverPreview.onPointerCancel}
                badge={isCommander(state, id) ? '統率者' : undefined}
                summoningSick={isSummoningSick(state, id)}
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
                      onContextMenu={(e) => onCardContextMenu(attId, e)}
                      onDoubleClick={(e) => onCardDoubleClick(attId, e)}
                      onMouseEnter={(e) => hoverPreview.onMouseEnter(attId, e)}
                      onMouseLeave={hoverPreview.onMouseLeave}
                      onPointerDown={(e) => hoverPreview.onPointerDown(attId, e)}
                      onPointerMove={hoverPreview.onPointerMove}
                      onPointerUp={hoverPreview.onPointerUp}
                      onPointerCancel={hoverPreview.onPointerCancel}
                      summoningSick={isSummoningSick(state, attId)}
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
