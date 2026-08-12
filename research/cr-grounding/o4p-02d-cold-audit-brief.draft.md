# O4P-02D cold audit brief

Role: independent cold auditor. Read-only. Do not edit any file and do not
perform git writes.

Milestone: `O4P-02D` Player, Table, and Spectator Projection

Base SHA: `84edd7e0639d7f7ec4e239f5e522ca8fa5815af8`

Frozen authority:

- `research/cr-grounding/o4p-02d-audience-projection.contract.draft.md`
- `research/cr-grounding/o4p-02d-acceptance-brief.draft.md`
- shipped O4P-01L/O4P-01N public Core closure
- shipped O4P-02B Room and O4P-02C protocol

Candidate implementation is `src/online/projection/**` excluding judge-owned
`review.*` and fixture evidence. Judge integration is the exact evidence paths
listed by the acceptance brief plus package, machine-check, TypeScript, domain,
and architecture registrations.

## Required adversarial audit

Independently inspect every contract/acceptance clause. At minimum falsify:

1. exact request/response/log/projection unions, projection schema 1, protocol
   version, role/Core-player relation, revision equality, and Room allowlist;
2. player versus Table/Spectator authentication, generic reconnect/reject
   behavior, no capability/authorization/receipt/digest/command escape, and
   public-log minimization;
3. no object ID/runtime for unauthorized hand/library entries and no physical/
   definition/source/copy/origin/ability-key leakage from normalized objects;
4. public face-up, controller-only face-down battlefield/stack, grant-only
   face-down exile, player look, all-player reveal, and observer public-only
   rules, including Table/Spectator game byte parity;
5. matching-context controlled-player visibility and nonmatching/null/observer
   exclusion through the shipped decision-maker query;
6. SearchSession actor/selector/decision-maker filtering, candidate order and
   full visibility, plus total absence for every unauthorized audience;
7. current attempt-only PlayPermission filtering, hidden top-card protection,
   stale-zone/face-down-exile rejection, normalized duration, and observer
   exclusion;
8. visible/concealed runtime and attachment redaction without identity leaks;
9. exact descriptor/trap/getter/dense-array validation, deterministic complete
   issues, deep freeze, and no trim/sort/dedup/default/mutation of caller data;
10. fail-closed configured-capability collision anywhere in public projection,
    and no hidden sentinels/raw thrown diagnostics in validation/error/log paths;
11. only public Core/Room/protocol/versioning imports, no Core reducer/mutation,
    reverse dependency, Store/Solo/UI/network/Cloudflare/clock/RNG/storage/log
    side effect, root Online barrel, version bump, or dependency expansion;
12. fixture, verifier, judge review, architecture review, machine-check, and
    `online-projection` domain registrations are non-vacuous/fail-closed, while
    O4P-01L/O4P-01N/O4P-02A/B/C evidence remains green.

The release full `npm run check` must not have run on the frozen candidate
before this audit. Treat targeted green evidence only as claims to falsify.

## Return format

- observed semantic fingerprint from `node scripts/checks/fingerprint.mjs` and
  context fingerprint/status from `npm run codex:context -- --domain O4P-02D`;
- findings sorted BLOCKER, HIGH, MEDIUM, LOW;
- stable ID, exact path/symbol, violated clause, reproduction, impact, and
  smallest safe correction for every finding;
- explicit severity totals and exact commands/outcomes;
- `AUDIT-CLEAR` only when BLOCKER/HIGH are zero; otherwise
  `AUDIT-FIX-REQUIRED`.

Do not modify source, tests, fixtures, verifier, contract, ledger, loop state,
docs, git state, or candidate fingerprint. Timeout/incomplete inspection is no
verdict.
