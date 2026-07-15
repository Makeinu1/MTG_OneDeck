import { useState } from 'react';
import {
  SCENARIO_CARD_TYPES,
  emptyScenarioPermanent,
  opponentSetupDraftFromState,
  type OpponentSetupDraft,
  type ScenarioCardType,
  type ScenarioPermanentDraft,
} from '../../engine/scenario';
import { STATUS_KEYWORDS, type Keyword } from '../../engine/status';
import type { GameState, PlayerId } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

const KEYWORD_LABELS: Partial<Record<Keyword, string>> = {
  flying: '飛行',
  vigilance: '警戒',
  trample: 'トランプル',
  deathtouch: '接死',
  lifelink: '絆魂',
  menace: '威迫',
  'first-strike': '先制攻撃',
  'double-strike': '二段攻撃',
  reach: '到達',
  haste: '速攻',
  hexproof: '呪禁',
  indestructible: '破壊不能',
  defender: '防衛',
  ward: '護法',
};

const SCENARIO_TYPE_LABELS: Record<ScenarioCardType, string> = {
  Creature: 'クリーチャー',
  Artifact: 'アーティファクト',
  Enchantment: 'エンチャント',
  Land: '土地',
  Planeswalker: 'プレインズウォーカー',
};

function parseCounters(value: string): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const part of value.split(',')) {
    const separator = part.lastIndexOf(':');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const amount = Number.parseInt(part.slice(separator + 1).trim(), 10);
    if (name && Number.isFinite(amount) && amount > 0) counters[name] = amount;
  }
  return counters;
}

function counterText(counters: Readonly<Record<string, number>>): string {
  return Object.entries(counters).map(([name, amount]) => name + ':' + amount).join(', ');
}

interface EditorProps {
  permanent: ScenarioPermanentDraft;
  index: number;
  count: number;
  onChange: (next: ScenarioPermanentDraft) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
}

function PermanentEditor(props: EditorProps) {
  const { permanent, index, count, onChange, onDuplicate, onDelete, onMove } = props;
  function toggleType(type: ScenarioCardType, checked: boolean): void {
    const selected = new Set(permanent.cardTypes);
    if (checked) selected.add(type);
    else selected.delete(type);
    onChange({
      ...permanent,
      cardTypes: SCENARIO_CARD_TYPES.filter((candidate) => selected.has(candidate)),
    });
  }
  function toggleKeyword(keyword: Keyword, checked: boolean): void {
    const selected = new Set(permanent.keywords);
    if (checked) selected.add(keyword);
    else selected.delete(keyword);
    onChange({
      ...permanent,
      keywords: STATUS_KEYWORDS.filter((candidate) => selected.has(candidate)),
    });
  }
  return (
    <article className="opponent-setup-card" data-testid={'setup-permanent-' + index}>
      <div className="opponent-setup-card__heading">
        <strong>{index + 1}. {permanent.name || '名称未設定'}</strong>
        <div className="opponent-setup-card__actions">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} data-testid={'setup-move-up-' + index}>↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} data-testid={'setup-move-down-' + index}>↓</button>
          <button type="button" onClick={onDuplicate} data-testid={'setup-duplicate-' + index}>複製</button>
          <button type="button" onClick={onDelete} data-testid={'setup-delete-' + index}>削除</button>
        </div>
      </div>
      <label>
        表示名
        <input
          value={permanent.name}
          onChange={(event) => onChange({ ...permanent, name: event.currentTarget.value })}
          data-testid={'setup-name-' + index}
        />
      </label>
      <fieldset>
        <legend>カードタイプ</legend>
        {SCENARIO_CARD_TYPES.map((type) => (
          <label key={type}>
            <input
              type="checkbox"
              checked={permanent.cardTypes.includes(type)}
              onChange={(event) => toggleType(type, event.currentTarget.checked)}
              data-testid={`setup-type-${index}-${type.toLowerCase()}`}
            />
            {SCENARIO_TYPE_LABELS[type]}
          </label>
        ))}
      </fieldset>
      {permanent.cardTypes.includes('Creature') && (
        <div className="opponent-setup-card__stats">
          <label>パワー<input value={permanent.power} onChange={(event) => onChange({ ...permanent, power: event.currentTarget.value })} data-testid={'setup-power-' + index} /></label>
          <label>タフネス<input value={permanent.toughness} onChange={(event) => onChange({ ...permanent, toughness: event.currentTarget.value })} data-testid={'setup-toughness-' + index} /></label>
        </div>
      )}
      <div className="opponent-setup-card__flags">
        <label><input type="checkbox" checked={permanent.tapped} onChange={(event) => onChange({ ...permanent, tapped: event.currentTarget.checked })} data-testid={'setup-tapped-' + index} />タップ状態</label>
        <label><input type="checkbox" checked={permanent.isToken} onChange={(event) => onChange({ ...permanent, isToken: event.currentTarget.checked })} data-testid={'setup-token-' + index} />ルール上トークン</label>
      </div>
      <label>
        カウンター（例: +1/+1:2, loyalty:4）
        <input
          defaultValue={counterText(permanent.counters)}
          onBlur={(event) => onChange({ ...permanent, counters: parseCounters(event.currentTarget.value) })}
          data-testid={'setup-counters-' + index}
        />
      </label>
      <fieldset>
        <legend>手動キーワード</legend>
        <div className="opponent-setup-card__keywords">
          {STATUS_KEYWORDS.map((keyword) => (
            <label key={keyword}>
              <input
                type="checkbox"
                checked={permanent.keywords.includes(keyword)}
                onChange={(event) => toggleKeyword(keyword, event.currentTarget.checked)}
                data-testid={`setup-keyword-${index}-${keyword}`}
              />
              {KEYWORD_LABELS[keyword] ?? keyword}
            </label>
          ))}
        </div>
      </fieldset>
    </article>
  );
}

export interface OpponentSetupScreenProps {
  state: GameState;
  onCancel: () => void;
  onApplied: () => void;
}

export function OpponentSetupScreen({ state, onCancel, onApplied }: OpponentSetupScreenProps) {
  const opponentIds = state.turnOrder.filter((id) => id !== state.localPlayerId);
  const [playerId, setPlayerId] = useState<PlayerId>(opponentIds[0] ?? state.localPlayerId);
  const [drafts, setDrafts] = useState<Record<PlayerId, OpponentSetupDraft>>(() =>
    Object.fromEntries(opponentIds.map((id) => [id, opponentSetupDraftFromState(state, id)])),
  );
  const [applyError, setApplyError] = useState<string | null>(null);
  const draft = drafts[playerId] ?? opponentSetupDraftFromState(state, playerId);
  const player = state.players[playerId];

  function updateDraft(next: OpponentSetupDraft): void {
    setDrafts((current) => ({ ...current, [playerId]: next }));
  }
  function updatePermanent(index: number, next: ScenarioPermanentDraft): void {
    updateDraft({
      ...draft,
      permanents: draft.permanents.map((item, itemIndex) => itemIndex === index ? next : item),
    });
  }
  function movePermanent(index: number, delta: -1 | 1): void {
    const destination = index + delta;
    if (destination < 0 || destination >= draft.permanents.length) return;
    const permanents = draft.permanents.slice();
    [permanents[index], permanents[destination]] = [permanents[destination], permanents[index]];
    updateDraft({ ...draft, permanents });
  }
  function nextDraftId(): string {
    let number = 1;
    const ids = new Set(draft.permanents.map((permanent) => permanent.draftId));
    while (ids.has('draft-' + number)) number += 1;
    return 'draft-' + number;
  }
  function apply(): void {
    const applied = useGameStore.getState().applyOpponentSetups(
      opponentIds.flatMap((id) => drafts[id] ? [drafts[id]] : []),
    );
    if (applied) {
      onApplied();
    } else {
      setApplyError('反映できませんでした。名前とカードタイプなどの入力を確認してください。');
    }
  }

  if (!player) return null;
  return (
    <main className="opponent-setup" data-testid="opponent-setup-screen">
      <header className="opponent-setup__header">
        <div>
          <p className="opponent-setup__kicker">トレーニングデータ</p>
          <h1>対戦相手セットアップ</h1>
          <p>ここでの編集は「盤面へ反映」まで実ゲームへ影響しません。</p>
        </div>
        <div className="opponent-setup__header-actions">
          <button type="button" onClick={onCancel} data-testid="setup-cancel">キャンセル</button>
          <button type="button" onClick={apply} data-testid="setup-apply">盤面へ反映</button>
        </div>
      </header>
      {applyError && <p className="opponent-setup__error" role="alert" data-testid="setup-error">{applyError}</p>}
      <section className="opponent-setup__player">
        <label>
          編集する対戦相手
          <select value={playerId} onChange={(event) => setPlayerId(event.currentTarget.value)} data-testid="setup-player">
            {opponentIds.map((id) => <option key={id} value={id}>{state.players[id]?.label ?? id}</option>)}
          </select>
        </label>
        <label>ライフ<input type="number" value={draft.life} onChange={(event) => updateDraft({ ...draft, life: Number(event.currentTarget.value) })} data-testid="setup-life" /></label>
        <label>毒<input type="number" min={0} value={draft.poison} onChange={(event) => updateDraft({ ...draft, poison: Math.max(0, Number(event.currentTarget.value)) })} data-testid="setup-poison" /></label>
      </section>
      <section className="opponent-setup__permanents">
        <div className="opponent-setup__section-heading">
          <div><h2>{player.label}のダミーパーマネント</h2><p>能力を持たない検証用オブジェクトです。</p></div>
          <button
            type="button"
            onClick={() => updateDraft({
              ...draft,
              permanents: [...draft.permanents, emptyScenarioPermanent(nextDraftId())],
            })}
            data-testid="setup-add-permanent"
          >＋ 追加</button>
        </div>
        {draft.permanents.length === 0 && <p className="opponent-setup__empty">まだダミーはありません。</p>}
        <div className="opponent-setup__list">
          {draft.permanents.map((permanent, index) => (
            <PermanentEditor
              key={`${playerId}:${permanent.draftId}`}
              permanent={permanent}
              index={index}
              count={draft.permanents.length}
              onChange={(next) => updatePermanent(index, next)}
              onDuplicate={() => updateDraft({
                ...draft,
                permanents: [
                  ...draft.permanents.slice(0, index + 1),
                  {
                    ...permanent,
                    draftId: nextDraftId(),
                    sourceCardId: undefined,
                    counters: { ...permanent.counters },
                    keywords: permanent.keywords.slice(),
                  },
                  ...draft.permanents.slice(index + 1),
                ],
              })}
              onDelete={() => updateDraft({
                ...draft,
                permanents: draft.permanents.filter((_, itemIndex) => itemIndex !== index),
              })}
              onMove={(delta) => movePermanent(index, delta)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
