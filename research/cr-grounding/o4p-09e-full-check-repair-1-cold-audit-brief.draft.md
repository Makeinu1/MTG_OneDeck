# O4P-09E Full-Check Repair 1 Cold-Audit Brief

Date: 2026-08-27
Semantic base SHA: `2dfac319ee0320dcedca2f99b76c23251d0cf24a`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-09e-full-check-repair-1.draft.md`

Read only. Do not edit files, run the release full check, commit, push, deploy,
or publish records. Return BLOCKER/HIGH/MEDIUM/LOW findings and the canonical
candidate fingerprint supplied by the Judge.

## Audit the repair delta

Compare the repaired candidate with the previously accepted successor
fingerprint
`a09e5819fbe78c2ea315fe15eafd397cade0dd4707febeb8f5d70e14d8c8219e`
and verify:

1. The executable verifier repair contains only four exact review-authority
   SHA-256 re-pins, the two exact visibility-decisions imports in each O4P-03A
   through O4P-03D leaf verifier, one exact non-weakened journal-migration
   assertion replacement, the four resulting verifier SHA-256 re-pins plus the
   repeated O4P-03D review and audited persistence/runtime re-pins in O4P-05C,
   and the resulting O4P-05C SHA-256 re-pin in O4P-05D.
2. Every re-pinned value equals the current intended authority byte-for-byte,
   including the terminal O4P-05D hash documented by the repair record.
3. The four review authorities and two production authorities are the already
   audited O4P-09E bytes; this repair does not alter production source or the
   generated API.
4. The ten architecture-guard updates admit only exact E module names, UI/Core/
   projection imports and symbols, the one already-audited comment phrase,
   first-non-shipped program selection, and exact O4P-09E successor paths. They
   contain no wildcard or unrelated authority and preserve negative probes.
5. No other assertion, allowlist/source entry, timeout, dependency, product
   behavior, UI/protocol meaning, ownership rule, or release requirement was
   changed or weakened.
6. All six historical verifier commands and affected architecture guards pass
   and remain non-vacuous; affected ESLint and `git diff --check` pass.
7. The ledger and these repair briefs remain secret-free and internally
   consistent. The candidate intentionally leaves
   `CONTRACT-ENGINE-MULTIPLAYER.lastVerifiedCommit` at its existing real commit
   until the audited verifier bytes have a real successor commit. Confirm that
   `npm run check:docs` reports exactly that one stale anchor for
   `soloOnlineBoundary.test.ts` and no other error. This is a required
   pre-commit transition state, not a waiver: after this audit the Judge must
   commit the exact repair bytes, reanchor only that manifest field to the real
   repair commit, return the reanchor to this same auditor, and require passing
   `check:docs` before the final full check.

## Targeted commands

```sh
npm run verify:online-cloudflare-runtime-persistence
npm run verify:online-cloudflare-websocket-recovery
npm run verify:online-cloudflare-capability-abuse-control
npm run verify:online-cloudflare-production-gate
npm run verify:o4p-05c-release-gates
npm run verify:o4p-05d-production-release-closure
npx vitest run --project dom src/test/architecture --maxWorkers=1
npx eslint scripts/checks/verify-online-cloudflare-runtime-persistence.ts scripts/checks/verify-online-cloudflare-websocket-recovery.ts scripts/checks/verify-online-cloudflare-capability-abuse-control.ts scripts/checks/verify-online-cloudflare-production-gate.ts scripts/checks/verify-o4p-05c-release-gates.ts scripts/checks/verify-o4p-05d-production-release-closure.ts src/test/architecture/modeNeutralCoreBoundary.test.ts src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts src/test/architecture/review.gov-codex-57-autonomy-player-journey.test.ts src/test/architecture/review.o4p-01h-core-boundary.test.ts src/test/architecture/review.o4p-01l-rule-authority-boundary.test.ts src/test/architecture/review.o4p-02c-in-memory-protocol-boundary.test.ts src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts src/test/architecture/review.o4p-09c-pregame-lifecycle.test.ts src/test/architecture/soloOnlineBoundary.test.ts
git diff --check
npm run check:docs
```

Return `O4P-09E-FULL-CHECK-REPAIR-BYTES-AUDIT-OK-PENDING-MANIFEST-REANCHOR`
only when BLOCKER/HIGH/MEDIUM/LOW are all zero and `check:docs` has exactly the
single expected pre-commit stale-anchor stop above. Do not return final repair
approval until the later manifest-reanchor audit. Full check and live release
evidence remain out of scope.
