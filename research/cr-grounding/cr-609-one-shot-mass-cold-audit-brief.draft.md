# cr-609-one-shot-mass cold-audit brief

Audit the frozen candidate for `cr-609-one-shot-mass` without editing files.

Read only the repository governance, `docs/engine-spec.md` §34.52, `docs/acceptance.md` G8, the pinned local CR clauses 608.2c/f/h, 609.1/609.3, 701.8, 702.12b, 704.5f/g/h, the candidate diff, and relevant tests. Confirm the exact frozen fingerprint provided by the judge before auditing.

Required adversarial focus:

- destroy versus generic move semantics and effective indestructible;
- pre-state freezing when a type/keyword/replacement source is itself destroyed;
- deterministic candidate ordering, duplicate ids, stale/nonbattlefield ids;
- one destroy simultaneousGroupId and later separate SBA groups;
- owner graveyard, commander choice bridge, token cease, death trigger;
- Ruinous multiplayer controller complement and Pernicious announced X including zero;
- all-or-nothing compiler decisions for Culling Ritual, damage, -X/-X, regeneration suffix, unknown/optional/partial constructs;
- target destroy/Feed the Swarm LKI non-regression;
- atomic guided resolution and one-step undo/redo;
- no GameState/schema/dependency/general applyCommands drift.

Run targeted review/adversarial evidence only, not the full `npm run check`. Return findings classified as BLOCKER/HIGH/MEDIUM/LOW with file:line evidence. If BLOCKER/HIGH are zero, return `AUDIT-OK-PENDING-FULL-CHECK` and the audited fingerprint.
