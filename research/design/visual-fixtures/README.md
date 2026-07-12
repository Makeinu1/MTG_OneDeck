# D4a visual fixtures

実コンポーネントへ決定論的`GameState`を渡す開発専用ページ。本番entry・保存DB・GameState schemaは
変更しない。builderとrender entryは`src/dev/visualFixtures/`に置き、通常のTypeScript／ESLint監査へ
含めるが、製品entryからimportしないため本番bundleには入らない。

Vite起動後:

```text
http://127.0.0.1:5173/research/design/visual-fixtures/?scenario=hand&ui=new
http://127.0.0.1:5173/research/design/visual-fixtures/?scenario=hand&ui=legacy
```

`scenario`:

- `mulligan` — 7枚＋mulligan pending
- `hand` — 8枚手札
- `lands` — 同名basic 3＋special 3、2枚tapped
- `battlefield` — lands 6＋creature 6＋その他4
- `stack` — battlefield＋stack 2＋warnings
- `graveyard` — stack scene＋graveyard 10＋exile 2

`ui`は`new`または`legacy`。同じbuilder出力を使うため、新旧比較でshuffleや操作履歴がずれない。

このページは視覚比較器であり、受け入れ判定そのものではない。D4a reviewと5 viewport実機確認が
別途必要。
