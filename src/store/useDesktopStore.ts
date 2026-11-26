import { create } from 'zustand';
import { DESKTOP_APPS, type DesktopAppItem } from '../data/desktopApps';
import type {
  GridSlot,
  PersistedDesktopLayout,
  TaskbarSettings,
} from '../db/types';
import {
  loadOrInitDesktopLayout,
  loadOrInitTaskbarSettings,
  saveDesktopLayout,
  saveTaskbarSettings,
} from '../db/win10Db';

export type { GridSlot, TaskbarSettings };

export interface TaskbarContextMenuPosition {
  x: number;
  y: number;
  appId?: string | null;
}

export interface TaskbarInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const DEFAULT_TASKBAR_SETTINGS: TaskbarSettings = {
  locked: true,
  autoHide: false,
  smallButtons: false,
  usePeek: true,
  showBadges: true,
  location: 'bottom',
  combineButtons: 'always',
  searchMode: 'hidden',
  showCortana: false,
  showTaskView: false,
  showPeople: false,
  showInkWorkspace: false,
  showTouchKeyboard: false,
  toolbars: {
    address: false,
    links: false,
    desktop: false,
  },
  systemIcons: {
    clock: true,
    volume: true,
    network: true,
    actionCenter: true,
  },
  pinnedAppIds: ['explorer', 'store'],
};

export function getTaskbarThickness(settings: TaskbarSettings): number {
  const isVertical = settings.location === 'left' || settings.location === 'right';
  if (isVertical) {
    return settings.smallButtons ? 48 : 62;
  }
  return settings.smallButtons ? 30 : 40;
}

export function getTaskbarInsets(settings: TaskbarSettings): TaskbarInsets {
  if (settings.autoHide) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const size = getTaskbarThickness(settings);
  return {
    top: settings.location === 'top' ? size : 0,
    bottom: settings.location === 'bottom' ? size : 0,
    left: settings.location === 'left' ? size : 0,
    right: settings.location === 'right' ? size : 0,
  };
}

export interface ContextMenuPosition {
  x: number;
  y: number;
  targetId?: string | null;
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
  minWidth: number;
  minHeight: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
}

export type DesktopIconSize = 'small' | 'medium' | 'large';
export type DesktopSortField = 'default' | 'name';

const DEFAULT_POSITIONS: Record<string, GridSlot> = {
  'recycle-bin': { col: 0, row: 0 },
  'this-pc': { col: 0, row: 1 },
  explorer: { col: 0, row: 2 },
  calculator: { col: 0, row: 3 },
  store: { col: 0, row: 4 },
};

let hasLayoutMutated = false;
let hasTaskbarMutated = false;
let desktopHydratePromise: Promise<void> | null = null;

function persistLayout(layout: PersistedDesktopLayout) {
  hasLayoutMutated = true;
  void saveDesktopLayout(layout);
}

function persistTaskbarSettings(settings: TaskbarSettings) {
  hasTaskbarMutated = true;
  void saveTaskbarSettings(settings);
}

interface DesktopState {
  apps: DesktopAppItem[];
  isHydrated: boolean;
  selectedIconIds: string[];
  iconPositions: Record<string, GridSlot>;
  shortcutLabels: Record<string, string>;
  renamingIconId: string | null;
  isRefreshing: boolean;
  isStartMenuOpen: boolean;
  isTaskViewOpen: boolean;
  isPeekingDesktop: boolean;
  explorerStartFolderId: string;
  notepadActiveFileId: string | null;
  notepadOpenNonce: number;
  iconSize: DesktopIconSize;
  showDesktopIcons: boolean;
  sortBy: DesktopSortField;
  windows: AppWindow[];
  activeAppId: string | null;
  topZIndex: number;
  contextMenuPos: ContextMenuPosition | null;
  taskbarContextMenuPos: TaskbarContextMenuPosition | null;
  taskbarSettings: TaskbarSettings;
  hydrate: () => Promise<void>;
  selectIcon: (id: string, multiSelect: boolean) => void;
  setSelectedIconIds: (ids: string[]) => void;
  clearSelection: () => void;
  setContextMenuPos: (pos: ContextMenuPosition | null) => void;
  setTaskbarContextMenuPos: (pos: TaskbarContextMenuPosition | null) => void;
  updateTaskbarSettings: (
    updater: Partial<TaskbarSettings> | ((prev: TaskbarSettings) => TaskbarSettings),
  ) => void;
  togglePinToTaskbar: (appId: string) => void;
  toggleStartMenu: () => void;
  closeStartMenu: () => void;
  toggleTaskView: () => void;
  setTaskViewOpen: (open: boolean) => void;
  setPeekingDesktop: (peeking: boolean) => void;
  triggerRefresh: () => void;
  setIconSize: (size: DesktopIconSize) => void;
  toggleShowDesktopIcons: () => void;
  sortAppsByName: (visibleIds?: string[]) => void;
  moveIconToSlot: (id: string, slot: GridSlot, allVisibleIds: string[], maxRows: number) => void;
  setIconPosition: (id: string, slot: GridSlot) => void;
  setRenamingIconId: (id: string | null) => void;
  renameShortcut: (id: string, newLabel: string) => void;
  openApp: (id: string, explorerFolderId?: string) => void;
  openNotepadFile: (fileId: string | null) => void;
  toggleTaskbarApp: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  updateWindowBounds: (id: string, bounds: WindowBounds, unmaximize?: boolean) => void;
  setWindowTitle: (id: string, title: string) => void;
  minimizeAll: () => void;
  toggleShowDesktop: () => void;
  cascadeWindows: () => void;
  stackWindows: () => void;
  sideBySideWindows: () => void;
}

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 480;

function getTopVisibleWindowId(windows: AppWindow[]): string | null {
  const visible = windows.filter((w) => !w.isMinimized);
  if (visible.length === 0) return null;
  return visible.reduce((top, current) => (current.zIndex > top.zIndex ? current : top)).id;
}

function createInitialBounds(
  appId: string,
  existingCount: number,
  taskbarSettings: TaskbarSettings,
): { bounds: WindowBounds; minWidth: number; minHeight: number } {
  const insets = getTaskbarInsets(taskbarSettings);
  const vw =
    typeof window !== 'undefined' ? window.innerWidth - insets.left - insets.right : 1280;
  const vh =
    typeof window !== 'undefined' ? window.innerHeight - insets.top - insets.bottom : 680;
  const isCalc = appId === 'calculator';
  const isExplorer = appId === 'explorer' || appId === 'this-pc' || appId === 'recycle-bin';
  const isSettings = appId === 'settings';
  const targetWidth = isCalc ? 340 : isExplorer ? 940 : isSettings ? 840 : DEFAULT_WIDTH;
  const targetHeight = isCalc ? 540 : isExplorer ? 600 : isSettings ? 580 : DEFAULT_HEIGHT;
  const minWidth = isCalc ? 320 : isExplorer ? 620 : isSettings ? 580 : 320;
  const minHeight = isCalc ? 480 : isExplorer ? 400 : isSettings ? 420 : 220;

  const width = Math.min(targetWidth, Math.max(minWidth, vw - 48));
  const height = Math.min(targetHeight, Math.max(minHeight, vh - 48));
  const offset = (existingCount % 6) * 28;
  const x = Math.max(16, Math.min(Math.round((vw - width) / 2) + offset, vw - width - 16));
  const y = Math.max(16, Math.min(Math.round((vh - height) / 2) + offset, vh - height - 16));
  return { bounds: { x, y, width, height }, minWidth, minHeight };
}

export function findNextFreeSlot(
  positions: Record<string, GridSlot>,
  occupiedIds: string[],
  maxRows: number,
  preferred?: GridSlot,
): GridSlot {
  const taken = new Set(
    occupiedIds
      .map((id) => positions[id])
      .filter((s): s is GridSlot => Boolean(s))
      .map((s) => `${s.col}:${s.row}`),
  );

  if (preferred && !taken.has(`${preferred.col}:${preferred.row}`)) {
    return preferred;
  }

  for (let col = 0; col < 30; col++) {
    for (let row = 0; row < maxRows; row++) {
      if (!taken.has(`${col}:${row}`)) {
        return { col, row };
      }
    }
  }
  return { col: 0, row: 0 };
}

export const useDesktopStore = create<DesktopState>((set) => ({
  apps: DESKTOP_APPS,
  isHydrated: false,
  selectedIconIds: [],
  iconPositions: DEFAULT_POSITIONS,
  shortcutLabels: {},
  renamingIconId: null,
  isRefreshing: false,
  isStartMenuOpen: false,
  isTaskViewOpen: false,
  isPeekingDesktop: false,
  explorerStartFolderId: 'this-pc',
  notepadActiveFileId: null,
  notepadOpenNonce: 0,
  iconSize: 'medium',
  showDesktopIcons: true,
  sortBy: 'default',
  windows: [],
  activeAppId: null,
  topZIndex: 1,
  contextMenuPos: null,
  taskbarContextMenuPos: null,
  taskbarSettings: DEFAULT_TASKBAR_SETTINGS,

  hydrate: () => {
    if (desktopHydratePromise) return desktopHydratePromise;
    desktopHydratePromise = (async () => {
      const [layout, taskbarSettings] = await Promise.all([
        loadOrInitDesktopLayout(DEFAULT_POSITIONS),
        loadOrInitTaskbarSettings(DEFAULT_TASKBAR_SETTINGS),
      ]);
      set((state) => {
        const nextLabels = hasLayoutMutated ? state.shortcutLabels : layout.labels;
        const nextPositions = hasLayoutMutated ? state.iconPositions : layout.positions;
        const nextTaskbar = hasTaskbarMutated ? state.taskbarSettings : taskbarSettings;
        const currentWindows = state.windows.map((w) => ({
          ...w,
          title: nextLabels[w.id] ?? w.title,
        }));
        return {
          iconPositions: nextPositions,
          shortcutLabels: nextLabels,
          taskbarSettings: nextTaskbar,
          windows: currentWindows,
          isHydrated: true,
        };
      });
    })();
    return desktopHydratePromise;
  },

  selectIcon: (id, multiSelect) =>
    set((state) => {
      if (!multiSelect) {
        return { selectedIconIds: [id], contextMenuPos: null, isStartMenuOpen: false };
      }
      const exists = state.selectedIconIds.includes(id);
      return {
        contextMenuPos: null,
        isStartMenuOpen: false,
        selectedIconIds: exists
          ? state.selectedIconIds.filter((item) => item !== id)
          : [...state.selectedIconIds, id],
      };
    }),

  setSelectedIconIds: (ids) => set({ selectedIconIds: ids }),

  clearSelection: () =>
    set({
      selectedIconIds: [],
      contextMenuPos: null,
      taskbarContextMenuPos: null,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
      renamingIconId: null,
    }),

  setContextMenuPos: (pos) =>
    set({
      contextMenuPos: pos,
      taskbarContextMenuPos: null,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
    }),

  setTaskbarContextMenuPos: (pos) =>
    set({
      taskbarContextMenuPos: pos,
      contextMenuPos: null,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
    }),

  updateTaskbarSettings: (updater) =>
    set((state) => {
      const nextSettings =
        typeof updater === 'function'
          ? updater(state.taskbarSettings)
          : { ...state.taskbarSettings, ...updater };
      persistTaskbarSettings(nextSettings);
      return { taskbarSettings: nextSettings };
    }),

  togglePinToTaskbar: (appId) =>
    set((state) => {
      const exists = state.taskbarSettings.pinnedAppIds.includes(appId);
      const nextPinned = exists
        ? state.taskbarSettings.pinnedAppIds.filter((id) => id !== appId)
        : [...state.taskbarSettings.pinnedAppIds, appId];
      const nextSettings: TaskbarSettings = {
        ...state.taskbarSettings,
        pinnedAppIds: nextPinned,
      };
      persistTaskbarSettings(nextSettings);
      return {
        taskbarSettings: nextSettings,
        taskbarContextMenuPos: null,
      };
    }),

  toggleStartMenu: () =>
    set((state) => ({
      isStartMenuOpen: !state.isStartMenuOpen,
      isTaskViewOpen: false,
      contextMenuPos: null,
      taskbarContextMenuPos: null,
      renamingIconId: null,
    })),

  closeStartMenu: () => set({ isStartMenuOpen: false }),

  toggleTaskView: () =>
    set((state) => ({
      isTaskViewOpen: !state.isTaskViewOpen,
      isStartMenuOpen: false,
      contextMenuPos: null,
      taskbarContextMenuPos: null,
    })),

  setTaskViewOpen: (open) => set({ isTaskViewOpen: open }),

  setPeekingDesktop: (isPeekingDesktop) => set({ isPeekingDesktop }),

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
      renamingIconId: null,
    })),

  sortAppsByName: (visibleIds) =>
    set((state) => {
      const sortedApps = [...state.apps].sort((a, b) => {
        const nameA = state.shortcutLabels[a.id] ?? a.name;
        const nameB = state.shortcutLabels[b.id] ?? b.name;
        return nameA.localeCompare(nameB);
      });

      const idsToArrange =
        visibleIds ??
        sortedApps.filter((a) => a.showOnDesktop !== false).map((a) => a.id);

      const nextPositions = { ...state.iconPositions };
      const maxRows = 7;
      idsToArrange.forEach((id, index) => {
        nextPositions[id] = {
          col: Math.floor(index / maxRows),
          row: index % maxRows,
        };
      });

      persistLayout({ positions: nextPositions, labels: state.shortcutLabels });
      return {
        apps: sortedApps,
        iconPositions: nextPositions,
        sortBy: 'name',
        contextMenuPos: null,
      };
    }),

  moveIconToSlot: (id, slot, allVisibleIds, maxRows) =>
    set((state) => {
      const clampedSlot: GridSlot = {
        col: Math.max(0, slot.col),
        row: Math.max(0, Math.min(maxRows - 1, slot.row)),
      };
      const nextPositions = { ...state.iconPositions };
      const occupantId = allVisibleIds.find((otherId) => {
        if (otherId === id) return false;
        const pos = nextPositions[otherId];
        return pos && pos.col === clampedSlot.col && pos.row === clampedSlot.row;
      });

      const previousSlot = nextPositions[id];
      if (occupantId && previousSlot) {
        nextPositions[occupantId] = previousSlot;
      } else if (occupantId) {
        nextPositions[occupantId] = findNextFreeSlot(
          nextPositions,
          allVisibleIds.filter((x) => x !== occupantId),
          maxRows,
        );
      }

      nextPositions[id] = clampedSlot;
      persistLayout({ positions: nextPositions, labels: state.shortcutLabels });
      return { iconPositions: nextPositions };
    }),

  setIconPosition: (id, slot) =>
    set((state) => {
      const nextPositions = { ...state.iconPositions, [id]: slot };
      persistLayout({ positions: nextPositions, labels: state.shortcutLabels });
      return { iconPositions: nextPositions };
    }),

  setRenamingIconId: (id) => set({ renamingIconId: id, contextMenuPos: null }),

  renameShortcut: (id, newLabel) => {
    const trimmed = newLabel.trim();
    if (!trimmed) {
      set({ renamingIconId: null });
      return;
    }
    set((state) => {
      const nextLabels = { ...state.shortcutLabels, [id]: trimmed };
      const nextWindows = state.windows.map((w) =>
        w.id === id ? { ...w, title: trimmed } : w,
      );
      persistLayout({ positions: state.iconPositions, labels: nextLabels });
      return {
        shortcutLabels: nextLabels,
        windows: nextWindows,
        renamingIconId: null,
      };
    });
  },

  openApp: (id, explorerFolderId) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === id);
      if (!app) return state;

      const displayTitle = state.shortcutLabels[app.id] ?? app.name;
      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find((w) => w.id === id);
      const nextStartFolder =
        explorerFolderId ?? (!existing && id === 'explorer' ? 'this-pc' : state.explorerStartFolderId);

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === id ? { ...w, title: displayTitle, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: id,
          topZIndex: nextZ,
          contextMenuPos: null,
          isStartMenuOpen: false,
          explorerStartFolderId: nextStartFolder,
        };
      }

      const { bounds, minWidth, minHeight } = createInitialBounds(
        app.id,
        state.windows.length,
        state.taskbarSettings,
      );
      const newWindow: AppWindow = {
        id: app.id,
        title: displayTitle,
        icon: app.icon,
        ...bounds,
        minWidth,
        minHeight,
        zIndex: nextZ,
        isMinimized: false,
        isMaximized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: id,
        topZIndex: nextZ,
        contextMenuPos: null,
        isStartMenuOpen: false,
        explorerStartFolderId: nextStartFolder,
        notepadActiveFileId: id === 'notepad' ? null : state.notepadActiveFileId,
      };
    }),

  openNotepadFile: (fileId) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === 'notepad');
      if (!app) return state;

      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find((w) => w.id === 'notepad');

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === 'notepad' ? { ...w, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: 'notepad',
          topZIndex: nextZ,
          contextMenuPos: null,
          isStartMenuOpen: false,
          notepadActiveFileId: fileId,
          notepadOpenNonce: state.notepadOpenNonce + 1,
        };
      }

      const { bounds, minWidth, minHeight } = createInitialBounds(
        'notepad',
        state.windows.length,
        state.taskbarSettings,
      );
      const newWindow: AppWindow = {
        id: 'notepad',
        title: 'Notepad',
        icon: app.icon,
        ...bounds,
        minWidth,
        minHeight,
        zIndex: nextZ,
        isMinimized: false,
        isMaximized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: 'notepad',
        topZIndex: nextZ,
        contextMenuPos: null,
        isStartMenuOpen: false,
        notepadActiveFileId: fileId,
        notepadOpenNonce: state.notepadOpenNonce + 1,
      };
    }),

  toggleTaskbarApp: (id) =>
    set((state) => {
      const existing = state.windows.find((w) => w.id === id);
      if (!existing) {
        const app = state.apps.find((item) => item.id === id);
        if (!app) return state;
        const displayTitle = state.shortcutLabels[app.id] ?? app.name;
        const nextZ = state.topZIndex + 1;
        const boundsInfo = createInitialBounds(
          app.id,
          state.windows.length,
          state.taskbarSettings,
        );
        return {
          windows: [
            ...state.windows,
            {
              id: app.id,
              title: displayTitle,
              icon: app.icon,
              ...boundsInfo.bounds,
              minWidth: boundsInfo.minWidth,
              minHeight: boundsInfo.minHeight,
              zIndex: nextZ,
              isMinimized: false,
              isMaximized: false,
            },
          ],
          activeAppId: id,
          topZIndex: nextZ,
          contextMenuPos: null,
          isStartMenuOpen: false,
        };
      }

      if (state.activeAppId === id && !existing.isMinimized) {
        const updated = state.windows.map((w) =>
          w.id === id ? { ...w, isMinimized: true } : w,
        );
        return {
          windows: updated,
          activeAppId: getTopVisibleWindowId(updated),
          isStartMenuOpen: false,
        };
      }

      const nextZ = state.topZIndex + 1;
      return {
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
        ),
        activeAppId: id,
        topZIndex: nextZ,
        isStartMenuOpen: false,
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

  setWindowTitle: (id, title) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, title } : w)),
    })),

  minimizeAll: () =>
    set((state) => ({
      windows: state.windows.map((w) => ({ ...w, isMinimized: true })),
      activeAppId: null,
      contextMenuPos: null,
      taskbarContextMenuPos: null,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
      isPeekingDesktop: false,
    })),

  toggleShowDesktop: () =>
    set((state) => {
      const hasVisible = state.windows.some((w) => !w.isMinimized);
      if (hasVisible) {
        return {
          windows: state.windows.map((w) => ({ ...w, isMinimized: true })),
          activeAppId: null,
          contextMenuPos: null,
          taskbarContextMenuPos: null,
          isStartMenuOpen: false,
          isTaskViewOpen: false,
          isPeekingDesktop: false,
        };
      }
      const nextTop = state.topZIndex + state.windows.length;
      const restored = state.windows.map((w) => ({ ...w, isMinimized: false }));
      return {
        windows: restored,
        activeAppId: getTopVisibleWindowId(restored),
        topZIndex: nextTop,
        contextMenuPos: null,
        taskbarContextMenuPos: null,
        isStartMenuOpen: false,
        isTaskViewOpen: false,
        isPeekingDesktop: false,
      };
    }),

  cascadeWindows: () =>
    set((state) => {
      const visible = state.windows.filter((w) => !w.isMinimized);
      if (visible.length === 0) return { taskbarContextMenuPos: null };
      const insets = getTaskbarInsets(state.taskbarSettings);
      const areaW = (typeof window !== 'undefined' ? window.innerWidth : 1280) - insets.left - insets.right;
      const areaH = (typeof window !== 'undefined' ? window.innerHeight : 720) - insets.top - insets.bottom;
      const step = 30;
      const baseW = Math.max(360, Math.round(areaW * 0.62));
      const baseH = Math.max(280, Math.round(areaH * 0.66));
      let z = state.topZIndex;
      const orderMap = new Map(visible.map((w, idx) => [w.id, idx]));

      return {
        windows: state.windows.map((w) => {
          const idx = orderMap.get(w.id);
          if (idx === undefined) return w;
          const offset = (idx % 8) * step;
          const width = Math.max(w.minWidth, Math.min(baseW, areaW - offset - 16));
          const height = Math.max(w.minHeight, Math.min(baseH, areaH - offset - 16));
          z += 1;
          return {
            ...w,
            isMaximized: false,
            x: 12 + offset,
            y: 12 + offset,
            width,
            height,
            zIndex: z,
          };
        }),
        topZIndex: z,
        taskbarContextMenuPos: null,
      };
    }),

  stackWindows: () =>
    set((state) => {
      const visible = state.windows.filter((w) => !w.isMinimized);
      if (visible.length === 0) return { taskbarContextMenuPos: null };
      const insets = getTaskbarInsets(state.taskbarSettings);
      const areaW = (typeof window !== 'undefined' ? window.innerWidth : 1280) - insets.left - insets.right;
      const areaH = (typeof window !== 'undefined' ? window.innerHeight : 720) - insets.top - insets.bottom;
      const slotH = Math.floor(areaH / visible.length);
      const orderMap = new Map(visible.map((w, idx) => [w.id, idx]));

      return {
        windows: state.windows.map((w) => {
          const idx = orderMap.get(w.id);
          if (idx === undefined) return w;
          return {
            ...w,
            isMaximized: false,
            x: 0,
            y: idx * slotH,
            width: Math.max(w.minWidth, areaW),
            height: Math.max(w.minHeight, idx === visible.length - 1 ? areaH - idx * slotH : slotH),
          };
        }),
        taskbarContextMenuPos: null,
      };
    }),

  sideBySideWindows: () =>
    set((state) => {
      const visible = state.windows.filter((w) => !w.isMinimized);
      if (visible.length === 0) return { taskbarContextMenuPos: null };
      const insets = getTaskbarInsets(state.taskbarSettings);
      const areaW = (typeof window !== 'undefined' ? window.innerWidth : 1280) - insets.left - insets.right;
      const areaH = (typeof window !== 'undefined' ? window.innerHeight : 720) - insets.top - insets.bottom;
      const cols = Math.ceil(Math.sqrt(visible.length));
      const rows = Math.ceil(visible.length / cols);
      const cellW = Math.floor(areaW / cols);
      const cellH = Math.floor(areaH / rows);
      const orderMap = new Map(visible.map((w, idx) => [w.id, idx]));

      return {
        windows: state.windows.map((w) => {
          const idx = orderMap.get(w.id);
          if (idx === undefined) return w;
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          return {
            ...w,
            isMaximized: false,
            x: col * cellW,
            y: row * cellH,
            width: Math.max(w.minWidth, col === cols - 1 ? areaW - col * cellW : cellW),
            height: Math.max(w.minHeight, row === rows - 1 ? areaH - row * cellH : cellH),
          };
        }),
        taskbarContextMenuPos: null,
      };
    }),
}));

if (typeof window !== 'undefined') {
  void useDesktopStore.getState().hydrate();
}
