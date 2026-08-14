# O4P-04B implementer correction 2 (final bounded return)

Milestone: `O4P-04B`

Owner: same bounded implementer

Authority:
`research/cr-grounding/o4p-04b-table-display.contract.draft.md`

Initial cold audit: BLOCKER 0 / HIGH 1 / MEDIUM 1 / LOW 0 at semantic
`2e195eedf79eff1d1034301d4dd18197980d0348e21b7fb956272949c89eb46d` and
context `721de7d09c8e634ce6ccf6f32eb64b3ce0cace1bcea601e4f0601eb58567418e`.

## HIGH O4P04B-HIGH-001: validator-copy descriptor race

The shipped projection validator can inspect a canonical root `game` value and
then copy a different descriptor value from the same Proxy into its successful
canonical result. `buildTableDisplayViewV1` currently consumes that first
successful result directly, allowing noncanonical caller text to reach a card
label.

Without editing the shipped validator or any existing file, validate `input`
once, then validate the first successful frozen `value` again and consume only
the second successful canonical `value`. Fail closed if either pass fails. Do
not retain, merge, default, trim, or expose issues.

Judge-owned review now includes the exact descriptor-switching root Proxy and
requires the generic unavailable state with no sentinel text.

## Judge-owned MEDIUM closure

The Judge expanded the architecture review to scan all other non-test
production source for reverse Table Display/fixture reachability and to enforce
a base-relative changed-path allowlist including explicit package/config/
version/cache/root-entry prohibitions. Do not edit that evidence.

Run the complete targeted O4P-04B suite, scoped ESLint, `npx tsc -b`, and
`git diff --check`. Return changed files and exact outcomes. This is the second
and final implementer correction return. Do not edit Judge evidence or perform
git operations.
