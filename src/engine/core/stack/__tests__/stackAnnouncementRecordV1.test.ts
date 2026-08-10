import { describe, expect, it } from 'vitest';
import type { CoreStackAnnouncementRecordV1 } from '../stackAnnouncementRecordV1';

describe('CoreStackAnnouncementRecordV1', () => {
  it('models all four exact record kinds without lifecycle fields', () => {
    const common = { chosenModeKeys: [], targetSelections: [], announcedVariables: [], distributions: [], costChoices: { alternativeCost: null, additionalCosts: [] } } as const;
    const records: readonly CoreStackAnnouncementRecordV1[] = [
      { kind: 'card-spell', abilityTextSnapshot: null, ...common },
      { kind: 'spell-copy', abilityTextSnapshot: null, ...common },
      { kind: 'activated-ability', abilityTextSnapshot: 'Tap', ...common },
      { kind: 'triggered-ability', abilityTextSnapshot: 'When', ...common },
    ];
    expect(records.map((record) => record.kind)).toEqual(['card-spell', 'spell-copy', 'activated-ability', 'triggered-ability']);
    expect(Object.keys(records[0])).toEqual(['kind', 'abilityTextSnapshot', 'chosenModeKeys', 'targetSelections', 'announcedVariables', 'distributions', 'costChoices']);
  });
});
