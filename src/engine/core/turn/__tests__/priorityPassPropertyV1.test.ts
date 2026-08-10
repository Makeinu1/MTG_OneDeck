import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import type { CoreObjectId, CorePlayerId } from '../../ids';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import { passCorePriorityV1 } from '../priorityPassV1';
import type { CorePriorityPassComponentInputV1 } from '../priorityPassV1';
import { createCoreStackTransactionBundleV1, removeCoreStackObjectV1 } from '../../stack/transaction';
import type { CoreStackTransactionBundleV1 } from '../../stack/transaction/stackTransactionBundleV1';

const PLAYERS = ['P1', 'P2', 'P3', 'P4'] as const;
type Raw = Record<string, unknown>;

function fixture(path: string): Raw {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Raw;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyStackBundle(): CoreStackTransactionBundleV1 {
  const runtime = fixture('../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as Raw;
  runtimeByObject['@token:fixture-token:0'] = clone(runtimeByObject['PC4:1']);
  const announcements = fixture('../../stack/fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  const input = {
    objectRegistry: fixture('../../object/fixtures/object-registry-v2.json'),
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  } as unknown as Parameters<typeof createCoreStackTransactionBundleV1>[0];
  let current = createCoreStackTransactionBundleV1(input);
  for (const operation of [
    { kind: 'cease', objectId: '@triggered-ability:fixture-trigger' as CoreObjectId },
    { kind: 'cease', objectId: '@activated-ability:fixture-activation' as CoreObjectId },
    { kind: 'cease', objectId: '@spell-copy:fixture-copy' as CoreObjectId },
    { kind: 'card-to-zone', objectId: 'PC5:1' as CoreObjectId, destination: { kind: 'owner-graveyard' } },
  ] as const) {
    current = removeCoreStackObjectV1(current, operation).bundle;
  }
  return current;
}

function priority(passedPlayerIds: readonly CorePlayerId[], holderPlayerId: CorePlayerId): CorePriorityPassComponentInputV1 {
  return {
    stackBundle: emptyStackBundle(),
    lifecycle: createModeNeutralCoreTurnLifecycleSliceV1({
      turnNumber: 1,
      positionSequence: 0,
      position: { phase: 'precombat-main', step: null },
      window: {
        kind: 'priority',
        cycleStartPlayerId: 'P1' as CorePlayerId,
        holderPlayerId,
        passedPlayerIds,
      },
    }),
  };
}

describe('O4P-01K-G priority/pass properties', () => {
  it('keeps a correct contiguous prefix and rotates to its unique successor', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: PLAYERS.length - 2 }), (passedCount) => {
      const passed = PLAYERS.slice(0, passedCount) as unknown as readonly CorePlayerId[];
      const holder = PLAYERS[passedCount] as CorePlayerId;
      const result = passCorePriorityV1(priority(passed, holder), holder);
      expect(result.lifecycle.window).toEqual(passedCount + 1 === PLAYERS.length
        ? { kind: 'position-advance-ready' }
        : {
            kind: 'priority',
            cycleStartPlayerId: 'P1' as CorePlayerId,
            holderPlayerId: PLAYERS[passedCount + 1] as CorePlayerId,
            passedPlayerIds: [...passed, holder],
          });
    }), { numRuns: 2 });
  });

  it('does not mutate an input while repeatedly closing an empty-stack cycle', () => {
    fc.assert(fc.property(fc.constant(null), () => {
      const input = priority([], 'P1' as CorePlayerId);
      const before = JSON.stringify(input);
      let current = input;
      for (const playerId of PLAYERS) current = passCorePriorityV1(current, playerId as CorePlayerId);
      expect(current.lifecycle.window.kind).toBe('position-advance-ready');
      expect(JSON.stringify(input)).toBe(before);
      expect(Object.isFrozen(current)).toBe(true);
    }), { numRuns: 1 });
  });
});
