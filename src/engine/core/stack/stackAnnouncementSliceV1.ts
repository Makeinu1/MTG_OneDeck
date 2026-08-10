import type { ModeNeutralCoreObjectRegistrySliceV2 } from '../object/objectRegistryStateV2';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from './stackAnnouncementValidationV1';
import type { CoreStackAnnouncementValidationIssue } from './stackAnnouncementValidationV1';
import type { CoreObjectId } from '../ids';
import type { CoreStackAnnouncementRecordV1 } from './stackAnnouncementRecordV1';

export type ModeNeutralCoreStackAnnouncementSliceV1 = Readonly<{
  readonly kind: 'mode-neutral-core-stack-announcement-slice-v1';
  readonly byObject: Readonly<Record<CoreObjectId, CoreStackAnnouncementRecordV1>>;
}>;

export type CreateModeNeutralCoreStackAnnouncementSliceV1Input = Readonly<{
  readonly byObject: Readonly<Record<string, unknown>>;
}>;

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function sortedIssues(issues: readonly CoreStackAnnouncementValidationIssue[]): readonly CoreStackAnnouncementValidationIssue[] {
  return Object.freeze(issues.slice().sort((left, right) =>
    compareCodeUnits(left.path, right.path)
    || compareCodeUnits(left.code, right.code)
    || compareCodeUnits(left.message, right.message),
  ).map((current) => Object.freeze({ ...current })));
}

export class CoreStackAnnouncementCreationError extends Error {
  readonly issues: readonly CoreStackAnnouncementValidationIssue[];

  constructor(issues: readonly CoreStackAnnouncementValidationIssue[]) {
    super(`Invalid Core stack announcement slice (${issues.length} issue(s))`);
    this.name = 'CoreStackAnnouncementCreationError';
    this.issues = sortedIssues(issues);
  }
}

export function createModeNeutralCoreStackAnnouncementSliceV1(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  input: CreateModeNeutralCoreStackAnnouncementSliceV1Input,
): ModeNeutralCoreStackAnnouncementSliceV1 {
  const candidate: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const inspectionIssues: CoreStackAnnouncementValidationIssue[] = [];
  let inputIsRecord = false;
  try { inputIsRecord = input !== null && typeof input === 'object' && !Array.isArray(input); } catch { inspectionIssues.push({ code: 'INVALID_TYPE', path: '', message: 'Factory input shape is not readable' }); }
  if (inputIsRecord) {
    let keys: readonly PropertyKey[] | null = null;
    try { keys = Reflect.ownKeys(input); } catch { inspectionIssues.push({ code: 'INVALID_TYPE', path: '', message: 'Factory input keys are not readable' }); }
    if (keys !== null) for (const key of keys) {
      if (typeof key !== 'string') { inspectionIssues.push({ code: 'UNKNOWN_FIELD', path: '/[symbol]', message: 'Symbol fields are not allowed' }); continue; }
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(input, key); } catch { inspectionIssues.push({ code: 'INVALID_TYPE', path: `/${key}`, message: 'Factory field descriptor is not readable' }); continue; }
      if (key !== 'byObject' || descriptor === undefined || descriptor.enumerable !== true || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        if (key !== 'byObject') inspectionIssues.push({ code: 'UNKNOWN_FIELD', path: `/${key}`, message: 'Factory input must contain only byObject' });
        else if (descriptor === undefined) inspectionIssues.push({ code: 'INVALID_TYPE', path: '/byObject', message: 'Factory field descriptor is not readable' });
        else if (descriptor.enumerable !== true) inspectionIssues.push({ code: 'UNKNOWN_FIELD', path: '/byObject', message: 'Fields must be enumerable' });
        else inspectionIssues.push({ code: 'INVALID_TYPE', path: '/byObject', message: 'Accessor properties are not allowed' });
        continue;
      }
      candidate.byObject = descriptor.value;
    }
  }
  candidate.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  const result = validateModeNeutralCoreStackAnnouncementSliceV1(registry, candidate);
  if (inspectionIssues.length > 0 || !result.ok) {
    const issues = inspectionIssues.concat(result.ok ? [] : result.issues);
    throw new CoreStackAnnouncementCreationError(issues);
  }
  return result.value;
}
