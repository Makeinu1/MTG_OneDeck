/**
 * StatusBand — 画面上端の1行。ターン/フェイズ + マナ + 自ライフ + ログ入口。
 * docs/design-system.md §8・docs/ui-architecture-v2.md §2。カードが主役(vision 原則7)ゆえ
 * 常設のゾーンラベル列・相手ライフ行は廃止し、高頻度の直接操作へ集約する。
 */

import { useEffect, useRef, useState } from 'react';
import { PHASE_ORDER } from '../../engine/types';
import { statusBandModel, PHASE_META } from './statusBandModel';
import { feedUnseenCount } from './feedProjection';
import { lifeFlashDirection } from './motion';
import { LifeSheet } from './LifeSheet';
import type { GameController } from './gameController';
import { manaReadinessModel } from './manaReadiness';

const MANA_LABELS = [
  { color: 'W', kanji: '白', name: '白マナ' },
  { color: 'U', kanji: '青', name: '青マナ' },
  { color: 'B', kanji: '黒', name: '黒マナ' },
  { color: 'R', kanji: '赤', name: '赤マナ' },
  { color: 'G', kanji: '緑', name: '緑マナ' },
  { color: 'C', kanji: '無', name: '無色マナ' },
] as const;

export interface StatusBandProps {
  controller: GameController;
}

export function StatusBand({ controller }: StatusBandProps) {
  const { state, store } = controller;
  const [lifeOpen, setLifeOpen] = useState(false);
  // ライフ変化の色フラッシュ(D5④)。hooks は早期 return より前。
  const life = controller.state?.life ?? null;
  const prevLife = useRef(life);
  const [lifeFlash, setLifeFlash] = useState<'gain' | 'loss' | null>(null);
  useEffect(() => {
    if (life !== null && prevLife.current !== null && life !== prevLife.current) {
      const dir = lifeFlashDirection(life - prevLife.current);
      if (dir !== 'none') {
        setLifeFlash(dir);
        const timer = setTimeout(() => setLifeFlash(null), 400);
        prevLife.current = life;
        return () => clearTimeout(timer);
      }
    }
    prevLife.current = life;
  }, [life]);
  if (!state) return null;
  const model = statusBandModel(state);
  const mana = manaReadinessModel(state);
  const unseen = feedUnseenCount(store.warnings, store.triggerCandidates);

  return (
    <div className="status-band" data-testid="status-band" data-stack-active={model.stackActive}>
      <div className="status-band__turn">
        <span className="status-band__turn-label">T</span>
        <span className="status-band__turn-num" data-testid="turn-indicator">
          {model.turn}
        </span>
      </div>

      <div className="status-band__phases" data-testid="phase-indicator" data-phase={model.phase}>
        <strong className="status-band__phase-current" data-testid="current-phase-label">
          現在：{model.phaseLabel}
        </strong>
        {PHASE_ORDER.map((phase) => (
          <span
            key={phase}
            className={`status-band__phase ${phase === model.phase ? 'is-active' : ''}`}
            title={PHASE_META[phase].label}
          >
            {PHASE_META[phase].short}
          </span>
        ))}
      </div>

      <div
        className="status-band__mana"
        data-testid="mana-readiness"
        aria-label="マナプール色別調整"
      >
        <button
          type="button"
          className="status-band__mana-total"
          data-testid="mana-details"
          onClick={() => setLifeOpen(true)}
          title="マナの詳細を開く"
        >
          計<strong>{mana.poolTotal}</strong>
        </button>
        <span className="status-band__mana-colors">
          {MANA_LABELS.map(({ color, kanji, name }) => (
            <span
              key={color}
              className="status-band__mana-stepper"
              data-mana={color}
              data-empty={mana.pool[color] === 0}
            >
              <button
                type="button"
                data-testid={`mana-minus-${color}`}
                aria-label={`${name}を1点減らす`}
                onClick={() => store.adjustMana(color, -1)}
              >−</button>
              <span title={`${name}${mana.pool[color]}点`} aria-label={`${name}${mana.pool[color]}点`}>
                {kanji}<strong>{mana.pool[color]}</strong>
              </span>
              <button
                type="button"
                data-testid={`mana-plus-${color}`}
                aria-label={`${name}を1点増やす`}
                onClick={() => store.adjustMana(color, 1)}
              >＋</button>
            </span>
          ))}
        </span>
        <span className="status-band__mana-sources" title="未タップのマナ源">源<strong>{mana.untappedSourceCount}</strong></span>
      </div>

      <div className="status-band__right-actions">
        <div className={`status-band__life-cluster${lifeFlash ? ` status-band__life--${lifeFlash}` : ''}`}>
          <button
            type="button"
            className="status-band__life-adjust"
            data-testid="life-minus"
            aria-label="ライフを1減らす"
            onClick={() => store.dispatch({ type: 'adjustLife', delta: -1 })}
          >
            −
          </button>
          <button
            type="button"
            className="status-band__life"
            data-testid="life-value"
            aria-label={`ライフ${model.life}。詳細を開く`}
            aria-live="polite"
            onClick={() => setLifeOpen(true)}
          >
            {model.life}
          </button>
          <button
            type="button"
            className="status-band__life-adjust"
            data-testid="life-plus"
            aria-label="ライフを1増やす"
            onClick={() => store.dispatch({ type: 'adjustLife', delta: 1 })}
          >
            ＋
          </button>
        </div>
        <button
          type="button"
          className="status-band__bell"
          data-testid="feed-bell"
          onClick={() => controller.openFeed()}
          title="フィード(誘発/警告/ログ)"
          aria-label="ログを開く"
        >
          🔔
          {unseen > 0 && (
            <span className="status-band__bell-badge" data-testid="feed-badge">
              {unseen}
            </span>
          )}
        </button>
      </div>

      {lifeOpen && <LifeSheet controller={controller} onClose={() => setLifeOpen(false)} />}
    </div>
  );
}
