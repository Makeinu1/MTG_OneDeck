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

The second and governance-capped final full check subsequently found one stale
judge-owned architecture expectation. Audit the exact repair in
`src/test/architecture/modeNeutralCoreBoundary.test.ts`:

- only `src/engine/compatibility/soloCoreCompatibilityV1.ts` may consume the
  public `src/engine/core/index.ts` barrel;
- direct Core submodules and any unreviewed compatibility source must remain
  rejected;
- only the exact Solo/Core verifier path is added to the closed verification
  script allowlist;
- no product-layer, reverse-import, runtime-dependency, unresolved-import, or
  existing-type protection may be weakened.

The first post-full-check focused audit confirmed that architecture repair but
found two implementation HIGHs. Audit the bounded Sol judge repair without
assuming either claim is closed:

- every Solo combat attacker/blocker stored `objectId` must equal the current
  `objectIdOf(card)` incarnation; stale values reject at the exact attacker or
  blocker `/objectId` path and may not be reconstructed from `cardId` alone;
- a hostile nested combat, zone, or commander container must not escape to the
  outer projection catch and erase independently inspectable active-player,
  turn, or sibling-domain issues;
- rejected evidence remains deterministic, complete for safely inspectable
  fields, fresh, deeply frozen, non-mutating, and never exposes a partial view;
- the repair must remain confined to the compatibility adapter and ordinary
  compatibility tests and must not alter Solo runtime or Core authority.

The replacement audit verified those exact repairs but found additional open
claims. Any user-authorized fresh repair cycle must also prove:

- hostile `zones`, `zonesByPlayer`, and `turnOrder` preflight inspection cannot
  return early or throw in a way that suppresses safely inspectable sibling
  issues;
- `combat.turn` is a positive safe integer equal to the enclosing Solo turn,
  otherwise rejection occurs at `/combat/turn` without defaulting to zero;
- invalid identity-map array elements retain their original diagnostic index
  instead of being compacted before entry validation;
- sparse or extra-property Solo zone arrays reject rather than silently
  normalizing to a dense projection.

The user authorized one fresh Luna repair cycle. Independently falsify the
resulting R1-R4 implementation rather than relying on its ordinary tests:

- combine hostile preflight fields with independently malformed combat,
  commander, phase, active-player, and turn values;
- probe each strict source-array family with sparse, extra key, symbol,
  accessor, non-enumerable entry, descriptor trap, revoked proxy, and
  non-ordinary prototype variants;
- verify original diagnostic indices after invalid entries away from index 0;
- verify combat turn string, zero, negative, unsafe, fractional, and mismatch
  values reject exactly and cannot produce a partial combat view;
- verify repeated evidence is fresh, deterministic, deeply frozen, complete
  for safely inspectable fields, and non-mutating.

The default O4P-01N closure run currently times out one deterministic replay
case at 5 seconds, while the identical file passes 10/10 with only CLI
`--testTimeout=20000`. No closure source/test changed. Independently inspect
imports and timings to classify O4P-02A regression versus environment noise.
Do not edit the shipped O4P-01N test or count the extended-timeout result as a
release full check.

## Targeted evidence already produced

- implementation + judge compatibility tests: 3 files, 60 tests PASS;
- architecture boundary tests: 2 files, 11 tests PASS;
- affected Solo snapshot/preservation tests: 5 files, 22 tests PASS;
- O4P-01N closure + compatibility/Core tests: 5 files, 41 tests PASS;
- machine-check/architecture registration tests: 2 files, 10 tests PASS;
- `verify:solo-core-compatibility`: PASS with distinct identities, initial
  parity, independent recorded-shuffle differential parity, snapshot version
  1, offline execution, and deep freeze;
- `verify:mode-neutral-core-closure`: PASS;
- `npm run lint`: PASS;
- `npm run build`: PASS, existing chunk-size warning only;
- `npx tsc -p scripts/checks/tsconfig.json --noEmit`: PASS;
- `npm run build`: PASS, existing chunk-size warning only;
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

## Fresh-cycle audit result requiring repair return 2

Fresh Luna auditor `019ff46b-3771-7f23-a4ad-e115ff8f678b` matched fingerprint
`9ea31b5c7d0aea5cc7e7ccd34fb798c0b7a0d680f96484683f08e273f0f80737`,
changed no files, and returned `AUDIT-FIX-REQUIRED`: BLOCKER 0, HIGH 3,
MEDIUM 1.

The replacement audit after repair return 2 must independently falsify:

- proxy arrays whose `ownKeys` hides required numeric indices in every source
  array family;
- private-zone issue suppression when `turnOrder` is unreadable;
- stale attacker incarnation combined with an unsupported battle target;
- two structurally equal but semantically invalid comparable views, including
  closed literals, numeric domains, and non-empty IDs.

It must also re-run all prior fresh-cycle adversarial probes. Audit clearance
still requires BLOCKER/HIGH 0 on a newly frozen fingerprint.

Repair return 2 targeted evidence now available:

- implementation, parity, and judge compatibility tests: 3 files, 95 tests
  PASS;
- architecture boundary tests: 2 files, 11 tests PASS;
- Solo preservation: 3 files, 14 tests PASS;
- checks TypeScript project, direct four-file ESLint, repository lint, and
  build: PASS;
- both compatibility and Core-closure verifiers: PASS;
- forbidden diff scan and `git diff --check`: PASS.

Treat these as claims to falsify, not as an audit verdict.

## Bounded post-repair-return-2 correction requiring re-audit

Audit `019ff497-5a67-7e60-bc76-e62e7c42c267` matched both frozen
fingerprints, changed no files, and found BLOCKER 0, HIGH 1, MEDIUM 0, LOW 0.
It demonstrated that an unreadable attacker assignment array suppressed a
safely inspectable malformed blocker entry, with the same defect in reverse.

The bounded Sol correction removes only that cross-array early return and adds
two symmetric ordinary regressions. Independently prove that:

- trapping `combat.attackers` still yields exact attacker-container and
  aggregate combat issues while malformed readable blockers are inspected;
- trapping `combat.blockers` still yields exact blocker-container and
  aggregate combat issues while malformed readable attackers are inspected;
- both results are deterministic, complete, frozen, non-mutating, and never
  expose a partial projected view;
- all prior H-01 through H-04 probes and full compatibility surface remain
  green.

Targeted post-correction claim: 3 compatibility files, 97 tests PASS, affected
ESLint PASS, checks TypeScript project PASS, and `git diff --check` PASS.

Post-correction audit `019ff4a7-691f-7260-8f32-1a5c93a41cdf` matched both
fingerprints and returned BLOCKER 0, HIGH 1, MEDIUM 0, LOW 0. It proved that
`mapDenseArray` in `soloCoreParityV1.ts` accepts arrays with a non-standard
prototype, allowing two equal invalid views to compare as compatible. This is
an open finding and no audit clearance exists.

The user subsequently authorized one additional repair limited to
`soloCoreParityV1.ts` and its ordinary test. The replacement auditor must prove
that every parity array family rejects a non-`Array.prototype` array and that a
throwing/revoked prototype inspection fails closed with fresh, deeply frozen,
non-aliasing evidence. No public API, Core, Solo, or architecture allowance may
change. Audit clearance still requires BLOCKER/HIGH 0.

Post-repair claims to falsify: 3 compatibility files / 105 tests PASS;
architecture 2 files / 11 tests PASS; Solo preservation 3 files / 14 tests
PASS; direct parity ESLint, checks TypeScript, repository lint, build, both
verifiers, forbidden diff scan, and `git diff --check` PASS. The release full
check remains unused.

Audit `019ff4bb-f858-7690-9e25-e3ef6ef9a031` matched both fingerprints and
returned BLOCKER 0, HIGH 1, MEDIUM 0, LOW 0. The parity prototype finding is
closed. The remaining open finding is compatibility combat optionality:
missing, accessor-backed, or descriptor-trapping `combat` is silently treated
as explicit `null`. No audit clearance exists.

The user subsequently authorized one correction limited to compatibility
source/test. The replacement auditor must prove that only an explicit
enumerable data-property `combat: null` means no combat; missing, `undefined`,
accessor, non-enumerable, throwing descriptor, and revoked proxy forms reject
exactly at `/combat`, never invoke getters, retain safely inspectable sibling
issues, remain deterministic/frozen/non-mutating, and cannot produce a partial
view. No public API or authority boundary may change.

Post-repair claims to falsify: 3 compatibility files / 111 tests PASS;
architecture 2 files / 11 tests PASS; Solo preservation 3 files / 14 tests
PASS; direct compatibility ESLint, checks TypeScript, repository lint, build,
both verifiers, forbidden diff scan, and `git diff --check` PASS. The release
full check remains unused.

## Replacement audit verdict

Fresh read-only Luna auditor `019ff4ff-1b59-7f53-993a-a9af7287af4f`
matched semantic fingerprint
`302f4901b151dd53cc9f2297467de83f1cc2c003e1803684135fd68d35eea774`
and Codex-context fingerprint
`0f89a8b164bbb2e366e682f5b0b5be8a472bf087c6fc67915191f2a0b75b1ae0`
at HEAD `a9ca9aa14bee29cefd2126ac5e658f4106f4cbc8`, changed no files, and returned
`AUDIT-CLEAR`: BLOCKER 0, HIGH 0, MEDIUM 0, LOW 0.

The audited semantic candidate is frozen. O4P-02A is
`AUDIT-OK-PENDING-FULL-CHECK`; candidate publication metadata and the
user-authorized exceptional absolute-final full check remain judge-owned gates.
