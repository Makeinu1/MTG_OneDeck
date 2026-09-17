# CR Grounding authority boundary

This directory contains CR-grounding research, roadmap provenance, historical program records, fixtures and adjudication evidence.

For **current project state on `main`**, `docs/project-state/index.json` is the canonical NOW authority. The generated restart view is `docs/generated/project-state.md`.

`research/cr-grounding/cr-backbone-ledger.json` is retained as roadmap/provenance/history. Historical fields or prose inside that ledger such as `activeProgram`, planned sequence, `nextGate`, "next slice", autoloop selection rules, or older statements that call the ledger a "single source of truth" describe the program at the time they were recorded. They **must not select current work or override Project State NOW**.

Use the ledger only when Project State or an active contract points to it for CR scope, historical rationale, evidence, or adjudication context. Current milestone, next gate, pending judgment, and work selection come from Project State unless an active authority explicitly delegates a narrower question elsewhere.
