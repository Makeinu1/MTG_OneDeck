# Token economy

- Keep one task and one contract focused on one milestone. Externalize continuation state to the ledger and a short loop-state record.
- Start fresh from milestone id, base SHA, brief path, goal, constraints, and done-when. Do not import a prior thread transcript or Referenced chat.
- Let the judge consume conclusions, CR clauses, contract diffs, and red findings—not raw source tours, test logs, or agent transcripts.
- Search locally with `rg`; reuse pinned CR and Scryfall snapshots instead of repeatedly asking a model or the network.
- Batch independent reads in one bounded `functions.exec` stage. Keep dependencies, approvals, waits, adaptive investigation, and conflicting writes sequential.
- Reject zero-demand or net-negative parser work before implementation with a small real-corpus probe.
- Run narrow tests during implementation. Run the complete check only after the semantic cold audit is clean and the release tree is stable.
- Launch a cold audit after candidate freeze but before the release full check. Do not poll raw transcripts; wait for the concise findings result.
- Use at most one implementer and one cold auditor per milestone, both with `fork_context: false`; corrections reuse the implementer instead of spawning replacements.
- Archive completed reasoning packets after the ledger records their evidence. Keep only live contracts, golden cases, and current drafts in the active lane.
- Default implementation, search, and targeted-test work to Medium reasoning; default contracts, CR adjudication, architecture, and cold audit to High. Reserve XHigh/Ultra for decisions unresolved by CR and canonical lookup. Avoid hard-coding model names in governance.
- Stop after two failed implementation retries and return exact completed work, remaining work, and evidence rather than expanding context indefinitely.
- Measure drift every three shipped milestones with `npm run codex:usage`; never sum cumulative totals from forked JSONL without removing copied parent history.
