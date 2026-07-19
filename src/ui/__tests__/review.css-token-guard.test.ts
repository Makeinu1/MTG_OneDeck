import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * トークン期CSSの生カラー禁止ガード。判定者専有・実装エージェントは変更禁止。
 *
 * 由来: commit 7b2c5c1(多人数基盤)が game.css へ生hex 21箇所を追加し、
 * ライトテーマでセットアップ画面のフォーム全体が不可視(コントラスト 1.31:1・
 * 契約下限4.5:1)になった。規約は `src/ui/tokens.css:1-7` と
 * `docs/design-system.md:19`「新規CSSに生hex/px直書き禁止」として**存在していたが、
 * 自動チェックが皆無だった**。これがその backstop。
 *
 * なぜ効くか: テーマの門は `:root`(暗・既定)と `:root[data-theme='light']` の
 * 2つだけで、CSSに `@media (prefers-color-scheme)` は無い。ゆえに
 * **非トークン色はテーマ切替から構造的に不可視**=生カラー1つが即バグ。
 *
 * 対象の選び方(実測が設計を決めた): game.css の生カラーは事故ブロックを除くと
 * 実質1件のみ。tokens.css / index.css は**トークン層ゆえ除外**(literalはその仕事)。
 * App.css は strangler の未移行半分ゆえ除外し、`docs/design-system.md:19`
 * 「既存箇所は D-スライスで漸進置換」に従って別スライスで返済する(=言い訳でなく計画)。
 *
 * ⚠ コントラスト比そのものは**ここでは検証できない**。jsdom は cascade も var() も
 * color-mix() も解決せず、getComputedStyle は literal か空を返す。
 * **jsdom でコントラストを主張するテストは嘘**。実測は実機ブラウザ
 * (visual fixture の light/dark)でのみ行う。ここを「埋める」ために偽の
 * アサーションを足さないこと。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoSrc = path.resolve(here, '../..');

/** トークン期CSS = 生カラーを1つも増やしてはいけないファイル。 */
const GUARDED_FILES = [
  'components/game/game.css',
  'components/game/CardActionSheet.css',
  'dev/uxResearch/coverageDashboard.css',
  'dev/uxResearch/researchRecorder.css',
];

/**
 * 既知の未返済(内容で照合する=上部を編集しても行番号ずれで壊れない)。
 * 増やすときは「なぜトークンで表現できないか」を書くこと。
 */
const ALLOWLIST: readonly { file: string; contains: string; why: string }[] = [
  {
    file: 'components/game/game.css',
    contains: 'rgba(159, 212, 255, 0.52)',
    why: 'D2以前からの未返済。スタックのハイライト境界。別スライスでトークン化する。',
  },
];

/**
 * カラー値を取るプロパティだけを対象にする。
 * mask-image / filter などは **アルファチャンネルであってテーマ色ではない**
 * (game.css の `mask-image: linear-gradient(..., #000 ...)` が代表例)。
 * ここを区別しないとマスク8行が誤検知になり、ガードが「邪魔だから消される」=生存しない。
 */
const COLOR_PROPERTY = /^(color|background|background-color|background-image|border|border-[a-z-]+|outline|outline-color|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration-color|column-rule-color|--[\w-]+)$/;

/**
 * 生カラーの検出。hex / rgb() / hsl() に加えて **CSS 名前付き色**も捕まえる
 * (独立 Tier-1 が `background: white; color: tomato` を注入して素通りを実証したため
 *  2026-07-16 に追加。名前付き色もトークン外=テーマ切替から不可視なのは同じ)。
 * `transparent` / `currentColor` / `inherit` 等のキーワードは色リテラルではないので除く。
 */
const NAMED_COLORS = [
  'white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink',
  'gray', 'grey', 'brown', 'cyan', 'magenta', 'silver', 'gold', 'navy', 'teal',
  'olive', 'maroon', 'lime', 'aqua', 'fuchsia', 'beige', 'ivory', 'khaki',
  'salmon', 'tomato', 'coral', 'crimson', 'indigo', 'violet', 'tan', 'plum',
  'orchid', 'turquoise', 'lavender', 'wheat', 'snow', 'azure', 'linen',
];
const RAW_COLOR = new RegExp(
  '#[0-9a-fA-F]{3,8}\\b'
  + '|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\s*\\('
  + `|\\b(?:${NAMED_COLORS.join('|')})\\b`,
  'i',
);

/** `var(--gold)` の "gold" を名前付き色と誤検知しないため、トークン名を先に消す。 */
function stripTokenNames(value: string): string {
  return value.replace(/--[\w-]+/g, '');
}

interface Offense {
  file: string;
  line: number;
  prop: string;
  text: string;
}

function stripComments(css: string): string {
  // 行構造を保つため、コメント中の改行だけ残す。
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function scanRawColors(file: string): Offense[] {
  const css = stripComments(readFileSync(path.resolve(repoSrc, file), 'utf-8'));
  const offenses: Offense[] = [];

  // 宣言単位で走査する。旧実装は行単位split(';')だったため、プロパティ名と値が
  // 別行に分かれる複数行宣言(`--x:\n  linear-gradient(... rgb(...))`)を構造的に
  // 素通しした(2026-07-19 Tier-1 が実証)。値は `;`/`{`/`}` まで貪欲に取り、
  // 改行を含んでも1宣言として判定する。カスタムプロパティ値も対象
  // (生カラーを --x に隠して background: var(--x) で使う迂回の封鎖)。
  const declPattern = /(--[\w-]+|[a-zA-Z][-a-zA-Z]*)\s*:\s*([^;{}]*)/g;
  for (const match of css.matchAll(declPattern)) {
    const prop = match[1].toLowerCase();
    if (!COLOR_PROPERTY.test(prop)) continue;
    const value = match[2];
    // トークン識別子を先に除去する。これが無いと `var(--gold)` の中の "gold" が
    // 名前付き色として誤検知される(=正しくトークンを使っているコードを罰する)。
    if (!RAW_COLOR.test(stripTokenNames(value))) continue;
    const text = `${match[1]}: ${value.replace(/\s+/g, ' ').trim()}`;
    const allowed = ALLOWLIST.some(
      (entry) => entry.file === file && text.includes(entry.contains),
    );
    if (allowed) continue;
    const line = css.slice(0, match.index ?? 0).split('\n').length;
    offenses.push({ file, line, prop, text });
  }

  return offenses;
}

function formatOffenses(offenses: Offense[]): string {
  return offenses
    .map((o) => `  ${o.file}:${o.line}  [${o.prop}]  ${o.text}`)
    .join('\n');
}

describe('トークン期CSSの生カラー禁止(ライトテーマ回帰の backstop)', () => {
  for (const file of GUARDED_FILES) {
    it(`${file} はカラー値プロパティに生hex/rgb/hslを持たない`, () => {
      const offenses = scanRawColors(file);
      expect(
        offenses.length,
        offenses.length === 0
          ? ''
          : `生カラーはテーマ切替から不可視です。src/ui/tokens.css のトークンを参照してください。\n` +
            `半透明は color-mix(in srgb, var(--token) N%, transparent) を使います` +
            `(手本: game.css の .board-shelf__empty / .board-shelf__count)。\n` +
            formatOffenses(offenses),
      ).toBe(0);
    });
  }

  it('マスク/フィルタのアルファチャンネル(#000)と許可リストを誤検知しない', () => {
    // ガードが生存するための条件。誤検知が1つでもあれば次の人がガードを消す。
    // 実在確認: これらが game.css から消えたらこのテスト自体が無意味になるので先に固定する。
    const gameCss = readFileSync(path.resolve(repoSrc, 'components/game/game.css'), 'utf-8');
    expect(gameCss).toMatch(/mask-image:\s*linear-gradient\([^;]*#000/);
    expect(gameCss).toMatch(/filter:\s*drop-shadow\([^;]*rgb\(/);
    expect(gameCss).toContain('rgba(159, 212, 255, 0.52)');

    // 上の生カラーガードと違い「0件」ではなく「この種類を含まない」を主張する
    // (真の違反が残っていても、誤検知の有無だけを独立に判定できるようにするため)。
    const offenses = scanRawColors('components/game/game.css');
    expect(offenses.filter((o) => /mask|filter/.test(o.prop))).toEqual([]);
    expect(offenses.filter((o) => o.text.includes('rgba(159, 212, 255, 0.52)'))).toEqual([]);
    expect(offenses.filter((o) => o.text.includes('drop-shadow'))).toEqual([]);
  });

  it('許可リストは最小のまま(肥大したら返済スライスを切る合図)', () => {
    expect(ALLOWLIST.length).toBeLessThanOrEqual(2);
  });

  it('検出器の弁別: 複数行宣言とカスタムプロパティ値の生カラーも捕まえる(2026-07-19盲点封鎖)', () => {
    // 旧実装(行単位split)は「プロパティ名と値が別行」の宣言を素通しした。
    // scanRawColors と同じ宣言パターンで multi-line 形が1宣言に正規化されることを固定する。
    const multiline = 'a{\n  --sheen:\n    linear-gradient(180deg, rgb(255 255 255 / 38%), transparent);\n  box-shadow:\n    inset 0 0 0 1px var(--line),\n    0 14px 28px rgb(0 0 0 / 18%);\n}';
    const declPattern = /(--[\w-]+|[a-zA-Z][-a-zA-Z]*)\s*:\s*([^;{}]*)/g;
    const caught = [...multiline.matchAll(declPattern)]
      .filter((m) => COLOR_PROPERTY.test(m[1].toLowerCase()))
      .filter((m) => RAW_COLOR.test(stripTokenNames(m[2])))
      .map((m) => m[1]);
    expect(caught).toEqual(['--sheen', 'box-shadow']);
  });

  it('検出器の弁別: 生カラー(hex/rgb/名前付き)は捕まえ、トークン参照は罰しない', () => {
    // 独立 Tier-1(2026-07-16)が `background: white` の素通りを注入実証したため追加。
    const bad = [
      'color: #20221d',            // 事故った形
      'background: rgb(35 25 17 / 72%)',
      'background: white',         // 名前付き色(旧実装の盲点)
      'color: tomato',
      'border: 1px solid gray',
    ];
    for (const decl of bad) {
      const value = decl.slice(decl.indexOf(':') + 1);
      expect(RAW_COLOR.test(stripTokenNames(value)), `見逃した: ${decl}`).toBe(true);
    }
    // トークンを正しく使っているコードを罰してはいけない。
    // 特に var(--gold) は "gold" を含むため、素朴な名前付き色検出だと誤検知する。
    const good = [
      'color: var(--gold)',
      'background: var(--gold-bright)',
      'border-color: var(--surface-1)',
      'background: transparent',
      'color: inherit',
      'background: color-mix(in srgb, var(--surface-1) 72%, transparent)',
    ];
    for (const decl of good) {
      const value = decl.slice(decl.indexOf(':') + 1);
      expect(RAW_COLOR.test(stripTokenNames(value)), `誤検知: ${decl}`).toBe(false);
    }
  });
});

describe('color: inherit と固定背景の同居禁止(本当の失敗モード)', () => {
  /**
   * これが上の生カラーガードより価値が高い。トークン化しても
   * `color: inherit; background: var(--surface-1);` は生カラーガードを**通過するのに
   * 読めない**ことがある——実際に事故ったのはこの形:
   *   .opponent-setup { color: var(--text); }              ← トークン(ライトで濃紺へ反転)
   *   .opponent-setup button { color: inherit; background: #20221d; }  ← 背景は不動
   * つまり生hexガード単体では真因を捕まえられない。
   */
  /**
   * 透明な背景は**安全**であり誤検知にしてはいけない。
   * `color: inherit` + `background: transparent` は、文字が祖先の面の上に乗り、
   * その同じ祖先から色を継ぐ=対が保たれる(例: .status-band__mana-stepper > button)。
   * 危険なのは「不透明な背景を固定しつつ前景だけ継ぐ」形だけ。
   * 誤検知が1つでもあればガードは邪魔物として消される=生存しない。
   */
  const SAFE_BACKGROUND = /^\s*(transparent|none|inherit|initial|unset|revert)\s*$/;

  function inheritOnOpaqueBackground(css: string): string[] {
    const offenders: string[] = [];
    // 各規則ブロック { ... } を取り出して判定する。
    for (const match of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = match[1].trim().replace(/\s+/g, ' ');
      const body = match[2];
      const hasInheritColor = /(^|;)\s*color\s*:\s*inherit\s*(;|$)/.test(body);
      if (!hasInheritColor) continue;
      const opaqueBackground = [...body.matchAll(/(?:^|;)\s*background(?:-color|-image)?\s*:([^;]*)/g)]
        .some((bg) => !SAFE_BACKGROUND.test(bg[1]));
      if (opaqueBackground) offenders.push(selector);
    }
    return offenders;
  }

  it('検出器が本物の事故形を捕まえ、安全形は見逃す(弁別の実証)', () => {
    // 7b2c5c1 が実際に出荷した形(ライトで 1.31:1)。トークン化しても
    // 生カラーガードは通過するので、この検出器だけが真因を捕まえる。
    expect(inheritOnOpaqueBackground('.a { color: inherit; background: #20221d; }')).toEqual(['.a']);
    expect(inheritOnOpaqueBackground('.b { color: inherit; background: var(--surface-1); }')).toEqual(['.b']);
    // 安全形(誤検知にしてはいけない)。
    expect(inheritOnOpaqueBackground('.c { color: inherit; background: transparent; }')).toEqual([]);
    expect(inheritOnOpaqueBackground('.d { color: var(--text); background: var(--surface-1); }')).toEqual([]);
    expect(inheritOnOpaqueBackground('.e { color: inherit; }')).toEqual([]);
  });

  it('game.css のどの規則も color:inherit と「不透明な固定背景」を同時に宣言しない', () => {
    const offenders = inheritOnOpaqueBackground(
      readFileSync(path.resolve(repoSrc, 'components/game/game.css'), 'utf-8'),
    );
    expect(
      offenders,
      'color:inherit は背景と対で成立しません。前景と背景の両端を同じ規則で宣言してください' +
        '(例: color: var(--text); background: var(--surface-1); = design-system.md:69 が' +
        '≥4.5:1 を保証する唯一の対)。',
    ).toEqual([]);
  });
});
