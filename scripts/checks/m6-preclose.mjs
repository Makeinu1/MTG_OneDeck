#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DEFAULT_ROOT, reconstructRecovery } from './recovery-reconstruction.mjs';
import {
  VERIFICATION_STATUSES,
  runLocalLoopStep,
} from './m6-local-loop.mjs';
import { SHADOW_RESULTS } from './m6-shadow-controller.mjs';

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

export function decidePreClose({
  localEnvelope,
  recoveryDisposition = 'RESUME',
  qaStatus = QA_STATUSES.UNCLASSIFIED,
} = {}) {
  if (!localEnvelope?.decision) throw new Error('localEnvelope decision is required');

  if (localEnvelope.decision.result === SHADOW_RESULTS.NO_CHANGE_REQUIRED) {
    if (recoveryDisposition !== 'RESUME') {
      return recoveryDisposition === 'REPLAN'
        ? decision(SHADOW_RESULTS.STALE_REPLAN_REQUIRED, 'REPLAN', ['latest repository reality requires replan'])
        : decision(SHADOW_RESULTS.RECOVERY_REQUIRED, 'RECOVER', [`pre-close recovery disposition is ${recoveryDisposition}`]);
    }
    if (qaStatus === QA_STATUSES.UNCLASSIFIED) {
      return decision(
        SHADOW_RESULTS.CONTINUE,
        'CLASSIFY_QA_REQUIREMENT',
        ['AGENTS.md independent-review applicability must be classified explicitly'],
      );
    }
    if (qaStatus === QA_STATUSES.REQUIRED) {
      return decision(SHADOW_RESULTS.CONTINUE, 'INDEPENDENT_QA', ['independent read-only QA is required']);
    }
    if (qaStatus === QA_STATUSES.FAIL) {
      return decision(SHADOW_RESULTS.CONTINUE, 'RECONCILE_QA_FINDINGS', ['independent QA returned findings']);
    }
    return decision(
      SHADOW_RESULTS.COMPLETE,
      'CLOSE_NO_CHANGE',
      ['no-change outcome is current against latest repository reality'],
    );
  }

  if (localEnvelope.decision.result !== SHADOW_RESULTS.CONTINUE) {
    return localEnvelope.decision;
  }

  if (localEnvelope.action !== 'PRE_CLOSE_FRESHNESS') {
    return localEnvelope.decision;
  }

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

  if (!Object.values(QA_STATUSES).includes(qaStatus)) {
    return decision(
      SHADOW_RESULTS.UNKNOWN_COVERAGE,
      'STOP_UNKNOWN',
      [`unknown independent QA status: ${qaStatus}`],
    );
  }

  if (qaStatus === QA_STATUSES.UNCLASSIFIED) {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'CLASSIFY_QA_REQUIREMENT',
      ['AGENTS.md independent-review applicability must be classified explicitly'],
    );
  }

  if (qaStatus === QA_STATUSES.REQUIRED) {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'INDEPENDENT_QA',
      ['AGENTS.md high-risk boundary requires independent read-only QA'],
    );
  }

  if (qaStatus === QA_STATUSES.FAIL) {
    return decision(
      SHADOW_RESULTS.CONTINUE,
      'RECONCILE_QA_FINDINGS',
      ['independent read-only QA returned unresolved findings'],
    );
  }

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

export function runPreCloseGate({
  root = DEFAULT_ROOT,
  workOrderPath,
  qaStatus = QA_STATUSES.UNCLASSIFIED,
  noChangeEstablished = false,
} = {}) {
  if (!workOrderPath) throw new Error('workOrderPath is required');

  const local = runLocalLoopStep({
    root,
    workOrderPath,
    verificationStatus: VERIFICATION_STATUSES.PASS,
    noChangeEstablished,
  });

  if (![SHADOW_RESULTS.CONTINUE, SHADOW_RESULTS.NO_CHANGE_REQUIRED].includes(local.envelope.decision.result)) {
    return {
      exitCode: 1,
      decision: local.envelope.decision,
      envelope: local.envelope,
      integration: null,
    };
  }

  const recovery = reconstructRecovery({ root, workOrderPath });
  const preClose = decidePreClose({
    localEnvelope: local.envelope,
    recoveryDisposition: recovery.disposition,
    qaStatus,
  });

  return {
    exitCode: preClose.result === SHADOW_RESULTS.COMPLETE ? 0 : 1,
    decision: preClose,
    envelope: local.envelope,
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

function parseArgs(args) {
  const options = {
    workOrderPath: null,
    qaStatus: QA_STATUSES.UNCLASSIFIED,
    noChangeEstablished: false,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--work-order' || arg === '--qa-status') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--work-order') options.workOrderPath = value;
      else options.qaStatus = value;
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
    console.error('Usage: node scripts/checks/m6-preclose.mjs --work-order <path> --qa-status UNCLASSIFIED|NOT_REQUIRED|REQUIRED|PASS|FAIL [--no-change-established] [--json]');
    process.exitCode = 2;
    return;
  }

  try {
    const result = runPreCloseGate({
      root: DEFAULT_ROOT,
      workOrderPath: options.workOrderPath,
      qaStatus: options.qaStatus,
      noChangeEstablished: options.noChangeEstablished,
    });
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      console.log(`m6-preclose: ${result.decision.result}`);
      console.log(`next action: ${result.decision.nextAction}`);
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
