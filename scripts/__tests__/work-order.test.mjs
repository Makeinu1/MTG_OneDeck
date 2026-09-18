import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
  loadWorkOrderSchema,
  validateWorkOrder,
} from '../checks/work-order.mjs';
import { DEFAULT_ROOT } from '../checks/validation-domain-resolver.mjs';

function validWorkOrder() {
  return {
    schemaVersion: 1,
    workId: 'WO-20260918-001',
    parentWorkId: null,
    title: 'Bounded tooling task',
    planningBase: 'a'.repeat(40),
    goal: 'Produce one bounded tooling change without changing product semantics.',
    authorityRefs: {
      semanticRefs: [],
      paths: ['docs/project-state/index.json'],
    },
    contextRefs: {
      capabilityRefs: ['CR-15'],
    },
    verificationIntent: {
      semanticRefs: [],
      acceptanceRefs: [],
      policy: 'INHERIT_M3',
    },
    scope: {
      targetSemanticRefs: [],
      inputPaths: ['scripts/checks'],
      expectedChangeRoots: ['scripts/checks'],
    },
    nonGoals: ['Do not change gameplay behavior.'],
    protected: {
      paths: ['docs/product-requirements.md'],
      semanticRefs: [],
    },
    constraints: {
      local: ['No dependency additions.'],
    },
    doneWhen: ['The structural validator rejects undeclared fields.'],
    escalateWhen: [],
    review: {
      policy: 'INHERIT_AGENTS',
    },
  };
}

function assertClosedObjects(schema, path = '$') {
  if (schema?.type === 'object') {
    expect(schema.additionalProperties, `${path} must be closed`).toBe(false);
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      assertClosedObjects(child, `${path}.${key}`);
    }
  } else if (schema?.type === 'array' && schema.items) {
    assertClosedObjects(schema.items, `${path}[]`);
  }
}

describe('M4 Work Order structural validation', () => {
  test('accepts the canonical root packet shape', () => {
    expect(validateWorkOrder(validWorkOrder())).toEqual([]);
  });

  test('accepts a structurally valid child identifier without performing M4-3 subset checks', () => {
    const child = validWorkOrder();
    child.workId = 'WO-20260918-002';
    child.parentWorkId = 'WO-20260918-001';
    expect(validateWorkOrder(child)).toEqual([]);
  });

  test('rejects nested authority leakage because every object is closed', () => {
    const candidate = validWorkOrder();
    candidate.constraints.authorizedToPush = true;
    expect(validateWorkOrder(candidate)).toContain('$.constraints: unknown field authorizedToPush');

    const nested = validWorkOrder();
    nested.review.verificationResult = 'PASS';
    expect(validateWorkOrder(nested)).toContain('$.review: unknown field verificationResult');
  });

  test('rejects top-level Project State / permission leakage', () => {
    const candidate = validWorkOrder();
    candidate.currentMilestone = 'M5';
    candidate.authorizedToMerge = true;
    expect(validateWorkOrder(candidate)).toEqual(expect.arrayContaining([
      '$: unknown field currentMilestone',
      '$: unknown field authorizedToMerge',
    ]));
  });

  test('rejects missing required fields, wrong inherited policies and malformed ids', () => {
    const candidate = validWorkOrder();
    delete candidate.goal;
    candidate.workId = 'M4-1';
    candidate.verificationIntent.policy = 'SELF_VERIFIED';
    candidate.review.policy = 'SELF_APPROVED';

    expect(validateWorkOrder(candidate)).toEqual(expect.arrayContaining([
      '$: missing required field goal',
      expect.stringContaining('$.workId: does not match'),
      '$.verificationIntent.policy: expected constant "INHERIT_M3"',
      '$.review.policy: expected constant "INHERIT_AGENTS"',
    ]));
  });

  test('requires an observable Done condition and rejects duplicate scoped values', () => {
    const candidate = validWorkOrder();
    candidate.doneWhen = [];
    candidate.scope.inputPaths = ['src', 'src'];

    expect(validateWorkOrder(candidate)).toEqual(expect.arrayContaining([
      '$.doneWhen: requires at least 1 item(s)',
      '$.scope.inputPaths: duplicate array item "src"',
    ]));
  });

  test('canonical schema is recursively closed', () => {
    assertClosedObjects(loadWorkOrderSchema(DEFAULT_ROOT));
  });

  test('canonical schema file parses as committed JSON', () => {
    expect(() => JSON.parse(readFileSync(
      resolve(DEFAULT_ROOT, 'docs/work-protocol/work-order.schema.json'),
      'utf8',
    ))).not.toThrow();
  });
});
