import type { CardDef, CardFace, ManaColor } from '../../types/card';
import { coreSha256HexV1 } from '../../engine/core/index';
import {
  ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2,
  type OnlineDeckResolvedEntryV2,
  type OnlineDeckResolverV2,
  type OnlineDeckSubmissionEntryV2,
  type OnlineDeckSubmissionIssueV2,
  type OnlineDeckResolutionResultV2,
} from './types';

const BATCH_SIZE = 75;
const VALID_MANA = new Set<ManaColor>(['W', 'U', 'B', 'R', 'G', 'C']);

export class OnlineDeckScryfallUnavailableError extends Error {
  constructor() { super('Scryfall unavailable'); this.name = 'OnlineDeckScryfallUnavailableError'; }
}

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function string(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function number(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function array(value: unknown): readonly unknown[] | null { return Array.isArray(value) ? value : null; }
function optionalString(value: RecordValue, key: string): string | undefined | null {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
  return string(value[key]);
}
function optionalStringArray(value: RecordValue, key: string): readonly string[] | undefined | null {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
  const raw = array(value[key]);
  if (raw === null || !raw.every((entry) => typeof entry === 'string')) return null;
  return raw;
}

function face(value: unknown, fallback: RecordValue | null): CardFace | null {
  if (!record(value)) return null;
  const name = string(value.name) ?? (fallback === null ? null : string(fallback.name));
  const typeLine = string(value.type_line) ?? (fallback === null ? null : string(fallback.type_line));
  if (name === null || typeLine === null) return null;
  const result: CardFace = { name, typeLine };
  const optional: readonly [keyof CardFace, string][] = [
    ['printedName', 'printed_name'], ['manaCost', 'mana_cost'], ['printedTypeLine', 'printed_type_line'], ['oracleText', 'oracle_text'], ['printedText', 'printed_text'],
    ['power', 'power'], ['toughness', 'toughness'], ['loyalty', 'loyalty'], ['defense', 'defense'],
  ];
  for (const [target, source] of optional) {
    const current = optionalString(value, source);
    if (current === null) return null;
    if (current !== undefined) (result as unknown as Record<string, unknown>)[target] = current;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'image_uris')) {
    if (!record(value.image_uris)) return null;
    const normal = optionalString(value.image_uris, 'normal');
    const small = optionalString(value.image_uris, 'small');
    if (normal === null || small === null) return null;
    if (normal !== undefined) result.imageUrl = normal;
    if (small !== undefined) result.imageUrlSmall = small;
  }
  return Object.freeze(result);
}

function mapCard(value: unknown): CardDef | null {
  if (!record(value)) return null;
  const id = string(value.id);
  const oracleId = value.oracle_id === undefined || value.oracle_id === null ? id : string(value.oracle_id);
  const name = string(value.name);
  const lang = string(value.lang);
  const layout = string(value.layout);
  const cmc = number(value.cmc);
  const typeLine = string(value.type_line);
  const colors = optionalStringArray(value, 'color_identity');
  const keywords = optionalStringArray(value, 'keywords');
  const produced = optionalStringArray(value, 'produced_mana');
  const printedName = optionalString(value, 'printed_name');
  const rank = Object.prototype.hasOwnProperty.call(value, 'edhrec_rank') ? number(value.edhrec_rank) : undefined;
  if (id === null || oracleId === null || name === null || lang === null || layout === null || cmc === null || typeLine === null || colors === null || keywords === null || produced === null || printedName === null || rank === null || (produced !== undefined && !produced.every((entry) => VALID_MANA.has(entry as ManaColor)))) return null;
  let mappedFaces: readonly (CardFace | null)[];
  if (Object.prototype.hasOwnProperty.call(value, 'card_faces')) {
    const rawFaces = array(value.card_faces);
    if (rawFaces === null || rawFaces.length === 0) return null;
    mappedFaces = rawFaces.map((entry) => face(entry, null));
  } else mappedFaces = [face(value, value)];
  const faces = mappedFaces.every((entry): entry is CardFace => entry !== null) ? mappedFaces : [];
  if (faces.length === 0) return null;
  const result: CardDef = {
    scryfallId: id,
    oracleId,
    name,
    lang: lang === 'ja' ? 'ja' : 'en',
    layout,
    cmc,
    colorIdentity: [...(colors ?? [])],
    typeLine,
    faces: [...faces],
  };
  if (printedName !== undefined) result.printedName = printedName;
  if (rank !== undefined) result.edhrecRank = rank;
  if (keywords !== undefined && keywords.length > 0) result.keywords = [...keywords];
  if (produced !== undefined && produced.length > 0) result.producedMana = [...produced] as ManaColor[];
  return Object.freeze(result);
}

function responseCards(value: unknown): readonly unknown[] {
  if (!record(value) || value.object !== 'list') throw new OnlineDeckScryfallUnavailableError();
  const data = array(value.data);
  if (data === null) throw new OnlineDeckScryfallUnavailableError();
  return data;
}

/** Production resolver. It always calls Scryfall and never consults client/cache data. */
export class OnlineDeckScryfallResolverV2 implements OnlineDeckResolverV2 {
  private readonly fetcher: typeof fetch;
  private readonly endpoint: string;
  private readonly wait: () => Promise<void>;
  constructor(fetcher: typeof fetch = fetch, endpoint = 'https://api.scryfall.com/cards/collection', wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 100))) {
    this.fetcher = fetcher;
    this.endpoint = endpoint;
    this.wait = wait;
  }

  async resolve(entries: readonly OnlineDeckSubmissionEntryV2[]): Promise<ReadonlyMap<string, CardDef>> {
    const detailed = await this.resolveDetailed(entries);
    return detailed.definitions;
  }

  async resolveDetailed(entries: readonly OnlineDeckSubmissionEntryV2[]): Promise<Readonly<{ readonly definitions: ReadonlyMap<string, CardDef>; readonly identityMismatches: ReadonlySet<string> }>> {
    const unique = [...new Set(entries.map((entry) => entry.scryfallId))];
    const resolved = new Map<string, CardDef>();
    const identityMismatches = new Set<string>();
    for (let offset = 0; offset < unique.length; offset += BATCH_SIZE) {
      if (offset > 0) await this.wait();
      const ids = unique.slice(offset, offset + BATCH_SIZE);
      let response: Response;
      try {
        response = await this.fetcher(this.endpoint, {
          method: 'POST',
          headers: {
            'User-Agent': 'MTG-OneDeck/online-v2',
            Accept: 'application/json;q=0.9,*/*;q=0.8',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ identifiers: ids.map((id) => ({ id })) }),
        });
      } catch { throw new OnlineDeckScryfallUnavailableError(); }
      if (!response.ok) throw new OnlineDeckScryfallUnavailableError();
      let parsed: unknown;
      try { parsed = await response.json(); } catch { throw new OnlineDeckScryfallUnavailableError(); }
      for (const item of responseCards(parsed)) {
        const card = mapCard(item);
        if (card === null) throw new OnlineDeckScryfallUnavailableError();
        if (!ids.includes(card.scryfallId)) {
          for (const id of ids) if (!resolved.has(id)) identityMismatches.add(id);
          continue;
        }
        resolved.set(card.scryfallId, card);
      }
    }
    return Object.freeze({ definitions: resolved, identityMismatches });
  }
}

function issue(code: OnlineDeckSubmissionIssueV2['code'], entryIndex: number | null, retryable = false): OnlineDeckSubmissionIssueV2 {
  return Object.freeze({ code, entryIndex, retryable });
}

export async function resolveOnlineDeckSubmissionV2(
  entries: readonly OnlineDeckSubmissionEntryV2[],
  resolver: OnlineDeckResolverV2,
): Promise<OnlineDeckResolutionResultV2> {
  let definitions: ReadonlyMap<string, CardDef>;
  let identityMismatches: ReadonlySet<string> = new Set();
  try {
    if (resolver.resolveDetailed !== undefined) {
      const detailed = await resolver.resolveDetailed(entries);
      definitions = detailed.definitions;
      identityMismatches = detailed.identityMismatches;
    } else definitions = await resolver.resolve(entries);
  }
  catch (error: unknown) {
    if (error instanceof OnlineDeckScryfallUnavailableError) {
      return Object.freeze({ snapshot: null, issues: Object.freeze([issue('SCRYFALL_UNAVAILABLE', null, true)]) });
    }
    throw error;
  }
  const issues: OnlineDeckSubmissionIssueV2[] = [];
  const resolvedEntries: OnlineDeckResolvedEntryV2[] = [];
  entries.forEach((entry, index) => {
    const definition = definitions.get(entry.scryfallId);
    if (definition === undefined) { issues.push(issue(identityMismatches.has(entry.scryfallId) ? 'IDENTITY_MISMATCH' : 'CARD_NOT_FOUND', index)); return; }
    if (definition.scryfallId !== entry.scryfallId || definition.oracleId !== entry.oracleId) { issues.push(issue('IDENTITY_MISMATCH', index)); return; }
    resolvedEntries.push(Object.freeze({ ...entry, index, definition }));
  });
  if (issues.length > 0) return Object.freeze({ snapshot: null, issues: Object.freeze(issues) });
  const serialized = JSON.stringify({ entries: resolvedEntries });
  if (new TextEncoder().encode(serialized).length > ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2) return Object.freeze({ snapshot: null, issues: Object.freeze([issue('SNAPSHOT_TOO_LARGE', null)]) });
  return Object.freeze({ snapshot: Object.freeze({ entries: Object.freeze(resolvedEntries), serialized, digest: coreSha256HexV1(serialized) }), issues: Object.freeze([]) });
}
