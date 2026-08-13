import type { OnlineCloudflareSqlStorage } from '../types';

type Row = Record<string, unknown>;

type RoomRow = {
  singleton: number;
  schema_version: number;
  room_id: string;
  revision: number;
  room_lifecycle: string;
  accepted_command_count: number;
  state_json: string;
};

type JournalRow = {
  accepted_revision: number;
  command_id: string;
  participant_id: string;
  base_revision: number;
  command_json: string;
};

type SecurityStateRow = {
  singleton: number;
  schema_version: number;
  room_id: string;
  last_observed_at: number;
  next_connection_id: number;
  dropped_audit_count: number;
  grant_count: number;
};

type GrantRow = Record<string, unknown>;
type LeaseRow = Record<string, unknown>;
type AuditRow = Record<string, unknown>;

function cursor<T extends Row>(rows: readonly T[]): { toArray(): T[] } {
  return { toArray: () => rows.map((row) => ({ ...row })) };
}

function stringBinding(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return '';
}

export class SecuritySqlFixture implements OnlineCloudflareSqlStorage {
  room: RoomRow | null = null;
  journal: JournalRow[] = [];
  security: SecurityStateRow | null = null;
  grants: GrantRow[] = [];
  leases: LeaseRow[] = [];
  audit: AuditRow[] = [];
  securityTables = new Set<string>();
  readonly queries: Array<Readonly<{ readonly query: string; readonly bindings: readonly unknown[] }>> = [];
  writeCount = 0;
  transactionCount = 0;
  failRoomReads = false;
  failNextRoomUpdate = false;
  failNextPresenceUpdate = false;
  leaseDeleteReturningOverride: readonly Row[] | null = null;

  readonly sql = {
    exec: <T extends Row>(query: string, ...bindings: readonly unknown[]) => this.execute<T>(query, bindings),
  };

  transactionSync<T>(callback: () => T): T {
    this.transactionCount += 1;
    const room = this.room === null ? null : { ...this.room };
    const journal = this.journal.map((row) => ({ ...row }));
    const security = this.security === null ? null : { ...this.security };
    const grants = this.grants.map((row) => ({ ...row }));
    const leases = this.leases.map((row) => ({ ...row }));
    const audit = this.audit.map((row) => ({ ...row }));
    const securityTables = new Set(this.securityTables);
    const writes = this.writeCount;
    const leaseDeleteReturningOverride = this.leaseDeleteReturningOverride;
    try {
      return callback();
    } catch (error: unknown) {
      this.room = room;
      this.journal = journal;
      this.security = security;
      this.grants = grants;
      this.leases = leases;
      this.audit = audit;
      this.securityTables = securityTables;
      this.writeCount = writes;
      this.leaseDeleteReturningOverride = leaseDeleteReturningOverride;
      throw error;
    }
  }

  protected execute<T extends Row>(query: string, bindings: readonly unknown[]): { toArray(): T[] } {
    this.queries.push(Object.freeze({ query, bindings: Object.freeze([...bindings]) }));
    if (query.startsWith('CREATE TABLE online_security_state')) {
      if (this.securityTables.has('online_security_state')) throw new Error('duplicate security table');
      this.securityTables.add('online_security_state');
      return cursor<T>([]);
    }
    if (query.startsWith('CREATE TABLE online_capability_grant')) {
      if (this.securityTables.has('online_capability_grant')) throw new Error('duplicate security table');
      this.securityTables.add('online_capability_grant');
      return cursor<T>([]);
    }
    if (query.startsWith('CREATE TABLE online_controller_lease')) {
      if (this.securityTables.has('online_controller_lease')) throw new Error('duplicate security table');
      this.securityTables.add('online_controller_lease');
      return cursor<T>([]);
    }
    if (query.startsWith('CREATE TABLE online_security_audit')) {
      if (this.securityTables.has('online_security_audit')) throw new Error('duplicate security table');
      this.securityTables.add('online_security_audit');
      return cursor<T>([]);
    }
    if (query.startsWith('CREATE TABLE')) return cursor<T>([]);
    if (query.startsWith('SELECT singleton FROM online_room_state WHERE singleton = ?')) {
      const matched = this.room !== null && this.room.singleton === Number(bindings[0]) && this.room.room_id === String(bindings[1]) && this.room.revision === Number(bindings[2]);
      return cursor<T>(matched ? [{ singleton: 1 } as unknown as T] : []);
    }
    if (query.startsWith('SELECT singleton FROM online_room_state WHERE singleton = 1')) {
      const matched = this.room !== null && this.room.room_id === String(bindings[0]) && this.room.revision === Number(bindings[1]) && this.room.room_lifecycle === String(bindings[2]) && this.room.state_json === String(bindings[3]);
      return cursor<T>(matched ? [{ singleton: 1 } as unknown as T] : []);
    }
    if (query.startsWith('SELECT') && query.includes('FROM online_room_state')) {
      if (this.failRoomReads) throw new Error('hostile room read');
      return cursor<T>(this.room === null ? [] : [this.room] as unknown as readonly T[]);
    }
    if (query.startsWith('SELECT') && query.includes('FROM online_accepted_command')) return cursor<T>(this.journal as unknown as readonly T[]);
    if (query.startsWith('SELECT') && query.includes('FROM online_security_state')) {
      if (!this.securityTables.has('online_security_state')) throw new Error('missing security table');
      return cursor<T>(this.security === null ? [] : [this.security] as unknown as readonly T[]);
    }
    if (query.startsWith('SELECT') && query.includes('FROM online_capability_grant')) {
      if (!this.securityTables.has('online_capability_grant')) throw new Error('missing security table');
      return cursor<T>(this.grants as unknown as readonly T[]);
    }
    if (query.startsWith('SELECT') && query.includes('FROM online_controller_lease')) {
      if (!this.securityTables.has('online_controller_lease')) throw new Error('missing security table');
      return cursor<T>(this.leases as unknown as readonly T[]);
    }
    if (query.startsWith('SELECT') && query.includes('FROM online_security_audit')) {
      if (!this.securityTables.has('online_security_audit')) throw new Error('missing security table');
      return cursor<T>(this.audit as unknown as readonly T[]);
    }

    if (query.startsWith('INSERT INTO online_room_state')) {
      if (this.room !== null) throw new Error('duplicate room');
      this.room = {
        singleton: Number(bindings[0]), schema_version: Number(bindings[1]), room_id: String(bindings[2]), revision: Number(bindings[3]), room_lifecycle: String(bindings[4]), accepted_command_count: Number(bindings[5]), state_json: String(bindings[6]),
      };
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('INSERT INTO online_accepted_command')) {
      this.journal.push({ accepted_revision: Number(bindings[0]), command_id: String(bindings[1]), participant_id: String(bindings[2]), base_revision: Number(bindings[3]), command_json: String(bindings[4]) });
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('UPDATE online_room_state SET revision')) {
      if (this.failNextRoomUpdate) {
        this.failNextRoomUpdate = false;
        throw new Error('forced room update failure');
      }
      if (this.room === null || this.room.room_id !== String(bindings[4]) || this.room.revision !== Number(bindings[5])) throw new Error('room CAS');
      this.room = { ...this.room, revision: Number(bindings[0]), room_lifecycle: String(bindings[1]), accepted_command_count: Number(bindings[2]), state_json: String(bindings[3]) };
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('UPDATE online_room_state SET room_lifecycle')) {
      const matched = this.room !== null && this.room.room_id === String(bindings[2]) && this.room.revision === Number(bindings[3]) && this.room.state_json === String(bindings[4]);
      if (!matched || this.room === null) return cursor<T>([]);
      this.room = { ...this.room, room_lifecycle: String(bindings[0]), state_json: String(bindings[1]) };
      this.writeCount += 1;
      if (this.failNextPresenceUpdate) {
        this.failNextPresenceUpdate = false;
        throw new Error('forced presence update failure');
      }
      return cursor<T>([{ singleton: 1 } as unknown as T]);
    }
    if (query.startsWith('INSERT INTO online_security_state')) {
      if (this.security !== null) throw new Error('duplicate security singleton');
      this.security = { singleton: Number(bindings[0]), schema_version: Number(bindings[1]), room_id: String(bindings[2]), last_observed_at: Number(bindings[3]), next_connection_id: Number(bindings[4]), dropped_audit_count: Number(bindings[5]), grant_count: Number(bindings[6]) };
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('INSERT INTO online_capability_grant')) {
      this.grants.push({ room_id: String(bindings[0]), participant_id: String(bindings[1]), authority: String(bindings[2]), current_token: String(bindings[3]), generation: Number(bindings[4]), issued_at: Number(bindings[5]), expires_at: Number(bindings[6]), http_window_started_at: Number(bindings[7]), http_count: Number(bindings[8]), rotation_window_started_at: Number(bindings[9]), rotation_count: Number(bindings[10]), retired_tokens_json: String(bindings[11]) });
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('UPDATE online_security_state')) {
      if (this.security === null || this.security.room_id !== String(bindings[3]) || this.security.last_observed_at !== Number(bindings[4]) || this.security.next_connection_id !== Number(bindings[5]) || this.security.dropped_audit_count !== Number(bindings[6]) || this.security.grant_count !== Number(bindings[7])) return cursor<T>([]);
      this.security = { ...this.security, last_observed_at: Number(bindings[0]), next_connection_id: Number(bindings[1]), dropped_audit_count: Number(bindings[2]) };
      this.writeCount += 1;
      return cursor<T>([{ singleton: 1 } as unknown as T]);
    }
    if (query.startsWith('UPDATE online_capability_grant SET current_token')) {
      const index = this.grants.findIndex((grant) => grant.room_id === String(bindings[9]) && grant.participant_id === String(bindings[10]) && grant.current_token === String(bindings[11]) && grant.generation === Number(bindings[12]) && grant.issued_at === Number(bindings[13]) && grant.expires_at === Number(bindings[14]) && grant.http_window_started_at === Number(bindings[15]) && grant.http_count === Number(bindings[16]) && grant.rotation_window_started_at === Number(bindings[17]) && grant.rotation_count === Number(bindings[18]) && grant.retired_tokens_json === String(bindings[19]));
      if (index < 0) return cursor<T>([]);
      const previous = this.grants[index];
      if (previous === undefined) return cursor<T>([]);
      this.grants[index] = { ...previous, current_token: String(bindings[0]), generation: Number(bindings[1]), issued_at: Number(bindings[2]), expires_at: Number(bindings[3]), http_window_started_at: Number(bindings[4]), http_count: Number(bindings[5]), rotation_window_started_at: Number(bindings[6]), rotation_count: Number(bindings[7]), retired_tokens_json: String(bindings[8]) };
      this.writeCount += 1;
      return cursor<T>([{ participant_id: this.grants[index]?.participant_id } as unknown as T]);
    }
    if (query.startsWith('UPDATE online_capability_grant SET http_window_started_at')) {
      const index = this.grants.findIndex((grant) => grant.room_id === String(bindings[4]) && grant.participant_id === String(bindings[5]) && grant.current_token === String(bindings[6]) && grant.generation === Number(bindings[7]) && grant.issued_at === Number(bindings[8]) && grant.expires_at === Number(bindings[9]) && grant.http_window_started_at === Number(bindings[10]) && grant.http_count === Number(bindings[11]) && grant.rotation_window_started_at === Number(bindings[12]) && grant.rotation_count === Number(bindings[13]) && grant.retired_tokens_json === String(bindings[14]));
      if (index < 0) return cursor<T>([]);
      const previous = this.grants[index];
      if (previous === undefined) return cursor<T>([]);
      this.grants[index] = { ...previous, http_window_started_at: Number(bindings[0]), http_count: Number(bindings[1]), rotation_window_started_at: Number(bindings[2]), rotation_count: Number(bindings[3]) };
      this.writeCount += 1;
      return cursor<T>([{ participant_id: this.grants[index]?.participant_id } as unknown as T]);
    }
    if (query.startsWith('INSERT INTO online_controller_lease')) {
      this.leases.push({ room_id: String(bindings[0]), participant_id: String(bindings[1]), capability_generation: Number(bindings[2]), holder_kind: String(bindings[3]), connection_id: bindings[4] === null ? null : Number(bindings[4]), expires_at: Number(bindings[5]) });
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('UPDATE online_controller_lease')) {
      const index = this.leases.findIndex((lease) => lease.room_id === String(bindings[4]) && lease.participant_id === String(bindings[5]) && lease.capability_generation === Number(bindings[6]) && lease.holder_kind === String(bindings[7]) && lease.connection_id === (bindings[8] === null ? null : Number(bindings[8])) && lease.expires_at === Number(bindings[10]));
      if (index < 0) return cursor<T>([]);
      const previous = this.leases[index];
      if (previous === undefined) return cursor<T>([]);
      this.leases[index] = { ...previous, capability_generation: Number(bindings[0]), holder_kind: String(bindings[1]), connection_id: bindings[2] === null ? null : Number(bindings[2]), expires_at: Number(bindings[3]) };
      this.writeCount += 1;
      return cursor<T>([{ participant_id: this.leases[index]?.participant_id } as unknown as T]);
    }
    if (query.startsWith('DELETE FROM online_controller_lease WHERE room_id = ? AND participant_id = ? AND')) {
      const before = this.leases.length;
      const deleted = this.leases.filter((lease) => lease.room_id === String(bindings[0]) && lease.participant_id === String(bindings[1]) && lease.capability_generation === Number(bindings[2]) && lease.holder_kind === String(bindings[3]) && lease.connection_id === (bindings[5] === null ? null : Number(bindings[5])) && lease.expires_at === Number(bindings[6]));
      this.leases = this.leases.filter((lease) => !(lease.room_id === String(bindings[0]) && lease.participant_id === String(bindings[1]) && lease.capability_generation === Number(bindings[2]) && lease.holder_kind === String(bindings[3]) && lease.connection_id === (bindings[4] === null ? null : Number(bindings[4])) && lease.expires_at === Number(bindings[6])));
      if (this.leases.length !== before) this.writeCount += 1;
      const returning = this.leaseDeleteReturningOverride;
      this.leaseDeleteReturningOverride = null;
      return cursor<T>((returning ?? deleted.map((lease) => ({ participant_id: lease.participant_id }))) as T[]);
    }
    if (query.startsWith('INSERT INTO online_security_audit')) {
      this.audit.push({ audit_id: Number(bindings[0]), room_id: stringBinding(bindings[1]), participant_id: bindings[2] === null ? null : stringBinding(bindings[2]), connection_id: bindings[3] === null ? null : Number(bindings[3]), authority: bindings[4] === null ? null : stringBinding(bindings[4]), generation: bindings[5] === null ? null : Number(bindings[5]), event_code: stringBinding(bindings[6]), outcome: stringBinding(bindings[7]), observed_at: Number(bindings[8]) });
      this.writeCount += 1;
      return cursor<T>([]);
    }
    throw new Error(`Unexpected SQL in security fixture: ${query}`);
  }
}
