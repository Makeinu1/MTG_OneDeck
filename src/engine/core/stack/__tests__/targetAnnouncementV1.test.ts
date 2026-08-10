import { describe, expect, it } from 'vitest';
import {
  createCoreStackTargetSelectionsV1,
  validateCoreStackTargetSelectionsV1,
} from '../targetAnnouncementV1';

const objectTarget = (objectId = 'PC1:0') => ({ kind: 'object', objectId });
const playerTarget = (playerId = 'P1') => ({ kind: 'player', playerId });
const selection = (
  selectionId: string,
  groupKey: string,
  target: ReturnType<typeof objectTarget> | ReturnType<typeof playerTarget> = objectTarget(),
) => ({ selectionId, groupKey, target });

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

describe('O4P-01I-F target selection contract', () => {
  it('accepts empty selections and preserves declaration order', () => {
    expect(validateCoreStackTargetSelectionsV1({})).toMatchObject({ ok: false });
    const input = [selection('b', 'g2'), selection('a', 'g1', playerTarget())];
    const result = validateCoreStackTargetSelectionsV1(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((item) => item.selectionId)).toEqual(['b', 'a']);
    expect(validateCoreStackTargetSelectionsV1([])).toEqual({ ok: true, value: [] });
  });

  it('rejects duplicate IDs and same-group targets but permits cross-group reuse', () => {
    expect(validateCoreStackTargetSelectionsV1([selection('a', 'g'), selection('a', 'h')]).ok).toBe(false);
    const sameGroup = validateCoreStackTargetSelectionsV1([selection('a', 'g'), selection('b', 'g')]);
    expect(sameGroup.ok).toBe(false);
    if (!sameGroup.ok) expect(sameGroup.issues.map((item) => item.code)).toContain('DUPLICATE_TARGET_IN_GROUP');
    expect(validateCoreStackTargetSelectionsV1([selection('a', 'g1'), selection('b', 'g2')]).ok).toBe(true);
  });

  it('fails closed for malformed records, arrays, accessors, symbols, and extra fields', () => {
    const malformed = selection('a', 'g') as Record<string, unknown>;
    Object.defineProperty(malformed, 'groupKey', { enumerable: true, get: () => 'g' });
    expect(validateCoreStackTargetSelectionsV1([malformed]).ok).toBe(false);
    const symbolInput = [selection('a', 'g')] as Array<unknown> & { [key: symbol]: unknown };
    symbolInput[Symbol('extra')] = true;
    expect(validateCoreStackTargetSelectionsV1(symbolInput).ok).toBe(false);
    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(validateCoreStackTargetSelectionsV1(sparse).ok).toBe(false);
    const extra = [selection('a', 'g')] as Array<unknown> & { extra?: unknown };
    extra.extra = true;
    expect(validateCoreStackTargetSelectionsV1(extra).ok).toBe(false);
  });

  it('fails closed without throwing for revoked and throwing proxies', () => {
    const revokedArray = Proxy.revocable([selection('a', 'g')], {});
    revokedArray.revoke();
    expect(() => validateCoreStackTargetSelectionsV1(revokedArray.proxy)).not.toThrow();
    expect(validateCoreStackTargetSelectionsV1(revokedArray.proxy).ok).toBe(false);

    const throwingSelection = new Proxy(selection('a', 'g'), {
      getPrototypeOf: () => { throw new Error('revoked prototype'); },
    });
    expect(() => validateCoreStackTargetSelectionsV1([throwingSelection])).not.toThrow();
    expect(validateCoreStackTargetSelectionsV1([throwingSelection]).ok).toBe(false);

    const throwingKeys = new Proxy(selection('a', 'g'), {
      ownKeys: () => { throw new Error('hostile ownKeys'); },
    });
    expect(() => validateCoreStackTargetSelectionsV1([throwingKeys])).not.toThrow();
    expect(validateCoreStackTargetSelectionsV1([throwingKeys]).ok).toBe(false);

    const throwingArrayInspection = new Proxy([selection('a', 'g')], {
      getOwnPropertyDescriptor: () => { throw new Error('hostile descriptor'); },
    });
    expect(() => validateCoreStackTargetSelectionsV1(throwingArrayInspection)).not.toThrow();
    expect(validateCoreStackTargetSelectionsV1(throwingArrayInspection).ok).toBe(false);
  });

  it('sorts issues, returns fresh deeply frozen values, and does not mutate input', () => {
    const input = [selection('a', 'g')];
    const before = JSON.stringify(input);
    const first = createCoreStackTargetSelectionsV1(input);
    const second = createCoreStackTargetSelectionsV1(input);
    expect(first).not.toBe(input);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(Object.isFrozen(first[0].target)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(() => { (first as Array<unknown>).push(selection('b', 'g')); }).toThrow();
    const bad = validateCoreStackTargetSelectionsV1([{ nope: true }, { nope: true }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues).toEqual([...bad.issues].sort((a, b) =>
        codeUnitCompare(a.path, b.path) || codeUnitCompare(a.code, b.code)));
    }
  });
});
