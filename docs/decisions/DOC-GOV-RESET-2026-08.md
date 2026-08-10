# DOC-GOV-RESET-2026-08 decision record

## Decision

Active contracts contain current meaning only. Release evidence, lifecycle labels, implementation notes, old line references, and working notes are kept in the ledger, decisions, or `research/archive/document-reset-2026-08/`.

The contract manifest is the single authority index. One active contract owns each authority. Acceptance uses a globally unique scenario registry, fixed fixtures for ordinary checks, and a separate online lane for live Scryfall.

The release machine check owns one production build. The Pages workflow supplies its base path to that build and uploads the resulting `dist`; it does not invoke a second build. CI forbidden-file checking receives an explicit diff base.

## Boundaries

This decision changes document organization and verification orchestration only. It does not change React behavior, engine commands, GameState meaning, CR interpretation, tests' assertions, dependencies, audio, images, publication, or external services.

The turn-one draw, hand-size wording, and old/new UI lineage remain recorded as conflicts or archive material where the available evidence does not give a unique semantic ruling. They are not used to justify a product change.
