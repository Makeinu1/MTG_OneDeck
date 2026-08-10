import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../../ids';
import type { CoreStackTargetRefV1 } from '../../announcementPrimitivesV1';
import {
  createCoreStackTransactionBundleV1,
  type CoreStackTransactionBundleV1,
  type CreateCoreStackTransactionBundleV1Input,
} from '../stackTransactionBundleV1';
import { retargetCoreStackObjectV1 } from '../stackRetargetV1';
import {
  removeCoreStackObjectV1,
  type CoreStackRemovalInputV1,
} from '../stackRemovalV1';

type Replacement = Readonly<{
  readonly selectionId: string;
  readonly target: CoreStackTargetRefV1;
}>;

type CardRemovalScenario = Extract<CoreStackRemovalInputV1, { readonly kind: 'card-to-zone' }> & Readonly<{
  readonly expectedPreviousObjectId: CoreObjectId;
  readonly expectedNextObjectId: CoreObjectId;
}>;

type FixtureDocument = Readonly<{
  readonly bundle: Readonly<{
    readonly objectRegistry: unknown;
    readonly objectRuntime: unknown;
    readonly stackAnnouncements: unknown;
  }>;
  readonly scenarios: Readonly<{
    readonly retargetOne: Readonly<{ readonly objectId: CoreObjectId; readonly replacements: readonly Replacement[] }>;
    readonly retargetMany: Readonly<{ readonly objectId: CoreObjectId; readonly replacements: readonly Replacement[] }>;
    readonly removeToGraveyard: CardRemovalScenario;
    readonly removeToBattlefield: CardRemovalScenario;
    readonly ceaseKinds: readonly CoreObjectId[];
    readonly middleRemoval: Readonly<{ readonly objectId: CoreObjectId; readonly expectedStack: readonly CoreObjectId[] }>;
    readonly inputUnchanged: true;
  }>;
}>;

function readFixture(): FixtureDocument {
  return JSON.parse(
    readFileSync(new URL('../fixtures/stack-transaction-v1.json', import.meta.url), 'utf8'),
  ) as FixtureDocument;
}

function fixtureBundle(fixture: FixtureDocument): CoreStackTransactionBundleV1 {
  return createCoreStackTransactionBundleV1(
    fixture.bundle as unknown as CreateCoreStackTransactionBundleV1Input,
  );
}

describe('O4P-01J-K transaction scenarios V1', () => {
  it('retargets one and many targets while preserving all unrelated announcement decisions', () => {
    const fixture = readFixture();
    for (const scenario of [fixture.scenarios.retargetOne, fixture.scenarios.retargetMany]) {
      const bundle = fixtureBundle(fixture);
      const before = JSON.stringify(bundle);
      const previous = bundle.stackAnnouncements.byObject[scenario.objectId];
      if (previous === undefined) throw new Error(`missing retarget announcement ${scenario.objectId}`);
      const result = retargetCoreStackObjectV1(bundle, scenario);
      const next = result.bundle.stackAnnouncements.byObject[scenario.objectId];
      if (next === undefined) throw new Error(`missing retarget result ${scenario.objectId}`);

      const expectedTargets = new Map(scenario.replacements.map((replacement) => [replacement.selectionId, replacement.target]));
      expect(next.targetSelections).toHaveLength(previous.targetSelections.length);
      expect(next.targetSelections.map((selection) => selection.selectionId)).toEqual(
        previous.targetSelections.map((selection) => selection.selectionId),
      );
      expect(next.targetSelections.map((selection) => expectedTargets.get(selection.selectionId) ?? selection.target)).toEqual(
        next.targetSelections.map((selection) => selection.target),
      );
      expect(next.chosenModeKeys).toEqual(previous.chosenModeKeys);
      expect(next.announcedVariables).toEqual(previous.announcedVariables);
      expect(next.distributions).toEqual(previous.distributions);
      expect(next.costChoices).toEqual(previous.costChoices);
      expect(result.bundle.objectRegistry).toEqual(bundle.objectRegistry);
      expect(result.bundle.objectRuntime).toEqual(bundle.objectRuntime);
      if (fixture.scenarios.inputUnchanged) expect(JSON.stringify(bundle)).toBe(before);
    }
  });

  it.each([
    ['owner graveyard', 'removeToGraveyard'],
    ['battlefield', 'removeToBattlefield'],
  ] as const)('removes a middle card to %s with the expected old/new IDs', (_label, scenarioKey) => {
    const fixture = readFixture();
    const bundle = fixtureBundle(fixture);
    const before = JSON.stringify(bundle);
    const scenario = fixture.scenarios[scenarioKey];
    const previousObjectId: CoreObjectId = scenario.expectedPreviousObjectId;
    const nextObjectId: CoreObjectId = scenario.expectedNextObjectId;
    const operation: CoreStackRemovalInputV1 = {
      kind: scenario.kind,
      objectId: scenario.objectId,
      destination: scenario.destination,
    };
    const result = removeCoreStackObjectV1(bundle, operation);

    expect(result.removedObjectId).toBe(previousObjectId);
    expect(result.nextObjectId).toBe(nextObjectId);
    expect(result.bundle.objectRegistry.zones.shared.stack).toEqual(
      fixture.scenarios.middleRemoval.expectedStack,
    );
    expect(result.bundle.objectRegistry.objects[previousObjectId]).toBeUndefined();
    expect(result.bundle.objectRegistry.objects[nextObjectId]).toMatchObject({
      kind: 'card',
      physicalCardId: 'PC5',
      incarnation: 2,
    });
    expect(result.bundle.objectRuntime.byObject[previousObjectId]).toBeUndefined();
    expect(result.bundle.objectRuntime.byObject[nextObjectId]).toEqual({
      orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false },
      counterDamage: { counters: [], markedDamage: 0 },
      attachment: { attachedTo: null },
    });
    expect(result.bundle.objectRegistry.objects[nextObjectId]).toHaveProperty('kind', 'card');
    if (scenario.destination.kind === 'owner-graveyard') {
      expect(result.bundle.objectRegistry.zones.byPlayer['P4' as CorePlayerId].graveyard).toContain('PC5:2');
      expect(result.bundle.objectRegistry.objects[nextObjectId]).toHaveProperty('baseControllerPlayerId', null);
    } else {
      expect(result.bundle.objectRegistry.zones.shared.battlefield).toContain('PC5:2');
      expect(result.bundle.objectRegistry.objects[nextObjectId]).toHaveProperty('baseControllerPlayerId', 'P4');
    }
    if (fixture.scenarios.inputUnchanged) expect(JSON.stringify(bundle)).toBe(before);
  });

  it.each(['@spell-copy:fixture-copy', '@activated-ability:fixture-activation', '@triggered-ability:fixture-trigger'] as const)(
    'ceases synthetic stack object %s without a Runtime mutation',
    (objectIdValue) => {
      const fixture = readFixture();
      const bundle = fixtureBundle(fixture);
      const objectId = objectIdValue as CoreObjectId;
      const before = JSON.stringify(bundle);
      const runtimeBefore = JSON.stringify(bundle.objectRuntime);
      const result = removeCoreStackObjectV1(bundle, { kind: 'cease', objectId });

      expect(result.removedObjectId).toBe(objectId);
      expect(result.nextObjectId).toBeNull();
      expect(result.bundle.objectRegistry.objects[objectId]).toBeUndefined();
      expect(result.bundle.stackAnnouncements.byObject[objectId]).toBeUndefined();
      expect(JSON.stringify(result.bundle.objectRuntime)).toBe(runtimeBefore);
      if (fixture.scenarios.inputUnchanged) expect(JSON.stringify(bundle)).toBe(before);
    },
  );
});
