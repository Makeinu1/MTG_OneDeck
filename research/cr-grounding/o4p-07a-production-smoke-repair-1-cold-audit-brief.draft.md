# O4P-07A Production Smoke Repair 1 Cold Audit Brief

Date: 2026-08-22
Base SHA: `3d2cc04f77cb4db1fd9ed0caa47e26b95d936f32`
Pre-brief candidate fingerprint:
`8a2c10569f46bd50a33056fac1ea15967d956536e716661b35995ada3360f49a`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-07a-production-smoke-repair-1.draft.md`

Read only. Do not edit files, run the release full check, commit, push, deploy,
or change external state. Return BLOCKER/HIGH/MEDIUM/LOW findings and the final
fingerprint.

## Audit the frozen repair

Independently verify:

1. The resolver's default Cloudflare-native `fetch` invocation has no resolver
   instance receiver. An injected fetcher remains supported without changing
   the endpoint, headers, request body, sequential 75-ID batching, or wait.
2. The regression fails against the pre-repair call form and covers the live
   Scryfall collection shape used by the production smoke, including produced
   mana and single-faced image/mana/oracle fields.
3. Wrong-typed required and optional fields, non-success responses, malformed
   JSON, and network failures still fail closed as private retryable
   `SCRYFALL_UNAVAILABLE`; no client definition or card-name fallback appears.
4. Accepted definitions still require exact print and normalized Oracle
   identity, preserve ordered entries, and remain subject to snapshot size and
   secrecy checks.
5. The delta changes no public UI, start/genesis path, fixed catalog,
   dependency, configuration, CR authority, protocol shape, persistence
   semantics, or O4P-07B/C behavior.
6. The Judge evidence is coherent: remote Cloudflare execution of the original
   default resolver returned `OnlineDeckScryfallUnavailableError`; an unbound
   wrapper and then the repaired default each resolved exactly one definition.
   No identifier, capability, card definition, or Scryfall body was logged.

## Targeted commands

```sh
npx vitest run --project dom src/online/deckSubmission/__tests__/v2.test.ts src/online/cloudflare/__tests__/deckSubmissionV2.test.ts src/online/cloudflare/__tests__/review.o4p-07a-dynamic-card-resolution.test.ts src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts
npx eslint src/online/deckSubmission/resolution.ts src/online/deckSubmission/__tests__/v2.test.ts src/online/cloudflare/__tests__/review.o4p-07a-dynamic-card-resolution.test.ts
npx tsc -b --pretty false
git diff --check
```

The earlier `check:fast` classified these new paths as unknown and attempted a
release escalation, then stopped at sandbox IPC before product checks. It is
not green release evidence and must not be treated as a full-check result.
