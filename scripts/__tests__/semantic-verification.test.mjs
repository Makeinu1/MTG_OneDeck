import { describe, expect, test } from 'vitest';

import {
  buildVerificationPlan,
  directBindingChangeDetails,
  parseClauses,
  parseProduct,
  scenarioChangeDetails,
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

  test('separates process authority metadata from semantic product prose', () => {
    const parsed = parseProduct([
      '# Product',
      '',
      '## 権威と適用範囲',
      'process owner changed',
      '',
      '## プレイヤー成果',
      'semantic prose changed',
      '| P-04 | choice authority |',
    ].join('\n'));

    expect(parsed.processMetadata).toContain('process owner changed');
    expect(parsed.nonDefinition).not.toContain('process owner changed');
    expect(parsed.nonDefinition).toContain('semantic prose changed');
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


  test('removed or weakened Acceptance claims invalidate their semantic coverage', () => {
    const base = {
      scenarios: [
        {
          id: 'ACC-X-001',
          status: 'active',
          manualOnly: true,
          automatedBy: [],
          verifies: ['UX-X-001'],
          preconditions: ['p'],
          steps: ['s'],
          oracle: 'o',
        },
      ],
    };
    const removed = scenarioChangeDetails(base, { scenarios: [] });
    expect(removed).toEqual([
      expect.objectContaining({
        id: 'ACC-X-001',
        kind: 'removed',
        semanticRefs: ['UX-X-001'],
      }),
    ]);

    const changed = scenarioChangeDetails(base, {
      scenarios: [{
        ...base.scenarios[0],
        verifies: [],
      }],
    });
    expect(changed[0]).toMatchObject({
      id: 'ACC-X-001',
      kind: 'modified',
      requiresExecution: true,
    });
    expect(changed[0].reasons).toContain('verification-claim-changed');
    expect(changed[0].semanticRefs).toEqual(['UX-X-001']);
  });

  test('new Acceptance specification is distinguishable from weakened existing coverage', () => {
    const added = scenarioChangeDetails({ scenarios: [] }, {
      scenarios: [{
        id: 'ACC-X-001',
        status: 'active',
        manualOnly: true,
        automatedBy: [],
        verifies: ['UX-X-001'],
        preconditions: ['p'],
        steps: ['s'],
        oracle: 'o',
      }],
    });
    expect(added[0]).toMatchObject({
      kind: 'added',
      requiresExecution: false,
      reasons: ['acceptance-added'],
    });
  });

  test('direct evidence removal or role/disposition changes invalidate the bound semantic', () => {
    const base = {
      clauses: [{
        id: 'ENG-X-001',
        verificationDisposition: 'automated',
        evidenceBindings: [{ path: 'x.test.ts', marker: 'verifies: ENG-X-001', kind: 'automated', role: 'conformance' }],
      }],
    };
    expect(directBindingChangeDetails(base, { clauses: [] })[0]).toMatchObject({
      id: 'ENG-X-001',
      kind: 'removed',
      weakensOrInvalidates: true,
    });
    const weakened = directBindingChangeDetails(base, {
      clauses: [{
        ...base.clauses[0],
        evidenceBindings: [{ path: 'x.test.ts', marker: 'verifies: ENG-X-001', kind: 'automated', role: 'characterization' }],
      }],
    });
    expect(weakened[0]).toMatchObject({
      id: 'ENG-X-001',
      kind: 'modified',
      weakensOrInvalidates: true,
    });
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
