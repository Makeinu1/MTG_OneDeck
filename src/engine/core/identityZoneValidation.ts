import {
  isCoreBaseId,
  isCoreSafeIncarnation,
  isCoreUnsafeRecordKey,
} from './ids';
import type {
  CoreCardDefinitionSnapshotV1,
  CoreCardDefinitionSourceV1,
  CoreCardFaceSnapshotV1,
  CoreColorIdentityV1,
  CoreManaColorV1,
} from './cardDefinition';
import type { CoreCardDefinitionId, CorePhysicalCardId } from './ids';
import type {
  CoreCardObjectIdentityV1,
  CoreManaPoolV1,
  CorePlayerStateV1,
  CorePlayerZonesV1,
  CoreSharedZonesV1,
  ModeNeutralCoreIdentityZoneSliceV1,
} from './identityZoneState';

export type CoreIdentityZoneValidationCode =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_ID'
  | 'UNSAFE_RECORD_KEY'
  | 'INVALID_STRING'
  | 'INVALID_NUMBER'
  | 'INVALID_INTEGER'
  | 'INVALID_ARRAY_LENGTH'
  | 'DUPLICATE_VALUE'
  | 'INVALID_ORDER'
  | 'PLAYER_SET_MISMATCH'
  | 'ACTIVE_PLAYER_NOT_SEATED'
  | 'CARD_DEFINITION_KEY_MISMATCH'
  | 'CARD_DEFINITION_NOT_FOUND'
  | 'OWNER_NOT_SEATED'
  | 'BASE_CONTROLLER_NOT_SEATED'
  | 'OBJECT_ID_MISMATCH'
  | 'PHYSICAL_CARD_NOT_IN_EXACTLY_ONE_OBJECT'
  | 'OBJECT_NOT_IN_EXACTLY_ONE_ZONE'
  | 'ZONE_OBJECT_NOT_FOUND'
  | 'OWNED_ZONE_OWNER_MISMATCH'
  | 'INVALID_CONTROLLER_FOR_ZONE'
  | 'UNSUPPORTED_OBJECT_KIND';

export interface CoreIdentityZoneValidationIssue {
  readonly code: CoreIdentityZoneValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreIdentityZoneValidationResult =
  | {
      readonly ok: true;
      readonly value: ModeNeutralCoreIdentityZoneSliceV1;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CoreIdentityZoneValidationIssue[];
    };

export class CoreIdentityZoneCreationError extends Error {
  readonly issues: readonly CoreIdentityZoneValidationIssue[];

  constructor(issues: readonly CoreIdentityZoneValidationIssue[]) {
    super(`Invalid mode-neutral Core identity/zone slice (${issues.length} issue(s))`);
    this.name = 'CoreIdentityZoneCreationError';
    this.issues = issues;
  }
}

const ROOT_KIND = 'mode-neutral-core-identity-zone-slice-v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PLAYER_FIELDS = [
  'life',
  'poison',
  'energy',
  'experience',
  'manaPool',
  'mulliganCount',
  'landsPlayedThisTurn',
  'spellsCastThisTurn',
  'drawnThisTurn',
  'maximumHandSizeOverride',
] as const;
const MANA_FIELDS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
const DEFINITION_FIELDS = [
  'source',
  'name',
  'layout',
  'manaValue',
  'colorIdentity',
  'typeLine',
  'keywords',
  'producedMana',
  'tokenKind',
  'faces',
] as const;
const FACE_FIELDS = [
  'name',
  'manaCost',
  'typeLine',
  'oracleText',
  'power',
  'toughness',
  'loyalty',
  'defense',
] as const;
const PHYSICAL_FIELDS = ['definitionId', 'ownerPlayerId', 'isCommander'] as const;
const OBJECT_FIELDS = ['kind', 'physicalCardId', 'incarnation', 'baseControllerPlayerId'] as const;
const PLAYER_ZONES_FIELDS = ['library', 'hand', 'graveyard'] as const;
const SHARED_ZONES_FIELDS = ['battlefield', 'stack', 'exile', 'command'] as const;
const ROOT_FIELDS = [
  'kind',
  'players',
  'turnOrder',
  'activePlayerId',
  'cardDefinitions',
  'physicalCards',
  'cardObjects',
  'zones',
] as const;
const ZONES_FIELDS = ['byPlayer', 'shared'] as const;

type StringKey = string;
type RawRecord = Record<StringKey, unknown>;

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function escapePointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pointer(...segments: readonly string[]): string {
  if (segments.length === 0) return '';
  const [base, ...children] = segments;
  return `${base}${children.map((segment) => `/${escapePointerSegment(segment)}`).join('')}`;
}

function isPlainRecord(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): { readonly value: unknown } | null {
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
  return { value: descriptor.value as unknown };
}

function ownDataValue(value: unknown, key: string): unknown {
  if (!isPlainRecord(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return isDataDescriptor(descriptor)?.value;
}

class IssueCollector {
  private readonly values: CoreIdentityZoneValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreIdentityZoneValidationCode, path: string, message: string): void {
    const key = `${path}\u0000${code}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.values.push({ code, path, message });
  }

  sorted(): readonly CoreIdentityZoneValidationIssue[] {
    return this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code));
  }
}

function readObject(
  value: unknown,
  path: string,
  fields: readonly string[],
  issues: IssueCollector,
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_TYPE', path, 'Expected a plain object record');
    return null;
  }
  const expected = new Set(fields);
  const result: RawRecord = Object.create(null) as RawRecord;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', `${path}/${escapePointerSegment(String(key))}`, 'Symbol fields are not allowed');
      continue;
    }
    const fieldPath = pointer(path, key);
    if (!expected.has(key)) {
      issues.add('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`);
      continue;
    }
    const propertyDescriptor = Object.getOwnPropertyDescriptor(value, key);
    if (propertyDescriptor === undefined || !propertyDescriptor.enumerable) {
      issues.add('UNKNOWN_FIELD', fieldPath, 'Non-enumerable fields are not allowed');
      continue;
    }
    const descriptor = isDataDescriptor(propertyDescriptor);
    if (descriptor === null) {
      issues.add('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed');
      continue;
    }
    result[key] = descriptor.value;
  }
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.add('MISSING_FIELD', pointer(path, field), `Missing field: ${field}`);
    }
  }
  return result;
}

function readRecord(value: unknown, path: string, issues: IssueCollector): readonly [string, unknown][] {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_TYPE', path, 'Expected a plain record');
    return [];
  }
  const entries: [string, unknown][] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', `${path}/${escapePointerSegment(String(key))}`, 'Symbol record keys are not allowed');
      continue;
    }
    const entryPath = pointer(path, key);
    if (isCoreUnsafeRecordKey(key)) {
      issues.add('UNSAFE_RECORD_KEY', entryPath, `Unsafe record key: ${key}`);
    }
    const propertyDescriptor = Object.getOwnPropertyDescriptor(value, key);
    if (propertyDescriptor === undefined || !propertyDescriptor.enumerable) {
      issues.add('UNKNOWN_FIELD', entryPath, 'Non-enumerable record keys are not allowed');
      continue;
    }
    const descriptor = isDataDescriptor(propertyDescriptor);
    if (descriptor === null) {
      issues.add('INVALID_TYPE', entryPath, 'Accessor record values are not allowed');
      continue;
    }
    entries.push([key, descriptor.value]);
  }
  return entries;
}

function readArray(value: unknown, path: string, issues: IssueCollector): readonly unknown[] {
  if (!Array.isArray(value)) {
    issues.add('INVALID_TYPE', path, 'Expected an array');
    return [];
  }
  const length = isDataDescriptor(Object.getOwnPropertyDescriptor(value, 'length'))?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
    issues.add('INVALID_TYPE', path, 'Expected an ordinary array length');
    return [];
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', `${path}/${escapePointerSegment(String(key))}`, 'Symbol array properties are not allowed');
      continue;
    }
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      issues.add('UNKNOWN_FIELD', pointer(path, key), `Unknown array property: ${key}`);
    }
  }
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const itemPath = pointer(path, String(index));
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable || !isDataDescriptor(descriptor)) {
      issues.add('INVALID_TYPE', itemPath, 'Array elements must be enumerable data properties');
      result.push(undefined);
      continue;
    }
    result.push(descriptor.value);
  }
  return result;
}

function stringValue(
  value: unknown,
  path: string,
  issues: IssueCollector,
  options: { readonly nonEmpty?: boolean; readonly noTrim?: boolean; readonly noCr?: boolean; readonly noNul?: boolean } = {},
): string | null {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a string');
    return null;
  }
  if (options.nonEmpty && value.length === 0) {
    issues.add('INVALID_STRING', path, 'String must not be empty');
  }
  if (options.noTrim && value.trim() !== value) {
    issues.add('INVALID_STRING', path, 'String must be trim-normalized');
  }
  if (options.noCr && value.includes('\r')) {
    issues.add('INVALID_STRING', path, 'Carriage return is not allowed');
  }
  if (options.noNul && value.includes('\0')) {
    issues.add('INVALID_STRING', path, 'NUL is not allowed');
  }
  return value;
}

function baseIdValue(value: unknown, path: string, issues: IssueCollector): string | null {
  const result = stringValue(value, path, issues);
  if (result !== null && !isCoreBaseId(result)) {
    issues.add('INVALID_ID', path, 'Invalid Core base ID');
  }
  return result;
}

function safeIntegerValue(
  value: unknown,
  path: string,
  issues: IssueCollector,
  nonNegative: boolean,
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.add('INVALID_NUMBER', path, 'Expected a finite number');
    return null;
  }
  if (!Number.isSafeInteger(value)) {
    issues.add('INVALID_INTEGER', path, 'Expected a safe integer');
  }
  if (nonNegative && value < 0) {
    issues.add('INVALID_INTEGER', path, 'Expected a non-negative integer');
  }
  return value;
}

function finiteNonNegativeNumber(value: unknown, path: string, issues: IssueCollector): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.add('INVALID_NUMBER', path, 'Expected a finite number');
    return null;
  }
  if (value < 0) issues.add('INVALID_NUMBER', path, 'Expected a non-negative number');
  return value;
}

function literalValue<T extends string | boolean | null>(
  value: unknown,
  expected: T,
  path: string,
  issues: IssueCollector,
): value is T {
  if (value !== expected) {
    issues.add('INVALID_LITERAL', path, `Expected literal ${String(expected)}`);
    return false;
  }
  return true;
}

function validateIdRecordKeys(
  entries: readonly [string, unknown][],
  path: string,
  issues: IssueCollector,
): void {
  for (const [key] of entries) baseIdValue(key, pointer(path, key), issues);
}

function validateManaPool(value: unknown, path: string, issues: IssueCollector): void {
  const object = readObject(value, path, MANA_FIELDS, issues);
  if (!object) return;
  for (const field of MANA_FIELDS) safeIntegerValue(object[field], pointer(path, field), issues, true);
}

function validatePlayerState(value: unknown, path: string, issues: IssueCollector): void {
  const object = readObject(value, path, PLAYER_FIELDS, issues);
  if (!object) return;
  safeIntegerValue(object.life, pointer(path, 'life'), issues, false);
  for (const field of [
    'poison',
    'energy',
    'experience',
    'mulliganCount',
    'landsPlayedThisTurn',
    'spellsCastThisTurn',
    'drawnThisTurn',
  ]) {
    safeIntegerValue(object[field], pointer(path, field), issues, true);
  }
  validateManaPool(object.manaPool, pointer(path, 'manaPool'), issues);
  const overridePath = pointer(path, 'maximumHandSizeOverride');
  if (object.maximumHandSizeOverride !== null && object.maximumHandSizeOverride !== 'none') {
    safeIntegerValue(object.maximumHandSizeOverride, overridePath, issues, true);
  }
}

function validateOrderedUniqueStrings(
  value: unknown,
  path: string,
  issues: IssueCollector,
  allowed: readonly string[] | null,
  allowEmpty: boolean,
  requireSorted: boolean,
): void {
  const array = readArray(value, path, issues);
  const seen = new Set<string>();
  let previous: string | undefined;
  for (let index = 0; index < array.length; index += 1) {
    const itemPath = pointer(path, String(index));
    const item = stringValue(array[index], itemPath, issues, {
      nonEmpty: !allowEmpty,
      noTrim: !allowEmpty,
    });
    if (item === null) continue;
    if (allowed !== null && !allowed.includes(item)) {
      issues.add('INVALID_LITERAL', itemPath, `Unsupported value: ${item}`);
    }
    if (seen.has(item)) issues.add('DUPLICATE_VALUE', itemPath, `Duplicate value: ${item}`);
    seen.add(item);
    if (requireSorted && previous !== undefined && codeUnitCompare(previous, item) > 0) {
      issues.add('INVALID_ORDER', itemPath, 'Values must be code-unit sorted');
    }
    previous = item;
  }
}

function validateCanonicalOrder(
  value: unknown,
  path: string,
  order: readonly string[],
  issues: IssueCollector,
): void {
  if (!Array.isArray(value)) return;
  const array = readArray(value, path, issues);
  const rank = new Map(order.map((item, index) => [item, index]));
  let previous = -1;
  for (let index = 0; index < array.length; index += 1) {
    const item = array[index];
    if (typeof item !== 'string') continue;
    const current = rank.get(item);
    if (current === undefined) continue;
    if (current < previous) issues.add('INVALID_ORDER', pointer(path, String(index)), 'Values are not in canonical order');
    previous = current;
  }
}

function validateDefinitionSource(
  value: unknown,
  path: string,
  definitionKey: string,
  issues: IssueCollector,
): void {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_TYPE', path, 'Expected a card-definition source object');
    return;
  }
  const kindDescriptor = isDataDescriptor(Object.getOwnPropertyDescriptor(value, 'kind'));
  const kind = kindDescriptor?.value;
  if (kind === 'scryfall') {
    const object = readObject(value, path, ['kind', 'scryfallId', 'oracleId'], issues);
    if (!object) return;
    literalValue(object.kind, 'scryfall', pointer(path, 'kind'), issues);
    const scryfallId = stringValue(object.scryfallId, pointer(path, 'scryfallId'), issues);
    const oracleId = stringValue(object.oracleId, pointer(path, 'oracleId'), issues);
    if (scryfallId !== null && !UUID_PATTERN.test(scryfallId)) {
      issues.add('INVALID_STRING', pointer(path, 'scryfallId'), 'Expected a lower-case UUID');
    }
    if (oracleId !== null && !UUID_PATTERN.test(oracleId)) {
      issues.add('INVALID_STRING', pointer(path, 'oracleId'), 'Expected a lower-case UUID');
    }
    if (scryfallId !== null && definitionKey !== scryfallId) {
      issues.add('CARD_DEFINITION_KEY_MISMATCH', pointer(path, 'scryfallId'), 'Record key must equal scryfallId');
    }
    return;
  }
  if (kind === 'engine-synthetic') {
    const object = readObject(value, path, ['kind'], issues);
    if (object) literalValue(object.kind, 'engine-synthetic', pointer(path, 'kind'), issues);
    return;
  }
  issues.add('INVALID_LITERAL', pointer(path, 'kind'), 'Unsupported card-definition source kind');
}

function validateFace(value: unknown, path: string, issues: IssueCollector): void {
  const object = readObject(value, path, FACE_FIELDS, issues);
  if (!object) return;
  for (const field of ['name', 'typeLine']) {
    stringValue(object[field], pointer(path, field), issues, { nonEmpty: true, noTrim: true, noCr: true, noNul: true });
  }
  stringValue(object.oracleText, pointer(path, 'oracleText'), issues, { noCr: true, noNul: true });
  for (const field of ['manaCost', 'power', 'toughness', 'loyalty', 'defense']) {
    if (object[field] !== null) stringValue(object[field], pointer(path, field), issues);
  }
}

function validateDefinition(
  value: unknown,
  path: string,
  definitionKey: string,
  issues: IssueCollector,
): void {
  const object = readObject(value, path, DEFINITION_FIELDS, issues);
  if (!object) return;
  validateDefinitionSource(object.source, pointer(path, 'source'), definitionKey, issues);
  for (const field of ['name', 'layout', 'typeLine']) {
    stringValue(object[field], pointer(path, field), issues, { nonEmpty: true, noTrim: true, noCr: true, noNul: true });
  }
  finiteNonNegativeNumber(object.manaValue, pointer(path, 'manaValue'), issues);
  validateOrderedUniqueStrings(object.colorIdentity, pointer(path, 'colorIdentity'), issues, ['W', 'U', 'B', 'R', 'G'], true, false);
  validateCanonicalOrder(object.colorIdentity, pointer(path, 'colorIdentity'), ['W', 'U', 'B', 'R', 'G'], issues);
  validateOrderedUniqueStrings(object.producedMana, pointer(path, 'producedMana'), issues, ['W', 'U', 'B', 'R', 'G', 'C'], true, false);
  validateCanonicalOrder(object.producedMana, pointer(path, 'producedMana'), ['W', 'U', 'B', 'R', 'G', 'C'], issues);
  validateOrderedUniqueStrings(object.keywords, pointer(path, 'keywords'), issues, null, false, true);
  if (object.tokenKind !== null) {
    const tokenKinds = [
      'treasure', 'clue', 'food', 'blood', 'cursed-role', 'monster-role',
      'royal-role', 'sorcerer-role', 'virtuous-role', 'wicked-role', 'young-hero-role',
    ];
    if (typeof object.tokenKind !== 'string' || !tokenKinds.includes(object.tokenKind)) {
      issues.add('INVALID_LITERAL', pointer(path, 'tokenKind'), 'Unsupported token kind');
    }
  }
  const faces = readArray(object.faces, pointer(path, 'faces'), issues);
  if (faces.length === 0) issues.add('INVALID_ARRAY_LENGTH', pointer(path, 'faces'), 'At least one face is required');
  for (let index = 0; index < faces.length; index += 1) {
    validateFace(faces[index], pointer(path, 'faces', String(index)), issues);
  }
}

function validatePhysicalCard(value: unknown, path: string, players: ReadonlySet<string>, definitions: ReadonlySet<string>, issues: IssueCollector): void {
  const object = readObject(value, path, PHYSICAL_FIELDS, issues);
  if (!object) return;
  const definitionId = baseIdValue(object.definitionId, pointer(path, 'definitionId'), issues);
  const owner = baseIdValue(object.ownerPlayerId, pointer(path, 'ownerPlayerId'), issues);
  if (definitionId !== null && !definitions.has(definitionId)) {
    issues.add('CARD_DEFINITION_NOT_FOUND', pointer(path, 'definitionId'), 'Referenced definition does not exist');
  }
  if (owner !== null && !players.has(owner)) {
    issues.add('OWNER_NOT_SEATED', pointer(path, 'ownerPlayerId'), 'Owner is not seated');
  }
  if (typeof object.isCommander !== 'boolean') issues.add('INVALID_TYPE', pointer(path, 'isCommander'), 'Expected boolean');
}

function parseObjectId(value: unknown, path: string, issues: IssueCollector): { physicalId: string; incarnation: number } | null {
  const objectId = stringValue(value, path, issues);
  if (objectId === null) return null;
  const separator = objectId.lastIndexOf(':');
  if (separator <= 0 || separator === objectId.length - 1) {
    issues.add('INVALID_ID', path, 'Invalid Core object ID');
    return null;
  }
  const physicalId = objectId.slice(0, separator);
  const incarnationText = objectId.slice(separator + 1);
  const incarnation = Number(incarnationText);
  if (!isCoreBaseId(physicalId) || !isCoreSafeIncarnation(incarnation) || String(incarnation) !== incarnationText) {
    issues.add('INVALID_ID', path, 'Invalid Core object ID');
    return null;
  }
  return { physicalId, incarnation };
}

function validateCardObject(
  value: unknown,
  path: string,
  objectKey: string,
  players: ReadonlySet<string>,
  physicalCards: ReadonlySet<string>,
  issues: IssueCollector,
): void {
  const object = readObject(value, path, OBJECT_FIELDS, issues);
  if (!object) return;
  if (object.kind !== 'card') {
    issues.add('UNSUPPORTED_OBJECT_KIND', pointer(path, 'kind'), 'Only card objects are supported');
  }
  const physicalId = baseIdValue(object.physicalCardId, pointer(path, 'physicalCardId'), issues);
  const incarnation = safeIntegerValue(object.incarnation, pointer(path, 'incarnation'), issues, true);
  const parsedKey = parseObjectId(objectKey, pointer('/cardObjects', objectKey), issues);
  if (parsedKey !== null && (physicalId !== parsedKey.physicalId || incarnation !== parsedKey.incarnation)) {
    issues.add('OBJECT_ID_MISMATCH', path, 'Object key does not match physicalCardId/incarnation');
  }
  if (physicalId !== null && !physicalCards.has(physicalId)) {
    issues.add('PHYSICAL_CARD_NOT_IN_EXACTLY_ONE_OBJECT', pointer(path, 'physicalCardId'), 'Physical card does not exist');
  }
  if (object.baseControllerPlayerId !== null) {
    const controller = baseIdValue(object.baseControllerPlayerId, pointer(path, 'baseControllerPlayerId'), issues);
    if (controller !== null && !players.has(controller)) {
      issues.add('BASE_CONTROLLER_NOT_SEATED', pointer(path, 'baseControllerPlayerId'), 'Base controller is not seated');
    }
  }
}

function validateZoneArray(
  value: unknown,
  path: string,
  issues: IssueCollector,
  objectKeys: ReadonlySet<string>,
  objectLocations: Map<string, number>,
): void {
  const array = readArray(value, path, issues);
  const local = new Set<string>();
  for (let index = 0; index < array.length; index += 1) {
    const itemPath = pointer(path, String(index));
    const item = stringValue(array[index], itemPath, issues);
    if (item === null) continue;
    parseObjectId(item, itemPath, issues);
    if (local.has(item)) issues.add('OBJECT_NOT_IN_EXACTLY_ONE_ZONE', itemPath, 'Object is duplicated in one zone');
    local.add(item);
    objectLocations.set(item, (objectLocations.get(item) ?? 0) + 1);
    if (!objectKeys.has(item)) issues.add('ZONE_OBJECT_NOT_FOUND', itemPath, 'Zone references an unknown object');
  }
}

function validatePlayerZones(
  value: unknown,
  path: string,
  playerId: string,
  owners: ReadonlyMap<string, string>,
  objectKeys: ReadonlySet<string>,
  objectLocations: Map<string, number>,
  issues: IssueCollector,
): void {
  const object = readObject(value, path, PLAYER_ZONES_FIELDS, issues);
  if (!object) return;
  for (const zone of PLAYER_ZONES_FIELDS) {
    const zonePath = pointer(path, zone);
    validateZoneArray(object[zone], zonePath, issues, objectKeys, objectLocations);
    const array = readArray(object[zone], zonePath, issues);
    for (let index = 0; index < array.length; index += 1) {
      const objectId: unknown = array[index];
      if (typeof objectId !== 'string') continue;
      const owner = owners.get(objectId);
      if (owner !== undefined && owner !== playerId) {
        issues.add('OWNED_ZONE_OWNER_MISMATCH', pointer(zonePath, String(index)), 'Player-scoped zone contains another player\'s card');
      }
    }
  }
}

function validateSharedZones(
  value: unknown,
  path: string,
  objectKeys: ReadonlySet<string>,
  objectLocations: Map<string, number>,
  issues: IssueCollector,
): void {
  const object = readObject(value, path, SHARED_ZONES_FIELDS, issues);
  if (!object) return;
  for (const zone of SHARED_ZONES_FIELDS) {
    validateZoneArray(object[zone], pointer(path, zone), issues, objectKeys, objectLocations);
  }
}

function cloneData(value: unknown): unknown {
  if (Array.isArray(value)) {
    const length = isDataDescriptor(Object.getOwnPropertyDescriptor(value, 'length'))?.value;
    if (typeof length !== 'number') return [];
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = isDataDescriptor(Object.getOwnPropertyDescriptor(value, String(index)));
      result.push(descriptor === null ? undefined : cloneData(descriptor.value));
    }
    return result;
  }
  if (isPlainRecord(value)) {
    const result: RawRecord = Object.create(null) as RawRecord;
    for (const key of Object.keys(value)) {
      const descriptor = isDataDescriptor(Object.getOwnPropertyDescriptor(value, key));
      if (descriptor !== null) result[key] = cloneData(descriptor.value);
    }
    return result;
  }
  return value;
}

export function deepFreezeCoreValue<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = isDataDescriptor(Object.getOwnPropertyDescriptor(value, key));
      if (descriptor !== null) deepFreezeCoreValue(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}

function validateCrossStructure(root: RawRecord, issues: IssueCollector): void {
  const turnOrder = readArray(root.turnOrder, '/turnOrder', issues);
  const playersEntries = readRecord(root.players, '/players', issues);
  validateIdRecordKeys(playersEntries, '/players', issues);
  const playerIds = new Set<string>();
  for (let index = 0; index < turnOrder.length; index += 1) {
    const id = baseIdValue(turnOrder[index], pointer('/turnOrder', String(index)), issues);
    if (id !== null) {
      if (playerIds.has(id)) issues.add('DUPLICATE_VALUE', pointer('/turnOrder', String(index)), 'Duplicate player ID');
      playerIds.add(id);
    }
  }
  const playerKeys = new Set(playersEntries.map(([key]) => key));
  for (const id of playerIds) if (!playerKeys.has(id)) issues.add('PLAYER_SET_MISMATCH', pointer('/players', id), 'Player record is missing from turnOrder');
  for (const [key] of playersEntries) if (!playerIds.has(key)) issues.add('PLAYER_SET_MISMATCH', pointer('/players', key), 'Player record is not seated in turnOrder');
  if (turnOrder.length === 0) issues.add('INVALID_ARRAY_LENGTH', '/turnOrder', 'At least one player is required');
  const active = baseIdValue(root.activePlayerId, '/activePlayerId', issues);
  if (active !== null && !playerIds.has(active)) issues.add('ACTIVE_PLAYER_NOT_SEATED', '/activePlayerId', 'Active player is not in turnOrder');
  for (const [key, value] of playersEntries) validatePlayerState(value, pointer('/players', key), issues);

  const definitionsEntries = readRecord(root.cardDefinitions, '/cardDefinitions', issues);
  validateIdRecordKeys(definitionsEntries, '/cardDefinitions', issues);
  const definitionIds = new Set(definitionsEntries.map(([key]) => key));
  for (const [key, value] of definitionsEntries) validateDefinition(value, pointer('/cardDefinitions', key), key, issues);

  const physicalEntries = readRecord(root.physicalCards, '/physicalCards', issues);
  validateIdRecordKeys(physicalEntries, '/physicalCards', issues);
  const physicalIds = new Set(physicalEntries.map(([key]) => key));
  for (const [key, value] of physicalEntries) validatePhysicalCard(value, pointer('/physicalCards', key), playerIds, definitionIds, issues);
  const owners = new Map<string, string>();
  for (const [key, value] of physicalEntries) {
    const owner = ownDataValue(value, 'ownerPlayerId');
    if (typeof owner === 'string') owners.set(key, owner);
  }

  const objectEntries = readRecord(root.cardObjects, '/cardObjects', issues);
  const objectKeys = new Set(objectEntries.map(([key]) => key));
  for (const [key, value] of objectEntries) validateCardObject(value, pointer('/cardObjects', key), key, playerIds, physicalIds, issues);
  const objectPhysicalCounts = new Map<string, number>();
  for (const [, value] of objectEntries) {
    const physicalId = ownDataValue(value, 'physicalCardId');
    if (typeof physicalId === 'string') {
      objectPhysicalCounts.set(physicalId, (objectPhysicalCounts.get(physicalId) ?? 0) + 1);
    }
  }
  for (const physicalId of physicalIds) {
    if (objectPhysicalCounts.get(physicalId) !== 1) {
      issues.add('PHYSICAL_CARD_NOT_IN_EXACTLY_ONE_OBJECT', pointer('/physicalCards', physicalId), 'Physical card must have exactly one object');
    }
  }

  const zonesObject = readObject(root.zones, '/zones', ZONES_FIELDS, issues);
  const objectLocations = new Map<string, number>();
  if (zonesObject) {
    const byPlayerEntries = readRecord(zonesObject.byPlayer, '/zones/byPlayer', issues);
    validateIdRecordKeys(byPlayerEntries, '/zones/byPlayer', issues);
    const byPlayerKeys = new Set(byPlayerEntries.map(([key]) => key));
    for (const id of playerIds) if (!byPlayerKeys.has(id)) issues.add('PLAYER_SET_MISMATCH', pointer('/zones/byPlayer', id), 'Zone record is missing from turnOrder');
    for (const [key] of byPlayerEntries) if (!playerIds.has(key)) issues.add('PLAYER_SET_MISMATCH', pointer('/zones/byPlayer', key), 'Zone record is not seated in turnOrder');
    for (const [key, value] of byPlayerEntries) {
      validatePlayerZones(value, pointer('/zones/byPlayer', key), key, owners, objectKeys, objectLocations, issues);
    }
    validateSharedZones(zonesObject.shared, '/zones/shared', objectKeys, objectLocations, issues);
  }
  for (const objectKey of objectKeys) {
    if (objectLocations.get(objectKey) !== 1) {
      issues.add('OBJECT_NOT_IN_EXACTLY_ONE_ZONE', pointer('/cardObjects', objectKey), 'Object must occur in exactly one zone');
    }
  }
  for (const [objectKey, count] of objectLocations) {
    if (count !== 1) issues.add('OBJECT_NOT_IN_EXACTLY_ONE_ZONE', pointer('/cardObjects', objectKey), 'Object must occur in exactly one zone');
  }

  if (zonesObject) {
    const allPlayerZones: Array<{ readonly playerId: string; readonly zone: string; readonly ids: readonly unknown[] }> = [];
    const byPlayerEntries = readRecord(zonesObject.byPlayer, '/zones/byPlayer', issues);
    for (const [playerId, value] of byPlayerEntries) {
      if (!isPlainRecord(value)) continue;
      for (const zone of ['library', 'hand', 'graveyard'] as const) {
        const zoneValue = ownDataValue(value, zone);
        allPlayerZones.push({
          playerId,
          zone,
          ids: readArray(zoneValue, pointer('/zones/byPlayer', playerId, zone), issues),
        });
      }
    }
    for (const { playerId, zone, ids } of allPlayerZones) {
      for (let index = 0; index < ids.length; index += 1) {
        const objectId = ids[index];
        if (typeof objectId !== 'string') continue;
        const object = objectEntries.find(([key]) => key === objectId)?.[1];
        if (!isPlainRecord(object)) continue;
        const physicalId = ownDataValue(object, 'physicalCardId');
        const owner = owners.get(typeof physicalId === 'string' ? physicalId : '');
        if (owner !== undefined && owner !== playerId) {
          issues.add('OWNED_ZONE_OWNER_MISMATCH', pointer('/zones/byPlayer', playerId, zone, String(index)), 'Owner does not match player-scoped zone');
        }
        const controller = ownDataValue(object, 'baseControllerPlayerId');
        if (controller !== null && controller !== undefined) {
          issues.add(
            'INVALID_CONTROLLER_FOR_ZONE',
            pointer('/cardObjects', String(objectId), 'baseControllerPlayerId'),
            `${zone} card must not have a base controller`,
          );
        }
      }
    }
    const shared = isPlainRecord(zonesObject.shared) ? zonesObject.shared : null;
    if (shared) {
      for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
        const zoneValue = ownDataValue(shared, zone);
        const ids = readArray(zoneValue, pointer('/zones/shared', zone), issues);
        for (let index = 0; index < ids.length; index += 1) {
          const objectId: unknown = ids[index];
          const object = typeof objectId === 'string' ? objectEntries.find(([key]) => key === objectId)?.[1] : undefined;
          if (!isPlainRecord(object)) continue;
          const controller = ownDataValue(object, 'baseControllerPlayerId');
          const controllerPath = pointer('/cardObjects', String(objectId), 'baseControllerPlayerId');
          if (zone === 'battlefield' || zone === 'stack') {
            if (controller === null) issues.add('INVALID_CONTROLLER_FOR_ZONE', controllerPath, 'Battlefield/stack card requires a controller');
            else if (typeof controller !== 'string' || !playerIds.has(controller)) issues.add('BASE_CONTROLLER_NOT_SEATED', controllerPath, 'Controller is not seated');
          } else if (controller !== null) {
            issues.add('INVALID_CONTROLLER_FOR_ZONE', controllerPath, `${zone} card must not have a base controller`);
          }
        }
      }
    }
  }
}

export function validateModeNeutralCoreIdentityZoneSliceV1(value: unknown): CoreIdentityZoneValidationResult {
  const issues = new IssueCollector();
  if (!isPlainRecord(value)) {
    issues.add('INVALID_ROOT', '', 'Expected a plain root object');
    return { ok: false, issues: issues.sorted() };
  }
  const root = readObject(value, '', ROOT_FIELDS, issues);
  if (!root) {
    return { ok: false, issues: issues.sorted() };
  }
  literalValue(root.kind, ROOT_KIND, '/kind', issues);
  validateCrossStructure(root, issues);
  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0) return { ok: false, issues: sortedIssues };
  const cloned = cloneData(root) as ModeNeutralCoreIdentityZoneSliceV1;
  return { ok: true, value: deepFreezeCoreValue(cloned) };
}

export type {
  CoreCardDefinitionId,
  CoreCardDefinitionSnapshotV1,
  CoreCardDefinitionSourceV1,
  CoreCardFaceSnapshotV1,
  CoreCardObjectIdentityV1,
  CoreColorIdentityV1,
  CoreManaColorV1,
  CoreManaPoolV1,
  CorePhysicalCardId,
  CorePlayerStateV1,
  CorePlayerZonesV1,
  CoreSharedZonesV1,
};
