#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateRepositoryHygiene } from './check-repository-hygiene.mjs';
import { canonicalFreshness } from './recovery-reconstruction.mjs';

export const DEFAULT_ROOT = resolve(import.meta.dirname, '../..');

const PROJECT_STATE = 'docs/project-state/index.json';
const HYGIENE_REGISTRY = 'scripts/checks/repository-hygiene.json';
const TRACEABILITY = 'docs/contracts/traceability.json';

function readJson(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function text(root, path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requirePath(root, path, errors) {
  if (!existsSync(resolve(root, path))) errors.push('missing required certification asset ' + path);
}

export function certifyM5({ root = DEFAULT_ROOT } = {}) {
  const errors = [];
  const project = readJson(root, PROJECT_STATE);
  const hygieneRegistry = readJson(root, HYGIENE_REGISTRY);
  const requiredMilestones = [
    'M5.0 — Asset Model / Derived Census Foundation',
    'M5.1 — Lifecycle / Retention / Retirement',
    'M5.2 — Repository Reconciliation / Cleanup',
    'M5.3 — Drift / Hygiene Detection',
    'M5.4 — Recovery / Reconciliation Protocol',
    'M5.5 — Adversarial / Destructive Audit',
  ];

  for (const milestone of requiredMilestones) {
    if (!project.program?.completedMilestones?.includes(milestone)) {
      errors.push('Project State has not completed ' + milestone);
    }
  }
  const m56Complete = project.program?.completedMilestones?.includes('M5.6 — Clean Baseline Certification') === true;
  if (!m56Complete && project.program?.nextGate !== 'M5.6 — Clean Baseline Certification') {
    errors.push('Project State nextGate must be M5.6 — Clean Baseline Certification before certification closeout');
  }
  if (m56Complete) {
    if (!project.program?.completedMilestones?.includes('M5 — Audit / Hygiene / Recovery')) {
      errors.push('M5.6 complete requires top-level M5 completion');
    }
    if (project.program?.activeMilestone !== 'M6 — Closed Execution Loop') {
      errors.push('M5.6 closeout must hand active milestone to M6 without implementing it');
    }
    if (project.program?.nextGate !== 'M6-PLAN — Closed Execution Loop') {
      errors.push('M5.6 closeout nextGate must be M6-PLAN — Closed Execution Loop');
    }
    if (!(project.program?.prohibitedScope ?? []).includes('M6-M7 implementation')) {
      errors.push('M5.6 handoff must retain the M6-M7 implementation prohibition until a separately approved M6 plan');
    }
  }

  const hygiene = validateRepositoryHygiene({ root });
  if (!hygiene.ok) errors.push(...hygiene.errors.map((error) => 'hygiene: ' + error));

  const freshness = canonicalFreshness({ root });
  if (!freshness.ok) errors.push(...freshness.errors.map((error) => 'freshness: ' + error));

  const unknownLifecycle = [
    ...(hygieneRegistry.workflows ?? []),
    ...(hygieneRegistry.evidenceAssets ?? []),
    ...(hygieneRegistry.compatibilitySurfaces ?? []),
  ].filter((entry) => entry.lifecycle === 'UNKNOWN' || entry.lifecycle === 'RETIRE_CANDIDATE');
  for (const entry of unknownLifecycle) {
    errors.push('unresolved lifecycle remains ' + (entry.path ?? entry.id ?? '<unknown>'));
  }

  const requiredAssets = [
    'docs/recovery-protocol.md',
    'docs/project-state/evidence/m5-adversarial-audit.md',
    'scripts/checks/check-repository-hygiene.mjs',
    'scripts/checks/recovery-reconstruction.mjs',
    'scripts/checks/m5-adversarial-audit.mjs',
    'scripts/__tests__/m5-adversarial-audit.test.mjs',
    'research/archive/m5-provenance/constitution-v1-contract-integration/README.md',
    'research/archive/m5-provenance/constitution-v1-contract-integration/constitution-v1-contract-integration.patch',
    'research/archive/m5-provenance/fix-cockpit-turn-cleanup-stage2b-20260914/README.md',
    'research/archive/m5-provenance/fix-cockpit-turn-cleanup-stage2b-20260914/stage2b-local-only-evidence.md',
    'src/components/game/CockpitStackLki.test.ts',
  ];
  for (const path of requiredAssets) requirePath(root, path, errors);

  const constitutionArchive = text(root, 'research/archive/m5-provenance/constitution-v1-contract-integration/README.md');
  if (!/^AUTHORITY:\s*NONE\s*$/imu.test(constitutionArchive)
      || !/^EXECUTION AUTHORITY:\s*NONE\s*$/imu.test(constitutionArchive)) {
    errors.push('constitution provenance archive lacks explicit no-authority markers');
  }

  const traceability = text(root, TRACEABILITY);
  if (!traceability.includes('src/components/game/CockpitStackLki.test.ts') || !traceability.includes('ENG-ZONES-004')) {
    errors.push('A3 LKI rescue is not durably bound to ENG-ZONES-004 evidence');
  }

  const recoveryDoc = text(root, 'docs/recovery-protocol.md');
  for (const marker of ['RESUME', 'REPLAN', 'BLOCKED', 'RESCUE', 'Recovery is not rollback']) {
    if (!recoveryDoc.includes(marker)) errors.push('recovery protocol missing marker ' + marker);
  }

  const adversarial = text(root, 'docs/project-state/evidence/m5-adversarial-audit.md');
  for (let index = 1; index <= 14; index += 1) {
    if (!adversarial.includes('| ' + index + ' |')) errors.push('adversarial audit matrix missing fault ' + index);
  }

  const forbiddenWorkflows = [
    '.github/workflows/m5-branch-retirement.yml',
    '.github/workflows/r4-verification.yml',
    '.github/workflows/r4-release-preflight.yml',
    '.github/workflows/r4-vitest-diagnostic.yml',
    '.github/workflows/cockpit-combat-events-verification.yml',
    '.github/workflows/cockpit-repair-verification.yml',
    '.github/workflows/cockpit-stage1-assemble.yml',
    '.github/workflows/cockpit-runtime-bootstrap.yml',
    '.github/workflows/r4-browser-evidence.yml',
  ];
  for (const path of forbiddenWorkflows) {
    if (existsSync(resolve(root, path))) errors.push('retired/broken workflow resurfaced ' + path);
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      completedM5Gates: requiredMilestones.length,
      workflowCount: hygiene.workflowCount,
      evidenceCount: hygiene.evidenceCount,
      unresolvedLifecycleCount: unknownLifecycle.length,
    },
  };
}

export function runM5Certification(options = {}) {
  const report = certifyM5(options);
  if (!report.ok) {
    for (const error of report.errors) console.error('FAIL: ' + error);
    return 1;
  }
  console.log('m5-certification: PASS ' + JSON.stringify(report.summary));
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runM5Certification();
}
