import { useEffect, useState } from 'react';
import './App.css';
import { ImportScreen } from './components/ImportScreen';
import { RotateNotice } from './components/RotateNotice';
import { Playmat } from './components/playmat/Playmat';
import { GameScreen } from './components/game/GameScreen';
import { loadSnapshot, type GameSnapshot } from './data/gameSnapshot';
import { loadKeybindings, type KeybindingsMap } from './data/keybindings';
import { useGameStore } from './store/gameStore';
import type { InitDeckCard } from './engine/init';
import type { CardDef } from './types/card';

const DECK_TEXT_KEY = 'mtg-onedeck:deck-text';
const DECK_CARDS_KEY = 'mtg-onedeck:deck-cards';

/**
 * ゲーム画面の描画先。既定=新レイアウト GameScreen(D2・縦持ち第一級)。
 * VITE_UI_V2_LAYOUT=false で旧 Playmat+RotateNotice へ即時ロールバック
 * (docs/ui-architecture-v2.md §4 strangler)。関数化して描画時に env を読む(テスト両値可)。
 */
function isV2LayoutEnabled(): boolean {
  return import.meta.env.VITE_UI_V2_LAYOUT !== 'false';
}

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
  const [keybindings, setKeybindings] = useState<KeybindingsMap>(() => loadKeybindings());
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadSnapshot().then((loadedSnapshot) => {
      if (cancelled) return;
      setSnapshot(loadedSnapshot?.state ? loadedSnapshot : null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (isV2LayoutEnabled()) {
      // D2: 縦持ち第一級の新レイアウト(RotateNotice なし=縦持ちの壁を撤去)。
      return <GameScreen keybindings={keybindings} />;
    }
    // ロールバック経路: 旧 Playmat(横/デスクトップ既存挙動)+ RotateNotice。
    return (
      <div className="playmat-shell">
        <div className="playmat-shell__game">
          <Playmat keybindings={keybindings} />
        </div>
        <RotateNotice />
      </div>
    );
  }

  return (
    <div className="app">
      <ImportScreen
        initialDeckText={deckText}
        onStart={handleStart}
        keybindings={keybindings}
        onKeybindingsChange={setKeybindings}
      />
      {snapshot?.state && (
        <div className="app__resume">
          <p>中断したゲームが見つかりました。</p>
          <button
            type="button"
            className="btn btn--accent"
            data-testid="restore-game"
            onClick={() => useGameStore.getState().restoreGame(snapshot)}
          >
            ゲームを再開
          </button>
        </div>
      )}
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
