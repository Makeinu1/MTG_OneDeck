# Post-FREEZE Codex Brief

最終更新: 2026-06-27
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable が M0-FREEZE 契約更新を承認した後、Codex が迷わず実装へ進むための委譲ブリーフ。

## 前提

このブリーフは **Fable承認後** にだけ使う。

承認前に Codex がしてはいけないこと:

- docs契約を変更する。
- `review.*` テストを変更する。
- `npm run m-contract-gate` で旧scorecardを上書きし、CR overlay込みの判定だと扱う。
- `704.5p` など個別SBA実装へ進む。
- git add / commit / push。

## Phase 0: Gate wiring

目的: M0-FREEZE 判定器を旧7条件 + CR-grounding overlay にする。

対象候補:

- `scripts/m-contract-gate.ts`
- `scripts/lib/mContractGate.ts`
- `research/cr-grounding/m0-freeze-overlay.json`
- `research/m-contract-gate/scorecard.{md,json}`
- `research/cr-grounding/scorecard-overlay-wiring-spec.md`
- `research/cr-grounding/q2-scorecard-overlay-test-plan.md`
- `research/cr-grounding/q2-scorecard-overlay.patch`
- `research/cr-grounding/verify-q2-patch-ready.mjs`
- `research/cr-grounding/verify-q2-patch-effect.mjs`
- `research/cr-grounding/verify-q2-scorecard-output.mjs`

実装方針:

1. `m0-freeze-overlay.json` を読み込む。
2. legacy 7 conditions に加えて CRG overlay 条件を表示する。
3. `PASS(core)` / `PASS(boundary)` / `PARTIAL` をそのまま `PASS` に潰さない。
4. freeze verdict は、Fableが契約で決めたルールに従う。
   - 推奨: required-pass は pass 必須。
   - partial は `S-* carry` として明示されている場合のみ freeze を阻害しない。
   - boundary は scope-boundary として明示されている場合のみ freeze を阻害しない。
5. `review.m-contract-gate` はレビュー専有。期待更新が必要ならFableが行う。

検証:

- `node research/cr-grounding/verify-q2-patch-ready.mjs`
- `node research/cr-grounding/verify-q2-patch-effect.mjs`
- `npm run m-contract-gate`
- `npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot`
- `node research/cr-grounding/verify-q2-scorecard-output.mjs`
- 必要なら機械チェック4点。

## Phase 1: S-CHOICE / S-TURN

目的: choice を伴うSBAを commander bridge から汎用 substrate へ移す。

根拠:

- CR 903.9a / 704.6d
- CR 704.5j
- `research/cr-grounding/rule-choice-substrate.md`

実装候補:

- `GameState.pendingRuleChoices: PendingRuleChoice[]`
- `CommanderZoneRuleChoice`
- `LegendRuleChoice`
- restore backfill:
  - `pendingRuleChoices: []`
  - legacy `pendingSbaChoices` があれば commander choice へ変換
- `resolveRuleChoice(choiceId, selection)` store action

golden cases:

- `cr-commander-9039a-rule-choice`
- `cr-legend-rule-choice`

完了条件:

- 903.9a は bridge ではなく汎用 choice として説明できる。
- 704.5j 実装時に state shape を作り直さない。
- pending choice 中は priority-ready ではない。

## Phase 2: S-EVENTS / PRIORITY

目的: CR 603.3b second bucket を現 APNAP v1 に接続する。

根拠:

- CR 603.3b / 101.4 / 117.5 / 704.3
- `research/cr-grounding/priority-event-loop.md`

実装候補:

- `PendingTrigger.stackPlacementBucket: 'ordinary' | 'ability-triggered'`
- legacy pending trigger backfill to `'ordinary'`
- `AbilityTriggeredEvent`
- `orderPendingTriggersApnap` を bucket -> APNAP -> controller chosen order へ拡張

golden cases:

- `cr-trigger-6033b-two-bucket-order`
- `cr-trigger-6033b-apnap-per-bucket`
- `cr-priority-loop-trigger-placement-rechecks-sba`

完了条件:

- explicit order が second bucket を先に指定しても CR順に正規化される。
- trigger placement 後にSBAへ戻る。

## Phase 3: S-EVENTS / MANA

目的: triggered mana ability を通常誘発としてstackへ積まない。

根拠:

- CR 605.1b / 605.4a / 605.5a
- `research/cr-grounding/mana-ability-substrate.md`

実装候補:

- `ActivatedManaAbilityEvent`
- `ManaAddedEvent`
- transaction-local `PendingManaTrigger`
- triggered mana ability plan
- manual no-stack warning path

golden cases:

- `cr-triggered-mana-ability-no-stack`
- `cr-add-mana-trigger-from-non-mana-event-is-normal-trigger`
- `cr-targeted-add-mana-trigger-is-normal-trigger`

完了条件:

- 605.1b は `pendingTriggers` に入らない。
- unsupported triggered mana ability を通常誘発に逃がさない。
- mana-related event を観測できる。

## Phase 4: S-SBA incremental

目的: `sba-inventory.md` の `S-* carry` を、価値とstate準備度で順に実装する。

優先候補:

1. 704.5p safe attachment subset
2. 704.5m unattached Aura subset
3. 704.5j legend rule

注意:

- 704.5j は Phase 1 の choice substrate 後。
- full SBA suite を一括実装しない。
- 各SBAごとに CR refs + event metadata + executable golden を追加する。

## Phase 5: S-ZONES / S-LAYERS

目的: coreを超える zone/LKI と effective snapshot を扱う。

根拠:

- CR 400.7 exceptions
- full effective-characteristics snapshot
- `research/cr-grounding/scope-partition.md`

実装候補:

- player-specific library/hand/graveyard
- public-zone exception consumers
- layer-applied ObjectSnapshot
- dummy opponent groundwork

## Handoff rule

Codex は常に「CR refs + state invariant + executable golden/test」を同時に追加する。これが崩れるなら実装を止め、研究成果物へ戻す。
