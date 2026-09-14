import { useState } from 'react';
import {
  endsWithTableTurn,
  tableCleanupNeedsReview,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import { Modal } from '../Modal';
export function CockpitCleanupTools({
  table,
  seatId,
  selected,
  disabled,
  send,
  autoOpen = false,
  onClose,
  handCount,
}: {
  autoOpen?: boolean;
  onClose?: () => void;
  handCount?: number;
  table: CockpitTable;
  seatId: string;
  selected: string[];
  disabled: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
}) {
  const initialDraft = (): Extract<TableOperation, { type: 'cleanup' }> => ({
    type: 'cleanup',
    seatId,
    damageIds: Object.values(table.cards)
      .filter((card) => card.damageMarked > 0 || card.hasDeathtouchDamage)
      .map((card) => card.id),
    discardIds: [],
    grantIds: table.grants
      .filter((grant) => endsWithTableTurn(grant.duration))
      .map((grant) => grant.id),
    modifierIds: table.modifiers
      .filter((modifier) => endsWithTableTurn(modifier.duration))
      .map((modifier) => modifier.id),
  });
  const [draft, setDraft] = useState<Extract<TableOperation, { type: 'cleanup' }> | null>(() =>
    autoOpen ? initialDraft() : null,
  );
  const [reviewedKey, setReviewedKey] = useState<string | null>(null);
  const close = () => {
    setDraft(null);
    onClose?.();
  };
  const seat = table.seats.find((entry) => entry.id === seatId)!;
  const required =
    seat.eliminated || seat.maximumHandSize === null
      ? 0
      : Math.max(0, (handCount ?? seat.zones.hand.length) - seat.maximumHandSize);
  const unknownEffects = tableCleanupNeedsReview(table, 0);
  const reviewKey = JSON.stringify([table.grants, table.modifiers, required]);
  const reviewed = reviewedKey === reviewKey;
  const selectionValid =
    draft &&
    draft.discardIds.length === required &&
    draft.discardIds.every((id) => seat.zones.hand.includes(id));
  const name = (id: string) => {
    const def = table.defs[table.cards[id]?.defId];
    return def?.printedName ?? def?.name ?? id;
  };
  const toggle = (field: 'damageIds' | 'grantIds' | 'modifierIds', id: string) =>
    draft &&
    setDraft({
      ...draft,
      [field]: draft[field].includes(id)
        ? draft[field].filter((value) => value !== id)
        : [...draft[field], id],
    });
  return (
    <>
      <button
        hidden={autoOpen}
        disabled={
          disabled ||
          table.phase !== 'cleanup' ||
          table.hold ||
          Boolean(table.combat) ||
          Boolean(table.resolution) ||
          table.stack.length > 0
        }
        onClick={() => setDraft(initialDraft())}
      >
        ターン終了時の確認
      </button>
      {draft && (
        <Modal title="手札調整・ダメージ・期限の確認" onClose={close} allowBoardPeek>
          <p>
            {seat.label}の手札 {handCount ?? seat.zones.hand.length}枚 / 上限{' '}
            {seat.maximumHandSize ?? 'なし'}
            。必要枚数: {required}
            。本文による上限変更がある場合は人が判断してください。
          </p>
          <fieldset>
            <legend>捨てる手札を選択（必要{required}枚）</legend>
            {seat.zones.hand.map((id) => (
              <label key={id}>
                <input
                  type="checkbox"
                  aria-label={`捨てる：${name(id)}`}
                  checked={draft.discardIds.includes(id)}
                  onChange={() =>
                    setDraft({
                      ...draft,
                      discardIds: draft.discardIds.includes(id)
                        ? draft.discardIds.filter((value) => value !== id)
                        : [...draft.discardIds, id],
                    })
                  }
                />
                《{name(id)}》
              </label>
            ))}
            {required > seat.zones.hand.length && (
              <p>この席の手札は非公開です。本人へ操作権を渡して選択してください。</p>
            )}
          </fieldset>
          <p>
            完了時に全席の記録ダメージと、明示された「ターン終了まで」の効果を解除します。その他の期限は選択して確認してください。
          </p>
          <button
            onClick={() =>
              setDraft({
                ...draft,
                discardIds: selected.filter((id) => seat.zones.hand.includes(id)),
              })
            }
          >
            盤面で選んだ手札を捨てる対象に指定
          </button>
          <p>手札調整: {draft.discardIds.map(name).join('、') || '指定なし'}</p>
          <fieldset>
            <legend>消去する記録ダメージ</legend>
            {Object.values(table.cards)
              .filter((card) => card.damageMarked > 0 || card.hasDeathtouchDamage)
              .map((card) => (
                <label key={card.id}>
                  <input type="checkbox" checked disabled readOnly />《{name(card.id)}》: 記録{' '}
                  {card.damageMarked}
                  {card.hasDeathtouchDamage ? '・接死の記録' : ''} — ターン終了の消去
                </label>
              ))}
          </fieldset>
          <fieldset>
            <legend>期限・由来を確認して解除する修整</legend>
            {table.modifiers.map((modifier) => (
              <label key={modifier.id}>
                <input
                  type="checkbox"
                  disabled={endsWithTableTurn(modifier.duration)}
                  checked={draft.modifierIds.includes(modifier.id)}
                  onChange={() => toggle('modifierIds', modifier.id)}
                />
                《{name(modifier.cardId)}》 {modifier.power}/{modifier.toughness} /{' '}
                {modifier.duration} / 由来{' '}
                {modifier.sourceId ? name(modifier.sourceId) : '指定なし'}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>期限・由来を確認して解除するキーワード</legend>
            {table.grants.map((grant) => (
              <label key={grant.id}>
                <input
                  type="checkbox"
                  disabled={endsWithTableTurn(grant.duration)}
                  checked={draft.grantIds.includes(grant.id)}
                  onChange={() => toggle('grantIds', grant.id)}
                />
                《{name(grant.cardId)}》 {grant.keyword} {grant.value} / {grant.duration} / 由来{' '}
                {grant.sourceId ? name(grant.sourceId) : '指定なし'}
              </label>
            ))}
          </fieldset>
          {unknownEffects && (
            <label>
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(event) => setReviewedKey(event.target.checked ? reviewKey : null)}
              />
              期限不明の効果は解除対象と残す対象を確認した
            </label>
          )}
          <button
            disabled={
              disabled ||
              table.phase !== 'cleanup' ||
              table.hold ||
              Boolean(table.combat) ||
              Boolean(table.resolution) ||
              table.stack.length > 0 ||
              !selectionValid ||
              (unknownEffects && !reviewed)
            }
            onClick={() =>
              void send({ ...draft, complete: true, effectsReviewed: reviewed }).then((saved) => {
                if (saved) close();
              })
            }
          >
            クリーンナップを完了
          </button>
        </Modal>
      )}
    </>
  );
}
