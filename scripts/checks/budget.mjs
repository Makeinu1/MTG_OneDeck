#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createContextProjection } from '../codex-context.mjs';
import { evaluateCandidateBudget } from '../lib/supervisor-state.mjs';

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== '--domain' || !argv[1] || argv[1].startsWith('--')) {
    throw new Error('usage: budget.mjs --domain <id>');
  }
  return { domain: argv[1] };
}

export function buildBudgetReport({ root = process.cwd(), domain, sessionsRoot } = {}) {
  let projection;
  try {
    projection = createContextProjection(root, domain, { sessionsRoot });
  } catch (error) {
    return {
      ok: false,
      domain: domain ?? null,
      candidateId: null,
      counters: null,
      limits: null,
      errors: [{ code: 'CONTEXT_PROJECTION_FAILED', message: error instanceof Error ? error.message : String(error) }],
    };
  }
  const budget = projection.activeCandidate && projection.supervisionPolicy
    ? evaluateCandidateBudget(projection.activeCandidate, projection.supervisionPolicy)
    : { ok: false, counters: null, limits: null, errors: [{ code: 'MISSING_BUDGET_RECORD' }] };
  const contextErrors = projection.health.errors.filter((error) =>
    !['BUDGET_LIMIT_EXCEEDED', 'INVALID_CANDIDATE_COUNTERS', 'INVALID_COUNTER_VALUE'].includes(error.code),
  );
  const errors = [...contextErrors, ...budget.errors];
  return {
    ok: errors.length === 0,
    domain,
    candidateId: projection.activeCandidate?.id ?? null,
    state: projection.activeCandidate?.state ?? null,
    counters: budget.counters ?? null,
    limits: budget.limits ?? projection.supervisionPolicy?.limits ?? null,
    advisories: budget.advisories ?? projection.advisories ?? [],
    errors,
  };
}

export function runBudgetCli(argv = process.argv.slice(2), root = process.cwd()) {
  const report = buildBudgetReport({ root, ...parseArguments(argv) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runBudgetCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
