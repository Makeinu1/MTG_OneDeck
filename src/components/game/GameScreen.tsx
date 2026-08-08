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
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGameController } from './gameController';
import { StatusBand } from './StatusBand';
import { StackBand } from './StackBand';
import { Board } from './Board';
import { OpponentBoardDialog } from './OpponentBoards';
import { SupportRow } from './SupportRow';
import { DecisionBar } from './DecisionBar';
import { useLayoutMemory } from './useLayoutMemory';
import { HandRibbon } from './HandRibbon';
import { ThumbZone } from './ThumbZone';
import { Feed } from './Feed';
import { TriggerSheet } from './TriggerSheet';
import { PresentationLayer } from './PresentationLayer';
import { SemanticPresentationLayer } from './presentation/SemanticPresentationLayer';
import { AmbientBackdrop } from './AmbientBackdrop';
import { DanceFloorLights } from './DanceFloorLights';
import { CommanderRitualLayer } from './presentation/CommanderRitualLayer';
import { Toast } from './Toast';
import type { KeybindingsMap } from '../../data/keybindings';
import type { CardInstance } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { CardView } from '../CardView';
import { TOUCH_DRAG_ACTIVATION } from '../touchDrag';
import { resolveDropIntent, type DropTarget } from './dragIntent';
import { createDragOverlayGeometry, type DragOverlayGeometry } from './dragOverlayModel';
import { DRAG_UI_END_EVENT, DRAG_UI_START_EVENT } from './dragUiEvents';
import './game.css';
import { AudioVisualProvider } from './presentation/AudioVisualProvider';
import { commanderOnBattlefield } from './presentation/twoPhaseBeat';

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
  onOpenOpponentSetup?: () => void;
}

export function TabletopSurface() {
  return (
    <div
      className="game-screen__tabletop-surface"
      data-testid="tabletop-surface"
      aria-hidden="true"
    />
  );
}

interface ActiveDragVisual {
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

export function GameScreen({ keybindings, onOpenOpponentSetup }: GameScreenProps) {
  const initialHandLayout = useMemo(
    () => new URLSearchParams(window.location.search).get('hand'),
    [],
  );
  const handWorkspaceAvailable = initialHandLayout !== 'flat';
  const [handWorkspaceOpen, setHandWorkspaceOpen] = useState(initialHandLayout === 'workspace');
  const [activeDrag, setActiveDrag] = useState<ActiveDragVisual | null>(null);
  const controller = useGameController({
    keybindings,
    externalShortcutsBlocked: handWorkspaceOpen,
  });
  useLayoutMemory(controller.state);
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

  const cmdOnBattlefield = controller.state ? commanderOnBattlefield(controller.state) : false;
  const [justArrived, setJustArrived] = useState(false);
  const prevCmdOnBattlefield = useRef(false);

  useEffect(() => {
    if (cmdOnBattlefield && !prevCmdOnBattlefield.current) {
      setJustArrived(true);
      const barMs = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--transport-bar-ms') || '2800',
      ) || 2800;
      const timer = setTimeout(() => setJustArrived(false), barMs);
      prevCmdOnBattlefield.current = cmdOnBattlefield;
      return () => clearTimeout(timer);
    }
    prevCmdOnBattlefield.current = cmdOnBattlefield;
  }, [cmdOnBattlefield]);

  if (!controller.state) return null;
  const activeDragId = activeDrag?.cardId ?? null;

  function handleDragStart(event: DragStartEvent): void {
    controller.closeTransientUi();
    const cardId = String(event.active.id);
    const instance = controller.state?.cards[cardId];
    const def = instance ? controller.state?.defs[instance.defId] : undefined;
    if (!instance || !def) return;
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
    const boardPerspective = cardElement?.closest('.game-screen__board, .game-screen__support');
    const faceTransform = boardPerspective
      ? 'none'
      : faceElement ? getComputedStyle(faceElement).transform : 'none';

    const geometry = createDragOverlayGeometry(
      initialBounds,
      cardElement ? { width: cardElement.offsetWidth, height: cardElement.offsetHeight } : null,
      transform,
      faceTransform,
      activatorClientPoint(event.activatorEvent),
    );
    // Capture the whole visual before CommanderAltar conceals its modal. The
    // overlay must never consult a source node whose layout can change mid-drag.
    setActiveDrag({ cardId, instance, def, geometry });
    document.dispatchEvent(new Event(DRAG_UI_START_EVENT));
  }

  function finishDrag(): void {
    setActiveDrag(null);
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
    <AudioVisualProvider>
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
        data-stack-active={controller.state.zones.stack.length > 0 || undefined}
        data-combat={controller.state.phase === 'combat' || undefined}
        data-commander-on-battlefield={cmdOnBattlefield || undefined}
        data-just-arrived={justArrived || undefined}
        data-decision-active={controller.decisionFocus ? controller.decisionFocus.kind : undefined}
        data-mulligan-active={controller.mulliganActive || undefined}
      >
        <div className="game-screen__status">
          <StatusBand controller={controller} />
        </div>
        <div className="game-screen__stack">
          <StackBand controller={controller} />
        </div>
        <TabletopSurface />
        {/* §8a 生きた背景(アンビエント層)。既存 UI は不変——TabletopSurface 直後・
            .game-screen の isolation 内 z-index:-1 に積層し全クロムの下に置く。 */}
        <AmbientBackdrop />
        <DanceFloorLights controller={controller} />
        {/* 盤面セルの子は Board だけ。相手盤面を兄として差し込むと Board(height:100%)が
            セルからはみ出し、自分の盤面が画面外へ消える(7b2c5c1 の回帰)。
            相手盤面はメニュー「相手盤面を見る」のモーダルで出す=design-vision:80 原則7。 */}
        <div className="game-screen__board">
          <Board controller={controller} activeDragId={activeDragId} />
        </div>
        <PresentationLayer controller={controller} />
        <SemanticPresentationLayer
          openingDealCount={controller.store.mulliganDecisionPending
            ? controller.state.zones.hand.length
            : undefined}
        />
        <CommanderRitualLayer />
        <Toast />
        <div className="game-screen__support">
          <SupportRow controller={controller} activeDragId={activeDragId} />
        </div>
        <div className="game-screen__decision">
          <DecisionBar controller={controller} />
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
          <ThumbZone controller={controller} onOpenOpponentSetup={onOpenOpponentSetup} />
        </div>

        {controller.feedOpen && <Feed controller={controller} onClose={controller.closeFeed} />}
        {controller.triggerSheetOpen && (
          <TriggerSheet controller={controller} onClose={controller.closeTriggerSheet ?? (() => {})} />
        )}
        {controller.opponentBoardOpen && (
          <OpponentBoardDialog controller={controller} onClose={controller.closeOpponentBoard} />
        )}
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
        {activeDrag ? (
          <div
            className="game-drag-overlay"
            data-testid="game-drag-overlay"
            style={{
              width: activeDrag.geometry.frameWidth,
              height: activeDrag.geometry.frameHeight,
            }}
          >
            <div
              className="game-drag-overlay__card"
              style={{
                width: activeDrag.geometry.cardWidth,
                height: activeDrag.geometry.cardHeight,
                left: activeDrag.geometry.gripOffsetX,
                top: activeDrag.geometry.gripOffsetY,
                transform: `translate(${-activeDrag.geometry.cardGripX}px, ${-activeDrag.geometry.cardGripY}px)`,
              }}
            >
              <div
                className="game-drag-overlay__visual"
                style={{ '--drag-face-transform': activeDrag.geometry.faceTransform } as React.CSSProperties}
              >
                <CardView instance={activeDrag.instance} def={activeDrag.def} size="battlefield" draggable={false} />
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </AudioVisualProvider>
  );
}
