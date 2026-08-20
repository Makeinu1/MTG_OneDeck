# O4P-06C full-check repair 1 cold-audit brief

- Milestone: `O4P-06C`
- Base commit: `1c91f21f3943278001c084be7fd34339e14ae8e0`
- Role: independent cold auditor; findings only; do not edit files, run the full check, perform git mutations, use the network, or publish records.
- Required reading: `AGENTS.md`, `.agents/skills/mtg-onedeck-development/SKILL.md`, `.agents/skills/mtg-onedeck-development/references/document-governance.md`, `docs/judge-protocol.md`, and this brief.

## Candidate boundary

The staged candidate may change only:

- `research/cr-grounding/o4p-06c-full-check-repair-1.draft.md`
- this brief
- `src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts`
- `src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts`
- `src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts`
- `src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts`
- `scripts/checks/verify-online-cloudflare-runtime-persistence.ts`
- `scripts/checks/verify-online-cloudflare-websocket-recovery.ts`
- `scripts/checks/verify-online-cloudflare-capability-abuse-control.ts`
- `scripts/checks/verify-o4p-05c-release-gates.ts`
- `scripts/checks/verify-o4p-05d-production-release-closure.ts`

No production source, dependency, package/config, generated document, ledger, workflow, or unrelated review bytes may change.

## Acceptance

Independently verify:

1. the original five full-check failures are closed by exact public-lobby registration changes only;
2. the three Cloudflare verifier hashes and O4P-05C/O4P-05D successor hash chain match current bytes without weakening protected ranges or assertions;
3. the invalidated architecture reviews and six verifiers pass and are non-vacuous;
4. TypeScript, affected ESLint, generator check, and diff check pass;
5. the staged fingerprint and loop-state identity match the frozen candidate.

Report `BLOCKER/HIGH/MEDIUM/LOW` counts. Only return `AUDIT-OK-PENDING-FINAL-FULL-CHECK` when all counts are zero.
