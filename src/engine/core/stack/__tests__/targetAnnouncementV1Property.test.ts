import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateCoreStackTargetSelectionsV1 } from '../targetAnnouncementV1';

const key = fc.stringMatching(/^[A-Za-z][A-Za-z0-9._-]{0,8}$/);
const objectId = fc.constantFrom('PC1:0', 'PC2:1', '@spell-copy:copy-1');
const target = fc.oneof(
  objectId.map((value) => ({ kind: 'object' as const, objectId: value })),
  fc.constant({ kind: 'player' as const, playerId: 'P1' }),
);

describe('O4P-01I-F target selection properties', () => {
  it('accepts generated unique selections with no same-group target collision', () => {
    fc.assert(fc.property(
      fc.array(fc.tuple(key, key, target), { maxLength: 8 }),
      (rows) => {
        const selections = rows.map(([selectionId, groupKey, selectedTarget], index) => ({
          selectionId: `${selectionId}-${index}`,
          groupKey,
          target: selectedTarget,
        }));
        expect(validateCoreStackTargetSelectionsV1(selections).ok).toBe(true);
      },
    ));
  });

  it('preserves valid array order and never mutates generated input', () => {
    fc.assert(fc.property(
      fc.array(fc.tuple(key, key, target), { maxLength: 8 }),
      (rows) => {
        const input = rows.map(([selectionId, groupKey, selectedTarget], index) => ({
          selectionId: `${selectionId}-${index}`,
          groupKey: `${groupKey}-${index}`,
          target: selectedTarget,
        }));
        const before = JSON.stringify(input);
        const result = validateCoreStackTargetSelectionsV1(input);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.map((item) => item.selectionId)).toEqual(input.map((item) => item.selectionId));
        expect(JSON.stringify(input)).toBe(before);
      },
    ));
  });
});
