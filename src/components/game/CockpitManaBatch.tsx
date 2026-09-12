import { useState } from 'react';
import { manaActivationChoices } from '../../engine/autotap';
import {
  tableManaResources,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import { Modal } from '../Modal';
import { cockpitCostText } from './cockpitCostText';
export function CockpitManaBatch({
  table,
  selected,
  disabled,
  send,
}: {
  table: CockpitTable;
  selected: string[];
  disabled: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
}) {
  const [rows, setRows] = useState<{ cardId: string; choice: number }[] | null>(null);
  const name = (id: string) => {
    const def = table.defs[table.cards[id]?.defId];
    return def?.printedName ?? def?.name ?? id;
  };
  const proposals = rows?.map((row) => {
    const card = table.cards[row.cardId];
    const choices = card
      ? manaActivationChoices(
          tableManaResources(table, card.controllerId),
          card.controllerId,
          card.id,
        )
      : [];
    return { ...row, choices, commands: choices[row.choice] };
  });
  return (
    <>
      <button
        disabled={disabled || !selected.length}
        onClick={() => setRows(selected.map((cardId) => ({ cardId, choice: 0 })))}
      >
        マナの出し方を確認
      </button>
      {rows && (
        <Modal title="まとめてマナを出す" onClose={() => setRows(null)} allowBoardPeek>
          <p>
            出す色と支払うコストを確認してください。マナを出した後で呪文を唱えるのをやめても、タップや支払いは元に戻りません。
          </p>
          {proposals?.map((row) => (
            <fieldset key={row.cardId}>
              <legend>
                《{name(row.cardId)}》・
                {
                  table.seats.find((seat) => seat.id === table.cards[row.cardId]?.controllerId)
                    ?.label
                }
              </legend>
              {row.choices.length ? (
                <select
                  aria-label={`${name(row.cardId)}のマナ生成案`}
                  value={row.choice}
                  onChange={(event) =>
                    setRows(
                      rows.map((item) =>
                        item.cardId === row.cardId
                          ? { ...item, choice: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                >
                  {row.choices.map((commands, index) => (
                    <option key={index} value={index}>
                      {commands.map((command) => cockpitCostText(command, name)).join(' / ')}
                    </option>
                  ))}
                </select>
              ) : (
                <p>
                  対応済みの生成案がありません。本文とコストを確認し、必要なら基本操作で手動調整してください。
                </p>
              )}
            </fieldset>
          ))}
          <button
            disabled={disabled || !proposals?.length || proposals.some((row) => !row.commands)}
            onClick={() =>
              void send({
                type: 'generateBatch',
                entries: proposals!.map((row) => ({ cardId: row.cardId, commands: row.commands })),
              }).then((saved) => {
                if (saved) setRows(null);
              })
            }
          >
            この内容でマナを出す
          </button>
        </Modal>
      )}
    </>
  );
}
