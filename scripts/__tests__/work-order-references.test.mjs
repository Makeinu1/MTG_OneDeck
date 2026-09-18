import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { validateWorkOrderReferences } from '../checks/work-order.mjs';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function write(root, path, content) {
  const full = join(root, path);
  mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true });
  writeFileSync(full, content);
}

function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'm4-work-order-'));
  git(root, ['init']);
  git(root, ['config', 'user.email', 'm4@example.invalid']);
  git(root, ['config', 'user.name', 'M4 Test']);

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
  write(root, 'docs/project-state/index.json', JSON.stringify({
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
    scenarios: [{ id: 'ACC-X-001', verifies: ['ENG-X-001'] }],
  }));
  write(root, 'docs/judge-protocol.md', '# Judge');
  write(root, 'scripts/input.txt', 'input');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'base']);
  const base = git(root, ['rev-parse', 'HEAD']);

  write(root, 'docs/contracts/engine.md', [
    '# Engine',
    '<!-- clause: ENG-X-001 -->',
    'base clause',
    '<!-- clause: ENG-X-002 -->',
    'later clause',
  ].join('\n'));
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'later']);
  const head = git(root, ['rev-parse', 'HEAD']);
  return { root, base, head };
}

function workOrder(planningBase) {
  return {
    schemaVersion: 1,
    workId: 'WO-20260918-101',
    parentWorkId: null,
    title: 'Reference test',
    planningBase,
    goal: 'Validate planning-snapshot references.',
    authorityRefs: {
      semanticRefs: ['ENG-X-001'],
      paths: ['docs/contracts/engine.md'],
    },
    contextRefs: { capabilityRefs: ['CR-01'] },
    verificationIntent: {
      semanticRefs: ['ENG-X-001'],
      acceptanceRefs: ['ACC-X-001'],
      policy: 'INHERIT_M3',
    },
    scope: {
      targetSemanticRefs: ['ENG-X-001'],
      inputPaths: ['scripts'],
      expectedChangeRoots: ['scripts/new-output'],
    },
    nonGoals: [],
    protected: {
      paths: ['docs/product-requirements.md'],
      semanticRefs: ['P-01'],
    },
    constraints: { local: [] },
    doneWhen: ['References resolve at the planning snapshot.'],
    escalateWhen: [],
    review: { policy: 'INHERIT_AGENTS' },
  };
}

describe('M4 Work Order planning-snapshot reference resolution', () => {
  test('accepts canonical references that exist at planningBase', () => {
    const fx = fixtureRepo();
    try {
      expect(validateWorkOrderReferences(workOrder(fx.base), { root: fx.root })).toEqual([]);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('does not let a later semantic addition retroactively validate an older Work Order', () => {
    const fx = fixtureRepo();
    try {
      const packet = workOrder(fx.base);
      packet.scope.targetSemanticRefs = ['ENG-X-002'];
      expect(validateWorkOrderReferences(packet, { root: fx.root })).toContain(
        'scope.targetSemanticRefs: unresolved semantic ID ENG-X-002 at planningBase',
      );

      packet.planningBase = fx.head;
      expect(validateWorkOrderReferences(packet, { root: fx.root })).not.toContain(
        'scope.targetSemanticRefs: unresolved semantic ID ENG-X-002 at planningBase',
      );
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('rejects unresolved semantic/capability/Acceptance references', () => {
    const fx = fixtureRepo();
    try {
      const packet = workOrder(fx.base);
      packet.authorityRefs.semanticRefs = ['ENG-MISSING'];
      packet.contextRefs.capabilityRefs = ['CR-99'];
      packet.verificationIntent.acceptanceRefs = ['ACC-MISSING'];
      expect(validateWorkOrderReferences(packet, { root: fx.root })).toEqual(expect.arrayContaining([
        'authorityRefs.semanticRefs: unresolved semantic ID ENG-MISSING at planningBase',
        'contextRefs.capabilityRefs: unresolved capability CR-99 at planningBase',
        'verificationIntent.acceptanceRefs: unresolved Acceptance ACC-MISSING at planningBase',
      ]));
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('rejects arbitrary authority paths, unsafe paths, and missing required input/protected paths', () => {
    const fx = fixtureRepo();
    try {
      const packet = workOrder(fx.base);
      packet.authorityRefs.paths = ['scripts/input.txt'];
      packet.scope.inputPaths = ['../outside'];
      packet.protected.paths = ['docs/missing.md'];
      expect(validateWorkOrderReferences(packet, { root: fx.root })).toEqual(expect.arrayContaining([
        'authorityRefs.paths: not a canonical authority path at planningBase: scripts/input.txt',
        'scope.inputPaths: unsafe repository path ../outside',
        'protected.paths: missing at planningBase: docs/missing.md',
      ]));
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test('rejects a nonexistent planning commit', () => {
    const fx = fixtureRepo();
    try {
      const packet = workOrder('f'.repeat(40));
      expect(validateWorkOrderReferences(packet, { root: fx.root })).toEqual([
        `planningBase: commit does not exist ${'f'.repeat(40)}`,
      ]);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });
});
