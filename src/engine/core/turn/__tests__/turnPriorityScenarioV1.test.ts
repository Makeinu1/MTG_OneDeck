import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../ids';
import { removeCoreStackObjectV1 } from '../../stack/transaction/stackRemovalV1';
import { createModeNeutralCorePendingTriggerSliceV1 } from '../pendingTriggerV1';
import {
  passCorePriorityV1,
  resumeCoreAfterPriorityActionV1,
} from '../priorityPassV1';
import type { CorePriorityPassComponentInputV1 } from '../priorityPassV1';
import { completeCoreResolutionAfterRemovalV1 } from '../resolutionBoundaryV1';
import { applyCoreCleanupStateActionsV1, completeCoreCleanupDiscardCheckpointV1, startCoreRepeatedCleanupV1 } from '../cleanupV1';
import { recordCoreSbaCheckOutcomeV1 } from '../sbaTriggerBoundaryV1';
import {
  analyzeCorePendingTriggerPlacementOnBundleV1,
  placeCorePendingTriggersOnStackV1,
} from '../triggerPlacementV1';
import {
  advanceCoreToNextTurnV1,
  type CoreTurnAdvanceBundleV1,
} from '../turnAdvanceV1';
import type { CoreTurnWindowV1 } from '../turnLifecycleV1';
import {
  createCoreTurnPriorityBundleV1,
} from '../turnPriorityBundleV1';
import type { CoreTurnPriorityBundleV1 } from '../turnPriorityBundleV1';

type FixtureDocument = Readonly<{
  readonly bundle: Parameters<typeof createCoreTurnPriorityBundleV1>[0];
  readonly scenarios: Readonly<{
    readonly triggerPlacement: Readonly<{ readonly chosenBottomToTop: readonly CoreObjectId[] }>;
    readonly deterministicOrder: Readonly<{ readonly objectId: CoreObjectId; readonly analysis: 'deterministic-order' }>;
    readonly priority: Readonly<{
      readonly cycleStartPlayerId: CorePlayerId;
      readonly resolutionReadyObjectId: CoreObjectId;
      readonly emptyPositionWindow: 'position-advance-ready';
    }>;
    readonly cleanup: Readonly<{
      readonly activePlayerId: CorePlayerId;
      readonly discardRequiredCount: number;
      readonly markedDamageObjectId: CoreObjectId;
    }>;
    readonly nextTurn: Readonly<{
      readonly turnNumber: number;
      readonly activePlayerId: CorePlayerId;
    }>;
  }>;
}>;

const P2 = 'P2' as CorePlayerId;
const P3 = 'P3' as CorePlayerId;
const PC3 = 'PC3:0' as CoreObjectId;

function loadFixture(): FixtureDocument {
  const raw: unknown = JSON.parse(readFileSync(
    new URL('../fixtures/turn-priority-lifecycle-v1.json', import.meta.url),
    'utf8',
  ));
  return raw as FixtureDocument;
}

function bundle(): CoreTurnPriorityBundleV1 {
  return createCoreTurnPriorityBundleV1(loadFixture().bundle);
}

function emptyPending(bundleValue: CoreTurnPriorityBundleV1 | CoreTurnAdvanceBundleV1) {
  return createModeNeutralCorePendingTriggerSliceV1(
    bundleValue.stackBundle.objectRegistry,
    { pendingObjectIds: [], byObject: {} },
  );
}

function emptyStack(stackBundle: CoreTurnPriorityBundleV1['stackBundle']) {
  let current = stackBundle;
  const removals: readonly Parameters<typeof removeCoreStackObjectV1>[1][] = [
    { kind: 'cease', objectId: '@triggered-ability:fixture-trigger' },
    { kind: 'cease', objectId: '@activated-ability:fixture-activation' },
    { kind: 'card-to-zone', objectId: 'PC5:1', destination: { kind: 'owner-graveyard' } },
    { kind: 'cease', objectId: '@spell-copy:fixture-copy' },
  ];
  for (const operation of removals) current = removeCoreStackObjectV1(current, operation).bundle;
  return current;
}

function withWindow(
  bundleValue: CoreTurnPriorityBundleV1,
  window: CoreTurnWindowV1,
  position = bundleValue.lifecycle.position,
): CoreTurnPriorityBundleV1 {
  return createCoreTurnPriorityBundleV1({
    stackBundle: bundleValue.stackBundle,
    pendingTriggers: bundleValue.pendingTriggers,
    lifecycle: {
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
      turnNumber: bundleValue.lifecycle.turnNumber,
      positionSequence: bundleValue.lifecycle.positionSequence,
      position,
      window,
    },
  });
}

function priorityComponent(bundleValue: CoreTurnPriorityBundleV1): CorePriorityPassComponentInputV1 {
  return {
    stackBundle: bundleValue.stackBundle,
    lifecycle: bundleValue.lifecycle,
  };
}

function passAll(input: CorePriorityPassComponentInputV1): CorePriorityPassComponentInputV1 {
  let current = input;
  for (let index = 0; index < current.stackBundle.objectRegistry.turnOrder.length
    && current.lifecycle.window.kind === 'priority'; index += 1) {
    current = passCorePriorityV1(current, current.lifecycle.window.holderPlayerId);
  }
  return current;
}

function emptyStackCleanupBundle(): CoreTurnPriorityBundleV1 {
  const initial = bundle();
  const stackBundle = emptyStack(initial.stackBundle);
  return createCoreTurnPriorityBundleV1({
    stackBundle,
    pendingTriggers: emptyPending({ ...initial, stackBundle }),
    lifecycle: {
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
      turnNumber: initial.lifecycle.turnNumber,
      positionSequence: initial.lifecycle.positionSequence,
      position: { phase: 'ending', step: 'cleanup' },
      window: { kind: 'cleanup-state-actions-required', playerId: P2 },
    },
  });
}

function moveP2HandToGraveyard(bundleValue: CoreTurnPriorityBundleV1): CoreTurnPriorityBundleV1 {
  const registry = bundleValue.stackBundle.objectRegistry;
  const p2Zones = registry.zones.byPlayer[P2];
  const objectRegistry = {
    ...registry,
    zones: {
      ...registry.zones,
      byPlayer: {
        ...registry.zones.byPlayer,
        [P2]: { ...p2Zones, hand: [], graveyard: [...p2Zones.graveyard, PC3] },
      },
    },
  };
  return createCoreTurnPriorityBundleV1({
    stackBundle: { ...bundleValue.stackBundle, objectRegistry },
    pendingTriggers: bundleValue.pendingTriggers,
    lifecycle: bundleValue.lifecycle,
  });
}

describe('O4P-01K-J turn priority lifecycle scenarios V1', () => {
  it('runs SBA, manual trigger order, placement, one pass, all-pass resolution, and action reset', () => {
    const fixture = loadFixture();
    const initial = bundle();
    const triggerWindow = recordCoreSbaCheckOutcomeV1(initial, { actionsWereApplied: false });
    const analysis = analyzeCorePendingTriggerPlacementOnBundleV1(triggerWindow);

    expect(triggerWindow.lifecycle.window.kind).toBe('trigger-order-required');
    expect(analysis.kind).toBe('manual-order-required');
    expect(analysis.groups).toHaveLength(4);

    const placed = placeCorePendingTriggersOnStackV1(
      triggerWindow,
      fixture.scenarios.triggerPlacement.chosenBottomToTop,
    );
    expect(placed.pendingTriggers.pendingObjectIds).toEqual([]);
    expect(placed.stackBundle.objectRegistry.zones.shared.stack.slice(-5)).toEqual(
      fixture.scenarios.triggerPlacement.chosenBottomToTop,
    );
    const priorityBundle = recordCoreSbaCheckOutcomeV1(placed, { actionsWereApplied: false });
    expect(priorityBundle.lifecycle.window).toEqual({
      kind: 'priority',
      cycleStartPlayerId: fixture.scenarios.priority.cycleStartPlayerId,
      holderPlayerId: P2,
      passedPlayerIds: [],
    });

    const onePass = passCorePriorityV1(priorityComponent(priorityBundle), P2);
    expect(onePass.lifecycle.window).toEqual({
      kind: 'priority', cycleStartPlayerId: P2, holderPlayerId: P3, passedPlayerIds: [P2],
    });
    const resolutionReady = passAll(onePass);
    expect(resolutionReady.lifecycle.window).toEqual({
      kind: 'resolution-ready',
      objectId: fixture.scenarios.priority.resolutionReadyObjectId,
    });

    const removed = removeCoreStackObjectV1(resolutionReady.stackBundle, {
      kind: 'cease', objectId: fixture.scenarios.priority.resolutionReadyObjectId,
    });
    const afterResolution = completeCoreResolutionAfterRemovalV1(resolutionReady, removed);
    expect(afterResolution.lifecycle.window).toEqual({
      kind: 'sba-check-required', priorityRecipientPlayerId: P2, grantPriorityIfStable: true,
    });

    const reset = resumeCoreAfterPriorityActionV1(priorityComponent(priorityBundle), P2);
    expect(reset.lifecycle.window).toEqual({
      kind: 'sba-check-required', priorityRecipientPlayerId: P2, grantPriorityIfStable: true,
    });
  }, 15000);

  it('covers deterministic order and empty-stack all-pass position advance', () => {
    const fixture = loadFixture();
    const initial = bundle();
    const deterministicId = fixture.scenarios.deterministicOrder.objectId;
    const deterministicPending = createModeNeutralCorePendingTriggerSliceV1(
      initial.stackBundle.objectRegistry,
      {
        pendingObjectIds: [deterministicId],
        byObject: { [deterministicId]: initial.pendingTriggers.byObject[deterministicId] },
      },
    );
    const deterministic = createCoreTurnPriorityBundleV1({
      stackBundle: initial.stackBundle,
      pendingTriggers: deterministicPending,
      lifecycle: initial.lifecycle,
    });
    const analysis = analyzeCorePendingTriggerPlacementOnBundleV1(deterministic);
    expect(analysis.kind).toBe(fixture.scenarios.deterministicOrder.analysis);
    expect(analysis.orderedObjectIds).toEqual([deterministicId]);

    const empty = emptyStackCleanupBundle();
    const nonCleanup = withWindow(
      empty,
      { kind: 'sba-check-required', priorityRecipientPlayerId: P2, grantPriorityIfStable: true },
      { phase: 'precombat-main', step: null },
    );
    const priority = recordCoreSbaCheckOutcomeV1(nonCleanup, { actionsWereApplied: false });
    const ready = passAll(priorityComponent(priority));
    expect(ready.lifecycle.window).toEqual({ kind: 'position-advance-ready' });
  });

  it('runs cleanup discard with max none, exceptional priority, damage clear, repeat, and next-turn rotation', () => {
    const fixture = loadFixture();
    const cleanup = emptyStackCleanupBundle();
    expect(cleanup.stackBundle.objectRegistry.activePlayerId).toBe(fixture.scenarios.cleanup.activePlayerId);
    expect(cleanup.stackBundle.objectRegistry.players[P2].maximumHandSizeOverride).toBe('none');
    const discardRequired = withWindow(cleanup, {
      kind: 'cleanup-discard-required', playerId: P2, requiredCount: fixture.scenarios.cleanup.discardRequiredCount,
    });
    const afterDiscard = completeCoreCleanupDiscardCheckpointV1(moveP2HandToGraveyard(discardRequired));
    expect(afterDiscard.lifecycle.window).toEqual({ kind: 'cleanup-state-actions-required', playerId: P2 });

    const cleanupStateActions = withWindow(cleanup, {
      kind: 'cleanup-state-actions-required', playerId: P2,
    });
    const afterStateActions = applyCoreCleanupStateActionsV1(cleanupStateActions);
    const cleanedRuntime = afterStateActions.stackBundle.objectRuntime.byObject[fixture.scenarios.cleanup.markedDamageObjectId];
    expect(cleanedRuntime.counterDamage.markedDamage).toBe(0);
    expect(cleanedRuntime.counterDamage.counters).toEqual([{ kind: 'shield', count: 1 }]);
    expect(cleanedRuntime.orientation.phasedOut).toBe(true);
    expect(afterStateActions.lifecycle.window).toEqual({
      kind: 'sba-check-required', priorityRecipientPlayerId: P2, grantPriorityIfStable: false,
    });

    const exceptionalSba = recordCoreSbaCheckOutcomeV1(afterStateActions, { actionsWereApplied: true });
    expect(exceptionalSba.lifecycle.window).toEqual({
      kind: 'sba-check-required', priorityRecipientPlayerId: P2, grantPriorityIfStable: true,
    });
    const cleanupPriority = recordCoreSbaCheckOutcomeV1(exceptionalSba, { actionsWereApplied: false });
    const repeatReady = passAll(priorityComponent(cleanupPriority));
    expect(repeatReady.lifecycle.window).toEqual({ kind: 'cleanup-repeat-ready' });

    const repeatBundle = createCoreTurnPriorityBundleV1({
      stackBundle: repeatReady.stackBundle,
      pendingTriggers: exceptionalSba.pendingTriggers,
      lifecycle: repeatReady.lifecycle,
    });
    const repeated = startCoreRepeatedCleanupV1(repeatBundle);
    expect(repeated.lifecycle.position).toEqual({ phase: 'ending', step: 'cleanup' });
    expect(repeated.lifecycle.window).toEqual({
      kind: 'cleanup-discard-required', playerId: P2, requiredCount: fixture.scenarios.cleanup.discardRequiredCount,
    });

    const finalStateActions = applyCoreCleanupStateActionsV1(
      completeCoreCleanupDiscardCheckpointV1(moveP2HandToGraveyard(repeated)),
    );
    const turnReady = recordCoreSbaCheckOutcomeV1(finalStateActions, { actionsWereApplied: false });
    expect(turnReady.lifecycle.window).toEqual({ kind: 'turn-advance-ready' });
    const nextTurn = advanceCoreToNextTurnV1(turnReady);
    expect(nextTurn.lifecycle.turnNumber).toBe(fixture.scenarios.nextTurn.turnNumber);
    expect(nextTurn.stackBundle.objectRegistry.activePlayerId).toBe(fixture.scenarios.nextTurn.activePlayerId);
    expect(nextTurn.lifecycle.position).toEqual({ phase: 'beginning', step: 'untap' });
    expect(nextTurn.lifecycle.window).toEqual({
      kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: P3,
    });
  });
});
