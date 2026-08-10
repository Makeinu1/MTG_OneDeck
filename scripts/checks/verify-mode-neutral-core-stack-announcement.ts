#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createModeNeutralCoreStackAnnouncementSliceV1,
  validateModeNeutralCoreObjectRegistrySliceV2,
  validateModeNeutralCoreStackAnnouncementSliceV1,
} from '../../src/engine/core';
import type {
  CreateModeNeutralCoreStackAnnouncementSliceV1Input,
  ModeNeutralCoreStackAnnouncementSliceV1,
} from '../../src/engine/core';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const registryPath = resolve(repositoryRoot, 'src/engine/core/object/fixtures/object-registry-v2.json');
const announcementPath = resolve(repositoryRoot, 'src/engine/core/stack/fixtures/stack-announcement-v1.json');
const stackSourceRoot = resolve(repositoryRoot, 'src/engine/core/stack');

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record`);
  }
  return value as Record<string, unknown>;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function assertSortedUnique(values: readonly string[], label: string): void {
  for (let index = 1; index < values.length; index += 1) {
    assert(compareCodeUnits(values[index - 1], values[index]) < 0, `${label} is not sorted and unique`);
  }
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      || deepFrozen(descriptor.value, seen);
  });
}

function factoryInput(value: unknown): CreateModeNeutralCoreStackAnnouncementSliceV1Input {
  const root = recordOf(value, 'announcement');
  return { byObject: recordOf(root.byObject, 'announcement.byObject') };
}

function stackRecord(
  slice: ModeNeutralCoreStackAnnouncementSliceV1,
  objectId: string,
): ModeNeutralCoreStackAnnouncementSliceV1['byObject'][keyof ModeNeutralCoreStackAnnouncementSliceV1['byObject']] {
  const record = slice.byObject[objectId as keyof typeof slice.byObject];
  if (record === undefined) throw new Error(`missing stack record: ${objectId}`);
  return record;
}

const registryInput = readJson(registryPath);
const announcementInput = readJson(announcementPath);
const registryBefore = JSON.stringify(registryInput);
const announcementBefore = JSON.stringify(announcementInput);

const registryResult = validateModeNeutralCoreObjectRegistrySliceV2(registryInput);
assert.equal(registryResult.ok, true, JSON.stringify(registryResult));
if (!registryResult.ok) throw new Error('Object Registry V2 fixture rejected');
const registry = registryResult.value;
assert.equal(Object.keys(registry.players).length, 4);

const announcementWithKind = {
  ...recordOf(announcementInput, 'announcement'),
  kind: 'mode-neutral-core-stack-announcement-slice-v1',
};
const result = validateModeNeutralCoreStackAnnouncementSliceV1(registryInput, announcementWithKind);
assert.equal(result.ok, true, JSON.stringify(result));
if (!result.ok) throw new Error('Stack Announcement fixture rejected');
const announcement = result.value;

const stack = registry.zones.shared.stack;
const announcementKeys = Object.keys(announcement.byObject);
const records = announcementKeys.map((objectId) => stackRecord(announcement, objectId));
assert.deepEqual(announcementKeys, stack);
assert.equal(announcementKeys.at(-1), stack.at(-1));
assert.deepEqual(records.map((entry) => entry.kind), [
  'card-spell', 'spell-copy', 'activated-ability', 'triggered-ability',
]);
assert.equal(records.filter((entry) => entry.kind === 'card-spell').length, 1);
assert.equal(records.filter((entry) => entry.kind === 'spell-copy').length, 1);
assert.equal(records.filter((entry) => entry.kind === 'activated-ability').length, 1);
assert.equal(records.filter((entry) => entry.kind === 'triggered-ability').length, 1);

const cardSpell = records[0];
assert.equal(cardSpell.abilityTextSnapshot, null);
assert.equal(cardSpell.chosenModeKeys[0], cardSpell.chosenModeKeys[1]);
const copy = records[1];
assert.equal(copy.announcedVariables.find((entry) => entry.variableKey === 'X')?.value, 0);
const activated = records[2];
assert.equal(activated.abilityTextSnapshot, 'Tap: choose a target and deal X damage.');
assert.equal(activated.targetSelections[0].target.kind, 'object');
if (activated.targetSelections[0].target.kind !== 'object') throw new Error('historical target fixture changed');
assert.equal(activated.targetSelections[0].target.objectId, '@spell-copy:historical-target');
assert.equal(activated.targetSelections[1].target.kind, 'player');
if (activated.targetSelections[1].target.kind !== 'player') throw new Error('historical player fixture changed');
assert.equal(activated.targetSelections[1].target.playerId, 'P99');
assert.equal(activated.distributions.length, 1);
const selectionIds = new Set(activated.targetSelections.map((selection) => selection.selectionId));
for (const assignment of activated.distributions[0].assignments) assert(selectionIds.has(assignment.targetSelectionId));
for (const entry of records) {
  assertSortedUnique(entry.announcedVariables.map((variable) => variable.variableKey), 'variable keys');
  assertSortedUnique(entry.costChoices.additionalCosts.map((cost) => cost.costKey), 'additional cost keys');
  assertSortedUnique(entry.distributions.map((distribution) => distribution.distributionKey), 'distribution keys');
}

assert.equal(deepFrozen(announcement), true);
assert.equal(JSON.stringify(announcement), JSON.stringify(JSON.parse(JSON.stringify(announcement))));
assert.equal(JSON.stringify(registryInput), registryBefore);
assert.equal(JSON.stringify(announcementInput), announcementBefore);

const roundTripInput = JSON.parse(JSON.stringify(announcement)) as unknown;
const roundTrip = validateModeNeutralCoreStackAnnouncementSliceV1(registry, roundTripInput);
assert.equal(roundTrip.ok, true, JSON.stringify(roundTrip));
if (!roundTrip.ok) throw new Error('Stack Announcement JSON round trip rejected');
assert.equal(JSON.stringify(roundTrip.value), JSON.stringify(announcement));

const created = createModeNeutralCoreStackAnnouncementSliceV1(registry, factoryInput(announcementInput));
assert.equal(JSON.stringify(created), JSON.stringify(announcement));
assert.equal(deepFrozen(created), true);

const lifecycleProbe = JSON.parse(JSON.stringify(announcementInput)) as unknown;
const lifecycleRoot = recordOf(lifecycleProbe, 'announcement');
const lifecycleByObject = recordOf(lifecycleRoot.byObject, 'announcement.byObject');
const lifecycleRecord = recordOf(lifecycleByObject[stack[0]], 'lifecycle record');
lifecycleRecord.status = 'proposed';
const lifecycleResult = validateModeNeutralCoreStackAnnouncementSliceV1(
  registry,
  { ...lifecycleRoot, kind: 'mode-neutral-core-stack-announcement-slice-v1' },
);
assert.equal(lifecycleResult.ok, false);
if (lifecycleResult.ok) throw new Error('committed-only lifecycle probe was accepted');
assert(lifecycleResult.issues.some((issue) => issue.code === 'UNKNOWN_FIELD'));

const networkPattern = /\b(?:fetch|WebSocket|XMLHttpRequest|axios)\b/;
for (const fileName of readdirSync(stackSourceRoot).filter((name) => name.endsWith('.ts'))) {
  assert(!networkPattern.test(readFileSync(resolve(stackSourceRoot, fileName), 'utf8')), `network symbol in ${fileName}`);
}

console.log(
  `slice=mode-neutral-core-stack-announcement-slice-v1 stackObjects=${records.length}`
  + ` cardSpells=${records.filter((entry) => entry.kind === 'card-spell').length}`
  + ` spellCopies=${records.filter((entry) => entry.kind === 'spell-copy').length}`
  + ` activatedAbilities=${records.filter((entry) => entry.kind === 'activated-ability').length}`
  + ` triggeredAbilities=${records.filter((entry) => entry.kind === 'triggered-ability').length}`
  + ' validation=ok canonical=ok roundTrip=ok frozen=true',
);
