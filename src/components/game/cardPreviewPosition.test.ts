import { describe, expect, it } from 'vitest';
import { cardPreviewPosition } from './cardPreviewPosition';

describe('cardPreviewPosition', () => {
  it('opens to the right when there is room', () => {
    expect(cardPreviewPosition({ x: 100, y: 400 }, { width: 1280, height: 800 }))
      .toEqual({ left: 118, top: 160 });
  });

  it('flips left and stays inside a compact viewport', () => {
    const result = cardPreviewPosition({ x: 1180, y: 780 }, { width: 1280, height: 800 });
    expect(result.left).toBeGreaterThanOrEqual(12);
    expect(result.left + 360).toBeLessThanOrEqual(1268);
    expect(result.top + 480).toBeLessThanOrEqual(788);
  });
});
