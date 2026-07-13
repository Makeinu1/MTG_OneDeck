import { beforeEach, describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../visualFixtures/fixtureBuilder';
import { createResearchCheckpoint, createResearchSession, createResearchTransient } from './researchModel';
import {
  listCoverageEntries,
  appendResearchInteraction,
  listResearchSessions,
  listResearchTaskReports,
  loadResearchCheckpoint,
  loadResearchSession,
  resetUxResearchStorageForTests,
  saveCoverageEntry,
  saveResearchSession,
  saveResearchTaskReport,
} from './storage';

describe('development-only UX research storage', () => {
  beforeEach(async () => {
    await resetUxResearchStorageForTests();
  });

  it('persists a session and retrieves a captured checkpoint independently', async () => {
    const fixture = buildVisualFixture('graveyard');
    const session = createResearchSession({
      deckId: 'Muldrotha',
      phase: 'owner-coverage',
      startedAt: new Date('2026-07-12T01:00:00.000Z'),
      viewport: { width: 1280, height: 800 },
    });
    const checkpoint = createResearchCheckpoint({
      elapsedMs: 8000,
      reason: 'manual-marker',
      state: fixture.snapshot.state,
      autoAdvanceToMain: false,
      transient: createResearchTransient({
        mulliganDecisionPending: false,
        warnings: [],
        pendingGuided: null,
        feedOpen: false,
        shortcutsBlocked: false,
      }),
      note: '墓地が第二の手札になる瞬間',
    });
    const saved = { ...session, checkpoints: [checkpoint] };

    await saveResearchSession(saved);
    const interaction = {
      id: 'interaction-1',
      elapsedMs: 8100,
      kind: 'pointermove' as const,
      x: 120,
      y: 240,
    };
    await appendResearchInteraction(session.sessionId, interaction);

    expect(await loadResearchSession(session.sessionId)).toEqual({
      ...saved,
      interactions: [interaction],
    });
    expect(await loadResearchCheckpoint(session.sessionId, checkpoint.id)).toEqual(checkpoint);
    expect(await listResearchSessions()).toEqual([{ ...saved, interactions: [interaction] }]);
  });

  it('persists one coverage decision per deck and experience', async () => {
    const entry = {
      key: 'Gogo:copy',
      deckId: 'Gogo' as const,
      experienceId: 'copy' as const,
      status: 'friction' as const,
      note: '新しい対象を探し直した',
      updatedAt: '2026-07-12T02:00:00.000Z',
    };
    await saveCoverageEntry(entry);
    expect(await listCoverageEntries()).toEqual([entry]);
  });

  it('stores retrospective reports separately from sessions', async () => {
    await saveResearchTaskReport({
      reportId: 'report-1',
      taskId: 'discovery:Celes',
      sessionId: 'session-1',
      submittedAt: '2026-07-13T01:00:00.000Z',
      outcome: 'completed',
      severity: 'none',
      neededHelp: false,
      anotherTurnScore: 6,
      observation: '8ターン進めた',
      userStatement: '',
      inconvenience: '',
      delight: 'もう一度回したい',
    });
    expect(await listResearchTaskReports()).toHaveLength(1);
  });
});
