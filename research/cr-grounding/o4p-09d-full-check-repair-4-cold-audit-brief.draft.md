# O4P-09D Full-Check Repair 4 Cold-Audit Brief

Date: 2026-08-27
Candidate base SHA: a95c9b2177bd1e33d8438ff3f6f7dc4bb7895657
Risk: R3 / BROAD
Authority: research/cr-grounding/o4p-09d-full-check-repair-4.draft.md

Read only. Do not edit files, run the canonical full check, commit, push,
deploy, or publish. Audit the current candidate against the supplied frozen
semantic fingerprint and return findings only.

Verify all of the following:

1. Product change is exactly one condition removal in
   src/online/projection/validation.ts: projected token-definition keywords no
   longer reject carriage return.
2. NUL, empty, length, trim, uniqueness, sorting, serialized-size, hostile
   descriptor, and collection bounds remain unchanged. Every non-keyword text
   field retains its carriage-return rejection.
3. The unchanged O4P-02D review proves the Core-accepted Alpha\rBeta keyword
   projects and self-validates. No review assertion or fixture is modified.
4. The four Judge guards change only the complete literal O4P-09D successor
   path set, the exact browser/Cloudflare tabletopManual index and browser
   type-only surface, and the two exact O4P-09D successor files excluded from
   the legacy 04A aggregate scan. No O4P-09E path is admitted.
5. No wildcard, prefix, regex weakening, directory-wide exemption, product
   acceptance expansion, dependency, config, contract, UI, or O4P-09E change is
   present.
6. The complete O4P-02D review file, affected ordinary projection tests, four
   guards, scoped ESLint, docs validation, git diff --check, context, and
   release preflight are green.
7. Records cite run 33023118482/job 98358061795, explicit repair-4 authority,
   and cumulative wave 4 without resetting prior full-check/CI/usage counters.

Return O4P-09D-FULL-CHECK-REPAIR-4-AUDIT-OK only when
BLOCKER/HIGH/MEDIUM/LOW are all zero. Include the audited fingerprint. Full
check, Pages, terminal metadata, and O4P-09E remain out of scope.

## Release-bridge successor

After the accepted repair candidate was committed, exact-head Actions run
33026459916 / build job 98368853021 passed the canonical full check and stopped
only at the generic ownership scanner for the four explicitly reowned Judge
guards plus five Judge research records. Terminal-only reownership head
c9cf348e457c201ef4f60c1ea5b639baa8050c44 then passed terminal-metadata and
forbidden checks in run 33027684130, but correctly skipped artifact build and
Pages deployment because terminal lanes do not publish semantic assets.

Audit the bounded release-bridge successor against base
c9cf348e457c201ef4f60c1ea5b639baa8050c44. Its only permitted paths are this
brief, the existing O4P-09D archive record, and the synchronized O4P-09D
terminal ledger fields. Verify that product, ordinary tests, all review files,
contracts, dependencies, workflow, generated API, and O4P-09E bytes remain
identical to c9cf348e. Verify that the record truthfully preserves the accepted
product fingerprint 983f4eb0587534870e48dfa6fccc6f2a30c240805a47a6bd4d3016492b5718de,
the full-check pass, exact ownership classification, terminal-lane success,
and deploy skip. The semantic successor exists only to make the canonical
workflow build and deploy those already audited product bytes.

Return O4P-09D-REPAIR-4-RELEASE-BRIDGE-AUDIT-OK only when
BLOCKER/HIGH/MEDIUM/LOW are all zero. The replacement exact-head full check,
forbidden pass, Pages deployment, served assets, terminal shipped metadata,
and O4P-09E remain out of scope.
