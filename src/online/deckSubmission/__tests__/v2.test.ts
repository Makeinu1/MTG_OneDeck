import { describe, expect, it, vi } from 'vitest';
import type { CardDef } from '../../../types/card';
import {
  OnlineDeckScryfallResolverV2,
  OnlineDeckScryfallUnavailableError,
  parseOnlineDeckSubmitV2,
  resolveOnlineDeckSubmissionV2,
} from '../index';

const A = '5da14d86-0780-4821-a799-96f64b377df4';
const O = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';
const P = 'participant-a';
const C = 'seat_' + 'a'.repeat(32);
const BASE_ENTRY = { section: 'main' as const, quantity: 2, scryfallId: A, oracleId: O };

function input(entries = [{ section: 'main' as const, quantity: 2, scryfallId: A, oracleId: O }]): Record<string, unknown> {
  return { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: P, seatCapability: C, deckId: 'deck-a', submissionId: 'submission-a', entries };
}

function card(id = A, oracleId = O): CardDef {
  return { scryfallId: id, oracleId, name: 'Test', lang: 'en', layout: 'normal', cmc: 1, colorIdentity: [], typeLine: 'Creature', faces: [{ name: 'Test', typeLine: 'Creature', oracleText: 'Test' }] };
}

describe('online v2 deck submission boundary', () => {
  it('rejects hostile shape, sparse lists and oversized canonical input before resolution', () => {
    const sparse: unknown[] = []; sparse.length = 1;
    expect(parseOnlineDeckSubmitV2(input(sparse as never[])).ok).toBe(false);
    expect(parseOnlineDeckSubmitV2({ ...input(), extra: true }).ok).toBe(false);
    expect(parseOnlineDeckSubmitV2(input([{ section: 'main', quantity: 0, scryfallId: A, oracleId: O }])).ok).toBe(false);
  });

  it('preserves duplicate ordered entries and maps injected definitions', async () => {
    const parsed = parseOnlineDeckSubmitV2(input([BASE_ENTRY, BASE_ENTRY]));
    expect(parsed.ok).toBe(true);
    const result = await resolveOnlineDeckSubmissionV2(parsed.ok ? parsed.value.entries : [], { resolve: vi.fn(() => Promise.resolve(new Map([[A, card()]]))) });
    expect(result.snapshot?.entries.map((entry) => [entry.index, entry.quantity])).toEqual([[0, 2], [1, 2]]);
  });

  it('batches production requests at 75 unique print ids', async () => {
    const calls: RequestInit[] = [];
    let waits = 0;
    const fetcher: typeof fetch = (_url, init) => {
      calls.push(init ?? {});
      return Promise.resolve(new Response(JSON.stringify({ object: 'list', data: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    };
    const resolver = new OnlineDeckScryfallResolverV2(fetcher, undefined, () => { waits += 1; return Promise.resolve(); });
    const entries = Array.from({ length: 76 }, (_, index) => ({ section: 'main' as const, quantity: 1, scryfallId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, oracleId: O }));
    await resolver.resolve(entries);
    expect(calls).toHaveLength(2);
    expect(waits).toBe(1);
    expect(new Headers(calls[0]?.headers).get('user-agent')).toContain('MTG-OneDeck');
    expect(new Headers(calls[0]?.headers).get('accept')).toContain('application/json');
    const requestInit = calls[0];
    const body = typeof requestInit?.body === 'string' ? JSON.parse(requestInit.body) as { identifiers?: unknown } : {};
    expect(body.identifiers).toHaveLength(75);
  });

  it('invokes a native-style fetcher without binding the resolver as receiver', async () => {
    const fetcher: typeof fetch = function (this: unknown) {
      if (this !== undefined) throw new Error('fetcher receiver must be undefined');
      return Promise.resolve(new Response(JSON.stringify({
        object: 'list',
        data: [{
          id: A,
          oracle_id: O,
          name: 'Black Lotus shape',
          lang: 'en',
          layout: 'normal',
          cmc: 0,
          color_identity: [],
          keywords: [],
          produced_mana: ['W', 'U', 'B', 'R', 'G'],
          type_line: 'Artifact',
          mana_cost: '{0}',
          oracle_text: '{T}, Sacrifice this artifact: Add three mana of any one color.',
          image_uris: { normal: 'https://img.test/normal.jpg', small: 'https://img.test/small.jpg' },
        }],
        not_found: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    };
    const result = await resolveOnlineDeckSubmissionV2([BASE_ENTRY], new OnlineDeckScryfallResolverV2(fetcher, undefined, () => Promise.resolve()));
    expect(result.issues).toEqual([]);
    expect(result.snapshot?.entries[0]?.definition).toMatchObject({
      scryfallId: A,
      oracleId: O,
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [{ typeLine: 'Artifact', manaCost: '{0}' }],
    });
  });

  it('keeps typed outage private but rethrows unknown resolver errors', async () => {
    const outage = await resolveOnlineDeckSubmissionV2([BASE_ENTRY], { resolve: () => Promise.reject(new OnlineDeckScryfallUnavailableError()) });
    expect(outage.issues).toEqual([{ code: 'SCRYFALL_UNAVAILABLE', entryIndex: null, retryable: true }]);
    await expect(resolveOnlineDeckSubmissionV2([BASE_ENTRY], { resolve: () => Promise.reject(new Error('programming failure')) })).rejects.toThrow('programming failure');
  });

  it('classifies not-found and both identity mismatches without reordering entries', async () => {
    const missing = await resolveOnlineDeckSubmissionV2([BASE_ENTRY], { resolve: () => Promise.resolve(new Map()) });
    expect(missing.issues[0]).toMatchObject({ code: 'CARD_NOT_FOUND', entryIndex: 0, retryable: false });
    const wrongOracle = await resolveOnlineDeckSubmissionV2([BASE_ENTRY], { resolve: () => Promise.resolve(new Map([[A, card(A, '00000000-0000-0000-0000-000000000000')]])) });
    expect(wrongOracle.issues[0]).toMatchObject({ code: 'IDENTITY_MISMATCH', entryIndex: 0 });
    const wrongPrint = await resolveOnlineDeckSubmissionV2([BASE_ENTRY], { resolve: () => Promise.resolve(new Map([[A, card('00000000-0000-0000-0000-000000000000')]])) });
    expect(wrongPrint.issues[0]).toMatchObject({ code: 'IDENTITY_MISMATCH', entryIndex: 0 });
  });
});
