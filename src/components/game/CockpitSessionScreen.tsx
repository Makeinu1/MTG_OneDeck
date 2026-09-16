import { CockpitCardPresentation } from './CockpitCardPresentation';
import { CockpitReplayButton } from './CockpitReplayButton';
import { CockpitWorkPanel } from './CockpitWorkPanel';
import { CockpitRoomControls } from './CockpitRoomControls';
import type { CockpitControl } from '../../online/browser/cockpitClient';
import type { GameSnapshot } from '../../data/gameSnapshot';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InitDeckCard } from '../../engine/init';
import { manaActivationChoices } from '../../engine/autotap';
import {
  manaColors,
  tableManaResources,
  tableZones,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import type { GameCommand } from '../../engine/commands';
import type { ZoneId } from '../../engine/types';
import {
  captureExpectedInteractionContext,
  type ExpectedInteractionContext,
  type R31TableOperation,
} from '../../engine/cockpitR31';
import {
  emptyR4CastAdditionalCosts,
  r4CastPayment,
  type R4CastAdditionalCosts,
  type R4CastSourceZone,
  type R4TableOperation,
} from '../../engine/cockpitR4';
import type { R4bOperation } from '../../engine/cockpitR4b';
import type { CockpitSessionView } from '../../online/browser/cockpitClient';
import {
  CockpitClient,
  isCockpitOperationRejection,
  isCockpitTerminalFailure,
} from '../../online/browser/cockpitClient';
import { CockpitTableSurface } from './CockpitTableSurface';
import { CardView } from '../CardView';
import { Modal } from '../Modal';
import { CockpitSelectionTools } from './CockpitSelectionTools';
import { CockpitCorrectionTools } from './CockpitCorrectionTools';
import { CockpitCardTools, CockpitTokenTools } from './CockpitCardTools';
import { CockpitAbilityTools } from './CockpitAbilityTools';
import { cockpitCostText } from './cockpitCostText';
import { CockpitBattleTools } from './CockpitBattleTools';
import { CommanderRitualLayer } from './presentation/CommanderRitualLayer';
import { SemanticPresentationLayer } from './presentation/SemanticPresentationLayer';
import { TransitionCue } from './TransitionCue';
import { transitionCueFor, type TransitionCueData } from './transitionCueModel';
import './game.css';
import { publishCockpitOperation } from './cockpitPresentation';
import { useAudioVisual } from './presentation/audioVisualContext';
import { saveAudioPreferences } from './presentation/audioVisualPreferences';
import { ThemeToggle } from '../ThemeToggle';
import { isAmbientEnabled, setAmbientEnabled, AMBIENT_CHANGE_EVENT } from './ambientMotion';
import { CockpitManaBatch } from './CockpitManaBatch';
import { CockpitCastAdditionalCosts } from './CockpitCastAdditionalCosts';
import { liveStackDetail } from './cockpitTransientSelections';
import './cockpitSession.css';

const zoneLabels: Record<ZoneId, string> = {
  hand: '手札',
  library: '山札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
  stack: 'スタック',
};
const r4CastSourceZones: readonly R4CastSourceZone[] = [
  'hand',
  'command',
  'graveyard',
  'exile',
  'library',
];
const isR4CastSourceZone = (zone: ZoneId): zone is R4CastSourceZone =>
  r4CastSourceZones.includes(zone as R4CastSourceZone);
const keywordLabels = {
  flying: '飛行',
  vigilance: '警戒',
  trample: 'トランプル',
  deathtouch: '接死',
  lifelink: '絆魂',
  menace: '威迫',
  'first-strike': '先制攻撃',
  'double-strike': '二段攻撃',
  reach: '到達',
  haste: '速攻',
  hexproof: '呪禁',
  indestructible: '破壊不能',
  defender: '防衛',
  ward: '護法',
};
export function CockpitSessionScreen({
  deck,
  snapshot,
  seats,
  invitation,
  onBack,
  onReplay,
}: {
  deck: InitDeckCard[] | null;
  snapshot?: GameSnapshot;
  seats?: 2 | 4;
  invitation?: string;
  onBack: () => void;
  onReplay?: (deck: InitDeckCard[], seats?: 2 | 4) => void;
}) {
  const audio = useAudioVisual();
  const [ambient, setAmbient] = useState(isAmbientEnabled);
  const suppressRemoteMotion = useRef(true);
  const [castPeek, setCastPeek] = useState(false);
  const [abilityPeek, setAbilityPeek] = useState(false);
  const [transitionCue, setTransitionCue] = useState<TransitionCueData | null>(null);
  const transitionId = useRef(0);
  const sendingRef = useRef(false);
  const dismissTransition = useCallback((id: number) => {
    setTransitionCue((current) => (current?.id === id ? null : current));
  }, []);
  const [view, setView] = useState<CockpitSessionView | null>(null);
  const [roomInvitation, setRoomInvitation] = useState<string | null>(null);
  const [message, setMessage] = useState('接続中…');
  const [busy, setBusy] = useState(true);
  const [uncertain, setUncertain] = useState(false);
  const [terminalConnection, setTerminalConnection] = useState(false);
  const [operationError, setOperationError] = useState(false);
  const [seatId, setSeatId] = useState('P1');
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [ability, setAbility] = useState<string | null>(null);
  const [abilityChoice, setAbilityChoice] = useState<string | undefined>();
  const [abilityContext, setAbilityContext] = useState<ExpectedInteractionContext | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [attachment, setAttachment] = useState<{
    source: string;
    version: number;
    target: string | null;
    targetVersion?: number;
    paused?: boolean;
    targetLost?: boolean;
    context: ExpectedInteractionContext;
  } | null>(null);
  const [stackDetail, setStackDetail] = useState<string | null>(null);
  const [stackDestination, setStackDestination] = useState<ZoneId>('graveyard');
  const [to, setTo] = useState<ZoneId>('battlefield');
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [cast, setCast] = useState<{
    cardId: string;
    sourceZone: R4CastSourceZone;
    x: number;
    excludedSourceIds: string[];
    manualManaCost: string | null;
    costNote: string;
    targets: string[];
    additionalCosts: R4CastAdditionalCosts;
    paymentPlan: GameCommand[];
    additionalCostPlan: GameCommand[];
    error: string;
    context: ExpectedInteractionContext;
  } | null>(null);
  const [keyword, setKeyword] = useState('flying');
  const [keywordValue, setKeywordValue] = useState('');
  const [keywordSource, setKeywordSource] = useState('resolution');
  const [duration, setDuration] = useState('ターン終了まで');
  const clientRef = useRef<CockpitClient | null>(null);
  const viewRef = useRef<CockpitSessionView | null>(null);
  const motionRef = useRef<Animation[]>([]);
  const motionFrameRef = useRef<number | null>(null);
  const commanderCue = useCallback((id: string) => {
    const table = viewRef.current?.table;
    const card = table?.cards[id];
    const def = card && table?.defs[card.defId];
    const face = card && def?.faces[card.faceIndex];
    return card && face
      ? {
          cardId: id,
          faceIndex: card.faceIndex,
          name: def.printedName ?? def.name,
          typeLine: face.printedTypeLine ?? face.typeLine,
          imageUrl: face.imageUrl,
        }
      : null;
  }, []);
  useEffect(() => {
    let active = true;
    let initial = true;
    suppressRemoteMotion.current = true;
    const seenStackEntries = new Set<string>();
    const client = new CockpitClient(
      (next) => {
        if (active) {
          if (initial && next.multiplayer) setSeatId(next.multiplayer.ownSeatId);
          if (viewRef.current?.multiplayer?.masterId !== next.multiplayer?.masterId) {
            setDetail(null);
            setCast(null);
            setSelected([]);
            setAttachment(null);
          }
          const previous = viewRef.current?.table;
          const arrivals = next.table.stack.filter((entry) => !seenStackEntries.has(entry.id));
          next.table.stack.forEach((entry) => seenStackEntries.add(entry.id));
          if (
            !initial &&
            !suppressRemoteMotion.current &&
            !sendingRef.current &&
            previous &&
            !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ) {
            const flights = arrivals.map((entry) => ({
              id: entry.id,
              origin: document
                .querySelector<HTMLElement>(`[data-player-seat="${entry.controllerId}"]`)
                ?.getBoundingClientRect(),
            }));
            if (flights.length)
              motionFrameRef.current = requestAnimationFrame(() => {
                motionRef.current = motionRef.current.filter(
                  (animation) => animation.playState === 'running',
                );
                for (const { id, origin } of flights) {
                  const node = document.querySelector<HTMLElement>(
                    `[data-stack-item-id="${CSS.escape(id)}"]`,
                  );
                  if (!node || !origin || !node.getClientRects().length) continue;
                  const end = node.getBoundingClientRect();
                  motionRef.current.push(
                    node.animate(
                      [
                        { translate: `${origin.x - end.x}px ${origin.y - end.y}px`, opacity: 0.3 },
                        { translate: '0 0', opacity: 1 },
                      ],
                      { duration: 420, easing: 'ease-out' },
                    ),
                  );
                }
              });
          }
          initial = false;
          suppressRemoteMotion.current = false;
          const sameObject = (id: string) =>
            Boolean(next.table.cards[id]) &&
            (!previous ||
              previous.cards[id]?.zoneChangeCounter === next.table.cards[id].zoneChangeCounter);
          setSelected((current) => current.filter(sameObject));
          setAttachment((current) => {
            if (!current) return null;
            return current.target &&
              (!sameObject(current.target) ||
                next.table.cards[current.target]?.zone !== 'battlefield')
              ? { ...current, target: null, targetVersion: undefined, targetLost: true }
              : current;
          });
          setDetail((current) => (current && sameObject(current) ? current : null));
          setAbility((current) => (current && sameObject(current) ? current : null));
          setCast((current) => (current && sameObject(current.cardId) ? current : null));
          setStackDetail((current) =>
            current && liveStackDetail(next.table, current) ? current : null,
          );
          viewRef.current = next;
          setView(next);
          setRoomInvitation(client.invitation());
        }
      },
      (issue, error) => {
        if (active) {
          suppressRemoteMotion.current = true;
          setMessage(issue);
          setTerminalConnection(isCockpitTerminalFailure(error));
          setUncertain(true);
        }
      },
      () => {
        if (active) {
          setUncertain(false);
          setTerminalConnection(false);
          setOperationError(false);
          setMessage('接続が回復しました。サーバーの確定盤面から続けられます。');
        }
      },
    );
    clientRef.current = client;
    void (
      snapshot
        ? client.importSnapshot(snapshot)
        : deck && invitation
          ? client.join(deck, invitation)
          : deck
            ? client.start(deck, seats)
            : client.reconnect()
    )
      .then(() => {
        if (active) {
          setMessage(
            deck || snapshot
              ? 'サーバー保存済み'
              : '確定盤面に復帰しました。未確定の選択は選び直してください。',
          );
          setBusy(false);
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : '接続できませんでした。再接続して確認してください。',
          );
          setBusy(false);
          setTerminalConnection(isCockpitTerminalFailure(error));
          setUncertain(true);
        }
      });
    return () => {
      active = false;
      client.dispose();
      motionRef.current.forEach((animation) => animation.cancel());
      if (motionFrameRef.current !== null) cancelAnimationFrame(motionFrameRef.current);
    };
  }, [deck, snapshot, seats, invitation]);
  async function send(
    operation:
      | TableOperation
      | R31TableOperation
      | R4TableOperation
      | R4bOperation
      | { type: 'undo' }
      | { type: 'redo' },
    expectedContext?: ExpectedInteractionContext,
  ) {
    if (busy || uncertain || sendingRef.current) return false;
    sendingRef.current = true;
    setOperationError(false);
    setBusy(true);
    setMessage('送信中…');
    try {
      const before = viewRef.current?.table;
      const presentsDraw = ['draw', 'phase', 'turn', 'turn.ready', 'mulligan'].includes(
        operation.type,
      );
      const drawOrigin = presentsDraw
        ? document.querySelector('[data-testid="library-tile"]')?.getBoundingClientRect()
        : null;
      const moving =
        presentsDraw ||
        ['keep', 'move', 'playLand', 'cast', 'activate', 'resolve.finish', 'resolve.fetch'].includes(
          operation.type,
        );
      const origins = new Map<string, DOMRect>();
      if (moving)
        document.querySelectorAll<HTMLElement>('[data-layout-card-id]').forEach((node) => {
          if (node.getClientRects().length)
            origins.set(node.dataset.layoutCardId!, node.getBoundingClientRect());
        });
      const context =
        operation.type === 'undo' || operation.type === 'redo'
          ? undefined
          : expectedContext ?? (before ? captureExpectedInteractionContext(before) : undefined);
      await clientRef.current?.commit(operation, context);
      const after = viewRef.current?.table;
      if (before && after) {
        publishCockpitOperation(operation, before, after);
        if (['phase', 'turn', 'turn.ready'].includes(operation.type)) {
          const cue = transitionCueFor(before, after, {
            forceTurnStart: operation.type === 'turn.ready',
          });
          setTransitionCue(cue ? { ...cue, id: ++transitionId.current } : null);
        } else if (operation.type === 'undo' || operation.type === 'redo') {
          setTransitionCue(null);
          motionRef.current.forEach((animation) => animation.cancel());
          if (motionFrameRef.current !== null) cancelAnimationFrame(motionFrameRef.current);
        }
      }
      if (
        moving &&
        before &&
        after &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        const ownId = viewRef.current?.multiplayer?.ownSeatId ?? before.seats[0].id;
        const previousHand = before.seats.find((seat) => seat.id === ownId)?.zones.hand ?? [];
        const arrived = presentsDraw
          ? (after.seats
              .find((seat) => seat.id === ownId)
              ?.zones.hand.filter(
                (id) => operation.type === 'mulligan' || !previousHand.includes(id),
              ) ?? [])
          : operation.type === 'activate'
            ? after.stack
                .filter((entry) => !before.stack.some((old) => old.id === entry.id))
                .map((entry) => entry.id)
            : operation.type === 'keep'
              ? (after.seats.find((seat) => seat.id === ownId)?.zones.hand ?? [])
              : Object.values(after.cards)
                  .filter(
                    (card) => before.cards[card.id] && before.cards[card.id].zone !== card.zone,
                  )
                  .map((card) => card.id);
        motionFrameRef.current = requestAnimationFrame(() => {
          motionRef.current = motionRef.current.filter(
            (animation) => animation.playState === 'running',
          );
          arrived.forEach((id, index) => {
            const node = document.querySelector<HTMLElement>(
              `[data-layout-card-id="${CSS.escape(id)}"], .table-hand [data-card-id="${CSS.escape(id)}"]`,
            );
            if (!node) return;
            const sourceId = after.stack.find((entry) => entry.id === id)?.source.id;
            const resolvedId = before.stack.find((entry) => entry.source.id === id)?.id;
            const origin = presentsDraw ? drawOrigin : origins.get(sourceId ?? resolvedId ?? id);
            if (!origin) return;
            const end = node.getBoundingClientRect();
            motionRef.current.push(
              node.animate(
                [
                  {
                    translate: `${origin.x - end.x}px ${origin.y - end.y}px`,
                    opacity: 0.3,
                  },
                  { translate: '0 0', opacity: 1 },
                ],
                { duration: 420, delay: index * 65, easing: 'ease-out' },
              ),
            );
          });
        });
      }
      setMessage('サーバー保存済み');
      return true;
    } catch (error) {
      setOperationError(true);
      setTerminalConnection(isCockpitTerminalFailure(error));
      setUncertain(!isCockpitOperationRejection(error));
      setMessage(error instanceof Error ? error.message : '結果を確認中です。再接続してください。');
      return false;
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }
  async function control(operation: CockpitControl): Promise<CockpitSessionView | null> {
    if (busy || uncertain) return null;
    setOperationError(false);
    setBusy(true);
    try {
      await clientRef.current?.control(operation);
      setMessage('操作権と共有状態を保存しました。');
      return viewRef.current;
    } catch (error) {
      setTerminalConnection(isCockpitTerminalFailure(error));
      setUncertain(!isCockpitOperationRejection(error));
      setMessage(error instanceof Error ? error.message : '再接続してください。');
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function changePeek(
    targetSeat: string,
    targetZone: 'hand' | 'library' | null,
    count?: number,
  ): Promise<CockpitTable | null> {
    const next = await control({
      type: 'peek',
      seatId: targetSeat,
      zone: targetZone,
      ...(targetZone === 'library' && count !== undefined ? { count } : {}),
    });
    return next?.table ?? null;
  }
  async function checkpoint(restore: boolean) {
    setBusy(true);
    try {
      if (restore) {
        await clientRef.current?.restoreCheckpoint();
        setUncertain(false);
        setTerminalConnection(false);
      } else await clientRef.current?.saveCheckpoint();
      setMessage(
        restore
          ? '保存した盤面から再開しました。元に戻せるのは、再開後の操作です。'
          : 'この端末に盤面を保存しました。接続の有効期限が過ぎても、この地点から再開できます。',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '端末保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  }
  async function reconnect() {
    suppressRemoteMotion.current = true;
    setBusy(true);
    setOperationError(false);
    try {
      const result = await clientRef.current?.reconnect();
      setUncertain(false);
      setTerminalConnection(false);
      setMessage(
        result === 'unseen'
          ? '前の操作は未確定です。盤面を確認し、必要ならもう一度操作してください。'
          : 'サーバーの確定状態に復帰しました。',
      );
    } catch (error) {
      setTerminalConnection(isCockpitTerminalFailure(error));
      setUncertain(true);
      setMessage(error instanceof Error ? error.message : '復帰できませんでした。');
    } finally {
      setBusy(false);
    }
  }
  if (!view)
    return (
      <main className="cockpit-session">
        <p role="status">{message}</p>
        <button onClick={() => void reconnect()} disabled={busy || terminalConnection}>
          再接続
        </button>
        <p>端末保存から復元できるのは一人回しだけです。2人/4人の対戦卓は失効後に復元できません。</p>
        <button onClick={() => void checkpoint(true)} disabled={busy}>
          一人回しの端末保存から再開
        </button>
        <button onClick={onBack}>デッキへ戻る</button>
      </main>
    );
  const table = view.table;
  const seat = table.seats.find((entry) => entry.id === seatId)!;
  const battlefieldFor = (id: string) =>
    Object.values(table.cards)
      .filter((card) => card.zone === 'battlefield' && card.controllerId === id)
      .map((card) => card.id);
  const multi = view.multiplayer;
  const canBlock = Boolean(
    multi?.started &&
    !multi.paused &&
    !table.seats.find((s) => s.id === multi.ownSeatId)?.eliminated &&
    table.combat,
  );
  const detailCard = detail ? table.cards[detail] : undefined;
  const detailDef = detailCard ? table.defs[detailCard.defId] : undefined;
  const stackEntry = liveStackDetail(table, stackDetail);
  const label = (id: string) => {
    const card = table.cards[id];
    const def = card && table.defs[card.defId];
    const entry = table.stack.find((entry) => entry.id === id);
    const entryDef = entry && table.defs[entry.source.defId];
    return (
      def?.printedName ??
      def?.name ??
      (entryDef ? `Stack: ${entryDef.printedName ?? entryDef.name}` : id)
    );
  };
  function chooseAttachment(source: string) {
    const card = table.cards[source];
    if (!card || card.zone !== 'battlefield') return;
    if (attachment && attachment.source !== source) return;
    setAttachment({
      source,
      version: card.zoneChangeCounter,
      target: null,
      context: attachment?.context ?? captureExpectedInteractionContext(table),
    });
    setDetail(null);
  }
  function prepareCast(
    cardId: string,
    x = 0,
    excludedSourceIds: string[] = [],
    targets = selected.filter(
      (id) => id !== cardId && !['hand', 'library'].includes(table.cards[id]?.zone ?? ''),
    ),
    manualManaCost: string | null = cast?.cardId === cardId ? cast.manualManaCost : null,
    costNote = cast?.cardId === cardId ? cast.costNote : '',
    additionalCosts: R4CastAdditionalCosts =
      cast?.cardId === cardId ? cast.additionalCosts : emptyR4CastAdditionalCosts(),
  ) {
    const previous = cast?.cardId === cardId ? cast : null;
    const card = table.cards[cardId];
    const sourceZone =
      previous?.sourceZone ?? (card && isR4CastSourceZone(card.zone) ? card.zone : null);
    if (!sourceZone) {
      setOperationError(true);
      setMessage('この領域からは「唱える」を開始できません。');
      return;
    }
    let paymentPlan: GameCommand[] = [];
    let additionalCostPlan: GameCommand[] = [];
    let error = '';
    try {
      const plans = r4CastPayment(table, {
        cardId,
        x,
        excludedSourceIds,
        manualManaCost,
        costNote,
        additionalCosts,
      });
      paymentPlan = plans.paymentPlan;
      additionalCostPlan = plans.additionalCostPlan;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '支払い条件を確認してください。';
    }
    setDetail(null);
    setCastPeek(false);
    setCast({
      cardId,
      sourceZone,
      x,
      excludedSourceIds,
      manualManaCost,
      costNote,
      targets,
      additionalCosts,
      paymentPlan,
      additionalCostPlan,
      error,
      context: previous?.context ?? captureExpectedInteractionContext(table),
    });
  }
  const disabled =
    busy ||
    uncertain ||
    table.ended ||
    Boolean(multi && !multi.canOperate) ||
    !table.seats.find((entry) => entry.id === (multi?.ownSeatId ?? table.seats[0].id))?.kept;
  const selectionActions = (
    <div className="cockpit-session__bar" hidden={!selected.length}>
      {selected.length > 0 && (
        <details className="table-selected-review">
          <summary>選択カードを確認</summary>
          {selected.map((id) => (
            <button key={id} onClick={() => setDetail(id)}>
              《{label(id)}》 · {zoneLabels[table.cards[id].zone]}
            </button>
          ))}
        </details>
      )}
      <span>Manual Event（今ゲーム中に行う操作）</span>
      <span>選択 {selected.length}枚</span>
      <button onClick={() => setSelected([])}>選択を取り消す</button>
      <CockpitManaBatch table={table} selected={selected} disabled={disabled} send={send} />
      <select
        aria-label="移動先"
        value={to}
        onChange={(event) => setTo(event.target.value as ZoneId)}
      >
        {tableZones
          .filter((item) => item !== 'stack')
          .map((item) => (
            <option key={item} value={item}>
              {zoneLabels[item]}
            </option>
          ))}
      </select>
      <select
        aria-label="移動順"
        value={position}
        onChange={(event) => setPosition(event.target.value as 'top' | 'bottom')}
      >
        <option value="top">上へ・選択順</option>
        <option value="bottom">下へ・選択順</option>
      </select>
      <button
        disabled={disabled || !selected.length}
        onClick={() => void send({ type: 'move', ids: selected, to, position })}
      >
        {zoneLabels[to]}へ移す
      </button>
      <button
        disabled={disabled || !selected.length}
        onClick={() => void send({ type: 'tap', ids: selected, tapped: true })}
      >
        タップ
      </button>
      <button
        disabled={disabled || !selected.length}
        onClick={() => void send({ type: 'tap', ids: selected, tapped: false })}
      >
        アンタップ
      </button>
    </div>
  );
  return (
    <CockpitCardPresentation
      table={table}
      className={`cockpit-session${multi ? ' cockpit-session--multiplayer' : ''}`}
    >
      <SemanticPresentationLayer
        openingDealCount={
          !table.seats.find((seat) => seat.id === (multi?.ownSeatId ?? table.seats[0].id))?.kept
            ? table.seats.find((seat) => seat.id === (multi?.ownSeatId ?? table.seats[0].id))?.zones
                .hand.length
            : undefined
        }
      />
      <TransitionCue cue={transitionCue} onDone={dismissTransition} />
      <CommanderRitualLayer resolveCue={commanderCue} />
      {table.ended && (
        <section className="cockpit-postgame">
          <strong>ゲーム終了</strong>
          <p role="status">
            {table.seats.filter((entry) => !entry.eliminated).length === 1
              ? `勝者: ${table.seats.find((entry) => !entry.eliminated)?.label}。`
              : ''}
            最後の盤面は引き続き確認できます。
          </p>
          {onReplay && (
            <CockpitReplayButton
              disabled={busy || uncertain}
              seats={multi ? (table.seats.length as 2 | 4) : undefined}
              loadDeck={() => clientRef.current?.loadReplayDeck() ?? Promise.resolve(null)}
              onReplay={onReplay}
            />
          )}
          <button onClick={onBack}>デッキ選択へ戻る</button>
        </section>
      )}
      <CockpitTableSurface
        modalOpen={
          menu ||
          (!!attachment && !attachment.paused) ||
          (!!ability && !abilityPeek) ||
          (!!cast && !castPeek) ||
          Boolean(stackEntry) ||
          confirmEnd
        }
        view={view}
        boardTarget={attachment?.paused ? null : attachment?.target}
        boardChoice={
          attachment && !attachment.paused
            ? (id) => {
                const card = table.cards[id];
                if (card?.zone === 'battlefield' && id !== attachment.source)
                  setAttachment({
                    ...attachment,
                    target: id,
                    targetLost: false,
                    targetVersion: card.zoneChangeCounter,
                  });
              }
            : undefined
        }
        decision={
          attachment ? (
            <div className="table-attachment-draft">
              <strong>
                《{table.cards[attachment.source] ? label(attachment.source) : '発生源'}
                》の取り付け先
              </strong>
              <button
                onClick={() => setDetail(attachment.source)}
                disabled={!table.cards[attachment.source]}
              >
                発生源を見る
              </button>
              {(table.cards[attachment.source]?.zone !== 'battlefield' ||
                table.cards[attachment.source]?.zoneChangeCounter !== attachment.version) && (
                <span role="status">発生源が変わりました。選択をやめて確認してください。</span>
              )}
              {attachment.targetLost && (
                <span role="status">選んだカードが戦場を離れました。選び直してください。</span>
              )}
              <span>
                {attachment.target
                  ? `《${label(attachment.target)}》`
                  : attachment.paused
                    ? '卓の操作中です'
                    : '盤面のカードを選んでください'}
              </span>
              {attachment.target && (
                <button onClick={() => setDetail(attachment.target)}>選んだカードを見る</button>
              )}
              <button
                disabled={
                  disabled ||
                  attachment.paused ||
                  !attachment.target ||
                  table.cards[attachment.source]?.zone !== 'battlefield' ||
                  table.cards[attachment.source]?.zoneChangeCounter !== attachment.version ||
                  table.cards[attachment.target]?.zone !== 'battlefield' ||
                  table.cards[attachment.target]?.zoneChangeCounter !== attachment.targetVersion
                }
                onClick={() =>
                  void send(
                    {
                      type: 'attach',
                      cardId: attachment.source,
                      targetId: attachment.target,
                    },
                    attachment.context,
                  ).then((saved) => {
                    if (saved) setAttachment(null);
                  })
                }
              >
                {table.cards[attachment.source]?.attachedTo ? '付け替える' : '取り付ける'}
              </button>
              <button onClick={() => setAttachment({ ...attachment, paused: !attachment.paused })}>
                {attachment.paused ? '選択を続ける' : '選択を保持して卓へ'}
              </button>
              <button onClick={() => setAttachment(null)}>選択をやめる</button>
              <small>取り付け状態の手動変更です。能力の起動・支払いは別に行います。</small>
            </div>
          ) : selected.length ? (
            selectionActions
          ) : null
        }
        disabled={disabled}
        pending={busy || uncertain}
        selected={selected}
        select={setSelected}
        inspect={setDetail}
        activate={(id, choice) => {
          setAbilityChoice(choice);
          setAbilityContext(captureExpectedInteractionContext(table));
          setAbilityPeek(false);
          setAbility(id);
        }}
        cast={prepareCast}
        send={send}
        openMenu={() => setMenu(true)}
        openStackEntry={setStackDetail}
        seatId={seatId}
        chooseSeat={setSeatId}
        peek={changePeek}
      >
        {(browse, workOpen) => (
          <>
            <details>
              <summary>マナの調整</summary>
              <div className="cockpit-session__bar">
                {manaColors.map((color) => (
                  <label key={color}>
                    {color} {seat.mana[color]}
                    <button
                      disabled={disabled}
                      aria-label={color + 'マナを追加'}
                      onClick={() => void send({ type: 'mana', seatId, color, delta: 1 })}
                    >
                      ＋
                    </button>
                    <button
                      disabled={disabled || !seat.mana[color]}
                      aria-label={color + 'マナを減らす'}
                      onClick={() => void send({ type: 'mana', seatId, color, delta: -1 })}
                    >
                      −
                    </button>
                  </label>
                ))}
              </div>
            </details>
            <CockpitSelectionTools
              browseLibrary={() => browse('library', seatId)}
              table={table}
              seatId={seatId}
              selected={selected}
              disabled={disabled}
              send={send}
              libraryAccess={
                multi
                  ? {
                      seatId,
                      totalCount: multi.counts[seatId]?.library ?? 0,
                      peek: multi.peek,
                      request: (count) => changePeek(seatId, 'library', count),
                      release: () => changePeek(seatId, null),
                    }
                  : undefined
              }
            />
            <CockpitCorrectionTools
              table={table}
              seatId={seatId}
              selected={selected}
              disabled={disabled}
              shared={Boolean(multi)}
              holdActive={Boolean(multi?.holds.length)}
              send={send}
            />
            <CockpitTokenTools
              table={table}
              seatId={seatId}
              selected={selected}
              disabled={disabled}
              send={send}
            />
            <CockpitBattleTools
              visible={workOpen}
              table={table}
              selected={selected}
              disabled={disabled}
              defendingSeatId={multi?.ownSeatId}
              canBlock={canBlock && !busy && !uncertain}
              send={send}
            />

            <details className="cockpit-session__tools">
              <summary>通常手順のショートカット</summary>
              <button
                disabled={
                  disabled ||
                  table.hold ||
                  Boolean(table.resolution) ||
                  Boolean(table.combat) ||
                  table.stack.length > 0
                }
                onClick={() => void send({ type: 'phase' })}
              >
                次のステップ
              </button>
              <p>
                アンタップ開始時の任意操作です。途中で誘発や判断が必要なら個別に進めてください。HOLD・Stack・処理中は進みません。
              </p>
              <button
                disabled={
                  disabled ||
                  table.hold ||
                  (table.phase !== 'untap' && !table.startProgress) ||
                  Boolean(table.resolution) ||
                  table.stack.length > 0
                }
                onClick={() => void send({ type: 'shortcut' })}
              >
                現在のターンをメインまで進める（誘発で中断）
              </button>
              <button
                disabled={disabled}
                onClick={() => {
                  const ids = battlefieldFor(seatId);
                  if (ids.length) void send({ type: 'tap', ids, tapped: false });
                }}
              >
                {seat.label}の一括アンタップ
              </button>
              <button
                disabled={disabled}
                onClick={() => void send({ type: 'emptyMana', seatIds: [seatId] })}
              >
                {seat.label}のマナを空にする
              </button>
              <p>クリーンナップの手札選択と期限確認は、主操作「次へ」から行います。</p>
              <details>
                <summary>例外時の手動補正</summary>
                <p>
                  次のステップのアンタップ・ドロー・マナ処理を手動で反映した場合だけ使用してください。誘発・未完のクリーンナップは飛ばしません。
                </p>
                <button
                  disabled={
                    disabled ||
                    table.hold ||
                    !!table.stack.length ||
                    !!table.resolution ||
                    !!table.combat
                  }
                  onClick={() => void send({ type: 'phase', manual: true })}
                >
                  次のステップの定型処理を手動反映済みとして進む
                </button>
              </details>
            </details>

            {table.stack.map((entry) => (
              <button key={entry.id} onClick={() => setStackDetail(entry.id)}>
                《{label(entry.source.id)}》の対象・支払い・コピー
              </button>
            ))}
          </>
        )}
      </CockpitTableSurface>
      {menu && (
        <Modal title="メニュー・保存" onClose={() => setMenu(false)}>
          <CockpitRoomControls
            view={view}
            invitation={roomInvitation}
            busy={busy || uncertain}
            send={control}
          />
          <div className="cockpit-session__bar">
            <strong>OneDeck · {multi ? `${table.seats.length}人対戦` : '非公開の一人回し'}</strong>
            <span>
              {table.turn}ターン /{' '}
              {
                {
                  untap: 'アンタップ',
                  upkeep: 'アップキープ',
                  draw: 'ドロー',
                  main1: '第1メイン',
                  combat: '戦闘',
                  main2: '第2メイン',
                  end: '終了',
                  cleanup: 'クリンナップ',
                }[table.phase]
              }{' '}
              / {table.seats.find((entry) => entry.id === table.activeSeatId)?.label}
            </span>
            <span role="status">{message}</span>
            <button onClick={() => void reconnect()} disabled={busy || terminalConnection}>
              再接続
            </button>
            <button
              disabled={disabled || !view.canUndo}
              onClick={() => void send({ type: 'undo' })}
            >
              元に戻す
            </button>
            <button
              disabled={disabled || !view.canRedo}
              onClick={() => void send({ type: 'redo' })}
            >
              やり直す
            </button>
            {message.includes('失効') && (
              <button disabled={busy} onClick={() => void checkpoint(true)}>
                保存した盤面から再開
              </button>
            )}
            <button
              disabled={busy || uncertain || Boolean(multi)}
              onClick={() => void checkpoint(false)}
            >
              端末へ保存
            </button>
            <button onClick={onBack}>デッキ選択へ戻る</button>
            <details>
              <summary>音・表示</summary>
              <ThemeToggle compact />
              <button
                onClick={() => {
                  const next = !ambient;
                  setAmbientEnabled(next);
                  setAmbient(next);
                  document.dispatchEvent(new Event(AMBIENT_CHANGE_EVENT));
                }}
              >
                背景モーション {ambient ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => {
                  const next = { ...audio.preferences, bgmEnabled: !audio.preferences.bgmEnabled };
                  audio.setPreferences(next);
                  saveAudioPreferences(next);
                }}
              >
                BGM {audio.preferences.bgmEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => {
                  const next = {
                    ...audio.preferences,
                    eventSoundsEnabled: !audio.preferences.eventSoundsEnabled,
                  };
                  audio.setPreferences(next);
                  saveAudioPreferences(next);
                }}
              >
                操作音 {audio.preferences.eventSoundsEnabled ? 'ON' : 'OFF'}
              </button>
              <label>
                BGM音量{' '}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={audio.preferences.bgmVolume ?? 70}
                  onChange={(event) => {
                    const next = { ...audio.preferences, bgmVolume: Number(event.target.value) };
                    audio.setPreferences(next);
                    saveAudioPreferences(next);
                  }}
                />
              </label>
              <label>
                操作音量{' '}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={audio.preferences.sfxVolume ?? 80}
                  onChange={(event) => {
                    const next = { ...audio.preferences, sfxVolume: Number(event.target.value) };
                    audio.setPreferences(next);
                    saveAudioPreferences(next);
                  }}
                />
              </label>
            </details>
          </div>

          <p>稼働中の卓は最終利用から6時間で失効します。端末への保存は別に保持します。</p>
          <button disabled={disabled} onClick={() => setConfirmEnd(true)}>
            ゲームを終了…
          </button>
        </Modal>
      )}
      {(uncertain || operationError) && (
        <div className="table-connection" role="alert">
          {message}
          {terminalConnection ? (
            <button onClick={onBack}>デッキへ戻る</button>
          ) : uncertain ? (
            <button disabled={busy} onClick={() => void reconnect()}>
              再接続
            </button>
          ) : (
            <button onClick={() => setOperationError(false)}>閉じる</button>
          )}
        </div>
      )}
      {stackEntry && (
        <Modal
          title={`《${label(stackEntry.source.id)}》の対象・支払い`}
          onClose={() => setStackDetail(null)}
          allowBoardPeek
        >
          <p>
            発生源:《
            {table.defs[stackEntry.source.defId]?.printedName ??
              table.defs[stackEntry.source.defId]?.name}
            》 / {table.seats.find((seat) => seat.id === stackEntry.controllerId)?.label}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{stackEntry.text}</p>
          <p>
            対象:{' '}
            {stackEntry.targets
              .map((id) => {
                const snapshot = stackEntry.targetSnapshots?.[id];
                const def = snapshot && table.defs[snapshot.defId];
                return (
                  table.seats.find((seat) => seat.id === id)?.label ??
                  `《${def?.printedName ?? def?.name ?? label(id)}》`
                );
              })
              .join('、') || 'なし'}
          </p>
          {stackEntry.source.sourceSnapshot && (
            <p>
              発生源の登録時の領域: {zoneLabels[stackEntry.source.sourceSnapshot.zone]}
              （現在の所在と別に保持）
            </p>
          )}
          {stackEntry.source.targetSelections
            ?.filter((target) => target.selection.kind === 'object')
            .map(
              (target) =>
                target.selection.kind === 'object' && (
                  <p key={target.slotId}>
                    登録時の対象: 《
                    {table.defs[target.selection.snapshot.defId]?.printedName ??
                      table.defs[target.selection.snapshot.defId]?.name}
                    》・{zoneLabels[target.selection.snapshot.zone]}
                    。対象の継続性は本文と盤面を確認してください。
                  </p>
                ),
            )}
          <p>コスト記録: {stackEntry.costNote ?? '支払い確定済み'}</p>
          <ul>
            {stackEntry.paid.map((command, index) => (
              <li key={index}>{cockpitCostText(command, label)}</li>
            ))}
          </ul>
          <p>ここを閉じても処理は終了しません。</p>
          <details>
            <summary>打ち消す・スタックから取り除く</summary>
            <p>選んだ項目だけを取り除きます。別の効果を処理中なら、その発生源と処理は続きます。</p>
            {stackEntry.kind === 'spell' && (
              <label>
                移動先
                <select
                  value={stackDestination}
                  onChange={(event) => setStackDestination(event.target.value as ZoneId)}
                >
                  {tableZones
                    .filter((zone) => zone !== 'stack')
                    .map((zone) => (
                      <option key={zone} value={zone}>
                        {zoneLabels[zone]}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <button
              disabled={disabled}
              onClick={() =>
                void send({
                  type: 'stack.remove',
                  entryId: stackEntry.id,
                  to: stackDestination,
                }).then((saved) => {
                  if (saved) setStackDetail(null);
                })
              }
            >
              スタックから取り除く
            </button>
          </details>

          <p>コピーのコントローラー: {seat.label}</p>
          <button
            disabled={disabled}
            onClick={() =>
              void send({
                type: 'copyStack',
                entryId: stackEntry.id,
                id: crypto.randomUUID(),
                controllerId: seatId,
                targets: stackEntry.targets,
              })
            }
          >
            同じ対象でコピーする
          </button>
          <button
            disabled={disabled || !selected.length}
            onClick={() =>
              void send({
                type: 'copyStack',
                entryId: stackEntry.id,
                id: crypto.randomUUID(),
                controllerId: seatId,
                targets: selected,
              })
            }
          >
            選んだカードを対象にしてコピーする
          </button>
        </Modal>
      )}
      {detailCard && (
        <CockpitWorkPanel title={`《${label(detailCard.id)}》`} onClose={() => setDetail(null)}>
          <div className="table-detail-primary">
            {detailCard.zone === 'hand' &&
              /\bLand\b/.test(detailDef?.faces[detailCard.faceIndex]?.typeLine ?? '') && (
                <button
                  disabled={disabled}
                  onClick={() =>
                    void send({
                      type: 'playLand',
                      cardId: detailCard.id,
                    }).then((saved) => {
                      if (saved)
                        setDetail((current) => (current === detailCard.id ? null : current));
                    })
                  }
                >
                  土地を置く
                </button>
              )}

            {isR4CastSourceZone(detailCard.zone) &&
              !/\bLand\b/.test(detailDef?.faces[detailCard.faceIndex]?.typeLine ?? '') && (
                <button disabled={disabled} onClick={() => prepareCast(detailCard.id)}>
                  支払いを確認して唱える
                </button>
              )}
            {detailCard.zone === 'battlefield' && (
              <>
                {manaActivationChoices(
                  tableManaResources(table, detailCard.controllerId),
                  detailCard.controllerId,
                  detailCard.id,
                ).map((commands, index) => (
                  <button
                    key={index}
                    disabled={disabled}
                    onClick={() => void send({ type: 'generate', cardId: detailCard.id, commands })}
                  >
                    マナを出す：{' '}
                    {commands
                      .map((command) =>
                        command.type === 'addMana'
                          ? `${command.color} ${command.amount}`
                          : command.type === 'moveCard'
                            ? `《${label(command.cardId)}》を${zoneLabels[command.to]}へ`
                            : command.type === 'adjustLife'
                              ? `ライフ ${command.delta}`
                              : command.type === 'dealDamage'
                                ? `${command.amount}ダメージ`
                                : command.type === 'payMana'
                                  ? 'マナ支払いあり'
                                  : 'タップ',
                      )
                      .join(' / ')}
                  </button>
                ))}
                <button
                  disabled={disabled}
                  onClick={() =>
                    void send({ type: 'tap', ids: [detailCard.id], tapped: !detailCard.tapped })
                  }
                >
                  {detailCard.tapped ? 'アンタップ' : 'タップ'}
                </button>
              </>
            )}
          </div>
          {Object.values(table.cards)
            .filter((card) => card.attachedTo === detailCard.id)
            .map((card) => (
              <div key={card.id} className="table-related-card">
                <button onClick={() => setDetail(card.id)}>《{label(card.id)}》を見る</button>
                <button
                  disabled={disabled || (!!attachment && attachment.source !== card.id)}
                  onClick={() => chooseAttachment(card.id)}
                >
                  《{label(card.id)}》を付け替える
                </button>
                <button
                  disabled={disabled}
                  onClick={() => void send({ type: 'attach', cardId: card.id, targetId: null })}
                >
                  《{label(card.id)}》を外す
                </button>
              </div>
            ))}
          {table.linkedExiles
            .filter(
              (link) =>
                link.sourcePhysicalId === detailCard.id ||
                link.exiledPhysicalIds.includes(detailCard.id),
            )
            .map((link) => (
              <div className="table-related-card" key={link.linkId}>
                <span>追放との関連：{link.duration ?? '期間の指定なし'}</span>
                {[link.sourcePhysicalId, ...link.exiledPhysicalIds]
                  .filter((id) => id !== detailCard.id && table.cards[id])
                  .map((id) => (
                    <button key={id} onClick={() => setDetail(id)}>
                      《{label(id)}》を見る（{zoneLabels[table.cards[id].zone]}）
                    </button>
                  ))}
              </div>
            ))}
          <div className="table-detail-reading">
            <div className="table-detail-image">
              <CardView
                instance={{ ...detailCard, tapped: false }}
                def={detailDef}
                size="hand"
                draggable={false}
              />
            </div>
            <div>
              <p>
                {detailDef?.faces[detailCard.faceIndex]?.manaCost} ·{' '}
                {detailDef?.faces[detailCard.faceIndex]?.printedTypeLine ??
                  detailDef?.faces[detailCard.faceIndex]?.typeLine}
              </p>
              <p style={{ whiteSpace: 'pre-wrap' }}>
                {detailDef?.faces[detailCard.faceIndex]?.printedText ??
                  detailDef?.faces[detailCard.faceIndex]?.oracleText}
              </p>
            </div>
          </div>
          <CockpitAbilityTools
            key={`ability-${detailCard.id}`}
            table={table}
            sourceId={detailCard.id}
            selected={selected}
            disabled={disabled}
            send={send}
          />
          <details>
            <summary>ゲーム中にカードを移動（Manual Event）</summary>
            <div className="cockpit-session__bar">
              {(['battlefield', 'graveyard', 'exile', 'hand', 'library', 'command'] as const)
                .filter(
                  (target) =>
                    target !== detailCard.zone &&
                    !(
                      target === 'battlefield' &&
                      detailCard.zone === 'hand' &&
                      /\bLand\b/.test(detailDef?.faces[detailCard.faceIndex]?.typeLine ?? '')
                    ),
                )
                .map((target) => (
                  <button
                    key={target}
                    disabled={disabled}
                    onClick={() =>
                      void send({
                        type: 'move',
                        ids: [detailCard.id],
                        to: target,
                        position: 'top',
                      }).then((saved) => {
                        if (saved)
                          setDetail((current) => (current === detailCard.id ? null : current));
                      })
                    }
                  >
                    {target === 'battlefield'
                      ? /Land/.test(detailDef?.faces[detailCard.faceIndex]?.typeLine ?? '')
                        ? '土地を置く'
                        : '戦場へ出す'
                      : target === 'graveyard'
                        ? detailCard.zone === 'hand'
                          ? '捨てる'
                          : '墓地へ置く'
                        : target === 'exile'
                          ? '追放する'
                          : target === 'hand'
                            ? '手札へ戻す'
                            : target === 'library'
                              ? '山札の上へ'
                              : '統率領域へ'}
                  </button>
                ))}
            </div>
          </details>
          <div className="cockpit-session__bar">
            <button
              onClick={() => {
                setSelected((ids) =>
                  ids.includes(detailCard.id)
                    ? ids.filter((id) => id !== detailCard.id)
                    : [...ids, detailCard.id],
                );
                setDetail(null);
              }}
            >
              このカードを選択
            </button>
          </div>
          <p>
            所有者 {table.seats.find((seat) => seat.id === detailCard.ownerId)?.label} /
            コントローラー {table.seats.find((seat) => seat.id === detailCard.controllerId)?.label}{' '}
            / {zoneLabels[detailCard.zone]}
          </p>
          {detailCard.zone === 'battlefield' && (
            <button
              disabled={disabled || (!!attachment && attachment.source !== detailCard.id)}
              onClick={() => chooseAttachment(detailCard.id)}
            >
              {detailCard.attachedTo ? '盤面で付け替え先を選ぶ' : '盤面で取り付け先を選ぶ'}
            </button>
          )}
          {detailCard.attachedTo && (
            <button onClick={() => setDetail(detailCard.attachedTo ?? null)}>
              取り付け先を見る
            </button>
          )}
          <CockpitCardTools
            key={detailCard.id}
            table={table}
            cardId={detailCard.id}
            disabled={disabled}
            send={send}
          />

          {detailCard.zone === 'battlefield' && (
            <>
              <details>
                <summary>キーワードを付与・解除</summary>
                <label>
                  キーワード
                  <select value={keyword} onChange={(event) => setKeyword(event.target.value)}>
                    {Object.entries(keywordLabels).map(([id, text]) => (
                      <option key={id} value={id}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  値
                  <input
                    value={keywordValue}
                    onChange={(event) => setKeywordValue(event.target.value)}
                  />
                </label>
                <label>
                  期間
                  <input value={duration} onChange={(event) => setDuration(event.target.value)} />
                </label>
                <label>
                  由来
                  <select
                    value={keywordSource}
                    onChange={(event) => setKeywordSource(event.target.value)}
                  >
                    <option value="resolution">現在の処理の発生源</option>
                    <option value="none">特定の発生源なし</option>
                    {Object.values(table.cards).map((card) => (
                      <option key={card.id} value={card.id}>
                        {label(card.id)}・
                        {table.seats.find((seat) => seat.id === card.ownerId)?.label}・
                        {zoneLabels[card.zone]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={disabled}
                  onClick={() =>
                    void send({
                      type: 'keyword',
                      grant: {
                        id: crypto.randomUUID(),
                        cardId: detailCard.id,
                        keyword,
                        value: keywordValue,
                        duration,
                        sourceId:
                          keywordSource === 'resolution'
                            ? (table.resolution?.source.id ?? null)
                            : keywordSource === 'none'
                              ? null
                              : keywordSource,
                      },
                      remove: false,
                    })
                  }
                >
                  付与
                </button>
                {table.grants
                  .filter((grant) => grant.cardId === detailCard.id)
                  .map((grant) => (
                    <p key={grant.id}>
                      {keywordLabels[grant.keyword as keyof typeof keywordLabels] ?? grant.keyword}{' '}
                      {grant.value} / {grant.duration} / 由来:{' '}
                      {grant.sourceSnapshot
                        ? (table.defs[grant.sourceSnapshot.defId]?.printedName ??
                          table.defs[grant.sourceSnapshot.defId]?.name)
                        : grant.sourceId
                          ? label(grant.sourceId)
                          : '手動指定'}
                      <button
                        disabled={disabled}
                        onClick={() => void send({ type: 'keyword', grant, remove: true })}
                      >
                        除去
                      </button>
                    </p>
                  ))}
              </details>
            </>
          )}
        </CockpitWorkPanel>
      )}
      {ability && table.cards[ability] && (
        <CockpitWorkPanel
          key={`${ability}:${abilityChoice ?? 'default'}`}
          preserveDraft
          folded={abilityPeek}
          onPeekChange={setAbilityPeek}
          title={`《${label(ability)}》の能力`}
          onClose={() => {
            setAbility(null);
            setAbilityContext(null);
          }}
        >
          <CockpitAbilityTools
            key={`${ability}:${abilityChoice ?? 'default'}`}
            initialChoice={abilityChoice}
            table={table}
            sourceId={ability}
            selected={selected}
            disabled={disabled}
            expanded
            send={async (operation) => {
              const saved = await send(
                operation,
                abilityContext ?? captureExpectedInteractionContext(table),
              );
              if (saved) {
                setAbility(null);
                setAbilityContext(null);
              }
              return saved;
            }}
          />
          <button
            onClick={() => {
              setAbility(null);
              setAbilityContext(null);
            }}
          >
            能力の使用をやめる
          </button>
        </CockpitWorkPanel>
      )}
      {confirmEnd && (
        <Modal title="ゲームを終了しますか" onClose={() => setConfirmEnd(false)}>
          <p>
            ゲームを終了すると、この卓では操作できなくなります。盤面は保存できますが、保存した盤面から再開しても終了は取り消せません。
          </p>
          <button
            disabled={busy || uncertain}
            onClick={() =>
              void send({ type: 'end' }).then((saved) => {
                if (saved) {
                  setConfirmEnd(false);
                  setMenu(false);
                }
              })
            }
          >
            ゲームを終了する
          </button>
          <button onClick={() => setConfirmEnd(false)}>続ける</button>
        </Modal>
      )}
      {cast && (
        <CockpitWorkPanel
          key={cast.cardId}
          preserveDraft
          folded={castPeek}
          onPeekChange={setCastPeek}
          wide
          title={`《${label(cast.cardId)}》の支払い確認`}
          onClose={() => setCast(null)}
        >
          <div className="table-cast-layout">
            <div className="table-cast-editor">
              <div className="table-cast-card">
                <CardView
                  instance={{ ...table.cards[cast.cardId], tapped: false }}
                  def={table.defs[table.cards[cast.cardId].defId]}
                  size="small"
                  draggable={false}
                />
                <div>
                  <strong>《{label(cast.cardId)}》</strong>
                  <p>
                    {table.defs[table.cards[cast.cardId].defId].faces[
                      table.cards[cast.cardId].faceIndex
                    ]?.manaCost || 'マナコストなし'}
                  </p>
                  <p>
                    {table.defs[table.cards[cast.cardId].defId].faces[
                      table.cards[cast.cardId].faceIndex
                    ]?.printedTypeLine ??
                      table.defs[table.cards[cast.cardId].defId].faces[
                        table.cards[cast.cardId].faceIndex
                      ]?.typeLine}
                  </p>
                </div>
              </div>
              <details className="table-cast-adjust">
                <summary>コストを変更・支払いを省略</summary>
                <div className="cockpit-cast-modes">
                  <button
                    aria-pressed={cast.manualManaCost === null}
                    onClick={() =>
                      prepareCast(
                        cast.cardId,
                        cast.x,
                        cast.excludedSourceIds,
                        cast.targets,
                        null,
                        '',
                      )
                    }
                  >
                    通常の支払い
                  </button>
                  <button
                    aria-pressed={cast.costNote === 'マナ支払いを省略'}
                    onClick={() =>
                      prepareCast(cast.cardId, cast.x, [], cast.targets, '', 'マナ支払いを省略')
                    }
                  >
                    マナを支払わずに唱える
                  </button>
                </div>
                {cast.costNote === 'マナ支払いを省略' && (
                  <p role="status">マナを消費せずに唱えます。支払いを省略した記録を残します。</p>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={cast.manualManaCost !== null && cast.costNote !== 'マナ支払いを省略'}
                    onChange={(event) =>
                      prepareCast(
                        cast.cardId,
                        cast.x,
                        cast.excludedSourceIds,
                        cast.targets,
                        event.target.checked ? '' : null,
                        '',
                      )
                    }
                  />
                  コストを調整する
                </label>
                {cast.manualManaCost !== null && cast.costNote !== 'マナ支払いを省略' && (
                  <fieldset>
                    <legend>本文と既に払ったコストを確認</legend>
                    <label>
                      最終マナコスト（統率者税込・空欄は0）
                      <input
                        value={cast.manualManaCost}
                        onChange={(event) =>
                          prepareCast(
                            cast.cardId,
                            cast.x,
                            cast.excludedSourceIds,
                            cast.targets,
                            event.target.value,
                            cast.costNote,
                          )
                        }
                      />
                    </label>
                    <label>
                      軽減・追加コスト・支払済み操作の確認記録
                      <input
                        value={cast.costNote}
                        onChange={(event) =>
                          prepareCast(
                            cast.cardId,
                            cast.x,
                            cast.excludedSourceIds,
                            cast.targets,
                            cast.manualManaCost,
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <p>
                      マナ以外の追加コストは下の有限項目で選ぶと、この「唱える」と同じ確定操作で支払います。手動指定は合法性の自動確認ではありません。
                    </p>
                  </fieldset>
                )}
              </details>
              {table.defs[table.cards[cast.cardId].defId].faces[
                table.cards[cast.cardId].faceIndex
              ]?.manaCost?.includes('{X}') && (
                <label>
                  Xの値
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={cast.x}
                    onChange={(event) =>
                      prepareCast(
                        cast.cardId,
                        Number(event.target.value),
                        cast.excludedSourceIds,
                        cast.targets,
                      )
                    }
                  />
                </label>
              )}
              <details>
                <summary>使うマナ源を変更</summary>
                <p>
                  使わない発生源のチェックを外すと、未確定の支払い案を作り直します。生成色を指定する場合は先にマナ生成を確定してください。
                </p>
                {battlefieldFor(table.cards[cast.cardId].controllerId).map((id, index) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={!cast.excludedSourceIds.includes(id)}
                      onChange={(event) =>
                        prepareCast(
                          cast.cardId,
                          cast.x,
                          event.target.checked
                            ? cast.excludedSourceIds.filter((source) => source !== id)
                            : [...cast.excludedSourceIds, id],
                          cast.targets,
                        )
                      }
                    />
                    《{label(id)}》 #{index + 1}
                  </label>
                ))}
              </details>
              <CockpitCastAdditionalCosts
                table={table}
                castCardId={cast.cardId}
                selected={selected}
                costs={cast.additionalCosts}
                disabled={disabled}
                label={label}
                onChange={(additionalCosts) =>
                  prepareCast(
                    cast.cardId,
                    cast.x,
                    cast.excludedSourceIds,
                    cast.targets,
                    cast.manualManaCost,
                    cast.costNote,
                    additionalCosts,
                  )
                }
              />
              <details>
                <summary>対象を変更</summary>
                <p>盤面で選択していたカードを引き継ぎます。</p>
                <button
                  onClick={() =>
                    setCast({
                      ...cast,
                      targets: [
                        ...new Set([
                          ...cast.targets,
                          ...selected.filter(
                            (id) =>
                              id !== cast.cardId &&
                              !['hand', 'library'].includes(table.cards[id]?.zone ?? ''),
                          ),
                        ]),
                      ],
                    })
                  }
                >
                  盤面の選択を対象へ追加
                </button>
                {cast.targets
                  .filter((id) => table.cards[id])
                  .map((id) => (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked
                        onChange={() =>
                          setCast({
                            ...cast,
                            targets: cast.targets.filter((target) => target !== id),
                          })
                        }
                      />
                      《{label(id)}》
                    </label>
                  ))}
                {table.stack.map((entry, index) => (
                  <label key={entry.id}>
                    <input
                      type="checkbox"
                      checked={cast.targets.includes(entry.id)}
                      onChange={(event) =>
                        setCast({
                          ...cast,
                          targets: event.target.checked
                            ? [...cast.targets, entry.id]
                            : cast.targets.filter((id) => id !== entry.id),
                        })
                      }
                    />
                    Stack {index + 1}: {label(entry.id)}
                  </label>
                ))}
                {table.seats.map((entry) => (
                  <label key={entry.id}>
                    <input
                      type="checkbox"
                      checked={cast.targets.includes(entry.id)}
                      onChange={(event) =>
                        setCast({
                          ...cast,
                          targets: event.target.checked
                            ? [...cast.targets, entry.id]
                            : cast.targets.filter((id) => id !== entry.id),
                        })
                      }
                    />
                    {entry.label}
                  </label>
                ))}
              </details>
            </div>
            <aside className="table-cast-payment" aria-label="支払案">
              <div className="table-cast-payment__review">
                <h3>今回の支払い</h3>
                <div className="table-cast-resources">
                  {[
                    ...new Set(
                      cast.paymentPlan.flatMap((command) =>
                        'cardId' in command && typeof command.cardId === 'string'
                          ? [command.cardId]
                          : [],
                      ),
                    ),
                  ]
                    .filter((id) => table.cards[id])
                    .map((id) => (
                      <figure key={id}>
                        <CardView
                          instance={table.cards[id]}
                          def={table.defs[table.cards[id].defId]}
                          size="small"
                          draggable={false}
                        />
                        <figcaption>《{label(id)}》</figcaption>
                      </figure>
                    ))}
                </div>
                {cast.costNote && <p role="status">{cast.costNote}</p>}
                <p>
                  対象：
                  {cast.targets
                    .map(
                      (id) =>
                        table.seats.find((seat) => seat.id === id)?.label ?? `《${label(id)}》`,
                    )
                    .join('、') || '指定なし'}
                </p>
                {cast.error && <p role="alert">{cast.error}</p>}
                {!cast.error &&
                  !cast.paymentPlan.length &&
                  !cast.additionalCostPlan.length && <p>支払い操作はありません。</p>}
                <ul>
                  {[...cast.paymentPlan, ...cast.additionalCostPlan].map((command, index) => (
                    <li key={index}>{cockpitCostText(command, label)}</li>
                  ))}
                </ul>
              </div>
              <button
                className="table-cast-confirm"
                disabled={disabled || Boolean(cast.error)}
                onClick={() =>
                  void send(
                    {
                      type: 'cast',
                      cardId: cast.cardId,
                      sourceZone: cast.sourceZone,
                      targets: cast.targets,
                      x: cast.x,
                      excludedSourceIds: cast.excludedSourceIds,
                      manualManaCost: cast.manualManaCost,
                      costNote: cast.costNote,
                      paymentPlan: cast.paymentPlan,
                      additionalCosts: cast.additionalCosts,
                    },
                    cast.context,
                  ).then((saved) => {
                    if (saved) setCast(null);
                  })
                }
              >
                {cast.costNote === 'マナ支払いを省略' ? '支払いを省略して唱える' : '支払って唱える'}
              </button>
              <button onClick={() => setCast(null)}>唱えるのをやめる</button>
            </aside>
          </div>
        </CockpitWorkPanel>
      )}
    </CockpitCardPresentation>
  );
}
