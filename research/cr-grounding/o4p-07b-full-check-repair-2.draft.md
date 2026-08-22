# O4P-07B Full-Check Repair 2

Date: 2026-08-23
Base SHA: `ead2ed875e84b932fb56e04055dd9621a6cecb39`
Repair-1 audited fingerprint:
`2e1e280efda5a58fd1fe315ce6d6973a921ed9566f9702743d4656cc1869efa1`
Owner: Judge

## Trigger

The second effective O4P-07B `npm run check` passed every verifier, lint, Core
227/2093, and 2253 DOM tests. Nine DOM assertions failed only because the new
`src/online/genesis` module was not registered in historical exact module and
import boundaries, and the O4P-07A review still compared its temporary
"UI/start unchanged" constraint against the live successor tree.

No O4P-07B product behavior test failed. The candidate remains unshipped and
O4P-07C has not started.

## Bounded deterministic repair

1. Register `genesis` in the two exact Online module-kind lists.
2. Admit only `src/online/genesis/index.ts` and its exact imported Core symbols
   through the public Core barrel. Synthetic tests reject another file, an
   unapproved symbol, and a private Core barrel.
3. Admit only `../genesis/index` in the O4P-03A/B/C and O4P-07A Cloudflare
   public-lower-barrel lists, while adding `src/online/genesis` to every live
   reverse-Cloudflare dependency scan, including O4P-03D.
4. Evaluate O4P-07A's historical no-UI/no-start assertion at the immutable
   O4P-07B base closure `ead2ed875e84b932fb56e04055dd9621a6cecb39`, whose
   O4P-07A product bytes equal the original implementation closure. Current
   O4P-07B bytes remain governed by the O4P-07B review.
5. Re-pin only the three changed historical review hashes and the exact
   O4P-03A/B/C/D -> O4P-05C -> O4P-05D verifier SHA-256 chain.

No product source, timeout, dependency, CR authority, protocol behavior,
public UI behavior, or release requirement changes in this repair.

## Required evidence and budget boundary

- Rerun the nine invalidated architecture tests, all six dependent verifiers,
  affected ESLint, TypeScript, and staged diff checks.
- Return the frozen repair to the Luna xhigh cold auditor and require all
  severities zero.
- The governed two effective full-check attempts are exhausted. Even after
  targeted evidence and cold audit pass, another `npm run check` requires an
  explicit user-authorized exceptional attempt.
