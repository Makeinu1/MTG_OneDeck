export type CoreCanonicalIssueV1 = Readonly<{
  readonly code: 'INVALID_VALUE' | 'INVALID_DESCRIPTOR' | 'INVALID_ARRAY' | 'INVALID_TYPE';
  readonly path: string;
  readonly message: string;
}>;

export class CoreCanonicalizationErrorV1 extends Error {
  readonly issues: readonly CoreCanonicalIssueV1[];

  constructor(issues: readonly CoreCanonicalIssueV1[]) {
    super(`Invalid Core canonical value (${issues.length} issue(s))`);
    this.name = 'CoreCanonicalizationErrorV1';
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
    Object.freeze(this);
  }
}

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function pointer(path: string, key: string): string {
  return `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

function issue(code: CoreCanonicalIssueV1['code'], path: string, message: string): CoreCanonicalIssueV1 {
  return Object.freeze({ code, path, message });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
  } catch {
    return false;
  }
}

function cloneCanonical(value: unknown, path: string, issues: CoreCanonicalIssueV1[], ancestors: WeakSet<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    issues.push(issue('INVALID_VALUE', path, 'Numbers must be finite'));
    return null;
  }
  if (typeof value !== 'object') {
    issues.push(issue('INVALID_TYPE', path, 'Only JSON values are supported'));
    return null;
  }
  let array: boolean;
  try { array = Array.isArray(value); } catch {
    issues.push(issue('INVALID_DESCRIPTOR', path, 'Value inspection is not safe'));
    return null;
  }
  const objectValue = value;
  if (ancestors.has(objectValue)) {
    issues.push(issue('INVALID_VALUE', path, 'Circular references are not supported'));
    return null;
  }
  ancestors.add(objectValue);
  try {
    if (array) {
    const source = value as readonly unknown[];
    let keys: readonly PropertyKey[];
    let lengthDescriptor: PropertyDescriptor | undefined;
    try {
      keys = Reflect.ownKeys(source);
      lengthDescriptor = Object.getOwnPropertyDescriptor(source, 'length');
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable'));
      return null;
    }
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor)
      || typeof lengthDescriptor.value !== 'number' || lengthDescriptor.value < 0 || !Number.isSafeInteger(lengthDescriptor.value)) {
      issues.push(issue('INVALID_ARRAY', path, 'Array length is not a readable data property'));
      return null;
    }
    const length = lengthDescriptor.value;
    const expected = new Set<string>();
    for (let index = 0; index < length; index += 1) expected.add(String(index));
    for (const key of keys) {
      if (key === 'length') continue;
      if (typeof key !== 'string' || !expected.has(key)) {
        issues.push(issue('INVALID_ARRAY', pointer(path, typeof key === 'string' ? key : '[symbol]'), 'Arrays must be dense and have no extra fields'));
      }
    }
    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(source, key); } catch {
        issues.push(issue('INVALID_DESCRIPTOR', pointer(path, key), 'Array entry descriptor is not readable'));
        continue;
      }
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
        issues.push(issue('INVALID_DESCRIPTOR', pointer(path, key), 'Array entries must be enumerable data properties'));
        continue;
      }
      output.push(cloneCanonical(descriptor.value, pointer(path, key), issues, ancestors));
    }
    return Object.freeze(output);
    }
    if (!isPlainRecord(value)) {
      issues.push(issue('INVALID_TYPE', path, 'Records must be plain objects'));
      return null;
    }
    let keys: readonly PropertyKey[];
    try { keys = Reflect.ownKeys(value); } catch {
      issues.push(issue('INVALID_DESCRIPTOR', path, 'Record descriptors are not readable'));
      return null;
    }
    const stringKeys = keys.filter((key): key is string => typeof key === 'string');
    for (const key of keys) {
      if (typeof key !== 'string') issues.push(issue('INVALID_TYPE', pointer(path, '[symbol]'), 'Symbols are not supported'));
    }
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of stringKeys.sort(compareCodeUnits)) {
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch {
        issues.push(issue('INVALID_DESCRIPTOR', pointer(path, key), 'Record descriptor is not readable'));
        continue;
      }
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
        issues.push(issue('INVALID_DESCRIPTOR', pointer(path, key), 'Record fields must be enumerable data properties'));
        continue;
      }
      Object.defineProperty(output, key, {
        value: cloneCanonical(descriptor.value, pointer(path, key), issues, ancestors),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return Object.freeze(output);
  } finally {
    ancestors.delete(objectValue);
  }
}

export function canonicalizeCoreValueV1(value: unknown): unknown {
  const issues: CoreCanonicalIssueV1[] = [];
  const result = cloneCanonical(value, '', issues, new WeakSet<object>());
  if (issues.length > 0) {
    throw new CoreCanonicalizationErrorV1(Object.freeze(issues.slice().sort((left, right) =>
      compareCodeUnits(left.path, right.path) || compareCodeUnits(left.code, right.code))));
  }
  return result;
}

function appendJson(value: unknown, output: string[]): void {
  if (value === null) { output.push('null'); return; }
  if (typeof value === 'string') { output.push(JSON.stringify(value)); return; }
  if (typeof value === 'boolean') { output.push(value ? 'true' : 'false'); return; }
  if (typeof value === 'number') { output.push(Object.is(value, -0) ? '0' : String(value)); return; }
  if (Array.isArray(value)) {
    output.push('[');
    value.forEach((entry, index) => { if (index > 0) output.push(','); appendJson(entry, output); });
    output.push(']');
    return;
  }
  const record = value as Record<string, unknown>;
  output.push('{');
  const keys = Object.keys(record).sort(compareCodeUnits);
  keys.forEach((key, index) => {
    if (index > 0) output.push(',');
    output.push(JSON.stringify(key), ':');
    appendJson(record[key], output);
  });
  output.push('}');
}

export function serializeCoreCanonicalValueV1(value: unknown): string {
  const canonical = canonicalizeCoreValueV1(value);
  const output: string[] = [];
  appendJson(canonical, output);
  return output.join('');
}

function sha256(bytes: Uint8Array): Uint8Array {
  const words = new Uint32Array(64);
  const constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const bitLength = bytes.length * 8;
  const paddedLength = ((bytes.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLength >>> 0, false);
  const highLength = Math.floor(bitLength / 0x100000000);
  view.setUint32(padded.length - 8, highLength >>> 0, false);
  let a = 0x6a09e667; let b = 0xbb67ae85; let c = 0x3c6ef372; let d = 0xa54ff53a;
  let e = 0x510e527f; let f = 0x9b05688c; let g = 0x1f83d9ab; let h = 0x5be0cd19;
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15]; const y = words[index - 2];
      words[index] = (words[index - 16] + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + words[index - 7] + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10))) >>> 0;
    }
    let aa = a; let bb = b; let cc = c; let dd = d; let ee = e; let ff = f; let gg = g; let hh = h;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotr(ee, 6) ^ rotr(ee, 11) ^ rotr(ee, 25);
      const ch = (ee & ff) ^ (~ee & gg);
      const temp1 = (hh + s1 + ch + constants[index] + words[index]) >>> 0;
      const s0 = rotr(aa, 2) ^ rotr(aa, 13) ^ rotr(aa, 22);
      const maj = (aa & bb) ^ (aa & cc) ^ (bb & cc);
      const temp2 = (s0 + maj) >>> 0;
      hh = gg; gg = ff; ff = ee; ee = (dd + temp1) >>> 0; dd = cc; cc = bb; bb = aa; aa = (temp1 + temp2) >>> 0;
    }
    a = (a + aa) >>> 0; b = (b + bb) >>> 0; c = (c + cc) >>> 0; d = (d + dd) >>> 0;
    e = (e + ee) >>> 0; f = (f + ff) >>> 0; g = (g + gg) >>> 0; h = (h + hh) >>> 0;
  }
  const result = new Uint8Array(32); const out = new DataView(result.buffer);
  [a,b,c,d,e,f,g,h].forEach((value, index) => out.setUint32(index * 4, value, false));
  return result;
}

export function coreSha256HexV1(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return Array.from(sha256(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function coreCanonicalDigestFromValueV1(value: unknown): string {
  return coreSha256HexV1(serializeCoreCanonicalValueV1(value));
}

export function canonicalizeModeNeutralCoreRootV1(value: import('./rootV1').ModeNeutralCoreRootV1): import('./rootV1').ModeNeutralCoreRootV1 {
  return canonicalizeCoreValueV1(value) as import('./rootV1').ModeNeutralCoreRootV1;
}

export function serializeModeNeutralCoreRootV1(value: import('./rootV1').ModeNeutralCoreRootV1): string {
  return serializeCoreCanonicalValueV1(value);
}

export function serializeCoreDomainEventsV1(value: readonly import('./domainEventV1').CoreDomainEventV1[]): string {
  return serializeCoreCanonicalValueV1(value);
}

export function coreCanonicalDigestV1(value: unknown): string {
  return coreCanonicalDigestFromValueV1(value);
}
