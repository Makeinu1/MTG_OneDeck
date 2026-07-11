/**
 * HandRibbon — 横スクロールの手札。docs/ui-architecture-v2.md §2。
 * 左端にライブラリタイル(枚数+タップでライブラリ操作=引く/シャッフル/占術…)を置く。
 * プレイ可能ハイライト(金縁発光)は D3(マナ計算 selector)で付与。
 */

import { useMemo, useRef } from 'react';
import { GameCard } from './GameCard';
import { playableHandCardIds } from './affordability';
import { celebrate } from './sound';
import { shouldCompress } from './motion';
import type { GameController } from './gameController';

export interface HandRibbonProps {
  controller: GameController;
}

export function HandRibbon({ controller }: HandRibbonProps) {
  const { state, store } = controller;
  // マナ計算は毎レンダ全走査を避けるため memo 化(ui-architecture-v2 §6)。
  const playable = useMemo(
    () => (state ? playableHandCardIds(state) : new Set<string>()),
    [state],
  );
  const lastDrawRef = useRef<number | null>(null);
  if (!state) return null;

  function drawOne(): void {
    const now = Date.now();
    // 連続ドロー(圧縮)はハプティクスを畳んで疲れさせない・空ライブラリでは鳴らさない(§7・Tier-1 #3/#5)。
    const compressed = shouldCompress(lastDrawRef.current, now);
    lastDrawRef.current = now;
    if (state!.zones.library.length > 0 && !compressed) celebrate('draw');
    store.draw(1);
  }

  return (
    <div className="hand-ribbon" data-testid="hand-ribbon">
      <button
        type="button"
        className="hand-ribbon__library"
        data-testid="library-tile"
        onClick={drawOne}
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
          <GameCard key={cardId} controller={controller} cardId={cardId} size="hand" playable={playable.has(cardId)} />
        ))}
      </div>
    </div>
  );
}
