import { describe, expect, it } from 'vitest';
import * as Core from '../../../engine/core/index';
import type { CardDef } from '../../../types/card';
import { buildVariableRoomGenesisV3 } from '../../genesis/index';
import {
  activateOnlineVariableRoomV2,
  acceptOnlineVariableRoomDeckV2,
  createOnlineVariableRoomV2,
  joinOnlineVariableRoomV2,
  setOnlineVariableRoomPlayerReadyV2,
  startOnlineVariableRoomV2,
} from '../../room/index';
import { makeCoreRoot } from '../../room/__tests__/testHelpers';
import {
  createOnlineVariableProtocolStateV2,
  handleOnlineVariableCommandEnvelopeV2,
  handleOnlineVariableManualCombatDamageIntentV2,
  handleOnlineVariableSharedUndoIntentV2,
  validateOnlineSharedUndoIntentV1,
  type OnlineCommandEnvelopeV1,
  type OnlineSharedUndoIntentV1,
  type OnlineManualCombatDamageIntentV1,
  type OnlineVariableProtocolStateV2,
} from '../index';

const CAPS = ['seat_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'seat_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'seat_cccccccccccccccccccccccccccccccc', 'seat_dddddddddddddddddddddddddddddddd'] as const;
const PARTICIPANTS = ['host', 'player-2', 'player-3', 'player-4'] as const;

function stateFixture(): OnlineVariableProtocolStateV2 {
  let room = createOnlineVariableRoomV2({
    roomId: 'shared-undo-room', configuration: { playerCount: 4, startingLife: 40 },
    seatAssignments: CAPS.map((seatCapability, seatIndex) => ({ seatIndex: seatIndex as 0 | 1 | 2 | 3, corePlayerId: `P${seatIndex + 1}` as Core.CorePlayerId, seatCapability })),
    host: { participantId: PARTICIPANTS[0], seatCapability: CAPS[0] },
  });
  for (let index = 1; index < 4; index += 1) room = joinOnlineVariableRoomV2(room, { participantId: PARTICIPANTS[index], seatCapability: CAPS[index] });
  for (const participantId of PARTICIPANTS) {
    room = acceptOnlineVariableRoomDeckV2(room, participantId, true);
    room = setOnlineVariableRoomPlayerReadyV2(room, participantId, true);
  }
  room = startOnlineVariableRoomV2(room, PARTICIPANTS[0]);
  const coreRoot = makeCoreRoot();
  room = activateOnlineVariableRoomV2(room, coreRoot);
  return createOnlineVariableProtocolStateV2({ serverBuildId: 'shared-undo-build', room, coreRoot });
}

function twoPlayerStateFixture(): OnlineVariableProtocolStateV2 {
  const definition: CardDef = { scryfallId: '5da14d86-0780-4821-a799-96f64b377df4', oracleId: 'd8ad23a1-0b43-48ea-9fbe-d89b29194509', name: 'Undo Fixture Card', lang: 'en', layout: 'normal', cmc: 1, colorIdentity: [], typeLine: 'Creature', faces: [{ name: 'Undo Fixture Card', typeLine: 'Creature' }] };
  const entries = [{ section: 'main' as const, quantity: 40, scryfallId: definition.scryfallId, oracleId: definition.oracleId, index: 0, definition }];
  const serialized = JSON.stringify({ entries });
  const digest = Core.coreSha256HexV1(serialized);
  const result = buildVariableRoomGenesisV3({
    roomId: 'shared-undo-two-player', serverBuildId: 'shared-undo-build', configuration: { playerCount: 2, startingLife: 40 },
    seats: [0, 1].map((index) => ({ seatIndex: index as 0 | 1, corePlayerId: `P${index + 1}` as 'P1' | 'P2', participantId: `two-player-${index + 1}`, seatCapability: `two-seat_${String(index + 1).repeat(40)}`, snapshot: { entries, serialized, digest } })),
  });
  if (!result.ok) throw new Error('Expected two-player fixture');
  return result.protocolState;
}

function envelope(
  state: OnlineVariableProtocolStateV2,
  seatIndex: number,
  payload: Core.CoreCommandV1['payload'],
  commandId: string,
): OnlineCommandEnvelopeV1 {
  const participantId = state.room.seats[seatIndex]?.participantId ?? '';
  const participantCapability = state.room.seats[seatIndex]?.seatCapability ?? '';
  const playerId = `P${seatIndex + 1}` as Core.CorePlayerId;
  return {
    kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion,
    roomId: state.room.roomId as never, participantId: participantId as never, participantCapability: participantCapability as never,
    commandId: commandId as never, baseRevision: state.revision,
    command: Core.createCoreCommandV1({ schemaVersion: 1, sequence: state.revision + 1,
      actorPlayerId: playerId, decisionMakerPlayerId: playerId,
      decisionContext: { kind: 'decision', decisionKey: commandId }, payload }),
  };
}

function undoIntent(state: OnlineVariableProtocolStateV2, commandId: string, baseRevision = state.revision, seatIndex = 0): OnlineSharedUndoIntentV1 {
  return { kind: 'online-shared-undo-intent-v1', schemaVersion: 1, protocolVersion: state.protocolVersion,
    roomId: state.room.roomId, participantId: state.room.seats[seatIndex]?.participantId ?? '', participantCapability: state.room.seats[seatIndex]?.seatCapability ?? '', commandId, baseRevision };
}

function damageIntent(state: OnlineVariableProtocolStateV2, commandId: string, defendingPlayerId = 'P2' as Core.CorePlayerId, seatIndex = 0, commanderObjectId: Core.CoreObjectId | null = null, damage = 1): OnlineManualCombatDamageIntentV1 {
  return { kind: 'online-manual-combat-damage-intent-v1', schemaVersion: 1, protocolVersion: state.protocolVersion,
    roomId: state.room.roomId, participantId: state.room.seats[seatIndex]?.participantId ?? '', participantCapability: state.room.seats[seatIndex]?.seatCapability ?? '', commandId, baseRevision: state.revision, defendingPlayerId, damage, commanderObjectId };
}

function combatDamageStateFixture(): OnlineVariableProtocolStateV2 {
  const initial = stateFixture();
  const combatContext = Core.createCoreCombatContextV1({ combatId: 'manual-damage-combat', turnNumber: 4, step: 'declare-blockers', attackingPlayerId: 'P3', defendingPlayerIds: ['P1'], attacks: [{ attackerObjectId: 'PC6:0', attackerControllerPlayerId: 'P3', defendingPlayerId: 'P1' }], blocks: [] });
  const coreRoot = Core.createModeNeutralCoreRootV1({ ...initial.coreRoot, combatContext });
  return createOnlineVariableProtocolStateV2({ serverBuildId: initial.serverBuildId, room: initial.room, coreRoot });
}

describe('O4P-09G shared undo protocol', () => {
  it('accepts one shared rollback and closes stale, untrusted, reuse, and HOLD paths', () => {
    const initial = stateFixture();
    const activePlayerId = initial.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId;
    const actorIndex = Number(activePlayerId.slice(1)) - 1;
    const life = initial.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players[activePlayerId]?.life ?? 40;
    const accepted = handleOnlineVariableCommandEnvelopeV2(initial, envelope(initial, actorIndex, {
      kind: 'correct-player-life', playerId: activePlayerId, replacementLifeTotal: life - 1,
      expectedBeforeStateDigest: Core.coreCanonicalDigestFromValueV1(initial.coreRoot), reason: 'shared undo test',
    }, 'shared-mutation'));
    expect(accepted.response).toMatchObject({ kind: 'online-command-ack-v1', acceptedRevision: 1 });
    const intent = undoIntent(accepted.state, 'shared-undo', accepted.state.revision, 3);
    expect(handleOnlineVariableSharedUndoIntentV2(accepted.state, intent, false).response).toMatchObject({ issues: [{ code: 'AUTHORIZATION_REJECTED' }] });
    expect(handleOnlineVariableSharedUndoIntentV2(accepted.state, { ...intent, baseRevision: 0 }, true).response).toMatchObject({ issues: [{ code: 'STALE_REVISION' }] });
    const undone = handleOnlineVariableSharedUndoIntentV2(accepted.state, intent, true);
    expect(undone.response).toMatchObject({ kind: 'online-command-ack-v1', acceptedRevision: 2, duplicate: false });
    expect(undone.state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players[activePlayerId]?.life).toBe(life);
    expect(undone.state.sharedCheckpoint).toBeNull();
    expect(handleOnlineVariableSharedUndoIntentV2(undone.state, undoIntent(undone.state, 'second-undo', undone.state.revision, 3), true).response).toMatchObject({ issues: [{ code: 'AUTHORIZATION_REJECTED' }] });
    const hold = handleOnlineVariableCommandEnvelopeV2(initial, envelope(initial, 0, { kind: 'table-priority-hold', held: true }, 'hold'));
    expect(hold.response).toMatchObject({ kind: 'online-command-ack-v1' });
    expect(handleOnlineVariableSharedUndoIntentV2(hold.state, undoIntent(hold.state, 'hold-undo'), true).response).toMatchObject({ issues: [{ code: 'AUTHORIZATION_REJECTED' }] });
    expect(validateOnlineSharedUndoIntentV1({ ...intent, commandId: CAPS[0] }).ok).toBe(true);
    expect(handleOnlineVariableSharedUndoIntentV2(accepted.state, { ...intent, commandId: CAPS[0] }, true).response).toMatchObject({ issues: [{ code: 'INVALID_CAPABILITY' }] });
  });

  it('restores a finished room exactly once when the surviving steward undoes the lethal exit', () => {
    let current = twoPlayerStateFixture();
    const survivorIndex = Number(current.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId.slice(1)) - 1;
    const exitIndex = survivorIndex === 0 ? 1 : 0;
    {
      const transition = handleOnlineVariableCommandEnvelopeV2(current, envelope(current, exitIndex, { kind: 'player-exit', playerId: `P${exitIndex + 1}` as Core.CorePlayerId, cause: 'defeat' }, `exit-${exitIndex}`));
      expect(transition.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
      current = transition.state;
    }
    expect(current.room.lifecycle).toBe('finished');
    const restored = handleOnlineVariableSharedUndoIntentV2(current, undoIntent(current, 'terminal-undo', current.revision, survivorIndex), true);
    expect(restored.response).toMatchObject({ kind: 'online-command-ack-v1', acceptedRevision: 2, duplicate: false });
    expect(restored.state.room.lifecycle).toBe('active');
    expect(restored.state.room.seats.every((seat) => seat.outcome === 'pending')).toBe(true);
    expect(handleOnlineVariableSharedUndoIntentV2(restored.state, undoIntent(restored.state, 'terminal-second-undo', restored.state.revision, survivorIndex), true).response).toMatchObject({ issues: [{ code: 'AUTHORIZATION_REJECTED' }] });
  });

  it('binds one server-owned combat damage fact and rejects client bypasses', () => {
    const initial = combatDamageStateFixture();
    const accepted = handleOnlineVariableManualCombatDamageIntentV2(initial, damageIntent(initial, 'damage-one', 'P1' as Core.CorePlayerId, 3), true);
    expect(accepted.response).toMatchObject({ kind: 'online-command-ack-v1', acceptedRevision: 1, duplicate: false });
    expect(accepted.state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players['P1' as Core.CorePlayerId]?.life).toBe(39);
    expect(handleOnlineVariableManualCombatDamageIntentV2(initial, damageIntent(initial, 'damage-untrusted', 'P1' as Core.CorePlayerId, 3), false).response).toMatchObject({ issues: [{ code: 'AUTHORIZATION_REJECTED' }] });
    expect(handleOnlineVariableManualCombatDamageIntentV2(initial, { ...damageIntent(initial, 'damage-bad'), damage: 0 }, true).response).toMatchObject({ issues: [{ code: 'INVALID_PROTOCOL_STATE' }] });
    const commander = handleOnlineVariableManualCombatDamageIntentV2(initial, damageIntent(initial, 'damage-commander', 'P1' as Core.CorePlayerId, 3, 'PC6:0' as Core.CoreObjectId), true);
    expect(commander.response).toMatchObject({ kind: 'online-command-ack-v1', acceptedRevision: 1 });
    expect(commander.state.coreRoot.commanderDamage.entries).toContainEqual({ commanderPhysicalCardId: 'PC6', defendingPlayerId: 'P1', damage: 1 });
    const lethal = handleOnlineVariableManualCombatDamageIntentV2(initial, damageIntent(initial, 'damage-lethal', 'P1' as Core.CorePlayerId, 3, null, 40), true);
    expect(lethal.response).toMatchObject({ kind: 'online-command-ack-v1', acceptedRevision: 1 });
    expect(lethal.state.room.lifecycle).toBe('active');
    expect(lethal.state.room.seats.find((seat) => seat.corePlayerId === 'P1')?.outcome).toBe('defeated');
    expect(lethal.state.room.seats.filter((seat) => seat.outcome === 'pending')).toHaveLength(3);
    const unregistered = handleOnlineVariableManualCombatDamageIntentV2(initial, damageIntent(initial, 'damage-unregistered', 'P1' as Core.CorePlayerId, 3, 'PC2:0' as Core.CoreObjectId), true);
    expect(unregistered.response).toMatchObject({ issues: [{ code: 'CORE_COMMAND_REJECTED' }] });
    const held = handleOnlineVariableCommandEnvelopeV2(initial, envelope(initial, 3, { kind: 'table-priority-hold', held: true }, 'damage-hold'));
    expect(held.response).toMatchObject({ kind: 'online-command-ack-v1' });
    expect(handleOnlineVariableManualCombatDamageIntentV2(held.state, damageIntent(held.state, 'damage-held', 'P1' as Core.CorePlayerId, 3), true).response).toMatchObject({ issues: [{ code: 'AUTHORIZATION_REJECTED' }] });
  });
});
