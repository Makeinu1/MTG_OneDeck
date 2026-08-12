# M-OPS-SESSION-BOUNDARY active-program proposal

Status: `resolved-for-judge-integration`; this draft is not ledger authority.

## Established fact

The registered O4P entries form a direct dependency chain. O4P-02A is shipped,
and O4P-02B is the first unfinished entry. Without a machine-readable active
program, the current selector demonstrably returns `cr-114-emblems` instead.

## Recovered authority and bounded decision

The live O4P-02A entry records the user ruling: "O4P-02A through O4P-02E
publication without per-milestone approval." That current repository authority
fixes the bounded `O4P-02` choice; it does not authorize extending the active
program through O4P-05D.

The judge must activate exactly the existing chain from `O4P-01G` through
`O4P-02E`, then return to the ordinary queue. Until the ledger update is frozen
and audited, invoke `npm run codex:context -- --domain O4P-02B`.

## Ledger shape after approval

Add exactly one object under `goalPolicy`:

```json
"activeProgram": {
  "id": "O4P-02",
  "domainIds": [
    "O4P-01G",
    "O4P-01H",
    "O4P-01I",
    "O4P-01J",
    "O4P-01K",
    "O4P-01L",
    "O4P-01M",
    "O4P-01N",
    "O4P-02A",
    "O4P-02B",
    "O4P-02C",
    "O4P-02D",
    "O4P-02E"
  ]
}
```

Do not append O4P-03A or later. Do not change `crOrder`, status, dependency, or
unrelated entries.
