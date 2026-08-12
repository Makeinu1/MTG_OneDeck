#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as Core from '../../src/engine/core';
import * as Protocol from '../../src/online/protocol';
import * as Room from '../../src/online/room';
import turnPriorityFixture from '../../src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json';

type RecordValue = Record<string, unknown>;

const repositoryRoot = resolve(new URL('../..', import.meta.url).pathname);
const fixturePath = resolve(
  repositoryRoot,
  'src/online/protocol/fixtures/o4p-02c-in-memory-protocol-v1.json',
);

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record`);
  }
  return value as RecordValue;
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined || !('value' in descriptor) || deepFrozen(descriptor.value, seen);
  });
}

function makeCoreRoot(): Core.ModeNeutralCoreRootV1 {
  const source = Core.createCoreTurnPriorityBundleV1(turnPriorityFixture.bundle as never);
  const registry = source.stackBundle.objectRegistry;
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({
    stackBundle: source.stackBundle,
    pendingTriggers: Core.createModeNeutralCorePendingTriggerSliceV1(registry, {
      pendingObjectIds: [],
      byObject: {},
    }),
    lifecycle: source.lifecycle,
  });
  const authority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle,
    control: Core.createModeNeutralCoreControlSliceV1({
      effectOrder: [],
      byEffect: {},
      continuityByObject: {
        'PC6:0': { controllerPlayerId: 'P3', continuousSinceMostRecentTurnBegan: false },
      } as never,
    }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({
      sessionOrder: [],
      bySession: {},
    }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({
      permissionOrder: [],
      byPermission: {},
    }),
    decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({
      authorityOrder: [],
      byAuthority: {},
    }),
  });
  const commanders = [
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC1', ownerPlayerId: 'P1' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC3', ownerPlayerId: 'P2' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC6', ownerPlayerId: 'P3' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC5', ownerPlayerId: 'P4' }),
  ];
  return Core.createModeNeutralCoreRootV1({
    versions: Core.CORE_CLOSURE_VERSION_VECTOR_V1,
    acceptedCommandCount: 0,
    ruleAuthority: authority,
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({
      players: registry.turnOrder.map((playerId) => ({
        playerId,
        status: 'active',
        exitCause: null,
      })),
    }),
    commanders,
    commanderCastLedgers: commanders.map((commander) =>
      Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 }),
    ),
    commanderDamage: Core.createCoreCommanderDamageStateV1({
      commanders,
      defendingPlayerIds: registry.turnOrder,
      entries: [],
    }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({
      commanders,
      defendingPlayerIds: registry.turnOrder,
      records: [],
    }),
    combatContext: null,
  });
}

const fixture = record(
  JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown,
  'Protocol fixture',
);
assert.equal(fixture.version, 'online-in-memory-protocol-v1');
assert.equal(fixture.schemaVersion, 1);
assert.equal(fixture.protocolVersion, 1);
assert.equal(Protocol.ONLINE_PROTOCOL_SCHEMA_VERSION_V1, 1);

const assignments = fixture.seatAssignments as Array<RecordValue>;
const players = fixture.players as readonly string[];
const observerAuthorizations = fixture.observerAuthorizations as Array<RecordValue>;
let room = Room.createOnlineRoomV1({
  roomId: fixture.roomId,
  seatAssignments: assignments,
  host: fixture.host,
});
room = Room.joinOnlineRoomV1(room, {
  participantId: fixture.tableParticipantId,
  role: 'table',
});
room = Room.joinOnlineRoomV1(room, {
  participantId: fixture.spectatorParticipantId,
  role: 'spectator',
});
for (let index = 1; index < 4; index += 1) {
  room = Room.joinOnlineRoomV1(room, {
    participantId: players[index],
    role: 'player',
    seatCapability: assignments[index]?.seatCapability,
  });
}
for (let index = 0; index < 4; index += 1) {
  room = Room.setOnlineRoomPlayerReadyV1(room, {
    participantId: players[index],
    seatCapability: assignments[index]?.seatCapability,
    ready: true,
  });
}
room = Room.startOnlineRoomV1(room, players[0]);
const root = makeCoreRoot();
room = Room.activateOnlineRoomV1(room, {
  hostParticipantId: players[0],
  coreRoot: root,
});

const state = Protocol.createOnlineProtocolStateV1({
  serverBuildId: fixture.serverBuildId,
  room,
  coreRoot: root,
  observerAuthorizations,
});
assert.equal(state.revision, root.acceptedCommandCount);
assert.equal(state.receipts.length, 0);
assert.equal(deepFrozen(state), true);
assert.equal(Protocol.validateOnlineProtocolStateV1(state).ok, true);

const hello = Protocol.handleOnlineClientHelloV1(state, {
  kind: 'online-client-hello-v1',
  protocolVersion: fixture.protocolVersion,
  roomId: fixture.roomId,
  participantId: players[0],
  participantCapability: assignments[0]?.seatCapability,
  clientBuildId: fixture.differentClientBuildId,
});
assert.equal(hello.response.status, 'accepted');
if (hello.response.status !== 'accepted') throw new Error('Expected accepted ServerHello');
assert.equal(hello.response.clientBuildIdMatch, false);
assert.equal(hello.state, state);

const command = Core.createCoreCommandV1({
  schemaVersion: 1,
  sequence: 1,
  actorPlayerId: 'P1' as Core.CorePlayerId,
  decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
  decisionContext: { kind: 'decision', decisionKey: 'protocol-verifier' },
  payload: {
    kind: 'commander-cast-record',
    physicalCardId: 'PC1' as Core.CorePhysicalCardId,
    origin: 'command-zone',
    accepted: true,
  },
});
const envelope = {
  kind: 'online-command-envelope-v1',
  protocolVersion: fixture.protocolVersion,
  roomId: fixture.roomId,
  participantId: players[0],
  participantCapability: assignments[0]?.seatCapability,
  commandId: fixture.commandId,
  baseRevision: 0,
  command,
};
const accepted = Protocol.handleOnlineCommandEnvelopeV1(state, envelope);
assert.equal(accepted.response.kind, 'online-command-ack-v1');
if (accepted.response.kind !== 'online-command-ack-v1') throw new Error('Expected ACK');
assert.equal(accepted.response.duplicate, false);
assert.equal(accepted.response.acceptedRevision, 1);
assert.equal(accepted.state.revision, 1);
assert.equal(accepted.state.coreRoot.acceptedCommandCount, 1);
assert.equal(accepted.state.receipts.length, 1);

const duplicate = Protocol.handleOnlineCommandEnvelopeV1(accepted.state, envelope);
assert.equal(duplicate.response.kind, 'online-command-ack-v1');
if (duplicate.response.kind !== 'online-command-ack-v1') throw new Error('Expected duplicate ACK');
assert.equal(duplicate.response.duplicate, true);
assert.equal(duplicate.state, accepted.state);
assert.equal(duplicate.state.receipts.length, 1);

const staleEnvelope = { ...envelope, commandId: fixture.staleCommandId };
const stale = Protocol.handleOnlineCommandEnvelopeV1(duplicate.state, staleEnvelope);
assert.equal(stale.response.kind, 'online-command-reject-v1');
if (stale.response.kind !== 'online-command-reject-v1') throw new Error('Expected stale reject');
assert.equal(stale.response.resyncRequired, true);
assert.equal(stale.response.issues.some(({ code }) => code === 'STALE_REVISION'), true);
assert.equal(stale.state.revision, 1);
assert.equal(stale.state.receipts.length, 2);

const resync = Protocol.handleOnlineSnapshotRequestV1(stale.state, {
  kind: 'online-snapshot-request-v1',
  protocolVersion: fixture.protocolVersion,
  roomId: fixture.roomId,
  participantId: players[1],
  participantCapability: assignments[1]?.seatCapability,
  knownRevision: 0,
  clientBuildId: fixture.matchingClientBuildId,
});
assert.equal(resync.response.kind, 'online-resync-v1');
if (resync.response.kind !== 'online-resync-v1') throw new Error('Expected resync');
assert.equal(resync.response.reason, 'snapshot-required');
assert.equal(resync.response.projectionRequired, true);

assert.equal(accepted.state.coreRoot.acceptedCommandCount, 1);
for (const response of [hello.response, accepted.response, stale.response, resync.response]) {
  const serialized = JSON.stringify(response);
  for (const assignment of assignments) {
    assert.equal(serialized.includes(String(assignment.seatCapability)), false);
  }
  for (const authorization of observerAuthorizations) {
    assert.equal(serialized.includes(String(authorization.observerCapability)), false);
  }
  assert.equal(serialized.includes('acceptedCommandCount'), false);
  assert.equal(serialized.includes('requestDigest'), false);
  assert.equal(serialized.includes('PC6:0'), false);
}

console.log(
  'fixture=online-in-memory-protocol-v1 protocol=1 build-diagnostic=true '
  + 'ack-revision=1 dedup-apply-once=true stale-receipt=true resync=metadata-only '
  + 'capability-leak=false transport=in-memory frozen=true',
);
