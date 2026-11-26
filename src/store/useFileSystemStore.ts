import { create } from 'zustand';
import type { FsNode, FsNodeKind } from '../db/types';
import {
  DEFAULT_IDB_QUOTA_BYTES,
  deleteMediaBlob,
  estimateStorageStats,
  loadOrInitFileSystemNodes,
  measureNodesBytes,
  saveAllFileSystemNodes,
  saveMediaBlob,
} from '../db/win10Db';

export type { FsNode, FsNodeKind };

export const FS_DB_STORE = 'win10_db/fs_nodes';

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
  'drive-d': {
    id: 'drive-d',
    parentId: 'this-pc',
    name: 'Local Disk (D:)',
    kind: 'drive',
    icon: '/assets/icons/explorer/disk-sm.png',
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

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getUniqueNodeName(
  nodes: Record<string, FsNode>,
  parentId: string,
  baseName: string,
  extension = '',
): string {
  const siblingNames = new Set(
    Object.values(nodes)
      .filter((n) => n.parentId === parentId)
      .map((n) => n.name.toLowerCase()),
  );
  const fullDefault = `${baseName}${extension}`;
  if (!siblingNames.has(fullDefault.toLowerCase())) return fullDefault;
  let index = 2;
  while (siblingNames.has(`${baseName} (${index})${extension}`.toLowerCase())) {
    index += 1;
  }
  return `${baseName} (${index})${extension}`;
}

interface FileSystemState {
  nodes: Record<string, FsNode>;
  isHydrated: boolean;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  hydrate: () => Promise<void>;
  createFolder: (parentId: string, desiredName?: string) => string | null;
  createTextFile: (
    parentId: string,
    desiredName?: string,
    initialContent?: string,
  ) => string | null;
  createMediaFile: (
    parentId: string,
    fileName: string,
    blob: Blob,
  ) => Promise<string | null>;
  updateFileContent: (id: string, content: string) => void;
  renameNode: (id: string, newName: string) => void;
  deleteNodes: (ids: string[]) => void;
  restoreNodes: (ids: string[]) => void;
  emptyRecycleBin: () => void;
  refreshStorageStats: () => Promise<void>;
}

let hasUserMutated = false;
let hydratePromise: Promise<void> | null = null;

export const useFileSystemStore = create<FileSystemState>((set, get) => {
  const persistNodes = (nextNodes: Record<string, FsNode>) => {
    hasUserMutated = true;
    void saveAllFileSystemNodes(nextNodes).then(async () => {
      const stats = await estimateStorageStats(get().nodes);
      set({
        storageUsedBytes: stats.usedBytes,
        storageQuotaBytes: stats.quotaBytes,
      });
    });
    return measureNodesBytes(nextNodes);
  };

  return {
    nodes: DEFAULT_NODES,
    isHydrated: false,
    storageUsedBytes: measureNodesBytes(DEFAULT_NODES),
    storageQuotaBytes: DEFAULT_IDB_QUOTA_BYTES,

    hydrate: () => {
      if (hydratePromise) return hydratePromise;
      hydratePromise = (async () => {
        const loadedNodes = await loadOrInitFileSystemNodes(DEFAULT_NODES);
        const targetNodes = hasUserMutated ? get().nodes : loadedNodes;
        const stats = await estimateStorageStats(targetNodes);
        set({
          nodes: targetNodes,
          isHydrated: true,
          storageUsedBytes: stats.usedBytes,
          storageQuotaBytes: stats.quotaBytes,
        });
      })();
      return hydratePromise;
    },

    createFolder: (parentId, desiredName) => {
      const state = get();
      const parent = state.nodes[parentId];
      if (!parent || (parent.kind !== 'folder' && parent.kind !== 'drive')) {
        return null;
      }

      const name = getUniqueNodeName(state.nodes, parentId, desiredName?.trim() || 'New folder');
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
      set({ nodes: nextNodes, storageUsedBytes: Math.max(state.storageUsedBytes, storageUsedBytes) });
      return id;
    },

    createMediaFile: async (parentId, fileName, blob) => {
      const state = get();
      const parent = state.nodes[parentId];
      if (!parent || (parent.kind !== 'folder' && parent.kind !== 'drive')) {
        return null;
      }

      const trimmed = fileName.trim() || 'download.mp4';
      const dotIdx = trimmed.lastIndexOf('.');
      const baseName = dotIdx > 0 ? trimmed.slice(0, dotIdx) : trimmed;
      const ext = dotIdx > 0 ? trimmed.slice(dotIdx) : '';
      const name = getUniqueNodeName(state.nodes, parentId, baseName, ext);
      const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const blobId = id;
      const timestamp = Date.now();

      await saveMediaBlob(blobId, blob);

      const latest = get();
      const nextNodes: Record<string, FsNode> = {
        ...latest.nodes,
        [id]: {
          id,
          parentId,
          name,
          kind: 'file',
          icon: '/assets/icons/media-file.svg',
          mimeType: blob.type || 'video/mp4',
          sizeBytes: blob.size,
          blobId,
          isSystem: false,
          createdAt: timestamp,
          modifiedAt: timestamp,
        },
      };

      const storageUsedBytes = persistNodes(nextNodes);
      set({ nodes: nextNodes, storageUsedBytes: Math.max(latest.storageUsedBytes, storageUsedBytes) });
      return id;
    },

    createTextFile: (parentId, desiredName, initialContent = '') => {
      const state = get();
      const parent = state.nodes[parentId];
      if (!parent || (parent.kind !== 'folder' && parent.kind !== 'drive')) {
        return null;
      }

      const trimmed = desiredName?.trim();
      let baseName = 'New Text Document';
      let ext = '.txt';
      let icon = '/assets/icons/txt-file.svg';
      if (trimmed) {
        const lower = trimmed.toLowerCase();
        if (lower.endsWith('.txt')) {
          baseName = trimmed.slice(0, -4) || 'New Text Document';
        } else if (lower.endsWith('.unidoc')) {
          baseName = trimmed.slice(0, -7) || 'Document';
          ext = '.unidoc';
          icon = '/assets/icons/word.svg';
        } else if (lower.endsWith('.unisheet')) {
          baseName = trimmed.slice(0, -9) || 'Book';
          ext = '.unisheet';
          icon = '/assets/icons/excel.svg';
        } else {
          baseName = trimmed;
          ext = '.txt';
        }
      }

      const name = getUniqueNodeName(state.nodes, parentId, baseName, ext);
      const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = Date.now();

      const nextNodes: Record<string, FsNode> = {
        ...state.nodes,
        [id]: {
          id,
          parentId,
          name,
          kind: 'file',
          icon,
          content: initialContent,
          isSystem: false,
          createdAt: timestamp,
          modifiedAt: timestamp,
        },
      };

      const storageUsedBytes = persistNodes(nextNodes);
      set({ nodes: nextNodes, storageUsedBytes: Math.max(state.storageUsedBytes, storageUsedBytes) });
      return id;
    },

    updateFileContent: (id, content) => {
      set((state) => {
        const target = state.nodes[id];
        if (!target || target.kind !== 'file') return state;

        const nextNodes: Record<string, FsNode> = {
          ...state.nodes,
          [id]: {
            ...target,
            content,
            modifiedAt: Date.now(),
          },
        };
        const storageUsedBytes = persistNodes(nextNodes);
        return { nodes: nextNodes, storageUsedBytes };
      });
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
              const desc = nextNodes[descId];
              if (desc?.blobId) {
                void deleteMediaBlob(desc.blobId);
              }
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
        toRemove.forEach((id) => {
          const node = nextNodes[id];
          if (node?.blobId) {
            void deleteMediaBlob(node.blobId);
          }
          delete nextNodes[id];
        });
        const storageUsedBytes = persistNodes(nextNodes);
        return { nodes: nextNodes, storageUsedBytes };
      });
    },

    refreshStorageStats: async () => {
      const stats = await estimateStorageStats(get().nodes);
      set({
        storageUsedBytes: stats.usedBytes,
        storageQuotaBytes: stats.quotaBytes,
      });
    },
  };
});

if (typeof window !== 'undefined') {
  void useFileSystemStore.getState().hydrate();
}
