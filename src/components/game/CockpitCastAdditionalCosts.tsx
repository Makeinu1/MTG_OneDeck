import type { CockpitTable } from '../../engine/cockpitTable';
import type { R4CastAdditionalCosts } from '../../engine/cockpitR4';

const moveKeys = ['sacrificeIds', 'discardIds', 'returnIds', 'exileIds'] as const;
type MoveKey = (typeof moveKeys)[number];

function withoutId(costs: R4CastAdditionalCosts, id: string): R4CastAdditionalCosts {
  return {
    ...costs,
    sacrificeIds: costs.sacrificeIds.filter((item) => item !== id),
    discardIds: costs.discardIds.filter((item) => item !== id),
    returnIds: costs.returnIds.filter((item) => item !== id),
    exileIds: costs.exileIds.filter((item) => item !== id),
  };
}

export function CockpitCastAdditionalCosts({
  table,
  castCardId,
  selected,
  costs,
  disabled,
  label,
  onChange,
}: {
  table: CockpitTable;
  castCardId: string;
  selected: string[];
  costs: R4CastAdditionalCosts;
  disabled: boolean;
  label: (id: string) => string;
  onChange: (costs: R4CastAdditionalCosts) => void;
}) {
  const candidates = selected
    .filter((id) => id !== castCardId)
    .map((id) => table.cards[id])
    .filter((card) => Boolean(card));
  const moveKeyFor = (id: string): MoveKey | null =>
    moveKeys.find((key) => costs[key].includes(id)) ?? null;
  const setMove = (id: string, key: MoveKey, checked: boolean) => {
    const next = withoutId(costs, id);
    onChange(checked ? { ...next, [key]: [...next[key], id] } : next);
  };
  const setTap = (id: string, checked: boolean) =>
    onChange({
      ...costs,
      tapIds: checked
        ? [...new Set([...costs.tapIds, id])]
        : costs.tapIds.filter((item) => item !== id),
    });
  const setCounter = (cardId: string, name: string, count: number) => {
    const counters = costs.counters.filter(
      (cost) => !(cost.cardId === cardId && cost.name === name),
    );
    if (Number.isSafeInteger(count) && count > 0) counters.push({ cardId, name, count });
    onChange({ ...costs, counters });
  };

  return (
    <details className="table-cast-adjust">
      <summary>追加コストを同時に支払う</summary>
      <p>
        この「唱える」と同じ確定操作で支払います。対象カードは先に盤面・領域で選択してください。ここにない処理を代用するための自由入力ではありません。
      </p>
      <label>
        支払うライフ
        <input
          type="number"
          min="0"
          max="100000"
          value={costs.life}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...costs, life: Math.max(0, Number(event.target.value) || 0) })
          }
        />
      </label>
      <label>
        追加コストの確認記録
        <input
          value={costs.note}
          maxLength={2000}
          disabled={disabled}
          placeholder="例: 追加コストとしてカード1枚を捨てる"
          onChange={(event) => onChange({ ...costs, note: event.target.value })}
        />
      </label>
      {!candidates.length && <p>追加コストに使うカードを盤面・領域で選択してください。</p>}
      {candidates.map((card) => {
        const moveKey = moveKeyFor(card.id);
        const counterCosts = new Map(
          costs.counters
            .filter((cost) => cost.cardId === card.id)
            .map((cost) => [cost.name, cost.count]),
        );
        return (
          <fieldset key={card.id}>
            <legend>
              《{label(card.id)}》 · {card.zone}
            </legend>
            {card.zone === 'battlefield' && (
              <label>
                <input
                  type="checkbox"
                  checked={costs.tapIds.includes(card.id)}
                  disabled={disabled || card.tapped}
                  onChange={(event) => setTap(card.id, event.target.checked)}
                />
                タップする
              </label>
            )}
            {card.zone === 'battlefield' && (
              <label>
                <input
                  type="checkbox"
                  checked={moveKey === 'sacrificeIds'}
                  disabled={disabled}
                  onChange={(event) => setMove(card.id, 'sacrificeIds', event.target.checked)}
                />
                生け贄に捧げる
              </label>
            )}
            {card.zone === 'hand' && (
              <label>
                <input
                  type="checkbox"
                  checked={moveKey === 'discardIds'}
                  disabled={disabled}
                  onChange={(event) => setMove(card.id, 'discardIds', event.target.checked)}
                />
                捨てる
              </label>
            )}
            {card.zone === 'battlefield' && (
              <label>
                <input
                  type="checkbox"
                  checked={moveKey === 'returnIds'}
                  disabled={disabled}
                  onChange={(event) => setMove(card.id, 'returnIds', event.target.checked)}
                />
                手札へ戻す
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={moveKey === 'exileIds'}
                disabled={disabled || card.zone === 'stack'}
                onChange={(event) => setMove(card.id, 'exileIds', event.target.checked)}
              />
              追放する
            </label>
            {Object.entries(card.counters).map(([name, maximum]) => (
              <label key={name}>
                {name}カウンターを取り除く
                <input
                  type="number"
                  min="0"
                  max={maximum}
                  value={counterCosts.get(name) ?? 0}
                  disabled={disabled}
                  onChange={(event) =>
                    setCounter(card.id, name, Math.max(0, Number(event.target.value) || 0))
                  }
                />
                / {maximum}
              </label>
            ))}
          </fieldset>
        );
      })}
    </details>
  );
}
