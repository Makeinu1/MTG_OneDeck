/**
 * Board — 盤面カード棚(BoardShelf)。docs/design-system.md §8。
 * クリーチャー行 / その他パーマネント行の2段(hairline・ラベルなし)。統一サイズの棚で、
 * 枚数に応じて基準幅 --board-card-w を 96/84/72px へ自動縮小、14枚〜は重ね。
 * 土地は LandRow が担当(ここには出さない)。ability オブジェクトも除外。
 */

import { useDroppable } from '@dnd-kit/core';
import { useRef } from 'react';
import type { GameState } from '../../engine/types';
import { GameCard } from './GameCard';
import { boardCardWidth, boardDensity, boardOverlapMargin, isBoardOverlap } from './boardShelf';
import type { GameController } from './gameController';
import { isLandCard, type DropTarget } from './dragIntent';

function typeLineOf(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.typeLine ?? def?.typeLine ?? '';
}

interface ShelfProps {
  controller: GameController;
  cardIds: string[];
  testId: string;
  emptyLabel?: string;
}

export function BattlefieldShelf({ controller, cardIds, testId, emptyLabel }: ShelfProps) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const width = boardCardWidth(cardIds.length);
  const density = boardDensity(cardIds.length);
  const overlap = isBoardOverlap(cardIds.length);
  const overflowExpected = cardIds.length >= 14;
  function scrollShelf(direction: -1 | 1): void {
    const shelf = shelfRef.current;
    if (!shelf) return;
    shelf.scrollBy({ left: direction * Math.max(240, shelf.clientWidth * 0.7), behavior: 'smooth' });
  }
  return (
    <div className="board-shelf-wrap">
      {cardIds.length === 0 && (
        <span className="board-shelf__empty" aria-hidden>
          {emptyLabel ?? (testId === 'board-creatures' ? 'クリーチャー' : 'その他')}
        </span>
      )}
      <div
        ref={shelfRef}
        className="board-shelf"
        data-testid={testId}
        data-density={density}
        data-overlap={overlap}
        data-count={cardIds.length}
        style={{
          ['--board-card-w' as string]: `${width}px`,
          ['--board-overlap-margin' as string]: `${boardOverlapMargin(width)}px`,
        }}
      >
        <div className="board-shelf__lane">
          {cardIds.map((cardId) => (
            <GameCard key={cardId} controller={controller} cardId={cardId} size="board" />
          ))}
        </div>
      </div>
      {overflowExpected && (
        <>
          <span className="board-shelf__count" aria-hidden>{cardIds.length}枚</span>
          <button
            type="button"
            className="board-shelf__nav board-shelf__nav--left"
            data-testid={`${testId}-scroll-left`}
            aria-label={`${cardIds.length}枚の盤面を左へ移動`}
            onClick={() => scrollShelf(-1)}
          >‹</button>
          <button
            type="button"
            className="board-shelf__nav board-shelf__nav--right"
            data-testid={`${testId}-scroll-right`}
            aria-label={`${cardIds.length}枚の盤面を右へ移動`}
            onClick={() => scrollShelf(1)}
          >›</button>
        </>
      )}
    </div>
  );
}

export interface BoardProps {
  controller: GameController;
  activeDragId?: string | null;
}

export function Board({ controller, activeDragId = null }: BoardProps) {
  const { state } = controller;
  const activeCard = state && activeDragId ? state.cards[activeDragId] : undefined;
  let dropTarget: DropTarget | null = null;
  if (state && activeCard && !isLandCard(state, activeCard.id)) {
    dropTarget = activeCard.zone === 'hand' || activeCard.zone === 'command'
      ? { kind: 'cast' }
      : activeCard.zone === 'battlefield'
        ? null
        : { kind: 'move-zone', zone: 'battlefield' };
  }
  const { setNodeRef, isOver } = useDroppable({
    id: 'game-board-drop',
    disabled: dropTarget === null,
    data: { dropTarget },
  });
  if (!state) return null;

  const permanents = state.zones.battlefield.filter((id) => {
    const card = state.cards[id];
    return card
      && card.controllerId === state.localPlayerId
      && !card.isAbility
      && !card.attachedTo;
  });
  const creatures: string[] = [];
  const others: string[] = [];
  for (const id of permanents) {
    const tl = typeLineOf(state, id);
    if (tl.includes('Land')) continue; // 土地は LandRow へ。
    if (tl.includes('Creature')) creatures.push(id);
    else others.push(id);
  }

  return (
    <div
      ref={setNodeRef}
      className="board"
      data-testid="board"
      data-drop-active={dropTarget !== null || undefined}
      data-drop-over={isOver || undefined}
    >
      <BattlefieldShelf controller={controller} cardIds={creatures} testId="board-creatures" />
      <div className="board__divider" aria-hidden />
      <BattlefieldShelf controller={controller} cardIds={others} testId="board-others" />
      {dropTarget && (
        <div className="semantic-drop semantic-drop--board" data-testid="drop-cast" aria-hidden>
          {dropTarget.kind === 'cast' ? '盤面へ移動して唱える → スタック' : '盤面へ移動して戦場へ'}
        </div>
      )}
    </div>
  );
}
