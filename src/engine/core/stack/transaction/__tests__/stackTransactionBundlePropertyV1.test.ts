import { describe, expect, it } from 'vitest';
import { validateCoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';

function emptyBundleInOrder(order: readonly string[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    objectRegistry: {
      kind: 'mode-neutral-core-object-registry-slice-v2',
      players: { p1: { life: 40, poison: 0, energy: 0, experience: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0, maximumHandSizeOverride: 'none' } },
      turnOrder: ['p1'],
      activePlayerId: 'p1',
      cardDefinitions: {},
      physicalCards: {},
      objects: {},
      zones: { byPlayer: { p1: { library: [], hand: [], graveyard: [] } }, shared: { battlefield: [], stack: [], exile: [], command: [] } },
    },
    objectRuntime: { kind: 'mode-neutral-core-object-runtime-slice-v2', byObject: {} },
    stackAnnouncements: { kind: 'mode-neutral-core-stack-announcement-slice-v1', byObject: {} },
  };
  const result: Record<string, unknown> = {};
  for (const key of order) result[key] = fields[key];
  return result;
}

describe('CoreStackTransactionBundleV1 deterministic properties', () => {
  it('canonicalizes every root field insertion order to identical JSON', () => {
    const orders = [
      ['objectRegistry', 'objectRuntime', 'stackAnnouncements'],
      ['stackAnnouncements', 'objectRuntime', 'objectRegistry'],
      ['objectRuntime', 'stackAnnouncements', 'objectRegistry'],
    ] as const;
    const encoded = orders.map((order) => {
      const result = validateCoreStackTransactionBundleV1(emptyBundleInOrder(order));
      expect(result.ok).toBe(true);
      return result.ok ? JSON.stringify(result.value) : '';
    });
    expect(new Set(encoded).size).toBe(1);
  });

  it('returns byte-identical frozen issues for repeated invalid input', () => {
    const invalid = emptyBundleInOrder(['objectRegistry', 'objectRuntime', 'stackAnnouncements']);
    (invalid.objectRegistry as Record<string, unknown>).unknown = true;
    const first = validateCoreStackTransactionBundleV1(invalid);
    const second = validateCoreStackTransactionBundleV1(invalid);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
  });
});
