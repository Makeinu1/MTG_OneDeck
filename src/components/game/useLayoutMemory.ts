import { useEffect, useLayoutEffect, useRef } from 'react';
import type { GameState } from '../../engine/types';
import { HISTORY_UI_EVENT } from './historyUiEvents';

interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function useLayoutMemory(state: GameState | null): void {
  const previousRef = useRef<Map<string, LayoutRect>>(new Map());
  const suppressRef = useRef(false);

  useEffect(() => {
    const suppress = () => { suppressRef.current = true; };
    document.addEventListener(HISTORY_UI_EVENT, suppress);
    return () => document.removeEventListener(HISTORY_UI_EVENT, suppress);
  }, []);

  useLayoutEffect(() => {
    const next = new Map<string, LayoutRect>();
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
      '.game-screen__board [data-layout-card-id], .game-screen__support [data-layout-card-id]',
    ));
    for (const node of nodes) {
      const id = node.dataset.layoutCardId;
      if (!id || node.offsetParent === null || next.has(id)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      next.set(id, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      const previous = previousRef.current.get(id);
      if (!previous || suppressRef.current || reducedMotion() || typeof node.animate !== 'function') continue;
      const dx = previous.left - rect.left;
      const dy = previous.top - rect.top;
      const sx = previous.width / rect.width;
      const sy = previous.height / rect.height;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(sx - 1) < .02 && Math.abs(sy - 1) < .02) continue;
      node.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: 'top left' },
        { transform: 'translate(0, 0) scale(1)', transformOrigin: 'top left' },
      ], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    previousRef.current = next;
    suppressRef.current = false;
  }, [state]);
}
