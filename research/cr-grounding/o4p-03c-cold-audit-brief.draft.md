# O4P-03C independent cold-audit brief

Milestone: `O4P-03C`

Base SHA: `a6f4c539a977e38a6891c31fb99acf4fddfee428`

Risk / budget: `R3 / BROAD / one bounded 45-minute wait`

Read only this brief, then the authority and evidence paths named below. Do not
read an implementation transcript or rationale. Do not edit files, run git
mutation commands, deploy Cloudflare, or run the release `npm run check`.

Authority:

- `AGENTS.md` cold-auditor boundary;
- `research/cr-grounding/o4p-03c-capability-abuse-control.contract.draft.md`;
- `research/cr-grounding/o4p-03c-acceptance-brief.draft.md`;
- Cloudflare Durable Object Hibernation WebSocket and SQLite primary docs
  current on 2026-08-13.

Candidate scope:

- the complete diff and untracked candidate from the base SHA;
- `src/online/cloudflare/**`;
- O4P-03A/B/C Judge review tests and O4P-03A/B/C verifiers;
- package and canonical machine-check registration;
- byte-unchanged `wrangler.jsonc`, dependency, version, and lower-layer
  boundaries.

Recompute the semantic fingerprint from the repository root with
`node scripts/checks/fingerprint.mjs`. Recompute the context fingerprint with
`node --input-type=module -e "import {computeTreeFingerprint} from
'./scripts/codex-context.mjs'; console.log(computeTreeFingerprint(process.cwd()))"`.
Report both before and after the audit.

Adversarially probe exact capability expiry and rotation, previous/reused and
fragment-bearing token rejection, host/seat/table/spectator action authority,
HTTP-versus-socket controller conflicts, per-frame live-token checks, exact
rate/frame/socket edges, hostile descriptors, canonical SQL/CAS rollback,
clock regression, hibernation recreation, bounded append-only audit facts, and
secret-free attachment/error/response/audit surfaces. Confirm that missing or
corrupt security state fails closed before any application mutation and that
O4P-03D migration, config, route, secret, log export, and deployment work has
not leaked into this candidate.

Run only targeted verifier/review/regression commands needed to substantiate
findings. Return findings only, classified BLOCKER/HIGH/MEDIUM/LOW, with exact
path and reproduction. A clean verdict is `AUDIT-OK-PENDING-FULL-CHECK`, not
ship approval.
