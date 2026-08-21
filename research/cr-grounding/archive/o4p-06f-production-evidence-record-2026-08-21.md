# O4P-06F four-browser production evidence record

Date: 2026-08-21
Milestone: `O4P-06F`
Candidate HEAD: `0f8957486af558b503d42c3d66e2e4563f2734ef`
Audited semantic fingerprint:
`d4c34e164977edd95b13b0ee7894d16e7e566dbf749cb642978c1e53f010c805`
Product cold auditor: `/root/o4p06f_luna_correction3_cold_auditor`
Product audit record:
`research/cr-grounding/archive/o4p-06f-production-correction-3-cold-audit-record-2026-08-21.md`

## Exact-head release gates

GitHub Actions run `32473802443` executed on the exact candidate HEAD.

- build job `96745904600`: success;
- Core: 227 files, 2093 tests passed;
- DOM: 324 files, 2198 tests passed and 1 skipped, 2199 total;
- machine-check total: 740361 milliseconds;
- diff base resolved to the prior exact HEAD
  `57caa976987b499f222d0489ef1be890d3219e70`;
- ownership scan reported the expected four-file candidate with no forbidden
  path and exited successfully;
- TypeScript/Vite build and Pages artifact upload passed;
- Pages deploy job `96748709082`: success.

Served Pages evidence:

- origin: `https://makeinu1.github.io/MTG_OneDeck/`;
- HTML, `assets/index-B8jI0XI3.js`, and
  `assets/index-DNaejTHC.css`: HTTP 200;
- all three reported Last-Modified `2026-08-21T10:54:39Z`;
- the three exact loaded-document SHA-256 values were
  `60429ecf2985fd141fe9f15c0126cb736af1ce2fddb0dbb93080ef72eda3d82f`,
  `96edbf51d12f9430894973029457362fb081f7222b83b499e7a71e4d5f15a768`,
  and
  `643a725180e3d860d566bcc40ef8faad78f2518842e188a1bc0bcbd350b26c1d`.

## Cloudflare deployment

Wrangler `4.122.0` dry-run and both formal deployments compiled the exact
candidate successfully. Upload size was 1352.46 KiB, gzip 217.66 KiB. Only the
existing `ONLINE_ROOMS` Durable Object and `CF_VERSION_METADATA` Worker Version
Metadata bindings were present; the existing workers.dev trigger was reused.

- Worker origin:
  `https://mtg-onedeck-online.makeinu1.workers.dev`;
- pre-barrier formal version:
  `3b67bb69-f04c-4159-853b-bc6077a0e69d`;
- post-barrier and final active version:
  `683c03f2-0d90-42c4-adb1-d6887e794ade`;
- the final version was active at 100%; the pre-barrier version remained in
  version history;
- Worker root and `/o4p-06f-safe-probe`: HTTP 404.

No resource deletion, route/DNS/custom-domain change, secret or variable
mutation, rollback, account-wide setting, schema downgrade, or dependency
change occurred.

## Four-browser executable evidence

Chrome `151.0.7922.170` ran four isolated browser contexts with the exact deck
files:

- Celes: 1947 bytes,
  SHA-256 `137021c700a454b9f6c737ab72391348b6da5da50d3bc25c12822e1fe38ebe2e`;
- Gogo: 1519 bytes,
  SHA-256 `190d607f62edd5464caf3b437d975089277278699b98baaeba0a9869ab97a5b3`;
- Kefka: 1872 bytes,
  SHA-256 `8bc03124d606b4715e042641567df806cfd14390ba3bfeff3496ce2188a20bd6`;
- Muldrotha: 1777 bytes,
  SHA-256 `f861e7aec62d1b8b27a7d8f66e7986c36e710eed6370ee3c7091ec58fe987338`.

The secret-free canonical summary SHA-256 was
`7bcc4f5cbf42664315c9e88c6402321792e5adf29a65a5c113822633630ddbf5`.
The exported closed validator independently accepted the saved summary.

- four Player contexts plus one Table audience reached active revision 0;
- P1 through P4 each accepted one non-duplicate table draw at revisions 1-4;
- action counts were exactly four table draws and one player exit;
- P2 used a genuinely fresh socket, stale known revision 2, one bounded current
  snapshot, and zero unsolicited queued frames after P1 proved P2 disconnected;
- P4 concession was accepted at revision 5;
- all seven measured HTTP facts were 200;
- same-Room final status remained HTTP 200, revision 5, accepted-command count
  5 after cleanup;
- pre/post deployment hashes matched for all four surviving Player/Table
  audiences;
- same-Room new-version recovery fact was exactly checkpoint 0, current
  revision 5, replay count 5, outcome ok;
- tail error, exception, parse failure, and secret violation counts were zero;
- browser console errors and warnings were zero;
- cleanup measured 10 sockets, 4 targets, 4 contexts, the Chrome process, and
  its profile closed/removed; no harness or Chrome process remained.

Audience projection hashes were byte-equal before and after the barrier:

- audience 1:
  `e983772887bf11f3946dcf40d7cb60e5cbb5f7439c8a2844f1d83993fcc2cf0a`;
- audience 2:
  `81236b49805b207e654b8d16360e9fea3428efbcae0b60900cea3762191aa945`;
- audience 3:
  `1338473d11c3b22764783664cc19f5f6b5e1072a26d610636c55c8c7e59249d6`;
- audience 4:
  `25e790f6b938c7d43fe439358dd025bf29c375d1414e3864fe7f0fb0bf874520`.

## Honest failure history and boundary

The first post-correction production attempt stopped before its barrier because
the harness required an unreachable later projection reason. That attempt was
not counted as success. Its source-faithful finding produced correction 3,
independent cold audit, a new exact-head CI/Pages run, and this formal retry.
No failed Room identifier or payload is recorded.

This record contains no Room identifier, participant identity, capability,
credential, account identifier, token, private key, raw request/response,
WebSocket frame, raw tail event, or raw summary JSON. It does not claim a
24-hour soak, matchmaking, chat, WAF/custom-domain Access, or account-wide
abuse/cost control.

Production evidence remains pending independent cold audit and terminal ledger
promotion. This record alone is not shipment approval.

## Independent production evidence audit

Context-free auditor `/root/o4p06f_luna_production_evidence_auditor` verified
the exact two-file metadata boundary, record and context hashes, canonical
summary hash and exported validator, all four deck bytes, privately correlated
same-Room tail/status evidence, distinct retained versions and final 100%
deployment, Wrangler/config scope, CI/Pages artifacts, all scenario facts,
cleanup counts, and secret-free/non-claim boundaries. Sandboxed live DNS and
process-list calls were unavailable to that auditor; it verified the captured
artifacts while the Judge's independent live `gh`, `curl`, Wrangler status,
and process checks supplied the recorded external facts.

Findings: `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.

Verdict: `O4P-06F-PRODUCTION-EVIDENCE-APPROVED`.

This authorizes terminal metadata and ledger promotion only. Final exact-head
CI/Pages, final Worker smoke, `HEAD == origin/main`, and clean-worktree closure
remain required before shipment.
