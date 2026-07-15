/**
 * GameScreen — 新レイアウトの唯一のルート(縦/横/デスクトップを CSS grid-template-areas で適応)。
 * docs/ui-architecture-v2.md §2・docs/design-playbook.md §3 D2。
 *
 * 規律: JSX での isPhone 分岐をしない(単一 adaptive tree)。3形態の出し分けは game.css の
 * grid-template-areas / media query のみで行う。ガイド解決ダイアログ等は controller.overlays。
 */

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGameController } from './gameController';
import { StatusBand } from './StatusBand';
import { StackBand } from './StackBand';
import { Board } from './Board';
import { LandRow } from './LandRow';
import { HandRibbon } from './HandRibbon';
import { ThumbZone } from './ThumbZone';
import { Feed } from './Feed';
import { CommanderAltar } from './CommanderAltar';
import { TransitionCue } from './TransitionCue';
import type { KeybindingsMap } from '../../data/keybindings';
import { CardView } from '../CardView';
import { TOUCH_DRAG_ACTIVATION } from '../touchDrag';
import { resolveDropIntent, type DropTarget } from './dragIntent';
import { createDragOverlayGeometry, type DragOverlayGeometry } from './dragOverlayModel';
import { DRAG_UI_END_EVENT, DRAG_UI_START_EVENT } from './dragUiEvents';
import { UpdateNotice } from './UpdateNotice';
import './game.css';

const ResearchRecorder = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('../../dev/uxResearch/ResearchRecorder');
      return { default: module.ResearchRecorder };
    })
  : null;

function uxResearchModeEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('ux-research') === '1';
}

export interface GameScreenProps {
  keybindings: KeybindingsMap;
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

export function GameScreen({ keybindings }: GameScreenProps) {
  const initialHandLayout = useMemo(
    () => new URLSearchParams(window.location.search).get('hand'),
    [],
  );
  const handWorkspaceAvailable = initialHandLayout !== 'flat';
  const [handWorkspaceOpen, setHandWorkspaceOpen] = useState(initialHandLayout === 'workspace');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragOverlayGeometry, setDragOverlayGeometry] = useState<DragOverlayGeometry | null>(null);
  const controller = useGameController({
    keybindings,
    externalShortcutsBlocked: handWorkspaceOpen,
  });
  const localHandWorkspaceButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreHandFocusRef = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_DRAG_ACTIVATION }),
    useSensor(KeyboardSensor),
  );

  useLayoutEffect(() => {
    if (!handWorkspaceOpen && restoreHandFocusRef.current) {
      restoreHandFocusRef.current = false;
      localHandWorkspaceButtonRef.current?.focus();
    }
  }, [handWorkspaceOpen]);

  function closeHandWorkspace(): void {
    setHandWorkspaceOpen(false);
  }

  function openHandWorkspace(): void {
    restoreHandFocusRef.current = true;
    setHandWorkspaceOpen(true);
  }

  if (!controller.state) return null;
  const activeCard = activeDragId ? controller.state.cards[activeDragId] : undefined;
  const activeDef = activeCard ? controller.state.defs[activeCard.defId] : undefined;

  function handleDragStart(event: DragStartEvent): void {
    controller.closeTransientUi();
    const cardId = String(event.active.id);
    const eventTarget = event.activatorEvent.target;
    const sourceCard = eventTarget instanceof Element
      ? eventTarget.closest<HTMLElement>('.card-view')
      : null;
    const fallbackCard = document.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`);
    const cardElement = sourceCard ?? fallbackCard;
    const transformedElement = cardElement?.closest<HTMLElement>('.hand-ribbon__slot') ?? cardElement;
    const sourceBounds = cardElement?.getBoundingClientRect();
    // The activator's actual DOM card is authoritative. A stale/duplicate
    // dnd-kit registration must never move the grip to another rendered copy.
    const initialBounds = sourceBounds ?? event.active.rect.current.initial ?? null;
    const transform = transformedElement ? getComputedStyle(transformedElement).transform : 'none';
    const faceElement = cardElement?.querySelector<HTMLElement>('.card-view__face');
    const faceTransform = faceElement ? getComputedStyle(faceElement).transform : 'none';

    setDragOverlayGeometry(createDragOverlayGeometry(
      initialBounds,
      cardElement ? { width: cardElement.offsetWidth, height: cardElement.offsetHeight } : null,
      transform,
      faceTransform,
      activatorClientPoint(event.activatorEvent),
    ));
    setActiveDragId(cardId);
    document.dispatchEvent(new Event(DRAG_UI_START_EVENT));
  }

  function finishDrag(): void {
    setActiveDragId(null);
    setDragOverlayGeometry(null);
    document.dispatchEvent(new Event(DRAG_UI_END_EVENT));
  }

  function handleDragEnd(event: DragEndEvent): void {
    const cardId = String(event.active.id);
    finishDrag();
    const target = event.over?.data.current?.dropTarget as DropTarget | undefined;
    const state = controller.state;
    if (!state) return;
    const intent = resolveDropIntent(state, cardId, target ?? null);
    controller.performDrop(intent);
    if (intent.kind !== 'none') document.dispatchEvent(new Event('onedeck-drop-complete'));
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={finishDrag}
    >
      <div
        className="game-screen"
        data-testid="game-screen"
        data-hand-workspace-open={handWorkspaceOpen || undefined}
        data-drag-active={activeDragId || undefined}
      >
        <div className="game-screen__status">
          <StatusBand controller={controller} />
        </div>
        <div className="game-screen__stack">
          <StackBand controller={controller} />
        </div>
        <div className="game-screen__board">
          <Board controller={controller} activeDragId={activeDragId} />
        </div>
        <TransitionCue cue={controller.transitionCue} onDone={controller.dismissTransitionCue} />
        <UpdateNotice />
        <div className="game-screen__lands">
          <CommanderAltar controller={controller} activeDragId={activeDragId} />
          <LandRow controller={controller} activeDragId={activeDragId} />
        </div>
        <div className="game-screen__hand">
          <HandRibbon
            controller={controller}
            workspaceOpen={handWorkspaceOpen}
            openWorkspaceButtonRef={localHandWorkspaceButtonRef}
            onOpenWorkspace={handWorkspaceAvailable
              ? openHandWorkspace
              : undefined}
            onCloseWorkspace={closeHandWorkspace}
          />
        </div>
        <div className="game-screen__thumb">
          <ThumbZone controller={controller} />
        </div>

        {controller.feedOpen && <Feed controller={controller} onClose={controller.closeFeed} />}
        {controller.overlays}
        {ResearchRecorder && uxResearchModeEnabled() && (
          <Suspense fallback={null}>
            <ResearchRecorder controller={controller} />
          </Suspense>
        )}
      </div>
      {/* A successful drop can remount the same card in its destination before
          dnd-kit's default drop animation finishes. That animation chases the
          remounted card away from the released pointer, which feels like a
          one-card grip offset. The semantic transition owns the feedback, so
          the transient drag copy must disappear immediately on release. */}
      <DragOverlay adjustScale={false} dropAnimation={null}>
        {activeCard && activeDef && dragOverlayGeometry ? (
          <div
            className="game-drag-overlay"
            data-testid="game-drag-overlay"
            style={{
              width: dragOverlayGeometry.frameWidth,
              height: dragOverlayGeometry.frameHeight,
            }}
          >
            <div
              className="game-drag-overlay__card"
              style={{
                width: dragOverlayGeometry.cardWidth,
                height: dragOverlayGeometry.cardHeight,
                left: dragOverlayGeometry.gripOffsetX,
                top: dragOverlayGeometry.gripOffsetY,
                transform: `translate(${-dragOverlayGeometry.cardGripX}px, ${-dragOverlayGeometry.cardGripY}px)`,
              }}
            >
              <div
                className="game-drag-overlay__visual"
                style={{ '--drag-face-transform': dragOverlayGeometry.faceTransform } as React.CSSProperties}
              >
                <CardView instance={activeCard} def={activeDef} size="battlefield" draggable={false} />
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
