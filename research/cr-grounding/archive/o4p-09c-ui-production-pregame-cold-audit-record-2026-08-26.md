# O4P-09C-UI production Pregame cold-audit record

Date: 2026-08-26
Milestone: `O4P-09C-UI`
Risk: R3 / BROAD
Base SHA: `b87fc0b47b8a7073ee3037f6bd55e4a46e21ada8`

## Audit trail

The fresh-context cold auditor `/root/o4p09c_ui_cold_audit` audited semantic
fingerprint
`eced7a108043cb54d6806e460edbfc06afb64c95bdc518a37b7f0ee072448ebb`
and returned `BLOCKER/HIGH/MEDIUM/LOW = 1/2/2/0`. Findings were:

1. Pregame HTTP commands bypassed the shipped capability-security boundary.
2. A started response without Pregame failed open into gameplay.
3. Production UI and responsive evidence were absent.
4. Background recovery left controls apparently enabled while discarding input.
5. Retry generated a new command identity and could double-apply a manual marker.

After repair, the same auditor inspected fingerprint
`f928eda312aa483e9a224c329ca12508462543e24e2291e174259c6b904cb3ba`
and returned `0/2/1/0`. The remaining findings were:

1. Local/Remote journal-to-final-root parity was not compared by one executable
   test.
2. Real viewport, overflow, visible-focus, console, keyboard, and mulligan-bottom
   evidence was incomplete.
3. Pregame envelope kind was classified before security admission.

## Resolution evidence

- The Pregame route now uses the existing HTTP security admission, generation,
  rotation/expiry, rate, collision, and controller-lease boundary before
  validating command kind or applying Pregame semantics.
- Start/recovery without a valid 40-life Pregame projection remains in the
  lobby/recovery failure state and never starts gameplay transport.
- Retry preserves the original command ID and payload across an ambiguous
  transport failure.
- `src/online/cloudflare/__tests__/variableRuntimeV4.test.ts` drives identical
  persisted initial bytes, server plan, and accepted journal through the local
  handler and Durable Object HTTP path for two and four players, then compares
  validated audience projections and the final turn-one Protocol root.
- `src/components/game/PregameLayer.test.tsx` covers Enter activation and exact
  interactive mulligan-bottom count. `src/components/online/PublicOnlineApp.test.tsx`
  completes the two- and four-player Pregame journeys and verifies recovery
  gating.

## Same-session browser evidence

The Judge used the existing `GameScreen` and Pregame CSS through the dedicated
visual-fixture entry in one in-app Browser session after implementation
stabilized. No credential, Room ID, invite, private card identity, or raw error
was recorded.

| Viewport | Seats | Horizontal overflow | Minimum control height | Console errors |
| --- | ---: | ---: | ---: | ---: |
| 375x812 | 2 | 0 | 44px | 0 |
| 812x375 | 2 | 0 | 44px | 0 |
| 1440x900 | 4 | 0 | 44px | 0 |

Keyboard evidence on the 375x812 viewport selected the exact one-card bottom
choice, enabled the submit control, and activated it with Enter. The fixture
recorded `submit-mulligan-bottom`; the focused control matched `:focus-visible`
and had a computed 2px solid outline.

The same cold auditor then audited semantic fingerprint
`56bb1b24416e7f14f1048ad5e8b51d20f97a4ea83a2d551978f693214b66e36c`
and returned `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`, verdict PASS and eligible
for audited promotion pending the release full check.

The first release full check stopped at the historical O4P-03B Cloudflare
import guard because it had not yet admitted the required shipped Pregame
boundary. The Judge made the exact meaning-preserving allowlist repair in the
O4P-03B, O4P-03C, and O4P-03D verifiers. All three affected verifiers and the
O4P-09C historical scope review then passed before the final full check.

Affected-claim audit then found that O4P-05C still froze the predecessor
verifier and Cloudflare product hashes, and O4P-05D froze the O4P-05C verifier
plus the older untracked protected-path set. The Judge synchronized those exact
hashes and the exact O4P-09C-UI test/fixture path set. Both O4P-05C and O4P-05D
verifiers passed afterward; no wildcard or product authority was added.

## Final release-check result

The second and final permitted `npm run check` completed all static verifiers,
lint, and the Core suite (`228` files / `2097` tests) successfully, then failed
the DOM lane in `15` tests; the build lane was therefore skipped. The failures
cover stale exact-path/import/hash guards, obsolete GOV-CODEX-57 expectations,
raw CSS fallback colors, a recovered-projection expectation, and a substantive
solo/online boundary conflict caused by `components/game/PregameLayer.tsx`
importing the online Pregame model. The candidate is `repair-required`, is not
eligible for audited or shipped promotion, and O4P-09D must not start. The hard
two-full-check ceiling and the same-lineage correction allowance are exhausted;
a new authorized repair lineage is required.

## Repair candidate 1

The user's 2026-08-26 continuation resumed the same acceptance under the active
program's existing local-write authority. The repair preserves cumulative
counters and separates the mode-neutral product correction from Judge-owned
historical guard synchronization. No commit, push, deploy, or ship authority
was inferred.

The first repair implementation still required a new exact import allowance in
the active Solo/Online verifier and left colocated transport mocks inside an
older production-only scan. The Judge rejected that route, restored all three
historical verification files byte-for-byte, and issued correction 1: a
presentation-only Online component port plus tests under `__tests__`.

Correction 1 was implemented by the existing Luna/xhigh implementer lineage.
`OnlinePregameLayer` now imports no Online module and exposes only a structural
presentation view plus action callbacks; `PublicOnlineApp` is the sole adapter
to the shipped Pregame command controller. The unchanged Solo/Online, O4P-01H,
and O4P-04A boundaries passed, as did the final focused set (`19` files / `122`
tests), all six Cloudflare/O4P-05C/D exact-hash verifiers, docs, lint,
TypeScript/Vite build, and `git diff --check`.

The Judge repeated final-browser verification in one in-app Browser session on
the repaired composition. At `375x812`, `812x375`, and `1440x900`, horizontal
overflow was `0`, the minimum visible control height was `44px`, secret-marker
detection was false, and console errors were `0`. The desktop fixture rendered
four seats. On `375x812`, exact one-card selection enabled submission; Enter
recorded `submit-mulligan-bottom`, and the focused submit button matched
`:focus-visible` with a computed `2px solid` outline.

The first repair audit invocation was administratively rejected because the
Judge supplied the canonical tree hash where the audit protocol required the
preflight semantic fingerprint; it made no product finding. With the correct
semantic fingerprint
`be406b666877f48e3b8fc735dee39917164a8add5c4e07bb94b6797496a52d41`,
the existing fresh-context Sol/high R3/BROAD auditor returned
`BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`, verdict PASS.
