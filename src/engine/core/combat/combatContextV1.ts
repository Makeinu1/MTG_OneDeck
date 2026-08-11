import { isCoreBaseId } from '../ids';
import type { CoreObjectId, CorePlayerId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';

export type CoreCombatContextStepV1 = 'declare-attackers' | 'declare-blockers';

export type CoreCombatContextAttackV1 = Readonly<{
  readonly attackerObjectId: CoreObjectId;
  readonly attackerControllerPlayerId: CorePlayerId;
  readonly defendingPlayerId: CorePlayerId;
}>;

export type CoreCombatContextBlockV1 = Readonly<{
  readonly blockerObjectId: CoreObjectId;
  readonly blockerControllerPlayerId: CorePlayerId;
  readonly attackedObjectId: CoreObjectId;
  readonly defendingPlayerId: CorePlayerId;
}>;

export type CoreCombatContextV1 = Readonly<{
  readonly combatId: string;
  readonly turnNumber: number;
  readonly step: CoreCombatContextStepV1;
  readonly attackingPlayerId: CorePlayerId;
  readonly defendingPlayerIds: readonly CorePlayerId[];
  readonly attacks: readonly CoreCombatContextAttackV1[];
  readonly blocks: readonly CoreCombatContextBlockV1[];
}>;

export type CoreCombatContextValidationCodeV1 =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_DESCRIPTOR'
  | 'INVALID_TYPE'
  | 'INVALID_ID'
  | 'INVALID_TURN_NUMBER'
  | 'INVALID_STEP'
  | 'INVALID_TRANSITION'
  | 'DUPLICATE_DEFENDER'
  | 'ATTACKING_PLAYER_DEFENDS'
  | 'DUPLICATE_ATTACKER'
  | 'UNKNOWN_DEFENDER'
  | 'ATTACK_CONTROLLER_MISMATCH'
  | 'DUPLICATE_BLOCK'
  | 'UNKNOWN_ATTACK'
  | 'BLOCK_CONTROLLER_MISMATCH'
  | 'BLOCK_DEFENDER_MISMATCH'
  | 'DUPLICATE_PARTICIPANT'
  | 'INVALID_OPERATION_STEP';

export type CoreCombatContextValidationIssueV1 = Readonly<{
  readonly code: CoreCombatContextValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

class CoreCombatContextErrorV1 extends Error {
  readonly issues: readonly CoreCombatContextValidationIssueV1[];

  constructor(message: string, issues: readonly CoreCombatContextValidationIssueV1[]) {
    super(message);
    this.name = 'CoreCombatContextErrorV1';
    this.issues = Object.freeze(issues.map((current) => Object.freeze({ ...current })));
  }
}

export class CoreCombatContextCreationErrorV1 extends CoreCombatContextErrorV1 {
  constructor(issues: readonly CoreCombatContextValidationIssueV1[]) {
    super(`Invalid Core combat context (${issues.length} issue(s))`, issues);
    this.name = 'CoreCombatContextCreationErrorV1';
    Object.freeze(this);
  }
}

export class CoreCombatContextAdditionErrorV1 extends CoreCombatContextErrorV1 {
  constructor(issues: readonly CoreCombatContextValidationIssueV1[]) {
    super(`Invalid Core combat context addition (${issues.length} issue(s))`, issues);
    this.name = 'CoreCombatContextAdditionErrorV1';
    Object.freeze(this);
  }
}

export class CoreCombatContextStepErrorV1 extends CoreCombatContextErrorV1 {
  constructor(issues: readonly CoreCombatContextValidationIssueV1[]) {
    super(`Invalid Core combat context step (${issues.length} issue(s))`, issues);
    this.name = 'CoreCombatContextStepErrorV1';
    Object.freeze(this);
  }
}

export class CoreCombatContextReconciliationErrorV1 extends CoreCombatContextErrorV1 {
  constructor(issues: readonly CoreCombatContextValidationIssueV1[]) {
    super(`Invalid Core combat context reconciliation (${issues.length} issue(s))`, issues);
    this.name = 'CoreCombatContextReconciliationErrorV1';
    Object.freeze(this);
  }
}

type RawRecord = Record<string, unknown>;
type ReadRecordResult = Readonly<{
  readonly value: RawRecord | null;
  readonly issues: readonly CoreCombatContextValidationIssueV1[];
}>;
type ReadArrayResult = Readonly<{
  readonly value: readonly unknown[] | null;
  readonly issues: readonly CoreCombatContextValidationIssueV1[];
}>;

const ROOT_FIELDS = [
  'combatId', 'turnNumber', 'step', 'attackingPlayerId', 'defendingPlayerIds', 'attacks', 'blocks',
] as const;
const ATTACK_FIELDS = ['attackerObjectId', 'attackerControllerPlayerId', 'defendingPlayerId'] as const;
const BLOCK_FIELDS = ['blockerObjectId', 'blockerControllerPlayerId', 'attackedObjectId', 'defendingPlayerId'] as const;
const EXIT_FIELDS = ['exitingPlayerId', 'participantObjectIdsToClear'] as const;

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function compareIssues(
  left: CoreCombatContextValidationIssueV1,
  right: CoreCombatContextValidationIssueV1,
): number {
  return codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code);
}

function issue(
  code: CoreCombatContextValidationCodeV1,
  path: string,
  message: string,
): CoreCombatContextValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

function sortedIssues(
  issues: readonly CoreCombatContextValidationIssueV1[],
): readonly CoreCombatContextValidationIssueV1[] {
  return Object.freeze([...issues].sort(compareIssues));
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

function readRecord(value: unknown, fields: readonly string[], path: string): ReadRecordResult {
  if (!isPlainRecord(value)) {
    return {
      value: null,
      issues: [issue(path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE', path, 'Expected a plain record')],
    };
  }

  const readable = Object.create(null) as RawRecord;
  const issues: CoreCombatContextValidationIssueV1[] = [];
  const present = new Set<string>();
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return { value: null, issues: [issue('INVALID_DESCRIPTOR', path, 'Object keys are not readable')] };
  }

  for (const key of keys) {
    if (typeof key !== 'string' || !fields.includes(key)) {
      issues.push(issue(
        'UNKNOWN_FIELD',
        `${path}/${typeof key === 'string' ? key : '<symbol>'}`,
        'Unknown field',
      ));
      continue;
    }

    present.add(key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
      issues.push(issue(
        'INVALID_DESCRIPTOR',
        `${path}/${key}`,
        'Field must be an enumerable data property',
      ));
      continue;
    }
    readable[key] = descriptor.value;
  }

  for (const field of fields) {
    if (!present.has(field)) issues.push(issue('MISSING_FIELD', `${path}/${field}`, `Missing field: ${field}`));
  }
  return { value: readable, issues };
}

function canonicalArrayIndex(key: string): boolean {
  return key === '0' || /^[1-9][0-9]*$/.test(key);
}

function readDenseArray(value: unknown, path: string): ReadArrayResult {
  let isArray: boolean;
  try {
    isArray = Array.isArray(value);
  } catch {
    return { value: null, issues: [issue('INVALID_TYPE', path, 'Array inspection is not safe')] };
  }
  if (!isArray) return { value: null, issues: [issue('INVALID_TYPE', path, 'Expected an ordinary dense array')] };

  const arrayValue = value as object;
  const issues: CoreCombatContextValidationIssueV1[] = [];
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    prototype = Reflect.getPrototypeOf(arrayValue);
    keys = Reflect.ownKeys(arrayValue);
    lengthDescriptor = Object.getOwnPropertyDescriptor(arrayValue, 'length');
  } catch {
    return { value: null, issues: [issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe')] };
  }
  if (prototype !== Array.prototype) {
    issues.push(issue('INVALID_TYPE', path, 'Expected an ordinary array'));
  }
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor)) {
    issues.push(issue('INVALID_DESCRIPTOR', `${path}/length`, 'Array length must be a data property'));
    return { value: null, issues };
  }

  const rawLength: unknown = lengthDescriptor.value;
  if (typeof rawLength !== 'number' || !Number.isSafeInteger(rawLength) || rawLength < 0) {
    issues.push(issue('INVALID_DESCRIPTOR', `${path}/length`, 'Array length must be a data property'));
    return { value: null, issues };
  }

  const length = rawLength;
  const ownIndexes = new Set<string>();
  for (const key of keys) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !canonicalArrayIndex(key) || Number(key) >= length) {
      issues.push(issue(
        typeof key === 'string' ? 'UNKNOWN_FIELD' : 'UNKNOWN_FIELD',
        `${path}/${typeof key === 'string' ? key : '<symbol>'}`,
        'Unknown array property',
      ));
      continue;
    }
    ownIndexes.add(key);
  }

  if (ownIndexes.size < length) {
    issues.push(issue('INVALID_TYPE', path, 'Array must be dense'));
    return { value: null, issues };
  }

  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (!ownIndexes.has(key)) {
      issues.push(issue('INVALID_TYPE', `${path}/${index}`, 'Array entry must be an enumerable data property'));
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(arrayValue, key);
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
      issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry must be an enumerable data property'));
      continue;
    }
    values.push(descriptor.value);
  }
  return { value: values, issues };
}

function validObjectId(value: unknown): value is CoreObjectId {
  return isCanonicalCoreObjectIdV2(value);
}

function validPlayerId(value: unknown): value is CorePlayerId {
  return isCoreBaseId(value);
}

function validCombatId(value: unknown): value is string {
  return isCoreBaseId(value);
}

function validTurnNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function pairKey(left: string, right: string): string {
  return `${left}\u0000${right}`;
}

function frozenState(value: Readonly<{
  readonly combatId: string;
  readonly turnNumber: number;
  readonly step: CoreCombatContextStepV1;
  readonly attackingPlayerId: CorePlayerId;
  readonly defendingPlayerIds: readonly CorePlayerId[];
  readonly attacks: readonly CoreCombatContextAttackV1[];
  readonly blocks: readonly CoreCombatContextBlockV1[];
}>): CoreCombatContextV1 {
  return Object.freeze({
    combatId: value.combatId,
    turnNumber: value.turnNumber,
    step: value.step,
    attackingPlayerId: value.attackingPlayerId,
    defendingPlayerIds: Object.freeze([...value.defendingPlayerIds]),
    attacks: Object.freeze(value.attacks.map((entry) => Object.freeze({ ...entry }))),
    blocks: Object.freeze(value.blocks.map((entry) => Object.freeze({ ...entry }))),
  });
}

function validateContext(value: unknown): CoreCombatContextV1 {
  const root = readRecord(value, ROOT_FIELDS, '');
  const issues = [...root.issues];
  if (root.value === null || root.issues.length > 0) {
    throw new CoreCombatContextCreationErrorV1(sortedIssues(issues));
  }

  const defendersRead = readDenseArray(root.value.defendingPlayerIds, '/defendingPlayerIds');
  const attacksRead = readDenseArray(root.value.attacks, '/attacks');
  const blocksRead = readDenseArray(root.value.blocks, '/blocks');
  issues.push(...defendersRead.issues, ...attacksRead.issues, ...blocksRead.issues);

  const combatId = root.value.combatId;
  const turnNumber = root.value.turnNumber;
  const step = root.value.step;
  const attackingPlayerId = root.value.attackingPlayerId;
  if (!validCombatId(combatId)) issues.push(issue('INVALID_ID', '/combatId', 'Invalid Core combat ID'));
  if (!validTurnNumber(turnNumber)) issues.push(issue('INVALID_TURN_NUMBER', '/turnNumber', 'Turn number must be a positive safe integer'));
  if (step !== 'declare-attackers' && step !== 'declare-blockers') issues.push(issue('INVALID_STEP', '/step', 'Invalid combat context step'));
  if (!validPlayerId(attackingPlayerId)) issues.push(issue('INVALID_ID', '/attackingPlayerId', 'Invalid Core player ID'));

  const defendingPlayerIds: CorePlayerId[] = [];
  const defenderSet = new Set<string>();
  defendersRead.value?.forEach((current, index) => {
    if (!validPlayerId(current)) {
      issues.push(issue('INVALID_ID', `/defendingPlayerIds/${index}`, 'Invalid Core player ID'));
    } else if (defenderSet.has(current)) {
      issues.push(issue('DUPLICATE_DEFENDER', `/defendingPlayerIds/${index}`, 'Duplicate defending player ID'));
    } else {
      defenderSet.add(current);
      defendingPlayerIds.push(current);
    }
  });
  if (validPlayerId(attackingPlayerId) && defenderSet.has(attackingPlayerId)) {
    issues.push(issue('ATTACKING_PLAYER_DEFENDS', '/attackingPlayerId', 'Attacking player cannot be a defender'));
  }

  const attacks: CoreCombatContextAttackV1[] = [];
  const attackSet = new Set<string>();
  const attackerSet = new Set<string>();
  attacksRead.value?.forEach((current, index) => {
    const path = `/attacks/${index}`;
    const read = readRecord(current, ATTACK_FIELDS, path);
    issues.push(...read.issues);
    if (read.value === null || read.issues.length > 0) return;
    const attackerObjectId = read.value.attackerObjectId;
    const attackerControllerPlayerId = read.value.attackerControllerPlayerId;
    const defendingPlayerId = read.value.defendingPlayerId;
    if (!validObjectId(attackerObjectId)) issues.push(issue('INVALID_ID', `${path}/attackerObjectId`, 'Invalid Core object ID'));
    if (!validPlayerId(attackerControllerPlayerId)) issues.push(issue('INVALID_ID', `${path}/attackerControllerPlayerId`, 'Invalid Core player ID'));
    if (!validPlayerId(defendingPlayerId)) issues.push(issue('INVALID_ID', `${path}/defendingPlayerId`, 'Invalid Core player ID'));
    if (validObjectId(attackerObjectId) && validPlayerId(attackerControllerPlayerId) && validPlayerId(defendingPlayerId)) {
      if (!defenderSet.has(defendingPlayerId)) issues.push(issue('UNKNOWN_DEFENDER', `${path}/defendingPlayerId`, 'Defender is not registered'));
      if (attackerControllerPlayerId !== attackingPlayerId) {
        issues.push(issue('ATTACK_CONTROLLER_MISMATCH', `${path}/attackerControllerPlayerId`, 'Attacker controller must be the attacking player'));
      }
      if (attackerSet.has(attackerObjectId)) {
        issues.push(issue('DUPLICATE_ATTACKER', `${path}/attackerObjectId`, 'Attacker object is already assigned'));
      } else {
        attackerSet.add(attackerObjectId);
        attackSet.add(pairKey(attackerObjectId, defendingPlayerId));
        attacks.push(Object.freeze({ attackerObjectId, attackerControllerPlayerId, defendingPlayerId }));
      }
    }
  });

  const blocks: CoreCombatContextBlockV1[] = [];
  const blockSet = new Set<string>();
  const blockerIdentity = new Map<string, Readonly<{
    readonly blockerControllerPlayerId: CorePlayerId;
    readonly defendingPlayerId: CorePlayerId;
  }>>();
  blocksRead.value?.forEach((current, index) => {
    const path = `/blocks/${index}`;
    const read = readRecord(current, BLOCK_FIELDS, path);
    issues.push(...read.issues);
    if (read.value === null || read.issues.length > 0) return;
    const blockerObjectId = read.value.blockerObjectId;
    const blockerControllerPlayerId = read.value.blockerControllerPlayerId;
    const attackedObjectId = read.value.attackedObjectId;
    const defendingPlayerId = read.value.defendingPlayerId;
    if (!validObjectId(blockerObjectId)) issues.push(issue('INVALID_ID', `${path}/blockerObjectId`, 'Invalid Core object ID'));
    if (!validPlayerId(blockerControllerPlayerId)) issues.push(issue('INVALID_ID', `${path}/blockerControllerPlayerId`, 'Invalid Core player ID'));
    if (!validObjectId(attackedObjectId)) issues.push(issue('INVALID_ID', `${path}/attackedObjectId`, 'Invalid Core object ID'));
    if (!validPlayerId(defendingPlayerId)) issues.push(issue('INVALID_ID', `${path}/defendingPlayerId`, 'Invalid Core player ID'));
    if (validObjectId(blockerObjectId) && validPlayerId(blockerControllerPlayerId)
      && validObjectId(attackedObjectId) && validPlayerId(defendingPlayerId)) {
      const attackExists = attackSet.has(pairKey(attackedObjectId, defendingPlayerId));
      if (!defenderSet.has(defendingPlayerId)) issues.push(issue('UNKNOWN_DEFENDER', `${path}/defendingPlayerId`, 'Defender is not registered'));
      if (!attackExists) issues.push(issue('UNKNOWN_ATTACK', `${path}/attackedObjectId`, 'Block must reference an existing attack'));
      if (blockerControllerPlayerId !== defendingPlayerId) {
        issues.push(issue('BLOCK_CONTROLLER_MISMATCH', `${path}/blockerControllerPlayerId`, 'Blocker controller must be the defender'));
      }
      const previousIdentity = blockerIdentity.get(blockerObjectId);
      if (previousIdentity !== undefined) {
        if (previousIdentity.blockerControllerPlayerId !== blockerControllerPlayerId) {
          issues.push(issue(
            'BLOCK_CONTROLLER_MISMATCH',
            `${path}/blockerControllerPlayerId`,
            'Blocker controller must remain consistent across blocks',
          ));
        }
        if (previousIdentity.defendingPlayerId !== defendingPlayerId) {
          issues.push(issue(
            'BLOCK_DEFENDER_MISMATCH',
            `${path}/defendingPlayerId`,
            'Blocker defender must remain consistent across blocks',
          ));
        }
      } else {
        blockerIdentity.set(blockerObjectId, { blockerControllerPlayerId, defendingPlayerId });
      }
      if (blockSet.has(pairKey(blockerObjectId, attackedObjectId))) {
        issues.push(issue('DUPLICATE_BLOCK', path, 'Blocker/attacked-object pair is already assigned'));
      } else {
        blockSet.add(pairKey(blockerObjectId, attackedObjectId));
        blocks.push(Object.freeze({ blockerObjectId, blockerControllerPlayerId, attackedObjectId, defendingPlayerId }));
      }
    }
  });

  if (step === 'declare-attackers' && blocks.length > 0) {
    issues.push(issue('INVALID_OPERATION_STEP', '/blocks', 'Blocks exist only during declare-blockers'));
  }
  if (issues.length > 0) throw new CoreCombatContextCreationErrorV1(sortedIssues(issues));
  return frozenState({
    combatId: combatId as string,
    turnNumber: turnNumber as number,
    step: step as CoreCombatContextStepV1,
    attackingPlayerId: attackingPlayerId as CorePlayerId,
    defendingPlayerIds,
    attacks,
    blocks,
  });
}

export function createCoreCombatContextV1(value: unknown): CoreCombatContextV1 {
  return validateContext(value);
}

function normalizeForOperation(state: CoreCombatContextV1): CoreCombatContextV1 {
  try {
    return validateContext(state);
  } catch (error) {
    if (error instanceof CoreCombatContextCreationErrorV1) throw error;
    throw new CoreCombatContextCreationErrorV1([
      issue('INVALID_TYPE', '', 'Combat context inspection is not safe'),
    ]);
  }
}

function readOperationRecord(value: unknown, fields: readonly string[], errorType: 'addition' | 'reconciliation'):
  ReadRecordResult {
  const read = readRecord(value, fields, '');
  if (read.value === null && read.issues.length === 0) {
    return {
      value: null,
      issues: [issue('INVALID_TYPE', '', `${errorType} input is not readable`)],
    };
  }
  return read;
}

export function addCoreCombatContextAttackV1(
  state: CoreCombatContextV1,
  input: unknown,
): CoreCombatContextV1 {
  let normalized: CoreCombatContextV1;
  try {
    normalized = normalizeForOperation(state);
  } catch (error) {
    if (error instanceof CoreCombatContextCreationErrorV1) {
      throw new CoreCombatContextAdditionErrorV1(error.issues);
    }
    throw error;
  }
  const read = readOperationRecord(input, ATTACK_FIELDS, 'addition');
  const issues = [...read.issues];
  if (normalized.step !== 'declare-attackers') {
    issues.push(issue('INVALID_OPERATION_STEP', '/step', 'Attacks may be added only during declare-attackers'));
  }
  if (read.value !== null && read.issues.length === 0) {
    const attackerObjectId = read.value.attackerObjectId;
    const attackerControllerPlayerId = read.value.attackerControllerPlayerId;
    const defendingPlayerId = read.value.defendingPlayerId;
    if (!validObjectId(attackerObjectId)) issues.push(issue('INVALID_ID', '/attackerObjectId', 'Invalid Core object ID'));
    if (!validPlayerId(attackerControllerPlayerId)) issues.push(issue('INVALID_ID', '/attackerControllerPlayerId', 'Invalid Core player ID'));
    if (!validPlayerId(defendingPlayerId)) issues.push(issue('INVALID_ID', '/defendingPlayerId', 'Invalid Core player ID'));
    if (validPlayerId(defendingPlayerId) && !normalized.defendingPlayerIds.includes(defendingPlayerId)) issues.push(issue('UNKNOWN_DEFENDER', '/defendingPlayerId', 'Defender is not registered'));
    if (validPlayerId(attackerControllerPlayerId) && attackerControllerPlayerId !== normalized.attackingPlayerId) {
      issues.push(issue('ATTACK_CONTROLLER_MISMATCH', '/attackerControllerPlayerId', 'Attacker controller must be the attacking player'));
    }
    if (validPlayerId(defendingPlayerId) && defendingPlayerId === normalized.attackingPlayerId) {
      issues.push(issue('ATTACKING_PLAYER_DEFENDS', '/defendingPlayerId', 'Attacking player cannot be a defender'));
    }
    if (validObjectId(attackerObjectId) && normalized.attacks.some((entry) => entry.attackerObjectId === attackerObjectId)) {
      issues.push(issue('DUPLICATE_ATTACKER', '/attackerObjectId', 'Attacker object is already assigned'));
    }
    if (issues.length === 0) {
      return frozenState({
        ...normalized,
        attacks: [...normalized.attacks, {
          attackerObjectId: attackerObjectId as CoreObjectId,
          attackerControllerPlayerId: attackerControllerPlayerId as CorePlayerId,
          defendingPlayerId: defendingPlayerId as CorePlayerId,
        }],
      });
    }
  }
  throw new CoreCombatContextAdditionErrorV1(sortedIssues(issues));
}

export function addCoreCombatContextBlockV1(
  state: CoreCombatContextV1,
  input: unknown,
): CoreCombatContextV1 {
  let normalized: CoreCombatContextV1;
  try {
    normalized = normalizeForOperation(state);
  } catch (error) {
    if (error instanceof CoreCombatContextCreationErrorV1) {
      throw new CoreCombatContextAdditionErrorV1(error.issues);
    }
    throw error;
  }
  const read = readOperationRecord(input, BLOCK_FIELDS, 'addition');
  const issues = [...read.issues];
  if (normalized.step !== 'declare-blockers') {
    issues.push(issue('INVALID_OPERATION_STEP', '/step', 'Blocks may be added only during declare-blockers'));
  }
  if (read.value !== null && read.issues.length === 0) {
    const blockerObjectId = read.value.blockerObjectId;
    const blockerControllerPlayerId = read.value.blockerControllerPlayerId;
    const attackedObjectId = read.value.attackedObjectId;
    const defendingPlayerId = read.value.defendingPlayerId;
    if (!validObjectId(blockerObjectId)) issues.push(issue('INVALID_ID', '/blockerObjectId', 'Invalid Core object ID'));
    if (!validPlayerId(blockerControllerPlayerId)) issues.push(issue('INVALID_ID', '/blockerControllerPlayerId', 'Invalid Core player ID'));
    if (!validObjectId(attackedObjectId)) issues.push(issue('INVALID_ID', '/attackedObjectId', 'Invalid Core object ID'));
    if (!validPlayerId(defendingPlayerId)) issues.push(issue('INVALID_ID', '/defendingPlayerId', 'Invalid Core player ID'));
    if (validPlayerId(defendingPlayerId) && !normalized.defendingPlayerIds.includes(defendingPlayerId)) issues.push(issue('UNKNOWN_DEFENDER', '/defendingPlayerId', 'Defender is not registered'));
    if (validPlayerId(blockerControllerPlayerId) && validPlayerId(defendingPlayerId)
      && blockerControllerPlayerId !== defendingPlayerId) {
      issues.push(issue('BLOCK_CONTROLLER_MISMATCH', '/blockerControllerPlayerId', 'Blocker controller must be the defender'));
    }
    if (validObjectId(attackedObjectId) && validPlayerId(defendingPlayerId)
      && !normalized.attacks.some((entry) => entry.attackerObjectId === attackedObjectId && entry.defendingPlayerId === defendingPlayerId)) {
      issues.push(issue('UNKNOWN_ATTACK', '/attackedObjectId', 'Block must reference an existing attack'));
    }
    if (validObjectId(blockerObjectId) && validObjectId(attackedObjectId)
      && normalized.blocks.some((entry) => entry.blockerObjectId === blockerObjectId && entry.attackedObjectId === attackedObjectId)) {
      issues.push(issue('DUPLICATE_BLOCK', '', 'Blocker/attacked-object pair is already assigned'));
    }
    const previousBlock = validObjectId(blockerObjectId)
      ? normalized.blocks.find((entry) => entry.blockerObjectId === blockerObjectId)
      : undefined;
    if (previousBlock !== undefined) {
      if (validPlayerId(blockerControllerPlayerId)
        && previousBlock.blockerControllerPlayerId !== blockerControllerPlayerId) {
        issues.push(issue(
          'BLOCK_CONTROLLER_MISMATCH',
          '/blockerControllerPlayerId',
          'Blocker controller must remain consistent across blocks',
        ));
      }
      if (validPlayerId(defendingPlayerId) && previousBlock.defendingPlayerId !== defendingPlayerId) {
        issues.push(issue(
          'BLOCK_DEFENDER_MISMATCH',
          '/defendingPlayerId',
          'Blocker defender must remain consistent across blocks',
        ));
      }
    }
    if (issues.length === 0) {
      return frozenState({
        ...normalized,
        blocks: [...normalized.blocks, {
          blockerObjectId: blockerObjectId as CoreObjectId,
          blockerControllerPlayerId: blockerControllerPlayerId as CorePlayerId,
          attackedObjectId: attackedObjectId as CoreObjectId,
          defendingPlayerId: defendingPlayerId as CorePlayerId,
        }],
      });
    }
  }
  throw new CoreCombatContextAdditionErrorV1(sortedIssues(issues));
}

export function setCoreCombatContextStepV1(
  state: CoreCombatContextV1,
  step: unknown,
): CoreCombatContextV1 {
  let normalized: CoreCombatContextV1;
  try {
    normalized = normalizeForOperation(state);
  } catch (error) {
    if (error instanceof CoreCombatContextCreationErrorV1) {
      throw new CoreCombatContextStepErrorV1(error.issues);
    }
    throw error;
  }
  const issues: CoreCombatContextValidationIssueV1[] = [];
  if (step !== 'declare-attackers' && step !== 'declare-blockers') {
    issues.push(issue('INVALID_STEP', '', 'Invalid combat context step'));
  } else if (normalized.step === 'declare-blockers' && step === 'declare-attackers') {
    issues.push(issue('INVALID_TRANSITION', '', 'Combat context transitions cannot move backward'));
  }
  if (issues.length > 0) throw new CoreCombatContextStepErrorV1(sortedIssues(issues));
  return frozenState({ ...normalized, step: step as CoreCombatContextStepV1 });
}

export function reconcileCoreCombatContextForPlayerExitV1(
  state: CoreCombatContextV1,
  input: unknown,
): CoreCombatContextV1 | null {
  let normalized: CoreCombatContextV1;
  try {
    normalized = normalizeForOperation(state);
  } catch (error) {
    if (error instanceof CoreCombatContextCreationErrorV1) {
      throw new CoreCombatContextReconciliationErrorV1(error.issues);
    }
    throw error;
  }
  const read = readOperationRecord(input, EXIT_FIELDS, 'reconciliation');
  const issues = [...read.issues];
  let exitingPlayerId: CorePlayerId | null = null;
  const participantObjectIdsToClear: CoreObjectId[] = [];
  if (read.value !== null && read.issues.length === 0) {
    const rawExitingPlayerId = read.value.exitingPlayerId;
    if (!validPlayerId(rawExitingPlayerId)) {
      issues.push(issue('INVALID_ID', '/exitingPlayerId', 'Invalid Core player ID'));
    } else {
      exitingPlayerId = rawExitingPlayerId;
    }
    const participants = readDenseArray(read.value.participantObjectIdsToClear, '/participantObjectIdsToClear');
    issues.push(...participants.issues);
    const participantSet = new Set<string>();
    participants.value?.forEach((current, index) => {
      if (!validObjectId(current)) {
        issues.push(issue('INVALID_ID', `/participantObjectIdsToClear/${index}`, 'Invalid Core object ID'));
      } else if (participantSet.has(current)) {
        issues.push(issue('DUPLICATE_PARTICIPANT', `/participantObjectIdsToClear/${index}`, 'Duplicate participant object ID'));
      } else {
        participantSet.add(current);
        participantObjectIdsToClear.push(current);
      }
    });
  }
  if (issues.length > 0) throw new CoreCombatContextReconciliationErrorV1(sortedIssues(issues));
  if (exitingPlayerId === normalized.attackingPlayerId) return null;

  const clearSet = new Set(participantObjectIdsToClear);
  const attacks = normalized.attacks.filter((attack) =>
    attack.defendingPlayerId !== exitingPlayerId && !clearSet.has(attack.attackerObjectId));
  const survivingAttacks = new Set(attacks.map((attack) => pairKey(attack.attackerObjectId, attack.defendingPlayerId)));
  const blocks = normalized.blocks.filter((block) =>
    block.defendingPlayerId !== exitingPlayerId
      && block.blockerControllerPlayerId !== exitingPlayerId
      && !clearSet.has(block.blockerObjectId)
      && !clearSet.has(block.attackedObjectId)
      && survivingAttacks.has(pairKey(block.attackedObjectId, block.defendingPlayerId)));
  return frozenState({
    ...normalized,
    defendingPlayerIds: normalized.defendingPlayerIds.filter((playerId) => playerId !== exitingPlayerId),
    attacks,
    blocks,
  });
}
