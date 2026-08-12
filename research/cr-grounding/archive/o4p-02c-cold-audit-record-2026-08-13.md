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

## Candidate publication and judge re-ownership

The audited release tree was committed as
`d47e544ee62d6280531eb58d66a40747971c68a2` and pushed to `main`. GitHub
Actions run `31615957143` independently passed `npm ci` and the complete
`npm run check` on that exact head. It stopped at the forbidden-file lane
before Pages solely because the pushed O4P-02C range contains two judge-
authored acceptance files:

- `src/online/protocol/__tests__/review.o4p-02c-in-memory-protocol.test.ts`
  SHA-256 `e4e22747f8a9932f8e8aea2ff90ae9483cfb41ff2f95b4eeb7a0babebb4e543e`;
- `src/test/architecture/review.o4p-02c-in-memory-protocol-boundary.test.ts`
  SHA-256 `5d0101f024a4649b165d6c71b065b57edd2ea06135c0c198bedec9cd0261a4db`.

The Sol judge explicitly re-owns those frozen acceptance files. They are the
same files covered by the clean O4P-02C audit and fingerprint-matched full
check; no source file, assertion, workflow, or forbidden-file protection is
changed. A metadata-only commit may advance the push diff base to
`d47e544ee62d6280531eb58d66a40747971c68a2` and retry CI/Pages under the
established O4P-02A/O4P-02B precedent.

## Metadata retry and Pages evidence

Judge re-ownership commit
`90077176d14065cff11fc388457b2a0e0d9fd40a` changed only this audit record and
the ledger. GitHub Actions run `31617058863` resolved diff base
`d47e544ee62d6280531eb58d66a40747971c68a2` and passed every required gate:
`npm ci`, the complete `npm run check`, ancestor-safe diff-base resolution,
forbidden scan, Pages artifact build, and Pages deploy.

Served evidence after deployment:

- `https://makeinu1.github.io/MTG_OneDeck/`: HTTP 200;
- served JS `assets/index-CyZgN26K.js`: HTTP 200;
- served CSS `assets/index-JeU5vEot.css`: HTTP 200;
- HTML and both assets report deployment `Last-Modified` 2026-08-12 16:28:25
  UTC.

The pure in-memory protocol substrate has no visible UI interaction to
exercise; the served asset and CI evidence close publication. O4P-02C may now
be marked `shipped`; one final metadata push records that terminal state and
must itself pass CI/Pages with a clean worktree.
