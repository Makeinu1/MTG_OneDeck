# O4P-08 Roadmap Registration Context-Free Cold Audit Brief

Date: 2026-08-23
Base SHA: `2973e60942623d57e6af53a5e36cb488a26f56b7`
Risk: R3 / BROAD

Read `AGENTS.md`, the development skill and document-governance reference,
`docs/judge-protocol.md` section 2, the O4P-08 roadmap contract, registration
acceptance, planned-sequence draft, ledger-update draft, and registration
review test. Audit the frozen candidate without implementation context. Do not
edit, stage, commit, push, deploy, use secrets/network, or run full `npm run check`.

Adversarially verify that the explicit user rulings are complete and
non-contradictory; A-D are unique, synchronized, ordered, and dependency-closed;
O4P-07 and all earlier history are unchanged; registration makes no product
claim; runtime/dependency/config bytes are untouched; exact historical guards
admit O4P-08 without wildcarding successors; and `codex:context` projects A.

Run bounded registration review, docs check, TypeScript, affected ESLint, JSON
parse, and `git diff --check`. Return findings only with BLOCKER/HIGH/MEDIUM/LOW
counts and the final tree fingerprint. Use `AUDIT-OK-PENDING-FULL-CHECK` only
when BLOCKER/HIGH are zero.

## Terminal CI ownership reauthorization supplement

After the audited semantic commit, audit only the appended terminal evidence in
the adjacent archived audit record against local git bytes and the recorded
exact-head workflow facts. Do not edit, stage, commit, push, deploy, access
secrets, or run the full check.

Confirm semantic HEAD `f3a9b80beebf6dc61c6536455174a9df5cfc37fe`
equals its recorded candidate, its parent/diff base is
`2973e60942623d57e6af53a5e36cb488a26f56b7`, and workflow run `32645311499`
job `97208565337` passed the exact-head full check before stopping only on the
five Judge `review.*` paths. Recompute every candidate SHA-256 in the record and
reject a missing or additional protected path. Confirm Pages was skipped and
the proposed metadata commit changes only this brief and the adjacent audit
record, with no product, ledger, review, dependency, workflow, or configuration
change. Return counts and the exact approval identifier only when exact.
