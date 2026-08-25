# O4P-09A context-free cold audit brief

Date: 2026-08-25
Base SHA: `0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`
Risk: R3 / STANDARD
Frozen semantic commit: `f2ba4db8bd90513ce1eb37085a1945551058e141`

Audit the frozen candidate supplied with this brief. Read `AGENTS.md`, the
development workflow, O4P-09A contract/acceptance, changed source/tests, and
the Judge review. Do not read implementer rationale. Do not edit, stage,
commit, push, deploy, access secrets/network, or run full `npm run check`.

Adversarially verify:

- the port is explicit and contains no `GameStore`, Zustand, `useGameStore`,
  generic dispatch, transport, protocol, Room, revision, or capability escape;
- all current player-surface store reach-throughs became named semantic fields
  or methods without changing their behavior;
- default Local/Solo and injected paths render the same internal surface and
  `GameScreen` remains the only player root;
- hooks are not called conditionally and the Local controller is not mounted or
  subscribed when an injected port is used;
- DnD, shortcuts, focus, overlays, guided decisions, mulligan, stack/manual,
  trigger, AV/presentation, accessibility, and shared CardView primitives are
  preserved;
- the dev-only UX recorder preserves the exact Local research checkpoint
  payload, including `pendingGuided`, but is not mounted and creates no Local
  store subscription when an injected interaction port is used;
- `CommanderRitualLayer` obtains each commander-cast cue from a named semantic
  interaction-port resolver at event time, contains no `useGameStore` or Local
  store fallback, and injected-port evidence renders the injected cue;
- no online/engine/store-semantic/protocol/dependency/configuration/CR change or
  future O4P-09B-J implementation is present;
- changed paths match the frozen boundary and protected tests were not weakened.

Governance evidence to verify, not reinterpret: the user explicitly approved
continuing this same candidate after the implementer lineage reached 164 model
cycles; the bounded correction lineage completed at 210 cycles and two
compactions. The first full-check invocation was consumed when `check:fast`
selected the release lane and stopped at stale Judge-owned UI manifest anchors.
The second passed all product/verifier evidence and exposed only the two
historical Judge guards described below. The user then explicitly approved one
third and final local full check for this same candidate.

## Judge preflight record

- Declared base `0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`
  is an ancestor of the frozen semantic commit; the base was exact
  `origin/main` when implementation began.
- Ledger projection is healthy and collection parity is 144/144 domains and
  123/123 planned-sequence entries. O4P-09A is the selected first unfinished
  member of active program O4P-09.
- The loop-state names O4P-09A; active-tree fingerprint drift is the expected
  implementation/audit transition, not a second candidate or ledger integrity
  error. The audit receives the exact frozen candidate fingerprint separately.
- `check:forbidden` classified the three-entry UI manifest reanchor plus the
  four Judge packet files as `NEEDS-REAUTH`, and the three Judge-authored
  `review.*` files as `FORBIDDEN` to implementers. The seated Judge explicitly
  re-owns those exact paths; no implementer-owned forbidden path was changed.
- The only invalidated active-contract claims were the three UI verification
  anchors whose shared evidence is `HudInteractions.test.tsx`. They are
  deterministically reanchored to the frozen semantic commit in
  `docs/contracts/manifest.json`; contract meaning and traceability are
  unchanged.
- Planned terminal metadata is limited to the audit record, exact hashes,
  final full-check/CI/Pages evidence, both O4P-09A ledger entries, and the clean
  transition to O4P-09B. It cannot alter acceptance meaning or product bytes.
- Build, affected ESLint, 71 focused DOM tests, `git diff --check`, base
  ancestry, and secret-pattern scan passed before freeze. The known execution
  environment is the repository macOS/zsh checkout; evidence contains no room
  identifiers, capabilities, invite codes, credentials, or raw private errors.

## Audit finding wave 1

The same cold-auditor lineage found one valid HIGH: the shared
`CommanderRitualLayer` still read `useGameStore.getState()` even when
`GameScreen` used an injected port. The correction is bounded to the explicit
port/controller/GameScreen/ritual layer and injected-port ordinary test. It
must preserve synchronous Local cue lookup, remove the Local-store presentation
escape, and add no Remote runtime or protocol behavior.

## Full-check finding wave 2

The second and final authorized local full check passed every verifier, lint,
all 2,093 Core tests, and 2,416 of 2,418 DOM tests. The only failures were two
historical Judge path guards that compared their old registration bases to the
live O4P-09A worktree. The bounded correction pins both guards to immutable
registration closure commit
`0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`; O4P-09 registration semantics
read the closure ledger while the live projection assertion derives the first
unshipped O4P-09 member. Re-audit that this makes the guards future-safe without
allowlisting O4P-09A product paths or weakening historical exact-byte claims.

## User-approved final local full check

The third and final authorized `npm run check` passed every verifier, docs,
lint, Core `227 files / 2,093 tests`, DOM `360 files / 2,418 tests`, TypeScript,
and Vite build in 391,325 ms at candidate fingerprint
`23d5c3cd3e88ca3b817f658ab69ec47c2139e1834ea5ac4b1411816c26cf6b7d`.
Built assets were `index-F6C4yCH4.js` and `index-B9TjsUJs.css`. No further local
full-check invocation is authorized or required for O4P-09A. Exact-head CI,
Pages publication, and final public browser evidence remain separate gates.

Run bounded architecture/component/affected evidence, ESLint, TypeScript,
`check:docs`, `check:forbidden -- --diff <base>`, and `git diff --check`.
Return findings only with BLOCKER/HIGH/MEDIUM/LOW counts and candidate
fingerprint. Use `AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero.
