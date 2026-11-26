import { create } from 'zustand';

export type NotificationTarget = { appId: string } | { fileId: string; folderId: string };

export interface NotificationInput {
  source: string;
  title: string;
  message: string;
  kind: 'success' | 'error';
  target?: NotificationTarget;
}

export interface DesktopNotification extends NotificationInput {
  id: number;
  createdAt: number;
  unread: boolean;
}

interface NotificationState {
  items: DesktopNotification[];
  toasts: DesktopNotification[];
  add: (input: NotificationInput) => void;
  markRead: () => void;
  dismiss: (id: number) => void;
  dismissToast: (id: number) => void;
  clear: () => void;
}

let nextId = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  toasts: [],
  add: (input) => {
    const entry: DesktopNotification = {
      ...input,
      id: ++nextId,
      createdAt: Date.now(),
      unread: true,
    };
    set((state) => ({
      items: [entry, ...state.items].slice(0, 50),
      toasts: [entry, ...state.toasts].slice(0, 3),
    }));
  },
  markRead: () =>
    set((state) => ({
      items: state.items.map((item) => (item.unread ? { ...item, unread: false } : item)),
    })),
  dismiss: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      toasts: state.toasts.filter((item) => item.id !== id),
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== id),
    })),
  clear: () => set({ items: [], toasts: [] }),
}));

export function notify(input: NotificationInput) {
  useNotificationStore.getState().add(input);
}
