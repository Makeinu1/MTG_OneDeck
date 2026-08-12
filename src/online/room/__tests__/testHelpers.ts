import * as Core from '../../../engine/core/index';
import turnPriorityFixture from '../../../engine/core/turn/fixtures/turn-priority-lifecycle-v1.json';
import { expect } from 'vitest';
import {
  createOnlineRoomV1,
  joinOnlineRoomV1,
  setOnlineRoomPlayerReadyV1,
  type OnlineRoomV1,
} from '../index';

export const CAPABILITIES = Object.freeze([
  'seat_capability_AAAAAAAAAAAAAAAA',
  'seat_capability_BBBBBBBBBBBBBBBB',
  'seat_capability_CCCCCCCCCCCCCCCC',
  'seat_capability_DDDDDDDDDDDDDDDD',
] as const);

export const PARTICIPANTS = Object.freeze(['host', 'player-2', 'player-3', 'player-4'] as const);
export const CORE_PLAYERS = Object.freeze(['P1', 'P2', 'P3', 'P4'] as const);

export function createRoom(): OnlineRoomV1 {
  return createOnlineRoomV1({
    roomId: 'room-02b',
    seatAssignments: CORE_PLAYERS.map((corePlayerId, seatIndex) => ({
      seatIndex,
      corePlayerId,
      seatCapability: CAPABILITIES[seatIndex],
    })),
    host: { participantId: PARTICIPANTS[0], seatCapability: CAPABILITIES[0] },
  });
}

export function joinAllPlayers(room: OnlineRoomV1 = createRoom()): OnlineRoomV1 {
  let current = room;
  for (let index = 1; index < 4; index += 1) {
    current = joinOnlineRoomV1(current, {
      participantId: PARTICIPANTS[index],
      role: 'player',
      seatCapability: CAPABILITIES[index],
    });
  }
  return current;
}

export function readyAllPlayers(room: OnlineRoomV1 = joinAllPlayers()): OnlineRoomV1 {
  let current = room;
  for (let index = 0; index < 4; index += 1) {
    current = setOnlineRoomPlayerReadyV1(current, {
      participantId: PARTICIPANTS[index],
      seatCapability: CAPABILITIES[index],
      ready: true,
    });
  }
  return current;
}

export function makeCoreRoot(): Core.ModeNeutralCoreRootV1 {
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

export function coreCommand(
  root: Core.ModeNeutralCoreRootV1,
  actorPlayerId: (typeof CORE_PLAYERS)[number],
  payload: Core.CoreCommandV1['payload'],
): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence: root.acceptedCommandCount + 1,
    actorPlayerId: actorPlayerId as never,
    decisionMakerPlayerId: actorPlayerId as never,
    decisionContext: { kind: 'decision', decisionKey: 'online-room-test' },
    payload,
  });
}

export function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) assertDeepFrozen(descriptor.value, seen);
  }
}
