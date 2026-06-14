import { useEffect, useRef, useState } from 'react';
import { PHASE_ORDER, type GameState } from '../../engine/types';
import type { useGameStore } from '../../store/gameStore';

type Store = ReturnType<typeof useGameStore.getState>;
type PlayerCounterKind = 'poison' | 'energy' | 'experience';

const PHASE_META: Record<(typeof PHASE_ORDER)[number], { short: string; label: string }> = {
  untap: { short: '解', label: 'アンタップ' },
  upkeep: { short: '維', label: 'アップキープ' },
  draw: { short: '引', label: 'ドロー' },
  main1: { short: '1', label: 'メイン1' },
  combat: { short: '戦', label: '戦闘' },
  main2: { short: '2', label: 'メイン2' },
  end: { short: '終', label: '終了' },
};

const MANA_ORDER: (keyof GameState['manaPool'])[] = ['W', 'U', 'B', 'R', 'G', 'C'];
const MANA_LABELS: Record<(typeof MANA_ORDER)[number], string> = {
  W: '白',
  U: '青',
  B: '黒',
  R: '赤',
  G: '緑',
  C: '無',
};

function opponentLabelsFromState(state: GameState): string[] {
  return Array.from(
    new Set(['対戦相手A', ...Object.keys(state.opponentLife), ...Object.keys(state.commanderDamage)])
  );
}

function useDismissibleLayer<T extends HTMLElement>(
  open: boolean,
  onClose: () => void
): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return ref;
}

function Icon({
  icon,
  label,
}: {
  icon: string;
  label: string;
}) {
  return (
    <>
      <span className={`ti ${icon}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </>
  );
}

function CounterRow({
  label,
  value,
  onChange,
  testId,
  danger,
  containerTestId,
}: {
  label: string;
  value: number;
  onChange: (delta: number) => void;
  testId: string;
  danger?: boolean;
  containerTestId?: string;
}) {
  return (
    <div className="stat-row stat-row--compact" data-testid={containerTestId}>
      <span className="stat-row__label">{label}</span>
      <button
        type="button"
        className="stat-row__btn stat-row__btn--sm"
        onClick={() => onChange(-1)}
        aria-label={`${label}を減らす`}
      >
        −
      </button>
      <span
        className={`stat-row__value stat-row__value--sm ${danger ? 'stat-row__value--danger' : ''}`}
        data-testid={`${testId}-value`}
      >
        {value}
      </span>
      <button
        type="button"
        className="stat-row__btn stat-row__btn--sm"
        onClick={() => onChange(1)}
        aria-label={`${label}を増やす`}
      >
        +
      </button>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  testId,
  onClick,
  disabled,
  active,
}: {
  icon: string;
  label: string;
  testId?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`control-rail__button ${active ? 'control-rail__button--active' : ''}`}
      aria-label={label}
      title={label}
      data-testid={testId}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon icon={icon} label={label} />
    </button>
  );
}

function MenuButton({
  icon,
  label,
  testId,
  onClick,
}: {
  icon: string;
  label: string;
  testId?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="control-menu__button"
      data-testid={testId}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <span className={`ti ${icon}`} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function PhaseOverlay({ state }: { state: GameState }) {
  const currentPhaseIndex = PHASE_ORDER.indexOf(state.phase);

  return (
    <div className="playmat-overlay playmat-overlay--phase">
      <div className="phase-overlay__turn playmat-overlay__interactive">
        <span className="phase-overlay__turn-label">ターン</span>
        <span className="phase-overlay__turn-value" data-testid="turn-indicator">
          {state.turn}
        </span>
      </div>
      <div className="phase-track" data-testid="phase-indicator" data-phase={state.phase}>
        {PHASE_ORDER.map((phase, index) => {
          const meta = PHASE_META[phase];
          return (
            <span
              key={phase}
              className={`phase-track__step ${index === currentPhaseIndex ? 'phase-track__step--active' : ''} ${
                index < currentPhaseIndex ? 'phase-track__step--done' : ''
              }`}
              title={meta.label}
            >
              <span className="phase-track__dot" aria-hidden="true" />
              <span className="phase-track__abbr">{meta.short}</span>
              <span className="sr-only">{meta.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ManaOverlay({
  state,
  store,
}: {
  state: GameState;
  store: Store;
}) {
  const hasMana = Object.values(state.manaPool).some((value) => value > 0);

  return (
    <div className="playmat-overlay playmat-overlay--mana">
      <div className="mana-overlay__panel playmat-overlay__interactive">
        <div className="mana-pool" data-testid="mana-pool">
          {MANA_ORDER.map((color) => (
            <div
              key={color}
              className={`mana-pool__pip mana-pool__pip--${color.toLowerCase()}`}
              data-testid={`mana-pool-${color}`}
            >
              <span className="mana-pool__symbol">{MANA_LABELS[color]}</span>
              <span className="mana-pool__count">{state.manaPool[color]}</span>
              <div className="mana-pool__controls">
                <button
                  type="button"
                  className="mana-pool__button"
                  data-testid={`mana-minus-${color}`}
                  aria-label={`${MANA_LABELS[color]}マナを減らす`}
                  onClick={() => store.adjustMana(color, -1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="mana-pool__button"
                  data-testid={`mana-plus-${color}`}
                  aria-label={`${MANA_LABELS[color]}マナを増やす`}
                  onClick={() => store.adjustMana(color, 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="overlay-chip__action"
          onClick={() => store.dispatch({ type: 'clearManaPool' })}
          disabled={!hasMana}
        >
          空にする
        </button>
      </div>
    </div>
  );
}

export function LifeOverlay({
  state,
  store,
}: {
  state: GameState;
  store: Store;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const ref = useDismissibleLayer<HTMLDivElement>(detailsOpen, () => setDetailsOpen(false));
  const opponentLabels = opponentLabelsFromState(state);

  function adjustLife(delta: number): void {
    store.dispatch({ type: 'adjustLife', delta });
  }

  function adjustCounter(kind: PlayerCounterKind, delta: number): void {
    store.dispatch({ type: 'adjustPlayerCounter', kind, delta });
  }

  function adjustCommanderDamage(label: string, delta: number): void {
    store.dispatch({ type: 'adjustCommanderDamage', label, delta });
  }

  function adjustOpponentLife(label: string, delta: number): void {
    store.adjustOpponentLife(label, delta);
  }

  function addOpponent(): void {
    const label = newLabel.trim();
    if (label === '' || opponentLabels.includes(label)) {
      return;
    }
    store.addOpponent(label);
    setNewLabel('');
  }

  return (
    <div className="playmat-overlay playmat-overlay--life">
      <div className="life-overlay playmat-overlay__interactive" ref={ref}>
        <div className="life-overlay__bar">
          <button
            type="button"
            className="life-overlay__adjust"
            aria-label="ライフを減らす"
            onClick={() => adjustLife(-1)}
          >
            −
          </button>
          <button
            type="button"
            className="life-overlay__summary"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <span className="life-overlay__label">ライフ</span>
            <span className="life-overlay__value" data-testid="life-value">
              {state.life}
            </span>
            <span className="life-overlay__chevron" aria-hidden="true">
              {detailsOpen ? '▴' : '▾'}
            </span>
          </button>
          <button
            type="button"
            className="life-overlay__adjust"
            aria-label="ライフを増やす"
            onClick={() => adjustLife(1)}
          >
            +
          </button>
        </div>

        {detailsOpen && (
          <div className="life-overlay__panel">
            <div className="life-overlay__section">
              <h3>プレイヤー</h3>
              <div className="counter-list counter-list--grid">
                <CounterRow
                  label="毒"
                  value={state.poison}
                  onChange={(delta) => adjustCounter('poison', delta)}
                  testId="poison"
                />
                <CounterRow
                  label="エネルギー"
                  value={state.energy}
                  onChange={(delta) => adjustCounter('energy', delta)}
                  testId="energy"
                />
                <CounterRow
                  label="経験"
                  value={state.experience}
                  onChange={(delta) => adjustCounter('experience', delta)}
                  testId="experience"
                />
              </div>
            </div>

            <div className="life-overlay__section">
              <h3>対戦相手ライフ</h3>
              <div className="counter-list">
                {opponentLabels.map((label) => (
                  <CounterRow
                    key={`opponent-life-${label}`}
                    label={label}
                    value={state.opponentLife[label] ?? 40}
                    onChange={(delta) => adjustOpponentLife(label, delta)}
                    testId={`opponent-life-${label}`}
                    containerTestId={`opponent-life-${label}`}
                    danger={(state.opponentLife[label] ?? 40) <= 0}
                  />
                ))}
              </div>
            </div>

            <div className="life-overlay__section">
              <h3>統率者ダメージ</h3>
              <div className="counter-list">
                {opponentLabels.map((label) => (
                  <CounterRow
                    key={`commander-damage-${label}`}
                    label={label}
                    value={state.commanderDamage[label] ?? 0}
                    onChange={(delta) => adjustCommanderDamage(label, delta)}
                    testId={`commander-damage-${label}`}
                    danger={(state.commanderDamage[label] ?? 0) >= 21}
                  />
                ))}
              </div>
              <div className="life-overlay__add-opponent">
                <input
                  type="text"
                  value={newLabel}
                  placeholder="対戦相手名を追加"
                  data-testid="commander-damage-new-label"
                  onChange={(event) => setNewLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      addOpponent();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  data-testid="commander-damage-add"
                  onClick={addOpponent}
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface ControlRailProps {
  store: Store;
  onCreateToken: () => void;
  onAttack: () => void;
  onDiscardRandom: () => void;
}

export function ControlRail({
  store,
  onCreateToken,
  onAttack,
  onDiscardRandom,
}: ControlRailProps) {
  const [openMenu, setOpenMenu] = useState<'actions' | null>(null);
  const ref = useDismissibleLayer<HTMLDivElement>(openMenu !== null, () => setOpenMenu(null));

  return (
    <div className="control-rail" ref={ref} onClick={(event) => event.stopPropagation()}>
      <div className="control-rail__primary">
        <ControlButton
          icon="ti-player-play-filled"
          label="次のフェイズ"
          testId="next-phase"
          onClick={() => store.nextPhase()}
        />
        <ControlButton
          icon="ti-player-track-next-filled"
          label="次のターン"
          testId="next-turn"
          onClick={() => store.nextTurn()}
        />
        <ControlButton
          icon="ti-arrow-back-up"
          label="元に戻す"
          testId="undo"
          disabled={!store.canUndo}
          onClick={() => store.undo()}
        />
        <ControlButton
          icon="ti-arrow-forward-up"
          label="やり直す"
          testId="redo"
          disabled={!store.canRedo}
          onClick={() => store.redo()}
        />
      </div>

      <div className="control-rail__toggles">
        <ControlButton
          icon="ti-dots"
          label="その他の操作"
          active={openMenu === 'actions'}
          onClick={() => setOpenMenu((menu) => (menu === 'actions' ? null : 'actions'))}
        />
      </div>

      {openMenu === 'actions' && (
        <div className="control-menu control-menu--actions">
          <MenuButton
            icon="ti-swords"
            label="攻撃"
            testId="attack-button"
            onClick={() => {
              setOpenMenu(null);
              onAttack();
            }}
          />
          <MenuButton
            icon="ti-cards"
            label="トークン生成"
            testId="create-token"
            onClick={() => {
              setOpenMenu(null);
              onCreateToken();
            }}
          />
          <MenuButton
            icon="ti-tilt-shift"
            label="全アンタップ"
            testId="untap-all"
            onClick={() => {
              setOpenMenu(null);
              store.untapAllPermanents();
            }}
          />
          <MenuButton
            icon="ti-dice-5"
            label="ランダムに捨てる"
            testId="discard-random"
            onClick={() => {
              setOpenMenu(null);
              onDiscardRandom();
            }}
          />
        </div>
      )}
    </div>
  );
}

export function MatchControls({
  store,
  onRestart,
  onBackToImport,
}: {
  store: Store;
  onRestart: () => void;
  onBackToImport: () => void;
}) {
  return (
    <div className="match-controls" data-testid="match-controls">
      <button
        type="button"
        className="match-controls__button"
        data-testid="restart-game"
        onClick={onRestart}
      >
        最初からやり直す
      </button>
      <button
        type="button"
        className="match-controls__button"
        data-testid="back-to-import"
        onClick={onBackToImport}
      >
        デッキ選択に戻る
      </button>
      <label className="match-controls__toggle">
        <span>自動進行(メイン1まで)</span>
        <input
          type="checkbox"
          data-testid="auto-advance-toggle"
          checked={store.autoAdvanceToMain}
          onChange={(event) => store.setAutoAdvance(event.target.checked)}
        />
      </label>
    </div>
  );
}
