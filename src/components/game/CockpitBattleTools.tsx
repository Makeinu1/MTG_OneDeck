import { useEffect, useRef, useState } from 'react';
import { CardView } from '../CardView';
import { cockpitPowerToughness } from '../../engine/cockpitPowerToughness';
import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
import { readyTableTriggers } from '../../engine/cockpitTriggers';

export function CockpitBattleTools({
  table,
  selected,
  disabled,
  defendingSeatId,
  canBlock = false,
  send,
  visible = true,
}: {
  visible?: boolean;
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
  const [front, setFront] = useState('all');
  const [source, setSource] = useState('');
  const [damageTarget, setDamageTarget] = useState('');
  const [amount, setAmount] = useState(0);
  const [assignments, setAssignments] = useState<
    { sourceId: string; targetId: string; amount: number }[]
  >([]);
  const [draftContext, setDraftContext] = useState<string | null>(null);
  const section = useRef<HTMLDetailsElement>(null);
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
  const pendingTriggers = readyTableTriggers(table).length > 0;
  const blockDisabled = (disabled && !canBlock) || pendingTriggers;
  const participants = combat ? [...combat.attackers, ...combat.blockers.filter((entry) => entry.attackerIds.length > 0)] : [];
  const targets = [
    ...table.seats.filter((seat) => !seat.eliminated).map((seat) => seat.id),
    ...Object.values(table.cards)
      .filter((card) => card.zone === 'battlefield')
      .map((card) => card.id),
  ];
  const attackTargets = targets.filter(
    (id) => id !== table.activeSeatId && table.cards[id]?.controllerId !== table.activeSeatId,
  );
  const attackTarget = attackTargets.includes(target) ? target : (attackTargets[0] ?? '');
  const power = (id: string) => cockpitPowerToughness(table, id)?.power ?? null;
  const focusBattle = visible && (table.phase === 'combat' || !!combat);
  useEffect(() => {
    if (focusBattle) section.current?.scrollIntoView({ block: 'nearest' });
  }, [focusBattle]);
  const stamp = (items: typeof assignments) =>
    JSON.stringify({
      attackers: combat?.attackers,
      blockers: combat?.blockers,
      step: combat?.damageStep,
      applied: combat?.damageApplied,
      objects: [...new Set(items.flatMap((item) => [item.sourceId, item.targetId]))].map((id) => {
        const card = table.cards[id];
        return card ? [id, card.zone, card.zoneChangeCounter, power(id)] : [id];
      }),
    });
  const staleDraft = assignments.length > 0 && draftContext !== stamp(assignments);
  function draft(next: typeof assignments) {
    if (next.length && staleDraft) return;
    setAssignments(next);
    setDraftContext(stamp(next));
  }
  const canSuggest =
    combat &&
    !combat.damageApplied &&
    !combat.blockers.length &&
    combat.attackers.length > 0 &&
    combat.attackers.every((entry) =>
      entry.blocked === false && !entry.targetRemoved && targets.includes(entry.targetId) && power(entry.cardId) !== null,
    );
  const canCommit =
    !disabled && !table.hold && !table.stack.length && !table.resolution && !pendingTriggers && !combat?.damageApplied;
  const hasDefenders =
    combat &&
    Object.values(table.cards).some(
      (card) => card.zone === 'battlefield' && card.controllerId !== table.activeSeatId,
    );
  return (
    <details
      className="cockpit-session__tools"
      ref={section}
      open={table.phase === 'combat' || !!combat || undefined}
    >
      <summary>攻撃・ブロック・ダメージ</summary>
      {combat?.legacyDeclaration && (
        <p>
          旧保存の戦闘宣言を保持しています。
          {combat.legacyDeclaration.step === 'endOfCombat'
            ? '旧経路でのダメージ処理は終了済みです。再適用せず、数値を確認して戦闘を終了してください。'
            : '旧経路には未確定の割当量が保存されていません。関係と盤面を確認して手動で割り当ててください。'}
        </p>
      )}
      <p>手動戦闘 · 合法性・先制攻撃・軽減・致死を確認</p>
      {pendingTriggers && <p role="status">先にFeedで誘発を確認・登録し、解決してから戦闘を進めてください。</p>}
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
              pendingTriggers ||
              !selected.length ||
              table.stack.length > 0 ||
              Boolean(table.resolution)
            }
            onClick={() =>
              void send({
                type: 'battle.attack',
                attackers: selected.map((cardId) => ({
                  cardId,
                  targetId: individualTargets[cardId] ?? attackTarget,
                })),
                tapIds: selected.filter((id) => !leaveUntapped.includes(id)),
              })
            }
          >
            このカードで攻撃
          </button>
        </>
      ) : (
        <>
          <nav className="table-battle-fronts" aria-label="戦闘の相手">
            <button aria-pressed={front === 'all'} onClick={() => setFront('all')}>
              全員
            </button>
            {[...new Set(combat.attackers.map((entry) => entry.targetId))].map((id) => (
              <button key={id} aria-pressed={front === id} onClick={() => setFront(id)}>
                {name(id)}
              </button>
            ))}
          </nav>
          <div className="table-battle-lanes">
            {combat.attackers
              .filter(
                (entry) =>
                  front === 'all' ||
                  !combat.attackers.some((item) => item.targetId === front) ||
                  entry.targetId === front,
              )
              .map((entry) => (
                <section
                  className="table-battle-lane"
                  key={entry.cardId}
                  aria-label={`${name(entry.cardId)} → ${name(entry.targetId)}`}
                >
                  <div>
                    {table.cards[entry.cardId] && (
                      <CardView
                        instance={{ ...table.cards[entry.cardId], tapped: false }}
                        def={table.defs[table.cards[entry.cardId].defId]}
                        size="small"
                        draggable={false}
                      />
                    )}
                    <small>《{name(entry.cardId)}》</small>
                  </div>
                  <span aria-hidden="true">→</span>
                  <div className="table-battle-defenders">
                    <strong>{entry.targetRemoved ? '攻撃先は戦闘から離れました' : name(entry.targetId)}</strong>
                    {combat.blockers
                      .filter((blocker) => blocker.attackerIds.includes(entry.cardId))
                      .map((blocker) => (
                        <div key={blocker.cardId}>
                          {table.cards[blocker.cardId] && (
                            <CardView
                              instance={{ ...table.cards[blocker.cardId], tapped: false }}
                              def={table.defs[table.cards[blocker.cardId].defId]}
                              size="small"
                              draggable={false}
                            />
                          )}
                          <small>《{name(blocker.cardId)}》</small>
                        </div>
                      ))}
                    {!combat.blockers.some((blocker) =>
                      blocker.attackerIds.includes(entry.cardId),
                    ) && <small>{entry.blocked === true ? 'ブロック済み（ブロッカーなし）' : entry.blocked === false ? 'ブロックなし' : 'ブロック状態は要確認'}</small>}
                  </div>
                </section>
              ))}
          </div>
          {hasDefenders && (
            <details>
              <summary>ブロックを登録する</summary>
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
                              (!blockSeat ||
                                table.cards[entry.cardId]?.controllerId === blockSeat) &&
                              !blockSelected.includes(entry.cardId),
                          )
                          .map((entry) => ({
                            cardId: entry.cardId,
                            attackerIds: entry.attackerIds,
                          })),
                        ...blockSelected.map((cardId) => ({ cardId, attackerIds: blockTargets })),
                      ],
                    })
                  }
                >
                  選択したカードのブロックを登録
                </button>
              </fieldset>
            </details>
          )}
          <ul>
            {combat.blockers.map((entry) => (
              <li key={entry.cardId}>
                《{name(entry.cardId)}》が{' '}
                {entry.attackerIds.length ? `${entry.attackerIds.map((id) => `《${name(id)}》`).join('、')}をブロック` : 'ブロック相手は戦闘から離れました'}{' '}
                <button
                  disabled={disabled || pendingTriggers || combat.damageApplied}
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
          {!combat.damageApplied && (
            <section className="table-damage-draft" aria-label="ダメージの確認">
              <h3>ダメージを確認</h3>
              {!assignments.length && (
                <button
                  disabled={!canCommit || !canSuggest}
                  onClick={() =>
                    draft(
                      combat.attackers.map((entry) => ({
                        sourceId: entry.cardId,
                        targetId: entry.targetId,
                        amount: Math.max(0, power(entry.cardId)!),
                      })),
                    )
                  }
                >
                  ブロックなしの割当を作る
                </button>
              )}
              <p>割当案 · 軽減・置換・先制攻撃を確認</p>
              {staleDraft && (
                <p role="alert">
                  戦闘やカードが変わりました。案を取り消し、現在の盤面で作り直してください。
                </p>
              )}
              <ol className="table-damage-rows">
                {assignments.map((entry, index) => (
                  <li key={index}>
                    <strong>《{name(entry.sourceId)}》</strong>
                    <label>
                      与える相手
                      <select
                        aria-label={`${index + 1}件目のダメージ対象`}
                        value={entry.targetId}
                        disabled={staleDraft}
                        onChange={(event) =>
                          draft(
                            assignments.map((item, i) =>
                              i === index ? { ...item, targetId: event.target.value } : item,
                            ),
                          )
                        }
                      >
                        {targets.map((id) => (
                          <option key={id} value={id}>
                            {name(id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      点数
                      <input
                        aria-label={`${index + 1}件目のダメージ点数`}
                        type="number"
                        min="0"
                        value={entry.amount}
                        disabled={staleDraft}
                        onChange={(event) =>
                          draft(
                            assignments.map((item, i) =>
                              i === index ? { ...item, amount: Number(event.target.value) } : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      onClick={() => draft(assignments.filter((_, i) => i !== index))}
                      disabled={staleDraft}
                    >
                      外す
                    </button>
                  </li>
                ))}
              </ol>
              {assignments.length > 0 && (
                <>
                  {table.seats.map((seat) => {
                    const damage = assignments
                      .filter((item) => item.targetId === seat.id)
                      .reduce((sum, item) => sum + item.amount, 0);
                    return damage > 0 ? (
                      <p key={seat.id}>
                        {seat.label}: ライフ {seat.life} → {seat.life - damage}（{damage}点）
                      </p>
                    ) : null;
                  })}
                  <button
                    disabled={
                      !canCommit ||
                      staleDraft ||
                      assignments.some((item) => !Number.isInteger(item.amount) || item.amount < 0)
                    }
                    onClick={() =>
                      void send({ type: 'battle.apply', assignments }).then((saved) => {
                        if (saved) draft([]);
                      })
                    }
                  >
                    このダメージを反映
                  </button>
                  <button onClick={() => draft([])}>案を取り消す</button>
                </>
              )}
              <details>
                <summary>個別に割り当てる・割当だけ共有する</summary>
                <label>
                  発生源
                  <select value={source} onChange={(event) => setSource(event.target.value)}>
                    <option value="">選択</option>
                    {participants.map((entry) => (
                      <option key={entry.cardId} value={entry.cardId}>
                        {name(entry.cardId)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  与える相手
                  <select
                    value={damageTarget}
                    onChange={(event) => setDamageTarget(event.target.value)}
                  >
                    <option value="">選択</option>
                    {targets.map((id) => (
                      <option key={id} value={id}>
                        {name(id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  点数
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(event) => setAmount(Number(event.target.value))}
                  />
                </label>
                <button
                  disabled={
                    !canCommit ||
                    staleDraft ||
                    !source ||
                    !damageTarget ||
                    !Number.isInteger(amount) ||
                    amount < 0
                  }
                  onClick={() =>
                    draft([...assignments, { sourceId: source, targetId: damageTarget, amount }])
                  }
                >
                  割当に追加
                </button>
                <button
                  disabled={!canCommit || staleDraft || !assignments.length}
                  onClick={() => void send({ type: 'battle.assign', assignments })}
                >
                  割当だけ共有する
                </button>
              </details>
            </section>
          )}
          {combat.assignments.length > 0 && (
            <p>
              共有した割当:{' '}
              {combat.assignments
                .map(
                  (entry) => `${name(entry.sourceId)} → ${name(entry.targetId)}: ${entry.amount}点`,
                )
                .join(' / ')}
            </p>
          )}
          {!combat.damageApplied && combat.assignments.length > 0 && (
            <button
              disabled={!canCommit || assignments.length > 0}
              onClick={() => void send({ type: 'battle.apply' })}
            >
              共有した割当を反映
            </button>
          )}
          <p>
            ダメージ第{combat.damageStep ?? 1}
            段階。プレインズウォーカーは忠誠度、バトルは守備値を減らします。致死移動は手動です。
          </p>
          {combat.damageApplied && (combat.damageStep ?? 1) === 1 && (
            <button
              disabled={
                disabled || table.hold || pendingTriggers || Boolean(table.resolution) || table.stack.length > 0
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
            disabled={disabled || table.hold || pendingTriggers || !!table.resolution || table.stack.length > 0}
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
    </details>
  );
}
