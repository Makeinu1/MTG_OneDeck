import { describe, expect, it } from 'vitest';
import * as Core from '../../index';

describe('O4P-01N judge-owned hostile and canonical evidence', () => {
  it('rejects a revoked command array through the public typed validator', () => {
    const revoked = Proxy.revocable<unknown[]>([], {});
    revoked.revoke();
    const result = Core.validateCoreCommandV1({
      kind: 'mode-neutral-core-command-v1',
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1',
      decisionMakerPlayerId: 'P1',
      decisionContext: { kind: 'decision', decisionKey: 'review' },
      payload: { kind: 'search-complete', sessionKey: 'review-search', selectedObjectIds: revoked.proxy },
    });
    expect(result).toMatchObject({ ok: false, issues: [{ code: 'INVALID_DESCRIPTOR', path: '/payload/selectedObjectIds' }] });
  });

  it('rejects circular canonical input while allowing repeated non-cyclic references', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => Core.serializeCoreCanonicalValueV1(cyclic)).toThrow(Core.CoreCanonicalizationErrorV1);

    const shared = { value: 'same' };
    expect(Core.serializeCoreCanonicalValueV1({ left: shared, right: shared })).toBe('{"left":{"value":"same"},"right":{"value":"same"}}');
  });

  it('treats a revoked version vector proxy as invalid rather than throwing', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(Core.isCoreClosureVersionVectorV1(revoked.proxy)).toBe(false);
  });
});
