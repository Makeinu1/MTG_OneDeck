import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as coreApi from '../../index';

type RawRecord = Record<string, unknown>;
type CoreFunction = (...args: unknown[]) => unknown;
type ValidationResult =
  | { readonly ok: true; readonly value: RawRecord }
  | { readonly ok: false; readonly issues: readonly RawRecord[] };

const STACK_IDS = [
  'PC5:1',
  '@spell-copy:fixture-copy',
  '@activated-ability:fixture-activation',
  '@triggered-ability:fixture-trigger',
] as const;

function record(value: unknown, label: string): RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a record`);
  }
  return value as RawRecord;
}

function apiFunction(name: string): CoreFunction {
  const value: unknown = Reflect.get(coreApi, name);
  if (!isCoreFunction(value)) throw new Error(`missing Core export: ${name}`);
  return value;
}

function isCoreFunction(value: unknown): value is CoreFunction {
  return typeof value === 'function';
}

function stackRecord(root: RawRecord, objectId: string): RawRecord {
  return record(byObject(root)[objectId], `byObject.${objectId}`);
}

function byObject(root: RawRecord): RawRecord {
  return record(root.byObject, 'byObject');
}

function issueCodes(result: ValidationResult): string[] {
  expect(result.ok).toBe(false);
  if (result.ok) return [];
  return result.issues.map((issue) => String(issue.code));
}

function registry(): RawRecord {
  return JSON.parse(
    readFileSync(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url), 'utf8'),
  ) as RawRecord;
}

function targetSelection(selectionId = 'damage-1', groupKey = 'damage'): RawRecord {
  return {
    selectionId,
    groupKey,
    target: { kind: 'object', objectId: '@spell-copy:historical-target' },
  };
}

function baseRecord(kind: string, abilityTextSnapshot: string | null): RawRecord {
  return {
    kind,
    abilityTextSnapshot,
    chosenModeKeys: ['mode-b', 'mode-a', 'mode-b'],
    targetSelections: [targetSelection()],
    announcedVariables: [{ variableKey: 'X', value: 0 }, { variableKey: 'amount', value: 2 }],
    distributions: [{
      distributionKey: 'damage',
      assignments: [{ targetSelectionId: 'damage-1', amount: 2 }],
    }],
    costChoices: {
      alternativeCost: { costKey: 'alt-free' },
      additionalCosts: [{ costKey: 'kicker', times: 2 }],
    },
  };
}

function announcementInput(): RawRecord {
  return {
    byObject: {
      [STACK_IDS[0]]: baseRecord('card-spell', null),
      [STACK_IDS[1]]: baseRecord('spell-copy', null),
      [STACK_IDS[2]]: baseRecord('activated-ability', 'Tap: draw a card.'),
      [STACK_IDS[3]]: baseRecord('triggered-ability', 'When this enters, draw a card.'),
    },
  };
}

function fullInput(): RawRecord {
  const input = announcementInput();
  input.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  return input;
}

function validateWithRegistry(inputRegistry: unknown, input: unknown): ValidationResult {
  return apiFunction('validateModeNeutralCoreStackAnnouncementSliceV1')(inputRegistry, input) as ValidationResult;
}

function validate(input: unknown): ValidationResult {
  return apiFunction('validateModeNeutralCoreStackAnnouncementSliceV1')(registry(), input) as ValidationResult;
}

function create(input: unknown): RawRecord {
  return apiFunction('createModeNeutralCoreStackAnnouncementSliceV1')(registry(), input) as RawRecord;
}

function deepFreezeCheck(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      deepFreezeCheck(descriptor.value, seen);
    }
  }
}

describe('O4P-01I stack announcement acceptance pins', () => {
  it('accepts mixed stack exact parity and preserves bottom-to-top order without stackOrder', () => {
    const result = validate(fullInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(byObject(result.value))).toEqual(STACK_IDS);
    expect(Object.keys(byObject(result.value))).not.toContain('stackOrder');
    expect(stackRecord(result.value, STACK_IDS[0]).kind).toBe('card-spell');
    expect(stackRecord(result.value, STACK_IDS[1]).kind).toBe('spell-copy');
    expect(stackRecord(result.value, STACK_IDS[2]).kind).toBe('activated-ability');
    expect(stackRecord(result.value, STACK_IDS[3]).kind).toBe('triggered-ability');
  });

  it('rejects missing, extra, duplicate, or reordered stack records', () => {
    const missing = fullInput();
    delete byObject(missing)[STACK_IDS[2]];
    expect(issueCodes(validate(missing))).toContain('STACK_OBJECT_SET_MISMATCH');
    const extra = fullInput();
    byObject(extra)['@spell-copy:historical-extra'] = baseRecord('spell-copy', null);
    expect(issueCodes(validate(extra))).toContain('STACK_OBJECT_SET_MISMATCH');
    const reordered = fullInput();
    reordered.byObject = Object.fromEntries(Object.entries(byObject(reordered)).reverse());
    expect(issueCodes(validate(reordered))).toContain('INVALID_ORDER');
    const duplicateOrder = fullInput();
    const zones = record(registry().zones, 'zones');
    const stack = record(zones.shared, 'shared').stack as string[];
    const duplicateRegistry = registry();
    const duplicateZones = record(duplicateRegistry.zones, 'zones');
    const duplicateShared = record(duplicateZones.shared, 'shared');
    duplicateShared.stack = [...stack, STACK_IDS[3]];
    expect(issueCodes(validateWithRegistry(duplicateRegistry, duplicateOrder))).toContain('INVALID_ORDER');
  });

  it('enforces registry-kind matching and ability text null/source-independent rules', () => {
    const mismatch = fullInput();
    byObject(mismatch)[STACK_IDS[0]] = baseRecord('activated-ability', 'source vanished');
    expect(issueCodes(validate(mismatch))).toContain('ANNOUNCEMENT_KIND_MISMATCH');
    const cardText = fullInput();
    stackRecord(cardText, STACK_IDS[0]).abilityTextSnapshot = 'must be null';
    expect(issueCodes(validate(cardText))).toContain('INVALID_ABILITY_TEXT');
    const missingText = fullInput();
    delete stackRecord(missingText, STACK_IDS[2]).abilityTextSnapshot;
    expect(issueCodes(validate(missingText))).toContain('MISSING_FIELD');
    const accepted = validate(fullInput());
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(stackRecord(accepted.value, STACK_IDS[2]).abilityTextSnapshot).toBe('Tap: draw a card.');
  });

  it('accepts historical and currently absent object/player targets', () => {
    const input = fullInput();
    stackRecord(input, STACK_IDS[2]).targetSelections = [
      targetSelection('old-object', 'g1'),
      { selectionId: 'gone-player', groupKey: 'g2', target: { kind: 'player', playerId: 'P99' } },
    ];
    stackRecord(input, STACK_IDS[2]).distributions = [{
      distributionKey: 'damage',
      assignments: [{ targetSelectionId: 'old-object', amount: 2 }],
    }];
    expect(validate(input).ok).toBe(true);
  });

  it('preserves mode order and repetition, and enforces selection/group duplicate rules', () => {
    const result = validate(fullInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(stackRecord(result.value, STACK_IDS[0]).chosenModeKeys).toEqual(['mode-b', 'mode-a', 'mode-b']);
    const duplicateSelection = fullInput();
    stackRecord(duplicateSelection, STACK_IDS[0]).targetSelections = [targetSelection(), targetSelection()];
    expect(issueCodes(validate(duplicateSelection))).toContain('DUPLICATE_TARGET_SELECTION_ID');
    const sameTargetGroup = fullInput();
    stackRecord(sameTargetGroup, STACK_IDS[0]).targetSelections = [
      targetSelection('one', 'same'), targetSelection('two', 'same'),
    ];
    expect(issueCodes(validate(sameTargetGroup))).toContain('DUPLICATE_TARGET_IN_GROUP');
    const differentGroups = fullInput();
    stackRecord(differentGroups, STACK_IDS[0]).targetSelections = [
      targetSelection('one', 'g1'), targetSelection('two', 'g2'),
    ];
    stackRecord(differentGroups, STACK_IDS[0]).distributions = [{
      distributionKey: 'damage',
      assignments: [{ targetSelectionId: 'one', amount: 2 }],
    }];
    expect(validate(differentGroups).ok).toBe(true);
  });

  it('requires unique sorted variable keys, accepts X=0, and rejects invalid numeric values', () => {
    expect(validate(fullInput()).ok).toBe(true);
    for (const variables of [
      [{ variableKey: 'X', value: 0 }, { variableKey: 'X', value: 1 }],
      [{ variableKey: 'z', value: 1 }, { variableKey: 'a', value: 1 }],
      [{ variableKey: 'a', value: 1.5 }],
      [{ variableKey: 'a', value: Number.NaN }],
      [{ variableKey: 'a', value: -1 }],
    ]) {
      const input = fullInput();
      stackRecord(input, STACK_IDS[0]).announcedVariables = variables;
      expect(issueCodes(validate(input))).toEqual(expect.arrayContaining([
        variables.some((item) => item.value === 1.5 || Number.isNaN(item.value) || item.value < 0)
          ? 'INVALID_INTEGER' : variables[0].variableKey === variables[1]?.variableKey ? 'DUPLICATE_VALUE' : 'INVALID_ORDER',
      ]));
    }
  });

  it('requires sorted unique cost and distribution keys, positive times/amounts, and target references', () => {
    const unsorted = fullInput();
    const unsortedCosts = record(stackRecord(unsorted, STACK_IDS[0]).costChoices, 'costChoices');
    unsortedCosts.additionalCosts = [
      { costKey: 'z', times: 1 }, { costKey: 'a', times: 1 },
    ];
    expect(issueCodes(validate(unsorted))).toContain('INVALID_ORDER');
    const badTimes = fullInput();
    record(stackRecord(badTimes, STACK_IDS[0]).costChoices, 'costChoices').additionalCosts = [{ costKey: 'a', times: 0 }];
    expect(issueCodes(validate(badTimes))).toContain('INVALID_COST_CHOICE');
    const badDistribution = fullInput();
    stackRecord(badDistribution, STACK_IDS[0]).distributions = [{
      distributionKey: 'damage',
      assignments: [{ targetSelectionId: 'missing', amount: 1 }, { targetSelectionId: 'missing', amount: 0 }],
    }];
    expect(issueCodes(validate(badDistribution))).toEqual(expect.arrayContaining([
      'DISTRIBUTION_TARGET_NOT_FOUND', 'DUPLICATE_DISTRIBUTION_TARGET',
    ]));
  });

  it('rejects lifecycle status/proposal/payment fields and all unknown fields', () => {
    for (const key of ['status', 'draft', 'proposed', 'pendingPayment', 'paymentComplete', 'legal', 'resolved', 'countered', 'readyToResolve']) {
      const input = fullInput();
      stackRecord(input, STACK_IDS[0])[key] = true;
      expect(issueCodes(validate(input))).toContain('UNKNOWN_FIELD');
    }
  });

  it('returns canonical JSON, deep-freezes fresh values, and never mutates input', () => {
    const input = fullInput();
    const before = JSON.stringify(input);
    const result = validate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBe(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.keys(result.value)).toEqual(['kind', 'byObject']);
    expect(Object.keys(stackRecord(result.value, STACK_IDS[0]))).toEqual([
      'kind', 'abilityTextSnapshot', 'chosenModeKeys', 'targetSelections',
      'announcedVariables', 'distributions', 'costChoices',
    ]);
    expect(JSON.stringify(result.value)).toBe(JSON.stringify(JSON.parse(JSON.stringify(result.value))));
    deepFreezeCheck(result.value);
    const factoryInput = announcementInput();
    const created = create(factoryInput);
    expect(created.kind).toBe('mode-neutral-core-stack-announcement-slice-v1');
    expect(JSON.stringify(factoryInput)).toBe(JSON.stringify(announcementInput()));
    deepFreezeCheck(created);
  });
});
