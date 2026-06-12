import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CardDef } from '../types/card';

// Bump this when the stored CardDef shape changes in a backwards-incompatible way.
// v2: single-faced cards now carry manaCost/oracleText on faces[0]; v1 entries
// lack them and must be discarded.
export const CACHE_SCHEMA_VERSION = 2;

const DB_NAME = 'mtg-onedeck-cache';
const NAME_STORE = 'cardsByName';
const ORACLE_STORE = 'cardsByOracleId';

interface CardCacheSchema extends DBSchema {
  [NAME_STORE]: {
    key: string; // normalized name (lower-case, trimmed)
    value: CardDef;
  };
  [ORACLE_STORE]: {
    key: string; // oracleId
    value: CardDef;
  };
}

/**
 * Normalize a card name for use as a cache key: lower-case and trim.
 */
export function normalizeCacheKey(name: string): string {
  return name.trim().toLowerCase();
}

let dbPromise: Promise<IDBPDatabase<CardCacheSchema>> | undefined;

function getDb(): Promise<IDBPDatabase<CardCacheSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<CardCacheSchema>(DB_NAME, CACHE_SCHEMA_VERSION, {
      upgrade(db, oldVersion) {
        // Schema change: drop stale stores so old-shaped CardDefs are discarded.
        if (oldVersion > 0 && oldVersion < CACHE_SCHEMA_VERSION) {
          if (db.objectStoreNames.contains(NAME_STORE)) {
            db.deleteObjectStore(NAME_STORE);
          }
          if (db.objectStoreNames.contains(ORACLE_STORE)) {
            db.deleteObjectStore(ORACLE_STORE);
          }
        }
        if (!db.objectStoreNames.contains(NAME_STORE)) {
          db.createObjectStore(NAME_STORE);
        }
        if (!db.objectStoreNames.contains(ORACLE_STORE)) {
          db.createObjectStore(ORACLE_STORE);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Look up a cached CardDef by its normalized display name.
 */
export async function getCachedByName(name: string): Promise<CardDef | undefined> {
  const db = await getDb();
  return db.get(NAME_STORE, normalizeCacheKey(name));
}

/**
 * Look up a cached CardDef by its Scryfall oracle id.
 */
export async function getCachedByOracleId(oracleId: string): Promise<CardDef | undefined> {
  const db = await getDb();
  return db.get(ORACLE_STORE, oracleId);
}

/**
 * Store a resolved CardDef under both its lookup name (as used by the deck list)
 * and its oracle id, so future lookups by either key are cache hits.
 */
export async function putCardDef(lookupName: string, card: CardDef): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([NAME_STORE, ORACLE_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(NAME_STORE).put(card, normalizeCacheKey(lookupName)),
    tx.objectStore(ORACLE_STORE).put(card, card.oracleId),
    tx.done,
  ]);
}

/**
 * Clear all cached entries. Intended for tests / manual cache resets.
 */
export async function clearCache(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([NAME_STORE, ORACLE_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(NAME_STORE).clear(),
    tx.objectStore(ORACLE_STORE).clear(),
    tx.done,
  ]);
}
