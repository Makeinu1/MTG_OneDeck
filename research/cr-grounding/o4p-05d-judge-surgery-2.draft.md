# O4P-05D Judge surgery 2

Milestone: `O4P-05D`

Candidate before correction: `8436a7b060db7036dfc3fe6cd17412d1ab1dc5c0`

Authority: independent re-audit by `/root/o4p05d_cold_auditor`, verdict
`AUDIT-FIX-REQUIRED`, totals BLOCKER 0 / HIGH 2 / MEDIUM 0 / LOW 0.

## Accepted findings and final bounded correction

1. The contract incorrectly required the first base-to-candidate GitHub run to
   pass forbidden even though that diff necessarily contains the Judge-owned
   O4P-05D `review.*` file. Align the protocol with the existing governed
   precedent: after audit and local full check, push the semantic candidate;
   require its CI to pass the full check and stop only on that exact review
   path; record the exact path/hash/run in a Judge reauthorization draft;
   independently audit the unchanged bytes; then push a metadata-only
   reauthorization commit whose exact-head CI/forbidden/build/Pages must pass.
   Cloudflare deployment remains prohibited until that later run is green.
2. The future production audit record could contain secret-looking material
   while satisfying three positive markers. Whenever O4P-05D is `shipped`, both
   verifier and review must reject standalone 32-hex account identifiers,
   GitHub-token forms, bearer material, labeled capability/token/secret/
   authorization/account values, private-key blocks, and raw JSON record lines.

No forbidden policy, production source, runtime, protocol, projection, UI, CR,
Worker configuration, Pages workflow, dependency, version, release threshold,
external service, or deployment state changes. This is the final bounded Judge
surgery. Re-run the invalidated review/verifier and adversarial claims, commit
locally without push, and return to the same auditor. Full check, push, CI,
Pages, and Cloudflare remain prohibited until audit closure.
