/**
 * GameCard — 新レイアウトのカード1枚。CardView(共有レンダラ)を controller に配線する薄いラッパ。
 * タップ/右クリック→カードシート、ダブルクリック→クイックアクション。幅は親(棚/手札)が制御。
 */

import { useEffect, useRef, useState } from 'react';
import { CardView } from '../CardView';
import { isCommander } from '../../engine/commander';
import { isSummoningSick } from '../../engine/status';
import type { GameController } from './gameController';
import { CardPreview } from './CardPreview';
import type { CardPreviewAnchor } from './cardPreviewPosition';
import { DRAG_UI_END_EVENT, DRAG_UI_START_EVENT } from './dragUiEvents';

const PREVIEW_DELAY_MS = 150;

export interface GameCardProps {
  controller: GameController;
  cardId: string;
  /** 手札=大きめ / 盤面=棚幅。CSS class 側で幅を割り当てる。 */
  size?: 'board' | 'hand';
  /** プレイ可能ハイライト(金縁発光・D3)。 */
  playable?: boolean;
  /** 統率者専用領域など、周囲の見出しで識別済みならカード内バッジを省略する。 */
  showCommanderBadge?: boolean;
  /** プレビュー等の複製カードでは無効化する。GameScreen上の実カードは既定で有効。 */
  draggable?: boolean;
}

export function GameCard({
  controller,
  cardId,
  size = 'board',
  playable = false,
  showCommanderBadge = true,
  draggable = true,
}: GameCardProps) {
  const { state } = controller;
  // マウント時点の motionArmed を捕捉(以降 arm が変わっても再演出しない・D5 Tier-1 #1)。
  // 初期マウント/再開のカードは armed=false → 演出せず。以降に入るカードだけ celebrate クラス付与。
  const [celebrateOnMount] = useState(() => controller.motionArmed);
  const [previewAnchor, setPreviewAnchor] = useState<CardPreviewAnchor | null>(null);
  const [previewPinned, setPreviewPinned] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragActiveRef = useRef(false);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handleDragStart = () => {
      if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
      dragActiveRef.current = true;
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
      setPreviewPinned(false);
      setPreviewAnchor(null);
    };
    const handleDragEnd = () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
      setPreviewPinned(false);
      setPreviewAnchor(null);
      // dnd-kit can emit the release click after onDragEnd. Keep the guard
      // through that click so dropping a card cannot immediately pin details.
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
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
    };
  }, []);
  // 固定中だけ購読する。カードBを押すとAのこの listener が発火してAが解けるため、
  // カード間で固定状態を同期しなくても「固定は常に1枚」が保たれる。
  useEffect(() => {
    if (!previewPinned) return;
    const unpin = () => {
      setPreviewPinned(false);
      setPreviewAnchor(null);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      unpin();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') unpin();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewPinned]);
  if (!state) return null;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const def = state.defs[instance.defId];
  const commander = isCommander(state, cardId);

  const cls = `game-card game-card--${size}${playable ? ' game-card--playable' : ''}${
    celebrateOnMount ? ' game-card--celebrate' : ''
  }`;

  function schedulePreview(anchor: CardPreviewAnchor): void {
    if (dragActiveRef.current) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => setPreviewAnchor(anchor), PREVIEW_DELAY_MS);
  }

  function closePreview(): void {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
    setPreviewAnchor(null);
  }

  function closeTransientPreview(): void {
    if (!previewPinned) closePreview();
  }

  function handleDoubleClick(event: React.MouseEvent): void {
    setPreviewPinned(false);
    closePreview();
    event.preventDefault();
    controller.handleCardDoubleClick(cardId, event);
  }

  function handleTouchTap(event: React.PointerEvent<HTMLDivElement>): void {
    if (dragActiveRef.current) return;
    if (previewPinned) {
      setPreviewPinned(false);
      closePreview();
      controller.openCardMenu(cardId, event);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPreviewPinned(true);
    setPreviewAnchor({ x: rect.right, y: rect.top + rect.height / 2 });
  }

  return (
    <div
      ref={rootRef}
      className={cls}
      onMouseEnter={(event) => schedulePreview({ x: event.clientX, y: event.clientY })}
      onMouseLeave={closeTransientPreview}
      onClick={(event) => {
        if (dragActiveRef.current || event.detail !== 1) return;
        if (previewPinned) {
          setPreviewPinned(false);
          closePreview();
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        setPreviewPinned(true);
        setPreviewAnchor({ x: rect.right, y: rect.top + rect.height / 2 });
      }}
      onFocus={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        schedulePreview({ x: rect.right, y: rect.top + rect.height / 2 });
      }}
      onBlur={closeTransientPreview}
    >
      <CardView
        instance={instance}
        def={def}
        size="battlefield"
        draggable={draggable}
        badge={undefined}
        summoningSick={isSummoningSick(state, cardId)}
        focusable
        onContextMenu={(e) => controller.openCardMenu(cardId, e)}
        onTouchTap={handleTouchTap}
        onDoubleClick={handleDoubleClick}
      />
      {commander && showCommanderBadge && (
        <span className="game-card__commander-marker" aria-label="統率者" title="統率者">統</span>
      )}
      {previewAnchor && <CardPreview instance={instance} def={def} anchor={previewAnchor} />}
    </div>
  );
}
