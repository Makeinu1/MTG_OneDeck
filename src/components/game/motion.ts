/**
 * motion — 祝祭感(D5)の演出方針の純関数層。docs/design-system.md §7 演出レベル体系 L0-L4。
 *
 * D5 が実装する中核4種のモーションと、reduced-motion 分岐・連続イベント圧縮・音の opt-in を
 * 純関数で定義する(実際の CSS アニメ/WebAudio はコンポーネント/sound.ts が本モジュールを参照)。
 * L4(高揚)/演出レベル制御機構は D6、音3レイヤーは D7 へ defer(§7 実装スライス対応)。
 *
 * 純粋性: DOM/時刻に依存しない(reduced 判定は引数で受ける)。localStorage 関数のみ副作用。
 */

/** D5 が祝祭する状態変化の種別。 */
export type CelebrationKind = 'draw' | 'resolve' | 'etb' | 'life' | 'damage';

/** 演出レベル(§7)。L0=静寂 / L1=小反応 / L2=明確 / L3=儀式 / L4=高揚(D6)。 */
export type MotionLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

/** D5 中核4種 → 演出レベル(§7 表)。ドロー=L2・解決/ETB=L3・ライフ=L1・ダメージ=L2。 */
const KIND_LEVEL: Record<CelebrationKind, MotionLevel> = {
  draw: 'L2',
  resolve: 'L3',
  etb: 'L3',
  life: 'L1',
  damage: 'L2',
};

/** 演出レベル → 時間予算トークン(§7・reduced-motion 時は 0ms)。 */
const LEVEL_DURATION: Record<MotionLevel, string> = {
  L0: '0ms',
  L1: 'var(--dur-fast)',
  L2: 'var(--dur-move)',
  L3: 'var(--dur-hero)',
  L4: 'var(--dur-ritual)',
};

/**
 * 演出方針の正本(§7)。イベント種別→L値と L値→時間トークン/reduced-motion 分岐を pin する。
 * これらは playbook §3 D5(b) が要求する「純関数で検証する演出方針」であり、game.css の
 * @keyframes 側は同じトークン(--dur-*)+ @media(prefers-reduced-motion) で*実装*する
 * (方針=本モジュール / 実装=CSS の二層。値が食い違わないことを review.d5 が保証する)。
 */
export function motionLevelFor(kind: CelebrationKind): MotionLevel {
  return KIND_LEVEL[kind] ?? 'L0';
}

/** 演出時間トークンを返す。reduced=true(prefers-reduced-motion)なら全て 0ms(フェードのみ)。 */
export function motionDuration(level: MotionLevel, reduced: boolean): string {
  if (reduced) return '0ms';
  return LEVEL_DURATION[level];
}

/**
 * 連続する同種イベントの圧縮判定。前イベントから windowMs 未満なら圧縮(§7「連続処理は自動圧縮」)。
 * 例: 連続ドローは L1 級(~120ms)へ畳んでテンポを守る。
 */
export function shouldCompress(prevMs: number | null, nowMs: number, windowMs = 300): boolean {
  if (prevMs === null) return false;
  return nowMs - prevMs < windowMs;
}

/** ライフ変化の方向(色フラッシュの向き)。 */
export function lifeFlashDirection(delta: number): 'gain' | 'loss' | 'none' {
  if (delta > 0) return 'gain';
  if (delta < 0) return 'loss';
  return 'none';
}

/**
 * musical-event 層の opt-out 状態(新規既定 ON・localStorage 永続)。
 * docs/audio-visual-contract.md §6: 保存値が存在しない新規利用者は ON。明示的に
 * 保存された値('on'/'off')のみが設定を覆す。AV0 の audioVisualPreferences が
 * この legacy キーを musical-event 設定へ移行する(移行元・同一キー)。
 */
export const SOUND_STORAGE_KEY = 'mtg-onedeck:sound-enabled';

export function isSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_STORAGE_KEY);
    if (stored === 'off') return false;
    return true; // 未設定(新規既定 ON)・'on'・legacy 空値は ON。
  } catch {
    return true; // localStorage 不可(private mode 等)は既定 ON へ倒す。
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // localStorage 不可時は無視(次回も既定 ON)。
  }
}
