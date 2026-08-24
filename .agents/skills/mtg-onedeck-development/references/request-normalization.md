# Request normalization

This file is the canonical intake schema for OneDeck work. The LLM converts
ordinary user prose into this form; the user is never required to learn or
write the schema.

## Canonical form

For every non-trivial project request, normalize once before tool use:

```md
Intent: <inspect | plan | change | goal> [+ ship]
Program: <none | ordered milestone IDs>
Goal: <one outcome sentence>
Constraints:
- <hard scope, compatibility, safety, and authority boundaries>
Done when:
- <observable completion evidence>
Budget objective:
- <token/time/call target or "repository default">
Authority:
- local writes: <yes | no>
- git commit: <yes | no>
- git push: <yes | no>
- deploy/publish: <yes | no>
- release/ship: <yes | no>
- other external writes: <explicit list | none>
```

`Intent` selects the work shape but never grants an Authority bit. `+ ship` is
reserved for an explicitly
authorized end-to-end release workflow; commit, push, deploy/publish, and
release/ship otherwise remain independent authority bits. `Program` is `none`
unless the user explicitly names or accepts an ordered milestone program. A
milestone ID may be selected from the live ledger only after normalization; it
is not invented in `Program`. A milestone execution still receives the
six-field envelope defined by `document-governance.md`.

## Inference rules

- Answer, explain, inspect, review, or diagnose -> `inspect`; no mutation.
- Compare options or produce a proposal -> `plan`; no mutation unless the user
  also asks to apply it.
- Write, rewrite, change, build, implement, or fix -> `change`; one milestone.
- Use `goal` only when the user explicitly names or accepts an ordered
  milestone program such as `A -> B -> C`; milestones remain serial.
- “Finish”, “complete”, “do not stop”, sleep/absence, or a list of outcomes does
  not create a program. Keep `Program: none` and use the otherwise applicable
  intent unless an ordered milestone program is explicit.
- Grant git commit, git push, deploy/publish, and release/ship independently
  from the exact original language. Add `+ ship` only for explicit end-to-end
  release or ship authority. A commit-only, push-only, or deploy-only request
  never acquires the other authority bits.

Infer reversible implementation details when the repository establishes a safe
default. Ask one concise question only when a missing answer would materially
change scope, authority, success criteria, or an irreversible/external action.
Do not ask the user to rewrite a request into this schema.

The normalized form may narrow ambiguity but must not add product scope,
milestones, dependencies, destructive actions, credentials, purchases, or
external writes. The original user message remains the authority if the
normalization conflicts with it.

## Visibility and storage

Show the normalized form once in commentary for `change`, `goal`, or any request
with external authority. A trivial `inspect` or `plan` request may keep it
internal when displaying it would add more text than it saves.

Store only the compact normalized form in the continuation packet. Do not copy
the original conversation, source tour, raw logs, or repeated instructions into
workers, auditors, or later milestone cycles.

## Budget defaults

Budgets trigger compaction or fresh-context handoff; they never waive quality
evidence.

- supervisor visible usage: 750k-token objective; 1.0M hard ceiling per lineage
- team usage: 1.2M-token objective; 1.6M hard ceiling per milestone
- supervisor model cycles: 120 objective; 160 hard ceiling per lineage
- team model cycles: 320 objective; 400 hard ceiling per milestone
- context compactions: at most two per logical role lineage
- fresh same-role continuations: at most one per logical role lineage; it shares
  the original implementer or auditor slot and every existing counter
- continuation and terminal packet: at most 4 KiB each
- one bounded tool stage returned to the model: normally at most 12 KiB

When the user supplies a different budget, it replaces only `Budget objective`.
The hard ceilings above remain unchanged unless a separate explicit governance
ruling changes them. If an objective would make the stated `Done when`
impossible, disclose the conflict and preserve the quality boundary rather than
silently shrinking completion.

## Examples

User: `4人対戦の方法を確認して`

```md
Intent: inspect
Program: none
Goal: 現在の4人対戦手順と制約を確認して説明する。
Constraints:
- 読み取り専用。pending domain、loop-state、製品を変更しない。
Done when:
- live実装と正本に基づく手順、制約、注意点が示される。
Budget objective:
- repository default
Authority:
- local writes: no
- git commit: no
- git push: no
- deploy/publish: no
- release/ship: no
- other external writes: none
```

User: `契約文章は書き換えよ。依頼文はこの形にLLMが整形するようにしてくれ。`

```md
Intent: change
Program: none
Goal: OneDeckの恒久契約を更新し、自由文依頼をLLMが正規形へ変換する。
Constraints:
- 統治のみ。製品挙動と品質ゲートを変えない。
- ship権限は追加しない。
Done when:
- 正規化schema、権限推論、context/call上限がactive contractとreview testに存在する。
Budget objective:
- repository default
Authority:
- local writes: yes
- git commit: no
- git push: no
- deploy/publish: no
- release/ship: no
- other external writes: none
```

The internal milestone ID is selected from live authority after this record is
formed; the quoted request does not itself name a program.

## Classification cases

This compact table is executable acceptance for authority inference:

| Request signal | Intent | Program | + ship | local writes | commit | push | deploy/publish | release/ship |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `inspect or explain` | `inspect` | `none` | `no` | `no` | `no` | `no` | `no` | `no` |
| `rewrite one outcome` | `change` | `none` | `no` | `yes` | `no` | `no` | `no` | `no` |
| `complete A -> B` | `goal` | `A -> B` | `no` | `yes` | `no` | `no` | `no` | `no` |
| `commit changes` | `change` | `none` | `no` | `no` | `yes` | `no` | `no` | `no` |
| `push branch` | `change` | `none` | `no` | `no` | `no` | `yes` | `no` | `no` |
| `deploy preview` | `change` | `none` | `no` | `no` | `no` | `no` | `yes` | `no` |
| `ship release end-to-end` | `change + ship` | `none` | `yes` | `no` | `yes` | `yes` | `yes` | `yes` |
