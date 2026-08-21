# GOV-CODEX-56-2026-08 BROAD Cold Audit Brief

Milestone: `GOV-CODEX-56-2026-08`
Base SHA: `592bcc7ed69266f0b078bb8a4e3a3d4103113e1a`
Role: read-only cold auditor; findings only; do not edit files or run the release
full check.

## Candidate

- `AGENTS.md`
- `.agents/skills/mtg-onedeck-development/SKILL.md`
- `.agents/skills/mtg-onedeck-development/references/document-governance.md`
- `docs/judge-protocol.md`
- `.codex/config.toml`
- `.codex/agents/onedeck-cold-auditor.toml`
- `research/cr-grounding/codex-56-program-orchestration.contract.draft.md`
- `research/cr-grounding/codex-56-program-orchestration-acceptance.draft.md`
- `research/cr-grounding/cr-backbone-ledger.json`
- `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts`
- `scripts/__tests__/review.codex-ops.test.mjs`
- `src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts`

## Authority and invariants

1. O4P-06A through O4P-06F remain shipped and are not reopened.
2. One worktree has only one active milestone candidate. A serial program may
   continue in one supervisor task only after an exact-head, clean-worktree
   transition gate.
3. Implementer and auditor context is fresh and rationale-independent.
4. Explicit user model/effort requests are honored or visibly rejected.
5. Product semantics, CR pin, dependencies, and release evidence gates do not
   change.
6. The R0 cold-audit exception applies only to deterministically derived exact
   terminal metadata and never to authority, allowlists, acceptance, or meaning.

## Adversarial questions

- Do canonical files contradict one another about task lifetime, compaction,
  milestone transitions, or audit requirements?
- Can a supervisor begin downstream work before predecessor shipment or carry
  a dirty candidate across cycles?
- Does any default silently make Luna/medium the cold auditor for an R3 task?
- Is the R0 exemption broad enough to hide semantic or ownership drift?
- Does the project config use current supported keys and preserve explicit
  spawn overrides?
- Can the review test pass while ledger collections diverge, O4P-06 is no
  longer complete, or product paths change?
- Are official OpenAI claims represented accurately and without treating a
  model name as quality evidence?

## Evidence already run

- `npm run check:docs`: PASS
- `npx vitest run --project dom src/test/architecture/review.gov-codex-56-program-orchestration.test.ts`: 1 file / 5 tests PASS
- `npx eslint src/test/architecture/review.gov-codex-56-program-orchestration.test.ts`: PASS
- `npm run codex:context -- --domain GOV-CODEX-56-2026-08`: healthy explicit projection; O4P-06 complete

Return `BLOCKER/HIGH/MEDIUM/LOW`, exact file/line evidence, and a final verdict.
Do not propose unrelated product or roadmap work.
