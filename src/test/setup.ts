// Provide an in-memory IndexedDB implementation for tests that exercise the
// cache layer (src/data/cache.ts uses the global indexedDB).
import 'fake-indexeddb/auto';
