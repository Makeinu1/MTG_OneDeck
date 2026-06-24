// Reviewer-owned adversarial gold for M0-Z-O(Slice3 ゾーン+プレイヤー LLM-oracle ハーネスの機械部分)。
// 契約 = docs/oracle-harness.md §8(ZoneFacts schema・4軸比較・ownership 写像・KPI)。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側(scripts/lib/zoneOracleHarness.ts)を直す。
//
// 採点対象は純関数 computeZoneReport(GameState 非依存・決定的・scripts 配下)。
// LLM 予測そのもの(predictions.json の中身)は採点しない=データ扱い。
import { describe, expect, it } from 'vitest';

import type { OwnershipKind, PlayerScope } from '../../../scripts/lib/zoneClassify';
import { computeZoneReport, type ZoneFacts } from '../../../scripts/lib/zoneOracleHarness';
import type { ZoneId } from '../types';

function facts(partial: Partial<ZoneFacts>): ZoneFacts {
  return {
    zones: [],
    crossPlayer: false,
    refersToOwner: false,
    refersToController: false,
    playerScopes: [],
    uncertain: [],
    ...partial,
  };
}

function classifierCard(
  oracleId: string,
  zones: ZoneId[],
  crossPlayer: boolean,
  ownership: OwnershipKind,
  playerScopes: PlayerScope[],
) {
  return { oracleId, name: oracleId.toUpperCase(), zones, crossPlayer, ownership, playerScopes };
}

describe('M0-Z-O 4軸ゴールド: computeZoneReport(zones/crossPlayer/ownership/playerScopes)', () => {
  // a: 完全一致 / b: crossPlayer FN(分類器 false・オラクル true=照応露呈) / c: crossPlayer を uncertain マスク
  const classifier = [
    classifierCard('a', ['graveyard', 'library'], false, 'none', ['you']),
    classifierCard('b', ['hand'], false, 'none', ['target-player']),
    classifierCard('c', ['graveyard'], false, 'none', ['each-opponent']),
  ];
  const predictions = [
    {
      oracleId: 'a',
      name: 'A',
      facts: facts({ zones: ['graveyard', 'library'], playerScopes: ['you'] }),
    },
    {
      oracleId: 'b',
      name: 'B',
      facts: facts({ zones: ['hand'], crossPlayer: true, playerScopes: ['target-player'] }),
    },
    {
      oracleId: 'c',
      name: 'C',
      facts: facts({ zones: ['graveyard'], playerScopes: ['each-opponent'], uncertain: ['crossPlayer'] }),
    },
  ];
  const gold = [
    { oracleId: 'a', zones: ['graveyard', 'library'] as ZoneId[], crossPlayer: false, ownership: 'none' as OwnershipKind, playerScopes: ['you'] as PlayerScope[] },
    { oracleId: 'b', zones: ['hand'] as ZoneId[], crossPlayer: true, ownership: 'none' as OwnershipKind, playerScopes: ['target-player'] as PlayerScope[] },
  ];

  const report = computeZoneReport(classifier, predictions, gold);

  it('比較数 = 予測と分類器が揃ったカード数', () => {
    expect(report.comparedCount).toBe(3);
    expect(report.sampleSize).toBe(3);
  });

  it('crossPlayer 不一致率 = uncertain でない cross 不一致 / 比較数(b のみ・照応 FN の主指標)', () => {
    expect(report.crossPlayerDiscrepancyRate).toBeCloseTo(1 / 3, 6);
  });

  it('zones/ownership/playerScopes は全一致 → 各不一致率 0', () => {
    expect(report.zoneDiscrepancyRate).toBeCloseTo(0, 6);
    expect(report.ownershipDiscrepancyRate).toBeCloseTo(0, 6);
    expect(report.playerScopeDiscrepancyRate).toBeCloseTo(0, 6);
  });

  it('検証不能率 = uncertain を含むカード / サンプル数(c のみ・安全KPI)', () => {
    expect(report.unverifiableRate).toBeCloseTo(1 / 3, 6);
  });

  it('uncertain マスクで一致したカード(c)は discrepancies に出ない', () => {
    expect(report.discrepancies.some((d) => d.oracleId === 'c')).toBe(false);
  });

  it('b: crossPlayer は oracleOnly true=分類器が cross を取りこぼし(FN)', () => {
    const b = report.discrepancies.find((d) => d.oracleId === 'b');
    expect(b).toBeDefined();
    expect(b?.classifierCrossPlayer).toBe(false);
    expect(b?.oracleCrossPlayer).toBe(true);
    expect(b?.crossPlayerAgree).toBe(false);
    expect(b?.agree).toBe(false);
    expect(b?.deltaSignature).not.toBe('=');
  });

  it('物差し校正(ゴールド真値・library は precision=recall=1)', () => {
    const library = report.goldCalibration.find((x) => x.zone === 'library');
    expect(library?.support).toBe(1);
    expect(library?.precision).toBeCloseTo(1, 6);
    expect(library?.recall).toBeCloseTo(1, 6);
  });

  it('attribution は null(Fable が後で裁定)', () => {
    expect(report.discrepancies.every((d) => d.attribution === null)).toBe(true);
  });
});

describe('M0-Z-O zones + ownership 写像 + playerScope の複合 delta', () => {
  // d: zone oracleOnly(graveyard) / ownership controller↔owner(refersToOwner→owner) / scope oracleOnly(owner)
  const classifier = [classifierCard('d', ['battlefield'], false, 'controller', ['you'])];
  const predictions = [
    {
      oracleId: 'd',
      name: 'D',
      facts: facts({
        zones: ['battlefield', 'graveyard'],
        refersToOwner: true,
        refersToController: false,
        playerScopes: ['owner', 'you'],
      }),
    },
  ];
  const report = computeZoneReport(classifier, predictions, []);
  const d = report.discrepancies.find((x) => x.oracleId === 'd');

  it('zones 割れ・ownership 割れ・scope 割れ / crossPlayer は一致', () => {
    expect(report.zoneDiscrepancyRate).toBeCloseTo(1, 6);
    expect(report.ownershipDiscrepancyRate).toBeCloseTo(1, 6);
    expect(report.playerScopeDiscrepancyRate).toBeCloseTo(1, 6);
    expect(report.crossPlayerDiscrepancyRate).toBeCloseTo(0, 6);
  });

  it('zone delta(oracleOnly=graveyard)', () => {
    expect(d?.zoneOracleOnly).toEqual(['graveyard']);
    expect(d?.zoneClassifierOnly).toEqual([]);
  });

  it('ownership 写像: refersToOwner=true → owner(分類器 controller)', () => {
    expect(d?.classifierOwnership).toBe('controller');
    expect(d?.oracleOwnership).toBe('owner');
    expect(d?.ownershipAgree).toBe(false);
  });

  it('playerScope delta(oracleOnly=owner)', () => {
    expect(d?.playerScopeOracleOnly).toEqual(['owner']);
    expect(d?.playerScopeClassifierOnly).toEqual([]);
  });
});

describe('M0-Z-O ownership 写像: refersToOwner & refersToController → both', () => {
  const classifier = [classifierCard('e', [], false, 'both', [])];
  const predictions = [
    { oracleId: 'e', name: 'E', facts: facts({ refersToOwner: true, refersToController: true }) },
  ];
  const report = computeZoneReport(classifier, predictions, []);

  it('owner+controller 両方 true → both(一致)', () => {
    expect(report.ownershipDiscrepancyRate).toBeCloseTo(0, 6);
    expect(report.discrepancies).toEqual([]);
  });
});

describe('M0-Z-O 不変条件(決定的・空入力)', () => {
  it('同入力で同出力(決定的)', () => {
    const c = [classifierCard('x', ['library'], false, 'none', ['you'])];
    const p = [{ oracleId: 'x', name: 'X', facts: facts({ zones: ['library'], playerScopes: ['you'] }) }];
    const a = computeZoneReport(c, p, []);
    const b = computeZoneReport(c, p, []);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('全一致サンプルは discrepancies 空', () => {
    const c = [classifierCard('x', ['library'], false, 'none', ['you'])];
    const p = [{ oracleId: 'x', name: 'X', facts: facts({ zones: ['library'], playerScopes: ['you'] }) }];
    const report = computeZoneReport(c, p, []);
    expect(report.discrepancies).toEqual([]);
    expect(report.zoneDiscrepancyRate).toBeCloseTo(0, 6);
  });

  it('予測のないカードは比較対象外(comparedCount に数えない)', () => {
    const c = [
      classifierCard('x', ['library'], false, 'none', ['you']),
      classifierCard('y', ['graveyard'], true, 'none', ['target-player']),
    ];
    const p = [{ oracleId: 'x', name: 'X', facts: facts({ zones: ['library'], playerScopes: ['you'] }) }];
    const report = computeZoneReport(c, p, []);
    expect(report.comparedCount).toBe(1);
  });
});
