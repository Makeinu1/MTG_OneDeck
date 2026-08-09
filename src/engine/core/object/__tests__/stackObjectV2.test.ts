import { describe, expect, it } from 'vitest';

import {
  CoreActivatedAbilityObjectCreationError,
  CoreSpellCopyObjectCreationError,
  CoreTriggeredAbilityObjectCreationError,
  createCoreActivatedAbilityObjectIdentityV2,
  createCoreSpellCopyObjectIdentityV2,
  createCoreTriggeredAbilityObjectIdentityV2,
  validateCoreActivatedAbilityObjectIdentityV2,
  validateCoreSpellCopyObjectIdentityV2,
  validateCoreStackObjectIdentityV2,
  validateCoreTriggeredAbilityObjectIdentityV2,
} from '../stackObjectV2';

const playerId = 'player-1';
const definitionId = 'definition-1';
const historicalObjectId = '@spell-copy:historical-copy';

describe('Core stack object identity V2', () => {
  it('creates and validates all three stack object identities', () => {
    const spellCopy = createCoreSpellCopyObjectIdentityV2({
      definitionId,
      controllerPlayerId: playerId,
      copiedFromObjectId: historicalObjectId,
    });
    const activated = createCoreActivatedAbilityObjectIdentityV2({
      controllerPlayerId: playerId,
      sourceObjectId: null,
      abilityKey: 'ability-1',
    });
    const triggered = createCoreTriggeredAbilityObjectIdentityV2({
      controllerPlayerId: playerId,
      sourceObjectId: '@activated-ability:historical-source',
      abilityKey: 'trigger-1',
    });

    expect(spellCopy).toEqual({
      kind: 'spell-copy',
      definitionId,
      controllerPlayerId: playerId,
      copiedFromObjectId: historicalObjectId,
    });
    expect(activated.kind).toBe('activated-ability');
    expect(triggered.kind).toBe('triggered-ability');
    expect(Object.isFrozen(spellCopy)).toBe(true);
    expect(Object.isFrozen(activated)).toBe(true);
    expect(Object.isFrozen(triggered)).toBe(true);
    expect(validateCoreStackObjectIdentityV2(spellCopy).ok).toBe(true);
  });

  it('accepts null or historical source references without registry membership', () => {
    expect(validateCoreActivatedAbilityObjectIdentityV2({
      kind: 'activated-ability',
      controllerPlayerId: playerId,
      sourceObjectId: null,
      abilityKey: 'stable-key',
    }).ok).toBe(true);
    expect(validateCoreTriggeredAbilityObjectIdentityV2({
      kind: 'triggered-ability',
      controllerPlayerId: playerId,
      sourceObjectId: 'PC-1:0',
      abilityKey: 'stable-key',
    }).ok).toBe(true);
    expect(validateCoreSpellCopyObjectIdentityV2({
      kind: 'spell-copy',
      definitionId,
      controllerPlayerId: playerId,
      copiedFromObjectId: '@triggered-ability:gone-source',
    }).ok).toBe(true);
  });

  it.each([
    ['empty ability key', { kind: 'activated-ability', controllerPlayerId: playerId, sourceObjectId: null, abilityKey: '' }],
    ['whitespace ability key', { kind: 'activated-ability', controllerPlayerId: playerId, sourceObjectId: null, abilityKey: ' key' }],
    ['non-base definition', { kind: 'spell-copy', definitionId: 'definition/id', controllerPlayerId: playerId, copiedFromObjectId: historicalObjectId }],
    ['non-canonical source', { kind: 'triggered-ability', controllerPlayerId: playerId, sourceObjectId: 'PC-1:01', abilityKey: 'trigger-1' }],
  ])('rejects %s', (_label, value) => {
    expect(validateCoreStackObjectIdentityV2(value).ok).toBe(false);
  });

  it('rejects unknown fields, symbols, accessors, and mutation-shaped input', () => {
    const symbol = Symbol('extra');
    let getterExecuted = false;
    const value = {
      kind: 'activated-ability',
      controllerPlayerId: playerId,
      sourceObjectId: null,
      abilityKey: 'ability-1',
      extra: true,
    } as Record<string | symbol, unknown>;
    Object.defineProperty(value, 'accessor', {
      enumerable: true,
      get: () => {
        getterExecuted = true;
        return 'must not execute';
      },
    });
    Object.defineProperty(value, symbol, { enumerable: true, value: true });
    const before = Reflect.ownKeys(value);

    const result = validateCoreActivatedAbilityObjectIdentityV2(value);

    expect(result.ok).toBe(false);
    expect(getterExecuted).toBe(false);
    expect(Reflect.ownKeys(value)).toEqual(before);
    expect(value).toHaveProperty('extra', true);
  });

  it('keeps factory input strict and reports kind-specific creation errors', () => {
    expect(() => createCoreSpellCopyObjectIdentityV2({
      kind: 'spell-copy',
      definitionId,
      controllerPlayerId: playerId,
      copiedFromObjectId: historicalObjectId,
    })).toThrow(CoreSpellCopyObjectCreationError);
    expect(() => createCoreActivatedAbilityObjectIdentityV2({
      controllerPlayerId: playerId,
      sourceObjectId: null,
      abilityKey: 'bad key',
    })).toThrow(CoreActivatedAbilityObjectCreationError);
    expect(() => createCoreTriggeredAbilityObjectIdentityV2({
      controllerPlayerId: playerId,
      sourceObjectId: null,
      abilityKey: 'bad/key',
    })).toThrow(CoreTriggeredAbilityObjectCreationError);
  });
});
