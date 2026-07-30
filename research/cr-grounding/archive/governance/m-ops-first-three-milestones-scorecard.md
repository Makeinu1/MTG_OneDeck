# M-OPS first-three-milestones scorecard

Use this temporary scorecard for the first three milestones shipped after
`M-OPS-TOKEN-EFFICIENCY`. Quality gates do not change: BLOCKER/HIGH 0,
`review.*` green, `npm run check` green, and Pages HTTP 200 when applicable.

For each task, record only session id, milestone id, shipped SHA, completion
state, and the aggregate JSON metrics from `npm run codex:usage`. Do not copy
prompts or tool output into this file.

| Gate | Required per milestone |
|---|---|
| context compactions | 0 |
| inherited-context subagents | 0 |
| total subagents | at most 2 (one implementer, one cold auditor) |
| full `npm run check` | normally 1 after audit closure; at most 2 only when the release check itself fails |
| scope additions during implementation | 0 |

After milestone 3, compare model cycles, cached and uncached input, compactions,
full-check invocations, and completion state. A quality regression invalidates
an efficiency improvement.

| # | Milestone | Session | SHA | Complete | Cycles | Cached input | Uncached input | Compactions | Subagents | Full checks | Scope additions |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 |  |  |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |  |  |  |
