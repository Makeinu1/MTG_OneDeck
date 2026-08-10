import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as coreApi from '../../../index';

type Raw = Record<string, unknown>;
type CoreFunction = (...args: unknown[]) => unknown;

const CARD_IDS = {
  library: 'PC1:0',
  hand: 'PC2:0',
  graveyard: 'PC3:0',
  battlefield: 'PC4:1',
  command: 'PC7:0',
  exile: 'PC6:0',
} as const;

const NEXT_CARD_IDS = {
  library: 'PC1:1',
  hand: 'PC2:1',
  graveyard: 'PC3:1',
  battlefield: 'PC4:2',
  command: 'PC7:1',
  exile: 'PC6:1',
} as const;

const STACK_CARD = 'PC5:1';
const SPELL_COPY = '@spell-copy:fixture-copy';
const ACTIVATED = '@activated-ability:fixture-activation';
const TRIGGERED = '@triggered-ability:fixture-trigger';
const SYNTHETIC_IDS = [SPELL_COPY, ACTIVATED, TRIGGERED] as const;
const TRANSACTION_CODES = [
  'INVALID_TRANSACTION_BUNDLE',
  'INVALID_OPERATION_INPUT',
  'SOURCE_NOT_FOUND',
  'SOURCE_NOT_ON_STACK',
  'SOURCE_ALREADY_ON_STACK',
  'OBJECT_ALREADY_EXISTS',
  'OBJECT_KIND_MISMATCH',
  'ANNOUNCEMENT_KIND_MISMATCH',
  'INVALID_DESTINATION',
  'ID_COLLISION',
  'CARD_TRANSITION_FAILED',
  'TARGET_SELECTION_NOT_FOUND',
  'DUPLICATE_TARGET_REPLACEMENT',
  'RETARGET_STRUCTURE_MISMATCH',
  'CANDIDATE_INVALID',
] as const;

function isRecord(value: unknown): value is Raw {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function record(value: unknown, label: string): Raw {
  if (!isRecord(value)) throw new Error(`${label} must be a plain record`);
  return value;
}

function values(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function readJson(path: URL): unknown {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return parsed;
}

function clone(value: unknown): unknown {
  const cloned: unknown = JSON.parse(JSON.stringify(value));
  return cloned;
}

function cloneRecord(value: Raw, label: string): Raw {
  return record(clone(value), label);
}

function apiFunction(name: string): CoreFunction {
  const candidate: unknown = Reflect.get(coreApi, name);
  if (typeof candidate !== 'function') throw new Error(`missing required Core export: ${name}`);
  return (...args: unknown[]) => Reflect.apply(candidate, undefined, args) as unknown;
}

function call(name: string, ...args: unknown[]): unknown {
  return apiFunction(name)(...args);
}

function byObject(root: Raw, label: string): Raw {
  return record(root.byObject, `${label}.byObject`);
}

function objects(root: Raw, label: string): Raw {
  return record(root.objects, `${label}.objects`);
}

function zones(root: Raw, label: string): Raw {
  return record(root.zones, `${label}.zones`);
}

function sharedZones(root: Raw, label: string): Raw {
  return record(zones(root, label).shared, `${label}.zones.shared`);
}

function playerZones(root: Raw, playerId: string, label: string): Raw {
  const byPlayer = record(zones(root, label).byPlayer, `${label}.zones.byPlayer`);
  return record(byPlayer[playerId], `${label}.zones.byPlayer.${playerId}`);
}

function entry(root: Raw, objectId: string, label: string): unknown {
  const table = Object.prototype.hasOwnProperty.call(root, 'byObject') ? byObject(root, label) : root;
  return table[objectId];
}

function row(root: Raw, objectId: string, label: string): Raw {
  return record(entry(root, objectId, label), `${label}.${objectId}`);
}

function arrayAt(root: Raw, key: string, label: string): readonly unknown[] {
  return values(root[key], `${label}.${key}`);
}

function fixture(path: string): Raw {
  return record(readJson(new URL(path, import.meta.url)), path);
}

function registryInput(): Raw {
  return fixture('../../../object/fixtures/object-registry-v2.json');
}

function runtimeInput(): Raw {
  const runtime = fixture('../../../fixtures/card-runtime-slice-v1.json');
  const runtimeRows = byObject(runtime, 'runtime fixture');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  runtimeRows['@token:fixture-token:0'] = clone(row(runtime, 'PC4:1', 'runtime fixture'));
  return runtime;
}

function announcementsInput(): Raw {
  const announcements = fixture('../../fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  return announcements;
}

function bundleInput(): Raw {
  return {
    objectRegistry: registryInput(),
    objectRuntime: runtimeInput(),
    stackAnnouncements: announcementsInput(),
  };
}

function validBundle(): Raw {
  return record(call('createCoreStackTransactionBundleV1', bundleInput()), 'transaction bundle');
}

function validation(value: unknown, label: string): Raw {
  return record(value, label);
}

function acceptedValidation(value: unknown, label: string): Raw {
  const result = validation(value, label);
  expect(result.ok).toBe(true);
  if (result.ok !== true) throw new Error(`${label} was rejected`);
  return record(result.value, `${label}.value`);
}

function rejectedValidation(value: unknown, label: string): readonly Raw[] {
  const result = validation(value, label);
  expect(result.ok).toBe(false);
  if (result.ok !== false) throw new Error(`${label} was accepted`);
  return Object.freeze(values(result.issues, `${label}.issues`).map((issue, index) =>
    record(issue, `${label}.issues[${index}]`),
  ));
}

function issueCodes(issues: readonly Raw[]): string[] {
  return issues.map((issue) => String(issue.code));
}

function nestedIssueCodes(issues: readonly Raw[]): string[] {
  return issues.flatMap((issue) => {
    const nested = issue.nested;
    if (!Array.isArray(nested)) return [String(issue.code)];
    return [String(issue.code), ...nestedIssueCodes(values(nested, 'nested').map((item) => record(item, 'nested issue')) )];
  });
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      assertDeepFrozen(descriptor.value, seen);
    }
  }
}

function errorProperty(error: unknown, key: string): unknown {
  if (error === null || (typeof error !== 'object' && typeof error !== 'function')) return undefined;
  return Reflect.get(error, key);
}

function thrown(operation: () => unknown): Raw {
  let error: unknown;
  try {
    operation();
  } catch (caught: unknown) {
    error = caught;
  }
  expect(error).toBeDefined();
  const result: Raw = {};
  result.name = errorProperty(error, 'name');
  result.code = errorProperty(error, 'code');
  result.issues = errorProperty(error, 'issues');
  result.error = error;
  return result;
}

function assertTransactionError(error: Raw, code: string): void {
  expect(error.name).toBe('CoreStackTransactionErrorV1');
  expect(error.code).toBe(code);
  expect(TRANSACTION_CODES).toContain(error.code);
  const issues = values(error.issues, 'transaction error issues');
  expect(issues.length).toBeGreaterThan(0);
  assertDeepFrozen(error.issues);
  for (const issue of issues) expect(issue).not.toBeInstanceOf(Error);
  expect(Object.prototype.hasOwnProperty.call(error, 'error')).toBe(true);
}

function transactionResult(value: unknown, label: string): Raw {
  return record(value, label);
}

function cardAnnouncement(): Raw {
  return cloneRecord(row(announcementsInput(), STACK_CARD, 'announcement fixture'), 'card announcement');
}

function syntheticObject(kind: string): Raw {
  if (kind === 'spell-copy') {
    return {
      kind,
      definitionId: 'def.fixture-card',
      controllerPlayerId: 'P1',
      copiedFromObjectId: '@spell-copy:historical-source',
    };
  }
  return {
    kind,
    controllerPlayerId: 'P1',
    sourceObjectId: '@activated-ability:historical-source',
    abilityKey: `${kind}-acceptance-ability`,
  };
}

function syntheticAnnouncement(objectId: string): Raw {
  return cloneRecord(row(announcementsInput(), objectId, 'announcement fixture'), 'synthetic announcement');
}

function commitCard(bundle: Raw, sourceObjectId: string, controllerPlayerId = 'P3'): Raw {
  return transactionResult(call('commitCoreCardSpellToStackV1', bundle, {
    sourceObjectId,
    controllerPlayerId,
    announcement: cardAnnouncement(),
  }), 'card commit result');
}

function commitSynthetic(bundle: Raw, kind: string, objectId: string): Raw {
  return transactionResult(call('commitCoreSyntheticStackObjectV1', bundle, {
    objectId,
    object: syntheticObject(kind),
    announcement: syntheticAnnouncement(kind === 'spell-copy' ? SPELL_COPY : kind === 'activated-ability' ? ACTIVATED : TRIGGERED),
  }), 'synthetic commit result');
}

function reverseRecord(value: Raw): Raw {
  const result: Raw = {};
  for (const [key, child] of Object.entries(value).reverse()) result[key] = child;
  return result;
}

function reversedBundleInput(): Raw {
  const input = bundleInput();
  const registry = record(input.objectRegistry, 'reversed registry');
  registry.players = reverseRecord(record(registry.players, 'reversed players'));
  registry.cardDefinitions = reverseRecord(record(registry.cardDefinitions, 'reversed definitions'));
  registry.physicalCards = reverseRecord(record(registry.physicalCards, 'reversed physical cards'));
  registry.objects = reverseRecord(record(registry.objects, 'reversed objects'));
  const registryZones = record(registry.zones, 'reversed zones');
  registryZones.byPlayer = reverseRecord(record(registryZones.byPlayer, 'reversed byPlayer'));
  registry.zones = registryZones;
  const runtime = record(input.objectRuntime, 'reversed runtime');
  runtime.byObject = reverseRecord(record(runtime.byObject, 'reversed runtime rows'));
  const announcements = record(input.stackAnnouncements, 'reversed announcements');
  const announcementRows = record(announcements.byObject, 'announcement rows');
  const canonicalAnnouncementRows: Raw = {};
  const reversedRegistryZones = record(record(input.objectRegistry, 'reversed registry').zones, 'reversed registry zones');
  const reversedSharedZones = record(reversedRegistryZones.shared, 'reversed shared zones');
  for (const value of arrayAt(reversedSharedZones, 'stack', 'reversed stack')) {
    const objectId = String(value);
    canonicalAnnouncementRows[objectId] = announcementRows[objectId];
  }
  announcements.byObject = canonicalAnnouncementRows;
  return input;
}

function stackOrder(bundle: Raw): string[] {
  return arrayAt(sharedZones(objectsBundle(bundle), 'stack order'), 'stack', 'stack order').map(String);
}

function objectsBundle(bundle: Raw): Raw {
  return record(bundle.objectRegistry, 'bundle.objectRegistry');
}

function allZoneIds(registry: Raw): string[] {
  const result: string[] = [];
  const zoneRoot = zones(registry, 'registry');
  const byPlayer = record(zoneRoot.byPlayer, 'registry.zones.byPlayer');
  for (const player of Object.values(byPlayer)) {
    const playerZone = record(player, 'player zones');
    for (const zone of ['library', 'hand', 'graveyard']) result.push(...arrayAt(playerZone, zone, `player zone ${zone}`).map(String));
  }
  const shared = record(zoneRoot.shared, 'registry.zones.shared');
  for (const zone of ['battlefield', 'stack', 'exile', 'command']) result.push(...arrayAt(shared, zone, `shared zone ${zone}`).map(String));
  return result;
}

function placeCardMiddle(): Raw {
  const input = bundleInput();
  const registry = record(input.objectRegistry, 'middle registry');
  const shared = record(record(registry.zones, 'middle zones').shared, 'middle shared');
  shared.stack = [SPELL_COPY, STACK_CARD, ACTIVATED, TRIGGERED];
  const announcements = record(input.stackAnnouncements, 'middle announcements');
  const source = record(announcements.byObject, 'middle announcement rows');
  const ordered: Raw = {};
  for (const id of [SPELL_COPY, STACK_CARD, ACTIVATED, TRIGGERED]) ordered[id] = source[id];
  announcements.byObject = ordered;
  return validBundleFromInput(input);
}

function validBundleFromInput(input: Raw): Raw {
  return record(call('createCoreStackTransactionBundleV1', input), 'transaction bundle');
}

describe('O4P-01J atomic stack transaction acceptance pins', () => {
  it('validates and creates the exact three-slice bundle, preserving existing V2/I validation boundaries', () => {
    const input = bundleInput();
    const result = acceptedValidation(call('validateCoreStackTransactionBundleV1', input), 'valid bundle');
    expect(Object.keys(result)).toEqual(['objectRegistry', 'objectRuntime', 'stackAnnouncements']);
    expect(JSON.stringify(result)).toBe(JSON.stringify(validBundle()));
    assertDeepFrozen(result);
    expect(typeof Reflect.get(coreApi, 'validateModeNeutralCoreObjectRegistrySliceV2')).toBe('function');
    expect(typeof Reflect.get(coreApi, 'validateModeNeutralCoreObjectRuntimeSliceV2')).toBe('function');
    expect(typeof Reflect.get(coreApi, 'validateModeNeutralCoreStackAnnouncementSliceV1')).toBe('function');
    expect(JSON.stringify(input)).toBe(JSON.stringify(bundleInput()));
  });

  it('rejects invalid Registry, Runtime, and Announcement inputs as one frozen transaction failure', () => {
    const cases: Array<readonly [string, (input: Raw) => void]> = [
      ['registry', (input) => {
        const registry = record(input.objectRegistry, 'invalid registry');
        delete objects(registry, 'invalid registry')['PC1:0'];
      }],
      ['runtime', (input) => {
        const runtime = record(input.objectRuntime, 'invalid runtime');
        delete byObject(runtime, 'invalid runtime')['PC1:0'];
      }],
      ['announcement', (input) => {
        const announcements = record(input.stackAnnouncements, 'invalid announcements');
        delete byObject(announcements, 'invalid announcements')[STACK_CARD];
      }],
    ];
    for (const [label, corrupt] of cases) {
      const input = bundleInput();
      corrupt(input);
      const before = JSON.stringify(input);
      const issues = rejectedValidation(call('validateCoreStackTransactionBundleV1', input), `${label} rejection`);
      expect(issueCodes(issues)).toContain('INVALID_TRANSACTION_BUNDLE');
      expect(nestedIssueCodes(issues).length).toBeGreaterThan(1);
      assertDeepFrozen(issues);
      expect(JSON.stringify(input)).toBe(before);
    }
  });

  it.each([
    ['library', CARD_IDS.library, NEXT_CARD_IDS.library],
    ['hand', CARD_IDS.hand, NEXT_CARD_IDS.hand],
    ['graveyard', CARD_IDS.graveyard, NEXT_CARD_IDS.graveyard],
    ['exile', CARD_IDS.exile, NEXT_CARD_IDS.exile],
    ['command', CARD_IDS.command, NEXT_CARD_IDS.command],
    ['battlefield', CARD_IDS.battlefield, NEXT_CARD_IDS.battlefield],
  ])('commits a card from %s with one new incarnation, reset Runtime, Announcement, and stack-tail append', (_zone, sourceId, nextId) => {
    const bundle = validBundle();
    const beforeRegistry = clone(record(bundle.objectRegistry, 'before registry'));
    const beforeRuntime = JSON.stringify(bundle.objectRuntime);
    const beforeAnnouncements = JSON.stringify(bundle.stackAnnouncements);
    const result = commitCard(bundle, sourceId);
    const nextBundle = record(result.bundle, 'card commit bundle');
    const registry = record(nextBundle.objectRegistry, 'card commit registry');
    const runtime = record(nextBundle.objectRuntime, 'card commit runtime');
    const announcements = record(nextBundle.stackAnnouncements, 'card commit announcements');
    expect(result.previousObjectId).toBe(sourceId);
    expect(result.committedObjectId).toBe(nextId);
    expect(objects(registry, 'card commit')[sourceId]).toBeUndefined();
    const committed = row(objects(registry, 'card commit'), nextId, 'committed object');
    expect(committed.kind).toBe('card');
    expect(committed.physicalCardId).toBe(String(sourceId).split(':')[0]);
    expect(committed.incarnation).toBe(Number(String(sourceId).split(':')[1]) + 1);
    expect(committed.baseControllerPlayerId).toBe('P3');
    expect(entry(byObject(runtime, 'card commit runtime'), sourceId, 'old runtime')).toBeUndefined();
    expect(entry(byObject(runtime, 'card commit runtime'), nextId, 'new runtime')).toEqual({
      orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false },
      counterDamage: { counters: [], markedDamage: 0 },
      attachment: { attachedTo: null },
    });
    expect(row(byObject(announcements, 'card commit announcement'), nextId, 'new announcement')).toEqual(cardAnnouncement());
    expect(stackOrder(nextBundle).at(-1)).toBe(nextId);
    expect(allZoneIds(registry)).not.toContain(sourceId);
    expect(allZoneIds(registry)).toContain(nextId);
    const physicalId = String(committed.physicalCardId);
    const physical = record(record(registry.physicalCards, 'physical cards')[physicalId], 'physical card');
    expect(physical.ownerPlayerId).toBe(sourceId === CARD_IDS.command ? 'P1' : sourceId === CARD_IDS.exile ? 'P4' : sourceId === CARD_IDS.graveyard ? 'P2' : sourceId === CARD_IDS.battlefield ? 'P2' : 'P1');
    expect(JSON.stringify(bundle.objectRuntime)).toBe(beforeRuntime);
    expect(JSON.stringify(bundle.stackAnnouncements)).toBe(beforeAnnouncements);
    expect(JSON.stringify(bundle.objectRegistry)).toBe(JSON.stringify(beforeRegistry));
    assertDeepFrozen(result);
  });

  it('commits each synthetic stack kind at the tail without a Runtime row or PhysicalCard mutation', () => {
    const cases: Array<readonly [string, string]> = [
      ['spell-copy', '@spell-copy:acceptance-copy'],
      ['activated-ability', '@activated-ability:acceptance-activation'],
      ['triggered-ability', '@triggered-ability:acceptance-trigger'],
    ];
    for (const [kind, objectId] of cases) {
      const bundle = validBundle();
      const beforeRuntime = JSON.stringify(bundle.objectRuntime);
      const beforePhysicalCards = JSON.stringify(record(bundle.objectRegistry, 'synthetic registry').physicalCards);
      const beforeStack = stackOrder(bundle);
      const result = commitSynthetic(bundle, kind, objectId);
      const nextBundle = record(result.bundle, 'synthetic result bundle');
      const registry = record(nextBundle.objectRegistry, 'synthetic result registry');
      expect(result.committedObjectId).toBe(objectId);
      expect(row(objects(registry, 'synthetic registry'), objectId, 'synthetic identity').kind).toBe(kind);
      expect(stackOrder(nextBundle)).toEqual([...beforeStack, objectId]);
      expect(row(byObject(record(nextBundle.stackAnnouncements, 'synthetic announcements'), 'synthetic announcements'), objectId, 'synthetic announcement').kind).toBe(kind);
      expect(JSON.stringify(nextBundle.objectRuntime)).toBe(beforeRuntime);
      expect(JSON.stringify(record(registry, 'synthetic registry').physicalCards)).toBe(beforePhysicalCards);
      expect(allZoneIds(registry)).toContain(objectId);
      expect(entry(byObject(record(nextBundle.objectRuntime, 'synthetic runtime'), 'synthetic runtime'), objectId, 'synthetic runtime')).toBeUndefined();
    }
  });

  it('rejects duplicate synthetic IDs and object/announcement kind mismatches', () => {
    const duplicate = thrown(() => commitSynthetic(validBundle(), 'spell-copy', SPELL_COPY));
    assertTransactionError(duplicate, 'OBJECT_ALREADY_EXISTS');
    const mismatchInput = {
      objectId: '@spell-copy:acceptance-mismatch',
      object: syntheticObject('activated-ability'),
      announcement: syntheticAnnouncement(SPELL_COPY),
    };
    const mismatch = thrown(() => call('commitCoreSyntheticStackObjectV1', validBundle(), mismatchInput));
    expect(['OBJECT_KIND_MISMATCH', 'ANNOUNCEMENT_KIND_MISMATCH', 'INVALID_OPERATION_INPUT']).toContain(mismatch.code);
    assertDeepFrozen(mismatch.issues);
  });

  it('retargets one, all, subset, and empty/no-op selections without changing any non-target announcement value', () => {
    const oneBundle = validBundle();
    const oneBefore = row(byObject(record(oneBundle.stackAnnouncements, 'one stack announcements'), 'one announcement'), SPELL_COPY, 'one announcement');
    const one = transactionResult(call('retargetCoreStackObjectV1', oneBundle, {
      objectId: SPELL_COPY,
      replacements: [{ selectionId: 'copy-player', target: { kind: 'object', objectId: '@spell-copy:historical-target' } }],
    }), 'one-target retarget');
    const oneAfter = row(byObject(record(record(one.bundle, 'one result').stackAnnouncements, 'one result stack announcements'), 'one result announcement'), SPELL_COPY, 'one result announcement');
    expect(oneAfter.targetSelections).toEqual([{
      selectionId: 'copy-player',
      groupKey: 'copy-target',
      target: { kind: 'object', objectId: '@spell-copy:historical-target' },
    }]);
    expect(oneAfter.chosenModeKeys).toEqual(oneBefore.chosenModeKeys);
    expect(oneAfter.announcedVariables).toEqual(oneBefore.announcedVariables);
    expect(JSON.stringify(oneAfter.distributions)).toBe(JSON.stringify(oneBefore.distributions));
    expect(JSON.stringify(oneAfter.costChoices)).toBe(JSON.stringify(oneBefore.costChoices));
    expect(oneAfter.abilityTextSnapshot).toBe(oneBefore.abilityTextSnapshot);
    expect(oneAfter.kind).toBe(oneBefore.kind);

    const allBundle = validBundle();
    const allBefore = row(byObject(record(allBundle.stackAnnouncements, 'all stack announcements'), 'all announcement'), STACK_CARD, 'all announcement');
    const all = transactionResult(call('retargetCoreStackObjectV1', allBundle, {
      objectId: STACK_CARD,
      replacements: [
        { selectionId: 'card-object', target: { kind: 'object', objectId: '@spell-copy:historical-all' } },
        { selectionId: 'card-player', target: { kind: 'player', playerId: 'P4' } },
      ],
    }), 'all-target retarget');
    const allAfter = row(byObject(record(record(all.bundle, 'all result').stackAnnouncements, 'all result stack announcements'), 'all result announcement'), STACK_CARD, 'all result announcement');
    expect(arrayAt(allAfter, 'targetSelections', 'all targets').map((item) => record(item, 'target')).map((item) => String(item.selectionId))).toEqual(['card-object', 'card-player']);
    expect(arrayAt(allAfter, 'targetSelections', 'all targets').map((item) => record(item, 'target')).map((item) => String(record(record(item.target, 'target ref'), 'target ref').kind))).toEqual(['object', 'player']);
    expect(allAfter.chosenModeKeys).toEqual(allBefore.chosenModeKeys);
    expect(allAfter.announcedVariables).toEqual(allBefore.announcedVariables);
    expect(JSON.stringify(allAfter.distributions)).toBe(JSON.stringify(allBefore.distributions));
    expect(JSON.stringify(allAfter.costChoices)).toBe(JSON.stringify(allBefore.costChoices));
    expect(allAfter.abilityTextSnapshot).toBe(allBefore.abilityTextSnapshot);
    expect(allAfter.kind).toBe(allBefore.kind);

    const subsetBundle = validBundle();
    const subset = transactionResult(call('retargetCoreStackObjectV1', subsetBundle, {
      objectId: STACK_CARD,
      replacements: [{ selectionId: 'card-player', target: { kind: 'object', objectId: '@activated-ability:historical-subset' } }],
    }), 'subset-target retarget');
    const subsetAfter = row(byObject(record(record(subset.bundle, 'subset result').stackAnnouncements, 'subset result stack announcements'), 'subset result announcement'), STACK_CARD, 'subset result announcement');
    const subsetTargets = arrayAt(subsetAfter, 'targetSelections', 'subset targets').map((item) => record(item, 'subset target'));
    expect(subsetTargets[0]?.target).toEqual({ kind: 'object', objectId: 'PC4:1' });
    expect(subsetTargets[1]?.target).toEqual({ kind: 'object', objectId: '@activated-ability:historical-subset' });
    expect(subsetTargets.map((item) => String(item.selectionId))).toEqual(['card-object', 'card-player']);
    expect(subsetTargets.map((item) => String(item.groupKey))).toEqual(['primary', 'secondary']);

    const emptyBundle = validBundle();
    const emptyBefore = JSON.stringify(emptyBundle);
    const empty = transactionResult(call('retargetCoreStackObjectV1', emptyBundle, { objectId: STACK_CARD, replacements: [] }), 'empty retarget');
    expect(JSON.stringify(empty.bundle)).toBe(emptyBefore);
    const sameTarget = transactionResult(call('retargetCoreStackObjectV1', validBundle(), {
      objectId: STACK_CARD,
      replacements: [{ selectionId: 'card-object', target: { kind: 'object', objectId: 'PC4:1' } }],
    }), 'same-target retarget');
    expect(row(byObject(record(record(sameTarget.bundle, 'same target').stackAnnouncements, 'same target announcements'), 'same target announcement'), STACK_CARD, 'same target announcement')).toEqual(allBefore);
  });

  it('accepts historical target references without legality/existence checks and rejects duplicate or missing replacement IDs', () => {
    const historical = transactionResult(call('retargetCoreStackObjectV1', validBundle(), {
      objectId: ACTIVATED,
      replacements: [{ selectionId: 'ability-history', target: { kind: 'object', objectId: '@spell-copy:historical-not-live' } }],
    }), 'historical retarget');
    expect(row(byObject(record(record(historical.bundle, 'historical bundle').stackAnnouncements, 'historical stack announcements'), 'historical announcements'), ACTIVATED, 'historical announcement').targetSelections).toEqual([
      { selectionId: 'ability-history', groupKey: 'damage-a', target: { kind: 'object', objectId: '@spell-copy:historical-not-live' } },
      { selectionId: 'ability-player', groupKey: 'damage-b', target: { kind: 'player', playerId: 'P99' } },
    ]);
    for (const replacements of [
      [
        { selectionId: 'ability-history', target: { kind: 'player', playerId: 'P1' } },
        { selectionId: 'ability-history', target: { kind: 'player', playerId: 'P2' } },
      ],
      [{ selectionId: 'not-present', target: { kind: 'player', playerId: 'P1' } }],
    ]) {
      const failure = thrown(() => call('retargetCoreStackObjectV1', validBundle(), { objectId: ACTIVATED, replacements }));
      expect(['DUPLICATE_TARGET_REPLACEMENT', 'TARGET_SELECTION_NOT_FOUND', 'RETARGET_STRUCTURE_MISMATCH']).toContain(failure.code);
      assertDeepFrozen(failure.issues);
    }
  });

  it('rejects same-group duplicate target structure at the transaction bundle boundary', () => {
    const input = bundleInput();
    const announcements = record(input.stackAnnouncements, 'duplicate-group announcements');
    const recordValue = row(byObject(announcements, 'duplicate-group announcements'), STACK_CARD, 'duplicate-group card');
    const selections = arrayAt(recordValue, 'targetSelections', 'duplicate-group selections').map((item) => clone(item));
    const first = record(selections[0], 'duplicate-group first selection');
    const second = record(selections[1], 'duplicate-group second selection');
    second.groupKey = 'primary';
    second.target = first.target;
    recordValue.targetSelections = selections;
    const before = JSON.stringify(input);
    const issues = rejectedValidation(call('validateCoreStackTransactionBundleV1', input), 'duplicate-group bundle');
    expect(nestedIssueCodes(issues)).toContain('DUPLICATE_TARGET_IN_GROUP');
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    ['owner-graveyard', { kind: 'owner-graveyard' }, 'P3', null],
    ['battlefield', { kind: 'battlefield', baseControllerPlayerId: 'P4' }, 'shared', 'P4'],
    ['owner-hand', { kind: 'owner-hand' }, 'P3', null],
    ['exile', { kind: 'exile' }, 'shared', null],
    ['command', { kind: 'command' }, 'shared', null],
  ])('removes a card to %s with owner routing, supplied battlefield controller, new incarnation, and Runtime reset', (_label, destination, ownerOrShared, controller) => {
    const bundle = validBundle();
    const beforeStack = stackOrder(bundle);
    const result = transactionResult(call('removeCoreStackObjectV1', bundle, {
      kind: 'card-to-zone',
      objectId: STACK_CARD,
      destination,
    }), 'card removal result');
    const nextBundle = record(result.bundle, 'card removal bundle');
    const registry = record(nextBundle.objectRegistry, 'card removal registry');
    const runtime = record(nextBundle.objectRuntime, 'card removal runtime');
    expect(result.removedObjectId).toBe(STACK_CARD);
    expect(result.nextObjectId).toBe('PC5:2');
    expect(objects(registry, 'card removal')[STACK_CARD]).toBeUndefined();
    const nextObject = row(objects(registry, 'card removal'), 'PC5:2', 'card removal new object');
    expect(nextObject.physicalCardId).toBe('PC5');
    expect(nextObject.incarnation).toBe(2);
    expect(nextObject.baseControllerPlayerId).toBe(controller);
    expect(entry(byObject(runtime, 'card removal runtime'), STACK_CARD, 'removed runtime')).toBeUndefined();
    expect(entry(byObject(runtime, 'card removal runtime'), 'PC5:2', 'reset runtime')).toEqual({
      orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false },
      counterDamage: { counters: [], markedDamage: 0 },
      attachment: { attachedTo: null },
    });
    expect(entry(byObject(record(nextBundle.stackAnnouncements, 'removed stack announcements'), 'removed announcement'), STACK_CARD, 'removed announcement')).toBeUndefined();
    expect(stackOrder(nextBundle)).toEqual(beforeStack.slice(1));
    if (ownerOrShared === 'shared') {
      expect(arrayAt(sharedZones(registry, 'card removal'), String(destination.kind), 'shared destination')).toContain('PC5:2');
    } else {
      expect(arrayAt(playerZones(registry, ownerOrShared, 'card removal'), String(destination.kind).replace('owner-', ''), 'owner destination')).toContain('PC5:2');
    }
  });

  it('removes a middle-stack card while preserving the relative order of all other entries', () => {
    const bundle = placeCardMiddle();
    const result = transactionResult(call('removeCoreStackObjectV1', bundle, {
      kind: 'card-to-zone',
      objectId: STACK_CARD,
      destination: { kind: 'owner-graveyard' },
    }), 'middle card removal');
    expect(stackOrder(record(result.bundle, 'middle removal bundle'))).toEqual([SPELL_COPY, ACTIVATED, TRIGGERED]);
  });

  it('ceases spell-copy, activated-ability, and triggered-ability objects without generating Runtime or destination objects', () => {
    for (const objectId of SYNTHETIC_IDS) {
      const bundle = validBundle();
      const beforeRuntime = JSON.stringify(bundle.objectRuntime);
      const beforePhysicalCards = JSON.stringify(record(bundle.objectRegistry, 'cease registry').physicalCards);
      const beforeStack = stackOrder(bundle);
      const result = transactionResult(call('removeCoreStackObjectV1', bundle, { kind: 'cease', objectId }), 'cease result');
      const nextBundle = record(result.bundle, 'cease bundle');
      const registry = record(nextBundle.objectRegistry, 'cease registry');
      expect(result.removedObjectId).toBe(objectId);
      expect(result.nextObjectId).toBeNull();
      expect(objects(registry, 'cease registry')[objectId]).toBeUndefined();
      expect(entry(byObject(record(nextBundle.stackAnnouncements, 'cease stack announcements'), 'cease announcements'), objectId, 'cease announcement')).toBeUndefined();
      expect(stackOrder(nextBundle)).toEqual(beforeStack.filter((candidate) => candidate !== objectId));
      expect(JSON.stringify(nextBundle.objectRuntime)).toBe(beforeRuntime);
      expect(JSON.stringify(record(registry, 'cease registry').physicalCards)).toBe(beforePhysicalCards);
      expect(allZoneIds(registry)).not.toContain(objectId);
    }
  });

  it('rejects card cease, synthetic card-to-zone, invalid destinations, and on-stack card commit atomically', () => {
    const cases: Array<readonly [string, () => unknown]> = [
      ['card cease', () => call('removeCoreStackObjectV1', validBundle(), { kind: 'cease', objectId: STACK_CARD })],
      ['synthetic card exit', () => call('removeCoreStackObjectV1', validBundle(), { kind: 'card-to-zone', objectId: SPELL_COPY, destination: { kind: 'exile' } })],
      ['stack destination', () => call('removeCoreStackObjectV1', validBundle(), { kind: 'card-to-zone', objectId: STACK_CARD, destination: { kind: 'stack', baseControllerPlayerId: 'P1' } })],
      ['on-stack card commit', () => commitCard(validBundle(), STACK_CARD)],
    ];
    for (const [label, operation] of cases) {
      const failure = thrown(operation);
      expect(['OBJECT_KIND_MISMATCH', 'INVALID_DESTINATION', 'SOURCE_ALREADY_ON_STACK', 'SOURCE_NOT_ON_STACK', 'INVALID_OPERATION_INPUT']).toContain(failure.code);
      expect(values(failure.issues, `${label} issues`).length).toBeGreaterThan(0);
      expect(Object.prototype.hasOwnProperty.call(failure, 'bundle')).toBe(false);
      assertDeepFrozen(failure.issues);
    }
  });

  it('contains invalid operation inputs, hostile accessors, Proxies, symbols, non-enumerable fields, and sparse arrays without mutating input', () => {
    const invalidOperation = { objectId: STACK_CARD, replacements: [], extra: true };
    const failure = thrown(() => call('retargetCoreStackObjectV1', validBundle(), invalidOperation));
    assertTransactionError(failure, 'INVALID_OPERATION_INPUT');
    expect(JSON.stringify(invalidOperation)).toBe(JSON.stringify({ objectId: STACK_CARD, replacements: [], extra: true }));

    const accessorInput: Raw = { objectId: STACK_CARD, replacements: [] };
    Object.defineProperty(accessorInput, 'objectId', { enumerable: true, get: () => STACK_CARD });
    const accessorFailure = thrown(() => call('retargetCoreStackObjectV1', validBundle(), accessorInput));
    assertTransactionError(accessorFailure, 'INVALID_OPERATION_INPUT');

    const symbolInput: Raw = { objectId: STACK_CARD, replacements: [] };
    Object.defineProperty(symbolInput, Symbol('unexpected'), { enumerable: true, value: true });
    const symbolFailure = thrown(() => call('retargetCoreStackObjectV1', validBundle(), symbolInput));
    assertTransactionError(symbolFailure, 'INVALID_OPERATION_INPUT');

    const nonEnumerableInput: Raw = { objectId: STACK_CARD, replacements: [] };
    Object.defineProperty(nonEnumerableInput, 'replacements', { enumerable: false, value: [] });
    const nonEnumerableFailure = thrown(() => call('retargetCoreStackObjectV1', validBundle(), nonEnumerableInput));
    assertTransactionError(nonEnumerableFailure, 'INVALID_OPERATION_INPUT');

    const sparse: unknown[] = [];
    sparse.length = 1;
    const sparseFailure = thrown(() => call('retargetCoreStackObjectV1', validBundle(), { objectId: STACK_CARD, replacements: sparse }));
    assertTransactionError(sparseFailure, 'INVALID_OPERATION_INPUT');

    const proxy = new Proxy({ objectId: STACK_CARD, replacements: [] }, {
      ownKeys: () => { throw new Error('hostile ownKeys'); },
    });
    const proxyFailure = thrown(() => call('retargetCoreStackObjectV1', validBundle(), proxy));
    assertTransactionError(proxyFailure, 'INVALID_OPERATION_INPUT');

    const hostileBundle = bundleInput();
    const hostileAnnouncements = record(hostileBundle.stackAnnouncements, 'hostile announcements');
    const hostileRecord = row(byObject(hostileAnnouncements, 'hostile announcements'), STACK_CARD, 'hostile card record');
    hostileRecord.targetSelections = new Proxy(arrayAt(hostileRecord, 'targetSelections', 'hostile selections'), {
      ownKeys: () => { throw new Error('hostile target keys'); },
    });
    const hostileValidation = rejectedValidation(call('validateCoreStackTransactionBundleV1', hostileBundle), 'hostile bundle');
    expect(issueCodes(hostileValidation)).toContain('INVALID_TRANSACTION_BUNDLE');
    assertDeepFrozen(hostileValidation);
  });

  it('does not mutate inputs on failure, exposes no partial candidate, and returns deterministic frozen canonical JSON', () => {
    const bundle = validBundle();
    const operation = { kind: 'card-to-zone', objectId: STACK_CARD, destination: { kind: 'exile' } };
    const beforeBundle = JSON.stringify(bundle);
    const beforeOperation = JSON.stringify(operation);
    const failure = thrown(() => call('removeCoreStackObjectV1', bundle, { ...operation, destination: { kind: 'stack', baseControllerPlayerId: 'P1' } }));
    expect(['INVALID_DESTINATION', 'INVALID_OPERATION_INPUT']).toContain(failure.code);
    expect(Object.prototype.hasOwnProperty.call(failure, 'bundle')).toBe(false);
    expect(JSON.stringify(bundle)).toBe(beforeBundle);
    expect(JSON.stringify(operation)).toBe(beforeOperation);

    const first = validBundleFromInput(bundleInput());
    const second = validBundleFromInput(reversedBundleInput());
    const firstJson = JSON.stringify(first);
    const secondJson = JSON.stringify(second);
    expect(secondJson).toBe(firstJson);
    const roundTripInput: unknown = JSON.parse(firstJson);
    const roundTrip = acceptedValidation(call('validateCoreStackTransactionBundleV1', roundTripInput), 'canonical JSON round trip');
    expect(JSON.stringify(roundTrip)).toBe(firstJson);
    assertDeepFrozen(first);
    assertDeepFrozen(second);
  });

  it('preserves the existing Core/Solo/Online boundaries and forbids new version, package, network, clock, or random surfaces', () => {
    expect(typeof Reflect.get(coreApi, 'createModeNeutralCoreObjectRegistrySliceV2')).toBe('function');
    expect(typeof Reflect.get(coreApi, 'createModeNeutralCoreObjectRuntimeSliceV2')).toBe('function');
    expect(typeof Reflect.get(coreApi, 'createModeNeutralCoreStackAnnouncementSliceV1')).toBe('function');
    expect(typeof Reflect.get(coreApi, 'coreCardObjectIdOf')).toBe('function');
    expect(typeof Reflect.get(coreApi, 'validateModeNeutralCoreIdentityZoneSliceV1')).toBe('function');
  });
});
