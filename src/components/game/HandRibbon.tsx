/**
 * HandRibbon — 横スクロールの手札。docs/ui-architecture-v2.md §2。
 * 左端にライブラリタイル(枚数+タップでライブラリ操作=引く/シャッフル/占術…)を置く。
 * プレイ可能ハイライト(金縁発光)は D3(マナ計算 selector)で付与。
 */

import { GameCard } from './GameCard';
import type { GameController } from './gameController';

export interface HandRibbonProps {
  controller: GameController;
}

export function HandRibbon({ controller }: HandRibbonProps) {
  const { state, store } = controller;
  if (!state) return null;

  return (
    <div className="hand-ribbon" data-testid="hand-ribbon">
      <button
        type="button"
        className="hand-ribbon__library"
        data-testid="library-tile"
        onClick={() => store.draw(1)}
        onContextMenu={(e) => {
          e.preventDefault();
          controller.openLibraryActions(e);
        }}
        title="タップ=1枚引く / 右クリック=ライブラリ操作"
      >
        <span className="hand-ribbon__library-label">山</span>
        <span className="hand-ribbon__library-count" data-testid="library-count">
          {state.zones.library.length}
        </span>
      </button>

      <div className="hand-ribbon__cards">
        {state.zones.hand.map((cardId) => (
          <GameCard key={cardId} controller={controller} cardId={cardId} size="hand" />
        ))}
      </div>
    </div>
  );
}
