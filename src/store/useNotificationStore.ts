import { create } from 'zustand';

type NotificationTarget = { appId: string } | { fileId: string; folderId: string };

interface NotificationInput {
  source: string;
  title: string;
  message: string;
  kind: 'success' | 'error';
  target?: NotificationTarget;
}

interface DesktopNotification extends NotificationInput {
  id: number;
  createdAt: number;
  unread: boolean;
}

interface NotificationState {
  items: DesktopNotification[];
  add: (input: NotificationInput) => void;
  markRead: () => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  add: (input) => set((state) => ({
    items: [{ ...input, id: ++nextId, createdAt: Date.now(), unread: true }, ...state.items].slice(0, 50),
  })),
  markRead: () => set((state) => ({
    items: state.items.map((item) => item.unread ? { ...item, unread: false } : item),
  })),
  dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  clear: () => set({ items: [] }),
}));

export function notify(input: NotificationInput) {
  useNotificationStore.getState().add(input);
}
