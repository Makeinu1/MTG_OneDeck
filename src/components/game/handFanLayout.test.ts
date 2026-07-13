import { describe, expect, it } from 'vitest';
import { estimatedFanWidth, exposedCardWidth, handFanCardLayout } from './handFanLayout';

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
