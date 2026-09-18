import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
  validateDelegation,
  validateWorkOrderCandidate,
} from '../checks/work-order.mjs';
import { DEFAULT_ROOT } from '../checks/validation-domain-resolver.mjs';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function write(root, path, content) {
  const full = join(root, path);
  mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true });
  writeFileSync(full, content);
}

function candidateFixture() {
  const root = mkdtempSync(join(tmpdir(), 'm4-candidate-'));
  git(root, ['init']);
  git(root, ['config', 'user.email', 'm4@example.invalid']);
  git(root, ['config', 'user.name', 'M4 Test']);

  write(
    root,
    'docs/work-protocol/work-order.schema.json',
    readFileSync(join(DEFAULT_ROOT, 'docs/work-protocol/work-order.schema.json'), 'utf8'),
  );
  write(root, 'docs/product-requirements.md', [
    '# Product',
    '| ID | requirement |',
    '| --- | --- |',
    '| P-01 | base product |',
  ].join('\n'));
  write(root, 'docs/contracts/engine.md', [
    '# Engine',
    '<!-- clause: ENG-X-001 -->',
    'base clause',
  ].join('\n'));
  write(root, 'docs/contracts/manifest.json', JSON.stringify({
    contracts: [{
      id: 'CONTRACT-X',
      status: 'active',
      path: 'docs/contracts/engine.md',
      authorityFor: ['test'],
    }],
  }));
  write(root, 'docs/contracts/semantic-map.json', JSON.stringify({ schemaVersion: 1, edges: [] }));
  write(root, 'docs/contracts/traceability.json', JSON.stringify({
    schemaVersion: 2,
    clauses: [{
      id: 'ENG-X-001',
      contractId: 'CONTRACT-X',
      status: 'active',
      sourcePath: 'docs/contracts/engine.md',
      sourceMarker: 'clause: ENG-X-001',
      verificationDisposition: 'automated',
      evidenceBindings: [{
        path: 'src/x.test.ts',
        marker: 'verifies: ENG-X-001',
        kind: 'automated',
        role: 'conformance',
      }],
    }],
  }));
  write(root, 'docs/project-state/index.json', JSON.stringify({
    program: {
      activeMilestone: 'M4',
      nextGate: 'M4-IMPLEMENTATION',
      prohibitedScope: ['M5'],
    },
    capabilities: [{ id: 'CR-01', path: 'docs/project-state/capabilities/x.json' }],
  }));
  write(root, 'docs/project-state/capabilities/x.json', JSON.stringify({
    id: 'CR-01',
    semanticVerdict: 'MATCH',
    deliveryState: 'IMPLEMENTED',
    lifecycle: 'ACTIVE',
    requirementLevel: 'REQUIRED',
  }));
  write(root, 'docs/acceptance/scenarios.json', JSON.stringify({
    scenarios: [{ id: 'ACC-X-001', status: 'active', manualOnly: false, automatedBy: ['src/x.test.ts'], verifies: ['ENG-X-001'] }],
  }));
  write(root, 'docs/judge-protocol.md', '# Judge');
  write(root, 'src/x.test.ts', '// verifies: ENG-X-001\nexport const x = 1;');
  write(root, 'scripts/input.txt', 'input');

  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'base']);
  const base = git(root, ['rev-parse', 'HEAD']);
  return { root, base };
}

function packet(planningBase) {
  return {
    schemaVersion: 1,
    workId: 'WO-20260918-201',
    parentWorkId: null,
    title: 'Candidate validation',
    planningBase,
    goal: 'Validate one candidate.',
    authorityRefs: {
      semanticRefs: ['ENG-X-001'],
      paths: [],
    },
    contextRefs: { capabilityRefs: ['CR-01'] },
    verificationIntent: {
      semanticRefs: ['ENG-X-001'],
      acceptanceRefs: ['ACC-X-001'],
      policy: 'INHERIT_M3',
    },
    scope: {
      targetSemanticRefs: ['ENG-X-001'],
      inputPaths: ['src'],
      expectedChangeRoots: ['src'],
    },
    nonGoals: [],
    protected: {
      paths: ['docs/product-requirements.md'],
      semanticRefs: ['P-01'],
    },
    constraints: { local: [] },
    doneWhen: ['Candidate remains bounded.'],
    escalateWhen: [],
    review: { policy: 'INHERIT_AGENTS' },
  };
}

describe('M4 candidate binding and drift', () => {
  test('candidate API rejects an invalid packet even when called directly', () => {
    const fx = candidateFixture();
    try {
      const candidate = packet(fx.base);
      candidate.constraints.authorizedToPush = true;
      const result = validateWorkOrderCandidate(candidate, { root: fx.root, head: fx.base });
      expect(result.errors).toContain('candidate packet $.constraints: unknown field authorizedToPush');
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('allows a planned input path to be deleted by the candidate when the deletion is in scope', () => {
    const fx = candidateFixture();
    try {
      const candidate = packet(fx.base);
      candidate.scope.inputPaths = ['scripts/input.txt'];
      candidate.scope.expectedChangeRoots = ['scripts'];

      git(fx.root, ['rm', 'scripts/input.txt']);
      git(fx.root, ['commit', '-m', 'remove stale input']);
      const head = git(fx.root, ['rev-parse', 'HEAD']);

      const result = validateWorkOrderCandidate(candidate, { root: fx.root, head });
      expect(result.errors).toEqual([]);
      expect(result.drift.changedFiles).toContain('scripts/input.txt');
      expect(result.drift.outsideExpectedChangeRoots).toEqual([]);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('reports an out-of-root support file without treating file drift alone as a hard failure', () => {
    const fx = candidateFixture();
    try {
      write(fx.root, 'scripts/support.txt', 'support');
      git(fx.root, ['add', '.']);
      git(fx.root, ['commit', '-m', 'support']);
      const head = git(fx.root, ['rev-parse', 'HEAD']);

      const result = validateWorkOrderCandidate(packet(fx.base), { root: fx.root, head });
      expect(result.errors).toEqual([]);
      expect(result.drift.outsideExpectedChangeRoots).toEqual(['scripts/support.txt']);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('fails closed when referenced semantic authority changes after planning', () => {
    const fx = candidateFixture();
    try {
      write(fx.root, 'docs/contracts/engine.md', [
        '# Engine',
        '<!-- clause: ENG-X-001 -->',
        'changed meaning',
      ].join('\n'));
      git(fx.root, ['add', '.']);
      git(fx.root, ['commit', '-m', 'authority change']);
      const head = git(fx.root, ['rev-parse', 'HEAD']);

      const result = validateWorkOrderCandidate(packet(fx.base), { root: fx.root, head });
      expect(result.errors.some((error) => error.includes('semantic authority changed since planning ENG-X-001'))).toBe(true);
      expect(result.drift.authoritySemanticChanges).toEqual([
        expect.objectContaining({ id: 'ENG-X-001' }),
      ]);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('does not confuse evidence-file impact with semantic-authority change', () => {
    const fx = candidateFixture();
    try {
      write(fx.root, 'src/x.test.ts', '// verifies: ENG-X-001\nexport const x = 2;');
      git(fx.root, ['add', '.']);
      git(fx.root, ['commit', '-m', 'evidence change']);
      const head = git(fx.root, ['rev-parse', 'HEAD']);

      const result = validateWorkOrderCandidate(packet(fx.base), { root: fx.root, head });
      expect(result.errors.some((error) => error.includes('semantic authority changed'))).toBe(false);
      expect(result.drift.authoritySemanticChanges).toEqual([]);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('requires reinspection when referenced capability context changes', () => {
    const fx = candidateFixture();
    try {
      write(fx.root, 'docs/project-state/capabilities/x.json', JSON.stringify({
        id: 'CR-01',
        semanticVerdict: 'CONFLICT',
        deliveryState: 'IMPLEMENTED',
        lifecycle: 'ACTIVE',
        requirementLevel: 'REQUIRED',
      }));
      git(fx.root, ['add', '.']);
      git(fx.root, ['commit', '-m', 'capability verdict change']);
      const head = git(fx.root, ['rev-parse', 'HEAD']);

      const result = validateWorkOrderCandidate(packet(fx.base), { root: fx.root, head });
      expect(result.errors).toContain(
        'candidate: capability context changed since planning CR-01; reinspection/replan required',
      );
      expect(result.drift.contextCapabilityChanges).toEqual([
        expect.objectContaining({ id: 'CR-01' }),
      ]);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('requires reinspection when a referenced Acceptance oracle changes materially', () => {
    const fx = candidateFixture();
    try {
      write(fx.root, 'docs/acceptance/scenarios.json', JSON.stringify({
        scenarios: [{
          id: 'ACC-X-001',
          status: 'active',
          manualOnly: false,
          automatedBy: ['src/x.test.ts'],
          verifies: ['ENG-X-001'],
          preconditions: [],
          steps: ['changed execution step'],
          oracle: 'changed oracle',
        }],
      }));
      git(fx.root, ['add', '.']);
      git(fx.root, ['commit', '-m', 'acceptance oracle change']);
      const head = git(fx.root, ['rev-parse', 'HEAD']);

      const result = validateWorkOrderCandidate(packet(fx.base), { root: fx.root, head });
      expect(result.errors).toContain(
        'candidate: referenced Acceptance changed materially since planning ACC-X-001; reinspection/replan required',
      );
      expect(result.drift.acceptanceChanges).toEqual([
        expect.objectContaining({ id: 'ACC-X-001' }),
      ]);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('rejects protected path mutation', () => {
    const fx = candidateFixture();
    try {
      write(fx.root, 'docs/product-requirements.md', [
        '# Product',
        '| ID | requirement |',
        '| --- | --- |',
        '| P-01 | changed product |',
      ].join('\n'));
      git(fx.root, ['add', '.']);
      git(fx.root, ['commit', '-m', 'protected change']);
      const head = git(fx.root, ['rev-parse', 'HEAD']);

      const result = validateWorkOrderCandidate(packet(fx.base), { root: fx.root, head });
      expect(result.errors).toContain('candidate: protected path changed docs/product-requirements.md');
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });
});

function currentHead() {
  return git(DEFAULT_ROOT, ['rev-parse', 'HEAD']);
}

function parentPacket(base) {
  return {
    schemaVersion: 1,
    workId: 'WO-20260918-301',
    parentWorkId: null,
    title: 'Parent',
    planningBase: base,
    goal: 'Parent bounded goal.',
    authorityRefs: {
      semanticRefs: ['UX-CONST-UNDO'],
      paths: ['docs/contracts/ux-constitution.md'],
    },
    contextRefs: { capabilityRefs: ['CR-12'] },
    verificationIntent: {
      semanticRefs: ['UX-CONST-UNDO'],
      acceptanceRefs: ['ACC-M3-UNDO-RECOVERY-001'],
      policy: 'INHERIT_M3',
    },
    scope: {
      targetSemanticRefs: ['UX-CONST-UNDO'],
      inputPaths: ['scripts/checks'],
      expectedChangeRoots: ['scripts'],
    },
    nonGoals: [],
    protected: {
      paths: ['docs/product-requirements.md'],
      semanticRefs: ['P-08'],
    },
    constraints: { local: [] },
    doneWhen: ['Parent done.'],
    escalateWhen: [],
    review: { policy: 'INHERIT_AGENTS' },
  };
}

function childPacket(base) {
  const parent = parentPacket(base);
  return {
    ...parent,
    workId: 'WO-20260918-302',
    parentWorkId: parent.workId,
    title: 'Child',
    goal: 'Child bounded contribution.',
    scope: {
      targetSemanticRefs: ['UX-CONST-UNDO'],
      inputPaths: ['scripts/checks'],
      expectedChangeRoots: ['scripts/checks'],
    },
    doneWhen: ['Child done.'],
  };
}

describe('M4 monotonic delegation', () => {
  test('accepts a structurally narrower child that preserves protection and verification', () => {
    const base = currentHead();
    expect(validateDelegation(childPacket(base), parentPacket(base), { root: DEFAULT_ROOT })).toEqual([]);
  });

  test('requires child authority and capability context to inherit the parent packet', () => {
    const base = currentHead();
    const child = childPacket(base);
    child.authorityRefs = { semanticRefs: [], paths: [] };
    child.contextRefs = { capabilityRefs: [] };

    const errors = validateDelegation(child, parentPacket(base), { root: DEFAULT_ROOT });
    expect(errors).toEqual(expect.arrayContaining([
      'delegation: child drops parent authority semantic: UX-CONST-UNDO',
      'delegation: child drops parent authority path: docs/contracts/ux-constitution.md',
      'delegation: child drops parent capability context: CR-12',
    ]));
  });

  test('rejects child target/change-scope expansion', () => {
    const base = currentHead();
    const child = childPacket(base);
    child.scope.targetSemanticRefs = ['UX-CONST-UNDO', 'UX-CONST-HOLD'];
    child.scope.expectedChangeRoots = ['src'];
    const errors = validateDelegation(child, parentPacket(base), { root: DEFAULT_ROOT });
    expect(errors).toEqual(expect.arrayContaining([
      'delegation: child target semantic UX-CONST-HOLD is outside parent target scope',
      'delegation: child expected change root src is outside parent change scope',
    ]));
  });

  test('rejects weakened protected and verification boundaries', () => {
    const base = currentHead();
    const child = childPacket(base);
    child.protected.paths = [];
    child.protected.semanticRefs = [];
    child.verificationIntent.semanticRefs = [];
    child.verificationIntent.acceptanceRefs = [];

    const errors = validateDelegation(child, parentPacket(base), { root: DEFAULT_ROOT });
    expect(errors).toEqual(expect.arrayContaining([
      'delegation: child weakens protected path boundary docs/product-requirements.md',
      'delegation: child weakens protected semantic boundary P-08',
      'delegation: child drops parent verification semantic UX-CONST-UNDO inside child target scope',
      'delegation: child drops parent Acceptance ACC-M3-UNDO-RECOVERY-001 relevant to child target scope',
    ]));
  });

  test('rejects dropped parent non-goals, constraints, or escalation triggers', () => {
    const base = currentHead();
    const parent = parentPacket(base);
    parent.nonGoals = ['Do not change Product Truth.'];
    parent.constraints.local = ['No dependency additions.'];
    parent.escalateWhen = ['Semantic authority change is required.'];

    const child = childPacket(base);
    child.nonGoals = [];
    child.constraints.local = [];
    child.escalateWhen = [];

    const errors = validateDelegation(child, parent, { root: DEFAULT_ROOT });
    expect(errors).toEqual(expect.arrayContaining([
      'delegation: child drops parent non-goal: Do not change Product Truth.',
      'delegation: child drops parent local constraint: No dependency additions.',
      'delegation: child drops parent escalation trigger: Semantic authority change is required.',
    ]));
  });

  test('requires distinct work identity, exact parent identity, and planning snapshot', () => {
    const base = currentHead();
    const parent = parentPacket(base);
    const child = childPacket(base);
    child.workId = parent.workId;
    child.parentWorkId = 'WO-20260918-999';
    child.planningBase = 'f'.repeat(40);
    const errors = validateDelegation(child, parent, { root: DEFAULT_ROOT });
    expect(errors).toEqual(expect.arrayContaining([
      `delegation: child workId ${parent.workId} must differ from parent workId`,
      expect.stringContaining('does not match parent workId'),
      'delegation: child and parent must share planningBase; replan explicitly instead of silently rebasing a child',
    ]));
  });
});
