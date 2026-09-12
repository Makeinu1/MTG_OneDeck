import { useState } from 'react';
import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
import { Modal } from '../Modal';
export function CockpitCleanupTools({
  table,
  seatId,
  selected,
  disabled,
  send,
}: {
  table: CockpitTable;
  seatId: string;
  selected: string[];
  disabled: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Extract<TableOperation, { type: 'cleanup' }> | null>(null);
  const seat = table.seats.find((entry) => entry.id === seatId)!;
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
        disabled={
          disabled ||
          table.phase !== 'cleanup' ||
          table.hold ||
          Boolean(table.combat) ||
          Boolean(table.resolution) ||
          table.stack.length > 0
        }
        onClick={() =>
          setDraft({
            type: 'cleanup',
            seatId,
            damageIds: [],
            grantIds: [],
            modifierIds: [],
            discardIds: [],
          })
        }
      >
        ターン終了時の確認
      </button>
      {draft && (
        <Modal title="手札調整・ダメージ・期限の確認" onClose={() => setDraft(null)} allowBoardPeek>
          <p>
            {seat.label}の手札 {seat.zones.hand.length}枚 / 上限 {seat.maximumHandSize ?? 'なし'}
            。必要枚数:{' '}
            {seat.maximumHandSize === null
              ? 0
              : Math.max(0, seat.zones.hand.length - seat.maximumHandSize)}
            。本文による上限変更がある場合は人が判断してください。
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
                  <input
                    type="checkbox"
                    checked={draft.damageIds.includes(card.id)}
                    onChange={() => toggle('damageIds', card.id)}
                  />
                  《{name(card.id)}》: 記録 {card.damageMarked}
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
                  checked={draft.grantIds.includes(grant.id)}
                  onChange={() => toggle('grantIds', grant.id)}
                />
                《{name(grant.cardId)}》 {grant.keyword} {grant.value} / {grant.duration} / 由来{' '}
                {grant.sourceId ? name(grant.sourceId) : '指定なし'}
              </label>
            ))}
          </fieldset>
          <button
            disabled={
              disabled ||
              table.phase !== 'cleanup' ||
              table.hold ||
              Boolean(table.combat) ||
              Boolean(table.resolution) ||
              table.stack.length > 0
            }
            onClick={() =>
              void send(draft).then((saved) => {
                if (saved) setDraft(null);
              })
            }
          >
            選んだ調整・解除を確定
          </button>
        </Modal>
      )}
    </>
  );
}
