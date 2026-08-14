# O4P-04C implementer correction 2 (final bounded return)

Milestone: `O4P-04C`

Owner: same bounded Luna xhigh implementer

Authority:
`research/cr-grounding/o4p-04c-display-pairing.contract.draft.md`

## 812x375 paired-surface overflow

The real browser at 812x375 reports document horizontal overflow of 72px.
Diagnosis: `online-display-pairing__surfaces` keeps two 377px columns, while
each independently responsive A/B child needs the full landscape width; the
Table child reaches 465px and the Personal child 405px. The pairing wrapper,
not either frozen A/B component, is responsible for the over-constrained split.

Change only `src/components/online/onlineDisplayPairing.css`: stack the two
paired surfaces into one full-width column at an explicit breakpoint that
includes 812px while retaining the 1440px two-column layout. Preserve the
three opponent controls in the existing 812x375 landscape form, all existing
375/1440 behavior, ordinary scrolling, and the no-fixed-overlay rule. Do not
modify either child CSS/component or any other behavior.

Run the complete eight-file / 33-test O4P-04C targeted suite, scoped ESLint,
`npx tsc -b`, and `git diff --check`. Browser rerun remains Judge-owned. This is
the second and final implementer correction return. Do not run the release full
check or perform git operations.
