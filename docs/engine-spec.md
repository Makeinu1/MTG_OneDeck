# MTG_OneDeck ゲームエンジン仕様(API契約)

この文書は M2(エンジン実装)と M3(UI実装)の間の**契約**である。
ここに定義された型名・関数名・フィールド名・挙動を変更する場合は、実装前にレビュー担当(メインセッション)の承認を要する。

設計原則:
1. **エンジンは純粋関数のみ**(`src/engine/` は React/Zustand/DOM に依存しない)
2. **GameState はイミュータブル**。`applyCommand` は常に新しい state を返す
3. **乱数はコマンド生成時に確定**する(Command ペイロードに順列を埋め込む)。`applyCommand` は決定的
4. **undo/redo はスナップショット方式**(コマンド逆転は実装しない)。履歴はストア層が保持
5. ルールの「強制」はしない。警告は返すが、ユーザーは常に強行できる(サンドボックス原則)

---

## 1. 型定義(src/engine/types.ts)

`CardDef` / `ManaColor` は `src/types/card.ts`(M1成果物)から import する。

```ts
export type ZoneId = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command';

export type Phase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';
export const PHASE_ORDER: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];

export interface ManaPool { W: number; U: number; B: number; R: number; G: number; C: number; }

export interface CardInstance {
  id: string;                        // instance id ('c1', 'c2', ... / tokens: 't1', ...)
  defId: string;                     // CardDef.scryfallId(トークンは合成defを defs に登録)
  zone: ZoneId;
  tapped: boolean;
  faceIndex: number;                 // 表示中フェイス(両面カード用。通常カードは常に0)
  faceDown: boolean;
  counters: Record<string, number>;  // '+1/+1', 'loyalty', 'charge' など。値は常に >= 0
  isToken: boolean;
  isCommander: boolean;
  attachedTo?: string;               // 装備/オーラの付与先 instance id
}

export interface CommanderInfo {
  cardId: string;     // CardInstance.id
  castCount: number;  // 統率領域からキャストした回数。税 = 2 * castCount
}

export interface LogEntry {
  seq: number;
  turn: number;
  phase: Phase;
  message: string;    // 日本語。カード名は printedName ?? name を《》で囲む
}

export interface GameState {
  defs: Record<string, CardDef>;        // defId -> CardDef(ゲーム中不変、トークンdef追加のみ)
  cards: Record<string, CardInstance>;
  zones: Record<ZoneId, string[]>;      // 順序付き。library[0] = ライブラリの一番上
  commanders: CommanderInfo[];          // 1〜2体(共闘)
  turn: number;                          // 1始まり
  phase: Phase;
  life: number;                          // 初期40
  poison: number;
  energy: number;
  experience: number;
  commanderDamage: Record<string, number>; // key: 対戦相手統率者のラベル(自由文字列)
  manaPool: ManaPool;
  mulliganCount: number;
  log: LogEntry[];
}
```

### 不変条件(プロパティテストの対象。違反は実装バグ)
- I1: すべての `CardInstance.id` は、いずれかちょうど1つの `zones[*]` 配列に1回だけ出現する。`zones` に出現する id は必ず `cards` に存在する
- I2: 非トークンカードの総数はゲーム中一定(= デッキ枚数)。トークンは `battlefield` 以外のゾーンへ移動した zone-change event を残し、`stabilizeBeforePriority()` の CR 704.5d 処理で `cards`/`zones` から消滅する(消滅をログに記す)
- I3: `manaPool` の各値・`counters` の各値・`life` 以外のプレイヤーカウンターは負にならない(lifeのみ負を許す)
- I4: `applyCommand` は引数の state を一切ミューテートしない
- I5: フェイズ/ターンが変わるとき `manaPool` は空になる

---

## 2. コマンド(src/engine/commands.ts)

```ts
export type GameCommand =
  | { type: 'moveCard'; cardId: string; to: ZoneId; position: 'top' | 'bottom' | number }
  | { type: 'setTapped'; cardId: string; tapped: boolean }
  | { type: 'setFace'; cardId: string; faceIndex: number }
  | { type: 'setFaceDown'; cardId: string; faceDown: boolean }
  | { type: 'addCounters'; cardId: string; counterType: string; delta: number }
  | { type: 'attach'; cardId: string; to: string | undefined }
  | { type: 'adjustLife'; delta: number }
  | { type: 'adjustPlayerCounter'; kind: 'poison' | 'energy' | 'experience'; delta: number }
  | { type: 'adjustCommanderDamage'; label: string; delta: number }
  | { type: 'addMana'; color: ManaColor; amount: number }
  | { type: 'payMana'; payment: ManaPool }            // solvePayment の結果を渡す
  | { type: 'clearManaPool' }
  | { type: 'draw'; count: number }
  | { type: 'shuffle'; order: string[] }               // library の新しい並び(現libraryの順列であること)
  | { type: 'putOnBottom'; cardIds: string[] }         // ロンドンマリガンの戻し
  | { type: 'castSpell'; cardId: string; payment: ManaPool; forced: boolean }
  | { type: 'castCommander'; cardId: string; payment: ManaPool; forced: boolean }
  | { type: 'createToken'; name: string; typeLine: string; power?: string; toughness?: string; quantity: number }
  | { type: 'nextPhase'; drawnHandled?: boolean }      // 下記参照
  | { type: 'nextTurn' }                                // どのフェイズからでも次ターンの untap へ
  | { type: 'mulligan'; order: string[] };             // 手札を library に混ぜた後の並び。draw(7)は別途

export interface ApplyResult {
  state: GameState;
  warnings: string[];   // 例: 「マナが2点不足(強行)」。日本語
}

export function applyCommand(state: GameState, cmd: GameCommand): ApplyResult;
```

挙動詳細:
- **moveCard**: `position` は移動先ゾーン配列内の挿入位置。`'top'` = index 0。battlefield 行きは常に末尾追加でよい(UIが並び順を管理しない)。ゾーン移動時に `tapped=false, faceDown=false, faceIndex=0, counters={}, attachedTo=undefined` にリセット(battlefield → battlefield 内移動は対象外)。トークンが battlefield 外へ移動した場合は zone-change event / pending trigger 収集後、`stabilizeBeforePriority()` の CR 704.5d で消滅する(I2)
- **castSpell**: 手札(または指定ゾーン—v1は手札のみ)から、`typeLine` に `Instant`/`Sorcery` を含むなら graveyard へ、それ以外は battlefield へ移動し、`payment` をプールから減算。プール不足分があるのに `forced=false` ならコマンド拒否ではなく **payment はソルバ計算済みが前提**なので、エンジンは payment > pool の場合 pool を下限0でクランプし warning を返す
- **castCommander**: castSpell と同様 + 対象が commanders に含まれることを検証し `castCount += 1`。統率領域からのみ
- **nextPhase**: `PHASE_ORDER` の次へ(end の次は turn+1 の untap)。**untap 進入時**: battlefield 全カードを `tapped=false`。**draw 進入時**: 1枚ドロー(`turn===1` でも引く=EDH/多人数戦準拠。§7.5 の M4.6 改訂でターン1のドロースキップは廃止された)。フェイズ遷移時にプールをクリア(I5)
- **mulligan**: 現在の手札全カードを library へ移し、`order`(手札+ライブラリ全体の新順列)で並べ、`mulliganCount += 1`。その後の draw(7) と putOnBottom(mulliganCount 枚) はストア層が別コマンドとして発行
- すべてのコマンドは適切な日本語 LogEntry を log に追加する

エラー(存在しない cardId、ゾーン不整合な castCommander 等)は `EngineError` を throw(ストア層が捕捉して無視+console.error)。

---

## 3. マナ(src/engine/mana.ts)

```ts
export type Pip =
  | { kind: 'color'; color: Exclude<ManaColor, 'C'> }
  | { kind: 'colorless' }                              // {C}
  | { kind: 'hybrid'; options: [ManaColor, ManaColor] } // {W/U}
  | { kind: 'monoHybrid'; color: Exclude<ManaColor, 'C'> } // {2/W}
  | { kind: 'phyrexian'; color: Exclude<ManaColor, 'C'> }  // {W/P}
  | { kind: 'snow' };                                   // {S} — 汎用1として扱う(v1制限、要ログ)

export interface ParsedCost { generic: number; x: number; pips: Pip[]; }

export function parseManaCost(cost: string): ParsedCost;
// "{2}{W}{W}" -> {generic:2, x:0, pips:[W,W]} / "{X}{R}" -> {generic:0, x:1, pips:[R]}
// 不明トークンは generic 0 扱いで警告対象にせず無視(将来構文への耐性)

export interface PaymentSolution {
  ok: boolean;          // 完全に支払えたか
  payment: ManaPool;    // プールから引くべき量(ok=false でも「払える分」を返す)
  shortfall: number;    // 不足点数(ok=true なら 0)
}

export function solvePayment(pool: ManaPool, cost: ParsedCost, xValue: number): PaymentSolution;
```

ソルバの方針(貪欲でよいが以下を保証):
1. 色拘束 pip を先に割り当てる(hybrid は残プールで払える側を選ぶ。両方払えるなら汎用に温存価値が高い方を残す簡易ヒューリスティックで可)
2. phyrexian はマナで払えるなら払い、払えないなら**ライフ2点支払い扱いにせず**不足にカウントしない(=スキップし、warning でストア層に通知する。ライフ減算はユーザー操作に委ねる)
3. 汎用 + X は C → 最も余っている色 の順で消費
4. 完全支払い可能なケースでソルバが「払えない」と誤判定しないこと(単純な貪欲で失敗するケース: `{W/U}{U}` にプール {W:0,U:1,...} + 他色 — hybrid の割当順で全列挙が必要なら pip 数は高々十数個なのでバックトラック実装でよい)

`producedMana` が複数色の土地/マナ源のタップは、ストア層が UI に色選択を要求してから `addMana` を発行する(エンジンは関与しない)。

---

## 4. 初期化(src/engine/init.ts)と乱数(src/engine/random.ts)

```ts
// random.ts
export function createRng(seed: number): () => number;   // mulberry32
export function shuffledOrder(ids: string[], rng: () => number): string[]; // Fisher–Yates

// init.ts
export interface InitDeckCard { def: CardDef; isCommander: boolean; }
export function initGame(deck: InitDeckCard[], seed: number): GameState;
// - 統率者 → command ゾーン、それ以外 → library(seed でシャッフル済み)
// - turn=1, phase='untap', life=40, 手札0枚(初手ドローはストアが draw{count:7} を発行)
// - M4.6: untap 開始により T1 のドローステップを実際に通過する(EDH準拠)
// - quantity 展開は呼び出し側(ストア)の責務
```

シャッフル・マリガンの順列はストア層が `createRng` で生成してコマンドに埋め込む。テスト時は seed 固定で完全再現できること。

---

## 5. ストア(src/store/gameStore.ts)— M3 が依存する操作面

Zustand ストア。エンジンの薄いラッパー + スナップショット履歴(上限200、超過時は最古を捨てる)。

```ts
export interface GameStore {
  state: GameState | null;            // null = ゲーム未開始
  warnings: string[];                 // 直近コマンドの warning(UIがトースト表示後 clearWarnings)
  canUndo: boolean;
  canRedo: boolean;

  // ゲームライフサイクル
  newGame(cards: InitDeckCard[], seed?: number): void;  // initGame + draw 7
  restart(): void;                                       // 同デッキ・新 seed で newGame
  mulligan(): void;                                      // ロンドン: 手札→混ぜ→7枚引く(戻しは putBottom で)
  putBottomForMulligan(cardIds: string[]): void;         // mulliganCount 枚の戻し

  // 汎用
  dispatch(cmd: GameCommand): void;   // applyCommand + 履歴 push + warnings 反映
  undo(): void;
  redo(): void;

  // 便利アクション(内部で dispatch を1回だけ呼ぶ=undo 1回で戻る単位)
  draw(count: number): void;
  shuffleLibrary(): void;
  moveCard(cardId: string, to: ZoneId, position?: 'top' | 'bottom' | number): void;
  toggleTap(cardId: string): void;
  tapForMana(cardId: string, color?: ManaColor): 'ok' | 'needs-choice';
  //   producedMana が単色なら即 addMana+setTapped。複数色で color 未指定なら何もせず 'needs-choice'
  //   (UI が色選択ポップアップを出して color 付きで再呼び出し)
  castFromHand(cardId: string, opts?: { xValue?: number; force?: boolean }): 'ok' | { shortfall: number };
  //   solvePayment → ok なら castSpell。不足かつ !force なら state 変更せず shortfall を返す(UI が確認ダイアログ)
  castCommander(cardId: string, opts?: { xValue?: number; force?: boolean }): 'ok' | { shortfall: number };
  //   コストに統率税 2*castCount を generic 加算してから solvePayment
  nextPhase(): void;
  nextTurn(): void;
  createToken(name: string, typeLine: string, p?: string, t?: string, qty?: number): void;
  clearWarnings(): void;
}
```

統率者が battlefield / library / hand から離れるとき「統率領域へ?」を出すのは **UI の責務**(`isCommander` で判定し、moveCard の行き先を選ばせる)。エンジンは選択を強制しない。

```ts
// engine/commander.ts
export function isCommander(state: GameState, cardId: string): boolean;
export function commanderTax(state: GameState, cardId: string): number; // 2 * castCount
```

---

## 6. M2 の完了条件

1. `npm run lint` / `npx tsc --noEmit` / `npm test` / `npm run build` 全通過
2. 実装側ユニットテスト(最低限):
   - parseManaCost: `{2}{W}{W}` / `{X}{R}` / `{W/U}` / `{2/W}` / `{G/P}` / `{C}{C}` / `{S}` / `{0}` / 空文字列
   - solvePayment: 完全支払い / 不足 / hybrid バックトラックが必要なケース / X 込み
   - castCommander: 税 0→2→4 の累積、共闘2体の castCount 独立
   - nextPhase: untap での全アンタップ、draw での自動ドロー、turn 1 ドロースキップ、end→untap でターン増加、プールクリア
   - mulligan→draw→putOnBottom のロンドン一連
   - moveCard: トークン消滅、状態リセット、library top/bottom
   - 履歴: undo/redo の往復、上限200
3. レビュー側が fast-check プロパティテスト(I1〜I5)を追加して全パスすること(失敗したら差し戻し)

---

## 7. M4.6 追補(ルール補助強化)— この節も契約である

### 7.1 型の追加
```ts
// GameState に追加
landsPlayedThisTurn: number;   // 初期0。ターン移行(end→untap / nextTurn)で0にリセット

// CardInstance に追加
enteredTurn: number;           // battlefield に入ったターン番号。battlefield 外では 0

// CardDef に追加(任意・後方互換。キャッシュスキーマ変更不要)
tokenKind?: 'treasure' | 'clue' | 'food' | 'blood';
```

### 7.2 新コマンド
```ts
| { type: 'playLand'; cardId: string; forced: boolean }
//   手札の土地を battlefield へ移動し landsPlayedThisTurn += 1。
//   実行後の枚数が2枚目以降なら warning「このターンN枚目の土地です。」(非ブロック)。
//   手札以外/土地以外が対象なら EngineError。

| { type: 'crackTreasure'; cardId: string; color: ManaColor }
//   defs[card.defId].tokenKind === 'treasure' を検証(違えば EngineError)。
//   指定色のマナを1点プールに加え、トークンを消滅させる(I2のトークン消滅と同じ扱い)。ログ必須。
```

### 7.3 ETB フック(moveCardInternal の battlefield 進入時。playLand/castSpell/castCommander/createToken 経由を含む)
- `enteredTurn = state.turn`(battlefield から出るとき 0 に戻す)
- typeLine に `Planeswalker` を含み face.loyalty が数値 → `counters.loyalty = parseInt(loyalty)`
- typeLine に `Saga` を含む → `counters.lore = 1` + ログ「《X》は第I章で戦場に出た。」

### 7.4 ターン開始処理(untap 進入時、全アンタップの後)
- `landsPlayedThisTurn = 0`
- battlefield 上の typeLine `Saga` 各カード: `counters.lore += 1` + ログ「《X》の章カウンターがNになった。」(自動生贄はしない)

### 7.5 enterPhase の変更
- **ターン1のドロースキップを廃止**(EDH/多人数戦準拠: turn===1 でも draw 進入で1枚引く)

### 7.6 召喚酔いヘルパー(engine/commander.ts か新 engine/status.ts)
```ts
export function isSummoningSick(state: GameState, cardId: string): boolean;
// battlefield かつ typeLine(現在のface)に 'Creature' を含み、enteredTurn === state.turn、
// かつ速攻を持たない。速攻判定: いずれかの face の oracleText / printedText が
// /\bhaste\b/i または「速攻」を含む(簡易判定で良い。誤検知より見逃し側に倒す)
```

### 7.7 自動マナタップソルバー(新 engine/autotap.ts、純粋関数)
```ts
export interface AutoTapPlan {
  ok: boolean;                       // 浮きマナ+計画タップで完全支払い可能か
  taps: { cardId: string; color: ManaColor }[];  // タップすべき供給源と出す色
  payment: ManaPool;                 // 最終的にプールから引く量(浮き+追加分)
  shortfall: number;
}
export function planAutoTap(state: GameState, cost: ParsedCost, xValue: number): AutoTapPlan;
```
- 候補: battlefield の未タップかつ `producedMana` 非空。ただし `isSummoningSick` と `tokenKind === 'treasure'` は除外
- 浮きマナ(state.manaPool)を先に充当し、不足分のみタップ計画
- 優先順位: 単色土地 → 多色土地 → 非クリーチャー非土地 → クリーチャー(同順位内は producedMana が少ない順)
- 色拘束 pip は供給可能ソースが少ない色から割当。**単純貪欲で完全支払いを取りこぼさないこと**(solvePayment と同様、必要ならバックトラック。候補は高々数十、pip は高々十数なので全列挙可)
- ok=false の場合も「最善の部分計画」を返す(強行用)

### 7.8 ストア追加・変更
```ts
playLand(cardId: string, opts?: { force?: boolean }): 'ok' | 'needs-confirm';
//   landsPlayedThisTurn >= 1 && !force → 状態変更せず 'needs-confirm'

crackTreasure(cardId: string, color: ManaColor): void;

// castFromHand / castCommander:
//   solvePayment が不足 → planAutoTap。ok なら taps の setTapped+addMana と cast コマンドを
//   順次 applyCommand し【1回の commit】(undo 1回で全復元)。ログには自動タップの内訳を残す。
//   autotap でも不足 → 従来通り {shortfall} を返し UI が確認(強行=可能な分タップ+部分支払い)

// mulligan(): フリーマリガン。UI が putBottom すべき枚数 = max(0, state.mulliganCount - 1)

// toggleTap / tapForMana: 対象が isSummoningSick なら warning
//   「《X》は召喚酔い中です。」を付与(操作は通す)
```

### 7.9 不変条件の追加(プロパティテスト対象)
- I6: `landsPlayedThisTurn >= 0`。untap 進入直後は常に 0
- I7: battlefield 上のカードは `enteredTurn >= 1 && enteredTurn <= turn`、battlefield 外は 0

---

## 8. M4.7 追補(一人回し体験の仕上げ)— この節も契約である

### 8.1 型の追加
```ts
// GameState に追加
opponentLife: Record<string, number>;   // 対戦相手ラベル -> ライフ。init で { '対戦相手A': 40 }
//   I3 の例外。クランプしない(0以下・負を許容 = 敗北判定用、player life と同じ扱い)
```
- `CardInstance` 変更なし(タップインは既存 `tapped` を使う)。
- ストア設定 `autoAdvanceToMain: boolean` はストア内部状態。GameState/履歴には含めない。

### 8.2 コマンドの追加・変更(`src/engine/commands.ts`)
```ts
// 追加
| { type: 'adjustOpponentLife'; label: string; delta: number }
//   opponentLife[label] を delta 加算(なければ 40 起点)。クランプなし。ログ必須。

| { type: 'arrangeTop'; topOrder: string[]; toBottom: string[]; toGraveyard: string[] }
//   N = topOrder.length + toBottom.length + toGraveyard.length。
//   3配列の union が library 先頭 N 枚と完全一致(集合として)でなければ EngineError。
//   再構築: toGraveyard の各 id を墓地へ移動(moveCardInternal、順序は配列順で先頭から)。
//   library = [...topOrder, ...(先頭N枚に含まれず触れていない残り。元の順序を保持), ...toBottom]
//   実際には「先頭N枚を3グループに再配分」: library 先頭 N 枚を取り除き、
//   残りライブラリの前に topOrder、後ろに toBottom を付け、toGraveyard は墓地へ。
//   正しくは: newLibrary = [...topOrder, ...library.slice(N), ...toBottom] とし、
//   toGraveyard のカードは library から除外して墓地末尾へ。単一コミット。ログ必須。

// 変更: playLand に entersTapped を追加
| { type: 'playLand'; cardId: string; forced: boolean; entersTapped?: boolean }
//   entersTapped===true のとき、戦場進入処理の後に tapped=true を設定する。
```

### 8.3 status.ts への追加(純粋関数)
```ts
export type Keyword =
  | 'flying' | 'vigilance' | 'trample' | 'deathtouch' | 'lifelink' | 'menace'
  | 'first-strike' | 'double-strike' | 'reach' | 'haste' | 'hexproof'
  | 'indestructible' | 'defender' | 'ward';

export function keywords(def: CardDef | undefined): Keyword[];
//   **ルール読み取りは英語 oracleText を正本**(printedText は表示専用。CLAUDE.md 設計原則)。
//   文法認識(純キーワード行)で「保有」を判定する: 面ごとに oracleText を段落分割→reminder/
//   引用を除去→残りが CR702キーワード節のみで構成される段落のときだけ保有とする。文中に
//   埋め込まれた語(数え上げ/付与/参照: "number of abilities from among"/"have/gains"/"with")
//   からは保有を出さない。実装は keywordGrammar.possessedKeywords を共有し常磐木14種へ写像。
//   例: Odric, Blood-Cursed(本文に flying..vigilance を列挙)→ 保有0。
//   keywords() は hasVigilance(攻撃自動タップ)/isSummoningSick(召喚酔い)に効くため誤検出不可。

// 共有純粋モジュール src/engine/keywordGrammar.ts(GameState非依存・決定的・null安全)
export function possessedKeywords(def: CardDef | undefined): string[];
//   英語 oracleText の純キーワード行から保有キーワード id(KEYWORD_DEFINITIONS の id)を返す。
//   data/ruleClassifier の keyword.* 判定も本関数(辞書・純キーワード行検出)を共有する。

export function hasVigilance(state: GameState, cardId: string): boolean;
//   現在の def の keywords に 'vigilance' を含むか。攻撃補助のタップ判定に使う。

export function landEntersTapped(def: CardDef | undefined): 'always' | 'never' | 'conditional';
//   英語 oracleText のみ(printedText は読まない)。
//   always: /enters .*tapped/i を含み、かつ "unless" / "if" 条件節を含まない。
//   conditional: "enters .* tapped unless" 等の条件付き。
//   never: それ以外。
```

### 8.4 有効パワー算出(`src/engine/status.ts`)
```ts
export function effectivePower(state: GameState, cardId: string): number;
//   現在の face.power を parseInt(非数値/欠落は 0)
//   + (counters['+1/+1'] ?? 0) - (counters['-1/-1'] ?? 0)。下限なし(理論上は負も返る)。
```

### 8.5 不変条件の追加・更新
- I3 の例外に `opponentLife` を追加(クランプしない)。
- I8: `arrangeTop` 適用後も I1(全 id がちょうど1ゾーンに出現)を維持する。先頭N枚の集合は保存され、墓地行きを除き枚数不変。

### 8.6 ストア(`src/store/gameStore.ts`)で実装する操作
```ts
autoAdvanceToMain: boolean;                 // 既定 true
setAutoAdvance(on: boolean): void;

// nextPhase()/nextTurn() の結果 phase==='untap' かつ autoAdvanceToMain が真なら、
// phase==='main1' になるまで nextPhase を applySequence で連結し【単一コミット】。
// オフ時は従来通り1フェイズずつ。undo 1回で1ターン頭(=オート進行開始前)まで戻る。

playLand(cardId, opts?: { force?: boolean; entersTapped?: boolean }):
  'ok' | 'needs-confirm' | 'needs-tap-choice';
//   landEntersTapped が 'conditional' かつ opts.entersTapped 未指定 → 'needs-tap-choice'。
//   'always'→entersTapped:true、'never'→false を自動付与。
//   既存の landsPlayedThisTurn 確認('needs-confirm')は据え置き。

declareAttack(attackerIds: string[], targetLabel: string): void;
//   sum = Σ effectivePower(attacker)。adjustOpponentLife(targetLabel, -sum)、
//   各 attacker のうち hasVigilance でないものに setTapped:true、を applySequence で単一コミット。
//   isSummoningSick の attacker は warning を付すが処理は通す(サンドボックス)。

adjustOpponentLife(label: string, delta: number): void;   // dispatch ラッパー
arrangeTop(topOrder: string[], toBottom: string[], toGraveyard: string[]): void;  // dispatch ラッパー
```

---

## 9. M4.8 追補(A層プリミティブの拡充)— この節も契約である

設計指針: 確定的・プレイヤー起動の状態書き換えのみ。カード個別実装はしない(汎用アクション)。

### 9.1 コマンドの追加(`src/engine/commands.ts`)
```ts
| { type: 'mill'; count: number }
//   ライブラリ上から min(count, library.length) 枚を、上から順に墓地へ移動(moveCardInternal 経由)。
//   ログ「切削: ライブラリの上から{n}枚を墓地に置いた。」(n=実際に動いた枚数)。
//   count > library.length のとき warning「ライブラリが{count}枚に満たないため{n}枚を切削した。」。
//   count<=0 は no-op(ログなし)。

| { type: 'untapAll' }
//   battlefield 全カードの tapped=false。既存の untapAll(draft) ヘルパー(commands.ts L319)を再利用。
//   何か変化した時のみログ「すべてのパーマネントをアンタップした。」。

| { type: 'discard'; cardIds: string[] }
//   指定 cardIds を配列順に墓地へ(moveCardInternal 経由)。存在しない id は無視(throw しない)。
//   ログ「{n}枚を捨てた。」(n=実際に動いた枚数、>0 のときのみ)。手札以外でも拒否しない(サンドボックス)。
```
- I1/I2 を維持(いずれも moveCardInternal 経由。mill/discard 対象は非トークン想定だが、万一トークンでも既存の消滅挙動に従う)。

### 9.2 ストア(`src/store/gameStore.ts`)
```ts
mill(count: number): void;                  // dispatch({ type: 'mill', count })
untapAllPermanents(): void;                  // dispatch({ type: 'untapAll' })
discard(cardIds: string[]): void;            // dispatch({ type: 'discard', cardIds })(単一コミット)
discardRandom(count: number): void;
//   現在の手札から createRng(randomSeed()) + shuffledOrder で min(count, hand.length) 枚を選び、
//   discard コマンドを dispatch(mulligan/shuffleLibrary と同じ乱数パターン)。
```

---

## 10. M4.12 追補(マナ編集・サイクリング・マナ量)— この節も契約である

設計指針: A層プリミティブ(確定的・プレイヤー起動)の拡張。エンジンの既存ロジックは凍結し、下記のみ追加。

### 10.1 コマンド追加(`src/engine/commands.ts`)
```ts
| { type: 'adjustMana'; color: ManaColor; delta: number }
//   manaPool[color] = max(0, manaPool[color] + delta)。I3(非負)維持。
//   変化があった時のみログ「{color}マナを{±delta}した(現在{n})。」程度。delta=0 は no-op。
```

### 10.2 status.ts へサイクリング検出を追加(純粋関数)
```ts
export function cyclingCost(def: CardDef | undefined): string | null;
//   全 face の oracleText/printedText から「Cycling <cost>」/「サイクリング<コスト>」を検出し、
//   コスト文字列(例 "{2}", "{1}{U}")を返す。複数あれば最初の1つ。
//   {N}型・{色}型を拾えれば良い。typecycling/landcycling("Mountaincycling {1}" 等)も
//   コスト部分を返してよい。該当なければ null。reminder文等の軽微な誤検出は許容(情報用)。
//   日本語例: 「サイクリング{2}」。英語例: 「Cycling {2}」「Cycling {1}{U}」。
```

### 10.3 ストア(`src/store/gameStore.ts`)で実装する操作
```ts
adjustMana(color: ManaColor, delta: number): void;   // dispatch({ type:'adjustMana', color, delta })

cycle(cardId: string, opts?: { force?: boolean }): 'ok' | { shortfall: number };
//   cyclingCost(def) を parseManaCost → planAutoTap で支払い計画。
//   ok でない かつ !force → { shortfall } を返し UI が確認(castFromHand と同パターン)。
//   支払い可(または force): 自動タップ群 + そのカードを墓地へ(discard相当 moveCard hand→graveyard)
//   + draw(1) を applySequence で【単一コミット】(undo 1回で全復元)。ログに記録。
//   cyclingCost が null のカードに対しては no-op('ok')。
```

### 10.4 tapForMana の産出量改善(best-effort、`src/store/gameStore.ts`)
- 現状 `tapForMana` は常に `addMana amount:1`。これを、def の oracleText/printedText から
  「Add {C}{C}{C}」「{C}{C}を加える」等の**産出量**をパースして反映する(単色源は本数分を addMana)。
- 複数色を同時産出する源(例 "Add {G}{U}")は当面 各1点 or 既存の色選択にフォールバックで可。
- **パース不能・曖昧なケースは従来通り1点**。確実な補正は §10.1 のマナプール編集に委ねる(サンドボックス)。
- 純粋なテキストパースはUI層/ストア層に閉じてよい(engine の applyCommand は変更しない)。

## 11. M4.15 追補(フェッチ土地の自動化)— この節も契約である

設計指針: **新 engine コマンドは追加しない**。フェッチは既存コマンドの合成(`applySequence`)で表現する。
engine への追加は純粋な検出ヘルパー `fetchAbility` のみ。GameState に新フィールドを足さない(新 invariant 不要、I1〜I7 はカード保存則で維持)。

### 11.1 status.ts へフェッチ検出を追加(純粋関数 `src/engine/status.ts`)
```ts
export interface FetchAbility {
  lifeCost: number;                                       // 既定 0
  entersTapped: boolean;                                  // put 句が tapped/タップ状態 を含むか
  filter: 'basic' | { subtypes: string[] } | 'any-land';  // subtypes は英語サブタイプ名(Island/Swamp/…)
}
export function fetchAbility(def: CardDef | undefined): FetchAbility | null;
```
- 全 face の `oracleText`/`printedText` を `cardTexts`/`splitRulesText` で走査(`cyclingCost`/`landEntersTapped` と同方式)。
- **検出条件**(下記いずれかを満たす起動型能力の存在):
  - 英: `/Search your library for .* (land|basic land) .*/i` かつ put 句 `/onto the battlefield/i` かつ `/shuffle/i`。
  - 日: `あなたのライブラリー` を含み `.*探[しす].*` かつ `戦場に出` かつ `切り直す`。
  - いずれも満たさなければ `null`。
- **entersTapped**: put 句に 英 `onto the battlefield tapped` / 日 `タップ状態で(戦場に)出` を含めば `true`、無ければ `false`。
  (寓話の小道の「…なら、その土地をアンタップする」等の**条件付きアンタップ句は無視**=`true` のまま。)
- **lifeCost**: 英 `/Pay (\d+) life/i` / 日 `/([0-9０-９]+)\s*点のライフを支払/`。全角数字は半角化して整数化。無ければ 0。
- **filter**(優先順): ①英 `basic land` / 日 `基本土地` を含めば `'basic'`。②①でなく、文面に既知の土地サブタイプ語が現れれば `{ subtypes: [...] }`(英語名へ正規化)。③それ以外は `'any-land'`。
  - 土地サブタイプ ja→en マップ(最低限・基本5種): `平地→Plains, 島→Island, 沼→Swamp, 山→Mountain, 森→Forest`。英文は `Plains/Island/Swamp/Mountain/Forest` をそのまま採用。
  - 例: 「島や沼であるカード」/「an Island or Swamp card」→ `{subtypes:['Island','Swamp']}`。
- **解析不能・部分一致は安全側**: 検出はするが詳細が取れない場合 `filter:'any-land'`、`entersTapped:false`、`lifeCost:0`(UI で上書き可)。
- 実 Scryfall ja 文面で裏取り済みの代表値:
  - 進化する未開地 / 寓話の小道: `{lifeCost:0, entersTapped:true, filter:'basic'}`
  - 汚染された三角州: `{lifeCost:1, entersTapped:false, filter:{subtypes:['Island','Swamp']}}`
  - 虹色の眺望(Prismatic Vista): `{lifeCost:1, entersTapped:false, filter:'basic'}`

### 11.2 ストア(`src/store/gameStore.ts`)で実装する操作
```ts
fetchLand(sourceId: string, targetId: string, opts: { entersTapped: boolean; lifeCost: number }): void;
```
- `applySequence` で **単一コミット**(undo 1回で全復元)。順序:
  1. `opts.lifeCost > 0` のとき `{ type:'adjustLife', delta: -opts.lifeCost }`
  2. `{ type:'moveCard', cardId: sourceId, to:'graveyard', position:'top' }`
  3. `{ type:'moveCard', cardId: targetId, to:'battlefield', position:'top' }`(ETB フックで enteredTurn 設定)
  4. `opts.entersTapped` のとき `{ type:'setTapped', cardId: targetId, tapped:true }`
  5. `{ type:'shuffle', order }` — `order = shuffledOrder(現 library から targetId を除いた配列, createRng(randomSeed()))` を**呼び出し時に確定**(決定的)。
- engine の applyCommand 群は一切変更しない(既存コマンドの再利用のみ)。

---

## 12. M4.27 追補(スタック表現 + 能力オブジェクト)— この節も契約である

設計指針: スタックは**手動の視覚/整理補助**であり、ルール(優先権・対象適正・自動誘発)は強制しない(サンドボックス原則)。
スペル(手札/統率領域の実カード)と、起動・誘発能力(**元カードの絵を流用する能力オブジェクト**)を、中央スタックに**複数枚 LIFO で積める**。解決は手動(上から1つ + 全解決)。

### 12.1 型の変更・追加(`src/engine/types.ts`)
```ts
// ZoneId に 'stack' を追加(§1 の定義を更新):
export type ZoneId = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command' | 'stack';

// zones.stack: 順序付き。【スタック最上段 = 配列末尾】(末尾が最後に積まれ、最初に解決される)。

// CardInstance に追加(任意フィールド・後方互換):
isAbility?: boolean;                       // 能力オブジェクト(実カードでもトークンでもない)。既定 undefined/false
sourceId?: string;                         // 能力の発生元 physical instance id。元オブジェクトが消えていても LKI 参照として残る
abilityKind?: 'activated' | 'triggered';   // リボン表示用(起動/誘発)
```
- 能力オブジェクトは `zones.stack` **以外には存在しない**。解決/除去で `cards`/`zones` から削除する(別ゾーンへは移動しない=トークンの消滅則と同様)。
- 表示は能力オブジェクト自身の `defId` を使う。通常は `cards[sourceId].defId`、token death/LTB のように source が `cards` から消えている場合は `PendingTrigger.sourceSnapshot.defId` から ability object の `defId` を作る(`defs` に新規 def は追加しない)。

### 12.2 コマンドの追加(`src/engine/commands.ts`)
既存の `moveCard` は `to:'stack'` を**そのまま受理**する(ゾーンが増えただけ)。ドラッグでカードを中央へ置く操作は `moveCard(cardId,'stack')` で表現し、新コマンドは不要。マナは払わない(手動配置=サンドボックス)。

```ts
| { type: 'castToStack'; cardId: string; payment: ManaPool; forced: boolean }
//   castSpell と同様にプールから payment を減算(不足は 0 クランプ + warning)。
//   ただし行先は最終ゾーンではなく stack 末尾(最上段)。ETB フックは走らない(stack は battlefield ではない)。
//   対象が現在 command ゾーンにあり commanders に含まれる場合のみ castCount += 1(統率税は cast 時に確定)。
//   ログ「《X》を唱えた(スタックへ)。」。手札以外/統率領域以外からの cast も拒否しない(サンドボックス)。

| { type: 'addAbilityToStack'; sourceId: string; kind: 'activated' | 'triggered'; sourceSnapshot?: ObjectSnapshot }
//   sourceId が cards に存在する、または sourceSnapshot.defId が存在することを検証(どちらも無ければ EngineError)。
//   新しい能力オブジェクト instance を生成:
//   id は既存 id と衝突しない決定的な新規 id(接頭辞 'a'。token の 't{max+1}' と同方式の連番)、
//   isAbility=true, abilityKind=kind, sourceId, defId=(cards[sourceId]?.defId ?? sourceSnapshot.defId), zone='stack',
//   tapped=false, faceIndex=0, faceDown=false, counters={}, isToken=false, isCommander=false, enteredTurn=0。
//   stack 末尾へ append。ログ「《X》の{起動|誘発}能力をスタックに積んだ。」(X=現 source または snapshot のカード名)。

| { type: 'resolveStackTop'; to?: ZoneId }
//   stack が空なら no-op(ログなし)。末尾(最上段)を1つ pop。
//   - 能力オブジェクト(isAbility): cards/zones から削除。ログ「《X》の能力を解決した。」。
//   - スペル(実カード): to 指定があれば其処へ moveCardInternal。未指定なら【型で自動】:
//       face.typeLine に Instant/Sorcery を含めば graveyard、それ以外(パーマネント)は battlefield
//       (battlefield 行きは ETB フック=enteredTurn 設定/loyalty/lore が走る)。
//     ログ「《X》を解決した(→{zone})。」。

| { type: 'removeStackItem'; id: string; to?: ZoneId }
//   stack 内に id が無ければ EngineError。
//   - 能力オブジェクト: 削除。ログ「《X》の能力を取り除いた。」。
//   - スペル: to(既定 graveyard)へ moveCardInternal。ログ「《X》を打ち消した(→{zone})。」。
```

### 12.3 moveCardInternal の補強(I9 維持)
- **能力オブジェクト(`isAbility`)が `stack` 以外へ moveCard される場合、トークンと同様に消滅**する(`cards`/`zones` から削除、消滅をログ)。UI は通常そうしないが、不変条件保護のため必須。
- `ZONE_LABELS` に `stack: 'スタック'` を追加(ログ表示用)。

### 12.4 不変条件の更新・追加(プロパティテスト対象)
- **I1 更新**: 能力オブジェクトを含む**全** `CardInstance.id` は、`stack` を含むいずれかちょうど1つの `zones[*]` に1回だけ出現する。
- **I2 更新**: カード総数一定の対象は「非トークン**かつ非能力**(`isAbility !== true`)」のカード。能力オブジェクトは `stack` 専用で、解決/除去時に消滅する(消滅をログ)。
- **新 I9**: `isAbility === true` の instance は必ず `zone === 'stack'` であり、`defId` が `defs` に存在する。`sourceId` は発生元 physical id として保持するが、CR 400.7 / 603.10a の LKI ケースでは元 source が `cards` から消えていてよい。能力オブジェクトは `stack` 以外に出現しない。
- レビュー側の fast-check プロパティテストに **I9** を追加し、`stack` を含む全ゾーンで I1 を検証する。

### 12.5 ストア(`src/store/gameStore.ts`)で実装する操作
```ts
castToStack(cardId: string, opts?: { xValue?: number; force?: boolean }): 'ok' | { shortfall: number };
//   castFromHand と同じ支払い計画(solvePayment → planAutoTap、不足かつ !force なら state 不変で {shortfall})。
//   支払い可(または force): 自動タップ群 + castToStack コマンドを applySequence で【単一コミット】。
//   統率者(command ゾーン)が対象なら、コストに統率税 2*castCount を generic 加算してから solve(castCommander と同様)。

addAbilityToStack(sourceId: string, kind: 'activated' | 'triggered'): void;  // dispatch ラッパー
resolveTop(to?: ZoneId): void;                                              // dispatch({type:'resolveStackTop', to})
resolveAll(): void;
//   stack が空になるまで resolveStackTop(型で行先自動)を applySequence で【単一コミット】。空なら no-op。
removeStackItem(id: string, to?: ZoneId): void;                            // dispatch ラッパー
```
- **既存のキャスト導線(quick-cast)は変更しない**(サンドボックス: スタック利用を強制しない)。スタックへ積むのは明示操作のみ:
  手札カードの右クリック「唱える(スタックへ)」=`castToStack` / 手札カードを中央スタックへドラッグ=`moveCard(_, 'stack')`(マナ手動) /
  戦場パーマネントの右クリック「能力を起動(スタックへ)」「誘発を積む(スタックへ)」=`addAbilityToStack`。
- 統率者カードに `draggable` を付与(`Zones.tsx`)。ドラッグはゾーン移動のみ(キャストはメニュー/ダブルクリック)。

---

## 13. M4.28 追補(スタック拡張: コピー + フェッチのスタック化)— この節も契約である

設計指針: M4.27 のスタックを拡張。サンドボックス哲学(手動・ルール非強制)を維持。コピーは2系統(パーマネント=トークン / 効果=スタック)、フェッチは起動→スタック→解決の流れに統一。

### 13.1 型の追加(`src/engine/types.ts`)
```ts
// CardInstance に追加:
isCopy?: boolean;   // スタック上のスペルのコピー。isAbility と同様 stack 専用の一時オブジェクト。
                    //   解決でパーマネント型→戦場のトークン化、非パーマネント→消滅。
```
- コピー・オブジェクトは表示に `defs[defId]`(=コピー元の defId を流用)を使う(`defs` に新規追加しない)。

### 13.2 コマンドの追加(`src/engine/commands.ts`)
```ts
| { type: 'copyStackItem'; cardId: string }
//   cardId は stack 内の項目(無ければ EngineError)。コピーを stack 末尾(最上段)へ。
//   - 能力オブジェクト(isAbility) → 能力コピー: 新しい isAbility オブジェクト(同 sourceId/abilityKind、
//     defId=source.defId、id 'a{n}')。
//   - スペル(実カード/コピー) → スペルコピー: 新 instance(isCopy:true, isToken:false,
//     defId=source.defId, zone:'stack', id 'k{n}'[token 't' と独立採番])。
//   ログ「《X》をコピーした(スタックへ)。」/能力は「《X》の能力をコピーした。」。

| { type: 'copyPermanent'; cardId: string; quantity: number }
//   cardId のカードを基に、トークンコピーを quantity 個 battlefield に作成。
//   各トークン: isToken:true, defId=cards[cardId].defId, zone:'battlefield'(ETB フック適用=
//   enteredTurn/PW忠誠/Saga章)。カウンター等は複製しない(新規)。id 't{n}'..。
//   quantity<=0 は no-op。ログ「《X》のコピー・トークンをN個作った。」。
```
- **resolveStackTop / removeStackItem は §12 のまま**(コピーの解決・除去は §13.3 の moveCardInternal が処理)。
  spell の行先は従来どおり `to` 指定 or 型で自動。

### 13.3 moveCardInternal の補強(I10 維持)
- カードが `isCopy === true` の場合の移動(stack からの移動を含む):
  - 行先が `battlefield` **以外** → 消滅(`deleteCardFromState`、ログ「コピー《X》は消滅した。」)。トークン/能力の消滅則と同様。
  - 行先が `battlefield` → **トークン化して残す**: 通常の battlefield 進入処理(ETB)を行ったうえで `isToken:true, isCopy:false` を設定。
- これで `resolveStackTop`(パーマネント型→戦場でトークン化 / 非パーマネント→消滅)も、スタック項目の手動ドラッグ(`moveCard` to graveyard/hand 等)も正しく振る舞う。
- 採番ヘルパー `nextCopyId`(接頭辞 `k`、token の `t{max+1}` と同方式)を追加。

### 13.4 不変条件の更新・追加(プロパティテスト対象)
- **新 I10**: `isCopy === true` の instance は必ず `zone === 'stack'`(コピーは stack 専用。戦場到達時に isToken 化して isCopy 解除、他ゾーンへの移動で消滅)。`defId ∈ defs`。
- **I2 更新**: 総数一定の対象を「非トークン ∧ 非能力 ∧ **非コピー**(`!isToken && !isAbility && !isCopy`)」に。I2b(トークンは battlefield のみ)は不変(コピーは stack 上では `isToken:false`)。
- fast-check プロパティテストに **I10** を追加。

### 13.5 フェッチのスタック化(エンジン追加なし=既存コマンドの合成。`src/store/gameStore.ts`)
§11(フェッチ自動化)の即時実行版を**置換**する。`fetchAbility`(検出)は §11 のまま流用。
```ts
activateFetch(sourceId: string, opts: { entersTapped: boolean; lifeCost: number }): void;
//   applySequence で単一コミット(生贄+ライフ=コスト、フェッチ能力をスタックへ):
//   [ lifeCost>0 ? {adjustLife,-lifeCost} , {moveCard sourceId→graveyard top},
//     {addAbilityToStack sourceId 'activated'} ]

resolveFetch(abilityId: string, targetId: string, opts: { entersTapped: boolean }): void;
//   applySequence で単一コミット(サーチ実行 + 能力消滅):
//   [ {moveCard targetId→battlefield top}, entersTapped?{setTapped targetId true},
//     {shuffle order=現 library から targetId を除外し createRng(randomSeed()) で確定},
//     {removeStackItem abilityId} ]
```
- `resolveAll()`(§12.5): 最上段から解決を積むが、**フェッチ能力**(その `sourceId` の def が `fetchAbility(def)≠null` の能力オブジェクト)に達したら**そこで停止**(そこまでを単一コミット)。UI がそのフェッチ能力の検索ダイアログを開く。
- 旧 `fetchLand`(即時)は撤去。`resolveTop` 経路は UI ラッパー(`requestResolveTop`)でフェッチ能力を検出し `FetchSearchDialog` を開く(`resolveFetch` で確定)。フェッチ能力の `entersTapped`/`filter`/`lifeCost` は `sourceId` の def から `fetchAbility` で導出。

---

## 14. M4.30 追補(per-turn カウンター: ストーム + ドロー数)— この節も契約である

設計指針: `landsPlayedThisTurn`(§7.1)と**完全に同じパターン**の per-turn カウンターを2つ追加。情報パネル(ストーム/今ターンの土地・ドロー/信心)の元データ。エンジンは純粋・決定的。

### 14.1 型の追加(`src/engine/types.ts`)
```ts
// GameState に追加(init 0):
spellsCastThisTurn: number;   // 今ターンに唱えた呪文数(ストーム)。
drawnThisTurn: number;        // 今ターンに引いたカード枚数。
```
- `src/engine/init.ts`: 初期 state で両方 `0`。

### 14.2 増減・リセット(`src/engine/commands.ts`)
- `applyCastToStack`(§12/§13 のキャスト): 成功時 `spellsCastThisTurn += 1`。
  **呪文のキャストのみ**カウントする。`addAbilityToStack`(能力)/`copyStackItem`(コピー)/フェッチ起動(`activateFetch`)は**増やさない**(ストーム=唱えた呪文数)。
- `case 'draw'`: 実際に引いた枚数 `drawn` を `drawnThisTurn += drawn`。
- `handleUntapEntry`(untap 進入時、`landsPlayedThisTurn = 0` と同所): `spellsCastThisTurn = 0; drawnThisTurn = 0;`。
- 注: 開幕7枚/マリガンの `draw` も `drawnThisTurn` を増やすが、turn1 の untap リセットで 0 化されるため対局中の値は正しい(プレ対局の一時値は許容)。

### 14.3 不変条件(プロパティテスト対象)
- **I11**: `spellsCastThisTurn >= 0`。untap 進入直後は 0。
- **I12**: `drawnThisTurn >= 0`。untap 進入直後は 0。
- fast-check プロパティテストに I11/I12 を追加。

### 14.4 スナップショット前方互換(`src/store/gameStore.ts`)
- 旧 snapshot(M4.30 以前)には両フィールドが無い → `restoreGame` の正規化(M4.27 の `normalizeSnapshotZones` と同所)で `spellsCastThisTurn`/`drawnThisTurn` を **`0` で補完**する。怠ると復元時に `undefined`→表示 NaN。

### 14.5 派生情報(`src/data/gameInfo.ts` 新規・純粋関数。エンジン外)
```ts
computeGameInfo(state: GameState): {
  storm: number;          // state.spellsCastThisTurn
  landsThisTurn: number;  // state.landsPlayedThisTurn
  drawsThisTurn: number;  // state.drawnThisTurn
  devotion: Record<'W'|'U'|'B'|'R'|'G', number>;
};
```
- 信心(devotion): 戦場の各パーマネントの現在 face の `manaCost` を `parseManaCost`(`src/engine/mana.ts`)で解析し色シンボルを集計。色pip=その色、hybrid=両色、monoHybrid/phyrexian=その色。土地/能力/コピー(manaCost 無し)は寄与0。読み取りのみ(`deckStats.ts` と同じ純粋関数の流儀)。

---

## 15. M4.31 再整合(統率税)— この節も契約である。**CR 903.8 を正本とし、戻し時加算モデルを撤回する**

CR 根拠: **CR 903.8** は「統率領域から唱えた過去回数」ごとに追加 `{2}` を課す。したがって `castCount` は「その統率者がこのゲームで統率領域から唱えられた回数」を表す。**統率領域へ戻した回数ではない**。

### 15.1 加算契機(`src/engine/commands.ts`)
- `applyCastToStack` / 統率者のキャスト経路: `from === 'command'` かつ `isCommander(state, cardId)` の呪文が、CR 601.2i の「spell becomes cast」時点に到達したら、その統率者の `castCount += 1`。
  - UI でマナ不足などを強行する場合も、最終的に「唱えた」なら加算する。
  - パートナー等の複数統率者は該当 `cardId` ごとに独立して加算する。
- `moveCardInternal`: 移動先 `to === 'command'` であっても **`castCount` を増やしてはならない**。統率領域へ戻すことは、次回コストを増やす原因そのものではない。
- 既存 `castCommander` engine コマンドは legacy 経路であり、残す場合も同じ意味へ揃える。`castCommander` と `castToStack` で `castCount` の意味が分岐してはならない。

### 15.2 税コスト・表示
- `commanderTax(state, cardId) = 2 * castCount`(`src/engine/commander.ts`)は維持。ただし `castCount` の定義は「統率領域から唱えた回数」に固定する。
- 税列: 初期配置(command、castCount 0)→ 初回キャスト完了で castCount 1、支払った税は +0 → 死亡して統率領域へ戻すだけでは castCount 不変 → 再キャスト時は過去1回により +2、キャスト完了で castCount 2 → 次は +4。
- init.ts の初期配置は castCount=0。統率者が手札/墓地/追放など統率領域以外から唱えられる将来ケースでは、CR 903.8 上の統率税回数に加算しない。

### 15.3 不変条件・回帰
- **I-CommanderTax**: `castCount >= 0` かつ `castCount` は「統率領域から唱えた回数」と一致する。`moveCard` to command 単独では変化しない。
- 旧 M4.31 の「戻し時加算」テスト・受け入れ条件は CR 不適合として撤回する。新レビューは `castToStack` from command で +1、`moveCard` to command で +0 を採点する。

---

## 16. M6.1 ルール分類器 + デッキ別ルール補助レポート(データ層契約)

設計指針: **分類・表示のみで `GameState` を生成も変更もしない**。完全ルールエンジン化しない。分類器は `src/data/` の純粋関数で、`src/engine/`・Zustand・DOM・localStorage・IndexedDB に依存しない。M6トラックの第1段。

参照(調査資産): `research/scryfall-rules/2026-06-19/analysis/oracle-grammar-analysis.md`(MTGオラクル文の定型文法・CR 207/113/6xx/701/702・決定的パースアルゴリズム・Odric非誤検出の根拠)。ただし同レポートは CR 2026-04-17 生成であり、M-CR-RECONCILE 以後のCR正本は §34.0 の 2026-06-19 固定版。

### 16.1 CardDef の追加フィールド(`src/types/card.ts` / `src/data/scryfall.ts`)
```ts
export interface CardDef {
  // 既存フィールドは維持
  edhrecRank?: number;   // Scryfall edhrec_rank。低いほどEDHで使われる
  keywords?: string[];   // Scryfall keywords。未取得/旧キャッシュでは undefined
}
```
- `ScryfallCard` に `edhrec_rank?: number` / `keywords?: string[]` を追加し、`mapScryfallCardToCardDef` の return で `CardDef` に格納する。
- `applyJapanesePrint` は `{...base}` で CardDef 直下フィールドを保持するため、英語解決時の `edhrecRank`/`keywords` がJA合成後も残る(追加対応不要・テストで担保)。
- **`CACHE_SCHEMA_VERSION` は bump しない**。任意フィールド追加は後方互換(旧IndexedDBエントリは欠落=`undefined`、読めてクラッシュしない)。
- **重要**: `keywords`(Scryfall)は「保有」を保証しない(`Odric, Blood-Cursed` の keywords は数え上げ対象の語を全部含む)。**分類器はキーワード保有判定に `keywords` を使わない**(将来用に保存するのみ)。

### 16.2 型(`src/data/ruleClassifier.ts`)
```ts
export type RuleRisk = 'A' | 'B' | 'C' | 'D' | 'E';
export type RuleAutomationLayer =
  | 'primitive' | 'semi-automatic' | 'trigger-assist' | 'warning' | 'advisory';
export type RuleTagKind =
  | 'keyword-ability' | 'keyword-action' | 'trigger' | 'effect-kind'
  | 'game-concept' | 'resource-token';

export interface RuleTag {
  id: string;            // 安定ID。下記の命名規則。UI/test/集計で使う
  label: string;         // 日本語表示名
  kind: RuleTagKind;
  risk: RuleRisk;
  layer: RuleAutomationLayer;
  confidence: 'high' | 'medium' | 'low';
  matchedText: string;   // 判定根拠の英語oracle断片(透明表示用。全文は入れない)
  ruleRef?: string;      // 例 '702.9', '701.6'
}

export function classifyCardRules(def: CardDef): RuleTag[];
```
タグID命名規則(`.` は UI testid で `-` に正規化):
- `keyword.<name>` — **保有**するキーワード能力(文法判定)。
- `action.<verb>` — カードが行う効果/CR701処理: `draw` / `create-token` / `counter`(打ち消し) / `card-counters` / `sacrifice` / `exile` / `search` / `destroy` / `mill` / `scry`。
- `trigger.<kind>` — 誘発型: `etb` / `attack` / `death` / `upkeep` / `cast` / `landfall`。
- `concept.target` / `effect.replacement` / `effect.continuous`。

### 16.3 classifyCardRules の挙動契約
- **純粋・決定的・null安全**: 同一 `def` に常に同一 `RuleTag[]`(安定順)。`oracleText`/`edhrecRank`/`keywords` 欠落でも例外を投げない。`GameState` を読まない。
- **分類は英語 `def.faces[i].oracleText` を正本**にする(常に存在。`printedText`/JAは表示用で分類根拠にしない。日本語データは6件のみのため)。
- **文法認識(キーワード保有判定の核)**: 面ごとに oracleText を `\n` で段落分割→括弧 reminder と引用内能力を分離→残りが **CR702キーワード節のみで構成される「純キーワード行」** の時だけ `keyword.<name>` を付す(カンマ区切り列・`Cycling {2}`/`Protection from X` 等のコスト/値/句を許容)。**文中に埋め込まれたキーワード語からは保有を付さない**。
- **非保有ガード**(これらは `keyword.*` を出さない): `... have/has/gain(s) [kw]`(付与)/ `number of abilities from among ...`(数え上げ)/ `... with [kw]` / `creature with flying`(参照)/ `create ... token with [kw]`(生成トークンの能力)/ `can't be countered`(キーワード能力でない)。
- **打ち消しの分離**: `counter target spell/ability` / `打ち消す` → `action.counter`。`+1/+1 counter` 等「カウンターを置く」→ `action.card-counters`。両者を必ず分離。`can't be countered` はどちらでもない。
- **Odric 保証(受け入れ条件)**: `Odric, Blood-Cursed` → `keyword.*` を**1つも出さない**。`trigger.etb` と `action.create-token` は**出す**。
- 各タグは判定根拠 `matchedText`(英語断片)と `confidence` を必ず持つ。`risk`/`layer` はタグ種別ごとの静的対応表(A-E×レイヤー、§proposal準拠)。
- M6.1の必須タグ集合(review採点対象の中核): `keyword.flying`/`keyword.cycling`(保有・代表)、`trigger.etb`、`action.draw`/`create-token`/`card-counters`/`counter`/`sacrifice`/`exile`/`search`/`destroy`、`concept.target`、`effect.replacement`。CR702全191キーワードの辞書整備は到達目標。

### 16.4 デッキ別集計(`src/data/ruleDeckSummary.ts`)
```ts
export interface RuleDeckEntry { card: CardDef; quantity: number; section: 'commander' | 'main'; }
export interface RuleDeckSummaryItem {
  tag: RuleTag;          // 代表(最高confidence)の matchedText を保持
  deckCount: number;     // quantity 込みの該当枚数
  cardNames: string[];   // 表示用。printedName ?? name(《》はUI側)
}
export function summarizeDeckRuleTags(entries: RuleDeckEntry[]): RuleDeckSummaryItem[];
```
- `entries` はインポート解決済みカードから作る。`GameState` を作らない。
- 並びは **`deckCount` desc → 固定タグ表示順**(決定的)。EDHヒストグラム/`computeRulePriority` 採点は M6.1 では非実装。

### 16.5 UI契約(`src/components/RuleAutomationReport.tsx`、`ImportScreen` の `DeckStats` 直後)
- ルート `data-testid="rule-automation-report"`。各行 `data-testid="rule-tag-<tagId>"`(`.`→`-`)。
- 行表示: タグ名 / Risk(A-E) / Layer / デッキ内枚数 / 代表カード名(《printedName ?? name》) / **判定根拠の `matchedText` 断片** / **「自動推定」ラベル**(ヒューリスティックで誤検出があり得ることを明示)。E層は「助言のみ」。
- **レポート表示だけでは `GameState` を生成/変更しない**(ゲーム開始前後の初期盤面は従来通り)。

---

## 17. M6.2a スタック中はフェイズ/ターン移動を禁止(ストア層契約)— この節も契約である

設計根拠: MTGルール上、スタックに未解決の効果がある間は次のステップ/フェイズへ進めない。よって**ハードブロック(強行不可)**とする。CLAUDE.md サンドボックス哲学「ユーザーは常に強行できる」の**意図的な例外**(ルール準拠)。

### 17.1 ゲート(`src/store/gameStore.ts` `dispatchTurnTransition`)
- `state.zones.stack.length > 0` の間、`nextPhase` / `nextTurn` は**何も適用しない**(`state.phase` / `state.turn` を変えない)。`autoAdvanceToMain` による `untapToMainCommands` も**積まない**(自動進行も停止)。
- ブロック時は `warnings` に「スタックに未解決の効果があります。先に解決してください。」を1回設定する(state は変更しない=履歴も積まない)。
- エンジンの `applyNextPhase` / `applyNextTurn`(`commands.ts`)は**無条件・純粋のまま**(ゲートはストア層。`playLand` の force と同じ層)。よって既存エンジンテストは不変。
- `resolveTop` / `resolveAll` でスタックが空(`length === 0`)になれば、`nextPhase` / `nextTurn` は通常どおり進む。

### 17.2 UI(`src/components/playmat/`)
- スタック非空のとき「次のフェイズ」(`next-phase`)/「次のターン」(`next-turn`)ボタンを **disabled** にし、理由を `title` 等で示す(`PlaymatHud.tsx` ControlRail)。
- Enter キー(`onNextTurn`、`Playmat.tsx` `useShortcuts`)はスタック非空時 no-op。
- **ArrowUp(M4.29)は不変**: スタック非空ならフェイズ進行ではなくトップ解決(`requestResolveTop`)にリダイレクトされる(従来挙動を維持)。

---

## 18. R下地/R1 バッチ適用ヘルパー(`src/engine/batch.ts`)— この節も契約である

目的: ストア private の逐次適用(`applySequence`)を**公開・テスト可能・再利用可能**にする。M6 候補アクション/テストが同じ「単一 undo 単位」の合成を使えるようにする土台。

```ts
import type { GameState } from './types';
import type { GameCommand, ApplyResult } from './commands';

export interface CommandBatch { commands: readonly GameCommand[]; label?: string; }

// commands を順番に applyCommand し、warnings を連結して返す。
export function applyCommands(state: GameState, commands: readonly GameCommand[]): ApplyResult;
export function applyCommandBatch(state: GameState, batch: CommandBatch): ApplyResult;
```

契約:
- **純粋・決定的**。引数 `state` を一切ミューテートしない(I4)。乱数生成は行わない(必要な順列は呼び出し側が各コマンドのペイロードに埋め込み済みである前提)。
- `applyCommands` は `commands` を先頭から `applyCommand` で適用し、各結果の `warnings` を順に連結した `ApplyResult` を返す。空配列なら `{ state, warnings: [] }`(`state` はそのまま)。
- 途中のコマンドが `EngineError` を投げたらそのまま伝播する(部分適用結果は返さない=呼び出し側が commit しないことでロールバック)。
- `applyCommandBatch(state, {commands})` は `applyCommands(state, commands)` と同義(`label` は無視してよい。ログ/デバッグ用の任意メタ)。

ストア統合(挙動不変):
- `src/store/gameStore.ts` の private `applySequence` を `applyCommands` へ統一(同一挙動)。**ストアの公開メソッド名・戻り値・挙動は一切変えない**。既存テストは全て不変で通る。

---

## 19. M6.2 安全な候補アクション(データ層 + UI契約)— この節も契約である

設計指針: `classifyCardRules`(§16)のタグから、カードの**右クリックメニューに実行候補**を出す。**候補メニューを開くだけでは `GameState` を変更しない**。実行は既存の store 操作(単一 undo 単位)を呼ぶだけで、エンジンにカード固有ルールを足さない。**誘発は自動でスタックに積まない**(それは M6.3)。対象選択を伴う半自動操作は M6.4。

### 19.1 分類タグの追加(`src/data/ruleClassifier.ts`)
M6.2 候補のために以下の `action.*` タグを追加(英語 oracleText、否定文脈ガードは §16 準拠):
- `action.proliferate`(`/\bproliferate\b/i`、リマインダー除外)
- `action.discard`(`/\bdiscard(?:s|ed)?\b/i`、`can't discard` 等は除外)
- `action.shuffle`(`/\bshuffle\b/i`)
- `action.surveil`(`/\bsurveil\b\s*\d*/i`)
既存 `action.draw`/`action.mill`/`action.scry`/`action.create-token` は流用。これらは M6.1 レポートにも表示される(§16 のタグ集合に追記)。各タグの risk/layer は静的対応表(Risk A〜B、primitive/semi-automatic)。

### 19.2 タグ→候補→既存store操作のマップ(`src/components/playmat/Playmat.tsx` `buildMenuItems`)
カードの `classifyCardRules` 結果に応じて、右クリックメニューに **「ルール補助候補」節(separator)** を追加。該当タグが無ければ節は出さない。各候補は**既存のダイアログ/store操作を再利用**(新規の盤面変更ロジックを作らない):

| タグ | 候補ラベル | testid | 実行(既存) |
|---|---|---|---|
| `action.draw` | ドロー | `candidate-draw` | `CountDialog(draw)` → `store.draw(n)` |
| `action.mill` | 切削 | `candidate-mill` | `CountDialog(mill)` → `store.mill(n)` |
| `action.scry` / `action.surveil` | 占術/諜報 | `candidate-scry` | `ArrangeTopDialog` → `store.arrangeTop(...)` |
| `action.create-token` | トークン生成 | `candidate-token` | `TokenCreateDialog`(宝物/食物/手掛かり/血プリセット内蔵)→ `store.createToken(...)` |
| `action.proliferate` | 増殖 | `candidate-proliferate` | `store.proliferateAll()`(直接・単一undo) |
| `action.discard` | ランダムに捨てる | `candidate-discard` | `CountDialog(discardRandom)` → `store.discardRandom(n)` |
| `action.shuffle` | シャッフル | `candidate-shuffle` | `store.shuffleLibrary()`(直接) |

### 19.3 挙動契約
- **候補メニューを開く/項目を表示するだけでは `GameState` 不変**。パラメータ付き候補(draw/mill/scry/token/discard)は**既存ダイアログで確定**してから実行。パラメータ無し候補(proliferate/shuffle)は**選択=実行**(既存の 引く/シャッフル と同じ作法)。
- すべて既存 store 操作経由で**単一 undo** で戻る(store はもう単一commit。§R1 `applyCommands` 基盤)。
- 候補は手札/戦場/スタック/統率領域いずれでも、該当タグがあれば出す。タグが無ければ出さない。
- エンジン(`src/engine/`)・`applyCommand`・`CACHE_SCHEMA_VERSION` は不変。新しい盤面変更コマンドは追加しない。

---

## 20. M6.3 誘発候補キュー(ストア層 + UI契約)— この節も契約である

設計指針: ゲームイベント(戦場入場/離場・唱える・上陸・アップキープ)の後、関連カードの**誘発型能力を「候補」として提示**する。**自動ではスタックに積まない**。ユーザーが選んだ時のみ `addAbilityToStack(sourceId, 'triggered')`。候補は無視できる。`GameState`/スナップショット/不変条件は変更しない(候補は UI 一時状態)。M4.27 のスタック能力オブジェクト・M6.2a のスタック門と整合。

### 20.1 分類タグの追加(`src/data/ruleClassifier.ts`)
誘発検出タグを追加(英語 oracleText・否定文脈ガード準拠):
- `trigger.death`(`/\b(?:when|whenever)\b[^,.]*\bdies\b/i` または `\bis put into a graveyard from the battlefield\b`)
- `trigger.cast`(`/\b(?:when|whenever)\b[^,.]*\bcasts?\b[^.]*\bspell\b/i`、または `whenever you cast`)
- `trigger.attack`(`/\b(?:when|whenever)\b[^,.]*\battacks?\b/i`)
- `trigger.landfall`(`/\b(?:when|whenever)\b[^,.]*\bland\b[^,.]*\benters\b/i` または `\blandfall\b`)
- `trigger.upkeep`(`/\bat the beginning of[^.]*\bupkeep\b/i`)
既存 `trigger.etb` は流用。risk/layer は静的(C / trigger-assist)。これらは M6.1 レポートにも自然に出る。

### 20.2 イベント検出(`src/store/gameStore.ts`・前進操作のみ)
ユーザー操作の commit 時(`commit(prev, next)`)に **prev→next の差分**から候補を計算する。**undo/redo/restore/import では候補を生成しない**(前進操作のみ)。検出:
- **ETB**: `next.zones.battlefield` に増えたカード。そのカードが `trigger.etb` を持てば候補(source=そのカード)。
- **離場/死亡**: `battlefield` から `graveyard` へ減ったカード。`trigger.death` を持てば候補(source=そのカード。`addAbilityToStack` は墓地の sourceId でも能力オブジェクトを作れる)。
- **上陸(landfall)**: `landsPlayedThisTurn` 増加(=土地が出た)時、**戦場の全パーマネント**から `trigger.landfall` を持つものを候補(watcher)。
- **アップキープ**: `phase` が `upkeep` に変化した時、戦場の `trigger.upkeep` 保持パーマネントを候補(watcher)。
- **唱えた時(cast)**: `spellsCastThisTurn` 増加時、スタックに積まれたその呪文が `trigger.cast` を持てば候補(source=その呪文)。
- (attack は M6.3 では候補化しない=将来。タグだけ追加。)

候補は ephemeral ストア状態 `triggerCandidates: { sourceId: string; triggerId: string; label: string }[]`(`GameState` 外。`warnings` と同様)。新イベントで置き換え、`addAbilityToStack` 実行や「無視」で空に。

### 20.3 UI(`src/components/playmat/`)
- 非ブロッキングの **誘発候補パネル**(新規 `TriggerCandidatePanel`、`data-testid="trigger-candidates"`)。各候補行に カード名(《printedName ?? name》)・誘発種別ラベル・**「スタックへ」ボタン**(`data-testid="trigger-candidate-add-<sourceId>"`)。全体に **「無視」**(`trigger-candidates-dismiss`)。
- 「スタックへ」→ `store.addAbilityToStack(sourceId, 'triggered')`(単一 undo)→ その候補を消す。「無視」→ 候補を全消去(盤面不変)。
- 既存の手動「誘発を積む(スタックへ)」メニューは維持(M6.3 は proactive 提示の追加)。

### 20.4 不変・非干渉
- 候補の表示/無視だけでは `GameState` 不変。**自動で `addAbilityToStack` を呼ばない**。
- `resolveAll`/`resolveTop`/undo/redo の既存挙動を壊さない。I9(`isAbility ⇒ zone stack`)を維持。スナップショットに `triggerCandidates` を含めない。

---

## 21. M6.4 半自動アクション(対象選択を伴う候補・データ層 + UI契約)— この節も契約である

設計指針: `classifyCardRules` のタグから、**対象選択を伴う**候補を source カードの右クリックに出す。共有の **TargetPickerDialog** で対象を1つ選ばせ、**既存の store 操作で実行**(単一 undo)。**対象選択ダイアログを開く/閉じるだけでは `GameState` 不変**。エンジンにカード固有ルール・新コマンドを足さない(既存 `moveCard`/`dispatch(addCounters)`/`dispatch(attach)` を再利用)。誘発の自動積みはしない。M6.2(直接実行系)と区別し、候補システムを整理する。

### 21.1 分類タグの追加(`src/data/ruleClassifier.ts`)
- `action.return`(label「墓地/追放から戻す」, kind 'keyword-action', risk 'D', layer 'semi-automatic'): `/\breturn(?:s)?\b[^.]*\bfrom\b[^.]*\b(?:graveyard|exile)\b/i`。
- `action.attach`(label「装備/付与」, ruleRef '702.6'): `/\battach(?:es)?\b/i` または `/\bequip\b/i`(装備)。
既存 `action.sacrifice`/`action.exile`/`action.destroy`/`action.search`/`action.card-counters` を流用。

### 21.2 候補システムの整理(`src/components/playmat/ruleActionCandidates.ts`)
候補を **direct(M6.2: 確定実行)** と **target-requiring(M6.4: 対象選択)** に区別する型へ整理(`requiresTarget: boolean` 等)。M6.4 の target-requiring 候補:

| kind | label | testId | tag | 対象 | 実行(既存) |
|---|---|---|---|---|---|
| `sacrifice-target` | 対象の生け贄 | `candidate-sacrifice-target` | `action.sacrifice` | 戦場 | `moveCard(target,'graveyard')` |
| `destroy-target` | 対象を破壊 | `candidate-destroy-target` | `action.destroy` | 戦場 | `moveCard(target,'graveyard')` |
| `exile-target` | 対象を追放 | `candidate-exile-target` | `action.exile` | 戦場 | `moveCard(target,'exile')` |
| `counters-target` | 対象にカウンター | `candidate-counters-target` | `action.card-counters` | 戦場 | `dispatch(addCounters(target,'+1/+1',+1))` |
| `attach-target` | 装備/付与 | `candidate-attach-target` | `action.attach` | 戦場のクリーチャー | `dispatch(attach(source, target))` |
| `search-library` | ライブラリを探す | `candidate-search-library` | `action.search` | (対象なし) | 既存ライブラリビューア(`setZoneViewer('library')`) |
| `return-from-zone` | 墓地/追放から戻す | `candidate-return-from-zone` | `action.return` | (対象なし) | 既存墓地ビューア(`setZoneViewer('graveyard')`) |

### 21.3 TargetPickerDialog(`src/components/playmat/`)
- 新規 `TargetPickerDialog`。props: タイトル / 対象候補 `cardIds` / `state`(表示用) / `onPick(targetId)` / `onCancel`。ルート `data-testid="target-picker"`。各対象に「選択」ボタン `data-testid="select-target-<cardId>"`(カード名《printedName ?? name》表示)。
- `Playmat.tsx`: `runRuleActionCandidate(kind, sourceCardId)` を `sourceCardId` 受け取りに変更。target-requiring kind は `TargetPickerDialog` を開く(対象 = 該当ゾーン。attach は source=その装備、対象=戦場クリーチャー)。`search-library`/`return-from-zone` は既存ビューアを開く。
- 対象を選択した時のみ既存 store 操作を実行(単一 undo)。キャンセル/未選択では盤面不変。

### 21.4 不変・非干渉
- 候補表示・ダイアログ開閉だけでは `GameState` 不変。実行は既存コマンド経由で**単一 undo**。
- エンジン(`src/engine/`)・`applyCommand`・`CACHE_SCHEMA_VERSION` 不変。`attach` は既存 `{type:'attach',cardId,to}` を使う(`attachedTo` を設定)。M6.1/M6.2/M6.3 のタグ・候補・誘発キューを壊さない。

---

## 22. M6.5 付与キーワードの手動オーバーライド(エンジン契約)— この節も契約である

設計指針: アプリは**印刷キーワード**を文法認識で正しく検出する(§8.3)が、他カードが**付与**したキーワード(装備の速攻等)は追えない。完全ルールエンジン化せず、サンドボックス哲学に沿って**ユーザーが手動でキーワードを付与**できるようにする。

### 22.1 型(`src/engine/types.ts`)
```ts
export interface CardInstance {
  // 既存フィールドは維持
  manualKeywords?: string[]; // 手動付与した常磐木キーワード id(Keyword の部分集合: 'haste'/'vigilance'/'flying' 等)
}
```
- 値は `Keyword`(§8.3 の14種)の id のみ。重複なし。未設定/旧スナップショットでは `undefined`(= 付与なし)。

### 22.2 コマンド(`src/engine/commands.ts`)
```ts
| { type: 'setManualKeywords'; cardId: string; keywords: string[] }
```
- 対象 instance の `manualKeywords` を `keywords`(`Keyword` id のみへ正規化・重複排除)で**置換**する。空配列なら `undefined`/`[]`。ログに「《X》の手動キーワードを更新した。」。決定的・純粋。

### 22.3 status.ts の統合(`src/engine/status.ts`)
- `keywords(def)`(印刷のみ・def 由来)は**不変**。
- 新規 `effectiveKeywords(state, cardId): Keyword[]` = **印刷 `keywords(def)` ∪ `card.manualKeywords`**(`Keyword` に絞る・重複排除)。
- `hasVigilance(state, cardId)` は `effectiveKeywords(...).includes('vigilance')` を使う。
- `isSummoningSick(state, cardId)` の `!keywords(def).includes('haste')` を `!effectiveKeywords(state, cardId).includes('haste')` に変更(=手動 haste で召喚酔いが解ける)。
- バッジ表示(`CardView.tsx`)の `keywordList` も **印刷 ∪ instance.manualKeywords**(`Keyword` に絞る)にする。

### 22.4 UI(`src/components/playmat/`)
- 戦場クリーチャーの右クリックに「手動キーワード…」(`data-testid="manual-keywords-open"`)。小ダイアログ(`data-testid="manual-keywords-dialog"`)で常磐木14種のチェックボックス(現 `manualKeywords` を初期チェック、各 `data-testid="manual-kw-<keyword>"`)。確定で `store.setManualKeywords(cardId, selected)`(単一 undo)。最低限 速攻(haste)・警戒(vigilance)を含む。

### 22.5 不変・互換
- 数値不変条件は追加不要(配列のみ)。`manualKeywords` の値は常に `Keyword` id の部分集合。
- **スナップショット前方互換**: `restoreGame`/正規化で `manualKeywords` 欠落を許容(`undefined` のまま動作)。旧スナップショット復元でクラッシュしない([[snapshot-forward-compat]])。
- `applyCommand` 決定性・I1〜I12 を維持。印刷キーワード検出(§8.3)・M6.1〜M6.4 を壊さない。

---

## 23. M6.8 ゾーン外キャスト補助(データ層 + UI契約)— この節も契約である

設計指針: EDH(特に Muldrotha の墓地プレイ、Kefka/Celes のリアニメイト/フラッシュバック)で頻出する「墓地・追放から唱える」を補助する。**エンジンAPIは不変**: `castToStack`(store)も `applyCastToStack`(`commands.ts`)も `moveCardInternal(draft, cardId, 'stack', …)` で**現在ゾーンを問わずスタックへ移す**ため、墓地/追放からのキャストは既存コマンドで成立する。本節は **(a) 墓地/追放カードへの「唱える」導線**と **(b) 代替/追加コスト・代替キャストの助言タグ**を追加する。**コストは自動精算しない**(サンドボックス哲学・マナ不足でも強行可)。

### 23.1 分類タグの追加(`src/data/ruleClassifier.ts` `classifyAbilityText`)
いずれも**助言用**(盤面非変更)。`source: 'oracleText'`、英語 `oracleText` を正本とする(§P1)。
- `concept.alt-cast`(label「代替キャスト」, kind 'keyword-ability', risk 'D', layer 'warning', ruleRef '702'): キーワード型の代替キャストを検出。`/\b(?:flashback|escape|disturb|aftermath|jump-?start|embalm|eternalize|foretell|retrace)\b/i`。`matchedText` に一致キーワードを格納。
- `concept.cast-from-zone`(label「墓地/追放から唱える」, kind 'oracle-phrase', risk 'D', layer 'warning', ruleRef '601.3'): キーワードに依らない常在許可を検出。`/\b(?:cast|play)s?\b[^.]*\bfrom\b[^.]*\b(?:your\s+)?(?:graveyard|exile)\b/i`。
- `cost.additional`(label「追加コスト」, kind 'oracle-phrase', risk 'D', layer 'warning', ruleRef '601.2b'): `/\bas an additional cost to cast\b/i`。
- `cost.alternative`(label「代替コスト」, kind 'oracle-phrase', risk 'D', layer 'warning', ruleRef '601.3b'): `/\b(?:without paying (?:its|their) mana cost|rather than pay (?:this spell'?s|its) mana cost)\b/i`。

注意: これらは**助言タグ**であり既存の候補アクション(§19/§21)を増やさない。`action.return`(§21.1)等の既存タグ・検出は不変。誤発火を抑えるため正規表現は上記に厳格化する(`escape`/`disturb` 等の単語は EDH の実カードではキーワード行に限り出るため許容範囲)。

### 23.2 ゾーン外キャストUI(`src/components/playmat/Playmat.tsx` `buildMenuItems`)
- **墓地・追放**にあるカードで `typeLine` が `Land` を含まない場合、「唱える(スタック)」項目(`key:'cast-from-zone'`, `data-testid="cast-from-zone"`)を追加し、既存の `requestCastToStack(cardId)` を呼ぶ(= `store.castToStack`。マナ自動タップ/不足時強行/単一undo は既存挙動を踏襲)。
- **コスト/代替キャスト助言**: 当該カードの `classifyCardRules(def)` に `concept.alt-cast` / `concept.cast-from-zone` / `cost.additional` / `cost.alternative` のいずれかがある場合、「唱える」導線の直近に**無効(disabled)な助言項目**(`data-testid="cast-cost-advisory"`)を1つ出す。文言は検出タグの `label` を連結(例「⚠ 追加コスト/代替キャスト(コストは手動精算)」)。この助言は **hand/command の既存「唱える(スタック)」にも**同条件で表示してよい(任意だが推奨)。
- 助言項目はクリック不能で `GameState` を変更しない。土地(墓地/追放)には「唱える」を出さない(既存の移動/戻し導線で扱う)。

### 23.3 不変・非干渉
- **エンジン不変**: `src/engine/`・`applyCommand`・`commands.ts`・`CACHE_SCHEMA_VERSION` は一切変更しない。新コマンドを足さない。
- 候補・助言の**表示だけでは `GameState` 不変**。実キャストは既存 `castToStack` 経由で**単一 undo**。
- 既存の hand/command キャスト導線・サイクリング・移動導線を壊さない。M6.1〜M6.5 のタグ・候補・誘発キュー・手動キーワードを壊さない。スナップショット前方互換に影響なし(新フィールドなし)。

---

## 24. M6.9 リソーストークンの能力導線拡充(ストア + UI契約)— この節も契約である

設計指針: 宝物/手掛かり/食物/血のプリセット生成は既存(`tokenKind`)。宝物だけ「割ってマナを出す」があり、手掛かり/食物/血は素の「生け贄に捧げる」しか無い。**各トークン固有の起動型能力を1操作で実行**できるよう、既存コマンドの**バッチ合成(R1 `applyCommands`)で単一 undo**にする。**エンジンAPIは不変**(新コマンドを足さない。`moveCard`/`draw`/`adjustLife`/`discard` を合成)。起動コスト({2} 等のマナ・タップ)は他の能力同様**自動精算しない**(サンドボックス)。

**トークンの消滅**: `moveCard token→'graveyard'` はエンジンの既定どおりトークンを**消滅させる**(`commands.ts` の「token leaving battlefield → ceases to exist」。宝物クラックと同じ挙動)。ストアで graveyard に再挿入して残すような上書きはしない。undo はスナップショット復元で戦場に戻る。

### 24.1 ストアの新メソッド(`src/store/gameStore.ts`)— 全て単一 undo(`applyCommands(cur, [...]) → commit(result.state, ...)`)
- `crackClue(cardId: string): void` — 手掛かり「{2}, 生け贄: 1ドロー」。`[{moveCard cardId→'graveyard' top}, {draw 1}]`。
- `crackFood(cardId: string): void` — 食物「{2},{T}, 生け贄: 3点ゲイン」。`[{moveCard cardId→'graveyard' top}, {adjustLife +3}]`。
- `crackBlood(cardId: string, discardCardId?: string): void` — 血「{1},{T}, 手札1枚を捨てる, 生け贄: 1ドロー」。`discardCardId` が現在の手札にあれば先頭に `{discard [discardCardId]}` を積み、続けて `[{moveCard cardId→'graveyard' top}, {draw 1}]`。手札が空/未指定なら discard を省略し警告「捨てるカードがありません」(生け贄+ドローは実行)。
- いずれも対象が当該 `tokenKind` でない場合は何もしない(防御的)。決定的。

### 24.2 UI(`src/components/playmat/Playmat.tsx` `buildMenuItems` 戦場枝)
既存の「割ってマナを出す」(宝物)・「生け贄に捧げる」は維持。`tokenKind` 別に固有能力項目を**「生け贄に捧げる」の上**に追加:
| tokenKind | 項目ラベル | testId | 動作 |
|---|---|---|---|
| `clue` | 割って1ドロー(生け贄) | `crack-clue` | `store.crackClue(cardId)` |
| `food` | 割って3点ゲイン(生け贄) | `crack-food` | `store.crackFood(cardId)` |
| `blood` | 割って1枚捨ててドロー(生け贄) | `crack-blood` | 手札があれば **TargetPickerDialog**(§21.3、対象=手札)を開き、選択した手札を `discardCardId` として `store.crackBlood(cardId, picked)`。手札が空なら直接 `store.crackBlood(cardId)` |
- TargetPicker を開く/キャンセルだけでは `GameState` 不変。実行は単一 undo。

### 24.3 不変・非干渉
- **エンジン不変**: `src/engine/`・`applyCommand`・`commands.ts`・`CACHE_SCHEMA_VERSION` は変更しない。新コマンドを足さない。
- プリセット生成・宝物クラック・既存「生け贄に捧げる」を壊さない。M6.1〜M6.8 を壊さない。各クラックは**1スナップショット**(単一 undo)で元に戻る。

---

## 25. M6.10 誘発候補キューの精度向上(データ層 + ストア検出契約)— この節も契約である

設計指針: M6.3(§20)の誘発候補キューは **自身**の誘発(出た/死んだ/唱えた本人)と landfall/upkeep のみ検出し、(1)**攻撃誘発はタグだけで検出が無い**、(2)**他者を見張る誘発**(「あなたが呪文を唱えるたび」=Niv-Mizzet/魔技、「他の(or あるクリーチャーが)戦場に出る/死亡する/攻撃するたび」)を取りこぼす。本節はこれらを補う。**助言のみ・自動では積まない・undo/redoで消える**という M6.3 の不変は維持。**エンジンAPIは不変**。

### 25.1 分類タグの追加(`src/data/ruleClassifier.ts` `classifyAbilityText`)
既存 `trigger.etb/death/cast/attack/landfall/upkeep` は不変。**見張り型**の派生タグを追加(kind 'trigger', layer 'trigger-assist', risk 'C', confidence 'high'):
- `trigger.cast-watcher`(label「呪文を唱えるたびの誘発」): `/\bwhenever\b[^.]{0,40}\bcasts?\b/i` または `/\bmagecraft\b/i`(「whenever you cast」「whenever a player casts」「魔技」を捕捉。自身一回限りの「When you cast this spell」=`when`始まりには一致しにくい)。
- `trigger.etb-other`(label「他が戦場に出たときの誘発」): `/\b(?:when|whenever)\b[^.]*\b(?:another|a|an|one or more)\b[^.]{0,40}\benters\b/i`(「Whenever another creature enters」を捕捉。「When this/CARDNAME enters」=自身型には**一致しない**)。
- `trigger.death-other`(label「他の死亡時の誘発」): `/\b(?:when|whenever)\b[^.]*\b(?:another|a|an|one or more)\b[^.]{0,40}\bdies\b/i`(「Whenever 〈名前〉 or another creature dies」「a creature you control dies」を捕捉)。
- `trigger.attack-watcher`(label「クリーチャー攻撃時の誘発」): `/\b(?:when|whenever)\b[^.]*\b(?:another|a|an|one or more)\b[^.]{0,40}\battacks?\b/i`。

裏取り済み(実カード文言): Niv-Mizzet/Storm-Kiln/魔技→cast-watcher、Soul Warden→etb-other、Blood Artist/各種アリストクラット→death-other、Chainer等→attack-watcher。Sun Titan「enters or attacks」等の**自身型**や素のバニラには一致しない。これらは助言用。`FIXED_TAG_ORDER` に追記し決定的出力を保つ。

### 25.2 検出の拡張(`src/store/gameStore.ts` `detectTriggerCandidates`)
イベント時に**自身**(既存)に加えて、**戦場の他パーマネント**で対応する見張りタグを持つものを候補に追加(`addTriggerCandidate` で重複排除)。
- ETB イベント(戦場流入あり): 既存の流入カードの `trigger.etb` に加え、流入していない戦場パーマネントで `trigger.etb-other` を持つものを「他が戦場に出たとき」として追加。
- death イベント: 死亡カードの `trigger.death`(既存)に加え、`next.zones.battlefield` で `trigger.death-other` を持つものを「他の死亡時」として追加。
- cast イベント: 唱えた本人の `trigger.cast`(既存)に加え、戦場で `trigger.cast-watcher` を持つものを「呪文を唱えるたび」として追加。

### 25.3 攻撃誘発の検出(`src/store/gameStore.ts` `declareAttack`)
攻撃宣言は監視対象の state 差分を作らない(taptと相手ライフのみ)ため、`declareAttack` 内で明示的に候補を構築する。`commit(result.state, …)` の後に、次を `triggerCandidates` として **set**(攻撃は1イベント=置換。空でも置換):
- 各 `attackerIds` で `trigger.attack` を持つもの →「攻撃したとき」。
- `result.state.zones.battlefield` で `trigger.attack-watcher` を持つもの →「クリーチャー攻撃時」。
- `addTriggerCandidate` で重複排除。`commit` が attack で `detectTriggerCandidates=null`(=据え置き)を返すことを利用し、その後に明示 set する。

### 25.4 不変・非干渉
- 候補は**助言のみ**。自動でスタックに積まない。ユーザーが選ぶと既存 `addAbilityToStack(sourceId,'triggered')`。undo/redo・newGame・mulligan で `triggerCandidates` がクリアされる既存挙動を維持。
- **エンジン不変**: `src/engine/`・`applyCommand`・`CACHE_SCHEMA_VERSION` 不変。M6.1〜M6.9 を壊さない。見張りタグの過検出は許容(助言・ユーザーが取捨)。`resolveAll` 等の既存挙動不変。

---

## 26. 分類精度ハーネスとコーパス回帰(計測基盤・この節も契約である)

設計指針: 分類器(`classifyCardRules`)とキーワード検出(`possessedKeywords`)の精度を、ローカル Scryfall スナップショット(17,491枚)に対して**定量化・不一致炙り出し**する開発ツールを置く。**出荷物ではない**(`scripts/` 配下、`tsconfig.app.json` の `include:["src"]` 外=ビルド非対象)。**計測品(ハーネス・照合ルール・コーパス・既知差分)自体も初版は不完全と前提し、反復改善する第一級対象**として扱う(下記原則)。本節は計測専用であり、**分類器・エンジンのロジックは変更しない**(唯一の `src/` 変更は写像関数の `export` 追加のみ)。

### 26.0 原則(統治)
- ハーネスは**“判定”でなく“不一致の炙り出し”**を出す。Scryfall `keywords` は「保有」でなく「参照/付与」も含むため**絶対正解ではなく候補集合**(P1 の grant vs has 問題)。出力数値は「裁定済み範囲」での参考値。
- 不一致は人手で (a) 分類器を直す / (b) 照合ルールを直す / (c) **既知差分**として登録、のいずれかへ裁定する。
- コーパスは**高信頼の少数から育てる**。各ラベルに出所/信頼度。低信頼は回帰ゲートから除外。

### 26.1 ハーネス本体(`scripts/classifier-accuracy.ts`)— A0
- 実行手段: `tsx` を devDependency に追加し、`package.json` に `"accuracy": "tsx scripts/classifier-accuracy.ts"` を追加(`npm run accuracy`)。`package.json`/lock は変更可(エンジン契約外)。
- 入力: `research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`(gitignore 済み・17,491枚)。存在しなければ明示エラーで終了。
- 写像: 各 raw を **`mapScryfallCardToCardDef`(`src/data/scryfall.ts`)で CardDef 化**(アプリ実行時と同一写像で測るのが肝)。この関数を `export` する(`src/` 変更はこれのみ。ロジック不変)。
- 適用: `classifyCardRules(def)` / `possessedKeywords(def)` を全カードに適用。
- 照合(正解側・暫定): Scryfall `keywords`(候補集合)/ `produced_mana` / `type_line`。
- 出力:
  - `research/classifier-accuracy/report.md`(**コミット対象**): タグ別件数 + タグ別の FP候補/FN候補 **上位N(例20)事例**(カード名 + oracle 抜粋)+「この数値は未調整」明記。サイズ有界。
  - `research/classifier-accuracy/report.json`(**gitignore**): 全カードの不一致明細。`.gitignore` に `research/classifier-accuracy/*.json` を追加(既存 analysis の `.md` を残し大 `.json` を除く慣例に倣う)。

### 26.2 ハーネス磨き込み(A1)
- `research/classifier-accuracy/known-divergences.json`(**コミット**): 分類器が意図的に Scryfall と異なるケース(`{ tagOrKeyword, scryfallSays, classifierSays, reason }`)。ハーネスはこれを差し引いて報告。
- 自己キャリブレーション: 人手検証した **gold 部分集合(まず ~50枚、`scripts/` 内 or fixtures)** で、ハーネス自身の誤り(照合/ラベル由来)を分離計測し report に併記。
- 回帰コーパス `src/data/__tests__/fixtures/classifier-corpus.ts`(**コミット**・型付き TS モジュール。eslint/tsc の json-module/node-fs 解決問題を避けるため `.json` でなく `.ts`): `{ name, typeLine, oracleText, expectKeywords[], forbidKeywords[], expectTags[], forbidTags[], scryfallKeywords[], confidence, note }` の配列。reviewer 専有テスト **`review.classifier-corpus`** が `classifyCardRules`/`possessedKeywords` と突き合わせ(`expect*` は包含、`forbid*` は非包含=grant≠has の既知差分を固定)。低信頼ラベルは回帰ゲートから除外。

### 26.3 不変・非干渉
- **エンジン/分類器ロジック不変**(計測のみ)。`src/` の変更は `mapScryfallCardToCardDef` の `export` 追加のみ。`review.*`/`docs/`/`CLAUDE.md`/`eslint.config.js`/`CACHE_SCHEMA_VERSION` は変更しない(本節の reviewer テスト `review.classifier-corpus` は Fable 専有)。
- ハーネスはビルド(`tsc -b`/`vite build`)・出荷に含まれない(`scripts/` は `include` 外)。機械チェック4点(`npm run lint`/`tsc --noEmit`/`vitest run`/`build`)は引き続き全通過。`npm run accuracy` でレポート生成できること。

## 27. Phase B 分類精度向上: キーワード行文法の精緻化(`src/engine/keywordGrammar.ts`)— この節も契約である

§26 のハーネスが 17,491 枚で炙り出した**本物の分類器バグ**(`research/classifier-accuracy/findings.md`・`known-divergences.json` の `_phaseB_targets`)を、キーワード行文法に閉じて修正する。**正本は引き続き英語 `oracleText` の文法**であり、Scryfall `keywords` は runtime の判定に**使わない**(ハーネスの候補集合に留める)。変更は `src/engine/keywordGrammar.ts` の `splitKeywordClauses` / `parseKeywordClause`(+ 専用 equip 解析の追加)のみ。`possessedKeywords` / `classifyCardRules` のシグネチャ・純粋性・決定性は不変。

### 27.1 F1 セミコロン区切り
- `splitKeywordClauses` のクラウス区切りに `;` を追加する(`,` と同等に分割。先頭の `and ` リストマーカ除去や `and` 分割の既存挙動は維持)。
- 受け入れ: `"Flying; banding"`(Nalathni Dragon / Teremko Griffin)が `flying` と `banding` の2クラウスに分割され、両キーワードを `possessedKeywords` が返す。
- 非干渉: `;` の両辺がともにキーワード・クラウスとして解釈できる場合のみキーワード行になる。片方でも非キーワードなら従来どおり行全体を棄却し、新たな過検出を生まない。

### 27.2 F2/F3 equip 専用パラメトリック解析
equip を generic な `keywordStartsClause` 経路から外し、cycling/landwalk/offering と同様に `parseKeywordClause` の前段の特例として扱う。`normalizeKeywordText`(em ダッシュ→`-`、`\s*-\s*`→`-`、小文字化、末尾 `.` 除去)適用後のクラウスに対し:

- **equip と判定する条件**: 先頭の能力語/名前プレフィックス(`… -`)を任意で許し、その後 `equip` + **品質語(任意・英字語)** + **マナ費用トークン `{…}`** が来て、**クラウス末尾で終わる**こと。
- **`equip` で始まるが上記に一致しないクラウスは `null` を返す**(generic ループへ落とさない=過検出の遮断)。

判定表(`normalizeKeywordText` 後の文字列):

| 入力クラウス | 判定 | 根拠 |
|---|---|---|
| `equip {10}` | equip | 2桁費用 |
| `equip-{2}`(`Equip—{2}`) | equip | em ダッシュ費用 |
| `equip worthy {1}` | equip | 品質語(Mjölnir) |
| `equip legendary creature {2}` | equip | 品質語複数(Excalibur) |
| `perseus's bow-equip {6}`(`… — Equip {6}`) | equip | 能力語/名前プレフィックス(FF系) |
| `equip abilities you activate cost {1} less to activate` | 非 equip | `{1}` の後に prose が続き末尾アンカー不成立 |
| `equipment card` / `equipment spells you cast cost {1} less` | 非 equip | `equip` 直後が文字(`m`)で費用でない |
| `… cloud is equipped …` | 非 equip | `equip` で始まらない |

- 推奨実装(正本は上の挙動・判定表): `/(?:^|^.*-)equip(?:[ -](?:[a-z][a-z ]*?))?[ -]?\{[^}]+\}$/`。
- 真の FP×6(Bureau Headmaster / Cloud, Planet's Champion / Éowyn, Lady of Rohan / Fighter Class / Helitrooper / Strong Back)が equip 保有から外れる。FF系13枚 + 2桁費用 + 品質語付き equip が検出される。

### 27.3 残置(本パスでは許容)
- Belt of Giant Strength(`"Equip {10}. This ability costs {X} less…"` 同一段落のピリオド継続)と My Precious // Allure of Power(`"Equip—{2}, Pay 2 life."` 追加コスト併記)は equip を検出しない残置 FN として許容する。段落の文単位分割や追加コスト許容は末尾アンカー方針を崩し FP リスクを上げるため見送る(`findings.md` に将来候補として記録)。

### 27.4 既知差分(Scryfall 側の誤り)
- Excalibur, Sword of Eden(`Equip legendary creature {2}`)と Mjölnir, Hammer of Thor(`Equip worthy {1}`)は Scryfall `keywords` が `Equip` を欠く。F3 で正しく検出した結果ハーネスが classifier-only と出すため、`known-divergences.json` に `scryfall-missing-equip-keyword` を登録して差し引く(分類器が正しく、Scryfall が取りこぼし)。

### 27.5 不変・非干渉
- **grant≠has 不変**: `"creatures you control gain X"` / `"is a [type] with flying"` / `"equipped creature has haste"` 等の付与・他者付与は引き続き保有から除外(§26 / P1 の成果・`review.m6kw`)。
- **GameState 不変**(I1〜I7 影響なし)・snapshot 前方/後方互換不変(状態形不変)。`possessedKeywords` / `classifyCardRules` は純粋・決定的のまま。
- 変更は `src/engine/keywordGrammar.ts` のみ。`review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` は変更しない。reviewer テスト `review.classifier-corpus`(コーパス fixture 含む)は Fable 専有。機械チェック4点全通過 + `npm run accuracy` 再生成で equip FP→0・equip FN ≤2・flying FN が Nalathni/Teremko 分減ること。

## 28. Phase C 分類精度向上: 誘発ファミリー拡充(`src/data/ruleClassifier.ts`)— この節も契約である

§20〜25/M6.10 までで誘発検出は etb / death / cast / attack / landfall / upkeep(+各 watcher)をカバーする。本節は EDH 高頻度の **end-step / draw / sacrifice / combat-damage** の4ファミリーを足す。**正本は英語 `oracleText`**(`printedText` は使わない)。誘発の検出は既存どおり `classifyCardRules` → `classifyAbilityText` の正規表現に閉じ、新モジュールは作らない。`classifyCardRules` のシグネチャ・純粋性・決定性は不変。検出方針は `research/scryfall-rules/2026-06-19` snapshot(17,491枚)で事前裏取り済み(下表の件数は裏取り時の参考値)。

### 28.0 最終ゴールと本マイルストーンの分界(重要)
**最終ゴール**: 4ファミリーが「分類タグ」+「ライブ誘発候補キュー」の両方に正確に出る。**本マイルストーンの範囲**は下表。エンジンのイベント検出可否がファミリーで異なるための分界であり、sacrifice/combat-damage のキュー非連動は仕様(バグでない)。

| ファミリー | RuleTag id | 分類タグ | ライブキュー連動 | キュー非連動の理由 |
|---|---|---|---|---|
| end-step | `trigger.end-step` | ○ | ○(phase `end` 入り) | — |
| draw | `trigger.draw` | ○ | ○(`drawnThisTurn` 増分) | — |
| sacrifice | `trigger.sacrifice` | ○ | **×(今回タグのみ)** | 専用 sacrifice コマンド無し。battlefield→graveyard は death と区別不能 |
| combat-damage | `trigger.combat-damage` | ○ | **×(今回タグのみ)** | サンドボックスは戦闘ダメージを自動解決しない=検出イベントが存在しない |

watcher 分割(`*-other`/`-watcher`)・sacrifice/combat-damage のキュー連動は最終ゴールへ繰り越す(将来 sacrifice コマンド/戦闘ダメージ解決イベント導入時)。

### 28.1 検出規則(`classifyAbilityText` に追加・正本は挙動)
共通原則 **「誘発動詞は when/whenever 節の主語が支配する=when/whenever と動詞の間にカンマを挟まない」**(`[^,.]*`)で、別の誘発に続く効果としての draw/sacrifice を遮断する。`TAG_TEMPLATES` に4ラベルを追加し、すべて confidence `high`。

| RuleTag id | ラベル(日本語) | 推奨正規表現 | 件数 |
|---|---|---|---|
| `trigger.end-step` | エンドステップ開始時の誘発 | `/\bat the beginning of\b[^.]*\bend step\b/i`(ただし同段落に `/\bnext end step\b/i` を含む場合は**除外**=遅延誘発) | 447 |
| `trigger.draw` | カードを引いたときの誘発 | `/\b(?:when\|whenever)\b[^,.]*\bdraws?\b[^,.]*\bcards?\b/i` | 115 |
| `trigger.sacrifice` | 生け贄に捧げたときの誘発 | `/\b(?:when\|whenever)\b[^,.]*\b(?:sacrifices?\|sacrificed)\b/i` | 96 |
| `trigger.combat-damage` | 戦闘ダメージを与えたときの誘発 | `/\b(?:when\|whenever)\b[^,.]*\bdeals?\b[^,.]*\bcombat damage\b/i` | 569 |

裏取りで固定した除外(FP)例(`removeReminderAndQuotes` で括弧内 reminder/引用は除去済みが前提):

| カード | テキスト断片 | 期待 | 理由 |
|---|---|---|---|
| Baleful Strix | `When this creature enters, draw a card.` | `trigger.etb` ○ / `trigger.draw` **×** | draw は ETB の効果。draw の前にカンマ |
| Coastal Piracy | `Whenever a creature you control deals combat damage to an opponent, you may draw a card.` | `trigger.combat-damage` ○ / `trigger.draw` **×** | draw の前にカンマ(戦闘ダメージ誘発の効果) |
| The Locust God | `Whenever you draw a card, …` ＋ `… at the beginning of the next end step.` | `trigger.draw` ○ / `trigger.end-step` **×** | `next end step` は遅延誘発 |
| Tireless Tracker | `Whenever you sacrifice a Clue, …`(reminder の `Sacrifice this token: Draw a card.` は除去) | `trigger.sacrifice` ○ / `trigger.draw` **×** | draw は reminder 内 |
| Ashling, the Limitless | `… at the beginning of your next end step, sacrifice it …` | `trigger.sacrifice` ○ / `trigger.end-step` **×** | `next end step` は遅延誘発 |
| (汎用) | `When this creature enters, each player sacrifices …` / `Whenever ~ attacks, you may sacrifice …` | `trigger.sacrifice` **×** | sacrifice は別誘発の効果(前にカンマ) |
| (汎用) | 起動コスト `Sacrifice this:` / `As an additional cost … sacrifice` | `trigger.sacrifice` **×** | when/whenever が無い |

### 28.2 ライブ誘発候補キュー(`src/store/gameStore.ts` `detectTriggerCandidates`)
既存 upkeep/landfall 分岐と同型で2分岐を追加。`triggerCandidates` は GameState 外のエフェメラル状態(snapshot 非対象・I1〜I7 不変)。undo/redo で新規生成しない既存挙動を維持。

- **end-step**: `prev.phase !== 'end' && next.phase === 'end'` のとき、`next.zones.battlefield` 上の `trigger.end-step` 保持カードを候補化(label「エンドステップ開始時」)。`sawTriggerEvent = true`。
- **draw**: `next.drawnThisTurn > prev.drawnThisTurn` のとき、`trigger.draw` 保持カードを候補化(label「カードを引いたとき」)。`sawTriggerEvent = true`。
  - 助言のみ: 「あなたが引いたとき」基準で出す。`whenever a player/opponent draws` 等は1人回しでは過剰提示し得るが advisory として許容(精密な watcher 分割は最終ゴールへ繰り越し)。
- **sacrifice / combat-damage はキューに出さない**(§28.0 の理由)。タグはルール補助パネルにのみ反映。

### 28.3 ハーネス拡張(`scripts/classifier-accuracy.ts`)— 広網プローブ方式
Scryfall に「triggers」正解集合は**無い**ため、誘発精度は Scryfall 突合では測れない。正本ゲートは**コーパス回帰**(§28.4)とし、ハーネスは**人間裁定用の候補リスト**を出す(§26.0 の統治原則):
- 各新ファミリーに**ゆるい probe**(例: end-step=`/\bend step\b/i`、draw=`/\bdraws?\b.*\bcards?\b/i`、sacrifice=`/\bsacrifices?\b/i`、combat-damage=`/\bcombat damage\b/i`)を当て、「probe 一致だが分類器が当該 `trigger.*` を付けなかった」カードを **FN候補**上位N(例20)で列挙。
- 「分類器がタグ付けしたが probe 的に疑わしい」を **FP候補**で列挙。
- `report.md` に「誘発ファミリー候補(裁定対象)」節を追加(既存 keyword FP/FN 節と並列・サイズ有界・「未調整」明記)。判定でなく裁定リスト。

### 28.4 コーパス回帰(正本ゲート・`src/data/__tests__/fixtures/classifier-corpus.ts`)
既存 `CorpusEntry`(`expectTags[]`/`forbidTags[]`)をそのまま流用し高信頼エントリを追加(型変更不要)。oracle は英語正本を snapshot から採取。最低限、§28.1 の固定表のカード(Baleful Strix の `forbidTags:['trigger.draw']` 追加、The Locust God / Coastal Piracy / Mayhem Devil / Tireless Tracker / Ashling / Abiding Grace)を含める。reviewer 専有テスト `review.classifier-corpus` が `expect*` 包含 / `forbid*` 非包含を固定。

### 28.5 不変・非干渉
- **grant≠has 不変**: 他者に誘発を付与する文(`creatures you control gain "whenever …"` 等)は自分が保有とタグ付けしない(§26/P1・`review.m6kw` の方針を維持)。
- **GameState 不変**(I1〜I7 影響なし)・snapshot 前方/後方互換不変。`classifyCardRules` は純粋・決定的のまま。エンジン(`src/engine/`)は変更しない。
- 実装の変更対象は `src/data/ruleClassifier.ts`(タグ+regex)/ `src/store/gameStore.ts`(end-step/draw 分岐)/ `scripts/classifier-accuracy.ts`(プローブ)/ `classifier-corpus.ts`(fixture)。`review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` は変更しない(reviewer テスト `review.classifier-corpus` と本節の `review.phaseC` は Fable 専有)。機械チェック4点全通過 + `npm run accuracy` 再生成で誘発ファミリー候補節が出力されること。

## 29. エンジン文法器トラック Phase G0: 文法カバレッジ分析ハーネス(`src/engine/grammar/` + `scripts/grammar-coverage.ts`)— この節も契約である

### 29.0 目的と分界(重要)
最終ゴール(V2深掘り)は **「ほぼ全 MTG 用語を能力IR+効果インタプリタで自動実行」**。本マイルストーン G0 はその **計測のみ**。盤面挙動・エンジン公開挙動を一切変えず、コーパス(`research/scryfall-rules/2026-06-19/raw/...cards.json`、17,491枚)を MTG 文法構造へ分解し、**「どの構文/効果アトムを実装すれば何%が自動化可能か」を定量化**する。これが G1(能力IR型+パーサ)以降のスコープと優先順位をデータで確定する。**本節では IR 型も実行も作らない**(分解=計測専用の純関数のみ)。

統治原則は §26.0 / §28.3 を継承: **probe は判定でなく人間裁定用の広網候補**。Scryfall に「効果アトム正解集合」は無いため、本ハーネスの数値は「未調整の候補分布」であり絶対正解ではない。正本ゲートはコーパス回帰(§29.6 の裏取り固定 + `review.grammar-coverage`)とする。

### 29.1 新規モジュール `src/engine/grammar/`(純関数・計測専用)
GameState に一切触れない純粋・決定的関数群。`React`/`DOM`/`Zustand` 非依存(エンジン哲学準拠)。**正本は英語 `oracleText`**(`printedText` 不使用)。既存 `keywordGrammar.ts` の `cardOracleTexts` / `splitParagraphs` / `removeReminderAndQuotes` と `possessedKeywords`(`src/engine/keywordGrammar`)を再利用する(reminder/引用除去を必ず通す)。

公開関数(シグネチャは契約):
- `splitAbilityLines(def: CardDef): AbilityLine[]` — 各面 oracleText を段落へ分割し reminder/引用除去した行に shape を付けて返す。
- `classifyAbilityShape(line: string, typeLine: string): AbilityShape` — 能力タイプを1つ返す(§29.2)。
- `detectEffectAtoms(line: string): EffectAtomId[]` — 効果アトム(動詞)を probe で検出(§29.3、重複なし昇順)。
- `detectConstructs(line: string): ConstructId[]` — 対象/モード/条件など「自動化の壁」構文を検出(§29.4、重複なし昇順)。

型:
```ts
type AbilityShape =
  | 'activated' | 'triggered' | 'delayed-triggered'
  | 'replacement' | 'static' | 'spell' | 'keyword';
interface AbilityLine { faceIndex: number; text: string; shape: AbilityShape; }
type EffectAtomId = string;   // §29.3 の安定 id(例 'effect.draw')
type ConstructId = string;    // §29.4 の安定 id(例 'construct.target')
```

### 29.2 能力タイプ分類(`AbilityShape`・1行=1タイプ、優先順で先勝ち)
判定順序(先に当たったものを採用):
1. `keyword` — `parsePureKeywordLine`(`keywordGrammar`)が non-null = 純キーワード行。
2. `activated` — コロン `: ` を含み、左辺がコスト様(`{...}` を含む / 先頭が `Sacrifice`/`Discard`/`Pay`/`Tap`/`Exile`/`Remove` + 目的語、または `{T}`)。注釈的コロン(レベルアップ表記等)は左辺コスト様でなければ除外する保守判定でよい。
3. `triggered` — 先頭が `When`/`Whenever`/`At `。うち本文に `the next` + 時間語(`turn`/`end step`/`upkeep`)を含むものは `delayed-triggered` に降格。
4. `replacement` — `/\bif\b[^.]*\bwould\b[^.]*\binstead\b/i` / `/\benters\b[^.]*\bwith\b/i` / `/\bas\b[^.]*\benters\b/i` / `/\bskip(s)?\b/i`。
5. `spell` — `typeLine` が Instant/Sorcery で上記いずれにも当たらない本文行。
6. `static` — 上記いずれにも当たらない継続効果(既定の落とし所)。

カード単位サマリは「各 shape を **1つ以上持つカード数**」で集計(1枚が複数 shape を持ち得る)。

### 29.3 効果アトム語彙(`EffectAtomId`・安定 id・probe は広網)
最低限この語彙を実装する(id は固定=以降フェーズの IR と接続するキー)。probe は例示、確定は §29.6 裏取りで。
- カード流れ: `effect.draw` `effect.mill` `effect.discard` `effect.search` `effect.return` `effect.exile` `effect.scry` `effect.surveil` `effect.reveal`
- 盤面: `effect.create-token` `effect.destroy` `effect.sacrifice` `effect.counter-plus`(+1/+1等カウンター) `effect.tap` `effect.untap` `effect.attach` `effect.transform` `effect.put-onto-battlefield`
- ダメージ/ライフ: `effect.damage` `effect.gain-life` `effect.lose-life` `effect.loyalty`
- 資源: `effect.add-mana` `effect.treasure`
- 修整: `effect.pump`(`gets +X/+X`) `effect.grant-keyword` `effect.restriction`(`can't`)
- その他: `effect.extra-turn` `effect.gain-control` `effect.copy` `effect.counter-spell`
- プレイヤーカウンター: `effect.poison` `effect.energy` `effect.experience`

各アトムは `{ id, label(日本語), probe: RegExp }` の表で持つ。`detectEffectAtoms` は1行に対し当たった id 集合を返す(出現は行単位で重複排除)。

### 29.4 構文(自動化の壁)語彙(`ConstructId`)
- `construct.target`(`/\btarget\b/i`=対象選択が要る) / `construct.each-player`(`each player/opponent`) / `construct.you-control`(`you control`) / `construct.choose-modal`(`choose one/two/...` または 行頭 `•`) / `construct.may`(`you may`) / `construct.variable-x`(`{X}` または X コスト) / `construct.intervening-if`(`/,\s*if\b/i`) / `construct.for-each`(`for each`)

### 29.5 出力レポート(`research/grammar-coverage/report.md` + `report.json`)
`scripts/grammar-coverage.ts`(`npm run grammar-coverage`、tsx)。`classifier-accuracy.ts` の骨格(`mapScryfallCardToCardDef` 写像・カウント集計・Markdown描画・サイズ有界 top-N・`report.json` 併出力)を踏襲。冒頭に「未調整(候補分布であり絶対正解でない)」を明記。節:
1. **総数**: raw / 写像成功 / 失敗 / 効果保有行数。
2. **能力タイプ分布**: shape 別カード数 + 行数。
3. **効果アトム頻度ランキング**: アトム別「保有カード数」「出現行数」降順。
4. **累積カバレッジ曲線**(本節の主成果): 効果保有行を母数に、アトムをカード数降順で並べ、上位 K に対し (a)**カバー行率**=「行内の検出アトムが全て上位 K に含まれる行」の割合、(b)**アトム出現カバー率**=出現の何%が上位 K か、を K=5,10,15,20,全 で表化。さらに **自動化可能フロンティア**=「(a) かつ `construct.target`/`construct.choose-modal` を含まない行」の割合を併記(=対象もモードも要らず上位アトムだけで完結する行の比率)。
5. **構文分布**: `ConstructId` 別の効果行出現率(対象/モードの壁の大きさ)。
6. **裁定候補**(§26.0): 「効果保有行だが既知アトムを1つも検出できなかった行」を top-N 列挙(=語彙の取りこぼし発見用)。
7. **写像失敗** top-N。

### 29.6 裏取り(確定前必須)
probe 確定前に snapshot 実カード文言で誤発火/取りこぼしを点検する。最低限の固定例(`review.grammar-coverage` に反映):
- `effect.draw` は §28.1 のカンマ規則に縛られない(アトムは「効果としての draw も数える」=誘発タグとは目的が異なる)。ただし reminder/引用は除去済みで数える。
- `effect.tap` は起動コストの `{T}` 単独を二重計上しない(コロン左辺のコストは shape 判定で `activated` へ、アトムは右辺=効果側 `tap target`/`tap all` を主対象とする方針を裏取りで確認)。
- `effect.add-mana` は「`add {C}`/`add one mana`」を拾い、`spend`/`pay` を拾わない。
- Baleful Strix: shape=`triggered`、`effect.draw` 検出(誘発タグの draw 除外とは別系統で良い旨をレポート脚注に明記)。

### 29.7 不変・非干渉(エンジン不変)
- **計測専用**: GameState を生成・変更しない。`applyCommand`/コマンド/ストアに触れない。**I1〜I7 影響なし**・snapshot 互換不変。
- `src/engine/grammar/*` は純粋・決定的(同入力→同出力)。`src/engine/` の既存ファイル・公開挙動は**差分ゼロ**(import のための index 新設は可、既存 export 改変は不可)。
- 実装の変更対象は **新規** `src/engine/grammar/*` / `scripts/grammar-coverage.ts` / `research/grammar-coverage/*`(生成物)/ `package.json`(`grammar-coverage` script 追加のみ)。`src/engine/` 既存ファイル / `src/data/` / `src/store/` / `src/components/` / `review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` は変更しない。
- reviewer 専有テスト `review.grammar-coverage`(`src/engine/__tests__/`)は Fable が先に書く。Codex は触らない。機械チェック4点全通過 + `npm run grammar-coverage` が 17,491枚で完走し §29.5 の累積カバレッジ曲線を出力すること。

## 30. エンジン文法器トラック Phase G1: 能力IR型 + targetless パーサ(`src/engine/grammar/ir.ts` + `rule-refs.ts` + `scripts/grammar-ir.ts`)— この節も契約である

### 30.0 目的と分界(重要)
G0(§29)は能力の**分類と計測**のみ。G1 は G2(インタプリタ+全自動実行)が消費する **能力IR(中間表現)の型と、それを生成する targetless パーサ**を確立する。北極星=**「対象/モードを要さない効果行のうち、何%を完全な IR(`status==='full'`)へ表現できるか」を定量化**し、G0「自動化可能フロンティア」(上位20で60.8%/全34で69.4%)を「実際に構造化できた行率」として裏付ける。

**G1 も計測・表現専用**。IR→コマンド列のコンパイル・実行・`applyCommand` 連携・対象/モード誘導・`effectsAuto`・ストア/UI 配線は **G2 以降**。本節では IR を**生成するだけ**(実行しない)。統治原則は §29.0 を継承(probe は人間裁定用の広網候補、正本ゲートはコーパス回帰 + `review.grammar-ir`)。

### 30.1 新規モジュール `src/engine/grammar/ir.ts`(純関数・計測/表現専用)
GameState に一切触れない純粋・決定的関数群。§29 の公開関数(`splitAbilityLines` / `classifyAbilityShape` / `detectEffectAtoms` / `detectConstructs`)と `EFFECT_ATOM_DEFINITIONS` を**再利用**する(index.ts 内部は export を増やさず ir.ts 側で必要分を独立導出)。正本は英語 `oracleText`。

公開関数(シグネチャは契約):
- `parseAbilityIR(line: string, typeLine: string): AbilityIR` — 1能力行を IR へ分解。

型:
```ts
type CountSpec =
  | { kind: 'one' }                  // "draw a card" / "a"/"an"
  | { kind: 'fixed'; value: number } // "draw two cards" / 数字
  | { kind: 'variable-x' }           // {X} / X
  | { kind: 'for-each' }             // "for each ..."
  | { kind: 'unknown' };
interface EffectClause {
  atom: EffectAtomId;      // §29.3 の安定 id
  ruleRef: string;         // 対応 CR id(§30.3・rule-refs.ts で妥当性検証)
  count: CountSpec;
  optional: boolean;       // "you may" 配下
  raw: string;             // 該当クローズ(sanitize 済み verbatim)
}
interface AbilityCost {    // shape==='activated' のみ非null
  raw: string;             // コロン左辺 verbatim
  mana: string | null;     // 例 "{2}{U}"(無ければ null)
  tap: boolean;            // 左辺に {T}
  sacrificesSelf: boolean; // 左辺が "Sacrifice <this/self>"
}
interface TriggerCondition { // shape∈{triggered,delayed-triggered} のみ非null
  word: 'when' | 'whenever' | 'at';
  raw: string;             // 最初のカンマ前の条件文(CR 603.1)
}
type ParseStatus = 'full' | 'partial' | 'none';
interface AbilityIR {
  shape: AbilityShape;          // classifyAbilityShape を流用
  cost: AbilityCost | null;
  trigger: TriggerCondition | null;
  effects: EffectClause[];
  constructs: ConstructId[];    // 効果スパン上の壁(detectConstructs 流用・昇順)
  status: ParseStatus;
  blockers: string[];           // full でない理由(昇順・重複なし)
}
```

### 30.2 分解ロジックと `status` 判定(決定的)
- **shape**: `classifyAbilityShape(line, typeLine)`。
- **cost**(activated のみ): 最初の `:` 左辺を `AbilityCost` へ。`{...}` 連結を `mana`(`{T}` は mana から除外し `tap=true`)、`^Sacrifice\b.*\b(this|it|self|<同名>)` 様を `sacrificesSelf=true`。index.ts の `isCostLikeActivatedPrefix` 相当は ir.ts で独立再導出する(index.ts 内部 export を増やさない)。
- **trigger**(triggered/delayed のみ): 先頭語(`when`/`whenever`/`at`)+ **最初のカンマ前**を `TriggerCondition.raw` へ。CR 603.1a の対象制限/打ち消し不可指示は条件に含めない。
- **効果スパン** = 行から cost(コロン右辺へ)/trigger(最初のカンマ後へ)を除いた残り。`. ` と `then`/`and then` でクローズへ分割し、各クローズに `detectEffectAtoms` を適用(1クローズ複数 atom 可)。`count` は数詞マップ(`a`/`an`→one、`two`〜`ten`/数字→fixed、`{X}`/`\bX\b`→variable-x、`for each`→for-each、不明→unknown)。`optional` は行内 `you may`(construct.may)で近似。`constructs` は効果スパンに対する `detectConstructs`。
- **`status`**:
  - `full` = `effects.length >= 1` **かつ** 全クローズの atom が既知 **かつ** `constructs` に `construct.target` も `construct.choose-modal` も**含まない**。= 対象もモードも要らず既知アトムだけで完結。
  - `partial` = atom を1つ以上検出したが上記いずれかを満たさない(target/choose-modal の壁、または atom 化できない残余文がある)。
  - `none` = atom を1つも検出できない(keyword/空行を含む)。
- **`blockers`**(full 以外で非空・昇順): `construct.target` / `construct.choose-modal`(壁構文)・`unknown-atom`(atom 不在の効果残余あり)・`no-atom`(status none)。

### 30.3 効果アトムの `ruleRef` 錨付け(正本)
`EFFECT_ATOM_DEFINITIONS`(index.ts)各要素に `ruleRef: string` を**加算追加**(probe/id/関数は不変)。正本マッピング:

| atom | ruleRef | 根拠 |
|---|---|---|
| effect.create-token | 701.7 | Create |
| effect.destroy | 701.8 | Destroy |
| effect.exile | 701.13 | Exile |
| effect.sacrifice | 701.21 | Sacrifice |
| effect.scry | 701.22 | Scry |
| effect.surveil | 701.25 | Surveil |
| effect.mill | 701.17 | Mill |
| effect.discard | 701.9 | Discard |
| effect.search | 701.23 | Search |
| effect.reveal | 701.20 | Reveal |
| effect.tap | 701.26 | Tap and Untap |
| effect.untap | 701.26 | Tap and Untap |
| effect.attach | 701.3 | Attach |
| effect.transform | 701.27 | Transform |
| effect.counter-spell | 701.6 | Counter |
| effect.draw | 121 | Drawing a Card |
| effect.gain-life | 119 | Life |
| effect.lose-life | 119 | Life |
| effect.damage | 120 | Damage |
| effect.counter-plus | 122 | Counters |
| effect.poison | 122 | Counters(poison) |
| effect.energy | 122 | Counters(energy) |
| effect.experience | 122 | Counters(experience) |
| effect.loyalty | 122 | Counters(loyalty) |
| effect.add-mana | 106 | Mana |
| effect.grant-keyword | 702 | Keyword Abilities |
| effect.copy | 707 | Copying Objects |
| effect.return / effect.pump / effect.restriction / effect.put-onto-battlefield / effect.treasure / effect.gain-control / effect.extra-turn | standard | 標準英語動詞(701 keyword action ではない・[[comprehensive-rules-reference]]) |

`ruleRef` の形式: `701.<n>`(2≤n≤69)/ `106`/`119`/`120`/`121`/`122`/`123`/`702`/`707` / `standard`。

### 30.4 CR ground-truth(`src/engine/grammar/rule-refs.ts`)
`rule/Magic_The_Gathering_Comprehensive_Rules.txt` を**1回機械パース**(`^701\.\d+\.\s+<Name>`)して CR §701 keyword-action の id/名称(701.2–701.69)を抽出し、§118–123 の id と併せて**コミット済み定数**として持つ。`rule/` txt は test/script の**実行時依存にしない**(ローカル参照のまま・コミットしない)。
- `CR_KEYWORD_ACTIONS: ReadonlyArray<{ id: string; name: string }>` — 701.2–701.69。
- `isValidRuleRef(ref: string): boolean` — `701.*`(既知 id)/ `106`/`119`/`120`/`121`/`122`/`123`/`702`/`707` / `standard` を許容。
- レポート・review は「全 atom.ruleRef が `isValidRuleRef`」「atom 未割当の CR §701 action(語彙ギャップ)」を機械検証する。

### 30.5 出力レポート(`research/grammar-ir/report.md` + `report.json`)
`scripts/grammar-ir.ts`(`npm run grammar-ir`、tsx)。`grammar-coverage.ts` の骨格(`mapScryfallCardToCardDef` 写像・集計・Markdown描画・サイズ有界 top-N・`report.json` 併出力)を踏襲。冒頭に「未調整(候補分布)」を明記。節:
1. **総数**: raw / 写像成功・失敗 / 効果保有行数(G0 と接続)。
2. **parse status 分布**: full/partial/none の行数・割合。
3. **IR 表現フロンティア(主成果)**: `full` 率を全体 + shape 別。G0 の自動化フロンティア(60.8%/69.4%)を sanity アンカーとして併記。
4. **ruleRef 検証**: (a)無効 ruleRef を持つ atom(あれば)、(b)atom 未割当の CR §701 keyword-action(語彙ギャップ top-N)。
5. **blocker 分布**: full でない理由(target / choose-modal / unknown-atom / no-atom)の出現率。
6. **裁定候補**: partial/none の代表行 top-N(§26.0 流の人間裁定リスト)。

### 30.6 裏取り(確定前必須・§29.6 流)
probe/数詞/cost 抽出を確定する前に snapshot 実カード文言で点検し `review.grammar-ir` に固定:
- `Draw two cards.` → status `full` / effect.draw / count `fixed`(2) / optional false。
- `Destroy target creature.` → `partial` / blockers に `construct.target`。
- `Choose one — Draw a card; or You gain 3 life.` → `partial` / blockers に `construct.choose-modal`。
- `{2}{U}, {T}: Draw a card.` → shape `activated` / cost.mana `{2}{U}` / cost.tap true / 効果 draw が full 相当(status full)。
- `When this creature enters, draw a card.` → `triggered` / trigger.word `when` / trigger.raw に `this creature enters` / 効果 draw / status full。
- `At the beginning of the next end step, sacrifice it.` → `delayed-triggered`。
- `You may draw a card.` → effect.draw / optional true。
- ruleRef: 全 atom.ruleRef が `isValidRuleRef`。`effect.draw`→`121`、`effect.create-token`→`701.7`。

### 30.7 不変・非干渉(エンジン不変)
- **計測/表現専用**: GameState を生成・変更しない。`applyCommand`/コマンド/ストアに触れない。**I1〜I7 影響なし**・snapshot 互換不変。
- `src/engine/grammar/*` は純粋・決定的(同入力→同出力・入力非破壊)。`src/engine/` 既存公開挙動は**差分ゼロ**。index.ts は `EFFECT_ATOM_DEFINITIONS` への `ruleRef` 加算のみ可(probe/id/関数・既存 export の改変不可)。G0 の `review.grammar-coverage` が引き続き全通過すること。
- 実装の変更対象は **新規** `src/engine/grammar/ir.ts` / `src/engine/grammar/rule-refs.ts` / `scripts/grammar-ir.ts` / `research/grammar-ir/*`(生成物)/ `package.json`(`grammar-ir` script 追加のみ)+ index.ts への `ruleRef` 加算。`src/data/` / `src/store/` / `src/components/` / `review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` / `rule/` txt のコミット / git 操作は禁止。
- reviewer 専有テスト `review.grammar-ir`(`src/engine/__tests__/`)は Fable が先に書く。Codex は触らない。機械チェック4点全通過 + `npm run grammar-ir` が 17,491枚で完走し §30.5 の IR 表現フロンティアを出力すること。

## 31. エンジン文法器トラック Phase G2: インタプリタ + 全自動実行 — この節も契約である

### 31.0 目的と分界(重要)
G0(§29)/ G1(§30)は **計測・表現専用**(GameState 不変)。G2 で初めて **能力IR を `GameCommand[]` にコンパイルし、解決時に実際に盤面を変える**。確定方針「効果は基本全自動・誤りは undo・カード毎 OFF」([[engine-grammar-track]])の本体。

**通し計測指標 = executable frontier**: G1 の `status:'full'`(対象/モード不要で構造化できた行)のうち、**プレイヤー選択なしで安全に自動実行できる行率**(`decision:'auto'`)。G1 の 58.11% を上限 sanity アンカーとし、G2 はその部分集合になる(=妥当)。

**分界(エンジン不変性の核)**:
- **コンパイラ(§31.1)は純関数**。GameState に触れない。G0/G1 と同じ純粋・決定的規律。
- **実行は既存の `applyCommand` 経路のみ**(§31.4)。`applyResolveStackTop` がコンパイル済みコマンドを同一 draft に畳み込む。新たな副作用経路は作らない。
- 完全ルールエンジン(優先権・自動スタック解決・レイヤー)は**依然スコープ外**。G2 は「解決が起きた能力の効果本文を、選択不要なものだけ自動実行」する。

統治原則は §29.0 / §30.0 を継承。第1スライスは **targetless full のグローバル(プレイヤー対象)アトムのみ** auto 化する(下表)。

### 31.1 新規モジュール `src/engine/grammar/compile.ts`(純関数・GameState 非依存)
G1 の `AbilityIR`(§30.1)を入力に、既存 `GameCommand`(§commands.ts)列へコンパイルする純粋・決定的関数。GameState を生成・変更しない(`def`/`sourceId` は読み取りのみ)。

公開関数(シグネチャは契約):
- `compileAbilityIR(ir: AbilityIR, ctx: CompileContext): CompiledEffect`

型:
```ts
interface CompileContext {
  sourceId: string;   // 能力の発生源 CardInstance.id(自己参照コマンドに使用)
  def: CardDef;       // 発生源 def(トークン名/型など。第1スライスでは未使用でも受ける)
}
type AutoDecision = 'auto' | 'manual';
type RiskLevel = 'low' | 'medium' | 'high';
interface CompiledEffect {
  commands: GameCommand[];   // 全クローズのコマンド連結(manual でも best-effort 候補を返す)
  decision: AutoDecision;    // auto = 自動実行ゲートを通す唯一の条件
  confidence: number;        // 0..1(報告用。ゲートは decision が権威)
  risk: RiskLevel;           // 報告用。第1スライスは auto⟺low
  reasons: string[];         // manual 化/ゲートの理由 id(昇順・重複なし)
}
```

### 31.2 auto / manual ゲート規則(決定的)
`compileAbilityIR` は IR の各 `EffectClause` を評価する。

**auto 対象アトム(第1スライス・グローバル/プレイヤー対象・対象選択も占術等の選択も不要)**:

| atom | command | 備考 |
|---|---|---|
| effect.draw | `{type:'draw', count:n}` | count one→1 / fixed→n |
| effect.gain-life | `{type:'adjustLife', delta:+n}` | |
| effect.lose-life | `{type:'adjustLife', delta:-n}` | "you lose n life" |
| effect.mill | `{type:'mill', count:n}` | |
| effect.poison | `{type:'adjustPlayerCounter', kind:'poison', delta:+n}` | |
| effect.energy | `{type:'adjustPlayerCounter', kind:'energy', delta:+n}` | |
| effect.experience | `{type:'adjustPlayerCounter', kind:'experience', delta:+n}` | |
| effect.add-mana | `{type:'addMana', color, amount:n}` | **単色が確定**できる時のみ。`any color`/複数色は manual(reason `ambiguous-mana`) |
| effect.treasure | `{type:'createToken', tokenKind:'treasure', name:'宝物', typeLine:'Artifact — Treasure', quantity:n}` | |

**count ゲート**: count 駆動アトム(draw / gain-life / lose-life / mill / poison / energy / experience / treasure)は `count` が `one`/`fixed` 以外(`variable-x`/`for-each`/`unknown`)なら **manual**(reason `variable-count`)。`fixed`/`one` の値を上表の `n` に解決(one→1)。**add-mana は count ゲート対象外**(数量はクローズ内のマナ記号数から導出。`amount` = 当該単色記号の出現数)。

**optional ゲート**: クローズが `optional:true`(you may)なら **manual**(reason `optional`)。「やる/やらない」はプレイヤーの選択。

**manual 対象アトム(自動実行しない・`commands` は best-effort 候補可)**:
- reason `needs-target`: tap / untap / destroy / exile / sacrifice / return / attach / pump / counter-plus / grant-keyword / restriction / put-onto-battlefield / gain-control / transform / copy / counter-spell / damage
- reason `needs-choice`: scry / surveil / search / reveal / discard
- reason `no-command`: extra-turn
- reason `needs-parse`: create-token(treasure 以外。トークン spec パースは後続スライス)

**複数クローズ**: `commands` は全クローズの best-effort コマンドを順に連結。`decision` は **全クローズが auto の時のみ `auto`**(1つでも manual なら全体 manual。部分自動実行は危険)。`reasons` は全クローズの理由を昇順・重複なしで統合。`effects.length===0`(status none/keyword)は `decision:'manual'` / reasons `no-effect`。

**confidence / risk**(報告用): auto クローズのみで構成され count 確定なら `confidence>=0.9` / `risk:'low'`。manual を含む場合 `confidence<0.9` / `risk:'medium'` 以上。ゲートの権威は `decision` であり confidence/risk は実行判断に使わない。

### 31.3 GameState 拡張(自動実行のスイッチ)
- `GameState.effectsAuto: boolean` を追加(**default `true`**=北極星準拠。発火は `decision:'auto'` のみなので保守ゲートでリスク限定)。`initGame`(§init.ts)で `true` 初期化。
- `CardInstance.effectsAuto?: boolean`(**optional**・`undefined`=グローバル継承)= **カード毎 OFF**。
- **snapshot 前方互換必須**([[snapshot-forward-compat]]): `restoreGame`(store)で旧 snapshot に `effectsAuto` 欠落時 **`true` 補完**。`CardInstance.effectsAuto` は optional なので補完不要。`CACHE_SCHEMA_VERSION` は変更しない。
- 切替コマンド(undo 履歴に乗せるため applyCommand 経由):
  - `{ type:'setEffectsAuto', value: boolean }` — グローバル切替。
  - `{ type:'setCardEffectsAuto', cardId: string, value: boolean }` — カード毎切替(`CardInstance.effectsAuto` を設定)。

### 31.4 解決時実行フック(`applyResolveStackTop`・既存挙動の上に加算)
解決される能力の効果本文を特定して自動実行する。

**(1) 能力行の特定**(正本 = `splitAbilityLines(def)`(§29)のインデックス): `CardInstance` に **optional** `abilityLineIndex?: number` を追加(snapshot 安全)。`{type:'addAbilityToStack'}` コマンドに **optional** `abilityLineIndex?` を加え、`createAbilityObject` に伝播。
- 解決対象が ability(`isAbility`)かつ `abilityLineIndex` が定義 → `splitAbilityLines(def)[abilityLineIndex]` を効果本文行とする。typeLine は `def.faces[line.faceIndex].typeLine ?? def.typeLine`。範囲外インデックスは自動実行しない。
- 解決対象が spell(instant/sorcery 本体)→ `splitAbilityLines(def)` のうち `shape==='spell'` の各行を効果本文候補とする。
- `abilityLineIndex` が `undefined` の能力・上記以外 → **自動実行しない**(現状挙動を完全維持)。

**(2) ゲート**: `state.effectsAuto === true` **かつ** 発生源 `CardInstance.effectsAuto !== false`(カード毎 OFF でない)の時のみ評価。

**(3) コンパイル&適用**: 各効果本文行を `parseAbilityIR`(§30)→ `compileAbilityIR`(§31.1)。`decision==='auto'` の行のみ、その `commands` を **同一 draft の state に対し既存 `applyCommands` で畳み込む**(warnings / log seq を統合)。`decision==='manual'` の行は何もしない(現状挙動=ability 削除 / カード移動のみ)。自動実行した行はログに明示(例:「《○○》の効果を自動実行した。」)。

**注**: コンパイル&畳み込みは `applyResolveStackTop` 内に閉じる。`compileAbilityIR` は純関数で副作用がないため commands.ts から安全に呼べる。

### 31.5 計測レポート(`research/grammar-compile/report.md` + `report.json`)
`scripts/grammar-compile.ts`(`npm run grammar-compile`、tsx)。`grammar-ir.ts` の骨格(`mapScryfallCardToCardDef` 写像・集計・Markdown+JSON 併出力・サイズ有界 top-N)を踏襲。冒頭に「未調整(候補分布)」を明記。節:
1. **総数**: raw / 写像成功・失敗 / G1 の full 行数を母数に接続。
2. **executable frontier(主成果)**: full のうち `decision:'auto'` 率を全体 + shape 別。G1 の 58.11% を sanity アンカーに併記(G2 は部分集合=下回るのが妥当)。
3. **atom 別内訳**: auto/manual の atom 別件数 + reasons 分布(needs-target / needs-choice / no-command / needs-parse / variable-count / optional / ambiguous-mana)。
4. **自動実行候補 top-N**: auto と判定された代表行(§26.0 流の人間裁定リスト)。

### 31.6 裏取り(確定前必須・§29.6 / §30.6 流)
snapshot 実カード文言で点検し `review.grammar-compile` / `review.g2-exec` に固定:
- `Draw two cards.` → `decision:'auto'` / `commands:[{type:'draw',count:2}]`。
- `You gain 3 life.` → auto / `[{type:'adjustLife',delta:3}]`。
- `You lose 2 life.` → auto / `[{type:'adjustLife',delta:-2}]`。
- `Scry 2.` → **manual**(full だが reason `needs-choice`)。
- `Destroy target creature.` → manual(reason `needs-target`)。
- `Draw X cards.` → manual(reason `variable-count`)。
- `You may draw a card.` → manual(reason `optional`)。
- **実行(§31.4)**: `abilityLineIndex` 付き ability が「Draw two cards.」相当の def で解決 → 手札+2。`effectsAuto:false`(または当該カード OFF)→ ability 削除のみで他の状態は解決前と差分ゼロ。`abilityLineIndex` 無し → 従来挙動。
- **snapshot**: `effectsAuto` 欠落の旧 snapshot を `restoreGame` してクラッシュせず `true` 補完。

### 31.7 不変・非干渉(エンジン不変)+ 新不変条件 I8
- **コンパイラ**(`src/engine/grammar/compile.ts`)は純粋・決定的・GameState 非依存(同入力→同出力・入力非破壊)。
- **新不変条件 I8(effectsAuto 保存と OFF 時の差分ゼロ)**:
  - `effectsAuto`(グローバル/カード毎)は `setEffectsAuto`/`setCardEffectsAuto` 以外のコマンドで不変。
  - `state.effectsAuto===false` の時、`resolveStackTop` の結果状態は **G2 導入前と完全一致**(自動実行による追加変化ゼロ)。
  - 自動実行は **`decision:'auto'` の行のみ**を `applyCommands` 経由で適用する(新たな副作用経路を作らない)。I1〜I7 は既存コマンド経由のため維持される。
- 既存の `review.grammar-coverage` / `review.grammar-ir` / `review.properties`(I1〜I7)が引き続き全通過すること。
- 実装の変更対象: **新規** `src/engine/grammar/compile.ts` / `scripts/grammar-compile.ts` / `research/grammar-compile/*`(生成物)/ `src/engine/types.ts`(`effectsAuto`・`abilityLineIndex`)/ `src/engine/commands.ts`(新コマンド2種・`addAbilityToStack` 引数・`applyResolveStackTop` フック)/ `src/engine/init.ts`(初期 `effectsAuto`)/ `src/store/gameStore.ts`(`restoreGame` 補完・切替 action・能力起動/誘発時の `abilityLineIndex` 伝播)/ `src/components/*` ・ `src/App.tsx`(トグル・右クリック OFF・`data-testid`)/ `package.json`(`grammar-compile` script 追加)。`review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` / `rule/` txt のコミット / git 操作は禁止。
- reviewer 専有テスト `review.grammar-compile` / `review.g2-exec`(`src/engine/__tests__/`)は Fable が先に書く。Codex は触らない。機械チェック4点全通過 + `npm run grammar-compile` が 17,491枚で完走し §31.5 の executable frontier を出力すること。

## 32. エンジン文法器トラック Phase G3: 対象/モード誘導フロー(`compile.ts` guided ティア + ストア誘導 + `ModalChoiceDialog`)— この節も契約である

### 32.0 目的と分界(重要)
G2(§31)は「プレイヤー選択が不要な行」だけを `decision:'auto'` で自動実行した(executable frontier 14.18%)。G3 は **`needs-target` / `needs-choice`(scry/surveil) / `choose-modal` の3つの壁を「1回の対話(誘導 UI)」で解消**し、新ティア **`decision:'guided'`** を追加する。guided 行は解決時に既存ダイアログで対象/モードを集め、既存 `applyCommand` 経路でコマンド化して適用する。北極星=**guided frontier**(auto + guided がカバーする効果行率)を 14% から押し上げる([[engine-grammar-track]])。

**分界(エンジン不変性の核・§29.0/§30.0/§31.0 を継承)**:
- **コンパイラ(`compile.ts`)・`parseAbilityIR`(`ir.ts`)・`splitAbilityLines`(`index.ts`)は純粋・決定的・GameState 非依存のまま**。盤面に依存する「適格対象の列挙」はストア層が担う。コンパイラは「どんな入力が要るか(`EffectPrompt`)」と「答え→コマンド(`buildGuidedCommands`)」の純写像だけを担う。
- **実行は既存 `applyCommand` 経路のみ**。guided は非同期(ユーザー入力)なので `applyResolveStackTop` 内では発火しない。**ストアが解決前に pending guided を検出 → ダイアログで入力収集 → 「効果コマンド列 + `resolveStackTop`」を1回の `applyCommands` で適用**(undo 1ステップ)。新たな副作用経路を作らない。
- 完全ルールエンジン(優先権・自動スタック解決・レイヤー)は**依然スコープ外**。
- `effectsAuto`(グローバル/カード毎)**OFF 時は guided も発火しない**(=従来の手動挙動。I8 の OFF 差分ゼロを維持)。guided は必ずユーザー入力ダイアログ経由でのみコマンドを生む(無入力で盤面を変えない)。

### 32.1 スコープ(今スライス = G3 完成形)
**A. 誘導対象アトム**(既存コマンドへ単一 cardId で清く写る7アトムのみ guided 化):

| atom | 写像コマンド |
|---|---|
| effect.destroy | `{type:'moveCard', cardId, to:'graveyard', position:'bottom'}` |
| effect.exile | `{type:'moveCard', cardId, to:'exile', position:'bottom'}` |
| effect.return | `{type:'moveCard', cardId, to:'hand', position:'bottom'}` |
| effect.sacrifice | `{type:'moveCard', cardId, to:'graveyard', position:'bottom'}` |
| effect.tap | `{type:'setTapped', cardId, tapped:true}` |
| effect.untap | `{type:'setTapped', cardId, tapped:false}` |
| effect.counter-plus | `{type:'addCounters', cardId, counterType:'+1/+1', delta:n}`(n=count one→1/fixed) |

- **単一対象のみ**: クローズ raw が `\btarget\b` を含み、かつ **複数対象/up-to 印**(`up to`、`two|three|… target`、`each target`、`any number of target`、`target ... or ...`(対象同士の or は別。型の or は可))を含まないこと。複数/up-to/`for each` は **manual 据え置き**(reason `needs-target` 維持)。
- **target フィルタ**: `target` 直後の名詞句から型を抽出して `TargetFilter.types` に格納(`creature`/`artifact`/`enchantment`/`land`/`planeswalker`/`permanent`。`artifact or enchantment`・`creature or planeswalker` 等の `X or Y` は両型)。修飾語(`with flying`/`tapped`/`nonblack`/`with power 3 or greater` 等)は best-effort で無視し型のみで列挙(サンドボックス哲学=合法性はユーザー裁定)。`target player`/`target opponent`(プレイヤー対象)は **manual 据え置き**(盤面パーマネント以外は今回非対応)。
- **effect.return のゾーンゲート**: raw が `to (?:its owner's|their|your|the owner's) hand` を含む時のみ guided(→hand)。`return ... to the battlefield`(リアニメイト)等は **manual 据え置き**(ゾーンが異なる)。

**B. 誘導選択アトム**: effect.scry / effect.surveil → `EffectPrompt{kind:'scry-surveil', count}`(count は `effect.count` の one→1/fixed)。既存 `ArrangeTopDialog`(`arrangeTop` コマンド)を解決フローから開く。

**C. モード選択(choose-modal)**:
- **コア改修**: `splitAbilityLines`(§29)で **`•`(U+2022)始まりの段落を直前の非bullet段落へ結合**し、modal を1論理行へ再結合する(現状 `splitParagraphs` が `\n` 毎に割るため別行に分裂している)。`•` 以外の箇条記号(kicker の `+` 等)は結合しない。結合の連結文字は不問(後段 `sanitizeLine` が空白化するため bullet `•` だけが残ればよい)。**これにより G0/G1/G2 の行数メトリクスは再ベースラインされる**(reviewer メトリクステストの期待値は Fable が更新。実装は触らない)。
- `parseAbilityIR` は再結合行(sanitize 後 `… • … • …`)で modal を解析し `AbilityIR.modal?` を populate(**IR 追加・additive・既存挙動非破壊**):**`•` でモード分割**(先頭 `•` 前のヘッダから min/max を解析)。modal を検出したら通常の `splitEffectClauses` による効果は **compile 側で無視**(ir.modal を優先)。
- 各モードは選択後に **ストアが `parseAbilityIR`→`compileAbilityIR` で再帰コンパイル**(auto は自動、guided は対象/scry ダイアログへ連鎖)。

**据え置き(honest な manual。コマンド不在/曖昧)**: damage(対パーマネント markDamage コマンド不在)/ pump / grant-keyword / gain-control / copy / transform / discard-choice / search / reveal / put-onto-battlefield / attach / restriction / counter-spell / extra-turn / X・variable-count / for-each / each-player / intervening-if / you-control。reason を維持。

### 32.2 `compile.ts` 型拡張(契約)
```ts
type AutoDecision = 'auto' | 'guided' | 'manual';   // 'guided' 追加。ゲート: auto=即時実行 / guided=要入力 / manual=skip

type PromptKind = 'target' | 'scry-surveil' | 'modal';
interface TargetFilter {
  types?: string[];                  // 'creature'|'artifact'|'enchantment'|'land'|'planeswalker'|'permanent'
  controller?: 'any' | 'you' | 'opponent';  // sacrifice/「you control」は 'you'、既定 'any'
}
interface ModalOption { index: number; raw: string; }   // raw = bullet 本文(先頭 '•' 除去・trim)
interface EffectPrompt {
  atom: EffectAtomId | null;         // modal は null
  kind: PromptKind;
  count: number;                     // target:対象数(=1) / scry-surveil:枚数 / modal:最大選択数
  minCount?: number;                 // modal の最小選択数(既定 = count)
  filter?: TargetFilter;             // kind:'target' のみ
  options?: ModalOption[];           // kind:'modal' のみ
  raw: string;                       // 由来クローズ/行 raw(UI 表示・デバッグ用)
}
interface CompiledEffect {
  commands: GameCommand[];
  decision: AutoDecision;
  prompts: EffectPrompt[];           // 新規。auto/manual は []。guided は1件以上(順序維持)
  confidence: number;
  risk: RiskLevel;
  reasons: string[];
}
```
- `IR` 追加(`ir.ts`):`AbilityIR.modal?: { options: ModalOption[]; min: number; max: number }`。`parseAbilityIR` が再結合 modal 行から populate(なければ `undefined`)。
- ヘッダ→min/max: `Choose one —`→(1,1) / `Choose two`→(2,2) / `Choose three`→(3,3) / `Choose one or both`→(1, options数) / `Choose one or more`→(1, options数) / `Choose up to one|two|three`→(0, N) / `Choose any number`→(0, options数)。認識できない場合は modal を立てず manual。

### 32.3 auto/guided/manual ゲート(決定的・§31.2 を拡張)
- **トップレベル**: `construct.target` / `construct.choose-modal` を **無条件 manual 化していた旧ロジックを撤廃**し、以下の per-clause / modal 判定に置換する。
- **modal 優先**: `ir.modal` が存在 → `decision:'guided'`、`commands:[]`、`prompts:[{kind:'modal', atom:null, count:max, minCount:min, options}]`(モード内アトムはトップレベルでは実行しない=ストアが選択後に再帰コンパイル)。
- **per-clause 評価**(modal でない時):各 `EffectClause` を次のいずれかに分類:
  - **auto**(§31.2 の count駆動/add-mana/treasure)→ commands 生成。
  - **guided-target**: atom ∈ {destroy,exile,return,sacrifice,tap,untap,counter-plus} かつ §32.1A の単一対象条件成立 → `prompts.push({kind:'target', atom, count:1, filter})`。commands は空(対象未確定ゆえ)。
  - **guided-choice**: atom ∈ {scry,surveil} → `prompts.push({kind:'scry-surveil', atom, count})`。
  - それ以外 → 既存 manual reason(`needs-target`/`needs-choice`/`needs-parse`/`no-command`/`variable-count`/`optional`/`ambiguous-mana`)。
- **クローズ統合**: 全クローズ auto → `auto`。1つでも純 manual(guided でも auto でもない) → `manual`(部分実行はしない)。それ以外(全クローズが auto|guided かつ guided ≥1) → `guided`。`prompts` は guided クローズ分を**クローズ順**に連結。`reasons` は manual クローズの理由を昇順・重複なし。
- **confidence/risk**(報告用):auto=`>=0.9`/`low`、guided=`0.6..0.9`/`medium`、manual=`<0.6`/`medium|high`。ゲートの権威は `decision`。

### 32.4 純粋ビルダ `buildGuidedCommands`(契約・GameState 非依存)
```ts
type GuidedAnswer =
  | { kind: 'target'; cardIds: string[] }
  | { kind: 'scry-surveil'; topOrder: string[]; toBottom: string[]; toGraveyard: string[] }
  | { kind: 'modal'; chosen: number[] };   // 選ばれた ModalOption.index 昇順
function buildGuidedCommands(prompt: EffectPrompt, answer: GuidedAnswer, ctx: CompileContext): GameCommand[];
```
- `kind:'target'`: 各 cardId に §32.1A の写像コマンドを生成(prompt.atom で分岐)。空配列なら []。
- `kind:'scry-surveil'`: `[{type:'arrangeTop', topOrder, toBottom, toGraveyard}]`。
- `kind:'modal'`: **[] を返す**(選択モードの再コンパイルはストアが回す。ビルダは純度のため空)。
- 純粋・決定的・入力非破壊(同入力→同出力)。

### 32.5 ストア解決フロー(`gameStore.ts`・オーケストレーション / `commands.ts` は純関数のまま)
- 純ヘルパ(commands.ts or grammar)`guidedPlanForStackTop(state): { sourceId: string; prompts: EffectPrompt[] } | null` — §31.4 と同じ経路で解決対象の効果行を特定 → `parseAbilityIR`→`compileAbilityIR`。`decision:'guided'` なら全効果行の prompts を順に連結して返す。`effectsAuto` OFF(グローバル/カード)時は `null`(誘導しない=従来 manual)。
- ストア `resolveTop` は解決前に `guidedPlanForStackTop` を確認。非 null なら `resolveStackTop` を即発行せず **pending guided state(prompt キュー)** に入る。`Playmat` が先頭 prompt の `kind` でダイアログを開く:
  - `target`: ストアが `eligibleTargets(state, filter)`(盤面の適格 cardId 列挙)→ `TargetPickerDialog`。
  - `scry-surveil`: `ArrangeTopDialog`。
  - `modal`: `ModalChoiceDialog`(新規)。modal 確定後、選択された各 `ModalOption.raw` を `parseAbilityIR`→`compileAbilityIR` し、その prompts を **キュー先頭へ展開**(モード→対象の連鎖)、auto コマンドは蓄積。
- 各 prompt の答えを `buildGuidedCommands`(modal は再帰コンパイル結果)で蓄積。キューが尽きたら **蓄積コマンド列 + `{type:'resolveStackTop'}` を1回の `applyCommands`** で適用。ログに「《○○》の効果を誘導実行した。」を明示。
- **キャンセル/対象なし**: 当該 prompt をスキップ(効果未適用)。全キャンセルでも最後に `resolveStackTop` のみ適用(従来 manual と同一=能力削除/カード移動のみ)。
- guided 状態は **ストアのトランジェント UI 状態**(GameState 外・snapshot 非対象)。undo は適用済みバッチ単位。

### 32.6 計測(`scripts/grammar-compile.ts` 拡張 + `research/grammar-compile/report.*`)
- **guided 行は `status:'partial'`**(construct.target/choose-modal を持つ)ため、現行スクリプトの `if (ir.status !== 'full') continue;` を撤廃し、**全効果保有行(effectLineCount)で decision を集計**する。
- 新指標:
  - **executable frontier**(継続)= `auto / effectLineCount`(旧 full 基準 14.18% との関係を注記)。
  - **guided frontier**(主成果)= `(auto + guided) / effectLineCount`。全体 + shape 別 + prompt.kind 別(target/scry-surveil/modal)内訳。
- レポート冒頭に「未調整(候補分布)」「分母を full→effect 行へ変更(G3 再ベースライン)」を明記。

### 32.7 不変・非干渉(エンジン不変)
- コンパイラ・`parseAbilityIR`・`splitAbilityLines`・`buildGuidedCommands`・`guidedPlanForStackTop`/`eligibleTargets`(後者2つは state 読み取りのみ・非破壊) は決定的・入力非破壊。
- **I8 維持**: `effectsAuto` OFF 時は guided も発火せず解決前差分ゼロ。guided は必ずダイアログ確定→`applyCommands` 経由でのみ盤面を変える(新副作用経路なし)。
- I1〜I7 は既存コマンド経由ゆえ維持。
- **変更対象**: `src/engine/grammar/compile.ts`(guided ティア・`EffectPrompt`/`buildGuidedCommands`・ゲート置換)/ `src/engine/grammar/ir.ts`(`AbilityIR.modal` + 解析)/ `src/engine/grammar/index.ts`(`splitAbilityLines` の modal 段落結合)/ `src/engine/commands.ts` or grammar(`guidedPlanForStackTop`・`eligibleTargets` 純ヘルパ。**新 GameCommand は不要**)/ `src/store/gameStore.ts`(pending guided キュー・確定/キャンセル action・modal 再帰)/ `src/components/playmat/Playmat.tsx`(解決フロー合流・ダイアログ配線・`data-testid`)/ `src/components/playmat/ModalChoiceDialog`(新規・`AttackDialog` 流用)/ `scripts/grammar-compile.ts`(guided 集計)/ `research/grammar-compile/*`(生成物)。`commands.ts`/`types.ts` に**新コマンド型は追加しない**(既存コマンドへ写すのが G3 の肝)。`review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` / `rule/` txt のコミット / git 操作は禁止。
- reviewer 専有テスト `review.grammar-guided` / `review.g3-flow`(`src/engine/__tests__/`)は Fable が先に書く。Codex は触らない。既存 `review.grammar-coverage` / `review.grammar-ir` / `review.grammar-compile` / `review.g2-exec` / `review.properties`(I1〜I7)は再ベースラインで期待値が変わる分を **Fable が更新**(実装は触らない)。機械チェック4点全通過 + `npm run grammar-compile` が 17,491枚で完走し §32.6 の guided frontier を出力すること。

## 33. エンジン文法器トラック Phase G4: 起動型コスト精算(`compile.ts` cost コンパイラ + ストア `activateAbility`)— この節も契約である

### 33.0 目的と分界(重要)
G2(§31)/ G3(§32)は起動型能力の**効果半分**(解決時の auto/guided 実行)を自動化した。だが**コスト半分は手動のまま**: 右クリック「能力を起動(スタックへ)」(`Playmat.tsx`)は `addAbilityToStack(cardId,'activated')` で能力をスタックに積むだけで、`{T}` タップ・マナ支払い・自己生け贄を**一切精算しない**。`parseAbilityIR` は `AbilityCost {raw, mana, tap, sacrificesSelf}`(§30)を**既に解析している**が `compileAbilityIR` はこれを無視している。

G4 は **起動時に確定的なコスト({T} 自己タップ・自己生け贄・支払い可能なマナ)を自動精算してからスタックに積む**。ただし **CR 605 のマナ能力は例外**で、スタックに積まず、起動コストとマナ加算を同一バッチで即解決する。効果側は既存 G2/G3 がそのまま走る。北極星=**activation frontier**(`shape==='activated'` 行のうちコストを完全自動精算できる率)。

**分界(エンジン不変性の核・§29.0/§30.0/§31.0/§32.0 を継承)**:
- **コストコンパイラ `compileAbilityCost`(`compile.ts`)は純粋・決定的・GameState 非依存**。`ctx.sourceId`/`ctx.def`(読み取りのみ)を参照して自己言及コマンド(tap-self / sac-self)を**生成するだけ**。盤面に依存するマナ自動タップはストア層(既存 `planAutoTap`)が担う。
- **支払いは既存 `applyCommand` 経路のみ**。`setTapped` / `payMana` / `moveCard` / `adjustLife` を再利用。**新 GameCommand 型は追加しない**(G3 と同じ肝)。`commands.ts` / `types.ts` に新型は足さない。
- **engine は自動でコストを払わない。ストアが仲介する**(G3 guided と同じ統治)。`addAbilityToStack` コマンド自体の挙動は**差分ゼロ**。
- **`effectsAuto`(グローバル/カード毎)OFF 時は自動精算しない**: 通常の非マナ起動型能力では、新 `activateAbility` は旧 `addAbilityToStack(sourceId,'activated')` 単独適用と**完全一致**(コスト未払いの素スタック積み=現状挙動)。これを新不変条件 **I9** とする(§33.4)。ただし **マナ能力の no-stack は CR605 のルール不変条件**であり、`effectsAuto` OFF でも通常能力としてスタック化しない。
- 完全ルールエンジン(優先権・自動スタック解決・レイヤー)は**依然スコープ外**。

### 33.1 コストコンパイラ `compileAbilityCost`(純粋・`compile.ts`・契約)
```ts
type CostDecision = 'auto' | 'manual';
interface CompiledCost {
  commands: GameCommand[];   // 自己言及の確定コスト(tap-self / sac-self)。マナは含めない
  manaCost: string | null;   // ストアが parseManaCost→planAutoTap で精算するマナ記号列('{2}{R}' 等)、無ければ null
  decision: CostDecision;    // auto = 全コスト要素が既知・残余英字ゼロ。manual = それ以外
  reasons: string[];         // manual 理由(昇順・重複なし。例 'variable-x'/'unmodeled-cost')
}
function compileAbilityCost(cost: AbilityCost | null, ctx: CompileContext): CompiledCost;
```
- **入力 `cost`**: 起動型行の `AbilityIR.cost`(§30)。`cost===null`(= 非起動型)→ `{commands:[], manaCost:null, decision:'auto', reasons:[]}`(コスト無し=精算不要を auto 扱い。呼び出しは起動型行に限るが防御的に定義)。
- **auto に乗せるコスト要素**(`cost.raw` が下記既知トークンだけで構成され、除去後の残余に英字が残らない時のみ `decision:'auto'`):
  - **tap-self**: `cost.tap===true`(`{T}` を含む)→ `commands.push({type:'setTapped', cardId: ctx.sourceId, tapped:true})`。
  - **sac-self**: `cost.raw` に `Sacrifice (this <型語>|it|~|<ctx.def.name>)` 成分(カンマ区切りの1コスト要素)→ `commands.push({type:'moveCard', cardId: ctx.sourceId, to:'graveyard', position:'top'})`。**`AbilityCost.sacrificesSelf`(`ir.ts`)には依存しない**(複合コスト `{2},{T},Sacrifice this creature` を取りこぼすため。裏取り §33.6)。`ctx.def.name` を使い `Sacrifice <そのカード名>` も検出する。除外: `Sacrifice (a|an|another|two|three|…|\d|each|all|other) …`(他パーマネント生け贄)。
  - **mana**: `cost.mana!==null` かつ **`{X}` を含まない** → `manaCost = cost.mana`(コマンドは生成せず、ストアが既存 `parseManaCost`→`planAutoTap`→`payMana` で精算)。既存マナソルバが generic/colored/hybrid/mono-hybrid/Phyrexian/snow を処理可能(裏取り §33.6)ゆえ色制限不要。
- **manual に落とすコスト**(`reasons` に記録・第1スライス未対応):`{X}` マナ(`'variable-x'`)、他パーマネント生け贄 / `Pay N life` / `Pay {E}`(エネルギー)/ カード捨て / カウンター除去 / 他パーマネントのタップ / `Exile <他カード>` / **先頭の未実装ラベル `<Word> —`**。`Coven —`/`Renew —` 等の能力語ラベルは保守的に manual。**`Power-up —` は能力語ではなく CR 702.193 のキーワード能力**であり、コスト軽減・「1回のみ」制約・entered-this-turn 参照を持つため、専用実装まで manual/scope-boundary とする。判定: `cost.raw` から既知トークン(マナ記号 `\{[^}]+\}`・tap `{T}`・sac-self 成分)を除去し、`[A-Za-z]` が残れば `reasons.push('unmodeled-cost')` で manual(§29 `hasResidualEffectText` と同発想)。
- 純粋・決定的・入力非破壊。`ctx.def`/`ctx.sourceId` は読み取りのみ。

### 33.2 純プランナ `activationPlanForSource`(`commands.ts`・state 読み取りのみ)+ ストア活性化フロー
誘導フロー(§32 の `guidedPlanForStackTop`)と同じ統治で、**盤面依存のコスト精算計画を純ヘルパに切り出す**(ストアを薄く保ち I9 を engine 面でテスト可能にする)。
```ts
function activationPlanForSource(
  state: GameState, sourceId: string, abilityLineIndex?: number,
): { commands: GameCommand[]; decision: CostDecision; manaShortfall: number } | null;
function activatedManaAbilityPlanForSource(
  state: GameState, sourceId: string, abilityLineIndex?: number,
): { commands: GameCommand[]; decision: CostDecision; manaShortfall: number } | null;
```
- **`effectsAuto` OFF**(グローバル `state.effectsAuto===false` or 当該カード `card.effectsAuto===false`)→ **`null` を返す**(ストアは素の `addAbilityToStack` のみ適用=**I9**)。
- ON: 対象行を `abilityLineIndex`(未指定時 `abilityLineIndexForKind(state, sourceId, 'activated')`)で特定 → `parseAbilityIR(line.text, def.typeLine)` → `compileAbilityCost(ir.cost, {sourceId, def})`。
  - `decision:'auto'`: `commands` を構築(**`addAbilityToStack` は含めない**=ストアが付与):
    - `compiledCost.commands`(tap-self / sac-self)を先頭に。
    - `manaCost!==null` → `plan = planAutoTap(state, parseManaCost(manaCost), 0)`。`...tapCommands(plan.taps), {type:'payMana', payment: plan.payment}` を積む。`manaShortfall = plan.shortfall`(不足分。0 なら充足)。マナ無しなら shortfall 0。
    - `manaCost===null` の時は cost.commands のみ。`{ commands, decision:'auto', manaShortfall }` を返す。
  - `decision:'manual'`: `{ commands:[], decision:'manual', manaShortfall:0 }` を返す(ストアは素の `addAbilityToStack` のみ)。
- 純粋・state 非破壊(読み取りのみ)。`planAutoTap`/`parseManaCost`/`tapCommands` 相当は engine 内既存を再利用。

**CR605 分岐 `activatedManaAbilityPlanForSource`**:
- `shape==='activated'`、対象を取らない、忠誠度能力でない、かつ効果に `effect.add-mana` を持つ行を候補にする(CR 605.1a)。
- `compileAbilityCost` と `compileAbilityIR` がともに `auto` へ落ちる単純なマナ能力は、`setTapped`/`payMana` 等のコストコマンド + `addMana` を返す。**`addAbilityToStack` は含めない**。
- `Add one mana of any color` 等、現コンパイラで色選択を解けない場合は `decision:'manual'` とし、ストアは warning を出すが **スタックには積まない**。
- `effectsAuto` OFF の影響を受けない。CR605 の no-stack は補助自動化ではなくルール不変条件。

**ストア `activateAbility(sourceId, abilityLineIndex?): void`**(`gameStore.ts`・薄いオーケストレーション):
1. まず `activatedManaAbilityPlanForSource(cur, sourceId, abilityLineIndex)` を試す。
   - `auto` なら返ったコマンド列だけを **1バッチ `applyCommands` → `commit`**。スタックは増えない。
   - `manual` なら warning を出し、スタック化しない。
2. 非マナ能力なら `plan = activationPlanForSource(cur, sourceId, abilityLineIndex)`。
3. `addCmd = {type:'addAbilityToStack', sourceId, kind:'activated', ...(index)}`。
4. 適用コマンド列 = `plan ? [...plan.commands, addCmd] : [addCmd]`。**1バッチ `applyCommands` → `commit`(単一 undo)**。
5. `plan?.decision==='auto'` でコスト精算をログに明示(例「《○○》の能力を起動(コスト精算)。」)。`plan?.manaShortfall>0` は警告ログ(サンドボックス=強行で続行・部分支払い)。`plan?.decision==='manual'` または `plan===null` は warning でコスト手払いを促してよい。
6. EngineError は既存流に握って `console.error`、盤面不変。

### 33.3 UI 配線(`Playmat.tsx`)
- 右クリック「能力を起動(スタックへ)」(`ability-activate`)の `onSelect` を `store.addAbilityToStack(cardId, 'activated')` から `store.activateAbility(cardId)` へ切替。**`data-testid='ability-activate'` は維持**。
- (任意・Codex 判断)コスト未払いで素積みしたいユーザー向けに「能力を素積み(コスト手払い)」副メニュー(`addAbilityToStack` 直呼び)を追加してよい(サンドボックス=強行可)。スコープは Codex 判断だが**既存 testid を変えない**。

### 33.4 不変条件 I9(`review.g4-activate` が固定)
`effectsAuto`(グローバル or 当該カード)が **false** の時、通常の非マナ起動型能力では `activationPlanForSource(state, sourceId)` は **`null`** を返す → ストアは素の `addAbilityToStack` のみ適用するため、結果 GameState は **`applyCommand(state, {type:'addAbilityToStack', sourceId, kind:'activated', abilityLineIndex})` 単独適用と完全一致**(コスト自動精算による追加変化ゼロ)。I8(解決時 OFF=効果差分ゼロ)と対をなす活性化側の不変。**マナ能力はI9の例外で、CR605によりOFFでもスタックに置かない。** なお `activateAbility` はストア action(GameCommand ではない)ため I1〜I7 の fast-check harness 対象外。I9 と CR605 例外は `review.g4-activate` の具体ケースで固定する。

### 33.5 計測(`scripts/grammar-compile.ts` に cost セクション追加 + `research/grammar-compile/report.*`)
`shape==='activated'` 行を母数に:
- **activation frontier(主成果)**= `compileAbilityCost(ir.cost, ctx).decision==='auto'` 率(起動型行のうちコストを完全自動精算できる割合)。
- **fully-playable**= コスト `auto` **かつ** 効果 `compileAbilityIR(ir).decision ∈ {auto, guided}` の率(コスト・効果両半分が自動/誘導で完結する起動型割合)。
- **コスト要素分布**: tap-only / mana(非X)/ sac-self / それらの複合 / manual の内訳。
- 計測の `ctx` は実 sourceId が無いので合成(`sourceId:'probe'`・`def` は当該カード)。`ctx.def.name` 依存の sac-self 検出を計測でも効かせる。
- レポート冒頭に「未調整(候補分布)」と activation frontier / fully-playable の定義を明記。既存 executable / guided frontier セクションは保持。

### 33.6 裏取り(完了・§29.6 流)
コーパス(17,491枚・起動コスト行 5,103)で Fable 確認済(2026-06-22):
- **`AbilityCost.sacrificesSelf` は複合コストを取りこぼす**(`^Sacrifice...this` 先頭限定)→ `compileAbilityCost` は `ctx.def.name` 込みで自前再判定(ir.ts 不変=G1 再ベースライン回避)。
- マナ抽出は `{T}` 除外・generic/colored/hybrid/Phyrexian 取得可。`parseManaCost`/`planAutoTap`/`solvePayment` がそれらを精算可能。`{X}` のみ manual。
- 残余判定で `Pay N life`/`Pay {E}`/`Discard a card`/`Sacrifice another …`/`Tap X untapped … you control`/`Remove a … counter`/`Exile <他カード>`/先頭ラベル `<Word> —` が正しく manual に落ちる。

### 33.7 不変・非干渉(エンジン不変)
- `compileAbilityCost` は決定的・入力非破壊・GameState 非依存(`ctx.def`/`ctx.sourceId` 読み取りのみ)。
- **I9 維持**: `effectsAuto` OFF 時、非マナ起動型能力は `activateAbility` が `addAbilityToStack` 単独と差分ゼロ。マナ能力は CR605 例外として常に no-stack。
- **I8 維持**: コスト精算は活性化時のみ。解決時の効果 auto/guided 実行ロジックは不変。
- I1〜I7 は既存コマンド(`setTapped`/`payMana`/`moveCard`/`addAbilityToStack`)経由ゆえ維持。`compileAbilityIR`(効果側)・`parseAbilityIR`・`splitAbilityLines` は**挙動差分ゼロ**(G4 はコスト消費の追加のみ)。
- **変更対象**: `src/engine/grammar/compile.ts`(`compileAbilityCost`・`CompiledCost`/`CostDecision`・純粋・新コマンド型0)/ `src/engine/commands.ts`(純ヘルパ `activationPlanForSource` / `activatedManaAbilityPlanForSource`・state 読み取り専用。§32 の `guidedPlanForStackTop` 追加と同格。**新 GameCommand 型は追加しない**)/ `src/store/gameStore.ts`(`activateAbility` action・薄いオーケストレーション)/ `src/components/playmat/Playmat.tsx`(`ability-activate` を `activateAbility` へ配線)/ `scripts/grammar-compile.ts`(cost セクション)/ `research/grammar-compile/*`(生成物)。`commands.ts`/`types.ts` に**新コマンド型は追加しない**。`ir.ts`/`index.ts` は**変更しない**(コスト消費とマナ加算は既存コマンドへ写すのが G4 の肝)。`review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` / `rule/` txt のコミット / git 操作は禁止。
- reviewer 専有テスト `review.grammar-cost`(純 `compileAbilityCost`)/ `review.g4-activate`(`activationPlanForSource` engine 統合・I9)は Fable が先に書く(済)。Codex は触らない。既存 `review.grammar-compile` に cost セクションが増えた分の期待値は **Fable が更新**(実装は触らない)。`review.properties`(I1〜I7)は既存コマンド経由ゆえ変更不要。機械チェック4点全通過 + `npm run grammar-compile` が 17,491枚で完走し §33.5 の activation frontier / fully-playable を出力すること。

---

## 34. ルール基盤(Substrate)+ 文法コンパイラ(Compiler)アーキ契約 — この節も契約である

**M-CONTRACT = 凍結ゲート(2026-06-23)**。プロジェクトの背骨アーキを契約化する。設計の全文・S0〜S5・G1〜G5・対象ファイルは正本 `docs/architecture-substrate-compiler.md`、**設計手法(理解→state落とし込みのモデリング・サイクル/完全な物差しは無い前提のKPI)**は `docs/engine-design-method.md` を参照。

**重要な順序**: 本章は**実装の前提ではなく、先行する M0 モデリング・サイクルが収束した結果を凍結する契約**である。M0 が `engine-design-method.md` の手法でエンジン状態オントロジー(ESO)+ オラクル文法⇄状態変異カタログを二面分析で収束させ(churn 閾値・頭被覆を満たす)、それを本 §34 へ凍結してから実装(S-*)へ進む。**M0 収束までは本章は draft**(各反復で更新されうる)。

**本章は契約面のみ**(拘束する性質・スコープ境界・不変条件枠・前方互換規律・KPI/物差し)。具体的な型シグネチャは各実装マイルストーン(S-EVENTS 等)が自章で確定する。`CLAUDE.md` 設計原則 L35 はこのアーキに合わせ「統制された範囲で自動化(誤謬許容)」へ緩和済み(LLMジャッジ助言のみ・可逆性は不変)。

### 34.0 CR grounding policy(契約)

**CR を読むだけではなく、CR を検査器として使う。** 実装判断・契約判断・凍結判定は、該当する CR 条文と、その条文から落とした盤面遷移ゴールデンケースを持つこと。分類器 parity やコーパス被覆は補助指標であり、CR 由来の状態遷移不変条件を代替しない。

固定版:
- 参照CR: **Magic: The Gathering Comprehensive Rules, effective 2026-06-19**。
- 公式TXT: `https://media.wizards.com/2026/downloads/MagicCompRules%2020260619.txt`。
- ローカル本文: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`。
- 固定メタデータ: `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`(SHA-256 を含む)。

仕様判断ごとの必須根拠:

| 領域 | 根拠CR | 契約上の読み |
|---|---|---|
| 統率者税 | CR 903.8、601.2i | 税は「統率領域から唱えた過去回数」。戻し時ではなく、唱え終わった時点で `castCount` を増やす。 |
| 統率者の墓地/追放移動 | CR 903.9a、704.6d、603.6c、603.10a | 墓地/追放へ一度置かれた事実と死亡/離脱誘発を保持し、優先権前のSBAで統率領域へ移せる。command 行きへの事前置換にしない。 |
| 統率者の手札/ライブラリー移動 | CR 903.9b、614.5、400.7 | 手札/ライブラリーへ行く場合は replacement effect として統率領域へ置ける。選択した場合、その手札/ライブラリーへの zone-change event は発生しない。 |
| マナ能力 | CR 605.1–605.5、405.6c | 起動型/誘発型マナ能力は条件を満たせばスタックに置かず即解決する。対象を取る能力や呪文はマナ能力ではない。 |
| 誘発と優先権 | CR 603.3、603.3b、704.3、117.5 | 誘発は即スタックではなく、次に優先権を得る前の SBA→pending triggers→SBA ループで積む。 |
| 領域移動/オブジェクト同一性 | CR 400.7 | 領域を移動したオブジェクトは原則として別オブジェクト。物理カードIDと zone incarnation/objectId を分ける。 |
| トークンの領域移動 | CR 111.7、704.5d | トークンは battlefield 外へ移動したイベントを発生させ、その誘発が確認された後、SBAで消滅する。 |
| 2026-06-19 差分 | CR 701.69、702.193、702.194、722 | Heal / Power-up / Teamwork / Preparation Cards は最新CR語彙として認識する。未実装なら manual/scope-boundary と明示し、covered 扱いにしない。 |

実装へ入る前の CR-golden は `research/cr-grounding/golden-cases.json` を正本とする。S-EVENTS/S-TURN/S-ZONES は、同ファイルの in-scope ケースを実行可能 golden replay へ移植してから合格判定する。

M0 CR Grounding Gate の status 正本は `research/cr-grounding/README.md` の "M0 CR Grounding Gate status" と `docs/acceptance.md` の CRG 表とする。`PASS` / `PASS(core)` / `PASS(boundary)` / `PARTIAL` を区別し、`PARTIAL` の残る境界(full SBA suite、603.3b second-bucket、commander 903.9a 汎用SBA choice、誘発型マナ能力など)を完了済みに混ぜてはならない。

M0-FREEZE の CR-grounding overlay 正本は `research/cr-grounding/m0-freeze-overlay.json` とする。`research/cr-grounding/README.md` と `docs/acceptance.md` の CRG 表は人間向け表示であり、scorecard 配線時の機械可読入力は overlay JSON を使う。Fable の承認/差戻し記録は `research/cr-grounding/m0-freeze-decision-record.md`、証拠監査は `research/cr-grounding/m0-freeze-evidence-audit.md`、CR refs / golden / executable / overlay / boundary の追跡表は `research/cr-grounding/m0-freeze-traceability-matrix.md` を参照する。

Zone/zone-change の設計正本は `research/cr-grounding/zone-change-study.md`。CRG-5 トークン死亡、CRG-6 誘発/SBA/優先権、CRG-7 領域移動/LKI は共有 substrate を持つため、個別実装へ直行しない。順序は Z1 object incarnation scaffold → Z2 ZoneChangeEvent → Z3 pendingTriggers → Z4 stabilizeBeforePriority → Z5 executable CR-golden。

Z1 object incarnation scaffold は 2026-06-27 に実装済み。`CardInstance.id` は物理/表示ID、`zoneChangeCounter` は CR 400.7 の object incarnation counter、`objectIdOf(card)` は `id:zoneChangeCounter` の派生IDとする。true zone-change でのみ increment し、同一 zone 内 reordering では increment/reset しない。pre-Z1 snapshot は `restoreGame` で `zoneChangeCounter: 0` を backfill する。

Z2 ZoneChangeEvent scaffold は 2026-06-27 に実装済み。`GameState.eventLog` に `ZoneChangeEvent` を蓄積し、各 true zone-change は `before` / `after` の `ObjectSnapshot` を持つ。同一 zone 内 reordering は event を発行しない。pre-Z2 snapshot は `restoreGame` で `eventLog: []` を backfill する。`triggerCandidates` は Z3 まで既存 prev/next 差分のまま残す。

Z3 pending trigger scaffold は 2026-06-27 に実装済み。`GameState.pendingTriggers` を追加し、store の通常遷移では新規 `ZoneChangeEvent` から ETB/death/LTB/cast の pending trigger を収集する。各 pending trigger は `eventId`、`simultaneousGroupId`、`controllerId`、`sourceObjectId`、`sourceSnapshot` を持つ。`controllerId` は誘発発生時点の controller、`simultaneousGroupId` は event の同時発生グループ(単一イベントでは `eventId`)であり、APNAP/同時誘発順序は現在 state を後読みせずこの保存値を使う。UI/store の `triggerCandidates` は `pendingTriggers` からの adapter 表示として残す。token death のように source が `cards` から消えた後も、event.before の `sourceSnapshot` から pending trigger を保持する。phase/draw/attack は専用 event 型が未導入のため、Z3では synthetic `implicit:*` eventId で pending 化する。完全な SBA/優先権固定点処理は Z4 に残す。

Z4 stabilizeBeforePriority scaffold は 2026-06-27 に token cease / toughness-zero の最小SBAとして実装済み。`applyCommand` の返却前に `stabilizeBeforePriority()` を実行し、battlefield 外にある token は CR 704.5d により消滅し、toughness 0 以下の creature は CR 704.5f により graveyard へ置かれる。token は一度 battlefield→graveyard/exile 等の zone-change event と pending trigger の対象になり、その後 `reason:'token-cease'` / `sbaApplied:'704.5d'` の event を残して削除される。704.5f は `reason:'sba'` / `sbaApplied:'704.5f'` の battlefield→graveyard event を残す。commander 903.9a は UI choice が必要なため、現時点では `moveCommanderWithZoneChoice` bridge を維持し、完全な SBA choice 化は後続へ残す。

Z5 executable CR-golden subset は 2026-06-27 に実装済み。`src/store/__tests__/crGroundingGoldenCases.test.ts` が `research/cr-grounding/golden-cases.json` の case id / CR refs に接地し、`cr-token-dies-before-ceases`、`cr-trigger-sba-priority-loop`(pending/no-direct-stack、controller/group 保持、priority boundary v1、explicit-order stack placement、mixed-controller APNAP ordering core v1、同一controller内順序選択UI v1、704.5f + deterministic fixed-point v1 部分)、`cr-zone-change-new-object-lki` を実行可能 test として検査する。`putPendingTriggerOnStack(pendingTriggerId)` / `putPendingTriggersOnStack(pendingTriggerIds)` は `PendingTrigger.sourceSnapshot` から、source が `cards` から消えた token death ability も stack に置ける。複数件は渡した配列順に stack へ append し、最後の id がスタック最上段になる。`placePendingTriggersForPriority(pendingTriggerIds)` は全pending指定を要求し、渡された順序を各 controller 内の選択順として扱ったうえで、`activePlayerId` と `PendingTrigger.controllerId` により controller 間を APNAP 順に正規化して単一バッチで stack へ置く。priority boundary 中に新規 pending trigger が生じた場合、順序が一意なら同じ境界内で stack へ置き、選択が必要なら pending を残して warning/manual で止める。`TriggerCandidatePanel` は複数 pending trigger がある場合に上下移動と「この順でスタックへ」を表示し、その順序を priority boundary へ渡す。既存 golden replay harness はまだ eventLog/pendingTriggers/sourceSnapshot を表現できないため、CR-grounding 専用テストに留める。603.3b second-bucket と full SBA suite は後続。

M2 Player/Controller substrate は 2026-06-27 に実装済み。`GameState.activePlayerId`、`CardInstance.ownerId`、`CardInstance.controllerId` を追加し、旧 snapshot は `restoreGame` で P1 に backfill する。`ObjectSnapshot.ownerId/controllerId` と `PendingTrigger.controllerId` は、誘発/領域移動発生時点の card owner/controller を保存する。R1 APNAP ordering core v1 は 2026-06-27 に実装済みで、`src/engine/priority.ts` の `orderPendingTriggersApnap` が CR 603.3b/101.4 の controller 間順序を決める。

CR-golden を測れる最小 event envelope:
- `eventId`, `sequence`, `simultaneousGroupId`, `causeCommandId`
- `actorPlayerId`, `controllerAtEvent`, `ownerAtEvent`
- `physicalCardId`, `objectId` または `zoneChangeCounter`
- `fromZone`, `toZone`, `reason`, `replacementApplied`, `sbaApplied`
- `before` / `after` snapshot(LKI 用。少なくとも controller/type/power/toughness/tapped/counters/zone)
- `pendingTriggerIds`(event から誘発した候補。stack item 生成とは分離)

2026-06-26 追記 / 2026-06-27 更新: 現行 store では `moveCommanderWithZoneChoice` が CR 903.9a/b の暫定橋渡しを行う。graveyard/exile 行きで command を選ぶ場合は、中間状態の zone-change event から死亡/離場 pending trigger を収集してから command へ移す。hand/library 行きで command を選ぶ場合は replacement として直接 command へ移す。ただしこれは完全な `stabilizeBeforePriority()` ではないため、CRG-6 完了条件には含めない。

### 34.1 拘束する設計原則(契約)
- **C-A(コンパイラ純粋・命令のみ)**: 文法コンパイラ(IR→commands)は GameState を**直接変更しない**。出力は**拡張 `GameCommand` 列のみ**。盤面変更は `applyCommand` 経由のみで起こり、誤訳は**単一 undo で可逆**(既存スナップショット履歴 200 件が保険)。
- **C-B(有効特性は層経由)**: 新規のルール解析(キーワード保有・P/T・型・色)は def 直読みでなく `computeEffectiveCharacteristics(state, objId)`(継続効果の層 CR613)を**正本**とする。既存 `status.ts`(`effectivePower`/`effectiveKeywords`)からの移行は段階的でよい(パリティ確認まで旧経路を残す)。
- **C-C(誘発はイベント購読)**: 新規誘発の発火は `events.ts` のイベントストリーム購読(observer: self/you/opponent/any)を**正本**とする。現 prev/next 差分(`gameStore.ts` の `detectTriggerCandidates`)は移行対象。
- **C-D(助言と強制の境界は不変)**: LLMジャッジは助言のみで盤面を変えない。唯一の強制=スタック非空でのフェイズ/ターン移動禁止(§17)。いずれも本アーキでも不変。

### 34.2 計画モジュール(契約意図。具体型は各マイルストーン章で確定)
- **`src/engine/events.ts`**(新): `GameEvent` 型・購読(observer/介在条件 intervening-if/頻度/遅延誘発/置換フェーズ)。S-EVENTS で導入、S-ABILITY+DUMMY で誘発購読を本配線。
- **`src/engine/layers.ts`**(新): `computeEffectiveCharacteristics`・層1〜7(コピー/コントロール/文章/型/色/能力/P・T)をタイムスタンプ順適用。S-LAYERS で最小(層7/6/4/5)導入、S-CONTINUOUS で静的能力接続。
- **`src/engine/turn.ts`**(新): 戦闘サブステップ(CR500)・ターンベース処理(CR703)juncture・SBA(CR704)。S-TURN で導入。
- **プレイヤー別ゾーン / `GameObject` 統一 / ダミー対戦相手**: `zones[playerId]`(library/hand/graveyard)+ 共有(battlefield/stack/exile/command)。S-ZONES / S0 / S5 で導入。

### 34.3 前方互換規律(契約・全 substrate マイルストーン必須)
GameState にゾーン/フィールド/プレイヤーを追加する各マイルストーンは、`restoreGame` で旧スナップショットを補完すること(クラッシュ厳禁)。とくにプレイヤー別ゾーン化では**旧・全体共有スナップショットを単一プレイヤーへ写像**する。`CACHE_SCHEMA_VERSION` の更新要否は各章で判断する。([[snapshot-forward-compat]] 既知の落とし穴を踏襲。)

### 34.4 新不変条件枠(I13〜。各実装マイルストーンで具体化し `review.*` で固定)
M-CONTRACT は枠を予約するのみ。導入する状態に対応する具体 I を各章で追加する(I1〜I12 と同様)。
- **I13(コンパイラ純粋性)**: コンパイラ(IR→commands)は GameState を変更せず、決定的・入力非破壊。出力は `GameCommand` 列のみ(C-A の不変条件版)。
- **I14(イベント決定性)**: `events.ts` のイベント発行は決定的に再現可能(同一 state + command → 同一イベント列)。`applyCommand` の決定性と整合。
- **I15(有効特性純粋性)**: `computeEffectiveCharacteristics` は state 読み取り専用・決定的・入力非破壊。
- **I16(前方互換)**: 本章導入前の構造のスナップショットを `restoreGame` で読み込んでもクラッシュせず I1/I2 を満たす。

### 34.5 スコープ境界(契約=以下の未対応で実装を不合格としない)
層依存(CR613.8)・置換効果の相互作用(CR616)・特殊タイミング・サブゲーム/次元/策略(CR729/901/904)・両面/合体/レベル等の周辺型(CR710-730)の網羅は**初期非対応**。基盤は素直なケースを正しく扱い、複雑相互作用は手動/undo で救う。レビューはこれら未対応を欠陥として扱わない。

### 34.6 マイルストーン順(背骨)
**M0 モデリング・サイクル(先頭・反復)→ M-CONTRACT(本章で凍結)→** S-EVENTS → S-LAYERS(events と並行可)→ S-ZONES → S-TURN → S-ABILITY+DUMMY(events 必須・**複数誘発 routing 破綻の根治**)→ S-CONTINUOUS → C-GRAMMAR → C-BIND(events+layers 成立後)→ C-COVERAGE(随時)→ A-LOOP → 以後 V4(プレイヤー別ゾーン+ダミー相手が土台)→ V3。既存 G0〜G4(§29〜§33)はコンパイラ半に取り込み済み。**実装(S-*)は M0 が state 設計を紙の上で収束させて初めて着手する。**

### 34.7 KPI と物差し(完全な物差しは無い前提)— 契約
正しさの計測は **単一スカラーの“正答率”を採らない**(持っていない完全な物差しを暗に仮定するため)。手法詳細は `docs/engine-design-method.md` §3〜§5。契約として固定する原則:
- **反証主義**: 「正しい」とは証明せず、独立した不完全な物差しの束で**反証を試み続ける**。一致=弱い陽性、不一致=発見、人間が裁定する。
- **3状態**: `検証済 / 不一致 / 検証不能`。**`検証不能` を緑(pass)に混ぜてはならない**(= silent divergence の禁止)。検証不能は「未検証」と可視化する。
- **主指標**= オラクル間不一致率(構文クラスタで系統誤りを炙る)・帰属分布・物差し校正(メタ)・反証率・**検証不能率(安全上限)**。`npm run accuracy`/grammar-coverage はこのうち下面抽出の器。
- 各 ESO エントリは `検証手段(物差し)` と `trust` を持ち、測れない部分(意図的な誤謬予算)を明示する。
- **churn の意味(契約)**: 下面抽出*単独*の低 churn は収束ではない(構造的 FN は毎反復同一に取りこぼし churn が立たない)。**収束シグナルは『新しい独立物差しを当てても崩れない低 churn』のみ**。precedent: Slice2 で自己 churn 0.05% が独立盲予測で真 churn 13.55% に崩壊。詳細は `engine-design-method.md` §4。
- **実行計測(契約)**: 正しさは分類一致だけで測らない。**ゴールデン再生ハーネス**が『初期盤面 + コマンド列 → 発行イベント → 誘発 → スタック解決 → SBA → 期待盤面』の**盤面遷移**を測る(分類器の一致ではない)。
- **分類器 parity(契約)**: 研究計測器(`scripts/lib/*Classify.ts`)と runtime 分類器(`src/data/ruleClassifier.ts`・`gameStore.ts` の誘発検出)は黙って乖離してはならない。parity テストで乖離を検出し、**乖離 = 0** を凍結条件とする(粒度差は許容差テーブルで明示)。

### 34.7.1 M-CONTRACT 凍結ゲート(契約・7条件)
state モデルを §34 へ凍結し S-* 実装へ移るのは、**下記7条件を全て満たしたときのみ**。
**Slice1+2 のみでの部分凍結は禁止**(戻せない state 設計の偽収束を防ぐ):
1. スライス **1〜4 を一巡**(Slice3 ゾーン+プレイヤー / Slice4 タイミング+SBA を含む)。
2. オントロジー被覆率(頭) **≥ 90%**。
3. モデル churn **< 5%** を**独立物差しを新しく当てた直後**に測って維持(下面抽出単独 churn では不可)。
4. **非LLM独立物差し**(Forge/XMage 差分 or 人間の盤面再生 gold)が代表カード集合をカバーし不一致が有界。
5. **ゴールデン再生(実行計測)**が**実デッキ加重**サンプルで合格。
6. **研究分類器 ⇄ runtime 分類器の乖離 = 0**(parity テスト緑)。
7. **検証不能率**を明示公開し上限以下。

> **現況(2026-06-26・M-CR-RECONCILE 開始)= NOT FROZEN / S-EVENTS 実装着手不可**。
> 2026-06-25 のスコアカードは「分類器・コーパス・既存 golden replay」に対する有効な研究成果だが、CR 2026-06-19 への固定後に、統率者税(CR 903.8)、マナ能力(CR 605)、誘発/SBA/優先権(CR 603/704/117)、領域移動(CR 400.7)、トークン(CR 111.7/704.5d)の状態遷移 gold が不足していることが判明した。したがって FROZEN 判定は **CR-grounding 不足により撤回**し、`research/cr-grounding/golden-cases.json` の必須ケースを契約へ反映するまで M-FREEZE に進まない。
>
> 旧スコアカード(2026-06-25)の数値は以下の通り、研究資産として保持する。ただし「実装契約の凍結根拠」としては使わない。
> - **条件1 ✅ PASS**(Slice1〜4 一巡・commit `3e220e7`)。
> - **条件2 ✅ PASS = 頭被覆 92.45% ≥ 90%**(最弱=event-family 92.45% / timing-juncture 99.20% / zone-scope 99.03%)。
>   oracle-gated 軸(layer/zone-axis/castTiming)は低オラクル不一致(family 0.49%/observer 0.00%)で担保。
> - **条件3 ✅ PASS = churn 1.95% < 5%(M-GATE-4)**。CR-conformance 物差し(条件4)適用後に **4スライス同時 post-yardstick churn** を測定
>   (§34.7.5・baseline=`04184e4`)。perSlice: layer 0.00% / event 1.95% / zone 0.00% / timing 0.82%。
>   旧 11.86%(iter3-b 墓地 +1945 の一回限り意図再分類)は baseline へ畳まれ清算。高 conformance + 低 churn = 物差しを当てても崩れない真の収束。
> - **条件4 ✅ PASS = CR-conformance 100%・bounded(M-GATE-4)**。非LLM 独立物差し=CR 真理テーブルを代表160枚(4軸×40)へ体系化(§34.7.5)。
>   divergent 0(timing の能力語接頭辞 FN 125枚規模を `timingClassify` 修正で解消=CR 603/505.1a)。`research/cr-conformance/`。
> - **条件5 ✅ PASS = 実デッキ加重 golden-replay 88.89% ≥ 70%(M-GATE-3)**。inScope 27・verified 24・残 runtime-gap 3 は別枠。
> - **条件6 ✅ PASS = parity 0%(M-GATE-2)**。研究⇄runtime 乖離 3.49%→0(`divergentCards===0`)。
> - **条件7 ✅ PASS = 検証不能率 2.44% ≤ 10%**(max 5.82%・4分類オラクル加重平均)。
>
>
> **次 = M-CR-RECONCILE**(CR 2026-06-19 固定・仕様判断ごとの条文根拠・CR-golden 整備 → scorecard 再判定)。M-FREEZE / S-EVENTS はその後。

> **現況(2026-06-28・M0-FREEZE review)= CONTRACT-UPDATE READY / M0-FREEZE NOT COMPLETE**。
> `research/cr-grounding/` の CR-grounding handoff は contract-update stage へ進める材料が揃った。ただし M0-FREEZE 完了には、docs契約反映、scorecard overlay配線、scorecard再生成、Fable最終承認が必要である。したがって S-* 実装にはまだ進まない。

### 34.7.2 M-CONTRACT ゲート・スコアカード(契約)
§34.7.1 の7条件を**一枚で再現可能に判定する物差し**。判定を散在データの目視でなく、決定的な集計器に固定する。

**成果物**: `research/m-contract-gate/scorecard.{md,json}`。生成器 = `npm run m-contract-gate`
(`scripts/m-contract-gate.ts` + 純関数 `scripts/lib/mContractGate.ts`)。json は再現可能・監査可能。
表は **7条件 × {status, value, threshold, source(artifact path), note}** + 総合判定。
既存 report.json(`research/{layer,event,zone,timing}-coverage`・`research/{llm,event,zone,timing}-oracle`・
`research/classifier-parity`)と golden-replay の compute(`src/engine/goldenReplay.ts` 再利用)を入力にする
(分類器・物差しを**再実装しない**)。`src/engine/` の挙動は不変(本器は計測専用)。

M-CR-RECONCILE 以後の scorecard は、legacy seven-condition reports に加えて `research/cr-grounding/m0-freeze-overlay.json` を入力にする。overlay wiring 後の `scorecard.json` は `legacyFrozen`、`crGroundingOverlay`、`crGroundingOverlayApproved`、`crGroundingOverlayProblems` を含む。Markdown は `CR-grounding Overlay` と `R-FREEZE Designs` を表示し、旧 `Superseded` 注記を overlay included 注記へ置き換える。

**status 語彙**: `PASS`(数値が閾値達成 **かつ** 検証不能を緑に混ぜていない)/ `FAIL`(数値未達)/
`BLOCKED`(後続 MS 待ち=器が未整備)/ `UNMEASURED`(本 MS で初計測)。

**条件2 頭被覆率の定義(Fable 確定)**: 各分類器の**明示的逃し箱**(catch-all)へ落ちる頻度シェアを未写像とみなす。
- 逃し箱を持つ軸: **event(族)=`other`** / **timing(juncture)=`other`** / **zone(playerScope)=`unknown`**。
  `head被覆(軸) = 1 − (逃し箱頻度 / 当該軸の総頻度)`(頻度 = event は lineCount、timing/zone は cardCount)。
- **逃し箱を持たない軸**(layer の L*、zone の zone-axis、timing の step/castTiming)は **self-coverage が
  構造的に FN 検出不能**(毎反復同一に取りこぼす=§4 churn precedent と同型)。これらは self 数値を 100% と
  **主張しない**。真の被覆は独立オラクルの不一致/検証不能(条件3/7)へ委ねる。scorecard は `escape-box-free:
  oracle-gated` と明示する。
- **集約 head被覆 = 逃し箱を持つ軸の最小値**(最弱の軸が凍結を律する)。逃し箱無し軸は別掲。
- **閾値 T = 90%**(初期・改訂可)。`< T` なら条件2 FAIL = **追加スライス(more modeling)が必要**の信号。

**条件7 検証不能率の上限(Fable 確定)**: 4分類オラクル(layer/event/zone/timing)の `unverifiableRate` を
**サンプル加重平均**で集約(max も併記)。**公開上限 U = 10%**(初期・改訂可)。
golden-replay の検証不能ケース率は**実行計測の成熟度=条件5の sub-metric** として別枠で報告し、条件7 の U には混ぜない。

**条件5 ゴールデン再生(実デッキ加重)の閾値(Fable 確定・M-GATE-3)**: 実装と手順は §34.7.4。
- **検証可能在圏率 T5 = 70%**(初期・改訂可)。kill 基準(§ method「反復効果の auto+guided が目標 例 70%」)に整合。
  `verifiedInScopeRate = verified在圏ケース数 / 在圏ケース数 ≥ T5` で `value` を採る。
- **在圏(in-scope)** = 全ケース − **純 scope-boundary ケース**(§34.5 の対象外機構のみが阻む検証不能)。
  純 scope-boundary は分母から除外し**別枠で報告**(凍結を律しない)。
- **§3 鉄則の適用**: `runtime-gap`(閉じられる検証不能)ケースは verified 分子に**入れない**=緑に混ざらない。
  条件5 PASS = `在圏ケース数 ≥ 最小標本(§34.7.4)` **かつ** `verifiedInScopeRate ≥ T5` **かつ** 残存 `runtime-gap` を別枠明示。
- `buildConditionFive` は BLOCKED 固定をやめ、構造化検証可能性(§34.7.4)から上式を決定的に集計し PASS/FAIL を返す。

**ゲート判定ロジック(決定的)**:
1. 条件は「value が threshold 達成 **かつ** 当該軸に検証不能を緑へ混入していない」のときのみ `PASS`(method §3 鉄則)。
2. 1つでも `PASS` でなければ総合 = **NOT FROZEN**。
3. 検証不能(`unverifiable > 0`)を含む条件は数値が閾値達成でも `PASS` にできない(silent divergence 禁止)。

M-CR-RECONCILE 以後の追加判定:

4. 総合判定は legacy seven conditions と CR-grounding overlay の合成とする。
   - 入力: legacy seven-condition reports + `research/cr-grounding/m0-freeze-overlay.json`。
   - `required-pass`: `PASS` 必須。
   - `core-pass-only`: `PASS(core)` を許可。ただし `remainingBoundary` 必須。
   - `boundary-pass-only`: `PASS(boundary)` を許可。ただし `remainingBoundary` 必須。
   - `partial-allowed-*`: `PARTIAL` を許可。ただし `remainingBoundary` 必須。
   - `FAIL` は不可。
5. `frozen = legacyFrozen && crGroundingOverlayApproved` とする。
6. `PARTIAL` / `PASS(core)` / `PASS(boundary)` は plain `PASS` に変換しない。Markdown scorecard でも status と remaining boundary を表示する。
7. `frozen` は「未実装ゼロ」を意味しない。S-* carry / scope-boundary を明示したうえで次段階へ進める、という M0-FREEZE 契約上の判定である。

### 34.7.3 parity 和解(M-GATE-2・条件6=研究⇄runtime 乖離 0 への手順)
条件6 の parity=0 は、研究計測器(`scripts/lib/*Classify.ts`)と runtime 分類器(`src/data/ruleClassifier.ts`)の
**マップ済み族内の per-card 不一致**(現 225枚=`research/classifier-parity/report.json`)を一枚残らず処理して達成する。
処理は **CR を一次権威**(method §3)に **Fable が裁定**する。Codex は判定しない(草稿のみ)。

**和解の単位 = クラスタ**(族 × 方向)。各 per-card 不一致を次の語彙のいずれかへ帰属する:
- `runtime-FP` / `research-FP`(過剰検出=その側を絞る)・`runtime-FN` / `research-FN`(取りこぼし=その側を足す)
  = **分類器バグ→該当側を CR に合わせて修正**。
- `granularity-allowance` = 両側とも CR 上正当な粒度差 → **許容差テーブル**(`CLASSIFIER_PARITY_ALLOWANCES`)へ
  **CR 引用付き rationale** を明示追加(現状の axis 級に加え、必要なら pattern 級の許容を導入)。

**parity=0 の定義(契約)**: `divergentCards − (allowance で正当化された不一致) = 0`。
silent に許容しない(全 allowance は CR 引用必須=method §3 鉄則の parity 版)。

**和解ワークシート(Codex 草稿・判定なし)** = `research/classifier-parity/reconciliation.md`:
225枚を9クラスタへ束ね、各クラスタの代表カード `oracleText` 抜粋 + 統べる **CR 条文**(`rule/...txt` から引用)+
**草稿帰属**(上記語彙)+ 提案する修正(runtime/research/allowance)を表で出す。**分類器コードは変更しない**(裁定待ち)。
Fable がクラスタ単位で裁定 → 合意後に Codex が `ruleClassifier.ts`/`*Classify.ts`/allowance を修正し parity を 0 へ。
runtime 修正は `review.classifier-corpus`/`review.golden-replay`/`review.classifier-parity` を回帰ゲートにする。

### 34.7.3.1 クラスタ裁定(Fable・2026-06-25・M-GATE-2 本体)
ワークシート(`reconciliation.md`)9クラスタ225枚を、両分類器の実出力をコーパスで実機検証した上で Fable が裁定した。
**構造的事実(裁定の土台)**: research(`eventClassify`)は**誘発条件のみ**を分類し、かつ**誘発節がアビリティ行の先頭(`triggerSegments` の `starts[0]===0`)にある場合のみ**認識する。runtime(`ruleClassifier`)は**段落全体の緩い正規表現**(例 `when|whenever [^.]* casts? [^.]* spell`)で動詞を拾う=条件と効果文を区別しない。この非対称が225枚の大半を生む。

**重要な裁定の方針転換**: ワークシートが `granularity-allowance` と下書きした3クラスタ(cast 70・enters\|runtime-only 21・draw 2)は**許容差ではなく両側の修正可能なバグ**である。効果文中の "cast a spell" を cast 誘発と数えるのは CR 603.1(誘発条件が族を定義する)違反の runtime-FP であり、粒度差ではない。**したがって本ゲートの目標 allowance 追加=0**(既存 axis 級 allowance は不変。新規 per-card/pattern allowance は導入しない)。parity=0 = `divergentCards === 0`。

クラスタ別帰属(CR 接地・修正側):

| Cluster | 枚 | 帰属 | 修正側 | CR 根拠と内容 |
| --- | ---: | --- | --- | --- |
| cast\|runtime-only | 70 | runtime-FP **+** research-FN(混在) | 両 | **runtime-FP**: 別誘発(combat-damage/attacks/etb/dies/起動型)の効果文 "you may cast a spell" を `trigger.cast` が誤検出(CR 603.1=族は誘発条件で決まる)。runtime の cast 検出を**誘発条件内に限定**。**research-FN**: 箇条書き `•`・Saga章 `II, III —`・能力語接頭辞・持続時間前置 `Until …, whenever you cast`・反射/遅延 `When you next cast`/`When that mana is spent to cast`(CR 603.1/603.12 反射誘発)を research が行頭規則で落とす。research を非行頭誘発に拡張。 |
| enters\|research-only | 36 | runtime-FN | runtime | CR 603.6a。runtime `trigger.etb(-other)` 正規表現が単数 `enters` のみで複数形 `enter`(`one or more … enter`)を落とす。複数形・watcher を追加。 |
| dies\|runtime-only | 33 | research-FN | research | CR 700.4/603.7。遅延誘発 `When that creature dies this turn` や `{TK}`/箇条書き接頭辞後の死亡誘発を research が行頭規則で落とす。非行頭・遅延誘発に拡張。 |
| attacks\|runtime-only | 29 | research-FN | research | CR 508.1m/508.3。箇条書き・Saga・忠誠度 `+1:` 後置・`{TK} —` 接頭辞の attack 誘発を research が落とす。非行頭誘発に拡張。 |
| enters\|runtime-only | 21 | research-FN **+** runtime-FP(混在) | 両 | **research-FN**: 箇条書き/`{TK}`/能力語 `Avalanche! —` 接頭辞の enters 誘発を research が落とす。**runtime-FP**: `enters with/as` 置換(CR 603.6d=静的能力、誘発でない)を runtime が `trigger.etb-other` 誤検出(例 Wildgrowth Archaic「that creature enters with X counters」)。runtime を置換 `enters with/as` 除外へ。 |
| dies\|research-only | 15 | runtime-FN | runtime | CR 700.4/603.2c。複数形 `one or more creatures die` を runtime が単数中心で落とす(`isDiesCondition` は複数を拾うが `classifyBattlefieldDepartureTriggers` の死亡発火が `put into a graveyard from the battlefield` 語形に限定され `die` を取りこぼす)。複数形 `die` 発火を追加。 |
| leaves\|runtime-only | 13 | research-FN | research | CR 603.6c。明示 `When that token leaves the battlefield`(遅延)・`artifact or creature is put into a graveyard from the battlefield`(語順 `artifact or creature`)を research が落とす。非行頭遅延 leaves と混在主語語順を追加。 |
| attacks\|research-only | 6 | runtime-FN | runtime | CR 508.3b/508.4。受動 `enchanted player is attacked`(Curse 系)を runtime `attacks?` が `attacked` 不一致で落とす。カード名内のピリオド(`Mr. Foxglove`)が `[^,.]*` を分断。受動 `is attacked` と名前マスキングを追加。 |
| draw\|mixed | 2 | runtime-FN(Trouble in Pairs)**+** research-FN(Starving Revenant) | 両 | CR 121.1/603.1。**runtime-FN**: カンマ列挙 `draws their second card each turn` を runtime が落とす。**research-FN**: 能力語+数字 `Descend 8 — Whenever you draw` を research の接頭辞剥離(数字非対応)が落とす。 |

**追加で確定した runtime-FP(enters クラスタ横断・別系統)**: 能力語 `Landfall` 単独キーワード一致(`/\blandfall\b/`)が、誘発でない一回限り呪文(`Landfall — If you had a land enter … this turn`=介在条件、例 Groundswell/Searing Blaze)で `trigger.landfall` を誤検出。CR 603.6a の上陸誘発は `Whenever a land … enters` 構文に限る。runtime の上陸検出を `LAND_ENTERS_TRIGGER_PATTERN` 相当の誘発構文へ限定し、裸の `landfall` キーワード一致を除去。

**research 拡張の統一機構(research-FN 群の根治)**: `stripAbilityWordPrefix` を能力語の数字・終端記号(`Descend 8 —`/`Exterminate! —`/`Do You Like Squirrels? —`)対応へ拡張し、`triggerStartIndices`/`triggerSegments` を箇条書き `•`・`{TK}`/`{cost}` 接頭辞・忠誠度 `+1:`・モード/持続時間前置の非行頭誘発、および反射/遅延誘発(`When you next …`/`When that … dies this turn`)を認識へ拡張。`enters or attacks` 等の列挙誘発も両族を立てる。**これは Slice2 凍結候補(`eventClassify`)の改変**ゆえ、`review.event-coverage`/`review.event-oracle` の Fable ゴールド維持を必須回帰ゲートとし、変更後に `event-coverage` churn と凍結 `predictions.json`(promptHash 不変)への `event-oracle-diff` 再実行(機械的・LLM 不要)で Slice2 KPI 非悪化を確認する。

**回帰ゲート(本ゲート専有)**: `review.classifier-parity`(Fable author)が**コーパス全数 `divergentCards === 0`** を主張し、各クラスタ代表カードの一致を pin する。併せて `review.event-coverage`/`review.event-oracle`/`review.golden-replay`/`review.classifier-corpus` を緑に保つ。

### 34.7.4 ゴールデン再生 実デッキ加重(M-GATE-3・条件5=緑への手順)
条件5 の現況 BLOCKED の正体は **2つの欠落**:(a)13ケースは少数・無加重で「実デッキ加重」を満たさない、(b)各ケースの
検証不能を自由文字列 `limitations[]` で表し、**scope-boundary(§34.5 で構造的に対象外)/ runtime-gap(閉じられる)/
既に検証済の注記** を区別なく全部「検証不能」へ数えるため率が 69.23% に膨らむ(例:`03-…-watcher` は M-GATE-2 で
watcher 自動検出済みだが説明文字列が残るだけで検証不能計上)。M-GATE-3 はこの両方を解く。**`src/engine/` の盤面公開挙動は
不変**(本ゲートは計測+分類器の成熟であって新ルールの追加ではない)。

**(1) 構造化検証可能性(自由文字列の置換)** — `src/engine/goldenReplay.ts`:
```ts
export type GoldenUnverifiableKind = 'scope-boundary' | 'runtime-gap';
export interface GoldenUnverifiable {
  kind: GoldenUnverifiableKind;
  reason: string;   // 何が検証できないか
  ref: string;      // 接地: scope-boundary は §34.5 or CR 条文 / runtime-gap は修正対象シンボル or CR
}
// GoldenReplayCase に追加:
//   unverifiable?: GoldenUnverifiable[];  // 空 or 未指定 = 完全検証済(verified)
//   notes?: string[];                     // 説明専用・検証可能性に算入しない
// 旧 `limitations?: string[]` は廃止(全ケースを unverifiable[]/notes[] へ移行)。
```
ケース分類(決定的・純関数):
- `verified` = `unverifiable` が空。盤面遷移(events→誘発→スタック解決→SBA→期待盤面)が完全再現。
- `pureScopeBoundary` = `unverifiable` 非空 かつ 全エントリ `kind==='scope-boundary'`。
- `runtimeGap` = `unverifiable` に `kind==='runtime-gap'` を1つ以上含む。
- **作問規律**: 1ケース=1機構に分離する。scope-boundary と runtime-gap を**同一ケースに混在させない**(混在は分割)。

**(2) scope-boundary の正本接地(§34.5)** — 以下は分母から除外し別枠報告(凍結を律しない):
相手ライブラリ/ゾーン未モデル(`opponentLife` 以外の相手領域は非モデル=mill/相手ドロー)・攻撃宣言が store action(`declareAttack`、
GameCommand でなく §25.3)・プレイヤー対象 manual(`target player/opponent`=spec 1574)・層依存/置換相互作用/特殊タイミング/
サブゲーム/周辺型(§34.5 列挙)。これらに**のみ**依存するケースは `scope-boundary`。

**(3) 閉じられる runtime-gap(在圏・T5 達成のため Codex が潰す)**:
コンパイラ/分類器の成熟で検証可能化できるもの。例 = 複合効果(`gain life and draw` 等)が non-auto compile で盤面差分を作らない・
guided 据え置きが本来 auto 可能なアトム列。Codex は本サンプルが露呈した runtime-gap を、**研究⇄runtime parity(条件6=0)と
`review.*` 回帰を壊さない範囲で** 潰し verified を増やす。潰せない構造的事由は scope-boundary へ再分類(CR/§34.5 引用必須)。

**(4) 実デッキ加重サンプル** — `research/golden-replay/cases/*.json`:
- 4デッキ(`Mydeck/{Celes,Gogo,Kefka,Muldrotha}.txt`)の**反復効果カード**(誘発型/起動型の recurring)から作問。
- **加重** = 各デッキの反復効果カード母数に概ね比例(±許容)。**最小標本 = 各デッキ ≥ 8・合計 ≥ 32**(初期・改訂可)。
- 各ケースは初期盤面+コマンド列+`expectedEvents`/`expectedTriggerCandidates`/`expectedFinalState` を持ち、
  `unverifiable[]`(あれば構造化)+`notes[]` を付す。カード文言は snapshot/実 oracleText に一致させる。

**(5) ゲート配線** — `scripts/m-contract-gate.ts` `buildConditionFive` + `scripts/lib/mContractGate.ts`:
構造化検証可能性から `inScope = total − pureScopeBoundary`・`verifiedInScopeRate = verified在圏 / inScope` を集計。
`status = (inScope ≥ 最小標本 && verifiedInScopeRate ≥ 0.70) ? PASS : FAIL`(BLOCKED 固定を撤去)。
`note` に `total/verified/pureScopeBoundary/runtimeGap/perDeck` を内訳明示(残存 runtime-gap は別枠=§3 緑非混入)。
`research/golden-replay/report.md` も新内訳(kind 別・デッキ別)で再生成。`npm run m-contract-gate` で scorecard 再生成。

**回帰ゲート(本ゲート専有)**: `review.golden-replay`(Fable author)を実デッキ加重・構造化検証可能性・T5 集計へ更新し、
**全ケース pass(差分0)+ kind 別不変条件 + デッキ網羅 + verifiedInScopeRate ≥ 0.70 + 最小標本** を pin する。
併せて `review.classifier-parity`(条件6=0 不変)/`review.classifier-corpus`/`review.event-coverage`/`review.event-oracle`/
`review.m-contract-gate` を緑に保つ(runtime-gap を潰した副作用で parity/被覆を悪化させない)。

### 34.7.5 CR-conformance 物差し + post-yardstick churn(M-GATE-4・条件4+条件3=緑への手順)
条件4(非LLM独立物差し)と条件3(モデル churn < 5%)は**設計上一体**。`engine-design-method.md §4` の churn 鉄則=
「下面抽出*単独*の低 churn は収束ではない。収束シグナルは『**新しい独立物差しを当てても崩れない低 churn**』のみ」。
条件4 が建てる **CR-conformance 物差し**がその「新しい独立物差し」であり、条件3 の honest な値=この物差しを当てた直後に
誘発される churn。よって **条件4(物差しを建てて当てる)→ 条件3(誘発 churn を測る)** の順で解く。**`src/engine/`/`src/data/` の
盤面公開挙動は不変**(計測+研究分類器の成熟であって新ルール追加でない。runtime 側 CR 違反は M-GATE-2 で解消済・条件6 parity=0 が非回帰保証)。

**(1) CR-conformance gold コーパス** — `research/cr-conformance/gold.json`(Codex 草稿 → **Fable 裁定**・CR 引用必須):
```ts
export type CrAxis = 'layer' | 'event-family' | 'zone-transition' | 'timing';
export interface CrGoldEntry {
  oracleId: string;        // snapshot 接地(再現可能・churn と同じ key)
  cardName: string;
  oracleText: string;      // 抜粋可・正本は snapshot
  axis: CrAxis;
  expected: string[];      // CR 由来の決定論的期待ラベル集合(軸語彙=LayerId/EventFamily/ZoneId/TimingStep)
  crRule: string;          // 例 "CR 700.4" / "CR 603.6a"(rule/...txt 引用必須=§3 鉄則の物差し版)
  rationale: string;       // なぜ CR がこのラベルを一意に決めるか
  scopeBoundary?: boolean;  // §34.5 対象外=分母から別枠(凍結を律しない)
  allowance?: { crRule: string; rationale: string };  // 両側 CR 上正当な粒度差のみ(silent 禁止・CR 引用必須)
}
```
- 17,491 snapshot から **4決定論軸で層化サンプル**した代表集合(**≥150枚**目安・各軸を被覆)。deck 加重でなくコーパス代表性で採る
  (deck 加重は条件5 の役割)。既存 `research/cr-conformance-audit.md` の所見(destroy/sacrifice=701.8a/701.21a・dies=700.4・
  leaves=603.6c・landfall・layer=613)を CR 引用の出発点に使う。`expected` は **CR 条文が一意に決める決定論ラベルのみ**(解釈的・曖昧は
  gold に入れない=LLM を当てない=相関遮断)。

**(2) ハーネス** — `scripts/cr-conformance.ts` + 純関数 `scripts/lib/crConformance.ts`(分類器・物差しを**再実装しない**):
- 各 gold エントリの `oracleId` で snapshot カードを引き、軸に対応する研究分類器(`classifyCardLayers`/`classifyCardEvents`/
  `classifyCardZones`/`classifyCardTiming`)を走らせ、出力ラベル集合と `expected` を**集合比較**(`missing`/`extra`)。
- 純関数: `compareGoldEntry(expected, actual) → { conformant: boolean; missing: string[]; extra: string[] }`
  (`conformant = missing.length===0 && extra.length===0`=集合一致)、
  `aggregateConformance(entries[], threshold) → { total; inScope; scopeBoundary; conformant; divergent; conformanceRate; bounded; perAxis }`。
  `inScope = total − scopeBoundary`。**allowance 付き不一致は conformant に数えない**(分類器は expected と異なる)が divergent からは除く。
  `divergent = inScope のうち !conformant かつ allowance 無し`(= PASS を阻む silent 乖離)。
  `conformanceRate = conformant / inScope`(=素で CR 一致した割合。allowance はここに含めない=閾値が効く)。
  `bounded = divergent === 0`(残存不一致が全て scopeBoundary か CR 引用 allowance で説明=条件6 の `divergentCards===0` と同型)。
- 出力 `research/cr-conformance/report.{json,md}`(再現可能・監査可能):
  `summary = { totalCards, inScope, scopeBoundary, conformant, divergent, conformanceRate, bounded, churnBaselineCommit }`・
  軸別内訳・**不一致リスト(per-card: oracleId/axis/expected/actual/missing/extra)**。`churnBaselineCommit` は条件3 の baseline commit を記録。
- `package.json` に `"cr-conformance": "tsx scripts/cr-conformance.ts"` を追加。

**(3) 不一致裁定(Fable)**: Codex が出した不一致集合**のみ**を裁定し、語彙へ帰属=
`classifier-fn`/`classifier-fp`(該当 Slice 分類器を CR に合わせて修正)・`gold-error`(gold を CR で訂正)・
`scope-boundary`(§34.5・gold に `scopeBoundary:true`)・`granularity-allowance`(両側 CR 正当・`allowance` 付与)。
`*Classify.ts` 改変は Slice 凍結候補の改変ゆえ `review.{event,zone,timing,layer}-coverage`/`-oracle` の Fable ゴールド非悪化を必須回帰ゲートにする。

**(4) ゲート配線・条件4** — `buildConditionFour`(`scripts/m-contract-gate.ts`)+ `REPORT_PATHS.crConformance`:
ハードコード BLOCKED を撤去。`research/cr-conformance/report.json` を読み `judgeCondition` で決定的判定=
`status = (conformanceRate ≥ 0.95 && bounded === true) ? PASS : FAIL`。`note` に `inScope/conformant/divergent/scopeBoundary/perAxis` を内訳明示。

**(5) post-independent-yardstick churn・条件3**(§4 honest churn の手順・**trivial 再ベースライン禁止**):
- coverage harness の churn は「現分類 vs 直前 `report.json`(`oracleId` keyed)」。よって honest 手順=
  **(a)** baseline = 本 MS の CR 修正を当てる**前**の coverage `report.json`(=現コミット状態。commit を `churnBaselineCommit` に固定)。
  **(b)** 条件4 の裁定で確定した CR 駆動の分類器修正**のみ**を当てる(これが「物差しを当てる」)。
  **(c)** 4 coverage harness を**各1回**実行 → churn = baseline からの誘発差分。**no-op 再実行で 0 へ落とす操作は禁止**
  (=§4 偽収束 trap。baseline と計測の間に介在してよい分類器変更は CR 修正だけ)。
- 一回限り意図再分類(iter3-b 墓地 +1945)は既に baseline(現コミット `report.json` の cards)へ畳み込まれており、
  今回 churn には混ざらない(=「4スライス同時 post-yardstick スナップショット未取得」という計測欠落の清算)。
- 配線: `buildConditionThree` は現行どおり 4 coverage の `churn.rate` 最大値を採る(パス不変)が、`note` に
  **「CR-conformance 裁定後・baseline=`churnBaselineCommit` に対し測定」**を明記し gameable でないことを担保。
- **収束判定(Fable)**: 4スライス同時 churn < **5%** かつ「物差し適用後」を確認して PASS と裁定。honest さは条件4 conformance と
  **相互校正**(高 conformance + 低 churn = 物差しを当てても崩れない真の収束)。churn が立つなら**非収束の発見**として
  追加分類器修正の反復へ回す(糊塗しない)。

**(6) ゲート再生成・全7条件確認**: `npm run cr-conformance` → 4 coverage harness 再実行 → `npm run m-contract-gate` で
`research/m-contract-gate/scorecard.{md,json}` 再生成。条件3=PASS(churn<5%)・条件4=PASS・総合 **FROZEN** を確認する。
ただし 2026-06-26 の M-CR-RECONCILE 以後は、これに加えて §34.0 の CR-grounding gold(統率者税/マナ能力/トークン/誘発SBA優先権/領域移動LKI)が実行可能化されていることを M-FREEZE 条件に追加する。
FROZEN 確認後に §34.7.1 現況ブロックを更新(全7緑 + CR-grounding 緑 → M-FREEZE へ)。**§34 本体の凍結 draft 解除は別 MS(M-FREEZE)**。

**閾値(Fable 確定・初期・改訂可)**: 条件4 conformance ≥ **95%** かつ bounded。条件3 churn < **5%**(§34.7.1 既定)。

**回帰ゲート(本ゲート専有)**: `review.cr-conformance`(Fable author)= `crConformance.ts` 純関数(集合比較・集計・bounded 判定・条件4 judge)の
論理を pin + gold 代表カードの CR 接地期待を 4分類器の実出力で pin(物差しの歯)。併せて
`review.{event,zone,timing,layer}-coverage`/`-oracle`(Slice 分類器修正の非悪化)・`review.classifier-parity`(条件6=0 非回帰)・
`review.golden-replay`(条件5 非回帰)・`review.m-contract-gate`(集計ロジック)を緑に保つ。機械4点も緑。

### 34.8 本マイルストーン(M-CONTRACT=凍結)の不変・スコープ
**契約のみ。エンジン/UI/store・既存テストは一切変更しない**。成果物は本章(engine-spec §34)+ `docs/architecture-substrate-compiler.md`(WHAT)+ `docs/engine-design-method.md`(HOW=設計手法)+ `CLAUDE.md` L35 改定。機械チェック4点(`npm run lint`/`npx tsc --noEmit`/`npx vitest run`/`npm run build`)は docs/規約変更ゆえコードパス無関係で自明に不変。`review.*` テストは追加しない(コードが無い)。実装は M0 収束後に S-EVENTS から着手する。

2026-06-26 追記: M-CR-RECONCILE では `rule/` の固定CR、`docs/` 契約、`research/cr-grounding/` gold、`src/engine/grammar/rule-refs.ts` の 701.69 追加を変更する。これは凍結判定の撤回と再整合であり、S-EVENTS 実装ではない。

### 34.9 M0 進行(モデリング・サイクルの反復ログ)
- **M0-1(有効特性 + 層オントロジー)進行中(2026-06-23〜)**: ESO/カタログを新設(`docs/engine-state-ontology.md` / `docs/oracle-grammar-catalog.md`)。層スライス(L1〜L7+CDA)の上面骨格を確定し、下面分布は計測専用スクリプト `layer-coverage`(`scripts/layer-coverage.ts` + `scripts/lib/layerClassify.ts`、`research/layer-coverage/` へ出力)が埋める。盤面挙動・エンジン公開挙動は不変(分類器は計測用で `src/engine/` には触れない)。runtime の `computeEffectiveCharacteristics`(S-LAYERS)は M-CONTRACT 凍結後。
  - **iter1-3(2026-06-23)**: 下面抽出→ギャップ閉鎖(L6引用能力/L4条件付否定/L7c乗算/L7bアニメート)→ churn 初算出 0.68%。adjudication 1,396→912。スライス1の層モデルは安定方向(凍結は全4スライス一巡後)。
- **M0-O1(LLM-oracle 盲予測ハーネス・物差しトラック)着手(2026-06-23〜)**: §34.7 の主指標(オラクル間不一致率・帰属分布・物差し校正・検証不能率)を**初稼働**させる。契約 = `docs/oracle-harness.md`。M0-1 の層分類(`layerClassify`)に **Fable と相関しない独立ルーラー**を当てる:オラクルへ CR/「層」を見せず平易な挙動ファクトのみを盲予測させ(**Codex が clean-room 実行** = 別主体・別プロセスで相関遮断)、ファクト→層の写像と差分/KPI は機械的・決定的(`scripts/lib/oracleHarness.ts` + `scripts/oracle-sample.ts` + `scripts/oracle-diff.ts`、`research/llm-oracle/` へ出力)。iter1 は約200枚の層化サンプル(頭+多層+adjudication+ゴールド21)。採点 = `review.oracle-harness`。盤面挙動・エンジン公開挙動は不変(`src/engine/` 不変)。結果は ESO の trust 列(層別:一致=検証済/割れ=不一致/uncertain=検証不能)へ Fable が反映。
- **M0-O2(Slice2 イベント語彙オラクル・物差しトラック)着手(2026-06-23〜)**: Slice2 下面抽出(`event-coverage`、commit d852b9b 収束)に**独立物差し**を当てる。§34.7 主指標をイベント語彙(誘発族/観測者/介在条件)へ適用。契約 = `docs/oracle-harness.md` §7(Slice1 物差し設計の `facts` schema 差し替え流用)。族/観測者は観測可能事象そのものゆえ**写像は恒等**(層のような隠れタクソノミ写像は無い)。**Codex clean-room** が oracleText のみから `EventFacts`(族集合・観測者集合・介在条件)を盲予測 → 分類器(`eventClassify`)と**3軸独立の集合差**で比較(`scripts/lib/eventOracleHarness.ts` + `scripts/event-oracle-sample.ts` + `scripts/event-oracle-diff.ts`、`research/event-oracle/` へ出力)。iter1 は約192枚層化(gold18+head+multi-family+observer+tail)。採点 = `review.event-oracle`。`src/engine/` 不変。結果は ESO Slice2 trust 列へ Fable が反映、family/observer 不一致率・churn・被覆で Slice2 継続 or Slice3 前進を判断。
  - **iter3 完了(2026-06-24・commit bcec4ed)**: ESO 境界3裁定 + compiler9 修正で family 0.49%/observer 0.00%/不一致 1 件へ収束(Slice2 凍結候補)。詳細は [[m0-1-layer-slice-progress]]。
- **M0 手法改訂(2026-06-24・本コミット)= decorrelated 批評(§8.1 別主体への戦略批評)を歯のあるゲート改訂へ変換**: 別 LLM の批評を Fable が裁定し、`engine-design-method.md` と本 §34.7/§34.7.1 を改訂。要点 = (a)churn 定義に「独立物差し通過後の低 churn のみ収束」を明記(Slice2 偽収束 0.05%→真 13.55% を precedent 化)(b)凍結ゲートを 3→**7 条件**へ厳格化(Slice3/4 一巡 + 実行計測ゴールデン再生 + 非LLM物差し + 分類器 parity=0 + 検証不能率)(c)非LLM独立物差しを凍結前の**要件**へ昇格(d)研究⇄runtime 分類器 parity を契約化。実装(ゴールデン再生ハーネス・分類器 parity 計測器)は Codex 背景発注。**結論: Slice1+2 のみでは凍結しない。次 = Slice3(ゾーン+プレイヤー)前進と条件4〜6 の計測器整備。**
- **M0-Z(Slice3 ゾーン+プレイヤー)進行中(2026-06-24〜)**: 5軸(E-ZONE-REF/PARTITION/CROSS/OWNER・CONTROLLER/PLAYER-SCOPE)。下面抽出 = `zone-coverage`(`scripts/lib/zoneClassify.ts`)、独立物差し = `zone-oracle`(`docs/oracle-harness.md` §8・別主体 clean-room 盲予測)。`src/engine/` 不変(計測専用)。
  - **iter1(commit cf95600/5e72c8d)**: 下面抽出クロス率 0.74% は照応 FN で過小評価。独立物差し(v1・promptHash 82483561)で実証 → 帰属 substrate0/compiler21/oracle21/ambiguous19。
  - **iter2(flip-flop 2手・2026-06-24・監査合格)**: **iter2-a(ルール半・commit d2e28d0)** = 物差し凍結のまま `zoneClassify` の cross 照応/battlefield FN/owner 語彙を修正。churn 17.45%(独立物差しへ収束する方向)。crossPlayer 不一致 6.42→0.53%(oracleOnly 12→0)・ownership 5.88→3.74%。gold `review.zone-coverage` 25/25。敵対監査=過剰発火0。**iter2-b(物差し半)** = ルール凍結のまま §8.2 prompt を v2 へ(cast≠stack/`<X> you control`→you/MDFC 全面/uncertain 促進)→ 同一 sample を clean-room 再予測(promptHash e5930f9e)。v2 は狙い達成(cast→stack 過剰消滅・playerScope 13.90→10.16%・ownership→2.67%・uncertain 0→11.64%)。**だが zone 19.25→22.99% = より良い物差しが新クラスタ2つを露呈**: (1)**compiler 38 = 暗黙のゾーン移動 FN**(draw→hand/discard→graveyard/dies→graveyard/bare permanent bounce→battlefield)= iter3 ルール種 (2)**oracle 14 = v2 prompt の過剰補正2**(静的 read battlefield + recipient-scope 脱落)= prompt v3 種 /ambiguous 7 = owner 境界。**substrate=0 維持**。正本 = `research/zone-oracle/adjudication.json`(M0-Z-O-iter2)。**Slice3 未収束**。**E-ZONE-REF 定義確定(Fable)= 移動/探索志向**(静的 permanent read は非参照)。次 = iter3(ルール半=暗黙移動)+ prompt v3(過剰補正2の是正)。
  - **iter3-a(commit 1e38973)**: 暗黙移動(draw/discard/dies/bare-permanent bounce)を分類器に追加。zone 22.99→10.70%・crossPlayer→0%。churn 20.35%。
- **M0 手法改訂(2026-06-24)= CR を一次の決定論的権威に(`engine-design-method.md` §3 新節)**: ユーザー批評(「CR 軽視・LLM 物差しで決定論的問いを予測している」)を Fable が裁定。
  M0 の問いを**決定論的(CR が一意に答える=ゾーン遷移/owner・controller/キーワード/SBA)** と **解釈的(認識・曖昧)** に弁別し、**権威順序 = CR > 人間 gold > LLM-oracle(解釈・相関遮断のみ)**。
  決定論的軸は CR 真理テーブルで分類器・gold・オラクル prompt の三者を**同時に anchor**(外部真理ゆえ flip-flop 交絡なし)。CR 真理テーブル = ゲート条件4(非LLM独立物差し)の canonical 実体。
  precedent = Slice3 で「sacrifice→graveyard か」を物差しで判じ prompt を3回再走し誤収束しかけた(CR 701.21a 一行で即決)。
- **M0-Z iter3-b(CR 基盤化・2026-06-24・監査合格)**: 上記手法を適用。**🔴 iter3-a 分類器の CR 違反を是正** = destroy(701.8a)/sacrifice(701.21a)は `battlefield→owner's graveyard` ゆえ
  `graveyard` を欠落していた FN(churn 11.86%・graveyard +1,945)。CR 真理テーブル(ESO「iter3 CR ゾーン遷移真理テーブル」)を正本に分類器修正 + gold CR-truth 化(Doom Blade/Fling)+ prompt v4(CR 写像明示)。
  オラクル v4 差分: zone 6.95%(CR 誤り初稿 25.67% から解消)/crossPlayer 2.67%/ownership 2.67%/playerScope 8.02%/unverifiable 5.29%。帰属 substrate0/compiler18/oracle5/ambiguous9(残差=解釈的・小粒)。
  **CR 準拠監査**(`research/cr-conformance-audit.md`)= runtime `triggers.ts` `trigger.death` が CR700.4 違反(`put into a graveyard` が「from the battlefield」非限定で mill/discard を死亡誤検出・parity 計測済・別タスク化)+ `trigger.landfall` 緩い。SBA/owner・controller/ゾーン分割の不在は設計(サンドボックス+substrate 未実装)。**Slice3 は CR 接地で実質収束方向。次 = Slice4 前進可**。
- **M-GATE-4(条件4+条件3 緑化 → 凍結到達・2026-06-25・監査合格)= 手法 §34.7.5**: 条件4(非LLM独立物差し)を散文監査から**機械可読 CR 真理テーブル**へ昇格。
  Codex が代表160枚(4軸×40・各エントリ CR 条番号付き)gold を草稿し `crConformance.ts`/`cr-conformance.ts` harness を構築 → conformance 98.75%・divergent 2 を Fable へ提出。
  **Fable 裁定**: 2件(`Acrobatic Cheerleader`/`Cautious Survivor` の "Survival — At the beginning of your second main phase")は CR 505.1a で main-postcombat が一意=**classifier-FN**(gold 正)。
  根因 = `timingClassify` の beginning 抽出が能力語接頭辞の em-dash 後を拾わず**125枚規模の juncture FN**(`Survival/Revolt/Raid/Celebration — At the beginning of …`)を毎反復同一に取りこぼし(§4 構造的 FN の典型)。
  外科的1行修正(beginning パターンに `—\s+` 接頭辞アンカー追加)で conformance **100%・bounded**。`review.timing-coverage`/`-oracle` 無回帰。
  **条件3 post-yardstick churn**: CR 修正適用後に 4スライス同時スナップショット(baseline=`04184e4`)= layer 0%/event 1.95%/zone 0%/timing 0.82% → max **1.95% < 5% PASS**。
  event 1.95% は M-GATE-2 eventClassify の CR 修正が未スナップショットだった分の清算(計測欠落の解消)。**高 conformance + 低 churn = 物差しを当てても崩れない真の収束**(§4)。
  全7条件 PASS=**スコアカード FROZEN**。`src/engine/` 盤面挙動不変・機械4点緑・`review.cr-conformance` 緑。**当時の次手 = M-FREEZE(§34 凍結手続き → S-EVENTS)**。
- **M-CR-RECONCILE(2026-06-26・本追補)**: 上記 FROZEN は分類器/既存 replay の研究成果としては有効だが、CR 状態遷移 gold が不足していたため凍結根拠として撤回。CR 2026-06-19 へ固定し、§34.0 と `research/cr-grounding/golden-cases.json` を追加。次手は M-FREEZE ではなく、CR-grounding gold の実行可能化と scorecard 再判定。
