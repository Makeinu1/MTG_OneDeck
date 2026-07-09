/**
 * StatusBand — 画面上端の1行(36px)。ターン/フェイズ + ゾーン枚数チップ + 自ライフ。
 * docs/design-system.md §8・docs/ui-architecture-v2.md §2。カードが主役(vision 原則7)ゆえ
 * 常設のゾーンラベル列・相手ライフ行は廃止し、数値チップ+タップシートへ集約する。
 *
 * 乖離記録(D2): ベル(フィード入口)は Feed が D3 スライスのため本スライスでは
 * 「警告件数インジケータ」(非ボタン)に留める。D3 でフィード入口へ昇格。
 */

import { useState } from 'react';
import { PHASE_ORDER } from '../../engine/types';
import { statusBandModel, PHASE_META } from './statusBandModel';
import { LifeSheet } from './LifeSheet';
import type { GameController } from './gameController';

export interface StatusBandProps {
  controller: GameController;
}

export function StatusBand({ controller }: StatusBandProps) {
  const { state, store } = controller;
  const [lifeOpen, setLifeOpen] = useState(false);
  if (!state) return null;
  const model = statusBandModel(state);
  const warningCount = store.warnings.length + state.pendingTriggers.length;

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

      {warningCount > 0 && (
        <span className="status-band__alert" data-testid="status-alert" title="要処理の警告/誘発">
          ⚠{warningCount}
        </span>
      )}

      <button
        type="button"
        className="status-band__life"
        data-testid="life-value"
        onClick={() => setLifeOpen(true)}
      >
        {model.life}
      </button>

      {lifeOpen && <LifeSheet controller={controller} onClose={() => setLifeOpen(false)} />}
    </div>
  );
}
