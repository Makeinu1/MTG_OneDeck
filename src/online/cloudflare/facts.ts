export type OnlineCloudflareStructuredFactV1 = Readonly<Record<string, string | number | boolean | null>>;

function emit(fact: OnlineCloudflareStructuredFactV1): void {
  try { console.log(JSON.stringify(fact)); } catch { /* logging is non-semantic */ }
}

const ACTIONS = new Set(['room', 'commands', 'capabilities', 'websocket', 'unknown']);
const METHODS = new Set(['GET', 'PUT', 'POST', 'OTHER']);
const OUTCOMES = new Set(['ok', 'error']);
const SOCKET_EVENTS = new Set(['accepted', 'authenticated', 'hibernation-message', 'close', 'error', 'reconnect']);
const ROLES = new Set(['player', 'table', 'spectator']);
const FAILURE_KINDS = new Set(['migration-failure', 'request-failure', 'recovery-failure']);
const FAILURE_CODES = new Set(['MIGRATION_FAILED', 'REQUEST_FAILED', 'RECOVERY_FAILED']);

function isId(value: string | null): boolean {
  return value === null || /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value);
}
function isVersion(value: string | null): boolean {
  return value === null || isCanonicalVersionIdentifier(value);
}
export function isCanonicalVersionIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
function isStatus(value: number): boolean { return Number.isSafeInteger(value) && value >= 100 && value <= 599; }
function isRevision(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }

export function emitWorkerRequestFactV1(action: string, methodClass: string, status: number, outcome: 'ok' | 'error', versionIdentifier: string | null, roomId: string | null = null): void {
  if (!isId(roomId) || !ACTIONS.has(action) || !METHODS.has(methodClass) || !isStatus(status) || !OUTCOMES.has(outcome) || !isVersion(versionIdentifier)) return;
  emit({ kind: 'worker-request', roomId, action, methodClass, status, outcome, versionIdentifier });
}

export function emitRuntimeStartFactV1(applicationSchemaVersion: number, migrationChangedStorage: boolean, roomPresent: boolean, versionIdentifier: string | null, roomId: string | null = null): void {
  if (!isId(roomId) || applicationSchemaVersion !== 1 || (migrationChangedStorage !== true && migrationChangedStorage !== false) || (roomPresent !== true && roomPresent !== false) || !isVersion(versionIdentifier)) return;
  emit({ kind: 'durable-object-runtime-start', roomId, applicationSchemaVersion, migrationChangedStorage, roomPresent, versionIdentifier });
}

export function emitRecoveryFactV1(checkpointRevision: number, currentRevision: number, replayCount: number, outcome: 'ok' | 'error', versionIdentifier: string | null, roomId: string | null = null): void {
  if (!isId(roomId) || !isRevision(checkpointRevision) || !isRevision(currentRevision) || !isRevision(replayCount) || replayCount > 63 || checkpointRevision > currentRevision || !OUTCOMES.has(outcome) || !isVersion(versionIdentifier)) return;
  emit({ kind: 'recovery-verification', roomId, checkpointRevision, currentRevision, replayCount, outcome, versionIdentifier });
}

export function emitWebSocketFactV1(event: 'accepted' | 'authenticated' | 'hibernation-message' | 'close' | 'error' | 'reconnect', roleClass: 'player' | 'table' | 'spectator' | null, outcome: 'ok' | 'error', versionIdentifier: string | null, roomId: string | null = null): void {
  if (!isId(roomId) || !SOCKET_EVENTS.has(event) || (roleClass !== null && !ROLES.has(roleClass)) || !OUTCOMES.has(outcome) || !isVersion(versionIdentifier)) return;
  emit({ kind: 'websocket-lifecycle', roomId, event, roleClass, outcome, versionIdentifier });
}

export function emitFailureFactV1(kind: 'migration-failure' | 'request-failure' | 'recovery-failure', code: string, versionIdentifier: string | null, roomId: string | null = null): void {
  if (!FAILURE_KINDS.has(kind) || !FAILURE_CODES.has(code) || !isId(roomId) || !isVersion(versionIdentifier)) return;
  emit({ kind, roomId, code, versionIdentifier });
}
