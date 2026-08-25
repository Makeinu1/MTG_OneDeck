# O4P-09A context-free cold audit brief

Date: 2026-08-25
Base SHA: `0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`
Risk: R3 / STANDARD

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
- no online/engine/store-semantic/protocol/dependency/configuration/CR change or
  future O4P-09B-J implementation is present;
- changed paths match the frozen boundary and protected tests were not weakened.

Governance evidence to verify, not reinterpret: the user explicitly approved
the completed implementer lineage at 164 model cycles for this candidate only.
The first of at most two full-check invocations was consumed when `check:fast`
selected the release lane and stopped at stale Judge-owned UI manifest anchors;
the final full check has not run.

Run bounded architecture/component/affected evidence, ESLint, TypeScript,
`check:docs`, `check:forbidden -- --diff <base>`, and `git diff --check`.
Return findings only with BLOCKER/HIGH/MEDIUM/LOW counts and candidate
fingerprint. Use `AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero.
