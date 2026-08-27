import {
  ONLINE_VISIBILITY_INTENT_SCHEMA_VERSION_V1,
  type OnlineVisibilityDurationV1,
  type OnlineVisibilityIntentEnvelopeV1,
  type OnlineVisibilityValidationIssueV1,
  type OnlineVisibilityValidationResultV1,
} from './types';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const HANDLE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function issue(code: string, path: string, message: string): OnlineVisibilityValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

function plain(value: unknown): value is Record<string, unknown> {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
  } catch {
    return false;
  }
}

function exact(
  value: unknown,
  fields: readonly string[],
  required: readonly string[],
  path: string,
  issues: OnlineVisibilityValidationIssueV1[],
): Record<string, unknown> | null {
  if (!plain(value)) {
    issues.push(issue('INVALID_TYPE', path, 'Expected a plain record'));
    return null;
  }
  const out = Object.create(null) as Record<string, unknown>;
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !fields.includes(key)) {
        issues.push(issue('UNKNOWN_FIELD', `${path}/${typeof key === 'string' ? key : '[symbol]'}`, 'Unknown field'));
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) {
        issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field must be an enumerable data property'));
      } else {
        out[key] = descriptor.value;
      }
    }
  } catch {
    issues.push(issue('INVALID_DESCRIPTOR', path, 'Record descriptors are not readable'));
    return null;
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) issues.push(issue('MISSING_FIELD', `${path}/${key}`, 'Required field is missing'));
  }
  return out;
}

function array(value: unknown, path: string, issues: OnlineVisibilityValidationIssueV1[], max = 16): readonly unknown[] | null {
  try {
    // Read the array shape entirely through reflective descriptors.  In
    // particular, do not read `value.length` or indexed properties directly:
    // a hostile Proxy may expose accessors that execute code or throw.
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      issues.push(issue('INVALID_ARRAY', path, 'Expected an ordinary array'));
      return null;
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number' || !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 || lengthDescriptor.value > max) {
      issues.push(issue('INVALID_ARRAY', path, 'Array is out of bounds'));
      return null;
    }
    const length = lengthDescriptor.value;
    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (typeof key !== 'string') {
        issues.push(issue('INVALID_ARRAY', path, 'Array is out of bounds'));
        return null;
      }
      if (key === 'length') continue;
      // Only canonical dense indices are data entries.  Names such as `01`
      // (or `1e0`) are own properties too, but are not addressed by the
      // numeric index lookup below and therefore must fail closed as unknown
      // fields rather than being silently ignored.
      if (!/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= length) {
        issues.push(issue('UNKNOWN_FIELD', `${path}/${key}`, 'Unknown array field'));
      }
    }
    const out: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) {
        issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry must be data'));
      } else {
        out.push(descriptor.value);
      }
    }
    return Object.freeze(out);
  } catch {
    issues.push(issue('INVALID_ARRAY', path, 'Array shape is not readable'));
    return null;
  }
}

type NormalizedSubject =
  | Readonly<{ readonly kind: 'object'; readonly handle: string }>
  | Readonly<{ readonly kind: 'top-of-library'; readonly count: number }>;

function subject(value: unknown, path: string, issues: OnlineVisibilityValidationIssueV1[]): NormalizedSubject | null {
  const row = exact(value, ['kind', 'handle', 'count'], ['kind'], path, issues);
  if (!row) return null;
  if (row.kind === 'object') {
    const valid = typeof row.handle === 'string' && HANDLE.test(row.handle) && !Object.prototype.hasOwnProperty.call(row, 'count');
    if (!valid) {
      if (typeof row.handle !== 'string' || !HANDLE.test(row.handle)) issues.push(issue('INVALID_ID', `${path}/handle`, 'Invalid projected object handle'));
      if (Object.prototype.hasOwnProperty.call(row, 'count')) issues.push(issue('UNKNOWN_FIELD', `${path}/count`, 'Object subject has no count'));
      return null;
    }
    return Object.freeze({ kind: 'object', handle: row.handle as string });
  }
  if (row.kind === 'top-of-library') {
    const valid = typeof row.count === 'number' && Number.isSafeInteger(row.count) && row.count >= 1 && row.count <= 10 && !Object.prototype.hasOwnProperty.call(row, 'handle');
    if (!valid) {
      if (typeof row.count !== 'number' || !Number.isSafeInteger(row.count) || row.count < 1 || row.count > 10) issues.push(issue('INVALID_INTEGER', `${path}/count`, 'Library count must be 1 through 10'));
      if (Object.prototype.hasOwnProperty.call(row, 'handle')) issues.push(issue('UNKNOWN_FIELD', `${path}/handle`, 'Library subject has no handle'));
      return null;
    }
    return Object.freeze({ kind: 'top-of-library', count: row.count as number });
  }
  issues.push(issue('INVALID_LITERAL', `${path}/kind`, 'Unsupported visibility subject'));
  return null;
}

function duration(value: unknown, path: string, issues: OnlineVisibilityValidationIssueV1[]): OnlineVisibilityDurationV1 | null {
  const row = exact(value, ['kind', 'sourceHandle', 'searchSessionId'], ['kind'], path, issues);
  if (!row) return null;
  if (row.kind === 'next-command' || row.kind === 'end-of-turn') {
    if (Object.keys(row).length !== 1) {
      issues.push(issue('UNKNOWN_FIELD', path, 'Duration has fields for another kind'));
      return null;
    }
    return Object.freeze({ kind: row.kind });
  }
  if (row.kind === 'source-bound') {
    const valid = typeof row.sourceHandle === 'string' && HANDLE.test(row.sourceHandle) && !Object.prototype.hasOwnProperty.call(row, 'searchSessionId');
    if (!valid) {
      if (typeof row.sourceHandle !== 'string' || !HANDLE.test(row.sourceHandle)) issues.push(issue('INVALID_ID', `${path}/sourceHandle`, 'Invalid projected source handle'));
      if (Object.prototype.hasOwnProperty.call(row, 'searchSessionId')) issues.push(issue('UNKNOWN_FIELD', `${path}/searchSessionId`, 'Source duration has no session'));
      return null;
    }
    return Object.freeze({ kind: 'source-bound', sourceHandle: row.sourceHandle as string });
  }
  if (row.kind === 'choice-bound') {
    const valid = typeof row.searchSessionId === 'string' && ID.test(row.searchSessionId) && !Object.prototype.hasOwnProperty.call(row, 'sourceHandle');
    if (!valid) {
      if (typeof row.searchSessionId !== 'string' || !ID.test(row.searchSessionId)) issues.push(issue('INVALID_ID', `${path}/searchSessionId`, 'Invalid projected search-session handle'));
      if (Object.prototype.hasOwnProperty.call(row, 'sourceHandle')) issues.push(issue('UNKNOWN_FIELD', `${path}/sourceHandle`, 'Choice duration has no source'));
      return null;
    }
    return Object.freeze({ kind: 'choice-bound', searchSessionId: row.searchSessionId as string });
  }
  issues.push(issue('INVALID_LITERAL', `${path}/kind`, 'Unsupported visibility duration'));
  return null;
}

export function validateOnlineVisibilityIntentV1(input: unknown): OnlineVisibilityValidationResultV1 {
  const issues: OnlineVisibilityValidationIssueV1[] = [];
  const root = exact(input, ['kind', 'schemaVersion', 'commandId', 'baseRevision', 'look', 'reveal', 'choose'], ['kind', 'schemaVersion', 'commandId', 'baseRevision'], '', issues);
  if (!root) return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  if (root.kind !== 'online-visibility-intent-v1') issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid visibility intent kind'));
  if (root.schemaVersion !== ONLINE_VISIBILITY_INTENT_SCHEMA_VERSION_V1) issues.push(issue('INVALID_VERSION', '/schemaVersion', 'Unsupported visibility intent version'));
  if (typeof root.commandId !== 'string' || !ID.test(root.commandId)) issues.push(issue('INVALID_ID', '/commandId', 'Invalid command ID'));
  if (typeof root.baseRevision !== 'number' || !Number.isSafeInteger(root.baseRevision) || root.baseRevision < 0) issues.push(issue('INVALID_INTEGER', '/baseRevision', 'Invalid base revision'));
  const branches = ['look', 'reveal', 'choose'].filter((key) => Object.prototype.hasOwnProperty.call(root, key));
  if (branches.length !== 1) issues.push(issue('INVALID_LITERAL', '', 'Exactly one visibility operation is required'));

  let normalizedLook: OnlineVisibilityIntentEnvelopeV1['look'] | undefined;
  let normalizedReveal: OnlineVisibilityIntentEnvelopeV1['reveal'] | undefined;
  let normalizedChoose: OnlineVisibilityIntentEnvelopeV1['choose'] | undefined;
  if (root.look !== undefined) {
    const row = exact(root.look, ['subject', 'viewerPlayerIds', 'duration'], ['subject', 'viewerPlayerIds', 'duration'], '/look', issues);
    const checkedSubject = row ? subject(row.subject, '/look/subject', issues) : null;
    const viewers = row ? array(row.viewerPlayerIds, '/look/viewerPlayerIds', issues, 8) : null;
    let validViewers = viewers !== null && viewers.length > 0;
    if (viewers === null || viewers.length === 0) issues.push(issue('INVALID_ARRAY', '/look/viewerPlayerIds', 'Look requires at least one viewer'));
    const seen = new Set<string>();
    viewers?.forEach((id, index) => {
      if (typeof id !== 'string' || !ID.test(id)) { issues.push(issue('INVALID_ID', `/look/viewerPlayerIds/${index}`, 'Invalid viewer ID')); validViewers = false; }
      else if (seen.has(id)) { issues.push(issue('DUPLICATE_VALUE', `/look/viewerPlayerIds/${index}`, 'Duplicate viewer')); validViewers = false; }
      else seen.add(id);
    });
    const checkedDuration = row ? duration(row.duration, '/look/duration', issues) : null;
    if (row && checkedSubject !== null && checkedDuration !== null && viewers !== null && validViewers) {
      // Canonicalize audience order so equivalent intents have identical
      // outbox bytes and retry fingerprints regardless of UI selection order.
      const canonicalViewers = (viewers as string[]).slice().sort();
      normalizedLook = Object.freeze({ subject: checkedSubject, viewerPlayerIds: Object.freeze(canonicalViewers), duration: checkedDuration });
    }
  } else if (Object.prototype.hasOwnProperty.call(root, 'look')) {
    issues.push(issue('INVALID_TYPE', '/look', 'Look branch must be a record'));
  }
  if (root.reveal !== undefined) {
    const row = exact(root.reveal, ['subject', 'duration'], ['subject', 'duration'], '/reveal', issues);
    const checkedSubject = row ? subject(row.subject, '/reveal/subject', issues) : null;
    const checkedDuration = row ? duration(row.duration, '/reveal/duration', issues) : null;
    if (row && checkedSubject !== null && checkedDuration !== null) normalizedReveal = Object.freeze({ subject: checkedSubject, duration: checkedDuration });
  } else if (Object.prototype.hasOwnProperty.call(root, 'reveal')) {
    issues.push(issue('INVALID_TYPE', '/reveal', 'Reveal branch must be a record'));
  }
  if (root.choose !== undefined) {
    const row = exact(root.choose, ['searchSessionId', 'candidateHandles'], ['searchSessionId', 'candidateHandles'], '/choose', issues);
    if (row) {
      const validSession = typeof row.searchSessionId === 'string' && ID.test(row.searchSessionId);
      if (!validSession) issues.push(issue('INVALID_ID', '/choose/searchSessionId', 'Invalid search session handle'));
      const values = array(row.candidateHandles, '/choose/candidateHandles', issues, 10_000);
      let validCandidates = values !== null;
      const seen = new Set<string>();
      values?.forEach((entry, index) => {
        if (typeof entry !== 'string' || !HANDLE.test(entry)) { issues.push(issue('INVALID_ID', `/choose/candidateHandles/${index}`, 'Invalid candidate handle')); validCandidates = false; }
        else if (seen.has(entry)) { issues.push(issue('DUPLICATE_VALUE', `/choose/candidateHandles/${index}`, 'Duplicate candidate')); validCandidates = false; }
        else seen.add(entry);
      });
      if (validSession && validCandidates && values !== null) {
        const canonicalCandidates = (values as string[]).slice().sort();
        normalizedChoose = Object.freeze({ searchSessionId: row.searchSessionId as string, candidateHandles: Object.freeze(canonicalCandidates) });
      }
    }
  } else if (Object.prototype.hasOwnProperty.call(root, 'choose')) {
    issues.push(issue('INVALID_TYPE', '/choose', 'Choose branch must be a record'));
  }
  if (issues.length > 0) return Object.freeze({ ok: false, issues: Object.freeze(issues.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code))) });
  const result: OnlineVisibilityIntentEnvelopeV1 = Object.freeze({
    kind: 'online-visibility-intent-v1',
    schemaVersion: ONLINE_VISIBILITY_INTENT_SCHEMA_VERSION_V1,
    commandId: root.commandId as string,
    baseRevision: root.baseRevision as number,
    ...(normalizedLook === undefined ? {} : { look: normalizedLook }),
    ...(normalizedReveal === undefined ? {} : { reveal: normalizedReveal }),
    ...(normalizedChoose === undefined ? {} : { choose: normalizedChoose }),
  });
  return Object.freeze({ ok: true, value: result });
}

export const validateOnlineVisibilityIntentEnvelopeV1 = validateOnlineVisibilityIntentV1;
