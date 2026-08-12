# O4P-02A cold audit brief

Role: independent cold auditor. Read-only. Do not edit any file and do not
perform git writes.

Milestone: O4P-02A Solo/Core Compatibility

Base SHA: `e1a71beac93f4882827bd8138990360840363a29`

Frozen authority:

- `research/cr-grounding/o4p-02a-solo-core-compatibility.contract.draft.md`
- `research/cr-grounding/o4p-02a-acceptance-brief.draft.md`
- shipped O4P-01N contract, source, tests, fixture, and verifier
- existing Solo `GameState`, `GameCommand`, store, snapshot, and preservation
  tests

Grounding evidence:

- `research/cr-grounding/o4p-02a-solo-core-compatibility-grounding.draft.md`

Candidate implementation and ordinary evidence:

- `src/engine/compatibility/soloCoreCompatibilityV1.ts`
- `src/engine/compatibility/soloCoreParityV1.ts`
- `src/engine/compatibility/index.ts`
- `src/engine/compatibility/__tests__/soloCoreCompatibilityV1.test.ts`
- `src/engine/compatibility/__tests__/soloCoreParityV1.test.ts`
- additive public export of `isCoreBaseId` in `src/engine/core/index.ts`

Judge integration and acceptance evidence:

- `src/engine/compatibility/__tests__/review.o4p-02a-solo-core-compatibility.test.ts`
- `src/test/architecture/review.o4p-02a-solo-core-compatibility-boundary.test.ts`
- `src/engine/compatibility/fixtures/o4p-02a-solo-core-compatibility-v1.json`
- `scripts/checks/verify-solo-core-compatibility.ts`
- `package.json`
- `scripts/checks/machine-checks.mjs`
- `scripts/__tests__/machine-checks.test.mjs`
- `scripts/checks/tsconfig.json`

## Required audit

Independently inspect the frozen candidate against every contract and
acceptance clause. At minimum, attempt to falsify:

1. one transition authority per session and a purely observational adapter;
2. the exact 20-entry closed capability catalog, including honest lossy,
   Solo-only, Core-only, unsupported, and DEFER boundaries;
3. identity-map exact records, dense arrays, bijection, public Core ID
   validation, stale references, complete deterministic issues, and no input
   mutation/sorting/deduplication;
4. deliberately distinct Solo/Core player, physical-card, and object IDs;
5. exact active-player, turn-position, ordered-zone, Commander identity/cast,
   and multiplayer combat projection without hidden state copies;
6. array-order preservation and comparator coverage of every comparable field;
7. trap-safe revoked proxy, accessor, sparse/extra array, symbol, descriptor,
   and hostile object behavior with fresh deeply frozen evidence;
8. no reducer, journal replay, store, IndexedDB, App, React, Zustand, Online,
   Room, protocol, projection, network, Cloudflare, WebSocket, Node runtime,
   ambient randomness, clock, or timer dependency in production compatibility
   source;
9. no compatibility re-export from the Core barrel and no production route
   through the adapter;
10. exact Solo `SNAPSHOT_VERSION = 1`, schema/value behavior, restore/history,
    legacy backfill, multiplayer restore, development-fixture isolation, and
    no Core replay storage in the Solo snapshot;
11. the verifier's independent Solo `shuffle` versus Core recorded
    `random-zone-order` transition, including initial/final projection parity;
12. judge review, architecture tests, fixture, verifier, and machine-check
    registration are non-vacuous and do not merely restate self-authored
    constants.

The first cold audit found and the Sol judge repaired two HIGH findings. The
replacement candidate must additionally prove:

- every Core combat attacking/defending/controller player and every
  attacker/blocker/attacked object is present in the identity map, with exact
  deterministic combat issue paths when omitted;
- `verify-solo-core-compatibility.ts` is included in the existing checks
  TypeScript project and passes direct ESLint, rather than being skipped by a
  broad lint invocation.

Pay special attention to the repaired defects:

- Core IDs must be looked up through Core-key indexes even when Solo strings
  differ;
- projection must collect all safely inspectable issues before rejecting;
- hostile comparator input must never be returned by reference;
- compatibility production source must import `isCoreBaseId` only from the
  public Core barrel.

The publication re-audit found and the bounded repair must now close three
additional findings:

- object mappings must agree with the physical-card map in both the Solo and
  Core dimensions; a Solo object derived from one physical card may not map to
  a Core object derived from another;
- trap-prone `cards` inspection must not suppress independent active-player or
  turn issues;
- both the compatibility verifier and closure verifier must pass
  `npx tsc -p scripts/checks/tsconfig.json --noEmit` after type-only repairs.

## Targeted evidence already produced

- implementation + judge compatibility tests: 3 files, 35 tests PASS;
- architecture + affected Solo snapshot tests: 6 files, 25 tests PASS;
- O4P-01N closure + compatibility/Core tests: 5 files, 41 tests PASS;
- machine-check/architecture registration tests: 2 files, 10 tests PASS;
- `verify:solo-core-compatibility`: PASS with distinct identities, initial
  parity, independent recorded-shuffle differential parity, snapshot version
  1, offline execution, and deep freeze;
- `verify:mode-neutral-core-closure`: PASS;
- `npm run lint`: PASS;
- `npm run build`: PASS, existing chunk-size warning only;
- `npx tsc -p scripts/checks/tsconfig.json --noEmit`: PASS;
- `git diff --check`: PASS.

The release full `npm run check` has intentionally not been run on this
candidate. It is allowed only after cold audit clears BLOCKER/HIGH on the
frozen fingerprint.

## Return format

- Candidate fingerprint observed from `node scripts/checks/fingerprint.mjs`.
- Findings sorted by BLOCKER, HIGH, MEDIUM, LOW.
- For each finding: stable ID, exact path/line or symbol, violated clause,
  reproduction/evidence, impact, and smallest safe correction.
- Explicit totals for every severity.
- Explicit verdict: `AUDIT-CLEAR` only when BLOCKER/HIGH are zero; otherwise
  `AUDIT-FIX-REQUIRED`.
- Commands actually run and exact outcomes.

Do not modify source, tests, fixtures, verifier, contract, ledger, docs,
manifest, git state, or candidate fingerprint. A timeout or incomplete read is
no verdict.
