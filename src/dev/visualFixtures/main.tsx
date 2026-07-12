import { createRoot } from 'react-dom/client';
import '../../index.css';
import '../../App.css';
import { GameScreen } from '../../components/game/GameScreen';
import { Playmat } from '../../components/playmat/Playmat';
import { RotateNotice } from '../../components/RotateNotice';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import { useGameStore } from '../../store/gameStore';
import {
  buildVisualFixture,
  isVisualFixtureScenario,
  type VisualFixtureScenario,
} from './fixtureBuilder';

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
const fixture = buildVisualFixture(scenario);
const store = useGameStore.getState();
store.restoreGame(fixture.snapshot);
useGameStore.setState({
  warnings: fixture.warnings,
  triggerCandidates: [],
  pendingGuided: null,
  mulliganDecisionPending: fixture.mulliganDecisionPending,
});

document.documentElement.dataset.fixtureScenario = scenario;
document.documentElement.dataset.fixtureUi = ui;
document.title = `MTG OneDeck — ${scenario} — ${ui}`;

const root = document.getElementById('root');
if (!root) throw new Error('visual fixture root is missing');

createRoot(root).render(
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
