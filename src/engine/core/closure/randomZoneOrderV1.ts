import type { CoreObjectId } from '../ids';
import type { CoreRuleZoneRefV1 } from '../rules/ruleZoneRefV1';

export type CoreRandomZoneOrderInputV1 = Readonly<{
  readonly randomDecisionId: string;
  readonly zone: CoreRuleZoneRefV1;
  readonly beforeOrder: readonly CoreObjectId[];
  readonly afterOrder: readonly CoreObjectId[];
}>;
export type CoreRandomZoneOrderIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;

function issue(code: string, path: string, message: string): CoreRandomZoneOrderIssueV1 { return Object.freeze({ code, path, message }); }

function dataField(value: unknown, field: string, path: string, issues: CoreRandomZoneOrderIssueV1[]): unknown {
  if (value === null || typeof value !== 'object') { issues.push(issue('INVALID_TYPE', path, 'Expected a record')); return null; }
  let descriptor: PropertyDescriptor | undefined;
  try { descriptor = Object.getOwnPropertyDescriptor(value, field); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Field descriptor is not readable')); return null; }
  if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) { issues.push(issue('INVALID_DESCRIPTOR', path, 'Field must be an enumerable data property')); return null; }
  return descriptor.value;
}

function denseObjectIds(value: unknown, path: string, issues: CoreRandomZoneOrderIssueV1[]): readonly CoreObjectId[] | null {
  let array: boolean;
  try { array = Array.isArray(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe')); return null; }
  if (!array) { issues.push(issue('INVALID_ARRAY', path, 'Expected an array')); return null; }
  const objectValue = value as object;
  let keys: readonly PropertyKey[];
  let lengthDescriptor: PropertyDescriptor | undefined;
  let prototype: object | null;
  try {
    keys = Reflect.ownKeys(objectValue);
    lengthDescriptor = Object.getOwnPropertyDescriptor(objectValue, 'length');
    prototype = Reflect.getPrototypeOf(objectValue);
  } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable')); return null; }
  if (prototype !== Array.prototype) issues.push(issue('INVALID_TYPE', path, 'Expected an ordinary array'));
  const length: unknown = lengthDescriptor && 'value' in lengthDescriptor
    ? (lengthDescriptor as unknown as Readonly<{ readonly value: unknown }>).value
    : null;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) { issues.push(issue('INVALID_ARRAY', `${path}/length`, 'Array length must be a non-negative safe integer')); return null; }
  const expected = new Set<string>();
  for (let index = 0; index < length; index += 1) expected.add(String(index));
  for (const key of keys) if (key !== 'length' && (typeof key !== 'string' || !expected.has(key))) issues.push(issue('INVALID_ARRAY', `${path}/${typeof key === 'string' ? key : '[symbol]'}`, 'Arrays must be dense and have no extra fields'));
  const result: CoreObjectId[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(objectValue, String(index)); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry must be an enumerable data property')); continue; }
    if (typeof descriptor.value !== 'string') { issues.push(issue('INVALID_ID', `${path}/${index}`, 'Object ID must be a string')); continue; }
    result.push(descriptor.value as CoreObjectId);
  }
  return Object.freeze(result);
}

function inspectRandomZoneOrder(input: unknown, currentOrder: unknown): Readonly<{ readonly issues: readonly CoreRandomZoneOrderIssueV1[]; readonly afterOrder: readonly CoreObjectId[] | null }> {
  const issues: CoreRandomZoneOrderIssueV1[] = [];
  const beforeOrder = denseObjectIds(dataField(input, 'beforeOrder', '/beforeOrder', issues), '/beforeOrder', issues);
  const afterOrder = denseObjectIds(dataField(input, 'afterOrder', '/afterOrder', issues), '/afterOrder', issues);
  const current = denseObjectIds(currentOrder, '/currentOrder', issues);
  if (beforeOrder && afterOrder && current) {
    if (beforeOrder.length !== current.length || beforeOrder.some((id, index) => id !== current[index])) issues.push(issue('ZONE_BEFORE_MISMATCH', '/beforeOrder', 'Recorded before-order does not equal the current zone'));
    if (afterOrder.length !== beforeOrder.length) issues.push(issue('INVALID_PERMUTATION', '/afterOrder', 'Recorded after-order must have the same length'));
    const before = new Set(beforeOrder); const after = new Set(afterOrder);
    if (before.size !== beforeOrder.length || after.size !== afterOrder.length || before.size !== after.size || afterOrder.some((id) => !before.has(id))) issues.push(issue('INVALID_PERMUTATION', '/afterOrder', 'Recorded after-order must be a dense exact permutation'));
  }
  return Object.freeze({ issues: Object.freeze(issues), afterOrder });
}

export function validateCoreRandomZoneOrderV1(input: CoreRandomZoneOrderInputV1, currentOrder: readonly CoreObjectId[]): readonly CoreRandomZoneOrderIssueV1[] {
  return inspectRandomZoneOrder(input, currentOrder).issues;
}

export function applyCoreRecordedZoneOrderV1(currentOrder: readonly CoreObjectId[], input: CoreRandomZoneOrderInputV1): readonly CoreObjectId[] {
  const inspected = inspectRandomZoneOrder(input, currentOrder);
  if (inspected.issues.length > 0 || inspected.afterOrder === null) throw new Error(inspected.issues[0]?.message ?? 'Invalid recorded zone order');
  return Object.freeze(inspected.afterOrder.slice());
}
