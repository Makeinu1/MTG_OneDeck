import { parseOnlineSharedInviteCodeV3 } from '../lobby/index';
import { parsePublicOnlineErrorV3, publicOnlineErrorMessageV3 } from './recoveryV1';
import {
  createOnlineBrowserWebSocketClientV1,
  type OnlineBrowserWebSocketClientV1,
} from '../browser/index';
import {
  bindPersonalWorkbenchActionV1,
  type OnlineDisplayPairingSessionV1,
} from '../displayPairing/index';
import { bindOnlineGuidedCommandActionV1 } from '../guidedActions/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import {
  type PublicOnlineConfigurationV3,
  type PublicOnlineControllerV3,
  type PublicOnlineDeckOptionV2,
  type PublicOnlineErrorIssueV2,
  type PublicOnlineProjectionV3,
  type PublicOnlineSeatV3,
  type PublicOnlineSnapshotV3,
} from './types';
import { PUBLIC_ONLINE_ENDPOINT_V1 } from './index';
import type { OnlineBrowserStateV1, OnlineBrowserSubmitErrorCodeV1 } from '../browser/index';
import { validateOnlineTabletopIntentEnvelopeV1, type OnlineTabletopIntentEnvelopeV1 } from '../tabletopManual/index';
import { validateOnlineVisibilityIntentV1, type OnlineVisibilityIntentEnvelopeV1 } from '../visibilityDecisions/index';
import {
  validateOnlinePregameProjectionV1,
  type OnlinePregameCommandResponseV1,
  type OnlinePregameCommandV1,
  type OnlinePregameProjectionV1,
} from '../pregame/index';

const RECOVERY_KEY = 'mtg-onedeck:online-recovery-v2';
const MAX_RESPONSE_BYTES = 1_048_576;
const CAPABILITY = /^[A-Za-z0-9_-]{32,128}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const BEARER_TEXT = /(?:seat|invite|admission|observer|table)_[A-Za-z0-9_-]{8}/iu;
let generatedSequence = 0;
class ClientFailure extends Error { readonly code: 'CLIENT_OFFLINE' | 'CLIENT_TIMEOUT' | 'CLIENT_INVALID_RESPONSE' | 'CLIENT_UPGRADE_REQUIRED'; constructor(code: ClientFailure['code'], message: string) { super(message); this.code = code; } }
class ServerFailure extends Error { readonly detail: ReturnType<typeof publicOnlineErrorMessageV3>; constructor(detail: ReturnType<typeof publicOnlineErrorMessageV3>) { super(detail.message); this.detail = detail; } }
function secretFragment(text: string, secrets: readonly string[]): boolean {
  return secrets.some((secret) => [...Array(Math.max(0, secret.length - 7)).keys()].some((offset) => text.includes(secret.slice(offset, offset + 8))));
}
function clientIssue(error: unknown, action: string): PublicOnlineErrorIssueV2 {
  if (error instanceof ServerFailure) return Object.freeze({ ...error.detail, action });
  const code = error instanceof ClientFailure ? error.code : error instanceof TypeError ? 'CLIENT_OFFLINE' : 'CLIENT_INVALID_RESPONSE';
  const messages: Readonly<Record<string, string>> = { CLIENT_OFFLINE: 'ネットワークに接続できません。', CLIENT_TIMEOUT: '接続がタイムアウトしました。', CLIENT_INVALID_RESPONSE: 'サーバーから予期しない応答が返りました。ページを更新して再試行してください。', CLIENT_UPGRADE_REQUIRED: 'ページを更新して最新版を読み込んでください。' };
  return Object.freeze({ code, retryable: code === 'CLIENT_OFFLINE' || code === 'CLIENT_TIMEOUT', message: messages[code] ?? messages.CLIENT_INVALID_RESPONSE, correlationId: generatedId('correlation'), action });
}
function visibilitySubmitIssue(code: OnlineBrowserSubmitErrorCodeV1): PublicOnlineErrorIssueV2 {
  const messages: Readonly<Record<OnlineBrowserSubmitErrorCodeV1, string>> = {
    OUTBOX_FULL: '送信待ちの操作がいっぱいです。接続が落ち着くまで待ってから盤面を確認してください。',
    COMMAND_ID_REUSE: '同じ操作IDを再利用したため送信を中止しました。盤面を確認して別の操作を行ってください。',
    INVALID_COMMAND: '操作内容を確認できないため送信を中止しました。盤面を確認してもう一度お試しください。',
  };
  return Object.freeze({
    code: `CLIENT_${code}`,
    retryable: false,
    message: messages[code],
    correlationId: generatedId('correlation'),
    action: '盤面を確認',
  });
}
/** Convert a browser transport rejection into bounded Japanese recovery
 * guidance.  The browser exposes only a safe issue code; protocol paths and
 * raw server messages never cross into the player surface. */
function browserStateIssue(state: OnlineBrowserStateV1, action: string): PublicOnlineErrorIssueV2 | null {
  const code = state.issueCode;
  if (code === null) return null;
  const retryable = code === 'STALE_REVISION' || code === 'SOCKET_ERROR' || code === 'SOCKET_CLOSED'
    || code === 'SEND_FAILED' || code === 'RECONNECT_EXHAUSTED';
  const message = code === 'STALE_REVISION'
    ? '盤面が更新されました。表示を確認してからもう一度お試しください。'
    : code === 'CORE_COMMAND_REJECTED' || code === 'COMMAND_SEQUENCE_MISMATCH'
      ? '現在の盤面ではその操作を受け付けられません。表示を確認して再試行してください。'
      : code === 'AUTHORIZATION_REJECTED' || code === 'PARTICIPANT_NOT_CONNECTED' || code === 'ROLE_NOT_ALLOWED'
        ? 'この操作を行う権限を確認できません。盤面を更新して再接続してください。'
        : '接続または操作の結果を確認できませんでした。盤面を確認して再試行してください。';
  return Object.freeze({ code: `CLIENT_${code}`, retryable, message, correlationId: generatedId('correlation'), action });
}
const DECK_ISSUE_CODES = new Set([
  'EMPTY_LIST', 'INVALID_SECTION', 'INVALID_QUANTITY', 'INVALID_CARD_ID',
  'CARD_NOT_FOUND', 'IDENTITY_MISMATCH', 'SCRYFALL_UNAVAILABLE',
  'SUBMISSION_CONFLICT', 'STALE_RESOLUTION', 'SNAPSHOT_TOO_LARGE',
]);
const deckIssueText = (code: string): string => ({
  EMPTY_LIST: 'カードリストが空です。',
  INVALID_SECTION: 'セクションを修正してください。',
  INVALID_QUANTITY: 'カードの数量を正の整数に修正してください。',
  INVALID_CARD_ID: 'カードIDを確認してください。',
  CARD_NOT_FOUND: '確認できないカードがあります。再解決して再提出してください。',
  IDENTITY_MISMATCH: 'カード情報が一致しません。再解決してください。',
  SCRYFALL_UNAVAILABLE: 'カード情報を確認できませんでした。再試行してください。',
  SUBMISSION_CONFLICT: '提出が競合しました。再提出してください。',
  STALE_RESOLUTION: '提出結果が古くなりました。再試行してください。',
  SNAPSHOT_TOO_LARGE: 'デッキが大きすぎます。数量またはカード数を減らしてください。',
}[code] ?? 'デッキを確認して再提出してください。');
function parseDeckIssues(value: unknown, entryCount: number): readonly { readonly code: string; readonly entryIndex: number | null; readonly retryable: boolean }[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 128) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || !keys.includes('length') || keys.some((key) => key !== 'length' && (typeof key !== 'string' || !/^\d+$/u.test(key)))) return null;
  const parsed: { code: string; entryIndex: number | null; retryable: boolean }[] = [];
  for (const item of value) {
    if (!exact(item, ['code', 'entryIndex', 'retryable'])) return null;
    const code = own(item, 'code'); const entryIndex = own(item, 'entryIndex'); const retryable = own(item, 'retryable');
    if (typeof code !== 'string' || !DECK_ISSUE_CODES.has(code) || typeof retryable !== 'boolean' ||
      (entryIndex !== null && (typeof entryIndex !== 'number' || !Number.isSafeInteger(entryIndex) || entryIndex < 0 || entryIndex >= entryCount))) return null;
    parsed.push({ code, entryIndex, retryable });
  }
  return Object.freeze(parsed);
}
function responseHasForbiddenFragment(value: unknown, forbidden: readonly string[], key?: string): boolean {
  if (key === 'seatCapability' || key === 'tableCapability' || key === 'kind') return false;
  if (typeof value === 'string') return secretFragment(value, forbidden);
  if (Array.isArray(value)) return value.some((item) => responseHasForbiddenFragment(item, forbidden));
  if (value !== null && typeof value === 'object') return Object.entries(value as Record<string, unknown>).some(([entryKey, entryValue]) => responseHasForbiddenFragment(entryValue, forbidden, entryKey));
  return false;
}
const configurations = (value: unknown): value is PublicOnlineConfigurationV3 => {
  if (!exact(value, ['playerCount', 'startingLife'])) return false;
  return (own(value, 'playerCount') === 2 || own(value, 'playerCount') === 4) &&
    (own(value, 'startingLife') === 20 || own(value, 'startingLife') === 40) &&
    (own(value, 'playerCount') !== 4 || own(value, 'startingLife') === 40);
};
const own = (value: Record<string, unknown>, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor ? descriptor.value : undefined;
};
const exact = (value: unknown, fields: readonly string[]): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || !keys.every((key) => typeof key === 'string' && fields.includes(key))) return false;
    return keys.every((key) => {
      if (typeof key !== 'string') return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined;
    });
  } catch { return false; }
};

function denseArray(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value)) return null;
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== lengthDescriptor.value + 1 || !keys.includes('length')) return null;
    const result: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch { return null; }
}
const generatedId = (prefix: string): string => {
  const random = typeof globalThis.crypto?.getRandomValues === 'function'
    ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(36)).join('')
    : `fallback${String(generatedSequence += 1).padStart(48, '0')}`;
  return `${prefix}-${random}`.slice(0, 70);
};

function seat(value: unknown, index: number): PublicOnlineSeatV3 | null {
  if (!exact(value, ['seatIndex', 'corePlayerId', 'participantId', 'acceptedDeck', 'ready'])) return null;
  const participantId = own(value, 'participantId');
  if (own(value, 'seatIndex') !== index || own(value, 'corePlayerId') !== `P${index + 1}` ||
      (participantId !== null && (typeof participantId !== 'string' || !ID.test(participantId))) ||
      typeof own(value, 'acceptedDeck') !== 'boolean' || typeof own(value, 'ready') !== 'boolean' ||
      (own(value, 'ready') === true && own(value, 'acceptedDeck') !== true)) return null;
  return Object.freeze({
    seatIndex: index as 0 | 1 | 2 | 3,
    corePlayerId: `P${index + 1}` as 'P1' | 'P2' | 'P3' | 'P4',
    participantId,
    acceptedDeck: own(value, 'acceptedDeck') as boolean,
    ready: own(value, 'ready') as boolean,
  });
}

export function validatePublicOnlineProjectionV3(input: unknown): Readonly<{ readonly ok: true; readonly value: PublicOnlineProjectionV3 } | { readonly ok: false }> {
  try {
    if (!exact(input, ['kind', 'schemaVersion', 'lifecycle', 'roomId', 'serverBuildId', 'hostParticipantId', 'configuration', 'seats'])) return { ok: false };
    if (own(input, 'kind') !== 'online-forming-lobby-projection-v4' || own(input, 'schemaVersion') !== 4 ||
        !ID.test(String(own(input, 'roomId'))) || typeof own(input, 'serverBuildId') !== 'string' ||
        !ID.test(String(own(input, 'hostParticipantId'))) || !configurations(own(input, 'configuration'))) return { ok: false };
    const rawConfig = own(input, 'configuration') as PublicOnlineConfigurationV3;
    const config = Object.freeze({
      playerCount: rawConfig.playerCount,
      startingLife: rawConfig.startingLife,
    });
    if (!['forming', 'ready', 'started'].includes(String(own(input, 'lifecycle')))) return { ok: false };
    const rawSeats = denseArray(own(input, 'seats'));
    if (rawSeats === null || rawSeats.length !== config.playerCount) return { ok: false };
    const seats = rawSeats.map((value, index) => seat(value, index));
    if (seats.some((value): value is null => value === null)) return { ok: false };
    const parsedSeats = seats as PublicOnlineSeatV3[];
    const participants = parsedSeats.filter((value) => value.participantId !== null).map((value) => value.participantId as string);
    if (parsedSeats[0]?.participantId !== own(input, 'hostParticipantId') || new Set(participants).size !== participants.length) return { ok: false };
    const complete = parsedSeats.every((value) => value.participantId !== null && value.acceptedDeck && value.ready);
    const lifecycle = own(input, 'lifecycle') as PublicOnlineProjectionV3['lifecycle'];
    if ((lifecycle === 'forming' && complete) || ((lifecycle === 'ready' || lifecycle === 'started') && !complete)) return { ok: false };
    return Object.freeze({ ok: true, value: Object.freeze({
      kind: 'online-forming-lobby-projection-v4', schemaVersion: 4, lifecycle,
      roomId: own(input, 'roomId') as string, serverBuildId: own(input, 'serverBuildId') as string,
      hostParticipantId: own(input, 'hostParticipantId') as string, configuration: config,
      seats: Object.freeze(parsedSeats),
    }) });
  } catch { return { ok: false }; }
}

type RecoveryRecord = Readonly<{
  readonly kind: 'public-online-recovery-v2'; readonly schemaVersion: 2; readonly wireGeneration: 'variable-v5';
  readonly roomId: string; readonly participantId: string; readonly seatCapability: string; readonly isHost: boolean;
  readonly tableParticipantId: string | null; readonly tableCapability: string | null;
}>;
function loadRecovery(): RecoveryRecord | null {
  try {
    const value = JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? 'null') as unknown;
    if (!exact(value, ['kind', 'schemaVersion', 'wireGeneration', 'roomId', 'participantId', 'seatCapability', 'isHost', 'tableParticipantId', 'tableCapability'])) return null;
    if (own(value, 'kind') !== 'public-online-recovery-v2' || own(value, 'schemaVersion') !== 2 || own(value, 'wireGeneration') !== 'variable-v5' ||
      typeof own(value, 'roomId') !== 'string' || typeof own(value, 'participantId') !== 'string' || !CAPABILITY.test(String(own(value, 'seatCapability'))) ||
      typeof own(value, 'isHost') !== 'boolean' || (own(value, 'tableParticipantId') !== null && typeof own(value, 'tableParticipantId') !== 'string') || (own(value, 'tableCapability') !== null && typeof own(value, 'tableCapability') !== 'string') || ((own(value, 'tableParticipantId') === null) !== (own(value, 'tableCapability') === null)) || (own(value, 'isHost') === false && (own(value, 'tableParticipantId') !== null || own(value, 'tableCapability') !== null)) || (own(value, 'tableCapability') !== null && !CAPABILITY.test(String(own(value, 'tableCapability'))))) return null;
    return value as RecoveryRecord;
  } catch { return null; }
}
function saveRecovery(value: RecoveryRecord): void {
  try { localStorage.setItem(RECOVERY_KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
function clearRecoveryRecords(): void {
  try {
    localStorage.removeItem(RECOVERY_KEY);
    localStorage.removeItem('mtg-onedeck:online-recovery-v1');
  } catch { /* storage unavailable */ }
}
function loadLegacyRecovery(): RecoveryRecord | null {
  try {
    const value = JSON.parse(localStorage.getItem('mtg-onedeck:online-recovery-v1') ?? 'null') as unknown;
    if (!exact(value, ['kind', 'schemaVersion', 'roomId', 'participantId', 'seatCapability', 'isHost', 'tableParticipantId', 'tableCapability']) || own(value, 'kind') !== 'public-online-recovery-v1' || own(value, 'schemaVersion') !== 1) return null;
    if (typeof own(value, 'roomId') !== 'string' || typeof own(value, 'participantId') !== 'string' || typeof own(value, 'seatCapability') !== 'string' || !CAPABILITY.test(String(own(value, 'seatCapability'))) || (own(value, 'tableParticipantId') !== null && typeof own(value, 'tableParticipantId') !== 'string') || (own(value, 'tableCapability') !== null && typeof own(value, 'tableCapability') !== 'string') || ((own(value, 'tableParticipantId') === null) !== (own(value, 'tableCapability') === null)) || typeof own(value, 'isHost') !== 'boolean') return null;
    if (own(value, 'isHost') === false && (own(value, 'tableParticipantId') !== null || own(value, 'tableCapability') !== null)) return null;
    if (own(value, 'isHost') === true && own(value, 'tableCapability') !== null && !CAPABILITY.test(String(own(value, 'tableCapability')))) return null;
    return Object.freeze({ kind: 'public-online-recovery-v2', schemaVersion: 2, wireGeneration: 'variable-v5', roomId: own(value, 'roomId') as string, participantId: own(value, 'participantId') as string, seatCapability: own(value, 'seatCapability') as string, isHost: own(value, 'isHost') as boolean, tableParticipantId: own(value, 'tableParticipantId') as string | null, tableCapability: own(value, 'tableCapability') as string | null });
  } catch { return null; }
}
function normalizeLegacyProjection(input: unknown, roomId: string, hostParticipantId: string): PublicOnlineProjectionV3 | null {
  if (!exact(input, ['kind', 'schemaVersion', 'lifecycle', 'roomId', 'serverBuildId', 'hostParticipantId', 'seats']) || own(input, 'kind') !== 'online-forming-lobby-projection-v2' || own(input, 'schemaVersion') !== 2 || own(input, 'roomId') !== roomId || own(input, 'hostParticipantId') !== hostParticipantId) return null;
  const rawSeats = denseArray(own(input, 'seats'));
  if (rawSeats === null || rawSeats.length !== 4) return null;
  const seats = rawSeats.map((value, index) => {
    if (!exact(value, ['seatIndex', 'corePlayerId', 'participantId', 'deckState', 'ready']) || own(value, 'seatIndex') !== index || own(value, 'corePlayerId') !== `P${index + 1}`) return null;
    const participantId = own(value, 'participantId'); const deckState = own(value, 'deckState'); const ready = own(value, 'ready');
    if (participantId !== null && typeof participantId !== 'string' || !['none', 'resolving', 'accepted', 'needs-attention'].includes(String(deckState)) || typeof ready !== 'boolean') return null;
    return { seatIndex: index, corePlayerId: `P${index + 1}`, participantId, acceptedDeck: deckState === 'accepted', ready };
  });
  if (seats.some((value) => value === null)) return null;
  const candidate = { kind: 'online-forming-lobby-projection-v4', schemaVersion: 4, lifecycle: own(input, 'lifecycle'), roomId, serverBuildId: own(input, 'serverBuildId'), hostParticipantId, configuration: { playerCount: 4, startingLife: 40 }, seats };
  const checked = validatePublicOnlineProjectionV3(candidate);
  return checked.ok ? checked.value : null;
}

export function createPublicOnlineControllerV3(): PublicOnlineControllerV3 {
  let snapshot: PublicOnlineSnapshotV3 = Object.freeze({ mode: 'entry', roomId: null, participantId: null, isHost: false, ownSeatIndex: null, lifecycle: null, configuration: null, projection: null, invites: Object.freeze([]), selectedDeckId: '', busy: null, connection: 'lobby', error: null, errorIssue: null, recoveryAvailable: loadRecovery() !== null || loadLegacyRecovery() !== null, ownerIssue: null, admissionOpen: null, player: null as OnlineBrowserStateV1 | null, table: null as OnlineBrowserStateV1 | null, pregame: null });
  let secrets: Readonly<{ participantId: string; seatCapability: string; tableParticipantId: string; tableCapability: string }> | null = null;
  let playerClient: OnlineBrowserWebSocketClientV1 | null = null;
  let tableClient: OnlineBrowserWebSocketClientV1 | null = null;
  let playerUnsubscribe: (() => void) | null = null;
  let tableUnsubscribe: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(value: PublicOnlineSnapshotV3) => void>();
  let retryOperation: (() => Promise<void>) | null = null;
  let playerTransportIssueVisible = false;
  const publish = (patch: Partial<PublicOnlineSnapshotV3> = {}): void => {
    snapshot = Object.freeze({ ...snapshot, ...patch, recoveryAvailable: loadRecovery() !== null || loadLegacyRecovery() !== null });
    listeners.forEach((listener) => listener(snapshot));
  };
  const request = async (path: string, body: Record<string, unknown>, forbidden: readonly string[] = []): Promise<{ readonly response: Response; readonly value: unknown }> => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 15_000);
    let response: Response;
    try {
      response = await fetch(`${PUBLIC_ONLINE_ENDPOINT_V1}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: abort.signal });
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw new Error('応答が大きすぎます。');
      let value: unknown = null;
      try {
        const text = await response.text();
        if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) throw new Error('応答が大きすぎます。');
        value = JSON.parse(text) as unknown;
      } catch {
        if (abort.signal.aborted) throw new ClientFailure('CLIENT_TIMEOUT', '接続がタイムアウトしました。');
        /* malformed response handled by caller */
      }
      if (!response.ok) {
        if (secretFragment(JSON.stringify(value), forbidden)) throw new ClientFailure('CLIENT_INVALID_RESPONSE', 'サーバーから予期しない応答が返りました。');
        const parsed = parsePublicOnlineErrorV3(value);
        if (parsed !== null) throw new ServerFailure(publicOnlineErrorMessageV3(parsed));
        if (response.status === 426) throw new ClientFailure('CLIENT_UPGRADE_REQUIRED', 'ページを更新して最新版を読み込んでください。');
        throw new ClientFailure('CLIENT_INVALID_RESPONSE', 'サーバーから予期しない応答が返りました。');
      }
      if (responseHasForbiddenFragment(value, forbidden)) throw new ClientFailure('CLIENT_INVALID_RESPONSE', 'サーバーから予期しない応答が返りました。');
      return { response, value };
    } catch (error: unknown) {
      if (abort.signal.aborted) throw new ClientFailure('CLIENT_TIMEOUT', '接続がタイムアウトしました。');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
  const startBrowsers = (): void => {
    if (secrets === null || snapshot.roomId === null || snapshot.lifecycle !== 'started' || (snapshot.pregame !== null && snapshot.pregame.phase !== 'complete')) return;
    const webSocketUrl = `${PUBLIC_ONLINE_ENDPOINT_V1.replace(/^http/u, 'ws')}/api/online/rooms/${encodeURIComponent(snapshot.roomId)}/websocket`;
    const common = { webSocketUrl, protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: snapshot.roomId as never, clientBuildId: 'o4p-09f-client' as never };
    playerUnsubscribe?.(); tableUnsubscribe?.(); playerUnsubscribe = null; tableUnsubscribe = null;
    playerClient?.disconnect(); tableClient?.disconnect();
    playerClient = createOnlineBrowserWebSocketClientV1({ ...common, participantId: secrets.participantId as never, participantCapability: secrets.seatCapability as never });
    playerUnsubscribe = playerClient.subscribe((state) => {
      const connection = state.phase === 'open' ? 'online' : state.phase === 'recovering' ? 'reconnecting' : state.phase === 'failed' ? 'failed' : 'connecting';
      const issue = browserStateIssue(state, '盤面を確認');
      if (issue !== null) {
        playerTransportIssueVisible = true;
        publish({ player: state, connection, error: issue.message, errorIssue: issue });
      } else if (playerTransportIssueVisible) {
        playerTransportIssueVisible = false;
        publish({ player: state, connection, error: null, errorIssue: null });
      } else {
        publish({ player: state, connection });
      }
    });
    playerClient.connect();
    if (secrets.tableParticipantId && secrets.tableCapability) {
      tableClient = createOnlineBrowserWebSocketClientV1({ ...common, participantId: secrets.tableParticipantId as never, participantCapability: secrets.tableCapability as never });
      tableUnsubscribe = tableClient.subscribe((state) => publish({ table: state, connection: state.phase === 'open' ? 'online' : state.phase === 'recovering' ? 'reconnecting' : state.phase === 'failed' ? 'failed' : 'connecting' }));
      tableClient.connect();
    }
  };
  const schedulePoll = (): void => {
    const pregamePending = snapshot.mode === 'started' && snapshot.pregame !== null && snapshot.pregame.phase !== 'complete';
    if (pollTimer !== null || (snapshot.mode !== 'forming' && !pregamePending)) return;
    pollTimer = setTimeout(() => {
      pollTimer = null;
      if (snapshot.busy === null) void recover();
      if (snapshot.mode === 'forming' || (snapshot.mode === 'started' && snapshot.pregame !== null && snapshot.pregame.phase !== 'complete')) schedulePoll();
    }, 2_000);
  };
  const applyLobby = (value: PublicOnlineProjectionV3, participantId: string, isHost: boolean, invites: readonly string[], admissionOpen: boolean | null = isHost ? true : null, pregame: OnlinePregameProjectionV1 | null = null): void => {
    if (value.lifecycle === 'started' && value.configuration.startingLife === 40 && pregame === null) throw new Error('対戦準備の状態を確認できませんでした。');
    const ownSeat = value.seats.find((entry) => entry.participantId === participantId)?.seatIndex ?? null;
    const serverSaysHost = value.hostParticipantId === participantId;
    if (ownSeat === null || serverSaysHost !== isHost || (isHost && ownSeat !== 0) || (!isHost && ownSeat === 0)) {
      throw new Error('参加席とホスト権限を確認できませんでした。');
    }
    retryOperation = null;
    publish({ mode: value.lifecycle === 'started' ? 'started' : 'forming', roomId: value.roomId, participantId, isHost, ownSeatIndex: ownSeat, lifecycle: value.lifecycle, configuration: value.configuration, projection: value, invites, connection: value.lifecycle === 'started' && pregame !== null && pregame.phase !== 'complete' ? 'online' : value.lifecycle === 'started' ? 'connecting' : 'lobby', error: null, errorIssue: null, admissionOpen, pregame });
    if (value.lifecycle === 'started') startBrowsers();
    schedulePoll();
  };
  const createShared = async (configuration: PublicOnlineConfigurationV3 = { playerCount: 2, startingLife: 40 }): Promise<void> => {
    if (snapshot.busy !== null || !configurations(configuration)) return;
    const participantId = generatedId('participant');
    publish({ busy: 'create', error: null, errorIssue: null });
    try {
      const { value } = await request('/api/online/rooms', { kind: 'online-forming-lobby-create-v5', schemaVersion: 5, participantId, playerCount: configuration.playerCount, startingLife: configuration.startingLife });
      if (!exact(value, ['kind', 'schemaVersion', 'roomId', 'participantId', 'playerCount', 'startingLife', 'seatCapability', 'inviteCode', 'tableParticipantId', 'tableCapability', 'projection']) || own(value, 'kind') !== 'online-forming-lobby-created-v5' || own(value, 'schemaVersion') !== 5 || own(value, 'participantId') !== participantId || own(value, 'playerCount') !== configuration.playerCount || own(value, 'startingLife') !== configuration.startingLife) throw new Error('部屋を作成できませんでした。');
      const checked = validatePublicOnlineProjectionV3(own(value, 'projection'));
      const seatCapability = own(value, 'seatCapability'); const inviteCode = own(value, 'inviteCode'); const tableParticipantId = own(value, 'tableParticipantId'); const tableCapability = own(value, 'tableCapability');
      const parsedInvite = typeof inviteCode === 'string' ? parseOnlineSharedInviteCodeV3(inviteCode) : null;
      const safeInviteCode = typeof inviteCode === 'string' && parsedInvite !== null ? inviteCode : null;
      if (!checked.ok || checked.value.roomId !== own(value, 'roomId') || checked.value.hostParticipantId !== participantId || checked.value.seats[0]?.participantId !== participantId || checked.value.configuration.playerCount !== configuration.playerCount || checked.value.configuration.startingLife !== configuration.startingLife || typeof seatCapability !== 'string' || !CAPABILITY.test(seatCapability) || parsedInvite === null || parsedInvite.roomId !== checked.value.roomId || secretFragment(seatCapability, [parsedInvite.admissionCapability]) || typeof tableParticipantId !== 'string' || !ID.test(tableParticipantId) || typeof tableCapability !== 'string' || !CAPABILITY.test(tableCapability) || secretFragment(tableCapability, [parsedInvite.admissionCapability]) || safeInviteCode === null) throw new Error('部屋の応答を検証できませんでした。');
      secrets = Object.freeze({ participantId, seatCapability, tableParticipantId, tableCapability });
      saveRecovery({ kind: 'public-online-recovery-v2', schemaVersion: 2, wireGeneration: 'variable-v5', roomId: checked.value.roomId, participantId, seatCapability, isHost: true, tableParticipantId, tableCapability });
      applyLobby(checked.value, participantId, true, [safeInviteCode]);
    } catch (error: unknown) {
      const issue = clientIssue(error, 'もう一度部屋を作る');
      if (issue.retryable) retryOperation = () => createShared(configuration);
      publish({ error: issue.message, errorIssue: issue });
    }
    finally { publish({ busy: null }); }
  };
  const joinShared = async (inviteCode: string): Promise<void> => {
    const invite = parseOnlineSharedInviteCodeV3(inviteCode);
    if (snapshot.busy !== null || invite === null) { publish({ error: '招待が正しくありません。', errorIssue: Object.freeze({ code: 'INVITE_INVALID', retryable: false, message: '招待が正しくありません。', correlationId: generatedId('correlation'), action: '招待コードを確認' }) }); return; }
    const participantId = generatedId('participant'); publish({ busy: 'join', error: null });
    try {
      const { value } = await request(`/api/online/rooms/${encodeURIComponent(invite.roomId)}/lobby`, { kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 4, participantId, admissionCapability: invite.admissionCapability }, [invite.admissionCapability]);
      if (!exact(value, ['kind', 'schemaVersion', 'roomId', 'participantId', 'seatCapability', 'projection']) || own(value, 'kind') !== 'online-forming-lobby-shared-claimed-v4' || own(value, 'schemaVersion') !== 4 || own(value, 'roomId') !== invite.roomId || own(value, 'participantId') !== participantId) throw new Error('ロビーに参加できませんでした。');
      const checked = validatePublicOnlineProjectionV3(own(value, 'projection')); const seatCapability = own(value, 'seatCapability');
      const ownSeat = checked.ok ? checked.value.seats.find((entry) => entry.participantId === participantId) : undefined;
      if (!checked.ok || checked.value.roomId !== invite.roomId || checked.value.hostParticipantId === participantId || ownSeat === undefined || ownSeat.seatIndex === 0 || typeof seatCapability !== 'string' || !CAPABILITY.test(seatCapability) || secretFragment(seatCapability, [invite.admissionCapability])) throw new Error('ロビーの応答を検証できませんでした。');
      secrets = Object.freeze({ participantId, seatCapability, tableParticipantId: '', tableCapability: '' }); saveRecovery({ kind: 'public-online-recovery-v2', schemaVersion: 2, wireGeneration: 'variable-v5', roomId: invite.roomId, participantId, seatCapability, isHost: false, tableParticipantId: null, tableCapability: null }); applyLobby(checked.value, participantId, false, []);
    } catch (error: unknown) {
      const issue = clientIssue(error, 'もう一度参加');
      if (issue.retryable) retryOperation = () => joinShared(inviteCode);
      publish({ error: issue.message, errorIssue: issue });
    }
    finally { publish({ busy: null }); }
  };
  const recover = async (): Promise<void> => {
    const variableRecord = loadRecovery();
    const record = variableRecord ?? loadLegacyRecovery();
    const legacy = variableRecord === null && record !== null;
    if (snapshot.busy !== null || record === null) return;
    publish({ busy: 'refresh', error: null });
    try {
      const { value } = await request(`/api/online/rooms/${encodeURIComponent(record.roomId)}/lobby`, legacy
        ? { kind: 'online-forming-lobby-recover-v4', schemaVersion: 4, participantId: record.participantId, seatCapability: record.seatCapability }
        : { kind: 'online-forming-lobby-recover-v5', schemaVersion: 5, participantId: record.participantId, seatCapability: record.seatCapability }, [record.seatCapability, ...(record.tableCapability === null ? [] : [record.tableCapability])]);
      const responseFields = legacy
        ? ['kind', 'schemaVersion', 'roomId', 'participantId', 'seatCapability', ...(record.isHost ? ['admissionOpen', 'inviteCode', 'tableParticipantId', 'tableCapability'] : []), 'projection']
        : ['kind', 'schemaVersion', 'roomId', 'participantId', 'playerCount', 'startingLife', ...(record.isHost ? ['admissionOpen', 'inviteCode', 'tableParticipantId', 'tableCapability'] : []), 'projection', 'pregame'];
      const compatibleResponseFields = legacy ? responseFields : responseFields.filter((field) => field !== 'pregame');
      if ((!exact(value, responseFields) && !exact(value, compatibleResponseFields)) || own(value, 'kind') !== (legacy ? 'online-forming-lobby-recovered-v4' : 'online-forming-lobby-recovered-v5') || own(value, 'schemaVersion') !== (legacy ? 4 : 5) || own(value, 'roomId') !== record.roomId || own(value, 'participantId') !== record.participantId) throw new Error('対戦に戻れませんでした。');
      const legacyProjection = own(value, 'projection');
      const legacyProjectionHeader = legacy && exact(legacyProjection, ['kind', 'schemaVersion', 'lifecycle', 'roomId', 'serverBuildId', 'hostParticipantId', 'seats']) ? own(legacyProjection, 'hostParticipantId') : null;
      const legacyHost = legacy && typeof legacyProjectionHeader === 'string' ? legacyProjectionHeader : record.participantId;
      const normalized = legacy ? normalizeLegacyProjection(legacyProjection, record.roomId, legacyHost) : null;
      const checked = normalized === null ? validatePublicOnlineProjectionV3(legacyProjection) : { ok: true as const, value: normalized };
      if (!checked.ok) throw new Error('対戦の設定を検証できませんでした。');
      const recoveredSeat = checked.value.seats.find((entry) => entry.participantId === record.participantId);
      const serverSaysHost = checked.value.hostParticipantId === record.participantId;
      const previousProjection = snapshot.projection;
      const changedEstablishedAuthority = previousProjection !== null && (
        snapshot.roomId !== record.roomId ||
        snapshot.participantId !== record.participantId ||
        previousProjection.hostParticipantId !== checked.value.hostParticipantId ||
        previousProjection.configuration.playerCount !== checked.value.configuration.playerCount ||
        previousProjection.configuration.startingLife !== checked.value.configuration.startingLife ||
        snapshot.ownSeatIndex !== recoveredSeat?.seatIndex
      );
      if (checked.value.roomId !== record.roomId || recoveredSeat === undefined || serverSaysHost !== record.isHost || (record.isHost && recoveredSeat.seatIndex !== 0) || (!record.isHost && recoveredSeat.seatIndex === 0) || changedEstablishedAuthority || (legacy && own(value, 'seatCapability') !== record.seatCapability) || (!legacy && (checked.value.configuration.playerCount !== own(value, 'playerCount') || checked.value.configuration.startingLife !== own(value, 'startingLife')))) throw new Error('対戦の設定を検証できませんでした。');
      if (record.isHost) {
        if (typeof own(value, 'admissionOpen') !== 'boolean') throw new Error('参加受付状態を検証できませんでした。');
        const rawInvite = own(value, 'inviteCode');
        const parsedInvite = typeof rawInvite === 'string' ? parseOnlineSharedInviteCodeV3(rawInvite) : null;
        if (parsedInvite === null || parsedInvite.roomId !== record.roomId) throw new Error('招待を検証できませんでした。');
        const tableParticipantId = own(value, 'tableParticipantId'); const tableCapability = own(value, 'tableCapability');
        if ((tableParticipantId === null) !== (tableCapability === null) || (tableParticipantId !== null && (typeof tableParticipantId !== 'string' || !ID.test(tableParticipantId) || typeof tableCapability !== 'string' || !CAPABILITY.test(tableCapability))) || tableParticipantId !== record.tableParticipantId || tableCapability !== record.tableCapability) throw new Error('盤面権限を検証できませんでした。');
      }
      secrets = Object.freeze({ participantId: record.participantId, seatCapability: record.seatCapability, tableParticipantId: record.tableParticipantId ?? '', tableCapability: record.tableCapability ?? '' });
      const admissionOpen = record.isHost && typeof own(value, 'admissionOpen') === 'boolean' ? own(value, 'admissionOpen') as boolean : null;
      const invite = record.isHost && admissionOpen === true && typeof own(value, 'inviteCode') === 'string' ? [own(value, 'inviteCode') as string] : [];
      const rawPregame = legacy ? null : own(value, 'pregame');
      const checkedPregame = rawPregame === null || rawPregame === undefined ? null : validateOnlinePregameProjectionV1(rawPregame);
      if (checkedPregame !== null && (!checkedPregame.ok || checkedPregame.value.protocol.roomId !== record.roomId || checkedPregame.value.protocol.participantId !== record.participantId || checkedPregame.value.protocol.configuration.playerCount !== checked.value.configuration.playerCount || checkedPregame.value.protocol.configuration.startingLife !== checked.value.configuration.startingLife)) throw new Error('対戦準備の状態を検証できませんでした。');
      if (checked.value.lifecycle === 'started' && checked.value.configuration.startingLife === 40 && checkedPregame === null) throw new Error('対戦準備の状態を確認できませんでした。');
      applyLobby(checked.value, record.participantId, record.isHost, invite, admissionOpen, checkedPregame?.ok === true ? checkedPregame.value : null);
    } catch (error: unknown) {
      const issue = clientIssue(error, '対戦に戻る');
      if (['CREDENTIAL_KICKED', 'CREDENTIAL_REJECTED', 'ROOM_NOT_FOUND', 'ROOM_EXPIRED'].includes(issue.code)) {
        clearRecoveryRecords();
      }
      if (issue.retryable) retryOperation = () => recover();
      publish({ error: issue.message, errorIssue: issue, connection: issue.retryable ? 'reconnecting' : snapshot.connection });
    }
    finally { publish({ busy: null }); }
  };
  const refresh = async (): Promise<void> => { await recover(); };
  const preservesLobbyAuthority = (value: PublicOnlineProjectionV3, participantId: string, allowAbsentOwnSeat: boolean): boolean => {
    const current = snapshot.projection;
    if (current === null || value.roomId !== snapshot.roomId || value.configuration.playerCount !== current.configuration.playerCount || value.configuration.startingLife !== current.configuration.startingLife || value.hostParticipantId !== current.hostParticipantId) return false;
    const currentOwnSeat = current.seats.find((seat) => seat.participantId === participantId);
    const nextOwnSeat = value.seats.find((seat) => seat.participantId === participantId);
    if (currentOwnSeat === undefined || currentOwnSeat.seatIndex !== snapshot.ownSeatIndex || snapshot.isHost !== (current.hostParticipantId === participantId)) return false;
    if (nextOwnSeat === undefined) return allowAbsentOwnSeat;
    return nextOwnSeat.seatIndex === currentOwnSeat.seatIndex && snapshot.isHost === (value.hostParticipantId === participantId);
  };
  const simple = async (kind: string, schemaVersion: number, extra: Record<string, unknown> = {}, authority: 'player' | 'host' = 'player'): Promise<void> => {
    const activeSecrets = secrets;
    if (activeSecrets === null || snapshot.roomId === null || snapshot.busy !== null) return;
    const action = kind.includes('deck') ? 'デッキを再確認' : kind.includes('ready') ? '準備状態を更新' : kind.includes('start') ? '対戦開始を再試行' : kind.includes('rotate') ? '招待を再発行' : kind.includes('close') ? '参加受付を締める' : kind.includes('kick') ? 'もう一度外す' : 'もう一度退出';
    publish({ busy: kind.includes('deck') ? 'deck' : kind.includes('ready') ? 'ready' : kind.includes('start') ? 'start' : kind.includes('rotate') ? 'rotate' : kind.includes('close') ? 'close' : kind.includes('kick') ? 'kick' : kind.includes('leave') ? 'leave' : 'refresh', ownerIssue: kind.includes('deck') ? null : snapshot.ownerIssue });
    try {
      const base = authority === 'host'
        ? { kind, schemaVersion, hostParticipantId: activeSecrets.participantId, seatCapability: activeSecrets.seatCapability }
        : { kind, schemaVersion, participantId: activeSecrets.participantId, seatCapability: activeSecrets.seatCapability };
      const forbidden = [activeSecrets.seatCapability, activeSecrets.tableCapability, ...snapshot.invites.flatMap((invite) => { const parsed = parseOnlineSharedInviteCodeV3(invite); return parsed === null ? [] : [parsed.admissionCapability]; })];
      const { value } = await request(`/api/online/rooms/${encodeURIComponent(snapshot.roomId)}/lobby`, { ...base, ...extra }, forbidden);
      const responseRecord = value as Record<string, unknown> | null;
      const expectedKind = kind.includes('rotate') ? 'online-forming-lobby-admission-rotated-v3' : kind.includes('close') ? 'online-forming-lobby-admission-closed-v3' : kind.includes('kick') ? 'online-forming-lobby-kicked-v3' : kind.includes('leave') ? 'online-forming-lobby-left-v3' : kind.includes('deck') ? 'online-forming-lobby-deck-result-v2' : kind;
      const expectedFields = kind.includes('rotate') ? ['kind', 'schemaVersion', 'roomId', 'inviteCode', 'projection'] : kind.includes('close') || kind.includes('kick') ? ['kind', 'schemaVersion', 'roomId', 'projection'] : kind.includes('leave') ? ['kind', 'schemaVersion', 'roomId', 'projection'] : kind.includes('ready') ? ['kind', 'schemaVersion', 'roomId', 'projection'] : kind.includes('deck') ? ['kind', 'schemaVersion', 'roomId', 'submissionId', 'state', 'issues', 'projection'] : ['kind', 'schemaVersion', 'roomId', 'playerCount', 'startingLife', 'revision', 'roomLifecycle'];
      if (!kind.includes('start') && !kind.includes('leave') && (!exact(value, expectedFields) || typeof responseRecord?.kind !== 'string' || responseRecord.kind !== expectedKind || responseRecord.schemaVersion !== schemaVersion || responseRecord.roomId !== snapshot.roomId)) throw new Error('オンライン操作の応答を検証できませんでした。');
      if (kind.includes('leave') && !((exact(value, expectedFields) || exact(value, ['kind', 'schemaVersion', 'roomId', 'closed'])) && typeof responseRecord?.kind === 'string' && responseRecord.kind === expectedKind && responseRecord.schemaVersion === schemaVersion && responseRecord.roomId === snapshot.roomId)) throw new Error('オンライン操作の応答を検証できませんでした。');
      const projectionValue = (value as Record<string, unknown> | null)?.projection;
      const checked = validatePublicOnlineProjectionV3(projectionValue);
      if (checked.ok) {
        if (!preservesLobbyAuthority(checked.value, activeSecrets.participantId, kind.includes('leave'))) throw new Error('オンライン操作のロビー関係を検証できませんでした。');
        if (kind === 'online-forming-lobby-ready-v4' && (!exact(value, ['kind', 'schemaVersion', 'roomId', 'projection']) || own(value, 'kind') !== kind || own(value, 'schemaVersion') !== schemaVersion || own(value, 'roomId') !== snapshot.roomId)) throw new Error('オンライン操作の応答を検証できませんでした。');
        if (kind === 'online-forming-lobby-deck-submit-v2') {
          if (!exact(value, ['kind', 'schemaVersion', 'roomId', 'submissionId', 'state', 'issues', 'projection']) || own(value, 'kind') !== expectedKind || own(value, 'schemaVersion') !== schemaVersion || own(value, 'roomId') !== snapshot.roomId) throw new Error('オンライン操作のデッキ結果を検証できませんでした。');
          const state = own(value, 'state'); const issues = own(value, 'issues');
          if (!['none', 'resolving', 'accepted', 'needs-attention'].includes(String(state)) || !Array.isArray(issues) || (state === 'accepted' && issues.length !== 0) || own(value, 'submissionId') !== extra.submissionId) throw new Error('オンライン操作のデッキ結果を検証できませんでした。');
          const parsedIssues = parseDeckIssues(issues, Array.isArray(extra.entries) ? extra.entries.length : 0);
          if (parsedIssues === null || (state === 'needs-attention' && parsedIssues.length === 0)) throw new Error('オンライン操作のデッキ結果を検証できませんでした。');
          const ownSeat = checked.value.seats.find((seat) => seat.participantId === activeSecrets.participantId);
          const conflictKeepsAcceptedDeck = state === 'needs-attention' && ownSeat?.acceptedDeck === true && parsedIssues.length === 1 && parsedIssues[0]?.code === 'SUBMISSION_CONFLICT';
          if (checked.value.lifecycle === 'started' || ownSeat === undefined || (state === 'accepted' && !ownSeat.acceptedDeck) || (state !== 'accepted' && !conflictKeepsAcceptedDeck && ownSeat.acceptedDeck)) throw new Error('オンライン操作のデッキ状態を検証できませんでした。');
          const firstIssue = parsedIssues[0];
          publish({ ownerIssue: firstIssue === undefined ? null : Object.freeze({ code: firstIssue.code, entryIndex: firstIssue.entryIndex, retryable: firstIssue.retryable, message: deckIssueText(firstIssue.code) }) });
          retryOperation = firstIssue?.retryable === true ? () => simple(kind, schemaVersion, extra, authority) : null;
        }
        const invite = (value as Record<string, unknown> | null)?.inviteCode;
        if (kind.includes('rotate') && (typeof invite !== 'string' || parseOnlineSharedInviteCodeV3(invite) === null || parseOnlineSharedInviteCodeV3(invite)?.roomId !== snapshot.roomId)) throw new Error('オンライン操作の招待を検証できませんでした。');
        const admissionOpen = kind.includes('close') ? false : kind.includes('rotate') ? true : snapshot.admissionOpen;
        if (kind.includes('leave')) {
          clearRecoveryRecords();
          disconnect();
        } else {
          applyLobby(checked.value, activeSecrets.participantId, snapshot.isHost, typeof invite === 'string' ? [invite] : kind.includes('close') ? [] : snapshot.invites, admissionOpen);
        }
      } else if (kind.includes('leave') && exact(value, ['kind', 'schemaVersion', 'roomId', 'closed']) && own(value, 'kind') === 'online-forming-lobby-left-v3' && own(value, 'schemaVersion') === 3 && own(value, 'roomId') === snapshot.roomId && own(value, 'closed') === true) {
        clearRecoveryRecords();
        disconnect();
      } else if (kind === 'online-forming-lobby-start-v4' && (exact(value, ['kind', 'schemaVersion', 'roomId', 'playerCount', 'startingLife', 'revision', 'roomLifecycle']) || exact(value, ['kind', 'schemaVersion', 'roomId', 'playerCount', 'startingLife', 'revision', 'roomLifecycle', 'pregame'])) && own(value, 'kind') === 'online-cloudflare-room-status-v2' && own(value, 'schemaVersion') === 2 && own(value, 'roomId') === snapshot.roomId && own(value, 'playerCount') === snapshot.configuration?.playerCount && own(value, 'startingLife') === snapshot.configuration?.startingLife && own(value, 'revision') === 0 && own(value, 'roomLifecycle') === 'active' && snapshot.projection !== null) {
        const started = Object.freeze({ ...snapshot.projection, lifecycle: 'started' as const });
        const rawPregame = own(value, 'pregame');
        const checkedPregame = rawPregame === undefined ? null : validateOnlinePregameProjectionV1(rawPregame);
        if (checkedPregame !== null && (!checkedPregame.ok || checkedPregame.value.protocol.roomId !== snapshot.roomId || checkedPregame.value.protocol.participantId !== activeSecrets.participantId || checkedPregame.value.protocol.configuration.startingLife !== 40)) throw new Error('対戦準備の応答を検証できませんでした。');
        if (snapshot.configuration?.startingLife === 40 && checkedPregame === null) throw new Error('対戦準備の応答を検証できませんでした。');
        applyLobby(started, activeSecrets.participantId, snapshot.isHost, snapshot.invites, snapshot.admissionOpen, checkedPregame?.ok === true ? checkedPregame.value : null);
      } else throw new Error('オンライン操作の応答を検証できませんでした。');
    } catch (error: unknown) {
      const issue = clientIssue(error, action);
      if (kind.includes('leave') && ['CREDENTIAL_KICKED', 'CREDENTIAL_REJECTED', 'ROOM_NOT_FOUND', 'ROOM_EXPIRED'].includes(issue.code)) {
        clearRecoveryRecords();
      }
      if (issue.retryable) retryOperation = () => simple(kind, schemaVersion, extra, authority);
      publish({ error: issue.message, errorIssue: issue });
    }
    finally { publish({ busy: null }); }
  };
  const submitDeck = async (deck: PublicOnlineDeckOptionV2): Promise<void> => { await simple('online-forming-lobby-deck-submit-v2', 2, { deckId: deck.id, submissionId: generatedId('submission'), entries: deck.entries.map((entry) => ({ section: entry.section, quantity: entry.quantity, scryfallId: entry.card.scryfallId, oracleId: entry.card.oracleId })) }); };
  const toggleReady = async (): Promise<void> => { const ownSeat = snapshot.projection?.seats[snapshot.ownSeatIndex ?? 0]; await simple('online-forming-lobby-ready-v4', 4, { ready: !(ownSeat?.ready ?? false) }); };
  const start = async (): Promise<void> => { await simple('online-forming-lobby-start-v4', 4, {}, 'host'); };
  const rotateInvite = async (): Promise<void> => { await simple('online-forming-lobby-admission-rotate-v3', 3, {}, 'host'); };
  const closeAdmission = async (): Promise<void> => { await simple('online-forming-lobby-admission-close-v3', 3, {}, 'host'); };
  const kick = async (targetParticipantId: string): Promise<void> => { await simple('online-forming-lobby-kick-v3', 3, { targetParticipantId }, 'host'); };
  const leave = async (): Promise<void> => { await simple('online-forming-lobby-leave-v3', 3); };
  const submitPregame = async (command: OnlinePregameCommandV1, commandId = generatedId('pregame-command')): Promise<void> => {
    const activeSecrets = secrets;
    const current = snapshot.pregame;
    if (activeSecrets === null || snapshot.roomId === null || current === null || current.phase === 'complete' || snapshot.busy !== null) return;
    retryOperation = null;
    const body = { kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId: snapshot.roomId, participantId: activeSecrets.participantId, ['participantCapability']: activeSecrets.seatCapability, commandId, baseRevision: current.revision, command };
    publish({ busy: 'pregame', error: null, errorIssue: null });
    try {
      const { value } = await request(`/api/online/rooms/${encodeURIComponent(snapshot.roomId)}/pregame`, body, [activeSecrets.seatCapability, activeSecrets.tableCapability]);
      if (!exact(value, ['response', 'projection'])) throw new Error('対戦準備の応答を検証できませんでした。');
      const rawResponse = own(value, 'response');
      const rawProjection = own(value, 'projection');
      const checkedProjection = validateOnlinePregameProjectionV1(rawProjection);
      if (!checkedProjection.ok || checkedProjection.value.protocol.roomId !== snapshot.roomId || checkedProjection.value.protocol.participantId !== activeSecrets.participantId || checkedProjection.value.protocol.configuration.startingLife !== 40) throw new Error('対戦準備の状態を検証できませんでした。');
      let response: OnlinePregameCommandResponseV1;
      if (exact(rawResponse, ['kind', 'schemaVersion', 'commandId', 'acceptedRevision', 'currentRevision', 'duplicate']) && own(rawResponse, 'kind') === 'online-pregame-command-ack-v1' && own(rawResponse, 'schemaVersion') === 1 && own(rawResponse, 'commandId') === commandId && typeof own(rawResponse, 'acceptedRevision') === 'number' && typeof own(rawResponse, 'currentRevision') === 'number' && typeof own(rawResponse, 'duplicate') === 'boolean') {
        response = rawResponse as OnlinePregameCommandResponseV1;
      } else if (exact(rawResponse, ['kind', 'schemaVersion', 'commandId', 'currentRevision', 'resyncRequired', 'issues']) && own(rawResponse, 'kind') === 'online-pregame-command-reject-v1' && own(rawResponse, 'schemaVersion') === 1 && (own(rawResponse, 'commandId') === commandId || own(rawResponse, 'commandId') === null) && typeof own(rawResponse, 'currentRevision') === 'number' && typeof own(rawResponse, 'resyncRequired') === 'boolean' && Array.isArray(own(rawResponse, 'issues'))) {
        response = rawResponse as OnlinePregameCommandResponseV1;
      } else throw new Error('対戦準備の結果を検証できませんでした。');
      retryOperation = null;
      publish({ pregame: checkedProjection.value, connection: 'online' });
      if (response.kind === 'online-pregame-command-reject-v1') {
        const code = response.issues[0]?.code;
        const message = code === 'STALE_REVISION' ? '対戦準備が更新されました。表示を確認してもう一度操作してください。' : code === 'ACTOR_MISMATCH' ? '現在は別のプレイヤーの操作を待っています。' : code === 'INVALID_BOTTOM' || code === 'INVALID_CHOICE' ? '選択数または選択内容を確認してください。' : '現在の対戦準備ではこの操作を実行できません。';
        publish({ error: message });
      } else if (checkedProjection.value.phase === 'complete') startBrowsers();
    } catch (error: unknown) {
      const issue = clientIssue(error, '対戦準備を再試行');
      if (issue.retryable) retryOperation = () => submitPregame(command, commandId);
      publish({ error: issue.message, errorIssue: issue, connection: issue.retryable ? 'reconnecting' : snapshot.connection });
    } finally { publish({ busy: null }); }
  };
  const retry = async (): Promise<void> => { if (retryOperation !== null) await retryOperation(); else await refresh(); };
  const submitAction = (action: unknown, guided: boolean): void => {
    const client = playerClient;
    if (client === null || secrets === null || snapshot.roomId === null) return;
    const personal = client.getSnapshot().projection;
    if (personal === null || personal.corePlayerId === null) return;
    const session: OnlineDisplayPairingSessionV1 = {
      protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
      roomId: snapshot.roomId,
      participantId: secrets.participantId,
      participantCapability: secrets.seatCapability as never,
      clientBuildId: 'o4p-09f-client',
      corePlayerId: personal.corePlayerId,
      personalProjection: personal,
    };
    try {
      const commandId = generatedId('command') as never;
      const frame = guided
        ? bindOnlineGuidedCommandActionV1({ session, action, commandId })
        : bindPersonalWorkbenchActionV1({ session, action, commandId });
      if (frame.kind === 'online-command-envelope-v1') client.submit({ commandId: frame.commandId, baseRevision: frame.baseRevision, command: frame.command });
    } catch {
      publish({ error: '操作を送信できませんでした。' });
    }
  };
  const submitTabletopIntent = async (input: OnlineTabletopIntentEnvelopeV1): Promise<void> => {
    const activeSecrets = secrets;
    const client = playerClient;
    if (activeSecrets === null || client === null || snapshot.roomId === null || snapshot.busy !== null || snapshot.lifecycle !== 'started') return;
    const checked = validateOnlineTabletopIntentEnvelopeV1(input);
    if (!checked.ok) { publish({ error: '操作内容を確認して再試行してください。' }); return; }
    publish({ busy: 'tabletop', error: null, errorIssue: null });
    try {
      await Promise.resolve();
      const result = client.submitTabletop(checked.value);
      if (!result.ok) publish({ error: '操作を送信できませんでした。表示を確認して再試行してください。' });
    } catch (error: unknown) {
      const issue = clientIssue(error, '操作を再試行');
      if (issue.retryable) retryOperation = () => submitTabletopIntent(checked.value);
      publish({ error: issue.message, errorIssue: issue, connection: issue.retryable ? 'reconnecting' : snapshot.connection });
    } finally {
      publish({ busy: null });
    }
  };
  const submitVisibilityIntent = async (input: OnlineVisibilityIntentEnvelopeV1): Promise<void> => {
    const activeSecrets = secrets;
    const client = playerClient;
    if (activeSecrets === null || client === null || snapshot.roomId === null || snapshot.busy !== null || snapshot.lifecycle !== 'started') return;
    const checked = validateOnlineVisibilityIntentV1(input);
    if (!checked.ok) { publish({ error: '操作内容を確認して再試行してください。' }); return; }
    retryOperation = null;
    publish({ busy: 'visibility', error: null, errorIssue: null });
    try {
      await Promise.resolve();
      const result = client.submitVisibility(checked.value);
      if (!result.ok) {
        const issue = visibilitySubmitIssue(result.code);
        publish({ error: issue.message, errorIssue: issue });
      }
    } catch (error: unknown) {
      const issue = clientIssue(error, '操作を再試行');
      if (issue.retryable) retryOperation = () => submitVisibilityIntent(checked.value);
      publish({ error: issue.message, errorIssue: issue, connection: issue.retryable ? 'reconnecting' : snapshot.connection });
    } finally { publish({ busy: null }); }
  };
  const disconnect = (): void => { if (pollTimer !== null) clearTimeout(pollTimer); pollTimer = null; playerUnsubscribe?.(); tableUnsubscribe?.(); playerUnsubscribe = null; tableUnsubscribe = null; playerClient?.disconnect(); tableClient?.disconnect(); playerClient = null; tableClient = null; secrets = null; publish({ mode: 'entry', roomId: null, participantId: null, isHost: false, ownSeatIndex: null, lifecycle: null, configuration: null, projection: null, invites: [], busy: null, connection: 'lobby', error: null, errorIssue: null, ownerIssue: null, admissionOpen: null, player: null, table: null, pregame: null }); };
  return Object.freeze({ getSnapshot: () => snapshot, subscribe: (listener: (value: PublicOnlineSnapshotV3) => void) => { listeners.add(listener); listener(snapshot); return () => listeners.delete(listener); }, createShared, joinShared, recover, refresh, submitDeck, toggleReady, start, rotateInvite, closeAdmission, kick, leave, retry, submitPregame, submitTabletopIntent, submitVisibilityIntent, displayDeckName: (name: string, index: number) => {
    const fallback = `保存済みデッキ ${index + 1}`;
    try {
      if (!Number.isSafeInteger(index) || index < 0 || typeof name !== 'string' ||
          new TextEncoder().encode(name).length > 120 || BEARER_TEXT.test(name) ||
          (secrets !== null && secretFragment(name, [secrets.seatCapability, secrets.tableCapability]))) return fallback;
      return name;
    } catch { return fallback; }
  }, copyInvite: async (invite: string) => { try { if (!navigator.clipboard) return false; await navigator.clipboard.writeText(invite); return true; } catch { return false; } }, submitPersonalAction: (action: unknown) => submitAction(action, false), submitGuidedAction: (action: unknown) => submitAction(action, true), disconnect });
}
