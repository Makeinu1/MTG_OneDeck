import { useDroppable } from '@dnd-kit/core';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { AbilityKind, GameState } from '../../engine/types';
import { CardView } from '../CardView';
import type { HoverPreviewState } from '../../hooks/useHoverPreview';

const ABILITY_BADGES: Record<AbilityKind, string> = {
  activated: '起動',
  triggered: '誘発',
};

const STACK_POSITION_KEY = 'mtg-onedeck-stack-pos';

type StackOffset = {
  dx: number;
  dy: number;
};

function defaultStackOffset(): StackOffset {
  return { dx: 0, dy: 0 };
}

function loadStackOffset(): StackOffset {
  if (typeof window === 'undefined') {
    return defaultStackOffset();
  }

  try {
    const raw = localStorage.getItem(STACK_POSITION_KEY);
    if (!raw) {
      return defaultStackOffset();
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Partial<StackOffset>).dx === 'number' &&
      Number.isFinite((parsed as Partial<StackOffset>).dx) &&
      typeof (parsed as Partial<StackOffset>).dy === 'number' &&
      Number.isFinite((parsed as Partial<StackOffset>).dy)
    ) {
      return {
        dx: (parsed as StackOffset).dx,
        dy: (parsed as StackOffset).dy,
      };
    }
  } catch {
    // localStorage unavailable or malformed - fall back to centered stack.
  }

  return defaultStackOffset();
}

export interface StackProps {
  state: GameState;
  onCardContextMenu: (
    cardId: string,
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  hoverPreview: HoverPreviewState;
  onResolveTop: () => void;
  onResolveAll: () => void;
}

export function Stack({
  state,
  onCardContextMenu,
  hoverPreview,
  onResolveTop,
  onResolveAll,
}: StackProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'stack-zone', data: { zone: 'stack' } });
  const [offset, setOffset] = useState<StackOffset>(() => loadStackOffset());
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    dx: number;
    dy: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const stackIds = state.zones.stack;
  const isEmpty = stackIds.length === 0;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(STACK_POSITION_KEY, JSON.stringify(offset));
    } catch {
      // localStorage unavailable or quota exceeded - keep the session position only.
    }
  }, [offset]);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) {
      return;
    }

    dragRef.current = {
      dx: offset.dx,
      dy: offset.dy,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setDragging(true);
    event.preventDefault();
    event.stopPropagation();
    if ('setPointerCapture' in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    setOffset({
      dx: drag.dx + (event.clientX - drag.startX),
      dy: drag.dy + (event.clientY - drag.startY),
    });
  }

  function finishDrag(event: React.PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    setDragging(false);
    if ('hasPointerCapture' in event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resetPosition(event: React.MouseEvent<HTMLButtonElement>): void {
    dragRef.current = null;
    setDragging(false);
    setOffset(defaultStackOffset());
    event.preventDefault();
    event.stopPropagation();
  }

  const stackStyle: CSSProperties = {
    transform: `translate(calc(-50% + ${offset.dx}px), calc(-50% + ${offset.dy}px))`,
  };

  return (
    <div
      ref={setNodeRef}
      className={`stack ${isEmpty ? 'stack--empty' : ''} ${isOver ? 'stack--over' : ''} ${
        dragging ? 'stack--dragging' : ''
      }`}
      data-testid="zone-stack"
      aria-hidden={isEmpty}
      style={stackStyle}
    >
      <div className="stack__controls">
        <button
          type="button"
          className="stack__handle"
          data-testid="stack-handle"
          aria-label="スタックを移動"
          title="ドラッグで移動 / ダブルクリックで中央に戻す"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onDoubleClick={resetPosition}
        >
          移動
        </button>
        <button type="button" data-testid="stack-resolve-top" onClick={onResolveTop}>
          上から解決
        </button>
        <button type="button" data-testid="stack-resolve-all" onClick={onResolveAll}>
          全解決
        </button>
      </div>

      <div className="stack__items">
        {stackIds.map((id, index) => {
          const card = state.cards[id];
          if (!card) return null;

          const source = card.sourceId ? state.cards[card.sourceId] : undefined;
          const def = source ? state.defs[source.defId] : state.defs[card.defId];
          const badge =
            card.isAbility && card.abilityKind
              ? ABILITY_BADGES[card.abilityKind]
              : card.isCopy
                ? 'コピー'
                : undefined;

          return (
            <div
              key={id}
              className={`stack__item ${index === stackIds.length - 1 ? 'stack__item--top' : ''}`}
              style={{ '--stack-index': index } as CSSProperties}
              data-testid={`stack-item-${id}`}
            >
              <CardView
                instance={card}
                def={def}
                size="hand"
                onContextMenu={(e) => onCardContextMenu(id, e)}
                onMouseEnter={(e) => hoverPreview.onMouseEnter(id, e)}
                onMouseLeave={hoverPreview.onMouseLeave}
                onPointerDown={(e) => hoverPreview.onPointerDown(id, e)}
                onPointerMove={hoverPreview.onPointerMove}
                onPointerUp={hoverPreview.onPointerUp}
                onPointerCancel={hoverPreview.onPointerCancel}
                badge={badge}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
