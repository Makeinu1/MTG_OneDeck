# O4P-09C context-free cold audit brief

Date: 2026-08-25
Base SHA: `5f62a8f6730fd7a758d8b284ba818cf19f09c347`
Risk: R3 / BROAD
Audited candidate fingerprint:
`e641bbf45fbce0a8e13e7da9439bb0780327d37c5f779bcc98625340405b1bac`
Semantic commit: recorded later in terminal ledger evidence by the Judge

Audit only the fingerprinted frozen O4P-09C candidate supplied with this brief.
Read `AGENTS.md`, the development workflow, O4P-09C contract/acceptance, changed
source/tests, and Judge review. Do not read implementer rationale. Do not edit,
stage, commit, push, deploy, access secrets/network, or run the full
`npm run check`.

Adversarially verify:

- local CR 103.1-103.8, 800.5-800.7, and 903.1-903.7 support every frozen
  two/four-player truth-table edge, especially free mulligan and first draw;
- the trusted plan is exact, bounded, a complete per-player physical-card
  permutation set, persisted/replayable, server-only, and never client chosen;
- virgin-state, 40-life, roster/rotation/commander/library/lifecycle invariants
  fail closed without mutating input or demoting a live authority session;
- commander/APNAP/mulligan/bottom/manual/readiness phases and current actor are
  exact; mulligan waves and bottom placement are atomic and keep/zero locks hold;
- Core setup preserves object/runtime/root invariants, canonical reincarnation,
  zero opening `drawnThisTurn`, total mulligan counts, and accepted count zero;
- Core root validation permits only a duplicate-free permutation of the same
  Registry/lifecycle player set as turn order, without weakening ordered
  Commander/damage/provenance or player-activity relations;
- envelope graphs, nested arrays/descriptors/proxies, authority, revision,
  duplicate, reuse, stale, and plan-exhaustion cases fail safely and leak no
  private errors or hidden identities;
- ACK/REJECT keys, bounded code/path union, application-ID/capability grammar,
  stale-only resync, authority-before-duplicate, and 256-entry journal capacity
  are exact;
- journal replay exactly reproduces accepted state and duplicate/rejected
  commands cannot create hidden mutation or extra journal entries;
- the manual marker is bounded and semantic-free and cannot carry arbitrary
  text, card identity, a Core command, patch, callback, or Oracle automation;
- final activation yields a valid existing Protocol V2/root relation and no
  premature active Room or post-completion mutation is possible;
- `first-turn-draw-skip` is exact, replayable, two-player/turn-one/upkeep-ready
  only, jumps to precombat main with no draw, and cannot weaken four-player
  normal draw or other turn gates;
- participant/table projections reuse the shipped v3 projector and contain no
  plan/library order/pending bottoms/capability/digest/journal/raw root/internal
  receipts/private error or opponent hidden identity;
- the narrow v1/v3 validator correction accepts a duplicate-free permutation
  of seated players as turn order without weakening seat order, projected
  player/zone order, descriptor, or visibility validation;
- no existing genesis, Room, Protocol, Projection constructor/visibility,
  Application, runtime, transport, UI/store, dependency/version/configuration,
  CR, or O4P-09D-J product semantics entered the candidate beyond the expressly
  authorized turn-order validator relation; and
- changed paths match the frozen boundary; the only generated documentation
  path is `docs/generated/engine-api.md`; and Judge/protected tests were not
  weakened beyond exact Pregame module/import registration.

Run bounded Judge/ordinary Core and Pregame evidence, focused existing
Core/Protocol/Projection tests, affected ESLint, TypeScript, `check:docs`,
`check:forbidden -- --diff <base>`, secret-pattern scanning, and
`git diff --check`. Return findings only with BLOCKER/HIGH/MEDIUM/LOW counts and
candidate fingerprint. Use `AUDIT-OK-PENDING-FULL-CHECK` only when
BLOCKER/HIGH are zero.
