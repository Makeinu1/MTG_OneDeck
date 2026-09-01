---
name: mtg-onedeck-development
description: Implement a bounded MTG OneDeck engine, UI, or contract change with outcome-first planning, CR grounding, targeted tests, and risk-based independent review.
---

# MTG OneDeck development

Use this skill when a change is requested inside this repository. The goal is a
working player outcome, not a larger process. Read [`AGENTS.md`](../../../AGENTS.md),
[`docs/product-requirements.md`](../../../docs/product-requirements.md), and the
smallest applicable contract before editing. Read
[`docs/judge-protocol.md`](../../../docs/judge-protocol.md) when a CR ruling,
scope choice, or ambiguity needs adjudication.

## Work shape

1. Inspect `git status` and `HEAD`, then state the Goal, constraints, and Done
   when in a few lines. Keep one coherent outcome per change.
2. Implement only the requested source, contract draft, or test changes. The
   implementer owns source and ordinary tests; the judge owns contracts,
   adjudication, documentation, and git. Do not infer permission for commit,
   push, deploy, publication, or other external writes.
3. Run targeted tests while iterating. If an acceptance scenario fails, rerun
   that scenario from its first step after the fix. For UI changes, verify the
   required viewports in one browser session and keep console errors at zero.
4. Request a separate, read-only review only for authentication/security,
   multiplayer shared state or protocol, persistence/migration/data loss,
   major CR semantics, or release/deploy infrastructure. Give the reviewer the
   relevant files and acceptance claim, not implementation history. Resolve
   findings before release; routine low-risk edits need no ceremonial audit.
5. During development, repeat only relevant targeted tests. For an exact candidate
   sent to the current deploy-pages CI, do not run local `npm run check`; CI's
   `npm run check:release` (which runs `npm run check`, the forbidden-diff scan,
   and the build) is the sole full-strength suite. Run local `npm run check` once
   only for local-only completion, changes that do not use CI, or an explicit
   request for local full assurance. If CI fails, fail closed without deploying;
   fix the root cause, recheck only invalidated targeted evidence, push a new SHA,
   and rerun CI. Never automatically retry an external write.

## Meaning and safety

- Anchor deterministic rules to the pinned CR and record rule numbers in
  contracts or tests. Use English `oracleText` for parsing; `printedText` is
  display-only. An effect is automated only when an executable replay proves
  the final `GameState`; otherwise expose a guided/manual boundary.
- Keep `src/engine/` as pure functions. `GameState` is immutable and
  `applyCommand` deterministic; random choices are payloads fixed when commands
  are built. Compiler code emits `GameCommand` sequences and never mutates state
  directly. LLM output is advice only.
- Preserve existing undo/redo snapshots and backfill compatibility when adding
  state fields. Keep ordinary UI language Japanese, show `printedName ?? name`
  inside 《》, and provide a context-menu alternative for pointer gestures.
- Never put secrets, invite or room identifiers, or raw private errors in logs,
  evidence, or documents. Do not weaken assertions, silently drop unsupported
  semantics, or broaden scope without the user's explicit decision.

## Completion report

Report changed files, targeted-test results, final-check result, deferred or
manual behavior, review findings (if required), and unresolved issues. After an
interruption, reconstruct from `git status`, `HEAD`, and relevant CI state; do
not treat conversation history or scratch files as authority.
