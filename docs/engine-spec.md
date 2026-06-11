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
// - turn=1, phase='main1', life=40, 手札0枚(初手ドローはストアが draw{count:7} を発行)
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
