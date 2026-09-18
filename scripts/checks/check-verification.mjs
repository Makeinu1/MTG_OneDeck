#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  parseClauses,
  parseProduct,
  readCurrentVerificationState,
  verificationConstants,
} from './semantic-verification.mjs';
import { DEFAULT_ROOT } from './validation-domain-resolver.mjs';

export function checkVerificationIntegrity(root = DEFAULT_ROOT) {
  const errors = [];
  const { manifest, traceability, scenarios } = readCurrentVerificationState(root);
  const constants = verificationConstants();

  const productText = readFileSync(resolve(root, constants.PRODUCT_PATH), 'utf8');
  const productIds = new Set(parseProduct(productText).definitions.keys());

  const semanticOwners = new Map();
  for (const entry of manifest.contracts ?? []) {
    if (entry?.status !== 'active' || extname(entry.path ?? '') !== '.md') continue;
    const path = resolve(root, entry.path);
    if (!existsSync(path)) continue;
    const parsed = parseClauses(readFileSync(path, 'utf8'));
    for (const id of parsed.clauses.keys()) {
      if (semanticOwners.has(id)) errors.push(`duplicate semantic ID ${id}`);
      else semanticOwners.set(id, entry.path);
    }
  }
  const semanticIds = new Set([...productIds, ...semanticOwners.keys()]);

  if (traceability.schemaVersion !== 2) errors.push('traceability schemaVersion must be 2');
  const traceIds = new Set();
  for (const clause of traceability.clauses ?? []) {
    const label = `traceability ${clause?.id ?? '<unknown>'}`;
    if (!clause || typeof clause !== 'object') {
      errors.push('traceability row must be an object');
      continue;
    }
    if (traceIds.has(clause.id)) errors.push(`${label}: duplicate ID`);
    traceIds.add(clause.id);
    if (!semanticOwners.has(clause.id)) errors.push(`${label}: direct binding must target an active contract semantic ID`);
    if (semanticOwners.get(clause.id) !== clause.sourcePath) errors.push(`${label}: sourcePath must match semantic owner`);

    if (!['automated', 'manual', 'deferred-needs-decision'].includes(clause.verificationDisposition)) {
      errors.push(`${label}: invalid verificationDisposition ${clause.verificationDisposition}`);
    }
    if (!Array.isArray(clause.evidenceBindings)) errors.push(`${label}: evidenceBindings must be an array`);
    if (clause.verificationDisposition === 'automated' && clause.evidenceBindings?.length === 0) {
      errors.push(`${label}: automated disposition requires evidenceBindings`);
    }
    if (clause.verificationDisposition === 'manual' && typeof clause.manualProcedure !== 'string') {
      errors.push(`${label}: manual disposition requires manualProcedure`);
    }
    if (clause.verificationDisposition === 'deferred-needs-decision' && typeof clause.needsDecision !== 'string') {
      errors.push(`${label}: deferred disposition requires needsDecision`);
    }

    for (const binding of clause.evidenceBindings ?? []) {
      if (binding?.kind !== 'automated') errors.push(`${label}: direct evidence kind must be automated`);
      if (!['conformance', 'characterization'].includes(binding?.role)) errors.push(`${label}: invalid evidence role ${binding?.role}`);
      if (typeof binding?.path !== 'string' || typeof binding?.marker !== 'string') {
        errors.push(`${label}: evidence path/marker required`);
        continue;
      }
      const path = resolve(root, binding.path);
      if (!existsSync(path)) {
        errors.push(`${label}: evidence path missing ${binding.path}`);
        continue;
      }
      const text = readFileSync(path, 'utf8');
      if (!text.includes(binding.marker)) errors.push(`${label}: evidence marker missing in ${binding.path}`);
      if (binding.marker.startsWith('verifies: ') && binding.marker.slice('verifies: '.length) !== clause.id) {
        errors.push(`${label}: evidence marker points to another semantic ID`);
      }
    }
  }

  const scenarioIds = new Set();
  for (const scenario of scenarios.scenarios ?? []) {
    const label = `scenario ${scenario?.id ?? '<unknown>'}`;
    if (!scenario || typeof scenario !== 'object') {
      errors.push('scenario must be an object');
      continue;
    }
    if (scenarioIds.has(scenario.id)) errors.push(`${label}: duplicate ID`);
    scenarioIds.add(scenario.id);
    if (!/^ACC-[A-Z0-9-]+$/u.test(scenario.id ?? '')) errors.push(`${label}: invalid ID`);
    if (!['active', 'deferred', 'periodic'].includes(scenario.status)) errors.push(`${label}: invalid status`);
    if (!Array.isArray(scenario.verifies)) errors.push(`${label}: verifies must be an array`);
    for (const id of scenario.verifies ?? []) if (!semanticIds.has(id)) errors.push(`${label}: unresolved semantic target ${id}`);

    if (!Array.isArray(scenario.automatedBy)) errors.push(`${label}: automatedBy must be an array`);
    if (scenario.manualOnly === false && scenario.automatedBy?.length === 0) errors.push(`${label}: automated scenario requires automatedBy`);
    if (scenario.manualOnly === true && scenario.automatedBy?.length > 0) errors.push(`${label}: manual scenario must not claim automatedBy`);

    for (const evidencePath of scenario.automatedBy ?? []) {
      const path = resolve(root, evidencePath);
      if (!existsSync(path)) {
        errors.push(`${label}: automatedBy path missing ${evidencePath}`);
        continue;
      }
      const marker = `scenario: ${scenario.id}`;
      if (!readFileSync(path, 'utf8').includes(marker)) errors.push(`${label}: marker missing in ${evidencePath}`);
    }
  }

  return {
    errors,
    counts: {
      semanticIds: semanticIds.size,
      directBindings: traceIds.size,
      scenarios: scenarioIds.size,
    },
  };
}

function cli() {
  const result = checkVerificationIntegrity();
  if (result.errors.length > 0) {
    console.error('verification integrity: FAIL');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`verification integrity: PASS (${result.counts.semanticIds} semantic IDs, ${result.counts.directBindings} direct bindings, ${result.counts.scenarios} scenarios)`);
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
