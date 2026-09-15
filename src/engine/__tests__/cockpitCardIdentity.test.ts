import { expect, it } from 'vitest';
import { createCockpitTable } from '../cockpitTable';
import { makeDeck } from './helpers';

function displayVariant<T extends ReturnType<typeof makeDeck>>(deck: T): T {
  return deck.map((entry, index) => ({
    ...entry,
    def: {
      ...(Object.fromEntries(Object.entries(entry.def).reverse()) as typeof entry.def),
      printedName: `日本語表示 ${index}`,
      lang: 'ja' as const,
      faces: entry.def.faces.map((face) => ({
        ...face,
        printedText: '表示専用テキスト',
        imageUrl: `https://example.invalid/card-${index}.png`,
      })),
    },
  })) as T;
}

it('uses rule identity during initial table creation and keeps the first accepted presentation', () => {
  const original = makeDeck(12);
  const localized = displayVariant(structuredClone(original));
  const table = createCockpitTable(original, 1, [original, localized]);
  const id = original[0].def.scryfallId;

  expect(table.seats[0].zones.hand).toHaveLength(7);
  expect(table.seats[1].zones.hand).toHaveLength(7);
  expect(table.defs[id]).toEqual(original[0].def);
});

it('accepts display-only duplicate variants in one input but rejects genuine rule changes', () => {
  const original = makeDeck(12);
  const localized = displayVariant(structuredClone(original));
  const mixed = [original[0], localized[0], ...original.slice(1)];
  expect(() => createCockpitTable(mixed, 1)).not.toThrow();

  const conflict = displayVariant(structuredClone(original));
  conflict[0].def.faces[0].oracleText = 'Draw a card.';
  expect(() => createCockpitTable(original, 1, [original, conflict])).toThrow(
    '同じカードIDの定義が一致しません。',
  );
});
