/**
 * LandRow — 土地行(盤面下・手札上の横スクロール1行)。docs/design-system.md §8。
 * 同名の基本地形はずらし重ね(×n)、特殊地形は個別、統率者は左端に金枠で常駐。
 *
 * 乖離記録(D2): §206 の「束シート(一括タップ)」は本スライスでは未実装。束内の各カードは
 * 重ねたまま個別に右クリック/タップで操作可能(情報の非破壊は保つ)。一括タップの利便は D3/D4 へ。
 */

import { useDroppable } from '@dnd-kit/core';
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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

function Bundle({ controller, bundle }: { controller: GameController; bundle: LandBundle }) {
  const multi = bundle.cardIds.length > 1;
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="land-bundle"
      data-testid={`land-bundle-${bundle.key}`}
      data-tapped={bundle.tappedCount > 0}
      data-expanded={expanded}
    >
      <div className="land-bundle__cards">
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
        <div className="land-row__lands">
          {bundles.map((bundle) => (
            <Bundle key={bundle.key} controller={controller} bundle={bundle} />
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
