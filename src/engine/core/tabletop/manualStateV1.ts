import { isCoreBaseId, isCoreUnsafeRecordKey } from '../ids';
import type { CoreObjectId, CorePlayerId } from '../ids';

export type CoreTabletopManualModeV1 = 'structured' | 'freeform';

export type CoreTabletopNoteV1 = Readonly<{
  readonly id: string;
  readonly authorPlayerId: CorePlayerId;
  readonly text: string;
  readonly creationRevision: number;
}>;

export type CoreTabletopManualStackEntryV1 = Readonly<{
  readonly id: string;
  readonly label: string;
  readonly provenance: CoreTabletopManualModeV1;
  readonly sourceObjectId: CoreObjectId | null;
  readonly authorPlayerId: CorePlayerId;
  readonly creationRevision: number;
}>;

export type CoreTabletopManualStateV1 = Readonly<{
  readonly kind: 'core-tabletop-manual-state-v1';
  readonly notes: Readonly<Record<string, CoreTabletopNoteV1>>;
  readonly noteOrder: readonly string[];
  readonly stackEntries: readonly CoreTabletopManualStackEntryV1[];
}>;

const MANUAL_NOTES_MAX_COUNT_V1 = 128;
const MANUAL_STACK_MAX_COUNT_V1 = 128;
const MANUAL_NOTES_MAX_SERIALIZED_BYTES_V1 = 24_576;
const MANUAL_STACK_MAX_SERIALIZED_BYTES_V1 = 24_576;
const MANUAL_STATE_MAX_SERIALIZED_BYTES_V1 = 32_768;

function applicationId(value: string): boolean {
  return isCoreBaseId(value) && !isCoreUnsafeRecordKey(value) && value.length <= 80;
}

function serializedBytes(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : new TextEncoder().encode(serialized).length;
  } catch {
    return null;
  }
}

export function createCoreTabletopManualStateV1(input?: Partial<CoreTabletopManualStateV1>): CoreTabletopManualStateV1 {
  const notes = input?.notes ?? {};
  const noteOrder = input?.noteOrder ?? Object.keys(notes);
  const stackEntries = input?.stackEntries ?? [];
  const normalizedNotes: Record<string, CoreTabletopNoteV1> = Object.create(null) as Record<string, CoreTabletopNoteV1>;
  for (const [id, note] of Object.entries(notes)) {
    if (!applicationId(id)) throw new Error('Manual note ID exceeds the bounded application limit');
    normalizedNotes[id] = Object.freeze({ ...note });
  }
  for (const id of noteOrder) if (!applicationId(id)) throw new Error('Manual note-order ID exceeds the bounded application limit');
  if (Object.keys(normalizedNotes).length > MANUAL_NOTES_MAX_COUNT_V1) throw new Error('Manual notes exceed the bounded collection limit');
  if (stackEntries.length > MANUAL_STACK_MAX_COUNT_V1) throw new Error('Manual stack exceeds the bounded collection limit');
  for (const entry of stackEntries) if (!applicationId(entry.id)) throw new Error('Manual stack entry ID exceeds the bounded application limit');
  const normalized = Object.freeze({
    kind: 'core-tabletop-manual-state-v1',
    notes: Object.freeze(normalizedNotes),
    noteOrder: Object.freeze(noteOrder.slice()),
    stackEntries: Object.freeze(stackEntries.map((entry) => Object.freeze({ ...entry }))),
  });
  const notesBytes = serializedBytes({ notes: normalized.notes, noteOrder: normalized.noteOrder });
  if (notesBytes === null || notesBytes > MANUAL_NOTES_MAX_SERIALIZED_BYTES_V1) throw new Error('Manual notes exceed the bounded serialized size');
  const stackBytes = serializedBytes({ stackEntries: normalized.stackEntries });
  if (stackBytes === null || stackBytes > MANUAL_STACK_MAX_SERIALIZED_BYTES_V1) throw new Error('Manual stack exceeds the bounded serialized size');
  const aggregateBytes = serializedBytes({ notes: normalized.notes, noteOrder: normalized.noteOrder, stackEntries: normalized.stackEntries });
  if (aggregateBytes === null || aggregateBytes > MANUAL_STATE_MAX_SERIALIZED_BYTES_V1) throw new Error('Manual state exceeds the bounded serialized size');
  return normalized;
}
