# ACT-3 起動型キーワードの正規形展開 — Scoping Draft

**Date**: 2026-07-17  
**Status**: Research & Scoping (no implementation)  
**Background**: ACT-1 (b6400c0) で起動コスト迂回を封鎖後、次フェーズは起動型キーワード能力(equip, crew, level up等)の canonical activated line への展開。Equip と Crew は既に出荷済みだが、他の10種類のキーワードはまだ manual fallback。

---

## (a) キーワード別需要表

### Scryfall Snapshot (2026-06-19、17,491枚) ベースの全体需要

| Keyword | Corpus Count | Rank | CR Section | Notes |
|---|---:|---:|---|---|
| **unearth** | 47 | 1 | 702.84 | 墓地からの蘇生型 activated ability |
| **ninjutsu** | 30 | 2 | 702.49 | 攻撃中クリーチャーの置き換え |
| **adapt** | 22 | 3 | 701.46 | +1/+1 カウンター置出(CR701.46・action、702ではなく) |
| **reconfigure** | 17 | 4 | 702.151 | 装備の attach/unattach |
| **monstrosity** | 16 | 5 | 701.37 | +1/+1 カウンター+monstrous指定(CR701.37・action、702ではなく) |
| **level up** | 13 | 6 | 702.87 | レベル・カウンター置出 |
| **outlast** | 6 | 7 | 702.107 | +1/+1 カウンター+タップ |
| **embalm** | 4 | 8 | 702.128 | 墓地からの Zombie トークン生成 |
| **eternalize** | 4 | 9 | 702.129 | 墓地からの 4/4 黒 Zombie トークン生成 |
| **fortify** | 1 | 10 | 702.67 | Fortification のランド装備(装備の土地版) |

### MyDeck 4 Decks (Celes, Gogo, Kefka, Muldrotha) 内の需要

| Keyword | MyDeck Count | Cards |
|---|---:|---|
| **unearth** | 2 | • Priest of Fell Rites (Celes) • Fatestitcher (Gogo?) |
| **adapt** | 1 | • Emperor of Bones |
| fortify | 0 | — |
| level up | 0 | — |
| embalm | 0 | — |
| eternalize | 0 | — |
| outlast | 0 | — |
| ninjutsu | 0 | — |
| reconfigure | 0 | — |
| monstrosity | 0 | — |

**優先度判定**:  
- **必須 (V1 実デッキ数 >= 1)**: unearth (2件), adapt (1件)  
- **北極星③分解可能性テスト** (既存プリミティブで表現可能か):
  - unearth: `return-from-graveyard` + `haste` + `exile-at-end` で分解可能 → 新抽象不要、既存 GameCommand で処理可能か検討要
  - adapt: `+1/+1-counter-if-zero` という条件付き counter-placing → 新ゲート可能性高

---

## (b) Canonical 展開テンプレ集

### CR 原文 → Canonical Activated Line の対応

各キーワードについて、CR から抽出した定義(英語 oracle)と、canonical activated line 形式への展開を記載。

#### 1. Equip (702.6 — **既出荷**)

**CR 702.6a**:  
> "Equip [cost]" means "[Cost]: Attach this permanent to target creature you control. Activate only as a sorcery."

**出荷済み** (ACT-1 より前。equip-specific recognizer あり)

#### 2. Crew (702.122 — **既出荷**)

**CR 702.122a**:  
> "Crew N" means "Tap any number of other untapped creatures you control with total power N or greater: This permanent becomes an artifact creature until end of turn."

**出荷済み** (crew-specific recognizer あり)

#### 3. Fortify (702.67)

**CR 702.67a**:  
> "Fortify [cost]" means "[Cost]: Attach this Fortification to target land you control. Activate only as a sorcery."

**Canonical form**:  
```
{cost}: Attach this Fortification to target land you control. Activate only as a sorcery.
```

**展開方針**: Equip と構造が同一(対象がランド)。existing equip recognizer の拡張で装備対象を land に変更するか、別 recognizer か検討。

#### 4. Level Up (702.87)

**CR 702.87a**:  
> "Level up [cost]" means "[Cost]: Put a level counter on this permanent. Activate only as a sorcery."

**Canonical form**:  
```
{cost}: Put a level counter on this permanent. Activate only as a sorcery.
```

**展開方針**: `put-counter` effect の既存語彙で対応可。新たな制約はない(sorcery-only は警告のみ)。

#### 5. Outlast (702.107)

**CR 702.107a**:  
> "Outlast [cost]" means "[Cost], {T}: Put a +1/+1 counter on this creature. Activate only as a sorcery."

**Canonical form**:  
```
{cost}, {T}: Put a +1/+1 counter on this creature. Activate only as a sorcery.
```

**展開方針**: equip と同様だが、付加的に `{T}` を必須化。コスト部が複合(mana + tap)。

#### 6. Unearth (702.84)

**CR 702.84a**:  
> "Unearth [cost]" means "[Cost]: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step. If it would leave the battlefield, exile it instead of putting it anywhere else. Activate only as a sorcery."

**Canonical form**:  
```
{cost}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step. If it would leave the battlefield, exile it instead of putting it anywhere else. Activate only as a sorcery.
```

**展開方針**: 複雑な複合効果(return + haste付与 + 条件付き exile)。既存の exile-on-end-step recognizer で部分的に対応可能か。

**MyDeck 優先**: 2 cards (Priest of Fell Rites, Fatestitcher)

#### 7. Embalm (702.128)

**CR 702.128a**:  
> "Embalm [cost]" means "[Cost], Exile this card from your graveyard: Create a token that's a copy of this card, except it's white, it has no mana cost, and it's a Zombie in addition to its other types. Activate only as a sorcery."

**Canonical form**:  
```
{cost}, Exile this card from your graveyard: Create a token that's a copy of this card, except it's white, it has no mana cost, and it's a Zombie in addition to its other types. Activate only as a sorcery.
```

**展開方針**: token-creation + copy + type-modification (white + Zombie)。複雑な変換ロジック。

#### 8. Eternalize (702.129)

**CR 702.129a**:  
> "Eternalize [cost]" means "[Cost], Exile this card from your graveyard: Create a token that's a copy of this card, except it's black, it's 4/4, it has no mana cost, and it's a Zombie in addition to its other types. Activate only as a sorcery."

**Canonical form**:  
```
{cost}, Exile this card from your graveyard: Create a token that's a copy of this card, except it's black, it's 4/4, it has no mana cost, and it's a Zombie in addition to its other types. Activate only as a sorcery.
```

**展開方針**: embalm と構造同一だが、固定化が多い(black, 4/4)。

#### 9. Ninjutsu (702.49)

**CR 702.49a**:  
> "Ninjutsu [cost]" means "[Cost], Reveal this card from your hand, Return an unblocked attacking creature you control to its owner's hand: Put this card onto the battlefield from your hand tapped and attacking."

**Canonical form**:  
```
{cost}, Reveal this card from your hand, Return an unblocked attacking creature you control to its owner's hand: Put this card onto the battlefield from your hand tapped and attacking.
```

**展開方針**: 複合コスト + hand-only restriction(既存 hand-state recognizer 必要) + 複数効果(reveal + return + put-into-battle)。複雑度高。

#### 10. Reconfigure (702.151)

**CR 702.151a**:  
> "Reconfigure represents two activated abilities. Reconfigure [cost] means '[Cost]: Attach this permanent to another target creature you control. Activate only as a sorcery' and '[Cost]: Unattach this permanent. Activate only if this permanent is attached to a creature and only as a sorcery.'"

**Canonical form**:  
```
{cost}: Attach this permanent to another target creature you control. Activate only as a sorcery.
{cost}: Unattach this permanent. Activate only if this permanent is attached to a creature and only as a sorcery.
```

**展開方針**: 2つの activated ability として展開(条件付き二重化)。detach の recognizer 新規必要。

#### 11. Monstrosity (701.37 — CR701, not 702)

**CR 701.37a**:  
> "Monstrosity N" means "If this permanent isn't monstrous, put N +1/+1 counters on it and it becomes monstrous."

**Canonical form**:  
```
If this permanent isn't monstrous, put N +1/+1 counters on it and it becomes monstrous.
```

**展開方針**: **action**(keyword ability ではなく keyword action)。CR702 の activated ability でなく、CR701 の action。既存 recognizer の対象外。monstrous 状態管理が必要。

#### 12. Adapt (701.46 — CR701, not 702)

**CR 701.46a**:  
> "Adapt N" means "If this permanent has no +1/+1 counters on it, put N +1/+1 counters on it."

**Canonical form**:  
```
If this permanent has no +1/+1 counters on it, put N +1/+1 counters on it.
```

**展開方針**: **action**(keyword ability ではなく keyword action)。CR701。条件チェック(no +1/+1 counters) + counter-placing。

**MyDeck 優先**: 1 card (Emperor of Bones)

---

## (c) 実装ポイント案とリスク

### I. 単一 Recognizer への流し込み vs 複数経路

**現況**: `src/engine/grammar/index.ts` の `splitAbilityLines` → `classifyAbilityShape`。

- **Line 148**: `splitAbilityLines(def)` で段落分割
- **Line 159**: `sanitizeLine(paragraph)` でリマインダー除去
- **Line 163-166**: `parsePureKeywordLine(text)` or `classifyAbilityShape(text, typeLine)`
- **Line 186-212**: `classifyAbilityShape` で形状判定
  - Line 191: `isActivatedAbilityLine(text)` ← **この関数が `:` を要求しているのが問題**
  - Line 251-268: `isActivatedAbilityLine` の実装 — コロンが無いと false

**提案**: 

**Option A (推奨・最小変更)**:  
`isActivatedAbilityLine` の前に canonical 変換層を挟む。

```
splitAbilityLines(def): AbilityLine[] {
  for (paragraph of ...) {
    const text = sanitizeLine(paragraph);
    // NEW: キーワード形 → canonical 変換
    const canonicalized = canonicalizeKeywordActivation(text, face.typeLine);
    const shape = canonicalized
      ? classifyAbilityShape(canonicalized, face.typeLine)
      : classifyAbilityShape(text, face.typeLine);
    lines.push({ faceIndex, text: canonicalized || text, shape });
  }
}
```

**Option B (高リスク・慎重)**:  
Separate recognizer path。equip/crew のように keyword-specific recognizer を各キーワードに用意。→ desync リスク大(ACT-1 教訓・naiveTapManaColors)。

**推奨**: **Option A**。canonicalizeKeywordActivation は**純粋関数**で、oracle text を入力として canonical form を返すのみ。

### II. Canonicalization 実装の位置と前後順序

#### sanitize との順序関係

```
oracle text
  ↓ [splitParagraphs]
paragraph (reminder text 付き、e.g., "Equip {2} (Equipment costs {2} more...)")
  ↓ [sanitizeLine = removeReminderAndQuotes + normalize]
core text (e.g., "Equip {2}")
  ↓ [canonicalizeKeywordActivation] ← NEW
canonical form (e.g., "{2}: Attach this permanent to target creature you control...")
  ↓ [classifyAbilityShape]
shape: 'activated'
```

**リスク**: reminder text 除去後のテキストで canonicalize する必要あり。括弧内の条件(`"Equip planeswalker"` 等)は reminder text 外にあるので注意(planeswalker/quality modifier は oracle text 本体の一部)。

#### 条件付きキーワード対応

e.g., "Equip {1} ({1}: Attach...)" は reminder なので除去済み。  
e.g., "Equip planeswalker {3}" は oracle text 本体 → canonicalize 時に detect 必要。

**提案**: canonicalizeKeywordActivation で、キーワード部分を regex で抽出してから展開。

### III. 各キーワードの Recognizer 実装案

#### Group 1: Equip/Fortify/Reconfigure (attach 系)

```typescript
function canonicalizeEquip(match: string, typeLine: string): string {
  // "Equip {2}" → "{2}: Attach this permanent to target creature you control..."
  const costMatch = match.match(/equip\s+(.*?)$/i);
  if (!costMatch) return null;
  const cost = costMatch[1].trim();
  
  // typeLine で Fortification を判定 → target 対象を変更
  const target = typeLine.includes('Fortification')
    ? 'target land you control'
    : 'target creature you control';
    
  return `${cost}: Attach this permanent to ${target}. Activate only as a sorcery.`;
}
```

**リスク**: "Equip planeswalker" → `target planeswalker you control` への変換必要。

#### Group 2: Counter 置き系 (level up, outlast, adapt, monstrosity)

```typescript
function canonicalizeCounterActivation(keyword: string, match: string): string {
  if (keyword === 'level-up') {
    const costMatch = match.match(/level\s+up\s+(.*?)$/i);
    const cost = costMatch?.[1] ?? '';
    return `${cost}: Put a level counter on this permanent. Activate only as a sorcery.`;
  }
  if (keyword === 'outlast') {
    const costMatch = match.match(/outlast\s+(.*?)$/i);
    const cost = costMatch?.[1] ?? '';
    return `${cost}, {T}: Put a +1/+1 counter on this creature. Activate only as a sorcery.`;
  }
  // ... etc
}
```

**リスク**: "level up" の cost 抽出で X 変数対応必要(e.g., "Level up {X}")。

#### Group 3: Graveyard activated (unearth, embalm, eternalize)

**複雑度**: 高。複合効果と zone 제限。

```typescript
function canonicalizeUnearth(match: string): string {
  // "Unearth {1G}" → "{1G}: Return this card from your graveyard..."
  const costMatch = match.match(/unearth\s+(.*?)$/i);
  const cost = costMatch?.[1] ?? '';
  return `${cost}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step. If it would leave the battlefield, exile it instead of putting it anywhere else. Activate only as a sorcery.`;
}
```

**リスク**: 詳細は oracle text を全文引用するため、カード個別の zone 遷移ロジックと同期する必要あり(oracle 本文が例外を含む場合)。

#### Group 4: Token creation (embalm, eternalize)

**複雑度**: 最高。token attributes 固定化 + copy-with-modifications。

```typescript
function canonicalizeEmbalm(match: string): string {
  const costMatch = match.match(/embalm\s+(.*?)$/i);
  const cost = costMatch?.[1] ?? '';
  return `${cost}, Exile this card from your graveyard: Create a token that's a copy of this card, except it's white, it has no mana cost, and it's a Zombie in addition to its other types. Activate only as a sorcery.`;
}
```

**リスク**: token 생성時 parent card의 특성을 copy → token 엔진이 copy-with-exceptions를 지원해야 함. 현재 infrastructure 확인 필수.

#### Group 5: Complex actions (ninjutsu, reconfigure)

**ninjutsu**:

```typescript
function canonicalizeNinjutsu(match: string): string {
  const costMatch = match.match(/(?:commander\s+)?ninjutsu\s+(.*?)$/i);
  const cost = costMatch?.[1] ?? '';
  return `${cost}, Reveal this card from your hand, Return an unblocked attacking creature you control to its owner's hand: Put this card onto the battlefield from your hand tapped and attacking.`;
}
```

**리스크**: hand restriction + battlefield entry state (tapped + attacking) の既存 infra 확인.

**reconfigure**:

Dual activation → 2 lines に展開。

```typescript
function canonicalizeReconfigure(match: string): string {
  const costMatch = match.match(/reconfigure\s+(.*?)$/i);
  const cost = costMatch?.[1] ?? '';
  return [
    `${cost}: Attach this permanent to another target creature you control. Activate only as a sorcery.`,
    `${cost}: Unattach this permanent. Activate only if this permanent is attached to a creature and only as a sorcery.`
  ];
}
```

**리스크**: unattach 상태 관리(attached-to gate). 조건부 activation(attached-to 상태 확인).

#### Group 6: Actions, not Abilities (adapt, monstrosity)

**현황**: CR701 의 action → 기존 702 activated ability recognizer의 대상이 아님.

**문제**: `isActivatedAbilityLine` 도 이들을 activated로 분류하지 않음(colon 없음).

**제안**: 분리된 경로 필요. 또는 canonicalize → activated form으로 변환.

```typescript
function canonicalizeAdapt(match: string): string {
  const nMatch = match.match(/adapt\s+(\d+|x|n)/i);
  const n = nMatch?.[1] ?? 'N';
  // Activate form으로 변환 불가(activation cost 없음, triggered-like)
  // → 다른 메커니즘 필요 (dedicated recognizer or state check)
  return null; // Fall back to manual or dedicated recognizer
}
```

**결론**: adapt/monstrosity는 canonicalization보다는 **별도 state 관리** 필요.

---

### IV. Existing Infrastructure 확인 요점

#### A. ACT-1 (b6400c0) 와의 상호작용

**ACT-1**: `mana ability` recognizer의 과잉 분류(naiveTapManaColors → cost 다항식).

**ACT-3 교훈**:
- splitAbilityLines 전단에 새로운 rewriting layer 추가 → desync 위험
- recognizer는 단일화 (option A 고수)

#### B. Existing equip/crew special handling

```bash
grep -n "equip\|crew" /Users/shumpeiabe/Desktop/MTG_OneDeck/src/engine/ -r
```

결과: `keywordGrammar.ts` 에서만 equip pattern (line 212-433).  
crew는 keyword definition only.

**확인**: src/engine의 다른 곳에 equip/crew 특수 처리 없음 → 단일 recognizer 방식 유지 안전.

#### C. Zone 제약 인프라

- unearth: graveyard-only activation
- embalm/eternalize: graveyard-only activation  
- ninjutsu: hand-only activation

**현황 확인 필수**: `GameState`의 zone 정보가 activation gate에 전달되는가?

#### D. Condition gate infrastructure

- outlast: sorcery-only
- unearth: sorcery-only
- All others: sorcery-only (또는 명시적 제약)

**현황**: 경고 수준(sandbox 철학) → enforce 불필요. 하지만 ability 메타에 기록 필요.

#### E. Token generation with modifications

- embalm: white, no-mana-cost, +Zombie
- eternalize: black, 4/4, no-mana-cost, +Zombie

**현황 확인 필수**: `create-token` 명령이 token exceptions을 지원하는가?

---

### V. 리스크 열거

| Risk | Impact | Mitigation |
|---|---|---|
| **Desync from recognizer** | HIGH | Canonical form은 oracle exact-quote만 사용. 테스트: golden-case 수동 验证 |
| **Zone restriction gate** | MEDIUM | unearth/embalm/eternalize/ninjutsu은 zone-only. GameCommand에 gate 통합 필요 |
| **Token copy-with-exceptions** | MEDIUM | embalm/eternalize의 복잡한 token 생성. 기존 create-token이 충분한가? |
| **Condition-gated activation** | MEDIUM | reconfigure unattach, adapt if-zero. State predicate 인프라 확인 |
| **Action vs Ability (adapt/monstrosity)** | MEDIUM | CR701 action → 702 activated ability와 다른 메커니즘. 별도 처리 필요 |
| **Revision chain (embalm/eternalize oracle changes)** | LOW | Oracle text 변경 시 canonicalization도 변경 필요. snapshot 종속성 문서화 |
| **X variables in cost** | MEDIUM | "Level up {X}" 같은 변수 비용 처리. 기존 {X} recognizer 호환성 확인 |
| **Planeswalker equip variant** | LOW | "Equip planeswalker {3}" → target planeswalker. 드물지만 별도 분기 필요 |

---

## (d) 기존 Equip/Crew 특수 처리 확인

```bash
grep -rn "equip\|crew" src/ --include="*.ts" | grep -v "node_modules\|test"
```

### 결과 (selected)

**keywordGrammar.ts**:
- Line 21: `{ id: 'equip', name: 'equip', label: '装備', ruleRef: '702.6' }`
- Line 152: `{ id: 'crew', name: 'crew', label: '搭乗', ruleRef: '702' }`
- Line 212-433: Equip pattern recognizer (EQUIP_MANA_COST_PATTERN 등)

**grammar/index.ts**:
- Line 251-268: `isActivatedAbilityLine` ← 콜론 요구

**status.ts**:
- Line (ATTACHMENT_TYPE_LINE_PATTERN): "Equipment" 감지만 (equip 특수 처리 아님)

**결론**: equip/crew는 **keyword definition만** 있고, 특수 recognizer 없음. parsing은 기존 activated-line recognizer에 의존.

---

## (e) Cycling (1fd84a3) 출시 후 교훈 및 간섭 확인

**출시**: commit 1fd84a3 (2026-07-14) — typecycling fail-closed화.

**확인**:
- cycling은 **손 제약 활성화**(hand-only)
- 전개: `{cost}, Discard this card: Draw a card.` (정확히는 cycle 비용으로 discard)
- **unearth도 유사**: graveyard-only → zone gate 필요

**간섭 유무**:
- cycling이 이미 단일 recognizer로 처리됨 → ACT-3도 같은 경로 안전
- discard-to-draw 패턴은 unearth와 다름 (unearth는 복합 효과)

---

## (f) 다음 단계 (implementation 시)

### Phase 1: Infrastructure 검증

1. **zone gate 확인**
   - GameCommand에 graveyard-only, hand-only gate 존재?
   - Or GameState에서 zone 확인 후 cost validation?

2. **Token 생성 capabilities**
   - create-token이 type/color 예외를 지원?
   - copy-with-exceptions의 oracle? Scryfall와의 동기화?

3. **Condition predicate infra**
   - `if attached`, `if no +1/+1 counters` 같은 activation 조건?

### Phase 2: Canonical form Golden Test Set

각 키워드별로 3-5개 카드의 oracle text → canonical form → recognizer 통과 → 수동 위 validation.

예시:
```
Card: Priest of Fell Rites
Oracle: "{T}, Pay 3 life, Sacrifice this creature: Return target creature card from your graveyard to the battlefield. Activate only as a sorcery."
Expected Keyword: unearth
Recognition: Actual: "{T}, Pay 3 life, Sacrifice... → Not pure-keyword format, but manual activated"
Status: **다른 메커니즘(custom cost 조합) → ACT-3 대상 아님**
```

### Phase 3: Implementation 순서

**권장 순서** (MyDeck 우선도 + 복잡도):

1. **unearth** (2 MyDeck cards, high demand 47)
2. **adapt** (1 MyDeck card, but action-type complexity)
3. **level up** (13 corpus, simple counter)
4. **outlast** (6 corpus, tap+counter)
5. **reconfigure** (17 corpus, dual-activation)
6. **ninjutsu** (30 corpus, complex state)
7. **embalm/eternalize** (4 each, token complexity)
8. **fortify** (1 corpus, equip variant)
9. **monstrosity/adapt as actions** (별도 판정)

---

## 결론 & 위험 정리

### 핵심 불확실성

1. **Graveyard/hand zone gate**: GameCommand/GameState에 내장?
2. **Token generation API**: copy-with-exceptions 지원?
3. **Action vs Ability**: adapt/monstrosity는 CR 상 "action"이지 "ability"가 아님 → 별도 메커니즘?

### 제안 범위 (ACT-3)

- **In**: 702 activated ability keywords (equip 제외・crew 제외)
- **Out**: CR701 actions (adapt, monstrosity) ← 별도 스라이스 또는 stat-machine integration

### 다음 판정자 회의 제안 항목

1. Zone gate infrastructure가 이미 있는가?
2. Token copy-with-exceptions이 가능한가?
3. Adapt/Monstrosity (CR701 actions)는 ACT-3에 포함할 것인가, 아니면 defer?

---

**Draft Date**: 2026-07-17  
**CR Grounding**: rule/Magic_The_Gathering_Comprehensive_Rules.txt (latest)  
**Scryfall Snapshot**: 2026-06-19, 17,491 cards  
**MyDeck Source**: /Mydeck/{Celes,Gogo,Kefka,Muldrotha}.txt  
