import { isCoreBaseId } from '../ids';
import type { CorePlayerId } from '../ids';

export type CoreLibraryPlacementV1 =
  | Readonly<{ kind: 'top' }>
  | Readonly<{ kind: 'bottom' }>
  | Readonly<{ kind: 'index'; index: number }>;

export type CoreCardZoneDestinationV1 =
  | Readonly<{ kind: 'owner-library'; placement: CoreLibraryPlacementV1 }>
  | Readonly<{ kind: 'owner-hand' }>
  | Readonly<{ kind: 'owner-graveyard' }>
  | Readonly<{ kind: 'battlefield'; baseControllerPlayerId: CorePlayerId }>
  | Readonly<{ kind: 'stack'; baseControllerPlayerId: CorePlayerId }>
  | Readonly<{ kind: 'exile' }>
  | Readonly<{ kind: 'command' }>;

export type CoreZoneDestinationValidationCode =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_ID'
  | 'INVALID_INTEGER';

export interface CoreZoneDestinationValidationIssue {
  readonly code: CoreZoneDestinationValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreZoneDestinationValidationResult =
  | {
      readonly ok: true;
      readonly value: CoreCardZoneDestinationV1;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CoreZoneDestinationValidationIssue[];
    };

export class CoreZoneDestinationCreationError extends Error {
  readonly issues: readonly CoreZoneDestinationValidationIssue[];

  constructor(issues: readonly CoreZoneDestinationValidationIssue[]) {
    super(`Invalid Core zone destination (${issues.length} issue(s))`);
    this.name = 'CoreZoneDestinationCreationError';
    this.issues = issues;
  }
}

const DESTINATION_FIELDS = ['kind', 'placement', 'baseControllerPlayerId'] as const;
const PLACEMENT_FIELDS = ['kind', 'index'] as const;

type RawRecord = Record<string, unknown>;

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function escapePointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pointer(path: string, segment: string): string {
  return `${path}/${escapePointerSegment(segment)}`;
}

function isPlainRecord(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataDescriptorValue(
  descriptor: PropertyDescriptor | undefined,
): { readonly value: unknown } | null {
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
  return { value: descriptor.value };
}

class IssueCollector {
  private readonly values: CoreZoneDestinationValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreZoneDestinationValidationCode, path: string, message: string): void {
    const key = `${path}\u0000${code}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.values.push({ code, path, message });
  }

  sorted(): readonly CoreZoneDestinationValidationIssue[] {
    return this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code));
  }
}

function hasOwn(record: RawRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readObject(
  value: unknown,
  path: string,
  allowedFields: readonly string[],
  requiredFields: readonly string[],
  issues: IssueCollector,
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_TYPE', path, 'Expected a plain object');
    return null;
  }

  const allowed = new Set(allowedFields);
  const result: RawRecord = Object.create(null) as RawRecord;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', pointer(path, String(key)), 'Symbol fields are not allowed');
      continue;
    }

    const fieldPath = pointer(path, key);
    if (!allowed.has(key)) {
      issues.add('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`);
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable) {
      issues.add('UNKNOWN_FIELD', fieldPath, 'Non-enumerable fields are not allowed');
      continue;
    }
    const data = dataDescriptorValue(descriptor);
    if (data === null) {
      issues.add('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed');
      continue;
    }
    result[key] = data.value;
  }

  for (const field of requiredFields) {
    if (!hasOwn(result, field)) {
      issues.add('MISSING_FIELD', pointer(path, field), `Missing field: ${field}`);
    }
  }
  return result;
}

function validatePlayerId(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CorePlayerId | null {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a Core player ID string');
    return null;
  }
  if (!isCoreBaseId(value)) {
    issues.add('INVALID_ID', path, 'Invalid Core player ID');
    return null;
  }
  return value as CorePlayerId;
}

function validateIndex(
  value: unknown,
  path: string,
  issues: IssueCollector,
): number | null {
  if (typeof value !== 'number') {
    issues.add('INVALID_TYPE', path, 'Expected a number');
    return null;
  }
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
    issues.add('INVALID_INTEGER', path, 'Expected a non-negative safe integer');
    return null;
  }
  return value;
}

function validatePlacement(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CoreLibraryPlacementV1 | null {
  const placement = readObject(value, path, PLACEMENT_FIELDS, ['kind'], issues);
  if (placement === null || !hasOwn(placement, 'kind')) return null;

  const kindPath = pointer(path, 'kind');
  if (typeof placement.kind !== 'string') {
    issues.add('INVALID_TYPE', kindPath, 'Expected a library placement kind');
    return null;
  }

  if (placement.kind === 'top') {
    if (hasOwn(placement, 'index')) {
      issues.add('UNKNOWN_FIELD', pointer(path, 'index'), 'index is not valid for top placement');
    }
    return Object.freeze({ kind: 'top' as const });
  }

  if (placement.kind === 'bottom') {
    if (hasOwn(placement, 'index')) {
      issues.add('UNKNOWN_FIELD', pointer(path, 'index'), 'index is not valid for bottom placement');
    }
    return Object.freeze({ kind: 'bottom' as const });
  }

  if (placement.kind === 'index') {
    if (!hasOwn(placement, 'index')) {
      issues.add('MISSING_FIELD', pointer(path, 'index'), 'Missing field: index');
      return null;
    }
    const index = validateIndex(placement.index, pointer(path, 'index'), issues);
    if (index === null) return null;
    return Object.freeze({ kind: 'index' as const, index });
  }

  issues.add('INVALID_LITERAL', kindPath, 'Unknown library placement kind');
  return null;
}

function validateDestination(
  value: unknown,
  issues: IssueCollector,
): CoreCardZoneDestinationV1 | null {
  const destination = readObject(value, '', DESTINATION_FIELDS, ['kind'], issues);
  if (destination === null || !hasOwn(destination, 'kind')) return null;

  const kindPath = pointer('', 'kind');
  if (typeof destination.kind !== 'string') {
    issues.add('INVALID_TYPE', kindPath, 'Expected a zone destination kind');
    return null;
  }

  if (destination.kind === 'owner-library') {
    if (hasOwn(destination, 'baseControllerPlayerId')) {
      issues.add(
        'UNKNOWN_FIELD',
        pointer('', 'baseControllerPlayerId'),
        'baseControllerPlayerId is not valid for an owner-library destination',
      );
    }
    if (!hasOwn(destination, 'placement')) {
      issues.add('MISSING_FIELD', pointer('', 'placement'), 'Missing field: placement');
      return null;
    }
    const placement = validatePlacement(destination.placement, '/placement', issues);
    if (placement === null) return null;
    return Object.freeze({ kind: 'owner-library' as const, placement });
  }

  if (destination.kind === 'owner-hand') {
    if (hasOwn(destination, 'placement')) {
      issues.add('UNKNOWN_FIELD', pointer('', 'placement'), 'placement is not valid for an owner-hand destination');
    }
    if (hasOwn(destination, 'baseControllerPlayerId')) {
      issues.add(
        'UNKNOWN_FIELD',
        pointer('', 'baseControllerPlayerId'),
        'baseControllerPlayerId is not valid for an owner-hand destination',
      );
    }
    return Object.freeze({ kind: 'owner-hand' as const });
  }

  if (destination.kind === 'owner-graveyard') {
    if (hasOwn(destination, 'placement')) {
      issues.add('UNKNOWN_FIELD', pointer('', 'placement'), 'placement is not valid for an owner-graveyard destination');
    }
    if (hasOwn(destination, 'baseControllerPlayerId')) {
      issues.add(
        'UNKNOWN_FIELD',
        pointer('', 'baseControllerPlayerId'),
        'baseControllerPlayerId is not valid for an owner-graveyard destination',
      );
    }
    return Object.freeze({ kind: 'owner-graveyard' as const });
  }

  if (destination.kind === 'battlefield' || destination.kind === 'stack') {
    if (hasOwn(destination, 'placement')) {
      issues.add(
        'UNKNOWN_FIELD',
        pointer('', 'placement'),
        `placement is not valid for a ${destination.kind} destination`,
      );
    }
    if (!hasOwn(destination, 'baseControllerPlayerId')) {
      issues.add(
        'MISSING_FIELD',
        pointer('', 'baseControllerPlayerId'),
        'Missing field: baseControllerPlayerId',
      );
      return null;
    }
    const playerId = validatePlayerId(
      destination.baseControllerPlayerId,
      pointer('', 'baseControllerPlayerId'),
      issues,
    );
    if (playerId === null) return null;
    if (destination.kind === 'battlefield') {
      return Object.freeze({ kind: 'battlefield' as const, baseControllerPlayerId: playerId });
    }
    return Object.freeze({ kind: 'stack' as const, baseControllerPlayerId: playerId });
  }

  if (destination.kind === 'exile') {
    if (hasOwn(destination, 'placement')) {
      issues.add('UNKNOWN_FIELD', pointer('', 'placement'), 'placement is not valid for an exile destination');
    }
    if (hasOwn(destination, 'baseControllerPlayerId')) {
      issues.add(
        'UNKNOWN_FIELD',
        pointer('', 'baseControllerPlayerId'),
        'baseControllerPlayerId is not valid for an exile destination',
      );
    }
    return Object.freeze({ kind: 'exile' as const });
  }

  if (destination.kind === 'command') {
    if (hasOwn(destination, 'placement')) {
      issues.add('UNKNOWN_FIELD', pointer('', 'placement'), 'placement is not valid for a command destination');
    }
    if (hasOwn(destination, 'baseControllerPlayerId')) {
      issues.add(
        'UNKNOWN_FIELD',
        pointer('', 'baseControllerPlayerId'),
        'baseControllerPlayerId is not valid for a command destination',
      );
    }
    return Object.freeze({ kind: 'command' as const });
  }

  issues.add('INVALID_LITERAL', kindPath, 'Unknown zone destination kind');
  return null;
}

export function validateCoreCardZoneDestinationV1(
  input: unknown,
): CoreZoneDestinationValidationResult {
  const issues = new IssueCollector();
  if (!isPlainRecord(input)) {
    issues.add('INVALID_ROOT', '', 'Expected a plain root object');
    return { ok: false, issues: issues.sorted() };
  }

  const value = validateDestination(input, issues);
  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0 || value === null) return { ok: false, issues: sortedIssues };
  return { ok: true, value };
}

export function createCoreCardZoneDestinationV1(
  input: unknown,
): CoreCardZoneDestinationV1 {
  const validation = validateCoreCardZoneDestinationV1(input);
  if (!validation.ok) throw new CoreZoneDestinationCreationError(validation.issues);
  return validation.value;
}
