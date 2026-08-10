import type { CoreObjectId, CorePlayerId } from '../../ids';
import type { ModeNeutralCoreObjectRegistrySliceV2 } from '../../object/objectRegistryStateV2';
import type {
  CoreStackTransactionValidationIssueV1,
  CoreStackTransactionValidationResultV1,
} from './stackTransactionValidationV1';

export type StackTransactionNestedIssueV1 = Readonly<{
  readonly code: string;
  readonly path: string;
  readonly message: string;
}>;

export type StackTransactionBundlePartsV1 = Readonly<{
  readonly objectRegistry: unknown;
  readonly objectRuntime: unknown;
  readonly stackAnnouncements: unknown;
}>;

type RawRecord = Record<string, unknown>;

const BUNDLE_FIELDS = ['objectRegistry', 'objectRuntime', 'stackAnnouncements'] as const;

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function sortTransactionIssues<T extends StackTransactionNestedIssueV1>(
  issues: readonly T[],
): readonly T[] {
  return issues.slice().sort((left, right) =>
    codeUnitCompare(left.path, right.path)
    || codeUnitCompare(left.code, right.code)
    || codeUnitCompare(left.message, right.message));
}

function isPlainRecord(value: unknown): value is RawRecord {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function safeOwnKeys(value: object): readonly PropertyKey[] | null {
  try {
    return Reflect.ownKeys(value);
  } catch {
    return null;
  }
}

function nestedIssue(
  code: string,
  path: string,
  message: string,
): StackTransactionNestedIssueV1 {
  return { code, path, message };
}

export function inspectStackTransactionBundleInputV1(
  input: unknown,
): Readonly<{
  readonly ok: true;
  readonly value: StackTransactionBundlePartsV1;
}> | Readonly<{
  readonly ok: false;
  readonly issues: readonly StackTransactionNestedIssueV1[];
}> {
  if (!isPlainRecord(input)) {
    return { ok: false, issues: [nestedIssue('INVALID_TYPE', '', 'Expected a plain transaction bundle object')] };
  }

  const issues: StackTransactionNestedIssueV1[] = [];
  const values: Partial<Record<(typeof BUNDLE_FIELDS)[number], unknown>> = {};
  const keys = safeOwnKeys(input);
  if (keys === null) {
    return { ok: false, issues: [nestedIssue('INVALID_TYPE', '', 'Transaction bundle descriptors are not readable')] };
  }

  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.push(nestedIssue('UNKNOWN_FIELD', '/[symbol]', 'Symbol fields are not allowed'));
      continue;
    }
    if (!BUNDLE_FIELDS.includes(key as (typeof BUNDLE_FIELDS)[number])) {
      issues.push(nestedIssue('UNKNOWN_FIELD', `/${key}`, `Unknown field: ${key}`));
      continue;
    }
    const descriptor = (() => {
      try {
        return Object.getOwnPropertyDescriptor(input, key);
      } catch {
        return undefined;
      }
    })();
    if (descriptor === undefined) {
      issues.push(nestedIssue('INVALID_TYPE', `/${key}`, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor.enumerable !== true) {
      issues.push(nestedIssue('UNKNOWN_FIELD', `/${key}`, 'Fields must be enumerable'));
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      issues.push(nestedIssue('INVALID_TYPE', `/${key}`, 'Accessor properties are not allowed'));
      continue;
    }
    values[key as (typeof BUNDLE_FIELDS)[number]] = descriptor.value;
  }

  for (const key of BUNDLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      issues.push(nestedIssue('MISSING_FIELD', `/${key}`, `Missing field: ${key}`));
    }
  }
  if (issues.length > 0) return { ok: false, issues: sortTransactionIssues(issues) };

  return {
    ok: true,
    value: {
      objectRegistry: values.objectRegistry,
      objectRuntime: values.objectRuntime,
      stackAnnouncements: values.stackAnnouncements,
    },
  };
}

export function nestedTransactionIssuesV1(
  issues: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): readonly StackTransactionNestedIssueV1[] {
  return sortTransactionIssues(issues.map((issue) =>
    nestedIssue(issue.code, issue.path, issue.message)));
}

export function inspectionFailureIssueV1(): StackTransactionNestedIssueV1 {
  return nestedIssue('INVALID_TYPE', '', 'Constituent validation could not inspect input safely');
}

export function deepFreezeStackTransactionV1<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) {
      deepFreezeStackTransactionV1(descriptor.value, seen);
    }
  }
  Object.freeze(value);
  return value;
}

export function cloneTransactionIssuesV1(
  issues: readonly CoreStackTransactionValidationIssueV1[],
): readonly CoreStackTransactionValidationIssueV1[] {
  const cloned = issues.map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
    ...(issue.nested === undefined
      ? {}
      : { nested: issue.nested.map((nested) => ({
        code: nested.code,
        path: nested.path,
        message: nested.message,
      })) }),
  }));
  return deepFreezeStackTransactionV1(cloned);
}

export function freezeStackTransactionResultV1<T extends CoreStackTransactionValidationResultV1>(
  result: T,
): T {
  return deepFreezeStackTransactionV1(result);
}

export type CoreStackTransactionZoneV1 =
  | 'library'
  | 'hand'
  | 'graveyard'
  | 'battlefield'
  | 'stack'
  | 'exile'
  | 'command';

export type CoreStackTransactionObjectLocationV1 = Readonly<{
  readonly scope: 'player-scoped' | 'shared';
  readonly playerId: CorePlayerId | null;
  readonly zone: CoreStackTransactionZoneV1;
  readonly index: number;
}>;

export function locateCoreObjectExactlyOnceV1(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  objectId: CoreObjectId,
): CoreStackTransactionObjectLocationV1 | null {
  if (!Object.prototype.hasOwnProperty.call(registry.objects, objectId)) return null;
  const locations: CoreStackTransactionObjectLocationV1[] = [];
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      for (let index = 0; index < zones[zone].length; index += 1) {
        if (zones[zone][index] === objectId) {
          locations.push({ scope: 'player-scoped', playerId, zone, index });
        }
      }
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    for (let index = 0; index < registry.zones.shared[zone].length; index += 1) {
      if (registry.zones.shared[zone][index] === objectId) {
        locations.push({ scope: 'shared', playerId: null, zone, index });
      }
    }
  }
  return locations.length === 1 ? locations[0] : null;
}

export function rebuildRecordWithoutKeyV1<T>(
  source: Readonly<Record<string, T>>,
  removedKey: string,
): Readonly<Record<string, T>> {
  const result = Object.create(null) as Record<string, T>;
  for (const key of Object.keys(source)) {
    if (key !== removedKey) result[key] = source[key];
  }
  return result;
}

export function rebuildRecordWithKeyV1<T>(
  source: Readonly<Record<string, T>>,
  key: string,
  value: T,
): Readonly<Record<string, T>> {
  const result = Object.create(null) as Record<string, T>;
  let replaced = false;
  for (const currentKey of Object.keys(source)) {
    if (currentKey === key) {
      result[currentKey] = value;
      replaced = true;
    } else {
      result[currentKey] = source[currentKey];
    }
  }
  if (!replaced) result[key] = value;
  return result;
}

export function rebuildArrayWithoutIndexV1<T>(
  source: readonly T[],
  removedIndex: number,
): readonly T[] {
  return source.slice(0, removedIndex).concat(source.slice(removedIndex + 1));
}

export function rebuildArrayWithAppendedValueV1<T>(
  source: readonly T[],
  value: T,
): readonly T[] {
  return source.concat([value]);
}
