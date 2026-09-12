import type { GameCommand } from '../../engine/commands';
export function cockpitCostText(command: GameCommand, name: (id: string) => string): string {
  switch (command.type) {
    case 'setTapped':
      return `《${name(command.cardId)}》をタップ`;
    case 'addMana':
      return `${command.color}を${command.amount}生成`;
    case 'payMana':
      return `マナ支払い ${
        Object.entries(command.payment)
          .filter(([, amount]) => amount)
          .map(([color, amount]) => `${color}${amount}`)
          .join(' / ') || 'なし'
      }`;
    case 'adjustLife':
      return `ライフ ${command.delta}`;
    case 'dealDamage':
      return `${command.amount}ダメージ`;
    case 'moveCard':
      return `《${name(command.cardId)}》を${command.to === 'graveyard' ? '墓地' : command.to === 'hand' ? '手札' : command.to === 'exile' ? '追放' : command.to}へ`;
    case 'addCounters':
      return `《${name(command.cardId)}》の${command.counterType} ${command.delta}`;
    default:
      return '未対応のコスト';
  }
}
