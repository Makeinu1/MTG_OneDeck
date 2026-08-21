# GOV-CODEX-56-2026-08 CI Reauthorization Record — 2026-08-22

Milestone: `GOV-CODEX-56-2026-08`
Candidate HEAD: `6d7ff1ce4ab17e92e504d76d1956a07924a29ddc`
Candidate immediate parent: `56279498baa65a647fcc3c57aabc7f5557171823`
Workflow diff base: `592bcc7ed69266f0b078bb8a4e3a3d4103113e1a`
Workflow run: `32506234380`
Build job: `96846905962`
Deploy job: `96851699588` (`skipped`)

## Exact-head machine evidence

- `npm run check -- --build-base=/MTG_OneDeck/`: success.
- Core: 227 files / 2093 tests passed.
- DOM: 325 files / 2203 tests passed and 1 skipped (2204 total).
- Every static verifier, pinned CR check, docs check, lint, TypeScript, and Vite
  production build passed.
- Built assets: `index-B8jI0XI3.js` and `index-DNaejTHC.css`.
- Machine-check total: 779195 milliseconds.
- Diff-base resolution succeeded with the exact workflow diff base above.

The workflow then stopped only at Judge ownership. Pages configuration,
artifact upload, and deploy were skipped. The ownership output contained
exactly the following ten paths and no eleventh path:

| Category | Path | Candidate SHA-256 |
| --- | --- | --- |
| NEEDS-REAUTH | `docs/judge-protocol.md` | `c69560c4c332db3b1b1e538fcea2d4385599df419a7bd3c1930cb866e1723fa9` |
| NEEDS-REAUTH | `research/cr-grounding/archive/gov-codex-56-program-orchestration-audit-record-2026-08-22.md` | `444fce44e947e6ebc27b2a5debbba64166c739c3bd356162123c3178af40d582` |
| NEEDS-REAUTH | `research/cr-grounding/codex-56-program-orchestration-acceptance.draft.md` | `4d91608738d35cdf7053518077de3b699b4b5a6544b9854c476aeb3749d4d885` |
| NEEDS-REAUTH | `research/cr-grounding/codex-56-program-orchestration-cold-audit-brief.draft.md` | `4d85d37f8635d1d79fc57c9ab36a5b3a206c7bc183c911f862090d6437e0a52b` |
| NEEDS-REAUTH | `research/cr-grounding/codex-56-program-orchestration.contract.draft.md` | `b688a63617d2daf543ece826d52bd757ca2c02c38b8aeba87e0190e4acdeb3f0` |
| NEEDS-REAUTH | `research/cr-grounding/cr-backbone-ledger.json` | `884ec393d36d04f54cb968b41e503e66d622048ec0e4a79c86a41a8bdd1d21be` |
| FORBIDDEN | `AGENTS.md` | `a8edef1c5ce00698ca81021695e0ea77e20a35495f1072161d7a63aa1f7a417c` |
| FORBIDDEN | `scripts/__tests__/review.codex-ops.test.mjs` | `1bea4d8bd920fc2c5806713e31260a046ce6e6f19ff1528507027e33aa8b87f1` |
| FORBIDDEN | `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts` | `b87e58a1f7ae391f1f96352d2398c08b5b3520db919a2d8bddf864f067408bd5` |
| FORBIDDEN | `src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts` | `27cfd9d73404e6104942e6a271978dbcc20decc6778d20a29702cc8fb6397063` |

GitHub's combined job log may render the final NEEDS-REAUTH stdout line for
`research/cr-grounding/cr-backbone-ledger.json` after the FORBIDDEN stderr
heading. Category ownership is determined by the executable classifier, not
merged-stream display order: the path does not match any FORBIDDEN expression
and does match `^research/` in NEEDS-REAUTH. The exact local diff scan therefore
confirms six NEEDS-REAUTH paths and four FORBIDDEN paths.

## Applicability and boundary

Candidate commit `5627949` carries the independent BROAD auditor identity and
audited fingerprint. Terminal commit `6d7ff1c` carries the R0 verifier,
immutable terminal-record hash, and local release-check result. The archived
audit/completion record pins final findings `0/0/0/0`, fingerprint
`7e452e504497aded5009f1db18b57a69b1fe5808e0189d67604729a564154b6f`,
and the successful local release check.

The proposed next commit is parent-only CI ownership metadata: this record and
its adjacent cold-audit brief. It does not modify or re-author product,
contract, workflow, ledger, review, dependency, generated, CR, or deployment
bytes and does not claim the skipped Pages deployment as success. A subsequent
exact-head green workflow, Pages deploy, public asset smoke, HEAD/origin
equality, clean worktree, and loop-state reset remain mandatory.

## Auditor authorization

Independent auditor: `/root/gov_codex_56_ci_reauth_auditor`.
Audited fingerprint:
`97d1593a379723fbca6c2de51ce2cf58338126dfa2f3b12cf09c22001def2726`.
Findings: `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.

`GOV-CODEX-56-CI-REAUTHORIZATION-APPROVED`

This is ownership-only approval. It authorizes the two-file metadata
commit/push and subsequent exact-head CI/Pages/public-asset closure; it does
not itself authorize a shipment claim before those checks complete.
