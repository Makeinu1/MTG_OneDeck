import {
  handleOnlineCommandEnvelopeV1,
  validateOnlineCommandEnvelopeV1,
  validateOnlineProtocolStateV1,
  type OnlineCommandEnvelopeV1,
  type OnlineProtocolStateV1,
} from '../protocol/index';
import {
  assertNoConfiguredCapabilityFragmentV1,
  deserializeOnlineCloudflareProtocolStateV1,
  serializeAcceptedCoreCommandV1,
  serializeOnlineCloudflareProtocolStateV1,
} from './codec';
import {
  ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1,
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
  type OnlineCloudflareRoomStatusV1,
  type OnlineCloudflareSqlStorage,
} from './types';
import { OnlineCloudflareSecurityRepository } from './security';
import { emitRecoveryFactV1, emitFailureFactV1, isCanonicalVersionIdentifier } from './facts';

const CREATE_ROOM = `CREATE TABLE IF NOT EXISTS online_room_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, revision INTEGER NOT NULL, room_lifecycle TEXT NOT NULL, accepted_command_count INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT`;
const CREATE_JOURNAL = `CREATE TABLE IF NOT EXISTS online_accepted_command (accepted_revision INTEGER NOT NULL PRIMARY KEY, command_id TEXT NOT NULL UNIQUE, participant_id TEXT NOT NULL, base_revision INTEGER NOT NULL, command_json TEXT NOT NULL) STRICT`;
const CREATE_MIGRATION = `CREATE TABLE IF NOT EXISTS online_application_migration (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL) STRICT`;
const CREATE_CHECKPOINT = `CREATE TABLE IF NOT EXISTS online_recovery_checkpoint (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), room_id TEXT NOT NULL, checkpoint_revision INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT`;
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
const SELECT_CHECKPOINT = 'SELECT singleton, room_id, checkpoint_revision, state_json FROM online_recovery_checkpoint WHERE singleton = 1';
const INSERT_CHECKPOINT = 'INSERT INTO online_recovery_checkpoint (singleton, room_id, checkpoint_revision, state_json) VALUES (1, ?, ?, ?)';
const UPDATE_CHECKPOINT = 'UPDATE online_recovery_checkpoint SET room_id = ?, checkpoint_revision = ?, state_json = ? WHERE singleton = 1 AND room_id = ? AND checkpoint_revision = ? RETURNING singleton';

type RoomRow = { singleton: unknown; schema_version: unknown; room_id: unknown; revision: unknown; room_lifecycle: unknown; accepted_command_count: unknown; state_json: unknown };
type JournalRow = { accepted_revision: unknown; command_id: unknown; participant_id: unknown; base_revision: unknown; command_json: unknown };
type MigrationRow = { singleton: unknown; schema_version: unknown };
type CheckpointRow = { singleton: unknown; room_id: unknown; checkpoint_revision: unknown; state_json: unknown };

function isInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
    return this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_ROOM);
      this.storage.sql.exec(CREATE_JOURNAL);
      this.storage.sql.exec(CREATE_MIGRATION);
      this.storage.sql.exec(CREATE_CHECKPOINT);
      const before = this.storage.sql.exec<MigrationRow>(SELECT_MIGRATION).toArray();
      if (before.length > 1 || (before[0] !== undefined && (before[0].singleton !== 1 || before[0].schema_version !== ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1))) throw new Error('Invalid application migration ledger');
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
        else this.validateCheckpoint(state);
      }
      if (before.length === 0) this.storage.sql.exec(INSERT_MIGRATION, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1);
      return before.length === 0;
    });
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

  private validateCheckpoint(state: OnlineProtocolStateV1): Readonly<{ readonly checkpointRevision: number; readonly replayCount: number }> {
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
      const recovery = this.validateCheckpoint(state);
      emitRecoveryFactV1(recovery.checkpointRevision, state.revision, recovery.replayCount, 'ok', this.versionIdentifier, state.room.roomId);
      return state;
    } catch (error: unknown) {
      emitFailureFactV1('recovery-failure', 'RECOVERY_FAILED', this.versionIdentifier, state?.room.roomId ?? null);
      throw error;
    }
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
    return this.storage.transactionSync(() => {
      this.storage.sql.exec(CREATE_ROOM);
      this.storage.sql.exec(CREATE_JOURNAL);
      this.storage.sql.exec(CREATE_MIGRATION);
      this.storage.sql.exec(CREATE_CHECKPOINT);
      this.securityRepository.createSchemaInTransaction();
      const migrations = this.storage.sql.exec<MigrationRow>(SELECT_MIGRATION).toArray();
      if (migrations.length === 0) this.storage.sql.exec(INSERT_MIGRATION, ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1);
      const existing = this.rows();
      if (existing.length > 1) throw new Error('Invalid singleton state');
      if (existing.length === 1) {
        const current = this.load();
        if (current === null || current.room.roomId !== roomId || serializeOnlineCloudflareProtocolStateV1(current) !== stateJson) throw new ConflictError();
        this.securityRepository.read(current);
        return this.statusFor(current);
      }
      this.storage.sql.exec(INSERT_ROOM, 1, ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1, roomId, state.revision, state.room.lifecycle, state.coreRoot.acceptedCommandCount, stateJson);
      this.securityRepository.initializeInTransaction(roomId, state, nowInput);
      this.storage.sql.exec(INSERT_CHECKPOINT, state.room.roomId, state.revision, stateJson);
      return this.statusFor(state);
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
