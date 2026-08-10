import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementValidationV1';

type Raw = Record<string, unknown>;
const ids = ['PC5:1', '@spell-copy:fixture-copy', '@activated-ability:fixture-activation', '@triggered-ability:fixture-trigger'];
const registry = JSON.parse(readFileSync(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url), 'utf8')) as Raw;
const base = (kind: string, text: string | null): Raw => ({ kind, abilityTextSnapshot: text, chosenModeKeys: ['mode-b', 'mode-a', 'mode-b'], targetSelections: [{ selectionId: 'one', groupKey: 'g', target: { kind: 'player', playerId: 'P99' } }], announcedVariables: [{ variableKey: 'X', value: 0 }, { variableKey: 'amount', value: 2 }], distributions: [{ distributionKey: 'damage', assignments: [{ targetSelectionId: 'one', amount: 2 }] }], costChoices: { alternativeCost: null, additionalCosts: [] } });
const valid = (): Raw => ({ kind: 'mode-neutral-core-stack-announcement-slice-v1', byObject: { [ids[0]]: base('card-spell', null), [ids[1]]: base('spell-copy', null), [ids[2]]: base('activated-ability', 'source vanished'), [ids[3]]: base('triggered-ability', 'source vanished') } });
function codes(value: unknown): string[] { const result = validateModeNeutralCoreStackAnnouncementSliceV1(registry, value); return result.ok ? [] : result.issues.map((found) => found.code); }

describe('stack announcement validation contract', () => {
  it('accepts historical refs, repeated modes, X=0, and frozen fresh values', () => {
    const source = valid(); const result = validateModeNeutralCoreStackAnnouncementSliceV1(registry, source); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(JSON.stringify(source)).toContain('P99');
    expect(result.value).not.toBe(source); expect(Object.isFrozen((result.value.byObject as Readonly<Record<string, unknown>>)[ids[0]])).toBe(true);
  });
  it('rejects kind/text, sorted-list, distribution, and committed-only violations', () => {
    const mismatch = valid(); (mismatch.byObject as Raw)[ids[0]] = base('activated-ability', 'wrong'); expect(codes(mismatch)).toContain('ANNOUNCEMENT_KIND_MISMATCH');
    const text = valid(); ((text.byObject as Raw)[ids[2]] as Raw).abilityTextSnapshot = ' bad '; expect(codes(text)).toContain('INVALID_ABILITY_TEXT');
    const order = valid(); ((order.byObject as Raw)[ids[0]] as Raw).announcedVariables = [{ variableKey: 'z', value: 1 }, { variableKey: 'a', value: 1 }]; expect(codes(order)).toContain('INVALID_ORDER');
    const distribution = valid(); ((distribution.byObject as Raw)[ids[0]] as Raw).distributions = [{ distributionKey: 'damage', assignments: [{ targetSelectionId: 'missing', amount: 1 }] }]; expect(codes(distribution)).toContain('DISTRIBUTION_TARGET_NOT_FOUND');
    const lifecycle = valid(); ((lifecycle.byObject as Raw)[ids[0]] as Raw).status = 'proposed'; expect(codes(lifecycle)).toContain('UNKNOWN_FIELD');
  });

  it('fails closed for revoked and throwing byObject proxies', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const revokedInput = { kind: 'mode-neutral-core-stack-announcement-slice-v1', byObject: revoked.proxy };
    expect(() => validateModeNeutralCoreStackAnnouncementSliceV1(registry, revokedInput)).not.toThrow();
    expect(codes(revokedInput)).toContain('INVALID_TYPE');

    const throwing = new Proxy({}, { ownKeys: () => { throw new Error('inspection failed'); } });
    const throwingInput = { kind: 'mode-neutral-core-stack-announcement-slice-v1', byObject: throwing };
    expect(() => validateModeNeutralCoreStackAnnouncementSliceV1(registry, throwingInput)).not.toThrow();
    expect(codes(throwingInput)).toContain('INVALID_TYPE');
  });
});
