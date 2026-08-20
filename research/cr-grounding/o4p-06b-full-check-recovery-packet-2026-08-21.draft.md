# O4P-06B Full-check Recovery Packet — 2026-08-21

Milestone: `O4P-06B`
Recovery base: the local candidate commit created from this exact audited tree;
record and verify its SHA before recovery work starts
Status: semantic candidate audited 0/0/0/0; release full-check limit reached;
not shipped

## Frozen completed evidence

- Luna xhigh implementation plus two permitted correction returns;
- Judge-owned real-four-deck Protocol/replay/hostile review: PASS;
- independent Luna xhigh cold audit and re-audit:
  BLOCKER/HIGH/MEDIUM/LOW 0/0/0/0;
- faithful audit archive:
  `research/cr-grounding/archive/o4p-06b-cold-audit-record-2026-08-21.md`;
- pre-record semantic fingerprint:
  `b838279c661be407e430c46103a50840be1f4f4c6f4f2a7e76084a2cb432d189`;
- audit-record-reauthorized fingerprint:
  `d088eaa4ea4ca7ee9d0e0660f341d0e6fa53b919ba3e852177c3ae69fffa09d3`.

## Full-check results

Invocation 1 was unintentionally triggered by `npm run check:fast` because the
new Judge drafts are unknown affected paths. It stopped at `verify:versions`
when sandboxed `tsx` failed to create its IPC pipe (`EPERM`). It is counted
conservatively as a full-check invocation.

Invocation 2 ran outside the IPC restriction. CR pin and version contract
passed, then `check:docs` failed closed with exactly:

```text
Generated API is stale: docs/generated/engine-api.md
```

No later release lane ran. The original task's two-invocation budget is
exhausted. Do not run another full check in that task.

## Fresh recovery task

Goal: mechanically refresh only the generated engine API for the already
audited Core public-barrel addition, prove that the generated diff is an exact
derivative with no semantic source change, obtain an independent metadata/
generated-artifact cold reauthorization, then use the fresh recovery task's
single final `npm run check` budget and governed ship flow.

Allowed pre-audit write:

- `docs/generated/engine-api.md` via the repository generator only;
- a Judge-owned recovery audit brief/record and loop-state fingerprint.

Prohibited: product source changes, contract meaning changes, dependency or
version changes, ledger promotion before release evidence, and any generated
file hand edit.

Required sequence:

1. verify current context and unchanged product candidate;
2. run the engine API generator in write mode and inspect the exact diff;
3. run `npm run check:docs`, targeted O4P-06B review, architecture, type, lint,
   and diff checks only;
4. freeze a new fingerprint and obtain an independent cold audit confirming
   the generated file exactly reflects public exports and prior 0/0/0/0
   product audit remains applicable;
5. run one fingerprint-matched `npm run check` outside the sandbox IPC
   restriction;
6. if green, stage explicit files, commit with cold-auditor ID, push `main`,
   verify exact-head Actions and Pages HTTP 200, then update both ledger
   collections to `shipped`, add completion evidence, reset loop state, commit
   and push terminal metadata, reverify CI/Pages/worktree clean; and
7. leave `O4P-06C` pending and end the O4P-06B recovery task.
