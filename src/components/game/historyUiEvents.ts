export const HISTORY_UI_EVENT = 'onedeck-history-navigation';

export type HistoryNavigationDirection = 'undo' | 'redo';

/** Returns true when an active interaction consumed the history request. */
export function requestInteractionHistory(direction: HistoryNavigationDirection): boolean {
  const event = new CustomEvent<{ direction: HistoryNavigationDirection }>(HISTORY_UI_EVENT, {
    cancelable: true,
    detail: { direction },
  });
  return !document.dispatchEvent(event);
}
