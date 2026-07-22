import { describe, expect, it } from 'vitest';
import { computeMobileLandLayout } from './landRowModel';

describe('mobile land layout', () => {
  it.each([0, 1, 3, 5, 6, 15])('keeps the first three of %i bundles inside the rail', (count) => {
    const layout = computeMobileLandLayout({ containerWidth: 169, containerHeight: 168, count });
    expect(layout.visibleCount).toBe(Math.min(count, 3));
    expect(layout.visibleSpan).toBeLessThanOrEqual(169);
    expect(layout.bundleWidth).toBe(layout.cardWidth + 6);
  });
});
