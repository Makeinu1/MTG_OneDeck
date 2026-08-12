# O4P-02A cold audit record — 2026-08-12

## Candidate

O4P-02A adds an observational Solo/Core compatibility boundary. It validates
an explicit bijective identity map, projects the existing Solo `GameState` and
shipped `ModeNeutralCoreRootV1` into a closed comparable view, and returns
deterministic parity evidence without changing either transition authority.
Lossy, Solo-only, Core-only, unsupported, snapshot-migration, Room, protocol,
projection, network, UI, and mixed-authority behavior remain explicit DEFERs.

Base SHA: `e1a71beac93f4882827bd8138990360840363a29`.

## Initial cold audit and repair

Independent Luna auditor `019ff38b-eff8-7eb0-83bf-d35773eb76dc` recomputed and
matched initial fingerprint
`c742841111401e00eab10d670e23e48b324398000c2461da11aa3db0c006a4e7`.
It changed no files and reported two HIGH findings:

- `O4P-02A-HIGH-001`: the standalone verifier was not registered in the checks
  TypeScript project, so direct ESLint could not type-load it;
- `O4P-02A-HIGH-002`: Core combat projection copied combat player/object IDs
  without requiring every reference in the identity map.

The Sol judge added the verifier to `scripts/checks/tsconfig.json`, added exact
Core combat player/object map validation and deterministic issue paths, and
added a regression vector that removes an active combat object from an
otherwise valid map. Direct verifier ESLint, targeted tests, both affected
verifiers, lint, build, and diff check passed after repair.

## Final cold-audit verdict

Fresh-context Luna re-auditor `019ff397-2c2b-7da1-bbb5-a8447c9c94e4`
recomputed and matched replacement candidate fingerprint
`cd82724d7007c645b35b9fea58205f0edd1d8abf81c5d0c47b36dc3085fc3dd4`
before this archive record was appended. It changed no files and reported:

- BLOCKER: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0

Final verdict: `AUDIT-CLEAR`.

The re-auditor independently reproduced distinct Solo/Core identity mapping,
the repaired Core combat omission paths, compatibility/O4P-01N/review/
architecture/snapshot suites, both verifiers, direct verifier ESLint, full
lint, build, and `git diff --check`. The existing chunk-size warning is
unchanged. The forbidden scan reported only the expected judge-owned candidate
paths requiring release reauthorization; it was not a semantic audit finding.

The release full `npm run check` was intentionally not run before this clear
verdict. The next gate is one full check on the release tree, followed by
publication metadata and git operations only under user publication authority.

## Publication re-audit and bounded repair

After the generated API refresh and documentation whitespace cleanup, fresh
Luna auditor `019ff3f1-fbc7-7be0-8ce7-e679b4794ecc` matched fingerprint
`5cfd2648f1f9ab3ee894f6b2b7eefb8ea376f5c9b8268bbccf740f3f9aa07e88`.
It reported one HIGH and two MEDIUM findings:

- `O4P-02A-HIGH-003`: an object map could cross-link a Solo physical card to
  a different Core physical card than the physical-card map;
- `O4P-02A-MEDIUM-001`: a hostile `cards` source could suppress independent
  active-player and turn issues;
- `O4P-02A-MEDIUM-002`: the checks TypeScript project exposed five new
  compatibility-verifier errors and three pre-existing closure-verifier type
  errors.

The same Luna implementer, `019ff350-84dd-7330-87af-ec5e252617ec`, performed
a bounded repair. Identity-map normalization now verifies Solo and Core object
physical identity in both directions with exact deterministic issue paths.
Solo projection inspects independent active-player and turn fields before
trap-prone card data. The compatibility verifier and closure verifier received
type-only corrections and now pass the checks TypeScript project. Ordinary
regressions cover cross-linked maps and revoked/trapping card sources.

Post-repair evidence before the replacement audit:

- compatibility implementation and judge tests: 3 files, 35 tests PASS;
- `npx tsc -p scripts/checks/tsconfig.json --noEmit`: PASS;
- `verify:solo-core-compatibility`: PASS;
- `verify:mode-neutral-core-closure`: PASS;
- generated engine API refreshed;
- `git diff --check`: PASS.

The candidate remains unshipped until a replacement cold audit clears the
changed claims and the final release full check passes.
