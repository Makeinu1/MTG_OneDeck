import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { clearCache } from '../cache';
import type { DeckEntry } from '../deckParser';
import { resolveDeck } from '../scryfall';
import { urlOf } from '../../test/fetchMock';

function makeEntry(overrides: Partial<DeckEntry> = {}): DeckEntry {
  return {
    quantity: 1,
    name: 'Sol Ring',
    section: 'main',
    line: 1,
    ...overrides,
  };
}

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeScryfallCard(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'scryfall-id-1',
    oracle_id: 'oracle-id-1',
    name: 'Sol Ring',
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    color_identity: [],
    type_line: 'Artifact',
    image_uris: { normal: 'https://example.com/sol-ring-en.jpg' },
    ...overrides,
  };
}

function extractOracleIds(query: string): string[] {
  return [...query.matchAll(/oracleid:([^) ]+)/g)].map((match) => match[1]);
}

describe('resolveDeck Japanese print batching', () => {
  beforeEach(async () => {
    await clearCache();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('splits 40 oracle ids into 3 Japanese search chunks of at most 15', async () => {
    const entries: DeckEntry[] = Array.from({ length: 40 }, (_, index) =>
      makeEntry({ name: `Card ${index}`, line: index + 1 }),
    );

    const searchQueries: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = urlOf(input);

        if (url.includes('/cards/collection')) {
          return Promise.resolve(
            jsonResponse({
              object: 'list',
              data: entries.map((entry, index) =>
                makeScryfallCard({
                  id: `scryfall-${index}`,
                  oracle_id: `oracle-${index}`,
                  name: entry.name,
                }),
              ),
              not_found: [],
            }),
          );
        }

        if (url.includes('/cards/search')) {
          searchQueries.push(new URL(url).searchParams.get('q') ?? '');
          return Promise.resolve(jsonResponse({ object: 'list', data: [] }, { status: 404 }));
        }

        throw new Error(`unexpected url: ${url}`);
      }),
    );

    const promise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.unresolved).toEqual([]);
    expect(searchQueries).toHaveLength(3);
    expect(searchQueries.map(extractOracleIds)).toEqual([
      Array.from({ length: 15 }, (_, index) => `oracle-${index}`),
      Array.from({ length: 15 }, (_, index) => `oracle-${index + 15}`),
      Array.from({ length: 10 }, (_, index) => `oracle-${index + 30}`),
    ]);
  });

  it('applies paginated Japanese prints by oracle id and leaves missing prints in English', async () => {
    const entries: DeckEntry[] = [
      makeEntry({ name: 'Tersa Lightshatter', line: 1 }),
      makeEntry({ name: 'Fable of the Mirror-Breaker', line: 2 }),
      makeEntry({ name: 'Arcane Signet', line: 3 }),
    ];

    const nextPageUrl = 'https://api.scryfall.com/cards/search?page=2&token=ja-next';
    const searchUrls: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = urlOf(input);

        if (url.includes('/cards/collection')) {
          return Promise.resolve(
            jsonResponse({
              object: 'list',
              data: [
                makeScryfallCard({
                  id: 'tersa-en-id',
                  oracle_id: 'oracle-tersa',
                  name: 'Tersa Lightshatter',
                  type_line: 'Legendary Creature — Human Soldier',
                  image_uris: { normal: 'https://example.com/tersa-en.jpg' },
                }),
                makeScryfallCard({
                  id: 'fable-en-id',
                  oracle_id: 'oracle-fable',
                  name: 'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki',
                  layout: 'transform',
                  type_line: 'Enchantment — Saga',
                  image_uris: { normal: 'https://example.com/fable-front-en.jpg' },
                  card_faces: [
                    {
                      name: 'Fable of the Mirror-Breaker',
                      type_line: 'Enchantment — Saga',
                      image_uris: { normal: 'https://example.com/fable-front-en.jpg' },
                    },
                    {
                      name: 'Reflection of Kiki-Jiki',
                      type_line: 'Enchantment Creature — Goblin Shaman',
                      image_uris: { normal: 'https://example.com/fable-back-en.jpg' },
                    },
                  ],
                }),
                makeScryfallCard({
                  id: 'signet-en-id',
                  oracle_id: 'oracle-signet',
                  name: 'Arcane Signet',
                  type_line: 'Artifact',
                  image_uris: { normal: 'https://example.com/signet-en.jpg' },
                }),
              ],
              not_found: [],
            }),
          );
        }

        if (url === nextPageUrl) {
          searchUrls.push(url);
          return Promise.resolve(
            jsonResponse({
              object: 'list',
              data: [
                makeScryfallCard({
                  id: 'fable-ja-id',
                  oracle_id: 'oracle-fable',
                  name: 'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki',
                  lang: 'ja',
                  printed_name: '鏡割りの寓話 // キキジキの鏡像',
                  layout: 'transform',
                  type_line: 'Enchantment — Saga',
                  image_uris: { normal: 'https://example.com/fable-front-ja.jpg' },
                  card_faces: [
                    {
                      name: 'Fable of the Mirror-Breaker',
                      printed_name: '鏡割りの寓話',
                      type_line: 'Enchantment — Saga',
                      printed_type_line: '英雄譚',
                      printed_text: 'I, II — 2/2のゴブリンを生成する。',
                      image_uris: { normal: 'https://example.com/fable-front-ja.jpg' },
                    },
                    {
                      name: 'Reflection of Kiki-Jiki',
                      printed_name: 'キキジキの鏡像',
                      type_line: 'Enchantment Creature — Goblin Shaman',
                      printed_type_line: 'エンチャント クリーチャー',
                      printed_text: '速攻',
                      image_uris: { normal: 'https://example.com/fable-back-ja.jpg' },
                    },
                  ],
                }),
              ],
            }),
          );
        }

        if (url.includes('/cards/search')) {
          searchUrls.push(url);
          return Promise.resolve(
            jsonResponse({
              object: 'list',
              data: [
                makeScryfallCard({
                  id: 'tersa-ja-id',
                  oracle_id: 'oracle-tersa',
                  name: 'Tersa Lightshatter',
                  lang: 'ja',
                  printed_name: '光砕く者、テルサ',
                  type_line: 'Legendary Creature — Human Soldier',
                  printed_text: '先制攻撃',
                  image_uris: { normal: 'https://example.com/tersa-ja.jpg' },
                }),
              ],
              has_more: true,
              next_page: nextPageUrl,
            }),
          );
        }

        throw new Error(`unexpected url: ${url}`);
      }),
    );

    const promise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(searchUrls).toEqual([
      expect.stringContaining('/cards/search?q='),
      nextPageUrl,
    ]);

    const tersa = result.resolved.get('Tersa Lightshatter');
    expect(tersa?.lang).toBe('ja');
    expect(tersa?.printedName).toBe('光砕く者、テルサ');
    expect(tersa?.faces[0]?.imageUrl).toBe('https://example.com/tersa-ja.jpg');

    const fable = result.resolved.get('Fable of the Mirror-Breaker');
    expect(fable?.lang).toBe('ja');
    expect(fable?.faces[0]?.printedName).toBe('鏡割りの寓話');
    expect(fable?.faces[0]?.imageUrl).toBe('https://example.com/fable-front-ja.jpg');
    expect(fable?.faces[1]?.printedName).toBe('キキジキの鏡像');
    expect(fable?.faces[1]?.imageUrl).toBe('https://example.com/fable-back-ja.jpg');

    const signet = result.resolved.get('Arcane Signet');
    expect(signet?.lang).toBe('en');
    expect(signet?.printedName).toBeUndefined();
    expect(signet?.faces[0]?.imageUrl).toBe('https://example.com/signet-en.jpg');
  });

  it('retries a throttled Japanese batch request and still applies the Japanese print', async () => {
    let searchCalls = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = urlOf(input);

        if (url.includes('/cards/collection')) {
          return Promise.resolve(
            jsonResponse({
              object: 'list',
              data: [
                makeScryfallCard({
                  id: 'sol-ring-en-id',
                  oracle_id: 'oracle-sol-ring',
                  name: 'Sol Ring',
                  image_uris: { normal: 'https://example.com/sol-ring-en.jpg' },
                }),
              ],
              not_found: [],
            }),
          );
        }

        if (url.includes('/cards/search')) {
          searchCalls += 1;
          if (searchCalls === 1) {
            return Promise.resolve(
              jsonResponse(
                { object: 'error', status: 429, code: 'rate_limited', details: 'slow down' },
                { status: 429 },
              ),
            );
          }

          return Promise.resolve(
            jsonResponse({
              object: 'list',
              data: [
                makeScryfallCard({
                  id: 'sol-ring-ja-id',
                  oracle_id: 'oracle-sol-ring',
                  name: 'Sol Ring',
                  lang: 'ja',
                  printed_name: '太陽の指輪',
                  image_uris: { normal: 'https://example.com/sol-ring-ja.jpg' },
                }),
              ],
            }),
          );
        }

        throw new Error(`unexpected url: ${url}`);
      }),
    );

    const promise = resolveDeck([makeEntry({ name: 'Sol Ring', line: 1 })]);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(searchCalls).toBe(2);
    expect(result.unresolved).toEqual([]);
    expect(result.resolved.get('Sol Ring')?.lang).toBe('ja');
    expect(result.resolved.get('Sol Ring')?.printedName).toBe('太陽の指輪');
  });
});
