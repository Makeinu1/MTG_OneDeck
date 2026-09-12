import { useState } from 'react';
import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
import { Modal } from '../Modal';
import { CardView } from '../CardView';

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
export function CockpitSelectionTools({
  table,
  seatId,
  selected,
  disabled,
  send,
  browseLibrary,
}: {
  table: CockpitTable;
  seatId: string;
  selected: string[];
  disabled: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
  browseLibrary: () => void;
}) {
  const [count, setCount] = useState(2);
  const [delta, setDelta] = useState(1);
  const [counter, setCounter] = useState('+1/+1');
  const [includeSeat, setIncludeSeat] = useState(false);
  const [arrange, setArrange] = useState<{
    seatId: string;
    kind: '占術' | '諜報';
    examined: string[];
    rows: { id: string; to: 'top' | 'bottom' | 'graveyard' }[];
  } | null>(null);
  const [proliferate, setProliferate] = useState<string[] | null>(null);
  const seat = table.seats.find((entry) => entry.id === seatId)!;
  const label = (id: string) => {
    const card = table.cards[id];
    const def = card && table.defs[card.defId];
    return (
      def?.printedName ?? def?.name ?? table.seats.find((entry) => entry.id === id)?.label ?? id
    );
  };
  const candidates = [
    ...table.seats.flatMap((entry) =>
      entry.zones.battlefield.map((id) => ({ id, counters: table.cards[id].counters })),
    ),
    ...table.seats,
  ].filter((entry) => Object.values(entry.counters).some((value) => value > 0));
  return (
    <>
      <details className="cockpit-session__tools">
        <summary>山札・カウンター・ライフ</summary>
        <p>
          {seat.label}
          の山札・手札・ライフを操作します。カードへの変更は、選択中のカードに適用します。
        </p>
        <label>
          枚数{' '}
          <input
            type="number"
            min="1"
            max="500"
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </label>
        {(['占術', '諜報'] as const).map((kind) => (
          <button
            key={kind}
            disabled={disabled || count < 1 || !seat.zones.library.length}
            onClick={() => {
              const examined = seat.zones.library.slice(0, count);
              setArrange({
                seatId,
                kind,
                examined,
                rows: examined.map((id) => ({ id, to: 'top' })),
              });
            }}
          >
            {kind}
          </button>
        ))}
        <button
          disabled={disabled || count < 1 || !seat.zones.library.length}
          onClick={() =>
            void send({
              type: 'move',
              ids: seat.zones.library.slice(0, count),
              to: 'graveyard',
              position: 'top',
            })
          }
        >
          切削
        </button>
        <button disabled={disabled} onClick={browseLibrary}>
          山札から探す
        </button>
        <button
          disabled={disabled}
          onClick={() => void send({ type: 'shuffle', seatId, seed: randomSeed() })}
        >
          山札をシャッフル
        </button>
        <button
          disabled={disabled || count < 1 || count > seat.zones.hand.length}
          onClick={() => void send({ type: 'randomDiscard', seatId, count, seed: randomSeed() })}
        >
          ランダムに捨てる
        </button>
        <button disabled={disabled} onClick={() => setProliferate([])}>
          増殖の候補を選ぶ
        </button>
        <hr />
        <label>
          変更量{' '}
          <input
            type="number"
            value={delta}
            onChange={(event) => setDelta(Number(event.target.value))}
          />
        </label>
        <label>
          カウンター名{' '}
          <input value={counter} onChange={(event) => setCounter(event.target.value)} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeSeat}
            onChange={(event) => setIncludeSeat(event.target.checked)}
          />
          {seat.label}にもカウンターを変更
        </label>
        <button
          disabled={disabled || (!selected.length && !includeSeat)}
          onClick={() =>
            void send({
              type: 'counter',
              ids: selected,
              seatIds: includeSeat ? [seatId] : [],
              name: counter,
              delta,
            })
          }
        >
          選んだカードのカウンターを増減
        </button>
        <button
          disabled={disabled || !selected.length}
          onClick={() => void send({ type: 'damage', ids: selected, delta })}
        >
          選んだカードのダメージを増減
        </button>
        <button
          disabled={disabled}
          onClick={() => void send({ type: 'life', seatIds: [seatId], delta })}
        >
          {seat.label}のライフを増減
        </button>
      </details>
      {arrange && (
        <Modal
          title={`${arrange.kind}・上から${arrange.examined.length}枚`}
          width="lg"
          onClose={() => setArrange(null)}
          allowBoardPeek
        >
          <ol className="table-arrange-cards">
            {arrange.rows.map((row, index) => (
              <li key={row.id}>
                <CardView
                  instance={table.cards[row.id]}
                  def={table.defs[table.cards[row.id].defId]}
                  size="hand"
                  draggable={false}
                />
                <details>
                  <summary>《{label(row.id)}》の本文</summary>
                  <p>
                    {table.defs[table.cards[row.id].defId].faces[table.cards[row.id].faceIndex]
                      .printedText ??
                      table.defs[table.cards[row.id].defId].faces[table.cards[row.id].faceIndex]
                        .oracleText}
                  </p>
                </details>
                <select
                  aria-label={`${label(row.id)}の行き先`}
                  value={row.to}
                  onChange={(event) =>
                    setArrange({
                      ...arrange,
                      rows: arrange.rows.map((item) =>
                        item.id === row.id
                          ? { ...item, to: event.target.value as typeof row.to }
                          : item,
                      ),
                    })
                  }
                >
                  <option value="top">山札の上</option>
                  {arrange.kind === '占術' ? (
                    <option value="bottom">山札の下</option>
                  ) : (
                    <option value="graveyard">墓地</option>
                  )}
                </select>
                <button
                  aria-label={`《${label(row.id)}》の順序を上へ`}
                  title="順序を上へ"
                  disabled={index === 0}
                  onClick={() => {
                    const rows = [...arrange.rows];
                    [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
                    setArrange({ ...arrange, rows });
                  }}
                >
                  ↑
                </button>
              </li>
            ))}
          </ol>
          <button
            disabled={disabled}
            onClick={() =>
              void send({
                type: 'arrange',
                seatId: arrange.seatId,
                examined: arrange.examined,
                top: arrange.rows.filter((row) => row.to === 'top').map((row) => row.id),
                bottom: arrange.rows.filter((row) => row.to === 'bottom').map((row) => row.id),
                graveyard: arrange.rows
                  .filter((row) => row.to === 'graveyard')
                  .map((row) => row.id),
              }).then((saved) => {
                if (saved) setArrange(null);
              })
            }
          >
            整理を確定
          </button>
        </Modal>
      )}
      {proliferate && (
        <Modal title="増殖する対象を選択" onClose={() => setProliferate(null)} allowBoardPeek>
          <p>選んだパーマネント・席の、既にある各種類のカウンターを1個増やします。</p>
          {candidates.map((entry) => (
            <label key={entry.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={proliferate.includes(entry.id)}
                onChange={() =>
                  setProliferate(
                    proliferate.includes(entry.id)
                      ? proliferate.filter((id) => id !== entry.id)
                      : [...proliferate, entry.id],
                  )
                }
              />
              {label(entry.id)}:{' '}
              {Object.entries(entry.counters)
                .filter(([, value]) => value > 0)
                .map(([name, value]) => `${name} ${value}`)
                .join(' / ')}
            </label>
          ))}
          <button
            disabled={disabled || !proliferate.length}
            onClick={() =>
              void send({
                type: 'proliferate',
                ids: proliferate.filter((id) => Object.hasOwn(table.cards, id)),
                seatIds: proliferate.filter((id) => table.seats.some((entry) => entry.id === id)),
              }).then((saved) => {
                if (saved) setProliferate(null);
              })
            }
          >
            選んだ対象に増殖
          </button>
        </Modal>
      )}
    </>
  );
}
