import { useState } from 'react';
import { tableZones, type CockpitTable } from '../../engine/cockpitTable';
import {
  captureExpectedInteractionContext,
  type ExpectedInteractionContext,
} from '../../engine/cockpitR31';
import type { R4bOperation, R4bRepairOperation } from '../../engine/cockpitR4b';
import { objectIdOf, type ZoneId } from '../../engine/types';

const zoneLabels: Record<Exclude<ZoneId, 'stack'>, string> = {
  hand: '手札',
  library: '山札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
};

interface CorrectionDraft {
  context: ExpectedInteractionContext;
  objects: { cardId: string; objectId: string }[];
  to: Exclude<ZoneId, 'stack'>;
  position: 'top' | 'bottom';
  lifeValue: number;
  counterName: string;
  counterValue: number;
  damageMarked: number;
  deathtouchDamage: boolean;
}

export function CockpitCorrectionTools({
  table,
  seatId,
  selected,
  disabled,
  shared,
  holdActive,
  send,
}: {
  table: CockpitTable;
  seatId: string;
  selected: string[];
  disabled: boolean;
  shared: boolean;
  holdActive: boolean;
  send: (operation: R4bOperation, context?: ExpectedInteractionContext) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<CorrectionDraft | null>(null);
  const seat = table.seats.find((entry) => entry.id === seatId)!;
  const correctionUnavailable = disabled || (shared && !holdActive);
  const cards = draft?.objects.map((ref) => table.cards[ref.cardId]).filter(Boolean) ?? [];
  const movable = Boolean(
    draft?.objects.length &&
      cards.length === draft.objects.length &&
      cards.every((card) => card.zone !== 'stack' && !card.isToken),
  );
  const battlefieldOnly = Boolean(
    draft?.objects.length &&
      cards.length === draft.objects.length &&
      cards.every((card) => card.zone === 'battlefield'),
  );
  const oneBattlefield =
    draft?.objects.length === 1 && cards[0]?.zone === 'battlefield' ? draft.objects[0] : null;

  function begin() {
    const objects = selected.flatMap((cardId) => {
      const card = table.cards[cardId];
      return card ? [{ cardId, objectId: objectIdOf(card) }] : [];
    });
    const first = objects.length === 1 ? table.cards[objects[0].cardId] : undefined;
    setDraft({
      context: captureExpectedInteractionContext(table),
      objects,
      to: 'graveyard',
      position: 'top',
      lifeValue: seat.life,
      counterName: '+1/+1',
      counterValue: first?.counters['+1/+1'] ?? 0,
      damageMarked: first?.damageMarked ?? 0,
      deathtouchDamage: first?.hasDeathtouchDamage ?? false,
    });
  }

  async function repair(operation: R4bRepairOperation) {
    if (!draft || correctionUnavailable) return false;
    return send(operation, draft.context);
  }

  return (
    <details className="cockpit-session__tools">
      <summary>盤面訂正（Correction）</summary>
      <p>
        既に現実で成立している状態とOneDeckが食い違う場合だけ使います。新しいゲームイベントや誘発は発生させません。
      </p>
      {shared && !holdActive && (
        <p role="status">共有卓の盤面訂正はHOLD中だけ開始できます。</p>
      )}
      {!draft ? (
        <button disabled={correctionUnavailable} onClick={begin}>
          盤面訂正を始める
        </button>
      ) : (
        <fieldset>
          <legend>訂正内容</legend>
          <p>開始時の処理Contextとカードobject identityに固定して確定します。</p>
          <label>
            {seat.label}の正しいライフ
            <input
              type="number"
              value={draft.lifeValue}
              onChange={(event) => setDraft({ ...draft, lifeValue: Number(event.target.value) })}
            />
          </label>
          <button
            disabled={correctionUnavailable}
            onClick={() => void repair({ type: 'repair.lifeTotal', seatId, value: draft.lifeValue })}
          >
            ライフ値を訂正
          </button>

          <label>
            正しい移動先
            <select
              value={draft.to}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value as Exclude<ZoneId, 'stack'> })
              }
            >
              {tableZones
                .filter((zone): zone is Exclude<ZoneId, 'stack'> => zone !== 'stack')
                .map((zone) => (
                  <option key={zone} value={zone}>
                    {zoneLabels[zone]}
                  </option>
                ))}
            </select>
          </label>
          <select
            aria-label="訂正時の移動順"
            value={draft.position}
            onChange={(event) =>
              setDraft({ ...draft, position: event.target.value as 'top' | 'bottom' })
            }
          >
            <option value="top">上へ</option>
            <option value="bottom">下へ</option>
          </select>
          <button
            disabled={correctionUnavailable || !movable}
            onClick={() =>
              void repair({
                type: 'repair.location',
                objects: draft.objects,
                to: draft.to,
                position: draft.position,
              })
            }
          >
            選択カードの所在を訂正
          </button>

          <button
            disabled={correctionUnavailable || !battlefieldOnly}
            onClick={() =>
              void repair({
                type: 'repair.tapState',
                objects: draft.objects.map((object) => ({ object, value: true })),
              })
            }
          >
            選択カードを「タップ状態」に訂正
          </button>
          <button
            disabled={correctionUnavailable || !battlefieldOnly}
            onClick={() =>
              void repair({
                type: 'repair.tapState',
                objects: draft.objects.map((object) => ({ object, value: false })),
              })
            }
          >
            選択カードを「アンタップ状態」に訂正
          </button>

          <label>
            カウンター名
            <input
              value={draft.counterName}
              onChange={(event) => setDraft({ ...draft, counterName: event.target.value })}
            />
          </label>
          <label>
            正しい個数
            <input
              type="number"
              min="0"
              value={draft.counterValue}
              onChange={(event) => setDraft({ ...draft, counterValue: Number(event.target.value) })}
            />
          </label>
          <button
            disabled={correctionUnavailable || !oneBattlefield || !draft.counterName.trim()}
            onClick={() =>
              oneBattlefield &&
              void repair({
                type: 'repair.counterCount',
                target: { kind: 'card', object: oneBattlefield },
                name: draft.counterName,
                value: draft.counterValue,
              })
            }
          >
            選択1枚のカウンター数を訂正
          </button>

          <label>
            正しい記録ダメージ
            <input
              type="number"
              min="0"
              value={draft.damageMarked}
              onChange={(event) => setDraft({ ...draft, damageMarked: Number(event.target.value) })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.deathtouchDamage}
              onChange={(event) =>
                setDraft({ ...draft, deathtouchDamage: event.target.checked })
              }
            />
            接死ダメージを受けた記録
          </label>
          <button
            disabled={correctionUnavailable || !oneBattlefield}
            onClick={() =>
              oneBattlefield &&
              void repair({
                type: 'repair.damageState',
                object: oneBattlefield,
                value: {
                  damageMarked: draft.damageMarked,
                  hasDeathtouchDamage: draft.deathtouchDamage,
                },
              })
            }
          >
            選択1枚の記録ダメージを訂正
          </button>

          <p>既に引いたカードの所在違いは「所在を訂正」で手札へ移します。新しく1枚引く操作はManual Eventです。</p>
          <button onClick={() => setDraft(null)}>盤面訂正を終える</button>
        </fieldset>
      )}
    </details>
  );
}
