import { describe, expect, it } from 'vitest';
import { computeAdaptiveLaneLayout } from './adaptiveLaneLayout';

describe('computeAdaptiveLaneLayout', () => {
  it('uses the preferred creature width while a sparse lane has room', () => {
    expect(computeAdaptiveLaneLayout({
      width: 900, height: 260, count: 5, preferredWidth: 168, wrapWidth: 96,
    })).toMatchObject({ cardWidth: 168, rows: 1, denseOverview: false });
  });

  it('shrinks, then chooses multiple rows from the actual container', () => {
    const one = computeAdaptiveLaneLayout({
      width: 850, height: 320, count: 8, preferredWidth: 168, wrapWidth: 96,
    });
    const many = computeAdaptiveLaneLayout({
      width: 760, height: 320, count: 20, preferredWidth: 168, wrapWidth: 96,
    });
    expect(one.rows).toBe(1);
    expect(one.cardWidth).toBeLessThan(168);
    expect(many.rows).toBeGreaterThan(1);
    expect(many.rows).toBeLessThanOrEqual(3);
  });

  it('marks an extreme layout for the readable overview', () => {
    const layout = computeAdaptiveLaneLayout({
      width: 320, height: 130, count: 40, preferredWidth: 112, wrapWidth: 72,
    });
    expect(layout.cardWidth).toBeLessThan(44);
    expect(layout.denseOverview).toBe(true);
  });
});
