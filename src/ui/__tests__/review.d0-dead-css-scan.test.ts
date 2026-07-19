import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * D0(地ならし)review pin: 死CSS/Unicode偽装アイコンの残存0を恒久化する
 * ソース走査アサーション。判定者専有・実装エージェントは変更禁止。
 */
const appCssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../App.css',
);
const appCss = readFileSync(appCssPath, 'utf-8');

describe('App.css 死CSS走査', () => {
  it('Unicode 偽装アイコン(.ti / .ti-*::before)が残存しない', () => {
    expect(appCss).not.toMatch(/\.ti\s*\{/);
    expect(appCss).not.toMatch(/\.ti-[a-z0-9-]+::before/);
    expect(appCss).not.toMatch(/\.ti::before/);
  });

  it('旧 Playmat UI 由来の死CSSファミリが App.css に残存しない(2026-07-19 一掃・恒久 pin)', () => {
    // 旧 Playmat + 周辺12ファイル削除で死んだ CSS ファミリ。新UIの盤面CSSは
    // src/components/game/game.css の別名前空間(hand-ribbon*/stack-band/stack-workspace*)
    // ゆえ、以下は App.css から完全に消えているのが正。パターンは**生存クラスを誤検出しない**
    // ように境界を切る:
    //   - .hand__/.stack__ と bare .hand/.stack は死。だが .hand-ribbon/.hand-card/
    //     .stack-band/.stack-workspace(ハイフン形)は生存ゆえ (?![\w-]) で除外する。
    //   - 他ファミリ(playmat/battlefield/zones/zone-card/game-log/other-actions/
    //     match-controls/mobile-zone-swap/mobile-controls-drawer)は同名で始まる生存クラスが
    //     無いので root ごと不在アサート。
    const deadPatterns: Array<[RegExp, string]> = [
      [/\.playmat[\s.,:{>+~[]/, '.playmat*'],
      [/\.hand__/, '.hand__*'],
      [/\.hand(?![\w-])/, 'bare .hand'],
      [/\.stack__/, '.stack__*'],
      [/\.stack(?![\w-])/, 'bare .stack'],
      [/\.mobile-zone-swap/, '.mobile-zone-swap*'],
      [/\.mobile-controls-drawer/, '.mobile-controls-drawer*'],
      [/\.battlefield/, '.battlefield*'],
      [/\.zones/, '.zones*'],
      [/\.zone-card/, '.zone-card*'],
      [/\.game-log/, '.game-log*'],
      [/\.other-actions/, '.other-actions*'],
      [/\.match-controls/, '.match-controls*'],
    ];
    for (const [re, label] of deadPatterns) {
      expect(re.test(appCss), `${label} が App.css に残存している`).toBe(false);
    }
  });

  it('生存クラスを死パターンが誤って巻き込まない(over-purge 防止)', () => {
    // 反証: これらが App.css から消えていたら purge が生存スタイルを削った証拠になる。
    // .card-view--hand は "hand" を含むが .hand パターン(ドット直前 hand を要求)には
    // 掛からず生存すべき最重要ケース。他は「file が丸ごと削られていない」アンカー。
    // (.hand-ribbon/.stack-band 等の新盤面CSSは App.css でなく game.css 側ゆえここでは見ない)
    for (const alive of ['.card-view--hand', '.card-view {', '.phase-track', '.mana-pool', '.saved-deck']) {
      expect(appCss.includes(alive), `${alive} が誤って除去された疑い`).toBe(true);
    }
  });

  it('新アイコンラッパークラス(.icon)は存在する', () => {
    expect(appCss).toMatch(/\.icon\s*\{/);
  });
});
