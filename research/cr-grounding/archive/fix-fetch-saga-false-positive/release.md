# fix-fetch-saga-false-positive — release packet (2026-08-06)

- マイルストーン: `fix-fetch-saga-false-positive`(ユーザー報告「ウルザの物語 第I/II章で土地がフェッチされる」)。
- 契約: `docs/engine-spec.md` §11.1(2026-08-06 スコープ追記: 節単位の土地対象照合)。base `5379ffb`。
- 実装者: Kant(`019fd766-af42-7002-bfe6-f8738ab727cd`)。候補 `9a01f64`。
- 冷監査者1: Boyle(`019fd7ba-1158-7783-b349-2d4e21af034b`)— F1 HIGH(Panorama capture window 退化)。
- F1 閉塞: 判定者有界外科修正 `5b91354`(capture window を card(s) 終端子まで拡張 + R4 pin)。
- 冷監査者2: Hypatia(`019fd7dc-983c-7e81-ba75-a43bb1738ff5`)— BLOCKER 0 / HIGH 0 →
  `AUDIT-OK-PENDING-FULL-CHECK`。corpus(17,491枚)新旧退化 0 件・Panorama/Landscape/Hideout 系正常。
- フルcheck: 1回で全緑(lint / tests / build)。release SHA `5b91354`。
- 証拠: `src/store/__tests__/review.m415-saga-false-positive.test.ts`(R1-R4)、
  対象ドメイン 7 suite 42 緑・saga 4 suite 37 緑・engine/store/components 2513 緑。
- 既知残境界(LOW・台帳 note 記録済み): 非土地 Saga の土地対象フェッチ章(4枚)は store 消費経路に
  型行ガードなし・`fetchFilter` の face 全文走査・非基本サブタイプ(Gate/Cave/Desert 等)対象は null。
  いずれも本変更で悪化していない。
