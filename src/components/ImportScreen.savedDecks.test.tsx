import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SavedDeck,
  SaveResolvedDeckInput,
  SaveResolvedDeckResult,
} from '../data/savedDecks';
import type { DeckEntry } from '../data/deckParser';
import type { ResolveResult } from '../data/scryfall';
import type { CardDef } from '../types/card';
import { DEFAULT_KEYBINDINGS } from '../data/keybindings';
import { ImportScreen } from './ImportScreen';

const mocks = vi.hoisted(() => ({
  resolveDeck: vi.fn<(entries: DeckEntry[]) => Promise<ResolveResult>>(),
  saveResolvedDeck: vi.fn<(input: SaveResolvedDeckInput) => Promise<SaveResolvedDeckResult>>(),
  requestPersistentStorageOnce: vi.fn<() => Promise<void>>(),
}));

vi.mock('../data/scryfall', () => ({
  resolveDeck: mocks.resolveDeck,
}));

vi.mock('../data/savedDecks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/savedDecks')>();
  return {
    ...actual,
    saveResolvedDeck: mocks.saveResolvedDeck,
    requestPersistentStorageOnce: mocks.requestPersistentStorageOnce,
  };
});

function card(id: string, name: string): CardDef {
  return {
    scryfallId: id,
    oracleId: `oracle-${id}`,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    colorIdentity: [],
    typeLine: 'Legendary Creature',
    faces: [{ name, typeLine: 'Legendary Creature' }],
  };
}

const commander = card('commander', 'Commander');
const spell = card('spell', 'Spell');
const resolved = new Map([
  ['Commander', commander],
  ['Spell', spell],
]);
const savedDeck: SavedDeck = {
  schemaVersion: 1,
  id: 'deck-1',
  name: 'Commander',
  nameMode: 'auto',
  deckText: 'Commander\n1 Commander\nDeck\n1 Spell',
  entries: [
    { card: commander, quantity: 1, section: 'commander' },
    { card: spell, quantity: 1, section: 'main' },
  ],
  fingerprint: 'fingerprint',
  createdAt: 1,
  updatedAt: 1,
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderScreen(options: {
  initialSavedDeck?: SavedDeck | null;
  onStart?: () => void;
  onDeckSaved?: (deck: SavedDeck) => void;
} = {}): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <ImportScreen
        initialDeckText=""
        initialSavedDeck={options.initialSavedDeck}
        onStart={options.onStart ?? (() => {})}
        onDeckSaved={options.onDeckSaved}
        keybindings={{ ...DEFAULT_KEYBINDINGS }}
        onKeybindingsChange={() => {}}
      />,
    );
  });
  return container;
}

function enterDeckText(view: HTMLDivElement, text: string): void {
  const textarea = view.querySelector<HTMLTextAreaElement>('[data-testid="deck-input"]');
  if (!textarea) throw new Error('deck input not found');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickImport(view: HTMLDivElement): Promise<void> {
  const button = view.querySelector<HTMLButtonElement>('[data-testid="import-button"]');
  if (!button) throw new Error('import button not found');
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
}

beforeEach(() => {
  mocks.resolveDeck.mockReset();
  mocks.saveResolvedDeck.mockReset();
  mocks.requestPersistentStorageOnce.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('ImportScreen saved decks', () => {
  it('automatically saves a completely resolved deck', async () => {
    mocks.resolveDeck.mockResolvedValue({ resolved, unresolved: [] });
    mocks.saveResolvedDeck.mockResolvedValue({ deck: savedDeck, operation: 'created' });
    const onDeckSaved = vi.fn();
    const view = renderScreen({ onDeckSaved });

    enterDeckText(view, savedDeck.deckText);
    await clickImport(view);

    expect(mocks.saveResolvedDeck).toHaveBeenCalledOnce();
    const savedInput = mocks.saveResolvedDeck.mock.calls[0]?.[0];
    expect(savedInput?.deckText).toBe(savedDeck.deckText);
    expect(savedInput?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ card: commander, section: 'commander' }),
      expect.objectContaining({ card: spell, section: 'main' }),
    ]));
    expect(onDeckSaved).toHaveBeenCalledWith(savedDeck);
    expect(view.querySelector('[data-testid="deck-save-status"]')?.textContent).toContain('保存しました');
  });

  it('does not save when a card is unresolved', async () => {
    mocks.resolveDeck.mockResolvedValue({
      resolved: new Map([['Commander', commander]]),
      unresolved: [{ name: 'Spell', line: 4, reason: 'not found' }],
    });
    const view = renderScreen();

    enterDeckText(view, savedDeck.deckText);
    await clickImport(view);

    expect(mocks.saveResolvedDeck).not.toHaveBeenCalled();
    expect(view.querySelector('[data-testid="start-game"]')).toBeNull();
    expect(view.querySelector('[data-testid="import-button"]')?.textContent).toContain('再解析');
  });

  it('opens a saved deck ready to play without resolving it again', () => {
    const onStart = vi.fn();
    const view = renderScreen({ initialSavedDeck: savedDeck, onStart });
    const start = view.querySelector<HTMLButtonElement>('[data-testid="start-game"]');

    expect(start?.disabled).toBe(false);
    act(() => start?.click());
    expect(mocks.resolveDeck).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('keeps the game start available when browser storage fails', async () => {
    mocks.resolveDeck.mockResolvedValue({ resolved, unresolved: [] });
    mocks.saveResolvedDeck.mockRejectedValue(new Error('quota'));
    const view = renderScreen();

    enterDeckText(view, savedDeck.deckText);
    await clickImport(view);

    expect(view.querySelector('[role="alert"]')?.textContent).toContain('保存できませんでした');
    expect(view.querySelector<HTMLButtonElement>('[data-testid="start-game"]')?.disabled).toBe(false);
  });
});
