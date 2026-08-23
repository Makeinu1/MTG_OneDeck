# O4P-08A Cold Audit Record — 2026-08-24

Base SHA: `2c338a69f41eb693696db12c086e706423679aa6`
Audited fingerprint: `4c61ffe2d430a16c81bd6f923bc390bc1e97afaaf0ce244af0be5ba897f2f674`
Auditor: fresh-context Sol/high R3/BROAD cold auditor
Verdict: `AUDIT-FAILED`

Counts: BLOCKER 0 / HIGH 5 / MEDIUM 1 / LOW 0.

## Findings

1. HIGH: the public Worker forwarded `online-forming-lobby-initialize-v3`,
   allowing browser-selected lobby and bearer material to reach the internal
   Durable Object initializer.
2. HIGH: fragment parsing returned the invite when `history.replaceState`
   failed, so a bearer could be exchanged while still present in the URL.
3. HIGH: the public controller had recover/leave but no authoritative v3
   create/claim operation that saved a recovery record.
4. HIGH: `finished` protocol Rooms could recover instead of clearing terminal
   recovery with `ROOM_EXPIRED`.
5. HIGH: recognized v3 forwarding failures could fall back to the generic v1
   error; `RATE_LIMITED` mapped to 400 and several declared blocker codes had
   no server emission path.
6. MEDIUM: authoritative leave rejection did not clear recovery for terminal
   Room or credential-invalidating errors.

The auditor ran the 26 O4P-08A Judge tests, 56 bounded regression tests, diff
hygiene, ownership classification, and candidate fingerprint verification.
No files were edited and no full release check was run by the auditor.

## Disposition

Remediation is required. This record is not shipment evidence. A new candidate
fingerprint and affected-claim cold re-audit are mandatory before the one
release full check.

## Remediation and clean audit

The Judge used bounded surgical remediation after the implementer correction
limit. Affected-claim audits progressed from `HIGH 1 / MEDIUM 2`, to
`HIGH 0 / MEDIUM 1`, and finally to `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.
The clean semantic candidate fingerprint was
`2047804951b54e402827594df6f44cb0fe4456aba5f03bd37b0ff89e19cc631b`.
The cold auditor returned `AUDIT-OK-PENDING-FULL-CHECK` and did not run the
release full check.

The first sandboxed full-check attempt stopped before product checks because
`tsx` IPC socket creation was denied with `EPERM`; candidate bytes did not
change. The authorized retry reached the historical O4P-05C frozen-authority
guard and stopped on the expected hash reauthorization for the four changed
Cloudflare files. Exact current SHA-256 values were pinned in
`verify-o4p-05c-release-gates.ts`, and the resulting verifier SHA-256 was pinned
in `verify-o4p-05d-production-release-closure.ts`. No wildcard or path-scope
authorization was added. These reauthorization bytes require an affected-claim
audit before the final full-check retry.
