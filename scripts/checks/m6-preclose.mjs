#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DEFAULT_ROOT, reconstructRecovery } from './recovery-reconstruction.mjs';
import {
  VERIFICATION_STATUSES,
  runLocalLoopStep,
} from './m6-local-loop.mjs';
import { SHADOW_RESULTS } from './m6-shadow-controller.mjs';
import { runSemanticVerification } from './verify-semantic.mjs';

export const QA_STATUSES = Object.freeze({
  UNCLASSIFIED: 'UNCLASSIFIED',
  NOT_REQUIRED: 'NOT_REQUIRED',
  REQUIRED: 'REQUIRED',
});

function decision(result, nextAction, reasons = []) {
  return {
    result,
    nextAction,
    reasons: [...new Set(reasons.filter(Boolean))],
  };
}

function nonEmpty(items) {
  return Array.isArray(items) && items.length > 0;
}

function readJson(root, path) {
  if (!path) return null;
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

export function mapM3VerificationResult(result) {
  const blockers = result?.plan?.blockers ?? {};

  if (
    result?.plan?.coverage === 'UNKNOWN_COVERAGE'
    || nonEmpty(blockers.unknownCoverage)
    || nonEmpty(blockers.unbound)
    || nonEmpty(blockers.characterizationOnly)
  ) {
    return decision(
      SHADOW_RESULTS.UNKNOWN_COVERAGE,
      'STOP_UNKNOWN',
      ['M3 could not establish bounded candidate coverage'],
    );
  }

  if (nonEmpty(blockers.deferredScenarios) || nonEmpty(blockers.deferredSemantics)) {
    return decision(
      SHADOW_RESULTS.OWNER_DECISION_REQUIRED,
      'REQUEST_OWNER_DECISION',
      ['M3 reports deferred semantic/Acceptance obligations'],
    );
  }

  if (nonEmpty(blockers.manualRequired) || nonEmpty(blockers.manualFailed)) {
    return decision(
      SHADOW_RESULTS.MANUAL_EVIDENCE_REQUIRED,
      'REQUEST_MANUAL_EVIDENCE',
      ['M3 requires exact candidate-bound manual evidence'],
    );
  }

  if (result?.exitCode === 0 && result?.freshness === 'CURRENT_FOR_CANDIDATE') {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'PRE_CLOSE_FRESHNESS',
      ['M3 verification is CURRENT_FOR_CANDIDATE'],
    );
  }

  if ((result?.testExitCode ?? 0) !== 0) {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'CLASSIFY_VERIFICATION_FAILURE',
      ['M3 selected test execution failed; failure class is not inferred automatically'],
    );
  }

  return decision(
    SHADOW_RESULTS.UNKNOWN_COVERAGE,
    'STOP_UNKNOWN',
    ['M3 verification did not establish current candidate freshness'],
  );
}

export function validateQaEvidence(receipt, localEnvelope) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return ['independent QA evidence receipt must be an object'];
  }

  const keys = Object.keys(receipt).sort().join(',');
  if (keys !== 'base,evidenceRef,head,result,schemaVersion') {
    errors.push('independent QA evidence allows only schemaVersion/base/head/result/evidenceRef');
  }
  if (receipt.schemaVersion !== 1) errors.push('independent QA evidence schemaVersion must be 1');
  if (!['PASS', 'FAIL'].includes(receipt.result)) errors.push('independent QA evidence result must be PASS or FAIL');
  if (receipt.base !== localEnvelope?.candidate?.planningBase) errors.push('independent QA evidence base mismatch');
  if (receipt.head !== localEnvelope?.candidate?.head) errors.push('independent QA evidence head mismatch');
  if (typeof receipt.evidenceRef !== 'string' || receipt.evidenceRef.trim() === '') {
    errors.push('independent QA evidence requires evidenceRef');
  }
  return errors;
}

export function evaluateQaBoundary({
  qaStatus = QA_STATUSES.UNCLASSIFIED,
  qaEvidence = null,
  localEnvelope = null,
} = {}) {
  if (!Object.values(QA_STATUSES).includes(qaStatus)) {
    return decision(
      SHADOW_RESULTS.UNKNOWN_COVERAGE,
      'STOP_UNKNOWN',
      [`unknown independent QA requirement status: ${qaStatus}`],
    );
  }

  if (qaStatus === QA_STATUSES.UNCLASSIFIED) {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'CLASSIFY_QA_REQUIREMENT',
      ['AGENTS.md independent-review applicability must be classified explicitly'],
    );
  }

  if (qaStatus === QA_STATUSES.NOT_REQUIRED) return null;

  if (!qaEvidence) {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'INDEPENDENT_QA',
      ['AGENTS.md high-risk boundary requires independent read-only QA evidence'],
    );
  }

  const qaErrors = validateQaEvidence(qaEvidence, localEnvelope);
  if (qaErrors.length > 0) {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'INDEPENDENT_QA',
      qaErrors,
    );
  }

  if (qaEvidence.result === 'FAIL') {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'RECONCILE_QA_FINDINGS',
      ['independent read-only QA returned unresolved findings for the exact candidate'],
    );
  }

  return null;
}

export function decidePreClose({
  localEnvelope,
  recoveryDisposition = 'RESUME',
  qaStatus = QA_STATUSES.UNCLASSIFIED,
  qaEvidence = null,
} = {}) {
  if (!localEnvelope?.decision) throw new Error('localEnvelope decision is required');

  if (recoveryDisposition === 'REPLAN') {
    return decision(
      SHADOW_RESULTS.STALE_REPLAN_REQUIRED,
      'REPLAN',
      ['latest main/current authority changed after candidate verification'],
    );
  }

  if (recoveryDisposition !== 'RESUME') {
    return decision(
      SHADOW_RESULTS.RECOVERY_REQUIRED,
      'RECOVER',
      [`pre-close recovery disposition is ${recoveryDisposition}`],
    );
  }

  if (localEnvelope.decision.result !== SHADOW_RESULTS.CONTINUE
      && localEnvelope.decision.result !== SHADOW_RESULTS.NO_CHANGE_REQUIRED) {
    return localEnvelope.decision;
  }

  if (localEnvelope.decision.result === SHADOW_RESULTS.CONTINUE
      && localEnvelope.action !== 'PRE_CLOSE_FRESHNESS') {
    return localEnvelope.decision;
  }

  const qaBoundary = evaluateQaBoundary({
    qaStatus,
    qaEvidence,
    localEnvelope,
  });
  if (qaBoundary) return qaBoundary;

  if (localEnvelope.decision.result === SHADOW_RESULTS.NO_CHANGE_REQUIRED) {
    return decision(
      SHADOW_RESULTS.COMPLETE,
      'CLOSE_NO_CHANGE',
      ['no-change outcome is current against latest repository reality'],
    );
  }

  return decision(
    SHADOW_RESULTS.COMPLETE,
    'REQUEST_EXTERNAL_WRITE_PERMISSION',
    [
      'exact candidate verification is current against latest main/current authority',
      qaStatus === QA_STATUSES.REQUIRED
        ? 'required independent QA passed for the exact candidate'
        : 'AGENTS.md classification found no independent QA requirement',
    ],
  );
}

function integrationSummary(recovery, qaStatus, qaEvidence) {
  return {
    observedMain: recovery.receipt.observedMain,
    candidateHead: recovery.receipt.candidate.head,
    disposition: recovery.disposition,
    qaStatus,
    qaResult: qaEvidence?.result ?? null,
    qaEvidenceRef: qaEvidence?.evidenceRef ?? null,
    qaPolicySource: 'AGENTS.md',
    externalWriteAuthority: 'NONE',
    remoteWritesPerformed: false,
  };
}

export function runPreCloseGate({
  root = DEFAULT_ROOT,
  workOrderPath,
  manualEvidencePath = null,
  qaStatus = QA_STATUSES.UNCLASSIFIED,
  qaEvidencePath = null,
  noChangeEvidencePath = null,
} = {}) {
  if (!workOrderPath) throw new Error('workOrderPath is required');

  const qaEvidence = readJson(root, qaEvidencePath);
  const initial = runLocalLoopStep({
    root,
    workOrderPath,
    manualEvidencePath,
    verificationStatus: VERIFICATION_STATUSES.NOT_RUN,
    noChangeEvidencePath,
  });

  if (initial.envelope.decision.result === SHADOW_RESULTS.NO_CHANGE_REQUIRED) {
    const recovery = reconstructRecovery({ root, workOrderPath });
    const preClose = decidePreClose({
      localEnvelope: initial.envelope,
      recoveryDisposition: recovery.disposition,
      qaStatus,
      qaEvidence,
    });
    return {
      exitCode: preClose.result === SHADOW_RESULTS.COMPLETE ? 0 : 1,
      decision: preClose,
      envelope: initial.envelope,
      verification: null,
      integration: integrationSummary(recovery, qaStatus, qaEvidence),
    };
  }

  if (initial.envelope.decision.result !== SHADOW_RESULTS.CONTINUE
      || initial.envelope.action !== 'PROVE') {
    return {
      exitCode: 1,
      decision: initial.envelope.decision,
      envelope: initial.envelope,
      verification: null,
      integration: null,
    };
  }

  const verification = runSemanticVerification({
    cwd: root,
    base: initial.envelope.candidate.planningBase,
    head: initial.envelope.candidate.head,
    execute: true,
    writePlan: false,
    manualEvidenceReceipt: readJson(root, manualEvidencePath),
  });
  const verificationDecision = mapM3VerificationResult(verification);

  if (verificationDecision.nextAction !== 'PRE_CLOSE_FRESHNESS') {
    return {
      exitCode: 1,
      decision: verificationDecision,
      envelope: initial.envelope,
      verification: {
        freshness: verification.freshness,
        coverage: verification.plan.coverage,
        testExitCode: verification.testExitCode,
      },
      integration: null,
    };
  }

  const proven = runLocalLoopStep({
    root,
    workOrderPath,
    manualEvidencePath,
    verificationStatus: VERIFICATION_STATUSES.PASS,
  });

  const recovery = reconstructRecovery({ root, workOrderPath });
  const preClose = decidePreClose({
    localEnvelope: proven.envelope,
    recoveryDisposition: recovery.disposition,
    qaStatus,
    qaEvidence,
  });

  return {
    exitCode: preClose.result === SHADOW_RESULTS.COMPLETE ? 0 : 1,
    decision: preClose,
    envelope: proven.envelope,
    verification: {
      freshness: verification.freshness,
      coverage: verification.plan.coverage,
      testExitCode: verification.testExitCode,
    },
    integration: integrationSummary(recovery, qaStatus, qaEvidence),
  };
}

function parseArgs(args) {
  const options = {
    workOrderPath: null,
    manualEvidencePath: null,
    qaStatus: QA_STATUSES.UNCLASSIFIED,
    qaEvidencePath: null,
    noChangeEvidencePath: null,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--work-order' || arg === '--manual-evidence'
        || arg === '--qa-status' || arg === '--qa-evidence'
        || arg === '--no-change-evidence') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--work-order') options.workOrderPath = value;
      else if (arg === '--manual-evidence') options.manualEvidencePath = value;
      else if (arg === '--qa-status') options.qaStatus = value;
      else if (arg === '--qa-evidence') options.qaEvidencePath = value;
      else options.noChangeEvidencePath = value;
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

function cli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Usage: node scripts/checks/m6-preclose.mjs --work-order <path> [--manual-evidence <path>] --qa-status UNCLASSIFIED|NOT_REQUIRED|REQUIRED [--qa-evidence <path>] [--no-change-evidence <path>] [--json]');
    process.exitCode = 2;
    return;
  }

  try {
    const result = runPreCloseGate({
      root: DEFAULT_ROOT,
      workOrderPath: options.workOrderPath,
      manualEvidencePath: options.manualEvidencePath,
      qaStatus: options.qaStatus,
      qaEvidencePath: options.qaEvidencePath,
      noChangeEvidencePath: options.noChangeEvidencePath,
    });
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      console.log(`m6-preclose: ${result.decision.result}`);
      console.log(`next action: ${result.decision.nextAction}`);
      if (result.verification) {
        console.log(`M3 freshness: ${result.verification.freshness}`);
        console.log(`M3 coverage: ${result.verification.coverage}`);
      }
      if (result.integration) {
        console.log(`latest main: ${result.integration.observedMain}`);
        console.log(`candidate: ${result.integration.candidateHead}`);
        console.log(`QA requirement: ${result.integration.qaStatus}`);
        if (result.integration.qaResult) console.log(`QA result: ${result.integration.qaResult}`);
      }
      for (const reason of result.decision.reasons) console.log(`reason: ${reason}`);
      console.log('external-write authority: NONE');
    }
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
