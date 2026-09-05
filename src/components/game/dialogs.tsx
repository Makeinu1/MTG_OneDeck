import { useState, type ReactNode } from 'react';
import { Modal } from '../Modal';
import type { ManaColor } from '../../types/card';
import type { CardDef } from '../../types/card';
import type { CardInstance, GameState, PlayerId, ZoneId } from '../../engine/types';
import type { EffectPrompt, LibrarySearchFilter } from '../../engine/grammar/compile';
import { isCommander } from '../../engine/commander';
import { parseManaCost } from '../../engine/mana';
import { effectivePower, fetchEntersTapped, isSummoningSick, type FetchAbility } from '../../engine/status';
import { CardView } from '../CardView';
import { tokenVisualForKind } from '../../ui/tokenVisual';
import { useInteractionHistory } from '../../hooks/useInteractionHistory';

const MANA_LABELS: Record<ManaColor, string> = {
  W: '白',
  U: '青',
  B: '黒',
  R: '赤',
  G: '緑',
  C: '無色',
};

export function CastFaceDialog({
  def,
  initialFaceIndex,
  onChoose,
  onCancel,
}: {
  def: CardDef;
  initialFaceIndex: number;
  onChoose: (faceIndex: number) => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="唱える面を選択" onClose={onCancel} width="md" testId="cast-face-dialog">
      <div className="cast-face-choice">
        {def.faces.map((face, faceIndex) => (
          <button
            key={`${face.name}-${faceIndex}`}
            type="button"
            className="cast-face-choice__option"
            data-testid={`cast-face-${faceIndex}`}
            data-autofocus={faceIndex === initialFaceIndex ? 'true' : undefined}
            onClick={() => onChoose(faceIndex)}
          >
            {face.imageUrl ? (
              <img src={face.imageUrl} alt="" aria-hidden="true" />
            ) : (
              <span className="cast-face-choice__fallback" aria-hidden="true">◇</span>
            )}
            <strong>《{face.printedName ?? face.name}》</strong>
            <small>{face.manaCost || 'マナ・コストなし'} · {face.printedTypeLine ?? face.typeLine}</small>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Popup asking which color to add when a multi-color mana source is tapped. */
export function ManaChoiceDialog({
  options,
  onChoose,
  onCancel,
}: {
  options: ManaColor[];
  onChoose: (color: ManaColor) => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="マナの色を選択" onClose={onCancel} width="sm" testId="mana-choice-dialog">
      <div className="mana-choice">
        {options.map((color) => (
          <button
            key={color}
            type="button"
            className={`mana-choice__swatch mana-choice__swatch--${color.toLowerCase()}`}
            onClick={() => onChoose(color)}
            data-testid={`mana-choice-${color}`}
          >
            {MANA_LABELS[color]}
            <span className="mana-choice__symbol">{color}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Confirmation dialog when a cast would leave mana unpaid. */
export function ShortfallDialog({
  shortfall,
  onForce,
  onCancel,
}: {
  shortfall: number;
  onForce: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="マナが不足しています" onClose={onCancel} width="sm" testId="shortfall-dialog">
      <p>
        マナが <strong>{shortfall}</strong> 点不足しています。強行してキャストしますか?
      </p>
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} data-testid="shortfall-cancel">
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={onForce}
          data-testid="shortfall-force"
        >
          強行する
        </button>
      </div>
    </Modal>
  );
}

/**
 * ACT-2: 支払えない起動コストの強行確認(サンドボックス哲学=強行そのものは禁止しない)。
 * `ShortfallDialog` の idiom をそのまま踏襲する。
 */
export function ForceActivationDialog({
  warnings,
  onForce,
  onCancel,
}: {
  warnings: string[];
  onForce: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="起動コストが支払えません" onClose={onCancel} width="sm" testId="force-activation-dialog">
      <ul>
        {warnings.map((warning, index) => (
          <li key={index}>{warning}</li>
        ))}
      </ul>
      <p>強行すると、この起動はCR-legalとして扱われません。それでも起動しますか?</p>
      <div className="dialog__actions">
        <button
          type="button"
          className="btn"
          onClick={onCancel}
          data-testid="force-activation-cancel"
        >
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={onForce}
          data-testid="force-activation-force"
        >
          強行する
        </button>
      </div>
    </Modal>
  );
}

export function XCostDialog({
  cardName,
  manaCost,
  minValue = 0,
  onConfirm,
  onCancel,
}: {
  cardName: string;
  manaCost: string;
  minValue?: number;
  onConfirm: (xValue: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(minValue));
  const xSymbols = parseManaCost(manaCost).x;

  return (
    <Modal title="Xの値を選択" onClose={onCancel} width="sm" testId="x-cost-dialog">
      <p>
        《{cardName}》のXを入力してください。
        {xSymbols > 1 ? ` ({X} が ${xSymbols} 個あります)` : ''}
      </p>
      <label className="dialog__field">
        X
        <input
          type="number"
          min={minValue}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-testid="x-cost-input"
          autoFocus
        />
      </label>
      <div className="dialog__actions">
        <button
          type="button"
          className="btn"
          onClick={onCancel}
          data-testid="x-cost-cancel"
        >
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => onConfirm(Number(value))}
          data-testid="x-cost-confirm"
          disabled={!Number.isInteger(Number(value)) || Number(value) < minValue}
        >
          決定
        </button>
      </div>
    </Modal>
  );
}

export function CounterCostDialog({
  counterType,
  min,
  max,
  onConfirm,
  onCancel,
}: {
  counterType: string;
  min: number;
  max: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(min));

  return (
    <Modal
      title="取り除くカウンター数"
      onClose={onCancel}
      width="sm"
      testId="counter-cost-dialog"
    >
      <p>{counterType}カウンターを何個取り除きますか。</p>
      <label className="dialog__field">
        個数
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          data-testid="counter-cost-amount"
          autoFocus
        />
      </label>
      <div className="dialog__actions">
        <button
          type="button"
          className="btn"
          onClick={onCancel}
          data-testid="counter-cost-cancel"
        >
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => onConfirm(Number(value))}
          data-testid="counter-cost-confirm"
          disabled={
            !Number.isInteger(Number(value))
            || Number(value) < min
            || Number(value) > max
          }
        >
          決定
        </button>
      </div>
    </Modal>
  );
}

export function CountDialog({
  title,
  label,
  description,
  defaultValue = 1,
  confirmLabel = '決定',
  inputTestId,
  confirmTestId,
  onConfirm,
  onCancel,
}: {
  title: string;
  label: string;
  description?: string;
  defaultValue?: number;
  confirmLabel?: string;
  inputTestId: string;
  confirmTestId: string;
  onConfirm: (count: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(Math.max(1, Math.floor(defaultValue))));

  function parsedCount(): number {
    return Math.max(1, Number.parseInt(value, 10) || 1);
  }

  return (
    <Modal title={title} onClose={onCancel} width="sm" testId={`${confirmTestId}-dialog`}>
      {description && <p>{description}</p>}
      <label className="dialog__field">
        {label}
        <input
          type="number"
          min={1}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-testid={inputTestId}
          autoFocus
        />
      </label>
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => onConfirm(parsedCount())}
          data-testid={confirmTestId}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function LandTapChoiceDialog({
  cardName,
  onChoose,
  onCancel,
}: {
  cardName: string;
  onChoose: (entersTapped: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="土地の出し方を選択" onClose={onCancel} width="sm" testId="land-tap-choice-dialog">
      <p>《{cardName}》をタップインしますか?</p>
      <div className="dialog__actions">
        <button
          type="button"
          className="btn"
          onClick={() => onChoose(false)}
          data-testid="land-tap-choice-untapped"
        >
          アンタップイン
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => onChoose(true)}
          data-testid="land-tap-choice-tapped"
        >
          タップイン
        </button>
      </div>
    </Modal>
  );
}

export function AttackDialog({
  state,
  opponentLabels,
  initialAttackerIds = [],
  onConfirm,
  onCancel,
}: {
  state: GameState;
  opponentLabels: string[];
  initialAttackerIds?: string[];
  onConfirm: (
    attackerIds: string[],
    targetLabel: string,
    blockers?: Array<{ cardId: string; attackerId: string }>,
  ) => void;
  onCancel: () => void;
}) {
  const creatureIds = state.zones.battlefield.filter((cardId) => {
    const card = state.cards[cardId];
    const def = card ? state.defs[card.defId] : undefined;
    const face = card ? def?.faces[card.faceIndex] ?? def?.faces[0] : undefined;
    const typeLine = face?.typeLine ?? def?.typeLine ?? '';
    return typeLine.includes('Creature') && card?.controllerId === state.localPlayerId;
  });
  const blockerIds = state.zones.battlefield.filter((cardId) => {
    const card = state.cards[cardId];
    const def = card ? state.defs[card.defId] : undefined;
    const face = card ? def?.faces[card.faceIndex] ?? def?.faces[0] : undefined;
    const typeLine = face?.typeLine ?? def?.typeLine ?? '';
    return typeLine.includes('Creature') && card?.controllerId !== state.localPlayerId;
  });
  const [attackChoice, setAttackChoice] = useInteractionHistory<{
    selected: string[];
    targetLabel: string;
    blockAssignments: Record<string, string>;
  }>({
    selected: initialAttackerIds,
    targetLabel: opponentLabels[0] ?? '対戦相手A',
    blockAssignments: {},
  }, onCancel);
  const { selected, targetLabel, blockAssignments } = attackChoice;
  const defendingPlayerId = state.turnOrder.find(
    (playerId) => state.players[playerId]?.label === targetLabel,
  );
  const availableBlockerIds = blockerIds.filter(
    (cardId) => state.cards[cardId]?.controllerId === defendingPlayerId,
  );

  function toggle(cardId: string): void {
    setAttackChoice((current) => ({
      ...current,
      selected: current.selected.includes(cardId)
        ? current.selected.filter((id) => id !== cardId)
        : [...current.selected, cardId],
    }));
  }

  const totalPower = selected.reduce((sum, cardId) => sum + effectivePower(state, cardId), 0);
  const selectedWarnings = selected.filter((cardId) => isSummoningSick(state, cardId));

  return (
    <Modal title="攻撃" onClose={onCancel} width="lg" testId="attack-dialog">
      {creatureIds.length === 0 ? (
        <p className="zone-viewer__empty">
          攻撃できるクリーチャーがいません。攻撃せず戦闘を進められます。
        </p>
      ) : (
        <>
          <div className="attack-dialog__list">
            {creatureIds.map((cardId) => {
              const card = state.cards[cardId];
              const def = state.defs[card.defId];
              const face = def?.faces[card.faceIndex] ?? def?.faces[0];
              const name =
                face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
              const selectedNow = selected.includes(cardId);
              return (
                <label
                  key={cardId}
                  className={`attack-dialog__item ${selectedNow ? 'attack-dialog__item--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedNow}
                    onChange={() => toggle(cardId)}
                    data-testid={`attack-select-${cardId}`}
                  />
                  <div className="attack-dialog__card">
                    <CardView instance={card} def={def} size="small" />
                    <div className="attack-dialog__meta">
                      <strong>{name}</strong>
                      <span>有効パワー {effectivePower(state, cardId)}</span>
                      {isSummoningSick(state, cardId) && (
                        <span className="attack-dialog__warning">召喚酔いのため警告付き</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="attack-dialog__summary">
            <strong>合計ダメージ: {totalPower}</strong>
            {selectedWarnings.length > 0 && (
              <span className="attack-dialog__warning">
                召喚酔いのクリーチャーが{selectedWarnings.length}体含まれます。
              </span>
            )}
          </div>
          <label className="dialog__field">
            攻撃先
            <select
              value={targetLabel}
              onChange={(e) => setAttackChoice((current) => ({
                ...current,
                targetLabel: e.target.value,
                blockAssignments: {},
              }))}
              data-testid="attack-target-select"
            >
              {opponentLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {availableBlockerIds.length > 0 && selected.length > 0 && (
            <fieldset className="attack-dialog__blockers" data-testid="blocker-assignment">
              <legend>ブロッカーを割り当てる（任意）</legend>
              {availableBlockerIds.map((blockerId) => {
                const card = state.cards[blockerId];
                const def = card ? state.defs[card.defId] : undefined;
                const face = card ? def?.faces[card.faceIndex] ?? def?.faces[0] : undefined;
                const name = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? blockerId;
                return (
                  <label key={blockerId}>
                    《{name}》
                    <select
                      value={blockAssignments[blockerId] ?? ''}
                      onChange={(event) => {
                        const attackerId = event.currentTarget.value;
                        setAttackChoice((current) => ({
                          ...current,
                          blockAssignments: {
                            ...current.blockAssignments,
                            [blockerId]: attackerId,
                          },
                        }));
                      }}
                      data-testid={'blocker-select-' + blockerId}
                    >
                      <option value="">ブロックしない</option>
                      {selected.map((attackerId) => (
                        <option key={attackerId} value={attackerId}>
                          {state.defs[state.cards[attackerId]?.defId]?.name ?? attackerId}をブロック
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </fieldset>
          )}
        </>
      )}
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => {
            const blockers = Object.entries(blockAssignments).flatMap(([cardId, attackerId]) =>
              attackerId && selected.includes(attackerId) && availableBlockerIds.includes(cardId)
                ? [{ cardId, attackerId }]
                : []);
            if (blockers.length > 0) onConfirm(selected, targetLabel, blockers);
            else onConfirm(selected, targetLabel);
          }}
          data-testid="attack-confirm"
        >
          {selected.length === 0 ? '攻撃せず進む' : `${selected.length}体で攻撃`}
        </button>
      </div>
    </Modal>
  );
}

export function ModalChoiceDialog({
  prompt,
  onConfirm,
  onCancel,
  onUndoBoundary,
}: {
  prompt: EffectPrompt;
  onConfirm: (chosen: number[]) => void;
  onCancel: () => void;
  onUndoBoundary?: () => void;
}) {
  const options = prompt.options ?? [];
  const min = prompt.minCount ?? prompt.count;
  const max = prompt.count;
  const [selected, setSelected] = useInteractionHistory<number[]>([], onUndoBoundary);

  function toggle(index: number): void {
    setSelected((prev) => {
      if (prev.includes(index)) {
        return prev.filter((value) => value !== index);
      }
      if (prev.length >= max) {
        return prev;
      }
      return [...prev, index].sort((a, b) => a - b);
    });
  }

  const canConfirm = selected.length >= min && selected.length <= max;

  return (
    <Modal title="モード選択" onClose={onCancel} width="lg" testId="modal-choice-dialog">
      {options.length === 0 ? (
        <p className="zone-viewer__empty">選択できるモードがありません。</p>
      ) : (
        <>
          <div className="attack-dialog__list">
            {options.map((option) => {
              const checked = selected.includes(option.index);
              const disabled = !checked && selected.length >= max;
              return (
                <label
                  key={option.index}
                  className={`attack-dialog__item ${checked ? 'attack-dialog__item--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(option.index)}
                    data-testid={`modal-choice-${option.index}`}
                  />
                  <div className="attack-dialog__meta">
                    <strong>{option.raw}</strong>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="attack-dialog__summary">
            <strong>
              選択 {selected.length} / {max}
            </strong>
          </div>
        </>
      )}
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => onConfirm(selected)}
          disabled={!canConfirm}
          data-testid="modal-choice-confirm"
        >
          確定
        </button>
      </div>
    </Modal>
  );
}

export function MulliganDecisionDialog({
  state,
  onKeep,
  onMulligan,
}: {
  state: GameState;
  onKeep: () => void;
  onMulligan: () => void;
}) {
  const mulliganCount = state.mulliganCount;

  return (
    <div className="mulligan-decision-panel">
      <section
        className="mulligan-decision-panel__dialog"
        role="dialog"
        aria-modal="false"
        aria-label="マリガン"
        data-testid="mulligan-decision-dialog"
      >
        <div className="mulligan-decision-panel__header">
          <h2>マリガン</h2>
          <span className="mulligan-decision-panel__count">手札 {state.zones.hand.length} 枚</span>
        </div>
        <p className="mulligan-decision-panel__message">
          {mulliganCount <= 1
            ? '初手です。盤面の手札を確認しながら、キープか7枚引き直しを選んでください。(1回目のマリガンは無料です)'
            : `${mulliganCount}回マリガンしています。キープすると ${mulliganCount - 1} 枚をライブラリーの下に戻します。`}
        </p>
        <div className="dialog__actions mulligan-decision-panel__actions">
          <button type="button" className="btn mulligan-decision-panel__keep" onClick={onKeep} data-testid="mulligan-keep">
            キープ
          </button>
          <button
            type="button"
            className="btn mulligan-decision-panel__again"
            onClick={onMulligan}
            data-testid="mulligan-again"
          >
            マリガン({mulliganCount + 1}回目)
          </button>
        </div>
      </section>
    </div>
  );
}

/** Generic yes/no confirmation dialog (e.g. restart, return to deck selection). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  testId,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}) {
  return (
    <Modal title={title} onClose={onCancel} width="sm" testId={testId}>
      <p>{message}</p>
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} data-testid={`${testId}-cancel`}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={onConfirm}
          data-testid={`${testId}-confirm`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Dialog for choosing where a moving commander should go (incl. command zone). */
export function CommanderMoveDialog({
  cardName,
  destinationLabel,
  mode,
  onChoose,
  onCancel,
}: {
  cardName: string;
  destinationLabel: string;
  mode: 'replacement' | 'sba';
  onChoose: (toCommandZone: boolean) => void;
  onCancel: () => void;
}) {
  const description =
    mode === 'sba'
      ? `《${cardName}》は統率者です。CR 903.9a により、まず${destinationLabel}に置かれ、死亡/離場の確認後、優先権前に統率領域へ移せます。`
      : `《${cardName}》は統率者です。CR 903.9b により、${destinationLabel}へ行く代わりに統率領域へ置けます。`;
  const keepLabel = mode === 'sba' ? `${destinationLabel}に置く` : `${destinationLabel}へ送る`;
  const commandLabel =
    mode === 'sba' ? `${destinationLabel}に置いてから統率領域へ` : '統率領域へ置く';

  return (
    <Modal title="統率者の移動先" onClose={onCancel} width="sm" testId="commander-move-dialog">
      <p>{description}</p>
      <div className="dialog__actions">
        <button
          type="button"
          className="btn"
          onClick={() => onChoose(false)}
          data-testid="commander-move-keep"
        >
          {keepLabel}
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => onChoose(true)}
          data-testid="commander-move-command"
        >
          {commandLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Token creation dialog: name, type line, P/T, quantity. */
export function TokenCreateDialog({
  onCreate,
  onCancel,
}: {
  onCreate: (
    name: string,
    typeLine: string,
    power: string,
    toughness: string,
    qty: number,
    opts?: {
      producedMana?: ManaColor[];
      tokenKind?: 'treasure' | 'clue' | 'food' | 'blood';
    }
  ) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [typeLine, setTypeLine] = useState('Creature — Token');
  const [power, setPower] = useState('');
  const [toughness, setToughness] = useState('');
  const [qty, setQty] = useState(1);
  const [producedMana, setProducedMana] = useState<ManaColor[] | undefined>();
  const [tokenKind, setTokenKind] = useState<'treasure' | 'clue' | 'food' | 'blood' | undefined>();

  const presets: Array<{
    key: 'treasure' | 'clue' | 'food' | 'blood';
    label: string;
    name: string;
    typeLine: string;
    tokenKind: 'treasure' | 'clue' | 'food' | 'blood';
    producedMana?: ManaColor[];
  }> = [
    {
      key: 'treasure',
      label: '宝物',
      name: '宝物',
      typeLine: 'Token Artifact — Treasure',
      tokenKind: 'treasure',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
    },
    {
      key: 'clue',
      label: '手掛かり',
      name: '手掛かり',
      typeLine: 'Token Artifact — Clue',
      tokenKind: 'clue',
    },
    {
      key: 'food',
      label: '食物',
      name: '食物',
      typeLine: 'Token Artifact — Food',
      tokenKind: 'food',
    },
    {
      key: 'blood',
      label: '血',
      name: '血',
      typeLine: 'Token Artifact — Blood',
      tokenKind: 'blood',
    },
  ];

  const canCreate = name.trim() !== '' && typeLine.trim() !== '' && qty >= 1;
  const tokenVisual = tokenVisualForKind(tokenKind);

  function applyPreset(preset: (typeof presets)[number]): void {
    setName(preset.name);
    setTypeLine(preset.typeLine);
    setPower('');
    setToughness('');
    setProducedMana(preset.producedMana);
    setTokenKind(preset.tokenKind);
  }

  return (
    <Modal title="トークンを生成" onClose={onCancel} width="sm" testId="token-create-dialog">
      <div className="token-art-preview" data-testid="token-art-preview" data-token-art={tokenVisual.key}>
        <img src={tokenVisual.imageUrl} alt={tokenVisual.label} />
        <div>
          <strong>{name.trim() || 'カスタムトークン'}</strong>
          <span>{typeLine.trim() || 'タイプ未入力'}</span>
          {(power.trim() || toughness.trim()) && <b>{power.trim() || '—'}/{toughness.trim() || '—'}</b>}
        </div>
      </div>
      <div className="token-presets">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`token-presets__button ${tokenKind === preset.tokenKind ? 'token-presets__button--active' : ''}`}
            onClick={() => applyPreset(preset)}
            data-testid={`token-preset-${preset.key}`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <label>
          名前
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="token-name"
            placeholder="例: 兵士"
            autoFocus
          />
        </label>
        <label>
          タイプ
          <input
            type="text"
            value={typeLine}
            onChange={(e) => setTypeLine(e.target.value)}
            data-testid="token-type"
            placeholder="例: Creature — Soldier"
          />
        </label>
        <div className="form-grid__row">
          <label>
            パワー
            <input
              type="text"
              value={power}
              onChange={(e) => setPower(e.target.value)}
              data-testid="token-power"
              placeholder="1"
            />
          </label>
          <label>
            タフネス
            <input
              type="text"
              value={toughness}
              onChange={(e) => setToughness(e.target.value)}
              data-testid="token-toughness"
              placeholder="1"
            />
          </label>
          <label>
            個数
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
              data-testid="token-qty"
            />
          </label>
        </div>
      </div>
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--accent"
          disabled={!canCreate}
          onClick={() =>
            onCreate(name.trim(), typeLine.trim(), power.trim(), toughness.trim(), qty, {
              producedMana,
              tokenKind,
            })
          }
          data-testid="token-create-confirm"
        >
          生成
        </button>
      </div>
    </Modal>
  );
}

type ArrangeBucket = 'top' | 'bottom' | 'graveyard';
type ArrangeMode = 'scry' | 'surveil';

function cardDisplayName(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '不明';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
}

function moveWithin(ids: string[], cardId: string, delta: -1 | 1): string[] {
  const index = ids.indexOf(cardId);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) {
    return ids;
  }

  const next = ids.slice();
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function ArrangeTopDialog({
  state,
  playerId,
  initialCount,
  initialMode = 'scry',
  lockCount = false,
  lockMode = false,
  onConfirm,
  onCancel,
  onUndoBoundary = onCancel,
}: {
  state: GameState;
  playerId?: PlayerId;
  initialCount?: number;
  initialMode?: ArrangeMode;
  lockCount?: boolean;
  lockMode?: boolean;
  onConfirm: (topOrder: string[], toBottom: string[], toGraveyard: string[]) => void;
  onCancel: () => void;
  onUndoBoundary?: () => void;
}) {
  const library = state.zonesByPlayer[playerId ?? state.localPlayerId].library;
  const libraryCount = library.length;
  const initialVisibleCount = Math.min(Math.max(0, initialCount ?? 1), libraryCount);
  const [arrangement, setArrangement] = useInteractionHistory({
    count: initialVisibleCount,
    mode: initialMode,
    topOrder: library.slice(0, initialVisibleCount),
    toBottom: [] as string[],
    toGraveyard: [] as string[],
  }, onUndoBoundary);
  const { count, mode, topOrder, toBottom, toGraveyard } = arrangement;

  function resetForCount(nextCount: number): void {
    const clamped = Math.max(0, Math.min(libraryCount, nextCount));
    const nextIds = library.slice(0, clamped);
    setArrangement((current) => ({
      ...current,
      count: clamped,
      topOrder: nextIds,
      toBottom: [],
      toGraveyard: [],
    }));
  }

  function changeMode(nextMode: ArrangeMode): void {
    if (nextMode === mode) {
      return;
    }
    const nextIds = library.slice(0, count);
    setArrangement((current) => ({
      ...current,
      mode: nextMode,
      topOrder: nextIds,
      toBottom: [],
      toGraveyard: [],
    }));
  }

  function moveCardTo(cardId: string, bucket: ArrangeBucket): void {
    setArrangement((current) => {
      const nextTop = current.topOrder.filter((id) => id !== cardId);
      const nextBottom = current.toBottom.filter((id) => id !== cardId);
      const nextGraveyard = current.toGraveyard.filter((id) => id !== cardId);
      return {
        ...current,
        topOrder: bucket === 'top' ? [...nextTop, cardId] : nextTop,
        toBottom: bucket === 'bottom' ? [...nextBottom, cardId] : nextBottom,
        toGraveyard: bucket === 'graveyard' ? [...nextGraveyard, cardId] : nextGraveyard,
      };
    });
  }

  function moveCardInBucket(bucket: ArrangeBucket, cardId: string, delta: -1 | 1): void {
    setArrangement((current) => ({
      ...current,
      topOrder: bucket === 'top' ? moveWithin(current.topOrder, cardId, delta) : current.topOrder,
      toBottom: bucket === 'bottom' ? moveWithin(current.toBottom, cardId, delta) : current.toBottom,
      toGraveyard: bucket === 'graveyard'
        ? moveWithin(current.toGraveyard, cardId, delta)
        : current.toGraveyard,
    }));
  }

  const moveTargets: Array<{ bucket: ArrangeBucket; label: string }> =
    mode === 'scry'
      ? [
          { bucket: 'top', label: '上' },
          { bucket: 'bottom', label: '下' },
        ]
      : [
          { bucket: 'top', label: '上' },
          { bucket: 'graveyard', label: '墓地' },
        ];

  function renderBucket(title: string, bucket: ArrangeBucket, ids: string[]): ReactNode {
    return (
      <div key={bucket} className="arrange-top__bucket">
        <h4>{title}</h4>
        {ids.length === 0 ? (
          <p className="zone-viewer__empty">カードはありません。</p>
        ) : (
          ids.map((cardId, index) => {
            const card = state.cards[cardId];
            const def = card ? state.defs[card.defId] : undefined;
            if (!card || !def) return null;

            return (
              <div key={cardId} className="arrange-top__item">
                <CardView instance={card} def={def} size="small" />
                <div className="arrange-top__meta">
                  <strong>{cardDisplayName(state, cardId)}</strong>
                  <div className="arrange-top__actions">
                    {moveTargets.map((target) => (
                      <button
                        key={target.bucket}
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => moveCardTo(cardId, target.bucket)}
                      >
                        {target.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => moveCardInBucket(bucket, cardId, -1)}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => moveCardInBucket(bucket, cardId, 1)}
                      disabled={index === ids.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  const visibleBuckets =
    mode === 'scry'
      ? [
          { title: '上に残す', bucket: 'top' as const, ids: topOrder },
          { title: '下に置く', bucket: 'bottom' as const, ids: toBottom },
        ]
      : [
          { title: '上に残す', bucket: 'top' as const, ids: topOrder },
          { title: '墓地に置く', bucket: 'graveyard' as const, ids: toGraveyard },
        ];

  return (
    <Modal
      title={`${mode === 'scry' ? '占術' : '諜報'} ${count}`}
      onClose={onCancel}
      width="lg"
      testId="arrange-top-dialog"
    >
      {libraryCount === 0 ? (
        <p className="zone-viewer__empty">ライブラリーが空です。</p>
      ) : (
        <>
          <div className="arrange-top__toolbar">
            {!lockMode && <div className="arrange-top__mode" data-testid="scry-surveil-mode">
              <button
                type="button"
                className={`arrange-top__mode-button ${mode === 'scry' ? 'arrange-top__mode-button--active' : ''}`}
                onClick={() => changeMode('scry')}
                disabled={lockMode}
              >
                占術
              </button>
              <button
                type="button"
                className={`arrange-top__mode-button ${mode === 'surveil' ? 'arrange-top__mode-button--active' : ''}`}
                onClick={() => changeMode('surveil')}
                disabled={lockMode}
              >
                諜報
              </button>
            </div>}
            <label className="dialog__field arrange-top__count">
              枚数
              <input
                type="number"
                min={1}
                max={libraryCount}
                value={count}
                onChange={(e) => resetForCount(Number.parseInt(e.target.value, 10) || 0)}
                data-testid="scry-count"
                disabled={lockCount}
              />
            </label>
          </div>
          <div className="arrange-top__grid">
            {visibleBuckets.map((bucket) => renderBucket(bucket.title, bucket.bucket, bucket.ids))}
          </div>
        </>
      )}
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() =>
            onConfirm(topOrder, mode === 'scry' ? toBottom : [], mode === 'surveil' ? toGraveyard : [])
          }
          disabled={libraryCount === 0}
          data-testid="scry-confirm"
        >
          {mode === 'scry' ? '占術' : '諜報'}{count}を行う
        </button>
      </div>
    </Modal>
  );
}

import { ZONE_LABELS_JA as ZONE_TITLES } from '../../data/zoneLabels';

/** Returns every display name (printed + English, both faces) for a card, for search matching. */
function searchableNames(def: CardDef | undefined): string[] {
  if (!def) return [];
  const names = [def.name, def.printedName ?? ''];
  for (const face of def.faces) {
    names.push(face.name, face.printedName ?? '');
  }
  return names.filter((n) => n !== '');
}

function cardTypeLines(def: CardDef | undefined): string[] {
  if (!def) return [];
  return [def.typeLine, ...def.faces.map((face) => face.typeLine)].filter((line) => line !== '');
}

function isLandTypeLine(line: string): boolean {
  return line.includes('Land');
}

function matchesFetchFilter(def: CardDef | undefined, ability: FetchAbility): boolean {
  const typeLines = cardTypeLines(def);
  const isLand = typeLines.some((line) => isLandTypeLine(line));
  if (!isLand) {
    return false;
  }

  if (ability.filter === 'basic') {
    return typeLines.some((line) => isLandTypeLine(line) && line.includes('Basic'));
  }

  if (ability.filter === 'any-land') {
    return true;
  }

  return ability.filter.subtypes.some((subtype) =>
    typeLines.some((line) => isLandTypeLine(line) && line.includes(subtype))
  );
}

function fetchFilterLabel(ability: FetchAbility): string {
  if (ability.filter === 'basic') {
    return '基本土地';
  }

  if (ability.filter === 'any-land') {
    return '土地';
  }

  return ability.filter.subtypes.join(' / ');
}

const LAND_SUBTYPE_LABELS: Record<string, string> = {
  Plains: '平地',
  Island: '島',
  Swamp: '沼',
  Mountain: '山',
  Forest: '森',
};

function matchesLibrarySearchFilter(
  def: CardDef | undefined,
  filter: LibrarySearchFilter,
): boolean {
  const typeLines = cardTypeLines(def);
  const isLand = typeLines.some((line) => isLandTypeLine(line));
  if (!isLand) {
    return false;
  }
  if (filter.kind === 'basic-land') {
    return typeLines.some((line) => isLandTypeLine(line) && /\bBasic\b/i.test(line));
  }
  return typeLines.some(
    (line) => isLandTypeLine(line) && new RegExp(`\\b${filter.subtype}\\b`, 'i').test(line),
  );
}

function librarySearchFilterLabel(filter: LibrarySearchFilter): string {
  if (filter.kind === 'basic-land') {
    return '基本土地';
  }
  return `${LAND_SUBTYPE_LABELS[filter.subtype] ?? filter.subtype}タイプの土地`;
}

export function FetchSearchDialog({
  state,
  sourceId,
  ability,
  onConfirm,
  onClose,
}: {
  state: GameState;
  sourceId: string;
  ability: FetchAbility;
  onConfirm: (targetId: string, opts: { entersTapped: boolean }) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [showAllCards, setShowAllCards] = useState(false);
  // 既定値は盤面依存(寓話の小道: 支配土地 4 枚以上でアンタップ)。サンドボックスゆえ上書き可。
  // controller はフェッチ元(既にサクリファイ済みだが controllerId は保持)から読む。
  const [entersTapped, setEntersTapped] = useState(() =>
    fetchEntersTapped(state, ability, state.cards[sourceId]?.controllerId ?? state.activePlayerId),
  );
  const libraryIds = state.zones.library;

  const eligibleIds = libraryIds.filter((cardId) => {
    const card = state.cards[cardId];
    const def = card ? state.defs[card.defId] : undefined;
    return showAllCards || matchesFetchFilter(def, ability);
  });

  const query = search.trim().toLowerCase();
  const filteredIds = query
    ? eligibleIds.filter((cardId) => {
        const card = state.cards[cardId];
        const def = card ? state.defs[card.defId] : undefined;
        return searchableNames(def).some((name) => name.toLowerCase().includes(query));
      })
    : eligibleIds;

  const sourceName = cardDisplayName(state, sourceId);
  const emptyMessage =
    libraryIds.length === 0
      ? 'ライブラリーが空です。'
      : filteredIds.length === 0 && !showAllCards
        ? '該当する土地がありません。「すべてのカード」をオンにすると全カードを表示できます。'
        : '該当するカードはありません。';

  return (
    <Modal title="サーチ(フェッチ)" onClose={onClose} width="lg" testId="fetch-search-dialog">
      <p>
        《{sourceName}》のフェッチを解決します。{fetchFilterLabel(ability)} を探します。
      </p>
      {ability.lifeCost > 0 && <p>ライフ支払いは起動時に完了しています。</p>}
      <label className="dialog__field">
        カード名で検索
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="カード名で検索…"
          data-testid="fetch-search-input"
          autoFocus
        />
      </label>
      <div className="zone-viewer__search">
        <label>
          <input
            type="checkbox"
            checked={showAllCards}
            onChange={(e) => setShowAllCards(e.target.checked)}
            data-testid="fetch-filter-toggle"
          />
          すべてのカードを表示
        </label>
        <label>
          <input
            type="checkbox"
            checked={entersTapped}
            onChange={(e) => setEntersTapped(e.target.checked)}
            data-testid="fetch-enters-tapped"
          />
          タップ状態で出す
        </label>
        <span className="zone-viewer__search-count">
          {filteredIds.length} / {eligibleIds.length} 枚
        </span>
      </div>
      {filteredIds.length === 0 ? (
        <p className="zone-viewer__empty">{emptyMessage}</p>
      ) : (
        <ul className="zone-viewer__list">
          {filteredIds.map((cardId) => {
            const card = state.cards[cardId];
            const def = card ? state.defs[card.defId] : undefined;
            if (!card || !def) return null;

            return (
              <li key={cardId} className="zone-viewer__item">
                <div className="zone-viewer__thumb">
                  <CardView instance={card} def={def} size="small" />
                </div>
                <div className="zone-viewer__info">
                  <span className="zone-viewer__name">{cardDisplayName(state, cardId)}</span>
                  <div className="zone-viewer__targets">
                    <button
                      type="button"
                      className="btn btn--accent btn--sm"
                      onClick={() => {
                        onConfirm(cardId, { entersTapped });
                        onClose();
                      }}
                      data-testid={`fetch-target-${cardId}`}
                    >
                      選択
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onClose}>
          閉じる
        </button>
      </div>
    </Modal>
  );
}

export function GuidedLibrarySearchDialog({
  state,
  playerId,
  sourceId,
  prompt,
  onConfirm,
  onMiss,
  onClose,
}: {
  state: GameState;
  playerId?: PlayerId;
  sourceId: string;
  prompt: EffectPrompt;
  onConfirm: (targetId: string) => void;
  onMiss: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const spec = prompt.librarySearch;
  if (!spec) {
    return null;
  }

  const libraryIds = state.zonesByPlayer[playerId ?? state.localPlayerId].library;
  const eligibleIds = libraryIds.filter((cardId) => {
    const card = state.cards[cardId];
    const def = card ? state.defs[card.defId] : undefined;
    return matchesLibrarySearchFilter(def, spec.filter);
  });

  const query = search.trim().toLowerCase();
  const filteredIds = query
    ? eligibleIds.filter((cardId) => {
        const card = state.cards[cardId];
        const def = card ? state.defs[card.defId] : undefined;
        return searchableNames(def).some((name) => name.toLowerCase().includes(query));
      })
    : eligibleIds;

  const sourceName = cardDisplayName(state, sourceId);
  const filterLabel = librarySearchFilterLabel(spec.filter);
  const destinationLabel = spec.entersTapped ? 'タップ状態で戦場に出します。' : '戦場に出します。';
  const emptyMessage =
    libraryIds.length === 0
      ? 'ライブラリーが空です。'
      : filteredIds.length === 0
        ? '該当するカードはありません。'
        : '';

  return (
    <Modal
      title="ライブラリーから探す"
      onClose={onClose}
      width="lg"
      testId="guided-library-search-dialog"
    >
      <p>
        《{sourceName}》の効果で{filterLabel}を探し、{destinationLabel}
        その後ライブラリーを切り直します。
      </p>
      <label className="dialog__field">
        カード名で検索
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="カード名で検索…"
          data-testid="guided-library-search-input"
          autoFocus
        />
      </label>
      <div className="zone-viewer__search">
        <span className="zone-viewer__search-count">
          {filteredIds.length} / {eligibleIds.length} 枚
        </span>
      </div>
      {filteredIds.length === 0 ? (
        <p className="zone-viewer__empty">{emptyMessage}</p>
      ) : (
        <ul className="zone-viewer__list">
          {filteredIds.map((cardId) => {
            const card = state.cards[cardId];
            const def = card ? state.defs[card.defId] : undefined;
            if (!card || !def) return null;

            return (
              <li key={cardId} className="zone-viewer__item">
                <div className="zone-viewer__thumb">
                  <CardView instance={card} def={def} size="small" />
                </div>
                <div className="zone-viewer__info">
                  <span className="zone-viewer__name">{cardDisplayName(state, cardId)}</span>
                  <div className="zone-viewer__targets">
                    <button
                      type="button"
                      className="btn btn--accent btn--sm"
                      onClick={() => {
                        onConfirm(cardId);
                        onClose();
                      }}
                      data-testid={`guided-library-search-target-${cardId}`}
                    >
                      選択
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="dialog__actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            onMiss();
            onClose();
          }}
          data-testid="guided-library-search-miss"
        >
          見つけずに切り直す
        </button>
        <button type="button" className="btn" onClick={onClose}>
          閉じる
        </button>
      </div>
    </Modal>
  );
}

/** Zone inspection and selection share one contextual action area. */
export function ZoneViewerDialog({
  zone,
  cardIds,
  state,
  onMove,
  onShuffle,
  onCardContextMenu,
  onClose,
  readOnly = false,
  searchEnabled,
  title,
  testId,
}: {
  zone: ZoneId;
  cardIds: string[];
  state: GameState;
  onMove?: (cardId: string, to: ZoneId) => void;
  onShuffle?: () => boolean;
  onCardContextMenu?: (
    cardId: string,
    e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => void;
  onClose: () => void;
  readOnly?: boolean;
  searchEnabled?: boolean;
  title?: string;
  testId?: string;
}) {
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(24);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destination, setDestination] = useState<ZoneId>('hand');
  const [shuffled, setShuffled] = useState(false);
  const [notice, setNotice] = useState('');
  const selectedCard = selectedId ? state.cards[selectedId] : undefined;
  const selectedDef = selectedCard ? state.defs[selectedCard.defId] : undefined;
  const selectedName = selectedDef?.printedName ?? selectedDef?.name ?? '';
  const selectedHere = Boolean(selectedCard && selectedId && cardIds.includes(selectedId));
  const writable = !readOnly && Boolean(onMove);
  const shouldShowSearch = searchEnabled
    ?? (!readOnly && (zone === 'library' || zone === 'graveyard' || zone === 'exile'));

  const allTargets: { zone: ZoneId; label: string }[] = [
    { zone: 'hand', label: zone === 'library' ? '手札に加える' : '手札に戻す' },
    { zone: 'battlefield', label: '戦場に出す（手動）' },
    { zone: 'graveyard', label: '墓地に置く（手動）' },
    { zone: 'exile', label: '追放する' },
    { zone: 'library', label: 'ライブラリーの上に置く' },
    { zone: 'command', label: '統率領域に戻す' },
  ];
  const targets = allTargets.filter((t) => t.zone !== zone);
  const target = targets.find((t) => t.zone === destination) ?? targets[0];

  const query = search.trim().toLowerCase();
  const filteredIds = query
    ? cardIds.filter((id) => {
        const card = state.cards[id];
        const def = card ? state.defs[card.defId] : undefined;
        return searchableNames(def).some((n) => n.toLowerCase().includes(query));
      })
    : cardIds;
  const visibleIds = filteredIds.slice(0, visibleCount);

  return (
    <Modal title={title ?? ZONE_TITLES[zone]} onClose={onClose} width="lg" testId={testId ?? `${zone}-viewer-dialog`}>
      {shouldShowSearch && cardIds.length > 0 && (
        <div className="zone-viewer__search">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="カード名で検索…"
            data-testid="zone-viewer-search"
            data-autofocus="true"
          />
          <span className="zone-viewer__search-count">
            {filteredIds.length} / {cardIds.length} 枚
          </span>
        </div>
      )}
      {cardIds.length === 0 ? (
        <p className="zone-viewer__empty">カードはありません。</p>
      ) : filteredIds.length === 0 ? (
        <p className="zone-viewer__empty">該当するカードはありません。</p>
      ) : (
        <ul className={`zone-viewer__list${writable ? ' zone-viewer__list--selectable' : ''}`}>
          {visibleIds.map((id) => {
            const card: CardInstance | undefined = state.cards[id];
            const def: CardDef | undefined = card ? state.defs[card.defId] : undefined;
            const face = card ? def?.faces[card.faceIndex] ?? def?.faces[0] : undefined;
            const displayName = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
            return (
              <li key={id} className="zone-viewer__item" onClick={writable ? () => { setSelectedId(id); setNotice(''); } : undefined}>
                <div className="zone-viewer__thumb">
                  {card && def && (
                    <CardView
                      instance={card}
                      def={def}
                      size="small"
                      onContextMenu={
                        onCardContextMenu
                          ? (e) => onCardContextMenu(id, e)
                          : undefined
                      }
                    />
                  )}
                </div>
                <div className="zone-viewer__info">
                  <span className="zone-viewer__name">
                    {displayName}
                    {card && isCommander(state, card.id) && (
                      <span className="zone-viewer__badge">統率者</span>
                    )}
                  </span>
                  {writable && (
                    <label className="zone-viewer__select">
                      <input type="radio" name="zone-card" checked={selectedId === id}
                        onChange={() => { setSelectedId(id); setNotice(''); }} data-testid={`zone-select-${id}`} />
                      {selectedId === id ? '選択中' : '選ぶ'}
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {visibleCount < filteredIds.length && (
        <button
          type="button"
          className="btn btn--primary zone-viewer__more"
          onClick={() => setVisibleCount((count) => count + 24)}
          data-testid="zone-viewer-show-more"
        >
          さらに表示（残り {filteredIds.length - visibleCount} 枚）
        </button>
      )}
      {writable && (
        <section className="zone-viewer__selection" aria-label="選択したカードの操作">
          {selectedHere && selectedCard && selectedDef ? <>
            <div className="zone-viewer__selected-card">
              <CardView instance={selectedCard} def={selectedDef} size="small" />
              <strong>《{selectedName}》</strong>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedId(null)}>選択を解除</button>
            </div>
            <div className="zone-viewer__targets">
              <label>行うこと <select value={target.zone} onChange={(e) => setDestination(e.target.value as ZoneId)} data-testid="zone-destination">
                {targets.map((t) => <option key={t.zone} value={t.zone}>{t.label}</option>)}
              </select></label>
              <button type="button" className="btn btn--accent" data-testid="zone-move-confirm" onClick={() => {
                if (!selectedId || !cardIds.includes(selectedId)) return;
                setShuffled(false);
                setNotice('');
                onMove?.(selectedId, target.zone);
              }}>{target.label}</button>
              {onCardContextMenu && <button type="button" className="btn" onClick={(e) => onCardContextMenu(selectedId!, e)}>その他の操作…</button>}
            </div>
          </> : <p role="status">{selectedCard && selectedCard.zone !== zone
            ? `《${selectedName}》：現在は${ZONE_TITLES[selectedCard.zone]}です。`
            : '操作するカードを選んでください。'}</p>}
          {zone === 'library' && onShuffle && <div className="zone-viewer__targets">
            <span role="status">{shuffled ? '切り直しました。' : 'この画面ではまだ切り直していません。'}</span>
            <button type="button" className="btn" data-testid="zone-shuffle" disabled={shuffled} onClick={() => {
              if (onShuffle()) { setShuffled(true); setSelectedId(null); setNotice(''); }
              else setNotice('切り直せませんでした。盤面を確認してください。');
            }}>切り直す</button>
          </div>}
          {notice && <p role="status">{notice}</p>}
          <button type="button" className="btn" onClick={onClose}>閉じる</button>
        </section>
      )}
    </Modal>
  );
}

/** Mulligan: choose which cards from hand go to the bottom of the library. */
export function MulliganBottomDialog({
  cardIds,
  state,
  count,
  onConfirm,
}: {
  cardIds: string[];
  state: GameState;
  count: number;
  onConfirm: (chosen: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string): void {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= count) return prev;
      return [...prev, id];
    });
  }

  return (
    <Modal title="マリガン: ライブラリーの下に戻すカード" width="lg" testId="mulligan-bottom-dialog">
      <p>
        {count}枚を選んでライブラリーの一番下に戻してください。(選択中: {selected.length} / {count})
      </p>
      <div className="mulligan-grid">
        {cardIds.map((id) => {
          const card = state.cards[id];
          const def = card ? state.defs[card.defId] : undefined;
          if (!card || !def) return null;
          const chosen = selected.includes(id);
          return (
            <div
              key={id}
              className={`mulligan-grid__item ${chosen ? 'mulligan-grid__item--chosen' : ''}`}
              onClick={() => toggle(id)}
              data-testid={`mulligan-pick-${id}`}
            >
              <CardView instance={card} def={def} size="small" />
              {chosen && <div className="mulligan-grid__check">戻す</div>}
            </div>
          );
        })}
      </div>
      <div className="dialog__actions">
        <button
          type="button"
          className="btn btn--accent"
          disabled={selected.length !== count}
          onClick={() => onConfirm(selected)}
          data-testid="mulligan-bottom-confirm"
        >
          決定
        </button>
      </div>
    </Modal>
  );
}
