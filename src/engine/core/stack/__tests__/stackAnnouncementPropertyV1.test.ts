import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementValidationV1';

describe('stack announcement properties', () => {
  it('never accepts arbitrary non-record roots', () => {
    fc.assert(fc.property(fc.anything(), (value) => {
      const result = validateModeNeutralCoreStackAnnouncementSliceV1({}, value);
      expect(result.ok).toBe(false);
      return true;
    }), { numRuns: 50 });
  });
});
