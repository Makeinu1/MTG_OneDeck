# O4P-06F implementation brief

Base SHA: `8810ed2e6db69fdc93c131f6abc195af6a763066`

Read completely before editing:

- `AGENTS.md`;
- `.agents/skills/mtg-onedeck-development/SKILL.md` and its governance reference;
- `docs/judge-protocol.md`;
- `research/cr-grounding/o4p-06f-four-browser-production-release.contract.draft.md`;
- `research/cr-grounding/o4p-06f-acceptance-brief.draft.md`; and
- the frozen Judge `review.o4p-06f-*` tests.

Role: Luna xhigh implementer. Implement only the evidence harness and ordinary
tests inside the contract's exact four-path boundary. Use injectable CDP/page,
clock, barrier, and platform-evidence dependencies so hostile validation,
cleanup, timeout, four-context, command ordering, hash equality, and secret
redaction are testable without network or Chrome. The production path must use
system Chrome, `Target.createBrowserContext`, browser-owned fetch/WebSocket,
the exact two production origins, and the exact four repository deck files.

Do not edit Judge drafts/reviews, product code, package-lock, dependencies,
Wrangler, workflow, versions, manifests, generated docs, ledgers, or git. Do not
run the full check, launch Chrome, access the network, deploy, or self-audit.
Run only affected ordinary/Judge tests and bounded TypeScript/ESLint/diff/docs
checks. Freeze and report exact paths, tests, unresolved findings, and canonical
tree fingerprint.
