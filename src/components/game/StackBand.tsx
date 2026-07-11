/**
 * StackBand — スタックの緊張帯(浮動 Stack.tsx の後継)。docs/design-system.md §8。
 * 空の時はほぼ不可視。呪文/能力が乗った瞬間だけ青白光で浮上=「処理待ちの緊張空間」。
 * 先頭(スタック最上段=次に解決)が最も手前。タップで各アイテムのシート。
 */

import { useEffect, useRef, useState } from 'react';
import { GameCard } from './GameCard';
import type { GameController } from './gameController';

export interface StackBandProps {
  controller: GameController;
}

export function StackBand({ controller }: StackBandProps) {
  // hooks は早期 return より前(条件付きフック禁止)。
  const stackLen = controller.state?.zones.stack.length ?? 0;
  const prevLen = useRef(stackLen);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    // 解決(length 減少)かつ帯が残る(>0)時に青白閃き(D5②)。最後の1件は着地ETBが祝う。
    if (stackLen < prevLen.current && stackLen > 0) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 500);
      prevLen.current = stackLen;
      return () => clearTimeout(timer);
    }
    prevLen.current = stackLen;
  }, [stackLen]);

  const { state } = controller;
  if (!state) return null;
  const stack = state.zones.stack;
  if (stack.length === 0) {
    return <div className="stack-band stack-band--empty" data-testid="stack-band" aria-hidden />;
  }

  // 最上段(次に解決)を左に。zones.stack は末尾が最上段ゆえ反転。
  const ordered = [...stack].reverse();

  return (
    <div className={`stack-band stack-band--active${flash ? ' stack-band--flash' : ''}`} data-testid="stack-band">
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
