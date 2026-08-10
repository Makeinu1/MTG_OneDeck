import type {
  CoreTurnLifecycleValidationCodeV1,
  CoreTurnLifecycleValidationIssueV1,
  CoreTurnPositionValidationResultV1,
} from './turnLifecycleValidationV1';

export type CoreTurnPositionV1 =
  | Readonly<{ readonly phase: 'beginning'; readonly step: 'untap' | 'upkeep' | 'draw' }>
  | Readonly<{ readonly phase: 'precombat-main'; readonly step: null }>
  | Readonly<{
      readonly phase: 'combat';
      readonly step:
        | 'beginning-of-combat'
        | 'declare-attackers'
        | 'declare-blockers'
        | 'combat-damage'
        | 'end-of-combat';
    }>
  | Readonly<{ readonly phase: 'postcombat-main'; readonly step: null }>
  | Readonly<{ readonly phase: 'ending'; readonly step: 'end' | 'cleanup' }>;

type RawRecord = Record<string, unknown>;

const POSITION_FIELDS = ['phase', 'step'] as const;
const BEGINNING_STEPS = ['untap', 'upkeep', 'draw'] as const;
const COMBAT_STEPS = [
  'beginning-of-combat',
  'declare-attackers',
  'declare-blockers',
  'combat-damage',
  'end-of-combat',
] as const;
const PHASES = ['beginning', 'precombat-main', 'combat', 'postcombat-main', 'ending'] as const;

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function escapePointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pointer(path: string, segment: string): string {
  return `${path}/${escapePointerSegment(segment)}`;
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

function isDataDescriptor(descriptor: PropertyDescriptor | undefined): { readonly value: unknown } | null {
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
  return { value: descriptor.value };
}

class IssueCollector {
  private readonly values: CoreTurnLifecycleValidationIssueV1[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreTurnLifecycleValidationCodeV1, path: string, message: string): void {
    const identity = `${path}\u0000${code}`;
    if (this.seen.has(identity)) return;
    this.seen.add(identity);
    this.values.push(Object.freeze({ code, path, message }));
  }

  sorted(): readonly CoreTurnLifecycleValidationIssueV1[] {
    return Object.freeze(this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path)
      || codeUnitCompare(left.code, right.code)
      || codeUnitCompare(left.message, right.message)));
  }
}

function readRecord(
  value: unknown,
  issues: IssueCollector,
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_ROOT', '', 'Expected a plain turn position object');
    return null;
  }

  let keys: readonly (string | symbol)[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issues.add('INVALID_ROOT', '', 'Turn position descriptors are not readable');
    return null;
  }

  const expected = new Set<string>(POSITION_FIELDS);
  const result = Object.create(null) as RawRecord;
  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', `${''}/[symbol]`, 'Symbol fields are not allowed');
      continue;
    }
    const fieldPath = pointer('', key);
    if (!expected.has(key)) {
      issues.add('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`);
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.add('INVALID_TYPE', fieldPath, 'Field descriptor is not readable');
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      issues.add('UNKNOWN_FIELD', fieldPath, 'Fields must be enumerable');
      continue;
    }
    const data = isDataDescriptor(descriptor);
    if (data === null) {
      issues.add('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed');
      continue;
    }
    result[key] = data.value;
  }

  for (const field of POSITION_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.add('MISSING_FIELD', pointer('', field), `Missing field: ${field}`);
    }
  }
  return result;
}

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && choices.includes(value as T);
}

function validatePositionValues(root: RawRecord, issues: IssueCollector): void {
  const phase = root.phase;
  if (typeof phase !== 'string') {
    issues.add('INVALID_TYPE', '/phase', 'Expected a phase literal');
    return;
  }
  if (!PHASES.includes(phase as (typeof PHASES)[number])) {
    issues.add('INVALID_LITERAL', '/phase', 'Unknown turn phase');
    return;
  }

  const step = root.step;
  if (phase === 'beginning') {
    if (typeof step !== 'string') {
      issues.add('INVALID_TYPE', '/step', 'Beginning phase requires a step literal');
    } else if (!isOneOf(step, BEGINNING_STEPS)) {
      issues.add('INVALID_POSITION', '/step', 'Step is not valid for beginning phase');
    }
    return;
  }

  if (phase === 'combat') {
    if (typeof step !== 'string') {
      issues.add('INVALID_TYPE', '/step', 'Combat phase requires a step literal');
    } else if (!isOneOf(step, COMBAT_STEPS)) {
      issues.add('INVALID_POSITION', '/step', 'Step is not valid for combat phase');
    }
    return;
  }

  if (phase === 'ending') {
    if (typeof step !== 'string') {
      issues.add('INVALID_TYPE', '/step', 'Ending phase requires a step literal');
    } else if (step !== 'end' && step !== 'cleanup') {
      issues.add('INVALID_POSITION', '/step', 'Step is not valid for ending phase');
    }
    return;
  }

  if (step !== null) {
    if (typeof step === 'string') {
      issues.add('INVALID_POSITION', '/step', `${phase} requires a null step`);
    } else {
      issues.add('INVALID_TYPE', '/step', `${phase} requires a null step`);
    }
  }
}

function freezePosition(root: RawRecord): CoreTurnPositionV1 {
  const phase = root.phase;
  const step = root.step;
  return Object.freeze({ phase, step }) as CoreTurnPositionV1;
}

export function validateCoreTurnPositionV1(
  input: unknown,
): CoreTurnPositionValidationResultV1 {
  const issues = new IssueCollector();
  const root = readRecord(input, issues);
  if (root === null) return Object.freeze({ ok: false, issues: issues.sorted() });

  validatePositionValues(root, issues);
  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0) return Object.freeze({ ok: false, issues: sortedIssues });
  return Object.freeze({ ok: true, value: freezePosition(root) });
}

export type {
  CoreTurnLifecycleValidationCodeV1,
  CoreTurnLifecycleValidationIssueV1,
  CoreTurnPositionValidationResultV1,
};
