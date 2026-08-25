import { describe, expect, it } from 'vitest';
import * as Core from '../../../engine/core/index';
import { buildVariableRoomGenesisV3 } from '../../genesis/index';
import * as Pregame from '../index';
import type { OnlineVariableProtocolStateV2 } from '../../protocol/index';

const card = (scryfallId: string, oracleId: string, name: string, typeLine: string) => ({ scryfallId, oracleId, name, lang: 'en' as const, layout: 'normal' as const, cmc: 2, colorIdentity: [], typeLine, faces: [{ name, typeLine, oracleText: '' }] });

function genesis(playerCount: 2 | 4): OnlineVariableProtocolStateV2 {
  const entries = Object.freeze([
    Object.freeze({ index: 0, section: 'commander' as const, quantity: 1, scryfallId: '00000000-0000-4000-8000-000000000011', oracleId: '00000000-0000-4000-8000-000000000111', definition: card('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000111', 'Commander', 'Legendary Creature') }),
    Object.freeze({ index: 1, section: 'main' as const, quantity: 20, scryfallId: '00000000-0000-4000-8000-000000000012', oracleId: '00000000-0000-4000-8000-000000000112', definition: card('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000112', 'Main', 'Artifact') }),
  ]);
  const serialized = JSON.stringify({ entries });
  const snapshot = Object.freeze({ entries, serialized, digest: Core.coreSha256HexV1(serialized) });
  const result = buildVariableRoomGenesisV3(Object.freeze({
    roomId: `online-pregame-${String(playerCount)}`, serverBuildId: 'online-pregame-test', configuration: { playerCount, startingLife: 40 as const },
    seats: Array.from({ length: playerCount }, (_, index) => Object.freeze({ seatIndex: index as 0 | 1 | 2 | 3, corePlayerId: `P${String(index + 1)}` as 'P1' | 'P2' | 'P3' | 'P4', participantId: `online-pregame-participant-${String(index + 1)}`, seatCapability: `seat_${String(index + 1).repeat(40)}`, snapshot })),
    tableParticipantId: 'online-pregame-table', tableCapability: `observer_${'T'.repeat(40)}`,
  }));
  if (!result.ok) throw new Error('Genesis fixture failed');
  return result.protocolState;
}

function plan(state: OnlineVariableProtocolStateV2, startingPlayerId: Core.CorePlayerId): Pregame.OnlinePregameRandomPlanV1 {
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const seats = registry.turnOrder;
  const start = seats.indexOf(startingPlayerId);
  const turnOrder = [...seats.slice(start), ...seats.slice(0, start)];
  const count = seats.length === 2 ? 8 : 9;
  return Object.freeze({ kind: 'online-pregame-random-plan-v1', schemaVersion: 1, decisionId: `online-pregame-plan-${String(seats.length)}`, startingPlayerId, turnOrder, libraryPlans: Object.freeze(seats.map((playerId, playerIndex) => {
    const ids = registry.zones.byPlayer[playerId].library.map((objectId) => registry.objects[objectId]).map((object) => { if (object?.kind !== 'card') throw new Error('Expected card object'); return object.physicalCardId; });
    return Object.freeze({ playerId, orders: Object.freeze(Array.from({ length: count }, (_, round) => { const offset = (round + playerIndex) % ids.length; return Object.freeze([...ids.slice(offset), ...ids.slice(0, offset)]); })) });
  })) });
}

function seat(state: Pregame.OnlinePregameStateV1, playerId: Core.CorePlayerId) {
  const value = state.protocolState.room.seats.find((candidate) => candidate.corePlayerId === playerId);
  if (value === undefined || value.participantId === null) throw new Error('Seat missing');
  const participantId = value.participantId;
  return { ...value, participantId };
}
function envelope(state: Pregame.OnlinePregameStateV1, playerId: Core.CorePlayerId, commandId: string, command: Pregame.OnlinePregameCommandV1, baseRevision = state.revision): Pregame.OnlinePregameCommandEnvelopeV1 {
  const current = seat(state, playerId);
  return { kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId: state.protocolState.room.roomId, participantId: current.participantId, participantCapability: current.seatCapability, commandId, baseRevision, command };
}
function accept(state: Pregame.OnlinePregameStateV1, playerId: Core.CorePlayerId, id: string, command: Pregame.OnlinePregameCommandV1): Pregame.OnlinePregameStateV1 {
  const transition = Pregame.handleOnlinePregameCommandEnvelopeV1(state, envelope(state, playerId, id, command));
  expect(transition.response).toMatchObject({ kind: 'online-pregame-command-ack-v1' });
  return transition.state;
}
function start(initial: OnlineVariableProtocolStateV2, startingPlayerId: Core.CorePlayerId) {
  const result = Pregame.createOnlinePregameLifecycleV1({ initialState: initial, randomPlan: plan(initial, startingPlayerId) });
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error('Pregame creation failed');
  return result.value;
}
describe('Online Pregame lifecycle ordinary coverage', () => {
  it('completes the two-player phase path, rejects stale/unauthorized mutation, replays, and preserves projection privacy', () => {
    const initial = genesis(2);
    let state = start(initial, 'P2' as Core.CorePlayerId);
    const first = Pregame.handleOnlinePregameCommandEnvelopeV1(state, envelope(state, 'P2' as Core.CorePlayerId, 'confirm-p2', { kind: 'confirm-commanders' }));
    expect(first.response).toMatchObject({ kind: 'online-pregame-command-ack-v1', acceptedRevision: 1 });
    const duplicate = Pregame.handleOnlinePregameCommandEnvelopeV1(first.state, envelope(first.state, 'P2' as Core.CorePlayerId, 'confirm-p2', { kind: 'confirm-commanders' }));
    expect(duplicate.state).toBe(first.state);
    const stale = Pregame.handleOnlinePregameCommandEnvelopeV1(first.state, envelope(first.state, 'P1' as Core.CorePlayerId, 'stale', { kind: 'confirm-commanders' }, 0));
    expect(stale.response).toMatchObject({ kind: 'online-pregame-command-reject-v1', issues: [{ code: 'STALE_REVISION', path: '/baseRevision' }] });
    state = accept(first.state, 'P1' as Core.CorePlayerId, 'confirm-p1', { kind: 'confirm-commanders' });
    state = accept(state, 'P2' as Core.CorePlayerId, 'mulligan-p2', { kind: 'declare-mulligan', decision: 'mulligan' });
    state = accept(state, 'P1' as Core.CorePlayerId, 'keep-p1', { kind: 'declare-mulligan', decision: 'keep' });
    const p2Hand = state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer['P2' as Core.CorePlayerId].hand;
    state = accept(state, 'P2' as Core.CorePlayerId, 'bottom-p2', { kind: 'submit-mulligan-bottom', objectIds: [p2Hand[0]] });
    state = accept(state, 'P2' as Core.CorePlayerId, 'keep-p2-after', { kind: 'declare-mulligan', decision: 'keep' });
    state = accept(state, 'P2' as Core.CorePlayerId, 'actions-p2', { kind: 'complete-pregame-actions' });
    state = accept(state, 'P1' as Core.CorePlayerId, 'actions-p1', { kind: 'complete-pregame-actions' });
    expect(state.phase).toBe('ready');
    state = accept(state, 'P1' as Core.CorePlayerId, 'ready-p1', { kind: 'set-ready', ready: true });
    state = accept(state, 'P2' as Core.CorePlayerId, 'ready-p2', { kind: 'set-ready', ready: true });
    expect(state.phase).toBe('complete');
    const projection = Pregame.projectOnlinePregameV1(state, seat(state, 'P1' as Core.CorePlayerId).participantId);
    expect(Pregame.validateOnlinePregameProjectionV1(projection)).toMatchObject({ ok: true });
    expect(JSON.stringify(projection)).not.toMatch(/randomPlan|libraryPlans|pendingBottomObjectIds|journal|seatCapability|coreRoot/u);
    const replay = Pregame.replayOnlinePregameLifecycleV1(initial, state.randomPlan, state.journal);
    expect(replay).toMatchObject({ ok: true });
    if (replay.ok) expect(replay.value).toEqual(state);
  });

  it('runs the four-player free-mulligan and paid-bottom branch', () => {
    let state = start(genesis(4), 'P3' as Core.CorePlayerId);
    for (const playerId of state.randomPlan.turnOrder) state = accept(state, playerId, `confirm-${playerId}`, { kind: 'confirm-commanders' });
    for (const playerId of state.randomPlan.turnOrder) state = accept(state, playerId, `free-${playerId}`, { kind: 'declare-mulligan', decision: playerId === 'P3' || playerId === 'P4' ? 'mulligan' : 'keep' });
    expect(state.phase).toBe('mulligan-declaration');
    state = accept(state, 'P3' as Core.CorePlayerId, 'paid-p3', { kind: 'declare-mulligan', decision: 'mulligan' });
    state = accept(state, 'P4' as Core.CorePlayerId, 'paid-p4', { kind: 'declare-mulligan', decision: 'mulligan' });
    const p3 = state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer['P3' as Core.CorePlayerId].hand[0];
    const p4 = state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer['P4' as Core.CorePlayerId].hand[0];
    state = accept(state, 'P3' as Core.CorePlayerId, 'bottom-p3', { kind: 'submit-mulligan-bottom', objectIds: [p3] });
    state = accept(state, 'P4' as Core.CorePlayerId, 'bottom-p4', { kind: 'submit-mulligan-bottom', objectIds: [p4] });
    expect(state.phase).toBe('mulligan-declaration');
    expect(state.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players['P3' as Core.CorePlayerId]?.mulliganCount).toBe(2);
  });
});
