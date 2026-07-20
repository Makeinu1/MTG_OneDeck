import { create } from 'zustand';
import type { ZoneId } from '../engine/types';

/**
 * viewStore(D0 空殻。docs/ui-architecture-v2.md §3)。
 * engine/gameStore の GameState には一切書き込まない=表示状態のみを持つ。
 * feedItems の実投影(gameStore の warnings/triggerCandidates/log 購読)は D3 で配線する。
 */

export interface ConfirmPayload {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export type ActiveSheet =
  | null
  | { kind: 'card'; cardId: string }
  | { kind: 'zone'; zone: ZoneId }
  | { kind: 'life' }
  | { kind: 'menu' }
  | { kind: 'confirm'; payload: ConfirmPayload };

export interface FeedItem {
  id: string;
  kind: 'warning' | 'trigger' | 'log';
  text: string;
  timestamp: number;
}

export interface Toast {
  id: number;
  message: string;
  kind: 'warning' | 'info';
}

export interface ViewStore {
  activeSheet: ActiveSheet;
  feedOpen: boolean;
  stackExpanded: boolean;
  feedItems: FeedItem[];
  unseenCount: number;
  toast: Toast | null;
  openSheet(sheet: ActiveSheet): void;
  closeSheet(): void;
  toggleFeed(): void;
  toggleStack(): void;
  markSeen(): void;
  showToast(message: string, kind?: 'warning' | 'info'): void;
  dismissToast(): void;
}

let toastCounter = 0;

export const useViewStore = create<ViewStore>((set) => ({
  activeSheet: null,
  feedOpen: false,
  stackExpanded: false,
  feedItems: [],
  unseenCount: 0,
  toast: null,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
  toggleFeed: () => set((state) => ({ feedOpen: !state.feedOpen })),
  toggleStack: () => set((state) => ({ stackExpanded: !state.stackExpanded })),
  markSeen: () => set({ unseenCount: 0 }),
  showToast: (message, kind = 'warning') => set({ toast: { id: ++toastCounter, message, kind } }),
  dismissToast: () => set({ toast: null }),
}));
