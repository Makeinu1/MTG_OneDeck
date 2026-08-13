import type {
  OnlineProtocolStateV1,
} from '../protocol/index';
import type {
  OnlineRoomParticipantRoleV1,
} from '../room/index';
import type {
  OnlineCloudflareSqlStorage,
} from './types';

export const ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1 = 1 as const;
export const ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1 = 43_200_000 as const;
export const ONLINE_CLOUDFLARE_CONTROLLER_LEASE_LIFETIME_MS_V1 = 30_000 as const;
export const ONLINE_CLOUDFLARE_MAX_ATTACHED_SOCKETS_V1 = 16 as const;
export const ONLINE_CLOUDFLARE_WEBSOCKET_MESSAGE_WINDOW_MS_V1 = 10_000 as const;
export const ONLINE_CLOUDFLARE_MAX_WEBSOCKET_MESSAGES_PER_WINDOW_V1 = 32 as const;
export const ONLINE_CLOUDFLARE_MALFORMED_MESSAGE_WINDOW_MS_V1 = 60_000 as const;
export const ONLINE_CLOUDFLARE_MAX_MALFORMED_MESSAGES_PER_WINDOW_V1 = 8 as const;
export const ONLINE_CLOUDFLARE_HTTP_BEARER_WINDOW_MS_V1 = 10_000 as const;
export const ONLINE_CLOUDFLARE_MAX_HTTP_BEARER_ACTIONS_PER_WINDOW_V1 = 32 as const;
export const ONLINE_CLOUDFLARE_ROTATION_WINDOW_MS_V1 = 60_000 as const;
export const ONLINE_CLOUDFLARE_MAX_ROTATIONS_PER_WINDOW_V1 = 4 as const;
export const ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1 = 65_536 as const;
export const ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1 = 256 as const;
export const ONLINE_CLOUDFLARE_MAX_RETIRED_CAPABILITIES_PER_GRANT_V1 = 256 as const;

export type OnlineCloudflareSecurityAuthorityV1 = 'host' | 'seat' | 'table' | 'spectator';
export type OnlineCloudflareSecurityActionV1 = 'hello' | 'projected-snapshot' | 'rotate-own-capability' | 'command';
export type OnlineCloudflareSecurityAuditOutcomeV1 = 'accepted' | 'rejected';
export type OnlineCloudflareSecurityAuditCodeV1 =
  | 'CAPABILITY_ROTATED'
  | 'CAPABILITY_REJECTED'
  | 'CAPABILITY_EXPIRED'
  | 'ROLE_REJECTED'
  | 'LEASE_CONFLICT'
  | 'RATE_REJECTED'
  | 'MALFORMED_THRESHOLD';

export type OnlineCloudflareCapabilityRotationResponseV1 = Readonly<{
  readonly kind: 'online-cloudflare-capability-rotated-v1';
  readonly schemaVersion: typeof ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1;
  readonly roomId: string;
  readonly participantId: string;
  readonly authority: OnlineCloudflareSecurityAuthorityV1;
  readonly generation: number;
  readonly expiresAt: number;
}>;

export type OnlineCloudflareSecurityAuthorizationV1 = Readonly<{
  readonly participantId: string;
  readonly authority: OnlineCloudflareSecurityAuthorityV1;
  readonly generation: number;
  readonly expiresAt: number;
  readonly protocolCapability: string;
}>;

export type OnlineCloudflareSecurityRejectionV1 = 'capability' | 'role' | 'rate';

export type OnlineCloudflareSecurityAdmissionV1 =
  | Readonly<{
      readonly ok: true;
      readonly authorization: OnlineCloudflareSecurityAuthorizationV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly reason: OnlineCloudflareSecurityRejectionV1;
    }>;

export type OnlineCloudflareControllerHolderV1 = Readonly<{
  readonly kind: 'http' | 'socket';
  readonly connectionId: number | null;
}>;

export type OnlineCloudflareSecurityErrorCodeV1 =
  | 'INVALID_SECURITY_STATE'
  | 'SECURITY_STATE_MISSING'
  | 'INVALID_INPUT'
  | 'CLOCK_REJECTED'
  | 'CAS_CONFLICT'
  | 'ROTATION_CONFLICT'
  | 'RATE_LIMITED'
  | 'ROLE_NOT_ALLOWED'
  | 'CAPABILITY_REJECTED'
  | 'CONTROLLER_LEASE_REQUIRED';

export class OnlineCloudflareSecurityError extends Error {
  readonly code: OnlineCloudflareSecurityErrorCodeV1;

  constructor(code: OnlineCloudflareSecurityErrorCodeV1) {
    super(code);
    this.name = 'OnlineCloudflareSecurityError';
    this.code = code;
  }
}

type SecurityStateRow = {
  singleton: unknown;
  schema_version: unknown;
  room_id: unknown;
  last_observed_at: unknown;
  next_connection_id: unknown;
  dropped_audit_count: unknown;
  grant_count: unknown;
};

type GrantRow = {
  room_id: unknown;
  participant_id: unknown;
  authority: unknown;
  current_token: unknown;
  generation: unknown;
  issued_at: unknown;
  expires_at: unknown;
  http_window_started_at: unknown;
  http_count: unknown;
  rotation_window_started_at: unknown;
  rotation_count: unknown;
  retired_tokens_json: unknown;
};

type LeaseRow = {
  room_id: unknown;
  participant_id: unknown;
  capability_generation: unknown;
  holder_kind: unknown;
  connection_id: unknown;
  expires_at: unknown;
};

type AuditRow = {
  audit_id: unknown;
  room_id: unknown;
  participant_id: unknown;
  connection_id: unknown;
  authority: unknown;
  generation: unknown;
  event_code: unknown;
  outcome: unknown;
  observed_at: unknown;
};

type SecurityState = Readonly<{
  readonly singleton: 1;
  readonly schemaVersion: typeof ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1;
  readonly roomId: string;
  readonly lastObservedAt: number;
  readonly nextConnectionId: number;
  readonly droppedAuditCount: number;
  readonly grantCount: number;
}>;

type RetiredCapability = Readonly<{
  readonly token: string;
  readonly generation: number;
  readonly expiresAt: number;
}>;

type Grant = Readonly<{
  readonly roomId: string;
  readonly participantId: string;
  readonly authority: OnlineCloudflareSecurityAuthorityV1;
  readonly currentToken: string;
  readonly protocolCapability: string | null;
  readonly generation: number;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly httpWindowStartedAt: number;
  readonly httpCount: number;
  readonly rotationWindowStartedAt: number;
  readonly rotationCount: number;
  readonly retiredCapabilities: readonly RetiredCapability[];
}>;

type Lease = Readonly<{
  readonly roomId: string;
  readonly participantId: string;
  readonly capabilityGeneration: number;
  readonly holderKind: 'http' | 'socket';
  readonly connectionId: number | null;
  readonly expiresAt: number;
}>;

type AuditFact = Readonly<{
  readonly auditId: number;
  readonly roomId: string;
  readonly participantId: string | null;
  readonly connectionId: number | null;
  readonly authority: OnlineCloudflareSecurityAuthorityV1 | null;
  readonly generation: number | null;
  readonly eventCode: OnlineCloudflareSecurityAuditCodeV1;
  readonly outcome: OnlineCloudflareSecurityAuditOutcomeV1;
  readonly observedAt: number;
}>;

type SecuritySnapshot = Readonly<{
  readonly state: SecurityState;
  readonly grants: readonly Grant[];
  readonly leases: readonly Lease[];
  readonly audit: readonly AuditFact[];
}>;

type ExpectedGrant = Readonly<{
  readonly participantId: string;
  readonly authority: OnlineCloudflareSecurityAuthorityV1;
  readonly protocolCapability: string;
}>;

const CREATE_SECURITY_STATE = 'CREATE TABLE online_security_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, last_observed_at INTEGER NOT NULL, next_connection_id INTEGER NOT NULL, dropped_audit_count INTEGER NOT NULL, grant_count INTEGER NOT NULL) STRICT';
const CREATE_GRANTS = 'CREATE TABLE online_capability_grant (room_id TEXT NOT NULL, participant_id TEXT NOT NULL, authority TEXT NOT NULL, current_token TEXT NOT NULL, generation INTEGER NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, http_window_started_at INTEGER NOT NULL, http_count INTEGER NOT NULL, rotation_window_started_at INTEGER NOT NULL, rotation_count INTEGER NOT NULL, retired_tokens_json TEXT NOT NULL, PRIMARY KEY (room_id, participant_id)) STRICT';
const CREATE_LEASES = 'CREATE TABLE online_controller_lease (room_id TEXT NOT NULL, participant_id TEXT NOT NULL, capability_generation INTEGER NOT NULL, holder_kind TEXT NOT NULL, connection_id INTEGER, expires_at INTEGER NOT NULL, PRIMARY KEY (room_id, participant_id)) STRICT';
const CREATE_AUDIT = 'CREATE TABLE online_security_audit (audit_id INTEGER PRIMARY KEY, room_id TEXT NOT NULL, participant_id TEXT, connection_id INTEGER, authority TEXT, generation INTEGER, event_code TEXT NOT NULL, outcome TEXT NOT NULL, observed_at INTEGER NOT NULL) STRICT';

const SELECT_SECURITY_STATE = 'SELECT singleton, schema_version, room_id, last_observed_at, next_connection_id, dropped_audit_count, grant_count FROM online_security_state WHERE singleton = 1';
const SELECT_GRANTS = 'SELECT room_id, participant_id, authority, current_token, generation, issued_at, expires_at, http_window_started_at, http_count, rotation_window_started_at, rotation_count, retired_tokens_json FROM online_capability_grant ORDER BY participant_id';
const SELECT_LEASES = 'SELECT room_id, participant_id, capability_generation, holder_kind, connection_id, expires_at FROM online_controller_lease ORDER BY participant_id';
const SELECT_AUDIT = 'SELECT audit_id, room_id, participant_id, connection_id, authority, generation, event_code, outcome, observed_at FROM online_security_audit ORDER BY audit_id';
const INSERT_SECURITY_STATE = 'INSERT INTO online_security_state (singleton, schema_version, room_id, last_observed_at, next_connection_id, dropped_audit_count, grant_count) VALUES (?, ?, ?, ?, ?, ?, ?)';
const INSERT_GRANT = 'INSERT INTO online_capability_grant (room_id, participant_id, authority, current_token, generation, issued_at, expires_at, http_window_started_at, http_count, rotation_window_started_at, rotation_count, retired_tokens_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const UPDATE_SECURITY_STATE = 'UPDATE online_security_state SET last_observed_at = ?, next_connection_id = ?, dropped_audit_count = ? WHERE singleton = 1 AND room_id = ? AND last_observed_at = ? AND next_connection_id = ? AND dropped_audit_count = ? AND grant_count = ? RETURNING singleton';
const UPDATE_GRANT = 'UPDATE online_capability_grant SET current_token = ?, generation = ?, issued_at = ?, expires_at = ?, http_window_started_at = ?, http_count = ?, rotation_window_started_at = ?, rotation_count = ?, retired_tokens_json = ? WHERE room_id = ? AND participant_id = ? AND current_token = ? AND generation = ? AND issued_at = ? AND expires_at = ? AND http_window_started_at = ? AND http_count = ? AND rotation_window_started_at = ? AND rotation_count = ? AND retired_tokens_json = ? RETURNING participant_id';
const UPDATE_GRANT_COUNTERS = 'UPDATE online_capability_grant SET http_window_started_at = ?, http_count = ?, rotation_window_started_at = ?, rotation_count = ? WHERE room_id = ? AND participant_id = ? AND current_token = ? AND generation = ? AND issued_at = ? AND expires_at = ? AND http_window_started_at = ? AND http_count = ? AND rotation_window_started_at = ? AND rotation_count = ? AND retired_tokens_json = ? RETURNING participant_id';
const DELETE_LEASE = 'DELETE FROM online_controller_lease WHERE room_id = ? AND participant_id = ? AND capability_generation = ? AND holder_kind = ? AND ((connection_id IS NULL AND ? IS NULL) OR connection_id = ?) AND expires_at = ? RETURNING participant_id';
const INSERT_LEASE = 'INSERT INTO online_controller_lease (room_id, participant_id, capability_generation, holder_kind, connection_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)';
const UPDATE_LEASE = 'UPDATE online_controller_lease SET capability_generation = ?, holder_kind = ?, connection_id = ?, expires_at = ? WHERE room_id = ? AND participant_id = ? AND capability_generation = ? AND holder_kind = ? AND ((connection_id IS NULL AND ? IS NULL) OR connection_id = ?) AND expires_at = ? RETURNING participant_id';
const INSERT_AUDIT = 'INSERT INTO online_security_audit (audit_id, room_id, participant_id, connection_id, authority, generation, event_code, outcome, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isSafePositiveInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

function isToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

function isApplicationId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)
    && value !== '__proto__' && value !== 'prototype' && value !== 'constructor';
}

function isAuthority(value: unknown): value is OnlineCloudflareSecurityAuthorityV1 {
  return value === 'host' || value === 'seat' || value === 'table' || value === 'spectator';
}

function isRole(value: unknown): value is OnlineRoomParticipantRoleV1 {
  return value === 'player' || value === 'table' || value === 'spectator';
}

function isAuditCode(value: unknown): value is OnlineCloudflareSecurityAuditCodeV1 {
  return value === 'CAPABILITY_ROTATED' || value === 'CAPABILITY_REJECTED'
    || value === 'CAPABILITY_EXPIRED' || value === 'ROLE_REJECTED'
    || value === 'LEASE_CONFLICT' || value === 'RATE_REJECTED'
    || value === 'MALFORMED_THRESHOLD';
}

function isOutcome(value: unknown): value is OnlineCloudflareSecurityAuditOutcomeV1 {
  return value === 'accepted' || value === 'rejected';
}

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) throw new OnlineCloudflareSecurityError('CLOCK_REJECTED');
  return result;
}

function clockValue(value: unknown): number {
  if (!isSafeInteger(value)) throw new OnlineCloudflareSecurityError('CLOCK_REJECTED');
  return value;
}

function rows<T>(value: { toArray(): T[] }): T[] {
  const result = value.toArray();
  if (!Array.isArray(result)) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  return result;
}

function configuredGrants(state: OnlineProtocolStateV1): readonly ExpectedGrant[] {
  const participants = state.room.participants;
  const expected: ExpectedGrant[] = [];
  for (const participant of participants) {
    if (!isRole(participant.role)) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    if (participant.role === 'player') {
      const seat = state.room.seats[participant.seatIndex];
      if (seat === undefined) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
      expected.push(Object.freeze({
        participantId: participant.participantId,
        authority: participant.participantId === state.room.hostParticipantId ? 'host' : 'seat',
        protocolCapability: seat.seatCapability,
      }));
    } else {
      const authorization = state.observerAuthorizations.find((candidate) => candidate.participantId === participant.participantId);
      if (authorization === undefined) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
      expected.push(Object.freeze({
        participantId: participant.participantId,
        authority: participant.role,
        protocolCapability: authorization.observerCapability,
      }));
    }
  }
  const ids = new Set<string>();
  const capabilities = new Set<string>();
  for (const grant of expected) {
    if (!isApplicationId(grant.participantId) || !isToken(grant.protocolCapability) || ids.has(grant.participantId) || capabilities.has(grant.protocolCapability)) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    ids.add(grant.participantId);
    capabilities.add(grant.protocolCapability);
  }
  const observers = state.observerAuthorizations.map((authorization) => authorization.participantId);
  if (observers.length !== expected.filter((grant) => grant.authority === 'table' || grant.authority === 'spectator').length) {
    throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  }
  return Object.freeze(expected);
}

function hasCapabilityFragment(value: string, capabilities: readonly string[]): boolean {
  for (const capability of capabilities) {
    for (let length = 8; length <= capability.length; length += 1) {
      for (let start = 0; start + length <= capability.length; start += 1) {
        if (value.includes(capability.slice(start, start + length))) return true;
      }
    }
  }
  return false;
}

function assertProtocolCapability(grant: Grant): string {
  if (grant.protocolCapability === null) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  return grant.protocolCapability;
}

function serializeRetiredCapabilities(values: readonly RetiredCapability[]): string {
  return JSON.stringify(values.map((value) => ({
    token: value.token,
    generation: value.generation,
    expiresAt: value.expiresAt,
  })));
}

function parseRetiredCapabilities(value: unknown): readonly RetiredCapability[] {
  if (typeof value !== 'string') throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  }
  if (!Array.isArray(parsed) || parsed.length > ONLINE_CLOUDFLARE_MAX_RETIRED_CAPABILITIES_PER_GRANT_V1) {
    throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  }
  const result: RetiredCapability[] = [];
  for (const entry of parsed) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    const record = entry as Record<string, unknown>;
    if (Object.getPrototypeOf(record) !== Object.prototype
      || Object.getOwnPropertySymbols(record).length !== 0
      || Object.keys(record).sort().join(',') !== 'expiresAt,generation,token') {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    if (!isToken(record.token) || !isSafeInteger(record.generation) || !isSafeInteger(record.expiresAt)) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    result.push(Object.freeze({
      token: record.token,
      generation: record.generation,
      expiresAt: record.expiresAt,
    }));
  }
  const frozen = Object.freeze(result);
  if (serializeRetiredCapabilities(frozen) !== value) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  return frozen;
}

function rowState(value: SecurityStateRow): SecurityState {
  if (value.singleton !== 1 || value.schema_version !== ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1
    || !isApplicationId(value.room_id) || !isSafeInteger(value.last_observed_at)
    || !isSafePositiveInteger(value.next_connection_id) || !isSafeInteger(value.dropped_audit_count)
    || !isSafePositiveInteger(value.grant_count)) {
    throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  }
  return Object.freeze({
    singleton: 1,
    schemaVersion: ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1,
    roomId: value.room_id,
    lastObservedAt: value.last_observed_at,
    nextConnectionId: value.next_connection_id,
    droppedAuditCount: value.dropped_audit_count,
    grantCount: value.grant_count,
  });
}

type StoredGrant = Omit<Grant, 'protocolCapability'>;

function rowGrant(value: GrantRow): StoredGrant {
  const retiredCapabilities = parseRetiredCapabilities(value.retired_tokens_json);
  if (!isApplicationId(value.room_id) || !isApplicationId(value.participant_id)
    || !isAuthority(value.authority) || !isToken(value.current_token)
    || !isSafeInteger(value.generation) || !isSafeInteger(value.issued_at)
    || !isSafeInteger(value.expires_at) || !isSafeInteger(value.http_window_started_at)
    || !isSafeInteger(value.http_count) || !isSafeInteger(value.rotation_window_started_at)
    || !isSafeInteger(value.rotation_count) || value.http_count > ONLINE_CLOUDFLARE_MAX_HTTP_BEARER_ACTIONS_PER_WINDOW_V1
    || value.rotation_count > ONLINE_CLOUDFLARE_MAX_ROTATIONS_PER_WINDOW_V1
    || value.expires_at <= value.issued_at
    || value.expires_at - value.issued_at !== ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1) {
    throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  }
  return Object.freeze({
    roomId: value.room_id,
    participantId: value.participant_id,
    authority: value.authority,
    currentToken: value.current_token,
    generation: value.generation,
    issuedAt: value.issued_at,
    expiresAt: value.expires_at,
    httpWindowStartedAt: value.http_window_started_at,
    httpCount: value.http_count,
    rotationWindowStartedAt: value.rotation_window_started_at,
    rotationCount: value.rotation_count,
    retiredCapabilities,
  });
}

function rowLease(value: LeaseRow): Lease {
  if (!isApplicationId(value.room_id) || !isApplicationId(value.participant_id)
    || !isSafeInteger(value.capability_generation) || (value.holder_kind !== 'http' && value.holder_kind !== 'socket')
    || (value.holder_kind === 'http' && value.connection_id !== null)
    || (value.holder_kind === 'socket' && !isSafePositiveInteger(value.connection_id))
    || !isSafeInteger(value.expires_at)) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  return Object.freeze({
    roomId: value.room_id,
    participantId: value.participant_id,
    capabilityGeneration: value.capability_generation,
    holderKind: value.holder_kind,
    connectionId: value.connection_id as number | null,
    expiresAt: value.expires_at,
  });
}

function rowAudit(value: AuditRow): AuditFact {
  if (!isSafePositiveInteger(value.audit_id) || !isApplicationId(value.room_id)
    || (value.participant_id !== null && !isApplicationId(value.participant_id))
    || (value.connection_id !== null && !isSafePositiveInteger(value.connection_id))
    || (value.authority !== null && !isAuthority(value.authority))
    || (value.generation !== null && !isSafeInteger(value.generation))
    || !isAuditCode(value.event_code) || !isOutcome(value.outcome) || !isSafeInteger(value.observed_at)) {
    throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  }
  return Object.freeze({
    auditId: value.audit_id,
    roomId: value.room_id,
    participantId: value.participant_id,
    connectionId: value.connection_id,
    authority: value.authority,
    generation: value.generation,
    eventCode: value.event_code,
    outcome: value.outcome,
    observedAt: value.observed_at,
  });
}

function assertSnapshotRelations(snapshot: SecuritySnapshot, state: OnlineProtocolStateV1): void {
  if (snapshot.state.roomId !== state.room.roomId || snapshot.grants.length !== state.room.participants.length
    || snapshot.state.grantCount !== snapshot.grants.length
    || snapshot.audit.length > ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1
    || (snapshot.state.droppedAuditCount > 0 && snapshot.audit.length !== ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1)) {
    throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  }
  const expected = configuredGrants(state);
  const expectedById = new Map(expected.map((grant) => [grant.participantId, grant]));
  const configuredCapabilities = expected.map((grant) => grant.protocolCapability);
  const seen = new Set<string>();
  const storedTokens = new Set<string>();
  for (const grant of snapshot.grants) {
    if (grant.roomId !== state.room.roomId || seen.has(grant.participantId) || storedTokens.has(grant.currentToken)) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    const match = expectedById.get(grant.participantId);
    if (match === undefined || match.authority !== grant.authority || !isToken(grant.currentToken)
      || (grant.generation === 0 && grant.currentToken !== match.protocolCapability)
      || (grant.generation > 0 && grant.currentToken === match.protocolCapability)
      || (grant.generation <= 1 && grant.retiredCapabilities.length !== 0)
      || (grant.generation > 1 && grant.retiredCapabilities.at(-1)?.generation !== grant.generation - 1)
      || grant.httpWindowStartedAt > snapshot.state.lastObservedAt
      || grant.rotationWindowStartedAt > snapshot.state.lastObservedAt
      || grant.issuedAt > snapshot.state.lastObservedAt
      || (grant.currentToken !== match.protocolCapability && hasCapabilityFragment(grant.currentToken, configuredCapabilities))) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    let previousRetiredGeneration = 0;
    for (const retired of grant.retiredCapabilities) {
      if (retired.generation < 1 || retired.generation >= grant.generation
        || retired.generation <= previousRetiredGeneration || retired.expiresAt <= grant.issuedAt
        || (retired.expiresAt > snapshot.state.lastObservedAt && (retired.token === grant.currentToken || storedTokens.has(retired.token)))
        || hasCapabilityFragment(retired.token, configuredCapabilities)) {
        throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
      }
      previousRetiredGeneration = retired.generation;
      if (retired.expiresAt > snapshot.state.lastObservedAt) storedTokens.add(retired.token);
    }
    seen.add(grant.participantId);
    storedTokens.add(grant.currentToken);
  }
  if (seen.size !== expected.length) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  const playerIds = new Set<string>(state.room.participants.filter((participant) => participant.role === 'player').map((participant) => String(participant.participantId)));
  const leaseIds = new Set<string>();
  for (const lease of snapshot.leases) {
    if (lease.roomId !== state.room.roomId || !playerIds.has(lease.participantId) || leaseIds.has(lease.participantId)) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    const grant = snapshot.grants.find((candidate) => candidate.participantId === lease.participantId);
    if (grant === undefined || lease.capabilityGeneration !== grant.generation) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    leaseIds.add(lease.participantId);
  }
  let previousAuditId = 0;
  let previousObservedAt = 0;
  for (const fact of snapshot.audit) {
    if (fact.roomId !== state.room.roomId || fact.auditId !== previousAuditId + 1
      || fact.observedAt < previousObservedAt || fact.observedAt > snapshot.state.lastObservedAt) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    if (fact.participantId === null) {
      if (fact.authority !== null || fact.generation !== null) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    } else {
      const participant = expectedById.get(fact.participantId);
      const currentGrant = snapshot.grants.find((grant) => grant.participantId === fact.participantId);
      if (participant === undefined || currentGrant === undefined || fact.authority !== participant.authority
        || fact.generation === null || fact.generation > currentGrant.generation) {
        throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
      }
    }
    if ((fact.eventCode === 'CAPABILITY_ROTATED') !== (fact.outcome === 'accepted')) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    previousAuditId = fact.auditId;
    previousObservedAt = fact.observedAt;
  }
}

function assertCanonicalSnapshotRelations(snapshot: SecuritySnapshot): void {
  if (snapshot.state.grantCount !== snapshot.grants.length || snapshot.audit.length > ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1
    || (snapshot.state.droppedAuditCount > 0 && snapshot.audit.length !== ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1)) {
    throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  }
  const grantsById = new Map<string, Grant>();
  const storedTokens = new Set<string>();
  for (const grant of snapshot.grants) {
    if (grant.roomId !== snapshot.state.roomId || grantsById.has(grant.participantId) || storedTokens.has(grant.currentToken)
      || (grant.generation <= 1 && grant.retiredCapabilities.length !== 0)
      || (grant.generation > 1 && grant.retiredCapabilities.at(-1)?.generation !== grant.generation - 1)) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    let previousRetiredGeneration = 0;
    for (const retired of grant.retiredCapabilities) {
      if (retired.generation < 1 || retired.generation >= grant.generation
        || retired.generation <= previousRetiredGeneration || retired.expiresAt <= grant.issuedAt
        || (retired.expiresAt > snapshot.state.lastObservedAt && (retired.token === grant.currentToken || storedTokens.has(retired.token)))) {
        throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
      }
      previousRetiredGeneration = retired.generation;
      if (retired.expiresAt > snapshot.state.lastObservedAt) storedTokens.add(retired.token);
    }
    grantsById.set(grant.participantId, grant);
    storedTokens.add(grant.currentToken);
  }
  const leaseIds = new Set<string>();
  for (const lease of snapshot.leases) {
    const grant = grantsById.get(lease.participantId);
    if (lease.roomId !== snapshot.state.roomId || grant === undefined
      || (grant.authority !== 'host' && grant.authority !== 'seat')
      || lease.capabilityGeneration !== grant.generation || leaseIds.has(lease.participantId)) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    leaseIds.add(lease.participantId);
  }
  let previousAuditId = 0;
  let previousObservedAt = 0;
  for (const fact of snapshot.audit) {
    if (fact.roomId !== snapshot.state.roomId || fact.auditId !== previousAuditId + 1
      || fact.observedAt < previousObservedAt || fact.observedAt > snapshot.state.lastObservedAt) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    if (fact.participantId === null) {
      if (fact.authority !== null || fact.generation !== null) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    } else {
      const grant = grantsById.get(fact.participantId);
      if (grant === undefined || fact.authority !== grant.authority || fact.generation === null
        || fact.generation > grant.generation) {
        throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
      }
    }
    if ((fact.eventCode === 'CAPABILITY_ROTATED') !== (fact.outcome === 'accepted')) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    previousAuditId = fact.auditId;
    previousObservedAt = fact.observedAt;
  }
}

function validateClock(snapshot: SecuritySnapshot, nowInput: unknown): number {
  const now = clockValue(nowInput);
  if (now < snapshot.state.lastObservedAt) throw new OnlineCloudflareSecurityError('CLOCK_REJECTED');
  return now;
}

function windowValue(startedAt: number, now: number, length: number, count: number): Readonly<{ readonly startedAt: number; readonly count: number }> {
  if (now >= safeAdd(startedAt, length)) return Object.freeze({ startedAt: now, count: 0 });
  return Object.freeze({ startedAt, count });
}

function authorization(grant: Grant, participantId: string): OnlineCloudflareSecurityAuthorizationV1 {
  return Object.freeze({
    participantId,
    authority: grant.authority,
    generation: grant.generation,
    expiresAt: grant.expiresAt,
    protocolCapability: assertProtocolCapability(grant),
  });
}

export class OnlineCloudflareSecurityRepository {
  private readonly storage: OnlineCloudflareSqlStorage;

  constructor(storage: OnlineCloudflareSqlStorage) {
    this.storage = storage;
  }

  createSchemaInTransaction(): void {
    this.storage.sql.exec(CREATE_SECURITY_STATE);
    this.storage.sql.exec(CREATE_GRANTS);
    this.storage.sql.exec(CREATE_LEASES);
    this.storage.sql.exec(CREATE_AUDIT);
  }

  initializeInTransaction(roomId: string, state: OnlineProtocolStateV1, nowInput: unknown): void {
    const now = clockValue(nowInput);
    const existingState = rows(this.storage.sql.exec<SecurityStateRow>(SELECT_SECURITY_STATE));
    const existingGrants = rows(this.storage.sql.exec<GrantRow>(SELECT_GRANTS));
    const existingLeases = rows(this.storage.sql.exec<LeaseRow>(SELECT_LEASES));
    const existingAudit = rows(this.storage.sql.exec<AuditRow>(SELECT_AUDIT));
    if (existingState.length !== 0 || existingGrants.length !== 0 || existingLeases.length !== 0 || existingAudit.length !== 0) {
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
    const expected = configuredGrants(state);
    if (state.room.roomId !== roomId) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    const expiresAt = safeAdd(now, ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1);
    this.storage.sql.exec(INSERT_SECURITY_STATE, 1, ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1, roomId, now, 1, 0, expected.length);
    for (const grant of expected) {
      this.storage.sql.exec(
        INSERT_GRANT,
        roomId,
        grant.participantId,
        grant.authority,
        grant.protocolCapability,
        0,
        now,
        expiresAt,
        now,
        0,
        now,
        0,
        '[]',
      );
    }
    const snapshot = this.read(state);
    if (snapshot.state.lastObservedAt !== now || snapshot.grants.length !== expected.length) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
  }

  read(state: OnlineProtocolStateV1): SecuritySnapshot {
    try {
      const securitySnapshot = this.readSecuritySnapshot();
      const expected = configuredGrants(state);
      const expectedById = new Map(expected.map((grant) => [grant.participantId, grant.protocolCapability]));
      const grants = securitySnapshot.grants.map((grant) => {
        const protocolCapability = expectedById.get(grant.participantId);
        if (protocolCapability === undefined) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
        return Object.freeze({ ...grant, protocolCapability });
      });
      const snapshot: SecuritySnapshot = Object.freeze({
        state: securitySnapshot.state,
        grants: Object.freeze(grants),
        leases: securitySnapshot.leases,
        audit: securitySnapshot.audit,
      });
      assertSnapshotRelations(snapshot, state);
      return snapshot;
    } catch (error: unknown) {
      if (error instanceof OnlineCloudflareSecurityError) throw error;
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
  }

  readSecuritySnapshot(): SecuritySnapshot {
    try {
      const stateRows = rows(this.storage.sql.exec<SecurityStateRow>(SELECT_SECURITY_STATE));
      if (stateRows.length === 0) throw new OnlineCloudflareSecurityError('SECURITY_STATE_MISSING');
      if (stateRows.length !== 1) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
      const stateRow = stateRows[0];
      if (stateRow === undefined) throw new OnlineCloudflareSecurityError('SECURITY_STATE_MISSING');
      const snapshot: SecuritySnapshot = Object.freeze({
        state: rowState(stateRow),
        grants: Object.freeze(rows(this.storage.sql.exec<GrantRow>(SELECT_GRANTS)).map((row) => Object.freeze({ ...rowGrant(row), protocolCapability: null }))),
        leases: Object.freeze(rows(this.storage.sql.exec<LeaseRow>(SELECT_LEASES)).map(rowLease)),
        audit: Object.freeze(rows(this.storage.sql.exec<AuditRow>(SELECT_AUDIT)).map(rowAudit)),
      });
      assertCanonicalSnapshotRelations(snapshot);
      return snapshot;
    } catch (error: unknown) {
      if (error instanceof OnlineCloudflareSecurityError) throw error;
      throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    }
  }

  validateClock(state: OnlineProtocolStateV1, nowInput: unknown): number {
    return validateClock(this.read(state), nowInput);
  }

  validateClockFromSnapshot(snapshot: SecuritySnapshot, nowInput: unknown): number {
    return validateClock(snapshot, nowInput);
  }

  recordRateRejectionFromSnapshot(
    participantId: string | null,
    connectionId: number | null,
    nowInput: unknown,
    eventCode: 'RATE_REJECTED' | 'MALFORMED_THRESHOLD' = 'RATE_REJECTED',
  ): void {
    this.storage.transactionSync(() => {
      const snapshot = this.readSecuritySnapshot();
      const now = validateClock(snapshot, nowInput);
      const grant = participantId === null ? undefined : snapshot.grants.find((candidate) => candidate.participantId === participantId);
      this.appendAuditAfterWrites(
        snapshot,
        now,
        grant?.participantId ?? null,
        connectionId,
        grant?.authority ?? null,
        grant?.generation ?? null,
        eventCode,
        'rejected',
      );
    });
  }

  allocateConnectionId(state: OnlineProtocolStateV1, nowInput: unknown): number {
    return this.storage.transactionSync(() => {
      const snapshot = this.read(state);
      const now = validateClock(snapshot, nowInput);
      const connectionId = snapshot.state.nextConnectionId;
      const nextConnectionId = safeAdd(connectionId, 1);
      this.updateSecurityState(snapshot.state, now, nextConnectionId, snapshot.state.droppedAuditCount);
      const verified = this.read(state);
      if (verified.state.nextConnectionId !== nextConnectionId || verified.state.lastObservedAt !== now) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
      return connectionId;
    });
  }

  consumeHttpAction(
    state: OnlineProtocolStateV1,
    participantId: string,
    token: string,
    action: OnlineCloudflareSecurityActionV1,
    nowInput: unknown,
  ): OnlineCloudflareSecurityAdmissionV1 {
    if (!isApplicationId(participantId) || !isToken(token)) throw new OnlineCloudflareSecurityError('INVALID_INPUT');
    return this.storage.transactionSync(() => {
      const snapshot = this.read(state);
      const now = validateClock(snapshot, nowInput);
      const grant = snapshot.grants.find((candidate) => candidate.participantId === participantId);
      if (grant === undefined || !isToken(token) || grant.currentToken !== token || now >= grant.expiresAt) {
        this.appendAudit(snapshot, now, grant === undefined ? null : grant, null, grant !== undefined && now >= grant.expiresAt ? 'CAPABILITY_EXPIRED' : 'CAPABILITY_REJECTED', 'rejected');
        return Object.freeze({ ok: false as const, reason: 'capability' as const });
      }
      const httpWindow = windowValue(grant.httpWindowStartedAt, now, ONLINE_CLOUDFLARE_HTTP_BEARER_WINDOW_MS_V1, grant.httpCount);
      if (httpWindow.count >= ONLINE_CLOUDFLARE_MAX_HTTP_BEARER_ACTIONS_PER_WINDOW_V1) {
        this.appendAudit(snapshot, now, grant, null, 'RATE_REJECTED', 'rejected');
        return Object.freeze({ ok: false as const, reason: 'rate' as const });
      }
      const nextHttpCount = safeAdd(httpWindow.count, 1);
      const nextGrant = this.updateGrantCounters(grant, httpWindow.startedAt, nextHttpCount, grant.rotationWindowStartedAt, grant.rotationCount);
      if (action === 'command' && (grant.authority === 'table' || grant.authority === 'spectator')) {
        this.appendAuditAfterWrites(snapshot, now, participantId, null, grant.authority, grant.generation, 'ROLE_REJECTED', 'rejected');
        return Object.freeze({ ok: false as const, reason: 'role' as const });
      }
      this.updateSecurityState(snapshot.state, now, snapshot.state.nextConnectionId, snapshot.state.droppedAuditCount);
      const verified = this.read(state);
      if (verified.grants.find((candidate) => candidate.participantId === participantId)?.httpCount !== nextGrant.httpCount) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
      return Object.freeze({ ok: true as const, authorization: authorization(nextGrant, participantId) });
    });
  }

  authorizeSocket(
    state: OnlineProtocolStateV1,
    participantId: string,
    token: string,
    action: OnlineCloudflareSecurityActionV1,
    attachmentGeneration: number | null,
    nowInput: unknown,
    connectionId: number | null,
    snapshotInput?: SecuritySnapshot,
  ): OnlineCloudflareSecurityAdmissionV1 {
    const snapshot = snapshotInput ?? this.read(state);
    const now = validateClock(snapshot, nowInput);
    const grant = snapshot.grants.find((candidate) => candidate.participantId === participantId);
    if (grant === undefined || !isToken(token) || grant.currentToken !== token || now >= grant.expiresAt || (attachmentGeneration !== null && attachmentGeneration !== grant.generation)) {
      this.recordAuditSafe(state, now, grant === undefined ? null : grant, connectionId, grant !== undefined && now >= grant.expiresAt ? 'CAPABILITY_EXPIRED' : 'CAPABILITY_REJECTED', 'rejected');
      return Object.freeze({ ok: false as const, reason: 'capability' as const });
    }
    if (action === 'command' && (grant.authority === 'table' || grant.authority === 'spectator')) {
      this.recordAuditSafe(state, now, grant, connectionId, 'ROLE_REJECTED', 'rejected');
      return Object.freeze({ ok: false as const, reason: 'role' as const });
    }
    return Object.freeze({ ok: true as const, authorization: authorization(grant, participantId) });
  }

  rotate(
    state: OnlineProtocolStateV1,
    participantId: string,
    currentToken: string,
    nextToken: string,
    nowInput: unknown,
  ): OnlineCloudflareCapabilityRotationResponseV1 {
    if (!isApplicationId(participantId) || !isToken(currentToken) || !isToken(nextToken)) {
      throw new OnlineCloudflareSecurityError('INVALID_INPUT');
    }
    return this.storage.transactionSync(() => {
      const snapshot = this.read(state);
      const now = validateClock(snapshot, nowInput);
      const grant = snapshot.grants.find((candidate) => candidate.participantId === participantId);
      if (grant === undefined || !isToken(currentToken) || grant.currentToken !== currentToken || now >= grant.expiresAt) {
        this.appendAudit(snapshot, now, grant === undefined ? null : grant, null, grant !== undefined && now >= grant.expiresAt ? 'CAPABILITY_EXPIRED' : 'CAPABILITY_REJECTED', 'rejected');
        throw new OnlineCloudflareSecurityError('CAPABILITY_REJECTED');
      }
      if (nextToken === currentToken || snapshot.grants.some((candidate) =>
        candidate.currentToken === nextToken
        || candidate.retiredCapabilities.some((retired) => retired.expiresAt > now && retired.token === nextToken))) {
        throw new OnlineCloudflareSecurityError('ROTATION_CONFLICT');
      }
      const configured = configuredGrants(state).map((candidate) => candidate.protocolCapability);
      if (hasCapabilityFragment(nextToken, configured)) throw new OnlineCloudflareSecurityError('ROTATION_CONFLICT');
      const httpWindow = windowValue(grant.httpWindowStartedAt, now, ONLINE_CLOUDFLARE_HTTP_BEARER_WINDOW_MS_V1, grant.httpCount);
      const rotationWindow = windowValue(grant.rotationWindowStartedAt, now, ONLINE_CLOUDFLARE_ROTATION_WINDOW_MS_V1, grant.rotationCount);
      if (httpWindow.count >= ONLINE_CLOUDFLARE_MAX_HTTP_BEARER_ACTIONS_PER_WINDOW_V1 || rotationWindow.count >= ONLINE_CLOUDFLARE_MAX_ROTATIONS_PER_WINDOW_V1) {
        this.appendAudit(snapshot, now, grant, null, 'RATE_REJECTED', 'rejected');
        throw new OnlineCloudflareSecurityError('RATE_LIMITED');
      }
      const retained = grant.retiredCapabilities.filter((retired) => retired.expiresAt > now);
      const retiredCapabilities = grant.generation === 0
        ? retained
        : [...retained, Object.freeze({ token: grant.currentToken, generation: grant.generation, expiresAt: grant.expiresAt })];
      if (retiredCapabilities.length > ONLINE_CLOUDFLARE_MAX_RETIRED_CAPABILITIES_PER_GRANT_V1) {
        this.appendAudit(snapshot, now, grant, null, 'RATE_REJECTED', 'rejected');
        throw new OnlineCloudflareSecurityError('RATE_LIMITED');
      }
      const generation = safeAdd(grant.generation, 1);
      const expiresAt = safeAdd(now, ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1);
      this.updateGrant(
        grant,
        nextToken,
        generation,
        now,
        expiresAt,
        httpWindow.startedAt,
        safeAdd(httpWindow.count, 1),
        rotationWindow.startedAt,
        safeAdd(rotationWindow.count, 1),
        Object.freeze(retiredCapabilities),
      );
      const currentLease = snapshot.leases.find((lease) => lease.participantId === participantId);
      const deleted = currentLease === undefined
        ? rows(this.storage.sql.exec<{ participant_id: unknown }>(DELETE_LEASE, state.room.roomId, participantId, generation, 'socket', null, null, 0))
        : rows(this.storage.sql.exec<{ participant_id: unknown }>(
          DELETE_LEASE,
          currentLease.roomId,
          currentLease.participantId,
          currentLease.capabilityGeneration,
          currentLease.holderKind,
          currentLease.connectionId,
          currentLease.connectionId,
          currentLease.expiresAt,
        ));
      if (deleted.length !== (currentLease === undefined ? 0 : 1)
        || deleted.some((row) => row.participant_id !== participantId)) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
      this.appendAuditAfterWrites(snapshot, now, participantId, null, grant.authority, generation, 'CAPABILITY_ROTATED', 'accepted');
      const verified = this.read(state);
      const verifiedGrant = verified.grants.find((candidate) => candidate.participantId === participantId);
      if (verifiedGrant?.currentToken !== nextToken || verifiedGrant.generation !== generation
        || verifiedGrant.retiredCapabilities.length !== retiredCapabilities.length
        || verified.state.lastObservedAt !== now) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
      return Object.freeze({
        kind: 'online-cloudflare-capability-rotated-v1' as const,
        schemaVersion: ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1,
        roomId: state.room.roomId,
        participantId,
        authority: grant.authority,
        generation,
        expiresAt,
      });
    });
  }

  acquireControllerLease(
    state: OnlineProtocolStateV1,
    participantId: string,
    generation: number,
    holder: OnlineCloudflareControllerHolderV1,
    nowInput: unknown,
  ): boolean {
    return this.storage.transactionSync(() => {
      const snapshot = this.read(state);
      const now = validateClock(snapshot, nowInput);
      const grant = snapshot.grants.find((candidate) => candidate.participantId === participantId);
      if (grant === undefined || (grant.authority !== 'host' && grant.authority !== 'seat') || grant.generation !== generation) throw new OnlineCloudflareSecurityError('CAPABILITY_REJECTED');
      const current = snapshot.leases.find((lease) => lease.participantId === participantId);
      const expiresAt = safeAdd(now, ONLINE_CLOUDFLARE_CONTROLLER_LEASE_LIFETIME_MS_V1);
      if (current !== undefined && now < current.expiresAt && !sameHolder(current, generation, holder)) {
        this.appendAudit(snapshot, now, grant, holder.connectionId, 'LEASE_CONFLICT', 'rejected');
        return false;
      }
      if (current === undefined) {
        this.storage.sql.exec(INSERT_LEASE, state.room.roomId, participantId, generation, holder.kind, holder.connectionId, expiresAt);
      } else {
        const updated = rows(this.storage.sql.exec<{ participant_id: unknown }>(UPDATE_LEASE, generation, holder.kind, holder.connectionId, expiresAt, state.room.roomId, participantId, current.capabilityGeneration, current.holderKind, current.connectionId, current.connectionId, current.expiresAt));
        if (updated.length !== 1) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
      }
      this.updateSecurityState(snapshot.state, now, snapshot.state.nextConnectionId, snapshot.state.droppedAuditCount);
      const verified = this.read(state).leases.find((lease) => lease.participantId === participantId);
      if (verified === undefined || verified.expiresAt !== expiresAt || !sameHolder(verified, generation, holder)) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
      return true;
    });
  }

  releaseControllerLease(
    state: OnlineProtocolStateV1,
    participantId: string,
    generation: number,
    holder: OnlineCloudflareControllerHolderV1,
    nowInput: unknown,
  ): void {
    this.storage.transactionSync(() => {
      const snapshot = this.read(state);
      const now = validateClock(snapshot, nowInput);
      const current = snapshot.leases.find((lease) => lease.participantId === participantId);
      if (current === undefined || !sameHolder(current, generation, holder)) return;
      const deleted = rows(this.storage.sql.exec<{ participant_id: unknown }>(DELETE_LEASE, state.room.roomId, participantId, generation, holder.kind, holder.connectionId, holder.connectionId, current.expiresAt));
      if (deleted.length !== 1 || deleted.some((row) => row.participant_id !== participantId)) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
      this.updateSecurityState(snapshot.state, now, snapshot.state.nextConnectionId, snapshot.state.droppedAuditCount);
      if (this.read(state).leases.some((lease) => lease.participantId === participantId)) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
    });
  }

  recordAudit(
    state: OnlineProtocolStateV1,
    participantId: string | null,
    connectionId: number | null,
    authority: OnlineCloudflareSecurityAuthorityV1 | null,
    generation: number | null,
    eventCode: OnlineCloudflareSecurityAuditCodeV1,
    outcome: OnlineCloudflareSecurityAuditOutcomeV1,
    nowInput: unknown,
  ): void {
    this.storage.transactionSync(() => {
      const snapshot = this.read(state);
      const now = validateClock(snapshot, nowInput);
      this.appendAuditAfterWrites(snapshot, now, participantId, connectionId, authority, generation, eventCode, outcome);
    });
  }

  private recordAuditSafe(
    state: OnlineProtocolStateV1,
    now: number,
    grant: Grant | null,
    connectionId: number | null,
    eventCode: OnlineCloudflareSecurityAuditCodeV1,
    outcome: OnlineCloudflareSecurityAuditOutcomeV1,
  ): void {
    try {
      this.recordAudit(state, grant?.participantId ?? null, connectionId, grant?.authority ?? null, grant?.generation ?? null, eventCode, outcome, now);
    } catch {
      /* A rejected action remains rejected when audit persistence is unavailable. */
    }
  }

  private updateSecurityState(previous: SecurityState, lastObservedAt: number, nextConnectionId: number, droppedAuditCount: number): void {
    const updated = rows(this.storage.sql.exec<{ singleton: unknown }>(UPDATE_SECURITY_STATE, lastObservedAt, nextConnectionId, droppedAuditCount, previous.roomId, previous.lastObservedAt, previous.nextConnectionId, previous.droppedAuditCount, previous.grantCount));
    if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
    const verifiedRows = rows(this.storage.sql.exec<SecurityStateRow>(SELECT_SECURITY_STATE));
    if (verifiedRows.length !== 1) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
    const verifiedRow = verifiedRows[0];
    if (verifiedRow === undefined) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
    const verified = rowState(verifiedRow);
    if (verified.roomId !== previous.roomId || verified.lastObservedAt !== lastObservedAt || verified.nextConnectionId !== nextConnectionId || verified.droppedAuditCount !== droppedAuditCount || verified.grantCount !== previous.grantCount) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
  }

  private updateGrantCounters(grant: Grant, httpStartedAt: number, httpCount: number, rotationStartedAt: number, rotationCount: number): Grant {
    const updated = rows(this.storage.sql.exec<{ participant_id: unknown }>(UPDATE_GRANT_COUNTERS, httpStartedAt, httpCount, rotationStartedAt, rotationCount, grant.roomId, grant.participantId, grant.currentToken, grant.generation, grant.issuedAt, grant.expiresAt, grant.httpWindowStartedAt, grant.httpCount, grant.rotationWindowStartedAt, grant.rotationCount, serializeRetiredCapabilities(grant.retiredCapabilities)));
    if (updated.length !== 1) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
    return Object.freeze({ ...grant, httpWindowStartedAt: httpStartedAt, httpCount, rotationWindowStartedAt: rotationStartedAt, rotationCount });
  }

  private updateGrant(grant: Grant, token: string, generation: number, issuedAt: number, expiresAt: number, httpStartedAt: number, httpCount: number, rotationStartedAt: number, rotationCount: number, retiredCapabilities: readonly RetiredCapability[]): void {
    const updated = rows(this.storage.sql.exec<{ participant_id: unknown }>(UPDATE_GRANT, token, generation, issuedAt, expiresAt, httpStartedAt, httpCount, rotationStartedAt, rotationCount, serializeRetiredCapabilities(retiredCapabilities), grant.roomId, grant.participantId, grant.currentToken, grant.generation, grant.issuedAt, grant.expiresAt, grant.httpWindowStartedAt, grant.httpCount, grant.rotationWindowStartedAt, grant.rotationCount, serializeRetiredCapabilities(grant.retiredCapabilities)));
    if (updated.length !== 1) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
  }

  private appendAudit(snapshot: SecuritySnapshot, observedAt: number, grant: Grant | null, connectionId: number | null, eventCode: OnlineCloudflareSecurityAuditCodeV1, outcome: OnlineCloudflareSecurityAuditOutcomeV1): void {
    this.appendAuditAfterWrites(snapshot, observedAt, grant?.participantId ?? null, connectionId, grant?.authority ?? null, grant?.generation ?? null, eventCode, outcome);
  }

  private appendAuditAfterWrites(snapshot: SecuritySnapshot, observedAt: number, participantId: string | null, connectionId: number | null, authority: OnlineCloudflareSecurityAuthorityV1 | null, generation: number | null, eventCode: OnlineCloudflareSecurityAuditCodeV1, outcome: OnlineCloudflareSecurityAuditOutcomeV1): void {
    if (participantId !== null && !isApplicationId(participantId)) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    if (connectionId !== null && !isSafePositiveInteger(connectionId)) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    if (authority !== null && !isAuthority(authority)) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    if (generation !== null && !isSafeInteger(generation)) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    if (!isAuditCode(eventCode) || !isOutcome(outcome)) throw new OnlineCloudflareSecurityError('INVALID_SECURITY_STATE');
    if (snapshot.audit.length >= ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1) {
      this.updateSecurityState(snapshot.state, observedAt, snapshot.state.nextConnectionId, safeAdd(snapshot.state.droppedAuditCount, 1));
      return;
    }
    const auditId = snapshot.audit.length === 0 ? 1 : safeAdd(snapshot.audit[snapshot.audit.length - 1]?.auditId ?? 0, 1);
    this.storage.sql.exec(INSERT_AUDIT, auditId, snapshot.state.roomId, participantId, connectionId, authority, generation, eventCode, outcome, observedAt);
    this.updateSecurityState(snapshot.state, observedAt, snapshot.state.nextConnectionId, snapshot.state.droppedAuditCount);
    const inserted = this.readAuditOnly();
    if (inserted.length !== snapshot.audit.length + 1 || inserted[inserted.length - 1]?.auditId !== auditId) throw new OnlineCloudflareSecurityError('CAS_CONFLICT');
  }

  private readAuditOnly(): readonly AuditFact[] {
    return Object.freeze(rows(this.storage.sql.exec<AuditRow>(SELECT_AUDIT)).map(rowAudit));
  }
}

function sameHolder(lease: Lease, generation: number, holder: OnlineCloudflareControllerHolderV1): boolean {
  return lease.capabilityGeneration === generation && lease.holderKind === holder.kind && lease.connectionId === holder.connectionId;
}

export function isOnlineCloudflareSecurityCapabilityV1(value: unknown): value is string {
  return isToken(value);
}

export function isOnlineCloudflareSecurityClockV1(value: unknown): value is number {
  return isSafeInteger(value);
}

export function createOnlineCloudflareCapabilityRotationResponseV1(
  roomId: string,
  participantId: string,
  authority: OnlineCloudflareSecurityAuthorityV1,
  generation: number,
  expiresAt: number,
): OnlineCloudflareCapabilityRotationResponseV1 {
  return Object.freeze({
    kind: 'online-cloudflare-capability-rotated-v1',
    schemaVersion: ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1,
    roomId,
    participantId,
    authority,
    generation,
    expiresAt,
  });
}
