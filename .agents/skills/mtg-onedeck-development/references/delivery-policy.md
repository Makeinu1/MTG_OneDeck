# OneDeck delivery policy（HOW / 進捗判定の正本）

## 権威と適用範囲

本書は、認可されたプロダクト成果をどう作り、何を進捗・合格と判定するかを定める。
プロダクトのWHY/WHATは`docs/product-requirements.md`、候補状態、role、fingerprint、
check、releaseの詳細手順は`document-governance.md`が所有する。本書はそれらを
再定義せず、成果へ向かう運営原則を所有する。

本書だけからcommit、push、deploy、publish、shipその他の外部・不可逆権限は
生じない。

## 成果優先順位

最適化の順序は次とする。

1. 観測可能なplayer outcomeと受け入れ品質。
2. scope、authority、秘密、共有状態、不可逆操作の安全。
3. wall-clock time。
4. uncached token、外部call、金銭cost。
5. 人間割込みと手続成果物の少なさ。

統治、台帳、監査、telemetry、substrateは成果を守る手段であり、成果を代替しない。
productionのplayer journeyが進んだ量と、支援作業へ使った量を分けて報告する。

## 人間とdelivery systemの分担

人間が決めるのはGoal、Done when、scope、acceptance quality、North Starの変更、
不可逆・外部authorityである。認可された境界内ではdelivery systemが次を決める。

- model、reasoning effort、tool、parallelism、context量。
- layout、比率、density、timing、prototypeの設計変数。
- 実装順、targeted check、repair、audit depthと証拠形式。

ユーザーをpixel単位のdesign approverにしない。ユーザーへ戻すのは成果、scope、品質、
North Star、不可逆操作に実質的な選択が生じた場合だけである。token、cycle、wave、
continuation等の数値を許諾質問にしない。

## 一候補の標準delivery flow

### 1. Outcomeを一度だけ合わせる

開始時にGoal、Done when、scope、quality、authorityを自由文から正規化する。
同じ候補について形式的な再承認を繰り返さない。player-visible outcomeまたは最大2
slice以内にそれを直接unblockする最小substrateへ切る。

### 2. UIはprototypeで先に誤りを安くする

UI、音、演出は本実装より前に専用fixtureまたは分離worktreeで実寸prototypeを作る。
適切なproduct-design、game-UI、playtest能力がなければ、UI実装前にskillまたは同等の
再利用可能な手順を用意する。

375x812、812x375、1440x900と、2人・4人の代表場面で比較する。Goalと品質基準は
人間と合わせるが、exact ratioや個別pixel値はdesign ownerがreference、playtest、
fresh-context visual reviewから決める。採用値とscreenshotを凍結してから本実装する。

### 3. 一つの観測可能なsliceを実装する

同じ意味をCore、Local、Remote、人数別UIで重複実装しない。既存のmode-neutralな
state、intent、projection、UI primitiveを再利用する。完全な旅程が遠い場合も、次の
production証拠へ直接つながる最小のvertical sliceを選ぶ。

### 4. 反復中はtargeted checkを使う

変更したclaimを検証する最小のcheckと代表scenarioを使う。findingがない段階で
full check、全browser matrix、同じ監査を反復しない。失敗したscenarioは修正後に
scenario全体をやり直す。

### 5. 凍結候補を一度だけ独立監査する

UIまたはR2/R3候補は、一貫したplayer outcomeが成立してからtreeを凍結し、実装文脈を
持たない一人のcold auditorへ一度まとめて渡す。auditは実リスクに合わせてscopeし、
実装者の自己申告や多数決を合格根拠にしない。

finding後は、そのfindingと修正で無効になった証拠だけを再実行する。全候補の監査を
最初から機械的に繰り返さない。BLOCKER/HIGHが0になるまで昇格しない。

### 6. 最終候補だけをfull checkとproduction証拠へ送る

findingを閉じた同一fingerprintに対して、release前の`npm run check`を原則一度実行する。
check自体が具体的なdefectを見つけた場合は最小修正と無効化された証拠を閉じ、最終の
green checkを得る。ship権限がある場合だけexact-head CI、Pages/Worker、browser証拠へ
進む。

## リスクに応じたbeta境界

次はhard stopであり、beta速度のために緩めない。

- secret leakage、audienceまたはaction authority違反。
- shared-state corruption、deck loss、回復不能なdesynchronization。
- 中核player journeyを完遂できないこと。
- 自動化済みと表示した挙動が最終GameStateまで証明されないこと。

次は境界を明示し、guided/manual fallbackが誠実ならactive target外のbeta制約として
残し得る。

- rareなCR/Oracle edge case。
- 対象外viewportや場面のminor polish。
- 完全自動化していない複合挙動。

制約を隠してcompleteと報告すること、秘密・権限・state安全をminor polishとして扱う
ことは禁止する。

## 速度とtoken economy

- `AGENTS.md`、検証済みcontext、active brief、必要な正本だけから回復する。
- 独立したread/checkはprogrammaticにbatchし、raw transcriptや全履歴を再注入しない。
- 決定論的な抽出・照合へLLM再考や多数決を使わない。
- 同じrole lineageを有界修正に再利用し、task名やcontinuationでcounterをresetしない。
- status目的だけのread、短いpoll、同じfull check、同じauditを増やさない。
- modelとeffortは品質を満たす最小から始め、観測された難しさに応じて上げる。

watchdog超過はprompt、tool、model、context、候補境界を見直す内部telemetryであり、
固定scopeの続行について人間へ数字の許可を求める理由ではない。品質境界をtoken節約の
ために弱めてもならない。

## STOPと自動repair

人間へ戻すのは次だけである。

1. 優先度式でも解けない真の価値判断。
2. CRや既存契約で一意に解けない真の曖昧。
3. North Star・契約原則の変更、秘密・購入、不可逆または未認可の外部操作。
4. 同じ根本原因へ有界修正を2回行っても進展せず、続行にGoal、scope、qualityの変更が必要。

別原因のfinding、quota、candidate境界、意味不変のrelease defectは同じacceptanceと
authorityを保持して自動repairする。STOPを候補名の変更やcounter resetで洗浄しない。

## 報告

報告は次の順にする。

1. player-visible outcomeとproduction evidence。
2. acceptance qualityと未達カテゴリ。
3. 変更ファイルとtargeted validation。
4. cold-audit状態。
5. deferred/manual/beta境界と真のSTOP。
6. supporting governance、substrate、telemetry。

「基盤ができた」を「プレイヤーUIが届いた」と表現しない。途中停止時は実装済みと
残作業を分け、外部authorityがなければその境界を一度だけ明記する。
