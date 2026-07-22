import { describe, expect, it } from 'vitest';
import {
  computeMobileHandLayout,
  estimatedFanWidth,
  exposedCardWidth,
  handFanCardLayout,
} from './handFanLayout';

describe('hand fan layout', () => {
  it.each([7, 10, 15])('keeps %i cards within the target desktop width', (count) => {
    expect(estimatedFanWidth(count)).toBeLessThanOrEqual(800.01);
    expect(exposedCardWidth(count)).toBeGreaterThanOrEqual(44);
  });

  it('keeps DOM order while rotating symmetrically around the center', () => {
    const left = handFanCardLayout(0, 7);
    const center = handFanCardLayout(3, 7);
    const right = handFanCardLayout(6, 7);
    expect(left.rotationDeg).toBeLessThan(0);
    expect(center.rotationDeg).toBe(0);
    expect(right.rotationDeg).toBeGreaterThan(0);
    expect(left.translateY).toBe(right.translateY);
  });

  it('layers the fan continuously from left to right instead of peaking in the center', () => {
    const layers = Array.from({ length: 15 }, (_, index) => handFanCardLayout(index, 15).zIndex);
    expect(layers).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
  });
});

describe('mobile hand layout', () => {
  it.each([0, 1, 3, 5, 6, 15])('keeps the first five of %i cards reachable', (count) => {
    const layout = computeMobileHandLayout({ containerWidth: 294, viewportHeight: 812, count });
    expect(layout.visibleCount).toBe(Math.min(count, 5));
    expect(layout.visibleSpan).toBeLessThanOrEqual(294 - 32);
    if (count > 1) expect(layout.cardWidth + layout.marginLeft).toBeGreaterThanOrEqual(44);
  });

  it('clamps card width from viewport height', () => {
    expect(computeMobileHandLayout({ containerWidth: 300, viewportHeight: 375, count: 5 }).cardWidth).toBe(52);
    expect(computeMobileHandLayout({ containerWidth: 300, viewportHeight: 640, count: 5 }).cardWidth).toBe(64);
    expect(computeMobileHandLayout({ containerWidth: 300, viewportHeight: 844, count: 5 }).cardWidth).toBe(76);
  });
});
