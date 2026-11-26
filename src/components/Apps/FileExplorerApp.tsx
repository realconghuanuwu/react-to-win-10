import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';
import {
  QUICK_ACCESS_IDS,
  formatStorageBytes,
  useFileSystemStore,
  type FsNode,
} from '../../store/useFileSystemStore';

interface FileExplorerAppProps {
  windowId: string;
  initialFolderId: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  targetNodeId: string | null;
}

export function FileExplorerApp({ windowId, initialFolderId }: FileExplorerAppProps) {
  const nodes = useFileSystemStore((state) => state.nodes);
  const storageUsedBytes = useFileSystemStore((state) => state.storageUsedBytes);
  const storageQuotaBytes = useFileSystemStore((state) => state.storageQuotaBytes);
  const createFolder = useFileSystemStore((state) => state.createFolder);
  const renameNode = useFileSystemStore((state) => state.renameNode);
  const deleteNodes = useFileSystemStore((state) => state.deleteNodes);
  const restoreNodes = useFileSystemStore((state) => state.restoreNodes);
  const emptyRecycleBin = useFileSystemStore((state) => state.emptyRecycleBin);
  const refreshStorageStats = useFileSystemStore((state) => state.refreshStorageStats);

  const setWindowTitle = useDesktopStore((state) => state.setWindowTitle);
  const explorerStartFolderId = useDesktopStore((state) => state.explorerStartFolderId);

  const [history, setHistory] = useState<string[]>([initialFolderId]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const prevStartFolderRef = useRef(initialFolderId);

  useEffect(() => {
    if (
      windowId === 'explorer' &&
      explorerStartFolderId !== prevStartFolderRef.current &&
      useFileSystemStore.getState().nodes[explorerStartFolderId]
    ) {
      prevStartFolderRef.current = explorerStartFolderId;
      setHistory([explorerStartFolderId]);
      setHistoryIdx(0);
    }
  }, [windowId, explorerStartFolderId]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [drivesCollapsed, setDrivesCollapsed] = useState(false);
  const [expandedTreeIds, setExpandedTreeIds] = useState<Set<string>>(
    () => new Set(['quick-access', 'this-pc', 'drive-c']),
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const currentFolderId = history[historyIdx] ?? 'this-pc';
  const currentNode = nodes[currentFolderId] ?? nodes['this-pc'];

  useEffect(() => {
    void refreshStorageStats();
  }, [refreshStorageStats]);

  useEffect(() => {
    if (currentNode) {
      setWindowTitle(windowId, currentNode.name);
    }
  }, [windowId, currentNode, setWindowTitle]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener('pointerdown', handleClose);
    return () => window.removeEventListener('pointerdown', handleClose);
  }, [contextMenu]);

  const navigateTo = (folderId: string) => {
    if (!nodes[folderId]) return;
    if (folderId === currentFolderId) {
      setSelectedIds([]);
      return;
    }
    const nextHistory = history.slice(0, historyIdx + 1);
    nextHistory.push(folderId);
    setHistory(nextHistory);
    setHistoryIdx(nextHistory.length - 1);
    setSelectedIds([]);
    setRenamingId(null);
    setSearchQuery('');
    setContextMenu(null);
  };

  const canGoBack = historyIdx > 0;
  const canGoForward = historyIdx < history.length - 1;
  const canGoUp = currentNode?.parentId !== null;

  const goBack = () => {
    if (!canGoBack) return;
    setHistoryIdx((idx) => idx - 1);
    setSelectedIds([]);
    setRenamingId(null);
  };

  const goForward = () => {
    if (!canGoForward) return;
    setHistoryIdx((idx) => idx + 1);
    setSelectedIds([]);
    setRenamingId(null);
  };

  const goUp = () => {
    if (!currentNode?.parentId) return;
    navigateTo(currentNode.parentId);
  };

  const breadcrumbs = useMemo(() => {
    const chain: FsNode[] = [];
    let cursor: FsNode | undefined = currentNode;
    const guard = new Set<string>();
    while (cursor && !guard.has(cursor.id)) {
      guard.add(cursor.id);
      chain.unshift(cursor);
      cursor = cursor.parentId ? nodes[cursor.parentId] : undefined;
    }
    return chain;
  }, [currentNode, nodes]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, FsNode[]>();
    Object.values(nodes).forEach((node) => {
      if (!node.parentId) return;
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    });
    map.forEach((list) => {
      list.sort((a, b) => {
        if (a.kind !== b.kind) {
          if (a.kind === 'drive') return 1;
          if (b.kind === 'drive') return -1;
        }
        return a.name.localeCompare(b.name);
      });
    });
    return map;
  }, [nodes]);

  const currentChildren = useMemo(() => {
    const raw = childrenMap.get(currentFolderId) ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return raw;
    return raw.filter((item) => item.name.toLowerCase().includes(query));
  }, [childrenMap, currentFolderId, searchQuery]);

  const thisPcFolders = useMemo(
    () => currentChildren.filter((item) => item.kind === 'folder'),
    [currentChildren],
  );
  const thisPcDrives = useMemo(
    () => currentChildren.filter((item) => item.kind === 'drive'),
    [currentChildren],
  );

  const canCreateFolder =
    currentNode.kind !== 'root' && currentNode.kind !== 'bin';

  const handleCreateNewFolder = () => {
    if (!canCreateFolder) return;
    const createdId = createFolder(currentFolderId);
    if (!createdId) return;
    setExpandedTreeIds((prev) => {
      const next = new Set(prev);
      next.add(currentFolderId);
      return next;
    });
    setSelectedIds([createdId]);
    const createdNode = useFileSystemStore.getState().nodes[createdId];
    if (createdNode) {
      setRenamingId(createdId);
      setRenameDraft(createdNode.name);
    }
  };

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      renameNode(renamingId, renameDraft);
    }
    setRenamingId(null);
  };

  const selectedMutableIds = useMemo(
    () => selectedIds.filter((id) => nodes[id] && !nodes[id].isSystem),
    [selectedIds, nodes],
  );

  const handleDeleteSelected = () => {
    if (selectedMutableIds.length === 0) return;
    deleteNodes(selectedMutableIds);
    setSelectedIds([]);
  };

  const handleStartRename = (id?: string) => {
    const targetId = id ?? selectedMutableIds[0];
    if (!targetId) return;
    const node = nodes[targetId];
    if (!node || node.isSystem) return;
    setRenamingId(targetId);
    setRenameDraft(node.name);
  };

  const toggleTreeExpand = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setExpandedTreeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const usedPct = Math.min(100, (storageUsedBytes / storageQuotaBytes) * 100);
  const freeBytes = Math.max(0, storageQuotaBytes - storageUsedBytes);

  const renderTreeNode = (nodeId: string, depth: number) => {
    const node = nodes[nodeId];
    if (!node) return null;
    const childFolders = (childrenMap.get(nodeId) ?? []).filter(
      (c) => c.kind === 'folder' || c.kind === 'drive',
    );
    const hasChildren = childFolders.length > 0;
    const isExpanded = expandedTreeIds.has(nodeId);
    const isCurrent = currentFolderId === nodeId;

    return (
      <div key={`${depth}-${nodeId}`}>
        <div
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          onClick={() => navigateTo(nodeId)}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={[
            'flex items-center gap-1.5 h-[24px] pr-2 text-[12px] cursor-default transition-colors',
            isCurrent ? 'bg-[#333333] text-white' : 'text-[#e0e0e0] hover:bg-[#2a2a2a]',
          ].join(' ')}
        >
          <button
            type="button"
            aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={(e) => (hasChildren ? toggleTreeExpand(nodeId, e) : undefined)}
            className={`w-3.5 h-3.5 flex items-center justify-center shrink-0 text-[10px] text-[#9b9b9b] ${
              hasChildren ? 'hover:text-white' : 'opacity-0 pointer-events-none'
            }`}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
          <img src={node.icon} alt="" className="w-4 h-4 object-contain shrink-0 pointer-events-none" />
          <span className="truncate">{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>{childFolders.map((child) => renderTreeNode(child.id, depth + 1))}</div>
        )}
      </div>
    );
  };

  const handlePaneContextMenu = (e: MouseEvent, targetNodeId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetNodeId && !selectedIds.includes(targetNodeId)) {
      setSelectedIds([targetNodeId]);
    }
    const rect = rootRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : e.clientX;
    const y = rect ? e.clientY - rect.top : e.clientY;
    setContextMenu({ x, y, targetNodeId });
  };

  const renderFolderTile = (item: FsNode) => {
    const isSelected = selectedIds.includes(item.id);
    const isRenaming = renamingId === item.id;

    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedIds((prev) =>
            e.ctrlKey || e.metaKey
              ? prev.includes(item.id)
                ? prev.filter((x) => x !== item.id)
                : [...prev, item.id]
              : [item.id],
          );
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (currentFolderId !== 'recycle-bin') {
            navigateTo(item.id);
          }
        }}
        onContextMenu={(e) => handlePaneContextMenu(e, item.id)}
        className={[
          'flex items-center gap-2.5 w-[205px] px-2.5 py-2 border transition-colors cursor-default',
          isSelected
            ? 'bg-[#363636] border-[#666666]'
            : 'border-transparent hover:bg-[#2a2a2a]',
        ].join(' ')}
      >
        <img
          src={item.icon}
          alt={item.name}
          draggable={false}
          className="w-10 h-10 object-contain shrink-0 pointer-events-none"
        />
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[#191919] border border-[#0078d7] text-white text-[12px] px-1 py-0.5 outline-none"
            />
          ) : (
            <div className="text-[12.5px] text-white truncate">{item.name}</div>
          )}
          <div className="text-[11px] text-[#999999]">File folder</div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      onClick={() => setSelectedIds([])}
      className="relative flex flex-col flex-1 bg-[#191919] text-white overflow-hidden select-none"
    >
      {/* Menu Tabs */}
      <div className="flex items-center h-[24px] bg-[#191919] border-b border-[#2b2b2b] text-[12px] shrink-0">
        <span className="flex items-center h-full px-4 bg-[#0078d7] text-white">File</span>
        <span className="flex items-center h-full px-4 bg-[#202020] text-white border-r border-[#333333]">
          {currentFolderId === 'this-pc' ? 'Computer' : 'Home'}
        </span>
        <span className="flex items-center h-full px-4 text-[#cccccc] hover:bg-white/5">
          View
        </span>
      </div>

      {/* Ribbon Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[#202020] border-b border-[#333333] shrink-0">
        {currentFolderId === 'recycle-bin' ? (
          <>
            <button
              type="button"
              disabled={selectedMutableIds.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                restoreNodes(selectedMutableIds);
                setSelectedIds([]);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-transparent enabled:hover:bg-[#333333] enabled:hover:border-[#4d4d4d] disabled:opacity-40 cursor-default"
            >
              <span>Restore selected</span>
            </button>
            <button
              type="button"
              disabled={currentChildren.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                emptyRecycleBin();
                setSelectedIds([]);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-transparent enabled:hover:bg-[#333333] enabled:hover:border-[#4d4d4d] disabled:opacity-40 cursor-default"
            >
              <img src="/assets/icons/trash-can.png" alt="" className="w-4 h-4 object-contain" />
              <span>Empty Recycle Bin</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={!canCreateFolder}
              title={canCreateFolder ? 'Create a new folder' : 'Open a drive or folder to create a folder'}
              onClick={(e) => {
                e.stopPropagation();
                handleCreateNewFolder();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-transparent enabled:hover:bg-[#333333] enabled:hover:border-[#4d4d4d] disabled:opacity-40 cursor-default"
            >
              <img src="/assets/icons/folder-win10.png" alt="" className="w-4 h-4 object-contain" />
              <span>New folder</span>
            </button>

            <button
              type="button"
              disabled={selectedMutableIds.length !== 1}
              onClick={(e) => {
                e.stopPropagation();
                handleStartRename();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-transparent enabled:hover:bg-[#333333] enabled:hover:border-[#4d4d4d] disabled:opacity-40 cursor-default"
            >
              <span>Rename</span>
            </button>

            <button
              type="button"
              disabled={selectedMutableIds.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSelected();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-transparent enabled:hover:bg-[#333333] enabled:hover:border-[#4d4d4d] disabled:opacity-40 cursor-default"
            >
              <span>Delete</span>
            </button>

            <div className="h-5 w-px bg-[#3b3b3b] mx-1" />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateTo('drive-c');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-transparent hover:bg-[#333333] hover:border-[#4d4d4d] cursor-default"
            >
              <img src="/assets/icons/drive-os.png" alt="" className="w-4 h-4 object-contain" />
              <span>Local Disk (C:)</span>
            </button>
          </>
        )}
      </div>

      {/* Navigation + Breadcrumb + Search Bar */}
      <div className="flex items-center gap-1.5 h-[34px] px-2 bg-[#191919] border-b border-[#2d2d2d] shrink-0">
        <button
          type="button"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={goBack}
          className="w-6 h-6 flex items-center justify-center text-[13px] enabled:hover:bg-white/10 disabled:opacity-35 cursor-default"
        >
          ←
        </button>
        <button
          type="button"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={goForward}
          className="w-6 h-6 flex items-center justify-center text-[13px] enabled:hover:bg-white/10 disabled:opacity-35 cursor-default"
        >
          →
        </button>
        <button
          type="button"
          aria-label="Up one level"
          disabled={!canGoUp}
          onClick={goUp}
          className="w-6 h-6 flex items-center justify-center text-[13px] enabled:hover:bg-white/10 disabled:opacity-35 cursor-default"
        >
          ↑
        </button>

        {/* Address Bar */}
        <div className="flex items-center flex-1 h-[24px] bg-[#191919] border border-[#3d3d3d] px-2 gap-1 text-[12px] overflow-hidden">
          <img src={currentNode.icon} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.id} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <span className="text-[#888888] text-[10px]">›</span>}
                <button
                  type="button"
                  onClick={() => navigateTo(crumb.id)}
                  className="px-1 py-0.5 hover:bg-white/10 text-white/95 cursor-default"
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          aria-label="Refresh folder"
          onClick={() => refreshStorageStats()}
          className="w-6 h-6 flex items-center justify-center text-[13px] hover:bg-white/10 cursor-default"
        >
          ↻
        </button>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder={`Search ${currentNode.name}`}
          className="w-[180px] h-[24px] bg-[#191919] border border-[#3d3d3d] focus:border-[#0078d7] px-2 text-[12px] text-white placeholder:text-[#888888] outline-none"
        />
      </div>

      {/* Main Split Pane */}
      <div className="flex flex-1 min-h-0">
        {/* Left Navigation Tree */}
        <aside
          aria-label="Folder tree"
          onClick={(e) => e.stopPropagation()}
          className="w-[225px] shrink-0 bg-[#191919] border-r border-[#2d2d2d] overflow-y-auto py-1.5"
        >
          {/* Quick access */}
          <div>
            <div
              onClick={() =>
                setExpandedTreeIds((prev) => {
                  const next = new Set(prev);
                  if (next.has('quick-access')) next.delete('quick-access');
                  else next.add('quick-access');
                  return next;
                })
              }
              className="flex items-center gap-1.5 h-[24px] px-1.5 text-[12px] text-[#e0e0e0] hover:bg-[#2a2a2a] cursor-default"
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] text-[#9b9b9b]">
                {expandedTreeIds.has('quick-access') ? '▾' : '▸'}
              </span>
              <img src="/assets/icons/explorer/star-sm.png" alt="" className="w-4 h-4 object-contain" />
              <span>Quick access</span>
            </div>
            {expandedTreeIds.has('quick-access') && (
              <div>
                {QUICK_ACCESS_IDS.map((qaId) => {
                  const qNode = nodes[qaId];
                  if (!qNode) return null;
                  return (
                    <div
                      key={`qa-${qaId}`}
                      onClick={() => navigateTo(qaId)}
                      style={{ paddingLeft: '26px' }}
                      className={[
                        'flex items-center gap-1.5 h-[24px] pr-2 text-[12px] cursor-default',
                        currentFolderId === qaId
                          ? 'bg-[#333333] text-white'
                          : 'text-[#e0e0e0] hover:bg-[#2a2a2a]',
                      ].join(' ')}
                    >
                      <img src={qNode.icon} alt="" className="w-4 h-4 object-contain shrink-0" />
                      <span className="truncate">{qNode.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="my-1.5 border-t border-[#2b2b2b]" />

          {/* This PC recursive tree */}
          {renderTreeNode('this-pc', 0)}

          <div className="my-1.5 border-t border-[#2b2b2b]" />

          {/* Recycle Bin */}
          {renderTreeNode('recycle-bin', 0)}
        </aside>

        {/* Main Folder / Drive Content */}
        <section
          aria-label="Folder contents"
          onContextMenu={(e) => handlePaneContextMenu(e, null)}
          className="flex-1 bg-[#191919] overflow-y-auto p-4"
        >
          {currentFolderId === 'this-pc' ? (
            <div className="space-y-5">
              {/* Folders Section */}
              <div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFoldersCollapsed((c) => !c);
                  }}
                  className="flex items-center gap-2 w-full text-left text-[12.5px] text-[#e0e0e0] pb-1.5 border-b border-[#2d2d2d] mb-2.5 cursor-default"
                >
                  <span className="text-[10px] text-[#9b9b9b]">{foldersCollapsed ? '▸' : '▾'}</span>
                  <span>Folders ({thisPcFolders.length})</span>
                </button>
                {!foldersCollapsed && (
                  <div className="flex flex-wrap gap-2">
                    {thisPcFolders.map((folder) => {
                      const isSelected = selectedIds.includes(folder.id);
                      return (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIds([folder.id]);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            navigateTo(folder.id);
                          }}
                          className={[
                            'flex items-center gap-3 w-[200px] px-2.5 py-2 border text-left transition-colors cursor-default',
                            isSelected
                              ? 'bg-[#363636] border-[#666666]'
                              : 'border-transparent hover:bg-[#2a2a2a]',
                          ].join(' ')}
                        >
                          <img
                            src={folder.icon}
                            alt={folder.name}
                            draggable={false}
                            className="w-10 h-10 object-contain shrink-0 pointer-events-none"
                          />
                          <span className="text-[12.5px] text-white truncate">{folder.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Devices and drives Section */}
              <div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrivesCollapsed((c) => !c);
                  }}
                  className="flex items-center gap-2 w-full text-left text-[12.5px] text-[#e0e0e0] pb-1.5 border-b border-[#2d2d2d] mb-2.5 cursor-default"
                >
                  <span className="text-[10px] text-[#9b9b9b]">{drivesCollapsed ? '▸' : '▾'}</span>
                  <span>Devices and drives ({thisPcDrives.length})</span>
                </button>
                {!drivesCollapsed && (
                  <div className="flex flex-wrap gap-3">
                    {thisPcDrives.map((drive) => {
                      const isSelected = selectedIds.includes(drive.id);
                      return (
                        <button
                          key={drive.id}
                          type="button"
                          data-testid="drive-card-c"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIds([drive.id]);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            navigateTo(drive.id);
                          }}
                          className={[
                            'flex items-center gap-3 w-[275px] px-2.5 py-2 border text-left transition-colors cursor-default',
                            isSelected
                              ? 'bg-[#363636] border-[#666666]'
                              : 'border-transparent hover:bg-[#2a2a2a]',
                          ].join(' ')}
                        >
                          <img
                            src={drive.icon}
                            alt={drive.name}
                            draggable={false}
                            className="w-11 h-11 object-contain shrink-0 pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] text-white truncate">{drive.name}</div>
                            <div className="w-full h-[14px] bg-[#3b3b3b] border border-[#555555] my-1 overflow-hidden">
                              <div
                                style={{ width: `${Math.max(2, usedPct)}%` }}
                                className={`h-full transition-all duration-300 ${
                                  usedPct >= 90 ? 'bg-[#da2626]' : 'bg-[#26a0da]'
                                }`}
                              />
                            </div>
                            <div
                              data-testid="drive-storage-caption"
                              className="text-[11px] text-[#b0b0b0] truncate"
                            >
                              {formatStorageBytes(freeBytes)} free of {formatStorageBytes(storageQuotaBytes)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : currentChildren.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[13px] text-[#888888] gap-2">
              <span>
                {currentFolderId === 'recycle-bin'
                  ? 'Recycle Bin is empty.'
                  : 'This folder is empty.'}
              </span>
              {canCreateFolder && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateNewFolder();
                  }}
                  className="px-3 py-1 bg-[#2b2b2b] border border-[#4a4a4a] hover:bg-[#3a3a3a] text-[12px] text-white cursor-default"
                >
                  New folder
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 content-start">
              {currentChildren.map(renderFolderTile)}
            </div>
          )}
        </section>
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between h-[24px] px-3 bg-[#1c1c1c] border-t border-[#2d2d2d] text-[11.5px] text-[#cccccc] shrink-0">
        <div className="flex items-center gap-3">
          <span>
            {currentChildren.length} {currentChildren.length === 1 ? 'item' : 'items'}
          </span>
          {selectedIds.length > 0 && (
            <span className="border-l border-[#3a3a3a] pl-3">
              {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'} selected
            </span>
          )}
        </div>
        <div data-testid="explorer-storage-status" className="text-[#aaaaaa] tabular-nums">
          IndexedDB: {formatStorageBytes(storageUsedBytes)} / {formatStorageBytes(storageQuotaBytes)}
        </div>
      </footer>

      {/* Explorer Context Menu */}
      {contextMenu && (
        <div
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="absolute z-40 w-[180px] bg-[#2b2b2b] border border-[#767676] shadow-xl py-1 text-[12px] text-white"
        >
          {contextMenu.targetNodeId ? (
            <>
              {currentFolderId !== 'recycle-bin' && (
                <button
                  type="button"
                  onClick={() => {
                    navigateTo(contextMenu.targetNodeId!);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#414141] cursor-default"
                >
                  Open
                </button>
              )}
              {currentFolderId === 'recycle-bin' ? (
                <button
                  type="button"
                  onClick={() => {
                    restoreNodes([contextMenu.targetNodeId!]);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#414141] cursor-default"
                >
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  disabled={Boolean(nodes[contextMenu.targetNodeId]?.isSystem)}
                  onClick={() => {
                    handleStartRename(contextMenu.targetNodeId!);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 enabled:hover:bg-[#414141] disabled:text-[#777777] cursor-default"
                >
                  Rename
                </button>
              )}
              <button
                type="button"
                disabled={Boolean(nodes[contextMenu.targetNodeId]?.isSystem)}
                onClick={() => {
                  deleteNodes([contextMenu.targetNodeId!]);
                  setSelectedIds([]);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1 enabled:hover:bg-[#414141] disabled:text-[#777777] cursor-default"
              >
                {currentFolderId === 'recycle-bin' ? 'Delete permanently' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!canCreateFolder}
                onClick={() => {
                  handleCreateNewFolder();
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1 enabled:hover:bg-[#414141] disabled:text-[#777777] cursor-default"
              >
                New folder
              </button>
              <button
                type="button"
                onClick={() => {
                  refreshStorageStats();
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1 hover:bg-[#414141] cursor-default"
              >
                Refresh
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
