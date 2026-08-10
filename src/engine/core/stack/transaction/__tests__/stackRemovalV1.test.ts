import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../../ids';
import { validateCoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';
import { CoreStackTransactionErrorV1 } from '../stackTransactionErrorV1';
import { removeCoreStackObjectV1 } from '../stackRemovalV1';

type Raw = Record<string, unknown>;
const CARD_OLD = 'PC5:1' as CoreObjectId;
const CARD_NEW = 'PC5:2' as CoreObjectId;

function readJson(path: string): Raw {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Raw;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixtureInput(): Raw {
  const runtime = readJson('../../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as Raw;
  runtimeByObject['@token:fixture-token:0'] = clone(runtimeByObject['PC4:1']);
  const announcements = readJson('../../fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  return {
    objectRegistry: readJson('../../../object/fixtures/object-registry-v2.json'),
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  };
}

function bundleFrom(input = fixtureInput()) {
  const result = validateCoreStackTransactionBundleV1(input);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function middleBundle() {
  const input = fixtureInput();
  const registry = input.objectRegistry as Raw;
  const zones = registry.zones as Raw;
  const shared = zones.shared as Raw;
  shared.stack = [
    '@spell-copy:fixture-copy',
    'PC5:1',
    '@activated-ability:fixture-activation',
    '@triggered-ability:fixture-trigger',
  ];
  const announcements = input.stackAnnouncements as Raw;
  const byObject = announcements.byObject as Raw;
  const ordered: Raw = {};
  for (const objectId of shared.stack as string[]) ordered[objectId] = byObject[objectId];
  announcements.byObject = ordered;
  return bundleFrom(input);
}

describe('removeCoreStackObjectV1', () => {
  it('moves a card spell to owner graveyard with a new incarnation and reset Runtime', () => {
    const bundle = bundleFrom();
    const result = removeCoreStackObjectV1(bundle, {
      kind: 'card-to-zone',
      objectId: CARD_OLD,
      destination: { kind: 'owner-graveyard' },
    });

    expect(result.removedObjectId).toBe(CARD_OLD);
    expect(result.nextObjectId).toBe(CARD_NEW);
    expect(result.bundle.objectRegistry.objects[CARD_OLD]).toBeUndefined();
    expect(result.bundle.objectRegistry.objects[CARD_NEW]).toEqual({
      kind: 'card',
      physicalCardId: 'PC5',
      incarnation: 2,
      baseControllerPlayerId: null,
    });
    expect(result.bundle.objectRegistry.zones.byPlayer['P3' as CorePlayerId].graveyard).toContain(CARD_NEW);
    expect(result.bundle.objectRegistry.zones.shared.stack).toEqual([
      '@spell-copy:fixture-copy',
      '@activated-ability:fixture-activation',
      '@triggered-ability:fixture-trigger',
    ]);
    expect(result.bundle.objectRuntime.byObject[CARD_OLD]).toBeUndefined();
    expect(result.bundle.objectRuntime.byObject[CARD_NEW]).toEqual({
      orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false },
      counterDamage: { counters: [], markedDamage: 0 },
      attachment: { attachedTo: null },
    });
    expect(result.bundle.stackAnnouncements.byObject[CARD_OLD]).toBeUndefined();
    expect(Object.isFrozen(result.bundle)).toBe(true);
  });

  it('preserves remaining stack order for a middle removal and honors battlefield controller', () => {
    const result = removeCoreStackObjectV1(middleBundle(), {
      kind: 'card-to-zone',
      objectId: CARD_OLD,
      destination: { kind: 'battlefield', baseControllerPlayerId: 'P4' },
    });

    expect(result.bundle.objectRegistry.zones.shared.stack).toEqual([
      '@spell-copy:fixture-copy',
      '@activated-ability:fixture-activation',
      '@triggered-ability:fixture-trigger',
    ]);
    expect(result.bundle.objectRegistry.zones.shared.battlefield).toContain(CARD_NEW);
    expect(result.bundle.objectRegistry.objects[CARD_NEW]).toMatchObject({ baseControllerPlayerId: 'P4' });
  });

  it.each([
    '@spell-copy:fixture-copy' as CoreObjectId,
    '@activated-ability:fixture-activation' as CoreObjectId,
    '@triggered-ability:fixture-trigger' as CoreObjectId,
  ])('ceases synthetic stack object %s without changing Runtime', (objectId) => {
    const bundle = bundleFrom();
    const runtimeBefore = JSON.stringify(bundle.objectRuntime);
    const result = removeCoreStackObjectV1(bundle, { kind: 'cease', objectId });

    expect(result.nextObjectId).toBeNull();
    expect(result.bundle.objectRegistry.objects[objectId]).toBeUndefined();
    expect(result.bundle.objectRuntime).toEqual(bundle.objectRuntime);
    expect(JSON.stringify(result.bundle.objectRuntime)).toBe(runtimeBefore);
    expect(result.bundle.stackAnnouncements.byObject[objectId]).toBeUndefined();
  });

  it('rejects mismatched operations and hostile operation descriptors atomically', () => {
    const bundle = bundleFrom();
    const before = JSON.stringify(bundle);
    const invalidOperations: unknown[] = [
      { kind: 'cease', objectId: CARD_OLD },
      { kind: 'card-to-zone', objectId: '@spell-copy:fixture-copy', destination: { kind: 'exile' } },
      { kind: 'card-to-zone', objectId: CARD_OLD, destination: { kind: 'stack', baseControllerPlayerId: 'P1' } },
    ];
    for (const input of invalidOperations) {
      expect(() => removeCoreStackObjectV1(bundle, input)).toThrow(CoreStackTransactionErrorV1);
    }
    const accessor: Raw = { kind: 'cease', objectId: CARD_OLD };
    Object.defineProperty(accessor, 'objectId', { enumerable: true, get: () => CARD_OLD });
    expect(() => removeCoreStackObjectV1(bundle, accessor)).toThrowError(/INVALID_OPERATION_INPUT/);
    expect(JSON.stringify(bundle)).toBe(before);
  });
});
