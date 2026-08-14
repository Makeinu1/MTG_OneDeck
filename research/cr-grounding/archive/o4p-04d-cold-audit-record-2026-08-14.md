# O4P-04D cold audit record

Milestone: `O4P-04D` Guided / Manual Actions

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Implementer: `/root/o4p04d_luna_implementer` (`gpt-5.6-luna`, xhigh,
`fork_turns: none`)

Cold auditor: `/root/o4p04d_cold_auditor` (`gpt-5.6-sol`, xhigh,
`fork_turns: none`)

## Candidate and targeted evidence

The additive Guided / Manual Actions boundary builds a fresh frozen safe view
from the public Personal Projection, creates seven closed action variants, and
binds only the four guided command attempts to existing public Core/protocol
envelopes. Face-down notes, life correction requests, and Commander-damage
correction notes remain explicitly manual-only and unbindable. Projection,
Core, protocol, Room, Cloudflare, Solo, and root App semantics were unchanged.

The Luna implementer used both bounded correction returns:

1. wrapped the deterministic dev-fixture evidence output so the exact mobile
   viewports retain horizontal overflow 0 without hiding or truncating data;
2. invalidated form/confirmation state on complete safe-view drift, revalidated
   a confirmed action immediately before emission, and closed the public
   binding-input TypeScript fields.

The Judge separately added the frozen contract/acceptance evidence, hostile
`review.*` tests, exact successor architecture registrations, and one bounded
architecture-test surgery. The surgery requires the exact four production
files under `src/online/guidedActions` and scans both `.ts` and `.tsx`, closing
an independently demonstrated extension-based fake green. Runtime bytes were
not changed by that surgery.

After the final surgery, the complete combined model, component, predecessor,
and architecture set passed 14 files / 63 tests. Scoped ESLint,
`npx tsc -b`, and `git diff --check` passed. The release `npm run check` was
not run before the final cold-audit verdict.

## Browser evidence

One stable in-app browser session rendered the deterministic dev fixture at
exact 375x812, 812x375, and 1440x900 viewports. At each viewport all five
Guided / Manual sections were present and scroll-reachable, horizontal
overflow was 0, app-owned fixed elements were 0, and console errors were 0.
The two manual-boundary labels remained visible. The guided confirmation
emitted no action before confirmation and exactly one `apply-control` action
after confirmation. The browser-owned Codex sidebar overlay was excluded from
app-owned fixed-element counts.

## Initial cold audit

Initial frozen fingerprints:

- semantic: `b4832f8a5090ce8da94dba7413ec022ffe4eed15e7843ca54acf7c03363bead7`;
- context: `589be34eaa5b6ffdba03ad7ee892009cfc386e7452b73c25de5b01282bc24724`.

Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 2 / LOW 0,
`AUDIT-FIX-REQUIRED`.

- HIGH: a confirmed control action survived same-reference, same-revision
  candidate drift;
- MEDIUM: the public binding-input type accepted an unclosed action and broad
  command ID;
- MEDIUM: the dev-fixture allowlist could admit an unscanned ambient-effect
  file.

Both Luna corrections and the Judge-owned stale-state regression closed these
findings. The first re-audit matched semantic fingerprint
`12b935f8c16ae4328570caf730a8e2825461b95933ff06bf26a74d78051ff4f0`
and context fingerprint
`27241d1a8176fd70ee9016cfefd114e19b96dfed1c4cdab266668026cceb2017`.
It confirmed the three findings closed and reported one new MEDIUM: the pure
module scan excluded `.tsx` while the path allowlist accepted it.

## Final cold re-audit

Final frozen fingerprints:

- semantic: `22c999cb63c63b7e84f2fa5bc8a173e74b4a3bc848593dd3711540a54a8675a9`;
- context: `4156d9ef3605041e905a9bea583d1d949be283463e0b5b793e82245a1caff4c6`.

The same independent auditor matched both fingerprints before inspection and
before return. The complete 14-file / 63-test set, scoped ESLint,
`npx tsc -b`, and diff check passed. Direct adversarial probes demonstrated
that the original malicious `ambient.tsx`, a harmless extra `.ts`, and a
harmless extra `.tsx` now each fail the exact production-set gate while the
frozen tree passes.

Final verdict:

```text
BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
AUDIT-CLEAR
```

Release state at record creation is `AUDIT-OK-PENDING-FULL-CHECK`. Candidate
commit, contract-verification reanchor, fingerprint-matched local full check,
exact-head CI, Judge reownership, Pages evidence, terminal ledger promotion,
and clean-worktree evidence remain pending and must be appended only after
they actually pass.

## Contract reanchor and local full-check repair

Candidate commit `3e87dd25b5e218669645f40a9e8a2096b5c9051c` fixed the
modified `soloOnlineBoundary.test.ts` evidence. The Judge changed only
`CONTRACT-ENGINE-MULTIPLAYER.lastVerifiedCommit`, added the exact manifest path
to the O4P-04D candidate gate, and recorded the authority. The same auditor
verified the candidate/working-tree evidence blob and reanchor diff at
BLOCKER/HIGH/MEDIUM/LOW 0/0/0/0. The targeted set passed 14 files / 63 tests,
plus docs, lint, TypeScript, and diff checks.

The first formal local full check passed every verifier, docs, lint, and Core
226 files / 2,086 tests. DOM passed 299 of 300 files and 2,079 of 2,080 tests,
then an existing O4P-03D real-SQLite recovery test completed in about 33.2
seconds and exceeded its explicit 30-second limit. The bounded repair changed
only that final timeout to 60 seconds and registered its exact predecessor
review filename in the three O4P-04B/C/D candidate gates. Test callback,
fixtures, body, and assertions were unchanged. The complete repaired targeted
set passed 15 files / 76 tests, and the independent repair audit returned
0/0/0/0.

The second and final authorized local full check passed CR/version/docs and all
registered verifiers through O4P-03C, then the O4P-03D verifier correctly
stopped on its stale frozen Judge-file hash before lint, tests, or build. The
Judge refreshed only that one hash literal to the audited 60-second file hash
and registered only the exact verifier filename in the three candidate gates.
The verifier, 4 files / 26 tests, docs, scoped lint, TypeScript/Vite build, and
diff check passed. Independent authority-hash repair audit returned 0/0/0/0.
No third local `npm run check` was run or authorized; exact-head CI became the
complete release gate.

## Candidate exact-head full check and Judge reownership

The audited candidate `7207073b3ef88edcc3549f6cf4f7b39fdb63b066` was
published to `main`. Exact-head GitHub Actions run `31812534014` passed
`npm run check -- --build-base=/MTG_OneDeck/`: every verifier, docs, lint,
Core 226 files / 2,086 tests, DOM 300 files / 2,079 passed + 1 skipped = 2,080
tests, TypeScript, and Vite build were green. It produced
`assets/index-CyZgN26K.js` and `assets/index-JeU5vEot.css`.

The run resolved the expected diff base
`1f6a465b859ba64c9961c6fcdae80087e33b9882` and stopped only at
`check:forbidden` before Pages. The scanner reported nine Judge-owned
`review.*` paths as hard `FORBIDDEN`; manifest, contract/audit/brief/repair
records, and the design HTML were informational `NEEDS-REAUTH`. Exact path
hashes and the bounded metadata-only next commit are recorded in
`research/cr-grounding/o4p-04d-ci-reauthorization.draft.md`.

Independent Judge reownership verification, the metadata-only commit,
exact-head successful CI, Pages evidence, terminal ledger promotion, and clean
worktree remain pending.
