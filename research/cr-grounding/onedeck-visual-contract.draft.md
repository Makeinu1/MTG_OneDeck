# OneDeck visual contract — draft

判定者による `docs/` への再オーナー化前の実装草稿。UI表現のみを定め、ゲーム上の特性や決定性は変更しない。

## アートディレクション

- 呼称は「アルケイン戦術卓」。カードアートを最大の色源とし、操作chromeは静かに保つ。
- Darkは濃紺の2段階面、Lightは温かい象牙色の2段階面を用いる。レイアウト、寸法、操作順、ヒット領域は同一とする。
- 金は主操作と統率者、青白はスタック、赤は警告だけに用いる。マナ色はマナの意味表示へ限定する。
- 4px/8px間隔、2段階の角丸とelevation、44px以上の操作領域を基本とする。

## CardVisual

- 表向き通常カードは正しいカード画像を優先し、画像失敗時は名前・タイプを含む専用面へ戻す。
- トークンは名前・タイプ・P/Tを常に識別可能にし、意味が確定した宝物・手掛かり・食物・血だけ専用絵を用いる。曖昧な候補へ無関係な絵を割り当てない。
- 裏向きカードはOneDeck独自裏面だけを表示し、元の名前・画像・ルールをDOM、alt、titleへ漏らさない。
- DFCは現在面を主表示、反対面をpreviewの副表示とし、hoverだけでゲーム状態を変更しない。

## 状態と動き

- `default / hover / pressed / focus-visible / selected / disabled / loading / error` を色以外の輪郭・文字・形でも区別する。
- 通常時は静かにし、ドロー、着地、変身、解決だけ短く反応する。入力はブロックせず、大量操作はまとめる。
- `prefers-reduced-motion` では機能を欠落させず、移動・flipを即時表示へ置き換える。

## 禁止事項

- glowの重ね過ぎ、全ボタンの金色化、過剰なblur、カード絵を覆うbadge、粒子・紙吹雪。
- hoverによるreflow、色だけに依存する状態、画像読込後のlayout shift。
- 公式MTGカード裏面の複製、曖昧なScryfall token候補の先頭採用。

## CR grounding

- CR 111.2 / 111.3 / 111.4: tokenのowner/controller、領域移動時の消滅、tokenであることのルール上の扱いは既存engine契約を維持する。アートはUI-onlyでありルール特性を追加しない。
- CR 701.27: transformは既存`faceIndex`更新を正本とし、flip演出はその結果へ非blockingで添えるだけとする。
- CR 701.28: turn face up/downは既存`faceDown`を正本とする。裏面表示から表面情報を推測・公開しない。
