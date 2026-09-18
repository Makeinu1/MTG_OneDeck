import { describe, expect, test } from 'vitest';

import { checkVerificationIntegrity } from '../checks/check-verification.mjs';
import { readCurrentVerificationState } from '../checks/semantic-verification.mjs';
import { DEFAULT_ROOT } from '../checks/validation-domain-resolver.mjs';

describe('verification integrity', () => {
  test('current registry and acceptance bindings are structurally valid', () => {
    const result = checkVerificationIntegrity(DEFAULT_ROOT);
    expect(result.errors).toEqual([]);
    expect(result.counts.directBindings).toBeGreaterThan(0);
    expect(result.counts.scenarios).toBeGreaterThan(0);
  });

  test('indexes the active UI architecture and Acceptance registry', () => {
    const { manifest, scenarios } = readCurrentVerificationState(DEFAULT_ROOT);
    expect(manifest.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'CONTRACT-UI-ARCHITECTURE',
        status: 'active',
        path: 'docs/contracts/ui/architecture.md',
      }),
      expect.objectContaining({
        id: 'CONTRACT-ACCEPTANCE',
        status: 'active',
        path: 'docs/acceptance/scenarios.json',
      }),
    ]));
    expect(Array.isArray(scenarios.scenarios)).toBe(true);
  });
});
// verifies: UI-ARCH-004
