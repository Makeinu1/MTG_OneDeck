import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { resolveDeck } from '../scryfall';
import { clearCache, putCardDef } from '../cache';
import type { CardDef } from '../../types/card';
import type { DeckEntry } from '../deckParser';
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

function makeCardDef(overrides: Partial<CardDef> = {}): CardDef {
  return {
    scryfallId: 'sol-ring-id',
    oracleId: 'sol-ring-oracle',
    name: 'Sol Ring',
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    colorIdentity: [],
    typeLine: 'Artifact',
    faces: [
      { name: 'Sol Ring', typeLine: 'Artifact', imageUrl: 'https://example.com/sol-ring.jpg' },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('cache integration with resolveDeck', () => {
  beforeEach(async () => {
    await clearCache();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not call fetch when the card is already cached', async () => {
    await putCardDef('Sol Ring', makeCardDef());

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const entries = [makeEntry({ name: 'Sol Ring', line: 1 })];
    const promise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.resolved.get('Sol Ring')?.name).toBe('Sol Ring');
    expect(result.unresolved).toEqual([]);
  });

  it('resolves cached entries even when the network is completely down', async () => {
    await putCardDef('Sol Ring', makeCardDef());

    const fetchMock = vi.fn(() => {
      throw new TypeError('network error');
    });
    vi.stubGlobal('fetch', fetchMock);

    const entries = [
      makeEntry({ name: 'Sol Ring', line: 1 }),
      makeEntry({ name: 'Lightning Bolt', line: 2 }),
    ];
    const promise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.resolved.get('Sol Ring')?.name).toBe('Sol Ring');
    expect(result.resolved.has('Lightning Bolt')).toBe(false);
    expect(result.unresolved).toEqual([
      { name: 'Lightning Bolt', line: 2, reason: 'network error' },
    ]);
  });

  it('caches a freshly resolved card so a subsequent resolve avoids fetch', async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = urlOf(input);
      if (url.includes('/cards/collection')) {
        return jsonResponse({
          object: 'list',
          data: [
            {
              id: 'sol-ring-id',
              oracle_id: 'sol-ring-oracle',
              name: 'Sol Ring',
              lang: 'en',
              layout: 'normal',
              cmc: 1,
              color_identity: [],
              type_line: 'Artifact',
              image_uris: { normal: 'https://example.com/sol-ring.jpg' },
            },
          ],
          not_found: [],
        });
      }
      if (url.includes('/cards/search')) {
        return jsonResponse({ object: 'list', data: [] });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const entries = [makeEntry({ name: 'Sol Ring', line: 1 })];

    const firstPromise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    const firstResult = await firstPromise;
    expect(firstResult.resolved.get('Sol Ring')?.name).toBe('Sol Ring');
    expect(fetchMock).toHaveBeenCalled();

    fetchMock.mockClear();

    const secondPromise = resolveDeck(entries);
    await vi.runAllTimersAsync();
    const secondResult = await secondPromise;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(secondResult.resolved.get('Sol Ring')?.name).toBe('Sol Ring');
  });
});
