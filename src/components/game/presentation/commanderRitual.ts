/**
 * commanderRitual — AV4 deterministic motif + duck envelope (pure, no React/DOM).
 * docs/audio-visual-contract.md §5 (commander cast ritual).
 *
 * The motif is a fixed three-note ascending figure played through the
 * CommanderBus. The duck envelope temporarily attenuates MusicBus by −4 dB
 * using the frozen COMMANDER_MIX_TUNING timing.
 */

import { COMMANDER_MIX_TUNING } from './presentationTuning';

export const COMMANDER_RITUAL_DURATION_MS = 650;

export interface MotifNote {
  freq: number;
  type: OscillatorType;
  offsetMs: number;
  durationMs: number;
  gain: number;
}

const MOTIF_SPEC: readonly MotifNote[] = [
  { freq: 392.0, type: 'sine', offsetMs: 0, durationMs: 260, gain: 0.38 },
  { freq: 493.88, type: 'sine', offsetMs: 120, durationMs: 260, gain: 0.34 },
  { freq: 587.33, type: 'triangle', offsetMs: 260, durationMs: 380, gain: 0.30 },
] as const;

export function commanderMotifSpec(): readonly MotifNote[] {
  return MOTIF_SPEC;
}

export interface DuckEnvelope {
  duckGain: number;
  attackEndSec: number;
  holdEndSec: number;
  releaseEndSec: number;
}

export function commanderDuckEnvelope(startSec: number, baseGain: number): DuckEnvelope {
  const { duckDb, attackMs, holdMs, releaseMs } = COMMANDER_MIX_TUNING;
  const duckGain = baseGain * Math.pow(10, duckDb / 20);
  const attackEndSec = startSec + attackMs / 1000;
  const holdEndSec = attackEndSec + holdMs / 1000;
  const releaseEndSec = holdEndSec + releaseMs / 1000;
  return { duckGain, attackEndSec, holdEndSec, releaseEndSec };
}

/**
 * Duck is an audible semantic event: only when both event sounds and music
 * are audible (contract §4 step 2, §5).
 */
export function shouldDuckMusic(eventsAudible: boolean, musicAudible: boolean): boolean {
  return eventsAudible && musicAudible;
}
