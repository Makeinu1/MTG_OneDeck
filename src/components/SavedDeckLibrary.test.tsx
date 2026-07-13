import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SavedDeck } from '../data/savedDecks';
import { SavedDeckLibrary } from './SavedDeckLibrary';

const deck: SavedDeck = {
  schemaVersion: 1,
  id: 'deck-1',
  name: '青い統率者デッキ',
  nameMode: 'custom',
  deckText: 'Commander\n1 Commander',
  entries: [{
    quantity: 1,
    section: 'commander',
    card: {
      scryfallId: 'card-1',
      oracleId: 'oracle-1',
      name: 'Commander',
      printedName: '統率者',
      lang: 'ja',
      layout: 'normal',
      cmc: 2,
      colorIdentity: ['U'],
      typeLine: 'Legendary Creature',
      faces: [{ name: 'Commander', printedName: '統率者', typeLine: 'Legendary Creature' }],
    },
  }],
  fingerprint: 'fingerprint',
  createdAt: 1,
  updatedAt: 1,
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderLibrary(callbacks: {
  onOpen?: (value: SavedDeck) => void;
  onRename?: (value: SavedDeck, name: string) => Promise<void>;
  onDelete?: (value: SavedDeck) => Promise<void>;
} = {}): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <SavedDeckLibrary
        decks={[deck]}
        onOpen={callbacks.onOpen ?? (() => {})}
        onNew={() => {}}
        onRename={callbacks.onRename ?? (async () => {})}
        onDelete={callbacks.onDelete ?? (async () => {})}
      />,
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.querySelectorAll('.modal-backdrop').forEach((element) => element.remove());
  root = null;
  container = null;
});

describe('SavedDeckLibrary', () => {
  it('opens a selected deck with an explicit button', () => {
    const onOpen = vi.fn();
    const view = renderLibrary({ onOpen });

    act(() => view.querySelector<HTMLButtonElement>('[data-testid="open-saved-deck-deck-1"]')?.click());
    expect(onOpen).toHaveBeenCalledWith(deck);
  });

  it('renames a deck from the modal', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const view = renderLibrary({ onRename });
    act(() => view.querySelector<HTMLButtonElement>('[data-testid="rename-saved-deck-deck-1"]')?.click());
    const input = document.querySelector<HTMLInputElement>('[data-testid="rename-deck-input"]');
    if (!input) throw new Error('rename input not found');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '新しい名前');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="rename-deck-confirm"]')?.click();
      await Promise.resolve();
    });

    expect(onRename).toHaveBeenCalledWith(deck, '新しい名前');
  });

  it('requires confirmation before deleting a deck', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const view = renderLibrary({ onDelete });
    act(() => view.querySelector<HTMLButtonElement>('[data-testid="delete-saved-deck-deck-1"]')?.click());
    expect(onDelete).not.toHaveBeenCalled();

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="delete-deck-confirm"]')?.click();
      await Promise.resolve();
    });
    expect(onDelete).toHaveBeenCalledWith(deck);
  });
});
