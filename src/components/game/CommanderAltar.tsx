import { useDroppable } from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';
import { isCommander } from '../../engine/commander';
import { GameCard } from './GameCard';
import type { GameController } from './gameController';
import { commanderAltarCollapsed, commanderAltarItems } from './commanderAltarModel';
import type { DropTarget } from './dragIntent';
import { DRAG_UI_END_EVENT, DRAG_UI_START_EVENT } from './dragUiEvents';

export function CommanderAltar({
  controller,
  activeDragId = null,
}: {
  controller: GameController;
  activeDragId?: string | null;
}) {
  const { state } = controller;
  const [open, setOpen] = useState(false);
  const [dragConcealed, setDragConcealed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFrameRef = useRef<number | null>(null);
  const dropCompletedRef = useRef(false);
  const activeCard = state && activeDragId ? state.cards[activeDragId] : undefined;
  // 統率者以外を受けると commanderAltarItems が描画しない=カードが盤上から消える。
  // 誘い(ハイライト・ラベル)自体を出さない。
  const dropTarget: DropTarget | null = state
    && activeCard
    && activeCard.zone !== 'command'
    && isCommander(state, activeCard.id)
    ? { kind: 'move-zone', zone: 'command' }
    : null;
  const { setNodeRef, isOver } = useDroppable({
    id: 'game-command-zone-drop',
    disabled: dropTarget === null,
    data: { dropTarget },
  });

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const closeAfterDrop = () => {
      dropCompletedRef.current = true;
      setDragConcealed(false);
      setOpen(false);
    };
    // On mobile the altar is a full-screen modal. Once its commander has been
    // lifted, keeping that modal visible hides the real cast target and stack.
    const hideWhileDragging = () => {
      if (!open) return;
      dropCompletedRef.current = false;
      setDragConcealed(true);
    };
    const restoreTriggerAfterDrag = () => {
      if (!open) return;
      restoreFrameRef.current = requestAnimationFrame(() => {
        restoreFrameRef.current = null;
        if (dropCompletedRef.current) return;
        setDragConcealed(false);
        triggerRef.current?.focus();
      });
    };
    document.addEventListener('onedeck-drop-complete', closeAfterDrop);
    document.addEventListener(DRAG_UI_START_EVENT, hideWhileDragging);
    document.addEventListener(DRAG_UI_END_EVENT, restoreTriggerAfterDrag);
    return () => {
      document.removeEventListener('onedeck-drop-complete', closeAfterDrop);
      document.removeEventListener(DRAG_UI_START_EVENT, hideWhileDragging);
      document.removeEventListener(DRAG_UI_END_EVENT, restoreTriggerAfterDrag);
      if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    };
  }, [open]);

  if (!state) return null;
  const items = commanderAltarItems(state);
  const collapsed = commanderAltarCollapsed(state);

  function close(): void {
    setDragConcealed(false);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <section
      ref={setNodeRef}
      className="commander-altar"
      data-testid="commander-altar"
      data-count={items.length}
      data-collapsed={collapsed || undefined}
      data-open={open || undefined}
      data-drag-concealed={dragConcealed || undefined}
      data-drop-active={dropTarget !== null || undefined}
      data-drop-over={isOver || undefined}
      aria-label="統率者領域"
    >
      <button
        type="button"
        className="commander-altar__trigger"
        data-testid="commander-altar-toggle"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls="commander-altar-panel"
        aria-label="統率者領域を表示"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden>統</span>
        <strong>{items.reduce((sum, item) => sum + item.tax, 0) > 0 ? `+${items.reduce((sum, item) => sum + item.tax, 0)}` : ''}</strong>
      </button>
      <div
        className="commander-altar__backdrop"
        data-testid="commander-altar-backdrop"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div
          className="commander-altar__panel"
          id="commander-altar-panel"
          role="dialog"
          aria-label="統率者領域"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            }
          }}
        >
          <header>
            <span>統率者</span>
            <button type="button" ref={closeRef} onClick={close}>閉じる</button>
          </header>
          <div className="commander-altar__cards">
            {items.map((item) => {
              return (
                <div
                  className="commander-altar__slot"
                  key={item.cardId}
                  data-testid={`commander-slot-${item.cardId}`}
                  data-zone={item.zone}
                >
                  {item.inCommandZone ? (
                    <GameCard
                      controller={controller}
                      cardId={item.cardId}
                      size="board"
                      showCommanderBadge={false}
                    />
                  ) : (
                    <button
                      type="button"
                      className="commander-altar__away"
                      data-testid={`commander-away-${item.cardId}`}
                      aria-label={`${item.name}。現在${item.zoneLabel}、統率者税${item.tax}。操作を開く`}
                      aria-haspopup="dialog"
                      onClick={(event) => controller.openCardMenu(item.cardId, event)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        controller.openCardMenu(item.cardId, event);
                      }}
                    >
                      <strong>{item.name}</strong>
                      <span>{item.zoneLabel}</span>
                    </button>
                  )}
                  <div className="commander-altar__meta">
                    <span>{item.zoneLabel}</span>
                    <strong>税 +{item.tax}</strong>
                  </div>
                </div>
              );
            })}
          </div>
          {dropTarget && (
            <div className="semantic-drop semantic-drop--command" aria-hidden>統率領域へ移す</div>
          )}
        </div>
      </div>
    </section>
  );
}
