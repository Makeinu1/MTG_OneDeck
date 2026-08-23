# O4P-07C R3/BROAD Cold-Audit Brief

Date: 2026-08-23
Role: read-only fresh-context cold auditor
Base SHA: `6899fd4a9e1adba71651d883174647970f7a5d59`
Authority:
`research/cr-grounding/o4p-07c-fixed-runtime-removal-production-release.contract.draft.md`
Acceptance: `research/cr-grounding/o4p-07c-acceptance-brief.draft.md`

## Frozen candidate paths

Audit exactly these twenty paths:

- `package.json`;
- `scripts/__tests__/machine-checks.test.mjs`;
- `scripts/__tests__/verify-o4p-07c-production-runtime.test.mjs`;
- `scripts/checks/machine-checks.mjs`;
- `scripts/checks/tsconfig.json`;
- `scripts/checks/verify-o4p-07c-production-runtime.ts`;
- `src/online/cloudflare/__tests__/lobbyRuntimeV1.test.ts`;
- `src/online/cloudflare/__tests__/review.o4p-06c-browser-safe-lobby.test.ts`;
- `src/online/cloudflare/index.ts`;
- `src/online/cloudflare/runtime.ts`;
- `src/online/lobby/__tests__/tableStartV1.test.ts`;
- `src/online/lobby/fixtures/fixedStartV1.ts`;
- `src/online/lobby/index.ts`;
- `src/online/publicApp/index.ts`;
- `src/online/publicApp/publicAppClientV1.test.ts`;
- `src/test/architecture/review.o4p-06e-public-online-app-boundary.test.ts`;
- `src/test/architecture/review.o4p-07c-fixed-runtime-removal.test.ts`;
- `research/cr-grounding/o4p-07c-acceptance-brief.draft.md`;
- `research/cr-grounding/o4p-07c-fixed-runtime-removal-production-release.contract.draft.md`;
- `research/cr-grounding/o4p-07c-implementation-brief.draft.md`.

This brief is Judge metadata outside the twenty-path semantic fingerprint but
is included in the staged audit candidate fingerprint supplied with the
handoff.

## Adversarial questions

1. Does every syntactically valid legacy deck/ready/start/start-with-table
   request against an existing forming lobby receive exactly the secret-free
   HTTP 426 body, while malformed/extra/wrong-version/post-start requests stay
   generic and no state/Scryfall/auth mutation occurs?
2. Can any Worker/runtime/barrel/production entry still reach or successfully
   invoke the fixed catalog, raw deck text bootstrap, legacy mutators, or legacy
   success handlers? Are v1 create/claim and all v2 paths preserved?
3. Is `fixedStartV1.ts` genuinely regression-only, with historical behavior
   preserved and every production import/re-export closed? Are the three fixed
   fixture bytes unchanged from base?
4. Does the production verifier correctly traverse emitted value imports,
   handle type-only/export/dynamic imports, reject unresolved/ambiguous paths,
   avoid symlink/output ambiguity, and scan the right Pages and Worker markers?
   Look for both false negatives and false positives that would make CI or
   release evidence unreliable.
5. Is the verifier sequenced after the one canonical build for both default and
   Pages-base flows, with no second build, dependency/lock/config change, or
   bypass in machine-check tests?
6. Are the Judge-owned historical review changes narrow supersession repairs
   that preserve O4P-06C/O4P-06E security/table meaning rather than weakening
   them? Does the new O4P-07C review actually bind the contract hashes and
   terminal behavior?
7. Do privacy, duplicate-deck IDs, dynamic genesis, restart/reconnect/replay,
   size limits, Solo behavior, and post-start mutation boundaries remain intact?

## Frozen targeted evidence

- targeted DOM/review regression: 10 files / 41 tests passed;
- verifier plus machine-check ordinary tests: included in that green set and
  independently reported as 2 files / 12 tests passed;
- affected ESLint passed;
- `npm run build -- --base=/MTG_OneDeck/` passed: 327 modules, Pages asset
  `index-DfRb-Q8R.js` plus unchanged CSS `index-DB7TO263.css`;
- production verifier passed `graph=324 pages-js=1 worker=deferred` on the fresh
  build;
- Wrangler 4.125.0 dry-run produced 1054.18 KiB / gzip 172.79 KiB with only
  `ONLINE_ROOMS` and `CF_VERSION_METADATA`; verifier then passed
  `graph=324 pages-js=1 worker=3`;
- `git diff --check` passed;
- full `npm run check`, live deployment, and final four-browser production
  proof have not run and must not be claimed by this audit.

Do not edit, commit, push, deploy, run full `npm run check`, or perform live
browser/Worker operations. Return findings by BLOCKER/HIGH/MEDIUM/LOW with exact
paths/lines and the recomputed staged fingerprint. Return
`O4P-07C-AUDIT-OK-PENDING-FULL-CHECK` only if BLOCKER/HIGH are zero.

## Judge surgical repair after first audit

The first audit correctly rejected the candidate with two HIGH findings:

1. no-substitution template dynamic imports were ignored and non-literal
   dynamic/`require` forms did not fail closed;
2. Pages scanning did not prove that `index.html` referenced an existing
   JavaScript artifact, so an unrelated stale file could satisfy the scan.

After the implementer's two bounded repair waves were exhausted, the Judge
changed only the verifier and its ordinary adversarial test. Static string and
no-substitution-template dynamic imports are now traversed; import-equals is
handled; non-literal/unsupported dynamic imports and `require` calls reject.
Pages `script src` attributes are parsed closed, must be quoted/local/under
`assets`, unique, non-escaping, JavaScript, and present in the artifact set;
all emitted JavaScript remains marker-scanned.

New targeted evidence: verifier/machine/new O4P-07C review 3 files / 17 tests
passed, affected ESLint passed, `npm run build -- --base=/MTG_OneDeck/` passed
with the same `index-DfRb-Q8R.js`, and the repaired verifier passed
`graph=324 pages-js=1 worker=deferred`. Runtime/product bytes were unchanged by
this surgical repair, so the previously generated Worker dry-run bundle remains
the corresponding product bundle evidence. Full check and live release remain
unrun.

### Second Judge verifier repair

The first reaudit left one HIGH: the source-regex HTML parser treated commented,
`application/json`, and `template` scripts as executable Pages entry evidence.
The Judge again changed only the verifier and its ordinary adversarial test.
The verifier now loads the already-installed JSDOM through an `unknown` plus
constructor guard, parses HTML without executing resources/scripts, and accepts
only unique local `type=module` script references outside `template`/`noscript`
and without `nomodule`. The exact three cold-audit probes are regression tests.

Repair evidence: verifier/machine/new review 3 files / 18 tests passed, affected
ESLint passed, the full TypeScript/Vite build passed with the same Pages assets,
and the verifier passed `graph=324 pages-js=1 worker=deferred`. No dependency,
runtime/product, contract, public UI, or Worker source byte changed in this
second repair. Full check and live release remain unrun.

### Final bounded HTML-context repair

The second reaudit found that JSDOM still reparsed a head `noscript` child as a
sibling, and that a document `base[href]` or an absolute URL equal to the
synthetic origin could substitute a non-local browser target. The verifier now
rejects any `noscript`, any `base[href]`, any absolute/protocol-relative script
source, and still requires the referenced local asset to exist. JSDOM is
constructed with `outside-only` and no resource loader; document scripts and
network resources are not executed or fetched.

The exact noscript, hostile base, and sentinel-absolute probes are regression
tests. Final bounded-repair evidence: 3 files / 19 tests passed, affected ESLint
passed, TypeScript/Vite build passed with the same Pages assets, and the live
artifact verifier passed `graph=324 pages-js=1 worker=deferred`. No production
runtime, public UI, Worker, dependency, contract, or fixture byte changed.

### Fresh-cycle executable-script closure

The last audit still found one HIGH: a valid module entry could coexist with an
uninspected external or inline classic script, and leading whitespace on an
absolute `src` could evade the pre-trim scheme check. A fresh bounded
implementer changed only the verifier and its ordinary adversarial test. The
verifier now inspects every real DOM `script` outside `template`/`noscript`,
allows only a non-`nomodule` external module with a nonempty local source, and
rejects any raw source whose whitespace is not canonical before URL checks.

The exact external-classic, inline-classic, inline-module, and leading-space
absolute probes are regression tests. Fresh-cycle evidence: verifier/machine/new
review 3 files / 20 tests passed, affected ESLint passed, the canonical Pages
build passed with `index-DfRb-Q8R.js`, `git diff --check` and cached diff checks
passed, and the artifact verifier passed
`graph=324 pages-js=1 worker=deferred`. No production runtime, public UI,
Worker, dependency, contract, or fixture byte changed. Full check and live
release remain unrun.

### Fresh cold-audit rejection and final bounded repair

The fresh cold audit matched semantic fingerprint
`55381b69f09cdfee692292718c0efd9d9f83f753fe2ee0f2c574d9c2219797a1`
and complete fingerprint
`b9ef7db187fd4361052c59bbefb485988f6872673109e4f5f591af4dd1249adc`,
then rejected the candidate with BLOCKER 0 / HIGH 5 / MEDIUM 1. The verifier
accepted repository/import and artifact-root symlink escapes, an exact
extensionless file beside a typed module, substituted Pages asset paths, and
unquoted `src`. The legacy cutoff accepted oversized/capability-bearing deck
metadata and failed to classify a finished protocol Room as post-start.

The second and final fresh-cycle repair changed only the verifier, its ordinary
test, the Cloudflare runtime cutoff, and its ordinary lobby runtime test. Import
and artifact paths are now canonical-realpath contained and symlink closed;
module candidates reject exact-file ambiguity while harmless same-base CSS is
not treated as a TypeScript value-module candidate. Pages permits only quoted
`/assets/...` or `/MTG_OneDeck/assets/...` references with canonical raw paths.
The cutoff mirrors the legacy deck byte/metadata and table collision safety
checks without authenticating or mutating, and active, finished, or already
started state cannot receive 426.

Judge verification after repair: 9 targeted files / 59 tests passed, affected
ESLint passed, the canonical Pages build passed with 327 modules and
`index-DfRb-Q8R.js`, both diff checks passed, and the verifier passed
`graph=324 pages-js=1 worker=deferred`. Full check and live release remain
unrun.

### Judge fail-closed syntax surgery after reaudit

Reaudit accepted the prior repair but reproduced three remaining fail-open
families: protocol Room lifecycle `started` was not classified post-start;
slash/scheme-qualified and `import.meta.glob` value loaders were not rejected;
and browser-generated code graphs could branch through Worker, SharedWorker,
service-worker registration, `importScripts`, or worklet `addModule`, including
static property and element-access spellings.

Because the fresh implementer had completed both bounded waves, the Judge made
only the corresponding guard and ordinary-test surgery in the same four repair
paths. `started|active|finished` protocol Rooms and a started compatibility
lobby remain generic. Relative local imports are the only traversed local form;
absolute/scheme imports and direct `import.meta` loader calls reject. Static
browser code-loader constructor/call families reject through both dot and
string-literal bracket access. `import.meta.env` and plain non-code asset
`new URL` remain allowed; arbitrary runtime eval/fetch/DOM injection is outside
this static emitted-code-graph verifier.

Final Judge evidence after the complete surgery: the preserved nine-file suite
passed 60 tests; the final focused four-file suite passed 28 tests; affected
ESLint and both diff checks passed; the canonical Pages build passed with 327
modules and `index-DfRb-Q8R.js`; the artifact verifier passed
`graph=324 pages-js=1 worker=deferred`. The cold auditor independently confirmed
that every reproduced static-loader bypass now rejects. Full check and live
release remain unrun.

### Final cold-reaudit approval

The same cold auditor independently matched final semantic fingerprint
`250986253e6a3f6cde99ef25ef46df323676f22767ab8e7922df892e6059f587`
and pre-record complete staged fingerprint
`6630d7b0a752ab06b9fe6b3c2dc6bdd794fd68b473b6fb91b7ed502294394195`.
The final verdict was BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0, with approval token
`O4P-07C-AUDIT-OK-PENDING-FULL-CHECK`. Full check, CI, deployment, and browser
evidence remain pending and are not claimed by this approval.
