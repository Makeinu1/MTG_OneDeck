# O4P-07B Full-Check Repair 2 Cold Audit Brief

Date: 2026-08-23
Base SHA: `ead2ed875e84b932fb56e04055dd9621a6cecb39`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-07b-full-check-repair-2.draft.md`

Read only. Do not edit files, run `npm run check`, commit, push, deploy, or
publish records. Return BLOCKER/HIGH/MEDIUM/LOW findings and independently
computed canonical fingerprint.

## Audit the repair delta

Compare against repair-1 fingerprint
`2e1e280efda5a58fd1fe315ce6d6973a921ed9566f9702743d4656cc1869efa1`
and verify:

1. The exact Online root registrations add only `genesis`.
2. The Core allowance is file-, symbol-, and public-barrel-exact and its three
   synthetic negative cases remain red.
3. Cloudflare imports admit only `../genesis/index`; every O4P-03A/B/C/D live
   reverse scan now includes `src/online/genesis`.
4. O4P-07A historical assertions read immutable O4P-07A product bytes from
   `ead2ed875e84b932fb56e04055dd9621a6cecb39` and do not weaken the live O4P-07B
   boundary.
5. The three review hashes and O4P-03A/B/C/D -> O4P-05C -> O4P-05D verifier
   hash chain match exact current bytes without other assertion changes.
6. The nine invalidated architecture tests, six verifiers, TypeScript, affected
   ESLint, and staged diff check pass.
7. No product source, timeout, dependency, protocol/UI behavior, or release
   requirement changed after repair-1.

Return `AUDIT-OK-BLOCKED-PENDING-USER-AUTHORIZED-EXCEPTIONAL-FULL-CHECK` only
when all severities are zero. Do not treat targeted evidence as a substitute
for that full check.
