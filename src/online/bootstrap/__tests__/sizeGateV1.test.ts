import { describe, expect, it } from 'vitest';

import {
  evaluateO4P06ASerializedArtifactsV1,
  type BootstrapSizeIssueV1,
} from '../index';

describe('O4P-06A size gate', () => {
  it('reports all three artifact over-limit issues in fixed artifact order', () => {
    const huge = 'x'.repeat(1_048_577);
    const result = evaluateO4P06ASerializedArtifactsV1(huge, huge, huge);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.issues.map((issue: BootstrapSizeIssueV1) => issue.code);
    expect(codes).toEqual(['CORE_ROOT_SIZE_LIMIT_EXCEEDED', 'PROTOCOL_STATE_SIZE_LIMIT_EXCEEDED', 'INITIALIZE_ENVELOPE_SIZE_LIMIT_EXCEEDED']);
    expect(result.issues.every((issue) => issue.message.includes('limitBytes=1048576'))).toBe(true);
  });

  it('accepts exact UTF-8 equality to the 1 MiB limit', () => {
    const exact = 'x'.repeat(1_048_576);
    const result = evaluateO4P06ASerializedArtifactsV1(exact, exact, exact);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('o4p-06a-size-probe-v1');
      expect(result.measurements.every((artifact) => artifact.bytes === 1_048_576 && artifact.withinLimit)).toBe(true);
      expect(result).not.toHaveProperty('evidence');
      expect(result).not.toHaveProperty('serialized');
    }
  });
});
