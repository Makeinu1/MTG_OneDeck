import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as Core from '../index';

type Commander = { physicalCardId: string; ownerPlayerId: string };
type CombatAttack = {
  attackerObjectId: string;
  attackerControllerPlayerId: string;
  defendingPlayerId: string;
};
type CombatBlock = {
  blockerObjectId: string;
  blockerControllerPlayerId: string;
  attackedObjectId: string;
  defendingPlayerId: string;
};
type ExitRequest = { playerId: string; cause: 'concession' | 'defeat' };
type Fixture = {
  version: string;
  replacement: { kind: string; sourceZone: string };
  commanders: Commander[];
  castLedger: { commander: Commander; castCount: number };
  damageState: { commanders: Commander[]; defendingPlayerIds: string[]; entries: unknown[] };
  provenanceLedger: { commanders: Commander[]; defendingPlayerIds: string[]; records: unknown[] };
  combatContext: {
    combatId: string;
    turnNumber: number;
    step: string;
    attackingPlayerId: string;
    defendingPlayerIds: string[];
    attacks: CombatAttack[];
    blocks: CombatBlock[];
  };
  lifecycle: { players: unknown[] };
  lifecycleExits: ExitRequest[];
  exitReferenceBundle: Record<string, unknown>;
};

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/o4p-01m-commander-combat-player-exit-v1.json', import.meta.url), 'utf8'),
) as Fixture;

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);
  if (Array.isArray(value)) {
    value.forEach(assertDeepFrozen);
  } else {
    Object.values(value).forEach(assertDeepFrozen);
  }
}

function runtimeKeys(value: unknown, found: string[] = []): string[] {
  if (value === null || typeof value !== 'object') return found;
  Object.keys(value).forEach((key) => {
    found.push(key);
    runtimeKeys((value as Record<string, unknown>)[key], found);
  });
  return found;
}

function expectJsonRoundTrip(value: unknown): void {
  expect(JSON.parse(JSON.stringify(value)) as unknown).toEqual(value);
}

describe('O4P-01M serial root integration', () => {
  it('exposes the corrected public APIs and removes provisional combat authority', () => {
    const exports = Object.keys(Core);
    expect(exports).toContain('reconcileCoreCombatContextForPlayerExitV1');
    expect(exports).toContain('CoreCombatContextReconciliationErrorV1');
    expect(exports).toContain('corePlayerLifecycleExitCauseV1');
    expect(exports).toContain('reconcileCorePlayerExitV1');
    expect(exports).toContain('coreCommanderDamageAgainstV1');
    expect(exports).toContain('recordCoreCommanderDamageV1');
    expect(exports).not.toEqual(expect.arrayContaining([
      'CoreMultiplayerCombatAssignmentAdditionErrorV1',
      'CoreMultiplayerCombatAssignmentCreationErrorV1',
      'createCoreMultiplayerCombatAssignmentStateV1',
      'addCoreCombatAttackAssignmentV1',
      'addCoreCombatBlockAssignmentV1',
    ]));
    expect(exports.filter((name) => name.toLowerCase().includes('combat'))
      .some((name) => /damage|sba|statebased|assignment/.test(name.toLowerCase()))).toBe(false);
  });

  it('integrates four Commander identities, tax, damage, provenance, and replacement choices', () => {
    const before = JSON.stringify(fixture);
    expect(fixture.version).toBe('mode-neutral-core-commander-combat-player-exit-v1');
    expect(fixture.commanders).toHaveLength(4);

    const identities = fixture.commanders.map((commander) => Core.createCoreCommanderIdentityV1(commander));
    expect(identities).toEqual(fixture.commanders);
    const ledger = Core.createCoreCommanderCastLedgerV1(fixture.castLedger);
    const cast = Core.recordCoreCommanderCastV1(ledger, { origin: 'command-zone' });
    expect(Core.coreCommanderTaxV1(ledger)).toBe(0);
    expect(Core.coreCommanderTaxV1(cast)).toBe(2);
    expect(ledger.castCount).toBe(0);
    expect(cast.castCount).toBe(1);

    const damage = fixture.damageState;
    const damageState = Core.createCoreCommanderDamageStateV1(damage);
    const damageWithCells = [
      { commanderPhysicalCardId: 'C1', defendingPlayerId: 'P1', damage: 3 },
      { commanderPhysicalCardId: 'C1', defendingPlayerId: 'P2', damage: 7 },
      { commanderPhysicalCardId: 'C2', defendingPlayerId: 'P1', damage: 9 },
      { commanderPhysicalCardId: 'C2', defendingPlayerId: 'P2', damage: 5 },
    ].reduce((state, input) => Core.recordCoreCommanderDamageV1(state, input), damageState);
    expect([
      Core.coreCommanderDamageAgainstV1(damageWithCells, 'C1', 'P1'),
      Core.coreCommanderDamageAgainstV1(damageWithCells, 'C1', 'P2'),
      Core.coreCommanderDamageAgainstV1(damageWithCells, 'C2', 'P1'),
      Core.coreCommanderDamageAgainstV1(damageWithCells, 'C2', 'P2'),
    ]).toEqual([3, 7, 9, 5]);

    const provenance = Core.createCoreCommanderDamageProvenanceLedgerV1(fixture.provenanceLedger);
    expect(Core.coreCommanderProvenanceDamageAgainstV1(provenance, 'C1', 'P2')).toBe(21);
    expect(Core.coreCommanderThresholdReachedFromProvenanceV1(provenance, 'C1', 'P2')).toBe(true);
    expect(Core.coreCommanderThresholdReachedFromProvenanceV1(provenance, 'C2', 'P2')).toBe(false);

    expect(Core.createCoreCommanderReplacementChoiceV1(fixture.replacement)).toEqual(fixture.replacement);
    expect(JSON.stringify(fixture)).toBe(before);
    identities.forEach(assertDeepFrozen);
    [ledger, cast, damageState, damageWithCells, provenance].forEach(assertDeepFrozen);
  });

  it('uses one corrected combat context authority and preserves declaration order', () => {
    const context = Core.createCoreCombatContextV1(fixture.combatContext);
    expect(Object.keys(context)).toEqual([
      'combatId', 'turnNumber', 'step', 'attackingPlayerId', 'defendingPlayerIds', 'attacks', 'blocks',
    ]);
    expect(context.combatId).toBe('combat-01m');
    expect(context.turnNumber).toBe(7);
    expect(context.attacks.map((attack) => attack.attackerObjectId)).toEqual(['PC1:0', 'PC2:0', 'PC3:0']);

    const declaration = Core.createCoreCombatContextV1({
      ...fixture.combatContext,
      step: 'declare-attackers',
      attacks: [],
      blocks: [],
    });
    const withAttacks = fixture.combatContext.attacks.reduce(
      (state, attack) => Core.addCoreCombatContextAttackV1(state, attack),
      declaration,
    );
    expect(() => Core.addCoreCombatContextAttackV1(withAttacks, {
      ...fixture.combatContext.attacks[0],
      defendingPlayerId: 'P3',
    })).toThrow(Core.CoreCombatContextAdditionErrorV1);
    const withBlocks = Core.setCoreCombatContextStepV1(withAttacks, 'declare-blockers');
    const final = fixture.combatContext.blocks.reduce(
      (state, block) => Core.addCoreCombatContextBlockV1(state, block),
      withBlocks,
    );
    expect(final).toEqual(context);
    expect(final.blocks.map((block) => block.attackedObjectId)).toEqual(['PC1:0', 'PC2:0', 'PC3:0']);
    assertDeepFrozen(final);
  });

  it('reconciles combat exits by removing the defender, orphans, and explicit participants in order', () => {
    const context = Core.createCoreCombatContextV1(fixture.combatContext);
    const before = JSON.stringify(context);
    const reconciled = Core.reconcileCoreCombatContextForPlayerExitV1(context, {
      exitingPlayerId: 'P3',
      participantObjectIdsToClear: ['PC6:0'],
    });
    expect(reconciled).not.toBeNull();
    expect(reconciled?.defendingPlayerIds).toEqual(['P2', 'P4']);
    expect(reconciled?.attacks.map((attack) => attack.attackerObjectId)).toEqual(['PC1:0', 'PC3:0']);
    expect(reconciled?.blocks).toEqual([fixture.combatContext.blocks[0]]);
    expect(JSON.stringify(context)).toBe(before);
    assertDeepFrozen(reconciled);

    expect(Core.reconcileCoreCombatContextForPlayerExitV1(context, {
      exitingPlayerId: 'P1',
      participantObjectIdsToClear: [],
    })).toBeNull();
  });

  it('distinguishes lifecycle status from cause and atomically reconciles three inputs', () => {
    const lifecycle = Core.createCorePlayerLifecycleStateV1(fixture.lifecycle);
    const lifecycleBefore = JSON.stringify(lifecycle);
    const conceded = Core.applyCorePlayerExitV1(lifecycle, fixture.lifecycleExits[0]);
    const defeated = Core.applyCorePlayerExitV1(conceded, fixture.lifecycleExits[1]);
    expect(Core.corePlayerLifecycleStatusV1(defeated, 'P1')).toBe('exited');
    expect(Core.corePlayerLifecycleExitCauseV1(defeated, 'P1')).toBe('concession');
    expect(Core.corePlayerLifecycleStatusV1(defeated, 'P2')).toBe('exited');
    expect(Core.corePlayerLifecycleExitCauseV1(defeated, 'P2')).toBe('defeat');
    expect(Core.corePlayerLifecycleExitCauseV1(defeated, 'P3')).toBeNull();
    expect(defeated.players).toHaveLength(4);

    const bundle = Core.createCorePlayerExitReferenceBundleV1(fixture.exitReferenceBundle);
    expect(Object.keys(bundle)).toEqual([
      'turnOrder', 'eligiblePlayerIds', 'activePlayerId', 'priorityHolderPlayerId', 'ownedObjectIds',
      'controlledObjectIds', 'nonCardStackObjectIds', 'combatParticipantObjectIds', 'controlEffectIds',
      'decisionAuthorityIds', 'searchSessionIds',
    ]);
    const result = Core.reconcileCorePlayerExitV1(lifecycle, bundle, fixture.lifecycleExits[0]);
    expect(Object.keys(result)).toEqual([
      'lifecycleState', 'survivingTurnOrder', 'activePlayerAfterExit', 'priorityHandoffPlayerId',
      'ownedObjectsToLeaveGame', 'controlEffectIdsToEnd', 'nonCardStackObjectsToCease',
      'controlledObjectsToExile', 'combatParticipantObjectIdsToClear', 'decisionAuthorityIdsToClear',
      'searchSessionIdsToClose',
    ]);
    expect(result.survivingTurnOrder).toEqual(['P2', 'P3', 'P4']);
    expect(result.activePlayerAfterExit).toBeNull();
    expect(result.priorityHandoffPlayerId).toBe('P2');
    expect(result.lifecycleState.players[0]).toEqual({ playerId: 'P1', status: 'exited', exitCause: 'concession' });
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
    expect(JSON.stringify(lifecycle)).toBe(lifecycleBefore);
    assertDeepFrozen(result);
    expectJsonRoundTrip(result);
  });

  it('rejects stale or network-shaped authority without mutating inputs', () => {
    const lifecycle = Core.createCorePlayerLifecycleStateV1(fixture.lifecycle);
    const bundle = Core.createCorePlayerExitReferenceBundleV1(fixture.exitReferenceBundle);
    const lifecycleBefore = JSON.stringify(lifecycle);
    const bundleBefore = JSON.stringify(bundle);
    expect(() => Core.reconcileCorePlayerExitV1(lifecycle, bundle, {
      playerId: 'P1',
      cause: 'concession',
      exitingPlayerId: 'P1',
    })).toThrow(Core.CorePlayerExitReconciliationErrorV1);
    expect(JSON.stringify(lifecycle)).toBe(lifecycleBefore);
    expect(JSON.stringify(bundle)).toBe(bundleBefore);

    const forbidden = /^(disconnect|connected|timeout|browser|transport|network|room|protocol|connection|websocket|automaticdamage|automaticdamageapplication|automaticsba|automaticstatebasedactions|statebasedactions|damageassignment|damageapplication)$/i;
    expect(runtimeKeys(fixture).some((key) => forbidden.test(key))).toBe(false);
    expect(runtimeKeys(bundle).some((key) => forbidden.test(key))).toBe(false);
    expect(Object.keys(Core)).not.toContain('createCoreMultiplayerCombatAssignmentStateV1');
    assertDeepFrozen(lifecycle);
    assertDeepFrozen(bundle);
    expectJsonRoundTrip(lifecycle);
    expectJsonRoundTrip(bundle);
  });
});
