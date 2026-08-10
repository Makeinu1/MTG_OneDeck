import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { coreApnapPlayerOrderV1 } from '../triggerApnapV1';

type Raw = Record<string, unknown>;
const source = JSON.parse(readFileSync(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url), 'utf8')) as Raw;

describe('O4P-01K-F APNAP properties', () => {
  it('always returns a rotation with the active player first and no loss/duplication', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 3 }), (activeIndex) => {
      const registry = JSON.parse(JSON.stringify(source)) as Raw;
      const turnOrder = registry.turnOrder as string[];
      registry.activePlayerId = turnOrder[activeIndex];
      const result = coreApnapPlayerOrderV1(registry as never);
      expect(result[0]).toBe(turnOrder[activeIndex]);
      expect(new Set(result).size).toBe(turnOrder.length);
      expect([...result].sort()).toEqual([...turnOrder].sort());
    }));
  });
});
