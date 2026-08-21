# O4P-06F production correction 3

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `57caa976987b499f222d0489ef1be890d3219e70`
Risk: R3 bounded production-evidence reconnect correction

## Production finding

The exact-head CI/Pages release candidate passed, Wrangler 4.122.0 dry-run and
the first production Worker deployment succeeded, but the four-browser
production harness stopped before its deployment barrier with the generic
`P2 resync reason/revision mismatch` failure. A secret-free diagnostic rerun
reproduced the same failure and cleaned up all Chrome resources.

Source review shows that the harness closes P2 and immediately opens the fresh
socket. Browser-side close completion does not prove that the Durable Object
has already processed its close callback and persisted P2 as disconnected.
The fresh projection can therefore legitimately report `snapshot-required`
instead of the required `rejoined`, making the reconnect evidence race-prone.

## Goal

After closing the original P2 socket, use an already-authenticated surviving
Player socket to request bounded, read-only projections at revision 4 until a
closed projection proves that the exact P2 participant is `disconnected`.
Only then open the fresh P2 socket and retain the existing exact requirements:
fresh socket identity, accepted hello, a stale-known-revision request with
`reason=snapshot-required`, revision 4, exactly one snapshot, zero unsolicited
queued frames, and unchanged audience secrecy.

## Constraints

- Implementer writes are limited to
  `scripts/online/o4p-06f-four-browser-evidence.ts` and the existing ordinary
  non-`review.*` test
  `src/online/browser/__tests__/fourBrowserProductionEvidenceV1.test.ts`.
- Do not change product Worker/browser/protocol/projection/Core/UI source,
  `review.*`, package/lock/dependency, Wrangler, workflow, docs/generated,
  manifest, ledger, version, research authority, git, or deployment state.
- Do not use a blind sleep as the proof. The observer projection must be
  closed/descriptor-safe, match the exact P2 participant ID, and expose only
  canonical `presence=disconnected` before reconnect.
- Bound both attempts and wall-clock time through the existing injected timeout
  runtime. Reject missing/duplicate/malformed participant rows, unexpected
  frames, stale/future revisions, secret/capability material, and exhaustion.
- The observation is read-only and must not alter revision 4 or accepted
  command count 4. Existing action, replay, deployment, cleanup, asset,
  console, and projection-hash evidence remains byte-for-byte in meaning.
- Add ordinary hostile tests for delayed close propagation, malformed or
  duplicate participant rows, and bounded exhaustion. Preserve the frozen
  Judge review bytes.
- Run only affected ordinary/Judge tests, scripts TypeScript, affected ESLint,
  docs/diff checks. Do not run full `npm run check`, Chrome/network/deploy,
  self-audit, ledger, or git operations.

## Done when

The correction is frozen with no known implementation finding; bounded tests
and static checks pass; a context-free Luna xhigh cold auditor returns
BLOCKER/HIGH zero on the exact fingerprint; and only then may the Judge rerun
the production evidence from a clean exact-head candidate.

## Judge adjudication after cold-audit probe

The cold auditor proved that `reason=rejoined` is unreachable on the public
two-frame path: the accepted client hello reconnects and persists P2 before the
following projection request is handled. The subsequent request at stale
known revision 2 therefore canonically returns `reason=snapshot-required` at
current revision 4. The governing O4P-06F contract requires a fresh socket,
stale-known-revision resync, and exactly one current snapshot; it does not
require the later projection to repeat the hello transition's internal
`rejoined` state. Disconnect is independently proven before hello through the
surviving P1 projection. The Judge therefore corrects only this expected
reason literal; Worker, protocol, browser product, public shapes, and action
semantics remain unchanged.
