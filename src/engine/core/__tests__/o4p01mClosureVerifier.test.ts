import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as Core from '../index';

type RawRecord = Record<string, unknown>;
type Fixture = RawRecord & {
  version: string;
  commanders: RawRecord[];
  castLedger: RawRecord;
  damageState: RawRecord;
  provenanceLedger: RawRecord;
  combatContext: RawRecord & { attacks: RawRecord[]; blocks: RawRecord[] };
  lifecycle: RawRecord;
  lifecycleExits: RawRecord[];
  exitReferenceBundle: RawRecord;
};

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/o4p-01m-commander-combat-player-exit-v1.json', import.meta.url), 'utf8'),
) as Fixture;

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      || deepFrozen(descriptor.value, seen);
  });
}

function runtimeKeys(value: unknown, found: string[] = []): string[] {
  if (value === null || typeof value !== 'object') return found;
  Object.keys(value).forEach((key) => {
    found.push(key);
    runtimeKeys((value as RawRecord)[key], found);
  });
  return found;
}

function expectFrozenAndSerializable(values: readonly [string, unknown][]): void {
  values.forEach(([label, value]) => {
    expect(deepFrozen(value), `${label} must be deeply frozen`).toBe(true);
    expect(JSON.parse(JSON.stringify(value)) as unknown, `${label} JSON round trip`).toEqual(value);
  });
}

describe('O4P-01M closure verifier', () => {
  it('closes the four-player fixture through the public Core root', () => {
    const fixtureBefore = JSON.stringify(fixture);
    expect(fixture.version).toBe('mode-neutral-core-commander-combat-player-exit-v1');
    expect(Object.keys(fixture.exitReferenceBundle)).not.toContain('exitingPlayerId');

    const identities = fixture.commanders.map((commander) => Core.createCoreCommanderIdentityV1(commander));
    const ledger = Core.createCoreCommanderCastLedgerV1(fixture.castLedger);
    const cast = Core.recordCoreCommanderCastV1(ledger, { origin: 'command-zone' });
    const damageState = Core.createCoreCommanderDamageStateV1(fixture.damageState);
    const damage = [
      { commanderPhysicalCardId: 'C1', defendingPlayerId: 'P1', damage: 3 },
      { commanderPhysicalCardId: 'C1', defendingPlayerId: 'P2', damage: 7 },
      { commanderPhysicalCardId: 'C2', defendingPlayerId: 'P1', damage: 9 },
      { commanderPhysicalCardId: 'C2', defendingPlayerId: 'P2', damage: 5 },
    ].reduce((state, input) => Core.recordCoreCommanderDamageV1(state, input), damageState);
    const provenance = Core.createCoreCommanderDamageProvenanceLedgerV1(fixture.provenanceLedger);

    const context = Core.createCoreCombatContextV1(fixture.combatContext);
    const contextBefore = JSON.stringify(context);
    const afterCombatExit = Core.reconcileCoreCombatContextForPlayerExitV1(context, {
      exitingPlayerId: 'P3',
      participantObjectIdsToClear: ['PC6:0'],
    });
    expect(afterCombatExit?.defendingPlayerIds).toEqual(['P2', 'P4']);
    expect(afterCombatExit?.attacks.map((attack) => attack.attackerObjectId)).toEqual(['PC1:0', 'PC3:0']);
    expect(afterCombatExit?.blocks.map((block) => block.attackedObjectId)).toEqual(['PC1:0']);
    expect(JSON.stringify(context)).toBe(contextBefore);

    const lifecycle = Core.createCorePlayerLifecycleStateV1(fixture.lifecycle);
    const lifecycleBefore = JSON.stringify(lifecycle);
    const request = fixture.lifecycleExits[0];
    const bundle = Core.createCorePlayerExitReferenceBundleV1(fixture.exitReferenceBundle);
    const bundleBefore = JSON.stringify(bundle);
    const result = Core.reconcileCorePlayerExitV1(lifecycle, bundle, request);

    expect(identities.map((identity) => identity.physicalCardId)).toEqual(['C1', 'C2', 'C3', 'C4']);
    expect(Core.coreCommanderTaxV1(ledger)).toBe(0);
    expect(Core.coreCommanderTaxV1(cast)).toBe(2);
    expect([
      Core.coreCommanderDamageAgainstV1(damage, 'C1', 'P1'),
      Core.coreCommanderDamageAgainstV1(damage, 'C1', 'P2'),
      Core.coreCommanderDamageAgainstV1(damage, 'C2', 'P1'),
      Core.coreCommanderDamageAgainstV1(damage, 'C2', 'P2'),
    ]).toEqual([3, 7, 9, 5]);
    expect(Core.coreCommanderProvenanceDamageAgainstV1(provenance, 'C1', 'P2')).toBe(21);
    expect(Core.coreCommanderThresholdReachedFromProvenanceV1(provenance, 'C1', 'P2')).toBe(true);
    expect(Core.coreCommanderThresholdReachedFromProvenanceV1(provenance, 'C2', 'P2')).toBe(false);
    expect(Object.keys(context)).toEqual([
      'combatId', 'turnNumber', 'step', 'attackingPlayerId', 'defendingPlayerIds', 'attacks', 'blocks',
    ]);
    expect(Object.keys(result)).toEqual([
      'lifecycleState', 'survivingTurnOrder', 'activePlayerAfterExit', 'priorityHandoffPlayerId',
      'ownedObjectsToLeaveGame', 'controlEffectIdsToEnd', 'nonCardStackObjectsToCease',
      'controlledObjectsToExile', 'combatParticipantObjectIdsToClear', 'decisionAuthorityIdsToClear',
      'searchSessionIdsToClose',
    ]);
    expect(result.lifecycleState.players).toEqual([
      { playerId: 'P1', status: 'exited', exitCause: 'concession' },
      { playerId: 'P2', status: 'active', exitCause: null },
      { playerId: 'P3', status: 'active', exitCause: null },
      { playerId: 'P4', status: 'active', exitCause: null },
    ]);
    expect(result.survivingTurnOrder).toEqual(['P2', 'P3', 'P4']);
    expect(result.activePlayerAfterExit).toBeNull();
    expect(result.priorityHandoffPlayerId).toBe('P2');
    expect(result.ownedObjectsToLeaveGame).toEqual(['PC1:0', '@token:owned-token:0']);
    expect(result.nonCardStackObjectsToCease).toEqual(['@triggered-ability:stack-a', '@spell-copy:stack-b']);
    expect(result.controlledObjectsToExile).toEqual(['PC2:0', '@activated-ability:owned-ability', 'PC3:0']);
    expect(result.combatParticipantObjectIdsToClear).toEqual(['PC1:0', 'PC4:0']);
    expect(new Set([
      ...result.ownedObjectsToLeaveGame,
      ...result.nonCardStackObjectsToCease,
      ...result.controlledObjectsToExile,
    ]).size).toBe(
      result.ownedObjectsToLeaveGame.length
      + result.nonCardStackObjectsToCease.length
      + result.controlledObjectsToExile.length,
    );
    expect(JSON.stringify(fixture)).toBe(fixtureBefore);
    expect(JSON.stringify(lifecycle)).toBe(lifecycleBefore);
    expect(JSON.stringify(bundle)).toBe(bundleBefore);

    const publicExports = Object.keys(Core);
    const combatRuntimeExports = publicExports.filter((name) => name.toLowerCase().includes('combat'));
    const automaticCombatRuntimeExports = combatRuntimeExports.filter((name) =>
      /damage|sba|statebased|assignment/.test(name.toLowerCase()));
    const forbiddenContextFields = Object.keys(context).filter((key) =>
      /damage|sba|statebased|assignment|network|room|protocol|transport|connection/.test(key.toLowerCase()));
    const forbiddenResultFields = Object.keys(result).filter((key) =>
      /damage|sba|statebased|assignment|network|room|protocol|transport|connection/.test(key.toLowerCase()));
    const publicCombatBoundaryIsStructural = automaticCombatRuntimeExports.length === 0
      && forbiddenContextFields.length === 0
      && forbiddenResultFields.length === 0;
    expect(publicCombatBoundaryIsStructural).toBe(true);
    expect(publicExports).not.toEqual(expect.arrayContaining([
      'CoreMultiplayerCombatAssignmentAdditionErrorV1',
      'CoreMultiplayerCombatAssignmentCreationErrorV1',
      'createCoreMultiplayerCombatAssignmentStateV1',
      'addCoreCombatAttackAssignmentV1',
      'addCoreCombatBlockAssignmentV1',
    ]));
    expect(publicExports).toEqual(expect.arrayContaining([
      'coreCommanderDamageAgainstV1',
      'recordCoreCommanderDamageV1',
    ]));
    expect(combatRuntimeExports).not.toContain('coreCommanderDamageAgainstV1');

    const forbiddenKeys = /^(disconnect|connected|timeout|browser|transport|network|room|protocol|connection|websocket|automaticdamage|automaticdamageapplication|automaticsba|automaticstatebasedactions|statebasedactions|damageassignment|damageapplication)$/i;
    expect(runtimeKeys(fixture).some((key) => forbiddenKeys.test(key))).toBe(false);
    expect(runtimeKeys(result).some((key) => forbiddenKeys.test(key))).toBe(false);
    expectFrozenAndSerializable([
      ['ledger', ledger],
      ['cast', cast],
      ['damageState', damageState],
      ['damage', damage],
      ['provenance', provenance],
      ['context', context],
      ['afterCombatExit', afterCombatExit],
      ['lifecycle', lifecycle],
      ['bundle', bundle],
      ['result', result],
    ]);
    identities.forEach((identity, index) => {
      expectFrozenAndSerializable([[`identity${index + 1}`, identity]]);
    });
  });
});
