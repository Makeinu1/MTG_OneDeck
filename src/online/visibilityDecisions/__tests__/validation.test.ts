import { describe, expect, it } from 'vitest';
import { validateOnlineVisibilityIntentV1 } from '../validation';

const look = (duration: unknown) => ({
  kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'cmd-1', baseRevision: 0,
  look: { subject: { kind: 'object', handle: 'PC1:0' }, viewerPlayerIds: ['P1'], duration },
});

describe('online visibility intent v1', () => {
  it('accepts the exact discriminated duration values', () => {
    for (const duration of [
      { kind: 'next-command' },
      { kind: 'end-of-turn' },
      { kind: 'source-bound', sourceHandle: 'PC1:0' },
      { kind: 'choice-bound', searchSessionId: 'search-1' },
    ]) expect(validateOnlineVisibilityIntentV1(look(duration)).ok).toBe(true);
  });

  it('rejects strings, authority fields, duplicate viewers, and unknown branches', () => {
    expect(validateOnlineVisibilityIntentV1(look('next-command')).ok).toBe(false);
    expect(validateOnlineVisibilityIntentV1(Object.assign({}, look({ kind: 'next-command' }), { actorPlayerId: 'P1' })).ok).toBe(false);
    expect(validateOnlineVisibilityIntentV1(look({ kind: 'next-command', sourceHandle: 'PC1:0' })).ok).toBe(false);
    expect(validateOnlineVisibilityIntentV1({ ...look({ kind: 'next-command' }), look: { subject: { kind: 'object', handle: 'PC1:0' }, viewerPlayerIds: ['P1', 'P1'], duration: { kind: 'next-command' } } }).ok).toBe(false);
    expect(validateOnlineVisibilityIntentV1({ ...look({ kind: 'next-command' }), look: undefined }).ok).toBe(false);
  });

  it('canonicalizes equivalent viewer and candidate array order', () => {
    const result = validateOnlineVisibilityIntentV1({
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'cmd-2', baseRevision: 0,
      look: { subject: { kind: 'object', handle: 'PC1:0' }, viewerPlayerIds: ['P2', 'P1'], duration: { kind: 'next-command' } },
    });
    expect(result).toMatchObject({ ok: true, value: { look: { viewerPlayerIds: ['P1', 'P2'] } } });
    const choose = validateOnlineVisibilityIntentV1({
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'cmd-3', baseRevision: 0,
      choose: { searchSessionId: 'search-1', candidateHandles: ['PC2:0', 'PC1:0'] },
    });
    expect(choose).toMatchObject({ ok: true, value: { choose: { candidateHandles: ['PC1:0', 'PC2:0'] } } });
  });

  it('rejects non-canonical named array properties without executing accessors', () => {
    const named = ['P1'] as string[] & Record<string, unknown>;
    Object.defineProperty(named, '01', { enumerable: true, value: 'P2' });
    expect(validateOnlineVisibilityIntentV1({ ...look({ kind: 'next-command' }), look: { ...look({ kind: 'next-command' }).look, viewerPlayerIds: named } }).ok).toBe(false);

    let accessed = false;
    const accessor = ['P1'];
    Object.defineProperty(accessor, '0', { enumerable: true, get: () => { accessed = true; return 'P1'; } });
    expect(validateOnlineVisibilityIntentV1({ ...look({ kind: 'next-command' }), look: { ...look({ kind: 'next-command' }).look, viewerPlayerIds: accessor } }).ok).toBe(false);
    expect(accessed).toBe(false);
  });

  it('fails closed for throwing viewer and candidate array reflection traps', () => {
    const viewerArray = new Proxy(['P1'], {
      getPrototypeOf: () => { throw new Error('prototype trap'); },
    });
    const viewerResult = validateOnlineVisibilityIntentV1({
      ...look({ kind: 'next-command' }),
      look: { ...look({ kind: 'next-command' }).look, viewerPlayerIds: viewerArray },
    });
    expect(viewerResult.ok).toBe(false);
    expect(Object.isFrozen(viewerResult)).toBe(true);
    if (!viewerResult.ok) expect(Object.isFrozen(viewerResult.issues)).toBe(true);

    const candidateArray = new Proxy(['PC1:0'], {
      ownKeys: () => { throw new Error('ownKeys trap'); },
    });
    const candidateResult = validateOnlineVisibilityIntentV1({
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'cmd-candidate-proxy', baseRevision: 0,
      choose: { searchSessionId: 'search-1', candidateHandles: candidateArray },
    });
    expect(candidateResult.ok).toBe(false);
    expect(Object.isFrozen(candidateResult)).toBe(true);
    if (!candidateResult.ok) expect(Object.isFrozen(candidateResult.issues)).toBe(true);

    const descriptorArray = new Proxy(['P1'], {
      getOwnPropertyDescriptor: () => { throw new Error('descriptor trap'); },
    });
    const descriptorResult = validateOnlineVisibilityIntentV1({
      ...look({ kind: 'next-command' }),
      look: { ...look({ kind: 'next-command' }).look, viewerPlayerIds: descriptorArray },
    });
    expect(descriptorResult.ok).toBe(false);
  });
});
