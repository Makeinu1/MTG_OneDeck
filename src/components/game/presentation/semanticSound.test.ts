import { describe, expect, it } from 'vitest';
import { presentationSoundDelayMs } from './semanticSound';
import { getNextGridDelayMs } from './audioVisualTransport';
import { AUDIO_VISUAL_TUNING } from './presentationTuning';
import { DARK_GAME_TRACK } from './trackManifest';

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
