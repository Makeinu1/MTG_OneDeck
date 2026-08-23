import {
  encodeOnlineSharedInviteCodeV3,
  parseOnlineSharedInviteCodeV3,
} from '../lobby/index';
import { isOnlineRoomApplicationIdV1, isOnlineRoomSeatCapabilityV1 } from '../room/validationSupport';
import { PUBLIC_ONLINE_ERROR_V1 } from './types';

export const PUBLIC_ONLINE_RECOVERY_STORAGE_KEY_V1 = 'mtg-onedeck:online-recovery-v1' as const;

export type PublicOnlineRecoveryRecordV1 = Readonly<{
  readonly kind: 'public-online-recovery-v1';
  readonly schemaVersion: 1;
  readonly roomId: string;
  readonly participantId: string;
  readonly seatCapability: string;
  readonly isHost: boolean;
  readonly tableParticipantId: string | null;
  readonly tableCapability: string | null;
}>;

export type PublicOnlineStorageV1 = Readonly<{
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
}>;

function plain(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try { const prototype = Reflect.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; } catch { return false; }
}
function own(value: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined ? descriptor.value : undefined;
  } catch { return undefined; }
}
function exact(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (!plain(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch { return false; }
}
function validRecord(value: unknown): value is PublicOnlineRecoveryRecordV1 {
  if (!exact(value, ['kind', 'schemaVersion', 'roomId', 'participantId', 'seatCapability', 'isHost', 'tableParticipantId', 'tableCapability'])) return false;
  const record = value;
  const roomId = own(record, 'roomId'); const participantId = own(record, 'participantId'); const seatCapability = own(record, 'seatCapability'); const isHost = own(record, 'isHost'); const tableParticipantId = own(record, 'tableParticipantId'); const tableCapability = own(record, 'tableCapability');
  if (own(record, 'kind') !== 'public-online-recovery-v1' || own(record, 'schemaVersion') !== 1 || typeof roomId !== 'string' || !isOnlineRoomApplicationIdV1(roomId) || typeof participantId !== 'string' || !isOnlineRoomApplicationIdV1(participantId) || typeof seatCapability !== 'string' || !isOnlineRoomSeatCapabilityV1(seatCapability) || typeof isHost !== 'boolean') return false;
  if (tableParticipantId !== null && (typeof tableParticipantId !== 'string' || !isOnlineRoomApplicationIdV1(tableParticipantId))) return false;
  if (tableCapability !== null && (typeof tableCapability !== 'string' || !isOnlineRoomSeatCapabilityV1(tableCapability))) return false;
  if ((tableParticipantId === null) !== (tableCapability === null)) return false;
  if (!isHost && (tableParticipantId !== null || tableCapability !== null)) return false;
  return true;
}

export function createPublicOnlineRecoveryStoreV1(storage: PublicOnlineStorageV1 | null | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): Readonly<{
  readonly load: () => PublicOnlineRecoveryRecordV1 | null;
  readonly save: (value: PublicOnlineRecoveryRecordV1) => boolean;
  readonly clear: () => void;
}> {
  const load = (): PublicOnlineRecoveryRecordV1 | null => {
    if (storage === null || storage === undefined) return null;
    try {
      const serialized = storage.getItem(PUBLIC_ONLINE_RECOVERY_STORAGE_KEY_V1);
      if (serialized === null) return null;
      if (new TextEncoder().encode(serialized).length > 4_096) { try { storage.removeItem(PUBLIC_ONLINE_RECOVERY_STORAGE_KEY_V1); } catch { /* unavailable storage */ } return null; }
      const parsed = JSON.parse(serialized) as unknown;
      if (!validRecord(parsed) || JSON.stringify(parsed) !== serialized) { try { storage.removeItem(PUBLIC_ONLINE_RECOVERY_STORAGE_KEY_V1); } catch { /* unavailable storage */ } return null; }
      return Object.freeze({ ...parsed });
    } catch { try { storage.removeItem(PUBLIC_ONLINE_RECOVERY_STORAGE_KEY_V1); } catch { /* unavailable storage */ } return null; }
  };
  const save = (value: PublicOnlineRecoveryRecordV1): boolean => {
    if (storage === null || storage === undefined || !validRecord(value)) return false;
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined || new TextEncoder().encode(serialized).length > 4_096) return false;
      storage.setItem(PUBLIC_ONLINE_RECOVERY_STORAGE_KEY_V1, serialized);
      return true;
    } catch { return false; }
  };
  const clear = (): void => { try { storage?.removeItem(PUBLIC_ONLINE_RECOVERY_STORAGE_KEY_V1); } catch { /* unavailable storage */ } };
  return Object.freeze({ load, save, clear });
}

export function readAndScrubPublicOnlineInviteFragmentV3(
  location: Readonly<{ readonly href: string; readonly hash: string }>,
  history: Readonly<{ readonly state: unknown; readonly replaceState: (state: unknown, title: string, url: string) => void }>,
): Readonly<{ readonly roomId: string; readonly admissionCapability: string }> | null {
  if (typeof location.href !== 'string' || typeof location.hash !== 'string') return null;
  const prefix = '#online-invite=';
  if (!location.hash.startsWith(prefix)) return null;
  const encoded = location.hash.slice(prefix.length);
  let code: string;
  try { code = decodeURIComponent(encoded); } catch { code = ''; }
  let scrubbedUrl = location.href.split('#', 1)[0] ?? '';
  try { const parsed = new URL(scrubbedUrl); scrubbedUrl = `${parsed.pathname}${parsed.search}` || '/'; } catch { if (scrubbedUrl === '') scrubbedUrl = '/'; }
  try { history.replaceState(history.state, '', scrubbedUrl); } catch { return null; }
  return parseOnlineSharedInviteCodeV3(code);
}

const ERROR_CODES = ['ROOM_NOT_FOUND', 'ROOM_EXPIRED', 'INVITE_INVALID', 'INVITE_ROTATED', 'ADMISSION_CLOSED', 'ROOM_FULL', 'PARTICIPANT_RECOVERABLE', 'CREDENTIAL_REJECTED', 'CREDENTIAL_KICKED', 'HOST_REQUIRED', 'INVALID_LIFECYCLE', 'DECK_REQUIRED', 'DECK_RESOLVING', 'DECK_NEEDS_ATTENTION', 'PLAYERS_NOT_READY', 'CLIENT_UPGRADE_REQUIRED', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE'] as const;
export type PublicOnlineErrorCodeV3 = typeof ERROR_CODES[number];
export type PublicOnlineErrorV3 = Readonly<{ readonly kind: 'online-public-error-v3'; readonly schemaVersion: 3; readonly code: PublicOnlineErrorCodeV3; readonly retryable: boolean; readonly correlationId: string }>;
export type PublicOnlineErrorMessageV3 = Readonly<{ readonly code: PublicOnlineErrorCodeV3; readonly retryable: boolean; readonly message: string; readonly correlationId: string }>;
const RETRYABLE: Readonly<Record<PublicOnlineErrorCodeV3, boolean>> = Object.freeze({ ROOM_NOT_FOUND: false, ROOM_EXPIRED: false, INVITE_INVALID: false, INVITE_ROTATED: false, ADMISSION_CLOSED: false, ROOM_FULL: false, PARTICIPANT_RECOVERABLE: true, CREDENTIAL_REJECTED: false, CREDENTIAL_KICKED: false, HOST_REQUIRED: false, INVALID_LIFECYCLE: false, DECK_REQUIRED: false, DECK_RESOLVING: true, DECK_NEEDS_ATTENTION: false, PLAYERS_NOT_READY: true, CLIENT_UPGRADE_REQUIRED: false, RATE_LIMITED: true, SERVICE_UNAVAILABLE: true });
const MESSAGES: Readonly<Record<PublicOnlineErrorCodeV3, string>> = Object.freeze({ ROOM_NOT_FOUND: '部屋が見つかりません。招待を確認してください。', ROOM_EXPIRED: '部屋の有効期限が切れています。新しい招待を受け取ってください。', INVITE_INVALID: '招待が正しくありません。招待を確認してください。', INVITE_ROTATED: '招待が更新されています。ホストから新しい招待を受け取ってください。', ADMISSION_CLOSED: 'このロビーへの参加受付は終了しています。', ROOM_FULL: '部屋は満席です。空席ができてから参加してください。', PARTICIPANT_RECOVERABLE: 'このブラウザには復帰できる参加情報があります。「対戦に戻る」を選んでください。', CREDENTIAL_REJECTED: '参加情報を確認できませんでした。現在の招待で再参加してください。', CREDENTIAL_KICKED: 'ホストによりロビーから退出しました。再参加するには現在の招待が必要です。', HOST_REQUIRED: 'この操作はホストだけが行えます。', INVALID_LIFECYCLE: '現在のロビー状態ではこの操作を実行できません。', DECK_REQUIRED: 'デッキを選択してください。', DECK_RESOLVING: 'デッキを確認しています。しばらく待ってください。', DECK_NEEDS_ATTENTION: 'デッキを確認できませんでした。内容を修正してください。', PLAYERS_NOT_READY: '準備が完了していない参加者がいます。ロビーの状態を確認してください。', CLIENT_UPGRADE_REQUIRED: 'ページを更新して最新版を読み込んでください。', RATE_LIMITED: '操作が多すぎます。少し待って再試行してください。', SERVICE_UNAVAILABLE: 'サーバーに接続できません。しばらく待って再試行してください。' });

export function parsePublicOnlineErrorV3(value: unknown): PublicOnlineErrorV3 | null {
  if (!exact(value, ['kind', 'schemaVersion', 'code', 'retryable', 'correlationId'])) return null;
  const record = value; const code = own(record, 'code'); const retryable = own(record, 'retryable'); const correlationId = own(record, 'correlationId');
  if (own(record, 'kind') !== 'online-public-error-v3' || own(record, 'schemaVersion') !== 3 || typeof code !== 'string' || !ERROR_CODES.includes(code as PublicOnlineErrorCodeV3) || typeof retryable !== 'boolean' || retryable !== RETRYABLE[code as PublicOnlineErrorCodeV3] || typeof correlationId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(correlationId) || /(?:seat|invite|admission|observer)_[A-Za-z0-9_-]{8}/.test(correlationId)) return null;
  return Object.freeze({ kind: 'online-public-error-v3', schemaVersion: 3, code: code as PublicOnlineErrorCodeV3, retryable, correlationId });
}

export function publicOnlineErrorMessageV3(value: PublicOnlineErrorV3): PublicOnlineErrorMessageV3 {
  return Object.freeze({ code: value.code, retryable: value.retryable, message: MESSAGES[value.code] ?? PUBLIC_ONLINE_ERROR_V1, correlationId: value.correlationId });
}

export { encodeOnlineSharedInviteCodeV3 };
