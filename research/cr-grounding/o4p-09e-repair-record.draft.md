# O4P-09E local candidate repair record

Date: 2026-08-27
Base SHA: `b8f851794ce8051811093093adc8b22196f3d4c2`
Risk: R3 / BROAD

## Authority

O4P-09E has local-write authority only. Commit, push, deploy, publish, ship,
manifest reanchor, and the release full check remain false. The user-authorized
O4P-09D repair-candidate 4 authority applied to D and was exhausted by D's
shipped exact head; it is not reused for E.

## Candidate repairs

1. The high-level visibility route now rejects raw visibility-open,
   visibility-close, and delegated search-complete bypasses on both ordinary
   HTTP and WebSocket entry points. Exact retries reuse only an identical
   normalized high-level intent; command-ID reuse with changed meaning rejects
   without mutation.
2. Source-bound grants bind subject and source independently. Core prunes
   visibility against the accepted next registry, active-player set, search
   sessions, turn, and top-library prefix in the same transition. Rejected
   commands return the original root and close nothing; automatic closure
   events are emitted once.
3. Ordinary coverage now executes all duration/invalidation modes, delegated
   selector and candidate attacks, persistence failure, replay digest parity,
   and explicit 2-player plus 4-player Look/Reveal/Choose projection matrices.
4. The release-preflight secret scanner initially matched capability-shaped
   property syntax in new types and deterministic fixtures. A syntax-only
   computed-key repair removed those false positives without changing property
   names, values, assertions, runtime behavior, or public projection.
5. The production fixture retained the sole GameScreen, moved D's disabled
   handoff text to the adjacent E panel, and gave E controls a measured minimum
   44 px target.

## Local evidence before audit

- Focused candidate suite: 10 files / 82 tests passed.
- Corrected 2-player matrix: 1 file / 10 tests passed.
- Core suite: 100 files / 679 tests passed.
- Projection suite: 3 files / 42 tests passed.
- Runtime and visibility focused suite: 3 files / 30 tests passed.
- Affected ESLint, `npx tsc -b --pretty false`, and `git diff --check`: passed.
- Generated engine API: current bytes. `check:docs` stops only at the expected
  commit-dependent manifest `lastVerifiedCommit` reanchor.
- Browser evidence: `research/cr-grounding/o4p-09e-browser-evidence.draft.md`.
- Read-only production probe: no concrete BLOCKER/HIGH finding.

The Judge must freeze a new exact fingerprint after this record, rerun release
preflight, and obtain an independent cold audit. No commit or external write is
authorized by this record.

## Cold-audit correction 1

Initial audit `/root/o4p09e_cold_audit` examined semantic fingerprint
`f5ad4a9996bb028d1abcf6c98676191716b11542cce5336fd9cb612b74378f44`
and returned BLOCKER 0 / HIGH 1 / MEDIUM 2 / LOW 1. The Judge accepted all
four findings:

- Choose completion now emits one typed Core completion result, retains it in
  the accepted protocol receipt, reconstructs it during ordinary persistence
  replay, and projects a safe result count. Selected identities are omitted
  when `revealFound` is false and are public to player/observer projections
  only when it is true. Exact duplicates append no second result.
- Visibility grant identity is derived from the server-bound accepted sequence
  and authenticated rules actor as well as the normalized request identity, so
  separate seats may reuse the same client command ID without a Core collision.
- Immediate visibility-submit rejection now creates a safe structured client
  issue with Japanese recovery guidance that the started player surface
  renders; no raw error is exposed.
- Throwing array reflection traps are caught inside E validation and return a
  closed validation result without invoking accessors.

Post-correction Judge evidence: the integrated focused suite passed 13 files /
111 tests; the updated Judge architecture guard passed 7/7; affected ESLint,
`npx tsc -b --pretty false`, and `git diff --check` passed. Generated engine API
bytes are current, while the manifest reanchor remains the expected
commit-dependent terminal gate. Replacement preflight and cold audit remain
mandatory before local candidate promotion.

## Cold-audit correction 2

Replacement audit `/root/o4p09e_replacement_cold_audit` examined semantic
fingerprint
`06eee42b5f3f911e13d419e546f3ea07f43822889a21979bf657502a8905b396`
and returned BLOCKER 0 / HIGH 3 / MEDIUM 0 / LOW 0. The Judge accepted all
three findings as the final allowed correction wave for this lineage:

- The shipped O4P-01L `criteriaKey` remains opaque. Core and the E binder now
  reject every non-empty `qualified` selection, and reject an empty qualified
  selection unless the authoritative session has `mayFailToFind: true`.
  Unsupported qualification remains visibly Freeform Manual instead of being
  represented as executable automation.
- The accepted-command journal now keys retries by the protocol identity
  `(participant_id, command_id)`. Existing globally unique SQLite journals are
  rebuilt inside one transaction through a temporary table; source bytes are
  checked before the old table is dropped and checked again after rename.
  Ordinary coverage proves populated lossless migration, rollback, idempotence,
  cross-participant reuse, same-participant rejection, and replay.
- Observer projection still widens card identity for public Reveal, but emits
  an empty `visibilityGrants` array. Grant audience, duration, and subject
  metadata remain participant-only.

Post-correction implementation evidence: qualification Core and binding tests
passed 4/4 and 13/13 respectively; journal migration plus projection focused
tests passed 3 files / 31 tests. The Judge then passed the integrated affected
suite at 15 files / 132 tests, five additional predecessor protected files / 43
tests, and six re-owned architecture-guard files / 32 tests. The re-ownership
is limited to the public E lower-barrel imports, the verified journal-migration
DDL, participant-scoped journal identity, qualified fail-closed semantics, and
observer metadata redaction. Affected ESLint, `npx tsc -b --pretty false`, and
`git diff --check` passed. Generated engine API bytes are current;
`check:docs` stops only at the expected commit-dependent manifest reanchor. A
new exact fingerprint, release preflight, and fresh-context cold audit remain
mandatory. If that audit reports any BLOCKER or HIGH finding, this lineage must
stop for user direction rather than opening another correction wave.

## User-directed repair candidate takeover

The 2026-08-27 user instruction to inspect the ledger/governance evaluation
session and take over O4P-09E authorizes one derived local repair candidate for
the final audit findings. It does not authorize commit, push, deploy, publish,
ship, a release full check, O4P-09F/G progression, or a counter reset. The
candidate retains the original base SHA, contract, acceptance, and cumulative
lineage evidence.

The inherited audited fingerprint
`1292a08ab3e095dbf04f8a86c2d92ec9f67e7d9e392774ec521b1b07a09560c9`
reported BLOCKER 0 / HIGH 4 / MEDIUM 1 / LOW 0:

1. an accepted library shuffle/reorder could preserve a top-library grant when
   the revealed prefix happened to remain unchanged;
2. a supported concealed-object handle could not reach the E binder or player
   UI;
3. a delegated non-selector received executable Choose controls;
4. an opaque qualified search was presented as executable automation while its
   permitted empty `mayFailToFind` completion was unreachable; and
5. a WebSocket command reject did not reach the production recovery guidance.

Fresh implementer `/root/o4p09e_repair_implementer` (Luna/xhigh) changed only
product source and ordinary tests for those five findings. The Judge independently
reran the focused E suite at 4 files / 31 tests, the protected predecessor and E
guard suite at 8 files / 66 tests, affected ESLint, `npx tsc -b --pretty false`,
and `git diff --check`; all passed. The exact candidate still requires refreshed
generated-byte verification, release preflight, and one fresh-context R3/BROAD
cold audit before it may be described as a verified local candidate.

## Takeover cold-audit correction 1

Cold auditor `/root/o4p09e_takeover_cold_audit` inspected semantic fingerprint
`80b8eec208424dc62ad84a599aae2c6e86cb77214a0fcb74a33dca292d4989ea`
and returned BLOCKER 0 / HIGH 2 / MEDIUM 1 / LOW 0. The Judge accepted all
three findings as correction wave 1 of the derived repair candidate:

- the long Durable Object / SQLite ordinary runtime tests now use explicit
  bounded per-test timeouts consistent with the existing persisted-Pregame
  integration lane; assertions and production behavior are unchanged;
- production variable projections replace every active/completed Core search
  session key with a deterministic opaque projected handle. Choice-bound and
  Choose require that handle in the caller's current validated projection,
  resolve it server-side to exactly one active Core session, and use the Core
  key only after actor, selector, criteria, cardinality, and projection checks;
  and
- table/spectator projection validation rejects every visibility-grant entry.
  Public Reveal may widen the visible card identity, but grant metadata remains
  absent rather than accepting an empty-viewer metadata record.

The Judge independently passed the full variable runtime file at 17/17 tests
with one worker, the focused projection/binding/validation suite at 3 files / 39
tests, the protected predecessor and E guard suite at 8 files / 66 tests,
affected ESLint, `npx tsc -b --pretty false`, and `git diff --check`. A refreshed
generated API, exact release preflight, and affected-claim re-audit by the same
cold-auditor lineage remain mandatory. External and full-check authority remain
false.

## Takeover cold-audit correction 2

The same cold-auditor lineage re-audited semantic fingerprint
`716c8f9002ff3edc353435362e0027679c2393b85092093eea07f32aa9296cca`
and returned BLOCKER 0 / HIGH 2 / MEDIUM 0 / LOW 0. The Judge accepted both
findings as the second and final correction wave of the derived repair
candidate:

- every heavy asynchronous Durable Object / SQLite integration case in the
  variable runtime file now has an explicit bounded timeout while preserving
  every assertion; and
- projected search-session handles include the exact projection revision as an
  incarnation component. Current-projection binding and duplicate matching use
  the exact current/base revision, while completion-result handles use the
  accepted revision. Closing and reopening the same Core session key therefore
  yields distinct active and completed projected IDs; stale earlier handles
  fail closed, and raw Core keys remain absent.

The Judge independently passed the complete variable runtime file at 17/17 tests
with one worker, the focused projection/binding/validation suite including
open-complete-reopen at 3 files / 40 tests, the protected predecessor and E guard
suite at 8 files / 66 tests, affected ESLint, `npx tsc -b --pretty false`, and
`git diff --check`. Generated bytes, exact preflight, and a final affected-claim
re-audit on the refreshed fingerprint remain mandatory. No further correction
wave is available in this derived candidate; BLOCKER/HIGH in that audit is a
terminal STOP. External and release-full-check authority remain false.

## Final local verification packet

The same cold-auditor lineage inspected semantic fingerprint
`57c80d7b3c5117f88e0bd2607a676df98da0812d04d22ab2cf5942ccde586318`
after correction wave 2 and returned BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 with
verdict `AUDIT-OK-PENDING-FULL-CHECK`. The Judge then refreshed the required
production-browser evidence after all product repairs, without changing product,
test, contract, generated, or review bytes.

In one Codex in-app Browser session, the deterministic production-surface
fixture passed 375x812, 812x375, and 1440x900 with horizontal overflow 0, one
`GameScreen`, one D panel, one E panel, minimum actual control target 44x44 px,
and console warnings/errors 0/0. At 375x812, a two-card top-library Look for
both viewers showed the exact Japanese confirmation, then Look, top-library
Reveal, and projected-candidate Choose each changed only the bounded fixture
operation marker to `look`, `reveal`, and `choose`. The visible DOM text secret
probe was false. Screenshot bytes were discarded after visual inspection; only
their sizes and SHA-256 hashes remain in
`research/cr-grounding/o4p-09e-browser-evidence.draft.md`.

Because the refreshed browser record is part of the candidate fingerprint, the
Judge must run one exact preflight and the same auditor must confirm the final
evidence-inclusive fingerprint before terminal ledger promotion. Commit, push,
deploy, publish, ship, the release full check, manifest reanchor, and O4P-09F/G
progression remain unauthorized.
