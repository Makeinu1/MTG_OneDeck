import { describe, expect, test } from 'vitest';

import { checkVerificationIntegrity } from '../checks/check-verification.mjs';
import { DEFAULT_ROOT } from '../checks/validation-domain-resolver.mjs';

describe('verification integrity', () => {
  test('current registry and acceptance bindings are structurally valid', () => {
    const result = checkVerificationIntegrity(DEFAULT_ROOT);
    expect(result.errors).toEqual([]);
    expect(result.counts.directBindings).toBeGreaterThan(0);
    expect(result.counts.scenarios).toBeGreaterThan(0);
  });
});
