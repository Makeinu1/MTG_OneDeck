import { useState } from 'react';
import { objectIdOf } from '../../engine/types';
import {
  tableFetchAbility,
  type CockpitTable,
  type TableOperation,
  type TableStackEntry,
} from '../../engine/cockpitTable';
import { CardView } from '../CardView';
import { CockpitWorkPanel } from './CockpitWorkPanel';
import { hasCockpitLibraryAccess, type CockpitLibraryAccess } from './cockpitLibraryAccess';

/** Uncommitted choice only: movement, shuffle and completion are one server operation. */
export function CockpitFetchSearch({
  table,
  entry,
  disabled,
  send,
  onClose,
  libraryAccess,
}: {
  table: CockpitTable;
  entry: TableStackEntry;
  disabled: boolean;
  send: (op: TableOperation) => Promise<boolean>;
  onClose: () => void;
  libraryAccess?: CockpitLibraryAccess;
}) {
  const ability = tableFetchAbility(table, entry)!;
  const seat = table.seats.find((item) => item.id === entry.controllerId)!;
  const face = (id: string) => table.defs[table.cards[id].defId].faces[table.cards[id].faceIndex];
  const lands = Object.values(table.cards).filter(
    (card) =>
      card.zone === 'battlefield' &&
      card.controllerId === seat.id &&
      /\bLand\b/.test(face(card.id).typeLine),
  ).length;
  const [tapped, setTapped] = useState(
    ability.entersTapped &&
      !(ability.untapIfControlLandsAtLeast && lands + 1 >= ability.untapIfControlLandsAtLeast),
  );
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<{ id: string; objectId: string } | null>(null);
  const [accessRequest, setAccessRequest] = useState<'idle' | 'loading' | 'rejected'>('idle');
  const [ownsAccess, setOwnsAccess] = useState(false);
  const accessReady = hasCockpitLibraryAccess(libraryAccess);
  const selectedId =
    selected &&
    accessReady &&
    seat.zones.library.includes(selected.id) &&
    table.cards[selected.id]?.zone === 'library' &&
    objectIdOf(table.cards[selected.id]) === selected.objectId
      ? selected.id
      : null;
  if (selected && !selectedId) setSelected(null);

  const ids = accessReady
    ? seat.zones.library.filter((id) => {
        const def = table.defs[table.cards[id].defId];
        const type = face(id).typeLine;
        if (!/\bLand\b/.test(type)) return false;
        if (!all && ability.filter === 'basic' && !/\bBasic\b/.test(type)) return false;
        if (
          !all &&
          typeof ability.filter === 'object' &&
          !ability.filter.subtypes.some((subtype) => type.includes(subtype))
        )
          return false;
        return `${def.name} ${def.printedName ?? ''}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase());
      })
    : [];

  const blocked = disabled || table.stack[0]?.id !== entry.id;

  async function requestAccess(): Promise<void> {
    if (!libraryAccess || blocked || accessRequest === 'loading') return;
    setAccessRequest('loading');
    const next = await libraryAccess.request();
    if (!next) {
      setAccessRequest('rejected');
      return;
    }
    setOwnsAccess(true);
    setAccessRequest('idle');
  }

  async function close(release = true): Promise<void> {
    if (release && ownsAccess && libraryAccess) await libraryAccess.release();
    onClose();
  }

  const commit = (cardId: string | null) =>
    void send({
      type: 'resolve.fetch',
      entryId: entry.id,
      cardId,
      tapped,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    }).then((saved) => {
      if (saved) void close();
    });

  return (
    <CockpitWorkPanel wide title="土地を探す" onClose={() => void close()}>
      <p className="table-fetch-source">
        発生源： 《
        {table.defs[entry.source.defId]?.printedName ?? table.defs[entry.source.defId]?.name}》 ·
        戦場へ出して山札を切り直す
      </p>
      {!accessReady ? (
        <div className="cockpit-session__bar">
          <p role="status">
            {accessRequest === 'loading'
              ? '山札を取得中です。'
              : accessRequest === 'rejected'
                ? '山札の閲覧を開始できませんでした。操作権と接続状態を確認して再試行してください。'
                : `山札は未取得です。公開されている枚数は${libraryAccess?.totalCount ?? 0}枚です。0枚とは扱いません。`}
          </p>
          <button
            disabled={blocked || accessRequest === 'loading'}
            onClick={() => void requestAccess()}
          >
            {accessRequest === 'loading' ? '取得中…' : '自分だけ山札を閲覧して検索を開始'}
          </button>
          <details>
            <summary>土地を出さずに終える</summary>
            <button disabled>閲覧を確定してから選べます</button>
          </details>
        </div>
      ) : (
        <>
          <input
            autoFocus
            aria-label="土地の名前で検索"
            placeholder="土地の名前で検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={all}
              onChange={(event) => setAll(event.target.checked)}
            />
            すべての土地を表示
          </label>
          <div className="table-zone-comparison">
            <div className="table-fetch-list">
              {ids.map((id) => (
                <button
                  key={id}
                  aria-label={`《${table.defs[table.cards[id].defId].printedName ?? table.defs[table.cards[id].defId].name}》を選ぶ`}
                  aria-pressed={selectedId === id}
                  onClick={() => setSelected({ id, objectId: objectIdOf(table.cards[id]) })}
                >
                  <CardView
                    instance={table.cards[id]}
                    def={table.defs[table.cards[id].defId]}
                    size="small"
                    draggable={false}
                  />
                  《
                  {table.defs[table.cards[id].defId].printedName ??
                    table.defs[table.cards[id].defId].name}
                  》
                </button>
              ))}
              {!ids.length &&
                (libraryAccess?.totalCount === 0 ? (
                  <p role="status">山札は0枚です。</p>
                ) : (
                  <p>該当する土地はありません。</p>
                ))}
            </div>
            <aside className="table-zone-selection" aria-label="出す土地">
              {!selectedId && <p>左から出す土地を選んでください。</p>}
              {selectedId && table.cards[selectedId] && (
                <div>
                  <CardView
                    instance={{ ...table.cards[selectedId], tapped: false }}
                    def={table.defs[table.cards[selectedId].defId]}
                    size="hand"
                    draggable={false}
                  />
                  <p>
                    選択中:《
                    {table.defs[table.cards[selectedId].defId].printedName ??
                      table.defs[table.cards[selectedId].defId].name}
                    》
                  </p>
                </div>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={tapped}
                  onChange={(event) => setTapped(event.target.checked)}
                />
                タップ状態で出す
              </label>
              <button
                className="table-cast-confirm"
                disabled={blocked || !selectedId}
                onClick={() => commit(selectedId)}
              >
                戦場に出して切り直す
              </button>
              <details>
                <summary>土地を出さずに終える</summary>
                <button disabled={blocked} onClick={() => commit(null)}>
                  見つけずに切り直す
                </button>
              </details>
            </aside>
          </div>
        </>
      )}
    </CockpitWorkPanel>
  );
}
