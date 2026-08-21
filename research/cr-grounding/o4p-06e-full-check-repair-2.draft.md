# O4P-06E full-check repair 2

- Milestone: `O4P-06E`
- HEAD/base: `231b5e57aef87f1d66ad5a1a398bf65f5b5e2bbd`
- Prior repair 1 audit: 0/0/0/0, record in `research/cr-grounding/archive/`
- Final full-check 2 reached the DOM suite after every machine verifier,
  docs, lint, and 2,093 Core tests passed; it found exactly four architecture
  registration failures and no product failure

## Authorized Judge surgery

Change only the following four historical architecture tests, preserving every
assertion and existing entry while adding only the exact audited O4P-06E public
module/import registrations:

1. `src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts`: add
   `publicApp` once to `allowedOnlineRootNames` and its pinned ordered expected
   list, between `protocol` and `room`.
2. `src/test/architecture/review.o4p-01h-core-boundary.test.ts`: authorize only
   `src/App.tsx -> src/components/online/PublicOnlineApp.tsx` and
   `src/components/online/PublicOnlineApp.tsx -> src/online/publicApp/index.ts`
   as public composition imports. Do not weaken Core or general Solo/Online
   detection.
3. `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts`:
   add `publicApp` once to the exact sorted Online module list.
4. `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts`: add
   `publicApp` once to the exact sorted Online module list.

No production, ordinary test, other review, verifier/hash, package/config,
workflow, docs/manifest, generated, ledger, audit record, or prior brief edit is
allowed. The repair must be additive registrations only: no deletion, skip,
timeout, threshold, broad prefix/regex allowance, or assertion weakening.

Run the four invalidated files together and each relevant existing O4P-06E
architecture/Solo review, `verify:solo-preservation`, both 05C/05D verifiers,
TypeScript, affected ESLint, docs/generator, and diff checks. Prove that
removing each new exact registration recreates the corresponding failure.
Do not run full `npm run check`, mutate git/loop state, self-audit, network, or
publish. Freeze/report exact hunks, tests, vacuity, and fingerprint.
