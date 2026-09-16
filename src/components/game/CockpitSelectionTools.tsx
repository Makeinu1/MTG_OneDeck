import { useState } from 'react';
import { objectIdOf } from '../../engine/types';
import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
import type { R4TableOperation } from '../../engine/cockpitR4';
import {
  captureExpectedInteractionContext,
  type ExpectedInteractionContext,
} from '../../engine/cockpitR31';
import { Modal } from '../Modal';
import { CardView } from '../CardView';
import { hasCockpitLibraryAccess, type CockpitLibraryAccess } from './cockpitLibraryAccess';

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
export function CockpitSelectionTools({
  table,
  seatId,
  selected,
  disabled,
  send,
  browseLibrary,
  libraryAccess,
}: {
  table: CockpitTable;
  seatId: string;
  selected: string[];
  disabled: boolean;
  send: (
    operation: TableOperation | R4TableOperation,
    context?: ExpectedInteractionContext,
  ) => Promise<boolean>;
  browseLibrary: () => void;
  libraryAccess?: CockpitLibraryAccess;
}) {
  const [count, setCount] = useState(2);
  const [delta, setDelta] = useState(1);
  const [damageSource, setDamageSource] = useState('');
  const [damageSeat, setDamageSeat] = useState('');
  const damageSources = [
    ...new Map(
      [
        ...(table.resolution ? [table.resolution.source] : []),
        ...Object.values(table.cards).filter((c) => c.zone === 'battlefield'),
      ].map((c) => [`${c.id}:${c.zoneChangeCounter}`, c]),
    ).entries(),
  ];
  const [counter, setCounter] = useState('+1/+1');
  const [includeSeat, setIncludeSeat] = useState(false);
  const [arrange, setArrange] = useState<{
    seatId: string;
    kind: '占術' | '諜報';
    examined: string[];
    objectIds: string[];
    invalidated?: boolean;
    peekOwned?: boolean;
    context: ExpectedInteractionContext;
    rows: { id: string; to: 'top' | 'bottom' | 'graveyard' }[];
  } | null>(null);
  const [proliferate, setProliferate] = useState<{
    ids: string[];
    context: ExpectedInteractionContext;
  } | null>(null);
  const [libraryStatus, setLibraryStatus] = useState<'idle' | 'loading' | 'rejected' | 'empty'>(
    'idle',
  );
  const seat = table.seats.find((entry) => entry.id === seatId)!;
  const stateActionReady =
    selected.length > 0 &&
    selected.every((id) => table.cards[id]?.zone === 'battlefield' && !table.cards[id].isToken);
  const arrangeSeat = table.seats.find((entry) => entry.id === arrange?.seatId);
  const arrangementMatches = Boolean(
    arrange &&
    arrange.seatId === seatId &&
    arrangeSeat &&
    !arrangeSeat.eliminated &&
    (!libraryAccess ||
      (libraryAccess.seatId === arrange.seatId &&
        hasCockpitLibraryAccess(libraryAccess, arrange.examined.length))) &&
    arrange.examined.every((id, index) => {
      const card = table.cards[id];
      return (
        arrangeSeat.zones.library[index] === id &&
        card?.zone === 'library' &&
        card.ownerId === arrange.seatId &&
        objectIdOf(card) === arrange.objectIds[index] &&
        Boolean(table.defs[card.defId])
      );
    }),
  );
  const arrangementValid = arrangementMatches && !arrange?.invalidated;
  // Invalidate before rendering candidates. Do not retain private card contents,
  // and never reactivate a discarded choice when the old IDs become visible again.
  if (arrange && !arrange.invalidated && !arrangementMatches)
    setArrange({ ...arrange, invalidated: true });

  function openArrange(
    source: CockpitTable,
    kind: '占術' | '諜報',
    context: ExpectedInteractionContext,
    peekOwned = false,
  ): boolean {
    const sourceSeat = source.seats.find((entry) => entry.id === seatId);
    const examined = sourceSeat?.zones.library.slice(0, count) ?? [];
    if (!examined.length) {
      setLibraryStatus('empty');
      return false;
    }
    setArrange({
      seatId,
      kind,
      examined,
      objectIds: examined.map((id) => objectIdOf(source.cards[id])),
      rows: examined.map((id) => ({ id, to: 'top' })),
      peekOwned,
      context,
    });
    setLibraryStatus('idle');
    return true;
  }

  async function startArrange(kind: '占術' | '諜報'): Promise<void> {
    const context = captureExpectedInteractionContext(table);
    if (!libraryAccess || hasCockpitLibraryAccess(libraryAccess, count)) {
      openArrange(table, kind, context);
      return;
    }
    setLibraryStatus('loading');
    const next = await libraryAccess.request(count);
    if (!next) {
      setLibraryStatus('rejected');
      return;
    }
    const nextSeat = next.seats.find((entry) => entry.id === seatId);
    if (!nextSeat?.zones.library.length) {
      setLibraryStatus('empty');
      await libraryAccess.release();
      return;
    }
    if (!openArrange(next, kind, context, true)) await libraryAccess.release();
  }

  async function mill(): Promise<void> {
    const context = captureExpectedInteractionContext(table);
    let source = table;
    let peekOwned = false;
    if (libraryAccess && !hasCockpitLibraryAccess(libraryAccess, count)) {
      setLibraryStatus('loading');
      const next = await libraryAccess.request(count);
      if (!next) {
        setLibraryStatus('rejected');
        return;
      }
      source = next;
      peekOwned = true;
    }
    const sourceSeat = source.seats.find((entry) => entry.id === seatId);
    const ids = sourceSeat?.zones.library.slice(0, count) ?? [];
    if (!ids.length) {
      setLibraryStatus('empty');
      if (peekOwned) await libraryAccess?.release();
      return;
    }
    setLibraryStatus('idle');
    await send(
      { type: 'move', ids, to: 'graveyard', position: 'top', reason: 'mill' },
      context,
    );
    if (peekOwned) await libraryAccess?.release();
  }

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
        <summary>状態起因処理</summary>
        <p>致死、タフネス0、忠誠度0などを人が確認した後、選択した実カードを同時に墓地へ移します。該当性はOneDeckが自動裁定しません。</p>
        <button
          disabled={disabled || table.hold || Boolean(table.resolution) || !stateActionReady}
          onClick={() =>
            void send(
              { type: 'state.apply', graveyardIds: [...selected] },
              captureExpectedInteractionContext(table),
            )
          }
        >
          選択したカードを状態起因処理で墓地へ
        </button>
        {selected.some((id) => table.cards[id]?.isToken) && (
          <p role="status">トークンの消滅を含む状態起因処理は後続拡張です。</p>
        )}
      </details>
      <details className="cockpit-session__tools">
        <summary>ゲーム中に今行う操作（Manual Event）</summary>
        <p>
          {seat.label}
          の効果・手動処理を今ゲーム上で行います。既に起きた現実へ盤面を合わせる場合は「盤面訂正」を使ってください。
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
            hidden={!table.resolution}
            disabled={disabled || count < 1 || libraryStatus === 'loading'}
            onClick={() => void startArrange(kind)}
          >
            {kind}
          </button>
        ))}
        <button
          disabled={disabled || count < 1 || libraryStatus === 'loading'}
          onClick={() => void mill()}
        >
          切削
        </button>
        {libraryStatus !== 'idle' && (
          <p role="status">
            {libraryStatus === 'loading'
              ? '必要な範囲の山札を取得中です。'
              : libraryStatus === 'rejected'
                ? '山札を取得できませんでした。操作権と接続状態を確認して再試行してください。'
                : '山札を取得しましたが0枚です。'}
          </p>
        )}
        <button disabled={disabled} onClick={browseLibrary}>
          山札から探す
        </button>
        {!table.resolution && (
          <p>占術・諜報・シャッフル・ランダムDiscard・増殖は現在のResolution中だけ利用できます。</p>
        )}
        <button
          hidden={!table.resolution}
          disabled={disabled}
          onClick={() => void send({ type: 'shuffle', seatId, seed: randomSeed() })}
        >
          山札をシャッフル
        </button>
        <button
          hidden={!table.resolution}
          disabled={disabled || count < 1 || count > seat.zones.hand.length}
          onClick={() => void send({ type: 'randomDiscard', seatId, count, seed: randomSeed() })}
        >
          ランダムに捨てる
        </button>
        <button
          hidden={!table.resolution}
          disabled={disabled}
          onClick={() =>
            setProliferate({ ids: [], context: captureExpectedInteractionContext(table) })
          }
        >
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
        <details>
          <summary>発生源を指定してダメージ</summary>
          <label>
            発生源
            <select value={damageSource} onChange={(e) => setDamageSource(e.target.value)}>
              <option value="">選択</option>
              {damageSources.map(([id, card]) => (
                <option key={id} value={id}>
                  《{label(card.id)}》
                </option>
              ))}
            </select>
          </label>
          <label>
            プレイヤー対象
            <select value={damageSeat} onChange={(e) => setDamageSeat(e.target.value)}>
              <option value="">なし</option>
              {table.seats.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <p>選択中のカードとプレイヤーへ、軽減・置換を確認した後の点数を反映</p>
          <button
            disabled={disabled || delta <= 0 || !damageSource || (!selected.length && !damageSeat)}
            onClick={() => {
              const source = damageSources.find(([id]) => id === damageSource)?.[1];
              if (source)
                void send({
                  type: 'damage',
                  ids: selected,
                  seatIds: damageSeat ? [damageSeat] : [],
                  sourceId: source.id,
                  sourceObjectId: damageSource,
                  delta,
                });
            }}
          >
            ダメージを与える
          </button>
        </details>
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
          onClose={() => {
            const release = Boolean(
              arrange.peekOwned &&
              libraryAccess &&
              hasCockpitLibraryAccess(libraryAccess, arrange.examined.length),
            );
            setArrange(null);
            if (release) void libraryAccess?.release();
          }}
          allowBoardPeek
          blockGameShortcuts
        >
          {!arrangementValid && (
            <p role="status">
              山札の順序・カード・閲覧権限が変わりました。閉じてから選び直してください。
            </p>
          )}
          {arrangementValid && (
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
          )}
          <button
            disabled={disabled || !arrangementValid}
            onClick={() =>
              void send(
                {
                  type: 'arrange',
                  seatId: arrange.seatId,
                  examined: arrange.examined,
                  top: arrange.rows.filter((row) => row.to === 'top').map((row) => row.id),
                  bottom: arrange.rows.filter((row) => row.to === 'bottom').map((row) => row.id),
                  graveyard: arrange.rows
                    .filter((row) => row.to === 'graveyard')
                    .map((row) => row.id),
                },
                arrange.context,
              ).then((saved) => {
                if (!saved) return;
                const release = Boolean(
                  arrange.peekOwned &&
                  libraryAccess &&
                  hasCockpitLibraryAccess(libraryAccess, arrange.examined.length),
                );
                setArrange(null);
                if (release) void libraryAccess?.release();
              })
            }
          >
            整理を確定
          </button>
        </Modal>
      )}
      {proliferate && (
        <Modal
          title="増殖する対象を選択"
          onClose={() => setProliferate(null)}
          allowBoardPeek
          blockGameShortcuts
        >
          <p>選んだパーマネント・席の、既にある各種類のカウンターを1個増やします。</p>
          {candidates.map((entry) => (
            <label key={entry.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={proliferate.ids.includes(entry.id)}
                onChange={() =>
                  setProliferate({
                    ...proliferate,
                    ids: proliferate.ids.includes(entry.id)
                      ? proliferate.ids.filter((id) => id !== entry.id)
                      : [...proliferate.ids, entry.id],
                  })
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
            disabled={disabled || !proliferate.ids.length}
            onClick={() =>
              void send(
                {
                  type: 'proliferate',
                  ids: proliferate.ids.filter((id) => Object.hasOwn(table.cards, id)),
                  seatIds: proliferate.ids.filter((id) =>
                    table.seats.some((entry) => entry.id === id),
                  ),
                },
                proliferate.context,
              ).then((saved) => {
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
