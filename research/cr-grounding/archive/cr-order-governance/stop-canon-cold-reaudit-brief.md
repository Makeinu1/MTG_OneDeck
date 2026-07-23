# Narrow cold re-audit — live STOP canon

Audit the current worktree findings-only. Do not edit files.

Read `.claude/audit-standing.md`, then adversarially test the following status
claim:

- Slice selection has exactly the three `docs/judge-protocol.md §2` STOP① cases:
  a true formula tie between materially different paths, normal-Commander scope
  change, or North-Star/contract-principle change.
- The loop as a whole separately retains the four `AGENTS.md` stop categories,
  including true CR ambiguity, irreversible decisions, and implementation
  two-failure escalation.
- No live autoloop source retains the obsolete Phase S/C V4-vs-V1 branch,
  `plannedSequence`-first ordering, demand-first ordering, or a live role/priority
  dependency on `CLAUDE.md`.
- Ledger `judgePolicy` delegates to `AGENTS.md`; `user-stop` cannot turn an
  otherwise formula-resolved priority or demand-zero domain into a stop.

Inspect at least:

- `AGENTS.md`
- `docs/judge-protocol.md`
- `.agents/skills/mtg-onedeck-development/references/codex-autoloop.md`
- `.claude/commands/autoloop.md`
- `research/cr-grounding/cr-backbone-ledger.json`

Run `git diff --check`, validate the ledger JSON, and search the live sources for
the stale rules above. Historical shipped/provenance notes are not live rules;
identify them as historical rather than treating them as executable policy.

Output findings as `BLOCKER|HIGH|MEDIUM|LOW` with file/line, reproduction,
actual, expected, and classification. Then state:

- live STOP canon: `OK` or `BLOCKED`
- prior MEDIUM repaired: `YES` or `NO`
- management milestone may ship: `YES` or `NO`
