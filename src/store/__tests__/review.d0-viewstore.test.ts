import { describe, it, expect, beforeEach } from 'vitest';
import { useViewStore } from '../viewStore';

/**
 * D0(地ならし)review pin: viewStore の状態遷移契約(docs/ui-architecture-v2.md §3)。
 * 判定者専有・実装エージェントは変更禁止。
 */
describe('viewStore', () => {
  beforeEach(() => {
    useViewStore.setState({
      activeSheet: null,
      feedOpen: false,
      stackExpanded: false,
      feedItems: [],
      unseenCount: 0,
    });
  });

  it('openSheet は activeSheet を排他的に設定する(同時に開くのは1つ)', () => {
    useViewStore.getState().openSheet({ kind: 'card', cardId: 'c1' });
    expect(useViewStore.getState().activeSheet).toEqual({ kind: 'card', cardId: 'c1' });

    useViewStore.getState().openSheet({ kind: 'zone', zone: 'graveyard' });
    expect(useViewStore.getState().activeSheet).toEqual({ kind: 'zone', zone: 'graveyard' });
  });

  it('closeSheet は activeSheet を null に戻す', () => {
    useViewStore.getState().openSheet({ kind: 'life' });
    useViewStore.getState().closeSheet();
    expect(useViewStore.getState().activeSheet).toBeNull();
  });

  it('confirm シートは payload を保持する', () => {
    const onConfirm = () => {};
    useViewStore.getState().openSheet({
      kind: 'confirm',
      payload: { message: '本当に実行しますか', onConfirm },
    });
    const sheet = useViewStore.getState().activeSheet;
    expect(sheet).toEqual({ kind: 'confirm', payload: { message: '本当に実行しますか', onConfirm } });
  });

  it('toggleFeed は feedOpen を反転させる', () => {
    expect(useViewStore.getState().feedOpen).toBe(false);
    useViewStore.getState().toggleFeed();
    expect(useViewStore.getState().feedOpen).toBe(true);
    useViewStore.getState().toggleFeed();
    expect(useViewStore.getState().feedOpen).toBe(false);
  });

  it('toggleStack は stackExpanded を反転させる', () => {
    expect(useViewStore.getState().stackExpanded).toBe(false);
    useViewStore.getState().toggleStack();
    expect(useViewStore.getState().stackExpanded).toBe(true);
  });

  it('markSeen は unseenCount を 0 にする(feedOpen/activeSheet には影響しない)', () => {
    useViewStore.setState({ unseenCount: 3, feedOpen: true });
    useViewStore.getState().markSeen();
    expect(useViewStore.getState().unseenCount).toBe(0);
    expect(useViewStore.getState().feedOpen).toBe(true);
  });

  it('toggleFeed と markSeen は独立(feedを開いても unseenCount は自動で0にならない)', () => {
    useViewStore.setState({ unseenCount: 2 });
    useViewStore.getState().toggleFeed();
    expect(useViewStore.getState().unseenCount).toBe(2);
  });
});
