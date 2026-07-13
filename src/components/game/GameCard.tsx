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
}

export function GameCard({
  controller,
  cardId,
  size = 'board',
  playable = false,
  showCommanderBadge = true,
}: GameCardProps) {
  const { state } = controller;
  // マウント時点の motionArmed を捕捉(以降 arm が変わっても再演出しない・D5 Tier-1 #1)。
  // 初期マウント/再開のカードは armed=false → 演出せず。以降に入るカードだけ celebrate クラス付与。
  const [celebrateOnMount] = useState(() => controller.motionArmed);
  const [previewAnchor, setPreviewAnchor] = useState<CardPreviewAnchor | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
  }, []);
  if (!state) return null;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const def = state.defs[instance.defId];
  const commander = isCommander(state, cardId);

  const cls = `game-card game-card--${size}${playable ? ' game-card--playable' : ''}${
    celebrateOnMount ? ' game-card--celebrate' : ''
  }`;

  function schedulePreview(anchor: CardPreviewAnchor): void {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => setPreviewAnchor(anchor), PREVIEW_DELAY_MS);
  }

  function closePreview(): void {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
    setPreviewAnchor(null);
  }

  function handleDoubleClick(event: React.MouseEvent): void {
    closePreview();
    event.preventDefault();
    controller.handleCardDoubleClick(cardId, event);
  }

  return (
    <div
      className={cls}
      onMouseEnter={(event) => schedulePreview({ x: event.clientX, y: event.clientY })}
      onMouseLeave={closePreview}
      onFocus={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        schedulePreview({ x: rect.right, y: rect.top + rect.height / 2 });
      }}
      onBlur={closePreview}
    >
      <CardView
        instance={instance}
        def={def}
        size="battlefield"
        draggable={false}
        badge={undefined}
        summoningSick={isSummoningSick(state, cardId)}
        focusable
        onContextMenu={(e) => controller.openCardMenu(cardId, e)}
        onDoubleClick={handleDoubleClick}
      />
      {commander && showCommanderBadge && (
        <span className="game-card__commander-marker" aria-label="統率者" title="統率者">統</span>
      )}
      {previewAnchor && <CardPreview instance={instance} def={def} anchor={previewAnchor} />}
    </div>
  );
}
