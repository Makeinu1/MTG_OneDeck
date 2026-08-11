import type { CoreDomainEventV1 } from './domainEventV1';
import type { CoreCommandV1 } from './commandV1';
import type { CoreCommandResultV1 } from './commandResultV1';
import type { ModeNeutralCoreRootV1 } from './rootV1';
import type { CoreClosureVersionVectorV1 } from './versionsV1';
import { CORE_CLOSURE_VERSION_VECTOR_V1, isCoreClosureVersionVectorV1 } from './versionsV1';
import { validateCoreCommandV1 } from './commandV1';
import { validateModeNeutralCoreRootV1 } from './rootValidationV1';
import { coreCanonicalDigestFromValueV1, serializeCoreDomainEventsV1 } from './canonicalV1';
import { applyCoreCommandV1 } from './applyCommandV1';

export type CoreCommandJournalEntryV1 = Readonly<{
  readonly kind: 'mode-neutral-core-command-journal-entry-v1';
  readonly command: CoreCommandV1;
  readonly commandDigest: string;
  readonly status: CoreCommandResultV1['status'];
  readonly beforeStateDigest: string;
  readonly afterStateDigest: string;
  readonly eventDigest: string;
}>;

export type CoreReplayPackageV1 = Readonly<{
  readonly kind: 'mode-neutral-core-replay-package-v1';
  readonly versions: CoreClosureVersionVectorV1;
  readonly initialRoot: ModeNeutralCoreRootV1;
  readonly journal: readonly CoreCommandJournalEntryV1[];
  readonly expectedFinalStateDigest: string;
  readonly expectedEventTranscriptDigest: string;
}>;

export type CoreJournalValidationIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;
export type CoreJournalValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: CoreCommandJournalEntryV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly CoreJournalValidationIssueV1[] }>;
export type CoreReplayPackageValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: CoreReplayPackageV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly CoreJournalValidationIssueV1[] }>;

function issue(code: string, path: string, message: string): CoreJournalValidationIssueV1 { return Object.freeze({ code, path, message }); }
function frozenIssues(values: readonly CoreJournalValidationIssueV1[]): readonly CoreJournalValidationIssueV1[] { return Object.freeze(values.slice().sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : left.code < right.code ? -1 : 1).map((value) => Object.freeze({ ...value }))); }
function digestEvents(events: readonly CoreDomainEventV1[]): string { return coreCanonicalDigestFromValueV1(JSON.parse(serializeCoreDomainEventsV1(events)) as unknown); }
function plain(value: unknown): value is Record<string, unknown> {
  try { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null); } catch { return false; }
}
function exact(value: unknown, fields: readonly string[], path: string, issues: CoreJournalValidationIssueV1[], requiredFields: readonly string[] = fields): Record<string, unknown> | null {
  if (!plain(value)) { issues.push(issue('INVALID_TYPE', path, 'Expected a plain record')); return null; }
  let keys: readonly PropertyKey[]; try { keys = Reflect.ownKeys(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Record keys are not readable')); return null; }
  const expected = new Set(fields); const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== 'string' || !expected.has(key)) { issues.push(issue('UNKNOWN_FIELD', `${path}/${typeof key === 'string' ? key : '[symbol]'}`, 'Unknown field')); continue; }
    let descriptor: PropertyDescriptor | undefined; try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field must be an enumerable data property'));
    else result[key] = descriptor.value;
  }
  for (const field of requiredFields) if (!Object.prototype.hasOwnProperty.call(result, field)) issues.push(issue('MISSING_FIELD', `${path}/${field}`, 'Required field is missing'));
  return result;
}
function dense(value: unknown, path: string, issues: CoreJournalValidationIssueV1[]): readonly unknown[] | null {
  let array: boolean; try { array = Array.isArray(value); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe')); return null; }
  if (!array) { issues.push(issue('INVALID_ARRAY', path, 'Expected an ordinary dense array')); return null; }
  let keys: readonly PropertyKey[]; let lengthDescriptor: PropertyDescriptor | undefined; let prototype: object | null;
  const objectValue = value as object;
  try { keys = Reflect.ownKeys(objectValue); lengthDescriptor = Object.getOwnPropertyDescriptor(objectValue, 'length'); prototype = Reflect.getPrototypeOf(objectValue); } catch { issues.push(issue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable')); return null; }
  if (prototype !== Array.prototype) issues.push(issue('INVALID_TYPE', path, 'Expected an ordinary array'));
  const lengthRecord = lengthDescriptor && 'value' in lengthDescriptor ? lengthDescriptor as unknown as Record<string, unknown> : null;
  const length = lengthRecord?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) { issues.push(issue('INVALID_ARRAY', `${path}/length`, 'Array length must be a non-negative safe integer')); return null; }
  const expected = new Set<string>(); for (let index = 0; index < length; index += 1) expected.add(String(index));
  for (const key of keys) if (key !== 'length' && (typeof key !== 'string' || !expected.has(key))) issues.push(issue('UNKNOWN_FIELD', `${path}/${typeof key === 'string' ? key : '[symbol]'}`, 'Arrays must be dense and have no extra fields'));
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined; try { descriptor = Object.getOwnPropertyDescriptor(objectValue, String(index)); } catch { issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry descriptor is not readable')); continue; }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entries must be enumerable data properties'));
    else { const descriptorRecord = descriptor as unknown as Record<string, unknown>; result.push(descriptorRecord.value); }
  }
  return result;
}
function digest(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) return null;
  return value;
}

export function appendCoreCommandJournalEntryV1(journal: readonly CoreCommandJournalEntryV1[], command: CoreCommandV1, result: CoreCommandResultV1): readonly CoreCommandJournalEntryV1[] {
  const checkedCommand = validateCoreCommandV1(command);
  if (!checkedCommand.ok) throw new Error('Journal command is invalid');
  const entry: CoreCommandJournalEntryV1 = Object.freeze({ kind: 'mode-neutral-core-command-journal-entry-v1', command: checkedCommand.value, commandDigest: coreCanonicalDigestFromValueV1(checkedCommand.value), status: result.status, beforeStateDigest: result.beforeStateDigest, afterStateDigest: result.afterStateDigest, eventDigest: digestEvents(result.events) });
  return Object.freeze([...journal, entry]);
}

export function validateCoreCommandJournalEntryV1(value: unknown): CoreJournalValidationResultV1 {
  const issues: CoreJournalValidationIssueV1[] = [];
  const record = exact(value, ['kind', 'command', 'commandDigest', 'status', 'beforeStateDigest', 'afterStateDigest', 'eventDigest'], '', issues);
  if (!record) return { ok: false, issues: frozenIssues(issues) };
  if (record.kind !== 'mode-neutral-core-command-journal-entry-v1') issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid journal entry kind'));
  const command = validateCoreCommandV1(record.command);
  if (!command.ok) issues.push(...command.issues.map((current) => issue(current.code, `/command${current.path}`, current.message)));
  if (record.status !== 'accepted' && record.status !== 'accepted-with-warning' && record.status !== 'rejected') issues.push(issue('INVALID_LITERAL', '/status', 'Invalid journal status'));
  for (const field of ['commandDigest', 'beforeStateDigest', 'afterStateDigest', 'eventDigest']) if (digest(record[field]) === null) issues.push(issue('INVALID_DIGEST', `/${field}`, 'Digest must be lowercase SHA-256 hexadecimal'));
  if (issues.length || !command.ok) return { ok: false, issues: frozenIssues(issues) };
  return { ok: true, value: Object.freeze({ kind: 'mode-neutral-core-command-journal-entry-v1', command: command.value, commandDigest: record.commandDigest as string, status: record.status as CoreCommandResultV1['status'], beforeStateDigest: record.beforeStateDigest as string, afterStateDigest: record.afterStateDigest as string, eventDigest: record.eventDigest as string }) };
}

export function createCoreReplayPackageV1(initialRoot: ModeNeutralCoreRootV1, journal: readonly CoreCommandJournalEntryV1[]): CoreReplayPackageV1 {
  const checked = validateModeNeutralCoreRootV1(initialRoot);
  if (!checked.ok) throw new Error('Initial root is invalid');
  const entries = journal.map((entry) => { const result = validateCoreCommandJournalEntryV1(entry); if (!result.ok) throw new Error('Journal entry is invalid'); return result.value; });
  let finalRoot = checked.value;
  const events: CoreDomainEventV1[] = [];
  for (const entry of entries) {
    if (coreCanonicalDigestFromValueV1(entry.command) !== entry.commandDigest) throw new Error('Journal command digest does not match command');
    const result = applyCoreCommandV1(finalRoot, entry.command);
    if (result.status !== entry.status || result.beforeStateDigest !== entry.beforeStateDigest || result.afterStateDigest !== entry.afterStateDigest || digestEvents(result.events) !== entry.eventDigest) throw new Error('Journal evidence does not match deterministic command application');
    if (result.status !== 'rejected') finalRoot = result.root;
    events.push(...result.events);
  }
  return Object.freeze({ kind: 'mode-neutral-core-replay-package-v1', versions: Object.freeze({ ...CORE_CLOSURE_VERSION_VECTOR_V1 }), initialRoot: checked.value, journal: Object.freeze(entries), expectedFinalStateDigest: coreCanonicalDigestFromValueV1(finalRoot), expectedEventTranscriptDigest: coreCanonicalDigestFromValueV1(events) });
}

export function validateCoreReplayPackageV1(value: unknown): CoreReplayPackageValidationResultV1 {
  const issues: CoreJournalValidationIssueV1[] = [];
  const record = exact(value, ['kind', 'versions', 'initialRoot', 'journal', 'expectedFinalStateDigest', 'expectedEventTranscriptDigest'], '', issues);
  if (!record) return { ok: false, issues: frozenIssues(issues) };
  if (record.kind !== 'mode-neutral-core-replay-package-v1') issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid replay package kind'));
  const versionRecord = exact(record.versions, ['coreStateSchemaVersion', 'coreCommandSchemaVersion', 'coreEventSchemaVersion', 'coreReplaySchemaVersion'], '/versions', issues);
  if (!versionRecord || !isCoreClosureVersionVectorV1(versionRecord)) issues.push(issue('INVALID_VERSION', '/versions', 'Invalid replay package version'));
  const root = validateModeNeutralCoreRootV1(record.initialRoot);
  if (!root.ok) issues.push(...root.issues.map((current) => issue(current.code, `/initialRoot${current.path}`, current.message)));
  const rawJournal = dense(record.journal, '/journal', issues);
  const journal: CoreCommandJournalEntryV1[] = [];
  if (rawJournal) for (let index = 0; index < rawJournal.length; index += 1) { const result = validateCoreCommandJournalEntryV1(rawJournal[index]); if (!result.ok) issues.push(...result.issues.map((current) => Object.freeze({ ...current, path: `/journal/${index}${current.path}` }))); else journal.push(result.value); }
  if (root.ok) {
    let expectedSequence = root.value.acceptedCommandCount + 1;
    for (let index = 0; index < journal.length; index += 1) {
      if (journal[index].command.sequence !== expectedSequence) issues.push(issue('SEQUENCE_MISMATCH', `/journal/${index}/command/sequence`, 'Journal command sequence must follow accepted entries'));
      if (journal[index].status !== 'rejected') expectedSequence += 1;
    }
  }
  for (const field of ['expectedFinalStateDigest', 'expectedEventTranscriptDigest']) if (digest(record[field]) === null) issues.push(issue('INVALID_DIGEST', `/${field}`, 'Digest must be lowercase SHA-256 hexadecimal'));
  if (issues.length || !root.ok) return { ok: false, issues: frozenIssues(issues) };
  return { ok: true, value: Object.freeze({ kind: 'mode-neutral-core-replay-package-v1', versions: Object.freeze({ ...(versionRecord as CoreClosureVersionVectorV1) }), initialRoot: root.value, journal: Object.freeze(journal), expectedFinalStateDigest: record.expectedFinalStateDigest as string, expectedEventTranscriptDigest: record.expectedEventTranscriptDigest as string }) };
}
