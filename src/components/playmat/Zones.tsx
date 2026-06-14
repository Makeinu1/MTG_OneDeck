import { useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { GameState, ZoneId } from '../../engine/types';
import { CardView } from '../CardView';
import { commanderTax, isCommander } from '../../engine/commander';
import { isSummoningSick } from '../../engine/status';
import type { HoverPreviewState } from '../../hooks/useHoverPreview';

const TOUCH_TAP_MAX_DISTANCE_PX = 8;
const TOUCH_TAP_MAX_DURATION_MS = 220;

/** Make a zone card a drop target for card drag-and-drop. */
function DroppableZoneCard({
  zone,
  className,
  testId,
  onContextMenu,
  onDoubleClick,
  onTouchTap,
  onClick,
  children,
}: {
  zone: ZoneId;
  className?: string;
  testId: string;
  onContextMenu?: (e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onTouchTap?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${zone}-zone`, data: { zone } });
  const touchStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startedAt: number;
  } | null>(null);
  const suppressClickRef = useRef(false);

  return (
    <div
      ref={setNodeRef}
      className={`zone-card ${className ?? ''} ${isOver ? 'zone-card--over' : ''}`}
      data-testid={testId}
      onClick={(e) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onDoubleClick={onDoubleClick}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') {
          touchStartRef.current = null;
          return;
        }
        touchStartRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startedAt: performance.now(),
        };
      }}
      onPointerUp={(e) => {
        const touchStart =
          touchStartRef.current?.pointerId === e.pointerId ? touchStartRef.current : null;
        touchStartRef.current = null;
        if (e.pointerType !== 'touch' || !touchStart || !onTouchTap) {
          return;
        }

        const distance = Math.hypot(e.clientX - touchStart.startX, e.clientY - touchStart.startY);
        const duration = performance.now() - touchStart.startedAt;
        if (distance >= TOUCH_TAP_MAX_DISTANCE_PX || duration > TOUCH_TAP_MAX_DURATION_MS) {
          return;
        }

        suppressClickRef.current = true;
        e.preventDefault();
        e.stopPropagation();
        onTouchTap(e);
      }}
      onPointerCancel={(e) => {
        if (touchStartRef.current?.pointerId === e.pointerId) {
          touchStartRef.current = null;
        }
        suppressClickRef.current = false;
      }}
    >
      {children}
    </div>
  );
}

export interface ZonesProps {
  state: GameState;
  onOpenViewer: (zone: 'graveyard' | 'exile' | 'library') => void;
  onOpenLibraryMenu: (
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  onCardContextMenu: (
    cardId: string,
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  onCommanderContextMenu: (
    cardId: string,
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  onCardDoubleClick: (cardId: string, e: React.MouseEvent) => void;
  hoverPreview: HoverPreviewState;
}

/** Right-hand utility zones: commander, library chip, and linked graveyard/exile chips. */
export function Zones({
  state,
  onOpenViewer,
  onOpenLibraryMenu,
  onCardContextMenu,
  onCommanderContextMenu,
  onCardDoubleClick,
  hoverPreview,
}: ZonesProps) {
  const graveyard = state.zones.graveyard;
  const exile = state.zones.exile;
  const command = state.zones.command;

  return (
    <div className="zones">
      <DroppableZoneCard zone="command" className="zone-card--command" testId="zone-command">
        <div className="zone-card__header">
          <span className="zone-card__label">統率領域</span>
          {command.length > 0 && <span className="zone-card__meta">キャスト</span>}
        </div>
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

      <div className="zones__stack">
        <DroppableZoneCard
          zone="library"
          className="zone-card--library"
          testId="zone-library"
          onContextMenu={onOpenLibraryMenu}
          onTouchTap={onOpenLibraryMenu}
          onClick={onOpenLibraryMenu}
        >
          <div className="zone-card__header">
            <span className="zone-card__label">ライブラリ</span>
            <span className="zone-card__meta">{state.zones.library.length}枚</span>
          </div>
          <div className="zone-card__face zone-card__face--library">
            <span className="zone-card__count">{state.zones.library.length}</span>
            <span className="zone-card__hint">タップで操作メニュー</span>
          </div>
        </DroppableZoneCard>

        <div className="zones__cemetery">
          <DroppableZoneCard
            zone="graveyard"
            className="zone-card--graveyard"
            testId="zone-graveyard"
            onClick={() => onOpenViewer('graveyard')}
          >
            <div className="zone-card__header">
              <span className="zone-card__label">墓地</span>
              <span className="zone-card__meta">{graveyard.length}枚</span>
            </div>
            <div className="zone-card__face zone-card__face--graveyard">
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
          </DroppableZoneCard>

          <DroppableZoneCard
            zone="exile"
            className="zone-card--exile"
            testId="zone-exile"
            onClick={() => onOpenViewer('exile')}
          >
            <div className="zone-card__header">
              <span className="zone-card__label">追放</span>
              <span className="zone-card__meta">{exile.length}枚</span>
            </div>
            <div className="zone-card__face zone-card__face--exile">
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
          </DroppableZoneCard>
        </div>
      </div>
    </div>
  );
}
