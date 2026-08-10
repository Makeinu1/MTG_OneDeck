import { describe, expect, it } from 'vitest';
import {
  createCoreStackTransactionBundleV1,
  validateCoreStackTransactionBundleV1,
} from '../stackTransactionBundleV1';
import { CoreStackTransactionErrorV1 } from '../stackTransactionErrorV1';
import type { CorePlayerId } from '../../../ids';
import type { CorePlayerStateV1 } from '../../../identityZoneState';
import type { ModeNeutralCoreObjectRegistrySliceV2 } from '../../../object/objectRegistryStateV2';
import type { CreateCoreStackTransactionBundleV1Input } from '../stackTransactionBundleV1';

const PLAYER_ID = 'p1' as CorePlayerId;

function player(): CorePlayerStateV1 {
  return {
    life: 40,
    poison: 0,
    energy: 0,
    experience: 0,
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    mulliganCount: 0,
    landsPlayedThisTurn: 0,
    spellsCastThisTurn: 0,
    drawnThisTurn: 0,
    maximumHandSizeOverride: 'none',
  };
}

function registry(): ModeNeutralCoreObjectRegistrySliceV2 {
  return {
    kind: 'mode-neutral-core-object-registry-slice-v2',
    players: { [PLAYER_ID]: player() },
    turnOrder: [PLAYER_ID],
    activePlayerId: PLAYER_ID,
    cardDefinitions: {},
    physicalCards: {},
    objects: {},
    zones: {
      byPlayer: {
        [PLAYER_ID]: { library: [], hand: [], graveyard: [] },
      },
      shared: { battlefield: [], stack: [], exile: [], command: [] },
    },
  };
}

function input(): CreateCoreStackTransactionBundleV1Input {
  return {
    objectRegistry: registry(),
    objectRuntime: {
      kind: 'mode-neutral-core-object-runtime-slice-v2',
      byObject: {},
    },
    stackAnnouncements: {
      kind: 'mode-neutral-core-stack-announcement-slice-v1',
      byObject: {},
    },
  };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) expectDeepFrozen(descriptor.value, seen);
  }
}

describe('CoreStackTransactionBundleV1', () => {
  it('accepts a valid Registry/Runtime/Announcement fixture and freezes only the result', () => {
    const value = input();
    const before = JSON.stringify(value);
    const result = validateCoreStackTransactionBundleV1(value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(value)).toBe(before);
    expectDeepFrozen(result.value);
    expect(Object.isFrozen(value)).toBe(false);
    expect(result.value.objectRegistry.kind).toBe('mode-neutral-core-object-registry-slice-v2');
    expect(result.value.objectRuntime.kind).toBe('mode-neutral-core-object-runtime-slice-v2');
    expect(result.value.stackAnnouncements.kind).toBe('mode-neutral-core-stack-announcement-slice-v1');
  });

  it('rejects invalid Registry, Runtime, and Announcement inputs with retained nested issues', () => {
    const invalidRegistry = input();
    Object.defineProperty(invalidRegistry.objectRegistry, 'extra', { value: true, enumerable: true });
    const registryResult = validateCoreStackTransactionBundleV1(invalidRegistry);
    expect(registryResult.ok).toBe(false);
    if (!registryResult.ok) {
      expect(registryResult.issues[0].path).toBe('/objectRegistry');
      expect(registryResult.issues[0].nested?.some((issue) => issue.code === 'UNKNOWN_FIELD')).toBe(true);
    }

    const invalidRuntime = input();
    Object.defineProperty(invalidRuntime.objectRuntime, 'byObject', { value: { unknown: {} }, enumerable: true, configurable: true, writable: true });
    const runtimeResult = validateCoreStackTransactionBundleV1(invalidRuntime);
    expect(runtimeResult.ok).toBe(false);
    if (!runtimeResult.ok) expect(runtimeResult.issues[0].path).toBe('/objectRuntime');

    const invalidAnnouncements = input();
    Object.defineProperty(invalidAnnouncements.stackAnnouncements, 'extra', { value: true, enumerable: true });
    const announcementResult = validateCoreStackTransactionBundleV1(invalidAnnouncements);
    expect(announcementResult.ok).toBe(false);
    if (!announcementResult.ok) expect(announcementResult.issues[0].path).toBe('/stackAnnouncements');
  });

  it('creates the same canonical frozen value and throws the exact transaction error', () => {
    const created = createCoreStackTransactionBundleV1(input());
    const validated = validateCoreStackTransactionBundleV1(input());
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(JSON.stringify(created)).toBe(JSON.stringify(validated.value));
    expectDeepFrozen(created);

    const invalid = input();
    Object.defineProperty(invalid.objectRuntime, 'byObject', { value: { unknown: {} }, enumerable: true, configurable: true, writable: true });
    try {
      createCoreStackTransactionBundleV1(invalid);
      throw new Error('expected factory failure');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CoreStackTransactionErrorV1);
      if (error instanceof CoreStackTransactionErrorV1) {
        expect(error.name).toBe('CoreStackTransactionErrorV1');
        expect(error.code).toBe('INVALID_TRANSACTION_BUNDLE');
        expectDeepFrozen(error.issues);
      }
    }
  });

  it('contains hostile accessors, non-enumerable fields, symbols, sparse arrays, and proxies', () => {
    const accessor = input();
    Object.defineProperty(accessor, 'objectRegistry', {
      enumerable: true,
      get(): never { throw new Error('getter must not run'); },
    });
    expect(validateCoreStackTransactionBundleV1(accessor).ok).toBe(false);

    const nonEnumerable = input();
    Object.defineProperty(nonEnumerable, 'objectRuntime', { value: nonEnumerable.objectRuntime, enumerable: false });
    expect(validateCoreStackTransactionBundleV1(nonEnumerable).ok).toBe(false);

    const symbolInput = input();
    Object.defineProperty(symbolInput, Symbol('hostile'), { value: 1, enumerable: true });
    expect(validateCoreStackTransactionBundleV1(symbolInput).ok).toBe(false);

    const sparseRegistry = registry();
    Object.defineProperty(sparseRegistry, 'turnOrder', { value: new Array(1), enumerable: true, configurable: true, writable: true });
    const sparseInput = input();
    Object.defineProperty(sparseInput, 'objectRegistry', { value: sparseRegistry, enumerable: true, configurable: true, writable: true });
    expect(validateCoreStackTransactionBundleV1(sparseInput).ok).toBe(false);

    const proxyInput = new Proxy(input(), {
      ownKeys(): never { throw new Error('keys must not escape'); },
    });
    expect(validateCoreStackTransactionBundleV1(proxyInput).ok).toBe(false);

    const hostileAnnouncements = input();
    Object.defineProperty(hostileAnnouncements, 'stackAnnouncements', {
      value: {
        kind: 'mode-neutral-core-stack-announcement-slice-v1',
        byObject: new Proxy({}, { ownKeys(): never { throw new Error('nested keys'); } }),
      },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    expect(() => validateCoreStackTransactionBundleV1(hostileAnnouncements)).not.toThrow();
    expect(validateCoreStackTransactionBundleV1(hostileAnnouncements).ok).toBe(false);
  });

  it('accepts JSON round-trips without changing canonical bytes', () => {
    const first = validateCoreStackTransactionBundleV1(input());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const encoded = JSON.stringify(first.value);
    const roundTrip = validateCoreStackTransactionBundleV1(JSON.parse(encoded) as unknown);
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) expect(JSON.stringify(roundTrip.value)).toBe(encoded);
  });
});
