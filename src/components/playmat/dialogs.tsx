import { useState, type ReactNode } from 'react';
import { Modal } from '../Modal';
import type { ManaColor } from '../../types/card';
import type { CardDef } from '../../types/card';
import type { CardInstance, GameState, ZoneId } from '../../engine/types';
import { isCommander } from '../../engine/commander';
import { parseManaCost } from '../../engine/mana';
import { effectivePower, isSummoningSick, type FetchAbility } from '../../engine/status';
import { CardView } from '../CardView';

const MANA_LABELS: Record<ManaColor, string> = {
  W: '白',
  U: '青',
  B: '黒',
  R: '赤',
  G: '緑',
  C: '無色',
};

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

export function XCostDialog({
  cardName,
  manaCost,
  onConfirm,
  onCancel,
}: {
  cardName: string;
  manaCost: string;
  onConfirm: (xValue: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('0');
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
          min={0}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-testid="x-cost-input"
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
          onClick={() => onConfirm(Math.max(0, Number.parseInt(value, 10) || 0))}
          data-testid="x-cost-confirm"
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
  onConfirm,
  onCancel,
}: {
  state: GameState;
  opponentLabels: string[];
  onConfirm: (attackerIds: string[], targetLabel: string) => void;
  onCancel: () => void;
}) {
  const creatureIds = state.zones.battlefield.filter((cardId) => {
    const card = state.cards[cardId];
    const def = card ? state.defs[card.defId] : undefined;
    const face = card ? def?.faces[card.faceIndex] ?? def?.faces[0] : undefined;
    const typeLine = face?.typeLine ?? def?.typeLine ?? '';
    return typeLine.includes('Creature');
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [targetLabel, setTargetLabel] = useState(opponentLabels[0] ?? '対戦相手A');

  function toggle(cardId: string): void {
    setSelected((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  }

  const totalPower = selected.reduce((sum, cardId) => sum + effectivePower(state, cardId), 0);
  const selectedWarnings = selected.filter((cardId) => isSummoningSick(state, cardId));

  return (
    <Modal title="攻撃" onClose={onCancel} width="lg" testId="attack-dialog">
      {creatureIds.length === 0 ? (
        <p className="zone-viewer__empty">攻撃できるクリーチャーがいません。</p>
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
              onChange={(e) => setTargetLabel(e.target.value)}
              data-testid="attack-target-select"
            >
              {opponentLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => onConfirm(selected, targetLabel)}
          disabled={selected.length === 0 || creatureIds.length === 0}
          data-testid="attack-confirm"
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
    <Modal title="マリガン" width="xl" testId="mulligan-decision-dialog">
      <p>
        {mulliganCount <= 1
          ? '初手です。キープか7枚引き直しを選んでください。(1回目のマリガンは無料です)'
          : `${mulliganCount}回マリガンしています。キープすると ${mulliganCount - 1} 枚をライブラリの下に戻します。`}
      </p>
      <div className="mulligan-grid mulligan-grid--decision">
        {state.zones.hand.map((id) => {
          const card = state.cards[id];
          const def = card ? state.defs[card.defId] : undefined;
          if (!card || !def) return null;
          return (
            <div key={id} className="mulligan-grid__item mulligan-grid__item--static">
              <CardView instance={card} def={def} size="hand" />
            </div>
          );
        })}
      </div>
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onKeep} data-testid="mulligan-keep">
          キープ
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={onMulligan}
          data-testid="mulligan-again"
        >
          マリガン({mulliganCount + 1}回目)
        </button>
      </div>
    </Modal>
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
  onChoose,
  onCancel,
}: {
  cardName: string;
  destinationLabel: string;
  onChoose: (toCommandZone: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="統率者の移動先" onClose={onCancel} width="sm" testId="commander-move-dialog">
      <p>
        《{cardName}》は統率者です。{destinationLabel}に送る代わりに統率領域へ戻しますか?
      </p>
      <div className="dialog__actions">
        <button
          type="button"
          className="btn"
          onClick={() => onChoose(false)}
          data-testid="commander-move-keep"
        >
          {destinationLabel}へ送る
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => onChoose(true)}
          data-testid="commander-move-command"
        >
          統率領域へ戻す
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
  onConfirm,
  onCancel,
}: {
  state: GameState;
  onConfirm: (topOrder: string[], toBottom: string[], toGraveyard: string[]) => void;
  onCancel: () => void;
}) {
  const libraryCount = state.zones.library.length;
  const initialCount = Math.min(3, libraryCount);
  const [count, setCount] = useState(initialCount);
  const [mode, setMode] = useState<ArrangeMode>('scry');
  const [topOrder, setTopOrder] = useState<string[]>(state.zones.library.slice(0, initialCount));
  const [toBottom, setToBottom] = useState<string[]>([]);
  const [toGraveyard, setToGraveyard] = useState<string[]>([]);

  function resetForCount(nextCount: number): void {
    const clamped = Math.max(0, Math.min(libraryCount, nextCount));
    const nextIds = state.zones.library.slice(0, clamped);
    setCount(clamped);
    setTopOrder(nextIds);
    setToBottom([]);
    setToGraveyard([]);
  }

  function changeMode(nextMode: ArrangeMode): void {
    if (nextMode === mode) {
      return;
    }
    setMode(nextMode);
    resetForCount(count);
  }

  function moveCardTo(cardId: string, bucket: ArrangeBucket): void {
    const nextTop = topOrder.filter((id) => id !== cardId);
    const nextBottom = toBottom.filter((id) => id !== cardId);
    const nextGraveyard = toGraveyard.filter((id) => id !== cardId);

    if (bucket === 'top') {
      setTopOrder([...nextTop, cardId]);
      setToBottom(nextBottom);
      setToGraveyard(nextGraveyard);
    } else if (bucket === 'bottom') {
      setTopOrder(nextTop);
      setToBottom([...nextBottom, cardId]);
      setToGraveyard(nextGraveyard);
    } else {
      setTopOrder(nextTop);
      setToBottom(nextBottom);
      setToGraveyard([...nextGraveyard, cardId]);
    }
  }

  function moveCardInBucket(bucket: ArrangeBucket, cardId: string, delta: -1 | 1): void {
    if (bucket === 'top') {
      setTopOrder((prev) => moveWithin(prev, cardId, delta));
    } else if (bucket === 'bottom') {
      setToBottom((prev) => moveWithin(prev, cardId, delta));
    } else {
      setToGraveyard((prev) => moveWithin(prev, cardId, delta));
    }
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
          { title: '上', bucket: 'top' as const, ids: topOrder },
          { title: '下', bucket: 'bottom' as const, ids: toBottom },
        ]
      : [
          { title: '上', bucket: 'top' as const, ids: topOrder },
          { title: '墓地', bucket: 'graveyard' as const, ids: toGraveyard },
        ];

  return (
    <Modal
      title={`${mode === 'scry' ? '占術' : '諜報'} ${count}`}
      onClose={onCancel}
      width="lg"
      testId="arrange-top-dialog"
    >
      {libraryCount === 0 ? (
        <p className="zone-viewer__empty">ライブラリが空です。</p>
      ) : (
        <>
          <div className="arrange-top__toolbar">
            <div className="arrange-top__mode" data-testid="scry-surveil-mode">
              <button
                type="button"
                className={`arrange-top__mode-button ${mode === 'scry' ? 'arrange-top__mode-button--active' : ''}`}
                onClick={() => changeMode('scry')}
              >
                占術
              </button>
              <button
                type="button"
                className={`arrange-top__mode-button ${mode === 'surveil' ? 'arrange-top__mode-button--active' : ''}`}
                onClick={() => changeMode('surveil')}
              >
                諜報
              </button>
            </div>
            <label className="dialog__field arrange-top__count">
              枚数
              <input
                type="number"
                min={1}
                max={libraryCount}
                value={count}
                onChange={(e) => resetForCount(Number.parseInt(e.target.value, 10) || 0)}
                data-testid="scry-count"
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
          決定
        </button>
      </div>
    </Modal>
  );
}

const ZONE_TITLES: Record<ZoneId, string> = {
  library: 'ライブラリ',
  hand: '手札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
};

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
  onConfirm: (targetId: string, opts: { entersTapped: boolean; lifeCost: number }) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [showAllCards, setShowAllCards] = useState(false);
  const [entersTapped, setEntersTapped] = useState(ability.entersTapped);
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
      ? 'ライブラリが空です。'
      : filteredIds.length === 0 && !showAllCards
        ? '該当する土地がありません。「すべてのカード」をオンにすると全カードを表示できます。'
        : '該当するカードはありません。';

  return (
    <Modal title="サーチ(フェッチ)" onClose={onClose} width="lg" testId="fetch-search-dialog">
      <p>
        《{sourceName}》で {fetchFilterLabel(ability)} を探します。ライフ -{ability.lifeCost}
      </p>
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
                        onConfirm(cardId, { entersTapped, lifeCost: ability.lifeCost });
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

/** Modal listing every card in a zone with a per-card move menu. Library view includes a name search/filter. */
export function ZoneViewerDialog({
  zone,
  cardIds,
  state,
  onMove,
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
  const shouldShowSearch = searchEnabled ?? (zone === 'library' && !readOnly);

  const allTargets: { zone: ZoneId; label: string }[] = [
    { zone: 'hand', label: '手札へ' },
    { zone: 'battlefield', label: '戦場へ' },
    { zone: 'graveyard', label: '墓地へ' },
    { zone: 'exile', label: '追放へ' },
    { zone: 'library', label: 'ライブラリ最上部へ' },
    { zone: 'command', label: '統率領域へ' },
  ];
  const targets = allTargets.filter((t) => t.zone !== zone);

  const query = search.trim().toLowerCase();
  const filteredIds = query
    ? cardIds.filter((id) => {
        const card = state.cards[id];
        const def = card ? state.defs[card.defId] : undefined;
        return searchableNames(def).some((n) => n.toLowerCase().includes(query));
      })
    : cardIds;

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
        <ul className="zone-viewer__list">
          {filteredIds.map((id) => {
            const card: CardInstance | undefined = state.cards[id];
            const def: CardDef | undefined = card ? state.defs[card.defId] : undefined;
            const face = card ? def?.faces[card.faceIndex] ?? def?.faces[0] : undefined;
            const displayName = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
            return (
              <li key={id} className="zone-viewer__item">
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
                  {!readOnly && onMove && (
                    <div className="zone-viewer__targets">
                      {targets.map((t) => (
                        <button
                          key={t.zone}
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => onMove(id, t.zone)}
                          data-testid={`move-${id}-${t.zone}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
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
    <Modal title="マリガン: ライブラリの下に戻すカード" width="lg" testId="mulligan-bottom-dialog">
      <p>
        {count}枚を選んでライブラリの一番下に戻してください。(選択中: {selected.length} / {count})
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
