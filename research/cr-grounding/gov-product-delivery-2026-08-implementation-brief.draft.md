# GOV-PRODUCT-DELIVERY-2026-08 implementation brief

Milestone ID: `GOV-PRODUCT-DELIVERY-2026-08`

Base SHA: `8b906a888facc49213f51071d660f42098cc174c`

## Goal

Separate the approved product requirements from the approved development
operating policy and establish each as a single current authority before
O4P-09F starts. Repair the observed late-release-authority deadlock with one
hash-linked user-ruling epoch, expose the existing release workflow through a
thin reusable skill, and ship this same bounded second substrate before
returning directly to O4P-09F.

## User ruling amendment (2026-08-29)

The user explicitly authorized one self-hosted governance repair and the
end-to-end release after the first audited candidate exposed that its original
false external-authority bits could not be elevated without rewriting history.
The repair may append one user-ruling authority/acceptance epoch, reopen the
same candidate for re-audit, and grant local write, commit, push, deploy, and
ship authority for this domain only. Earlier supervisor events, counters,
lineages, waits, and receipts remain immutable.

## Constraints

- Do not change product source, product tests, dependencies, the pinned CR,
  runtime behavior, or shipped milestone evidence. Governance scripts and
  their ordinary tests may change only for the approved self-host repair.
- Do not implement O4P-09F or silently change the F-J product boundaries.
- Product requirements own WHY and WHAT. Delivery policy owns HOW progress is
  produced and judged. Detailed mechanics remain in document governance.
- Avoid duplicate authority. Existing documents must point to the new authority
  or retain only a clearly scoped summary.
- Preserve one-screen completion, secret-safe projections, Mode-Neutral Core,
  guided/manual honesty, and all external-authority boundaries outside this
  exact user-ruling epoch.
- Do not rewrite or truncate the existing supervisor-event prefix, reset
  counters, add a second role lineage/wait chain, or grant authority to later
  O4P-09 domains.
- The release skill must route to document governance and existing executable
  gates. It must not create a parallel state machine or duplicate release
  policy.

## Done when

- One canonical `docs/product-requirements.md` records the product position,
  near-term player outcome, shared UI system, attention model, Display A/B
  roles, Arena-relative quality target, accessibility, and explicit non-goals.
- One canonical
  `.agents/skills/mtg-onedeck-development/references/delivery-policy.md`
  records outcome-first progress,
  design ownership, prototype-before-implementation, risk-scoped audit,
  targeted iteration, one final full check, role separation, STOP boundaries,
  and compact reporting.
- `AGENTS.md`, `docs/README.md`, and document governance state the authority
  split without contradictory restatement. The engine/UI contract manifest is
  not expanded because these documents own product and delivery policy rather
  than executable engine/UI clauses.
- `npm run check:docs` and focused self-review pass.
- One executable user-ruling transition proves that an audited candidate can
  append a monotonic authority/acceptance epoch, become implementing again,
  preserve the old immutable event prefix, and fail closed for malformed,
  downgraded, unverified, or non-user authority changes.
- The clean-CI forbidden scan can verify this domain's first semantic commit
  when its active supervisor record is introduced in that same diff. The
  bootstrap must be supervisor-authored, fully verified from its declared
  base, tied to a newly inserted governance successor and exact Judge-owned
  bytes, and contain the single retained user-ruling epoch before `AGENTS.md`
  can pass. `CLAUDE.md`, `eslint.config.js`, other-domain records, caller
  allowlists, and malformed or stale proof remain hard failures.
- Because this repair follows an unpublished audited semantic commit, its
  exact guard acknowledgement still covers the cumulative diff from the
  original release base. The candidate base remains the semantic commit; the
  alternate guard base is admitted only through the retained `ci-environment`
  predecessor with zero prior pushes and no release-head binding. After the
  one exact release head is bound, later gates may only re-verify the same
  frozen acknowledgement; they cannot refresh or expand it.
- After a release commit fixes `HEAD`, a clean checkout without volatile loop
  state must recover a raw guard acknowledgement only from a fully verified
  tracked supervisor authority whose latest candidate, sequence, and hash
  match the healthy context projection. Keeping `headSha` in the report, it may
  accept only the already defined exact-equivalence case where report identity
  changed but acknowledged paths, owners, bytes, guard references, predecessor
  references, candidate identity, and tree fingerprint did not. Missing,
  wildcard, rewritten, byte-drifted, or structurally different proof remains
  hard-red.
- One canonical `.agents/skills/mtg-onedeck-release/SKILL.md` provides
  `prepare`, `ship`, `resume`, and `verify` routing without granting external
  authority, and `.claude/commands/ship.md` is a compatibility pointer to it.
- A fresh-context R3/BROAD cold audit reports BLOCKER/HIGH 0 on the expanded
  frozen candidate; the same fingerprint then passes `npm run check`.
- Explicit staging and an audit-identified commit reach `origin/main`; the
  exact release HEAD passes CI and Pages/assets verification, terminal metadata
  closes cleanly, and the next selected domain is O4P-09F.

## Draft ownership

The existing implementer lineage may write only these files:

- `research/cr-grounding/gov-product-delivery-2026-08-product-requirements.draft.md`
- `research/cr-grounding/gov-product-delivery-2026-08-delivery-policy.draft.md`
- `research/cr-grounding/gov-product-delivery-2026-08-release-skill.draft.md`
- `scripts/codex-program-step.mjs`
- `scripts/codex-context.mjs`
- `scripts/lib/supervisor-authority.mjs`
- `scripts/lib/supervisor-state.mjs`
- `scripts/checks/forbidden-files.mjs`
- `scripts/checks/guard-impact.mjs`
- `scripts/__tests__/governanceSupervisor.test.mjs`
- `scripts/__tests__/codexContext.test.mjs`
- `scripts/__tests__/forbidden-policy.test.mjs`

The implementer must not change `AGENTS.md`, `docs/**`, `.claude/**`, the
ledger, `.agents/**`, `review.*` tests, git state, or supervisor metadata. The
Judge adjudicates and publishes the canonical skill, compatibility entry,
authority amendment, and evidence. The cold auditor edits nothing.

This ownership boundary forbids the implementer from directly editing or
executing mutations against Judge-owned files. It does not forbid implementing
and testing a Judge-invoked command whose specified runtime transaction updates
the synchronized ledger, loop state, and tracked supervisor event. Only the
Judge may invoke that command against the real candidate.

## Frozen source decisions

### Product

- Immediate player outcome: complete a recognizable production two-player
  match while preserving four-player continuity; improve Solo more gradually
  after that proof.
- Progress means a visible production player journey, not headless substrate,
  governance completion, or test volume by itself.
- OneDeck combines physical Commander table spatiality with Arena-grade
  clarity, card presence, feedback, motion, and audio. Arena is a temporary
  comparative 100-point reference, not a requirement to copy its duel layout
  or automate every rule.
- Share the normalized tabletop model, cards, lanes, stack, target lines,
  decisions, status, motion, and audio. Solo, two-player, four-player, and
  public-map views may compose those assets differently.
- The UI directs attention: stable self-board memory and peripheral opponent
  awareness in ordinary play; stack/priority causality becomes the shared
  focus during responses; combat and post-resolution changes temporarily take
  focus without spatially reshuffling the table.
- Display A is each player's private, action-authoritative cockpit. It keeps
  the player's board and hand primary, opponent public summaries inspectable,
  and the complete match journey available without Display B.
- Display B is an optional read-only public table map over public projection
  data. It preserves stable seats and shows public boards, stack, priority,
  targets, combat, and recent changes. Losing B never interrupts play.
- Exact area ratios, breakpoints, density thresholds, timing, and transition
  values are prototype-derived design variables, not user-authored contract
  numbers.
- First-release comparative quality: every major UI category at least 70/100
  against the Arena reference; the complete-match journey at least 80/100.

### Delivery

- The user decides Goal, Done when, scope, acceptance quality, North-Star
  changes, and irreversible/external authority. The delivery system owns model,
  effort, tools, layout details, prototypes, implementation mechanics, repair,
  and audit allocation inside that envelope.
- Use targeted checks while iterating, one risk-scoped independent audit on a
  frozen candidate, and one final full check. Repeat only evidence invalidated
  by a concrete finding or repair.
- Hard stops cover secret leakage, authorization violation, shared-state
  corruption, deck loss, unrecoverable desynchronization, and inability to
  complete the core journey. Rare CR edges with honest manual fallback and
  minor polish outside the target may remain beta limitations.
- UI design is not delegated to the user as pixel approval. Use suitable
  product-design and playtest skills, observable references, real-size
  prototypes, and independent fresh-context visual review.
- A short deterministic production scenario proves land, cast, HOLD,
  response/resolve, combat, secret choice, manual fallback, reconnect,
  elimination, and winner before broad refinement.
- Governance, audit, telemetry, and substrate remain supporting work and are
  reported separately from player-visible progress.
