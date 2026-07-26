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
  'spell-cast': -13,
  'land-played': -11,
  'turn-advanced': -15,
  'commander-cast': -8,
};

/* ------------------------------------------------------------------ */
/*  spell-cast: crystalline ping + filtered noise whoosh (~200ms)      */
/* ------------------------------------------------------------------ */

const SPELL_CAST: SfxPatch = {
  id: 'spell-cast',
  durationMs: 200,
  outputGainDb: SFX_LEVELS_DB['spell-cast'],
  layers: [
    // L1: sine sweep 880→1320Hz (stack launch)
    { kind: 'osc', wave: 'sine', freqStart: 880, freqEnd: 1320, attackMs: 5, releaseMs: 140, gain: 0.35, offsetMs: 0 },
    // L2: detuned sine shimmer
    { kind: 'osc', wave: 'sine', freqStart: 884, attackMs: 5, releaseMs: 160, gain: 0.08, offsetMs: 0 },
    // L3: bandpass noise whoosh
    { kind: 'noise', freqStart: 0, filterType: 'bandpass', filterFreqStart: 600, filterFreqEnd: 2400, filterQ: 2, attackMs: 8, releaseMs: 90, gain: 0.12, offsetMs: 0 },
  ],
  reverb: { wetGain: 0.25, decaySec: 0.7 },
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
  durationMs: 250,
  outputGainDb: SFX_LEVELS_DB['turn-advanced'],
  layers: [
    // L1: highpass noise tick (barline)
    { kind: 'noise', freqStart: 0, filterType: 'highpass', filterFreqStart: 4000, attackMs: 1, releaseMs: 20, gain: 0.08, offsetMs: 0 },
    // L2: sine 660Hz (root)
    { kind: 'osc', wave: 'sine', freqStart: 660, attackMs: 3, releaseMs: 200, gain: 0.25, offsetMs: 0 },
    // L3: sine 990Hz (5th, lower gain)
    { kind: 'osc', wave: 'sine', freqStart: 990, attackMs: 3, releaseMs: 200, gain: 0.12, offsetMs: 0 },
  ],
  reverb: { wetGain: 0.15, decaySec: 0.5 },
};

/* ------------------------------------------------------------------ */
/*  commander-cast: three-note motif G4/B4/D5, layered (≤650ms)        */
/* ------------------------------------------------------------------ */

const COMMANDER_CAST: SfxPatch = {
  id: 'commander-cast',
  durationMs: 650,
  outputGainDb: SFX_LEVELS_DB['commander-cast'],
  layers: [
    // Note 1: G4 (392Hz), offset 0ms
    { kind: 'osc', wave: 'sine', freqStart: 196, attackMs: 5, releaseMs: 200, gain: 0.25, offsetMs: 0 },       // sub (1oct down)
    { kind: 'osc', wave: 'sine', freqStart: 392, attackMs: 5, releaseMs: 220, gain: 0.35, offsetMs: 0 },       // body
    { kind: 'osc', wave: 'sine', freqStart: 784, attackMs: 5, releaseMs: 180, gain: 0.08, offsetMs: 0 },       // shimmer (1oct up)
    // Note 2: B4 (493.88Hz), offset 120ms
    { kind: 'osc', wave: 'sine', freqStart: 246.94, attackMs: 5, releaseMs: 200, gain: 0.22, offsetMs: 120 },  // sub
    { kind: 'osc', wave: 'sine', freqStart: 493.88, attackMs: 5, releaseMs: 220, gain: 0.32, offsetMs: 120 },  // body
    { kind: 'osc', wave: 'sine', freqStart: 987.77, attackMs: 5, releaseMs: 180, gain: 0.07, offsetMs: 120 },  // shimmer
    // Note 3: D5 (587.33Hz), offset 260ms
    { kind: 'osc', wave: 'sine', freqStart: 293.665, attackMs: 5, releaseMs: 250, gain: 0.20, offsetMs: 260 }, // sub
    { kind: 'osc', wave: 'sine', freqStart: 587.33, attackMs: 5, releaseMs: 280, gain: 0.30, offsetMs: 260 },  // body
    { kind: 'osc', wave: 'sine', freqStart: 1174.66, attackMs: 5, releaseMs: 240, gain: 0.06, offsetMs: 260 }, // shimmer
    // Low-frequency pad (G2)
    { kind: 'osc', wave: 'sine', freqStart: 98, attackMs: 20, releaseMs: 500, gain: 0.12, offsetMs: 0 },
  ],
  reverb: { wetGain: 0.35, decaySec: 0.9 },
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
