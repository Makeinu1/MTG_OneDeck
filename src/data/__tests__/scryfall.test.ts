import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { resolveDeck } from '../scryfall';
import type { DeckEntry } from '../deckParser';
import { clearCache } from '../cache';
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

function makeScryfallCard(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'scryfall-id-1',
    oracle_id: 'oracle-id-1',
    name: 'Sol Ring',
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    color_identity: [],
    type_line: 'Artifact',
    produced_mana: undefined,
    image_uris: { normal: 'https://example.com/sol-ring.jpg' },
    ...overrides,
  };
}

describe('resolveDeck', () => {
  beforeEach(async () => {
    await clearCache();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('splits 76 ascii names into 2 batches of <=75', async () => {
    const entries: DeckEntry[] = Array.from({ length: 76 }, (_, i) =>
      makeEntry({ name: `Card ${i}`, line: i + 1 }),
    );

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      void init;
      const url = urlOf(input);

      if (url.includes('/cards/collection')) {
        return jsonResponse({ object: 'list', data: [], not_found: [] });
      }
      // Japanese-print lookups: pretend none exist.
      if (url.includes('/cards/search')) {
        return jsonResponse({ object: 'list', data: [] });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    await promise;

    const collectionCalls = fetchMock.mock.calls.filter(([input]) => {
      return urlOf(input).includes('/cards/collection');
    });

    expect(collectionCalls).toHaveLength(2);

    const firstBody = JSON.parse(collectionCalls[0][1]?.body as string) as {
      identifiers: { name: string }[];
    };
    const secondBody = JSON.parse(collectionCalls[1][1]?.body as string) as {
      identifiers: { name: string }[];
    };
    expect(firstBody.identifiers).toHaveLength(75);
    expect(secondBody.identifiers).toHaveLength(1);
  });

  it('retries after a 429 response and eventually succeeds', async () => {
    const entries = [makeEntry({ name: 'Sol Ring', line: 1 })];

    let collectionCallCount = 0;
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = urlOf(input);

      if (url.includes('/cards/collection')) {
        collectionCallCount += 1;
        if (collectionCallCount === 1) {
          return jsonResponse(
            { object: 'error', status: 429, code: 'rate_limited', details: '' },
            { status: 429 },
          );
        }
        return jsonResponse({
          object: 'list',
          data: [makeScryfallCard()],
          not_found: [],
        });
      }
      if (url.includes('/cards/search')) {
        return jsonResponse({ object: 'list', data: [] });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(collectionCallCount).toBe(2);
    expect(result.resolved.get('Sol Ring')?.name).toBe('Sol Ring');
    expect(result.unresolved).toEqual([]);
  });

  it('resolves a japanese card name via printed_name search', async () => {
    const entries = [makeEntry({ name: '稲妻', line: 1 })];

    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = urlOf(input);

      if (url.includes('/cards/search')) {
        expect(url).toContain('printed_name');
        expect(url).toContain(encodeURIComponent('稲妻'));
        return jsonResponse({
          object: 'list',
          data: [
            makeScryfallCard({
              id: 'lightning-bolt-ja',
              oracle_id: 'lightning-bolt-oracle',
              name: 'Lightning Bolt',
              printed_name: '稲妻',
              lang: 'ja',
              type_line: 'Instant',
              cmc: 1,
              image_uris: { normal: 'https://example.com/inazuma.jpg' },
            }),
          ],
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    const result = await promise;

    const card = result.resolved.get('稲妻');
    expect(card).toBeDefined();
    expect(card?.name).toBe('Lightning Bolt');
    expect(card?.printedName).toBe('稲妻');
    expect(card?.lang).toBe('ja');
    expect(result.unresolved).toEqual([]);
  });

  it('reports not_found ascii names as unresolved', async () => {
    const entries = [makeEntry({ name: 'Totally Fake Card', line: 5 })];

    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = urlOf(input);
      if (url.includes('/cards/collection')) {
        return jsonResponse({
          object: 'list',
          data: [],
          not_found: [{ name: 'Totally Fake Card' }],
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.resolved.size).toBe(0);
    expect(result.unresolved).toEqual([
      { name: 'Totally Fake Card', line: 5, reason: 'not_found' },
    ]);
  });
});
