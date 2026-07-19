# Development cycle

## Roles

- **Judge/orchestrator**: select one milestone, approve the CR-backed contract, author or re-own `review.*`, adjudicate audit findings, update the ledger, and ship.
- **Implementer**: change implementation and ordinary tests only; provide exact verification evidence and honest deferrals; do not use git or edit protected judge-owned files.
- **Cold auditor**: start without implementation reasoning, compare the frozen change with the contract, CR, real Oracle fixtures, and machine checks; return findings only.

All three roles may use ChatGPT. Claude may advise but is never a release gate.

## Milestone sequence

1. Resolve the next eligible ledger item and direct user friction. Repair false automation before adding coverage.
2. Verify real-card demand and relevant Oracle text before designing a parser or state substrate.
3. Freeze public types, state transitions, failure behavior, CR references, and golden cases before implementation.
4. Give the implementer a narrow brief containing only milestone-specific scope, boundaries, and acceptance cases.
5. Iterate with targeted tests. Do not run or rewrite judge-owned review tests to manufacture green.
6. Freeze the tree. Run the full machine check and UI evidence once.
7. Give the frozen artifact to a cold auditor. Classify each finding as implementation, compiler, substrate, contract, or ambiguity before changing anything.
8. Re-run only the checks invalidated by a correction, then perform the final full check and ship from the judge lane.

## Automation priority

Use this order for new coverage: land actions, mana abilities, tap abilities, triggered abilities. Existing wrong or fake-complete automation outranks all new automation. Manual reachability outranks speculative full-card automation.

## Status vocabulary

- `drafted`: contract exists but is not judge-owned.
- `implemented-not-audited`: implementation and ordinary checks exist, but no independent cold audit has passed.
- `audited`: a cold auditor found no release-blocking issue on the frozen tree.
- `shipped`: judge-owned audit, commit, CI, and deployment evidence are complete.

