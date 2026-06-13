import { useDroppable } from '@dnd-kit/core';
import type { GameState, ZoneId } from '../../engine/types';
import type { useGameStore } from '../../store/gameStore';
import { CardView } from '../CardView';
import { commanderTax, isCommander } from '../../engine/commander';
import { isSummoningSick } from '../../engine/status';
import type { HoverPreviewState } from '../../hooks/useHoverPreview';

type Store = ReturnType<typeof useGameStore.getState>;

/** Make a zone card a drop target for card drag-and-drop. */
function DroppableZoneCard({
  zone,
  className,
  testId,
  onContextMenu,
  onDoubleClick,
  children,
}: {
  zone: ZoneId;
  className?: string;
  testId: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${zone}-zone`, data: { zone } });
  return (
    <div
      ref={setNodeRef}
      className={`zone-card ${className ?? ''} ${isOver ? 'zone-card--over' : ''}`}
      data-testid={testId}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
}

export interface ZonesProps {
  state: GameState;
  store: Store;
  onOpenViewer: (zone: 'graveyard' | 'exile' | 'library') => void;
  onArrangeTop: () => void;
  onMill: () => void;
  onPeek: () => void;
  onCardContextMenu: (
    cardId: string,
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  onCommanderContextMenu: (
    cardId: string,
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  onCardDoubleClick: (cardId: string, e: React.MouseEvent) => void;
  onLibraryDoubleClick: (e: React.MouseEvent) => void;
  hoverPreview: HoverPreviewState;
}

/** Right-hand stack of non-battlefield zones, ordered: command (large, top), library,
 *  graveyard, exile. Right-click opens the action menu; library is double-click to draw. */
export function Zones({
  state,
  store,
  onOpenViewer,
  onArrangeTop,
  onMill,
  onPeek,
  onCardContextMenu,
  onCommanderContextMenu,
  onCardDoubleClick,
  onLibraryDoubleClick,
  hoverPreview,
}: ZonesProps) {
  const graveyard = state.zones.graveyard;
  const exile = state.zones.exile;
  const command = state.zones.command;

  return (
    <div className="zones">
      <DroppableZoneCard zone="command" className="zone-card--command" testId="zone-command">
        <span className="zone-card__label">統率領域</span>
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
                  size="hand"
                  onContextMenu={(e) => onCommanderContextMenu(id, e)}
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
                <span className="zone-card__tax" data-testid="commander-tax">
                  統率税 +{tax}
                </span>
              </div>
            );
          })}
        </div>
      </DroppableZoneCard>

      <div className="zones__row">
        <DroppableZoneCard
          zone="library"
          className="zone-card--library"
          testId="zone-library"
          onDoubleClick={onLibraryDoubleClick}
        >
          <div className="zone-card__face zone-card__face--library">
            <span className="zone-card__count">{state.zones.library.length}</span>
          </div>
          <span className="zone-card__label">ライブラリ</span>
          <div className="zone-card__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              data-testid="library-draw"
              onClick={(e) => {
                e.stopPropagation();
                store.draw(1);
              }}
            >
              引く
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              data-testid="library-shuffle"
              onClick={(e) => {
                e.stopPropagation();
                store.shuffleLibrary();
              }}
            >
              シャッフル
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              data-testid="library-view"
              onClick={(e) => {
                e.stopPropagation();
                onOpenViewer('library');
              }}
            >
              見る
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              data-testid="scry"
              onClick={(e) => {
                e.stopPropagation();
                onArrangeTop();
              }}
            >
              上から見る
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              data-testid="peek"
              onClick={(e) => {
                e.stopPropagation();
                onPeek();
              }}
            >
              上を見る
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              data-testid="mill"
              onClick={(e) => {
                e.stopPropagation();
                onMill();
              }}
            >
              切削
            </button>
          </div>
        </DroppableZoneCard>

        <DroppableZoneCard zone="graveyard" testId="zone-graveyard" onDoubleClick={() => onOpenViewer('graveyard')}>
          <div
            className="zone-card__face zone-card__face--graveyard"
            onClick={() => onOpenViewer('graveyard')}
          >
            {graveyard.length > 0 ? (
              <CardView
                instance={state.cards[graveyard[graveyard.length - 1]]}
                def={state.defs[state.cards[graveyard[graveyard.length - 1]].defId]}
                size="small"
                onContextMenu={(e) => onCardContextMenu(graveyard[graveyard.length - 1], e)}
                onMouseEnter={(e) => hoverPreview.onMouseEnter(graveyard[graveyard.length - 1], e)}
                onMouseLeave={hoverPreview.onMouseLeave}
                onPointerDown={(e) => hoverPreview.onPointerDown(graveyard[graveyard.length - 1], e)}
                onPointerMove={hoverPreview.onPointerMove}
                onPointerUp={hoverPreview.onPointerUp}
                onPointerCancel={hoverPreview.onPointerCancel}
              />
            ) : (
              <span className="zone-card__count">0</span>
            )}
          </div>
          <span className="zone-card__label">墓地 ({graveyard.length})</span>
        </DroppableZoneCard>

        <DroppableZoneCard zone="exile" testId="zone-exile" onDoubleClick={() => onOpenViewer('exile')}>
          <div
            className="zone-card__face zone-card__face--exile"
            onClick={() => onOpenViewer('exile')}
          >
            {exile.length > 0 ? (
              <CardView
                instance={state.cards[exile[exile.length - 1]]}
                def={state.defs[state.cards[exile[exile.length - 1]].defId]}
                size="small"
                onContextMenu={(e) => onCardContextMenu(exile[exile.length - 1], e)}
                onMouseEnter={(e) => hoverPreview.onMouseEnter(exile[exile.length - 1], e)}
                onMouseLeave={hoverPreview.onMouseLeave}
                onPointerDown={(e) => hoverPreview.onPointerDown(exile[exile.length - 1], e)}
                onPointerMove={hoverPreview.onPointerMove}
                onPointerUp={hoverPreview.onPointerUp}
                onPointerCancel={hoverPreview.onPointerCancel}
              />
            ) : (
              <span className="zone-card__count">0</span>
            )}
          </div>
          <span className="zone-card__label">追放 ({exile.length})</span>
        </DroppableZoneCard>
      </div>
    </div>
  );
}
