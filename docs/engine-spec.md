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
//   全 face の oracleText/printedText を走査し、語境界一致で検出(英 + 日)。
//   日本語対応例: 飛行/警戒/トランプル/接死/絆魂/威迫/先制攻撃/二段攻撃/到達/速攻/呪禁/破壊不能/防衛/護法。
//   reminder 文等による軽微な誤検知は許容(情報表示専用、ルール強制しない)。
//   既存 hasHaste はこの検出ロジックの一部として再利用してよい。

export function hasVigilance(state: GameState, cardId: string): boolean;
//   現在の def の keywords に 'vigilance' を含むか。攻撃補助のタップ判定に使う。

export function landEntersTapped(def: CardDef | undefined): 'always' | 'never' | 'conditional';
//   always: oracle/printed に /enters .*tapped/i または「タップ状態で戦場に出る」を含み、
//           かつ "unless" / "でないかぎり" / "なら" 系の条件節を含まない。
//   conditional: "enters .* tapped unless" / 「〜でないかぎり…タップ状態で」等の条件付き。
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
