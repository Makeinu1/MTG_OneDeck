import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { GameState, ZoneId } from '../../engine/types';
import type { useGameStore } from '../../store/gameStore';
import { CardView } from '../CardView';
import { commanderTax, isCommander } from '../../engine/commander';
import { LibraryMenu } from './dialogs';

type Store = ReturnType<typeof useGameStore.getState>;

/** Make a zone card a drop target for card drag-and-drop. */
function DroppableZoneCard({
  zone,
  className,
  testId,
  onClick,
  children,
}: {
  zone: ZoneId;
  className?: string;
  testId: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${zone}-zone`, data: { zone } });
  return (
    <div
      ref={setNodeRef}
      className={`zone-card ${className ?? ''} ${isOver ? 'zone-card--over' : ''}`}
      data-testid={testId}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export interface ZonesProps {
  state: GameState;
  store: Store;
  onOpenViewer: (zone: 'graveyard' | 'exile' | 'library') => void;
  onCommanderClick: (cardId: string, e: React.MouseEvent) => void;
}

/** Right-hand stack of non-battlefield zones: library, graveyard, exile, command zone. */
export function Zones({ state, store, onOpenViewer, onCommanderClick }: ZonesProps) {
  const [libraryMenu, setLibraryMenu] = useState<{ x: number; y: number } | null>(null);

  const graveyard = state.zones.graveyard;
  const exile = state.zones.exile;
  const command = state.zones.command;

  return (
    <div className="zones">
      <DroppableZoneCard
        zone="library"
        className="zone-card--library"
        testId="zone-library"
        onClick={(e) => setLibraryMenu({ x: e.clientX, y: e.clientY })}
      >
        <div className="zone-card__face zone-card__face--library">
          <span className="zone-card__count">{state.zones.library.length}</span>
        </div>
        <span className="zone-card__label">ライブラリ</span>
      </DroppableZoneCard>
      {libraryMenu && (
        <LibraryMenu
          x={libraryMenu.x}
          y={libraryMenu.y}
          onDraw={() => store.draw(1)}
          onShuffle={() => store.shuffleLibrary()}
          onView={() => onOpenViewer('library')}
          onClose={() => setLibraryMenu(null)}
        />
      )}

      <DroppableZoneCard zone="graveyard" testId="zone-graveyard" onClick={() => onOpenViewer('graveyard')}>
        <div className="zone-card__face zone-card__face--graveyard">
          {graveyard.length > 0 ? (
            <CardView instance={state.cards[graveyard[graveyard.length - 1]]} def={state.defs[state.cards[graveyard[graveyard.length - 1]].defId]} size="small" />
          ) : (
            <span className="zone-card__count">0</span>
          )}
        </div>
        <span className="zone-card__label">墓地 ({graveyard.length})</span>
      </DroppableZoneCard>

      <DroppableZoneCard zone="exile" testId="zone-exile" onClick={() => onOpenViewer('exile')}>
        <div className="zone-card__face zone-card__face--exile">
          {exile.length > 0 ? (
            <CardView instance={state.cards[exile[exile.length - 1]]} def={state.defs[state.cards[exile[exile.length - 1]].defId]} size="small" />
          ) : (
            <span className="zone-card__count">0</span>
          )}
        </div>
        <span className="zone-card__label">追放 ({exile.length})</span>
      </DroppableZoneCard>

      <DroppableZoneCard zone="command" className="zone-card--command" testId="zone-command">
        <div className="zone-card__face zone-card__face--command">
          {command.length === 0 && <span className="zone-card__count">0</span>}
          {command.map((id) => {
            const card = state.cards[id];
            const def = state.defs[card.defId];
            const tax = commanderTax(state, id);
            return (
              <div key={id} className="zone-card__commander">
                <CardView
                  instance={card}
                  def={def}
                  size="small"
                  onClick={(e) => onCommanderClick(id, e)}
                  badge={isCommander(state, id) ? '統率者' : undefined}
                />
                <span className="zone-card__tax" data-testid="commander-tax">
                  統率税 +{tax}
                </span>
              </div>
            );
          })}
        </div>
        <span className="zone-card__label">統率領域</span>
      </DroppableZoneCard>
    </div>
  );
}
