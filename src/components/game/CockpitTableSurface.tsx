import { CockpitCleanupTools } from './CockpitCleanupTools';
import { tableCleanupNeedsReview } from '../../engine/cockpitTable';
import { CockpitFeed } from './CockpitFeed';
import { blockingPublicTableTriggers } from '../../engine/cockpitTriggers';
import { CockpitWorkPanel as TableWorkPanel } from './CockpitWorkPanel';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  tableManaResources,
  tableFetchAbility,
  manaColors,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import { manaActivationChoices } from '../../engine/autotap';
import { tableAbilityChoices } from '../../engine/cockpitAbilities';
import type { ZoneId } from '../../engine/types';
import {
  canLifecycleResolveWithoutManual,
  defaultResolutionDestination,
  type R31TableOperation,
} from '../../engine/cockpitR31';
import type { R4TableOperation } from '../../engine/cockpitR4';
import { CardView } from '../CardView';
import { Modal } from '../Modal';
import { ContextMenu } from '../ContextMenu';
import { Icon } from '../../ui/icons';
import { handFanCardLayout } from './handFanLayout';
import { Board } from './Board';
import { SupportRow } from './SupportRow';
import { HandRibbon, type HandRibbonController } from './HandRibbon';
import { StackBand, type StackBandController } from './StackBand';
import { MulliganStage } from './MulliganStage';
import { TabletopSurface, CardDragOverlay } from './GameScreen';
import { cockpitGameState } from './cockpitGameState';
import { captureDragVisual, type ActiveDragVisual } from './cardDragVisual';
import { DRAG_UI_START_EVENT, DRAG_UI_END_EVENT } from './dragUiEvents';
import type { DropTarget } from './dragIntent';
import './cockpit.css';
import { AmbientBackdrop } from './AmbientBackdrop';
import { DanceFloorLights } from './DanceFloorLights';
import { useShortcuts } from '../../hooks/useShortcuts';
import { loadKeybindings } from '../../data/keybindings';
import { CockpitFetchSearch } from './CockpitFetchSearch';
import { hasCockpitLibraryAccess, type CockpitLibraryAccess } from './cockpitLibraryAccess';

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
  openStackEntry,
  activate,
  modalOpen = false,
  boardChoice,
  boardTarget,
  decision,
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
      peek: { seatId: string; zone: 'hand' | 'library'; count?: number } | null;
    };
  };
  modalOpen?: boolean;
  boardChoice?: (id: string) => void;
  boardTarget?: string | null;
  decision?: ReactNode;
  disabled: boolean;
  pending: boolean;
  selected: string[];
  select: (ids: string[]) => void;
  inspect: (id: string) => void;
  cast: (id: string) => void;
  activate?: (id: string, choice?: string) => void;
  send: (
    op: TableOperation | R31TableOperation | R4TableOperation | { type: 'undo' } | { type: 'redo' },
  ) => Promise<boolean>;
  openMenu: () => void;
  children:
    | ReactNode
    | ((browse: (zone: ZoneId, seatId: string) => void, workOpen: boolean) => ReactNode);
  peek: (
    seatId: string,
    zone: 'hand' | 'library' | null,
    count?: number,
  ) => Promise<CockpitTable | null | void>;
  seatId: string;
  chooseSeat: (id: string) => void;
  openStackEntry?: (id: string) => void;
}) {
  const { table, multiplayer: multi } = view;
  const ownId = multi?.ownSeatId ?? table.seats[0].id;
  const own = table.seats.find((seat) => seat.id === ownId)!;
  const [feed, setFeed] = useState(false);
  const triggerCount = (table.triggers?.candidates ?? []).filter(
    (c) => c.status === 'pending',
  ).length;
  const triggersReady = blockingPublicTableTriggers(table).length > 0;
  const [handWorkspace, setHandWorkspace] = useState(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDragVisual | null>(null);
  const activeDragId = activeDrag?.cardId ?? null;
  const [cardMenu, setCardMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const displayState = useMemo(() => cockpitGameState(table, ownId), [table, ownId]);
  const [focus, setFocus] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [lastTurn, setLastTurn] = useState(table.activeSeatId);
  const [zone, setZone] = useState<ZoneId | null>(null);
  const [zoneSeat, setZoneSeat] = useState(ownId);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [panel, setPanel] = useState<'zone' | 'work' | 'stack' | null>(null);
  const work = panel === 'work';
  const stack = panel === 'stack';
  const setWork = (open: boolean) => setPanel(open ? 'work' : null);
  const setStack = (open: boolean) => setPanel(open ? 'stack' : null);
  const [zoneViews, setZoneViews] = useState(
    new Map<string, { query: string; page: number; filter: string }>(),
  );
  const [fetchEntry, setFetchEntry] = useState<string | null>(null);
  const fetchTarget = fetchEntry ? table.stack.find((entry) => entry.id === fetchEntry) : undefined;
  if (fetchEntry && !fetchTarget) setFetchEntry(null);
  const [reviewTurn, setReviewTurn] = useState(false);
  const [mana, setMana] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bottomMode, setBottomMode] = useState(false);
  const [expandedBundles, setExpandedBundles] = useState<string[]>([]);
  const [hover, setHover] = useState<{ id: string; left: number; top: number } | null>(null);
  const [destination, setDestination] = useState<ZoneId>('graveyard');
  const [zoneLibraryStatus, setZoneLibraryStatus] = useState<'idle' | 'loading' | 'rejected'>(
    'idle',
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  // Mana resources are an operation helper and reject eliminated seats. Rendering must
  // keep those seats visible for spectators without reopening their operation authority.
  const resources = useMemo(
    () =>
      new Map(
        table.seats
          .filter((seat) => !seat.eliminated)
          .map((seat) => [seat.id, tableManaResources(table, seat.id)]),
      ),
    [table],
  );
  const libraryAccessFor = (targetSeat: string): CockpitLibraryAccess | undefined =>
    multi
      ? {
          seatId: targetSeat,
          totalCount: multi.counts[targetSeat]?.library ?? 0,
          peek: multi.peek,
          request: async (count) => (await peek(targetSeat, 'library', count)) ?? null,
          release: async () => (await peek(targetSeat, null)) ?? null,
        }
      : undefined;
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
    boardChoice
      ? boardChoice(id)
      : select(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
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
  function advancePhase() {
    if (triggersReady) {
      setFeed(true);
      return;
    }
    if (progressBlocked || (reviewTurn && table.phase === 'cleanup')) return;
    if (reviewTurn) setReviewTurn(false);
    const count = multi?.counts[table.activeSeatId]?.hand;
    if (table.phase === 'cleanup' && !table.cleanupReady && tableCleanupNeedsReview(table, count)) {
      setReviewTurn(true);
      return;
    }
    void send({ type: 'phase' });
  }
  // Every normal next button/key means one boundary, in both solo and shared tables.
  const prepareTurn = advancePhase;
  async function keepHand(bottom: string[]) {
    if (!(await send({ type: 'keep', seatId: ownId, bottom }))) return;
    select([]);
    setBottomMode(false);
    // Start only after the keep receipt. A failed start remains resumable from the primary action.
    if (!multi) await send({ type: 'turn.ready' });
  }
  const [keybindings] = useState(loadKeybindings);
  const keyHint = (key: string) =>
    ({ ArrowUp: '↑', ArrowLeft: '←', ArrowRight: '→', Enter: '↵', Space: 'Space' })[key] ??
    key.toUpperCase();
  const dialogOpen =
    modalOpen ||
    feed ||
    opening ||
    mana ||
    (reviewTurn && table.phase === 'cleanup') ||
    !!fetchTarget ||
    handWorkspace ||
    !!cardMenu;
  function runPrimaryAction() {
    if (dialogOpen || disabled || opening || table.hold || boardChoice) return;
    if (table.resolution) setWork(true);
    else if (triggersReady) setFeed(true);
    else if (table.stack[0]) resolveTop();
    else if (table.combat) setWork(true);
    else if (table.phase === 'untap' || table.startProgress) prepareTurn();
    else advancePhase();
  }
  useShortcuts({
    keybindings,
    isDialogOpen: dialogOpen,
    onNextTurn: runPrimaryAction,
    onNextPhase: () => {
      if (!dialogOpen) advancePhase();
    },
    onDraw: () => {
      if (!dialogOpen && !disabled) void send({ type: 'draw', seatId: ownId, count: 1 });
    },
    onUndo: () => {
      if (!dialogOpen && !disabled && view.canUndo) void send({ type: 'undo' });
    },
    onRedo: () => {
      if (!dialogOpen && !disabled && view.canRedo) void send({ type: 'redo' });
    },
    onRestart: () => {
      if (!dialogOpen) openMenu();
    },
  });
  const opponents = table.seats.filter((seat) => seat.id !== ownId);
  function openZone(next: ZoneId, owner = ownId) {
    if (
      multi &&
      zone === 'library' &&
      zoneSeat !== 'all' &&
      multi.peek?.zone === 'library' &&
      multi.peek.seatId === zoneSeat &&
      (next !== 'library' || owner !== zoneSeat)
    ) {
      void peek(zoneSeat, null);
      setZoneLibraryStatus('idle');
    }
    if (zone) setZoneViews(new Map(zoneViews).set(`${zoneSeat}:${zone}`, { query, page, filter }));
    const saved =
      zone === next && zoneSeat === owner
        ? { query, page, filter }
        : zoneViews.get(`${owner}:${next}`);
    setZone(next);
    setPanel('zone');
    setZoneSeat(owner);
    setQuery(saved?.query ?? '');
    setPage(saved?.page ?? 0);
    setFilter(saved?.filter ?? 'all');
    setHover(null);
  }
  function quick(id: string) {
    if (disabled || opening) return;
    const card = table.cards[id];
    if (!card) return;
    const resource = resources.get(card.controllerId);
    const choices =
      card.zone === 'battlefield' && !card.tapped && resource
        ? manaActivationChoices(resource, card.controllerId, id)
        : [];
    if (
      choices.length === 1 &&
      choices[0].every((command) => command.type === 'setTapped' || command.type === 'addMana')
    )
      void send({ type: 'generate', cardId: id, commands: choices[0] });
    else if (choices.length) inspect(id);
    else if (
      card.zone === 'battlefield' &&
      !card.tapped &&
      activate &&
      tableAbilityChoices(table, id).length
    )
      activate(id);
    else if (card.zone === 'battlefield')
      void send({ type: 'tap', ids: [id], tapped: !card.tapped });
    else if (isLand(id)) {
      if (card.zone === 'hand') void send({ type: 'playLand', cardId: id });
      else inspect(id);
    } else cast(id);
  }
  function card(id: string, index = 0, handCount = 0, inZone = false) {
    const instance = table.cards[id];
    if (!instance) return null;
    const resource = resources.get(instance.controllerId);
    const manaChoices =
      instance.zone === 'battlefield' && !instance.tapped && resource
        ? manaActivationChoices(resource, instance.controllerId, id)
        : [];
    const fan = handCount ? handFanCardLayout(index, handCount) : null;
    const selectable = Boolean(boardChoice) || selectionMode || (opening && bottomMode) || inZone;
    return (
      <article
        key={id}
        className={`table-card${(boardChoice ? boardTarget === id : selected.includes(id)) ? ' is-selected' : ''}`}
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
          title={selectable ? 'Enter：読む / Space：選択' : 'Enter：読む'}
          onClick={() => {
            setHover(null);
            if (selectable) toggle(id);
            else inspect(id);
          }}
          onDoubleClick={() => {
            if (!selectable && !opening) quick(id);
          }}
          onKeyDown={(event) => {
            if (event.repeat || event.nativeEvent.isComposing) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setHover(null);
              if (event.key === 'Enter') inspect(id);
              else if (selectable) toggle(id);
              else if (!opening) quick(id);
              else inspect(id);
            }
          }}
          onMouseEnter={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setHover({
              id,
              left: inZone
                ? Math.max(8, window.innerWidth - 670)
                : Math.min(window.innerWidth - 660, Math.max(8, rect.right + 12)),
              top: Math.max(8, Math.min(window.innerHeight - 430, rect.top - 150)),
            });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <CardView
            instance={instance}
            def={table.defs[instance.defId]}
            size="hand"
            draggable={
              !disabled && !opening && !inZone && !selectable && instance.ownerId === ownId
            }
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
            aria-pressed={boardChoice ? boardTarget === id : selected.includes(id)}
            onClick={() => toggle(id)}
          >
            {selected.includes(id) ? selected.indexOf(id) + 1 : '選択'}
          </button>
        )}
        {!opening && !inZone && !selectable && (
          <button className="table-card__quick" disabled={disabled} onClick={() => quick(id)}>
            {instance.zone === 'battlefield'
              ? instance.tapped
                ? 'アンタップ'
                : manaChoices.length
                  ? 'マナを出す'
                  : activate && tableAbilityChoices(table, id).length
                    ? '能力を起動'
                    : 'タップ'
              : isLand(id)
                ? table.cards[id].zone === 'hand'
                  ? '土地を置く'
                  : '詳細'
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
    const localParent = (item: string) => {
      const parent = table.cards[item].attachedTo;
      return parent && ids.includes(parent) ? parent : null;
    };
    const roots = ids.filter((item) => !localParent(item));
    const attachedCard = (item: string): ReactNode => {
      const attached = ids.filter((candidate) => localParent(candidate) === item);
      return (
        <div className="table-permanent-group" key={item}>
          {card(item)}
          {attached.length > 0 && (
            <div className="table-attachments" aria-label={`《${name(item)}》への取り付け`}>
              {attached.map(attachedCard)}
            </div>
          )}
        </div>
      );
    };
    const lands = roots.filter(isLand);
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
      const key = ids.some((item) => localParent(item) === land)
        ? land
        : compact
          ? id
          : `${id}:${table.cards[land].defId}`;
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
          {roots.filter((item) => !isLand(item)).map(attachedCard)}
        </div>
        <div className="table-board__lands">
          {[...groups].map(([key, group]) => {
            if (group.length === 1 || expandedBundles.includes(key))
              return (
                <div className="table-land-group" key={key}>
                  {group.map(attachedCard)}
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
                {attachedCard(group[0])}
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
  const zoneLibraryAccess =
    zone === 'library' && zoneSeat !== 'all' ? libraryAccessFor(zoneSeat) : undefined;
  const zoneLibraryReady = hasCockpitLibraryAccess(zoneLibraryAccess);
  const zoneIds =
    zone && (zone !== 'library' || zoneLibraryReady)
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
  const fetchable = top && (!multi || top.controllerId === ownId) && tableFetchAbility(table, top);
  const lifecycleOnly = Boolean(top && canLifecycleResolveWithoutManual(table, top));
  const resolveLabel = resolution
    ? '効果の処理に戻る'
    : fetchable
      ? '解決して土地を探す'
      : lifecycleOnly
        ? '解決して戦場に出す'
        : '効果を処理する';
  function resolveTop(manual = false) {
    if (triggersReady) {
      setFeed(true);
      return;
    }
    if (disabled || table.hold || !top) return;
    if (resolution) {
      setWork(true);
      return;
    }
    if (!manual && fetchable) {
      setPanel(null);
      setFetchEntry(top.id);
      return;
    }
    if (!manual && lifecycleOnly) {
      void send({ type: 'resolve.finish', entryId: top.id, to: 'battlefield' }).then((saved) => {
        if (saved) setStack(false);
      });
      return;
    }
    setDestination(defaultResolutionDestination(table, top));
    void send({ type: 'resolve.begin', entryId: top.id }).then((saved) => {
      if (saved) setWork(true);
    });
  }

  const sourceName = current
    ? (table.defs[current.source.defId]?.printedName ?? table.defs[current.source.defId]?.name)
    : '';
  const sourceId = (id: string) => table.stack.find((entry) => entry.id === id)?.source.id ?? id;
  const openCardMenuAt = (id: string, x: number, y: number) => {
    if (table.stack.some((entry) => entry.id === id)) {
      openStackEntry?.(id);
      return;
    }
    setCardMenu({
      id,
      x: Math.max(8, Math.min(x, window.innerWidth - 210)),
      y: Math.max(8, Math.min(y, window.innerHeight - 230)),
    });
  };
  const controller: HandRibbonController & StackBandController = {
    state: displayState,
    libraryCount: multi?.counts[ownId]?.library,
    libraryActionsOpen: panel === 'zone' && zone === 'library',
    motionArmed: false, // Confirmed Cockpit commits own the shared motion and sound.
    mulliganDecisionPending: opening,
    transitionCue: null,
    openCardMenu: (id, event) => {
      event.preventDefault();
      openCardMenuAt(id, event.clientX, event.clientY);
    },
    openCardMenuAt,
    handleCardDoubleClick: (id) => {
      if (sourceId(id) !== id) openStackEntry?.(id);
      else quick(id);
    },
    requestTapForMana: (id) => quick(id),
    requestActivateAbility: (id, line) => {
      if (disabled || opening) return;
      const choice = tableAbilityChoices(table, id).find((item) => item.key === String(line));
      if (choice && activate) activate(id, choice.key);
      else quick(id);
    },
    requestToggleTap: (id) => {
      if (!disabled && !opening && table.cards[id]?.zone === 'battlefield')
        void send({ type: 'tap', ids: [id], tapped: !table.cards[id].tapped });
    },
    requestToggleTapMany: (ids) => {
      if (disabled || opening) return false;
      const untapped = ids.filter((id) => !table.cards[id]?.tapped);
      const entries = untapped.map((id) => ({
        cardId: id,
        commands: (() => {
          const resource = resources.get(ownId);
          const choices = resource ? manaActivationChoices(resource, ownId, id) : [];
          return choices.length === 1 ? choices[0] : [];
        })(),
      }));
      if (
        entries.length &&
        entries.every(
          (entry) =>
            entry.commands.length &&
            entry.commands.every((cmd) => cmd.type === 'setTapped' || cmd.type === 'addMana'),
        )
      )
        void send({ type: 'generateBatch', entries });
      else if (!untapped.length) void send({ type: 'tap', ids: [...ids], tapped: false });
      else {
        select([...ids]);
        setWork(true);
      }
      return true;
    },
    decisionFocus:
      boardChoice || selectionMode
        ? {
            kind: 'target',
            title: 'カードを選ぶ',
            instruction: '',
            candidateIds: Object.keys(table.cards),
            selectedIds: boardChoice ? (boardTarget ? [boardTarget] : []) : selected,
          }
        : null,
    chooseDecisionCard: toggle,
    toggleSelectedDecisions: true,
    openLibraryActions: () => openZone('library'),
    openZoneViewer: (next) => openZone(next),
    requestDraw: (count) => {
      if (!disabled && !opening) void send({ type: 'draw', seatId: ownId, count });
    },
    resolutionSession: null,
    setManualTargets: (id) => openStackEntry?.(id),
    removeStackItem: (id, to = 'graveyard') => {
      if (!disabled) void send({ type: 'stack.remove', entryId: id, to });
    },
    completeManualResolution: () => setWork(true),
  };
  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => {
        const id = String(event.active.id);
        const instance = displayState.cards[id];
        const def = instance && displayState.defs[instance.defId];
        if (!instance || !def || disabled || opening) return;
        setHover(null);
        setCardMenu(null);
        setActiveDrag(captureDragVisual(event, id, instance, def));
        document.dispatchEvent(new Event(DRAG_UI_START_EVENT));
      }}
      onDragCancel={() => {
        setActiveDrag(null);
        document.dispatchEvent(new Event(DRAG_UI_END_EVENT));
      }}
      onDragEnd={({ active, over }) => {
        setActiveDrag(null);
        document.dispatchEvent(new Event(DRAG_UI_END_EVENT));
        if (disabled || opening || !over) return;
        const id = String(active.id);
        const instance = table.cards[id];
        const drop = over.data.current?.dropTarget as DropTarget | undefined;
        const to =
          drop?.kind === 'cast'
            ? 'stack'
            : drop?.kind === 'play-land'
              ? 'battlefield'
              : drop?.kind === 'move-zone'
                ? drop.zone
                : (over.id as ZoneId);
        if (!instance || instance.zone === to || instance.zone === 'stack') return;
        if (to === 'stack') {
          if (!isLand(id)) cast(id);
          return;
        }
        if (to === 'battlefield' && instance.zone === 'hand' && isLand(id))
          void send({ type: 'playLand', cardId: id });
        else if (
          to === 'battlefield' &&
          (instance.zone === 'hand' || instance.zone === 'command') &&
          !isLand(id)
        )
          cast(id);
        else void send({ type: 'move', ids: [id], to, position: 'top' });
      }}
    >
      {multi && (
        <div className="table-mobile-notice">
          <strong>OneDeck</strong>
          <p>対戦卓はPCの広い画面でご利用ください。</p>
          <button onClick={openMenu}>メニュー</button>
        </div>
      )}
      <div
        className={`game-screen cockpit-table-restored${multi ? ' game-screen--cockpit cockpit-table-restored--multiplayer' : ''}`}
        data-mulligan-active={opening || undefined}
        data-hand-workspace-open={handWorkspace || undefined}
        data-drag-active={!!activeDragId || undefined}
        data-stack-active={!!table.stack.length || undefined}
        data-combat={!!table.combat || table.phase === 'combat' || undefined}
        data-decision-active={!!decision || selectionMode || undefined}
        data-commander-on-battlefield={
          Object.values(table.cards).some(
            (item) =>
              item.isCommander && item.controllerId === ownId && item.zone === 'battlefield',
          ) || undefined
        }
      >
        <TabletopSurface />
        <AmbientBackdrop />
        <DanceFloorLights controller={controller} />
        {!multi && (
          <div className="game-screen__status">
            <div className="status-band" data-testid="status-band">
              <div className="status-band__turn">
                <span className="status-band__turn-label">T</span>
                <strong data-testid="turn-indicator">{table.turn}</strong>
              </div>
              <div
                className="status-band__phases"
                data-testid="phase-indicator"
                data-phase={table.phase}
              >
                <strong className="status-band__phase-current">{phases[table.phase]}</strong>
                {Object.entries(phases).map(([phase, label], index) => (
                  <span
                    key={phase}
                    className={`status-band__phase${phase === table.phase ? ' is-active' : ''}`}
                    title={label}
                  >
                    {['解', '維', '引', '1', '戦', '2', '終', '整'][index]}
                  </span>
                ))}
              </div>
              <div className="status-band__mana" aria-label="マナプール色別調整">
                <button
                  className="status-band__mana-total table-mana-toggle"
                  title="マナの詳細"
                  onClick={() => setMana(true)}
                >
                  <strong>{manaColors.reduce((sum, color) => sum + own.mana[color], 0)}</strong>
                </button>
                <span className="status-band__mana-colors">
                  {manaColors.map((color, index) => (
                    <span
                      key={color}
                      className="status-band__mana-stepper"
                      data-mana={color}
                      data-empty={own.mana[color] === 0}
                    >
                      <button
                        disabled={disabled || opening || own.mana[color] === 0}
                        aria-label={`${color}マナを1減らす`}
                        onClick={() => void send({ type: 'mana', seatId: ownId, color, delta: -1 })}
                      >
                        −
                      </button>
                      <span>
                        {['白', '青', '黒', '赤', '緑', '無'][index]}
                        <strong>{own.mana[color]}</strong>
                      </span>
                      <button
                        disabled={disabled || opening}
                        aria-label={`${color}マナを1増やす`}
                        onClick={() => void send({ type: 'mana', seatId: ownId, color, delta: 1 })}
                      >
                        ＋
                      </button>
                    </span>
                  ))}
                </span>
              </div>
              <div className="status-band__right-actions" data-player-seat={ownId}>
                <div className="status-band__life-cluster">
                  <button
                    className="status-band__life-adjust"
                    title="ライフを1減らす"
                    disabled={disabled || opening}
                    onClick={() => void send({ type: 'life', seatIds: [ownId], delta: -1 })}
                  >
                    −
                  </button>
                  <strong
                    className="status-band__life"
                    data-testid="life-value"
                    aria-label={`ライフ${own.life}`}
                  >
                    <span className="status-band__life-heart">♥</span>
                    {own.life}
                  </strong>
                  <button
                    className="status-band__life-adjust"
                    title="ライフを1増やす"
                    disabled={disabled || opening}
                    onClick={() => void send({ type: 'life', seatIds: [ownId], delta: 1 })}
                  >
                    ＋
                  </button>
                </div>
                <button
                  className="status-band__bell"
                  title="Feed"
                  aria-label={`Feed（未処理${triggerCount}件）`}
                  onClick={() => setFeed(true)}
                >
                  <Icon name="bell" />
                  {triggerCount > 0 && <span className="status-band__badge">{triggerCount}</span>}
                </button>
              </div>
            </div>
          </div>
        )}
        <section className="table-opponents" aria-label="相手の席">
          {!multi && <span>一人回し · ターン {table.turn}</span>}
          {opponents.map((opponent) => (
            <div
              key={opponent.id}
              data-player-seat={opponent.id}
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
                  {multi ? opponent.label : '仮想の対戦相手'}
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
              {multi && (
                <span
                  className="table-opponent__resources"
                  title="アンタップのクリーチャー / 全クリーチャー・アンタップの土地 / 全土地"
                >
                  {(() => {
                    const cards = Object.values(table.cards).filter(
                      (card) => card.zone === 'battlefield' && card.controllerId === opponent.id,
                    );
                    const creatures = cards.filter((card) =>
                      /Creature/.test(face(card.id)?.typeLine ?? ''),
                    );
                    const lands = cards.filter((card) => isLand(card.id));
                    return `生物 ${creatures.filter((card) => !card.tapped).length}/${creatures.length} · 土地 ${lands.filter((card) => !card.tapped).length}/${lands.length}`;
                  })()}
                </span>
              )}
              {multi && (
                <span title="手札">
                  手札 {multi?.counts[opponent.id]?.hand ?? opponent.zones.hand.length}
                </span>
              )}
              {multi && (
                <button
                  title={`${opponent.label}の墓地`}
                  onClick={() => openZone('graveyard', opponent.id)}
                >
                  <Icon name="graveyard" /> {opponent.zones.graveyard.length}
                </button>
              )}
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
        <div className="game-screen__board table-home">
          <button
            className="restored-board-index"
            title="戦場を検索・選択"
            onClick={() => openZone('battlefield')}
          >
            <Icon name="search" />
            戦場一覧
          </button>
          <Board controller={controller} activeDragId={activeDragId} />
        </div>
        <div className="game-screen__support">
          <SupportRow controller={controller} activeDragId={activeDragId} />
        </div>
        <div className="game-screen__hand" hidden={opening}>
          <HandRibbon
            controller={controller}
            workspaceOpen={handWorkspace}
            onSearch={() => {
              setHandWorkspace(false);
              openZone('hand');
            }}
            onOpenWorkspace={() => setHandWorkspace(true)}
            onCloseWorkspace={() => setHandWorkspace(false)}
          />
        </div>
        {multi && (
          <div className="restored-life" aria-label="ライフ" data-player-seat={ownId}>
            <button
              title="ライフを1減らす"
              disabled={disabled}
              onClick={() => void send({ type: 'life', seatIds: [ownId], delta: -1 })}
            >
              −
            </button>
            <strong data-testid="life-value">{own.life}</strong>
            <button
              title="ライフを1増やす"
              disabled={disabled}
              onClick={() => void send({ type: 'life', seatIds: [ownId], delta: 1 })}
            >
              ＋
            </button>
          </div>
        )}
        <div className="game-screen__stack">
          <StackBand controller={controller} cockpit onEditTargets={openStackEntry} />
        </div>
        {!multi ? (
          <div className="game-screen__thumb">
            <footer className="thumb-zone" aria-label="進行">
              <button
                className="thumb-zone__icon-btn"
                title={`元に戻す (${keyHint(keybindings.undo)})`}
                aria-label="元に戻す"
                disabled={disabled || opening || !view.canUndo}
                onClick={() => void send({ type: 'undo' })}
              >
                <Icon name="undo" />
              </button>
              <button
                className="thumb-zone__icon-btn"
                title={`やり直す (${keyHint(keybindings.redo)})`}
                aria-label="やり直す"
                disabled={disabled || opening || !view.canRedo}
                onClick={() => void send({ type: 'redo' })}
              >
                <Icon name="redo" />
              </button>
              <button
                className={`thumb-zone__primary${current ? ' thumb-zone__primary--stack' : ' thumb-zone__primary--advance'}`}
                data-testid="primary-action"
                title={`主操作 (${keyHint(keybindings.nextTurn)})`}
                aria-label={
                  resolution
                    ? '処理に戻る'
                    : triggersReady
                      ? '誘発を確認'
                      : top
                        ? '解決'
                        : table.combat
                          ? '戦闘に戻る'
                          : table.phase === 'untap' || table.startProgress
                            ? 'ターン開始'
                            : table.phase === 'main1'
                              ? '戦闘'
                              : '次へ'
                }
                disabled={disabled || opening || table.hold || !!boardChoice || dialogOpen}
                onClick={runPrimaryAction}
              >
                <Icon name={current ? 'stack' : 'phase-next'} />
                <span>
                  {resolution
                    ? '処理'
                    : triggersReady
                      ? '誘発'
                      : top
                        ? '解決'
                        : table.combat
                          ? '戦闘'
                          : table.phase === 'untap' || table.startProgress
                            ? '開始'
                            : table.phase === 'main1'
                              ? '戦闘'
                              : '次へ'}
                </span>
                <kbd aria-hidden="true">{keyHint(keybindings.nextTurn)}</kbd>
              </button>
              <button
                className="thumb-zone__icon-btn"
                title="次のステップ"
                disabled={progressBlocked}
                onClick={prepareTurn}
              >
                <Icon name="turn-next" />
              </button>
              <button
                className="thumb-zone__icon-btn"
                title="操作"
                aria-label="操作"
                onClick={() => setWork(true)}
              >
                <Icon name="search" />
                <span className="sr-only">操作</span>
              </button>
              <button
                className="thumb-zone__icon-btn"
                title="メニュー"
                aria-label="メニュー"
                onClick={openMenu}
              >
                <Icon name="menu" />
              </button>
            </footer>
          </div>
        ) : (
          <footer className="table-progress game-screen__thumb" aria-label="進行">
            <button
              title={`元に戻す (${keyHint(keybindings.undo)})`}
              aria-label="元に戻す"
              disabled={disabled || !view.canUndo}
              onClick={() => void send({ type: 'undo' })}
            >
              <Icon name="undo" />
            </button>
            <button
              title={`やり直す (${keyHint(keybindings.redo)})`}
              aria-label="やり直す"
              disabled={disabled || !view.canRedo}
              onClick={() => void send({ type: 'redo' })}
            >
              <Icon name="redo" />
            </button>
            <button
              title="手札を展開"
              onClick={() => {
                setPanel(null);
                setHandWorkspace(true);
              }}
            >
              <Icon name="stack" />
            </button>
            <button
              className="table-mana-toggle"
              title="色別のマナ・プール"
              aria-label={`マナ・プール ${manaColors.reduce((sum, color) => sum + own.mana[color], 0)}点`}
              onClick={() => setMana(true)}
            >
              <span aria-hidden="true">
                ◇ {manaColors.reduce((sum, color) => sum + own.mana[color], 0)}
              </span>
              <span className="restored-mana-colors">
                {manaColors.map((color, index) => (
                  <span
                    key={color}
                    data-mana={color}
                    data-empty={own.mana[color] === 0}
                    title={`${['白', '青', '黒', '赤', '緑', '無色'][index]} ${own.mana[color]}点`}
                  >
                    <i>{['白', '青', '黒', '赤', '緑', '◇'][index]}</i>
                    <b>{own.mana[color]}</b>
                  </span>
                ))}
              </span>
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
              <button className="table-progress__source" onClick={() => setStack(true)}>
                <Icon name="stack" />
                {resolution ? '解決中' : `スタック ${table.stack.length}`} · 《{sourceName}》
              </button>
            )}
            <button aria-label={`Feed（未処理${triggerCount}件）`} onClick={() => setFeed(true)}>
              <Icon name="bell" />
              {triggerCount || 'Feed'}
            </button>
            {top && (
              <button
                className="restored-resolve"
                disabled={disabled || table.hold}
                onClick={() => resolveTop()}
              >
                {resolution ? '処理に戻る' : triggersReady ? '誘発を確認' : '解決'}
                <Icon name="stack" />
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
            {!multi && (
              <button disabled={progressBlocked} onClick={advancePhase}>
                {table.phase === 'main1' ? '戦闘へ' : '次へ'}{' '}
                <kbd aria-hidden="true">{keyHint(keybindings.nextPhase)}</kbd>
              </button>
            )}
            <button
              className="table-progress__next"
              disabled={progressBlocked}
              onClick={prepareTurn}
            >
              {!multi
                ? table.phase === 'untap'
                  ? 'ターン開始'
                  : '次へ'
                : table.phase === 'cleanup'
                  ? 'クリーンナップ・次のターンへ'
                  : table.phase === 'main1'
                    ? '戦闘へ'
                    : '次へ'}
              <Icon name="phase-next" />
              <kbd aria-hidden="true">{keyHint(keybindings.nextTurn)}</kbd>
            </button>
            <button title="メニュー・保存" aria-label="メニュー" onClick={openMenu}>
              <Icon name="menu" />
            </button>
          </footer>
        )}
        {(decision || selectionMode) && (
          <div className="game-screen__decision restored-decision" aria-label="盤面で選択">
            {decision || <span>選択 {selected.length}枚</span>}
            {selectionMode && (
              <button
                onClick={() => {
                  setSelectionMode(false);
                  select([]);
                }}
              >
                選択を終える
              </button>
            )}
          </div>
        )}
        {opening && (
          <MulliganStage
            key={`${ownId}:${own.mulligans}:${bottomMode}`}
            state={displayState}
            suspended={modalOpen}
            onMenu={multi ? openMenu : undefined}
            mode={bottomMode ? 'bottom' : 'decision'}
            bottomCount={requiredBottom}
            disabled={!canKeep}
            onMulligan={() =>
              void send({
                type: 'mulligan',
                seatId: ownId,
                seed: crypto.getRandomValues(new Uint32Array(1))[0],
              }).then((saved) => {
                if (saved) {
                  select([]);
                  setBottomMode(false);
                }
              })
            }
            onKeep={() => {
              if (requiredBottom) setBottomMode(true);
              else void keepHand([]);
            }}
            onBack={() => setBottomMode(false)}
            onBottomConfirm={(bottom) => void keepHand(bottom)}
          />
        )}
      </div>
      {cardMenu && (
        <ContextMenu
          x={cardMenu.x}
          y={cardMenu.y}
          title={`《${name(cardMenu.id)}》`}
          onClose={() => setCardMenu(null)}
          items={[
            {
              key: 'primary',
              label:
                table.cards[cardMenu.id]?.zone === 'battlefield'
                  ? isLand(cardMenu.id) && !table.cards[cardMenu.id].tapped
                    ? 'マナを出す'
                    : table.cards[cardMenu.id].tapped
                      ? 'アンタップ'
                      : 'タップ／起動'
                  : isLand(cardMenu.id)
                    ? table.cards[cardMenu.id]?.zone === 'hand'
                      ? '土地を置く'
                      : '詳細'
                    : '唱える',
              disabled: disabled || opening,
              onSelect: () => quick(cardMenu.id),
            },
            { key: 'inspect', label: '詳細・その他の操作', onSelect: () => inspect(cardMenu.id) },
            {
              key: 'select',
              label: '選択する',
              onSelect: () => {
                toggle(cardMenu.id);
                setSelectionMode(true);
              },
            },
          ]}
        />
      )}
      <nav
        className="table-work-nav"
        aria-label="作業面"
        hidden={opening || handWorkspace || (!panel && !zone)}
      >
        <button aria-pressed={work} onClick={() => setWork(true)}>
          操作 · 選択 {selected.length}
        </button>
        <button aria-pressed={stack} onClick={() => setStack(true)}>
          スタック {table.stack.length}
        </button>
        {zone && (
          <button aria-pressed={panel === 'zone'} onClick={() => setPanel('zone')}>
            {zoneNames[zone]}に戻る
          </button>
        )}
      </nav>
      {zone && (
        <TableWorkPanel
          wide
          title={zoneNames[zone]}
          open={panel === 'zone' && !feed}
          onClose={() => {
            if (
              multi &&
              zone === 'library' &&
              zoneSeat !== 'all' &&
              multi.peek?.zone === 'library' &&
              multi.peek.seatId === zoneSeat
            )
              void peek(zoneSeat, null);
            setZoneLibraryStatus('idle');
            setPanel(null);
          }}
        >
          {multi && zone === 'library' && zoneSeat !== 'all' && (
            <div className="cockpit-session__bar">
              <span>山札は必要なときだけ自分へ投影します。閲覧内容は他席へ公開されません。</span>
              {!zoneLibraryReady && multi.canOperate && (
                <button
                  disabled={pending || zoneLibraryStatus === 'loading'}
                  onClick={() => {
                    setZoneLibraryStatus('loading');
                    void libraryAccessFor(zoneSeat)!
                      .request()
                      .then((next) => setZoneLibraryStatus(next ? 'idle' : 'rejected'));
                  }}
                >
                  {zoneLibraryStatus === 'loading' ? '取得中…' : 'この山札を自分だけ閲覧'}
                </button>
              )}
              {multi.peek?.zone === 'library' && multi.peek.seatId === zoneSeat && (
                <button
                  disabled={pending}
                  onClick={() => {
                    setZoneLibraryStatus('idle');
                    void libraryAccessFor(zoneSeat)!.release();
                  }}
                >
                  閲覧を終了
                </button>
              )}
              {!zoneLibraryReady && (
                <span role="status">
                  {zoneLibraryStatus === 'loading'
                    ? '山札を取得中です。'
                    : zoneLibraryStatus === 'rejected'
                      ? '閲覧を開始できませんでした。操作権と接続状態を確認してください。'
                      : multi.canOperate
                        ? `未取得です。山札は${multi.counts[zoneSeat]?.library ?? 0}枚あります。`
                        : '未取得です。現在の操作権では閲覧できません。'}
                </span>
              )}
            </div>
          )}
          {multi && zone === 'hand' && zoneSeat !== ownId && (
            <div className="cockpit-session__bar">
              <span>本人の選択は本人が決めます。閲覧した内容は他席へ公開されません。</span>
              {multi.canOperate && (
                <button disabled={pending} onClick={() => void peek(zoneSeat, zone)}>
                  この領域を自分だけ閲覧
                </button>
              )}
              {multi.peek?.zone === 'hand' && multi.peek.seatId === zoneSeat && (
                <button disabled={pending} onClick={() => void peek(zoneSeat, null)}>
                  閲覧を終了
                </button>
              )}
            </div>
          )}
          <nav className="table-zone-tabs">
            {[
              ...table.seats
                .filter((seat) => multi || seat.id === ownId)
                .map((seat) => ({ id: seat.id, label: seat.label })),
              ...(['graveyard', 'exile', 'battlefield'].includes(zone)
                ? [{ id: 'all', label: '全員' }]
                : []),
            ].map((seat) => (
              <button
                key={seat.id}
                aria-pressed={zoneSeat === seat.id}
                onClick={() => {
                  openZone(zone, seat.id);
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
          <div className="table-zone-comparison">
            <div className="table-zone-cards">
              <div className="table-zone-cards__row">
                {zoneIds.slice(visiblePage * 24, (visiblePage + 1) * 24).map((id) => (
                  <div key={id}>
                    {zone === 'hand' && zoneSeat === ownId && openingIds.length <= 15 ? (
                      <div className="table-hand-index" data-card-id={id}>
                        <button
                          aria-pressed={boardChoice ? boardTarget === id : selected.includes(id)}
                          onClick={() => toggle(id)}
                        >
                          《{name(id)}》
                        </button>
                        <button aria-label={`《${name(id)}》を読む`} onClick={() => inspect(id)}>
                          <Icon name="info" />
                        </button>
                      </div>
                    ) : (
                      card(id, 0, 0, true)
                    )}
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
              {!zoneIds.length &&
                (zone === 'library' && !zoneLibraryReady ? (
                  <p role="status">山札は未取得です。取得前の0件表示は候補0件を意味しません。</p>
                ) : zone === 'library' && zoneLibraryAccess?.totalCount === 0 ? (
                  <p role="status">山札は0枚です。</p>
                ) : (
                  <p>該当するカードはありません</p>
                ))}
            </div>
            <aside className="table-zone-selection" aria-label="選択したカード">
              <h3>選択したカード · {selected.length}枚</h3>
              {selected.map(
                (id) =>
                  table.cards[id] && (
                    <div key={id}>
                      <button onClick={() => inspect(id)}>《{name(id)}》を読む</button>
                      <button aria-label={`《${name(id)}》の選択を外す`} onClick={() => toggle(id)}>
                        選択を外す
                      </button>
                    </div>
                  ),
              )}
              {!selected.length && <p>左の一覧でカードを選んでください。</p>}
            </aside>
          </div>
          <div className="table-opening__actions">
            <span>選択 {selected.length}枚</span>
            <button onClick={() => select([])}>選択取消</button>
            <button
              disabled={!selected.length}
              onClick={() => {
                chooseSeat(zoneSeat === 'all' ? ownId : zoneSeat);
                setWork(true);
              }}
            >
              選択を操作
            </button>
          </div>
        </TableWorkPanel>
      )}
      <TableWorkPanel
        open={work && !feed}
        title={resolution ? `《${sourceName}》の処理` : '卓の操作'}
        onClose={() => setWork(false)}
      >
        {multi && (
          <label>
            操作するプレイヤー{' '}
            <select value={seatId} onChange={(event) => chooseSeat(event.target.value)}>
              {table.seats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.label}
                  {seat.id !== ownId ? '（代行）' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <nav className="cockpit-session__bar" aria-label="カードの作業">
          <button
            title="手札を展開"
            onClick={() => {
              setPanel(null);
              setHandWorkspace(true);
            }}
          >
            <Icon name="stack" />
            手札
          </button>
          <button
            aria-pressed={selectionMode}
            onClick={() => {
              setSelectionMode(!selectionMode);
              setPanel(null);
            }}
          >
            複数選択
          </button>
          <button onClick={() => openZone('battlefield')}>戦場一覧</button>
          <button onClick={() => setMana(true)}>マナ</button>
          {!!table.stack.length && (
            <button onClick={() => setStack(true)}>スタック {table.stack.length}</button>
          )}
        </nav>
        {typeof children === 'function' ? children(openZone, work) : children}
      </TableWorkPanel>
      {reviewTurn && table.phase === 'cleanup' && (
        <CockpitCleanupTools
          table={table}
          seatId={table.activeSeatId}
          selected={selected}
          disabled={disabled}
          send={send}
          autoOpen
          onClose={() => setReviewTurn(false)}
          handCount={multi?.counts[table.activeSeatId]?.hand}
        />
      )}
      {fetchTarget && (
        <CockpitFetchSearch
          key={fetchTarget.id}
          table={table}
          entry={fetchTarget}
          disabled={disabled}
          send={send}
          onClose={() => setFetchEntry(null)}
          libraryAccess={libraryAccessFor(fetchTarget.controllerId)}
        />
      )}
      {mana && (
        <Modal title="マナ・プール" onClose={() => setMana(false)}>
          <div className="table-mana-pool">
            {manaColors.map((color, index) => (
              <div key={color} className={`table-mana-color table-mana-color--${color}`}>
                <strong>{['白', '青', '黒', '赤', '緑', '無色'][index]}</strong>
                <button
                  title={`${color}マナを1減らす`}
                  aria-label={`${color}マナを1減らす`}
                  disabled={disabled || own.mana[color] === 0}
                  onClick={() => void send({ type: 'mana', seatId: ownId, color, delta: -1 })}
                >
                  −
                </button>
                <output>{own.mana[color]}</output>
                <button
                  title={`${color}マナを1増やす`}
                  aria-label={`${color}マナを1増やす`}
                  disabled={disabled}
                  onClick={() => void send({ type: 'mana', seatId: ownId, color, delta: 1 })}
                >
                  ＋
                </button>
              </div>
            ))}
          </div>
          <button
            disabled={disabled || !Object.values(own.mana).some(Boolean)}
            onClick={() => void send({ type: 'emptyMana', seatIds: [ownId] })}
          >
            マナをすべて消す
          </button>
        </Modal>
      )}
      {stack && (
        <TableWorkPanel
          title={resolution ? `《${sourceName}》を解決` : 'スタック'}
          onClose={() => setStack(false)}
        >
          {top && (
            <button
              className="table-stack-primary"
              disabled={disabled || table.hold}
              onClick={() => resolveTop()}
            >
              {resolveLabel}
            </button>
          )}
          <ol className="table-stack-order">
            {table.stack.map((entry, index) => (
              <li
                key={entry.id}
                className={
                  resolution?.id === entry.id || (!resolution && index === 0) ? 'is-next' : ''
                }
              >
                <CardView
                  instance={{ ...entry.source, tapped: false }}
                  def={table.defs[entry.source.defId]}
                  size="small"
                  draggable={false}
                />
                <div>
                  <small>
                    {resolution?.id === entry.id
                      ? '解決中'
                      : index === 0
                        ? resolution
                          ? '解決待ち'
                          : '次に解決'
                        : `${index + 1}番目`}{' '}
                    ·{' '}
                    {table.seats.find((seat) => seat.id === entry.controllerId)?.label}
                  </small>
                  <strong>
                    《
                    {table.defs[entry.source.defId]?.printedName ??
                      table.defs[entry.source.defId]?.name}
                    》
                  </strong>
                  <span>
                    {entry.kind === 'spell'
                      ? '呪文'
                      : entry.kind === 'activated'
                        ? '起動型能力'
                        : '誘発型能力'}
                  </span>
                  {openStackEntry && (
                    <button onClick={() => openStackEntry(entry.id)}>対象・支払いを見る</button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {current && (
            <div className="table-stack-source">
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
          {resolution ? (
            <>
              <button
                onClick={() => {
                  setStack(false);
                  setWork(true);
                }}
              >
                カードを動かす・数値を変える
              </button>
              <button
                disabled={disabled}
                onClick={() =>
                  table.resolution &&
                  void send({
                    type: 'resolve.end',
                    entryId: table.resolution.id,
                    to: defaultResolutionDestination(table, table.resolution),
                  }).then((saved) => {
                    if (saved) setStack(false);
                  })
                }
              >
                処理完了
              </button>
              <details>
                <summary>終了方法…</summary>
                <label>
                  例外的な行き先{' '}
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
                    table.resolution &&
                    void send({
                      type: 'resolve.end',
                      entryId: table.resolution.id,
                      to: destination,
                    }).then((saved) => {
                      if (saved) setStack(false);
                    })
                  }
                >
                  指定した領域で処理完了
                </button>
              </details>
            </>
          ) : (
            <button disabled={disabled || table.hold || !top} onClick={() => resolveTop(true)}>
              効果を自分で処理する
            </button>
          )}
        </TableWorkPanel>
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
      <CardDragOverlay activeDrag={activeDrag} />
      <CockpitFeed
        table={table}
        open={feed}
        onClose={() => setFeed(false)}
        selected={selected}
        disabled={disabled}
        send={send}
      />
    </DndContext>
  );
}
