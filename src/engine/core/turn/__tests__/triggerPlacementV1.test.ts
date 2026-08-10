import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createCoreStackTransactionBundleV1 } from '../../index';
import { createModeNeutralCorePendingTriggerSliceV1 } from '../pendingTriggerV1';
import type { CoreObjectId, CorePlayerId } from '../../ids';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import { recordCoreSbaCheckOutcomeV1 } from '../sbaTriggerBoundaryV1';
import { createCoreTurnPriorityBundleV1 } from '../turnPriorityBundleV1';
import { appendCorePendingTriggeredAbilitiesToBundleV1, placeCorePendingTriggersOnStackV1 } from '../triggerPlacementV1';

type Raw = Record<string, unknown>;

function fixture(path: string): Raw {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Raw;
}

function stackBundle() {
  const runtime = fixture('../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  (runtime.byObject as Raw)['@token:fixture-token:0'] = structuredClone((runtime.byObject as Raw)['PC4:1']);
  const announcements = fixture('../../stack/fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  return createCoreStackTransactionBundleV1({
    objectRegistry: fixture('../../object/fixtures/object-registry-v2.json'),
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  } as unknown as Parameters<typeof createCoreStackTransactionBundleV1>[0]);
}

function initial() {
  const stack = stackBundle();
  const pending = createModeNeutralCorePendingTriggerSliceV1(stack.objectRegistry, { pendingObjectIds: [], byObject: {} });
  const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: 1,
    positionSequence: 0,
    position: { phase: 'precombat-main', step: null },
    window: { kind: 'sba-check-required', priorityRecipientPlayerId: 'P2' as CorePlayerId, grantPriorityIfStable: true },
  });
  return createCoreTurnPriorityBundleV1({ stackBundle: stack, pendingTriggers: pending, lifecycle });
}

function addition(objectId: string, abilityKey: string) {
  return {
    objectId: objectId as CoreObjectId,
    stackPlacementBucket: 'ordinary' as const,
    object: { kind: 'triggered-ability' as const, controllerPlayerId: 'P2' as CorePlayerId, sourceObjectId: null, abilityKey },
    announcement: {
      kind: 'triggered-ability' as const,
      abilityTextSnapshot: `When ${abilityKey} triggers.`,
      chosenModeKeys: [], targetSelections: [], announcedVariables: [], distributions: [],
      costChoices: { alternativeCost: null, additionalCosts: [] },
    },
  } as unknown as Parameters<typeof appendCorePendingTriggeredAbilitiesToBundleV1>[1][number];
}

describe('placeCorePendingTriggersOnStackV1', () => {
  it('commits bottom-to-top order and returns to SBA with the same recipient', () => {
    const a = '@triggered-ability:placement-a';
    const b = '@triggered-ability:placement-b';
    const pending = appendCorePendingTriggeredAbilitiesToBundleV1(initial(), [addition(a, 'a'), addition(b, 'b')]);
    const triggerWindow = recordCoreSbaCheckOutcomeV1(pending, { actionsWereApplied: false });
    const placed = placeCorePendingTriggersOnStackV1(triggerWindow, [b, a] as CoreObjectId[]);
    expect(placed.stackBundle.objectRegistry.zones.shared.stack.slice(-2)).toEqual([b, a]);
    expect(placed.pendingTriggers.pendingObjectIds).toEqual([]);
    expect(placed.lifecycle.window).toEqual({ kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: true });
  });

  it('rejects duplicate/order-crossing input before commit and preserves the input', () => {
    const a = '@triggered-ability:placement-c';
    const pending = appendCorePendingTriggeredAbilitiesToBundleV1(initial(), [addition(a, 'c')]);
    const triggerWindow = recordCoreSbaCheckOutcomeV1(pending, { actionsWereApplied: false });
    const before = JSON.stringify(triggerWindow);
    expect(() => placeCorePendingTriggersOnStackV1(triggerWindow, [a, a] as CoreObjectId[])).toThrowError(
      expect.objectContaining({ code: 'TRIGGER_ORDER_INVALID' }),
    );
    expect(JSON.stringify(triggerWindow)).toBe(before);
  });
});
