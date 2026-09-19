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
  PASS: 'PASS',
  FAIL: 'FAIL',
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

function evaluateQaBoundary({ qaStatus, qaHead = null, candidateHead = null } = {}) {
  const qaBoundary = evaluateQaBoundary({
    qaStatus,
    qaHead,
    candidateHead: localEnvelope.candidate?.head ?? null,
  });
  if (qaBoundary) return qaBoundary;

  return decision(
    SHADOW_RESULTS.COMPLETE,
    'REQUEST_EXTERNAL_WRITE_PERMISSION',
    [
      'exact candidate verification is current against latest main/current authority',
      qaStatus === QA_STATUSES.PASS
        ? 'required independent QA passed for the exact candidate'
        : 'AGENTS.md classification found no independent QA requirement',
    ],
  );
}

function readManualEvidence(root, path) {
  if (!path) return null;
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

export function runPreCloseGate({
  root = DEFAULT_ROOT,
  workOrderPath,
  manualEvidencePath = null,
  qaStatus = QA_STATUSES.UNCLASSIFIED,
  qaHead = null,
  noChangeEstablished = false,
} = {}) {
  if (!workOrderPath) throw new Error('workOrderPath is required');

  const initial = runLocalLoopStep({
    root,
    workOrderPath,
    manualEvidencePath,
    verificationStatus: VERIFICATION_STATUSES.NOT_RUN,
    noChangeEstablished,
  });

  if (initial.envelope.decision.result === SHADOW_RESULTS.NO_CHANGE_REQUIRED) {
    const recovery = reconstructRecovery({ root, workOrderPath });
    const preClose = decidePreClose({
      localEnvelope: initial.envelope,
      recoveryDisposition: recovery.disposition,
      qaStatus,
      qaHead,
    });
    return {
      exitCode: preClose.result === SHADOW_RESULTS.COMPLETE ? 0 : 1,
      decision: preClose,
      envelope: initial.envelope,
      verification: null,
      integration: {
        observedMain: recovery.receipt.observedMain,
        candidateHead: recovery.receipt.candidate.head,
        disposition: recovery.disposition,
        qaStatus,
        qaPolicySource: 'AGENTS.md',
        externalWriteAuthority: 'NONE',
        remoteWritesPerformed: false,
      },
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

  const manualEvidenceReceipt = readManualEvidence(root, manualEvidencePath);
  const verification = runSemanticVerification({
    cwd: root,
    base: initial.envelope.candidate.planningBase,
    head: initial.envelope.candidate.head,
    execute: true,
    writePlan: false,
    manualEvidenceReceipt,
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
    integration: {
      observedMain: recovery.receipt.observedMain,
      candidateHead: recovery.receipt.candidate.head,
      disposition: recovery.disposition,
      qaStatus,
      qaHead,
      qaPolicySource: 'AGENTS.md',
      externalWriteAuthority: 'NONE',
      remoteWritesPerformed: false,
    },
  };
}

function parseArgs(args) {
  const options = {
    workOrderPath: null,
    manualEvidencePath: null,
    qaStatus: QA_STATUSES.UNCLASSIFIED,
    qaHead: null,
    noChangeEstablished: false,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--work-order' || arg === '--manual-evidence' || arg === '--qa-status' || arg === '--qa-head') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--work-order') options.workOrderPath = value;
      else if (arg === '--manual-evidence') options.manualEvidencePath = value;
      else if (arg === '--qa-status') options.qaStatus = value;
      else options.qaHead = value;
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

function cli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Usage: node scripts/checks/m6-preclose.mjs --work-order <path> [--manual-evidence <path>] --qa-status UNCLASSIFIED|NOT_REQUIRED|REQUIRED|PASS|FAIL [--qa-head <sha>] [--no-change-established] [--json]');
    process.exitCode = 2;
    return;
  }

  try {
    const result = runPreCloseGate({
      root: DEFAULT_ROOT,
      workOrderPath: options.workOrderPath,
      manualEvidencePath: options.manualEvidencePath,
      qaStatus: options.qaStatus,
      qaHead: options.qaHead,
      noChangeEstablished: options.noChangeEstablished,
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
        console.log(`QA: ${result.integration.qaStatus}`);
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
