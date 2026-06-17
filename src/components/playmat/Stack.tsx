import { useDroppable } from '@dnd-kit/core';
import type { CSSProperties } from 'react';
import type { AbilityKind, GameState } from '../../engine/types';
import { CardView } from '../CardView';
import type { HoverPreviewState } from '../../hooks/useHoverPreview';

const ABILITY_BADGES: Record<AbilityKind, string> = {
  activated: '起動',
  triggered: '誘発',
};

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
  const stackIds = state.zones.stack;
  const isEmpty = stackIds.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={`stack ${isEmpty ? 'stack--empty' : ''} ${isOver ? 'stack--over' : ''}`}
      data-testid="zone-stack"
      aria-hidden={isEmpty}
    >
      <div className="stack__controls">
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
