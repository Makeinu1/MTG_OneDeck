import { describe, expect, it } from 'vitest';

import {
  CoreCardRuntimeCreationError,
  createModeNeutralCoreCardRuntimeSliceV1,
  validateModeNeutralCoreCardRuntimeSliceV1,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from '../../index';
import type {
  CoreCardObjectRuntimeStateV1,
  CreateModeNeutralCoreCardRuntimeSliceV1Input,
  ModeNeutralCoreCardRuntimeSliceV1,
  ModeNeutralCoreIdentityZoneSliceV1,
} from '../../index';
import { cloneFixture, isRecord } from '../../__tests__/testHelpers';

const RUNTIME_KIND = 'mode-neutral-core-card-runtime-slice-v1';

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be a record`);
  return value;
}

function validatedIdentity(extraFace = false): ModeNeutralCoreIdentityZoneSliceV1 {
  const raw = cloneFixture();
  if (extraFace) {
    const definitions = record(raw.cardDefinitions, 'cardDefinitions');
    const definition = record(definitions['def.fixture-card'], 'definition');
    const faces = definition.faces;
    if (!Array.isArray(faces)) throw new Error('faces must be an array');
    faces.push({ ...record(faces[0], 'face'), name: 'Fixture Card Back Face' });
  }
  const result = validateModeNeutralCoreIdentityZoneSliceV1(raw);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function defaultObjectState(): Record<string, unknown> {
  return {
    orientation: {
      faceIndex: 0,
      faceDown: false,
      tapped: false,
      flipped: false,
      phasedOut: false,
    },
    counterDamage: {
      counters: [],
      markedDamage: 0,
    },
    attachment: {
      attachedTo: null,
    },
  };
}

function runtimeInput(identityState: ModeNeutralCoreIdentityZoneSliceV1): Record<string, unknown> {
  const byObject: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const objectId of Object.keys(identityState.cardObjects)) byObject[objectId] = defaultObjectState();
  return { kind: RUNTIME_KIND, byObject };
}

function factoryInput(identityState: ModeNeutralCoreIdentityZoneSliceV1): CreateModeNeutralCoreCardRuntimeSliceV1Input {
  const input = runtimeInput(identityState);
  delete input.kind;
  return input as unknown as CreateModeNeutralCoreCardRuntimeSliceV1Input;
}

function rejected(
  identityState: ModeNeutralCoreIdentityZoneSliceV1,
  input: unknown,
): readonly { readonly code: string; readonly path: string; readonly message: string }[] {
  const result = validateModeNeutralCoreCardRuntimeSliceV1(identityState, input);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected runtime validation to fail');
  return result.issues;
}

function accepted(
  identityState: ModeNeutralCoreIdentityZoneSliceV1,
  input: unknown,
): ModeNeutralCoreCardRuntimeSliceV1 {
  const result = validateModeNeutralCoreCardRuntimeSliceV1(identityState, input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function hasCode(
  issues: readonly { readonly code: string; readonly path: string }[],
  code: string,
  path?: string,
): boolean {
  return issues.some((issue) => issue.code === code && (path === undefined || issue.path === path));
}

function stateAt(input: Record<string, unknown>, objectId: string): Record<string, unknown> {
  const byObject = record(input.byObject, 'byObject');
  return record(byObject[objectId], objectId);
}

function orientationAt(input: Record<string, unknown>, objectId: string): Record<string, unknown> {
  return record(stateAt(input, objectId).orientation, 'orientation');
}

function counterDamageAt(input: Record<string, unknown>, objectId: string): Record<string, unknown> {
  return record(stateAt(input, objectId).counterDamage, 'counterDamage');
}

function attachmentAt(input: Record<string, unknown>, objectId: string): Record<string, unknown> {
  return record(stateAt(input, objectId).attachment, 'attachment');
}

function outputAt(value: ModeNeutralCoreCardRuntimeSliceV1, objectId: string): CoreCardObjectRuntimeStateV1 {
  const byObject = value.byObject as Readonly<Record<string, CoreCardObjectRuntimeStateV1>>;
  const result = byObject[objectId];
  if (result === undefined) throw new Error(`missing output object ${objectId}`);
  return result;
}

describe('Core composite card runtime slice V1', () => {
  it('exports and accepts the complete identity object set, canonicalizing keys and deep-freezing output', () => {
    const identityState = validatedIdentity();
    const input = runtimeInput(identityState);
    const byObject = record(input.byObject, 'byObject');
    const reversed: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const objectId of Object.keys(byObject).reverse()) reversed[objectId] = byObject[objectId];
    input.byObject = reversed;

    const value = accepted(identityState, input);
    expect(value.kind).toBe(RUNTIME_KIND);
    expect(Object.keys(value.byObject)).toEqual(Object.keys(identityState.cardObjects).sort());
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.byObject)).toBe(true);
    for (const objectId of Object.keys(value.byObject)) {
      const objectState = outputAt(value, objectId);
      expect(Object.isFrozen(objectState)).toBe(true);
      expect(Object.isFrozen(objectState.orientation)).toBe(true);
      expect(Object.isFrozen(objectState.counterDamage)).toBe(true);
      expect(Object.isFrozen(objectState.counterDamage.counters)).toBe(true);
      expect(Object.isFrozen(objectState.attachment)).toBe(true);
    }
  });

  it('rejects missing and extra ObjectIds', () => {
    const identityState = validatedIdentity();
    const missing = runtimeInput(identityState);
    delete record(missing.byObject, 'byObject')['PC7:0'];
    expect(hasCode(rejected(identityState, missing), 'OBJECT_SET_MISMATCH', '/byObject/PC7:0')).toBe(true);

    const extra = runtimeInput(identityState);
    record(extra.byObject, 'byObject')['PC9:0'] = defaultObjectState();
    expect(hasCode(rejected(identityState, extra), 'OBJECT_SET_MISMATCH', '/byObject/PC9:0')).toBe(true);

    const undefinedValue = runtimeInput(identityState);
    record(undefinedValue.byObject, 'byObject')['PC1:0'] = undefined;
    expect(hasCode(rejected(identityState, undefinedValue), 'INVALID_TYPE', '/byObject/PC1:0')).toBe(true);
  });

  it('validates face count and the faceIndex zone boundary', () => {
    const oneFaceIdentity = validatedIdentity();
    const outOfRange = runtimeInput(oneFaceIdentity);
    orientationAt(outOfRange, 'PC4:1').faceIndex = 1;
    expect(hasCode(rejected(oneFaceIdentity, outOfRange), 'FACE_INDEX_OUT_OF_RANGE')).toBe(true);

    const twoFaceIdentity = validatedIdentity(true);
    const allowed = runtimeInput(twoFaceIdentity);
    orientationAt(allowed, 'PC4:1').faceIndex = 1;
    orientationAt(allowed, 'PC5:1').faceIndex = 1;
    expect(outputAt(accepted(twoFaceIdentity, allowed), 'PC4:1').orientation.faceIndex).toBe(1);

    const outsideBattlefield = runtimeInput(twoFaceIdentity);
    orientationAt(outsideBattlefield, 'PC1:0').faceIndex = 1;
    expect(hasCode(
      rejected(twoFaceIdentity, outsideBattlefield),
      'FACE_INDEX_NOT_ZERO_OUTSIDE_BATTLEFIELD_OR_STACK',
      '/byObject/PC1:0/orientation/faceIndex',
    )).toBe(true);
  });

  it('allows faceDown only in battlefield, stack, and exile', () => {
    const identityState = validatedIdentity();
    const allowed = runtimeInput(identityState);
    orientationAt(allowed, 'PC4:1').faceDown = true;
    orientationAt(allowed, 'PC5:1').faceDown = true;
    orientationAt(allowed, 'PC6:0').faceDown = true;
    expect(outputAt(accepted(identityState, allowed), 'PC6:0').orientation.faceDown).toBe(true);

    const forbidden = runtimeInput(identityState);
    orientationAt(forbidden, 'PC2:0').faceDown = true;
    expect(hasCode(
      rejected(identityState, forbidden),
      'FACE_DOWN_NOT_ALLOWED_IN_ZONE',
      '/byObject/PC2:0/orientation/faceDown',
    )).toBe(true);
  });

  it('allows battlefield orientation and rejects tapped/flipped/phasedOut elsewhere', () => {
    const identityState = validatedIdentity();
    const battlefield = runtimeInput(identityState);
    const battlefieldOrientation = orientationAt(battlefield, 'PC4:1');
    battlefieldOrientation.tapped = true;
    battlefieldOrientation.flipped = true;
    battlefieldOrientation.phasedOut = true;
    expect(outputAt(accepted(identityState, battlefield), 'PC4:1').orientation.tapped).toBe(true);

    for (const field of ['tapped', 'flipped', 'phasedOut'] as const) {
      const forbidden = runtimeInput(identityState);
      orientationAt(forbidden, 'PC5:1')[field] = true;
      const code = field === 'tapped'
        ? 'TAPPED_NOT_ALLOWED_OUTSIDE_BATTLEFIELD'
        : field === 'flipped'
          ? 'FLIPPED_NOT_ALLOWED_OUTSIDE_BATTLEFIELD'
          : 'PHASED_OUT_NOT_ALLOWED_OUTSIDE_BATTLEFIELD';
      expect(hasCode(rejected(identityState, forbidden), code, `/byObject/PC5:1/orientation/${field}`)).toBe(true);
    }
  });

  it('allows counters in every zone and marked damage only on battlefield', () => {
    const identityState = validatedIdentity();
    const counters = runtimeInput(identityState);
    counterDamageAt(counters, 'PC1:0').counters = [{ kind: 'charge', count: 2 }];
    counterDamageAt(counters, 'PC2:0').counters = [{ kind: 'loyalty', count: 1 }];
    counterDamageAt(counters, 'PC3:0').counters = [{ kind: 'quest', count: 3 }];
    counterDamageAt(counters, 'PC5:1').counters = [{ kind: 'time', count: 4 }];
    counterDamageAt(counters, 'PC6:0').counters = [{ kind: 'age', count: 5 }];
    counterDamageAt(counters, 'PC7:0').counters = [{ kind: 'lore', count: 6 }];
    counterDamageAt(counters, 'PC4:1').markedDamage = 3;
    expect(outputAt(accepted(identityState, counters), 'PC1:0').counterDamage.counters[0]?.kind).toBe('charge');

    const forbidden = runtimeInput(identityState);
    counterDamageAt(forbidden, 'PC5:1').markedDamage = 1;
    expect(hasCode(
      rejected(identityState, forbidden),
      'MARKED_DAMAGE_NOT_ALLOWED_OUTSIDE_BATTLEFIELD',
      '/byObject/PC5:1/counterDamage/markedDamage',
    )).toBe(true);
  });

  it('validates attachment source, target existence, and self-attachment without zone restrictions or cycle checks', () => {
    const identityState = validatedIdentity();
    const valid = runtimeInput(identityState);
    attachmentAt(valid, 'PC4:1').attachedTo = { kind: 'object', objectId: 'PC1:0' };
    const acceptedValue = accepted(identityState, valid);
    expect(outputAt(acceptedValue, 'PC4:1').attachment.attachedTo).toEqual({ kind: 'object', objectId: 'PC1:0' });

    const playerTarget = runtimeInput(identityState);
    attachmentAt(playerTarget, 'PC4:1').attachedTo = { kind: 'player', playerId: 'P2' };
    expect(outputAt(accepted(identityState, playerTarget), 'PC4:1').attachment.attachedTo).toEqual({
      kind: 'player',
      playerId: 'P2',
    });

    const missingObject = runtimeInput(identityState);
    attachmentAt(missingObject, 'PC4:1').attachedTo = { kind: 'object', objectId: 'PC9:0' };
    expect(hasCode(
      rejected(identityState, missingObject),
      'ATTACHMENT_TARGET_OBJECT_NOT_FOUND',
      '/byObject/PC4:1/attachment/attachedTo/objectId',
    )).toBe(true);

    const self = runtimeInput(identityState);
    attachmentAt(self, 'PC4:1').attachedTo = { kind: 'object', objectId: 'PC4:1' };
    expect(hasCode(rejected(identityState, self), 'SELF_ATTACHMENT')).toBe(true);

    const missingPlayer = runtimeInput(identityState);
    attachmentAt(missingPlayer, 'PC4:1').attachedTo = { kind: 'player', playerId: 'P9' };
    expect(hasCode(rejected(identityState, missingPlayer), 'ATTACHMENT_TARGET_PLAYER_NOT_FOUND')).toBe(true);
  });

  it('allows an attachment cycle when both sources are on the battlefield', () => {
    const raw = cloneFixture();
    const shared = record(record(raw.zones, 'zones').shared, 'shared');
    const battlefield = shared.battlefield;
    const stack = shared.stack;
    if (!Array.isArray(battlefield) || !Array.isArray(stack)) throw new Error('zones must be arrays');
    battlefield.push('PC5:1');
    stack.splice(0, 1);
    const identityResult = validateModeNeutralCoreIdentityZoneSliceV1(raw);
    if (!identityResult.ok) throw new Error(JSON.stringify(identityResult.issues));

    const input = runtimeInput(identityResult.value);
    attachmentAt(input, 'PC4:1').attachedTo = { kind: 'object', objectId: 'PC5:1' };
    attachmentAt(input, 'PC5:1').attachedTo = { kind: 'object', objectId: 'PC4:1' };
    expect(outputAt(accepted(identityResult.value, input), 'PC5:1').attachment.attachedTo).toEqual({
      kind: 'object',
      objectId: 'PC4:1',
    });
  });

  it('rejects attachment from every non-battlefield zone', () => {
    const identityState = validatedIdentity();
    for (const objectId of ['PC1:0', 'PC2:0', 'PC3:0', 'PC5:1', 'PC6:0', 'PC7:0']) {
      const input = runtimeInput(identityState);
      attachmentAt(input, objectId).attachedTo = { kind: 'object', objectId: 'PC4:1' };
      expect(hasCode(
        rejected(identityState, input),
        'ATTACHMENT_SOURCE_NOT_ON_BATTLEFIELD',
        `/byObject/${objectId}/attachment/attachedTo`,
      )).toBe(true);
    }
  });

  it('rejects malformed nested state without invoking accessors and does not mutate input', () => {
    const identityState = validatedIdentity();
    const input = runtimeInput(identityState);
    const before = structuredClone(input);
    let getterExecuted = false;
    const orientation = orientationAt(input, 'PC4:1');
    Object.defineProperty(orientation, 'tapped', {
      enumerable: true,
      configurable: true,
      get: () => {
        getterExecuted = true;
        return false;
      },
    });
    const issues = rejected(identityState, input);
    expect(getterExecuted).toBe(false);
    expect(hasCode(issues, 'INVALID_TYPE', '/byObject/PC4:1/orientation/tapped')).toBe(true);
    expect(JSON.stringify({ ...input, byObject: undefined })).toBe(JSON.stringify({ ...before, byObject: undefined }));
  });

  it('keeps validator and factory on one path and returns the same frozen value contract', () => {
    const identityState = validatedIdentity();
    const input = factoryInput(identityState);
    const validation = validateModeNeutralCoreCardRuntimeSliceV1(identityState, {
      kind: RUNTIME_KIND,
      ...input,
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) throw new Error(JSON.stringify(validation.issues));
    const factory = createModeNeutralCoreCardRuntimeSliceV1(identityState, input);
    expect(JSON.stringify(factory)).toBe(JSON.stringify(validation.value));
    expect(factory).not.toBe(input);
    expect(Object.isFrozen(factory)).toBe(true);
    expect(() => createModeNeutralCoreCardRuntimeSliceV1(identityState, {
      ...input,
      kind: RUNTIME_KIND,
    } as unknown as CreateModeNeutralCoreCardRuntimeSliceV1Input)).toThrow(CoreCardRuntimeCreationError);

    const invalid = factoryInput(identityState);
    orientationAt(invalid as unknown as Record<string, unknown>, 'PC2:0').faceIndex = 1;
    const invalidValidation = validateModeNeutralCoreCardRuntimeSliceV1(identityState, {
      kind: RUNTIME_KIND,
      ...invalid,
    });
    expect(invalidValidation.ok).toBe(false);
    expect(() => createModeNeutralCoreCardRuntimeSliceV1(identityState, invalid)).toThrow(CoreCardRuntimeCreationError);
    try {
      createModeNeutralCoreCardRuntimeSliceV1(identityState, invalid);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CoreCardRuntimeCreationError);
      if (error instanceof CoreCardRuntimeCreationError && !invalidValidation.ok) {
        expect(error.issues).toEqual(invalidValidation.issues);
      }
    }
  });

  it('preserves valid runtime state input and canonicalizes the output independently', () => {
    const identityState = validatedIdentity();
    const input = runtimeInput(identityState);
    const before = structuredClone(input);
    const value = accepted(identityState, input);
    expect(input).toEqual(before);
    expect(value.byObject).not.toBe(input.byObject);
    expect(outputAt(value, 'PC4:1')).not.toBe(record(input.byObject, 'byObject')['PC4:1']);
    expect(Object.keys(value.byObject)).toEqual(Object.keys(value.byObject).slice().sort());
  });
});
