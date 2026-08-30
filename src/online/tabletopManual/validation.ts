import { isCanonicalCoreObjectIdV2 } from '../../engine/core/object/objectIdV2';
import { isCoreBaseId, isCoreUnsafeRecordKey } from '../../engine/core/ids';
import { validateCoreCardZoneDestinationV1 } from '../../engine/core/transition/zoneDestination';
import type { CoreCardDefinitionSnapshotV1 } from '../../engine/core/cardDefinition';
import type { OnlineTabletopIntentEnvelopeV1, OnlineTabletopIntentValidationIssueV1, OnlineTabletopIntentValidationResultV1, OnlineTabletopPrimitiveV1, OnlineTabletopPrimitiveKindV1 } from './types';

const ROOT_FIELDS = ['kind', 'schemaVersion', 'commandId', 'baseRevision', 'mode', 'primitive'] as const;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const APPLICATION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const TOKEN_DEFINITION_MAX_SERIALIZED_BYTES_V1 = 8_192;
const TOKEN_DEFINITION_MAX_STRING_LENGTH_V1 = 512;
const TOKEN_DEFINITION_MAX_KEYWORDS_V1 = 16;
const TOKEN_DEFINITION_MAX_FACES_V1 = 2;
const TOKEN_DEFINITION_MAX_COLORS_V1 = 5;
const TOKEN_DEFINITION_MAX_PRODUCED_MANA_V1 = 6;
const TOKEN_KINDS = ['treasure', 'clue', 'food', 'blood', 'cursed-role', 'monster-role', 'royal-role', 'sorcerer-role', 'virtuous-role', 'wicked-role', 'young-hero-role'] as const;
const SAFE_TEXT = (value: string, max: number): boolean => value.length >= 1 && value.length <= max && value.trim() === value && ![...value].some((ch) => { const cp = ch.codePointAt(0) ?? 0; return cp <= 0x1f || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f); });
const boundedTokenText = (value: unknown, max = TOKEN_DEFINITION_MAX_STRING_LENGTH_V1, allowEmpty = false): value is string => typeof value === 'string' && value.length <= max && (allowEmpty || value.length > 0) && ![...value].some((ch) => { const cp = ch.codePointAt(0) ?? 0; return cp <= 0x1f || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f); });
function issue(code: string, path: string, message: string): OnlineTabletopIntentValidationIssueV1 { return Object.freeze({ code, path, message }); }
function plain(value: unknown): value is Record<string, unknown> { try { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null); } catch { return false; } }
function readRecord(value: unknown, fields: readonly string[], required: readonly string[], path: string, issues: OnlineTabletopIntentValidationIssueV1[]): Record<string, unknown> | null {
  if (!plain(value)) { issues.push(issue('INVALID_TYPE', path, 'Expected a plain record')); return null; }
  const out = Object.create(null) as Record<string, unknown>; const allowed = new Set(fields);
  let keys: readonly PropertyKey[]; try { keys = Reflect.ownKeys(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Record descriptors are not readable')); return null; }
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) { issues.push(issue('UNKNOWN_FIELD', `${path}/${String(key)}`, 'Unknown field')); continue; }
    let descriptor: PropertyDescriptor | undefined; try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field must be an enumerable data property')); else out[key] = descriptor.value;
  }
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(out, key)) issues.push(issue('MISSING_FIELD', `${path}/${key}`, 'Required field is missing'));
  return out;
}
function readArray(value: unknown, path: string, issues: OnlineTabletopIntentValidationIssueV1[], maxLength = 10_000): readonly unknown[] | null {
  let ordinary: boolean;
  try { ordinary = Array.isArray(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe')); return null; }
  if (!ordinary) { issues.push(issue('INVALID_ARRAY', path, 'Expected an array')); return null; }
  const array = value as object;
  let length: number;
  let keys: readonly PropertyKey[];
  try {
    if (Reflect.getPrototypeOf(array) !== Array.prototype) issues.push(issue('INVALID_ARRAY', path, 'Expected an ordinary array'));
    const descriptor = Object.getOwnPropertyDescriptor(array, 'length');
    if (descriptor === undefined || !('value' in descriptor) || typeof descriptor.value !== 'number') throw new Error();
    length = descriptor.value;
    keys = Reflect.ownKeys(array);
  } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable')); return null; }
  if (!Number.isSafeInteger(length) || length < 0) { issues.push(issue('INVALID_ARRAY', `${path}/length`, 'Array length must be a non-negative safe integer')); return null; }
  if (length > maxLength) { issues.push(issue('INVALID_ARRAY', `${path}/length`, 'Array exceeds the bounded tabletop limit')); return null; }
  const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
  for (const key of keys) if (typeof key !== 'string' || !allowed.has(key)) issues.push(issue('UNKNOWN_FIELD', `${path}/${String(key)}`, 'Array has an unknown field'));
  const out: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(array, String(index)); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array must be dense data'));
    else out.push(descriptor.value);
  }
  return out;
}

function nonZeroInteger(value: unknown, path: string, issues: OnlineTabletopIntentValidationIssueV1[]): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value === 0 || Object.is(value, -0)) issues.push(issue('INVALID_INTEGER', path, 'Expected a non-zero safe integer'));
}
function boundedDefinition(value: unknown, path: string, issues: OnlineTabletopIntentValidationIssueV1[]): CoreCardDefinitionSnapshotV1 | null {
  const fields = ['source', 'name', 'layout', 'manaValue', 'colorIdentity', 'typeLine', 'keywords', 'producedMana', 'tokenKind', 'faces'] as const;
  const row = readRecord(value, fields, fields, path, issues);
  if (row === null) return null;
  const source = readRecord(row.source, ['kind'], ['kind'], `${path}/source`, issues);
  if (source?.kind !== 'engine-synthetic') issues.push(issue('INVALID_LITERAL', `${path}/source/kind`, 'Token definition source must be engine-synthetic'));
  if (typeof row.name !== 'string' || !SAFE_TEXT(row.name, TOKEN_DEFINITION_MAX_STRING_LENGTH_V1)) issues.push(issue('INVALID_STRING', `${path}/name`, 'Invalid token name'));
  if (typeof row.layout !== 'string' || !SAFE_TEXT(row.layout, TOKEN_DEFINITION_MAX_STRING_LENGTH_V1)) issues.push(issue('INVALID_STRING', `${path}/layout`, 'Invalid token layout'));
  if (typeof row.typeLine !== 'string' || !SAFE_TEXT(row.typeLine, TOKEN_DEFINITION_MAX_STRING_LENGTH_V1)) issues.push(issue('INVALID_STRING', `${path}/typeLine`, 'Invalid token type line'));
  if (typeof row.manaValue !== 'number' || !Number.isSafeInteger(row.manaValue) || row.manaValue < 0 || Object.is(row.manaValue, -0)) issues.push(issue('INVALID_INTEGER', `${path}/manaValue`, 'Invalid token mana value'));
  const colors = readArray(row.colorIdentity, `${path}/colorIdentity`, issues, TOKEN_DEFINITION_MAX_COLORS_V1);
  if (colors !== null) colors.forEach((entry, index) => { if (entry !== 'W' && entry !== 'U' && entry !== 'B' && entry !== 'R' && entry !== 'G') issues.push(issue('INVALID_LITERAL', `${path}/colorIdentity/${index}`, 'Invalid token color identity')); });
  const keywords = readArray(row.keywords, `${path}/keywords`, issues, TOKEN_DEFINITION_MAX_KEYWORDS_V1);
  if (keywords !== null) keywords.forEach((entry, index) => { if (!boundedTokenText(entry)) issues.push(issue('INVALID_STRING', `${path}/keywords/${index}`, 'Invalid token keyword')); });
  const producedMana = readArray(row.producedMana, `${path}/producedMana`, issues, TOKEN_DEFINITION_MAX_PRODUCED_MANA_V1);
  if (producedMana !== null) producedMana.forEach((entry, index) => { if (entry !== 'W' && entry !== 'U' && entry !== 'B' && entry !== 'R' && entry !== 'G' && entry !== 'C') issues.push(issue('INVALID_LITERAL', `${path}/producedMana/${index}`, 'Invalid token produced mana')); });
  if (row.tokenKind !== null && !TOKEN_KINDS.includes(row.tokenKind as typeof TOKEN_KINDS[number])) issues.push(issue('INVALID_LITERAL', `${path}/tokenKind`, 'Invalid token kind'));
  const faceFields = ['name', 'manaCost', 'typeLine', 'oracleText', 'power', 'toughness', 'loyalty', 'defense'] as const;
  const faces = readArray(row.faces, `${path}/faces`, issues, TOKEN_DEFINITION_MAX_FACES_V1);
  const normalizedFaces: CoreCardDefinitionSnapshotV1['faces'][number][] = [];
  if (faces === null || faces.length === 0) issues.push(issue('INVALID_ARRAY', `${path}/faces`, 'Token definition must contain at least one face'));
  else faces.forEach((entry, index) => {
    const face = readRecord(entry, faceFields, faceFields, `${path}/faces/${index}`, issues);
    if (face === null) return;
    if (!boundedTokenText(face.name) || !SAFE_TEXT(face.name, TOKEN_DEFINITION_MAX_STRING_LENGTH_V1)) issues.push(issue('INVALID_STRING', `${path}/faces/${index}/name`, 'Invalid token face name'));
    if (!boundedTokenText(face.typeLine) || !SAFE_TEXT(face.typeLine, TOKEN_DEFINITION_MAX_STRING_LENGTH_V1)) issues.push(issue('INVALID_STRING', `${path}/faces/${index}/typeLine`, 'Invalid token face type line'));
    const optionalFaceStrings: Array<keyof Pick<CoreCardDefinitionSnapshotV1['faces'][number], 'manaCost' | 'oracleText' | 'power' | 'toughness' | 'loyalty' | 'defense'>> = ['manaCost', 'oracleText', 'power', 'toughness', 'loyalty', 'defense'];
    for (const key of optionalFaceStrings) if (face[key] !== null && !boundedTokenText(face[key], TOKEN_DEFINITION_MAX_STRING_LENGTH_V1, true)) issues.push(issue('INVALID_STRING', `${path}/faces/${index}/${key}`, 'Invalid token face text'));
    normalizedFaces.push(Object.freeze({
      name: face.name as string,
      manaCost: face.manaCost as string | null,
      typeLine: face.typeLine as string,
      oracleText: face.oracleText as string,
      power: face.power as string | null,
      toughness: face.toughness as string | null,
      loyalty: face.loyalty as string | null,
      defense: face.defense as string | null,
    }));
  });
  if (issues.length > 0) return null;
  const normalized: CoreCardDefinitionSnapshotV1 = Object.freeze({
    source: Object.freeze({ kind: 'engine-synthetic' as const }),
    name: row.name as string,
    layout: row.layout as string,
    manaValue: row.manaValue as number,
    colorIdentity: Object.freeze((colors ?? []).slice() as CoreCardDefinitionSnapshotV1['colorIdentity']),
    typeLine: row.typeLine as string,
    keywords: Object.freeze((keywords ?? []).slice() as string[]),
    producedMana: Object.freeze((producedMana ?? []).slice() as CoreCardDefinitionSnapshotV1['producedMana']),
    tokenKind: row.tokenKind as CoreCardDefinitionSnapshotV1['tokenKind'],
    faces: Object.freeze(normalizedFaces),
  });
  let serialized: string;
  try { serialized = JSON.stringify(normalized); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Token definition could not be serialized safely')); return null; }
  if (new TextEncoder().encode(serialized).length > TOKEN_DEFINITION_MAX_SERIALIZED_BYTES_V1) {
    issues.push(issue('INVALID_SIZE', path, 'Token definition exceeds the bounded projection budget'));
    return null;
  }
  return normalized;
}
export function validateOnlineTabletopIntentEnvelopeV1(input: unknown): OnlineTabletopIntentValidationResultV1 {
  const issues: OnlineTabletopIntentValidationIssueV1[] = []; const root = readRecord(input, ROOT_FIELDS, ROOT_FIELDS, '', issues);
  if (root === null) return Object.freeze({ ok: false as const, issues: Object.freeze(issues) });
  if (root.kind !== 'online-tabletop-intent-envelope-v1') issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid tabletop intent kind'));
  if (root.schemaVersion !== 1) issues.push(issue('INVALID_VERSION', '/schemaVersion', 'Unsupported tabletop intent version'));
  if (typeof root.commandId !== 'string' || !ID.test(root.commandId)) issues.push(issue('INVALID_ID', '/commandId', 'Invalid command ID'));
  if (typeof root.baseRevision !== 'number' || !Number.isSafeInteger(root.baseRevision) || root.baseRevision < 0) issues.push(issue('INVALID_INTEGER', '/baseRevision', 'Invalid base revision'));
  if (root.mode !== 'structured' && root.mode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/mode', 'Manual mode must be structured or freeform'));
  const primitiveFields = ['kind', 'objectId', 'targetObjectId', 'destination', 'zone', 'order', 'count', 'tapped', 'counterKind', 'color', 'field', 'delta', 'gainingControllerPlayerId', 'amount', 'noteId', 'entryId', 'text', 'label', 'sourceObjectId', 'tokenSeed', 'definitionId', 'definition', 'held'] as const;
  const primitive = readRecord(root.primitive, primitiveFields, ['kind'], '/primitive', issues);
  if (primitive !== null) {
    const kind = primitive.kind as string; const allowedByKind: Record<string, readonly string[]> = {
      move: ['kind', 'objectId', 'destination'], draw: ['kind', 'count'], shuffle: ['kind'], reorder: ['kind', 'zone', 'order'], tap: ['kind', 'objectId', 'tapped'], counter: ['kind', 'objectId', 'counterKind', 'delta'], mana: ['kind', 'color', 'delta'], life: ['kind', 'field', 'delta'], 'token-create': ['kind', 'tokenSeed', 'definitionId', 'definition'], 'token-remove': ['kind', 'objectId'], controller: ['kind', 'objectId', 'gainingControllerPlayerId'], attach: ['kind', 'objectId', 'targetObjectId'], damage: ['kind', 'objectId', 'amount'], 'note-set': ['kind', 'noteId', 'text'], 'note-clear': ['kind', 'noteId'], 'stack-entry': ['kind', 'entryId', 'label', 'sourceObjectId'], 'manual-resolve': ['kind', 'entryId'], 'priority-hold': ['kind', 'held'], 'priority-advance': ['kind'], 'priority-resolve': ['kind'], 'play-land': ['kind', 'objectId'], 'cast-spell': ['kind', 'objectId'], look: ['kind'], reveal: ['kind'], choose: ['kind'],
    };
    const allowed = allowedByKind[kind]; if (allowed === undefined) issues.push(issue('INVALID_LITERAL', '/primitive/kind', 'Unsupported tabletop primitive')); else {
      for (const key of Object.keys(primitive)) if (!allowed.includes(key)) issues.push(issue('UNKNOWN_FIELD', `/primitive/${key}`, 'Field is not allowed for this primitive'));
      const requiredByKind: Record<string, readonly string[]> = { move: ['objectId', 'destination'], draw: ['count'], reorder: ['zone', 'order'], tap: ['objectId', 'tapped'], counter: ['objectId', 'counterKind', 'delta'], mana: ['color', 'delta'], life: ['field', 'delta'], 'token-create': ['tokenSeed', 'definitionId', 'definition'], 'token-remove': ['objectId'], controller: ['objectId', 'gainingControllerPlayerId'], attach: ['objectId', 'targetObjectId'], damage: ['objectId', 'amount'], 'note-set': ['noteId', 'text'], 'note-clear': ['noteId'], 'stack-entry': ['entryId', 'label'], 'manual-resolve': [], 'priority-hold': ['held'], 'priority-advance': [], 'priority-resolve': [], 'play-land': ['objectId'], 'cast-spell': ['objectId'] };
      for (const key of requiredByKind[kind] ?? []) if (!Object.prototype.hasOwnProperty.call(primitive, key)) issues.push(issue('MISSING_FIELD', `/primitive/${key}`, 'Required primitive field is missing'));
      if (kind === 'move' && primitive.destination !== undefined) {
        try {
          const destination = validateCoreCardZoneDestinationV1(primitive.destination);
          if (!destination.ok) issues.push(issue('INVALID_DESTINATION', '/primitive/destination', 'Invalid card destination'));
          else if (destination.value.kind === 'owner-library' && destination.value.placement.kind === 'index') {
            issues.push(issue('INVALID_DESTINATION', '/primitive/destination/placement', 'Indexed library placement is not available to manual operations'));
          }
        } catch { issues.push(issue('INVALID_DESCRIPTOR', '/primitive/destination', 'Destination could not be inspected safely')); }
      }
      if (kind === 'draw' && primitive.count !== undefined && (typeof primitive.count !== 'number' || !Number.isSafeInteger(primitive.count) || primitive.count < 1 || primitive.count > 100 || Object.is(primitive.count, -0))) issues.push(issue('INVALID_INTEGER', '/primitive/count', 'Draw count must be 1 through 100'));
      if (kind === 'tap' && primitive.tapped !== undefined && typeof primitive.tapped !== 'boolean') issues.push(issue('INVALID_TYPE', '/primitive/tapped', 'Tapped must be boolean'));
      if (kind === 'priority-hold' && primitive.held !== undefined && typeof primitive.held !== 'boolean') issues.push(issue('INVALID_TYPE', '/primitive/held', 'HOLD state must be boolean'));
      if (kind === 'counter' && primitive.delta !== undefined) nonZeroInteger(primitive.delta, '/primitive/delta', issues);
      if (kind === 'counter' && (typeof primitive.counterKind !== 'string' || !SAFE_TEXT(primitive.counterKind, 80))) issues.push(issue('INVALID_STRING', '/primitive/counterKind', 'Invalid counter kind'));
      if (kind === 'mana' && primitive.delta !== undefined) nonZeroInteger(primitive.delta, '/primitive/delta', issues);
      if (kind === 'mana' && !['W', 'U', 'B', 'R', 'G', 'C'].includes(String(primitive.color))) issues.push(issue('INVALID_LITERAL', '/primitive/color', 'Invalid mana color'));
      if (kind === 'life' && primitive.delta !== undefined) nonZeroInteger(primitive.delta, '/primitive/delta', issues);
      if (kind === 'life' && !['life', 'poison', 'energy', 'experience'].includes(String(primitive.field))) issues.push(issue('INVALID_LITERAL', '/primitive/field', 'Invalid player fact'));
      if ((kind === 'damage') && primitive.amount !== undefined) nonZeroInteger(primitive.amount, '/primitive/amount', issues);
      if (kind === 'controller' && primitive.gainingControllerPlayerId !== undefined && (!isCoreBaseId(primitive.gainingControllerPlayerId) || isCoreUnsafeRecordKey(primitive.gainingControllerPlayerId))) issues.push(issue('INVALID_ID', '/primitive/gainingControllerPlayerId', 'Invalid controller player ID'));
      if (kind === 'token-create' && primitive.definition !== undefined) {
        const normalizedDefinition = boundedDefinition(primitive.definition, '/primitive/definition', issues);
        if (normalizedDefinition !== null) primitive.definition = normalizedDefinition;
      }
    }
    if (primitive.objectId !== undefined && !isCanonicalCoreObjectIdV2(primitive.objectId)) issues.push(issue('INVALID_ID', '/primitive/objectId', 'Invalid canonical object ID'));
    if (primitive.targetObjectId !== undefined && primitive.targetObjectId !== null && !isCanonicalCoreObjectIdV2(primitive.targetObjectId)) issues.push(issue('INVALID_ID', '/primitive/targetObjectId', 'Invalid canonical object ID'));
    if (primitive.sourceObjectId !== undefined && primitive.sourceObjectId !== null && !isCanonicalCoreObjectIdV2(primitive.sourceObjectId)) issues.push(issue('INVALID_ID', '/primitive/sourceObjectId', 'Invalid canonical object ID'));
    if (primitive.noteId !== undefined && (typeof primitive.noteId !== 'string' || !APPLICATION_ID.test(primitive.noteId))) issues.push(issue('INVALID_ID', '/primitive/noteId', 'Invalid note ID'));
    if (primitive.entryId !== undefined && (typeof primitive.entryId !== 'string' || !APPLICATION_ID.test(primitive.entryId))) issues.push(issue('INVALID_ID', '/primitive/entryId', 'Invalid entry ID'));
    if (typeof primitive.text !== 'undefined' && (typeof primitive.text !== 'string' || !SAFE_TEXT(primitive.text, 160))) issues.push(issue('INVALID_STRING', '/primitive/text', 'Invalid note text'));
    if (typeof primitive.label !== 'undefined' && (typeof primitive.label !== 'string' || !SAFE_TEXT(primitive.label, 160))) issues.push(issue('INVALID_STRING', '/primitive/label', 'Invalid stack label'));
    if (primitive.order !== undefined) { const order = readArray(primitive.order, '/primitive/order', issues); order?.forEach((id, i) => { if (!isCanonicalCoreObjectIdV2(id)) issues.push(issue('INVALID_ID', `/primitive/order/${i}`, 'Invalid canonical object ID')); }); }
  }
  if (issues.length > 0 || root.kind !== 'online-tabletop-intent-envelope-v1' || root.schemaVersion !== 1 || typeof root.commandId !== 'string' || typeof root.baseRevision !== 'number' || primitive === null) return Object.freeze({ ok: false as const, issues: Object.freeze(issues) });
  if (root.mode !== 'structured' && root.mode !== 'freeform') return Object.freeze({ ok: false as const, issues: Object.freeze(issues) });
  const primitiveValue = Object.freeze({ ...primitive, kind: primitive.kind as OnlineTabletopPrimitiveKindV1 }) as OnlineTabletopPrimitiveV1;
  const value: OnlineTabletopIntentEnvelopeV1 = Object.freeze({ kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, commandId: root.commandId, baseRevision: root.baseRevision, mode: root.mode, primitive: primitiveValue });
  return Object.freeze({ ok: true as const, value });
}
