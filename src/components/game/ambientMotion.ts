/**
 * ambientMotion — 生きた背景(D8)の純関数層。docs/design-system.md §8a。
 *
 * 視覚正本 = research/design/mockups/ambient-motion.html(v4.3 最終確定)。
 * アンビエント層は GameScreen 背後への注入のみ(既存 UI は不変)。二スキン:
 * ダーク = 脈動する星雲(鼓動 700ms)/ ライト = 墨の世界(液态呼吸 3400ms)。
 *
 * 純粋性: DOM/時刻に依存しない(reduced 判定は引数で受ける)。localStorage 関数のみ副作用
 * (motion.ts と同じ流儀)。テンポはトークン固定値——モックの速度スライダー(×0.4-3)は
 * モック専用であり製品に持ち込まない。
 */

/** 鼓動のペースアンカー(ダーク)。design-system §8a。 */
export const AMBIENT_BEAT_MS = 700;

/** トグルの永続化キー(§8a・§7b 音トグルと同パターン)。 */
export const AMBIENT_STORAGE_KEY = 'mtg-onedeck:ambient-motion';
/** トグル変更の通知イベント(document 発火・AmbientBackdrop が購読)。 */
export const AMBIENT_CHANGE_EVENT = 'mtg-onedeck:ambient-change';

/** 鼓動周期(ms)。reduced-motion 時は 0(全静止)。 */
export function ambientBeatMs(options: { reduced?: boolean } = {}): number {
  if (options.reduced === true) return 0;
  return AMBIENT_BEAT_MS;
}

/** 背景モーションの opt-in 状態(§8a: 既定 ON・'off' のみ無効)。 */
export function isAmbientEnabled(): boolean {
  try {
    return localStorage.getItem(AMBIENT_STORAGE_KEY) !== 'off';
  } catch {
    return true; // localStorage 不可(private mode 等)は既定 ON。
  }
}

export function setAmbientEnabled(on: boolean): void {
  try {
    localStorage.setItem(AMBIENT_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // localStorage 不可時は無視(次回も既定 ON)。
  }
}

/* ------------------------------------------------------------ 星(ダーク) */

export type StarKind = 'far' | 'mid' | 'near';

export interface StarSpec {
  /** 左からの位置(%)。 */
  x: number;
  /** 上からの位置(%)。 */
  y: number;
  /** 直径(px)。 */
  sizePx: number;
  /** きらめき周期(s・個別周波数)。 */
  periodS: number;
  /** 位相(s・負 delay)。 */
  delayS: number;
  /** 最大 opacity(個別)。 */
  opacity: number;
  /** 光暈の倍率。 */
  glow: number;
  /** 色(var(--ambient-star-N) 参照・生カラー禁止)。 */
  tintVar: string;
}

/** 冷たいパレット(白〜氷色中心・暖色は約1/5)。tokens.css の --ambient-star-* 参照。 */
const STAR_TINT_VARS = [
  'var(--ambient-star-1)',
  'var(--ambient-star-2)',
  'var(--ambient-star-3)',
  'var(--ambient-star-4)',
  'var(--ambient-star-5)',
];

/** 3層・計156(遠84/中46/近26)。星は主役ではない。 */
export const STAR_COUNTS: Record<StarKind, number> = { far: 84, mid: 46, near: 26 };

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * 1層ぶんの決定的配置(モック v4.3 の数式をそのまま移植)。
 * スパイク廃止=やわらかな光点のみ(十字フレアはユーザー却下)。
 */
export function buildStarLayer(kind: StarKind): StarSpec[] {
  const count = STAR_COUNTS[kind];
  const offsetX = kind === 'far' ? 11 : kind === 'mid' ? 29 : 47;
  const offsetY = kind === 'far' ? 7 : kind === 'mid' ? 19 : 3;
  const basePeriodS = kind === 'far' ? 3.2 : kind === 'mid' ? 2.4 : 1.5;
  const baseOpacity = kind === 'far' ? 0.42 : kind === 'mid' ? 0.62 : 0.8;
  const glow = kind === 'far' ? 2.6 : kind === 'mid' ? 3.2 : 4.4;
  const specs: StarSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const sizePx = kind === 'far' ? 1 + (i % 2) : kind === 'mid' ? 1.6 + (i % 2) : 2.6 + (i % 3);
    specs.push({
      x: round1((i * 53.7 + offsetX) % 100),
      y: round1(((i * 31.3 + offsetY) % 90) + 3),
      sizePx,
      periodS: round1(basePeriodS + ((i * 37) % 22) / 10),
      delayS: round1(-(((i * 61) % 40) / 10)),
      opacity: baseOpacity + (i % 3) * 0.07,
      glow,
      tintVar: STAR_TINT_VARS[i % STAR_TINT_VARS.length],
    });
  }
  return specs;
}

export type StarField = Record<StarKind, StarSpec[]>;

export function buildStarField(): StarField {
  return { far: buildStarLayer('far'), mid: buildStarLayer('mid'), near: buildStarLayer('near') };
}

/* ------------------------------------------------------------ 墨(ライト) */

/** 墨の滲み(bloom)×6 の定点(モック v4.3)。色は CSS クラス(ambient-bloom--N・トークン参照)。 */
export const BLOOM_SPOTS = [
  { x: '20%', y: '28%', opacity: 0.6 },
  { x: '76%', y: '22%', opacity: 0.55 },
  { x: '64%', y: '70%', opacity: 0.55 },
  { x: '28%', y: '78%', opacity: 0.5 },
  { x: '48%', y: '46%', opacity: 0.45 },
  { x: '90%', y: '58%', opacity: 0.5 },
] as const;

/** 墨の滴×5 の定点(モック v4.3)。色は CSS クラス(ambient-drip--N・トークン参照)。 */
export const DRIP_SPOTS = [
  { x: '16%', y: '40%', opacity: 0.5 },
  { x: '58%', y: '18%', opacity: 0.45 },
  { x: '82%', y: '46%', opacity: 0.45 },
  { x: '38%', y: '64%', opacity: 0.4 },
  { x: '70%', y: '84%', opacity: 0.4 },
] as const;

/** 奔流×3(14s/18s/22s・モック v4.3)。色は CSS クラス(ambient-current--N・トークン参照)。 */
export const CURRENT_SPECS = [
  { y: '16%', rotate: '-7deg', periodS: 14 },
  { y: '52%', rotate: '5deg', periodS: 18 },
  { y: '78%', rotate: '-4deg', periodS: 22 },
] as const;

export interface FleckSpec {
  x: number;
  y: number;
  sizePx: number;
  rotateDeg: number;
  periodS: number;
  opacity: number;
}

/** 金箔×10(ドリフト+瞬き・モック v4.3 の数式をそのまま移植)。 */
export function buildFlecks(): FleckSpec[] {
  const specs: FleckSpec[] = [];
  for (let i = 0; i < 10; i += 1) {
    specs.push({
      x: 6 + i * 9.4,
      y: 12 + ((i * 43) % 66),
      sizePx: 4 + (i % 3),
      rotateDeg: (i * 47) % 360,
      periodS: 9 + ((i * 29) % 80) / 10,
      opacity: 0.5 + (i % 3) * 0.15,
    });
  }
  return specs;
}
