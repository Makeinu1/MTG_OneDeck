/**
 * semanticSound — AV3 deterministic voice specs and beat-snap delay.
 * docs/audio-visual-contract.md §3 (predictability), §4 (snap scheduling).
 *
 * Ordinary voices: spell, land, turn. Commander returns null (AV4 owns it).
 * No randomness, no history-dependent variation.
 */

import { getNextGridDelayMs } from './audioVisualTransport';
import { AUDIO_VISUAL_TUNING } from './presentationTuning';
import { DARK_GAME_TRACK } from './trackManifest';

export interface SemanticSoundSpec {
  freq: number;
  type: OscillatorType;
  durationMs: number;
  gain: number;
}

const SPELL_SPEC: SemanticSoundSpec = { freq: 440, type: 'sine', durationMs: 90, gain: 0.06 };
const LAND_SPEC: SemanticSoundSpec = { freq: 330, type: 'triangle', durationMs: 80, gain: 0.055 };
const TURN_SPEC: SemanticSoundSpec = { freq: 550, type: 'sine', durationMs: 70, gain: 0.05 };

export type SemanticSoundKind = 'spell-cast' | 'land-played' | 'turn-advanced' | 'commander-cast';

export function semanticSoundSpec(kind: SemanticSoundKind): SemanticSoundSpec | null {
  switch (kind) {
    case 'spell-cast': return SPELL_SPEC;
    case 'land-played': return LAND_SPEC;
    case 'turn-advanced': return TURN_SPEC;
    case 'commander-cast': return null;
    default: return null;
  }
}

/**
 * Given the current transport position in seconds, compute the delay (ms)
 * until the next grid subdivision boundary. Delegates entirely to
 * getNextGridDelayMs so sparse anchors, loop wrapping, 60ms snap window,
 * and 80ms ceiling remain one source of truth.
 */
export function presentationSoundDelayMs(positionSec: number): number {
  return getNextGridDelayMs(positionSec, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING);
}
