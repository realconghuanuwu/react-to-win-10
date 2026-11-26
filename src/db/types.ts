export type FsNodeKind = 'root' | 'drive' | 'folder' | 'bin';

export interface FsNode {
  id: string;
  parentId: string | null;
  name: string;
  kind: FsNodeKind;
  icon: string;
  isSystem?: boolean;
  createdAt: number;
  modifiedAt: number;
  originalParentId?: string | null;
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
