import { useState } from 'react';
import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
import { Modal } from '../Modal';

export function CockpitBattleTools({
  table,
  selected,
  disabled,
  defendingSeatId,
  canBlock = false,
  send,
}: {
  table: CockpitTable;
  selected: string[];
  disabled: boolean;
  defendingSeatId?: string;
  canBlock?: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
}) {
  const [target, setTarget] = useState(
    table.seats.find((seat) => seat.id !== table.activeSeatId)?.id ?? '',
  );
  const [individualTargets, setIndividualTargets] = useState<Record<string, string>>({});
  const [leaveUntapped, setLeaveUntapped] = useState<string[]>([]);
  const [blockTargets, setBlockTargets] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [damageTarget, setDamageTarget] = useState('');
  const [amount, setAmount] = useState(0);
  const [assignments, setAssignments] = useState<
    { sourceId: string; targetId: string; amount: number }[]
  >([]);
  const [confirmAttack, setConfirmAttack] = useState(false);
  const name = (id: string) => {
    const card = table.cards[id];
    const def = table.defs[card?.defId];
    if (!card) return table.seats.find((seat) => seat.id === id)?.label ?? id;
    const owner = table.seats.find((seat) => seat.id === card.ownerId);
    const controller = table.seats.find((seat) => seat.id === card.controllerId);
    return `${def?.printedName ?? def?.name}・${controller?.label} #${(owner?.zones[card.zone].indexOf(id) ?? -1) + 1}`;
  };
  const combat = table.combat;
  const blockSeat = disabled
    ? defendingSeatId
    : (table.cards[selected[0]]?.controllerId ?? defendingSeatId);
  const blockSelected = selected.filter(
    (id) => !blockSeat || table.cards[id]?.controllerId === blockSeat,
  );
  const blockDisabled = disabled && !canBlock;
  const participants = combat ? [...combat.attackers, ...combat.blockers] : [];
  const targets = [
    ...table.seats.map((seat) => seat.id),
    ...Object.values(table.cards)
      .filter((card) => card.zone === 'battlefield')
      .map((card) => card.id),
  ];
  const attackTargets = targets.filter(
    (id) => id !== table.activeSeatId && table.cards[id]?.controllerId !== table.activeSeatId,
  );
  const attackTarget = attackTargets.includes(target) ? target : (attackTargets[0] ?? '');
  function power(id: string) {
    const card = table.cards[id];
    const printed = Number(table.defs[card.defId].faces[card.faceIndex]?.power);
    return Number.isFinite(printed)
      ? printed +
          (card.counters['+1/+1'] ?? 0) -
          (card.counters['-1/-1'] ?? 0) +
          table.modifiers
            .filter((modifier) => modifier.cardId === id)
            .reduce((sum, modifier) => sum + modifier.power, 0)
      : null;
  }
  return (
    <details className="cockpit-session__tools">
      <summary>戦闘の関係・ダメージ割当</summary>
      {combat?.legacyDeclaration && (
        <p>
          旧保存の戦闘宣言を保持しています。
          {combat.legacyDeclaration.step === 'endOfCombat'
            ? '旧経路でのダメージ処理は終了済みです。再適用せず、数値を確認して戦闘を終了してください。'
            : '旧経路には未確定の割当量が保存されていません。関係と盤面を確認して手動で割り当ててください。'}
        </p>
      )}
      <p>
        攻撃・ブロックの合法性、置換・軽減、先制攻撃などの手順は人が判断します。致死移動と勝敗は自動確定しません。
      </p>
      {!combat ? (
        <>
          <label>
            攻撃先{' '}
            <select value={attackTarget} onChange={(event) => setTarget(event.target.value)}>
              {targets
                .filter(
                  (id) =>
                    id !== table.activeSeatId &&
                    table.cards[id]?.controllerId !== table.activeSeatId,
                )
                .map((id) => (
                  <option key={id} value={id}>
                    {name(id)}
                  </option>
                ))}
            </select>
          </label>
          <p>盤面で攻撃するカードを選んでください。警戒などでタップしないカードだけ指定します。</p>
          {selected.map((id) => (
            <label key={id}>
              《{name(id)}》の攻撃先{' '}
              <select
                aria-label={`${name(id)}の攻撃先`}
                value={individualTargets[id] ?? attackTarget}
                onChange={(event) =>
                  setIndividualTargets({ ...individualTargets, [id]: event.target.value })
                }
              >
                {attackTargets.map((targetId) => (
                  <option key={targetId} value={targetId}>
                    {name(targetId)}
                  </option>
                ))}
              </select>
              <input
                type="checkbox"
                checked={leaveUntapped.includes(id)}
                onChange={() =>
                  setLeaveUntapped(
                    leaveUntapped.includes(id)
                      ? leaveUntapped.filter((value) => value !== id)
                      : [...leaveUntapped, id],
                  )
                }
              />
              《{name(id)}》をタップしない
            </label>
          ))}
          <button
            disabled={
              disabled ||
              table.hold ||
              !selected.length ||
              table.stack.length > 0 ||
              Boolean(table.resolution)
            }
            onClick={() => setConfirmAttack(true)}
          >
            攻撃の登録内容を確認
          </button>
        </>
      ) : (
        <>
          <ul>
            {combat.attackers.map((entry) => (
              <li key={entry.cardId}>
                《{name(entry.cardId)}》 → {name(entry.targetId)}
              </li>
            ))}
          </ul>
          <fieldset>
            <legend>選択した防御カードのブロック先</legend>
            {combat.attackers.map((entry) => (
              <label key={entry.cardId}>
                <input
                  type="checkbox"
                  checked={blockTargets.includes(entry.cardId)}
                  onChange={() =>
                    setBlockTargets(
                      blockTargets.includes(entry.cardId)
                        ? blockTargets.filter((id) => id !== entry.cardId)
                        : [...blockTargets, entry.cardId],
                    )
                  }
                />
                《{name(entry.cardId)}》
              </label>
            ))}
            <button
              disabled={
                blockDisabled ||
                combat.damageApplied ||
                (combat.damageStep ?? 1) > 1 ||
                !blockSelected.length ||
                !blockTargets.length
              }
              onClick={() =>
                void send({
                  type: 'battle.block',
                  defendingSeatId: blockSeat,
                  blockers: [
                    ...combat.blockers
                      .filter(
                        (entry) =>
                          (!blockSeat || table.cards[entry.cardId]?.controllerId === blockSeat) &&
                          !blockSelected.includes(entry.cardId),
                      )
                      .map((entry) => ({ cardId: entry.cardId, attackerIds: entry.attackerIds })),
                    ...blockSelected.map((cardId) => ({ cardId, attackerIds: blockTargets })),
                  ],
                })
              }
            >
              選択したカードのブロックを登録
            </button>
          </fieldset>
          <ul>
            {combat.blockers.map((entry) => (
              <li key={entry.cardId}>
                《{name(entry.cardId)}》が{' '}
                {entry.attackerIds.map((id) => `《${name(id)}》`).join('、')}をブロック{' '}
                <button
                  disabled={disabled || combat.damageApplied}
                  onClick={() =>
                    void send({
                      type: 'battle.block',
                      defendingSeatId: blockSeat,
                      blockers: combat.blockers.filter(
                        (item) =>
                          item.cardId !== entry.cardId &&
                          (!blockSeat || table.cards[item.cardId]?.controllerId === blockSeat),
                      ),
                    })
                  }
                >
                  このブロックを外す
                </button>
              </li>
            ))}
          </ul>
          <label>
            ダメージの発生源{' '}
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">選択</option>
              {participants.map((entry) => (
                <option key={entry.cardId} value={entry.cardId}>
                  《{name(entry.cardId)}》
                </option>
              ))}
            </select>
          </label>
          <label>
            ダメージの対象{' '}
            <select value={damageTarget} onChange={(event) => setDamageTarget(event.target.value)}>
              <option value="">選択</option>
              {targets.map((id) => (
                <option key={id} value={id}>
                  {name(id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            割当ダメージ{' '}
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
          </label>
          <button
            disabled={disabled || combat.damageApplied || !source || !damageTarget || amount < 0}
            onClick={() =>
              setAssignments([...assignments, { sourceId: source, targetId: damageTarget, amount }])
            }
          >
            割当案へ追加
          </button>
          <ol>
            {assignments.map((entry, index) => (
              <li key={index}>
                《{name(entry.sourceId)}》→{name(entry.targetId)}: {entry.amount}{' '}
                <button onClick={() => setAssignments(assignments.filter((_, i) => i !== index))}>
                  割当案から外す
                </button>
              </li>
            ))}
          </ol>
          {participants.map((entry) => (
            <p key={entry.cardId}>
              《{name(entry.cardId)}》: 本文の数値＋明示修整 {power(entry.cardId) ?? '要確認'} /
              割当案の合計{' '}
              {assignments
                .filter((item) => item.sourceId === entry.cardId)
                .reduce((sum, item) => sum + item.amount, 0)}
            </p>
          ))}
          <button
            disabled={disabled || combat.damageApplied || !assignments.length}
            onClick={() => void send({ type: 'battle.assign', assignments })}
          >
            この割当を確定
          </button>
          <p>
            確定済みの割当:{' '}
            {combat.assignments
              .map((entry) => `${name(entry.sourceId)}→${name(entry.targetId)} ${entry.amount}`)
              .join(' / ') || 'なし'}
          </p>
          <button
            disabled={
              disabled ||
              table.hold ||
              combat.damageApplied ||
              !combat.assignments.length ||
              table.stack.length > 0 ||
              Boolean(table.resolution)
            }
            onClick={() => void send({ type: 'battle.apply' })}
          >
            確定したダメージを一括反映
          </button>
          <p>
            ダメージ第{combat.damageStep ?? 1}
            段階。プレインズウォーカーは忠誠度、バトルは守備値を減らします。致死移動は手動です。
          </p>
          {combat.damageApplied && (combat.damageStep ?? 1) === 1 && (
            <button
              disabled={
                disabled || table.hold || Boolean(table.resolution) || table.stack.length > 0
              }
              onClick={() =>
                void send({ type: 'battle.nextDamage' }).then((saved) => {
                  if (saved) setAssignments([]);
                })
              }
            >
              先制攻撃の処理後、通常ダメージ段階を準備
            </button>
          )}
          {combat.damageApplied && (
            <p>
              反映済み。再適用しません。記録ダメージ・ライフと必要な手動処理を確認してください。
            </p>
          )}
          <button
            disabled={disabled}
            onClick={() =>
              void send({ type: 'battle.end' }).then((saved) => {
                if (saved) {
                  setAssignments([]);
                  setBlockTargets([]);
                }
              })
            }
          >
            戦闘の処理を終える
          </button>
        </>
      )}
      {confirmAttack && (
        <Modal title="攻撃の登録内容" onClose={() => setConfirmAttack(false)} allowBoardPeek>
          <p>
            {selected
              .map((id) => `《${name(id)}》 → ${name(individualTargets[id] ?? attackTarget)}`)
              .join('、')}
          </p>
          <p>
            タップ:{' '}
            {selected
              .filter((id) => !leaveUntapped.includes(id))
              .map(name)
              .join('、') || 'なし'}
          </p>
          <button
            disabled={disabled}
            onClick={() =>
              void send({
                type: 'battle.attack',
                attackers: selected.map((cardId) => ({
                  cardId,
                  targetId: individualTargets[cardId] ?? attackTarget,
                })),
                tapIds: selected.filter((id) => !leaveUntapped.includes(id)),
              }).then((saved) => {
                if (saved) setConfirmAttack(false);
              })
            }
          >
            攻撃を登録
          </button>
        </Modal>
      )}
    </details>
  );
}
