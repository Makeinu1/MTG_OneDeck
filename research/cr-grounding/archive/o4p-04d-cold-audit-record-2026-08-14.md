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
