# O4P-01S Solo保全ゲートとOnline再利用境界の確定（draft）

この文書は O4P-01S の調査・実装成果を記録する draft であり、判定済みの契約ではない。

Base SHA: `cb9a7c201151affe379a2109c477389689478650`
Candidate tree fingerprint (audit scope, excluding this draft): `ab6d90a9da39f1b97e145a6bc4fbd6cfd7fbb485a9369c9b236bbc09669862f1`
Fingerprint method: `computeTreeFingerprint` path/content hash over the nine
non-brief candidate paths listed below; the brief itself is excluded only to
avoid self-reference. The full-worktree fingerprint is recorded in loop-state.
Candidate paths:
- `.agents/skills/mtg-onedeck-development/references/codex-autoloop.md`
- `.agents/skills/mtg-onedeck-development/references/cycle.md`
- `.agents/skills/mtg-onedeck-development/references/token-economy.md`
- `.claude/audit-standing.md`
- `package.json`
- `scripts/checks/machine-checks.mjs`
- `scripts/__tests__/machine-checks.test.mjs`
- `research/cr-grounding/o4p-01s-solo-online-boundary.draft.md`
- `src/store/__tests__/soloPreservation.contract.test.ts`
- `src/test/architecture/soloOnlineBoundary.test.ts`
Audit evidence path (judge-owned; excluded from the semantic candidate hash):
- `research/cr-grounding/archive/o4p-01s-solo-online-boundary-cold-audit-2026-08-09.md`

調査時点の事実: `src/online/**` は存在しない。O4P-01S の既存brief draftと台帳上の O4P-01S エントリも存在しなかったため、ユーザー提示のO4P-01S要求を作業範囲として読み、現行コードとテストから証拠を収集した。O4P-00A/O4P-00Cの完了状態は本作業では再裁定しない。O4P-00BはDEFERのまま扱う。

## 1. Current Solo execution path

- 起動入口は `src/App.tsx` の `App`。`useGameStore((s) => s.state)` が非nullになると `GameScreen` を表示する。
- 再開候補は mount 時の `loadSnapshot()`（`src/data/gameSnapshot.ts`）から読み、`restore-game` のクリックで `useGameStore.getState().restoreGame(snapshot)` を呼ぶ。
- 保存デッキがある場合は `ImportScreen` の `handleStart` が音声開始後に `newGame(deck)` を呼ぶ。旧localStorageフォールバックの `resume-game` も同じ `newGame` を呼ぶ。
- `src/store/gameStore.ts:newGame` は seedを固定し、`initGame(cards, seed)` で初期stateを作り、純粋な `applyCommand(base, { type: 'draw', count: 7 })` により開始手札を作る。統率者は `initGame` で `command` に置かれ、通常カードはseed付きshuffle後に `library` に置かれる。
- `gameStore.ts:takeSnapshot` は `SNAPSHOT_VERSION`、deep-cloneした `state`、内部deck、`autoAdvanceToMain` を返す。Store subscriptionは400ms後に `saveSnapshot` を実行する。`restoreGame` は snapshot stateをnormalizeし、保存deckを内部に戻し、undo/redo履歴と対話状態を空にする。
- 通常操作は `gameStore.ts:dispatch` から `src/engine/commands.ts:applyCommand`/`applyCommands` へ進み、Storeが履歴と表示用の状態を保持する。`undo`/`redo` は全state snapshotの履歴を戻す。
- 現在のSoloはブラウザ内のReact/Zustand、IndexedDB/localStorage、エンジン純粋関数だけで完結し、Cloudflare Worker、Durable Object、WebSocket、Room API、アカウント、招待トークンへの既存importはない。

## 2. Existing multiplayer substrate

- `src/engine/types.ts:GameState` は `players`、`turnOrder`、`localPlayerId`、`zonesByPlayer` を持ち、`CardInstance` は `ownerId`、`controllerId`、`zoneChangeCounter` を持つ。
- `src/engine/init.ts:initGame` は初期rosterを `P1` と `OPPONENT_A` にし、双方のlifeを40にする。`syncDerivedViews` がplayer/private-zoneと既存flat viewを接続する。
- `src/engine/commands.ts` は `playerId` を明示できる draw/mill/shuffle/discard/life/counter/mana と、`applyPlayerEffect` の `you`/`eachOpponent`/`eachPlayer` を持つ。private zoneの実体は `zonesByPlayer`、共有zoneは `zones` である。
- `src/engine/priority.ts:apnapPlayerOrder` と `orderPendingTriggersApnap` はactive playerとturnOrderを引数に取る純粋関数である。
- `src/engine/scenario.ts:compileOpponentSetupCommands` はOpponentSetupDraftを既存GameCommand列へコンパイルする。Storeには `addOpponent`、`applyOpponentSetup`、`applyOpponentSetups` がある。
- UI側には `OpponentSetupScreen`、`OpponentBoards`、`battlefieldProjection` があり、現行の対戦相手表示・セットアップ補助を担う。これはOnline接続ではなく、Solo Store内の多人数盤面基盤である。
- 既存証拠は `src/store/__tests__/review.mp-state.test.ts`（I24〜I28）、`review.mp-four-player.test.ts`、`review.mp-zones-commands.test.ts`（I29〜I32）、`snapshotPersistenceControl.test.ts` にある。これらは変更していない。
- `src/online/**`、Online server/transport/domain、Room、Projection、WebSocket実装は存在しない。

## 3. Solo-only responsibilities

- Store内のundo/redo履歴、pending interaction履歴、履歴上限、および `restoreGame` 直後の履歴消去。
- `GameSnapshot`、`SNAPSHOT_VERSION`、IndexedDBの `mtg-onedeck-game`/`snapshot`/`current` 保存、unsupported versionをnullにする読み込み。
- `App.tsx` の再開棚、legacy localStorage deck fallback、保存デッキと現在ゲームのブラウザ保存接続。
- `GameScreen`、`OpponentSetupScreen`、ローカルショートカット/keybindings、hover・dialog・mobile drawer等のUI view state。
- Soloの「local playerを省略した操作」は現行互換性として残るが、Onlineの共通入力では暗黙主体を使わない境界が必要である。
- これらをOnline StateやOnline sessionの保存契約へ昇格させる根拠は現時点にない。

## 4. Shared rule-semantics candidates

次の層は、コード上は `src/engine/**` の純粋関数または純粋なGameCommand適用として存在し、Onlineから再利用する候補である。ただし候補であり、Online Canonical Stateの形、Adapterの位置、server authorityはこのdraftでは決めない。

- object/zone semantics: `types.ts:CardInstance/objectIdOf`、`commands.ts:applyCommand`、zone-change event、owner/controller routing。
- player and turn semantics: `types.ts` のPlayerState/roster、`priority.ts:apnapPlayerOrder/orderPendingTriggersApnap`。
- rule compilation: `grammar/ir.ts:parseAbilityIR`、`grammar/compile.ts:compileAbilityIR/buildGuidedCommands`、`keywordGrammar.ts`、`triggerCondition.ts`。Oracle解析は既存のengine/data経路を正本とし、Online配下へ複製しない。
- mana and card status: `mana.ts`、`manaTransaction.ts`、`autotap.ts`、`status.ts`、`commander.ts`。
- command application and events: `batch.ts:applyCommands`、`commands.ts` の draw/mill/shuffle/combat/stack/trigger/SBA、`eventLog`。
- opponent setup compilation: `scenario.ts:compileOpponentSetupCommands` は再利用候補だが、現在のUI/Store workflowとlocal stateへの結合を解いてからOnline境界を判定する。

再利用可能と記載した根拠は各行のpath・symbol・test evidenceに限定する。純粋関数であることが確認できないStore/UI内部処理は `REFACTOR_BEFORE_ONLINE` または `ADAPT` とした。

## 5. Online-only responsibilities

現行コードには実装がない。次の責務は将来Online側で新たに契約化すべき候補であり、本draftでは型名・field名・実装方式を確定しない。

- Room lifecycle、接続session、role/capability、authentication/authorization。
- command受付のrevision、commandId、idempotency、再接続と競合処理。
- WebSocket/transport、server persistence、event persistence、server authority。
- Player/Table Projection、private/shared visibility、face-down情報の漏洩防止。
- Online専用の保存・復元・protocol negotiation。

Soloが上記なしで動くことは `soloPreservation.contract.test.ts` と依存境界テストで固定する。これはOnline runtimeの先行実装ではない。

## 6. Representation conflicts

- `GameState.zones` はlocalPlayerのprivate-zone mirrorを含み、全playerのprivate-zone実体は `zonesByPlayer` にある。`syncDerivedViews` と `syncFlatPrivateZonesFromPlayers` のsingle-writer境界を壊すとP1の表示と他playerの実体がずれる。
- `players` はplayer単位のcanonical観測面だが、`life`、`poison`、`energy`、`experience`、`manaPool`、turn counters等のlegacy local scalarが同じstateに残る。Onlineへそのまま送るとlocal viewとtable stateの意味が混ざる。
- `localPlayerId` は表示・暗黙subject・private flat zoneの基準であり、Onlineの接続主体、権限、visibilityを表すものではない。
- `CardInstance.id` はphysical identity、`zoneChangeCounter`を含む object incarnationである。単一の card objectをWebSocket payloadやtable projectionとしてそのまま公開してはならない。
- `ownerId` と `controllerId` は別のルール意味を持つ。private-zone routingはowner、battlefield操作や能力主体はcontrollerを参照するため、表示projectionでも混同できない。
- `eventLog` は機械検証用の構造化イベント、`log` は日本語表示文であり、server event streamやUI表示ログと統合する根拠はまだない。
- `pendingRuleChoices` はGameState内のルール選択、`pendingGuided`等はStore内のUI/操作継続状態である。Onlineの再接続可能なpending commandと同一視できない。
- `SNAPSHOT_VERSION` はSolo IndexedDB契約のversionであり、`src/versioning/contractVersions.ts` のprotocol/state/projection versionとは別契約にする必要がある。
- `commanderDamage` は `PlayerId` ではなく統率者ラベルをkeyにする。player rosterへ単純に写像できないため、Online共有stateへ直接移す根拠がない。
- `GameState`全体は既存Solo実行環境として保全する。Envelope、別Canonical State、共通Engine Stateのどれを採るかは次マイルストーンの入力とする。

## 7. Reuse matrix

Classificationは要求された6値だけを使った。`Existing test evidence` は既存テストまたは本マイルストーンで追加した通常テストの実在pathと対象を示す。`UNRESOLVED` は、コードとテストから責務を一意に分類できない場合に限るが、今回の37行には該当しなかった。

| Concern | Current source path | Current symbol | Existing test evidence | Current responsibility | Classification | Online gap | Solo regression risk | Required next action |
|---|---|---|---|---|---|---|---|---|
| Player roster | `src/engine/types.ts` | `GameState.players`, `PlayerState` | `review.mp-state.test.ts` I24 | player identityとrosterをstateへ保持 | ADAPT | local/legacy mirrorとOnline participantを分離する入力が必要 | roster追加でP1 private zoneを壊す | 次回、participant入力とSolo state adapterを定義 |
| Seat order / turnOrder | `src/engine/priority.ts` | `apnapPlayerOrder` | `review.mp-state.test.ts` I24/I27 | turn orderを順序付き関係として利用 | SHARE_DIRECT | Online commandが明示turnOrderを供給する必要 | turnOrder再導出順の変更 | 純粋関数を直接再利用し、順序fixtureを共有 |
| Active player | `src/engine/types.ts`, `src/engine/priority.ts` | `activePlayerId`, `apnapPlayerOrder` | `review.mp-four-player.test.ts` APNAP | active player起点の優先順を計算 | SHARE_DIRECT | server側のactive-player authority入力が未定義 | localPlayer固定へ戻る回帰 | actor省略禁止を次回のadapter条件にする |
| Player life / poison / energy / experience | `src/engine/commands.ts` | `applyLifeDeltaForPlayer`, `applyPlayerCounterDelta` | `review.mp-zones-commands.test.ts` player-aware life/poison | playerごとの数値とP1 legacy scalarを同期 | ADAPT | scalar mirrorを共通入力から隔離 | P1 scalarとplayersの不一致 | player-counter adapterと不変条件を設計 |
| Mana pool | `src/engine/commands.ts`, `src/engine/types.ts` | `manaPoolFor`, `setManaPoolFor`, `PlayerState.manaPool` | `review.mp-four-player.test.ts` opponent mana | playerごとのpoolとP1 mirrorを更新 | ADAPT | implicit local poolを排除する境界 | opponent操作がP1 poolを変更 | explicit player入力で共通計算を呼ぶ |
| Player-private zones | `src/engine/commands.ts`, `src/engine/types.ts` | `zonesByPlayer`, `privateZonesFor`, `editZone` | `review.mp-zones-commands.test.ts` I29/I30/I32 | ownerごとのlibrary/hand/graveyardを保持 | ADAPT | visibility/private serializationが未定義 | flat `zones` mirrorの破損 | private-zone adapterとprojection規則を作る |
| Shared zones | `src/engine/commands.ts` | `readZone`, `editZone` for battlefield/stack/exile/command | `review.mp-zones-commands.test.ts` I32 | shared zoneをstateで順序保持 | SHARE_DIRECT | table visibilityとownershipが未定義 | shared zoneをplayer別に複製する回帰 | shared-zone純粋処理を直接再利用 |
| Physical card identity | `src/engine/types.ts` | `PhysicalCardId`, `CardInstance.id` | `review.mp-zones-commands.test.ts` zone isolation | physical card idをゲーム中維持 | SHARE_DIRECT | projectionで公開可能な情報の選別が必要 | id再採番・duplicate | identity inputを共通adapterで渡す |
| Object incarnation | `src/engine/types.ts`, `src/engine/commands.ts` | `zoneChangeCounter`, `objectIdOf`, `resetCardForZoneChange` | `review.mp-zones-commands.test.ts` zone commands | CR 400.7のzone change objectを追跡 | SHARE_DIRECT | server event/revisionとの対応が未定義 | zone移動でcounterを落とす | object semanticsを共有しtransport metadataと分離 |
| ownerId | `src/engine/commands.ts` | `removeFromCurrentZone`, `privateZonesFor` | `review.mp-zones-commands.test.ts` I29 | private zone routingをowner基準で行う | SHARE_DIRECT | projectionでownerを隠す場合の規則が必要 | ownerをlocal P1へ戻す | owner explicit fixtureをOnline adapterで再利用 |
| controllerId | `src/engine/commands.ts` | `playerTargetRef`, controller checks | `review.mp-four-player.test.ts` controller mismatch | ability/combat/effect主体をcontrollerで決める | SHARE_DIRECT | command authorityとの結合が未定義 | controllerとownerの混同 | controller-aware pure pathを直接再利用 |
| Card definitions | `src/types/card.ts`, `src/engine/grammar` | `CardDef`, `parseAbilityIR`, `compileAbilityIR` | `review.mp-four-player.test.ts` compiler paths | Oracle/card metadataをengine compilerへ供給 | SHARE_DIRECT | Online cache/definition distributionが未定義 | Online用解析複製で意味が二重化 | 既存Oracle parserを共通入力から直接利用 |
| Zone change | `src/engine/commands.ts` | `applyMoveCardCommand`, `zoneChangeCounter` | `review.mp-zones-commands.test.ts` I29/I32 | immutable commandでzone移動・eventを作る | SHARE_DIRECT | command acceptance/revisionが未定義 | zone mirror/eventの取りこぼし | applyCommandを共通semantic coreとして検証 |
| Draw | `src/engine/commands.ts` | `drawCards`, `applyAutoCommand` draw | `review.mp-zones-commands.test.ts` I30/CR121 | 指定playerのlibraryからdrawしevent/SBAを更新 | SHARE_DIRECT | Online callerがplayerIdを必ず明示する必要 | P1 defaultへ退行 | explicit-player adapterを追加設計 |
| Mill | `src/engine/commands.ts` | `applyMill`, `applyAutoCommand` mill | `review.mp-zones-commands.test.ts` I31 | 指定player libraryをgraveyardへ送る | SHARE_DIRECT | same as draw; visibility/event authority未定義 | opponent millがP1へ流れる | pure command pathを直接再利用 |
| Shuffle | `src/engine/commands.ts` | `applyShuffle` | `review.mp-zones-commands.test.ts` CR701.24a | payload順列を検証して指定libraryをshuffle | SHARE_DIRECT | entropy生成者とpayload ownershipが未定義 | 他player libraryをshuffleする回帰 | seeded/permutation input boundaryを定義 |
| Stack | `src/engine/commands.ts` | `zones.stack`, stack command cases | `review.mp-four-player.test.ts`, existing stack tests | shared stack objectを積み解決 | SHARE_DIRECT | priority/authority transportが未定義 | stack stateをStore-onlyにする回帰 | stack pure command/event substrateを共有 |
| Priority / APNAP | `src/engine/priority.ts` | `orderPendingTriggersApnap` | `review.mp-state.test.ts` I27 | active playerとturnOrderからAPNAP順を算出 | SHARE_DIRECT | explicit choice ownership・server priority未定義 | P1固定APNAP | functionとgolden orderを直接共有 |
| Trigger ordering | `src/engine/priority.ts`, `src/engine/triggers.ts` | `deterministicPendingTriggerOrderForPriority`, `collectPendingTriggers` | `review.mp-four-player.test.ts` trigger/APNAP | trigger収集とcontroller別stack order | SHARE_DIRECT | concurrent command/reconnect境界未定義 | trigger bucket順やactorをlocal固定 | pure trigger inputとOnline event orderingを接続 |
| Pending rule choices | `src/engine/types.ts`, `src/store/gameStore.ts` | `PendingRuleChoice`, `pendingGuided`, `resolveRuleChoice` | `review.mp-state.test.ts` snapshot normalization; guided tests | rule choiceとUI continuationを保持 | ADAPT | reconnectable choice identity/visibility未定義 | restoreでpending choiceを誤って再開 | engine choiceとStore interactionを分離 |
| Combat | `src/engine/commands.ts`, `src/store/gameStore.ts` | `enterCombat`, `declareAttackers`, `resolveCombatDamage`, `declareAttack` | `review.mp-four-player.test.ts` combat target | combat state/commandsとlocal UI操作 | ADAPT | player authority、visibility、priority window未定義 | localPlayer defaultで攻撃主体を誤る | combat pure callsを明示actor adapterへ切替 |
| Commander zone replacement | `src/engine/commands.ts` | `applyMoveCardCommand`, `commanderZoneRuleChoice` | commander review tests; `review.mp-zones-commands.test.ts` snapshot | command/graveyard/exile replacement choice | SHARE_DIRECT | player choice transportとprivate visibility未定義 | commanderをP1へ戻す | replacement choiceを共通engineで再利用 |
| Commander tax | `src/engine/commander.ts` | `commanderTax` | `review.m431.test.ts` | commander castCountから2倍taxを計算 | SHARE_DIRECT | commander identity/authority input未定義 | castCountの保存/復元回帰 | pure functionを直接利用 |
| Commander damage | `src/engine/types.ts`, `src/engine/commands.ts` | `commanderDamage`, `adjustCommanderDamage` | `review.mp-state.test.ts` I26 note / commander tests | 統率者label keyのlegacy表示値を保持 | ADAPT | PlayerId/commander-object mappingがない | player stateへ誤投影 | 次回にlabel-to-object adapterか現行保留を判定 |
| Event log | `src/engine/types.ts`, `src/engine/commands.ts` | `GameEvent`, `eventLog`, `pushEvent` | `review.mp-zones-commands.test.ts` draw events | 構造化CR eventをstateへ蓄積 | SHARE_DIRECT | server event stream/idempotency/revision未定義 | event sequenceをtimestamp化 | event payloadを共通semantic inputにする |
| Japanese display log | `src/engine/types.ts`, `src/engine/commands.ts` | `LogEntry`, `pushLog` | `soloPreservation.contract.test.ts` snapshot state | Solo UI向け日本語メッセージを保持 | ADAPT | Online locale/visibility/translation policy未定義 | log文変更がsnapshotを変える | eventLogと表示projectionを分ける |
| Randomness | `src/engine/random.ts`, `src/engine/init.ts` | `createRng`, `shuffledOrder`, `initGame(seed)` | `soloPreservation.contract.test.ts` repeatability | seedから決定的orderを作る。Storeがseedを決める | ADAPT | server entropy authority・seed transport未定義 | timestamp/random connection混入 | entropy入力を明示しSolo seedを保全 |
| Undo / redo | `src/store/gameStore.ts` | `internal.past/future`, `undo`, `redo` | `soloPreservation.contract.test.ts`; `review.mp-state.test.ts` | Solo Store専用の全state履歴 | SOLO_ONLY | Online command historyの別契約が未定義 | history変更でSolo復元不能 | Onlineへ再利用せずSolo契約を固定 |
| Game Snapshot | `src/data/gameSnapshot.ts`, `src/store/gameStore.ts` | `GameSnapshot`, `SNAPSHOT_VERSION`, `takeSnapshot` | `snapshotPersistenceControl.test.ts`; Solo contract | IndexedDBの現在ゲーム保存 | SOLO_ONLY | Online State persistenceは別契約 | version統合・Online field混入 | Solo snapshot schemaを維持 |
| Snapshot normalization | `src/store/gameStore.ts` | `normalizeSnapshotState`, `restoreGame` | `review.mp-state.test.ts` I28 | legacy snapshotを現行GameStateへbackfill | SOLO_ONLY | Online migration/negotiationとは分離が必要 | normalizationでold saveを破壊 | Online adapterへ流用しない |
| Opponent setup | `src/engine/scenario.ts`, `src/store/gameStore.ts` | `compileOpponentSetupCommands`, `applyOpponentSetups` | `review.mp-state.test.ts` I24; MP zones I32 | Solo内の対戦相手初期盤面補助 | REFACTOR_BEFORE_ONLINE | draft/baseFingerprint/UI flowをOnline commandへ写像できない | four-player setupのP1回帰 | compilerとUI/Store orchestrationを分離 |
| localPlayerId | `src/engine/types.ts`, `src/components/game` | `GameState.localPlayerId`, local projection calls | `review.mp-state.test.ts` I24/I25; Solo contract | flat zones・implicit command subject・表示対象の基準 | ADAPT | connection/session主体と別のadapterが必要 | P1を他playerへ置換する回帰 | Online boundaryでは必須explicit actorにする |
| Legacy local scalar fields | `src/engine/types.ts` | `life`, `poison`, `energy`, `experience`, `manaPool`, turn counters | `review.mp-state.test.ts` I25 | P1互換面とplayersのsingle-writer mirror | ADAPT | Online common stateへそのまま送信不可 | scalar削除/非同期化でSolo破壊 | 次回にadapterまたは共通state再構成を比較 |
| Player/Table visibility | `src/components/game`, `src/engine/types.ts` | `projectBattlefield`, `zonesByPlayer`, local UI projections | `review.mp-zones-commands.test.ts` private isolation; UI tests | Solo UIでlocal/opponentを表示・私有zoneを分ける | ONLINE_ONLY | Online projection/face-down/private visibility契約が未定義 | visibility変更がSolo UIへ波及 | Online専用projection契約を次回作成 |
| Authentication and authorization | `src/App.tsx` | no authentication/session branch | `soloPreservation.contract.test.ts` no network; boundary test | 現行Soloは認証を要求しない | ONLINE_ONLY | account/role/capability authorityが未定義 | Solo起動へauthを混入 | Online runtime契約を別途設計 |
| Room persistence | `src/data/gameSnapshot.ts` | `saveSnapshot`, `loadSnapshot` | `snapshotPersistenceControl.test.ts`; Solo contract no room/session fields | 現行SoloはRoomを保存しない | ONLINE_ONLY | server/room storage・reconnectが未定義 | IndexedDB SnapshotとRoomを統合 | Online persistenceを別契約で定義 |
| UI view state | `src/App.tsx`, `src/store/gameStore.ts`, `src/components/game` | `gameView`, `pendingDeck`, keybindings, drawer/dialog state | existing UI tests; `snapshotPersistenceControl.test.ts` | Solo/browser UI stateとStore interaction state | SOLO_ONLY | Online UI session stateとの境界が未定義 | Online UI importでSolo bundleを汚す | Online UIを別entry/adapterで設計 |

分類件数: `SHARE_DIRECT` 18、`ADAPT` 11、`SOLO_ONLY` 4、`ONLINE_ONLY` 3、`REFACTOR_BEFORE_ONLINE` 1、`UNRESOLVED` 0。

## 8. Regression risks

- `src/engine/**` がStore/UI/Onlineへ依存し始めると、純粋engineのSolo実行とOnline再利用の双方が壊れる。AST境界テストは現行repositoryを毎回検査する。
- `GameState`の全面置換、`SNAPSHOT_VERSION`の変更、snapshotへのOnline contract情報追加は、既存のlocal saveを失わせる。unsupported versionを現行版と推測しないことも固定する。
- `localPlayerId`省略の既存操作、flat `zones` mirror、legacy scalar mirrorを一度に撤去すると、Solo UI・既存reviewテスト・旧snapshotが壊れる。
- 4人roster追加時にP1 private zones/life、turnOrder、APNAP、opponent draw routingを変えると、既存の多人数基盤がSolo操作を退行させる。
- `ownerId`と`controllerId`の混同、physical idとobject incarnationの混同、private zoneとshared zoneの混同は、Online projectionだけでなく現行SoloのCR意味を壊す。
- `eventLog`と日本語`log`、rule choiceとStore guided interactionをOnline event/sessionに統合すると、SnapshotとUI履歴の境界が失われる。
- Online側にOracle解析、mana計算、APNAP、Solo関数のコピーを置くと、二重正本と意味ドリフトを生む。
- 現行の自己テストだけでreviewテストの代替を作ると、既存CR不変条件の委譲境界を弱める。追加テストは公開入口の保全だけに限定した。
- Online runtimeが未作成のため、auth・room・revision・projectionの欠落は現時点の実装失敗ではなく、次回の入力不足として記録する。ただしSoloへ依存を持ち込まない境界は今固定する。

## 9. Inputs required for the next milestone

- Online側の状態表現を、既存GameStateとは別型にするか、既存stateを包むか、共通engine inputへ再構成するかを、今回の表のrepresentation conflictsと各test evidenceに基づき判定する。O4P-01Sでは決定しない。
- commandの共通semantic入力について、playerId/controllerId/ownerId/activePlayerIdを必須にする範囲と、Soloの暗黙local defaultを残す範囲を決める。
- `zonesByPlayer`/shared `zones`/projectionの公開情報、face-down object、private hand/library、owner/controller visibilityを契約化する。
- Solo Snapshot (`SNAPSHOT_VERSION`) と Online state/protocol/persistence versionを別契約として命名・保存・migrationする方針を決める。
- Room lifecycle、revision、commandId、reconnect、server authority、auth/capabilityをOnline-only設計として用意する。
- 既存のpure engine再利用、mode-neutral関数抽出、Adapterのどれを各 `ADAPT`/`REFACTOR_BEFORE_ONLINE` 行へ適用するかを、対象ごとに選択する。
- opponent setupをOnlineの初期table stateへ持ち込むか、Solo-only補助として保持するかを判定する。
- O4P-00Bは引き続きDEFER。未承認のOnline Canonical State、PreparedCanonicalStateV1、Room State、Projection、Online UIは作らない。

## 10. DEFER

- 本draftでは `src/online/domain`、Online Canonical State、Online用GameObject、Room State、Player/Table Projection、WebSocket、Worker、Durable Object、auth、revision、commandId、event persistence、migration、protocol negotiationを作成しない。
- 現行 `GameState`、Solo Store、Solo Snapshot、Solo UI、既存多人数基盤は保全対象として残す。既存製品挙動の変更は行っていない。
- O4P-00BおよびOnline実装全般は次マイルストーンへ送る。次回はこのdraftと、Solo保全・AST境界・既存MP review証拠を入力としてrepresentation判定を行う。
- 冷監査時間プロファイル: `BROAD`（想定完了25分、hard wait45分）。AST境界、複数テスト、37 Concernの証拠照合を含むため、短時間監査には分類しない。
- status: `implemented-not-audited`。冷監査前の実装成果として扱う。
