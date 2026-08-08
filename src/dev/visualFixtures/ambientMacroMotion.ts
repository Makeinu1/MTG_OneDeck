import { getThemeTrack, type AudioTheme } from '../../components/game/presentation/trackManifest';

export const AMBIENT_MACRO_CANDIDATES = ['BASELINE', 'A', 'B', 'C'] as const;
export type AmbientMacroCandidate = (typeof AMBIENT_MACRO_CANDIDATES)[number];

export const AMBIENT_MACRO_GROUPS = ['G1', 'G2', 'G3'] as const;
export type AmbientMacroGroup = (typeof AMBIENT_MACRO_GROUPS)[number];

export interface MacroLimits {
  movementPx: number;
  scaleIncrease: number;
  opacityDelta: number;
}

export interface MacroGroupMotion {
  x: number;
  y: number;
  scaleIncrease: number;
  opacityDelta: number;
}

const CANDIDATE_LIMITS: Record<AmbientMacroCandidate, Record<AmbientMacroGroup, MacroLimits>> = {
  BASELINE: {
    G1: { movementPx: 0, scaleIncrease: 0, opacityDelta: 0 },
    G2: { movementPx: 0, scaleIncrease: 0, opacityDelta: 0 },
    G3: { movementPx: 0, scaleIncrease: 0, opacityDelta: 0 },
  },
  A: {
    G1: { movementPx: 2, scaleIncrease: 0.002, opacityDelta: 0.015 },
    G2: { movementPx: 4, scaleIncrease: 0.004, opacityDelta: 0.025 },
    G3: { movementPx: 6, scaleIncrease: 0.006, opacityDelta: 0.035 },
  },
  B: {
    G1: { movementPx: 3, scaleIncrease: 0.003, opacityDelta: 0.020 },
    G2: { movementPx: 6, scaleIncrease: 0.006, opacityDelta: 0.035 },
    G3: { movementPx: 9, scaleIncrease: 0.009, opacityDelta: 0.050 },
  },
  C: {
    G1: { movementPx: 4, scaleIncrease: 0.004, opacityDelta: 0.025 },
    G2: { movementPx: 8, scaleIncrease: 0.008, opacityDelta: 0.050 },
    G3: { movementPx: 12, scaleIncrease: 0.012, opacityDelta: 0.070 },
  },
};

const PHASE_OFFSETS: Record<AmbientMacroGroup, number> = {
  G1: 0,
  G2: 1 / 3,
  G3: 2 / 3,
};

const ORBIT_KEYS = [
  { phase: 0, x: 0, y: 0, scale: 0, opacity: 0 },
  { phase: 0.25, x: 1, y: -0.5, scale: 1, opacity: 1 },
  { phase: 0.5, x: -0.4, y: 1, scale: 0.4, opacity: -0.3 },
  { phase: 0.75, x: -1, y: -0.3, scale: 0.7, opacity: 0.4 },
  { phase: 1, x: 0, y: 0, scale: 0, opacity: 0 },
] as const;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function wrapPhase(value: number): number {
  const normalized = value % 1;
  return normalized < 0 ? normalized + 1 : normalized;
}

function smoothStep(value: number): number {
  const t = clampUnit(value);
  return t * t * (3 - 2 * t);
}

function interpolate(left: number, right: number, amount: number): number {
  const eased = smoothStep(amount);
  return left + (right - left) * eased;
}

function orbitAt(phase: number): { x: number; y: number; scale: number; opacity: number } {
  const normalized = wrapPhase(phase);
  const segmentIndex = Math.min(
    ORBIT_KEYS.length - 2,
    Math.floor(normalized * (ORBIT_KEYS.length - 1)),
  );
  const left = ORBIT_KEYS[segmentIndex];
  const right = ORBIT_KEYS[segmentIndex + 1];
  const segmentSpan = right.phase - left.phase;
  const segmentPhase = segmentSpan === 0 ? 0 : (normalized - left.phase) / segmentSpan;
  return {
    x: interpolate(left.x, right.x, segmentPhase),
    y: interpolate(left.y, right.y, segmentPhase),
    scale: interpolate(left.scale, right.scale, segmentPhase),
    opacity: interpolate(left.opacity, right.opacity, segmentPhase),
  };
}

export function macroLimits(
  candidate: AmbientMacroCandidate,
  group: AmbientMacroGroup,
): MacroLimits {
  return CANDIDATE_LIMITS[candidate][group];
}

export function phaseOffset(group: AmbientMacroGroup): number {
  return PHASE_OFFSETS[group];
}

export function sampleMacroGroupMotion(
  candidate: AmbientMacroCandidate,
  group: AmbientMacroGroup,
  phase: number,
  viewportWidth: number,
): MacroGroupMotion {
  const limits = macroLimits(candidate, group);
  if (limits.movementPx === 0 && limits.scaleIncrease === 0 && limits.opacityDelta === 0) {
    return { x: 0, y: 0, scaleIncrease: 0, opacityDelta: 0 };
  }
  const widthScale = viewportWidth < 900 ? 0.7 : 1;
  const orbit = orbitAt(wrapPhase(phase) + phaseOffset(group));
  return {
    x: orbit.x * limits.movementPx * widthScale,
    y: orbit.y * limits.movementPx * widthScale,
    scaleIncrease: orbit.scale * limits.scaleIncrease,
    opacityDelta: orbit.opacity * limits.opacityDelta,
  };
}

export function sampleMacroMotion(
  candidate: AmbientMacroCandidate,
  phase: number,
  viewportWidth: number,
): Record<AmbientMacroGroup, MacroGroupMotion> {
  return {
    G1: sampleMacroGroupMotion(candidate, 'G1', phase, viewportWidth),
    G2: sampleMacroGroupMotion(candidate, 'G2', phase, viewportWidth),
    G3: sampleMacroGroupMotion(candidate, 'G3', phase, viewportWidth),
  };
}

export function macroLoopDurationSec(theme: AudioTheme): number {
  const track = getThemeTrack(theme);
  if (!track) return 0;
  return track.loopEndSec - track.loopStartSec;
}

export function phaseFromElapsedMs(elapsedMs: number, theme: AudioTheme, speed: 1 | 16): number {
  const durationMs = macroLoopDurationSec(theme) * 1000;
  if (durationMs <= 0) return 0;
  return wrapPhase((elapsedMs * speed) / durationMs);
}
