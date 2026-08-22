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
  type OnlineFormingLobbyV1,
} from '../lobby/index';
import {
  authorizeOnlineFormingLobbySeatV1,
} from '../lobby/index';
import {
  canonicalDeckSubmissionInputV2,
  contentDigestOfDeckSubmissionV2,
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

const CREATE_ROOM = `CREATE TABLE IF NOT EXISTS online_room_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, revision INTEGER NOT NULL, room_lifecycle TEXT NOT NULL, accepted_command_count INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT`;
const CREATE_JOURNAL = `CREATE TABLE IF NOT EXISTS online_accepted_command (accepted_revision INTEGER NOT NULL PRIMARY KEY, command_id TEXT NOT NULL UNIQUE, participant_id TEXT NOT NULL, base_revision INTEGER NOT NULL, command_json TEXT NOT NULL) STRICT`;
const CREATE_MIGRATION = `CREATE TABLE IF NOT EXISTS online_application_migration (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL) STRICT`;
const CREATE_CHECKPOINT = `CREATE TABLE IF NOT EXISTS online_recovery_checkpoint (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), room_id TEXT NOT NULL, checkpoint_revision INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT`;
const CREATE_RECOVERY_VERIFICATION = `CREATE TABLE IF NOT EXISTS online_recovery_verification (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), room_id TEXT NOT NULL, version_identifier TEXT NOT NULL, verified_revision INTEGER NOT NULL, checkpoint_revision INTEGER NOT NULL, journal_count INTEGER NOT NULL, checkpoint_digest TEXT NOT NULL) STRICT`;
const CREATE_LOBBY = `CREATE TABLE IF NOT EXISTS online_forming_lobby (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, state_json TEXT NOT NULL) STRICT`;
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
const INSERT_LOBBY = 'INSERT INTO online_forming_lobby (singleton, schema_version, room_id, state_json) VALUES (1, ?, ?, ?)';
const UPDATE_LOBBY = 'UPDATE online_forming_lobby SET room_id = ?, state_json = ? WHERE singleton = 1 AND room_id = ? AND state_json = ? RETURNING singleton';
const CREATE_DECK_HEAD = `CREATE TABLE IF NOT EXISTS online_deck_submission_head_v2 (room_id TEXT NOT NULL, seat_index INTEGER NOT NULL CHECK (seat_index BETWEEN 0 AND 3), participant_id TEXT NOT NULL, deck_id TEXT NOT NULL, submission_id TEXT NOT NULL, content_digest TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 0), state TEXT NOT NULL CHECK (state IN ('none', 'resolving', 'accepted', 'needs-attention')), snapshot_digest TEXT, PRIMARY KEY (room_id, seat_index)) STRICT`;
const CREATE_DECK_HISTORY = `CREATE TABLE IF NOT EXISTS online_deck_submission_history_v2 (room_id TEXT NOT NULL, seat_index INTEGER NOT NULL CHECK (seat_index BETWEEN 0 AND 3), submission_id TEXT NOT NULL, participant_id TEXT NOT NULL, deck_id TEXT NOT NULL, canonical_input TEXT NOT NULL, content_digest TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 0), state TEXT NOT NULL CHECK (state IN ('resolving', 'accepted', 'needs-attention')), issues_json TEXT NOT NULL, PRIMARY KEY (room_id, seat_index, submission_id)) STRICT`;
const CREATE_DECK_SNAPSHOT = `CREATE TABLE IF NOT EXISTS online_deck_submission_snapshot_v2 (room_id TEXT NOT NULL, seat_index INTEGER NOT NULL CHECK (seat_index BETWEEN 0 AND 3), snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64), snapshot_json TEXT NOT NULL, PRIMARY KEY (room_id, seat_index)) STRICT`;
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

type RoomRow = { singleton: unknown; schema_version: unknown; room_id: unknown; revision: unknown; room_lifecycle: unknown; accepted_command_count: unknown; state_json: unknown };
type JournalRow = { accepted_revision: unknown; command_id: unknown; participant_id: unknown; base_revision: unknown; command_json: unknown };
type MigrationRow = { singleton: unknown; schema_version: unknown };
type CheckpointRow = { singleton: unknown; room_id: unknown; checkpoint_revision: unknown; state_json: unknown };
type RecoveryVerificationRow = { singleton: unknown; room_id: unknown; version_identifier: unknown; verified_revision: unknown; checkpoint_revision: unknown; journal_count: unknown; checkpoint_digest: unknown };
type LobbyRow = { singleton: unknown; schema_version: unknown; room_id: unknown; state_json: unknown };
type DeckHeadRow = { room_id: unknown; seat_index: unknown; participant_id: unknown; deck_id: unknown; submission_id: unknown; content_digest: unknown; revision: unknown; state: unknown; snapshot_digest: unknown };
type DeckHistoryRow = DeckHeadRow & { canonical_input: unknown; issues_json: unknown };
type DeckSnapshotRow = { room_id: unknown; seat_index: unknown; snapshot_digest: unknown; snapshot_json: unknown };
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
      this.storage.sql.exec(CREATE_JOURNAL);
      this.storage.sql.exec(CREATE_MIGRATION);
      this.storage.sql.exec(CREATE_CHECKPOINT);
      this.storage.sql.exec(CREATE_RECOVERY_VERIFICATION);
      this.storage.sql.exec(CREATE_DECK_HEAD);
      this.storage.sql.exec(CREATE_DECK_HISTORY);
      this.storage.sql.exec(CREATE_DECK_SNAPSHOT);
      this.storage.sql.exec(CREATE_LOBBY);
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

  private ensureDeckSchema(): void {
    this.storage.sql.exec(CREATE_DECK_HEAD);
    this.storage.sql.exec(CREATE_DECK_HISTORY);
    this.storage.sql.exec(CREATE_DECK_SNAPSHOT);
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
    if (!exactOwnKeys(parsed, ['deckId', 'entries']) || parsed.deckId !== row.deck_id || !Array.isArray(parsed.entries) || parsed.entries.length === 0) throw new Error('Invalid v2 canonical input');
    if (JSON.stringify({ deckId: parsed.deckId, entries: parsed.entries }) !== row.canonical_input) throw new Error('Invalid v2 canonical input');
    parsed.entries.forEach((entry) => {
      if (!exactOwnKeys(entry, ['section', 'quantity', 'scryfallId', 'oracleId']) || (entry.section !== 'commander' && entry.section !== 'main') || typeof entry.quantity !== 'number' || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0 || !isCanonicalScryfallIdV2(entry.scryfallId) || !isCanonicalScryfallIdV2(entry.oracleId)) throw new Error('Invalid v2 canonical entry');
    });
    const issues = this.issuesFromHistory(row, parsed.entries.length);
    if ((row.state === 'accepted' || row.state === 'resolving') && issues.length !== 0) throw new Error('Invalid v2 terminal issue relation');
    if (row.state === 'needs-attention' && issues.length === 0) throw new Error('Missing v2 terminal issue');
    return parsed.entries.length;
  }

  private resultV2(roomId: string, submissionId: string, state: OnlineDeckSubmissionStateV2, issues: readonly OnlineDeckSubmissionIssueV2[], projection: OnlineFormingLobbyProjectionV2): OnlineDeckSubmissionResultV2 {
    return Object.freeze({ kind: 'online-forming-lobby-deck-result-v2', schemaVersion: 2, roomId, submissionId, state, issues: Object.freeze([...issues]), projection });
  }

  private validateDeckRelations(roomId: string, lobby: OnlineFormingLobbyV1): void {
    const headSeats = new Set<number>();
    for (const head of this.loadDeckHeadsV2(roomId)) {
      headSeats.add(head.seatIndex);
      const seat = lobby.seats[head.seatIndex];
      if (seat === undefined || seat.participantId !== head.participantId) throw new Error('Invalid v2 head participant relation');
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
    const heads = new Map(this.loadDeckHeadsV2(roomId).map((head) => [head.seatIndex, head.state]));
    const seats = lobby.seats.map((seat, index) => Object.freeze({ seatIndex: index as 0 | 1 | 2 | 3, corePlayerId: seat.corePlayerId, participantId: seat.participantId, deckState: heads.get(index as 0 | 1 | 2 | 3) ?? 'none', ready: seat.ready }));
    return Object.freeze({ kind: 'online-forming-lobby-projection-v2', schemaVersion: 2, lifecycle: lobby.lifecycle, roomId: lobby.roomId, serverBuildId: lobby.serverBuildId, hostParticipantId: lobby.hostParticipantId, seats: Object.freeze(seats) as OnlineFormingLobbyProjectionV2['seats'] });
  }

  async submitDeckV2(roomId: string, input: unknown, resolver: OnlineDeckResolverV2): Promise<OnlineDeckSubmissionResultV2> {
    const lobby = this.loadLobby(roomId);
    if (lobby === null) throw new Error('Missing forming lobby');
    if (!exactSubmissionEnvelope(input) || !isOnlineRoomApplicationIdV1(input.participantId) || !isOnlineRoomSeatCapabilityV1(input.seatCapability)) throw new Error('Seat authorization rejected');
    let authorizedSeatIndex: number;
    try { authorizedSeatIndex = authorizeOnlineFormingLobbySeatV1(lobby, input.participantId, input.seatCapability); }
    catch { throw new Error('Seat authorization rejected'); }
    if (lobby.lifecycle === 'started') throw new Error('Started lobby cannot accept deck submissions');
    if (input.kind !== 'online-forming-lobby-deck-submit-v2' || input.schemaVersion !== 2) throw new Error('Invalid v2 protocol envelope');
    if (!closedSubmissionShape(input)) throw new Error('Invalid deck submission shape');
    const forbidden = [roomId, lobby.roomId, lobby.hostParticipantId, ...lobby.seats.flatMap((seat) => [seat.seatCapability, ...(seat.inviteCapability === null ? [] : [seat.inviteCapability]), ...(seat.participantId === null ? [] : [seat.participantId])])];
    if (typeof input.deckId !== 'string' || typeof input.submissionId !== 'string') throw new Error('Invalid deck metadata');
    assertSafeOnlineDeckMetadataV2(input.deckId, forbidden);
    assertSafeOnlineDeckMetadataV2(input.submissionId, forbidden);
    const parsed = parseOnlineDeckSubmitV2(input);
    if (!parsed.ok) {
      const submissionId = isRecord(input) && isOnlineRoomApplicationIdV1(input.submissionId) ? input.submissionId : 'invalid';
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

  persistLobby(previous: OnlineFormingLobbyV1, next: OnlineFormingLobbyV1): void {
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
