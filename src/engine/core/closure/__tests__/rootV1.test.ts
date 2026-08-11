import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Core from '../../index';
import * as Closure from '../index';

describe('O4P-01N root composition', () => {
  it('composes the shipped four-player bundles without duplicating authority', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../turn/fixtures/turn-priority-lifecycle-v1.json', import.meta.url), 'utf8')) as { bundle: unknown };
    const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1(fixture.bundle as never);
    const registry = turnPriorityBundle.stackBundle.objectRegistry;
    const control = Core.createModeNeutralCoreControlSliceV1({
      effectOrder: [],
      byEffect: {},
      continuityByObject: Object.fromEntries([['PC6:0', { controllerPlayerId: 'P3', continuousSinceMostRecentTurnBegan: false }]]) as never,
    });
    const authority = Core.createCoreRuleAuthorityBundleV1({
      turnPriorityBundle,
      control,
      visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
      searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
      playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }),
      decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }),
    });
    const commander = Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC1', ownerPlayerId: 'P1' });
    const root = Closure.createModeNeutralCoreRootV1({
      versions: Closure.CORE_CLOSURE_VERSION_VECTOR_V1,
      acceptedCommandCount: 0,
      ruleAuthority: authority,
      playerLifecycle: Core.createCorePlayerLifecycleStateV1({ players: registry.turnOrder.map((playerId) => ({ playerId, status: 'active', exitCause: null })) }),
      commanders: [commander],
      commanderCastLedgers: [Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 })],
      commanderDamage: Core.createCoreCommanderDamageStateV1({ commanders: [commander], defendingPlayerIds: registry.turnOrder, entries: [] }),
      commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({ commanders: [commander], defendingPlayerIds: registry.turnOrder, records: [] }),
      combatContext: null,
    });
    expect(Object.isFrozen(root)).toBe(true);
    expect(Closure.validateModeNeutralCoreRootV1(root)).toMatchObject({ ok: true });
    const command = Closure.createCoreCommandV1({
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P2' as never,
      decisionMakerPlayerId: 'P2' as never,
      decisionContext: { kind: 'decision', decisionKey: 'priority' },
      payload: { kind: 'priority-pass', playerId: 'P2' as never },
    });
    const result = Closure.applyCoreCommandV1(root, command);
    expect(result.status).toBe('rejected');
    expect(result.root).toBe(root);
    const acceptedCommand = Closure.createCoreCommandV1({
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision', decisionKey: 'cast' },
      payload: { kind: 'commander-cast-record', physicalCardId: 'PC1' as never, origin: 'command-zone', accepted: true },
    });
    expect(Closure.applyCoreCommandV1(root, acceptedCommand).status).toBe('accepted');
    const closure = Closure.runOrdinaryFourPlayerCoreClosureV1(root, [acceptedCommand]);
    expect(closure.finalRoot.commanderCastLedgers[0]?.castCount).toBe(1);
    expect(Closure.replayCoreCommandsV1(JSON.parse(JSON.stringify(closure.replayPackage)) as never)).toMatchObject({ ok: true });
  });
});
