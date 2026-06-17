// Provide an in-memory IndexedDB implementation for tests that exercise the
// cache layer (src/data/cache.ts uses the global indexedDB).
import 'fake-indexeddb/auto';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
