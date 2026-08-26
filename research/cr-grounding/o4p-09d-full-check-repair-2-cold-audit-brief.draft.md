# O4P-09D Full-Check Repair 2 Cold-Audit Brief

Date: 2026-08-26
Semantic base SHA: `d11a54a54bb3f3ad3dcb624132f3ea3e23de1fd2`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-09d-full-check-repair-2.draft.md`

Read only. Do not edit files, run the release full check, commit, push, deploy,
or publish records. Return BLOCKER/HIGH/MEDIUM/LOW findings and the canonical
candidate fingerprint supplied by the Judge.

## Audit the repair delta

Compare with the previously accepted successor fingerprint
`c0d9c66d9799d74adb78b3b612feab6aa7d62a55002899fc02621cf7674eb4a3`
and verify:

1. The executable correction contains exactly one literal change in
   `src/engine/core/tabletop/__tests__/tabletopCommandsV1.test.ts`:
   `30_000` to `60_000` for the named note/manual-stack collection boundary
   test.
2. Both 128-item loops, every command, every acceptance/rejection assertion,
   root-identity atomicity assertion, and all product bytes are unchanged.
3. The observed release failure was timeout-only after all earlier gates and
   lint passed, with Core totals 227 passed files / 2111 passed tests and no
   assertion failure.
4. The exact focused test passes without changing global config, dependencies,
   production behavior, review tests, or another timeout.
5. Repair authority, archive, synchronized ledger collections, preflight, and
   changed text remain internally consistent and secret-free.

## Targeted commands

```sh
npx vitest run --project core src/engine/core/tabletop/__tests__/tabletopCommandsV1.test.ts -t "bounds note and manual-stack collections atomically at the final allowed item"
npx eslint src/engine/core/tabletop/__tests__/tabletopCommandsV1.test.ts
git diff --check
```

Return `O4P-09D-FULL-CHECK-REPAIR-2-AUDIT-OK` only when
BLOCKER/HIGH/MEDIUM/LOW are all zero. Full check and live release evidence
remain out of scope.
