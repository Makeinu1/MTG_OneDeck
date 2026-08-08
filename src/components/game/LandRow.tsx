/**
 * LandRow — 土地行(盤面下・手札上の横スクロール1行)。docs/design-system.md §8。
 * 同名の基本地形はずらし重ね(×n)、特殊地形は個別、統率者は左端に金枠で常駐。
 *
 * §206 の「束シート(一括タップ)」は、折り畳み中の基本地形束クリックへ実装済み。
 * 展開時は束内の各カードを重ねたまま個別に右クリック/タップで操作できる(情報の非破壊を保つ)。
 */

import { useDroppable } from '@dnd-kit/core';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { GameCard } from './GameCard';
import {
  bundleLands,
  computeMobileLandLayout,
  landRowCards,
  type LandBundle,
} from './landRowModel';
import type { GameController } from './gameController';
import { isLandCard, type DropTarget } from './dragIntent';
import { useElementSize } from './adaptiveLaneLayout';
import { beatDensity } from './presentation/permanentBeat';
import { DEFAULT_AUDIO_VISUAL_TUNING } from './presentation/presentationTuning';
import { DRAG_UI_END_EVENT, DRAG_UI_START_EVENT } from './dragUiEvents';

function Bundle({ controller, bundle, bundleIndex }: { controller: GameController; bundle: LandBundle; bundleIndex: number }) {
  const multi = bundle.cardIds.length > 1;
  const [expanded, setExpanded] = useState(false);
  const dragActiveRef = useRef(false);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handleDragStart = () => {
      if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
      dragActiveRef.current = true;
    };
    const handleDragEnd = () => {
      if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = setTimeout(() => {
        dragActiveRef.current = false;
        dragEndTimerRef.current = null;
      }, 0);
    };
    document.addEventListener(DRAG_UI_START_EVENT, handleDragStart);
    document.addEventListener(DRAG_UI_END_EVENT, handleDragEnd);
    return () => {
      document.removeEventListener(DRAG_UI_START_EVENT, handleDragStart);
      document.removeEventListener(DRAG_UI_END_EVENT, handleDragEnd);
      if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
    };
  }, []);
  return (
    <div
      className="land-bundle"
      data-testid={`land-bundle-${bundle.key}`}
      data-tapped={bundle.tappedCount > 0}
      data-expanded={expanded}
      data-beat-index={bundleIndex}
      {...(bundle.tappedCount > 0 ? { 'data-beat-tapped': '' } : {})}
      style={{ '--beat-index': bundleIndex } as CSSProperties}
    >
      <div
        className="land-bundle__cards"
        onClickCapture={(event) => {
          if (dragActiveRef.current || !multi || expanded || event.detail !== 1 || !controller.requestToggleTapMany) return;
          if (event.target instanceof Element
            && event.target.closest('.game-card__quick-ability-marker')) return;
          const handled = controller.requestToggleTapMany(bundle.cardIds);
          if (!handled) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {bundle.cardIds.map((cardId, index) => (
          <div
            className="land-bundle__slot"
            style={{
              zIndex: bundle.cardIds.length - index,
              '--land-peek': `${Math.min(index, 3) * 6}px`,
            } as CSSProperties}
            key={cardId}
          >
            <GameCard controller={controller} cardId={cardId} size="board" />
          </div>
        ))}
      </div>
      {multi && (
        <button
          type="button"
          className="land-bundle__count"
          data-testid={`land-bundle-count-${bundle.key}`}
          aria-expanded={expanded}
          aria-label={`${bundle.name} ${bundle.cardIds.length}枚を${expanded ? '重ねる' : '広げる'}`}
          onClick={() => setExpanded((value) => !value)}
        >
          ×{bundle.cardIds.length}
        </button>
      )}
      {bundle.tappedCount > 0 && multi && (
        <span className="land-bundle__tapped" title="タップ済みを含む">
          {bundle.tappedCount}⤵
        </span>
      )}
    </div>
  );
}

export interface LandRowProps {
  controller: GameController;
  activeDragId?: string | null;
  cardIds?: readonly string[];
}

export function LandRow({ controller, activeDragId = null, cardIds }: LandRowProps) {
  const { state } = controller;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { setNode: setMeasuredRowNode, width: rowWidth, height: rowHeight } = useElementSize<HTMLDivElement>();
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const activeCard = state && activeDragId ? state.cards[activeDragId] : undefined;
  let dropTarget: DropTarget | null = null;
  if (state && activeCard && isLandCard(state, activeCard.id)) {
    dropTarget = activeCard.zone === 'hand' || activeCard.zone === 'graveyard'
      ? { kind: 'play-land' }
      : activeCard.zone === 'battlefield'
        ? null
        : { kind: 'move-zone', zone: 'battlefield' };
  }
  const { setNodeRef, isOver } = useDroppable({
    id: 'game-land-row-drop',
    disabled: dropTarget === null,
    data: { dropTarget },
  });

  const updateScrollState = useCallback(() => {
    const row = scrollRef.current;
    if (!row) return;
    setScrollState({
      left: row.scrollLeft > 2,
      right: row.scrollLeft + row.clientWidth < row.scrollWidth - 2,
    });
  }, []);
  const setRowNode = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setMeasuredRowNode(node);
  }, [setMeasuredRowNode]);

  useLayoutEffect(() => {
    const row = scrollRef.current;
    if (!row) return;
    updateScrollState();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(row);
    return () => observer.disconnect();
  }, [state?.zones.battlefield.length, updateScrollState]);

  if (!state) return null;

  const landCards = landRowCards(state, (cardIds ?? state.zones.battlefield)
    .filter((id) => state.cards[id]?.controllerId === state.localPlayerId));
  const bundles = bundleLands(landCards);
  const density = bundles.length <= 6 ? 'spacious' : bundles.length <= 10 ? 'balanced' : 'dense';
  const mobilePortrait = typeof window !== 'undefined'
    && window.innerWidth < 900
    && window.innerHeight >= window.innerWidth;
  const mobileLayout = mobilePortrait && rowWidth > 0 && rowHeight > 0
    ? computeMobileLandLayout({ containerWidth: rowWidth, containerHeight: rowHeight, count: bundles.length })
    : null;

  function scroll(direction: -1 | 1): void {
    scrollRef.current?.scrollBy({
      left: direction * Math.max(220, (scrollRef.current?.clientWidth ?? 0) * 0.72),
      behavior: 'smooth',
    });
  }

  return (
    <div
      ref={setNodeRef}
      className="land-row-wrap"
      data-empty={bundles.length === 0 || undefined}
      data-drop-active={dropTarget !== null || undefined}
      data-drop-over={isOver || undefined}
    >
      <div
        ref={setRowNode}
        className="land-row"
        data-density={density}
        data-testid="land-row"
        style={mobileLayout ? {
          '--land-card-w': `${mobileLayout.cardWidth}px`,
          '--land-bundle-w': `${mobileLayout.bundleWidth}px`,
        } as CSSProperties : undefined}
        onScroll={updateScrollState}
      >
        <div
          className="land-row__lands"
          style={{ '--beat-density': beatDensity(bundles.length, DEFAULT_AUDIO_VISUAL_TUNING) } as CSSProperties}
        >
          {bundles.map((bundle, index) => (
            <Bundle key={bundle.key} controller={controller} bundle={bundle} bundleIndex={index} />
          ))}
        </div>
      </div>
      {dropTarget && (
        <div className="semantic-drop semantic-drop--lands" data-testid="drop-play-land" aria-hidden />
      )}
      {scrollState.left && (
        <button type="button" className="land-row__nav land-row__nav--left" onClick={() => scroll(-1)} aria-label="土地を左へ移動">‹</button>
      )}
      {scrollState.right && (
        <button type="button" className="land-row__nav land-row__nav--right" onClick={() => scroll(1)} aria-label="土地を右へ移動">›</button>
      )}
    </div>
  );
}
