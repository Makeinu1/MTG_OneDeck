import { PUBLIC_ONLINE_ENDPOINT_V1 } from './index';
import { validateBuildId } from '../../versioning/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import {
  createOnlineBrowserWebSocketClientV1,
  type OnlineBrowserStateV1,
  type OnlineBrowserWebSocketClientV1,
} from '../browser/index';
import {
  bindPersonalWorkbenchActionV1,
  type OnlineDisplayPairingSessionV1,
} from '../displayPairing/index';
import { bindOnlineGuidedCommandActionV1 } from '../guidedActions/index';
import { validatePublicOnlineProjectionV1 } from './client';
import { parseOnlineSharedInviteCodeV3 } from '../lobby/index';
import {
  isCanonicalScryfallIdV2,
  ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2,
} from '../deckSubmission/index';
import {
  PUBLIC_ONLINE_ERROR_V1,
  type PublicOnlineControllerV2,
  type PublicOnlineDeckOptionV2,
  type PublicOnlineProjectionV2,
  type PublicOnlineSeatV2,
  type PublicOnlineSnapshotV2,
} from './types';
import { createPublicOnlineRecoveryStoreV1, parsePublicOnlineErrorV3, publicOnlineErrorMessageV3, type PublicOnlineRecoveryRecordV1 } from './recoveryV1';

const MAX_RESPONSE_BYTES = 1_048_576;
const APP_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const CAPABILITY = /^[A-Za-z0-9_-]{32,128}$/;

class PublicOnlineRequestErrorV3 extends Error {}

function publicRequestErrorMessage(error: unknown): string {
  return error instanceof PublicOnlineRequestErrorV3 ? error.message : PUBLIC_ONLINE_ERROR_V1;
}
type RecordValue = Record<string, unknown>;
type Secrets = Readonly<{
  readonly participantId: string;
  readonly seatCapability: string;
  readonly invites: readonly string[];
  readonly tableParticipantId: string;
  readonly tableCapability: string;
}>;

function plain(value: unknown): value is RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}
function own(value: RecordValue, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined &&
      descriptor.enumerable === true &&
      'value' in descriptor &&
      descriptor.get === undefined &&
      descriptor.set === undefined
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}
function exact(value: unknown, fields: readonly string[]): value is RecordValue {
  if (!plain(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return (
      keys.length === fields.length &&
      keys.every(
        (key) =>
          typeof key === 'string' &&
          fields.includes(key) &&
          Object.prototype.propertyIsEnumerable.call(value, key),
      )
    );
  } catch {
    return false;
  }
}
function dense(value: unknown, length: number): readonly unknown[] | null {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length !== length
  )
    return null;
  const copied: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return null;
    copied.push(value[index]);
  }
  return Object.freeze(copied);
}
function boundedDense(value: unknown, maxLength: number): readonly unknown[] | null {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    !Number.isSafeInteger(value.length) ||
    value.length < 0 ||
    value.length > maxLength
  )
    return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || !keys.includes('length')) return null;
  const copied: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    if (!keys.includes(key)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !('value' in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    )
      return null;
    copied.push((descriptor as PropertyDescriptor & { readonly value: unknown }).value);
  }
  return Object.freeze(copied);
}
const ISSUE_CODES = new Set([
  'EMPTY_LIST',
  'INVALID_SECTION',
  'INVALID_QUANTITY',
  'INVALID_CARD_ID',
  'CARD_NOT_FOUND',
  'IDENTITY_MISMATCH',
  'SCRYFALL_UNAVAILABLE',
  'SUBMISSION_CONFLICT',
  'STALE_RESOLUTION',
  'SNAPSHOT_TOO_LARGE',
]);
function parseIssues(
  value: unknown,
  entryCount: number,
):
  | readonly {
      readonly code: string;
      readonly entryIndex: number | null;
      readonly retryable: boolean;
    }[]
  | null {
  const values = boundedDense(value, 128);
  if (values === null) return null;
  const parsed: { code: string; entryIndex: number | null; retryable: boolean }[] = [];
  for (const item of values) {
    if (!exact(item, ['code', 'entryIndex', 'retryable'])) return null;
    const code = own(item, 'code');
    const index = own(item, 'entryIndex');
    const retryable = own(item, 'retryable');
    if (
      typeof code !== 'string' ||
      !ISSUE_CODES.has(code) ||
      typeof retryable !== 'boolean' ||
      (index !== null &&
        (typeof index !== 'number' ||
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= entryCount))
    )
      return null;
    parsed.push({ code, entryIndex: index, retryable });
  }
  return Object.freeze(parsed);
}
function safeDeckEntries(
  value: PublicOnlineDeckOptionV2,
  forbidden: readonly string[],
): Readonly<{
  readonly entries: readonly {
      readonly section: 'commander' | 'main';
      readonly quantity: number;
      readonly scryfallId: string;
      readonly oracleId: string;
    }[];
  readonly ownerLabels: readonly string[];
}> | null {
  try {
    if (!exact(value, ['id', 'name', 'entries'])) return null;
    const deckId = own(value, 'id');
    const deckName = own(value, 'name');
    const rawEntriesValue = own(value, 'entries');
    if (
      !appId(deckId) ||
      typeof deckName !== 'string' ||
      new TextEncoder().encode(deckName).length > 256 ||
      secretFragment(deckId, forbidden) ||
      secretFragment(deckName, forbidden) ||
      !Array.isArray(rawEntriesValue) ||
      Object.getPrototypeOf(rawEntriesValue) !== Array.prototype ||
      !Number.isSafeInteger(rawEntriesValue.length) ||
      rawEntriesValue.length === 0 ||
      rawEntriesValue.length > 4_096
    )
      return null;
    const rawEntries = rawEntriesValue as unknown[];
    const arrayKeys = Reflect.ownKeys(rawEntries);
    if (arrayKeys.length !== rawEntries.length + 1 || !arrayKeys.includes('length')) return null;
    const result: {
      section: 'commander' | 'main';
      quantity: number;
      scryfallId: string;
      oracleId: string;
    }[] = [];
    const ownerLabels: string[] = [];
    for (let index = 0; index < rawEntries.length; index += 1) {
      const key = String(index);
      if (!arrayKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(rawEntries, key);
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !('value' in descriptor) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      )
        return null;
      const entry: unknown = (descriptor as PropertyDescriptor & { readonly value: unknown }).value;
      if (!exact(entry, ['card', 'quantity', 'section'])) return null;
      const card = own(entry, 'card');
      const section = own(entry, 'section');
      const quantity = own(entry, 'quantity');
      const scryfallId = plain(card) ? own(card, 'scryfallId') : undefined;
      const oracleId = plain(card) ? own(card, 'oracleId') : undefined;
      const name = plain(card) ? own(card, 'name') : undefined;
      const printedName = plain(card) ? own(card, 'printedName') : undefined;
      const faces = plain(card) ? own(card, 'faces') : undefined;
      const firstFaceDescriptor =
        Array.isArray(faces) && Object.getPrototypeOf(faces) === Array.prototype
          ? Object.getOwnPropertyDescriptor(faces, '0')
          : undefined;
      const firstFaceValue: unknown =
        firstFaceDescriptor !== undefined &&
        'value' in firstFaceDescriptor &&
        firstFaceDescriptor.get === undefined &&
        firstFaceDescriptor.set === undefined
          ? (firstFaceDescriptor as PropertyDescriptor & { readonly value: unknown }).value
          : undefined;
      const facePrintedName = plain(firstFaceValue)
        ? own(firstFaceValue, 'printedName')
        : undefined;
      if (
        !plain(card) ||
        !isCanonicalScryfallIdV2(scryfallId) ||
        !isCanonicalScryfallIdV2(oracleId) ||
        secretFragment(scryfallId, forbidden) ||
        secretFragment(oracleId, forbidden) ||
        typeof name !== 'string' ||
        (printedName !== undefined && typeof printedName !== 'string') ||
        (facePrintedName !== undefined && typeof facePrintedName !== 'string') ||
        [name, printedName, facePrintedName].some(
          (candidate) =>
            typeof candidate === 'string' &&
            (new TextEncoder().encode(candidate).length > 256 ||
              secretFragment(candidate, forbidden)),
        ) ||
        (section !== 'commander' && section !== 'main') ||
        typeof quantity !== 'number' ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      )
        return null;
      result.push({ section, quantity, scryfallId, oracleId });
      ownerLabels.push(
        typeof printedName === 'string'
          ? printedName
          : typeof facePrintedName === 'string'
            ? facePrintedName
            : name,
      );
    }
    const canonical = JSON.stringify({ deckId, entries: result });
    if (
      new TextEncoder().encode(canonical).length >
      ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2
    )
      return null;
    return Object.freeze({
      entries: Object.freeze(result),
      ownerLabels: Object.freeze(ownerLabels),
    });
  } catch {
    return null;
  }
}
function appId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    APP_ID.test(value) &&
    value !== '__proto__' &&
    value !== 'prototype' &&
    value !== 'constructor'
  );
}
function capability(value: unknown): value is string {
  return typeof value === 'string' && CAPABILITY.test(value);
}
function secretFragment(text: string, secrets: readonly string[]): boolean {
  return secrets.some((secret) =>
    [...Array(Math.max(0, secret.length - 7)).keys()].some((offset) =>
      text.includes(secret.slice(offset, offset + 8)),
    ),
  );
}
function pairwiseCapabilityFragment(values: readonly string[]): boolean {
  return values.some((value, index) =>
    values.some(
      (other, otherIndex) =>
        index !== otherIndex && secretFragment(value, Object.freeze([other])),
    ),
  );
}
function id(prefix: string): string {
  const bytes = new Uint8Array(18);
  const cryptoObject = globalThis.crypto;
  if (cryptoObject === undefined || typeof cryptoObject.getRandomValues !== 'function')
    throw new Error(PUBLIC_ONLINE_ERROR_V1);
  cryptoObject.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 38)}`;
}
function issueText(
  code: string,
  index: number | null,
  ownerLabels: readonly string[],
): string {
  const card = index === null ? '' : (ownerLabels[index] ?? '');
  const label = card === '' ? '' : `《${card}》`;
  const map: Record<string, string> = {
    EMPTY_LIST: 'カードリストが空です。',
    INVALID_SECTION: 'セクションを修正してください。',
    INVALID_QUANTITY: `${label} の数量を正の整数に修正してください。`,
    INVALID_CARD_ID: `${label} のカードIDを確認してください。`,
    CARD_NOT_FOUND: `${label} が見つかりません。再解決して再提出してください。`,
    IDENTITY_MISMATCH: `${label} のカード情報が一致しません。再解決してください。`,
    SCRYFALL_UNAVAILABLE: 'カード情報を確認できませんでした。再試行してください。',
    SUBMISSION_CONFLICT: '提出が競合しました。再提出してください。',
    STALE_RESOLUTION: '提出結果が古くなりました。再試行してください。',
    SNAPSHOT_TOO_LARGE: 'デッキが大きすぎます。数量またはカード数を減らしてください。',
  };
  return map[code] ?? 'デッキを確認して再提出してください。';
}
function parseSeat(value: unknown, index: number): PublicOnlineSeatV2 | null {
  if (!exact(value, ['seatIndex', 'corePlayerId', 'participantId', 'deckState', 'ready']))
    return null;
  const state = own(value, 'deckState');
  const participant = own(value, 'participantId');
  const ready = own(value, 'ready');
  if (
    own(value, 'seatIndex') !== index ||
    own(value, 'corePlayerId') !== `P${index + 1}` ||
    (participant !== null && !appId(participant)) ||
    !['none', 'resolving', 'accepted', 'needs-attention'].includes(String(state)) ||
    typeof ready !== 'boolean' ||
    (ready === true && state !== 'accepted')
  )
    return null;
  return Object.freeze({
    seatIndex: index as 0 | 1 | 2 | 3,
    corePlayerId: `P${index + 1}` as 'P1' | 'P2' | 'P3' | 'P4',
    participantId: participant,
    deckState: state as PublicOnlineSeatV2['deckState'],
    ready,
  });
}
export function validatePublicOnlineProjectionV2(
  input: unknown,
):
  | Readonly<{ readonly ok: true; readonly value: PublicOnlineProjectionV2 }>
  | Readonly<{ readonly ok: false }> {
  if (
    !exact(input, [
      'kind',
      'schemaVersion',
      'lifecycle',
      'roomId',
      'serverBuildId',
      'hostParticipantId',
      'seats',
    ]) ||
    own(input, 'kind') !== 'online-forming-lobby-projection-v2' ||
    own(input, 'schemaVersion') !== 2 ||
    !appId(own(input, 'roomId')) ||
    typeof own(input, 'serverBuildId') !== 'string' ||
    !validateBuildId(own(input, 'serverBuildId')).ok ||
    !appId(own(input, 'hostParticipantId')) ||
    !['forming', 'ready', 'started'].includes(String(own(input, 'lifecycle')))
  )
    return { ok: false };
  const raw = dense(own(input, 'seats'), 4);
  if (raw === null) return { ok: false };
  const seats: PublicOnlineSeatV2[] = [];
  const participants = new Set<string>();
  for (let index = 0; index < 4; index += 1) {
    const seat = parseSeat(raw[index], index);
    if (seat === null) return { ok: false };
    if (seat.participantId !== null && participants.has(seat.participantId)) return { ok: false };
    if (seat.participantId !== null) participants.add(seat.participantId);
    seats.push(seat);
  }
  if (seats[0]?.participantId !== own(input, 'hostParticipantId')) return { ok: false };
  const complete = seats.every(
    (seat) => seat.participantId !== null && seat.deckState === 'accepted' && seat.ready,
  );
  const lifecycle = own(input, 'lifecycle') as PublicOnlineProjectionV2['lifecycle'];
  if (
    (lifecycle === 'forming' && complete) ||
    ((lifecycle === 'ready' || lifecycle === 'started') && !complete)
  )
    return { ok: false };
  return {
    ok: true,
    value: Object.freeze({
      kind: 'online-forming-lobby-projection-v2',
      schemaVersion: 2,
      lifecycle,
      roomId: own(input, 'roomId') as string,
      serverBuildId: own(input, 'serverBuildId') as string,
      hostParticipantId: own(input, 'hostParticipantId') as string,
      seats: Object.freeze(seats) as PublicOnlineProjectionV2['seats'],
    }),
  };
}
async function json(response: Response, secrets: readonly string[]): Promise<unknown> {
  if (
    !/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')
  )
    throw new Error(PUBLIC_ONLINE_ERROR_V1);
  const text = await response.text();
  if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES || secretFragment(text, secrets))
    throw new Error(PUBLIC_ONLINE_ERROR_V1);
  const value = JSON.parse(text) as unknown;
  if (!response.ok) {
    const parsed = parsePublicOnlineErrorV3(value);
    if (parsed !== null) throw new PublicOnlineRequestErrorV3(publicOnlineErrorMessageV3(parsed).message);
    throw new Error(PUBLIC_ONLINE_ERROR_V1);
  }
  return value;
}

async function boundedResponseJson(response: Response, secrets: readonly string[]): Promise<unknown> {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) return null;
  let text: string;
  try { text = await response.text(); } catch { return null; }
  if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES || secretFragment(text, secrets)) return null;
  try { return JSON.parse(text) as unknown; } catch { return null; }
}
function secretList(value: Secrets | null): readonly string[] {
  return value === null ? [] : [value.seatCapability, ...value.invites, value.tableCapability];
}
function created(
  value: unknown,
  participantId: string,
): Readonly<{ readonly roomId: string; readonly secrets: Secrets }> | null {
  if (
    !exact(value, [
      'kind',
      'schemaVersion',
      'roomId',
      'seatCapability',
      'inviteCapabilities',
      'tableParticipantId',
      'tableCapability',
      'projection',
    ]) ||
    own(value, 'kind') !== 'online-forming-lobby-created-v1' ||
    own(value, 'schemaVersion') !== 1 ||
    !appId(own(value, 'roomId')) ||
    !capability(own(value, 'seatCapability')) ||
    !appId(own(value, 'tableParticipantId')) ||
    !capability(own(value, 'tableCapability'))
  )
    return null;
  const invites = dense(own(value, 'inviteCapabilities'), 3);
  if (invites === null || !invites.every(capability)) return null;
  const roomId = own(value, 'roomId') as string;
  const seatCapability = own(value, 'seatCapability') as string;
  const tableParticipantId = own(value, 'tableParticipantId') as string;
  const tableCapability = own(value, 'tableCapability') as string;
  const allCapabilities = Object.freeze([
    seatCapability,
    ...invites,
    tableCapability,
  ]);
  const checkedProjection = validatePublicOnlineProjectionV1(own(value, 'projection'));
  if (
    new Set(allCapabilities).size !== allCapabilities.length ||
    pairwiseCapabilityFragment(allCapabilities) ||
    secretFragment(roomId, allCapabilities) ||
    secretFragment(tableParticipantId, allCapabilities) ||
    !checkedProjection.ok ||
    checkedProjection.value.roomId !== roomId ||
    checkedProjection.value.lifecycle !== 'forming' ||
    checkedProjection.value.hostParticipantId !== participantId ||
    secretFragment(JSON.stringify(checkedProjection.value), allCapabilities)
  )
    return null;
  return Object.freeze({
    roomId,
    secrets: Object.freeze({
      participantId,
      seatCapability,
      invites: Object.freeze([...invites]),
      tableParticipantId,
      tableCapability,
    }),
  });
}
function claimed(
  value: unknown,
  roomId: string,
  participantId: string,
  inviteCapability: string,
): string | null {
  if (
    !exact(value, ['kind', 'schemaVersion', 'roomId', 'seatCapability', 'projection']) ||
    own(value, 'kind') !== 'online-forming-lobby-seat-claimed-v1' ||
    own(value, 'schemaVersion') !== 1 ||
    own(value, 'roomId') !== roomId ||
    !capability(own(value, 'seatCapability'))
  )
    return null;
  const seatCapability = own(value, 'seatCapability') as string;
  const allCapabilities = Object.freeze([seatCapability, inviteCapability]);
  const checkedProjection = validatePublicOnlineProjectionV1(own(value, 'projection'));
  if (!checkedProjection.ok) return null;
  const projectionSeats = checkedProjection.value.seats;
  if (!Array.isArray(projectionSeats)) return null;
  const matchingSeats = projectionSeats.filter(
    (seat: unknown) => plain(seat) && own(seat, 'participantId') === participantId,
  );
  if (
    new Set(allCapabilities).size !== allCapabilities.length ||
    pairwiseCapabilityFragment(allCapabilities) ||
    checkedProjection.value.roomId !== roomId ||
    matchingSeats.length !== 1 ||
    secretFragment(JSON.stringify(checkedProjection.value), allCapabilities)
  )
    return null;
  return seatCapability;
}
function parseStartResult(value: unknown, roomId: string): 'started' | 'needs-attention' | null {
  if (
    !exact(value, ['kind', 'schemaVersion', 'roomId', 'outcome', 'issue', 'status']) ||
    own(value, 'kind') !== 'online-forming-lobby-start-result-v2' ||
    own(value, 'schemaVersion') !== 2 ||
    own(value, 'roomId') !== roomId
  )
    return null;
  const outcome = own(value, 'outcome');
  const issue = own(value, 'issue');
  const status = own(value, 'status');
  if (outcome === 'needs-attention')
    return issue === 'ROOM_GENESIS_TOO_LARGE' && status === null ? 'needs-attention' : null;
  if (
    outcome !== 'started' ||
    issue !== null ||
    !exact(status, [
      'kind',
      'schemaVersion',
      'roomId',
      'revision',
      'roomLifecycle',
      'acceptedCommandCount',
    ]) ||
    own(status, 'kind') !== 'online-cloudflare-room-status-v1' ||
    own(status, 'schemaVersion') !== 1 ||
    own(status, 'roomId') !== roomId ||
    own(status, 'revision') !== 0 ||
    own(status, 'roomLifecycle') !== 'active' ||
    own(status, 'acceptedCommandCount') !== 0
  )
    return null;
  return 'started';
}

export function createPublicOnlineControllerV2(): PublicOnlineControllerV2 {
  const recoveryStore = createPublicOnlineRecoveryStoreV1();
  let projection: PublicOnlineProjectionV2 | null = null;
  let secrets: Secrets | null = null;
  let deck: PublicOnlineDeckOptionV2 | null = null;
  let lastDeck: PublicOnlineDeckOptionV2 | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let busy: PublicOnlineSnapshotV2['busy'] = null;
  let playerClient: OnlineBrowserWebSocketClientV1 | null = null;
  let tableClient: OnlineBrowserWebSocketClientV1 | null = null;
  let playerUnsubscribe: (() => void) | null = null;
  let tableUnsubscribe: (() => void) | null = null;
  let browsersEpoch = -1;
  let epoch = 0;
  let abortController: AbortController | null = null;
  let requestSequence = 0;
  const listeners = new Set<(snapshot: PublicOnlineSnapshotV2) => void>();
  let snapshot: PublicOnlineSnapshotV2 = Object.freeze({
    mode: 'entry',
    roomId: null,
    isHost: false,
    lifecycle: null,
    projection: null,
    invites: Object.freeze([]),
    selectedDeckId: '',
    busy: null,
    connection: 'lobby',
    ownerIssue: null,
    error: null,
    ownSeatIndex: null,
    player: null,
    table: null,
  });
  const browserState = (
    client: OnlineBrowserWebSocketClientV1 | null,
  ): OnlineBrowserStateV1 | null => client?.getSnapshot() ?? null;
  const connection = (
    started: boolean,
    host: boolean,
    player: OnlineBrowserStateV1 | null,
    table: OnlineBrowserStateV1 | null,
    error: string | null,
  ): PublicOnlineSnapshotV2['connection'] => {
    if (!started) return error === null ? 'lobby' : 'failed';
    const phases = [player?.phase, table?.phase];
    if (phases.includes('failed')) return 'failed';
    if (phases.includes('recovering')) return 'reconnecting';
    if (player?.phase === 'open' && (!host || table?.phase === 'open')) return 'online';
    return 'connecting';
  };
  const publish = (error: string | null = snapshot.error): void => {
    const safe = projection;
    snapshot = Object.freeze({
      ...snapshot,
      roomId: projection?.roomId ?? snapshot.roomId,
      lifecycle: projection?.lifecycle ?? null,
      projection: safe,
      selectedDeckId: deck?.id ?? '',
      busy,
      connection: connection(
        projection?.lifecycle === 'started',
        snapshot.isHost,
        browserState(playerClient),
        browserState(tableClient),
        error,
      ),
      error,
      ownSeatIndex:
        secrets === null || projection === null
          ? null
          : (projection.seats.find((seat) => seat.participantId === secrets?.participantId)
              ?.seatIndex ?? null),
      player: browserState(playerClient),
      table: browserState(tableClient),
    });
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch {
        /* isolated */
      }
    }
  };
  const stopPoll = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const closeBrowsers = (): void => {
    playerUnsubscribe?.();
    tableUnsubscribe?.();
    playerUnsubscribe = null;
    tableUnsubscribe = null;
    playerClient?.disconnect();
    tableClient?.disconnect();
    playerClient = null;
    tableClient = null;
    browsersEpoch = -1;
  };
  const startBrowsers = (): void => {
    if (
      secrets === null ||
      projection === null ||
      projection.lifecycle !== 'started' ||
      browsersEpoch === epoch
    )
      return;
    closeBrowsers();
    browsersEpoch = epoch;
    const roomId = projection.roomId;
    const origin = PUBLIC_ONLINE_ENDPOINT_V1.replace(/^https:/, 'wss:');
    const create = (
      participantId: string,
      capabilityValue: string,
    ): OnlineBrowserWebSocketClientV1 =>
      createOnlineBrowserWebSocketClientV1({
        webSocketUrl: `${origin}/api/online/rooms/${encodeURIComponent(roomId)}/websocket`,
        protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
        roomId: roomId as never,
        participantId: participantId as never,
        participantCapability: capabilityValue as never,
        clientBuildId: 'o4p-07b-client',
      });
    playerClient = create(secrets.participantId, secrets.seatCapability);
    playerUnsubscribe = playerClient.subscribe(() => publish(null));
    playerClient.connect();
    if (secrets.tableParticipantId !== '' && secrets.tableCapability !== '') {
      tableClient = create(secrets.tableParticipantId, secrets.tableCapability);
      tableUnsubscribe = tableClient.subscribe(() => publish(null));
      tableClient.connect();
    }
    publish(null);
  };
  const pollLater = (): void => {
    stopPoll();
    if (projection?.lifecycle !== 'forming' && projection?.lifecycle !== 'ready') return;
    timer = setTimeout(() => {
      timer = null;
      void refresh().finally(pollLater);
    }, 2000);
  };
  const request = async (path: string, init: RequestInit): Promise<unknown> => {
    const requestEpoch = epoch;
    const sequence = ++requestSequence;
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    const response = await fetch(`${PUBLIC_ONLINE_ENDPOINT_V1}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (requestEpoch !== epoch || sequence !== requestSequence)
      throw new Error(PUBLIC_ONLINE_ERROR_V1);
    const value = await json(response, secretList(secrets));
    if (requestEpoch !== epoch || sequence !== requestSequence)
      throw new Error(PUBLIC_ONLINE_ERROR_V1);
    return value;
  };
  const requestRaw = async (path: string, init: RequestInit): Promise<Readonly<{ readonly response: Response; readonly epoch: number; readonly sequence: number }>> => {
    const requestEpoch = epoch;
    const sequence = ++requestSequence;
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    const response = await fetch(`${PUBLIC_ONLINE_ENDPOINT_V1}${path}`, { ...init, signal: controller.signal });
    if (requestEpoch !== epoch || sequence !== requestSequence) throw new Error(PUBLIC_ONLINE_ERROR_V1);
    return Object.freeze({ response, epoch: requestEpoch, sequence });
  };
  const loadProjection = async (roomId: string): Promise<PublicOnlineProjectionV2> => {
    const value = await request(
      `/api/online/rooms/${encodeURIComponent(roomId)}/lobby?schemaVersion=2`,
      { method: 'GET', headers: { accept: 'application/json' } },
    );
    const checked = validatePublicOnlineProjectionV2(value);
    if (!checked.ok || checked.value.roomId !== roomId) throw new Error(PUBLIC_ONLINE_ERROR_V1);
    return checked.value;
  };
  const refresh = async (): Promise<void> => {
    if (snapshot.roomId === null || secrets === null || busy !== null) return;
    const operationEpoch = epoch;
    busy = 'refresh';
    publish(null);
    try {
      projection = await loadProjection(snapshot.roomId);
      publish(null);
      if (projection.lifecycle === 'started') startBrowsers();
    } catch (error: unknown) {
      if (operationEpoch === epoch) publish(publicRequestErrorMessage(error));
    } finally {
      if (operationEpoch === epoch) {
        busy = null;
        publish(snapshot.error);
      }
    }
  };
  const create = async (): Promise<void> => {
    if (busy !== null) return;
    epoch += 1;
    abortController?.abort();
    const operationEpoch = epoch;
    busy = 'create';
    publish(null);
    try {
      const participantId = id('p');
      const value = created(
        await request('/api/online/rooms', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'online-forming-lobby-create-v1',
            schemaVersion: 1,
            participantId,
          }),
        }),
        participantId,
      );
      if (value === null) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      secrets = value.secrets;
      projection = await loadProjection(value.roomId);
      snapshot = Object.freeze({
        ...snapshot,
        mode: 'forming',
        roomId: value.roomId,
        isHost: true,
        invites: value.secrets.invites,
      });
      publish(null);
      pollLater();
    } catch (error: unknown) {
      if (operationEpoch === epoch) publish(publicRequestErrorMessage(error));
    } finally {
      if (operationEpoch === epoch) {
        busy = null;
        publish(snapshot.error);
      }
    }
  };
  const join = async (roomId: string, inviteCapability: string): Promise<void> => {
    if (busy !== null || !appId(roomId) || !capability(inviteCapability)) {
      publish(PUBLIC_ONLINE_ERROR_V1);
      return;
    }
    epoch += 1;
    abortController?.abort();
    const operationEpoch = epoch;
    busy = 'join';
    publish(null);
    try {
      const participantId = id('p');
      const seat = claimed(
        await request(`/api/online/rooms/${encodeURIComponent(roomId)}/lobby`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'online-forming-lobby-seat-claim-v1',
            schemaVersion: 1,
            participantId,
            inviteCapability,
          }),
        }),
        roomId,
        participantId,
        inviteCapability,
      );
      if (seat === null) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      secrets = Object.freeze({
        participantId,
        seatCapability: seat,
        invites: Object.freeze([inviteCapability]),
        tableParticipantId: '',
        tableCapability: '',
      });
      projection = await loadProjection(roomId);
      snapshot = Object.freeze({
        ...snapshot,
        mode: 'forming',
        roomId,
        isHost: false,
        invites: Object.freeze([]),
      });
      publish(null);
      pollLater();
    } catch (error: unknown) {
      if (operationEpoch === epoch) publish(publicRequestErrorMessage(error));
    } finally {
      if (operationEpoch === epoch) {
        busy = null;
        publish(snapshot.error);
      }
    }
  };
  const sharedFailure = (body: unknown): string => {
    const parsed = parsePublicOnlineErrorV3(body);
    return parsed === null ? PUBLIC_ONLINE_ERROR_V1 : publicOnlineErrorMessageV3(parsed).message;
  };
  const createShared = async (): Promise<void> => {
    if (busy !== null) return;
    epoch += 1;
    abortController?.abort();
    const operationEpoch = epoch;
    busy = 'create';
    publish(null);
    try {
      const participantId = id('p');
      const raw = await requestRaw('/api/online/rooms', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'online-forming-lobby-create-v3', schemaVersion: 3, participantId }),
      });
      const body = await boundedResponseJson(raw.response, []);
      if (raw.epoch !== epoch || raw.sequence !== requestSequence) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      if (!raw.response.ok) { publish(sharedFailure(body)); return; }
      if (!exact(body, ['kind', 'schemaVersion', 'roomId', 'participantId', 'seatCapability', 'inviteCode', 'tableParticipantId', 'tableCapability', 'projection']) || own(body, 'kind') !== 'online-forming-lobby-created-v3' || own(body, 'schemaVersion') !== 3 || own(body, 'participantId') !== participantId) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const roomId = own(body, 'roomId'); const seatCapability = own(body, 'seatCapability'); const inviteCodeValue = own(body, 'inviteCode'); const tableParticipantId = own(body, 'tableParticipantId'); const tableCapability = own(body, 'tableCapability');
      if (typeof inviteCodeValue !== 'string') throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const inviteCode = inviteCodeValue;
      const parsedInvite = parseOnlineSharedInviteCodeV3(inviteCode);
      const checked = validatePublicOnlineProjectionV2(own(body, 'projection'));
      if (!appId(roomId) || !capability(seatCapability) || parsedInvite === null || parsedInvite.roomId !== roomId || !appId(tableParticipantId) || !capability(tableCapability) || !checked.ok || checked.value.roomId !== roomId || checked.value.hostParticipantId !== participantId || checked.value.seats.filter((seat) => seat.participantId === participantId).length !== 1 || pairwiseCapabilityFragment([seatCapability, parsedInvite.admissionCapability, tableCapability]) || secretFragment(JSON.stringify(checked.value), [seatCapability, parsedInvite.admissionCapability, tableCapability])) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const nextSecrets = Object.freeze({ participantId, seatCapability, invites: Object.freeze([inviteCode]), tableParticipantId, tableCapability });
      recoveryStore.save({ kind: 'public-online-recovery-v1', schemaVersion: 1, roomId, participantId, seatCapability, isHost: true, tableParticipantId, tableCapability });
      secrets = nextSecrets;
      projection = checked.value;
      snapshot = Object.freeze({ ...snapshot, mode: 'forming', roomId, isHost: true, invites: nextSecrets.invites, error: null });
      publish(null);
      pollLater();
    } catch { if (operationEpoch === epoch) publish(PUBLIC_ONLINE_ERROR_V1); }
    finally { if (operationEpoch === epoch) { busy = null; publish(snapshot.error); } }
  };
  const joinShared = async (inviteCode: string): Promise<void> => {
    if (busy !== null) return;
    const invite = parseOnlineSharedInviteCodeV3(inviteCode);
    if (invite === null) { publish(PUBLIC_ONLINE_ERROR_V1); return; }
    epoch += 1;
    abortController?.abort();
    const operationEpoch = epoch;
    busy = 'join';
    publish(null);
    try {
      const participantId = id('p');
      const raw = await requestRaw(`/api/online/rooms/${encodeURIComponent(invite.roomId)}/lobby`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3, participantId, admissionCapability: invite.admissionCapability }),
      });
      const body = await boundedResponseJson(raw.response, [invite.admissionCapability]);
      if (raw.epoch !== epoch || raw.sequence !== requestSequence) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      if (!raw.response.ok) { publish(sharedFailure(body)); return; }
      if (!exact(body, ['kind', 'schemaVersion', 'roomId', 'participantId', 'seatCapability', 'projection']) || own(body, 'kind') !== 'online-forming-lobby-shared-claimed-v3' || own(body, 'schemaVersion') !== 3 || own(body, 'roomId') !== invite.roomId || own(body, 'participantId') !== participantId) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const seatCapability = own(body, 'seatCapability');
      const checked = validatePublicOnlineProjectionV2(own(body, 'projection'));
      if (!capability(seatCapability) || !checked.ok || checked.value.roomId !== invite.roomId || checked.value.seats.filter((seat) => seat.participantId === participantId).length !== 1 || secretFragment(JSON.stringify(checked.value), [seatCapability, invite.admissionCapability])) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const nextSecrets = Object.freeze({ participantId, seatCapability, invites: Object.freeze([] as string[]), tableParticipantId: '', tableCapability: '' });
      recoveryStore.save({ kind: 'public-online-recovery-v1', schemaVersion: 1, roomId: invite.roomId, participantId, seatCapability, isHost: false, tableParticipantId: null, tableCapability: null });
      secrets = nextSecrets;
      projection = checked.value;
      snapshot = Object.freeze({ ...snapshot, mode: 'forming', roomId: invite.roomId, isHost: false, invites: Object.freeze([]), error: null });
      publish(null);
      pollLater();
    } catch { if (operationEpoch === epoch) publish(PUBLIC_ONLINE_ERROR_V1); }
    finally { if (operationEpoch === epoch) { busy = null; publish(snapshot.error); } }
  };
  const validatedRecovery = (body: unknown, record: PublicOnlineRecoveryRecordV1): Readonly<{ readonly secrets: Secrets; readonly projection: PublicOnlineProjectionV2 }> | null => {
    if (!plain(body) || own(body, 'kind') !== 'online-forming-lobby-recovered-v3' || own(body, 'schemaVersion') !== 3 || own(body, 'roomId') !== record.roomId || own(body, 'participantId') !== record.participantId || own(body, 'seatCapability') !== record.seatCapability) return null;
    const projectionResult = validatePublicOnlineProjectionV2(own(body, 'projection'));
    if (!projectionResult.ok || projectionResult.value.roomId !== record.roomId) return null;
    const ownSeats = projectionResult.value.seats.filter((seat) => seat.participantId === record.participantId);
    if (ownSeats.length !== 1 || (record.isHost !== (projectionResult.value.hostParticipantId === record.participantId))) return null;
    if (record.isHost) {
      if (!exact(body, ['kind', 'schemaVersion', 'roomId', 'participantId', 'seatCapability', 'inviteCode', 'tableParticipantId', 'tableCapability', 'projection'])) return null;
      const inviteCode = own(body, 'inviteCode'); const tableParticipantId = own(body, 'tableParticipantId'); const tableCapability = own(body, 'tableCapability');
      const sharedInvite = typeof inviteCode === 'string' ? inviteCode : null;
      const parsedInvite = sharedInvite === null ? null : parseOnlineSharedInviteCodeV3(sharedInvite);
      if (sharedInvite === null || parsedInvite === null || parsedInvite.roomId !== record.roomId || typeof tableParticipantId !== 'string' || !appId(tableParticipantId) || typeof tableCapability !== 'string' || !capability(tableCapability) || tableParticipantId !== record.tableParticipantId || tableCapability !== record.tableCapability) return null;
      if (secretFragment(JSON.stringify(projectionResult.value), [record.seatCapability, tableCapability])) return null;
      return Object.freeze({ secrets: Object.freeze({ participantId: record.participantId, seatCapability: record.seatCapability, invites: Object.freeze([sharedInvite]), tableParticipantId, tableCapability }), projection: projectionResult.value });
    }
    if (!exact(body, ['kind', 'schemaVersion', 'roomId', 'participantId', 'seatCapability', 'projection'])) return null;
    if (secretFragment(JSON.stringify(projectionResult.value), [record.seatCapability])) return null;
    return Object.freeze({ secrets: Object.freeze({ participantId: record.participantId, seatCapability: record.seatCapability, invites: Object.freeze([] as string[]), tableParticipantId: '', tableCapability: '' }), projection: projectionResult.value });
  };
  const recover = async (): Promise<void> => {
    if (busy !== null) return;
    const record = recoveryStore.load();
    if (record === null) return;
    const operationEpoch = epoch;
    busy = 'refresh';
    publish(null);
    try {
      const raw = await requestRaw(`/api/online/rooms/${encodeURIComponent(record.roomId)}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-recover-v3', schemaVersion: 3, participantId: record.participantId, seatCapability: record.seatCapability }) });
      const response = raw.response;
      const body = await boundedResponseJson(response, []);
      if (raw.epoch !== epoch || raw.sequence !== requestSequence) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      if (!response.ok) {
        const parsed = body !== null && !secretFragment(JSON.stringify(body), [record.seatCapability]) ? parsePublicOnlineErrorV3(body) : null;
        if (parsed?.code === 'CREDENTIAL_KICKED' || parsed?.code === 'CREDENTIAL_REJECTED' || parsed?.code === 'ROOM_NOT_FOUND' || parsed?.code === 'ROOM_EXPIRED') recoveryStore.clear();
        if (parsed !== null) publish(publicOnlineErrorMessageV3(parsed).message);
        else publish(PUBLIC_ONLINE_ERROR_V1);
        return;
      }
      const checked = validatedRecovery(body, record);
      if (checked === null) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      secrets = checked.secrets;
      projection = checked.projection;
      snapshot = Object.freeze({ ...snapshot, mode: projection.lifecycle === 'started' ? 'started' : 'forming', roomId: record.roomId, isHost: record.isHost, invites: secrets.invites, error: null });
      publish(null);
      if (projection.lifecycle === 'started') startBrowsers(); else pollLater();
    } catch { if (operationEpoch === epoch) publish(PUBLIC_ONLINE_ERROR_V1); }
    finally { if (operationEpoch === epoch) { busy = null; publish(snapshot.error); } }
  };
  const leave = async (): Promise<void> => {
    if (busy !== null || secrets === null || snapshot.roomId === null) return;
    const roomId = snapshot.roomId;
    const participantId = secrets.participantId;
    const seatCapability = secrets.seatCapability;
    const host = snapshot.isHost;
    const operationEpoch = epoch;
    busy = 'refresh';
    publish(null);
    try {
      const raw = await requestRaw(`/api/online/rooms/${encodeURIComponent(roomId)}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-leave-v3', schemaVersion: 3, participantId, seatCapability }) });
      const response = raw.response;
      const body = await boundedResponseJson(response, [seatCapability]);
      if (raw.epoch !== epoch || raw.sequence !== requestSequence) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      if (!response.ok) {
        const parsed = parsePublicOnlineErrorV3(body);
        if (parsed?.code === 'CREDENTIAL_KICKED' || parsed?.code === 'CREDENTIAL_REJECTED' || parsed?.code === 'ROOM_NOT_FOUND' || parsed?.code === 'ROOM_EXPIRED') recoveryStore.clear();
        publish(parsed === null ? PUBLIC_ONLINE_ERROR_V1 : publicOnlineErrorMessageV3(parsed).message);
        return;
      }
      if (host) {
        if (!exact(body, ['kind', 'schemaVersion', 'roomId', 'closed']) || own(body, 'kind') !== 'online-forming-lobby-left-v3' || own(body, 'schemaVersion') !== 3 || own(body, 'roomId') !== roomId || own(body, 'closed') !== true) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      } else {
        if (!exact(body, ['kind', 'schemaVersion', 'roomId', 'projection']) || own(body, 'kind') !== 'online-forming-lobby-left-v3' || own(body, 'schemaVersion') !== 3 || own(body, 'roomId') !== roomId) throw new Error(PUBLIC_ONLINE_ERROR_V1);
        const checked = validatePublicOnlineProjectionV2(own(body, 'projection'));
        if (!checked.ok || checked.value.roomId !== roomId || checked.value.seats.filter((seat) => seat.participantId === participantId).length !== 0) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      }
      recoveryStore.clear(); disconnect();
    } catch { if (operationEpoch === epoch) publish(PUBLIC_ONLINE_ERROR_V1); }
    finally { if (operationEpoch === epoch) busy = null; }
  };
  const submitDeck = async (value: PublicOnlineDeckOptionV2): Promise<void> => {
    if (
      busy !== null ||
      projection === null ||
      secrets === null ||
      projection.lifecycle === 'started'
    )
      return;
    const safeDeck = safeDeckEntries(value, secretList(secrets));
    if (safeDeck === null) {
      publish(PUBLIC_ONLINE_ERROR_V1);
      return;
    }
    const operationEpoch = epoch;
    busy = 'deck';
    deck = value;
    lastDeck = value;
    publish(null);
    try {
      const submissionId = id('submission');
      const entries = safeDeck.entries;
      const response = await request(
        `/api/online/rooms/${encodeURIComponent(projection.roomId)}/lobby`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'online-forming-lobby-deck-submit-v2',
            schemaVersion: 2,
            participantId: secrets.participantId,
            seatCapability: secrets.seatCapability,
            deckId: value.id,
            submissionId,
            entries,
          }),
        },
      );
      if (
        !exact(response, [
          'kind',
          'schemaVersion',
          'roomId',
          'submissionId',
          'state',
          'issues',
          'projection',
        ]) ||
        own(response, 'kind') !== 'online-forming-lobby-deck-result-v2' ||
        own(response, 'schemaVersion') !== 2 ||
        own(response, 'roomId') !== projection.roomId ||
        own(response, 'submissionId') !== submissionId
      )
        throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const checked = validatePublicOnlineProjectionV2(own(response, 'projection'));
      if (!checked.ok || checked.value.roomId !== projection.roomId)
        throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const issues = parseIssues(own(response, 'issues'), safeDeck.entries.length);
      if (issues === null) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const state = own(response, 'state');
      if (
        (state === 'accepted' && issues.length !== 0) ||
        (state === 'needs-attention' && issues.length === 0) ||
        (state !== 'accepted' &&
          state !== 'needs-attention' &&
          state !== 'resolving' &&
          state !== 'none')
      )
        throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const projectedOwnSeat = checked.value.seats.find(
        (seat) => seat.participantId === secrets?.participantId,
      );
      const conflictKeepsAcceptedDeck =
        state === 'needs-attention' &&
        projectedOwnSeat?.deckState === 'accepted' &&
        issues.length === 1 &&
        plain(issues[0]) &&
        own(issues[0], 'code') === 'SUBMISSION_CONFLICT';
      if (
        checked.value.lifecycle === 'started' ||
        projectedOwnSeat === undefined ||
        (projectedOwnSeat.deckState !== state && !conflictKeepsAcceptedDeck)
      )
        throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const first = issues[0];
      const codeValue = plain(first) ? own(first, 'code') : undefined;
      const code: string | null = typeof codeValue === 'string' ? codeValue : null;
      const indexValue = plain(first) ? own(first, 'entryIndex') : undefined;
      const entryIndex = indexValue === null || typeof indexValue === 'number' ? indexValue : null;
      const retryValue = plain(first) ? own(first, 'retryable') : undefined;
      const retryable: boolean = typeof retryValue === 'boolean' ? retryValue : false;
      projection = checked.value;
      snapshot = Object.freeze({
        ...snapshot,
        ownerIssue:
          code === null
            ? null
            : Object.freeze({
                code,
                entryIndex,
                retryable,
                message: issueText(code, entryIndex, safeDeck.ownerLabels),
              }),
      });
      publish(null);
      pollLater();
    } catch (error: unknown) {
      if (operationEpoch === epoch) publish(publicRequestErrorMessage(error));
    } finally {
      if (operationEpoch === epoch) {
        busy = null;
        publish(snapshot.error);
      }
    }
  };
  const toggleReady = async (): Promise<void> => {
    if (
      busy !== null ||
      projection === null ||
      secrets === null ||
      projection.lifecycle === 'started'
    )
      return;
    const ownSeat = projection.seats.find((seat) => seat.participantId === secrets?.participantId);
    if (ownSeat === undefined || ownSeat.deckState !== 'accepted') return;
    const readyValue = !ownSeat.ready;
    const operationEpoch = epoch;
    busy = 'ready';
    publish(null);
    try {
      const response = await request(
        `/api/online/rooms/${encodeURIComponent(projection.roomId)}/lobby`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'online-forming-lobby-ready-v2',
            schemaVersion: 2,
            participantId: secrets.participantId,
            seatCapability: secrets.seatCapability,
            ready: readyValue,
          }),
        },
      );
      if (
        !exact(response, ['kind', 'schemaVersion', 'roomId', 'projection']) ||
        own(response, 'kind') !== 'online-forming-lobby-ready-v2' ||
        own(response, 'schemaVersion') !== 2 ||
        own(response, 'roomId') !== projection.roomId
      )
        throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const checked = validatePublicOnlineProjectionV2(own(response, 'projection'));
      if (!checked.ok || checked.value.roomId !== projection.roomId)
        throw new Error(PUBLIC_ONLINE_ERROR_V1);
      const projectedOwnSeat = checked.value.seats.find(
        (seat) => seat.participantId === secrets?.participantId,
      );
      if (
        checked.value.lifecycle === 'started' ||
        projectedOwnSeat === undefined ||
        projectedOwnSeat.deckState !== 'accepted' ||
        projectedOwnSeat.ready !== readyValue
      )
        throw new Error(PUBLIC_ONLINE_ERROR_V1);
      projection = checked.value;
      publish(null);
      pollLater();
    } catch (error: unknown) {
      if (operationEpoch === epoch) publish(publicRequestErrorMessage(error));
    } finally {
      if (operationEpoch === epoch) {
        busy = null;
        publish(snapshot.error);
      }
    }
  };
  const start = async (): Promise<void> => {
    if (
      busy !== null ||
      projection === null ||
      secrets === null ||
      !snapshot.isHost ||
      projection.lifecycle !== 'ready'
    )
      return;
    const operationEpoch = epoch;
    busy = 'start';
    publish(null);
    try {
      const response = await request(
        `/api/online/rooms/${encodeURIComponent(projection.roomId)}/lobby`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'online-forming-lobby-start-with-table-v2',
            schemaVersion: 2,
            hostParticipantId: secrets.participantId,
            seatCapability: secrets.seatCapability,
            tableParticipantId: secrets.tableParticipantId,
            tableCapability: secrets.tableCapability,
          }),
        },
      );
      const outcome = parseStartResult(response, projection.roomId);
      if (outcome === null) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      if (outcome === 'needs-attention') {
        snapshot = Object.freeze({
          ...snapshot,
          ownerIssue: Object.freeze({
            code: 'ROOM_GENESIS_TOO_LARGE',
            entryIndex: null,
            retryable: false,
            message: 'デッキが大きすぎます。数量またはカード数を減らしてください。',
          }),
        });
        publish(null);
        return;
      }
      projection = Object.freeze({ ...projection, lifecycle: 'started' });
      stopPoll();
      publish(null);
      startBrowsers();
    } catch (error: unknown) {
      if (operationEpoch === epoch) publish(publicRequestErrorMessage(error));
    } finally {
      if (operationEpoch === epoch) {
        busy = null;
        publish(snapshot.error);
      }
    }
  };
  const retry = async (): Promise<void> => {
    if (lastDeck !== null) await submitDeck(lastDeck);
  };
  const submitAction = (action: unknown, guided: boolean): void => {
    if (secrets === null || projection === null || playerClient === null) return;
    const personalProjection = playerClient.getSnapshot().projection;
    if (personalProjection === null) return;
    if (personalProjection.corePlayerId === null) return;
    const session: OnlineDisplayPairingSessionV1 = {
      protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
      roomId: projection.roomId,
      participantId: secrets.participantId,
      participantCapability: secrets.seatCapability as never,
      clientBuildId: 'o4p-07b-client',
      corePlayerId: personalProjection.corePlayerId,
      personalProjection,
    };
    try {
      const commandId = id('command') as never;
      const frame = guided
        ? bindOnlineGuidedCommandActionV1({ session, action, commandId })
        : bindPersonalWorkbenchActionV1({ session, action, commandId });
      if (frame.kind !== 'online-command-envelope-v1') return;
      const submitted = playerClient.submit({
        commandId: frame.commandId,
        baseRevision: frame.baseRevision,
        command: frame.command,
      });
      if (!submitted.ok) publish(PUBLIC_ONLINE_ERROR_V1);
    } catch {
      publish(PUBLIC_ONLINE_ERROR_V1);
    }
  };
  const disconnect = (): void => {
    epoch += 1;
    requestSequence += 1;
    abortController?.abort();
    abortController = null;
    stopPoll();
    closeBrowsers();
    projection = null;
    secrets = null;
    deck = null;
    lastDeck = null;
    busy = null;
    snapshot = Object.freeze({
      mode: 'entry',
      roomId: null,
      isHost: false,
      lifecycle: null,
      projection: null,
      invites: Object.freeze([]),
      selectedDeckId: '',
      busy: null,
      connection: 'lobby',
      ownerIssue: null,
      error: null,
      ownSeatIndex: null,
      player: null,
      table: null,
    });
    publish(null);
  };
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe: (listener: (value: PublicOnlineSnapshotV2) => void) => {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    create,
    join,
    createShared,
    joinShared,
    refresh,
    submitDeck,
    toggleReady,
    start,
    recover,
    leave,
    retry,
    displayDeckName: (name: string, index: number) => {
      const fallback = `保存済みデッキ ${index + 1}`;
      try {
        if (
          secrets === null ||
          !Number.isSafeInteger(index) ||
          index < 0 ||
          typeof name !== 'string' ||
          new TextEncoder().encode(name).length > 120 ||
          secretFragment(name, secretList(secrets))
        )
          return fallback;
        return name;
      } catch {
        return fallback;
      }
    },
    submitPersonalAction: (action: unknown) => submitAction(action, false),
    submitGuidedAction: (action: unknown) => submitAction(action, true),
    copyInvite: async (invite: string) => {
      if (
        snapshot.invites.includes(invite) &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard
      ) {
        try {
          await navigator.clipboard.writeText(invite);
        } catch {
          /* optional */
        }
      }
    },
    disconnect,
  });
}
