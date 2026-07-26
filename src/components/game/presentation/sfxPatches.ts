/**
 * sfxPatches — AV3/AV4 deterministic multi-layer patch data (pure, no DOM/AudioContext).
 * docs/audio-visual-contract.md §3.1 (synthesis method and timbre design).
 *
 * Four patches rendered to AudioBuffer via OfflineAudioContext in sfxRenderer.ts.
 * Same kind always produces the identical buffer. No randomness, no history.
 */

export interface SfxLayer {
  kind: 'osc' | 'noise';
  // osc
  wave?: OscillatorType;
  freqStart: number;
  freqEnd?: number;
  detuneCents?: number;
  // noise
  filterType?: BiquadFilterType;
  filterFreqStart?: number;
  filterFreqEnd?: number;
  filterQ?: number;
  // envelope
  attackMs: number;
  decayMs?: number;
  sustain?: number;
  releaseMs: number;
  gain: number;
  offsetMs: number;
}

export interface SfxPatch {
  id: string;
  durationMs: number;
  outputGainDb: number;
  layers: SfxLayer[];
  reverb?: { wetGain: number; decaySec: number };
}

export type SfxKind = 'spell-cast' | 'land-played' | 'turn-advanced' | 'commander-cast';

/** BGM(-4.5dB) relative levels. The single tunable volume set (contract §3.1). */
export const SFX_LEVELS_DB: Record<SfxKind, number> = {
  'spell-cast': -8,
  'land-played': -6,
  'turn-advanced': -10,
  'commander-cast': -3,
};

/* ------------------------------------------------------------------ */
/*  spell-cast: crystalline ping + filtered noise whoosh (~200ms)      */
/* ------------------------------------------------------------------ */

const SPELL_CAST: SfxPatch = {
  id: 'spell-cast',
  durationMs: 200,
  outputGainDb: SFX_LEVELS_DB['spell-cast'],
  layers: [
    // L1: sine pitch drop 200→100Hz (air thud — higher than land)
    { kind: 'osc', wave: 'sine', freqStart: 200, freqEnd: 100, attackMs: 3, releaseMs: 140, gain: 0.38, offsetMs: 0 },
    // L2: triangle body (mid presence)
    { kind: 'osc', wave: 'triangle', freqStart: 400, attackMs: 3, releaseMs: 80, gain: 0.14, offsetMs: 0 },
    // L3: highpass noise burst (impact texture, brighter than land)
    { kind: 'noise', freqStart: 0, filterType: 'highpass', filterFreqStart: 1200, attackMs: 2, releaseMs: 50, gain: 0.10, offsetMs: 0 },
  ],
  // No reverb: dry = physical impact language.
};

/* ------------------------------------------------------------------ */
/*  land-played: sub thud + noise attack, dry (~200ms)                 */
/* ------------------------------------------------------------------ */

const LAND_PLAYED: SfxPatch = {
  id: 'land-played',
  durationMs: 200,
  outputGainDb: SFX_LEVELS_DB['land-played'],
  layers: [
    // L1: sine pitch drop 120→60Hz (grounded thud)
    { kind: 'osc', wave: 'sine', freqStart: 120, freqEnd: 60, attackMs: 3, releaseMs: 150, gain: 0.4, offsetMs: 0 },
    // L2: triangle body
    { kind: 'osc', wave: 'triangle', freqStart: 240, attackMs: 3, releaseMs: 90, gain: 0.15, offsetMs: 0 },
    // L3: lowpass noise burst (impact texture)
    { kind: 'noise', freqStart: 0, filterType: 'lowpass', filterFreqStart: 800, attackMs: 2, releaseMs: 60, gain: 0.1, offsetMs: 0 },
  ],
  // No reverb: dry = grounded.
};

/* ------------------------------------------------------------------ */
/*  turn-advanced: soft tick + 5th chime (~250ms)                      */
/* ------------------------------------------------------------------ */

const TURN_ADVANCED: SfxPatch = {
  id: 'turn-advanced',
  durationMs: 180,
  outputGainDb: SFX_LEVELS_DB['turn-advanced'],
  layers: [
    // L1: sine pitch drop 160→80Hz (smallest thud — barline marker)
    { kind: 'osc', wave: 'sine', freqStart: 160, freqEnd: 80, attackMs: 2, releaseMs: 120, gain: 0.30, offsetMs: 0 },
    // L2: highpass noise tick (transient definition)
    { kind: 'noise', freqStart: 0, filterType: 'highpass', filterFreqStart: 2000, attackMs: 1, releaseMs: 30, gain: 0.08, offsetMs: 0 },
  ],
  // No reverb: dry = smallest physical marker.
};

/* ------------------------------------------------------------------ */
/*  commander-cast: three land-style thuds at 122 BPM 8th notes (≤650ms)  */
/* ------------------------------------------------------------------ */

/* 122 BPM 8th note = 60000 / 122.000736 / 2 ≈ 245.9ms */
const EIGHTH_NOTE_MS = 246;

const COMMANDER_CAST: SfxPatch = {
  id: 'commander-cast',
  durationMs: 650,
  outputGainDb: SFX_LEVELS_DB['commander-cast'],
  layers: [
    // Hit 1 (offset 0ms): land-style thud
    { kind: 'osc', wave: 'sine', freqStart: 120, freqEnd: 60, attackMs: 3, releaseMs: 150, gain: 0.40, offsetMs: 0 },
    { kind: 'osc', wave: 'triangle', freqStart: 240, attackMs: 3, releaseMs: 90, gain: 0.15, offsetMs: 0 },
    { kind: 'noise', freqStart: 0, filterType: 'lowpass', filterFreqStart: 800, attackMs: 2, releaseMs: 60, gain: 0.10, offsetMs: 0 },
    // Hit 2 (offset 246ms = 8th note at 122 BPM): same thud
    { kind: 'osc', wave: 'sine', freqStart: 120, freqEnd: 60, attackMs: 3, releaseMs: 150, gain: 0.40, offsetMs: EIGHTH_NOTE_MS },
    { kind: 'osc', wave: 'triangle', freqStart: 240, attackMs: 3, releaseMs: 90, gain: 0.15, offsetMs: EIGHTH_NOTE_MS },
    { kind: 'noise', freqStart: 0, filterType: 'lowpass', filterFreqStart: 800, attackMs: 2, releaseMs: 60, gain: 0.10, offsetMs: EIGHTH_NOTE_MS },
    // Hit 3 (offset 492ms = 2 × 8th note): deeper thud (landing)
    { kind: 'osc', wave: 'sine', freqStart: 100, freqEnd: 50, attackMs: 3, releaseMs: 160, gain: 0.45, offsetMs: EIGHTH_NOTE_MS * 2 },
    { kind: 'osc', wave: 'triangle', freqStart: 200, attackMs: 3, releaseMs: 100, gain: 0.18, offsetMs: EIGHTH_NOTE_MS * 2 },
    { kind: 'noise', freqStart: 0, filterType: 'lowpass', filterFreqStart: 600, attackMs: 2, releaseMs: 70, gain: 0.12, offsetMs: EIGHTH_NOTE_MS * 2 },
  ],
  // No reverb: dry = same physical language as land. Weight comes from rhythm + duck.
};

const PATCHES: Record<SfxKind, SfxPatch> = {
  'spell-cast': SPELL_CAST,
  'land-played': LAND_PLAYED,
  'turn-advanced': TURN_ADVANCED,
  'commander-cast': COMMANDER_CAST,
};

/** Return the patch for a given kind. Immutable by convention; deterministic: same output every call. */
export function sfxPatch(kind: SfxKind): SfxPatch {
  return PATCHES[kind];
}
