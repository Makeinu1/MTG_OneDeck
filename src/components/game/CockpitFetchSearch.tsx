import { useState } from 'react';
import {
  tableFetchAbility,
  type CockpitTable,
  type TableOperation,
  type TableStackEntry,
} from '../../engine/cockpitTable';
import { CardView } from '../CardView';
import { CockpitWorkPanel } from './CockpitWorkPanel';

/** Uncommitted choice only: movement, shuffle and completion are one server operation. */
export function CockpitFetchSearch({
  table,
  entry,
  disabled,
  send,
  onClose,
}: {
  table: CockpitTable;
  entry: TableStackEntry;
  disabled: boolean;
  send: (op: TableOperation) => Promise<boolean>;
  onClose: () => void;
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
  const [selected, setSelected] = useState<string | null>(null);
  const ids = seat.zones.library.filter((id) => {
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
  });
  const commit = (cardId: string | null) =>
    void send({
      type: 'resolve.fetch',
      entryId: entry.id,
      cardId,
      tapped,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    }).then((saved) => {
      if (saved) onClose();
    });
  const blocked = disabled || table.stack[0]?.id !== entry.id;
  return (
    <CockpitWorkPanel wide title="土地を探す" onClose={onClose}>
      <p className="table-fetch-source">
        発生源： 《
        {table.defs[entry.source.defId]?.printedName ?? table.defs[entry.source.defId]?.name}》 ·
        戦場へ出して山札を切り直す
      </p>
      <input
        autoFocus
        aria-label="土地の名前で検索"
        placeholder="土地の名前で検索"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <label>
        <input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} />
        すべての土地を表示
      </label>
      <div className="table-zone-comparison">
        <div className="table-fetch-list">
          {ids.map((id) => (
            <button
              key={id}
              aria-label={`《${table.defs[table.cards[id].defId].printedName ?? table.defs[table.cards[id].defId].name}》を選ぶ`}
              aria-pressed={selected === id}
              onClick={() => setSelected(id)}
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
          {!ids.length && <p>該当する土地はありません。</p>}
        </div>
        <aside className="table-zone-selection" aria-label="出す土地">
          {!selected && <p>左から出す土地を選んでください。</p>}
          {selected && table.cards[selected] && (
            <div>
              <CardView
                instance={{ ...table.cards[selected], tapped: false }}
                def={table.defs[table.cards[selected].defId]}
                size="hand"
                draggable={false}
              />
              <p>
                選択中:《
                {table.defs[table.cards[selected].defId].printedName ??
                  table.defs[table.cards[selected].defId].name}
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
            disabled={blocked || !selected || !seat.zones.library.includes(selected)}
            onClick={() => commit(selected)}
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
    </CockpitWorkPanel>
  );
}
