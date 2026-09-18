#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseClauses, parseProduct } from './semantic-verification.mjs';

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

function cli() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0].startsWith('-')) {
    console.error('Usage: npm run check:work-order -- <work-order.json>');
    process.exitCode = 2;
    return;
  }

  let workOrder;
  try {
    workOrder = readWorkOrder(args[0]);
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
  console.log('M4-2 validates planningBase references; candidate/delegation checks belong to M4-3.');
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
