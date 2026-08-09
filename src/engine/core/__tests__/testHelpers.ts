import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CoreIdentityZoneValidationResult,
} from '../identityZoneValidation';

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/identity-zone-slice-v1.json',
);

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function fixtureUnknown(): unknown {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;
}

export function fixtureRecord(): Record<string, unknown> {
  const value = fixtureUnknown();
  if (!isRecord(value)) throw new Error('fixture root must be a record');
  return value;
}

export function cloneFixture(): Record<string, unknown> {
  const value = structuredClone(fixtureRecord());
  if (!isRecord(value)) throw new Error('cloned fixture root must be a record');
  return value;
}

export function issueCodes(result: CoreIdentityZoneValidationResult): readonly string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

export function hasIssue(result: CoreIdentityZoneValidationResult, code: string): boolean {
  return issueCodes(result).includes(code);
}
