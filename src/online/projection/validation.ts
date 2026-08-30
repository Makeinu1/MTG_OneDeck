import {
  isCanonicalCoreObjectIdV2,
  isCoreBaseId,
  parseCoreObjectIdV2,
  validateCoreRuleZoneRefV1,
  type CoreObjectId,
  type CorePlayerId,
} from '../../engine/core/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import {
  compareCodeUnits,
  freezeProjectionIssues,
  deepFreezeCopy,
  descriptorSafeStructuralEqual,
  isApplicationId,
  isNonNegativeInteger,
  projectionIssue,
  readDenseArray,
  readExactRecord,
} from './support';
import {
  ONLINE_PROJECTION_SCHEMA_VERSION_V1,
  ONLINE_PARTICIPANT_PROJECTION_SCHEMA_VERSION_V2,
  type OnlineParticipantProjectionV1,
  type OnlineParticipantProjectionAssistedV2,
  type OnlineParticipantProjectionValidationResultV2,
  type OnlineParticipantProjectionValidationResultV1,
  type OnlineProjectedObjectRuntimeV1,
  type OnlineProjectedZoneEntryV1,
  type OnlineProjectionIssueV1,
} from './types';
import { ONLINE_PROJECTION_SCHEMA_VERSION_V3, ONLINE_PROJECTION_SCHEMA_VERSION_V4 } from './variable';
import type { OnlineVariableParticipantProjectionV3, OnlineVariableParticipantProjectionV4 } from './variable';

const LOWER_CASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_DEFINITION_MAX_SERIALIZED_BYTES_V1 = 8_192;
const TOKEN_DEFINITION_MAX_STRING_LENGTH_V1 = 512;
const TOKEN_DEFINITION_MAX_KEYWORDS_V1 = 16;
const TOKEN_DEFINITION_MAX_FACES_V1 = 2;
const TOKEN_DEFINITION_MAX_COLORS_V1 = 5;
const TOKEN_DEFINITION_MAX_PRODUCED_MANA_V1 = 6;

const MANUAL_NOTES_MAX_COUNT_V1 = 128;
const MANUAL_STACK_MAX_COUNT_V1 = 128;
const MANUAL_NOTES_MAX_SERIALIZED_BYTES_V1 = 24_576;
const MANUAL_STACK_MAX_SERIALIZED_BYTES_V1 = 24_576;
const MANUAL_STATE_MAX_SERIALIZED_BYTES_V1 = 32_768;

function invalid(issues: OnlineProjectionIssueV1[], code: OnlineProjectionIssueV1['code'], path: string, message: string): void {
  issues.push(projectionIssue(code, path, message));
}
function arrayValues(input: unknown, path: string, issues: OnlineProjectionIssueV1[], maxLength = Number.MAX_SAFE_INTEGER): readonly unknown[] {
  return readDenseArray(input, path, issues, maxLength)?.values ?? [];
}
function player(value: unknown, path: string, issues: OnlineProjectionIssueV1[]): value is CorePlayerId {
  if (!isCoreBaseId(value)) invalid(issues, 'INVALID_ID', path, 'Invalid Core player ID');
  return isCoreBaseId(value);
}
function objectId(value: unknown, path: string, issues: OnlineProjectionIssueV1[]): value is CoreObjectId {
  if (!isCanonicalCoreObjectIdV2(value)) invalid(issues, 'INVALID_ID', path, 'Invalid Core object ID');
  return isCanonicalCoreObjectIdV2(value);
}
function literal(value: unknown, allowed: readonly string[], path: string, issues: OnlineProjectionIssueV1[]): boolean {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    invalid(issues, 'INVALID_LITERAL', path, 'Invalid literal');
    return false;
  }
  return true;
}
function integer(value: unknown, path: string, issues: OnlineProjectionIssueV1[]): boolean {
  if (!isNonNegativeInteger(value)) {
    invalid(issues, 'INVALID_INTEGER', path, 'Expected a non-negative safe integer');
    return false;
  }
  return true;
}

function positiveInteger(value: unknown, path: string, issues: OnlineProjectionIssueV1[]): boolean {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    invalid(issues, 'INVALID_INTEGER', path, 'Expected a positive safe integer');
    return false;
  }
  return true;
}

function isCanonicalCounterKind(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false;
  let codePointCount = 0;
  for (const character of value) {
    codePointCount += 1;
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f))
    ) return false;
  }
  return codePointCount >= 1 && codePointCount <= 80;
}

function validateCanonicalLiteralOrder(
  values: readonly unknown[],
  order: readonly string[],
  path: string,
  label: string,
  issues: OnlineProjectionIssueV1[],
): void {
  let previousRank = -1;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== 'string') continue;
    const rank = order.indexOf(value);
    if (rank < 0) continue;
    if (rank < previousRank) {
      invalid(issues, 'INVALID_RELATION', `${path}/${index}`, `${label} must be in canonical order`);
    }
    previousRank = rank;
  }
}

function runtime(input: unknown, path: string, issues: OnlineProjectionIssueV1[], attachmentTargets: Set<string>, playerRefs: Array<Readonly<{ value: string; path: string }>>): OnlineProjectedObjectRuntimeV1 | null {
  if (input === null) return null;
  const issueCount = issues.length;
  const record = readExactRecord(input, ['faceIndex', 'faceDown', 'tapped', 'flipped', 'phasedOut', 'counters', 'markedDamage', 'attachment'], path, issues);
  if (record === null) return null;
  if (record.faceIndex !== null) integer(record.faceIndex, `${path}/faceIndex`, issues);
  for (const field of ['faceDown', 'tapped', 'phasedOut'] as const) if (typeof record[field] !== 'boolean') invalid(issues, 'INVALID_TYPE', `${path}/${field}`, 'Expected a boolean');
  if (record.flipped !== null && typeof record.flipped !== 'boolean') invalid(issues, 'INVALID_TYPE', `${path}/flipped`, 'Expected boolean or null');
  integer(record.markedDamage, `${path}/markedDamage`, issues);
  const counters = arrayValues(record.counters, `${path}/counters`, issues);
  const counterKinds = new Set<string>();
  let previousCounterKind: string | null = null;
  for (let index = 0; index < counters.length; index += 1) {
    const counter = readExactRecord(counters[index], ['kind', 'count'], `${path}/counters/${index}`, issues);
    if (counter === null) continue;
    const kindPath = `${path}/counters/${index}/kind`;
    if (!isCanonicalCounterKind(counter.kind)) invalid(issues, 'INVALID_TYPE', kindPath, 'Invalid counter kind');
    if (typeof counter.kind === 'string') {
      if (counterKinds.has(counter.kind)) invalid(issues, 'DUPLICATE_VALUE', kindPath, 'Duplicate counter kind');
      else counterKinds.add(counter.kind);
      if (previousCounterKind !== null && compareCodeUnits(previousCounterKind, counter.kind) > 0) {
        invalid(issues, 'INVALID_RELATION', kindPath, 'Counter kinds must be code-unit sorted');
      }
      previousCounterKind = counter.kind;
    }
    positiveInteger(counter.count, `${path}/counters/${index}/count`, issues);
  }
  const attachment = readExactRecord(record.attachment, ['kind', 'playerId', 'objectId'], `${path}/attachment`, issues, ['kind']);
  if (attachment !== null) {
    if (attachment.kind === 'none' || attachment.kind === 'concealed') {
      if (Object.keys(attachment).length !== 1) invalid(issues, 'UNKNOWN_FIELD', `${path}/attachment`, 'Attachment has fields for another kind');
    } else if (attachment.kind === 'player') {
      if (player(attachment.playerId, `${path}/attachment/playerId`, issues)) playerRefs.push({ value: attachment.playerId, path: `${path}/attachment/playerId` });
      if (Object.prototype.hasOwnProperty.call(attachment, 'objectId')) invalid(issues, 'UNKNOWN_FIELD', `${path}/attachment/objectId`, 'Field is not valid for player attachment');
    } else if (attachment.kind === 'object') {
      if (objectId(attachment.objectId, `${path}/attachment/objectId`, issues)) attachmentTargets.add(attachment.objectId);
      if (Object.prototype.hasOwnProperty.call(attachment, 'playerId')) invalid(issues, 'UNKNOWN_FIELD', `${path}/attachment/playerId`, 'Field is not valid for object attachment');
    } else invalid(issues, 'INVALID_LITERAL', `${path}/attachment/kind`, 'Invalid attachment kind');
  }
  return issues.length === issueCount
    ? deepFreezeCopy(record) as OnlineProjectedObjectRuntimeV1
    : null;
}

function zoneEntry(
  input: unknown,
  path: string,
  issues: OnlineProjectionIssueV1[],
  handles: Set<string>,
  attachmentTargets: Set<string>,
  entriesByHandle: Map<string, OnlineProjectedZoneEntryV1>,
  playerRefs: Array<Readonly<{ value: string; path: string }>>,
  zoneName: string,
): OnlineProjectedZoneEntryV1 | null {
  const issueCount = issues.length;
  const discriminator = readExactRecord(input, ['kind', 'objectId', 'objectKind', 'ownerPlayerId', 'controllerPlayerId', 'commander', 'definition', 'runtime'], path, issues, ['kind']);
  if (discriminator === null) return null;
  if (discriminator.kind === 'hidden-card') {
    if (Object.keys(discriminator).length !== 1) invalid(issues, 'UNKNOWN_FIELD', path, 'Hidden card has extra fields');
    if (zoneName !== 'library' && zoneName !== 'hand') invalid(issues, 'INVALID_RELATION', path, 'Hidden card is valid only in hand or library');
    return issues.length === issueCount ? Object.freeze({ kind: 'hidden-card' }) : null;
  }
  if (discriminator.kind !== 'concealed-object' && discriminator.kind !== 'visible-object') {
    invalid(issues, 'INVALID_LITERAL', `${path}/kind`, 'Invalid zone entry kind');
    return null;
  }
  if (!objectId(discriminator.objectId, `${path}/objectId`, issues)) return null;
  if (handles.has(discriminator.objectId)) invalid(issues, 'DUPLICATE_VALUE', `${path}/objectId`, 'Duplicate projected object handle');
  else handles.add(discriminator.objectId);
  const parsed = parseCoreObjectIdV2(discriminator.objectId);
  if (parsed === null || discriminator.objectKind !== parsed.kind) invalid(issues, 'INVALID_RELATION', `${path}/objectKind`, 'Object kind must match object ID');
  const checkedRuntime = runtime(discriminator.runtime, `${path}/runtime`, issues, attachmentTargets, playerRefs);
  if (discriminator.kind === 'concealed-object') {
    for (const key of ['ownerPlayerId', 'controllerPlayerId', 'commander', 'definition']) {
      if (Object.prototype.hasOwnProperty.call(discriminator, key)) invalid(issues, 'UNKNOWN_FIELD', `${path}/${key}`, 'Concealed object contains identity field');
    }
    if (checkedRuntime === null) invalid(issues, 'INVALID_TYPE', `${path}/runtime`, 'Concealed object requires runtime');
    else {
      if (checkedRuntime.faceIndex !== null || checkedRuntime.flipped !== null) invalid(issues, 'INVALID_RELATION', `${path}/runtime`, 'Concealed runtime must hide face state');
      if (!checkedRuntime.faceDown) invalid(issues, 'INVALID_RELATION', `${path}/runtime/faceDown`, 'Concealed runtime must be face down');
    }
    if (!['battlefield', 'stack', 'exile'].includes(zoneName)) invalid(issues, 'INVALID_RELATION', path, 'Concealed object must be in a trackable public hidden-identity zone');
  } else {
    if (discriminator.ownerPlayerId !== null && player(discriminator.ownerPlayerId, `${path}/ownerPlayerId`, issues)) playerRefs.push({ value: discriminator.ownerPlayerId, path: `${path}/ownerPlayerId` });
    if (discriminator.controllerPlayerId !== null && player(discriminator.controllerPlayerId, `${path}/controllerPlayerId`, issues)) playerRefs.push({ value: discriminator.controllerPlayerId, path: `${path}/controllerPlayerId` });
    if (typeof discriminator.commander !== 'boolean') invalid(issues, 'INVALID_TYPE', `${path}/commander`, 'Expected a boolean');
    if (discriminator.definition !== null) definition(discriminator.definition, `${path}/definition`, issues);
    if (
      (discriminator.objectKind === 'card' ||
        discriminator.objectKind === 'token' ||
        discriminator.objectKind === 'spell-copy') &&
      discriminator.definition === null
    ) invalid(issues, 'INVALID_RELATION', `${path}/definition`, 'This object kind requires a definition');
    if (
      (discriminator.objectKind === 'activated-ability' ||
        discriminator.objectKind === 'triggered-ability') &&
      discriminator.definition !== null
    ) invalid(issues, 'INVALID_RELATION', `${path}/definition`, 'Ability objects cannot expose a definition');
    if (
      (discriminator.objectKind === 'card' || discriminator.objectKind === 'token') &&
      checkedRuntime === null
    ) invalid(issues, 'INVALID_RELATION', `${path}/runtime`, 'Card and token objects require runtime');
    if (
      (discriminator.objectKind === 'spell-copy' ||
        discriminator.objectKind === 'activated-ability' ||
        discriminator.objectKind === 'triggered-ability') &&
      checkedRuntime !== null
    ) invalid(issues, 'INVALID_RELATION', `${path}/runtime`, 'Stack copy and ability objects cannot expose runtime');
  }
  if (issues.length !== issueCount) return null;
  const canonical = deepFreezeCopy(discriminator) as OnlineProjectedZoneEntryV1;
  if (!entriesByHandle.has(discriminator.objectId)) entriesByHandle.set(discriminator.objectId, canonical);
  return canonical;
}

function duration(input: unknown, path: string, issues: OnlineProjectionIssueV1[]): void {
  const record = readExactRecord(input, ['kind', 'turnNumber'], path, issues, ['kind']);
  if (record === null) return;
  if (record.kind === 'until-end-of-turn') integer(record.turnNumber, `${path}/turnNumber`, issues);
  else if (
    typeof record.kind === 'string' &&
    ['indefinite', 'source-bound', 'single-use', 'manual', 'next-command', 'end-of-turn', 'choice-bound'].includes(record.kind)
  ) {
    if (Object.keys(record).length !== 1) invalid(issues, 'UNKNOWN_FIELD', path, 'Duration has fields for another kind');
  } else invalid(issues, 'INVALID_LITERAL', `${path}/kind`, 'Invalid duration kind');
}

function definition(input: unknown, path: string, issues: OnlineProjectionIssueV1[]): void {
  const issueCount = issues.length;
  const record = readExactRecord(input, ['source', 'name', 'layout', 'manaValue', 'colorIdentity', 'typeLine', 'keywords', 'producedMana', 'tokenKind', 'faces'], path, issues);
  if (record === null) return;
  const source = readExactRecord(record.source, ['kind', 'scryfallId', 'oracleId'], `${path}/source`, issues, ['kind']);
  if (source !== null) {
    if (source.kind === 'scryfall') {
      if (typeof source.scryfallId !== 'string' || !LOWER_CASE_UUID.test(source.scryfallId)) {
        invalid(issues, 'INVALID_ID', `${path}/source/scryfallId`, 'Expected a lower-case UUID');
      }
      if (typeof source.oracleId !== 'string' || !LOWER_CASE_UUID.test(source.oracleId)) {
        invalid(issues, 'INVALID_ID', `${path}/source/oracleId`, 'Expected a lower-case UUID');
      }
    } else if (source.kind === 'engine-synthetic') {
      if (Object.keys(source).length !== 1) invalid(issues, 'UNKNOWN_FIELD', `${path}/source`, 'Synthetic source has extra fields');
    } else invalid(issues, 'INVALID_LITERAL', `${path}/source/kind`, 'Invalid definition source kind');
  }
  const synthetic = source?.kind === 'engine-synthetic';
  const maxStringLength = synthetic ? TOKEN_DEFINITION_MAX_STRING_LENGTH_V1 : Number.MAX_SAFE_INTEGER;
  const maxCollectionLength = (limit: number): number => synthetic ? limit : Number.MAX_SAFE_INTEGER;
  const validText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= maxStringLength && value === value.trim() && !value.includes('\0') && !value.includes('\r');
  const validOptionalText = (value: unknown): value is string => typeof value === 'string' && value.length <= maxStringLength && !value.includes('\0') && !value.includes('\r');
  for (const key of ['name', 'layout', 'typeLine'] as const) if (!validText(record[key])) invalid(issues, 'INVALID_TYPE', `${path}/${key}`, 'Expected canonical nonempty text');
  if (typeof record.manaValue !== 'number' || !Number.isFinite(record.manaValue) || record.manaValue < 0) invalid(issues, 'INVALID_TYPE', `${path}/manaValue`, 'Invalid mana value');
  const colors = arrayValues(record.colorIdentity, `${path}/colorIdentity`, issues, maxCollectionLength(TOKEN_DEFINITION_MAX_COLORS_V1));
  colors.forEach((value, index) => literal(value, ['W', 'U', 'B', 'R', 'G'], `${path}/colorIdentity/${index}`, issues));
  if (new Set(colors).size !== colors.length) invalid(issues, 'DUPLICATE_VALUE', `${path}/colorIdentity`, 'Color identity must be unique');
  validateCanonicalLiteralOrder(colors, ['W', 'U', 'B', 'R', 'G'], `${path}/colorIdentity`, 'Color identity', issues);
  const keywords = arrayValues(record.keywords, `${path}/keywords`, issues, maxCollectionLength(TOKEN_DEFINITION_MAX_KEYWORDS_V1));
  keywords.forEach((value, index) => {
    if (typeof value !== 'string' || value.length === 0 || value.length > TOKEN_DEFINITION_MAX_STRING_LENGTH_V1 || value.trim() !== value || value.includes('\0')) {
      invalid(issues, 'INVALID_TYPE', `${path}/keywords/${index}`, 'Expected canonical nonempty text');
    }
  });
  if (new Set(keywords).size !== keywords.length) invalid(issues, 'DUPLICATE_VALUE', `${path}/keywords`, 'Keywords must be unique');
  for (let index = 1; index < keywords.length; index += 1) {
    const previous = keywords[index - 1];
    const current = keywords[index];
    if (
      typeof previous === 'string' &&
      typeof current === 'string' &&
      compareCodeUnits(previous, current) > 0
    ) invalid(issues, 'INVALID_RELATION', `${path}/keywords/${index}`, 'Keywords must be code-unit sorted');
  }
  const mana = arrayValues(record.producedMana, `${path}/producedMana`, issues, maxCollectionLength(TOKEN_DEFINITION_MAX_PRODUCED_MANA_V1));
  mana.forEach((value, index) => literal(value, ['W', 'U', 'B', 'R', 'G', 'C'], `${path}/producedMana/${index}`, issues));
  if (new Set(mana).size !== mana.length) invalid(issues, 'DUPLICATE_VALUE', `${path}/producedMana`, 'Produced mana must be unique');
  validateCanonicalLiteralOrder(mana, ['W', 'U', 'B', 'R', 'G', 'C'], `${path}/producedMana`, 'Produced mana', issues);
  const tokenKinds = ['treasure', 'clue', 'food', 'blood', 'cursed-role', 'monster-role', 'royal-role', 'sorcerer-role', 'virtuous-role', 'wicked-role', 'young-hero-role'];
  if (record.tokenKind !== null) literal(record.tokenKind, tokenKinds, `${path}/tokenKind`, issues);
  const faces = arrayValues(record.faces, `${path}/faces`, issues, maxCollectionLength(TOKEN_DEFINITION_MAX_FACES_V1));
  if (faces.length === 0) invalid(issues, 'INVALID_RELATION', `${path}/faces`, 'Definition must have at least one face');
  const normalizedFaces: Array<Record<string, unknown>> = [];
  faces.forEach((face, index) => {
    const entry = readExactRecord(face, ['name', 'manaCost', 'typeLine', 'oracleText', 'power', 'toughness', 'loyalty', 'defense'], `${path}/faces/${index}`, issues);
    if (entry === null) return;
    for (const key of ['name', 'typeLine'] as const) if (!validText(entry[key])) invalid(issues, 'INVALID_TYPE', `${path}/faces/${index}/${key}`, 'Expected canonical nonempty text');
    if (!validOptionalText(entry.oracleText)) invalid(issues, 'INVALID_TYPE', `${path}/faces/${index}/oracleText`, 'Expected canonical text');
    for (const key of ['manaCost', 'power', 'toughness', 'loyalty', 'defense'] as const) {
      if (entry[key] !== null && !validOptionalText(entry[key])) invalid(issues, 'INVALID_TYPE', `${path}/faces/${index}/${key}`, 'Expected bounded string or null');
    }
    normalizedFaces.push({
      name: entry.name,
      manaCost: entry.manaCost,
      typeLine: entry.typeLine,
      oracleText: entry.oracleText,
      power: entry.power,
      toughness: entry.toughness,
      loyalty: entry.loyalty,
      defense: entry.defense,
    });
  });
  if (issues.length === issueCount) {
    const normalizedSource = source?.kind === 'scryfall'
      ? { kind: 'scryfall', scryfallId: source.scryfallId, oracleId: source.oracleId }
      : { kind: 'engine-synthetic' };
    const candidate = {
      source: normalizedSource,
      name: record.name,
      layout: record.layout,
      manaValue: record.manaValue,
      colorIdentity: colors,
      typeLine: record.typeLine,
      keywords,
      producedMana: mana,
      tokenKind: record.tokenKind,
      faces: normalizedFaces,
    };
    try {
      const serialized = JSON.stringify(candidate);
      if (new TextEncoder().encode(serialized).length > TOKEN_DEFINITION_MAX_SERIALIZED_BYTES_V1) {
        invalid(issues, 'INVALID_TYPE', path, 'Definition exceeds the bounded projection budget');
      }
    } catch {
      invalid(issues, 'INVALID_DESCRIPTOR', path, 'Definition could not be serialized safely');
    }
  }
}

function manaPool(input: unknown, path: string, issues: OnlineProjectionIssueV1[]): void {
  const record = readExactRecord(input, ['W', 'U', 'B', 'R', 'G', 'C'], path, issues);
  if (record !== null) for (const key of ['W', 'U', 'B', 'R', 'G', 'C']) integer(record[key], `${path}/${key}`, issues);
}

function position(input: unknown, path: string, issues: OnlineProjectionIssueV1[]): void {
  const record = readExactRecord(input, ['phase', 'step'], path, issues);
  if (record === null) return;
  const phaseSteps: Readonly<Record<string, readonly (string | null)[]>> = {
    beginning: ['untap', 'upkeep', 'draw'],
    'precombat-main': [null],
    combat: ['beginning-of-combat', 'declare-attackers', 'declare-blockers', 'combat-damage', 'end-of-combat'],
    'postcombat-main': [null],
    ending: ['end', 'cleanup'],
  };
  if (typeof record.phase !== 'string' || !(record.phase in phaseSteps)) invalid(issues, 'INVALID_LITERAL', `${path}/phase`, 'Invalid turn phase');
  else if (!phaseSteps[record.phase]?.includes(record.step as string | null)) invalid(issues, 'INVALID_RELATION', `${path}/step`, 'Turn step does not match phase');
}

function zoneRef(input: unknown, path: string, issues: OnlineProjectionIssueV1[], playerRefs?: Array<Readonly<{ value: string; path: string }>>): void {
  if (!validateCoreRuleZoneRefV1(input).ok) invalid(issues, 'INVALID_TYPE', path, 'Invalid zone reference');
  const record = readExactRecord(input, ['kind', 'playerId', 'zone'], path, [], ['kind', 'zone']);
  if (record?.kind === 'player-zone' && typeof record.playerId === 'string') playerRefs?.push({ value: record.playerId, path: `${path}/playerId` });
}

function visibilitySubject(input: unknown, path: string, issues: OnlineProjectionIssueV1[], playerRefs: Array<Readonly<{ value: string; path: string }>>): void {
  const record = readExactRecord(input, ['kind', 'objectId', 'zone', 'playerId', 'count'], path, issues, ['kind']);
  if (record === null) return;
  if (record.kind === 'object') {
    objectId(record.objectId, `${path}/objectId`, issues);
    if (Object.keys(record).some((key) => !['kind', 'objectId'].includes(key))) invalid(issues, 'UNKNOWN_FIELD', path, 'Subject has fields for another kind');
  } else if (record.kind === 'zone') {
    zoneRef(record.zone, `${path}/zone`, issues, playerRefs);
    if (Object.keys(record).some((key) => !['kind', 'zone'].includes(key))) invalid(issues, 'UNKNOWN_FIELD', path, 'Subject has fields for another kind');
  } else if (record.kind === 'top-of-library') {
    if (player(record.playerId, `${path}/playerId`, issues)) playerRefs.push({ value: record.playerId, path: `${path}/playerId` });
    if (!integer(record.count, `${path}/count`, issues) || record.count === 0) invalid(issues, 'INVALID_INTEGER', `${path}/count`, 'Count must be positive');
    if (Object.keys(record).some((key) => !['kind', 'playerId', 'count'].includes(key))) invalid(issues, 'UNKNOWN_FIELD', path, 'Subject has fields for another kind');
  } else invalid(issues, 'INVALID_LITERAL', `${path}/kind`, 'Invalid visibility subject kind');
}

function searchPortion(input: unknown, path: string, issues: OnlineProjectionIssueV1[]): void {
  const record = readExactRecord(input, ['kind', 'count'], path, issues, ['kind']);
  if (record === null) return;
  if (record.kind === 'all') { if (Object.keys(record).length !== 1) invalid(issues, 'UNKNOWN_FIELD', path, 'All portion has extra fields'); }
  else if (record.kind === 'top') { if (!integer(record.count, `${path}/count`, issues) || record.count === 0) invalid(issues, 'INVALID_INTEGER', `${path}/count`, 'Top count must be positive'); }
  else invalid(issues, 'INVALID_LITERAL', `${path}/kind`, 'Invalid search portion kind');
}

function searchCriteria(input: unknown, path: string, issues: OnlineProjectionIssueV1[]): void {
  const record = readExactRecord(input, ['kind', 'criteriaKey', 'minimum', 'maximum', 'mayFailToFind'], path, issues, ['kind', 'minimum', 'maximum']);
  if (record === null) return;
  integer(record.minimum, `${path}/minimum`, issues); integer(record.maximum, `${path}/maximum`, issues);
  if (typeof record.minimum === 'number' && typeof record.maximum === 'number' && record.maximum < record.minimum) invalid(issues, 'INVALID_RELATION', path, 'Maximum must be at least minimum');
  if (record.kind === 'quantity') {
    if (Object.keys(record).some((key) => !['kind', 'minimum', 'maximum'].includes(key))) invalid(issues, 'UNKNOWN_FIELD', path, 'Quantity criteria has extra fields');
  } else if (record.kind === 'qualified') {
    if (!isApplicationId(record.criteriaKey)) invalid(issues, 'INVALID_ID', `${path}/criteriaKey`, 'Invalid criteria key');
    if (typeof record.mayFailToFind !== 'boolean') invalid(issues, 'INVALID_TYPE', `${path}/mayFailToFind`, 'Expected a boolean');
  } else invalid(issues, 'INVALID_LITERAL', `${path}/kind`, 'Invalid search criteria kind');
}

function permissionSubject(input: unknown, path: string, issues: OnlineProjectionIssueV1[], playerRefs: Array<Readonly<{ value: string; path: string }>>): void {
  const record = readExactRecord(input, ['kind', 'objectId', 'expectedZone', 'playerId', 'topObjectId'], path, issues, ['kind']);
  if (record === null) return;
  if (record.kind === 'object') {
    objectId(record.objectId, `${path}/objectId`, issues); zoneRef(record.expectedZone, `${path}/expectedZone`, issues, playerRefs);
    if (Object.keys(record).some((key) => !['kind', 'objectId', 'expectedZone'].includes(key))) invalid(issues, 'UNKNOWN_FIELD', path, 'Permission subject has extra fields');
  } else if (record.kind === 'top-of-library') {
    if (player(record.playerId, `${path}/playerId`, issues)) playerRefs.push({ value: record.playerId, path: `${path}/playerId` });
    if (record.topObjectId !== null) objectId(record.topObjectId, `${path}/topObjectId`, issues);
    if (Object.keys(record).some((key) => !['kind', 'playerId', 'topObjectId'].includes(key))) invalid(issues, 'UNKNOWN_FIELD', path, 'Permission subject has extra fields');
  } else invalid(issues, 'INVALID_LITERAL', `${path}/kind`, 'Invalid permission subject kind');
}

function publicManualFacts(
  game: Record<string, unknown>,
  revision: unknown,
  path: string,
  issues: OnlineProjectionIssueV1[],
  order: readonly string[],
  handles: ReadonlySet<string>,
  zoneByHandle: ReadonlyMap<string, Readonly<{ readonly zone: string; readonly playerId: string | null; readonly index: number }>>,
  playerRefs: Array<Readonly<{ value: string; path: string }>>,
): void {
  const issueCount = issues.length;
  const noteIds = new Set<string>();
  const normalizedNotes: Array<Record<string, unknown>> = [];
  if (Object.prototype.hasOwnProperty.call(game, 'notes')) {
    const notes = arrayValues(game.notes, `${path}/notes`, issues, MANUAL_NOTES_MAX_COUNT_V1);
    notes.forEach((value, index) => {
      const note = readExactRecord(value, ['id', 'authorPlayerId', 'text', 'creationRevision'], `${path}/notes/${index}`, issues);
      if (note === null) return;
      if (!isApplicationId(note.id)) invalid(issues, 'INVALID_ID', `${path}/notes/${index}/id`, 'Invalid note ID');
      else if (noteIds.has(note.id)) invalid(issues, 'DUPLICATE_VALUE', `${path}/notes/${index}/id`, 'Duplicate note ID');
      else noteIds.add(note.id);
      if (player(note.authorPlayerId, `${path}/notes/${index}/authorPlayerId`, issues)) {
        playerRefs.push({ value: note.authorPlayerId, path: `${path}/notes/${index}/authorPlayerId` });
        if (!order.includes(note.authorPlayerId)) invalid(issues, 'INVALID_RELATION', `${path}/notes/${index}/authorPlayerId`, 'Note author must be seated');
      }
      if (typeof note.text !== 'string' || note.text.length < 1 || note.text.length > 160 || note.text.trim() !== note.text || [...note.text].some((character) => { const cp = character.codePointAt(0) ?? 0; return cp <= 0x1f || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f); })) invalid(issues, 'INVALID_TYPE', `${path}/notes/${index}/text`, 'Invalid note text');
      if (!positiveInteger(note.creationRevision, `${path}/notes/${index}/creationRevision`, issues) || typeof revision !== 'number' || typeof note.creationRevision !== 'number' || note.creationRevision > revision) invalid(issues, 'INVALID_RELATION', `${path}/notes/${index}/creationRevision`, 'Note creation revision must be within projection revision');
      normalizedNotes.push({ id: note.id, authorPlayerId: note.authorPlayerId, text: note.text, creationRevision: note.creationRevision });
    });
  }
  const stackIds = new Set<string>();
  const normalizedStack: Array<Record<string, unknown>> = [];
  if (Object.prototype.hasOwnProperty.call(game, 'manualStack')) {
    const entries = arrayValues(game.manualStack, `${path}/manualStack`, issues, MANUAL_STACK_MAX_COUNT_V1);
    entries.forEach((value, index) => {
      const entry = readExactRecord(value, ['id', 'label', 'provenance', 'sourceObjectId', 'authorPlayerId', 'creationRevision'], `${path}/manualStack/${index}`, issues);
      if (entry === null) return;
      if (!isApplicationId(entry.id)) invalid(issues, 'INVALID_ID', `${path}/manualStack/${index}/id`, 'Invalid stack entry ID');
      else if (stackIds.has(entry.id)) invalid(issues, 'DUPLICATE_VALUE', `${path}/manualStack/${index}/id`, 'Duplicate stack entry ID');
      else stackIds.add(entry.id);
      if (typeof entry.label !== 'string' || entry.label.length < 1 || entry.label.length > 160 || entry.label.trim() !== entry.label || [...entry.label].some((character) => { const cp = character.codePointAt(0) ?? 0; return cp <= 0x1f || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f); })) invalid(issues, 'INVALID_TYPE', `${path}/manualStack/${index}/label`, 'Invalid stack label');
      literal(entry.provenance, ['structured', 'freeform'], `${path}/manualStack/${index}/provenance`, issues);
      if (entry.sourceObjectId !== null) {
        if (objectId(entry.sourceObjectId, `${path}/manualStack/${index}/sourceObjectId`, issues) && (!handles.has(entry.sourceObjectId) || zoneByHandle.get(entry.sourceObjectId)?.zone !== 'stack')) invalid(issues, 'INVALID_RELATION', `${path}/manualStack/${index}/sourceObjectId`, 'Stack source must be a projected stack handle');
      }
      if (player(entry.authorPlayerId, `${path}/manualStack/${index}/authorPlayerId`, issues)) {
        playerRefs.push({ value: entry.authorPlayerId, path: `${path}/manualStack/${index}/authorPlayerId` });
        if (!order.includes(entry.authorPlayerId)) invalid(issues, 'INVALID_RELATION', `${path}/manualStack/${index}/authorPlayerId`, 'Stack author must be seated');
      }
      if (!positiveInteger(entry.creationRevision, `${path}/manualStack/${index}/creationRevision`, issues) || typeof revision !== 'number' || typeof entry.creationRevision !== 'number' || entry.creationRevision > revision) invalid(issues, 'INVALID_RELATION', `${path}/manualStack/${index}/creationRevision`, 'Stack creation revision must be within projection revision');
      normalizedStack.push({ id: entry.id, label: entry.label, provenance: entry.provenance, sourceObjectId: entry.sourceObjectId, authorPlayerId: entry.authorPlayerId, creationRevision: entry.creationRevision });
    });
  }
  if (Object.prototype.hasOwnProperty.call(game, 'priorityHolds')) {
    const holds = arrayValues(game.priorityHolds, `${path}/priorityHolds`, issues, 4);
    const holdIds = new Set<string>();
    holds.forEach((value, index) => {
      const hold = readExactRecord(value, ['playerId', 'setRevision'], `${path}/priorityHolds/${index}`, issues);
      if (hold === null) return;
      if (player(hold.playerId, `${path}/priorityHolds/${index}/playerId`, issues)) {
        playerRefs.push({ value: hold.playerId, path: `${path}/priorityHolds/${index}/playerId` });
        if (!order.includes(hold.playerId) || holdIds.has(hold.playerId)) invalid(issues, 'INVALID_RELATION', `${path}/priorityHolds/${index}/playerId`, 'HOLD player must be seated and unique');
        holdIds.add(hold.playerId);
      }
      if (!positiveInteger(hold.setRevision, `${path}/priorityHolds/${index}/setRevision`, issues) || typeof revision !== 'number' || typeof hold.setRevision !== 'number' || hold.setRevision > revision) invalid(issues, 'INVALID_RELATION', `${path}/priorityHolds/${index}/setRevision`, 'HOLD revision must be within projection revision');
    });
  }
  if (Object.prototype.hasOwnProperty.call(game, 'assistedPriority')) {
    const priority = readExactRecord(game.assistedPriority, ['holderPlayerId', 'stewardPlayerId', 'windowKind', 'holds', 'responseWindow', 'topStackObjectId'], `${path}/assistedPriority`, issues, ['responseWindow', 'topStackObjectId']);
    if (priority !== null) {
      if (priority.holderPlayerId !== null) player(priority.holderPlayerId, `${path}/assistedPriority/holderPlayerId`, issues);
      if (priority.stewardPlayerId !== null) player(priority.stewardPlayerId, `${path}/assistedPriority/stewardPlayerId`, issues);
      if (typeof priority.windowKind !== 'string' || priority.windowKind.length === 0) invalid(issues, 'INVALID_TYPE', `${path}/assistedPriority/windowKind`, 'Invalid priority window kind');
      if (priority.responseWindow !== undefined && priority.responseWindow !== null && (typeof priority.responseWindow !== 'string' || !['after-stack-addition', 'before-combat', 'after-attackers', 'after-blockers', 'before-end-step', 'before-passing-turn'].includes(priority.responseWindow))) invalid(issues, 'INVALID_LITERAL', `${path}/assistedPriority/responseWindow`, 'Invalid common response window');
      if (priority.topStackObjectId !== undefined && priority.topStackObjectId !== null && !isCanonicalCoreObjectIdV2(priority.topStackObjectId)) invalid(issues, 'INVALID_ID', `${path}/assistedPriority/topStackObjectId`, 'Invalid stack object ID');
      const holds = arrayValues(priority.holds, `${path}/assistedPriority/holds`, issues, 4);
      const holdIds = new Set<string>();
      holds.forEach((value, index) => {
        if (player(value, `${path}/assistedPriority/holds/${index}`, issues)) {
          if (holdIds.has(value)) invalid(issues, 'DUPLICATE_VALUE', `${path}/assistedPriority/holds/${index}`, 'Duplicate HOLD player');
          holdIds.add(value);
        }
      });
    }
  }
  if (issues.length === issueCount) {
    const serializedBytes = (value: unknown): number | null => {
      try {
        const serialized = JSON.stringify(value);
        return serialized === undefined ? null : new TextEncoder().encode(serialized).length;
      } catch {
        return null;
      }
    };
    const notesBytes = serializedBytes(normalizedNotes);
    if (notesBytes === null || notesBytes > MANUAL_NOTES_MAX_SERIALIZED_BYTES_V1) invalid(issues, 'INVALID_TYPE', `${path}/notes`, 'Manual notes exceed the bounded serialized size');
    const stackBytes = serializedBytes(normalizedStack);
    if (stackBytes === null || stackBytes > MANUAL_STACK_MAX_SERIALIZED_BYTES_V1) invalid(issues, 'INVALID_TYPE', `${path}/manualStack`, 'Manual stack exceeds the bounded serialized size');
    const aggregateBytes = serializedBytes({ notes: normalizedNotes, manualStack: normalizedStack, priorityHolds: game.priorityHolds ?? [] });
    if (aggregateBytes === null || aggregateBytes > MANUAL_STATE_MAX_SERIALIZED_BYTES_V1) invalid(issues, 'INVALID_TYPE', path, 'Manual state exceeds the bounded serialized size');
  }
}

export function validateOnlineParticipantProjectionV1(
  input: unknown,
): OnlineParticipantProjectionValidationResultV1 {
  const issues: OnlineProjectionIssueV1[] = [];
  try {
    const root = readExactRecord(input, ['kind', 'schemaVersion', 'protocolVersion', 'roomId', 'participantId', 'role', 'corePlayerId', 'revision', 'room', 'game'], '', issues);
    if (root === null) return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });
    if (root.kind !== 'online-participant-projection-v1') invalid(issues, 'INVALID_LITERAL', '/kind', 'Invalid projection kind');
    if (root.schemaVersion !== ONLINE_PROJECTION_SCHEMA_VERSION_V1) invalid(issues, 'INVALID_VERSION', '/schemaVersion', 'Invalid projection schema version');
    if (root.protocolVersion !== CURRENT_CONTRACT_VERSIONS.protocolVersion) invalid(issues, 'PROTOCOL_VERSION_MISMATCH', '/protocolVersion', 'Protocol version is not supported');
    if (!isApplicationId(root.roomId)) invalid(issues, 'INVALID_ID', '/roomId', 'Invalid room ID');
    if (!isApplicationId(root.participantId)) invalid(issues, 'INVALID_ID', '/participantId', 'Invalid participant ID');
    literal(root.role, ['player', 'table', 'spectator'], '/role', issues);
    if (root.role === 'player') player(root.corePlayerId, '/corePlayerId', issues);
    else if (root.corePlayerId !== null) invalid(issues, 'INVALID_RELATION', '/corePlayerId', 'Observer role must have null Core player ID');
    integer(root.revision, '/revision', issues);
    const room = readExactRecord(root.room, ['lifecycle', 'hostParticipantId', 'participants', 'seats'], '/room', issues);
    const participantIds: string[] = [];
    const participantRoles = new Map<string, string>();
    const participantSeats = new Map<string, number | null>();
    const seatPlayers: string[] = [];
    if (room !== null) {
      literal(room.lifecycle, ['forming', 'ready', 'started', 'active', 'finished'], '/room/lifecycle', issues);
      if (!isApplicationId(room.hostParticipantId)) invalid(issues, 'INVALID_ID', '/room/hostParticipantId', 'Invalid host participant ID');
      const participants = arrayValues(room.participants, '/room/participants', issues);
      for (let index = 0; index < participants.length; index += 1) {
        const entry = readExactRecord(participants[index], ['participantId', 'role', 'presence', 'seatIndex'], `/room/participants/${index}`, issues);
        if (entry === null) continue;
        if (!isApplicationId(entry.participantId)) invalid(issues, 'INVALID_ID', `/room/participants/${index}/participantId`, 'Invalid participant ID');
        else if (participantIds.includes(entry.participantId)) invalid(issues, 'DUPLICATE_VALUE', `/room/participants/${index}/participantId`, 'Duplicate participant ID');
        else participantIds.push(entry.participantId);
        if (typeof entry.participantId === 'string' && typeof entry.role === 'string') participantRoles.set(entry.participantId, entry.role);
        literal(entry.role, ['player', 'table', 'spectator'], `/room/participants/${index}/role`, issues);
        literal(entry.presence, ['connected', 'disconnected'], `/room/participants/${index}/presence`, issues);
        if (entry.role === 'player') {
          if (![0, 1, 2, 3].includes(entry.seatIndex as number)) invalid(issues, 'INVALID_INTEGER', `/room/participants/${index}/seatIndex`, 'Invalid seat index');
          else if (typeof entry.participantId === 'string') participantSeats.set(entry.participantId, entry.seatIndex as number);
        } else if (entry.seatIndex !== null) invalid(issues, 'INVALID_RELATION', `/room/participants/${index}/seatIndex`, 'Observer seat must be null');
        else if (typeof entry.participantId === 'string') participantSeats.set(entry.participantId, null);
      }
      const seats = arrayValues(room.seats, '/room/seats', issues);
      if (seats.length !== 4) invalid(issues, 'INVALID_RELATION', '/room/seats', 'Room must contain exactly four seats');
      for (let index = 0; index < seats.length; index += 1) {
        const seat = readExactRecord(seats[index], ['seatIndex', 'corePlayerId', 'participantId', 'ready', 'outcome'], `/room/seats/${index}`, issues);
        if (seat === null) continue;
        if (seat.seatIndex !== index || ![0, 1, 2, 3].includes(index)) invalid(issues, 'INVALID_RELATION', `/room/seats/${index}/seatIndex`, 'Seats must be ordered');
        if (player(seat.corePlayerId, `/room/seats/${index}/corePlayerId`, issues)) {
          if (seatPlayers.includes(seat.corePlayerId)) invalid(issues, 'DUPLICATE_VALUE', `/room/seats/${index}/corePlayerId`, 'Duplicate seat player');
          else seatPlayers.push(seat.corePlayerId);
        }
        if (seat.participantId !== null && !isApplicationId(seat.participantId)) invalid(issues, 'INVALID_ID', `/room/seats/${index}/participantId`, 'Invalid seat participant ID');
        else if (typeof seat.participantId === 'string' && (participantRoles.get(seat.participantId) !== 'player' || participantSeats.get(seat.participantId) !== index)) invalid(issues, 'INVALID_RELATION', `/room/seats/${index}/participantId`, 'Seat participant relation is invalid');
        if (typeof seat.ready !== 'boolean') invalid(issues, 'INVALID_TYPE', `/room/seats/${index}/ready`, 'Expected a boolean');
        literal(seat.outcome, ['pending', 'conceded', 'defeated'], `/room/seats/${index}/outcome`, issues);
      }
      for (const [participantId, role] of participantRoles) {
        if (role !== 'player') continue;
        const seatIndex = participantSeats.get(participantId);
        const seat = typeof seatIndex === 'number' ? seats[seatIndex] : null;
        const seatRecord = seat === null || seat === undefined ? null : readExactRecord(seat, ['seatIndex', 'corePlayerId', 'participantId', 'ready', 'outcome'], '/room/seats', []);
        if (seatRecord?.participantId !== participantId) invalid(issues, 'INVALID_RELATION', '/room/participants', 'Every player participant must occupy its declared seat');
      }
      if (typeof room.hostParticipantId === 'string' && !participantIds.includes(room.hostParticipantId)) invalid(issues, 'INVALID_RELATION', '/room/hostParticipantId', 'Host must be a participant');
      if (typeof root.participantId === 'string' && !participantIds.includes(root.participantId)) invalid(issues, 'INVALID_RELATION', '/participantId', 'Audience participant must appear in Room');
      if (typeof root.participantId === 'string' && participantRoles.get(root.participantId) !== root.role) invalid(issues, 'INVALID_RELATION', '/role', 'Audience role must match Room participant');
      if (root.role === 'player') {
        const seatIndex = typeof root.participantId === 'string'
          ? participantSeats.get(root.participantId)
          : undefined;
        if (typeof seatIndex !== 'number' || seatPlayers[seatIndex] !== root.corePlayerId) invalid(issues, 'INVALID_RELATION', '/corePlayerId', 'Audience Core player must match its seat');
      }
    }
    const game = readExactRecord(root.game, ['turnOrder', 'turn', 'players', 'zones', 'visibilityGrants', 'searchSessions', 'searchResults', 'playPermissions', 'notes', 'manualStack', 'priorityHolds', 'assistedPriority'], '/game', issues, ['turnOrder', 'turn', 'players', 'zones', 'visibilityGrants', 'searchSessions', 'playPermissions']);
    if (root.schemaVersion === ONLINE_PROJECTION_SCHEMA_VERSION_V1 && game !== null) {
      if (Object.prototype.hasOwnProperty.call(game, 'priorityHolds')) invalid(issues, 'INVALID_VERSION', '/game/priorityHolds', 'Priority HOLD fields require projection schema version 2');
      if (Object.prototype.hasOwnProperty.call(game, 'assistedPriority')) invalid(issues, 'INVALID_VERSION', '/game/assistedPriority', 'Assisted priority fields require projection schema version 2');
    }
    const handles = new Set<string>();
    const attachmentTargets = new Set<string>();
    const entriesByHandle = new Map<string, OnlineProjectedZoneEntryV1>();
    const playerRefs: Array<Readonly<{ value: string; path: string }>> = [];
    const zoneByHandle = new Map<string, Readonly<{ zone: string; playerId: string | null; index: number }>>();
    if (game !== null) {
      const turnOrder = arrayValues(game.turnOrder, '/game/turnOrder', issues);
      const order: string[] = [];
      for (let index = 0; index < turnOrder.length; index += 1) if (player(turnOrder[index], `/game/turnOrder/${index}`, issues)) {
        const playerId = turnOrder[index] as CorePlayerId;
        if (order.includes(playerId)) invalid(issues, 'DUPLICATE_VALUE', `/game/turnOrder/${index}`, 'Duplicate turn-order player'); else order.push(playerId);
      }
      if (order.length !== seatPlayers.length || new Set(order).size !== seatPlayers.length || seatPlayers.some((id) => !order.includes(id))) invalid(issues, 'INVALID_RELATION', '/game/turnOrder', 'Turn order must be an exact seated-player permutation');
      const turn = readExactRecord(game.turn, ['activePlayerId', 'turnNumber', 'positionSequence', 'position'], '/game/turn', issues);
      if (turn !== null) {
        player(turn.activePlayerId, '/game/turn/activePlayerId', issues);
        integer(turn.turnNumber, '/game/turn/turnNumber', issues); integer(turn.positionSequence, '/game/turn/positionSequence', issues);
        position(turn.position, '/game/turn/position', issues);
        if (typeof turn.activePlayerId === 'string' && !order.includes(turn.activePlayerId)) invalid(issues, 'INVALID_RELATION', '/game/turn/activePlayerId', 'Active player must be in turn order');
      }
      const players = arrayValues(game.players, '/game/players', issues);
      if (players.length !== order.length) invalid(issues, 'INVALID_RELATION', '/game/players', 'Player coverage must match turn order');
      for (let index = 0; index < players.length; index += 1) {
        const p = readExactRecord(players[index], ['playerId', 'life', 'poison', 'energy', 'experience', 'manaPool', 'mulliganCount', 'landsPlayedThisTurn', 'spellsCastThisTurn', 'drawnThisTurn', 'maximumHandSizeOverride', 'status', 'exitCause'], `/game/players/${index}`, issues);
        if (p !== null) {
          if (p.playerId !== order[index]) invalid(issues, 'INVALID_RELATION', `/game/players/${index}/playerId`, 'Players must follow turn order');
          if (typeof p.life !== 'number' || !Number.isSafeInteger(p.life)) invalid(issues, 'INVALID_INTEGER', `/game/players/${index}/life`, 'Life must be a safe integer');
          for (const key of ['poison', 'energy', 'experience', 'mulliganCount', 'landsPlayedThisTurn', 'spellsCastThisTurn', 'drawnThisTurn'] as const) integer(p[key], `/game/players/${index}/${key}`, issues);
          manaPool(p.manaPool, `/game/players/${index}/manaPool`, issues);
          if (p.maximumHandSizeOverride !== null && p.maximumHandSizeOverride !== 'none' && !isNonNegativeInteger(p.maximumHandSizeOverride)) invalid(issues, 'INVALID_TYPE', `/game/players/${index}/maximumHandSizeOverride`, 'Invalid maximum hand size override');
          literal(p.status, ['active', 'exited'], `/game/players/${index}/status`, issues);
          if (p.status === 'active' && p.exitCause !== null) invalid(issues, 'INVALID_RELATION', `/game/players/${index}/exitCause`, 'Active player must have null exit cause');
          if (p.status === 'exited') literal(p.exitCause, ['concession', 'defeat'], `/game/players/${index}/exitCause`, issues);
        }
      }
      const zones = readExactRecord(game.zones, ['byPlayer', 'battlefield', 'stack', 'exile', 'command'], '/game/zones', issues);
      const validateZone = (value: unknown, at: string, zoneName: string, zonePlayer: string | null): void => {
        const z = readExactRecord(value, ['count', 'entries'], at, issues);
        if (z === null) return;
        const entries = arrayValues(z.entries, `${at}/entries`, issues);
        if (z.count !== entries.length) invalid(issues, 'INVALID_RELATION', `${at}/count`, 'Zone count must equal entry count');
        entries.forEach((entry, index) => {
          const parsed = zoneEntry(entry, `${at}/entries/${index}`, issues, handles, attachmentTargets, entriesByHandle, playerRefs, zoneName);
          if (parsed !== null && parsed.kind !== 'hidden-card') zoneByHandle.set(parsed.objectId, Object.freeze({ zone: zoneName, playerId: zonePlayer, index }));
        });
      };
      if (zones !== null) {
        const byPlayer = arrayValues(zones.byPlayer, '/game/zones/byPlayer', issues);
        if (byPlayer.length !== order.length) invalid(issues, 'INVALID_RELATION', '/game/zones/byPlayer', 'Zone group coverage must match turn order');
        byPlayer.forEach((value, index) => {
          const group = readExactRecord(value, ['playerId', 'zones'], `/game/zones/byPlayer/${index}`, issues);
          if (group === null) return;
          if (group.playerId !== order[index]) invalid(issues, 'INVALID_RELATION', `/game/zones/byPlayer/${index}/playerId`, 'Zone groups must follow turn order');
          const grouped = readExactRecord(group.zones, ['library', 'hand', 'graveyard'], `/game/zones/byPlayer/${index}/zones`, issues);
          if (grouped !== null) {
            const zonePlayerId = typeof group.playerId === 'string' ? group.playerId : null;
            for (const key of ['library', 'hand', 'graveyard']) {
              validateZone(grouped[key], `/game/zones/byPlayer/${index}/zones/${key}`, key, zonePlayerId);
            }
          }
        });
        for (const key of ['battlefield', 'stack', 'exile', 'command']) validateZone(zones[key], `/game/zones/${key}`, key, null);
      }
      const grants = arrayValues(game.visibilityGrants, '/game/visibilityGrants', issues);
      grants.forEach((value, index) => {
        const grant = readExactRecord(value, ['effectiveForPlayerIds', 'mode', 'subject', 'duration'], `/game/visibilityGrants/${index}`, issues);
        if (grant === null) return;
        const effective = arrayValues(grant.effectiveForPlayerIds, `/game/visibilityGrants/${index}/effectiveForPlayerIds`, issues);
        const effectiveSeen = new Set<string>();
        effective.forEach((id, n) => { if (player(id, `/game/visibilityGrants/${index}/effectiveForPlayerIds/${n}`, issues)) { if (effectiveSeen.has(id)) invalid(issues, 'DUPLICATE_VALUE', `/game/visibilityGrants/${index}/effectiveForPlayerIds/${n}`, 'Duplicate effective player'); effectiveSeen.add(id); playerRefs.push({ value: id, path: `/game/visibilityGrants/${index}/effectiveForPlayerIds/${n}` }); } });
        if (root.role === 'player' && effective.length === 0) invalid(issues, 'INVALID_RELATION', `/game/visibilityGrants/${index}/effectiveForPlayerIds`, 'Player grant must apply to at least one viewer');
        for (let n = 1; n < effective.length; n += 1) {
          const previous = effective[n - 1];
          const current = effective[n];
          if (
            typeof previous === 'string' &&
            typeof current === 'string' &&
            order.indexOf(previous) >= order.indexOf(current)
          ) invalid(issues, 'INVALID_RELATION', `/game/visibilityGrants/${index}/effectiveForPlayerIds/${n}`, 'Effective players must follow turn order');
        }
        literal(grant.mode, ['look', 'reveal'], `/game/visibilityGrants/${index}/mode`, issues);
        visibilitySubject(grant.subject, `/game/visibilityGrants/${index}/subject`, issues, playerRefs);
        const grantSubject = readExactRecord(grant.subject, ['kind', 'objectId', 'zone', 'playerId', 'count'], `/game/visibilityGrants/${index}/subject`, [], ['kind']);
        if (grantSubject?.kind === 'object' && typeof grantSubject.objectId === 'string' && !handles.has(grantSubject.objectId)) invalid(issues, 'INVALID_RELATION', `/game/visibilityGrants/${index}/subject/objectId`, 'Visibility object subject must have a projected handle');
        duration(grant.duration, `/game/visibilityGrants/${index}/duration`, issues);
        if (root.role !== 'player') invalid(issues, 'INVALID_RELATION', `/game/visibilityGrants/${index}`, 'Observer projections must not contain visibility grant entries');
      });
      const sessions = arrayValues(game.searchSessions, '/game/searchSessions', issues);
      if (root.role !== 'player' && sessions.length !== 0) invalid(issues, 'INVALID_RELATION', '/game/searchSessions', 'Observer search sessions must be empty');
      const sessionIds = new Set<string>();
      sessions.forEach((value, index) => {
        const session = readExactRecord(value, ['sessionId', 'rulesActorPlayerId', 'selectorPlayerId', 'zone', 'portion', 'criteria', 'revealFound', 'shuffleAfter', 'candidates'], `/game/searchSessions/${index}`, issues);
        if (session === null) return;
        if (!isApplicationId(session.sessionId)) invalid(issues, 'INVALID_ID', `/game/searchSessions/${index}/sessionId`, 'Invalid session ID');
        else if (sessionIds.has(session.sessionId)) invalid(issues, 'DUPLICATE_VALUE', `/game/searchSessions/${index}/sessionId`, 'Duplicate session ID'); else sessionIds.add(session.sessionId);
        if (player(session.rulesActorPlayerId, `/game/searchSessions/${index}/rulesActorPlayerId`, issues)) playerRefs.push({ value: session.rulesActorPlayerId, path: `/game/searchSessions/${index}/rulesActorPlayerId` });
        if (player(session.selectorPlayerId, `/game/searchSessions/${index}/selectorPlayerId`, issues)) playerRefs.push({ value: session.selectorPlayerId, path: `/game/searchSessions/${index}/selectorPlayerId` });
        zoneRef(session.zone, `/game/searchSessions/${index}/zone`, issues, playerRefs);
        searchPortion(session.portion, `/game/searchSessions/${index}/portion`, issues);
        searchCriteria(session.criteria, `/game/searchSessions/${index}/criteria`, issues);
        if (typeof session.revealFound !== 'boolean') invalid(issues, 'INVALID_TYPE', `/game/searchSessions/${index}/revealFound`, 'Expected a boolean');
        if (typeof session.shuffleAfter !== 'boolean') invalid(issues, 'INVALID_TYPE', `/game/searchSessions/${index}/shuffleAfter`, 'Expected a boolean');
        const candidateIds = new Set<string>();
        arrayValues(session.candidates, `/game/searchSessions/${index}/candidates`, issues).forEach((candidate, n) => {
          const localHandles = new Set<string>();
          const parsed = zoneEntry(candidate, `/game/searchSessions/${index}/candidates/${n}`, issues, localHandles, new Set(), new Map(), playerRefs, 'search-candidate');
          if (parsed?.kind !== 'visible-object') invalid(issues, 'INVALID_RELATION', `/game/searchSessions/${index}/candidates/${n}`, 'Search candidate must be visible');
          else if (!handles.has(parsed.objectId)) invalid(issues, 'INVALID_RELATION', `/game/searchSessions/${index}/candidates/${n}/objectId`, 'Search candidate must have projected zone coverage');
          else {
            if (candidateIds.has(parsed.objectId)) invalid(issues, 'DUPLICATE_VALUE', `/game/searchSessions/${index}/candidates/${n}/objectId`, 'Duplicate search candidate');
            candidateIds.add(parsed.objectId);
            if (!descriptorSafeStructuralEqual(entriesByHandle.get(parsed.objectId), parsed)) invalid(issues, 'INVALID_RELATION', `/game/searchSessions/${index}/candidates/${n}`, 'Search candidate must match its projected zone object');
          }
        });
      });
      const searchResults = game.searchResults === undefined ? [] : arrayValues(game.searchResults, '/game/searchResults', issues);
      const resultSessionIds = new Set<string>();
      searchResults.forEach((value, index) => {
        const result = readExactRecord(value, ['sessionId', 'selectedCount', 'revealFound', 'selectedObjectIds'], `/game/searchResults/${index}`, issues, ['sessionId', 'selectedCount', 'revealFound']);
        if (result === null) return;
        if (!isApplicationId(result.sessionId)) invalid(issues, 'INVALID_ID', `/game/searchResults/${index}/sessionId`, 'Invalid search result session ID');
        else if (resultSessionIds.has(result.sessionId)) invalid(issues, 'DUPLICATE_VALUE', `/game/searchResults/${index}/sessionId`, 'Duplicate search result session ID');
        else resultSessionIds.add(result.sessionId);
        if (typeof result.selectedCount !== 'number' || !Number.isSafeInteger(result.selectedCount) || result.selectedCount < 0) invalid(issues, 'INVALID_INTEGER', `/game/searchResults/${index}/selectedCount`, 'Selected count must be a non-negative safe integer');
        if (typeof result.revealFound !== 'boolean') invalid(issues, 'INVALID_TYPE', `/game/searchResults/${index}/revealFound`, 'Expected a boolean');
        if (result.revealFound !== true) {
          if (Object.prototype.hasOwnProperty.call(result, 'selectedObjectIds')) invalid(issues, 'UNKNOWN_FIELD', `/game/searchResults/${index}/selectedObjectIds`, 'Hidden search result cannot expose selected identities');
        } else {
          const ids = arrayValues(result.selectedObjectIds, `/game/searchResults/${index}/selectedObjectIds`, issues);
          if (typeof result.selectedCount === 'number' && result.selectedCount !== ids.length) invalid(issues, 'INVALID_RELATION', `/game/searchResults/${index}/selectedCount`, 'Selected count must match selected identities');
          const seen = new Set<string>();
          ids.forEach((id, n) => {
            if (!objectId(id, `/game/searchResults/${index}/selectedObjectIds/${n}`, issues)) return;
            if (seen.has(id)) invalid(issues, 'DUPLICATE_VALUE', `/game/searchResults/${index}/selectedObjectIds/${n}`, 'Duplicate selected identity');
            seen.add(id);
          });
        }
      });
      const permissions = arrayValues(game.playPermissions, '/game/playPermissions', issues);
      if (root.role !== 'player' && permissions.length !== 0) invalid(issues, 'INVALID_RELATION', '/game/playPermissions', 'Observer permissions must be empty');
      const permissionIds = new Set<string>();
      permissions.forEach((value, index) => {
        const permission = readExactRecord(value, ['permissionId', 'allowedPlayerId', 'action', 'subject', 'duration'], `/game/playPermissions/${index}`, issues);
        if (permission === null) return;
        if (!isApplicationId(permission.permissionId)) invalid(issues, 'INVALID_ID', `/game/playPermissions/${index}/permissionId`, 'Invalid permission ID');
        else if (permissionIds.has(permission.permissionId)) invalid(issues, 'DUPLICATE_VALUE', `/game/playPermissions/${index}/permissionId`, 'Duplicate permission ID'); else permissionIds.add(permission.permissionId);
        if (player(permission.allowedPlayerId, `/game/playPermissions/${index}/allowedPlayerId`, issues)) playerRefs.push({ value: permission.allowedPlayerId, path: `/game/playPermissions/${index}/allowedPlayerId` });
        literal(permission.action, ['cast-spell', 'play-land', 'play-card'], `/game/playPermissions/${index}/action`, issues);
        permissionSubject(permission.subject, `/game/playPermissions/${index}/subject`, issues, playerRefs);
        const permissionSubjectRecord = readExactRecord(permission.subject, ['kind', 'objectId', 'expectedZone', 'playerId', 'topObjectId'], `/game/playPermissions/${index}/subject`, [], ['kind']);
        if (permissionSubjectRecord?.kind === 'object' && typeof permissionSubjectRecord.objectId === 'string' && !handles.has(permissionSubjectRecord.objectId)) invalid(issues, 'INVALID_RELATION', `/game/playPermissions/${index}/subject/objectId`, 'Permission object subject must have a projected handle');
        if (permissionSubjectRecord?.kind === 'top-of-library' && typeof permissionSubjectRecord.topObjectId === 'string' && !handles.has(permissionSubjectRecord.topObjectId)) invalid(issues, 'INVALID_RELATION', `/game/playPermissions/${index}/subject/topObjectId`, 'Visible top object must have a projected handle');
        if (permissionSubjectRecord?.kind === 'object' && typeof permissionSubjectRecord.objectId === 'string') {
          const location = zoneByHandle.get(permissionSubjectRecord.objectId);
          const expected = readExactRecord(permissionSubjectRecord.expectedZone, ['kind', 'playerId', 'zone'], '', [], ['kind', 'zone']);
          const matches = location !== undefined && expected !== null &&
            (expected.kind === 'shared-zone' ? location.playerId === null && location.zone === expected.zone : location.playerId === expected.playerId && location.zone === expected.zone);
          if (!matches) invalid(issues, 'INVALID_RELATION', `/game/playPermissions/${index}/subject/expectedZone`, 'Expected zone must cover permission object');
        }
        if (permissionSubjectRecord?.kind === 'top-of-library' && typeof permissionSubjectRecord.topObjectId === 'string') {
          const location = zoneByHandle.get(permissionSubjectRecord.topObjectId);
          if (location?.zone !== 'library' || location.playerId !== permissionSubjectRecord.playerId || location.index !== 0) invalid(issues, 'INVALID_RELATION', `/game/playPermissions/${index}/subject/topObjectId`, 'Top object must match projected library top');
        }
        duration(permission.duration, `/game/playPermissions/${index}/duration`, issues);
      });
      publicManualFacts(game, root.revision, '/game', issues, order, handles, zoneByHandle, playerRefs);
      for (const target of attachmentTargets) if (!handles.has(target)) invalid(issues, 'INVALID_RELATION', '/game/zones', 'Attachment target must have a public projected handle');
      for (const reference of playerRefs) if (!order.includes(reference.value)) invalid(issues, 'INVALID_RELATION', reference.path, 'Referenced player must be in turn order');
    }
    if (issues.length > 0) return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });
    return Object.freeze({ ok: true, value: deepFreezeCopy(input) as OnlineParticipantProjectionV1 });
  } catch {
    return Object.freeze({ ok: false, issues: freezeProjectionIssues([projectionIssue('INVALID_DESCRIPTOR', '', 'Projection could not be inspected safely')]) });
  }
}

function validateAssistedPriorityFields(
  game: Record<string, unknown>,
  revision: unknown,
  turnOrder: readonly unknown[],
  path: string,
  issues: OnlineProjectionIssueV1[],
  includeCausalContext = false,
  publicHandles: ReadonlySet<string> | null = null,
): boolean {
  let valid = true;
  const holds = game.priorityHolds;
  if (!Array.isArray(holds)) { invalid(issues, 'INVALID_TYPE', `${path}/priorityHolds`, 'Priority HOLDs must be an array'); valid = false; }
  const holdIds = new Set<string>();
  if (Array.isArray(holds)) holds.forEach((value, index) => {
    const hold = readExactRecord(value, ['playerId', 'setRevision'], `${path}/priorityHolds/${index}`, issues);
    if (hold === null) { valid = false; return; }
    if (!isCoreBaseId(hold.playerId) || !turnOrder.includes(hold.playerId) || holdIds.has(hold.playerId)) { invalid(issues, 'INVALID_RELATION', `${path}/priorityHolds/${index}/playerId`, 'HOLD player must be seated and unique'); valid = false; }
    holdIds.add(String(hold.playerId));
    if (!Number.isSafeInteger(hold.setRevision) || (hold.setRevision as number) < 1 || typeof revision !== 'number' || (hold.setRevision as number) > revision) { invalid(issues, 'INVALID_RELATION', `${path}/priorityHolds/${index}/setRevision`, 'HOLD revision is invalid'); valid = false; }
  });
  const priorityFields = includeCausalContext
    ? ['holderPlayerId', 'stewardPlayerId', 'windowKind', 'holds', 'responseWindow', 'topStackObjectId', 'sourceObjectId', 'targetObjectIds', 'targetPlayerIds', 'recentResolution', 'undoAuthorizedPlayerId']
    : ['holderPlayerId', 'stewardPlayerId', 'windowKind', 'holds', 'responseWindow', 'topStackObjectId'];
  const priority = readExactRecord(game.assistedPriority, priorityFields, `${path}/assistedPriority`, issues);
  if (priority === null) return false;
  for (const [key, field] of [['holderPlayerId', 'holderPlayerId'], ['stewardPlayerId', 'stewardPlayerId']] as const) {
    if (priority[key] !== null && (!isCoreBaseId(priority[key]) || !turnOrder.includes(priority[key]))) { invalid(issues, 'INVALID_RELATION', `${path}/assistedPriority/${field}`, 'Priority player must be seated or null'); valid = false; }
  }
  if (includeCausalContext && priority.undoAuthorizedPlayerId !== null && (!isCoreBaseId(priority.undoAuthorizedPlayerId) || !turnOrder.includes(priority.undoAuthorizedPlayerId))) {
    invalid(issues, 'INVALID_RELATION', `${path}/assistedPriority/undoAuthorizedPlayerId`, 'Undo authority must be seated or null'); valid = false;
  }
  if (typeof priority.windowKind !== 'string' || priority.windowKind.length === 0) { invalid(issues, 'INVALID_TYPE', `${path}/assistedPriority/windowKind`, 'Priority window kind is invalid'); valid = false; }
  const responseWindows = ['after-stack-addition', 'before-combat', 'after-attackers', 'after-blockers', 'before-end-step', 'before-passing-turn'];
  if (priority.responseWindow !== null && (typeof priority.responseWindow !== 'string' || !responseWindows.includes(priority.responseWindow))) { invalid(issues, 'INVALID_LITERAL', `${path}/assistedPriority/responseWindow`, 'Common response window is invalid'); valid = false; }
  if (priority.topStackObjectId !== null && !isCanonicalCoreObjectIdV2(priority.topStackObjectId)) { invalid(issues, 'INVALID_ID', `${path}/assistedPriority/topStackObjectId`, 'Stack object ID is invalid'); valid = false; }
  if (!Array.isArray(priority.holds)) { invalid(issues, 'INVALID_TYPE', `${path}/assistedPriority/holds`, 'Priority HOLD list is invalid'); valid = false; }
  else {
    const seen = new Set<string>();
    priority.holds.forEach((value, index) => {
      if (!isCoreBaseId(value) || !holdIds.has(value) || seen.has(value)) { invalid(issues, 'INVALID_RELATION', `${path}/assistedPriority/holds/${index}`, 'Assisted HOLD list must match priorityHolds'); valid = false; }
      seen.add(String(value));
    });
    if (seen.size !== holdIds.size) { invalid(issues, 'INVALID_RELATION', `${path}/assistedPriority/holds`, 'Assisted HOLD list must match priorityHolds'); valid = false; }
  }
  if (includeCausalContext) {
    if (priority.sourceObjectId !== null && (!isCanonicalCoreObjectIdV2(priority.sourceObjectId) || (publicHandles !== null && !publicHandles.has(String(priority.sourceObjectId))))) {
      invalid(issues, 'INVALID_ID', `${path}/assistedPriority/sourceObjectId`, 'Source object ID is invalid'); valid = false;
    }
    const targetObjects = arrayValues(priority.targetObjectIds, `${path}/assistedPriority/targetObjectIds`, issues, 8);
    const objectSeen = new Set<string>();
    targetObjects.forEach((value, index) => {
      if (!isCanonicalCoreObjectIdV2(value) || (publicHandles !== null && !publicHandles.has(String(value))) || objectSeen.has(String(value))) {
        invalid(issues, 'INVALID_RELATION', `${path}/assistedPriority/targetObjectIds/${index}`, 'Target object IDs must be canonical and unique'); valid = false;
      }
      objectSeen.add(String(value));
    });
    const targetPlayers = arrayValues(priority.targetPlayerIds, `${path}/assistedPriority/targetPlayerIds`, issues, 4);
    const playerSeen = new Set<string>();
    targetPlayers.forEach((value, index) => {
      if (!isCoreBaseId(value) || !turnOrder.includes(value) || playerSeen.has(String(value))) {
        invalid(issues, 'INVALID_RELATION', `${path}/assistedPriority/targetPlayerIds/${index}`, 'Target player IDs must be seated and unique'); valid = false;
      }
      playerSeen.add(String(value));
    });
    if (priority.recentResolution !== null) {
      const resolution = readExactRecord(priority.recentResolution, ['objectId', 'destination', 'acceptedRevision'], `${path}/assistedPriority/recentResolution`, issues);
      if (resolution !== null) {
        if (resolution.objectId !== null && !isCanonicalCoreObjectIdV2(resolution.objectId)) { invalid(issues, 'INVALID_ID', `${path}/assistedPriority/recentResolution/objectId`, 'Recent resolution object ID is invalid'); valid = false; }
        if (typeof resolution.destination !== 'string' || !['battlefield', 'owner-graveyard', 'cease', 'manual'].includes(resolution.destination)) { invalid(issues, 'INVALID_LITERAL', `${path}/assistedPriority/recentResolution/destination`, 'Recent resolution destination is invalid'); valid = false; }
        if (typeof resolution.acceptedRevision !== 'number' || !Number.isSafeInteger(resolution.acceptedRevision) || typeof revision !== 'number' || resolution.acceptedRevision < 1 || resolution.acceptedRevision > revision) { invalid(issues, 'INVALID_RELATION', `${path}/assistedPriority/recentResolution/acceptedRevision`, 'Recent resolution revision is invalid'); valid = false; }
      }
    }
  }
  return valid;
}

export function validateOnlineParticipantProjectionV2(
  input: unknown,
): OnlineParticipantProjectionValidationResultV2 {
  const issues: OnlineProjectionIssueV1[] = [];
  try {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return Object.freeze({ ok: false, issues: freezeProjectionIssues([projectionIssue('INVALID_ROOT', '', 'Projection root must be an object')]) });
    const root = input as Record<string, unknown>;
    if (root.kind !== 'online-participant-projection-v2') invalid(issues, 'INVALID_LITERAL', '/kind', 'Invalid projection kind');
    if (root.schemaVersion !== ONLINE_PARTICIPANT_PROJECTION_SCHEMA_VERSION_V2) invalid(issues, 'INVALID_VERSION', '/schemaVersion', 'Invalid projection schema version');
    const rawGame = root.game;
    if (rawGame === null || typeof rawGame !== 'object' || Array.isArray(rawGame)) invalid(issues, 'INVALID_TYPE', '/game', 'Invalid game projection');
    else {
      const game = rawGame as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(game, 'priorityHolds') || !Object.prototype.hasOwnProperty.call(game, 'assistedPriority')) invalid(issues, 'MISSING_FIELD', '/game', 'Projection v2 requires assisted priority fields');
      const turnOrder = Array.isArray(game.turnOrder) ? game.turnOrder : [];
      validateAssistedPriorityFields(game, game.revision ?? root.revision, turnOrder, '/game', issues);
      const legacyGame = { ...game };
      delete legacyGame.priorityHolds;
      delete legacyGame.assistedPriority;
      const legacy = validateOnlineParticipantProjectionV1({ ...root, kind: 'online-participant-projection-v1', schemaVersion: ONLINE_PROJECTION_SCHEMA_VERSION_V1, game: legacyGame });
      if (!legacy.ok) issues.push(...legacy.issues);
    }
    if (issues.length > 0) return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });
    return Object.freeze({ ok: true, value: deepFreezeCopy(input) as OnlineParticipantProjectionAssistedV2 });
  } catch {
    return Object.freeze({ ok: false, issues: freezeProjectionIssues([projectionIssue('INVALID_ROOT', '', 'Projection is invalid')]) });
  }
}

/**
 * Validator for the additive full variable projection.  The v3 envelope is
 * deliberately checked independently so the fixed four-seat v1 contract is
 * never widened.  The game payload is the already validated v1 projection
 * payload; roster/configuration relations are checked here before it reaches
 * any browser surface.
 */
function canonicalProjectionInput(input: unknown, active: WeakSet<object> = new WeakSet()): unknown {
  if (input === null || typeof input !== 'object') return input;
  const object = input;
  if (active.has(object)) throw new TypeError('Projection contains a cycle');
  active.add(object);
  try {
    if (Array.isArray(input)) {
      if (Object.getPrototypeOf(input) !== Array.prototype) throw new TypeError('Projection array prototype is not canonical');
      const lengthDescriptor = Object.getOwnPropertyDescriptor(input, 'length');
      if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) throw new TypeError('Projection array length is not canonical');
      const keys = Reflect.ownKeys(input);
      if (keys.length !== lengthDescriptor.value + 1 || !keys.includes('length')) throw new TypeError('Projection array is sparse or has surplus fields');
      const values: unknown[] = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
        if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new TypeError('Projection array entry is not a data property');
        values.push(canonicalProjectionInput(descriptor.value, active));
      }
      return values;
    }
    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Projection record prototype is not canonical');
    const keys = Reflect.ownKeys(input);
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== 'string') throw new TypeError('Projection record has a symbol field');
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new TypeError('Projection record field is not a data property');
      output[key] = canonicalProjectionInput(descriptor.value, active);
    }
    return output;
  } finally {
    active.delete(object);
  }
}
function containsPlayerReference(value: unknown, forbidden: ReadonlySet<string>): boolean {
  if (typeof value === 'string') return forbidden.has(value);
  if (Array.isArray(value)) return value.some((entry) => containsPlayerReference(entry, forbidden));
  if (value !== null && typeof value === 'object') return Object.entries(value as Record<string, unknown>).some(([key, entry]) => forbidden.has(key) || containsPlayerReference(entry, forbidden));
  return false;
}

export function validateOnlineParticipantProjectionV3(
  input: unknown,
): Readonly<{ readonly ok: true; readonly value: OnlineVariableParticipantProjectionV3 } | { readonly ok: false; readonly issues: readonly OnlineProjectionIssueV1[] }> {
  const issues: OnlineProjectionIssueV1[] = [];
  const invalid = (path: string, message: string): void => {
    issues.push(Object.freeze({ code: 'INVALID_RELATION', path, message }));
  };
  try {
    const canonical = canonicalProjectionInput(input);
    if (canonical === null || typeof canonical !== 'object' || Array.isArray(canonical)) {
      invalid('', 'Projection root must be an object');
      return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });
    }
    const root = canonical as Record<string, unknown>;
    const rootKeys = Object.keys(root).sort();
    if (rootKeys.join(',') !== ['configuration', 'corePlayerId', 'game', 'kind', 'participantId', 'protocolVersion', 'revision', 'role', 'room', 'roomId', 'schemaVersion'].sort().join(',')) {
      invalid('', 'Projection has unknown or missing fields');
    }
    if (root.kind !== 'online-participant-projection-v3') invalid('/kind', 'Invalid projection kind');
    if (root.schemaVersion !== ONLINE_PROJECTION_SCHEMA_VERSION_V3) invalid('/schemaVersion', 'Invalid projection schema version');
    if (root.protocolVersion !== CURRENT_CONTRACT_VERSIONS.protocolVersion) invalid('/protocolVersion', 'Protocol version is not supported');
    if (!isApplicationId(root.roomId)) invalid('/roomId', 'Invalid room ID');
    if (!isApplicationId(root.participantId)) invalid('/participantId', 'Invalid participant ID');
    if (!['player', 'table', 'spectator'].includes(String(root.role))) invalid('/role', 'Invalid role');
    if (root.role === 'player' && !isCoreBaseId(root.corePlayerId)) invalid('/corePlayerId', 'Player projection requires a Core player');
    if (root.role !== 'player' && root.corePlayerId !== null) invalid('/corePlayerId', 'Observer projection must have null Core player');
    if (!Number.isSafeInteger(root.revision) || (root.revision as number) < 0) invalid('/revision', 'Invalid revision');

    const config = root.configuration;
    if (config === null || typeof config !== 'object' || Array.isArray(config)) invalid('/configuration', 'Invalid configuration');
    else {
      const c = config as Record<string, unknown>;
      if (Object.keys(c).length !== 2 || (c.playerCount !== 2 && c.playerCount !== 4) || (c.startingLife !== 20 && c.startingLife !== 40) || (c.playerCount === 4 && c.startingLife !== 40)) invalid('/configuration', 'Unsupported configuration');
    }
    const playerCount = (config as Record<string, unknown> | null)?.playerCount;
    if (playerCount !== 2 && playerCount !== 4) return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });

    const room = root.room;
    if (room === null || typeof room !== 'object' || Array.isArray(room)) invalid('/room', 'Invalid room');
    else {
      const r = room as Record<string, unknown>;
      const roomKeys = Object.keys(r).sort();
      if (roomKeys.join(',') !== ['hostParticipantId', 'lifecycle', 'participants', 'seats'].sort().join(',')) invalid('/room', 'Room has unknown or missing fields');
      if (!['forming', 'ready', 'started', 'active', 'finished'].includes(String(r.lifecycle))) invalid('/room/lifecycle', 'Invalid lifecycle');
      if (!isApplicationId(r.hostParticipantId)) invalid('/room/hostParticipantId', 'Invalid host participant ID');
      if (!Array.isArray(r.participants) || r.participants.length < playerCount) invalid('/room/participants', 'Invalid participant roster');
      if (!Array.isArray(r.seats) || r.seats.length !== playerCount) invalid('/room/seats', 'Seat roster must match configuration');
      const seats: readonly unknown[] = Array.isArray(r.seats) ? r.seats as readonly unknown[] : [];
      const participantIds = new Set<string>();
      for (let index = 0; index < seats.length; index += 1) {
        const seat = seats[index];
        if (seat === null || typeof seat !== 'object' || Array.isArray(seat)) { invalid(`/room/seats/${index}`, 'Invalid seat'); continue; }
        const s = seat as Record<string, unknown>;
        const keys = Object.keys(s).sort();
        if (keys.join(',') !== ['acceptedDeck', 'corePlayerId', 'outcome', 'participantId', 'ready', 'seatIndex'].sort().join(',')) invalid(`/room/seats/${index}`, 'Seat has unknown or missing fields');
        if (s.seatIndex !== index || s.corePlayerId !== `P${index + 1}`) invalid(`/room/seats/${index}`, 'Seat order mismatch');
        if (s.participantId !== null) {
          if (!isApplicationId(s.participantId)) invalid(`/room/seats/${index}/participantId`, 'Invalid participant ID');
          else if (participantIds.has(s.participantId)) invalid(`/room/seats/${index}/participantId`, 'Duplicate participant ID');
          else participantIds.add(s.participantId);
        }
        if (typeof s.acceptedDeck !== 'boolean' || typeof s.ready !== 'boolean' || (s.ready === true && s.acceptedDeck !== true)) invalid(`/room/seats/${index}`, 'Invalid seat readiness relation');
        if (!['pending', 'conceded', 'defeated'].includes(String(s.outcome))) invalid(`/room/seats/${index}/outcome`, 'Invalid seat outcome');
      }
      const participants: readonly unknown[] = Array.isArray(r.participants) ? r.participants as readonly unknown[] : [];
      const seen = new Set<string>();
      for (let index = 0; index < participants.length; index += 1) {
        const value = participants[index];
        if (value === null || typeof value !== 'object' || Array.isArray(value)) { invalid(`/room/participants/${index}`, 'Invalid participant'); continue; }
        const p = value as Record<string, unknown>;
        if (Object.keys(p).sort().join(',') !== ['participantId', 'presence', 'role', 'seatIndex'].sort().join(',')) invalid(`/room/participants/${index}`, 'Participant has unknown or missing fields');
        if (!isApplicationId(p.participantId) || seen.has(String(p.participantId))) invalid(`/room/participants/${index}/participantId`, 'Invalid or duplicate participant ID');
        else seen.add(p.participantId);
        if (!['player', 'table', 'spectator'].includes(String(p.role)) || !['connected', 'disconnected'].includes(String(p.presence))) invalid(`/room/participants/${index}`, 'Invalid participant role/presence');
        if (p.role === 'player' && !Number.isInteger(p.seatIndex)) invalid(`/room/participants/${index}/seatIndex`, 'Player participant must have a seat');
        if (p.role !== 'player' && p.seatIndex !== null) invalid(`/room/participants/${index}/seatIndex`, 'Observer seat must be null');
      }
      if (typeof r.hostParticipantId === 'string' && !seen.has(r.hostParticipantId)) invalid('/room/hostParticipantId', 'Host must be a participant');
    }
    const game = root.game;
    if (game === null || typeof game !== 'object' || Array.isArray(game)) invalid('/game', 'Invalid game projection');
    else {
      const g = game as Record<string, unknown>;
      const required = ['playPermissions', 'players', 'searchSessions', 'turn', 'turnOrder', 'visibilityGrants', 'zones'];
      const optional = ['manualStack', 'notes', 'searchResults', 'priorityHolds', 'assistedPriority'];
      const keys = Object.keys(g);
      if (keys.some((key) => !required.includes(key) && !optional.includes(key)) || required.some((key) => !keys.includes(key))) invalid('/game', 'Game has unknown or missing fields');
      if (root.schemaVersion === ONLINE_PROJECTION_SCHEMA_VERSION_V3 && Object.prototype.hasOwnProperty.call(g, 'priorityHolds')) invalid('/game/priorityHolds', 'Priority HOLD fields require projection schema version 4');
      if (root.schemaVersion === ONLINE_PROJECTION_SCHEMA_VERSION_V3 && Object.prototype.hasOwnProperty.call(g, 'assistedPriority')) invalid('/game/assistedPriority', 'Assisted priority fields require projection schema version 4');
      if (!Array.isArray(g.turnOrder) || g.turnOrder.length !== playerCount || new Set(g.turnOrder).size !== playerCount || g.turnOrder.some((id) => typeof id !== 'string' || !/^P[1-4]$/u.test(id)) || Array.from({ length: playerCount }, (_, i) => `P${i + 1}`).some((id) => !(g.turnOrder as readonly unknown[]).includes(id))) invalid('/game/turnOrder', 'Turn order must be an exact seated-player permutation');
      if (!Array.isArray(g.players) || g.players.length !== playerCount) invalid('/game/players', 'Player coverage must match exact roster');
      if (!Array.isArray(g.visibilityGrants) || !Array.isArray(g.searchSessions) || !Array.isArray(g.playPermissions)) invalid('/game', 'Invalid game authority arrays');
      if (playerCount === 2 && containsPlayerReference(g, new Set(['P3', 'P4']))) invalid('/game', 'Two-player projection references an unavailable player');
    }
    // Reuse the hardened v1 descriptor/visibility validator on an internal
    // compatibility candidate.  v1 is fixed at four seats, so a two-seat v3
    // candidate receives inert P3/P4 records only for validation; those records
    // are never returned or exposed to callers.
    if (issues.length === 0) {
      const r = root.room as Record<string, unknown>;
      const g = root.game as Record<string, unknown>;
      const rawSeats = r.seats as readonly Record<string, unknown>[];
      const seats = rawSeats.map((seat) => ({
        seatIndex: seat.seatIndex,
        corePlayerId: seat.corePlayerId,
        participantId: seat.participantId,
        ready: seat.ready,
        outcome: seat.outcome,
      }));
      const rawPlayers = g.players as readonly Record<string, unknown>[];
      const rawByPlayer = (g.zones as Record<string, unknown>).byPlayer as readonly Record<string, unknown>[];
      const inertPlayer = (playerId: string): Record<string, unknown> => {
        const template = rawPlayers[0] ?? {};
        return {
          ...template,
          playerId,
          life: 40,
          poison: 0,
          energy: 0,
          experience: 0,
          manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
          mulliganCount: 0,
          landsPlayedThisTurn: 0,
          spellsCastThisTurn: 0,
          drawnThisTurn: 0,
          maximumHandSizeOverride: 'none',
          status: 'active',
          exitCause: null,
        };
      };
      const inertZone = (playerId: string): Record<string, unknown> => ({
        playerId,
        zones: {
          library: { count: 0, entries: [] },
          hand: { count: 0, entries: [] },
          graveyard: { count: 0, entries: [] },
        },
      });
      const paddedSeats = [...seats];
      const paddedPlayers = [...rawPlayers];
      const paddedByPlayer = [...rawByPlayer];
      const paddedTurnOrder = [...(g.turnOrder as readonly unknown[])];
      for (let index = paddedSeats.length; index < 4; index += 1) {
        const playerId = `P${index + 1}`;
        paddedSeats.push({ seatIndex: index, corePlayerId: playerId, participantId: null, ready: false, outcome: 'pending' });
        paddedPlayers.push(inertPlayer(playerId));
        paddedByPlayer.push(inertZone(playerId));
        paddedTurnOrder.push(playerId);
      }
      const candidate = {
        kind: 'online-participant-projection-v1',
        schemaVersion: 1,
        protocolVersion: root.protocolVersion,
        roomId: root.roomId,
        participantId: root.participantId,
        role: root.role,
        corePlayerId: root.corePlayerId,
        revision: root.revision,
        room: {
          lifecycle: r.lifecycle,
          hostParticipantId: r.hostParticipantId,
          participants: r.participants,
          seats: paddedSeats,
        },
        game: {
          ...g,
          turnOrder: paddedTurnOrder,
          players: paddedPlayers,
          zones: { ...(g.zones as Record<string, unknown>), byPlayer: paddedByPlayer },
        },
      };
      const deepValidation = validateOnlineParticipantProjectionV1(candidate);
      if (!deepValidation.ok) {
        invalid('/game', 'Full projection payload failed the v1 safety validator');
      }
    }
    if (issues.length > 0) return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });
    return Object.freeze({ ok: true, value: deepFreezeCopy(canonical) as OnlineVariableParticipantProjectionV3 });
  } catch {
    invalid('', 'Invalid projection');
    return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });
  }
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateV4ConcealedControllers(
  game: Record<string, unknown>,
  turnOrder: readonly unknown[],
  issues: OnlineProjectionIssueV1[],
): void {
  const zones = game.zones;
  if (!isRecordValue(zones)) return;
  const inspectZone = (zone: unknown, path: string, battlefield: boolean): void => {
    if (!isRecordValue(zone) || !Array.isArray(zone.entries)) return;
    zone.entries.forEach((entry, index) => {
      if (!isRecordValue(entry) || entry.kind !== 'concealed-object') return;
      const fieldPath = `${path}/entries/${index}/controllerPlayerId`;
      const hasController = Object.prototype.hasOwnProperty.call(entry, 'controllerPlayerId');
      if (!battlefield) {
        if (hasController) invalid(issues, 'UNKNOWN_FIELD', fieldPath, 'Concealed controller is valid only on battlefield entries');
        return;
      }
      if (!hasController) {
        invalid(issues, 'MISSING_FIELD', fieldPath, 'Concealed battlefield object requires a controller seat');
      } else if (entry.controllerPlayerId !== null && (!isCoreBaseId(entry.controllerPlayerId) || !turnOrder.includes(entry.controllerPlayerId))) {
        invalid(issues, 'INVALID_RELATION', fieldPath, 'Concealed controller must be seated or null');
      }
    });
  };
  inspectZone(zones.battlefield, '/game/zones/battlefield', true);
  inspectZone(zones.stack, '/game/zones/stack', false);
  inspectZone(zones.exile, '/game/zones/exile', false);
  inspectZone(zones.command, '/game/zones/command', false);
  if (Array.isArray(zones.byPlayer)) zones.byPlayer.forEach((group, groupIndex) => {
    if (!isRecordValue(group) || !isRecordValue(group.zones)) return;
    const groupZones = group.zones;
    inspectZone(groupZones.library, `/game/zones/byPlayer/${groupIndex}/zones/library`, false);
    inspectZone(groupZones.hand, `/game/zones/byPlayer/${groupIndex}/zones/hand`, false);
    inspectZone(groupZones.graveyard, `/game/zones/byPlayer/${groupIndex}/zones/graveyard`, false);
  });
}

function projectedPublicHandles(game: Record<string, unknown>): ReadonlySet<string> {
  const handles = new Set<string>();
  const zones = game.zones;
  const inspect = (zone: unknown): void => {
    if (!isRecordValue(zone) || !Array.isArray(zone.entries)) return;
    for (const entry of zone.entries) {
      if (isRecordValue(entry) && (entry.kind === 'visible-object' || entry.kind === 'concealed-object') && typeof entry.objectId === 'string') handles.add(entry.objectId);
    }
  };
  if (!isRecordValue(zones)) return handles;
  inspect(zones.battlefield); inspect(zones.stack); inspect(zones.exile); inspect(zones.command);
  if (Array.isArray(zones.byPlayer)) for (const group of zones.byPlayer) {
    if (!isRecordValue(group) || !isRecordValue(group.zones)) continue;
    inspect(group.zones.library); inspect(group.zones.hand); inspect(group.zones.graveyard);
  }
  return handles;
}

function stripV4ConcealedControllers(game: Record<string, unknown>): Record<string, unknown> {
  const zones = game.zones;
  if (!isRecordValue(zones) || !isRecordValue(zones.battlefield) || !Array.isArray(zones.battlefield.entries)) return { ...game };
  const battlefield = zones.battlefield;
  const battlefieldEntries = battlefield.entries;
  if (!Array.isArray(battlefieldEntries)) return { ...game };
  const entries = battlefieldEntries.map((entry: unknown) => {
    if (!isRecordValue(entry) || entry.kind !== 'concealed-object' || !Object.prototype.hasOwnProperty.call(entry, 'controllerPlayerId')) return entry;
    const stripped = { ...entry };
    delete stripped.controllerPlayerId;
    return stripped;
  });
  return {
    ...game,
    zones: {
      ...zones,
      battlefield: { ...battlefield, entries },
    },
  };
}

export function validateOnlineParticipantProjectionV4(
  input: unknown,
): Readonly<{ readonly ok: true; readonly value: OnlineVariableParticipantProjectionV4 } | { readonly ok: false; readonly issues: readonly OnlineProjectionIssueV1[] }> {
  const issues: OnlineProjectionIssueV1[] = [];
  try {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return Object.freeze({ ok: false, issues: freezeProjectionIssues([projectionIssue('INVALID_ROOT', '', 'Projection root must be an object')]) });
    const root = input as Record<string, unknown>;
    if (root.kind !== 'online-participant-projection-v4') invalid(issues, 'INVALID_LITERAL', '/kind', 'Invalid projection kind');
    if (root.schemaVersion !== ONLINE_PROJECTION_SCHEMA_VERSION_V4) invalid(issues, 'INVALID_VERSION', '/schemaVersion', 'Invalid projection schema version');
    const rawGame = root.game;
    if (rawGame === null || typeof rawGame !== 'object' || Array.isArray(rawGame)) invalid(issues, 'INVALID_TYPE', '/game', 'Invalid game projection');
    else {
      const game = rawGame as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(game, 'priorityHolds') || !Object.prototype.hasOwnProperty.call(game, 'assistedPriority')) invalid(issues, 'MISSING_FIELD', '/game', 'Projection v4 requires assisted priority fields');
      const turnOrder = Array.isArray(game.turnOrder) ? game.turnOrder : [];
      validateV4ConcealedControllers(game, turnOrder, issues);
      const legacyGame = stripV4ConcealedControllers(game);
      delete legacyGame.priorityHolds;
      delete legacyGame.assistedPriority;
      const legacy = validateOnlineParticipantProjectionV3({ ...root, kind: 'online-participant-projection-v3', schemaVersion: ONLINE_PROJECTION_SCHEMA_VERSION_V3, game: legacyGame });
      if (!legacy.ok) issues.push(...legacy.issues);
      validateAssistedPriorityFields(game, root.revision, turnOrder, '/game', issues, true, projectedPublicHandles(game));
    }
    if (issues.length > 0) return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });
    return Object.freeze({ ok: true, value: deepFreezeCopy(input) as OnlineVariableParticipantProjectionV4 });
  } catch {
    return Object.freeze({ ok: false, issues: freezeProjectionIssues([projectionIssue('INVALID_ROOT', '', 'Projection is invalid')]) });
  }
}

/** Validate either the legacy full projection or the additive variable one. */
export function validateOnlineParticipantProjectionAny(
  input: unknown,
): Readonly<{ readonly ok: true; readonly value: OnlineParticipantProjectionV1 } | { readonly ok: false; readonly issues: readonly OnlineProjectionIssueV1[] }> {
  const legacy = validateOnlineParticipantProjectionV1(input);
  if (legacy.ok) return legacy;
  const variable = validateOnlineParticipantProjectionV3(input);
  if (variable.ok) return Object.freeze({ ok: true, value: variable.value as unknown as OnlineParticipantProjectionV1 });
  const assistedLegacy = validateOnlineParticipantProjectionV2(input);
  if (assistedLegacy.ok) return Object.freeze({ ok: true, value: assistedLegacy.value as unknown as OnlineParticipantProjectionV1 });
  const assistedVariable = validateOnlineParticipantProjectionV4(input);
  if (assistedVariable.ok) return Object.freeze({ ok: true, value: assistedVariable.value as unknown as OnlineParticipantProjectionV1 });
  return variable;
}
