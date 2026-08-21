import { useEffect, useMemo, useState } from 'react';
import {
  createPublicOnlineControllerV1,
  PUBLIC_ONLINE_ERROR_V1,
  type PublicOnlineDeckOptionV1,
  type PublicOnlineSnapshotV1,
} from '../../online/publicApp/index';
import { OnlineDisplayPairing } from './OnlineDisplayPairing';
import { OnlineGuidedActions } from './OnlineGuidedActions';
import { PersonalWorkbench } from './PersonalWorkbench';
import './publicOnlineApp.css';

export type PublicOnlineAppProps = Readonly<{
  readonly decks: readonly PublicOnlineDeckOptionV1[];
  readonly initialDeckId?: string;
  readonly onBackToSolo: () => void;
}>;

function interactionState(snapshot: PublicOnlineSnapshotV1): 'ready' | 'updating' | 'offline' {
  if (snapshot.connection === 'ready') return 'ready';
  if (snapshot.connection === 'connecting' || snapshot.connection === 'updating') return 'updating';
  return 'offline';
}

function seatReady(snapshot: PublicOnlineSnapshotV1): boolean {
  const projection = snapshot.projection;
  if (projection === null || !Array.isArray(projection.seats)) return false;
  return projection.lifecycle === 'ready' && projection.seats.length === 4 && projection.seats.every((seat) => {
    if (seat === null || typeof seat !== 'object') return false;
    const value = seat as Record<string, unknown>;
    return value.occupied === true && value.deckSubmitted === true && value.ready === true;
  });
}

function projectionOf(snapshot: PublicOnlineSnapshotV1, role: 'player' | 'table'): unknown {
  return role === 'player' ? snapshot.player?.projection ?? null : snapshot.table?.projection ?? null;
}

export function PublicOnlineApp({ decks, initialDeckId = '', onBackToSolo }: PublicOnlineAppProps) {
  const controller = useMemo(() => createPublicOnlineControllerV1(), []);
  const [snapshot, setSnapshot] = useState<PublicOnlineSnapshotV1>(() => controller.getSnapshot());
  const [roomId, setRoomId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId || decks[0]?.id || '');

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    return () => { unsubscribe(); controller.disconnect(); };
  }, [controller]);

  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? decks[0] ?? null;
  const statusLabel = snapshot.connection === 'ready' ? '接続済み' : snapshot.connection === 'connecting' ? '接続中' : snapshot.connection === 'updating' ? '更新中' : snapshot.connection === 'failed' ? '失敗' : 'オフライン';
  const isStarted = snapshot.mode === 'started' || snapshot.lifecycle === 'started';
  const busy = snapshot.busy !== null;
  const pairing = snapshot.isHost && projectionOf(snapshot, 'player') !== null && projectionOf(snapshot, 'table') !== null;

  async function createRoom(): Promise<void> { await controller.create(); }
  async function joinRoom(): Promise<void> {
    const invite = inviteCode;
    await controller.join(roomId, invite);
    if (controller.getSnapshot().error === null) setInviteCode('');
  }
  async function submitDeck(): Promise<void> {
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
        <button type="button" className="btn btn--ghost" data-testid="online-back-to-solo" onClick={() => { controller.disconnect(); onBackToSolo(); }}>一人回しに戻る</button>
      </header>

      <section className="public-online-app__lobby" aria-label="オンラインルームの準備">
        <div className="public-online-app__fields">
          <label htmlFor="online-room-id">Room ID</label>
          <input id="online-room-id" data-testid="online-room-id" value={roomId} onChange={(event) => setRoomId(event.target.value)} autoComplete="off" inputMode="text" />
          <label htmlFor="online-invite-code">招待コード</label>
          <input id="online-invite-code" data-testid="online-invite-code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoComplete="off" inputMode="text" />
          <label htmlFor="online-deck-select">使用デッキ</label>
          <select id="online-deck-select" data-testid="online-deck-select" value={selectedDeckId} onChange={(event) => setSelectedDeckId(event.target.value)}>
            {decks.length === 0 && <option value="">保存済みデッキがありません</option>}
            {decks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}
          </select>
        </div>
        <div className="public-online-app__actions">
          <button type="button" className="btn btn--primary" data-testid="online-create-room" disabled={busy} onClick={() => { void createRoom(); }}>ルームを作成</button>
          <button type="button" className="btn btn--ghost" data-testid="online-join-room" disabled={busy || roomId.trim() === '' || inviteCode.trim() === ''} onClick={() => { void joinRoom(); }}>招待コードで参加</button>
          <button type="button" className="btn btn--ghost" data-testid="online-refresh-lobby" disabled={busy || snapshot.roomId === null || isStarted} onClick={() => { void controller.refresh(); }}>ルームを更新</button>
          <button type="button" className="btn btn--ghost" data-testid="online-submit-deck" disabled={busy || snapshot.roomId === null || isStarted || selectedDeck === null} onClick={() => { void submitDeck(); }}>デッキを提出</button>
          <button type="button" className="btn btn--ghost" data-testid="online-ready-toggle" disabled={busy || snapshot.roomId === null || isStarted} onClick={() => { void controller.toggleReady(); }}>準備完了を切り替え</button>
          <button type="button" className="btn btn--primary" data-testid="online-start-game" disabled={busy || !snapshot.isHost || !seatReady(snapshot) || isStarted} onClick={() => { void controller.start(); }}>対戦を開始</button>
        </div>
      </section>

      {snapshot.roomId !== null && (
        <section className="public-online-app__status" data-testid="online-room-summary" aria-label="ルーム概要">
          <h2>Room {snapshot.roomId}</h2>
          <p data-testid="online-connection-status">接続状態: {statusLabel}</p>
          <p>ライフサイクル: {snapshot.lifecycle === 'ready' ? '開始準備完了' : snapshot.lifecycle === 'started' ? '対戦中' : '準備中'}</p>
          <div className="public-online-app__seats" aria-label="4席の状態">
            {Array.from({ length: 4 }, (_, index) => {
              const seat = (snapshot.projection?.seats as readonly unknown[] | undefined)?.[index];
              const value = seat !== null && typeof seat === 'object' ? seat as Record<string, unknown> : null;
              return <article key={`seat-${index}`} data-testid="online-seat-summary"><strong>席 {index + 1}</strong><span>{value?.occupied === true ? '参加済み' : '招待待ち'}</span><span>{value?.deckSubmitted === true ? 'デッキ提出済み' : 'デッキ未提出'}</span><span>{value?.ready === true ? '準備完了' : '未準備'}</span></article>;
            })}
          </div>
          {snapshot.invites.length > 0 && <div className="public-online-app__invites" aria-label="一度だけ表示する招待コード"><h3>招待コード（この画面だけで表示）</h3>{snapshot.invites.map((invite, index) => <div className="public-online-app__invite" key={`invite-${index}`}><code>{invite}</code><button type="button" data-testid="online-invite-copy" onClick={() => { void controller.copyInvite(invite); }}>コピー</button></div>)}</div>}
        </section>
      )}

      {snapshot.error !== null && <p className="public-online-app__error" data-testid="online-error" role="alert">{PUBLIC_ONLINE_ERROR_V1}</p>}

      {isStarted && projectionOf(snapshot, 'player') !== null && (
        pairing ? (
          <OnlineDisplayPairing
            personalProjection={projectionOf(snapshot, 'player')}
            tableProjection={projectionOf(snapshot, 'table')}
            interactionState={interactionState(snapshot)}
            focusedPlayerId={null}
            onFocus={() => undefined}
            onAction={controller.submitPersonalAction}
            onGuidedAction={controller.submitGuidedAction}
          />
        ) : (
          <div className="public-online-app__player-surfaces">
            <PersonalWorkbench projection={projectionOf(snapshot, 'player')} interactionState={interactionState(snapshot)} onAction={controller.submitPersonalAction} />
            <OnlineGuidedActions projection={projectionOf(snapshot, 'player')} interactionState={interactionState(snapshot)} onAction={controller.submitGuidedAction} />
          </div>
        )
      )}
    </main>
  );
}
