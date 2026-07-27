/**
 * review.av5-permanent-beat — M-AV5 の判定者専有ピン。
 * docs/audio-visual-contract.md §10「パーマネント・アンビエントビート」の実装を固定する。
 * 実装者はこのテストを変更しない(落ちたら実装側を直す)。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTransportCssTiming } from '../presentation/audioVisualTransport';
import { beatDensity } from '../presentation/permanentBeat';
import { DARK_GAME_TRACK } from '../presentation/trackManifest';
import { DEFAULT_AUDIO_VISUAL_TUNING } from '../presentation/presentationTuning';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

/* ------------------------------------------------------------------ */
/*  Transport: bar timing (小節周期 + 小節位相)                          */
/* ------------------------------------------------------------------ */

describe('AV5 transport bar timing', () => {
  const timing = getTransportCssTiming(0, DARK_GAME_TRACK);

  it('returns barMs = beatMs × 4', () => {
    expect(timing.barMs).toBeCloseTo(timing.beatMs * 4, 3);
  });

  it('returns barPhaseDelayMs ≤ 0 (negative offset to previous bar boundary)', () => {
    expect(timing.barPhaseDelayMs).toBeLessThanOrEqual(0);
  });

  it('bar phase aligns at beat 0 (delay = 0 at loop start)', () => {
    expect(timing.barPhaseDelayMs).toBeCloseTo(0, 1);
  });

  it('bar phase at 2 beats in = -2 beats offset', () => {
    const firstSpanSec = DARK_GAME_TRACK.beatAnchors[1].atSeconds;
    const beatSec = firstSpanSec / 32; // 32 beats in first span
    const at2Beats = getTransportCssTiming(beatSec * 2, DARK_GAME_TRACK);
    const expectedDelay = -(beatSec * 2) * 1000;
    expect(at2Beats.barPhaseDelayMs).toBeCloseTo(expectedDelay, 0);
  });

  it('bar timing wraps correctly after loop', () => {
    const loopDur = DARK_GAME_TRACK.loopEndSec - DARK_GAME_TRACK.loopStartSec;
    const firstSpanSec = DARK_GAME_TRACK.beatAnchors[1].atSeconds;
    const beatSec = firstSpanSec / 32;
    const afterLoop = getTransportCssTiming(loopDur + beatSec, DARK_GAME_TRACK);
    const atOneBeat = getTransportCssTiming(beatSec, DARK_GAME_TRACK);
    expect(afterLoop.barPhaseDelayMs).toBeCloseTo(atOneBeat.barPhaseDelayMs, 0);
  });

  it('preserves existing beatMs and phaseDelayMs fields (backward compat)', () => {
    expect(typeof timing.beatMs).toBe('number');
    expect(typeof timing.phaseDelayMs).toBe('number');
    expect(timing.beatMs).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Density decay (密度減衰)                                           */
/* ------------------------------------------------------------------ */

describe('AV5 beat density decay', () => {
  const tuning = DEFAULT_AUDIO_VISUAL_TUNING;

  it('returns 1.0 (full) at or below beatDensityFullSlots', () => {
    expect(beatDensity(1, tuning)).toBe(1);
    expect(beatDensity(6, tuning)).toBe(1);
  });

  it('returns 0.0 (shadow only) at or above beatDensityZeroSlots', () => {
    expect(beatDensity(12, tuning)).toBe(0);
    expect(beatDensity(20, tuning)).toBe(0);
  });

  it('interpolates linearly between full and zero', () => {
    // midpoint: (6+12)/2 = 9 → density 0.5
    expect(beatDensity(9, tuning)).toBeCloseTo(0.5, 5);
  });

  it('clamps to [0, 1]', () => {
    expect(beatDensity(0, tuning)).toBe(1);
    expect(beatDensity(100, tuning)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Tuning fields (TUNABLE 一か所集約)                                  */
/* ------------------------------------------------------------------ */

describe('AV5 tuning fields', () => {
  it('has all permanent-beat tuning fields with correct defaults', () => {
    expect(DEFAULT_AUDIO_VISUAL_TUNING.beatWaveStepMs).toBe(25);
    expect(DEFAULT_AUDIO_VISUAL_TUNING.beatDensityFullSlots).toBe(6);
    expect(DEFAULT_AUDIO_VISUAL_TUNING.beatDensityZeroSlots).toBe(12);
    expect(DEFAULT_AUDIO_VISUAL_TUNING.commanderAmpScale).toBe(1);
    expect(DEFAULT_AUDIO_VISUAL_TUNING.landAmpScale).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  CSS structure (game.css)                                           */
/* ------------------------------------------------------------------ */

describe('AV5 CSS choreography structure', () => {
  const css = read('src/components/game/game.css');

  it('defines land-beat keyframes (odd and even)', () => {
    expect(css).toContain('@keyframes land-beat-odd');
    expect(css).toContain('@keyframes land-beat-even');
  });

  it('defines commander-dance keyframes', () => {
    expect(css).toContain('@keyframes commander-dance');
  });

  it('gates permanent beat behind :root[data-ambient="on"]', () => {
    expect(css).toMatch(/:root\[data-ambient='on'\][^{]*land-beat/);
    expect(css).toMatch(/:root\[data-ambient='on'\][^{]*commander-dance/);
  });

  it('uses --bar variable for animation duration', () => {
    expect(css).toContain('--bar');
    expect(css).toContain('var(--bar)');
  });

  it('uses --transport-bar-phase-delay for phase alignment', () => {
    expect(css).toContain('--transport-bar-phase-delay');
  });

  it('includes reduced-motion override for permanent beat', () => {
    // Within the prefers-reduced-motion block, permanent beat elements are stopped
    const reducedBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducedBlock).toMatch(/land-beat|beat-slot|permanent-beat/);
  });

  it('does not animate filter or box-shadow on beat elements (transform/opacity only)', () => {
    // Extract keyframe blocks for land-beat and commander-dance
    const beatKeyframes = css.match(/@keyframes (?:land-beat-(?:odd|even)|commander-dance)[^}]*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g) ?? [];
    const allBeatCss = beatKeyframes.join('\n');
    expect(allBeatCss).not.toMatch(/\bfilter\s*:/);
    expect(allBeatCss).not.toMatch(/\bbox-shadow\s*:/);
  });
});

/* ------------------------------------------------------------------ */
/*  React structure (カード分類)                                        */
/* ------------------------------------------------------------------ */

describe('AV5 React card classification', () => {
  it('GameCard adds game-card--commander for battlefield commanders', () => {
    const source = read('src/components/game/GameCard.tsx');
    expect(source).toContain('game-card--commander');
  });

  it('LandRow assigns data-beat-index to bundles', () => {
    const source = read('src/components/game/LandRow.tsx');
    expect(source).toContain('data-beat-index');
  });

  it('Board assigns data-beat-index to visual bundles', () => {
    const source = read('src/components/game/Board.tsx');
    expect(source).toContain('data-beat-index');
  });

  it('AudioVisualProvider sets --transport-bar-ms and --transport-bar-phase-delay', () => {
    const source = read('src/components/game/presentation/AudioVisualProvider.tsx');
    expect(source).toContain('--transport-bar-ms');
    expect(source).toContain('--transport-bar-phase-delay');
  });

  it('game.css defines --bar with transport fallback', () => {
    const css = read('src/components/game/game.css');
    expect(css).toMatch(/--bar:\s*var\(--transport-bar-ms/);
  });
});

/* ------------------------------------------------------------------ */
/*  No new PresentationEvent / sound (無音・ambient 分類)               */
/* ------------------------------------------------------------------ */

describe('AV5 no new events or sound', () => {
  it('does not add new PresentationEvent kinds', () => {
    const source = read('src/components/game/presentation/presentationEvents.ts');
    // The kind union should not contain permanent-beat related entries
    expect(source).not.toContain('permanent-beat');
    expect(source).not.toContain('land-beat');
    expect(source).not.toContain('commander-dance');
  });

  it('permanentBeat module does not import audio/sound modules', () => {
    const source = read('src/components/game/presentation/permanentBeat.ts');
    expect(source).not.toContain('AudioContext');
    expect(source).not.toContain('sfxRenderer');
    expect(source).not.toContain('musicBus');
  });
});
