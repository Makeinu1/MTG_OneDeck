import type { CoreObjectId } from '../ids';
import {
  validateModeNeutralCoreObjectRegistrySliceV2,
} from '../object/objectRegistryValidationV2';
import {
  validateCoreStackChoiceKeyV1,
} from './announcementPrimitivesV1';
import {
  validateCoreStackChosenModeKeysV1,
  validateCoreStackCostChoiceSetV1,
  validateCoreStackVariableAnnouncementsV1,
} from './choiceAnnouncementV1';
import {
  validateCoreStackTargetSelectionsV1,
} from './targetAnnouncementV1';
import type {
  CoreStackAnnouncementRecordV1,
  CoreStackDistributionAnnouncementV1,
} from './stackAnnouncementRecordV1';
import type { ModeNeutralCoreStackAnnouncementSliceV1 } from './stackAnnouncementSliceV1';
import { canonicalizeModeNeutralCoreStackAnnouncementEntriesV1 } from './stackAnnouncementCanonicalizationV1';

export type CoreStackAnnouncementValidationCode =
  | 'INVALID_ROOT' | 'INVALID_OBJECT_REGISTRY' | 'MISSING_FIELD' | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE' | 'INVALID_LITERAL' | 'INVALID_ID' | 'UNSAFE_RECORD_KEY'
  | 'INVALID_STRING' | 'INVALID_INTEGER' | 'INVALID_ARRAY' | 'INVALID_ORDER'
  | 'DUPLICATE_VALUE' | 'STACK_OBJECT_SET_MISMATCH' | 'ANNOUNCEMENT_KIND_MISMATCH'
  | 'INVALID_ABILITY_TEXT' | 'DUPLICATE_TARGET_SELECTION_ID'
  | 'DUPLICATE_TARGET_IN_GROUP' | 'DISTRIBUTION_TARGET_NOT_FOUND'
  | 'DUPLICATE_DISTRIBUTION_TARGET' | 'INVALID_COST_CHOICE';

export type CoreStackAnnouncementValidationIssue = Readonly<{
  readonly code: CoreStackAnnouncementValidationCode;
  readonly path: string;
  readonly message: string;
}>;

export type CoreStackAnnouncementValidationResult =
  | Readonly<{ ok: true; value: ModeNeutralCoreStackAnnouncementSliceV1 }>
  | Readonly<{ ok: false; issues: readonly CoreStackAnnouncementValidationIssue[] }>;

type Raw = Record<string, unknown>;
type AnnouncementKind = CoreStackAnnouncementRecordV1['kind'];
const ROOT_FIELDS = ['kind', 'byObject'] as const;
const RECORD_FIELDS = ['kind', 'abilityTextSnapshot', 'chosenModeKeys', 'targetSelections', 'announcedVariables', 'distributions', 'costChoices'] as const;
const DISTRIBUTION_FIELDS = ['distributionKey', 'assignments'] as const;
const ASSIGNMENT_FIELDS = ['targetSelectionId', 'amount'] as const;
const UNSAFE = new Set(['__proto__', 'prototype', 'constructor']);

function cmp(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const difference = a.charCodeAt(i) - b.charCodeAt(i);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}
function esc(value: string): string { return value.replaceAll('~', '~0').replaceAll('/', '~1'); }
function path(parent: string, child: string): string { return `${parent}/${esc(child)}`; }
function issue(code: CoreStackAnnouncementValidationCode, at: string, message: string): CoreStackAnnouncementValidationIssue {
  return Object.freeze({ code, path: at, message });
}
function sorted(issues: readonly CoreStackAnnouncementValidationIssue[]): readonly CoreStackAnnouncementValidationIssue[] {
  return Object.freeze([...issues].sort((a, b) => cmp(a.path, b.path) || cmp(a.code, b.code)));
}
function plain(value: unknown): value is Raw {
  try { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null); } catch { return false; }
}
function has(record: Raw, key: string): boolean { return Object.prototype.hasOwnProperty.call(record, key); }
function safeOwnKeys(value: unknown): readonly PropertyKey[] | null {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return null;
  try { return Reflect.ownKeys(value); } catch { return null; }
}
function isAnnouncementKind(value: unknown): value is AnnouncementKind {
  return value === 'card-spell' || value === 'spell-copy' || value === 'activated-ability' || value === 'triggered-ability';
}
function readRecord(value: unknown, at: string, fields: readonly string[], issues: CoreStackAnnouncementValidationIssue[]): Raw | null {
  if (!plain(value)) { issues.push(issue('INVALID_TYPE', at, 'Expected a plain object')); return null; }
  const result = Object.create(null) as Raw;
  const keys = safeOwnKeys(value);
  if (keys === null) { issues.push(issue('INVALID_TYPE', at, 'Object descriptors are not readable')); return null; }
  for (const key of keys) {
    if (typeof key !== 'string') { issues.push(issue('UNKNOWN_FIELD', path(at, String(key)), 'Symbol fields are not allowed')); continue; }
    const fieldPath = path(at, key);
    if (UNSAFE.has(key)) { issues.push(issue('UNSAFE_RECORD_KEY', fieldPath, `Unsafe record key: ${key}`)); continue; }
    if (!fields.includes(key)) { issues.push(issue('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`)); continue; }
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { issues.push(issue('INVALID_TYPE', fieldPath, 'Field descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true) { issues.push(issue('UNKNOWN_FIELD', fieldPath, 'Fields must be enumerable')); continue; }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) { issues.push(issue('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed')); continue; }
    result[key] = descriptor.value;
  }
  for (const field of fields) if (!has(result, field)) issues.push(issue('MISSING_FIELD', path(at, field), 'Required field is missing'));
  return result;
}
function readArray(value: unknown, at: string, issues: CoreStackAnnouncementValidationIssue[]): readonly unknown[] | null {
  let isArray: boolean;
  try { isArray = Array.isArray(value); } catch { issues.push(issue('INVALID_ARRAY', at, 'Array shape is not readable')); return null; }
  if (!isArray) { issues.push(issue('INVALID_ARRAY', at, 'Expected an array')); return null; }
  try { if (Reflect.getPrototypeOf(value as object) !== Array.prototype) issues.push(issue('INVALID_ARRAY', at, 'Expected an ordinary array')); } catch { issues.push(issue('INVALID_ARRAY', at, 'Array prototype is not readable')); }
  let length: number;
  try { length = (value as readonly unknown[]).length; } catch { issues.push(issue('INVALID_ARRAY', at, 'Array length is not readable')); return null; }
  const result: unknown[] = [];
  const present = new Set<string>();
  const keys = safeOwnKeys(value);
  if (keys === null) { issues.push(issue('INVALID_ARRAY', at, 'Array descriptors are not readable')); return null; }
  const allowed = new Set(['length']);
  for (let i = 0; i < length; i += 1) allowed.add(String(i));
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) { issues.push(issue('INVALID_ARRAY', path(at, typeof key === 'string' ? key : String(key)), 'Extra array properties are not allowed')); continue; }
    if (key === 'length') continue;
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { issues.push(issue('INVALID_ARRAY', path(at, key), 'Array entry descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { issues.push(issue('INVALID_ARRAY', path(at, key), 'Array entries must be dense enumerable data properties')); continue; }
    result[Number(key)] = descriptor.value;
    present.add(key);
  }
  for (let i = 0; i < length; i += 1) if (!present.has(String(i))) issues.push(issue('INVALID_ARRAY', path(at, String(i)), 'Sparse arrays are not allowed'));
  return result;
}
function mapIssues(found: readonly { readonly code: string; readonly path: string; readonly message: string }[], prefix: string, issues: CoreStackAnnouncementValidationIssue[]): void {
  for (const current of found) {
    const currentPath = current.path === '' ? prefix : `${prefix}${current.path}`;
    if (isAnnouncementValidationCode(current.code)) {
      issues.push(issue(current.code, currentPath, current.message));
    } else {
      issues.push(issue('INVALID_TYPE', currentPath, `Unsupported delegated validation code: ${current.code}`));
    }
  }
}
function isAnnouncementValidationCode(value: string): value is CoreStackAnnouncementValidationCode {
  switch (value) {
    case 'INVALID_ROOT': case 'INVALID_OBJECT_REGISTRY': case 'MISSING_FIELD': case 'UNKNOWN_FIELD':
    case 'INVALID_TYPE': case 'INVALID_LITERAL': case 'INVALID_ID': case 'UNSAFE_RECORD_KEY':
    case 'INVALID_STRING': case 'INVALID_INTEGER': case 'INVALID_ARRAY': case 'INVALID_ORDER':
    case 'DUPLICATE_VALUE': case 'STACK_OBJECT_SET_MISMATCH': case 'ANNOUNCEMENT_KIND_MISMATCH':
    case 'INVALID_ABILITY_TEXT': case 'DUPLICATE_TARGET_SELECTION_ID': case 'DUPLICATE_TARGET_IN_GROUP':
    case 'DISTRIBUTION_TARGET_NOT_FOUND': case 'DUPLICATE_DISTRIBUTION_TARGET': case 'INVALID_COST_CHOICE':
      return true;
    default:
      return false;
  }
}
function key(value: unknown, at: string, issues: CoreStackAnnouncementValidationIssue[]): value is string {
  const result = validateCoreStackChoiceKeyV1(value);
  if (!result.ok) { mapIssues(result.issues, at, issues); return false; }
  return true;
}
function positiveInteger(value: unknown, at: string, issues: CoreStackAnnouncementValidationIssue[]): value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) { issues.push(issue('INVALID_INTEGER', at, 'Expected a positive safe integer')); return false; }
  return true;
}
function abilityText(value: unknown, at: string, required: boolean, issues: CoreStackAnnouncementValidationIssue[]): value is string | null {
  if (!required) { if (value !== null) issues.push(issue('INVALID_ABILITY_TEXT', at, 'Card spells and copies require null abilityTextSnapshot')); return value === null; }
  if (typeof value !== 'string') { issues.push(issue('INVALID_ABILITY_TEXT', at, 'Ability text snapshot must be a string')); return false; }
  const count = [...value].length;
  if (count < 1 || count > 16384 || value.includes('\u0000') || value.includes('\r') || /^\s|\s$/u.test(value)) issues.push(issue('INVALID_ABILITY_TEXT', at, 'Invalid ability text snapshot')); 
  return true;
}
function sortedUnique(values: readonly string[], at: string, issues: CoreStackAnnouncementValidationIssue[]): void {
  const seen = new Set<string>();
  values.forEach((value, index) => { if (seen.has(value)) issues.push(issue('DUPLICATE_VALUE', path(at, String(index)), 'Duplicate key')); seen.add(value); if (index > 0 && cmp(values[index - 1], value) >= 0) issues.push(issue('INVALID_ORDER', path(at, String(index)), 'Keys must be strictly code-unit ascending')); });
}
function requireOrdinaryArray(value: unknown, at: string, issues: CoreStackAnnouncementValidationIssue[]): void {
  if (!Array.isArray(value)) return;
  try { if (Reflect.getPrototypeOf(value) !== Array.prototype) issues.push(issue('INVALID_ARRAY', at, 'Expected an ordinary array')); } catch { issues.push(issue('INVALID_ARRAY', at, 'Array prototype is not readable')); }
}

function validateDistributions(value: unknown, at: string, selectionOrder: ReadonlyMap<string, number>, issues: CoreStackAnnouncementValidationIssue[]): readonly CoreStackDistributionAnnouncementV1[] {
  const input = readArray(value, at, issues); const output: CoreStackDistributionAnnouncementV1[] = []; const keys: string[] = [];
  input?.forEach((entry, index) => {
    const itemAt = path(at, String(index)); const row = readRecord(entry, itemAt, DISTRIBUTION_FIELDS, issues); if (row === null) return;
    const distributionKey = row.distributionKey; const distributionOk = key(distributionKey, path(itemAt, 'distributionKey'), issues); if (distributionOk) keys.push(distributionKey);
    const assignments = readArray(row.assignments, path(itemAt, 'assignments'), issues); const assignmentOutput: { targetSelectionId: string; amount: number }[] = []; const assignmentIds = new Set<string>(); let previousOrder = -1;
    assignments?.forEach((assignment, assignmentIndex) => { const assignmentAt = path(path(itemAt, 'assignments'), String(assignmentIndex)); const assignmentRow = readRecord(assignment, assignmentAt, ASSIGNMENT_FIELDS, issues); if (assignmentRow === null) return; const id = assignmentRow.targetSelectionId; const amount = assignmentRow.amount; const idOk = key(id, path(assignmentAt, 'targetSelectionId'), issues); const amountOk = positiveInteger(amount, path(assignmentAt, 'amount'), issues); const order = idOk ? selectionOrder.get(id) : undefined; if (idOk && order === undefined) issues.push(issue('DISTRIBUTION_TARGET_NOT_FOUND', path(assignmentAt, 'targetSelectionId'), 'Distribution target is not selected in this record')); if (idOk && order !== undefined && order < previousOrder) issues.push(issue('INVALID_ORDER', path(assignmentAt, 'targetSelectionId'), 'Distribution assignments must follow target-selection order')); if (order !== undefined) previousOrder = order; if (idOk && assignmentIds.has(id)) issues.push(issue('DUPLICATE_DISTRIBUTION_TARGET', path(assignmentAt, 'targetSelectionId'), 'Distribution target is duplicated')); if (idOk) assignmentIds.add(id); if (idOk && amountOk) assignmentOutput.push({ targetSelectionId: id, amount }); });
    if (assignments !== null && assignments.length === 0) issues.push(issue('INVALID_ARRAY', path(itemAt, 'assignments'), 'Distribution assignments must be nonempty'));
    if (distributionOk && assignments !== null) output.push({ distributionKey, assignments: assignmentOutput });
  });
  sortedUnique(keys, at, issues); return output;
}

function validateRecord(value: unknown, at: string, expectedKind: string | undefined, issues: CoreStackAnnouncementValidationIssue[]): CoreStackAnnouncementRecordV1 | null {
  const row = readRecord(value, at, RECORD_FIELDS, issues); if (row === null) return null;
  const kindValue = row.kind;
  const validKind = isAnnouncementKind(kindValue);
  if (!validKind) issues.push(issue('INVALID_LITERAL', path(at, 'kind'), 'Invalid announcement record kind'));
  if (validKind && expectedKind !== undefined && kindValue !== expectedKind) issues.push(issue('ANNOUNCEMENT_KIND_MISMATCH', path(at, 'kind'), 'Announcement kind does not match registry object kind'));
  if (!validKind) return null;
  const recordKind = kindValue;
  abilityText(row.abilityTextSnapshot, path(at, 'abilityTextSnapshot'), recordKind === 'activated-ability' || recordKind === 'triggered-ability', issues);
  requireOrdinaryArray(row.chosenModeKeys, path(at, 'chosenModeKeys'), issues);
  requireOrdinaryArray(row.targetSelections, path(at, 'targetSelections'), issues);
  requireOrdinaryArray(row.announcedVariables, path(at, 'announcedVariables'), issues);
  const modes = validateCoreStackChosenModeKeysV1(row.chosenModeKeys); if (!modes.ok) mapIssues(modes.issues, path(at, 'chosenModeKeys'), issues);
  const targets = validateCoreStackTargetSelectionsV1(row.targetSelections, path(at, 'targetSelections')); if (!targets.ok) mapIssues(targets.issues, '', issues);
  const variables = validateCoreStackVariableAnnouncementsV1(row.announcedVariables); if (!variables.ok) mapIssues(variables.issues, path(at, 'announcedVariables'), issues);
  const selectionOrder = new Map<string, number>();
  if (targets.ok) targets.value.forEach((selection, index) => selectionOrder.set(selection.selectionId, index));
  const distributions = validateDistributions(row.distributions, path(at, 'distributions'), selectionOrder, issues);
  if (plain(row.costChoices)) requireOrdinaryArray(row.costChoices.additionalCosts, path(path(at, 'costChoices'), 'additionalCosts'), issues);
  const costs = validateCoreStackCostChoiceSetV1(row.costChoices); if (!costs.ok) mapIssues(costs.issues, path(at, 'costChoices'), issues);
  if (issues.some((found) => found.path.startsWith(at))) return null;
  const common = { chosenModeKeys: modes.ok ? modes.value : [], targetSelections: targets.ok ? targets.value : [], announcedVariables: variables.ok ? variables.value : [], distributions, costChoices: costs.ok ? costs.value : { alternativeCost: null, additionalCosts: [] } };
  if (recordKind === 'card-spell' || recordKind === 'spell-copy') return { kind: recordKind, abilityTextSnapshot: null, ...common };
  return { kind: recordKind, abilityTextSnapshot: typeof row.abilityTextSnapshot === 'string' ? row.abilityTextSnapshot : '', ...common };
}

export function validateModeNeutralCoreStackAnnouncementSliceV1(
  registryInput: unknown,
  input: unknown,
): CoreStackAnnouncementValidationResult {
  const issues: CoreStackAnnouncementValidationIssue[] = [];
  let registry: ReturnType<typeof validateModeNeutralCoreObjectRegistrySliceV2> | null;
  try { registry = validateModeNeutralCoreObjectRegistrySliceV2(registryInput); } catch { registry = null; }
  const validRegistry = registry?.ok === true ? registry.value : null;
  if (registry === null || !registry.ok) issues.push(issue('INVALID_OBJECT_REGISTRY', '/registry', 'Object Registry V2 is invalid'));
  const root = readRecord(input, '', ROOT_FIELDS, issues);
  if (root === null) return Object.freeze({ ok: false, issues: sorted(issues) });
  if (root.kind !== 'mode-neutral-core-stack-announcement-slice-v1') issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid announcement slice kind'));
  const byObject = plain(root.byObject) ? root.byObject : null;
  if (byObject === null) issues.push(issue('INVALID_TYPE', '/byObject', 'Expected a plain object'));
  const expected = validRegistry?.zones.shared.stack ?? [];
  const expectedSet = new Set<string>(expected);
  const entries: Array<readonly [string, unknown]> = [];
  const canonicalEntries: Array<readonly [CoreObjectId, CoreStackAnnouncementRecordV1]> = [];
  if (byObject !== null) {
    const keys = safeOwnKeys(byObject);
    if (keys === null) issues.push(issue('INVALID_TYPE', '/byObject', 'Object descriptors are not readable'));
    if (keys === null) return Object.freeze({ ok: false, issues: sorted(issues) });
    for (const property of keys) {
      if (typeof property !== 'string') { issues.push(issue('UNSAFE_RECORD_KEY', path('/byObject', String(property)), 'Symbol record keys are not allowed')); continue; }
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(byObject, property); } catch { issues.push(issue('INVALID_TYPE', path('/byObject', property), 'Record entry descriptor is not readable')); continue; }
      if (descriptor === undefined || descriptor.enumerable !== true || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { issues.push(issue('INVALID_TYPE', path('/byObject', property), 'Record entries must be enumerable data properties')); continue; }
      if (UNSAFE.has(property)) issues.push(issue('UNSAFE_RECORD_KEY', path('/byObject', property), `Unsafe record key: ${property}`));
      entries.push([property, descriptor.value]);
    }
    const actualSet = new Set(entries.map(([objectId]) => objectId));
    if (actualSet.size !== expectedSet.size || [...expectedSet].some((objectId) => !actualSet.has(objectId)) || [...actualSet].some((objectId) => !expectedSet.has(objectId))) issues.push(issue('STACK_OBJECT_SET_MISMATCH', '/byObject', 'Announcement keys must equal the registry shared stack object set'));
    if (entries.map(([objectId]) => objectId).some((objectId, index) => objectId !== expected[index])) issues.push(issue('INVALID_ORDER', '/byObject', 'Announcement record order must match bottom-to-top stack order'));
    if (validRegistry !== null) for (const [objectId, record] of entries) {
      const object = validRegistry.objects[objectId as CoreObjectId];
      const expectedKind = object?.kind === 'card' ? 'card-spell' : object?.kind;
      const validated = validateRecord(record, path('/byObject', objectId), expectedKind, issues);
      if (validated !== null) canonicalEntries.push([objectId as CoreObjectId, validated]);
    }
  }
  if (issues.length > 0) return Object.freeze({ ok: false, issues: sorted(issues) });
  if (validRegistry === null) return Object.freeze({ ok: false, issues: sorted([issue('INVALID_OBJECT_REGISTRY', '/registry', 'Object Registry V2 is invalid')]) });
  return Object.freeze({ ok: true, value: canonicalizeModeNeutralCoreStackAnnouncementEntriesV1(canonicalEntries) });
}
