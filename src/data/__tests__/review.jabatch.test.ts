/**
 * Reviewer-owned adversarial tests for M4.10 batched Japanese-print resolution.
 * Implementation agents must NOT modify this file.
 *
 * Verified against the live Scryfall API on 2026-06-13:
 *   GET /cards/search?q=lang:ja (oracleid:A or oracleid:B ...)&unique=cards
 *   returns one Japanese printing per oracle id in a single request.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveDeck } from '../scryfall';
import { clearCache } from '../cache';
import { urlOf } from '../../test/fetchMock';
import type { DeckEntry } from '../deckParser';

interface MockCard {
  id: string;
  oracle_id: string;
  name: string;
  printed_name?: string;
  lang: string;
  layout: string;
  cmc: number;
  type_line: string;
  color_identity: string[];
  image_uris?: { normal: string };
  card_faces?: unknown[];
}

function en(name: string, oracleId: string): MockCard {
  return {
    id: `en-${oracleId}`,
    oracle_id: oracleId,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    type_line: 'Artifact',
    color_identity: [],
    image_uris: { normal: `https://img/en/${oracleId}.jpg` },
  };
}

function ja(name: string, oracleId: string, printedName: string): MockCard {
  return {
    id: `ja-${oracleId}`,
    oracle_id: oracleId,
    name,
    printed_name: printedName,
    lang: 'ja',
    layout: 'normal',
    cmc: 1,
    type_line: 'Artifact',
    color_identity: [],
    image_uris: { normal: `https://img/ja/${oracleId}.jpg` },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  await clearCache();
  vi.unstubAllGlobals();
});

function entries(names: string[]): DeckEntry[] {
  return names.map((name, i) => ({ quantity: 1, name, section: 'main', line: i + 1 }));
}

describe('batched ja resolution (M4.10)', () => {
  it('chunks oracle ids into batches of 15 and maps ja prints back by oracle_id', async () => {
    const N = 32; // -> 3 ja-search requests (15 + 15 + 2)
    const names = Array.from({ length: N }, (_, i) => `Card ${i}`);
    const oid = (i: number) => `oracle-${i}`;
    const enCards = names.map((n, i) => en(n, oid(i)));
    const jaSearchUrls: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = urlOf(input);
        if (url.includes('/cards/collection')) {
          return Promise.resolve(jsonResponse({ object: 'list', data: enCards, not_found: [] }));
        }
        if (url.includes('/cards/search')) {
          jaSearchUrls.push(url);
          const q = decodeURIComponent(new URL(url).searchParams.get('q') ?? '');
          // return ja prints for whichever oracleids are mentioned in this chunk's query
          const data = enCards
            .filter((c) => q.includes(`oracleid:${c.oracle_id}`))
            .map((c) => ja(c.name, c.oracle_id, `日本語${c.oracle_id}`));
          return Promise.resolve(jsonResponse({ object: 'list', total_cards: data.length, data }));
        }
        return Promise.resolve(jsonResponse({ object: 'list', data: [] }, 404));
      }),
    );

    const result = await resolveDeck(entries(names));
    // 32 ids -> ceil(32/15) = 3 ja-search requests
    expect(jaSearchUrls.length).toBe(3);
    expect(result.unresolved).toEqual([]);
    for (const n of names) {
      const def = result.resolved.get(n);
      expect(def?.lang, `${n} should be ja`).toBe('ja');
      expect(def?.printedName).toMatch(/^日本語/);
      expect(def?.faces[0]?.imageUrl).toContain('/ja/');
    }
  });

  it('keeps English when no ja print exists for that oracle id', async () => {
    const enOnly = en('English Only', 'oracle-eo');
    const hasJa = en('Has Ja', 'oracle-hj');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = urlOf(input);
        if (url.includes('/cards/collection')) {
          return Promise.resolve(
            jsonResponse({ object: 'list', data: [enOnly, hasJa], not_found: [] }),
          );
        }
        if (url.includes('/cards/search')) {
          // only oracle-hj has a ja print
          return Promise.resolve(
            jsonResponse({ object: 'list', total_cards: 1, data: [ja('Has Ja', 'oracle-hj', '日本語版')] }),
          );
        }
        return Promise.resolve(jsonResponse({ object: 'list', data: [] }, 404));
      }),
    );

    const result = await resolveDeck(entries(['English Only', 'Has Ja']));
    expect(result.resolved.get('English Only')?.lang).toBe('en');
    expect(result.resolved.get('English Only')?.faces[0]?.imageUrl).toContain('/en/');
    expect(result.resolved.get('Has Ja')?.lang).toBe('ja');
  });

  it('follows has_more / next_page pagination', async () => {
    const a = en('A', 'oracle-a');
    const b = en('B', 'oracle-b');
    let searchCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = urlOf(input);
        if (url.includes('/cards/collection')) {
          return Promise.resolve(jsonResponse({ object: 'list', data: [a, b], not_found: [] }));
        }
        if (url.includes('/cards/search') || url.includes('page=2')) {
          searchCalls += 1;
          if (searchCalls === 1) {
            return Promise.resolve(
              jsonResponse({
                object: 'list',
                total_cards: 2,
                has_more: true,
                next_page: 'https://api.scryfall.com/cards/search?page=2',
                data: [ja('A', 'oracle-a', 'えー')],
              }),
            );
          }
          return Promise.resolve(
            jsonResponse({ object: 'list', total_cards: 2, has_more: false, data: [ja('B', 'oracle-b', 'びー')] }),
          );
        }
        return Promise.resolve(jsonResponse({ object: 'list', data: [] }, 404));
      }),
    );

    const result = await resolveDeck(entries(['A', 'B']));
    expect(searchCalls).toBe(2);
    expect(result.resolved.get('A')?.printedName).toBe('えー');
    expect(result.resolved.get('B')?.printedName).toBe('びー');
  });

  it('retries a throttled (429) ja-search chunk instead of dropping it', async () => {
    const a = en('A', 'oracle-a');
    let searchAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = urlOf(input);
        if (url.includes('/cards/collection')) {
          return Promise.resolve(jsonResponse({ object: 'list', data: [a], not_found: [] }));
        }
        if (url.includes('/cards/search')) {
          searchAttempts += 1;
          if (searchAttempts === 1) return Promise.resolve(jsonResponse({}, 429));
          return Promise.resolve(
            jsonResponse({ object: 'list', total_cards: 1, data: [ja('A', 'oracle-a', 'えー')] }),
          );
        }
        return Promise.resolve(jsonResponse({ object: 'list', data: [] }, 404));
      }),
    );

    const result = await resolveDeck(entries(['A']));
    expect(searchAttempts).toBeGreaterThanOrEqual(2);
    expect(result.resolved.get('A')?.lang).toBe('ja');
  }, 15000);
});
