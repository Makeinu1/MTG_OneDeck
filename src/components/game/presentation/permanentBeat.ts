/**
 * permanentBeat — AV5 density decay (pure function, no audio imports).
 * docs/audio-visual-contract.md §10「密度減衰」.
 *
 * Returns a [0, 1] multiplier: 1.0 at or below beatDensityFullSlots,
 * 0.0 at or above beatDensityZeroSlots, linear in between.
 */

import type { PermanentBeatTuning } from './presentationTuning';

/**
 * Compute beat amplitude density for a given slot count.
 * clamp((zeroSlots - count) / (zeroSlots - fullSlots), 0, 1)
 */
export function beatDensity(slotCount: number, tuning: PermanentBeatTuning): number {
  const { beatDensityFullSlots: full, beatDensityZeroSlots: zero } = tuning;
  const range = zero - full;
  if (range <= 0) return slotCount <= full ? 1 : 0;
  const raw = (zero - slotCount) / range;
  return Math.max(0, Math.min(1, raw));
}
