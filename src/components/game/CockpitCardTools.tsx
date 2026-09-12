import { useState } from 'react';
import type { ManaColor } from '../../types/card';
import type {
  CockpitTable,
  TableOperation,
  TableTokenCharacteristics,
} from '../../engine/cockpitTable';

export function CockpitCardTools({
  table,
  cardId,
  disabled,
  send,
}: {
  table: CockpitTable;
  cardId: string;
  disabled: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
}) {
  const card = table.cards[cardId];
  const [target, setTarget] = useState('');
  const [source, setSource] = useState(table.resolution?.source.id ?? '');
  const [duration, setDuration] = useState('ターン終了まで');
  const [power, setPower] = useState(0);
  const [toughness, setToughness] = useState(0);
  const [audience, setAudience] = useState<string[]>(table.visibility[cardId] ?? []);
  const name = (id: string) => {
    const def = table.defs[table.cards[id]?.defId];
    return def?.printedName ?? def?.name ?? id;
  };
  return (
    <details>
      <summary>状態・修整・関連</summary>
      {card.isToken && (
        <CockpitTokenEditor table={table} cardId={cardId} disabled={disabled} send={send} />
      )}
      {card.isCommander && (
        <fieldset>
          <legend>統率者</legend>
          <p>
            統率領域から唱えた回数 {table.commanderCasts[cardId] ?? 0} / 次回の統率者税{' '}
            {2 * (table.commanderCasts[cardId] ?? 0)}
          </p>
          <button
            disabled={disabled || !(table.commanderCasts[cardId] ?? 0)}
            onClick={() =>
              void send({
                type: 'commanderCount',
                cardId,
                count: (table.commanderCasts[cardId] ?? 0) - 1,
              })
            }
          >
            唱えた回数を1減らす
          </button>
          <button
            disabled={disabled}
            onClick={() =>
              void send({
                type: 'commanderCount',
                cardId,
                count: (table.commanderCasts[cardId] ?? 0) + 1,
              })
            }
          >
            唱えた回数を1増やす
          </button>
          <p>移動先は領域操作で明示してください。統率領域へ自動では置き換えません。</p>
        </fieldset>
      )}
      <p>
        カウンター:{' '}
        {Object.entries(card.counters)
          .map(([name, value]) => `${name} ${value}`)
          .join(' / ') || 'なし'}{' '}
        / 記録ダメージ {card.damageMarked}
      </p>
      <p>添付先: {card.attachedTo ? `《${name(card.attachedTo)}》` : 'なし'}</p>
      <label>
        表示する面{' '}
        <select
          value={card.faceIndex}
          disabled={disabled}
          onChange={(event) =>
            void send({
              type: 'face',
              cardId,
              faceIndex: Number(event.target.value),
              faceDown: card.faceDown,
            })
          }
        >
          {table.defs[card.defId].faces.map((face, index) => (
            <option key={index} value={index}>
              {face.printedName ?? face.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={disabled}
        onClick={() =>
          void send({ type: 'face', cardId, faceIndex: card.faceIndex, faceDown: !card.faceDown })
        }
      >
        {card.faceDown ? '表向きにする' : '裏向きにする'}
      </button>
      {card.zone === 'battlefield' && (
        <>
          <label>
            コントローラー{' '}
            <select
              disabled={disabled}
              value={card.controllerId}
              onChange={(event) =>
                void send({ type: 'control', ids: [cardId], seatId: event.target.value })
              }
            >
              {table.seats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            添付する対象{' '}
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">対象を選択</option>
              {Object.values(table.cards)
                .filter((item) => item.zone === 'battlefield' && item.id !== cardId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    《{name(item.id)}》・
                    {table.seats.find((seat) => seat.id === item.controllerId)?.label}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={disabled || !target}
            onClick={() => void send({ type: 'attach', cardId, targetId: target })}
          >
            添付する
          </button>
          <button
            disabled={disabled || !card.attachedTo}
            onClick={() => void send({ type: 'attach', cardId, targetId: null })}
          >
            添付を外す
          </button>
          <label>
            パワー修整{' '}
            <input
              type="number"
              value={power}
              onChange={(event) => setPower(Number(event.target.value))}
            />
          </label>
          <label>
            タフネス修整{' '}
            <input
              type="number"
              value={toughness}
              onChange={(event) => setToughness(Number(event.target.value))}
            />
          </label>
          <label>
            期間・解除条件{' '}
            <input value={duration} onChange={(event) => setDuration(event.target.value)} />
          </label>
          <label>
            由来のカード{' '}
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">指定なし</option>
              {Object.keys(table.cards).map((id) => (
                <option key={id} value={id}>
                  《{name(id)}》
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={disabled}
            onClick={() =>
              void send({
                type: 'modifier',
                modifier: {
                  id: crypto.randomUUID(),
                  cardId,
                  power,
                  toughness,
                  duration,
                  sourceId: source || null,
                },
                remove: false,
              })
            }
          >
            修整を追加
          </button>
          {table.modifiers
            .filter((item) => item.cardId === cardId)
            .map((item) => (
              <p key={item.id}>
                {item.power >= 0 ? '+' : ''}
                {item.power}/{item.toughness >= 0 ? '+' : ''}
                {item.toughness}・{item.duration}・由来{' '}
                {item.sourceId ? `《${name(item.sourceId)}》` : '指定なし'}{' '}
                <button
                  disabled={disabled}
                  onClick={() => void send({ type: 'modifier', modifier: item, remove: true })}
                >
                  修整を解除
                </button>
              </p>
            ))}
        </>
      )}
      <fieldset>
        <legend>明示する閲覧範囲</legend>
        <p>一人回しの操作者は全席を代行できます。必要な席だけを選んで公開を確定してください。</p>
        {table.seats.map((seat) => (
          <label key={seat.id}>
            <input
              type="checkbox"
              checked={audience.includes(seat.id)}
              onChange={() =>
                setAudience(
                  audience.includes(seat.id)
                    ? audience.filter((id) => id !== seat.id)
                    : [...audience, seat.id],
                )
              }
            />
            {seat.label}
          </label>
        ))}
        <button
          disabled={disabled}
          onClick={() => void send({ type: 'visibility', ids: [cardId], seatIds: audience })}
        >
          選んだ席への公開を確定
        </button>
        <p>
          現在の公開先:{' '}
          {(table.visibility[cardId] ?? [])
            .map((id) => table.seats.find((seat) => seat.id === id)?.label)
            .join('、') || '明示公開なし'}
        </p>
      </fieldset>
      {card.zone === 'exile' && (
        <>
          <label>
            追放の発生源{' '}
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">選択</option>
              {Object.keys(table.cards)
                .filter((id) => id !== cardId)
                .map((id) => (
                  <option key={id} value={id}>
                    《{name(id)}》
                  </option>
                ))}
            </select>
          </label>
          <label>
            関連の期間{' '}
            <input value={duration} onChange={(event) => setDuration(event.target.value)} />
          </label>
          <button
            disabled={disabled || !source}
            onClick={() =>
              void send({ type: 'link', sourceId: source, ids: [cardId], duration, remove: false })
            }
          >
            追放との関連を追加
          </button>
        </>
      )}
      {table.linkedExiles
        .filter(
          (link) => link.sourcePhysicalId === cardId || link.exiledPhysicalIds.includes(cardId),
        )
        .map((link) => (
          <p key={link.linkId}>
            《{name(link.sourcePhysicalId)}》 →{' '}
            {link.exiledPhysicalIds.map((id) => `《${name(id)}》`).join('、')} /{' '}
            {link.duration ?? '旧保存の関連'}{' '}
            <button
              disabled={disabled}
              onClick={() =>
                void send({
                  type: 'link',
                  sourceId: link.sourcePhysicalId,
                  ids: link.exiledPhysicalIds,
                  duration: '',
                  remove: true,
                })
              }
            >
              関連を解除
            </button>
          </p>
        ))}
    </details>
  );
}

export function CockpitTokenTools({
  table,
  seatId,
  selected,
  disabled,
  send,
}: {
  table: CockpitTable;
  seatId: string;
  selected: string[];
  disabled: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
}) {
  const [name, setName] = useState('兵士');
  const [typeLine, setTypeLine] = useState('Creature — Soldier');
  const [power, setPower] = useState('1');
  const [toughness, setToughness] = useState('1');
  const [text, setText] = useState('');
  const [colors, setColors] = useState<ManaColor[]>([]);
  const source = selected.length === 1 ? table.cards[selected[0]] : null;
  return (
    <details className="cockpit-session__tools">
      <summary>トークン・パーマネントのコピーを生成</summary>
      <p>生成先: {table.seats.find((seat) => seat.id === seatId)?.label}</p>
      <TokenCharacteristicsFields
        value={{ name, typeLine, power, toughness, text, colors }}
        onChange={(value) => {
          setName(value.name);
          setTypeLine(value.typeLine);
          setPower(value.power);
          setToughness(value.toughness);
          setText(value.text);
          setColors(value.colors ?? []);
        }}
      />
      <button
        disabled={disabled || !name.trim() || !typeLine.trim()}
        onClick={() =>
          void send({
            type: 'token',
            id: crypto.randomUUID(),
            seatId,
            name,
            typeLine,
            power,
            toughness,
            text,
            colors,
          })
        }
      >
        この特徴でトークンを生成
      </button>
      <p>
        コピーは選んだ表向きのパーマネントの現在の面を使用します。カウンター・記録ダメージ・修整・タップ・添付・統率者指定は引き継ぎません。特別なコピーの変更は生成後に明示してください。
      </p>
      <button
        disabled={disabled || source?.zone !== 'battlefield' || source.faceDown}
        onClick={() =>
          source &&
          void send({ type: 'copyPermanent', id: crypto.randomUUID(), seatId, sourceId: source.id })
        }
      >
        選択した1枚のコピー・トークンを生成
      </button>
    </details>
  );
}

function TokenCharacteristicsFields({
  value,
  onChange,
}: {
  value: TableTokenCharacteristics;
  onChange: (value: TableTokenCharacteristics) => void;
}) {
  return (
    <>
      <label>
        トークン名
        <input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </label>
      <label>
        タイプ
        <input
          value={value.typeLine}
          onChange={(event) => onChange({ ...value, typeLine: event.target.value })}
        />
      </label>
      <label>
        パワー
        <input
          value={value.power}
          onChange={(event) => onChange({ ...value, power: event.target.value })}
        />
      </label>
      <label>
        タフネス
        <input
          value={value.toughness}
          onChange={(event) => onChange({ ...value, toughness: event.target.value })}
        />
      </label>
      <label>
        能力本文
        <textarea
          value={value.text}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
        />
      </label>
      <fieldset>
        <legend>色（無選択は無色。固有色とは別）</legend>
        {(['W', 'U', 'B', 'R', 'G'] as const).map((color) => (
          <label key={color}>
            <input
              type="checkbox"
              checked={value.colors?.includes(color) ?? false}
              onChange={(event) =>
                onChange({
                  ...value,
                  colors: event.target.checked
                    ? [...(value.colors ?? []), color]
                    : value.colors?.filter((item) => item !== color),
                })
              }
            />
            {color}
          </label>
        ))}
      </fieldset>
    </>
  );
}

function CockpitTokenEditor({
  table,
  cardId,
  disabled,
  send,
}: {
  table: CockpitTable;
  cardId: string;
  disabled: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<TableTokenCharacteristics | null>(null);
  const card = table.cards[cardId];
  const face = table.defs[card.defId].faces[card.faceIndex];
  return (
    <fieldset>
      <legend>トークン・コピーの特徴</legend>
      <p>
        {face.typeLine} / {face.power ?? '—'}/{face.toughness ?? '—'} / 色:{' '}
        {face.colors?.join('・') || (face.colors ? '無色' : '本文を確認')}
      </p>
      <p>
        コピー元、所有者、カウンター、添付、期間付き修整はこの変更でも保持します。ここではコピー可能な基本の特徴を指定します。
      </p>
      {!draft ? (
        <button
          disabled={disabled || card.zone !== 'battlefield' || card.faceDown}
          onClick={() =>
            setDraft({
              name: face.printedName ?? face.name,
              typeLine: face.typeLine,
              power: face.power ?? '',
              toughness: face.toughness ?? '',
              text: face.oracleText ?? '',
              colors:
                face.colors ??
                (['W', 'U', 'B', 'R', 'G'] as const).filter((color) =>
                  face.manaCost?.includes(color),
                ),
            })
          }
        >
          特徴・コピーの例外を編集
        </button>
      ) : (
        <>
          <TokenCharacteristicsFields value={draft} onChange={setDraft} />
          <button
            disabled={disabled}
            onClick={() =>
              void send({
                type: 'token.edit',
                cardId,
                definitionId: crypto.randomUUID(),
                value: draft,
              }).then((saved) => {
                if (saved) setDraft(null);
              })
            }
          >
            この特徴へ変更
          </button>
          <button onClick={() => setDraft(null)}>特徴の編集を取消</button>
        </>
      )}
    </fieldset>
  );
}
