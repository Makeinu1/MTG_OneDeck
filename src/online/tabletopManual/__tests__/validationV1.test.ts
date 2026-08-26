import { describe, expect, it } from 'vitest';
import { bindOnlineTabletopIntentToCoreCommandV1 } from '../binding';
import { validateOnlineTabletopIntentEnvelopeV1 } from '../validation';
import type { OnlineTabletopIntentEnvelopeV1 } from '../types';

function envelope(primitive: OnlineTabletopIntentEnvelopeV1['primitive'], mode: OnlineTabletopIntentEnvelopeV1['mode'] = 'structured'): OnlineTabletopIntentEnvelopeV1 {
  return { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, commandId: 'manual-command', baseRevision: 0, mode, primitive };
}

function tokenDefinition(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: { kind: 'engine-synthetic' },
    name: 'Treasure',
    layout: 'token',
    manaValue: 0,
    colorIdentity: [],
    typeLine: 'Token Artifact',
    keywords: [],
    producedMana: [],
    tokenKind: 'treasure',
    faces: [{ name: 'Treasure', manaCost: null, typeLine: 'Token Artifact', oracleText: '', power: null, toughness: null, loyalty: null, defense: null }],
    ...overrides,
  };
}

describe('O4P-09D public tabletop intent boundary', () => {
  it('accepts both closed manual modes and rejects missing per-kind fields', () => {
    expect(validateOnlineTabletopIntentEnvelopeV1(envelope({ kind: 'draw', count: 1 })).ok).toBe(true);
    expect(validateOnlineTabletopIntentEnvelopeV1(envelope({ kind: 'note-set', noteId: 'n1', text: 'A note' }, 'freeform')).ok).toBe(true);
    expect(validateOnlineTabletopIntentEnvelopeV1(envelope({ kind: 'draw' })).ok).toBe(false);
    expect(validateOnlineTabletopIntentEnvelopeV1(envelope({ kind: 'move', objectId: 'PC1:0' as never })).ok).toBe(false);
  });

  it('fails closed for hostile descriptor arrays without throwing', () => {
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    const hostile = envelope({ kind: 'reorder', zone: { kind: 'shared-zone', zone: 'battlefield' }, order: revoked.proxy });
    expect(() => validateOnlineTabletopIntentEnvelopeV1(hostile)).not.toThrow();
    expect(validateOnlineTabletopIntentEnvelopeV1(hostile).ok).toBe(false);
  });

  it('rejects indexed owner-library placement from the public manual intent', () => {
    const checked = validateOnlineTabletopIntentEnvelopeV1(envelope({
      kind: 'move',
      objectId: 'PC1:0' as never,
      destination: { kind: 'owner-library', placement: { kind: 'index', index: 0 } },
    }));
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues).toContainEqual(expect.objectContaining({ code: 'INVALID_DESTINATION' }));
  });

  it('bounds every token snapshot string and collection before it reaches the Core binder', () => {
    const oversizedStrings: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['name', { name: 'x'.repeat(513) }],
      ['layout', { layout: 'x'.repeat(513) }],
      ['typeLine', { typeLine: 'x'.repeat(513) }],
      ['face name', { faces: [{ ...(tokenDefinition().faces as readonly Record<string, unknown>[])[0], name: 'x'.repeat(513) }] }],
      ['face typeLine', { faces: [{ ...(tokenDefinition().faces as readonly Record<string, unknown>[])[0], typeLine: 'x'.repeat(513) }] }],
      ['face oracleText', { faces: [{ ...(tokenDefinition().faces as readonly Record<string, unknown>[])[0], oracleText: 'x'.repeat(100_000) }] }],
      ['face manaCost', { faces: [{ ...(tokenDefinition().faces as readonly Record<string, unknown>[])[0], manaCost: 'x'.repeat(513) }] }],
      ['face power', { faces: [{ ...(tokenDefinition().faces as readonly Record<string, unknown>[])[0], power: 'x'.repeat(513) }] }],
      ['face toughness', { faces: [{ ...(tokenDefinition().faces as readonly Record<string, unknown>[])[0], toughness: 'x'.repeat(513) }] }],
      ['face loyalty', { faces: [{ ...(tokenDefinition().faces as readonly Record<string, unknown>[])[0], loyalty: 'x'.repeat(513) }] }],
      ['face defense', { faces: [{ ...(tokenDefinition().faces as readonly Record<string, unknown>[])[0], defense: 'x'.repeat(513) }] }],
    ];
    for (const [label, override] of oversizedStrings) {
      const checked = validateOnlineTabletopIntentEnvelopeV1(envelope({
        kind: 'token-create', tokenSeed: 'oversized-token', definitionId: 'oversized-definition', definition: tokenDefinition(override),
      }));
      expect(checked.ok, label).toBe(false);
    }

    const oversizedCollections: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['colors', { colorIdentity: ['W', 'U', 'B', 'R', 'G', 'W'] }],
      ['keywords', { keywords: Array.from({ length: 17 }, (_, index) => `keyword-${String(index).padStart(2, '0')}`) }],
      ['produced mana', { producedMana: ['W', 'U', 'B', 'R', 'G', 'C', 'W'] }],
      ['faces', { faces: [0, 1, 2].map(() => (tokenDefinition().faces as readonly unknown[])[0]) }],
    ];
    for (const [label, override] of oversizedCollections) {
      const checked = validateOnlineTabletopIntentEnvelopeV1(envelope({
        kind: 'token-create', tokenSeed: 'oversized-token', definitionId: 'oversized-definition', definition: tokenDefinition(override),
      }));
      expect(checked.ok, label).toBe(false);
    }

    const accepted = validateOnlineTabletopIntentEnvelopeV1(envelope({
      kind: 'token-create', tokenSeed: 'bounded-token', definitionId: 'bounded-definition', definition: tokenDefinition(),
    }));
    expect(accepted.ok).toBe(true);

    const fullFace = {
      name: 'x'.repeat(512),
      manaCost: 'x'.repeat(512),
      typeLine: 'x'.repeat(512),
      oracleText: 'x'.repeat(512),
      power: 'x'.repeat(512),
      toughness: 'x'.repeat(512),
      loyalty: 'x'.repeat(512),
      defense: 'x'.repeat(512),
    };
    const serializedOverflow = validateOnlineTabletopIntentEnvelopeV1(envelope({
      kind: 'token-create', tokenSeed: 'bounded-token', definitionId: 'bounded-definition', definition: tokenDefinition({
        name: 'x'.repeat(512), layout: 'x'.repeat(512), typeLine: 'x'.repeat(512), faces: [fullFace, fullFace],
      }),
    }));
    expect(serializedOverflow.ok).toBe(false);
  });

  it('keeps Look, Reveal, and Choose visibly disabled and execution fail-closed', () => {
    for (const kind of ['look', 'reveal', 'choose'] as const) {
      const checked = validateOnlineTabletopIntentEnvelopeV1(envelope({ kind }));
      expect(checked.ok).toBe(true);
      if (!checked.ok) continue;
      expect(() => bindOnlineTabletopIntentToCoreCommandV1({
        envelope: checked.value,
        binding: {
          actorPlayerId: 'P1' as never,
          decisionMakerPlayerId: 'P1' as never,
          decisionContext: { kind: 'decision', decisionKey: 'manual' },
        },
      })).toThrow();
    }
  });
});
