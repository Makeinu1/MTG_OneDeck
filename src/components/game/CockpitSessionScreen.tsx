import { CockpitRoomControls } from './CockpitRoomControls';
import type { CockpitControl } from '../../online/browser/cockpitClient';
import type { GameSnapshot } from '../../data/gameSnapshot';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InitDeckCard } from '../../engine/init';
import { manaActivationChoices } from '../../engine/autotap';
import {
  manaColors,
  tableManaResources,
  tableCastPayment,
  tableZones,
  type TableOperation,
} from '../../engine/cockpitTable';
import type { GameCommand } from '../../engine/commands';
import type { ZoneId } from '../../engine/types';
import type { CockpitSessionView } from '../../online/browser/cockpitClient';
import { CockpitClient } from '../../online/browser/cockpitClient';
import { CardView } from '../CardView';
import { Modal } from '../Modal';
import { CockpitSelectionTools } from './CockpitSelectionTools';
import { CockpitCardTools, CockpitTokenTools } from './CockpitCardTools';
import { CockpitAbilityTools } from './CockpitAbilityTools';
import { cockpitCostText } from './cockpitCostText';
import { CockpitBattleTools } from './CockpitBattleTools';
import { CockpitCleanupTools } from './CockpitCleanupTools';
import { CommanderRitualLayer } from './presentation/CommanderRitualLayer';
import { SemanticPresentationLayer } from './presentation/SemanticPresentationLayer';
import { publishCockpitOperation } from './cockpitPresentation';
import { useAudioVisual } from './presentation/audioVisualContext';
import { saveAudioPreferences } from './presentation/audioVisualPreferences';
import { ThemeToggle } from '../ThemeToggle';
import { CockpitManaBatch } from './CockpitManaBatch';
import './cockpitSession.css';

const zoneLabels: Record<ZoneId, string> = {
  hand: '手札',
  library: '山札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
  stack: 'Stack',
};
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
}: {
  deck: InitDeckCard[] | null;
  snapshot?: GameSnapshot;
  seats?: 2 | 4;
  invitation?: string;
  onBack: () => void;
}) {
  const audio = useAudioVisual();
  const [view, setView] = useState<CockpitSessionView | null>(null);
  const [roomInvitation, setRoomInvitation] = useState<string | null>(null);
  const [message, setMessage] = useState('接続中…');
  const [busy, setBusy] = useState(true);
  const [uncertain, setUncertain] = useState(false);
  const [seatId, setSeatId] = useState('P1');
  const [zone, setZone] = useState<ZoneId>('hand');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [stackDetail, setStackDetail] = useState<string | null>(null);
  const [stackDestination, setStackDestination] = useState<ZoneId>('graveyard');
  const [to, setTo] = useState<ZoneId>('battlefield');
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [cast, setCast] = useState<{
    cardId: string;
    x: number;
    excludedSourceIds: string[];
    manualManaCost: string | null;
    costNote: string;
    targets: string[];
    paymentPlan: GameCommand[];
    error: string;
  } | null>(null);
  const [keyword, setKeyword] = useState('flying');
  const [keywordValue, setKeywordValue] = useState('');
  const [keywordSource, setKeywordSource] = useState('resolution');
  const [duration, setDuration] = useState('ターン終了まで');
  const clientRef = useRef<CockpitClient | null>(null);
  const viewRef = useRef<CockpitSessionView | null>(null);
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
    const client = new CockpitClient(
      (next) => {
        if (active) {
          if (initial && next.multiplayer) setSeatId(next.multiplayer.ownSeatId);
          initial = false;
          if (viewRef.current?.multiplayer?.masterId !== next.multiplayer?.masterId) {
            setDetail(null);
            setCast(null);
            setSelected([]);
          }
          setSelected((current) => current.filter((id) => Boolean(next.table.cards[id])));
          viewRef.current = next;
          setView(next);
          setRoomInvitation(client.invitation());
        }
      },
      (issue) => {
        if (active) {
          setMessage(issue);
          setUncertain(true);
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
          setUncertain(true);
        }
      });
    return () => {
      active = false;
      client.dispose();
    };
  }, [deck, snapshot, seats, invitation]);
  async function send(operation: TableOperation | { type: 'undo' } | { type: 'redo' }) {
    if (busy || uncertain) return false;
    setBusy(true);
    setMessage('送信中…');
    try {
      const before = viewRef.current?.table;
      await clientRef.current?.commit(operation);
      const after = viewRef.current?.table;
      if (before && after) publishCockpitOperation(operation, before, after);
      setMessage('サーバー保存済み');
      return true;
    } catch (error) {
      setUncertain(
        !(
          error instanceof Error &&
          'code' in error &&
          [
            'REVISION_CONFLICT',
            'ELIMINATION_REQUIRES_CONTROL_REVIEW',
            'NOT_AUTHORIZED',
            'PREGAME_INCOMPLETE',
            'OWNER_ABSENT',
          ].includes(String(error.code))
        ),
      );
      setMessage(error instanceof Error ? error.message : '結果を確認中です。再接続してください。');
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function control(operation: CockpitControl): Promise<void> {
    if (busy || uncertain) return;
    setBusy(true);
    try {
      await clientRef.current?.control(operation);
      setMessage('操作権と共有状態を保存しました。');
    } catch (error) {
      setUncertain(
        !(
          error instanceof Error &&
          'code' in error &&
          [
            'REVISION_CONFLICT',
            'ELIMINATION_REQUIRES_CONTROL_REVIEW',
            'NOT_AUTHORIZED',
            'PREGAME_INCOMPLETE',
            'OWNER_ABSENT',
          ].includes(String(error.code))
        ),
      );
      setMessage(error instanceof Error ? error.message : '再接続してください。');
    } finally {
      setBusy(false);
    }
  }
  async function checkpoint(restore: boolean) {
    setBusy(true);
    try {
      if (restore) {
        await clientRef.current?.restoreCheckpoint();
        setUncertain(false);
      } else await clientRef.current?.saveCheckpoint();
      setMessage(
        restore
          ? '保存checkpointから新しい非公開セッションを開始しました。履歴はここからです。'
          : '端末checkpointを保存しました。サーバーの6時間期限とは別に保持します。',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '端末保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  }
  async function reconnect() {
    setBusy(true);
    try {
      const result = await clientRef.current?.reconnect();
      setUncertain(false);
      setMessage(
        result === 'unseen'
          ? '前の操作は未確定です。盤面を確認し、必要ならもう一度操作してください。'
          : 'サーバーの確定状態に復帰しました。',
      );
    } catch (error) {
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
        <button onClick={() => void reconnect()} disabled={busy}>
          再接続
        </button>
        <button onClick={() => void checkpoint(true)} disabled={busy}>
          端末checkpointから新しいセッション
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
  const displayZone = zone === 'battlefield' ? 'hand' : zone;
  const visibleIds = seat.zones[displayZone].filter((id) => Boolean(table.cards[id]));
  const multi = view.multiplayer;
  const pregameOwn = multi && !multi.started && multi.ownSeatId === seatId && !multi.paused;
  const canBlock = Boolean(
    multi?.started &&
    !multi.paused &&
    !table.seats.find((s) => s.id === multi.ownSeatId)?.eliminated &&
    table.combat,
  );
  const detailCard = detail ? table.cards[detail] : undefined;
  const detailDef = detailCard ? table.defs[detailCard.defId] : undefined;
  const stackEntry =
    table.stack.find((entry) => entry.id === stackDetail) ??
    (table.resolution?.id === stackDetail ? table.resolution : null);
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
  function prepareCast(
    cardId: string,
    x = 0,
    excludedSourceIds: string[] = [],
    targets = selected.filter((id) => id !== cardId),
    manualManaCost: string | null = cast?.cardId === cardId ? cast.manualManaCost : null,
    costNote = cast?.cardId === cardId ? cast.costNote : '',
  ) {
    let paymentPlan: GameCommand[] = [];
    let error = '';
    try {
      paymentPlan = tableCastPayment(table, cardId, x, excludedSourceIds, manualManaCost, costNote);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'マナ支援の条件を確認してください。';
    }
    setDetail(null);
    setCast({
      cardId,
      x,
      excludedSourceIds,
      manualManaCost,
      costNote,
      targets,
      paymentPlan,
      error,
    });
  }
  function renderCard(id: string, compact = false) {
    return (
      <article key={id} className={selected.includes(id) ? 'is-selected' : ''}>
        <div className="cockpit-session__card-image">
          <CardView
            instance={table.cards[id]}
            def={table.defs[table.cards[id].defId]}
            size={compact ? 'small' : 'hand'}
            draggable={false}
            badge={table.cards[id].isCommander ? '統率者' : undefined}
            onContextMenu={(event) => {
              event.preventDefault();
              setDetail(id);
            }}
            onTouchTap={() => setDetail(id)}
            onDoubleClick={() => setDetail(id)}
          />
        </div>
        <label>
          <input
            type="checkbox"
            checked={selected.includes(id)}
            onChange={() =>
              setSelected((ids) =>
                ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
              )
            }
          />
          {label(id)}
          {table.cards[id].tapped ? ' ↷' : ''}
        </label>
        <button onClick={() => setDetail(id)}>本文・操作</button>
        {table.modifiers
          .filter((item) => item.cardId === id)
          .map((item) => (
            <small key={item.id}>
              修整 {item.power >= 0 ? '+' : ''}
              {item.power}/{item.toughness >= 0 ? '+' : ''}
              {item.toughness}・{item.duration}
            </small>
          ))}
        {table.cards[id].attachedTo && (
          <small>添付先:《{label(table.cards[id].attachedTo)}》</small>
        )}
      </article>
    );
  }
  const disabled = busy || uncertain || table.ended || Boolean(multi && !multi.canOperate);
  return (
    <main
      className={`cockpit-session${multi ? ' cockpit-session--multiplayer' : ''}`}
      data-testid="game-screen"
    >
      <SemanticPresentationLayer />
      <CommanderRitualLayer resolveCue={commanderCue} />
      {table.ended && (
        <p role="status">
          {table.seats.filter((entry) => !entry.eliminated).length === 1
            ? `勝者: ${table.seats.find((entry) => !entry.eliminated)?.label}。`
            : ''}
          終局確定済みです。盤面は閲覧・保存できます。操作・undo・保存読込みでの再開はできません。
        </p>
      )}
      <header className="cockpit-session__bar">
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
        <button onClick={() => void reconnect()} disabled={busy}>
          再接続
        </button>
        <button disabled={disabled || !view.canUndo} onClick={() => void send({ type: 'undo' })}>
          undo
        </button>
        <button disabled={disabled || !view.canRedo} onClick={() => void send({ type: 'redo' })}>
          redo
        </button>
        {message.includes('失効') && (
          <button disabled={busy} onClick={() => void checkpoint(true)}>
            端末checkpointから新しいセッション
          </button>
        )}
        <button
          disabled={busy || uncertain || Boolean(multi)}
          onClick={() => void checkpoint(false)}
        >
          端末へ保存
        </button>
        <button onClick={onBack}>デッキへ</button>
        <details>
          <summary>音・表示</summary>
          <ThemeToggle compact />
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
      </header>
      <CockpitRoomControls
        view={view}
        invitation={roomInvitation}
        busy={busy || uncertain}
        send={control}
      />
      <p className="cockpit-session__note">
        人が効果を判断し、操作を確定します。
        {multi
          ? '通常操作はマスターが代行し、防御側は自席のブロックを確定できます。'
          : '受け身Botへの操作はあなたが代行します。'}
        稼働セッションは最終利用から6時間で失効します。
      </p>
      <section className="cockpit-session__seats" aria-label="席">
        {table.seats.map((entry) => (
          <article key={entry.id} className={entry.id === seatId ? 'is-selected' : ''}>
            <button onClick={() => setSeatId(entry.id)}>
              {entry.label} · ライフ {entry.life}
            </button>
            <span>
              手札 {multi?.counts[entry.id]?.hand ?? entry.zones.hand.length} / 山札{' '}
              {multi?.counts[entry.id]?.library ?? entry.zones.library.length}
            </span>
            <button
              disabled={disabled}
              aria-label={`${entry.label}のライフを1減らす`}
              onClick={() => void send({ type: 'life', seatIds: [entry.id], delta: -1 })}
            >
              −
            </button>
            <button
              disabled={disabled}
              aria-label={`${entry.label}のライフを1増やす`}
              onClick={() => void send({ type: 'life', seatIds: [entry.id], delta: 1 })}
            >
              ＋
            </button>
            <section
              className="cockpit-session__cards cockpit-session__board"
              aria-label={`${entry.label}の戦場`}
            >
              {battlefieldFor(entry.id).map((id) => renderCard(id, true))}
              {!battlefieldFor(entry.id).length && (
                <p className="cockpit-session__note">戦場にカードはありません。</p>
              )}
            </section>
          </article>
        ))}
      </section>
      <section className="cockpit-session__bar" aria-label="進行">
        <strong>操作対象: {seat.label}</strong>
        {!seat.kept && (
          <>
            <span>
              引き直し {seat.mulligans}回（練習では初回無料）。キープ時に
              {Math.max(0, seat.mulligans - 1)}枚を選んで山札の下へ。
            </span>
            <button
              disabled={busy || uncertain || Boolean(multi && !pregameOwn)}
              onClick={() =>
                void send({
                  type: 'mulligan',
                  seatId,
                  seed: crypto.getRandomValues(new Uint32Array(1))[0],
                })
              }
            >
              マリガン
            </button>
            <button
              disabled={busy || uncertain || Boolean(multi && !pregameOwn)}
              onClick={() =>
                void send({
                  type: 'keep',
                  seatId,
                  bottom: selected.filter((id) => seat.zones.hand.includes(id)),
                })
              }
            >
              初手をキープ
            </button>
          </>
        )}
        <button disabled={disabled} onClick={() => void send({ type: 'draw', seatId, count: 1 })}>
          1枚ドロー
        </button>
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
          次のフェイズ
        </button>
        <button
          disabled={
            disabled ||
            table.hold ||
            Boolean(table.resolution) ||
            Boolean(table.combat) ||
            table.stack.length > 0
          }
          onClick={() => void send({ type: 'turn' })}
        >
          次のターン
        </button>
        <button
          disabled={disabled || Boolean(multi)}
          onClick={() => void send({ type: 'hold', held: !table.hold })}
        >
          {table.hold ? 'HOLDを解除' : 'HOLD・進行を止める'}
        </button>
        {manaColors.map((color) => (
          <span key={color}>
            {color} {seat.mana[color]}{' '}
            <button
              aria-label={`${color}マナを追加`}
              disabled={disabled}
              onClick={() => void send({ type: 'mana', seatId, color, delta: 1 })}
            >
              ＋
            </button>
            <button
              aria-label={`${color}マナを減らす`}
              disabled={disabled || seat.mana[color] === 0}
              onClick={() => void send({ type: 'mana', seatId, color, delta: -1 })}
            >
              −
            </button>
          </span>
        ))}
      </section>
      <details className="cockpit-session__tools">
        <summary>通常手順のショートカット</summary>
        <p>
          アンタップ開始時の任意操作です。途中で誘発や判断が必要なら個別に進めてください。HOLD・Stack・処理中は進みません。
        </p>
        <button
          disabled={
            disabled ||
            table.hold ||
            table.phase !== 'untap' ||
            Boolean(table.resolution) ||
            table.stack.length > 0
          }
          onClick={() => void send({ type: 'shortcut' })}
        >
          現在のターンの席をアンタップ→1枚ドロー→メイン
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
        <CockpitCleanupTools
          table={table}
          seatId={seatId}
          selected={selected}
          disabled={disabled}
          send={send}
        />
      </details>
      <section className="cockpit-session__stack" aria-label="Stackと処理" data-testid="stack-band">
        <strong>Stack {table.stack.length}</strong>
        {table.stack.map((entry) => (
          <button key={entry.id} onClick={() => setStackDetail(entry.id)}>
            《{label(entry.source.id)}》 · {entry.copied ? 'コピー' : '支払済み'}
          </button>
        ))}
        {table.resolution ? (
          <>
            <strong>処理中:《{label(table.resolution.source.id)}》</strong>
            <span>基本操作を続け、最後に行き先を選んで終了します。</span>
            <select
              aria-label="処理後の行き先"
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
            <button disabled={disabled} onClick={() => void send({ type: 'resolve.end', to })}>
              処理を終える
            </button>
          </>
        ) : (
          <button
            disabled={disabled || !table.stack.length}
            onClick={() => void send({ type: 'resolve.begin' })}
          >
            処理を始める
          </button>
        )}
      </section>
      <nav className="cockpit-session__bar" aria-label="領域">
        {tableZones
          .filter((item) => item !== 'stack')
          .map((item) => (
            <button key={item} aria-pressed={zone === item} onClick={() => setZone(item)}>
              {zoneLabels[item]}{' '}
              {item === 'battlefield'
                ? battlefieldFor(seatId).length
                : (multi?.counts[seatId]?.[item] ?? seat.zones[item].length)}
            </button>
          ))}
      </nav>
      {multi && ['hand', 'library'].includes(displayZone) && (
        <div className="cockpit-session__bar">
          <span>非公開の領域は明示して閲覧します。閲覧は他の席には公開されません。</span>
          {multi.canOperate && (
            <button
              disabled={busy || uncertain}
              onClick={() =>
                void control({ type: 'peek', seatId, zone: displayZone as 'hand' | 'library' })
              }
            >
              この領域を自分だけ閲覧
            </button>
          )}
          {multi.peek && (
            <button
              disabled={busy || uncertain}
              onClick={() => void control({ type: 'peek', seatId, zone: null })}
            >
              非公開の閲覧を閉じる
            </button>
          )}
        </div>
      )}
      <section
        className="cockpit-session__cards"
        aria-label={`${seat.label}の${zoneLabels[displayZone]}`}
      >
        {visibleIds.map((id) => renderCard(id))}
      </section>
      <footer className="cockpit-session__bar">
        <span>選択 {selected.length}枚（席・画面を移っても保持）</span>
        <button onClick={() => setSelected([])}>選択取消</button>
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
          選択を移動
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
      </footer>
      <CockpitSelectionTools
        table={table}
        seatId={seatId}
        selected={selected}
        disabled={disabled}
        send={send}
        select={setSelected}
      />
      <CockpitTokenTools
        table={table}
        seatId={seatId}
        selected={selected}
        disabled={disabled}
        send={send}
      />
      <CockpitBattleTools
        table={table}
        selected={selected}
        disabled={disabled}
        defendingSeatId={multi?.ownSeatId}
        canBlock={canBlock && !busy && !uncertain}
        send={send}
      />
      {stackEntry && (
        <Modal
          title={`Stack:《${label(stackEntry.source.id)}》`}
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
            <summary>このStackを移す・取り除く（打ち消し等）</summary>
            <p>選んだ項目だけを取り除きます。別の効果を処理中なら、その発生源と処理は続きます。</p>
            {stackEntry.kind === 'spell' && (
              <label>
                Stackからの移動先
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
              このStack項目の除去を確定
            </button>
          </details>

          <p>コピーの担当: {seat.label}。呪文・能力のコピーをStackへ置き、効果は手動処理します。</p>
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
            同じ対象でStackをコピー
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
            盤面の選択を対象にしてStackをコピー
          </button>
        </Modal>
      )}
      {detailCard && (
        <Modal title={`《${label(detailCard.id)}》`} onClose={() => setDetail(null)} allowBoardPeek>
          <p>
            {detailDef?.faces[detailCard.faceIndex]?.manaCost} ·{' '}
            {detailDef?.faces[detailCard.faceIndex]?.typeLine}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>
            {detailDef?.faces[detailCard.faceIndex]?.printedText ??
              detailDef?.faces[detailCard.faceIndex]?.oracleText}
          </p>
          <p>
            所有者 {table.seats.find((seat) => seat.id === detailCard.ownerId)?.label} /
            コントローラー {table.seats.find((seat) => seat.id === detailCard.controllerId)?.label}{' '}
            / {zoneLabels[detailCard.zone]}
          </p>
          <CockpitCardTools
            key={detailCard.id}
            table={table}
            cardId={detailCard.id}
            disabled={disabled}
            send={send}
          />
          <CockpitAbilityTools
            key={`ability-${detailCard.id}`}
            table={table}
            sourceId={detailCard.id}
            selected={selected}
            disabled={disabled}
            send={send}
          />
          <button
            disabled={disabled || !['hand', 'command'].includes(detailCard.zone)}
            onClick={() => prepareCast(detailCard.id)}
          >
            支払い案を確認して唱える
          </button>
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
                  マナ生成:{' '}
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
            </>
          )}
        </Modal>
      )}
      <details className="cockpit-session__tools">
        <summary>一人回しの終了</summary>
        <p>
          中断するだけなら端末へ保存してください。終局確定はundo・保存読込みでも取り消せません。
        </p>
        <button disabled={disabled} onClick={() => setConfirmEnd(true)}>
          終局の確認へ
        </button>
      </details>
      {confirmEnd && (
        <Modal title="終局を確定しますか" onClose={() => setConfirmEnd(false)}>
          <p>
            この一人回しの終局を確定します。未完の処理も含めて盤面は保存できますが、操作は再開できません。undoや古いcheckpointでも取り消せません。
          </p>
          <button
            disabled={busy || uncertain}
            onClick={() =>
              void send({ type: 'end' }).then((saved) => {
                if (saved) setConfirmEnd(false);
              })
            }
          >
            取り消せない終局を確定
          </button>
          <button onClick={() => setConfirmEnd(false)}>確定せず戻る</button>
        </Modal>
      )}
      {cast && (
        <Modal
          title={`《${label(cast.cardId)}》の支払い確認`}
          onClose={() => setCast(null)}
          allowBoardPeek
        >
          <p>以下のマナ生成・非マナ負担とStack登録を一度に確定します。効果は手動処理です。</p>
          <p>
            通常案は印刷マナコスト・X・統率者税を計算します。軽減・追加・代替コストや支払い制限は自動判断しません。
          </p>
          <label>
            <input
              type="checkbox"
              checked={cast.manualManaCost !== null}
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
            最終マナコストを手動で指定する
          </label>
          {cast.manualManaCost !== null && (
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
                非マナコストは必要な基本操作で先に確定して記録し、ここで二重に払いません。手動指定は合法性の自動確認ではありません。
              </p>
            </fieldset>
          )}

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
            <summary>自動支払いに使う発生源</summary>
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
          <details>
            <summary>対象の記録（本文の条件は手動確認）</summary>
            <p>盤面で選択していたカードを引き継ぎます。</p>
            <button
              onClick={() =>
                setCast({
                  ...cast,
                  targets: [
                    ...new Set([...cast.targets, ...selected.filter((id) => id !== cast.cardId)]),
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
                      setCast({ ...cast, targets: cast.targets.filter((target) => target !== id) })
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
          {cast.error && <p role="alert">{cast.error} マナ生成・手動調整を確認してください。</p>}
          <ul>
            {cast.paymentPlan.map((command, index) => (
              <li key={index}>{cockpitCostText(command, label)}</li>
            ))}
          </ul>
          <button
            disabled={disabled || Boolean(cast.error)}
            onClick={() =>
              void send({
                type: 'cast',
                cardId: cast.cardId,
                targets: cast.targets,
                x: cast.x,
                excludedSourceIds: cast.excludedSourceIds,
                manualManaCost: cast.manualManaCost,
                costNote: cast.costNote,
                paymentPlan: cast.paymentPlan,
              }).then((saved) => {
                if (saved) setCast(null);
              })
            }
          >
            この支払いでStackへ
          </button>
        </Modal>
      )}
    </main>
  );
}
