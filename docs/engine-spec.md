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
- I2: 非トークンカードの総数はゲーム中一定(= デッキ枚数)。トークンは `battlefield` 以外のゾーンに移動した時点で `cards`/`zones` から消滅する(消滅をログに記す)
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
- **moveCard**: `position` は移動先ゾーン配列内の挿入位置。`'top'` = index 0。battlefield 行きは常に末尾追加でよい(UIが並び順を管理しない)。ゾーン移動時に `tapped=false, faceDown=false, faceIndex=0, counters={}, attachedTo=undefined` にリセット(battlefield → battlefield 内移動は対象外)。トークンが battlefield 外へ → 消滅(I2)
- **castSpell**: 手札(または指定ゾーン—v1は手札のみ)から、`typeLine` に `Instant`/`Sorcery` を含むなら graveyard へ、それ以外は battlefield へ移動し、`payment` をプールから減算。プール不足分があるのに `forced=false` ならコマンド拒否ではなく **payment はソルバ計算済みが前提**なので、エンジンは payment > pool の場合 pool を下限0でクランプし warning を返す
- **castCommander**: castSpell と同様 + 対象が commanders に含まれることを検証し `castCount += 1`。統率領域からのみ
- **nextPhase**: `PHASE_ORDER` の次へ(end の次は turn+1 の untap)。**untap 進入時**: battlefield 全カードを `tapped=false`。**draw 進入時**: 1枚ドロー(ただし turn===1 ではドローしない=先手想定。設定パラメータ化は store 層の責務外、v1 固定でよい)。フェイズ遷移時にプールをクリア(I5)
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
sourceId?: string;                         // 能力の発生元パーマネント instance id(表示用に defId を流用)
abilityKind?: 'activated' | 'triggered';   // リボン表示用(起動/誘発)
```
- 能力オブジェクトは `zones.stack` **以外には存在しない**。解決/除去で `cards`/`zones` から削除する(別ゾーンへは移動しない=トークンの消滅則と同様)。
- 表示は `defs[sourceId の defId]` を流用(`defs` に新規 def は追加しない)。

### 12.2 コマンドの追加(`src/engine/commands.ts`)
既存の `moveCard` は `to:'stack'` を**そのまま受理**する(ゾーンが増えただけ)。ドラッグでカードを中央へ置く操作は `moveCard(cardId,'stack')` で表現し、新コマンドは不要。マナは払わない(手動配置=サンドボックス)。

```ts
| { type: 'castToStack'; cardId: string; payment: ManaPool; forced: boolean }
//   castSpell と同様にプールから payment を減算(不足は 0 クランプ + warning)。
//   ただし行先は最終ゾーンではなく stack 末尾(最上段)。ETB フックは走らない(stack は battlefield ではない)。
//   対象が現在 command ゾーンにあり commanders に含まれる場合のみ castCount += 1(統率税は cast 時に確定)。
//   ログ「《X》を唱えた(スタックへ)。」。手札以外/統率領域以外からの cast も拒否しない(サンドボックス)。

| { type: 'addAbilityToStack'; sourceId: string; kind: 'activated' | 'triggered' }
//   sourceId が cards に存在することを検証(無ければ EngineError)。新しい能力オブジェクト instance を生成:
//   id は既存 id と衝突しない決定的な新規 id(接頭辞 'a'。token の 't{max+1}' と同方式の連番)、
//   isAbility=true, abilityKind=kind, sourceId, defId=cards[sourceId].defId, zone='stack',
//   tapped=false, faceIndex=0, faceDown=false, counters={}, isToken=false, isCommander=false, enteredTurn=0。
//   stack 末尾へ append。ログ「《X》の{起動|誘発}能力をスタックに積んだ。」(X=発生元カード名)。

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
- **新 I9**: `isAbility === true` の instance は必ず `zone === 'stack'` であり、`sourceId` が `cards` に存在し、`defId` が `defs` に存在する。能力オブジェクトは `stack` 以外に出現しない。
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

## 15. M4.31 追補(統率税のタイミング変更)— この節も契約である。**§12.2 のキャスト時加算を置換する**

設計指針: ユーザー期待「統率者を**統率領域に戻した時**に統率税が上がる」を満たしつつ、通常サイクル(唱える→死亡→戻す→再キャスト)の税列を MTG と一致させる。`castCount` の加算契機を**キャスト時から"戻し時"へ移動**する。

### 15.1 加算契機の変更(`src/engine/commands.ts`)
- `moveCardInternal`: 移動先 `to === 'command'` かつ 移動元 `from !== 'command'` かつ `isCommander(draft.state, cardId)` のとき、その統率者の `castCount += 1`。ログ「《X》が統率領域に戻り統率税が上がった。」。
  - `commanders` 配列の該当 `cardId` のみ更新(パートナー2体は独立)。
- `applyCastToStack` の `fromCommand` 判定による `castCount += 1` ブロックを**削除**(§12.2 の該当挙動を無効化)。`spellsCastThisTurn += 1`(§14)は維持(ストームはキャストで数える)。
- 既存 `castCommander` engine コマンド(M4.29 以降 UI 未使用)は据え置き。新規 UI からは呼ばない。

### 15.2 税コスト・表示
- `commanderTax(state, cardId) = 2 * castCount`(`src/engine/commander.ts`)は不変。
- 税列: 初期配置(command、castCount 0)→ 初回キャスト +0 → 死亡して戻す(castCount 1)→ 再キャスト +2 → 戻す(2)→ +4 … と MTG 準拠。
- init.ts の初期配置は `moveCardInternal` を通らないため castCount=0(加算されない)。

### 15.3 不変条件
- 既存の castCount>=0 を維持。新規不変条件は不要(契機変更のみ)。
- **レビューテスト更新**: 旧「`castToStack` from command → castCount+1 / 税+2」は本変更で無効。`review.m428` の該当アサーションを新モデル(`moveCard` to `command`(from 非command)で +1、`castToStack` では +0)へ書き換える(Fable)。`review.m431` で新モデルを独立採点。

---

## 16. M6.1 ルール分類器 + デッキ別ルール補助レポート(データ層契約)

設計指針: **分類・表示のみで `GameState` を生成も変更もしない**。完全ルールエンジン化しない。分類器は `src/data/` の純粋関数で、`src/engine/`・Zustand・DOM・localStorage・IndexedDB に依存しない。M6トラックの第1段。

参照(調査の正本): `research/scryfall-rules/2026-06-19/analysis/oracle-grammar-analysis.md`(MTGオラクル文の定型文法・CR 207/113/6xx/701/702・決定的パースアルゴリズム・Odric非誤検出の根拠)。

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
