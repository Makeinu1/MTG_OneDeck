import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { InitDeckCard } from '../engine/init';
import type { GameState } from '../engine/types';

export interface GameSnapshot {
  version: number;
  state: GameState;
  deck: InitDeckCard[];
  autoAdvanceToMain: boolean;
}

export const SNAPSHOT_VERSION = 1;

const DB_NAME = 'mtg-onedeck-game';
const SNAPSHOT_STORE = 'snapshot';
const SNAPSHOT_KEY = 'current';

interface GameSnapshotSchema extends DBSchema {
  [SNAPSHOT_STORE]: {
    key: string;
    value: GameSnapshot;
  };
}

let dbPromise: Promise<IDBPDatabase<GameSnapshotSchema>> | undefined;

function getDb(): Promise<IDBPDatabase<GameSnapshotSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<GameSnapshotSchema>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveSnapshot(snapshot: GameSnapshot): Promise<void> {
  try {
    const db = await getDb();
    await db.put(SNAPSHOT_STORE, snapshot, SNAPSHOT_KEY);
  } catch {
    // IndexedDB unavailable or blocked - continue without persistence.
  }
}

export async function loadSnapshot(): Promise<GameSnapshot | null> {
  try {
    const db = await getDb();
    const snapshot = await db.get(SNAPSHOT_STORE, SNAPSHOT_KEY);
    if (!snapshot || snapshot.version !== SNAPSHOT_VERSION) {
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

export async function clearSnapshot(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(SNAPSHOT_STORE, SNAPSHOT_KEY);
  } catch {
    // IndexedDB unavailable or blocked - continue without persistence.
  }
}
