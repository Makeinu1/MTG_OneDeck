/**
 * AmbientBackdrop — 生きた背景(D8・design-system §8a・v4.3 最終モック確定)。
 *
 * GameScreen の背後に注入するアンビエント層。既存 UI は不変——本コンポーネントは
 * pointer-events:none + aria-hidden + z-index:-1(.game-screen の isolation 内)で
 * 全クロムの厳密に下に積層する。二スキン: ダーク=脈動する星雲 / ライト=墨の世界
 * (表示切替は CSS のテーマスコープ・tokens.css の --ambient-* を参照)。
 *
 * - トグル: ThumbZone「背景モーション」(既定 ON・localStorage・AMBIENT_CHANGE_EVENT)。
 * - タブ非表示で一時停止・prefers-reduced-motion で全静止(世界観は静止画として残す)。
 * - 有効状態は document.documentElement[data-ambient] へ同期
 *   (ハート/スタックの新しい脈動もこのゲートで既存 UI と完全一致させる)。
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AMBIENT_CHANGE_EVENT,
  BLOOM_SPOTS,
  CURRENT_SPECS,
  DRIP_SPOTS,
  buildFlecks,
  buildStarField,
  isAmbientEnabled,
  type StarKind,
} from './ambientMotion';

const STAR_LAYER_KINDS: readonly StarKind[] = ['far', 'mid', 'near'];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function AmbientBackdrop() {
  const [enabled, setEnabled] = useState(isAmbientEnabled);
  const [paused, setPaused] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  const reduced = usePrefersReducedMotion();
  const starField = useMemo(() => buildStarField(), []);
  const flecks = useMemo(() => buildFlecks(), []);

  useEffect(() => {
    const onToggle = () => setEnabled(isAmbientEnabled());
    document.addEventListener(AMBIENT_CHANGE_EVENT, onToggle);
    return () => document.removeEventListener(AMBIENT_CHANGE_EVENT, onToggle);
  }, []);

  useEffect(() => {
    const onVisibility = () => setPaused(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.ambient = enabled ? 'on' : 'off';
    return () => {
      delete document.documentElement.dataset.ambient;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className="ambient-backdrop"
      data-testid="ambient-backdrop"
      aria-hidden="true"
      data-paused={paused || undefined}
      data-reduced={reduced || undefined}
    >
      {/* ---------- ダーク = 脈動する星雲(冬のクオリティ) ---------- */}
      <div className="ambient-backdrop__dark">
        <div className="ambient-vignette" />
        <div className="ambient-nebula">
          <div className="ambient-gas ambient-gas--a" />
          <div className="ambient-gas ambient-gas--b" />
          <div className="ambient-gas ambient-gas--c" />
        </div>
        <div className="ambient-aurora" />
        {STAR_LAYER_KINDS.map((kind) => (
          <div key={kind} className={`ambient-stars ambient-stars--${kind}`}>
            {starField[kind].map((star, index) => (
              <span
                key={`${kind}-${index}`}
                className="ambient-star"
                style={{
                  '--x': `${star.x}%`,
                  '--y': `${star.y}%`,
                  '--sz': `${star.sizePx}px`,
                  '--d': `${star.periodS}s`,
                  '--dl': `${star.delayS}s`,
                  '--o': star.opacity,
                  '--glow': star.glow,
                  '--tint': star.tintVar,
                } as CSSProperties}
              />
            ))}
          </div>
        ))}
        <div className="ambient-shoot ambient-shoot--a" />
        <div className="ambient-shoot ambient-shoot--b" />
        <div className="ambient-core" />
      </div>

      {/* ---------- ライト = 墨の世界(液态呼吸 3400ms) ---------- */}
      <div className="ambient-backdrop__light">
        <div className="ambient-inkfield">
          <div className="ambient-inkcloud ambient-inkcloud--a" />
          <div className="ambient-inkcloud ambient-inkcloud--b" />
          <div className="ambient-inkcloud ambient-inkcloud--c" />
        </div>
        <div className="ambient-sun-arm"><div className="ambient-sun-wash" /></div>
        <div className="ambient-shade-arm"><div className="ambient-shade" /></div>
        <div className="ambient-sheen-arm"><div className="ambient-sheen" /></div>
        <svg className="ambient-brushlayer" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path
            className="ambient-brush ambient-brush--a"
            d="M-40,640 C220,560 430,690 700,580 S1080,470 1260,420"
          />
          <path
            className="ambient-brush ambient-brush--b"
            d="M-60,180 C260,240 520,120 820,210 S1140,300 1280,260"
          />
        </svg>
        {CURRENT_SPECS.map((current, index) => (
          <div
            key={current.y}
            className={`ambient-current ambient-current--${index + 1}`}
            style={{
              '--y': current.y,
              '--r': current.rotate,
              '--d': `${current.periodS}s`,
            } as CSSProperties}
          />
        ))}
        <svg className="ambient-brushlayer ambient-brushlayer--write" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path
            pathLength={1}
            className="ambient-write ambient-write--a"
            d="M140,120 C340,90 520,170 700,130 S1020,90 1120,140"
          />
          <path
            pathLength={1}
            className="ambient-write ambient-write--b"
            d="M90,700 C300,740 560,660 800,710 S1080,750 1160,700"
          />
        </svg>
          <div className="ambient-drips">
          {DRIP_SPOTS.map((spot, index) => (
            <span
              key={`drip-${index}`}
              className={`ambient-drip ambient-drip--${index + 1}`}
              style={{
                '--x': spot.x,
                '--y': spot.y,
                '--do': spot.opacity,
                '--dl': `${index * -1.4}s`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="ambient-blooms">
          {BLOOM_SPOTS.map((spot, index) => (
            <span
              key={`bloom-${index}`}
              className={`ambient-bloom ambient-bloom--${index + 1}`}
              style={{
                '--x': spot.x,
                '--y': spot.y,
                '--bo': spot.opacity,
                '--dl': `${index * -1.5}s`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="ambient-flecks">
          {flecks.map((fleck, index) => (
            <span
              key={`fleck-${index}`}
              className="ambient-fleck"
              style={{
                '--x': `${fleck.x}%`,
                '--y': `${fleck.y}%`,
                '--s': `${fleck.sizePx}px`,
                '--r': `${fleck.rotateDeg}deg`,
                '--d': `${fleck.periodS}s`,
                '--o': fleck.opacity,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="ambient-pool" />
        <div className="ambient-vignette ambient-vignette--light" />
      </div>
    </div>
  );
}
