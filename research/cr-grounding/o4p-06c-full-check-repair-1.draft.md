# O4P-06C full-check repair 1

- Owner: Judge/orchestrator
- Candidate commit: `1c91f21f3943278001c084be7fd34339e14ae8e0`
- Trigger: the first permitted `npm run check` completed all machine checks, docs, lint, and Core tests, then failed five assertions in four pre-existing architecture review files.
- Product finding: none. The failures are closed registration lists that predate the public `src/online/lobby` boundary accepted by O4P-06C.

## Bounded repair

1. Add `lobby` to the online-root allowlist and its pinned expected order in `o4p01iStackAnnouncementBoundary.test.ts`.
2. Add `../lobby/index` to the public lower-barrel allowlists in the O4P-03A, O4P-03B, and O4P-03C architecture reviews.
3. Extend the O4P-03C route-action union assertion with `lobby` in the production order.
4. Mechanically re-anchor the affected Cloudflare verifier hashes and their O4P-05C/O4P-05D successor hash chain.

## Verification boundary

- Rerun only the invalidated architecture reviews, affected frozen verifiers, TypeScript, affected ESLint, and diff checks before independent cold re-audit.
- Do not change Cloudflare/lobby production semantics.
- Do not run the final full check until the repaired fingerprint is independently authorized.
