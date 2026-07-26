# オーディオビジュアル体験契約 — 思考を支える身体的リズム

**status**: active contract（判定者専有・ユーザー裁定 2026-07-26）  
**implementation status**: approved for AV0–AV4 implementation。現行 D5/D8 実装には本契約と衝突する旧挙動が残る。  
**役割**: 音楽・意味イベント音・イベント視覚・BPM同期についての単一正本。  
**非対象**: カードルール自動化、戦闘ルール実装、ライトモード用楽曲。
**contract cold audit**: 2026-07-26 `qwen3.8-max-preview` cold session `019f9c54-af6d-75c3-9634-94aaf500c38e` — CONTRACT-FROZEN-OK、BLOCKER/HIGH 0。記録=`research/cr-grounding/archive/av-contract-r2-cold-audit-2026-07-26.md`。

関連文書の責務:

- WHY / 北極星② = `docs/design-vision.md` §2
- 色・動き・音の表現仕様 = `docs/design-system.md` §7–§8a
- 実装境界 = `docs/ui-architecture-v2.md` §7
- 合否 = `docs/acceptance.md`「M-AV」
- 旧 D6/D7 = `docs/design-playbook.md`（historical / **実行禁止**）

---

## 0. 後続LLMのコールドスタート

この機能を変更する実装者は、次の順で読む。

1. 本文書を全文読む。
2. `docs/ui-architecture-v2.md` §7 を読む。
3. `docs/acceptance.md`「M-AV」を読む。
4. 触る見た目に限って `docs/design-system.md` §7–§8a を読む。
5. 旧 `docs/design-playbook.md` §5.1/§5.2、旧モックの連鎖場面、現行コードの挙動を仕様根拠にしない。

規範語:

- **MUST**: 満たさなければ不合格。
- **MUST NOT**: 実装禁止。
- **DEFER**: ユーザー未裁定。推測実装せず、現在挙動を維持するか無音・無演出へ落とす。
- **TUNABLE**: 初期値は実装してよいが、ユーザー体感で変更できる一か所の設定値にする。

迷った場合の既定は「鳴らさない・増やさない・GameStateを待たせない」。新しい意味イベント、音、演出強度、依存、音源公開はユーザー裁定なしに追加しない。

次は実装者判断で越えてはならないSTOP:

- `PresentationEvent.kind` の追加
- DEFER項目の実装
- 音・motionの既定値変更
- npm依存・音源ライブラリの追加
- GameState / GameCommand / snapshot schema / store公開APIの意味変更
- 権利確認前の音源を`public/`、commit、Pagesへ入れること

---

## 1. 北極星と非目標

> OneDeck の音楽と光は、ユーザーの行動を採点して高揚を強制するためのものではない。同じ意味の操作に同じ手触りを返し、肩でリズムを取り、カードに触れるような感覚の中で思考を深められる環境をつくる。

通常時は、予測可能で一定のグルーヴを保つ。音楽は報酬ではなく「肩を揺らせる床」であり、意味イベント音はその床へ置く足音である。

唯一の明示的な儀式は**統率者のキャスト**である。統率者はデッキを象徴する特別な一枚なので、専用音と既存の専用視覚エフェクトを持つ。

### MUST NOT

- 操作回数、連鎖回数、ドロー枚数、トークン数、マナ量、スタック解決数から高揚度を推測しない。
- 同じ通常キャストを履歴によって大きく・長く・明るくしない。
- カードの強さ、マナ総量、盤面価値を推測して演出を格付けしない。
- ランダムな大当たり音、レア演出、コンボ表示を追加しない。
- ポインター、タッチ、キー、DnD、メニューの入力イベントを直接鳴らさない。
- 音楽同期のために GameState、undo/redo、対象選択、警告表示を遅らせない。

---

## 2. 意味イベントの決定表

`PresentationEvent` は一時的な view 層イベントであり、GameState の真実ではない。同一の成功済みゲーム操作から音と視覚が一件だけ派生する。

| kind | 成功条件 | 音楽的な音 | イベント視覚 | 裁定 |
|---|---|---|---|---|
| `spell-cast` | 非統率者の呪文が実際にキャストされ、スタックへの zone change が commit 済み | 毎回同じ知覚上の楽器・強さ・長さ | 手札/元領域からスタックへの短い因果表現 | **MUST** |
| `commander-cast` | 統率者が実際にキャストされ、スタックへの zone change が commit 済み | 専用モチーフ。BGM duck を伴ってよい | 既存 CommanderCutIn を基礎にした固有の儀式 | **MUST / 特例** |
| `land-played` | `playLand` が成功し、土地が戦場へ commit 済み | キャストと区別できる安定した短音 | カード周辺だけの安定した着地反応 | **MUST** |
| `turn-advanced` | ターン番号が次へ進む操作が成功 | 小節線に相当する一定の短音 | 現行ターン交代cueを一回 | **MUST** |
| `stack-resolved` | スタック項目の解決 | なし | 結果理解に必要な既存の因果表示だけ。音楽的強調なし | **MUST NOT sound** |
| `phase-advanced` | フェイズ/ステップだけ進む | なし | 現在必要な遷移表示のみ。新規音楽演出なし | **DEFER** |
| `ability-activated` | 起動型能力を起動 | なし | 現行の機能表示のみ | **DEFER** |
| `game-start` | ゲームを開始/キープ | BGM開始以外はなし | 現行UIを維持 | **DEFER** |
| combat family | 攻撃宣言、ブロック、戦闘ダメージ等 | なし | 新規演出なし。既存の機能表示だけ | **DEFER / 初期対象外** |
| manipulation | hover、focus、preview、scroll、drag開始、並べ替え、対象探索 | なし | 即時UIフィードバックだけ | **MUST NOT musical event** |
| resource/result | draw、tap/untap、マナ支払い、life/counter変更、墓地移動、token生成 | なし | 状態理解に必要な既存の因果表示だけ | **MUST NOT musical event** |
| failure | cancel、不正操作、支払い不能、manual-required、runtime error | 成功音なし | 既存の警告・失敗表示 | **MUST NOT success event** |
| history | undo、redo、reload、snapshot復元 | なし。過去イベントを再演しない | 既存の履歴表示 | **MUST NOT replay** |

### 2.1 正規化と exactly-once

- `commander-cast` は `spell-cast` を**置換**する。二音・二重エフェクトにしない。
- ターン終了と次ターン開始は `turn-advanced` 一件に正規化する。
- 対象・面・X・支払い・確認が未完の間はキャスト成立ではない。最後の成功 commit 後にだけ発火する。
- forced cast / forced land play も、成功した意味イベントなら通常と同じ反応を返す。強行したことを音で罰しない。
- 入力経路が pointer / touch / keyboard / DnD / action sheet のどれでも結果は同じ一件にする。
- `PresentationEvent.id` はブラウザ内のゲームセッション専用の単調増加IDとする。エンジンの `GameEvent.eventId`、cardId、turn番号、`Date.now()`を一意性や重複排除へ流用しない。
- エンジンの `GameEvent.eventId` は因果の証拠として `sourceEventId` に保持してよいが、undo後の履歴分岐では再利用されうる。新しい成功commitには、同じ `sourceEventId` でも新しい `PresentationEvent.id` を割り当てる。
- ID採番器と配信済み集合はゲーム画面内の子コンポーネントより長く生存させ、React remountでリセットしない。snapshot/save/undo historyには保存しない。
- `undo`、`redo`、reload、snapshot復元、React remountは新しいforward actionではないためイベントを生成しない。初回購読・再購読では現在状態をbaselineとして読み、既存ログを遡って投影しない。
- UIログ文字列の正規表現解析を発火根拠にしない。

---

## 3. 予測可能性と反復

通常イベントは、同じ意味なら毎回**知覚上同じ反応**を返す。

固定するもの:

- 楽器の役割
- 相対音量
- 基本エンベロープ
- 視覚の形・方向
- 持続時間の範囲

許される TUNABLE:

- 耳疲れを避けるための、ごく小さい音量・フィルター・サンプル差
- 曲の groove / break に馴染ませるための微小な mix 差

違う効果音や強度に聞こえるランダム化は不可。連続キャストでも一件ずつ同じ attack を返し、前音の長い tail だけを choke して濁りを抑えてよい。イベントを黙って捨てたり、履歴依存で高揚へ変換したりしない。

### 3.1 効果音の合成方式と音色設計

4種の効果音(`spell-cast` / `land-played` / `turn-advanced` / `commander-cast`)は、
外部音源ファイルを追加せず、**コードで定義したマルチレイヤーパッチを
`OfflineAudioContext` で AudioBuffer へレンダリング**して再生する。全4種は
同一の「物理打撃音(thud)」言語で統一する: sine の pitch-drop(sub) + triangle の
body + ノイズのトランジェント。全パッチ dry(リバーブなし)。空間は BGM だけが持つ。


固定するもの(§3 の「楽器の役割・相対音量・基本エンベロープ」の実体):

- パッチデータ(レイヤー構成・周波数・エンベロープ・リバーブ)は純粋データとして
  `sfxPatches.ts` に固定する。同じ kind は毎回同一バッファを再生する。
- 各 kind の音色意図:
  - `spell-cast`: sine 200→100Hz pitch-drop thud + triangle 400Hz body + highpass noise。dry(空中打撃)
  - `land-played`: sine 120→60Hz pitch-drop thud + triangle 240Hz body + lowpass noise。dry(地面着地)
  - `turn-advanced`: sine 160→80Hz pitch-drop + highpass noise tick。dry(最小の区切り)
  - `commander-cast`: land-played と同一の thud を 122BPM 8分音符間隔(0/246/492ms)で
    3発。3発目は pitch を下げて「着地」。dry。BGM duck(-4dB)を伴う。
許される TUNABLE(1箇所集約):

```ts
const SFX_LEVELS_DB = {
  'spell-cast': -8,
  'land-played': -6,
  'turn-advanced': -10,
  'commander-cast': -3,
} as const; // BGM(-4.5dB固定)相対。耳疲れで調整する唯一の音量値。
```

- レンダリングは 48kHz・2ch。AudioContext 生成直後に非同期で4パッチをレンダリングし
  キャッシュする。完了前のイベントは音をスキップする(GameState は待たない)。
- レンダリング失敗・再生失敗は音をスキップし、ゲームを止めない(§4 手順7)。
- 通常3音は EventBus、`commander-cast` は CommanderBus へ出力する(バス分離は維持)。
- 拍スナップ(`presentationSoundDelayMs`)・同種 choke・「失敗は GameState を待たせない」
  はすべて維持する。

ユーザー音量スライダー(2026-07-26 ユーザー裁定で追加):

- BGM と SFX(効果音全体)の音量スライダーを、各 ON/OFF ボタンの隣に配置する。
- 範囲は 0〜100(%)。既定値: BGM=70、SFX=80。
- スライダー値は `AudioPreferences` に `bgmVolume` / `sfxVolume` として保存する。
- 実効 gain = バス既定値 × (slider / 100)。スライダーは保存設定を書き換えず、
  実効出力だけに影響する(テーマ・route の実効無音は維持)。
- スライダーはライトテーマ中でも操作可能(保存値は維持される)。

osc レイヤーのフィルター:

- `SfxLayer` の `filterType` / `filterFreqStart` / `filterFreqEnd` / `filterQ` は
  noise レイヤーだけでなく **osc レイヤーにも適用できる**。レンダラーは osc の
  出力を指定フィルターへ通してから envelope へ接続する。

---

## 4. 即時応答と拍同期

GameState と操作の因果表示は即時。音楽的な音と余韻だけを短い範囲で transport へ吸着させる。

初期アルゴリズム:

1. 成功 commit と同じフレームで、小さな因果表示を開始する。
2. musical-event層がOFFなら、成功音と同期用の装飾的余韻だけを発火しない。MusicBus、MusicTransport、背景の時計や設定は変更しない。
3. musical-event層がONかつ `MusicTransport` が ready の場合、隣接beat anchorの `beatIndex` 差を含めて各拍を `quantizeStepsPerBeat` 分割し、現在位置から次の細分グリッドまでの距離を求める。
4. ready かつ距離が `snapWindowMs` 以下なら、その境界へ音と同期用の装飾的余韻を schedule する。
5. ready だが距離が上限を超える場合だけ、音と同期用の装飾的余韻を即時発火する。
6. master audio OFF、manifest未準備、media load/decode error、`AudioContext.resume()`失敗など `MusicTransport` が ready でない場合は、成功音も同期用の装飾的余韻も発火しない。手順1の因果表示と、独立アンビエント周期へ落ちる背景fallbackだけを維持する。
7. schedule後に音源エラーが起きても遅れて成功音を鳴らし直さない。GameState はこの判定を await しない。

`MusicTransport` の時計と、MusicBusの可聴gainは別状態とする。MusicBusだけをOFFにしても、musical-eventまたは背景motionがONならmanifest時計を維持してよい。musical-eventだけをOFFにしたことで背景を700ms fallbackへ切り替えてはならない。

TUNABLE 初期値:

```ts
interface AudioVisualTuning {
  quantizeStepsPerBeat: 1 | 2 | 4;  // initial: 4（4分音符1拍を4分割 = 16分音符相当）
  snapWindowMs: number;              // initial: 60
  maxInteractionAudioDelayMs: number; // initial: 80
}
```

- `quantizeStepsPerBeat`、`snapWindowMs`、`maxInteractionAudioDelayMs` は同じ設定オブジェクト一か所で変更可能にする。
- 隣接anchorを `a` / `b`、`beatSpan = b.beatIndex - a.beatIndex`、`stepCount = beatSpan * quantizeStepsPerBeat` とする。anchor間の時間を **`stepCount` 個**へ等分し、`a.atSeconds + k * (b.atSeconds - a.atSeconds) / stepCount` を細分境界とする。anchor間全体を `quantizeStepsPerBeat` 個だけに分けてはならない。
- `beatSpan` は正の整数、`b.atSeconds > a.atSeconds` をmanifest検証で保証する。固定BPMだけから別時計を作らない。
- `snapWindowMs` は一か所で変更可能にし、CSS・複数モジュールへ直書きしない。
- 実測値が `maxInteractionAudioDelayMs` を超えた場合は拍同期より即時性を優先する。
- 数値上合格でもユーザーが遅いと感じたら不合格。0msまで下げて比較できるようにする。

---

## 5. 統率者の固有儀式

`commander-cast` は通常時の一定性に対する、明示的で狭い例外である。

### MUST

- キャストが成功した瞬間に開始する。スタック解決時ではない。
- 現行 `CommanderCutIn` の視覚的アイデンティティを基礎として維持する。
- generic `spell-cast` 音・視覚を抑止する。
- BGMを停止、seek、再開、テンポ変更しない。
- BGMを短時間だけ duck し、専用モチーフへ場所を譲る。
- 二回目以降も同じ儀式。統率者税・キャスト回数で増幅しない。
- 演出完了を待たずにゲーム操作を続けられる。

TUNABLE:

```ts
interface CommanderMixTuning {
  duckDb: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
}
```

初期値:

```ts
const COMMANDER_MIX_TUNING: CommanderMixTuning = {
  duckDb: -4,
  attackMs: 40,
  holdMs: 360,
  releaseMs: 320,
};
```

専用音が聞こえない場合もBGMを大きく下げる前にユーザー試聴を行う。

現行 `pendingCommanderResolution` による「解決を演出完了まで止める」挙動は、本契約の発火時点ではない。AV実装は engine 契約を拡張せず、UI側でキャストイベントと演出を分離する。store APIの削除が必要になった場合は別のspec変更としてSTOPする。

---

## 6. 基準曲と transport

ダークモードのゲーム画面では、ユーザーが選択した
`candidate-b-tight-128-bars.mp3` を基準曲として使う。公開Webアプリへの同梱権は
2026-07-26 にユーザー確認済み。

確定事項:

- 短いフレーズだけを反復せず、**曲全体が流れながら周期的に戻る**。
- 元MP3の単純 `loop=true` は使わない。
- 曲中の groove / break / rejoin を保持する。
- ループ点、beat anchor、gain、実測BPMは下記TrackManifestへ凍結する。
- 実行時FFTで拍を推定しない。
- 長尺BGMはstreamし、二つのmedia elementを使った40msの等電力crossfadeで
  128小節全体の境界だけを接続する。通常再生中に曲を組み替えない。

```ts
interface TrackManifest {
  id: string;
  src: string;
  sha256: string;
  bpmNominal: number;
  loopStartSec: number;
  loopEndSec: number;
  gainDb: number;
  crossfadeMs: number;
  beatAnchors: Array<{ beatIndex: number; atSeconds: number }>;
  sections: Array<{
    kind: 'groove' | 'break' | 'rejoin';
    startSec: number;
    endSec: number;
  }>;
}
```

4〜8小節ごとの疎な `beatAnchors` を補間し、生成曲の微小なテンポ揺れを単一BPMの積算で放置しない。たとえば4/4の4小節離れたanchorは `beatIndex` 差が16であり、`quantizeStepsPerBeat = 4` ならanchor間を64区間へ分割する。

凍結済みTrackManifest:

```ts
const DARK_GAME_TRACK: TrackManifest = {
  id: 'candidate-b-tight-128-bars',
  src: `${import.meta.env.BASE_URL}audio/bgm/candidate-b-tight-128-bars.mp3`,
  sha256: '6307839cab73c84265023ce2a8cdb489355f3f48a3ef9c94d8cdb6b6190dde0c',
  bpmNominal: 122.000736,
  loopStartSec: 0,
  loopEndSec: 251.798458,
  gainDb: -4.5,
  crossfadeMs: 40,
  beatAnchors: [
    { beatIndex: 0, atSeconds: 0 },
    { beatIndex: 32, atSeconds: 15.737404 },
    { beatIndex: 64, atSeconds: 31.474808 },
    { beatIndex: 96, atSeconds: 47.212211 },
    { beatIndex: 128, atSeconds: 62.949615 },
    { beatIndex: 160, atSeconds: 78.687019 },
    { beatIndex: 192, atSeconds: 94.424423 },
    { beatIndex: 224, atSeconds: 110.161826 },
    { beatIndex: 256, atSeconds: 125.89923 },
    { beatIndex: 288, atSeconds: 141.636634 },
    { beatIndex: 320, atSeconds: 157.374038 },
    { beatIndex: 352, atSeconds: 173.111442 },
    { beatIndex: 384, atSeconds: 188.848845 },
    { beatIndex: 416, atSeconds: 204.586249 },
    { beatIndex: 448, atSeconds: 220.323653 },
    { beatIndex: 480, atSeconds: 236.061057 },
    { beatIndex: 512, atSeconds: 251.798458 },
  ],
  sections: [],
};
```

`sections` は未計測値を捏造せず空配列とする。groove / break / rejoinは音源自体の
全曲構造として保持し、アプリの演出強度制御には使わない。

### 再生範囲・設定・autoplay

- Musicとmusical eventは独立したユーザー設定とし、保存値が存在しない新規利用者は
  どちらも既定ON。既存の明示的な音設定はmusical event設定へ移行して上書きしない。
- 可聴出力は **ダークテーマのゲーム画面だけ**。ライトテーマ・ゲーム外画面では
  保存設定を書き換えずMusicとmusical eventを実効無音にする。
- ゲーム画面内の最初の `pointerdown` またはkeyboard操作を明示gestureとして
  `AudioContext.resume()` とBGM開始を試みる。gesture前は再生しない。
- 同一ページセッション内のゲーム画面離脱・テーマ切替では再生位置をmemoryに保持し、
  ダークのゲーム画面へ戻った時に続きから再開する。reloadは新sessionとして先頭へ戻り、
  再び明示gestureを待つ。
- resume/load/decode失敗はゲームエラーにせず、設定メニュー内だけに状態を表示する。
  再試行は次の明示gestureまたは音設定操作で行う。
- MusicBusだけがOFFでもmusical eventまたは背景motionがONなら、無音transport時計を
  維持してよい。master audioまたはmanifestが利用不能な場合だけダーク背景を現行700msへ
  フォールバックする。
- ライトモード用の楽曲は追加しない。

---

## 7. Webブラウザ性能契約

> 演出が性能予算を超えたら、ゲーム操作ではなく演出を減らす。

### MUST

- `AudioContext.currentTime` を音と視覚の共有時計にする。React state、Zustand、`Date.now()`をフレーム時計にしない。
- 長尺BGMはstream、短音だけbufferを第一候補にする。
- runtime FFT、常時波形解析、毎フレームのBPM推定を行わない。
- イベントごとにReactコンポーネントやDOM粒子を追加しない。既存層、疑似要素、固定上限の再利用要素で表現する。
- アニメーションは原則 transform / opacity。常時 `filter`、大blur、`mix-blend-mode`、`feTurbulence`、layout animation、量産 `will-change` を使わない。
- 非表示タブでは視覚更新を止める。復帰時は現在のaudio timeへ再同期し、過去イベントを高速再生しない。
- `prefers-reduced-motion` と音声ON/OFFを独立させる。
- 音・manifest読込失敗でゲーム操作を失敗させない。

### 初期性能ゲート

対象: 375×812、812×375、1440×900。ダーク、BGM ON、意味イベント音 ON、背景motion ONで10分継続する。

| 指標 | 合格条件 |
|---|---|
| GameState反映 | 拍待ちなし |
| 操作→即時因果表示 | p95 100ms以下 |
| 操作→音 | p95 80ms以下 |
| 音と同期余韻のずれ | p95 50ms以下 |
| foreground frame interval | 60fps目標、p95 20ms以下 |
| app起因long task | 通常シナリオで50ms超 0件 |
| audio | click/pop/dropout/clipping/二重発火 0 |
| memory / DOM | 時間経過・イベント回数に比例して増えない |
| console | warning/error 0 |

計測値に加えて、ユーザー実機で発熱・電池消費・操作感を確認する。物理的な最低端末は未裁定なので、ship前のユーザー実機ゲートを省略しない。

---

## 8. 人間の受け入れゲート

機械測定はユーザー体感を代替しない。各段階で次を確認し、違和感があれば TUNABLE を調整する。

| Gate | ユーザーが判定する問い |
|---|---|
| H1 transport | 曲と盤面が同じ時間を持つか。単なる点滅に見えないか |
| H2 cast / land / turn | 自分がゲームを進めた手応えがあるか。音が遅くないか |
| H3 repetition | 同じ反応を予測できるか。10分で耳・目が疲れないか |
| H4 break / loop | 肩で取っていたリズムが途切れないか。継ぎ目が分からないか |
| H5 commander | 特別な一枚だと感じるか。BGM duckが不自然・大げさでないか |
| H6 mobile | 滑らかさ、発熱、電池、盤面可読性に問題がないか |

「盛り上がったか」は通常イベントの合格軸ではない。「思考を中断しない」「予測できる」「無意識にリズムへ乗れる」を優先する。

---

## 9. 現行実装からの移行対象

次は**既存コードにあるが、新規仕様の根拠にしてはならない**。

| 現行 | 本契約での扱い |
|---|---|
| `CelebrationLayer.tsx` の chain heuristic / `chain` 音 | 削除または無効化。履歴依存の高揚は禁止 |
| `gameController.tsx` のPrimaryAction `celebrate('primary')` と解決成功 `celebrate('resolve')` | 直接呼出しを削除。成功したcast / land / turnだけをprojectし、解決は必要な因果視覚だけ残す |
| `ThumbZone.tsx` の全PrimaryAction `celebrate('primary')` | 直接呼出しを削除。入力/ボタンを直接鳴らさない |
| `HandRibbon.tsx` の `celebrate('draw')` | 直接呼出しを削除。drawはmusical event allowlist外 |
| `sound.ts` の `draw` / `resolve` / `chain` 音 | musical event allowlist外。新routerへ移行するまで鳴らさない |
| commander cut-in の解決時gate | キャスト時の非blocking演出へ移す。store契約変更は別STOP |
| `ambientMotion.ts` の戦闘時 525ms | 初期対象外。戦闘でテンポ・色・強度を変えない |
| ダーク固定700ms | TrackManifest transport ready中は置換。master audio OFF / transport失敗時のfallbackとしてのみ暫定維持 |

この表は実装を完了したという主張ではない。AV3完了時は production code に `celebrate('primary')` / `celebrate('draw')` / `celebrate('resolve')` / `celebrate('chain')` の直接呼出しを0件にし、構造検査で固定する。次のUIスライスが回収し、`docs/acceptance.md` M-AVで検証する。
