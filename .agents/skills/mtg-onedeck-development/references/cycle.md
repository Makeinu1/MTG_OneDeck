# Development cycle compatibility pointer

The sole operative workflow is [`document-governance.md`](document-governance.md). The material below is preserved for historical compatibility; do not add new rules here.

## Roles

- **Judge/orchestrator**: select one milestone, approve the CR-backed contract, author or re-own `review.*`, adjudicate audit findings, update the ledger, and ship.
- **Implementer**: change implementation and ordinary tests only; provide exact verification evidence and honest deferrals; do not use git or edit protected judge-owned files.
- **Cold auditor**: start without implementation reasoning, compare the frozen change with the contract, CR, real Oracle fixtures, and machine checks; return findings only.

各席は利用可能なモデルを能力で選ぶ。モデル名をrelease gateや統治へ固定しない。

## Milestone sequence

1. Run `npm run codex:context -- [--domain <id>]`. Resolve integrity errors, fake-green, broken automation, and unaudited implementation before adding coverage; otherwise select its unique eligible CR section.
2. Verify normal Commander reachability and relevant English Oracle text before designing a parser or state substrate. Use MyDeck cards as strong acceptance fixtures and same-CR tie-breaks, not as permission to skip earlier CR sections.
3. Freeze public types, state transitions, failure behavior, CR references, and golden cases before implementation.
4. Give one `fork_context: false` implementer a narrow brief path containing only milestone-specific scope, boundaries, and acceptance cases. Reuse that agent for at most two corrections; do not spawn generic explorers by default.
5. Iterate with targeted tests. Do not run or rewrite judge-owned review tests to manufacture green.
6. Freeze a candidate tree. Run targeted judge evidence and UI evidence once, and record the exact candidate fingerprint. Do not run the full machine check yet.
7. Give only the audit brief path to one `fork_context: false` cold auditor. Before spawning, select the `NARROW`, `STANDARD`, or `BROAD` timing profile from `references/codex-autoloop.md` and put it in the brief; an older brief without a profile defaults to `STANDARD`. Use one wait for the profile's hard budget, not repeated short waits. The auditor runs the target-domain review/adversarial evidence without duplicating the full check. A clean semantic verdict is `AUDIT-OK-PENDING-FULL-CHECK`, not ship approval. A wait timeout or missing result remains `implemented-not-audited` and is reported as an audit infrastructure timeout, never as Green. Classify each finding as implementation, compiler, substrate, contract, or ambiguity before changing anything.
8. Re-run only checks invalidated by a correction and re-audit affected claims. After findings close, freeze the release tree and run `npm run check` once on that exact fingerprint. Only if this release check itself fails may the judge correct it and run one final full check. Ship from the judge lane, reset loop-state, archive the packet, and end the task.

## Automation priority

Use CR chapter/section order for new normal-Commander coverage, with only the minimum missing substrate allowed to run ahead before returning to the blocked CR section. Existing wrong, fake-complete, or unaudited automation outranks all new coverage. Manual reachability outranks speculative full-card automation.

## Status vocabulary

- `drafted`: contract exists but is not judge-owned.
- `implemented-not-audited`: implementation and ordinary checks exist, but no independent cold audit has passed.
- `audited`: a cold auditor returned `AUDIT-OK-PENDING-FULL-CHECK` on the frozen candidate; release full-check evidence is still pending.
- `shipped`: judge-owned audit, commit, CI, and deployment evidence are complete.
