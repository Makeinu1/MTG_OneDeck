import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardDef } from '../../types/card';
import {
  createDeckFingerprint,
  deleteSavedDeck,
  expandSavedDeck,
  listSavedDecks,
  renameSavedDeck,
  saveResolvedDeck,
  updateSavedDeckEntries,
  type SavedDeckEntry,
} from '../savedDecks';

function card(id: string, name: string, colorIdentity: string[] = []): CardDef {
  return {
    scryfallId: `scryfall-${id}`,
    oracleId: `oracle-${id}`,
    name,
    printedName: `${name}・日本語`,
    lang: 'ja',
    layout: 'normal',
    cmc: 1,
    colorIdentity,
    typeLine: 'Legendary Creature',
    faces: [{ name, printedName: `${name}・日本語`, typeLine: 'Legendary Creature' }],
  };
}

const commander = card('commander', 'Commander', ['U']);
const spell = card('spell', 'Spell', ['R']);

function entries(spellQuantity = 2): SavedDeckEntry[] {
  return [
    { card: commander, quantity: 1, section: 'commander' },
    { card: spell, quantity: spellQuantity, section: 'main' },
  ];
}

beforeEach(async () => {
  vi.useRealTimers();
  for (const deck of await listSavedDecks()) {
    await deleteSavedDeck(deck.id);
  }
  localStorage.clear();
});

describe('saved deck storage', () => {
  it('creates, lists, expands, and deletes a deck', async () => {
    const result = await saveResolvedDeck({ deckText: 'deck text', entries: entries() });

    expect(result.operation).toBe('created');
    expect(result.deck.name).toBe('Commander・日本語');
    expect(await listSavedDecks()).toEqual([result.deck]);
    expect(expandSavedDeck(result.deck)).toHaveLength(3);
    expect(expandSavedDeck(result.deck)[0]).toMatchObject({ isCommander: true });

    await deleteSavedDeck(result.deck.id);
    expect(await listSavedDecks()).toEqual([]);
  });

  it('deduplicates a newly parsed deck by normalized fingerprint', async () => {
    const first = await saveResolvedDeck({ deckText: 'first formatting', entries: entries() });
    const second = await saveResolvedDeck({
      deckText: 'different formatting',
      entries: [...entries()].reverse(),
    });

    expect(createDeckFingerprint(entries())).toBe(createDeckFingerprint([...entries()].reverse()));
    expect(second.operation).toBe('updated');
    expect(second.deck.id).toBe(first.deck.id);
    expect(second.deck.deckText).toBe('different formatting');
    expect(await listSavedDecks()).toHaveLength(1);
  });

  it('updates the selected deck and preserves its custom name', async () => {
    const created = await saveResolvedDeck({ deckText: 'v1', entries: entries() });
    const renamed = await renameSavedDeck(created.deck.id, '  青赤コンボ  ');
    const updated = await saveResolvedDeck({
      deckText: 'v2',
      entries: entries(3),
      existingDeckId: created.deck.id,
    });

    expect(renamed.name).toBe('青赤コンボ');
    expect(updated.operation).toBe('updated');
    expect(updated.deck.name).toBe('青赤コンボ');
    expect(updated.deck.nameMode).toBe('custom');
    expect(expandSavedDeck(updated.deck)).toHaveLength(4);
  });

  it('rejects empty or overlong names', async () => {
    const created = await saveResolvedDeck({ deckText: 'v1', entries: entries() });

    await expect(renameSavedDeck(created.deck.id, '   ')).rejects.toThrow('1〜60文字');
    await expect(renameSavedDeck(created.deck.id, 'a'.repeat(61))).rejects.toThrow('1〜60文字');
  });

  it('repairs stored display data without changing user-facing recency', async () => {
    const created = await saveResolvedDeck({ deckText: 'v1', entries: entries() });
    const repairedEntries = entries().map((entry) => entry.card.oracleId === spell.oracleId
      ? { ...entry, card: { ...entry.card, printedName: '修復済みカード' } }
      : entry);
    const repaired = await updateSavedDeckEntries(created.deck.id, repairedEntries);

    expect(repaired.updatedAt).toBe(created.deck.updatedAt);
    expect(repaired.entries.find((entry) => entry.card.oracleId === spell.oracleId)?.card.printedName)
      .toBe('修復済みカード');
  });
});
