# Document entry

Read only the authority that matches the change:

- [`product-requirements.md`](product-requirements.md) — product WHY/WHAT, player outcomes, shared-table UX, and Display A/B roles.
- [`../AGENTS.md`](../AGENTS.md) and [`../.agents/skills/mtg-onedeck-development/SKILL.md`](../.agents/skills/mtg-onedeck-development/SKILL.md) — outcome-first development, testing, and review rules.
- [`contracts/manifest.json`](contracts/manifest.json) — active contract ownership and verification metadata.
- [`contracts/engine/`](contracts/engine/) — engine meaning, transitions, and compiler boundaries.
- [`contracts/ui/`](contracts/ui/) — executable UI design principles, visual language, architecture, responsive, and AV boundaries.
- [`acceptance/scenarios.json`](acceptance/scenarios.json) — executable and manual acceptance registry.
- [`generated/engine-api.md`](generated/engine-api.md) — generated TypeScript export index.
- [`decisions/`](decisions/) — rationale for a contract choice.
- [`../research/cr-grounding/cr-backbone-ledger.json`](../research/cr-grounding/cr-backbone-ledger.json) — NOW and roadmap state.
- [`../research/archive/document-reset-2026-08/conflict-register.json`](../research/archive/document-reset-2026-08/conflict-register.json) — unresolved and resolved reset findings.

The document reset rationale is recorded in [`decisions/DOC-GOV-RESET-2026-08.md`](decisions/DOC-GOV-RESET-2026-08.md); current meaning lives in the active contracts listed above.

## Current solo and shared-table UI

- [`solo-ui-sep05-integration-design.md`](solo-ui-sep05-integration-design.md) — current table layout and interaction design; the September 5 reference is commit `e0c98b4`.
- [`trigger-feed-manual-integration-design.md`](trigger-feed-manual-integration-design.md) — trigger detection, Feed and manual operations; implementation, QA evidence and shipment records are in section 12.
- [`r6-ux-constitution-2026-09-16.md`](r6-ux-constitution-2026-09-16.md) — R6 UX/UI constitution v6.2: reconstruct the paper Magic table with digital Magic World + voice; preserve the strong existing solo table geometry while replacing the control hierarchy around it. This does not implement or replace R4b/R5.
- [`r6-existing-solo-layout-audit-2026-09-16.md`](r6-existing-solo-layout-audit-2026-09-16.md) — current solo/local layout audit: Preserve / Repair / Remove findings used as normative R6 design input.
- [`cockpit-ui-restoration-2026-09-13.md`](cockpit-ui-restoration-2026-09-13.md) — historical initial restoration record, superseded by the designs above.