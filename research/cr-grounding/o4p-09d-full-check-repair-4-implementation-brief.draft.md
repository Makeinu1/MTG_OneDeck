# O4P-09D Full-Check Repair 4 Implementer Envelope

Milestone ID: O4P-09D

Base SHA: a95c9b2177bd1e33d8438ff3f6f7dc4bb7895657

Brief path:
research/cr-grounding/o4p-09d-full-check-repair-4-implementation-brief.draft.md

Goal: Restore exact Core/projection keyword canonicality by removing the one
O4P-09D carriage-return rejection that invalidates a Core-accepted projected
keyword.

Constraints:

- Own exactly src/online/projection/validation.ts.
- In the projected token-definition keywords predicate only, remove
  `|| value.includes('\r')`.
- Preserve every other predicate, validation issue, bound, ordering rule,
  serialized-size budget, and CR rejection on all non-keyword text fields.
- Do not edit any test, review.*, research, docs, ledger, loop state, config,
  dependency, generated file, or O4P-09E byte.
- Do not use git. You are not alone in the worktree; do not revert Judge edits
  and adapt to concurrently created Judge-owned records and guards.
- Do not run the canonical full check.

Done when:

- The unchanged carriage-return case in
  src/online/projection/__tests__/review.o4p-02d-audience-projection.test.ts
  passes.
- The complete O4P-02D audience-projection review file and affected ordinary
  projection validation tests pass.
- Scoped ESLint and git diff --check pass.
- Report the one changed file, exact focused results, deferred scope, and any
  unresolved point without exposing secret material.
