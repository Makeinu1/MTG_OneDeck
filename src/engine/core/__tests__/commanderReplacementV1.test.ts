import {
  CoreCommanderReplacementChoiceCreationErrorV1,
  createCoreCommanderReplacementChoiceV1,
} from '../commander/commanderReplacementV1';
import { describe, expect, it } from 'vitest';

describe('Core commander replacement choice V1', () => {
  it.each([
    ['commander-replacement-903.9a', 'graveyard'],
    ['commander-replacement-903.9a', 'exile'],
    ['commander-replacement-903.9b', 'hand'],
    ['commander-replacement-903.9b', 'library'],
  ] as const)('accepts the valid pairing: %s from %s', (kind, sourceZone) => {
    const result = createCoreCommanderReplacementChoiceV1({ kind, sourceZone });

    expect(result).toEqual({ kind, sourceZone });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    ['commander-replacement-903.9a', 'hand'],
    ['commander-replacement-903.9a', 'library'],
    ['commander-replacement-903.9b', 'graveyard'],
    ['commander-replacement-903.9b', 'exile'],
  ] as const)('rejects the invalid cross-pairing: %s from %s', (kind, sourceZone) => {
    expect(() => createCoreCommanderReplacementChoiceV1({ kind, sourceZone })).toThrow(
      CoreCommanderReplacementChoiceCreationErrorV1,
    );
  });

  it.each([
    {},
    { kind: 'commander-replacement-903.9a' },
    { sourceZone: 'graveyard' },
    { kind: 'commander-replacement-903.9a', sourceZone: 'graveyard', extra: true },
    { kind: 'commander-replacement-903.9a', sourceZone: 'graveyard', ['']: true },
  ])('rejects missing or extra fields: %j', (value) => {
    expect(() => createCoreCommanderReplacementChoiceV1(value)).toThrow(
      CoreCommanderReplacementChoiceCreationErrorV1,
    );
  });

  it.each([
    null,
    { kind: 'commander-replacement-903.9c', sourceZone: 'graveyard' },
    { kind: 'invalid', sourceZone: 'graveyard' },
    { kind: 'commander-replacement-903.9a', sourceZone: 'invalid' },
  ])('rejects invalid type or deferred/unknown values: %j', (value) => {
    expect(() => createCoreCommanderReplacementChoiceV1(value)).toThrow(
      CoreCommanderReplacementChoiceCreationErrorV1,
    );
  });

  it('requires enumerable data descriptors for both fields', () => {
    const accessorInput = {} as { kind?: unknown; sourceZone?: unknown };
    Object.defineProperties(accessorInput, {
      kind: { enumerable: true, get: () => 'commander-replacement-903.9a' },
      sourceZone: { enumerable: true, value: 'graveyard' },
    });
    expect(() => createCoreCommanderReplacementChoiceV1(accessorInput)).toThrow(
      CoreCommanderReplacementChoiceCreationErrorV1,
    );

    const hiddenInput = { kind: 'commander-replacement-903.9a', sourceZone: 'graveyard' };
    Object.defineProperty(hiddenInput, 'sourceZone', { enumerable: false });
    expect(() => createCoreCommanderReplacementChoiceV1(hiddenInput)).toThrow(
      CoreCommanderReplacementChoiceCreationErrorV1,
    );
  });

  it('freezes errors and their issue snapshots', () => {
    try {
      createCoreCommanderReplacementChoiceV1({ kind: 'commander-replacement-903.9a', sourceZone: 'hand' });
      expect.fail('expected creation error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCommanderReplacementChoiceCreationErrorV1);
      expect(Object.isFrozen(error)).toBe(true);
      if (error instanceof CoreCommanderReplacementChoiceCreationErrorV1) {
        expect(Object.isFrozen(error.issues)).toBe(true);
        expect(error.issues.every((entry) => Object.isFrozen(entry))).toBe(true);
      }
    }
  });

  it('does not mutate input and returns a fresh frozen value', () => {
    const input = { kind: 'commander-replacement-903.9a', sourceZone: 'graveyard' };
    const before = { ...input };
    const result = createCoreCommanderReplacementChoiceV1(input);

    expect(input).toEqual(before);
    expect(result).not.toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('sorts malformed issues by code-unit path and then code', () => {
    const first = { sourceZone: 'invalid', extra: true, kind: 'invalid' };
    const second = { kind: 'invalid', extra: true, sourceZone: 'invalid' };
    const readIssues = (value: typeof first): readonly string[] => {
      try {
        createCoreCommanderReplacementChoiceV1(value);
        expect.fail('expected replacement validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(CoreCommanderReplacementChoiceCreationErrorV1);
        if (error instanceof CoreCommanderReplacementChoiceCreationErrorV1) {
          return error.issues.map((current) => `${current.path}|${current.code}`);
        }
      }
      return [];
    };

    expect(readIssues(first)).toEqual([
      '/extra|UNKNOWN_FIELD',
      '/kind|INVALID_KIND',
      '/sourceZone|INVALID_SOURCE_ZONE',
    ]);
    expect(readIssues(second)).toEqual(readIssues(first));
  });

  it.each([
    { getPrototypeOf: () => { throw new Error('prototype trap'); } },
    { ownKeys: () => { throw new Error('ownKeys trap'); } },
    { getOwnPropertyDescriptor: () => { throw new Error('descriptor trap'); } },
  ])('converts replacement inspection traps into a frozen typed error: %j', (handler) => {
    const target = { kind: 'commander-replacement-903.9a', sourceZone: 'graveyard' };
    const input = new Proxy(target, handler);

    try {
      createCoreCommanderReplacementChoiceV1(input);
      expect.fail('expected typed inspection error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCommanderReplacementChoiceCreationErrorV1);
      expect(Object.isFrozen(error)).toBe(true);
      if (error instanceof CoreCommanderReplacementChoiceCreationErrorV1) {
        expect(Object.isFrozen(error.issues)).toBe(true);
        expect(error.issues.every((current) => Object.isFrozen(current))).toBe(true);
      }
    }
  });
});
