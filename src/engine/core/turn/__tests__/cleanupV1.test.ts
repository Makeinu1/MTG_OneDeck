import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validateModeNeutralCoreObjectRegistrySliceV2 } from '../../object/objectRegistryValidationV2';
import { validateModeNeutralCoreObjectRuntimeSliceV2 } from '../../object/objectRuntimeV2';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../../index';
import type { CoreObjectId, CorePlayerId } from '../../ids';
import {
  applyCoreCleanupStateActionsV1,
  completeCoreCleanupDiscardCheckpointV1,
  startCoreRepeatedCleanupV1,
} from '../cleanupV1';
import type { CoreTurnAdvanceBundleV1 } from '../turnAdvanceV1';

type Raw = Record<string, unknown>;

const P1 = 'P1' as CorePlayerId;
const P2 = 'P2' as CorePlayerId;
const PC41 = 'PC4:1' as CoreObjectId;

function json(url: URL): Raw { return JSON.parse(readFileSync(url, 'utf8')) as Raw; }

function bundle(
  window: CoreTurnAdvanceBundleV1['lifecycle']['window'],
  override: number | 'none' | null = null,
): CoreTurnAdvanceBundleV1 {
  const registryRaw = json(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url));
  const players = registryRaw.players as Raw;
  const active = players[P2] as Raw;
  active.maximumHandSizeOverride = override;
  const registryResult = validateModeNeutralCoreObjectRegistrySliceV2(registryRaw);
  if (!registryResult.ok) throw new Error(JSON.stringify(registryResult.issues));
  const registry = registryResult.value;
  const runtimeRaw = json(new URL('../../fixtures/card-runtime-slice-v1.json', import.meta.url));
  runtimeRaw.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const byObject = runtimeRaw.byObject as Raw;
  byObject['@token:fixture-token:0'] = structuredClone(byObject[PC41]);
  const phased = byObject[PC41] as Raw;
  const orientation = phased.orientation as Raw;
  orientation.phasedOut = true;
  const runtimeResult = validateModeNeutralCoreObjectRuntimeSliceV2(registry, runtimeRaw);
  if (!runtimeResult.ok) throw new Error(JSON.stringify(runtimeResult.issues));
  const announcementsResult = validateModeNeutralCoreStackAnnouncementSliceV1(registry, {
    ...json(new URL('../../stack/fixtures/stack-announcement-v1.json', import.meta.url)),
    kind: 'mode-neutral-core-stack-announcement-slice-v1',
  });
  if (!announcementsResult.ok) throw new Error(JSON.stringify(announcementsResult.issues));
  return {
    stackBundle: {
      objectRegistry: { ...registry, zones: { ...registry.zones, shared: { ...registry.zones.shared, stack: [] } } },
      objectRuntime: runtimeResult.value,
      stackAnnouncements: announcementsResult.value,
    },
    pendingTriggers: { pendingObjectIds: [] },
    lifecycle: {
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1', turnNumber: 3, positionSequence: 2,
      position: { phase: 'ending', step: 'cleanup' }, window,
    },
  };
}

function overfullBundle(override: number | 'none' | null): CoreTurnAdvanceBundleV1 {
  const input = bundle({ kind: 'cleanup-discard-required', playerId: P2, requiredCount: 2 }, override);
  const registry = input.stackBundle.objectRegistry;
  const playerZones = registry.zones.byPlayer[P2];
  const handSource: readonly CoreObjectId[] = [
    ...registry.zones.byPlayer[P1].library,
    ...registry.zones.byPlayer[P1].hand,
    ...registry.zones.byPlayer[P1].graveyard,
    ...registry.zones.shared.battlefield,
    ...registry.zones.shared.exile,
    ...registry.zones.shared.command,
  ];
  const expandedHand: readonly CoreObjectId[] = Array.from(
    { length: 9 },
    (_, index) => handSource[index % handSource.length],
  );
  return {
    ...input,
    stackBundle: {
      ...input.stackBundle,
      objectRegistry: {
        ...registry,
        zones: {
          ...registry.zones,
          byPlayer: { ...registry.zones.byPlayer, [P2]: { ...playerZones, hand: expandedHand } },
        },
      },
    },
  };
}

function thrownCode(action: () => unknown): string {
  try {
    action();
  } catch (error: unknown) {
    if (error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
      return error.code;
    }
  }
  throw new Error('Expected operation to throw');
}

describe('cleanup component V1', () => {
  it('uses null=7, none=0, and numeric overrides, then confirms without card choice', () => {
    const standard = overfullBundle(null);
    expect(standard.lifecycle.window).toEqual({ kind: 'cleanup-discard-required', playerId: P2, requiredCount: 2 });
    expect(thrownCode(() => completeCoreCleanupDiscardCheckpointV1(standard)))
      .toBe('CLEANUP_DISCARD_INCOMPLETE');

    const override = bundle({ kind: 'cleanup-discard-required', playerId: P2, requiredCount: 1 }, 8);
    const registry = override.stackBundle.objectRegistry;
    const hand = registry.zones.byPlayer[P2].hand;
    const withinLimit: CoreTurnAdvanceBundleV1 = {
      ...override,
      stackBundle: {
        ...override.stackBundle,
        objectRegistry: {
          ...registry,
          zones: {
            ...registry.zones,
            byPlayer: { ...registry.zones.byPlayer, [P2]: { ...registry.zones.byPlayer[P2], hand: hand.slice(0, 1) } },
          },
        },
      },
    };
    const confirmed = completeCoreCleanupDiscardCheckpointV1(withinLimit);
    expect(confirmed.lifecycle.window).toEqual({ kind: 'cleanup-state-actions-required', playerId: 'P2' });
    expect(confirmed.lifecycle.positionSequence).toBe(2);
    expect(confirmed.pendingTriggers.pendingObjectIds).toEqual([]);
  });

  it('clears marked damage for phased-out objects while preserving runtime state and mana', () => {
    const input = bundle({ kind: 'cleanup-state-actions-required', playerId: P2 });
    const before = JSON.stringify(input);
    const original = input.stackBundle.objectRuntime.byObject[PC41];
    const output = applyCoreCleanupStateActionsV1(input);
    const updated = output.stackBundle.objectRuntime.byObject[PC41];
    expect(updated.counterDamage.markedDamage).toBe(0);
    expect(updated.counterDamage.counters).toEqual(original.counterDamage.counters);
    expect(updated.orientation).toEqual(original.orientation);
    expect(updated.attachment).toEqual(original.attachment);
    expect(updated.orientation.phasedOut).toBe(true);
    expect(output.lifecycle.window).toEqual({
      kind: 'sba-check-required', priorityRecipientPlayerId: P2, grantPriorityIfStable: false,
    });
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('repeats the cleanup boundary and recalculates a newly overfull hand', () => {
    const input = overfullBundle('none');
    const repeatReady = {
      ...input,
      lifecycle: { ...input.lifecycle, window: { kind: 'cleanup-repeat-ready' as const } },
    };
    const repeated = startCoreRepeatedCleanupV1(repeatReady);
    expect(repeated.lifecycle.position).toEqual({ phase: 'ending', step: 'cleanup' });
    expect(repeated.lifecycle.positionSequence).toBe(3);
    expect(repeated.lifecycle.window).toEqual({ kind: 'cleanup-discard-required', playerId: P2, requiredCount: 9 });
  });

  it('provides no-priority cleanup state-action entry when the hand is within size', () => {
    const input = bundle({ kind: 'cleanup-state-actions-required', playerId: P2 }, 'none');
    const output = applyCoreCleanupStateActionsV1(input);
    expect(output.lifecycle.window.kind).toBe('sba-check-required');
    if (output.lifecycle.window.kind !== 'sba-check-required') throw new Error('wrong cleanup window');
    expect(output.lifecycle.window.grantPriorityIfStable).toBe(false);
  });
});
