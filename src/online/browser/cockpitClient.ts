export type { CockpitControl } from '../cloudflare/cockpitMultiplayer';
import type { CockpitControl } from '../cloudflare/cockpitMultiplayer';
export type { CockpitSessionView } from '../cloudflare/cockpitSession';
import { migrateCockpitSnapshot } from '../../engine/cockpitMigration';
import type { GameSnapshot } from '../../data/gameSnapshot';
import { openDB, type DBSchema } from 'idb';
import type { InitDeckCard } from '../../engine/init';
import { expandSavedDeck, listSavedDecks } from '../../data/savedDecks';
import type { TableOperation } from '../../engine/cockpitTable';
import type { ExpectedInteractionContext } from '../../engine/cockpitR31';
import type { R4TableOperation } from '../../engine/cockpitR4';
import type { R4bDeclaredCause, R4bOperation } from '../../engine/cockpitR4b';
import type {
  CockpitCheckpoint,
  CockpitSessionRequest,
  CockpitSessionView,
} from '../cloudflare/cockpitSession';

const COCKPIT_ORIGIN = import.meta.env.PROD
  ? 'https://mtg-onedeck-online.makeinu1.workers.dev'
  : '';
const CONNECTION_KEY = 'mtg-onedeck:cockpit-connection-v1';
const R4B_PROTOCOL_VERSION = 2 as const;
const R4B_CONTEXTUAL_FORMAL_TYPES = new Set<R4bOperation['type']>([
  'playLand',
  'cast',
  'activate',
  'generate',
  'generateBatch',
  'special.turnFaceUp',
  'trigger.manualAdd',
  'state.apply',
]);
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
  /** Exact original input, resolved against local deck assets after reload. No deck data is sent here. */
  replayDeckDigest?: string;
  // Retained only while a new destination is awaiting confirmation.
  previous?: Connection;
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
  readonly retryable: boolean;
  previousRestored = false;
  constructor(message: string, code?: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
// Only these server responses guarantee that the proposed mutation was not saved.
const OPERATION_REJECTIONS = new Set([
  'OPERATION_NOT_SAVED',
  'REVISION_CONFLICT',
  'ELIMINATION_REQUIRES_CONTROL_REVIEW',
  'NOT_AUTHORIZED',
  'PREGAME_INCOMPLETE',
  'OWNER_ABSENT',
  'INVALID_REQUEST',
  'REQUEST_TOO_LARGE',
  'SESSION_SIZE_LIMIT',
  'TURN_HISTORY_LIMIT',
  'NO_UNDO',
  'NO_REDO',
  'CLIENT_UPDATE_REQUIRED',
  'STALE_INTERACTION_CONTEXT',
  'STALE_R4B_OBJECT',
]);
export function isCockpitOperationRejection(error: unknown): boolean {
  if (!(error instanceof CockpitConnectionError)) return false;
  const code = error.code ?? '';
  return (
    OPERATION_REJECTIONS.has(code) ||
    code.startsWith('R4B_') ||
    code.startsWith('INVALID_R4B_')
  );
}
const TERMINAL_FAILURES = new Set([
  'SESSION_EXPIRED',
  'SESSION_NOT_FOUND',
  'SESSION_ENDED',
  'AUTHENTICATION_REQUIRED',
]);
export function isCockpitTerminalFailure(error: unknown): boolean {
  return (
    error instanceof CockpitConnectionError &&
    !error.previousRestored &&
    TERMINAL_FAILURES.has(error.code ?? '')
  );
}
function isDefiniteRejection(error: unknown): boolean {
  return (
    isCockpitOperationRejection(error) ||
    (error instanceof CockpitConnectionError &&
      new Set([
        'ADMISSION_CLOSED',
        'ROOM_FULL',
        'AUTHENTICATION_REQUIRED',
        'CONNECTION_REQUIRED',
        'CONNECTION_REPLACED',
        'SESSION_EXPIRED',
        'SESSION_NOT_FOUND',
        'SESSION_ENDED',
        'INVALID_CHECKPOINT',
        'SESSION_STILL_ACTIVE',
        'MULTIPLAYER_CHECKPOINT_UNAVAILABLE',
      ]).has(error.code ?? ''))
  );
}

export class CockpitClient {
  private readonly replayDecks = new Map<string, InitDeckCard[]>();
  private async rememberReplayDeck(deck: InitDeckCard[]): Promise<string> {
    const original = structuredClone(deck);
    const digest = await inputDigest(original);
    this.replayDecks.set(digest, original);
    return digest;
  }
  async loadReplayDeck(): Promise<InitDeckCard[] | null> {
    const connection = this.connection;
    const digest = connection?.replayDeckDigest;
    if (!connection || !digest || connection.pending || this.disposed) return null;
    let original = this.replayDecks.get(digest);
    if (!original) {
      try {
        for (const saved of await listSavedDecks()) {
          const candidate = expandSavedDeck(saved);
          if ((await inputDigest(candidate)) === digest) {
            original = candidate;
            break;
          }
        }
      } catch {
        // Missing/unavailable local assets require explicit deck selection, not board reconstruction.
        return null;
      }
    }
    if (this.disposed || this.connection !== connection || connection.pending || !original?.length)
      return null;
    return structuredClone(original);
  }
  private connection: Connection | null = null;
  private view: CockpitSessionView | null = null;
  private busy = false;
  private polling: Promise<void> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly connectionIssue: (message: string, error?: unknown) => void;
  private disposed = false;
  private pollFailures = 0;
  private abort: AbortController | null = null;
  private readonly connectionRecovered: () => void;
  private readonly receive: (view: CockpitSessionView) => void;
  constructor(
    receive: (view: CockpitSessionView) => void,
    connectionIssue: (message: string, error?: unknown) => void = () => {},
    connectionRecovered: () => void = () => {},
  ) {
    this.receive = receive;
    this.connectionIssue = connectionIssue;
    this.connectionRecovered = connectionRecovered;
  }
  private persist(): void {
    if (this.disposed) throw new Error('画面を閉じました。');
    localStorage.setItem(CONNECTION_KEY, JSON.stringify(this.connection));
  }
  private async exchange<T>(body: CockpitSessionRequest): Promise<T> {
    if (!this.connection || this.disposed)
      throw new CockpitConnectionError('接続を開始してください。');
    const abort = new AbortController();
    this.abort = abort;
    const timeout = setTimeout(() => abort.abort(), 10000);
    try {
      const result = await fetch(`${COCKPIT_ORIGIN}/api/cockpit/${this.connection.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, connectionId: this.connection.connectionId }),
        signal: abort.signal,
      });
      if (!result.ok) {
        if (result.status >= 500 || result.status === 429)
          throw new CockpitConnectionError(
            '通信結果を確認できません。確定状態を確認してください。',
            undefined,
            true,
          );
        const error = (await result.json()) as { error?: string };
        const messages: Record<string, string> = {
          OPERATION_NOT_SAVED:
            'この操作は保存されませんでした。対象・コスト・現在の盤面を確認し、選び直してください。',
          INVALID_REQUEST: '操作内容を確認できませんでした。内容を選び直してください。',
          NO_UNDO: 'これ以上戻せる操作がありません。',
          NO_REDO: 'やり直せる操作がありません。',
          ROOM_FULL: '参加できる空席がありません。元の卓の接続情報は保持しています。',
          SESSION_ENDED: 'この対戦は終了しています。新しい対戦を開始してください。',
          SESSION_NOT_FOUND: '接続先のセッションが見つかりません。',
          INVALID_CHECKPOINT: 'この保存データを確認できません。元のデータは保持しています。',
          CONNECTION_REPLACED: '別の画面で再接続しました。この画面からの操作は停止しています。',
          NOT_AUTHORIZED:
            '現在の操作権では確定できません。HOLDを要求し、操作権を受け取ってください。',
          R4B_NOT_AUTHORIZED:
            '現在の操作権・閲覧権ではこの変更を確定できません。対象と操作権を確認してください。',
          R4B_CORRECTION_REQUIRES_HOLD:
            '共有卓の盤面訂正はHOLD中だけ確定できます。先に卓を停止してください。',
          R4B_HOLD_BLOCKS_OPERATION:
            'HOLD中は通常のゲーム進行を確定できません。HOLDを解消してから続けてください。',
          R4B_BLOCKING_TRIGGER:
            '未処理の誘発があります。誘発を確認してからこのManual Eventを確定してください。',
          R4B_STACK_EFFECT_REQUIRES_RESOLUTION:
            'Stackのコピー・除去は現在の解決処理に結び付けて実行してください。',
          R4B_MANUAL_EVENT_REQUIRED:
            'この操作は通常盤面変更としては確定できません。Manual Eventとして明示してください。',
          R4B_CORRECTION_REQUIRED:
            'この盤面訂正はCorrectionとして明示してください。',
          STALE_INTERACTION_CONTEXT:
            '操作を始めた処理は既に変わっています。最新の盤面から選び直してください。',
          STALE_R4B_OBJECT:
            '選択したカードは既に別のオブジェクトになっています。最新の盤面から選び直してください。',
          CLIENT_UPDATE_REQUIRED:
            'OneDeckが更新されました。ページを再読み込みしてから続けてください。確定済みの盤面は保存されています。',
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
        if (error.error?.startsWith('R4B_OPERATION_RETIRED:'))
          throw new CockpitConnectionError(
            'この旧操作経路は廃止されました。最新の操作UIから選び直してください。',
            error.error,
          );
        if (error.error === 'SESSION_STILL_ACTIVE')
          throw new CockpitConnectionError(
            '稼働セッションがあります。通常の再接続で続きを開いてください。',
            error.error,
          );
        if (error.error === 'SESSION_EXPIRED')
          throw new CockpitConnectionError(
            'セッションは最終利用から6時間で失効しました。2人/4人の対戦卓は復元できません。新しい卓を作成または参加してください。一人回しは端末checkpointがある場合だけそこから再開できます。',
            error.error,
          );
        if (error.error === 'TURN_HISTORY_LIMIT')
          throw new CockpitConnectionError(
            'このターンの履歴上限200操作に達しました。操作は保存されていません。不要な操作をundoするか、未完の処理を確認してください。',
            error.error,
          );
        if (error.error === 'SESSION_SIZE_LIMIT')
          throw new CockpitConnectionError(
            'セッションの保存上限25MBに達しました。操作は保存されていません。履歴をundoするか、未完の処理を確認してください。',
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
        undefined,
        true,
      );
    } finally {
      clearTimeout(timeout);
      if (this.abort === abort) this.abort = null;
    }
  }
  private async send(body: CockpitSessionRequest): Promise<CockpitSessionView> {
    const view = await this.exchange<CockpitSessionView>(body);
    this.view = view;
    this.receive(view);
    this.schedulePoll();
    return view;
  }
  private schedulePoll(delay = 1500): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.disposed || !this.view?.multiplayer || this.pollFailures >= 5) return;
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      if (this.disposed) return;
      if (this.busy || this.connection?.pending) {
        this.schedulePoll(delay);
        return;
      }
      this.polling = this.send({ type: 'read', token: this.connection!.token })
        .then(() => {
          const recovered = this.pollFailures > 0;
          this.pollFailures = 0;
          this.schedulePoll();
          if (recovered && !this.disposed) this.connectionRecovered();
        })
        .catch((error: unknown) => {
          if (this.disposed) return;
          this.pollFailures++;
          const retry =
            error instanceof CockpitConnectionError && error.retryable && this.pollFailures < 5;
          this.connectionIssue(
            retry
              ? '通信が途切れました。盤面を保持して接続を再確認しています。'
              : error instanceof Error
                ? error.message
                : '再接続してください。',
            error,
          );
          // Read only: never resend a mutation or take over another tab's connection.
          if (retry) this.schedulePoll(Math.min(1500 * 2 ** (this.pollFailures - 1), 12000));
        })
        .finally(() => {
          this.polling = null;
        });
    }, delay);
  }
  private finishPending(): void {
    if (!this.connection) return;
    this.connection.pending = null;
    delete this.connection.previous;
    this.persist();
  }
  private rollbackSwitch(error: unknown): void {
    if (error instanceof CockpitConnectionError)
      error.previousRestored = !!this.connection?.previous;
    this.connection = this.connection?.previous ?? null;
    if (error instanceof CockpitConnectionError && error.previousRestored)
      error.message += ' 元の卓の接続情報を保持しています。再接続して有効性を確認してください。';
    this.view = null;
    if (this.disposed) return;
    if (this.connection) this.persist();
    else localStorage.removeItem(CONNECTION_KEY);
  }
  private async switchConnection(next: Connection, body: CockpitSessionRequest): Promise<void> {
    await this.polling;
    if (this.disposed || this.busy) throw new Error('接続処理を終えてから操作してください。');
    const raw = localStorage.getItem(CONNECTION_KEY);
    const previous = this.connection ?? (raw ? (JSON.parse(raw) as Connection) : null);
    if (previous?.pending)
      throw new Error('前の操作結果が未確認です。再接続して確認してください。');
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.busy = true;
    this.pollFailures = 0;
    this.connection = { ...next, ...(previous ? { previous } : {}) };
    this.view = null;
    try {
      this.persist();
      await this.send(body);
      this.finishPending();
    } catch (error) {
      if (isDefiniteRejection(error) && !this.disposed) this.rollbackSwitch(error);
      // An unknown response retains both destinations across disposal/reload.
      throw error;
    } finally {
      this.busy = false;
    }
  }
  async join(deck: InitDeckCard[], invitation: string): Promise<void> {
    deck = structuredClone(deck);
    const match = /^([a-f0-9-]{36})\.([a-f0-9-]{72})$/.exec(invitation.trim());
    if (!match) throw new Error('招待コードを確認してください。');
    const token = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    await this.switchConnection(
      {
        id: match[1],
        token,
        connectionId: crypto.randomUUID(),
        pending: { type: 'join', digest: await inputDigest(deck) },
        replayDeckDigest: await this.rememberReplayDeck(deck),
      },
      { type: 'join', token, invitation: match[2], deck },
    );
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
    await this.switchConnection(
      {
        id: checkpoint.sessionAddress.split('/').at(-1)!,
        token,
        pending: { type: 'restore', digest: await inputDigest(checkpoint) },
      },
      body,
    );
  }
  async importSnapshot(snapshot: GameSnapshot): Promise<void> {
    snapshot = structuredClone(snapshot);
    migrateCockpitSnapshot(snapshot);
    const token = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const body: CockpitSessionRequest = { type: 'import', token, snapshot };
    const digest = await inputDigest(snapshot);
    if (this.disposed) return;
    await this.switchConnection(
      {
        id: crypto.randomUUID(),
        token,
        pending: { type: 'import', digest },
        replayDeckDigest: await this.rememberReplayDeck(snapshot.deck),
      },
      body,
    );
  }
  async start(deck: InitDeckCard[], seats?: 2 | 4): Promise<void> {
    deck = structuredClone(deck);
    const replayDeckDigest = await this.rememberReplayDeck(deck);
    const digest = await inputDigest({ deck, seats });
    if (this.disposed) return;
    const raw = localStorage.getItem(CONNECTION_KEY);
    if (raw) {
      const existing = JSON.parse(raw) as Connection;
      if (existing.pending?.type === 'create' && existing.pending.digest === digest) {
        existing.replayDeckDigest = replayDeckDigest;
        this.connection = existing;
        try {
          await this.reconnect();
        } catch (error) {
          if (!(error instanceof CockpitConnectionError) || error.code !== 'SESSION_NOT_FOUND')
            throw error;
          this.connection = existing;
          this.persist();
          this.busy = true;
          try {
            await this.send({
              type: 'create',
              token: existing.token,
              deck,
              seed: crypto.getRandomValues(new Uint32Array(1))[0],
              seats,
            });
            this.finishPending();
          } catch (retryError) {
            if (isDefiniteRejection(retryError) && !this.disposed) this.rollbackSwitch(retryError);
            throw retryError;
          } finally {
            this.busy = false;
          }
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
    await this.switchConnection(
      {
        id: crypto.randomUUID(),
        token,
        connectionId: crypto.randomUUID(),
        pending: { type: 'create', digest },
        replayDeckDigest,
      },
      body,
    );
  }
  async reconnect(): Promise<'recovered' | 'unseen'> {
    await this.polling;
    if (this.disposed || this.busy) throw new Error('接続処理を終えてから操作してください。');
    this.pollFailures = 0;
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
      this.finishPending();
      return 'recovered';
    } catch (error) {
      if (this.connection?.previous && isDefiniteRejection(error) && !this.disposed)
        this.rollbackSwitch(error);
      throw error;
    } finally {
      this.busy = false;
    }
  }
  async commit(
    operation: TableOperation | R4TableOperation | { type: 'undo' } | { type: 'redo' },
    context?: ExpectedInteractionContext,
  ): Promise<void> {
    if (
      context &&
      operation.type !== 'undo' &&
      operation.type !== 'redo' &&
      R4B_CONTEXTUAL_FORMAL_TYPES.has(operation.type as R4bOperation['type'])
    ) {
      await this.commitV2(operation as R4bOperation, context);
      return;
    }
    await this.submit(operation, false, context);
  }
  async commitV2(
    operation: R4bOperation,
    context: ExpectedInteractionContext,
    declaredCause?: R4bDeclaredCause,
  ): Promise<void> {
    await this.submit(operation, false, context, {
      protocolVersion: R4B_PROTOCOL_VERSION,
      ...(declaredCause ? { declaredCause } : {}),
    });
  }
  private async submit(
    operation:
      | TableOperation
      | R4TableOperation
      | R4bOperation
      | { type: 'undo' }
      | { type: 'redo' }
      | CockpitControl,
    control: boolean,
    context?: ExpectedInteractionContext,
    r4b?: { protocolVersion: typeof R4B_PROTOCOL_VERSION; declaredCause?: R4bDeclaredCause },
  ): Promise<void> {
    await this.polling;
    if (!this.connection || !this.view || this.connection.pending || this.busy || this.disposed)
      throw new Error('送信結果の確認が必要です。再接続してください。');
    this.busy = true;
    const { token } = this.connection;
    const commitIdentity = control
      ? operation
      : {
          ...(r4b ? { protocolVersion: r4b.protocolVersion } : {}),
          operation,
          ...(context ? { context } : {}),
          ...(r4b?.declaredCause ? { declaredCause: r4b.declaredCause } : {}),
        };
    const body: CockpitSessionRequest & { requestId: string } = {
      type: control ? 'control' : 'commit',
      token,
      requestId: crypto.randomUUID(),
      revision: this.view.revision,
      ...(control
        ? { control: operation }
        : {
            operation,
            ...(context ? { context } : {}),
            ...(r4b ? { protocolVersion: r4b.protocolVersion } : {}),
            ...(r4b?.declaredCause ? { declaredCause: r4b.declaredCause } : {}),
          }),
    } as CockpitSessionRequest & { requestId: string };
    try {
      this.connection.pending = {
        type: 'commit',
        requestId: body.requestId,
        digest: await inputDigest(commitIdentity),
      };
      if (this.disposed) throw new CockpitConnectionError('画面を閉じました。');
      this.persist();
      await this.send(body);
      this.connection.pending = null;
      this.persist();
    } catch (error) {
      if (this.connection && !this.disposed) {
        if (isCockpitOperationRejection(error)) {
          this.connection.pending = null;
          this.persist();
          await this.send({ type: 'read', token });
        } else if (isCockpitTerminalFailure(error)) {
          this.connection.pending = null;
          this.persist();
          this.view = null;
          if (this.pollTimer) clearTimeout(this.pollTimer);
        }
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
