# O4P-05C Qwen implementation brief

Milestone: `O4P-05C`

Base SHA: `7dc41384bf6763986a47151d69f78f31021976fe`

Model: exact `qwen-cloud/qwen3.8-max`, reasoning effort `xhigh`

Contract: `research/cr-grounding/o4p-05c-release-gates.contract.draft.md`

Acceptance: `research/cr-grounding/o4p-05c-acceptance-brief.draft.md`

## Packet protocol

Work only on the one exact path named in the current packet. Read the contract,
acceptance brief, that path if it exists, and only directly imported types or
the companion file when necessary. Do not tour the repository. Stop and report
after the packet's focused test or static check.

## Permanent restrictions

- No git operation.
- No `npm run check`.
- No `review.*`, production source, barrel, script, package, config,
  dependency, version, docs/research, ledger, loop-state, deployment, or
  external-network edit.
- Do not weaken or delete an existing assertion.
- Use strict TypeScript, no `any`, no input mutation, and no nondeterminism.

## Packet 1

Create only:
`src/online/cloudflare/__tests__/releaseGateEvidenceV1.ts`.

Implement the closed strict validator and exported readonly types/constants
required by the contract. A static import/type check is sufficient; do not add
or edit tests in this packet.

## Packet 2

Create only:
`src/online/cloudflare/__tests__/releaseGateEvidenceV1.test.ts`.

Add ordinary green and adversarial evidence for every contract invariant.
Run only this one Vitest file. Do not edit the implementation in this packet;
report any implementation defect instead.
