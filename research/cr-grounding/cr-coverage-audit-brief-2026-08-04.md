# Cold Audit Brief: 全体CRカバレッジ査察 (2026-08-04)

まず `.claude/audit-standing.md` を読み、その規約に従って以下を監査せよ。
これは単一マイルストーン監査ではなく、エンジン全体と台帳の **カバレッジ・インテグリティ査察** である。
成果物 = findings + カバレッジマップ(findings only。コード・台帳・docs を変更しない)。

## Candidate fingerprint

- Base SHA: `2f30dba0af4eb742554c465d01775e932a20f055` (main, clean tree + 本ブリーフ+台帳編集のみ未コミット)
- 台帳編集: `research/cr-grounding/cr-backbone-ledger.json` に2026-08-04判定者席が14 domainを追加(未コミット)。追加内容の妥当性も監査対象。
- CR正本: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` (2026-06-19版固定)

## 監査対象の3層

### A. 台帳インテグリティ(最優先)

1. **status同期**: `domains[*].status` と `plannedSequence[*].status` をdomainIdで突合。不一致を列挙(domains.statusが正)。
2. **evidence実在**: status=shipped の全domainについて、evidenceに挙がったreview.*テストファイル・アーカイブが実際に存在するか確認(`ls`で存在検証。中身の是非はB層で扱う)。
3. **依存閉包**: 全domainのdependsOnが実在domain idを指しているか。循環依存がないか。
4. **2026-08-04追加分のCR照合**: 新domain 14件のboundary/manualBoundary/dependsOn/lane分類をCR原文と照合。誤ったCR引用・誤った依存・lane分類ミス(pruned相当なのにpending等)を列挙。対象id: cr-705-706-random-events, cr-707-copying-objects, cr-708-face-down-spells-permanents, cr-709-split-cards, cr-710-flip-cards, cr-711-leveler-cards, cr-713-substitute-cards, cr-715-adventurer-cards, cr-718-prototype-cards, cr-723-controlling-another-player, cr-724-ending-turns-and-phases, cr-730-merging-with-permanents, cr-732-shortcuts, cr-733-illegal-actions。

### B. shipped domainのfake-green検出

status=shipped のdomainから **ランダムではなく体系的に** 以下を抽出検証:

1. **全backbone域(100〜616)**: 各domainのreview.*テストが存在し、0件でないことを確認(`npx vitest run <file> --reporter=dot` 相当の実行は不要。ファイル存在+テストケース数カウントのみでよい。実行は判定者が後でやる)。
2. **直近shipped 6件のvacuity spot-check**(cr-310-battles, cr-303-704-roles, cr-714-sagas, cr-716-class, cr-719-case, cr-720-omen): 実装を一時的に壊さず、テストが実装の公開関数をimportしてassertしているか静的に確認(レビューテストが実装関数を呼んでいるか、assertが自明に恒真でないか)。
3. **manualBoundaryの正直さ**: shipped domainのmanualBoundaryに「manualに留める」とある挙動が、ソースコード内でauto経路(compile.tsのdecision='auto'等)に漏れていないか。最低でもcr-701-69-heal・cr-702-193-power-up・cr-702-194-teamwork・cr-720-omenの4件を源码レベルで確認。

### C. カバレッジマップ作成(成果物)

CRの節見出し(100〜905)を列挙し、各節について以下を埋めた表を作る:

| CR節 | 台帳domain | status | review.*テスト有無 | 備考(未登録/台帳未載/暗黙カバー) |

- 台帳にdomainがない節は「未登録」とし、通常Commander scopeで到達可能か推定(到達可能なのにpruned相当の記述がないものはflag)。
- 「暗黙カバー」= 明示domainはないが既存実装が該当規則を包含しているもの(例: 200系カード部位、301/302/304等の基本タイプ規則)。根拠を必ず書く。
- 第7章は700〜733の全節を漏れなく埋めること。

## 禁止事項

- コード・テスト・台帳・docsの変更(調査用一時ミューテーションはstandingどおり復元必須)。
- `npm run check` のフル実行(時間予算超過のため禁止。個別vitestファイルのdot実行も最大3ファイルまで)。
- 到達可能性バー(audit-standing.md)を満たさないfindingの報告。
- 実装文脈の推測による「おそらく動いていない」の断定。証拠(file:line)を添えること。

## 報告様式

1. カバレッジマップ(C節の表)。
2. findings: 重大度(BLOCKER/HIGH/MEDIUM/LOW) + 対象 + file:line + 具体的シナリオ。
3. 台帳追加分14件の判定: 各domainを「承認/修正要(CR条番号付き)/分類異議」で一行ずつ。
4. 最後に「台帳編集をコミットしてよいか」の推奨を一行。
