# CR Grounding authority boundary

This directory contains CR-grounding research, roadmap provenance, historical program records, fixtures and adjudication evidence.

For **current project state on `main`**, `docs/project-state/index.json` is the canonical NOW authority. The generated restart view is `docs/generated/project-state.md`.

`research/cr-grounding/cr-backbone-ledger.json` is retained as roadmap/provenance/history. Historical fields or prose inside that ledger such as `activeProgram`, planned sequence, `nextGate`, "next slice", autoloop selection rules, or older statements that call the ledger a "single source of truth" describe the program at the time they were recorded. They **must not select current work or override Project State NOW**.

The same rule applies to historical current/next wording in `research/cr-grounding/README.md` and `research/cr-grounding/project-goal-milestones.md`. Those documents retain CR-grounding rationale and historical milestone context, but any embedded "current", "next", planned-sequence, or "single source" statement is superseded for project-NOW selection by `docs/project-state/index.json`.

Use the ledger and these historical planning documents only when Project State or an active contract points to them for CR scope, historical rationale, evidence, or adjudication context. Current milestone, next gate, pending judgment, and work selection come from Project State unless an active authority explicitly delegates a narrower question elsewhere.
