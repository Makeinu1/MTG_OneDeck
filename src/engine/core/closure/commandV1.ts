import { isCoreBaseId, isCoreUnsafeRecordKey } from '../ids';
import type { CorePhysicalCardId, CoreObjectId, CorePlayerId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import type { CoreCombatContextAttackV1, CoreCombatContextBlockV1, CoreCombatContextStepV1 } from '../combat/combatContextV1';
import type { CoreCommanderCastOriginV1 } from '../commander/commanderTaxV1';
import type { CoreCardSpellCommitInputV1 } from '../stack/transaction/cardSpellCommitV1';
import type { CoreStackRemovalInputV1 } from '../stack/transaction/stackRemovalV1';
import type { CoreDecisionContextV1 } from '../rules/decisionAuthorityV1';
import type { CoreSearchSessionInputV1 } from '../rules/searchSessionOperationsV1';
import type { CoreControlEffectV1 } from '../rules/controlEffectV1';
import type { CoreRuleKeyV1 } from '../rules/ruleKeyV1';
import { validateCoreRuleKeyV1 } from '../rules/ruleKeyV1';
import type { CoreRuleZoneRefV1 } from '../rules/ruleZoneRefV1';
import type { CoreVisibilityAudienceV1, CoreVisibilityModeV1, CoreVisibilitySubjectV1 } from '../rules/visibilityGrantV1';
import type { CoreRuleDurationV1 } from '../rules/ruleDurationV1';
import { validateCoreRuleZoneRefV1 } from '../rules/ruleZoneRefV1';
import { validateCoreCardZoneDestinationV1 } from '../transition/zoneDestination';
import type { CoreTabletopCommandPayloadV1, CoreTabletopTurnPayloadV1 } from '../tabletop/commandV1';
import type { CoreCardDefinitionSnapshotV1 } from '../cardDefinition';

export type CoreStackCommitCardSpellPayloadV1 = Readonly<{ readonly kind: 'stack-commit-card-spell'; readonly input: CoreCardSpellCommitInputV1 }>;
export type CoreStackRemoveObjectPayloadV1 = Readonly<{ readonly kind: 'stack-remove-object'; readonly input: CoreStackRemovalInputV1 }>;
export type CorePriorityPassPayloadV1 = Readonly<{ readonly kind: 'priority-pass'; readonly playerId: CorePlayerId }>;
export type CoreSearchOpenPayloadV1 = Readonly<{ readonly kind: 'search-open'; readonly sessionKey: CoreRuleKeyV1; readonly input: CoreSearchSessionInputV1 }>;
export type CoreSearchCompletePayloadV1 = Readonly<{ readonly kind: 'search-complete'; readonly sessionKey: CoreRuleKeyV1; readonly selectedObjectIds: readonly CoreObjectId[] }>;
export type CoreVisibilityOpenPayloadV1 = Readonly<{ readonly kind: 'visibility-open'; readonly grantKey: CoreRuleKeyV1; readonly grant: Readonly<{ readonly subject: CoreVisibilitySubjectV1; readonly audience: CoreVisibilityAudienceV1; readonly mode: CoreVisibilityModeV1; readonly sourceObjectId: CoreObjectId | null; readonly duration: CoreRuleDurationV1; readonly openingSequence?: number; readonly openingObjectIds?: readonly CoreObjectId[]; readonly topLibraryPrefixDigest?: string; readonly networkBound?: boolean }> }>;
export type CoreVisibilityClosePayloadV1 = Readonly<{ readonly kind: 'visibility-close'; readonly grantKey: CoreRuleKeyV1 }>;
export type CoreControlEffectApplyPayloadV1 = Readonly<{ readonly kind: 'control-effect-apply'; readonly effectKey: CoreRuleKeyV1; readonly effect: CoreControlEffectV1 }>;
export type CoreCommanderCastRecordPayloadV1 = Readonly<{ readonly kind: 'commander-cast-record'; readonly physicalCardId: CorePhysicalCardId; readonly origin: CoreCommanderCastOriginV1; readonly accepted: boolean }>;
export type CoreCommanderDamageRecordPayloadV1 = Readonly<{ readonly kind: 'commander-damage-record'; readonly physicalCardId: CorePhysicalCardId; readonly defendingPlayerId: CorePlayerId; readonly damage: number; readonly combatObjectId: CoreObjectId }>;
export type CoreCombatStepSetPayloadV1 = Readonly<{ readonly kind: 'combat-step-set'; readonly step: CoreCombatContextStepV1 }>;
export type CoreCombatAttackAddPayloadV1 = Readonly<{ readonly kind: 'combat-attack-add'; readonly attack: CoreCombatContextAttackV1 }>;
export type CoreCombatBlockAddPayloadV1 = Readonly<{ readonly kind: 'combat-block-add'; readonly block: CoreCombatContextBlockV1 }>;
export type CorePlayerExitPayloadV1 = Readonly<{ readonly kind: 'player-exit'; readonly playerId: CorePlayerId; readonly cause: 'concession' | 'defeat' }>;
export type CoreRandomZoneOrderPayloadV1 = Readonly<{ readonly kind: 'random-zone-order'; readonly randomDecisionId: CoreRuleKeyV1; readonly zone: CoreRuleZoneRefV1; readonly beforeOrder: readonly CoreObjectId[]; readonly afterOrder: readonly CoreObjectId[]; readonly manualMode?: unknown }>;
export type CoreCorrectPlayerLifePayloadV1 = Readonly<{ readonly kind: 'correct-player-life'; readonly playerId: CorePlayerId; readonly replacementLifeTotal: number; readonly expectedBeforeStateDigest: string; readonly reason: string }>;
export type CoreCorrectCommanderDamagePayloadV1 = Readonly<{ readonly kind: 'correct-commander-damage'; readonly physicalCardId: CorePhysicalCardId; readonly defendingPlayerId: CorePlayerId; readonly replacementDamageTotal: number; readonly expectedBeforeStateDigest: string; readonly reason: string }>;

export type CoreCommandPayloadV1 =
  | CoreStackCommitCardSpellPayloadV1 | CoreStackRemoveObjectPayloadV1 | CorePriorityPassPayloadV1
  | CoreSearchOpenPayloadV1 | CoreSearchCompletePayloadV1 | CoreControlEffectApplyPayloadV1
  | CoreVisibilityOpenPayloadV1 | CoreVisibilityClosePayloadV1
  | CoreCommanderCastRecordPayloadV1 | CoreCommanderDamageRecordPayloadV1 | CoreCombatStepSetPayloadV1
  | CoreCombatAttackAddPayloadV1 | CoreCombatBlockAddPayloadV1 | CorePlayerExitPayloadV1
  | CoreRandomZoneOrderPayloadV1 | CoreCorrectPlayerLifePayloadV1 | CoreCorrectCommanderDamagePayloadV1
  | CoreTabletopCommandPayloadV1;

export type { CoreTabletopCommandPayloadV1 } from '../tabletop/commandV1';

export type CoreCommandV1 = Readonly<{
  readonly kind: 'mode-neutral-core-command-v1';
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly actorPlayerId: CorePlayerId;
  readonly decisionMakerPlayerId: CorePlayerId;
  readonly decisionContext: CoreDecisionContextV1;
  readonly payload: CoreCommandPayloadV1;
}>;

export type CoreCommandValidationIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;
export type CoreCommandValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: CoreCommandV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly CoreCommandValidationIssueV1[] }>;

const MAX_CORE_COMMAND_ARRAY_LENGTH_V1 = 10_000;
// A tabletop token definition is copied into the public projection.  Keep its
// shape deliberately small so a single accepted command cannot overflow the
// browser's 65,536-byte frame budget.
const TOKEN_DEFINITION_MAX_SERIALIZED_BYTES_V1 = 8_192;
const TOKEN_DEFINITION_MAX_STRING_LENGTH_V1 = 512;
const TOKEN_DEFINITION_MAX_KEYWORDS_V1 = 16;
const TOKEN_DEFINITION_MAX_FACES_V1 = 2;
const TOKEN_DEFINITION_MAX_COLORS_V1 = 5;
const TOKEN_DEFINITION_MAX_PRODUCED_MANA_V1 = 6;

function issue(code: string, path: string, message: string): CoreCommandValidationIssueV1 { return Object.freeze({ code, path, message }); }
function compare(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function sorted(values: readonly CoreCommandValidationIssueV1[]): readonly CoreCommandValidationIssueV1[] { return Object.freeze(values.slice().sort((left, right) => compare(left.path, right.path) || compare(left.code, right.code))); }
function plain(value: unknown): value is Record<string, unknown> {
  try { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null); } catch { return false; }
}
function exact(value: unknown, fields: readonly string[], path: string, issues: CoreCommandValidationIssueV1[], requiredFields: readonly string[] = fields): Record<string, unknown> | null {
  if (!plain(value)) { issues.push(issue('INVALID_TYPE', path, 'Expected a plain record')); return null; }
  let keys: readonly PropertyKey[];
  try { keys = Reflect.ownKeys(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Record keys are not readable')); return null; }
  const expected = new Set(fields); const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== 'string') { issues.push(issue('UNKNOWN_FIELD', `${path}/[symbol]`, 'Symbol fields are not allowed')); continue; }
    if (!expected.has(key)) { issues.push(issue('UNKNOWN_FIELD', `${path}/${key}`, 'Unknown field')); continue; }
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field must be an enumerable data property'));
    else out[key] = descriptor.value;
  }
  for (const field of requiredFields) if (!Object.prototype.hasOwnProperty.call(out, field)) issues.push(issue('MISSING_FIELD', `${path}/${field}`, 'Required field is missing'));
  return out;
}
function validBaseId(value: unknown): value is string { return isCoreBaseId(value) && !isCoreUnsafeRecordKey(value); }
function validObjectId(value: unknown): value is CoreObjectId { return isCanonicalCoreObjectIdV2(value); }
function requireBaseId(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): void { if (!validBaseId(value)) issues.push(issue('INVALID_ID', path, 'Invalid Core base ID')); }
function validApplicationId(value: unknown): value is string { return validBaseId(value) && value.length <= 80; }
function requireApplicationId(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): void { if (!validApplicationId(value)) issues.push(issue('INVALID_ID', path, 'Invalid application ID')); }
function requireObjectId(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): void { if (!validObjectId(value)) issues.push(issue('INVALID_ID', path, 'Invalid canonical Core object ID')); }
function requireRuleKey(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): void {
  const checked = validateCoreRuleKeyV1(value, path);
  if (!checked.ok) issues.push(...checked.issues.map((current) => issue(current.code, current.path, current.message)));
}
function validArray(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): readonly unknown[] | null {
  let array: boolean;
  try { array = Array.isArray(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe')); return null; }
  if (!array) { issues.push(issue('INVALID_ARRAY', path, 'Expected an array')); return null; }
  const objectValue = value as object;
  let keys: readonly PropertyKey[]; let lengthDescriptor: PropertyDescriptor | undefined;
  try { keys = Reflect.ownKeys(objectValue); lengthDescriptor = Object.getOwnPropertyDescriptor(objectValue, 'length'); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable')); return null; }
  try { if (Reflect.getPrototypeOf(objectValue) !== Array.prototype) issues.push(issue('INVALID_TYPE', path, 'Expected an ordinary array')); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array prototype is not readable')); }
  const lengthRecord = lengthDescriptor && 'value' in lengthDescriptor ? lengthDescriptor as unknown as Record<string, unknown> : null;
  const length = lengthRecord?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) { issues.push(issue('INVALID_ARRAY', `${path}/length`, 'Array length must be a non-negative safe integer')); return null; }
  if (length > MAX_CORE_COMMAND_ARRAY_LENGTH_V1) { issues.push(issue('INVALID_ARRAY', `${path}/length`, 'Array length exceeds the bounded Core command limit')); return null; }
  const expected = new Set<string>(); for (let index = 0; index < length; index += 1) expected.add(String(index));
  for (const key of keys) if (key !== 'length' && (typeof key !== 'string' || !expected.has(key))) issues.push(issue('UNKNOWN_FIELD', `${path}/${typeof key === 'string' ? key : '[symbol]'}`, 'Arrays must be dense and have no extra fields'));
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(objectValue, String(index)); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entries must be enumerable data properties'));
    else { const descriptorRecord = descriptor as unknown as Record<string, unknown>; result.push(descriptorRecord.value); }
  }
  return result;
}

function normalizeValue(value: unknown, path: string, issues: CoreCommandValidationIssueV1[], ancestors: WeakSet<object> = new WeakSet<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (Number.isFinite(value)) return value; issues.push(issue('INVALID_VALUE', path, 'Numbers must be finite')); return null; }
  if (typeof value !== 'object') { issues.push(issue('INVALID_TYPE', path, 'Only JSON values are supported')); return null; }
  let array: boolean;
  try { array = Array.isArray(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Value inspection is not safe')); return null; }
  if (ancestors.has(value)) { issues.push(issue('INVALID_VALUE', path, 'Circular references are not supported')); return null; }
  ancestors.add(value);
  try {
    if (array) {
      const entries = validArray(value, path, issues); if (!entries) return null;
      return Object.freeze(entries.map((entry, index) => normalizeValue(entry, `${path}/${index}`, issues, ancestors)));
    }
    if (!plain(value)) { issues.push(issue('INVALID_TYPE', path, 'Expected a plain record')); return null; }
    let keys: readonly PropertyKey[]; try { keys = Reflect.ownKeys(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Record descriptors are not readable')); return null; }
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== 'string') { issues.push(issue('UNKNOWN_FIELD', `${path}/[symbol]`, 'Symbol fields are not allowed')); continue; }
      let descriptor: PropertyDescriptor | undefined; try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field descriptor is not readable')); continue; }
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field must be an enumerable data property'));
      else result[key] = normalizeValue(descriptor.value, `${path}/${key}`, issues, ancestors);
    }
    return Object.freeze(result);
  } finally {
    ancestors.delete(value);
  }
}

function normalizedRecord(value: unknown, fields: readonly string[], path: string, issues: CoreCommandValidationIssueV1[]): Record<string, unknown> | null {
  const row = exact(value, fields, path, issues); if (!row) return null;
  const normalized: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const field of fields) if (Object.prototype.hasOwnProperty.call(row, field)) normalized[field] = normalizeValue(row[field], `${path}/${field}`, issues);
  return Object.freeze(normalized);
}

function normalizeZone(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): CoreRuleZoneRefV1 | null {
  const checked = validateCoreRuleZoneRefV1(value, path);
  if (!checked.ok) { issues.push(...checked.issues.map((current) => issue(current.code, current.path, current.message))); return null; }
  return checked.value;
}

function normalizeSearchInput(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): unknown {
  const row = exact(value, ['zone', 'portion', 'criteria', 'revealFound', 'shuffleAfter', 'rulesActorPlayerId'], path, issues, ['zone', 'portion', 'criteria', 'revealFound', 'shuffleAfter']);
  if (!row) return null;
  const zone = normalizeZone(row.zone, `${path}/zone`, issues);
  if (!zone) return null;
  if (row.revealFound !== true && row.revealFound !== false) issues.push(issue('INVALID_TYPE', `${path}/revealFound`, 'Expected a boolean'));
  if (row.shuffleAfter !== true && row.shuffleAfter !== false) issues.push(issue('INVALID_TYPE', `${path}/shuffleAfter`, 'Expected a boolean'));
  if (row.rulesActorPlayerId !== undefined) requireBaseId(row.rulesActorPlayerId, `${path}/rulesActorPlayerId`, issues);
  const portionRecord = exact(row.portion, ['kind', 'count'], `${path}/portion`, issues, ['kind']);
  const criteriaRecord = exact(row.criteria, ['kind', 'criteriaKey', 'minimum', 'maximum', 'mayFailToFind'], `${path}/criteria`, issues, ['kind', 'minimum', 'maximum']);
  const portion = portionRecord ? normalizeRecordValues(portionRecord, `${path}/portion`, issues) : null;
  const criteria = criteriaRecord ? normalizeRecordValues(criteriaRecord, `${path}/criteria`, issues) : null;
  if (portionRecord?.kind === 'all' && Object.prototype.hasOwnProperty.call(portionRecord, 'count')) issues.push(issue('UNKNOWN_FIELD', `${path}/portion/count`, 'All portions must not contain a count'));
  if (portionRecord?.kind === 'top' && (typeof portionRecord.count !== 'number' || !Number.isSafeInteger(portionRecord.count) || portionRecord.count < 0)) issues.push(issue('INVALID_INTEGER', `${path}/portion/count`, 'Top count must be a non-negative safe integer'));
  if (criteriaRecord?.kind === 'quantity' && (Object.prototype.hasOwnProperty.call(criteriaRecord, 'criteriaKey') || Object.prototype.hasOwnProperty.call(criteriaRecord, 'mayFailToFind'))) issues.push(issue('UNKNOWN_FIELD', `${path}/criteria`, 'Quantity criteria has fields for another kind'));
  if (criteriaRecord?.kind === 'qualified') {
    requireRuleKey(criteriaRecord.criteriaKey, `${path}/criteria/criteriaKey`, issues);
    if (typeof criteriaRecord.mayFailToFind !== 'boolean') issues.push(issue('INVALID_TYPE', `${path}/criteria/mayFailToFind`, 'Expected a boolean'));
  }
  if (issues.some((current) => current.path.startsWith(path))) return null;
  return Object.freeze({ zone, portion, criteria, revealFound: row.revealFound, shuffleAfter: row.shuffleAfter, ...(Object.prototype.hasOwnProperty.call(row, 'rulesActorPlayerId') ? { rulesActorPlayerId: row.rulesActorPlayerId } : {}) });
}

function normalizeRecordValues(row: Record<string, unknown>, path: string, issues: CoreCommandValidationIssueV1[]): Record<string, unknown> {
  const normalized: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(row)) normalized[key] = normalizeValue(row[key], `${path}/${key}`, issues);
  return Object.freeze(normalized);
}

function validateTokenDefinitionBounds(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): void {
  const fields = ['source', 'name', 'layout', 'manaValue', 'colorIdentity', 'typeLine', 'keywords', 'producedMana', 'tokenKind', 'faces'] as const;
  const row = exact(value, fields, path, issues);
  if (row === null) return;
  const boundedText = (candidate: unknown, candidatePath: string, allowEmpty = false): void => {
    if (typeof candidate !== 'string' || (!allowEmpty && candidate.length === 0) || candidate.length > TOKEN_DEFINITION_MAX_STRING_LENGTH_V1) {
      issues.push(issue('INVALID_STRING', candidatePath, 'Token definition text exceeds the bounded limit'));
    }
  };
  boundedText(row.name, `${path}/name`);
  boundedText(row.layout, `${path}/layout`);
  boundedText(row.typeLine, `${path}/typeLine`);
  const colors = validArray(row.colorIdentity, `${path}/colorIdentity`, issues);
  if (colors !== null && colors.length > TOKEN_DEFINITION_MAX_COLORS_V1) issues.push(issue('INVALID_ARRAY', `${path}/colorIdentity/length`, 'Token color identity exceeds the bounded limit'));
  const keywords = validArray(row.keywords, `${path}/keywords`, issues);
  if (keywords !== null) {
    if (keywords.length > TOKEN_DEFINITION_MAX_KEYWORDS_V1) issues.push(issue('INVALID_ARRAY', `${path}/keywords/length`, 'Token keywords exceed the bounded limit'));
    keywords.forEach((entry, index) => boundedText(entry, `${path}/keywords/${index}`));
  }
  const producedMana = validArray(row.producedMana, `${path}/producedMana`, issues);
  if (producedMana !== null && producedMana.length > TOKEN_DEFINITION_MAX_PRODUCED_MANA_V1) issues.push(issue('INVALID_ARRAY', `${path}/producedMana/length`, 'Token produced mana exceeds the bounded limit'));
  const faces = validArray(row.faces, `${path}/faces`, issues);
  if (faces === null) return;
  if (faces.length === 0 || faces.length > TOKEN_DEFINITION_MAX_FACES_V1) issues.push(issue('INVALID_ARRAY', `${path}/faces/length`, 'Token faces exceed the bounded limit'));
  const faceFields = ['name', 'manaCost', 'typeLine', 'oracleText', 'power', 'toughness', 'loyalty', 'defense'] as const;
  faces.forEach((entry, index) => {
    const face = exact(entry, faceFields, `${path}/faces/${index}`, issues);
    if (face === null) return;
    boundedText(face.name, `${path}/faces/${index}/name`);
    boundedText(face.typeLine, `${path}/faces/${index}/typeLine`);
    for (const key of ['manaCost', 'oracleText', 'power', 'toughness', 'loyalty', 'defense'] as const) {
      if (face[key] !== null) boundedText(face[key], `${path}/faces/${index}/${key}`, true);
    }
  });
}

function normalizeRemovalInput(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): unknown {
  const row = exact(value, ['kind', 'objectId', 'destination'], path, issues, ['kind', 'objectId']);
  if (!row) return null;
  if (row.kind === 'cease') {
    if (Object.prototype.hasOwnProperty.call(row, 'destination')) issues.push(issue('UNKNOWN_FIELD', `${path}/destination`, 'Cease input must not contain a destination'));
  } else if (row.kind === 'card-to-zone') {
    const destination = exact(row.destination, ['kind', 'placement', 'baseControllerPlayerId'], `${path}/destination`, issues, ['kind']);
    if (destination) normalizeRecordValues(destination, `${path}/destination`, issues);
    const destinationValidation = validateCoreCardZoneDestinationV1(row.destination);
    if (!destinationValidation.ok || destinationValidation.value.kind === 'stack') issues.push(issue('INVALID_DESTINATION', `${path}/destination`, 'Invalid card removal destination'));
  } else issues.push(issue('INVALID_LITERAL', `${path}/kind`, 'Invalid removal kind'));
  requireObjectId(row.objectId, `${path}/objectId`, issues);
  return normalizeRecordValues(row, path, issues);
}

function normalizeStackCommitInput(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): unknown {
  const row = normalizedRecord(value, ['sourceObjectId', 'controllerPlayerId', 'announcement'], path, issues);
  if (!row) return null;
  requireObjectId(row.sourceObjectId, `${path}/sourceObjectId`, issues);
  requireBaseId(row.controllerPlayerId, `${path}/controllerPlayerId`, issues);
  const announcement = exact(row.announcement, ['kind', 'abilityTextSnapshot', 'chosenModeKeys', 'targetSelections', 'announcedVariables', 'distributions', 'costChoices'], `${path}/announcement`, issues);
  if (announcement) normalizeRecordValues(announcement, `${path}/announcement`, issues);
  return normalizeRecordValues(row, path, issues);
}

function normalizeControlEffect(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): unknown {
  const row = normalizedRecord(value, ['targetObjectId', 'gainingControllerPlayerId', 'sourceObjectId', 'duration'], path, issues);
  if (!row) return null;
  requireObjectId(row.targetObjectId, `${path}/targetObjectId`, issues);
  requireBaseId(row.gainingControllerPlayerId, `${path}/gainingControllerPlayerId`, issues);
  if (row.sourceObjectId !== null) requireObjectId(row.sourceObjectId, `${path}/sourceObjectId`, issues);
  const duration = exact(row.duration, ['kind', 'turnNumber', 'sourceObjectId', 'controllerPlayerId'], `${path}/duration`, issues, ['kind']);
  if (duration) {
    normalizeRecordValues(duration, `${path}/duration`, issues);
    if (duration.kind === 'while-source-controlled-by') {
      requireObjectId(duration.sourceObjectId, `${path}/duration/sourceObjectId`, issues);
      requireBaseId(duration.controllerPlayerId, `${path}/duration/controllerPlayerId`, issues);
    } else if (duration.kind === 'while-source-exists' || duration.kind === 'while-source-attached-to-target') {
      requireObjectId(duration.sourceObjectId, `${path}/duration/sourceObjectId`, issues);
    }
  }
  return normalizeRecordValues(row, path, issues);
}

function normalizeVisibilityGrant(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): unknown {
  const row = exact(value, ['subject', 'audience', 'mode', 'sourceObjectId', 'duration', 'openingSequence', 'openingObjectIds', 'topLibraryPrefixDigest', 'networkBound'], path, issues, ['subject', 'audience', 'mode', 'sourceObjectId', 'duration']);
  if (!row) return null;
  if (row.sourceObjectId !== null) requireObjectId(row.sourceObjectId, `${path}/sourceObjectId`, issues);
  const subject = normalizeValue(row.subject, `${path}/subject`, issues);
  const audience = normalizeValue(row.audience, `${path}/audience`, issues);
  const duration = normalizeValue(row.duration, `${path}/duration`, issues);
  if (row.openingSequence !== undefined && (typeof row.openingSequence !== 'number' || !Number.isSafeInteger(row.openingSequence) || row.openingSequence < 0)) issues.push(issue('INVALID_INTEGER', `${path}/openingSequence`, 'Invalid opening sequence'));
  if (row.openingObjectIds !== undefined) {
    const ids = validArray(row.openingObjectIds, `${path}/openingObjectIds`, issues);
    ids?.forEach((id, index) => requireObjectId(id, `${path}/openingObjectIds/${index}`, issues));
  }
  if (row.topLibraryPrefixDigest !== undefined && (typeof row.topLibraryPrefixDigest !== 'string' || !/^[0-9a-f]{64}$/.test(row.topLibraryPrefixDigest))) issues.push(issue('INVALID_DIGEST', `${path}/topLibraryPrefixDigest`, 'Invalid top-library prefix digest'));
  if (row.networkBound !== undefined && typeof row.networkBound !== 'boolean') issues.push(issue('INVALID_TYPE', `${path}/networkBound`, 'Invalid network bound marker'));
  return Object.freeze({ subject, audience, mode: row.mode, sourceObjectId: row.sourceObjectId, duration, ...(row.openingSequence === undefined ? {} : { openingSequence: row.openingSequence }), ...(row.openingObjectIds === undefined ? {} : { openingObjectIds: row.openingObjectIds }), ...(row.topLibraryPrefixDigest === undefined ? {} : { topLibraryPrefixDigest: row.topLibraryPrefixDigest }), ...(row.networkBound === undefined ? {} : { networkBound: row.networkBound }) });
}

function normalizePayloadNested(kind: string, row: Record<string, unknown>, issues: CoreCommandValidationIssueV1[]): Record<string, unknown> {
  const nested = { ...row };
  if (kind === 'stack-commit-card-spell') nested.input = normalizeStackCommitInput(row.input, '/payload/input', issues);
  else if (kind === 'stack-remove-object') nested.input = normalizeRemovalInput(row.input, '/payload/input', issues);
  else if (kind === 'search-open') nested.input = normalizeSearchInput(row.input, '/payload/input', issues);
  else if (kind === 'control-effect-apply') nested.effect = normalizeControlEffect(row.effect, '/payload/effect', issues);
  else if (kind === 'visibility-open') nested.grant = normalizeVisibilityGrant(row.grant, '/payload/grant', issues);
  else if (kind === 'combat-attack-add') nested.attack = normalizedRecord(row.attack, ['attackerObjectId', 'attackerControllerPlayerId', 'defendingPlayerId'], '/payload/attack', issues);
  else if (kind === 'combat-block-add') nested.block = normalizedRecord(row.block, ['blockerObjectId', 'blockerControllerPlayerId', 'attackedObjectId', 'defendingPlayerId'], '/payload/block', issues);
  else if (kind === 'random-zone-order') nested.zone = normalizeZone(row.zone, '/payload/zone', issues);
  for (const key of Object.keys(nested)) if (nested[key] !== null && typeof nested[key] === 'object' && !Object.isFrozen(nested[key])) nested[key] = normalizeValue(nested[key], `/payload/${key}`, issues);
  return nested;
}
function normalizeTabletopDefinition(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): unknown {
  const row = exact(value, ['source', 'name', 'layout', 'manaValue', 'colorIdentity', 'typeLine', 'keywords', 'producedMana', 'tokenKind', 'faces'], path, issues);
  if (!row) return null;
  validateTokenDefinitionBounds(value, path, issues);
  const normalized: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(row)) normalized[key] = normalizeValue(row[key], `${path}/${key}`, issues);
  const source = exact(row.source, ['kind'], `${path}/source`, issues);
  if (source && source.kind !== 'engine-synthetic') issues.push(issue('INVALID_LITERAL', `${path}/source/kind`, 'Token definitions must be engine-synthetic'));
  if (Object.is(row.manaValue, -0)) issues.push(issue('INVALID_NUMBER', `${path}/manaValue`, 'Negative zero is not a canonical number'));
  const faces = validArray(row.faces, `${path}/faces`, issues);
  if (faces) for (let index = 0; index < faces.length; index += 1) {
    const face = exact(faces[index], ['name', 'manaCost', 'typeLine', 'oracleText', 'power', 'toughness', 'loyalty', 'defense'], `${path}/faces/${index}`, issues);
    if (face) normalized.faces = Object.freeze(faces.map((entry, faceIndex) => {
      const checked = exact(entry, ['name', 'manaCost', 'typeLine', 'oracleText', 'power', 'toughness', 'loyalty', 'defense'], `${path}/faces/${faceIndex}`, issues);
      return checked === null ? Object.freeze({}) : Object.freeze(normalizeRecordValues(checked, `${path}/faces/${faceIndex}`, issues));
    }));
  }
  const frozen = Object.freeze(normalized);
  let serialized: string;
  try { serialized = JSON.stringify(frozen); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Token definition could not be serialized safely')); return null; }
  if (new TextEncoder().encode(serialized).length > TOKEN_DEFINITION_MAX_SERIALIZED_BYTES_V1) {
    issues.push(issue('INVALID_SIZE', path, 'Token definition exceeds the bounded projection budget'));
    return null;
  }
  return frozen;
}
function normalizeTabletopTransition(value: unknown, path: string, issues: CoreCommandValidationIssueV1[]): unknown {
  const row = exact(value, ['kind', 'nextPosition'], path, issues, ['kind']);
  if (!row) return null;
  if (row.kind === 'checkpoint' || row.kind === 'next-turn') {
    if (Object.prototype.hasOwnProperty.call(row, 'nextPosition')) issues.push(issue('UNKNOWN_FIELD', `${path}/nextPosition`, 'This transition does not contain a next position'));
    return Object.freeze({ kind: row.kind });
  }
  if (row.kind === 'first-turn-draw-skip') {
    if (Object.prototype.hasOwnProperty.call(row, 'nextPosition')) issues.push(issue('UNKNOWN_FIELD', `${path}/nextPosition`, 'This transition does not contain a next position'));
    return issues.some((current) => current.path.startsWith(path)) ? null : Object.freeze({ kind: 'first-turn-draw-skip' as const });
  }
  if (row.kind !== 'position') { issues.push(issue('INVALID_LITERAL', `${path}/kind`, 'Invalid tabletop turn transition')); return null; }
  const nextPosition = plain(row.nextPosition) ? row.nextPosition : null;
  if (nextPosition === null) { issues.push(issue('INVALID_TYPE', `${path}/nextPosition`, 'Next position must be a plain record')); return null; }
  const positionFields = ['phase', 'step'] as const;
  const position = exact(nextPosition, positionFields, `${path}/nextPosition`, issues);
  if (!position) return null;
  const phase = position.phase;
  const step = position.step;
  const valid = (phase === 'beginning' && (step === 'untap' || step === 'upkeep' || step === 'draw'))
    || (phase === 'precombat-main' && step === null)
    || (phase === 'combat' && (step === 'beginning-of-combat' || step === 'declare-attackers' || step === 'declare-blockers' || step === 'combat-damage' || step === 'end-of-combat'))
    || (phase === 'postcombat-main' && step === null)
    || (phase === 'ending' && (step === 'end' || step === 'cleanup'));
  if (!valid) issues.push(issue('INVALID_POSITION', `${path}/nextPosition`, 'Invalid turn position'));
  return valid ? Object.freeze({ kind: 'position' as const, nextPosition: Object.freeze({ phase, step }) }) : null;
}
function readKind(value: unknown, issues: CoreCommandValidationIssueV1[]): string | null {
  if (!plain(value)) { issues.push(issue('INVALID_TYPE', '/payload', 'Payload must be a plain record')); return null; }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'kind');
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || typeof descriptor.value !== 'string') { issues.push(issue('INVALID_LITERAL', '/payload/kind', 'Payload kind must be a data string')); return null; }
    return descriptor.value;
  } catch { issues.push(issue('INVALID_DESCRIPTOR', '/payload/kind', 'Payload kind descriptor is not readable')); return null; }
}
function validateContext(value: unknown, issues: CoreCommandValidationIssueV1[]): CoreDecisionContextV1 | null {
  if (!plain(value)) { issues.push(issue('INVALID_TYPE', '/decisionContext', 'Expected a plain record')); return null; }
  const raw: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  let keys: readonly PropertyKey[];
  try { keys = Reflect.ownKeys(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', '/decisionContext', 'Record keys are not readable')); return null; }
  const allowed = new Set(['kind', 'decisionKey', 'searchSessionId', 'turnNumber']);
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) { issues.push(issue('UNKNOWN_FIELD', `/decisionContext/${typeof key === 'string' ? key : '[symbol]'}`, 'Unknown field')); continue; }
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { issues.push(issue('INVALID_DESCRIPTOR', `/decisionContext/${key}`, 'Field descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) issues.push(issue('INVALID_DESCRIPTOR', `/decisionContext/${key}`, 'Field must be an enumerable data property'));
    else raw[key] = descriptor.value;
  }
  if (!Object.prototype.hasOwnProperty.call(raw, 'kind')) issues.push(issue('MISSING_FIELD', '/decisionContext/kind', 'Required field is missing'));
  if (typeof raw.turnNumber !== 'undefined' && (typeof raw.turnNumber !== 'number' || !Number.isSafeInteger(raw.turnNumber) || raw.turnNumber < 0 || Object.is(raw.turnNumber, -0))) issues.push(issue('INVALID_INTEGER', '/decisionContext/turnNumber', 'Turn number must be a canonical non-negative safe integer'));
  const turnNumber = typeof raw.turnNumber === 'number' ? raw.turnNumber : undefined;
  if (raw.kind === 'decision') {
    const checked = validateCoreRuleKeyV1(raw.decisionKey, '/decisionContext/decisionKey');
    if (checked.ok) return Object.freeze({ kind: 'decision', decisionKey: checked.value, ...(turnNumber === undefined ? {} : { turnNumber }) });
    issues.push(...checked.issues.map((current) => issue(current.code, current.path, current.message)));
    return null;
  }
  if (raw.kind === 'search-session') {
    const checked = validateCoreRuleKeyV1(raw.searchSessionId, '/decisionContext/searchSessionId');
    if (checked.ok) return Object.freeze({ kind: 'search-session', searchSessionId: checked.value, ...(turnNumber === undefined ? {} : { turnNumber }) });
    issues.push(...checked.issues.map((current) => issue(current.code, current.path, current.message)));
    return null;
  }
  issues.push(issue('INVALID_LITERAL', '/decisionContext/kind', 'Invalid decision context kind')); return null;
}

export function validateCoreCommandV1(input: unknown): CoreCommandValidationResultV1 {
  const issues: CoreCommandValidationIssueV1[] = [];
  const root = exact(input, ['kind', 'schemaVersion', 'sequence', 'actorPlayerId', 'decisionMakerPlayerId', 'decisionContext', 'payload'], '', issues);
  if (!root) return { ok: false, issues: sorted(issues) };
  if (root.kind !== 'mode-neutral-core-command-v1') issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid command kind'));
  if (root.schemaVersion !== 1) issues.push(issue('INVALID_VERSION', '/schemaVersion', 'Invalid command schema version'));
  if (typeof root.sequence !== 'number' || !Number.isSafeInteger(root.sequence) || root.sequence < 1) issues.push(issue('INVALID_INTEGER', '/sequence', 'Sequence must be a positive safe integer'));
  requireBaseId(root.actorPlayerId, '/actorPlayerId', issues);
  requireBaseId(root.decisionMakerPlayerId, '/decisionMakerPlayerId', issues);
  const context = validateContext(root.decisionContext, issues);
  const rawPayload = root.payload;
  const payloadRecord = plain(rawPayload) ? rawPayload : null;
  if (!payloadRecord) issues.push(issue('INVALID_TYPE', '/payload', 'Payload must be a plain record'));
  let payload: CoreCommandPayloadV1 | null = null;
  if (payloadRecord) {
    const kind = readKind(payloadRecord, issues);
    const requireRecord = (fields: readonly string[], optionalFields: readonly string[] = []): Record<string, unknown> | null => exact(payloadRecord, fields, '/payload', issues, fields.filter((field) => !optionalFields.includes(field)));
    const requirePlayerId = (value: unknown, path: string): void => requireBaseId(value, path, issues);
    if (kind === 'stack-commit-card-spell') {
      const row = requireRecord(['kind', 'input']); if (row) { const nested = normalizePayloadNested(kind, row, issues); payload = Object.freeze({ kind, input: nested.input as CoreCardSpellCommitInputV1 }); }
    } else if (kind === 'stack-remove-object') {
      const row = requireRecord(['kind', 'input']); if (row) { const nested = normalizePayloadNested(kind, row, issues); payload = Object.freeze({ kind, input: nested.input as CoreStackRemovalInputV1 }); }
    } else if (kind === 'priority-pass') {
      const row = requireRecord(['kind', 'playerId']); if (row) { requirePlayerId(row.playerId, '/payload/playerId'); payload = Object.freeze({ kind, playerId: row.playerId as CorePlayerId }); }
    } else if (kind === 'search-open') {
      const row = requireRecord(['kind', 'sessionKey', 'input']); if (row) { requireRuleKey(row.sessionKey, '/payload/sessionKey', issues); const nested = normalizePayloadNested(kind, row, issues); payload = Object.freeze({ kind, sessionKey: row.sessionKey as CoreRuleKeyV1, input: nested.input as CoreSearchSessionInputV1 }); }
    } else if (kind === 'search-complete') {
      const row = requireRecord(['kind', 'sessionKey', 'selectedObjectIds']); if (row) { requireRuleKey(row.sessionKey, '/payload/sessionKey', issues); const ids = validArray(row.selectedObjectIds, '/payload/selectedObjectIds', issues); ids?.forEach((id, index) => requireObjectId(id, `/payload/selectedObjectIds/${index}`, issues)); if (ids) payload = Object.freeze({ kind, sessionKey: row.sessionKey as CoreRuleKeyV1, selectedObjectIds: Object.freeze(ids as CoreObjectId[]) }); }
    } else if (kind === 'visibility-open') {
      const row = requireRecord(['kind', 'grantKey', 'grant']); if (row) { requireRuleKey(row.grantKey, '/payload/grantKey', issues); const nested = normalizePayloadNested(kind, row, issues); if (nested.grant !== null) payload = Object.freeze({ kind, grantKey: row.grantKey as CoreRuleKeyV1, grant: nested.grant as CoreVisibilityOpenPayloadV1['grant'] }); }
    } else if (kind === 'visibility-close') {
      const row = requireRecord(['kind', 'grantKey']); if (row) { requireRuleKey(row.grantKey, '/payload/grantKey', issues); payload = Object.freeze({ kind, grantKey: row.grantKey as CoreRuleKeyV1 }); }
    } else if (kind === 'control-effect-apply') {
      const row = requireRecord(['kind', 'effectKey', 'effect']); if (row) { requireRuleKey(row.effectKey, '/payload/effectKey', issues); const nested = normalizePayloadNested(kind, row, issues); payload = Object.freeze({ kind, effectKey: row.effectKey as CoreRuleKeyV1, effect: nested.effect as CoreControlEffectV1 }); }
    } else if (kind === 'commander-cast-record') {
      const row = requireRecord(['kind', 'physicalCardId', 'origin', 'accepted']); if (row) { requireBaseId(row.physicalCardId, '/payload/physicalCardId', issues); if (row.origin !== 'command-zone' && row.origin !== 'other-zone' && row.origin !== 'copy') issues.push(issue('INVALID_LITERAL', '/payload/origin', 'Invalid cast origin')); if (typeof row.accepted !== 'boolean') issues.push(issue('INVALID_TYPE', '/payload/accepted', 'Accepted must be boolean')); payload = Object.freeze({ kind, physicalCardId: row.physicalCardId as CorePhysicalCardId, origin: row.origin as CoreCommanderCastOriginV1, accepted: row.accepted as boolean }); }
    } else if (kind === 'commander-damage-record') {
      const row = requireRecord(['kind', 'physicalCardId', 'defendingPlayerId', 'damage', 'combatObjectId']); if (row) { requireBaseId(row.physicalCardId, '/payload/physicalCardId', issues); requirePlayerId(row.defendingPlayerId, '/payload/defendingPlayerId'); requireObjectId(row.combatObjectId, '/payload/combatObjectId', issues); if (typeof row.damage !== 'number' || !Number.isSafeInteger(row.damage) || row.damage < 0) issues.push(issue('INVALID_DAMAGE', '/payload/damage', 'Damage must be a nonnegative safe integer')); payload = Object.freeze({ kind, physicalCardId: row.physicalCardId as CorePhysicalCardId, defendingPlayerId: row.defendingPlayerId as CorePlayerId, damage: row.damage as number, combatObjectId: row.combatObjectId as CoreObjectId }); }
    } else if (kind === 'combat-step-set') {
      const row = requireRecord(['kind', 'step']); if (row) { if (row.step !== 'declare-attackers' && row.step !== 'declare-blockers') issues.push(issue('INVALID_LITERAL', '/payload/step', 'Invalid combat step')); payload = Object.freeze({ kind, step: row.step as CoreCombatContextStepV1 }); }
    } else if (kind === 'combat-attack-add') {
      const row = requireRecord(['kind', 'attack']); if (row) { const nested = normalizePayloadNested(kind, row, issues); const attack = nested.attack as Record<string, unknown> | null; if (attack) { requireObjectId(attack.attackerObjectId, '/payload/attack/attackerObjectId', issues); requirePlayerId(attack.attackerControllerPlayerId, '/payload/attack/attackerControllerPlayerId'); requirePlayerId(attack.defendingPlayerId, '/payload/attack/defendingPlayerId'); } payload = Object.freeze({ kind, attack: nested.attack as CoreCombatContextAttackV1 }); }
    } else if (kind === 'combat-block-add') {
      const row = requireRecord(['kind', 'block']); if (row) { const nested = normalizePayloadNested(kind, row, issues); const block = nested.block as Record<string, unknown> | null; if (block) { requireObjectId(block.blockerObjectId, '/payload/block/blockerObjectId', issues); requirePlayerId(block.blockerControllerPlayerId, '/payload/block/blockerControllerPlayerId'); requireObjectId(block.attackedObjectId, '/payload/block/attackedObjectId', issues); requirePlayerId(block.defendingPlayerId, '/payload/block/defendingPlayerId'); } payload = Object.freeze({ kind, block: nested.block as CoreCombatContextBlockV1 }); }
    } else if (kind === 'player-exit') {
      const row = requireRecord(['kind', 'playerId', 'cause']); if (row) { requirePlayerId(row.playerId, '/payload/playerId'); if (row.cause !== 'concession' && row.cause !== 'defeat') issues.push(issue('INVALID_LITERAL', '/payload/cause', 'Invalid exit cause')); payload = Object.freeze({ kind, playerId: row.playerId as CorePlayerId, cause: row.cause as 'concession' | 'defeat' }); }
    } else if (kind === 'random-zone-order') {
      const row = requireRecord(['kind', 'randomDecisionId', 'zone', 'beforeOrder', 'afterOrder', 'manualMode'], ['manualMode']); if (row) { requireRuleKey(row.randomDecisionId, '/payload/randomDecisionId', issues); const before = validArray(row.beforeOrder, '/payload/beforeOrder', issues); const after = validArray(row.afterOrder, '/payload/afterOrder', issues); before?.forEach((id, index) => requireObjectId(id, `/payload/beforeOrder/${index}`, issues)); after?.forEach((id, index) => requireObjectId(id, `/payload/afterOrder/${index}`, issues)); const nested = normalizePayloadNested(kind, row, issues); const zone = nested.zone as CoreRuleZoneRefV1 | null; if (zone && (zone.kind !== 'player-zone' || zone.zone !== 'library')) issues.push(issue('INVALID_RANDOM_ZONE', '/payload/zone', 'V1 random zone order is limited to a player library')); if (row.manualMode !== undefined && row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); if (before && after && zone) payload = Object.freeze({ kind, randomDecisionId: row.randomDecisionId as CoreRuleKeyV1, zone, beforeOrder: Object.freeze(before as CoreObjectId[]), afterOrder: Object.freeze(after as CoreObjectId[]), ...(row.manualMode === undefined ? {} : { manualMode: row.manualMode }) }); }
    } else if (kind === 'correct-player-life') {
      const row = requireRecord(['kind', 'playerId', 'replacementLifeTotal', 'expectedBeforeStateDigest', 'reason']); if (row) { requirePlayerId(row.playerId, '/payload/playerId'); if (typeof row.replacementLifeTotal !== 'number' || !Number.isSafeInteger(row.replacementLifeTotal)) issues.push(issue('INVALID_INTEGER', '/payload/replacementLifeTotal', 'Life must be a safe integer')); if (typeof row.expectedBeforeStateDigest !== 'string' || !/^[0-9a-f]{64}$/.test(row.expectedBeforeStateDigest)) issues.push(issue('INVALID_DIGEST', '/payload/expectedBeforeStateDigest', 'Digest must be lowercase SHA-256 hexadecimal')); if (typeof row.reason !== 'string' || row.reason.trim().length === 0) issues.push(issue('INVALID_REASON', '/payload/reason', 'Reason must be non-empty and non-whitespace')); payload = Object.freeze({ kind, playerId: row.playerId as CorePlayerId, replacementLifeTotal: row.replacementLifeTotal as number, expectedBeforeStateDigest: row.expectedBeforeStateDigest as string, reason: row.reason as string }); }
    } else if (kind === 'correct-commander-damage') {
      const row = requireRecord(['kind', 'physicalCardId', 'defendingPlayerId', 'replacementDamageTotal', 'expectedBeforeStateDigest', 'reason']); if (row) { requireBaseId(row.physicalCardId, '/payload/physicalCardId', issues); requirePlayerId(row.defendingPlayerId, '/payload/defendingPlayerId'); if (typeof row.replacementDamageTotal !== 'number' || !Number.isSafeInteger(row.replacementDamageTotal) || row.replacementDamageTotal < 0) issues.push(issue('INVALID_DAMAGE', '/payload/replacementDamageTotal', 'Damage must be a nonnegative safe integer')); if (typeof row.expectedBeforeStateDigest !== 'string' || !/^[0-9a-f]{64}$/.test(row.expectedBeforeStateDigest)) issues.push(issue('INVALID_DIGEST', '/payload/expectedBeforeStateDigest', 'Digest must be lowercase SHA-256 hexadecimal')); if (typeof row.reason !== 'string' || row.reason.trim().length === 0) issues.push(issue('INVALID_REASON', '/payload/reason', 'Reason must be non-empty and non-whitespace')); payload = Object.freeze({ kind, physicalCardId: row.physicalCardId as CorePhysicalCardId, defendingPlayerId: row.defendingPlayerId as CorePlayerId, replacementDamageTotal: row.replacementDamageTotal as number, expectedBeforeStateDigest: row.expectedBeforeStateDigest as string, reason: row.reason as string }); }
    } else if (kind === 'table-draw') {
      const row = requireRecord(['kind', 'count', 'manualMode'], ['manualMode']); if (row) { if (typeof row.count !== 'number' || !Number.isSafeInteger(row.count) || row.count < 1 || row.count > 100 || Object.is(row.count, -0)) issues.push(issue('INVALID_INTEGER', '/payload/count', 'Draw count must be 1 through 100')); if (row.manualMode !== undefined && row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, count: row.count as number, ...(row.manualMode === undefined ? {} : { manualMode: row.manualMode }) }); }
    } else if (kind === 'table-zone-move') {
      const row = requireRecord(['kind', 'objectId', 'destination', 'manualMode'], ['manualMode']); if (row) { requireObjectId(row.objectId, '/payload/objectId', issues); if (row.manualMode !== undefined && row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); const destination = validateCoreCardZoneDestinationV1(row.destination); if (!destination.ok) issues.push(...destination.issues.map((current) => issue(current.code, `/payload/destination${current.path}`, current.message))); else { if (destination.value.kind === 'battlefield' || destination.value.kind === 'stack') requireBaseId(destination.value.baseControllerPlayerId, '/payload/destination/baseControllerPlayerId', issues); payload = Object.freeze({ kind, objectId: row.objectId as CoreObjectId, destination: destination.value, ...(row.manualMode === undefined ? {} : { manualMode: row.manualMode }) }); } }
    } else if (kind === 'table-tap') {
      const row = requireRecord(['kind', 'objectId', 'tapped', 'manualMode'], ['manualMode']); if (row) { requireObjectId(row.objectId, '/payload/objectId', issues); if (typeof row.tapped !== 'boolean') issues.push(issue('INVALID_TYPE', '/payload/tapped', 'Tapped must be boolean')); if (row.manualMode !== undefined && row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, objectId: row.objectId as CoreObjectId, tapped: row.tapped as boolean, ...(row.manualMode === undefined ? {} : { manualMode: row.manualMode }) }); }
    } else if (kind === 'table-mana-adjust') {
      const row = requireRecord(['kind', 'color', 'delta', 'manualMode'], ['manualMode']); if (row) { if (row.color !== 'W' && row.color !== 'U' && row.color !== 'B' && row.color !== 'R' && row.color !== 'G' && row.color !== 'C') issues.push(issue('INVALID_LITERAL', '/payload/color', 'Invalid mana color')); if (typeof row.delta !== 'number' || !Number.isSafeInteger(row.delta) || row.delta === 0 || Object.is(row.delta, -0)) issues.push(issue('INVALID_INTEGER', '/payload/delta', 'Mana delta must be a non-zero safe integer')); if (row.manualMode !== undefined && row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, color: row.color as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', delta: row.delta as number, ...(row.manualMode === undefined ? {} : { manualMode: row.manualMode }) }); }
    } else if (kind === 'table-counter-adjust') {
      const row = requireRecord(['kind', 'objectId', 'counterKind', 'delta', 'manualMode'], ['manualMode']); if (row) { requireObjectId(row.objectId, '/payload/objectId', issues); const counterKind = typeof row.counterKind === 'string' ? row.counterKind : ''; const hasControl = [...counterKind].some((character) => { const codePoint = character.codePointAt(0) ?? 0; return codePoint <= 0x1f || codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f); }); if (counterKind.length === 0 || counterKind.trim() !== counterKind || counterKind.length > 80 || hasControl) issues.push(issue('INVALID_STRING', '/payload/counterKind', 'Invalid counter kind')); if (typeof row.delta !== 'number' || !Number.isSafeInteger(row.delta) || row.delta === 0 || Object.is(row.delta, -0)) issues.push(issue('INVALID_INTEGER', '/payload/delta', 'Counter delta must be a non-zero safe integer')); if (row.manualMode !== undefined && row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, objectId: row.objectId as CoreObjectId, counterKind: counterKind, delta: row.delta as number, ...(row.manualMode === undefined ? {} : { manualMode: row.manualMode }) }); }
    } else if (kind === 'table-token-create') {
      const row = requireRecord(['kind', 'tokenSeed', 'definitionId', 'definition', 'manualMode'], ['manualMode']); if (row) { requireBaseId(row.tokenSeed, '/payload/tokenSeed', issues); requireBaseId(row.definitionId, '/payload/definitionId', issues); if (row.manualMode !== undefined && row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); const definition = normalizeTabletopDefinition(row.definition, '/payload/definition', issues); if (definition !== null) payload = Object.freeze({ kind, tokenSeed: row.tokenSeed as string, definitionId: row.definitionId as never, definition: definition as CoreCardDefinitionSnapshotV1, ...(row.manualMode === undefined ? {} : { manualMode: row.manualMode }) }); }
    } else if (kind === 'table-token-remove') {
      const row = requireRecord(['kind', 'objectId', 'manualMode'], ['manualMode']); if (row) { requireObjectId(row.objectId, '/payload/objectId', issues); if (row.manualMode !== undefined && row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, objectId: row.objectId as CoreObjectId, ...(row.manualMode === undefined ? {} : { manualMode: row.manualMode }) }); }
    } else if (kind === 'table-shuffle') {
      const row = requireRecord(['kind', 'manualMode']); if (row) { if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, manualMode: row.manualMode as 'structured' | 'freeform' }); }
    } else if (kind === 'table-reorder') {
      const row = requireRecord(['kind', 'zone', 'order', 'manualMode']); if (row) { const zone = normalizeZone(row.zone, '/payload/zone', issues); const order = validArray(row.order, '/payload/order', issues); order?.forEach((id, index) => requireObjectId(id, `/payload/order/${index}`, issues)); if (zone === null || order === null) { /* issues already recorded */ } else if (zone.kind !== 'shared-zone' || !['battlefield', 'stack', 'exile', 'command'].includes(zone.zone)) issues.push(issue('INVALID_LITERAL', '/payload/zone', 'Reorder is limited to public zones')); else if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); else payload = Object.freeze({ kind, zone, order: Object.freeze(order as CoreObjectId[]), manualMode: row.manualMode }); }
    } else if (kind === 'table-life-adjust') {
      const row = requireRecord(['kind', 'field', 'delta', 'manualMode']); if (row) { if (!['life', 'poison', 'energy', 'experience'].includes(String(row.field))) issues.push(issue('INVALID_LITERAL', '/payload/field', 'Invalid player fact')); if (typeof row.delta !== 'number' || !Number.isSafeInteger(row.delta) || row.delta === 0 || Object.is(row.delta, -0)) issues.push(issue('INVALID_INTEGER', '/payload/delta', 'Delta must be a non-zero safe integer')); if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, field: row.field as 'life' | 'poison' | 'energy' | 'experience', delta: row.delta as number, manualMode: row.manualMode as 'structured' | 'freeform' }); }
    } else if (kind === 'table-controller-change') {
      const row = requireRecord(['kind', 'objectId', 'gainingControllerPlayerId', 'manualMode']); if (row) { requireObjectId(row.objectId, '/payload/objectId', issues); requirePlayerId(row.gainingControllerPlayerId, '/payload/gainingControllerPlayerId'); if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, objectId: row.objectId as CoreObjectId, gainingControllerPlayerId: row.gainingControllerPlayerId as CorePlayerId, manualMode: row.manualMode as 'structured' | 'freeform' }); }
    } else if (kind === 'table-attach') {
      const row = requireRecord(['kind', 'objectId', 'targetObjectId', 'manualMode']); if (row) { requireObjectId(row.objectId, '/payload/objectId', issues); if (row.targetObjectId !== null) requireObjectId(row.targetObjectId, '/payload/targetObjectId', issues); if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, objectId: row.objectId as CoreObjectId, targetObjectId: row.targetObjectId as CoreObjectId | null, manualMode: row.manualMode as 'structured' | 'freeform' }); }
    } else if (kind === 'table-damage-mark') {
      const row = requireRecord(['kind', 'objectId', 'amount', 'manualMode']); if (row) { requireObjectId(row.objectId, '/payload/objectId', issues); if (typeof row.amount !== 'number' || !Number.isSafeInteger(row.amount) || row.amount === 0 || Object.is(row.amount, -0)) issues.push(issue('INVALID_INTEGER', '/payload/amount', 'Damage amount must be a non-zero safe integer')); if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, objectId: row.objectId as CoreObjectId, amount: row.amount as number, manualMode: row.manualMode as 'structured' | 'freeform' }); }
    } else if (kind === 'table-note-set') {
      const row = requireRecord(['kind', 'noteId', 'text', 'manualMode']); if (row) { const textValue = typeof row.text === 'string' ? row.text : ''; const hasControl = [...textValue].some((character) => { const codePoint = character.codePointAt(0) ?? 0; return codePoint <= 0x1f || codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f); }); requireApplicationId(row.noteId, '/payload/noteId', issues); if (textValue.trim() !== textValue || textValue.length < 1 || textValue.length > 160 || hasControl) issues.push(issue('INVALID_STRING', '/payload/text', 'Invalid note text')); if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, noteId: row.noteId as string, text: textValue, manualMode: row.manualMode as 'structured' | 'freeform' }); }
    } else if (kind === 'table-note-clear') {
      const row = requireRecord(['kind', 'noteId', 'manualMode']); if (row) { requireApplicationId(row.noteId, '/payload/noteId', issues); if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, noteId: row.noteId as string, manualMode: row.manualMode as 'structured' | 'freeform' }); }
    } else if (kind === 'table-stack-entry') {
      const row = requireRecord(['kind', 'entryId', 'label', 'sourceObjectId', 'manualMode']); if (row) { const label = typeof row.label === 'string' ? row.label : ''; const hasControl = [...label].some((character) => { const codePoint = character.codePointAt(0) ?? 0; return codePoint <= 0x1f || codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f); }); requireApplicationId(row.entryId, '/payload/entryId', issues); if (label.trim() !== label || label.length < 1 || label.length > 160 || hasControl) issues.push(issue('INVALID_STRING', '/payload/label', 'Invalid stack label')); if (row.sourceObjectId !== undefined && row.sourceObjectId !== null) requireObjectId(row.sourceObjectId, '/payload/sourceObjectId', issues); if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, entryId: row.entryId as string, label, ...(row.sourceObjectId === undefined ? {} : { sourceObjectId: row.sourceObjectId as CoreObjectId | null }), manualMode: row.manualMode as 'structured' | 'freeform' }); }
    } else if (kind === 'table-manual-resolve') {
      const row = requireRecord(['kind', 'entryId', 'manualMode'], ['entryId']); if (row) { if (row.entryId !== undefined) requireApplicationId(row.entryId, '/payload/entryId', issues); if (row.manualMode !== 'structured' && row.manualMode !== 'freeform') issues.push(issue('INVALID_LITERAL', '/payload/manualMode', 'Invalid manual mode')); payload = Object.freeze({ kind, ...(row.entryId === undefined ? {} : { entryId: row.entryId as string }), manualMode: row.manualMode as 'structured' | 'freeform' }); }
    } else if (kind === 'table-turn-progress') {
      const row = requireRecord(['kind', 'transition']); if (row) { const transition = normalizeTabletopTransition(row.transition, '/payload/transition', issues); if (transition !== null) payload = Object.freeze({ kind, transition: transition as CoreTabletopTurnPayloadV1['transition'] }); }
    } else issues.push(issue('UNKNOWN_PAYLOAD_KIND', '/payload/kind', 'Unknown Core command payload kind'));
  }
  if (issues.length || !context || !payload) return { ok: false, issues: sorted(issues) };
  return { ok: true, value: Object.freeze({ kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: root.sequence as number, actorPlayerId: root.actorPlayerId as CorePlayerId, decisionMakerPlayerId: root.decisionMakerPlayerId as CorePlayerId, decisionContext: context, payload }) };
}

export class CoreCommandCreationErrorV1 extends Error {
  readonly issues: readonly CoreCommandValidationIssueV1[];
  constructor(issues: readonly CoreCommandValidationIssueV1[]) { super(`Invalid Core command (${issues.length} issue(s))`); this.name = 'CoreCommandCreationErrorV1'; this.issues = Object.freeze(issues.map((value) => Object.freeze({ ...value }))); Object.freeze(this); }
}
export function createCoreCommandV1(input: Omit<CoreCommandV1, 'kind'>): CoreCommandV1 {
  const issues: CoreCommandValidationIssueV1[] = [];
  const fields = exact(input, ['schemaVersion', 'sequence', 'actorPlayerId', 'decisionMakerPlayerId', 'decisionContext', 'payload'], '', issues);
  if (!fields || issues.length > 0) throw new CoreCommandCreationErrorV1(sorted(issues));
  const candidate = Object.freeze({ kind: 'mode-neutral-core-command-v1' as const, schemaVersion: fields.schemaVersion, sequence: fields.sequence, actorPlayerId: fields.actorPlayerId, decisionMakerPlayerId: fields.decisionMakerPlayerId, decisionContext: fields.decisionContext, payload: fields.payload });
  const result = validateCoreCommandV1(candidate);
  if (!result.ok) throw new CoreCommandCreationErrorV1(result.issues);
  return result.value;
}
