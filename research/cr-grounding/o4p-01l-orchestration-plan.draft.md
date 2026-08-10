# O4P-01L Orchestration Plan (draft)

status: draft
milestone: O4P-01L
name: Control, Search, Rule Visibility, Play Permission & Decision Authority V1
parent: Online Four-Player Commander MVP
baseSha: 7a205685be1e6e447f748f6b8b6865b8db25c540
requiredAncestor: 92eefdc75f66d3a79efdc043de1b9d76ad90f379
kShippedSha: 1ec68c2df5189451ca2e08e843b3c5a11ce2419a

## Authority and boundary

This is a judge-owned orchestration draft for the user-authorized O4P-01L
exception. The brief names seven grounding lanes (`R` plus `A` through `F`);
they run in two waves with at most six lanes concurrently, in independent
worktrees. Every lane receives only its lane brief, uses `fork_context: false`,
does not use git, and does not edit `AGENTS.md`, `docs/**`, the ledger,
`review.*`, `package-lock.json`, or dependency metadata.

The milestone adds a mode-neutral `CoreRuleAuthorityBundleV1` around the
shipped `CoreTurnPriorityBundleV1`. It owns control effects and continuity,
rule-visibility queries, search-session lifecycle, play-attempt permissions,
and decision authority. It does not create network projections, UI, commands,
events, combat, player exit, Cloudflare, WebSocket, or Online runtime.

The pinned CR is the local `2026-06-19` ruleset. The grounding lanes record
CR-backed structure and queries only; they do not introduce a full CR 613
dependency evaluator. Layer-2 order remains explicit caller-owned data.

## Grounding lanes (Wave 1, six concurrent slots; seventh lane follows)

| lane | role | draft | write boundary |
| --- | --- | --- | --- |
| O4P-01L-R | Requirements Analyst | `o4p-01l-r-control-access-cr-matrix.draft.md` | research draft only |
| O4P-01L-A | Architecture Analyst | `o4p-01l-a-solo-control-access-reuse.draft.md` | research draft only |
| O4P-01L-B | Domain Analyst | `o4p-01l-b-control-effect-continuity.draft.md` | research draft only |
| O4P-01L-C | Domain Analyst | `o4p-01l-c-visibility-search.draft.md` | research draft only |
| O4P-01L-D | Domain Analyst | `o4p-01l-d-play-permission.draft.md` | research draft only |
| O4P-01L-E | Domain Analyst | `o4p-01l-e-decision-authority.draft.md` | research draft only |
| O4P-01L-F | Architecture Analyst | `o4p-01l-f-cross-slice-bundle.draft.md` | research draft only |

R is the CR/access matrix. A records existing Solo reuse and rejection
boundaries. B covers controller derivation, explicit effect order, duration,
continuity, and source/zone boundaries. C covers look/reveal, hidden zones,
candidate snapshots, and searcher/selector visibility. D covers attempt
permissions while keeping timing/card-type/cost legality deferred. E separates
rules actor, controlled player, active player, and decision maker. F checks
cross-slice validation order, atomicity, canonicalization, and future command
and projection boundaries.

## Implementation waves

1. Freeze the CR-backed additive contract after grounding. Preserve Object
   Registry V2, Object Runtime V2, Stack Announcement V1, Stack Transaction
   V1, Turn Priority Bundle V1, Solo GameState/Snapshot, and contract versions.
2. Implement rule-key, zone-reference, duration, shared validation, and error
   foundation.
3. Implement Control and Decision Authority in separate write lanes.
4. Implement Visibility and Play Permission in separate write lanes.
5. Implement Search Session lifecycle serially against the access lanes.
6. Integrate the six-area Rule Authority Bundle and lifecycle operations.
7. Add fixture/scenario and architecture-boundary assets, then integrate public
   exports, verifier, and machine-check registration.

Each implementation lane remains `implemented-not-integrated` until judge
integration. Acceptance review tests are judge-owned and are not edited by
implementers. A candidate is frozen before the independent cold audit; the
full check runs only after audit findings are closed on the same fingerprint.

## Explicit DEFER

Network/Table/Spectator projection, WebSocket, Cloudflare, authentication,
revision/commandId, UI/Search UI, CardDef/Oracle search criteria generation,
card movement, shuffle, reveal events, cast/play commands, timing and cost
legality, combat, commander rules, player concession/exit, typed
Command/Event, deterministic randomness, replay, full CR 613 dependency
evaluation, continuous-effect layers beyond the explicit control order, and
all Online runtime remain outside O4P-01L.

## Gate sequence

Gate 0B activates the existing pending O4P-01L entries without adding or
reordering entries. Grounding drafts feed a judge-owned contract draft. The
contract is frozen before implementation. After integration, targeted tests,
review tests, architecture tests, fixture checks, and the verifier must pass.
The cold auditor receives only the audit brief and returns findings. BLOCKER or
HIGH findings prohibit shipping. Release requires final `npm run check`,
`npm run check:forbidden`, CI success, Pages HTTP 200, and clean worktree.
