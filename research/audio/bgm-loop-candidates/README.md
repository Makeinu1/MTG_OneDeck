# 「お気に入りテクノ」全曲ループ候補

状態: `user-selected`

**採用候補: 候補B `candidate-b-tight-128-bars`**

元MP3は上書きしていない。アプリへの組み込み、git操作、公開も行っていない。

## 先に聴くファイル

継ぎ目は各ファイルの **8秒地点**。

1. `validation/candidate-a-natural-full-cycle-seam-audition.mp3`
2. `validation/candidate-b-tight-128-bars-seam-audition.mp3`

その後、通常試聴版を一周以上聴く。

1. `previews/candidate-a-natural-full-cycle.mp3`
2. `previews/candidate-b-tight-128-bars.mp3`

必要なら、実際に3回連続した検証版を使う。

- `validation/candidate-a-natural-full-cycle-three-cycles.mp3`
- `validation/candidate-b-tight-128-bars-three-cycles.mp3`

## 候補の違い

### 候補A: 自然終端129小節

- 冒頭から曲の自然なフェード終端までを残す
- 516拍、約253.766秒
- 末尾無音の大部分は除去
- 終端が十分小さいためクロスフェードは行わず、両端に2msのクリック防止フェードだけを付与
- 曲の終わりと再開は分かりやすい

### 候補B: タイト128小節

- 冒頭約0.459秒と、最後のフェード部分を整理
- 512拍、約251.798秒
- 128小節ぴったりで戻る
- 末尾と冒頭の50ms平均レベル差が小さく、波形上はキック列が連続する
- 曲全体の展開はほぼ残るが、候補Aより終端の余韻が短い

機械計測上の推薦は **候補B**。周期誤差が実質0で、継ぎ目前後のエネルギーも近い。2026-07-26のユーザー試聴でも候補Bが選択された。

## 試聴時の判定

- 8秒地点の継ぎ目が分かるか
- 肩で取っているリズムがそこで途切れるか
- 曲が不自然に途中で切られた印象があるか
- 15分程度聴いて疲れないか
- ブレイクから通常グルーヴへ戻る流れが自然か

候補Bを採用する。実機組み込み後の長時間試聴で違和感があれば、採用済みであることを理由に固定せずループ点を再調整する。

## ゲーム実装時の音量

マスターは元音源相当の音量を保っている。原音は約 -13.7 LUFS、true peak は約 -0.02 dBFSで、そのままではイベント音を重ねる余裕が少ない。

初期実装ではBGMバスへ **-4.5 dB** の非破壊ゲインを適用する。これにより約 -18.2 LUFS、true peak 約 -4.52 dBFSとなる。最終値はキャスト音と統率者専用音を重ねた実機試聴で決める。

## ファイル

- `masters/`: 48kHz・ステレオ・24-bit PCM WAV
- `previews/`: 256kbps MP3
- `validation/`: 継ぎ目20秒版と3周期連結版
- `analysis/`: 波形、スペクトラム、解析・検証JSON
- `analyze_audio.py`: 追加依存なしのテンポ解析
- `verify_loops.py`: 周期と境界サンプルの検証
- `loop-metadata.json`: 実装用候補値とユーザー判定欄
