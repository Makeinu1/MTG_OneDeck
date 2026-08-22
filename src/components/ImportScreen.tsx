import { useEffect, useRef, useState } from 'react';
import { parseDeckList, type ParseError } from '../data/deckParser';
import {
  conflictsWith,
  DEFAULT_KEYBINDINGS,
  KEYBINDING_ACTIONS,
  normalizePressedKey,
  saveKeybindings,
  type KeybindingAction,
  type KeybindingsMap,
} from '../data/keybindings';
import { resolveDeck, type ResolveProgress } from '../data/scryfall';
import {
  requestPersistentStorageOnce,
  saveResolvedDeck,
  type SavedDeck,
  type SavedDeckEntry,
} from '../data/savedDecks';
import type { CardDef } from '../types/card';
import type { InitDeckCard } from '../engine/init';
import { DeckStats } from './DeckStats';
import { RuleAutomationReport } from './RuleAutomationReport';
import { ThemeToggle } from './ThemeToggle';
import cardBackUrl from '../assets/onedeck/card-back.svg';

export interface ImportScreenProps {
  initialDeckText: string;
  initialSavedDeck?: SavedDeck | null;
  onStart: (deck: InitDeckCard[], deckText: string) => void;
  onDeckSaved?: (deck: SavedDeck) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onImportingChange?: (importing: boolean) => void;
  importOnly?: boolean;
  keybindings: KeybindingsMap;
  onKeybindingsChange: (map: KeybindingsMap) => void;
}

interface ResolvedEntry {
  name: string;
  card: CardDef;
  quantity: number;
  section: 'commander' | 'main';
}

const ACTION_LABELS: Record<KeybindingAction, string> = {
  nextPhase: '次に進む(フェイズ/解決/誘発)',
  nextTurn: '次のターン',
  draw: 'ドロー',
  restart: '最初からやり直す',
  undo: '元に戻す',
  redo: 'やり直す(戻したのを進む)',
};

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: 'Enter',
  Space: 'Space',
  Escape: 'Esc',
};

function formatKeybindingLabel(key: string): string {
  return KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

/**
 * The deck-import screen: paste a deck list, resolve it against Scryfall,
 * review unresolved/parse-error rows, then start the game.
 */
export function ImportScreen({
  initialDeckText,
  initialSavedDeck = null,
  onStart,
  onDeckSaved,
  onDirtyChange,
  onImportingChange,
  importOnly = false,
  keybindings,
  onKeybindingsChange,
}: ImportScreenProps) {
  const initialEntries: ResolvedEntry[] = (initialSavedDeck?.entries ?? []).map((entry) => ({
    name: entry.card.name,
    ...entry,
  }));
  const [deckText, setDeckText] = useState(initialSavedDeck?.deckText ?? initialDeckText);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ResolveProgress | null>(null);
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedEntry[]>(initialEntries);
  const [unresolved, setUnresolved] = useState<{ name: string; line: number; reason: string }[]>(
    [],
  );
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [hasImported, setHasImported] = useState(initialEntries.length > 0);
  const [savedDeckId, setSavedDeckId] = useState<string | undefined>(initialSavedDeck?.id);
  const [savedBaselineText, setSavedBaselineText] = useState(initialSavedDeck?.deckText ?? '');
  const [saveStatus, setSaveStatus] = useState<{
    kind: 'saving' | 'saved' | 'error';
    message: string;
  } | null>(initialSavedDeck ? { kind: 'saved', message: 'マイデッキから開きました。' } : null);
  const [rebindingAction, setRebindingAction] = useState<KeybindingAction | null>(null);
  const [keybindingWarning, setKeybindingWarning] = useState<string | null>(null);
  const importRunRef = useRef(0);

  useEffect(() => () => {
    importRunRef.current += 1;
  }, []);

  useEffect(() => {
    onDirtyChange?.(deckText !== savedBaselineText);
  }, [deckText, onDirtyChange, savedBaselineText]);

  useEffect(() => {
    onImportingChange?.(isImporting);
  }, [isImporting, onImportingChange]);

  useEffect(() => {
    if (!rebindingAction) return;
    const action = rebindingAction;

    function handleKeyDown(event: KeyboardEvent): void {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setRebindingAction(null);
        setKeybindingWarning(null);
        return;
      }

      const nextKey = normalizePressedKey(event.key, event.code);
      if (!nextKey) return;

      if (conflictsWith(keybindings, action, nextKey)) {
        setKeybindingWarning(
          `「${formatKeybindingLabel(nextKey)}」は他のショートカットと重複しています。`,
        );
        return;
      }

      const nextMap: KeybindingsMap = {
        ...keybindings,
        [action]: nextKey,
      };
      saveKeybindings(nextMap);
      onKeybindingsChange(nextMap);
      setKeybindingWarning(null);
      setRebindingAction(null);
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [keybindings, onKeybindingsChange, rebindingAction]);

  const handleImport = async (): Promise<void> => {
    const runId = importRunRef.current + 1;
    importRunRef.current = runId;
    setIsImporting(true);
    setProgress(null);
    setResolvedEntries([]);
    setUnresolved([]);
    setParseErrors([]);
    setHasImported(false);
    setSaveStatus(null);

    try {
      const { entries, errors } = parseDeckList(deckText);
      setParseErrors(errors);

      const result = await resolveDeck(entries, (p) => {
        if (importRunRef.current === runId) setProgress(p);
      });
      if (importRunRef.current !== runId) return;

      const resolved: ResolvedEntry[] = [];
      for (const entry of entries) {
        const card = result.resolved.get(entry.name);
        if (card) {
          resolved.push({
            name: entry.name,
            card,
            quantity: entry.quantity,
            section: entry.section,
          });
        }
      }
      setResolvedEntries(resolved);
      setUnresolved(result.unresolved);
      setHasImported(true);

      if (errors.length === 0 && result.unresolved.length === 0 && resolved.length > 0) {
        setSaveStatus({ kind: 'saving', message: 'マイデッキに保存中…' });
        const entriesToSave: SavedDeckEntry[] = resolved.map(({ card, quantity, section }) => ({
          card,
          quantity,
          section,
        }));
        try {
          const saved = await saveResolvedDeck({
            deckText,
            entries: entriesToSave,
            existingDeckId: savedDeckId,
          });
          if (importRunRef.current !== runId) return;
          setSavedDeckId(saved.deck.id);
          setSavedBaselineText(deckText);
          setSaveStatus({
            kind: 'saved',
            message:
              saved.operation === 'created'
                ? 'マイデッキに保存しました。'
                : 'マイデッキを更新しました。',
          });
          onDeckSaved?.(saved.deck);
          void requestPersistentStorageOnce();
        } catch {
          if (importRunRef.current !== runId) return;
          setSaveStatus({
            kind: 'error',
            message: 'このブラウザには保存できませんでした。ゲームは開始できます。',
          });
        }
      }
    } finally {
      if (importRunRef.current === runId) setIsImporting(false);
    }
  };

  const handleCancelImport = (): void => {
    importRunRef.current += 1;
    setIsImporting(false);
    setProgress(null);
  };

  const totalCount = resolvedEntries.reduce((sum, e) => sum + e.quantity, 0);
  const canStart =
    hasImported &&
    unresolved.length === 0 &&
    parseErrors.length === 0 &&
    resolvedEntries.length > 0;

  const handleStart = (): void => {
    if (importOnly) return;
    const deck: InitDeckCard[] = [];
    for (const entry of resolvedEntries) {
      for (let i = 0; i < entry.quantity; i++) {
        deck.push({ def: entry.card, isCommander: entry.section === 'commander' });
      }
    }
    onStart(deck, deckText);
  };

  const progressPct = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  const workflowState = isImporting
    ? 'resolving'
    : hasImported
      ? unresolved.length > 0 || parseErrors.length > 0
        ? 'error'
        : 'ready'
      : 'empty';
  const commanderEntry = resolvedEntries.find((entry) => entry.section === 'commander');

  const handleResetKeybindings = (): void => {
    const nextMap = { ...DEFAULT_KEYBINDINGS };
    saveKeybindings(nextMap);
    onKeybindingsChange(nextMap);
    setRebindingAction(null);
    setKeybindingWarning(null);
  };

  return (
    <div className="import-screen" data-state={workflowState} data-testid="import-screen">
      <header className="import-screen__topbar">
        <span className="import-screen__brand">MTG OneDeck</span>
        <ThemeToggle />
      </header>

      <div className="import-screen__hero">
        <div className="import-screen__hero-copy">
          <p className="import-screen__kicker">YOUR DECK · YOUR TABLE</p>
          <h1>{workflowState === 'ready' ? '準備が整いました' : 'デッキを、ひとりで深く知る。'}</h1>
          <p className="import-screen__lede">
            {workflowState === 'ready'
              ? '統率者とデッキ内容を確認して、そのまま一人回しを始められます。'
              : '統率者戦のデッキリストを貼り付けて、カードが動き出す瞬間を確かめましょう。'}
          </p>
        </div>
        <div className="import-screen__hero-art" aria-hidden="true">
          {commanderEntry?.card.faces[0]?.imageUrl ? (
            <img src={commanderEntry.card.faces[0].imageUrl} alt="" />
          ) : (
            <img src={cardBackUrl} alt="" />
          )}
        </div>
      </div>

      <div className="import-screen__panel">
        <div className="import-screen__section-heading">
          <div>
            <span className="import-screen__step">01</span>
            <h2>デッキリスト</h2>
          </div>
          <span
            className={`import-screen__state import-screen__state--${workflowState}`}
            aria-live="polite"
          >
            {workflowState === 'empty' && '入力待ち'}
            {workflowState === 'resolving' && 'カードを解決中'}
            {workflowState === 'ready' && 'プレイ可能'}
            {workflowState === 'error' && '修正が必要'}
          </span>
        </div>
        <label className="import-screen__label" htmlFor="deck-input">
          デッキリストを貼り付け
        </label>
        <textarea
          id="deck-input"
          data-testid="deck-input"
          className="import-screen__textarea"
          value={deckText}
          onChange={(e) => {
            setDeckText(e.target.value);
            setProgress(null);
            setResolvedEntries([]);
            setUnresolved([]);
            setParseErrors([]);
            setHasImported(false);
            setSaveStatus(null);
          }}
          placeholder={'例:\n統率者\n1 The Ur-Dragon\n\nデッキ\n1 Sol Ring\n4 稲妻'}
          spellCheck={false}
        />

        <div className="import-screen__actions" data-testid="import-primary-actions">
          {workflowState === 'ready' ? (
            !importOnly ? (
              <button
                type="button"
                data-testid="start-game"
                className="btn btn--accent btn--hero"
                onClick={handleStart}
                disabled={!canStart}
              >
                ゲーム開始
              </button>
            ) : null
          ) : workflowState === 'resolving' ? (
            <button
              type="button"
              data-testid="cancel-import"
              className="btn btn--primary btn--hero"
              onClick={handleCancelImport}
            >
              読み込みを中止
            </button>
          ) : (
            <button
              type="button"
              data-testid="import-button"
              className="btn btn--accent btn--hero"
              onClick={() => void handleImport()}
              disabled={deckText.trim() === ''}
            >
              {workflowState === 'error' ? '修正して再解析' : 'デッキを読み込む'}
            </button>
          )}
        </div>

        {saveStatus && (
          <p
            className={`import-screen__save-status import-screen__save-status--${saveStatus.kind}`}
            role={saveStatus.kind === 'error' ? 'alert' : 'status'}
            data-testid="deck-save-status"
          >
            {saveStatus.message}
          </p>
        )}

        <details className="import-screen__details">
          <summary>詳細・ショートカット設定</summary>
          <section className="import-screen__keybindings" data-testid="keybindings">
            <div className="import-screen__keybindings-header">
              <h2>キーボードショートカット</h2>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                data-testid="keybindings-reset"
                onClick={handleResetKeybindings}
              >
                デフォルトに戻す
              </button>
            </div>
            <div className="import-screen__keybindings-grid">
              {KEYBINDING_ACTIONS.map((action) => (
                <div key={action} className="import-screen__keybinding-row">
                  <span className="import-screen__keybinding-label">{ACTION_LABELS[action]}</span>
                  <kbd className="import-screen__keybinding-key">
                    {formatKeybindingLabel(keybindings[action])}
                  </kbd>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    data-testid={`rebind-${action}`}
                    onClick={() => {
                      setRebindingAction(action);
                      setKeybindingWarning(null);
                    }}
                  >
                    {rebindingAction === action ? '入力待ち…' : '変更'}
                  </button>
                </div>
              ))}
            </div>
            {rebindingAction && (
              <p className="import-screen__keybinding-hint">
                割り当てたいキーを押してください。Esc でキャンセルします。
              </p>
            )}
            {keybindingWarning && (
              <p className="import-screen__keybinding-warning" role="alert">
                {keybindingWarning}
              </p>
            )}
          </section>
        </details>

        {progress && (
          <div className="import-screen__progress">
            <div className="import-screen__progress-bar">
              <div className="import-screen__progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="import-screen__progress-label">
              解決中: {progress.done} / {progress.total}
            </span>
          </div>
        )}

        {hasImported && (
          <div className="import-screen__summary">
            <span className="import-screen__summary-item import-screen__summary-item--ok">
              解決済み {totalCount} 枚
            </span>
            <span
              className={`import-screen__summary-item ${
                unresolved.length > 0 ? 'import-screen__summary-item--warn' : ''
              }`}
            >
              未解決 {unresolved.length} 件
            </span>
            <span
              className={`import-screen__summary-item ${
                parseErrors.length > 0 ? 'import-screen__summary-item--warn' : ''
              }`}
            >
              パースエラー {parseErrors.length} 件
            </span>
          </div>
        )}

        {hasImported && resolvedEntries.length > 0 && (
          <details className="import-screen__details import-screen__details--analysis">
            <summary>デッキ分析とルール対応を見る</summary>
            <DeckStats entries={resolvedEntries} />
            <RuleAutomationReport entries={resolvedEntries} />
          </details>
        )}

        {unresolved.length > 0 && (
          <section className="import-screen__issues">
            <h2>解決できなかったカード</h2>
            <ul>
              {unresolved.map((item) => (
                <li key={`${item.line}-${item.name}`}>
                  <span className="import-screen__issue-line">{item.line}行目</span>
                  <span className="import-screen__issue-name">{item.name}</span>
                  <span className="import-screen__issue-reason">{item.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {parseErrors.length > 0 && (
          <section className="import-screen__issues">
            <h2>パースエラー</h2>
            <ul>
              {parseErrors.map((error) => (
                <li key={`${error.line}-${error.text}`}>
                  <span className="import-screen__issue-line">{error.line}行目</span>
                  <span className="import-screen__issue-name">「{error.text}」</span>
                  <span className="import-screen__issue-reason">{error.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {resolvedEntries.length > 0 && (
        <section className="import-screen__gallery">
          <h2>
            解決済みカード{' '}
            <span className="import-screen__gallery-count">{resolvedEntries.length}</span>
          </h2>
          <div className="import-screen__grid">
            {resolvedEntries.map((entry, index) => (
              <figure
                key={`${entry.section}-${entry.name}-${index}`}
                className="import-screen__card"
                data-commander={entry.section === 'commander' || undefined}
              >
                {entry.card.faces[0]?.imageUrl ? (
                  <img
                    src={entry.card.faces[0].imageUrl}
                    alt={entry.card.faces[0].printedName ?? entry.card.faces[0].name}
                    loading="lazy"
                  />
                ) : (
                  <div className="import-screen__card-fallback">
                    {entry.card.printedName ?? entry.card.name}
                  </div>
                )}
                {entry.quantity > 1 && (
                  <span className="import-screen__card-qty">×{entry.quantity}</span>
                )}
                {entry.section === 'commander' && (
                  <span className="import-screen__card-badge">統率者</span>
                )}
                <figcaption>{entry.card.printedName ?? entry.card.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
