#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { types as nodeTypes } from 'node:util';

export const O4P06F_PAGES_ORIGIN_V1 = 'https://makeinu1.github.io/MTG_OneDeck/';
export const O4P06F_WORKER_ORIGIN_V1 = 'https://mtg-onedeck-online.makeinu1.workers.dev';
const CONTEXT_COUNT = 4;
const PROTOCOL_VERSION = 1;
const CLIENT_BUILD_ID = 'o4p-06f-client';
const ROOM_CREATE_PATH = '/api/online/rooms';
const ROOM_LOBBY_SUFFIX = '/lobby';
const ROOM_STATUS_SUFFIX = '';
const DECK_LABELS = ['Celes', 'Gogo', 'Kefka', 'Muldrotha'] as const;
const DECK_PATHS = ['Mydeck/Celes.txt', 'Mydeck/Gogo.txt', 'Mydeck/Kefka.txt', 'Mydeck/Muldrotha.txt'] as const;
const CORE_PLAYERS = ['P1', 'P2', 'P3', 'P4'] as const;
const MAX_SUMMARY_BYTES = 131_072;
const MAX_HTTP_BODY_BYTES = 1_048_576;
const MAX_WS_FRAME_BYTES = 65_536;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_DISCONNECT_OBSERVATION_TIMEOUT_MS = DEFAULT_TIMEOUT_MS * 4;
const MAX_CANONICAL_DEPTH = 64;
const MAX_CANONICAL_NODES = 20_000;
const MAX_DISCONNECT_OBSERVATION_ATTEMPTS = 8;
const MAX_QUEUED_REVISION_NOTICES = 64;

type RecordV1 = Record<string, unknown>;
type JsonValueV1 = null | boolean | number | string | readonly JsonValueV1[] | { readonly [key: string]: JsonValueV1 };

export type O4p06fDeckFactV1 = Readonly<{
  readonly label: typeof DECK_LABELS[number];
  readonly path: string;
  readonly sha256: string;
  readonly byteCount: number;
}>;

export type O4p06fEvidenceSummaryV1 = Readonly<{
  readonly kind: 'o4p-06f-four-browser-production-evidence-v1';
  readonly schemaVersion: 1;
  readonly pagesOrigin: typeof O4P06F_PAGES_ORIGIN_V1;
  readonly workerOrigin: typeof O4P06F_WORKER_ORIGIN_V1;
  readonly chromeVersion: string;
  readonly contextCount: 4;
  readonly decks: readonly O4p06fDeckFactV1[];
  readonly publicAssetHashes: readonly string[];
  readonly httpStatuses: readonly number[];
  readonly revision: 5;
  readonly acceptedCommandCount: 5;
  readonly actionKindCounts: Readonly<{ readonly 'table-draw': 4; readonly 'player-exit': 1 }>;
  readonly reconnect: Readonly<{
    readonly participant: 'P2';
    readonly freshSocket: true;
    readonly staleKnownRevision: number;
    readonly snapshotCount: 1;
    readonly bounded: true;
  }>;
  readonly preDeploymentVersionIdentifiers: readonly [string, string?];
  readonly postDeploymentVersionIdentifiers: readonly [string, string?];
  readonly preDeploymentProjectionHashes: Readonly<Record<string, string>>;
  readonly postDeploymentProjectionHashes: Readonly<Record<string, string>>;
  readonly recoveryFacts: Readonly<{
    readonly checkpointRevision: 0;
    readonly currentRevision: 5;
    readonly replayCount: 5;
    readonly outcome: 'ok';
    readonly errorCount: 0;
    readonly exceptionCount: 0;
    readonly parseFailureCount: 0;
    readonly secretViolationCount: 0;
  }>;
  readonly consoleCounts: Readonly<{ readonly errors: number; readonly warnings: number }>;
  readonly cleanup: Readonly<{ readonly targetsClosed: number; readonly startupTargetsClosed: number; readonly contextsClosed: number; readonly socketsClosed: number; readonly profileRemoved: boolean }>;
}>;

export type O4p06fResponseV1 = Readonly<{ readonly status: number; readonly json: () => Promise<unknown>; readonly text?: () => Promise<string> }>;

export type O4p06fSocketV1 = Readonly<{
  readonly send: (value: unknown) => Promise<void> | void;
  readonly next: (timeoutMs?: number) => Promise<unknown>;
  readonly close: () => Promise<void> | void;
  readonly pendingCount: () => Promise<number>;
}>;

export type O4p06fPageV1 = Readonly<{
  readonly navigate: (url: string) => Promise<void>;
  readonly evaluate: <T>(expression: string, argument?: unknown) => Promise<T>;
  readonly fetch: (url: string, init?: Readonly<{ readonly method?: string; readonly headers?: Readonly<Record<string, string>>; readonly body?: string }>) => Promise<O4p06fResponseV1>;
  readonly openWebSocket: (url: string) => Promise<O4p06fSocketV1>;
  readonly close: () => Promise<void> | void;
  readonly consoleCounts: () => Readonly<{ readonly errors: number; readonly warnings: number; readonly secretViolations?: number }>;
  readonly assetFacts?: () => Promise<Readonly<{ readonly href: string; readonly origin: string; readonly statuses: readonly number[]; readonly hashes: readonly string[] }>>;
  readonly setSecretFragments?: (fragments: readonly string[]) => void;
}>;

export type O4p06fContextV1 = Readonly<{
  readonly browserContextId: string;
  readonly createPage: () => Promise<O4p06fPageV1>;
  readonly close: () => Promise<void> | void;
}>;

export type O4p06fBrowserV1 = Readonly<{
  readonly chromeVersion: string;
  readonly startupTargetsClosed?: number;
  readonly createBrowserContext: () => Promise<O4p06fContextV1>;
  readonly close: () => Promise<void> | void;
  readonly profilePath?: string;
}>;

export type O4p06fPlatformEvidenceV1 = Readonly<{
  readonly roomCorrelationId: string;
  readonly preDeploymentVersionIdentifier: string;
  readonly postDeploymentVersionIdentifier: string;
  readonly checkpointRevision: 0;
  readonly currentRevision: 5;
  readonly replayCount: 5;
  readonly outcome: 'ok';
  readonly errorCount: 0;
  readonly exceptionCount: 0;
  readonly parseFailureCount: 0;
  readonly secretViolationCount: 0;
}>;

export type O4p06fEvidenceDepsV1 = Readonly<{
  readonly browser?: O4p06fBrowserV1;
  readonly launchBrowser?: () => Promise<O4p06fBrowserV1>;
  readonly readDeck?: (path: string) => string;
  readonly barrier?: (summary: Readonly<Record<string, string | number>>) => Promise<void>;
  readonly observePlatformEvidence?: (summary: Readonly<Record<string, string | number>>) => Promise<unknown>;
  readonly now?: () => number;
  readonly schedule?: (milliseconds: number, task: () => void) => unknown;
  readonly cancelSchedule?: (handle: unknown) => void;
  readonly timeoutMs?: number;
  readonly operatorTimeoutMs?: number;
  readonly pagesOrigin?: string;
  readonly workerOrigin?: string;
}>;

type TimeoutRuntimeV1 = Readonly<{
  readonly now: () => number;
  readonly schedule: (milliseconds: number, task: () => void) => unknown;
  readonly cancel: (handle: unknown) => void;
}>;

function record(value: unknown): value is RecordV1 {
  if (value !== null && typeof value === 'object' && nodeTypes.isProxy(value)) return false;
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
}

function own(value: RecordV1, key: string): unknown {
  if (nodeTypes.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

function isSafeString(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function runtimeIdentifier(prefix: string): string {
  return `${prefix}-${randomBytes(12).toString('hex')}`;
}

function capability(): string {
  return `${runtimeIdentifier('cap')}-${randomBytes(24).toString('base64url')}`;
}

function capabilityFragments(value: string): readonly string[] {
  return Object.freeze(Array.from({ length: Math.max(0, value.length - 7) }, (_entry, index) => value.slice(index, index + 8)));
}

function allCapabilityFragments(capabilities: readonly string[]): readonly string[] {
  return Object.freeze(capabilities.flatMap((value) => capabilityFragments(value)));
}

function containsCapabilityFragment(value: unknown, fragments: readonly string[]): boolean {
  const seen = new Set<object>();
  const pending: unknown[] = [value];
  let inspected = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === 'string') {
      if (fragments.some((fragment) => current.includes(fragment))) return true;
      continue;
    }
    if (current === null || typeof current !== 'object') continue;
    if (nodeTypes.isProxy(current)) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    inspected += 1;
    if (inspected > 20_000) return true;
    for (const key of Reflect.ownKeys(current)) {
      if (typeof key !== 'string') return true;
      pending.push(key);
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor === undefined || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return true;
      pending.push(descriptor.value);
    }
  }
  return false;
}

function containsCapabilityLikeString(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return /^(?:(?:cap|seat|invite|observer)[_-])[A-Za-z0-9_-]{1,128}$/.test(value);
  if (value === null || typeof value !== 'object' || seen.has(value)) return false;
  if (nodeTypes.isProxy(value)) return true;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') return true;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return true;
    if (containsCapabilityLikeString(descriptor.value, seen)) return true;
  }
  return false;
}

function assertSecretFree(value: unknown, fragments: readonly string[]): void {
  if (containsCapabilityFragment(value, fragments)) throw new Error('secret-bearing evidence');
}

function assertResponseSecretFree(value: RecordV1, fragments: readonly string[], allowedKeys: readonly string[] = []): void {
  const allowed = new Set(allowedKeys);
  const sanitized: RecordV1 = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new Error('response symbol field');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new Error('response descriptor invalid');
    if (!allowed.has(key)) sanitized[key] = descriptor.value;
  }
  assertSecretFree(sanitized, fragments);
  if (containsCapabilityLikeString(sanitized)) throw new Error('secret-bearing response');
}

function normalizeJson(value: unknown, seen = new WeakSet<object>(), depth = 0, state = { nodes: 0 }): JsonValueV1 {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error('invalid canonical number');
    return value;
  }
  if (typeof value !== 'object') throw new Error('invalid canonical value');
  if (nodeTypes.isProxy(value)) throw new Error('proxy canonical value');
  if (depth > MAX_CANONICAL_DEPTH || ++state.nodes > MAX_CANONICAL_NODES) throw new Error('canonical evidence bounds exceeded');
  if (seen.has(value)) throw new Error('cyclic evidence');
  seen.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) throw new Error('invalid canonical array prototype');
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string')) throw new Error('invalid canonical array symbols');
    const names = Object.getOwnPropertyNames(value);
    const length = value.length;
    if (names.length !== length + 1 || !names.includes('length') || names.some((name) => name !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(name))) throw new Error('invalid canonical array fields');
    const result: JsonValueV1[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new Error('invalid canonical array descriptor');
      result.push(normalizeJson(descriptor.value, seen, depth + 1, state));
    }
    return result;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) throw new Error('invalid canonical object prototype');
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string')) throw new Error('invalid canonical object symbols');
  const result: Record<string, JsonValueV1> = {};
  const names = Object.getOwnPropertyNames(value);
  for (const key of names.sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new Error('invalid canonical object descriptor');
    result[key] = normalizeJson(descriptor.value, seen, depth + 1, state);
  }
  return result;
}

function canonicalString(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

function parseBoundedJson(value: string): unknown {
  if (new TextEncoder().encode(value).byteLength > MAX_HTTP_BODY_BYTES) throw new Error('operator evidence too large');
  let depth = 0; let nodes = 0; let inString = false; let escaped = false;
  for (const character of value) {
    if (inString) { if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') inString = false; continue; }
    if (character === '"') { inString = true; continue; }
    if (character === '{' || character === '[') { depth += 1; nodes += 1; if (depth > MAX_CANONICAL_DEPTH || nodes > MAX_CANONICAL_NODES) throw new Error('operator evidence bounds exceeded'); }
    else if (character === '}' || character === ']') depth -= 1;
  }
  if (depth !== 0 || inString || escaped) throw new Error('operator evidence malformed');
  const parsed: unknown = JSON.parse(value);
  normalizeJson(parsed);
  return parsed;
}

function freezeDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as RecordV1)) freezeDeep(child, seen);
    Object.freeze(value);
  }
  return value;
}

function assertTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string, runtime?: TimeoutRuntimeV1): Promise<T> {
  const clock = runtime ?? { now: () => Date.now(), schedule: (milliseconds: number, task: () => void) => setTimeout(task, milliseconds), cancel: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>) };
  let timer: unknown;
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => { timer = clock.schedule(timeoutMs, () => reject(new Error(`${label} timeout`))); }),
  ]).finally(() => { if (timer !== undefined) clock.cancel(timer); });
}

function responseBody(response: O4p06fResponseV1): Promise<unknown> {
  if (typeof response.text === 'function') return response.text().then((value): unknown => { if (new TextEncoder().encode(value).byteLength > MAX_HTTP_BODY_BYTES) throw new Error('HTTP body too large'); return JSON.parse(value) as unknown; });
  if (typeof response.json === 'function') return response.json().then((value): unknown => { const canonical = canonicalString(value); if (new TextEncoder().encode(canonical).byteLength > MAX_HTTP_BODY_BYTES) throw new Error('HTTP body too large'); return value; });
  return Promise.reject(new Error('invalid browser response'));
}

async function requestJson(page: O4p06fPageV1, url: string, init: Readonly<{ readonly method?: string; readonly body?: string }> | undefined, timeoutMs: number, runtime?: TimeoutRuntimeV1): Promise<{ readonly status: number; readonly body: RecordV1 }> {
  const response = await assertTimeout(page.fetch(url, { ...init, headers: { 'content-type': 'application/json' } }), timeoutMs, 'browser fetch', runtime);
  const body = await assertTimeout(responseBody(response), timeoutMs, 'browser response', runtime);
  if (!record(body)) throw new Error('invalid browser JSON response');
  return Object.freeze({ status: response.status, body });
}

function asRecord(value: unknown, label: string): RecordV1 {
  if (!record(value)) throw new Error(label);
  return value;
}

function exactString(value: RecordV1, key: string, expected: string, label: string): string {
  const actual = own(value, key);
  if (actual !== expected) throw new Error(label);
  return actual;
}

function exactNumber(value: RecordV1, key: string, expected: number, label: string): number {
  const actual = own(value, key);
  if (actual !== expected) throw new Error(label);
  return actual;
}

function projectionFrom(value: RecordV1, fragments: readonly string[], label: string): RecordV1 {
  exactString(value, 'kind', 'online-projected-snapshot-v1', label);
  exactString(value, 'status', 'accepted', label);
  const projection = asRecord(own(value, 'projection'), label);
  assertSecretFree(projection, fragments);
  return projection;
}

function projectedZone(value: unknown, label: string): Readonly<{ readonly count: number; readonly entries: readonly unknown[] }> {
  const zone = exactKeys(value, ['count', 'entries'], label);
  const count = own(zone, 'count');
  const entries = own(zone, 'entries');
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || Object.is(count, -0) || count < 0) throw new Error(label);
  if (!Array.isArray(entries)) throw new Error(label);
  canonicalString(entries);
  if (entries.length !== count) throw new Error(label);
  return Object.freeze({ count, entries: entries as readonly unknown[] });
}

function projectionPlayerZoneGroups(projection: RecordV1): readonly Readonly<{ readonly playerId: string; readonly zones: RecordV1 }>[] {
  const game = asRecord(own(projection, 'game'), 'projection game missing');
  const zones = asRecord(own(game, 'zones'), 'projection zones missing');
  const byPlayer = own(zones, 'byPlayer');
  if (!Array.isArray(byPlayer)) throw new Error('projection player zones missing');
  canonicalString(byPlayer);
  const seen = new Set<string>();
  return Object.freeze((byPlayer as readonly unknown[]).map((entry) => {
    const group = exactKeys(entry, ['playerId', 'zones'], 'projection player zone malformed');
    const playerId = own(group, 'playerId');
    if (typeof playerId !== 'string' || playerId.length === 0 || seen.has(playerId)) throw new Error('projection player id malformed');
    seen.add(playerId);
    const groupedZones = exactKeys(own(group, 'zones'), ['library', 'hand', 'graveyard'], 'projection grouped zones malformed');
    projectedZone(own(groupedZones, 'library'), 'projection library malformed');
    projectedZone(own(groupedZones, 'hand'), 'projection hand malformed');
    projectedZone(own(groupedZones, 'graveyard'), 'projection graveyard malformed');
    return Object.freeze({ playerId, zones: groupedZones });
  }));
}

export function inspectO4p06fProjectionZonesV1(projection: unknown, ownPlayerId: string, expectedPlayerIds: readonly string[] = CORE_PLAYERS): Readonly<{ readonly hand: number; readonly library: number }> | null {
  const root = asRecord(projection, 'projection missing');
  const groups = projectionPlayerZoneGroups(root);
  if (groups.length !== expectedPlayerIds.length || groups.some((entry, index) => entry.playerId !== expectedPlayerIds[index])) throw new Error('projection player zones incomplete');
  let ownCounts: Readonly<{ readonly hand: number; readonly library: number }> | null = null;
  for (const entry of groups) {
    const isOwn = entry.playerId === ownPlayerId;
    const hand = projectedZone(own(entry.zones, 'hand'), 'projection hand malformed');
    const library = projectedZone(own(entry.zones, 'library'), 'projection library malformed');
    if (isOwn) ownCounts = Object.freeze({ hand: hand.count, library: library.count });
    if (isOwn) continue;
    for (const zoneName of ['hand', 'library'] as const) {
      const zone = zoneName === 'hand' ? hand : library;
      for (const card of zone.entries) {
        const hidden = exactKeys(card, ['kind'], 'opponent hidden-card entry malformed');
        if (own(hidden, 'kind') !== 'hidden-card') throw new Error('opponent hidden-card identity disclosure');
      }
    }
  }
  return ownCounts;
}

function projectionZones(projection: RecordV1, playerId: string): Readonly<{ readonly hand: number; readonly library: number }> {
  const counts = inspectO4p06fProjectionZonesV1(projection, playerId);
  if (counts === null) throw new Error('projection player zone missing');
  return counts;
}

function assertNoHiddenOpponentIdentity(projection: RecordV1, ownPlayerId: string, expectedPlayerIds: readonly string[] = CORE_PLAYERS): void {
  inspectO4p06fProjectionZonesV1(projection, ownPlayerId, expectedPlayerIds);
}

export function inspectO4p06fParticipantPresenceV1(projection: unknown, expectedParticipantId: string, expectedSeatIndex: number): 'connected' | 'disconnected' {
  if (typeof expectedParticipantId !== 'string' || expectedParticipantId.length === 0) throw new Error('expected participant ID missing');
  if (!Number.isSafeInteger(expectedSeatIndex) || Object.is(expectedSeatIndex, -0) || expectedSeatIndex < 0 || expectedSeatIndex > 3) throw new Error('expected participant seat missing');
  const root = asRecord(projection, 'projection missing');
  const room = exactKeys(own(root, 'room'), ['lifecycle', 'hostParticipantId', 'participants', 'seats'], 'projection room malformed');
  const participants = own(room, 'participants');
  if (!Array.isArray(participants) || participants.length !== 5) throw new Error('projection participant rows incomplete');
  canonicalString(participants);
  const seen = new Set<string>();
  let matched: 'connected' | 'disconnected' | null = null;
  let playerSeats = 0;
  const seatIndexes = new Set<number>();
  for (const participant of participants) {
    const row = exactKeys(participant, ['participantId', 'role', 'presence', 'seatIndex'], 'projection participant row malformed');
    const participantId = own(row, 'participantId');
    const role = own(row, 'role');
    const presence = own(row, 'presence');
    const seatIndex = own(row, 'seatIndex');
    if (typeof participantId !== 'string' || participantId.length === 0 || seen.has(participantId)) throw new Error('projection participant ID malformed');
    seen.add(participantId);
    if (role !== 'player' && role !== 'table') throw new Error('projection participant role malformed');
    if (presence !== 'connected' && presence !== 'disconnected') throw new Error('projection participant presence malformed');
    if (role === 'player') {
      if (typeof seatIndex !== 'number' || !Number.isSafeInteger(seatIndex) || Object.is(seatIndex, -0) || seatIndex < 0 || seatIndex > 3 || seatIndexes.has(seatIndex)) throw new Error('projection participant seat malformed');
      seatIndexes.add(seatIndex); playerSeats += 1;
    } else if (seatIndex !== null) {
      throw new Error('projection table seat malformed');
    }
    if (participantId === expectedParticipantId) {
      if (matched !== null) throw new Error('projection participant duplicate');
      if (role !== 'player' || seatIndex !== expectedSeatIndex) throw new Error('projection target participant relation malformed');
      matched = presence;
    }
  }
  if (playerSeats !== 4 || seatIndexes.size !== 4 || matched === null) throw new Error('projection participant row missing');
  return matched;
}

export async function awaitO4p06fParticipantDisconnectedV1(input: Readonly<{
  readonly socket: O4p06fSocketV1;
  readonly roomId: string;
  readonly observerParticipantId: string;
  readonly observerParticipantCapability: string;
  readonly targetParticipantId: string;
  readonly targetExpectedSeatIndex: number;
  readonly ownPlayerId: string;
  readonly fragments: readonly string[];
  readonly timeoutMs: number;
  readonly runtime: TimeoutRuntimeV1;
  readonly maxAttempts?: number;
}>): Promise<void> {
  if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs <= 0 || input.timeoutMs > MAX_DISCONNECT_OBSERVATION_TIMEOUT_MS) throw new Error('disconnect observation timeout invalid');
  const attempts = input.maxAttempts ?? MAX_DISCONNECT_OBSERVATION_ATTEMPTS;
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > MAX_DISCONNECT_OBSERVATION_ATTEMPTS) throw new Error('disconnect observation attempts invalid');
  const deadline = input.runtime.now() + input.timeoutMs;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const remaining = deadline - input.runtime.now();
    if (remaining <= 0) throw new Error('disconnect observation timeout');
    await drainQueuedRevisionNotices(input.socket, input.roomId, 4, remaining, input.fragments, input.runtime);
    const responseRemaining = deadline - input.runtime.now();
    if (responseRemaining <= 0) throw new Error('disconnect observation timeout');
    await assertTimeout(Promise.resolve(input.socket.send({ kind: 'online-projection-request-v1', protocolVersion: PROTOCOL_VERSION, roomId: input.roomId, participantId: input.observerParticipantId, participantCapability: input.observerParticipantCapability, knownRevision: 4, clientBuildId: CLIENT_BUILD_ID, decisionContext: null })), responseRemaining, 'P2 disconnect observation send', input.runtime);
    const snapshotRemaining = deadline - input.runtime.now();
    if (snapshotRemaining <= 0) throw new Error('disconnect observation timeout');
    const snapshot = await receiveMatching(input.socket, (value) => own(value, 'kind') === 'online-projected-snapshot-v1' && own(value, 'revision') === 4, snapshotRemaining, input.fragments, 'P2 disconnect observation', input.runtime, (value) => isO4p06fRevisionNoticeAtMostV1(value, input.roomId, 4));
    const projection = projectionFrom(snapshot, input.fragments, 'P2 disconnect observation projection invalid');
    assertNoHiddenOpponentIdentity(projection, input.ownPlayerId);
    if (inspectO4p06fParticipantPresenceV1(projection, input.targetParticipantId, input.targetExpectedSeatIndex) === 'disconnected') return;
  }
  throw new Error('P2 disconnect observation exhausted');
}

function assertPlayerConceded(projection: RecordV1, playerId: string): void {
  const room = asRecord(own(projection, 'room'), 'projection room missing');
  const seats = own(room, 'seats');
  if (!Array.isArray(seats)) throw new Error('projection seats missing');
  const seat = (seats as readonly unknown[]).find((entry) => record(entry) && own(entry, 'corePlayerId') === playerId);
  if (!record(seat) || own(seat, 'outcome') !== 'conceded') throw new Error('player exit outcome missing');
}

async function receiveMatching(socket: O4p06fSocketV1, predicate: (value: RecordV1) => boolean, timeoutMs: number, fragments: readonly string[], label: string, runtime: TimeoutRuntimeV1, allow?: (value: RecordV1) => boolean): Promise<RecordV1> {
  const deadline = runtime.now() + timeoutMs;
  for (;;) {
    const remaining = Math.max(1, deadline - runtime.now());
    const value = await assertTimeout(Promise.resolve(socket.next(remaining)), remaining, label, runtime);
    assertSecretFree(value, fragments);
    const current = asRecord(value, label);
    if (predicate(current)) return current;
    if (allow?.(current) === true) continue;
    throw new Error(`${label} unexpected frame`);
  }
}

export function isO4p06fRevisionNoticeAtMostV1(input: unknown, roomId: string, expectedRevision: number): boolean {
  try {
    if (typeof roomId !== 'string' || roomId.length === 0 || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return false;
    const value = exactKeys(input, ['kind', 'roomId', 'revision', 'schemaVersion'], 'revision notice malformed');
    const noticeRevision = own(value, 'revision');
    return own(value, 'kind') === 'online-cloudflare-revision-v1'
      && own(value, 'schemaVersion') === 1
      && own(value, 'roomId') === roomId
      && typeof noticeRevision === 'number'
      && Number.isSafeInteger(noticeRevision)
      && !Object.is(noticeRevision, -0)
      && noticeRevision >= 0
      && noticeRevision <= expectedRevision;
  } catch {
    return false;
  }
}

async function drainQueuedRevisionNotices(socket: O4p06fSocketV1, roomId: string, expectedRevision: number, timeoutMs: number, fragments: readonly string[], runtime: TimeoutRuntimeV1): Promise<void> {
  const deadline = runtime.now() + timeoutMs;
  for (let drained = 0; drained < MAX_QUEUED_REVISION_NOTICES; drained += 1) {
    const remaining = deadline - runtime.now();
    if (remaining <= 0) throw new Error('revision queue timeout');
    const pending = await assertTimeout(socket.pendingCount(), remaining, 'revision queue count', runtime);
    if (!Number.isSafeInteger(pending) || pending < 0 || pending > MAX_QUEUED_REVISION_NOTICES) throw new Error('revision queue invalid');
    if (pending === 0) return;
    const nextRemaining = deadline - runtime.now();
    if (nextRemaining <= 0) throw new Error('revision queue timeout');
    const value = await assertTimeout(socket.next(nextRemaining), nextRemaining, 'revision queue drain', runtime);
    assertSecretFree(value, fragments);
    const current = asRecord(value, 'revision queue frame');
    if (!isO4p06fRevisionNoticeAtMostV1(current, roomId, expectedRevision)) throw new Error('revision queue unexpected frame');
  }
  const remaining = deadline - runtime.now();
  if (remaining > 0 && await assertTimeout(socket.pendingCount(), remaining, 'revision queue final count', runtime) === 0) return;
  throw new Error('revision queue exhausted');
}

async function openParticipantSocket(page: O4p06fPageV1, url: string, roomId: string, participantId: string, participantCapability: string, role: 'player' | 'table', fragments: readonly string[], timeoutMs: number, knownRevision: number, runtime: TimeoutRuntimeV1, trackSocket: (socket: O4p06fSocketV1) => void): Promise<{ readonly socket: O4p06fSocketV1; readonly projection: RecordV1; readonly reason: string; readonly snapshotCount: number }> {
  const socket = await assertTimeout(page.openWebSocket(url), timeoutMs, 'socket open', runtime);
  trackSocket(socket);
  await receiveMatching(socket, (value) => own(value, 'kind') === 'online-cloudflare-websocket-ready-v1', timeoutMs, fragments, 'socket ready', runtime);
  await socket.send({ kind: 'online-client-hello-v1', protocolVersion: PROTOCOL_VERSION, roomId, participantId, participantCapability, clientBuildId: CLIENT_BUILD_ID });
  const hello = await receiveMatching(socket, (value) => own(value, 'kind') === 'online-server-hello-v1', timeoutMs, fragments, 'socket hello', runtime);
  exactString(hello, 'status', 'accepted', 'socket hello rejected');
  if (own(hello, 'participantId') !== participantId || own(hello, 'roomId') !== roomId || own(hello, 'role') !== role) throw new Error('socket audience mismatch');
  await socket.send({ kind: 'online-projection-request-v1', protocolVersion: PROTOCOL_VERSION, roomId, participantId, participantCapability, knownRevision, clientBuildId: CLIENT_BUILD_ID, decisionContext: null });
  const snapshot = await receiveMatching(socket, (value) => own(value, 'kind') === 'online-projected-snapshot-v1', timeoutMs, fragments, 'initial projection', runtime);
  const snapshotCount = 1;
  if (typeof own(snapshot, 'revision') !== 'number' || (knownRevision > 0 && (own(snapshot, 'revision') as number) < knownRevision)) throw new Error('stale projection snapshot');
  const reason = own(snapshot, 'reason');
  if (typeof reason !== 'string') throw new Error('projection resync reason missing');
  return Object.freeze({ socket, projection: projectionFrom(snapshot, fragments, 'invalid initial projection'), reason, snapshotCount });
}

function createTabletopCommand(sequence: number, playerId: typeof CORE_PLAYERS[number], payload: RecordV1): RecordV1 {
  return Object.freeze({ kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence, actorPlayerId: playerId, decisionMakerPlayerId: playerId, decisionContext: { kind: 'decision', decisionKey: 'tabletop' }, payload });
}

function safeVersion(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function validatePlatformEvidence(value: unknown, roomCorrelationId: string, fragments: readonly string[]): O4p06fPlatformEvidenceV1 {
  assertSecretFree(value, fragments);
  const root = exactKeys(value, ['roomCorrelationId', 'preDeploymentVersionIdentifier', 'postDeploymentVersionIdentifier', 'checkpointRevision', 'currentRevision', 'replayCount', 'outcome', 'errorCount', 'exceptionCount', 'parseFailureCount', 'secretViolationCount'], 'invalid platform evidence');
  const preDeploymentVersionIdentifier = own(root, 'preDeploymentVersionIdentifier');
  const postDeploymentVersionIdentifier = own(root, 'postDeploymentVersionIdentifier');
  if (own(root, 'roomCorrelationId') !== roomCorrelationId || !safeVersion(preDeploymentVersionIdentifier) || !safeVersion(postDeploymentVersionIdentifier) || preDeploymentVersionIdentifier === postDeploymentVersionIdentifier) throw new Error('invalid deployment version evidence');
  if (own(root, 'checkpointRevision') !== 0 || own(root, 'currentRevision') !== 5 || own(root, 'replayCount') !== 5 || own(root, 'outcome') !== 'ok' || own(root, 'errorCount') !== 0 || own(root, 'exceptionCount') !== 0 || own(root, 'parseFailureCount') !== 0 || own(root, 'secretViolationCount') !== 0) throw new Error('invalid recovery evidence');
  return Object.freeze({ roomCorrelationId, preDeploymentVersionIdentifier, postDeploymentVersionIdentifier, checkpointRevision: 0, currentRevision: 5, replayCount: 5, outcome: 'ok', errorCount: 0, exceptionCount: 0, parseFailureCount: 0, secretViolationCount: 0 });
}

function deckInputs(readDeck: (path: string) => string): Readonly<{ readonly texts: readonly string[]; readonly facts: readonly O4p06fDeckFactV1[] }> {
  const texts = Object.freeze(DECK_PATHS.map((path) => readDeck(path)));
  const facts = Object.freeze(DECK_LABELS.map((label, index) => {
    const path = DECK_PATHS[index] as string;
    const bytes = texts[index];
    return Object.freeze({ label, path, sha256: sha256(bytes), byteCount: new TextEncoder().encode(bytes).byteLength });
  }));
  return Object.freeze({ texts, facts });
}

function validateSummaryRoot(value: RecordV1): void {
  const expected = ['kind', 'schemaVersion', 'pagesOrigin', 'workerOrigin', 'chromeVersion', 'contextCount', 'decks', 'publicAssetHashes', 'httpStatuses', 'revision', 'acceptedCommandCount', 'actionKindCounts', 'reconnect', 'preDeploymentVersionIdentifiers', 'postDeploymentVersionIdentifiers', 'preDeploymentProjectionHashes', 'postDeploymentProjectionHashes', 'recoveryFacts', 'consoleCounts', 'cleanup'];
  const names = Object.keys(value).sort();
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string')) throw new Error('summary symbol key');
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor === undefined || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new Error('summary accessor');
  }
  if (names.length !== expected.length || names.some((name, index) => name !== [...expected].sort()[index])) throw new Error('invalid summary fields');
  if (own(value, 'kind') !== 'o4p-06f-four-browser-production-evidence-v1' || own(value, 'schemaVersion') !== 1 || own(value, 'pagesOrigin') !== O4P06F_PAGES_ORIGIN_V1 || own(value, 'workerOrigin') !== O4P06F_WORKER_ORIGIN_V1 || own(value, 'contextCount') !== 4 || own(value, 'revision') !== 5 || own(value, 'acceptedCommandCount') !== 5) throw new Error('invalid summary root');
  if (!isSafeString(own(value, 'chromeVersion'), /^.{1,256}$/u)) throw new Error('invalid Chrome version');
  if (new TextEncoder().encode(canonicalString(value)).byteLength > MAX_SUMMARY_BYTES) throw new Error('summary too large');
}

function exactKeys(value: unknown, expected: readonly string[], label: string): RecordV1 {
  if (!record(value)) throw new Error(label);
  const names = Reflect.ownKeys(value);
  if (names.length !== expected.length || names.some((key) => typeof key !== 'string' || !expected.includes(key))) throw new Error(label);
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new Error(label);
  }
  return value;
}

export function validateO4p06fEvidenceSummaryV1(input: unknown): Readonly<{ readonly ok: true; readonly value: O4p06fEvidenceSummaryV1 } | { readonly ok: false; readonly issues: readonly string[] }> {
  try {
    if (!record(input)) return Object.freeze({ ok: false as const, issues: Object.freeze(['invalid summary record']) });
    if (containsCapabilityLikeString(input)) throw new Error('secret-bearing summary');
    validateSummaryRoot(input);
    const normalized = JSON.parse(canonicalString(input)) as RecordV1;
    const decks = own(normalized, 'decks');
    if (!Array.isArray(decks) || decks.length !== 4 || decks.some((entry, index) => {
      const deck = exactKeys(entry, ['label', 'path', 'sha256', 'byteCount'], 'invalid deck facts');
      return own(deck, 'label') !== DECK_LABELS[index] || !isSafeString(own(deck, 'path'), /^Mydeck\/(?:Celes|Gogo|Kefka|Muldrotha)\.txt$/u) || !isSafeString(own(deck, 'sha256'), /^[0-9a-f]{64}$/u) || typeof own(deck, 'byteCount') !== 'number' || !Number.isSafeInteger(own(deck, 'byteCount')) || (own(deck, 'byteCount') as number) <= 0;
    })) throw new Error('invalid deck facts');
    const assetHashes = own(normalized, 'publicAssetHashes');
    if (!Array.isArray(assetHashes) || assetHashes.length === 0 || assetHashes.some((hash) => !isSafeString(hash, /^[0-9a-f]{64}$/u))) throw new Error('invalid asset hashes');
    const httpStatuses = own(normalized, 'httpStatuses');
    if (!Array.isArray(httpStatuses) || httpStatuses.length !== assetHashes.length + 4 || httpStatuses.some((status) => status !== 200)) throw new Error('invalid HTTP statuses');
    const actionKinds = asRecord(own(normalized, 'actionKindCounts'), 'invalid action counts');
    exactKeys(actionKinds, ['table-draw', 'player-exit'], 'invalid action counts');
    if (own(actionKinds, 'table-draw') !== 4 || own(actionKinds, 'player-exit') !== 1) throw new Error('invalid action counts');
    const preHashes = asRecord(own(normalized, 'preDeploymentProjectionHashes'), 'invalid pre-deployment hashes');
    const postHashes = asRecord(own(normalized, 'postDeploymentProjectionHashes'), 'invalid post-deployment hashes');
    const preHashKeys = Object.keys(preHashes).sort(); const postHashKeys = Object.keys(postHashes).sort();
    if (preHashKeys.length !== 4 || preHashKeys.join('|') !== postHashKeys.join('|') || preHashKeys.some((key, index) => key !== `audience-${String(index + 1)}`)) throw new Error('invalid projection hash keys');
    for (const key of preHashKeys) {
      const before = own(preHashes, key); const after = own(postHashes, key);
      if (!isSafeString(before, /^[0-9a-f]{64}$/u) || after !== before) throw new Error('projection hash mismatch');
    }
    const reconnect = asRecord(own(normalized, 'reconnect'), 'invalid reconnect facts');
    exactKeys(reconnect, ['participant', 'freshSocket', 'staleKnownRevision', 'snapshotCount', 'bounded'], 'invalid reconnect facts');
    if (own(reconnect, 'participant') !== 'P2' || own(reconnect, 'freshSocket') !== true || own(reconnect, 'staleKnownRevision') !== 2 || own(reconnect, 'snapshotCount') !== 1 || own(reconnect, 'bounded') !== true) throw new Error('invalid reconnect facts');
    const recovery = asRecord(own(normalized, 'recoveryFacts'), 'invalid recovery facts');
    exactKeys(recovery, ['checkpointRevision', 'currentRevision', 'replayCount', 'outcome', 'errorCount', 'exceptionCount', 'parseFailureCount', 'secretViolationCount'], 'invalid recovery facts');
    if (own(recovery, 'checkpointRevision') !== 0 || own(recovery, 'currentRevision') !== 5 || own(recovery, 'replayCount') !== 5 || own(recovery, 'outcome') !== 'ok' || own(recovery, 'errorCount') !== 0 || own(recovery, 'exceptionCount') !== 0 || own(recovery, 'parseFailureCount') !== 0 || own(recovery, 'secretViolationCount') !== 0) throw new Error('invalid recovery facts');
    const preVersions = own(normalized, 'preDeploymentVersionIdentifiers'); const postVersions = own(normalized, 'postDeploymentVersionIdentifiers');
    if (!Array.isArray(preVersions) || !Array.isArray(postVersions) || preVersions.length !== 1 || postVersions.length !== 1 || !safeVersion(preVersions[0]) || !safeVersion(postVersions[0]) || preVersions[0] === postVersions[0]) throw new Error('invalid deployment versions');
    const consoleCounts = exactKeys(own(normalized, 'consoleCounts'), ['errors', 'warnings'], 'invalid console counts');
    if (own(consoleCounts, 'errors') !== 0 || own(consoleCounts, 'warnings') !== 0) throw new Error('console errors/warnings present');
    const cleanup = exactKeys(own(normalized, 'cleanup'), ['targetsClosed', 'startupTargetsClosed', 'contextsClosed', 'socketsClosed', 'profileRemoved'], 'invalid cleanup facts');
    const startupTargetsClosed = own(cleanup, 'startupTargetsClosed');
    if ((startupTargetsClosed !== 0 && startupTargetsClosed !== 1) || own(cleanup, 'targetsClosed') !== 4 + startupTargetsClosed || own(cleanup, 'contextsClosed') !== 4 || own(cleanup, 'socketsClosed') !== 10 || own(cleanup, 'profileRemoved') !== true) throw new Error('invalid cleanup facts');
    return Object.freeze({ ok: true as const, value: freezeDeep(normalized) as O4p06fEvidenceSummaryV1 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'invalid evidence summary';
    return Object.freeze({ ok: false as const, issues: Object.freeze([message]) });
  }
}

type CdpMessageV1 = Readonly<{ readonly id?: number; readonly method?: string; readonly params?: RecordV1; readonly result?: unknown; readonly error?: unknown; readonly sessionId?: string }>;
type BrowserWebSocketV1 = { addEventListener: (type: string, listener: (event: { readonly data?: unknown }) => void) => void; send: (data: string) => void; close: () => void };

class CdpConnectionV1 {
  private readonly socket: BrowserWebSocketV1;
  private sequence = 0;
  private readonly pending = new Map<number, { readonly resolve: (value: CdpMessageV1) => void; readonly reject: (error: Error) => void }>();
  private readonly eventListeners = new Set<(value: CdpMessageV1) => void>();
  private readonly timeoutMs: number;

  private constructor(socket: BrowserWebSocketV1, timeoutMs: number) {
    this.socket = socket; this.timeoutMs = timeoutMs;
    socket.addEventListener('message', (event) => {
      try {
        const raw = String(event.data);
        if (new TextEncoder().encode(raw).byteLength > MAX_WS_FRAME_BYTES) throw new Error('CDP frame too large');
        const value = JSON.parse(raw) as CdpMessageV1;
        normalizeJson(value);
        if (typeof value.id !== 'number') { for (const listener of this.eventListeners) listener(value); return; }
        const waiter = this.pending.get(value.id);
        if (waiter === undefined) return;
        this.pending.delete(value.id);
        if (value.error !== undefined) waiter.reject(new Error('CDP command failed'));
        else waiter.resolve(value);
      } catch {
        for (const waiter of this.pending.values()) waiter.reject(new Error('CDP response invalid'));
        this.pending.clear();
      }
    });
  }

  onEvent(listener: (value: CdpMessageV1) => void): void { this.eventListeners.add(listener); }

  static async connect(endpoint: string, timeoutMs: number): Promise<CdpConnectionV1> {
    const WebSocketCtor = (globalThis as typeof globalThis & { readonly WebSocket?: new (url: string) => BrowserWebSocketV1 }).WebSocket;
    if (WebSocketCtor === undefined) throw new Error('system WebSocket unavailable');
    const socket = new WebSocketCtor(endpoint);
    await assertTimeout(new Promise<void>((resolvePromise, reject) => {
      socket.addEventListener('open', () => resolvePromise());
      socket.addEventListener('error', () => reject(new Error('CDP socket error')));
    }), timeoutMs, 'CDP connect');
    return new CdpConnectionV1(socket, timeoutMs);
  }

  async command(method: string, params: RecordV1 = {}, sessionId?: string): Promise<CdpMessageV1> {
    const id = ++this.sequence;
    const value = sessionId === undefined ? { id, method, params } : { id, method, params, sessionId };
    this.socket.send(JSON.stringify(value));
    return new Promise<CdpMessageV1>((resolvePromise, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP command timeout')); }, this.timeoutMs);
      this.pending.set(id, { resolve: (message) => { clearTimeout(timer); resolvePromise(message); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    });
  }

  close(): void { this.socket.close(); }
}

class CdpPageV1 implements O4p06fPageV1 {
  private readonly connection: CdpConnectionV1;
  private readonly sessionId: string;
  private readonly targetId: string;
  private readonly timeoutMs: number;
  private readonly onClosed: () => void;
  private consoleErrorCount = 0;
  private consoleWarningCount = 0;
  private consoleSecretViolationCount = 0;
  private secretFragments: readonly string[] = [];

  constructor(connection: CdpConnectionV1, sessionId: string, targetId: string, timeoutMs: number, onClosed: () => void) {
    this.connection = connection; this.sessionId = sessionId; this.targetId = targetId; this.timeoutMs = timeoutMs; this.onClosed = onClosed;
    this.connection.onEvent((event) => {
      if (event.sessionId !== this.sessionId) return;
      if (event.method === 'Runtime.consoleAPICalled') {
        const params = event.params;
        const type = params === undefined ? undefined : own(params, 'type');
        if (params !== undefined && (containsCapabilityLikeString(params) || containsCapabilityFragment(params, this.secretFragments))) this.consoleSecretViolationCount += 1;
        if (type === 'error') this.consoleErrorCount += 1;
        if (type === 'warning' || type === 'warn') this.consoleWarningCount += 1;
      }
      if (event.method === 'Runtime.exceptionThrown') { this.consoleErrorCount += 1; if (event.params !== undefined && (containsCapabilityLikeString(event.params) || containsCapabilityFragment(event.params, this.secretFragments))) this.consoleSecretViolationCount += 1; }
    });
  }

  setSecretFragments(fragments: readonly string[]): void { this.secretFragments = fragments; }

  async navigate(url: string): Promise<void> {
    await this.connection.command('Page.enable', {}, this.sessionId);
    await this.connection.command('Runtime.enable', {}, this.sessionId);
    await this.connection.command('Page.navigate', { url }, this.sessionId);
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 250));
    await this.evaluate('new Promise((resolve) => { if (document.readyState === "complete") resolve(true); else window.addEventListener("load", () => resolve(true), { once: true }); })');
    await this.evaluate(`(() => {
      const state = window.__o4p06f ?? { errors: 0, warnings: 0, sockets: new Map(), nextSocket: 0 };
      window.__o4p06f = state;
      const originalError = console.error.bind(console); const originalWarn = console.warn.bind(console);
      console.error = (...args) => { state.errors += 1; originalError(...args); };
      console.warn = (...args) => { state.warnings += 1; originalWarn(...args); };
      return true;
    })()`);
    try {
      await this.evaluate(`(() => {
        const open = document.querySelector('[data-testid="open-online-mode"]');
        if (!(open instanceof HTMLElement)) throw new Error('public Online entry missing');
        open.click();
        return true;
      })()`);
    } catch { throw new Error('public Online entry activation failed'); }
    let controls: Readonly<{ readonly online: boolean; readonly lobby: boolean; readonly create: boolean; readonly join: boolean; readonly deck: boolean; readonly ready: boolean; readonly start: boolean; readonly href: string; readonly origin: string }>;
    try { controls = await this.evaluate(`new Promise((resolve) => {
      const deadline = Date.now() + 5_000;
      const inspect = () => {
        const value = { online: document.querySelector('[data-testid="public-online-app"]') !== null,
          lobby: document.querySelector('[data-testid="online-room-summary"]') !== null || document.querySelector('[data-testid="online-create-room"]') !== null,
          create: document.querySelector('[data-testid="online-create-room"]') !== null,
          join: document.querySelector('[data-testid="online-join-room"]') !== null,
          deck: document.querySelector('[data-testid="online-deck-select"]') !== null,
          ready: document.querySelector('[data-testid="online-ready-toggle"]') !== null,
          start: document.querySelector('[data-testid="online-start-game"]') !== null, href: location.href, origin: location.origin };
        if (value.online && value.lobby && value.create && value.join && value.deck && value.ready && value.start) resolve(value);
        else if (Date.now() >= deadline) resolve(value);
        else setTimeout(inspect, 25);
      };
      inspect();
    })`); } catch { throw new Error('public Online controls wait failed'); }
    const missingControls = (['online', 'lobby', 'create', 'join', 'deck', 'ready', 'start'] as const).filter((key) => !controls[key]);
    if (missingControls.length > 0 || controls.href !== url || controls.origin !== new URL(url).origin) throw new Error(`public Online controls/document mismatch: ${missingControls.join(',') || 'location'}`);
  }

  async evaluate<T>(expression: string, argument?: unknown): Promise<T> {
    let argumentLiteral = 'undefined';
    if (argument !== undefined) {
      try { argumentLiteral = JSON.stringify(argument); } catch { throw new Error('browser evaluation argument invalid'); }
    }
    const params: RecordV1 = { expression: `(async () => { const argument = ${argumentLiteral}; return (${expression}); })()`, awaitPromise: true, returnByValue: true, userGesture: true, replMode: false };
    const response = await this.connection.command('Runtime.evaluate', params, this.sessionId);
    const result = asRecord(response.result, 'CDP result missing');
    const exception = own(result, 'exceptionDetails');
    if (exception !== undefined) throw new Error('browser evaluation failed');
    const remote = asRecord(own(result, 'result'), 'CDP remote result missing');
    return own(remote, 'value') as T;
  }

  async fetch(url: string, init?: Readonly<{ readonly method?: string; readonly headers?: Readonly<Record<string, string>>; readonly body?: string }>): Promise<O4p06fResponseV1> {
    const result = await this.evaluate<{ readonly status: number; readonly body: unknown }>(`(async (input) => {
      const response = await fetch(input.url, { method: input.method, headers: input.headers, body: input.body });
      const reader = response.body?.getReader(); const chunks = []; let total = 0;
      if (reader) { for (;;) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > ${String(MAX_HTTP_BODY_BYTES)}) throw new Error('HTTP body too large'); chunks.push(part.value); } }
      const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return { status: response.status, body: new TextDecoder().decode(bytes) };
    })(argument)`, { url, ...(init ?? {}) });
    return Object.freeze({ status: result.status, text: () => Promise.resolve(String(result.body)), json: () => Promise.resolve(JSON.parse(String(result.body))) });
  }

  async openWebSocket(url: string): Promise<O4p06fSocketV1> {
    const id = await this.evaluate<number>(`(() => {
      const state = window.__o4p06f; if (!state) throw new Error('helper missing');
      const socket = new WebSocket(argument); const socketId = ++state.nextSocket;
      const queue = []; const waiters = []; let closed = false;
      socket.addEventListener('message', (event) => { try { const raw = String(event.data); if (new TextEncoder().encode(raw).byteLength > ${String(MAX_WS_FRAME_BYTES)}) throw new Error('frame too large'); const value = JSON.parse(raw); const waiter = waiters.shift(); if (waiter) waiter(value); else queue.push(value); } catch { const waiter = waiters.shift(); if (waiter) waiter({ kind: '__o4p06f-invalid-frame' }); else queue.push({ kind: '__o4p06f-invalid-frame' }); } });
      socket.addEventListener('close', () => { closed = true; while (waiters.length) waiters.shift()(null); });
      state.sockets.set(socketId, { socket, queue, waiters, get closed() { return closed; } });
      return socketId;
    })()`, url);
    const send = async (value: unknown): Promise<void> => { await this.evaluate(`(() => { const item = window.__o4p06f.sockets.get(argument.id); if (!item || item.closed) throw new Error('socket closed'); item.socket.send(JSON.stringify(argument.value)); })()`, { id, value }); };
    const next = async (timeoutMs = this.timeoutMs): Promise<unknown> => await this.evaluate(`(async () => {
      const item = window.__o4p06f.sockets.get(argument.id); if (!item) throw new Error('socket missing');
      if (item.queue.length) return item.queue.shift();
      return await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('socket timeout')), argument.timeout); item.waiters.push((value) => { clearTimeout(timer); resolve(value); }); });
    })()`, { id, timeout: timeoutMs });
    const close = async (): Promise<void> => { await this.evaluate(`(() => { const item = window.__o4p06f.sockets.get(argument); if (item) { item.socket.close(); window.__o4p06f.sockets.delete(argument); } })()`, id); };
    const pendingCount = (): Promise<number> => this.evaluate<number>(`(() => { const item = window.__o4p06f.sockets.get(argument); return item ? item.queue.length : 0; })()`, id);
    return Object.freeze({ send, next, close, pendingCount });
  }

  consoleCounts(): Readonly<{ readonly errors: number; readonly warnings: number; readonly secretViolations: number }> { return Object.freeze({ errors: this.consoleErrorCount, warnings: this.consoleWarningCount, secretViolations: this.consoleSecretViolationCount }); }
  async assetFacts(): Promise<Readonly<{ readonly href: string; readonly origin: string; readonly statuses: readonly number[]; readonly hashes: readonly string[] }>> {
    return this.evaluate(`(async () => {
      const href = location.href; const origin = location.origin;
      const urls = [href, ...[...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map((node) => node instanceof HTMLScriptElement ? node.src : node instanceof HTMLLinkElement ? node.href : '').filter((value) => value.startsWith(origin + '/'))];
      const rows = await Promise.all(urls.map(async (url) => { const response = await fetch(url); const reader = response.body?.getReader(); if (!reader) throw new Error('asset body missing'); const chunks = []; let total = 0; for (;;) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > ${String(MAX_HTTP_BODY_BYTES)}) throw new Error('asset too large'); chunks.push(part.value); } if (total === 0) throw new Error('asset body empty'); const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } const digest = await crypto.subtle.digest('SHA-256', bytes); const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); return { status: response.status, hash }; }));
      return { href, origin, statuses: rows.map((row) => row.status), hashes: rows.map((row) => row.hash) };
    })()`);
  }
  async close(): Promise<void> {
    const response = await this.connection.command('Target.closeTarget', { targetId: this.targetId });
    const result = asRecord(response.result, 'target close result missing');
    if (own(result, 'success') !== true) throw new Error('target close failed');
    this.onClosed();
  }
}

class CdpBrowserV1 implements O4p06fBrowserV1 {
  readonly chromeVersion: string;
  readonly startupTargetsClosed: number;
  readonly profilePath: string;
  private readonly connection: CdpConnectionV1;
  private readonly timeoutMs: number;
  private readonly child: ReturnType<typeof spawn>;
  private readonly contextIds = new Set<string>();
  private readonly targetIds = new Set<string>();
  private readonly sessionIds = new Set<string>();
  private constructor(connection: CdpConnectionV1, chromeVersion: string, profilePath: string, timeoutMs: number, child: ReturnType<typeof spawn>, startupTargetsClosed: number) { this.connection = connection; this.chromeVersion = chromeVersion; this.profilePath = profilePath; this.timeoutMs = timeoutMs; this.child = child; this.startupTargetsClosed = startupTargetsClosed; }

  static async launch(timeoutMs: number): Promise<CdpBrowserV1> {
    const profilePath = mkdtempSync(join(tmpdir(), 'o4p06f-chrome-'));
    const chromeBinary = process.env.O4P06F_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const child = spawn(chromeBinary, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-startup-window', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profilePath}`], { stdio: ['ignore', 'ignore', 'pipe'] });
    try {
    const stderr = child.stderr;
    if (stderr === null) throw new Error('Chrome launch failed');
    const port = await assertTimeout(new Promise<number>((resolvePort, reject) => {
      let data = '';
      const timer = setTimeout(() => reject(new Error('Chrome launch timeout')), timeoutMs);
      stderr.on('data', (chunk: Buffer) => { data += chunk.toString('utf8'); const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(data); if (match !== null) { clearTimeout(timer); resolvePort(Number(match[1])); } });
      child.once('error', () => { clearTimeout(timer); reject(new Error('Chrome launch failed')); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Chrome exited before CDP')); });
    }), timeoutMs, 'Chrome launch');
    const endpointUrl = `http://127.0.0.1:${String(port)}/json/version`;
    let versionResponse: Response | null = null;
    const endpointDeadline = Date.now() + timeoutMs;
    while (versionResponse === null && Date.now() < endpointDeadline) {
      try { const candidate = await fetch(endpointUrl, { signal: AbortSignal.timeout(Math.max(1, endpointDeadline - Date.now())) }); if (candidate.ok) versionResponse = candidate; }
      catch { await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 25)); }
    }
    if (versionResponse === null) throw new Error('CDP endpoint unavailable');
    const version = await versionResponse.json() as RecordV1;
    const endpoint = own(version, 'webSocketDebuggerUrl');
    if (typeof endpoint !== 'string') throw new Error('CDP endpoint missing');
    const connection = await CdpConnectionV1.connect(endpoint, timeoutMs);
    const browserVersion = own(version, 'Browser');
    if (typeof browserVersion !== 'string' || browserVersion.length === 0) throw new Error('Chrome version missing');
    const targetsResponse = await connection.command('Target.getTargets');
    const targets = own(asRecord(targetsResponse.result, 'target list missing'), 'targetInfos');
    if (!Array.isArray(targets)) throw new Error('target list malformed');
    canonicalString(targets);
    let startupTargetsClosed = 0;
    for (const target of targets) {
      const targetInfo = asRecord(target, 'target info malformed');
      const targetType = own(targetInfo, 'type');
      if (typeof targetType !== 'string') throw new Error('target type malformed');
      if (targetType !== 'page') continue;
      const targetId = own(targetInfo, 'targetId'); if (typeof targetId !== 'string' || targetId.length === 0) throw new Error('target id malformed');
      const closed = await connection.command('Target.closeTarget', { targetId });
      const closeResult = asRecord(closed.result, 'startup target close result missing');
      if (own(closeResult, 'success') !== true) throw new Error('startup target close failed');
      startupTargetsClosed += 1;
    }
    return new CdpBrowserV1(connection, browserVersion, profilePath, timeoutMs, child, startupTargetsClosed);
    } catch (error: unknown) {
      if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
        try { child.kill('SIGTERM'); } catch { /* continue to bounded exit observation */ }
        try {
          await assertTimeout(new Promise<void>((resolvePromise) => {
            if (child.exitCode !== null || child.signalCode !== null) resolvePromise();
            else child.once('exit', () => resolvePromise());
          }), timeoutMs, 'Chrome launch cleanup');
        } catch {
          try { child.kill('SIGKILL'); } catch { /* fail closed below */ }
          await assertTimeout(new Promise<void>((resolvePromise) => child.once('exit', () => resolvePromise())), timeoutMs, 'Chrome launch force cleanup');
        }
      }
      try { rmSync(profilePath, { recursive: true, force: true }); } catch { /* launch cleanup is best effort */ }
      throw error;
    }
  }

  async createBrowserContext(): Promise<O4p06fContextV1> {
    const created = await this.connection.command('Target.createBrowserContext', { disposeOnDetach: true });
    const result = asRecord(created.result, 'browser context missing');
    const browserContextId = own(result, 'browserContextId');
    if (typeof browserContextId !== 'string' || browserContextId.length === 0 || this.contextIds.has(browserContextId)) throw new Error('browser context id missing or duplicate');
    this.contextIds.add(browserContextId);
    let targetId: string | null = null;
    let sessionId: string | null = null;
    try {
      const create = await this.connection.command('Target.createTarget', { url: 'about:blank', browserContextId });
      const rawTargetId = own(asRecord(create.result, 'target missing'), 'targetId');
      if (typeof rawTargetId !== 'string' || rawTargetId.length === 0 || this.targetIds.has(rawTargetId)) throw new Error('target id missing or duplicate');
      targetId = rawTargetId;
      this.targetIds.add(targetId);
      const attach = await this.connection.command('Target.attachToTarget', { targetId, flatten: true });
      const rawSessionId = own(asRecord(attach.result, 'session missing'), 'sessionId');
      if (typeof rawSessionId !== 'string' || rawSessionId.length === 0 || this.sessionIds.has(rawSessionId)) throw new Error('session id missing or duplicate');
      sessionId = rawSessionId;
      this.sessionIds.add(sessionId);
      const page = new CdpPageV1(this.connection, sessionId, targetId, this.timeoutMs, () => { this.targetIds.delete(targetId as string); this.sessionIds.delete(sessionId as string); });
      return Object.freeze({ browserContextId, createPage: () => Promise.resolve(page), close: async () => { await this.connection.command('Target.disposeBrowserContext', { browserContextId }); this.contextIds.delete(browserContextId); } });
    } catch (error: unknown) {
      if (targetId !== null) {
        try { await this.connection.command('Target.closeTarget', { targetId }); } catch { /* context disposal remains authoritative cleanup */ }
        this.targetIds.delete(targetId);
      }
      if (sessionId !== null) this.sessionIds.delete(sessionId);
      try { await this.connection.command('Target.disposeBrowserContext', { browserContextId }); } finally { this.contextIds.delete(browserContextId); }
      throw error;
    }
  }

  async close(): Promise<void> {
    this.connection.close();
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill('SIGTERM');
      await assertTimeout(new Promise<void>((resolvePromise) => this.child.once('exit', () => resolvePromise())), this.timeoutMs, 'Chrome shutdown');
    }
    rmSync(this.profilePath, { recursive: true, force: true });
  }
}

function defaultDeps(input: O4p06fEvidenceDepsV1): O4p06fEvidenceDepsV1 {
  return Object.freeze({
    ...input,
    launchBrowser: input.launchBrowser ?? (() => CdpBrowserV1.launch(input.timeoutMs ?? DEFAULT_TIMEOUT_MS)),
    readDeck: input.readDeck ?? ((path) => { const absolute = resolve(process.cwd(), path); return readFileSync(absolute, 'utf8'); }),
  });
}

export async function runO4p06fFourBrowserEvidenceV1(input: O4p06fEvidenceDepsV1 = {}): Promise<O4p06fEvidenceSummaryV1> {
  const deps = defaultDeps(input);
  const pagesOrigin = deps.pagesOrigin ?? O4P06F_PAGES_ORIGIN_V1;
  const workerOrigin = deps.workerOrigin ?? O4P06F_WORKER_ORIGIN_V1;
  if (pagesOrigin !== O4P06F_PAGES_ORIGIN_V1 || workerOrigin !== O4P06F_WORKER_ORIGIN_V1) throw new Error('production origins are fixed');
  if (deps.barrier === undefined || deps.observePlatformEvidence === undefined) throw new Error('operator barrier and platform evidence are required');
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutRuntime: TimeoutRuntimeV1 = { now: deps.now ?? (() => Date.now()), schedule: deps.schedule ?? ((milliseconds, task) => setTimeout(task, milliseconds)), cancel: deps.cancelSchedule ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)) };
  const readDeck = deps.readDeck ?? ((path) => { throw new Error(`missing deck ${path}`); });
  const deckInput = deckInputs(readDeck);
  const decks = deckInput.facts;
  const capabilities: string[] = [];
  const sockets: O4p06fSocketV1[] = [];
  const allSockets = new Set<O4p06fSocketV1>();
  const contexts: O4p06fContextV1[] = [];
  const pages: O4p06fPageV1[] = [];
  let browser: O4p06fBrowserV1 | null = deps.browser ?? null;
  let cleanupComplete = false;
  let cleanupReport: Readonly<{ readonly targetsClosed: number; readonly startupTargetsClosed: number; readonly contextsClosed: number; readonly socketsClosed: number; readonly profileRemoved: boolean }> = Object.freeze({ targetsClosed: 0, startupTargetsClosed: 0, contextsClosed: 0, socketsClosed: 0, profileRemoved: false });
  const cleanupResources = async (): Promise<void> => {
    if (cleanupComplete) return;
    let targetsClosed = 0; let contextsClosed = 0; let socketsClosed = 0; let profileRemoved = browser?.profilePath === undefined;
    for (const socket of allSockets) { try { await assertTimeout(Promise.resolve(socket.close()), timeoutMs, 'socket cleanup', timeoutRuntime); socketsClosed += 1; } catch { /* continue bounded cleanup */ } }
    for (const page of pages) { try { await assertTimeout(Promise.resolve(page.close()), timeoutMs, 'target cleanup', timeoutRuntime); targetsClosed += 1; } catch { /* continue bounded cleanup */ } }
    for (const context of contexts) { try { await assertTimeout(Promise.resolve(context.close()), timeoutMs, 'context cleanup', timeoutRuntime); contextsClosed += 1; } catch { /* continue bounded cleanup */ } }
    let browserClosed = browser === null;
    if (browser !== null) { try { await assertTimeout(Promise.resolve(browser.close()), timeoutMs, 'browser cleanup', timeoutRuntime); browserClosed = true; } catch { /* continue bounded cleanup */ } }
    if (browser?.profilePath !== undefined) { try { await assertTimeout(Promise.resolve().then(() => rmSync(browser?.profilePath as string, { recursive: true, force: true })), timeoutMs, 'profile cleanup', timeoutRuntime); profileRemoved = true; } catch { profileRemoved = false; } }
    const startupTargetsClosed = browser?.startupTargetsClosed ?? 0;
    cleanupReport = Object.freeze({ targetsClosed: targetsClosed + startupTargetsClosed, startupTargetsClosed, contextsClosed, socketsClosed, profileRemoved });
    cleanupComplete = true;
    if (targetsClosed + startupTargetsClosed !== pages.length + startupTargetsClosed || contextsClosed !== contexts.length || socketsClosed !== allSockets.size || !profileRemoved || !browserClosed) throw new Error('cleanup failed');
  };
  try {
    browser = browser ?? await assertTimeout((deps.launchBrowser ?? (() => Promise.reject(new Error('browser launcher unavailable'))))(), timeoutMs, 'Chrome launch', timeoutRuntime);
    for (let index = 0; index < CONTEXT_COUNT; index += 1) {
      const context = await assertTimeout(browser.createBrowserContext(), timeoutMs, 'browser context', timeoutRuntime);
      contexts.push(context);
      const page = await assertTimeout(context.createPage(), timeoutMs, 'browser page', timeoutRuntime);
      pages.push(page);
      await assertTimeout(page.navigate(pagesOrigin), timeoutMs, 'Pages load', timeoutRuntime);
    }
    if (contexts.length !== CONTEXT_COUNT || new Set(contexts.map((context) => context.browserContextId)).size !== CONTEXT_COUNT) throw new Error('four distinct browser contexts required');
    const assetFacts = pages[0].assetFacts === undefined ? null : await assertTimeout(pages[0].assetFacts(), timeoutMs, 'Pages asset evidence', timeoutRuntime);
    if (assetFacts === null || assetFacts.href !== pagesOrigin || assetFacts.origin !== new URL(pagesOrigin).origin || assetFacts.statuses.length === 0 || assetFacts.hashes.length === 0 || assetFacts.statuses.length !== assetFacts.hashes.length || assetFacts.statuses.some((status) => status !== 200) || assetFacts.hashes.some((hash) => !/^[0-9a-f]{64}$/u.test(hash))) throw new Error('Pages asset evidence incomplete');
    const hostParticipantId = runtimeIdentifier('host');
    const tableCapability = capability(); capabilities.push(tableCapability);
    for (let index = 0; index < 3; index += 1) { const invite = capability(); capabilities.push(invite); }
    const create = await requestJson(pages[0], `${workerOrigin}${ROOM_CREATE_PATH}`, { method: 'POST', body: JSON.stringify({ kind: 'online-forming-lobby-create-v1', schemaVersion: 1, participantId: hostParticipantId }) }, timeoutMs, timeoutRuntime);
    if (create.status < 200 || create.status >= 300) throw new Error('room create failed');
    const roomId = exactString(create.body, 'roomId', String(own(create.body, 'roomId')), 'room id missing');
    const createdSeatCapability = own(create.body, 'seatCapability'); const createdInvites = own(create.body, 'inviteCapabilities'); const createdTableId = own(create.body, 'tableParticipantId'); const createdTableCapability = own(create.body, 'tableCapability');
    if (typeof createdSeatCapability !== 'string' || !Array.isArray(createdInvites) || createdInvites.length !== 3 || typeof createdTableId !== 'string' || typeof createdTableCapability !== 'string' || (createdInvites as readonly unknown[]).some((entry) => typeof entry !== 'string')) throw new Error('room credential response invalid');
    const inviteValues = createdInvites as readonly string[];
    capabilities.splice(0, capabilities.length, createdSeatCapability, ...inviteValues, createdTableCapability);
    assertResponseSecretFree(create.body, allCapabilityFragments(capabilities), ['seatCapability', 'inviteCapabilities', 'tableCapability']);
    const playerCredentials = [{ participantId: hostParticipantId, seatCapability: createdSeatCapability }];
    for (let index = 1; index < CONTEXT_COUNT; index += 1) {
      const participantId = runtimeIdentifier(`player-${String(index + 1)}`);
      const claim = await requestJson(pages[index], `${workerOrigin}/api/online/rooms/${encodeURIComponent(roomId)}${ROOM_LOBBY_SUFFIX}`, { method: 'POST', body: JSON.stringify({ kind: 'online-forming-lobby-seat-claim-v1', schemaVersion: 1, participantId, inviteCapability: inviteValues[index - 1] }) }, timeoutMs, timeoutRuntime);
      const claimedSeatCapability = own(claim.body, 'seatCapability');
      if (claim.status < 200 || claim.status >= 300 || typeof claimedSeatCapability !== 'string') throw new Error('seat claim failed');
      assertResponseSecretFree(claim.body, allCapabilityFragments([...capabilities, claimedSeatCapability]), ['seatCapability']);
      capabilities.push(claimedSeatCapability);
      const currentFragments = allCapabilityFragments(capabilities);
      for (const page of pages) page.setSecretFragments?.(currentFragments);
      playerCredentials.push({ participantId, seatCapability: claimedSeatCapability });
    }
    const runtimeFragments = allCapabilityFragments(capabilities);
    for (const page of pages) page.setSecretFragments?.(runtimeFragments);
    for (let index = 0; index < CONTEXT_COUNT; index += 1) {
      const credential = playerCredentials[index]; const deck = decks[index];
      if (credential === undefined || deck === undefined) throw new Error('credential/deck mismatch');
      const submit = await requestJson(pages[index], `${workerOrigin}/api/online/rooms/${encodeURIComponent(roomId)}${ROOM_LOBBY_SUFFIX}`, { method: 'POST', body: JSON.stringify({ kind: 'online-forming-lobby-deck-submit-v1', schemaVersion: 1, participantId: credential.participantId, seatCapability: credential.seatCapability, deckId: deck.label, deckText: deckInput.texts[index] }) }, timeoutMs, timeoutRuntime);
      if (submit.status < 200 || submit.status >= 300) throw new Error('deck submit failed');
      assertSecretFree(submit.body, runtimeFragments);
      const ready = await requestJson(pages[index], `${workerOrigin}/api/online/rooms/${encodeURIComponent(roomId)}${ROOM_LOBBY_SUFFIX}`, { method: 'POST', body: JSON.stringify({ kind: 'online-forming-lobby-ready-v1', schemaVersion: 1, participantId: credential.participantId, seatCapability: credential.seatCapability, ready: true }) }, timeoutMs, timeoutRuntime);
      if (ready.status < 200 || ready.status >= 300) throw new Error('ready submit failed');
      assertSecretFree(ready.body, runtimeFragments);
    }
    const start = await requestJson(pages[0], `${workerOrigin}/api/online/rooms/${encodeURIComponent(roomId)}${ROOM_LOBBY_SUFFIX}`, { method: 'POST', body: JSON.stringify({ kind: 'online-forming-lobby-start-with-table-v1', schemaVersion: 1, hostParticipantId, seatCapability: playerCredentials[0]?.seatCapability, tableParticipantId: createdTableId, tableCapability: createdTableCapability }) }, timeoutMs, timeoutRuntime);
    const startStatus = asRecord(own(start.body, 'status'), 'start status missing');
    exactNumber(startStatus, 'revision', 0, 'start revision mismatch'); exactNumber(startStatus, 'acceptedCommandCount', 0, 'start command count mismatch');
    assertSecretFree(start.body, runtimeFragments);
    const socketUrl = `${workerOrigin.replace('https://', 'wss://')}/api/online/rooms/${encodeURIComponent(roomId)}/websocket`;
    const playerProjections: RecordV1[] = [];
    for (let index = 0; index < CONTEXT_COUNT; index += 1) {
      const credential = playerCredentials[index]; if (credential === undefined) throw new Error('missing player credential');
      const opened = await openParticipantSocket(pages[index], socketUrl, roomId, credential.participantId, credential.seatCapability, 'player', runtimeFragments, timeoutMs, 0, timeoutRuntime, (socket) => allSockets.add(socket));
      const playerId = CORE_PLAYERS[index]; if (playerId === undefined) throw new Error('missing player id');
      assertNoHiddenOpponentIdentity(opened.projection, playerId);
      sockets.push(opened.socket); allSockets.add(opened.socket); playerProjections.push(opened.projection);
    }
    const tableOpened = await openParticipantSocket(pages[0], socketUrl, roomId, createdTableId, createdTableCapability, 'table', runtimeFragments, timeoutMs, 0, timeoutRuntime, (socket) => allSockets.add(socket));
    assertNoHiddenOpponentIdentity(tableOpened.projection, '');
    sockets.push(tableOpened.socket); allSockets.add(tableOpened.socket);
    let tableProjection = tableOpened.projection;
    let revision = 0;
    const actionKindCounts = { 'table-draw': 0, 'player-exit': 0 };
    for (let index = 0; index < CONTEXT_COUNT; index += 1) {
      const credential = playerCredentials[index]; const socket = sockets[index]; if (credential === undefined || socket === undefined) throw new Error('missing command socket');
      const playerId = CORE_PLAYERS[index]; if (playerId === undefined) throw new Error('missing player id');
      const before = projectionZones(playerProjections[index], playerId);
      const commandId = runtimeIdentifier('cmd');
      await drainQueuedRevisionNotices(socket, roomId, revision, timeoutMs, runtimeFragments, timeoutRuntime);
      await socket.send({ kind: 'online-command-envelope-v1', protocolVersion: PROTOCOL_VERSION, roomId, participantId: credential.participantId, participantCapability: credential.seatCapability, commandId, baseRevision: revision, command: createTabletopCommand(revision + 1, playerId, { kind: 'table-draw', count: 1 }) });
      const ack = await receiveMatching(socket, (value) => own(value, 'kind') === 'online-command-ack-v1' && own(value, 'commandId') === commandId, timeoutMs, runtimeFragments, 'draw ack', timeoutRuntime, (value) => isO4p06fRevisionNoticeAtMostV1(value, roomId, revision + 1));
      if (own(ack, 'duplicate') !== false || own(ack, 'acceptedRevision') !== revision + 1 || own(ack, 'currentRevision') !== revision + 1) throw new Error('wrong revision or duplicate draw ack');
      revision += 1; actionKindCounts['table-draw'] += 1;
      await socket.send({ kind: 'online-projection-request-v1', protocolVersion: PROTOCOL_VERSION, roomId, participantId: credential.participantId, participantCapability: credential.seatCapability, knownRevision: revision, clientBuildId: CLIENT_BUILD_ID, decisionContext: null });
      const snapshot = await receiveMatching(socket, (value) => own(value, 'kind') === 'online-projected-snapshot-v1' && own(value, 'revision') === revision, timeoutMs, runtimeFragments, 'draw projection', timeoutRuntime, (value) => isO4p06fRevisionNoticeAtMostV1(value, roomId, revision));
      const projection = projectionFrom(snapshot, runtimeFragments, 'draw projection invalid'); assertNoHiddenOpponentIdentity(projection, playerId);
      const after = projectionZones(projection, playerId);
      if (after.hand !== before.hand + 1 || after.library !== before.library - 1) throw new Error('draw zone counts mismatch');
      playerProjections[index] = projection;
    }
    const p2Socket = sockets[1]; if (p2Socket === undefined || playerCredentials[1] === undefined) throw new Error('missing P2 socket');
    await assertTimeout(Promise.resolve(p2Socket.close()), timeoutMs, 'P2 reconnect close', timeoutRuntime);
    const p2 = playerCredentials[1];
    const p1Socket = sockets[0]; const p1 = playerCredentials[0];
    if (p1Socket === undefined || p1 === undefined) throw new Error('missing surviving P1 socket');
    await awaitO4p06fParticipantDisconnectedV1({ socket: p1Socket, roomId, observerParticipantId: p1.participantId, observerParticipantCapability: p1.seatCapability, targetParticipantId: p2.participantId, targetExpectedSeatIndex: 1, ownPlayerId: 'P1', fragments: runtimeFragments, timeoutMs, runtime: timeoutRuntime });
    const p2Opened = await openParticipantSocket(pages[1], socketUrl, roomId, p2.participantId, p2.seatCapability, 'player', runtimeFragments, timeoutMs, 2, timeoutRuntime, (socket) => allSockets.add(socket)); sockets[1] = p2Opened.socket;
    if (p2Opened.socket === p2Socket) throw new Error('P2 reconnect did not create a fresh socket');
    const p2Projection = p2Opened.projection;
    if (p2Opened.reason !== 'snapshot-required' || own(p2Projection, 'revision') !== 4 || p2Opened.snapshotCount !== 1) throw new Error('P2 resync reason/revision mismatch');
    if (await assertTimeout(p2Opened.socket.pendingCount(), timeoutMs, 'P2 frame accounting', timeoutRuntime) !== 0) throw new Error('P2 unsolicited frame queue');
    assertNoHiddenOpponentIdentity(p2Projection, 'P2'); playerProjections[1] = p2Projection;
    const p4 = playerCredentials[3]; const p4Socket = sockets[3]; if (p4 === undefined || p4Socket === undefined) throw new Error('missing P4 socket');
    const exitCommandId = runtimeIdentifier('cmd');
    await drainQueuedRevisionNotices(p4Socket, roomId, revision, timeoutMs, runtimeFragments, timeoutRuntime);
    await p4Socket.send({ kind: 'online-command-envelope-v1', protocolVersion: PROTOCOL_VERSION, roomId, participantId: p4.participantId, participantCapability: p4.seatCapability, commandId: exitCommandId, baseRevision: revision, command: createTabletopCommand(revision + 1, 'P4', { kind: 'player-exit', playerId: 'P4', cause: 'concession' }) });
    const exitAck = await receiveMatching(p4Socket, (value) => own(value, 'kind') === 'online-command-ack-v1' && own(value, 'commandId') === exitCommandId, timeoutMs, runtimeFragments, 'exit ack', timeoutRuntime, (value) => isO4p06fRevisionNoticeAtMostV1(value, roomId, revision + 1));
    if (own(exitAck, 'duplicate') !== false || own(exitAck, 'acceptedRevision') !== 5 || own(exitAck, 'currentRevision') !== 5) throw new Error('exit revision mismatch'); revision = 5; actionKindCounts['player-exit'] += 1;
    const status = await requestJson(pages[0], `${workerOrigin}/api/online/rooms/${encodeURIComponent(roomId)}${ROOM_STATUS_SUFFIX}`, undefined, timeoutMs, timeoutRuntime);
    assertSecretFree(status.body, runtimeFragments);
    const statusBody = status.body; const finalRevision = own(statusBody, 'revision'); const finalAcceptedCommandCount = own(statusBody, 'acceptedCommandCount'); const acceptedCommandCount = 5;
    if (revision !== 5 || acceptedCommandCount !== 5) throw new Error('accepted revision/count mismatch');
    if (status.status !== 200 || finalRevision !== 5 || finalAcceptedCommandCount !== 5 || finalRevision !== revision || finalAcceptedCommandCount !== 5) throw new Error('final HTTP status mismatch');
    for (const index of [0, 1, 2, 3, 4] as const) {
      const socket = sockets[index]; if (socket === undefined) continue;
      const credential = index === 4 ? { participantId: createdTableId, seatCapability: createdTableCapability } : playerCredentials[index]; if (credential === undefined) continue;
      await socket.send({ kind: 'online-projection-request-v1', protocolVersion: PROTOCOL_VERSION, roomId, participantId: credential.participantId, participantCapability: credential.seatCapability, knownRevision: revision, clientBuildId: CLIENT_BUILD_ID, decisionContext: null });
      const snapshot = await receiveMatching(socket, (value) => own(value, 'kind') === 'online-projected-snapshot-v1' && own(value, 'revision') === 5, timeoutMs, runtimeFragments, 'exit projection', timeoutRuntime, (value) => isO4p06fRevisionNoticeAtMostV1(value, roomId, 5));
      const projection = projectionFrom(snapshot, runtimeFragments, 'exit projection invalid'); assertNoHiddenOpponentIdentity(projection, index === 4 ? '' : CORE_PLAYERS[index], CORE_PLAYERS.slice(0, 3)); assertPlayerConceded(projection, 'P4'); if (index === 4) tableProjection = projection; else playerProjections[index] = projection;
    }
    const audienceProjections = [...playerProjections.slice(0, 3), tableProjection];
    const preDeploymentProjectionHashes: Record<string, string> = {}; for (let index = 0; index < audienceProjections.length; index += 1) preDeploymentProjectionHashes[`audience-${String(index + 1)}`] = sha256(canonicalString(audienceProjections[index]));
    assertSecretFree(preDeploymentProjectionHashes, runtimeFragments);
    await assertTimeout(deps.barrier({ roomCorrelationId: roomId, revision: 5, acceptedCommandCount: 5 }), deps.operatorTimeoutMs ?? timeoutMs, 'deployment barrier', timeoutRuntime);
    const platform = validatePlatformEvidence(await assertTimeout(deps.observePlatformEvidence({ roomCorrelationId: roomId, revision: 5, acceptedCommandCount: 5 }), deps.operatorTimeoutMs ?? timeoutMs, 'platform evidence', timeoutRuntime), roomId, runtimeFragments);
    for (const socket of sockets) { try { await assertTimeout(Promise.resolve(socket.close()), timeoutMs, 'deployment socket close', timeoutRuntime); } catch { /* deployment reconnect cleanup is best effort */ } }
    const postSockets: O4p06fSocketV1[] = [];
    const postPlayerProjections: RecordV1[] = [];
    for (let index = 0; index < 3; index += 1) {
      const credential = playerCredentials[index]; if (credential === undefined) throw new Error('post-deployment credential missing');
      const opened = await openParticipantSocket(pages[index], socketUrl, roomId, credential.participantId, credential.seatCapability, 'player', runtimeFragments, timeoutMs, 5, timeoutRuntime, (socket) => allSockets.add(socket));
      const playerId = CORE_PLAYERS[index]; if (playerId === undefined) throw new Error('post-deployment player missing');
      assertNoHiddenOpponentIdentity(opened.projection, playerId, CORE_PLAYERS.slice(0, 3));
      postSockets.push(opened.socket); allSockets.add(opened.socket); postPlayerProjections.push(opened.projection);
    }
    for (const projection of postPlayerProjections) assertPlayerConceded(projection, 'P4');
    const postTable = await openParticipantSocket(pages[0], socketUrl, roomId, createdTableId, createdTableCapability, 'table', runtimeFragments, timeoutMs, 5, timeoutRuntime, (socket) => allSockets.add(socket));
    postSockets.push(postTable.socket); allSockets.add(postTable.socket); sockets.push(...postSockets); tableProjection = postTable.projection; assertNoHiddenOpponentIdentity(tableProjection, '', CORE_PLAYERS.slice(0, 3)); assertPlayerConceded(tableProjection, 'P4');
    const postAudiences = [...postPlayerProjections, tableProjection];
    const postDeploymentProjectionHashes: Record<string, string> = {};
    for (let index = 0; index < postAudiences.length; index += 1) postDeploymentProjectionHashes[`audience-${String(index + 1)}`] = sha256(canonicalString(postAudiences[index]));
    for (const [key, hash] of Object.entries(preDeploymentProjectionHashes)) if (postDeploymentProjectionHashes[key] !== hash) throw new Error('post-deployment projection hash mismatch');
    const postStatus = await requestJson(pages[0], `${workerOrigin}/api/online/rooms/${encodeURIComponent(roomId)}${ROOM_STATUS_SUFFIX}`, undefined, timeoutMs, timeoutRuntime);
    assertSecretFree(postStatus.body, runtimeFragments);
    if (postStatus.status !== 200 || own(postStatus.body, 'revision') !== 5 || own(postStatus.body, 'acceptedCommandCount') !== 5) throw new Error('post-deployment HTTP status mismatch');
    const measuredConsoleCounts = pages.reduce((total, page) => { const counts = page.consoleCounts(); return { errors: total.errors + counts.errors, warnings: total.warnings + counts.warnings, secretViolations: total.secretViolations + (counts.secretViolations ?? 0) }; }, { errors: 0, warnings: 0, secretViolations: 0 });
    if (measuredConsoleCounts.errors !== 0 || measuredConsoleCounts.warnings !== 0 || measuredConsoleCounts.secretViolations !== 0) throw new Error('console error/warning or secret violation');
    await cleanupResources();
    const summary = {
      kind: 'o4p-06f-four-browser-production-evidence-v1' as const, schemaVersion: 1 as const, pagesOrigin: O4P06F_PAGES_ORIGIN_V1, workerOrigin: O4P06F_WORKER_ORIGIN_V1, chromeVersion: browser.chromeVersion, contextCount: 4 as const, decks,
      publicAssetHashes: Object.freeze([...assetFacts.hashes]), httpStatuses: Object.freeze([...assetFacts.statuses, create.status, start.status, status.status, postStatus.status]), revision: 5 as const, acceptedCommandCount: 5 as const, actionKindCounts: Object.freeze({ 'table-draw': 4 as const, 'player-exit': 1 as const }), reconnect: Object.freeze({ participant: 'P2' as const, freshSocket: true as const, staleKnownRevision: 2, snapshotCount: p2Opened.snapshotCount, bounded: true as const }),
      preDeploymentVersionIdentifiers: Object.freeze([platform.preDeploymentVersionIdentifier]) as [string], postDeploymentVersionIdentifiers: Object.freeze([platform.postDeploymentVersionIdentifier]) as [string], preDeploymentProjectionHashes: Object.freeze(preDeploymentProjectionHashes), postDeploymentProjectionHashes: Object.freeze(postDeploymentProjectionHashes), recoveryFacts: Object.freeze({ checkpointRevision: 0 as const, currentRevision: 5 as const, replayCount: 5 as const, outcome: 'ok' as const, errorCount: 0 as const, exceptionCount: 0 as const, parseFailureCount: 0 as const, secretViolationCount: 0 as const }), consoleCounts: Object.freeze({ errors: measuredConsoleCounts.errors, warnings: measuredConsoleCounts.warnings }), cleanup: cleanupReport,
    };
    const checked = validateO4p06fEvidenceSummaryV1(summary); if (!checked.ok) throw new Error('summary validation failed'); return checked.value;
  } finally { await cleanupResources(); }
}

async function main(): Promise<void> {
  const line = createInterface({ input, output });
  try {
    const operatorTimeoutMs = Number(process.env.O4P06F_OPERATOR_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS * 4);
    if (!Number.isSafeInteger(operatorTimeoutMs) || operatorTimeoutMs <= 0 || operatorTimeoutMs > 3_600_000) throw new Error('invalid operator timeout');
    const summary = await runO4p06fFourBrowserEvidenceV1({
      barrier: async (facts) => { output.write(`${JSON.stringify({ kind: 'o4p-06f-ready-for-deploy-v1', roomCorrelationId: facts.roomCorrelationId, revision: facts.revision })}\n`); await line.question('Deploy the identical Worker candidate, then press Enter: '); },
      observePlatformEvidence: async (facts) => { output.write(`${JSON.stringify({ kind: 'o4p-06f-ready-for-tail-v1', roomCorrelationId: facts.roomCorrelationId, revision: facts.revision })}\n`); const raw = await line.question('Paste secret-free platform evidence JSON: '); return parseBoundedJson(raw); },
      operatorTimeoutMs,
    });
  process.stdout.write(`${canonicalString(summary)}\n`);
  } finally { line.close(); }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) void main().catch(() => { process.exitCode = 1; });
