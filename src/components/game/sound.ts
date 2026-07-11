/**
 * sound — 祝祭感の効果(D5): WebAudio 合成音 + ハプティクス。docs/design-system.md §7/§7b。
 *
 * 音は**既定 OFF・opt-in**(motion.isSoundEnabled)。WebAudio の OscillatorNode + エンベロープで
 * 合成する(外部アセット/依存の追加なし=STOP③回避)。音数 ≤3・各 ≤400ms。3レイヤー設計は D7。
 * ハプティクス navigator.vibrate(10) を primary/draw/resolve に(reduced-motion では抑制)。
 */

import { isSoundEnabled } from './motion';

/** 祝祭の効果種別(ハプティクス/音の発火点)。 */
export type CelebrationEffect = 'primary' | 'draw' | 'resolve';

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** 効果種別 → 合成パラメータ(周波数 Hz / 波形 / 長さ秒)。 */
const TONE: Record<CelebrationEffect, { freq: number; type: OscillatorType; dur: number; gain: number }> = {
  primary: { freq: 320, type: 'triangle', dur: 0.06, gain: 0.05 }, // 極小クリック
  draw: { freq: 520, type: 'sine', dur: 0.12, gain: 0.06 }, // 紙の滑り(短い上昇なし=単音)
  resolve: { freq: 740, type: 'sine', dur: 0.22, gain: 0.07 }, // 澄んだ確定音
};

function playTone(effect: CelebrationEffect): void {
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();
  const { freq, type, dur, gain } = TONE[effect];
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const now = audio.currentTime;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(gain, now + 0.008); // 素早いアタック
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur); // 減衰
  osc.connect(env).connect(audio.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

/** 効果種別の音を再生(opt-in ON の時のみ)。 */
export function playCelebrationSound(effect: CelebrationEffect): void {
  if (!isSoundEnabled()) return;
  try {
    playTone(effect);
  } catch {
    // 再生失敗は無視(演出は装飾層ゆえ操作を阻害しない)。
  }
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 祝祭効果(ハプティクス + 音)を発火。演出は装飾層ゆえ状態は即時反映済み・本関数は非同期に鳴らすだけ。
 * reduced-motion 時はハプティクスも抑制する(音は opt-in ゆえそのまま=ユーザー選択を尊重)。
 */
export function celebrate(effect: CelebrationEffect): void {
  if (!reducedMotion() && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(10);
    } catch {
      // 一部環境で throw する vibrate を無視。
    }
  }
  playCelebrationSound(effect);
}
