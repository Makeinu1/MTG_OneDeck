# M-OPS-CHECK-GATES implementation brief

- Milestone: `M-OPS-CHECK-GATES`
- Base SHA: `0c1a824e0f0dac28319c421a0261116c2218964b`
- Role: implementer (`fork_context: false`)
- Archived: `2026-07-30`

## Goal

Reduce redundant local full-check runs and shorten the canonical check without
weakening its release coverage. Game behavior, public APIs, dependencies, and
the set of tests executed by `npm run check` must remain unchanged, apart from
new tests for this milestone.

## Allowed write scope

- `scripts/checks/machine-checks.mjs`
- a new ordinary test under `scripts/__tests__/` whose name does not contain
  `review.`
- `vite.config.ts`, `package.json`, and a narrowly required test setup/config
  file only if the benchmark adoption gate below passes

Do not edit `AGENTS.md`, `.claude/**`, `.agents/**`, `docs/**`, the ledger,
`review.*`, application/game source, dependency versions, or git state. Do not
run `npm run check`; the judge owns the single final full check.

## Required machine-check behavior

1. `npm run check` remains the single release command and still covers, on a
   green run, lint, every Vitest test exactly once, and `npm run build`.
2. Default execution is fail-fast: after the first failed step, later steps are
   reported as skipped and are not spawned.
3. `npm run check -- --continue-on-error` runs all steps for diagnosis and exits
   with the first non-zero status.
4. Every executed step and the total report elapsed milliseconds. Timing must
   use a monotonic clock and must not affect pass/fail.
5. Export testable `parseMachineCheckArgs` and `runMachineChecks` functions;
   importing the module must not execute the CLI. `runMachineChecks` must allow
   injection of steps, spawn, monotonic clock, and output writer so ordinary and
   judge-owned tests can prove fail-fast, diagnostic continuation, exit status,
   skipped steps, and deterministic durations without launching npm.
6. Unknown CLI arguments fail closed with a non-zero exit and a concise usage
   message.

## Vitest split experiment

Benchmark the current `src/engine/**` test subset without a full check:

- control: current global jsdom + serial-file behavior
- treatment: Node environment + parallel files, without changing assertions,
  timeouts, test files, or dependencies

Use one warm-up and three measured runs per arm on the same tree. Record file
count, test count, each elapsed time, and median in the completion report. Adopt
a `core`/`dom` project split only when all of the following hold:

- every run is green;
- the pre-existing test-file set is a disjoint, exhaustive union of the two
  projects (new milestone tests may add files but no prior file may disappear or
  execute twice);
- the treatment median is at least 20% faster;
- no application or test assertion changes are required.

If any condition fails, leave `vite.config.ts` and `package.json` unchanged and
report the experiment as rejected. Never flip global `fileParallelism` to true:
the existing DOM/visual serial lane must remain serial.

## Targeted verification

- Run only the new ordinary machine-check test while iterating.
- If the split is adopted, run each project independently and prove collection
  parity; do not run the canonical full check.
- Report changed files, exact commands/results, benchmark observations, deferred
  work, and concerns. Do not claim release green.
