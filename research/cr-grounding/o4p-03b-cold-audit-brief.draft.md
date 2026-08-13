# O4P-03B independent cold-audit brief

Milestone: `O4P-03B`

Base SHA: `c7fe4e32a0b1e8fb4ebf33b07313b1bcd08340e9`

Risk / budget: `R3 / BROAD / one bounded 45-minute wait`

Read only this brief, then the authority/evidence paths it names. Do not read an
implementation transcript or rationale. Do not edit files and do not run the
release `npm run check`.

Authority:

- `AGENTS.md` cold-auditor boundary;
- `research/cr-grounding/o4p-03b-websocket-recovery.contract.draft.md`;
- `research/cr-grounding/o4p-03b-acceptance-brief.draft.md`;
- Cloudflare Durable Object Hibernation WebSocket API current primary docs.

Candidate scope:

- diff from the base SHA;
- `src/online/cloudflare/**`;
- O4P-03B Judge review tests and verifier;
- package/machine-check registration and unchanged configuration/version/dependency boundaries.

Return findings only, classified BLOCKER/HIGH/MEDIUM/LOW, with exact path and
reproduction. Adversarially probe attachment secrecy/validation, hibernation
recreation, reauthentication identity binding, per-message capability checks,
projection privacy, same-revision CAS atomicity, duplicate outbox replay,
multi-socket close semantics, safe errors, lower-layer/reverse imports, and
O4P-03C/D scope leakage. Report a semantic fingerprint and a context
fingerprint. A clean verdict is `AUDIT-OK-PENDING-FULL-CHECK`, not ship approval.
