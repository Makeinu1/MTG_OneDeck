import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_KEYBINDINGS, type KeybindingsMap } from '../../data/keybindings';
import { GameScreen } from '../game/GameScreen';
import {
  createPublicOnlineControllerV3,
  encodeOnlineSharedInviteCodeV3,
  readAndScrubPublicOnlineInviteFragmentV3,
  type PublicOnlineDeckOptionV2,
  type PublicOnlineSnapshotV3,
  type PublicOnlineConfigurationV3,
} from '../../online/publicApp';
import './publicOnlineApp.css';
import { OnlineDisplayPairing } from './OnlineDisplayPairing';
import { OnlineGuidedActions } from './OnlineGuidedActions';
import { PersonalWorkbench } from './PersonalWorkbench';
import { PregameLayer } from './OnlinePregameLayer';

export type PublicOnlineAppProps = Readonly<{
  decks: readonly PublicOnlineDeckOptionV2[];
  keybindings?: KeybindingsMap;
  initialDeckId?: string;
  selectedDeckId?: string;
  onDeckSelect?: (deckId: string) => void;
  onBackToSolo: () => void;
  onImportDeck?: () => void;
}>;
const steps = ['入室済み', 'デッキ提出', '準備完了', '対戦開始'] as const;
function cardCount(deck: PublicOnlineDeckOptionV2 | null): number {
  return deck?.entries.reduce((sum, entry) => sum + entry.quantity, 0) ?? 0;
}
function allReady(snapshot: PublicOnlineSnapshotV3): boolean {
  return (
    snapshot.projection?.seats.every(
      (seat) => seat.participantId !== null && seat.acceptedDeck && seat.ready,
    ) === true
  );
}

export function PublicOnlineApp({
  decks,
  keybindings = DEFAULT_KEYBINDINGS,
  initialDeckId = '',
  selectedDeckId: controlledDeckId,
  onDeckSelect,
  onBackToSolo,
  onImportDeck,
}: PublicOnlineAppProps) {
  const controller = useMemo(() => createPublicOnlineControllerV3(), []);
  const [snapshot, setSnapshot] = useState<PublicOnlineSnapshotV3>(() => controller.getSnapshot());
  const [roomConfiguration, setRoomConfiguration] = useState<PublicOnlineConfigurationV3>({ playerCount: 2, startingLife: 40 });
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId || decks[0]?.id || '');
  const [joinCode, setJoinCode] = useState('');
  const [entry, setEntry] = useState<'entry' | 'join'>('entry');
  const [revealed, setRevealed] = useState(false);
  const [kickTarget, setKickTarget] = useState<Readonly<{
    seatIndex: number;
    participantId: string;
    label: string;
  }> | null>(null);
  const [copyNotice, setCopyNotice] = useState('');
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  useEffect(() => {
    const off = controller.subscribe(setSnapshot);
    return () => {
      off();
      controller.disconnect();
    };
  }, [controller]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const invite = readAndScrubPublicOnlineInviteFragmentV3(window.location, window.history);
    if (!invite) return;
    const code = encodeOnlineSharedInviteCodeV3(invite.roomId, invite.admissionCapability);
    const timer = window.setTimeout(() => {
      setJoinCode(code);
      setEntry('join');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (snapshot.mode !== 'forming' || snapshot.busy !== null || joinCode === '') return;
    const timer = window.setTimeout(() => setJoinCode(''), 0);
    return () => window.clearTimeout(timer);
  }, [snapshot.busy, snapshot.mode, joinCode]);
  const activeDeckId = controlledDeckId ?? selectedDeckId;
  const exactDeckIndex = decks.findIndex((deck) => deck.id === activeDeckId);
  const selectedDeckIndex = exactDeckIndex >= 0 ? exactDeckIndex : decks.length > 0 ? 0 : -1;
  const selectedDeck = selectedDeckIndex < 0 ? null : (decks[selectedDeckIndex] ?? null);
  const selectedDeckName = selectedDeck === null
    ? ''
    : controller.displayDeckName(selectedDeck.name, selectedDeckIndex);
  const admitted = snapshot.roomId !== null && snapshot.mode !== 'entry';
  const started = snapshot.lifecycle === 'started';
  const pregamePending = started && snapshot.pregame !== null && snapshot.pregame.phase !== 'complete';
  const local =
    snapshot.ownSeatIndex === null
      ? null
      : (snapshot.projection?.seats[snapshot.ownSeatIndex] ?? null);
  const seatLabel = (index: number): string => {
    const seat = snapshot.projection?.seats[index];
    const own = snapshot.ownSeatIndex === index;
    const host = seat?.participantId === snapshot.projection?.hostParticipantId;
    return own && host
      ? 'あなた（ホスト）'
      : own
        ? 'あなた'
        : host
          ? 'ホスト'
          : `プレイヤー${index + 1}`;
  };
  const currentStep = started ? 3 : local?.ready ? 3 : local?.acceptedDeck ? 2 : 1;
  const blockers =
    snapshot.projection?.seats
      .flatMap((seat) => {
        if (seat.participantId === null) return [];
        const label = seatLabel(seat.seatIndex).replace('あなた（ホスト）', 'あなた');
        return [
          !seat.acceptedDeck
            ? `${label}: デッキ未提出`
            : '',
          !seat.ready ? `${label}: 未準備` : '',
        ];
      })
      .filter(Boolean) ?? [];
  const emptySeatCount =
    snapshot.projection?.seats.filter((seat) => seat.participantId === null).length ?? 0;
  const interactionState =
    snapshot.connection === 'online'
      ? 'ready'
      : snapshot.connection === 'reconnecting'
        ? 'offline'
        : 'updating';
  const actionError = (...actions: readonly string[]) => {
    if (
      snapshot.error === null ||
      snapshot.errorIssue === null ||
      !actions.includes(snapshot.errorIssue.action)
    )
      return null;
    return (
      <div className="public-online-app__error" role="alert" data-testid="online-error">
        <p>{snapshot.error}</p>
        <p data-testid="online-error-guidance">次の対応: {snapshot.errorIssue.action}</p>
        <p><small>同じ操作の再試行: {snapshot.errorIssue.retryable ? '可能' : '不可'}</small></p>
        <p><small>照会 ID: {snapshot.errorIssue.correlationId}</small></p>
        {snapshot.errorIssue.retryable && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void controller.retry()}
          >
            {snapshot.errorIssue.action}
          </button>
        )}
      </div>
    );
  };
  const chooseDeck = (id: string) => {
    setSelectedDeckId(id);
    onDeckSelect?.(id);
  };
  return (
    <main className="public-online-app" data-testid="public-online-app">
      <header className="public-online-app__header">
        <div>
          <p className="public-online-app__eyebrow">ONLINE ROOM</p>
          <h1>オンライン対戦</h1>
          <p>選んだデッキで、招待制の対戦へ進みます。</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          data-testid="online-back-to-solo"
          onClick={() => {
            controller.disconnect();
            onBackToSolo();
          }}
        >
          一人回しに戻る
        </button>
      </header>
      {!admitted && (
        <section className="public-online-app__lobby" aria-label="オンライン対戦の入口">
          {snapshot.recoveryAvailable && (
            <div className="public-online-app__recovery">
              <strong>進行中の対戦があります</strong>
              <span>このブラウザの参加情報から復帰できます。</span>
              <button
                type="button"
                className="btn btn--primary"
                data-testid="online-recover"
                onClick={() => void controller.recover()}
              >
                対戦に戻る
              </button>
            </div>
          )}
          {entry === 'entry' ? (
            <>
              <h2>対戦の入口</h2>
              <p>部屋を作るか、共有された招待コードを1つ入力してください。</p>
              <fieldset className="public-online-app__room-config" aria-label="対戦人数">
                <legend>対戦人数</legend>
                <button type="button" data-testid="online-player-count-2" aria-pressed={roomConfiguration.playerCount === 2} onClick={() => setRoomConfiguration({ playerCount: 2, startingLife: roomConfiguration.startingLife })}>2人</button>
                <button type="button" data-testid="online-player-count-4" aria-pressed={roomConfiguration.playerCount === 4} onClick={() => setRoomConfiguration({ playerCount: 4, startingLife: 40 })}>4人</button>
              </fieldset>
              <fieldset className="public-online-app__room-config" aria-label="開始ライフ">
                <legend>{roomConfiguration.playerCount === 4 ? '開始ライフ 40（固定）' : '開始ライフ'}</legend>
                {roomConfiguration.playerCount === 2 && <>
                  <button type="button" data-testid="online-starting-life-20" aria-pressed={roomConfiguration.startingLife === 20} onClick={() => setRoomConfiguration({ playerCount: 2, startingLife: 20 })}>20</button>
                  <button type="button" data-testid="online-starting-life-40" aria-pressed={roomConfiguration.startingLife === 40} onClick={() => setRoomConfiguration({ playerCount: 2, startingLife: 40 })}>40</button>
                </>}
              </fieldset>
              <div className="public-online-app__choice-grid">
                <button
                  type="button"
                  className="btn btn--primary"
                  data-testid="online-create-shared"
                  disabled={snapshot.busy !== null || selectedDeck === null}
                  onClick={() => void controller.createShared(roomConfiguration)}
                >
                  部屋を作る
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  data-testid="online-open-join"
                  onClick={() => setEntry('join')}
                >
                  招待で参加
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>招待で参加</h2>
              <label htmlFor="online-shared-invite">招待コード</label>
              <input
                id="online-shared-invite"
                data-testid="online-shared-invite"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                autoComplete="off"
                inputMode="text"
                placeholder="招待コードを入力"
              />
              <div className="public-online-app__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  data-testid="online-join-shared"
                  disabled={snapshot.busy !== null || joinCode.trim() === ''}
                  onClick={() => void controller.joinShared(joinCode.trim())}
                >
                  ロビーに参加
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setEntry('entry')}>
                  キャンセル
                </button>
              </div>
            </>
          )}
          {onImportDeck && (
            <button
              type="button"
              className="btn btn--ghost"
              data-testid="online-import-deck"
              onClick={onImportDeck}
            >
              デッキを登録・インポート
            </button>
          )}
          {actionError(
            '対戦に戻る',
            'もう一度部屋を作る',
            'もう一度参加',
            '招待コードを確認',
            '新しい招待を入力',
          )}
        </section>
      )}
      {!admitted && selectedDeck && (
        <section className="public-online-app__selected-deck" aria-label="選択中のデッキ">
          <strong>《{selectedDeckName}》</strong>
          <span>{cardCount(selectedDeck)}枚 · このデッキで遊ぶ</span>
          <select
            aria-label="使用デッキ"
            data-testid="online-deck-select"
            value={selectedDeck.id}
            onChange={(e) => chooseDeck(e.target.value)}
          >
            {decks.map((deck, index) => (
              <option key={deck.id} value={deck.id}>
                {controller.displayDeckName(deck.name, index)}
              </option>
            ))}
          </select>
        </section>
      )}
      {admitted && !started && (
        <section className="public-online-app__status" aria-label="対戦ロビー">
          <div className="public-online-app__lobby-heading">
            <div>
              <p className="public-online-app__eyebrow">オンライン対戦</p>
              <h2>対戦ロビー</h2>
              {snapshot.configuration && (
                <p data-testid="online-authoritative-configuration">
                  {snapshot.configuration.playerCount}人・開始ライフ{snapshot.configuration.startingLife}
                </p>
              )}
            </div>
            <span className="public-online-app__transport">
              {snapshot.connection === 'reconnecting'
                ? '再接続中'
                : snapshot.connection === 'failed'
                  ? '接続失敗'
                  : '接続中'}
            </span>
          </div>
          <ol className="public-online-app__steps" aria-label="対戦の進行状況">
            {steps.map((step, index) => (
              <li
                key={step}
                aria-current={index === currentStep ? 'step' : undefined}
                className={index <= currentStep ? 'is-active' : ''}
              >
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          {actionError('ロビーを更新')}
          {selectedDeck && (
            <div className="public-online-app__selected-deck">
              <strong>《{selectedDeckName}》</strong>
              <span>
                {cardCount(selectedDeck)}枚 · デッキ状態: {local?.acceptedDeck ? '提出済み' : '未提出'}
              </span>
              <div className="public-online-app__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  data-testid="online-submit-deck"
                  disabled={snapshot.busy !== null}
                  onClick={() => void controller.submitDeck(selectedDeck)}
                >
                  {local?.acceptedDeck ? 'デッキを再提出' : 'デッキを提出'}
                </button>
                {local?.acceptedDeck && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    data-testid="online-ready-toggle"
                    disabled={snapshot.busy !== null}
                    onClick={() => void controller.toggleReady()}
                  >
                    {local.ready ? '準備完了を取り消す' : '準備完了にする'}
                  </button>
                )}
              </div>
              {snapshot.ownerIssue && (
                <div className="public-online-app__error" role="alert">
                  <p>{snapshot.ownerIssue.message}</p>
                  {snapshot.ownerIssue.retryable && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => void controller.retry()}
                    >
                      デッキを再確認
                    </button>
                  )}
                </div>
              )}
              {actionError('デッキを再確認', '準備状態を更新')}
            </div>
          )}
          <div className="public-online-app__seats" aria-label="参加メンバー">
            {(snapshot.projection?.seats ?? []).map((seat, index) => {
              const own = snapshot.ownSeatIndex === index;
              const label = seatLabel(index);
              return (
                <article key={index} data-testid="online-seat-summary">
                  <strong>{label}</strong>
                  <span>{seat?.participantId ? '入室済み' : '空席'}</span>
                  <span>デッキ: {seat.participantId ? (seat.acceptedDeck ? '提出済み' : '未提出') : '—'}</span>
                  <span>{seat?.participantId ? (seat.ready ? '準備完了' : '未準備') : '—'}</span>
                  {snapshot.isHost && seat?.participantId && !own && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      data-testid={`online-kick-${index}`}
                      onClick={() => setKickTarget({
                        seatIndex: index,
                        participantId: seat.participantId ?? '',
                        label,
                      })}
                    >
                      ロビーから外す
                    </button>
                  )}
                  {kickTarget?.seatIndex === index && (
                    <div role="alertdialog">
                      <p>{kickTarget.label}をロビーから外しますか？</p>
                      {seat?.participantId !== kickTarget.participantId && (
                        <p>参加者が変わりました。確認を閉じて選び直してください。</p>
                      )}
                      <button type="button" onClick={() => setKickTarget(null)}>
                        キャンセル
                      </button>
                      <button
                        type="button"
                        disabled={seat?.participantId !== kickTarget.participantId}
                        onClick={() => {
                          void controller.kick(kickTarget.participantId);
                          setKickTarget(null);
                        }}
                      >
                        確認して外す
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {actionError('もう一度外す')}
          {snapshot.isHost ? (
            <>
              {snapshot.admissionOpen === false ? (
                <div className="public-online-app__invite" data-testid="online-admission-closed">
                  <strong>参加受付は終了しています</strong>
                  <span>この招待から新しい参加者は入室できません。</span>
                </div>
              ) : (
                <div className="public-online-app__invite">
                  <strong>共有招待</strong>
                  <span>
                    {revealed
                      ? (snapshot.invites[0] ?? '招待コードを準備できません')
                      : '招待リンクを準備しました'}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      data-testid="online-invite-link-copy"
                      onClick={() => {
                        const code = snapshot.invites[0];
                        if (!code || !navigator.clipboard) {
                          setCopyNotice('招待リンクをコピーできませんでした。もう一度お試しください。');
                          return;
                        }
                        const link = `${window.location.origin}${window.location.pathname}#online-invite=${encodeURIComponent(code)}`;
                        void navigator.clipboard.writeText(link).then(
                          () => setCopyNotice('招待リンクをコピーしました。'),
                          () => setCopyNotice('招待リンクをコピーできませんでした。もう一度お試しください。'),
                        );
                      }}
                    >
                      招待リンクをコピー
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      data-testid="online-invite-copy"
                      onClick={() => {
                        const code = snapshot.invites[0];
                        if (!code) {
                          setCopyNotice('招待コードをコピーできませんでした。もう一度お試しください。');
                          return;
                        }
                        void controller.copyInvite(code).then((copied) => {
                          setCopyNotice(
                            copied
                              ? '招待コードをコピーしました。'
                              : '招待コードをコピーできませんでした。もう一度お試しください。',
                          );
                        });
                      }}
                    >
                      招待コードをコピー
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setRevealed((value) => !value)}
                    >
                      {revealed ? 'コードを隠す' : 'コードを表示'}
                    </button>
                  </div>
                  <p aria-live="polite" data-testid="online-copy-notice">{copyNotice}</p>
                </div>
              )}
              <div className="public-online-app__host-tools">
                <button
                  type="button"
                  className="btn btn--ghost"
                  data-testid="online-invite-rotate"
                  disabled={snapshot.busy !== null}
                  onClick={() => {
                    setRevealed(false);
                    setCopyNotice('');
                    void controller.rotateInvite();
                  }}
                >
                  招待を再発行
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  data-testid="online-admission-close"
                  disabled={snapshot.busy !== null || snapshot.admissionOpen === false}
                  onClick={() => {
                    setRevealed(false);
                    setCopyNotice('');
                    void controller.closeAdmission();
                  }}
                >
                  参加受付を締める
                </button>
              </div>
              {actionError('招待を再発行', '参加受付を締める')}
              <div className="public-online-app__blockers">
                <strong>開始条件</strong>
                {emptySeatCount > 0 || blockers.length ? (
                  <ul>
                    {emptySeatCount > 0 && <li>空席 {emptySeatCount}</li>}
                    {blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                ) : (
                  <span>開始できます</span>
                )}
                <button
                  type="button"
                  className="btn btn--primary"
                  data-testid="online-start-game"
                  disabled={snapshot.busy !== null || !allReady(snapshot)}
                  onClick={() => void controller.start()}
                >
                  対戦を開始
                </button>
                {actionError('対戦開始を再試行', 'デッキを見直す')}
              </div>
            </>
          ) : (
            <p className="public-online-app__waiting">ホストの開始を待っています</p>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            data-testid="online-leave"
            onClick={() => setLeaveConfirm(true)}
          >
            ロビーを退出
          </button>
          {leaveConfirm && (
            <div role="alertdialog" aria-label="ロビー退出の確認" className="public-online-app__confirm">
              <p>
                {snapshot.isHost
                  ? 'ホストが退出するとロビーは閉じます。退出しますか？'
                  : 'このロビーから退出します。再参加には現在の招待が必要です。'}
              </p>
              <button type="button" className="btn btn--ghost" onClick={() => setLeaveConfirm(false)}>
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn--primary"
                data-testid="online-leave-confirm"
                onClick={() => {
                  setLeaveConfirm(false);
                  void controller.leave();
                }}
              >
                退出する
              </button>
            </div>
          )}
          {actionError('もう一度退出')}
        </section>
      )}
      {started && snapshot.configuration && !pregamePending && (
        <p className="public-online-app__authoritative-configuration" data-testid="online-authoritative-configuration">
          {snapshot.configuration.playerCount}人・開始ライフ{snapshot.configuration.startingLife}
        </p>
      )}
      {pregamePending && snapshot.pregame && (
        <GameScreen
          key={`${snapshot.pregame.revision}-${snapshot.pregame.phase}`}
          keybindings={keybindings}
          presentation={(
            <PregameLayer
              port={{
                projection: snapshot.pregame,
                busy: snapshot.busy !== null,
                connection: snapshot.connection === 'online'
                  ? 'online'
                  : snapshot.connection === 'reconnecting'
                    ? 'reconnecting'
                    : snapshot.connection === 'failed'
                      ? 'failed'
                      : 'connecting',
                error: snapshot.error,
                onConfirmCommanders: () => { void controller.submitPregame({ kind: 'confirm-commanders' }); },
                onMulliganDecision: (decision) => { void controller.submitPregame({ kind: 'declare-mulligan', decision }); },
                onSubmitMulliganBottom: (objectIds) => { void controller.submitPregame({ kind: 'submit-mulligan-bottom', objectIds: objectIds as never }); },
                onRecordPregameAction: () => { void controller.submitPregame({ kind: 'record-manual-pregame-action' }); },
                onCompletePregameActions: () => { void controller.submitPregame({ kind: 'complete-pregame-actions' }); },
                onSetReady: () => { void controller.submitPregame({ kind: 'set-ready', ready: true }); },
              }}
            />
          )}
        />
      )}
      {started && !pregamePending && (snapshot.player === null || snapshot.player.projection === null) && (
        <p className="public-online-app__authoritative-configuration" role="status">
          対戦画面を準備しています。接続が完了するまでお待ちください。
        </p>
      )}
      {started && !pregamePending &&
        snapshot.player?.projection &&
        (snapshot.table?.projection ? (
          <OnlineDisplayPairing
            personalProjection={snapshot.player.projection}
            tableProjection={snapshot.table.projection}
            interactionState={interactionState}
            focusedPlayerId={null}
            onFocus={() => undefined}
            onAction={controller.submitPersonalAction}
            onGuidedAction={controller.submitGuidedAction}
          />
        ) : (
          <div className="public-online-app__player-surfaces">
            <PersonalWorkbench
              projection={snapshot.player.projection}
              interactionState={interactionState}
              onAction={controller.submitPersonalAction}
            />
            <OnlineGuidedActions
              projection={snapshot.player.projection}
              interactionState={interactionState}
              onAction={controller.submitGuidedAction}
            />
          </div>
        ))}
      {started && actionError('盤面を確認')}
    </main>
  );
}
