# M-AV 実装契約草稿(実装者ドラフト・判定者承認待ち)

**status**: draft — 判定者の承認・正本反映なし。このファイル自体は正本ではない。
**root**: ユーザー確定事項(2026-07-26)を `docs/audio-visual-contract.md` §6 TrackManifest へ落とし込むための具体的値と、各正本への差分提案。
**scope**: AV0(ループ音源とTrackManifestの凍結)の実装値。AV1〜AV4の設計変更は含まない。
**参照正本**: audio-visual-contract.md / acceptance.md M-AV / design-system.md §7・§8a / ui-architecture-v2.md §7 / design-vision.md §2 / loop-metadata.json

---

## 1. TrackManifest 確定値(AV0 凍結対象)

ユーザー確定: candidate-b-tight-128-bars.mp3 を公開BGMに採用。公開権確認済み。

```ts
const TRACK_MANIFEST: TrackManifest = {
  id: 'candidate-b-tight-128-bars',
  src: `${import.meta.env.BASE_URL}audio/bgm/candidate-b-tight-128-bars.mp3`,
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
```

### 補足

- **MP3 SHA256**: `6307839cab73c84265023ce2a8cdb489355f3f48a3ef9c94d8cdb6b6190dde0c`(ユーザー確定・公開権確認済み)。loop-metadata.json の candidate-b sha256(`911f12e...`)は WAV マスターの値。公開に使う MP3 とは別ファイルであり矛盾ではない。
- **512拍 / 128小節 / 4/4**。beatAnchors は32拍(8小節)間隔の17点。anchor間 beatSpan=32、quantizeStepsPerBeat=4(契約 §4 初期値)なら128区間/anchor間。
- **sections**: 空配列で凍結。groove/break/rejoin の区間境界は未計測。契約の `sections` 型に適合し、runtime は sections なしで anchor 補間だけ行う。AV2以降で計測・凍結するまで空配列を維持。
- **src パス**: GitHub Pages base=/MTG_OneDeck/ を `import.meta.env.BASE_URL` で吸収。`public/audio/bgm/` へ配置。最終パスは AV0 実装者が既存 public/ 構造を確認して確定する(この草稿は提案)。
- **gainDb = -4.5**: loop-metadata.json `mixRecommendation.runtimeMusicGainDb` と一致。非破壊 runtime gain。

---

## 2. 各正本に必要な具体的差分

### 2.1 `docs/audio-visual-contract.md`

| 箇所 | 現行 | 差分 | 根拠 |
|---|---|---|---|
| §6 DEFER「音楽・意味イベント音を既定ONへ変更するか」 | DEFER(既定OFF) | **DEFER解除**: BGMと意味イベント音は新規既定ON。ダークのゲーム画面限定。ライトは保存設定を保持して実効無音 | ユーザー確定 |
| §6 DEFER「ライトモードへ新しいBGMを追加しない」 | DEFER | **DEFER維持**(変更なし)。ライトはBGMなし・実効無音 | ユーザー確定と整合 |
| §6 TrackManifest | 型定義のみ・値なし | §1 の確定値を「凍結済み TrackManifest」として追記 | ユーザー確定 |
| §6「ループ点、beat anchor、gain、実測BPMはループ音源完成後に凍結する」 | 将来形 | 凍結済みとして §1 値を参照 | ユーザー確定 |
| §0 STOP条件「権利確認前の音源をpublic/へ」 | 維持 | 変更なし。本音源は権利確認済みであることを loop-metadata.json と本草稿で記録 | — |
| §4 TUNABLE 初期値 | quantizeStepsPerBeat=4, snapWindowMs=60, maxInteractionAudioDelayMs=80 | 変更なし | — |
| §5 CommanderMixTuning 初期値 | `-4dB / 40ms / 360ms / 320ms` へ凍結済み | 正本の凍結値をそのまま実装する | ユーザー確定 |
| 新規: 再生開始条件 | 明示なし(§7.4 ui-arch に gesture 記述) | 「最初の明示的ユーザーgesture後にBGM再生を開始。autoplay制限解除失敗はゲームエラーにしない」を追記 | ユーザー確定 |
| 新規: 同一セッション復帰 | 明示なし | 「同一ブラウザセッション内でのゲーム画面復帰はBGM再生位置を保持。reload/タブ閉じは新sessionとして位置リセット」を追記 | ユーザー確定 |

### 2.2 `docs/acceptance.md` M-AV節

| 箇所 | 差分 | 根拠 |
|---|---|---|
| AV-17「基準曲」 | 「candidate-b-tight-128-bars(251.798458秒・512拍・128小節・122.000736 BPM)」へ具体化 | ユーザー確定 |
| 新規 AV-34 | 「ダークのゲーム画面で最初の明示gesture後BGM再生開始。gesture前は再生しない。ライトではBGM・意味イベント音とも実効無音」 | ユーザー確定 |
| 新規 AV-35 | 「同一セッション内でゲーム画面離脱→復帰でBGM位置保持。reload後は位置リセット」 | ユーザー確定 |
| AV-1〜AV-33 | 変更なし | — |

### 2.3 `docs/design-system.md`

| 箇所 | 差分 | 根拠 |
|---|---|---|
| §7「音は当面任意 ON/OFF・既定 OFF」 | 「BGMと意味イベント音は新規既定ON(ダークのゲーム画面限定)。ライトは保存設定を保持して実効無音」へ更新 | ユーザー確定 |
| §8a AmbientBackdrop | 変更なし。transport接続はAV2スライス | — |

### 2.4 `docs/ui-architecture-v2.md` §7

| 箇所 | 差分 | 根拠 |
|---|---|---|
| §7.4「autoplay制限の解除は既存の音ON操作など明示的なユーザーgestureで行う」 | 「最初の明示的ユーザーgesture」へ具体化。既存の音ON操作に限定しない | ユーザー確定 |
| §7.4 新規 | 「同一セッション復帰はBGM位置保持。reload/タブ閉じは新session」を追記 | ユーザー確定 |
| §7.6 AV0 | 権利確認済み・凍結値は本草稿 §1 を参照、と補記 | ユーザー確定 |

### 2.5 `docs/design-vision.md` §2

変更なし。北極星②の記述はユーザー確定事項と矛盾しない。

---

## 3. 既存契約との矛盾・注意

| # | 矛盾点 | 深刻度 | 対処 |
|---|---|---|---|
| C1 | audio-visual-contract §6 DEFER「既定OFF」とユーザー確定「既定ON」が直接矛盾 | **HIGH** | 判定者が §6 DEFER を解除し「既定ON(ダーク限定・ライト実効無音)」へ書換える |
| C2 | design-system §7「既定 OFF」とユーザー確定「既定ON」が矛盾 | **HIGH** | 判定者が §7 を更新。C1 と同時 |
| C3 | loop-metadata.json candidate-b sha256(WAV)とユーザー確定 MP3 sha256 が異なる | **LOW** | 矛盾ではない(別ファイル)。loop-metadata.json に MP3 sha256 を追記すれば十分 |
| C4 | TrackManifest.sections が空配列 | **MEDIUM** | 契約の型に適合。runtime は sections なしで動作可能。AV2以降で計測まで空配列維持。「未実装」と偽らない |
| C5 | 「同一セッション復帰は位置保持」と「reload後は新session」の境界 | **MEDIUM** | 「同一セッション = in-memory transport 生存中。reload / タブ閉じ = 新session」と定義。判定者が §7.4 へ追記 |

---

## 4. review 受け入れ草稿(AV0 スライス用)

判定者が `review.*` へ落とす前の草稿。AV0 の合格条件。

### AV0-R1 TrackManifest 凍結値の機械検証

```
given: TRACK_MANIFEST
assert: id === 'candidate-b-tight-128-bars'
assert: bpmNominal === 122.000736
assert: loopStartSec === 0
assert: loopEndSec === 251.798458
assert: gainDb === -4.5
assert: beatAnchors.length === 17
assert: beatAnchors[0] === { beatIndex: 0, atSeconds: 0 }
assert: beatAnchors[16] === { beatIndex: 512, atSeconds: 251.798458 }
assert: 全隣接anchorで beatIndex 差 === 32 かつ atSeconds 単調増加
assert: sections は空配列
```

### AV0-R2 音源ファイルの完全性

```
given: public/audio/bgm/candidate-b-tight-128-bars.mp3
assert: SHA256 === '6307839cab73c84265023ce2a8cdb489355f3f48a3ef9c94d8cdb6b6190dde0c'
assert: ファイルが git に commit 済み
assert: Pages ビルド後に 200 を返す
```

### AV0-R3 既定値とテーマ境界

```
given: ダークモード・ゲーム画面・初回訪問(保存設定なし)
assert: BGM 設定の初期値 === ON
assert: 意味イベント音設定の初期値 === ON

given: ライトモード(保存設定 ON でも)
assert: BGM 再生しない・実効無音
assert: 意味イベント音も実効無音
assert: 保存設定自体は保持(ダーク復帰で ON に戻る)

given: 保存設定が OFF のユーザー
assert: 既定ONへの上書きなし。保存設定を保持
```

### AV0-R4 再生開始と復帰

```
given: 明示gesture前
assert: BGM 再生していない

given: 最初の明示gesture後(ダーク・ゲーム画面)
assert: BGM 再生開始

given: 同一セッション内でゲーム画面を離脱→復帰
assert: BGM 位置が保持されている

given: reload後
assert: 新session。BGM 位置リセット(再生開始gesture待ち)
```

### AV0-R5 契約非破壊

```
assert: GameState / GameCommand / snapshot schema への変更 0 件
assert: PresentationEvent.kind の追加 0 件
assert: npm 依存の追加 0 件
assert: review.* 既存ケースが全緑
assert: npm run check 全緑
```

---

## 5. 未裁定を増やさない安全な実装値まとめ

| 項目 | 値 | 出典 | 未裁定増 |
|---|---|---|---|
| 採用音源 | candidate-b-tight-128-bars.mp3 | ユーザー確定 | いいえ |
| MP3 SHA256 | 6307839c...dde0c | ユーザー確定 | いいえ |
| 再生時間 | 251.798458秒 | loop-metadata / ユーザー確定 | いいえ |
| BPM | 122.000736 | loop-metadata / ユーザー確定 | いいえ |
| 拍数/小節数 | 512拍 / 128小節 | loop-metadata | いいえ |
| runtime gain | -4.5 dB | loop-metadata / ユーザー確定 | いいえ |
| 公開権 | 確認済み | ユーザー確定 | いいえ |
| 対象テーマ | ダークのゲーム画面限定 | ユーザー確定 | いいえ |
| BGM既定 | ON(新規) | ユーザー確定 | いいえ(DEFER解除) |
| 意味イベント音既定 | ON(新規) | ユーザー確定 | いいえ(DEFER解除) |
| ライト | 保存設定保持・実効無音 | ユーザー確定 | いいえ |
| 再生開始 | 最初の明示gesture後 | ユーザー確定 | いいえ |
| 同一セッション復帰 | 位置保持 | ユーザー確定 | いいえ |
| 通常意味イベント | spell-cast / land-played / turn-advanced / commander-cast のみ | 契約 §2 と一致 | いいえ |
| commander | 固有儀式・通常cast音抑止 | 契約 §5 と一致 | いいえ |
| GameState待機 | 禁止 | 契約 §1/§4 と一致 | いいえ |
| sections | 空配列(AV2以降で計測) | 未計測 | いいえ(既存DEFER維持) |
| CommanderMixTuning | `-4dB / 40ms / 360ms / 320ms` | 契約 §5 凍結済み | いいえ |
| snapWindowMs / quantizeStepsPerBeat | 60ms / 4(変更なし) | 契約 §4 | いいえ |

---

## 6. defer した事項

- **sections の計測**: groove/break/rejoin の区間境界は未計測。AV2 の transport 接続時に必要になれば計測。空配列で AV0 は凍結可能。
- **CommanderMixTuning**: deferなし。AV4では契約 §5 の凍結値を実装する。
- **イベント音の音源**: spell-cast / land-played / turn-advanced / commander-cast の音源ファイルは未制作・未選定。AV3/AV4 のスコープ。
- **MP3 の public/ 配置パス**: `public/audio/bgm/` を提案。既存 public/ 構造との整合は AV0 実装者が確認。
- **ライトの実効無音の実装方法**: テーマ判定で BGM/musical-event の出力を mute するか、transport 自体を起動しないかは AV1 実装者が選択。いずれにせよ保存設定は書き換えない。
