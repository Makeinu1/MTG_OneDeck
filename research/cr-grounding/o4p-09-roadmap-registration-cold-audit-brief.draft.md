# O4P-09 Roadmap Registration Context-Free Cold Audit Brief

Date: 2026-08-25
Base SHA: `629de59eb244e6c9eeb78c3bdab29cfd15596b48`
Risk: R3 / BROAD

Read `AGENTS.md`, the development skill and document-governance reference,
`docs/judge-protocol.md` section 2, the O4P-09 roadmap contract, registration
acceptance, planned-sequence draft, ledger-update draft, live ledger,
registration cold-audit record, and registration review test. Audit the frozen
candidate without implementation context. Do not edit, stage, commit, push,
deploy, publish, use secrets/network, or run full `npm run check`.

Adversarially verify:

- the user-approved shared-table product intent is preserved without importing
  the rejected takeback-vote proposal;
- A-J are unique, synchronized, ordered, dependency-closed, and `pending`;
- A/B, D/E, and F/H avoid duplicate implementation ownership;
- shipped GameScreen/Core/visibility/combat/reconnect/TableDisplay substrate is
  reused rather than falsely claimed missing;
- hidden information fails closed until E and Spectator Table cannot receive
  audience-limited state;
- Core priority remains authoritative while assisted UI compresses procedure;
- only the steward can Resolve/Advance/UNDO, HOLD remains universal, Host is not
  promoted to game master, and takeback has no vote UI;
- O4P-08 and all earlier ledger history are unchanged;
- `GOV-CODEX-56R2-2026-08` remains audited and unchanged;
- exact historical guards admit O4P-09 without wildcarding arbitrary
  successors;
- the archived audit record exactly and honestly records the initial rejection,
  repair, clean semantic verdict, and no-ship boundary, and every O4P-09 entry
  references the exact record and semantic audit fingerprint;
- registration makes no implementation, release, deployment, or external-write
  claim and product/configuration/dependency/CR bytes are untouched;
- `codex:context` projects O4P-09A as the active-program selection.

Run the bounded O4P-09 registration review, affected historical reviews,
`npm run check:docs`, TypeScript for affected tests, affected ESLint, JSON parse,
`npm run check:forbidden -- --diff 629de59eb244e6c9eeb78c3bdab29cfd15596b48`,
and `git diff --check`. Return findings only with BLOCKER/HIGH/MEDIUM/LOW counts
and the final tree fingerprint. Use `AUDIT-OK-PENDING-FULL-CHECK` only when
BLOCKER/HIGH are zero.

## Judge preflight before cold audit

- HEAD and `origin/main` both equal the declared base SHA.
- The live ledger parses with 144 `domains` entries and 123
  `plannedSequence` entries; the ten O4P-09 entries are the only additions to
  both collections and O4P-09A is the healthy active-program selection.
- The exact seven-file registration review set passes: 7 files / 37 tests.
- Affected ESLint, `npm run check:docs`, JSON parsing, `git diff --check`, and
  the O4P-05D frozen-authority verifier pass.
- `npm run check:fast` conservatively escalated this Judge-owned roadmap change
  to the first full `npm run check`; lint, Core, DOM, build, and terminal
  verifiers all completed with exit 0. This pre-audit run is not final audited
  candidate evidence.
- `check:forbidden` reports only the expected Judge re-ownership set: O4P-09
  research/ledger files as `NEEDS-REAUTH` and exact `review.*` files as
  `FORBIDDEN`; it identifies no product-source, configuration, dependency, or
  unrelated path.
- The canonical candidate fingerprint from
  `node scripts/checks/fingerprint.mjs` is supplied separately at audit
  dispatch. The distinct `codex:context` fingerprint is used only to refresh
  the ignored loop-state checkpoint.
