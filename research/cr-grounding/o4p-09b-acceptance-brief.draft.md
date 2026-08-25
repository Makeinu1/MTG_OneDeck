# O4P-09B acceptance brief

Date: 2026-08-25
Base SHA: `ce06a17b123cb6684090b48f9350df085e98ec54`

1. `GameIntentV1` is a versioned exact wrapper for one validated
   `CoreCommandV1`, command ID, and base revision. It contains no authority,
   transport, projection, or application state.
2. `applyGameIntentV1` validates before side effects, creates the existing exact
   online command envelope once, and invokes only the selected adapter.
3. The Local adapter owns in-memory variable protocol state, calls the shipped
   variable command handler once, and projects with the shipped v3 audience
   projector. It neither calls Core directly nor exposes internal state.
4. The Remote adapter sends the same envelope through one injected async submit
   port, performs no Core/projection application and no optimistic mutation,
   and fail-closes malformed or mismatched output and transport failure.
5. Both adapters return the same immutable exchange shape: a validated command
   acknowledgement/rejection receipt plus the matching participant projection.
6. The same accepted intent against the same starting state yields equal Local
   and Remote receipts and projections; exact duplicate replay is idempotent,
   while mismatched reuse and stale revisions do not mutate authority.
7. Hostile intent descriptors and surplus fields are rejected before adapter
   invocation. Results do not contain capabilities, request digests, internal
   receipts, Core roots, raw private errors, or transport exception text.
8. Product changes are additive under `src/online/application/**` and ordinary
   tests only. No engine, protocol, projection, browser, Cloudflare, Room,
   GameScreen/controller/store, dependency, configuration, CR, or future
   O4P-09C-J implementation is included.
9. Judge review, focused tests, affected lint, TypeScript, docs and ownership
   checks pass; independent R3 cold audit is BLOCKER/HIGH zero before release.
