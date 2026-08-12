# O4P-02B cold audit brief

Role: independent cold auditor. Read-only. Do not edit any file and do not
perform git writes.

Milestone: `O4P-02B` Four-seat Room Envelope

Base SHA: `62fd41918590de90165fdd3b982efe0032dd6ddb`

Frozen authority:

- `research/cr-grounding/o4p-02b-four-seat-room.contract.draft.md`
- `research/cr-grounding/o4p-02b-acceptance-brief.draft.md`
- shipped O4P-01N public Core closure
- shipped O4P-02A Solo/Core compatibility boundary

Candidate implementation and ordinary evidence:

- `src/online/room/index.ts`
- `src/online/room/types.ts`
- `src/online/room/errors.ts`
- `src/online/room/validationSupport.ts`
- `src/online/room/validation.ts`
- `src/online/room/operations.ts`
- `src/online/room/__tests__/testHelpers.ts`
- `src/online/room/__tests__/roomLifecycleV1.test.ts`
- `src/online/room/__tests__/roomValidationV1.test.ts`

Judge integration and acceptance evidence:

- `src/online/room/__tests__/review.o4p-02b-four-seat-room.test.ts`
- `src/test/architecture/review.o4p-02b-four-seat-room-boundary.test.ts`
- `src/online/room/fixtures/o4p-02b-four-seat-room-v1.json`
- `scripts/checks/verify-online-four-seat-room.ts`
- `package.json`
- `scripts/checks/machine-checks.mjs`
- `scripts/__tests__/machine-checks.test.mjs`
- `scripts/checks/tsconfig.json`
- `scripts/checks/validation-domains.json`

## Required audit

Independently inspect the frozen candidate against every contract and
acceptance clause. At minimum, attempt to falsify:

1. the exact seven-field Room root, four dense ordered seats, immutable Core
   player/capability mapping, participant order, exact ID/capability grammar,
   and independent schema version;
2. host as an orthogonal authority held only by an occupying player, exactly
   one table, arbitrary spectators, globally unique participant IDs, and exact
   player-seat one-to-one relations;
3. the forming -> ready -> started -> active -> finished lifecycle and every
   cross-field invariant, including disconnect-before-start readiness reset and
   post-start frozen roster behavior;
4. exact capability claim, wrong/cross-seat/reused capability rejection,
   capability non-disclosure in issues/errors, and no ambient generation;
5. descriptor-safe, trap-safe, getter-free, exact-record, dense-array,
   non-ordinary-prototype, ownKeys, symbol, sparse, extra-key, accessor, and
   non-enumerable rejection with deterministic complete issues for safely
   inspectable siblings;
6. original diagnostic source indices after unreadable or invalid earlier
   seat/participant entries, especially relation and host diagnostics;
7. fresh deeply frozen canonical success/error evidence, no input mutation,
   and no trim/sort/deduplicate/default/merge behavior;
8. activation against one valid public Core root with exact ordered full
   lifecycle roster and all players active, without storing or mutating Core;
9. Room-only disconnect and reconciliation derived solely from accepted Core
   concession/defeat state, monotonic outcomes, cause-reversal rejection, and
   finish only at zero or one active Core players;
10. imports only through the public Core barrel and no Core reducer call,
    Solo/store/UI/protocol/projection/network/Cloudflare/WebSocket/clock/RNG
    contamination, root Online barrel, or version/dependency expansion;
11. the fixture, verifier, judge review, architecture review, machine-check
    registration, and `online-room` domain are non-vacuous and fail closed;
12. existing O4P-01N closure and O4P-02A compatibility evidence remains green.

One bounded implementer correction was made before freeze: relation and host
validation now preserve original seat source indices when an earlier entry is
unreadable instead of indexing a compacted valid-seat array. Treat the repair
and its regression as claims to falsify, not as audit evidence.

## Targeted evidence already produced

- `npm run check:domain -- online-room`: 4 files, 20 tests PASS;
- ordinary Room tests: 2 files, 14 tests PASS;
- judge review: 1 file, 4 tests PASS;
- `npm run verify:online-four-seat-room`: PASS;
- `npm run verify:mode-neutral-core-closure`: PASS;
- `npm run verify:solo-core-compatibility`: PASS;
- `npx tsc -p scripts/checks/tsconfig.json --noEmit`: PASS;
- scoped ESLint for every changed TypeScript file: PASS;
- machine-check registration test: 1 file, 7 tests PASS;
- `git diff --check`: PASS.

The release full `npm run check` has intentionally not been run on this
candidate. It is allowed only after a matching cold audit clears BLOCKER/HIGH.
`check:forbidden` reports the two judge-authored `review.*` files as FORBIDDEN
under its implementer-oriented scan and reports expected judge re-ownership
information for package/research paths. This is ownership evidence to classify,
not permission to weaken or edit the checker.

## Return format

- Candidate fingerprints observed from `node scripts/checks/fingerprint.mjs`
  and `npm run codex:context -- --domain O4P-02B`.
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

## Initial audit findings and bounded corrections requiring re-audit

The independent read-only auditor `/root/o4p_02b_cold_auditor` matched semantic
fingerprint `1dd0d287187e792c3c932d15973bdcdac629c43bced69d87e53a01d9a7b8a80c`
and Codex-context fingerprint
`44db8aba7b50dee022a3e9b25927a6361da2e746341a9ce4b053386f2359dc49`.
It returned `AUDIT-FIX-REQUIRED`: BLOCKER 0, HIGH 1, MEDIUM 1, LOW 0.

Accepted HIGH `O4P-02B-AUD-H-001` demonstrated that a configured capability
used as an unknown record/array key was echoed in the typed issue path, and
that forwarded Core validation diagnostics had no Room capability-redaction
boundary. Implementer correction return 2 changed only:

- `src/online/room/validationSupport.ts`
- `src/online/room/validation.ts`
- `src/online/room/errors.ts`
- `src/online/room/operations.ts`
- `src/online/room/__tests__/roomValidationV1.test.ts`

Independently prove that the centralized boundary removes configured
capability literals from every issue code, path, message, and containing typed
error serialization for direct validation, creation, every Room-backed
operation, and forwarded Core issues. Capability-shaped dynamic path segments
must fail closed even when a configured capability cannot first be extracted.
Redaction must remain deterministic, preserve complete safely inspectable
issues, sort after redaction, return fresh deeply frozen evidence, and not
weaken capability validation or relation/lifecycle diagnostics.

Accepted MEDIUM `O4P-02B-AUD-M-001` demonstrated that the judge-owned
architecture review accepted `../../engine/commands` and omitted `hidden.tsx`
from its source inventory. The judge correction changed only
`src/test/architecture/review.o4p-02b-four-seat-room-boundary.test.ts`:

- production inventory now includes every file outside the exact `__tests__`
  and `fixtures` evidence directories and is compared with the exact six-file
  production list, so any additional executable extension fails closed;
- static imports/exports, import-equals, dynamic imports, and `require` calls
  are checked against an exact module-specifier allowlist containing only the
  six local Room modules and `../../engine/core/index`;
- synthetic probes pin rejection of a non-public engine path, escaping local
  path, non-literal dynamic import, and external require.

Treat both corrections and all tests as claims to falsify. Re-run all initial
audit claims, with special attention to redaction aliasing/collisions,
JSON-pointer segments, hostile descriptors/proxies, operation paths that first
validate a malformed Room, Core issue forwarding, dynamic import forms, and
unexpected production extensions.

Post-correction targeted claims:

- `npm run check:domain -- online-room`: 4 files, 22 tests PASS;
- ordinary Room tests: 2 files, 15 tests PASS;
- architecture review alone: 1 file, 3 tests PASS;
- all three required offline verifiers: PASS;
- checks TypeScript project, scoped ESLint, machine-check 7/7, and
  `git diff --check`: PASS.

The release full `npm run check` remains unused on the corrected candidate.

## Re-audit findings and bounded judge surgery requiring final re-audit

The same read-only auditor matched corrected semantic fingerprint
`4b04856280642e82a3e0f37ed85792957a96f67e2253e2fbd156c7d9f9b4860e`
and Codex-context fingerprint
`7890d2734f0340720508e506b0f44acb8e94919d581288c5b83786d38be1c05e`,
but returned `AUDIT-FIX-REQUIRED`: BLOCKER 0, HIGH 1, MEDIUM 1, LOW 0.

The remaining HIGH showed that extraction-independent redaction covered only
a whole capability-shaped path segment. A capability embedded in an alias such
as `alias.<capability>` leaked when its configured seat descriptor was
unreadable; a foreign/wrong capability embedded in join, rejoin, and ready
aliases also leaked. Implementer correction returns are exhausted. The bounded
judge surgery changed only:

- `src/online/room/validationSupport.ts`
- `src/online/room/operations.ts`
- `src/online/room/__tests__/review.o4p-02b-four-seat-room.test.ts`

The centralized sorter now replaces every contiguous
`[A-Za-z0-9_-]{32,}` run in issue code, path, and message after exact known
literal replacement, covering prefixed/suffixed runs, runs beyond the maximum
capability length, and JSON-pointer aliases without prior extraction. Join,
rejoin, and ready parsing also add every safely readable capability-shaped
attempt to the mutable redaction set before any structural or semantic error.
Creation already collects readable seat and host attempts. A judge regression
pins unreadable configured descriptors, dot and pointer aliases, typed creation
errors, foreign join/rejoin/ready aliases, issue preservation, and absence from
serialization.

The remaining MEDIUM showed that `typeof import("../../engine/commands")`,
aliased `require`, and property `require` escaped the exact architecture
allowlist. The bounded judge surgery changed only
`src/test/architecture/review.o4p-02b-four-seat-room-boundary.test.ts` to:

- extract `ImportTypeNode` literal modules and fail closed on unsupported
  arguments;
- reject every non-direct `require` identifier and computed `"require"`
  property reference;
- pin synthetic probes for import-type, aliased require, property require, and
  computed require in addition to all earlier probes.

Independently attempt to falsify both surgeries. In particular probe exact and
embedded configured/foreign capabilities at lengths 32, 128, and beyond in
code/path/message, overlapping literals, repeated redaction passes, pointer
escaping, unavailable descriptors, hostile proxies, all capability-bearing
operations, and Core forwarding. Prove sorting happens after redaction and
issues are neither merged nor aliased. For architecture, probe import-type
qualifiers/options, malformed/nonliteral import types, require aliases through
destructuring/property/computed access, and unexpected executable extensions.
All initial audit claims remain in scope.

Post-surgery targeted claims:

- `npm run check:domain -- online-room`: 4 files, 23 tests PASS;
- all three required offline verifiers: PASS;
- checks TypeScript project, scoped ESLint, machine-check 7/7, and
  `git diff --check`: PASS.

The release full `npm run check` remains unused. Because the two implementer
returns and one bounded judge surgery are exhausted, any remaining
BLOCKER/HIGH is a terminal STOP under repository governance.

## First release full-check finding and focused architecture re-audit

The audit-matched release `npm run check` passed every verifier, docs check,
lint, and all 226 Core files / 2086 Core tests. The DOM lane then exposed two
stale judge-owned closed expectations and stopped before build:

- `modeNeutralCoreBoundary.test.ts` had not registered the exact O4P-02B Room
  Core consumers or verifier and reported five expected new imports;
- `o4p01iStackAnnouncementBoundary.test.ts` still permitted only the historical
  `src/online/architecture` root and reported `src/online/room` as forbidden.

The bounded judge repair changed only:

- `src/test/architecture/modeNeutralCoreBoundary.test.ts`
- `src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts`

The first file now allows exactly
`src/online/room/{operations,types,validation}.ts` to consume exactly
`src/engine/core/index.ts`, and registers exactly
`scripts/checks/verify-online-four-seat-room.ts` as a verification script.
Synthetic evidence continues rejecting a direct Core submodule from the
otherwise allowed operations file and the public Core barrel from an
unreviewed Room source. No other product runtime, Room file, Core submodule,
reverse import, existing type, runtime dependency, or unresolved import is
allowed.

The second file changes the exact top-level Online allowance from only
`architecture` to exactly `architecture` plus `room`; every other Online root
still reports `online-runtime`. The dedicated O4P-02B architecture review owns
the exact six production files and their import/content restrictions.

Focused post-full-check audit must independently prove these allowances are
exact, public-barrel-only, do not permit a Core reducer call, do not admit an
unreviewed Room consumer/verifier/Online root, and do not weaken any existing
Core-to-product, engine-to-Online, Stack, compatibility, type, runtime, or
unresolved-import protection. Re-run the two affected architecture files and
the O4P-02B architecture/domain evidence. All prior BLOCKER/HIGH-cleared claims
remain binding; the accepted constant-computed-require MEDIUM remains recorded
and is not grounds to broaden this focused repair.

Post-repair targeted claims:

- affected architecture: 2 files, 11 tests PASS;
- `npm run check:domain -- online-room`: 4 files, 23 tests PASS;
- direct ESLint on both repaired files and `git diff --check`: PASS.

The governance-authorized final `npm run check` has not yet run. It is allowed
only if this focused re-audit returns BLOCKER/HIGH 0 on the newly frozen tree.
