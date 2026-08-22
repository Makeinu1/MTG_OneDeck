# O4P-07B Full-Check Repair 1

Date: 2026-08-23
Base SHA: `ead2ed875e84b932fb56e04055dd9621a6cecb39`
Previously approved release fingerprint:
`0fa743d977a9f60da6cf4f71d1b4199a28b4b3c4c244267d4b4d0b88fbdfd1d9`
Owner: Judge

## Trigger

The first host-authorized `npm run check` passed every gate through the local
Online room verifier, then stopped because the O4P-03A runtime/persistence
verifier still pinned the pre-O4P-07B hash of
`src/online/cloudflare/index.ts`. The product candidate was not shipped and
O4P-07C was not started.

## Bounded deterministic repair

1. Admit only the exact public `../genesis/index` module in the existing
   Cloudflare import allowlists for O4P-03A through O4P-03D.
2. Re-pin only the current `src/online/cloudflare/index.ts` SHA-256 in the
   O4P-03A and O4P-03B historical verifiers.
3. Re-pin those four verifier bytes and the four O4P-07B-changed Cloudflare
   production files in the O4P-05C release verifier.
4. Re-pin the resulting O4P-05C verifier byte hash in the O4P-05D closure
   verifier. Its current-untracked protected-path rejection remains unchanged;
   the complete O4P-07B candidate is staged before this verifier is run.
5. Preserve every other executable assertion, source/import boundary,
   dependency, timeout, route, capability, and release requirement.

No product source, review test, contract meaning, dependency, CR authority,
public UI, or online protocol behavior changes in this repair.

## Required evidence

- All six Cloudflare/O4P-05 verifier commands pass on the explicitly staged
  candidate.
- Affected ESLint and `git diff --check` pass.
- An independent Luna xhigh cold audit reports BLOCKER/HIGH 0 before the final
  full check is rerun.
