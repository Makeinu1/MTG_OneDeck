import { describe, expect, it } from 'vitest';
import { presentationSoundDelayMs, semanticSoundSpec } from './semanticSound';
import { getNextGridDelayMs } from './audioVisualTransport';
import { AUDIO_VISUAL_TUNING } from './presentationTuning';
import { DARK_GAME_TRACK } from './trackManifest';

describe('semanticSoundSpec', () => {
  it('returns deterministic specs for ordinary kinds', () => {
    const spell = semanticSoundSpec('spell-cast');
    expect(spell).toEqual({ freq: 440, type: 'sine', durationMs: 90, gain: 0.06 });
    const land = semanticSoundSpec('land-played');
    expect(land).toEqual({ freq: 330, type: 'triangle', durationMs: 80, gain: 0.055 });
    const turn = semanticSoundSpec('turn-advanced');
    expect(turn).toEqual({ freq: 550, type: 'sine', durationMs: 70, gain: 0.05 });
  });

  it('returns null for commander-cast', () => {
    expect(semanticSoundSpec('commander-cast')).toBeNull();
  });
});

describe('presentationSoundDelayMs', () => {
  it('delegates to getNextGridDelayMs for all positions', () => {
    const positions = [0, 0.001, 0.5, 1.0, 15.7, 31.47, 100, 200, 251.79];
    for (const pos of positions) {
      expect(presentationSoundDelayMs(pos)).toBe(
        getNextGridDelayMs(pos, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING),
      );
    }
  });

  it('never exceeds 80ms', () => {
    for (let pos = 0; pos < 252; pos += 0.01) {
      expect(presentationSoundDelayMs(pos)).toBeLessThanOrEqual(80);
    }
  });

  it('handles loop wrapping identically to getNextGridDelayMs', () => {
    const beyond = DARK_GAME_TRACK.loopEndSec + 5.5;
    expect(presentationSoundDelayMs(beyond)).toBe(
      getNextGridDelayMs(beyond, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING),
    );
  });
});
