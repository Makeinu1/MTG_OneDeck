# Correction Brief: feel-1 guided target sweep — round 1 (2026-08-05)

あなたは実装者です。判定者所有物(`review.*`テスト・`docs/`・台帳)とgitを触らないこと。
報告=変更ファイル・各findingの対応・defer・未解決点・vitest結果の実出力貼り付け。

## 前提(必ず読む)

- 原ブリーフ: `research/cr-grounding/feel-1-implementer-brief.md`
- 契約: `research/cr-grounding/feel-1-guided-target-sweep.draft.md`
- review pin(変更禁止): `src/engine/__tests__/review.feel-1-guided-target.test.ts`
- **作業ツリーには先行実装者の初回実装が未コミットで入っている**(compile.ts +94 / commands.ts +26)。
  初回実装でR5〜R9のreview pinは11/11緑。判定者はコーパス全件検証で fail-closed 規律違反を発見し、
  今回の是正を要求する。初回実装を活かしたまま是正すること(書き直し不要)。
- 反復テスト: `CI=1 npx vitest run src/engine/__tests__/review.feel-1-guided-target.test.ts src/engine/grammar/__tests__/ --reporter=dot`
- フル check(`npm run check`)は実行しない。

## 判定者 findings(全て compiler誤訳・fail-closed 規律違反)

コーパスの m→g 移行(現状103件)を全件分類した結果、次の違反パターンを確認した。
**共通の是正方針: 対象節に認識できない制約・修飾・付随節がある文は、その文全体を guided にしない(manualへ)。**
部分実行・silent drop は契約の fail-closed 条項で禁止。

### A. 対象修飾の silent drop(非法対象提示 = CR 115 違反)

次の修飾が対象名詞句に含まれる文は、現TargetFilterで表現不能なら manual へ落とす:

1. `tapped` 修飾 — "up to one target tapped creature"(Atraxi Warden, Cryogen Relic, Peerless Ropemaster, Splinter)
2. 動的mv比較 — "with mana value less than or equal to the number of counters among permanents you control"(Dimension X Pizzasaur)・"with mana value less than or equal to that spell's mana value"(Hammerhead Tyrant)・"with lesser mana value"(Clement, the Worrywort)・"with mana value 3 or greater"(Earth Kingdom Jailer。"or greater" は or-less の逆で現maxManaValueと非互換)
3. タフネス制約 — "with toughness 5 or less"(Unidentified Hovership)
4. 色制約 — "that's one or more colors"(Ugin, Eye of the Storms)
5. keyword制約 — "with trample or haste"(Minsc & Boo)・"creature with flying"(Spider Food, Storm, Shaker of Skies)
6. 関係的/履歴的制約 — "that crewed it this turn"(Getaway Car)・"commander creature"(Drillworks Mole)・"non-Spirit creature"(Roaming Ghostlight: subtypes 非対応なら manual)
7. controller汚染の禁止 — 対象節**以外**(トリガー条件・比較基準節)の "you control" を対象修飾として拾わないこと。違反例: Fear of Sleep Paralysis("another enchantment you control enters" が対象creatureのfilter.controller='you'に漏入)、Dimension X Pizzasaurの2節目。
8. "that player controls"(Feline Sovereign, Wakka の "that player controls")・"an opponent controls"(Stunning Shot 2節目は正しく opponent が入ったが "that player controls" は対象節内で controller 解決不能)→ controller が一意に決まらない文は manual へ。

### B. 複合節・付随節の silent drop(部分実行禁止)

対象選択プロンプト以外の実行不能な節・文が残る場合は文全体 manual へ:

1. 自己への副次効果 — "and put a +1/+1 counter on this creature"(Renegade Silent, Wakka)・"on this creature and ... on up to one target"(Drillworks Mole)・"Put a +1/+1 counter on She-Hulk"(She-Hulk)・"and that creature doesn't untap during its controller's next untap step"(Winterthorn Blessing)
2. 追加文 — "This creature phases out."(Renegade Silent)・"It loses all abilities for as long as ..."(The Wondrous Wasp)・"You gain 2 life." が guided に混在していないか確認(Liminal Hold, Prayer of Binding)
3. 型変更・変身節 — "That creature becomes an artifact in addition to its other types."(Phyrexian Scriptures)・"That artifact becomes a 0/0 Homunculus artifact creature with flying."(Kenku Artificer)
4. keyword-action本体+反射 — "it connives. When it connives this way, ..."(Psychic Pickpocket)
5. 起動制限節 — "Activate this ability only once."(She-Hulk)
6. stun counter 複合 — "tap up to one target creature and put a stun counter on it"(Champions of the Shoal 等10件超)。**guided runtime(対象選択後)が stun counter 設置まで実行するか確認すること**。実行不能なら manual へ。確認結果を報告に含める。
7. prompt重複 — Winterthorn Blessing で対象2節なのに target prompt が3個出る現象の原因を確認し、正しくしない(重複 prompt は禁止)。
8. "exile ... until this creature leaves the battlefield" 系の一時追放節(All-Fates Stalker 等)が guided 昇格している件: 一時追放の runtime 実行可能性を確認し、不能なら manual へ。

## 受け入れ(done when)

1. review pin 11件全緑維持(R1〜R11)。
2. 上記 A/B に該当するコーパス行が guided に昇格しない(fail-closed)。
3. 違反パターンに該当しない健全な m→g(例: Skyclave Apparition形 "up to one target nonland, nontoken permanent you don't control with mana value 4 or less"、Regrowth形)は guided のまま維持する(回帰禁止)。
4. 周辺回帰: `CI=1 npx vitest run src/engine/grammar/__tests__/` で decisionSnapshot の移行が m→g(健全分のみ)・g→m(健全分の誤降格) になっていないこと。g→m が出た場合はその行が本当に違反パターンか判定者へ報告(独断で残さない)。
5. 報告にコーパス再走の m→g 件数と、その全件のカード名一覧を貼り付ける(判定者がCR 115再検証するため)。
