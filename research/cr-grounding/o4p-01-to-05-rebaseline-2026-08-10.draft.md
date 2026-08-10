# O4P-01 to O4P-05 Re-baseline Plan

Date: 2026-08-10
Authority: user-ruling-2026-08-10
Status: judge-owned roadmap registration draft

## Decision

The historical O4P-01H and O4P-01I entries remain unchanged as shipped
milestones. O4P-01 is re-baselined to close at O4P-01N because the former
I-to-L grouping would combine unrelated state, authority, multiplayer, and
replay axes.

The new registered sequence is:

```text
O4P-01I -> O4P-01J -> O4P-01K -> O4P-01L -> O4P-01M -> O4P-01N
  -> O4P-02A -> O4P-02B -> O4P-02C -> O4P-02D -> O4P-02E
  -> O4P-03A -> O4P-03B -> O4P-03C -> O4P-03D
  -> O4P-04A -> O4P-04B -> O4P-04C -> O4P-04D
  -> O4P-05A -> O4P-05B -> O4P-05C -> O4P-05D
```

Every new entry is `pending`. Each entry depends directly on the preceding
entry, so future work is visible but cannot be selected ahead of its parent.

## Core closure boundary

- O4P-01J owns atomic stack-object, stack-zone, runtime, registry, and
  announcement add/replace/remove transactions. Retargeting is immutable
  record replacement. Countering and resolution-start extraction are only
  transaction boundaries; priority, authority, and resolution readiness remain
  O4P-01K responsibilities.
- O4P-01K owns turn, phase, step, priority, pass, APNAP, trigger placement,
  SBA, cleanup, and resolution-ready state.
- O4P-01L owns control effects, search, visibility, play permission, and
  decision authority. Network projection remains O4P-02D.
- O4P-01M owns Commander, multiplayer combat, and player-exit state. Full
  combat damage automation is not required for the MVP; guided/manual
  application remains explicit.
- O4P-01N owns typed Core commands/events, actor and decision-maker fields,
  deterministic randomness, replay, correction, and the four-player
  headless Core closure gate.

O4P-01 closes only when a single process can deterministically execute, save,
and replay the four-player Commander MVP without network or UI.

## Application and release phases

- O4P-02 is the local in-memory Online Application Contract. It does not use
  Cloudflare and ends at a local four-client plus Table Display room.
- O4P-03 puts the O4P-02 contract onto Cloudflare Worker, Durable Object,
  SQLite, WebSocket, reconnect, capability, and observability infrastructure.
- O4P-04 is the two-screen Personal/Table UI phase.
- O4P-05 is the MVP release phase, including the O4P-00B ruleset update,
  privacy, recovery, load, security, and production release gates.

## Governance re-baseline

No O4P-01 parent milestone after O4P-01N may be added automatically. A new
Core parent requires a new explicit user re-baseline ruling. Audit fixes and
additional tests remain subtask or repair-wave work inside the active parent;
they do not create unbounded new parent milestones.

## Deferred boundaries

No future entry is evidence that its behavior is implemented. Contracts,
acceptance tests, cold audit, full check, CI, and deployment evidence are
required independently for each milestone. O4P-02 and later entries do not
retroactively claim Online, Cloudflare, UI, or release support in O4P-01I.
