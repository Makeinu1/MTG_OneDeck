# O4P-06C Luna Implementer Brief

Milestone: `O4P-06C`
Base SHA: `c33bc609449df906e3521f8d5568b2a1cfd3621e`

Read fully before edits:

- `AGENTS.md`
- `.agents/skills/mtg-onedeck-development/SKILL.md`
- `.agents/skills/mtg-onedeck-development/references/document-governance.md`
- `research/cr-grounding/o4p-06c-browser-safe-lobby.contract.draft.md`
- `research/cr-grounding/o4p-06c-acceptance-brief.draft.md`
- current O4P-06A bootstrap, Online Room, protocol, and Cloudflare runtime code

Implement the frozen contract. Primary write scope is
`src/online/lobby/**`, `src/online/cloudflare/**` production and ordinary tests,
and narrowly required existing Online/bootstrap barrels or ordinary tests.
Preserve unrelated bytes and Solo/Core semantics. Do not edit any `review.*`,
`docs/**`, governance/ledger/archive/draft file, package/dependency/config/workflow,
or perform git operations. If a historical Judge test or generated index needs a
semantic reauthorization, report it to the orchestrator instead of editing it.

Use closed descriptor-safe validation, immutable outputs, generic public errors,
server-generated random bearer material, bounded loops/bytes, and write-free
rejection. Reuse O4P-06A bootstrap and existing Online Room/Cloudflare
persistence rather than duplicating Core genesis. Add adversarial ordinary tests
for hostile objects, token leakage, origin confusion, races/idempotency, failure
atomicity, and all transition edges. Run only affected tests, `npx tsc -b`,
affected ESLint, and `git diff --check`; do not run `npm run check`.

Report changed files, exact test counts, defers, unresolved findings, and a
candidate fingerprint. Freeze after the report.
