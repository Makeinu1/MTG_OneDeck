#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { certifyM5 } from './m5-certification.mjs';
import { reconstructRecovery } from './recovery-reconstruction.mjs';
import { buildVerificationPlan } from './semantic-verification.mjs';
import { applyManualEvidence } from './verify-semantic.mjs';
import {
  readWorkOrder,
  validateWorkOrderAtPlanningBase,
  validateWorkOrderCandidate,
} from './work-order.mjs';

export const DEFAULT_ROOT = resolve(import.meta.dirname, '../..');

const PROJECT_STATE_PATH = 'docs/project-state/index.json';

export const SHADOW_RESULTS = Object.freeze({
  COMPLETE: 'COMPLETE',
  CONTINUE: 'CONTINUE',
  NO_CHANGE_REQUIRED: 'NO_CHANGE_REQUIRED',
  MANUAL_EVIDENCE_REQUIRED: 'MANUAL_EVIDENCE_REQUIRED',
  OWNER_DECISION_REQUIRED: 'OWNER_DECISION_REQUIRED',
  UNKNOWN_COVERAGE: 'UNKNOWN_COVERAGE',
  STALE_REPLAN_REQUIRED: 'STALE_REPLAN_REQUIRED',
  RECOVERY_REQUIRED: 'RECOVERY_REQUIRED',
});

function readJson(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function nonEmpty(items) {
  return Array.isArray(items) && items.length > 0;
}

function makeDecision(result, nextAction, reasons = []) {
  return {
    result,
    nextAction,
    reasons: [...new Set(reasons.filter(Boolean))],
  };
}

function stopReason(prefix, values) {
  return (values ?? []).map((value) =>
    typeof value === 'string' ? `${prefix}: ${value}` : `${prefix}: ${JSON.stringify(value)}`,
  );
}

/**
 * Pure M6-1 decision surface.
 *
 * All semantic/project/verification facts must already come from M0-M5 owners.
 * This function only maps those facts to "may execution continue?".
 */
export function decideShadowResult({
  projectState,
  m5,
  recoveryDisposition = 'RESUME',
  planningErrors = [],
  candidateErrors = [],
  drift = {},
  verificationPlan = null,
  manualEvidenceError = null,
  noChangeEstablished = false,
  verificationFailureClass = null,
  independentAuditRequired = false,
  independentAuditSatisfied = false,
  parallelSemanticConflict = false,
} = {}) {
  const reasons = [];

  const m6Available = projectState?.program?.activeMilestone === 'M6 — Closed Execution Loop'
    || projectState?.program?.completedMilestones?.includes('M6 — Closed Execution Loop') === true;
  if (!m6Available) {
    return makeDecision(
      SHADOW_RESULTS.STALE_REPLAN_REQUIRED,
      'REPLAN',
      ['Project State does not yet establish the M6 closed-loop capability'],
    );
  }

  if (!m5?.ok) {
    return makeDecision(
      SHADOW_RESULTS.RECOVERY_REQUIRED,
      'RECOVER',
      stopReason('M5 certification', m5?.errors ?? ['not established']),
    );
  }

  if (recoveryDisposition === 'BLOCKED' || recoveryDisposition === 'RESCUE') {
    return makeDecision(
      SHADOW_RESULTS.RECOVERY_REQUIRED,
      'RECOVER',
      [`M5 recovery disposition is ${recoveryDisposition}`],
    );
  }

  if (planningErrors.length > 0) {
    return makeDecision(
      SHADOW_RESULTS.STALE_REPLAN_REQUIRED,
      'REPLAN',
      stopReason('Work Order planning', planningErrors),
    );
  }

  if (recoveryDisposition === 'REPLAN') {
    return makeDecision(
      SHADOW_RESULTS.STALE_REPLAN_REQUIRED,
      'REPLAN',
      ['M5 recovery requires replanning'],
    );
  }

  if (parallelSemanticConflict) {
    return makeDecision(
      SHADOW_RESULTS.STALE_REPLAN_REQUIRED,
      'REPLAN',
      ['parallel semantic conflict detected'],
    );
  }

  if (candidateErrors.length > 0 || nonEmpty(drift?.outsideExpectedChangeRoots)) {
    reasons.push(...stopReason('candidate', candidateErrors));
    reasons.push(...stopReason('scope drift', drift?.outsideExpectedChangeRoots));
    return makeDecision(
      SHADOW_RESULTS.STALE_REPLAN_REQUIRED,
      'REPLAN',
      reasons,
    );
  }

  if (manualEvidenceError) {
    return makeDecision(
      SHADOW_RESULTS.MANUAL_EVIDENCE_REQUIRED,
      'REQUEST_MANUAL_EVIDENCE',
      [`manual evidence invalid: ${manualEvidenceError}`],
    );
  }

  const blockers = verificationPlan?.blockers ?? {};
  if (
    verificationPlan?.coverage === 'UNKNOWN_COVERAGE'
    || nonEmpty(blockers.unknownCoverage)
    || nonEmpty(blockers.unbound)
    || nonEmpty(blockers.characterizationOnly)
  ) {
    reasons.push(...stopReason('unknown coverage', blockers.unknownCoverage));
    reasons.push(...stopReason('unbound semantic', blockers.unbound));
    reasons.push(...stopReason('characterization-only semantic', blockers.characterizationOnly));
    if (verificationPlan?.coverage === 'UNKNOWN_COVERAGE' && reasons.length === 0) {
      reasons.push('M3 coverage is UNKNOWN_COVERAGE');
    }
    return makeDecision(
      SHADOW_RESULTS.UNKNOWN_COVERAGE,
      'STOP_UNKNOWN',
      reasons,
    );
  }

  if (nonEmpty(blockers.deferredScenarios) || nonEmpty(blockers.deferredSemantics)) {
    reasons.push(...stopReason('deferred scenario', blockers.deferredScenarios));
    reasons.push(...stopReason('deferred semantic', blockers.deferredSemantics));
    return makeDecision(
      SHADOW_RESULTS.OWNER_DECISION_REQUIRED,
      'REQUEST_OWNER_DECISION',
      reasons,
    );
  }

  if (nonEmpty(blockers.manualRequired) || nonEmpty(blockers.manualFailed)) {
    reasons.push(...stopReason('manual scenario', blockers.manualRequired));
    reasons.push(...stopReason('manual failed', blockers.manualFailed));
    return makeDecision(
      SHADOW_RESULTS.MANUAL_EVIDENCE_REQUIRED,
      'REQUEST_MANUAL_EVIDENCE',
      reasons,
    );
  }

  if (verificationFailureClass === 'UNKNOWN_FAILURE') {
    return makeDecision(
      SHADOW_RESULTS.UNKNOWN_COVERAGE,
      'STOP_UNKNOWN',
      ['verification failure could not be classified'],
    );
  }

  if (verificationFailureClass === 'FLAKY_SUSPECTED' || verificationFailureClass === 'INFRA_FAILURE') {
    return makeDecision(
      SHADOW_RESULTS.CONTINUE,
      'RECONCILE_WITHOUT_PRODUCTION_REPAIR',
      [verificationFailureClass === 'FLAKY_SUSPECTED'
        ? 'flaky failure suspected; production repair is not authorized by this signal'
        : 'infrastructure failure identified; production repair is not authorized by this signal'],
    );
  }

  if (verificationFailureClass === 'REAL_REGRESSION') {
    return makeDecision(
      SHADOW_RESULTS.CONTINUE,
      'RECONCILE',
      ['real regression identified; bounded repair may proceed'],
    );
  }

  if (independentAuditRequired && !independentAuditSatisfied) {
    return makeDecision(
      SHADOW_RESULTS.CONTINUE,
      'INDEPENDENT_QA',
      ['AGENTS risk boundary requires independent read-only QA'],
    );
  }

  const changedFiles = verificationPlan?.changedFiles ?? drift?.changedFiles ?? [];
  if (noChangeEstablished && changedFiles.length === 0) {
    return makeDecision(
      SHADOW_RESULTS.NO_CHANGE_REQUIRED,
      'CLOSE_NO_CHANGE',
      ['external evidence established that the requested outcome is already satisfied'],
    );
  }

  return makeDecision(
    SHADOW_RESULTS.CONTINUE,
    changedFiles.length > 0 ? 'PROVE' : 'EXECUTE',
    [],
  );
}

export function inspectShadowController({
  root = DEFAULT_ROOT,
  workOrderPath,
  manualEvidencePath = null,
} = {}) {
  if (!workOrderPath) throw new Error('workOrderPath is required');

  const projectState = readJson(root, PROJECT_STATE_PATH);
  const m5 = certifyM5({ root });
  const workOrder = readWorkOrder(workOrderPath, root);
  const planningErrors = validateWorkOrderAtPlanningBase(workOrder, { root });

  const recovery = reconstructRecovery({
    root,
    workOrderPath,
  });
  const head = recovery.receipt.candidate.head;

  const candidate = validateWorkOrderCandidate(workOrder, {
    root,
    head,
  });

  let verificationPlan = null;
  let verificationPlanError = null;
  try {
    verificationPlan = buildVerificationPlan({
      cwd: root,
      base: workOrder.planningBase,
      head,
    });
  } catch (error) {
    verificationPlanError = error instanceof Error ? error.message : String(error);
  }

  let manualEvidenceError = null;
  if (manualEvidencePath && verificationPlan) {
    try {
      const receipt = readJson(root, manualEvidencePath);
      verificationPlan = applyManualEvidence(verificationPlan, receipt).plan;
    } catch (error) {
      manualEvidenceError = error instanceof Error ? error.message : String(error);
    }
  }

  if (verificationPlanError) {
    verificationPlan = {
      changedFiles: candidate.drift.changedFiles,
      coverage: 'UNKNOWN_COVERAGE',
      blockers: {
        unknownCoverage: [verificationPlanError],
        unbound: [],
        characterizationOnly: [],
        deferredScenarios: [],
        deferredSemantics: [],
        manualRequired: [],
      },
    };
  }

  const decision = decideShadowResult({
    projectState,
    m5,
    recoveryDisposition: recovery.disposition,
    planningErrors,
    candidateErrors: candidate.errors,
    drift: candidate.drift,
    verificationPlan,
    manualEvidenceError,
  });

  return {
    schemaVersion: 1,
    workId: workOrder.workId,
    planningBase: workOrder.planningBase,
    head,
    decision,
    evidence: {
      activeMilestone: projectState.program?.activeMilestone ?? null,
      nextGate: projectState.program?.nextGate ?? null,
      m5Certified: m5.ok,
      recoveryDisposition: recovery.disposition,
      planningErrors,
      candidateErrors: candidate.errors,
      scopeDrift: candidate.drift.outsideExpectedChangeRoots,
      coverage: verificationPlan?.coverage ?? null,
      blockers: verificationPlan?.blockers ?? null,
      requiredTests: verificationPlan?.requiredTests ?? [],
      changedFiles: verificationPlan?.changedFiles ?? candidate.drift.changedFiles,
    },
    authority: {
      semanticVerdict: 'NOT_COMPUTED',
      projectStateMutation: 'NONE',
      externalWriteAuthority: 'NONE',
    },
  };
}

function parseArgs(args) {
  const options = {
    workOrderPath: null,
    manualEvidencePath: null,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--work-order' || arg === '--manual-evidence') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--work-order') options.workOrderPath = value;
      else options.manualEvidencePath = value;
      index += 1;
    } else if (arg === '--json') {
      options.json = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!options.workOrderPath) throw new Error('--work-order is required');
  return options;
}

function printReport(report) {
  console.log(`m6-shadow result: ${report.decision.result}`);
  console.log(`next action: ${report.decision.nextAction}`);
  console.log(`work: ${report.workId}`);
  console.log(`base: ${report.planningBase}`);
  console.log(`head: ${report.head}`);
  console.log(`M5: ${report.evidence.m5Certified ? 'CERTIFIED' : 'NOT_CERTIFIED'}`);
  console.log(`recovery: ${report.evidence.recoveryDisposition}`);
  console.log(`coverage: ${report.evidence.coverage ?? 'NOT_COMPUTED'}`);
  for (const reason of report.decision.reasons) console.log(`reason: ${reason}`);
  console.log('semantic verdict: NOT_COMPUTED');
  console.log('project-state mutation: NONE');
  console.log('external-write authority: NONE');
}

export function runShadowController(options = {}) {
  const report = inspectShadowController(options);
  const success = [
    SHADOW_RESULTS.CONTINUE,
    SHADOW_RESULTS.NO_CHANGE_REQUIRED,
  ].includes(report.decision.result);
  return { exitCode: success ? 0 : 1, report };
}

function cli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Usage: node scripts/checks/m6-shadow-controller.mjs --work-order <path> [--manual-evidence <path>] [--json]');
    process.exitCode = 2;
    return;
  }

  try {
    const result = runShadowController({
      root: DEFAULT_ROOT,
      workOrderPath: options.workOrderPath,
      manualEvidencePath: options.manualEvidencePath,
    });
    if (options.json) process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
    else printReport(result.report);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
