#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildVerificationPlan, parseClauses, parseProduct } from './semantic-verification.mjs';

const DEFAULT_ROOT = resolve(import.meta.dirname, '../..');
const SCHEMA_PATH = 'docs/work-protocol/work-order.schema.json';
const PRODUCT_PATH = 'docs/product-requirements.md';
const MANIFEST_PATH = 'docs/contracts/manifest.json';
const SEMANTIC_MAP_PATH = 'docs/contracts/semantic-map.json';
const PROJECT_STATE_PATH = 'docs/project-state/index.json';
const ACCEPTANCE_PATH = 'docs/acceptance/scenarios.json';
const JUDGE_PATH = 'docs/judge-protocol.md';

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeName(value);
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

function stableJson(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(stableJson(item))));
  if (value && typeof value === 'object') {
    return JSON.stringify(Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, JSON.parse(stableJson(value[key]))]),
    ));
  }
  return JSON.stringify(value);
}

export function validateAgainstSchema(value, schema, path = '$') {
  const errors = [];

  if ('const' in schema && value !== schema.const) {
    errors.push(`${path}: expected constant ${JSON.stringify(schema.const)}`);
    return errors;
  }

  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    const expected = Array.isArray(schema.type) ? schema.type.join('|') : schema.type;
    errors.push(`${path}: expected type ${expected}, got ${typeName(value)}`);
    return errors;
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${path}: string shorter than ${schema.minLength}`);
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) {
      errors.push(`${path}: does not match ${schema.pattern}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${path}: requires at least ${schema.minItems} item(s)`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (const item of value) {
        const key = stableJson(item);
        if (seen.has(key)) {
          errors.push(`${path}: duplicate array item ${key}`);
          break;
        }
        seen.add(key);
      }
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateAgainstSchema(item, schema.items, `${path}[${index}]`));
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required field ${key}`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) errors.push(`${path}: unknown field ${key}`);
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) errors.push(...validateAgainstSchema(value[key], childSchema, `${path}.${key}`));
    }
  }

  return errors;
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });
}

function commitExists(root, ref) {
  try {
    git(root, ['cat-file', '-e', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function readAtRef(root, ref, path) {
  try {
    return git(root, ['show', `${ref}:${path}`]);
  } catch {
    return null;
  }
}

function pathExistsAtRef(root, ref, path) {
  try {
    git(root, ['cat-file', '-e', `${ref}:${path}`]);
    return true;
  } catch {
    return false;
  }
}

function parseJsonAtRef(root, ref, path, errors) {
  const text = readAtRef(root, ref, path);
  if (text === null) {
    errors.push(`planningBase: missing required repository source ${path}`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`planningBase: invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function safeRepositoryPath(path) {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (path.startsWith('/') || path.startsWith('./') || path.endsWith('/')) return false;
  if (path.includes('\\') || path.includes('\0') || path.includes('//')) return false;
  const parts = path.split('/');
  return parts.every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function semanticInventoryAtRef(root, ref, manifest, errors) {
  const ids = new Set();
  const productText = readAtRef(root, ref, PRODUCT_PATH);
  if (productText === null) {
    errors.push(`planningBase: missing ${PRODUCT_PATH}`);
  } else {
    for (const id of parseProduct(productText).definitions.keys()) ids.add(id);
  }

  for (const entry of manifest?.contracts ?? []) {
    if (entry?.status !== 'active' || typeof entry.path !== 'string' || !entry.path.endsWith('.md')) continue;
    const text = readAtRef(root, ref, entry.path);
    if (text === null) {
      errors.push(`planningBase: active contract missing ${entry.path}`);
      continue;
    }
    for (const id of parseClauses(text).clauses.keys()) ids.add(id);
  }
  return ids;
}

function canonicalAuthorityPaths(manifest) {
  return new Set([
    PRODUCT_PATH,
    PROJECT_STATE_PATH,
    JUDGE_PATH,
    MANIFEST_PATH,
    SEMANTIC_MAP_PATH,
    ...(manifest?.contracts ?? [])
      .filter((entry) => entry?.status === 'active' && typeof entry.path === 'string')
      .map((entry) => entry.path),
  ]);
}

export function validateWorkOrderReferences(workOrder, { root = DEFAULT_ROOT } = {}) {
  const errors = [];
  const base = workOrder?.planningBase;
  if (typeof base !== 'string' || !/^[0-9a-f]{40}$/u.test(base)) {
    errors.push('planningBase: cannot resolve references without an exact 40-char commit SHA');
    return errors;
  }
  if (!commitExists(root, base)) {
    errors.push(`planningBase: commit does not exist ${base}`);
    return errors;
  }

  const manifest = parseJsonAtRef(root, base, MANIFEST_PATH, errors);
  const projectState = parseJsonAtRef(root, base, PROJECT_STATE_PATH, errors);
  const acceptance = parseJsonAtRef(root, base, ACCEPTANCE_PATH, errors);
  if (!manifest || !projectState || !acceptance) return errors;

  const semanticIds = semanticInventoryAtRef(root, base, manifest, errors);
  const capabilityIds = new Set((projectState.capabilities ?? []).map((entry) => entry?.id).filter(Boolean));
  const acceptanceIds = new Set((acceptance.scenarios ?? []).map((scenario) => scenario?.id).filter(Boolean));
  const authorityPaths = canonicalAuthorityPaths(manifest);

  const semanticRefs = [
    ['authorityRefs.semanticRefs', workOrder.authorityRefs?.semanticRefs ?? []],
    ['verificationIntent.semanticRefs', workOrder.verificationIntent?.semanticRefs ?? []],
    ['scope.targetSemanticRefs', workOrder.scope?.targetSemanticRefs ?? []],
    ['protected.semanticRefs', workOrder.protected?.semanticRefs ?? []],
  ];
  for (const [label, refs] of semanticRefs) {
    for (const id of refs) if (!semanticIds.has(id)) errors.push(`${label}: unresolved semantic ID ${id} at planningBase`);
  }

  for (const id of workOrder.contextRefs?.capabilityRefs ?? []) {
    if (!capabilityIds.has(id)) errors.push(`contextRefs.capabilityRefs: unresolved capability ${id} at planningBase`);
  }
  for (const id of workOrder.verificationIntent?.acceptanceRefs ?? []) {
    if (!acceptanceIds.has(id)) errors.push(`verificationIntent.acceptanceRefs: unresolved Acceptance ${id} at planningBase`);
  }

  for (const path of workOrder.authorityRefs?.paths ?? []) {
    if (!safeRepositoryPath(path)) {
      errors.push(`authorityRefs.paths: unsafe repository path ${path}`);
      continue;
    }
    if (!authorityPaths.has(path)) errors.push(`authorityRefs.paths: not a canonical authority path at planningBase: ${path}`);
    else if (!pathExistsAtRef(root, base, path)) errors.push(`authorityRefs.paths: missing at planningBase: ${path}`);
  }

  for (const [label, paths, requireExists] of [
    ['scope.inputPaths', workOrder.scope?.inputPaths ?? [], true],
    ['scope.expectedChangeRoots', workOrder.scope?.expectedChangeRoots ?? [], false],
    ['protected.paths', workOrder.protected?.paths ?? [], true],
  ]) {
    for (const path of paths) {
      if (!safeRepositoryPath(path)) {
        errors.push(`${label}: unsafe repository path ${path}`);
        continue;
      }
      if (requireExists && !pathExistsAtRef(root, base, path)) errors.push(`${label}: missing at planningBase: ${path}`);
    }
  }

  return errors;
}

function isAncestor(root, base, head) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', base, head], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function changedFilesBetween(root, base, head) {
  const output = git(root, ['diff', '--name-only', base, head]);
  return output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).sort();
}

function pathCoveredBy(path, roots) {
  return roots.some((root) => path === root || path.startsWith(`${root}/`));
}

function authorityImpactReason(reason) {
  return [
    'product-definition:',
    'product-unattributed-prose',
    'contract-clause:',
    'contract-unattributed-prose:',
    'manifest-owner:',
    'semantic-edge:',
  ].some((prefix) => reason.startsWith(prefix));
}

function currentExecutionBoundary(projectState) {
  return {
    activeMilestone: projectState?.program?.activeMilestone ?? null,
    nextGate: projectState?.program?.nextGate ?? null,
    prohibitedScope: projectState?.program?.prohibitedScope ?? [],
  };
}

export function validateDelegation(child, parent, { root = DEFAULT_ROOT } = {}) {
  const errors = [];
  if (!parent) {
    errors.push('delegation: child Work Order requires an explicit parent packet');
    return errors;
  }

  const parentShape = validateWorkOrder(parent, { root });
  if (parentShape.length > 0) {
    errors.push(...parentShape.map((error) => `delegation parent ${error}`));
    return errors;
  }

  if (child.parentWorkId !== parent.workId) {
    errors.push(`delegation: child parentWorkId ${child.parentWorkId} does not match parent workId ${parent.workId}`);
  }
  if (child.planningBase !== parent.planningBase) {
    errors.push('delegation: child and parent must share planningBase; replan explicitly instead of silently rebasing a child');
  }

  const parentTargets = new Set(parent.scope?.targetSemanticRefs ?? []);
  for (const id of child.scope?.targetSemanticRefs ?? []) {
    if (!parentTargets.has(id)) errors.push(`delegation: child target semantic ${id} is outside parent target scope`);
  }

  for (const rootPath of child.scope?.expectedChangeRoots ?? []) {
    if (!pathCoveredBy(rootPath, parent.scope?.expectedChangeRoots ?? [])) {
      errors.push(`delegation: child expected change root ${rootPath} is outside parent change scope`);
    }
  }

  for (const parentPath of parent.protected?.paths ?? []) {
    if (!pathCoveredBy(parentPath, child.protected?.paths ?? [])) {
      errors.push(`delegation: child weakens protected path boundary ${parentPath}`);
    }
  }

  const childProtectedSemantics = new Set(child.protected?.semanticRefs ?? []);
  for (const id of parent.protected?.semanticRefs ?? []) {
    if (!childProtectedSemantics.has(id)) errors.push(`delegation: child weakens protected semantic boundary ${id}`);
  }

  if (child.review?.policy !== parent.review?.policy) {
    errors.push('delegation: child review policy differs from parent');
  }
  if (child.verificationIntent?.policy !== parent.verificationIntent?.policy) {
    errors.push('delegation: child verification policy differs from parent');
  }

  const childTargets = new Set(child.scope?.targetSemanticRefs ?? []);
  const childVerificationSemantics = new Set(child.verificationIntent?.semanticRefs ?? []);
  for (const id of parent.verificationIntent?.semanticRefs ?? []) {
    if (childTargets.has(id) && !childVerificationSemantics.has(id)) {
      errors.push(`delegation: child drops parent verification semantic ${id} inside child target scope`);
    }
  }

  const acceptanceErrors = [];
  const acceptance = parseJsonAtRef(root, parent.planningBase, ACCEPTANCE_PATH, acceptanceErrors);
  errors.push(...acceptanceErrors.map((error) => `delegation ${error}`));
  if (acceptance) {
    const scenarios = new Map((acceptance.scenarios ?? []).map((scenario) => [scenario.id, scenario]));
    const childAcceptance = new Set(child.verificationIntent?.acceptanceRefs ?? []);
    for (const scenarioId of parent.verificationIntent?.acceptanceRefs ?? []) {
      const scenario = scenarios.get(scenarioId);
      if (!scenario) continue;
      if ((scenario.verifies ?? []).some((id) => childTargets.has(id)) && !childAcceptance.has(scenarioId)) {
        errors.push(`delegation: child drops parent Acceptance ${scenarioId} relevant to child target scope`);
      }
    }
  }

  return errors;
}

export function validateWorkOrderCandidate(workOrder, {
  root = DEFAULT_ROOT,
  head,
  parentWorkOrder = null,
} = {}) {
  const errors = [];
  const drift = {
    changedFiles: [],
    outsideExpectedChangeRoots: [],
    authorityPathChanges: [],
    authoritySemanticChanges: [],
    protectedPathChanges: [],
  };

  if (typeof head !== 'string' || !/^[0-9a-f]{40}$/u.test(head)) {
    errors.push('candidate: explicit 40-char head commit SHA is required');
    return { errors, drift };
  }
  if (!commitExists(root, head)) {
    errors.push(`candidate: head commit does not exist ${head}`);
    return { errors, drift };
  }
  if (!isAncestor(root, workOrder.planningBase, head)) {
    errors.push('candidate: planningBase is not an ancestor of head; replan instead of validating a divergent candidate');
    return { errors, drift };
  }

  const candidateRefs = validateWorkOrderReferences({ ...workOrder, planningBase: head }, { root });
  errors.push(...candidateRefs.map((error) => error.replaceAll('planningBase', 'candidate')));

  const baseStateErrors = [];
  const headStateErrors = [];
  const baseState = parseJsonAtRef(root, workOrder.planningBase, PROJECT_STATE_PATH, baseStateErrors);
  const headState = parseJsonAtRef(root, head, PROJECT_STATE_PATH, headStateErrors);
  errors.push(...baseStateErrors.map((error) => error.replaceAll('planningBase', 'candidate base')));
  errors.push(...headStateErrors.map((error) => error.replaceAll('planningBase', 'candidate head')));
  if (baseState && headState
      && stableJson(currentExecutionBoundary(baseState)) !== stableJson(currentExecutionBoundary(headState))) {
    errors.push('candidate: Project State execution boundary changed since planning; reinspection/replan required');
  }

  const changedFiles = changedFilesBetween(root, workOrder.planningBase, head);
  drift.changedFiles = changedFiles;
  drift.outsideExpectedChangeRoots = changedFiles.filter(
    (path) => !pathCoveredBy(path, workOrder.scope?.expectedChangeRoots ?? []),
  );

  for (const protectedPath of workOrder.protected?.paths ?? []) {
    for (const path of changedFiles) {
      if (path === protectedPath || path.startsWith(`${protectedPath}/`)) {
        drift.protectedPathChanges.push(path);
        errors.push(`candidate: protected path changed ${path}`);
      }
    }
  }

  for (const authorityPath of workOrder.authorityRefs?.paths ?? []) {
    if (readAtRef(root, workOrder.planningBase, authorityPath) !== readAtRef(root, head, authorityPath)) {
      drift.authorityPathChanges.push(authorityPath);
      errors.push(`candidate: referenced authority path changed since planning ${authorityPath}`);
    }
  }

  let verificationPlan;
  try {
    verificationPlan = buildVerificationPlan({ cwd: root, base: workOrder.planningBase, head });
  } catch (error) {
    errors.push(`candidate: unable to compute M3.1 impact: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (verificationPlan) {
    const guarded = new Set([
      ...(workOrder.authorityRefs?.semanticRefs ?? []),
      ...(workOrder.protected?.semanticRefs ?? []),
    ]);
    for (const id of guarded) {
      const reasons = verificationPlan.semanticImpact?.[id] ?? [];
      const authorityReasons = reasons.filter(authorityImpactReason);
      if (authorityReasons.length > 0) {
        drift.authoritySemanticChanges.push({ id, reasons: authorityReasons });
        errors.push(`candidate: referenced/protected semantic authority changed since planning ${id} (${authorityReasons.join(', ')})`);
      }
    }
  }

  if (workOrder.parentWorkId !== null) {
    errors.push(...validateDelegation(workOrder, parentWorkOrder, { root }));
  } else if (parentWorkOrder !== null) {
    errors.push('delegation: root Work Order must not be validated with a parent packet');
  }

  return {
    errors: [...new Set(errors)],
    drift: {
      ...drift,
      changedFiles: [...new Set(drift.changedFiles)].sort(),
      outsideExpectedChangeRoots: [...new Set(drift.outsideExpectedChangeRoots)].sort(),
      authorityPathChanges: [...new Set(drift.authorityPathChanges)].sort(),
      protectedPathChanges: [...new Set(drift.protectedPathChanges)].sort(),
    },
  };
}

export function validateWorkOrderAtPlanningBase(workOrder, options = {}) {
  const structural = validateWorkOrder(workOrder, options);
  if (structural.length > 0) return structural;
  return validateWorkOrderReferences(workOrder, options);
}

export function loadWorkOrderSchema(root = DEFAULT_ROOT) {
  return JSON.parse(readFileSync(resolve(root, SCHEMA_PATH), 'utf8'));
}

export function validateWorkOrder(workOrder, { root = DEFAULT_ROOT, schema = loadWorkOrderSchema(root) } = {}) {
  return validateAgainstSchema(workOrder, schema);
}

export function readWorkOrder(path, root = DEFAULT_ROOT) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function parseCliArgs(args) {
  const options = { path: null, head: null, parentPath: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--head' || arg === '--parent') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--head') options.head = value;
      else options.parentPath = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('-') || options.path !== null) throw new Error(`unknown argument ${arg}`);
    options.path = arg;
  }
  if (!options.path) throw new Error('work-order path is required');
  if (options.parentPath && !options.head) throw new Error('--parent requires --head candidate validation');
  return options;
}

function cli() {
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Usage: npm run check:work-order -- <work-order.json> [--head <sha>] [--parent <parent-work-order.json>]');
    process.exitCode = 2;
    return;
  }

  let workOrder;
  let parentWorkOrder = null;
  try {
    workOrder = readWorkOrder(options.path);
    if (options.parentPath) parentWorkOrder = readWorkOrder(options.parentPath);
  } catch (error) {
    console.error(`work-order: unable to read JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
    return;
  }

  const structuralErrors = validateWorkOrder(workOrder);
  if (structuralErrors.length > 0) {
    console.error('work-order structural validation: FAIL');
    for (const error of structuralErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('work-order structural validation: PASS');

  const referenceErrors = validateWorkOrderReferences(workOrder);
  if (referenceErrors.length > 0) {
    console.error('work-order planning-snapshot references: FAIL');
    for (const error of referenceErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('work-order planning-snapshot references: PASS');

  if (!options.head) {
    console.log('M4-2 complete for this packet; pass --head for M4-3 candidate/delegation validation.');
    return;
  }

  const candidate = validateWorkOrderCandidate(workOrder, {
    head: options.head,
    parentWorkOrder,
  });
  if (candidate.errors.length > 0) {
    console.error('work-order candidate/delegation validation: FAIL');
    for (const error of candidate.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log('work-order candidate/delegation validation: PASS');
  if (candidate.drift.outsideExpectedChangeRoots.length > 0) {
    console.log('work-order scope drift: REVIEW_REQUIRED');
    for (const path of candidate.drift.outsideExpectedChangeRoots) console.log(`- outside expectedChangeRoots: ${path}`);
  } else {
    console.log('work-order scope drift: NONE');
  }
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
