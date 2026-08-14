# O4P-04C cold audit brief

Milestone: `O4P-04C`

Base SHA: `4b2f4ac534c489ce92d2f3dfce4774679c597502`

Audit class / budget: `BROAD R3 / one bounded 45-minute wait`

Read only:

- `research/cr-grounding/o4p-04c-display-pairing.contract.draft.md`
- `research/cr-grounding/o4p-04c-acceptance-brief.draft.md`
- the frozen candidate diff from base recorded in `.claude/loop-state.md`

Do not read implementation rationale or prior agent messages. Do not edit any
file and do not run release `npm run check`.

Recompute semantic and context fingerprints before inspection and again before
returning. They must match the launch packet. Inspect the complete tracked and
untracked diff from the Base SHA, including Judge evidence and architecture
registration changes.

## Falsify

1. partial validation, cross-Room/revision pair acceptance, unequal public
   facts, self/unknown/exited focus, audience swapping, or prior-state retention;
2. private card/zone/definition/owner/controller/object/Room/participant/bearer
   leakage through views, focus, DOM, labels, attributes, errors, logs, aliases,
   snapshots, or malformed paths;
3. getter/descriptor/prototype/symbol/sparse-array/Proxy traps, input mutation,
   missing deep freeze, sorting/defaulting/deduplication, nondeterminism, or
   same-reference memoization;
4. malformed refresh/pass/concede frames, actor/decision/sequence/revision/
   command-ID mismatch, unvalidated output, false acknowledgement/legality,
   invented randomness/time, or capability exposure outside the required field;
5. Projection/Room/protocol/Core/Cloudflare semantic change, private imports,
   Store/Solo/GameScreen dependency, network/storage/timer behavior, reverse
   reachability, root integration, architecture allowlist broadening, or scope
   drift beyond the exact Display Pairing registration;
6. inaccessible/pointer-only focus, missing Japanese status/test IDs, priority
   inference, CSS overflow/overlay, three-viewport divergence, or console errors;
7. vacuous Judge assertions, fixture-only fake green, or behavior claimed past
   the explicit DEFER.

## Return format

- observed semantic and context fingerprints;
- findings sorted BLOCKER, HIGH, MEDIUM, LOW;
- stable ID, exact path/symbol, violated clause, reproduction, impact, and
  smallest safe correction;
- explicit severity totals and targeted commands/outcomes;
- `AUDIT-CLEAR` only when BLOCKER/HIGH are zero; otherwise
  `AUDIT-FIX-REQUIRED`.

Timeout or incomplete inspection is no verdict.
