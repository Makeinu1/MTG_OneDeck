/**
 * Reviewer-owned adversarial tests (M1 acceptance).
 * Implementation agents must NOT modify this file; make these pass by fixing
 * src/data/*. Confirmed against the real Scryfall API on 2026-06-11:
 *  - /cards/collection resolves names case-insensitively and by DFC front face,
 *    returning the canonical full English name (e.g. "fable of the mirror-breaker"
 *    -> "Fable of the Mirror-Breaker // Reflection of Kiki-Jiki").
 *  - `printed_name:` is NOT a Scryfall search keyword (it is silently ignored and
 *    matches ~30k cards). Exact Japanese name lookup must use: lang:ja !"<名前>"
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDeckList } from '../deckParser';
import { resolveDeck } from '../scryfall';
import { clearCache } from '../cache';
import { urlOf } from '../../test/fetchMock';

interface MockCard {
  id: string;
  oracle_id: string;
  name: string;
  printed_name?: string;
  lang: string;
  layout: string;
  cmc: number;
  type_line: string;
  mana_cost?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  color_identity: string[];
  image_uris?: { normal: string };
}

function card(name: string, overrides: Partial<MockCard> = {}): MockCard {
  return {
    id: `id-${name}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    type_line: 'Artifact',
    color_identity: [],
    image_uris: { normal: `https://img.example/${encodeURIComponent(name)}.jpg` },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const emptyList = { object: 'list', data: [], total_cards: 0 };

beforeEach(async () => {
  await clearCache();
  vi.unstubAllGlobals();
});

describe('parser: Arena/Moxfield export suffixes', () => {
  it('strips "(SET) collector" suffixes from card names', () => {
    const { entries, errors } = parseDeckList(
      ['1 Sol Ring (C21) 263', '1 Arcane Signet (CMM) 1080 *F*'].join('\n'),
    );
    expect(errors).toEqual([]);
    expect(entries.map((e) => e.name)).toEqual(['Sol Ring', 'Arcane Signet']);
  });

  it('treats a *CMDR* marker as the commander section', () => {
    const { entries, errors } = parseDeckList('1 The Ur-Dragon (CMM) 357 *CMDR*');
    expect(errors).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('The Ur-Dragon');
    expect(entries[0].section).toBe('commander');
  });

  it('does not mangle real card names containing parentheses', () => {
    const { entries } = parseDeckList('1 B.F.M. (Big Furry Monster)');
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('B.F.M. (Big Furry Monster)');
  });
});

describe('resolver: canonical-name mismatches must not drop cards', () => {
  function stubCollectionFetch(cards: MockCard[], notFound: string[] = []): string[] {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = urlOf(input);
        urls.push(url);
        if (url.includes('/cards/collection')) {
          return Promise.resolve(
            jsonResponse({
              object: 'list',
              data: cards,
              not_found: notFound.map((name) => ({ name })),
            }),
          );
        }
        // ja-print lookups by oracleid: pretend no ja printing exists
        return Promise.resolve(jsonResponse(emptyList, 404));
      }),
    );
    return urls;
  }

  it('resolves lowercase input names under the input key', async () => {
    stubCollectionFetch([card('Sol Ring')]);
    const result = await resolveDeck([
      { quantity: 1, name: 'sol ring', section: 'main', line: 1 },
    ]);
    expect(result.unresolved).toEqual([]);
    expect(result.resolved.get('sol ring')?.name).toBe('Sol Ring');
  });

  it('resolves DFC front-face input under the input key', async () => {
    stubCollectionFetch([
      card('Fable of the Mirror-Breaker // Reflection of Kiki-Jiki', {
        layout: 'transform',
      }),
    ]);
    const result = await resolveDeck([
      { quantity: 1, name: 'Fable of the Mirror-Breaker', section: 'main', line: 1 },
    ]);
    expect(result.unresolved).toEqual([]);
    expect(result.resolved.get('Fable of the Mirror-Breaker')?.name).toBe(
      'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki',
    );
  });

  it('requests full DFC input names by front face (collection rejects "A // B")', async () => {
    const collectionBodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = urlOf(input);
        if (url.includes('/cards/collection')) {
          collectionBodies.push(
            typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
          );
          return Promise.resolve(
            jsonResponse({
              object: 'list',
              data: [
                card('Valakut Awakening // Valakut Stoneforge', { layout: 'modal_dfc' }),
              ],
              not_found: [],
            }),
          );
        }
        return Promise.resolve(jsonResponse(emptyList, 404));
      }),
    );
    const fullName = 'Valakut Awakening // Valakut Stoneforge';
    const result = await resolveDeck([
      { quantity: 1, name: fullName, section: 'main', line: 1 },
    ]);
    expect(collectionBodies).toEqual([
      { identifiers: [{ name: 'Valakut Awakening' }] },
    ]);
    expect(result.unresolved).toEqual([]);
    expect(result.resolved.get(fullName)?.name).toBe(fullName);
  });

  it('accounts for every entry exactly once (resolved XOR unresolved) and finishes progress', async () => {
    stubCollectionFetch([card('Sol Ring')], ['Definitely Not A Card']);
    const entries = [
      { quantity: 1, name: 'SOL RING', section: 'main' as const, line: 1 },
      { quantity: 1, name: 'Definitely Not A Card', section: 'main' as const, line: 2 },
    ];
    let lastProgress = { done: -1, total: -1 };
    const result = await resolveDeck(entries, (p) => {
      lastProgress = p;
    });
    for (const entry of entries) {
      const inResolved = result.resolved.has(entry.name);
      const inUnresolved = result.unresolved.some((u) => u.line === entry.line);
      expect(
        inResolved !== inUnresolved,
        `entry "${entry.name}" must be in exactly one of resolved/unresolved`,
      ).toBe(true);
    }
    expect(lastProgress).toEqual({ done: 2, total: 2 });
  });
});

describe('resolver: Japanese exact-name query syntax', () => {
  it('uses lang:ja !"<name>" (printed_name: is not a real Scryfall keyword)', async () => {
    const searchQueries: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = urlOf(input);
        if (url.includes('/cards/search')) {
          searchQueries.push(new URL(url).searchParams.get('q') ?? '');
          return Promise.resolve(
            jsonResponse({
              object: 'list',
              total_cards: 1,
              data: [
                card('Lightning Bolt', {
                  lang: 'ja',
                  printed_name: '稲妻',
                  type_line: 'Instant',
                  mana_cost: '{R}',
                  oracle_text: 'Lightning Bolt deals 3 damage to any target.',
                  color_identity: ['R'],
                }),
              ],
            }),
          );
        }
        return Promise.resolve(jsonResponse(emptyList, 404));
      }),
    );

    const result = await resolveDeck([
      { quantity: 1, name: '稲妻', section: 'main', line: 1 },
    ]);

    expect(searchQueries).toHaveLength(1);
    expect(searchQueries[0]).toBe('lang:ja !"稲妻"');
    expect(result.unresolved).toEqual([]);
    const def = result.resolved.get('稲妻');
    expect(def?.name).toBe('Lightning Bolt');
    expect(def?.printedName).toBe('稲妻');
    // Single-faced cards must carry cost/text onto their synthesized face —
    // a missing manaCost makes every cast free in the engine.
    expect(def?.faces[0]?.manaCost).toBe('{R}');
    expect(def?.faces[0]?.oracleText).toContain('3 damage');
  });
});
