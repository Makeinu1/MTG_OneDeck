/**
 * HandRibbon — 横スクロールの手札。docs/ui-architecture-v2.md §2。
 * 左端にライブラリー・墓地・追放を空間的にまとめたZone Clusterを置く。
 * プレイ可能ハイライト(金縁発光)は D3(マナ計算 selector)で付与。
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { GameCard } from './GameCard';
import { CardView } from '../CardView';
import { playableHandCardIds } from './affordability';

import {
  appendedLocalDraws,
  drawFlightDestinationKind,
  drawStaggerMs,
  type DrawFlightDestinationKind,
} from './drawAnimationModel';
import type { GameController } from './gameController';
import { computeMobileHandLayout, handFanCardLayout } from './handFanLayout';
import { useElementSize } from './adaptiveLaneLayout';
import type { GameEvent } from '../../engine/types';

const DRAW_FLIGHT_MS = 650;

interface DrawFlightGeometry {
  eventId: string;
  cardId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fromX: number;
  fromY: number;
  midX: number;
  midY: number;
  delayMs: number;
  destinationKind: DrawFlightDestinationKind;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface HandRibbonProps {
  controller: GameController;
  workspaceOpen?: boolean;
  openWorkspaceButtonRef?: RefObject<HTMLButtonElement | null>;
  onOpenWorkspace?: () => void;
  onCloseWorkspace?: () => void;
}

export function HandRibbon({
  controller,
  workspaceOpen = false,
  openWorkspaceButtonRef,
  onOpenWorkspace,
  onCloseWorkspace = () => {},
}: HandRibbonProps) {
  const { state, store } = controller;
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const handCardsRef = useRef<HTMLDivElement | null>(null);
  const { setNode: setMeasuredHandNode, width: handCardsWidth } = useElementSize<HTMLDivElement>();
  const largeHandPileRef = useRef<HTMLDivElement | null>(null);
  const libraryTileRef = useRef<HTMLButtonElement | null>(null);
  const previousEventLogRef = useRef<readonly GameEvent[] | null>(null);
  const flightTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [handScrollEdges, setHandScrollEdges] = useState({ left: false, right: false });
  const [arrivingCardIds, setArrivingCardIds] = useState<Set<string>>(() => new Set());
  const [drawFlights, setDrawFlights] = useState<DrawFlightGeometry[]>([]);
  const { setNodeRef: setGraveyardDropRef, isOver: graveyardDropOver } = useDroppable({
    id: 'game-graveyard-drop',
    data: { dropTarget: { kind: 'move-zone', zone: 'graveyard' } },
  });
  const { setNodeRef: setExileDropRef, isOver: exileDropOver } = useDroppable({
    id: 'game-exile-drop',
    data: { dropTarget: { kind: 'move-zone', zone: 'exile' } },
  });
  const { setNodeRef: setHandDropRef, isOver: handDropOver } = useDroppable({
    id: 'game-hand-drop',
    data: { dropTarget: { kind: 'move-zone', zone: 'hand' } },
  });
  // マナ計算は毎レンダ全走査を避けるため memo 化(ui-architecture-v2 §6)。
  const playable = useMemo(
    () => (state ? playableHandCardIds(state) : new Set<string>()),
    [state],
  );
  const flatControl = useMemo(
    () => new URLSearchParams(window.location.search).get('hand') === 'flat',
    [],
  );
  const handCount = state?.zones.hand.length ?? 0;
  const openingHand = store.mulliganDecisionPending;
  const largeHandCollapsed = handCount > 15 && !workspaceOpen && !flatControl;
  const handLayout = flatControl
    ? 'flat'
    : workspaceOpen
      ? 'workspace'
      : largeHandCollapsed
        ? 'large'
        : 'fan';
  const flightDestinationKind = drawFlightDestinationKind(handCount, workspaceOpen, flatControl);

  function updateHandScrollEdges(): void {
    const node = handCardsRef.current;
    const next = node ? {
      left: node.scrollLeft > 1,
      right: node.scrollLeft + node.clientWidth < node.scrollWidth - 1,
    } : { left: false, right: false };
    setHandScrollEdges((current) => (
      current.left === next.left && current.right === next.right ? current : next
    ));
  }

  // ref コールバックを安定させる。毎レンダー新しい関数を渡すと React が
  // null→node で付け直し、dnd-kit が ResizeObserver を毎回 unobserve/observe する。
  const setHandCardsNode = useCallback((node: HTMLDivElement | null) => {
    handCardsRef.current = node;
    setHandDropRef(node);
    setMeasuredHandNode(node);
  }, [setHandDropRef, setMeasuredHandNode]);

  useLayoutEffect(() => {
    if (workspaceOpen) closeButtonRef.current?.focus();
  }, [workspaceOpen]);

  useLayoutEffect(() => {
    const node = handCardsRef.current;
    if (!node || handLayout === 'large') return;
    updateHandScrollEdges();
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateHandScrollEdges);
    observer?.observe(node);
    window.addEventListener('resize', updateHandScrollEdges);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHandScrollEdges);
    };
  }, [handCount, handLayout]);

  useEffect(() => () => {
    flightTimersRef.current.forEach(clearTimeout);
    flightTimersRef.current = [];
  }, []);

  useLayoutEffect(() => {
    if (!state) {
      previousEventLogRef.current = null;
      return;
    }
    const previous = previousEventLogRef.current;
    previousEventLogRef.current = state.eventLog;
    const arrivals = appendedLocalDraws(previous, state.eventLog, state.localPlayerId)
      .filter(({ cardId }) => state.cards[cardId]?.zone === 'hand');
    if (arrivals.length === 0 || !controller.motionArmed || prefersReducedMotion()) return;

    const arrivingIds = new Set(arrivals.map(({ cardId }) => cardId));
    if (flightDestinationKind === 'hand-card') {
      setArrivingCardIds((current) => new Set([...current, ...arrivingIds]));
    }

    const handNode = handCardsRef.current;
    if (handNode) {
      const handRect = handNode.getBoundingClientRect();
      const destinationRects = arrivals.flatMap(({ cardId }) => {
        const node = handNode.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`);
        return node ? [node.getBoundingClientRect()] : [];
      });
      const furthestRight = destinationRects.reduce((right, rect) => Math.max(right, rect.right), handRect.right);
      const furthestLeft = destinationRects.reduce((left, rect) => Math.min(left, rect.left), handRect.left);
      if (furthestRight > handRect.right) handNode.scrollLeft += furthestRight - handRect.right + 8;
      else if (furthestLeft < handRect.left) handNode.scrollLeft -= handRect.left - furthestLeft + 8;
    }

    const animationFrame = requestAnimationFrame(() => {
      const origin = libraryTileRef.current?.getBoundingClientRect();
      const currentHand = handCardsRef.current;
      const pileDestination = largeHandPileRef.current?.querySelector<HTMLElement>(
        '[data-testid="large-hand-pile-card"]',
      );
      if (!origin || (flightDestinationKind === 'hand-card' ? !currentHand : !pileDestination)) {
        setArrivingCardIds((current) => new Set([...current].filter((id) => !arrivingIds.has(id))));
        return;
      }
      const timelineDelay = arrivals.some(({ causeCommandType }) => causeCommandType === 'nextPhase')
        ? (controller.transitionCue?.drawAtMs ?? 0)
        : 0;
      const nextFlights = arrivals.flatMap((arrival, index) => {
        const destination = flightDestinationKind === 'large-hand-pile'
          ? pileDestination
          : currentHand?.querySelector<HTMLElement>(`[data-testid="card-${arrival.cardId}"]`);
        if (!destination) return [];
        const rect = destination.getBoundingClientRect();
        return [{
          eventId: arrival.eventId,
          cardId: arrival.cardId,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          fromX: origin.left + origin.width / 2 - (rect.left + rect.width / 2),
          fromY: origin.top + origin.height / 2 - (rect.top + rect.height / 2),
          midX: flightDestinationKind === 'large-hand-pile'
            ? (origin.left + origin.width / 2 - (rect.left + rect.width / 2)) * 0.35
            : window.innerWidth / 2 - (rect.left + rect.width / 2),
          midY: flightDestinationKind === 'large-hand-pile'
            ? (origin.top + origin.height / 2 - (rect.top + rect.height / 2)) * 0.35 - 18
            : window.innerHeight / 2 - (rect.top + rect.height / 2),
          delayMs: timelineDelay + drawStaggerMs(index),
          destinationKind: flightDestinationKind,
        }];
      });
      if (nextFlights.length === 0) {
        setArrivingCardIds((current) => new Set([...current].filter((id) => !arrivingIds.has(id))));
        return;
      }
      setDrawFlights((current) => [...current, ...nextFlights]);
      const releaseTimer = setTimeout(() => {
        const eventIds = new Set(nextFlights.map(({ eventId }) => eventId));
        setDrawFlights((current) => current.filter(({ eventId }) => !eventIds.has(eventId)));
        setArrivingCardIds((current) => new Set([...current].filter((id) => !arrivingIds.has(id))));
      }, Math.max(...nextFlights.map(({ delayMs }) => delayMs)) + DRAW_FLIGHT_MS + 40);
      flightTimersRef.current.push(releaseTimer);
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [controller.motionArmed, controller.transitionCue, flightDestinationKind, state]);

  if (!state) return null;

  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
  const mobilePortrait = viewportWidth < 900 && viewportHeight >= viewportWidth;
  const mobileHandLayout = mobilePortrait && handCardsWidth > 0
    ? computeMobileHandLayout({
        containerWidth: handCardsWidth,
        viewportHeight,
        count: state.zones.hand.length,
      })
    : null;

  function handleWorkspaceKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseWorkspace();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]'),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function drawOne(): void {
    controller.requestDraw(1);
  }

  return (
    <div
      className="hand-ribbon"
      data-testid="hand-ribbon"
      data-layout={handLayout}
      data-opening-hand={openingHand || undefined}
      id="hand-workspace"
      role={handLayout === 'workspace' ? 'dialog' : undefined}
      aria-modal={handLayout === 'workspace' ? true : undefined}
      aria-labelledby={handLayout === 'workspace' ? 'hand-workspace-title' : undefined}
      onKeyDown={handLayout === 'workspace' ? handleWorkspaceKeyDown : undefined}
    >
      {handLayout === 'workspace' && (
        <div className="hand-ribbon__workspace-heading" data-testid="hand-workspace-heading">
          <div>
            <strong id="hand-workspace-title">手札一覧</strong>
            <span>全体表示 · {state.zones.hand.length}枚</span>
          </div>
          <button
            type="button"
            className="hand-ribbon__close-workspace"
            data-testid="close-hand-workspace"
            aria-controls="hand-workspace"
            ref={closeButtonRef}
            onClick={onCloseWorkspace}
          >
            盤面へ
          </button>
        </div>
      )}
      <div className="hand-ribbon__zones" data-testid="zone-cluster" role="group" aria-label="カード領域">
        <div
          className="hand-ribbon__library-control"
          role="group"
          aria-label="ライブラリー"
          onContextMenu={(e) => {
            e.preventDefault();
            controller.openLibraryActions(e);
          }}
        >
          <button
            ref={libraryTileRef}
            type="button"
            className="hand-ribbon__zone hand-ribbon__zone--library"
            data-testid="library-tile"
            onClick={(e) => controller.openLibraryActions(e)}
            title="ライブラリー操作を開く"
            aria-haspopup="menu"
            aria-expanded={controller.libraryActionsOpen}
            aria-label={`ライブラリー${state.zones.library.length}枚。操作メニューを開く`}
          >
            <span>ライブラリー</span>
            <strong data-testid="library-count">{state.zones.library.length}</strong>
            <small>操作…</small>
          </button>
          <button
            type="button"
            className="hand-ribbon__draw-one"
            data-testid="library-draw-one"
            data-empty={state.zones.library.length === 0}
            aria-label={state.zones.library.length === 0
              ? '1枚引く。ライブラリーが空のため敗北判定が発生します'
              : 'ライブラリーから1枚引く'}
            title={state.zones.library.length === 0
              ? '空のライブラリーから引く（敗北判定）'
              : 'ライブラリーから1枚引く'}
            onClick={drawOne}
          >
            <span className="hand-ribbon__draw-glyph" aria-hidden="true">引</span>
            <span className="sr-only">1枚引く</span>
          </button>
        </div>
        <button
          ref={setGraveyardDropRef}
          type="button"
          className="hand-ribbon__zone hand-ribbon__zone--graveyard"
          data-testid="graveyard-tile"
          data-drop-over={graveyardDropOver || undefined}
          onClick={() => controller.openZoneViewer('graveyard')}
        >
          <span>墓地</span>
          <strong>{state.zones.graveyard.length}</strong>
        </button>
        <button
          ref={setExileDropRef}
          type="button"
          className="hand-ribbon__zone hand-ribbon__zone--exile"
          data-testid="exile-tile"
          data-drop-over={exileDropOver || undefined}
          onClick={() => controller.openZoneViewer('exile')}
        >
          <span>追放</span>
          <strong>{state.zones.exile.length}</strong>
        </button>
      </div>

      {handLayout === 'large' ? (
        <div
          ref={setHandDropRef}
          className="hand-ribbon__large-summary"
          data-testid="large-hand-summary"
          data-drop-over={handDropOver || undefined}
        >
          <div ref={largeHandPileRef} className="hand-ribbon__large-stack" aria-hidden="true">
            <span /><span /><span data-testid="large-hand-pile-card" /><span /><span />
          </div>
          <button
            type="button"
            className="hand-ribbon__open-workspace"
            data-testid="large-hand-open"
            ref={openWorkspaceButtonRef}
            onClick={onOpenWorkspace}
            disabled={!onOpenWorkspace}
          >
            <span>手札</span>
            <strong>{state.zones.hand.length}枚</strong>
            <small>一覧で広げる</small>
          </button>
        </div>
      ) : (
        <div
          ref={setHandCardsNode}
          className="hand-ribbon__cards"
          data-testid="hand-cards"
          data-drop-over={handDropOver || undefined}
          data-scroll-left={handScrollEdges.left || undefined}
          data-scroll-right={handScrollEdges.right || undefined}
          style={mobileHandLayout ? {
            '--hand-mobile-card-w': `${mobileHandLayout.cardWidth}px`,
            '--hand-mobile-margin': `${mobileHandLayout.marginLeft}px`,
          } as CSSProperties : undefined}
          onScroll={updateHandScrollEdges}
        >
          {state.zones.hand.map((cardId, index) => {
            const fan = handFanCardLayout(index, state.zones.hand.length);
            const style = handLayout === 'fan' ? {
              '--fan-rotation': `${fan.rotationDeg}deg`,
              '--fan-y': `${fan.translateY}px`,
              '--fan-margin': `${fan.marginLeft}px`,
              '--fan-z': fan.zIndex,
              '--fan-mobile-rotation': `${fan.rotationDeg * 0.38}deg`,
              '--fan-mobile-y': `${fan.translateY * 0.25}px`,
              '--fan-mobile-margin': `${Math.max(-24, fan.marginLeft * 0.42)}px`,
              '--deal-index': index,
            } as CSSProperties : undefined;
            return (
              <div
                className="hand-ribbon__slot"
                style={style}
                key={openingHand ? `opening-${state.mulliganCount}-${cardId}` : cardId}
              >
                <GameCard
                  controller={controller}
                  cardId={cardId}
                  size="hand"
                  playable={playable.has(cardId)}
                  arriving={arrivingCardIds.has(cardId)}
                />
              </div>
            );
          })}
        </div>
      )}
      {typeof document !== 'undefined' && createPortal(
        <div className="draw-flight-layer" aria-hidden="true">
          {drawFlights.map((flight) => {
            const instance = state.cards[flight.cardId];
            const def = instance ? state.defs[instance.defId] : undefined;
            if (!instance) return null;
            return (
              <div
                key={flight.eventId}
                className="draw-flight-card"
                data-testid={`draw-flight-${flight.cardId}`}
                data-destination={flight.destinationKind}
                style={{
                  left: flight.left,
                  top: flight.top,
                  width: flight.width,
                  height: flight.height,
                  '--draw-from-x': `${flight.fromX}px`,
                  '--draw-from-y': `${flight.fromY}px`,
                  '--draw-mid-x': `${flight.midX}px`,
                  '--draw-mid-y': `${flight.midY}px`,
                  '--draw-flight-delay': `${flight.delayMs}ms`,
                } as CSSProperties}
              >
                <CardView instance={instance} def={def} size="battlefield" draggable={false} />
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
