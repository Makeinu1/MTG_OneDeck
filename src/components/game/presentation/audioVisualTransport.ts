/**
 * audioVisualTransport — AV0 の純粋 transport-grid プリミティブ。
 * docs/audio-visual-contract.md §4(即時応答と拍同期)・§6(基準曲と transport)。
 *
 * 責務は manifest の検証と「次の細分グリッドまでの遅延」算出のみ。Media 再生・
 * AudioContext・React provider は AV1 以降の責務で、本モジュールは含めない。
 *
 * グリッド補間: 隣接 anchor a/b に対し beatSpan = b.beatIndex - a.beatIndex、
 * stepCount = beatSpan * quantizeStepsPerBeat。anchor 間を stepCount 個へ等分する
 * (anchor 間全体を quantizeStepsPerBeat 個だけに分けてはならない)。ループ終端で
 * 巻き戻る。次のグリッドが snapWindowMs 以内ならその遅延(ms)を、外れる場合だけ
 * 即時再生を示す 0 を返す。
 */

import type { AudioVisualTuning } from './presentationTuning';
import type { TrackManifest } from './trackManifest';

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * manifest の不変条件を検証し、違反内容の文字列配列を返す。空配列 = 合格。
 * 固定 BPM から別時計を作らず、anchor 列自体を transport の唯一の時刻表として使う。
 */
export function validateTrackManifest(manifest: TrackManifest): string[] {
  const errors: string[] = [];

  if (typeof manifest.id !== 'string' || manifest.id.length === 0) {
    errors.push('id must be a non-empty string');
  }
  if (typeof manifest.src !== 'string' || manifest.src.length === 0) {
    errors.push('src must be a non-empty string');
  }
  if (typeof manifest.sha256 !== 'string' || !SHA256_PATTERN.test(manifest.sha256)) {
    errors.push('sha256 must be a 64-char hex digest');
  }
  if (!Number.isFinite(manifest.bpmNominal) || manifest.bpmNominal <= 0) {
    errors.push('bpmNominal must be a positive finite number');
  }
  if (!Number.isFinite(manifest.loopStartSec) || manifest.loopStartSec < 0) {
    errors.push('loopStartSec must be a non-negative finite number');
  }
  if (
    !Number.isFinite(manifest.loopEndSec) ||
    manifest.loopEndSec <= manifest.loopStartSec
  ) {
    errors.push('loopEndSec must be greater than loopStartSec');
  }
  if (!Number.isFinite(manifest.gainDb)) {
    errors.push('gainDb must be finite');
  }
  if (!Number.isFinite(manifest.crossfadeMs) || manifest.crossfadeMs < 0) {
    errors.push('crossfadeMs must be a non-negative finite number');
  }

  const anchors = manifest.beatAnchors;
  if (!Array.isArray(anchors) || anchors.length < 2) {
    errors.push('beatAnchors must contain at least two anchors');
    return errors;
  }

  if (anchors[0].atSeconds !== manifest.loopStartSec) {
    errors.push('first beatAnchor must sit at loopStartSec');
  }
  if (anchors[anchors.length - 1].atSeconds !== manifest.loopEndSec) {
    errors.push('last beatAnchor must sit at loopEndSec');
  }

  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    if (!Number.isFinite(anchor.atSeconds) || !Number.isFinite(anchor.beatIndex)) {
      errors.push(`beatAnchor[${index}] must have finite beatIndex and atSeconds`);
      continue;
    }
    if (index === 0) continue;
    const previous = anchors[index - 1];
    const beatSpan = anchor.beatIndex - previous.beatIndex;
    if (!Number.isInteger(beatSpan) || beatSpan <= 0) {
      errors.push(`beatAnchor[${index}] beatIndex must increase by a positive integer`);
    }
    if (anchor.atSeconds <= previous.atSeconds) {
      errors.push(`beatAnchor[${index}] atSeconds must be strictly increasing`);
    }
  }

  return errors;
}

/**
 * 現在位置 currentSec から次の細分グリッドまでの遅延(ms)を返す。
 * 次のグリッドが snapWindowMs 以内ならその遅延、外れる場合は即時再生の 0。
 * currentSec はループ範囲外でもよく、ループ長で巻いて扱う。
 */
export function getNextGridDelayMs(
  currentSec: number,
  manifest: TrackManifest,
  tuning: AudioVisualTuning,
): number {
  const loopDuration = manifest.loopEndSec - manifest.loopStartSec;
  if (!Number.isFinite(currentSec) || loopDuration <= 0) {
    return 0;
  }

  // ループ位置 [loopStartSec, loopEndSec) へ正規化(巻戻り)。
  const relative = ((currentSec - manifest.loopStartSec) % loopDuration + loopDuration) % loopDuration;
  const position = manifest.loopStartSec + relative;

  const anchors = manifest.beatAnchors;
  // position を含む anchor span [a, b) を探す。最終 anchor = loopEndSec > position なので必ず見つかる。
  let spanStart = 0;
  for (let index = 0; index < anchors.length - 1; index += 1) {
    if (anchors[index].atSeconds <= position) {
      spanStart = index;
    } else {
      break;
    }
  }
  const a = anchors[spanStart];
  const b = anchors[spanStart + 1] ?? anchors[spanStart];

  const beatSpan = b.beatIndex - a.beatIndex;
  const spanDuration = b.atSeconds - a.atSeconds;
  if (!Number.isInteger(beatSpan) || beatSpan <= 0 || spanDuration <= 0) {
    return 0;
  }

  const stepCount = beatSpan * tuning.quantizeStepsPerBeat;
  const stepDuration = spanDuration / stepCount;
  const offset = position - a.atSeconds;

  // 現在位置の直後のグリッド境界(厳密に未来)を求める。
  const nextStepIndex = Math.floor(offset / stepDuration) + 1;
  const nextGridSec = a.atSeconds + nextStepIndex * stepDuration;
  const delayMs = (nextGridSec - position) * 1000;

  if (delayMs <= tuning.snapWindowMs) {
    return delayMs;
  }
  return 0;
}

/**
 * CSS animation timing derived from the enclosing sparse-anchor span.
 * Returns beat duration (ms) and a negative phase delay (ms) so CSS
 * animations align to the transport grid. Normalizes across full-track
 * loops so position wrapping is transparent.
 */
export function getTransportCssTiming(
  currentSec: number,
  manifest: TrackManifest,
): { beatMs: number; phaseDelayMs: number } {
  const loopDuration = manifest.loopEndSec - manifest.loopStartSec;
  if (!Number.isFinite(currentSec) || loopDuration <= 0) {
    return { beatMs: 700, phaseDelayMs: 0 };
  }

  const relative =
    ((currentSec - manifest.loopStartSec) % loopDuration + loopDuration) %
    loopDuration;
  const position = manifest.loopStartSec + relative;

  const anchors = manifest.beatAnchors;
  const EPSILON = 1e-9;
  let spanStart = 0;
  for (let index = 0; index < anchors.length - 1; index += 1) {
    if (anchors[index].atSeconds <= position + EPSILON) {
      spanStart = index;
    } else {
      break;
    }
  }
  const a = anchors[spanStart];
  const b = anchors[spanStart + 1] ?? anchors[spanStart];

  const beatSpan = b.beatIndex - a.beatIndex;
  const spanDuration = b.atSeconds - a.atSeconds;
  if (!Number.isInteger(beatSpan) || beatSpan <= 0 || spanDuration <= 0) {
    return { beatMs: 700, phaseDelayMs: 0 };
  }

  const beatDurationSec = spanDuration / beatSpan;
  const beatMs = beatDurationSec * 1000;
  const offsetInSpan = Math.max(0, position - a.atSeconds);
  let offsetInBeat = offsetInSpan % beatDurationSec;
  if (beatDurationSec - offsetInBeat < EPSILON) offsetInBeat = 0;
  if (offsetInBeat < EPSILON) offsetInBeat = 0;
  const phaseDelayMs = -(offsetInBeat * 1000);

  return { beatMs, phaseDelayMs };
}
