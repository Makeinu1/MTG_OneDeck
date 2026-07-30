# M-OPS-CHECK-GATES correction 1

- Implementer: reuse `019fa98d-d10b-7000-8423-0a7d1ada2d22`
- Base brief: `research/cr-grounding/m-ops-check-gates-implementation-brief.draft.md`
- Archived: `2026-07-30`

## Reproduced defect

The adopted project config is correct when `core` runs alone, but the canonical
multi-project invocation does not retain that benefit safely. The judge ran:

```text
npx vitest run --project core --project dom src/engine src/dev/visualFixtures
```

It passed 102 files / 1059 tests but took 64.10 seconds. That is far above the
7.63-second treatment median for the 100-file core lane and recreates the
resource/scheduling behavior that global serial execution was introduced to
avoid. Do not repeat this stress run.

## Required bounded correction

1. Add an import-safe Node runner under `scripts/checks/` that executes the
   `core` project to completion and only then executes the `dom` project. It
   must use `spawnSync` without a shell, preserve the first non-zero status, and
   fail fast so DOM tests never compete with core workers.
2. Change `package.json` `test` to that runner so both local `npm run check` and
   GitHub Actions use the same sequential project order.
3. Change the machine-check test step from direct `npx vitest run` to `npm test`.
4. Add or extend ordinary non-`review.*` tests using injected spawn functions;
   prove `core` then `dom` order, no DOM spawn after core failure, status-null
   failure, and import safety. Do not weaken or edit existing tests.
5. Preserve the existing `core`/`dom` includes, environments, and per-project
   parallelism. Do not change application files, dependencies, protected files,
   or git state.

Run only the new/affected ordinary script tests and, if needed, one core-only
project check. Do not run the full DOM lane, the combined stress command, or
`npm run check`. Report exact changes and evidence; release green remains a
judge decision.
