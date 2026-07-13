import { createRoot } from 'react-dom/client';
import '../../index.css';
import '../../App.css';
import { GameScreen } from '../../components/game/GameScreen';
import { Playmat } from '../../components/playmat/Playmat';
import { RotateNotice } from '../../components/RotateNotice';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import {
  disableSnapshotPersistenceForDevelopment,
  useGameStore,
} from '../../store/gameStore';
import { loadResearchCheckpoint } from '../uxResearch/storage';
import {
  buildVisualFixture,
  isVisualFixtureScenario,
  type VisualFixtureScenario,
} from './fixtureBuilder';
import { initializeTheme } from '../../ui/theme';

type FixtureUi = 'new' | 'legacy';

function queryValue(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function fixtureScenario(): VisualFixtureScenario {
  const value = queryValue('scenario');
  return isVisualFixtureScenario(value) ? value : 'battlefield';
}

function fixtureUi(): FixtureUi {
  return queryValue('ui') === 'legacy' ? 'legacy' : 'new';
}

const scenario = fixtureScenario();
const ui = fixtureUi();
if (scenario === 'theme-light' || scenario === 'theme-dark') {
  document.documentElement.dataset.theme = scenario === 'theme-light' ? 'light' : 'dark';
  document.documentElement.style.colorScheme = scenario === 'theme-light' ? 'light' : 'dark';
} else {
  initializeTheme();
}

const root = document.getElementById('root');
if (!root) throw new Error('visual fixture root is missing');
const rootElement = root;

async function renderFixture(): Promise<void> {
  disableSnapshotPersistenceForDevelopment();
  const sessionId = queryValue('session');
  const checkpointId = queryValue('checkpoint');
  const capturedCheckpoint =
    sessionId && checkpointId
      ? await loadResearchCheckpoint(sessionId, checkpointId)
      : null;

  if ((sessionId || checkpointId) && !capturedCheckpoint) {
    throw new Error('指定したUX調査checkpointが見つかりません。');
  }

  const syntheticFixture = capturedCheckpoint ? null : buildVisualFixture(scenario);
  const snapshot = capturedCheckpoint?.snapshot ?? syntheticFixture?.snapshot;
  if (!snapshot) throw new Error('表示するsnapshotがありません。');

  const store = useGameStore.getState();
  store.restoreGame(snapshot);
  useGameStore.setState({
    warnings: capturedCheckpoint?.transient.warnings ?? syntheticFixture?.warnings ?? [],
    triggerCandidates: [],
    pendingGuided: capturedCheckpoint?.transient.pendingGuided ?? null,
    mulliganDecisionPending:
      capturedCheckpoint?.transient.mulliganDecisionPending ??
      syntheticFixture?.mulliganDecisionPending ??
      false,
  });

  const fixtureName = capturedCheckpoint
    ? `captured-${capturedCheckpoint.reason}`
    : scenario;
  document.documentElement.dataset.fixtureScenario = fixtureName;
  document.documentElement.dataset.fixtureUi = ui;
  document.title = `MTG OneDeck — ${fixtureName} — ${ui}`;

  createRoot(rootElement).render(
    ui === 'legacy' ? (
      <div className="playmat-shell">
        <div className="playmat-shell__game">
          <Playmat keybindings={DEFAULT_KEYBINDINGS} />
        </div>
        <RotateNotice />
      </div>
    ) : (
      <GameScreen keybindings={DEFAULT_KEYBINDINGS} />
    ),
  );
}

void renderFixture().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'fixtureの表示に失敗しました。';
  root.textContent = message;
  console.error(message, error);
});
