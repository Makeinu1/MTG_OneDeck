# O4P-07C Full-Check Repair 1

Date: 2026-08-23
Base SHA: `039f888923b21445cba60c811e2735284314d5a6`
Previously approved product semantic fingerprint:
`250986253e6a3f6cde99ef25ef46df323676f22767ab8e7922df892e6059f587`
Owner: Judge

## Trigger

Exact-head Actions run `32614875094` reached the canonical full check and
stopped at the O4P-03A runtime/persistence verifier. The verifier still pinned
the pre-O4P-07C SHA-256 of `src/online/cloudflare/index.ts`, while O4P-07C had
intentionally removed the legacy fixed-start exports. All preceding canonical
steps passed. Ownership classification, Pages upload, and deploy did not run.

## Bounded deterministic repair

1. Admit only the exact audited runtime import
   `../room/validationSupport` in the existing O4P-03A through O4P-03D
   Cloudflare import allowlists.
2. Re-pin only the current audited `src/online/cloudflare/index.ts` SHA-256 in
   the O4P-03A runtime/persistence and O4P-03B WebSocket/recovery verifiers:
   `987ee9cd6c0cf1e4473bdbae929f83b2c6ea47fea0647d580901dfaf3e1b25ba`.
3. Re-pin the four resulting O4P-03A through O4P-03D verifier byte hashes, the
   same index hash, and the audited
   `src/online/cloudflare/runtime.ts` hash
   `645c786f79fd330b0ddbd9b21bf58ee25852d33d5565704e1b5d648687a772e7`
   in the O4P-05C release verifier.
4. Re-pin the resulting O4P-05C verifier hash
   `7d31001f1805dd4bfa839fc4b6d5c4406059826b18c2099d4e4f82cbce35317f`
   in the O4P-05D closure verifier.
5. Preserve every other assertion, allowed import/source entry, timeout,
   dependency, ownership rule, release requirement, and product byte.

The repaired O4P-03A through O4P-03D verifier hashes are respectively:

- `0cf5abd6ed7cba91c05bc00fec1b84dfecbc5a69276a0cd7f40deb888e1f0956`;
- `ef8e56c1733b32e6d4e89b4ddad4aed13a7c5c00f337ac7461286207d4d3d622`;
- `0e9467d9c2aef3268ecd02cecbbc23efa5e11d3e7c1378aa7855755b9367d755`;
- `575c22bdf239ffbf4ada60d0a0784a70a7212da15f81f040ae2e7789dde35071`.

No source under `src/`, review test, contract meaning, dependency, CR authority,
public UI, Worker binding, or online protocol behavior changes in this repair.

## Required evidence

- The O4P-03A, O4P-03B, O4P-03C, O4P-03D, O4P-05C, and O4P-05D executable
  verifiers all pass and remain non-vacuous.
- Affected ESLint and `git diff --check` pass.
- An independent fresh Luna xhigh cold audit reports BLOCKER/HIGH 0 before the
  replacement exact-head CI is started.
- The local full `npm run check` is not rerun; replacement exact-head CI owns
  the final full-check evidence.
