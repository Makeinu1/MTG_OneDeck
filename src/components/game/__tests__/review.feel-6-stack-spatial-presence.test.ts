/** Judge-owned C1/C2 contract pin for feel-6 stack spatial presence. */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('feel-6 stack spatial presence contract', () => {
  it('pins the frozen stack focal values without changing card dimensions', () => {
    const css = read('src/components/game/game.css');
    const stack = read('src/components/game/StackBand.tsx');
    expect(css).toContain('.stack-pile__card--front');
    expect(css).toContain('stack-front-bob');
    expect(css).toContain('scale(1.06)');
    expect(css).toContain('±2px');
    expect(css).toContain('box-shadow: var(--stack-glow), var(--shadow-card)');
    expect(stack).toContain('stack-pile__card--front');
    expect(css).toContain('.stack-pile__list .stack-pile__card .game-card { width: 66px; }');
  });

  it('pins a nonblocking spell arrival ghost and reduced-motion fallback', () => {
    const css = read('src/components/game/game.css');
    const layer = read('src/components/game/presentation/SemanticPresentationLayer.tsx');
    expect(css).toContain('.stack-arrival-ghost');
    expect(css).toContain('stack-arrival-ghost-flight');
    expect(css).toContain('300ms');
    expect(css).toContain('.stack-arrival-ghost[data-reduced]');
    expect(layer).toContain('stack-arrival-ghost');
    expect(layer).toContain("event.kind === 'spell-cast'");
    expect(layer).toContain("pointerEvents: 'none'");
    expect(layer).toContain('data-card-id={stackArrival.cardId}');
  });
});
