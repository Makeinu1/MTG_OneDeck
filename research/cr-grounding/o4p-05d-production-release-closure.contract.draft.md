# O4P-05D Production Release Closure contract

Status: Judge-frozen release contract

Milestone: `O4P-05D`

Base SHA: `e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c`

Risk / audit lane: `R3 / BROAD`

Authority: the shipped O4P-05A public ruleset, O4P-05B four-player release
scenario, O4P-05C seven-gate decision, the repository-local CR pin
`mtg-cr-2026-06-19`, and the frozen O4P-03D Cloudflare production surface.

## Goal

Publish the already validated MVP once to both production surfaces and close a
single auditable release identity:

1. one exact candidate commit passes independent cold audit and the local
   release full check;
2. that exact candidate passes GitHub Actions, the forbidden-file guard, build,
   and GitHub Pages deployment;
3. the unchanged Worker/configuration bytes are deployed to the existing
   `mtg-onedeck-online` workers.dev service;
4. the new Cloudflare version, live four-player headless smoke, persisted-Room
   recovery, Pages HTML/assets, and clean repository state are recorded without
   secrets; and
5. O4P-05D is promoted exactly once in both ledger collections, closing the
   O4P-05 active program.

O4P-05D is an operational release checkpoint. It adds no gameplay, protocol,
projection, UI, runtime, schema, migration, dependency, CR, configuration, or
CI deployment behavior.

## Frozen candidate boundary

Relative to the base SHA, production source, `rule/`, `wrangler.jsonc`, package
dependencies, version contracts, and the Pages workflow remain byte-identical.
Only Judge-owned contract/acceptance/audit/review/verifier/governance metadata
needed to make the final release non-vacuous may change.

The registered O4P-05D verifier must run exactly once after the O4P-05C verifier
and before lint. It binds the frozen contract and acceptance bytes, proves the
O4P-05 serial ledger prerequisites, proves zero protected-product drift, and
keeps Cloudflare deployment out of GitHub Actions.

## Ordered release protocol

The order is fail-closed:

1. confirm clean base, healthy `codex:context -- --domain O4P-05D`, O4P-05A/B/C
   shipped, and valid local GitHub/Cloudflare OAuth without recording account or
   credential values;
2. run the O4P-05C verifier, the O4P-05D review/verifier, Wrangler 4.123.0 dry
   run, and scoped static checks;
3. freeze one candidate fingerprint and obtain an independent BROAD cold audit
   with BLOCKER/HIGH zero;
4. run one local `npm run check` on the unchanged audited fingerprint;
5. explicitly stage only the declared O4P-05D files, commit with the cold-audit
   identifier, push, and require exact-head Actions plus Pages success;
6. from that clean candidate commit, deploy with
   `npx --yes wrangler@4.123.0 deploy` and an O4P-05D message; accept only the
   existing Worker name, workers.dev origin, `ONLINE_ROOMS` Durable Object, and
   `CF_VERSION_METADATA` binding;
7. prove the active version changed, the former active version remains listed
   as the rollback target, the previously certified revision-96 Room still
   returns HTTP 200, and a fresh `init-load` evidence run reaches four sockets,
   revision 96, accepted-command count 96, and HTTP 200;
8. prove Worker root and an unrelated path retain the expected safe HTTP 404
   envelope, and record no capability, token, account identifier, or raw tail;
9. record the production evidence, obtain findings-only independent closure of
   the release claim, promote both O4P-05D ledger entries, reset loop state, and
   explicitly commit/push terminal metadata; and
10. require terminal exact-head Actions/Pages success, served HTML/JS/CSS HTTP
    200, `HEAD == origin/main`, and a clean worktree.

Any failed production smoke triggers STOP-before-promotion. The Judge may use
the recorded former version for a bounded Cloudflare rollback, then records the
failure and leaves O4P-05D unshipped. No destructive resource deletion, secret
change, route/DNS change, schema rollback, or account-wide mutation is allowed.

## Evidence requirements

The archive/ledger record must contain only secret-free release facts:

- candidate and terminal commit SHA;
- semantic/tree fingerprint used for cold audit and local full check;
- cold-auditor identity and severity totals;
- local full-check result and exact-head Actions run IDs;
- Pages URL, served asset names, HTTP status, and deployment timestamp;
- Wrangler version, previous/new Cloudflare version identifiers, deploy message,
  workers.dev origin, binding names, and deployment status;
- fresh headless evidence summary and the prior Room's public status facts;
- rollback target presence, final `HEAD == origin/main`, and worktree status.

OAuth identity, account identifier, token, capability, Room initialization
payload, WebSocket frames, and raw structured logs must not be committed or
reported.

## Honest boundary / DEFER

- O4P-05C remains the semantic release-gate authority; O4P-05D does not recreate
  or weaken its privacy, recovery, load, security, observability,
  information-leakage, or long-Room thresholds.
- The final deploy reuses unchanged O4P-03D Worker/configuration bytes. Any
  protected-product drift requires a new implementation/audit cycle and cannot
  be hidden in this release checkpoint.
- Account-wide Sybil/cost control, WAF, custom-domain Access, cross-Room quota,
  and a 24-hour wall-clock soak remain outside the bounded MVP claim.
- No Cloudflare resource deletion, secret rotation, DNS/custom route, Pages
  custom domain, dependency update, or CR update is part of O4P-05D.
