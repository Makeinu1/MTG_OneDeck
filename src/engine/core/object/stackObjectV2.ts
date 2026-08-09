import { isCoreBaseId } from '../ids';
import type { CoreCardDefinitionId, CoreObjectId, CorePlayerId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from './objectIdV2';

export {
  coreActivatedAbilityObjectIdOfV2,
  coreSpellCopyObjectIdOfV2,
  coreTokenObjectIdOfV2,
  coreTriggeredAbilityObjectIdOfV2,
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
} from './objectIdV2';
export type { CoreObjectIdKindV2, ParsedCoreObjectIdV2 } from './objectIdV2';

export interface CoreSpellCopyObjectIdentityV2 {
  readonly kind: 'spell-copy';
  readonly definitionId: CoreCardDefinitionId;
  readonly controllerPlayerId: CorePlayerId;
  readonly copiedFromObjectId: CoreObjectId;
}

export interface CoreActivatedAbilityObjectIdentityV2 {
  readonly kind: 'activated-ability';
  readonly controllerPlayerId: CorePlayerId;
  readonly sourceObjectId: CoreObjectId | null;
  readonly abilityKey: string;
}

export interface CoreTriggeredAbilityObjectIdentityV2 {
  readonly kind: 'triggered-ability';
  readonly controllerPlayerId: CorePlayerId;
  readonly sourceObjectId: CoreObjectId | null;
  readonly abilityKey: string;
}

export type CoreStackObjectIdentityV2 =
  | CoreSpellCopyObjectIdentityV2
  | CoreActivatedAbilityObjectIdentityV2
  | CoreTriggeredAbilityObjectIdentityV2;

export type CoreStackObjectKindV2 = CoreStackObjectIdentityV2['kind'];

export type CoreStackObjectValidationCode =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_ID'
  | 'INVALID_STRING';

export interface CoreStackObjectValidationIssue {
  readonly code: CoreStackObjectValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreStackObjectValidationResult =
  | {
      readonly ok: true;
      readonly value: CoreStackObjectIdentityV2;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CoreStackObjectValidationIssue[];
    };

export type CoreSpellCopyObjectValidationCode = CoreStackObjectValidationCode;
export type CoreActivatedAbilityObjectValidationCode = CoreStackObjectValidationCode;
export type CoreTriggeredAbilityObjectValidationCode = CoreStackObjectValidationCode;

export type CoreSpellCopyObjectValidationIssue = CoreStackObjectValidationIssue;
export type CoreActivatedAbilityObjectValidationIssue = CoreStackObjectValidationIssue;
export type CoreTriggeredAbilityObjectValidationIssue = CoreStackObjectValidationIssue;

export type CoreSpellCopyObjectValidationResult =
  | { readonly ok: true; readonly value: CoreSpellCopyObjectIdentityV2 }
  | { readonly ok: false; readonly issues: readonly CoreSpellCopyObjectValidationIssue[] };

export type CoreActivatedAbilityObjectValidationResult =
  | { readonly ok: true; readonly value: CoreActivatedAbilityObjectIdentityV2 }
  | { readonly ok: false; readonly issues: readonly CoreActivatedAbilityObjectValidationIssue[] };

export type CoreTriggeredAbilityObjectValidationResult =
  | { readonly ok: true; readonly value: CoreTriggeredAbilityObjectIdentityV2 }
  | { readonly ok: false; readonly issues: readonly CoreTriggeredAbilityObjectValidationIssue[] };

export class CoreStackObjectCreationError extends Error {
  readonly issues: readonly CoreStackObjectValidationIssue[];

  constructor(issues: readonly CoreStackObjectValidationIssue[]) {
    super(`Invalid Core stack object identity (${issues.length} issue(s))`);
    this.name = 'CoreStackObjectCreationError';
    this.issues = issues;
  }
}

export class CoreSpellCopyObjectCreationError extends CoreStackObjectCreationError {
  constructor(issues: readonly CoreSpellCopyObjectValidationIssue[]) {
    super(issues);
    this.name = 'CoreSpellCopyObjectCreationError';
  }
}

export class CoreActivatedAbilityObjectCreationError extends CoreStackObjectCreationError {
  constructor(issues: readonly CoreActivatedAbilityObjectValidationIssue[]) {
    super(issues);
    this.name = 'CoreActivatedAbilityObjectCreationError';
  }
}

export class CoreTriggeredAbilityObjectCreationError extends CoreStackObjectCreationError {
  constructor(issues: readonly CoreTriggeredAbilityObjectValidationIssue[]) {
    super(issues);
    this.name = 'CoreTriggeredAbilityObjectCreationError';
  }
}

const SPELL_COPY_FIELDS = [
  'kind',
  'definitionId',
  'controllerPlayerId',
  'copiedFromObjectId',
] as const;
const ACTIVATED_ABILITY_FIELDS = [
  'kind',
  'controllerPlayerId',
  'sourceObjectId',
  'abilityKey',
] as const;
const TRIGGERED_ABILITY_FIELDS = [
  'kind',
  'controllerPlayerId',
  'sourceObjectId',
  'abilityKey',
] as const;
const ALL_FIELDS = [
  'kind',
  'definitionId',
  'controllerPlayerId',
  'copiedFromObjectId',
  'sourceObjectId',
  'abilityKey',
] as const;

type RawRecord = Record<string, unknown>;

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function escapePointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pointer(path: string, segment: string): string {
  return `${path}/${escapePointerSegment(segment)}`;
}

function isPlainRecord(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object') return false;
  try {
    if (Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function dataDescriptorValue(descriptor: PropertyDescriptor | undefined): { readonly value: unknown } | null {
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
  return { value: descriptor.value };
}

class IssueCollector {
  private readonly values: CoreStackObjectValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreStackObjectValidationCode, path: string, message: string): void {
    const key = `${path}\u0000${code}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.values.push(Object.freeze({ code, path, message }));
  }

  sorted(): readonly CoreStackObjectValidationIssue[] {
    return Object.freeze(this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code)));
  }
}

function readObject(
  value: unknown,
  fields: readonly string[],
  issues: IssueCollector,
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_ROOT', '', 'Expected a plain root object');
    return null;
  }

  const allowed = new Set(fields);
  const result: RawRecord = Object.create(null) as RawRecord;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issues.add('INVALID_ROOT', '', 'Input could not be inspected safely');
    return null;
  }

  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', pointer('', String(key)), 'Symbol fields are not allowed');
      continue;
    }

    const fieldPath = pointer('', key);
    if (!allowed.has(key)) {
      issues.add('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`);
      continue;
    }

    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.add('INVALID_ROOT', '', 'Input could not be inspected safely');
      return null;
    }
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

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.add('MISSING_FIELD', pointer('', field), `Missing field: ${field}`);
    }
  }
  return result;
}

function hasOwn(record: RawRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function literalValue(
  value: unknown,
  expected: CoreStackObjectKindV2,
  path: string,
  issues: IssueCollector,
): void {
  if (value !== expected) {
    issues.add('INVALID_LITERAL', path, `Expected kind ${expected}`);
  }
}

function baseIdValue(value: unknown, path: string, issues: IssueCollector): string | null {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a Core base ID string');
    return null;
  }
  if (!isCoreBaseId(value)) {
    issues.add('INVALID_ID', path, 'Invalid Core base ID');
  }
  return value;
}

function objectIdValue(value: unknown, path: string, issues: IssueCollector): CoreObjectId | null {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a Core object ID string');
    return null;
  }
  if (!isCanonicalCoreObjectIdV2(value)) {
    issues.add('INVALID_ID', path, 'Invalid canonical Core object ID V2');
    return null;
  }
  return value;
}

function abilityKeyValue(value: unknown, path: string, issues: IssueCollector): string | null {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a Core ability key string');
    return null;
  }
  if (!isCoreBaseId(value)) {
    issues.add('INVALID_STRING', path, 'Ability key must follow the Core base-ID grammar');
  }
  return value;
}

function sourceObjectIdValue(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CoreObjectId | null {
  if (value === null) return null;
  return objectIdValue(value, path, issues);
}

function successful<T extends CoreStackObjectIdentityV2>(
  issues: IssueCollector,
  value: T,
): { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: readonly CoreStackObjectValidationIssue[] } {
  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0) return { ok: false, issues: sortedIssues };
  return { ok: true, value: Object.freeze(value) };
}

function validateSpellCopy(value: unknown): CoreSpellCopyObjectValidationResult {
  const issues = new IssueCollector();
  const root = readObject(value, SPELL_COPY_FIELDS, issues);
  if (root === null) return { ok: false, issues: issues.sorted() };

  literalValue(root.kind, 'spell-copy', '/kind', issues);
  const definitionId = hasOwn(root, 'definitionId')
    ? baseIdValue(root.definitionId, '/definitionId', issues)
    : null;
  const controllerPlayerId = hasOwn(root, 'controllerPlayerId')
    ? baseIdValue(root.controllerPlayerId, '/controllerPlayerId', issues)
    : null;
  const copiedFromObjectId = hasOwn(root, 'copiedFromObjectId')
    ? objectIdValue(root.copiedFromObjectId, '/copiedFromObjectId', issues)
    : null;

  return successful(issues, {
    kind: 'spell-copy',
    definitionId: definitionId as CoreCardDefinitionId,
    controllerPlayerId: controllerPlayerId as CorePlayerId,
    copiedFromObjectId: copiedFromObjectId as CoreObjectId,
  });
}

function validateActivatedAbility(value: unknown): CoreActivatedAbilityObjectValidationResult {
  const issues = new IssueCollector();
  const root = readObject(value, ACTIVATED_ABILITY_FIELDS, issues);
  if (root === null) return { ok: false, issues: issues.sorted() };

  literalValue(root.kind, 'activated-ability', '/kind', issues);
  const controllerPlayerId = hasOwn(root, 'controllerPlayerId')
    ? baseIdValue(root.controllerPlayerId, '/controllerPlayerId', issues)
    : null;
  const sourceObjectId = hasOwn(root, 'sourceObjectId')
    ? sourceObjectIdValue(root.sourceObjectId, '/sourceObjectId', issues)
    : null;
  const abilityKey = hasOwn(root, 'abilityKey')
    ? abilityKeyValue(root.abilityKey, '/abilityKey', issues)
    : null;

  return successful(issues, {
    kind: 'activated-ability',
    controllerPlayerId: controllerPlayerId as CorePlayerId,
    sourceObjectId,
    abilityKey: abilityKey as string,
  });
}

function validateTriggeredAbility(value: unknown): CoreTriggeredAbilityObjectValidationResult {
  const issues = new IssueCollector();
  const root = readObject(value, TRIGGERED_ABILITY_FIELDS, issues);
  if (root === null) return { ok: false, issues: issues.sorted() };

  literalValue(root.kind, 'triggered-ability', '/kind', issues);
  const controllerPlayerId = hasOwn(root, 'controllerPlayerId')
    ? baseIdValue(root.controllerPlayerId, '/controllerPlayerId', issues)
    : null;
  const sourceObjectId = hasOwn(root, 'sourceObjectId')
    ? sourceObjectIdValue(root.sourceObjectId, '/sourceObjectId', issues)
    : null;
  const abilityKey = hasOwn(root, 'abilityKey')
    ? abilityKeyValue(root.abilityKey, '/abilityKey', issues)
    : null;

  return successful(issues, {
    kind: 'triggered-ability',
    controllerPlayerId: controllerPlayerId as CorePlayerId,
    sourceObjectId,
    abilityKey: abilityKey as string,
  });
}

export function validateCoreSpellCopyObjectIdentityV2(
  value: unknown,
): CoreSpellCopyObjectValidationResult {
  return validateSpellCopy(value);
}

export function validateCoreActivatedAbilityObjectIdentityV2(
  value: unknown,
): CoreActivatedAbilityObjectValidationResult {
  return validateActivatedAbility(value);
}

export function validateCoreTriggeredAbilityObjectIdentityV2(
  value: unknown,
): CoreTriggeredAbilityObjectValidationResult {
  return validateTriggeredAbility(value);
}

export function validateCoreStackObjectIdentityV2(
  value: unknown,
): CoreStackObjectValidationResult {
  if (!isPlainRecord(value)) {
    const issues = new IssueCollector();
    issues.add('INVALID_ROOT', '', 'Expected a plain root object');
    return { ok: false, issues: issues.sorted() };
  }

  let kindDescriptor: PropertyDescriptor | undefined;
  try {
    kindDescriptor = Object.getOwnPropertyDescriptor(value, 'kind');
  } catch {
    const issues = new IssueCollector();
    issues.add('INVALID_ROOT', '', 'Input could not be inspected safely');
    return { ok: false, issues: issues.sorted() };
  }
  const kindValue = dataDescriptorValue(kindDescriptor)?.value;
  if (typeof kindValue === 'string') {
    if (kindValue === 'spell-copy') return validateSpellCopy(value);
    if (kindValue === 'activated-ability') return validateActivatedAbility(value);
    if (kindValue === 'triggered-ability') return validateTriggeredAbility(value);
  }

  const issues = new IssueCollector();
  const root = readObject(value, ALL_FIELDS, issues);
  if (root !== null && hasOwn(root, 'kind')) {
    if (typeof root.kind !== 'string') {
      issues.add('INVALID_TYPE', '/kind', 'Expected a stack object kind');
    } else {
      issues.add('INVALID_LITERAL', '/kind', 'Unknown stack object kind');
    }
  }
  return { ok: false, issues: issues.sorted() };
}

export function createCoreSpellCopyObjectIdentityV2(
  input: unknown,
): CoreSpellCopyObjectIdentityV2 {
  const validation = validateSpellCopy(factoryCandidate(input, 'spell-copy', (issues) =>
    new CoreSpellCopyObjectCreationError(issues)));
  if (!validation.ok) throw new CoreSpellCopyObjectCreationError(validation.issues);
  return validation.value;
}

export function createCoreActivatedAbilityObjectIdentityV2(
  input: unknown,
): CoreActivatedAbilityObjectIdentityV2 {
  const validation = validateActivatedAbility(factoryCandidate(input, 'activated-ability', (issues) =>
    new CoreActivatedAbilityObjectCreationError(issues)));
  if (!validation.ok) throw new CoreActivatedAbilityObjectCreationError(validation.issues);
  return validation.value;
}

export function createCoreTriggeredAbilityObjectIdentityV2(
  input: unknown,
): CoreTriggeredAbilityObjectIdentityV2 {
  const validation = validateTriggeredAbility(factoryCandidate(input, 'triggered-ability', (issues) =>
    new CoreTriggeredAbilityObjectCreationError(issues)));
  if (!validation.ok) throw new CoreTriggeredAbilityObjectCreationError(validation.issues);
  return validation.value;
}

export function createCoreStackObjectIdentityV2(input: unknown): CoreStackObjectIdentityV2 {
  const validation = validateCoreStackObjectIdentityV2(input);
  if (!validation.ok) throw new CoreStackObjectCreationError(validation.issues);
  return validation.value;
}

function factoryCandidate(
  input: unknown,
  kind: CoreStackObjectKindV2 | null,
  createError: (issues: readonly CoreStackObjectValidationIssue[]) => CoreStackObjectCreationError,
): unknown {
  if (!isPlainRecord(input)) return input;
  if (Object.prototype.hasOwnProperty.call(input, 'kind')) {
    throw createError(factoryKindIssues());
  }
  const candidate: RawRecord = Object.create(null) as RawRecord;
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor !== undefined) Object.defineProperty(candidate, key, descriptor);
  }
  if (kind !== null) {
    Object.defineProperty(candidate, 'kind', {
      value: kind,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return candidate;
}

function factoryKindIssues(): readonly CoreStackObjectValidationIssue[] {
  return Object.freeze([
    Object.freeze({
      code: 'UNKNOWN_FIELD' as const,
      path: '/kind',
      message: 'Factory input must omit kind',
    }),
  ]);
}

export function isCanonicalCoreAbilityKeyV2(value: unknown): value is string {
  return isCoreBaseId(value);
}

export const validateCoreSpellCopyIdentityV2 = validateCoreSpellCopyObjectIdentityV2;
export const validateCoreActivatedAbilityIdentityV2 = validateCoreActivatedAbilityObjectIdentityV2;
export const validateCoreTriggeredAbilityIdentityV2 = validateCoreTriggeredAbilityObjectIdentityV2;
export const createCoreSpellCopyIdentityV2 = createCoreSpellCopyObjectIdentityV2;
export const createCoreActivatedAbilityIdentityV2 = createCoreActivatedAbilityObjectIdentityV2;
export const createCoreTriggeredAbilityIdentityV2 = createCoreTriggeredAbilityObjectIdentityV2;

