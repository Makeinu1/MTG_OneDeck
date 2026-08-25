import {
  validateCoreCommandV1,
  type CoreCommandV1,
} from '../../engine/core/index';
import {
  isOnlineProtocolCommandIdV1,
} from '../protocol/index';
import {
  GAME_INTENT_SCHEMA_VERSION_V1,
  type GameIntentV1,
} from './types';

const INTENT_FIELDS = ['kind', 'schemaVersion', 'commandId', 'baseRevision', 'command'] as const;

export type GameIntentValidationIssueV1 = Readonly<{
  readonly code: string;
  readonly path: string;
  readonly message: string;
}>;

export type GameIntentValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: GameIntentV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly GameIntentValidationIssueV1[] }>;

function issue(code: string, path: string, message: string): GameIntentValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

function readExactIntent(input: unknown, issues: GameIntentValidationIssueV1[]): Record<string, unknown> | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    issues.push(issue('INVALID_ROOT', '', 'Expected an exact intent record'));
    return null;
  }
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    prototype = Reflect.getPrototypeOf(input);
    keys = Reflect.ownKeys(input);
  } catch {
    issues.push(issue('INVALID_DESCRIPTOR', '', 'Intent descriptors are not readable'));
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    issues.push(issue('INVALID_ROOT', '', 'Expected an exact intent record'));
    return null;
  }
  const allowed = new Set<string>(INTENT_FIELDS);
  const record = Object.create(null) as Record<string, unknown>;
  const present = new Set<string>();
  for (const key of keys) {
    const path = typeof key === 'string' ? `/${key}` : '/<symbol>';
    if (typeof key !== 'string' || !allowed.has(key)) {
      issues.push(issue('UNKNOWN_FIELD', path, 'Unknown intent field'));
      continue;
    }
    present.add(key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', path, 'Intent field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(issue('INVALID_DESCRIPTOR', path, 'Intent fields must be enumerable data properties'));
      continue;
    }
    record[key] = descriptor.value;
  }
  for (const field of INTENT_FIELDS) {
    if (!present.has(field)) issues.push(issue('MISSING_FIELD', `/${field}`, 'Required intent field is missing'));
  }
  return record;
}

function freezeIssues(issues: readonly GameIntentValidationIssueV1[]): readonly GameIntentValidationIssueV1[] {
  return Object.freeze(issues.map((current) => Object.freeze({ ...current })));
}

export function validateGameIntentV1(input: unknown): GameIntentValidationResultV1 {
  try {
    const issues: GameIntentValidationIssueV1[] = [];
    const record = readExactIntent(input, issues);
    if (record === null) return Object.freeze({ ok: false as const, issues: freezeIssues(issues) });
    if (record.kind !== 'game-intent-v1') issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid intent kind'));
    if (record.schemaVersion !== GAME_INTENT_SCHEMA_VERSION_V1) issues.push(issue('INVALID_VERSION', '/schemaVersion', 'Unsupported intent version'));

    let commandId = null as GameIntentV1['commandId'] | null;
    if (isOnlineProtocolCommandIdV1(record.commandId)) commandId = record.commandId;
    else issues.push(issue('INVALID_ID', '/commandId', 'Invalid command ID'));

    let baseRevision = null as GameIntentV1['baseRevision'] | null;
    if (typeof record.baseRevision === 'number' && Number.isSafeInteger(record.baseRevision) && record.baseRevision >= 0) baseRevision = record.baseRevision;
    else issues.push(issue('INVALID_INTEGER', '/baseRevision', 'Invalid base revision'));

    let command: CoreCommandV1 | null = null;
    try {
      const checked = validateCoreCommandV1(record.command);
      if (checked.ok) command = checked.value;
      else issues.push(issue('INVALID_COMMAND', '/command', 'Invalid Core command'));
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', '/command', 'Core command is not readable'));
    }
    if (command !== null && baseRevision !== null && command.sequence !== baseRevision + 1) {
      issues.push(issue('COMMAND_SEQUENCE_MISMATCH', '/command/sequence', 'Command sequence must follow base revision'));
    }
    if (
      issues.length > 0
      || commandId === null
      || baseRevision === null
      || command === null
      || record.kind !== 'game-intent-v1'
      || record.schemaVersion !== GAME_INTENT_SCHEMA_VERSION_V1
    ) {
      return Object.freeze({ ok: false as const, issues: freezeIssues(issues) });
    }
    const value: GameIntentV1 = Object.freeze({
      kind: 'game-intent-v1',
      schemaVersion: GAME_INTENT_SCHEMA_VERSION_V1,
      commandId,
      baseRevision,
      command,
    });
    return Object.freeze({ ok: true as const, value });
  } catch {
    return Object.freeze({
      ok: false as const,
      issues: freezeIssues([issue('INVALID_DESCRIPTOR', '', 'Intent could not be inspected safely')]),
    });
  }
}
