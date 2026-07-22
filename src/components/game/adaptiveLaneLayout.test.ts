import { describe, expect, it } from 'vitest';
import { computeAdaptiveLaneLayout, computeResponsiveLaneLayout } from './adaptiveLaneLayout';

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

describe('computeResponsiveLaneLayout', () => {
  it('keeps three portrait support cards at the 44px interaction floor on 375px screens', () => {
    const layout = computeResponsiveLaneLayout({
      mode: 'mobile-portrait',
      role: 'support',
      width: (375 - 52) / 2 - 12,
      height: 152,
      count: 3,
    });

    expect(layout).toMatchObject({ rows: 1, cardWidth: 44, denseOverview: false });
  });

  it.each([0, 1, 3, 5])('keeps %i portrait creatures on one row', (count) => {
    const layout = computeResponsiveLaneLayout({
      mode: 'mobile-portrait', role: 'creature', width: 358, height: 268, count,
    });
    expect(layout.rows).toBe(1);
    expect(layout.columns).toBe(count);
  });

  it.each([6, 15])('limits %i portrait creatures to at most two rows', (count) => {
    const layout = computeResponsiveLaneLayout({
      mode: 'mobile-portrait', role: 'creature', width: 358, height: 268, count,
    });
    expect(layout.rows).toBeLessThanOrEqual(2);
  });

  it('uses shelf height as the hard landscape limit', () => {
    const layout = computeResponsiveLaneLayout({
      mode: 'mobile-landscape', role: 'support', width: 370, height: 58, count: 5,
    });
    expect(layout.rows).toBe(1);
    expect(layout.cardWidth * (680 / 488)).toBeLessThanOrEqual(58);
  });
});
