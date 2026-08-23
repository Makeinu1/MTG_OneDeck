# O4P-08B Prototype Implementer Brief

Milestone: `O4P-08B` prototype gate only
Base SHA: `2cde9a6d69eaa12c54ca60ef1c63444c24486b1a`

Read `AGENTS.md`, the O4P-08 roadmap contract, the O4P-08B contract, and the
prototype section of the acceptance brief. You own only:

- `src/dev/onlineLobbyPrototype/**`

You are not alone in the codebase. Preserve other edits and do not revert them.
Do not edit product `App`, `PublicOnlineApp`, any non-dev online source, tests
outside your owned dev folder, docs/research/ledger/review files, dependencies,
configuration, git state, or generated artifacts.

Build a deterministic, production-disconnected React fixture using real global
design tokens. It must expose controls to switch among deck choice, entry,
recovery, host lobby, guest lobby, and error states, and render the exact copy,
hierarchy, blockers, host utilities, and privacy boundary in the contract.
Provide normal tests for state switching, no secret/internal-ID text, current
step, blocker visibility, host/guest moderation boundary, and semantic labels.

Do not call fetch, IndexedDB, localStorage, clipboard, Worker, Scryfall, or game
stores. Do not implement product behavior. Report changed files, targeted test,
lint/type result, responsive concerns, and deferred product work.
