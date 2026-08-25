import {
  createCoreCommanderDamageProvenanceLedgerV1,
} from '../commander/commanderDamageProvenanceV1';
import {
  createCoreCommanderDamageStateV1,
} from '../commander/commanderDamageV1';
import { createCoreCommanderIdentityV1, type CoreCommanderIdentityV1 } from '../commander/commanderIdentityV1';
import { createCoreCommanderCastLedgerV1, type CoreCommanderCastLedgerV1 } from '../commander/commanderTaxV1';
import { createCoreCombatContextV1, type CoreCombatContextV1 } from '../combat/combatContextV1';
import {
  createCorePlayerLifecycleStateV1,
  type CorePlayerLifecycleStateV1,
} from '../player-lifecycle/playerLifecycleV1';
import {
  createCoreRuleAuthorityBundleV1,
} from '../rules/ruleAuthorityBundleV1';
import type { CoreClosureVersionVectorV1 } from './versionsV1';
import { isCoreClosureVersionVectorV1 } from './versionsV1';
import type { ModeNeutralCoreRootV1 } from './rootV1';

export type CoreRootValidationIssueV1 = Readonly<{
  readonly code: string;
  readonly path: string;
  readonly message: string;
}>;
export type CoreRootValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: ModeNeutralCoreRootV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly CoreRootValidationIssueV1[] }>;

const ROOT_FIELDS = [
  'kind', 'versions', 'acceptedCommandCount', 'ruleAuthority', 'playerLifecycle', 'commanders',
  'commanderCastLedgers', 'commanderDamage', 'commanderDamageProvenance', 'combatContext',
] as const;

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function issue(code: string, path: string, message: string): CoreRootValidationIssueV1 {
  return Object.freeze({ code, path, message });
}
function sorted(issues: readonly CoreRootValidationIssueV1[]): readonly CoreRootValidationIssueV1[] {
  return Object.freeze(issues.slice().sort((left, right) => compare(left.path, right.path) || compare(left.code, right.code)));
}
function plain(value: unknown): value is Record<string, unknown> {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
  } catch { return false; }
}
function readExact(value: unknown, fields: readonly string[], path: string, issues: CoreRootValidationIssueV1[]): Record<string, unknown> | null {
  if (!plain(value)) { issues.push(issue('INVALID_TYPE', path, 'Expected a plain record')); return null; }
  let keys: readonly PropertyKey[];
  try { keys = Reflect.ownKeys(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Record keys are not readable')); return null; }
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const expected = new Set(fields);
  for (const key of keys) {
    if (typeof key !== 'string') { issues.push(issue('UNKNOWN_FIELD', `${path}/[symbol]`, 'Symbol fields are not allowed')); continue; }
    if (!expected.has(key)) { issues.push(issue('UNKNOWN_FIELD', `${path}/${key}`, 'Unknown field')); continue; }
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field must be an enumerable data property')); continue; }
    result[key] = descriptor.value;
  }
  for (const field of fields) if (!Object.prototype.hasOwnProperty.call(result, field)) issues.push(issue('MISSING_FIELD', `${path}/${field}`, 'Required field is missing'));
  return result;
}
function dense(value: unknown, path: string, issues: CoreRootValidationIssueV1[]): readonly unknown[] | null {
  let array: boolean;
  try { array = Array.isArray(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe')); return null; }
  if (!array) { issues.push(issue('INVALID_ARRAY', path, 'Expected an array')); return null; }
  const objectValue = value as object;
  let keys: readonly PropertyKey[];
  let length: number;
  try {
    keys = Reflect.ownKeys(objectValue);
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, 'length');
    if (descriptor === undefined || !('value' in descriptor) || typeof descriptor.value !== 'number') throw new Error();
    length = descriptor.value;
  } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable')); return null; }
  if (!Number.isSafeInteger(length) || length < 0) { issues.push(issue('INVALID_ARRAY', `${path}/length`, 'Array length must be a non-negative safe integer')); return null; }
  const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
  for (const key of keys) if (typeof key !== 'string' || !allowed.has(key)) issues.push(issue('UNKNOWN_FIELD', `${path}/${String(key)}`, 'Array has an unknown field'));
  const output: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(objectValue, String(index)); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry must be an enumerable data property'));
    else output.push(descriptor.value);
  }
  return output;
}
function nestedIssues(error: unknown, path: string): readonly CoreRootValidationIssueV1[] {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { readonly issues?: unknown }).issues;
    if (Array.isArray(issues)) return issues.map((entry) => {
      if (entry && typeof entry === 'object') {
        const row = entry as Record<string, unknown>;
        return issue(typeof row.code === 'string' ? row.code : 'INVALID_VALUE', `${path}${typeof row.path === 'string' ? row.path : ''}`, typeof row.message === 'string' ? row.message : 'Nested value is invalid');
      }
      return issue('INVALID_VALUE', path, 'Nested value is invalid');
    });
  }
  return [issue('INVALID_VALUE', path, 'Nested value is invalid')];
}
function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
function samePlayerSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === left.length && rightSet.size === right.length
    && left.every((id) => rightSet.has(id));
}
function active(lifecycle: CorePlayerLifecycleStateV1, playerId: string): boolean {
  return lifecycle.players.some((entry) => entry.playerId === playerId && entry.status === 'active');
}
function nested<T>(factory: () => T, path: string, issues: CoreRootValidationIssueV1[]): T | null {
  try { return factory(); } catch (error: unknown) { issues.push(...nestedIssues(error, path)); return null; }
}

export function validateModeNeutralCoreRootV1(input: unknown): CoreRootValidationResultV1 {
  const issues: CoreRootValidationIssueV1[] = [];
  const root = readExact(input, ROOT_FIELDS, '', issues);
  if (root === null) return { ok: false, issues: sorted(issues) };
  if (root.kind !== 'mode-neutral-core-root-v1') issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid Core root kind'));
  if (!isCoreClosureVersionVectorV1(root.versions)) issues.push(issue('INVALID_VERSION', '/versions', 'Invalid Core closure version vector'));
  if (typeof root.acceptedCommandCount !== 'number' || !Number.isSafeInteger(root.acceptedCommandCount) || root.acceptedCommandCount < 0) issues.push(issue('INVALID_INTEGER', '/acceptedCommandCount', 'Accepted command count must be a non-negative safe integer'));
  const ruleAuthority = nested(() => createCoreRuleAuthorityBundleV1(root.ruleAuthority as Parameters<typeof createCoreRuleAuthorityBundleV1>[0]), '/ruleAuthority', issues);
  const playerLifecycle = nested(() => createCorePlayerLifecycleStateV1(root.playerLifecycle), '/playerLifecycle', issues);
  const commanderValues = dense(root.commanders, '/commanders', issues);
  const ledgerValues = dense(root.commanderCastLedgers, '/commanderCastLedgers', issues);
  const commanders: CoreCommanderIdentityV1[] = [];
  const ledgers: CoreCommanderCastLedgerV1[] = [];
  for (const [index, value] of (commanderValues ?? []).entries()) {
    const current = nested(() => createCoreCommanderIdentityV1(value), `/commanders/${index}`, issues);
    if (current) commanders.push(current);
  }
  for (const [index, value] of (ledgerValues ?? []).entries()) {
    const current = nested(() => createCoreCommanderCastLedgerV1(value), `/commanderCastLedgers/${index}`, issues);
    if (current) ledgers.push(current);
  }
  const commanderDamage = nested(() => createCoreCommanderDamageStateV1(root.commanderDamage), '/commanderDamage', issues);
  const provenance = nested(() => createCoreCommanderDamageProvenanceLedgerV1(root.commanderDamageProvenance), '/commanderDamageProvenance', issues);
  let combatContext: CoreCombatContextV1 | null = null;
  if (root.combatContext !== null) combatContext = nested(() => createCoreCombatContextV1(root.combatContext), '/combatContext', issues);

  if (ruleAuthority && playerLifecycle) {
    const registry = ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    const registryPlayerIds = Object.keys(registry.players);
    const activeLifecyclePlayerIds = playerLifecycle.players.filter((entry) => entry.status === 'active').map((entry) => entry.playerId);
    if (!samePlayerSet(registryPlayerIds, activeLifecyclePlayerIds)) issues.push(issue('PLAYER_ROSTER_MISMATCH', '/playerLifecycle/players', 'Registry players must match the active lifecycle player set'));
    if (!samePlayerSet(registry.turnOrder, activeLifecyclePlayerIds)) issues.push(issue('TURN_ORDER_MISMATCH', '/ruleAuthority/turnPriorityBundle/stackBundle/objectRegistry/turnOrder', 'Turn order must be an exact permutation of active lifecycle players'));
    registry.turnOrder.forEach((playerId, index) => {
      if (!active(playerLifecycle, playerId)) issues.push(issue('INACTIVE_PLAYER', `/ruleAuthority/turnPriorityBundle/stackBundle/objectRegistry/turnOrder/${index}`, 'Turn-order players must be active'));
    });
    const commanderIds = new Set<string>();
    for (const [index, commander] of commanders.entries()) {
      if (commanderIds.has(commander.physicalCardId)) issues.push(issue('DUPLICATE_COMMANDER', `/commanders/${index}/physicalCardId`, 'Commander physical IDs must be unique'));
      commanderIds.add(commander.physicalCardId);
      if (!playerLifecycle.players.some((entry) => entry.playerId === commander.ownerPlayerId)) issues.push(issue('UNREGISTERED_OWNER', `/commanders/${index}/ownerPlayerId`, 'Commander owner must exist in the full lifecycle roster'));
    }
    if (ledgers.length !== commanders.length || ledgers.some((ledger, index) => ledger.commander.physicalCardId !== commanders[index]?.physicalCardId)) issues.push(issue('COMMANDER_LEDGER_MISMATCH', '/commanderCastLedgers', 'Cast ledgers must map one-to-one to root commanders'));
    const playerIds = playerLifecycle.players.map((entry) => entry.playerId);
    const damageIds = commanderDamage?.commanders.map((commander) => commander.physicalCardId) ?? [];
    const provenanceIds = provenance?.commanders.map((commander) => commander.physicalCardId) ?? [];
    if (!sameIds(damageIds, commanders.map((commander) => commander.physicalCardId)) || !sameIds(provenanceIds, damageIds)) issues.push(issue('DAMAGE_REGISTRY_MISMATCH', '/commanderDamage', 'Damage registries must match commanders'));
    if (commanderDamage && !sameIds(commanderDamage.defendingPlayerIds, playerIds)) issues.push(issue('DAMAGE_PLAYER_MISMATCH', '/commanderDamage/defendingPlayerIds', 'Damage players must match the complete lifecycle roster'));
    if (provenance && !sameIds(provenance.defendingPlayerIds, playerIds)) issues.push(issue('PROVENANCE_PLAYER_MISMATCH', '/commanderDamageProvenance/defendingPlayerIds', 'Provenance players must match the complete lifecycle roster'));
    if (combatContext) {
      for (const [index, playerId] of [combatContext.attackingPlayerId, ...combatContext.defendingPlayerIds].entries()) {
        if (!Object.prototype.hasOwnProperty.call(registry.players, playerId) || !active(playerLifecycle, playerId)) issues.push(issue('INVALID_COMBAT_PLAYER', `/combatContext/${index}`, 'Combat players must be registered and active'));
      }
      for (const attack of combatContext.attacks) if (!Object.prototype.hasOwnProperty.call(registry.objects, attack.attackerObjectId)) issues.push(issue('INVALID_COMBAT_OBJECT', '/combatContext/attacks', 'Combat object must be registered'));
      for (const block of combatContext.blocks) if (!Object.prototype.hasOwnProperty.call(registry.objects, block.blockerObjectId) || !Object.prototype.hasOwnProperty.call(registry.objects, block.attackedObjectId)) issues.push(issue('INVALID_COMBAT_OBJECT', '/combatContext/blocks', 'Combat object must be registered'));
    }
  }
  if (issues.length > 0 || !ruleAuthority || !playerLifecycle || commanderValues === null || ledgerValues === null || !commanderDamage || !provenance) return { ok: false, issues: sorted(issues) };
  const value: ModeNeutralCoreRootV1 = Object.freeze({
    kind: 'mode-neutral-core-root-v1',
    versions: Object.freeze({ ...(root.versions as CoreClosureVersionVectorV1) }),
    acceptedCommandCount: root.acceptedCommandCount as number,
    ruleAuthority,
    playerLifecycle,
    commanders: Object.freeze(commanders.slice()),
    commanderCastLedgers: Object.freeze(ledgers.slice()),
    commanderDamage,
    commanderDamageProvenance: provenance,
    combatContext,
  });
  return { ok: true, value };
}

export class CoreRootCreationErrorV1 extends Error {
  readonly issues: readonly CoreRootValidationIssueV1[];
  constructor(issues: readonly CoreRootValidationIssueV1[]) { super(`Invalid Core root (${issues.length} issue(s))`); this.name = 'CoreRootCreationErrorV1'; this.issues = Object.freeze(issues.map((value) => Object.freeze({ ...value }))); Object.freeze(this); }
}

export function createModeNeutralCoreRootV1(input: Omit<ModeNeutralCoreRootV1, 'kind'>): ModeNeutralCoreRootV1 {
  const candidate: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  try {
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== 'string') throw new CoreRootCreationErrorV1([issue('UNKNOWN_FIELD', '/[symbol]', 'Symbol fields are not allowed')]);
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) throw new CoreRootCreationErrorV1([issue('INVALID_DESCRIPTOR', `/${key}`, 'Factory fields must be enumerable data properties')]);
      candidate[key] = descriptor.value;
    }
  } catch (error: unknown) {
    if (error instanceof CoreRootCreationErrorV1) throw error;
    throw new CoreRootCreationErrorV1([issue('INVALID_DESCRIPTOR', '', 'Factory input could not be inspected safely')]);
  }
  if (Object.prototype.hasOwnProperty.call(candidate, 'kind') && candidate.kind !== 'mode-neutral-core-root-v1') throw new CoreRootCreationErrorV1([issue('UNKNOWN_FIELD', '/kind', 'Factory input must omit kind')]);
  delete candidate.kind;
  candidate.kind = 'mode-neutral-core-root-v1';
  const result = validateModeNeutralCoreRootV1(candidate);
  if (!result.ok) throw new CoreRootCreationErrorV1(result.issues);
  return result.value;
}
