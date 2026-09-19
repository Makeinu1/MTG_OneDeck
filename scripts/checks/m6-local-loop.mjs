#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_ROOT,
  SHADOW_RESULTS,
  inspectShadowController,
} from './m6-shadow-controller.mjs';
import { readWorkOrder } from './work-order.mjs';

export const VERIFICATION_STATUSES = Object.freeze({
  NOT_RUN: 'NOT_RUN',
  PASS: 'PASS',
  FAIL: 'FAIL',
});

export const FAILURE_CLASSES = Object.freeze([
  'REAL_REGRESSION',
  'STALE_TEST',
  'STALE_FIXTURE',
  'INFRA_FAILURE',
  'FLAKY_SUSPECTED',
  'MANUAL_EVIDENCE_MISSING',
  'EXPECTED_AUTHORIZED_CHANGE',
  'UNKNOWN_FAILURE',
]);

const NON_PRODUCTION_REPAIR_FAILURES = new Set([
  'STALE_TEST',
  'STALE_FIXTURE',
  'INFRA_FAILURE',
  'FLAKY_SUSPECTED',
  'EXPECTED_AUTHORIZED_CHANGE',
]);

function decision(result, nextAction, reasons = []) {
  return {
    result,
    nextAction,
    reasons: [...new Set(reasons.filter(Boolean))],
  };
}

export function applyRuntimeSignal(report, {
  verificationStatus = VERIFICATION_STATUSES.NOT_RUN,
  failureClass = null,
  noChangeEstablished = false,
} = {}) {
  const baseline = report?.decision;
  if (!baseline) throw new Error('shadow report decision is required');

  if (![VERIFICATION_STATUSES.NOT_RUN, VERIFICATION_STATUSES.PASS, VERIFICATION_STATUSES.FAIL]
    .includes(verificationStatus)) {
    return decision(
      SHADOW_RESULTS.UNKNOWN_COVERAGE,
      'STOP_UNKNOWN',
      [`unknown verification status: ${verificationStatus}`],
    );
  }

  if (![SHADOW_RESULTS.CONTINUE, SHADOW_RESULTS.NO_CHANGE_REQUIRED].includes(baseline.result)) {
    return baseline;
  }

  const changedFiles = report?.evidence?.changedFiles ?? [];
  if (noChangeEstablished && changedFiles.length === 0) {
    return decision(
      SHADOW_RESULTS.NO_CHANGE_REQUIRED,
      'CLOSE_NO_CHANGE',
      ['external evidence established that the requested outcome is already satisfied'],
    );
  }

  if (verificationStatus === VERIFICATION_STATUSES.NOT_RUN) return baseline;

  if (verificationStatus === VERIFICATION_STATUSES.PASS) {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'PRE_CLOSE_FRESHNESS',
      ['candidate-relative verification passed for the exact candidate'],
    );
  }

  if (!failureClass || !FAILURE_CLASSES.includes(failureClass)) {
    return decision(
      SHADOW_RESULTS.UNKNOWN_COVERAGE,
      'STOP_UNKNOWN',
      [failureClass
        ? `unknown verification failure class: ${failureClass}`
        : 'verification failed without a classified failure'],
    );
  }

  if (failureClass === 'REAL_REGRESSION') {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'RECONCILE',
      ['real regression identified; bounded local repair may proceed'],
    );
  }

  if (failureClass === 'MANUAL_EVIDENCE_MISSING') {
    return decision(
      SHADOW_RESULTS.MANUAL_EVIDENCE_REQUIRED,
      'REQUEST_MANUAL_EVIDENCE',
      ['required manual evidence is missing'],
    );
  }

  if (failureClass === 'UNKNOWN_FAILURE') {
    return decision(
      SHADOW_RESULTS.UNKNOWN_COVERAGE,
      'STOP_UNKNOWN',
      ['verification failure could not be classified safely'],
    );
  }

  if (NON_PRODUCTION_REPAIR_FAILURES.has(failureClass)) {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'RECONCILE_WITHOUT_PRODUCTION_REPAIR',
      [`${failureClass} does not authorize production repair`],
    );
  }

  return decision(
    SHADOW_RESULTS.UNKNOWN_COVERAGE,
    'STOP_UNKNOWN',
    [`unhandled verification failure class: ${failureClass}`],
  );
}

export function buildLocalExecutionEnvelope({
  report,
  workOrder,
  verificationStatus = VERIFICATION_STATUSES.NOT_RUN,
  failureClass = null,
  noChangeEstablished = false,
} = {}) {
  if (!report || !workOrder) throw new Error('report and workOrder are required');

  const loopDecision = applyRuntimeSignal(report, {
    verificationStatus,
    failureClass,
    noChangeEstablished,
  });

  return {
    schemaVersion: 1,
    mode: 'LOCAL_ONLY',
    workId: workOrder.workId,
    action: loopDecision.nextAction,
    decision: loopDecision,
    candidate: {
      planningBase: report.planningBase,
      head: report.head,
      exactCommitRequiredBeforeProof: true,
    },
    writeBoundary: {
      allowedRoots: [...(workOrder.scope?.expectedChangeRoots ?? [])],
      protectedPaths: [...(workOrder.protected?.paths ?? [])],
      protectedSemanticRefs: [...(workOrder.protected?.semanticRefs ?? [])],
      nonGoals: [...(workOrder.nonGoals ?? [])],
    },
    verification: {
      status: verificationStatus,
      failureClass,
      coverage: report.evidence?.coverage ?? null,
      requiredTests: [...(report.evidence?.requiredTests ?? [])],
    },
    authority: {
      semanticVerdict: 'NOT_COMPUTED',
      projectStateMutation: 'NONE',
      externalWriteAuthority: 'NONE',
      remoteWrites: 'FORBIDDEN',
    },
  };
}

export function runLocalLoopStep({
  root = DEFAULT_ROOT,
  workOrderPath,
  manualEvidencePath = null,
  verificationStatus = VERIFICATION_STATUSES.NOT_RUN,
  failureClass = null,
  noChangeEstablished = false,
} = {}) {
  if (!workOrderPath) throw new Error('workOrderPath is required');

  const report = inspectShadowController({
    root,
    workOrderPath,
    manualEvidencePath,
  });
  const workOrder = readWorkOrder(workOrderPath, root);
  const envelope = buildLocalExecutionEnvelope({
    report,
    workOrder,
    verificationStatus,
    failureClass,
    noChangeEstablished,
  });

  return {
    exitCode: [
      SHADOW_RESULTS.CONTINUE,
      SHADOW_RESULTS.NO_CHANGE_REQUIRED,
    ].includes(envelope.decision.result) ? 0 : 1,
    envelope,
  };
}

function parseArgs(args) {
  const options = {
    workOrderPath: null,
    manualEvidencePath: null,
    verificationStatus: VERIFICATION_STATUSES.NOT_RUN,
    failureClass: null,
    noChangeEstablished: false,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--work-order' || arg === '--manual-evidence'
      || arg === '--verification-status' || arg === '--failure-class') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--work-order') options.workOrderPath = value;
      else if (arg === '--manual-evidence') options.manualEvidencePath = value;
      else if (arg === '--verification-status') options.verificationStatus = value;
      else options.failureClass = value;
      index += 1;
    } else if (arg === '--no-change-established') {
      options.noChangeEstablished = true;
    } else if (arg === '--json') {
      options.json = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!options.workOrderPath) throw new Error('--work-order is required');
  return options;
}

function printEnvelope(envelope) {
  console.log(`m6-local mode: ${envelope.mode}`);
  console.log(`action: ${envelope.action}`);
  console.log(`result: ${envelope.decision.result}`);
  console.log(`work: ${envelope.workId}`);
  console.log(`candidate: ${envelope.candidate.head}`);
  console.log(`verification: ${envelope.verification.status}`);
  if (envelope.verification.failureClass) {
    console.log(`failure class: ${envelope.verification.failureClass}`);
  }
  for (const reason of envelope.decision.reasons) console.log(`reason: ${reason}`);
  console.log('remote writes: FORBIDDEN');
}

function cli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Usage: node scripts/checks/m6-local-loop.mjs --work-order <path> [--manual-evidence <path>] [--verification-status NOT_RUN|PASS|FAIL] [--failure-class <class>] [--no-change-established] [--json]');
    process.exitCode = 2;
    return;
  }

  try {
    const result = runLocalLoopStep({
      root: DEFAULT_ROOT,
      workOrderPath: options.workOrderPath,
      manualEvidencePath: options.manualEvidencePath,
      verificationStatus: options.verificationStatus,
      failureClass: options.failureClass,
      noChangeEstablished: options.noChangeEstablished,
    });
    if (options.json) process.stdout.write(`${JSON.stringify(result.envelope, null, 2)}\n`);
    else printEnvelope(result.envelope);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
