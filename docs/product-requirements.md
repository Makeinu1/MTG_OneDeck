# OneDeck プロダクト要求（WHY / WHAT の正本）

## 権威と適用範囲

本書はOneDeckのプロダクトとしての立ち位置、プレイヤー成果、体験品質、
UI資産の共有原則を定める。すなわち「なぜ作るか」「何を満たすか」の正本である。

本書は実装済みであることを主張しない。現在地と次スライスは台帳、実装意味は
`docs/contracts/manifest.json`配下の各契約、進め方はdelivery policy、詳細な
候補・監査・出荷手順はdocument governanceがそれぞれ所有する。本書だけから
commit、push、deploy、publish、shipその他の外部権限は生じない。

## プロダクトの立ち位置

OneDeckは、自分のCommanderデッキを一人で回す道具だけでも、すべてのMagicを
自動裁定するArenaの複製でもない。一人回しと同期対戦を同じ卓上システムで支え、
次の二つを両立するプロダクトである。

- 物理Commander卓の空間性、各プレイヤーの存在感、会話による柔軟さ。
- 優れたデジタルカードゲームの明瞭さ、カードの存在感、反応、演出、回復しやすさ。

共有状態は厳密に保ち、対応できるルールは支援し、対応できない意味や卓上合意は
誠実なguided/manualとプレイヤー間の会話へ残す。秘密情報、権限、同期、履歴を
曖昧にすることで「自動化済み」に見せてはならない。

Arenaは当面の比較基準を100点と置く。ただし借りるのは明瞭さ、カードの存在感、
フィードバック、motion/audioの完成度であり、1対1専用配置、ランキング文脈、
全ルール自動化を模倣する要求ではない。

## 当面のプレイヤー成果と順序

最初に証明する成果は、本番プレイヤー画面から離れずに認識可能な2人対戦を
最後まで完遂でき、同じ資産と意味モデルで4人対戦の連続性を維持できることである。
その証明後、一人回しの完成度を継続的に高める。

headless基盤、統治文書、監査件数、テスト件数だけではプレイヤー成果と数えない。
ただし、それらが本番旅程の安全と受け入れ品質を直接支える証拠であることは区別して
報告する。

完全試合は北極星として維持するが、価値探索と日々の改善を一つの巨大な認定へ束ねない。
まず代表 use case を比較して primary use case を選び、次に信頼できる共有 session、意味のある
Commander interaction loop を個別に証明する。その後にだけ、実runtime上の短い決定論的
シナリオで次を一続きに扱い、完全試合として認定する。前段の成功を完全試合の成功へ
読み替えてはならない。

- 土地、cast、HOLD、response、resolve。
- combat、秘密のchoice、誠実なmanual fallback。
- disconnect/reconnect、elimination、winner。

## 体験の中心：注意を案内する卓

OneDeckは、すべてのカードを常時同じ強さで見せる画面ではない。プレイヤーの
記憶を支え、卓全体を周辺視野に残し、判断が生じたときに因果関係へ注意を集める
「注意の案内役」である。

画面の主役はターン所有者だけで決めず、現在の注意状態で決める。

| 注意状態 | 主な思考 | UIの中心 |
| --- | --- | --- |
| 自分のターン・stackなし | 手札、土地、盤面、mana、行動順 | 自分のcockpit |
| 相手のターン・stackなし | 最新行動、盤面変化、自分が応答できるか | active/relevantな相手と自分の応答資源 |
| stack/HOLD | 発生源、対象、解決順、priority、応答 | 共有stackの因果関係 |
| combat | 攻撃先、攻撃・防御割当、誘発、結果 | 関係する攻撃側と防御側 |
| 解決直後 | 何が変化し、次に誰が判断するか | 状態差分と次のpriority |

注意を切り替えても、盤面を頻繁に並べ替えて空間記憶を壊してはならない。拡大、
明度、前面化、対象線、短い差分表示を使い、用が済めば元の文脈へ戻す。

## 共有するものと構成を変えるもの

一人・2人・4人で別製品を三つ作らない。次の資産と意味を共有する。

- normalized tabletop view modelとinteraction port。
- card、board lane、zone、stack、target line、decision、status。
- contextual action、focus/preview、motion、audio、recent change。
- Mode-Neutral Core、Local/Remote intent、秘密情報のprojection境界。

共有とは同じfull-page layoutを強制することではない。人数と表示目的に応じて構成と
密度を変える。

- 一人回し：自分のデッキ理解、発見、盤面記憶を最大化する。
- 2人対戦：自分と相手の因果関係、stack、responseを明瞭にする。
- 4人対戦：自分のCockpit内で固定された3席の概要、周辺認識、relevant seatのfocusを両立する。
- 公開projection：全席と公開された因果関係を一望できるprojectionを保つ（独立したMVP画面を意味しない）。

## 自分の盤面と相手の情報

自分の盤面は記憶を外部化する場所である。

- creature、land、その他の意味領域を安定させる。
- カードを不要に再配置せず、位置による記憶を維持する。
- 同名card、token、land、attachmentを意味を失わない範囲で束ねる。
- 新規、tap/untap、target、controller変更など直近の差分を一時的に浮かせる。
- 密度上昇時は余白縮小、scale、bundle、focusの順に圧縮する。

相手の盤面は常時全文を読む対象ではなく、周辺視野として次を保つ。

- 安定したseat、commander、life、hand count。
- land/mana posture、creatureとその他permanentの概況。
- tap状態、直近の変化、stack/combat/targetに関係するobject。

2人戦では相手を広く表示できる。4人戦では3席を固定した概略とし、active、source、
target、選択中の相手を自動的にfocusする。ユーザーは任意の相手やcardを詳細化でき、
閉じれば同じ場所へ戻れる。

## Stackは卓の共有会話

stackは単なる縦のcard列ではない。次をひと続きの因果として示す。

- 誰が、どのsourceから、何を追加したか。
- controller、target、応答先、現在のtop object。
- 誰のpriorityまたはHOLDを待っているか。
- 自分が選べるresponseと、その選択がどこへ積まれるか。
- 解決後にどの共有状態が変わったか。

stackが開いたら、誰のターンでも卓全体の視覚的中心になる。Cockpit内の共有表示は
自分の応答候補と公開された因果関係を、参加者間で一貫した色、motion、focusの手掛かりとともに示す。
状態更新は演出待ちにしてはならない。

## Display model

### Player cockpit（Display A）：各プレイヤーのprivate cockpit

Cockpitは自分の盤面とhandを主役にし、相手の公開情報を概略表示し、必要な部分を
詳細化できるaction-authoritativeな画面である。一人・2人・4人の全旅程はCockpit単独で
完遂できなければならない。stack、priority、HOLD、combat、warning、recoveryを
Cockpitから追い出してはならない。

MVPのplayer-facing surfaceはこのCockpit一つに集約する。4人戦の三人の相手概要、
active/source/target/選択中の相手のfocus/detail、脱落後のread-only spectator表示も
同じCockpit内で完結させる。独立Display B/Public Table UIはMVPのproduct surfaceに含めない。

### Public projection（runtime boundary）

既存のpublic projection/runtimeは維持する。projectionは安定した
各seat、公開battlefield、stack、priority、target、combat、recent changeを示す。
秘密のhand、library identity、限定audienceの情報、private choiceはprojection dataに含めず、
projectionの切断や未使用で試合を止めない。

## 操作、accessibility、presentation

- 行動はobjectまたは現在のdecisionの近くへcontextualに提示する。
- hoverは補助手段であり、click/tap、keyboard、context action、非color cueを備える。
- drag、double-click、motion、audioのいずれも唯一の操作・情報経路にしない。
- card preview、target line、causal stack、combat feedbackを共通資産として扱う。
- motion/audioは成功したsemantic eventだけを表し、reduced-motionと無音でも意味を失わない。
- 通常操作を速さ、連鎖、履歴長、card strengthで採点して注意を奪わない。

## 受け入れ品質

最初の対象releaseでは、Arenaを100とする比較評価で主要カテゴリをすべて70以上、
完全試合の総合旅程を80以上とする。主要カテゴリは少なくとも次を含む。

- 空間orientationと盤面記憶。
- stack/priority/targetの因果理解。
- actionとresponseの発見性。
- cardの存在感、feedback、motion/audio。
- accessibility、interruption後の復帰、秘密情報への信頼。

自己採点だけで合格させない。実寸prototype、代表シナリオ、playtest、fresh-contextの
visual reviewによって比較根拠を残す。exact ratio、breakpoint、card size、bundle閾値、
animation時間はこの要求の数値ではなく、証拠からdesign ownerが決める変数である。

## 明示的な非目標

- Arenaの1対1layout、auto-pass、ranking framing、過剰なfullscreen演出の直輸入。
- 1人・2人・4人へ同じrigid layoutを強制すること。
- 各modeまたは各displayへ別のreducer、rule logic、card componentを作ること。
- 独立Display B/Public Table UIをMVPのplayer-facing surfaceにすること、または複数monitorを必須にすること。
- hover、drag、double-clickだけに依存すること。
- 未対応のCR・Oracle挙動を部分実行して自動化済みと表示すること。
- substrate、監査、テスト量をplayer journeyの代替として報告すること。
