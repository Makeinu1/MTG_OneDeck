import type { CockpitTable } from '../../engine/cockpitTable';
import type { PermanentEntrySetupDraft } from './cockpitPermanentEntrySetup';

export function CockpitPermanentEntrySetup({
  table,
  cardId,
  value,
  onChange,
}: {
  table: CockpitTable;
  cardId: string;
  value: PermanentEntrySetupDraft;
  onChange: (value: PermanentEntrySetupDraft) => void;
}) {
  const card = table.cards[cardId];
  const face = table.defs[card?.defId]?.faces[card?.faceIndex ?? 0];
  const typeLine = face?.typeLine ?? '';
  const battlefield = Object.values(table.cards).filter(
    (candidate) => candidate.zone === 'battlefield' && candidate.id !== cardId,
  );
  const name = (id: string) => {
    const candidate = table.cards[id];
    const def = candidate && table.defs[candidate.defId];
    return def?.printedName ?? def?.name ?? id;
  };
  return (
    <details className="cockpit-session__tools" data-testid="permanent-entry-setup">
      <summary>戦場に出る状態</summary>
      <p>戦場に出る瞬間の有限な状態だけを指定します。カード本文の一般裁定は行いません。</p>
      <label>
        <input
          type="checkbox"
          checked={value.tapped}
          onChange={(event) => onChange({ ...value, tapped: event.target.checked })}
        />
        タップ状態で戦場に出す
      </label>
      <label>
        カウンター名
        <input
          aria-label="戦場に出るカウンター名"
          value={value.counterName}
          maxLength={100}
          onChange={(event) => onChange({ ...value, counterName: event.target.value })}
        />
      </label>
      <label>
        個数
        <input
          aria-label="戦場に出るカウンター数"
          type="number"
          min="0"
          max="100000"
          value={value.counterCount}
          onChange={(event) =>
            onChange({
              ...value,
              counterCount: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
            })
          }
        />
      </label>
      <label>
        コントローラー
        <select
          aria-label="戦場に出るコントローラー"
          value={value.controllerId}
          onChange={(event) => onChange({ ...value, controllerId: event.target.value })}
        >
          <option value="">通常どおり</option>
          {table.seats.filter((seat) => !seat.eliminated).map((seat) => (
            <option key={seat.id} value={seat.id}>{seat.label}</option>
          ))}
        </select>
      </label>
      {/\bAura\b/.test(typeLine) && (
        <label>
          付けた状態で出す
          <select
            aria-label="戦場に出るオーラの付与先"
            value={value.attachmentTargetId}
            onChange={(event) => onChange({ ...value, attachmentTargetId: event.target.value })}
          >
            <option value="">指定なし</option>
            {battlefield.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>《{name(candidate.id)}》</option>
            ))}
          </select>
        </label>
      )}
      {/\bBattle\b/.test(typeLine) && (
        <label>
          守備プレイヤー
          <select
            aria-label="戦場に出るバトルの守備プレイヤー"
            value={value.protectorId}
            onChange={(event) => onChange({ ...value, protectorId: event.target.value })}
          >
            <option value="">指定なし</option>
            {table.seats.filter((seat) => !seat.eliminated).map((seat) => (
              <option key={seat.id} value={seat.id}>{seat.label}</option>
            ))}
          </select>
        </label>
      )}
    </details>
  );
}
