// Supplemental Node ESM loader — NOT part of the engine or contract, purely a
// local workaround for a pre-existing environment gap (see playthrough.ts
// header note / final report "blockers" section):
//
//   node_modules/tsx-local-loader.mjs (the project's homegrown tsx shim) only
//   retries a failed relative specifier by appending file extensions
//   (.ts/.tsx/.js/.mjs/.cjs). It never retries by appending "/index.ts" for a
//   *directory* import. src/engine/status.ts contains `from './grammar'`
//   (a directory import resolving to src/engine/grammar/index.ts), which
//   Node's native ESM resolver rejects outright (ERR_UNSUPPORTED_DIR_IMPORT)
//   before tsx-local-loader even gets a chance to retry.
//
//   This is pre-existing and independent of this milestone's scripts: the
//   repo's own `npm run golden-replay` (scripts/golden-replay.ts, which
//   imports src/engine/goldenReplay.ts -> src/engine/commands.ts ->
//   src/engine/status.ts) hits the exact same crash on this Node version
//   (v24.12.0) when invoked as plain `npx tsx scripts/golden-replay.ts`.
//   It is NOT something introduced by playthrough.ts, and not something this
//   task is allowed to fix at the source (src/engine/status.ts and
//   node_modules/tsx-local-loader.mjs are both out of scope for this
//   mechanical task's write permissions).
//
// This loader adds ONLY the missing retry step (append "/index.ts" etc. to a
// failed relative specifier) and defers everything else to the next loader
// in the chain (still node_modules/tsx-local-loader.mjs, loaded alongside it
// — see the `--loader` flags in this directory's run instructions below).
//
// Usage (from repo root):
//   npx tsx --loader ./scripts/mydeck-scoring/dir-import-loader.mjs scripts/mydeck-scoring/playthrough.ts
//
// This changes no file outside scripts/mydeck-scoring/; it is only ever
// loaded when explicitly passed on the command line for this milestone's two
// scripts.

import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const INDEX_CANDIDATES = ['/index.ts', '/index.tsx', '/index.js', '/index.mjs'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!(specifier.startsWith('.') || specifier.startsWith('/'))) {
      throw error;
    }
    const baseUrl = new URL(specifier, context.parentURL ?? pathToFileURL(`${process.cwd()}/`));
    for (const candidate of INDEX_CANDIDATES) {
      const candidateUrl = new URL(`${baseUrl.pathname}${candidate}`, baseUrl);
      try {
        await access(fileURLToPath(candidateUrl));
        return { url: candidateUrl.href, shortCircuit: true };
      } catch {
        // try next candidate
      }
    }
    throw error;
  }
}
