/**
 * GameCard — 新レイアウトのカード1枚。CardView(共有レンダラ)を controller に配線する薄いラッパ。
 * タップ/右クリック→カードシート、ダブルクリック→クイックアクション。幅は親(棚/手札)が制御。
 */

import { CardView } from '../CardView';
import { isCommander } from '../../engine/commander';
import { isSummoningSick } from '../../engine/status';
import type { GameController } from './gameController';

export interface GameCardProps {
  controller: GameController;
  cardId: string;
  /** 手札=大きめ / 盤面=棚幅。CSS class 側で幅を割り当てる。 */
  size?: 'board' | 'hand';
}

export function GameCard({ controller, cardId, size = 'board' }: GameCardProps) {
  const { state } = controller;
  if (!state) return null;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const def = state.defs[instance.defId];
  const commander = isCommander(state, cardId);

  return (
    <div className={`game-card game-card--${size}`}>
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
