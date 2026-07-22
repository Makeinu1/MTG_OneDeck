import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeResponsiveLaneLayout } from '../adaptiveLaneLayout';
import { computeMobileHandLayout } from '../handFanLayout';
import { computeMobileLandLayout } from '../landRowModel';

const CARD_ASPECT = 680 / 488;

describe('review: mobile density geometry', () => {
  it('fits five portrait creatures and three portrait support cards before scrolling', () => {
    const creatures = computeResponsiveLaneLayout({
      mode: 'mobile-portrait', role: 'creature', width: 358, height: 268, count: 5,
    });
    const support = computeResponsiveLaneLayout({
      mode: 'mobile-portrait', role: 'support',
      width: (375 - 52) / 2 - 12,
      height: 152,
      count: 3,
    });

    expect(creatures.rows).toBe(1);
    expect(creatures.cardWidth * 5 + 8 * 4).toBeLessThanOrEqual(358);
    expect(support.rows).toBe(1);
    expect(support.cardWidth).toBeGreaterThanOrEqual(44);
    expect(support.cardWidth * 3 + 8 * 2).toBeLessThanOrEqual((375 - 52) / 2 - 12);
  });

  it('keeps short-landscape cards inside the measured shelf height', () => {
    for (const input of [
      { width: 740, height: 58, count: 5 },
      { width: 770, height: 70, count: 5 },
    ]) {
      const layout = computeResponsiveLaneLayout({
        mode: 'mobile-landscape', role: 'creature', ...input,
      });
      expect(layout.rows).toBe(1);
      expect(layout.cardWidth * CARD_ASPECT).toBeLessThanOrEqual(input.height);
    }
  });

  it('fits the first three land bundles in portrait without clipping', () => {
    const layout = computeMobileLandLayout({ containerWidth: 169, containerHeight: 168, count: 3 });
    expect(layout.visibleCount).toBe(3);
    expect(layout.visibleSpan).toBeLessThanOrEqual(169);
    expect(layout.cardWidth * CARD_ASPECT).toBeLessThanOrEqual(160);
  });

  it('keeps five hand cards visible with at least a 44px exposed width', () => {
    for (const input of [
      { containerWidth: 294, viewportHeight: 812, count: 5 },
      { containerWidth: 310, viewportHeight: 844, count: 5 },
      { containerWidth: 310, viewportHeight: 844, count: 6 },
    ]) {
      const layout = computeMobileHandLayout(input);
      expect(layout.visibleCount).toBe(5);
      expect(layout.cardWidth + layout.marginLeft).toBeGreaterThanOrEqual(44);
      expect(layout.visibleSpan).toBeLessThanOrEqual(input.containerWidth - 32);
    }
  });

  it('does not reintroduce mobile fixed-width overrides or the undersized card button', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/game/game.css'), 'utf8');
    const compactDesktopStart = css.indexOf('@media (min-width: 900px) and (max-height: 520px)');
    expect(compactDesktopStart).toBeGreaterThan(-1);
    const mobileCss = css.slice(0, compactDesktopStart);
    expect(mobileCss).not.toMatch(/--board-card-w:\s*\d+px\s*!important/);
    expect(mobileCss).not.toMatch(/--land-card-w:\s*\d+px\s*!important/);
    expect(css.slice(compactDesktopStart)).toContain("--board-card-w: 64px !important");
    expect(css.slice(compactDesktopStart)).toContain("--land-card-w: 52px !important");
    expect(css).not.toContain('.game-card__menu-hint');
    expect(css).toContain('.game-card-preview__menu-action');
    expect(css).toMatch(/game-card-preview__menu-action[^}]*min-height:\s*var\(--touch-target\)/s);
  });
});
