import { useDroppable } from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';
import { isCommander } from '../../engine/commander';
import { GameCard } from './GameCard';
import type { GameController } from './gameController';
import { commanderAltarItems } from './commanderAltarModel';
import type { DropTarget } from './dragIntent';

export function CommanderAltar({
  controller,
  activeDragId = null,
}: {
  controller: GameController;
  activeDragId?: string | null;
}) {
  const { state } = controller;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
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
    const closeAfterDrop = () => setOpen(false);
    document.addEventListener('onedeck-drop-complete', closeAfterDrop);
    return () => document.removeEventListener('onedeck-drop-complete', closeAfterDrop);
  }, []);

  if (!state) return null;
  const items = commanderAltarItems(state);

  function close(): void {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <section
      ref={setNodeRef}
      className="commander-altar"
      data-testid="commander-altar"
      data-count={items.length}
      data-open={open || undefined}
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
