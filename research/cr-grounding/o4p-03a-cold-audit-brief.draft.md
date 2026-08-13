# O4P-03A cold-audit brief

Milestone: `O4P-03A`

Base SHA: `95b34868966de671c97f0aa824422ccb0c14e051`

Profile: `BROAD` (hard wait 45 minutes)

Candidate fingerprint: supplied in the Judge launch packet and independently
recomputed with `node scripts/checks/fingerprint.mjs`; any mismatch is a hard
stop and no verdict.

First read `.claude/audit-standing.md`, then audit findings-only against:

- `research/cr-grounding/o4p-03a-cloudflare-runtime-persistence.contract.draft.md`
- `research/cr-grounding/o4p-03a-acceptance-brief.draft.md`
- the frozen diff from the base SHA.

Priority adversarial claims:

1. Worker routing uses only the platform-normalized Fetch pathname. Invalid
   visible Room IDs return 400; valid Room IDs with unknown actions or extra
   segments return 404; neither reaches a binding. Do not require the Worker to
   reconstruct raw dot-segment spellings already removed by URL normalization.
2. persisted state is revalidated; initialization cannot reset a Room;
   accepted command snapshot+journal are atomic; rejects/duplicates write zero.
3. command journal excludes configured capabilities and every contiguous
   eight-unit fragment; loaded journal metadata matches the accepted snapshot
   receipts. Public responses/errors/bootstrap exclude full configured
   capabilities and raw Core/SQL/stack evidence; an unsafe accepted-journal
   parameter produces only the generic error and no shipped ACK.
4. WebSocket is entry-only and uses standard `accept()`, never hibernation,
   application messages, reconnect, attachment, or outbox behavior.
5. strict config uses declarative SQLite export and contains no account/route/
   secret/migration; package dependencies and shared versions are unchanged.
6. implementation imports only frozen lower public barrels; O4P-02/Solo/Core/
   UI meaning and every DEFER remain untouched.
7. Judge review tests are non-vacuous: temporarily break route rejection,
   transaction atomicity, and capability filtering one at a time, prove red,
   and restore byte-identically.

Run the milestone verifier, both Judge review tests, ordinary affected tests,
`npm run check:forbidden`, and `git diff --check`. Do not run the release full
check and do not edit tracked files. Return severity, file:line, reachable
input-to-wrong-result evidence, exact commands/results, fingerprint match, and
ship recommendation. Clean result vocabulary is
`AUDIT-OK-PENDING-FULL-CHECK`.
