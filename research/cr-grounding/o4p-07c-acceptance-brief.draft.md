# O4P-07C Acceptance Brief

Date: 2026-08-23
Base SHA: `6899fd4a9e1adba71651d883174647970f7a5d59`
Authority: `o4p-07c-fixed-runtime-removal-production-release.contract.draft.md`

## Executable acceptance

1. Exact v1 deck/ready/start/start-with-table messages receive the exact
   secret-free HTTP 426 upgrade response and mutate no state. Malformed/unknown
   messages remain generic; v1 create/claim and all v2 operations stay green.
2. Worker runtime and public barrels contain no legacy v1 success handler or
   exported fixed-start path. Lobby value imports no fixed bootstrap/catalog;
   regression tests reach fixed bytes only through explicit fixture imports.
3. A fail-closed verifier recursively resolves emitted value imports from
   `src/main.tsx` and `src/online/cloudflare/worker.ts`, rejects the fixed
   fixture paths/markers, and rejects unresolved or ambiguous local imports.
4. The verifier runs after the canonical Vite build, scans the emitted Pages
   JavaScript, and can scan a Wrangler dry-run Worker bundle. Tests cover a
   clean graph plus injected forbidden path, marker, missing output, and
   unresolved-import failures.
5. Existing arbitrary v2 submission, ready clearing, owner issue, dynamic
   genesis, identical-deck physical IDs, DFC, size, restart, reconnect,
   revision-zero replay, secrecy, and Solo tests remain green.
6. No dependency, `wrangler.jsonc`, binding, CR, engine semantic, EDH legality,
   sideboard, or single-operator seat-switch change occurs.

## Production evidence

1. Exact-head CI runs the full canonical check, the new post-build verifier,
   ownership classifier, and Pages deploy successfully.
2. Pages HTML and exact JS/CSS assets return 200 and the served JS passes the
   fixed-marker/legacy-request scan.
3. `wrangler deploy --dry-run` from the frozen tree produces a bundle that
   passes the verifier; the same tree is deployed and its version is 100%
   active with only the expected bindings and a safe 404 root response.
4. Four catalog-external decks, including an identical pair, zero/multiple
   commanders, non-100 total, quantity, and DFC, complete submit/ready/start in
   four storage-isolated contexts. Reconnect and replay return the same frozen
   root/digest and physical IDs do not collide.
5. A known owner error/retry is actionable only in its owner context. The other
   three contexts, host/table projection, DOM, logs, and evidence contain no
   card/error/capability secret.
6. Chrome normal, Chrome incognito, Firefox private/equivalent, and Safari
   private/equivalent are exercised. 375x812, 812x375, and 1440x900 have no
   overflow/clipping; console errors are zero.

## Verification order

The implementer runs affected ordinary tests, verifier tests, affected lint,
and diff check only. The Judge owns all `review.*`, frozen fingerprint,
Wrangler/browser/public evidence, full `npm run check`, git, CI, Pages, Worker,
ledger, and completion. Cold audit precedes the single full check. Any audit or
full-check defect invalidates affected evidence and follows the bounded repair
loop before a replacement exact-head release.
