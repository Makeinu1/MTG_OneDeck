#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as Core from '../../src/engine/core';
import * as Projection from '../../src/online/projection';
import * as Protocol from '../../src/online/protocol';
import * as Room from '../../src/online/room';
import turnPriorityFixture from '../../src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json';

type RecordValue = Record<string, unknown>;

const repositoryRoot = resolve(new URL('../..', import.meta.url).pathname);
const fixturePath = resolve(
  repositoryRoot,
  'src/online/projection/fixtures/o4p-02d-audience-projection-v1.json',
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

const fixture = record(JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown, 'Projection fixture');
assert.equal(fixture.version, 'online-audience-projection-v1');
assert.equal(fixture.schemaVersion, 1);
assert.equal(fixture.protocolVersion, 1);
assert.equal(Projection.ONLINE_PROJECTION_SCHEMA_VERSION_V1, 1);

const assignments = fixture.seatAssignments as readonly RecordValue[];
const players = fixture.players as readonly string[];
const observerAuthorizations = fixture.observerAuthorizations as readonly RecordValue[];
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
room = Room.activateOnlineRoomV1(room, { hostParticipantId: players[0], coreRoot: root });
const state = Protocol.createOnlineProtocolStateV1({
  serverBuildId: fixture.serverBuildId,
  room,
  coreRoot: root,
  observerAuthorizations,
});

function project(
  participantId: unknown,
  participantCapability: unknown,
): Projection.OnlineProjectedSnapshotTransitionV1 {
  return Projection.handleOnlineProjectedSnapshotRequestV1(state, {
    kind: 'online-projection-request-v1',
    protocolVersion: fixture.protocolVersion,
    roomId: fixture.roomId,
    participantId,
    participantCapability,
    knownRevision: 0,
    clientBuildId: fixture.differentClientBuildId,
    decisionContext: null,
  });
}

const player = project(players[0], assignments[0]?.seatCapability);
assert.equal(player.response.status, 'accepted');
if (player.response.status !== 'accepted') throw new Error('Expected player projection');
assert.equal(player.response.role, 'player');
assert.equal(player.response.clientBuildIdMatch, false);
assert.equal(player.response.projection.corePlayerId, 'P1');
assert.equal(player.response.projection.revision, state.revision);
assert.equal(player.log.status, 'accepted');
assert.equal(deepFrozen(player), true);
assert.equal(Projection.validateOnlineParticipantProjectionV1(player.response.projection).ok, true);

const p1Zones = player.response.projection.game.zones.byPlayer[0]?.zones;
const p2Zones = player.response.projection.game.zones.byPlayer[1]?.zones;
assert.equal(p1Zones?.library.entries[0]?.kind, 'hidden-card');
assert.equal(p1Zones?.hand.entries[0]?.kind, 'visible-object');
assert.equal(p2Zones?.hand.entries[0]?.kind, 'hidden-card');
assert.deepEqual(Object.keys(p1Zones?.library.entries[0] ?? {}), ['kind']);
assert.equal(player.response.projection.game.zones.exile.entries[0]?.kind, 'concealed-object');
assert.equal(player.response.projection.game.zones.stack.entries[0]?.kind, 'visible-object');

const table = project(
  fixture.tableParticipantId,
  observerAuthorizations[0]?.observerCapability,
);
const spectator = project(
  fixture.spectatorParticipantId,
  observerAuthorizations[1]?.observerCapability,
);
assert.equal(table.response.status, 'accepted');
assert.equal(spectator.response.status, 'accepted');
if (table.response.status !== 'accepted' || spectator.response.status !== 'accepted') {
  throw new Error('Expected observer projections');
}
assert.equal(table.response.role, 'table');
assert.equal(spectator.response.role, 'spectator');
assert.equal(table.response.projection.corePlayerId, null);
assert.equal(spectator.response.projection.corePlayerId, null);
assert.deepEqual(table.response.projection.game, spectator.response.projection.game);
assert.equal(table.response.projection.game.searchSessions.length, 0);
assert.equal(table.response.projection.game.playPermissions.length, 0);

const rejected = project(players[0], assignments[1]?.seatCapability);
assert.equal(rejected.response.status, 'rejected');
assert.equal(rejected.state, state);
assert.deepEqual(rejected.response.issues.map(({ code }) => code), ['AUTHORIZATION_REJECTED']);
assert.equal(rejected.log.role, null);

for (const publicValue of [
  player.response,
  player.log,
  table.response,
  table.log,
  spectator.response,
  spectator.log,
  rejected.response,
  rejected.log,
]) {
  const serialized = JSON.stringify(publicValue);
  for (const assignment of assignments) {
    assert.equal(serialized.includes(String(assignment.seatCapability)), false);
  }
  for (const authorization of observerAuthorizations) {
    assert.equal(serialized.includes(String(authorization.observerCapability)), false);
  }
  assert.equal(serialized.includes('physicalCardId'), false);
  assert.equal(serialized.includes('definitionId'), false);
  assert.equal(serialized.includes('observerAuthorizations'), false);
  assert.equal(serialized.includes('requestDigest'), false);
  assert.equal(serialized.includes('receipts'), false);
}

console.log(
  'fixture=online-audience-projection-v1 schema=1 player-own-hand=true '
  + 'library-hidden=true observer-public-parity=true configured-capability-leak=false '
  + 'log=minimal transport=in-memory frozen=true',
);
