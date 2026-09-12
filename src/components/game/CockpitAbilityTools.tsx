import { useState } from 'react';
import {
  tableAbilityChoices,
  emptyManualCosts,
  type TableManualCosts,
} from '../../engine/cockpitAbilities';
import {
  tableActivationPayment,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import { cockpitCostText } from './cockpitCostText';

export function CockpitAbilityTools({
  table,
  sourceId,
  selected,
  disabled,
  send,
  expanded = false,
}: {
  table: CockpitTable;
  sourceId: string;
  selected: string[];
  disabled: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
  expanded?: boolean;
}) {
  const choices = tableAbilityChoices(table, sourceId);
  const [key, setKey] = useState(choices[0]?.key ?? 'manual');
  const [manual, setManual] = useState(false);
  const [costs, setCosts] = useState<TableManualCosts>(emptyManualCosts);
  const [text, setText] = useState('');
  const [targetSeats, setTargetSeats] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [proposal, setProposal] = useState<Extract<TableOperation, { type: 'activate' }> | null>(
    null,
  );
  const [error, setError] = useState('');
  const choice = choices.find((item) => item.key === key);
  const useManual = manual || choice?.manual || key === 'manual';
  let automaticProposal: typeof proposal = null;
  let paymentError = '';
  if (choice && !useManual) {
    try {
      automaticProposal = {
        type: 'activate',
        id: '',
        sourceId,
        choice: key,
        text,
        targets: [...targets, ...targetSeats],
        manualCosts: null,
        paymentPlan: tableActivationPayment(table, sourceId, key, null).paid,
      };
    } catch (error) {
      paymentError = error instanceof Error ? error.message : 'コストを支払えません。';
    }
  }
  const shownProposal = automaticProposal ?? proposal;
  const name = (id: string) => {
    const entry = table.stack.find((entry) => entry.id === id);
    const def = table.defs[table.cards[id]?.defId ?? entry?.source.defId ?? ''];
    return def?.printedName ?? def?.name ?? table.seats.find((seat) => seat.id === id)?.label ?? id;
  };
  return (
    <details open={expanded || undefined}>
      <summary>能力を起動・誘発させる</summary>
      <p>
        発生源:《{name(sourceId)}
        》。コストを支払ってスタックに置きます。解決時の効果は手動です。
      </p>
      <label>
        能力{' '}
        <select
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
            setManual(false);
            setCosts(emptyManualCosts());
            setProposal(null);
            setConfirmed(false);
          }}
        >
          {choices.map((item) => (
            <option key={item.key} value={item.key}>
              {item.costText}
            </option>
          ))}
          <option value="manual">手動で起動型能力を登録</option>
          <option value="triggered">手動で誘発型能力を登録</option>
        </select>
      </label>
      <p style={{ whiteSpace: 'pre-wrap' }}>{choice?.text}</p>
      <p>必要なコスト: {choice?.costText ?? '本文で確認してください。'}</p>
      {!choice && (
        <label>
          登録する能力本文{' '}
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setProposal(null);
            }}
          />
        </label>
      )}
      {key !== 'triggered' && (
        <label>
          <input
            type="checkbox"
            checked={Boolean(useManual)}
            disabled={choice?.manual || key === 'manual'}
            onChange={(event) => {
              setManual(event.target.checked);
              setProposal(null);
            }}
          />
          コストを手動で指定する（未対応条件は本文で判断）
        </label>
      )}
      {useManual && (
        <fieldset>
          <legend>今回一度だけ支払うコスト</legend>
          <label>
            マナコスト{' '}
            <input
              placeholder="{2}{U}"
              value={costs.manaCost}
              onChange={(event) => {
                setCosts({ ...costs, manaCost: event.target.value });
                setProposal(null);
              }}
            />
          </label>
          <label>
            支払うライフ{' '}
            <input
              type="number"
              min="0"
              value={costs.life}
              onChange={(event) => {
                setCosts({ ...costs, life: Number(event.target.value) });
                setProposal(null);
              }}
            />
          </label>
          {(
            [
              ['tapIds', 'タップ'],
              ['sacrificeIds', '生け贄'],
              ['discardIds', '捨てる'],
              ['returnIds', '手札へ戻す'],
              ['exileIds', '追放'],
            ] as const
          ).map(([field, label]) => (
            <p key={field}>
              <button
                onClick={() => {
                  setCosts({ ...costs, [field]: [...selected] });
                  setProposal(null);
                }}
              >
                盤面の選択を「{label}」に指定
              </button>{' '}
              {costs[field].map((id) => `《${name(id)}》`).join('、') || 'なし'}
            </p>
          ))}
          <fieldset>
            <legend>取り除くカウンター（発生源・選択したカード）</legend>
            {[
              ...new Set([sourceId, ...selected, ...costs.counters.map((cost) => cost.cardId)]),
            ].flatMap((cardId) =>
              Object.entries(table.cards[cardId]?.counters ?? {}).map(
                ([counterName, available]) => (
                  <label key={`${cardId}:${counterName}`}>
                    《{name(cardId)}》 {counterName}（現在{available}）
                    <input
                      type="number"
                      min="0"
                      max={available}
                      value={
                        costs.counters.find(
                          (cost) => cost.cardId === cardId && cost.name === counterName,
                        )?.count ?? 0
                      }
                      onChange={(event) => {
                        const count = Number(event.target.value);
                        setCosts({
                          ...costs,
                          counters: [
                            ...costs.counters.filter(
                              (cost) => cost.cardId !== cardId || cost.name !== counterName,
                            ),
                            ...(count > 0 ? [{ cardId, name: counterName, count }] : []),
                          ],
                        });
                        setProposal(null);
                      }}
                    />
                  </label>
                ),
              ),
            )}
          </fieldset>
          <label>
            コストについてのメモ{' '}
            <input
              value={costs.note}
              onChange={(event) => {
                setCosts({ ...costs, note: event.target.value });
                setProposal(null);
              }}
            />
          </label>
          <p>
            既に別操作で払った分は再指定せず、確認記録へ残してください。乱数や特殊条件は必要な基本操作で先に確定し、二重に払いません。
          </p>
        </fieldset>
      )}
      <button
        onClick={() => {
          setTargets([...selected]);
          setProposal(null);
        }}
      >
        盤面の選択を対象にする
      </button>
      <p>カード対象: {targets.map((id) => `《${name(id)}》`).join('、') || 'なし'}</p>
      {table.stack.map((entry, index) => (
        <label key={entry.id}>
          <input
            type="checkbox"
            checked={targets.includes(entry.id)}
            onChange={(event) => {
              setTargets(
                event.target.checked
                  ? [...targets, entry.id]
                  : targets.filter((id) => id !== entry.id),
              );
              setProposal(null);
            }}
          />
          スタック {index + 1}: 《{name(entry.source.id)}》を対象にする
        </label>
      ))}
      {table.seats.map((seat) => (
        <label key={seat.id}>
          <input
            type="checkbox"
            checked={targetSeats.includes(seat.id)}
            onChange={() => {
              setTargetSeats(
                targetSeats.includes(seat.id)
                  ? targetSeats.filter((id) => id !== seat.id)
                  : [...targetSeats, seat.id],
              );
              setProposal(null);
            }}
          />
          対象: {seat.label}
        </label>
      ))}
      <label hidden={!useManual && !!choice}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        対象と起動条件を確認した
      </label>
      <button
        hidden={!useManual && !!choice}
        disabled={disabled || !confirmed || (!choice && !text.trim())}
        onClick={() => {
          try {
            const manualCosts = useManual ? costs : null;
            const payment = tableActivationPayment(table, sourceId, key, manualCosts);
            setProposal({
              type: 'activate',
              id: crypto.randomUUID(),
              sourceId,
              choice: key,
              text,
              targets: [...targets, ...targetSeats],
              manualCosts: manualCosts ? structuredClone(manualCosts) : null,
              paymentPlan: payment.paid,
            });
            setError('');
          } catch (error) {
            setError(error instanceof Error ? error.message : '支払い案を作れません。');
          }
        }}
      >
        支払うコストを確認
      </button>
      {error && <p role="alert">{error}</p>}
      {paymentError && <p role="alert">{paymentError}</p>}
      {shownProposal && (
        <section aria-label="能力の確定内容">
          <ul>
            {shownProposal.paymentPlan.map((command, index) => (
              <li key={index}>{cockpitCostText(command, name)}</li>
            ))}
          </ul>
          <p>対象: {shownProposal.targets.map(name).join('、') || 'なし'}</p>
          <button
            disabled={disabled || (!automaticProposal && !confirmed)}
            onClick={() =>
              void send({ ...shownProposal, id: crypto.randomUUID() }).then((saved) => {
                if (saved) {
                  setProposal(null);
                  setConfirmed(false);
                }
              })
            }
          >
            コストを支払って起動する
          </button>
          {!automaticProposal && <button onClick={() => setProposal(null)}>選び直す</button>}
        </section>
      )}
    </details>
  );
}
