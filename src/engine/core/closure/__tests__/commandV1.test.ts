import { describe, expect, it } from 'vitest';
import { createCoreCommandV1, validateCoreCommandV1 } from '../index';

describe('O4P-01N command boundary', () => {
  it('normalizes a typed command without accepting an open payload kind', () => {
    const command = createCoreCommandV1({
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision', decisionKey: 'main' },
      payload: { kind: 'priority-pass', playerId: 'P1' as never },
    });
    expect(command.kind).toBe('mode-neutral-core-command-v1');
    expect(validateCoreCommandV1({ ...command, payload: { kind: 'not-closed' } })).toMatchObject({ ok: false });
  });

  it('returns a typed issue for a revoked array proxy', () => {
    const revoked = Proxy.revocable<unknown[]>([], {});
    revoked.revoke();
    const result = validateCoreCommandV1({
      kind: 'mode-neutral-core-command-v1',
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1',
      decisionMakerPlayerId: 'P1',
      decisionContext: { kind: 'decision', decisionKey: 'main' },
      payload: { kind: 'search-complete', sessionKey: 'search', selectedObjectIds: revoked.proxy },
    });
    expect(result).toMatchObject({ ok: false, issues: [{ code: 'INVALID_DESCRIPTOR', path: '/payload/selectedObjectIds' }] });
  });

  it('rejects a circular nested payload without throwing', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const result = validateCoreCommandV1({
      kind: 'mode-neutral-core-command-v1',
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1',
      decisionMakerPlayerId: 'P1',
      decisionContext: { kind: 'decision', decisionKey: 'main' },
      payload: {
        kind: 'search-open',
        sessionKey: 'search',
        input: {
          zone: { kind: 'player-zone', playerId: 'P1', zone: 'library' },
          portion: { kind: 'top', count: cyclic },
          criteria: { kind: 'quantity', minimum: 0, maximum: 1 },
          revealFound: false,
          shuffleAfter: false,
        },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_VALUE', path: '/payload/input/portion/count/self' }),
    ]));
  });

  it('requires a canonical source object ID for card-spell stack commits', () => {
    const result = validateCoreCommandV1({
      kind: 'mode-neutral-core-command-v1',
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1',
      decisionMakerPlayerId: 'P1',
      decisionContext: { kind: 'decision', decisionKey: 'main' },
      payload: {
        kind: 'stack-commit-card-spell',
        input: {
          sourceObjectId: null,
          controllerPlayerId: 'P1',
          announcement: {
            kind: 'card-spell',
            abilityTextSnapshot: null,
            chosenModeKeys: [],
            targetSelections: [],
            announcedVariables: [],
            distributions: [],
            costChoices: { alternativeCost: null, additionalCosts: [] },
          },
        },
      },
    });
    expect(result).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'INVALID_ID', path: '/payload/input/sourceObjectId' })],
    });
  });
});
