import { describe, expect, it } from 'vitest';
import { getTransportCssTiming } from '../presentation/audioVisualTransport';
import { DARK_GAME_TRACK } from '../presentation/trackManifest';

describe('getTransportCssTiming', () => {
  const firstSpanSec = DARK_GAME_TRACK.beatAnchors[1].atSeconds;
  const expectedBeatMs = (firstSpanSec / 32) * 1000;

  it('returns beat duration derived from the enclosing anchor span', () => {
    const { beatMs } = getTransportCssTiming(0, DARK_GAME_TRACK);
    expect(beatMs).toBeCloseTo(expectedBeatMs, 6);
  });

  it('returns zero phase at loop start', () => {
    const { phaseDelayMs } = getTransportCssTiming(0, DARK_GAME_TRACK);
    expect(phaseDelayMs).toBeCloseTo(0, 6);
  });

  it('returns negative half-beat phase at half-beat offset', () => {
    const { beatMs, phaseDelayMs } = getTransportCssTiming(
      firstSpanSec / 64,
      DARK_GAME_TRACK,
    );
    expect(phaseDelayMs).toBeCloseTo(-beatMs / 2, 6);
  });

  it('returns zero phase at anchor boundary', () => {
    const { phaseDelayMs } = getTransportCssTiming(firstSpanSec, DARK_GAME_TRACK);
    expect(phaseDelayMs).toBeCloseTo(0, 6);
  });

  it('normalizes across full-track loops', () => {
    const direct = getTransportCssTiming(firstSpanSec / 64, DARK_GAME_TRACK);
    const afterLoop = getTransportCssTiming(
      DARK_GAME_TRACK.loopEndSec + firstSpanSec / 64,
      DARK_GAME_TRACK,
    );
    expect(afterLoop).toEqual(direct);
  });

  it('handles multiple loop wraps', () => {
    const direct = getTransportCssTiming(firstSpanSec / 64, DARK_GAME_TRACK);
    const multiLoop = getTransportCssTiming(
      DARK_GAME_TRACK.loopEndSec * 3 + firstSpanSec / 64,
      DARK_GAME_TRACK,
    );
    expect(multiLoop.beatMs).toBeCloseTo(direct.beatMs, 6);
    expect(multiLoop.phaseDelayMs).toBeCloseTo(direct.phaseDelayMs, 6);
  });

  it('uses the correct span for later anchors', () => {
    const secondSpanStart = DARK_GAME_TRACK.beatAnchors[1].atSeconds;
    const secondSpanEnd = DARK_GAME_TRACK.beatAnchors[2].atSeconds;
    const secondSpanBeatMs =
      ((secondSpanEnd - secondSpanStart) / 32) * 1000;
    const mid = (secondSpanStart + secondSpanEnd) / 2;
    const { beatMs } = getTransportCssTiming(mid, DARK_GAME_TRACK);
    expect(beatMs).toBeCloseTo(secondSpanBeatMs, 6);
  });

  it('falls back to 700ms for non-finite input', () => {
    const { beatMs, phaseDelayMs } = getTransportCssTiming(NaN, DARK_GAME_TRACK);
    expect(beatMs).toBe(700);
    expect(phaseDelayMs).toBe(0);
  });
});
