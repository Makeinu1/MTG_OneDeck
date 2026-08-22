# O4P-07A Full-Check Repair 2 Cold Audit Brief

Date: 2026-08-22
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Previously approved candidate fingerprint:
`63d5fa16377bcd1d42ca396e44f4f83c52e31bc51127b20b1585ecebf24a16a6`
Pre-brief repaired fingerprint:
`99bb87d774bd0271f0bbdc32ea925e38d127a89bca611cb78eb6f079dc9f60f0`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-07a-full-check-repair-2.draft.md`

Read only. Do not edit files, run the release full check, commit, push, or
deploy. Return BLOCKER/HIGH/MEDIUM/LOW findings and the final fingerprint.

## Audit the repair delta

Compare the repaired candidate with the previously approved fingerprint and
verify:

1. `deckSubmission` is admitted only by exact module-kind lists and the two
   exact Core public-barrel consumers. Any other file, symbol, namespace
   import, or private Core barrel remains rejected by executable synthetic
   tests.
2. O4P-03D still forbids UI/store/IndexedDB and direct Scryfall API ownership
   in worker/runtime/persistence while the dedicated resolver remains the only
   production Scryfall endpoint owner.
3. The old migration review now expects schema v2 without weakening atomicity,
   byte-idempotence, recovery, or corruption checks.
4. O4P-07 roadmap registration assertions read immutable registration bytes and
   diff only `20064643...` to `55fe0117...`; the live context assertion accepts
   only the next unshipped member derived from synchronized ledger entries.
5. The O4P-03D -> O4P-05C -> O4P-05D verifier hash chain exactly matches the
   changed authorities and does not broaden source, import, config, secret, or
   release ownership.
6. No product source, timeout, dependency, public UI/start path, fixed-catalog,
   CR, or acceptance meaning changed in repair 2.

## Targeted commands

```sh
npx vitest run --project dom src/test/architecture/modeNeutralCoreBoundary.test.ts src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts src/test/architecture/review.o4p-03d-cloudflare-production-gate.test.ts src/test/architecture/review.o4p-07-roadmap-registration.test.ts src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts --maxWorkers=1
npm run verify:online-cloudflare-runtime-persistence
npm run verify:online-cloudflare-websocket-recovery
npm run verify:online-cloudflare-capability-abuse-control
npm run verify:online-cloudflare-production-gate
npm run verify:o4p-05c-release-gates
npm run verify:o4p-05d-production-release-closure
npx eslint scripts/checks/verify-online-cloudflare-production-gate.ts scripts/checks/verify-o4p-05c-release-gates.ts scripts/checks/verify-o4p-05d-production-release-closure.ts src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts src/test/architecture/modeNeutralCoreBoundary.test.ts src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts src/test/architecture/review.o4p-03d-cloudflare-production-gate.test.ts src/test/architecture/review.o4p-07-roadmap-registration.test.ts
git diff --check
```

Host-level timeout failures are not green evidence and are not part of this
repair's semantic approval. Confirm that no timeout was increased or skipped;
the release full check remains separately blocked pending a quiet host and
explicit user authorization.
