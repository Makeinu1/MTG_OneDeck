import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreCardDefinitionId, CoreObjectId, CorePlayerId } from '../../../ids';
import { validateModeNeutralCoreObjectRegistrySliceV2 } from '../../../object/objectRegistryValidationV2';
import { validateModeNeutralCoreObjectRuntimeSliceV2 } from '../../../object/objectRegistryValidationV2';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../../stackAnnouncementValidationV1';
import type { CoreStackAnnouncementRecordV1 } from '../../stackAnnouncementRecordV1';
import {
  commitCoreSyntheticStackObjectV1,
  type CoreSyntheticStackCommitInputV1,
  type CoreSyntheticStackObjectIdentityV1,
} from '../syntheticStackCommitV1';
import { validateCoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';
import { CoreStackTransactionErrorV1 } from '../stackTransactionErrorV1';
import type { CoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';

type RawRecord = Record<string, unknown>;

function readJson(path: string): RawRecord {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as RawRecord;
}

function transactionBundle(): CoreStackTransactionBundleV1 {
  const registryResult = validateModeNeutralCoreObjectRegistrySliceV2(
    readJson('../../../object/fixtures/object-registry-v2.json'),
  );
  if (!registryResult.ok) throw new Error(JSON.stringify(registryResult.issues));

  const runtime = readJson('../../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as RawRecord;
  runtimeByObject['@token:fixture-token:0'] = structuredClone(runtimeByObject['PC4:1']);
  const runtimeResult = validateModeNeutralCoreObjectRuntimeSliceV2(
    registryResult.value,
    runtime,
  );
  if (!runtimeResult.ok) throw new Error(JSON.stringify(runtimeResult.issues));

  const announcement = readJson('../../fixtures/stack-announcement-v1.json');
  announcement.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  const announcementResult = validateModeNeutralCoreStackAnnouncementSliceV1(
    registryResult.value,
    announcement,
  );
  if (!announcementResult.ok) throw new Error(JSON.stringify(announcementResult.issues));

  const bundleResult = validateCoreStackTransactionBundleV1({
    objectRegistry: registryResult.value,
    objectRuntime: runtimeResult.value,
    stackAnnouncements: announcementResult.value,
  });
  if (!bundleResult.ok) throw new Error(JSON.stringify(bundleResult.issues));
  return bundleResult.value;
}

function announcementFor(
  bundle: CoreStackTransactionBundleV1,
  objectId: CoreObjectId,
): CoreStackAnnouncementRecordV1 {
  const record = bundle.stackAnnouncements.byObject[objectId];
  if (record === undefined) throw new Error(`missing fixture announcement ${objectId}`);
  return structuredClone(record);
}

function commitInput(
  bundle: CoreStackTransactionBundleV1,
  kind: 'spell-copy' | 'activated-ability' | 'triggered-ability',
): CoreSyntheticStackCommitInputV1 {
  const objectId = kind === 'spell-copy'
    ? '@spell-copy:new-copy'
    : kind === 'activated-ability'
      ? '@activated-ability:new-activation'
      : '@triggered-ability:new-trigger';
  const object: CoreSyntheticStackObjectIdentityV1 = kind === 'spell-copy'
    ? {
      kind: 'spell-copy',
      definitionId: 'def.fixture-card' as CoreCardDefinitionId,
      controllerPlayerId: 'P1' as CorePlayerId,
      copiedFromObjectId: '@spell-copy:historical-copy' as CoreObjectId,
    }
    : kind === 'activated-ability'
      ? {
        kind: 'activated-ability',
        controllerPlayerId: 'P1' as CorePlayerId,
        sourceObjectId: '@activated-ability:historical-source' as CoreObjectId,
        abilityKey: 'ability.activated-ability',
      }
      : {
        kind: 'triggered-ability',
        controllerPlayerId: 'P1' as CorePlayerId,
        sourceObjectId: '@activated-ability:historical-source' as CoreObjectId,
        abilityKey: 'ability.triggered-ability',
      };
  const fixtureId = kind === 'spell-copy'
    ? '@spell-copy:fixture-copy'
    : kind === 'activated-ability'
      ? '@activated-ability:fixture-activation'
      : '@triggered-ability:fixture-trigger';
  return {
    objectId: objectId as CoreObjectId,
    object,
    announcement: announcementFor(bundle, fixtureId as CoreObjectId) as CoreSyntheticStackCommitInputV1['announcement'],
  };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) expectDeepFrozen(descriptor.value, seen);
  }
}

describe('O4P-01J-G synthetic stack commit transaction V1', () => {
  it.each(['spell-copy', 'activated-ability', 'triggered-ability'] as const)(
    'commits a %s without Runtime or PhysicalCard changes',
    (kind) => {
      const bundle = transactionBundle();
      const before = JSON.stringify(bundle);
      const input = commitInput(bundle, kind);
      const result = commitCoreSyntheticStackObjectV1(bundle, input);

      expect(result.committedObjectId).toBe(input.objectId);
      expect(result.bundle.objectRegistry.zones.shared.stack.at(-1)).toBe(input.objectId);
      expect(result.bundle.objectRegistry.objects[input.objectId]).toEqual(input.object);
      expect(result.bundle.objectRuntime).toEqual(bundle.objectRuntime);
      expect(result.bundle.objectRegistry.physicalCards).toEqual(bundle.objectRegistry.physicalCards);
      expect(result.bundle.stackAnnouncements.byObject[input.objectId]).toEqual(input.announcement);
      expect(Object.keys(result.bundle.objectRuntime.byObject)).not.toContain(input.objectId);
      expect(JSON.stringify(bundle)).toBe(before);
      expectDeepFrozen(result);
    },
  );

  it('accepts historical source and copy references without looking them up', () => {
    const bundle = transactionBundle();
    const input = commitInput(bundle, 'spell-copy');
    const result = commitCoreSyntheticStackObjectV1(bundle, input);
    expect(result.bundle.objectRegistry.objects[input.objectId]).toMatchObject({
      copiedFromObjectId: '@spell-copy:historical-copy',
    });
  });

  it('rejects duplicate IDs, ID-family mismatch, announcement mismatch, and missing definitions atomically', () => {
    const bundle = transactionBundle();
    const valid = commitInput(bundle, 'spell-copy');
    const before = JSON.stringify(bundle);

    expect(() => commitCoreSyntheticStackObjectV1(bundle, {
      ...valid,
      objectId: '@spell-copy:fixture-copy' as CoreObjectId,
    })).toThrowError(CoreStackTransactionErrorV1);
    expect(() => commitCoreSyntheticStackObjectV1(bundle, {
      ...valid,
      objectId: '@activated-ability:new-copy' as CoreObjectId,
    })).toThrowError(CoreStackTransactionErrorV1);
    expect(() => commitCoreSyntheticStackObjectV1(bundle, {
      ...valid,
      announcement: announcementFor(bundle, '@activated-ability:fixture-activation' as CoreObjectId) as CoreSyntheticStackCommitInputV1['announcement'],
    })).toThrowError(CoreStackTransactionErrorV1);
    expect(() => commitCoreSyntheticStackObjectV1(bundle, {
      ...valid,
      object: { ...valid.object, definitionId: 'def.missing' as CoreCardDefinitionId },
    })).toThrowError(CoreStackTransactionErrorV1);
    expect(JSON.stringify(bundle)).toBe(before);
  });

  it('rejects accessors and hostile announcement input without leaking raw errors', () => {
    const bundle = transactionBundle();
    const valid = commitInput(bundle, 'triggered-ability');
    const accessor: RawRecord = { ...valid };
    Object.defineProperty(accessor, 'announcement', {
      enumerable: true,
      get(): never { throw new Error('getter must not run'); },
    });
    expect(() => commitCoreSyntheticStackObjectV1(
      bundle,
      accessor as unknown as CoreSyntheticStackCommitInputV1,
    )).toThrowError(CoreStackTransactionErrorV1);

    const hostileAnnouncement = new Proxy(valid.announcement, {
      ownKeys(): never { throw new Error('announcement keys must not escape'); },
    });
    expect(() => commitCoreSyntheticStackObjectV1(bundle, {
      ...valid,
      announcement: hostileAnnouncement,
    })).toThrowError(CoreStackTransactionErrorV1);
  });
});
