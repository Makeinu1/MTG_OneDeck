/**
 * commanderRitual — AV4 duck envelope and ritual duration (pure, no React/DOM).
 * docs/audio-visual-contract.md §5 (commander cast ritual).
 *
 * Motif samples live in sfxManifest.ts; loading/playback in sfxRenderer.ts.
 * The duck envelope temporarily attenuates MusicBus by −4 dB
 * using the frozen COMMANDER_MIX_TUNING timing.
 */

import { COMMANDER_MIX_TUNING } from './presentationTuning';

export const COMMANDER_RITUAL_DURATION_MS = 650;

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
