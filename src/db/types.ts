export type FsNodeKind = 'root' | 'drive' | 'folder' | 'file' | 'bin';

export interface ShortcutTarget {
  kind: 'app' | 'url' | 'node';
  appId?: string;
  url?: string;
  nodeId?: string;
}

export interface FsNode {
  id: string;
  parentId: string | null;
  name: string;
  kind: FsNodeKind;
  icon: string;
  content?: string;
  mimeType?: string;
  sizeBytes?: number;
  blobId?: string;
  shortcutTarget?: ShortcutTarget;
  isSystem?: boolean;
  createdAt: number;
  modifiedAt: number;
  originalParentId?: string | null;
  originalDriveId?: string;
}

export interface GridSlot {
  col: number;
  row: number;
}

export interface PersistedDesktopLayout {
  positions: Record<string, GridSlot>;
  labels: Record<string, string>;
}

export type TaskbarSearchMode = 'hidden' | 'icon' | 'box';
export type TaskbarLocation = 'bottom' | 'top' | 'left' | 'right';
export type TaskbarCombineMode = 'always' | 'when-full' | 'never';

export interface TaskbarSettings {
  locked: boolean;
  autoHide: boolean;
  smallButtons: boolean;
  usePeek: boolean;
  showBadges: boolean;
  location: TaskbarLocation;
  combineButtons: TaskbarCombineMode;
  searchMode: TaskbarSearchMode;
  showCortana: boolean;
  showTaskView: boolean;
  showPeople: boolean;
  showInkWorkspace: boolean;
  showTouchKeyboard: boolean;
  toolbars: {
    address: boolean;
    links: boolean;
    desktop: boolean;
  };
  systemIcons: {
    clock: boolean;
    volume: boolean;
    network: boolean;
    actionCenter: boolean;
  };
  pinnedAppIds: string[];
}

export type PersonalizationTab =
  | 'Home'
  | 'Display'
  | 'Background'
  | 'Colors'
  | 'Lock screen'
  | 'Themes'
  | 'Fonts'
  | 'Start'
  | 'Taskbar'
  | 'Network'
  | 'Accounts'
  | 'Apps'
  | 'Time'
  | 'Update';

export interface StartMenuSettings {
  showMoreTiles: boolean;
  showAppList: boolean;
  showRecentlyAdded: boolean;
}

export type BackgroundType = 'picture' | 'solid';
export type BackgroundFit = 'fill' | 'fit' | 'stretch' | 'tile' | 'center';

export interface PersonalizationSettings {
  backgroundType: BackgroundType;
  wallpaper: string;
  customWallpapers: string[];
  backgroundFit: BackgroundFit;
  solidColor: string;
  accentColor: string;
}
