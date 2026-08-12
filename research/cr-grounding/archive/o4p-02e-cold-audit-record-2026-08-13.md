# O4P-02E cold audit record

Milestone: `O4P-02E` local four-Player plus Table headless Room gate

Base SHA: `19bb9cbe6b1792d6ba0aad6960d7c539c472df0b`

Audit authority:

- `research/cr-grounding/o4p-02e-local-headless-room-gate.contract.draft.md`
- `research/cr-grounding/o4p-02e-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-02e-cold-audit-brief.draft.md`

Read-only auditors:

- `/root/o4p_02e_cold_auditor` — initial frozen candidate;
- `/root/o4p_02e_repair_cold_auditor` — correction return 1;
- `/root/o4p_02e_final_cold_auditor` — final correction return 2 candidate.

No auditor edited a file, performed a git write, or ran the release full check.

## Initial audit and correction return 1

The initial candidate matched semantic fingerprint
`f90e5b9adc9bf6aad02f271b3b435d7757fc5ada97287911ab6a29469ec8b821`
and context fingerprint
`16cdb6c58e707dd5ebd04cc5b6b4aee44f1d4a16c585b91877766013bdec6960`.
The audit returned `AUDIT-FIX-REQUIRED`, totals BLOCKER 0 / HIGH 1 /
MEDIUM 1 / LOW 0.

The HIGH reproduced a failed-validation privacy leak. A raw canonical state
contained seat capability `seat_capability_AAAAAAAAAAAAAAAA`; an unrelated
unknown nested state field made protocol canonicalization fail; clients and
actions were empty; and the root had an unknown key equal to the capability's
first eight UTF-16 code units, `seat_cap`. The public result included
`UNKNOWN_FIELD /seat_cap` plus generic `INVALID_PROTOCOL_STATE /state`.
Because canonical capabilities had not yet been harvested, the failure path
escaped the configured fragment.

Correction return 1 made capability-shaped unknown-key runs of at least eight
allowed code units generic before canonical capability extraction. Ordinary
short keys such as `/extra` remain exact. The root judge captured the failing
case before the shared repair and green evidence afterward.

## Repair audit and correction return 2

The repair candidate matched semantic fingerprint
`7867ce8b696f40677f00321edc90564087674f9bb10e4fbe200c777e28dd807e`
and context fingerprint
`e90e2549e3f22e8e1ab183615d2d2593428c27c8e2e3836932da991ed21c340f`.
The independent verdict was `AUDIT-CLEAR`, totals BLOCKER 0 / HIGH 0 /
MEDIUM 1 / LOW 0.

The MEDIUM showed that standalone public report validation accepted publicly
impossible counts: Player plus Table rejoin counts could exceed disconnects,
and aggregate action outcome counts could exceed the frozen 256-action input
limit. These were public count implications rather than private provenance
claims.

Correction return 2 added subtraction-based remaining-budget checks, avoiding
unsafe addition and coercion. It now requires Player plus Table rejoins not to
exceed disconnects and the complete aggregate action outcome count not to
exceed 256. The root judge again captured red-before and green-after evidence.

## Final independent audit

The final auditor independently matched semantic fingerprint
`8bb6a7d71b3f1e7438c9b0063756561e5b23fef14e2fcb6caf70fd6d122a0ee5`
and context fingerprint
`2f69e38414c35b35455430c5f7541db2bd2d5731085bc9e79b11e7c20e3834d9`.
Context health was `ok`; loop state was current at
`final-candidate-frozen-pending-audit`; base and HEAD both matched the frozen
base SHA.

Verdict: `AUDIT-CLEAR` / `AUDIT-OK-PENDING-FULL-CHECK`.

- BLOCKER: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0

Independent final evidence:

- failed-input capability secrecy before state/client canonicalization: PASS;
- exact eight-code-unit windows and ordinary short `/extra`: PASS;
- safe-integer report budget and rejoin/disconnect relations: PASS;
- targeted ordinary/review/architecture: 6 files / 57 tests PASS;
- O4P-02E verifier plus Core closure, Solo compatibility, Room, protocol, and
  projection prerequisite verifiers: PASS;
- app and verifier TypeScript: PASS;
- scoped ESLint: PASS.

Root-observed final-candidate evidence additionally passed focused 3 files /
41 tests, affected architecture 4 files / 22 tests, `online-headless` domain
13 files / 122 tests, all six verifiers, app/scripts TypeScript, scoped ESLint,
and `git diff --check`.

The release `npm run check` has not run. It must run once after this audit
record and the exact O4P-02E ledger metadata are frozen and independently
confirmed without changing the audited semantic candidate.

## First release full-check finding

After metadata-only confirmation, the Sol judge ran the governed release
`npm run check`. Every registered verifier, docs check, and lint passed. Core
passed 226 files / 2086 tests. DOM passed 268 of 269 files and 1914 of 1915
tests, then stopped before build on one stale machine-check registration
expectation.

`scripts/__tests__/machine-checks.test.mjs` still expected the sequence to move
directly from the shipped Projection verifier to lint, while the audited
machine runner correctly invoked the new O4P-02E verifier between them. The
judge added exactly `verify:online-local-room-gate` at that canonical position;
no assertion, verifier, machine order, workflow, or protection was weakened.
The exact machine-check test now passes 1 file / 7 tests; scoped ESLint and
`git diff --check` pass.

Because the release check detected this defect, governance permits a final
full-check rerun only after focused independent audit. The repaired semantic
candidate fingerprint, now including the registered machine-check test, is
`4afcb1ae104c4ff9576f95f5b99100a28438f978f8615dc618c65395b20dc7e9`
across 23 paths. Focused post-full-check audit and the final release check are
pending.

## Focused post-full-check audit

The read-only final auditor matched repaired semantic fingerprint
`4afcb1ae104c4ff9576f95f5b99100a28438f978f8615dc618c65395b20dc7e9`
across 23 paths and context fingerprint
`21f85d4fd907697b13487a466afa905dd45ef4aa97f200e5705b227ad7382a51`.
Context health was `ok` and loop state was current. Verdict:
`AUDIT-OK-PENDING-FINAL-FULL-CHECK`, BLOCKER 0 / HIGH 0.

The new verifier appears exactly once, immediately after Projection and before
lint. Canonical fail-fast, skipped-step reporting, diagnostic continuation,
and first-failure preservation remain unchanged. Focused evidence passed:

- exact machine-check suite: 1 file / 7 tests;
- O4P-02E architecture/registration suite: 1 file / 6 tests;
- scoped ESLint;
- package, machine runner, scripts TypeScript, validation-domain, and
  architecture registrations.

The audit record and both unique O4P-02E ledger entries were accurate and
pending only the governance-permitted final full-check rerun. The auditor made
no write or git operation and did not run that full check.

## Final fingerprint-matched release full check

After metadata-only confirmation, the Sol judge ran the governance-permitted
final `npm run check` rerun on semantic fingerprint
`4afcb1ae104c4ff9576f95f5b99100a28438f978f8615dc618c65395b20dc7e9`.
The check passed completely:

- every machine verifier, docs check, and lint: PASS;
- Core: 226 files / 2086 tests PASS;
- DOM: 269 files / 1915 tests PASS;
- TypeScript production build and Vite build: PASS;
- generated JS: `assets/index-DYJZmvM4.js`;
- generated CSS: `assets/index-JeU5vEot.css`.

The full check changed no tracked candidate file. A terminal semantic
recalculation remained exactly
`4afcb1ae104c4ff9576f95f5b99100a28438f978f8615dc618c65395b20dc7e9`,
and `git diff --check` passed. O4P-02E is audited and pending only explicit
candidate publication, exact-head CI/forbidden/build/Pages evidence, terminal
ledger metadata, and a clean worktree.
