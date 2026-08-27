import {
  isCanonicalCoreObjectIdV2,
  validateModeNeutralCoreRootV1,
  type ModeNeutralCoreRootV1,
  type CoreObjectId,
} from '../../engine/core/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import { validateOnlineVariableRoomV2, type OnlineVariableRoomV2 } from '../room/variable';

export const ONLINE_PROTOCOL_SCHEMA_VERSION_V2 = 2 as const;
/** Private result retained with the accepted command receipt. */
export type OnlineVariableProtocolCompletionResultV2 = Readonly<{
  readonly kind: 'core-search-completion-result-v1';
  readonly sessionKey: string;
  readonly selectedObjectIds: readonly CoreObjectId[];
  readonly selectedCount: number;
  readonly revealFound: boolean;
}>;
export type OnlineVariableProtocolReceiptV2 = Readonly<{
  readonly participantId: string;
  readonly acceptedRevision: number;
  readonly commandId: string;
  readonly requestDigest: string;
  readonly status: 'accepted' | 'accepted-with-warning';
  readonly completion?: OnlineVariableProtocolCompletionResultV2;
}>;
export type OnlineVariableProtocolStateV2 = Readonly<{
  readonly kind: 'online-protocol-state-v2';
  readonly schemaVersion: typeof ONLINE_PROTOCOL_SCHEMA_VERSION_V2;
  readonly protocolVersion: number;
  readonly serverBuildId: string;
  readonly room: OnlineVariableRoomV2;
  readonly configuration: OnlineVariableRoomV2['configuration'];
  readonly coreRoot: ModeNeutralCoreRootV1;
  readonly observerAuthorizations: readonly Readonly<{ readonly participantId: string; readonly observerCapability: string }>[];
  readonly revision: number;
  readonly receipts: readonly OnlineVariableProtocolReceiptV2[];
}>;
export type CreateOnlineVariableProtocolStateV2Input = Readonly<{ readonly serverBuildId: string; readonly room: OnlineVariableRoomV2; readonly coreRoot: ModeNeutralCoreRootV1; readonly observerAuthorizations?: readonly Readonly<{ readonly participantId: string; readonly observerCapability: string }>[] }>;
export type OnlineVariableProtocolValidationResultV2 = Readonly<{ readonly ok: true; readonly value: OnlineVariableProtocolStateV2 } | { readonly ok: false; readonly issues: readonly Readonly<{ readonly code: string; readonly path: string; readonly message: string }>[] }>;

function fail(message: string): never { throw new Error(message); }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exact(value: unknown, fields: readonly string[]): value is Record<string, unknown> { if (!record(value)) return false; try { const keys = Reflect.ownKeys(value); return keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key)); } catch { return false; } }
function exactOptional(value: unknown, fields: readonly string[], optional: readonly string[]): value is Record<string, unknown> {
  if (!record(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return keys.every((key) => typeof key === 'string' && (fields.includes(key) || optional.includes(key)) && Object.prototype.propertyIsEnumerable.call(value, key))
      && fields.every((key) => Object.prototype.hasOwnProperty.call(value, key));
  } catch { return false; }
}
function outcomeForCore(
  entry: ModeNeutralCoreRootV1['playerLifecycle']['players'][number],
): 'pending' | 'conceded' | 'defeated' {
  if (entry.status === 'active') return 'pending';
  return entry.exitCause === 'concession' ? 'conceded' : 'defeated';
}

function validateInternal(input: unknown): OnlineVariableProtocolStateV2 {
  if (!exact(input, ['kind', 'schemaVersion', 'protocolVersion', 'serverBuildId', 'room', 'configuration', 'coreRoot', 'observerAuthorizations', 'revision', 'receipts'])) fail('Invalid variable protocol state');
  const roomResult = validateOnlineVariableRoomV2(input.room);
  const coreResult = validateModeNeutralCoreRootV1(input.coreRoot);
  if (input.kind !== 'online-protocol-state-v2' || input.schemaVersion !== 2 || typeof input.protocolVersion !== 'number' || !Number.isSafeInteger(input.protocolVersion) || typeof input.serverBuildId !== 'string' || !roomResult.ok || !coreResult.ok || JSON.stringify(input.configuration) !== JSON.stringify(roomResult.value.configuration) || typeof input.revision !== 'number' || !Number.isSafeInteger(input.revision) || input.revision < 0 || !Array.isArray(input.receipts)) fail('Invalid variable protocol state fields');
  const revision = input.revision;
  if (roomResult.value.configuration.playerCount !== roomResult.value.seats.length || roomResult.value.configuration.playerCount !== roomResult.value.participants.length) fail('Variable protocol roster mismatch');
  if (!Array.isArray(input.observerAuthorizations)) fail('Invalid variable observer authorizations');
  const coreRoot = coreResult.value;
  const corePlayers = coreRoot.playerLifecycle.players;
  if (corePlayers.length !== roomResult.value.seats.length || roomResult.value.seats.some((seat, index) => corePlayers[index]?.playerId !== seat.corePlayerId || outcomeForCore(corePlayers[index]) !== seat.outcome) || revision !== coreRoot.acceptedCommandCount) fail('Variable Room and Core state mismatch');
  const capabilities = new Set(roomResult.value.seats.map((seat) => seat.seatCapability));
  const participantIds = new Set(roomResult.value.participants.map((entry) => entry.participantId));
  const observers = (input.observerAuthorizations as readonly unknown[]).map((entry) => {
    if (!exact(entry, ['participantId', 'observerCapability']) || typeof entry.participantId !== 'string' || typeof entry.observerCapability !== 'string' || participantIds.has(entry.participantId) || capabilities.has(entry.observerCapability)) fail('Invalid variable observer authorization');
    participantIds.add(entry.participantId);
    capabilities.add(entry.observerCapability);
    return Object.freeze({ participantId: entry.participantId, observerCapability: entry.observerCapability });
  });
  const receiptKeys = new Set<string>();
  const receipts = Object.freeze((input.receipts as readonly unknown[]).map((entry) => {
    if (!exactOptional(entry, ['participantId', 'acceptedRevision', 'commandId', 'requestDigest', 'status'], ['completion']) || typeof entry.participantId !== 'string' || typeof entry.acceptedRevision !== 'number' || !Number.isSafeInteger(entry.acceptedRevision) || entry.acceptedRevision <= 0 || entry.acceptedRevision > revision || typeof entry.commandId !== 'string' || typeof entry.requestDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(entry.requestDigest) || (entry.status !== 'accepted' && entry.status !== 'accepted-with-warning') || !roomResult.value.participants.some((participant) => participant.role === 'player' && participant.participantId === entry.participantId)) fail('Invalid variable protocol receipt');
    const key = `${entry.participantId}\u0000${entry.commandId}`; if (receiptKeys.has(key)) fail('Duplicate variable protocol receipt'); receiptKeys.add(key);
    let completion: OnlineVariableProtocolCompletionResultV2 | undefined;
    if (entry.completion !== undefined) {
      if (!exact(entry.completion, ['kind', 'sessionKey', 'selectedObjectIds', 'selectedCount', 'revealFound']) || entry.completion.kind !== 'core-search-completion-result-v1' || typeof entry.completion.sessionKey !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(entry.completion.sessionKey) || !Array.isArray(entry.completion.selectedObjectIds) || Object.getPrototypeOf(entry.completion.selectedObjectIds) !== Array.prototype || typeof entry.completion.selectedCount !== 'number' || !Number.isSafeInteger(entry.completion.selectedCount) || entry.completion.selectedCount < 0 || typeof entry.completion.revealFound !== 'boolean') fail('Invalid variable protocol completion result');
      const selected: CoreObjectId[] = [];
      const seen = new Set<string>();
      for (const id of entry.completion.selectedObjectIds as readonly unknown[]) {
        if (!isCanonicalCoreObjectIdV2(id) || seen.has(id)) fail('Invalid variable protocol completion result');
        seen.add(id); selected.push(id);
      }
      if (entry.completion.selectedCount !== selected.length) fail('Invalid variable protocol completion result');
      completion = Object.freeze({ kind: 'core-search-completion-result-v1', sessionKey: entry.completion.sessionKey, selectedObjectIds: Object.freeze(selected), selectedCount: selected.length, revealFound: entry.completion.revealFound });
    }
    return Object.freeze({ participantId: entry.participantId, acceptedRevision: entry.acceptedRevision, commandId: entry.commandId, requestDigest: entry.requestDigest, status: entry.status, ...(completion === undefined ? {} : { completion }) });
  }));
  return Object.freeze({ kind: 'online-protocol-state-v2', schemaVersion: 2, protocolVersion: input.protocolVersion, serverBuildId: input.serverBuildId, room: roomResult.value, configuration: roomResult.value.configuration, coreRoot, observerAuthorizations: Object.freeze(observers), revision, receipts });
}
export function validateOnlineVariableProtocolStateV2(input: unknown): OnlineVariableProtocolValidationResultV2 { try { return Object.freeze({ ok: true as const, value: validateInternal(input) }); } catch (error: unknown) { return Object.freeze({ ok: false as const, issues: Object.freeze([{ code: 'INVALID_PROTOCOL_STATE', path: '', message: error instanceof Error ? error.message : 'Invalid variable protocol state' }]) }); } }
export function createOnlineVariableProtocolStateV2(input: CreateOnlineVariableProtocolStateV2Input): OnlineVariableProtocolStateV2 { if (!record(input)) fail('Invalid variable protocol input'); return validateInternal({ kind: 'online-protocol-state-v2', schemaVersion: 2, protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, serverBuildId: input.serverBuildId, room: input.room, configuration: input.room.configuration, coreRoot: input.coreRoot, observerAuthorizations: input.observerAuthorizations ?? [], revision: 0, receipts: [] }); }
export function protocolStateCapabilitiesV2(stateInput: unknown): readonly string[] { const state = validateInternal(stateInput); return Object.freeze(state.room.seats.map((seat) => seat.seatCapability)); }
export type OnlineProtocolStateV2 = OnlineVariableProtocolStateV2;
export const createOnlineProtocolStateV2 = createOnlineVariableProtocolStateV2;
export const validateOnlineProtocolStateV2 = validateOnlineVariableProtocolStateV2;
