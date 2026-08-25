import { projectOnlineVariableProtocolV3 } from '../projection/index';
import { validateOnlineParticipantProjectionV3 } from '../projection/index';
import type { CorePlayerId } from '../../engine/core/index';
import type { OnlinePregamePhaseV1, OnlinePregameProjectionPlayerV1, OnlinePregameProjectionV1, OnlinePregameStateV1 } from './types';

export function projectOnlinePregameV1(state: OnlinePregameStateV1, participantId: string): OnlinePregameProjectionV1 {
  const protocol = projectOnlineVariableProtocolV3(state.protocolState, participantId);
  return Object.freeze({
    kind: 'online-pregame-projection-v1',
    schemaVersion: 1,
    revision: state.revision,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    startingPlayerId: state.randomPlan.startingPlayerId,
    turnOrder: Object.freeze([...state.randomPlan.turnOrder]),
    players: Object.freeze(state.players.map((player) => Object.freeze({ playerId: player.playerId, commanderConfirmed: player.commanderConfirmed, mulliganDecision: player.mulliganDecision, mulligansTaken: player.mulligansTaken, bottomCountRequired: player.bottomCountRequired, pendingBottomCount: player.pendingBottomObjectIds.length, manualActionCount: player.manualActionCount, manualActionsComplete: player.manualActionsComplete, ready: player.ready }))),
    protocol,
  });
}

type Raw = Record<string, unknown>;
type ProjectionIssue = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;
type ProjectionResult = Readonly<{ readonly ok: true; readonly value: OnlinePregameProjectionV1 } | { readonly ok: false; readonly issues: readonly ProjectionIssue[] }>;
const PHASES: readonly OnlinePregamePhaseV1[] = ['commander-reveal', 'mulligan-declaration', 'mulligan-bottom', 'pregame-actions', 'ready', 'complete'];
const PLAYER_FIELDS = ['playerId', 'commanderConfirmed', 'mulliganDecision', 'mulligansTaken', 'bottomCountRequired', 'pendingBottomCount', 'manualActionCount', 'manualActionsComplete', 'ready'] as const;

function invalid(message: string, path = ''): ProjectionResult { return Object.freeze({ ok: false as const, issues: Object.freeze([{ code: 'INVALID_PROJECTION', path, message }]) }); }
function record(value: unknown, fields: readonly string[]): Raw | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || keys.some((key) => typeof key !== 'string' || !fields.includes(key))) return null;
    const output: Raw = Object.create(null) as Raw;
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return null;
      output[field] = descriptor.value as unknown;
    }
    return output;
  } catch { return null; }
}
function dense(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const lengthValue: unknown = lengthDescriptor.value as unknown;
    const length = lengthValue as number;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || !keys.includes('length')) return null;
    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return null;
      output.push(descriptor.value);
    }
    return Object.freeze(output);
  } catch { return null; }
}
function playerId(value: unknown): value is CorePlayerId { return typeof value === 'string' && /^P[1-4]$/u.test(value); }
function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function decision(value: unknown): value is OnlinePregameProjectionPlayerV1['mulliganDecision'] { return value === 'pending' || value === 'mulligan' || value === 'keep'; }

export function validateOnlinePregameProjectionV1(input: unknown): ProjectionResult {
  try {
    const raw = record(input, ['kind', 'schemaVersion', 'revision', 'phase', 'currentPlayerId', 'startingPlayerId', 'turnOrder', 'players', 'protocol']);
    if (raw === null) return invalid('Projection has unknown, missing, accessor, sparse, or symbol fields');
    if (raw.kind !== 'online-pregame-projection-v1' || raw.schemaVersion !== 1 || !integer(raw.revision) || typeof raw.phase !== 'string' || !PHASES.includes(raw.phase as OnlinePregamePhaseV1) || (raw.currentPlayerId !== null && !playerId(raw.currentPlayerId)) || !playerId(raw.startingPlayerId)) return invalid('Projection descriptor is invalid');
    const checkedProtocol = validateOnlineParticipantProjectionV3(raw.protocol);
    if (!checkedProtocol.ok) return Object.freeze({ ok: false as const, issues: checkedProtocol.issues });
    const protocol = checkedProtocol.value;
    const configuration = protocol.configuration;
    const seats = protocol.room.seats;
    const seated = seats.map((seat) => seat.corePlayerId);
    const turnOrder = dense(raw.turnOrder);
    const players = dense(raw.players);
    if (turnOrder === null || players === null || turnOrder.length !== seated.length || players.length !== seated.length) return invalid('Projection roster arrays are invalid');
    if (!turnOrder.every(playerId) || new Set(turnOrder).size !== turnOrder.length || turnOrder.some((id, index) => id !== protocol.game.turnOrder[index])) return invalid('Projection turn order must match embedded protocol order', '/turnOrder');
    if (raw.startingPlayerId !== turnOrder[0]) return invalid('Starting player must be the first turn-order player', '/startingPlayerId');
    if (raw.currentPlayerId !== null && !turnOrder.includes(raw.currentPlayerId)) return invalid('Current player is not in turn order', '/currentPlayerId');
    const normalizedPlayers: OnlinePregameProjectionPlayerV1[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < players.length; index += 1) {
      const row = record(players[index], PLAYER_FIELDS);
      const expectedPlayerId = seated[index];
      if (row === null || expectedPlayerId === undefined || row.playerId !== expectedPlayerId || seen.has(String(row.playerId)) || !playerId(row.playerId) || typeof row.commanderConfirmed !== 'boolean' || !decision(row.mulliganDecision) || !integer(row.mulligansTaken) || !integer(row.bottomCountRequired) || !integer(row.pendingBottomCount) || row.pendingBottomCount > row.bottomCountRequired || !integer(row.manualActionCount) || row.manualActionCount > 16 || typeof row.manualActionsComplete !== 'boolean' || typeof row.ready !== 'boolean') return invalid('Projection player record is invalid', `/players/${index}`);
      if (configuration.playerCount === 2 && row.bottomCountRequired !== 0 && row.bottomCountRequired !== row.mulligansTaken) return invalid('Projection two-player bottom relation is invalid', `/players/${index}`);
      if (configuration.playerCount === 4 && row.bottomCountRequired !== 0 && row.bottomCountRequired !== Math.max(0, row.mulligansTaken - 1)) return invalid('Projection four-player bottom relation is invalid', `/players/${index}`);
      seen.add(row.playerId);
      normalizedPlayers.push(Object.freeze({ playerId: row.playerId, commanderConfirmed: row.commanderConfirmed, mulliganDecision: row.mulliganDecision, mulligansTaken: row.mulligansTaken, bottomCountRequired: row.bottomCountRequired, pendingBottomCount: row.pendingBottomCount, manualActionCount: row.manualActionCount, manualActionsComplete: row.manualActionsComplete, ready: row.ready }));
    }
    if (seen.size !== seated.length || configuration.playerCount !== seated.length || protocol.game.turnOrder.length !== seated.length || ((raw.phase === 'ready' || raw.phase === 'complete') !== (raw.currentPlayerId === null))) return invalid('Projection lifecycle relation is invalid');
    const normalized = Object.freeze({ kind: 'online-pregame-projection-v1' as const, schemaVersion: 1 as const, revision: raw.revision, phase: raw.phase as OnlinePregamePhaseV1, currentPlayerId: raw.currentPlayerId, startingPlayerId: raw.startingPlayerId, turnOrder: Object.freeze(turnOrder.map((id) => id)), players: Object.freeze(normalizedPlayers), protocol });
    return Object.freeze({ ok: true as const, value: normalized });
  } catch { return invalid('Projection could not be inspected safely'); }
}

export { projectOnlineVariableProtocolV3 };
