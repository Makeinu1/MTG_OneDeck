# O4P-02C cold audit record

Milestone: `O4P-02C` In-memory Protocol & Command Envelope

Base SHA: `64eb31e2ff5cd276e8bb73ea835d51a34c3b5ef1`

Audit authority:

- `research/cr-grounding/o4p-02c-in-memory-protocol.contract.draft.md`
- `research/cr-grounding/o4p-02c-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-02c-cold-audit-brief.draft.md`

## Frozen-candidate audit

Independent auditor: `/root/o4p_02c_final_cold_auditor`

- semantic fingerprint:
  `ab43159d721b2fde693d6e06d6a6d06791bed4b392c42e20fa3e4a2ed387cf2b`
- context fingerprint:
  `fc10ce0fa90edec006a4bbb26e5167a4b66931df318d03c2a2a21ed7fb4fdd49`
- context health: `ok`
- full `npm run check`: not run before audit
- verdict: `AUDIT-FIX-REQUIRED`
- totals: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 0

### O4P-02C-H01 — accepted receipt history could be truncated

`validateOnlineProtocolStateV1` accepted a revision-2 state after the final
accepted receipt was deleted. That allowed an append-only deduplication record
for an already-applied command to disappear while the state still validated.

The judge reproduced the finding, then made one bounded repair in
`src/online/protocol/state.ts`: accepted receipt revisions must be contiguous,
and a non-empty accepted receipt history must reach the current Core-derived
revision. Judge-owned corruption evidence now rejects both a removed final
accepted receipt and an accepted-revision gap.

Post-repair targeted evidence:

- focused protocol/architecture: 5 files / 32 tests PASS
- `online-protocol` domain: 7 files / 43 tests PASS
- machine-check registration: 1 file / 7 tests PASS
- scripts checks TypeScript: PASS
- scoped ESLint: PASS
- `git diff --check`: PASS
- O4P-01N/O4P-02A/O4P-02B/O4P-02C verifiers: PASS

## Repair audit

Independent auditor: `/root/o4p_02c_final_cold_auditor`

- semantic fingerprint:
  `ce58501bd8372f4e6b7a706fb06461f5ed28b778dae3f399a2c22c14665eed6a`
- context fingerprint:
  `defaf14f7f708776073cd65d9bd8f507135e4daaa554b9820b9e6fc42996abf0`
- context health: `ok`
- verdict: `AUDIT-CLEAR` / `AUDIT-OK-PENDING-FULL-CHECK`
- totals: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0

The auditor confirmed the trailing-truncation and revision-gap repairs, plus
the valid collateral cases of nonzero Core revision with empty receipts and
interleaved stored rejects/accepted receipts. No file or git state was changed
by the auditor. The release full check had not run.

## Fingerprint-matched release full check

The Sol judge ran the single release `npm run check` on the exact metadata-
confirmed candidate:

- semantic fingerprint:
  `609cb8dd2a9ceb46e4404d9cfd2fff8f3bfa02c0b24dcf17d1381084936848fd`
- context fingerprint:
  `78c76d2b9228b021046c84865dadf5ff0c563c478d9e799ca49772caa0ef0b50`
- context health: `ok`
- `npm run check`: PASS
- Core: 226 files / 2086 tests PASS
- DOM: 263 files / 1836 tests PASS
- build: PASS
- `git diff --check`: PASS

The full check did not change a generated artifact or the candidate
fingerprints. O4P-02C is `audited` and pending only explicit publication,
GitHub Actions, Pages, served-asset, and clean-worktree evidence.
