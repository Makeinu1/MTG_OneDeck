# O4P-09E Full-Check Repair 1

Date: 2026-08-27
Semantic base SHA: `2dfac319ee0320dcedca2f99b76c23251d0cf24a`
Previously accepted successor fingerprint:
`a09e5819fbe78c2ea315fe15eafd397cade0dd4707febeb8f5d70e14d8c8219e`
Owner: Judge

## Trigger

The host-authorized release `npm run check` passed every canonical stage through
Online Local Headless, then stopped at
`verify:online-cloudflare-runtime-persistence`. O4P-09E had intentionally
extended four previously frozen O4P-03A through O4P-03D review authorities,
while their historical executable verifier chain still pinned predecessor
bytes. The first sandbox-only start stopped before running product evidence at
the local `tsx` IPC boundary (`EPERM`) and made no candidate change.

The first functional stop was exact and deterministic: the O4P-03A boundary
review now hashes to
`c1d3633f5596454d340e2658681e054f393c1cd5207115c48c3c7332540921f0`,
not the predecessor hash frozen by its verifier.

## Bounded deterministic repair

1. Re-pin only the four O4P-09E-audited review hashes in their leaf verifiers:
   O4P-03A `c1d3633f5596454d340e2658681e054f393c1cd5207115c48c3c7332540921f0`,
   O4P-03B `dfe2e4432c20330afaf45078277f3f9e4dead6dcf1ddcfa180285a2c9cdfe6a8`,
   O4P-03C `64c280b09ee71305aa60733bfd70d0e40df3d8eb7bf954e403a6390aebd99635`,
   and O4P-03D `88ae11bda323a8ba737828454080595e582212e21d5e35a13705b63f878acffd`.
2. Admit only the exact audited `../visibilityDecisions/index` and
   `../visibilityDecisions/types` imports in each leaf verifier. Replace the
   WebSocket verifier's blanket migration-token ban with the same exact
   two-DROP, one-ALTER, two-PRAGMA, copy-verification shape already pinned by
   the audited O4P-03A boundary. Re-pin only the resulting four verifier hashes in
   `scripts/checks/verify-o4p-05c-release-gates.ts`:
   `1fc20267a75853a421c52b491042c8e952389e18fa9ba2f216a41bdbf7fa3166`,
   `0eeda5d51fc61aac8e62fae6de13ff47e905f8f82c23ca04dcdb34ad15161798`,
   `315b34262f85e773c8ddd1376926026511db8f7a54267fcc6bef2ca4bdad397b`,
   and `5739e9f729b738128a9a7b7be0a43525f9aca483b3719c3a0f1c5ad36b458b58`.
3. Re-pin the same O4P-03D review authority and the already audited O4P-09E
   persistence/runtime production bytes in O4P-05C:
   `a1bae8d39115d91e1db33a75b6715e4d31df30c52eb49d54a2abd5be9e2b823b`
   and `b9dd707088fab8dfbbf96df7ac1bbcd32ff8a10ec6c3b2c6c6d04ab1dd78367b`.
   Then re-pin only the resulting O4P-05C verifier hash
   `ae237c3188cca82d6840fb5d8f453227a48fbca55dd717e1a4d6c0d7a87cb2fb`
   in `scripts/checks/verify-o4p-05d-production-release-closure.ts`.
4. Reauthorize the ten historical architecture guards reached by a complete
   architecture-suite run. Changes are restricted to exact `visibilityDecisions`
   module registration, exact E UI/Core/projection imports and symbols, one
   exact library-order-change comment exception, first-non-shipped program
   selection, and one explicit wildcard-free O4P-09E successor set. Existing
   negative probes and forbidden-path assertions remain active for every other
   module, import, symbol, comment, and path.
5. Preserve every other assertion, allowlist/source entry, timeout,
   dependency, ownership rule, release requirement, and product byte.

The terminal O4P-05D verifier now hashes to
`51e81f7b6db265aa894a62743f1ef33f7dfbd802313b11215f72ee925c38e5b8`;
no downstream exact-hash authority references it. The updated O4P-09C guard
hashes to
`09dfa32f5547c2f961a6da88f5e56116be756fe0212ea4c422cf5fcf208f450a`
and is not frozen downstream. No production source, generated API, contract
meaning, CR authority, public UI, Worker protocol, or dependency changes in
this repair.

## Required evidence

- O4P-03A through O4P-03D and O4P-05C through O4P-05D executable verifiers
  pass and remain non-vacuous.
- The complete architecture suite passes (52 files / 233 tests); affected
  ESLint and `git diff --check` pass.
- The same independent cold-auditor lineage reports BLOCKER/HIGH 0 on the exact
  repaired bytes. Because this repair changes a verifier registered by
  `CONTRACT-ENGINE-MULTIPLAYER`, the pre-commit audit must confirm that
  `check:docs` has exactly one expected stale-anchor stop and no other error.
- After that audit, commit the exact repaired bytes, reanchor only
  `CONTRACT-ENGINE-MULTIPLAYER.lastVerifiedCommit` to the resulting real commit,
  and obtain a second exact 0/0/0/0 audit plus passing `check:docs`. A placeholder,
  future, non-ancestor, or waived manifest SHA is forbidden.
- The one allowed final `npm run check` passes on exactly those audited bytes
  after the manifest reanchor and before the release push.
