import { useState } from 'react';
import type { GameState } from '../../engine/types';
import type { useGameStore } from '../../store/gameStore';
import { CardView } from '../CardView';
import { commanderTax, isCommander } from '../../engine/commander';
import { LibraryMenu } from './dialogs';

type Store = ReturnType<typeof useGameStore.getState>;

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
      <div
        className="zone-card zone-card--library"
        data-testid="zone-library"
        onClick={(e) => setLibraryMenu({ x: e.clientX, y: e.clientY })}
      >
        <div className="zone-card__face zone-card__face--library">
          <span className="zone-card__count">{state.zones.library.length}</span>
        </div>
        <span className="zone-card__label">ライブラリ</span>
      </div>
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

      <div className="zone-card" data-testid="zone-graveyard" onClick={() => onOpenViewer('graveyard')}>
        <div className="zone-card__face zone-card__face--graveyard">
          {graveyard.length > 0 ? (
            <CardView instance={state.cards[graveyard[graveyard.length - 1]]} def={state.defs[state.cards[graveyard[graveyard.length - 1]].defId]} size="small" />
          ) : (
            <span className="zone-card__count">0</span>
          )}
        </div>
        <span className="zone-card__label">墓地 ({graveyard.length})</span>
      </div>

      <div className="zone-card" data-testid="zone-exile" onClick={() => onOpenViewer('exile')}>
        <div className="zone-card__face zone-card__face--exile">
          {exile.length > 0 ? (
            <CardView instance={state.cards[exile[exile.length - 1]]} def={state.defs[state.cards[exile[exile.length - 1]].defId]} size="small" />
          ) : (
            <span className="zone-card__count">0</span>
          )}
        </div>
        <span className="zone-card__label">追放 ({exile.length})</span>
      </div>

      <div className="zone-card zone-card--command" data-testid="zone-command">
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
      </div>
    </div>
  );
}
