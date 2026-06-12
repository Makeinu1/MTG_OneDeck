import { useState } from 'react';
import type { GameState } from '../../engine/types';
import type { useGameStore } from '../../store/gameStore';
import { PHASE_ORDER } from '../../engine/types';

const PHASE_LABELS: Record<string, string> = {
  untap: 'アンタップ',
  upkeep: 'アップキープ',
  draw: 'ドロー',
  main1: 'メイン1',
  combat: '戦闘',
  main2: 'メイン2',
  end: '終了',
};

const MANA_ORDER: (keyof GameState['manaPool'])[] = ['W', 'U', 'B', 'R', 'G', 'C'];
const MANA_LABELS: Record<string, string> = {
  W: '白', U: '青', B: '黒', R: '赤', G: '緑', C: '無',
};

type Store = ReturnType<typeof useGameStore.getState>;

export interface SidePanelProps {
  state: GameState;
  store: Store;
  onMulligan: () => void;
  onRestart: () => void;
  onBackToImport: () => void;
}

/** Left-hand control panel: life, counters, commander damage, mana, turn/phase, history. */
export function SidePanel({ state, store, onMulligan, onRestart, onBackToImport }: SidePanelProps) {
  const [opponentLabels, setOpponentLabels] = useState<string[]>(() =>
    Object.keys(state.commanderDamage).length > 0 ? Object.keys(state.commanderDamage) : ['対戦相手A'],
  );
  const [newLabel, setNewLabel] = useState('');

  function adjustLife(delta: number): void {
    store.dispatch({ type: 'adjustLife', delta });
  }

  function adjustCounter(kind: 'poison' | 'energy' | 'experience', delta: number): void {
    store.dispatch({ type: 'adjustPlayerCounter', kind, delta });
  }

  function adjustCommanderDamage(label: string, delta: number): void {
    store.dispatch({ type: 'adjustCommanderDamage', label, delta });
  }

  function addOpponent(): void {
    const label = newLabel.trim();
    if (label === '' || opponentLabels.includes(label)) return;
    setOpponentLabels((prev) => [...prev, label]);
    setNewLabel('');
  }

  const currentPhaseIndex = PHASE_ORDER.indexOf(state.phase);

  return (
    <aside className="side-panel">
      <section className="side-panel__section side-panel__section--turn">
        <div className="side-panel__turn-row">
          <span className="side-panel__turn-label">ターン</span>
          <span className="side-panel__turn-value" data-testid="turn-indicator">
            {state.turn}
          </span>
        </div>
        <div className="phase-track" data-testid="phase-indicator" data-phase={state.phase}>
          {PHASE_ORDER.map((phase, i) => (
            <span
              key={phase}
              className={`phase-track__step ${i === currentPhaseIndex ? 'phase-track__step--active' : ''} ${
                i < currentPhaseIndex ? 'phase-track__step--done' : ''
              }`}
            >
              {PHASE_LABELS[phase]}
            </span>
          ))}
        </div>
        <div className="side-panel__buttons">
          <button type="button" className="btn btn--accent" data-testid="next-phase" onClick={() => store.nextPhase()}>
            次のフェイズ
          </button>
          <button type="button" className="btn" data-testid="next-turn" onClick={() => store.nextTurn()}>
            次のターン
          </button>
        </div>
      </section>

      <section className="side-panel__section">
        <h3>ライフ</h3>
        <div className="stat-row">
          <button type="button" className="stat-row__btn" onClick={() => adjustLife(-1)} aria-label="ライフを減らす">
            −
          </button>
          <span className="stat-row__value stat-row__value--life" data-testid="life-value">
            {state.life}
          </span>
          <button type="button" className="stat-row__btn" onClick={() => adjustLife(1)} aria-label="ライフを増やす">
            +
          </button>
        </div>
      </section>

      <section className="side-panel__section">
        <h3>カウンター</h3>
        <div className="counter-list">
          <CounterRow label="毒" value={state.poison} onChange={(d) => adjustCounter('poison', d)} testId="poison" />
          <CounterRow label="エネルギー" value={state.energy} onChange={(d) => adjustCounter('energy', d)} testId="energy" />
          <CounterRow
            label="経験"
            value={state.experience}
            onChange={(d) => adjustCounter('experience', d)}
            testId="experience"
          />
        </div>
      </section>

      <section className="side-panel__section">
        <h3>統率者ダメージ</h3>
        <div className="counter-list">
          {opponentLabels.map((label) => (
            <CounterRow
              key={label}
              label={label}
              value={state.commanderDamage[label] ?? 0}
              onChange={(d) => adjustCommanderDamage(label, d)}
              testId={`commander-damage-${label}`}
              danger={(state.commanderDamage[label] ?? 0) >= 21}
            />
          ))}
        </div>
        <div className="side-panel__add-opponent">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="対戦相手名を追加"
            data-testid="commander-damage-new-label"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addOpponent();
            }}
          />
          <button type="button" className="btn btn--ghost btn--sm" onClick={addOpponent} data-testid="commander-damage-add">
            追加
          </button>
        </div>
      </section>

      <section className="side-panel__section">
        <h3>マナプール</h3>
        <div className="mana-pool" data-testid="mana-pool">
          {MANA_ORDER.map((color) => (
            <div key={color} className={`mana-pool__pip mana-pool__pip--${color.toLowerCase()}`} data-testid={`mana-pool-${color}`}>
              <span className="mana-pool__symbol">{MANA_LABELS[color]}</span>
              <span className="mana-pool__count">{state.manaPool[color]}</span>
            </div>
          ))}
        </div>
        {Object.values(state.manaPool).some((v) => v > 0) && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => store.dispatch({ type: 'clearManaPool' })}>
            プールを空にする
          </button>
        )}
      </section>

      <section className="side-panel__section">
        <h3>履歴・マリガン</h3>
        <div className="side-panel__buttons">
          <button type="button" className="btn" data-testid="undo" disabled={!store.canUndo} onClick={() => store.undo()}>
            戻す
          </button>
          <button type="button" className="btn" data-testid="redo" disabled={!store.canRedo} onClick={() => store.redo()}>
            やり直す
          </button>
        </div>
        <button type="button" className="btn btn--ghost" data-testid="mulligan" onClick={onMulligan}>
          マリガン
        </button>
      </section>

      <section className="side-panel__section">
        <h3>ゲーム管理</h3>
        <button type="button" className="btn btn--ghost" data-testid="restart-game" onClick={onRestart}>
          最初からやり直す
        </button>
        <button type="button" className="btn btn--ghost" data-testid="back-to-import" onClick={onBackToImport}>
          デッキ選択に戻る
        </button>
      </section>
    </aside>
  );
}

function CounterRow({
  label,
  value,
  onChange,
  testId,
  danger,
}: {
  label: string;
  value: number;
  onChange: (delta: number) => void;
  testId: string;
  danger?: boolean;
}) {
  return (
    <div className="stat-row stat-row--compact">
      <span className="stat-row__label">{label}</span>
      <button type="button" className="stat-row__btn stat-row__btn--sm" onClick={() => onChange(-1)} aria-label={`${label}を減らす`}>
        −
      </button>
      <span className={`stat-row__value stat-row__value--sm ${danger ? 'stat-row__value--danger' : ''}`} data-testid={`${testId}-value`}>
        {value}
      </span>
      <button type="button" className="stat-row__btn stat-row__btn--sm" onClick={() => onChange(1)} aria-label={`${label}を増やす`}>
        +
      </button>
    </div>
  );
}
