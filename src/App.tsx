import { useState } from 'react';
import './App.css';
import { ImportScreen } from './components/ImportScreen';
import { Playmat } from './components/playmat/Playmat';
import { useGameStore } from './store/gameStore';
import type { InitDeckCard } from './engine/init';
import type { CardDef } from './types/card';

const DECK_TEXT_KEY = 'mtg-onedeck:deck-text';
const DECK_CARDS_KEY = 'mtg-onedeck:deck-cards';

interface StoredDeckCard {
  def: CardDef;
  isCommander: boolean;
}

function loadStoredDeck(): { deckText: string; storedDeck: InitDeckCard[] | null } {
  try {
    const deckText = localStorage.getItem(DECK_TEXT_KEY) ?? '';
    const rawCards = localStorage.getItem(DECK_CARDS_KEY);
    if (!rawCards) return { deckText, storedDeck: null };
    const parsed: unknown = JSON.parse(rawCards);
    if (!Array.isArray(parsed)) return { deckText, storedDeck: null };
    const storedDeck = parsed as StoredDeckCard[];
    return { deckText, storedDeck };
  } catch {
    return { deckText: '', storedDeck: null };
  }
}

function App() {
  const state = useGameStore((s) => s.state);
  const [{ deckText, storedDeck }] = useState(() => loadStoredDeck());

  const handleStart = (deck: InitDeckCard[], text: string): void => {
    try {
      localStorage.setItem(DECK_TEXT_KEY, text);
      localStorage.setItem(DECK_CARDS_KEY, JSON.stringify(deck));
    } catch {
      // localStorage unavailable (private mode, quota, etc.) - continue without persistence.
    }
    useGameStore.getState().newGame(deck);
  };

  if (state) {
    return <Playmat />;
  }

  return (
    <div className="app">
      <ImportScreen initialDeckText={deckText} onStart={handleStart} />
      {storedDeck && storedDeck.length > 0 && (
        <div className="app__resume">
          <p>前回インポートしたデッキが見つかりました。再インポートせずにゲームを開始できます。</p>
          <button
            type="button"
            className="btn btn--accent"
            data-testid="resume-game"
            onClick={() => useGameStore.getState().newGame(storedDeck)}
          >
            前回のデッキでゲーム開始
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
