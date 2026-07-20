/**
 * LifeSheet — ライフ/マナ/カウンターの bottom sheet(ステータス帯のライフのタップ先)。
 * 相手ライフ行・マナプール・各種カウンターを常設しない(vision 原則7)ぶん、ここに集約する。
 *
 * D2(Tier-1監査でHUD操作欠落BLOCKER指摘を受け拡張): LifeOverlay/ManaOverlay
 * が持っていたライフ・マナプール・毒/エネルギー/経験/統率者ダメージの調整をここへ移設。
 * 残るHUD操作(ダイス/コイン/増殖/全タップ/自動メイン/情報パネル)は ThumbZone のメニューへ。
 */

import { useEffect, useId, useRef } from 'react';
import type { ManaColor } from '../../types/card';
import type { GameController } from './gameController';

const YOUR_STEPS = [-5, -1, 1, 5];
const MANA_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];
const MANA_LABELS: Record<ManaColor, string> = { W: '白', U: '青', B: '黒', R: '赤', G: '緑', C: '無' };
const PLAYER_COUNTERS: Array<{ kind: 'poison' | 'energy' | 'experience'; label: string }> = [
  { kind: 'poison', label: '毒' },
  { kind: 'energy', label: 'エネルギー' },
  { kind: 'experience', label: '経験' },
];

export interface LifeSheetProps {
  controller: GameController;
  onClose: () => void;
}

export function LifeSheet({ controller, onClose }: LifeSheetProps) {
  const { state, store } = controller;
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const restoreFocusTo = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (restoreFocusTo?.isConnected) restoreFocusTo.focus();
    };
  }, []);

  if (!state) return null;

  const opponentLabels = Array.from(
    new Set(['対戦相手A', ...Object.keys(state.opponentLife), ...Object.keys(state.commanderDamage)]),
  );
  const manaTotal = MANA_ORDER.reduce((sum, c) => sum + (state.manaPool[c] ?? 0), 0);
  const maximumHandSizeOverride = state.players[state.localPlayerId]?.maximumHandSizeOverride;

  return (
    <div className="game-sheet-overlay" data-testid="life-sheet-overlay" onClick={onClose}>
      <div
        className="game-sheet"
        data-testid="life-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="game-sheet__header">
          <span className="game-sheet__title" id={titleId}>ライフ・マナ・カウンター</span>
          <button ref={closeButtonRef} type="button" className="game-sheet__close" onClick={onClose} data-testid="life-sheet-close">
            閉じる
          </button>
        </div>

        <div className="life-sheet__row">
          <span className="life-sheet__label">あなた</span>
          <span className="life-sheet__value" data-testid="life-sheet-value">
            {state.life}
          </span>
          <div className="life-sheet__steps">
            {YOUR_STEPS.map((delta) => (
              <button
                key={delta}
                type="button"
                className="life-sheet__step"
                data-testid={`life-step-${delta}`}
                onClick={() => store.dispatch({ type: 'adjustLife', delta })}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>

        <div className="life-sheet__section" data-testid="maximum-hand-size-section">
          <div className="life-sheet__section-head">
            <label className="life-sheet__label" htmlFor="maximum-hand-size-mode">
              手札上限（手動補正）
            </label>
            <select
              id="maximum-hand-size-mode"
              className="life-sheet__select"
              data-testid="maximum-hand-size-mode"
              value={maximumHandSizeOverride === undefined
                ? 'auto'
                : maximumHandSizeOverride === 'none'
                  ? 'none'
                  : 'number'}
              onChange={(event) => {
                const mode = event.currentTarget.value;
                store.dispatch({
                  type: 'setMaximumHandSizeOverride',
                  value: mode === 'auto' ? undefined : mode === 'none' ? 'none' : 7,
                });
              }}
            >
              <option value="auto">自動（通常7枚）</option>
              <option value="none">上限なし</option>
              <option value="number">枚数を指定</option>
            </select>
          </div>
          {typeof maximumHandSizeOverride === 'number' && (
            <label className="life-sheet__number-label">
              上限枚数
              <input
                type="number"
                min={0}
                step={1}
                value={maximumHandSizeOverride}
                data-testid="maximum-hand-size-value"
                onChange={(event) => {
                  const value = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(value)) {
                    store.dispatch({ type: 'setMaximumHandSizeOverride', value });
                  }
                }}
              />
            </label>
          )}
          <small className="life-sheet__help">
            未対応カードの補正用です。自動判定より優先され、操作は取り消せます。
          </small>
        </div>

        {/* マナプール */}
        <div className="life-sheet__section" data-testid="mana-pool">
          <div className="life-sheet__section-head">
            <span className="life-sheet__label">マナプール ({manaTotal})</span>
            <button
              type="button"
              className="life-sheet__mini"
              data-testid="mana-clear"
              onClick={() => store.dispatch({ type: 'clearManaPool' })}
            >
              空にする
            </button>
          </div>
          <div className="life-sheet__mana-grid">
            {MANA_ORDER.map((color) => (
              <div className="life-sheet__mana" key={color} data-mana={color}>
                <button type="button" className="life-sheet__step" onClick={() => store.adjustMana(color, -1)}>
                  −
                </button>
                <span className="life-sheet__mana-val" data-testid={`mana-${color}`}>
                  {MANA_LABELS[color]} {state.manaPool[color] ?? 0}
                </span>
                <button type="button" className="life-sheet__step" data-testid={`mana-add-${color}`} onClick={() => store.adjustMana(color, 1)}>
                  ＋
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 自分のカウンター(毒/エネルギー/経験) */}
        {PLAYER_COUNTERS.map(({ kind, label }) => (
          <div className="life-sheet__row" key={kind}>
            <span className="life-sheet__label">{label}</span>
            <span className="life-sheet__value">{state[kind] ?? 0}</span>
            <div className="life-sheet__steps">
              <button type="button" className="life-sheet__step" onClick={() => store.dispatch({ type: 'adjustPlayerCounter', kind, delta: -1 })}>
                −1
              </button>
              <button type="button" className="life-sheet__step" data-testid={`counter-${kind}-plus`} onClick={() => store.dispatch({ type: 'adjustPlayerCounter', kind, delta: 1 })}>
                +1
              </button>
            </div>
          </div>
        ))}

        {/* 相手ライフ + 統率者ダメージ */}
        {opponentLabels.map((label) => (
          <div className="life-sheet__row" key={label}>
            <span className="life-sheet__label">
              {label}
              <span className="life-sheet__sub"> 統率者ダメージ {state.commanderDamage[label] ?? 0}</span>
            </span>
            <span className="life-sheet__value">{state.opponentLife[label] ?? 40}</span>
            <div className="life-sheet__steps">
              <button type="button" className="life-sheet__step" onClick={() => store.adjustOpponentLife(label, -1)}>
                −1
              </button>
              <button type="button" className="life-sheet__step" onClick={() => store.adjustOpponentLife(label, 1)}>
                +1
              </button>
              <button
                type="button"
                className="life-sheet__step"
                title="統率者ダメージ +1"
                data-testid={`cmd-dmg-${label}`}
                onClick={() => store.dispatch({ type: 'adjustCommanderDamage', label, delta: 1 })}
              >
                ⚔+1
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
