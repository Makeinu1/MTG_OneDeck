# O4P-07C final frozen candidate cold-audit brief

## Authority and separation

- Milestone: `O4P-07C`.
- Declared base: `6899fd4a9e1adba71651d883174647970f7a5d59`.
- Contract: `research/cr-grounding/o4p-07c-fixed-runtime-removal-production-release.contract.draft.md`.
- Acceptance: `research/cr-grounding/o4p-07c-acceptance-brief.draft.md`.
- Auditor is read-only and must not edit, commit, push, deploy, run the full
  `npm run check`, or perform live browser/Worker operations.
- Treat repository state and executable tests as authority. Do not trust prior
  audit conclusions or implementer claims.

## Frozen candidate

Recompute both SHA-256 values before auditing:

- semantic candidate fingerprint, excluding this brief, the historical audit
  brief, and the derived archive audit record:
  `250986253e6a3f6cde99ef25ef46df323676f22767ab8e7922df892e6059f587`;
- complete staged candidate fingerprint supplied in the handoff separately.

The semantic candidate is limited to these paths:

- `package.json`;
- `research/cr-grounding/o4p-07c-acceptance-brief.draft.md`;
- `research/cr-grounding/o4p-07c-fixed-runtime-removal-production-release.contract.draft.md`;
- `research/cr-grounding/o4p-07c-implementation-brief.draft.md`;
- `scripts/__tests__/machine-checks.test.mjs`;
- `scripts/__tests__/verify-o4p-07c-production-runtime.test.mjs`;
- `scripts/checks/machine-checks.mjs`;
- `scripts/checks/tsconfig.json`;
- `scripts/checks/verify-o4p-07c-production-runtime.ts`;
- `src/online/cloudflare/__tests__/lobbyRuntimeV1.test.ts`;
- `src/online/cloudflare/__tests__/review.o4p-06c-browser-safe-lobby.test.ts`;
- `src/online/cloudflare/index.ts`;
- `src/online/cloudflare/runtime.ts`;
- `src/online/lobby/__tests__/tableStartV1.test.ts`;
- `src/online/lobby/fixtures/fixedStartV1.ts`;
- `src/online/lobby/index.ts`;
- `src/online/publicApp/index.ts`;
- `src/online/publicApp/publicAppClientV1.test.ts`;
- `src/test/architecture/review.o4p-06e-public-online-app-boundary.test.ts`;
- `src/test/architecture/review.o4p-07c-fixed-runtime-removal.test.ts`.

The two audit briefs are Judge metadata outside the semantic fingerprint. The
derived archive record is also Judge metadata outside that fingerprint. The
complete staged fingerprint must nevertheless include all three.

## Audit questions

1. Does every valid legacy v1 deck/ready/start/start-with-table mutation against
   an existing forming lobby return the exact secret-free 426 upgrade response
   without state, Scryfall, or authority mutation, while malformed,
   wrong-version, extra-key, and post-start requests remain generic?
2. Are fixed catalog/bootstrap functions unreachable from the Pages and Worker
   production graphs while v1 create/claim and all v2 paths remain functional?
3. Does the production verifier fail closed for every emitted import form,
   unresolved or ambiguous path, symlink/output escape, and every real HTML
   `script` element? In particular, independently probe coexistence of a valid
   module with external classic, inline classic, inline module, `nomodule`,
   whitespace-obfuscated absolute/protocol-relative URLs, hostile `base`,
   `noscript`, comments, templates, inert data scripts, and missing artifacts.
4. Does the verifier scan the actual referenced Pages JavaScript plus the
   explicit Worker dry-run bundle for fixed-catalog and legacy-success markers,
   and is it mandatory after the single canonical build?
5. Are the historical review changes narrow supersession repairs without
   weakening privacy, table authority, restart/reconnect/replay, duplicate-deck
   identity, dynamic genesis, Solo, or post-start mutation boundaries?
6. Are fixed fixture bytes identical to base, dependencies/lock/config
   unchanged, and candidate paths exactly bounded?

## Frozen local evidence (not a release claim)

- verifier/machine/O4P-07C review: 3 files / 20 tests passed;
- affected verifier ESLint passed;
- canonical Pages build passed: 327 modules,
  `dist/assets/index-DfRb-Q8R.js`, `dist/assets/index-DB7TO263.css`;
- artifact verifier passed `graph=324 pages-js=1 worker=deferred`;
- `git diff --check` and cached diff checks passed;
- full check, exact-head CI, live deployment, and final multi-browser production
  acceptance are not complete and must not be claimed.

Return findings by BLOCKER/HIGH/MEDIUM/LOW with exact paths/lines and both
recomputed fingerprints. Return
`O4P-07C-AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero.

## Reaudit delta after formal rejection

The first audit of this brief returned BLOCKER 0 / HIGH 5 / MEDIUM 1. Reaudit
the complete candidate, with focused probes for:

- `../` imports outside the repository and imports through parent symlinks;
- a symlinked Pages root or nested artifact path;
- exact extensionless file plus typed-module ambiguity, while a same-base CSS
  sibling alone does not falsely reject a single module candidate;
- `/evil/assets`, encoded/normalized/query/hash paths, and unquoted `src`;
- oversized legacy deck text, configured-capability fragments in deck IDs,
  table participant/capability collision and fragment cases;
- active, finished, and already-started state remaining generic before the 426
  boundary.

Repair evidence supplied for verification: 9 targeted files / 59 tests,
affected ESLint, canonical Pages build, both diff checks, and artifact verifier
all passed. This is not full-check or release evidence.

## Final Judge-surgery reaudit delta

Before final approval, independently recompute the new fingerprints and verify
the complete candidate plus these last reproduced boundaries:

- protocol Room lifecycle `started`, `active`, and `finished`, plus a started
  compatibility lobby, never reach the 426 cutoff;
- slash-rooted and scheme-qualified imports reject while bare package imports
  and legitimate relative imports preserve the 324-file graph;
- `import.meta.glob`/element loader calls reject while `import.meta.env` reads
  remain valid;
- Worker, SharedWorker, service-worker registration, `importScripts`, and
  worklet `addModule` reject through direct, property, and static computed
  forms;
- plain non-code asset `new URL` remains outside this verifier's code-loader
  scope and must not create a false positive.

Final local evidence: preserved 9 files / 60 tests and focused 4 files / 28
tests passed; affected ESLint, canonical Pages build, both diff checks, and
artifact verifier passed. Full check and release evidence remain unrun.
