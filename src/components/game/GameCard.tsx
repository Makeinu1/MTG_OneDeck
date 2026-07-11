/**
 * GameCard — 新レイアウトのカード1枚。CardView(共有レンダラ)を controller に配線する薄いラッパ。
 * タップ/右クリック→カードシート、ダブルクリック→クイックアクション。幅は親(棚/手札)が制御。
 */

import { useState } from 'react';
import { CardView } from '../CardView';
import { isCommander } from '../../engine/commander';
import { isSummoningSick } from '../../engine/status';
import type { GameController } from './gameController';

export interface GameCardProps {
  controller: GameController;
  cardId: string;
  /** 手札=大きめ / 盤面=棚幅。CSS class 側で幅を割り当てる。 */
  size?: 'board' | 'hand';
  /** プレイ可能ハイライト(金縁発光・D3)。 */
  playable?: boolean;
}

export function GameCard({ controller, cardId, size = 'board', playable = false }: GameCardProps) {
  const { state } = controller;
  // マウント時点の motionArmed を捕捉(以降 arm が変わっても再演出しない・D5 Tier-1 #1)。
  // 初期マウント/再開のカードは armed=false → 演出せず。以降に入るカードだけ celebrate クラス付与。
  const [celebrateOnMount] = useState(() => controller.motionArmed);
  if (!state) return null;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const def = state.defs[instance.defId];
  const commander = isCommander(state, cardId);

  const cls = `game-card game-card--${size}${playable ? ' game-card--playable' : ''}${
    celebrateOnMount ? ' game-card--celebrate' : ''
  }`;

  return (
    <div className={cls}>
      <CardView
        instance={instance}
        def={def}
        size="battlefield"
        draggable={false}
        badge={commander ? '統率者' : undefined}
        summoningSick={isSummoningSick(state, cardId)}
        onContextMenu={(e) => controller.openCardMenu(cardId, e)}
        onDoubleClick={(e) => controller.handleCardDoubleClick(cardId, e)}
      />
    </div>
  );
}
