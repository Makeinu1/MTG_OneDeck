# M-MOBILE-DENSITY cold-audit brief

Status claim under audit: `implemented-not-audited`.

Audit the current uncommitted tree adversarially against `docs/acceptance.md` section `M-MOBILE-DENSITY`. Do not assume the implementation or tests are correct.

## Claimed scope

- 375×812 and 390×844 portrait: five creatures, three land bundles, three other permanents, and five hand cards are fully visible before scrolling.
- 812×375 and 844×390 landscape: battlefield cards preserve 488:680 and stay inside their measured shelves; landscape hand remains unchanged.
- Six-plus hand cards and four-plus land bundles remain reachable by horizontal scroll; dense battlefield remains reachable through wrapping or overview.
- One mobile tap pins a preview containing a 44px-or-larger explicit action-menu button; double-tap, drag, desktop right-click, and desktop layout remain intact.
- No GameState, GameCommand, persistence schema, dependency, or cache-version change.

## Evidence claimed by the judge

- `src/components/game/__tests__/review.mobile-density.test.ts`
- `src/components/game/__tests__/review.mobile-preview-action.test.tsx`
- Targeted suite: 7 files / 44 tests passed.
- Full `npm run check`: lint passed; 277 test files / 2206 tests passed; build/typecheck passed.
- `git diff --check`: passed.
- `npm run check:forbidden` reports only judge-owned `docs/acceptance.md` and the two judge-owned `review.*` files; adjudicate provenance from the diff rather than treating those judge changes as implementer violations.
- Real-browser verification is not claimed: the in-app browser was blocked while reconnecting to the local fixture URL. Treat this as missing evidence, not as a pass.

## Required audit procedure

1. Read `AGENTS.md`, this brief, the acceptance section, and the complete current diff. Do not edit any file and do not use git operations that change state.
2. Re-run the two `review.mobile-*` tests and the relevant ordinary layout/component/fixture tests. Run broader checks only if needed to challenge the claim.
3. Check the effective CSS cascade at every overlapping mobile media query. Look specifically for fixed widths/minimums, flex/grid replacement, hidden overflow, viewport-height conflicts, card aspect distortion, unreachable overflow, and desktop leakage.
4. Independently recompute boundary geometry for all four mobile viewports, including actual board/support/hand padding and gaps. Test count boundaries 0/1/3/5/6/15 and sparse/dense states.
5. Verify the `mobile-density` fixture really contains exactly 5 creatures, 3 distinct land bundles, 3 other permanents, and 5 hand cards.
6. Trace one tap → pinned preview → explicit action → same-card menu, second tap, pointer-down drag guard, and desktop right-click. Confirm the action hit area and pointer-events behavior in effective mobile/desktop CSS.
7. Check that engine/state/schema/dependencies and unrelated desktop behavior are unchanged.
8. If a browser is available, inspect 375×812, 390×844, 812×375, 844×390, and 1440×900 and read console warning/error logs. If unavailable, state the limitation and do not infer visual passage from unit tests.

## Output

Return findings only, ordered BLOCKER/HIGH/MEDIUM/LOW. Each finding must include exact file and line, reproduction or deterministic geometry, and impact on MMD-* acceptance. Then list checks run and limitations. If no finding exists, say so explicitly. Do not modify files.

## Re-audit addendum

The first cold audit returned two HIGH findings and one MEDIUM finding. Re-audit the current tree after remediation, with particular attention to:

- React-portal click propagation from the preview action into the owning `GameCard`;
- preservation of the pre-change compact desktop dimensions at widths of 900px or greater and heights of 520px or less, while keeping fixed `!important` widths out of the mobile cascade;
- reachability of the explicit action when rules text exceeds the preview height.

The judge reran the required seven-file suite (44/44) and full `npm run check` (277 files / 2206 tests, build/typecheck passed) after remediation. Treat these as claims to challenge, not as proof.

## Browser-gate remediation and final re-audit

The judge subsequently obtained real Chromium evidence using the dev-only `mobile-density` fixture in exact-size iframe browsing contexts. The temporary viewport/console harness and temporary fixture instrumentation were removed before this audit; they are not part of the frozen diff.

Claimed browser evidence:

- 375×812 and 390×844: the initial 5 creatures, 3 land bundles, 3 other permanents, and 5 hand cards are inside their measured lanes; document scroll width/height equals the viewport.
- Browser measurement initially found support cards below the 44px floor. The current `SupportRow.tsx` and portrait CSS remove the duplicated width deduction and align the shelf's 12px horizontal padding with the solver. Re-measurement reported a computed 44px width at 375 and approximately 47px at 390.
- 812×375 and 844×390: all battlefield cards are inside their measured shelves, remain one row, and retain 488:680 within subpixel tolerance; document scroll width/height equals the viewport.
- 1440×900: document size equals viewport and desktop card/menu behavior remains available.
- A synthesized real-browser touch pointer sequence opened the preview, exposed a 172×44 action, and opened the same card's menu; a second touch sequence opened the same-card menu. CUA drag reduced hand count 5→4 and produced one stack item. PC right-click opened the same creature's action dialog.
- Fixture-local capture of `console.warn`, `console.error`, `error`, and `unhandledrejection` was `[]` in every viewport/interaction case. The Browser plugin itself emits one parent-harness `MutationObserver` error when instrumenting any iframe; this is outside the fixture browsing context and was separated from the fixture-local capture.

Post-fix evidence claimed by the judge:

- Required seven-file suite: 45/45 passed.
- Full `npm run check`: lint passed; 277 files / 2207 tests passed; build/typecheck passed.
- `git diff --check`: passed.

Re-audit the current frozen diff, especially the 375px support-width arithmetic and the claim that the mobile-only correction does not affect landscape or desktop. Return a final SHIPPED-OK decision. Treat browser evidence as a claim to check against the code and metrics, not as proof by assertion.

## Final cold-audit record

- Auditor: `mobile_density_cold_audit`
- Verdict: `SHIPPED-OK`
- Findings: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
- Independent checks: required seven-file suite 45/45, additional CardView suite 10/10, `git diff --check` passed.
- Boundary adjudication: 375px support width resolves to 44px; 390px resolves to 47px. The correction is portrait-only and does not alter landscape or desktop calculations.
