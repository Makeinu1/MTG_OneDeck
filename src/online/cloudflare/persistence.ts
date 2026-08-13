import {
  validateOnlineCommandEnvelopeV1,
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
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
  type OnlineCloudflareRoomStatusV1,
  type OnlineCloudflareSqlStorage,
} from './types';

const CREATE_ROOM = `CREATE TABLE IF NOT EXISTS online_room_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, revision INTEGER NOT NULL, room_lifecycle TEXT NOT NULL, accepted_command_count INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT`;
const CREATE_JOURNAL = `CREATE TABLE IF NOT EXISTS online_accepted_command (accepted_revision INTEGER NOT NULL PRIMARY KEY, command_id TEXT NOT NULL UNIQUE, participant_id TEXT NOT NULL, base_revision INTEGER NOT NULL, command_json TEXT NOT NULL) STRICT`;
const SELECT_ROOM = `SELECT singleton, schema_version, room_id, revision, room_lifecycle, accepted_command_count, state_json FROM online_room_state WHERE singleton = 1`;
const SELECT_JOURNAL = `SELECT accepted_revision, command_id, participant_id, base_revision, command_json FROM online_accepted_command ORDER BY accepted_revision`;
const INSERT_ROOM = `INSERT INTO online_room_state (singleton, schema_version, room_id, revision, room_lifecycle, accepted_command_count, state_json) VALUES (?, ?, ?, ?, ?, ?, ?)`;
const INSERT_JOURNAL = `INSERT INTO online_accepted_command (accepted_revision, command_id, participant_id, base_revision, command_json) VALUES (?, ?, ?, ?, ?)`;
const UPDATE_ROOM = `UPDATE online_room_state SET revision = ?, room_lifecycle = ?, accepted_command_count = ?, state_json = ? WHERE singleton = 1 AND room_id = ? AND revision = ?`;
const VERIFY_ROOM = `SELECT singleton FROM online_room_state WHERE singleton = ? AND room_id = ? AND revision = ?`;

type RoomRow = { singleton: unknown; schema_version: unknown; room_id: unknown; revision: unknown; room_lifecycle: unknown; accepted_command_count: unknown; state_json: unknown };
type JournalRow = { accepted_revision: unknown; command_id: unknown; participant_id: unknown; base_revision: unknown; command_json: unknown };

function isInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }

export class OnlineCloudflareRepository {
  private readonly storage: OnlineCloudflareSqlStorage;
  constructor(storage: OnlineCloudflareSqlStorage) {
    this.storage = storage;
    storage.sql.exec(CREATE_ROOM);
    storage.sql.exec(CREATE_JOURNAL);
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

  status(): OnlineCloudflareRoomStatusV1 | null {
    const state = this.load();
    return state === null ? null : this.statusFor(state);
  }

  initialize(roomId: string, state: OnlineProtocolStateV1): OnlineCloudflareRoomStatusV1 {
    const stateJson = serializeOnlineCloudflareProtocolStateV1(state);
    if (
      state.room.roomId !== roomId ||
      state.revision !== 0 ||
      state.coreRoot.acceptedCommandCount !== 0 ||
      state.receipts.length !== 0
    ) throw new Error('Only an empty initial state may be imported');
    return this.storage.transactionSync(() => {
      const existing = this.rows();
      if (existing.length > 1) throw new Error('Invalid singleton state');
      if (existing.length === 1) {
        const current = this.load();
        if (current === null || current.room.roomId !== roomId || serializeOnlineCloudflareProtocolStateV1(current) !== stateJson) throw new ConflictError();
        return this.statusFor(current);
      }
      this.storage.sql.exec(INSERT_ROOM, 1, ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1, roomId, state.revision, state.room.lifecycle, state.coreRoot.acceptedCommandCount, stateJson);
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
    });
  }
}

export class ConflictError extends Error {}
