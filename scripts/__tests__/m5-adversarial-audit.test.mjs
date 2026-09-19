import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { resolveDomainSelection } from '../checks/validation-domain-resolver.mjs';
import { validateLegacyDecision } from '../checks/legacy-inventory-policy.mjs';
import { renderLegacyInventory } from '../checks/generate-legacy-inventory.mjs';
import { validateRepositoryHygiene } from '../checks/check-repository-hygiene.mjs';
import { validateWorkOrderAtPlanningBase } from '../checks/work-order.mjs';
import { classifyRecovery } from '../checks/recovery-reconstruction.mjs';

const roots = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

function put(root, path, content) {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function validationRoot(domains = []) {
  const root = mkdtempSync(join(tmpdir(), 'm5-adversarial-domain-'));
  roots.push(root);
  put(root, 'scripts/checks/validation-domains.json', JSON.stringify({ domains }));
  return root;
}

function domain(id = 'fixture') {
  return {
    id,
    description: 'fixture',
    sourcePatterns: ['src/engine/**'],
    testPatterns: [],
    testProject: 'core',
    relatedContractIds: [],
    dependentDomains: [],
    escalationLevel: 'targeted',
    reason: 'fixture',
  };
}

function hygieneFixture() {
  const root = mkdtempSync(join(tmpdir(), 'm5-adversarial-hygiene-'));
  roots.push(root);
  put(root, '.github/workflows/a.yml', [
    'name: A',
    'permissions:',
    '  contents: read',
    'jobs:',
    '  evidence:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: node scripts/online/sample-evidence.mjs',
    '      - run: echo artifact',
    '',
  ].join('\n'));
  put(root, 'scripts/online/sample-evidence.mjs', 'console.log("sample");\n');
  put(root, 'scripts/evidence/registry.json', JSON.stringify({
    contracts: [{
      id: 'E1',
      executor: { script: 'scripts/online/sample-evidence.mjs' },
      executionPath: { workflow: '.github/workflows/a.yml', job: 'evidence', artifact: 'artifact' },
    }],
  }));
  put(root, 'scripts/journeys/registry.json', JSON.stringify({ journeys: [] }));
  put(root, 'package.json', JSON.stringify({ scripts: {} }));
  put(root, 'docs/old.md', 'User authorization: historical only. NON-REPLAYABLE.\n');
  put(root, 'src/test/architecture/example.test.ts', 'export {};\n');
  put(root, 'scripts/checks/validation-domains.json', JSON.stringify({
    domains: [{ testPatterns: ['src/test/architecture/**/*.test.ts'] }],
  }));
  put(root, 'compat/retained.txt', 'persisted consumer\n');
  put(root, 'scripts/checks/repository-hygiene.json', JSON.stringify({
    schemaVersion: 1,
    status: 'CURRENT_REPOSITORY_HYGIENE',
    workflows: [{
      path: '.github/workflows/a.yml',
      lifecycle: 'ACTIVE',
      owner: 'verification',
      purpose: 'fixture',
      writeCapable: false,
    }],
    historicalAuthorization: {
      discoveryPhrases: ['User authorization:'],
      requiredMarker: 'NON-REPLAYABLE',
      paths: ['docs/old.md'],
    },
    evidenceAssets: [{
      path: 'scripts/online/sample-evidence.mjs',
      lifecycle: 'ACTIVE_CONTRACT',
      owner: 'E1',
      consumers: ['scripts/evidence/registry.json'],
      reason: 'fixture',
    }],
    compatibilitySurfaces: [{
      id: 'persisted',
      lifecycle: 'COMPATIBILITY',
      paths: ['compat/retained.txt'],
      retirementPrecondition: 'consumer/migration proof required',
    }],
    architectureGuard: {
      root: 'src/test/architecture',
      validationDomainPath: 'scripts/checks/validation-domains.json',
      requiredPattern: 'src/test/architecture/**/*.test.ts',
    },
  }));
  return root;
}

function retirementWorkflowSafe(content) {
  return [
    "github.event.pull_request.merged == true",
    "github.event.pull_request.head.repo.full_name == github.repository",
    "github.event.pull_request.head.ref != 'main'",
    'github.event.pull_request.head.sha',
    'test "$current" = "$EXPECTED"',
  ].every((needle) => content.includes(needle));
}

describe('M5.5 adversarial/destructive audit', () => {
  it('01 changed but unowned runnable test escalates full instead of failing open', () => {
    const root = validationRoot([]);
    put(root, 'src/engine/__tests__/new.test.ts', 'export {};\n');
    const report = resolveDomainSelection({ root, files: ['src/engine/__tests__/new.test.ts'] });
    expect(report.escalation).toBe('full');
    expect(report.selfSelectedTestFiles).toContain('src/engine/__tests__/new.test.ts');
  });

  it('02 deleted test escalates full because the changed test path is unrunnable', () => {
    const root = validationRoot([domain()]);
    const report = resolveDomainSelection({ root, files: ['src/engine/__tests__/gone.test.ts'] });
    expect(report.escalation).toBe('full');
    expect(report.unrunnableChangedTestFiles).toContain('src/engine/__tests__/gone.test.ts');
  });

  it('03 renamed test escalates full when the old path disappears', () => {
    const root = validationRoot([domain()]);
    put(root, 'src/engine/__tests__/renamed.test.ts', 'export {};\n');
    const report = resolveDomainSelection({
      root,
      files: ['src/engine/__tests__/old.test.ts', 'src/engine/__tests__/renamed.test.ts'],
    });
    expect(report.escalation).toBe('full');
    expect(report.unrunnableChangedTestFiles).toContain('src/engine/__tests__/old.test.ts');
    expect(report.selfSelectedTestFiles).toContain('src/engine/__tests__/renamed.test.ts');
  });

  it('04 stale legacy overlay itemKey is rejected', () => {
    const errors = validateLegacyDecision({
      itemKey: 'stale-key',
      disposition: 'archived-historical',
      targetIds: [],
      rationale: 'fixture',
      decisionRef: 'fixture',
    }, { baseItemKeys: new Set(['current-key']), validTargets: new Set() });
    expect(errors.join('\n')).toContain('itemKey does not resolve to current generated base');
  });

  it('05 generated inventory drift is mechanically distinguishable from deterministic output', () => {
    const actual = readFileSync(resolve('research/archive/document-reset-2026-08/legacy-contract-inventory.json'), 'utf8');
    const rendered = JSON.stringify(renderLegacyInventory(), null, 2) + '\n';
    expect(actual).toBe(rendered);
    expect(actual + 'injected-drift').not.toBe(rendered);
  });

  it('06 missing workflow marker fails bundle referential integrity', () => {
    const root = hygieneFixture();
    put(root, '.github/workflows/a.yml', readFileSync(join(root, '.github/workflows/a.yml'), 'utf8') + '      - run: cat .github/missing.marker\n');
    expect(validateRepositoryHygiene({ root }).errors.join('\n')).toContain('dangling workflow reference .github/missing.marker');
  });

  it('07 missing workflow patch fails bundle referential integrity', () => {
    const root = hygieneFixture();
    put(root, '.github/workflows/a.yml', readFileSync(join(root, '.github/workflows/a.yml'), 'utf8') + '      - run: git apply .github/missing.patch\n');
    expect(validateRepositoryHygiene({ root }).errors.join('\n')).toContain('dangling workflow reference .github/missing.patch');
  });

  it('08 legacy write-capable workflow cannot appear unclassified', () => {
    const root = hygieneFixture();
    put(root, '.github/workflows/legacy-writer.yml', 'permissions:\n  contents: write\njobs: {}\n');
    const errors = validateRepositoryHygiene({ root }).errors.join('\n');
    expect(errors).toContain('workflow: unclassified .github/workflows/legacy-writer.yml');
  });

  it('09 hidden evidence consumer drift is rejected', () => {
    const root = hygieneFixture();
    put(root, 'scripts/evidence/registry.json', JSON.stringify({ contracts: [] }));
    expect(validateRepositoryHygiene({ root }).errors.join('\n'))
      .toContain('consumer scripts/evidence/registry.json no longer references asset');
  });

  it('10 branch retirement path cannot auto-delete a non-merged/unprovenance branch', () => {
    const content = readFileSync(resolve('.github/workflows/branch-hygiene.yml'), 'utf8');
    expect(retirementWorkflowSafe(content)).toBe(true);
    expect(retirementWorkflowSafe(content.replace("github.event.pull_request.merged == true", 'true'))).toBe(false);
  });

  it('11 historical authorization replay attempt without NON-REPLAYABLE is rejected', () => {
    const root = hygieneFixture();
    put(root, 'research/replay.md', 'User authorization: push and deploy.\n');
    expect(validateRepositoryHygiene({ root }).errors.join('\n'))
      .toContain('discovered replayable-looking record research/replay.md');
  });

  it('12 stale Work Order planningBase fails closed', () => {
    const packet = JSON.parse(readFileSync(resolve('docs/work-protocol/examples/root-implementation.json'), 'utf8'));
    packet.planningBase = '0'.repeat(40);
    expect(validateWorkOrderAtPlanningBase(packet).join('\n')).toContain('commit does not exist');
  });

  it('13 old green evidence on a changed candidate cannot resume', () => {
    expect(classifyRecovery({
      canonicalOk: true,
      hygieneOk: true,
      receiptOk: false,
      mainAncestor: true,
      workOrderProvided: true,
      planningValid: true,
      candidateValid: true,
    })).toBe('BLOCKED');
  });

  it('14 compatibility retirement with a retained consumer/path is rejected', () => {
    const root = hygieneFixture();
    unlinkSync(join(root, 'compat/retained.txt'));
    expect(validateRepositoryHygiene({ root }).errors.join('\n'))
      .toContain('compatibility persisted: missing retained path compat/retained.txt');
  });
});
