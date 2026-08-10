import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CoreStackAnnouncementCreationError, createModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementSliceV1';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementValidationV1';

type Raw = Record<string, unknown>;
const stackIds = ['PC5:1', '@spell-copy:fixture-copy', '@activated-ability:fixture-activation', '@triggered-ability:fixture-trigger'];
function registry(): Raw { return JSON.parse(readFileSync(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url), 'utf8')) as Raw; }
function input(): Raw {
  const record = (kind: string, text: string | null): Raw => ({ kind, abilityTextSnapshot: text, chosenModeKeys: ['b', 'a', 'b'], targetSelections: [{ selectionId: 'target', groupKey: 'group', target: { kind: 'object', objectId: '@spell-copy:historical' } }], announcedVariables: [{ variableKey: 'X', value: 0 }], distributions: [{ distributionKey: 'damage', assignments: [{ targetSelectionId: 'target', amount: 1 }] }], costChoices: { alternativeCost: null, additionalCosts: [] } });
  return { byObject: { [stackIds[0]]: record('card-spell', null), [stackIds[1]]: record('spell-copy', null), [stackIds[2]]: record('activated-ability', 'old text'), [stackIds[3]]: record('triggered-ability', 'old text') } };
}

describe('ModeNeutralCoreStackAnnouncementSliceV1', () => {
  it('validates registry parity, preserves stack order, and creates a frozen root', () => {
    const result = validateModeNeutralCoreStackAnnouncementSliceV1(registry(), { ...input(), kind: 'mode-neutral-core-stack-announcement-slice-v1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.byObject)).toEqual(stackIds);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.byObject)).toBe(true);
    expect(createModeNeutralCoreStackAnnouncementSliceV1(registry() as never, input() as { byObject: Readonly<Record<string, unknown>> }).kind).toBe('mode-neutral-core-stack-announcement-slice-v1');
  });

  it('does not execute factory accessors and reports deterministic descriptor issues', () => {
    let reads = 0;
    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, 'byObject', { enumerable: true, get: () => { reads += 1; return input().byObject; } });
    expect(() => createModeNeutralCoreStackAnnouncementSliceV1(registry() as never, hostile as { byObject: Readonly<Record<string, unknown>> })).toThrow(CoreStackAnnouncementCreationError);
    expect(reads).toBe(0);
  });

  it('sorts factory inspection and validator issues by RFC6901 path and code', () => {
    const hostile: Record<string, unknown> = { zz: true, aa: true };
    Object.defineProperty(hostile, 'byObject', { enumerable: true, get: () => input().byObject });
    let thrown: unknown;
    try { createModeNeutralCoreStackAnnouncementSliceV1(registry() as never, hostile as { byObject: Readonly<Record<string, unknown>> }); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(CoreStackAnnouncementCreationError);
    if (!(thrown instanceof CoreStackAnnouncementCreationError)) return;
    expect(thrown.issues.map((found) => `${found.path}|${found.code}`)).toEqual([
      '/aa|UNKNOWN_FIELD', '/byObject|INVALID_TYPE', '/byObject|INVALID_TYPE', '/byObject|MISSING_FIELD', '/zz|UNKNOWN_FIELD',
    ]);
  });
});
