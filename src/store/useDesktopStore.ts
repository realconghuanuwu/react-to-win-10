import { create } from 'zustand';
import { DESKTOP_APPS, type DesktopAppItem } from '../data/desktopApps';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppWindow extends WindowBounds {
  id: string;
  title: string;
  icon: string;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
}

export type DesktopIconSize = 'small' | 'medium' | 'large';
export type DesktopSortField = 'default' | 'name';

interface DesktopState {
  apps: DesktopAppItem[];
  selectedIconIds: string[];
  isRefreshing: boolean;
  iconSize: DesktopIconSize;
  showDesktopIcons: boolean;
  sortBy: DesktopSortField;
  windows: AppWindow[];
  activeAppId: string | null;
  topZIndex: number;
  contextMenuPos: ContextMenuPosition | null;
  selectIcon: (id: string, multiSelect: boolean) => void;
  setSelectedIconIds: (ids: string[]) => void;
  clearSelection: () => void;
  setContextMenuPos: (pos: ContextMenuPosition | null) => void;
  triggerRefresh: () => void;
  setIconSize: (size: DesktopIconSize) => void;
  toggleShowDesktopIcons: () => void;
  sortAppsByName: () => void;
  openApp: (id: string) => void;
  toggleTaskbarApp: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  updateWindowBounds: (id: string, bounds: WindowBounds, unmaximize?: boolean) => void;
  minimizeAll: () => void;
}

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 480;
const TASKBAR_HEIGHT = 40;

function getTopVisibleWindowId(windows: AppWindow[]): string | null {
  const visible = windows.filter((w) => !w.isMinimized);
  if (visible.length === 0) return null;
  return visible.reduce((top, current) => (current.zIndex > top.zIndex ? current : top)).id;
}

function createInitialBounds(existingCount: number): WindowBounds {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight - TASKBAR_HEIGHT : 680;
  const width = Math.min(DEFAULT_WIDTH, Math.max(340, vw - 48));
  const height = Math.min(DEFAULT_HEIGHT, Math.max(240, vh - 48));
  const offset = (existingCount % 6) * 28;
  const x = Math.max(16, Math.min(Math.round((vw - width) / 2) + offset, vw - width - 16));
  const y = Math.max(16, Math.min(Math.round((vh - height) / 2) + offset, vh - height - 16));
  return { x, y, width, height };
}

export const useDesktopStore = create<DesktopState>((set) => ({
  apps: DESKTOP_APPS,
  selectedIconIds: [],
  isRefreshing: false,
  iconSize: 'medium',
  showDesktopIcons: true,
  sortBy: 'default',
  windows: [],
  activeAppId: null,
  topZIndex: 1,
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

  setIconSize: (iconSize) => set({ iconSize, contextMenuPos: null }),

  toggleShowDesktopIcons: () =>
    set((state) => ({
      showDesktopIcons: !state.showDesktopIcons,
      selectedIconIds: [],
      contextMenuPos: null,
    })),

  sortAppsByName: () =>
    set((state) => ({
      apps: [...state.apps].sort((a, b) => a.name.localeCompare(b.name)),
      sortBy: 'name',
      contextMenuPos: null,
    })),

  openApp: (id) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === id);
      if (!app) return state;

      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find((w) => w.id === id);

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: id,
          topZIndex: nextZ,
          contextMenuPos: null,
        };
      }

      const bounds = createInitialBounds(state.windows.length);
      const newWindow: AppWindow = {
        id: app.id,
        title: app.name,
        icon: app.icon,
        ...bounds,
        zIndex: nextZ,
        isMinimized: false,
        isMaximized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: id,
        topZIndex: nextZ,
        contextMenuPos: null,
      };
    }),

  toggleTaskbarApp: (id) =>
    set((state) => {
      const existing = state.windows.find((w) => w.id === id);
      if (!existing) {
        const app = state.apps.find((item) => item.id === id);
        if (!app) return state;
        const nextZ = state.topZIndex + 1;
        const bounds = createInitialBounds(state.windows.length);
        return {
          windows: [
            ...state.windows,
            {
              id: app.id,
              title: app.name,
              icon: app.icon,
              ...bounds,
              zIndex: nextZ,
              isMinimized: false,
              isMaximized: false,
            },
          ],
          activeAppId: id,
          topZIndex: nextZ,
          contextMenuPos: null,
        };
      }

      if (state.activeAppId === id && !existing.isMinimized) {
        const updated = state.windows.map((w) =>
          w.id === id ? { ...w, isMinimized: true } : w,
        );
        return {
          windows: updated,
          activeAppId: getTopVisibleWindowId(updated),
        };
      }

      const nextZ = state.topZIndex + 1;
      return {
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
        ),
        activeAppId: id,
        topZIndex: nextZ,
      };
    }),

  focusWindow: (id) =>
    set((state) => {
      const target = state.windows.find((w) => w.id === id);
      if (!target) return state;
      if (state.activeAppId === id && !target.isMinimized) return state;
      const nextZ = state.topZIndex + 1;
      return {
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
        ),
        activeAppId: id,
        topZIndex: nextZ,
      };
    }),

  minimizeWindow: (id) =>
    set((state) => {
      const updated = state.windows.map((w) =>
        w.id === id ? { ...w, isMinimized: true } : w,
      );
      return {
        windows: updated,
        activeAppId: getTopVisibleWindowId(updated),
      };
    }),

  toggleMaximizeWindow: (id) =>
    set((state) => {
      const nextZ = state.topZIndex + 1;
      return {
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, isMaximized: !w.isMaximized, isMinimized: false, zIndex: nextZ }
            : w,
        ),
        activeAppId: id,
        topZIndex: nextZ,
      };
    }),

  closeWindow: (id) =>
    set((state) => {
      const updated = state.windows.filter((w) => w.id !== id);
      return {
        windows: updated,
        activeAppId:
          state.activeAppId === id ? getTopVisibleWindowId(updated) : state.activeAppId,
      };
    }),

  updateWindowBounds: (id, bounds, unmaximize = false) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              ...bounds,
              isMaximized: unmaximize ? false : w.isMaximized,
            }
          : w,
      ),
    })),

  minimizeAll: () =>
    set((state) => ({
      windows: state.windows.map((w) => ({ ...w, isMinimized: true })),
      activeAppId: null,
      contextMenuPos: null,
    })),
}));
