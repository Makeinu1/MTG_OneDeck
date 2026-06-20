import type { CardDef, CardFace, ManaColor } from '../types/card';
import type { DeckEntry } from './deckParser';
import { getCachedByName, putCardDef } from './cache';

export interface ResolveProgress {
  done: number;
  total: number;
}

export interface ResolveResult {
  resolved: Map<string, CardDef>; // key: DeckEntry.name (trim済みの入力名)
  unresolved: { name: string; line: number; reason: string }[];
}

const SCRYFALL_API_BASE = 'https://api.scryfall.com';
const COLLECTION_BATCH_SIZE = 75;
const JAPANESE_PRINT_BATCH_SIZE = 15;
const REQUEST_INTERVAL_MS = 100;
const MAX_RETRIES = 3;
const VALID_MANA_COLORS: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

// --- Minimal Scryfall API response shapes (only fields we use) ---

interface ScryfallImageUris {
  normal?: string;
}

interface ScryfallCardFace {
  name: string;
  printed_name?: string;
  mana_cost?: string;
  type_line?: string;
  printed_type_line?: string;
  oracle_text?: string;
  printed_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: ScryfallImageUris;
}

interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  lang: string;
  layout: string;
  cmc: number;
  color_identity?: string[];
  type_line: string;
  printed_type_line?: string;
  mana_cost?: string;
  oracle_text?: string;
  printed_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  edhrec_rank?: number;
  keywords?: string[];
  produced_mana?: string[];
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
}

interface ScryfallList<T> {
  object: 'list';
  data: T[];
  not_found?: { name?: string }[];
  has_more?: boolean;
  next_page?: string;
}

interface ScryfallError {
  object: 'error';
  status: number;
  code: string;
  details: string;
}

// --- Type guards / helpers ---

function isScryfallError(value: unknown): value is ScryfallError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { object?: unknown }).object === 'error'
  );
}

function isAscii(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a URL with rate limiting (caller is responsible for spacing requests)
 * and exponential backoff retry on 429/503 responses.
 *
 * Throttled Scryfall responses can arrive without CORS headers, in which case
 * the browser surfaces them as a thrown TypeError rather than an HTTP status —
 * so network-level rejections are retried with the same backoff policy.
 */
async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let attempt = 0;
  for (;;) {
    try {
      const response = await fetch(url, init);
      if (response.status !== 429 && response.status !== 503) {
        return response;
      }
      if (attempt >= MAX_RETRIES) {
        return response;
      }
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        throw err;
      }
    }
    const backoffMs = REQUEST_INTERVAL_MS * 2 ** attempt * 10;
    await sleep(backoffMs);
    attempt += 1;
  }
}

/**
 * Convert a raw Scryfall card object into our CardDef shape.
 * `lang` and the image/printed-name overrides for the face(s) may be supplied
 * separately when a Japanese print was fetched after an English match.
 */
function mapScryfallCardToCardDef(card: ScryfallCard): CardDef {
  const producedMana = card.produced_mana?.filter((color): color is ManaColor =>
    (VALID_MANA_COLORS as readonly string[]).includes(color),
  );

  let faces: CardFace[];
  if (card.card_faces && card.card_faces.length > 0) {
    faces = card.card_faces.map((face) => ({
      name: face.name,
      printedName: face.printed_name,
      manaCost: face.mana_cost,
      typeLine: face.type_line ?? card.type_line,
      printedTypeLine: face.printed_type_line,
      oracleText: face.oracle_text,
      printedText: face.printed_text,
      imageUrl: face.image_uris?.normal ?? card.image_uris?.normal,
      power: face.power,
      toughness: face.toughness,
      loyalty: face.loyalty,
    }));
  } else {
    faces = [
      {
        name: card.name,
        printedName: card.printed_name,
        manaCost: card.mana_cost,
        typeLine: card.type_line,
        printedTypeLine: card.printed_type_line,
        oracleText: card.oracle_text,
        printedText: card.printed_text,
        imageUrl: card.image_uris?.normal,
        power: card.power,
        toughness: card.toughness,
        loyalty: card.loyalty,
      },
    ];
  }

  return {
    scryfallId: card.id,
    oracleId: card.oracle_id ?? card.id,
    name: card.name,
    printedName: card.printed_name,
    lang: card.lang === 'ja' ? 'ja' : 'en',
    layout: card.layout,
    cmc: card.cmc,
    colorIdentity: card.color_identity ?? [],
    typeLine: card.type_line,
    edhrecRank: card.edhrec_rank,
    keywords: card.keywords,
    producedMana,
    faces,
  };
}

/**
 * Apply a Japanese print's display fields (printed names, ja images/text) onto
 * an existing CardDef that was resolved via its English print.
 */
function applyJapanesePrint(base: CardDef, jaCard: ScryfallCard): CardDef {
  const jaDef = mapScryfallCardToCardDef(jaCard);
  const faces: CardFace[] = base.faces.map((face, index) => {
    const jaFace = jaDef.faces[index];
    if (!jaFace) {
      return face;
    }
    return {
      ...face,
      printedName: jaFace.printedName ?? face.printedName,
      printedTypeLine: jaFace.printedTypeLine ?? face.printedTypeLine,
      printedText: jaFace.printedText ?? face.printedText,
      imageUrl: jaFace.imageUrl ?? face.imageUrl,
    };
  });

  return {
    ...base,
    printedName: jaDef.printedName ?? base.printedName,
    lang: 'ja',
    faces,
  };
}

/**
 * Returns the front-face name of a double-faced card's full name
 * (e.g. "Fable of the Mirror-Breaker // Reflection of Kiki-Jiki" ->
 * "Fable of the Mirror-Breaker"), or the name unchanged if it has no "//".
 */
function frontFaceName(name: string): string {
  return name.split(' // ')[0];
}

/**
 * Resolve a batch of ASCII (English) card names via the /cards/collection endpoint.
 * Returns a map from the requested name to its resolved card, plus the list of
 * names that Scryfall reported as not_found.
 *
 * /cards/collection matches names case-insensitively and resolves DFCs by their
 * front face, but always returns the canonical full name in `card.name`. To keep
 * every requested name accounted for under its own lookup key, results are
 * matched back to the requested names leniently: lower-cased exact match, or
 * lower-cased match against the front face of `card.name`.
 */
async function resolveAsciiBatch(
  names: string[],
): Promise<{ found: Map<string, ScryfallCard>; notFound: string[] }> {
  const found = new Map<string, ScryfallCard>();
  const notFound: string[] = [];

  for (let offset = 0; offset < names.length; offset += COLLECTION_BATCH_SIZE) {
    const batch = names.slice(offset, offset + COLLECTION_BATCH_SIZE);
    // /cards/collection rejects full DFC names ("A // B"); it only accepts the
    // front-face name, so always request by front face. The lenient matching
    // below maps results back to the original requested names either way.
    const body = JSON.stringify({
      identifiers: batch.map((name) => ({ name: frontFaceName(name) })),
    });

    if (offset > 0) {
      await sleep(REQUEST_INTERVAL_MS);
    }

    const response = await fetchWithRetry(`${SCRYFALL_API_BASE}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok) {
      // Treat the whole batch as not found if the request itself failed.
      notFound.push(...batch);
      continue;
    }

    const json: unknown = await response.json();
    if (isScryfallError(json)) {
      notFound.push(...batch);
      continue;
    }

    const list = json as ScryfallList<ScryfallCard>;

    // Build a lookup from lower-cased candidate names (full name and, for DFCs,
    // the front face) to the returned card.
    const cardsByLowerName = new Map<string, ScryfallCard>();
    for (const card of list.data) {
      cardsByLowerName.set(card.name.toLowerCase(), card);
      const front = frontFaceName(card.name);
      if (front !== card.name) {
        cardsByLowerName.set(front.toLowerCase(), card);
      }
    }

    const reportedNotFound = new Set(
      (list.not_found ?? []).map((item) => item.name).filter((name): name is string => !!name),
    );

    // Match each requested name in this batch against the returned cards, so
    // every entry ends up either found (under its own lookup key) or not_found,
    // even if Scryfall's `not_found` list omits it.
    for (const requestedName of batch) {
      const card = cardsByLowerName.get(requestedName.toLowerCase());
      if (card) {
        found.set(requestedName, card);
        continue;
      }
      notFound.push(requestedName);
      reportedNotFound.delete(requestedName);
    }

    // Any remaining names Scryfall explicitly reported as not_found that don't
    // correspond to one of our requested names (shouldn't normally happen, but
    // keep them so nothing silently disappears).
    for (const name of reportedNotFound) {
      notFound.push(name);
    }
  }

  return { found, notFound };
}

/**
 * Resolve a single Japanese card name via /cards/search using an exact-name
 * lookup. `printed_name:` is not a valid Scryfall search keyword (it is
 * silently ignored, matching ~30k cards), so we use the `!"<name>"`
 * exact-name operator instead, scoped to Japanese prints with `lang:ja`.
 * Returns undefined if no match was found.
 */
async function resolveJapaneseName(name: string): Promise<ScryfallCard | undefined> {
  const query = `lang:ja !"${name}"`;
  const url = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(query)}`;

  const response = await fetchWithRetry(url);
  if (!response.ok) {
    return undefined;
  }

  const json: unknown = await response.json();
  if (isScryfallError(json)) {
    return undefined;
  }

  const list = json as ScryfallList<ScryfallCard>;
  if (list.data.length === 0) {
    return undefined;
  }

  const exactMatch = list.data.find((card) => card.printed_name === name);
  return exactMatch ?? list.data[0];
}

/**
 * Fetch Japanese prints for a set of oracle ids in batches, preserving DFC face
 * data so the display layer can swap in printed names, text, and images.
 */
async function fetchJapanesePrintsByOracleIds(
  oracleIds: string[],
): Promise<Map<string, ScryfallCard>> {
  const japanesePrints = new Map<string, ScryfallCard>();
  const uniqueOracleIds = [...new Set(oracleIds)];
  let hasFetchedPage = false;

  for (
    let offset = 0;
    offset < uniqueOracleIds.length;
    offset += JAPANESE_PRINT_BATCH_SIZE
  ) {
    const batch = uniqueOracleIds.slice(offset, offset + JAPANESE_PRINT_BATCH_SIZE);
    const query = `lang:ja (${batch.map((oracleId) => `oracleid:${oracleId}`).join(' or ')})`;
    let nextPageUrl: string | undefined = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(query)}&unique=cards`;

    while (nextPageUrl) {
      if (hasFetchedPage) {
        await sleep(REQUEST_INTERVAL_MS);
      }
      hasFetchedPage = true;

      const response = await fetchWithRetry(nextPageUrl);
      if (response.status === 404) {
        break;
      }
      if (!response.ok) {
        throw new Error(`failed to fetch Japanese prints: ${response.status}`);
      }

      const json: unknown = await response.json();
      if (isScryfallError(json)) {
        if (json.status === 404) {
          break;
        }
        throw new Error(json.details);
      }

      const list = json as ScryfallList<ScryfallCard>;
      for (const card of list.data) {
        if (card.oracle_id) {
          japanesePrints.set(card.oracle_id, card);
        }
      }

      nextPageUrl = list.has_more && list.next_page ? list.next_page : undefined;
    }
  }

  return japanesePrints;
}

interface PendingEntry {
  entry: DeckEntry;
  lookupKey: string;
}

/**
 * Resolve deck entries against the Scryfall API, using the IndexedDB cache to
 * avoid redundant network requests. On total network failure, anything not
 * already cached is reported as unresolved with reason 'network error'.
 */
export async function resolveDeck(
  entries: DeckEntry[],
  onProgress?: (p: ResolveProgress) => void,
): Promise<ResolveResult> {
  const resolved = new Map<string, CardDef>();
  const unresolved: { name: string; line: number; reason: string }[] = [];

  const total = entries.length;
  let done = 0;
  const reportProgress = (): void => {
    onProgress?.({ done, total });
  };
  reportProgress();

  // De-duplicate by lookup name, but keep all entries so every line gets a result.
  const pending: PendingEntry[] = entries.map((entry) => ({
    entry,
    lookupKey: entry.name.trim(),
  }));

  const stillNeeded = new Map<string, DeckEntry[]>();
  for (const { entry, lookupKey } of pending) {
    // Check cache first.
    const cached = await getCachedByName(lookupKey);
    if (cached) {
      resolved.set(lookupKey, cached);
      done += 1;
      reportProgress();
      continue;
    }
    const list = stillNeeded.get(lookupKey);
    if (list) {
      list.push(entry);
    } else {
      stillNeeded.set(lookupKey, [entry]);
    }
  }

  if (stillNeeded.size === 0) {
    return { resolved, unresolved };
  }

  const namesToResolve = [...stillNeeded.keys()];
  const asciiNames = namesToResolve.filter((name) => isAscii(name));
  const nonAsciiNames = namesToResolve.filter((name) => !isAscii(name));

  let networkFailure = false;

  // --- ASCII names: batch resolve via /cards/collection ---
  if (asciiNames.length > 0) {
    try {
      const { found, notFound } = await resolveAsciiBatch(asciiNames);
      const resolvedAsciiCards = new Map<string, CardDef>();
      const japaneseOracleIds: string[] = [];

      for (const [lookupKey, card] of found) {
        const cardDef = mapScryfallCardToCardDef(card);
        resolvedAsciiCards.set(lookupKey, cardDef);
        if (cardDef.lang !== 'ja' && card.oracle_id) {
          japaneseOracleIds.push(card.oracle_id);
        }
      }

      let japanesePrints = new Map<string, ScryfallCard>();
      if (japaneseOracleIds.length > 0) {
        await sleep(REQUEST_INTERVAL_MS);
        try {
          japanesePrints = await fetchJapanesePrintsByOracleIds(japaneseOracleIds);
        } catch {
          // Non-fatal: keep the English prints if the batch ja lookup fails.
        }
      }

      for (const [lookupKey, baseCardDef] of resolvedAsciiCards) {
        const jaCard = japanesePrints.get(baseCardDef.oracleId);
        const cardDef = jaCard ? applyJapanesePrint(baseCardDef, jaCard) : baseCardDef;

        await putCardDef(lookupKey, cardDef);
        resolved.set(lookupKey, cardDef);
        const entriesForName = stillNeeded.get(lookupKey) ?? [];
        done += entriesForName.length;
        reportProgress();
      }

      for (const name of notFound) {
        const entriesForName = stillNeeded.get(name) ?? [];
        for (const entry of entriesForName) {
          unresolved.push({ name, line: entry.line, reason: 'not_found' });
        }
        done += entriesForName.length;
        reportProgress();
      }
    } catch {
      networkFailure = true;
      for (const name of asciiNames) {
        const entriesForName = stillNeeded.get(name) ?? [];
        for (const entry of entriesForName) {
          unresolved.push({ name, line: entry.line, reason: 'network error' });
        }
        done += entriesForName.length;
        reportProgress();
      }
    }
  }

  // --- Non-ASCII (Japanese) names: resolve individually via /cards/search ---
  for (const name of nonAsciiNames) {
    const entriesForName = stillNeeded.get(name) ?? [];

    if (networkFailure) {
      for (const entry of entriesForName) {
        unresolved.push({ name, line: entry.line, reason: 'network error' });
      }
      done += entriesForName.length;
      reportProgress();
      continue;
    }

    try {
      await sleep(REQUEST_INTERVAL_MS);
      const card = await resolveJapaneseName(name);
      if (!card) {
        for (const entry of entriesForName) {
          unresolved.push({ name, line: entry.line, reason: 'not_found' });
        }
        done += entriesForName.length;
        reportProgress();
        continue;
      }

      const cardDef = mapScryfallCardToCardDef(card);
      await putCardDef(name, cardDef);
      resolved.set(name, cardDef);
      done += entriesForName.length;
      reportProgress();
    } catch {
      for (const entry of entriesForName) {
        unresolved.push({ name, line: entry.line, reason: 'network error' });
      }
      done += entriesForName.length;
      reportProgress();
    }
  }

  return { resolved, unresolved };
}
