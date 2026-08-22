# O4P-07A Full Check Repair 1

Date: 2026-08-22
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Full-check candidate fingerprint:
`edb2d09df5a16d5e4edb74367a780dd3d8f0a777a5d919dc5655ad7b0b20bc8b`

The first and only initial `npm run check` invocation passed every gate through
O4P-03C, then stopped before lint/tests/build because the historical O4P-03D
production verifier's exact Cloudflare module list omitted the audited new
`src/online/cloudflare/scryfallResolver.ts` successor module.

The bounded repair adds that exact module, the already audited public
`deckSubmission/index` import, and the one-way lower reverse boundary to the
O4P-03D verifier. It then re-pins only the resulting O4P-03D verifier in O4P-05C
and the resulting O4P-05C verifier in O4P-05D.

The O4P-03D, O4P-05C, and O4P-05D commands pass after correction. No product,
review, contract, dependency, configuration, deployment, CR, UI, start/genesis,
or ledger bytes changed. A read-only cold audit must confirm this repair before
the final permitted full-check invocation.
