# オーディオビジュアル体験契約 — 思考を支える身体的リズム

**status**: active contract（判定者専有・ユーザー裁定 2026-07-26）  
**implementation status**: AV0–AV6 shipped。AV7 production integrationは2026-08-01ユーザー承認済み。

**revision 2026-08-08(ユーザー裁定・ゲーム開始音の同期)**: §2/§2.1/§3.1を改訂。`ゲーム開始`クリック自体を初回の明示gestureとして扱い、`newGame`による初期7枚配牌より前にAudioContext/BGM/SFXの開始を試みる。初回配牌は新しいイベント種別を追加せず、既存の`draw-completed`を一操作一件だけ発火する。音設定OFF・音声ロード失敗では無音へ縮退し、GameStateは音声準備を待たない。
**revision 2026-08-08(ユーザー裁定・ライトテーマ音響配線; feel-10でBGM境界を更新)**: ライトテーマのゲーム画面でも既存の意味イベントSEを有効化する。初期状態ではライト用BGMを未選択の任意Trackとして`null`で保持し、選択前はBGMを鳴らさずSEを即時再生した。ダーク曲をライトの代替BGM・代替拍時計に使わない境界、背景motionとAV5/AV6のライト無演出ゲートは維持する。
**revision 2026-08-08(ユーザー裁定・ライトBGM選定)**: ユーザー選定の`sound/ライトテーマ.mp3`を原本非変更のまま`public/audio/bgm/light-theme.mp3`へ同梱し、ライトの有効Trackとして採用する。ライトでもBGM、既存SE、Track固有の拍同期、commander duckを有効化する。権利はユーザー選定・公開指示として記録し、外部ライセンスは推測しない。ダークTrack、SE素材、視覚演出、reduced-motionは変更しない。
**revision 2026-08-08(ユーザー裁定・ライトテーマ視覚演出 parity; feel-11)**: 既存AV5/AV6のパーマネントビート、カード/土地/統率者の振付、統率者idle、ダンスフロア照明をライトテーマでも有効化する。ライトの墨スキン・トークン、既存の拍時計、背景モーション設定、reduced-motion、音響は維持する。feel-9/10で記録したライト視覚無演出境界は本revisionでsupersedeする。

**役割**: 音楽・意味イベント音・イベント視覚・BPM同期についての単一正本。  
**非対象**: カードルール自動化、戦闘ルール実装、追加の楽曲選定・生成。
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

迷った場合の既定は「鳴らさない・増やさない・GameStateを待たせない」。本契約に列挙したAV7イベント以外の新しい意味イベント、音、演出強度、依存、音源公開はユーザー裁定なしに追加しない。

次は実装者判断で越えてはならないSTOP:

- §2に列挙していない `PresentationEvent.kind` の追加
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
| `turn-advanced` | ターン番号が次へ進む成功commit(明示の「次のターン」・フェイズ進行によるcleanup越え・解決一掃後の自動進行、経路を問わない) | 小節線に相当する一定の短音 | 現行ターン交代cueを一回 | **MUST** |
| `draw-completed` | UIから開始したdraw操作、またはターン進行によるdraw-stepの自動ドローで実際に1枚以上が手札へcommit済み | 紙を滑らせる一定の短音。枚数で増幅しない | 既存のカード到着表示だけ | **MUST** |
| `tap-changed` | UIから開始したtap/untap操作で1枚以上の状態が実際に変化 | tapとuntapを区別する一定の卓上短音 | 既存のカード回転だけ | **MUST** |
| `stack-resolved` | UIから開始したresolve top/allで1件以上がstackから解決完了 | 短いcard-shove。一操作一音 | 結果理解に必要な既存の因果表示だけ | **MUST** |
| `shuffle-completed` | UIから開始したlibrary shuffle、またはマリガン確定(手札引き直し)がcommit済み | 0.9秒以内の一定のshuffle音 | 新規イベント視覚なし | **MUST** |
| `phase-advanced` | ターン番号を変えずにフェイズ/ステップだけ進む成功commit | turn-chipより明確に小さい一定のtick。リズムの拍ではなく区切りだけ示す | 現在必要な遷移表示のみ。新規視覚演出なし | **MUST**(2026-08-07 ユーザー裁定でDEFERから昇格) |
| `hand-kept` | キープ確定(初手決定)がcommit済み | 一定の小さい確定音。枚数・マリガン回数で増幅しない | 現行UIを維持 | **MUST**(2026-08-07 ユーザー裁定で追加) |
| `ability-activated` | 起動型能力を起動 | なし | 現行の機能表示のみ | **DEFER** |
| `game-start` | ゲーム開始クリックと初回7枚の配牌 | 同じクリックでBGM開始を試み、初回配牌は既存`draw-completed`を一操作一件。音設定・テーマに従い無音へ縮退 | 現行UIを維持 | **MUST**(2026-08-08 ユーザー裁定) |
| combat family | 攻撃宣言、ブロック、戦闘ダメージ等 | なし | 新規演出なし。既存の機能表示だけ | **DEFER / 初期対象外** |
| manipulation | hover、focus、preview、scroll、drag開始、並べ替え、対象探索 | なし | 即時UIフィードバックだけ | **MUST NOT musical event** |
| resource/result | 自動マナ支払い、効果内draw/shuffle、life/counter変更、墓地移動、token生成 | それ自身の追加音なし | 状態理解に必要な既存の因果表示だけ | **MUST NOT separate musical event** |
| failure | cancel、不正操作、支払い不能、manual-required、runtime error | 成功音なし | 既存の警告・失敗表示 | **MUST NOT success event** |
| history | undo、redo、reload、snapshot復元 | なし。過去イベントを再演しない | 既存の履歴表示 | **MUST NOT replay** |

### 2.1 正規化と exactly-once

- `commander-cast` は `spell-cast` を**置換**する。二音・二重エフェクトにしない。
- ターン終了と次ターン開始は `turn-advanced` 一件に正規化する。
- フェイズ進行がターン増加を伴う場合(「次のフェイズ」によるcleanup越え等)は `phase-advanced` を発火せず、`turn-advanced` 一件のみとする。経路(明示の「次のターン」・cleanup越え・解決一掃後の自動進行)を問わず、ターン番号が増加した成功commit一件につき `turn-advanced` は一件だけ。
- draw-stepの自動ドローは `draw-completed` 一件を発火する(2026-08-07 ユーザー裁定。「通常のturn進行に内包されたdrawは無音」の例外)。同一のターン進行で `turn-advanced` と両方鳴ってよいが、それ以上の音を重ねない。
- マリガン確定は `shuffle-completed` へ、キープ確定は `hand-kept` へ正規化する。同一の初手決定操作から両方は発火しない。
- 複数枚draw、bulk tap/untap、resolve-allは、枚数やstack件数にかかわらずユーザーの一操作を一件へ集約する。
- 自動マナ支払い、cast/resolve内のdraw・shuffle・tap、通常のturn進行に内包されたuntapは別の音を重ねない。明示操作の主意味だけを鳴らす。
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

### 3.1 効果音のsample manifestと音色設計

AV7-P / AV7-P2の比較試聴で承認された`hybrid`パレットを本番の唯一のmixとする。本番UIへpalette selectorを追加しない。各layerは次の固定データで宣言し、同じ意味には毎回同じsampleとmixを返す。

```ts
interface SfxSampleLayer {
  src: string;
  gainDb: number;
  offsetMs: number;
  chokeGroup: string;
}
```

| cue | 固定layer (`gainDb`) |
|---|---|
| `draw-completed` | `draw-slide -2.38` + `draw-fan -9.90` |
| `land-played` | `land-place -1.41` + `low-thud -7.54` |
| `spell-cast` | `spell-place -2.85` + `spell-arcane-snap -10.46` |
| `tap-changed` tapped | `tap-shove -2.50` |
| `tap-changed` untapped | `untap-slide -2.85` |
| `stack-resolved` | `resolve-shove -3.88` |
| `shuffle-completed` | `shuffle -1.94` |
| `turn-advanced` | `turn-chip -1.94` + `low-thud -9.12` |
| `phase-advanced` | `phase-tick -8.20` |
| `hand-kept` | `keep-confirm -6.00` |
| `commander-cast` | `commander-contact -7.13` + `low-thud -6.02` + `commander-portal-open -6.74` |

- 全layerの初期`offsetMs`は0。同cueのlayerは同じ`chokeGroup`へ属し、再発火では前cueのtail全体だけを止めて新しいattackを開始する。
- `spell-arcane-snap`と`commander-portal-open`と`low-thud`と`phase-tick`と`keep-confirm`は固定seedまたは固定式のproject-original。ほかの採用sampleはKenney Casino AudioのCC0素材を加工したもの。`phase-tick`はdry・1秒以内・turn-chipより明確に小さい。`keep-confirm`はdry・1秒以内。
- `public/audio/sfx/`へ置くのは採用済み48kHz・2ch・PCM16 WAVと権利根拠だけ。通常音は1秒以内、commander音は1.6秒以内、true peakは-3dBFS以下、端に2ms fadeを持つ。
- comparison-onlyの音声素材、Cockatrice、`sound/spells/`、zip/7z、`sound/`全体は公開しない。ユーザー選定済み音源だけを明示的なproduction assetへ複製し、ユーザーの`sound/`原本は変更しない。
- AudioContext生成後にsampleを非同期fetch/decodeしてcacheする。完了前のevent、load/decode/play失敗は無音へ縮退し、GameStateを待たせない。
- 通常9音(`phase-advanced`・`hand-kept`を含む)はEventBus、`commander-cast`はCommanderBusへ出力する。通常音でBGMをduckしない。
- 拍スナップ(`presentationSoundDelayMs`)と「失敗はGameStateを待たせない」を維持する。`OfflineAudioContext`による旧patch生成は撤去する。

ユーザー音量スライダー(2026-07-26 ユーザー裁定で追加):

- BGM と SFX(効果音全体)の音量スライダーを、各 ON/OFF ボタンの隣に配置する。
- 範囲は 0〜100(%)。既定値: BGM=70、SFX=80。
- スライダー値は `AudioPreferences` に `bgmVolume` / `sfxVolume` として保存する。
- 実効 gain = バス既定値 × (slider / 100)。スライダーは保存設定を書き換えず、
  実効出力だけに影響する(テーマ・route・有効Trackの実効可聴境界は維持)。
- スライダーはライトテーマ中でも操作可能(保存値は維持される)。

---

## 4. 即時応答と拍同期

GameState と操作の因果表示は即時。音楽的な音と余韻だけを短い範囲で transport へ吸着させる。

初期アルゴリズム:

1. 成功 commit と同じフレームで、小さな因果表示を開始する。
2. musical-event層がOFFなら、成功音と同期用の装飾的余韻だけを発火しない。MusicBus、MusicTransport、背景の時計や設定は変更しない。
3. musical-event層がONかつ `MusicTransport` が ready の場合、隣接beat anchorの `beatIndex` 差を含めて各拍を `quantizeStepsPerBeat` 分割し、現在位置から次の細分グリッドまでの距離を求める。
4. ready かつ距離が `snapWindowMs` 以下なら、その境界へ音と同期用の装飾的余韻を schedule する。
5. ready だが距離が上限を超える場合だけ、音と同期用の装飾的余韻を即時発火する。
6. 有効なTrackManifestがあるのにmaster audio OFF、manifest未準備、media load/decode error、
   `AudioContext.resume()`失敗などで `MusicTransport` がreadyでない場合は、成功音も
   同期用の装飾的余韻も発火しない。手順1の因果表示と、独立アンビエント周期へ落ちる
   背景fallbackだけを維持する。テーマのTrackが明示的に`null`である場合は失敗ではなく、
   同期を使わない即時SE経路を使用する。
7. schedule後やload retry後の音源エラーで、過去の成功操作の音を遅れて鳴らし直さない。
   GameState はこの判定を await しない。

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
- 視覚cut-inは現行650msを維持し、専用sample全体は1.6秒以内で自然に減衰してよい。

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
- 音源自体が128小節・crossfade 0秒でループ用に調整済みなので、単一media elementのnative `loop=true`を使う。
- 曲中の groove / break / rejoin を保持する。
- ループ点、beat anchor、gain、実測BPMは下記TrackManifestへ凍結する。
- 実行時FFTで拍を推定しない。
- 長尺BGMは単一`HTMLMediaElement`でstreamする。二本再生、crossfade timer、等電力gain計算、手動seekによる境界接続を行わない。

```ts
interface TrackManifest {
  id: string;
  src: string;
  sha256: string;
  bpmNominal: number;
  loopStartSec: number;
  loopEndSec: number;
  gainDb: number;
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

const LIGHT_GAME_TRACK: TrackManifest = {
  id: 'light-theme-organic-techno',
  src: `${import.meta.env.BASE_URL}audio/bgm/light-theme.mp3`,
  sha256: 'd73ab88a9a665dd684376d9e167f66297d909a6a63a6de195dcc455023c15148',
  bpmNominal: 117.829641,
  loopStartSec: 0,
  loopEndSec: 362.879979,
  gainDb: -4.5,
  beatAnchors: [
    { beatIndex: 0, atSeconds: 0 },
    { beatIndex: 32, atSeconds: 16.286338 },
    { beatIndex: 64, atSeconds: 32.572677 },
    { beatIndex: 96, atSeconds: 48.859015 },
    { beatIndex: 128, atSeconds: 65.145354 },
    { beatIndex: 160, atSeconds: 81.431692 },
    { beatIndex: 192, atSeconds: 97.718031 },
    { beatIndex: 224, atSeconds: 114.004369 },
    { beatIndex: 256, atSeconds: 130.290708 },
    { beatIndex: 288, atSeconds: 146.577046 },
    { beatIndex: 320, atSeconds: 162.863385 },
    { beatIndex: 352, atSeconds: 179.149723 },
    { beatIndex: 384, atSeconds: 195.436062 },
    { beatIndex: 416, atSeconds: 211.7224 },
    { beatIndex: 448, atSeconds: 228.008739 },
    { beatIndex: 480, atSeconds: 244.295077 },
    { beatIndex: 512, atSeconds: 260.581415 },
    { beatIndex: 544, atSeconds: 276.867754 },
    { beatIndex: 576, atSeconds: 293.154092 },
    { beatIndex: 608, atSeconds: 309.440431 },
    { beatIndex: 640, atSeconds: 325.726769 },
    { beatIndex: 672, atSeconds: 342.013108 },
    { beatIndex: 704, atSeconds: 358.299446 },
    { beatIndex: 713, atSeconds: 362.879979 },
  ],
  sections: [],
};
```

`sections` は未計測値を捏造せず空配列とする。groove / break / rejoinは音源自体の
全曲構造として保持し、アプリの演出強度制御には使わない。

### 再生範囲・設定・autoplay

- Musicとmusical eventは独立したユーザー設定とし、保存値が存在しない新規利用者は
  どちらも既定ON。既存の明示的な音設定はmusical event設定へ移行して上書きしない。
- 可聴出力の範囲はゲーム画面かつ明示gesture解除済みとする。両テーマで
  musical eventは保存設定に従って可聴化し、Musicはそのテーマに有効なTrackManifestが
  ある場合だけ可聴化する。ゲーム外・gesture前では保存設定を書き換えず両レーンを
  実効無音にする。
- ゲーム画面内の最初の `pointerdown` またはkeyboard操作、または`ゲーム開始`クリックを
  明示gestureとして`AudioContext.resume()`、有効なBGMの開始、SFX preloadを試みる。
  gesture前は再生しない。
- 同一ページセッション内のゲーム画面離脱・テーマ切替では有効Trackごとの再生位置を
  memoryに保持し、Trackがあるテーマへ戻った時に続きから再開する。Trackが`null`の
  将来テーマではMediaElementを生成せず、利用可能なmusical eventだけを即時再生する。
  reloadは新sessionとして先頭へ戻り、再び明示gestureを待つ。
- resume/load/decode失敗はゲームエラーにせず、設定メニュー内だけに状態を表示する。
  再試行は次の明示gestureまたは音設定操作で行う。
- MusicBusだけがOFFでも有効Track上のmusical eventまたは背景motionがONなら、無音
  transport時計を維持してよい。有効Trackが`null`の将来テーマではtransportを起動せず、
  musical eventは即時再生する。master audioまたはmanifestが利用不能な場合だけ、
  対応する背景を既存fallbackへ縮退する。
- ライトテーマの現行Trackはユーザー選定の`LIGHT_GAME_TRACK`。テンポは音源解析値、
  `sections`は未計測のため空配列とし、runtime FFTや毎フレームBPM推定は行わない。

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
| H2 semantic palette | draw / land / spell / tap / untap / resolve / shuffle / turnが、カードに触れた手応えとして自然か。音が遅くないか |
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
| `gameController.tsx` のPrimaryAction `celebrate('primary')` と解決成功 `celebrate('resolve')` | 直接呼出しを削除。成功済み意味操作をAV7 allowlistへprojectする |
| `ThumbZone.tsx` の全PrimaryAction `celebrate('primary')` | 直接呼出しを削除。入力/ボタンを直接鳴らさない |
| `HandRibbon.tsx` の `celebrate('draw')` | 直接音呼出しを削除。成功commitをcontrollerの`draw-completed`経路へ正規化する |
| `sound.ts` の `draw` / `resolve` / `chain` 音 | `chain`は廃止。draw/resolveはAV7 sample routerだけから鳴らす |
| commander cut-in の解決時gate | キャスト時の非blocking演出へ移す。store契約変更は別STOP |
| `ambientMotion.ts` の戦闘時 525ms | 初期対象外。戦闘でテンポ・色・強度を変えない |
| ダーク固定700ms | TrackManifest transport ready中は置換。master audio OFF / transport失敗時のfallbackとしてのみ暫定維持 |

この表は実装を完了したという主張ではない。AV3完了時は production code に `celebrate('primary')` / `celebrate('draw')` / `celebrate('resolve')` / `celebrate('chain')` の直接呼出しを0件にし、構造検査で固定する。次のUIスライスが回収し、`docs/acceptance.md` M-AVで検証する。

---

## 10. パーマネント・アンビエントビート(AV5・2026-07-27 ユーザー裁定)

> 背景層が「ホールの空気」なら、戦場のパーマネントは「その空気の中で息づく身体」である。
> 土地はリズム隊として拍を刻み、統率者はソリストとして4拍で踊る。

本節は **ambient motion の拡張**であり、意味イベントではない。

### 分類と非目標

- `PresentationEvent.kind` の追加は**ない**。音は**ない**。
- §2 の意味イベント決定表・§3 の予測可能性・§4 の拍同期・§7 の性能契約・§8a のゲートを**継承**する。
- §1 の MUST NOT(操作回数・連鎖・カード強度からの高揚推測)はそのまま適用される。
- 戦闘でテンポ・色・強度を変えない(§9 の `ambientMotion.ts` 戦闘時 525ms は初期対象外)。

### ゲート

- 既存の「背景モーション」トグル(`:root[data-ambient='on']`)で制御する。個別トグルは追加しない。
- `prefers-reduced-motion: reduce` で全静止(既存の `@media` ブロックに追加)。
- transport 非 ready 時は `--ambient-beat`(700ms)×4 = 2800ms を小節周期の fallback とする。
- ダーク/ライト双方のゲーム画面で可視。各テーマの既存スキン/トークンを使い、ライトでも実効無演出にしない。

### 役割と振付

| 役割 | 対象 | 周期 | 振付 |
|---|---|---|---|
| リズム隊 | 土地スロット(束=1スロット) | 小節(4拍) | 拍1: 全スロット沈み(1px) · 拍2: 奇数番浮上(2px)+発光 · 拍3: 全スロット弱沈み(0.5px) · 拍4: 偶数番浮上(2px)+発光 |
| ソリスト | 戦場の統率者(`isCommander && zone==='battlefield'`) | 小節(4拍) | 拍1: 一瞬沈み→3px浮上+金枠発光ピーク · 拍2: 右0.5° · 拍3: 2px浮上 · 拍4: 左0.5°→中央復帰。接地影(opacity+scaleX)連動 |
| 同期 | 非土地パーマネント(クリーチャー等) | 小節(4拍) | 土地と同じパターン(奇偶交互)。トグルで無効化可能 |

- 統率者は**統率領域では静止**(ソリストは舞台に上がって初めて踊る)。
- 拍1で土地が沈み統率者が浮上する**逆向き対位法**を意図的に維持する。
- 統率者の枠脈動は**金**(既存の統率者金枠を継承)。白金は AV4 キャスト儀式専用として温存。

### 位相と波

- 各スロットに左→右の位相オフセットを付与する。`animation-delay = barPhaseDelay + slotIndex × beatWaveStepMs`。
- `beatWaveStepMs` = 25ms(初期値)。0 = 同時発火(定在波)、大きくすると進行波寄り。
- 波は左→右に流れる(横書きの時間軸と一致)。

### 密度減衰

- スロット数が増えるほど1スロットあたりの変位を連続的に絞る。
- `density = clamp((beatDensityZeroSlots - slotCount) / (beatDensityZeroSlots - beatDensityFullSlots))`。
- 初期値: `beatDensityFullSlots = 6`(full)・`beatDensityZeroSlots = 12`(影のみ)。
- 束は**1スロット**として数える。
- 密度0では位置の動きを止め、影(opacity)+明度(overlay opacity)だけの脈動に切替。

### タップミュート

- タップ済みパーマネントは**位置を動かさない**(弦を押さえつけられた楽器)。
- 影と明度だけが拍に合わせて脈動する(ミュートされたベースノート)。
- ベースラインの連続性は途切れない(タップ済みで波が止まらない)。
- 「今どの土地が使えるか」が動きの立体感の差として盤面に滲む(チャネル①=位置・光・動き)。

### 実装方式

- **純粋 CSS アニメーション**(transform/opacity のみ)。JS ループ・React state・毎フレームの DOM 操作は使わない。
- 小節周期 = `--bar: var(--transport-bar-ms, calc(var(--ambient-beat) * 4))`。
- 小節位相 = `--transport-bar-phase-delay`(AudioVisualProvider が 250ms interval で更新)。
- カード1枚あたり疑似要素/追加要素は最大3枚(glow + bright/dark overlay + commander shadow)。
- `will-change: transform, opacity` はアニメーション対象要素のみに付与。

### TUNABLE(一か所集約 = `presentationTuning.ts`)

```ts
interface AudioVisualTuning {
  // ... 既存フィールド ...
  beatWaveStepMs: number;        // initial: 25
  beatDensityFullSlots: number;  // initial: 6
  beatDensityZeroSlots: number;  // initial: 12
  commanderAmpScale: number;     // initial: 1.0
  landAmpScale: number;          // initial: 1.0
}
```

### STOP 条件(実装者が越えてはならない)

- 音の追加(本節は無音)。
- `PresentationEvent.kind` の追加。
- 戦闘・スタック・連鎖で強度を変える。
- 個別トグルの追加(既存 `data-ambient` を再利用)。
- ライトテーマで既存AV5演出を無効化すること(本revisionでsupersede)。

## 11. 2フェーズリズム + ダンスフロア照明(AV6・2026-07-28 ユーザー裁定)

> 統率者キャストは「リーチ」の瞬間である。世界の手触りが変わる。
> しかしキャスト前も完成した編成でなければならない——待ち部屋ではない。

本節は §10(パーマネント・アンビエントビート)の拡張であり、ambient motion の再構成である。

### 分類と非目標

- `PresentationEvent.kind` の追加は**ない**。音は**ない**。BGM・BPM・フィルタは**一切不変**(聖域)。
- §2/§3/§4/§7/§8a を継承。§1 の MUST NOT をそのまま適用。
- 戦闘・スタック・連鎖で強度を変えない。

### ゲート

- 既存の「背景モーション」トグル(`:root[data-ambient='on']`)で制御。個別トグルは追加しない。
- `prefers-reduced-motion: reduce` で全静止。
- transport 非 ready 時は `--ambient-beat`(700ms)×4 = 2800ms を小節周期の fallback。
- ダーク/ライト双方のゲーム画面で可視。各テーマの既存スキン/トークンを使い、ライトでも実効無演出にしない。

### フェーズ定義

フェーズは「統率者が今戦場にいるか」という GameState の事実から導出する。

| フェーズ | 条件 | 土地・パーマネント | 統率者 | 照明 |
|---|---|---|---|---|
| 心拍(Heartbeat) | 統率者が戦場にいない | 拍1・3で全員ユニゾンに沈む(浮上無し・バックビート無し) | 統率領域で金枠が呼吸(opacity のみ) | 拍1・3で呼吸(peak-pre) |
| スタンプ(Stamp) | 戦場着地の瞬間から1小節 | 全スロットが位相0で拍1を同時にスタンプ(1回再生) | 着地と同時にスタンプ | 一拍だけ閃いて減衰(1回再生) |
| フルグルーヴ(Groove) | 統率者が戦場にいる(スタンプ後) | §10 の奇偶ウェーブ+拍2・4バックビート | §10 のダンス | 拍2・4強調(peak-post) |

- フェーズは reversible: 統率者の死亡/バウンス/追放で心拍に戻る。カウンターされたらグルーヴは解放されない。
- 「パーマネント増加で盤面が賑わう」は §10 の密度減衰(可読性維持)と「スロット増=踊り手増」の両立で実現。新規軸は追加しない。

### スタンプ(着地演出)

- 統率者の戦場着地(false→true の反転)を検知して発火。次の拍1を待たない(イベントへの即時反応)。
- `data-just-arrived` 属性を `.game-screen` に付与し、1小節後(`--transport-bar-ms` を computed style から読み取り・fallback 2800ms)に解除。
- イベント駆動の1回きり。毎フレームループは禁止。
- 全スロットが `animation-delay: 0ms` で同時発火(位相オフセット0=バンド全員で入る)。

### 統率者の_idle_呼吸(キャスト前)

- 統率領域(`zone === 'command'`)にいる統率者に `game-card--commander-idle` クラスを付与。
- 金枠の opacity だけが拍1・3で脈動(transform は無し)。ソリストが舞台袖で息をしている。
- 戦場では既存 `game-card--commander`(§10 ダンス)が適用される。

### ダンスフロア照明

- `AmbientBackdrop` の兄弟レイヤ(`.dance-floor`)として描画。z-index: 0(backdrop=-1 と board=1 の間=カードの背後・卓の上)。
- プール数 = 全統率者の `colorIdentity` の和集合(WUBRG 順・dedupe・上限5)。無色なら金1灯(`--gold-bright`)。
- 各プールは `--pool-color: var(--mana-X)` を inline style で持つ(トークン参照のみ・生カラー禁止)。
- 配置: N個を盤面横幅に均等分散(`left: ((i+0.5)/N)*100%`・上下は交互に 40%/60%)。
- `mix-blend-mode: screen`(光の加算合成)。M-AV4 性能ゲートを超える場合は通常合成+opacity 微増に退避。
- 移動/走査はしない。「光のプール」の脈動のみ(盤面可読性・性能のため)。
- キーフレーム:
  - `light-pool-heartbeat`: 拍1・3で呼吸(`--light-peak-pre`)。
  - `light-pool-groove`: 拍2・4を最も明るく(`--light-peak-post`)・拍1は60%・拍3は50%。
  - `light-pool-stamp`: 着地で peak-post×1.5 に閃いて減衰(1回再生)。

### 実装方式

- **純粋 CSS アニメーション**(transform/opacity のみ)。JS ループ・React state(スタンプ検出の1回きり useEffect を除く)・毎フレームの DOM 操作は使わない。
- 小節周期 = `--bar: var(--transport-bar-ms, calc(var(--ambient-beat) * 4))`。
- 小節位相 = `--transport-bar-phase-delay`(AudioVisualProvider が 250ms interval で更新)。
- フェーズ選択子は `.game-screen[data-commander-on-battlefield]` / `:not(...)` / `[data-just-arrived]` で制御。
- タップミュートは全フェーズで勝つ(specificity を揃え・最後に記載)。
- カード1枚あたり疑似要素/追加要素は最大3枚(glow + bright/dark overlay + commander shadow)。
- `will-change: transform, opacity` はアニメーション対象要素のみに付与。

### TUNABLE(一か所集約 = `presentationTuning.ts`)

```ts
interface AudioVisualTuning {
  // ... 既存フィールド(AV5) ...
  lightPeakPre: number;          // initial: 0.10
  lightPeakPost: number;         // initial: 0.22
  lightBase: number;             // initial: 0.04
  commanderIdlePeak: number;     // initial: 0.35
  stampSinkPx: number;           // initial: 2.5
  lightPoolSizePct: number;      // initial: 55
}
```

### STOP 条件(実装者が越えてはならない)

- 音の追加(本節は無音)。
- `PresentationEvent.kind` の追加。
- BGM・BPM・フィルタの変更(聖域)。
- 戦闘・スタック・連鎖で強度を変える。
- 個別トグルの追加(既存 `data-ambient` を再利用)。
- ライトテーマで既存AV6演出を無効化すること(本revisionでsupersede)。
- 毎フレームの JS ループ。
- 照明の移動/走査(脈動のみ)。

---

## 12. AV7 production integration（2026-08-01 ユーザー裁定）

AV7-P / AV7-P2の試聴を経て、ユーザーはゲーム画面への一旦の組み込みと、その後の実プレイによる最終使用感judgeを承認した。§2–§6のAV7記述が旧AV3/AV4のpatch/crossfade記述を置き換える。

- production mixは§3.1の固定`hybrid`一種。公開設定は既存BGM/SFX ON/OFFと70/80 sliderだけ。
- BGMは単一native loop。音源`candidate-b-tight-128-bars.mp3`自体を変更しない。
- production assetは採用済みCC0 / project-originalだけ。比較試聴音声と`sound/`原本は本番範囲外。
- 本マイルストーンの完了はローカル実プレイ可能・cold audit・機械checkまで。commit / push / Pages公開は、ユーザーの使用感judgeより前には行わない。
