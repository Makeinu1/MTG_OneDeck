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

export type Phase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end' | 'cleanup';
export const PHASE_ORDER: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end', 'cleanup']; // §34.50: cleanup は 2026-07-19 に surrogate から実フェイズへ昇格

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

> **注意(2026-07-19 判定者)**: 本節の union は初期契約の抜粋であり、§7 以降・§34 各追補で追加されたコマンド(dealDamage・戦闘系・スタック系・setManualTargets・copy系・token系ほか)は**ここに再掲していない**。全コマンドの正本は `src/engine/commands.ts` の `GameCommand` 型。本節を全体像として引用しないこと。

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
- **nextPhase**: `PHASE_ORDER` の次へ(end の次は cleanup、cleanup で手札上限を満たせば turn+1 の untap まで一気に進む=§34.50)。**untap 進入時**: battlefield 全カードを `tapped=false`。**draw 進入時**: 1枚ドロー(`turn===1` でも引く=EDH/多人数戦準拠。§7.5 の M4.6 改訂でターン1のドロースキップは廃止された)。フェイズ遷移時にプールをクリア(I5)
- **mulligan**: 現在の手札全カードを library へ移し、`order`(手札+ライブラリ全体の新順列)で並べ、`mulliganCount += 1`。その後の draw(7) と putOnBottom(mulliganCount 枚) はストア層が別コマンドとして発行
- すべてのコマンドは適切な日本語 LogEntry を log に追加する

エラー(存在しない cardId、ゾーン不整合な castCommander 等)は `EngineError` を throw。ストア層は捕捉して state 不変のまま、`EngineError` は日本語 warnings へ可視化し、それ以外は実装バグとして console.error に残す(`reportActionError`・2026-07-19)。cast 系 action は例外時 `'error'` を返し `'ok'` と区別する。

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
  activations: AutoTapActivation[];  // 1起動ごとの正確な出力束と追加コストを含むコマンド
  payment: ManaPool;                 // 最終的にプールから引く量(浮き+追加分)
  shortfall: number;
}
export function planAutoTap(state: GameState, cost: ParsedCost, xValue: number): AutoTapPlan;
export function planAutoManaPayment(state: GameState, cost: ParsedCost, xValue: number): AutoTapPlan;
export function autoTapCommands(plan: Pick<AutoTapPlan, 'activations'>): GameCommand[];
```
- `planAutoTap` は ACT-1 契約を維持する純 `{T}` shortcut。追加コストを勝手に払わない。
- `planAutoManaPayment` はキャスト/サイクリングの支払い専用。oracle の起動型マナ能力を候補化し、確定的な追加コストと出力を1 activationとして原子的に計画する(CR 118.3/602.2/605.3b)。条件・用途制限・可変値を安全に評価できない能力は候補に含めない(fake-auto禁止)。
- 盤面依存で決定可能な出力は現在stateを読む: charge counter数、Swamp保有条件、伝説のクリーチャー/プレインズウォーカー/パーマネントの現在面マナ・コスト由来色。生け贄対象が「a creature」で一意に分類できる場合はトークン→非統率者→低mana value→battlefield順で決定し、統率者は最後の候補とする。
- 候補: battlefield の未タップかつ生成可能なマナ束が非空。ただし `isSummoningSick` と `tokenKind === 'treasure'` は除外
- 浮きマナ(state.manaPool)を先に充当し、不足分のみタップ計画
- 出力は1起動単位の正確な束として扱う(`{C}{C}`=2点、`{G}{U}`=同時2色、`three mana of any one color`=選択色3点)。
- 選択方針: 完全支払い可能性 → 自己生け贄/追放・ライフ・自己ダメージの回避 → 支払い後に残る色集合と唯一色源の温存 → 生成色の狭い源を先に使いrainbow/任意色源を最後にする → 非マナ/戦闘価値 → 起動数・過剰生成 → battlefield順の決定的tie-break。
- 色拘束 pip は供給可能ソースが少ない色から割当。**単純貪欲で完全支払いを取りこぼさないこと**(solvePayment と同様、必要ならバックトラック。候補は高々数十、pip は高々十数なので全列挙可)
- ok=false の場合も「最善の部分計画」を返す(強行用)
- 本追補は資源状態②でCodexが暫定起草し、2026-07-18監査済: Fable判定者+冷Sonnet Tier-1で独立再検証(clean)。CR 601.2f-h/602.2/605.3b/118.3照合済。

### 7.8 ストア追加・変更
```ts
playLand(cardId: string, opts?: { force?: boolean }): 'ok' | 'needs-confirm';
//   landsPlayedThisTurn >= 1 && !force → 状態変更せず 'needs-confirm'

crackTreasure(cardId: string, color: ManaColor): void;

// castFromHand / castCommander:
//   solvePayment が不足 → planAutoManaPayment。ok なら autoTapCommands(plan) と cast コマンドを
//   順次 applyCommand し【1回の commit】(undo 1回で全復元)。ログには自動タップの内訳を残す。
//   autotap でも不足 → 従来通り {shortfall} を返し UI が確認(強行=可能な分タップ+部分支払い)

// mulligan(): フリーマリガン。UI が putBottom すべき枚数 = max(0, state.mulliganCount - 1)

// toggleTap / tapForMana: 対象が isSummoningSick なら warning
//   「《X》は召喚酔い中です。」を付与(操作は通す)
```

#### 7.8a 誘発のPrimaryAction直接処理(2026-07-18・資源状態②追補→同日判定者監査済)

- 優先順は stack非空→stack解決、stack空かつready pending triggerあり→誘発処理、それ以外→phase advance。
- 単一かつoracle行にtargetを含まない誘発は `placePendingTriggersForPriority([pendingTriggerId])` へ直結する。PrimaryActionと次フェイズショートカットは同一判定 `triggerDirectAction` を使う。
- 複数誘発またはtargetを含む誘発はFeedでなく専用TriggerSheetへ進む。複数はユーザー指定順を `placePendingTriggersForPriority` へ渡し、既存APNAP検証を迂回しない(CR 603.3b/603.3d)。
- ready pending triggerがある間、`nextPhase`/`nextTurn` はstateを変更せず警告する。シートを閉じてもpendingを消さない。明示的な「無視」はサンドボックスの代替導線にだけ残し、通常の閉じる操作と混同しない。
- 根拠: CR 117.5、603.3、603.3b-d、603.6a。2026-07-18監査済: Fable判定者+冷Sonnet Tier-1で独立再検証(clean)。

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
//   コスト部分を返してよい(UI ゲート用に意図的に緩い)。該当なければ null。
//   reminder文等の軽微な誤検出は許容(情報用)。
//   日本語例: 「サイクリング{2}」。英語例: 「Cycling {2}」「Cycling {1}{U}」。

export interface CyclingInfo { cost: string; keyword: string; isTypecycling: boolean; }
export function cyclingInfo(def: CardDef | undefined): CyclingInfo | null;
//   cyclingCost と同じ走査で、マッチした cycling キーワード語(例 "cycling"/"landcycling"/
//   "plainscycling")と、それが [type]cycling 変種(CR 702.29e)か否かを併せて返す。
//   isTypecycling := keyword.toLowerCase() !== 'cycling'。cyclingCost はこの cost を返す薄いラッパ。
```

### 10.3 ストア(`src/store/gameStore.ts`)で実装する操作
```ts
adjustMana(color: ManaColor, delta: number): void;   // dispatch({ type:'adjustMana', color, delta })

cycle(cardId: string, opts?: { force?: boolean }): 'ok' | { shortfall: number };
//   cyclingInfo(def) を parseManaCost → planAutoTap で支払い計画。
//   ok でない かつ !force → { shortfall } を返し UI が確認(castFromHand と同パターン)。
//   支払い可(または force)後の効果は cycling 変種で分岐:
//     - 素の cycling(CR 702.29a「Draw a card」): 自動タップ群 + discard(hand→graveyard) + draw(1)。
//     - [type]cycling(CR 702.29e。landcycling / basic landcycling / mountaincycling 等):
//       正しい効果は「ライブラリから該当タイプのカードを1枚**手札へ**加え、シャッフル」だが、
//       既存 guided library-search は destination:'battlefield' 固定(hand tutor 未対応)ゆえ
//       **fail-closed**=誤自動化(draw)を行わない。決定論的なコスト部分のみ実行=自動タップ群 +
//       discard(hand→graveyard) を単一コミットし、warning でライブラリ手動サーチ+シャッフルを促す。
//       (北極星「誤自動化≈0」/サンドボックス哲学=支援はするが非自動部分はユーザーに委ねる)
//   いずれも applySequence で【単一コミット】(undo 1回で全復元)。ログ/warning に記録。
//   cyclingInfo が null のカードに対しては no-op('ok')。
//   DEFER: hand 宛て guided tutor(destination:'hand')は別スライス。実装後 [type]cycling を完全自動化する。
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
  untapIfControlLandsAtLeast?: number;                    // 寓話の小道型: tapped で出た後、支配土地が N 枚以上なら untap(CR 条件付きアンタップ)
}
export function fetchAbility(def: CardDef | undefined): FetchAbility | null;
// tapped で出すべきかの最終判定(盤面依存)。entersTapped=false は常に false。
// untapIfControlLandsAtLeast 有り時は「解決後の支配土地数(=フェッチ土地自身を +1 で数える)」が閾値以上なら false(=untap)。
export function fetchEntersTapped(state: GameState, ability: FetchAbility, controllerId: PlayerId): boolean;
```
- 全 face の `oracleText`/`printedText` を `cardTexts`/`splitRulesText` で走査(`cyclingCost`/`landEntersTapped` と同方式)。
- **検出条件**(下記いずれかを満たす起動型能力の存在):
  - 英: `/Search your library for .* (land|basic land) .*/i` かつ put 句 `/onto the battlefield/i` かつ `/shuffle/i`。
  - 日: `あなたのライブラリー` を含み `.*探[しす].*` かつ `戦場に出` かつ `切り直す`。
  - いずれも満たさなければ `null`。
- **entersTapped**: put 句に 英 `onto the battlefield tapped` / 日 `タップ状態で(戦場に)出` を含めば `true`、無ければ `false`。
- **untapIfControlLandsAtLeast**(2026-07-12 追加・寓話の小道型): 英 `/if you control (\w+) or more lands,\s*untap (?:that land|it)/i` を検出したら、その閾値 N を格納(数詞→整数化・最小 one〜ten + 直接数字)。**これは entersTapped=true と共起する条件付きアンタップ**を意味する(`entersTapped=false` のときは付与しない)。検出できなければ `undefined`(欠落)。**読み取りは英語 oracleText を正本**とする(CLAUDE.md 規約。日本語 printedText は表示専用ゆえ本句は英語のみ解析)。日本語のみの文面は `undefined` にフォールバック=常に tapped(誤自動化しない安全側)。
  - `fetchEntersTapped(state, ability, controllerId)`: `entersTapped=false`→常に `false`。`untapIfControlLandsAtLeast` 欠落→`entersTapped` をそのまま。有り時→**解決後の支配土地数**(現在 controller が支配する battlefield の土地数 + フェッチ土地自身の 1)が閾値 N 以上なら `false`(=アンタップして出す)、未満なら `true`。CR: 条件はフェッチ土地が戦場に出た後に評価され、その土地自身も数える。
  - UI(`FetchSearchDialog`)の「タップ状態で出す」チェックボックス既定値は `fetchEntersTapped` で算出する(**サンドボックス**: プレイヤーは常に上書き可)。
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

### 17.3 cr-500-514-turn-structure(CR 500.2/500.3・S-TURN 前半)との関係
本節のスタックブロックは CR 500.2/500.3(優先権のあるフェイズ/ステップはスタックが空かつ全員パスするまで終わらない)の UI 層モデル化そのもの。cleanup step(CR 514.2・`clearMarkedDamage`。**2026-07-19 に surrogate から実 `cleanup` phase へ昇格=§34.50**)がこのブロック下で部分実行されない(スタック非空時に `nextPhase` がブロックされ damage が消えない)ことを含め、`src/store/__tests__/review.cr500-514-turn-structure.test.ts` が end-to-end で reviewer-pin(2026-07-04・2026-07-19 に実 cleanup phase へ再ピン)。

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
- ハーネスはビルド(`tsc -b`/`vite build`)・出荷に含まれない(`scripts/` は `include` 外)。機械チェック(`npm run check`)は引き続き全通過。`npm run accuracy` でレポート生成できること。

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
- 変更は `src/engine/keywordGrammar.ts` のみ。`review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` は変更しない。reviewer テスト `review.classifier-corpus`(コーパス fixture 含む)は Fable 専有。機械チェック(`npm run check`)全通過 + `npm run accuracy` 再生成で equip FP→0・equip FN ≤2・flying FN が Nalathni/Teremko 分減ること。

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
- 実装の変更対象は `src/data/ruleClassifier.ts`(タグ+regex)/ `src/store/gameStore.ts`(end-step/draw 分岐)/ `scripts/classifier-accuracy.ts`(プローブ)/ `classifier-corpus.ts`(fixture)。`review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` は変更しない(reviewer テスト `review.classifier-corpus` と本節の `review.phaseC` は Fable 専有)。機械チェック(`npm run check`)全通過 + `npm run accuracy` 再生成で誘発ファミリー候補節が出力されること。

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
- reviewer 専有テスト `review.grammar-coverage`(`src/engine/__tests__/`)は Fable が先に書く。Codex は触らない。機械チェック(`npm run check`)全通過 + `npm run grammar-coverage` が 17,491枚で完走し §29.5 の累積カバレッジ曲線を出力すること。

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
  | { kind: 'unknown' }
  | { kind: 'up-to'; max: number }      // §34.42: "up to N cards"/"any number of cards"(=max:Infinity)。CR608.2h プレイヤー上限
  | { kind: 'that-many'; delta: number }; // §34.42: "that many cards [plus/minus K]"(delta=±K)。姉妹節の実数値参照
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
- reviewer 専有テスト `review.grammar-ir`(`src/engine/__tests__/`)は Fable が先に書く。Codex は触らない。機械チェック(`npm run check`)全通過 + `npm run grammar-ir` が 17,491枚で完走し §30.5 の IR 表現フロンティアを出力すること。

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
- reviewer 専有テスト `review.grammar-compile` / `review.g2-exec`(`src/engine/__tests__/`)は Fable が先に書く。Codex は触らない。機械チェック(`npm run check`)全通過 + `npm run grammar-compile` が 17,491枚で完走し §31.5 の executable frontier を出力すること。

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
- **cr-115 対象候補フィルタ拡張(CR 115.2 / 601.2c)**: 単一 battlefield object 対象について合法候補を絞る。`non<type>`(nonland/noncreature 等)は正型に足さず `excludedTypes` に保存・`nontoken` は `excludeTokens`・`another/other target` は `excludeSource`・`you control`/`you don't control`/`an opponent controls` は `controller`。`eligibleTargets`(spell 解決・起動時両方)がこれらを適用し、非合法候補の選択は **警告して確定させない**(起動型はコスト未精算・スタック非搭載=atomicity 維持)。値/複数/非戦場/`any target`/player 対象は manual 据え置き。
- **cr-110 tap/untap 状態書き込み(CR 110.5 / 701.26a/b)**: guided 単一対象 `Tap/Untap target ...` は既存 `effect.tap`/`effect.untap`→`setTapped` で解決(新コマンド型なし)。CR 701.26a(untapped のみ tap 可)/701.26b(tapped のみ untap 可)違反は **hard-block せず warning のみ**(サンドボックス哲学=ユーザー強行可)。ETB tapped(`landEntersTapped`+`playLand`)は既存出荷。条件付き ETB・mass untap・put/return onto battlefield tapped・tapped token 生成・tap-as-cost は manual/defer。
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
  controller?: 'any' | 'you' | 'opponent';  // sacrifice/「you control」は 'you'、「you don't control」/「an opponent controls」は 'opponent'、既定 'any'
  excludedTypes?: string[];          // cr-115: `non<type>`(nonland/noncreature 等)を正型に足さず除外型として保存
  excludeTokens?: boolean;           // cr-115: `nontoken`(既存 CardInstance.isToken を参照)
  excludeSource?: boolean;           // cr-115: `another target`/`other target`(CR 601.2c: source 自身を候補外)
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
- reviewer 専有テスト `review.grammar-guided` / `review.g3-flow`(`src/engine/__tests__/`)は Fable が先に書く。Codex は触らない。既存 `review.grammar-coverage` / `review.grammar-ir` / `review.grammar-compile` / `review.g2-exec` / `review.properties`(I1〜I7)は再ベースラインで期待値が変わる分を **Fable が更新**(実装は触らない)。機械チェック(`npm run check`)全通過 + `npm run grammar-compile` が 17,491枚で完走し §32.6 の guided frontier を出力すること。

### 32.8 leaf catalog 追補(cr-701 discard / cr-111 predefined token・2026-07-04)— この項も契約である

- **discard leaf(CR701.9)**: 単発 `Discard a card.`(one card 含む)は **guided**(CR701.9b=影響を受ける player が選ぶ→ auto でカードを勝手に選ばない)。選択カードは hand→owner graveyard(CR701.9a/404.1)、既存 `discard` command 経由。複数枚・`Discard your hand`・random・target-player discard は manual(auto 詐称なし)。受け入れ=`src/store/__tests__/review.leaf-discard-token.test.ts`(レビュー専有・7 pin)。
- **predefined token leaf(CR111.10/701.7a)**: 固定数の `Create a/two <Kind> token(s).`(Kind ∈ Clue/Food/Blood・111.10f/b/g)は **auto** で `createToken` command を emit(個数忠実)。Treasure は既存 `effect.treasure` 経路のまま共有 helper 化。可変数(`Create X ...`)・複数種混在は manual。他 predefined subtype(Gold/Map/Role 等)と Investigate alias は deferred-by-demand。
- **mixed auto+guided 行の carry 規則(Tier-1 F-1 修正・契約明確化)**: §32.2 の「auto+guided 混在(純 manual 無し)→ 全体 guided」を実行面で忠実化する: `guidedPlanForStackTop` は guided 行の**決定的 command 群も plan に載せ**、`finishGuidedResolution` が(答え command 群と共に)適用する。`resolveStackTop` は非 auto 行の command を適用しないため二重適用は起きない。**guided 判定の行の auto 半分を silent drop してはならない**(CR608.2c/§34.19 status 規律)。厳密な記述順 interleaving は将来の ordered-batch slice。

### 32.9 leaf catalog 追補(cr-701 sacrifice / draw / exile / search / shuffle・2026-07-04)— この項も契約である

- **sacrifice leaf(CR701.21a)**: self 形(`Sacrifice this <type>.` / `Sacrifice CARDNAME.`=source 名一致)は **auto**(`ctx.sourceId` のみ動かす)。単体 `Sacrifice a <type>.`(`You sacrifice ...` 含む・type ∈ creature/permanent/artifact/enchantment/land/planeswalker)は **guided**(CR701.21a=controller が選ぶ→ auto で勝手に選ばない。`controllerId !== 'you'` の permanent と type filter 不一致は確定時に拒否)。移動は既存 `moveCard`(battlefield→owner graveyard)であり **destruction ではない**(CR701.21a=regeneration・破壊置換は適用外。destroy 経路を通さない)。複数 count・each player/opponent・target-player・unless/may・qualified(another/nontoken/色/P-T 等)は manual(auto 詐称なし)。受け入れ=`src/store/__tests__/review.leaf-sacrifice.test.ts`(レビュー専有・4 pin)。
- **draw leaf(CR121.1/121.2)**: 固定数 draw(`Draw a card.` / `Draw two cards.` 等)は **auto**。CR121.2=複数枚は個別 draw の連続として既存 draw event(§34.18)を N 回 emit する(一括移動しない)。空 library への draw は advisory 記録(CR121.4 の敗北は SBA=cr-703-704 スライスで substrate 化・サンドボックス哲学で強制しない)。`Draw X cards` 等の可変数は manual。
- **draw leaf の誠実性境界(CR121.2c・2026-07-12 明確化ピン)**: auto は **draw 指示全体が P1 単独・固定数・無条件の self draw** のときのみ許す。engine の `draw` command は P1 専用(`pushDrawEvent`)ゆえ、複数受益者を忠実に符号化できない。したがって `target player/opponent`・`each player/opponent`・`that/any player`・混在 self+opponent・`may`(optional/conditional)を含む draw 節は **manual**(supported な self 部分集合だけを部分 emit してはならない=誤自動化=V1「誤自動化≈0」不変条件)。例=Tataru Taru の ETB「you draw a card and target opponent may draw a card」は auto で P1 分だけ draw してはならず manual・`commands:[]`。**先頭の embedded 遅延誘発条件(`^When/Whenever/At ...,`)は draw の *タイミング* であって受益者ではない**ため受益者判定から除外する(例=Maeve, Insidious Singer の goad+draw は P1 単独 self draw ゆえ auto を維持。CR121.2c は複数プレイヤー draw の *順序* を律するもので誘発タイミング条件には及ばない)。variable-count と opponent/target-player 強制 draw 執行は継続 defer。実行受け入れ=`src/engine/__tests__/cr121DrawCrossPlayerGuard.test.ts`。
- **exile leaf(CR701.13a)**: 単体 target-to-exile は **guided**(battlefield の合法 target のみ・filter 外は確定時に拒否)。multi-target・非戦場 zone からの exile は manual。
- **search leaf(CR701.23a/23d)**: 単発 library search は **guided**(CR701.23d=数量 search は可能な限り find)。条件付き search・複数回 search・found card への追加処理連鎖は manual。
- **shuffle leaf(CR701.24a)**: 純粋 self-library shuffle 行は **auto**。順列は**コマンド生成時に確定**し `resolveStackTop.libraryShuffleOrder` payload に保存(`applyCommand` 決定性の既存原則を維持)。純粋 shuffle 以外の search+shuffle 複合行・他プレイヤー library は下記 generic ramp composite を除き manual。
- **generic ramp search composite(CR701.23a/23d/24b・2026-07-05)**: `Search your library for a <basic land | 単一 basic land subtype> card, put that card onto the battlefield [tapped], then shuffle.`(Nature's Lore / Rampant Growth 型)を **guided** 化。解決=既存コマンド列 `moveCard(library→battlefield)` +(tapped 指示時のみ)`setTapped` + `shuffle`(**新 GameCommand 型なし**)。**CR701.24b**=shuffle 順列は confirm 時に `library − foundCard` から確定し、found を shuffle 対象へ含めない(0枚=見つけない選択も合法=CR701.23d、shuffle のみ実行)。filter は `basic land`(basic のみ)/ 単一 land subtype(`Forest card`= 非basic dual も合致)を弁別。**honest manual 境界**(auto/guided を騙らない): broad tutor(`any card`/`a card`)・複数(`up to two` 等)・Farseek 複合subtype・subtype OR・target-player・非library zone・非battlefield destination(to hand 等)・optional(`You may`)・`basic <subtype> card` 連言(保守的に manual)。fetch-land(Evolving Wilds 型)は既存 M4.15/M4.28 が担い本 composite の対象外。受け入れ=`review.cr701-library-search.test.ts`(engine 12 pin + store 4 pin・レビュー専有)。

### 32.10 leaf catalog 追補(cr-701 mill / scry / surveil・batch3-3・2026-07-06)— この項も契約である

**位置づけ**: cr-701-keyword-actions-frequent の再オープン(新規domain化ではなく既存domain・同CRファミリー・同leaf-compiler laneの継続。plannedSequence batch3-3。demand=23=action:mill 10+action:surveil 6+action:reveal 6+action:scry 1)。判定者裁定=Codexのscoping draft(`research/cr-grounding/archive/cr-701-keyword-actions-batch3-3/`)を精査した結果、**mill/scry/surveilは既存substrateが既に正しく実装済み**(実装ギャップなし。`GameCommand.mill`・`GameCommand.arrangeTop`・`EffectPrompt{kind:'scry-surveil'}`・`COUNT_DRIVEN_AUTO_ATOMS`/`GUIDED_CHOICE_ATOMS`が既に稼働)。判定者が発見した1件のみ外科修正(下記)。

**CR根拠**: 701.17a/b(mill=固定数を自分library先頭からgraveyardへ。不足時は可能な限り)・701.22a(scry N=先頭N枚を見てbottomへ任意枚数+残りtop。graveyardへは絶対に送らない)・701.25a(surveil N=先頭N枚を見てgraveyardへ任意枚数+残りtop。bottomへは絶対に送らない)・701.20a-e(reveal=ゾーン移動を伴わない公開情報操作)。

**凍結挙動**:
- **mill**: `Mill <fixed-N> cards.`(self/P1のみ・digit/two-ten/a-anのみ。word「one」は現行`countSpec`未対応=fail-safeにmanual継続・本スライスで対応しない)は**auto**(`{type:'mill', count:N}`。`applyMill`がCR701.17bのshortfallを処理済み)。target player/each opponent/each player mill は honest manual(auto詐称なし)。
- **scry/surveil**: `Scry N.`/`Surveil N.`(固定N)は**guided**(`EffectPrompt{kind:'scry-surveil', atom, count}`→既存`arrangeTop`コマンドで解決。**新GameState・新GameCommand型は追加しない**)。`Scry N. Draw a card.`型(Opt/Preordain)の混合guided+auto carryは既に正しく動作(scry promptはguided・draw commandはauto側で共存)。
- **judge外科修正(1件)**: `buildGuidedCommands`の`scry-surveil`分岐(`compile.ts`)が`prompt.atom`を見ずに`answer.toBottom`/`answer.toGraveyard`を無条件転送していた=scry答えがgraveyard destinationを、surveil答えがbottom destinationを smuggleできる理論上の隙間(UI側は正しくフィールドを絞り込んでいたが、コマンドビルダー自体には強制がなかった)。判定者が2行のガードを追加(`prompt.atom==='effect.surveil'`ならtoBottomを強制空・`'effect.scry'`ならtoGraveyardを強制空)。既存の正しいUI経路にはbyte-identical(元々空だった配列を空のまま渡すだけ)。
- **reveal**: standalone reveal leafは追加しない(`GameState`に公開情報state・reveal commandが存在しないため、追加すれば「何もしないreveal command」という fake-green になる)。既存`needs-choice`→manual のfail-safeを維持。reveal-then-search複合(Cultivate/Kodama's Reach型)も全体manualのまま(部分guided化しない)。

**Tier-1監査**: 実装ギャップなし(既存コードの正しさをjudge自身がprobeで実地確認)につき本スライスは独立Tier-1監査を省略——**判定者が発見・修正した唯一の変更(scry-surveilのatom別ガード2行)は、CLAUDE.md「監査中に見つけた数行規模の外科的修正のみ判定者が直接行ってよい」の例外条項の範囲内**であり、かつ新設した`review.cr701-mill-scry-surveil.test.ts`の該当pin(scry答えがgraveyardを、surveil答えがbottomを smuggleできないことを両方向とも実地検証)がその修正を直接・網羅的に立証している。受け入れ=`review.cr701-mill-scry-surveil.test.ts`(レビュー専有・11 pin。mill auto/shortfall/target-player-manual/word-count-manual・scry/surveil atom別destination強制・混合scry+draw carry・arrangeTop不変条件・reveal honest manual)。

**スコープ境界(§34.5・PASS に混ぜない)**: target-player/opponent/each-player mill・可変count(X等)・word「one」・scry/surveil 0の特別no-op処理(CR701.22b/701.25c。現行guidedのまま空confirmで足りるため未対応)・複数プレイヤー同時scry/surveil(CR701.22c/APNAP)・standalone reveal leaf・reveal-then-X複合の部分guided化・fateseal(CR701.29・別keyword)。

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
- 固定 `Pay N life` は CR118.1/118.3b/119.4 により決定的コストとして `adjustLife -N` へ写す(新コマンド型なし)。`Pay X life` は CR107.3a の値選択が必要なため manual。
- strict self-exile(`Exile it`/`Exile this ...`/exact card name)は CR701.13a/400.7j により `moveCard(source,'exile')` へ写す。数・対象・他オブジェクト選択を伴う exile、および self-sac と self-exile が競合するコストは manual。
- 残余判定で `Pay X life`/`Pay {E}`/`Discard a card`/`Sacrifice another …`/`Tap X untapped … you control`/`Remove a … counter`/`Exile <他カード>`/先頭ラベル `<Word> —` が正しく manual に落ちる。

### 33.7 不変・非干渉(エンジン不変)
- `compileAbilityCost` は決定的・入力非破壊・GameState 非依存(`ctx.def`/`ctx.sourceId` 読み取りのみ)。
- **I9 維持**: `effectsAuto` OFF 時、非マナ起動型能力は `activateAbility` が `addAbilityToStack` 単独と差分ゼロ。マナ能力は CR605 例外として常に no-stack。
- **I8 維持**: コスト精算は活性化時のみ。解決時の効果 auto/guided 実行ロジックは不変。
- I1〜I7 は既存コマンド(`setTapped`/`payMana`/`moveCard`/`addAbilityToStack`)経由ゆえ維持。`compileAbilityIR`(効果側)・`parseAbilityIR`・`splitAbilityLines` は**挙動差分ゼロ**(G4 はコスト消費の追加のみ)。
- **変更対象**: `src/engine/grammar/compile.ts`(`compileAbilityCost`・`CompiledCost`/`CostDecision`・純粋・新コマンド型0)/ `src/engine/commands.ts`(純ヘルパ `activationPlanForSource` / `activatedManaAbilityPlanForSource`・state 読み取り専用。§32 の `guidedPlanForStackTop` 追加と同格。**新 GameCommand 型は追加しない**)/ `src/store/gameStore.ts`(`activateAbility` action・薄いオーケストレーション)/ `src/components/playmat/Playmat.tsx`(`ability-activate` を `activateAbility` へ配線)/ `scripts/grammar-compile.ts`(cost セクション)/ `research/grammar-compile/*`(生成物)。`commands.ts`/`types.ts` に**新コマンド型は追加しない**。`ir.ts`/`index.ts` は**変更しない**(コスト消費とマナ加算は既存コマンドへ写すのが G4 の肝)。`review.*` / `docs/` / `CLAUDE.md` / `eslint.config.js` / `CACHE_SCHEMA_VERSION` / `rule/` txt のコミット / git 操作は禁止。
- reviewer 専有テスト `review.grammar-cost`(純 `compileAbilityCost`)/ `review.g4-activate`(`activationPlanForSource` engine 統合・I9)は Fable が先に書く(済)。Codex は触らない。既存 `review.grammar-compile` に cost セクションが増えた分の期待値は **Fable が更新**(実装は触らない)。`review.properties`(I1〜I7)は既存コマンド経由ゆえ変更不要。機械チェック(`npm run check`)全通過 + `npm run grammar-compile` が 17,491枚で完走し §33.5 の activation frontier / fully-playable を出力すること。

### 33.8 ACT-4: 選択を伴う起動コスト(他パーマネントのタップ・カウンター除去・`{X}`)

**CR grounding**: CR 107.1a-c, 107.3a/k, 107.5, 118.3-118.4, 122.1, 601.2f-h, 602.2/b, 605.3b, 701.26a, 733.1。ACT-4 は既存 `PendingGuidedResolution` / `ResolutionSession` を使い、選択を一時データへ積んだ後にコスト全体を1トランザクションで確定する。**新 `GameCommand`、新 `GameState` フィールド、別系統の pending state は追加しない。**

#### 33.8.1 公開型・API

- `PromptKind` に `'cost-remove-counter'` を追加する。
- `TargetFilter` に加算的な `supertypes?: string[]`、`subtypes?: string[]`、`tokenOnly?: boolean` を追加する。既存 `types` / `controller` / `zone` とANDで評価し、実カードの active face type line と token 属性へ照合する。
- `ActivationCostComponentKind` に `'remove-counter'`、`ActivationCostComponent` に `counterType?: string` を追加する。確定した component は `subjectRef`、正規化済み `counterType`、具体的な `amount` を必ず持つ。
- `EffectPrompt.counterCost` は `kind==='cost-remove-counter'` の時だけ存在し、次の判別可能形を取る。

```ts
type CounterCostPrompt =
  | {
      interaction: 'source';
      counterType: string;
      amount: { kind: 'fixed'; value: number };
    }
  | {
      interaction: 'amount';
      counterType: string;
      amount: { kind: 'one-or-more'; min: 1; max: number };
      sourceId: string;
    };
```

- `confirmGuidedCostSubject(cardId)` は既存のカード選択と同じ経路で `interaction:'source'` を処理する。`GameStore` に `confirmGuidedCounterAmount(amount: number): void` を追加し、`interaction:'amount'` だけを処理する。
- `activationPlanForSource` と `activatedManaAbilityPlanForSource` のX入力は `announcedX?: number` とする。`undefined` は未宣言、`0` は明示的に宣言された合法なゼロであり、混同しない。両plannerは同じ純粋なコスト解析を再利用し、マナ能力側にも `costComponents` / cost prompt を伝播する。
- 既存 `ActivateAbilityOptions.xValue` とスタック能力の `CardInstance.announcedX` を正本とする。X用の永続 state は追加しない。追加フィールドは型のoptional/unionだけで、pending UIは保存対象外のため `CACHE_SCHEMA_VERSION` と `restoreGame` backfill は変更しない。

#### 33.8.2 他パーマネントをタップするコスト

認識する形は `Tap [a|an|one|固定N|X] [other] [untapped] <descriptor> you control`。Xは同じ起動で宣言済みの場合だけ扱う。descriptor は permanent card type、`artifact and/or creature` / `artifact or creature`、`legendary`、単一 subtype、`token(s)` の組合せだけを扱う。

候補は battlefield 上で payer が control し、未タップで、全descriptorに合致し、同じコストで未予約の permanent とする。Oracleが `other` と言う、別の `{T}` がsourceを予約済み、またはdescriptor不一致の場合だけsourceを除外する。散文のtapコストにはsummoning sicknessを適用しない(CR 107.5の制約はtap symbolに限る)。固定N／Xについてexactly N枚をpayerの選択順で予約し、`setTapped` を生成する。X=0は選択promptもtap commandも生成しない。

power/toughness、mana value、能力・counterの有無、共有type比較、他プレイヤーの選択、`any number`、未対応の接続詞を含むdescriptorはコスト全体をmanualにする。合法候補が不足するrules-legal起動は盤面変更前に拒否する。強行時も既にタップ済みの物を支払い済みとは表示しない。

#### 33.8.3 カウンターを取り除くコスト

ACT-4で認識するのは次だけである。

1. strict selfから、名前付きcounterを固定正数N個取り除く(auto)。
2. payerがcontrolする単一の `<permanent|artifact|creature>` から、名前付きcounterを固定正数N個取り除く(source選択guided)。
3. strict selfから、名前付きcounterを `one or more` 取り除く(amount選択guided、`1..現在数`)。
4. strict selfから、名前付きcounterを宣言済みX個取り除く(auto。X=0も合法)。

strict selfは `this ...`、`it`、`~`、active face名／split card名へ正確に照合する。確定直前に同じ `objectId`、zone、controller、counter type、具体amount、累積予約量を再検証する。正数amountについて現在数未満ならコスト全体を拒否し、`addCounters` のゼロclampに依存しない。全体preflight後だけ `{type:'addCounters', cardId, counterType, delta:-amount}` を生成する。

genericなcounter種別選択、`from among` の分配、別counter種の選択肢、`any number of`、player counter、loyalty cost、counter移動／追加、置換効果を伴う除去はmanualとする。

#### 33.8.4 `{X}` の宣言・束縛

- 選択した起動コストに `{X}` があれば、対象／コスト対象選択より先に整数Xを1回だけ求める。既定最小値は0、正確な `X can't/cannot be 0` があれば1。未入力・負数・小数は起動しない。
- 同じ値をコストとルール文章中の全Xに使う。`{X}{X}` は `2*X`、`{X}{X}{X}` は `3*X`。起動ごとに新しく選び、sourceや以前のstack objectから再利用しない。
- 通常能力は生成する1個のstack abilityへ `announcedX` を保存し、stack copyはこれを保持する。mana abilityはstackを使わないが、同じ値をその1回のコスト／効果計画へ使う。
- X dialogまたは後続promptのcancelは、mana、tap、counter、zone、stackのいずれも変更しない。rules-legalでマナ不足なら全体を拒否する。明示的な強行は非CR合法warningを伴う既存sandbox経路だけで許す。
- `Pay X life`、`Pay X {E}`、X体のsacrifice/discard/exile、複数sourceからのremove-Xはmanual。`{X}` mana部分だけを先に払わない。

#### 33.8.5 原子性・順序・誠実な縮退

全コスト要素を先に解析し、1要素でもmanual/unparsedなら**コスト全体をmanual**にして、認識済み要素も部分実行しない。選択回答はpending interactionだけへ保存し、最終preflight通過後に限り1回の `applyCommands` と1回の `commit` を行う。cancel、回答の陳腐化、`EngineError` は起動要求前の `GameState` を保つ。

決定的なcommand順は、(1)既存self cost、(2)mana source tapと`payMana`、(3)Oracle左から右の他nonmana cost、(4)各component内の回答順、(5)通常能力の `addAbilityToStack` またはmana abilityのno-stack effect。通常能力はstackへ正確に1個追加し、mana abilityはCR 605どおりstackへ追加しない。成功後は1 undoで起動前、1 redoで同じ支払いと結果へ戻る。

UIは既存の共通解決workspaceを使う。カード候補はDecisionBarとkeyboardで選択でき、counter amountは `counter-cost-dialog` / `counter-cost-amount` / `counter-cost-confirm` / `counter-cost-cancel`、X cancelは `x-cost-cancel` を持つ。右クリック以外のaction-sheet代替を維持する。対応costだけを完遂してeffectが未対応なら、stack解決はguided/manualと明示し、カード全体を「自動化済み」と表示しない。

### 33.9 CR121 cross-player draw 検証ピン(契約)

**目的**: CR 121.1/121.2/121.2c/121.4 の cross-player draw 挙動が既存の `applyPlayerEffect` + `orderedRecipients` + `drawCards` 基盤で正しく実装されていることを review テストで固定する。新 GameCommand・新 GameState フィールドは追加しない。

**CR 根拠**:
- CR 121.1: draw = top card of library → hand
- CR 121.2: cards drawn one at a time; multiple draws = individual card draws
- CR 121.2c: multi-player draw ordering — active player first, then APNAP
- CR 121.4 / CR 704.5b: empty library draw attempt → SBA loss

**契約**:
1. `applyPlayerEffect` with `recipients: 'eachPlayer'` は active player の draw を先に実行し、その後 APNAP 順で他プレイヤーの draw を実行する。event log の draw イベント順で検証可能であること。
2. `recipients: 'eachOpponent'` は controller を除外する。
3. 各プレイヤーの `drawOrdinal` は独立に 1 から始まる。
4. 空ライブラリからの draw 試行は `empty-library-attempt` イベントを記録し、`stabilizeBeforePriority` が `emptyLibraryDrawAttemptedSinceLastSba` フラグを消費して defeat advisory(`emptyLibraryDraw` / `704.5b`)を生成する。
5. 旧 `draw` command の `playerId` オプションは指定プレイヤーのライブラリから引き、省略時は `localPlayerId` にフォールバックする。
6. `applyCommand` は純粋: 入力 state は変更されない。cross-player draw は単一の state 遷移を返す。

**compiler 境界**: `countDrivenCommand` は `each player draws N` / `each opponent draws N` を `applyPlayerEffect` へコンパイルする。`target player draws` は `DRAW_UNSUPPORTED_RECIPIENT_OR_CONDITION` により manual のまま維持する(対象選択のモデル化が未実装のため)。

**review**: `src/store/__tests__/review.cr121-cross-player-draw.test.ts`(8 cases)。

### 33.10 CR605 mana choice UI 検証ピン(契約)

**目的**: CR 605.1/605.3b/106.3 のマナ能力色選択 UI が既存の guided mana prompt フロー(`guidedManaPrompt` → `pendingGuided` → `confirmGuidedMana` → `ManaChoiceDialog`)と `tapForMana` ショートカットフロー(`needs-choice` → `manaChoice` state → `ManaChoiceDialog`)で正しく実装されていることを review テストで固定する。新 GameCommand・新 GameState フィールドは追加しない。

**CR 根拠**:
- CR 605.1: マナ能力 = マナを追加する起動型能力・対象なし・loyalty ではない
- CR 605.3b: マナ能力はスタックを使わずに解決する
- CR 106.3: マナ生成の一般則(能力がマナを追加する際の選択メカニクス)

**契約**:
1. `guidedManaPrompt` は "Add N mana of any color" / "any one color" / "any combination of colors" / "the chosen color" / "that color" を guided mana prompt へコンパイルする。`manaOptions` は commander color identity で制限される場合がある。
2. 用途制限付きマナ("Spend this mana only to...")は manual のまま維持する(fake guided 禁止)。
3. 可変数マナ("Add X mana...")は manual のまま維持する。
4. `buildGuidedCommands` は mana answer を `addMana` command へ写像する。`manaOptions` にない色は空配列を返す(拒否)。
5. `tapForMana` は単色土地は自動解決、多色土地は `needs-choice` を返す。色指定付き呼び出しは指定色が `producedMana` にあれば `ok`、なければ `needs-choice`。
6. マナ能力の guided prompt はスタックに追加しない(CR 605.3b)。`confirmGuidedMana` 後にスタック長は不変。

**review**: `src/store/__tests__/review.cr605-mana-choice-ui.test.ts`(13 cases)。

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

M0-FREEZE の CR-grounding overlay 正本は `research/cr-grounding/m0-freeze-overlay.json` とする。`research/cr-grounding/README.md` と `docs/acceptance.md` の CRG 表は人間向け表示であり、scorecard 配線時の機械可読入力は overlay JSON を使う。Fable の承認/差戻し記録は `research/cr-grounding/archive/m0-freeze/m0-freeze-decision-record.md`、証拠監査は `research/cr-grounding/archive/m0-freeze/m0-freeze-evidence-audit.md`、CR refs / golden / executable / overlay / boundary の追跡表は `research/cr-grounding/archive/m0-freeze/m0-freeze-traceability-matrix.md` を参照する。

Zone/zone-change の設計正本は `research/cr-grounding/archive/m0-freeze/zone-change-study.md`。CRG-5 トークン死亡、CRG-6 誘発/SBA/優先権、CRG-7 領域移動/LKI は共有 substrate を持つため、個別実装へ直行しない。順序は Z1 object incarnation scaffold → Z2 ZoneChangeEvent → Z3 pendingTriggers → Z4 stabilizeBeforePriority → Z5 executable CR-golden。

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
- **demand 計器の coverage anchoring(契約・2026-07-12)**: MyDeck 設計採点(`scripts/mydeck-scoring/`)の coverage 判定は、cost/mana/action/tap-state/damage/life/counter/target/token の9 family について**実 runtime compiler**(`parseAbilityIR`→`compileAbilityIR`/`compileAbilityCost`)の出力(`engineCoverageTagsForLine`・per-line)に anchor する。これらの family には並行テキスト分類器が**残っていない**ため、parity 乖離は構造的に 0(乖離する対象が無い)。covered = compiler が command **または** guided prompt を出す(`decision !== 'manual'`)。**既知の残境界**(follow-up): 計器は ability-compiler 経路のみを credit し、fetch(`fetchAbility`)・`playLand`・keyword(`effectiveKeywords`)・mana-ability 等の**別 engine 経路**で app が解決するカードは依然 gap 誤計上しうる(例: 寓話の小道の search は fetch 経路で解決するが ability compiler は manual を返す)。ゆえに絶対 count は真の app 能力の**上限**であり、計器修復後の値(382)は ability-compiler scope の honest floor。真の genuine-gap へ近づけるには別経路の credit が別スライスで必要。

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
  (deck 加重は条件5 の役割)。既存 `research/archive/cr-conformance-audit.md` の所見(destroy/sacrifice=701.8a/701.21a・dies=700.4・
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
`review.golden-replay`(条件5 非回帰)・`review.m-contract-gate`(集計ロジック)を緑に保つ。機械チェック(`npm run check`)も緑。

### 34.8 本マイルストーン(M-CONTRACT=凍結)の不変・スコープ
**契約のみ。エンジン/UI/store・既存テストは一切変更しない**。成果物は本章(engine-spec §34)+ `docs/architecture-substrate-compiler.md`(WHAT)+ `docs/engine-design-method.md`(HOW=設計手法)+ `CLAUDE.md` L35 改定。機械チェック(`npm run check`)(`npm run lint`/`npx tsc --noEmit`/`npx vitest run`/`npm run build`)は docs/規約変更ゆえコードパス無関係で自明に不変。`review.*` テストは追加しない(コードが無い)。実装は M0 収束後に S-EVENTS から着手する。

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
  **CR 準拠監査**(`research/archive/cr-conformance-audit.md`)= runtime `triggers.ts` `trigger.death` が CR700.4 違反(`put into a graveyard` が「from the battlefield」非限定で mill/discard を死亡誤検出・parity 計測済・別タスク化)+ `trigger.landfall` 緩い。SBA/owner・controller/ゾーン分割の不在は設計(サンドボックス+substrate 未実装)。**Slice3 は CR 接地で実質収束方向。次 = Slice4 前進可**。
- **M-GATE-4(条件4+条件3 緑化 → 凍結到達・2026-06-25・監査合格)= 手法 §34.7.5**: 条件4(非LLM独立物差し)を散文監査から**機械可読 CR 真理テーブル**へ昇格。
  Codex が代表160枚(4軸×40・各エントリ CR 条番号付き)gold を草稿し `crConformance.ts`/`cr-conformance.ts` harness を構築 → conformance 98.75%・divergent 2 を Fable へ提出。
  **Fable 裁定**: 2件(`Acrobatic Cheerleader`/`Cautious Survivor` の "Survival — At the beginning of your second main phase")は CR 505.1a で main-postcombat が一意=**classifier-FN**(gold 正)。
  根因 = `timingClassify` の beginning 抽出が能力語接頭辞の em-dash 後を拾わず**125枚規模の juncture FN**(`Survival/Revolt/Raid/Celebration — At the beginning of …`)を毎反復同一に取りこぼし(§4 構造的 FN の典型)。
  外科的1行修正(beginning パターンに `—\s+` 接頭辞アンカー追加)で conformance **100%・bounded**。`review.timing-coverage`/`-oracle` 無回帰。
  **条件3 post-yardstick churn**: CR 修正適用後に 4スライス同時スナップショット(baseline=`04184e4`)= layer 0%/event 1.95%/zone 0%/timing 0.82% → max **1.95% < 5% PASS**。
  event 1.95% は M-GATE-2 eventClassify の CR 修正が未スナップショットだった分の清算(計測欠落の解消)。**高 conformance + 低 churn = 物差しを当てても崩れない真の収束**(§4)。
  全7条件 PASS=**スコアカード FROZEN**。`src/engine/` 盤面挙動不変・機械チェック(`npm run check`)緑・`review.cr-conformance` 緑。**当時の次手 = M-FREEZE(§34 凍結手続き → S-EVENTS)**。
- **M-CR-RECONCILE(2026-06-26・本追補)**: 上記 FROZEN は分類器/既存 replay の研究成果としては有効だが、CR 状態遷移 gold が不足していたため凍結根拠として撤回。CR 2026-06-19 へ固定し、§34.0 と `research/cr-grounding/golden-cases.json` を追加。次手は M-FREEZE ではなく、CR-grounding gold の実行可能化と scorecard 再判定。

### 34.10 S-EVENTS / PRIORITY(Q5 Phase 2 実装契約)— この節も契約である

**位置づけ**: M0-FREEZE 達成(legacy 7条件 FROZEN + CR-grounding overlay APPROVED)後の最初の substrate 実装。Q5 Phase 1(S-CHOICE/S-TURN=汎用 `pendingRuleChoices`)に続く背骨。後続 S-EVENTS/MANA・S-SBA・S-LAYERS はこの priority 固定点ループにぶら下がる。設計正本 = `research/cr-grounding/archive/m0-freeze/priority-event-loop.md`(R-FREEZE-2)。

**CR 根拠**:
- CR 117.5 / 704.3: プレイヤーに優先権が渡る前に、SBA と待機中の誘発を**固定点まで**処理する。
- CR 603.3 / 603.3b: 待機中の誘発を stack へ置く際、複数なら placement は二段階 = first bucket(誘発条件が「別の能力の誘発」**でない**もの=`ordinary`)→ second bucket(残り=`ability-triggered`)。各 bucket 内は APNAP 順、同一コントローラ内は本人選択順。
- CR 101.4: APNAP(能動→非能動)順序。

**1. 型契約(`src/engine/types.ts`)**:
```ts
type TriggerStackPlacementBucket = 'ordinary' | 'ability-triggered';
interface PendingTrigger {
  // ...既存フィールド...
  stackPlacementBucket: TriggerStackPlacementBucket;     // 必須。CR 603.3b bucket
  triggeredByPendingTriggerId?: string;                  // second bucket 証跡(任意)
  triggeredByAbilityEventId?: string;
}
interface AbilityTriggeredEvent {                         // 型定義のみ。Phase 2 では未配線
  type: 'abilityTriggered'; eventId: string; sequence: number;
  pendingTriggerId: string; sourceObjectId: ObjectId;
  controllerId: PlayerId; causeEventId?: string;
}
```
`AbilityTriggeredEvent` は `GameEvent` union に**加えない**(`GameEvent = ZoneChangeEvent` 不変)。「Whenever an ability triggers」系の実カードを second bucket へ分類する検出 observer は **C-GRAMMAR へ defer**。Phase 2 で生成される全 pending trigger は `ordinary`。

**2. 順序付け(`src/engine/priority.ts`)**: `orderPendingTriggersApnap` は explicit id が pending を厳密被覆することを検査後、placement を `bucket(ordinary→ability-triggered) → APNAP controller → controller 本人選択順` で正規化する。**bucket 境界はコントローラの explicit order より上位**(同一コントローラ explicit `[B(ability-triggered), A(ordinary)]` → `[A, B]`)。

**3. 優先権固定点(`advanceToPriority`・純粋関数)**: 戻り値 union = `priority-ready` / `choice-required` / `trigger-order-required`。ループ = ①既存 SBA を安定まで実行(**新 SBA ルールは足さない**=full SBA suite は S-SBA へ隔離)②その zone change 由来の pending trigger を収集 ③`pendingRuleChoices.length>0` なら `choice-required` 返却 ④pending trigger があり決定的順序が取れれば batch で stack へ置き**ループ先頭(SBA)へ戻る** ⑤コントローラ選択が要れば `trigger-order-required` ⑥choice も pending trigger も無ければ `priority-ready`。**`choice-required`/`trigger-order-required` を `priority-ready` に混ぜない**。決定的自動 placement は各コントローラが各 bucket 内に高々1誘発の時のみ許す。

**4. 前方互換(§34.3)**: 旧 snapshot の `PendingTrigger` は `stackPlacementBucket` 欠落 → store 復元で `'ordinary'` backfill(`normalizeTriggerStackPlacementBucket`)。

**5. golden / test(4点不変条件③)**: `research/cr-grounding/golden-cases.json` に `cr-trigger-6033b-two-bucket-order`(bucket が explicit order より上位)・`cr-trigger-6033b-apnap-per-bucket`(bucket ごとに APNAP)・`cr-priority-loop-trigger-placement-rechecks-sba`(placement 後に SBA 再チェックの固定点)を追加し `src/store/__tests__/crGroundingGoldenCases.test.ts` で実行可能化。`src/engine/__tests__/priority.test.ts` に順序付け+固定点の unit。

**6. スコープ境界(§34.5・PASS に混ぜない=4点不変条件④)**: (a)`AbilityTriggeredEvent` 検出 observer と実カードの second bucket 分類 → C-GRAMMAR carry(substrate field は ordinary backfill で zero-rework 後付け可) (b)full SBA suite → S-SBA carry(本 Phase は既存 SBA のみ loop へ接続)。CRG-6 の残境界文言「603.3b second bucket and full SBA suite are not implemented and must not be reported as PASS」は、substrate 実装後も**検出/SBA 拡張の部分**について維持する。

### 34.11 S-EVENTS / MANA(CR 605.1b 誘発型マナ能力)— この節も契約である

**位置づけ**: §34.10(priority 固定点ループ)に続く substrate。設計正本 = `research/cr-grounding/archive/mana/mana-ability-substrate.md`(R-FREEZE-3)。起動型マナ能力(CR 605.1a・§34 の `activatedManaAbilityPlanForSource` で実装済)に加え、**誘発型マナ能力(CR 605.1b)を `GameState.pendingTriggers` / スタックに混ぜず、mana ability transaction 内で固定点まで即時解決する**。

**CR 根拠**:
- CR 605.1a: 起動型マナ能力(targetless + 解決時 mana 加算しうる + 非 loyalty)。
- CR 605.1b: 誘発型マナ能力(triggered + targetless + 「起動型マナ能力の起動/解決」または「mana が pool に加えられたこと」から trigger + 解決時 mana 加算しうる)。
- CR 605.4a / 405.6c: 誘発型マナ能力はスタックに置かれず、trigger 元の直後に優先権を待たず解決する。
- CR 605.5(a): 上記基準を満たさないものはマナ能力でない(非 mana event 由来の add-mana 誘発・対象を取る add-mana 誘発・呪文は通常誘発)。

**1. 型契約(`src/engine/types.ts`)**:
```ts
interface ActivatedManaAbilityEvent {        // 605.1a の起動/解決(transaction 内イベント)
  type: 'activatedManaAbility'; eventId: string; sequence: number;
  sourceObjectId: ObjectId; sourceSnapshot: ObjectSnapshot;
  controllerId: PlayerId; abilityLineIndex?: number;
  stage: 'activated' | 'resolved';
}
interface ManaAddedEvent {                    // mana が pool に入った(zone-change ではない)
  type: 'manaAdded'; eventId: string; sequence: number;
  playerId: PlayerId; sourceObjectId?: ObjectId; sourceSnapshot?: ObjectSnapshot;
  amount: ManaPool; causeEventId?: string;
}
interface PendingManaTrigger {                 // transaction-local のみ。state に保存しない
  kind: 'triggered-mana-ability'; ruleRef: '605.1b';
  triggerEventId: string; sourceId: PhysicalCardId; sourceObjectId: ObjectId;
  sourceSnapshot: ObjectSnapshot; controllerId: PlayerId;
  abilityLineIndex?: number; label: string;
}
```
`ManaAddedEvent`/`ActivatedManaAbilityEvent` は `GameEvent` union に**加えない**。`PendingManaTrigger` は `GameState.pendingTriggers` に**保存しない**(別経路)。

**2. transaction(`src/engine/manaTransaction.ts`・純粋関数)**: `resolveManaAbilityTransaction(state, input)` は起動型マナ能力のコマンドを適用し、transaction-local な mana event を発行し、CR 605.1b の `PendingManaTrigger` を集めて固定点まで即時解決する。`addAbilityToStack` を使わず、priority boundary へ渡さない。誘発型マナ能力が加えた mana から更に 605.1b が誘発しうるため、queue を固定点まで回す。**iteration cap(既定 256)** を超えたら warning(CR 605.4a 文言)+ log を残して停止し、未解決の 605.1b を通常スタック経路へ逃がさない。ストア配線 = `tapForMana` / `activateAbility`(`src/store/gameStore.ts`)は起動型 + 誘発型を1 transaction(1 undo 単位)で解決する。

**3. 分類(`isTriggeredManaAbilityForEvent`)**: triggered/delayed-triggered + `construct.target` を含まない + `effect.add-mana` を持つ + trigger source が mana-related。`effect.add-mana` 単独では 605.1b にしない。対象を取るなら 605.1b でない。

**4. golden / test(4点不変条件③)**: `research/cr-grounding/golden-cases.json` に `cr-triggered-mana-ability-no-stack`(605.1b/605.4a の no-stack 即時解決)・`cr-add-mana-trigger-from-non-mana-event-is-normal-trigger`(CR 605.5a=通常誘発)・`cr-targeted-add-mana-trigger-is-normal-trigger`(targetless 違反=通常誘発)を追加し `crGroundingGoldenCases.test.ts` で実行可能化。受け入れ acceptance contract = `src/store/__tests__/review.mana-transaction.test.ts`(**レビュー担当専有**=no-stack/pendingTriggers 不混入/単発発火/通常誘発分離/活性化源 defer/iteration cap の敵対 pin)。

**5. スコープ境界(§34.5・PASS に混ぜない=4点不変条件④)**: **CR 605.1b 第1節(「起動型マナ能力の起動/解決」から trigger)の実カード検出 → C-GRAMMAR carry**。理由: 起動/解決源の分類は IR 級の trigger-source 分類を要し、raw-text regex では (i) substrate が発行する distinct な `activated`/`resolved` イベントを stage 非依存パターンが二重発火させ、(ii) 活性化文言カードを mana-added 分岐が誤一致させる。よって `isManaRelatedTriggerCondition` は `activatedManaAbility` イベントに対し現状 `false`(defer)を返す。**本 Phase で生きている 605.1b 経路は「mana が加えられたこと」(第2節)のみ**(golden `cr-triggered-mana-ability-no-stack` + review.mana-transaction が固定)。`AbilityTriggeredEvent` 同様、substrate(型 + transaction 経路 + 合成 golden)は置き、実カード検出は後付け zero-rework。full SBA suite は引き込まない(loop は既存 SBA のみ)。CRG の「誘発型マナ能力は未実装」境界は、第1節検出の部分について維持する。

**6. マナ生成節 catalog(cr-605 slice・2026-07-03 追補)— この項も契約である**: activated mana ability のマナ生成節を3分類で被覆(MyDeck 採点 mana:write 需要への demand-first slice)。(a)**auto** = リテラル・シンボル列(`Add {C}`/`Add {G}{G}`/`Add {W}{U}` 等)。シンボルは正確な種類と個数(CR106.1b/107.4)。(b)**guided** = 色選択形(`Add one mana of any color`/`... in your commander's color identity` 等)。**色選択は target でない**ため 605.1a マナ能力のまま=stack 不使用・即時(605.3b/405.6c)。選択肢は identity 制約から導出。confirm 前は無変更・cancel 完全非変更(CR602.2 atomicity)。(c)**manual** = or 選択(`{W} or {U}`)・chosen color・combination・different colors・snow・条件付き・**restriction 付き**(`Spend this mana only ...`)= auto を騙らない(§34.19 status 規律)。**cost atomicity は no-stack マナ経路でも同一**(CR118.3/602.2): 既 tap の `{T}` 源は rules-legal で block(mana を加えない)・forced は非CR-legal 警告付き(Tier-1 赤旗修正・2026-07-03)。受け入れ = `src/store/__tests__/review.mana-write.test.ts`(レビュー専有・6 pin)。

**7. naive マナショートカットのコスト整合(ACT-1・2026-07-17 追補)— この項も契約である**: `producedMana` メタデータ駆動のショートカット(`tapForMana`/`planAutoTap`/actionCatalog「マナを生成してタップ」)は、oracle 正本の**単一 recognizer** `naiveTapManaColors`(`src/engine/grammar/manaShortcut.ts`・WeakMap メモ化)が返す色に限り許可する。適格 = (a)**コストが正確に `{T}` だけの起動型 add-mana 行**の色(リテラル・シンボル和集合。リテラル無しの行は producedMana)。純度判定前に ability-word ラベル(CR207.2c=ルール上の意味なし)を剥がす(`stripAbilityWordLabel`)。(b)**基本土地タイプの内在マナ能力**(CR305.6)= タイプ行の Plains/Island/Swamp/Mountain/Forest から常に付与(リマインダー行は sanitize で消えるため oracle 文から復元不能)。(c)起動型 add-mana 行を**1本も持たない**カード(基本土地・誘発型生成者)は producedMana fallback 維持。コスト付き行しか持たないカード(Lotus Petal 型・filter 型)は naive 不適格 = 一般経路 `activateAbility` へ委譲し §34.19 のアトミック性でコストを支払う(CR118.3/602.2)。**oracle > メタデータ**(metadata 欠落時は oracle 由来色が正)。受け入れ = `src/store/__tests__/review.act1-mana-shortcut-cost.test.ts`(レビュー専有・19 pin)+ `review.m418.test.ts` Mana Confluence(前コロン Pay 1 life の支払い)。**既知 carry(ACT バッチ後続へ・2026-07-17 訂正)**: needs-choice 色選択ダイアログの選択肢が raw `producedMana` のまま(gameController/Playmat 計4箇所・corpus 実測で不整合2枚)= naive 対象外色を選ぶと選択色を無視して一般経路へ委譲される。**当初は ACT-2 を carry 先としたが、ACT-2(§34.46)は起動ラインの到達性に絞ったためスコープ外**=後続スライスへ繰り越す。

### 34.12 S-SBA: damage-marked substrate(CR 704.5g/h)— この節も契約である

**位置づけ**: 実装フェーズの SBA 拡張第1スライス。ユーザー裁定(2026-06-30「最終ゴール=CR 完全性から逆算・substantive な変更を」)を受け Fable が選定 = **combat は最大の未モデル CR 領域であり、damage-marked state は lethal/deathtouch/first-strike/regeneration が読む combat 系の共有 substrate**。設計=本マイルストーンで起こした(`research/cr-grounding/archive/damage-marked/damage-marked-engine-spec.draft`)。**substrate(state + command + SBA)のみ。combat phase orchestration は defer**。

**CR 根拠**:
- CR 120.1 / 120.3 / 120.6: damage はオブジェクトにマークされ、creature の lethal damage = toughness 以上のマーク。
- CR 704.5g: toughness > 0 の creature に toughness 以上の damage がマークされていれば破壊。
- CR 704.5h: toughness > 0 の creature に deathtouch を持つ発生源からの damage が1点以上マークされていれば破壊。
- CR 704.5f: toughness ≤ 0 の creature は graveyard(既存)。704.5g/h は **toughness > 0 のみ**対象=二重破壊しない。
- CR 514.2: cleanup で全オブジェクトのマーク damage を除去。

**1. 型契約(`src/engine/types.ts`)**:
```ts
interface CardInstance {
  // ...既存...
  damageMarked: number;          // 既定 0・常に有限かつ >= 0(I3 不変条件に追加)
  hasDeathtouchDamage: boolean;  // 既定 false・deathtouch 発生源由来の正の damage が現在マークされているか(704.5h)
}
```
初期化・token/copy/ability 生成・true zone change で 0/false にリセット。旧 snapshot 復元で欠落/不正を 0/false に backfill(前方互換)。

**2. command(`src/engine/commands.ts`)**:
- `markDamage{ cardId; amount; deathtouch? }`: `damageMarked += max(0, amount)`(負を clamp=I3 維持)、`deathtouch===true` かつ正の amount で `hasDeathtouchDamage=true`。Oracle 文から deathtouch を推論しない(combat/compiler が後でセット)。
- `clearMarkedDamage{ cardId? }`: 指定カード(無指定なら全 battlefield creature)を 0/false へ(CR 514.2 の除去プリミティブ)。

**3. SBA(`performStateBasedActionsOnce`・既存 704.5f/i/d/e と同枠)**: 704.5g(effective toughness>0 かつ `damageMarked>=toughness` → owner's graveyard・`sbaApplied:'704.5g'`)・704.5h(effective toughness>0 かつ `hasDeathtouchDamage` かつ `damageMarked>=1` → owner's graveyard・`sbaApplied:'704.5h'`)。effective toughness は 704.5f と同一ヘルパ(counter 込み)=分岐なし。704.5f が toughness≤0 を専有するので 0-toughness は g/h 非該当=二重破壊なし。

**4. cleanup 配線判断(§34.5)**: ~~現エンジンに standalone CR 514 cleanup step は未モデル。turn 遷移 `nextPhase(end→untap)`/`nextTurn` へ `clearMarkedDamage` 相当を配線=現状の cleanup surrogate。~~ **【2026-07-19 更新=§34.50 で置換】**: standalone `cleanup` phase を `PHASE_ORDER` に追加し実モデル化した。`clearMarkedDamage`(514.2)は `completeCleanupStateActions` 内で cleanup step の turn-based action として実行される。**contract 予告どおり** cleanup step 導入は `clearMarkedDamage` を呼ぶだけで済み、damage-marked substrate の挙動は不変(手札上限を満たすターンは end→cleanup→untap が単一 `nextPhase` で貫通するため surrogate と同一エッジで damage が消える)。**2026-07-04: end-to-end reviewer-pin**(`review.cr500-514-turn-structure.test.ts`)= 実 `nextPhase()`/`nextTurn()` でダメージが消えること・中間フェイズ移行では消えないこと・スタック非空時は部分実行されないことを確認。**2026-07-19: 同 pin を実 cleanup phase へ再ピン**(cleanup step が挟まっても no-discard パスの end→untap 貫通と damage クリアが保たれる)。

**5. golden / test(4点不変条件③)**: `golden-cases.json` に `cr-sba-lethal-damage-destroys-creature`(704.5g/120.6)・`cr-sba-sublethal-damage-survives`・`cr-sba-deathtouch-any-damage-destroys`(704.5h)・`cr-cleanup-clears-marked-damage`(514.2)を追加し `crGroundingGoldenCases.test.ts` で実行可能化。受け入れ acceptance contract = `src/store/__tests__/review.damage-marked.test.ts`(**レビュー担当専有**=exactly-lethal/sublethal/deathtouch-by-flag/cleanup/負 clamp/0-toughness 単発破壊 の敵対 pin)。I3 不変条件に `damageMarked>=0` を追加(`review.properties`)。

**6. スコープ境界(§34.5・PASS に混ぜない=4点不変条件④)**: (a)**full combat phase orchestration**(declare attackers/blockers・combat damage step 自動)→ C-GRAMMAR/combat carry。damage は `markDamage` 経由でのみ入る (b)**regeneration replacement**(704.5g の「unless regenerated」/ CR 701.18)→ regeneration shield state が無いので未実装・704.5g は無条件破壊 (c)**first/double strike** の damage step 分割 → defer ~~(d)**standalone CR 514 cleanup step** → 未モデル(turn 遷移が surrogate)~~ **【2026-07-19: (d) は §34.50 で解消。standalone cleanup phase + 手札上限捨てを実装済み。CR 514.3/514.3a の追加 cleanup ループも解決中ドロー→再クリーンナップで実装】**。これらは leaf/compiler 後付けで substrate を壊さず差し込める。

### 34.13 S-COMBAT: combat structure(first slice・CR 506–510)— この節も契約である

**位置づけ**: §34.12 の damage-marked substrate を「生かす」combat 構造 substrate(ユーザー裁定「最終ゴールから逆算」で combat を選定=最大の未モデル CR 領域)。設計正本=`research/cr-grounding/archive/combat/combat-structure-design.draft`(Option A 採用)。**state + 宣言 + atomic combat damage のみ。新 SBA を足さず既存 704.5g/h を再利用**。

**CR 根拠**: 506.1(combat step)/508.1a・508.1f・508.1k(attacker 宣言・non-vigilance tap)/509.1a・509.1g・509.1h(blocker 宣言・blocked 判定)/510.1a–d・510.2(combat damage・simultaneity)/120.6(lethal)/704.5g・704.5h(destroy)。

**1. state(`GameState.combat: CombatState | null`)**: combat 局面は phase-scoped・relational ゆえ `CardInstance` フラグにせず `GameState.combat` に集約。型 = `CombatState{combatId,turn,step,attackingPlayerId,defendingPlayerId,attackers[],blockers[]}`・`CombatAttacker{cardId,objectId,controllerId,target,blockedBy[],declaredOrder}`・`CombatBlocker{cardId,objectId,controllerId,blocking[],declaredOrder}`・`CombatTarget={type:'player';playerId}`・`CombatStep` 5値。前方互換: legacy/`phase!==combat`/`combat.turn!==turn` の復元は `null` 正規化(`normalizeSnapshotCombat`)。combat phase を出ると `null`。

**2. command(`src/engine/commands.ts`)**: `enterCombat`(combat 開始・`phase:'combat'`)・`declareAttackers`(attacker・target・order 記録 + non-vigilance tap CR508.1f)・`declareBlockers`(1 blocker=1 attacker・`blockedBy` 更新)・**`resolveCombatDamage`(唯一の combat damage public command)**。

**3. atomicity(CR 510.2・要石)**: `applyCommand` は末尾で必ず `stabilizeBeforePriority` を1回呼ぶ。`resolveCombatDamage` は全 assignment を**単一 draft 上**で既存 mark-damage 内部ロジックにより適用し、SBA は command 末尾の1回だけ走らせる。**serial な公開 `markDamage` 連発を使わない**(途中 SBA で先に死んだ側が反撃 damage を出さない=CR510.2 違反になるため)。

**4. damage(first slice)**: 未ブロック attacker → creature markDamage を出さない(player damage は対象外=既存 store `declareAttack` と併存)。1 blocker にブロックされた attacker ↔ blocker は両 power を atomic に相互マーク(deathtouch は effective keyword から `deathtouch:true`)。**複数 blocker → 自動割当しない**(CR510.1c は攻撃側コントローラの選択=真の choice ゆえ silent 割当禁止=北極星「決定論捏造禁止」)。`manual-combat-damage` warning/log を残し creature markDamage を出さない。

**5. golden / test(4点不変条件③)**: `golden-cases.json` に `cr-combat-single-block-lethal-mutual-damage`(510.2 atomic=両死が単一 `simultaneousGroupId`)・`cr-combat-single-block-sublethal-survives`・`cr-combat-unblocked-attacker-no-creature-mark`・`cr-combat-multiple-blockers-deferred`(manual-combat-damage)を追加。受け入れ acceptance contract = `src/store/__tests__/review.combat.test.ts`(**レビュー専有**=atomicity/sublethal/unblocked/deathtouch→704.5h 単離/multi-blocker defer/combat-context invariant)。`review.properties` I3 に combat 不変条件(`combat≠null ⇒ phase==combat ∧ combat.turn==turn ∧ participant.cardId∈cards`)追加。

**6. スコープ境界(§34.5・PASS に混ぜない=4点不変条件④)**: first/double strike step 分割・banding・trample-to-player・blocker-blocks-multiple-attackers・複数 blocker への明示割当 UI・full attack/block legality(restriction/requirement/cost/evasion)・combat 優先権完全自動化・player/planeswalker/battle combat damage・combat trigger 収集・prevention/replacement・regeneration → 全て C-GRAMMAR/後続 combat slice へ carry。substrate(state + atomic command 経路)は壊さず後付け可能。**(更新: 未ブロック player combat damage と既存 store `declareAttack` 統合は §34.14 slice 2 で実装済)**。

### 34.14 S-COMBAT slice 2: 未ブロック player combat damage + `declareAttack` 統合 — この節も契約である

**位置づけ**: §34.13(combat 構造 slice 1=creature-vs-creature)に続き、combat を**勝利条件(player life)に効く**ようにし、既存 store `declareAttack`(life 直接いじり hack)を combat substrate へ統合して二重ダメージ経路を解消。設計正本=`research/cr-grounding/archive/combat/combat-slice2-design.draft`(Option A 採用)。

**CR 根拠**: 508.1b(attacked player/PW)/508.1f(non-vigilance tap)/509.1h(blocked 判定)/510.1a・510.1b(combat damage 割当)/510.2(simultaneity)/120.3a(life loss)/120.8(0以下は割当なし)。

**1. 型**: `CombatTarget = { type: 'player'; playerId: PlayerId; lifeLabel?: string }`(**planeswalker variant は足さない=player only**)。`lifeLabel` = rules の player identity から app の opponent-life map への bridge。`OPPONENT_A` は `lifeLabel ?? '対戦相手A'`、`P1` は `state.life`。

**2. `resolveCombatDamage` の player damage**: 未ブロック attacker(`blockedBy.length===0`)で stored object が live battlefield creature かつ target が player なら `max(0, effectivePower)` をその player へ割当(CR510.1a/510.1b/120.8)。**player ごとに集計**して creature damage と**同一 draft 上**で life 減算(CR510.2 atomic)。public `adjustLife`/`adjustOpponentLife` の serial 連発で表さない(内部 draft helper)。新 SBA 無し。opponent life は0未満可。

**3. `declareAttack` 互換ラッパ(Option A)**: store `declareAttack(attackerIds, targetLabel)` は legacy UI API として残すが、内部は `enterCombat(P1→OPPONENT_A)` → `declareAttackers`(各 target に `lifeLabel:targetLabel`)→ `declareBlockers([])` → `resolveCombatDamage` の単一 commit。non-vigilance tap は `declareAttackers`(CR508.1f)が担う(旧重複 tap 除去)。commit 後に従来通り attack pending triggers を append。**二重ダメージ経路を解消=life は `resolveCombatDamage` 経路のみで減る**。

**4. golden / test(4点不変条件③)**: slice 1 の `cr-combat-unblocked-attacker-no-creature-mark`(life 不変主張)を**削除**し `cr-combat-unblocked-attacker-damages-defending-player`(40→37・creature mark 無し)へ置換。追加 `cr-combat-blocked-attacker-does-not-damage-player`(blocked→life 不変)・`cr-combat-multiple-unblocked-attackers-aggregate-player-damage`(40→34)。受け入れ acceptance contract = `review.combat`(unblocked pin を player life loss 主張へ強化 + aggregate + blocked-no-player pin 追加)。回帰=m47/review.m47/review.m6_10/review.phaseC/triggerCandidates 全緑(declareAttack 依存)。

**5. スコープ境界(§34.5)**: planeswalker/battle combat target・trample-to-player(CR702.19/120.4a)・first/double strike・damage prevention/replacement/redirection(CR614.9/615)・infect/toxic/lifelink/wither の damage 結果(**plain life-loss のみ=これらキーワードで CR PASS 主張せず**・golden は vanilla creature)・combat-damage trigger 検出・commander damage 自動集計 → 全て後続 slice へ carry。

### 34.15 S-SBA defeat-state substrate(CR 704.5a/b/c loss conditions)— この節も契約である

**位置づけ**: §34.14(combat が player life を減らせる)に続く高レバレッジ slice = **敗北判定**。life-loss・poison・将来の commander damage(CR903.10)が全部この「player が負ける」機構へ集まる。設計正本=`research/cr-grounding/archive/s-sba-defeat/s-sba-defeat.draft.md`(Codex 草稿・Fable が CR 照合し承認)。**substrate(state + SBA)のみ。advisory に留め強制終了しない**(サンドボックス哲学=最大リスク)。

**CR 根拠**:
- CR 704.5a: life total が 0 以下の player は敗北。
- CR 704.5b: 前回 SBA チェック以降に**空ライブラリから draw を企図**した player は敗北。
- CR 704.5c: poison counter 10 個以上の player は敗北(2HG は CR704.6b・本 slice 対象外)。
- CR 104.3b/c/d: いずれも「次に priority を得る時点で・SBA として」敗北。CR 704.1/704.3/117.5: SBA は priority 前にスタック非使用で fixed-point まで反復。
- CR 104.5: CR では敗者は game を離れる。**本アプリは advisory のみ記録し続行可**=この差分を文書化する(サンドボックス)。

**1. 型契約(`src/engine/types.ts`)**:
```ts
type DefeatReason = 'lifeZero' | 'emptyLibraryDraw' | 'poison';
type DefeatPlayerRef = 'P1' | `opponent:${string}`;
interface DefeatAdvisoryRecord { reasons: DefeatReason[]; ruleRefs: Partial<Record<DefeatReason, '704.5a'|'704.5b'|'704.5c'>>; advisory: true }
interface GameState {
  // 既存 life / opponentLife / poison が数値の真理源(重複フィールドを足さない)
  defeat: Partial<Record<DefeatPlayerRef, DefeatAdvisoryRecord>>;
  emptyLibraryDrawAttemptedSinceLastSba: Partial<Record<PlayerId, boolean>>;
}
```
`state.life`=`P1`、`state.opponentLife[label]`=`opponent:${label}`、`state.poison`=`P1`(opponent poison は per-opponent 未モデルゆえ defer)。前方互換: 旧 snapshot の欠落は両フィールドとも `{}` へ backfill(`normalizeSnapshotState`)、不正 reason は drop。

**2. event metadata(`src/engine/types.ts`)**: `DefeatAdvisoryEvent{ type:'defeatAdvisory'; reason:'sba'; sbaApplied:'704.5a'|'704.5b'|'704.5c'; simultaneousGroupId; playerRef:DefeatPlayerRef; defeatReason:DefeatReason; advisory:true }` を `GameEvent` union に追加。**zone change を捏造しない**(敗北はカードを動かさない)。`GameEvent = ZoneChangeEvent | DefeatAdvisoryEvent`。

**3. draw hook(`src/engine/commands.ts`)**: `drawCards` は1枚ずつ引き、空ライブラリで個々の draw を企図したら `emptyLibraryDrawAttemptedSinceLastSba.P1=true`(CR121.2/121.4/704.5b)。**multi-draw 途中で尽きた場合も最初の不可能 draw でセット**(`library.length===0` 事前チェックだけの実装は不可=golden で縛る)。`count<=0`/`mill`/`arrangeTop`/`moveCard` 等の非 draw 経路はセットしない(CR121.5 mill≠draw)。turn-based draw step も同 hook を通す。

**4. SBA(`performStateBasedActionsOnce`・既存 704.5g/h と同枠)**:
- `lifeZero`: `state.life<=0` で `defeat.P1` に未登録なら追加 + event(`704.5a`)。各 `opponentLife[label]<=0` も独立に `opponent:${label}` へ。
- `emptyLibraryDraw`: flag が true で未登録なら追加 + event(`704.5b`)。
- `poison`: `state.poison>=10` で未登録なら追加 + event(`704.5c`)。
- **要石(Fable 裁定)= idempotent + fixed-point clean**: (a)既登録 reason は再 emit しない(数値的に成立し続けても=CR では離脱するが本アプリは続行ゆえ無限ループ防止)。(b)`emptyLibraryDrawAttemptedSinceLastSba` は**観測した SBA チェックで必ずクリア**(CR704.5b「前回 SBA 以降」の interval を体現)。**(c)flag クリアは bookkeeping であり、それ単独では `performStateBasedActionsOnce` の戻り値 `true`(=SBA performed)にしない**——新 advisory reason の追加時のみ `true` を返す(クリアによる余分な 1 反復を避け CR704.3 の fixed-point 意味を保つ)。同一 pass の複数 reason は単一 `simultaneousGroupId`(CR704.3)。

**5. サンドボックス / advisory ポリシー(最大リスク)**: 敗北を **hard-enforce しない**=game 終了・state クリア・コマンド封鎖・phase/turn 移動封鎖・player 離脱を**してはならない**。advisory state を立て metadata/log/warning を出し、ユーザーは続行可能(CR104.5 と本アプリの差分)。UI は警告 banner/marker を表示してよいが engine state は操作可能なまま。

**6. golden / test(4点不変条件③)**: `golden-cases.json` に life-zero/empty-library-draw/poison-threshold/advisory-continuation/snapshot-forward-compat を CR 付きで追加(草稿=`research/cr-grounding/archive/s-sba-defeat/s-sba-defeat-golden.draft.md`)。受け入れ acceptance contract = `src/store/__tests__/review.sba-defeat.test.ts`(**レビュー専有**=life=0/opponent label 独立/poison 9↔10 境界/empty-draw flag クリア/mill≠draw/fixed-point 終端+非重複/advisory 非強制/704.3 simultaneity/forward-compat/903.10 defer の敵対 pin)。新 state の不変条件(reason は3種のみ・各 ruleRef 対応・flag は SBA 跨ぎで非持続)を維持。

**7. スコープ境界(§34.5・PASS に混ぜない=4点不変条件④)**: commander damage 敗北(CR903.10a・次 slice=本 substrate の上に乗る)・複数人同時敗北の draw 細部(CR104.4a)・実際の game 終了/winner 決定/離脱処理(CR104.1/104.5)・2HG team life/poison 閾値(CR704.6a/b)・opponent poison(per-opponent counter 未モデル)→ 全て carry。substrate(defeat state + SBA)は壊さず後付け可能。

**(運用注記)** `.claude/`(git worktree チェックアウト)を eslint ignore と vitest exclude に追加=worktree 複製が重複テスト/lint 汚染を起こす問題を config で解消(slice 2 で同梱)。

### 34.16 S-SBA commander-damage defeat advisory(CR 903.10a)— この節も契約である

**位置づけ**: §34.15 の敗北 substrate の上に乗る**4つ目の advisory reason**。新 substrate ではなく、既存の advisory record・event metadata・SBA 固定点ループに **1 reason・1 rule ref・1 分岐**を足すだけ。設計正本=`research/cr-grounding/archive/s-903-10a-commander-damage/s-903-10a-commander-damage.draft.md`(Codex 草稿・Fable が CR 照合し承認)。**advisory に留め強制終了しない**(サンドボックス哲学)。

**CR 根拠**:
- CR 903.10a: 同一の commander から通算 21 点以上の**戦闘ダメージ**を受けた player は敗北。「これは state-based action(CR704 参照)」。
- CR 104.3j: 同条件を losing-the-game 一般規則側で SBA として再掲。
- CR 704.3/117.5: SBA は priority 前にスタック非使用で、1 チェック内は同時に実行し、何も起きなくなるまで反復。
- CR 702.124d: partner の 2 人の commander は 21 点判定で**別々に数える**(2 ラベルの合算禁止)。
- CR 104.5: CR では敗者は game を離れる。本アプリは advisory のみ記録し続行可(§34.15 と同じ差分)。

**1. 型契約(`src/engine/types.ts`)**:
```ts
type DefeatReason = 'lifeZero' | 'emptyLibraryDraw' | 'poison' | 'commanderDamage';
type DefeatRuleRef = '704.5a' | '704.5b' | '704.5c' | '903.10a';
// commanderDamage は既存の Record<string, number>(key=対戦相手統率者ラベル・自由文字列)が
// 唯一の数値真理源。commanderDamageDefeat / per-label defeat state / commander object 同一性 /
// per-opponent damage matrix を本 slice で足さない。
```
現 `commanderDamage[label]` は「同一 commander/source ラベルが `P1` へ与えた damage」の粗い counter と解釈する。target-player keyed な commander-damage map が無いため、本 slice は **`defeat.P1` の advisory のみ**生成する。

**2. event metadata(`src/engine/types.ts`)**: `DefeatAdvisoryEvent` の `sbaApplied`/`defeatReason` union を `'903.10a'`/`'commanderDamage'` へ拡張。commander-damage 敗北は §34.15 と同じ非 zone-change 形(`type:'defeatAdvisory'`, `reason:'sba'`, `playerRef:'P1'`, `advisory:true`)。**zone change を捏造せず・カードを動かさず・物理カードへ紐付けない**。

**3. SBA(`performStateBasedActionsOnce` / `applyDefeatStateBasedActions`)**:
- `DEFEAT_RULE_REFS` に `commanderDamage:'903.10a'` を追加。警告ラベルは `統率者ダメージ21点以上` 等。
- 分岐 1 本追加: いずれかの `state.commanderDamage[label] >= 21` かつ `defeat.P1.reasons` に `commanderDamage` 未登録なら `addDefeatAdvisory(draft,'P1','commanderDamage',simultaneousGroupId)`。
- **ラベル独立**: 異なるラベルの値を合算して 21 に届かせない。単一ラベルが `>= 21`(CR702.124d)。
- **要石(idempotent + fixed-point clean)**: 既登録なら counter が `>= 21` のままでも再 emit しない=無限ループ防止(CR704.3)。`performStateBasedActionsOnce` は**新 reason 追加時のみ `true`**。
- 同一 pass で `lifeZero`/`emptyLibraryDraw`/`poison` と同時に成立したら全 event が単一 `simultaneousGroupId`、各 reason は自分の `ruleRefs` エントリを持つ(CR704.3)。

**4. サンドボックス / advisory ポリシー**: game 終了・state クリア・コマンド封鎖・phase/turn 移動封鎖・player 離脱・winner 決定を**してはならない**(CR104.3j/104.5)。counter を後から 21 未満へ下げても advisory record は append-only(CR では既に敗北・本アプリは「CR なら敗北」を記録し続行)。

**5. 状態不変条件**: I13 を 3 reason → 4 reason へ拡張(`commanderDamage -> 903.10a`)。`defeat.P1.reasons` は SBA チェックが `commanderDamage[label] >= 21` を観測した後のみ `commanderDamage` を含む。`defeat['opponent:${label}']` は本 slice で `commanderDamage` を受け取らない。snapshot 前方互換は `commanderDamage`/`903.10a` を既知 reason として保存し、不正 reason は drop。

**6. golden / test(4点不変条件③)**: `golden-cases.json` に 20/21 境界・20→21 遷移・ラベル非合算・独立閾値・idempotent 非再 emit・§34.15 reason との同時 grouping・source 境界・snapshot 前方互換を CR 付きで追加(草稿=`research/cr-grounding/archive/s-903-10a-commander-damage/s-903-10a-golden.draft.md`)。受け入れ acceptance = `src/store/__tests__/review.903-10a.test.ts`(レビュー専有)。§34.15 の `review.sba-defeat` にあった「903.10a は defer」pin は本 slice 実装で advisory-level 実装へ反転済み。

**7. スコープ境界(§34.5・PASS に混ぜない=4点不変条件④)**: per-opponent-exact commander damage・commander `cardId`/object 同一性 attribution・combat damage から counter への自動帰属・dummy opponent player object・multiplayer 同時敗北/draw 細部・2HG → 全て `cr-player-specific-zones` 設計凍結後へ carry。substrate は壊さず後付け可能。

### 34.17 S-ZONES player-specific library/hand/graveyard(design-lock・CR 400.1/400.3)— この節も契約である

**位置づけ**: late-backbone **design-lock**。実装より先に保存形式・owner routing・snapshot backfill を凍結する(spec-first=「仕様変更はまず spec を更新してから実装する」)。**本節はコード契約を規定するが実装は後続スライス**(§34.17 は凍結、`zonesByPlayer` 実体は未実装)。設計正本=`research/cr-grounding/s-zones-player-specific.draft.md`(Codex 草稿・Fable が CR 照合し fork 承認・2026-07-02)。903.10a の正直形(per-opponent)・per-player draw/mill/search が全部この上に載る(最高 fan-out)。

**CR 根拠**: 400.1(library/hand/graveyard は各 player 私有、battlefield/stack/exile/command は共有)・400.3(private zone への移動先は object の owner の対応ゾーン)・400.6(zone-change event が実移動を決定)・401.1/402.1/404.1(各 zone 定義)・108.3/111.2(owner)・903.10a(per-target/per-source commander damage が本モデル依存)。前提=既存 M2 owner/controller substrate(`CardInstance.ownerId`・`PlayerId = 'P1' | 'OPPONENT_A'`)。

**凍結した fork 決定(Fable 裁定・4点)**:
1. **保存形 = `zonesByPlayer: Record<PlayerId, { library; hand; graveyard }>`**(単一マップ・CR400.1)。battlefield/stack/exile/command は既存 flat `zones` に共有のまま。移行中は flat `zones.library/hand/graveyard` を `zonesByPlayer.P1` の **P1 mirror**(独立真理源にしない)。
2. **opponent = 一級 `PlayerId`**(CR400.1・903.10a)。`OPPONENT_A` を既定 opponent id とし既存ラベル `対戦相手A` と bridge。`opponentLife` は互換ビューとして残し同スライスで削除しない。commander damage の正直形は `target player → source commander(安定 identity・transient objectId 不可)→ 量`(per-opponent は別スライス)。
3. **snapshot backfill = lossless P1 preservation-first**(CR400.1・[[snapshot-forward-compat]])。旧 flat private zones を順序保存で `zonesByPlayer.P1` へ、既知 opponent は空 zone。混在 owner の legacy を restore 時に CR400.3 修復しない(次の zone-change command が強制)。
4. **移行 = progressive**(flat を P1 mirror として残す漸進)。full cutover は command/golden/review が player-aware helper へ移行後。

**不変条件(I17〜・実装スライスで `review.*` 固定)**: I14/I15/I16 は既存(event 決定性/eff-char 純粋性/前方互換)ゆえ I17 から採番。I17 owner presence(108.3/111.2/400.3)・I18 private-zone owner routing(400.3/400.6)・I19 private zones disjoint(400.1 + 既存 I1)・I20 P1 mirror consistency(移行安全)・I21 backfill preservation(400.1/401.1/402.1/404.1 + 前方互換)を実装スライスと同時に昇格。I22 commander damage target/source separability(903.10a)は exact matrix 実装時・I23 per-player draw/mill/search isolation は該当 command 実装時に昇格。

**backfill 規律**: owner を先に P1 backfill → invariant 評価。missing `zonesByPlayer`/player/zone は空配列で補完(`undefined` 厳禁=旧 snapshot crash)。`zonesByPlayer.P1` と flat 併存時は **flat が正**で `zonesByPlayer.P1` を再構築する(fork決定1=flat は独立真理源にせず P1 mirror であり続けるため、flat から常に導出する。既存 `zonesByPlayer.P1` の値は使わない。2026-07-05 実装スライスで表現を明確化)。private-zone event snapshot は zone id + zone owner id を持つ(shared zone は owner 省略可)。

**スコープ境界(混ぜない)**: full multiplayer turn structure/turn order・dummy opponent 挙動・AI・real per-player priority・hidden-info UI(opponent hand/library 可視性)・opponent deck import/search UI・combat → commander damage 自動帰属。S-ZONES は**保存形式・owner routing・event metadata・backfill のみ**凍結。

**実装出荷(2026-07-05・Codex実装 → J3 Tier-1独立監査(冷Sonnet)→ HIGH 2件発見・J3 外科修正 → reviewer pin)**: `GameState.zonesByPlayer: Record<PlayerId,{library,hand,graveyard}>` を凍結設計どおり additive で実装(`src/engine/types.ts`)。flat `zones.library/hand/graveyard` は P1 mirror であり続け、`zonesByPlayer.P1` は常に flat から導出(`syncP1ZonesByPlayerFromFlatZones`)。`initGame`/`applyCommand`/`restoreGame` normalize の各出口で同期。**本スライスはstorage shape + 同期のみ**=個別command(moveCard等)を player-aware 化しない(progressive migration、fork決定4どおり)。

**Tier-1 監査で発見・修正した HIGH 2件**: (1) 公開 export 関数 `performStateBasedActions`(`src/engine/commands.ts`)が SBA 駆動の zone 変更(CR704.5g 致死破壊等)後に `zonesByPlayer.P1` を再同期せずに返していた(他の全 `ApplyResult` 返却経路は同期済みだったが、この経路だけ漏れていた)。現状 store 本体からは未配線(`advanceToPriority`/`performStateBasedActions` は `priority.ts` のテストからのみ到達可能)ゆえ本番の可観測バグではないが、将来 store がこの経路を配線した瞬間に stale mirror を継承する地雷だったため、判定者が同型の同期呼び出しを追加(1行の外科的修正)。(2) flat private zones は owner 非区分(単一共有配列)のため、`ownerId!=='P1'` のカードが flat graveyard/hand/library に存在する状態(既存 cr-400-408 系テストの `withOwner` パターンで構築可能)では、そのカードが `zonesByPlayer.P1` へ誤って mirror される。これは §34.17 自身の backfill 規律文(「混在 owner の legacy を restore 時に CR400.3 修復しない」)が既に許容する既知の境界であり、real owner-based private-zone routing は本スライスのスコープ外(将来 slice へ carry)。判定者がこの**現況を review.* へ明示 pin**し、silent gap ではなく documented boundary として可視化した。他の adversarial 項目(order-preservation・snapshot 前方互換・purity/determinism・scope discipline=既存 command は player-aware 化せず)は独立監査で無欠陥確認。受け入れ=`review.cr102-players-zones.test.ts`(レビュー専有・7 pin)。

### 34.18 S-EVENTS: life/damage/draw event envelope(CR 119/120/121)— この節も契約である

**位置づけ**: 既存 Z2/Z3 `ZoneChangeEvent` scaffold に続く最初の S-EVENTS substrate slice。CR119 life change・CR120 damage・CR121 draw・CR400.6 zone-change を**共通 event envelope** に載せ、後続の replacement/prevention(CR614/615)・triggered ability 購読(§34.1 C-C)が同一 surface を hook できるようにする。設計正本=`research/cr-grounding/archive/cr-119-life/s-events-life-envelope.draft.md`(Codex 草稿・Fable が CR 照合し承認・2026-07-02)。受け入れ=`src/store/__tests__/review.s-events-envelope.test.ts`(レビュー専有・12 pin)。

**CR 根拠**: 119.3(life gain/loss は total 調整)・119.9/119.10(0 life gain は非 event)・120.1(damage は source が与える)・120.8(0 damage は非 event・trigger しない)・121.1(draw=library top→hand)・121.2(multi-draw は個別)・121.5(「draw」語無しの library→hand は draw でない)・121.4/704.5b(空 draw attempt)・400.6/400.7(zone-change event は move 前確定・move 後は new object)・614.1/615.1(replacement/prevention は event を watch=本 slice は envelope + hook のみ・engine は defer)。

**envelope 契約**: `GameEvent` union を additive 拡張(discriminant は既存 `type` 維持・`ZoneChangeEvent`/`DefeatAdvisoryEvent` を rename/削除しない)。新 kind = `lifeChange`・`damage`・`draw`(型詳細=草稿の `EventEnvelopeBase`/`LifeChangeEvent`/`DamageEvent`/`DrawEvent`)。共通 base = eventId/sequence(決定的)・simultaneousGroupId?・cause/causeEventId?・replacementApplied?/preventionApplied?(metadata hook のみ)。

**凍結挙動**:
- **lifeChange**: 非0 変化のみ emit(`delta>0`=gain・`<0`=loss)。`delta===0` は emit しない(CR119.9/119.10)。previousLife/nextLife/playerId 記録。life≤0 は SBA 境界で advisory のみ(hard-enforce しない・CR104.3b/704.5a)。
- **draw**: 成功=`result:'drawn'` + library→hand `ZoneChangeEvent` への `zoneChangeEventId` link(CR121.1/400.6)。空=`result:'empty-library-attempt'`(card identity 無し・CR121.4/704.5b)。multi-draw は1枚ずつ個別(aggregate 禁止・CR121.2)。mill は DrawEvent を emit しない(CR121.5)。
- **damage**: 本 slice は **union type 追加のみ**。source-backed emission は combat/damage slice へ defer。**source-less markDamage は trigger-eligible CR120 damage event を emit してはならない**(CR120.1)。0 damage 非 event(CR120.8)。damage-result link(lifeChange 等)は shape のみ予約。
- **I14(event 決定性)**: 同一 state + command → 同一 appended event 列 + 同一 id。Date/time・非ソート iteration・applyCommand 中 RNG に依存しない(乱数は payload 確定済み)。
- **前方互換**: union member 追加ゆえ新規必須 state field 無し。missing `eventLog`→`[]`。legacy event(新 optional field 無し)valid。`CACHE_SCHEMA_VERSION` 変更不要。

**スコープ境界(§34.5・PASS に混ぜない)**: replacement/prevention engine(CR614/615=late-backbone)・実カード triggered ability 検出(CR603.2/603.3=C-GRAMMAR)・combat source 帰属/commander damage/trample/infect/wither/lifelink/toxic(CR120.3/120.4/903.10a=後続 damage-result slice)・player-specific private zone owner metadata(§34.17 実装後)・mana transaction event の global 昇格(§34.11)→ 全 carry。

### 34.19 S-ACTIVATED-ABILITY envelope(CR 602 + 115 + 118 + 605)— この節も契約である

**位置づけ**: plannedSequence[0]・MyDeck 採点(2026-07-02)で判明した**実デッキ最大需要**=活性化能力イディオム({T}: / {cost}, Sacrifice: 等)への demand-first gate。**design-lock**(実装より先に envelope 形を凍結・spec-first)。既存 §33(G4 起動型コスト精算)・§34.11(マナ transaction)は**既にある**=§34.19 はその周りに activation envelope を凍結し**restate しない**。設計正本=`research/cr-grounding/archive/cr-602/s-activated-ability-envelope.draft.md`(Codex 草稿・Fable が CR 照合し承認・2026-07-02)。**本節はコード契約を規定するが実装は後続スライス**。

**CR 根拠**: 602.1(活性化能力=`[Cost]: [Effect]`)・602.2(activate=stack へ置き cost 支払い。**途中で従えなければ activation は不成立=直前へ巻き戻す**=atomicity の CR 根拠・CR733)・602.2b(**601.2b-i が activation に適用**・activation cost=mana cost の analog)・117.1b(優先権中に起動可)・117.3c/117.7(stack 順)・118.3(**必要資源が無ければ cost を払えない=部分払い不可**・既 tap 済は tap 不可)・601.2f-h(total cost 確定→lock→支払い)・115.1c(**対象は activation 時に選ぶ**・see 602.2b)・115.2/115.3(legal target・同一 target 重複不可)・605.1a(マナ能力=無 target・マナ生成可・非 loyalty)・605.5a(**target 有りはマナ能力でない**)・605.3b/405.6c(マナ能力は stack 不使用・即時)。

**凍結した envelope(4点・Fable 裁定)**:
1. **activation envelope**: `sourceRef`(自己犠牲コスト等で source が先に動くため LKI)・`abilityLineIndex`・`cost`(下記)・`targetSelections`(activation 時選択・stack object に保存)・`stackPolicy`(`stack` | `mana-transaction-no-stack`)・`paymentMode`(`rules-legal` | `forced`)。**保存先=stack ability object**(`addAbilityToStack` の CardInstance を拡張・fork A 採用=対象は stack 置き時に宣言され undo/redo が単一 object を復元・CR115.1/602.2b)。
2. **cost envelope**: `mana`/`tap`(self `{T}`+将来 object-tap)/`nonmana`(sacrifice・pay-life・discard・remove-counter・pay-player-counter・exile 等)を正規化。component=`kind`/`raw`(oracle 断片)/`payerId`/`subjectRef`/`amount`/`status`(`auto`|`guided`|`manual`|`unparsed`)。既存 §33 `compileAbilityCost` が `mana`/`tap-self`/`sacrifice-self` を auto、それ以外は envelope が component identity を記録(auto を騙らない)。**§33 を wrap し replace しない**。
3. **target envelope**: activation 時に object/player を選び stack object へ保存(CR115.1c/602.2b)。slot=`slotId`(target 語ごと)/`raw`/`kind`(`object`|`player`|`object-or-player`・player は `PlayerId`)/`selection`(objectId+snapshot で zone 変化後の別 object と区別・CR115.9b)/`legalityMode`(`checked`|`unchecked-warning`|`forced`)。G3 guided prompt は UI 配管として再利用可だが**回答は stack 置き前に envelope へ確定**(解決時まで対象選択を遅延しない)。illegal target 解決は CR608 へ defer。
4. **stack vs no-stack**: 通常起動型=`stack`(1 stack ability object=source+line+targets+cost summary・効果は activation 中に解決しない)。CR605.1a マナ能力(activated・無 target・マナ生成可・非 loyalty)のみ `mana-transaction-no-stack`=§34.11 経由で即時・`addAbilityToStack` を作らない。**target 有り add-mana は通常 stack**(605.5a)。`effectsAuto` は no-stack の rules switch でない(自動 off でもマナ能力を通常 stack 化しない=§33 I9 / §34.11 と整合)。

**atomicity(要石・Fable 裁定)**: `rules-legal` mode では cost 支払い + stack/no-stack activation は**単一 activation transaction**。必要 modeled cost が払えない or 必要 target/cost 選択が欠ける場合、**cost command も activation も一切 commit しない**(CR602.2/118.3/601.2h)。`forced` mode(サンドボックス脱出弁)は同 batch を warning 付きで commit してよいが、**その activation を CR-legal と表示/log してはならない**。

**不変条件候補(I 番号は実装スライスで採番・review.* で固定)**: cost atomicity(602.2/118.3)・cost determinism(同一 state+source+line+answers+force→同一 envelope+command batch・乱数は payload 確定)・target determinism(activation 時 target を stack object に保存・解決は保存値使用・silent re-enumerate 禁止)・target/cost UI 非変更(picker 開閉/cancel は state 不変更・確定時のみ commit)・normal stack placement(nonmana は1 stack object・activation 中に効果解決しない)・mana ability isolation(605.1a は `manaTransaction` 経由・stack/pending-trigger に混ぜない)。

**スコープ境界(§34.5・PASS に混ぜない)**: 個別カード効果 leaf compiler(stack 後の効果実装)・illegal target 解決(CR608)・複雑コスト/コスト増減/convoke/delve/X 拡張(§33 超)・loyalty 能力(CR606)・full CR601 casting(modes/alt-cost/cast-from-zone)・activation restriction 完全 enforcement(`Activate only as a sorcery`/once-per-turn/召喚酔い=warning 可・完全禁止追跡は非対象)・opponent-chosen target/mode(CR602.3)→ 全 carry。envelope は **cost/target/stack-no-stack の形の凍結のみ**。

### 34.20 cr-703-704-sba-turn-based: pendingRuleChoices と SBA 同時性の既知境界(CR 703/704)— この節も契約である

**現況訂正**: legend rule(CR 704.5j)は Q5 Phase 1(commit `c6dcb7c`・2026-06-30)で `pendingRuleChoices`(kind:`legend-rule`)として**既に実装済み**(`ruleChoices.test.ts` の `cr-legend-rule-choice` で reviewer-pinned)。commander-zone(CR 903.9a)と同じ `PendingRuleChoice` union 上に載る共有 substrate。台帳 `cr-703-704-sba-turn-based` の旧 `nextGate` 文言「legend/attachment系 SBA はchoice/attachment設計後に回す」は legend rule に関する限り陳腐化していた(commander-zone の一般化=cr-903-9-commander-zone-choice 側の nextGate としては引き続き有効)。

**既知の CR 704.3 非同時性境界**: `performStateBasedActionsOnce`(src/engine/commands.ts)は `pendingRuleChoices.length > 0` の間、**他の全 CR 704.5 条件チェックより先に** `false` を返す=legend-rule/commander-zone のいずれか一方が pending なだけで、それと無関係な SBA(例: 704.5a life-zero)も次パスまで deferred される。CR 704.3 の「all applicable state-based actions は simultaneously として 1 event で performed」という文言には厳密には非一致(前身 Tier-1 所見=「plausibly correct・untested edge, not a known defect」)。**本節はこの挙動を再設計しない**(pendingRuleChoices の複数同時グループ一般化は cr-903-9-commander-zone-choice 自身の nextGate=将来スライス)。実デッキ需要=0(MyDeck 採点に非出現)。

**閉じたgap(2026-07-04・reviewer pin)**: `src/store/__tests__/review.cr703-704-sba-turn-based.test.ts` が上記の deferred-then-resolves-on-next-pass 挙動を end-to-end で pin(legend-rule pending 中の life-zero dispatch → defeat advisory 未発生 → 選択解決 → 次パスで正しく検出、state 消失/crash なし)。「golden未整備」だった観測ギャップを解消。挙動自体は不変(既存の広範な pin 群=`ruleChoices.test.ts`・`review.sba-defeat.test.ts`・`review.903-10a.test.ts`・golden-cases が既にカバー)。

### 34.21 S-LINKED-EXILE / LKI substrate(design-lock・CR 400.7 + 406 + 607)— この節も契約である

**位置づけ**: cr-400-408-zones-lki batch2-5。**design-lock(spec-first)**=§34.17 S-ZONES / §34.19 activation envelope と同方式で、**実装より先に設計を凍結し実装は後続スライス**。本節はコード契約の形を規定するが、review.* pin と実装は実装スライスで行う(§34.17 が status=drafted で凍結した前例に倣う)。設計正本(living)=`research/cr-grounding/cr-400-408-linked-exile.draft.md`(Codex 起草・J2 Opus が CR 照合し command surface を裁定して凍結・2026-07-05)。simple target exile(§32.9 guided `moveCard→exile`)と CR400.7 new-object identity / LKI core(§34.15 系・objectIdOf / ObjectSnapshot / ZoneChangeEvent)は**既に review-green**で、本節はその上に link 層を足す。

**CR 根拠**: 607.2a(`exiled with [this object]` はリンク能力=第1能力が exile した card のみ第2能力が参照)・400.7(zone 移動=新 object・過去の記憶なし)・400.7j(同一効果/コストが public zone へ動かした object を後続部分が見つけられる=blink same-resolution return)・406.2/406.5(exile へ置く=exiling・後で戻る/参照する card は別 pile で追跡)・603.10a(LTB 等 look-back 誘発は LKI)・608.2h(object が期待 public zone に在れば現在情報、無ければ LKI=return guard の根拠)。607.2b(replacement 由来 linked exile)は defer。

**凍結した設計(4点)**:
1. **state 形**: `GameState.linkedExiles: Record<LinkedExileId, LinkedExileRecord>`(additive・linkId keyed)。record = `{ linkId, purpose:'exiled-with-source'|'temporary-return', sourceObjectId, sourcePhysicalId, exiledPhysicalIds[], exiledObjectIds[](本スライス length 1・multi は defer), snapshot(ZoneChangeEvent.before 由来), createdSequence }`。詳細型は draft §3。
2. **command surface(J2 裁定)**: **新 GameCommand 型を追加しない**(§32.9/§34.19 の discipline 継承・substrate でも最小に保つ)。record 生成は既存 `moveCard` の optional payload 拡張(`sbaApplied`/`simultaneousGroupId`/`replacementApplied` と同型に `linkedExileWrite?` を足す)で ZoneChangeEvent から書く。return guard と record 消費は**ストア層 orchestration**(既存 `confirmGuidedLibrarySearch`/`moveCommanderWithZoneChoice` と同じ統治=store が state.linkedExiles を読み guard を判定し既存 command を dispatch)。draft §7 が提案した 3 新 command(`exileLinkedObject`/`returnLinkedExile`/`consumeLinkedExileRecord`)は**採用しない**——moveCard-payload + store で表現可能かを実装スライスがまず試み、真に不可能と独立監査が確認した場合のみ最小 1 command を fallback とする。
3. **object-identity 意味論**: `exiled-with-source` record は `sourceObjectId`(=`objectIdOf(source)`)に紐付き、source が zone 変化し新 object になったら旧 record は新 object から参照されない(CR400.7/607.2a)。消費判定は `current.id===record.sourcePhysicalId && objectIdOf(current)===record.sourceObjectId` の両立を要求(physical id 一致だけでは不可)。LTB source 誘発は誘発の `sourceSnapshot.objectId`(移動前 incarnation)で突き合わせる。
4. **blink(temporary-return)意味論**: exile→record→(same-resolution=CR400.7j / delayed=既存 `pendingTriggers` + `'delayed-triggered'` kind)で return。return 時 `record.exiledObjectIds[0]` が今も exile に在る(=その objectId の card が zone==='exile')場合のみ battlefield へ戻し、無ければ warn/no-op(盲目に同一 physicalId を別ゾーンから動かさない・CR603.10a/608.2h)。

**snapshot 前方互換(要石・[[snapshot-forward-compat]])**: 新 field ゆえ `restoreGame` が旧 snapshot を `linkedExiles:{}` へ backfill(既存 `pendingTriggers`/`pendingRuleChoices` normalize と同型)。SNAPSHOT_VERSION は据え置き(optional field 欠落は normalize で吸収する既存規律)。仮不変条件 `I-linked-exile-fwdcompat`=「restoreGame 後 state.linkedExiles は常に object」を実装スライスで採番し review.* で pin。`createDraft` は他 mutable container 同様 linkedExiles を shallow-clone(engine 不変性)。

**スコープ境界(§34.5・PASS に混ぜない)**: face-down exile piles/閲覧権(406.3/406.4)・multi-card `the exiled cards`・player-specific private zones(S-ZONES)・Path to Exile の opponent library search・replacement 由来 linked exile(607.2b=cr-614-615 後)・meld/merged/Adventure/foretell/plot/craft の card-family 例外。

**判定者裁定が要る残フォーク(実装ブリーフ確定前)**: (A)linkId 生成源=解決中 effect/ability の安定 id(J2 暫定=effect 単位束ね・CR406.6 と一致)。(C)record GC=当面しない(stale は objectId 不一致で無効化)。(D)戻し control=owner 固定(controller 指定は defer)。

**判定点B 解決(2026-07-05・J3 Sonnet・Explore 裏取り済)**: `'delayed-triggered'`(`classifyAbilityShape`)は**単なる文法分類ラベル**(`/\bthe next\b[^.]*\b(?:turn|end step|upkeep)\b/i` 検出)であり、`triggers.ts` は `'triggered'` と同一経路(既存 `pendingTriggers` への収集・手動 stack 配置)で扱う。`PendingTrigger`(types.ts)に `dueTurn`/`duePhase`/`delayUntil` 等の**未来スケジューリング field は存在しない**。`applyNextPhase`/`applyNextTurn` も次 turn/phase 到達時に何かを自動発火する仕組みを持たない。**結論=「ある効果の解決中に、後で(別の未来 turn/phase の時点で)戻す」という真の delayed schedule を刻む機構は現状ゼロ**。新設インフラ(スケジューリング primitive)が要る。

**本スライスのスコープ確定**: `temporary-return` は **same-resolution のみ**(exile と return が同一 ability 解決内で完結)を対象とする。これには **Thassa, Deep-Dwelling 型を含む**——Thassa の "At the beginning of **your** end step, exile up to one target creature you control, then return that card to the battlefield" は既存の通常 end-step trigger 配置フロー(`trigger.end-step`・`'delayed-triggered'` ではない=`"the next"` を含まない)で stack に置かれた**単一 ability の解決内**で exile→return が完結する=same-resolution。真に defer するのは「別の解決が**新規に**未来 turn/phase への delayed return を生成する」パターン(例: 「追放する。次の終了ステップの開始時に戦場へ戻す」を単発 sorcery/instant が生成するケース)のみ——これは新スケジューリング primitive が要るため本スライス対象外(将来 turn-phase scheduler 導入スライスへ)。

**実装出荷(2026-07-05・Codex実装 → J3 Tier-1独立監査 → J3 外科修正 → reviewer pin)**: `GameState.linkedExiles: Record<string, LinkedExileRecord>` を凍結設計どおり additive で実装(`src/engine/types.ts`)。record 書込は既存 `moveCard` の optional `linkedExileWrite?` payload 経由(**新 GameCommand 型は追加せず**=確定済み command surface 裁定を遵守)。`exiled-with-source` 消費は `consumeLinkedExileForSource`(physical id + object id 両一致必須)、`temporary-return` の same-resolution return/no-op guard は `returnLinkedExileToBattlefield`(store 側 `returnLinkedExile`)。`initGame`/`restoreGame`/`makeDraft` は snapshot fwd-compat(`linkedExiles:{}` backfill・shallow-clone)を実装。

**Tier-1 監査で発見・修正した BLOCKER**: `compile.ts` の `isSameResolutionBattlefieldReturn` が `$` anchor 欠如により delayed-return 文言("at the beginning of the next end step" 等)を trailing で許してしまい、真に manual であるべきパターンを same-resolution として誤って guided 化していた(印字された遅延を silently 無視=CR違反かつ判定点B の境界そのもの)。判定者が数行の外科的修正(`$` anchor + 任意の末尾ピリオド追加)を適用し、audit の adversarial input で再現・修正確認済み。他6項目(command-surface discipline・record書込正確性・identity guard・same-resolution atomicity・no-blind-move・snapshot fwd-compat)は独立監査で無欠陥確認。受け入れ=`review.cr400-linked-exile.test.ts`(engine 6 pin + store 5 pin・レビュー専有)。

### 34.22 S-DAMAGE: source-backed noncombat damage(`dealDamage`)(CR 120.1/120.3a/120.3e/120.8)— この節も契約である

**位置づけ**: cr-120-damage batch2-6。§34.18(S-EVENTS)が `DamageEvent`/`EventSourceRef`/`EventTargetRef` を type-only で予約し、「source-backed emission は combat/damage slice へ defer」と明記していた分を本節で埋める。既存の source-less `markDamage`(reviewer-pinned・`review.damage-marked.test.ts`)は不変のまま維持し、**別のコマンドとして** source-backed 経路を追加する(既存 pinned コマンドの拡張はしない=§32.9/§34.19/§34.21 と同じ command-surface discipline)。設計正本=`research/cr-grounding/archive/cr-120-damage/cr-120-damage-batch2-6.draft.md`(Codex 起草・J3 Sonnet が CR 照合し承認)。

**CR 根拠**: 120.1(damage を与える主体=source)・120.2b(spell/ability が source を指定)・120.3a(infect 無き source→player ダメージ=life loss)・120.3c(→planeswalker=忠誠カウンター除去。**本スライス対象外**)・120.3e/704.5h(infect/wither 無き source→creature ダメージ=marked damage のみ・直接破壊せず SBA が処理)・120.4b-d(replacement/prevention→results。**本スライス対象外**=§34.18 の metadata hook のみ carry)・120.8(0 以下のダメージ=非事象・状態変更なし)。

**凍結挙動**:
- 新コマンド `dealDamage`: `sourceId`・`amount`・`combatDamage`(既定 false・combat 経路からは呼ばれない)・`deathtouch?`・`targetCardId`(creature)と `targetPlayerId`(player)は**相互排他**(型上は `?: never` で表現。ランタイムでも両方指定は `EngineError` で明示 reject=silent fallback 禁止)。
- **player target**(CR120.3a): 既存 life 減算経路(`adjustLife`/`applyPlayerLifeDelta` 系)で life を減らし、emit した `LifeChangeEvent` の id を同時 emit `DamageEvent.damageResultEventIds` にリンク(§34.18 の draw result-link パターンに倣う)。
- **creature target**(CR120.3e/704.5h): 既存 `applyMarkDamage`(source-less 版と同一関数)を呼び `damageMarked`/`hasDeathtouchDamage` を更新。致死判定は既存 SBA 704.5g/h がそのまま処理(本スライスは触らない)。
- **planeswalker target**(CR120.3c): 本スライス対象外。`typeLineOf` で判定し `EngineError` を明示 throw(loyalty 除去も creature 同様の誤マークもしない=silent fallback 禁止)。
- **CR120.8**: `amount <= 0`(0 および負数)は `DamageEvent` を emit せず、状態も一切変更しない。
- combat 経路(`resolveCombatDamage`/`applyResolveCombatDamage`)は本スライスで migrate しない。既存 combat テストは無変更のまま green。
- grammar compiler(`effect.damage` の auto/guided 昇格)は本スライス対象外。

**Tier-1 監査で発見・修正した MEDIUM + 残余note**: `targetCardId`/`targetPlayerId` の相互排他は当初 TypeScript の `?: never` のみで保証され、ランタイムでは `targetCardId` 優先の分岐が無条件実行されるため、両方が同時に設定された不正な command は `targetPlayerId` を無言で無視していた(エラーなし)。同種の問題として、planeswalker 対象も明示的な拒否が無く creature と同じ marked-damage 経路に暗黙で落ちていた(CR120.3c 対象外のはずが誤ってマークされる)。判定者が数行の外科的修正(両方設定時の明示 `EngineError`・planeswalker target の明示 `EngineError`)を適用し、review.* で両ケースを pin。他の全adversarial項目(CR120.8 zero/negative・player/creature 経路・`markDamage`/combat 非regression・purity/determinism・event ref 正確性)は独立監査で無欠陥確認。受け入れ=`review.cr120-damage.test.ts`(レビュー専有・7 pin)。

**スコープ境界(§34.5・PASS に混ぜない)**: prevention/replacement/redirection(CR120.4a/b・614/615)・infect/wither/toxic/lifelink の数値効果・planeswalker/battle damage(忠誠除去の実装自体)・each-player/multi-target damage・variable/X damage・commander damage 自動帰属(既存 advisory-level のまま)。

### 34.23 cr-111-tokens: custom creature token leaf(`createDefinedToken`)(CR 110.5/111.2/111.3/111.4)— この節も契約である

**位置づけ**: cr-111-tokens batch2-7。既存 §32.8(predefined token leaf。固定数 Clue/Food/Blood/Treasure を既存 pinned `createToken` で auto emit)は出荷済み。本節はその残り=token:create 残32件のうち tapped token/custom creature token を埋める。**copy token(CR707)は完全 defer**(Option K0・判定者裁定)——MyDeck 実測の copy token 行は全件が最小 guided subset でも manual 落ちするため(target/exception/delayed cleanup/LKI 等)、実装しても実デッキ demand を1件も拾わない。設計正本=`research/cr-grounding/archive/cr-111-tokens/cr-111-tokens-batch2-7.draft.md`(Codex 起草・J3 Sonnet が CR 照合しT1+C1統合・K0 defer を裁定)。

**CR 根拠**: 110.5/110.5a/110.5b(tapped/untapped は status であり characteristic でない。効果が明示すれば既定 untapped を上書きできる)・111.2(token を作ったプレイヤーが owner・その支配下で戦場に入る)・111.3(生成する spell/ability が特性を定義でき、定義された値のみが copiable values=**定義されなかった特性〈ability text 含む〉を token は持たない**=ability text 付き token をability無しで生成することは許されない)・111.4(名前未指定なら subtype(s)+"Token")・701.7a(token生成=指定特性で指定数を戦場に置く)。

**凍結挙動**:
- 新コマンド `createDefinedToken`(既存 pinned `createToken` は無変更・拡張なし=§32.9/§34.19/§34.21/§34.22 と同じ command-surface discipline): `name`・`typeLine`・`power?`・`toughness?`・`quantity`・`createdBy?: PlayerId`(既定 P1)・`initialTapped?: boolean`(既定 false)・`tokenKind?`。owner/controller は `createdBy` から同時に設定(CR111.2、独立に設定しない)。
- compiler leaf: **fixed-count・fixed-P/T・単色・no-ability-text・no-target・no-modal** の custom creature token 生成文のみ `auto`。golden= Liliana, Dreadhorde General(「Create a 2/2 black Zombie creature token.」→ auto・untapped)・Tormod, the Desecrator(「Create a tapped 2/2 black Zombie creature token.」→ auto・tapped、CR110.5b の既定上書き)。
- **manual に残すもの(honest)**: ability text/keyword 付き token(CR111.3=定義されない特性の欠落を防ぐ)・variable count(X/for-each/die roll)・modal choice・複数種類 token 混在・copy token 全般・tapped-and-attacking。
- 既存 predefined token leaf(§32.8・Treasure/Clue/Food/Blood)は本スライスの対象外・無変更。Ragavan の Treasure 生成部分は既存 `createToken` 経路のまま。

**Tier-1 監査で発見・修正した HIGH**: 単色前提の正規表現が「black **and** green Zombie」のような複数色 token 文で、2色目の色語と接続詞 "and" が汎用 subtype capture group に飲み込まれ、`typeLine: 'Token Creature — and green Zombie'` という**破損した結果を `auto`・confidence 0.95 で返していた**(スコープ外構文が fail-open=最高信頼度バケットで誤った結果を騙る)。判定者が数行の外科的修正(subtype capture 内に既知の色語が残っていたら parse 失敗として `null` を返し manual へ fail closed)を適用し、review.* で pin。他の全adversarial項目(ability-text/variable-count/copy-token/複数種類混在の非leak・"tapped"語 suppression の leaf-local性・owner/controller同時設定・`createToken`/`copyPermanent` 非regression・purity/determinism・snapshot forward-compat 不要)は独立監査で無欠陥確認。token color(CR文脈での色 characteristic)は state に保持されないが、現行 engine に色依存ロジックが無いため無害と確認(protection/color-filter targeting 実装時に再検討)。受け入れ=`review.cr111-tokens.test.ts`(レビュー専有・8 pin)。

**スコープ境界(§34.5・PASS に混ぜない)**: copy token(CR707・完全defer=Option K0)・ability text/keyword付きtoken・variable/X count・modal token生成・複数種類token混在・他プレイヤー作成token(`createdBy` 明示未対応の推論)・tapped-and-attacking・token color characteristic の保持。

### 34.24 cr-400-408-zones-lki: reanimation leaf(graveyard→battlefield return)(CR 109.2a/404.1/601.2c/602.2b/608.2b)— この節も契約である

**位置づけ**: cr-400-408-zones-lki batch2-8。既存 §34.21(S-LINKED-EXILE・blink サブスコープ)とは**別のサブスコープ**。既存 `effect.return` leaf は常に `moveCard(...,'hand')` のみ emit し、「return ... to the battlefield」(reanimation)は一切 auto/guided 化されていなかった(全 manual)。本節はその欠落を、**厳密な単一パターンのみ**埋める。設計正本=`research/cr-grounding/archive/cr-400-408-return/cr-400-408-return-batch2-8.draft.md`(Codex 起草・J3 Sonnet が CR 照合し承認)。

**CR 根拠**: 109.2a(「card」+ゾーン名の記述=そのゾーン内のカードを指す=「creature card ... from your graveyard」の根拠)・404.1/404.2(graveyard はプレイヤーの捨て札置き場・owner 紐付き・examinable)・601.2c/602.2b/603.3d(対象は cast/activate/trigger配置時に選ぶ)・608.2b(解決時に対象を再チェック。元のゾーンから外れていれば非合法)・400.7(zone移動=新オブジェクト=自己の生け贄コストで移動した直後の自分自身を同じactivationの対象として遡って選べない根拠)。

**凍結挙動**:
- `TargetFilter` 型拡張(既存 `moveCard` コマンドは無変更): `zone?: 'battlefield'|'graveyard'`(既定 battlefield=既存動作非破壊)・`owner?: 'any'|'you'|'opponent'`(graveyard card 用。`controller` とは別軸=graveyard card に controller 概念はない)。
- **厳密一致のみ guided/auto**: 「Return target creature card from your graveyard to the battlefield.」(修飾語なし)。`under your control`・tapped・attacking・`you may`・mana value cap・`permanent card` 一般化・他プレイヤー graveyard 等、いかなる変種も honest manual のまま(fail closed。正規表現は `^...$` 完全アンカー=部分一致の抜け道なし)。
- golden: Karmic Guide(nonoptional trigger)・Priest of Fell Rites(通常起動型能力のみ。Unearth 行は別途 manual)。Sun Titan は本スライスでは **boundary(manual)**=`permanent card`/mana value cap/optional target 全て対象外。
- **atomicity(要石・CR400.7/602.2b)**: 起動型(Priest型)の対象選択はコスト精算前(source がまだ battlefield にいる時点)の state に対して行うため、生け贄コストで移動する source 自身は**構造的に候補から除外**される(候補列挙の時点でまだ graveyard にいないため)。さらに解決時、`objectId`(=`zoneChangeCounter` 込み)の不一致により、たとえ強制的に自己を対象として構築しても独立して reject される(二重防御・Tier-1 監査で実地検証済み)。
- **CR608.2b 一般再チェック**: 選択後・解決前に対象が graveyard から離れた場合(自己犠牲によるものだけでなく、無関係な効果による場合も含め)、保存された expected zone と現在の zone が不一致なら解決を拒否する(battlefield へ移動しない)。
- owner boundary: `owner: 'you'` は P1 所有の graveyard card のみを候補にする(既存 `controller: 'you'` の battlefield 版と同型の 2-entity PlayerId 前提。cr-player-specific-zones 後に再検討)。
- 既存の return-to-hand(bounce)経路・linked-exile(blink)サブスコープは本スライスと無関係のまま無変更(共有する解決ブランチは `filter.zone === 'graveyard'` の場合のみ battlefield へ分岐する構造上、他の呼び出し元に影響しない)。

**Tier-1 監査で確認**: 0 BLOCKER/0 HIGH。Priest 自己ターゲット不可の atomicity は構造的除外+解決時再チェックの二重防御で健全と確認(強制不正選択を用いた実地検証込み)。CR608.2b の一般ケース(自己犠牲以外の要因で対象が graveyard を離れる場合)は実装済みだが実装側テストで pin されていなかったため、判定者が `review.cr400-408-return.test.ts` へ明示的に追加。他の全adversarial項目(修飾語拒否11パターン・owner境界・bounce非regression・purity/determinism・snapshot forward-compat不要)は無欠陥確認。残余note(LOW・非ブロッキング)= 厳密一致判定関数が compile.ts/commands.ts に重複定義(将来の拡張時に共有モジュール化を検討)。受け入れ=`review.cr400-408-return.test.ts`(レビュー専有・5 pin)。

**スコープ境界(§34.5・PASS に混ぜない)**: 他プレイヤー graveyard 参照・`under your control` 等の所有権移転変種・複数対象/up to/each/any number・mana value 等の数値フィルタ(Sun Titan型)・permanent card 全般拡張・tapped/attacking/haste付与等の修飾語・attachment/counter復元・代替処理("exile it instead"・delayed exile・Unearth)・自己(ターゲットなし)の墓地帰還・mass return・library search/fetch(既存 cr-701 が別担当)。

### 34.25 cr-603-triggers-apnap Slice A: event-driven trigger subscription leaf + once-per-turn gate(CR 603.1/603.2/603.2h/603.3b)— この節も契約である

**位置づけ**: cr-603-triggers-apnap batch3-1a。既存 `stackPlacementBucket`(CR603.3b two-bucket APNAP配置)は既に実装済み。本節はその上に、既存 §34.18 event envelope(`DrawEvent`/`LifeChangeEvent`/`DamageEvent`/`ZoneChangeEvent`)へのtrigger購読leafを追加する(event:* 87件中52件をカバー)。判定者が3スライス分割(Slice A=本節・Slice B=delayed-trigger scheduling primitive・Slice C=discard/sacrifice/counter新規semantic event)を裁定し、本節はSlice Aのみ。設計正本=`research/cr-grounding/archive/cr-603-triggers-sliceA/cr-603-triggers-batch3-1.draft.md`(Codex起草・J3 Sonnetが CR照合し3分割+Slice A優先を裁定)。

**CR根拠**: 603.1(triggered ability=条件+効果)・603.2(マッチする event/game state が自動的に誘発。まだ解決しない)・603.2h(「Do this only once each turn」=そのターン未実行なら誘発)・603.3/603.3b(誘発後、次に優先権が回る時にstackへ。two-bucket APNAP=既存実装済み・本スライスで無変更)・603.6/603.6a(zone-change/ETB誘発は移動先で検出)・603.10a(leaves-graveyard等のlook-back=LKI依存)・400.7(zone移動=新object=旧objectの記憶を持たない。once-per-turn ledgerのkeyがobject単位である根拠)。

**凍結挙動**:
- 既存emitted event(DrawEvent/LifeChangeEvent/DamageEvent/ZoneChangeEvent)への trigger購読leafを追加(**新規GameEvent union memberは追加しない**)。ETB(battlefieldへの移動)・leaves-graveyard(graveyardからの移動)は既存ZoneChangeEventで検出。
- **M-STACK-TRUST-HOTFIX(2026-07-20・CR603.1/603.2/603.2b)**: event購読に使える条件は、能力語(CR207.2c)を除いたability lineの**先頭**が`When`または`Whenever`で始まる場合の、最初の条件句だけ。カード名内の句読点・列挙条件は保存するが、カンマ以降の効果、引用能力、解決中に作られるreflexive trigger(`When you do` / CR603.12)を常在購読条件にしない。先頭が`At`の能力はCR603.2bのphase/step begin経路だけで扱い、効果文の`lose life`/`draw`/`deal damage`/`discard`/`sacrifice`/`put counters`/`attack`等を別eventの購読に代用しない。runtime collector・rule classifier・triggerId→ability line対応はこの単一条件parserを共有する。未対応phaseの`At`能力はmanual/未対応のままとし、無関係eventで代替実行しない。
- ETB「another creature」判定は自己参照text検出+`physicalCardId`一致の二重guardで自己トリガーを防止。無修飾「whenever a creature enters」は他クリーチャーのETBに正しく反応し続ける(power/control filterは条件文言に一致した時のみ適用=false-negative regressionなし)。
- **once-per-turn gate(CR603.2h)**: 新state `GameState.oncePerTurnTriggerLedger: {turn:number; consumedKeys:string[]}`。key=`${turn}|${sourceObjectId}|line-${abilityLineIndex}|${controllerId}`(abilityLineIndex不明時はtriggerId fallback)。`applyNextPhase`(end→untap)/`applyNextTurn`でリセット。snapshot backfill=欠落/不正形/turn不一致は`{turn:state.turn, consumedKeys:[]}`へ正規化。
- **CR400.7設計判断(意図的・要石)**: oncePerTurn keyは`sourceObjectId`(object identity)基準であり、`physicalCardId`(permanent概念)基準ではない。同一ターン内でsourceがblink(exile→battlefield)されると新objectIdとなり、once-per-turn消費履歴を引き継がない=そのターン内で再度誘発しうる。これはCR400.7の正しい帰結(新objectは旧objectの記憶を持たない)であり**バグではない**。逆に`physicalCardId`基準へ変更する方がCR違反になる。
- 既存two-bucket APNAP配置(`stackPlacementBucket`)は無変更(`priority.ts`は`collectPendingTriggers`→`collectPendingTriggerUpdate`のリネームのみ、bucket/APNAPロジック自体は無変更)。
- `'delayed-triggered'`文法分類・grammar/配下は本スライスで一切触れない(Slice B対象)。`triggeredAbilityEntries`は`shape==='triggered'`のみを対象とし`'delayed-triggered'`行を意図的に除外(コメントで明示)。

**Tier-1 監査で確認**: 0 BLOCKER/0 HIGH。once-per-turn turn-reset(ターンN消費→ターンN+1リセット→再誘発)・CR400.7 blink挙動(新objectで再誘発=意図通り)・ETB self-exclusion/無修飾other-ETB非regression・two-bucket APNAP非regression・source-less markDamageがDamageEvent購読を誤発火しないこと、を実地検証済み。残余note(MEDIUM・非ブロッキング、判定者が対応)= (1)blink時のonce-per-turn resetは意図的だが将来の誤"修正"を防ぐためコメント追記(commands.ts該当関数)。(2)`triggeredAbilityEntries`の`'delayed-triggered'`除外を明示コメント化。受け入れ=`review.cr603-triggers-sliceA.test.ts`(レビュー専有・5 pin。turn-reset・blink・ETB self-exclusion・無修飾other-ETB・markDamage非発火)。

**スコープ境界(§34.5・PASS に混ぜない)**: delayed-trigger scheduling(Slice B)・discard/sacrifice/counter新規semantic event(Slice C)・modal triggered abilities(CR603.3c)・intervening-if/"this turn"集計状態・state triggers(CR603.8)・attack/block declaration event(既存non-envelope helperのまま)・"this way" provenance追跡・replacement/prevention相互作用・他プレイヤー(opponent)のdraw/life等P1-centricな event。

### 34.26 cr-603-triggers-apnap Slice B: delayed-trigger scheduling primitive(CR 603.7/603.7b/513.2)— この節も契約である

**位置づけ**: cr-603-triggers-apnap batch3-1b(Slice A・engine-spec §34.25 の後続)。Slice Aまでは`'delayed-triggered'`文法ラベルが実スケジューリング機構を持たず通常triggeredと同一経路で扱われていた欠落を埋める。真の「at the beginning of the next end step/turn's upkeep」型 delayed trigger を初めてサポートする。設計正本=`research/cr-grounding/archive/cr-603-triggers-sliceA/cr-603-triggers-batch3-1.draft.md`の"Option A"(Codex起草・J3 Sonnetが CR照合し承認)。

**CR根拠**: 603.7/603.7a(delayed triggered abilityは解決中のspell/abilityにより**作成時点**で生成され、後で誘発)・603.7b(stated durationがない限り1回のみ発火)・513.2(「the step doesn't back up」=end step中に作成された「next end step」delayed triggerは**次のturn**のend stepまで待つ。同一end stepでは発火しない)・603.3b(two-bucket APNAP配置は既存のまま無変更)。

**凍結挙動**:
- `PendingTrigger`型拡張(additive・既存フィールド無変更): `schedule?: {kind:'phase-begin'; turn:number; phase:'upkeep'|'end'; consumeOnTrigger:true; createdAtTurn:number; createdAtPhase:Phase}`。
- delayed trigger作成時(未来のstep到達時ではない)にscheduleを確定: 「next end step」はend step中の作成なら`turn+1`(CR513.2)・end step以外での作成なら同一turnの直近end stepへ。「next turn's upkeep」は常に`turn+1`。
- scheduled(未到達)PendingTriggerは既存APNAP配置・candidate表示から**完全に不可視**(除外されるだけでなくbucket/controllerカウントロジックにも影響しない。Tier-1監査で実地検証=scheduled triggerの有無でAPNAP順序結果が完全一致)。
- 到達時(`applyNextPhase`/`applyNextTurn`経由)にscheduleフィールドを削除し通常のready pending triggerへ昇格、既存two-bucket APNAP配置ロジックへそのまま流す(stackへ直接置かない)。昇格は1回のみ(CR603.7b・scheduleフィールド削除により再昇格不可)。
- 既存Slice A(event-driven trigger subscription・once-per-turn gate)・既存two-bucket APNAP(`stackPlacementBucket`)は無変更のまま動作継続(`review.cr603-triggers-sliceA.test.ts`・`crGroundingGoldenCases`の両golden、Tier-1監査でbyte-unmodified確認)。
- snapshot前方互換: schedule fieldを持たない旧PendingTriggerはそのままvalid(optionalフィールドにつき無変更で読める)。

**Tier-1 監査で確認**: 0 BLOCKER/0 HIGH。`readyPendingTriggers`フィルタ(APNAP共有配管全箇所に導入)がscheduled triggerをbucket/controllerカウントも含め完全に不可視化すること・CR513.2 back-up算術の両方向(end step中作成→次turn/end step外作成→同turn)・1回限り昇格・既存two-bucket APNAP非regression・Slice A非regressionを実地検証済み。残余note(MEDIUM・非ブロッキング、判定者が対応)= `applyEnterCombat`が`enterPhase`/`promoteDueScheduledTriggers`をバイパスする別のphase-entry経路だが、`schedule.phase`型が`'upkeep'|'end'`のみのため現状無害(将来combat開始delayed triggerを追加する時に要対応。コメント追記済み)。LOW= activated-ability行に埋め込まれたdelayed節は`abilityLineIndex`が`undefined`になる(現行コーパスに支障なし。コメント追記済み)。受け入れ=`review.cr603-triggers-sliceB.test.ts`(レビュー専有・6 pin。CR513.2両方向・one-shot・APNAP非干渉・snapshot forward-compat・two-bucket非regression)。

**スコープ境界(§34.5・PASS に混ぜない)**: discard/sacrifice/counter新規semantic event(Slice C)・duration付き複数回delayed trigger("this turn"等)・modal delayed trigger・phase-begin以外の複雑な未来timing文言・combat開始delayed trigger。

### 34.27 cr-603-triggers-apnap Slice C: discard/sacrifice/counter semantic event(CR 701.9/701.21a/122.1/704.5q)— この節も契約である

**位置づけ**: cr-603-triggers-apnap batch3-1c(Slice A・B の後続・cr-603 の最終サブスライス)。event:* 残34件中discard10・sacrifice9・counter8=27件をカバーする。設計正本=`research/cr-grounding/archive/cr-603-triggers-sliceA/cr-603-triggers-batch3-1.draft.md`"4.2 New or enriched emit path required"(Codex起草)+判定者追加裁定(discard/sacrificeは既存`ZoneChangeReason`拡張・counterは新規`CounterChangeEvent`)。

**CR根拠**: 701.9(discard=hand→graveyardの自発的移動)・701.21a(sacrifice=controller自身がbattlefield→owner's graveyardへ移動。destroyでない=regeneration等が介入しない)・122.1(counterはobject/playerに置かれるマーカーであり、zone移動ではない)・704.5q(+1/+1と-1/-1が同一permanentに同居する時、少ない方の数だけ両方から除去)。

**凍結挙動**:
- `ZoneChangeReason`拡張(additive・既存値無変更): `'discard'`(CR701.9)・`'sacrifice'`(CR701.21a)を追加。既存discard/sacrifice実行経路(既存guided leaf。§32.9系)がこれらのreasonを正しくtagする。SBA駆動の致死ダメージ死亡等は引き続き既存`'sba'`のまま(誤relabelしない)。
- 新規`CounterChangeEvent`(GameEvent union additive追加): `{type:'counterChange'; target:EventTargetRef; counterType:string; delta:number; before:number; after:number; ...}`。`addCounters`実行時にintent(`recordCounterChangeIntent`)を記録し、コマンド末尾の`flushCounterChangeEvents`で実際に変化した(`delta!==0`)ケースのみemitする。
- trigger購読leaf: discard(`reason==='discard'`のZoneChangeEvent検出)・sacrifice(`reason==='sacrifice'`のZoneChangeEvent検出。`you`条件はcontroller一致チェックで他プレイヤーのsacrificeに誤発火しない)・counter-put(CounterChangeEventの`delta>0`検出。counter除去〈remove〉側のtriggerは対象外)。既存Slice Aのonce-per-turn gate機構をそのまま再利用(新規state追加なし)。

**Tier-1 監査で発見・判定者が外科修正した HIGH**: CR704.5q annihilation SBA(`counterPairIds`ループ)が`+1/+1`・`-1/-1`両カウンターを`setCard`で直接変異させるが、どちらについても`recordCounterChangeIntent`を呼んでいなかった。結果、`addCounters`(-1/-1側)のdispatchがannihilationを誘発した時、`+1/+1`側の実質的な減少(例: 2→1)が一切CounterChangeEventとして観測されず、かつ直前のdispatchが emit した古い`{after:2}`イベントが訂正されずログに残存する(stale/misleading data)。「+1/+1カウンターが除去された時」型のtriggerがannihilation経由の除去では静かに発火しないという実害あるgapであり、crGroundingGoldenCasesの既存golden(`cr-sba-plus-minus-counter-annihilation`)がこの誤った挙動をそのまま期待値として固定してしまっていた。判定者が annihilationループ内で`recordCounterChangeIntent`を両カウンタータイプについて呼ぶよう追加(既存`applyAddCounters`と同型のパターン)。修正後は該当golden含む全shot scenarioが正しく3件の event(初期+2・annihilation由来の+1/+1側-1・-1/-1側-1)を emit し、最終状態と一致する。

**残余note(MEDIUM・非ブロッキング)**: `withMoveReason`ヘルパーが`commands.ts`/`gameStore.ts`両モジュールに重複定義されている(DRY違反だが個別には正しい動作)。将来の変更時に片方だけ更新して乖離するリスクあり=次回このコードに触れる時に共有モジュール化を検討。他のadversarial項目(discard/sacrifice reason誤タグなし・SBA死亡は`'sba'`のまま・Slice A/B非regression・two-bucket APNAP goldens無変更・purity/determinism)は独立監査で無欠陥確認。受け入れ=`review.cr603-triggers-sliceC.test.ts`(レビュー専有・6 pin。HIGH修正の直接pin・discard/sacrifice/counter golden・SBA死亡非regression・誤タグなし・cross-player false-positive非発火)。

**スコープ境界(§34.5・PASS に混ぜない)**: state triggers(CR603.8)・intervening-if/"this turn"集計状態・modal triggered abilities・attack/block declaration event・"this way" provenance追跡・他プレイヤー(opponent)由来のdiscard/sacrifice/counter・counter除去(remove)のtrigger検出。cr-603-triggers-apnap は本節でSlice A/B/C全て完了=domain全体がshipped。

### 34.28 cr-608-resolution Slice A: stack-target filtering + 単純counter-spell(CR 608.2b/701.6a/701.6b)— この節も契約である

**位置づけ**: cr-608-resolution batch3-2a(domain初のスライス。status=drafted→本節で着手)。stack上のspellを対象にできるguided leafを初めて追加し、「counter target spell」型の最小コアを実装する。判定者が2スライス分割(Slice A=本節・Slice B=解決時LKI読み取り=Feed the Swarm/Rapid Hybridization/Mana Drain型)を裁定。設計正本=`research/cr-grounding/archive/cr-608-resolution/cr-608-resolution-batch3-2.draft.md`(出荷時にarchiveへ集約済・Codex起草・J3 Sonnetが CR照合し2分割+既存removeStackItem再利用を裁定)。

**CR根拠**: 608.2b(解決時に対象を再チェック。期待ゾーンを離れていれば非合法)・701.6a(counter=stackからcancel・除去。解決せず、countered spellはowner's graveyardへ)・701.6b(counterされたコストの払戻はない)。

**凍結挙動**:
- `TargetFilter.zone`拡張(additive・既存値`'battlefield'|'graveyard'`はそのまま): `'stack'`を追加。
- 厳密5パターンのみguided(`^...$`完全アンカー。修飾語・follow-up節付きはhonest manual。`effect.counter-spell`が他effect atomと同一ability内で共存する場合は無条件で`needs-parse`が付きmanualへfail closed=部分guided/follow-up節脱落を防ぐ):
  「Counter target spell.」→`{zone:'stack'}`・「Counter target noncreature spell.」→`{zone:'stack',excludedTypes:['creature']}`・「Counter target creature spell.」→`{zone:'stack',types:['creature']}`・「Counter target instant or sorcery spell.」→`{zone:'stack',types:['instant','sorcery']}`・「Counter target enchantment, instant, or sorcery spell.」(Oxford comma有無両対応)→`{zone:'stack',types:['enchantment','instant','sorcery']}`。
- 候補集合: `state.zones.stack`のうち`isAbility`でないitemのみ(activated/triggered abilityは除外)。解決中のcounter-spell自身も無条件除外(`context.sourceId===cardId`. 既存battlefield/graveyard分岐の`filter.excludeSource`ゲート方式とは異なりstack分岐は常時除外=このスライスの5パターンでは常に正しい)。
- 解決アクション: 既存`removeStackItem`をそのまま再利用(**新規GameCommand追加なし**)。コスト払戻ロジックは元々存在しない=CR701.6bに自動的に合致。
- 「countered」を観測する新規trigger/ZoneChangeReasonは追加しない(現行MyDeck実測にそのdemandが無いため。将来需要が出たら別スライスで追加)。

**Tier-1 監査で確認**: 0 BLOCKER/0 HIGH。自己ターゲット排除(解決中のcounter-spell自身が自分の候補に出ない)・ability排除・型フィルタがstack item自身の型を正しく読むこと(battlefield等の無関係objectを誤って読まない)・厳密5パターン以外(Flusterstorm型「unless」修飾・An Offer You Can't Refuse型follow-up・exile-instead代替処理・未承認型組合せ)が正しくmanualのままであること・既存`removeStackItem`(他の呼び出し箇所=ability除去等)が無変更のまま・既存cr-603 Slice A/B/C review.*が無変更のまま、を実地検証済み。残余note(LOW・非ブロッキング)= stack分岐の自己除外が`filter.excludeSource`ゲートでなく無条件(この5パターンでは常に正しいが、将来「counter target spell, including this one」のような仮想的パターンが必要になれば要調整。現行スコープでは対応不要)。受け入れ=`review.cr608-resolution-sliceA.test.ts`(レビュー専有・6 pin。厳密5パターン境界・自己除外・ability除外・型フィルタ精度・解決非regression)。

**スコープ境界(§34.5・PASS に混ぜない)**: 解決時LKI読み取り(Slice B)・「unless its controller pays {1}」等の解決時payment選択(CR608.2d)・gift/instead分岐・controller token/draw follow-up・delayed mana/draw(Mana Drain/Arcane Denial型)。

### 34.29 cr-608-resolution Slice B: 解決時LKI読み取り(Feed the Swarm型 mana value)(CR 608.2h/400.7)— この節も契約である

**位置づけ**: cr-608-resolution batch3-2b(domain最終スライス。本節出荷でdomain全体がshipped化)。Slice A(§34.28)の`removeStackItem`再利用とは独立に、「destroy target X. You lose life equal to its mana value.」型(Feed the Swarm)の解決時LKI読み取りを実装する。判定者裁定=persistent `GameState.resolutionContext`は導入しない・`ObjectSnapshot`へ`manaValue?:number`をadditiveで追加し、既存`TargetSelection.selection.snapshot`(対象選択時点で確定済み)から後続コマンド構築時に値を読む方式(command-payload expansion)。新規`GameCommand`型は追加しない(既存`moveCard`+`adjustLife`の組み合わせ)。

**CR根拠**: 608.2h(効果が対象の特性を解決時に参照する場合、対象が変化・消滅していても効果が具体的に指定した基準に従う。本パターンは「its mana value」を対象選択時点の特性として読む)・400.7(オブジェクトが移動すると別オブジェクトになる。destroy後にmana valueを再読すれば墓地の別オブジェクトの特性を誤って読むことになる)。

**凍結挙動**:
- `ObjectSnapshot.manaValue?: number`をadditiveで追加(`objectSnapshotOf`/`objectSnapshotForCard`双方が`def?.cmc`から設定。静的/印刷特性であり layer 由来ではない)。
- 新規leaf: `isDestroyThenLoseLifeManaValuePromptRaw`(正規表現で`"destroy target ... you lose life equal to (its|that <type-noun>'s) mana value"`の完全一致のみ捕捉。type-noun列挙=`artifact|card|creature|enchantment|land|object|permanent|planeswalker|spell`)。一致しない場合(誤characteristic・誤life-loser・follow-up節なし等)は`manualValueForDestroyThenLoseLifePrompt`が`null`を返し、`effect.destroy`は単純destroyのまま(既存共有経路に影響なし)。
- 値の読み取り経路: `buildGuidedCommands`の`effect.destroy`ケースが`answer.targetSnapshots?.[index]`(=選択時点の`ObjectSnapshot`)から`manaValue`を読む。対象選択後のいかなる状態変化(mana value変更・破壊自体)よりも前に確定した値であり、解決時に`state.cards`を再読することは一切ない。`manaValue !== null`ガード(falsy-guardの罠を回避=mana value 0のlandも正しく`adjustLife delta:-0`を発行)。
- 共有経路(`src/store/gameStore.ts`の`confirmGuidedTarget`)は全guided-target確定で無条件に`targetSnapshot`を計算し`targetSnapshots`として渡すよう補強されたが、新leaf以外のeffect atom(sacrifice/exile/return/tap/untap/counter-plus/counter-spell/plain destroy)は`buildGuidedCommands`内でこの値を一切参照せず、真のno-op(既存挙動とbyte-identical)。
- snapshotが欠落する場合(理論上のみ。legalityゲート通過後の同tick消失等)は`manualValueForDestroyThenLoseLifePrompt`が`null`を返し、destroyのみ実行(例外を投げない)。

**Tier-1 監査で確認**: 0 BLOCKER/0 HIGH。共有経路(`confirmGuidedTarget`)が新leaf以外の全guided-target効果に対してbyte-identicalであることを6件の実地adversarialプローブで検証(plain destroy no follow-up・別type filter destroy・誤characteristic・誤life-loser・0除算的境界なし・bogus card-idでの非throw)。CR608.2h LKI-timing本質claim=対象選択後にmana valueを変異させても解決時計算は選択時点の値を使うこと、を実装者自身の敵対的テスト(選択後にcmcを4→9へ変異させ解決後life dropが4であることを確認)で実証済み。残余note(LOW×2/MEDIUM×1・非ブロッキング): ①leaf関数名がFeed the Swarm由来だが実際は一般的phrasing検出器(命名がやや狭いが誤解を招くほどではない)②type-noun列挙が固定リストのため未収載type noun(将来カードで"battle's mana value"等)はfail-safeにmanualへ落ちる(過認識でなく低認識=プロジェクト設計原則に合致・許容)③共有経路が新leafの有無に関わらず毎回snapshotを計算するため、将来`buildGuidedCommands`switchに新atomを追加する実装者はsnapshotが「無料で」利用可能なことをドキュメントで把握できると良い(本節が該当ドキュメント)。受け入れ=`review.cr608-resolution-sliceB.test.ts`(レビュー専有・7 pin。exact-phrase境界2件・共有経路non-regression・CR608.2h LKI-timing本質テスト・zero-mana-value land・missing-snapshot防御的縮退・compile shape)。

**スコープ境界(§34.5・PASS に混ぜない)**: 「unless its controller pays {1}」等の解決時payment選択(CR608.2d)・gift/instead分岐・controller-side follow-up(Rapid Hybridization型の置換トークン生成等)・delayed mana/draw(Mana Drain/Arcane Denial型)・mana value以外の特性(power/toughness/loyalty等)を参照するLKI読み取り(将来別リーフで拡張可能・本節のパターンを流用)。

**domain完了**: cr-608-resolution はSlice A(§34.28)+Slice B(本節)でplannedSequence消化完了。status=`shipped`。

### 34.30 cr-122-counters batch3-4: counter-plus 符号バグ修正(CR 122.1a/122.3/704.5q)— この節も契約である

**位置づけ**: cr-122-counters batch3-4(plannedSequence先頭。demand=22)。当初スコープは「固定countergを対象へ書き込むguided leaf+counter-placement event emission」(新規機能追加)だったが、判定者がscoping調査中(Codex quota到達により判定者自身が代行)に**既存出荷済みコードの実バグ**を発見し、新規機能追加より優先してこれを修正した。

**発見経緯**: `effect.counter-plus`のatom probe(`src/engine/grammar/index.ts`)は正規表現`/[+-](?:\d+|X)\/[+-]?(?:\d+|X)\s+counters?\b/i`で「+1/+1 counter」「-1/-1 counter」の両方にマッチする(atom名は`counter-plus`だが符号非依存)。しかし`guidedTargetPrompt`は符号を見ずに単体target構文であれば無条件でguidedプロンプトを提示し、`buildGuidedCommands`の解決時処理(旧`counterDelta(raw): number`)は常に`counterType:'+1/+1'`をハードコードしていた。結果、「Put a -1/-1 counter on target creature.」のような実カード(Grim Affliction・Corpse Cur等)がguidedとして提示された上で、確定時に**逆符号の+1/+1カウンターを置く**というサイレントな誤動作が既に本番へ出荷されていた(honest manualへのfail-safeでなく、fake-greenより悪い「常に間違った動作を自信満々に実行する」バグ)。

**CR根拠**: 122.1a(+X/+Yカウンターと-X/-Yカウンターは符号込みで別種。deltaでなく識別子そのもの)・122.3/704.5c/704.5q(同一permanentに+1/+1と-1/-1が同居する時、少ない方の数だけ両方から除去。既存annihilation SBAが担当=無変更)。

**修正内容**:
- 旧`counterDelta(raw): number`を`counterDescriptorForRaw(raw): {counterType:'+1/+1'|'-1/-1'; delta:number} | null`へ置換。符号ごと(+1/+1・-1/-1)に digit 形("3 -1/-1 counters")と word 形(a/an/one/two〜ten)を個別にマッチし、どちらの符号にも一致しない記述(可変X・非unit記述子である"+2/+2 counter"を独自種として等)は`null`を返す(**過認識でなく低認識に倒す**=プロジェクトの exact-phrase gate 規律)。
- `guidedTargetPrompt`に事前ゲートを追加: `effect.atom==='effect.counter-plus'`かつ`counterDescriptorForRaw(effect.raw)`が`null`の場合はguidedを提示せず`null`を返す(既存`TARGET_REQUIRED_ATOMS`経由で`needs-target`→manualへ fail closed)。**解析不能な記述を最初からguidedとして出さない**ことが本質的な修正であり、確定時のみの修正では不十分(旧実装は「常に何かを返す」ことでこの穴を隠していた)。
- `buildGuidedCommands`の`case 'effect.counter-plus':`のハードコードを撤去し、`counterDescriptorForRaw(prompt.raw)`の結果(`counterType`/`delta`)をそのまま使用。フォールバック`?? {counterType:'+1/+1', delta:1}`は上記ゲートにより実質到達不能(belt-and-suspenders・Tier-1がreachability を確認済み)。
- **新規GameCommand・新規GameState一切なし**(純粋コンパイラ層の修正。`applyAddCounters`は元々`counterType: string`ジェネリックで、既にバグの影響を受けていなかった)。

**Tier-1 監査(独立Sonnetサブエージェント。判定者=実装者代行のため必須)**: 0 BLOCKER/0 HIGH/0 MEDIUM/0 LOW。4チェック全green(160 files/1397 tests)。`git stash`でバグ再現を実施=修正前コードで該当5 pinのうち3件が実際に失敗し、annihilation pinは特に「-1/-1配置のはずが3個目の+1/+1が積まれ、annihilationが一切起きない」という実害を確認(修正の実在性を確証)。敵対的追加プローブ(大文字小文字非依存・非unit記述子"+2/+2"がmanualのまま・非creature target・複合節での符号別々resolve・可変X両符号)すべて green。既存テストで`counterDelta`旧名を参照するものはゼロ(=「バグに合わせてテストを書き換えた」ものではない、独立発見・独立修正)。

**追加確認(実装ギャップなし)**: 当初`event:counter`demand=8向けに「counter-placement event emission」を新規実装課題と想定していたが、調査の結果**既存cr-603-triggers-apnap Slice C(engine-spec §34.27)の汎用`CounterChangeEvent`+`trigger.counter-put`配線(`src/engine/triggers.ts`の`counterPutLineMatchesEvent`)が既にcounterType非依存で正しく機能していた**(新規実装不要)。本修正(符号バグ修正)により-1/-1側のcounterTypeが正しく解決されるようになったことで、この既存配線が-1/-1側でも意味を持つようになった、という接続を`review.cr122-counter-put-trigger-sign.test.ts`(store層・3 pin)で実地確認・恒久リグレッションガード化した(Alesha, Who Laughs at Fate型の+1/+1トリガーは`src/store/__tests__/cr603SemanticEvents.test.ts`で既存確認済み。本ファイルは-1/-1側+符号別クロス汚染なしを追加確認)。この部分はsrc変更ゼロにつき独立Tier-1監査省略(CLAUDE.mdの実装ギャップなし精査と同基準。cr-701-keyword-actions-frequent batch3-3 §32.10の先例に同じ)。

**スコープ境界(§34.5・PASS に混ぜない)**: loyalty/charge/age/ice等の他counter種別・可変count・distribute複数target・proliferate・counter cap(122.4)・Saga/battle/rad countersは本スライス未着手(次回demand実測時に別スライス)。

**受け入れ**: `review.cr122-counter-plus-sign.test.ts`(レビュー専有・5 pin。符号バグ修正pin・+1/+1非regression・digit/word magnitude・可変X両符号のexact-phrase gate・annihilation SBA相互作用)+ `review.cr122-counter-put-trigger-sign.test.ts`(レビュー専有・3 pin。-1/-1 counter-put trigger発火・符号別クロス汚染なし双方向)。

### 34.31 S-LAYERS Slice A: read-time additive Layer 4 type accessor(design-lock・CR 604/611/613)— この節も契約である

**位置づけ**: cr-604-611-612-613-layers-continuous batch3-5(domain初のスライス。本番engineに初めてCR613層計算を導入)。**design-lock(spec-first)**=§34.21 S-LINKED-EXILEと同方式=実装より先に設計を凍結し、実装は後続の同一/別セッションで行う。設計正本(living)=`research/cr-grounding/cr604-layers-batch3-5.draft.md`(Codex起草・J3 Sonnetが CR照合しread-time方式+scope境界を裁定・2026-07-06)。既存production engineには`computeEffectiveCharacteristics`等のlayer機構が一切存在しない(`scripts/lib/layerClassify.ts`/`oracleHarness.ts`はM0計測用の研究ツールでGameStateに未接続)ことを確認済み。

**CR根拠**: 604.1/604.2(static ability=常時真。permanentがbattlefieldに在る間continuous effectを生成)・611.3/611.3a/611.3b(static abilityのcontinuous effectはlocked-inでなく常時再評価)・613.1/613.1d(layer順序。Layer4=type-changing)・613.5(layer適用は連続的・自動・瞬時)・604.4(Aura/Equipment/Fortificationの装着先修正はtargetしない。移動すれば新objectを修正)。

**凍結した設計(判定者裁定・8点のJudge Decision Pointsに対する回答)**:
1. **read-time計算・stored ledgerではない**: `GameState`に新フィールドを追加しない。`src/engine/status.ts`の既存`effectivePower`/`effectiveKeywords`と同じ並びで、`GameState`+`cardId`から都度導出する純粋関数を追加する。理由=CR611.3a(locked-inでない)・613.5(継続的・自動的に導出)に合致し、`zonesByPlayer`型のrestore/backfillスキーマ拡張を避けられる(既存の「GameStateは可能な限りderivable」原則と整合)。
2. **layer抽象は導入しない(Option A)**: 依存グラフ/timestampソート等の汎用layer機構は本スライスで作らない。additiveなLayer4効果だけを扱う限り、複数効果は可換(順序が結果に影響しない)ため、613.7/613.8のtimestamp/dependencyは観測不能=構築不要。将来の拡張点として関数内部に「Layer4」であることをコメントで明示するに留める。
3. **Layer6は対象外(Slice Bへ)**: 本スライスはLayer4(additive type-changing)のみ。demand=L4:10 > L6:2でもあり、ability付与はkeyword-onlyでも別の意味論的広がり(除去・"can't have"・613.9 override等)を持つため、Layer4のread-site移行を先に安定させてから再利用する。
4. **attached-object効果を含める**: `attachedTo`は既存の単一id fieldであり、Aura/Equipment/FortificationはCR604.4により単一object修正(target化しない)ゆえ有界。Nylea's Presence型("Enchanted land is every basic land type in addition to its other types.")をカバーする価値が実装コストに見合う。
5. **CDA(characteristic-defining ability)は対象外**: CR604.3aのCDAは全ゾーンで機能する必要があるが、本スライスはbattlefield限定の読み取りのみ。CDA固有の全ゾーン対応は将来スライスへ。
6. **移行するread site**: `src/engine/commands.ts`の`typeLineOf`・`typeLineForStateCard`/`eligibleTargets`のtarget legality分岐・`src/engine/status.ts`の`isSummoningSick`・battlefield groupingやcontext menuのcreature/land/planeswalker判定。**UI card-view/preview全体やObjectSnapshot/trigger snapshot生成は本スライスで移行しない**(printed/intrinsicのまま=明示的deferral。snapshotは元来時点凍結でよい)。
7. **static ability検出**: 既存`classifyAbilityShape`(`src/engine/grammar/index.ts`)の`'static'`分類をそのまま再利用する。`scripts/lib/layerClassify.ts`等の研究ツールをproductionへそのまま輸入しない(再実装する場合は`src/engine`側で独自にテストを持つ)。
8. **厳密な追加条件(exact-phrase gate・auto詐称なし)**: 対応する構文は「in addition to its other types」を含む**additiveのみ**(型追加。除去・"isn't"・"in addition"を伴わない"becomes [type]"・複数object対象のanthem型は非対応)。ソースは(a)printed static abilityを持つ自身のbattlefield permanent、または(b)`attachedTo`で自身を指す唯一のAura/Equipment/Fortification。それ以外は既存の printed type line のまま(honest fallback。誤った型を返さない)。

**Golden候補(ローカルScryfallスナップショットで検証済み。`Devastating Onslaught`/`Fable of the Mirror-Breaker`は台帳のnote記載の初期候補だったが検証の結果不適合と判明し却下)**:
- `Invasion of Zendikar // Awakened Skyclave`: "As long as this creature is on the battlefield, it's a land in addition to its other types."(self・additive card type)
- `Nylea's Presence`(Aura): "Enchanted land is every basic land type in addition to its other types."(attached-object・additive subtype)
- Slice B候補として`Angelic Gift`(Aura): "Enchanted creature has flying."(keyword付与・本スライス対象外)

**スコープ境界(§34.5・PASS に混ぜない)**: anthem/複数object static効果("Creatures you control ...")・611.2(spell/ability解決由来のcontinuous effect。duration・object-set locking・variable capture・"becomes"/"gains"含む)・CDA全ゾーン対応・613.7/613.8のtimestamp/dependency・Layer1(copy/face-down)/2(control)/3(text-changing)/5(color)/6(ability-add/remove)/7(P/T)・keyword counter(CR122.1b)のLayer6ブリッジ・basic land typeが暗黙に持つmana ability(型wordのみ検証し、mana ability自体は別領域)・ObjectSnapshot/trigger snapshotの effective 化。

**実装出荷(2026-07-06・Codex実装 → 判定者先行review.* authoring → 独立Sonnet Tier-1監査 → 判定者外科修正)**: `effectiveTypeLine(state, cardId)`を`src/engine/status.ts`へ追加(design-lock通りread-time・新GameState/GameCommandなし)。`src/engine/commands.ts`の`typeLineOf`/`typeLineForStateCard`(→`eligibleTargets`のtarget legality)をこれ経由に移行。`ObjectSnapshot`は設計通り`printedTypeLineOf`(旧`typeLineOf`を改称)のままread-time化しない(deferral遵守)。static ability検出は既存`classifyAbilityShape`を再利用。

**Tier-1監査で発見・判定者が外科修正したHIGH**: `staticAbilityLinesForCurrentFace`が能力を**段落(paragraph)単位**でしか分割しておらず、`parseLayer4AdditiveStaticLine`の`^...$`アンカーは実質**文(sentence)単位**でしか意味を持たない。実カードでは同一段落に複数文の静的テキストが並ぶこと("This land is tapped. This land is a Mountain in addition to its other types."等)が普通にあり、`normalizeLayer4StaticLine`が句点を空白に置換してから正規表現マッチするため、非貪欲キャプチャグループが文境界を越えて隣接文を飲み込みうる(結果=偶然正しい・または能力がサイレントに脱落。誤った型を追加する偽陽性は`parseTypeWordList`の単語バリデータが大半を弾くため未観測)。「auto詐称なし」の核心(exact-phrase gate)を実質的に破る欠陥であり、既存review.*・実装者テストとも単一文のoracle textしか使っていなかったため両方から不可視だった。判定者が`staticAbilityLinesForCurrentFace`を1行修正=段落textをそのまま返す代わりに既存`splitRulesText`(同ファイル内)で文単位分割してから返すよう変更。これにより各additive節が独立してアンカーされる。2件の回帰pin(隣接無関係文に飲み込まれないこと・同一段落内の独立2文が両方適用されること)を追加し実地確認。

**残余note(LOW・非ブロッキング)**: `eligibleTargets`/`typeLineForStateCard`は新設`typeLineHasType`(word-boundary正規表現)へ移行したが、`commands.ts`内の他の`typeLineOf(...).includes(...)`呼び出し箇所は旧来の部分文字列一致のままであり、型マッチ戦略が2方式混在している。現行の型ボキャブラリ(creature/land/artifact等の単語のみ)では複合語の衝突が無く実害は確認されなかった(Tier-1が対象review file 5件・28 pinを再実行し無regression確認済み)。将来の統一は次スライスの整理課題とする。

**受け入れ**: `review.cr604-layers-sliceA.test.ts`(レビュー専有・15 pin。self/attached additive・dedup・every-basic-land-type・anthem/becomes-without-addition/removal false-positive・off-battlefield・detached aura・multi-source stacking・golden×2パターン・vanilla非regression・HIGH修正回帰pin×2)。

### 34.32 S-LAYERS Slice B: keyword-only Layer 6 additions(design-lock・CR 613.1f)— この節も契約である

**位置づけ**: cr-604-611-612-613-layers-continuous Slice B。Slice A(§34.31)のstatic ability検出+文単位分割infrastructureを再利用し、keyword付与のみのLayer6 additive効果を`effectiveKeywords`へ拡張する。設計正本(living)=`research/cr-grounding/cr604-layers-batch3-5.draft.md` §"Slice B: Keyword-Only Layer 6 Additions"(Codex起草・Slice A設計時に既に判定者が承認済み範囲)。

**CR根拠**: 613.1f(Layer6=ability-adding/keyword counter/ability-removing/can't-have effectsを適用)。本スライスはability-adding(keyword付与)のみを対象とし、keyword counter(122.1b)・ability-removing・can't-haveは対象外。

**凍結した設計**:
1. `effectiveKeywords(state, cardId)`(既存関数)を拡張し、self/attached-objectの static ability由来keyword付与を合成する。新規GameState/GameCommandは追加しない。
2. 対応構文=**厳密にkeywordのみ**: "Enchanted/Equipped/Fortified <noun> has <keyword>[, <keyword>]* [and <keyword>]." および self版 "This <noun> has <keyword>..."。keyword語彙は既存`STATUS_KEYWORDS`(`src/engine/status.ts`)に列挙済みの14種のみ認識(それ以外の未知語はhonest fallback=非マッチ)。
3. Slice Aの`staticAbilityLinesForCurrentFace`(文単位分割済み・Tier-1 HIGH修正適用済み)をそのまま再利用する。新規のability検出経路を作らない。
4. **対象外(honest manual/defer)**: ability除去("can't have [keyword]"等)・quoted granted non-keyword ability(例: 起動型/誘発型能力の付与)・keyword counter(122.1b。カウンター経由の別ブリッジは別スライス)・複数object(anthem)効果・613.9のoverride/optional条件。

**Golden候補**: `Angelic Gift`(Aura): "Enchanted creature has flying."(attached・単一keyword)。self版はSlice A同様の合成pattern("This creature has deathtouch." 等)を想定。

**スコープ境界(§34.5・PASS に混ぜない)**: Slice A(§34.31)と同一(anthem・611.2解決由来効果・CDA全ゾーン・timestamp/dependency)に加え、ability除去・keyword counterブリッジ・non-keyword ability付与。

**実装出荷(2026-07-06・Codex quota長期枯渇=2026-07-11まで復帰予定なし。ユーザー裁定によりJ3判定者が実装者を代行→独立Sonnet Tier-1監査→ship)**: `effectiveKeywords`を拡張し、`parseLayer6AdditiveKeywordLine`(self/attached双方の"has <keyword-list>"構文を解析。keyword語彙は既存`STATUS_KEYWORDS`14種のみ・`KEYWORD_NAME_TO_ID`(`src/engine/keywordGrammar.ts`の`KEYWORD_DEFINITIONS`由来)でoracle文言→内部idへ変換・未知語が1つでも混じればclause全体をfail closed=部分付与なし)を実装。Slice Aの`staticAbilityLinesForCurrentFace`(文単位分割・Tier-1 HIGH修正込み)をそのまま再利用するため、`effectiveTypeLine`と`effectiveKeywords`の共通反復ロジックを`forEachAdditiveStaticSourceLine`へ抽出(Slice Aの既存挙動を変えない純粋なリファクタ)。新規GameState/GameCommandなし。

**Tier-1監査**: 0 BLOCKER/0 HIGH/0 MEDIUM/0 LOW。Slice Aのreview.*(15 pin)が無変更(byte-unmodified)のまま独立再実行で全緑=リファクタが非regressionであることを確認。7種の敵対的構成(2語keyword名のname→id変換・大文字小文字非依存・list先頭の未知語によるfail-closed・複数Aura同時付与・同一段落内のSlice A/B混在節・無関係隣接文による汚染なし・**誤った付与を意図的に誘発する試み**)全てclean。`KEYWORD_DEFINITIONS`には`banding`/`landwalk`/`phasing`等の`STATUS_KEYWORDS`外keywordも含まれるが、`isKeyword`ガードが正しく14種のみへ絞り込むことを実地確認。

**受け入れ**: `review.cr604-layers-sliceB.test.ts`(レビュー専有・13 pin。self/attached keyword付与・複数keyword/Oxfordコンマ・ability除去/未知語/anthem false-positive・off-battlefield・detached aura・manualKeywords合成・Slice A/B共存非regression・vanilla非regression)。

### 34.33 cr-614-615-616-replacement-prevention: shockland ETB 実装ギャップなし確認(CR 614.1c/614.1d)— この節も契約である

**位置づけ**: cr-614-615-616-replacement-prevention batch3-6(domain初の着手。demand=12=replacement 11+prevention 1)。判定者がMyDeck実測gap data(`research/mydeck-scoring/gaps.json`)を精査した結果、**replacement demand 11件のうち7件(Blood Crypt×2/Godless Shrine/Sacred Foundry/Watery Grave/Breeding Pool)がshockland型("As this land enters, you may pay 2 life. If you don't, it enters tapped.")** であり、既存`landEntersTapped`(`src/engine/status.ts`。'always'/'never'/'conditional'を分類済み)+`playLand`(`src/store/gameStore.ts`。'conditional'時は`'needs-tap-choice'`を返しUIがplayerへ選択を促す)のフローが**既に正しく機能していた**ことを実地確認した(新規実装不要)。

**CR根拠**: 614.1c/614.1d("As [this permanent] enters..."/"[this permanent] enters..."はreplacement effect)。本プロジェクトのサンドボックス哲学(ルールを強制しない。CLAUDE.md設計原則)により、「2ライフ払うか」の実際の支払いは強制せず、tapped/untappedの選択をplayerの誠実な判断に委ねる——これはCR上のreplacement effectの「効果」を honest choice UIとして表現したものであり、gap-classifierの`missingReadWrite: replacement`判定は既存のこのhonest-choice機構を計上していなかった(cr-701 mill/scry/surveil・cr-122 event:counterに続く3件目の「実装ギャップなし」実例)。

**確認内容**:
- `landEntersTapped(def)`が`'conditional'`(unless/if節を含む"enters...tapped"文)を正しく分類。
- `playLand(cardId, opts)`が`'conditional'`時に`opts.entersTapped`未指定なら`'needs-tap-choice'`を返し、battlefieldへ移動しない(選択待ちで停止)。
- `entersTapped: true/false`を指定して再呼び出しすると、指定通りの状態(tapped/untapped)でbattlefieldへ入る。
- 既存の`'always'`(単純tapland)・`'never'`(basic land)は無変更でchoice不要のまま(非regression)。

**残るdemand(未着手・genuine gap)**: graveyard→exile置換hook(Emet-Selch型「If a card or token would be put into your graveyard from anywhere, exile it instead.」・単一controller/source)・damage-doubling replacement(Kuja型。damage substrateとの相互作用が複雑=defer)・kicker依存ETB counter(Everflowing Chalice型。kicker cost追跡が前提=defer)・単一ターン戦闘ダメージ防止shield(Spore Frog型。prevention demand=1件)。

**受け入れ**: `review.cr614-shockland-etb.test.ts`(レビュー専有・5 pin。shockland golden・pay-life選択両方向・unconditional tapland/basic landの非regression)。

### 34.34 cr-614-615-616-replacement-prevention Slice A: 単一ターン戦闘ダメージ防止shield(design-lock・CR 615.1/615.1a)— この節も契約である

**位置づけ**: cr-614-615-616-replacement-prevention batch3-6続き(genuine gap第1弾。prevention demand=1件=Spore Frog型)。既存のCR613 layers系(§34.31/34.32)と同様、本ドメインでも damage substrateには**prevention機構が一切存在しない**ことを確認済み(`grep -n "regenerat\|preventDamage\|damagePrevent" src/engine/commands.ts`=0件)。既存`GameCommand.dealDamage`は`combatDamage: boolean`フィールドを既に持つ(§34.22系のsource-backed damage substrate)ため、これをprevention判定のフックポイントとして再利用する。

**CR根拠**: 615.1(prevention effectはreplacement同様continuously・not locked-in。damage eventを部分/完全に防ぐ"shield")・615.1a("prevent"という語を使う効果=prevention effect)・615.6(防がれたdamageは発生しない。advisory的にeventとしては記録してよい)。

**凍結した設計(ローカルScryfallスナップショットで裏取り済み。当初想定した「dealt to you this turn」というcontroller限定variantは実在しないことを確認=Spore Frog/Fog/Darkness/Constant Mistsは全て同一のグローバル文言)**:
1. **厳密な対応構文(exact-phrase gate)**: `"Prevent all combat damage that would be dealt this turn."`の**完全一致1パターンのみ**認識(Fog/Darkness/Constant Mists/Spore Frogが実際にこの文言で一致)。player-scope付き("...dealt to players this turn"等)・count付き("prevent the next N damage")・source/creature限定("by non-Spider creatures"/"to and dealt by this creature"等)・条件付き("if {W} was spent")は本スライス対象外(honest manual)。
2. **新規state(additive)**: `GameState.combatDamagePreventedUntilEndOfTurn: boolean`(このターンのみ有効なシールド。既存`landsPlayedThisTurn`等ターン単位カウンタと同じ「`handleUntapEntry`でリセット」パターンを踏襲)。
3. **新規command(1個のみ)**: `{ type: 'preventCombatDamageThisTurn' }`(引数なし。グローバル1パターンのみのためplayer-scope引数は不要=YAGNI)。効果コンパイラは`effect.prevent`という新規atomを追加し、上記1パターンのみをauto判定として本commandへコンパイルする(それ以外は`needs-parse`でmanualへfail closed)。
4. **damage適用側のフック**: `applyDealDamage`(既存)が`cmd.combatDamage===true`かつ`state.combatDamagePreventedUntilEndOfTurn`が真なら、実際の`applyPlayerLifeDelta`/`applyOpponentLifeDelta`呼び出しをスキップする(damage eventは引き続きpushし、advisory的に「防がれた」ことをログへ記録=CR615.6の「防がれたdamageは発生しないが、eventとしては観測可能であってよい」との整合)。**creature/card対象(`targetCardId`)への戦闘ダメージも本パターンは対象に含む**(実カードの文言はplayer/creature区別なく「all combat damage」であるため、targetCardIdへのcombat damageも同様にスキップする)。
5. **snapshot前方互換**: 新field追加ゆえ`restoreGame`で`combatDamagePreventedUntilEndOfTurn:false`をbackfill(既存`linkedExiles`等と同型のnormalize規律)。
6. **サンドボックス哲学との整合**: このshieldは「防ぐ」判定のみ行い、コスト(sacrifice/tap)の支払いは既存G4コストコンパイラ(`compileAbilityCost`。self-sacrifice/tap costは既に自動精算対象)に委ねる。本スライスは効果半分のみを担当する。

**Golden候補(ローカルScryfallスナップショット`research/scryfall-rules/2026-06-19/raw/`で検証済み)**: `Spore Frog`: "Sacrifice this creature: Prevent all combat damage that would be dealt this turn."・`Fog`: "Prevent all combat damage that would be dealt this turn."・`Darkness`/`Constant Mists`も同一文言。

**スコープ境界(§34.5・PASS に混ぜない)**: count付きshield(615.7"prevent the next N damage")・source/creature限定variant(Arachnogenesis/Fog Bank/Deftblade Elite等の"by non-X creatures"/"to and dealt by this creature"型)・player-scope付きvariant(Commencement of Festivities型"dealt to players this turn")・条件付き(Batwing Brume型"if {W} was spent")・"can't be prevented"effectとの相互作用(615.12)・prevention triggerability(615.13)・combat以外のdamage prevention(通常damage・noncombat)。

**実装出荷(2026-07-06・Codex quota長期枯渇のため判定者が代行→独立Sonnet Tier-1監査→ship)**: `GameState.combatDamagePreventedUntilEndOfTurn: boolean`(additive)・`{type:'preventCombatDamageThisTurn'}`(引数なし)・`effect.prevent`atom・`isPreventAllCombatDamageThisTurnClause`(完全一致gate)を実装。`applyDealDamage`が`cmd.combatDamage===true`かつshield活性時に、damage eventは引き続きpushしつつ`applyMarkDamage`/`applyPlayerLifeDelta`等の実効果適用のみをスキップ(CR615.6)。`handleUntapEntry`(既存ターン単位カウンタと同型)でリセット。`restoreGame`でbackfill。

**実装中に自ら発見・修正したバグ2件**: ①`detectEffectAtoms`は1行に複数atomがマッチしうる設計であり、既存の汎用`effect.damage`probe(`/\bdamage\b/i`)が"damage"を含む本prevention文にも誤マッチし、`effect.damage`側の未対応clauseが全体decisionをmanualへ引きずる衝突が発生。既存の`effect.tap`/token-creation衝突ガードと同型の対処(該当raw textが完全一致prevention文の時のみ`effect.damage`clauseをno-op化)で解消。②`VALID_RULE_REFS`(grammar/rule-refs.ts)に新atomの`ruleRef:'615'`が未登録で既存invariant test(`review.grammar-ir.test.ts`)が破損→追加。さらに`tsc --noEmit`単体では検出されず`tsc -b`(build script実体・project references経由)でのみ検出される型エラー(`priority.test.ts`の生GameStateリテラルに新規必須fieldが欠落)を発見・修正(ルート`tsconfig.json`が`files:[]`+`references`のみのため、bare`tsc --noEmit`は実質何もチェックしない=このリポジトリ共通の落とし穴。Tier-1が独立再現・原因解説も実施)。

**Tier-1監査**: 0 BLOCKER/0 HIGH/0 MEDIUM/0 LOW。ローカルScryfallスナップショットからFog/Darkness/Spore Frog/Constant Mistsのoracle textを独立に再パースし、design-lockの文言主張(controller限定variantは実在しない)をbyte-exactに再確認。7種の敵対的プローブ(shieldは1回限りでなくターン中無制限・damage発生後のshield有効化はretroactiveに取り消さない・deathtouch flagの漏れなし・amount<=0との相互作用・damage-dealing効果への誤爆なし・exact-phrase gateの前後文脈耐性・snapshot forward-compat)全てclean。

**受け入れ**: `review.cr614-615-prevent-combat-damage.test.ts`(レビュー専有・10 pin。golden・player対象/creature対象双方のshield・noncombat非regression・ターン境界でのリセット・player-scope/creature-scope/条件付き/source限定variantのhonest manual・effect.damage衝突ガードの非過剰suppress確認)。

### 34.35 cr-614-615-616 Slice B: graveyard→exile置換hook(design-lock・CR 614.1a/614.5/614.6・**Fable裁定**)— この節も契約である

**位置づけ**: cr-614-615-616-replacement-prevention Slice B(Emet-Selch型静的置換。J3が高blast-radiusと判定しFable判断待ちに保留していたタスク=commit 8a11a6f)。**Fable(J1)が判定者席に着いた本セッションでアーキ裁定を実施**: `moveCardInternal`(エンジン最大の共有chokepoint)の**冒頭に単一の純粋な行き先書き換えフックを1点挿入する方式を採用**。

**なぜchokepoint直接変更が正しいか(Fable裁定の根拠)**: ①mill(`applyMill`)・surveil(`applyArrangeTop`のtoGraveyard)・discard(`applyDiscard`)・sacrifice・destroy・SBA死亡を含む**全てのgraveyard行きパスが`moveCardInternal`を経由することをgrepで確認済み**(直接`zones.graveyard`へpushする箇所はゼロ)——chokepointの普遍性こそが置換の完全性(取りこぼしゼロ)を保証する。store層orchestrationではエンジン内部moves(SBA死亡・annihilation・mill)を捕捉できず、呼び出し側の個別パッチは取りこぼしが構造的に不可避。②フックは`to === 'graveyard'`でゲートされ、置換ソース不在時(圧倒的多数ケース)は**入力をそのまま返す純粋なpass-through**——他の全destinationはbyte-identical。③既存1447テストがgraveyard移動を広範に踏むため、漏れは大きな音で落ちる。

**CR根拠**: 614.1a("instead"を使う効果=replacement effect)・614.5(replacement effectは同一eventへ1回しか適用されない=行き先を移動前に1回計算する本方式は再帰リスクなし)・614.6(置換されたeventは発生しない。修正後のeventが代わりに起きる=dies誘発[CR700.4=battlefield→graveyard]は行き先がexileになった時点で正しく発火しなくなる——**行き先書き換え方式の自動的正しさ**)・404.1(カードは常にownerの墓地へ行く=「your graveyard」の判定は移動カードのowner==ソースのcontroller)。

**凍結した設計**:
1. **厳密な対応構文(exact-phrase gate・ローカルScryfallスナップショットでbyte-exact検証済み)**: `"If a card (or token )?would be put into your graveyard from anywhere, exile it instead."`——「or token」あり(Hades, Sorcerer of Eld[Emet-Selch裏面]/Necrodominance/Festival of Embers)と無し(Yawgmoth's Agenda)の両variantを1つの正規表現で受ける。それ以外(単発spell自己置換の"If that spell would be put into your graveyard"型・opponent対象・条件付き)は非対応(pass-through=通常通りgraveyardへ)。
2. **新規純粋関数** `graveyardReplacementForMove(draft, card, to): { to: ZoneId; replacementApplied?: string }`(commands.ts内)。`to !== 'graveyard'`なら即座に入力を返す。battlefield上のpermanent(現在のface=`staticAbilityLinesForCurrentFace`を再利用。Hadesは裏面faceIndex 1のため現face尊重が必須)にゲート一致staticがあり、かつ`source.controllerId === movingCard.ownerId`の時のみ`{to:'exile', replacementApplied:'614.6:grave-to-exile'}`を返す。
3. **挿入点は`moveCardInternal`冒頭の1箇所のみ**。`replacementApplied`は既存のZoneChangeEvent envelope field(§34.16系で既設)へそのまま流す。**新規GameState・新規GameCommandなし**。
4. **自己適用あり**(self-exclusionしない): Hades自身が破壊された場合もexileへ(CR上正しい)。
5. **reasonは保存**: discard由来ならreason='discard'のままtoZone='exile'のeventになる(eventは原因に正直)。
6. **複数ソース併存時**: 全ソースが同一の書き換え(exile)を行うため616.1の適用順選択は観測不能=どれか1つのsourceを適用したとみなしてよい(idempotent)。

**明示的deferral(境界)**: ①discard誘発の置換下挙動——CR701.9上は置換されても「捨てた」事実は残りdiscard誘発は発火すべきだが、既存`discardLineMatchesEvent`は`toZone==='graveyard'`を要求するため、**置換が効いている間はdiscard誘発が発火しない**(CR不完全・既知の境界として明記。Madness系実装時に再訪)。②"If that spell would be put into your graveyard"型(Emet-Selch of the Third Seat表面等・単発spell自己置換)。③opponent側graveyard置換(現エンジンはP1中心)。④Leyline of the Void型(opponent対象)・Rest in Peace型(全プレイヤー・"cards and tokens"の別文言)は別ゲートが必要=demandが立ったら追加。

**Golden候補(検証済み)**: Hades, Sorcerer of Eld(Emet-Selch裏面・Kefkaデッキ実需要)・Necrodominance・Festival of Embers・Yawgmoth's Agenda("a card"variant)。

**受け入れ(判定者先行authoring)**: `review.*`にて——置換ソース在時: destroy/sacrifice/discard/mill/SBA死亡の各経路でexileへ行きreplacementAppliedが記録されること・dies誘発が発火**しない**こと・自己適用。置換ソース不在時(pass-through): 上記全経路が従来通りgraveyardへ(byte-identical)。owner不一致時は置換されないこと。off-battlefield/表面(未変身Emet-Selch)では発火しないこと。

**実装出荷(2026-07-06・Fable=J1が裁定・実装を実施→独立Sonnet Tier-1監査→Tier-2裁定→外科修正→ship)**: 設計どおり`graveyardToExileReplacementActive`(status.ts・純粋predicate)+`moveCardInternal`冒頭1点フックで実装。4チェック全green(167 files/1457 tests・full suiteゼロregression=pass-throughのbyte-identical性を全既存テストが実証)。

**Tier-1監査(本セッション最広scope)**: 0 BLOCKER/0 HIGH。pass-through証明(discard/mill/surveil/plain move/SBA死亡+dies誘発正常発火)全経路clean・active-case(SBA収束・token cleanup[704.5d cessationはzone非依存で正常]・annihilation SBA非干渉・undo/snapshot round-trip・owner不一致の非置換)全clean・gate robustness(多文paragraph・大文字・reminder text内外とも`sanitizeLine`→`removeReminderAndQuotes`経由で正しく処理)clean。**発見2件をTier-2裁定**:
1. **commander 903.9a zone-choice抑止(実発見・要対処)**: storeの`moveCommanderWithZoneChoice`は`toZone==='graveyard'`のeventをevent logから検索して903.9aの「統率領域へ戻すか」プロンプトを生成するため、本フックが先に行き先をexileへ書き換えるとeventが存在せず**プロンプトが無言でスキップされる**(commanderが選択なしにexile行き)。CR616.1上は複数replacementの適用順はownerが選ぶべきだが、完全な二段階選択は本domainの宣言済み境界。**Fable裁定=commanderをフックから除外**(`isCommander`チェック追加)——既出荷のuser-facing挙動(903.9aプロンプト)を無言で壊すのはregressionであり、regressionは不完全性に優先する。fail toward pre-existing behavior=least surprise。**明示的deferral追加**: commander が903.9aの選択で「戻さない」を選んだ場合の行き先はgraveyardのまま(Hades型置換は適用されない)——完全な616.1順序選択の実装時に再訪。回帰pin追加済み(11本目)。
2. **ability-word同一行gap(MEDIUM・fail-closed)**: 「Echo of the Lost — If a card...」のようにability wordと置換節が同一文に印刷された仮想ケースでは、`splitRulesText`がem-dashで分割しないためanchored regexが不一致=**置換されない(見逃し方向・誤発動ではない)**。実在する4カード全てでability wordは別段落のため実害ゼロ。将来そのような印刷が現れたら再訪(既知の境界として記録)。

### 34.36 cr-601-casting-stack Slice A: graveyardからの土地プレイ許可(design-lock・CR 601.2a/113.6e-f/400.7g-h)— この節も契約である

**位置づけ**: cr-601-casting-stack batch3-7(plannedSequence先頭。demand=10=cast-permission:from-zone。golden候補=Muldrotha, the Gravetide/Serra Paragon/Icetill Explorer/Crucible of Worlds。全てローカルScryfallスナップショットでbyte-exact確認済み)。**判定者が実装前に既存挙動を調査した結果、demandの過半は既に実装ギャップなし**と判明(4件目の同パターン。cr-701 mill/scry/surveil・cr-122 event:counter・cr-614 shockland ETBに続く)。

**確認内容**: `applyCastToStack`(engine)は`card.zone`を一切検証していない=**graveyard/exileからのspell castは既に無条件で動作する**(サンドボックス哲学=コスト・条件の強制検証をしない設計と自然に整合)。UI(`Playmat.tsx`)もgraveyard/exile上のカードに対し`cast-from-zone`メニュー項目を既に無条件で表示している。これでLurrus/Serra Paragon(spell側)/Chainer/Timeline Culler等、demand 10件中「spellを唱える」型はすべて充足済み。

**残る実gap**: `applyPlayLand`(`src/engine/commands.ts`)が`card.zone !== 'hand'`を例外送出でハード制限しており、**土地をgraveyardからプレイする経路が存在しない**(Muldrotha/Icetill Explorer/Crucible of Worlds/Serra Paragon土地側が対象)。

**凍結した設計**:
1. `applyPlayLand`のzone制限を`'hand' | 'graveyard'`へ緩和(exileは実在goldenに需要なし=対象外・honest defer)。
2. UI(`Playmat.tsx`)へ、`card.zone === 'graveyard' && typeLine.includes('Land')`時の「土地としてプレイ」メニュー項目を追加(既存hand側の項目と同一ハンドラ`requestPlayLand`を再利用)。
3. **新規GameState・GameCommandなし**(既存`playLand` commandのzone検証を緩和するのみ)。コスト系(「once per turn」「permanent type毎に1回」等のMuldrotha/Serra Paragon個別条件)は**強制しない**(既存サンドボックス哲学=土地1枚/ターン制限は既存`landsPlayedThisTurn`カウンタで警告のみ・強行可能)。
4. **honest manual/defer**: exileからの土地プレイ・「spell of each permanent type」のtype-once-per-turn強制・「using its warp ability」等のalt-cost付きcast・"you may play this card from your graveyard until end of turn"型の一時許可(通常許可と区別しない=常時許可のまま。既存サンドボックス哲学と整合するため実害なし)。

**Golden候補(Scryfallローカルスナップショット検証済み)**: Muldrotha, the Gravetide「During each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard.」・Serra Paragon「Once during each of your turns, you may play a land from your graveyard or cast a permanent spell with mana value 3 or less from your graveyard.」・Icetill Explorer「You may play lands from your graveyard.」・Crucible of Worlds「You may play lands from your graveyard.」。

**受け入れ(判定者先行authoring)**: `review.*`にて——graveyard上の土地に対し`playLand`が成功しbattlefieldへ移動すること・手札からの既存挙動が無変更(non-regression)・graveyard上の非land cardには適用されないこと(型エラーのまま)・既存landsPlayedThisTurnカウンタ/警告がgraveyard由来でも同様に働くこと・spell casting from graveyard(既存機能)の非regression確認。

**実装出荷(2026-07-07・Codex quota長期枯渇のため判定者が代行→ブラウザ実機確認→独立Sonnet Tier-1監査→ship)**: `applyPlayLand`のzone制限を`'hand' | 'graveyard'`へ1行緩和(exileは対象外のまま)。`Playmat.tsx`へ`card.zone==='graveyard' && typeLine.includes('Land')`条件で「土地としてプレイ(墓地から)」メニュー項目を追加(既存`requestPlayLand`ハンドラを再利用)。UI変更を伴うため、ブラウザ実機(Claude Preview)で実際にForestを墓地へ移動→右クリック→新メニュー項目クリック→battlefieldへの移動をpreview_evalで直接確認(コンソールエラー0件)。4チェック全green(168 files/1464 tests)。

**Tier-1監査**: 0 BLOCKER/0 HIGH/0 MEDIUM/0 LOW。ターン内土地枚数上限の警告・`entersTapped`(既存`landEntersTapped`はcard定義textのみを見てzone非依存)・artifact landでの`cast-from-zone`分岐との非衝突(既存除外条件`!typeLine.includes('Land')`により相互排他)・exile/非land/library/battlefieldでの非適用・Scryfall独立再検証(4golden全て生テキストでbyte-exact確認)・手札からの既存挙動非regression、全てclean。UIのscope creepなし(exile/library等への誤爆なし)。

### 34.37 cr-modal-target-optional-variable: modal選択肢commandコンパイルは実装ギャップなし(CR 700.2)— この節も契約である

**位置づけ**: cr-modal-target-optional-variable batch3-8(plannedSequence最終エントリ。demand=10=choice:mode-or-value。golden候補=Teval's Judgment/Sheoldred's Edict)。**判定者が当初、`buildGuidedCommands`(`compile.ts`)の`answer.kind==='modal'`分岐が常に`return []`であることを実装gapと誤認し、compile.ts側に再帰sub-compileロジックを実装しかけた**。しかし既存の`review.grammar-guided.test.ts`(既存judge-owned pin=「modal の buildGuidedCommands は \[\](再帰コンパイルはストア)」)がこれを明示的に契約として凍結しており、実装を追加した瞬間にこの既存pinが赤くなって発覚した。engine-spec本体(§32系G3設計)にも「モード内アトムはトップレベルでは実行しない=ストアが選択後に再帰コンパイル」と既に明記されていた。

**調査の結果、`src/store/gameStore.ts`の`compileSelectedModalOptions`(`confirmGuidedModal`から呼ばれる)が、まさにこの「選択された各モードのraw textを`parseAbilityIR`+`compileAbilityIR`で再帰コンパイルし、`auto`/`guided`両方の結果を`commands`/`prompts`として蓄積する」機能を既に実装済みであることを確認した**(判定者が意図した設計より完成度が高い=modeごとにguided段階=target選択等も個別にchain可能)。**ただし一度もend-to-endでテストされていなかった**(`grep -rn "confirmGuidedModal" src/store/__tests__/`が0件)。

**確認内容(store層・実地確認)**: `newGame`→spellをstackへ→`resolveTop()`(→`pendingGuided`にmodal promptが載る)→`confirmGuidedModal([0])`の一連を実行——
- Teval's Judgment型("Choose one — • Draw a card. • Create a Treasure token. • Create a 2/2 black Zombie Druid creature token.")の"Draw a card."モード選択で、実際に手札が1枚増える(既存`effect.draw`leafが再帰コンパイルされ`commands`へ正しく載る)ことを確認。
- Sheoldred's Edict型(3モード全て"Each opponent sacrifices..."=既存sacrifice leafは自己/単一target限定で非対応)のモード選択でも**クラッシュせず**、当該モードの効果は実行されないがspell自体は正しくstackから解決される(CR700.2=各モードは独立した効果であり、1モードが引数非対応でも呪文解決そのものは進む、というCR上正しい挙動と一致)。

**CR根拠**: 700.2(モーダル効果=選択した各モードを個別の効果として実行。各モードの独立性ゆえ、1モードがengineの限界で実行不能でも呪文解決自体は妨げられない)。

**結論**: **本ドメインの主要demand(choice:mode-or-value)は実装ギャップなし**(cr-701 mill/scry/surveil・cr-122 event:counter・cr-614 shockland ETBに続く、本セッション5件目の同パターン)。新規実装は不要。判定者が誤って追加しかけたcompile.ts側のロジックは撤回済み(既存`review.grammar-guided.test.ts`のpinは無変更のまま)。`src/store/__tests__/review.cr700-modal-choice-compile.test.ts`(レビュー専有・新規)でstore層の実際の動作を初めて恒久的にpin留めした。

**スコープ境界(§34.5・PASS に混ぜない)**: variable count("choose X modes")・repeated modes・"choose both"時の混在(1モードのみauto/guided・他が非対応の場合の部分実行=既存実装のまま=各モード独立実行なので問題なし)・target選択を伴うモードの2段階guided chain(既存`prompts`蓄積機構で理論上サポートされているが実地未検証=次回demand時に確認)。

**受け入れ**: `review.cr700-modal-choice-compile.test.ts`(レビュー専有・store層end-to-end pin。golden=Teval's Judgment型のdraw mode実行確認・Sheoldred's Edict型の非対応モードでも非クラッシュ+呪文解決確認・compile.ts側`buildGuidedCommands`が引き続き`[]`を返すという既存契約の再確認)。

### 34.38 cr-702-keyword-abilities-frequent Slice A: lifelink + trample(単一blocker限定・CR 702.15/702.19)— この節も契約である

**位置づけ**: plannedSequence batch4-1(判定者=J3 Sonnet。Codex quota長期枯渇[2026-07-11まで]のため判定者が代行実装)。台帳の本domainは`drafted`だったが、その`nextGate`(「combat/damage/layers/cast-from-zone substrateが閉じた能力からcompiler対象へ昇格する」)が要求する前提条件——`cr-506-510-combat`(single blocker/damage core)・`cr-120-damage`(damage substrate)・`cr-604-...-layers` Slice A/B(Layer4/Layer6)・`cr-601-casting-stack`——は全て`shipped`/凍結済みと確認し、着手した。

**実装前の現状確認(重要)**: `Keyword`型(`src/engine/status.ts`)には`flying`/`vigilance`/`trample`/`deathtouch`/`lifelink`/`menace`/`first-strike`/`double-strike`/`reach`/`haste`/`hexproof`/`indestructible`/`defender`/`ward`が既に定義され、`effectiveKeywords`(Layer 6・S-LAYERS Slice B出荷済み)が印刷キーワード+付与キーワードの両方を解決する。`deathtouch`は既にCR 704.5hの1点致死ダメージSBAへ接続済み(`hasDeathtouchDamage`/`applyMarkDamage`)。`vigilance`(untap不要)と`haste`(召喚酔い免除)も既に接続済み(`status.ts`内の既存関数)。**未接続だったのは`lifelink`(ライフ獲得)と`trample`(超過ダメージのプレイヤーへの割当)の2つのみ**——「キーワード認識」自体は既に完了しており、本Slice Aは純粋にこの2キーワードの戦闘ダメージ効果を配線する作業だった。

**CR根拠**:
- 702.15b「Damage dealt by a source with lifelink causes that source's controller ... to gain that much life (in addition to any other results that damage causes).」
- 702.19a「Trample ... has no effect when a creature with trample is blocking」(攻撃側のみ)
- 702.19b「The controller of an attacking creature with trample first assigns damage to the creature(s) blocking it. Once all those blocking creatures are assigned lethal damage, any excess damage is assigned ... to ... the player[.] ... take into account damage already marked on the creature ... but not any abilities or effects that might change the amount of damage that's actually dealt.」
- 704.5h(deathtouch lethal = 1点。既存実装を再利用、trampleのlethal計算にもそのまま適用)。

**凍結した設計**:
1. `applyPositiveCombatDamage`(`src/engine/commands.ts`)にsourceの`controllerId`を追加引数化し、`effectiveKeywords`が`lifelink`を含む場合は`gainLifeForController`(新規純粋ヘルパー)でその分の生命を獲得させる。P1所有なら`applyPlayerLifeDelta`、それ以外は`applyOpponentLifeDelta`(既定ラベル)を再利用——**新規GameStateフィールドなし**、既存のライフ変動経路を再利用するのみ。
2. 新規`trampleLethalAssignment`(純粋関数)= 攻撃側がtrample保持かつ単一blockerの場合のみ、`effectiveToughnessForSba`(既存)と`markedDamageOf`(既存・戦闘前の値)から必要致死量を計算し、`{toBlocker, overflow}`を返す。deathtouch保持なら1点に固定(704.5h)。**blockerの実効toughnessが`null`(可変P/T等で解決不能)の場合は honest defer= 通常通り全量をblockerへ(overflow 0)**——推測しない。
3. `applyResolveCombatDamage`の単一blockerパスに`trampleLethalAssignment`を組み込み、overflow分は既存の`addCombatPlayerDamage`(unblocked attacker既存パスと共有)経由でdefending playerへ加算。
4. **新規GameCommandなし**(既存`resolveCombatDamage`の内部ロジックのみ変更)。

**明示的スコープ境界(§34.5・PASS に混ぜない)**:
- **multiple blockers**は`cr-506-510-combat`が既に`deferred`と宣言済み(手動割当警告)——trampleとの組み合わせも同様に対象外のまま(既存の複数blocker警告パスは無変更)。
- **first strike/double strike**(702.4/702.7・追加の戦闘ダメージステップが必要な構造変更)は本Sliceの対象外(Slice B候補として台帳へ残す)。
- **ward**(702.21・対象化時の追加コスト課すtrigger)・**flying/reach/menaceのブロック合法性**(現エンジンはブロック宣言時の合法性を強制検証しない=サンドボックス哲学と自然に整合するため、警告のみの実装が必要なら別Slice)は対象外。
- **trample over planeswalkers**(702.19c/e/f)はplaneswalkerへの戦闘ダメージ自体が既存`applyDealDamage`で明示的に未対応(`プレースウォーカーへのダメージはこのスライスでは未対応です`)なため、当然に対象外。
- 既存の「戦闘ダメージ防止フラグ(`combatDamagePreventedUntilEndOfTurn`)が`resolveCombatDamage`経由の自動戦闘解決では一切参照されない」という既存の未接続(`applyDealDamage`の明示コマンド経路のみ参照)は、本Sliceが発見した別種の既知境界であり、修正は本Sliceの範囲外(スコープ外の別課題として記録のみ)。

**Golden候補**: lifelink単体(Vampire Nighthawk等の標準的な飛行+接死+絆魂クリーチャー相当のvanilla構成)・trample単体(Ghalta等の高power trampleクリーチャー相当)・trample+deathtouch複合(Rot Wolf等)。

**受け入れ(判定者先行authoring)**: `review.cr702-lifelink-trample.test.ts`(レビュー専有・新規)——unblocked attacker のlifelinkが攻撃側controllerのライフを damage 分獲得すること・単一block交換で双方lifelink保持時に各々独立して獲得すること・trampleが単一blockerに致死量のみ割当て残りをdefending playerへ回すこと・trample+deathtouch複合で致死閾値が1に下がること・**非trample攻撃者は単一block交換で全量をblockerへ割り当てる回帰確認**・blocker toughness不明(`*`)時はtrampleでも全量をblockerへ割り当てoverflowしない回帰確認。4チェック全green(170 files/1474 tests)。

**Tier-1監査(独立Sonnetサブエージェント・冷たいセッション)**: 0 BLOCKER/0 HIGH/0 MEDIUM/0 LOW。多attacker下でのblocker二重処理懸念(`blockersById`はcardId一意キー+`blocking.length===1`ガードにより構造的に不可能と確認)・lifelink帰属先(P1/OPPONENT_A分岐は既存の単一opponent前提と整合・現エンジンで多opponent到達不能ゆえ非issue)・trampleのplayer-targetガード・`trampleLethalAssignment`の符号/off-by-one(overflowは常に非負)・honest-defer経路(`*`toughness)・戦闘ダメージ防止フラグ非参照(既存の別課題・本sliceが悪化させていないことを確認)・lifelinkとSBAの順序(同一関数内で同期的に処理されるため中間状態リスクなし)・非trample/非lifelinkクリーチャーでの既存挙動非regression、全てclean。

### 34.39 cr-122-counters candidate-4: 自己参照 +1/+1 counter leaf(CR 122.1/608.2 代名詞先行詞)— この節も契約である

**位置づけ**: plannedSequence batch5・candidate-4(判定者=在席 Opus 判定者席・実装=Sonnet サブエージェント)。§4「実装前カバレッジ検証」で実カバレッジ25-30件(census 非依存の compiler-confirmed gap)を確認して着手。

**契約**: `effect.counter-plus` の **「put a/an/<固定N> +1/+1 counter(s) on it」**(target 無し・`it` の後に残余テキスト無し)を **`decision:'auto'`** 化し、既存 `{type:'addCounters', cardId: ctx.sourceId, counterType:'+1/+1', delta:n}`(§32 の counter command 表と同一)を emit する。プレイヤー選択なし・target prompt なし・**新 GameCommand/GameState なし**(固定 self-draw と同型)。符号は既存 `counterDescriptorForRaw` が解析(+1/+1 のみ・-1/-1 等は対象外)。

**要石=CR 608.2 代名詞先行詞の allow-list(fail-closed)判定**: `it` が **source 自身だと積極的に確定できるときのみ** auto。判定は直近の先行クローズ(最も近い antecedent)の主語を、①先頭コスト接頭辞(`^[^:]*:`)②トリガー語(whenever/when/at)を剥がして取り、**(a)「this <permanent-type>」指示語**(例「This Vehicle becomes...」)または **(b)カード自身の固有名**(`ctx.def` 各面フルネーム+カンマ前短縮形。oracle は短縮名を使う=「Whenever Alesha attacks」)のときのみ true。それ以外(**不定主語**「a/an/another <X> you control」・「a permanent」・別名オブジェクト・antecedent 無し)は **manual に fail-closed**。追加安全網として先行クローズの target/create/onto the battlefield/equipped/enchanted も block。

**なぜ deny-list では不十分だったか(独立 Tier-1 の実測)**: 初版は deny-list(危険パターンに不一致→自己適用=**fail-open**)で、17,491枚コーパス実測で **false-auto 11件**(「Whenever **a creature you control** attacks, put a +1/+1 counter on it」型で `it`=不定主語≠source。Case of the Pilfered Proof/Rite of Passage/Stensia Masquerade など **source が非生物 Enchantment** の例まで含む=誤自動化≈0 違反)を検出。allow-list 転換で false-auto 11→**0**・正当 auto **19件維持**(this creature 型11+自名型4+This Vehicle becomes 型4)を判定者がコーパス flip 再実測で確認。

**スコープ境界(defer)**: -1/-1 や charge/loyalty 等 +1/+1 以外・可変数(for each/X)・each/mass・複数 counter 種混在・equipped/enchanted 相対・「on it」の後に残余修飾を持つ複合節。ループ変更(`AbilityIR.effectClauses: string[]` 追加で全 split-clause を antecedent 文脈に供給)の blast radius=counter 以外の atom 反転 **0件**(Tier-1 実測)。

**受け入れ(判定者先行 authoring)**: `review.cr122-self-referential-counter.test.ts`(レビュー専有)= 正例(this creature/自名/This Vehicle becomes 型→auto・source counter)+ **不定主語 HIGH pin**(a/another <X> you control・非生物 source→manual・self counter 無し)+ Aang型先行 target/Additive Evolution型先行生成→manual。機械チェック(`npm run check`)全緑。

### 34.40 手動スタック対象注記 `setManualTargets`(サンドボックス可視化・CR 115/400.7/707.10)— この節も契約である

**位置づけ**: cr-115-targets の拡張(1機能スライス)。文法がモデル化できないカードでも、ユーザーがスタック項目に**任意の他スタック呪文/戦場パーマネントを対象として注記**できるサンドボックス可視化機能。**由来=並行 ChatGPT UI トラックが UI 作業中に書いたエンジン変更を、判定者が抽象昇格を審査し独立監査を通してエンジンスライスとして再オーナー化**(設計 draft は `research/cr-grounding/manual-stack-target-annotation.draft.md`=「judge review required」で提出されていた)。

**契約**: 新 `GameCommand` `{type:'setManualTargets'; stackItemId; targetIds}` を追加。既存 `targetSelections`/`TargetSelection` state を再利用(**新 state 型なし**)。
- source は**スタック上の非ability(呪文)**必須(非stack・ability は EngineError=機能は文法で解けない呪文の可視化用・能力は guided compilation が対象をモデル化。判定者裁定)。候補は**他の非ability スタック呪文** or **非ability 戦場パーマネント**(hand/graveyard 等・ability・自己は拒否)。
- 注記は `slotId:'manual-target-N'`・`raw:'手動で指定した対象'`・**`legalityMode:'unchecked-warning'`** で記録。
- **parser 由来の checked 選択は保持し、`manual-target-*` 名前空間のみ置換/クリア**(再呼び出しは manual を入替・非manual不変)。
- 1コマンド=1 undo/redo ステップ(決定的)。**注記は CR-legal の主張でも自動実行の指示でもない**=guided compilation・stored-target execution は `manual-target-*` を rules target として**絶対に消費しない**。

**CR 根拠**: 115.1a/601.2c(実 target の権威=注記はこれを僭称しない・608.2b legality は注記から推論しない)。**CR 400.7**=ゾーン遷移は記憶なしの新オブジェクト化ゆえ `resetCardForZoneChange` で **targetSelections 全体をクリア**(checked/manual とも。resolve/recast 後に stale 注記が残らない。real target は毎 cast で選び直す)。**CR 707.10**=コピーは choices(targets 含む)をコピーするため `applyCopyStackItem` で `targetSelections` を複製。

**判定者裁定**: 抽象昇格(北極星③)=既存プリミティブに「スタック項目へ手動対象を書く」操作は無く、既存 `targetSelections` state を再利用する最小の新コマンドゆえ**承認**。ゾーン遷移の全クリア範囲(draft が判定者へ委ねた open question)=CR400.7 準拠で**全 targetSelections クリアを承認**。

**受け入れ(判定者先行 authoring)**: `review.cr-manual-stack-targets.test.ts`(レビュー専有・8 pin)= unchecked-warning 記録・非stack source 拒否・不正ゾーン target 拒否(no partial write)・自己注記拒否・manual名前空間のみ置換・checked 選択保持・**CR400.7 ゾーン遷移全クリア**・決定性(入力state不変)。UI(注記ダイアログ・stack-to-stack 矢印)は並行 ChatGPT トラックが別途担うため本エンジンスライスに含めない。

**改訂(2026-07-19・判定者承認・CR 115.2/115.5/405.1–4)**: `setManualTargets` に additive な `allowStackAbilities?: boolean` を追加。**未指定(既定)は上記の spell-only 契約を厳密維持**(既存 review pin は不変のまま有効)。`true` のとき、source は任意のスタックオブジェクト(呪文・起動型能力・誘発型能力)を許可し、target 候補にも他のスタック上の能力を含める(《物真似の達人、悟悟》型=能力を対象とする能力)。自己対象拒否(CR 115.5)・ゾーン離脱拒否・unchecked-warning 意味論・manual名前空間・CR400.7 全クリア・コピー複製は全kind共通で不変。ゲームプレイUIは常に `true` を渡す。`eligibleTargets` の stack zone には `stackKinds?: ('spell'|'activated-ability'|'triggered-ability')[]` フィルタを追加(未指定=従来どおり spell のみ。能力オブジェクトはカードタイプを持たない[CR 405.4]ため card-type filter は spell 専用)。設計草稿= `research/cr-grounding/stack-object-targeting-expansion.draft.md`。

### 34.41 cr-400-408 reanimation の mana value 上限フィルタ拡張(§34 exact-match reanimation leaf の additive 拡張)— この節も契約である

**位置づけ**: batch6 replenishment(judge=在席 Opus 判定者席・実装=Sonnet サブエージェント)。信頼 demand 計器(`score-ts-credit-nonability-paths` 出荷後)のトップから Haiku probe が起こした候補を判定者が §4 census 実測(`gaps.json` reanimation 16行=Celes reanimator 集中)で検証して選定。judge-gated だった cr-400-408 の **re-scope option A** を un-gate。新 substrate でなく既存の exact-match graveyard-return leaf(「Return target creature card from your graveyard to the battlefield.」)への **additive 拡張**。

**契約**: graveyard-return の compile leaf を単一 recognizer `graveyardReturnFilterForRaw`(`compile.ts`)に統合し、次の2形を guided(filter 補助つき target 選択・完全自動ではない)にする。いずれも **single `target`・末尾 `from your graveyard to the battlefield` で終わる(後続修飾なし)**:
1. `Return target creature card from your graveyard to the battlefield.`(本スライス前から不変・`maxManaValue` なし)。
2. `Return target <creature|permanent> card with mana value N or less from your graveyard to the battlefield.`(N=固定非負整数リテラルのみ)→ filter `{ types:[creature|permanent], zone:'graveyard', owner:'you', maxManaValue:N }`。
trigger/ETB 前置き(When enters/Whenever.../At the beginning...)とは合成可(leaf は return 節本体 `effect.raw` のみ照合=既存 Karmic Guide と同型)。

**substrate 追加(最小・additive)**: `TargetFilter` に `maxManaValue?: number` を1つ追加(既存フィールドの意味変更なし)。`eligibleTargets`(`commands.ts`)の graveyard 分岐を (a)`types.includes('permanent')`(**CR 110.4a** permanent card=artifact/battle/creature/enchantment/land/planeswalker のうち **battle を除く5型**=`battle` は本コードベースが未モデル化ゆえ意図的除外・battle 導入スライス時に追加)と (b)`maxManaValue` 上限除外(未指定時は一切除外せず=既存挙動不変)へ拡張。mana value は既存 `manaValueOfStackObject(card, face?.manaCost, def?.cmc)` 再利用(非stack ゾーン=`def.cmc` そのまま=`ObjectSnapshot.manaValue` と同源・新導出ロジックなし)。**新 GameCommand/GameState なし**・resolution(`buildGuidedCommands`→`moveCard(→battlefield)`)不変(上限は選択時 filter のみ)。

**要石=recognizer 単一化(activation-time 一貫性・CR 602.2b)**: compile 経路(`graveyardReturnFilterForRaw`)と起動時 target-prompt 経路(`commands.ts` の `targetFilterForActivationRaw`/`isSingleActivationTargetClause`)が **同一 recognizer を共有**(`compile.ts` から export し `commands.ts` が import・型 import のみゆえ循環なし)。旧 `commands.ts` の複製 `isExactGraveyardCreatureReturn` は **削除**=desync クラスを構造的に根絶。これにより起動型 reanimation(Order of Whiteclay `{1}{W}{W}, {Q}: Return target creature card with mana value 3 or less...`)も **起動時に**上限 filter つき target を提示(CR 602.2b=起動型能力の対象はスタックに乗せる際に選ぶ)。**独立 Tier-1 がこの HIGH desync を実測で検出**(初版は起動型経路が exact-match のまま=起動時プロンプト空・無警告 commit→resolve 時暗黙 guided 化の半端実行)→ 判定者裁定(compiler誤訳/scope-desync)で差し戻し→単一化で解消。

**スコープ境界(manual 維持)**: `up to one/X target`(可変/optional count)・`Return all ... cards`(mass)・`mana value X or less`(可変 X)・`Return this card`(自己参照・no target)・`from an opponent's graveyard`(owner 境界)・`you may return`(optionality wrapper=`EffectClause.optional` が leaf 一段上で既に gate)・`tapped`/`under your control` 等の後続修飾(regex `$` アンカー)。activated ability の完全自動化はしない(target は依然ユーザー選択)。

**CR 根拠**: CR 109.2a(「card」+ゾーン名=そのゾーンのカード集合)・CR 202.3/202.3b(mana value=非負整数特性・非stack カードは cmc 由来)・CR 701.14a(return=指定ゾーンへ移動)・CR 608.2b(解決時 target legality 再チェック=既存 leaf と同じ)・**CR 110.4a**(permanent card 定義)・CR 602.2b/601.2c(起動/唱える際に対象確定)。

**受け入れ(判定者先行 authoring)**: `review.cr400-408-return.test.ts`(レビュー専有)batch6 describe = creature/permanent の MV上限 guided + filter shape・MV境界 eligibility(MV=N 可・N+1 除外)+ 解決・6 DEFER 形全 manual・無フィルタ exact-match 非回帰(`maxManaValue` 漏れなし)・**起動型 MV reanimation の activation-time target 提示 pin**(Order of Whiteclay 型=`activationTargetPromptsForSource` 非空+上限 filter)。**コーパス flip 実測(408 reanimation 行)= false-auto 0・IN形13カード正しく guided**(独立 Tier-1)。機械チェック(`npm run check`)全緑。

### 34.42 MP-STATE: N-player 正準 player state(design-lock・CR 102.1/103.1/103.4c/800.1)— この節も契約である

**位置づけ**: `cr-player-specific-zones`(lane=late-backbone・status=drafted)の**実行スライス第1弾**。新トラックではない。ユーザーが 2026-07-15 に台帳 `selectionRule` STOP①(「V4 オンライン前進 vs V1 磨き込み」・予約済み価値判断)を **V4 前進**へ裁定したことによる。設計正本=`research/cr-grounding/multiplayer-foundation-opponent-setup.draft.md`(実装者レーン草稿)+ 本節(判定者裁定 8 点で改訂)。**本節はコード契約を規定し、MP-STATE の実装範囲は state 形 + backfill + 不変条件のみ**=挙動不変・UI なし・コマンドの player 対応は次スライス。

**なぜ rule leaf より先か**: `docs/engine-design-method.md` §0.1「最も戻しにくいのは state 設計」「『今できる最小実装』ではなく『最終的に正しいエンジンへ接続できる最小一手』を選ぶ」。かつ台帳**最高需要**バックログ = `cr-121-drawing` candidate-2「cross-player effect execution」(demand=48・全ドメイン中最大)は多人数基盤なしに実装不能(§32.9 area「draw は P1 専用 `pushDrawEvent`・複数受け手を誠実に表現できず手動強制」)。**多人数基盤は CR トラックの中断ではなく最高需要 leaf の解錠**(北極星③整合)。

**CR 根拠**: 102.1(active/nonactive player は一級参加者)・103.1(turn order は順序付き関係であって2値トグルではない)・103.4c(統率者戦の開始 life=40)・110.2(全 permanent に owner/controller)・400.1(library/hand/graveyard は player 私有・battlefield/stack/exile/command は共有)・800.1(3人以上=多人数)。CR 801(limited range of influence)は既定無効=free-for-all のみ・本スライス範囲外。

**前提の現況(実測)**: `PlayerId = 'P1' | 'OPPONENT_A'`(閉じた union)。life/poison/energy/experience/manaPool と per-turn counter は**単一 scalar**。turn order は state になく `priority.ts` の module 定数 `DEFAULT_TURN_ORDER`。`activePlayerId` は存在するがどのコマンドも書かない(read only)。`CardInstance.ownerId`/`controllerId` は既に必須非 optional・battlefield は既に単一共有配列(=§34.17 の遺産により **board 側は既に N-player 形**)。

**現況=3つの player identity scheme が並存する**(草稿の最大の欠落・本節で明示化):
1. `PlayerId = 'P1' | 'OPPONENT_A'`(union)
2. 自由文字列ラベル: `opponentLife: Record<string, number>` / `commanderDamage: Record<string, number>`
3. `DefeatPlayerRef = 'P1' | \`opponent:${string}\``
`LifeChangeEvent` が 1 と 2 を `playerId` + `lifeLabel?` で場当たり的に橋渡ししている。

**凍結した fork 決定(判定者裁定・6点)**:
1. **正準 = `players: Partial<Record<PlayerId, PlayerState>>` + `turnOrder: PlayerId[]` + `localPlayerId: PlayerId`**(CR102.1/103.1)。`PlayerState = { id; label; life; poison; energy; experience; manaPool; landsPlayedThisTurn; spellsCastThisTurn; drawnThisTurn; mulliganCount }`。state 形は 2〜4 人を受容し、初期ローカルゲームは `P1` + 既定対戦相手 1 人を作る。
2. **`PlayerId` を validated opaque string へ開く。ただし `Partial<Record<>>` + `requirePlayer(state, id)` を代償制御として必須とする**。理由=`tsconfig.app.json` は `strict: true` だが **`noUncheckedIndexedAccess` は off** ゆえ、`PlayerId` が `string` になると `Record<PlayerId, X>` はインデックスシグネチャ化し `state.players[任意文字列]` が `PlayerState` 型として通り**実行時 undefined**=型検査が最も必要な瞬間に沈黙する。`noUncheckedIndexedAccess` のグローバル有効化はリポジトリ全体差分ゆえ本スライスでやらない。branded type も却下(`'P1'` リテラルが 182 箇所)。**`PLAYER_IDS` は意味を変えず据置**=現状 `commands.ts` で手動 player target を弾く**ホワイトリスト**であり列挙ではない(`state.players` へ繋ぐと3人目が対象に取れる=挙動変化)。
3. **ミラーの極性は反転させない**(§34.17 fork決定1/4 と同型)。`manaPool` は単一コマンド内で読み書きが交錯し(engine 内 18 読者 + `mana.ts`/`manaTransaction.ts`/`autotap.ts` が `state.manaPool` を直読)、`players` を draft 内 write surface にすると全読者の同スライス書換=「コマンドの player 対応」= 次スライスの仕事になる。→ **正準は「観測境界における `players`」**。レガシー scalar は draft 内部の書き込み面のまま、チョークポイントで `players` を**丸ごと再構築**する。single-writer は構造的に保証される(writer は 1 つ・毎回全再構築ゆえ乖離が原理的に起きない)。極性反転は MP-ZONES/COMMANDS。
4. **「3 scheme の統一」= 正準 identity と全単射の確立であって storage の再キーではない**。再キーは (a) `opponentLife` のキーがユーザー可視(`LifeSheet.tsx`・`docs/acceptance.md` step 20)、(b) `defeat` のキーが `DefeatAdvisoryEvent.playerRef` 経由で**イベントログに載る**ため I14(event 決定性)と golden replay baseline を壊す。→ `PlayerState.label` が表示文字列を持ち、`playerIdForLifeLabel` / `defeatPlayerRefForLifeLabel` が **3 spelling の唯一の橋渡し点**になる。storage 再キーは **MP-IDENTITY**(golden re-baseline と UI 変更を所有する別スライス)へ carry。§34.17 fork決定2「`opponentLife` は互換ビューとして残し同スライスで削除しない」と整合。
5. **`commanderDamage` は本スライス範囲外**(`PlayerState` に載せない)。`commanderDamage` のキーは**対戦相手のラベルではなく相手統率者のラベル**であり、値 ≥21 は**常に P1 の敗北 advisory** を作る(`commands.ts` の SBA・reviewer pin が `reasonsFor('P1')` を固定し `reasonsFor('opponent:...')` の非包含を固定)。つまり「P1 が受けた統率者ダメージ」であって「対戦相手」ではなく、`PlayerId` への全域写像は存在しない。§34.16 が既に per-opponent-exact commander damage を carry 済み・§34.17 fork決定2 が誠実形を凍結済み → CR 903.10a マトリクス実装スライスで扱う。
6. **snapshot は `SNAPSHOT_VERSION` を上げない**。`loadSnapshot` は `version !== SNAPSHOT_VERSION` の snapshot を**破棄して null を返し**、migration path は存在しない=version bump はユーザーのゲームを捨てる。→ version 1 のまま `normalizeSnapshotState` で backfill(既存 per-field defaulting パターン)。**incoming snapshot の `players`/`turnOrder` は信頼せず再導出**(§34.17 の「flat が正・既存値は使わない」規律と同型)。

**導出規律(single-writer の構造的保証)**: `syncDerivedViews = syncPlayersFromLegacyScalars ∘ syncP1ZonesByPlayerFromFlatZones` を**合成**し、既存の `syncP1ZonesByPlayerFromFlatZones` 呼び出し 8 箇所(`commands.ts` 7 + `gameStore.ts` normalize 1)を**置換する(追加ではない)**。**合成が安全論証の核心** — §34.17 の HIGH-1 は「片方の sync を1経路だけ忘れた」バグだった。合成すれば 2 つのミラーが異なる site 集合で同期されることが今後も原理的に起こらない。直接呼び出しの残存は grep 検証可能(定義 + `syncDerivedViews` 内の 1 参照のみが正)。`turnOrder` も**導出**(独立に書けない)=`[localPlayerId, DEFAULT_OPPONENT_ID, ...extras を label.localeCompare 順]`。`localeCompare` は既存 opponent SBA 反復順(`commands.ts`)と同一ゆえ advisory emission 順が動かない(I14)。これにより `addOpponent`(store)と `LifeSheet.tsx` は**無改変で動く**(`opponentLife` にラベルが載ればチョークポイントが player を鋳造し `turnOrder` を伸ばす)。`init.ts` も `players`/`turnOrder` を手組みせず `syncDerivedViews(base)` を返す(構築経路の二重化=drift 源を作らない)。

**チョークポイント外の writer(必ず塞ぐ)**: `goldenReplay.ts`(initial-state override が `{...state, life, opponentLife, manaPool}` を spread)と `fixtureBuilder.ts`(`{...state, manaPool}`)。前者は **golden baseline を汚染する**=受け入れ信号そのものが腐るため最優先。両方 `syncDerivedViews` で包む。

**不変条件(I24 から採番。I1〜I21 は live・I22/I23 は §34.17 が予約済み)**:
- **I24 整合性**(102.1/103.1): `localPlayerId ∈ keys(players)`・`players[id].id === id`・`turnOrder` 重複なし・`keys(players) === set(turnOrder)`。
- **I25 局所投影**(= single-writer の pin): 全 `applyCommand`/`performStateBasedActions`/`initGame`/`restoreGame` 後、`players[localPlayerId].{life,poison,energy,experience,manaPool,per-turn counters}` がレガシー scalar と deep-equal。
- **I26 対戦相手全単射**(400.1/103.1): `∀ label ∈ keys(opponentLife)` に対し `players[playerIdForLifeLabel(label)]` が存在し `.life === opponentLife[label]` かつ `.label === label`。孤児なし。写像は**単射**(`opponent:対戦相手A` は鋳造されない=既定ラベルは `OPPONENT_A` へ写るため衝突しない)。
- **I27 APNAP 凍結**(= 挙動不変の pin・103.1): `orderPendingTriggersApnap(…, state.turnOrder)` が `DEFAULT_TURN_ORDER` 版と同一 `orderedIds` を返す。既定ゲームでは `turnOrder === DEFAULT_TURN_ORDER`。対戦相手追加時も `PendingTrigger.controllerId` は常に `'P1'|'OPPONENT_A'` ゆえ余分 id は 0 件寄与し、extras が `OPPONENT_A` の**後**に並ぶ導出規律がこれを保証する。
- **I28 backfill/冪等**(前方互換・[[snapshot-forward-compat]]): `players`/`turnOrder`/`localPlayerId` を削除した legacy snapshot が throw せず復元し I24〜I26 を満たす。`normalize(normalize(s)) === normalize(s)`。**破損した `players`/`turnOrder` は信頼せず再導出**。

**スコープ境界(§34.5・PASS に混ぜない=4点不変条件④)**: `commanderDamage` の per-player 化(fork決定5)・`opponentLife`/`defeat`/`DefeatPlayerRef` の storage 再キー(fork決定4→MP-IDENTITY)・極性反転と `mana.ts`/`manaTransaction.ts`/`autotap.ts` の accessor 移行(fork決定3→MP-ZONES/COMMANDS)・コマンドへの player subject 追加・owner ルーティング private zone・`commands.ts` の `PLAYER_IDS.includes` 検証の `state.players` 化(3人目が対象になる=挙動変化)・branded `PlayerId`・UI の `'対戦相手A'` リテラル重複除去・`cloneZonesByPlayer` の 2 キー固定(3人目の zone を黙って落とすが本スライスでは誰も鋳造しない=documented boundary)・ラベル trim 衝突(`addOpponent` は trim するが `adjustOpponentLife` はしない=既存挙動ゆえ触らない)・`gameStore.ts` の APNAP 実装が `priority.ts` の手写しコピーである重複。**既定の対戦相手はディスク上 2 spelling を持つ**(`players` キー `OPPONENT_A` / `defeat` キー `opponent:対戦相手A`)= fork決定4 の帰結であり MP-IDENTITY が返済する documented boundary。

**確定スライス列**(草稿 §6 を改訂): MP-CONTRACT(本節)→ **MP-STATE**(本節の実装・挙動不変)→ MP-ZONES/COMMANDS → MP-IDENTITY → MP-DUMMY → MP-SETUP(初の可視価値)→ MP-BOARD → MP-FOUR-PLAYER-GATE。草稿の「Resume rule leaves only after this gate is green」は**採らない** — MP-ZONES/COMMANDS 緑の時点で cross-player draw(demand=48)が解錠されるため、そこで rule leaf を挟む判断を判定者が留保する(北極星⑤メタレビュー checkpoint)。

**ダミー相手の先取り裁定(MP-DUMMY へ carry・北極星③分解可能性テスト)**: 草稿の `updateScenarioDummy`/`removeScenarioDummy` を**第一級コマンドとして却下**。`createDefinedToken` が既に `createdBy?: PlayerId`/`initialTapped?` を持ち合成 `CardDef` を `state.defs` に登録するため、非トークンダミーは実質「`isToken: false` の createDefinedToken」=既存語彙の合成で表現できる(`docs/judge-protocol.md` §5.1)。→ **エンジンの新規コマンド面は `createScenarioDummy` の1つだけ**。編集/削除は draft 側の操作とし confirm 時に既存プリミティブ列へコンパイルする(編集 = remove + create = CR400.7 上も新オブジェクト)。`CardInstance.isScenarioDummy` マーカーは**承認**(`isToken` では非トークンダミーと実トークンを区別できない・id prefix 推論は禁止・legacy backfill は `false` 既定)。

**実装出荷(2026-07-15 Codex実装 → 2026-07-16 判定者監査)**: 契約どおり実装・全pin緑。判定者作の25 pinは無改変で残存(6弁別アサーションのfixed-string検査で確認)。実際の受け入れファイルパスは `src/store/__tests__/review.mp-state.test.ts`(store層のrestore検証を含むため store 側へ配置)。

**受け入れ(判定者先行 authoring)**: `src/store/__tests__/review.mp-state.test.ts`(レビュー専有・I24〜I28)。加えて既存 reviewer pin 群が**無改変で緑**であること — 特に `review.golden-replay`(イベントストリーム不変の証明)・`review.cr102-players-zones`(`zonesByPlayer` 意味論不変)・`review.sba-defeat`/`review.903-10a`(3 scheme を固定)・`review.properties`(I1〜)。**これらが改変を要したら挙動が変わった証拠=stop-the-line**。機械チェック(`npm run check`)全緑(`npm run build` が真の型検査=bare `tsc --noEmit` は root tsconfig の `files:[]` ゆえ no-op)。`git diff --stat` に `src/components/**` が現れないこと(UI 不変の pin)。実機ブラウザ確認は**不要**(挙動不変・UI なしのスライスゆえ計器を無駄に回さない=北極星③)。

### 34.43 MP-ZONES/COMMANDS Slice A: owner-routed private zones + cross-player core commands (CR 102.1/121/400.1/400.3/701.9/701.24/704.5b-c)

> **J0起草 → 判定者監査済み**(起草 2026-07-15 J0=Codex両担・監査 2026-07-16 復帰判定者): 独立再検証=①判定者による全review diff精読とCR照合 ②実装と別主体の冷Tier-1敵対監査(HIGH 0)③機械チェック(`npm run check`)の独立再実行 ④実機E2E。Tier-1が検出したMEDIUM 1件(`detectTriggerCandidates`がflat墓地のみを読み相手の死亡を計器上見逃す=実プレイ経路は無影響)は判定者が外科修正し、弁別実証済みregression pinを`review.mp-dummy.test.ts`へ追加。

**位置づけ**: §34.42 MP-STATE の後続であり、`cr-player-specific-zones` の実行スライス第2弾。最大需要のcross-player clusterを解錠する最小範囲に限定し、private zone正本の極性反転と、draw/mill/shuffle/discard/life/player counterだけをPlayerId対応する。マナ・キャスト・ターン主体の一般化はSlice Bへdeferする。

**fork決定**:
1. **private zone正本を `zonesByPlayer` へ反転**する。flat `zones.library/hand/graveyard` はP1互換ビューであり、観測境界で `zonesByPlayer[localPlayerId]` から再構築する。legacy snapshotに`zonesByPlayer`が無い場合だけflat配列をP1へlossless backfillする。共有battlefield/stack/exile/commandは従来どおりflat共有配列(CR400.1)。
2. **private destinationはowner routing**。`moveCard`がlibrary/hand/graveyardへ移す場合、command発行者やcontrollerでなく`CardInstance.ownerId`の対応zoneへ入る(CR400.3)。private sourceからの除去もowner zoneを正道とし、移行前のmixed-owner P1配置だけは全player zoneを探索して回収する。
3. `cloneZonesByPlayer`はP1/OPPONENT_A固定再構築をやめ、存在する全PlayerIdをlossless cloneする。roster全員に空private zoneを補完する。
4. `adjustLife` / `adjustPlayerCounter` / `draw` / `mill` / `shuffle` / `discard` に additive `playerId?: PlayerId` を加える。省略時は`localPlayerId`で既存挙動互換。未知PlayerIdは`EngineError`でatomic拒否する。
5. cross-player drawは対象playerのlibrary→handを1枚ずつ移動し、`DrawEvent.playerId`と`emptyLibraryDrawAttemptedSinceLastSba[playerId]`を正しく記録する(CR121.1/121.2/121.4)。`drawnThisTurn`は対象PlayerStateへ加算し、P1互換scalarはlocal時だけ同期する。
6. explicit player discardは指定playerのhandにあるcardだけをowner graveyardへ移す(CR701.9a)。playerId省略時は既存サンドボックス互換を維持する。shuffleのorderは指定player libraryの完全順列でなければatomic拒否(CR701.24a)。millは指定player libraryだけを処理し空library draw advisoryを立てない(CR121.5/701系既存境界)。
7. `players`再導出は非local PlayerStateの既存fieldを保存し、lifeだけ`opponentLife`互換ビューと同期する。これによりcross-player `drawnThisTurn`/poison等が観測境界で消失しない。
8. SBA 704.5b/cは全playerを走査し、empty-library draw attemptとpoison 10以上を該当playerのadvisoryへ記録する。既定P1の既存event/ref spellingは不変。

**新不変条件**:
- **I29 private-zone保存則**: 各private-zone card idは全player private zonesを通じてちょうど1回だけ現れ、card.ownerIdと格納playerIdが一致する。P1 flat mirrorは`zonesByPlayer[localPlayerId]`と順序込みdeep-equal。
- **I30 cross-player isolation**: player-aware draw/mill/shuffle/discard/life/counterは指定playerだけを変更し、他playerの対応state/zone順序を不変に保つ。
- **I31 event subject integrity**: cross-player draw/life eventの`playerId`はcommand subjectと一致し、zone-change snapshotのowner/controllerを改変しない。
- **I32 N-player retention**: 3人目・4人目のPlayerState/private zonesは任意command、SBA、snapshot restore後も欠落しない。

**スコープ境界**: mana command/autotap/manaTransaction・cast/playLand/turn progressionのactor一般化、search/arrangeTop/mulligan/putOnBottomのcross-player UI、compilerの`you/opponent/each-player` subject binding、`DefeatPlayerRef` storage再キー、commander damage matrix、manual target whitelist、UIは本Slice外。`PlayerState`全fieldの正本極性反転はこれらreader移行と同時にSlice Bで行う。

**受け入れ**: `src/store/__tests__/review.mp-zones-commands.test.ts`がI29〜I32をpinする。§34.17の旧HIGH-2「mixed ownerをP1へ誤mirror」は本節で意図的に反転するため、既存`review.cr102-players-zones.test.ts`の該当1件だけをJ0でCR400.3期待へ更新する。他の既存review assertionは変更禁止。機械チェック(`npm run check`)全緑、`SNAPSHOT_VERSION`/`CACHE_SCHEMA_VERSION`不変、UI差分なし。

### 34.44 MP-IDENTITY / MP-DUMMY / MP-SETUP基盤(J0未監査・CR 102.1/110.2/111.1/400.1/400.3/400.7/704.5d)

> **J0起草 → 判定者監査済み**(起草 2026-07-15・監査 2026-07-16): §34.43 と同一の4層独立再検証で合格。dummy 設計は判定者の事前裁定(§34.42「ダミー相手の先取り裁定」=新コマンドは `createScenarioDummy` 単独・編集は退避+再作成)と一致することを確認。setup 適用の単一undo原子性は実機E2Eでも実証(draft編集中 canonical 不変 → apply → undo 1回で life+dummy 同時復元 → redo 再現)。

**identity境界**: manual player target、damage/lifelink/combat life、target filterの`you/opponent`は固定`P1|OPPONENT_A`でなく、現在の`state.players/turnOrder`と能力sourceのcontrollerから解決する。既存`opponentLife`/`DefeatPlayerRef`のdisk spelling再キーはgolden replay互換を壊すため、画面価値に不要な本段階では互換写像を維持する。

**dummy形**: `CardInstance.isScenarioDummy`を型付き識別子とし、`createScenarioDummy`だけを新規creation primitiveとする。command payloadには決定済み`cardId/defId/playerId`、表示名、型組合せ、P/T、tap、counter、manual keyword、token指定を含める。合成`CardDef`はScryfall/oracle/imageを持たず、作成後は通常のCardInstanceとして共有battlefield、対象、戦闘、SBA、領域移動を通る。非tokenがprivate zoneへ移る場合はowner routing、tokenは領域移動後にCR704.5d経路で消滅する。

**setup draft/差分**: `OpponentSetupDraft`はcanonical stateからdeep copyで作り、編集中にGameStateを書かない。確定時は`compileOpponentSetupCommands`がlife/poison差分とdummyだけのcreate/update/retire/reorder列を決定的に生成する。definition変更はCR400.7上の新objectとして旧objectを戦場外へ退避後createする。通常カード、およびP1 ownerで相手controllerのカードは変更禁止。storeは全commandを先に適用して`commit`を一度だけ呼び、undo一回で確定前へ戻す。

**I33**: dummy markerはid prefixに依存せず、対象・SBA・zone eventで保持される。**I34**: setup draftの編集/cancelはcanonical不変、applyは単一undo。**I35**: reconciliationは対象playerのbattlefield上scenario dummyだけを変更する。**I36**: synthetic defはoracle/image非保持で、token/non-token意味論を混同しない。

**受け入れ**: `review.mp-dummy.test.ts`と後続UI reviewでI33〜I36、再編集、通常カード保護、対象、owner墓地、token消滅をpinする。

### 34.45 MP-COMMANDS Slice B / MP-BOARD / MP-FOUR-PLAYER-GATE(J0未監査・CR 101.4/102.1/103.1/110.2/121.2c/800.1)

> **J0起草 → 判定者監査済み**(起草 2026-07-15・監査 2026-07-16): §34.43 と同一の4層独立再検証で合格。旧review pinの置換3箇所(`cr121DrawCompiler`/`cr121DrawCrossPlayerGuard`/`review.cr701-mill-scry-surveil` の each-player/each-opponent manual→auto)は、判定者が `applyPlayerEffect`/`orderedRecipients` のAPNAP・per-player zone routing・event subject を実装トレース+Tier-1実行検証の両輪でCR-honestと裁定して承認。target player・optional・mixed-recipient の manual guard は不変であることを確認済み。UI(セットアップ画面・相手盤面)は実機3操作系(desktop/mobile・追加/編集/反映/cancel/undo)でconsole error 0件。既知のUX負債=モバイルで相手ストリップが空レーン込みで縦幅過大(§D トラック向け追跡・機能は阻害しない)。

**player-aware command**: manaのadd/adjust/pay/clear、playLand、cast、arrangeTop、putOnBottom、mulliganへadditiveな`playerId?: PlayerId`を持たせ、省略時は既存local挙動を維持する。mana source、cast card、Treasure、generated tokenはcontrollerをactorとする。`autotap`はactorのmana poolとactor controllerのmana sourceだけを候補にする。literal/guided mana、token生成、guided search/scryは`CompileContext.controllerId`をcommandへ伝搬する。local scalarは互換write surfaceのまま、非localの同fieldは`PlayerState`へ書き、観測境界でlosslessに保持する。

**recipient集合/APNAP**: `applyPlayerEffect`は`controllerId`、`you|eachOpponent|eachPlayer`、draw/mill/life/counter効果を一つのatomic commandで表す。受け手順は`activePlayerId`を先頭に`turnOrder`を回転したAPNAP順とし、`eachOpponent`は能力controller以外の全参加者である。これにより旧manual境界だった固定数の`Each player/opponent draws/mills/gains/loses/gets counters`を部分実行せず一括処理できる(CR101.4/121.2c)。target playerやoptional/conditional/mixed-recipient文は引き続きmanualであり、対応部分だけを実行してはならない。

**turn progression fork**: 現行UIは一人回しを継続するため、引数なし`nextTurn`のactive playerを変えない。エンジンの`nextTurn { advanceTurnOrder:true }`だけが`turnOrder`の次のplayerへ決定的に進め、次active playerのper-turn counterをresetし、そのcontrollerのpermanentだけをuntapし、そのplayerのdraw stepを処理する。これは将来の完成版多人数ターンUIへ接続する明示経路であり、対戦相手セットアップ初期版は自動で相手ターンへ遷移しない。

**独立setup UI**: GameScreen内メニューから独立全画面へ遷移し、canonical stateから作ったdraftだけを編集する。対象は全nonlocal playerのlife/poisonとscenario dummy。追加・複製・編集・削除・並べ替えを提供し、cancelは無変更、apply成功時だけGameScreenへ戻る。invalid draftは画面内alertを出して留まる。シナリオ保存、実カード検索、相手deck、AIは初期scope外。

**controller別board/combat**: 共有battlefieldをcontrollerごとに投影し、local Board/LandRowはlocal controllerだけ、OpponentBoardsは各nonlocal controllerをcreature/other/land laneへ表示する。相手カードは編集UIを持たず、通常のcard確認・target・blocker選択経路を使う。`setController`後も同じobject idのまま表示laneだけが移る。初期combat UIはdefending playerのcreatureをblocker候補として既存`declareBlockers`へ渡す。

**不変条件**: **I37 actor isolation**=player-aware mana/cast/turn counterはactor以外の対応stateを変えない。**I38 recipient completeness**=`eachOpponent/eachPlayer`はAPNAP順で集合の全員を一度だけ処理し、event subjectも一致する。**I39 turn isolation**=明示turnOrder前進時、outgoing pool clearとincoming untap/drawが別playerへ漏れない。**I40 UI reconciliation**=apply失敗時はsetup画面とcanonical stateを維持し、成功時だけ単一undoとして反映する。

**受け入れ**: `review.mp-four-player.test.ts`、`review.mp-dummy.test.ts`、`OpponentSetupScreen.review.test.tsx`で2〜4人APNAP、recipient、mana/token actor、明示turn前進、draft/cancel/apply/error/undo、controller別board、blocker接続をpinする。旧`cr121DrawCompiler`/`cr121DrawCrossPlayerGuard`/`review.cr701-mill-scry-surveil`のcross-player manual期待は本節に限りJ0でplayer-aware期待へ置換し、target/optional/mixed recipientのmanual guardは維持する。

### 34.46 ACT-2 起動ラインの選択と強行(UI到達性・CR 602.1/602.2b/601.2c/601.2h/118.3/712.8d/712.8f)— この節も契約である

**位置づけ**: ACT バッチ第2弾(プラン=`activate-cost-starry-fern`・ユーザー承認 2026-07-17)。ACT-1(§34.11 項7)が「メタデータ・ショートカットが oracle のコスト意味論を迂回する」正確性バグを塞いだのに続き、**出荷済みのコスト精算機械(コーパス実測で起動型 5,103 行のうち auto 76.1%)を UI から到達させる**到達性スライス。新しいルール表現力は足さない。実装前カバレッジ検証(実測)= 同一面に起動型行が2本以上あるカードは **MyDeck 48枚 / コーパス 946枚(5.41%)**。

**契約1: 単一 recognizer `activatedAbilityLines`(`src/engine/grammar/index.ts`)**: `splitAbilityLines` の結果から `shape === 'activated'` の行だけを `{ index, faceIndex, text, costText, effectText }` で列挙する。
- **`index` は `splitAbilityLines` の flat index 空間そのもの**(=`abilityLineIndexForKind` の戻り値・`activateAbility` の `abilityLineIndex` と同じ空間)。**filter 後の連番を振り直してはならない**(a902a9f と同型の compile/UI desync を生む)。
- `costText` = 最初の `:` より前、`effectText` = より後(**CR 602.1**「[Cost]: [Effect]」= コストはコロン左の文字列そのもの)。コロンなし行は `costText` に全文・`effectText` 空(防御的)。
- 第2引数 `faceIndex` でその面の行だけに絞る。**engine・UI の双方がこの1本を共有する**(面フィルタごと共有=下記契約3の要石)。

**契約2: actionCatalog の行列挙(`src/components/game/actionCatalog.ts`)**: 戦場のカードについて `activatedAbilityLines(def, card.faceIndex)` が **2本以上**なら、総称 `ability-activate` の**代わりに**行ごとの spec を出す。`id`/`testId` = `ability-activate-<flat index>`、`label` = `${costText}: ${効果プレビュー(60字で切る)}`(=ユーザーが**コストで行を弁別**できること)。**1本以下なら従来どおり総称 `ability-activate` を維持**(golden 集合の非回帰=`review.d1-action-catalog.test.ts`)。`buildCardActionCatalog` の純粋性は不変。`gameController` は `ability-activate-<index>` を `activateAbility(cardId, index)` へ配線し、**parse 失敗時は総称へ fail-closed**(NaN を store へ渡さない)。

**契約3(要石): face-aware な単一 recognizer 共有(`abilityLineIndexForKind`・CR 712.8d/712.8f)**: `abilityLineIndexForKind`(`src/engine/triggers.ts`)の `kind === 'activated'` 分岐は **`activatedAbilityLines(def, card.faceIndex)` を共有**して解決する(1本なら its flat index・0本/2本以上は従来どおり `undefined`)。
- **CR 根拠**: **CR 712.8d**(「While a double-faced permanent has its front face up, it has only the characteristics of its front face.」)/ **CR 712.8f**(MDFC も表を向いている面の特性のみ)= **裏面の起動型能力は存在しない**。存在しない能力を数えて「2本=曖昧」と判定するのは CR 違反であり、面フィルタは便宜でなく **CR 要求**。
- **独立 Tier-1 がこの HIGH desync をコーパス実測+runtime repro で検出**(初版は UI だけが面フィルタし、store 側 resolver は全面を数えて `undefined`→manual 落ち=**UI 上はボタン1個で曖昧性ゼロなのに store だけが manual へ落ちる**)。実カード **43枚**が該当(**Zendikar Rising Pathway 両面土地 全10種**・狼男 transform 各種・Grizzled Angler 等)。判定者が独立ピンで red を再現の上、**Option 1 根治**(面フィルタごと単一 recognizer 共有)で差し戻し・解消。**原因は判定者の初版契約**(「`abilityLineIndexForKind` は不変」と指定した)であり実装者の逸脱ではない。
- **`kind === 'triggered'`/`'delayed-triggered'` は本スライスの対象外**(既存の全面カウントを厳密に維持)。誘発型の面フィルタ(CR 712.8d は誘発にも及ぶ)は**既知 gap = 別スライス**。

**契約4: 支払えないコストの強行(`pendingForceActivation`・サンドボックス哲学)**: 支払えない起動コストは**禁止せず確認する**。store state に `pendingForceActivation { sourceId, abilityLineIndex?, warnings } | null` を持ち、**強行可能なブロック点でのみ**(既存の warnings push は残したまま)セットする: (a) 一般経路の `activationCostWarnings`(**CR 118.3** 資源不足=部分払い不可) (b) マナ経路の既タップ源への `{T}`(§34.11 項7 と同一のアトミック性) (c) マナ経路のライフコスト不足。**`decision === 'manual'` のブロック点はセットしない**(強行しても解決しない手動助言のため=袋小路を作らない)。`confirmForceActivation()` は `activateAbility(..., { force: true })` を再呼び出し、`cancelForceActivation()` は**盤面を変えず**解除する。**成功経路(guided 遷移・commit)では必ず `null` へ戻す**(誤ダイアログを出さない)。`commit()`/`newGame`/`restoreGame`/`beginFirstTurn`/`undo`/`redo` でリセットする。`pendingForceActivation` は**ストア状態であり `GameState` ではない**ため snapshot 前方互換に影響しない。
- **対象選択は強行でも省略しない**(**CR 601.2c**(対象)が **CR 601.2h**(支払)に先行し、**CR 602.2b** により起動型能力も 601.2b–i に従う)。`forced` は支払えない**コスト**を迂回するのであって対象選択を迂回しない。ゆえに `activateAbility` 単独では盤面は動かず、対象確定で初めてコストが払われる。forced 経路は CR-legal でない旨を**即時**記録する(対象を要する能力は commit が picker まで遅延するため)。UI は `ShortfallDialog` idiom(`Modal` + `btn`/`btn--danger` + `dialog__actions` + `data-testid`)を踏襲した `ForceActivationDialog`(testId=`force-activation-dialog`/`-cancel`/`-force`)。生カラー禁止(`review.css-token-guard` が機械強制)。

**スコープ境界(本スライスでやらないこと)**: ACT-1 carry(needs-choice 色選択ダイアログの `naiveTapManaColors` 統一・§34.11 項7 の「既知 carry」)は **ACT-2 では扱わず ACT バッチの後続へ繰り越す**(本節がその carry 先の訂正=§34.11 項7 の「ACT-2 へ」は本節により後続スライスへ読み替える)。起動型キーワードの正規形展開(Equip/Crew 等)= ACT-3。コスト語彙 leaf(tap-other・カウンター除去・`{X}`)= ACT-4。忠誠度能力(CR 606)= §34.19 の明示 defer を維持。誘発型の面フィルタ= 上記のとおり別スライス。`Playmat.tsx` のレガシー `buildMenuItems`(import 元が自身のテストのみ=**死コード**・実経路は `gameController`)は触らない=別途 cleanup。

**受け入れ(判定者先行 authoring=実装を見る前に契約の形から書いた)**: `src/store/__tests__/review.act2-activation-lines.test.ts`(レビュー専有・**17 pin**)= 列挙の flat index/コロン分割/非起動型の除外/面フィルタ・行ごと spec とコストラベル・2本以上での総称抑止・1本/0本の総称維持(golden 非回帰)・純粋性・**行 index 指定で正しい行が起動**(`{T}` 行=タップして戦場に残る / 生け贄行=墓地へ)・**CR601.2c→601.2h の順序**(対象確定前は盤面不変)・**Pathway 型 MDFC の表面/裏面解決**(manual 落ちしない)・強行(盤面不変でブロック→pending 提示→confirm で CR-legal 記録+picker 到達→cancel は盤面不変→支払える起動では pending を作らない)。**独立 Tier-1 のコーパス実測(17,491枚)= 過剰列挙 0・誤ラベル 0・index 空間ズレ 0・面フィルタ漏れ 0**。機械4点全緑(1920 tests)。
### 34.47 cr-121 可変数 loot: 「discard up to N / any number, then draw that many」の guided 誠実実行(CR121.1/121.2・CR701.9・CR608.2h)— この節も契約である

**位置づけ**: plannedSequence idx 11(judge=在席 Opus 判定者席・実装=Sonnet サブエージェント・独立 Tier-1=冷 Sonnet)。破棄された candidate-1(固定N loot)の後継=**実 demand の実体である up-to/any-number 型**を guided 化する。UI 無改修(既存 discard prompt を再利用)・engine+store の3ファイルのみ。

**契約**: `ir.effects` がちょうど2節 `[effect.discard, effect.draw]`・両節 `optional===false`・discard 節が自己 loot(下記除外語なし)・discard count が `up to N`/`any number of`・draw count が `that many [plus/minus K]` の形を、ability レベル recognizer `guidedVariableLootPrompt(ir)`(`compile.ts`・既存 `guidedDestroyThenLoseLifeManaValuePrompt` と同型の per-clause compile 前短絡)が検出し、**単一の可変 discard guided prompt** を emit する。プレイヤーは 0..N 枚を1枚ずつ捨て、**実際に捨てた枚数だけ draw** する(CR608.2h=可変値は解決時のプレイヤー選択で確定)。

**substrate 追加(最小・additive)**:
- `CountSpec`(§ 型定義)に `{kind:'up-to'; max:number}`(`any number of` は `max:Infinity`)と `{kind:'that-many'; delta:number}` を追加。**ただし現状これらは `countSpec()` によって構築されない**(recognizer は節 raw テキストをローカル正規表現で解析=`countSpec()` グローバル分類を経由しない)。=**回帰中立の要石**: `countSpec()` 関数本体は byte 単位で不変ゆえ、既存 "up to N" を含む無関係カード(Absolving Lammasu「gain 3 life and suspect **up to one** target...」/ Tolsimir「gain 3 life and that creature fights **up to one** target...」)の `fixed:3`→auto `adjustLife` 判定は一切変わらない。新 union member は当面 demand 計器等の将来利用のための型的区別であり、runtime 挙動には無影響(独立 Tier-1 が「新 variant は未構築=inert」を静的に実証)。
- `EffectPrompt` に `variableLoot?: { max:number; drawDelta:number; discarded:number }` を追加。`discarded` は解決中に累積(再提示ごとに +1)。
- **新 GameCommand/GameState なし**(既存 `discard`/`draw` を合成)=北極星③分解可能性 PASS。

**解決フロー(`gameStore.ts`・store 内部型のみ)**: `confirmGuidedDiscard` は variableLoot prompt の時、prompt を消費せず `discarded+1` の複製を `advanceGuidedResolution` の `prependPrompts` で再提示。`reachedMax = Number.isFinite(max) && discardedCount >= max` または手札尽き(`remainingHand <= 0`)で確定=`{type:'draw', count: Math.max(0, discardedCount + drawDelta)}` を注入して次へ。`cancelGuidedPrompt` は variableLoot prompt では「もう捨てない/完了」を意味し、同じ floor 式で draw を注入して確定(非 loot prompt では従来どおり skip)。分岐は `prompt.variableLoot` の有無でのみ発火=既存単発 discard 経路に一切漏れない。

**誠実性(CR608.2h・要石)**: draw 枚数は常に `discarded`(実捨て枚数)由来であり `max`(宣言上限)ではない。宣言上限を機械 draw する fake-auto は禁止。`any number of`(max=Infinity)は手札尽きで確定。負 delta は `Math.max(0, …)` で 0 に floor。

**スコープ境界(fail-closed=manual 維持)**: `VARIABLE_DISCARD_EXCLUSION_RE = /\btarget\b|\beach\b|\bopponents?\b|\btheir\b|\bthat player\b|\bcontroller\b/i` に該当する discard 主語(cross-player=idx 14 の別領域)・`optional`(「you may discard … if you do, draw …」=Fable of the Mirror-Breaker 第II章型。`optional` は ability 全体で一律計算ゆえ両節 optional→不発火)・2節以外/順序違い(Faithless Looting「Draw two, then discard two」=逆順)・discard 節の完全一致アンカー(`^…$`)を満たさない残余語つき(「discard up to two **nonland** cards」等は安全な false-negative)。over-fire 反例は独立 Tier-1 で発見されず。

**CR 根拠**: CR121.1/121.2(draw=ライブラリ上から手札へ)・CR701.9(discard=手札→墓地)・CR608.2h(プレイヤー選択に依存する値は解決時に確定)。

**受け入れ(判定者先行 authoring・要石)**: `review.cr121-loot-variable-count.test.ts`(レビュー専有・5 pin=挙動ベース public store API + zone/library 枚数)= (1)up-to 2 で2枚捨て→draw 2、(2)**誠実性 pin=1枚捨て→cancel→draw 1(上限2を引かない)**、(3)0枚(即 cancel)→draw 0、(4)cross-player「Target player discards…」は self-discard guided を開かない(fail-closed)、(5)plain「Draw two cards.」は無誘導 auto 継続(回帰中立)。実 oracle golden(Tersa Lightshatter=up-to 2 / Celes, Rune Knight=any-number +1 / Fable 第II章=optional 不発火)。機械4点全緑(214 files/1781 tests・独立判定者再検証済)。実装 commit=`0fbceef`・review pin=`4ee804b`。
### 34.48 ACT-3 起動型キーワードの正規形展開(CR 702.6/49/67/84/87/107/122/128/129/151)— この節も契約である

> **資源状態②の暫定起草→同日監査済**(2026-07-18): ユーザーが判定者不在中のCodex両担と台帳本体編集を明示許可。2026-07-18監査済: Fable判定者+冷Sonnet Tier-1で独立再検証(clean)。CR原文とreview pinへの照合済。

**位置づけ**: ACT-2(§34.46)が通常のコロン付き起動型能力を行別に到達可能にした後続。Oracle上は `Keyword [cost]` とだけ書かれ、コロンを含まない起動型キーワードを、CR 702の定義文どおり通常の `[Cost]: [Effect]` 行へ決定的に展開する。新しいGameCommand/GameStateは追加しない。

**単一正規化層**: `canonicalizeActivatedKeyword` を `sanitizeLine` 後・`parsePureKeywordLine` 前に一度だけ適用する。対象は Equip(修飾付き/planeswalker/非マナコストを含む)、Fortify、Level up、Outlast、Unearth、Embalm、Eternalize、Ninjutsu、Commander ninjutsu、Crew、Reconfigure。ReconfigureはCR 702.151aどおりattach/unattachの2行へ展開する。生成行は `shape:'activated'`、`keywordId`、日本語短縮ラベル、表示用cost、定義ゾーン集合を保持し、flat index空間はACT-2と共通にする。

**定義ゾーンとUI到達性**: 通常の起動型行は戦場のみ。キーワード行はCRが規定するゾーンだけをactionCatalogへ出す: battlefield=Equip/Fortify/Level up/Outlast/Crew/Reconfigure、graveyard=Unearth/Embalm/Eternalize、hand=Ninjutsu、hand+command=Commander ninjutsu(CR 702.49d)。キーワードは1行でも `ability-activate-<flat index>` を使い、`<日本語ラベル> (<keyword cost>)` と表示する。これにより、通常能力とUnearthを併記するカードは戦場と墓地で別の行だけを提示する。

**起動契約**: UI idは既存 `activateAbility(sourceId, flatIndex)` へ流し、CR 602.2bの既存コスト精算・対象選択・source snapshot・能力スタック経路を再利用する。墓地/手札/統率領域の発生源を起動しても、能力がスタックに積まれた時点では、効果によるゾーン移動はまだ起こらない。

**誠実な境界**: 本スライスの完了条件は「CR正規形への展開・正しいゾーンでの発見・既存起動経路への接続」であり、複合効果の完全自動解決ではない。Crewの他クリーチャーtap、Ninjutsuの複合コスト、Unearthの遅延誘発+置換効果、Embalm/Eternalizeの例外付きコピー、Reconfigureのdetachなど、既存compiler/GameCommandで全体を表現できない処理はmanual判定を維持する。認識した一部だけを実行してautoを名乗ってはならない。これらのコスト語彙拡張はACT-4以降。

**CR根拠**: 702.6a/c/e、702.49a/d、702.67a、702.84a、702.87a、702.107a、702.122a、702.128a、702.129a、702.151a。

**受け入れ**: `src/engine/__tests__/review.act3-activated-keyword.test.ts`が全canonical形、修飾Equip、Reconfigure二行、metadata/flat index、ゾーン別actionCatalog、通常能力+Unearthの分離、墓地発生源のコスト支払+stack source snapshotをpinする(判定者が2026-07-18に再オーナー化)。

### 34.49 誠実な部分自動化補助: 制限付き固定マナ `assisted` + manual複合カウンター葉(2026-07-19・判定者承認)— この節も契約である

**位置づけ**: typecycling fail-closed(§34.43系)で確立した「安全な決定的部分だけを実行し、残余を明示warningで可視化する(無言半実行の禁止)」パターンの2適用。いずれも新 GameCommand/GameState なし。

**(a) 制限付き固定マナ補助(CR 106.6/118.3/405.6c/605.3b/602.2)**: `activatedManaAbilityPlanForSource` に decision `'assisted'` を追加。**コストと出力 literal マナがともに決定的で、使用制限(construct.mana-restriction)だけが manual 要因**の起動型マナ能力(《奇怪な宝石》`{T}: Add {C}{C}`型)は、コスト精算+マナ加算をスタック非経由・原子的・単一undoで実行し、**Oracle の使用制限文をそのまま日本語warningで即時提示**する(CR 106.6=使用制限はマナのタイプを変えないため literal 加算は正当。プールに provenance/制限強制は追加しない=強制しないサンドボックス哲学、ただし警告は必須)。構造ガード `restrictedLiteralManaAssistText` = mana-restriction 単独 construct+effect.add-mana のみ+commands 全 addMana を要求——選択色・条件付き・可変値・対象付きは従来どおり manual(推測実行の禁止)。低レベル store 経路は opt-in、ゲームプレイUIは常時有効。草稿= `restricted-fixed-mana-assist.draft.md`。

**(b) manual複合カウンターの無条件葉(CR 701.6a-b/608)**: `guidedPlanForStackTop` は manual 判定の複合文に対し `guidedCounterLeafForManualComposite` を試し、**無条件の「counter target spell」葉が認識できる場合だけ** checked stack-spell 対象プロンプトを出して打ち消しを実行、**残余文は warning として明示提示**する(無言実行しない)。「unless」条件付き・置換形は葉と認識しない(manual維持)。戻り値に `warnings: string[]` を additive 追加。

**(c) 統一 Undo(UI層契約)**: 選択途中の一時状態(guided プロンプト・ダイアログ)は `useInteractionHistory`(GameState 外・スナップショット非対象)が保持し、Undo はまず選択を一段戻し、ダイアログ先頭では副作用なく閉じ、その次で盤面 undo へ委譲する。エンジンの「1コマンド=1 undo」契約(§7.8)は不変。ショートカットはフォーカスが input/select/contenteditable のときだけ標準編集へ譲る。

### 34.50 cleanup step + 手札上限 + プレイ信頼性スライス(CR 402.2/514.1–514.3a/207.2c/603.4)— この節も契約である

**位置づけ**(2026-07-19・ユーザー要望⑤②③④⑥由来・状態②実装を判定者復帰監査で再オーナー化): §34.12 item4/6 が「turn 遷移 surrogate」として明示 defer していた standalone cleanup step を実装し、手札上限の捨てと関連プレイ信頼性を配線した。**新規公開契約の単一正本はここ**。既存 damage-marked substrate 契約(§34.12)は不変。

**1. `cleanup` phase(CR 514・§34.12 item4 の予告どおり）**: `Phase`/`PHASE_ORDER` に `'end'` の後ろへ `'cleanup'` を追加。`applyNextPhase`:
- `phase==='end'` → `beginCleanup`(cleanup へ入り `ensureCleanupDiscardChoice`)。捨て不要なら同一 `nextPhase` 内で `completeCleanupStateActions`(514.2 `clearMarkedDamage` + `combatDamagePreventedUntilEndOfTurn=false`)→ `finishTurnAfterCleanup`(turn+1・untap)まで貫通=**7枚以下の通常ターンは追加クリックを発生させない**(surrogate と同一の観測挙動)。
- `phase==='cleanup'` かつ捨て残あり → cleanup に留まり `cleanup-discard` rule choice を保持。`manualCleanupHandled` または捨て完了で state action→次ターンへ。
- `nextTurn`(ターン直接送り)は cleanup choice を drop して warning「手動処理済みとして続行」を出し、常に damage クリア+untap(サンドボックス強行)。

**2. 有効手札上限 `effectiveMaximumHandSize(state, playerId): number | null`(`src/engine/handSize.ts`・CR 402.2)**: `null`=上限なし。優先順位=(a) `PlayerState.maximumHandSizeOverride`(`number | 'none'`。手動補正が最優先。`'none'`→null・数値→`floor,>=0`) > (b) 自コントロール permanent の英語 oracle に `you have no maximum hand size`(《Thought Vessel》型)→null > (c) 既定 `7`。**加減算・条件付き・固定値・タイムスタンプ競合の一般解釈は defer**(後続スライスで同関数へ additive 追加)。北極星③=実カード需要順に拡張。

**3. `cleanup-discard` rule choice(CR 514.1）**: `CleanupDiscardRuleChoice{ kind:'cleanup-discard'; ruleRef:'514.1'; playerId; cardIds; requiredCount }` を `PendingRuleChoice` へ追加。解決 = `RuleChoiceSelection` へ `{ kind:'cleanup-discard'; cardIds; manualHandled? }`。**ちょうど `requiredCount` 枚**を選び墓地へ。通常は選択完了までフェイズ進行を止めるが `manualHandled` で強行可(警告付き)。捨て後にドローで再超過したら再クリーンナップ(CR 514.3/514.3a の追加ループ)。

**4. 誘発信頼性(CR 207.2c/603.4)**:
- **能力語剥がし**: `Delirium —` 等の能力語(CR 207.2c=ルール上の意味なし)を形状分類前に `stripAbilityWordLabel`(`src/engine/grammar/abilityText.ts`)で除去。《逸失への恐怖》の攻撃行(昂揚)が能力語で誤マスクされない。
- **ETB 条件の解決時再評価**: `PendingTrigger.condition?: TriggerCondition` を stack object へ伝播し、解決時に `triggerConditionSatisfied` を再評価(603.4 intervening-if)。満たさなければ効果を実行せず除去(《逸失》昂揚4種の解決時再チェック)。
- **ETB 汎用フォールバック撤廃**: イベントに一致する誘発行が無いとき「唯一の誘発行を流用」する fail-open を廃止し fail-closed。《神秘の聖域》は post-entry snapshot が untapped のときだけ ETB 誘発(該当能力行 × ゾーン移動後スナップショット照合)。
- **攻撃 watcher の scope 照合(CR 603.2・ユーザー裁定 2026-07-19=正しく実装)**: `AttackDeclarationEvent{ type:'attackDeclaration'; combatId; attackingPlayerId; attackers; battlefield }` を eventLog へ記録。自身の攻撃行(`trigger.attack`・first-time-each-turn 込み)は `selfAttackLineMatchesEvent`。「〜が攻撃するたび」型 watcher 行(`attackWatcherLineMatchesEvent`)は**各 attacker を subject の scope へ照合**し、少なくとも1体が適格なら検出=候補表示(このエンジンの誘発は「検出→ユーザーがスタックに乗せるのを確認」方式=検出が半手動アフォーダンス)。scope: 「another/other」= watcher 自身の objectId を除外(自身の攻撃を数えない=誤発火バグの根治)/「you control・your」= attacker の controller が watcher の controller/「opponent(s)」= attacker の controller が対戦相手/無指定 = 全 attacker 適格。**このエンジンは watcher あたり1候補**(attacker 数分の複数誘発は簡略化=defer)。追加戦闘フェイズ自動化は defer(手動+警告)。

**5. 遅延誘発の解決本文分離(CR 603.7・ミシュラのがらくた型)**: `PendingTrigger.resolutionText?` / `CardInstance.abilityResolutionText?` に、元の起動能力全体でなく**遅延部分の本文だけ**(「次のアップキープ開始時にカードを1枚引く」)を予約。即時部分(占術/look)と遅延部分を分割し、遅延誘発が即時部分を飲み込まない。予約→次アップキープ→スタック→解決で**実際に手札が1枚増える**ところまで golden replay(`review.plan-*`)。分割不能な複合文は成功表示せず手動+警告。

**6. 起動時 X 宣言・スタック対象拡張(CR 601.2b/115.1c・悟悟型)**: `ActivateAbilityOptions.xValue?`(601.2b で X を宣言)。`CardInstance.announcedX?` を能力スタックオブジェクトへ保存(表示・undo・コピーで保持)。`copyStackItem(cardId, quantity?)` で対象能力を X 回・決定順にコピー。`setManualTargets` の許可領域を戦場・スタックから hand/graveyard/exile/command へ拡張(`ManualTargetZone = Exclude<ZoneId,'library'>`)。相手の非公開手札・ライブラリは候補外。サンドボックス注記であり適正対象判定は装わない。

**7. 前方互換(I16)**: `maximumHandSizeOverride`/`announcedX`/`abilityResolutionText`/`resolutionText`/`condition` は全て optional。旧 snapshot は override 未設定(=既定7)として `restoreGame` で backfill。`CACHE_SCHEMA_VERSION` は不変(additive optional のみ)。

**受け入れ(判定者専有 review.*）**: `review.cleanup-hand-size`(7/8/複数超過・no-max 自動・override 手動優先・解決中ドロー再クリーンナップ・ダメージ除去・旧 snapshot backfill・undo)/ `review.attack-trigger-failclose`(watcher 非自動・self-attack 昂揚/first-time/解決時再評価)/ `review.plan-card-fixtures-scryfall`(fixture の type_line/oracle が 2026-07-19 Scryfall スナップショットに一致)。実装者テスト=`src/store/__tests__/plan{Cleanup,Gogo,MishrasBauble,TriggerReliability}.test.ts`。

### 34.51 M-STACK-CONTROL: cast-time対象 + 手動完遂可能な解決セッション(2026-07-20・ユーザー直接プレイ摩擦)

**目的**: 自動化可否にかかわらず、スタックへ応答し、対象を宣言し、解決を完了し、undoで戻せる単一の操作物語を提供する。既存§34.28/§34.49の「counter対象を解決時に選ぶ」部分は本節で置換する。手動到達性を新規自動化より優先し、未対応効果を解決済みと表示しない。

**CR根拠**: CR 115.1a/601.2c(対象はキャスト中に選択)、601.2h–i(全選択後にコストを払い、完了後にcast成立)、405.1–4(stack object)、608.1(解決中に応答を挟まない)、608.2b(解決時の対象再確認・全対象不適正なら残余を含め不発)、701.6a–b(counter=stackから除去・コスト返却なし)。実Oracle golden=`Swan Song`: “Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.”

#### 34.51.1 Cast transaction(一時状態・GameState外)

- `PendingCastTransaction { cardId; faceIndex; xValue; forced; payment; prompts; targetSelections; warnings }` をstoreの一時状態として追加する。snapshotへ保存せず、キャンセル/restore/newGameで破棄する。
- `castToStack` の戻り値へ `'needs-choice'` を追加。キャスト時target promptがある場合は支払い・tap・zone移動を一切行わず pending を作る。対象不要なら従来どおり即commit。
- `answerPendingCastTarget(cardId)` は現promptをchecked `TargetSelection`へ変換する。`confirmPendingCast()` は全必須選択が揃った場合だけ、マナ支払い(自動tapを含む)+stack投入+target保存を単一commitする。`cancelPendingCast()` は盤面無変更でpendingだけ破棄する。
- `GameCommand.castToStack` に `targetSelections?: TargetSelection[]` をadditive追加する。`applyCastToStack` はzone change後のstack objectへ配列を複製して保存する。入力state/commandは不変、再生は決定的。
- cast-time promptは既存の厳密5 counter patternと`guidedCounterLeafForManualComposite`の安全な無条件counter葉に適用する。解決時plannerは保存済みchecked対象を再質問しない。条件付き`unless`・置換counter・認識不能構文はmanualのまま。

#### 34.51.2 解決セッションとsoft gate(GameState外)

- `ResolutionSession { mode:'top'|'all'; sourceId; baseline; stage:'resolving'|'manual-required'; reason?:'unsupported'|'partial'|'runtime-failure'; tasks; stepPast; stepFuture }` をstore一時状態として追加する。`GameState`/`CACHE_SCHEMA_VERSION`は不変。
- `resolveTop`/`resolveAll` は実行中sessionがある場合no-op。自動解決は既存command列+sourceの`resolveStackTop`を原子的にcommitする。実行例外はbaselineを維持して`runtime-failure` taskを出す。
- 既知manual全体はsourceをstackに残し`unsupported` taskへ移る。安全な部分効果がある複合文は、そのcommandだけsession作業状態へ反映して`partial` taskへ移る。`completeManualResolution()`でsourceを通常の着地先へ移し、保留した誘発を収集して1 history stepとして確定する。
- manual-required中は通常の盤面commandをsession内の`stepPast/stepFuture`へ積む。`undo`/`redo`はsession内履歴を優先し、完了後の通常undoは解決開始前baselineへ一括復元する。`resolveAll`は既存どおり全件を単一global undoとし、soft gate中もgroup anchorを保持する。**M-STACK-TRUST-HOTFIX**: session開始直後から既存Undo/ArrowLeftを有効にする。`stepPast`がある間は手動操作を1段ずつ戻し、空での次のUndoは未完了session自体を中止する。`mode:'top'`は`baseline`、`mode:'all'`は`resolutionGroupAnchor ?? baseline`へ復元し、当該batchがglobal pastに積んだanchorだけを除去して古い履歴を保存する。task・部分自動差分・候補表示をbaselineと一致させ、中止した半解決状態自体はredo entryにしない。session中のRedo到達性は`stepFuture`だけを反映し、古いglobal redoでボタンを見かけ上有効にしない。
- soft gate中は盤面の手動操作を許可するが、次のstack解決、phase/turn移動、response追加を禁止する。解決中に生じたtriggerはsession完了までUIへ昇格させない。
- snapshot保存はsession中だけbaselineを保存対象にする。reloadは半解決状態でなく解決開始前へ戻る。

#### 34.51.3 Counter解決の決定境界

- checked targetはphysical id+object id+期待zone/typeを解決時に再検査する。全対象が不適正ならsourceだけを通常着地先へ移し、counter葉もmanual remainderも実行しない。ログへ「対象不適正で不発」を残す。
- 単純counterは合法targetへ`removeStackItem`を適用後、sourceを解決してsession完了。
- 《白鳥の歌》は合法targetを打ち消した後、Bird token生成を`partial` taskとして残す。task完了まではsourceをstackに保持し、`completeManualResolution()`でgraveyardへ移す。unchecked manual target注記はこの自動判定へ絶対に使用しない。

#### 34.51.4 UI/shortcut契約

- Stack Workspaceは非モーダル。背景は視覚scrimのみ(`pointer-events:none`)で盤面・手札を操作可能にし、選択項目へ`対応を追加`、`上から解決`、`全解決`、`対象を設定・変更`、spell用`手動で打ち消す`／ability用`スタックから取り除く`を直接表示する。自動解決はtopだけ。
- manual taskは中央表示を一度だけ行い、その後は永続する短いtask cardと`手動処理済み`を表示する。`unsupported`/`partial`/`runtime-failure`を文言で区別し、同じ内容をtoastへ重複させない。
- 解決演出は要求時でなく状態遷移成功後に発火する。開始focus、auto完了、manual handoffを区別し、音OFFでも視覚表示する。`prefers-reduced-motion`では移動を静的statusへ置換する。
- shortcutはinput/textarea/select/contenteditableだけ標準編集へ譲る。button/link/menuitemはEnter/Spaceのみcontrolへ譲り、割当済みArrow/文字キーとCmd/Ctrl historyはフォーカスが残っていても発火する。dialog中のphase/turn/restart blockは維持。

**スコープ外**: full CR117 priority、全counter構文、相手が行うtoken生成の自動化、manual注記からの合法性推論、quick-cast強制廃止。これらを本マイルストーンのPASSに混ぜない。

## 35. corpus 決定スナップショット回帰床(機械回帰計器)— この節も契約である

**位置づけ(判定者裁定 2026-07-18)**: コンパイラの decision(auto/guided/manual)+生成コマンド指紋をコーパス全行(17,491枚・21,896効果行)でスナップショット化し、新パターン追加が既存 auto/guided の挙動を無言で変える回帰(candidate 汚染)を vitest が機械検出する。**現行検証プロトコル(fail-closed・独立 Tier-1 監査)の*補完*であり代替ではない**——残置ブランチ 69ecc88 が主張した fail-open 高速レーン(冷監査の既定廃止)はユーザー裁定 2026-07-18 で不採用。本計器は監査を置き換えず、Tier-1 の corpus flip 実測を常設ゲート化するもの。

- `scripts/lib/decisionFingerprint.ts`: 指紋計算の単一正本(抽出射影型・canonical JSON + sha256・NDJSON snapshot・diffSnapshots/遷移サマリ a↔g↔m)。
- `research/grammar-compile/corpus-extract.json.gz`(tracked): コーパス全カードの compiler 入力最小射影。生成=`npm run snapshot:extract`(raw corpus があるローカルのみ。生成時に raw との指紋一致を自己検証)。
- `research/grammar-compile/decision-snapshot.json`(tracked): 全効果行の decision+コマンド指紋。更新=`npm run snapshot:update`(遷移サマリを出力)。
- vitest ゲート(`src/engine/grammar/__tests__/decisionSnapshot.test.ts`): extract が存在する環境(=リポジトリ checkout 全部。両ファイル tracked)で常時実行。現行コードとスナップショットの差分=fail。**意図的な decision 変化は `npm run snapshot:update` で再生成し、遷移サマリ(a↔g↔m 件数+実例)を ship diff に同梱して判定者が承認する**。検出力自体は fixture corpus の実パイプラインデモテスト(decision 反転・指紋変化・行増減を fail として検出)で常時証明。

**不変**: 本計器は読み取り専用(GameState/GameCommand に触れない)。review.* 不可侵・機械4点・独立 Tier-1 監査の既定は変わらない。
