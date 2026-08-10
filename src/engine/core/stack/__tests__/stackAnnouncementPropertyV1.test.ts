import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementValidationV1';

type Raw = Record<string, unknown>;
const registry = JSON.parse(
  readFileSync(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url), 'utf8'),
) as Raw;

describe('stack announcement properties', () => {
  it('never accepts arbitrary non-record roots', () => {
    const nonRecord = fc.oneof(
      fc.constant(null),
      fc.boolean(),
      fc.integer(),
      fc.string(),
      fc.array(fc.anything()),
    );
    fc.assert(fc.property(nonRecord, (value) => {
      const result = validateModeNeutralCoreStackAnnouncementSliceV1(registry, value);
      expect(result.ok).toBe(false);
      return true;
    }), { numRuns: 50 });
  });
});
