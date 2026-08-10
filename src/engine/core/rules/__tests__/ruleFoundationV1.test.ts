import { describe, expect, it } from 'vitest';
import { createCoreRuleDurationV1, validateCoreRuleDurationV1 } from '../ruleDurationV1';
import { createCoreRuleKeyV1, validateCoreRuleKeyV1 } from '../ruleKeyV1';
import { createCoreRuleZoneRefV1, validateCoreRuleZoneRefV1 } from '../ruleZoneRefV1';
import { deepFreezeCoreRuleValueV1, readCoreRuleExactRecordV1 } from '../ruleValidationSharedV1';

describe('Core rule foundation V1', () => {
  it('validates opaque keys without normalization and rejects unsafe names', () => {
    expect(createCoreRuleKeyV1('decision-1')).toBe('decision-1');
    expect(validateCoreRuleKeyV1(' decision-1').ok).toBe(false);
    expect(validateCoreRuleKeyV1('constructor').ok).toBe(false);
    expect(validateCoreRuleKeyV1('a/b').ok).toBe(false);
  });

  it('validates the closed zone union and canonicalizes fresh frozen values', () => {
    const input = { kind: 'player-zone', playerId: 'P1', zone: 'library' };
    const result = validateCoreRuleZoneRefV1(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(input);
      expect(result.value).not.toBe(input);
      expect(Object.isFrozen(result.value)).toBe(true);
    }
    expect(createCoreRuleZoneRefV1({ kind: 'shared-zone', zone: 'exile' })).toEqual({
      kind: 'shared-zone',
      zone: 'exile',
    });
    expect(validateCoreRuleZoneRefV1({ kind: 'shared-zone', zone: 'library' }).ok).toBe(false);
  });

  it('validates generic duration variants and preserves zero safely', () => {
    expect(createCoreRuleDurationV1({ kind: 'indefinite' })).toEqual({ kind: 'indefinite' });
    expect(createCoreRuleDurationV1({ kind: 'until-end-of-turn', turnNumber: 0 })).toEqual({
      kind: 'until-end-of-turn',
      turnNumber: 0,
    });
    expect(
      createCoreRuleDurationV1({ kind: 'while-source-exists', sourceObjectId: 'PC1:0' }),
    ).toEqual({ kind: 'while-source-exists', sourceObjectId: 'PC1:0' });
    expect(validateCoreRuleDurationV1({ kind: 'until-end-of-turn', turnNumber: 1.5 }).ok).toBe(
      false,
    );
  });

  it('fails closed for symbols, accessors, non-enumerable fields and unsafe keys', () => {
    let reads = 0;
    const hostile = { kind: 'player-zone', playerId: 'P1', zone: 'hand' } as Record<
      string,
      unknown
    >;
    Object.defineProperty(hostile, 'zone', {
      enumerable: true,
      get: () => {
        reads += 1;
        throw new Error('getter');
      },
    });
    Object.defineProperty(hostile, 'hidden', { enumerable: false, value: true });
    Object.defineProperty(hostile, Symbol('extra'), { enumerable: true, value: true });
    const result = validateCoreRuleZoneRefV1(hostile);
    expect(result.ok).toBe(false);
    expect(reads).toBe(0);
    expect(JSON.stringify(result)).toContain('Accessor properties are not allowed');

    const unsafe = Object.create(null) as Record<string, unknown>;
    unsafe.kind = 'indefinite';
    unsafe.__proto__ = true;
    expect(validateCoreRuleDurationV1(unsafe).ok).toBe(false);
  });

  it('provides deterministic exact-record reads and deep freeze', () => {
    const read = readCoreRuleExactRecordV1({ b: 2, a: 1 }, ['a', 'b']);
    expect(read.issues).toHaveLength(0);
    const value = deepFreezeCoreRuleValueV1({ nested: { zero: 0 } });
    expect(Object.isFrozen(value.nested)).toBe(true);
    expect(JSON.parse(JSON.stringify(value))).toEqual({ nested: { zero: 0 } });
  });
});
