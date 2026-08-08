/**
 * semanticSound — AV3 beat-snap delay for ordinary event sounds.
 * docs/audio-visual-contract.md §3 (predictability), §4 (snap scheduling).
 *
 * Sample data lives in sfxManifest.ts; loading/playback in sfxRenderer.ts.
 * No randomness, no history-dependent variation.
 */

import { getNextGridDelayMs } from './audioVisualTransport';
import { AUDIO_VISUAL_TUNING } from './presentationTuning';
import { DARK_GAME_TRACK, type TrackManifest } from './trackManifest';

/**
 * Given the current transport position in seconds, compute the delay (ms)
 * until the next grid subdivision boundary. Delegates entirely to
 * getNextGridDelayMs so sparse anchors, loop wrapping, 60ms snap window,
 * and 80ms ceiling remain one source of truth.
 */
export function presentationSoundDelayMs(
  positionSec: number,
  track: TrackManifest | null = DARK_GAME_TRACK,
): number {
  if (track === null) return 0;
  return getNextGridDelayMs(positionSec, track, AUDIO_VISUAL_TUNING);
}
