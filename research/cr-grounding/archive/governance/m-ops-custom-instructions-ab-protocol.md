# M-OPS Custom Instructions A/B protocol

Status: prepared, not yet executed. The experiment requires two fresh,
non-forked top-level Codex tasks and therefore must not be simulated inside the
implementation task that creates the measurement tooling.

## Treatment text

Paste the following text into personal Codex Custom Instructions exactly as
written. Do not add it to this repository's `AGENTS.md` during the experiment.

> In Code Mode, within each bounded stage, run independent, functions.exec-available tool calls concurrently in one functions.exec call. Use await Promise.allSettled([...]) when partial results are useful, and inspect every result; use await Promise.all([...]) only when any failure should abort the batch. Keep dependencies, waits/resumes, approvals, conflicting or interdependent mutations, and adaptive investigations where each result may change the next step sequential. Do not split otherwise batchable inspections across outer tool calls.

## Fixed task

Run once without the treatment and once with it, each in a new non-forked task
at the same HEAD, model, reasoning setting, and permission profile:

> 変更禁止。`cr-609-one-shot-mass`について、台帳・依存・契約・既存プリミティブ・テスト・不足を証拠付きで調査する。フルcheckは禁止。

Required coverage is exactly six items: ledger, dependencies, contract,
existing primitives, tests, and gaps. Record the two session ids, then compare
them with `npm run codex:usage -- --session <treatment> --compare <control>`.

## Decision rule

- Proceed to a three-milestone personal trial only when all six coverage items
  are equivalent, model cycles or cached input improves by at least 20%, and
  the other metric worsens by less than 10%.
- Otherwise record `inconclusive` and re-evaluate after three matched pairs.
- Remove the instruction when quality declines or both metrics worsen.
- The external 27-45% report is non-official, read-heavy evidence and is not a
  target for this repository.
