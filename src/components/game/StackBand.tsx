/**
 * StackBand — スタックの緊張帯(浮動 Stack.tsx の後継)。docs/design-system.md §8。
 * 空の時はほぼ不可視。呪文/能力が乗った瞬間だけ青白光で浮上=「処理待ちの緊張空間」。
 * 先頭(スタック最上段=次に解決)が最も手前。タップで各アイテムのシート。
 */

import { GameCard } from './GameCard';
import type { GameController } from './gameController';

export interface StackBandProps {
  controller: GameController;
}

export function StackBand({ controller }: StackBandProps) {
  const { state } = controller;
  if (!state) return null;
  const stack = state.zones.stack;
  if (stack.length === 0) {
    return <div className="stack-band stack-band--empty" data-testid="stack-band" aria-hidden />;
  }

  // 最上段(次に解決)を左に。zones.stack は末尾が最上段ゆえ反転。
  const ordered = [...stack].reverse();

  return (
    <div className="stack-band stack-band--active" data-testid="stack-band">
      <div className="stack-band__label">
        スタック <span className="stack-band__count">{stack.length}</span>
      </div>
      <div className="stack-band__items">
        {ordered.map((cardId) => (
          <GameCard key={cardId} controller={controller} cardId={cardId} size="board" />
        ))}
      </div>
      <button
        type="button"
        className="stack-band__resolve"
        data-testid="stack-band-resolve"
        onClick={() => controller.requestResolveTop()}
      >
        解決
      </button>
    </div>
  );
}
