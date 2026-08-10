import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../ids';
import {
  createCoreTurnPriorityBundleV1,
  validateCoreTurnPriorityBundleV1,
} from '../turnPriorityBundleV1';
import type { CoreTurnPriorityBundleV1 } from '../turnPriorityBundleV1';

type FixtureGroup = Readonly<{
  readonly stackPlacementBucket: 'ordinary' | 'ability-triggered';
  readonly controllerPlayerId: CorePlayerId;
  readonly pendingObjectIds: readonly CoreObjectId[];
}>;

type FixtureDocument = Readonly<{
  readonly kind: string;
  readonly bundle: Parameters<typeof createCoreTurnPriorityBundleV1>[0];
  readonly scenarios: Readonly<{
    readonly upkeepSbaBoundary: Readonly<{
      readonly activePlayerId: CorePlayerId;
      readonly position: Readonly<{ readonly phase: 'beginning'; readonly step: 'upkeep' }>;
      readonly window: 'sba-check-required';
    }>;
    readonly mixedStack: readonly CoreObjectId[];
    readonly triggerPlacement: Readonly<{
      readonly analysis: 'manual-order-required';
      readonly groups: readonly FixtureGroup[];
      readonly chosenBottomToTop: readonly CoreObjectId[];
    }>;
    readonly deterministicOrder: Readonly<{
      readonly objectId: CoreObjectId;
      readonly analysis: 'deterministic-order';
    }>;
    readonly priority: Readonly<{
      readonly cycleStartPlayerId: CorePlayerId;
      readonly resolutionReadyObjectId: CoreObjectId;
      readonly emptyPositionWindow: 'position-advance-ready';
    }>;
    readonly cleanup: Readonly<{
      readonly activePlayerId: CorePlayerId;
      readonly maximumHandSizeOverride: 'none';
      readonly discardRequiredCount: number;
      readonly markedDamageObjectId: CoreObjectId;
      readonly exceptionalPriority: true;
      readonly repeatedCleanup: true;
    }>;
    readonly nextTurn: Readonly<{
      readonly turnNumber: number;
      readonly activePlayerId: CorePlayerId;
      readonly position: Readonly<{ readonly phase: 'beginning'; readonly step: 'untap' }>;
      readonly window: 'turn-based-action-required';
    }>;
  }>;
}>;

function loadFixture(): FixtureDocument {
  const raw: unknown = JSON.parse(readFileSync(
    new URL('../fixtures/turn-priority-lifecycle-v1.json', import.meta.url),
    'utf8',
  ));
  return raw as FixtureDocument;
}

function loadBundle(): CoreTurnPriorityBundleV1 {
  return createCoreTurnPriorityBundleV1(loadFixture().bundle);
}

describe('O4P-01K-J turn priority lifecycle fixture V1', () => {
  it('round-trips and validates the public bundle with a four-player upkeep boundary', () => {
    const fixture = loadFixture();
    const before = JSON.stringify(fixture.bundle);
    const validation = validateCoreTurnPriorityBundleV1(fixture.bundle);
    expect(validation.ok).toBe(true);
    const bundle = loadBundle();

    expect(fixture.kind).toBe('o4p-01k-j-turn-priority-lifecycle-fixture-v1');
    expect(JSON.stringify(fixture.bundle)).toBe(before);
    expect(Object.keys(bundle.stackBundle.objectRegistry.players)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(bundle.stackBundle.objectRegistry.activePlayerId).toBe(fixture.scenarios.upkeepSbaBoundary.activePlayerId);
    expect(bundle.lifecycle.position).toEqual(fixture.scenarios.upkeepSbaBoundary.position);
    expect(bundle.lifecycle.window).toEqual({
      kind: 'sba-check-required',
      priorityRecipientPlayerId: 'P2',
      grantPriorityIfStable: true,
    });
    expect(bundle.stackBundle.objectRegistry.zones.shared.stack).toEqual(fixture.scenarios.mixedStack);
    expect(bundle.pendingTriggers.pendingObjectIds).toHaveLength(5);
    expect(bundle.stackBundle.objectRuntime.byObject[fixture.scenarios.cleanup.markedDamageObjectId].counterDamage.markedDamage)
      .toBe(3);
    expect(Object.isFrozen(bundle)).toBe(true);
  });

  it('pins the fixture’s APNAP groups, buckets, and lifecycle scenario metadata', () => {
    const fixture = loadFixture();
    const groups = fixture.scenarios.triggerPlacement.groups;

    expect(groups).toEqual([
      {
        stackPlacementBucket: 'ordinary',
        controllerPlayerId: 'P2',
        pendingObjectIds: [
          '@triggered-ability:fixture-ordinary-p2-a',
          '@triggered-ability:fixture-ordinary-p2-b',
        ],
      },
      {
        stackPlacementBucket: 'ordinary',
        controllerPlayerId: 'P4',
        pendingObjectIds: ['@triggered-ability:fixture-ordinary-p4'],
      },
      {
        stackPlacementBucket: 'ability-triggered',
        controllerPlayerId: 'P3',
        pendingObjectIds: ['@triggered-ability:fixture-ability-p3'],
      },
      {
        stackPlacementBucket: 'ability-triggered',
        controllerPlayerId: 'P1',
        pendingObjectIds: ['@triggered-ability:fixture-ability-p1'],
      },
    ]);
    expect(fixture.scenarios.triggerPlacement.analysis).toBe('manual-order-required');
    expect(fixture.scenarios.deterministicOrder.analysis).toBe('deterministic-order');
    expect(fixture.scenarios.cleanup.maximumHandSizeOverride).toBe('none');
    expect(fixture.scenarios.cleanup.discardRequiredCount).toBe(1);
    expect(fixture.scenarios.cleanup.exceptionalPriority).toBe(true);
    expect(fixture.scenarios.cleanup.repeatedCleanup).toBe(true);
    expect(fixture.scenarios.nextTurn).toEqual({
      turnNumber: 5,
      activePlayerId: 'P3',
      position: { phase: 'beginning', step: 'untap' },
      window: 'turn-based-action-required',
    });
  });
});
