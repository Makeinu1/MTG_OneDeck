import { describe, it, expect } from 'vitest';
import { usableImageUrl, mapScryfallCardToCardDef, applyJapanesePrint, type ScryfallCard } from '../scryfall';

/**
 * D0(地ならし)review pin: 画像フォールバック順序(jp→en→text)の純関数契約。
 * Scryfall は image_status:"placeholder" のとき、resolvable な URL を返しつつ
 * 実体は汎用の代替画像("Localized Image Not Available" 相当)を返す
 * (2026-07-10 実API裏取り: lang:ja set:mid の基本土地で確認済み)。
 * 判定者専有・実装エージェントは変更禁止。
 */
describe('usableImageUrl (入力表)', () => {
  const cases: Array<{
    name: string;
    status: ScryfallCard['image_status'];
    url: string | undefined;
    expected: string | undefined;
  }> = [
    { name: 'highres_scan + url → 採用', status: 'highres_scan', url: 'https://x/img.jpg', expected: 'https://x/img.jpg' },
    { name: 'lowres + url → 採用(低解像度は許容)', status: 'lowres', url: 'https://x/img.jpg', expected: 'https://x/img.jpg' },
    { name: 'placeholder + url → 不採用(代替画像を弾く)', status: 'placeholder', url: 'https://x/img.jpg', expected: undefined },
    { name: 'missing + url → 不採用', status: 'missing', url: 'https://x/img.jpg', expected: undefined },
    { name: 'highres_scan + url無し → undefined', status: 'highres_scan', url: undefined, expected: undefined },
    { name: 'status未定義 + url → 採用(旧データ互換)', status: undefined, url: 'https://x/img.jpg', expected: 'https://x/img.jpg' },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(usableImageUrl(c.status, c.url)).toBe(c.expected);
    });
  }
});

function baseCard(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: 'id-en',
    oracle_id: 'oracle-1',
    name: 'Forest',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    color_identity: [],
    type_line: 'Basic Land — Forest',
    image_uris: { normal: 'https://example.com/en-forest.jpg' },
    image_status: 'highres_scan',
    ...overrides,
  };
}

describe('jp→en→text フォールバックチェーン', () => {
  it('JP画像が使える場合はJP画像を採用する', () => {
    const en = mapScryfallCardToCardDef(baseCard());
    const ja = baseCard({
      id: 'id-ja',
      lang: 'ja',
      image_uris: { normal: 'https://example.com/ja-forest.jpg' },
      image_status: 'highres_scan',
    });
    const merged = applyJapanesePrint(en, ja);
    expect(merged.faces[0].imageUrl).toBe('https://example.com/ja-forest.jpg');
  });

  it('JP画像が placeholder の場合はEN画像へフォールバックする', () => {
    const en = mapScryfallCardToCardDef(baseCard());
    const ja = baseCard({
      id: 'id-ja',
      lang: 'ja',
      image_uris: { normal: 'https://example.com/ja-placeholder.jpg' },
      image_status: 'placeholder',
    });
    const merged = applyJapanesePrint(en, ja);
    expect(merged.faces[0].imageUrl).toBe('https://example.com/en-forest.jpg');
  });

  it('JPもENも使えない場合は imageUrl が undefined になる(CardView側のテキストfallbackへ委譲)', () => {
    const en = mapScryfallCardToCardDef(baseCard({ image_status: 'missing', image_uris: undefined }));
    const ja = baseCard({
      id: 'id-ja',
      lang: 'ja',
      image_uris: { normal: 'https://example.com/ja-placeholder.jpg' },
      image_status: 'placeholder',
    });
    const merged = applyJapanesePrint(en, ja);
    expect(merged.faces[0].imageUrl).toBeUndefined();
  });
});
