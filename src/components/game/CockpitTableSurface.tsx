import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import {
  tableManaResources,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import { manaActivationChoices } from '../../engine/autotap';
import type { ZoneId } from '../../engine/types';
import { CardView } from '../CardView';
import { Modal } from '../Modal';
import { Icon } from '../../ui/icons';
import { handFanCardLayout } from './handFanLayout';
import cardBack from '../../assets/onedeck/card-back.svg';

const zoneNames: Record<ZoneId, string> = {
  hand: '手札',
  library: '山札',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
  battlefield: '戦場',
  stack: 'Stack',
};
const phases = {
  untap: 'アンタップ',
  upkeep: 'アップキープ',
  draw: 'ドロー',
  main1: '第1メイン',
  combat: '戦闘',
  main2: '第2メイン',
  end: '終了',
  cleanup: 'クリンナップ',
};

function DropZone({
  zone,
  className,
  children,
  label,
}: {
  zone: ZoneId;
  className: string;
  children: ReactNode;
  label?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone });
  return (
    <div
      ref={setNodeRef}
      className={`${className}${isOver ? ' is-drop-target' : ''}`}
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function CockpitTableSurface({
  view,
  disabled,
  pending,
  selected,
  select,
  inspect,
  cast,
  send,
  openMenu,
  children,
  seatId,
  chooseSeat,
  peek,
}: {
  view: {
    table: CockpitTable;
    canUndo: boolean;
    canRedo: boolean;
    multiplayer?: {
      ownSeatId: string;
      started: boolean;
      paused: boolean;
      canOperate: boolean;
      counts: Record<string, { hand: number; library: number }>;
      peek: object | null;
    };
  };
  disabled: boolean;
  pending: boolean;
  selected: string[];
  select: (ids: string[]) => void;
  inspect: (id: string) => void;
  cast: (id: string) => void;
  send: (op: TableOperation | { type: 'undo' } | { type: 'redo' }) => Promise<boolean>;
  openMenu: () => void;
  children: ReactNode;
  peek: (seatId: string, zone: 'hand' | 'library' | null) => Promise<void>;
  seatId: string;
  chooseSeat: (id: string) => void;
}) {
  const { table, multiplayer: multi } = view;
  const ownId = multi?.ownSeatId ?? table.seats[0].id;
  const own = table.seats.find((seat) => seat.id === ownId)!;
  const [focus, setFocus] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [lastTurn, setLastTurn] = useState(table.activeSeatId);
  const [zone, setZone] = useState<ZoneId | null>(null);
  const [zoneSeat, setZoneSeat] = useState(ownId);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [work, setWork] = useState(false);
  const [stack, setStack] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bottomMode, setBottomMode] = useState(false);
  const [expandedBundles, setExpandedBundles] = useState<string[]>([]);
  const [hover, setHover] = useState<{ id: string; left: number; top: number } | null>(null);
  const [destination, setDestination] = useState<ZoneId>('graveyard');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const resources = useMemo(
    () => new Map(table.seats.map((seat) => [seat.id, tableManaResources(table, seat.id)])),
    [table],
  );
  if (lastTurn !== table.activeSeatId) {
    setLastTurn(table.activeSeatId);
    if (focus && !pinned && !work && !stack && table.activeSeatId !== ownId)
      setFocus(table.activeSeatId);
  }
  const name = (id: string) => {
    const def = table.defs[table.cards[id]?.defId];
    return def?.printedName ?? def?.name ?? table.seats.find((seat) => seat.id === id)?.label ?? id;
  };
  const face = (id: string) => {
    const card = table.cards[id];
    return table.defs[card?.defId]?.faces[card?.faceIndex ?? 0];
  };
  const isLand = (id: string) => /\bLand\b/.test(face(id)?.typeLine ?? '');
  const battlefield = (id: string) =>
    Object.values(table.cards)
      .filter((card) => card.zone === 'battlefield' && card.controllerId === id)
      .map((card) => card.id);
  const toggle = (id: string) =>
    select(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const opening = !own.kept;
  const requiredBottom = Math.min(7, Math.max(0, own.mulligans - 1));
  const openingIds = own.zones.hand.filter((id) => table.cards[id]);
  const canKeep = !pending && (!multi || (!multi.started && !multi.paused));
  const progressBlocked =
    disabled ||
    opening ||
    table.hold ||
    !!table.resolution ||
    !!table.combat ||
    table.stack.length > 0;
  const opponents = table.seats.filter((seat) => seat.id !== ownId);
  function openZone(next: ZoneId, owner = ownId) {
    setZone(next);
    setZoneSeat(owner);
    setQuery('');
    setPage(0);
    setFilter('all');
    setHover(null);
  }
  function quick(id: string) {
    if (disabled || opening) return;
    const card = table.cards[id];
    const choices =
      card.zone === 'battlefield' && !card.tapped
        ? manaActivationChoices(resources.get(card.controllerId)!, card.controllerId, id)
        : [];
    if (
      choices.length === 1 &&
      choices[0].every((command) => command.type === 'setTapped' || command.type === 'addMana')
    )
      void send({ type: 'generate', cardId: id, commands: choices[0] });
    else if (choices.length) inspect(id);
    else if (card.zone === 'battlefield')
      void send({ type: 'tap', ids: [id], tapped: !card.tapped });
    else if (isLand(id)) void send({ type: 'move', ids: [id], to: 'battlefield', position: 'top' });
    else cast(id);
  }
  function card(id: string, index = 0, handCount = 0) {
    const instance = table.cards[id];
    if (!instance) return null;
    const manaChoices =
      instance.zone === 'battlefield' && !instance.tapped
        ? manaActivationChoices(resources.get(instance.controllerId)!, instance.controllerId, id)
        : [];
    const fan = handCount ? handFanCardLayout(index, handCount) : null;
    const selectable = selectionMode || (opening && bottomMode) || !!zone;
    return (
      <article
        key={id}
        className={`table-card${selected.includes(id) ? ' is-selected' : ''}`}
        style={
          fan
            ? ({
                '--fan-angle': `${fan.rotationDeg}deg`,
                '--fan-y': `${fan.translateY}px`,
                marginLeft: fan.marginLeft,
                zIndex: fan.zIndex,
              } as CSSProperties)
            : undefined
        }
        data-card-id={id}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={`《${name(id)}》${selectable ? 'を選択' : 'の詳細'}`}
          onClick={() => {
            setHover(null);
            if (selectable) toggle(id);
            else inspect(id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (selectable) toggle(id);
              else inspect(id);
            }
          }}
          onMouseEnter={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setHover({
              id,
              left: Math.min(window.innerWidth - 300, Math.max(8, rect.right + 12)),
              top: Math.max(8, Math.min(window.innerHeight - 430, rect.top - 150)),
            });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <CardView
            instance={instance}
            def={table.defs[instance.defId]}
            size="hand"
            draggable={!disabled && !opening && !zone && instance.ownerId === ownId}
            onContextMenu={(event) => {
              event.preventDefault();
              setHover(null);
              inspect(id);
            }}
          />
        </div>
        {selectable && (
          <button
            className="table-card__selection"
            aria-label={`《${name(id)}》の選択を変更`}
            aria-pressed={selected.includes(id)}
            onClick={() => toggle(id)}
          >
            {selected.includes(id) ? selected.indexOf(id) + 1 : '選択'}
          </button>
        )}
        {!opening && !zone && (
          <button className="table-card__quick" disabled={disabled} onClick={() => quick(id)}>
            {instance.zone === 'battlefield'
              ? instance.tapped
                ? 'アンタップ'
                : manaChoices.length
                  ? 'マナを出す'
                  : 'タップ'
              : isLand(id)
                ? '土地を置く'
                : '唱える'}
          </button>
        )}
        {selectable && (
          <button
            className="table-card__read"
            aria-label={`《${name(id)}》を読む`}
            onClick={() => inspect(id)}
          >
            <Icon name="info" />
          </button>
        )}
        {instance.attachedTo && (
          <small className="table-card__annotation">{name(instance.attachedTo)}</small>
        )}
      </article>
    );
  }
  function board(id: string, compact = false) {
    const ids = battlefield(id);
    const lands = ids.filter(isLand);
    if (ids.length - lands.length > 30 || lands.length > 30)
      return (
        <div
          className={`table-board table-board--overview${compact ? ' table-board--compact' : ''}`}
          aria-label={`${table.seats.find((seat) => seat.id === id)?.label}の戦場`}
        >
          <div className="table-density-heading">
            <span>
              戦場 {ids.length}枚・クリーチャー{' '}
              {ids.filter((item) => /Creature/.test(face(item)?.typeLine ?? '')).length}体
            </span>
            <button onClick={() => openZone('battlefield', id)}>
              <Icon name="search" />全{ids.length}枚を見る
            </button>
          </div>
          <div className="table-board__permanents">
            {ids.slice(0, 12).map((item) => card(item))}
          </div>
          <small>先頭12枚 / 全{ids.length}枚</small>
        </div>
      );
    const groups = new Map<string, string[]>();
    for (const land of lands) {
      // Keep tapped and modified physical cards in the same stable land group.
      const key = compact ? id : `${id}:${table.cards[land].defId}`;
      groups.set(key, [...(groups.get(key) ?? []), land]);
    }
    return (
      <div
        className={`table-board${compact ? ' table-board--compact' : ''}`}
        data-density={ids.filter((item) => !isLand(item)).length > 20 ? 'dense' : undefined}
        aria-label={`${table.seats.find((seat) => seat.id === id)?.label}の戦場`}
      >
        <div className="table-board__permanents">
          {ids.length > 0 && (
            <button
              className="table-board__browse"
              title={`${table.seats.find((seat) => seat.id === id)?.label}の戦場一覧`}
              onClick={() => openZone('battlefield', id)}
            >
              <Icon name="search" />
              {ids.length}
            </button>
          )}
          {ids.filter((item) => !isLand(item)).map((item) => card(item))}
        </div>
        <div className="table-board__lands">
          {[...groups].map(([key, group]) => {
            if (group.length === 1 || expandedBundles.includes(key))
              return (
                <div className="table-land-group" key={key}>
                  {group.map((item) => card(item))}
                  {group.length > 1 && (
                    <button
                      onClick={() =>
                        setExpandedBundles(expandedBundles.filter((item) => item !== key))
                      }
                    >
                      束ねる
                    </button>
                  )}
                </div>
              );
            return (
              <div className="table-land-bundle" key={key}>
                {card(group[0])}
                <button
                  className="table-land-bundle__count"
                  onClick={() => setExpandedBundles([...expandedBundles, key])}
                  title="土地束を展開"
                >
                  {group.filter((item) => !table.cards[item].tapped).length} / {group.length}
                </button>
                <button
                  className="table-land-bundle__select"
                  onClick={() => {
                    select(group);
                    setSelectionMode(true);
                    setWork(true);
                  }}
                >
                  束を操作
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  const resolution = table.resolution;
  const zoneIds = zone
    ? table.seats
        .filter((seat) => zoneSeat === 'all' || zoneSeat === seat.id)
        .flatMap((seat) => (zone === 'battlefield' ? battlefield(seat.id) : seat.zones[zone]))
        .filter(
          (id) =>
            table.cards[id] &&
            `${name(id)} ${table.defs[table.cards[id].defId]?.name ?? ''}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (filter === 'all' ||
              (filter === 'selected'
                ? selected.includes(id)
                : filter === 'tapped'
                  ? table.cards[id].tapped
                  : filter === 'untapped'
                    ? !table.cards[id].tapped
                    : /Creature/.test(face(id)?.typeLine ?? ''))),
        )
    : [];
  const lastPage = Math.max(0, Math.ceil(zoneIds.length / 24) - 1);
  const visiblePage = Math.min(page, lastPage);
  const top = table.stack[0];
  const current = resolution ?? top;
  const sourceName = current
    ? (table.defs[current.source.defId]?.printedName ?? table.defs[current.source.defId]?.name)
    : '';
  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => setHover(null)}
      onDragEnd={({ active, over }) => {
        if (disabled || opening || !over) return;
        const id = String(active.id);
        const instance = table.cards[id];
        const to = over.id as ZoneId;
        if (!instance || instance.zone === to) return;
        if (
          to === 'battlefield' &&
          (instance.zone === 'hand' || instance.zone === 'command') &&
          !isLand(id)
        )
          cast(id);
        else void send({ type: 'move', ids: [id], to, position: 'top' });
      }}
    >
      <div className="table-mobile-notice">
        <strong>OneDeck</strong>
        <p>対戦卓はPCの広い画面でご利用ください。</p>
        <button onClick={openMenu}>メニュー</button>
      </div>
      <div className="table-layout">
        <section className="table-opponents" aria-label="相手の席">
          {opponents.map((opponent) => (
            <div
              key={opponent.id}
              className={`table-opponent${opponent.id === table.activeSeatId ? ' is-active' : ''}`}
            >
              <button
                className="table-opponent__identity"
                onClick={() => {
                  setFocus(focus === opponent.id ? null : opponent.id);
                  setPinned(true);
                }}
              >
                <strong>
                  {opponent.label}
                  {opponent.eliminated ? '・脱落' : ''}
                </strong>
                <small>
                  {Object.values(table.cards)
                    .filter((item) => item.ownerId === opponent.id && item.isCommander)
                    .map((item) => `《${name(item.id)}》`)
                    .join(' / ')}
                </small>
              </button>
              <span className="table-opponent__life">{opponent.life}</span>
              <span title="手札">
                手札 {multi?.counts[opponent.id]?.hand ?? opponent.zones.hand.length}
              </span>
              <button
                title={`${opponent.label}の墓地`}
                onClick={() => openZone('graveyard', opponent.id)}
              >
                <Icon name="graveyard" /> {opponent.zones.graveyard.length}
              </button>
            </div>
          ))}
        </section>
        <section
          className={`table-far-side${focus || opponents.length === 1 ? ' table-far-side--focus' : ''}`}
          aria-label="相手の公開盤面"
        >
          {focus ? (
            <>
              <nav>
                <button onClick={() => setFocus(null)}>全員を見る</button>
                <button aria-pressed={!pinned} onClick={() => setPinned(!pinned)}>
                  {pinned ? 'ターンに合わせる' : 'この相手を見る'}
                </button>
              </nav>
              {board(focus)}
            </>
          ) : (
            opponents.map((opponent) => (
              <div key={opponent.id}>{board(opponent.id, opponents.length > 1)}</div>
            ))
          )}
        </section>
        <DropZone zone="battlefield" className="table-home" label="自分の戦場">
          {board(ownId)}
        </DropZone>
        <section className="table-hand-edge">
          <div className="table-zones" aria-label="卓上の領域">
            <div>
              <button
                className="table-library"
                data-testid="library-tile"
                title="山札を見る"
                onClick={() => openZone('library')}
              >
                <img src={cardBack} alt="山札" />
                <b>{multi?.counts[ownId]?.library ?? own.zones.library.length}</b>
              </button>
              <button
                disabled={disabled || opening}
                onClick={() => void send({ type: 'draw', seatId: ownId, count: 1 })}
              >
                1枚引く
              </button>
            </div>
            {(['graveyard', 'exile'] as const).map((item) => (
              <DropZone key={item} zone={item} className="table-zone-drop">
                <button
                  className="table-zone"
                  key={item}
                  onClick={() => openZone(item)}
                  title={zoneNames[item]}
                >
                  <Icon name={item} />
                  <span>{zoneNames[item]}</span>
                  <b>{own.zones[item].length}</b>
                </button>
              </DropZone>
            ))}
          </div>
          <div
            className="table-hand"
            data-testid="hand-ribbon"
            aria-label="自分の手札"
            hidden={opening || zone === 'hand'}
          >
            {openingIds.length > 15 ? (
              <button className="table-large-hand" onClick={() => openZone('hand')}>
                <Icon name="library" />
                <strong>手札 {openingIds.length}枚</strong>
                <span>一覧を開く</span>
              </button>
            ) : (
              openingIds.map((id, index) => card(id, index, openingIds.length))
            )}
          </div>
          <div className="table-self">
            <div className="table-command" data-testid="commander-altar">
              {own.zones.command.map((id) => card(id))}
            </div>
            <button
              className="table-self__identity"
              onClick={() => openZone('command')}
              title="統率者の所在と税"
            >
              {Object.values(table.cards)
                .filter((item) => item.ownerId === ownId && item.isCommander)
                .map((item) => `《${name(item.id)}》`)
                .join(' / ') || own.label}
            </button>
            <div className="table-life">
              <button
                title="ライフを1減らす"
                disabled={disabled}
                onClick={() => void send({ type: 'life', seatIds: [ownId], delta: -1 })}
              >
                −
              </button>
              <strong>{own.life}</strong>
              <button
                title="ライフを1増やす"
                disabled={disabled}
                onClick={() => void send({ type: 'life', seatIds: [ownId], delta: 1 })}
              >
                ＋
              </button>
            </div>
          </div>
        </section>
        <footer className="table-progress" aria-label="進行">
          <button
            title="元に戻す"
            aria-label="undo"
            disabled={disabled || !view.canUndo}
            onClick={() => void send({ type: 'undo' })}
          >
            <Icon name="undo" />
          </button>
          <button
            title="やり直す"
            aria-label="redo"
            disabled={disabled || !view.canRedo}
            onClick={() => void send({ type: 'redo' })}
          >
            <Icon name="redo" />
          </button>
          <button title="手札を展開" onClick={() => openZone('hand')}>
            <Icon name="stack" />
          </button>
          <button aria-pressed={selectionMode} onClick={() => setSelectionMode(!selectionMode)}>
            複数選択{selected.length ? ` ${selected.length}` : ''}
          </button>
          <div className="table-progress__phase">
            {opening ? (
              '初手を検討'
            ) : (
              <>
                <strong>
                  {table.seats.find((seat) => seat.id === table.activeSeatId)?.label}のターン
                </strong>
                <span>
                  ターン {table.turn} · {phases[table.phase]}
                </span>
              </>
            )}
          </div>
          {(current || table.stack.length > 0) && (
            <button
              className="table-progress__source"
              data-testid="stack-band"
              onClick={() => setStack(true)}
            >
              <Icon name="stack" />
              {resolution ? '処理中' : `Stack ${table.stack.length}`} · 《{sourceName}》
            </button>
          )}
          <button onClick={() => setWork(true)}>
            {table.combat ? '戦闘に戻る' : selected.length ? '選択を操作' : '操作'}
          </button>
          {multi && (
            <button onClick={openMenu}>
              {multi.paused
                ? '復帰待ち'
                : !multi.started
                  ? '全員の準備・開始'
                  : multi.canOperate
                    ? '操作の受渡し'
                    : '応答したい'}
            </button>
          )}
          <button
            className="table-progress__next"
            disabled={progressBlocked}
            onClick={() => void send({ type: table.phase === 'cleanup' ? 'turn' : 'phase' })}
          >
            {table.phase === 'cleanup'
              ? '次のターンへ'
              : table.phase === 'main1'
                ? '戦闘へ'
                : '次へ'}
            <Icon name="phase-next" />
          </button>
          <button title="メニュー・保存" aria-label="メニュー" onClick={openMenu}>
            <Icon name="menu" />
          </button>
        </footer>
      </div>
      {opening && (
        <Modal
          title={bottomMode ? `山札の下へ戻す${requiredBottom}枚を選択` : '最初の手札'}
          width="xl"
        >
          <div className="table-opening" aria-label="初手7枚">
            {openingIds.map((id) => card(id))}
          </div>
          <div className="table-opening__actions">
            <span>
              {own.mulligans
                ? `引き直し ${own.mulligans}回 · キープ ${7 - requiredBottom}枚`
                : '初手7枚 · 最初の引き直しは無料'}
            </span>
            {bottomMode && (
              <button
                onClick={() => {
                  setBottomMode(false);
                  select([]);
                }}
              >
                判断に戻る
              </button>
            )}
            <button
              disabled={!canKeep || !openingIds.length}
              onClick={() => {
                void send({
                  type: 'mulligan',
                  seatId: ownId,
                  seed: crypto.getRandomValues(new Uint32Array(1))[0],
                }).then((saved) => {
                  if (saved) {
                    select([]);
                    setBottomMode(false);
                  }
                });
              }}
            >
              マリガン
            </button>
            <button
              className="table-progress__next"
              disabled={
                !canKeep ||
                !openingIds.length ||
                (bottomMode &&
                  selected.filter((id) => openingIds.includes(id)).length !== requiredBottom)
              }
              onClick={() => {
                if (requiredBottom && !bottomMode) {
                  select([]);
                  setBottomMode(true);
                  return;
                }
                void send({
                  type: 'keep',
                  seatId: ownId,
                  bottom: selected.filter((id) => openingIds.includes(id)),
                }).then((saved) => {
                  if (saved) {
                    select([]);
                    setBottomMode(false);
                  }
                });
              }}
            >
              {bottomMode ? 'この初手で始める' : '初手をキープ'}
            </button>
          </div>
        </Modal>
      )}
      {zone && (
        <Modal title={zoneNames[zone]} width="xl" onClose={() => setZone(null)} allowBoardPeek>
          {multi && (zone === 'library' || (zone === 'hand' && zoneSeat !== ownId)) && (
            <div className="cockpit-session__bar">
              <span>本人の選択は本人が決めます。閲覧した内容は他席へ公開されません。</span>
              {multi.canOperate && (
                <button disabled={pending} onClick={() => void peek(zoneSeat, zone)}>
                  この領域を自分だけ閲覧
                </button>
              )}
              {multi.peek && (
                <button disabled={pending} onClick={() => void peek(zoneSeat, null)}>
                  閲覧を終了
                </button>
              )}
            </div>
          )}
          <nav className="table-zone-tabs">
            {[
              ...table.seats.map((seat) => ({ id: seat.id, label: seat.label })),
              ...(['graveyard', 'exile', 'battlefield'].includes(zone)
                ? [{ id: 'all', label: '全員' }]
                : []),
            ].map((seat) => (
              <button
                key={seat.id}
                aria-pressed={zoneSeat === seat.id}
                onClick={() => {
                  setZoneSeat(seat.id);
                  setPage(0);
                }}
              >
                {seat.label}
              </button>
            ))}
            <input
              aria-label="カードを検索"
              placeholder="カードを検索"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
            <select
              aria-label="カードの絞り込み"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="all">すべて</option>
              <option value="selected">選択中</option>
              <option value="creature">クリーチャー</option>
              {zone === 'battlefield' && (
                <>
                  <option value="tapped">タップ状態</option>
                  <option value="untapped">アンタップ状態</option>
                </>
              )}
            </select>
          </nav>
          <nav className="table-density-heading" aria-label="カード一覧のページ">
            <button
              title="前のページ"
              aria-label="前のページ"
              disabled={visiblePage === 0}
              onClick={() => setPage(visiblePage - 1)}
            >
              <Icon name="phase-next" mirrored />
            </button>
            <output>
              {zoneIds.length ? visiblePage * 24 + 1 : 0}–
              {Math.min(zoneIds.length, (visiblePage + 1) * 24)} / {zoneIds.length}枚
            </output>
            <button
              title="次のページ"
              aria-label="次のページ"
              disabled={visiblePage === lastPage}
              onClick={() => setPage(visiblePage + 1)}
            >
              <Icon name="phase-next" />
            </button>
            <button
              disabled={!zoneIds.length}
              onClick={() => select([...new Set([...selected, ...zoneIds])])}
            >
              検索結果を全選択 ({zoneIds.length})
            </button>
          </nav>
          <div className="table-zone-cards">
            <div className="table-zone-cards__row">
              {zoneIds.slice(visiblePage * 24, (visiblePage + 1) * 24).map((id) => (
                <div key={id}>
                  {card(id)}
                  <small>
                    {
                      table.seats.find(
                        (seat) =>
                          seat.id ===
                          (zone === 'battlefield'
                            ? table.cards[id].controllerId
                            : table.cards[id].ownerId),
                      )?.label
                    }
                  </small>
                </div>
              ))}
            </div>
            {!zoneIds.length && <p>該当するカードはありません</p>}
          </div>
          <div className="table-opening__actions">
            <span>選択 {selected.length}枚</span>
            <button onClick={() => select([])}>選択取消</button>
            <button
              disabled={!selected.length}
              onClick={() => {
                chooseSeat(zoneSeat === 'all' ? ownId : zoneSeat);
                setZone(null);
                setWork(true);
              }}
            >
              選択を操作
            </button>
          </div>
        </Modal>
      )}
      <Modal
        open={work}
        title={resolution ? `《${sourceName}》の処理` : '卓の操作'}
        width="lg"
        onClose={() => setWork(false)}
        allowBoardPeek
      >
        <label>
          操作する席{' '}
          <select value={seatId} onChange={(event) => chooseSeat(event.target.value)}>
            {table.seats.map((seat) => (
              <option key={seat.id} value={seat.id}>
                {seat.label}
                {seat.id !== ownId ? '（代行）' : ''}
              </option>
            ))}
          </select>
        </label>
        {children}
      </Modal>
      {stack && (
        <Modal
          title={resolution ? `《${sourceName}》の処理` : 'Stack'}
          width="lg"
          onClose={() => setStack(false)}
          allowBoardPeek
        >
          {current && (
            <div className="table-stack-source">
              <CardView
                instance={{ ...current.source, tapped: false }}
                def={table.defs[current.source.defId]}
                size="hand"
                draggable={false}
              />
              <div>
                <p>
                  {current.kind === 'spell'
                    ? (table.defs[current.source.defId]?.faces[current.source.faceIndex]
                        ?.printedText ?? current.text)
                    : current.text}
                </p>
                {current.targets.length > 0 && (
                  <p>
                    対象:{' '}
                    {current.targets
                      .map((id) => (table.cards[id] ? `《${name(id)}》` : name(id)))
                      .join('、')}
                  </p>
                )}
              </div>
            </div>
          )}
          {table.stack.length > 1 && (
            <ol>
              {table.stack.map((entry) => (
                <li key={entry.id}>
                  《
                  {table.defs[entry.source.defId]?.printedName ??
                    table.defs[entry.source.defId]?.name}
                  》
                </li>
              ))}
            </ol>
          )}
          {resolution ? (
            <>
              <button
                onClick={() => {
                  setStack(false);
                  setWork(true);
                }}
              >
                基本操作を続ける
              </button>
              <label>
                処理後の行き先{' '}
                <select
                  value={destination}
                  onChange={(event) => setDestination(event.target.value as ZoneId)}
                >
                  {(
                    ['battlefield', 'graveyard', 'exile', 'hand', 'command', 'library'] as const
                  ).map((item) => (
                    <option key={item} value={item}>
                      {zoneNames[item]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={disabled}
                onClick={() =>
                  void send({ type: 'resolve.end', to: destination }).then((saved) => {
                    if (saved) setStack(false);
                  })
                }
              >
                処理を終える
              </button>
            </>
          ) : (
            <button
              disabled={disabled || !top}
              onClick={() => {
                setDestination(
                  top &&
                    /Creature|Artifact|Enchantment|Planeswalker|Battle/.test(
                      table.defs[top.source.defId]?.faces[0]?.typeLine ?? '',
                    )
                    ? 'battlefield'
                    : 'graveyard',
                );
                void send({ type: 'resolve.begin' });
              }}
            >
              処理を始める
            </button>
          )}
        </Modal>
      )}
      {hover && table.cards[hover.id] && !opening && (
        <aside
          className="table-hover"
          style={{ left: hover.left, top: hover.top }}
          aria-hidden="true"
        >
          <CardView
            instance={{ ...table.cards[hover.id], tapped: false }}
            def={table.defs[table.cards[hover.id]?.defId]}
            size="hand"
            draggable={false}
          />
          <p>{face(hover.id)?.manaCost}</p>
          <p>{face(hover.id)?.printedText ?? face(hover.id)?.oracleText}</p>
        </aside>
      )}
    </DndContext>
  );
}
