import type { DragStartEvent } from '@dnd-kit/core';
import type { CardInstance } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { createDragOverlayGeometry, type DragOverlayGeometry } from './dragOverlayModel';

export interface ActiveDragVisual {
  cardId: string;
  instance: CardInstance;
  def: CardDef;
  geometry: DragOverlayGeometry;
}

function activatorClientPoint(event: Event): { x: number; y: number } | null {
  const mouseEvent = event as Partial<MouseEvent>;
  if (typeof mouseEvent.clientX === 'number' && typeof mouseEvent.clientY === 'number') {
    return { x: mouseEvent.clientX, y: mouseEvent.clientY };
  }
  const touchEvent = event as TouchEvent;
  const touch = touchEvent.touches?.item(0) ?? touchEvent.changedTouches?.item(0);
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

export function captureDragVisual(
  event: DragStartEvent,
  cardId: string,
  instance: CardInstance,
  def: CardDef,
): ActiveDragVisual {
  const eventTarget = event.activatorEvent.target;
  const sourceCard =
    eventTarget instanceof Element ? eventTarget.closest<HTMLElement>('.card-view') : null;
  const fallbackCard = document.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`);
  const cardElement = sourceCard ?? fallbackCard;
  const transformedElement = cardElement?.closest<HTMLElement>('.hand-ribbon__slot') ?? cardElement;
  const sourceBounds = cardElement?.getBoundingClientRect();
  // The activator's actual DOM card is authoritative. A stale/duplicate
  // dnd-kit registration must never move the grip to another rendered copy.
  const initialBounds = sourceBounds ?? event.active.rect.current.initial ?? null;
  const transform = transformedElement ? getComputedStyle(transformedElement).transform : 'none';
  const faceElement = cardElement?.querySelector<HTMLElement>('.card-view__face');
  const boardPerspective = cardElement?.closest('.game-screen__board, .game-screen__support');
  const faceTransform = boardPerspective
    ? 'none'
    : faceElement
      ? getComputedStyle(faceElement).transform
      : 'none';

  const geometry = createDragOverlayGeometry(
    initialBounds,
    cardElement ? { width: cardElement.offsetWidth, height: cardElement.offsetHeight } : null,
    transform,
    faceTransform,
    activatorClientPoint(event.activatorEvent),
  );
  return { cardId, instance, def, geometry };
}

