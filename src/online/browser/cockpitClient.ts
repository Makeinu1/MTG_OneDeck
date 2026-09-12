export type { CockpitControl } from '../cloudflare/cockpitMultiplayer';
import type { CockpitControl } from '../cloudflare/cockpitMultiplayer';
export type { CockpitSessionView } from '../cloudflare/cockpitSession';
import { migrateCockpitSnapshot } from '../../engine/cockpitMigration';
import type { GameSnapshot } from '../../data/gameSnapshot';
import { openDB, type DBSchema } from 'idb';
import type { InitDeckCard } from '../../engine/init';
import type { TableOperation } from '../../engine/cockpitTable';
import type {
  CockpitCheckpoint,
  CockpitSessionRequest,
  CockpitSessionView,
} from '../cloudflare/cockpitSession';

const COCKPIT_ORIGIN = import.meta.env.PROD
  ? 'https://mtg-onedeck-online.makeinu1.workers.dev'
  : '';
const CONNECTION_KEY = 'mtg-onedeck:cockpit-connection-v1';
interface CheckpointSchema extends DBSchema {
  checkpoint: { key: string; value: CockpitCheckpoint };
}
const checkpointDb = () =>
  openDB<CheckpointSchema>('mtg-onedeck-cockpit-checkpoint', 1, {
    upgrade(db) {
      db.createObjectStore('checkpoint');
    },
  });
export async function loadCockpitCheckpoint(): Promise<CockpitCheckpoint | undefined> {
  return (await checkpointDb()).get('checkpoint', 'current');
}
interface PendingRequest {
  type: 'create' | 'import' | 'restore' | 'commit' | 'join';
  requestId?: string;
  digest: string;
}
interface Connection {
  connectionId?: string;
  id: string;
  token: string;
  pending: PendingRequest | null;
}
async function inputDigest(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function hasCockpitConnection(): boolean {
  try {
    return localStorage.getItem(CONNECTION_KEY) !== null;
  } catch {
    return false;
  }
}
class CockpitConnectionError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}
export class CockpitClient {
  private connection: Connection | null = null;
  private view: CockpitSessionView | null = null;
  private busy = false;
  private polling: Promise<void> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly connectionIssue: (message: string) => void;
  private disposed = false;
  private abort: AbortController | null = null;
  private readonly receive: (view: CockpitSessionView) => void;
  constructor(
    receive: (view: CockpitSessionView) => void,
    connectionIssue: (message: string) => void = () => {},
  ) {
    this.receive = receive;
    this.connectionIssue = connectionIssue;
  }
  private persist(): void {
    if (this.disposed) throw new Error('画面を閉じました。');
    localStorage.setItem(CONNECTION_KEY, JSON.stringify(this.connection));
  }
  private async exchange<T>(body: CockpitSessionRequest): Promise<T> {
    if (!this.connection || this.disposed)
      throw new CockpitConnectionError('接続を開始してください。');
    this.abort = new AbortController();
    const timeout = setTimeout(() => this.abort?.abort(), 10000);
    try {
      const result = await fetch(`${COCKPIT_ORIGIN}/api/cockpit/${this.connection.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, connectionId: this.connection.connectionId }),
        signal: this.abort.signal,
      });
      if (!result.ok) {
        const error = (await result.json()) as { error?: string };
        const messages: Record<string, string> = {
          CONNECTION_REPLACED: '別の画面で再接続しました。この画面からの操作は停止しています。',
          NOT_AUTHORIZED:
            '現在の操作権では確定できません。HOLDを要求し、操作権を受け取ってください。',
          OWNER_ABSENT: '部屋主の接続を待っています。盤面は保存されています。',
          REVISION_CONFLICT:
            '別の操作が先に確定しました。最新の盤面に更新しました。内容を確認してもう一度操作してください。',
          ADMISSION_CLOSED: '招待を確認してください。開始済みの部屋には新規参加できません。',
          PREGAME_INCOMPLETE: '全員の参加と初手キープを待っています。',
          ELIMINATION_REQUIRES_CONTROL_REVIEW:
            '退出する人が制御中の他人のカードがあります。効果に従って制御変更を終了し、残る対象は手動で追放してから確定してください。',
          AUTHENTICATION_REQUIRED:
            'この席では接続できません。招待または退出状態を確認してください。',
        };
        if (error.error && messages[error.error])
          throw new CockpitConnectionError(messages[error.error], error.error);
        if (error.error === 'SESSION_STILL_ACTIVE')
          throw new CockpitConnectionError(
            '稼働セッションがあります。通常の再接続で続きを開いてください。',
            error.error,
          );
        if (error.error === 'SESSION_EXPIRED')
          throw new CockpitConnectionError('セッションは最終利用から6時間で失効しました。');
        if (error.error === 'TURN_HISTORY_LIMIT')
          throw new CockpitConnectionError(
            'このターンの履歴上限200操作に達しました。操作は保存されていません。再接続後、不要な操作をundoするか、ターンを終了してください。',
            error.error,
          );
        if (error.error === 'SESSION_SIZE_LIMIT')
          throw new CockpitConnectionError(
            'セッションの保存上限25MBに達しました。操作は保存されていません。再接続して端末checkpointを保存し、履歴をundoするかターンを終了してください。',
            error.error,
          );
        if (error.error === 'REQUEST_TOO_LARGE')
          throw new CockpitConnectionError(
            '送信サイズの上限2MBを超えました。内容は保存されていません。元の端末保存を保持してください。',
            error.error,
          );
        throw new CockpitConnectionError(
          '操作を確定できませんでした。再接続して結果を確認してください。',
          error.error,
        );
      }
      const view = (await result.json()) as T;
      if (this.disposed) throw new CockpitConnectionError('画面を閉じました。');
      return view;
    } catch (error) {
      if (error instanceof CockpitConnectionError) throw error;
      throw new CockpitConnectionError(
        '通信結果を確認できません。再接続して確定済みか照合してください。',
      );
    } finally {
      clearTimeout(timeout);
      this.abort = null;
    }
  }
  private async send(body: CockpitSessionRequest): Promise<CockpitSessionView> {
    const view = await this.exchange<CockpitSessionView>(body);
    this.view = view;
    this.receive(view);
    this.schedulePoll();
    return view;
  }
  private schedulePoll(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.disposed || !this.view?.multiplayer) return;
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      if (this.disposed) return;
      if (this.busy || this.connection?.pending) {
        this.schedulePoll();
        return;
      }
      this.polling = this.send({ type: 'read', token: this.connection!.token })
        .then(() => {})
        .catch((error) => {
          if (!this.disposed)
            this.connectionIssue(error instanceof Error ? error.message : '再接続してください。');
        })
        .finally(() => {
          this.polling = null;
        });
    }, 1500);
  }
  async join(deck: InitDeckCard[], invitation: string): Promise<void> {
    const match = /^([a-f0-9-]{36})\.([a-f0-9-]{72})$/.exec(invitation.trim());
    if (!match) throw new Error('招待コードを確認してください。');
    const token = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    this.connection = {
      id: match[1],
      token,
      connectionId: crypto.randomUUID(),
      pending: { type: 'join', digest: await inputDigest(deck) },
    };
    this.persist();
    await this.send({ type: 'join', token, invitation: match[2], deck });
    this.connection.pending = null;
    this.persist();
  }
  invitation(): string | null {
    return this.view?.multiplayer?.invitation && this.connection
      ? `${this.connection.id}.${this.view.multiplayer.invitation}`
      : null;
  }
  async control(control: CockpitControl): Promise<void> {
    await this.submit(control, true);
  }
  async saveCheckpoint(): Promise<void> {
    if (!this.connection || this.connection.pending || this.busy)
      throw new Error('確定結果を照合してから保存してください。');
    const { token } = this.connection;
    const checkpoint = await this.exchange<CockpitCheckpoint>({
      type: 'checkpoint',
      token,
    });
    const db = await checkpointDb();
    if (this.disposed) throw new Error('画面を閉じました。');
    await db.put('checkpoint', checkpoint, 'current');
  }
  async restoreCheckpoint(): Promise<void> {
    const checkpoint = await loadCockpitCheckpoint();
    if (!checkpoint) throw new Error('端末に保存checkpointがありません。');
    const token = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const body: CockpitSessionRequest = { type: 'restore', token, checkpoint };
    const previous = this.connection;
    this.connection = {
      id: checkpoint.sessionAddress.split('/').at(-1)!,
      token,
      pending: { type: 'restore', digest: await inputDigest(checkpoint) },
    };
    this.persist();
    try {
      await this.send(body);
    } catch (error) {
      // A definite rejection did not replace the server session. Keep its
      // credential; an unknown response must instead retain the new credential
      // so a committed restore can be reconciled without a second restore.
      if (error instanceof CockpitConnectionError && error.code && previous) {
        this.connection = previous;
        this.persist();
      }
      throw error;
    }
    this.connection.pending = null;
    this.persist();
  }
  async importSnapshot(snapshot: GameSnapshot): Promise<void> {
    migrateCockpitSnapshot(snapshot);
    const token = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const body: CockpitSessionRequest = { type: 'import', token, snapshot };
    const digest = await inputDigest(snapshot);
    if (this.disposed) return;
    this.connection = { id: crypto.randomUUID(), token, pending: { type: 'import', digest } };
    this.persist();
    await this.send(body);
    this.connection.pending = null;
    this.persist();
  }
  async start(deck: InitDeckCard[], seats?: 2 | 4): Promise<void> {
    const digest = await inputDigest({ deck, seats });
    if (this.disposed) return;
    const raw = localStorage.getItem(CONNECTION_KEY);
    if (raw) {
      const existing = JSON.parse(raw) as Connection;
      if (existing.pending?.type === 'create' && existing.pending.digest === digest) {
        this.connection = existing;
        try {
          await this.reconnect();
        } catch (error) {
          if (!(error instanceof CockpitConnectionError) || error.code !== 'SESSION_NOT_FOUND')
            throw error;
          await this.send({
            type: 'create',
            token: existing.token,
            deck,
            seed: crypto.getRandomValues(new Uint32Array(1))[0],
            seats,
          });
          existing.pending = null;
          this.persist();
        }
        return;
      }
    }
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const body: CockpitSessionRequest = {
      type: 'create',
      token,
      seats,
      deck,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    };
    this.connection = {
      id: crypto.randomUUID(),
      token,
      connectionId: crypto.randomUUID(),
      pending: { type: 'create', digest },
    };
    this.persist();
    await this.send(body);
    this.connection.pending = null;
    this.persist();
  }
  async reconnect(): Promise<'recovered' | 'unseen'> {
    await this.polling;
    if (this.disposed) throw new Error('画面を閉じました。');
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.busy = true;
    try {
      if (!this.connection) {
        const raw = localStorage.getItem(CONNECTION_KEY);
        if (!raw) throw new Error('再接続するセッションがありません。');
        this.connection = JSON.parse(raw) as Connection;
      }
      const connection = this.connection;
      const pending = connection.pending;
      if (connection.connectionId) {
        connection.connectionId = crypto.randomUUID();
        this.persist();
        await this.send({ type: 'connect', token: connection.token });
      }
      const view = await this.send({
        type: 'read',
        token: connection.token,
        ...(pending?.type === 'commit' ? { requestId: pending.requestId } : {}),
      });
      // A rejected/unseen command is not replayed automatically. The next deliberate
      // action gets a fresh proposal against this confirmed revision.
      if (pending?.type === 'commit' && view.receipt !== 'committed') {
        connection.pending = null;
        this.persist();
        return 'unseen';
      }
      connection.pending = null;
      this.persist();
      return 'recovered';
    } finally {
      this.busy = false;
    }
  }
  async commit(operation: TableOperation | { type: 'undo' } | { type: 'redo' }): Promise<void> {
    await this.submit(operation, false);
  }
  private async submit(
    operation: TableOperation | { type: 'undo' } | { type: 'redo' } | CockpitControl,
    control: boolean,
  ): Promise<void> {
    await this.polling;
    if (!this.connection || !this.view || this.connection.pending || this.busy || this.disposed)
      throw new Error('送信結果の確認が必要です。再接続してください。');
    this.busy = true;
    const { token } = this.connection;
    const body: CockpitSessionRequest & { requestId: string } = {
      type: control ? 'control' : 'commit',
      token,
      requestId: crypto.randomUUID(),
      revision: this.view.revision,
      ...(control ? { control: operation } : { operation }),
    } as CockpitSessionRequest & { requestId: string };
    try {
      this.connection.pending = {
        type: 'commit',
        requestId: body.requestId,
        digest: await inputDigest(operation),
      };
      if (this.disposed) throw new CockpitConnectionError('画面を閉じました。');
      this.persist();
      await this.send(body);
      this.connection.pending = null;
      this.persist();
    } catch (error) {
      if (
        error instanceof CockpitConnectionError &&
        [
          'REVISION_CONFLICT',
          'ELIMINATION_REQUIRES_CONTROL_REVIEW',
          'NOT_AUTHORIZED',
          'PREGAME_INCOMPLETE',
          'OWNER_ABSENT',
        ].includes(error.code ?? '') &&
        this.connection
      ) {
        this.connection.pending = null;
        this.persist();
        await this.send({ type: 'read', token });
      }
      throw error;
    } finally {
      this.busy = false;
    }
  }
  dispose(): void {
    this.disposed = true;
    this.abort?.abort();
    if (this.pollTimer) clearTimeout(this.pollTimer);
  }
}
