import { describe, expect, it } from 'vitest';

import {
  CoreStackChoiceAnnouncementCreationError,
  createCoreStackAdditionalCostChoiceV1,
  createCoreStackChosenModeKeysV1,
  createCoreStackCostChoiceSetV1,
  validateCoreStackAdditionalCostChoiceV1,
  validateCoreStackChosenModeKeysV1,
  validateCoreStackCostChoiceSetV1,
  validateCoreStackVariableAnnouncementsV1,
} from '../choiceAnnouncementV1';

describe('O4P-01I-G choice announcement primitives', () => {
  it('preserves chosen mode order, repetitions, and empty arrays', () => {
    const value = createCoreStackChosenModeKeysV1(['mode-b', 'mode-a', 'mode-b']);
    expect(value).toEqual(['mode-b', 'mode-a', 'mode-b']);
    expect(createCoreStackChosenModeKeysV1([])).toEqual([]);
    expect(validateCoreStackChosenModeKeysV1(['mode-b', 'mode-a']).ok).toBe(true);
  });

  it('validates variables as sorted unique nonnegative safe integers, including X=0', () => {
    expect(validateCoreStackVariableAnnouncementsV1([{ variableKey: 'X', value: 0 }]).ok).toBe(true);
    expect(validateCoreStackVariableAnnouncementsV1([{ variableKey: 'z', value: 1 }, { variableKey: 'a', value: 1 }]).ok).toBe(false);
    expect(validateCoreStackVariableAnnouncementsV1([{ variableKey: 'X', value: Number.NaN }]).ok).toBe(false);
    expect(validateCoreStackVariableAnnouncementsV1([{ variableKey: 'X', value: -1 }]).ok).toBe(false);
  });

  it('validates alternative and additional costs without calculating payment', () => {
    expect(validateCoreStackCostChoiceSetV1({ alternativeCost: null, additionalCosts: [] }).ok).toBe(true);
    expect(createCoreStackCostChoiceSetV1({ alternativeCost: null, additionalCosts: [] }).additionalCosts).toEqual([]);
    expect(validateCoreStackCostChoiceSetV1({ alternativeCost: { costKey: 'free' }, additionalCosts: [{ costKey: 'kicker', times: 2 }] }).ok).toBe(true);
    expect(validateCoreStackAdditionalCostChoiceV1({ costKey: 'kicker', times: 0 }).ok).toBe(false);
    expect(validateCoreStackCostChoiceSetV1({ alternativeCost: { costKey: 'same' }, additionalCosts: [{ costKey: 'same', times: 1 }] }).ok).toBe(false);
  });

  it('fails closed and returns sorted issues without mutating input', () => {
    const input: Record<string, unknown> = { costKey: 'kicker', times: 1 };
    const before = JSON.stringify(input);
    Object.defineProperty(input, 'times', { enumerable: true, get: () => 1 });
    expect(validateCoreStackAdditionalCostChoiceV1(input).ok).toBe(false);
    expect(JSON.stringify(input)).toBe(before);
    expect(() => createCoreStackAdditionalCostChoiceV1({ costKey: 'kicker', times: 0 })).toThrow(CoreStackChoiceAnnouncementCreationError);
    const invalid = validateCoreStackCostChoiceSetV1({ alternativeCost: { costKey: 'b' }, additionalCosts: [{ costKey: 'z', times: 1 }, { costKey: 'a', times: 1 }] });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issues.map((item) => item.path)).toEqual([...invalid.issues].map((item) => item.path).sort());
  });
});
