import { create } from 'zustand';
import type { FsNode, FsNodeKind } from '../db/types';
import { getOwningDriveId } from '../utils/fileStorage';
import {
  DEFAULT_IDB_QUOTA_BYTES,
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

export type FileClipboardMode = 'cut' | 'copy';

interface FileClipboard {
  mode: FileClipboardMode;
  ids: string[];
}

function ancestorIds(nodes: Record<string, FsNode>, id: string): Set<string> {
  const ids = new Set<string>();
  let node: FsNode | undefined = nodes[id];
  while (node && !ids.has(node.id)) {
    ids.add(node.id);
    node = node.parentId ? nodes[node.parentId] : undefined;
  }
  return ids;
}

function getPasteSources(
  nodes: Record<string, FsNode>,
  clipboard: FileClipboard | null,
  parentId: string,
): FsNode[] {
  const parent = nodes[parentId];
  if (!clipboard || (parent?.kind !== 'folder' && parent?.kind !== 'drive')) return [];

  const destinationAncestors = ancestorIds(nodes, parentId);
  if (destinationAncestors.has('recycle-bin')) return [];
  const sources = clipboard.ids
    .map((id) => nodes[id])
    .filter((node) => node && !ancestorIds(nodes, node.id).has('recycle-bin'));
  if (sources.some((node) => destinationAncestors.has(node.id))) return [];
  return sources.filter((node) => clipboard.mode === 'copy' || node.parentId !== parentId);
}

interface FileSystemState {
  nodes: Record<string, FsNode>;
  clipboard: FileClipboard | null;
  setFileClipboard: (mode: FileClipboardMode, ids: string[]) => boolean;
  pasteFiles: (parentId: string) => boolean;
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
let fileSystemWrite = Promise.resolve();

export function waitForFileSystemWrite(): Promise<void> {
  return fileSystemWrite;
}

export const useFileSystemStore = create<FileSystemState>((set, get) => {
  const persistNodes = (nextNodes: Record<string, FsNode>, removedIds?: Iterable<string>) => {
    hasUserMutated = true;
    // Copies share immutable media blobs until the last file referencing one is removed.
    const remainingBlobs = removedIds && new Set(Object.values(nextNodes).map((node) => node.blobId));
    const unusedBlobs = new Set<string>();
    if (removedIds && remainingBlobs) {
      const previousNodes = get().nodes;
      for (const id of removedIds) {
        const blobId = previousNodes[id]?.blobId;
        if (blobId && !remainingBlobs.has(blobId)) unusedBlobs.add(blobId);
      }
    }
    fileSystemWrite = saveAllFileSystemNodes(nextNodes, [...unusedBlobs]);
    void fileSystemWrite.then(async () => {
      const stats = await estimateStorageStats(get().nodes);
      set({
        storageUsedBytes: stats.usedBytes,
        storageQuotaBytes: stats.quotaBytes,
      });
    }).catch(() => undefined);
    return measureNodesBytes(nextNodes);
  };

  return {
    nodes: DEFAULT_NODES,
    clipboard: null,
    isHydrated: false,
    storageUsedBytes: measureNodesBytes(DEFAULT_NODES),
    storageQuotaBytes: DEFAULT_IDB_QUOTA_BYTES,

    setFileClipboard: (mode, ids) => {
      const { nodes } = get();
      const selected = new Set(ids.filter((id) => {
        const node = nodes[id];
        return node && !node.isSystem && (node.kind === 'file' || node.kind === 'folder') &&
          !ancestorIds(nodes, id).has('recycle-bin');
      }));
      const roots = [...selected].filter((id) =>
        ![...ancestorIds(nodes, id)].some((ancestor) => ancestor !== id && selected.has(ancestor)),
      );
      if (!roots.length) return false;
      set({ clipboard: { mode, ids: roots } });
      return true;
    },

    pasteFiles: (parentId) => {
      const { nodes, clipboard } = get();
      const sources = getPasteSources(nodes, clipboard, parentId);
      if (!clipboard || !sources.length) return false;

      const nextNodes = { ...nodes };
      const timestamp = Date.now();
      const children = new Map<string, FsNode[]>();
      if (clipboard.mode === 'copy') {
        for (const node of Object.values(nodes)) {
          if (!node.parentId) continue;
          const siblings = children.get(node.parentId) ?? [];
          siblings.push(node);
          children.set(node.parentId, siblings);
        }
      }

      function copyTree(node: FsNode, destination: string, name: string) {
        const id = `copy-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`;
        nextNodes[id] = {
          ...node, id, name, parentId: destination, createdAt: timestamp, originalParentId: undefined,
        };
        for (const child of children.get(node.id) ?? []) copyTree(child, id, child.name);
      }

      for (const node of sources) {
        const dot = node.kind === 'file' ? node.name.lastIndexOf('.') : -1;
        const base = dot > 0 ? node.name.slice(0, dot) : node.name;
        const extension = dot > 0 ? node.name.slice(dot) : '';
        const name = getUniqueNodeName(nextNodes, parentId, base, extension);
        if (clipboard.mode === 'copy') {
          copyTree(node, parentId, name);
        } else {
          nextNodes[node.id] = { ...node, name, parentId };
        }
      }
      const storageUsedBytes = persistNodes(nextNodes);
      set({ nodes: nextNodes, storageUsedBytes, clipboard: clipboard.mode === 'cut' ? null : clipboard });
      return true;
    },

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
      const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const blobId = id;
      const timestamp = Date.now();

      await saveMediaBlob(blobId, blob);

      const latest = get();
      const name = getUniqueNodeName(latest.nodes, parentId, baseName, ext);
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
      const persisted = waitForFileSystemWrite();
      set({ nodes: nextNodes, storageUsedBytes: Math.max(latest.storageUsedBytes, storageUsedBytes) });
      await persisted;
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
        const removedIds = new Set<string>();
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
              removedIds.add(descId);
              delete nextNodes[descId];
            }
          } else {
            nextNodes[id] = {
              ...target,
              originalParentId: target.parentId,
              originalDriveId: getOwningDriveId(state.nodes, id),
              parentId: 'recycle-bin',
              modifiedAt: Date.now(),
            };
          }
        }

        if (!changed) return state;
        const storageUsedBytes = persistNodes(nextNodes, removedIds);
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
            originalDriveId: undefined,
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
          delete nextNodes[id];
        });
        const storageUsedBytes = persistNodes(nextNodes, toRemove);
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

export function useCanPasteFiles(parentId: string): boolean {
  return useFileSystemStore((state) => getPasteSources(state.nodes, state.clipboard, parentId).length > 0);
}

if (typeof window !== 'undefined') {
  void useFileSystemStore.getState().hydrate();
}
