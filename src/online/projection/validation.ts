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
  type OnlineParticipantProjectionV1,
  type OnlineParticipantProjectionValidationResultV1,
  type OnlineProjectedObjectRuntimeV1,
  type OnlineProjectedZoneEntryV1,
  type OnlineProjectionIssueV1,
} from './types';

const LOWER_CASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function invalid(issues: OnlineProjectionIssueV1[], code: OnlineProjectionIssueV1['code'], path: string, message: string): void {
  issues.push(projectionIssue(code, path, message));
}
function arrayValues(input: unknown, path: string, issues: OnlineProjectionIssueV1[]): readonly unknown[] {
  return readDenseArray(input, path, issues)?.values ?? [];
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
    ['indefinite', 'source-bound', 'single-use', 'manual'].includes(record.kind)
  ) {
    if (Object.keys(record).length !== 1) invalid(issues, 'UNKNOWN_FIELD', path, 'Duration has fields for another kind');
  } else invalid(issues, 'INVALID_LITERAL', `${path}/kind`, 'Invalid duration kind');
}

function definition(input: unknown, path: string, issues: OnlineProjectionIssueV1[]): void {
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
  const validText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim() && !value.includes('\0') && !value.includes('\r');
  for (const key of ['name', 'layout', 'typeLine'] as const) if (!validText(record[key])) invalid(issues, 'INVALID_TYPE', `${path}/${key}`, 'Expected canonical nonempty text');
  if (typeof record.manaValue !== 'number' || !Number.isFinite(record.manaValue) || record.manaValue < 0) invalid(issues, 'INVALID_TYPE', `${path}/manaValue`, 'Invalid mana value');
  const colors = arrayValues(record.colorIdentity, `${path}/colorIdentity`, issues);
  colors.forEach((value, index) => literal(value, ['W', 'U', 'B', 'R', 'G'], `${path}/colorIdentity/${index}`, issues));
  if (new Set(colors).size !== colors.length) invalid(issues, 'DUPLICATE_VALUE', `${path}/colorIdentity`, 'Color identity must be unique');
  validateCanonicalLiteralOrder(colors, ['W', 'U', 'B', 'R', 'G'], `${path}/colorIdentity`, 'Color identity', issues);
  const keywords = arrayValues(record.keywords, `${path}/keywords`, issues);
  keywords.forEach((value, index) => {
    if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
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
  const mana = arrayValues(record.producedMana, `${path}/producedMana`, issues);
  mana.forEach((value, index) => literal(value, ['W', 'U', 'B', 'R', 'G', 'C'], `${path}/producedMana/${index}`, issues));
  if (new Set(mana).size !== mana.length) invalid(issues, 'DUPLICATE_VALUE', `${path}/producedMana`, 'Produced mana must be unique');
  validateCanonicalLiteralOrder(mana, ['W', 'U', 'B', 'R', 'G', 'C'], `${path}/producedMana`, 'Produced mana', issues);
  const tokenKinds = ['treasure', 'clue', 'food', 'blood', 'cursed-role', 'monster-role', 'royal-role', 'sorcerer-role', 'virtuous-role', 'wicked-role', 'young-hero-role'];
  if (record.tokenKind !== null) literal(record.tokenKind, tokenKinds, `${path}/tokenKind`, issues);
  const faces = arrayValues(record.faces, `${path}/faces`, issues);
  if (faces.length === 0) invalid(issues, 'INVALID_RELATION', `${path}/faces`, 'Definition must have at least one face');
  faces.forEach((face, index) => {
    const entry = readExactRecord(face, ['name', 'manaCost', 'typeLine', 'oracleText', 'power', 'toughness', 'loyalty', 'defense'], `${path}/faces/${index}`, issues);
    if (entry === null) return;
    for (const key of ['name', 'typeLine'] as const) if (!validText(entry[key])) invalid(issues, 'INVALID_TYPE', `${path}/faces/${index}/${key}`, 'Expected canonical nonempty text');
    if (typeof entry.oracleText !== 'string' || entry.oracleText.includes('\0') || entry.oracleText.includes('\r')) invalid(issues, 'INVALID_TYPE', `${path}/faces/${index}/oracleText`, 'Expected canonical text');
    for (const key of ['manaCost', 'power', 'toughness', 'loyalty', 'defense'] as const) if (entry[key] !== null && typeof entry[key] !== 'string') invalid(issues, 'INVALID_TYPE', `${path}/faces/${index}/${key}`, 'Expected string or null');
  });
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
    const game = readExactRecord(root.game, ['turnOrder', 'turn', 'players', 'zones', 'visibilityGrants', 'searchSessions', 'playPermissions'], '/game', issues);
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
      if (order.length !== seatPlayers.length || order.some((id, index) => id !== seatPlayers[index])) invalid(issues, 'INVALID_RELATION', '/game/turnOrder', 'Turn order must match ordered seats');
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
        if (root.role !== 'player' && (effective.length !== 0 || grant.mode !== 'reveal')) invalid(issues, 'INVALID_RELATION', `/game/visibilityGrants/${index}`, 'Observer grants must be public reveal entries');
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
      for (const target of attachmentTargets) if (!handles.has(target)) invalid(issues, 'INVALID_RELATION', '/game/zones', 'Attachment target must have a public projected handle');
      for (const reference of playerRefs) if (!order.includes(reference.value)) invalid(issues, 'INVALID_RELATION', reference.path, 'Referenced player must be in turn order');
    }
    if (issues.length > 0) return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });
    return Object.freeze({ ok: true, value: deepFreezeCopy(input) as OnlineParticipantProjectionV1 });
  } catch {
    return Object.freeze({ ok: false, issues: freezeProjectionIssues([projectionIssue('INVALID_DESCRIPTOR', '', 'Projection could not be inspected safely')]) });
  }
}
