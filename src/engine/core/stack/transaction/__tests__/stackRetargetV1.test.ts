import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId } from '../../../ids';
import type { CoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';
import { validateCoreStackTransactionBundleV1 } from '../stackTransactionValidationV1';
import { CoreStackTransactionErrorV1 } from '../stackTransactionErrorV1';
import { retargetCoreStackObjectV1 } from '../stackRetargetV1';

type RawRecord = Record<string, unknown>;

const STACK_CARD = 'PC5:1' as CoreObjectId;
const ACTIVATED = '@activated-ability:fixture-activation' as CoreObjectId;

function readJson(path: string): RawRecord {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as RawRecord;
}

function fixtureBundle(): CoreStackTransactionBundleV1 {
  const runtime = readJson('../../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as RawRecord;
  runtimeByObject['@token:fixture-token:0'] = structuredClone(runtimeByObject['PC4:1']);

  const announcements = readJson('../../fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';

  const result = validateCoreStackTransactionBundleV1({
    objectRegistry: readJson('../../../object/fixtures/object-registry-v2.json'),
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
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

describe('retargetCoreStackObjectV1', () => {
  it('replaces selected targets while preserving stack identity, order, and all decisions', () => {
    const bundle = fixtureBundle();
    const before = JSON.stringify(bundle);
    const previous = bundle.stackAnnouncements.byObject[STACK_CARD];
    const result = retargetCoreStackObjectV1(bundle, {
      objectId: STACK_CARD,
      replacements: [
        {
          selectionId: 'card-object',
          target: { kind: 'object', objectId: '@spell-copy:historical-target' },
        },
        { selectionId: 'card-player', target: { kind: 'player', playerId: 'P4' } },
      ],
    });
    const next = result.bundle.stackAnnouncements.byObject[STACK_CARD];

    expect(result.objectId).toBe(STACK_CARD);
    expect(result.bundle.objectRegistry).toEqual(bundle.objectRegistry);
    expect(result.bundle.objectRuntime).toEqual(bundle.objectRuntime);
    expect(result.bundle.objectRegistry.zones.shared.stack).toEqual(
      bundle.objectRegistry.zones.shared.stack,
    );
    expect(next.targetSelections).toEqual([
      {
        selectionId: 'card-object',
        groupKey: 'primary',
        target: { kind: 'object', objectId: '@spell-copy:historical-target' },
      },
      {
        selectionId: 'card-player',
        groupKey: 'secondary',
        target: { kind: 'player', playerId: 'P4' },
      },
    ]);
    expect(next.kind).toBe(previous.kind);
    expect(next.abilityTextSnapshot).toBe(previous.abilityTextSnapshot);
    expect(next.chosenModeKeys).toEqual(previous.chosenModeKeys);
    expect(next.announcedVariables).toEqual(previous.announcedVariables);
    expect(next.distributions).toEqual(previous.distributions);
    expect(next.costChoices).toEqual(previous.costChoices);
    expect(JSON.stringify(bundle)).toBe(before);
    expectDeepFrozen(result);
  });

  it('accepts historical targets and an empty immutable no-op', () => {
    const bundle = fixtureBundle();
    const before = JSON.stringify(bundle);
    const result = retargetCoreStackObjectV1(bundle, { objectId: ACTIVATED, replacements: [] });

    expect(result.bundle).not.toBe(bundle);
    expect(result.bundle.stackAnnouncements.byObject[ACTIVATED]).toEqual(
      bundle.stackAnnouncements.byObject[ACTIVATED],
    );
    expect(result.bundle.objectRegistry).toEqual(bundle.objectRegistry);
    expect(result.bundle.objectRuntime).toEqual(bundle.objectRuntime);
    expect(JSON.stringify(bundle)).toBe(before);
    expectDeepFrozen(result);
  });

  it('rejects duplicate and unknown selection IDs without exposing a candidate', () => {
    const bundle = fixtureBundle();
    const before = JSON.stringify(bundle);

    expect(() =>
      retargetCoreStackObjectV1(bundle, {
        objectId: STACK_CARD,
        replacements: [
          { selectionId: 'card-object', target: { kind: 'player', playerId: 'P1' } },
          { selectionId: 'card-object', target: { kind: 'player', playerId: 'P2' } },
        ],
      }),
    ).toThrowError(/DUPLICATE_TARGET_REPLACEMENT/);
    expect(() =>
      retargetCoreStackObjectV1(bundle, {
        objectId: STACK_CARD,
        replacements: [
          { selectionId: 'missing-selection', target: { kind: 'player', playerId: 'P1' } },
        ],
      }),
    ).toThrowError(/TARGET_SELECTION_NOT_FOUND/);
    expect(JSON.stringify(bundle)).toBe(before);
  });

  it('rejects same-group structural duplicates but accepts duplicates across groups', () => {
    const raw = readJson('../../fixtures/stack-announcement-v1.json');
    raw.kind = 'mode-neutral-core-stack-announcement-slice-v1';
    const cardRecord = (raw.byObject as RawRecord)[STACK_CARD] as RawRecord;
    const selections = cardRecord.targetSelections as RawRecord[];
    selections[1].groupKey = selections[0].groupKey;
    selections[1].target = selections[0].target;
    const runtime = readJson('../../../fixtures/card-runtime-slice-v1.json');
    runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
    (runtime.byObject as RawRecord)['@token:fixture-token:0'] = structuredClone(
      (runtime.byObject as RawRecord)['PC4:1'],
    );
    const result = validateCoreStackTransactionBundleV1({
      objectRegistry: readJson('../../../object/fixtures/object-registry-v2.json'),
      objectRuntime: runtime,
      stackAnnouncements: raw,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('duplicate target fixture was accepted');
    expect(result.issues.some((issue) => issue.code === 'INVALID_TRANSACTION_BUNDLE')).toBe(true);
    expect(result.issues.some((issue) => issue.nested?.some((nested) => nested.code === 'DUPLICATE_TARGET_IN_GROUP'))).toBe(true);
  });

  it('contains hostile operation inspection and validates the full bundle first', () => {
    const bundle = fixtureBundle();
    const hostile: RawRecord = {
      objectId: STACK_CARD,
      replacements: [],
    };
    Object.defineProperty(hostile, 'objectId', {
      enumerable: true,
      get(): never {
        throw new Error('getter must not run');
      },
    });
    expect(() => retargetCoreStackObjectV1(bundle, hostile)).toThrowError(
      CoreStackTransactionErrorV1,
    );

    const invalidBundle = {
      ...bundle,
      objectRuntime: { ...bundle.objectRuntime, byObject: { unknown: {} } },
    };
    expect(() =>
      retargetCoreStackObjectV1(invalidBundle, {
        objectId: STACK_CARD,
        replacements: [],
      }),
    ).toThrowError(/INVALID_TRANSACTION_BUNDLE/);
  });
});
