import { describe, expect, it } from 'vitest';

import * as Core from '../index';

const commanders = [
  { physicalCardId: 'C1', ownerPlayerId: 'P1' },
  { physicalCardId: 'C2', ownerPlayerId: 'P2' },
  { physicalCardId: 'C3', ownerPlayerId: 'P3' },
  { physicalCardId: 'C4', ownerPlayerId: 'P4' },
] as const;

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) assertDeepFrozen(descriptor.value, seen);
  }
}

function runtimeKeys(value: unknown, found: string[] = []): string[] {
  if (value === null || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    found.push(key);
    runtimeKeys(child, found);
  }
  return found;
}

describe('O4P-01M Commander, combat, and player-exit acceptance pins', () => {
  it('pins four physical Commander identities, replacement choices, and command-zone-only tax', () => {
    const identities = commanders.map((input) => Core.createCoreCommanderIdentityV1(input));
    expect(identities).toEqual(commanders);
    identities.forEach((identity) => assertDeepFrozen(identity));

    expect(() => Core.createCoreCommanderIdentityV1({
      ...commanders[0],
      displayName: 'same-name-is-not-identity',
    })).toThrow(Core.CoreCommanderIdentityCreationErrorV1);
    expect(() => Core.createCoreCommanderDamageStateV1({
      commanders: [commanders[0], commanders[0]],
      defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'],
      entries: [],
    })).toThrow(Core.CoreCommanderDamageCreationErrorV1);

    const graveyard = Core.createCoreCommanderReplacementChoiceV1({
      kind: 'commander-replacement-903.9a',
      sourceZone: 'graveyard',
    });
    const library = Core.createCoreCommanderReplacementChoiceV1({
      kind: 'commander-replacement-903.9b',
      sourceZone: 'library',
    });
    expect(graveyard).toEqual({ kind: 'commander-replacement-903.9a', sourceZone: 'graveyard' });
    expect(library).toEqual({ kind: 'commander-replacement-903.9b', sourceZone: 'library' });
    expect(() => Core.createCoreCommanderReplacementChoiceV1({
      kind: 'commander-replacement-903.9a',
      sourceZone: 'library',
    })).toThrow(Core.CoreCommanderReplacementChoiceCreationErrorV1);

    const initial = Core.createCoreCommanderCastLedgerV1({ commander: commanders[0], castCount: 0 });
    expect(() => Core.createCoreCommanderCastLedgerV1({ commander: commanders[0], castCount: -0 }))
      .toThrow(Core.CoreCommanderCastLedgerCreationErrorV1);
    const once = Core.recordCoreCommanderCastV1(initial, { origin: 'command-zone' });
    const twice = Core.recordCoreCommanderCastV1(once, { origin: 'command-zone' });
    expect([initial.castCount, once.castCount, twice.castCount]).toEqual([0, 1, 2]);
    expect([Core.coreCommanderTaxV1(initial), Core.coreCommanderTaxV1(once), Core.coreCommanderTaxV1(twice)])
      .toEqual([0, 2, 4]);
    for (const origin of ['other-zone', 'copy'] as const) {
      expect(() => Core.recordCoreCommanderCastV1(twice, { origin }))
        .toThrow(Core.CoreCommanderCastRecordingErrorV1);
      expect(twice.castCount).toBe(2);
    }
  });

  it('pins independent Commander/defender cells and provenance-gated threshold', () => {
    const initial = Core.createCoreCommanderDamageStateV1({
      commanders,
      defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'],
      entries: [],
    });
    const recorded = [
      ['C1', 'P2', 7],
      ['C2', 'P2', 9],
      ['C1', 'P3', 11],
      ['C2', 'P3', 13],
    ].reduce((state, [commanderPhysicalCardId, defendingPlayerId, damage]) =>
      Core.recordCoreCommanderDamageV1(state, {
        commanderPhysicalCardId,
        defendingPlayerId,
        damage,
      }), initial);
    expect([
      Core.coreCommanderDamageAgainstV1(recorded, 'C1', 'P2'),
      Core.coreCommanderDamageAgainstV1(recorded, 'C2', 'P2'),
      Core.coreCommanderDamageAgainstV1(recorded, 'C1', 'P3'),
      Core.coreCommanderDamageAgainstV1(recorded, 'C2', 'P3'),
      Core.coreCommanderDamageAgainstV1(recorded, 'C3', 'P4'),
    ]).toEqual([7, 9, 11, 13, 0]);

    const provenance = Core.createCoreCommanderDamageProvenanceLedgerV1({
      commanders,
      defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'],
      records: [
        { combatObjectId: 'PC1:0', commanderPhysicalCardId: 'C1', defendingPlayerId: 'P2', damage: 10 },
        { combatObjectId: 'PC2:0', commanderPhysicalCardId: 'C1', defendingPlayerId: 'P2', damage: 11 },
        { combatObjectId: 'PC3:0', commanderPhysicalCardId: 'C2', defendingPlayerId: 'P2', damage: 20 },
      ],
    });
    expect(Core.coreCommanderProvenanceDamageAgainstV1(provenance, 'C1', 'P2')).toBe(21);
    expect(Core.coreCommanderThresholdReachedFromProvenanceV1(provenance, 'C1', 'P2')).toBe(true);
    expect(Core.coreCommanderThresholdReachedFromProvenanceV1(provenance, 'C2', 'P2')).toBe(false);
    expect(Core.coreCommanderThresholdReachedFromProvenanceV1(provenance, 'C1', 'P3')).toBe(false);
    expect(() => Core.createCoreCommanderDamageProvenanceLedgerV1({
      commanders,
      defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'],
      records: [
        { combatObjectId: 'PC1:0', commanderPhysicalCardId: 'C1', defendingPlayerId: 'P2', damage: -0 },
      ],
    })).toThrow(Core.CoreCommanderProvenanceCreationErrorV1);

    expect(() => Core.createCoreCommanderDamageProvenanceLedgerV1({
      commanders,
      defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'],
      records: [
        { combatObjectId: 'PC1:0', commanderPhysicalCardId: 'C1', defendingPlayerId: 'P2', damage: Number.MAX_SAFE_INTEGER },
        { combatObjectId: 'PC2:0', commanderPhysicalCardId: 'C1', defendingPlayerId: 'P2', damage: 1 },
      ],
    })).toThrow(Core.CoreCommanderProvenanceCreationErrorV1);

    const saturated = Core.createCoreCommanderDamageProvenanceLedgerV1({
      commanders,
      defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'],
      records: [
        { combatObjectId: 'PC1:0', commanderPhysicalCardId: 'C1', defendingPlayerId: 'P2', damage: Number.MAX_SAFE_INTEGER },
      ],
    });
    const independent = Core.recordCoreCommanderDamageProvenanceV1(saturated, {
      combatObjectId: 'PC4:0', commanderPhysicalCardId: 'C2', defendingPlayerId: 'P3', damage: 1,
    });
    expect(Core.coreCommanderProvenanceDamageAgainstV1(independent, 'C1', 'P2'))
      .toBe(Number.MAX_SAFE_INTEGER);
    expect(Core.coreCommanderProvenanceDamageAgainstV1(independent, 'C2', 'P3')).toBe(1);
    assertDeepFrozen(recorded);
    assertDeepFrozen(provenance);
    assertDeepFrozen(independent);
  });

  it('pins ordered multi-defender combat and multi-blocker structure without damage automation', () => {
    const initial = Core.createCoreCombatContextV1({
      combatId: 'combat-acceptance-1',
      turnNumber: 4,
      step: 'declare-attackers',
      attackingPlayerId: 'P1',
      defendingPlayerIds: ['P3', 'P2', 'P4'],
      attacks: [],
      blocks: [],
    });
    const attackedP3 = Core.addCoreCombatContextAttackV1(initial, {
      attackerObjectId: 'PC1:0', attackerControllerPlayerId: 'P1', defendingPlayerId: 'P3',
    });
    expect(() => Core.addCoreCombatContextAttackV1(attackedP3, {
      attackerObjectId: 'PC1:0', attackerControllerPlayerId: 'P1', defendingPlayerId: 'P2',
    })).toThrow(Core.CoreCombatContextAdditionErrorV1);
    const attackedP2 = Core.addCoreCombatContextAttackV1(attackedP3, {
      attackerObjectId: 'PC4:0', attackerControllerPlayerId: 'P1', defendingPlayerId: 'P2',
    });
    const blockerStep = Core.setCoreCombatContextStepV1(attackedP2, 'declare-blockers');
    const oneBlocker = Core.addCoreCombatContextBlockV1(blockerStep, {
      attackedObjectId: 'PC1:0', blockerObjectId: 'PC2:0',
      blockerControllerPlayerId: 'P3', defendingPlayerId: 'P3',
    });
    const final = Core.addCoreCombatContextBlockV1(oneBlocker, {
      attackedObjectId: 'PC4:0', blockerObjectId: 'PC3:0',
      blockerControllerPlayerId: 'P2', defendingPlayerId: 'P2',
    });
    expect(() => Core.addCoreCombatContextBlockV1(final, {
      attackedObjectId: 'PC4:0', blockerObjectId: 'PC2:0',
      blockerControllerPlayerId: 'P2', defendingPlayerId: 'P2',
    })).toThrow(Core.CoreCombatContextAdditionErrorV1);

    const maximumSparse: unknown[] = [];
    maximumSparse.length = 0xffffffff;
    expect(() => Core.createCoreCombatContextV1({
      ...initial,
      defendingPlayerIds: maximumSparse,
    })).toThrow(Core.CoreCombatContextCreationErrorV1);

    expect(final.defendingPlayerIds).toEqual(['P3', 'P2', 'P4']);
    expect(final.attacks.map((entry) => entry.defendingPlayerId)).toEqual(['P3', 'P2']);
    expect(final.blocks.map((entry) => entry.blockerObjectId)).toEqual(['PC2:0', 'PC3:0']);
    expect(Object.keys(final)).toEqual([
      'combatId', 'turnNumber', 'step', 'attackingPlayerId', 'defendingPlayerIds', 'attacks', 'blocks',
    ]);
    const afterP3Exit = Core.reconcileCoreCombatContextForPlayerExitV1(final, {
      exitingPlayerId: 'P3',
      participantObjectIdsToClear: [],
    });
    expect(afterP3Exit?.attacks.map((entry) => entry.attackerObjectId)).toEqual(['PC4:0']);
    expect(afterP3Exit?.blocks.map((entry) => entry.blockerObjectId)).toEqual(['PC3:0']);
    expect(Core.reconcileCoreCombatContextForPlayerExitV1(final, {
      exitingPlayerId: 'P1',
      participantObjectIdsToClear: [],
    })).toBeNull();
    expect(runtimeKeys(final)).not.toEqual(expect.arrayContaining([
      'damageAssignment', 'automaticDamage', 'stateBasedActions',
    ]));
    assertDeepFrozen(final);
  });

  it('pins concession/defeat distinction and deterministic player-exit cleanup without disconnect authority', () => {
    const lifecycle = Core.createCorePlayerLifecycleStateV1({
      players: ['P4', 'P1', 'P3', 'P2'].map((playerId) => ({
        playerId,
        status: 'active',
        exitCause: null,
      })),
    });
    const conceded = Core.applyCorePlayerExitV1(lifecycle, { playerId: 'P1', cause: 'concession' });
    const finalLifecycle = Core.applyCorePlayerExitV1(conceded, { playerId: 'P2', cause: 'defeat' });
    expect(finalLifecycle.players.map((entry) => entry.playerId)).toEqual(['P4', 'P1', 'P3', 'P2']);
    expect(Core.corePlayerLifecycleStatusV1(finalLifecycle, 'P1')).toBe('exited');
    expect(Core.corePlayerLifecycleStatusV1(finalLifecycle, 'P2')).toBe('exited');
    expect(Core.corePlayerLifecycleExitCauseV1(finalLifecycle, 'P1')).toBe('concession');
    expect(Core.corePlayerLifecycleExitCauseV1(finalLifecycle, 'P2')).toBe('defeat');

    const input = {
      turnOrder: ['P4', 'P1', 'P3', 'P2'],
      eligiblePlayerIds: ['P3', 'P2', 'P4'],
      activePlayerId: 'P1',
      priorityHolderPlayerId: 'P1',
      ownedObjectIds: ['PC1:0', '@token:owned:0'],
      controlledObjectIds: ['PC2:0', 'PC1:0', '@triggered-ability:stack-a'],
      nonCardStackObjectIds: ['@triggered-ability:stack-a'],
      combatParticipantObjectIds: ['PC1:0', 'PC3:0'],
      controlEffectIds: ['control-a'],
      decisionAuthorityIds: ['decision-a'],
      searchSessionIds: ['search-a'],
    };
    const before = structuredClone(input);
    const bundle = Core.createCorePlayerExitReferenceBundleV1(input);
    expect(() => Core.createCorePlayerExitReferenceBundleV1({
      ...input,
      searchSessionIds: ['constructor'],
    })).toThrow(Core.CorePlayerExitReconciliationErrorV1);
    const maximumSparsePlayers: unknown[] = [];
    maximumSparsePlayers.length = 0xffffffff;
    expect(() => Core.createCorePlayerLifecycleStateV1({ players: maximumSparsePlayers }))
      .toThrow(Core.CorePlayerLifecycleErrorV1);
    const result = Core.reconcileCorePlayerExitV1(lifecycle, bundle, {
      playerId: 'P1',
      cause: 'concession',
    });
    expect(input).toEqual(before);
    expect(result).toEqual({
      lifecycleState: conceded,
      survivingTurnOrder: ['P4', 'P3', 'P2'],
      activePlayerAfterExit: null,
      priorityHandoffPlayerId: 'P3',
      ownedObjectsToLeaveGame: ['PC1:0', '@token:owned:0'],
      controlEffectIdsToEnd: ['control-a'],
      nonCardStackObjectsToCease: ['@triggered-ability:stack-a'],
      controlledObjectsToExile: ['PC2:0'],
      combatParticipantObjectIdsToClear: ['PC1:0', 'PC3:0'],
      decisionAuthorityIdsToClear: ['decision-a'],
      searchSessionIdsToClose: ['search-a'],
    });
    const forbidden = new Set(['disconnect', 'connection', 'transport', 'roomId', 'participantId']);
    expect(runtimeKeys([finalLifecycle, bundle, result]).filter((key) => forbidden.has(key))).toEqual([]);
    expect(runtimeKeys(bundle)).toContain('searchSessionIds');
    assertDeepFrozen(finalLifecycle);
    assertDeepFrozen(bundle);
    assertDeepFrozen(result);
  });
});
