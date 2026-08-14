# O4P-04C final full-check repair 1

- Candidate HEAD before the check: `d5c0160db83cf5adc7e6191cd72a84e2d095f515`.
- Audited context fingerprint: `96df97591db0df555ef50daa103c226ef0da290863b96d47d1f3bb41b983185c`.
- The first and only pre-repair `npm run check` reached Core `226/2086` PASS and then exposed two stale architecture registrations in DOM:
  - `modeNeutralCoreBoundary.test.ts` had not frozen the exact public Core symbols consumed by the approved O4P-04C display-pairing boundary.
  - `review.o4p-04b-table-display-boundary.test.ts` had not registered its approved O4P-04C successor, which intentionally composes `TableDisplay` from a new dev-only display-pairing surface.
- Repair is test-governance-only. It registers exact file/symbol consumers in the global Core boundary and exact O4P-04C successor paths in the O4P-04B frozen scope. No runtime, product entry point, contract semantics, dependency, or DEFER changes are made.
- The first targeted rerun showed only two base-relative self-registration failures for the architecture files changed by this repair; those exact two paths were then added to the applicable frozen allowlists. The runtime-boundary assertions themselves were already green.
- The invalidated architecture scenarios must be rerun in full, followed by the O4P-04C target suite, domain checks, and the same independent cold auditor. A second and final `npm run check` is permitted only after BLOCKER/HIGH return to zero on a newly frozen candidate.
