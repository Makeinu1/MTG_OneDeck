# AV7-PRODUCTION-INTEGRATION — 本番ゲーム音響組み込みブリーフ

- **milestone**: `AV7-PRODUCTION-INTEGRATION`
- **base SHA**: `fdcac70bc8a9c4b6ab519163d04bf70fe4712e39`
- **approved prototype fingerprint**: `dd76afd4b45745d0ec31722f0dc85e256cec8d1f60f6fc95c33521a6094f1aef`
- **prototype fixture**: `research/design/mockups/av7-audio-palette.html`
- **source contract**: `docs/audio-visual-contract.md` §§2–6, §12
- **acceptance**: `docs/acceptance.md` M-AV

## Goal

AV7-P2でユーザー承認された`hybrid`パレットを本番ゲーム画面へ組み込み、ローカルの実プレイで最終的な使用感を判断できる状態にする。今回はcommit / push / Pages公開を行わない。

## Frozen production palette

各layerは`src / gainDb / offsetMs / chokeGroup`を持つ固定manifestとする。全offsetは`0ms`。同じ意味に同じ合成音を返し、ランダム化しない。

| SFX cue | layers (`asset @ gainDb`) | chokeGroup |
|---|---|---|
| `draw-completed` | `draw-slide @ -2.38`, `draw-fan @ -9.90` | `draw` |
| `land-played` | `land-place @ -1.41`, `low-thud @ -7.54` | `land` |
| `spell-cast` | `spell-place @ -2.85`, `spell-arcane-snap @ -10.46` | `spell` |
| `tap-changed` / tapped | `tap-shove @ -2.50` | `tap-change` |
| `tap-changed` / untapped | `untap-slide @ -2.85` | `tap-change` |
| `stack-resolved` | `resolve-shove @ -3.88` | `resolve` |
| `shuffle-completed` | `shuffle @ -1.94` | `shuffle` |
| `turn-advanced` | `turn-chip @ -1.94`, `low-thud @ -9.12` | `turn` |
| `commander-cast` | `commander-contact @ -7.13`, `low-thud @ -6.02`, `commander-portal-open @ -6.74` | `commander` |

`low-thud`は試聴fixtureの92→47Hz sine、8ms attack、150ms decayを48kHz / stereo / PCM16 WAVへ決定論的に焼いたproject-originalとする。

## Scope

1. `MusicBus`を単一`HTMLMediaElement`へ変更し、`loop = true`を使う。`TrackManifest.crossfadeMs`、二本目、crossfade timer/interval、等電力計算を削除する。`loopStartSec` / `loopEndSec` / beat anchorsはtransport計算用に残す。
2. 同一ページ内remount時の再生位置、初回gesture解除、dark gameだけ可聴、BGM gainと独立BGM/SFX slider既定70/80を維持する。
3. 採用済みCC0およびproject-originalだけを`public/audio/sfx/`へ置く。比較専用音声、`sound/spells/`、Cockatrice、zip/7z、`sound/`全体を公開しない。`sound/`原本を一切変更しない。
4. 旧`OfflineAudioContext`パッチを固定sample manifest + 非同期fetch/decode cacheへ置換する。未load・decode/play failureは無音へ縮退し、GameStateを待たせない。
5. `PresentationEvent` / `SfxKind`に`draw-completed`、`tap-changed`、`stack-resolved`、`shuffle-completed`を追加する。GameState / GameCommand / snapshot schemaは変更しない。
6. UIが開始した成功済みforward意味操作だけを一操作一件でpublishする。drawは実際に1枚以上引けた時だけ、tapは状態が変わった時だけ、resolve top/allは1枚以上stackから解決完了した時だけ、shuffleは正常commit時だけ鳴らす。
7. pointer / touch / keyboard / DnD / action sheet / library menuは同じcontroller経路へ正規化する。複数枚draw、bulk tap/untap、resolve-allは一操作一音。自動マナ支払い・効果内draw/shuffleなど別の意味操作の内部副作用は追加音を重ねない。
8. failure、cancel、確認待ち、支払い待ち、manual-required到達時点、undo/redo、restore、hover、menu開閉は無音。遅延解決は本当にstack itemが離れた時だけ一度鳴らし、cancel/abortで鳴らさない。
9. 60ms snap window / 80ms上限を維持する。同kindの再発火は前のtailだけをchokeする。通常音はBGMをduckせず、`commander-cast`だけ既存cut-in/duckを維持する。

## Implementer constraints

- 実装者は`docs/`、`review.*`、`AGENTS.md`、台帳、`.claude/loop-state.md`、gitを変更しない。
- npm依存を追加・更新しない。
- `sound/`を削除・上書き・整形しない。
- 既存のGameState / GameCommand / store公開APIの意味を変更しない。UI controllerへの非永続presentation wrapper追加は可。
- 試聴fixtureのpalette selectorを本番設定へ持ち込まない。新しい設定項目を増やさない。
- 対象テストだけを実行し、フル`npm run check`は判定者へ残す。

## Done when

- native loop、固定production sample manifest、8種semantic SFX、成功forward exactly-once経路が実装済み。
- production audio assetsは48kHz / stereo / PCM16、通常音1秒以内、commander 1.6秒以内、true peak -3dBFS以下。
- judge-owned AV review testsと実装者の対象テストが緑。
- dark/light、375×812、812×375、1440×900でゲームを操作でき、console error 0。
- 独立cold auditでBLOCKER/HIGH 0、その後同一fingerprintで`npm run check`が緑。
- ローカルゲームがユーザーの最終使用感judge用に起動可能。commit / push / Pages公開は未実施。
