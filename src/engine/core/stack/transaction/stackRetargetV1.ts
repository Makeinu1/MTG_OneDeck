import type { CoreObjectId } from '../../ids';
import { isCoreUnsafeRecordKey } from '../../ids';
import { isCanonicalCoreObjectIdV2 } from '../../object/objectIdV2';
import {
  createModeNeutralCoreObjectRegistryStateV2,
  createModeNeutralCoreObjectRuntimeStateV2,
  type ModeNeutralCoreObjectRegistrySliceV2,
  type ModeNeutralCoreObjectRuntimeSliceV2,
} from '../../object/objectRegistryStateV2';
import {
  validateCoreStackChoiceKeyV1,
  validateCoreStackTargetRefV1,
} from '../announcementPrimitivesV1';
import type { CoreStackChoiceKeyV1, CoreStackTargetRefV1 } from '../announcementPrimitivesV1';
import {
  createModeNeutralCoreStackAnnouncementSliceV1,
  type ModeNeutralCoreStackAnnouncementSliceV1,
} from '../stackAnnouncementSliceV1';
import type { CoreStackAnnouncementRecordV1 } from '../stackAnnouncementRecordV1';
import {
  deepFreezeStackTransactionV1,
  locateCoreObjectExactlyOnceV1,
  rebuildRecordWithKeyV1,
  type StackTransactionNestedIssueV1,
} from './internalStackTransactionV1';
import { CoreStackTransactionErrorV1 } from './stackTransactionErrorV1';
import {
  validateCoreStackTransactionBundleV1,
  type CoreStackTransactionBundleV1,
  type CoreStackTransactionValidationCodeV1,
  type CoreStackTransactionValidationIssueV1,
} from './stackTransactionBundleV1';

export type CoreStackTargetReplacementV1 = Readonly<{
  readonly selectionId: CoreStackChoiceKeyV1;
  readonly target: CoreStackTargetRefV1;
}>;

export type CoreStackRetargetInputV1 = Readonly<{
  readonly objectId: CoreObjectId;
  readonly replacements: readonly CoreStackTargetReplacementV1[];
}>;

export type CoreStackRetargetResultV1 = Readonly<{
  readonly bundle: CoreStackTransactionBundleV1;
  readonly objectId: CoreObjectId;
}>;

type RawRecord = Record<string, unknown>;
type StrictReplacement = CoreStackTargetReplacementV1;
type ParsedOperation = Readonly<{
  readonly objectId: CoreObjectId;
  readonly replacements: readonly StrictReplacement[];
}>;

const OPERATION_FIELDS = ['objectId', 'replacements'] as const;
const REPLACEMENT_FIELDS = ['selectionId', 'target'] as const;

function pointer(path: string, field: string): string {
  return `${path}/${field.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

function issue(
  code: CoreStackTransactionValidationCodeV1,
  path: string,
  message: string,
  nested?: readonly StackTransactionNestedIssueV1[],
): CoreStackTransactionValidationIssueV1 {
  return {
    code,
    path,
    message,
    ...(nested === undefined ? {} : { nested: nested.map((current) => ({ ...current })) }),
  };
}

function fail(
  code: CoreStackTransactionValidationCodeV1,
  path: string,
  message: string,
  nested?: readonly StackTransactionNestedIssueV1[],
): never {
  throw new CoreStackTransactionErrorV1(code, [issue(code, path, message, nested)]);
}

function isPlainRecord(value: unknown): value is RawRecord {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null)
    );
  } catch {
    return false;
  }
}

function readExactRecord(
  value: unknown,
  fields: readonly string[],
  path: string,
): Readonly<
  | { readonly ok: true; readonly value: RawRecord }
  | { readonly ok: false; readonly issues: readonly StackTransactionNestedIssueV1[] }
> {
  if (!isPlainRecord(value)) {
    return {
      ok: false,
      issues: [issue('INVALID_OPERATION_INPUT', path, 'Expected a plain object')],
    };
  }

  const issues: StackTransactionNestedIssueV1[] = [];
  const result = Object.create(null) as RawRecord;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return {
      ok: false,
      issues: [issue('INVALID_OPERATION_INPUT', path, 'Object descriptors are not readable')],
    };
  }

  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.push(
        issue(
          'INVALID_OPERATION_INPUT',
          pointer(path, '[symbol]'),
          'Symbol fields are not allowed',
        ),
      );
      continue;
    }
    const fieldPath = pointer(path, key);
    if (isCoreUnsafeRecordKey(key)) {
      issues.push(issue('INVALID_OPERATION_INPUT', fieldPath, `Unsafe record key: ${key}`));
      continue;
    }
    if (!fields.includes(key)) {
      issues.push(issue('INVALID_OPERATION_INPUT', fieldPath, `Unknown field: ${key}`));
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(issue('INVALID_OPERATION_INPUT', fieldPath, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      issues.push(issue('INVALID_OPERATION_INPUT', fieldPath, 'Fields must be enumerable'));
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      issues.push(
        issue('INVALID_OPERATION_INPUT', fieldPath, 'Accessor properties are not allowed'),
      );
      continue;
    }
    result[key] = descriptor.value;
  }

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.push(
        issue('INVALID_OPERATION_INPUT', pointer(path, field), `Missing field: ${field}`),
      );
    }
  }
  return issues.length === 0 ? { ok: true, value: result } : { ok: false, issues };
}

function isArrayIndexKey(key: string): boolean {
  return /^(0|[1-9][0-9]*)$/.test(key);
}

function readStrictArray(
  value: unknown,
  path: string,
): Readonly<
  | { readonly ok: true; readonly value: readonly unknown[] }
  | { readonly ok: false; readonly issues: readonly StackTransactionNestedIssueV1[] }
> {
  try {
    if (!Array.isArray(value)) {
      return { ok: false, issues: [issue('INVALID_OPERATION_INPUT', path, 'Expected an array')] };
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      lengthDescriptor === undefined ||
      !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
    ) {
      return {
        ok: false,
        issues: [
          issue(
            'INVALID_OPERATION_INPUT',
            pointer(path, 'length'),
            'Array length must be a data property',
          ),
        ],
      };
    }
    const length: unknown = lengthDescriptor.value as unknown;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
      return {
        ok: false,
        issues: [
          issue(
            'INVALID_OPERATION_INPUT',
            pointer(path, 'length'),
            'Array length must be a nonnegative integer',
          ),
        ],
      };
    }

    const issues: StackTransactionNestedIssueV1[] = [];
    const values: unknown[] = new Array(length);
    const present = new Set<number>();
    let keys: readonly PropertyKey[];
    try {
      keys = Reflect.ownKeys(value);
    } catch {
      return {
        ok: false,
        issues: [issue('INVALID_OPERATION_INPUT', path, 'Array descriptors are not readable')],
      };
    }
    for (const key of keys) {
      if (key === 'length') continue;
      if (typeof key !== 'string' || !isArrayIndexKey(key)) {
        issues.push(
          issue(
            'INVALID_OPERATION_INPUT',
            pointer(path, typeof key === 'string' ? key : '[symbol]'),
            'Array extra fields are not allowed',
          ),
        );
        continue;
      }
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index >= length) {
        issues.push(
          issue('INVALID_OPERATION_INPUT', pointer(path, key), 'Array index is out of bounds'),
        );
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true) {
        issues.push(
          issue('INVALID_OPERATION_INPUT', pointer(path, key), 'Array entries must be enumerable'),
        );
      } else if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        issues.push(
          issue(
            'INVALID_OPERATION_INPUT',
            pointer(path, key),
            'Accessor array entries are not allowed',
          ),
        );
      } else {
        present.add(index);
        values[index] = descriptor.value;
      }
    }
    for (let index = 0; index < length; index += 1) {
      if (!present.has(index)) {
        issues.push(
          issue(
            'INVALID_OPERATION_INPUT',
            pointer(path, String(index)),
            'Sparse arrays are not allowed',
          ),
        );
      }
    }
    return issues.length === 0 ? { ok: true, value: values } : { ok: false, issues };
  } catch {
    return {
      ok: false,
      issues: [issue('INVALID_OPERATION_INPUT', path, 'Unable to inspect array safely')],
    };
  }
}

function readOperation(
  input: unknown,
): Readonly<
  | { readonly ok: true; readonly value: ParsedOperation }
  | { readonly ok: false; readonly issues: readonly StackTransactionNestedIssueV1[] }
> {
  const root = readExactRecord(input, OPERATION_FIELDS, '');
  if (!root.ok) return root;

  const issues: StackTransactionNestedIssueV1[] = [];
  const objectId = root.value.objectId;
  if (!isCanonicalCoreObjectIdV2(objectId)) {
    issues.push(
      issue(
        'INVALID_OPERATION_INPUT',
        '/objectId',
        'Object ID must be a canonical Core object ID V2',
      ),
    );
  }

  const replacementsResult = readStrictArray(root.value.replacements, '/replacements');
  if (!replacementsResult.ok)
    return { ok: false, issues: [...issues, ...replacementsResult.issues] };

  const replacements: StrictReplacement[] = [];
  for (let index = 0; index < replacementsResult.value.length; index += 1) {
    const replacementPath = `/replacements/${index}`;
    const replacement = readExactRecord(
      replacementsResult.value[index],
      REPLACEMENT_FIELDS,
      replacementPath,
    );
    if (!replacement.ok) {
      issues.push(...replacement.issues);
      continue;
    }
    const selectionIdResult = validateCoreStackChoiceKeyV1(replacement.value.selectionId);
    if (!selectionIdResult.ok) {
      for (const nested of selectionIdResult.issues) {
        issues.push(
          issue(
            'INVALID_OPERATION_INPUT',
            `${replacementPath}/selectionId${nested.path}`,
            nested.message,
          ),
        );
      }
    }
    let targetResult: ReturnType<typeof validateCoreStackTargetRefV1>;
    try {
      targetResult = validateCoreStackTargetRefV1(replacement.value.target);
    } catch {
      issues.push(
        issue(
          'INVALID_OPERATION_INPUT',
          `${replacementPath}/target`,
          'Target reference could not be inspected safely',
        ),
      );
      continue;
    }
    if (!targetResult.ok) {
      for (const nested of targetResult.issues) {
        issues.push(
          issue(
            'INVALID_OPERATION_INPUT',
            `${replacementPath}/target${nested.path}`,
            nested.message,
          ),
        );
      }
    }
    if (selectionIdResult.ok && targetResult.ok) {
      replacements.push({ selectionId: selectionIdResult.value, target: targetResult.value });
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: { objectId: objectId as CoreObjectId, replacements },
  };
}

function parseOperation(input: unknown): ParsedOperation {
  const result = readOperation(input);
  if (!result.ok)
    fail('INVALID_OPERATION_INPUT', '', 'Retarget operation input is invalid', result.issues);
  return result.value;
}

function candidateRegistry(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
): ModeNeutralCoreObjectRegistrySliceV2 {
  return createModeNeutralCoreObjectRegistryStateV2({
    players: registry.players,
    turnOrder: registry.turnOrder,
    activePlayerId: registry.activePlayerId,
    cardDefinitions: registry.cardDefinitions,
    physicalCards: registry.physicalCards,
    objects: registry.objects,
    zones: registry.zones,
  });
}

function candidateRuntime(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  runtime: ModeNeutralCoreObjectRuntimeSliceV2,
): ModeNeutralCoreObjectRuntimeSliceV2 {
  return createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: runtime.byObject });
}

function candidateAnnouncementRecord(
  record: CoreStackAnnouncementRecordV1,
  replacements: ReadonlyMap<string, CoreStackTargetRefV1>,
): CoreStackAnnouncementRecordV1 {
  const targetSelections = record.targetSelections.map((selection) => {
    const replacement = replacements.get(selection.selectionId);
    return {
      selectionId: selection.selectionId,
      groupKey: selection.groupKey,
      target: replacement ?? selection.target,
    };
  });
  return {
    kind: record.kind,
    abilityTextSnapshot: record.abilityTextSnapshot,
    chosenModeKeys: record.chosenModeKeys,
    targetSelections,
    announcedVariables: record.announcedVariables,
    distributions: record.distributions,
    costChoices: record.costChoices,
  } as CoreStackAnnouncementRecordV1;
}

function candidateAnnouncements(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  announcements: ModeNeutralCoreStackAnnouncementSliceV1,
  objectId: CoreObjectId,
  record: CoreStackAnnouncementRecordV1,
  replacements: ReadonlyMap<string, CoreStackTargetRefV1>,
): ModeNeutralCoreStackAnnouncementSliceV1 {
  return createModeNeutralCoreStackAnnouncementSliceV1(registry, {
    byObject: rebuildRecordWithKeyV1(
      announcements.byObject,
      objectId,
      candidateAnnouncementRecord(record, replacements),
    ),
  });
}

function nestedCandidateIssues(
  result: Readonly<{ readonly issues: readonly CoreStackTransactionValidationIssueV1[] }>,
): readonly StackTransactionNestedIssueV1[] {
  return result.issues.flatMap(
    (current) =>
      current.nested ?? [
        {
          code: current.code,
          path: current.path,
          message: current.message,
        },
      ],
  );
}

function retarget(bundleInput: unknown, input: unknown): CoreStackRetargetResultV1 {
  let bundleResult: ReturnType<typeof validateCoreStackTransactionBundleV1>;
  try {
    bundleResult = validateCoreStackTransactionBundleV1(bundleInput);
  } catch {
    fail('INVALID_TRANSACTION_BUNDLE', '', 'Transaction bundle input is invalid');
  }
  if (!bundleResult.ok) {
    fail(
      'INVALID_TRANSACTION_BUNDLE',
      '',
      'Transaction bundle input is invalid',
      nestedCandidateIssues(bundleResult),
    );
  }
  const bundle = bundleResult.value;
  const operation = parseOperation(input);

  if (!Object.prototype.hasOwnProperty.call(bundle.objectRegistry.objects, operation.objectId)) {
    fail('SOURCE_NOT_FOUND', '/objectId', 'Stack object is not present in the Object Registry');
  }
  const location = locateCoreObjectExactlyOnceV1(bundle.objectRegistry, operation.objectId);
  if (location === null) {
    fail(
      'SOURCE_NOT_FOUND',
      '/objectId',
      'Stack object does not have exactly one registered zone location',
    );
  }
  if (location.zone !== 'stack') {
    fail('SOURCE_NOT_ON_STACK', '/objectId', 'Stack object must be in the shared stack');
  }
  if (
    !Object.prototype.hasOwnProperty.call(bundle.stackAnnouncements.byObject, operation.objectId)
  ) {
    fail('SOURCE_NOT_FOUND', '/objectId', 'Stack object has no announcement record');
  }
  const record = bundle.stackAnnouncements.byObject[operation.objectId];
  const selectionIds = new Set(record.targetSelections.map((selection) => selection.selectionId));
  const replacementMap = new Map<string, CoreStackTargetRefV1>();
  for (let index = 0; index < operation.replacements.length; index += 1) {
    const replacement = operation.replacements[index];
    if (!selectionIds.has(replacement.selectionId)) {
      fail(
        'TARGET_SELECTION_NOT_FOUND',
        `/replacements/${index}/selectionId`,
        'Target selection ID is not present in the announcement',
      );
    }
    if (replacementMap.has(replacement.selectionId)) {
      fail(
        'DUPLICATE_TARGET_REPLACEMENT',
        `/replacements/${index}/selectionId`,
        'Target selection ID was supplied more than once',
      );
    }
    replacementMap.set(replacement.selectionId, replacement.target);
  }

  let nextRegistry: ModeNeutralCoreObjectRegistrySliceV2;
  let nextRuntime: ModeNeutralCoreObjectRuntimeSliceV2;
  let nextAnnouncements: ModeNeutralCoreStackAnnouncementSliceV1;
  try {
    nextRegistry = candidateRegistry(bundle.objectRegistry);
    nextRuntime = candidateRuntime(nextRegistry, bundle.objectRuntime);
    nextAnnouncements = candidateAnnouncements(
      nextRegistry,
      bundle.stackAnnouncements,
      operation.objectId,
      record,
      replacementMap,
    );
  } catch (error: unknown) {
    const nested =
      error instanceof Error && 'issues' in error && Array.isArray(error.issues)
        ? (error.issues as readonly StackTransactionNestedIssueV1[])
        : undefined;
    fail(
      'RETARGET_STRUCTURE_MISMATCH',
      '/replacements',
      'Retarget candidate announcement is structurally invalid',
      nested,
    );
  }

  let candidate: ReturnType<typeof validateCoreStackTransactionBundleV1>;
  try {
    candidate = validateCoreStackTransactionBundleV1({
      objectRegistry: nextRegistry,
      objectRuntime: nextRuntime,
      stackAnnouncements: nextAnnouncements,
    });
  } catch {
    fail('CANDIDATE_INVALID', '', 'Retarget candidate bundle could not be inspected safely');
  }
  if (!candidate.ok) {
    fail(
      'CANDIDATE_INVALID',
      '',
      'Retarget candidate bundle is invalid',
      nestedCandidateIssues(candidate),
    );
  }
  return deepFreezeStackTransactionV1({
    bundle: candidate.value,
    objectId: operation.objectId,
  });
}

export function retargetCoreStackObjectV1(
  bundleInput: unknown,
  input: unknown,
): CoreStackRetargetResultV1 {
  try {
    return retarget(bundleInput, input);
  } catch (error: unknown) {
    if (error instanceof CoreStackTransactionErrorV1) throw error;
    throw new CoreStackTransactionErrorV1('INVALID_OPERATION_INPUT', [
      issue(
        'INVALID_OPERATION_INPUT',
        '',
        'Retarget operation input could not be inspected safely',
        [{ code: 'INVALID_TYPE', path: '', message: 'Input descriptors are not readable' }],
      ),
    ]);
  }
}
