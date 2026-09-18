#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ROOT = resolve(import.meta.dirname, '../..');
const SCHEMA_PATH = 'docs/work-protocol/work-order.schema.json';

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

  const errors = validateWorkOrder(workOrder);
  if (errors.length > 0) {
    console.error('work-order structural validation: FAIL');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log('work-order structural validation: PASS');
  console.log('M4-1 validates packet shape only; repository reference and candidate/delegation checks belong to M4-2/M4-3.');
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
