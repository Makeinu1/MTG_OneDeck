import { isCoreBaseId } from '../ids';
import type { CoreObjectId, CorePhysicalCardId, CorePlayerId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import { createCoreCommanderIdentityV1 } from './commanderIdentityV1';
import type { CoreCommanderIdentityV1 } from './commanderIdentityV1';

export type CoreCommanderDamageProvenanceRecordV1 = Readonly<{
  readonly combatObjectId: CoreObjectId;
  readonly commanderPhysicalCardId: CorePhysicalCardId;
  readonly defendingPlayerId: CorePlayerId;
  readonly damage: number;
}>;

export type CoreCommanderDamageProvenanceLedgerV1 = Readonly<{
  readonly commanders: readonly CoreCommanderIdentityV1[];
  readonly defendingPlayerIds: readonly CorePlayerId[];
  readonly records: readonly CoreCommanderDamageProvenanceRecordV1[];
}>;

export type CoreCommanderProvenanceValidationCodeV1 =
  | 'INVALID_ROOT' | 'MISSING_FIELD' | 'UNKNOWN_FIELD' | 'INVALID_TYPE'
  | 'INVALID_ID' | 'INVALID_DAMAGE' | 'DUPLICATE_COMMANDER'
  | 'DUPLICATE_DEFENDING_PLAYER' | 'DUPLICATE_RECORD'
  | 'UNREGISTERED_COMMANDER' | 'UNREGISTERED_DEFENDING_PLAYER'
  | 'DAMAGE_OVERFLOW';

export type CoreCommanderProvenanceValidationIssueV1 = Readonly<{
  readonly code: CoreCommanderProvenanceValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

class CoreCommanderProvenanceErrorV1 extends Error {
  readonly issues: readonly CoreCommanderProvenanceValidationIssueV1[];

  constructor(message: string, issues: readonly CoreCommanderProvenanceValidationIssueV1[]) {
    super(message);
    this.name = 'CoreCommanderProvenanceErrorV1';
    this.issues = Object.freeze(issues.map((current) => Object.freeze({ ...current })));
  }
}

export class CoreCommanderProvenanceCreationErrorV1 extends CoreCommanderProvenanceErrorV1 {
  constructor(issues: readonly CoreCommanderProvenanceValidationIssueV1[]) {
    super(`Invalid Core commander damage provenance ledger (${issues.length} issue(s))`, issues);
    this.name = 'CoreCommanderProvenanceCreationErrorV1';
    Object.freeze(this);
  }
}

export class CoreCommanderProvenanceRecordingErrorV1 extends CoreCommanderProvenanceErrorV1 {
  constructor(issues: readonly CoreCommanderProvenanceValidationIssueV1[]) {
    super(`Invalid Core commander damage provenance record (${issues.length} issue(s))`, issues);
    this.name = 'CoreCommanderProvenanceRecordingErrorV1';
    Object.freeze(this);
  }
}

export class CoreCommanderProvenanceQueryErrorV1 extends CoreCommanderProvenanceErrorV1 {
  constructor(issues: readonly CoreCommanderProvenanceValidationIssueV1[]) {
    super(`Invalid Core commander damage provenance query (${issues.length} issue(s))`, issues);
    this.name = 'CoreCommanderProvenanceQueryErrorV1';
    Object.freeze(this);
  }
}

type Raw = Record<string, unknown>;
const ROOT_FIELDS = ['commanders', 'defendingPlayerIds', 'records'] as const;
const RECORD_FIELDS = ['combatObjectId', 'commanderPhysicalCardId', 'defendingPlayerId', 'damage'] as const;

function isPlain(value: unknown): value is Raw {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch { return false; }
}

function issue(code: CoreCommanderProvenanceValidationCodeV1, path: string, message: string): CoreCommanderProvenanceValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

function compareIssues(left: CoreCommanderProvenanceValidationIssueV1, right: CoreCommanderProvenanceValidationIssueV1): number {
  const codeUnitCompare = (leftValue: string, rightValue: string): number => {
    const length = Math.min(leftValue.length, rightValue.length);
    for (let index = 0; index < length; index += 1) {
      const difference = leftValue.charCodeAt(index) - rightValue.charCodeAt(index);
      if (difference !== 0) return difference;
    }
    return leftValue.length - rightValue.length;
  };
  return codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code);
}

function sortedIssues(issues: readonly CoreCommanderProvenanceValidationIssueV1[]): readonly CoreCommanderProvenanceValidationIssueV1[] {
  return Object.freeze(issues.slice().sort(compareIssues));
}

function readObject(value: unknown, fields: readonly string[], path: string): { readonly value: Raw | null; readonly issues: readonly CoreCommanderProvenanceValidationIssueV1[] } {
  if (!isPlain(value)) return { value: null, issues: [issue('INVALID_ROOT', path, 'Expected a plain object')] };
  const result: Raw = Object.create(null) as Raw;
  const issues: CoreCommanderProvenanceValidationIssueV1[] = [];
  const present = new Set<string>();
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return { value: null, issues: [issue('INVALID_TYPE', path, 'Object keys are not readable')] };
  }
  for (const key of keys) {
      const field = typeof key === 'string' ? key : '<symbol>';
      if (typeof key !== 'string' || !fields.includes(key)) {
        issues.push(issue('UNKNOWN_FIELD', `${path}/${field}`, 'Unknown field')); continue;
      }
      present.add(key);
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        issues.push(issue('INVALID_TYPE', `${path}/${key}`, 'Field descriptor is not readable')); continue;
      }
      if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
        issues.push(issue('INVALID_TYPE', `${path}/${key}`, 'Field must be an enumerable data property')); continue;
      }
      result[key] = descriptor.value;
  }
  for (const field of fields) if (!present.has(field)) {
    issues.push(issue('MISSING_FIELD', `${path}/${field}`, `Missing field: ${field}`));
  }
  return { value: result, issues };
}

function readArray(value: unknown, path: string): {
  readonly values: readonly unknown[] | null;
  readonly issues: readonly CoreCommanderProvenanceValidationIssueV1[];
} {
  try {
    if (!Array.isArray(value)) return { values: null, issues: [issue('INVALID_TYPE', path, 'Expected an array')] };
    if (Reflect.getPrototypeOf(value) !== Array.prototype) {
      return { values: null, issues: [issue('INVALID_TYPE', path, 'Expected an ordinary array')] };
    }
    const keys = Reflect.ownKeys(value);
    const descriptors = new Map<string, PropertyDescriptor>();
    for (const key of keys) {
      if (typeof key !== 'string' || (key !== 'length' && !/^0$|^[1-9][0-9]*$/.test(key))) {
        return { values: null, issues: [issue('INVALID_TYPE', path, 'Array must contain only length and canonical data indices')] };
      }
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return { values: null, issues: [issue('INVALID_TYPE', path, 'Array property descriptor is not readable')] };
      }
      if (descriptor === undefined) {
        return { values: null, issues: [issue('INVALID_TYPE', path, 'Array property descriptor is missing')] };
      }
      descriptors.set(key, descriptor);
    }
    const lengthDescriptor = descriptors.get('length');
    const rawLength: unknown = lengthDescriptor?.value;
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || lengthDescriptor.enumerable ||
      typeof rawLength !== 'number' || !Number.isSafeInteger(rawLength) || rawLength < 0) {
      return { values: null, issues: [issue('INVALID_TYPE', path, 'Array length must be a non-enumerable data property')] };
    }
    const length = rawLength;
    if (descriptors.size !== length + 1) {
      return { values: null, issues: [issue('INVALID_TYPE', path, 'Array must be dense')] };
    }
    const values: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors.get(String(index));
      if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
        return { values: null, issues: [issue('INVALID_TYPE', path, 'Array indices must be enumerable data properties')] };
      }
      values.push(descriptor.value);
    }
    return { values: Object.freeze(values), issues: [] };
  } catch {
    return { values: null, issues: [issue('INVALID_TYPE', path, 'Unable to inspect array')] };
  }
}

function validDamage(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function validPhysicalCardId(value: unknown): value is CorePhysicalCardId {
  return isCoreBaseId(value);
}

function validPlayerId(value: unknown): value is CorePlayerId {
  return isCoreBaseId(value);
}

function tripleKey(combatObjectId: string, commanderPhysicalCardId: string, defendingPlayerId: string): string {
  return `${combatObjectId}\u0000${commanderPhysicalCardId}\u0000${defendingPlayerId}`;
}

function pairKey(commanderPhysicalCardId: string, defendingPlayerId: string): string {
  return `${commanderPhysicalCardId}\u0000${defendingPlayerId}`;
}

function allowlists(state: CoreCommanderDamageProvenanceLedgerV1): { readonly commanders: Set<string>; readonly players: Set<string> } {
  return { commanders: new Set(state.commanders.map((current) => current.physicalCardId)), players: new Set(state.defendingPlayerIds) };
}

function frozenRecord(record: CoreCommanderDamageProvenanceRecordV1): CoreCommanderDamageProvenanceRecordV1 {
  return Object.freeze({ ...record });
}

export function createCoreCommanderDamageProvenanceLedgerV1(value: unknown): CoreCommanderDamageProvenanceLedgerV1 {
  const root = readObject(value, ROOT_FIELDS, '');
  const issues = [...root.issues];
  if (root.value === null) throw new CoreCommanderProvenanceCreationErrorV1(sortedIssues(issues));
  const commanderArray = readArray(root.value.commanders, '/commanders');
  const playerArray = readArray(root.value.defendingPlayerIds, '/defendingPlayerIds');
  const recordArray = readArray(root.value.records, '/records');
  issues.push(...commanderArray.issues, ...playerArray.issues, ...recordArray.issues);
  const commanderValues = commanderArray.values;
  const playerValues = playerArray.values;
  const recordValues = recordArray.values;
  const commanders: CoreCommanderIdentityV1[] = [];
  const commanderIds = new Set<string>();
  for (let index = 0; commanderValues !== null && index < commanderValues.length; index += 1) {
    const current = commanderValues[index];
    try {
      const commander = createCoreCommanderIdentityV1(current);
      if (commanderIds.has(commander.physicalCardId)) issues.push(issue('DUPLICATE_COMMANDER', `/commanders/${index}/physicalCardId`, 'Commander physical ID is duplicated'));
      else { commanderIds.add(commander.physicalCardId); commanders.push(Object.freeze({ ...commander })); }
    } catch { issues.push(issue('INVALID_TYPE', `/commanders/${index}`, 'Invalid Core commander identity')); }
  }
  const defendingPlayerIds: CorePlayerId[] = [];
  const playerIds = new Set<string>();
  for (let index = 0; playerValues !== null && index < playerValues.length; index += 1) {
    const current = playerValues[index];
    if (!validPlayerId(current)) issues.push(issue('INVALID_ID', `/defendingPlayerIds/${index}`, 'Invalid Core player ID'));
    else if (playerIds.has(current)) issues.push(issue('DUPLICATE_DEFENDING_PLAYER', `/defendingPlayerIds/${index}`, 'Defending player ID is duplicated'));
    else { playerIds.add(current); defendingPlayerIds.push(current); }
  }
  const records: CoreCommanderDamageProvenanceRecordV1[] = [];
  const triples = new Set<string>();
  const totalsByPair = new Map<string, number>();
  const overflowedPairs = new Set<string>();
  for (let index = 0; recordValues !== null && index < recordValues.length; index += 1) {
    const current = recordValues[index];
    const path = `/records/${index}`;
    const read = readObject(current, RECORD_FIELDS, path); issues.push(...read.issues);
    if (read.value === null || read.issues.length > 0) continue;
    const objectId = read.value.combatObjectId;
    const commanderId = read.value.commanderPhysicalCardId;
    const playerId = read.value.defendingPlayerId;
    const damage = read.value.damage;
    if (!isCanonicalCoreObjectIdV2(objectId)) issues.push(issue('INVALID_ID', `${path}/combatObjectId`, 'Invalid canonical Core object ID'));
    if (!validPhysicalCardId(commanderId)) issues.push(issue('INVALID_ID', `${path}/commanderPhysicalCardId`, 'Invalid Core physical card ID'));
    else if (!commanderIds.has(commanderId)) issues.push(issue('UNREGISTERED_COMMANDER', `${path}/commanderPhysicalCardId`, 'Commander physical ID is not registered'));
    if (!validPlayerId(playerId)) issues.push(issue('INVALID_ID', `${path}/defendingPlayerId`, 'Invalid Core player ID'));
    else if (!playerIds.has(playerId)) issues.push(issue('UNREGISTERED_DEFENDING_PLAYER', `${path}/defendingPlayerId`, 'Defending player ID is not registered'));
    if (!validDamage(damage)) issues.push(issue('INVALID_DAMAGE', `${path}/damage`, 'Damage must be a nonnegative safe integer'));
    if (isCanonicalCoreObjectIdV2(objectId) && validPhysicalCardId(commanderId) && validPlayerId(playerId)) {
      const key = tripleKey(objectId, commanderId, playerId);
      if (triples.has(key)) issues.push(issue('DUPLICATE_RECORD', path, 'Combat provenance triple is duplicated'));
      else if (commanderIds.has(commanderId) && playerIds.has(playerId) && validDamage(damage)) {
        const pair = pairKey(commanderId, playerId);
        const currentTotal = totalsByPair.get(pair) ?? 0;
        if (overflowedPairs.has(pair) || !Number.isSafeInteger(currentTotal + damage)) {
          issues.push(issue('DAMAGE_OVERFLOW', `${path}/damage`, 'Damage total exceeds the safe integer range'));
          overflowedPairs.add(pair);
        } else {
          totalsByPair.set(pair, currentTotal + damage);
        }
        triples.add(key); records.push(frozenRecord({ combatObjectId: objectId, commanderPhysicalCardId: commanderId, defendingPlayerId: playerId, damage }));
      }
    }
  }
  if (issues.length > 0) throw new CoreCommanderProvenanceCreationErrorV1(sortedIssues(issues));
  return Object.freeze({ commanders: Object.freeze(commanders.slice()), defendingPlayerIds: Object.freeze(defendingPlayerIds.slice()), records: Object.freeze(records.slice()) });
}

export function recordCoreCommanderDamageProvenanceV1(state: CoreCommanderDamageProvenanceLedgerV1, input: unknown): CoreCommanderDamageProvenanceLedgerV1 {
  const normalized = createCoreCommanderDamageProvenanceLedgerV1(state);
  const read = readObject(input, RECORD_FIELDS, '');
  const issues = [...read.issues];
  if (read.value === null || read.issues.length > 0) throw new CoreCommanderProvenanceRecordingErrorV1(sortedIssues(issues));
  const objectId = read.value.combatObjectId;
  const commanderId = read.value.commanderPhysicalCardId;
  const playerId = read.value.defendingPlayerId;
  const damage = read.value.damage;
  const sets = allowlists(normalized);
  if (!isCanonicalCoreObjectIdV2(objectId)) issues.push(issue('INVALID_ID', '/combatObjectId', 'Invalid canonical Core object ID'));
  if (!validPhysicalCardId(commanderId)) issues.push(issue('INVALID_ID', '/commanderPhysicalCardId', 'Invalid Core physical card ID'));
  else if (!sets.commanders.has(commanderId)) issues.push(issue('UNREGISTERED_COMMANDER', '/commanderPhysicalCardId', 'Commander physical ID is not registered'));
  if (!validPlayerId(playerId)) issues.push(issue('INVALID_ID', '/defendingPlayerId', 'Invalid Core player ID'));
  else if (!sets.players.has(playerId)) issues.push(issue('UNREGISTERED_DEFENDING_PLAYER', '/defendingPlayerId', 'Defending player ID is not registered'));
  if (!validDamage(damage)) issues.push(issue('INVALID_DAMAGE', '/damage', 'Damage must be a nonnegative safe integer'));
  if (isCanonicalCoreObjectIdV2(objectId) && validPhysicalCardId(commanderId) && validPlayerId(playerId) && normalized.records.some((current) => tripleKey(current.combatObjectId, current.commanderPhysicalCardId, current.defendingPlayerId) === tripleKey(objectId, commanderId, playerId))) {
    issues.push(issue('DUPLICATE_RECORD', '', 'Combat provenance triple already exists'));
  }
  if (issues.length > 0) throw new CoreCommanderProvenanceRecordingErrorV1(sortedIssues(issues));
  if (!isCanonicalCoreObjectIdV2(objectId) || !validPhysicalCardId(commanderId) || !validPlayerId(playerId) || !validDamage(damage)) {
    throw new CoreCommanderProvenanceRecordingErrorV1(sortedIssues(issues));
  }
  const total = normalized.records
    .filter((current) => current.commanderPhysicalCardId === commanderId && current.defendingPlayerId === playerId)
    .reduce((sum, current) => sum + current.damage, 0);
  if (!Number.isSafeInteger(total + damage)) throw new CoreCommanderProvenanceRecordingErrorV1([issue('DAMAGE_OVERFLOW', '/damage', 'Damage total exceeds the safe integer range')]);
  const record = frozenRecord({ combatObjectId: objectId, commanderPhysicalCardId: commanderId, defendingPlayerId: playerId, damage });
  return Object.freeze({ commanders: normalized.commanders, defendingPlayerIds: normalized.defendingPlayerIds, records: Object.freeze([...normalized.records, record]) });
}

function validateQuery(state: CoreCommanderDamageProvenanceLedgerV1, commanderPhysicalCardId: unknown, defendingPlayerId: unknown): {
  readonly state: CoreCommanderDamageProvenanceLedgerV1;
  readonly commanderPhysicalCardId: CorePhysicalCardId;
  readonly defendingPlayerId: CorePlayerId;
} {
  const normalized = createCoreCommanderDamageProvenanceLedgerV1(state);
  const sets = allowlists(normalized); const issues: CoreCommanderProvenanceValidationIssueV1[] = [];
  if (!validPhysicalCardId(commanderPhysicalCardId)) issues.push(issue('INVALID_ID', '/commanderPhysicalCardId', 'Invalid Core physical card ID'));
  else if (!sets.commanders.has(commanderPhysicalCardId)) issues.push(issue('UNREGISTERED_COMMANDER', '/commanderPhysicalCardId', 'Commander physical ID is not registered'));
  if (!validPlayerId(defendingPlayerId)) issues.push(issue('INVALID_ID', '/defendingPlayerId', 'Invalid Core player ID'));
  else if (!sets.players.has(defendingPlayerId)) issues.push(issue('UNREGISTERED_DEFENDING_PLAYER', '/defendingPlayerId', 'Defending player ID is not registered'));
  if (issues.length > 0) throw new CoreCommanderProvenanceQueryErrorV1(sortedIssues(issues));
  if (!validPhysicalCardId(commanderPhysicalCardId) || !validPlayerId(defendingPlayerId)) {
    throw new CoreCommanderProvenanceQueryErrorV1(sortedIssues(issues));
  }
  return { state: normalized, commanderPhysicalCardId, defendingPlayerId };
}

export function coreCommanderProvenanceDamageAgainstV1(state: CoreCommanderDamageProvenanceLedgerV1, commanderPhysicalCardId: unknown, defendingPlayerId: unknown): number {
  const query = validateQuery(state, commanderPhysicalCardId, defendingPlayerId);
  return query.state.records.filter((current) => current.commanderPhysicalCardId === query.commanderPhysicalCardId && current.defendingPlayerId === query.defendingPlayerId).reduce((sum, current) => sum + current.damage, 0);
}

export function coreCommanderThresholdReachedFromProvenanceV1(state: CoreCommanderDamageProvenanceLedgerV1, commanderPhysicalCardId: unknown, defendingPlayerId: unknown): boolean {
  return coreCommanderProvenanceDamageAgainstV1(state, commanderPhysicalCardId, defendingPlayerId) >= 21;
}

// DEFER: actual combat damage assignment/application and SBA state transition remain outside this ledger.
