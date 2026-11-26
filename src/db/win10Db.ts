import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FsNode, GridSlot, PersistedDesktopLayout, TaskbarSettings } from './types';

export const DB_NAME = 'win10_db';
export const DB_VERSION = 1;
export const FS_STORE = 'fs_nodes';
export const DESKTOP_STORE = 'desktop_state';
export const DESKTOP_LAYOUT_KEY = 'desktop_layout_v1';
export const TASKBAR_SETTINGS_KEY = 'taskbar_settings_v1';

const LEGACY_FS_STORAGE_KEY = 'win10_fs_v1';
const LEGACY_DESKTOP_LAYOUT_KEY = 'win10_desktop_layout_v1';

export const DEFAULT_IDB_QUOTA_BYTES = 1024 * 1024 * 1024; // 1.00 GB fallback when navigator.storage.estimate is unavailable

interface DesktopLayoutRecord extends PersistedDesktopLayout {
  key: string;
}

interface TaskbarSettingsRecord {
  key: string;
  settings: TaskbarSettings;
}

interface Win10DBSchema extends DBSchema {
  [FS_STORE]: {
    key: string;
    value: FsNode;
  };
  [DESKTOP_STORE]: {
    key: string;
    value: DesktopLayoutRecord | TaskbarSettingsRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<Win10DBSchema> | null> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function getDb(): Promise<IDBPDatabase<Win10DBSchema> | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = openDB<Win10DBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(FS_STORE)) {
          db.createObjectStore(FS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DESKTOP_STORE)) {
          db.createObjectStore(DESKTOP_STORE, { keyPath: 'key' });
        }
      },
    }).catch(() => null);
  }
  return dbPromise;
}

function enqueueWrite(task: () => Promise<void>): Promise<void> {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => undefined);
  return next;
}

function hasValidCoreNodes(nodes: Record<string, FsNode>): boolean {
  return Boolean(nodes['this-pc'] && nodes['drive-c'] && nodes['recycle-bin']);
}

function readLegacyLocalStorageFs(): Record<string, FsNode> | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_FS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, FsNode>;
    return hasValidCoreNodes(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readLegacyLocalStorageLayout(): PersistedDesktopLayout | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_DESKTOP_LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedDesktopLayout>;
    return {
      positions: parsed.positions ?? {},
      labels: parsed.labels ?? {},
    };
  } catch {
    return null;
  }
}

export function measureNodesBytes(nodes: Record<string, FsNode>): number {
  const serialized = JSON.stringify(nodes);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(serialized).length;
  }
  return serialized.length * 2;
}

export async function estimateStorageStats(
  nodes: Record<string, FsNode>,
): Promise<{ usedBytes: number; quotaBytes: number }> {
  const measuredBytes = measureNodesBytes(nodes);
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const quotaBytes =
        estimate.quota && estimate.quota > 0 ? estimate.quota : DEFAULT_IDB_QUOTA_BYTES;
      const usedBytes = Math.max(estimate.usage ?? 0, measuredBytes);
      return { usedBytes, quotaBytes };
    } catch {
      // Fallback below
    }
  }
  return {
    usedBytes: measuredBytes,
    quotaBytes: DEFAULT_IDB_QUOTA_BYTES,
  };
}

export async function saveAllFileSystemNodes(nodes: Record<string, FsNode>): Promise<void> {
  return enqueueWrite(async () => {
    const db = await getDb();
    if (!db) return;
    const tx = db.transaction(FS_STORE, 'readwrite');
    await tx.store.clear();
    await Promise.all(Object.values(nodes).map((node) => tx.store.put(node)));
    await tx.done;
  });
}

export async function loadOrInitFileSystemNodes(
  defaultNodes: Record<string, FsNode>,
): Promise<Record<string, FsNode>> {
  const db = await getDb();
  if (!db) return defaultNodes;

  try {
    const rows = await db.getAll(FS_STORE);
    if (rows.length > 0) {
      const record: Record<string, FsNode> = {};
      for (const node of rows) {
        record[node.id] = node;
      }
      if (hasValidCoreNodes(record)) {
        return record;
      }
      const repaired = { ...defaultNodes, ...record };
      await saveAllFileSystemNodes(repaired);
      return repaired;
    }

    const legacyNodes = readLegacyLocalStorageFs();
    const initialNodes = legacyNodes ?? defaultNodes;
    await saveAllFileSystemNodes(initialNodes);
    if (legacyNodes && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(LEGACY_FS_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    return initialNodes;
  } catch {
    return defaultNodes;
  }
}

export async function saveDesktopLayout(layout: PersistedDesktopLayout): Promise<void> {
  return enqueueWrite(async () => {
    const db = await getDb();
    if (!db) return;
    await db.put(DESKTOP_STORE, {
      key: DESKTOP_LAYOUT_KEY,
      positions: layout.positions,
      labels: layout.labels,
    });
  });
}

export async function loadOrInitDesktopLayout(
  defaultPositions: Record<string, GridSlot>,
): Promise<PersistedDesktopLayout> {
  const db = await getDb();
  if (!db) {
    return { positions: defaultPositions, labels: {} };
  }

  try {
    const stored = await db.get(DESKTOP_STORE, DESKTOP_LAYOUT_KEY) as DesktopLayoutRecord | undefined;
    if (stored) {
      return {
        positions: { ...defaultPositions, ...(stored.positions ?? {}) },
        labels: stored.labels ?? {},
      };
    }

    const legacy = readLegacyLocalStorageLayout();
    if (legacy) {
      const migrated: PersistedDesktopLayout = {
        positions: { ...defaultPositions, ...legacy.positions },
        labels: legacy.labels,
      };
      await saveDesktopLayout(migrated);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(LEGACY_DESKTOP_LAYOUT_KEY);
        } catch {
          // Ignore storage errors
        }
      }
      return migrated;
    }

    const initial: PersistedDesktopLayout = { positions: defaultPositions, labels: {} };
    await saveDesktopLayout(initial);
    return initial;
  } catch {
    return { positions: defaultPositions, labels: {} };
  }
}

export async function saveTaskbarSettings(settings: TaskbarSettings): Promise<void> {
  return enqueueWrite(async () => {
    const db = await getDb();
    if (!db) return;
    await db.put(DESKTOP_STORE, {
      key: TASKBAR_SETTINGS_KEY,
      settings,
    });
  });
}

export async function loadOrInitTaskbarSettings(
  defaultSettings: TaskbarSettings,
): Promise<TaskbarSettings> {
  const db = await getDb();
  if (!db) return defaultSettings;

  try {
    const stored = (await db.get(DESKTOP_STORE, TASKBAR_SETTINGS_KEY)) as
      | TaskbarSettingsRecord
      | undefined;
    if (stored?.settings) {
      return {
        ...defaultSettings,
        ...stored.settings,
        toolbars: { ...defaultSettings.toolbars, ...(stored.settings.toolbars ?? {}) },
        systemIcons: { ...defaultSettings.systemIcons, ...(stored.settings.systemIcons ?? {}) },
        pinnedAppIds: Array.isArray(stored.settings.pinnedAppIds)
          ? stored.settings.pinnedAppIds
          : defaultSettings.pinnedAppIds,
      };
    }
    await saveTaskbarSettings(defaultSettings);
    return defaultSettings;
  } catch {
    return defaultSettings;
  }
}
