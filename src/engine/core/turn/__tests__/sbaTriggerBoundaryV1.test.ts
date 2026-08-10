import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createCoreStackTransactionBundleV1 } from '../../stack/transaction/stackTransactionBundleV1';
import { removeCoreStackObjectV1 } from '../../stack/transaction/stackRemovalV1';
import type { CoreObjectId, CorePlayerId } from '../../ids';
import { createModeNeutralCorePendingTriggerSliceV1 } from '../pendingTriggerV1';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import { recordCoreSbaCheckOutcomeV1 } from '../sbaTriggerBoundaryV1';
import { createCoreTurnPriorityBundleV1 } from '../turnPriorityBundleV1';

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

function emptyStackBundle() {
  let current = stackBundle();
  for (const operation of [
    { kind: 'cease', objectId: '@triggered-ability:fixture-trigger' },
    { kind: 'cease', objectId: '@activated-ability:fixture-activation' },
    { kind: 'cease', objectId: '@spell-copy:fixture-copy' },
    { kind: 'card-to-zone', objectId: 'PC5:1', destination: { kind: 'owner-graveyard' } },
  ] as const) {
    current = removeCoreStackObjectV1(current, operation).bundle;
  }
  return current;
}

function pending(stack: ReturnType<typeof stackBundle>, id = '@triggered-ability:sba-trigger') {
  const objectId = id as CoreObjectId;
  return createModeNeutralCorePendingTriggerSliceV1(stack.objectRegistry, {
    pendingObjectIds: [objectId],
    byObject: {
      [objectId]: {
        stackPlacementBucket: 'ordinary',
        object: { kind: 'triggered-ability', controllerPlayerId: 'P2' as CorePlayerId, sourceObjectId: null, abilityKey: 'sba-trigger' },
        announcement: {
          kind: 'triggered-ability', abilityTextSnapshot: 'When this triggers.', chosenModeKeys: [],
          targetSelections: [], announcedVariables: [], distributions: [],
          costChoices: { alternativeCost: null, additionalCosts: [] },
        },
      },
    },
  } as unknown as Parameters<typeof createModeNeutralCorePendingTriggerSliceV1>[1]);
}

function makeBundle(
  window: Raw,
  pendingTriggers: ReturnType<typeof createModeNeutralCorePendingTriggerSliceV1> | undefined = undefined,
  position: Raw = { phase: 'precombat-main', step: null },
  stack = stackBundle(),
) {
  const pendingSlice = pendingTriggers ?? createModeNeutralCorePendingTriggerSliceV1(stack.objectRegistry, { pendingObjectIds: [], byObject: {} });
  const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: 1,
    positionSequence: 0,
    position: position as never,
    window: window as never,
  });
  return createCoreTurnPriorityBundleV1({ stackBundle: stack, pendingTriggers: pendingSlice, lifecycle });
}

describe('recordCoreSbaCheckOutcomeV1', () => {
  it('keeps SBA after applied actions and elevates cleanup false to true', () => {
    const value = makeBundle(
      { kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: false },
      undefined,
      { phase: 'ending', step: 'cleanup' },
    );
    const result = recordCoreSbaCheckOutcomeV1(value, { actionsWereApplied: true });
    expect(result.lifecycle.window).toEqual({ kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: true });
  });

  it('enters trigger ordering, priority, and turn advance at the exact fixed point', () => {
    const stack = stackBundle();
    const triggerWindow = recordCoreSbaCheckOutcomeV1(
      makeBundle({ kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: true }, pending(stack)),
      { actionsWereApplied: false },
    );
    expect(triggerWindow.lifecycle.window.kind).toBe('trigger-order-required');

    const priority = recordCoreSbaCheckOutcomeV1(
      makeBundle({ kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: true }),
      { actionsWereApplied: false },
    );
    expect(priority.lifecycle.window).toEqual({ kind: 'priority', cycleStartPlayerId: 'P2', holderPlayerId: 'P2', passedPlayerIds: [] });

    const advance = makeBundle(
      { kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: false },
      undefined,
      { phase: 'ending', step: 'cleanup' },
      emptyStackBundle(),
    );
    expect(recordCoreSbaCheckOutcomeV1(advance, { actionsWereApplied: false }).lifecycle.window.kind).toBe('turn-advance-ready');
  });
});
