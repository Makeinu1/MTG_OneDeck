import { describe, expect, it } from 'vitest';
import { getThemeTrack } from '../../components/game/presentation/trackManifest';
import {
  AMBIENT_MACRO_CANDIDATES,
  AMBIENT_MACRO_GROUPS,
  macroLimits,
  macroLoopDurationSec,
  phaseFromElapsedMs,
  sampleMacroGroupMotion,
  sampleMacroMotion,
} from './ambientMacroMotion';

describe('UXUI-AMBIENT-P1 macro motion', () => {
  it('pins the BASELINE and candidate limits', () => {
    expect(AMBIENT_MACRO_CANDIDATES).toEqual(['BASELINE', 'A', 'B', 'C']);
    expect(macroLimits('A', 'G1')).toEqual({ movementPx: 2, scaleIncrease: 0.002, opacityDelta: 0.015 });
    expect(macroLimits('B', 'G2')).toEqual({ movementPx: 6, scaleIncrease: 0.006, opacityDelta: 0.035 });
    expect(macroLimits('C', 'G3')).toEqual({ movementPx: 12, scaleIncrease: 0.012, opacityDelta: 0.07 });
    for (const group of AMBIENT_MACRO_GROUPS) {
      expect(sampleMacroGroupMotion('BASELINE', group, 0.5, 1440)).toEqual({
        x: 0,
        y: 0,
        scaleIncrease: 0,
        opacityDelta: 0,
      });
    }
  });

  it('closes the orbit and hits the specified keyframes', () => {
    expect(sampleMacroGroupMotion('C', 'G1', 0, 1440)).toEqual({
      x: 0, y: 0, scaleIncrease: 0, opacityDelta: 0,
    });
    expect(sampleMacroGroupMotion('C', 'G1', 1, 1440)).toEqual({
      x: 0, y: 0, scaleIncrease: 0, opacityDelta: 0,
    });
    expect(sampleMacroGroupMotion('C', 'G1', 0.25, 1440)).toEqual({
      x: 4, y: -2, scaleIncrease: 0.004, opacityDelta: 0.025,
    });
    expect(sampleMacroGroupMotion('C', 'G1', 0.5, 1440)).toEqual({
      x: -1.6, y: 4, scaleIncrease: 0.0016, opacityDelta: -0.0075,
    });
    expect(sampleMacroMotion('B', 0, 1440)).toEqual(sampleMacroMotion('B', 1, 1440));
  });

  it('applies the narrow correction to movement only', () => {
    const wide = sampleMacroGroupMotion('C', 'G3', 0.25, 1440);
    const narrow = sampleMacroGroupMotion('C', 'G3', 0.25, 899);
    expect(narrow.x).toBeCloseTo(wide.x * 0.7);
    expect(narrow.y).toBeCloseTo(wide.y * 0.7);
    expect(narrow.scaleIncrease).toBe(wide.scaleIncrease);
    expect(narrow.opacityDelta).toBe(wide.opacityDelta);
  });

  it('keeps the three groups out of a simultaneous maximum state', () => {
    for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
      const sample = sampleMacroMotion('C', phase, 1440);
      const maximumScaleGroups = AMBIENT_MACRO_GROUPS.filter((group) =>
        Math.abs(sample[group].scaleIncrease - macroLimits('C', group).scaleIncrease) < 1e-9);
      const maximumOpacityGroups = AMBIENT_MACRO_GROUPS.filter((group) =>
        Math.abs(sample[group].opacityDelta - macroLimits('C', group).opacityDelta) < 1e-9);
      expect(maximumScaleGroups.length).toBeLessThan(3);
      expect(maximumOpacityGroups.length).toBeLessThan(3);
    }
  });

  it('uses the current theme TrackManifest loop span without fixture seconds', () => {
    for (const theme of ['dark', 'light'] as const) {
      const track = getThemeTrack(theme);
      if (!track) throw new Error(`missing TrackManifest for ${theme}`);
      expect(macroLoopDurationSec(theme)).toBe(track.loopEndSec - track.loopStartSec);
      expect(phaseFromElapsedMs((track.loopEndSec - track.loopStartSec) * 1000, theme, 1)).toBe(0);
    }
  });
});
