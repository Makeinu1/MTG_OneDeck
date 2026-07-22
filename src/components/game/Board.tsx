/**
 * Board — 盤面カード棚(BoardShelf)。docs/design-system.md §8。
 * 3層盤面の上段となるクリーチャー棚。通常は128px、枚数に応じて
 * 112/96/80pxへ縮小し、14束以上は重ねて横スクロールする。
 * 土地・その他・PWはSupportRowが担当する。abilityオブジェクトも除外。
 */

import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { GameCard } from './GameCard';
import { Modal } from '../Modal';
import {
  computeResponsiveLaneLayout,
  responsiveLaneMode,
  useElementSize,
} from './adaptiveLaneLayout';
import type { GameController } from './gameController';
import { isLandCard, type DropTarget } from './dragIntent';
import {
  bundleVisibleTokens,
  projectBattlefield,
  type AttachmentCluster,
  type VisualTokenBundle,
} from './battlefieldProjection';

function AttachmentFan({
  controller,
  cluster,
}: {
  controller: GameController;
  cluster: AttachmentCluster | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (!cluster || cluster.cardIds.length === 0) return null;
  return (
    <div className="attachment-cluster" data-open={open || undefined} data-testid={`attachments-${cluster.hostId}`}>
      <button
        type="button"
        className="attachment-cluster__toggle"
        aria-expanded={open}
        aria-label={`付与カード${cluster.cardIds.length}枚を${open ? '閉じる' : '開く'}`}
        onClick={() => setOpen((value) => !value)}
      >
        ＋{cluster.cardIds.length}
      </button>
      <div className="attachment-cluster__cards">
        {cluster.cardIds.map((cardId) => (
          <GameCard key={cardId} controller={controller} cardId={cardId} size="board" />
        ))}
      </div>
    </div>
  );
}

function VisualBundle({
  controller,
  bundle,
  attachment,
}: {
  controller: GameController;
  bundle: VisualTokenBundle;
  attachment?: AttachmentCluster;
}) {
  const [open, setOpen] = useState(false);
  const isBundle = bundle.cardIds.length > 1;
  return (
    <div
      className="visual-card-bundle"
      data-expanded={open || undefined}
      data-count={bundle.cardIds.length}
      data-testid={`visual-bundle-${bundle.representativeId}`}
    >
      <div className="visual-card-bundle__cards">
        {(open ? bundle.cardIds : [bundle.representativeId]).map((cardId) => (
          <div className="visual-card-bundle__slot" key={cardId}>
            <GameCard controller={controller} cardId={cardId} size="board" />
            <AttachmentFan controller={controller} cluster={cardId === bundle.representativeId ? attachment : undefined} />
          </div>
        ))}
      </div>
      {isBundle && (
        <button
          type="button"
          className="visual-card-bundle__count"
          aria-expanded={open}
          aria-label={`同じ状態のトークン${bundle.cardIds.length}体を${open ? '束ねる' : '展開する'}`}
          onClick={() => setOpen((value) => !value)}
        >
          ×{bundle.cardIds.length}
        </button>
      )}
    </div>
  );
}

interface ShelfProps {
  controller: GameController;
  cardIds?: string[];
  bundles?: VisualTokenBundle[];
  attachmentsByHost?: ReadonlyMap<string, AttachmentCluster>;
  testId: string;
  emptyLabel?: string;
  role?: 'creature' | 'support';
  sharedCardWidth?: number;
  sharedRows?: number;
}

export function BattlefieldShelf({
  controller,
  cardIds = [],
  bundles,
  attachmentsByHost,
  testId,
  emptyLabel,
  role = 'support',
  sharedCardWidth,
  sharedRows,
}: ShelfProps) {
  const { setNode: setShelfNode, width: shelfWidth, height: shelfHeight } = useElementSize<HTMLDivElement>();
  const [overviewOpen, setOverviewOpen] = useState(false);
  const visualBundles = bundles ?? (controller.state ? bundleVisibleTokens(controller.state, cardIds) : []);
  const count = visualBundles.length;
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
  const mode = responsiveLaneMode(viewportWidth, viewportHeight);
  const fallbackWidth = role === 'creature'
    ? mode === 'mobile-portrait' ? 72 : 168
    : mode === 'mobile-portrait' ? 60 : 112;
  const layout = computeResponsiveLaneLayout({
    mode,
    role,
    width: shelfWidth > 0 ? Math.max(1, shelfWidth - 16) : fallbackWidth * Math.max(1, count),
    height: shelfHeight > 0 ? Math.max(1, shelfHeight - 12) : fallbackWidth * (680 / 488),
    count,
  });
  const width = sharedCardWidth ?? layout.cardWidth;
  const rows = sharedRows ?? layout.rows;
  const denseOverview = sharedCardWidth === undefined ? layout.denseOverview : width < 44;
  return (
    <div className="board-shelf-wrap">
      {count === 0 && (
        <span className="board-shelf__empty" aria-hidden>
          {emptyLabel ?? (testId === 'board-creatures' ? 'クリーチャー' : 'その他')}
        </span>
      )}
      <div
        ref={setShelfNode}
        className="board-shelf"
        data-testid={testId}
        data-rows={rows}
        data-dense-overview={denseOverview || undefined}
        data-role={role}
        data-count={count}
        style={{
          ['--board-card-w' as string]: `${width}px`,
          ['--lane-columns' as string]: Math.max(1, Math.ceil(count / rows)),
          ['--lane-rows' as string]: rows,
        }}
      >
        <div className="board-shelf__lane">
          {visualBundles.map((bundle) => (
            <VisualBundle
              key={bundle.key}
              controller={controller}
              bundle={bundle}
              attachment={attachmentsByHost?.get(bundle.representativeId)}
            />
          ))}
        </div>
      </div>
      {denseOverview && (
        <button type="button" className="board-shelf__overview" onClick={() => setOverviewOpen(true)}>
          一覧で操作
        </button>
      )}
      {overviewOpen && (
        <Modal
          title={role === 'creature' ? 'クリーチャー一覧' : 'パーマネント一覧'}
          width="xl"
          testId={`${testId}-overview`}
          onClose={() => setOverviewOpen(false)}
        >
          <div className="board-overview__cards">
            {visualBundles.flatMap((bundle) => bundle.cardIds).map((cardId) => (
              <GameCard key={cardId} controller={controller} cardId={cardId} size="board" draggable={false} />
            ))}
          </div>
        </Modal>
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

  const projection = projectBattlefield(state);

  return (
    <div
      ref={setNodeRef}
      className="board"
      data-testid="board"
      data-drop-active={dropTarget !== null || undefined}
      data-drop-over={isOver || undefined}
    >
      <BattlefieldShelf
        controller={controller}
        bundles={projection.creatures}
        attachmentsByHost={projection.attachmentsByHost}
        testId="board-creatures"
        role="creature"
      />
      {dropTarget && (
        <div className="semantic-drop semantic-drop--board" data-testid="drop-cast" aria-hidden>
          {dropTarget.kind === 'cast' ? '盤面へ移動して唱える → スタック' : '盤面へ移動して戦場へ'}
        </div>
      )}
    </div>
  );
}
