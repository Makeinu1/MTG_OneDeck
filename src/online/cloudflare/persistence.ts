import {
  handleOnlineCommandEnvelopeV1,
  validateOnlineCommandEnvelopeV1,
  validateOnlineProtocolStateV1,
  type OnlineCommandEnvelopeV1,
  type OnlineProtocolStateV1,
} from '../protocol/index';
import { coreSha256HexV1 } from '../../engine/core/index';
import {
  assertNoConfiguredCapabilityFragmentV1,
  deserializeOnlineCloudflareProtocolStateV1,
  serializeAcceptedCoreCommandV1,
  serializeOnlineCloudflareProtocolStateV1,
} from './codec';
import {
  ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1,
  ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2,
  ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1,
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
  type OnlineCloudflareRoomStatusV1,
  type OnlineCloudflareSqlStorage,
} from './types';
import { OnlineCloudflareSecurityRepository } from './security';
import { emitRecoveryFactV1, emitFailureFactV1, isCanonicalVersionIdentifier } from './facts';
import {
  validateOnlineFormingLobbyV1,
  invalidateOnlineFormingLobbySeatDeckV1,
  validateOnlineLobbyAdmissionV3,
  claimOnlineLobbyAdmissionV3,
  rotateOnlineLobbyAdmissionV3,
  closeOnlineLobbyAdmissionV3,
  type OnlineFormingLobbyV1,
  type OnlineLobbyAdmissionV3,
} from '../lobby/index';
import {
  authorizeOnlineFormingLobbySeatV1,
} from '../lobby/index';
import {
  canonicalDeckSubmissionInputV2,
  contentDigestOfDeckSubmissionV2,
  ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2,
  parseOnlineDeckSubmitV2,
  resolveOnlineDeckSubmissionV2,
  isCanonicalScryfallIdV2,
  isOnlineRoomApplicationIdV1,
  isOnlineRoomSeatCapabilityV1,
  assertSafeOnlineDeckMetadataV2,
  type OnlineDeckResolverV2,
  type OnlineDeckSubmissionHeadV2,
  type OnlineDeckSubmissionIssueV2,
  type OnlineDeckSubmissionResultV2,
  type OnlineDeckSubmitV2,
  type OnlineDeckSubmissionStateV2,
  type OnlineFormingLobbyProjectionV2,
} from '../deckSubmission/index';
import { buildDynamicRoomGenesisV2, buildVariableRoomGenesisV3, type DynamicGenesisSeatInputV2, type VariableGenesisSeatInputV3 } from '../genesis/index';
import { handleOnlineVariableCommandEnvelopeV2, validateOnlineVariableProtocolStateV2, type OnlineVariableProtocolStateV2 } from '../protocol/index';
import type { OnlineDynamicStartResultV2 } from './types';
import { isOnlineVariableProjectionWithinFrameBudgetV1 } from './projectionBudgetV1';
import { validateOnlineVariableLobbyV4, projectOnlineVariableLobbyV4, setOnlineVariableLobbyDeckAcceptedV4, setOnlineVariableLobbyReadyV4, rotateOnlineVariableLobbyAdmissionV4, closeOnlineVariableLobbyAdmissionV4, replaceOnlineVariableLobbySeatV4, type OnlineVariableLobbyV4, type OnlineVariableLobbyProjectionV4 } from '../lobby/index';
import {
  createOnlinePregameLifecycleV1,
  handleOnlinePregameCommandEnvelopeV1,
  projectOnlinePregameV1,
  replayOnlinePregameLifecycleV1,
  validateOnlinePregameCommandEnvelopeV1,
  validateOnlinePregameStateV1,
  type OnlinePregameCommandResponseV1,
  type OnlinePregameProjectionV1,
  type OnlinePregameRandomPlanV1,
  type OnlinePregameStateV1,
} from '../pregame/index';

const CREATE_ROOM = `CREATE TABLE IF NOT EXISTS online_room_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, revision INTEGER NOT NULL, room_lifecycle TEXT NOT NULL, accepted_command_count INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT`;
const CREATE_VARIABLE_ROOM = `CREATE TABLE IF NOT EXISTS online_variable_room_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, revision INTEGER NOT NULL, room_lifecycle TEXT NOT NULL, state_json TEXT NOT NULL) STRICT`;
const SELECT_VARIABLE_ROOM = `SELECT singleton, schema_version, room_id, revision, room_lifecycle, state_json FROM online_variable_room_state WHERE singleton = 1`;
const CREATE_PREGAME = `CREATE TABLE IF NOT EXISTS online_pregame_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, revision INTEGER NOT NULL, phase TEXT NOT NULL, initial_state_json TEXT NOT NULL, state_json TEXT NOT NULL) STRICT`;
const SELECT_PREGAME = `SELECT singleton, schema_version, room_id, revision, phase, initial_state_json, state_json FROM online_pregame_state WHERE singleton = 1`;
const CREATE_JOURNAL = `CREATE TABLE IF NOT EXISTS online_accepted_command (accepted_revision INTEGER NOT NULL PRIMARY KEY, command_id TEXT NOT NULL UNIQUE, participant_id TEXT NOT NULL, base_revision INTEGER NOT NULL, command_json TEXT NOT NULL) STRICT`;
const CREATE_MIGRATION = `CREATE TABLE IF NOT EXISTS online_application_migration (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL) STRICT`;
const CREATE_CHECKPOINT = `CREATE TABLE IF NOT EXISTS online_recovery_checkpoint (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), room_id TEXT NOT NULL, checkpoint_revision INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT`;
const CREATE_RECOVERY_VERIFICATION = `CREATE TABLE IF NOT EXISTS online_recovery_verification (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), room_id TEXT NOT NULL, version_identifier TEXT NOT NULL, verified_revision INTEGER NOT NULL, checkpoint_revision INTEGER NOT NULL, journal_count INTEGER NOT NULL, checkpoint_digest TEXT NOT NULL) STRICT`;
const CREATE_LOBBY = `CREATE TABLE IF NOT EXISTS online_forming_lobby (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, state_json TEXT NOT NULL) STRICT`;
const CREATE_ADMISSION = `CREATE TABLE IF NOT EXISTS online_lobby_admission (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, state_json TEXT NOT NULL) STRICT`;
const CREATE_TABLE_CREDENTIALS = `CREATE TABLE IF NOT EXISTS online_lobby_table_credentials (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), room_id TEXT NOT NULL, participant_id TEXT NOT NULL, capability TEXT NOT NULL) STRICT`;
const CREATE_REVOKED = `CREATE TABLE IF NOT EXISTS online_lobby_revoked_credential (room_id TEXT NOT NULL, participant_id TEXT NOT NULL, seat_capability TEXT NOT NULL, PRIMARY KEY (room_id, participant_id, seat_capability)) STRICT`;
const SELECT_ROOM = `SELECT singleton, schema_version, room_id, revision, room_lifecycle, accepted_command_count, state_json FROM online_room_state WHERE singleton = 1`;
const SELECT_JOURNAL = `SELECT accepted_revision, command_id, participant_id, base_revision, command_json FROM online_accepted_command ORDER BY accepted_revision`;
const INSERT_ROOM = `INSERT INTO online_room_state (singleton, schema_version, room_id, revision, room_lifecycle, accepted_command_count, state_json) VALUES (?, ?, ?, ?, ?, ?, ?)`;
const INSERT_JOURNAL = `INSERT INTO online_accepted_command (accepted_revision, command_id, participant_id, base_revision, command_json) VALUES (?, ?, ?, ?, ?)`;
const UPDATE_ROOM = `UPDATE online_room_state SET revision = ?, room_lifecycle = ?, accepted_command_count = ?, state_json = ? WHERE singleton = 1 AND room_id = ? AND revision = ?`;
const VERIFY_ROOM = `SELECT singleton FROM online_room_state WHERE singleton = ? AND room_id = ? AND revision = ?`;
const UPDATE_PRESENCE = `UPDATE online_room_state SET room_lifecycle = ?, state_json = ? WHERE singleton = 1 AND room_id = ? AND revision = ? AND state_json = ? RETURNING singleton`;
const VERIFY_PRESENCE = `SELECT singleton FROM online_room_state WHERE singleton = 1 AND room_id = ? AND revision = ? AND room_lifecycle = ? AND state_json = ?`;
const SELECT_MIGRATION = 'SELECT singleton, schema_version FROM online_application_migration ORDER BY singleton';
const INSERT_MIGRATION = 'INSERT INTO online_application_migration (singleton, schema_version) VALUES (1, ?)';
const UPDATE_MIGRATION = 'UPDATE online_application_migration SET schema_version = ? WHERE singleton = 1 AND schema_version = ? RETURNING singleton';
const SELECT_CHECKPOINT = 'SELECT singleton, room_id, checkpoint_revision, state_json FROM online_recovery_checkpoint WHERE singleton = 1';
const INSERT_CHECKPOINT = 'INSERT INTO online_recovery_checkpoint (singleton, room_id, checkpoint_revision, state_json) VALUES (1, ?, ?, ?)';
const UPDATE_CHECKPOINT = 'UPDATE online_recovery_checkpoint SET room_id = ?, checkpoint_revision = ?, state_json = ? WHERE singleton = 1 AND room_id = ? AND checkpoint_revision = ? RETURNING singleton';
const SELECT_RECOVERY_VERIFICATION = 'SELECT singleton, room_id, version_identifier, verified_revision, checkpoint_revision, journal_count, checkpoint_digest FROM online_recovery_verification WHERE singleton = 1';
const INSERT_RECOVERY_VERIFICATION = 'INSERT INTO online_recovery_verification (singleton, room_id, version_identifier, verified_revision, checkpoint_revision, journal_count, checkpoint_digest) VALUES (1, ?, ?, ?, ?, ?, ?)';
const UPDATE_RECOVERY_VERIFICATION = 'UPDATE online_recovery_verification SET room_id = ?, version_identifier = ?, verified_revision = ?, checkpoint_revision = ?, journal_count = ?, checkpoint_digest = ? WHERE singleton = 1 AND room_id = ? AND version_identifier = ? AND verified_revision = ? AND checkpoint_revision = ? AND journal_count = ? AND checkpoint_digest = ? RETURNING singleton';
const SELECT_LOBBY = 'SELECT singleton, schema_version, room_id, state_json FROM online_forming_lobby WHERE singleton = 1';
const SELECT_ADMISSION = 'SELECT singleton, schema_version, room_id, state_json FROM online_lobby_admission WHERE singleton = 1';
const SELECT_TABLE_CREDENTIALS = 'SELECT singleton, room_id, participant_id, capability FROM online_lobby_table_credentials WHERE singleton = 1';
const SELECT_REVOKED = 'SELECT room_id, participant_id, seat_capability FROM online_lobby_revoked_credential WHERE room_id = ? AND participant_id = ? AND seat_capability = ?';
const INSERT_LOBBY = 'INSERT INTO online_forming_lobby (singleton, schema_version, room_id, state_json) VALUES (1, ?, ?, ?)';
const INSERT_ADMISSION = 'INSERT INTO online_lobby_admission (singleton, schema_version, room_id, state_json) VALUES (1, ?, ?, ?)';
const INSERT_TABLE_CREDENTIALS = 'INSERT INTO online_lobby_table_credentials (singleton, room_id, participant_id, capability) VALUES (1, ?, ?, ?)';
const INSERT_REVOKED = 'INSERT OR IGNORE INTO online_lobby_revoked_credential (room_id, participant_id, seat_capability) VALUES (?, ?, ?)';
const TRIM_REVOKED = 'DELETE FROM online_lobby_revoked_credential WHERE room_id = ? AND rowid NOT IN (SELECT rowid FROM online_lobby_revoked_credential WHERE room_id = ? ORDER BY rowid DESC LIMIT 64)';
const UPDATE_LOBBY = 'UPDATE online_forming_lobby SET room_id = ?, state_json = ? WHERE singleton = 1 AND room_id = ? AND state_json = ? RETURNING singleton';
const UPDATE_ADMISSION = 'UPDATE online_lobby_admission SET room_id = ?, state_json = ? WHERE singleton = 1 AND room_id = ? AND state_json = ? RETURNING singleton';
const CREATE_DECK_HEAD = `CREATE TABLE IF NOT EXISTS online_deck_submission_head_v2 (room_id TEXT NOT NULL, seat_index INTEGER NOT NULL CHECK (seat_index BETWEEN 0 AND 3), participant_id TEXT NOT NULL, deck_id TEXT NOT NULL, submission_id TEXT NOT NULL, content_digest TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 0), state TEXT NOT NULL CHECK (state IN ('none', 'resolving', 'accepted', 'needs-attention')), snapshot_digest TEXT, PRIMARY KEY (room_id, seat_index)) STRICT`;
const CREATE_DECK_HISTORY = `CREATE TABLE IF NOT EXISTS online_deck_submission_history_v2 (room_id TEXT NOT NULL, seat_index INTEGER NOT NULL CHECK (seat_index BETWEEN 0 AND 3), submission_id TEXT NOT NULL, participant_id TEXT NOT NULL, deck_id TEXT NOT NULL, canonical_input TEXT NOT NULL, content_digest TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 0), state TEXT NOT NULL CHECK (state IN ('resolving', 'accepted', 'needs-attention')), issues_json TEXT NOT NULL, PRIMARY KEY (room_id, seat_index, submission_id)) STRICT`;
const CREATE_DECK_SNAPSHOT = `CREATE TABLE IF NOT EXISTS online_deck_submission_snapshot_v2 (room_id TEXT NOT NULL, seat_index INTEGER NOT NULL CHECK (seat_index BETWEEN 0 AND 3), snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64), snapshot_json TEXT NOT NULL, PRIMARY KEY (room_id, seat_index)) STRICT`;
const CREATE_DECK_READY = `CREATE TABLE IF NOT EXISTS online_deck_submission_ready_v2 (room_id TEXT NOT NULL, seat_index INTEGER NOT NULL CHECK (seat_index BETWEEN 0 AND 3), ready INTEGER NOT NULL CHECK (ready IN (0, 1)), PRIMARY KEY (room_id, seat_index)) STRICT`;
const SELECT_DECK_HEADS = 'SELECT room_id, seat_index, participant_id, deck_id, submission_id, content_digest, revision, state, snapshot_digest FROM online_deck_submission_head_v2 WHERE room_id = ? ORDER BY seat_index';
const SELECT_DECK_HEAD = 'SELECT room_id, seat_index, participant_id, deck_id, submission_id, content_digest, revision, state, snapshot_digest FROM online_deck_submission_head_v2 WHERE room_id = ? AND seat_index = ?';
const SELECT_DECK_HISTORY = 'SELECT room_id, seat_index, submission_id, participant_id, deck_id, canonical_input, content_digest, revision, state, issues_json FROM online_deck_submission_history_v2 WHERE room_id = ? AND seat_index = ? AND submission_id = ?';
const SELECT_DECK_HISTORY_SEAT = 'SELECT room_id, seat_index, submission_id, participant_id, deck_id, canonical_input, content_digest, revision, state, issues_json FROM online_deck_submission_history_v2 WHERE room_id = ? AND seat_index = ? ORDER BY submission_id';
const SELECT_DECK_SNAPSHOT = 'SELECT room_id, seat_index, snapshot_digest, snapshot_json FROM online_deck_submission_snapshot_v2 WHERE room_id = ? AND seat_index = ?';
const INSERT_DECK_HEAD = 'INSERT INTO online_deck_submission_head_v2 (room_id, seat_index, participant_id, deck_id, submission_id, content_digest, revision, state, snapshot_digest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
const UPDATE_DECK_HEAD = 'UPDATE online_deck_submission_head_v2 SET participant_id = ?, deck_id = ?, submission_id = ?, content_digest = ?, revision = ?, state = ?, snapshot_digest = ? WHERE room_id = ? AND seat_index = ? AND revision = ? RETURNING seat_index';
const INVALIDATE_DECK_HEAD = 'UPDATE online_deck_submission_head_v2 SET revision = ?, state = ?, snapshot_digest = NULL WHERE room_id = ? AND seat_index = ? AND revision = ? RETURNING seat_index';
const INSERT_DECK_HISTORY = 'INSERT INTO online_deck_submission_history_v2 (room_id, seat_index, submission_id, participant_id, deck_id, canonical_input, content_digest, revision, state, issues_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const UPDATE_DECK_HISTORY = 'UPDATE online_deck_submission_history_v2 SET participant_id = ?, deck_id = ?, canonical_input = ?, content_digest = ?, revision = ?, state = ?, issues_json = ? WHERE room_id = ? AND seat_index = ? AND submission_id = ? RETURNING submission_id';
const DELETE_DECK_SNAPSHOT = 'DELETE FROM online_deck_submission_snapshot_v2 WHERE room_id = ? AND seat_index = ?';
const INSERT_DECK_SNAPSHOT = 'INSERT INTO online_deck_submission_snapshot_v2 (room_id, seat_index, snapshot_digest, snapshot_json) VALUES (?, ?, ?, ?)';
const SELECT_DECK_READY = 'SELECT room_id, seat_index, ready FROM online_deck_submission_ready_v2 WHERE room_id = ? ORDER BY seat_index';
const SELECT_DECK_READY_SEAT = 'SELECT room_id, seat_index, ready FROM online_deck_submission_ready_v2 WHERE room_id = ? AND seat_index = ?';
const INSERT_DECK_READY = 'INSERT INTO online_deck_submission_ready_v2 (room_id, seat_index, ready) VALUES (?, ?, ?)';
const UPDATE_DECK_READY = 'UPDATE online_deck_submission_ready_v2 SET ready = ? WHERE room_id = ? AND seat_index = ? RETURNING seat_index';

type RoomRow = { singleton: unknown; schema_version: unknown; room_id: unknown; revision: unknown; room_lifecycle: unknown; accepted_command_count: unknown; state_json: unknown };
type JournalRow = { accepted_revision: unknown; command_id: unknown; participant_id: unknown; base_revision: unknown; command_json: unknown };
type MigrationRow = { singleton: unknown; schema_version: unknown };
type CheckpointRow = { singleton: unknown; room_id: unknown; checkpoint_revision: unknown; state_json: unknown };
type RecoveryVerificationRow = { singleton: unknown; room_id: unknown; version_identifier: unknown; verified_revision: unknown; checkpoint_revision: unknown; journal_count: unknown; checkpoint_digest: unknown };
type LobbyRow = { singleton: unknown; schema_version: unknown; room_id: unknown; state_json: unknown };
type AdmissionRow = { singleton: unknown; schema_version: unknown; room_id: unknown; state_json: unknown };
type TableCredentialRow = { singleton: unknown; room_id: unknown; participant_id: unknown; capability: unknown };
type DeckHeadRow = { room_id: unknown; seat_index: unknown; participant_id: unknown; deck_id: unknown; submission_id: unknown; content_digest: unknown; revision: unknown; state: unknown; snapshot_digest: unknown };
type DeckHistoryRow = DeckHeadRow & { canonical_input: unknown; issues_json: unknown };
type DeckSnapshotRow = { room_id: unknown; seat_index: unknown; snapshot_digest: unknown; snapshot_json: unknown };
type DeckReadyRow = { room_id: unknown; seat_index: unknown; ready: unknown };
type PregameRow = { singleton: unknown; schema_version: unknown; room_id: unknown; revision: unknown; phase: unknown; initial_state_json: unknown; state_json: unknown };
type RecoveryVerificationResult = Readonly<{ readonly checkpointRevision: number; readonly replayCount: number }>;
type MigrationRecoveryHandoff = RecoveryVerificationResult & Readonly<{ readonly roomId: string; readonly currentRevision: number; readonly versionIdentifier: string | null }>;

function exactSubmissionEnvelope(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const expected = ['kind', 'schemaVersion', 'participantId', 'seatCapability', 'deckId', 'submissionId', 'entries'];
  try {
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expected.length || !keys.every((key) => typeof key === 'string' && expected.includes(key))) return false;
    for (const key of expected) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return false;
    }
    return typeof value.participantId === 'string' && typeof value.seatCapability === 'string';
  } catch { return false; }
}

function closedSubmissionShape(value: Record<string, unknown>): boolean {
  const entries = value.entries;
  if (!Array.isArray(entries) || (Object.getPrototypeOf(entries) as object | null) !== Array.prototype) return false;
  for (let index = 0; index < entries.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(entries, index)) return false;
    const item: unknown = entries[index];
    if (!isRecord(item)) return false;
    const keys = Reflect.ownKeys(item);
    if (keys.length !== 4 || !keys.every((key) => typeof key === 'string' && ['section', 'quantity', 'scryfallId', 'oracleId'].includes(key))) return false;
    for (const key of ['section', 'quantity', 'scryfallId', 'oracleId']) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return false;
    }
  }
  return true;
}

function exactOwnKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  try {
    const own = Reflect.ownKeys(value);
    return own.length === keys.length && own.every((key) => typeof key === 'string' && keys.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch { return false; }
}

function secureRandomIndex(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 0x1_0000_0000) throw new Error('Invalid random range');
  const cryptoObject = globalThis.crypto;
  if (cryptoObject === undefined || typeof cryptoObject.getRandomValues !== 'function') throw new Error('Randomness unavailable');
  const range = 0x1_0000_0000;
  const ceiling = range - (range % limit);
  const sample = new Uint32Array(1);
  do { cryptoObject.getRandomValues(sample); } while ((sample[0] ?? range) >= ceiling);
  return (sample[0] ?? 0) % limit;
}

function shuffled<T>(values: readonly T[]): readonly T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    const current = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = current;
  }
  return Object.freeze(result);
}

function createServerPregamePlanV1(state: OnlineVariableProtocolStateV2): OnlinePregameRandomPlanV1 {
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const seatOrder = registry.turnOrder;
  const startingPlayerId = seatOrder[secureRandomIndex(seatOrder.length)];
  if (startingPlayerId === undefined) throw new Error('Missing starting player');
  const startIndex = seatOrder.indexOf(startingPlayerId);
  const turnOrder = Object.freeze([...seatOrder.slice(startIndex), ...seatOrder.slice(0, startIndex)]);
  const orderCount = seatOrder.length === 2 ? 8 : 9;
  const decisionBytes = new Uint32Array(4);
  globalThis.crypto.getRandomValues(decisionBytes);
  const decisionId = `pregame-${Array.from(decisionBytes, (value) => value.toString(16).padStart(8, '0')).join('')}`;
  const libraryPlans = seatOrder.map((playerId) => {
    const zones = registry.zones.byPlayer[playerId];
    if (zones === undefined) throw new Error('Missing player zones');
    const physicalIds = [...zones.library, ...zones.hand].map((objectId) => {
      const object = registry.objects[objectId];
      if (object?.kind !== 'card') throw new Error('Pregame library contains a non-card object');
      return object.physicalCardId;
    });
    const orders = Array.from({ length: orderCount }, () => shuffled(physicalIds));
    return Object.freeze({ playerId, orders: Object.freeze(orders) });
  });
  return Object.freeze({ kind: 'online-pregame-random-plan-v1', schemaVersion: 1, decisionId, startingPlayerId, turnOrder, libraryPlans: Object.freeze(libraryPlans) });
}

function denseArray(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || lengthDescriptor.get !== undefined || lengthDescriptor.set !== undefined) return false;
  const length: unknown = (lengthDescriptor as PropertyDescriptor & { readonly value: unknown }).value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) return false;
  let keys: readonly PropertyKey[];
  try { keys = Reflect.ownKeys(value); } catch { return false; }
  if (keys.length !== length + 1 || !keys.includes('length')) return false;
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return false;
  }
  return true;
}

function isSeatIndexRow(value: unknown, seatIndex: number): boolean {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype: object | null = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) return false;
    if (!exactOwnKeys(value, ['seat_index'])) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'seat_index');
    return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined && descriptor.value === seatIndex;
  } catch { return false; }
}

function canonicalRawDeckSubmissionInput(value: Record<string, unknown>, forbidden: readonly string[]): string | null {
  const deckId = value.deckId;
  const rawEntries = value.entries;
  if (typeof deckId !== 'string' || !Array.isArray(rawEntries) || Object.getPrototypeOf(rawEntries) !== Array.prototype) return null;
  const entries: Array<{ readonly section: string | number | boolean | null; readonly quantity: string | number | boolean | null; readonly scryfallId: string | number | boolean | null; readonly oracleId: string | number | boolean | null }> = [];
  for (const rawEntry of rawEntries) {
    if (!isRecord(rawEntry) || !exactOwnKeys(rawEntry, ['section', 'quantity', 'scryfallId', 'oracleId'])) return null;
    const section = rawEntry.section;
    const quantity = rawEntry.quantity;
    const scryfallId = rawEntry.scryfallId;
    const oracleId = rawEntry.oracleId;
    const scalar = (candidate: unknown): candidate is string | number | boolean | null => candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean' || (typeof candidate === 'number' && Number.isFinite(candidate));
    if (!scalar(section) || !scalar(quantity) || !scalar(scryfallId) || !scalar(oracleId)) return null;
    for (const candidate of [section, quantity, scryfallId, oracleId]) if (typeof candidate === 'string') {
      try { assertNoConfiguredCapabilityFragmentV1(candidate, forbidden); } catch { return null; }
    }
    entries.push({ section, quantity, scryfallId, oracleId });
  }
  const serialized = JSON.stringify({ deckId, entries });
  if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).length > ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2) return null;
  return serialized;
}

function isInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const VALID_PRODUCED_MANA = new Set(['W', 'U', 'B', 'R', 'G', 'C']);
const VALID_TOKEN_KINDS = new Set([
  'treasure', 'clue', 'food', 'blood', 'cursed-role', 'monster-role',
  'royal-role', 'sorcerer-role', 'virtuous-role', 'wicked-role',
  'young-hero-role',
]);
const OPTIONAL_FACE_STRING_FIELDS = [
  'printedName', 'manaCost', 'printedTypeLine', 'oracleText', 'printedText',
  'imageUrl', 'imageUrlSmall', 'power', 'toughness', 'loyalty', 'defense',
] as const;

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isOptionalString(record: Record<string, unknown>, key: string): boolean {
  return !Object.prototype.hasOwnProperty.call(record, key) || typeof record[key] === 'string';
}

function isBoundedSerialized(value: string): boolean {
  try {
    return new TextEncoder().encode(value).length <= ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1;
  } catch {
    return false;
  }
}

function checkpointDigest(value: string): string {
  return coreSha256HexV1(value);
}

function isCheckpointDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function comparablePresenceState(serialized: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('Invalid presence state JSON');
  }
  if (!isRecord(parsed) || !isRecord(parsed.room) || !Array.isArray(parsed.room.participants)) {
    throw new Error('Invalid presence state');
  }
  const room = parsed.room;
  const participants = room.participants as unknown[];
  const comparableParticipants = participants.map((participant: unknown) => {
    if (!isRecord(participant)) throw new Error('Invalid presence participant');
    const copy = { ...participant };
    copy.presence = '__presence__';
    return copy;
  });
  parsed.room = { ...room, lifecycle: '__lifecycle__', participants: comparableParticipants };
  return JSON.stringify(parsed);
}

export class OnlineCloudflareRepository {
  private readonly storage: OnlineCloudflareSqlStorage;
  private readonly securityRepository: OnlineCloudflareSecurityRepository;
  private readonly versionIdentifier: string | null;
  private migrationRecovery: MigrationRecoveryHandoff | null = null;
  private readonly deckInflight = new Map<string, Promise<OnlineDeckSubmissionResultV2>>();
  constructor(storage: OnlineCloudflareSqlStorage, createBaseSchema = true, versionIdentifier: string | null = null) {
    this.storage = storage;
    this.securityRepository = new OnlineCloudflareSecurityRepository(storage);
    if (versionIdentifier !== null && !isCanonicalVersionIdentifier(versionIdentifier)) throw new Error('Invalid Cloudflare version metadata');
    this.versionIdentifier = versionIdentifier;
    if (createBaseSchema) storage.transactionSync(() => {
      storage.sql.exec(CREATE_ROOM);
      storage.sql.exec(CREATE_JOURNAL);
    });
  }

  migrateApplicationSchema(): boolean {
    this.migrationRecovery = null;
    let pendingRecovery: MigrationRecoveryHandoff | null = null;
    const changed = this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_ROOM);
      this.storage.sql.exec(CREATE_VARIABLE_ROOM);
      this.storage.sql.exec(CREATE_JOURNAL);
      this.storage.sql.exec(CREATE_MIGRATION);
      this.storage.sql.exec(CREATE_CHECKPOINT);
      this.storage.sql.exec(CREATE_RECOVERY_VERIFICATION);
      this.storage.sql.exec(CREATE_DECK_HEAD);
      this.storage.sql.exec(CREATE_DECK_HISTORY);
      this.storage.sql.exec(CREATE_DECK_SNAPSHOT);
      this.storage.sql.exec(CREATE_DECK_READY);
      this.storage.sql.exec(CREATE_LOBBY);
      this.storage.sql.exec(CREATE_ADMISSION);
      this.storage.sql.exec(CREATE_TABLE_CREDENTIALS);
      this.storage.sql.exec(CREATE_REVOKED);
      const before = this.storage.sql.exec<MigrationRow>(SELECT_MIGRATION).toArray();
      if (before.length > 1 || (before[0] !== undefined && (before[0].singleton !== 1 || (before[0].schema_version !== ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1 && before[0].schema_version !== ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2)))) throw new Error('Invalid application migration ledger');
      const room = this.rows();
      if (room.length > 1) throw new Error('Invalid singleton state');
      const securityTables = this.securityRepository.migrationSchemaPresence();
      if (securityTables.length !== 0 && securityTables.length !== 4) throw new Error('Partial security schema');
      this.securityRepository.createSchemaInTransaction();
      if (room.length === 1) {
        const state = this.loadWithoutMigration();
        if (state === null) throw new Error('Missing protocol state');
        const security = this.securityRepository.migrationPresence();
        if (security.state === 0 && security.grants === 0 && security.leases === 0 && security.audit === 0) this.securityRepository.initializeInTransaction(state.room.roomId, state, Date.now());
        else this.securityRepository.read(state);
        const checkpoints = this.storage.sql.exec<CheckpointRow>(SELECT_CHECKPOINT).toArray();
        if (checkpoints.length === 0) this.storage.sql.exec(INSERT_CHECKPOINT, state.room.roomId, state.revision, serializeOnlineCloudflareProtocolStateV1(state));
        else if (checkpoints.length !== 1) throw new Error('Invalid recovery checkpoint');
        const cached = this.recoveryVerificationHit(state);
        if (cached === null) {
          const recovery = this.validateCheckpoint(state);
          this.writeRecoveryVerificationInTransaction(state, recovery.checkpointRevision);
          pendingRecovery = Object.freeze({
            ...recovery,
            roomId: state.room.roomId,
            currentRevision: state.revision,
            versionIdentifier: this.versionIdentifier,
          });
        }
      }
      if (before.length === 0) this.storage.sql.exec(INSERT_MIGRATION, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2);
      else if (before[0]?.schema_version === ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1) {
        const upgraded = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_MIGRATION, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1).toArray();
        if (upgraded.length !== 1 || upgraded[0]?.singleton !== 1) throw new Error('Application schema migration failed');
      }
      return before.length === 0 || before[0]?.schema_version === ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1;
    });
    this.migrationRecovery = pendingRecovery;
    return changed;
  }

  private loadWithoutMigration(): OnlineProtocolStateV1 | null {
    const rooms = this.rows();
    if (rooms.length === 0) return null;
    if (rooms.length !== 1) throw new Error('Invalid singleton state');
    const row = rooms[0];
    if (row === undefined || row.singleton !== 1 || row.schema_version !== ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1 || typeof row.room_id !== 'string' || !isInteger(row.revision) || typeof row.room_lifecycle !== 'string' || !isInteger(row.accepted_command_count) || typeof row.state_json !== 'string') throw new Error('Invalid state row');
    const state = deserializeOnlineCloudflareProtocolStateV1(row.state_json);
    if (state.room.roomId !== row.room_id || state.room.lifecycle !== row.room_lifecycle || state.revision !== row.revision || state.coreRoot.acceptedCommandCount !== row.accepted_command_count) throw new Error('State relation mismatch');
    const journal = this.storage.sql.exec<JournalRow>(SELECT_JOURNAL).toArray();
    if (journal.length !== state.revision) throw new Error('Journal count mismatch');
    journal.forEach((entry, index) => {
      if (!isInteger(entry.accepted_revision) || entry.accepted_revision !== index + 1 || typeof entry.command_id !== 'string' || typeof entry.participant_id !== 'string' || !isInteger(entry.base_revision) || entry.base_revision !== index || typeof entry.command_json !== 'string') throw new Error('Journal relation mismatch');
      this.validateJournalCommand(state, entry, entry.command_json);
    });
    return state;
  }

  private validateCheckpoint(state: OnlineProtocolStateV1): RecoveryVerificationResult {
    const checkpoints = this.storage.sql.exec<CheckpointRow>(SELECT_CHECKPOINT).toArray();
    if (checkpoints.length !== 1) throw new Error('Invalid recovery checkpoint');
    const checkpointRow = checkpoints[0];
    if (checkpointRow === undefined || checkpointRow.singleton !== 1 || checkpointRow.room_id !== state.room.roomId || !isInteger(checkpointRow.checkpoint_revision) || checkpointRow.checkpoint_revision > state.revision || typeof checkpointRow.state_json !== 'string') throw new Error('Invalid recovery checkpoint');
    const replayCount = state.revision - checkpointRow.checkpoint_revision;
    if (replayCount > 63) throw new Error('Recovery replay suffix exceeds bound');
    let rebuilt = deserializeOnlineCloudflareProtocolStateV1(checkpointRow.state_json);
    if (rebuilt.room.roomId !== state.room.roomId || rebuilt.revision !== checkpointRow.checkpoint_revision) throw new Error('Invalid recovery checkpoint relation');
    const currentParticipants = new Map(state.room.participants.map((participant) => [participant.participantId, participant]));
    for (const participant of rebuilt.room.participants) {
      const current = currentParticipants.get(participant.participantId);
      if (current === undefined || current.role !== participant.role || current.seatIndex !== participant.seatIndex) throw new Error('Invalid recovery presence relation');
    }
    if (rebuilt.room.participants.length !== state.room.participants.length) throw new Error('Invalid recovery participant relation');
    const journal = this.storage.sql.exec<JournalRow>(SELECT_JOURNAL).toArray();
    for (let index = checkpointRow.checkpoint_revision; index < journal.length; index += 1) {
      const entry = journal[index];
      if (entry === undefined) throw new Error('Missing journal suffix');
      const participant = rebuilt.room.participants.find((candidate) => candidate.participantId === entry.participant_id);
      const seat = participant === undefined || participant.role !== 'player' ? undefined : rebuilt.room.seats[participant.seatIndex];
      if (participant === undefined || seat === undefined) throw new Error('Invalid replay participant');
      const replayReady = validateOnlineProtocolStateV1({
        ...rebuilt,
        room: {
          ...rebuilt.room,
          participants: rebuilt.room.participants.map((candidate) => candidate.participantId === entry.participant_id
            ? { ...candidate, presence: 'connected' as const }
            : candidate),
        },
      });
      if (!replayReady.ok) throw new Error('Invalid replay presence view');
      let command: unknown;
      if (typeof entry.command_json !== 'string') throw new Error('Invalid replay command');
      try { command = JSON.parse(entry.command_json); } catch { throw new Error('Invalid replay command'); }
      const transition = handleOnlineCommandEnvelopeV1(replayReady.value, {
        kind: 'online-command-envelope-v1', protocolVersion: replayReady.value.protocolVersion, roomId: replayReady.value.room.roomId,
        participantId: entry.participant_id, participantCapability: seat.seatCapability,
        commandId: entry.command_id, baseRevision: entry.base_revision, command,
      });
      if (transition.response.kind !== 'online-command-ack-v1' || transition.response.duplicate || transition.state.revision !== index + 1) throw new Error('Recovery replay rejected');
      rebuilt = transition.state;
    }
    if (rebuilt.revision !== state.revision || comparablePresenceState(serializeOnlineCloudflareProtocolStateV1(rebuilt)) !== comparablePresenceState(serializeOnlineCloudflareProtocolStateV1(state))) throw new Error('Recovery state mismatch');
    return Object.freeze({ checkpointRevision: checkpointRow.checkpoint_revision, replayCount });
  }

  private recoveryVerificationHit(state: OnlineProtocolStateV1): RecoveryVerificationResult | null {
    if (this.versionIdentifier === null) return null;
    let checkpoints: CheckpointRow[];
    let markers: RecoveryVerificationRow[];
    try {
      checkpoints = this.storage.sql.exec<CheckpointRow>(SELECT_CHECKPOINT).toArray();
      markers = this.storage.sql.exec<RecoveryVerificationRow>(SELECT_RECOVERY_VERIFICATION).toArray();
    } catch {
      return null;
    }
    if (checkpoints.length !== 1 || markers.length !== 1) return null;
    const checkpoint = checkpoints[0];
    const marker = markers[0];
    if (
      checkpoint === undefined ||
      marker === undefined ||
      checkpoint.singleton !== 1 ||
      typeof checkpoint.room_id !== 'string' ||
      checkpoint.room_id !== state.room.roomId ||
      !isInteger(checkpoint.checkpoint_revision) ||
      checkpoint.checkpoint_revision > state.revision ||
      typeof checkpoint.state_json !== 'string' ||
      !isBoundedSerialized(checkpoint.state_json) ||
      marker.singleton !== 1 ||
      typeof marker.room_id !== 'string' ||
      marker.room_id !== state.room.roomId ||
      typeof marker.version_identifier !== 'string' ||
      !isCanonicalVersionIdentifier(marker.version_identifier) ||
      marker.version_identifier !== this.versionIdentifier ||
      !isInteger(marker.verified_revision) ||
      marker.verified_revision !== state.revision ||
      !isInteger(marker.checkpoint_revision) ||
      marker.checkpoint_revision !== checkpoint.checkpoint_revision ||
      !isInteger(marker.journal_count) ||
      marker.journal_count !== state.revision ||
      !isCheckpointDigest(marker.checkpoint_digest) ||
      marker.checkpoint_digest !== checkpointDigest(checkpoint.state_json)
    ) return null;
    const replayCount = state.revision - checkpoint.checkpoint_revision;
    if (replayCount > 63) return null;
    let checkpointState: OnlineProtocolStateV1;
    try {
      checkpointState = deserializeOnlineCloudflareProtocolStateV1(checkpoint.state_json);
    } catch {
      return null;
    }
    if (checkpointState.room.roomId !== state.room.roomId || checkpointState.revision !== checkpoint.checkpoint_revision) return null;
    return Object.freeze({ checkpointRevision: checkpoint.checkpoint_revision, replayCount });
  }

  private writeRecoveryVerificationInTransaction(state: OnlineProtocolStateV1, checkpointRevision: number): void {
    if (this.versionIdentifier === null) return;
    if (!isCanonicalVersionIdentifier(this.versionIdentifier) || !isInteger(checkpointRevision) || checkpointRevision > state.revision) throw new Error('Invalid recovery verification input');
    const checkpoints = this.storage.sql.exec<CheckpointRow>(SELECT_CHECKPOINT).toArray();
    if (checkpoints.length !== 1) throw new Error('Invalid recovery checkpoint');
    const checkpoint = checkpoints[0];
    if (checkpoint === undefined || checkpoint.singleton !== 1 || checkpoint.room_id !== state.room.roomId || checkpoint.checkpoint_revision !== checkpointRevision || typeof checkpoint.state_json !== 'string' || !isBoundedSerialized(checkpoint.state_json)) throw new Error('Invalid recovery checkpoint relation');
    const journal = this.storage.sql.exec<JournalRow>(SELECT_JOURNAL).toArray();
    if (journal.length !== state.revision) throw new Error('Journal count mismatch');
    const digest = checkpointDigest(checkpoint.state_json);
    this.storage.sql.exec(CREATE_RECOVERY_VERIFICATION);
    const markers = this.storage.sql.exec<RecoveryVerificationRow>(SELECT_RECOVERY_VERIFICATION).toArray();
    if (markers.length > 1) throw new Error('Invalid recovery verification marker');
    if (markers.length === 0) {
      this.storage.sql.exec(INSERT_RECOVERY_VERIFICATION, state.room.roomId, this.versionIdentifier, state.revision, checkpointRevision, journal.length, digest);
      return;
    }
    const previous = markers[0];
    if (previous === undefined) throw new Error('Invalid recovery verification marker');
    const updated = this.storage.sql.exec<{ singleton: unknown }>(
      UPDATE_RECOVERY_VERIFICATION,
      state.room.roomId,
      this.versionIdentifier,
      state.revision,
      checkpointRevision,
      journal.length,
      digest,
      previous.room_id,
      previous.version_identifier,
      previous.verified_revision,
      previous.checkpoint_revision,
      previous.journal_count,
      previous.checkpoint_digest,
    ).toArray();
    if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new Error('Recovery verification compare-and-set failed');
  }

  private rows(): RoomRow[] { return this.storage.sql.exec<RoomRow>(SELECT_ROOM).toArray(); }

  private statusFor(state: OnlineProtocolStateV1): OnlineCloudflareRoomStatusV1 {
    return Object.freeze({
      kind: 'online-cloudflare-room-status-v1',
      schemaVersion: ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
      roomId: state.room.roomId,
      revision: state.revision,
      roomLifecycle: state.room.lifecycle,
      acceptedCommandCount: state.coreRoot.acceptedCommandCount,
    });
  }

  private validateJournalCommand(
    state: OnlineProtocolStateV1,
    entry: JournalRow,
    commandJson: unknown,
  ): void {
    if (
      !isInteger(entry.accepted_revision) ||
      typeof entry.command_id !== 'string' ||
      typeof entry.participant_id !== 'string' ||
      !isInteger(entry.base_revision) ||
      typeof commandJson !== 'string'
    ) throw new Error('Invalid journal relation');
    const configuredCapabilities = [
      ...state.room.seats.map((seat) => seat.seatCapability),
      ...state.observerAuthorizations.map((authorization) => authorization.observerCapability),
    ];
    assertNoConfiguredCapabilityFragmentV1(entry.command_id, configuredCapabilities);
    assertNoConfiguredCapabilityFragmentV1(entry.participant_id, configuredCapabilities);
    const acceptedReceipt = state.receipts.find(
      (receipt) =>
        receipt.outcome.kind === 'accepted' &&
        receipt.outcome.acceptedRevision === entry.accepted_revision,
    );
    if (
      acceptedReceipt === undefined ||
      acceptedReceipt.participantId !== entry.participant_id ||
      acceptedReceipt.commandId !== entry.command_id ||
      acceptedReceipt.outcome.baseRevision !== entry.base_revision
    ) throw new Error('Journal receipt relation mismatch');
    let parsed: unknown;
    try {
      parsed = JSON.parse(commandJson);
    } catch {
      throw new Error('Invalid journal command JSON');
    }
    const participant = state.room.participants.find(
      (candidate) => candidate.participantId === entry.participant_id,
    );
    if (participant === undefined) throw new Error('Journal participant is not in the Room');
    if (participant.role !== 'player') throw new Error('Journal participant is not a player');
    const seat = state.room.seats[participant.seatIndex];
    if (seat === undefined) throw new Error('Journal participant seat is missing');
    const envelope: OnlineCommandEnvelopeV1 = {
      kind: 'online-command-envelope-v1',
      protocolVersion: state.protocolVersion,
      roomId: state.room.roomId,
      participantId: participant.participantId,
      participantCapability: seat.seatCapability,
      commandId: entry.command_id as OnlineCommandEnvelopeV1['commandId'],
      baseRevision: entry.base_revision,
      command: parsed as OnlineCommandEnvelopeV1['command'],
    };
    const validation = validateOnlineCommandEnvelopeV1(envelope);
    if (!validation.ok || JSON.stringify(validation.value.command) !== commandJson) {
      throw new Error('Invalid journal command');
    }
    serializeAcceptedCoreCommandV1(validation.value.command, configuredCapabilities);
  }

  load(): OnlineProtocolStateV1 | null {
    let state: OnlineProtocolStateV1 | null = null;
    try {
      state = this.loadWithoutMigration();
      if (state === null) return null;
      const verifiedState = state;
      const migrated = this.migrationRecovery;
      if (migrated !== null) {
        this.migrationRecovery = null;
        const cached = this.recoveryVerificationHit(verifiedState);
        const handoffMatches = cached !== null &&
          migrated.roomId === verifiedState.room.roomId &&
          migrated.currentRevision === verifiedState.revision &&
          migrated.versionIdentifier === this.versionIdentifier &&
          cached.checkpointRevision === migrated.checkpointRevision &&
          cached.replayCount === migrated.replayCount;
        if (handoffMatches) {
          emitRecoveryFactV1(migrated.checkpointRevision, verifiedState.revision, migrated.replayCount, 'ok', this.versionIdentifier, verifiedState.room.roomId);
          return verifiedState;
        }
        if (cached !== null) return verifiedState;
      }
      const cached = this.recoveryVerificationHit(verifiedState);
      if (cached !== null) return state;
      const recovery = this.validateCheckpoint(verifiedState);
      this.storage.transactionSync(() => this.writeRecoveryVerificationInTransaction(verifiedState, recovery.checkpointRevision));
      emitRecoveryFactV1(recovery.checkpointRevision, verifiedState.revision, recovery.replayCount, 'ok', this.versionIdentifier, verifiedState.room.roomId);
      return verifiedState;
    } catch (error: unknown) {
      emitFailureFactV1('recovery-failure', 'RECOVERY_FAILED', this.versionIdentifier, state?.room.roomId ?? null);
      throw error;
    }
  }

  loadLobby(roomId: string): OnlineFormingLobbyV1 | null {
    const rows = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray();
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error('Invalid forming lobby singleton');
    const row = rows[0];
    if (row === undefined || row.singleton !== 1 || row.schema_version !== 1 || row.room_id !== roomId || typeof row.state_json !== 'string') throw new Error('Invalid forming lobby row');
    let parsed: unknown;
    try { parsed = JSON.parse(row.state_json); } catch { throw new Error('Invalid forming lobby JSON'); }
    const validation = validateOnlineFormingLobbyV1(parsed);
    if (!validation.ok || JSON.stringify(validation.value) !== row.state_json) throw new Error('Invalid forming lobby state');
    return validation.value;
  }

  loadVariableLobbyV4(roomId: string): OnlineVariableLobbyV4 | null {
    let rows: readonly LobbyRow[];
    try { rows = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray(); } catch (error: unknown) { if (error instanceof Error && /Unexpected SQL/i.test(error.message)) return null; throw error; }
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error('Invalid forming lobby singleton');
    const row = rows[0];
    if (row === undefined || row.schema_version !== 4 || row.room_id !== roomId || typeof row.state_json !== 'string') return null;
    let parsed: unknown;
    try { parsed = JSON.parse(row.state_json); } catch { throw new Error('Invalid variable lobby JSON'); }
    const checked = validateOnlineVariableLobbyV4(parsed);
    if (!checked.ok || JSON.stringify(checked.value) !== row.state_json) throw new Error('Invalid variable lobby state');
    return checked.value;
  }

  initializeVariableLobbyV4(lobbyInput: OnlineVariableLobbyV4): void {
    const checked = validateOnlineVariableLobbyV4(lobbyInput);
    if (!checked.ok) throw new Error('Invalid variable lobby state');
    const stateJson = JSON.stringify(checked.value);
    this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_LOBBY);
      const rows = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray();
      if (rows.length > 1) throw new Error('Invalid forming lobby singleton');
      if (rows.length === 1) {
        const row = rows[0];
        if (row === undefined || row.room_id !== checked.value.roomId || row.schema_version !== 4 || row.state_json !== stateJson) throw new ConflictError();
        return;
      }
      this.storage.sql.exec(INSERT_LOBBY, 4, checked.value.roomId, stateJson);
    });
  }

  projectVariableLobbyV4(roomId: string, lobbyInput?: OnlineVariableLobbyV4): OnlineVariableLobbyProjectionV4 {
    const lobby = lobbyInput ?? this.loadVariableLobbyV4(roomId);
    if (lobby === null) throw new Error('Missing variable lobby');
    return projectOnlineVariableLobbyV4(lobby);
  }

  loadVariableProtocolV2(roomId: string): OnlineVariableProtocolStateV2 | null {
    let rows: readonly { readonly singleton: unknown; readonly schema_version: unknown; readonly room_id: unknown; readonly revision: unknown; readonly room_lifecycle: unknown; readonly state_json: unknown }[];
    try { rows = this.storage.sql.exec<{ readonly singleton: unknown; readonly schema_version: unknown; readonly room_id: unknown; readonly revision: unknown; readonly room_lifecycle: unknown; readonly state_json: unknown }>(SELECT_VARIABLE_ROOM).toArray(); } catch (error: unknown) { if (error instanceof Error && (/no such table/i.test(error.message) || /Unexpected SQL/i.test(error.message))) return null; throw error; }
    if (rows.length === 0) return null;
    const row = rows[0];
    if (rows.length !== 1 || row === undefined || row.schema_version !== 2 || row.room_id !== roomId || typeof row.state_json !== 'string') throw new Error('Invalid variable protocol row');
    let parsed: unknown; try { parsed = JSON.parse(row.state_json); } catch { throw new Error('Invalid variable protocol JSON'); }
    const checked = validateOnlineVariableProtocolStateV2(parsed); if (!checked.ok || JSON.stringify(checked.value) !== row.state_json || row.revision !== checked.value.revision || row.room_lifecycle !== checked.value.room.lifecycle || checked.value.coreRoot.acceptedCommandCount !== checked.value.revision) throw new Error('Invalid variable protocol state');
    let journal: readonly JournalRow[]; let checkpoints: readonly CheckpointRow[];
    try { journal = this.storage.sql.exec<JournalRow>(SELECT_JOURNAL).toArray(); checkpoints = this.storage.sql.exec<CheckpointRow>(SELECT_CHECKPOINT).toArray(); } catch { throw new Error('Invalid variable recovery state'); }
    const checkpoint = checkpoints[0]; if (journal.length !== checked.value.revision || checked.value.receipts.length !== checked.value.revision || checkpoints.length !== 1 || checkpoint === undefined || checkpoint.singleton !== 1 || checkpoint.room_id !== roomId || checkpoint.checkpoint_revision !== 0 || typeof checkpoint.state_json !== 'string') throw new Error('Invalid variable recovery relation');
    let initialParsed: unknown; try { initialParsed = JSON.parse(checkpoint.state_json); } catch { throw new Error('Invalid variable checkpoint JSON'); }
    const initial = validateOnlineVariableProtocolStateV2(initialParsed); if (!initial.ok || initial.value.revision !== 0 || initial.value.receipts.length !== 0 || JSON.stringify(initial.value.configuration) !== JSON.stringify(checked.value.configuration)) throw new Error('Invalid variable checkpoint state');
    let replay = initial.value; const configuredCapabilities = [...checked.value.room.seats.map((seat) => seat.seatCapability), ...checked.value.observerAuthorizations.map((entry) => entry.observerCapability)];
    for (let index = 0; index < journal.length; index += 1) {
      const entry = journal[index]; const acceptedRevision = index + 1;
      if (entry === undefined || entry.accepted_revision !== acceptedRevision || entry.base_revision !== index || typeof entry.command_id !== 'string' || typeof entry.participant_id !== 'string' || typeof entry.command_json !== 'string') throw new Error('Invalid variable journal relation');
      assertNoConfiguredCapabilityFragmentV1(entry.command_id, configuredCapabilities); assertNoConfiguredCapabilityFragmentV1(entry.participant_id, configuredCapabilities);
      const receipt = checked.value.receipts.find((candidate) => candidate.acceptedRevision === acceptedRevision); if (receipt === undefined || receipt.commandId !== entry.command_id || receipt.participantId !== entry.participant_id) throw new Error('Invalid variable journal receipt');
      const participant = replay.room.participants.find((candidate) => candidate.participantId === entry.participant_id); const seat = participant === undefined || participant.seatIndex === null ? undefined : replay.room.seats[participant.seatIndex]; if (participant?.role !== 'player' || seat === undefined) throw new Error('Invalid variable journal participant');
      let command: unknown; try { command = JSON.parse(entry.command_json); } catch { throw new Error('Invalid variable journal command JSON'); }
      const envelope = { kind: 'online-command-envelope-v1' as const, protocolVersion: replay.protocolVersion, roomId, participantId: entry.participant_id, participantCapability: seat.seatCapability, commandId: entry.command_id, baseRevision: index, command };
      const validation = validateOnlineCommandEnvelopeV1(envelope); if (!validation.ok || JSON.stringify(validation.value.command) !== entry.command_json) throw new Error('Invalid variable journal command');
      const transition = handleOnlineVariableCommandEnvelopeV2(replay, validation.value); if (transition.response.kind !== 'online-command-ack-v1' || transition.response.duplicate || transition.response.acceptedRevision !== acceptedRevision) throw new Error('Variable journal replay rejected'); replay = transition.state;
    }
    if (JSON.stringify(replay) !== row.state_json) throw new Error('Variable journal replay mismatch');
    return checked.value;
  }

  findVariableAcceptedCommandV2(roomId: string, participantId: string, commandId: string): unknown {
    if (roomId.length === 0) return null;
    try {
      const rows = this.storage.sql.exec<JournalRow>(SELECT_JOURNAL).toArray();
      const row = rows.find((entry) => entry.participant_id === participantId && entry.command_id === commandId);
      if (row === undefined || typeof row.command_json !== 'string') return null;
      return JSON.parse(row.command_json) as unknown;
    } catch { return null; }
  }

  loadPregameV1(roomId: string): OnlinePregameStateV1 | null {
    let rows: readonly PregameRow[];
    try { rows = this.storage.sql.exec<PregameRow>(SELECT_PREGAME).toArray(); }
    catch (error: unknown) {
      if (error instanceof Error && (/no such table/i.test(error.message) || /Unexpected SQL/i.test(error.message))) return null;
      throw error;
    }
    if (rows.length === 0) return null;
    const row = rows[0];
    if (rows.length !== 1 || row === undefined || row.singleton !== 1 || row.schema_version !== 1 || row.room_id !== roomId || typeof row.initial_state_json !== 'string' || typeof row.state_json !== 'string') throw new Error('Invalid Pregame row');
    let initialInput: unknown;
    let stateInput: unknown;
    try { initialInput = JSON.parse(row.initial_state_json); stateInput = JSON.parse(row.state_json); }
    catch { throw new Error('Invalid Pregame JSON'); }
    const initial = validateOnlineVariableProtocolStateV2(initialInput);
    const state = validateOnlinePregameStateV1(stateInput);
    if (!initial.ok || !state.ok || initial.value.room.roomId !== roomId || state.value.protocolState.room.roomId !== roomId || row.revision !== state.value.revision || row.phase !== state.value.phase || JSON.stringify(initial.value) !== row.initial_state_json || JSON.stringify(state.value) !== row.state_json) throw new Error('Invalid Pregame state');
    const replay = replayOnlinePregameLifecycleV1(initial.value, state.value.randomPlan, state.value.journal);
    if (!replay.ok || JSON.stringify(replay.value) !== row.state_json) throw new Error('Invalid Pregame replay');
    return state.value;
  }

  projectPregameV1(roomId: string, participantId: string): OnlinePregameProjectionV1 | null {
    const state = this.loadPregameV1(roomId);
    if (state === null) return null;
    const projection = projectOnlinePregameV1(state, participantId);
    return projection;
  }

  applyPregameCommandV1(roomId: string, input: unknown): Readonly<{
    readonly response: OnlinePregameCommandResponseV1;
    readonly projection: OnlinePregameProjectionV1;
  }> | null {
    const state = this.loadPregameV1(roomId);
    if (state === null) throw new Error('PREGAME_NOT_FOUND');
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
    let inputRoomId: unknown;
    let participantId: unknown;
    let providedSeatValue: unknown;
    try {
      inputRoomId = Object.getOwnPropertyDescriptor(input, 'roomId')?.value;
      participantId = Object.getOwnPropertyDescriptor(input, 'participantId')?.value;
      providedSeatValue = Object.getOwnPropertyDescriptor(input, 'participantCapability')?.value;
    } catch { return null; }
    if (inputRoomId !== roomId || typeof participantId !== 'string' || typeof providedSeatValue !== 'string') return null;
    const seat = state.protocolState.room.seats.find((candidate) => candidate.participantId === participantId && candidate['seatCapability'] === providedSeatValue);
    if (seat === undefined) return null;
    const checkedEnvelope = validateOnlinePregameCommandEnvelopeV1(input);
    const transition = handleOnlinePregameCommandEnvelopeV1(state, checkedEnvelope.ok ? checkedEnvelope.value : input);
    if (transition.response.kind === 'online-pregame-command-ack-v1' && !transition.response.duplicate) {
      if (transition.state.phase === 'complete' && !isOnlineVariableProjectionWithinFrameBudgetV1(transition.state.protocolState)) throw new Error('Variable projection exceeds frame budget');
      const previousJson = JSON.stringify(state);
      const nextJson = JSON.stringify(transition.state);
      this.storage.transactionSync(() => {
        const updated = this.storage.sql.exec<{ readonly singleton: unknown }>('UPDATE online_pregame_state SET revision = ?, phase = ?, state_json = ? WHERE singleton = 1 AND schema_version = 1 AND room_id = ? AND revision = ? AND state_json = ? RETURNING singleton', transition.state.revision, transition.state.phase, nextJson, roomId, state.revision, previousJson).toArray();
        if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
        if (transition.state.phase === 'complete') {
          const protocolJson = JSON.stringify(transition.state.protocolState);
          const protocolRows = this.storage.sql.exec<{ readonly singleton: unknown }>('UPDATE online_variable_room_state SET revision = 0, room_lifecycle = ?, state_json = ? WHERE singleton = 1 AND schema_version = 2 AND room_id = ? AND revision = 0 RETURNING singleton', transition.state.protocolState.room.lifecycle, protocolJson, roomId).toArray();
          const checkpointRows = this.storage.sql.exec<{ readonly singleton: unknown }>('UPDATE online_recovery_checkpoint SET checkpoint_revision = 0, state_json = ? WHERE singleton = 1 AND room_id = ? AND checkpoint_revision = 0 RETURNING singleton', protocolJson, roomId).toArray();
          if (protocolRows.length !== 1 || protocolRows[0]?.singleton !== 1 || checkpointRows.length !== 1 || checkpointRows[0]?.singleton !== 1) throw new ConflictError();
        }
      });
    }
    return Object.freeze({ response: transition.response, projection: projectOnlinePregameV1(transition.state, participantId) });
  }

  initializeVariableProtocolV2(stateInput: OnlineVariableProtocolStateV2): Readonly<{ readonly kind: 'online-cloudflare-room-status-v2'; readonly schemaVersion: 2; readonly roomId: string; readonly playerCount: 2 | 4; readonly startingLife: 20 | 40; readonly revision: number; readonly roomLifecycle: string }> {
    const checked = validateOnlineVariableProtocolStateV2(stateInput); if (!checked.ok) throw new Error('Invalid variable protocol state');
    const state = checked.value; const stateJson = JSON.stringify(state);
    if (!isOnlineVariableProjectionWithinFrameBudgetV1(state)) throw new Error('Variable projection exceeds frame budget');
    this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_VARIABLE_ROOM);
      this.storage.sql.exec(CREATE_JOURNAL);
      this.storage.sql.exec(CREATE_CHECKPOINT);
      this.securityRepository.createSchemaInTransaction();
      const rows = this.storage.sql.exec<{ readonly singleton: unknown; readonly schema_version: unknown; readonly room_id: unknown; readonly state_json: unknown }>(SELECT_VARIABLE_ROOM).toArray();
      if (rows.length > 1) throw new Error('Invalid variable protocol singleton');
      if (rows.length === 1) { if (rows[0]?.room_id !== state.room.roomId || rows[0]?.schema_version !== 2 || rows[0]?.state_json !== stateJson) throw new ConflictError(); return; }
      this.storage.sql.exec('INSERT INTO online_variable_room_state (singleton, schema_version, room_id, revision, room_lifecycle, state_json) VALUES (1, 2, ?, ?, ?, ?)', state.room.roomId, state.revision, state.room.lifecycle, stateJson);
      this.storage.sql.exec(INSERT_CHECKPOINT, state.room.roomId, 0, stateJson);
      this.securityRepository.initializeInTransaction(state.room.roomId, state, Date.now());
    });
    return Object.freeze({ kind: 'online-cloudflare-room-status-v2', schemaVersion: 2, roomId: state.room.roomId, playerCount: state.configuration.playerCount, startingLife: state.configuration.startingLife, revision: state.revision, roomLifecycle: state.room.lifecycle });
  }

  commitVariableAcceptedV2(previousInput: OnlineVariableProtocolStateV2, nextInput: OnlineVariableProtocolStateV2, envelope: OnlineCommandEnvelopeV1): void {
    const previous = validateOnlineVariableProtocolStateV2(previousInput); const next = validateOnlineVariableProtocolStateV2(nextInput);
    if (!previous.ok || !next.ok || previous.value.room.roomId !== envelope.roomId || next.value.room.roomId !== envelope.roomId || previous.value.revision !== envelope.baseRevision || next.value.revision !== envelope.baseRevision + 1) throw new Error('Invalid variable accepted transition');
    if (!isOnlineVariableProjectionWithinFrameBudgetV1(next.value)) throw new Error('Variable projection exceeds frame budget');
    const capabilities = [...next.value.room.seats.map((seat) => seat.seatCapability), ...next.value.observerAuthorizations.map((entry) => entry.observerCapability)];
    assertNoConfiguredCapabilityFragmentV1(envelope.commandId, capabilities); assertNoConfiguredCapabilityFragmentV1(envelope.participantId, capabilities);
    const commandJson = serializeAcceptedCoreCommandV1(envelope.command, capabilities); const previousJson = JSON.stringify(previous.value); const nextJson = JSON.stringify(next.value);
    this.storage.transactionSync(() => {
      this.storage.sql.exec(INSERT_JOURNAL, next.value.revision, envelope.commandId, envelope.participantId, envelope.baseRevision, commandJson);
      const updated = this.storage.sql.exec<{ readonly singleton: unknown }>('UPDATE online_variable_room_state SET revision = ?, room_lifecycle = ?, state_json = ? WHERE singleton = 1 AND schema_version = 2 AND room_id = ? AND revision = ? AND state_json = ? RETURNING singleton', next.value.revision, next.value.room.lifecycle, nextJson, envelope.roomId, previous.value.revision, previousJson).toArray();
      if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
    });
  }

  persistVariableLobbyV4(previousInput: OnlineVariableLobbyV4, nextInput: OnlineVariableLobbyV4): void {
    const previous = validateOnlineVariableLobbyV4(previousInput); const next = validateOnlineVariableLobbyV4(nextInput);
    if (!previous.ok || !next.ok || previous.value.roomId !== next.value.roomId || JSON.stringify(previous.value.configuration) !== JSON.stringify(next.value.configuration)) throw new Error('Invalid variable lobby transition');
    const previousJson = JSON.stringify(previous.value); const nextJson = JSON.stringify(next.value);
    this.storage.transactionSync(() => {
      const updated = this.storage.sql.exec<{ readonly singleton: unknown }>('UPDATE online_forming_lobby SET state_json = ?, schema_version = ? WHERE singleton = 1 AND room_id = ? AND schema_version = ? AND state_json = ? RETURNING singleton', nextJson, 4, previous.value.roomId, 4, previousJson).toArray();
      if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
    });
  }

  rotateVariableLobbyV4(roomId: string, hostParticipantId: string, seatCapability: string, nextCapability: string): Readonly<{ readonly projection: OnlineVariableLobbyProjectionV4; readonly admissionCapability: string }> {
    const lobby = this.loadVariableLobbyV4(roomId); if (lobby === null) throw new Error('ROOM_NOT_FOUND');
    if (lobby.hostParticipantId !== hostParticipantId || lobby.seats[0]?.seatCapability !== seatCapability) throw new Error('HOST_REQUIRED');
    const next = rotateOnlineVariableLobbyAdmissionV4(lobby, nextCapability); this.persistVariableLobbyV4(lobby, next); return Object.freeze({ projection: projectOnlineVariableLobbyV4(next), admissionCapability: next.admissionCapability });
  }
  closeVariableLobbyV4(roomId: string, hostParticipantId: string, seatCapability: string): OnlineVariableLobbyProjectionV4 {
    const lobby = this.loadVariableLobbyV4(roomId); if (lobby === null) throw new Error('ROOM_NOT_FOUND');
    if (lobby.hostParticipantId !== hostParticipantId || lobby.seats[0]?.seatCapability !== seatCapability) throw new Error('HOST_REQUIRED');
    const next = closeOnlineVariableLobbyAdmissionV4(lobby); this.persistVariableLobbyV4(lobby, next); return projectOnlineVariableLobbyV4(next);
  }
  deleteVariableLobbyV4(roomId: string): void { this.storage.transactionSync(() => { const rows = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray(); if (rows.length !== 1 || rows[0]?.room_id !== roomId || rows[0]?.schema_version !== 4) throw new Error('ROOM_NOT_FOUND'); this.storage.sql.exec('DELETE FROM online_forming_lobby WHERE singleton = 1 AND room_id = ? AND schema_version = 4', roomId); }); }
  private replaceVariableLobbySeatV4(lobby: OnlineVariableLobbyV4, participantId: string, nextSeatCapability: string, nextAdmissionCapability: string): OnlineVariableLobbyProjectionV4 {
    const roomId = lobby.roomId;
    const index = lobby.seats.findIndex((seat) => seat.participantId === participantId); if (index <= 0) throw new Error(index === 0 ? 'HOST_REQUIRED' : 'PARTICIPANT_NOT_FOUND');
    const next = replaceOnlineVariableLobbySeatV4(lobby, participantId, nextSeatCapability, nextAdmissionCapability);
    this.storage.transactionSync(() => { this.ensureDeckSchema(); this.storage.sql.exec('DELETE FROM online_deck_submission_head_v2 WHERE room_id = ? AND seat_index = ?', roomId, index); this.storage.sql.exec('DELETE FROM online_deck_submission_history_v2 WHERE room_id = ? AND seat_index = ?', roomId, index); this.storage.sql.exec(DELETE_DECK_SNAPSHOT, roomId, index); this.storage.sql.exec('DELETE FROM online_deck_submission_ready_v2 WHERE room_id = ? AND seat_index = ?', roomId, index); });
    this.persistVariableLobbyV4(lobby, next); return projectOnlineVariableLobbyV4(next);
  }
  kickVariableLobbySeatV4(roomId: string, hostParticipantId: string, hostSeatCapability: string, targetParticipantId: string, nextSeatCapability: string, nextAdmissionCapability: string): OnlineVariableLobbyProjectionV4 {
    const lobby = this.loadVariableLobbyV4(roomId); if (lobby === null) throw new Error('ROOM_NOT_FOUND');
    if (lobby.hostParticipantId !== hostParticipantId || lobby.seats[0]?.seatCapability !== hostSeatCapability) throw new Error('HOST_REQUIRED');
    return this.replaceVariableLobbySeatV4(lobby, targetParticipantId, nextSeatCapability, nextAdmissionCapability);
  }
  leaveVariableLobbySeatV4(roomId: string, participantId: string, seatCapability: string, nextSeatCapability: string, nextAdmissionCapability: string): OnlineVariableLobbyProjectionV4 {
    const lobby = this.loadVariableLobbyV4(roomId); if (lobby === null) throw new Error('ROOM_NOT_FOUND');
    const seat = lobby.seats.find((candidate) => candidate.participantId === participantId && candidate.seatCapability === seatCapability);
    if (seat === undefined) throw new Error('CREDENTIAL_KICKED');
    return this.replaceVariableLobbySeatV4(lobby, participantId, nextSeatCapability, nextAdmissionCapability);
  }

  private ensureDeckSchema(): void {
    this.storage.sql.exec(CREATE_DECK_HEAD);
    this.storage.sql.exec(CREATE_DECK_HISTORY);
    this.storage.sql.exec(CREATE_DECK_SNAPSHOT);
    this.storage.sql.exec(CREATE_DECK_READY);
  }

  private deckHead(roomId: string, querySeatIndex: number): OnlineDeckSubmissionHeadV2 | null {
    const rows = this.storage.sql.exec<DeckHeadRow>(SELECT_DECK_HEAD, roomId, querySeatIndex).toArray();
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error('Invalid v2 deck head');
    return this.headFromRow(rows[0], roomId);
  }

  private headFromRow(row: DeckHeadRow | undefined, expectedRoomId?: string): OnlineDeckSubmissionHeadV2 {
    if (row === undefined || typeof row.room_id !== 'string' || (expectedRoomId !== undefined && row.room_id !== expectedRoomId) || typeof row.seat_index !== 'number' || !Number.isSafeInteger(row.seat_index) || row.seat_index < 0 || row.seat_index > 3 || !isOnlineRoomApplicationIdV1(row.participant_id) || !isOnlineRoomApplicationIdV1(row.deck_id) || !isOnlineRoomApplicationIdV1(row.submission_id) || typeof row.content_digest !== 'string' || !/^[0-9a-f]{64}$/.test(row.content_digest) || typeof row.revision !== 'number' || !Number.isSafeInteger(row.revision) || row.revision < 1 || (row.state !== 'none' && row.state !== 'resolving' && row.state !== 'accepted' && row.state !== 'needs-attention') || (row.snapshot_digest !== null && (typeof row.snapshot_digest !== 'string' || !/^[0-9a-f]{64}$/.test(row.snapshot_digest)))) throw new Error('Invalid v2 deck head');
    const seatIndex = row.seat_index as 0 | 1 | 2 | 3;
    const state = row.state;
    const snapshotDigest = row.snapshot_digest;
    if ((state === 'accepted') !== (snapshotDigest !== null)) throw new Error('Invalid v2 deck head snapshot relation');
    return Object.freeze({ roomId: row.room_id, seatIndex, participantId: row.participant_id, deckId: row.deck_id, submissionId: row.submission_id, contentDigest: row.content_digest, revision: row.revision, state, snapshotDigest });
  }

  loadDeckHeadsV2(roomId: string): readonly OnlineDeckSubmissionHeadV2[] {
    let rows: DeckHeadRow[];
    try { rows = this.storage.sql.exec<DeckHeadRow>(SELECT_DECK_HEADS, roomId).toArray(); }
    catch (error: unknown) {
      if (error instanceof Error && /no such table/i.test(error.message)) return Object.freeze([]);
      throw error;
    }
    return Object.freeze(rows.map((row) => this.headFromRow(row, roomId)));
  }

  loadDeckSnapshotV2(roomId: string, seatIndex: number): Readonly<{ readonly digest: string; readonly serialized: string }> | null {
    let rows: DeckSnapshotRow[];
    try { rows = this.storage.sql.exec<DeckSnapshotRow>(SELECT_DECK_SNAPSHOT, roomId, seatIndex).toArray(); }
    catch (error: unknown) {
      if (error instanceof Error && /no such table/i.test(error.message)) return null;
      throw error;
    }
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error('Invalid v2 deck snapshot');
    const row = rows[0];
    if (row === undefined || row.room_id !== roomId || row.seat_index !== seatIndex || typeof row.snapshot_digest !== 'string' || typeof row.snapshot_json !== 'string') throw new Error('Invalid v2 deck snapshot');
    if (new TextEncoder().encode(row.snapshot_json).length > 262_144 || coreSha256HexV1(row.snapshot_json) !== row.snapshot_digest) throw new Error('Invalid v2 snapshot digest');
    let parsed: unknown;
    try { parsed = JSON.parse(row.snapshot_json); } catch { throw new Error('Invalid v2 snapshot JSON'); }
    if (!exactOwnKeys(parsed, ['entries']) || !Array.isArray(parsed.entries) || parsed.entries.length === 0 || JSON.stringify(parsed) !== row.snapshot_json) throw new Error('Invalid v2 snapshot shape');
    parsed.entries.forEach((entry, index) => {
      if (!exactOwnKeys(entry, ['section', 'quantity', 'scryfallId', 'oracleId', 'index', 'definition']) || entry.index !== index || (entry.section !== 'commander' && entry.section !== 'main') || typeof entry.quantity !== 'number' || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0 || !isCanonicalScryfallIdV2(entry.scryfallId) || !isCanonicalScryfallIdV2(entry.oracleId) || !isRecord(entry.definition)) throw new Error('Invalid v2 snapshot entry');
      if (typeof entry.definition.scryfallId !== 'string' || entry.definition.scryfallId !== entry.scryfallId || typeof entry.definition.oracleId !== 'string' || entry.definition.oracleId !== entry.oracleId || typeof entry.definition.name !== 'string' || (entry.definition.lang !== 'en' && entry.definition.lang !== 'ja') || typeof entry.definition.layout !== 'string' || typeof entry.definition.cmc !== 'number' || !Number.isFinite(entry.definition.cmc) || !Array.isArray(entry.definition.colorIdentity) || typeof entry.definition.typeLine !== 'string' || !Array.isArray(entry.definition.faces) || entry.definition.faces.length === 0) throw new Error('Invalid v2 snapshot definition');
      if (!exactOwnKeys(entry.definition, ['scryfallId', 'oracleId', 'name', 'lang', 'layout', 'cmc', 'colorIdentity', 'typeLine', 'faces', 'printedName', 'edhrecRank', 'keywords', 'producedMana', 'tokenKind'].filter((key) => Object.prototype.hasOwnProperty.call(entry.definition, key)))) throw new Error('Invalid v2 snapshot definition keys');
      if (!isStringArray(entry.definition.colorIdentity)) throw new Error('Invalid v2 snapshot color identity');
      if (!isOptionalString(entry.definition, 'printedName')) throw new Error('Invalid v2 snapshot printed name');
      if (Object.prototype.hasOwnProperty.call(entry.definition, 'edhrecRank') && (typeof entry.definition.edhrecRank !== 'number' || !Number.isFinite(entry.definition.edhrecRank))) throw new Error('Invalid v2 snapshot EDHREC rank');
      if (Object.prototype.hasOwnProperty.call(entry.definition, 'keywords') && !isStringArray(entry.definition.keywords)) throw new Error('Invalid v2 snapshot keywords');
      if (Object.prototype.hasOwnProperty.call(entry.definition, 'producedMana') && (!isStringArray(entry.definition.producedMana) || !entry.definition.producedMana.every((mana) => VALID_PRODUCED_MANA.has(mana)))) throw new Error('Invalid v2 snapshot produced mana');
      if (Object.prototype.hasOwnProperty.call(entry.definition, 'tokenKind') && (typeof entry.definition.tokenKind !== 'string' || !VALID_TOKEN_KINDS.has(entry.definition.tokenKind))) throw new Error('Invalid v2 snapshot token kind');
      for (const face of entry.definition.faces) {
        if (!exactOwnKeys(face, ['name', 'typeLine', ...OPTIONAL_FACE_STRING_FIELDS].filter((key) => Object.prototype.hasOwnProperty.call(face, key))) || typeof face.name !== 'string' || typeof face.typeLine !== 'string' || !OPTIONAL_FACE_STRING_FIELDS.every((key) => isOptionalString(face, key))) throw new Error('Invalid v2 snapshot face');
      }
    });
    return Object.freeze({ digest: row.snapshot_digest, serialized: row.snapshot_json });
  }

  private issuesFromHistory(row: DeckHistoryRow, entryCount: number): readonly OnlineDeckSubmissionIssueV2[] {
    if (typeof row.issues_json !== 'string') throw new Error('Invalid v2 issues');
    let parsed: unknown;
    try { parsed = JSON.parse(row.issues_json); } catch { throw new Error('Invalid v2 issues'); }
    if (!Array.isArray(parsed)) throw new Error('Invalid v2 issues');
    const valid: OnlineDeckSubmissionIssueV2[] = [];
    for (const item of parsed) {
      if (!exactOwnKeys(item, ['code', 'entryIndex', 'retryable'])) throw new Error('Invalid v2 issue shape');
      const known = item.code === 'EMPTY_LIST' || item.code === 'INVALID_SECTION' || item.code === 'INVALID_QUANTITY' || item.code === 'INVALID_CARD_ID' || item.code === 'CARD_NOT_FOUND' || item.code === 'IDENTITY_MISMATCH' || item.code === 'SCRYFALL_UNAVAILABLE' || item.code === 'SUBMISSION_CONFLICT' || item.code === 'STALE_RESOLUTION' || item.code === 'SNAPSHOT_TOO_LARGE';
      const entrySpecific = item.code === 'INVALID_SECTION' || item.code === 'INVALID_QUANTITY' || item.code === 'INVALID_CARD_ID' || item.code === 'CARD_NOT_FOUND' || item.code === 'IDENTITY_MISMATCH';
      if (!known || (entrySpecific && (typeof item.entryIndex !== 'number' || !Number.isSafeInteger(item.entryIndex) || item.entryIndex < 0 || item.entryIndex >= entryCount)) || (!entrySpecific && item.entryIndex !== null) || typeof item.retryable !== 'boolean') throw new Error('Invalid v2 issue value');
      const entryIndex = item.entryIndex === null ? null : Number(item.entryIndex);
      valid.push(Object.freeze({ code: item.code as OnlineDeckSubmissionIssueV2['code'], entryIndex, retryable: item.retryable }));
    }
    return Object.freeze(valid);
  }

  private validateHistoryRow(row: DeckHistoryRow): number {
    if (typeof row.room_id !== 'string' || typeof row.seat_index !== 'number' || !Number.isSafeInteger(row.seat_index) || row.seat_index < 0 || row.seat_index > 3 || !isOnlineRoomApplicationIdV1(row.submission_id) || !isOnlineRoomApplicationIdV1(row.participant_id) || !isOnlineRoomApplicationIdV1(row.deck_id) || typeof row.canonical_input !== 'string' || typeof row.content_digest !== 'string' || !/^[0-9a-f]{64}$/.test(row.content_digest) || typeof row.revision !== 'number' || !Number.isSafeInteger(row.revision) || row.revision < 1 || (row.state !== 'resolving' && row.state !== 'accepted' && row.state !== 'needs-attention')) throw new Error('Invalid v2 history row');
    if (coreSha256HexV1(row.canonical_input) !== row.content_digest) throw new Error('Invalid v2 history digest');
    let parsed: unknown;
    try { parsed = JSON.parse(row.canonical_input); } catch { throw new Error('Invalid v2 canonical input'); }
    if (!exactOwnKeys(parsed, ['deckId', 'entries']) || parsed.deckId !== row.deck_id || !Array.isArray(parsed.entries) || (parsed.entries.length === 0 && row.state !== 'needs-attention')) throw new Error('Invalid v2 canonical input');
    if (JSON.stringify({ deckId: parsed.deckId, entries: parsed.entries }) !== row.canonical_input) throw new Error('Invalid v2 canonical input');
    parsed.entries.forEach((entry) => {
      const scalar = (candidate: unknown): boolean => candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean' || (typeof candidate === 'number' && Number.isFinite(candidate));
      if (!exactOwnKeys(entry, ['section', 'quantity', 'scryfallId', 'oracleId']) || !scalar(entry.section) || !scalar(entry.quantity) || !scalar(entry.scryfallId) || !scalar(entry.oracleId)) throw new Error('Invalid v2 canonical entry');
      if (row.state !== 'needs-attention' && (entry.section !== 'commander' && entry.section !== 'main' || typeof entry.quantity !== 'number' || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0 || typeof entry.scryfallId !== 'string' || !isCanonicalScryfallIdV2(entry.scryfallId) || typeof entry.oracleId !== 'string' || !isCanonicalScryfallIdV2(entry.oracleId))) throw new Error('Invalid v2 canonical entry');
    });
    const issues = this.issuesFromHistory(row, parsed.entries.length);
    if ((row.state === 'accepted' || row.state === 'resolving') && issues.length !== 0) throw new Error('Invalid v2 terminal issue relation');
    if (row.state === 'needs-attention' && issues.length === 0) throw new Error('Missing v2 terminal issue');
    return parsed.entries.length;
  }

  private resultV2(roomId: string, submissionId: string, state: OnlineDeckSubmissionStateV2, issues: readonly OnlineDeckSubmissionIssueV2[], projection: OnlineFormingLobbyProjectionV2): OnlineDeckSubmissionResultV2 {
    return Object.freeze({ kind: 'online-forming-lobby-deck-result-v2', schemaVersion: 2, roomId, submissionId, state, issues: Object.freeze([...issues]), projection });
  }

  private beginInvalidDeckSubmissionV2(roomId: string, seatIndex: number, expectedHead: OnlineDeckSubmissionHeadV2, participantId: string, deckId: string, submissionId: string, canonicalInput: string, contentDigest: string, issues: readonly OnlineDeckSubmissionIssueV2[]): void {
    this.storage.transactionSync(() => {
      this.ensureDeckSchema();
      const current = this.deckHead(roomId, seatIndex);
      if (current === null || current.revision !== expectedHead.revision || current.submissionId !== expectedHead.submissionId || current.contentDigest !== expectedHead.contentDigest) throw new ConflictError();
      if (current.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Deck revision overflow');
      const revision = current.revision + 1;
      const currentLobby = this.loadLobby(roomId);
      if (currentLobby === null) throw new Error('Missing forming lobby');
      const nextLobby = invalidateOnlineFormingLobbySeatDeckV1(currentLobby, seatIndex);
      const previousJson = JSON.stringify(currentLobby);
      const nextJson = JSON.stringify(nextLobby);
      if (previousJson === undefined || nextJson === undefined) throw new Error('Invalid lobby serialization');
      const updatedHead = this.storage.sql.exec<{ seat_index: unknown }>(UPDATE_DECK_HEAD, participantId, deckId, submissionId, contentDigest, revision, 'needs-attention', null, roomId, seatIndex, current.revision).toArray();
      if (updatedHead.length !== 1 || updatedHead[0]?.seat_index !== seatIndex) throw new ConflictError();
      this.storage.sql.exec(DELETE_DECK_SNAPSHOT, roomId, seatIndex);
      this.clearReadyV2InTransaction(roomId, seatIndex);
      const issueJson = JSON.stringify(issues);
      if (issueJson === undefined) throw new Error('Invalid v2 issue serialization');
      this.storage.sql.exec(INSERT_DECK_HISTORY, roomId, seatIndex, submissionId, participantId, deckId, canonicalInput, contentDigest, revision, 'needs-attention', issueJson);
      const updatedLobby = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_LOBBY, roomId, nextJson, roomId, previousJson).toArray();
      if (updatedLobby.length !== 1 || updatedLobby[0]?.singleton !== 1) throw new ConflictError();
    });
  }

  private invalidateFailedDeckSubmissionV2(roomId: string, seatIndex: number, expectedHead: OnlineDeckSubmissionHeadV2, issues: readonly OnlineDeckSubmissionIssueV2[]): void {
    this.storage.transactionSync(() => {
      this.ensureDeckSchema();
      const current = this.deckHead(roomId, seatIndex);
      if (current === null || current.revision !== expectedHead.revision || current.submissionId !== expectedHead.submissionId || current.contentDigest !== expectedHead.contentDigest) throw new ConflictError();
      if (current.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Deck revision overflow');
      const currentLobby = this.loadLobby(roomId);
      if (currentLobby === null) throw new Error('Missing forming lobby');
      const nextLobby = invalidateOnlineFormingLobbySeatDeckV1(currentLobby, seatIndex);
      const previousJson = JSON.stringify(currentLobby);
      const nextJson = JSON.stringify(nextLobby);
      if (previousJson === undefined || nextJson === undefined) throw new Error('Invalid lobby serialization');
      const historyRows = this.storage.sql.exec<DeckHistoryRow>(SELECT_DECK_HISTORY, roomId, seatIndex, current.submissionId).toArray();
      if (historyRows.length !== 1 || historyRows[0] === undefined) throw new Error('Missing v2 history during parse invalidation');
      const history = historyRows[0];
      const entryCount = this.validateHistoryRow(history);
      const historyIssues = issues.every((issue) => issue.entryIndex === null || (Number.isSafeInteger(issue.entryIndex) && issue.entryIndex >= 0 && issue.entryIndex < entryCount))
        ? issues
        : Object.freeze([{ code: 'STALE_RESOLUTION' as const, entryIndex: null, retryable: false }]);
      const issueJson = JSON.stringify(historyIssues);
      if (issueJson === undefined) throw new Error('Invalid v2 issue serialization');
      const invalidatedHead = this.storage.sql.exec<{ seat_index: unknown }>(INVALIDATE_DECK_HEAD, current.revision + 1, 'needs-attention', roomId, seatIndex, current.revision).toArray();
      if (invalidatedHead.length !== 1 || invalidatedHead[0]?.seat_index !== seatIndex) throw new ConflictError();
      this.storage.sql.exec(DELETE_DECK_SNAPSHOT, roomId, seatIndex);
      this.clearReadyV2InTransaction(roomId, seatIndex);
      const updatedHistory = this.storage.sql.exec<{ submission_id: unknown }>(UPDATE_DECK_HISTORY, current.participantId, current.deckId, history.canonical_input, current.contentDigest, current.revision + 1, 'needs-attention', issueJson, roomId, seatIndex, current.submissionId).toArray();
      if (updatedHistory.length !== 1 || updatedHistory[0]?.submission_id !== current.submissionId) throw new ConflictError();
      const updatedLobby = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_LOBBY, roomId, nextJson, roomId, previousJson).toArray();
      if (updatedLobby.length !== 1 || updatedLobby[0]?.singleton !== 1) throw new ConflictError();
    });
  }

  private validateDeckRelations(roomId: string, lobby: OnlineFormingLobbyV1): void {
    const headSeats = new Set<number>();
    for (const head of this.loadDeckHeadsV2(roomId)) {
      headSeats.add(head.seatIndex);
      const seat = lobby.seats[head.seatIndex];
      if (seat === undefined || seat.participantId !== head.participantId) throw new Error('Invalid v2 head participant relation');
      if (
        (seat.deckId !== null || seat.deckText !== null) &&
        (head.state !== 'needs-attention' || head.snapshotDigest !== null)
      )
        throw new Error('Mixed v1/v2 deck relation');
      const histories = this.storage.sql.exec<DeckHistoryRow>(SELECT_DECK_HISTORY_SEAT, roomId, head.seatIndex).toArray();
      for (const history of histories) this.validateHistoryRow(history);
      const currentHistory = histories.find((history) => history.submission_id === head.submissionId);
      if (currentHistory === undefined || currentHistory.content_digest !== head.contentDigest || currentHistory.revision !== head.revision || currentHistory.state !== head.state) throw new Error('Head/history relation mismatch');
      const snapshot = this.loadDeckSnapshotV2(roomId, head.seatIndex);
      if (head.state === 'accepted') {
        if (snapshot === null || head.snapshotDigest !== snapshot.digest) throw new Error('Accepted v2 head missing snapshot');
      } else if (snapshot !== null || head.snapshotDigest !== null) throw new Error('Non-accepted v2 head has snapshot');
    }
    for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
      if (headSeats.has(seatIndex)) continue;
      const histories = this.storage.sql.exec<DeckHistoryRow>(SELECT_DECK_HISTORY_SEAT, roomId, seatIndex).toArray();
      if (histories.length > 0) throw new Error('History without v2 head');
    }
    try {
      const readyRows = this.storage.sql.exec<DeckReadyRow>(SELECT_DECK_READY, roomId).toArray();
      const seenReady = new Set<number>();
      for (const row of readyRows) {
        if (typeof row.room_id !== 'string' || row.room_id !== roomId || typeof row.seat_index !== 'number' || !Number.isSafeInteger(row.seat_index) || row.seat_index < 0 || row.seat_index > 3 || (row.ready !== 0 && row.ready !== 1) || seenReady.has(row.seat_index)) throw new Error('Invalid v2 ready relation');
        seenReady.add(row.seat_index);
        if (row.ready === 1) {
          const head = this.deckHead(roomId, row.seat_index);
          if (head === null || head.state !== 'accepted' || head.snapshotDigest === null) throw new Error('Ready v2 seat is not accepted');
        }
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && /no such table/i.test(error.message))) throw error;
    }
  }

  projectLobbyV2(roomId: string, lobbyInput?: OnlineFormingLobbyV1): OnlineFormingLobbyProjectionV2 {
    let lobby: OnlineFormingLobbyV1 | null;
    if (lobbyInput === undefined) lobby = this.loadLobby(roomId);
    else {
      const checked = validateOnlineFormingLobbyV1(lobbyInput);
      lobby = checked.ok ? checked.value : null;
    }
    if (lobby === null) throw new Error('Missing forming lobby');
    this.validateDeckRelations(roomId, lobby);
    const heads = new Map(this.loadDeckHeadsV2(roomId).map((head) => [head.seatIndex, head]));
    const ready = new Map<number, boolean>();
    try { for (const row of this.storage.sql.exec<DeckReadyRow>(SELECT_DECK_READY, roomId).toArray()) if (typeof row.seat_index === 'number' && (row.ready === 0 || row.ready === 1)) ready.set(row.seat_index, row.ready === 1); } catch (error: unknown) { if (!(error instanceof Error && /no such table/i.test(error.message))) throw error; }
    const seats = lobby.seats.map((seat, index) => {
      const head = heads.get(index as 0 | 1 | 2 | 3);
      const accepted = head?.state === 'accepted' && head.snapshotDigest !== null;
      return Object.freeze({ seatIndex: index as 0 | 1 | 2 | 3, corePlayerId: seat.corePlayerId, participantId: seat.participantId, deckState: head?.state ?? 'none', ready: accepted && ready.get(index) === true });
    });
    const lifecycle = (() => {
      const complete = seats.every((seat) => seat.participantId !== null && seat.deckState === 'accepted' && seat.ready);
      const started = this.load()?.room.lifecycle === 'active';
      return started ? 'started' : complete ? 'ready' : 'forming';
    })();
    return Object.freeze({ kind: 'online-forming-lobby-projection-v2', schemaVersion: 2, lifecycle, roomId: lobby.roomId, serverBuildId: lobby.serverBuildId, hostParticipantId: lobby.hostParticipantId, seats: Object.freeze(seats) as OnlineFormingLobbyProjectionV2['seats'] });
  }

  private v2Ready(roomId: string, seatIndex: number): boolean {
    try {
      const rows = this.storage.sql.exec<DeckReadyRow>(SELECT_DECK_READY_SEAT, roomId, seatIndex).toArray();
      if (rows.length === 0) return false;
      if (rows.length !== 1 || rows[0]?.ready !== 0 && rows[0]?.ready !== 1) throw new Error('Invalid v2 ready row');
      return rows[0]?.ready === 1;
    } catch (error: unknown) {
      if (error instanceof Error && /no such table/i.test(error.message)) return false;
      throw error;
    }
  }

  private clearReadyV2InTransaction(roomId: string, seatIndex: number): void {
    const clearedReady: unknown = this.storage.sql.exec<{ seat_index: unknown }>(UPDATE_DECK_READY, 0, roomId, seatIndex).toArray();
    if (!denseArray(clearedReady) || clearedReady.length > 1 || (clearedReady.length === 1 && !isSeatIndexRow(clearedReady[0], seatIndex))) throw new ConflictError();
  }

  setReadyV2(roomId: string, participantId: string, seatCapability: string, readyValue: boolean): OnlineFormingLobbyProjectionV2 {
    const lobby = this.loadLobby(roomId);
    if (lobby === null) throw new Error('Missing forming lobby');
    const seatIndex = authorizeOnlineFormingLobbySeatV1(lobby, participantId, seatCapability);
    this.validateDeckRelations(roomId, lobby);
    if (lobby.lifecycle === 'started' || this.load()?.room.lifecycle === 'active') throw new Error('Started lobby cannot change readiness');
    const head = this.deckHead(roomId, seatIndex);
    if (head === null || head.state !== 'accepted' || head.snapshotDigest === null) throw new Error('Accepted v2 deck required before ready');
    const expectedLobbyJson = JSON.stringify(lobby);
    if (expectedLobbyJson === undefined) throw new Error('Invalid lobby serialization');
    this.storage.transactionSync(() => {
      this.ensureDeckSchema();
      const lobbyRows = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray();
      if (lobbyRows.length !== 1 || lobbyRows[0]?.room_id !== roomId || lobbyRows[0]?.state_json !== expectedLobbyJson || this.rows().length !== 0) throw new ConflictError();
      const currentHead = this.deckHead(roomId, seatIndex);
      const currentSnapshot = this.loadDeckSnapshotV2(roomId, seatIndex);
      if (currentHead === null || currentSnapshot === null || currentHead.participantId !== participantId || currentHead.revision !== head.revision || currentHead.submissionId !== head.submissionId || currentHead.contentDigest !== head.contentDigest || currentHead.snapshotDigest !== head.snapshotDigest || currentSnapshot.digest !== head.snapshotDigest || currentHead.state !== 'accepted') throw new ConflictError();
      const existing = this.storage.sql.exec<DeckReadyRow>(SELECT_DECK_READY_SEAT, roomId, seatIndex).toArray();
      if (existing.length > 1) throw new Error('Invalid v2 ready row');
      if (existing.length === 0) this.storage.sql.exec(INSERT_DECK_READY, roomId, seatIndex, readyValue ? 1 : 0);
      else {
        const updated = this.storage.sql.exec<{ seat_index: unknown }>(UPDATE_DECK_READY, readyValue ? 1 : 0, roomId, seatIndex).toArray();
        if (updated.length !== 1 || updated[0]?.seat_index !== seatIndex) throw new ConflictError();
      }
    });
    return this.projectLobbyV2(roomId);
  }

  startWithTableV2(roomId: string, input: { readonly hostParticipantId: string; readonly seatCapability: string; readonly tableParticipantId: string; readonly tableCapability: string }): OnlineDynamicStartResultV2 {
    const lobby = this.loadLobby(roomId);
    if (lobby === null) throw new Error('Missing forming lobby');
    const hostSeat = authorizeOnlineFormingLobbySeatV1(lobby, input.hostParticipantId, input.seatCapability);
    if (hostSeat !== 0 || input.hostParticipantId !== lobby.hostParticipantId) throw new Error('Host authorization rejected');
    if (!isOnlineRoomApplicationIdV1(input.tableParticipantId) || !isOnlineRoomSeatCapabilityV1(input.tableCapability)) throw new Error('Table authorization rejected');
    const configuredBeforeTable = lobby.seats.flatMap((seat) => [seat.seatCapability, ...(seat.inviteCapability === null ? [] : [seat.inviteCapability])]);
    assertNoConfiguredCapabilityFragmentV1(input.tableCapability, configuredBeforeTable);
    assertNoConfiguredCapabilityFragmentV1(JSON.stringify({ roomId, serverBuildId: lobby.serverBuildId, hostParticipantId: lobby.hostParticipantId, participantIds: lobby.seats.map((seat) => seat.participantId), capabilities: configuredBeforeTable }), [input.tableCapability]);
    assertNoConfiguredCapabilityFragmentV1(input.tableParticipantId, [input.tableCapability, ...configuredBeforeTable]);
    this.validateDeckRelations(roomId, lobby);
    if (lobby.lifecycle === 'started' || this.load()?.room.lifecycle === 'active') throw new Error('Lobby already started');
    const heads = this.loadDeckHeadsV2(roomId);
    assertNoConfiguredCapabilityFragmentV1(JSON.stringify(heads), [input.tableCapability]);
    const seats: DynamicGenesisSeatInputV2[] = [];
    for (let index = 0; index < 4; index += 1) {
      const head = heads.find((candidate) => candidate.seatIndex === index);
      const seat = lobby.seats[index];
      if (head === undefined || seat?.participantId === null || head.state !== 'accepted' || head.snapshotDigest === null || !this.v2Ready(roomId, index)) throw new Error('All seats must be accepted and ready');
      const loaded = this.loadDeckSnapshotV2(roomId, index);
      if (loaded === null || loaded.digest !== head.snapshotDigest) throw new Error('Accepted snapshot relation invalid');
      assertNoConfiguredCapabilityFragmentV1(loaded.serialized, [input.tableCapability]);
      const histories = this.storage.sql.exec<DeckHistoryRow>(SELECT_DECK_HISTORY_SEAT, roomId, index).toArray();
      for (const history of histories) {
        this.validateHistoryRow(history);
        assertNoConfiguredCapabilityFragmentV1(JSON.stringify(history), [input.tableCapability]);
      }
      let parsed: unknown;
      try { parsed = JSON.parse(loaded.serialized); } catch { throw new Error('Invalid v2 snapshot JSON'); }
      if (!exactOwnKeys(parsed, ['entries']) || !Array.isArray(parsed.entries)) throw new Error('Invalid v2 snapshot shape');
      seats.push(Object.freeze({ seatIndex: index as 0 | 1 | 2 | 3, corePlayerId: seat.corePlayerId, participantId: seat.participantId, seatCapability: seat.seatCapability, revision: head.revision, submissionId: head.submissionId, contentDigest: head.contentDigest, snapshotDigest: head.snapshotDigest, snapshot: Object.freeze({ entries: parsed.entries, digest: loaded.digest, serialized: loaded.serialized }) }));
    }
    const genesis = buildDynamicRoomGenesisV2({ roomId, serverBuildId: lobby.serverBuildId, seats: seats as [DynamicGenesisSeatInputV2, DynamicGenesisSeatInputV2, DynamicGenesisSeatInputV2, DynamicGenesisSeatInputV2], tableParticipantId: input.tableParticipantId, tableCapability: input.tableCapability });
    if (!genesis.ok) {
      const tooLarge = genesis.issues.some((current) => current.code === 'ROOM_GENESIS_TOO_LARGE');
      if (!tooLarge) throw new Error('Dynamic Room genesis failed');
      return Object.freeze({ kind: 'online-forming-lobby-start-result-v2', schemaVersion: 2, roomId, outcome: 'needs-attention', issue: 'ROOM_GENESIS_TOO_LARGE', status: null });
    }
    const status = this.initializeDynamicRoomV2(roomId, genesis.protocolState, lobby, seats);
    return Object.freeze({ kind: 'online-forming-lobby-start-result-v2', schemaVersion: 2, roomId, outcome: 'started', issue: null, status });
  }

  async submitVariableDeckV2(roomId: string, input: unknown, resolver: OnlineDeckResolverV2): Promise<unknown> {
    const lobby = this.loadVariableLobbyV4(roomId); if (lobby === null) throw new Error('Missing variable lobby');
    if (!exactSubmissionEnvelope(input) || !isOnlineRoomApplicationIdV1(input.participantId) || !isOnlineRoomSeatCapabilityV1(input.seatCapability) || input.kind !== 'online-forming-lobby-deck-submit-v2' || input.schemaVersion !== 2) throw new Error('Invalid variable deck envelope');
    const seatIndex = lobby.seats.findIndex((seat) => seat.participantId === input.participantId && seat.seatCapability === input.seatCapability); if (seatIndex < 0 || lobby.lifecycle !== 'forming') throw new Error('Seat authorization rejected');
    if (lobby.seats[seatIndex]?.ready) throw new Error('PLAYERS_NOT_READY');
    const parsed = parseOnlineDeckSubmitV2(input); if (!parsed.ok) throw new Error('Invalid variable deck submission');
    const resolved = await resolveOnlineDeckSubmissionV2(parsed.value.entries, resolver); if (resolved.snapshot === null) return Object.freeze({ kind: 'online-forming-lobby-deck-result-v2', schemaVersion: 2, roomId, submissionId: parsed.value.submissionId, state: 'needs-attention', issues: resolved.issues, projection: projectOnlineVariableLobbyV4(lobby) });
    const currentLobby = this.loadVariableLobbyV4(roomId); if (currentLobby === null || currentLobby.lifecycle !== 'forming') throw new ConflictError();
    const currentSeatIndex = currentLobby.seats.findIndex((seat) => seat.participantId === input.participantId && seat.seatCapability === input.seatCapability); if (currentSeatIndex !== seatIndex || currentLobby.seats[currentSeatIndex]?.ready) throw new ConflictError();
    const contentDigest = parsed.contentDigest; const snapshot = resolved.snapshot; const snapshotJson = snapshot.serialized; const existingHead = this.deckHead(roomId, seatIndex); const revision = existingHead === null ? 1 : existingHead.revision + 1;
    if (existingHead !== null && existingHead.participantId === input.participantId && existingHead.contentDigest === contentDigest && existingHead.state === 'accepted') { const repairedLobby = currentLobby.seats[seatIndex]?.acceptedDeck ? currentLobby : setOnlineVariableLobbyDeckAcceptedV4(currentLobby, input.participantId, true); if (repairedLobby !== currentLobby) this.persistVariableLobbyV4(currentLobby, repairedLobby); return Object.freeze({ kind: 'online-forming-lobby-deck-result-v2', schemaVersion: 2, roomId, submissionId: existingHead.submissionId, state: 'accepted', issues: Object.freeze([]), projection: projectOnlineVariableLobbyV4(repairedLobby) }); }
    const nextLobby = setOnlineVariableLobbyDeckAcceptedV4(currentLobby, input.participantId, true); const currentLobbyJson = JSON.stringify(currentLobby); const nextLobbyJson = JSON.stringify(nextLobby);
    this.storage.transactionSync(() => {
      this.ensureDeckSchema();
      if (this.deckHead(roomId, seatIndex) !== null) { this.storage.sql.exec('DELETE FROM online_deck_submission_head_v2 WHERE room_id = ? AND seat_index = ?', roomId, seatIndex); this.storage.sql.exec('DELETE FROM online_deck_submission_history_v2 WHERE room_id = ? AND seat_index = ?', roomId, seatIndex); this.storage.sql.exec(DELETE_DECK_SNAPSHOT, roomId, seatIndex); this.storage.sql.exec('DELETE FROM online_deck_submission_ready_v2 WHERE room_id = ? AND seat_index = ?', roomId, seatIndex); }
      this.storage.sql.exec(INSERT_DECK_HEAD, roomId, seatIndex, input.participantId, parsed.value.deckId, parsed.value.submissionId, contentDigest, revision, 'accepted', snapshot.digest);
      this.storage.sql.exec(INSERT_DECK_HISTORY, roomId, seatIndex, parsed.value.submissionId, input.participantId, parsed.value.deckId, parsed.canonicalInput, contentDigest, revision, 'accepted', '[]');
      this.storage.sql.exec(INSERT_DECK_SNAPSHOT, roomId, seatIndex, snapshot.digest, snapshotJson);
      const updated = this.storage.sql.exec<{ readonly singleton: unknown }>('UPDATE online_forming_lobby SET state_json = ?, schema_version = 4 WHERE singleton = 1 AND room_id = ? AND schema_version = 4 AND state_json = ? RETURNING singleton', nextLobbyJson, roomId, currentLobbyJson).toArray(); if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
    });
    return Object.freeze({ kind: 'online-forming-lobby-deck-result-v2', schemaVersion: 2, roomId, submissionId: parsed.value.submissionId, state: 'accepted', issues: Object.freeze([]), projection: projectOnlineVariableLobbyV4(nextLobby) });
  }

  setVariableReadyV4(roomId: string, participantId: string, seatCapability: string, ready: boolean): OnlineVariableLobbyProjectionV4 {
    const lobby = this.loadVariableLobbyV4(roomId); if (lobby === null) throw new Error('Missing variable lobby');
    if (!lobby.seats.some((seat) => seat.participantId === participantId && seat.seatCapability === seatCapability && seat.acceptedDeck)) throw new Error('Accepted v2 deck required before ready');
    const next = setOnlineVariableLobbyReadyV4(lobby, participantId, ready); this.persistVariableLobbyV4(lobby, next); return projectOnlineVariableLobbyV4(next);
  }

  startVariableV4(roomId: string, hostParticipantId: string, seatCapability: string): Readonly<Record<string, unknown>> {
    const lobby = this.loadVariableLobbyV4(roomId); if (lobby === null) throw new Error('Missing variable lobby');
    if (lobby.hostParticipantId !== hostParticipantId || lobby.seats[0]?.seatCapability !== seatCapability) throw new Error('HOST_REQUIRED');
    if (lobby.seats.some((seat) => seat.participantId === null || !seat.acceptedDeck || !seat.ready)) throw new Error('PLAYERS_NOT_READY');
    if (lobby.configuration.startingLife !== 40) throw new Error('PREGAME_REQUIRES_40_LIFE');
    const seats: VariableGenesisSeatInputV3[] = lobby.seats.map((seat, index) => { const head = this.deckHead(roomId, index); const loaded = this.loadDeckSnapshotV2(roomId, index); if (head === null || loaded === null || head.state !== 'accepted' || head.snapshotDigest !== loaded.digest || seat.participantId === null) throw new Error('Accepted snapshot relation invalid'); let parsed: unknown; try { parsed = JSON.parse(loaded.serialized); } catch { throw new Error('Invalid variable snapshot JSON'); } if (!exactOwnKeys(parsed, ['entries']) || !Array.isArray(parsed.entries)) throw new Error('Invalid variable snapshot shape'); return Object.freeze({ seatIndex: index as 0 | 1 | 2 | 3, corePlayerId: seat.corePlayerId, participantId: seat.participantId, seatCapability: seat.seatCapability, snapshotDigest: loaded.digest, snapshot: Object.freeze({ entries: parsed.entries as never, digest: loaded.digest, serialized: loaded.serialized }) }); });
    const genesis = buildVariableRoomGenesisV3({ roomId, serverBuildId: lobby.serverBuildId, configuration: lobby.configuration, seats, tableParticipantId: lobby.tableParticipantId ?? undefined, tableCapability: lobby.tableCapability ?? undefined }); if (!genesis.ok) throw new Error(genesis.issues[0]?.code ?? 'VARIABLE_GENESIS_FAILED');
    if (!isOnlineVariableProjectionWithinFrameBudgetV1(genesis.protocolState)) throw new Error('Variable projection exceeds frame budget');
    const randomPlan = createServerPregamePlanV1(genesis.protocolState);
    const created = createOnlinePregameLifecycleV1({ initialState: genesis.protocolState, randomPlan });
    if (!created.ok) throw new Error('PREGAME_INITIALIZATION_FAILED');
    const pregame = created.value;
    const protocolJson = JSON.stringify(genesis.protocolState);
    const pregameJson = JSON.stringify(pregame);
    const lobbyJson = JSON.stringify(lobby);
    const nextLobby = Object.freeze({ ...lobby, lifecycle: 'started' as const, admissionOpen: false });
    const nextLobbyJson = JSON.stringify(nextLobby);
    this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_VARIABLE_ROOM);
      this.storage.sql.exec(CREATE_JOURNAL);
      this.storage.sql.exec(CREATE_CHECKPOINT);
      this.storage.sql.exec(CREATE_PREGAME);
      this.securityRepository.createSchemaInTransaction();
      const protocolRows = this.storage.sql.exec<{ readonly singleton: unknown }>(SELECT_VARIABLE_ROOM).toArray();
      const pregameRows = this.storage.sql.exec<PregameRow>(SELECT_PREGAME).toArray();
      if (protocolRows.length !== 0 || pregameRows.length !== 0) throw new ConflictError();
      this.storage.sql.exec('INSERT INTO online_variable_room_state (singleton, schema_version, room_id, revision, room_lifecycle, state_json) VALUES (1, 2, ?, 0, ?, ?)', roomId, genesis.protocolState.room.lifecycle, protocolJson);
      this.storage.sql.exec(INSERT_CHECKPOINT, roomId, 0, protocolJson);
      this.securityRepository.initializeInTransaction(roomId, genesis.protocolState, Date.now());
      const updatedLobby = this.storage.sql.exec<{ readonly singleton: unknown }>('UPDATE online_forming_lobby SET state_json = ?, schema_version = 4 WHERE singleton = 1 AND room_id = ? AND schema_version = 4 AND state_json = ? RETURNING singleton', nextLobbyJson, roomId, lobbyJson).toArray();
      if (updatedLobby.length !== 1 || updatedLobby[0]?.singleton !== 1) throw new ConflictError();
      this.storage.sql.exec('INSERT INTO online_pregame_state (singleton, schema_version, room_id, revision, phase, initial_state_json, state_json) VALUES (1, 1, ?, 0, ?, ?, ?)', roomId, pregame.phase, protocolJson, pregameJson);
    });
    return Object.freeze({ kind: 'online-cloudflare-room-status-v2', schemaVersion: 2, roomId, playerCount: genesis.protocolState.configuration.playerCount, startingLife: genesis.protocolState.configuration.startingLife, revision: 0, roomLifecycle: genesis.protocolState.room.lifecycle, pregame: projectOnlinePregameV1(pregame, hostParticipantId) });
  }

  private initializeDynamicRoomV2(roomId: string, state: OnlineProtocolStateV1, expectedLobby: OnlineFormingLobbyV1, expectedSeats: readonly DynamicGenesisSeatInputV2[]): OnlineCloudflareRoomStatusV1 {
    const stateJson = serializeOnlineCloudflareProtocolStateV1(state);
    const expectedLobbyJson = JSON.stringify(expectedLobby);
    if (expectedLobbyJson === undefined) throw new Error('Invalid lobby serialization');
    return this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_ROOM); this.storage.sql.exec(CREATE_JOURNAL); this.storage.sql.exec(CREATE_MIGRATION); this.storage.sql.exec(CREATE_CHECKPOINT); this.storage.sql.exec(CREATE_RECOVERY_VERIFICATION); this.storage.sql.exec(CREATE_DECK_HEAD); this.storage.sql.exec(CREATE_DECK_HISTORY); this.storage.sql.exec(CREATE_DECK_SNAPSHOT); this.storage.sql.exec(CREATE_DECK_READY); this.storage.sql.exec(CREATE_LOBBY); this.storage.sql.exec(CREATE_ADMISSION); this.storage.sql.exec(CREATE_TABLE_CREDENTIALS); this.storage.sql.exec(CREATE_REVOKED); this.securityRepository.createSchemaInTransaction();
      const lobbyRows = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray();
      if (lobbyRows.length !== 1 || lobbyRows[0]?.room_id !== roomId || lobbyRows[0]?.state_json !== expectedLobbyJson) throw new ConflictError();
      for (const seat of expectedSeats) {
        const head = this.deckHead(roomId, seat.seatIndex);
        const snapshot = this.loadDeckSnapshotV2(roomId, seat.seatIndex);
        if (head === null || snapshot === null || head.participantId !== seat.participantId || head.revision !== seat.revision || head.submissionId !== seat.submissionId || head.contentDigest !== seat.contentDigest || head.snapshotDigest !== seat.snapshotDigest || snapshot.digest !== seat.snapshotDigest || head.state !== 'accepted' || !this.v2Ready(roomId, seat.seatIndex)) throw new ConflictError();
      }
      const existing = this.rows();
      if (existing.length > 1) throw new Error('Invalid singleton state');
      if (existing.length === 1) {
        const current = this.loadWithoutMigration();
        if (current === null || serializeOnlineCloudflareProtocolStateV1(current) !== stateJson) throw new ConflictError();
        return this.statusFor(current);
      }
      this.storage.sql.exec(INSERT_ROOM, 1, ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1, roomId, 0, state.room.lifecycle, state.coreRoot.acceptedCommandCount, stateJson);
      this.securityRepository.initializeInTransaction(roomId, state, Date.now());
      this.storage.sql.exec(INSERT_CHECKPOINT, roomId, 0, stateJson);
      this.writeRecoveryVerificationInTransaction(state, 0);
      return this.statusFor(state);
    });
  }

  async submitDeckV2(roomId: string, input: unknown, resolver: OnlineDeckResolverV2): Promise<OnlineDeckSubmissionResultV2> {
    const lobby = this.loadLobby(roomId);
    if (lobby === null) throw new Error('Missing forming lobby');
    if (!exactSubmissionEnvelope(input) || !isOnlineRoomApplicationIdV1(input.participantId) || !isOnlineRoomSeatCapabilityV1(input.seatCapability)) throw new Error('Seat authorization rejected');
    let authorizedSeatIndex: number;
    try { authorizedSeatIndex = authorizeOnlineFormingLobbySeatV1(lobby, input.participantId, input.seatCapability); }
    catch { throw new Error('Seat authorization rejected'); }
    if (lobby.lifecycle === 'started' || this.load()?.room.lifecycle === 'active') throw new Error('Started lobby cannot accept deck submissions');
    this.validateDeckRelations(roomId, lobby);
    if (input.kind !== 'online-forming-lobby-deck-submit-v2' || input.schemaVersion !== 2) throw new Error('Invalid v2 protocol envelope');
    if (!closedSubmissionShape(input)) throw new Error('Invalid deck submission shape');
    const forbidden = [roomId, lobby.roomId, lobby.hostParticipantId, ...lobby.seats.flatMap((seat) => [seat.seatCapability, ...(seat.inviteCapability === null ? [] : [seat.inviteCapability]), ...(seat.participantId === null ? [] : [seat.participantId])])];
    if (typeof input.deckId !== 'string' || typeof input.submissionId !== 'string') throw new Error('Invalid deck metadata');
    assertSafeOnlineDeckMetadataV2(input.deckId, forbidden);
    assertSafeOnlineDeckMetadataV2(input.submissionId, forbidden);
    const parsed = parseOnlineDeckSubmitV2(input);
    if (!parsed.ok) {
      const submissionId = isRecord(input) && isOnlineRoomApplicationIdV1(input.submissionId) ? input.submissionId : 'invalid';
      this.ensureDeckSchema();
      const canonicalInput = submissionId === 'invalid' ? null : canonicalRawDeckSubmissionInput(input, forbidden);
      const contentDigest = canonicalInput === null ? null : coreSha256HexV1(canonicalInput);
      if (submissionId !== 'invalid' && contentDigest !== null) {
        const existingHistory = this.storage.sql.exec<DeckHistoryRow>(SELECT_DECK_HISTORY, roomId, authorizedSeatIndex, submissionId).toArray();
        if (existingHistory.length > 1) throw new Error('Invalid v2 submission history');
        const history = existingHistory[0];
        if (history !== undefined) {
          const entryCount = this.validateHistoryRow(history);
          if (history.content_digest !== contentDigest) return this.resultV2(roomId, submissionId, 'needs-attention', Object.freeze([{ code: 'SUBMISSION_CONFLICT', entryIndex: null, retryable: false }]), this.projectLobbyV2(roomId));
          return this.resultV2(roomId, submissionId, 'needs-attention', this.issuesFromHistory(history, entryCount), this.projectLobbyV2(roomId));
        }
      }
      const existingHead = this.deckHead(roomId, authorizedSeatIndex);
      if (submissionId !== 'invalid' && existingHead !== null && existingHead.state !== 'none') {
        if (canonicalInput !== null && contentDigest !== null) this.beginInvalidDeckSubmissionV2(roomId, authorizedSeatIndex, existingHead, input.participantId, input.deckId, submissionId, canonicalInput, contentDigest, parsed.issues);
        else this.invalidateFailedDeckSubmissionV2(roomId, authorizedSeatIndex, existingHead, parsed.issues);
        const projection = this.projectLobbyV2(roomId);
        return this.resultV2(roomId, submissionId, 'needs-attention', parsed.issues, projection);
      }
      const projection = this.projectLobbyV2(roomId, lobby);
      const state = projection.seats[authorizedSeatIndex as 0 | 1 | 2 | 3]?.deckState ?? 'none';
      return this.resultV2(roomId, submissionId, state, parsed.issues, projection);
    }
    const value = parsed.value;
    const seatIndex = authorizedSeatIndex;
    this.ensureDeckSchema();
    const existingHistory = this.storage.sql.exec<DeckHistoryRow>(SELECT_DECK_HISTORY, roomId, seatIndex, value.submissionId).toArray();
    if (existingHistory.length > 1) throw new Error('Invalid v2 submission history');
    const history = existingHistory[0];
    const historyEntryCount = history === undefined ? null : this.validateHistoryRow(history);
    if (history !== undefined && typeof history.content_digest === 'string' && history.content_digest !== parsed.contentDigest) {
      return this.resultV2(roomId, value.submissionId, 'needs-attention', Object.freeze([{ code: 'SUBMISSION_CONFLICT', entryIndex: null, retryable: false }]), this.projectLobbyV2(roomId));
    }
    const existingHead = this.deckHead(roomId, seatIndex);
    if (history !== undefined && history.state !== 'resolving' && existingHead?.state !== 'none') {
      const state = history.state === 'accepted' ? 'accepted' : 'needs-attention';
      if (historyEntryCount === null) throw new Error('Missing v2 history entry count');
      return this.resultV2(roomId, value.submissionId, state, this.issuesFromHistory(history, historyEntryCount), this.projectLobbyV2(roomId));
    }
    if (history !== undefined && history.state === 'resolving') {
      const inflightKey = [roomId, String(seatIndex), value.submissionId].join(':');
      const inflight = this.deckInflight.get(inflightKey);
      if (inflight !== undefined) return inflight;
      const current = this.deckHead(roomId, seatIndex);
      if (current !== null && current.submissionId === value.submissionId && current.contentDigest === parsed.contentDigest) {
        const resumed = (async () => {
          const resolution = await resolveOnlineDeckSubmissionV2(value.entries, resolver);
          return this.completeDeckV2(roomId, seatIndex, value, current.revision, resolution.snapshot, resolution.issues);
        })();
        this.deckInflight.set(inflightKey, resumed);
        try { return await resumed; } finally { this.deckInflight.delete(inflightKey); }
      }
    }
    let beginRevision = 0;
    this.storage.transactionSync(() => {
      this.ensureDeckSchema();
      const current = this.deckHead(roomId, seatIndex);
      if ((current?.revision ?? 0) >= Number.MAX_SAFE_INTEGER) throw new Error('Deck revision overflow');
      beginRevision = (current?.revision ?? 0) + 1;
      const currentLobby = this.loadLobby(roomId);
      if (currentLobby === null) throw new Error('Missing forming lobby');
      const nextLobby = invalidateOnlineFormingLobbySeatDeckV1(currentLobby, seatIndex);
      const previousJson = JSON.stringify(currentLobby);
      const nextJson = JSON.stringify(nextLobby);
      if (previousJson === undefined || nextJson === undefined) throw new Error('Invalid lobby serialization');
      if (current === null) this.storage.sql.exec(INSERT_DECK_HEAD, roomId, seatIndex, value.participantId, value.deckId, value.submissionId, parsed.contentDigest, beginRevision, 'resolving', null);
      else {
        const updated = this.storage.sql.exec<{ seat_index: unknown }>(UPDATE_DECK_HEAD, value.participantId, value.deckId, value.submissionId, parsed.contentDigest, beginRevision, 'resolving', null, roomId, seatIndex, current.revision).toArray();
        if (updated.length !== 1 || updated[0]?.seat_index !== seatIndex) throw new ConflictError();
      }
      this.storage.sql.exec(DELETE_DECK_SNAPSHOT, roomId, seatIndex);
      this.clearReadyV2InTransaction(roomId, seatIndex);
      if (history === undefined) this.storage.sql.exec(INSERT_DECK_HISTORY, roomId, seatIndex, value.submissionId, value.participantId, value.deckId, parsed.canonicalInput, parsed.contentDigest, beginRevision, 'resolving', '[]');
      else {
        const updatedHistory = this.storage.sql.exec<{ submission_id: unknown }>(UPDATE_DECK_HISTORY, value.participantId, value.deckId, parsed.canonicalInput, parsed.contentDigest, beginRevision, 'resolving', '[]', roomId, seatIndex, value.submissionId).toArray();
        if (updatedHistory.length !== 1 || updatedHistory[0]?.submission_id !== value.submissionId) throw new ConflictError();
      }
      const updatedLobby = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_LOBBY, roomId, nextJson, roomId, previousJson).toArray();
      if (updatedLobby.length !== 1 || updatedLobby[0]?.singleton !== 1) throw new ConflictError();
    });
    const inflightKey = [roomId, String(seatIndex), value.submissionId].join(':');
    const operation = (async () => {
      const resolution = await resolveOnlineDeckSubmissionV2(value.entries, resolver);
      return this.completeDeckV2(roomId, seatIndex, value, beginRevision, resolution.snapshot, resolution.issues);
    })();
    this.deckInflight.set(inflightKey, operation);
    try { return await operation; } finally { this.deckInflight.delete(inflightKey); }
  }

  private completeDeckV2(roomId: string, seatIndex: number, value: OnlineDeckSubmitV2, revision: number, snapshot: import('../deckSubmission/index').OnlineDeckResolvedSnapshotV2 | null, issues: readonly OnlineDeckSubmissionIssueV2[]): OnlineDeckSubmissionResultV2 {
    let stale = false;
    let alreadyAccepted = false;
    const effectiveSnapshot = snapshot;
    const effectiveIssues = issues;
    if (snapshot !== null) {
      const lobby = this.loadLobby(roomId);
      const capabilities = lobby?.seats.flatMap((seat) => [seat.seatCapability, ...(seat.inviteCapability === null ? [] : [seat.inviteCapability])]) ?? [];
      for (const capability of capabilities) assertNoConfiguredCapabilityFragmentV1(snapshot.serialized, [capability]);
    }
    this.storage.transactionSync(() => {
      this.ensureDeckSchema();
      const current = this.deckHead(roomId, seatIndex);
      if (current === null || current.revision !== revision || current.submissionId !== value.submissionId || current.contentDigest !== contentDigestOfDeckSubmissionV2(value)) {
        const staleIssue = Object.freeze([{ code: 'STALE_RESOLUTION' as const, entryIndex: null, retryable: true }]);
        if (current !== null && current.submissionId !== value.submissionId) {
          const updatedHistory = this.storage.sql.exec<{ submission_id: unknown }>(UPDATE_DECK_HISTORY, value.participantId, value.deckId, canonicalDeckSubmissionInputV2(value), contentDigestOfDeckSubmissionV2(value), revision, 'needs-attention', JSON.stringify(staleIssue), roomId, seatIndex, value.submissionId).toArray();
          if (updatedHistory.length !== 1 || updatedHistory[0]?.submission_id !== value.submissionId) throw new ConflictError();
        }
        stale = true;
        return;
      }
      if (current.state === 'accepted' && current.snapshotDigest !== null) {
        const existingSnapshot = this.loadDeckSnapshotV2(roomId, seatIndex);
        if (existingSnapshot !== null && existingSnapshot.digest === current.snapshotDigest) { alreadyAccepted = true; return; }
      }
      const finalState: OnlineDeckSubmissionStateV2 = effectiveSnapshot === null ? 'needs-attention' : 'accepted';
      const snapshotDigest = effectiveSnapshot?.digest ?? null;
      if (effectiveSnapshot !== null) this.storage.sql.exec(INSERT_DECK_SNAPSHOT, roomId, seatIndex, effectiveSnapshot.digest, effectiveSnapshot.serialized);
      else this.storage.sql.exec(DELETE_DECK_SNAPSHOT, roomId, seatIndex);
      const updated = this.storage.sql.exec<{ seat_index: unknown }>(UPDATE_DECK_HEAD, value.participantId, value.deckId, value.submissionId, current.contentDigest, revision, finalState, snapshotDigest, roomId, seatIndex, current.revision).toArray();
      if (updated.length !== 1 || updated[0]?.seat_index !== seatIndex) throw new ConflictError();
      const updatedHistory = this.storage.sql.exec<{ submission_id: unknown }>(UPDATE_DECK_HISTORY, value.participantId, value.deckId, canonicalDeckSubmissionInputV2(value), current.contentDigest, revision, finalState, JSON.stringify(effectiveIssues), roomId, seatIndex, value.submissionId).toArray();
      if (updatedHistory.length !== 1 || updatedHistory[0]?.submission_id !== value.submissionId) throw new ConflictError();
    });
    const lobby = this.loadLobby(roomId);
    if (lobby === null) throw new Error('Missing forming lobby');
    if (stale) return this.resultV2(roomId, value.submissionId, 'needs-attention', Object.freeze([{ code: 'STALE_RESOLUTION', entryIndex: null, retryable: true }]), this.projectLobbyV2(roomId, lobby));
    if (alreadyAccepted) return this.resultV2(roomId, value.submissionId, 'accepted', [], this.projectLobbyV2(roomId, lobby));
    const state: Exclude<OnlineDeckSubmissionStateV2, 'none'> = effectiveSnapshot === null ? 'needs-attention' : 'accepted';
    return this.resultV2(roomId, value.submissionId, state, effectiveIssues, this.projectLobbyV2(roomId, lobby));
  }

  initializeLobby(lobby: OnlineFormingLobbyV1): void {
    const checked = validateOnlineFormingLobbyV1(lobby);
    if (!checked.ok) throw new Error('Invalid forming lobby state');
    lobby = checked.value;
    const stateJson = JSON.stringify(lobby);
    if (stateJson === undefined) throw new Error('Invalid forming lobby serialization');
    this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_LOBBY);
      this.storage.sql.exec(CREATE_DECK_HEAD);
      this.storage.sql.exec(CREATE_DECK_HISTORY);
      this.storage.sql.exec(CREATE_DECK_SNAPSHOT);
      this.storage.sql.exec(CREATE_DECK_READY);
      this.storage.sql.exec(CREATE_ADMISSION);
      this.storage.sql.exec(CREATE_TABLE_CREDENTIALS);
      this.storage.sql.exec(CREATE_REVOKED);
      const rows = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray();
      if (rows.length > 1) throw new Error('Invalid forming lobby singleton');
      if (rows.length === 1) {
        const row = rows[0];
        if (row === undefined || row.room_id !== lobby.roomId || row.state_json !== stateJson) throw new ConflictError();
        return;
      }
      this.storage.sql.exec(INSERT_LOBBY, 1, lobby.roomId, stateJson);
    });
  }

  initializeLobbyV3(
    lobbyInput: OnlineFormingLobbyV1,
    admissionInput: OnlineLobbyAdmissionV3,
    tableParticipantId: string,
    tableCapability: string,
  ): void {
    const checkedLobby = validateOnlineFormingLobbyV1(lobbyInput);
    const checkedAdmission = validateOnlineLobbyAdmissionV3(admissionInput);
    if (!checkedLobby.ok || !checkedAdmission.ok || checkedLobby.value.roomId !== checkedAdmission.value.roomId || !isOnlineRoomApplicationIdV1(tableParticipantId) || !isOnlineRoomSeatCapabilityV1(tableCapability)) throw new Error('Invalid v3 lobby initialization');
    const seatInviteCapabilities = checkedLobby.value.seats.flatMap((seat) => [seat.seatCapability, ...(seat.inviteCapability === null ? [] : [seat.inviteCapability])]);
    const capabilitySet = [...seatInviteCapabilities, checkedAdmission.value.currentCapability, tableCapability];
    for (let index = 0; index < capabilitySet.length; index += 1) {
      const current = capabilitySet[index];
      if (current === undefined) throw new Error('Invalid v3 capability set');
      for (let candidateIndex = index + 1; candidateIndex < capabilitySet.length; candidateIndex += 1) {
        const candidate = capabilitySet[candidateIndex];
        if (candidate === undefined) throw new Error('Invalid v3 capability set');
        if (current.split('_', 1)[0] === candidate.split('_', 1)[0]) continue;
        try { assertNoConfiguredCapabilityFragmentV1(current, [candidate]); assertNoConfiguredCapabilityFragmentV1(candidate, [current]); } catch { throw new Error('Invalid v3 capability collision'); }
      }
    }
    try {
      for (const metadata of [checkedLobby.value.roomId, checkedLobby.value.serverBuildId, checkedLobby.value.hostParticipantId, tableParticipantId]) assertNoConfiguredCapabilityFragmentV1(metadata, capabilitySet);
    } catch { throw new Error('Invalid v3 capability collision'); }
    const stateJson = JSON.stringify(checkedLobby.value);
    const admissionJson = JSON.stringify(checkedAdmission.value);
    if (stateJson === undefined || admissionJson === undefined) throw new Error('Invalid v3 lobby serialization');
    this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_LOBBY); this.storage.sql.exec(CREATE_ADMISSION); this.storage.sql.exec(CREATE_TABLE_CREDENTIALS); this.storage.sql.exec(CREATE_REVOKED); this.storage.sql.exec(CREATE_DECK_HEAD); this.storage.sql.exec(CREATE_DECK_HISTORY); this.storage.sql.exec(CREATE_DECK_SNAPSHOT); this.storage.sql.exec(CREATE_DECK_READY);
      const existing = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray();
      if (existing.length > 1) throw new Error('Invalid forming lobby singleton');
      if (existing.length === 1) {
        if (existing[0]?.room_id !== checkedLobby.value.roomId || existing[0]?.state_json !== stateJson) throw new ConflictError();
        const existingAdmission = this.loadAdmissionV3(checkedLobby.value.roomId);
        const existingTable = this.tableCredentialsV3(checkedLobby.value.roomId);
        if (existingAdmission === null || JSON.stringify(existingAdmission) !== admissionJson || existingTable?.participantId !== tableParticipantId || existingTable.capability !== tableCapability) throw new ConflictError();
        return;
      }
      this.storage.sql.exec(INSERT_LOBBY, 1, checkedLobby.value.roomId, stateJson);
      this.storage.sql.exec(INSERT_ADMISSION, 3, checkedAdmission.value.roomId, admissionJson);
      this.storage.sql.exec(INSERT_TABLE_CREDENTIALS, checkedLobby.value.roomId, tableParticipantId, tableCapability);
    });
  }

  loadAdmissionV3(roomId: string): OnlineLobbyAdmissionV3 | null {
    let rows: AdmissionRow[];
    try { rows = this.storage.sql.exec<AdmissionRow>(SELECT_ADMISSION).toArray(); } catch (error: unknown) { if (error instanceof Error && /no such table/i.test(error.message)) return null; throw error; }
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error('Invalid admission singleton');
    const row = rows[0];
    if (row === undefined || row.singleton !== 1 || row.schema_version !== 3 || row.room_id !== roomId || typeof row.state_json !== 'string') throw new Error('Invalid admission row');
    let parsed: unknown;
    try { parsed = JSON.parse(row.state_json); } catch { throw new Error('Invalid admission JSON'); }
    const checked = validateOnlineLobbyAdmissionV3(parsed);
    if (!checked.ok || JSON.stringify(checked.value) !== row.state_json) throw new Error('Invalid admission state');
    return checked.value;
  }

  tableCredentialsV3(roomId: string): Readonly<{ readonly participantId: string; readonly capability: string }> | null {
    let rows: TableCredentialRow[];
    try { rows = this.storage.sql.exec<TableCredentialRow>(SELECT_TABLE_CREDENTIALS).toArray(); } catch (error: unknown) { if (error instanceof Error && /no such table/i.test(error.message)) return null; throw error; }
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error('Invalid table credential singleton');
    const row = rows[0];
    if (row === undefined || row.singleton !== 1 || row.room_id !== roomId || typeof row.participant_id !== 'string' || typeof row.capability !== 'string') throw new Error('Invalid table credentials');
    return Object.freeze({ participantId: row.participant_id, capability: row.capability });
  }

  isRevokedCredentialV3(roomId: string, participantId: string, seatCapability: string): boolean {
    try { return this.storage.sql.exec(SELECT_REVOKED, roomId, participantId, seatCapability).toArray().length !== 0; } catch (error: unknown) { if (error instanceof Error && /no such table/i.test(error.message)) return false; throw error; }
  }

  claimLobbyAdmissionV3(roomId: string, input: Readonly<{ readonly participantId: string; readonly admissionCapability: string }>): Readonly<{ readonly lobby: OnlineFormingLobbyV1; readonly admission: OnlineLobbyAdmissionV3; readonly seatCapability: string }> {
    return this.storage.transactionSync(() => {
      const lobby = this.loadLobby(roomId); const admission = this.loadAdmissionV3(roomId);
      if (lobby === null || admission === null) throw new Error('ROOM_NOT_FOUND');
      const result = claimOnlineLobbyAdmissionV3(lobby, admission, input);
      const previousJson = JSON.stringify(lobby); const nextJson = JSON.stringify(result.lobby);
      if (previousJson === undefined || nextJson === undefined) throw new Error('Invalid lobby serialization');
      const updated = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_LOBBY, roomId, nextJson, roomId, previousJson).toArray();
      if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
      return Object.freeze({ lobby: result.lobby, admission, seatCapability: result.seatCapability });
    });
  }

  rotateLobbyAdmissionV3(roomId: string, input: Readonly<{ readonly hostParticipantId: string; readonly seatCapability: string; readonly nextCapability: string }>): OnlineLobbyAdmissionV3 {
    return this.storage.transactionSync(() => {
      const lobby = this.loadLobby(roomId); const current = this.loadAdmissionV3(roomId);
      if (lobby === null || current === null) throw new Error('ROOM_NOT_FOUND');
      const next = rotateOnlineLobbyAdmissionV3(lobby, current, input);
      const previousJson = JSON.stringify(current); const nextJson = JSON.stringify(next);
      if (previousJson === undefined || nextJson === undefined) throw new Error('Invalid admission serialization');
      const updated = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_ADMISSION, roomId, nextJson, roomId, previousJson).toArray();
      if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
      return next;
    });
  }

  closeLobbyAdmissionV3(roomId: string, input: Readonly<{ readonly hostParticipantId: string; readonly seatCapability: string }>): OnlineLobbyAdmissionV3 {
    return this.storage.transactionSync(() => {
      const lobby = this.loadLobby(roomId); const current = this.loadAdmissionV3(roomId);
      if (lobby === null || current === null) throw new Error('ROOM_NOT_FOUND');
      const next = closeOnlineLobbyAdmissionV3(lobby, current, input);
      const previousJson = JSON.stringify(current); const nextJson = JSON.stringify(next);
      if (previousJson === undefined || nextJson === undefined) throw new Error('Invalid admission serialization');
      const updated = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_ADMISSION, roomId, nextJson, roomId, previousJson).toArray();
      if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
      return next;
    });
  }

  replaceLobbySeatV3(roomId: string, targetParticipantId: string, replacementSeatCapability: string, replacementInviteCapability: string, revoke: boolean): Readonly<{ readonly lobby: OnlineFormingLobbyV1; readonly seatCapability: string }> {
    return this.storage.transactionSync(() => {
      const lobby = this.loadLobby(roomId);
      if (lobby === null) throw new Error('ROOM_NOT_FOUND');
      if (!isOnlineRoomSeatCapabilityV1(replacementSeatCapability) || !isOnlineRoomSeatCapabilityV1(replacementInviteCapability)) throw new Error('CREDENTIAL_REJECTED');
      const configured = lobby.seats.flatMap((seat) => [seat.seatCapability, ...(seat.inviteCapability === null ? [] : [seat.inviteCapability])]);
      if (configured.includes(replacementSeatCapability) || configured.includes(replacementInviteCapability) || replacementSeatCapability === replacementInviteCapability) throw new Error('CREDENTIAL_REJECTED');
      const index = lobby.seats.findIndex((seat) => seat.participantId === targetParticipantId);
      if (index <= 0) throw new Error(index === 0 ? 'HOST_REQUIRED' : 'CREDENTIAL_REJECTED');
      const target = lobby.seats[index];
      if (target === undefined) throw new Error('CREDENTIAL_REJECTED');
      const nextSeats = lobby.seats.map((seat, seatIndex) => seatIndex === index ? Object.freeze({ ...seat, participantId: null, seatCapability: replacementSeatCapability, inviteCapability: replacementInviteCapability, deckId: null, deckText: null, ready: false }) : seat);
      const checkedNext = validateOnlineFormingLobbyV1({ ...lobby, lifecycle: 'forming', seats: nextSeats });
      if (!checkedNext.ok) throw new Error('Invalid seat replacement');
      const next = checkedNext.value;
      const previousJson = JSON.stringify(lobby); const nextJson = JSON.stringify(next);
      if (previousJson === undefined || nextJson === undefined) throw new Error('Invalid lobby serialization');
      const updated = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_LOBBY, roomId, nextJson, roomId, previousJson).toArray();
      if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
      this.storage.sql.exec('DELETE FROM online_deck_submission_head_v2 WHERE room_id = ? AND seat_index = ?', roomId, index);
      this.storage.sql.exec('DELETE FROM online_deck_submission_history_v2 WHERE room_id = ? AND seat_index = ?', roomId, index);
      this.storage.sql.exec('DELETE FROM online_deck_submission_snapshot_v2 WHERE room_id = ? AND seat_index = ?', roomId, index);
      this.storage.sql.exec('DELETE FROM online_deck_submission_ready_v2 WHERE room_id = ? AND seat_index = ?', roomId, index);
      if (revoke) {
        this.storage.sql.exec(INSERT_REVOKED, roomId, targetParticipantId, target.seatCapability);
        this.storage.sql.exec(TRIM_REVOKED, roomId, roomId);
      }
      return Object.freeze({ lobby: next, seatCapability: replacementSeatCapability });
    });
  }

  deleteFormingLobbyV3(roomId: string): void {
    this.storage.transactionSync(() => {
      this.storage.sql.exec('DELETE FROM online_forming_lobby WHERE singleton = 1 AND room_id = ?', roomId);
      this.storage.sql.exec('DELETE FROM online_lobby_admission WHERE singleton = 1 AND room_id = ?', roomId);
      this.storage.sql.exec('DELETE FROM online_lobby_table_credentials WHERE singleton = 1 AND room_id = ?', roomId);
      this.storage.sql.exec('DELETE FROM online_lobby_revoked_credential WHERE room_id = ?', roomId);
      this.storage.sql.exec('DELETE FROM online_deck_submission_head_v2 WHERE room_id = ?', roomId);
      this.storage.sql.exec('DELETE FROM online_deck_submission_history_v2 WHERE room_id = ?', roomId);
      this.storage.sql.exec('DELETE FROM online_deck_submission_snapshot_v2 WHERE room_id = ?', roomId);
      this.storage.sql.exec('DELETE FROM online_deck_submission_ready_v2 WHERE room_id = ?', roomId);
    });
  }

  persistLobby(previous: OnlineFormingLobbyV1, next: OnlineFormingLobbyV1): void {
    if (this.load()?.room.lifecycle === 'active') throw new Error('Active Room lobby is immutable');
    const checkedPrevious = validateOnlineFormingLobbyV1(previous);
    const checkedNext = validateOnlineFormingLobbyV1(next);
    if (!checkedPrevious.ok || !checkedNext.ok) throw new Error('Invalid forming lobby transition');
    previous = checkedPrevious.value;
    next = checkedNext.value;
    const previousJson = JSON.stringify(previous);
    const nextJson = JSON.stringify(next);
    if (previous.roomId !== next.roomId || previousJson === undefined || nextJson === undefined) throw new Error('Invalid forming lobby transition');
    this.storage.transactionSync(() => {
      const rows = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray();
      if (rows.length !== 1 || rows[0]?.room_id !== previous.roomId || rows[0]?.state_json !== previousJson) throw new ConflictError();
      const updated = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_LOBBY, next.roomId, nextJson, previous.roomId, previousJson).toArray();
      if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
      this.ensureDeckSchema();
      for (let seatIndex = 0; seatIndex < previous.seats.length; seatIndex += 1) {
        const before = previous.seats[seatIndex];
        const after = next.seats[seatIndex];
        if (before !== undefined && after !== undefined && (before.deckId !== after.deckId || before.deckText !== after.deckText)) {
          const staleHead = this.deckHead(previous.roomId, seatIndex);
          if (staleHead !== null) {
            if (staleHead.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Deck revision overflow');
            const invalidatedRevision = staleHead.revision + 1;
            const invalidatedHead = this.storage.sql.exec<{ seat_index: unknown }>(INVALIDATE_DECK_HEAD, invalidatedRevision, 'needs-attention', previous.roomId, seatIndex, staleHead.revision).toArray();
            if (invalidatedHead.length !== 1 || invalidatedHead[0]?.seat_index !== seatIndex) throw new ConflictError();
            const historyRows = this.storage.sql.exec<DeckHistoryRow>(SELECT_DECK_HISTORY, previous.roomId, seatIndex, staleHead.submissionId).toArray();
            if (historyRows.length !== 1 || historyRows[0] === undefined) throw new Error('Missing v2 history during v1 invalidation');
            const staleHistory = historyRows[0];
            this.validateHistoryRow(staleHistory);
            const staleIssue = JSON.stringify([{ code: 'STALE_RESOLUTION', entryIndex: null, retryable: false }]);
            const invalidatedHistory = this.storage.sql.exec<{ submission_id: unknown }>(UPDATE_DECK_HISTORY, staleHead.participantId, staleHead.deckId, staleHistory.canonical_input, staleHead.contentDigest, invalidatedRevision, 'needs-attention', staleIssue, previous.roomId, seatIndex, staleHead.submissionId).toArray();
            if (invalidatedHistory.length !== 1 || invalidatedHistory[0]?.submission_id !== staleHead.submissionId) throw new ConflictError();
          }
          this.storage.sql.exec(DELETE_DECK_SNAPSHOT, previous.roomId, seatIndex);
          this.storage.sql.exec(UPDATE_DECK_READY, 0, previous.roomId, seatIndex);
        }
      }
    });
  }

  status(): OnlineCloudflareRoomStatusV1 | null {
    const state = this.load();
    if (state === null) return null;
    this.securityRepository.read(state);
    return this.statusFor(state);
  }

  secureStatus(): OnlineCloudflareRoomStatusV1 | null {
    const state = this.load();
    if (state === null) return null;
    this.securityRepository.read(state);
    return this.statusFor(state);
  }

  initialize(roomId: string, state: OnlineProtocolStateV1, nowInput: unknown = Date.now()): OnlineCloudflareRoomStatusV1 {
    const stateJson = serializeOnlineCloudflareProtocolStateV1(state);
    if (
      state.room.roomId !== roomId ||
      state.revision !== 0 ||
      state.coreRoot.acceptedCommandCount !== 0 ||
      state.receipts.length !== 0
    ) throw new Error('Only an empty initial state may be imported');
    const result = this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_ROOM);
      this.storage.sql.exec(CREATE_JOURNAL);
      this.storage.sql.exec(CREATE_MIGRATION);
      this.storage.sql.exec(CREATE_CHECKPOINT);
      this.storage.sql.exec(CREATE_RECOVERY_VERIFICATION);
      this.storage.sql.exec(CREATE_DECK_HEAD);
      this.storage.sql.exec(CREATE_DECK_HISTORY);
      this.storage.sql.exec(CREATE_DECK_SNAPSHOT);
      this.storage.sql.exec(CREATE_DECK_READY);
      this.securityRepository.createSchemaInTransaction();
      const migrations = this.storage.sql.exec<MigrationRow>(SELECT_MIGRATION).toArray();
      if (migrations.length > 1 || (migrations[0] !== undefined && migrations[0].schema_version !== ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1 && migrations[0].schema_version !== ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2)) throw new Error('Invalid application migration ledger');
      if (migrations.length === 0) this.storage.sql.exec(INSERT_MIGRATION, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2);
      else if (migrations[0]?.schema_version === ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1) {
        const upgraded = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_MIGRATION, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1).toArray();
        if (upgraded.length !== 1 || upgraded[0]?.singleton !== 1) throw new Error('Application schema migration failed');
      }
      const existing = this.rows();
      if (existing.length > 1) throw new Error('Invalid singleton state');
      if (existing.length === 1) {
        const current = this.loadWithoutMigration();
        if (current === null || current.room.roomId !== roomId || serializeOnlineCloudflareProtocolStateV1(current) !== stateJson) throw new ConflictError();
        if (this.recoveryVerificationHit(current) === null) this.validateCheckpoint(current);
        this.securityRepository.read(current);
        return Object.freeze({ status: this.statusFor(current), recovery: null, inserted: false });
      }
      this.storage.sql.exec(INSERT_ROOM, 1, ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1, roomId, state.revision, state.room.lifecycle, state.coreRoot.acceptedCommandCount, stateJson);
      this.securityRepository.initializeInTransaction(roomId, state, nowInput);
      this.storage.sql.exec(INSERT_CHECKPOINT, state.room.roomId, state.revision, stateJson);
      const initializationRecovery = this.validateCheckpoint(state);
      this.writeRecoveryVerificationInTransaction(state, state.revision);
      return Object.freeze({ status: this.statusFor(state), recovery: initializationRecovery, inserted: true });
    });
    if (result.inserted && result.recovery !== null && this.versionIdentifier !== null) emitRecoveryFactV1(result.recovery.checkpointRevision, state.revision, result.recovery.replayCount, 'ok', this.versionIdentifier, state.room.roomId);
    return result.status;
  }

  /** Atomically initialize Room/security/checkpoint and advance its forming lobby. */
  initializeRoomAndTransitionLobby(
    roomId: string,
    state: OnlineProtocolStateV1,
    previousLobby: OnlineFormingLobbyV1,
    nextLobby: OnlineFormingLobbyV1,
    nowInput: unknown = Date.now(),
  ): OnlineCloudflareRoomStatusV1 {
    const stateJson = serializeOnlineCloudflareProtocolStateV1(state);
    const checkedPrevious = validateOnlineFormingLobbyV1(previousLobby);
    const checkedNext = validateOnlineFormingLobbyV1(nextLobby);
    if (
      state.room.roomId !== roomId ||
      state.revision !== 0 ||
      state.coreRoot.acceptedCommandCount !== 0 ||
      state.receipts.length !== 0 ||
      !checkedPrevious.ok ||
      !checkedNext.ok ||
      checkedPrevious.value.roomId !== roomId ||
      checkedNext.value.roomId !== roomId ||
      checkedPrevious.value.lifecycle !== 'ready' ||
      checkedNext.value.lifecycle !== 'started'
    ) throw new Error('Invalid atomic Room/lobby initialization input');
    const previousJson = JSON.stringify(checkedPrevious.value);
    const nextJson = JSON.stringify(checkedNext.value);
    if (previousJson === undefined || nextJson === undefined) throw new Error('Invalid forming lobby serialization');
    return this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_ROOM);
      this.storage.sql.exec(CREATE_JOURNAL);
      this.storage.sql.exec(CREATE_MIGRATION);
      this.storage.sql.exec(CREATE_CHECKPOINT);
      this.storage.sql.exec(CREATE_RECOVERY_VERIFICATION);
      this.storage.sql.exec(CREATE_DECK_HEAD);
      this.storage.sql.exec(CREATE_DECK_HISTORY);
      this.storage.sql.exec(CREATE_DECK_SNAPSHOT);
      this.storage.sql.exec(CREATE_LOBBY);
      this.storage.sql.exec(CREATE_ADMISSION);
      this.storage.sql.exec(CREATE_TABLE_CREDENTIALS);
      this.storage.sql.exec(CREATE_REVOKED);
      this.securityRepository.createSchemaInTransaction();
      const migrations = this.storage.sql.exec<MigrationRow>(SELECT_MIGRATION).toArray();
      if (migrations.length > 1 || (migrations[0] !== undefined && (migrations[0].singleton !== 1 || (migrations[0].schema_version !== ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1 && migrations[0].schema_version !== ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2)))) throw new Error('Invalid application migration ledger');
      if (migrations.length === 0) this.storage.sql.exec(INSERT_MIGRATION, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2);
      else if (migrations[0]?.schema_version === ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1) {
        const upgraded = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_MIGRATION, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1).toArray();
        if (upgraded.length !== 1 || upgraded[0]?.singleton !== 1) throw new Error('Application schema migration failed');
      }
      const existing = this.rows();
      if (existing.length > 1) throw new Error('Invalid singleton state');
      let effectiveState = state;
      if (existing.length === 0) {
        this.storage.sql.exec(INSERT_ROOM, 1, ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1, roomId, state.revision, state.room.lifecycle, state.coreRoot.acceptedCommandCount, stateJson);
        this.securityRepository.initializeInTransaction(roomId, state, nowInput);
        this.storage.sql.exec(INSERT_CHECKPOINT, roomId, state.revision, stateJson);
        this.writeRecoveryVerificationInTransaction(state, state.revision);
      } else {
        const current = this.loadWithoutMigration();
        if (current === null || current.room.roomId !== roomId || serializeOnlineCloudflareProtocolStateV1(current) !== stateJson) throw new ConflictError();
        effectiveState = current;
        const securityPresence = this.securityRepository.migrationPresence();
        if (securityPresence.state === 0 && securityPresence.grants === 0 && securityPresence.leases === 0 && securityPresence.audit === 0) this.securityRepository.initializeInTransaction(roomId, current, nowInput);
        else this.securityRepository.read(current);
        const checkpoints = this.storage.sql.exec<CheckpointRow>(SELECT_CHECKPOINT).toArray();
        if (checkpoints.length === 0) this.storage.sql.exec(INSERT_CHECKPOINT, roomId, current.revision, stateJson);
        else if (checkpoints.length !== 1 || checkpoints[0]?.room_id !== roomId || checkpoints[0]?.checkpoint_revision !== current.revision || checkpoints[0]?.state_json !== stateJson) throw new Error('Invalid recovery checkpoint');
      }
      const lobbyRows = this.storage.sql.exec<LobbyRow>(SELECT_LOBBY).toArray();
      if (lobbyRows.length !== 1 || lobbyRows[0]?.room_id !== roomId) throw new ConflictError();
      if (lobbyRows[0]?.state_json !== nextJson) {
        if (lobbyRows[0]?.state_json !== previousJson) throw new ConflictError();
        const updated = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_LOBBY, roomId, nextJson, roomId, previousJson).toArray();
        if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new ConflictError();
      }
      return this.statusFor(effectiveState);
    });
  }

  commitAccepted(state: OnlineProtocolStateV1, envelope: OnlineCommandEnvelopeV1): void {
    if (
      state.room.roomId !== envelope.roomId ||
      state.revision !== envelope.baseRevision + 1 ||
      state.coreRoot.acceptedCommandCount !== state.revision
    ) throw new Error('Accepted state does not follow the command base revision');
    const configuredCapabilities = [
      ...state.room.seats.map((seat) => seat.seatCapability),
      ...state.observerAuthorizations.map((authorization) => authorization.observerCapability),
    ];
    assertNoConfiguredCapabilityFragmentV1(envelope.commandId, configuredCapabilities);
    assertNoConfiguredCapabilityFragmentV1(envelope.participantId, configuredCapabilities);
    const commandJson = serializeAcceptedCoreCommandV1(envelope.command, configuredCapabilities);
    const stateJson = serializeOnlineCloudflareProtocolStateV1(state);
    this.storage.transactionSync(() => {
      this.storage.sql.exec(INSERT_JOURNAL, state.revision, envelope.commandId, envelope.participantId, envelope.baseRevision, commandJson);
      this.storage.sql.exec(UPDATE_ROOM, state.revision, state.room.lifecycle, state.coreRoot.acceptedCommandCount, stateJson, state.room.roomId, envelope.baseRevision);
      if (this.storage.sql.exec<RoomRow>(VERIFY_ROOM, 1, state.room.roomId, state.revision).toArray().length !== 1) {
        throw new Error('Room state compare-and-set failed');
      }
      if (state.revision % 64 === 0) {
        const checkpoints = this.storage.sql.exec<CheckpointRow>(SELECT_CHECKPOINT).toArray();
        const checkpoint = checkpoints[0];
        if (checkpoints.length !== 1 || checkpoint === undefined || checkpoint.room_id !== state.room.roomId || !isInteger(checkpoint.checkpoint_revision) || checkpoint.checkpoint_revision >= state.revision) throw new Error('Invalid checkpoint advancement source');
        const updated = this.storage.sql.exec<{ singleton: unknown }>(UPDATE_CHECKPOINT, state.room.roomId, state.revision, stateJson, checkpoint.room_id, checkpoint.checkpoint_revision).toArray();
        if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new Error('Checkpoint compare-and-set failed');
      }
      const checkpoints = this.storage.sql.exec<CheckpointRow>(SELECT_CHECKPOINT).toArray();
      const checkpoint = checkpoints[0];
      if (checkpoints.length !== 1 || checkpoint === undefined || checkpoint.room_id !== state.room.roomId || !isInteger(checkpoint.checkpoint_revision)) throw new Error('Invalid recovery checkpoint');
      this.writeRecoveryVerificationInTransaction(state, checkpoint.checkpoint_revision);
    });
  }

  persistSameRevision(previous: OnlineProtocolStateV1, next: OnlineProtocolStateV1): void {
    const previousJson = serializeOnlineCloudflareProtocolStateV1(previous);
    const nextJson = serializeOnlineCloudflareProtocolStateV1(next);
    if (
      previous.room.roomId !== next.room.roomId ||
      previous.revision !== next.revision ||
      comparablePresenceState(previousJson) !== comparablePresenceState(nextJson)
    ) throw new Error('Presence state changes outside the allowed boundary');
    const current = this.load();
    if (
      current === null ||
      current.room.roomId !== previous.room.roomId ||
      current.revision !== previous.revision ||
      serializeOnlineCloudflareProtocolStateV1(current) !== previousJson
    ) throw new ConflictError();
    this.storage.transactionSync(() => {
      const rows = this.rows();
      if (rows.length !== 1 || rows[0]?.state_json !== previousJson) throw new ConflictError();
      const updated = this.storage.sql.exec<{ singleton: unknown }>(
        UPDATE_PRESENCE,
        next.room.lifecycle,
        nextJson,
        next.room.roomId,
        next.revision,
        previousJson,
      ).toArray();
      if (updated.length !== 1 || updated[0]?.singleton !== 1) throw new Error('Presence compare-and-set failed');
      const verified = this.storage.sql.exec<{ singleton: unknown }>(
        VERIFY_PRESENCE,
        next.room.roomId,
        next.revision,
        next.room.lifecycle,
        nextJson,
      ).toArray();
      if (verified.length !== 1 || verified[0]?.singleton !== 1) throw new Error('Presence state verification failed');
    });
  }

}

export class ConflictError extends Error {}
