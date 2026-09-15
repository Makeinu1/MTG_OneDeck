import type { PermanentEntrySetup } from '../../engine/cockpitR4';

export interface PermanentEntrySetupDraft {
  tapped: boolean;
  counterName: string;
  counterCount: number;
  controllerId: string;
  attachmentTargetId: string;
  protectorId: string;
}

export const emptyPermanentEntrySetupDraft = (): PermanentEntrySetupDraft => ({
  tapped: false,
  counterName: '+1/+1',
  counterCount: 0,
  controllerId: '',
  attachmentTargetId: '',
  protectorId: '',
});

export function permanentEntrySetupFromDraft(
  draft: PermanentEntrySetupDraft,
): PermanentEntrySetup | undefined {
  const count =
    Number.isSafeInteger(draft.counterCount) && draft.counterCount > 0 ? draft.counterCount : 0;
  const setup: PermanentEntrySetup = {
    ...(draft.tapped ? { tapped: true } : {}),
    ...(count && draft.counterName.trim()
      ? { counters: { [draft.counterName.trim()]: count } }
      : {}),
    ...(draft.controllerId ? { controllerId: draft.controllerId } : {}),
    ...(draft.attachmentTargetId ? { attachmentTargetId: draft.attachmentTargetId } : {}),
    ...(draft.protectorId ? { protectorId: draft.protectorId } : {}),
  };
  return Object.keys(setup).length ? setup : undefined;
}
