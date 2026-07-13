import { describe, expect, it } from 'vitest';
import { selectNextResearchTask, routeResearchReview, RESEARCH_TASK_CATALOG } from './researchTasks';
import type { ResearchTaskReport, UiResearchSession } from './types';

function session(taskId: string, ended = true): UiResearchSession {
  return {
    version: 1,
    sessionId: `session-${taskId}`,
    taskId,
    deckId: 'Celes',
    phase: 'owner-discovery',
    startedAt: '2026-07-13T00:00:00.000Z',
    ...(ended ? { endedAt: '2026-07-13T01:00:00.000Z' } : {}),
    viewport: { width: 1440, height: 900 },
    checkpoints: [],
    interactions: [],
  };
}

function report(taskId: string): ResearchTaskReport {
  const task = RESEARCH_TASK_CATALOG.find((candidate) => candidate.id === taskId);
  return {
    reportId: `report-${taskId}`,
    taskId,
    sessionId: `session-${taskId}`,
    submittedAt: '2026-07-13T01:05:00.000Z',
    outcome: 'completed',
    severity: 'none',
    neededHelp: false,
    anotherTurnScore: 6,
    observation: '完了した',
    userStatement: '',
    inconvenience: '',
    delight: '',
    observedMomentIds: task?.moments.map((moment) => moment.id) ?? [],
  };
}

describe('research task loop', () => {
  it('starts with Celes discovery and blocks on a missing report', () => {
    expect(selectNextResearchTask({ sessions: [], reports: [] })).toMatchObject({
      kind: 'task', task: { id: 'discovery:Celes' },
    });
    expect(selectNextResearchTask({ sessions: [session('discovery:Celes')], reports: [] }))
      .toMatchObject({ kind: 'pending-report', task: { id: 'discovery:Celes' } });
  });

  it('round-robins discovery before coverage and stops at the prototype gate', () => {
    const discoveryReports = RESEARCH_TASK_CATALOG.slice(0, 4).map((task) => report(task.id));
    expect(selectNextResearchTask({ sessions: [], reports: discoveryReports })).toMatchObject({
      kind: 'task', task: { id: 'coverage:Celes:discard-draw' },
    });
    const allReports = RESEARCH_TASK_CATALOG.map((task) => report(task.id));
    expect(selectNextResearchTask({ sessions: [], reports: allReports }).kind).toBe('prototype-gate');
  });

  it('repeats a task when the moment was not observed or required moments are missing', () => {
    const first = RESEARCH_TASK_CATALOG[0];
    expect(selectNextResearchTask({
      sessions: [],
      reports: [{ ...report(first.id), outcome: 'not-observed' }],
    })).toMatchObject({ kind: 'task', task: { id: first.id } });

    const coverage = RESEARCH_TASK_CATALOG.find((task) => task.id === 'coverage:Celes:discard-draw');
    expect(coverage).toBeDefined();
    const previousReports = RESEARCH_TASK_CATALOG.slice(0, 4).map((task) => report(task.id));
    expect(selectNextResearchTask({
      sessions: [],
      reports: [...previousReports, { ...report(coverage!.id), observedMomentIds: ['discard'] }],
    })).toMatchObject({ kind: 'task', task: { id: coverage!.id } });
  });

  it('stops on high-risk feedback until repair is acknowledged, then repeats the task', () => {
    const blocked = { ...report('discovery:Celes'), severity: 'S1' as const };
    expect(selectNextResearchTask({ sessions: [], reports: [blocked] })).toMatchObject({
      kind: 'repair-gate', task: { id: 'discovery:Celes' }, failureCount: 1,
    });
    expect(selectNextResearchTask({
      sessions: [], reports: [{ ...blocked, reviewedAt: '2026-07-13T02:00:00.000Z' }],
    })).toMatchObject({ kind: 'task', task: { id: 'discovery:Celes' } });
  });

  it('routes only high-risk judgment to Sol', () => {
    expect(routeResearchReview({ ...report('x'), severity: 'S1' }).model).toBe('gpt-5.6-sol');
    expect(routeResearchReview({ ...report('x'), severity: 'S2' }).model).toBe('gpt-5.6-terra');
    expect(routeResearchReview(report('x')).model).toBe('gpt-5.6-luna');
  });
});
