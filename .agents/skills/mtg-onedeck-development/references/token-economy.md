# Token economy

- Keep one task and one contract focused on one milestone. Externalize continuation state to the ledger and a short loop-state record.
- Let the judge consume conclusions, CR clauses, contract diffs, and red findings—not raw source tours, test logs, or agent transcripts.
- Search locally with `rg`; reuse pinned CR and Scryfall snapshots instead of repeatedly asking a model or the network.
- Reject zero-demand or net-negative parser work before implementation with a small real-corpus probe.
- Run narrow tests during implementation. Run the complete check only after the tree is stable.
- Launch a cold audit only after freeze. Do not poll raw transcripts; wait for the concise findings result.
- Archive completed reasoning packets after the ledger records their evidence. Keep only live contracts, golden cases, and current drafts in the active lane.
- Use the strongest available ChatGPT reasoning for contract, CR, architecture, and red-flag adjudication. Use faster bounded work for searches, mechanical edits, and focused tests. Avoid hard-coding model names in governance.
- Stop after two failed implementation retries and return exact completed work, remaining work, and evidence rather than expanding context indefinitely.

