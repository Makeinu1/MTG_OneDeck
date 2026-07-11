/**
 * StatusBand — 画面上端の1行(36px)。ターン/フェイズ + ゾーン枚数チップ + 自ライフ。
 * docs/design-system.md §8・docs/ui-architecture-v2.md §2。カードが主役(vision 原則7)ゆえ
 * 常設のゾーンラベル列・相手ライフ行は廃止し、数値チップ+タップシートへ集約する。
 *
 * 乖離記録(D2): ベル(フィード入口)は Feed が D3 スライスのため本スライスでは
 * 「警告件数インジケータ」(非ボタン)に留める。D3 でフィード入口へ昇格。
 */

import { useEffect, useRef, useState } from 'react';
import { PHASE_ORDER } from '../../engine/types';
import { statusBandModel, PHASE_META } from './statusBandModel';
import { feedUnseenCount } from './feedProjection';
import { lifeFlashDirection } from './motion';
import { LifeSheet } from './LifeSheet';
import type { GameController } from './gameController';

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

      <div className="status-band__zones">
        {model.zones.map((chip) => {
          const openable = chip.zone === 'graveyard' || chip.zone === 'exile' || chip.zone === 'library';
          return (
            <button
              key={chip.zone}
              type="button"
              className="status-band__chip"
              data-testid={chip.testId}
              disabled={!openable}
              onClick={() => {
                if (openable) controller.openZoneViewer(chip.zone as 'graveyard' | 'exile' | 'library');
              }}
            >
              <span className="status-band__chip-label">{chip.label}</span>
              <span className="status-band__chip-count">{chip.count}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="status-band__bell"
        data-testid="feed-bell"
        onClick={() => controller.openFeed()}
        title="フィード(誘発/警告/ログ)"
      >
        🔔
        {unseen > 0 && (
          <span className="status-band__bell-badge" data-testid="feed-badge">
            {unseen}
          </span>
        )}
      </button>

      <button
        type="button"
        className={`status-band__life${lifeFlash ? ` status-band__life--${lifeFlash}` : ''}`}
        data-testid="life-value"
        onClick={() => setLifeOpen(true)}
      >
        {model.life}
      </button>

      {lifeOpen && <LifeSheet controller={controller} onClose={() => setLifeOpen(false)} />}
    </div>
  );
}
