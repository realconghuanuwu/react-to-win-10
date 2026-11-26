import { create } from 'zustand';

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

export const FS_STORAGE_KEY = 'win10_fs_v1';
export const LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024; // 5.00 MB browser localStorage quota

const NOW = Date.now();

const DEFAULT_NODES: Record<string, FsNode> = {
  'this-pc': {
    id: 'this-pc',
    parentId: null,
    name: 'This PC',
    kind: 'root',
    icon: '/assets/icons/my-computer.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  desktop: {
    id: 'desktop',
    parentId: 'this-pc',
    name: 'Desktop',
    kind: 'folder',
    icon: '/assets/icons/explorer/desk.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  documents: {
    id: 'documents',
    parentId: 'this-pc',
    name: 'Documents',
    kind: 'folder',
    icon: '/assets/icons/explorer/docs.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  downloads: {
    id: 'downloads',
    parentId: 'this-pc',
    name: 'Downloads',
    kind: 'folder',
    icon: '/assets/icons/explorer/down.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  music: {
    id: 'music',
    parentId: 'this-pc',
    name: 'Music',
    kind: 'folder',
    icon: '/assets/icons/explorer/music.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  pictures: {
    id: 'pictures',
    parentId: 'this-pc',
    name: 'Pictures',
    kind: 'folder',
    icon: '/assets/icons/explorer/pics.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  videos: {
    id: 'videos',
    parentId: 'this-pc',
    name: 'Videos',
    kind: 'folder',
    icon: '/assets/icons/explorer/vid.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  'drive-c': {
    id: 'drive-c',
    parentId: 'this-pc',
    name: 'Local Disk (C:)',
    kind: 'drive',
    icon: '/assets/icons/drive-os.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  'c-program-files': {
    id: 'c-program-files',
    parentId: 'drive-c',
    name: 'Program Files',
    kind: 'folder',
    icon: '/assets/icons/folder-win10.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  'c-users': {
    id: 'c-users',
    parentId: 'drive-c',
    name: 'Users',
    kind: 'folder',
    icon: '/assets/icons/folder-win10.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  'c-users-user': {
    id: 'c-users-user',
    parentId: 'c-users',
    name: 'User',
    kind: 'folder',
    icon: '/assets/icons/folder-win10.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  'c-windows': {
    id: 'c-windows',
    parentId: 'drive-c',
    name: 'Windows',
    kind: 'folder',
    icon: '/assets/icons/folder-win10.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
  'recycle-bin': {
    id: 'recycle-bin',
    parentId: null,
    name: 'Recycle Bin',
    kind: 'bin',
    icon: '/assets/icons/trash-can.png',
    isSystem: true,
    createdAt: NOW,
    modifiedAt: NOW,
  },
};

export const QUICK_ACCESS_IDS = ['desktop', 'downloads', 'documents', 'pictures'] as const;

export function measureLocalStorageBytes(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  let totalBytes = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const value = window.localStorage.getItem(key) ?? '';
    totalBytes += (key.length + value.length) * 2; // UTF-16 code units
  }
  return totalBytes;
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadInitialNodes(): Record<string, FsNode> {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_NODES;
  try {
    const raw = window.localStorage.getItem(FS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(FS_STORAGE_KEY, JSON.stringify(DEFAULT_NODES));
      return DEFAULT_NODES;
    }
    const parsed = JSON.parse(raw) as Record<string, FsNode>;
    if (!parsed['this-pc'] || !parsed['drive-c'] || !parsed['recycle-bin']) {
      window.localStorage.setItem(FS_STORAGE_KEY, JSON.stringify(DEFAULT_NODES));
      return DEFAULT_NODES;
    }
    return parsed;
  } catch {
    return DEFAULT_NODES;
  }
}

function persistNodes(nodes: Record<string, FsNode>): number {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FS_STORAGE_KEY, JSON.stringify(nodes));
    } catch {
      // Ignore quota exceeded errors gracefully
    }
  }
  return measureLocalStorageBytes();
}

function getUniqueFolderName(
  nodes: Record<string, FsNode>,
  parentId: string,
  baseName = 'New folder',
): string {
  const siblingNames = new Set(
    Object.values(nodes)
      .filter((n) => n.parentId === parentId)
      .map((n) => n.name.toLowerCase()),
  );
  if (!siblingNames.has(baseName.toLowerCase())) return baseName;
  let index = 2;
  while (siblingNames.has(`${baseName} (${index})`.toLowerCase())) {
    index += 1;
  }
  return `${baseName} (${index})`;
}

interface FileSystemState {
  nodes: Record<string, FsNode>;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  createFolder: (parentId: string, desiredName?: string) => string | null;
  renameNode: (id: string, newName: string) => void;
  deleteNodes: (ids: string[]) => void;
  restoreNodes: (ids: string[]) => void;
  emptyRecycleBin: () => void;
  refreshStorageStats: () => void;
}

const initialNodes = loadInitialNodes();

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
  nodes: initialNodes,
  storageUsedBytes: measureLocalStorageBytes(),
  storageQuotaBytes: LOCAL_STORAGE_QUOTA_BYTES,

  createFolder: (parentId, desiredName) => {
    const state = get();
    const parent = state.nodes[parentId];
    if (!parent || parent.kind === 'root' || parent.kind === 'bin') {
      return null;
    }

    const name = getUniqueFolderName(state.nodes, parentId, desiredName?.trim() || 'New folder');
    const id = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = Date.now();

    const nextNodes: Record<string, FsNode> = {
      ...state.nodes,
      [id]: {
        id,
        parentId,
        name,
        kind: 'folder',
        icon: '/assets/icons/folder-win10.png',
        isSystem: false,
        createdAt: timestamp,
        modifiedAt: timestamp,
      },
    };

    const storageUsedBytes = persistNodes(nextNodes);
    set({ nodes: nextNodes, storageUsedBytes });
    return id;
  },

  renameNode: (id, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    set((state) => {
      const target = state.nodes[id];
      if (!target || target.isSystem) return state;

      const nextNodes: Record<string, FsNode> = {
        ...state.nodes,
        [id]: {
          ...target,
          name: trimmed,
          modifiedAt: Date.now(),
        },
      };
      const storageUsedBytes = persistNodes(nextNodes);
      return { nodes: nextNodes, storageUsedBytes };
    });
  },

  deleteNodes: (ids) => {
    set((state) => {
      const nextNodes = { ...state.nodes };
      const collectDescendants = (rootId: string): string[] => {
        const result = [rootId];
        Object.values(nextNodes).forEach((node) => {
          if (node.parentId === rootId) {
            result.push(...collectDescendants(node.id));
          }
        });
        return result;
      };

      let changed = false;
      for (const id of ids) {
        const target = nextNodes[id];
        if (!target || target.isSystem) continue;
        changed = true;
        if (target.parentId === 'recycle-bin') {
          for (const descId of collectDescendants(id)) {
            delete nextNodes[descId];
          }
        } else {
          nextNodes[id] = {
            ...target,
            originalParentId: target.parentId,
            parentId: 'recycle-bin',
            modifiedAt: Date.now(),
          };
        }
      }

      if (!changed) return state;
      const storageUsedBytes = persistNodes(nextNodes);
      return { nodes: nextNodes, storageUsedBytes };
    });
  },

  restoreNodes: (ids) => {
    set((state) => {
      const nextNodes = { ...state.nodes };
      let changed = false;
      for (const id of ids) {
        const target = nextNodes[id];
        if (!target || target.parentId !== 'recycle-bin') continue;
        const restoreParent =
          target.originalParentId && nextNodes[target.originalParentId]
            ? target.originalParentId
            : 'drive-c';
        nextNodes[id] = {
          ...target,
          parentId: restoreParent,
          originalParentId: undefined,
          modifiedAt: Date.now(),
        };
        changed = true;
      }
      if (!changed) return state;
      const storageUsedBytes = persistNodes(nextNodes);
      return { nodes: nextNodes, storageUsedBytes };
    });
  },

  emptyRecycleBin: () => {
    set((state) => {
      const nextNodes = { ...state.nodes };
      const toRemove = new Set<string>();
      const collect = (id: string) => {
        toRemove.add(id);
        Object.values(nextNodes).forEach((n) => {
          if (n.parentId === id) collect(n.id);
        });
      };
      Object.values(nextNodes).forEach((n) => {
        if (n.parentId === 'recycle-bin') collect(n.id);
      });
      if (toRemove.size === 0) return state;
      toRemove.forEach((id) => delete nextNodes[id]);
      const storageUsedBytes = persistNodes(nextNodes);
      return { nodes: nextNodes, storageUsedBytes };
    });
  },

  refreshStorageStats: () => {
    set({ storageUsedBytes: measureLocalStorageBytes() });
  },
}));
