import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AMBIENT_BEAT_COMBAT_MS,
  AMBIENT_BEAT_MS,
  AMBIENT_STORAGE_KEY,
  BLOOM_SPOTS,
  CURRENT_SPECS,
  DRIP_SPOTS,
  STAR_COUNTS,
  ambientBeatMs,
  buildFlecks,
  buildStarField,
  buildStarLayer,
  isAmbientEnabled,
  setAmbientEnabled,
} from './ambientMotion';

describe('ambientBeatMs', () => {
  it('returns the dark pace anchor by default and the combat value in combat', () => {
    expect(AMBIENT_BEAT_MS).toBe(700);
    expect(AMBIENT_BEAT_COMBAT_MS).toBe(525);
    expect(ambientBeatMs()).toBe(700);
    expect(ambientBeatMs({ combat: true })).toBe(525);
  });

  it('collapses to 0 under reduced-motion (full stillness)', () => {
    expect(ambientBeatMs({ reduced: true })).toBe(0);
    expect(ambientBeatMs({ combat: true, reduced: true })).toBe(0);
  });
});

describe('ambient toggle (opt-in, default ON)', () => {
  beforeEach(() => localStorage.clear());

  it('is ON by default and only the literal "off" disables it', () => {
    expect(isAmbientEnabled()).toBe(true);
    localStorage.setItem(AMBIENT_STORAGE_KEY, 'on');
    expect(isAmbientEnabled()).toBe(true);
    localStorage.setItem(AMBIENT_STORAGE_KEY, 'off');
    expect(isAmbientEnabled()).toBe(false);
    localStorage.setItem(AMBIENT_STORAGE_KEY, 'garbage');
    expect(isAmbientEnabled()).toBe(true);
  });

  it('round-trips through setAmbientEnabled', () => {
    setAmbientEnabled(false);
    expect(isAmbientEnabled()).toBe(false);
    setAmbientEnabled(true);
    expect(isAmbientEnabled()).toBe(true);
  });

  it('swallows localStorage failures (private mode) without throwing', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => setAmbientEnabled(true)).not.toThrow();
    expect(isAmbientEnabled()).toBe(true); // getItem throw → default ON
    setSpy.mockRestore();
    getSpy.mockRestore();
  });
});

describe('star field (deterministic, v4.3 arithmetic)', () => {
  it('builds the approved layer counts (far 44 / mid 22 / near 14 = 80)', () => {
    expect(STAR_COUNTS.far + STAR_COUNTS.mid + STAR_COUNTS.near).toBe(80);
    expect(buildStarLayer('far')).toHaveLength(44);
    expect(buildStarLayer('mid')).toHaveLength(22);
    expect(buildStarLayer('near')).toHaveLength(14);
    const field = buildStarField();
    expect(field.far).toHaveLength(44);
    expect(field.mid).toHaveLength(22);
    expect(field.near).toHaveLength(14);
  });

  it('is deterministic (same input → identical specs)', () => {
    expect(buildStarLayer('mid')).toEqual(buildStarLayer('mid'));
  });

  it('keeps every star inside the field with in-range period/opacity and a token tint', () => {
    const tintVars = new Set([
      'var(--ambient-star-1)', 'var(--ambient-star-2)', 'var(--ambient-star-3)',
      'var(--ambient-star-4)', 'var(--ambient-star-5)',
    ]);
    for (const kind of ['far', 'mid', 'near'] as const) {
      for (const star of buildStarLayer(kind)) {
        expect(star.x).toBeGreaterThanOrEqual(0);
        expect(star.x).toBeLessThan(100);
        expect(star.y).toBeGreaterThanOrEqual(3);
        expect(star.y).toBeLessThanOrEqual(93);
        expect(star.sizePx).toBeGreaterThan(0);
        expect(star.periodS).toBeGreaterThan(0);
        expect(star.delayS).toBeLessThanOrEqual(0);
        expect(star.opacity).toBeGreaterThan(0);
        expect(star.opacity).toBeLessThanOrEqual(1);
        expect(star.glow).toBeGreaterThan(0);
        expect(tintVars.has(star.tintVar)).toBe(true);
      }
    }
  });

  it('uses per-layer frequency bands (far slowest, near fastest)', () => {
    const maxPeriod = (kind: 'far' | 'mid' | 'near') =>
      Math.max(...buildStarLayer(kind).map((s) => s.periodS));
    expect(maxPeriod('far')).toBeGreaterThan(maxPeriod('mid'));
    expect(maxPeriod('mid')).toBeGreaterThan(maxPeriod('near'));
  });
});

describe('ink spots (light skin geometry)', () => {
  it('pins the approved spot counts (bloom 6 / drip 5 / current 3 / fleck 10)', () => {
    expect(BLOOM_SPOTS).toHaveLength(6);
    expect(DRIP_SPOTS).toHaveLength(5);
    expect(CURRENT_SPECS).toHaveLength(3);
    expect(buildFlecks()).toHaveLength(10);
  });

  it('keeps flecks in-range and deterministic', () => {
    const flecks = buildFlecks();
    expect(buildFlecks()).toEqual(flecks);
    for (const fleck of flecks) {
      expect(fleck.x).toBeGreaterThanOrEqual(0);
      expect(fleck.y).toBeGreaterThanOrEqual(0);
      expect(fleck.sizePx).toBeGreaterThan(0);
      expect(fleck.periodS).toBeGreaterThan(0);
      expect(fleck.opacity).toBeGreaterThan(0);
    }
  });
});

afterEach(() => localStorage.clear());
