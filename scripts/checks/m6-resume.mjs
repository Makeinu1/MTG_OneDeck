#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_ROOT,
  reconstructRecovery,
  validateRecoveryReceipt,
} from './recovery-reconstruction.mjs';
import { runLocalLoopStep } from './m6-local-loop.mjs';
import { SHADOW_RESULTS } from './m6-shadow-controller.mjs';

function decision(result, nextAction, reasons = []) {
  return { result, nextAction, reasons: [...new Set(reasons.filter(Boolean))] };
}

export function mapRecoveryDisposition(disposition, diagnostics = {}) {
  if (disposition === 'RESUME') {
    return decision(SHADOW_RESULTS.CONTINUE, 'RESUME', []);
  }
  if (disposition === 'REPLAN') {
    return decision(
      SHADOW_RESULTS.STALE_REPLAN_REQUIRED,
      'REPLAN',
      ['M5 recovery requires replanning'],
    );
  }
  if (disposition === 'RESCUE') {
    return decision(
      SHADOW_RESULTS.RECOVERY_REQUIRED,
      'RECOVER',
      ['candidate diverged from observed main; rescue is required before resume'],
    );
  }
  return decision(
    SHADOW_RESULTS.RECOVERY_REQUIRED,
    'RECOVER',
    Object.values(diagnostics).flat().map((item) => String(item)),
  );
}

export function resumeFromRecovery({
  root = DEFAULT_ROOT,
  workOrderPath,
  receiptPath = null,
} = {}) {
  if (!workOrderPath) throw new Error('workOrderPath is required');

  let suppliedReceiptErrors = [];
  if (receiptPath) {
    const receipt = JSON.parse(readFileSync(resolve(root, receiptPath), 'utf8'));
    suppliedReceiptErrors = validateRecoveryReceipt(receipt, { root });
    if (suppliedReceiptErrors.length > 0) {
      return {
        exitCode: 1,
        decision: decision(
          SHADOW_RESULTS.RECOVERY_REQUIRED,
          'RECOVER',
          suppliedReceiptErrors.map((error) => `supplied receipt: ${error}`),
        ),
        recovery: null,
        envelope: null,
      };
    }
  }

  const recovery = reconstructRecovery({ root, workOrderPath });
  const recoveryDecision = mapRecoveryDisposition(
    recovery.disposition,
    recovery.diagnostics,
  );

  if (recovery.disposition !== 'RESUME') {
    return {
      exitCode: 1,
      decision: recoveryDecision,
      recovery,
      envelope: null,
    };
  }

  const local = runLocalLoopStep({
    root,
    workOrderPath,
  });

  return {
    exitCode: local.exitCode,
    decision: decision(
      local.envelope.decision.result,
      local.envelope.action,
      [
        'fresh-session recovery disposition RESUME',
        ...local.envelope.decision.reasons,
      ],
    ),
    recovery,
    envelope: {
      ...local.envelope,
      resume: {
        source: receiptPath ? 'SUPPLIED_M5_RECEIPT' : 'RECONSTRUCTED_CURRENT_REALITY',
        disposition: recovery.disposition,
      },
    },
  };
}

function parseArgs(args) {
  const options = { workOrderPath: null, receiptPath: null, json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--work-order' || arg === '--receipt') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--work-order') options.workOrderPath = value;
      else options.receiptPath = value;
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
    console.error('Usage: node scripts/checks/m6-resume.mjs --work-order <path> [--receipt <path>] [--json]');
    process.exitCode = 2;
    return;
  }

  try {
    const result = resumeFromRecovery({
      root: DEFAULT_ROOT,
      workOrderPath: options.workOrderPath,
      receiptPath: options.receiptPath,
    });
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      console.log(`m6-resume: ${result.decision.result}`);
      console.log(`next action: ${result.decision.nextAction}`);
      if (result.recovery) console.log(`recovery: ${result.recovery.disposition}`);
      if (result.envelope) console.log(`candidate: ${result.envelope.candidate.head}`);
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
