# OneDeck UX research charter (implementer draft)

## Research question

4つの実デッキを一人で回す時、ユーザーは手札・統率者・盤面・状況依存zoneのどこで迷い、
どの瞬間に「デッキが動いた」「もう1ターン回したい」と感じるか。Controlより良い配置案を、
実プレイから採取した同一snapshotで比較できるか。

## Primary participant and contexts

- 第一参加者=製品所有者本人。
- Celes / Gogo / Kefka / Muldrothaは4人ではなく4つの利用状況。
- Celes: discard→draw、蘇生、ETB、カウンター、攻撃誘発。
- Gogo: 起動型能力、tap/untap、コピー、対象変更、打ち消し、多段stack。
- Kefka: discard連鎖、変身、life loss、追放利用、遅延誘発。
- Muldrotha: mill、墓地利用、生け贄→再利用、landfall、search。
- 方向確定後、EDH経験者2人+比較的新しい人1人を初見操作の独立gateにする。

## Do not change during discovery

- engine / `GameState` / `GameCommand`契約。
- 製品snapshot schemaと`CACHE_SCHEMA_VERSION`。
- ルール強制方針、undo方針。
- 既定UIと旧Playmatのロールバック経路。

## Viewports

- 1280×800
- 1440×900
- 1920×1080

## Evidence

- 自然プレイ後のretrospective interview。
- 名前付きGameSnapshot checkpoint。
- pointer/click/contextmenu/keyboardのローカルinteraction log。
- warning、stack開始、guided prompt、undoの自動marker。
- 同一snapshotでのControl/A/B比較。

評価指標は、指定カード発見時間、hover回数、誤選択、pointer往復、menu迂回、本文拡大の要否、
結果の再探索、「もう一度同じ操作をしたいか」。自然プレイ、課題test、A/B比較は同一sessionへ
混ぜない。

pointer座標を視線とは扱わない。Observation / User statement / Interpretation / Hypothesisを
混ぜない。

## Severity

- S0: 進行不能、状態喪失、回復不能。
- S1: 中核操作を援助なしで完了不能、誤対象、誤zone。
- S2: 5秒超探索、3操作以上の迂回、反復摩擦。
- S3: 表層的な違和感。

## Exit gate

- 4デッキの中心体験を実プレイで観察。
- Owner Soak 2周で新規・再発S0/S1=0。
- 外部3人全員が中核操作を介入なしで完了しS0/S1=0。
- 対象指標が4デッキ中3以上でControl改善、残りも悪化なし。
- 「もう1ターン回したい」が所有者全4デッキで5/7以上。
- 1280×800、1440×900、1920×1080でcard寸法・overflow・hover位置を確認しconsole error=0。

本draftの製品契約化と`docs/`反映は判定者専有。

## Bounded orchestration

- selectorは次の調査順を決めるだけで、UI案の採用や「気持ちいい」の判定を行わない。
- Discovery、Coverage、A/B比較を同じsessionへ混ぜない。
- 終了checkpointだけではtask完了とせず、人間のretrospective reportを必須にする。
- Discovery中はcoverage不足、仮説、fixture比較を参加者へ見せない。
- Discoveryと中心体験Coverageの後はprototype gateで停止し、証拠統合と人間判断を待つ。
- S0/S1、3回連続の同一失敗、公開・課金・API key、判定者専有変更が必要な場合は自動反復を止める。
