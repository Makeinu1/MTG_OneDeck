import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { ImportScreen } from './components/ImportScreen';
import { GameScreen } from './components/game/GameScreen';
import { startAudioForGameGesture } from './components/game/presentation/AudioVisualProvider';
import { OpponentSetupScreen } from './components/game/OpponentSetupScreen';
import { Modal } from './components/Modal';
import { SavedDeckLibrary } from './components/SavedDeckLibrary';
import { loadSnapshot, type GameSnapshot } from './data/gameSnapshot';
import { loadKeybindings, type KeybindingsMap } from './data/keybindings';
import {
  deleteSavedDeck,
  entriesFromExpandedDeck,
  listSavedDecks,
  renameSavedDeck,
  saveResolvedDeck,
  updateSavedDeckEntries,
  type SavedDeck,
} from './data/savedDecks';
import { needsJapaneseDisplayRefresh, refreshJapaneseCardDefs } from './data/scryfall';
import { useGameStore } from './store/gameStore';
import type { InitDeckCard } from './engine/init';
import type { CardDef } from './types/card';

const DECK_TEXT_KEY = 'mtg-onedeck:deck-text';
const DECK_CARDS_KEY = 'mtg-onedeck:deck-cards';

interface StoredDeckCard {
  def: CardDef;
  isCommander: boolean;
}

export function FanContentNotice() {
  return (
    <footer className="app__fan-content" data-testid="fan-content-notice">
      <p>
        {'このコンテンツは、ウィザーズ・オブ・ザ・コーストのファンコンテンツ・ポリシーに沿った非公式のファンコンテンツです。'}
        {'ウィザーズ・オブ・ザ・コースト社の認可・許諾を受けたものではありません。'}
        {'題材の一部にWizards of the Coast LLCの財産が含まれています。© Wizards of the Coast LLC.'}
      </p>
    </footer>
  );
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
  const [{ deckText: legacyDeckText, storedDeck: legacyDeck }] = useState(() => loadStoredDeck());
  const [keybindings, setKeybindings] = useState<KeybindingsMap>(() => loadKeybindings());
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<SavedDeck | null>(null);
  const [legacyFallback, setLegacyFallback] = useState(legacyDeck !== null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [gameView, setGameView] = useState<'game' | 'opponent-setup'>('game');
  const [pendingDeck, setPendingDeck] = useState<SavedDeck | 'new' | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const localizationRefreshKey = useRef('');

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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let decks: SavedDeck[] = [];
      try {
        decks = await listSavedDecks();
        if (legacyDeck && legacyDeck.length > 0) {
          const migrated = await saveResolvedDeck({
            deckText: legacyDeckText,
            entries: entriesFromExpandedDeck(legacyDeck),
          });
          try {
            localStorage.removeItem(DECK_TEXT_KEY);
            localStorage.removeItem(DECK_CARDS_KEY);
          } catch {
            // IndexedDB already owns the deck; stale legacy keys are harmless.
          }
          decks = await listSavedDecks();
          if (!cancelled) {
            setLegacyFallback(false);
            setSelectedDeck(migrated.deck);
          }
        } else if (!cancelled && decks.length > 0) {
          setSelectedDeck(decks[0]);
        }
      } catch {
        // Preserve the legacy quick-start path when migration or IndexedDB fails.
      } finally {
        if (!cancelled) {
          setSavedDecks(decks);
          setLibraryReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [legacyDeck, legacyDeckText]);

  useEffect(() => {
    if (!libraryReady) return;
    const incompleteCards = savedDecks.flatMap((deck) =>
      deck.entries
        .map((entry) => entry.card)
        .filter(needsJapaneseDisplayRefresh),
    );
    if (incompleteCards.length === 0) return;
    const refreshKey = [...new Set(incompleteCards.map((card) => card.oracleId))]
      .sort((a, b) => a.localeCompare(b))
      .join('|');
    if (localizationRefreshKey.current === refreshKey) return;
    localizationRefreshKey.current = refreshKey;

    void refreshJapaneseCardDefs(incompleteCards)
      .then(async (refreshed) => {
        if (refreshed.size === 0) return;
        const updatedDecks: SavedDeck[] = [];
        for (const deck of savedDecks) {
          let changed = false;
          const entries = deck.entries.map((entry) => {
            const localized = refreshed.get(entry.card.oracleId);
            if (!localized) return entry;
            changed = true;
            return { ...entry, card: localized };
          });
          if (changed) updatedDecks.push(await updateSavedDeckEntries(deck.id, entries));
        }
        if (updatedDecks.length === 0) return;
        const byId = new Map(updatedDecks.map((deck) => [deck.id, deck]));
        setSavedDecks((current) => current.map((deck) => byId.get(deck.id) ?? deck));
      })
      .catch(() => {
        // Offline use remains available with the stored display data.
      });
  }, [libraryReady, savedDecks]);

  const handleStart = (deck: InitDeckCard[]): void => {
    startAudioForGameGesture();
    useGameStore.getState().newGame(deck);
  };

  const handleDeckSaved = useCallback((deck: SavedDeck): void => {
    setSavedDecks((current) => [deck, ...current.filter((item) => item.id !== deck.id)]
      .sort((a, b) => b.updatedAt - a.updatedAt));
    setSelectedDeck(deck);
    setLegacyFallback(false);
    setEditorDirty(false);
  }, []);

  const performDeckSwitch = useCallback((next: SavedDeck | 'new'): void => {
    setSelectedDeck(next === 'new' ? null : next);
    setEditorDirty(false);
    setEditorVersion((version) => version + 1);
    setPendingDeck(null);
  }, []);

  const requestDeckSwitch = useCallback((next: SavedDeck | 'new'): void => {
    if (next !== 'new' && next.id === selectedDeck?.id) return;
    if (editorDirty) {
      setPendingDeck(next);
      return;
    }
    performDeckSwitch(next);
  }, [editorDirty, performDeckSwitch, selectedDeck?.id]);

  const handleRename = useCallback(async (deck: SavedDeck, name: string): Promise<void> => {
    const renamed = await renameSavedDeck(deck.id, name);
    setSavedDecks((current) => current
      .map((item) => item.id === renamed.id ? renamed : item)
      .sort((a, b) => b.updatedAt - a.updatedAt));
    setSelectedDeck((current) => current?.id === renamed.id ? renamed : current);
  }, []);

  const handleDelete = useCallback(async (deck: SavedDeck): Promise<void> => {
    await deleteSavedDeck(deck.id);
    setSavedDecks((current) => current.filter((item) => item.id !== deck.id));
    if (selectedDeck?.id === deck.id) {
      setEditorDirty(false);
      setEditorVersion((version) => version + 1);
      setSelectedDeck(null);
    }
  }, [selectedDeck?.id]);

  if (state) {
    if (gameView === 'opponent-setup') {
      return (
        <OpponentSetupScreen
          state={state}
          onCancel={() => setGameView('game')}
          onApplied={() => setGameView('game')}
        />
      );
    }
    // D2: 縦持ち第一級の新レイアウト(縦持ちの壁を撤去)。
    return (
      <GameScreen
        keybindings={keybindings}
        onOpenOpponentSetup={() => setGameView('opponent-setup')}
      />
    );
  }

  return (
    <div className="app">
      {(snapshot?.state || (legacyFallback && legacyDeck && legacyDeck.length > 0)) && (
        <section className="app__resume-shelf" aria-label="前回の続き">
          {snapshot?.state && (
            <div className="app__resume">
              <div><strong>中断したゲーム</strong><p>盤面を保存した地点から続けます。</p></div>
              <button
                type="button"
                className="btn btn--primary"
                data-testid="restore-game"
                onClick={() => useGameStore.getState().restoreGame(snapshot)}
              >
                ゲームを再開
              </button>
            </div>
          )}
          {legacyFallback && legacyDeck && legacyDeck.length > 0 && (
            <div className="app__resume">
              <div><strong>前回のデッキ</strong><p>再解析せず、新しい一人回しを始めます。</p></div>
              <button
                type="button"
                className="btn btn--ghost"
                data-testid="resume-game"
                onClick={() => {
                  startAudioForGameGesture();
                  useGameStore.getState().newGame(legacyDeck);
                }}
              >
                このデッキで開始
              </button>
            </div>
          )}
        </section>
      )}
      {libraryReady && (
        <>
          <SavedDeckLibrary
            decks={savedDecks}
            selectedDeckId={selectedDeck?.id}
            hasUnsavedChanges={editorDirty}
            disabled={isImporting}
            onOpen={(deck) => requestDeckSwitch(deck)}
            onNew={() => requestDeckSwitch('new')}
            onRename={handleRename}
            onDelete={handleDelete}
          />
          <ImportScreen
            key={`${selectedDeck?.id ?? 'new'}:${editorVersion}`}
            initialDeckText={legacyFallback ? legacyDeckText : ''}
            initialSavedDeck={selectedDeck}
            onStart={handleStart}
            onDeckSaved={handleDeckSaved}
            onDirtyChange={setEditorDirty}
            onImportingChange={setIsImporting}
            keybindings={keybindings}
            onKeybindingsChange={setKeybindings}
          />
        </>
      )}

      {pendingDeck && (
        <Modal
          title="入力中の内容を破棄しますか？"
          onClose={() => setPendingDeck(null)}
          width="sm"
          testId="discard-deck-edit-dialog"
        >
          <p>まだ解析していない変更があります。別のデッキを開くと、この入力内容は失われます。</p>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setPendingDeck(null)}>入力を続ける</button>
            <button
              type="button"
              className="btn btn--danger"
              data-testid="discard-deck-edit-confirm"
              onClick={() => performDeckSwitch(pendingDeck)}
            >
              破棄して切り替える
            </button>
          </div>
        </Modal>
      )}
      <FanContentNotice />
    </div>
  );
}

export default App;
