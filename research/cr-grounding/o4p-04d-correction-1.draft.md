# O4P-04D implementer correction 1

Milestone: `O4P-04D`

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Authority:
`research/cr-grounding/o4p-04d-guided-manual-actions.contract.draft.md`

## Reproducible acceptance failure

At the deterministic fixture URL
`/research/design/display-pairing/`, an actual 375x812 browser viewport has:

- `innerWidth = 375`, `documentElement.clientWidth = 365`;
- `documentElement.scrollWidth = 455`, horizontal overflow = 90px;
- the only overflowing candidate is
  `output[data-testid="display-pairing-last-action"]`, whose unbroken JSON text
  reaches x=454.98px;
- every O4P-04D section itself is within the 317px content width.

The one detected fixed element is the browser's injected
`#codex-browser-sidebar-comments-root`, not application code, and requires no
candidate change.

## Required correction

Within `src/dev/displayPairing/**` only, give the evidence output a stable
fixture-only class and CSS that keeps it in normal flow, `max-width: 100%`, and
wraps arbitrary JSON without horizontal overflow. Do not hide, truncate, or
remove the action evidence. Do not change production action/model/component
semantics, judge-owned tests, contracts, architecture tests, or git state.

Run the complete original seven-file / 18-test ordinary suite, scoped ESLint
for changed dev files, and `npx tsc -b`. Report exact changes/results. Do not
run the full release check.
