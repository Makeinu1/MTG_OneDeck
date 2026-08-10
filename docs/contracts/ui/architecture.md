# UI architecture

<!-- clause: UI-ARCH-001 -->
React components render projections of immutable store snapshots. Commands and store actions own state transitions; components do not mutate engine state directly.

<!-- clause: UI-ARCH-002 -->
The primary game surface, dialogs, action sheets, and compact controls expose the same semantic operation through layout-appropriate surfaces. Browser-only concerns stay at the UI boundary and never enter `src/engine/`.

<!-- clause: UI-ARCH-003 -->
A visual event may be scheduled after a successful commit. Presentation code consumes the event stream and may omit a cue under browser policy or reduced-motion settings without changing the command result.

<!-- clause: UI-ARCH-004 -->
The contract manifest and acceptance scenarios are the traceability index for this architecture.
