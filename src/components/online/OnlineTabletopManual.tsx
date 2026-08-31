import { useMemo, useState, type FormEvent } from 'react';
import type {
  CoreCardDefinitionSnapshotV1,
  CoreManaColorV1,
  CoreObjectId,
  CorePlayerId,
} from '../../engine/core';
import type { CoreCardZoneDestinationV1 } from '../../engine/core/transition/zoneDestination';
import type {
  OnlineTabletopManualIntentEnvelopeV1,
  OnlineTabletopManualInteractionStateV1,
  OnlineTabletopManualPrimitiveV1,
  OnlineTabletopManualProjectionV1,
  OnlineTabletopManualRuntimeV1,
  OnlineTabletopManualZoneEntryV1,
} from './tabletopManualViewTypes';
import './onlineTabletopManual.css';

export type OnlineTabletopManualProps = Readonly<{
  readonly projection: OnlineTabletopManualProjectionV1 | null;
  readonly interactionState: OnlineTabletopManualInteractionStateV1;
  readonly busy?: boolean;
  /** The string is used only as a rejection signal; it is never rendered. */
  readonly error?: string | null;
  readonly onSubmit: (envelope: OnlineTabletopManualIntentEnvelopeV1) => void | Promise<void>;
}>;

type ObjectOption = Readonly<{
  readonly objectId: CoreObjectId;
  readonly label: string;
  readonly runtime: OnlineTabletopManualRuntimeV1 | null;
  readonly ownerPlayerId: CorePlayerId | null;
  readonly controllerPlayerId: CorePlayerId | null;
  readonly objectKind: string;
  readonly zone: string;
  readonly typeLine: string | null;
}>;

let nextManualCommandSequence = 0;

const DESTINATIONS = [
  ['owner-hand', '自分の手札'],
  ['owner-graveyard', '自分の墓地'],
  ['owner-library-top', '自分のライブラリー（上）'],
  ['battlefield', '戦場'],
  ['exile', '追放'],
] as const;
const LIFE_FIELDS = [
  ['life', 'ライフ'],
  ['poison', '毒カウンター'],
  ['energy', 'エネルギー'],
  ['experience', '経験カウンター'],
] as const;
const MANA_COLORS: readonly [CoreManaColorV1, string][] = [
  ['W', '白'], ['U', '青'], ['B', '黒'], ['R', '赤'], ['G', '緑'], ['C', '無色'],
];
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const SAFE_TOKEN_SEED = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const RESPONSE_WINDOW_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'after-stack-addition': 'スタック追加後',
  'before-combat': '戦闘前',
  'after-attackers': '攻撃クリーチャー指定後',
  'after-blockers': 'ブロック指定後',
  'before-end-step': '終了ステップ前',
  'before-passing-turn': 'ターンを渡す前',
});

function visibleObject(entry: OnlineTabletopManualZoneEntryV1, zone: string): ObjectOption | null {
  if (entry.kind === 'hidden-card') return null;
  const definitionName = entry.kind === 'visible-object' ? entry.definition?.name : null;
  return Object.freeze({
    objectId: entry.objectId,
    label: definitionName ? `《${definitionName}》（${zone}）` : `公開オブジェクト（${zone}）`,
    runtime: entry.runtime,
    ownerPlayerId: entry.kind === 'visible-object' ? entry.ownerPlayerId : null,
    controllerPlayerId: entry.kind === 'visible-object' ? entry.controllerPlayerId : null,
    objectKind: entry.objectKind,
    zone,
    typeLine: entry.kind === 'visible-object' ? entry.definition?.typeLine ?? null : null,
  });
}

function objectOptions(projection: OnlineTabletopManualProjectionV1): readonly ObjectOption[] {
  const ownId = projection.corePlayerId;
  const ownZones = ownId === null
    ? null
    : projection.game.zones.byPlayer.find((group) => group.playerId === ownId)?.zones ?? null;
  const candidates: ObjectOption[] = [];
  const addZone = (entries: readonly OnlineTabletopManualZoneEntryV1[], zone: string): void => {
    entries.forEach((entry) => {
      const option = visibleObject(entry, zone);
      if (option !== null) candidates.push(option);
    });
  };
  if (ownZones !== null) {
    addZone(ownZones.hand.entries, '手札');
    addZone(ownZones.graveyard.entries, '墓地');
  }
  addZone(projection.game.zones.battlefield.entries, '戦場');
  addZone(projection.game.zones.stack.entries, 'スタック');
  addZone(projection.game.zones.exile.entries, '追放');
  addZone(projection.game.zones.command.entries, '統率者領域');
  const seen = new Set<string>();
  return Object.freeze(candidates.filter((candidate) => {
    if (seen.has(candidate.objectId)) return false;
    seen.add(candidate.objectId);
    if (candidate.zone === '手札' || candidate.zone === '墓地') return true;
    if (candidate.zone === '戦場' || candidate.zone === 'スタック') return candidate.controllerPlayerId === ownId;
    if (candidate.zone === '追放' || candidate.zone === '統率者領域') return candidate.ownerPlayerId === ownId;
    return false;
  }));
}

function battlefieldOptions(projection: OnlineTabletopManualProjectionV1): readonly ObjectOption[] {
  const result: ObjectOption[] = [];
  projection.game.zones.battlefield.entries.forEach((entry) => {
    if (entry.kind !== 'visible-object') return;
    const option = visibleObject(entry, '戦場');
    if (option !== null) result.push(option);
  });
  return Object.freeze(result);
}

function asDestination(
  value: string,
  actor: CorePlayerId,
): CoreCardZoneDestinationV1 | null {
  switch (value) {
    case 'owner-hand': return { kind: 'owner-hand' };
    case 'owner-graveyard': return { kind: 'owner-graveyard' };
    case 'owner-library-top': return { kind: 'owner-library', placement: { kind: 'top' } };
    case 'battlefield': return { kind: 'battlefield', baseControllerPlayerId: actor };
    case 'exile': return { kind: 'exile' };
    default: return null;
  }
}

function integer(value: string, min = -999, max = 999): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function safeText(value: string, max: number): boolean {
  if (value.length < 1 || value.length > max || value !== value.trim()) return false;
  return ![...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f);
  });
}

function tokenDefinition(name: string): CoreCardDefinitionSnapshotV1 {
  return Object.freeze({
    source: Object.freeze({ kind: 'engine-synthetic' as const }),
    name,
    layout: 'normal',
    manaValue: 0,
    colorIdentity: Object.freeze([]),
    typeLine: 'Token',
    keywords: Object.freeze([]),
    producedMana: Object.freeze([]),
    tokenKind: null,
    faces: Object.freeze([Object.freeze({
      name,
      manaCost: null,
      typeLine: 'Token',
      oracleText: '',
      power: null,
      toughness: null,
      loyalty: null,
      defense: null,
    })]),
  });
}

function submitDisabled(
  interactionState: OnlineTabletopManualInteractionStateV1,
  busy: boolean,
  submitting: boolean,
): boolean {
  return interactionState !== 'ready' || busy || submitting;
}

function modeLabel(mode: 'structured' | 'freeform'): string {
  return mode === 'structured' ? 'Structured Manual' : 'Freeform Manual';
}

function ActionButton({
  testId,
  children,
  disabled,
  onClick,
}: Readonly<{
  readonly testId: string;
  readonly children: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}>) {
  return <button type="button" className="online-tabletop-manual__button" data-testid={testId} disabled={disabled} onClick={onClick}>{children}</button>;
}

function unavailable() {
  return <section className="online-tabletop-manual__unavailable" data-testid="online-tabletop-manual-unavailable" aria-live="polite">共有テーブルの表示を準備しています。</section>;
}

export function OnlineTabletopManual({
  projection,
  interactionState,
  busy = false,
  error = null,
  onSubmit,
}: OnlineTabletopManualProps) {
  const [mode, setMode] = useState<'structured' | 'freeform'>('structured');
  const [submitting, setSubmitting] = useState(false);
  const [localRejected, setLocalRejected] = useState(false);
  const [moveObject, setMoveObject] = useState('');
  const [moveDestination, setMoveDestination] = useState('owner-hand');
  const [drawCount, setDrawCount] = useState('1');
  const [tapObject, setTapObject] = useState('');
  const [tapValue, setTapValue] = useState<'true' | 'false'>('true');
  const [counterObject, setCounterObject] = useState('');
  const [counterKind, setCounterKind] = useState('+1/+1');
  const [counterDelta, setCounterDelta] = useState('1');
  const [damageObject, setDamageObject] = useState('');
  const [damageAmount, setDamageAmount] = useState('1');
  const [controllerObject, setControllerObject] = useState('');
  const [controllerPlayer, setControllerPlayer] = useState('');
  const [attachObject, setAttachObject] = useState('');
  const [attachTarget, setAttachTarget] = useState('');
  const [lifeField, setLifeField] = useState<'life' | 'poison' | 'energy' | 'experience'>('life');
  const [lifeDelta, setLifeDelta] = useState('1');
  const [manaColor, setManaColor] = useState<CoreManaColorV1>('C');
  const [manaDelta, setManaDelta] = useState('1');
  const [tokenSeed, setTokenSeed] = useState('manual-token-1');
  const [tokenName, setTokenName] = useState('手動トークン');
  const [tokenObject, setTokenObject] = useState('');
  const [noteId, setNoteId] = useState('note-1');
  const [noteText, setNoteText] = useState('');
  const [clearNoteId, setClearNoteId] = useState('');
  const [stackEntryId, setStackEntryId] = useState('stack-1');
  const [stackLabel, setStackLabel] = useState('手動スタック項目');
  const [stackSource, setStackSource] = useState('');
  const [journeyLand, setJourneyLand] = useState('');

  const objects = useMemo(() => projection === null ? Object.freeze([]) : objectOptions(projection), [projection]);
  const handObjects = useMemo(() => objects.filter((option) => option.zone === '手札'), [objects]);
  const landObjects = useMemo(() => handObjects.filter((option) => option.typeLine?.toLowerCase().includes('land') === true), [handObjects]);
  const publicObjects = useMemo(() => projection === null ? Object.freeze([]) : battlefieldOptions(projection), [projection]);
  const players = projection?.game.players ?? [];
  const actor = projection?.corePlayerId ?? null;
  const disabled = submitDisabled(interactionState, busy, submitting);
  const hasError = error !== null || localRejected;

  if (projection === null || actor === null) return unavailable();

  const controlledBattlefieldObjects = publicObjects.filter((option) => option.controllerPlayerId === actor);
  const tokenObjects = controlledBattlefieldObjects.filter((option) => option.objectKind === 'token');
  const authoredNotes = (projection.game.notes ?? []).filter((note) => note.authorPlayerId === actor);
  const manualStackTop = (projection.game.manualStack ?? []).at(-1) ?? null;
  const priority = projection.game.assistedPriority;
  // Older projections predate assistedPriority; retain the existing manual-stack
  // author gate until the next server projection arrives. Current production
  // projections always carry the Core-derived steward field.
  const isSteward = priority === undefined
    ? manualStackTop?.authorPlayerId === actor
    : priority.stewardPlayerId === actor;
  const ownHeld = (projection.game.priorityHolds ?? []).some((hold) => hold.playerId === actor);
  const hasAnyHold = (projection.game.priorityHolds ?? []).length > 0 || (priority?.holds?.length ?? 0) > 0;
  const canAdvance = isSteward && !hasAnyHold && (priority === undefined || ['turn-based-action-required', 'position-advance-ready', 'turn-advance-ready', 'cleanup-repeat-ready'].includes(priority.windowKind));
  const stackTop = projection.game.zones.stack.entries.at(-1) ?? null;
  const stackTopLabel = stackTop?.kind === 'visible-object' && stackTop.definition?.name
    ? `《${stackTop.definition.name}》`
    : stackTop === null ? 'ありません' : '公開スタック項目';

  const emit = (primitive: OnlineTabletopManualPrimitiveV1): void => {
    if (disabled) return;
    nextManualCommandSequence += 1;
    const envelope: OnlineTabletopManualIntentEnvelopeV1 = Object.freeze({
      kind: 'online-tabletop-intent-envelope-v1',
      schemaVersion: 1,
      commandId: `manual-${projection.revision}-${nextManualCommandSequence}`,
      baseRevision: projection.revision,
      mode,
      primitive: Object.freeze(primitive),
    });
    setLocalRejected(false);
    setSubmitting(true);
    try {
      const pending = onSubmit(envelope);
      if (pending !== null && typeof pending === 'object' && 'then' in pending && typeof pending.then === 'function') {
        void Promise.resolve(pending).then(() => setSubmitting(false), () => { setSubmitting(false); setLocalRejected(true); });
      } else {
        setSubmitting(false);
      }
    } catch {
      setSubmitting(false);
      setLocalRejected(true);
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>, primitive: OnlineTabletopManualPrimitiveV1 | null): void => {
    event.preventDefault();
    if (primitive !== null) emit(primitive);
  };
  const destination = asDestination(moveDestination, actor);
  const draw = integer(drawCount, 1, 7);
  const counter = integer(counterDelta, -99, 99);
  const damage = integer(damageAmount, -99, 99);
  const life = integer(lifeDelta, -99, 99);
  const mana = integer(manaDelta, -99, 99);
  const noteValid = SAFE_ID.test(noteId) && safeText(noteText, 160);
  const clearNoteValid = authoredNotes.some((note) => note.id === clearNoteId);
  const counterKindValid = safeText(counterKind, 64);
  const stackValid = SAFE_ID.test(stackEntryId) && safeText(stackLabel, 160);
  const tokenValid = SAFE_TOKEN_SEED.test(tokenSeed) && safeText(tokenName, 80);
  const byId = (id: string): ObjectOption | undefined => objects.find((candidate) => candidate.objectId === id);
  const sourceObject = stackSource === '' ? null : byId(stackSource)?.objectId ?? null;
  const publicReordered = publicObjects.length < 2 ? [] : publicObjects.slice().reverse();
  const projectedTurn = (projection.game as unknown as Readonly<{ readonly turn?: Readonly<{ readonly activePlayerId: CorePlayerId }> }>).turn;
  const sourceLessStackEntryBlocked = sourceObject === null && (
    hasAnyHold
    || projectedTurn?.activePlayerId !== actor
    || projection.game.zones.stack.count > 0
  );
  const currentStatus = disabled
    ? interactionState === 'offline' ? '接続を確認してください。再接続後に再試行できます。' : 'サーバーで処理中です。完了までお待ちください。'
    : 'サーバーへ送信できます。';

  return (
    <section className="online-tabletop-manual" data-testid="online-tabletop-manual" aria-labelledby="online-tabletop-manual-title">
      <header className="online-tabletop-manual__header">
        <div>
          <p className="online-tabletop-manual__eyebrow">PUBLIC TABLETOP</p>
          <h2 id="online-tabletop-manual-title">共有テーブルの手動操作</h2>
          <p>公開投影から選んだ事実だけをサーバーへ記録します。Oracle効果の自動処理ではありません。</p>
        </div>
        <p className="online-tabletop-manual__status" data-testid="online-tabletop-manual-status" role="status" aria-live="polite">{currentStatus}</p>
      </header>

      <fieldset className="online-tabletop-manual__mode" disabled={disabled} aria-label="手動モード">
        <legend>記録モード</legend>
        <label>
          <input data-testid="online-tabletop-mode-structured" type="radio" name="online-tabletop-mode" checked={mode === 'structured'} disabled={disabled} onChange={() => setMode('structured')} />
          <span>Structured Manual</span>
          <small>投影された対象を選びます</small>
        </label>
        <label>
          <input data-testid="online-tabletop-mode-freeform" type="radio" name="online-tabletop-mode" checked={mode === 'freeform'} disabled={disabled} onChange={() => setMode('freeform')} />
          <span>Freeform Manual</span>
          <small>テーブル合意の公開事実を記録します</small>
        </label>
      </fieldset>
      <p className="online-tabletop-manual__mode-note" data-testid="online-tabletop-mode-label">現在: {modeLabel(mode)}</p>

      <section className="online-tabletop-manual__priority" data-testid="online-assisted-priority" aria-labelledby="online-assisted-priority-title">
        <h3 id="online-assisted-priority-title">優先権 / HOLD / スタック</h3>
        <p>{priority?.holderPlayerId === null ? '優先権の処理待ち' : `優先権: ${priority?.holderPlayerId ?? '—'}`} / {isSteward ? 'あなたが steward' : `steward: ${priority?.stewardPlayerId ?? '未定'}`}</p>
        <p data-testid="online-assisted-response-window">応答窓: {priority?.responseWindow === null || priority?.responseWindow === undefined ? 'その他のCR窓' : RESPONSE_WINDOW_LABELS[priority.responseWindow] ?? priority.responseWindow}</p>
        <p data-testid="online-assisted-stack-causality">スタック最上段: {stackTopLabel}（{projection.game.zones.stack.count}件）</p>
        <p>HOLD: {ownHeld ? '設定中' : '未設定'}（全員が設定・解除できます）</p>
        <div className="online-tabletop-manual__priority-actions">
          <ActionButton testId="online-priority-hold" disabled={disabled} onClick={() => emit({ kind: 'priority-hold', held: !ownHeld })}>{ownHeld ? 'HOLDを解除' : 'HOLDを設定'}</ActionButton>
          <ActionButton testId="online-priority-advance" disabled={disabled || !canAdvance} onClick={() => emit({ kind: 'priority-advance' })}>Advance（steward）</ActionButton>
          <ActionButton testId="online-priority-resolve" disabled={disabled || !isSteward || hasAnyHold || priority?.windowKind !== 'resolution-ready'} onClick={() => emit({ kind: 'priority-resolve' })}>Resolve（steward）</ActionButton>
        </div>
        {priority?.windowKind === 'sba-check-required' && <p className="online-tabletop-manual__hint">SBA確認は共有テーブル上部の専用ボタンから明示します。</p>}
        <p className="online-tabletop-manual__hint">HOLDは共有checkpointです。CRの優先権はCoreで保持され、Resolve/Advanceだけstewardに許可されます。</p>
      </section>

      <section className="online-tabletop-manual__journey" data-testid="online-land-journey" aria-labelledby="online-land-title">
        <h3 id="online-land-title">土地（共有卓の基本旅程）</h3>
        <p>土地は手札から選んでCoreのplay-landへ送ります。呪文は盤面上の「唱える」だけを正本とし、支払い・対象・モードは手動確認します。</p>
        <div className="online-tabletop-manual__priority-actions">
          <select aria-label="土地を選択" data-testid="online-journey-land" value={journeyLand} onChange={(event) => setJourneyLand(event.target.value)} disabled={disabled}>
            <option value="">土地を選択</option>
            {landObjects.map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}
          </select>
          <ActionButton testId="online-journey-play-land" disabled={disabled || journeyLand === ''} onClick={() => emit({ kind: 'play-land', objectId: journeyLand as CoreObjectId })}>土地を置く</ActionButton>
        </div>
      </section>

      {hasError && <div className="online-tabletop-manual__error" data-testid="online-tabletop-manual-error" role="alert">操作を受け付けられませんでした。表示を確認して、もう一度お試しください。</div>}

      <div className="online-tabletop-manual__sections">
        <section className="online-tabletop-manual__section" aria-labelledby="online-tabletop-move-title">
          <h3 id="online-tabletop-move-title">Move / Draw</h3>
          <p>自分が操作できる投影済みオブジェクトを移動、または自分のライブラリーからドローします。</p>
          <form onSubmit={(event) => submitForm(event, moveObject !== '' && destination !== null ? { kind: 'move', objectId: moveObject as CoreObjectId, destination } : null)}>
            <label>対象<select data-testid="online-tabletop-move-object" value={moveObject} onChange={(event) => setMoveObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{objects.map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}</select></label>
            <label>移動先<select data-testid="online-tabletop-move-destination" value={moveDestination} onChange={(event) => setMoveDestination(event.target.value)} disabled={disabled}>{DESTINATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <ActionButton testId="online-tabletop-submit-move" disabled={disabled || moveObject === '' || destination === null} onClick={() => { if (moveObject !== '' && destination !== null) emit({ kind: 'move', objectId: moveObject as CoreObjectId, destination }); }}>Move を送信</ActionButton>
          </form>
          <form onSubmit={(event) => submitForm(event, draw === null ? null : { kind: 'draw', count: draw })}>
            <label>ドロー枚数<input data-testid="online-tabletop-draw-count" type="number" min="1" max="7" inputMode="numeric" value={drawCount} onChange={(event) => setDrawCount(event.target.value)} disabled={disabled} /></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-draw" type="submit" disabled={disabled || draw === null}>Draw を送信</button>
          </form>
        </section>

        <section className="online-tabletop-manual__section" aria-labelledby="online-tabletop-random-title">
          <h3 id="online-tabletop-random-title">Shuffle / Random / Reorder</h3>
          <p>Shuffle はサーバーが乱数を作ります。クライアントは順番やseedを送信しません。</p>
          <ActionButton testId="online-tabletop-submit-shuffle" disabled={disabled} onClick={() => emit({ kind: 'shuffle' })}>Shuffle を送信</ActionButton>
          <ActionButton testId="online-tabletop-submit-reorder" disabled={disabled || publicObjects.length < 2} onClick={() => emit({ kind: 'reorder', zone: { kind: 'shared-zone', zone: 'battlefield' }, order: publicReordered.map((option) => option.objectId) })}>公開戦場の Reorder を送信</ActionButton>
          <p className="online-tabletop-manual__hint">非公開ライブラリーの並べ替えは利用できません。</p>
        </section>

        <section className="online-tabletop-manual__section" aria-labelledby="online-tabletop-object-title">
          <h3 id="online-tabletop-object-title">Tap/Untap · Add/Remove Counter · Mark/Clear Damage</h3>
          <form onSubmit={(event) => submitForm(event, tapObject === '' ? null : { kind: 'tap', objectId: tapObject as CoreObjectId, tapped: tapValue === 'true' })}>
            <label>対象<select data-testid="online-tabletop-tap-object" value={tapObject} onChange={(event) => setTapObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{controlledBattlefieldObjects.map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}</select></label>
            <label>状態<select data-testid="online-tabletop-tap-value" value={tapValue} onChange={(event) => setTapValue(event.target.value as 'true' | 'false')} disabled={disabled}><option value="true">タップ</option><option value="false">アンタップ</option></select></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-tap" type="submit" disabled={disabled || tapObject === ''}>Tap/Untap を送信</button>
          </form>
          <form onSubmit={(event) => submitForm(event, counterObject !== '' && counter !== null && counter !== 0 && counterKindValid ? { kind: 'counter', objectId: counterObject as CoreObjectId, counterKind, delta: counter } : null)}>
            <label>対象<select data-testid="online-tabletop-counter-object" value={counterObject} onChange={(event) => setCounterObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{controlledBattlefieldObjects.map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}</select></label>
            <label>カウンター種別<input data-testid="online-tabletop-counter-kind" maxLength={64} value={counterKind} onChange={(event) => setCounterKind(event.target.value)} disabled={disabled} /></label>
            <label>増減<input data-testid="online-tabletop-counter-delta" type="number" min="-99" max="99" value={counterDelta} onChange={(event) => setCounterDelta(event.target.value)} disabled={disabled} /></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-counter" type="submit" disabled={disabled || counterObject === '' || counter === null || counter === 0 || !counterKindValid}>Counter を送信</button>
          </form>
          <form onSubmit={(event) => submitForm(event, damageObject !== '' && damage !== null ? { kind: 'damage', objectId: damageObject as CoreObjectId, amount: damage } : null)}>
            <label>対象<select data-testid="online-tabletop-damage-object" value={damageObject} onChange={(event) => setDamageObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{controlledBattlefieldObjects.map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}</select></label>
            <label>増減（正=Mark / 負=Clear）<input data-testid="online-tabletop-damage-amount" type="number" min="-99" max="99" value={damageAmount} onChange={(event) => setDamageAmount(event.target.value)} disabled={disabled} /></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-damage" type="submit" disabled={disabled || damageObject === '' || damage === null || damage === 0}>Damage を送信</button>
          </form>
        </section>

        <section className="online-tabletop-manual__section" aria-labelledby="online-tabletop-facts-title">
          <h3 id="online-tabletop-facts-title">Adjust（Life / Mana）</h3>
          <p>プレイヤーの数値は自分の席だけを調整できます。</p>
          <form onSubmit={(event) => submitForm(event, life === null ? null : { kind: 'life', field: lifeField, delta: life })}>
            <label>項目<select data-testid="online-tabletop-life-field" value={lifeField} onChange={(event) => setLifeField(event.target.value as typeof lifeField)} disabled={disabled}>{LIFE_FIELDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>増減<input data-testid="online-tabletop-life-delta" type="number" min="-99" max="99" value={lifeDelta} onChange={(event) => setLifeDelta(event.target.value)} disabled={disabled} /></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-life" type="submit" disabled={disabled || life === null || life === 0}>Life / Adjust を送信</button>
          </form>
          <form onSubmit={(event) => submitForm(event, mana === null ? null : { kind: 'mana', color: manaColor, delta: mana })}>
            <label>マナ色<select data-testid="online-tabletop-mana-color" value={manaColor} onChange={(event) => setManaColor(event.target.value as CoreManaColorV1)} disabled={disabled}>{MANA_COLORS.map(([value, label]) => <option key={value} value={value}>{label}（{value}）</option>)}</select></label>
            <label>増減<input data-testid="online-tabletop-mana-delta" type="number" min="-99" max="99" value={manaDelta} onChange={(event) => setManaDelta(event.target.value)} disabled={disabled} /></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-mana" type="submit" disabled={disabled || mana === null || mana === 0}>Mana / Adjust を送信</button>
          </form>
        </section>

        <section className="online-tabletop-manual__section" aria-labelledby="online-tabletop-relations-title">
          <h3 id="online-tabletop-relations-title">Create Token · Controller · Attach/Detach</h3>
          <form onSubmit={(event) => submitForm(event, tokenValid ? { kind: 'token-create', tokenSeed, definitionId: `manual-definition-${tokenSeed}`, definition: tokenDefinition(tokenName) } : null)}>
            <label>トークン名<input data-testid="online-tabletop-token-name" maxLength={80} value={tokenName} onChange={(event) => setTokenName(event.target.value)} disabled={disabled} /></label>
            <label>トークン識別子<input data-testid="online-tabletop-token-seed" maxLength={64} value={tokenSeed} onChange={(event) => setTokenSeed(event.target.value)} disabled={disabled} /></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-token-create" type="submit" disabled={disabled || !tokenValid}>Create Token を送信</button>
          </form>
          <form onSubmit={(event) => submitForm(event, tokenObject === '' ? null : { kind: 'token-remove', objectId: tokenObject as CoreObjectId })}>
            <label>削除するトークン<select data-testid="online-tabletop-token-object" value={tokenObject} onChange={(event) => setTokenObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{tokenObjects.map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}</select></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-token-remove" type="submit" disabled={disabled || tokenObject === ''}>Remove Token を送信</button>
          </form>
          <form onSubmit={(event) => submitForm(event, controllerObject !== '' && SAFE_ID.test(controllerPlayer) ? { kind: 'controller', objectId: controllerObject as CoreObjectId, gainingControllerPlayerId: controllerPlayer as CorePlayerId } : null)}>
            <label>対象<select data-testid="online-tabletop-controller-object" value={controllerObject} onChange={(event) => setControllerObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{objects.filter((option) => option.zone === '戦場').map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}</select></label>
            <label>取得するプレイヤー<select data-testid="online-tabletop-controller-player" value={controllerPlayer} onChange={(event) => setControllerPlayer(event.target.value)} disabled={disabled}><option value="">選択してください</option>{players.filter((player) => player.status === 'active').map((player) => <option key={player.playerId} value={player.playerId}>{player.playerId === actor ? '自分' : 'プレイヤー'}</option>)}</select></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-controller" type="submit" disabled={disabled || controllerObject === '' || !SAFE_ID.test(controllerPlayer)}>Controller を送信</button>
          </form>
          <form onSubmit={(event) => submitForm(event, attachObject !== '' ? { kind: 'attach', objectId: attachObject as CoreObjectId, targetObjectId: attachTarget === '' ? null : attachTarget as CoreObjectId } : null)}>
            <label>付ける対象<select data-testid="online-tabletop-attach-object" value={attachObject} onChange={(event) => setAttachObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{objects.filter((option) => option.zone === '戦場').map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}</select></label>
            <label>付け先<select data-testid="online-tabletop-attach-target" value={attachTarget} onChange={(event) => setAttachTarget(event.target.value)} disabled={disabled}><option value="">外す（Detach）</option>{publicObjects.filter((option) => option.objectId !== attachObject).map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}</select></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-attach" type="submit" disabled={disabled || attachObject === ''}>Attach/Detach を送信</button>
          </form>
        </section>

        <section className="online-tabletop-manual__section" aria-labelledby="online-tabletop-note-title">
          <h3 id="online-tabletop-note-title">Temporary Note</h3>
          <p>1〜160文字の公開メモです。作成者だけが削除できます。</p>
          <form onSubmit={(event) => submitForm(event, noteValid ? { kind: 'note-set', noteId, text: noteText.trim() } : null)}>
            <label>メモID<input data-testid="online-tabletop-note-id" maxLength={128} value={noteId} onChange={(event) => setNoteId(event.target.value)} disabled={disabled} /></label>
            <label>公開メモ<textarea data-testid="online-tabletop-note-text" maxLength={160} value={noteText} onChange={(event) => setNoteText(event.target.value)} disabled={disabled} /></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-note-set" type="submit" disabled={disabled || !noteValid}>Temporary Note を設定</button>
          </form>
          <form onSubmit={(event) => submitForm(event, clearNoteValid ? { kind: 'note-clear', noteId: clearNoteId } : null)}>
            <label>削除するメモ<select data-testid="online-tabletop-clear-note-id" value={clearNoteId} onChange={(event) => setClearNoteId(event.target.value)} disabled={disabled}><option value="">選択してください</option>{authoredNotes.map((note) => <option key={note.id} value={note.id}>{note.text}</option>)}</select></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-note-clear" type="submit" disabled={disabled || !clearNoteValid}>Temporary Note を削除</button>
          </form>
        </section>

        <section className="online-tabletop-manual__section" aria-labelledby="online-tabletop-stack-title">
          <h3 id="online-tabletop-stack-title">Manual Stack · Manual Resolve</h3>
          <p>公開ラベルだけを記録し、解決は現在のスタック最上段に限定します。Oracle効果は作りません。</p>
          <form onSubmit={(event) => submitForm(event, stackValid ? { kind: 'stack-entry', entryId: stackEntryId, label: stackLabel.trim(), sourceObjectId: sourceObject } : null)}>
            <label>項目ID<input data-testid="online-tabletop-stack-entry-id" maxLength={128} value={stackEntryId} onChange={(event) => setStackEntryId(event.target.value)} disabled={disabled} /></label>
            <label>公開ラベル<input data-testid="online-tabletop-stack-label" maxLength={160} value={stackLabel} onChange={(event) => setStackLabel(event.target.value)} disabled={disabled} /></label>
            <label>発生源（任意）<select data-testid="online-tabletop-stack-source" value={stackSource} onChange={(event) => setStackSource(event.target.value)} disabled={disabled}><option value="">指定しない</option>{objects.filter((option) => option.zone === 'スタック').map((option) => <option key={option.objectId} value={option.objectId}>{option.label}</option>)}</select></label>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-stack-entry" type="submit" disabled={disabled || !stackValid || sourceLessStackEntryBlocked}>Manual Stack を追加</button>
          </form>
          <form onSubmit={(event) => submitForm(event, manualStackTop === null ? null : { kind: 'manual-resolve', entryId: manualStackTop.id })}>
            <p className="online-tabletop-manual__hint">現在の最上段: {manualStackTop?.label ?? 'ありません'}</p>
            <button className="online-tabletop-manual__button" data-testid="online-tabletop-submit-manual-resolve" type="submit" disabled={disabled || hasAnyHold || !isSteward || manualStackTop === null || manualStackTop.authorPlayerId !== actor}>Manual Resolve（最上段）</button>
          </form>
        </section>
      </div>

      <section className="online-tabletop-manual__successor" aria-labelledby="online-tabletop-successor-title">
        <h3 id="online-tabletop-successor-title">次の情報操作</h3>
        <p>Look・Reveal・Choose は、隣接する（画面幅により下に表示される）「見る・公開する・選ぶ」パネルから実行してください。ここは互換表示のため無効です。</p>
        <div className="online-tabletop-manual__successor-actions">
          <button type="button" data-testid="online-tabletop-disabled-look" disabled>Look（見る）</button>
          <button type="button" data-testid="online-tabletop-disabled-reveal" disabled>Reveal（公開）</button>
          <button type="button" data-testid="online-tabletop-disabled-choose" disabled>Choose（選択）</button>
        </div>
      </section>
    </section>
  );
}
