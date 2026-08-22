# O4P-07A Terminal Metadata Cold Audit Brief

Date: 2026-08-22
Base / release HEAD: `c6d979c90f16dd2f5807c759baea3e3d29ead38f`
Pre-brief terminal fingerprint:
`782d848315aeee74774a21e11d36e7570b1c816c3b4a588fd43fb3073146304f`
Risk: R0 terminal metadata / BROAD release-evidence audit

Read only. Do not edit, run the release full check, commit, push, deploy, change
the Worker, or start O4P-07B. Return BLOCKER/HIGH/MEDIUM/LOW counts and final
fingerprint.

Verify exactly:

1. The candidate changes only this brief, the O4P-07A completion packet, and
   `cr-backbone-ledger.json`. No product, review, policy, workflow, dependency,
   configuration, generated, CR, catalog, O4P-07B/C, or acceptance byte changes.
2. `domains[id=O4P-07A]` and
   `plannedSequence[domainId=O4P-07A]` are synchronized apart from their schema
   key, both are `shipped`, all other domain/planned statuses are unchanged,
   active program O4P-07 next member is O4P-07B, and B/C remain pending.
3. The completion packet and ledger evidence faithfully preserve the prior
   Luna/xhigh audits, fingerprints, commits, local full check, Actions runs,
   Pages assets/timestamp, Worker version/bindings/active status, and the
   repaired production smoke without recording an identifier or secret.
4. GitHub Actions `32567345994` targeted exact HEAD `c6d979c...`; build job
   `97017798460` passed full check, exact diff-base, ownership, and artifact;
   deploy job `97019101662` passed Pages.
5. Public HTML, `index-B8jI0XI3.js`, and `index-DNaejTHC.css` returned 200 with
   Last-Modified `2026-08-22T10:33:10Z`; Worker version
   `89817cd7-e23c-497a-b57c-187aef586983` is 100% active with only the declared
   Durable Object/version metadata bindings and root 404.
6. The production smoke is represented only by safe facts: create 200, submit
   200/accepted/issues empty, identical replay accepted, v1/v2 projections,
   seat accepted/ready false, and no capability/Scryfall/Oracle ID leak.
7. O4P-07A still makes no public picker/start/genesis/fixed-catalog-removal
   claim; those remain the explicit serial O4P-07B/C boundary.

Targeted Judge evidence before audit:

```sh
npm run check:docs
npx vitest run --project dom src/test/architecture/review.o4p-07-roadmap-registration.test.ts
npm run codex:context -- --domain O4P-07A
git diff --check
```

The `codex:context` health is green and projects O4P-07B as the next active
program member. Its loop-state reason `MATCHING_DOMAIN_ALREADY_SHIPPED` is the
expected pre-commit terminal-candidate condition, not authority to start B.
