import { useEffect, useMemo, useState } from 'react';
import {
  createPublicOnlineControllerV2,
  type PublicOnlineDeckOptionV2,
  type PublicOnlineSnapshotV2,
} from '../../online/publicApp/index';
import './publicOnlineApp.css';
import { OnlineDisplayPairing } from './OnlineDisplayPairing';
import { OnlineGuidedActions } from './OnlineGuidedActions';
import { PersonalWorkbench } from './PersonalWorkbench';

export type PublicOnlineAppProps = Readonly<{
  readonly decks: readonly PublicOnlineDeckOptionV2[];
  readonly initialDeckId?: string;
  readonly selectedDeckId?: string;
  readonly onDeckSelect?: (deckId: string) => void;
  readonly onBackToSolo: () => void;
  readonly onImportDeck?: () => void;
}>;

function publicDeckState(state: string): string {
  return state === 'accepted'
    ? 'デッキ確認済み'
    : state === 'resolving'
      ? 'デッキ確認中'
      : state === 'needs-attention'
        ? 'デッキ要修正'
        : 'デッキ未提出';
}
function allReady(snapshot: PublicOnlineSnapshotV2): boolean {
  return (
    snapshot.projection?.seats.every(
      (seat) => seat.participantId !== null && seat.deckState === 'accepted' && seat.ready,
    ) === true
  );
}

export function PublicOnlineApp({
  decks,
  initialDeckId = '',
  selectedDeckId: controlledDeckId,
  onDeckSelect,
  onBackToSolo,
  onImportDeck,
}: PublicOnlineAppProps) {
  const controller = useMemo(() => createPublicOnlineControllerV2(), []);
  const [snapshot, setSnapshot] = useState<PublicOnlineSnapshotV2>(() => controller.getSnapshot());
  const [roomId, setRoomId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId || decks[0]?.id || '');
  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      controller.disconnect();
    };
  }, [controller]);
  const activeDeckId = controlledDeckId ?? selectedDeckId;
  const exactDeckIndex = decks.findIndex((deck) => deck.id === activeDeckId);
  const selectedDeckIndex = exactDeckIndex >= 0 ? exactDeckIndex : decks.length > 0 ? 0 : -1;
  const selectedDeck = selectedDeckIndex < 0 ? null : (decks[selectedDeckIndex] ?? null);
  const selectedDeckToken = selectedDeckIndex < 0 ? '' : `deck-option-${selectedDeckIndex}`;
  const isStarted = snapshot.lifecycle === 'started';
  const local =
    snapshot.ownSeatIndex === null
      ? null
      : (snapshot.projection?.seats[snapshot.ownSeatIndex] ?? null);
  const status = isStarted
    ? snapshot.connection === 'online'
      ? 'オンライン'
      : snapshot.connection === 'reconnecting'
        ? '再接続中'
        : snapshot.connection === 'failed'
          ? '接続失敗'
          : '接続中'
    : local?.deckState === 'resolving'
      ? 'デッキ確認中'
      : 'ロビー待機中';
  async function join(): Promise<void> {
    await controller.join(roomId, inviteCode);
    if (controller.getSnapshot().error === null) setInviteCode('');
  }
  async function submit(): Promise<void> {
    if (selectedDeck !== null) await controller.submitDeck(selectedDeck);
  }
  return (
    <main className="public-online-app" data-testid="public-online-app">
      <header className="public-online-app__header">
        <div>
          <p className="public-online-app__eyebrow">ONLINE ROOM</p>
          <h1>4人オンライン</h1>
          <p>保存済みデッキから、招待制の対戦ルームへ接続します。</p>
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
      <section className="public-online-app__lobby" aria-label="オンラインルームの準備">
        <div className="public-online-app__fields">
          <label htmlFor="online-room-id">Room ID</label>
          <input
            id="online-room-id"
            data-testid="online-room-id"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            autoComplete="off"
            inputMode="text"
          />
          <label htmlFor="online-invite-code">招待コード</label>
          <input
            id="online-invite-code"
            data-testid="online-invite-code"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            autoComplete="off"
            inputMode="text"
          />
          <label htmlFor="online-deck-select">使用デッキ</label>
          <select
            id="online-deck-select"
            data-testid="online-deck-select"
            value={selectedDeckToken}
            onChange={(event) => {
              const index = Number(event.target.value.replace(/^deck-option-/, ''));
              const next = Number.isSafeInteger(index) ? decks[index] : undefined;
              if (next === undefined) return;
              setSelectedDeckId(next.id);
              onDeckSelect?.(next.id);
            }}
          >
            {decks.length === 0 && <option value="">保存済みデッキがありません</option>}
            {decks.map((deck, index) => (
              <option value={`deck-option-${index}`} key={`deck-option-${index}`}>
                {controller.displayDeckName(deck.name, index)}
              </option>
            ))}
          </select>
        </div>
        <div className="public-online-app__actions">
          <button
            type="button"
            className="btn btn--primary"
            data-testid="online-create-room"
            disabled={snapshot.busy !== null}
            onClick={() => {
              void controller.create();
            }}
          >
            ルームを作成
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            data-testid="online-join-room"
            disabled={snapshot.busy !== null || roomId.trim() === '' || inviteCode.trim() === ''}
            onClick={() => {
              void join();
            }}
          >
            招待コードで参加
          </button>
          {onImportDeck && (
            <button
              type="button"
              className="btn btn--ghost"
              data-testid="online-import-deck"
              disabled={snapshot.busy !== null}
              onClick={onImportDeck}
            >
              新しいカードリストを読み込む
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            data-testid="online-refresh-lobby"
            disabled={snapshot.busy !== null || snapshot.roomId === null || isStarted}
            onClick={() => {
              void controller.refresh();
            }}
          >
            ルームを更新
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            data-testid="online-submit-deck"
            disabled={
              snapshot.busy !== null ||
              snapshot.roomId === null ||
              isStarted ||
              selectedDeck === null
            }
            onClick={() => {
              void submit();
            }}
          >
            デッキを提出
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            data-testid="online-ready-toggle"
            disabled={
              snapshot.busy !== null ||
              snapshot.roomId === null ||
              isStarted ||
              local?.deckState !== 'accepted'
            }
            onClick={() => {
              void controller.toggleReady();
            }}
          >
            準備完了を切り替え
          </button>
          <button
            type="button"
            className="btn btn--primary"
            data-testid="online-start-game"
            disabled={
              snapshot.busy !== null || !snapshot.isHost || !allReady(snapshot) || isStarted
            }
            onClick={() => {
              void controller.start();
            }}
          >
            対戦を開始
          </button>
        </div>
      </section>
      {snapshot.roomId !== null && (
        <section
          className="public-online-app__status"
          data-testid="online-room-summary"
          aria-label="ルーム概要"
        >
          <h2>Room {snapshot.roomId}</h2>
          <p data-testid="online-connection-status">接続状態: {status}</p>
          <p>
            ライフサイクル:{' '}
            {isStarted ? '対戦中' : snapshot.lifecycle === 'ready' ? '開始準備完了' : '準備中'}
          </p>
          <div className="public-online-app__seats" aria-label="4席の状態">
            {Array.from({ length: 4 }, (_, index) => {
              const seat = snapshot.projection?.seats[index];
              return (
                <article key={`seat-${index}`} data-testid="online-seat-summary">
                  <strong>席 {index + 1}</strong>
                  <span>
                    {seat?.participantId !== null && seat?.participantId !== undefined
                      ? '参加済み'
                      : '招待待ち'}
                  </span>
                  <span>{publicDeckState(seat?.deckState ?? 'none')}</span>
                  <span>{seat?.ready === true ? '準備完了' : '未準備'}</span>
                </article>
              );
            })}
          </div>
          {snapshot.invites.length > 0 && (
            <div className="public-online-app__invites" aria-label="一度だけ表示する招待コード">
              <h3>招待コード（この画面だけで表示）</h3>
              {snapshot.invites.map((invite, index) => (
                <div className="public-online-app__invite" key={`invite-${index}`}>
                  <code>{invite}</code>
                  <button
                    type="button"
                    data-testid="online-invite-copy"
                    onClick={() => {
                      void controller.copyInvite(invite);
                    }}
                  >
                    コピー
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {snapshot.ownerIssue !== null && (
        <div className="public-online-app__error" data-testid="online-owner-error" role="alert">
          <p>{snapshot.ownerIssue.message}</p>
          {snapshot.ownerIssue.retryable && (
            <button
              type="button"
              data-testid="online-retry-submit"
              onClick={() => {
                void controller.retry();
              }}
            >
              再試行
            </button>
          )}
        </div>
      )}
      {snapshot.error !== null && (
        <p className="public-online-app__error" data-testid="online-error" role="alert">
          {snapshot.error}
        </p>
      )}
      {isStarted &&
        snapshot.player?.projection !== null &&
        snapshot.player?.projection !== undefined &&
        (snapshot.table?.projection !== null && snapshot.table?.projection !== undefined ? (
          <OnlineDisplayPairing
            personalProjection={snapshot.player.projection}
            tableProjection={snapshot.table.projection}
            interactionState={
              snapshot.connection === 'online'
                ? 'ready'
                : snapshot.connection === 'reconnecting'
                  ? 'offline'
                  : 'updating'
            }
            focusedPlayerId={null}
            onFocus={() => undefined}
            onAction={controller.submitPersonalAction}
            onGuidedAction={controller.submitGuidedAction}
          />
        ) : (
          <div className="public-online-app__player-surfaces">
            <PersonalWorkbench
              projection={snapshot.player.projection}
              interactionState={
                snapshot.connection === 'online'
                  ? 'ready'
                  : snapshot.connection === 'reconnecting'
                    ? 'offline'
                    : 'updating'
              }
              onAction={controller.submitPersonalAction}
            />
            <OnlineGuidedActions
              projection={snapshot.player.projection}
              interactionState={
                snapshot.connection === 'online'
                  ? 'ready'
                  : snapshot.connection === 'reconnecting'
                    ? 'offline'
                    : 'updating'
              }
              onAction={controller.submitGuidedAction}
            />
          </div>
        ))}
    </main>
  );
}
