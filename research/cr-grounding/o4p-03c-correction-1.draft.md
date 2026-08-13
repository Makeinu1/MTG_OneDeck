# O4P-03C implementer correction 1

Base implementation session: `019ffb24-4f8a-7670-b421-ec43ec619bdc`

The Judge review found the following contract gaps. Correct only these points
inside the original implementer write scope. Do not edit Judge files, briefs,
package/scripts, ledger, governance, or git state, and do not run the release
full check.

1. Every WebSocket event must load and canonically validate the complete
   protocol and security snapshot before even malformed/rate handling. The
   singleton-only `validateClockForRoom` path is insufficient because corrupt
   grant/lease/audit rows can otherwise survive malformed events. Load once at
   event start and safely reuse that authoritative state for the accepted
   frame path.
2. Harden canonical security-row validation. At minimum require safe Room IDs,
   exact capability lifetime, grant windows not later than the persisted
   observed time, contiguous audit IDs from 1, non-regressing audit times not
   later than `lastObservedAt`, participant/authority consistency, and
   `droppedAuditCount === 0` until the audit table is exactly full (and a
   positive dropped count only when it is full).
3. Make lease deletion exact-CAS. Both rotation lease clearing and exact-holder
   close release must use `DELETE ... RETURNING participant_id` and compare the
   returned row count against the validated pre-write snapshot. Zero/multiple
   affected rows must roll back when one row was expected; zero is valid only
   when the validated snapshot contained no lease.
4. Remove the unused synonym policy constants and the unused
   `securityTablesForTestsV1` SQL helper. Keep only the single canonical names
   frozen by the contract and do not broaden the Cloudflare barrel.

Add focused ordinary adversarial coverage for each correction. Re-run the
affected ordinary Cloudflare tests, scoped ESLint, build, and
`git diff --check`; report exact results. Do not run Judge review tests or the
release full check.
