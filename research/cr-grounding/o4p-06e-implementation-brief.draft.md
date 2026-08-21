# O4P-06E implementer brief

Milestone: `O4P-06E`

Base SHA: `affb28de31ab562238b74199d0469a5bacef3d73`

Read and implement exactly:

- `research/cr-grounding/o4p-06e-public-online-app.contract.draft.md`
- `research/cr-grounding/o4p-06e-acceptance-brief.draft.md`

Role: implementation and ordinary tests only. Use the public shipped barrels.
Do not edit Judge drafts, any `review.*`, architecture tests/registrations,
ledgers, docs, governance, generated files, package/config/workflow/Wrangler,
dependencies, git, or release evidence.

Allowed writes are exactly the product/ordinary-test paths named in the
contract. Preserve legacy create/start and every shipped Solo/Online semantic.
Keep credentials volatile, use strict hostile validation, and do not place any
capability in URL/storage/log/error/DOM except the three intentionally visible
host invite codes.

Correction-round authority additionally permits only the contract's bounded
`src/online/cloudflare/persistence.ts` atomic Room/lobby operation and its
ordinary persistence/runtime tests. Do not broaden repository semantics.

Run only bounded affected ordinary/Judge tests and static checks. Do not run
`npm run check`, commit, push, deploy, or self-audit. Freeze and report changed
files, tests, deferred O4P-06F work, unresolved findings, and the canonical
candidate fingerprint.
