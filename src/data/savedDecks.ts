import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { InitDeckCard } from '../engine/init';
import type { CardDef } from '../types/card';

export const SAVED_DECK_SCHEMA_VERSION = 1;

export interface SavedDeckEntry {
  card: CardDef;
  quantity: number;
  section: 'commander' | 'main';
}

export interface SavedDeck {
  schemaVersion: typeof SAVED_DECK_SCHEMA_VERSION;
  id: string;
  name: string;
  nameMode: 'auto' | 'custom';
  deckText: string;
  entries: SavedDeckEntry[];
  fingerprint: string;
  createdAt: number;
  updatedAt: number;
}

export interface SaveResolvedDeckInput {
  deckText: string;
  entries: SavedDeckEntry[];
  existingDeckId?: string;
}

export interface SaveResolvedDeckResult {
  deck: SavedDeck;
  operation: 'created' | 'updated';
}

const DB_NAME = 'mtg-onedeck-decks';
const DB_VERSION = 1;
const DECK_STORE = 'decks';
const PERSISTENCE_REQUESTED_KEY = 'mtg-onedeck:persistence-requested';

interface SavedDeckSchema extends DBSchema {
  [DECK_STORE]: {
    key: string;
    value: SavedDeck;
    indexes: {
      'by-fingerprint': string;
      'by-updated-at': number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<SavedDeckSchema>> | undefined;

function getDb(): Promise<IDBPDatabase<SavedDeckSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<SavedDeckSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DECK_STORE)) {
          const store = db.createObjectStore(DECK_STORE, { keyPath: 'id' });
          store.createIndex('by-fingerprint', 'fingerprint');
          store.createIndex('by-updated-at', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}

function displayName(card: CardDef): string {
  return card.printedName ?? card.faces[0]?.printedName ?? card.name;
}

export function buildAutoDeckName(entries: SavedDeckEntry[]): string {
  const commanders = entries
    .filter((entry) => entry.section === 'commander')
    .map((entry) => displayName(entry.card));
  return commanders.length > 0 ? commanders.join(' & ') : '名称未設定のデッキ';
}

export function createDeckFingerprint(entries: SavedDeckEntry[]): string {
  return entries
    .map((entry) => `${entry.section}:${entry.card.oracleId}:${entry.quantity}`)
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

function createDeckId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `deck-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isSavedDeck(value: SavedDeck): boolean {
  return value.schemaVersion === SAVED_DECK_SCHEMA_VERSION
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.deckText === 'string'
    && Array.isArray(value.entries);
}

export async function listSavedDecks(): Promise<SavedDeck[]> {
  const db = await getDb();
  const decks = await db.getAll(DECK_STORE);
  return decks
    .filter(isSavedDeck)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveResolvedDeck(
  input: SaveResolvedDeckInput,
): Promise<SaveResolvedDeckResult> {
  if (input.entries.length === 0) {
    throw new Error('解決済みカードがないデッキは保存できません。');
  }

  const db = await getDb();
  const fingerprint = createDeckFingerprint(input.entries);
  const existingById = input.existingDeckId
    ? await db.get(DECK_STORE, input.existingDeckId)
    : undefined;
  const existingByFingerprint = existingById
    ? undefined
    : await db.getFromIndex(DECK_STORE, 'by-fingerprint', fingerprint);
  const existing = existingById ?? existingByFingerprint;
  const now = Date.now();
  const autoName = buildAutoDeckName(input.entries);

  const deck: SavedDeck = {
    schemaVersion: SAVED_DECK_SCHEMA_VERSION,
    id: existing?.id ?? createDeckId(),
    name: existing?.nameMode === 'custom' ? existing.name : autoName,
    nameMode: existing?.nameMode ?? 'auto',
    deckText: input.deckText,
    entries: input.entries,
    fingerprint,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.put(DECK_STORE, deck);
  return { deck, operation: existing ? 'updated' : 'created' };
}

export async function renameSavedDeck(id: string, nextName: string): Promise<SavedDeck> {
  const name = nextName.trim();
  if (name.length < 1 || name.length > 60) {
    throw new RangeError('デッキ名は1〜60文字で入力してください。');
  }

  const db = await getDb();
  const existing = await db.get(DECK_STORE, id);
  if (!existing) throw new Error('デッキが見つかりません。');
  const deck: SavedDeck = {
    ...existing,
    name,
    nameMode: 'custom',
    updatedAt: Date.now(),
  };
  await db.put(DECK_STORE, deck);
  return deck;
}

export async function deleteSavedDeck(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(DECK_STORE, id);
}

/** Replace richer display data without making a deck look user-edited or newly used. */
export async function updateSavedDeckEntries(
  id: string,
  entries: SavedDeckEntry[],
): Promise<SavedDeck> {
  const db = await getDb();
  const existing = await db.get(DECK_STORE, id);
  if (!existing) throw new Error('デッキが見つかりません。');
  const deck: SavedDeck = {
    ...existing,
    entries,
    fingerprint: createDeckFingerprint(entries),
  };
  await db.put(DECK_STORE, deck);
  return deck;
}

export function expandSavedDeck(deck: Pick<SavedDeck, 'entries'>): InitDeckCard[] {
  const expanded: InitDeckCard[] = [];
  for (const entry of deck.entries) {
    for (let index = 0; index < entry.quantity; index += 1) {
      expanded.push({ def: entry.card, isCommander: entry.section === 'commander' });
    }
  }
  return expanded;
}

export function entriesFromExpandedDeck(deck: InitDeckCard[]): SavedDeckEntry[] {
  const grouped = new Map<string, SavedDeckEntry>();
  for (const entry of deck) {
    const section = entry.isCommander ? 'commander' : 'main';
    const key = `${section}:${entry.def.scryfallId}`;
    const current = grouped.get(key);
    if (current) {
      current.quantity += 1;
    } else {
      grouped.set(key, { card: entry.def, quantity: 1, section });
    }
  }
  return Array.from(grouped.values());
}

export async function requestPersistentStorageOnce(): Promise<void> {
  try {
    if (localStorage.getItem(PERSISTENCE_REQUESTED_KEY) === 'true') return;
    localStorage.setItem(PERSISTENCE_REQUESTED_KEY, 'true');
    if (typeof navigator.storage?.persist === 'function') {
      await navigator.storage.persist();
    }
  } catch {
    // Persistence is a best-effort enhancement. Deck data remains in IndexedDB.
  }
}
