import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  ResearchInteraction,
  ResearchTaskReport,
  UiResearchSession,
  UxCoverageEntry,
} from './types';

const DB_NAME = 'mtg-onedeck-ux-research';
const SESSION_STORE = 'sessions';
const COVERAGE_STORE = 'coverage';
const INTERACTION_STORE = 'interactions';
const REPORT_STORE = 'reports';

interface StoredResearchInteraction {
  sessionId: string;
  interaction: ResearchInteraction;
}

interface UxResearchSchema extends DBSchema {
  [SESSION_STORE]: {
    key: string;
    value: UiResearchSession;
  };
  [COVERAGE_STORE]: {
    key: string;
    value: UxCoverageEntry;
  };
  [INTERACTION_STORE]: {
    key: string;
    value: StoredResearchInteraction;
    indexes: { 'by-session': string };
  };
  [REPORT_STORE]: {
    key: string;
    value: ResearchTaskReport;
    indexes: { 'by-session': string };
  };
}

let dbPromise: Promise<IDBPDatabase<UxResearchSchema>> | undefined;

function getDb(): Promise<IDBPDatabase<UxResearchSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<UxResearchSchema>(DB_NAME, 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          db.createObjectStore(SESSION_STORE);
        }
        if (!db.objectStoreNames.contains(COVERAGE_STORE)) {
          db.createObjectStore(COVERAGE_STORE);
        }
        if (!db.objectStoreNames.contains(INTERACTION_STORE)) {
          const store = db.createObjectStore(INTERACTION_STORE);
          store.createIndex('by-session', 'sessionId');
        }
        if (!db.objectStoreNames.contains(REPORT_STORE)) {
          const store = db.createObjectStore(REPORT_STORE);
          store.createIndex('by-session', 'sessionId');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveResearchSession(session: UiResearchSession): Promise<void> {
  const db = await getDb();
  await db.put(SESSION_STORE, { ...session, interactions: [] }, session.sessionId);
}

export async function appendResearchInteraction(
  sessionId: string,
  interaction: ResearchInteraction,
): Promise<void> {
  const db = await getDb();
  const key = `${sessionId}:${interaction.elapsedMs.toString().padStart(12, '0')}:${interaction.id}`;
  await db.put(INTERACTION_STORE, { sessionId, interaction }, key);
}

async function listResearchInteractions(sessionId: string): Promise<ResearchInteraction[]> {
  const db = await getDb();
  const stored = await db.getAllFromIndex(INTERACTION_STORE, 'by-session', sessionId);
  return stored.map((item) => item.interaction).sort((a, b) => a.elapsedMs - b.elapsedMs);
}

export async function loadResearchSession(sessionId: string): Promise<UiResearchSession | null> {
  const db = await getDb();
  const session = await db.get(SESSION_STORE, sessionId);
  if (!session) return null;
  return { ...session, interactions: await listResearchInteractions(sessionId) };
}

export async function listResearchSessions(): Promise<UiResearchSession[]> {
  const db = await getDb();
  const sessions = await db.getAll(SESSION_STORE);
  const hydrated = await Promise.all(
    sessions.map(async (session) => ({
      ...session,
      interactions: await listResearchInteractions(session.sessionId),
    })),
  );
  return hydrated.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export async function loadResearchCheckpoint(sessionId: string, checkpointId: string) {
  const session = await loadResearchSession(sessionId);
  return session?.checkpoints.find((checkpoint) => checkpoint.id === checkpointId) ?? null;
}

export async function saveCoverageEntry(entry: UxCoverageEntry): Promise<void> {
  const db = await getDb();
  await db.put(COVERAGE_STORE, entry, entry.key);
}

export async function listCoverageEntries(): Promise<UxCoverageEntry[]> {
  const db = await getDb();
  return db.getAll(COVERAGE_STORE);
}

export async function saveResearchTaskReport(report: ResearchTaskReport): Promise<void> {
  const db = await getDb();
  await db.put(REPORT_STORE, report, report.reportId);
}

export async function listResearchTaskReports(): Promise<ResearchTaskReport[]> {
  const db = await getDb();
  const reports = await db.getAll(REPORT_STORE);
  return reports.sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export async function resetUxResearchStorageForTests(): Promise<void> {
  const db = await getDb();
  await db.clear(SESSION_STORE);
  await db.clear(COVERAGE_STORE);
  await db.clear(INTERACTION_STORE);
  await db.clear(REPORT_STORE);
}
