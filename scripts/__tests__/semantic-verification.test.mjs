import { describe, expect, test } from 'vitest';

import {
  buildVerificationPlan,
  parseClauses,
  parseProduct,
  stableJson,
} from '../checks/semantic-verification.mjs';
import { DEFAULT_ROOT } from '../checks/validation-domain-resolver.mjs';

describe('semantic verification resolver', () => {
  test('parses product definitions separately from unattributed product prose', () => {
    const parsed = parseProduct([
      '# Product',
      '| ID | requirement |',
      '| --- | --- |',
      '| P-04 | choice authority |',
      'prose outside machine-addressable definitions',
      '| Q-01（決定・更新） | recovery |',
    ].join('\n'));

    expect(parsed.definitions.get('P-04')).toContain('choice authority');
    expect(parsed.definitions.get('Q-01')).toContain('recovery');
    expect(parsed.nonDefinition).toContain('prose outside machine-addressable definitions');
  });

  test('segments active contract clauses by inline semantic marker', () => {
    const parsed = parseClauses([
      '# Contract',
      'intro',
      '<!-- clause: ENG-A-001 -->',
      'first',
      '<!-- clause: ENG-A-002 -->',
      'second',
    ].join('\n'));

    expect(parsed.prefix).toContain('intro');
    expect(parsed.clauses.get('ENG-A-001')).toContain('first');
    expect(parsed.clauses.get('ENG-A-002')).toContain('second');
  });

  test('stable JSON ignores object-key order', () => {
    expect(stableJson({ b: 2, a: { d: 4, c: 3 } })).toBe(stableJson({ a: { c: 3, d: 4 }, b: 2 }));
  });

  test('explicit no-change base/head produces no semantic verdict promotion', () => {
    const plan = buildVerificationPlan({ cwd: DEFAULT_ROOT, base: 'HEAD', head: 'HEAD' });
    expect(plan.semanticImpact).toEqual({});
    expect(plan.scenarioImpact).toEqual({});
    expect(plan.requiredTests).toEqual([]);
    expect(plan.semanticVerdict).toBe('NOT_COMPUTED');
    expect(plan.coverage).toBe('VERIFIED_WITHIN_DECLARED_COVERAGE');
  });
});
