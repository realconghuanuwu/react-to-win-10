import { create } from 'zustand';
import { DESKTOP_APPS, type DesktopAppItem } from '../data/desktopApps';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface DesktopState {
  apps: DesktopAppItem[];
  selectedIconIds: string[];
  isRefreshing: boolean;
  openAppIds: string[];
  activeAppId: string | null;
  contextMenuPos: ContextMenuPosition | null;
  selectIcon: (id: string, multiSelect: boolean) => void;
  setSelectedIconIds: (ids: string[]) => void;
  clearSelection: () => void;
  setContextMenuPos: (pos: ContextMenuPosition | null) => void;
  triggerRefresh: () => void;
  openApp: (id: string) => void;
  toggleTaskbarApp: (id: string) => void;
  minimizeAll: () => void;
}

export const useDesktopStore = create<DesktopState>((set) => ({
  apps: DESKTOP_APPS,
  selectedIconIds: [],
  isRefreshing: false,
  openAppIds: [],
  activeAppId: null,
  contextMenuPos: null,

  selectIcon: (id, multiSelect) =>
    set((state) => {
      if (!multiSelect) {
        return { selectedIconIds: [id], contextMenuPos: null };
      }
      const exists = state.selectedIconIds.includes(id);
      return {
        contextMenuPos: null,
        selectedIconIds: exists
          ? state.selectedIconIds.filter((item) => item !== id)
          : [...state.selectedIconIds, id],
      };
    }),

  setSelectedIconIds: (ids) => set({ selectedIconIds: ids }),

  clearSelection: () => set({ selectedIconIds: [], contextMenuPos: null }),

  setContextMenuPos: (pos) => set({ contextMenuPos: pos }),

  triggerRefresh: () => {
    set({ isRefreshing: true, contextMenuPos: null });
    window.setTimeout(() => {
      set({ isRefreshing: false });
    }, 90);
  },

  openApp: (id) =>
    set((state) => ({
      openAppIds: state.openAppIds.includes(id)
        ? state.openAppIds
        : [...state.openAppIds, id],
      activeAppId: id,
    })),

  toggleTaskbarApp: (id) =>
    set((state) => {
      if (!state.openAppIds.includes(id)) {
        return {
          openAppIds: [...state.openAppIds, id],
          activeAppId: id,
        };
      }
      return {
        activeAppId: state.activeAppId === id ? null : id,
      };
    }),

  minimizeAll: () => set({ activeAppId: null, contextMenuPos: null }),
}));
