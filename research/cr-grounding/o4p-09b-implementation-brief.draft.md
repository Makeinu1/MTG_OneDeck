# O4P-09B implementer envelope

Milestone ID: `O4P-09B`

Base SHA: `ce06a17b123cb6684090b48f9350df085e98ec54`

Brief path: `research/cr-grounding/o4p-09b-implementation-brief.draft.md`

Goal: Implement the versioned shared `GameIntentV1` application entrypoint and
Local/Remote adapters over the shipped variable Protocol and v3 Projection.

Constraints:

- Implement exactly
  `research/cr-grounding/o4p-09b-shared-intent-application.contract.draft.md`
  and `research/cr-grounding/o4p-09b-acceptance-brief.draft.md`.
- Own only these product paths and ordinary non-`review.*` tests:
  `src/online/application/index.ts`, `types.ts`, `gameIntentV1.ts`,
  `applicationV1.ts`, `localAdapterV1.ts`, `remoteAdapterV1.ts`, and
  `src/online/application/__tests__/gameApplicationV1.test.ts`.
- The Judge owns all existing dirty research files,
  `src/test/architecture/review.o4p-09b-shared-intent-application.test.ts`, and
  the historical closure repair in
  `src/test/architecture/review.o4p-09a-unified-game-surface.test.ts`.
  Preserve them exactly. You are not alone in the worktree; do not revert or
  overwrite another agent's edits.
- Do not edit git state, `AGENTS.md`, `docs/`, ledger/research files,
  `review.*`, engine/Core, protocol/projection/browser/Cloudflare/Room,
  GameScreen/controller/store/UI, dependencies, configuration, CR bytes, or
  generated files.
- Do not add a UI semantic compiler, second reducer/Core executor, optimistic
  Remote mutation, protocol version, player screen, or future O4P-09C-J scope.
- Never expose capability values, request digests, internal receipts/Core state,
  raw transport errors, or private projection facts in public results or logs.

Done when:

- The six named source files export the exact frozen intent, validation,
  application attempt/exchange, shared application entrypoint, and Local/Remote
  adapter creators.
- Local uses the existing variable protocol handler and v3 projector exactly
  once per application; Remote uses only its injected submit port.
- Equal accepted and duplicate intents produce equal validated Local/Remote
  exchanges; invalid, stale, reuse-mismatch, and transport cases fail closed
  without unintended state mutation or private-error disclosure.
- The Judge review, ordinary application tests, focused existing Protocol and
  Projection suites, affected ESLint, TypeScript build, and `git diff --check`
  pass.
- Report changed files, commands/results, deferred scope, and unresolved points.
