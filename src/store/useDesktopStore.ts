import { create } from 'zustand';
import { DESKTOP_APPS, type DesktopAppItem } from '../data/desktopApps';
import type {
  GridSlot,
  PersistedDesktopLayout,
  PersonalizationSettings,
  PersonalizationTab,
  StartMenuSettings,
  TaskbarSettings,
} from '../db/types';
import {
  loadOrInitDesktopLayout,
  loadOrInitPersonalizationSettings,
  loadOrInitTaskbarSettings,
  saveDesktopLayout,
  savePersonalizationSettings,
  saveTaskbarSettings,
} from '../db/win10Db';
import { initSoundUnlock, playSound, registerSoundSettingsProvider } from '../utils/soundManager';
import { useFileSystemStore } from './useFileSystemStore';
import { notify } from './useNotificationStore';

export type { GridSlot, PersonalizationSettings, PersonalizationTab, StartMenuSettings, TaskbarSettings };

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
  searchMode: 'box',
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
  pinnedAppIds: ['explorer', 'store', 'chrome'],
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

export type SnapSide =
  | 'left'
  | 'right'
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export function getSnapBounds(side: SnapSide, settings: TaskbarSettings): WindowBounds | null {
  if (typeof window === 'undefined') return null;
  const insets = getTaskbarInsets(settings);
  const width = window.innerWidth - insets.left - insets.right;
  const height = window.innerHeight - insets.top - insets.bottom;
  if (width < 2 || height < 2) return null;
  const splitX = Math.floor(width / 2);
  const splitY = Math.floor(height / 2);
  switch (side) {
    case 'left':
      return { x: 0, y: 0, width: splitX, height };
    case 'right':
      return { x: splitX, y: 0, width: width - splitX, height };
    case 'top':
      return { x: 0, y: 0, width, height };
    case 'top-left':
      return { x: 0, y: 0, width: splitX, height: splitY };
    case 'top-right':
      return { x: splitX, y: 0, width: width - splitX, height: splitY };
    case 'bottom-left':
      return { x: 0, y: splitY, width: splitX, height: height - splitY };
    case 'bottom-right':
      return { x: splitX, y: splitY, width: width - splitX, height: height - splitY };
  }
}

export interface VirtualDesktop {
  id: string;
  name: string;
}

export type TileSize = 'small' | 'medium' | 'wide';
export type PowerState = 'running' | 'sleeping' | 'shutting-down' | 'restarting';

export interface AppWindow extends WindowBounds {
  id: string;
  appId: string;
  desktopId: string;
  title: string;
  icon: string;
  minWidth: number;
  minHeight: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  snappedSide?: SnapSide;
  snapRestoreBounds?: WindowBounds;
}

export type DesktopIconSize = 'small' | 'medium' | 'large';
export type DesktopSortField = 'default' | 'name' | 'size' | 'type' | 'date';

const DEFAULT_POSITIONS: Record<string, GridSlot> = {
  'recycle-bin': { col: 0, row: 0 },
  'this-pc': { col: 0, row: 1 },
  explorer: { col: 0, row: 2 },
  calculator: { col: 0, row: 3 },
  store: { col: 0, row: 4 },
  chrome: { col: 0, row: 5 },
  word: { col: 1, row: 0 },
  excel: { col: 1, row: 1 },
  'yt-downloader': { col: 1, row: 2 },
};

export const DEFAULT_PERSONALIZATION_SETTINGS: PersonalizationSettings = {
  backgroundType: 'picture',
  wallpaper: '/assets/wallpapers/win10-hero.jpg',
  customWallpapers: [],
  backgroundFit: 'fill',
  solidColor: '#0078d7',
  accentColor: '#0078d7',
};

let hasLayoutMutated = false;
let hasTaskbarMutated = false;
let hasPersonalizationMutated = false;
let desktopHydratePromise: Promise<void> | null = null;

function persistLayout(layout: PersistedDesktopLayout) {
  hasLayoutMutated = true;
  void saveDesktopLayout(layout);
}

function persistTaskbarSettings(settings: TaskbarSettings) {
  hasTaskbarMutated = true;
  void saveTaskbarSettings(settings);
}

function persistPersonalizationSettings(settings: PersonalizationSettings) {
  hasPersonalizationMutated = true;
  void savePersonalizationSettings(settings);
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
  explorerReveal: { folderId: string; fileId: string } | null;
  notepadActiveFileId: string | null;
  notepadOpenNonce: number;
  officeActiveFileId: string | null;
  officeOpenNonce: number;
  mediaPlayerFileId: string | null;
  mediaPlayerOpenNonce: number;
  paintActiveFileId: string | null;
  paintOpenNonce: number;
  photosActiveFileId: string | null;
  photosOpenNonce: number;
  terminalStartProfile: 'cmd' | 'powershell';
  terminalOpenNonce: number;
  brightness: number;
  displayScale: 100 | 125 | 150;
  lockPin: string | null;
  userName: string;
  startMenuSettings: StartMenuSettings;
  iconSize: DesktopIconSize;
  showDesktopIcons: boolean;
  autoArrangeIcons: boolean;
  alignToGrid: boolean;
  freeIconPositions: Record<string, { x: number; y: number }>;
  sortBy: DesktopSortField;
  windows: AppWindow[];
  activeAppId: string | null;
  topZIndex: number;
  virtualDesktops: VirtualDesktop[];
  activeDesktopId: string;
  shakeRestoreIds: string[];
  contextMenuPos: ContextMenuPosition | null;
  taskbarContextMenuPos: TaskbarContextMenuPosition | null;
  winXMenuPos: { x: number; y: number } | null;
  titlebarMenuState: { windowId: string; x: number; y: number } | null;
  isAltTabOpen: boolean;
  altTabIndex: number;
  isRunDialogOpen: boolean;
  runHistory: string[];
  isLockScreenOpen: boolean;
  powerState: PowerState;
  isActionCenterOpen: boolean;
  isSearchOpen: boolean;
  desktopPropertiesTargetId: string | null;
  shortcutModalOpen: boolean;
  startMenuTileIds: string[];
  tileSizes: Record<string, TileSize>;
  wifiEnabled: boolean;
  bluetoothEnabled: boolean;
  nightLightEnabled: boolean;
  airplaneMode: boolean;
  focusAssist: boolean;
  networkName: string;
  appVolumes: Record<string, number>;
  calendarEvents: Record<string, string[]>;
  taskbarSettings: TaskbarSettings;
  personalizationSettings: PersonalizationSettings;
  systemVolume: number;
  isSystemMuted: boolean;
  soundEffectsEnabled: boolean;
  windowSoundsEnabled: boolean;
  usbConnected: boolean;
  usbDeviceName: string;
  setSystemVolume: (volume: number) => void;
  toggleSystemMute: () => void;
  setSoundEffectsEnabled: (enabled: boolean) => void;
  setWindowSoundsEnabled: (enabled: boolean) => void;
  connectUsbDrive: (deviceName?: string) => void;
  ejectUsbDrive: (simulateError?: boolean) => void;
  setAppVolume: (appId: string, volume: number) => void;
  setBrightness: (brightness: number) => void;
  setDisplayScale: (scale: 100 | 125 | 150) => void;
  setLockPin: (pin: string | null) => void;
  setUserName: (name: string) => void;
  updateStartMenuSettings: (updater: Partial<StartMenuSettings>) => void;
  settingsActiveTab: PersonalizationTab;
  hydrate: () => Promise<void>;
  selectIcon: (id: string, multiSelect: boolean) => void;
  setSelectedIconIds: (ids: string[]) => void;
  clearSelection: () => void;
  setContextMenuPos: (pos: ContextMenuPosition | null) => void;
  setTaskbarContextMenuPos: (pos: TaskbarContextMenuPosition | null) => void;
  setWinXMenuPos: (pos: { x: number; y: number } | null) => void;
  setTitlebarMenuState: (state: { windowId: string; x: number; y: number } | null) => void;
  setAltTabState: (open: boolean, index?: number) => void;
  setRunDialogOpen: (open: boolean) => void;
  addRunHistory: (cmd: string) => void;
  setLockScreenOpen: (open: boolean, silent?: boolean) => void;
  setPowerState: (state: PowerState) => void;
  setActionCenterOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setDesktopPropertiesTargetId: (id: string | null) => void;
  setShortcutModalOpen: (open: boolean) => void;
  toggleQuickSetting: (key: 'wifiEnabled' | 'bluetoothEnabled' | 'nightLightEnabled' | 'airplaneMode' | 'focusAssist') => void;
  setNetworkName: (name: string) => void;
  addCalendarEvent: (dateKey: string, text: string) => void;
  removeCalendarEvent: (dateKey: string, idx: number) => void;
  pinToStart: (appId: string) => void;
  unpinFromStart: (appId: string) => void;
  setTileSize: (appId: string, size: TileSize) => void;
  reorderStartTiles: (fromId: string, toId: string) => void;
  reorderPinnedTaskbarApps: (fromId: string, toId: string) => void;
  updateTaskbarSettings: (
    updater: Partial<TaskbarSettings> | ((prev: TaskbarSettings) => TaskbarSettings),
  ) => void;
  updatePersonalizationSettings: (
    updater:
      | Partial<PersonalizationSettings>
      | ((prev: PersonalizationSettings) => PersonalizationSettings),
  ) => void;
  setSettingsActiveTab: (tab: PersonalizationTab) => void;
  openSettingsTab: (tab: PersonalizationTab) => void;
  togglePinToTaskbar: (appId: string) => void;
  toggleStartMenu: () => void;
  closeStartMenu: () => void;
  toggleTaskView: () => void;
  setTaskViewOpen: (open: boolean) => void;
  setPeekingDesktop: (peeking: boolean) => void;
  triggerRefresh: () => void;
  setIconSize: (size: DesktopIconSize) => void;
  toggleShowDesktopIcons: () => void;
  setAutoArrangeIcons: (enabled: boolean) => void;
  setAlignToGrid: (enabled: boolean) => void;
  setFreeIconPosition: (id: string, pos: { x: number; y: number }) => void;
  sortAppsByName: (visibleIds?: string[]) => void;
  sortDesktopBy: (field: DesktopSortField, orderedIds: string[], maxRows?: number) => void;
  moveIconToSlot: (id: string, slot: GridSlot, allVisibleIds: string[], maxRows: number) => void;
  setIconPosition: (id: string, slot: GridSlot) => void;
  setRenamingIconId: (id: string | null) => void;
  renameShortcut: (id: string, newLabel: string) => void;
  openApp: (id: string, explorerFolderId?: string, revealFileId?: string, forceNewInstance?: boolean) => void;
  openNotepadFile: (fileId: string | null) => void;
  openOfficeFile: (appId: 'word' | 'excel', fileId: string | null) => void;
  openMediaFile: (fileId: string | null) => void;
  openPaintFile: (fileId: string | null) => void;
  openPhotoFile: (fileId: string | null) => void;
  openTerminal: (profile?: 'cmd' | 'powershell') => void;
  toggleTaskbarApp: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  snapActiveWindow: (side: SnapSide) => boolean;
  snapWindow: (id: string, side: SnapSide) => boolean;
  snapOrMaximizeUp: () => boolean;
  unSnapOrMinimizeActiveWindow: () => boolean;
  minimizeOtherWindows: (keepId: string) => void;
  restoreAllMinimized: () => void;
  clampWindowsToViewport: () => void;
  closeWindow: (id: string) => void;
  updateWindowBounds: (id: string, bounds: WindowBounds, unmaximize?: boolean) => void;
  setWindowTitle: (id: string, title: string) => void;
  minimizeAll: () => void;
  toggleShowDesktop: () => void;
  cascadeWindows: () => void;
  stackWindows: () => void;
  sideBySideWindows: () => void;
  createVirtualDesktop: () => string;
  switchVirtualDesktop: (desktopId: string) => void;
  switchVirtualDesktopByOffset: (delta: -1 | 1) => void;
  removeVirtualDesktop: (desktopId: string) => void;
  moveWindowToDesktop: (winId: string, desktopId: string) => void;
}

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 480;

function getTopVisibleWindowId(windows: AppWindow[], activeDesktopId?: string): string | null {
  const visible = windows.filter((w) => !w.isMinimized && (!activeDesktopId || w.desktopId === activeDesktopId));
  if (visible.length === 0) return null;
  return visible.reduce((top, current) => (current.zIndex > top.zIndex ? current : top)).id;
}

let windowInstanceCounter = 1;
function allocateWindowId(appId: string, windows: AppWindow[]): string {
  if (!windows.some((w) => w.id === appId)) return appId;
  let candidate = `${appId}#${++windowInstanceCounter}`;
  while (windows.some((w) => w.id === candidate)) {
    candidate = `${appId}#${++windowInstanceCounter}`;
  }
  return candidate;
}

function windowMaximizedKey(appId: string): string {
  return `win10_window_maximized_v1:${appId}`;
}

function readWindowMaximized(appId: string): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(windowMaximizedKey(appId)) === 'true';
  } catch {
    return false;
  }
}

function createInitialWindowLayout(
  appId: string,
  existingCount: number,
  taskbarSettings: TaskbarSettings,
): WindowBounds & Pick<AppWindow, 'minWidth' | 'minHeight' | 'isMaximized'> {
  const insets = getTaskbarInsets(taskbarSettings);
  const vw =
    typeof window !== 'undefined' ? window.innerWidth - insets.left - insets.right : 1280;
  const vh =
    typeof window !== 'undefined' ? window.innerHeight - insets.top - insets.bottom : 680;
  const isCalc = appId === 'calculator';
  const isExplorer = appId === 'explorer' || appId === 'this-pc' || appId === 'recycle-bin';
  const isSettings = appId === 'settings';
  const isChrome = appId === 'chrome';
  const isOffice = appId === 'word' || appId === 'excel';
  const isStudio = appId === 'code-studio';
  const isPdfTool = appId === 'pdf-tool';
  const isPaint = appId === 'paint';
  const isPhotos = appId === 'photos';
  const isTerminal = appId === 'terminal';
  const targetWidth = isCalc ? 340 : isOffice || isStudio || isPdfTool ? 1120 : isPaint ? 1080 : isChrome ? 1040 : isPhotos ? 960 : isExplorer ? 940 : isSettings ? 880 : isTerminal ? 840 : DEFAULT_WIDTH;
  const targetHeight = isCalc ? 540 : isOffice || isStudio || isPdfTool ? 700 : isPaint ? 680 : isChrome ? 680 : isPhotos ? 640 : isExplorer ? 600 : isSettings ? 600 : isTerminal ? 520 : DEFAULT_HEIGHT;
  const minWidth = isCalc ? 320 : isOffice || isPaint ? 680 : isChrome ? 520 : isPhotos || isExplorer ? 620 : isSettings ? 580 : isTerminal ? 520 : 320;
  const minHeight = isCalc ? 480 : isOffice ? 460 : isPaint ? 420 : isStudio || isChrome ? 380 : isPdfTool ? 360 : isPhotos || isExplorer ? 400 : isSettings ? 420 : isTerminal ? 320 : 220;

  const width = Math.min(targetWidth, Math.max(minWidth, vw - 48));
  const height = Math.min(targetHeight, Math.max(minHeight, vh - 48));
  const offset = (existingCount % 6) * 28;
  const x = Math.max(16, Math.min(Math.round((vw - width) / 2) + offset, vw - width - 16));
  const y = Math.max(16, Math.min(Math.round((vh - height) / 2) + offset, vh - height - 16));
  return { x, y, width, height, minWidth, minHeight, isMaximized: readWindowMaximized(appId) };
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

export const useDesktopStore = create<DesktopState>((set, get) => ({
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
  explorerReveal: null,
  notepadActiveFileId: null,
  notepadOpenNonce: 0,
  officeActiveFileId: null,
  officeOpenNonce: 0,
  mediaPlayerFileId: null,
  mediaPlayerOpenNonce: 0,
  paintActiveFileId: null,
  paintOpenNonce: 0,
  photosActiveFileId: null,
  photosOpenNonce: 0,
  terminalStartProfile: 'cmd',
  terminalOpenNonce: 0,
  brightness: (() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('win10_brightness_v1') : null;
      if (!raw) return 100;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(20, Math.min(100, Math.round(n))) : 100;
    } catch {
      return 100;
    }
  })(),
  displayScale: 100,
  lockPin: (() => {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem('win10_lock_pin_v1') : null;
    } catch {
      return null;
    }
  })(),
  userName: (() => {
    try {
      return (typeof window !== 'undefined' ? window.localStorage.getItem('win10_user_name_v1') : null) || 'User';
    } catch {
      return 'User';
    }
  })(),
  startMenuSettings: {
    showMoreTiles: false,
    showAppList: true,
    showRecentlyAdded: true,
  },
  iconSize: 'medium',
  showDesktopIcons: true,
  autoArrangeIcons: true,
  alignToGrid: true,
  freeIconPositions: {},
  sortBy: 'default',
  windows: [],
  activeAppId: null,
  topZIndex: 1,
  virtualDesktops: [{ id: 'desktop-1', name: 'Desktop 1' }],
  activeDesktopId: 'desktop-1',
  shakeRestoreIds: [],
  contextMenuPos: null,
  taskbarContextMenuPos: null,
  winXMenuPos: null,
  titlebarMenuState: null,
  isAltTabOpen: false,
  altTabIndex: 0,
  isRunDialogOpen: false,
  runHistory: ['notepad', 'calc', 'explorer', 'taskmgr'],
  isLockScreenOpen: false,
  powerState: 'running',
  isActionCenterOpen: false,
  isSearchOpen: false,
  desktopPropertiesTargetId: null,
  shortcutModalOpen: false,
  startMenuTileIds: [
    'word', 'excel', 'this-pc', 'explorer', 'calculator', 'chrome', 'photos', 'notepad',
    'store', 'settings', 'paint', 'snip', 'recycle-bin',
  ],
  tileSizes: {},
  wifiEnabled: true,
  bluetoothEnabled: true,
  nightLightEnabled: false,
  airplaneMode: false,
  focusAssist: false,
  networkName: 'Wi-Fi (Home_5G)',
  appVolumes: {},
  calendarEvents: {},
  taskbarSettings: DEFAULT_TASKBAR_SETTINGS,
  systemVolume: (() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('win10_system_volume_v1') : null;
      if (!raw) return 85;
      const parsed = JSON.parse(raw) as { volume?: number };
      return typeof parsed.volume === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.volume))) : 85;
    } catch {
      return 85;
    }
  })(),
  isSystemMuted: (() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('win10_system_volume_v1') : null;
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { muted?: boolean };
      return Boolean(parsed.muted);
    } catch {
      return false;
    }
  })(),
  soundEffectsEnabled: (() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('win10_sound_effects_v1') : null;
      return raw === null ? true : raw === 'true';
    } catch {
      return true;
    }
  })(),
  windowSoundsEnabled: (() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('win10_window_sounds_v1') : null;
      return raw === 'true';
    } catch {
      return false;
    }
  })(),
  usbConnected: false,
  usbDeviceName: 'SanDisk Ultra USB 3.0',

  setSystemVolume: (volume) =>
    set((state) => {
      const clamped = Math.max(0, Math.min(100, Math.round(volume)));
      const nextMuted = clamped === 0 ? true : false;
      try {
        window.localStorage.setItem(
          'win10_system_volume_v1',
          JSON.stringify({ volume: clamped, muted: nextMuted }),
        );
      } catch {
        // ignore
      }
      return {
        systemVolume: clamped,
        isSystemMuted: clamped === 0 ? true : state.isSystemMuted && clamped > 0 ? false : nextMuted,
      };
    }),

  toggleSystemMute: () => {
    const wasMuted = get().isSystemMuted;
    set((state) => {
      const nextMuted = !state.isSystemMuted;
      try {
        window.localStorage.setItem(
          'win10_system_volume_v1',
          JSON.stringify({ volume: state.systemVolume, muted: nextMuted }),
        );
      } catch {
        // ignore
      }
      return { isSystemMuted: nextMuted };
    });
    if (wasMuted && get().systemVolume > 0) {
      playSound('background');
    }
  },

  setSoundEffectsEnabled: (enabled) => {
    try {
      window.localStorage.setItem('win10_sound_effects_v1', String(enabled));
    } catch {
      // ignore
    }
    set({ soundEffectsEnabled: enabled });
  },

  setWindowSoundsEnabled: (enabled) => {
    try {
      window.localStorage.setItem('win10_window_sounds_v1', String(enabled));
    } catch {
      // ignore
    }
    set({ windowSoundsEnabled: enabled });
  },

  connectUsbDrive: (deviceName) => {
    const labelName = deviceName?.trim() || get().usbDeviceName || 'SanDisk Ultra USB 3.0';
    useFileSystemStore.getState().mountUsbDrive('USB Drive (E:)');
    set({ usbConnected: true, usbDeviceName: labelName });
    playSound('usb-insert');
    notify({
      source: 'AutoPlay',
      title: 'USB Drive (E:) connected',
      message: `${labelName} — Click to open in File Explorer.`,
      kind: 'success',
      target: { folderId: 'drive-e' },
      sound: false,
    });
  },

  ejectUsbDrive: (simulateError = false) => {
    const state = get();
    if (simulateError) {
      playSound('usb-fail');
      notify({
        source: 'Windows Explorer',
        title: 'Problem Ejecting USB Mass Storage Device',
        message: 'This device is currently in use. Close any programs using it and try again.',
        kind: 'error',
        sound: false,
      });
      return;
    }
    if (!state.usbConnected && !useFileSystemStore.getState().nodes['drive-e']) return;
    useFileSystemStore.getState().unmountUsbDrive();
    set({ usbConnected: false });
    playSound('usb-remove');
    notify({
      source: 'Windows Explorer',
      title: 'Safe To Remove Hardware',
      message: `The '${state.usbDeviceName}' device can now be safely removed from the computer.`,
      kind: 'success',
      sound: false,
    });
  },
  setAppVolume: (appId, volume) =>
    set((state) => ({
      appVolumes: {
        ...state.appVolumes,
        [appId]: Math.max(0, Math.min(100, Math.round(volume))),
      },
    })),

  setBrightness: (brightness) => {
    const clamped = Math.max(20, Math.min(100, Math.round(brightness)));
    try {
      window.localStorage.setItem('win10_brightness_v1', String(clamped));
    } catch {
      // ignore
    }
    set({ brightness: clamped });
  },

  setDisplayScale: (displayScale) => set({ displayScale }),

  setLockPin: (pin) => {
    const cleaned = pin ? pin.trim() : null;
    try {
      if (cleaned) window.localStorage.setItem('win10_lock_pin_v1', cleaned);
      else window.localStorage.removeItem('win10_lock_pin_v1');
    } catch {
      // ignore
    }
    set({ lockPin: cleaned });
  },

  setUserName: (name) => {
    const trimmed = name.trim() || 'User';
    try {
      window.localStorage.setItem('win10_user_name_v1', trimmed);
    } catch {
      // ignore
    }
    set({ userName: trimmed });
  },

  updateStartMenuSettings: (updater) =>
    set((state) => ({
      startMenuSettings: { ...state.startMenuSettings, ...updater },
    })),

  personalizationSettings: DEFAULT_PERSONALIZATION_SETTINGS,
  settingsActiveTab: 'Home',

  hydrate: () => {
    if (desktopHydratePromise) return desktopHydratePromise;
    desktopHydratePromise = (async () => {
      const [layout, taskbarSettings, personalizationSettings] = await Promise.all([
        loadOrInitDesktopLayout(DEFAULT_POSITIONS),
        loadOrInitTaskbarSettings(DEFAULT_TASKBAR_SETTINGS),
        loadOrInitPersonalizationSettings(DEFAULT_PERSONALIZATION_SETTINGS),
      ]);
      set((state) => {
        const nextLabels = hasLayoutMutated ? state.shortcutLabels : layout.labels;
        const nextPositions = hasLayoutMutated ? state.iconPositions : layout.positions;
        const nextTaskbar = hasTaskbarMutated ? state.taskbarSettings : taskbarSettings;
        const nextPersonalization = hasPersonalizationMutated
          ? state.personalizationSettings
          : personalizationSettings;
        const currentWindows = state.windows.map((w) => ({
          ...w,
          title: nextLabels[w.id] ?? w.title,
        }));
        return {
          iconPositions: nextPositions,
          shortcutLabels: nextLabels,
          taskbarSettings: nextTaskbar,
          personalizationSettings: nextPersonalization,
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
      winXMenuPos: null,
      titlebarMenuState: null,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
      isActionCenterOpen: false,
      isSearchOpen: false,
      renamingIconId: null,
    }),

  setContextMenuPos: (pos) =>
    set({
      contextMenuPos: pos,
      taskbarContextMenuPos: null,
      winXMenuPos: null,
      titlebarMenuState: null,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
      isActionCenterOpen: false,
    }),

  setTaskbarContextMenuPos: (pos) =>
    set({
      taskbarContextMenuPos: pos,
      contextMenuPos: null,
      winXMenuPos: null,
      titlebarMenuState: null,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
      isActionCenterOpen: false,
    }),

  setWinXMenuPos: (winXMenuPos) =>
    set({
      winXMenuPos,
      contextMenuPos: null,
      taskbarContextMenuPos: null,
      titlebarMenuState: null,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
      isActionCenterOpen: false,
    }),

  setTitlebarMenuState: (titlebarMenuState) =>
    set({
      titlebarMenuState,
      contextMenuPos: null,
      taskbarContextMenuPos: null,
      winXMenuPos: null,
    }),

  setAltTabState: (isAltTabOpen, altTabIndex) =>
    set((state) => ({
      isAltTabOpen,
      altTabIndex: altTabIndex !== undefined ? altTabIndex : state.altTabIndex,
    })),

  setRunDialogOpen: (isRunDialogOpen) =>
    set({
      isRunDialogOpen,
      isStartMenuOpen: false,
      winXMenuPos: null,
      contextMenuPos: null,
      taskbarContextMenuPos: null,
    }),

  addRunHistory: (cmd) =>
    set((state) => {
      const trimmed = cmd.trim();
      if (!trimmed) return state;
      return {
        runHistory: [trimmed, ...state.runHistory.filter((c) => c !== trimmed)].slice(0, 12),
      };
    }),

  setLockScreenOpen: (isLockScreenOpen, silent = false) => {
    const prev = get();
    set({
      isLockScreenOpen,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
      isActionCenterOpen: false,
      winXMenuPos: null,
      contextMenuPos: null,
      taskbarContextMenuPos: null,
    });
    if (silent) return;
    if (isLockScreenOpen && !prev.isLockScreenOpen && prev.powerState === 'running') {
      playSound('logoff');
    } else if (!isLockScreenOpen && prev.isLockScreenOpen) {
      playSound('unlock');
    }
  },

  setPowerState: (powerState) => {
    const prevPower = get().powerState;
    set({
      powerState,
      isStartMenuOpen: false,
      winXMenuPos: null,
    });
    if (powerState === 'sleeping' && prevPower === 'running') {
      playSound('logoff');
    } else if ((powerState === 'shutting-down' || powerState === 'restarting') && prevPower !== powerState) {
      playSound('shutdown');
    } else if (powerState === 'running' && prevPower !== 'running') {
      playSound('logon');
    }
  },

  setActionCenterOpen: (isActionCenterOpen) =>
    set({
      isActionCenterOpen,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
      winXMenuPos: null,
      contextMenuPos: null,
      taskbarContextMenuPos: null,
    }),

  setSearchOpen: (isSearchOpen) =>
    set((state) => ({
      isSearchOpen,
      isStartMenuOpen: isSearchOpen ? false : state.isStartMenuOpen,
    })),

  setDesktopPropertiesTargetId: (desktopPropertiesTargetId) =>
    set({ desktopPropertiesTargetId, contextMenuPos: null }),

  setShortcutModalOpen: (shortcutModalOpen) =>
    set({ shortcutModalOpen, contextMenuPos: null }),

  toggleQuickSetting: (key) =>
    set((state) => {
      const nextVal = !state[key];
      if (key === 'airplaneMode' && nextVal) {
        return { airplaneMode: true, wifiEnabled: false, bluetoothEnabled: false };
      }
      if (key === 'wifiEnabled' && nextVal && state.airplaneMode) {
        return { wifiEnabled: true, airplaneMode: false };
      }
      return { [key]: nextVal };
    }),

  setNetworkName: (networkName) => set({ networkName }),

  addCalendarEvent: (dateKey, text) =>
    set((state) => {
      const trimmed = text.trim();
      if (!trimmed) return state;
      const existing = state.calendarEvents[dateKey] ?? [];
      return {
        calendarEvents: {
          ...state.calendarEvents,
          [dateKey]: [...existing, trimmed],
        },
      };
    }),

  removeCalendarEvent: (dateKey, idx) =>
    set((state) => {
      const existing = state.calendarEvents[dateKey] ?? [];
      return {
        calendarEvents: {
          ...state.calendarEvents,
          [dateKey]: existing.filter((_, i) => i !== idx),
        },
      };
    }),

  pinToStart: (appId) =>
    set((state) => ({
      startMenuTileIds: state.startMenuTileIds.includes(appId)
        ? state.startMenuTileIds
        : [...state.startMenuTileIds, appId],
    })),

  unpinFromStart: (appId) =>
    set((state) => ({
      startMenuTileIds: state.startMenuTileIds.filter((id) => id !== appId),
    })),

  setTileSize: (appId, size) =>
    set((state) => ({
      tileSizes: { ...state.tileSizes, [appId]: size },
    })),

  reorderStartTiles: (fromId, toId) =>
    set((state) => {
      if (fromId === toId) return state;
      const list = [...state.startMenuTileIds];
      const fromIdx = list.indexOf(fromId);
      const toIdx = list.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return state;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return { startMenuTileIds: list };
    }),

  reorderPinnedTaskbarApps: (fromId, toId) =>
    set((state) => {
      if (fromId === toId) return state;
      const pinned = [...state.taskbarSettings.pinnedAppIds];
      const fromIdx = pinned.indexOf(fromId);
      const toIdx = pinned.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return state;
      const [moved] = pinned.splice(fromIdx, 1);
      pinned.splice(toIdx, 0, moved);
      const nextSettings: TaskbarSettings = {
        ...state.taskbarSettings,
        pinnedAppIds: pinned,
      };
      persistTaskbarSettings(nextSettings);
      return { taskbarSettings: nextSettings };
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

  updatePersonalizationSettings: (updater) =>
    set((state) => {
      const nextSettings =
        typeof updater === 'function'
          ? updater(state.personalizationSettings)
          : { ...state.personalizationSettings, ...updater };
      persistPersonalizationSettings(nextSettings);
      return { personalizationSettings: nextSettings };
    }),

  setSettingsActiveTab: (settingsActiveTab) => set({ settingsActiveTab }),

  openSettingsTab: (tab) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === 'settings');
      if (!app) return state;
      const displayTitle = state.shortcutLabels[app.id] ?? app.name;
      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find(
        (w) => (w.appId ?? w.id) === 'settings' && w.desktopId === state.activeDesktopId,
      );

      if (existing) {
        return {
          settingsActiveTab: tab,
          windows: state.windows.map((w) =>
            w.id === existing.id
              ? { ...w, title: displayTitle, isMinimized: false, zIndex: nextZ }
              : w,
          ),
          activeAppId: existing.id,
          topZIndex: nextZ,
          contextMenuPos: null,
          taskbarContextMenuPos: null,
          winXMenuPos: null,
          isStartMenuOpen: false,
          isTaskViewOpen: false,
        };
      }

      const layout = createInitialWindowLayout(
        'settings',
        state.windows.length,
        state.taskbarSettings,
      );
      const winId = allocateWindowId('settings', state.windows);
      return {
        settingsActiveTab: tab,
        windows: [
          ...state.windows,
          {
            id: winId,
            appId: 'settings',
            desktopId: state.activeDesktopId,
            title: displayTitle,
            icon: app.icon,
            ...layout,
            zIndex: nextZ,
            isMinimized: false,
          },
        ],
        activeAppId: winId,
        topZIndex: nextZ,
        contextMenuPos: null,
        taskbarContextMenuPos: null,
        winXMenuPos: null,
        isStartMenuOpen: false,
        isTaskViewOpen: false,
      };
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

  setAutoArrangeIcons: (autoArrangeIcons) => set({ autoArrangeIcons, contextMenuPos: null }),

  setAlignToGrid: (alignToGrid) => set({ alignToGrid, contextMenuPos: null }),

  setFreeIconPosition: (id, pos) =>
    set((state) => ({
      freeIconPositions: { ...state.freeIconPositions, [id]: pos },
    })),

  sortDesktopBy: (field, orderedIds, maxRows = 7) =>
    set((state) => {
      const nextPositions = { ...state.iconPositions };
      orderedIds.forEach((id, index) => {
        nextPositions[id] = {
          col: Math.floor(index / maxRows),
          row: index % maxRows,
        };
      });
      persistLayout({ positions: nextPositions, labels: state.shortcutLabels });
      return {
        iconPositions: nextPositions,
        freeIconPositions: {},
        sortBy: field,
        contextMenuPos: null,
      };
    }),

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

  openApp: (id, explorerFolderId, revealFileId, forceNewInstance = false) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === id);
      if (!app) return state;

      const displayTitle = state.shortcutLabels[app.id] ?? app.name;
      const nextZ = state.topZIndex + 1;
      const existing = forceNewInstance
        ? undefined
        : state.windows.find(
            (w) => (w.appId ?? w.id) === id && w.desktopId === state.activeDesktopId,
          );
      const nextStartFolder =
        explorerFolderId ?? (!existing && id === 'explorer' ? 'this-pc' : state.explorerStartFolderId);
      const explorerReveal = id === 'explorer'
        ? explorerFolderId && revealFileId ? { folderId: explorerFolderId, fileId: revealFileId } : null
        : state.explorerReveal;

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, title: displayTitle, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: existing.id,
          topZIndex: nextZ,
          contextMenuPos: null,
          winXMenuPos: null,
          isStartMenuOpen: false,
          explorerStartFolderId: nextStartFolder,
          explorerReveal,
        };
      }

      const layout = createInitialWindowLayout(
        app.id,
        state.windows.length,
        state.taskbarSettings,
      );
      const winId = allocateWindowId(app.id, state.windows);
      const newWindow: AppWindow = {
        id: winId,
        appId: app.id,
        desktopId: state.activeDesktopId,
        title: displayTitle,
        icon: app.icon,
        ...layout,
        zIndex: nextZ,
        isMinimized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: winId,
        topZIndex: nextZ,
        contextMenuPos: null,
        winXMenuPos: null,
        isStartMenuOpen: false,
        explorerStartFolderId: nextStartFolder,
        explorerReveal,
        notepadActiveFileId: id === 'notepad' ? null : state.notepadActiveFileId,
        paintActiveFileId: id === 'paint' ? null : state.paintActiveFileId,
        officeActiveFileId: id === 'word' || id === 'excel' ? null : state.officeActiveFileId,
      };
    }),

  openOfficeFile: (appId, fileId) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === appId);
      if (!app) return state;

      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find(
        (w) => (w.appId ?? w.id) === appId && w.desktopId === state.activeDesktopId,
      );

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: existing.id,
          topZIndex: nextZ,
          contextMenuPos: null,
          isStartMenuOpen: false,
          officeActiveFileId: fileId,
          officeOpenNonce: state.officeOpenNonce + 1,
        };
      }

      const layout = createInitialWindowLayout(
        appId,
        state.windows.length,
        state.taskbarSettings,
      );
      const winId = allocateWindowId(appId, state.windows);
      const newWindow: AppWindow = {
        id: winId,
        appId,
        desktopId: state.activeDesktopId,
        title: app.name,
        icon: app.icon,
        ...layout,
        zIndex: nextZ,
        isMinimized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: winId,
        topZIndex: nextZ,
        contextMenuPos: null,
        isStartMenuOpen: false,
        officeActiveFileId: fileId,
        officeOpenNonce: state.officeOpenNonce + 1,
      };
    }),

  openMediaFile: (fileId) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === 'media-player');
      if (!app) return state;

      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find(
        (w) => (w.appId ?? w.id) === 'media-player' && w.desktopId === state.activeDesktopId,
      );

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: existing.id,
          topZIndex: nextZ,
          contextMenuPos: null,
          isStartMenuOpen: false,
          mediaPlayerFileId: fileId,
          mediaPlayerOpenNonce: state.mediaPlayerOpenNonce + 1,
        };
      }

      const layout = createInitialWindowLayout(
        'media-player',
        state.windows.length,
        state.taskbarSettings,
      );
      const winId = allocateWindowId('media-player', state.windows);
      const newWindow: AppWindow = {
        id: winId,
        appId: 'media-player',
        desktopId: state.activeDesktopId,
        title: app.name,
        icon: app.icon,
        ...layout,
        zIndex: nextZ,
        isMinimized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: winId,
        topZIndex: nextZ,
        contextMenuPos: null,
        isStartMenuOpen: false,
        mediaPlayerFileId: fileId,
        mediaPlayerOpenNonce: state.mediaPlayerOpenNonce + 1,
      };
    }),

  openNotepadFile: (fileId) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === 'notepad');
      if (!app) return state;

      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find(
        (w) => (w.appId ?? w.id) === 'notepad' && w.desktopId === state.activeDesktopId,
      );

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: existing.id,
          topZIndex: nextZ,
          contextMenuPos: null,
          isStartMenuOpen: false,
          notepadActiveFileId: fileId,
          notepadOpenNonce: state.notepadOpenNonce + 1,
        };
      }

      const layout = createInitialWindowLayout(
        'notepad',
        state.windows.length,
        state.taskbarSettings,
      );
      const winId = allocateWindowId('notepad', state.windows);
      const newWindow: AppWindow = {
        id: winId,
        appId: 'notepad',
        desktopId: state.activeDesktopId,
        title: 'Notepad',
        icon: app.icon,
        ...layout,
        zIndex: nextZ,
        isMinimized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: winId,
        topZIndex: nextZ,
        contextMenuPos: null,
        isStartMenuOpen: false,
        notepadActiveFileId: fileId,
        notepadOpenNonce: state.notepadOpenNonce + 1,
      };
    }),

  openPaintFile: (fileId) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === 'paint');
      if (!app) return state;

      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find(
        (w) => (w.appId ?? w.id) === 'paint' && w.desktopId === state.activeDesktopId,
      );

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: existing.id,
          topZIndex: nextZ,
          contextMenuPos: null,
          isStartMenuOpen: false,
          paintActiveFileId: fileId,
          paintOpenNonce: state.paintOpenNonce + 1,
        };
      }

      const layout = createInitialWindowLayout(
        'paint',
        state.windows.length,
        state.taskbarSettings,
      );
      const winId = allocateWindowId('paint', state.windows);
      const newWindow: AppWindow = {
        id: winId,
        appId: 'paint',
        desktopId: state.activeDesktopId,
        title: 'Untitled - Paint',
        icon: app.icon,
        ...layout,
        zIndex: nextZ,
        isMinimized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: winId,
        topZIndex: nextZ,
        contextMenuPos: null,
        isStartMenuOpen: false,
        paintActiveFileId: fileId,
        paintOpenNonce: state.paintOpenNonce + 1,
      };
    }),

  openPhotoFile: (fileId) =>
    set((state) => {
      const app = state.apps.find((item) => item.id === 'photos');
      if (!app) return state;

      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find(
        (w) => (w.appId ?? w.id) === 'photos' && w.desktopId === state.activeDesktopId,
      );

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: existing.id,
          topZIndex: nextZ,
          contextMenuPos: null,
          isStartMenuOpen: false,
          photosActiveFileId: fileId,
          photosOpenNonce: state.photosOpenNonce + 1,
        };
      }

      const layout = createInitialWindowLayout(
        'photos',
        state.windows.length,
        state.taskbarSettings,
      );
      const winId = allocateWindowId('photos', state.windows);
      const newWindow: AppWindow = {
        id: winId,
        appId: 'photos',
        desktopId: state.activeDesktopId,
        title: 'Photos',
        icon: app.icon,
        ...layout,
        zIndex: nextZ,
        isMinimized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: winId,
        topZIndex: nextZ,
        contextMenuPos: null,
        isStartMenuOpen: false,
        photosActiveFileId: fileId,
        photosOpenNonce: state.photosOpenNonce + 1,
      };
    }),

  openTerminal: (profile = 'cmd') =>
    set((state) => {
      const app = state.apps.find((item) => item.id === 'terminal');
      if (!app) return state;

      const nextZ = state.topZIndex + 1;
      const existing = state.windows.find(
        (w) => (w.appId ?? w.id) === 'terminal' && w.desktopId === state.activeDesktopId,
      );

      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: existing.id,
          topZIndex: nextZ,
          contextMenuPos: null,
          winXMenuPos: null,
          isStartMenuOpen: false,
          terminalStartProfile: profile,
          terminalOpenNonce: state.terminalOpenNonce + 1,
        };
      }

      const layout = createInitialWindowLayout(
        'terminal',
        state.windows.length,
        state.taskbarSettings,
      );
      const winId = allocateWindowId('terminal', state.windows);
      const newWindow: AppWindow = {
        id: winId,
        appId: 'terminal',
        desktopId: state.activeDesktopId,
        title: app.name,
        icon: app.icon,
        ...layout,
        zIndex: nextZ,
        isMinimized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        activeAppId: winId,
        topZIndex: nextZ,
        contextMenuPos: null,
        winXMenuPos: null,
        isStartMenuOpen: false,
        terminalStartProfile: profile,
        terminalOpenNonce: state.terminalOpenNonce + 1,
      };
    }),

  toggleTaskbarApp: (id) =>
    set((state) => {
      const matching = state.windows.filter(
        (w) => (w.appId ?? w.id) === id && w.desktopId === state.activeDesktopId,
      );
      if (matching.length === 0) {
        const app = state.apps.find((item) => item.id === id);
        if (!app) return state;
        const displayTitle = state.shortcutLabels[app.id] ?? app.name;
        const nextZ = state.topZIndex + 1;
        const layout = createInitialWindowLayout(
          app.id,
          state.windows.length,
          state.taskbarSettings,
        );
        const winId = allocateWindowId(app.id, state.windows);
        return {
          windows: [
            ...state.windows,
            {
              id: winId,
              appId: app.id,
              desktopId: state.activeDesktopId,
              title: displayTitle,
              icon: app.icon,
              ...layout,
              zIndex: nextZ,
              isMinimized: false,
            },
          ],
          activeAppId: winId,
          topZIndex: nextZ,
          contextMenuPos: null,
          isStartMenuOpen: false,
        };
      }

      if (matching.length === 1) {
        const existing = matching[0];
        if (state.activeAppId === existing.id && !existing.isMinimized) {
          const updated = state.windows.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: true } : w,
          );
          return {
            windows: updated,
            activeAppId: getTopVisibleWindowId(updated, state.activeDesktopId),
            isStartMenuOpen: false,
          };
        }
        const nextZ = state.topZIndex + 1;
        return {
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
          ),
          activeAppId: existing.id,
          topZIndex: nextZ,
          isStartMenuOpen: false,
        };
      }

      // Multiple instances open: focus next instance or restore top one
      const activeIdx = matching.findIndex((w) => w.id === state.activeAppId && !w.isMinimized);
      const nextTarget = activeIdx >= 0 ? matching[(activeIdx + 1) % matching.length] : matching[0];
      const nextZ = state.topZIndex + 1;
      return {
        windows: state.windows.map((w) =>
          w.id === nextTarget.id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
        ),
        activeAppId: nextTarget.id,
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

  minimizeWindow: (id) => {
    set((state) => {
      const updated = state.windows.map((w) =>
        w.id === id ? { ...w, isMinimized: true } : w,
      );
      return {
        windows: updated,
        activeAppId: getTopVisibleWindowId(updated, state.activeDesktopId),
      };
    });
    playSound('minimize', { isWindowSound: true });
  },

  toggleMaximizeWindow: (id) => {
    set((state) => {
      const nextZ = state.topZIndex + 1;
      return {
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, isMaximized: !w.isMaximized, isMinimized: false, snappedSide: undefined, zIndex: nextZ }
            : w,
        ),
        activeAppId: id,
        topZIndex: nextZ,
      };
    });
    playSound('restore', { isWindowSound: true });
  },

  snapActiveWindow: (side) => {
    const { activeAppId, windows, snapWindow } = get();
    const active = windows.find((item) => item.id === activeAppId);
    return !!active && !active.isMinimized && snapWindow(active.id, side);
  },

  snapWindow: (id, side) => {
    const state = get();
    const target = state.windows.find((item) => item.id === id);
    if (!target) return false;
    const zIndex = state.topZIndex + 1;
    if (side === 'top') {
      set({
        windows: state.windows.map((item) =>
          item.id === id
            ? { ...item, isMaximized: true, isMinimized: false, snappedSide: 'top', zIndex }
            : item,
        ),
        activeAppId: id,
        topZIndex: zIndex,
      });
      return true;
    }
    const bounds = getSnapBounds(side, state.taskbarSettings);
    if (!bounds) return false;
    const { x, y, width, height } = target;
    set({
      windows: state.windows.map((item) =>
        item.id === id
          ? {
              ...item,
              ...bounds,
              snapRestoreBounds: item.snapRestoreBounds ?? { x, y, width, height },
              snappedSide: side,
              isMaximized: false,
              isMinimized: false,
              zIndex,
            }
          : item,
      ),
      activeAppId: id,
      topZIndex: zIndex,
    });
    return true;
  },

  snapOrMaximizeUp: () => {
    const state = get();
    const active = state.windows.find((w) => w.id === state.activeAppId && !w.isMinimized);
    if (!active) return false;
    if (active.snappedSide === 'left') return state.snapWindow(active.id, 'top-left');
    if (active.snappedSide === 'right') return state.snapWindow(active.id, 'top-right');
    if (active.snappedSide === 'bottom-left') return state.snapWindow(active.id, 'left');
    if (active.snappedSide === 'bottom-right') return state.snapWindow(active.id, 'right');
    if (!active.isMaximized) {
      state.toggleMaximizeWindow(active.id);
      return true;
    }
    return false;
  },

  unSnapOrMinimizeActiveWindow: () => {
    const state = get();
    const active = state.windows.find((w) => w.id === state.activeAppId && !w.isMinimized);
    if (!active) return false;
    if (active.snappedSide === 'top-left') return state.snapWindow(active.id, 'left');
    if (active.snappedSide === 'top-right') return state.snapWindow(active.id, 'right');
    if (active.isMaximized) {
      state.toggleMaximizeWindow(active.id);
      return true;
    }
    if (active.snapRestoreBounds) {
      state.updateWindowBounds(active.id, active.snapRestoreBounds, true);
      return true;
    }
    state.minimizeWindow(active.id);
    return true;
  },

  minimizeOtherWindows: (keepId) =>
    set((state) => {
      const others = state.windows.filter(
        (w) => w.id !== keepId && w.desktopId === state.activeDesktopId && !w.isMinimized,
      );
      if (others.length > 0) {
        const otherIds = others.map((w) => w.id);
        return {
          windows: state.windows.map((w) =>
            otherIds.includes(w.id) ? { ...w, isMinimized: true } : w,
          ),
          shakeRestoreIds: otherIds,
        };
      }
      if (state.shakeRestoreIds.length > 0) {
        const toRestore = new Set(state.shakeRestoreIds);
        return {
          windows: state.windows.map((w) =>
            toRestore.has(w.id) ? { ...w, isMinimized: false } : w,
          ),
          shakeRestoreIds: [],
        };
      }
      return state;
    }),

  restoreAllMinimized: () =>
    set((state) => {
      const nextTop = state.topZIndex + state.windows.length;
      const restored = state.windows.map((w) =>
        w.desktopId === state.activeDesktopId ? { ...w, isMinimized: false } : w,
      );
      return {
        windows: restored,
        activeAppId: getTopVisibleWindowId(restored, state.activeDesktopId),
        topZIndex: nextTop,
      };
    }),

  clampWindowsToViewport: () =>
    set((state) => {
      if (typeof window === 'undefined') return state;
      const insets = getTaskbarInsets(state.taskbarSettings);
      const desktopW = Math.max(200, window.innerWidth - insets.left - insets.right);
      const desktopH = Math.max(160, window.innerHeight - insets.top - insets.bottom);
      let changed = false;
      const nextWindows = state.windows.map((w) => {
        if (w.isMaximized) return w;
        const nextW = Math.min(w.width, desktopW);
        const nextH = Math.min(w.height, desktopH);
        const nextX = Math.max(-(nextW - 80), Math.min(w.x, desktopW - 80));
        const nextY = Math.max(0, Math.min(w.y, desktopH - 32));
        if (nextW === w.width && nextH === w.height && nextX === w.x && nextY === w.y) {
          return w;
        }
        changed = true;
        return { ...w, x: nextX, y: nextY, width: nextW, height: nextH };
      });
      return changed ? { windows: nextWindows } : state;
    }),

  closeWindow: (id) =>
    set((state) => {
      const updated = state.windows.filter((w) => w.id !== id);
      return {
        windows: updated,
        ...(id.startsWith('explorer') && { explorerReveal: null }),
        activeAppId:
          state.activeAppId === id ? getTopVisibleWindowId(updated, state.activeDesktopId) : state.activeAppId,
      };
    }),

  updateWindowBounds: (id, bounds, unmaximize = false) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              ...bounds,
              snapRestoreBounds: undefined,
              snappedSide: undefined,
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
      windows: state.windows.map((w) =>
        w.desktopId === state.activeDesktopId ? { ...w, isMinimized: true } : w,
      ),
      activeAppId: null,
      contextMenuPos: null,
      taskbarContextMenuPos: null,
      winXMenuPos: null,
      isStartMenuOpen: false,
      isTaskViewOpen: false,
      isPeekingDesktop: false,
    })),

  toggleShowDesktop: () =>
    set((state) => {
      const activeWindows = state.windows.filter((w) => w.desktopId === state.activeDesktopId);
      const hasVisible = activeWindows.some((w) => !w.isMinimized);
      if (hasVisible) {
        return {
          windows: state.windows.map((w) =>
            w.desktopId === state.activeDesktopId ? { ...w, isMinimized: true } : w,
          ),
          activeAppId: null,
          contextMenuPos: null,
          taskbarContextMenuPos: null,
          winXMenuPos: null,
          isStartMenuOpen: false,
          isTaskViewOpen: false,
          isPeekingDesktop: false,
        };
      }
      const nextTop = state.topZIndex + activeWindows.length;
      const restored = state.windows.map((w) =>
        w.desktopId === state.activeDesktopId ? { ...w, isMinimized: false } : w,
      );
      return {
        windows: restored,
        activeAppId: getTopVisibleWindowId(restored, state.activeDesktopId),
        topZIndex: nextTop,
        contextMenuPos: null,
        taskbarContextMenuPos: null,
        winXMenuPos: null,
        isStartMenuOpen: false,
        isTaskViewOpen: false,
        isPeekingDesktop: false,
      };
    }),

  createVirtualDesktop: () => {
    const state = get();
    const num = state.virtualDesktops.length + 1;
    const id = `desktop-${Date.now()}-${num}`;
    set({
      virtualDesktops: [...state.virtualDesktops, { id, name: `Desktop ${num}` }],
    });
    return id;
  },

  switchVirtualDesktop: (desktopId) =>
    set((state) => {
      if (!state.virtualDesktops.some((d) => d.id === desktopId)) return state;
      return {
        activeDesktopId: desktopId,
        activeAppId: getTopVisibleWindowId(state.windows, desktopId),
        contextMenuPos: null,
        taskbarContextMenuPos: null,
        winXMenuPos: null,
        isStartMenuOpen: false,
      };
    }),

  switchVirtualDesktopByOffset: (delta) => {
    const state = get();
    const idx = state.virtualDesktops.findIndex((d) => d.id === state.activeDesktopId);
    if (idx < 0) return;
    const nextIdx = Math.max(0, Math.min(state.virtualDesktops.length - 1, idx + delta));
    if (nextIdx !== idx) {
      state.switchVirtualDesktop(state.virtualDesktops[nextIdx].id);
    }
  },

  removeVirtualDesktop: (desktopId) =>
    set((state) => {
      if (state.virtualDesktops.length <= 1) return state;
      const idx = state.virtualDesktops.findIndex((d) => d.id === desktopId);
      if (idx < 0) return state;
      const remaining = state.virtualDesktops.filter((d) => d.id !== desktopId);
      const fallbackId = remaining[Math.max(0, idx - 1)].id;
      const movedWindows = state.windows.map((w) =>
        w.desktopId === desktopId ? { ...w, desktopId: fallbackId } : w,
      );
      const nextActiveDesktopId =
        state.activeDesktopId === desktopId ? fallbackId : state.activeDesktopId;
      return {
        virtualDesktops: remaining,
        activeDesktopId: nextActiveDesktopId,
        windows: movedWindows,
        activeAppId: getTopVisibleWindowId(movedWindows, nextActiveDesktopId),
      };
    }),

  moveWindowToDesktop: (winId, desktopId) =>
    set((state) => {
      const updated = state.windows.map((w) =>
        w.id === winId ? { ...w, desktopId } : w,
      );
      return {
        windows: updated,
        activeAppId:
          state.activeAppId === winId && desktopId !== state.activeDesktopId
            ? getTopVisibleWindowId(updated, state.activeDesktopId)
            : state.activeAppId,
      };
    }),

  cascadeWindows: () =>
    set((state) => {
      const visible = state.windows.filter((w) => !w.isMinimized && w.desktopId === state.activeDesktopId);
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
            snapRestoreBounds: undefined,
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
      const visible = state.windows.filter((w) => !w.isMinimized && w.desktopId === state.activeDesktopId);
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
            snapRestoreBounds: undefined,
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
      const visible = state.windows.filter((w) => !w.isMinimized && w.desktopId === state.activeDesktopId);
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
            snapRestoreBounds: undefined,
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
  registerSoundSettingsProvider(() => {
    const s = useDesktopStore.getState();
    return {
      systemVolume: s.systemVolume,
      isSystemMuted: s.isSystemMuted,
      systemSoundsVolume: s.appVolumes['system-sounds'] ?? 100,
      soundEffectsEnabled: s.soundEffectsEnabled,
      windowSoundsEnabled: s.windowSoundsEnabled,
      focusAssist: s.focusAssist,
    };
  });
  initSoundUnlock();

  useFileSystemStore.subscribe((fsState) => {
    const hasDriveE = Boolean(fsState.nodes['drive-e']);
    if (useDesktopStore.getState().usbConnected !== hasDriveE) {
      useDesktopStore.setState({ usbConnected: hasDriveE });
    }
  });

  useDesktopStore.subscribe((state, previous) => {
    if (state.windows === previous.windows) return;
    for (const current of state.windows) {
      const prior = previous.windows.find((item) => item.id === current.id);
      if (!prior || current.isMaximized === prior.isMaximized) continue;
      try {
        window.localStorage.setItem(windowMaximizedKey(current.id), String(current.isMaximized));
      } catch {
        // Keep window controls usable when browser storage is unavailable.
      }
    }
  });
  void useDesktopStore.getState().hydrate();
}
