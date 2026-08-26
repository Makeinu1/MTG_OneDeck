# O4P-09C-UI cold-audit brief

Milestone: `O4P-09C-UI`
Risk/Audit budget: R3 / BROAD, one logical wait chain up to 45 minutes

Audit the exact candidate fingerprint supplied by the Judge against:

- `research/cr-grounding/o4p-09c-ui-production-pregame.contract.draft.md`
- `research/cr-grounding/o4p-09c-ui-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-09-shared-table-playable-roadmap.contract.draft.md`
- the pinned O4P-09C public API and repository `AGENTS.md`

Inspect adversarially: server-only randomness, atomic persistence and recovery,
authority/revision/idempotency, participant projection secrecy, other-player
hand/bottom identity leakage, reflected errors, 20-life fail-closed behavior,
2p/4p journey completeness, actor/choice gating, Local/Remote parity, single
GameScreen/no reducer fork, Solo regression, accessibility, and responsive
evidence. Do not edit files or run the release full check. Return only findings
with severity, exact path/line, violated acceptance, and minimal reproduction;
finish with BLOCKER/HIGH/MEDIUM/LOW totals and the audited fingerprint.
