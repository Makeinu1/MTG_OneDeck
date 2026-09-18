#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  validateDelegation,
  validateWorkOrder,
  validateWorkOrderAtPlanningBase,
} from './work-order.mjs';

const DEFAULT_ROOT = resolve(import.meta.dirname, '../..');
const ROOT_FIXTURE = 'docs/work-protocol/examples/root-implementation.json';
const CHILD_FIXTURE = 'docs/work-protocol/examples/child-evidence.json';
const INVALID_FIXTURE = 'docs/work-protocol/examples/invalid-authority-escalation.json';

function readJson(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

export function checkWorkProtocol(root = DEFAULT_ROOT) {
  const errors = [];
  const rootPacket = readJson(root, ROOT_FIXTURE);
  const childPacket = readJson(root, CHILD_FIXTURE);
  const invalidPacket = readJson(root, INVALID_FIXTURE);

  for (const error of validateWorkOrderAtPlanningBase(rootPacket, { root })) {
    errors.push(`${ROOT_FIXTURE}: ${error}`);
  }
  for (const error of validateWorkOrderAtPlanningBase(childPacket, { root })) {
    errors.push(`${CHILD_FIXTURE}: ${error}`);
  }
  for (const error of validateDelegation(childPacket, rootPacket, { root })) {
    errors.push(`${CHILD_FIXTURE}: ${error}`);
  }

  const invalidErrors = validateWorkOrder(invalidPacket, { root });
  if (!invalidErrors.includes('$.constraints: unknown field authorizedToPush')) {
    errors.push(`${INVALID_FIXTURE}: invalid authority-escalation fixture was not rejected as expected`);
  }

  return {
    errors,
    fixtures: {
      root: ROOT_FIXTURE,
      child: CHILD_FIXTURE,
      invalid: INVALID_FIXTURE,
    },
  };
}

function cli() {
  let result;
  try {
    result = checkWorkProtocol();
  } catch (error) {
    console.error(`work-protocol integrity: ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
    return;
  }

  if (result.errors.length > 0) {
    console.error('work-protocol integrity: FAIL');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log('work-protocol integrity: PASS');
  console.log(`- valid root fixture: ${result.fixtures.root}`);
  console.log(`- valid child fixture: ${result.fixtures.child}`);
  console.log(`- rejected authority-escalation fixture: ${result.fixtures.invalid}`);
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
