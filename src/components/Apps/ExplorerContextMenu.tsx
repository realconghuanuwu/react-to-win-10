import { useCanPasteFiles, useFileSystemStore, type FileClipboardMode } from '../../store/useFileSystemStore';
import { useEffect, useRef, useState } from 'react';
import type { FsNode } from '../../store/useFileSystemStore';

export type ExplorerViewMode =
  | 'extra-large'
  | 'large'
  | 'medium'
  | 'small'
  | 'list'
  | 'details'
  | 'tiles'
  | 'content';

export type ExplorerSortField = 'name' | 'date' | 'type' | 'size';
export type ExplorerSortOrder = 'asc' | 'desc';

type SubmenuKey = 'view' | 'sort' | 'group' | 'new' | null;

const VIEW_MODES: Array<{ id: ExplorerViewMode; label: string }> = [
  { id: 'extra-large', label: 'Extra large icons' },
  { id: 'large', label: 'Large icons' },
  { id: 'medium', label: 'Medium icons' },
  { id: 'small', label: 'Small icons' },
  { id: 'list', label: 'List' },
  { id: 'details', label: 'Details' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'content', label: 'Content' },
];

const SORT_FIELDS: Array<{ id: ExplorerSortField; label: string }> = [
  { id: 'name', label: 'Name' },
  { id: 'date', label: 'Date modified' },
  { id: 'type', label: 'Type' },
  { id: 'size', label: 'Size' },
];

function RightChevron() {
  return (
    <svg
      viewBox="0 0 8 12"
      width="7"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
      className="text-white/90 shrink-0"
    >
      <polyline points="1.5,1 6.5,6 1.5,11" />
    </svg>
  );
}

function RadioDot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" aria-hidden="true" />;
}

interface ExplorerContextMenuProps {
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
  currentFolderId: string;
  canCreate: boolean;
  targetNode: FsNode | null;
  selectedIds: string[];
  viewMode: ExplorerViewMode;
  sortField: ExplorerSortField;
  sortOrder: ExplorerSortOrder;
  groupBy: ExplorerSortField | 'none';
  onChangeViewMode: (mode: ExplorerViewMode) => void;
  onExpandAllGroups: () => void;
  onCollapseAllGroups: () => void;
  onChangeSortField: (field: ExplorerSortField) => void;
  onChangeSortOrder: (order: ExplorerSortOrder) => void;
  onChangeGroupBy: (field: ExplorerSortField | 'none') => void;
  onRefresh: () => void;
  onCreateFolder: () => void;
  onCreateTextFile: () => void;
  onOpenNode: (node: FsNode) => void;
  onRenameNode: (nodeId: string) => void;
  onDeleteNodes: (ids: string[]) => void;
  onRestoreNodes: (ids: string[]) => void;
  onShowProperties: () => void;
  onClose: () => void;
}

export function ExplorerContextMenu({
  x,
  y,
  containerWidth,
  containerHeight,
  currentFolderId,
  canCreate,
  targetNode,
  selectedIds,
  viewMode,
  sortField,
  sortOrder,
  groupBy,
  onChangeViewMode,
  onExpandAllGroups,
  onCollapseAllGroups,
  onChangeSortField,
  onChangeSortOrder,
  onChangeGroupBy,
  onRefresh,
  onCreateFolder,
  onCreateTextFile,
  onOpenNode,
  onRenameNode,
  onDeleteNodes,
  onRestoreNodes,
  onShowProperties,
  onClose,
}: ExplorerContextMenuProps) {
  const canPaste = useCanPasteFiles(currentFolderId);
  const canUndo = useFileSystemStore((state) => state.undoStack.length > 0);
  const setFileClipboard = useFileSystemStore((state) => state.setFileClipboard);
  const pasteFiles = useFileSystemStore((state) => state.pasteFiles);
  const pasteShortcuts = useFileSystemStore((state) => state.pasteShortcuts);
  const undo = useFileSystemStore((state) => state.undo);

  const [openSubmenu, setOpenSubmenu] = useState<SubmenuKey>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpenSubmenu(null);
  }, [x, y, targetNode?.id]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const menuWidth = 224;
  const approxHeight = targetNode ? 185 : 300;
  const left = Math.max(4, Math.min(x, Math.max(4, containerWidth - menuWidth - 6)));
  const top = Math.max(4, Math.min(y, Math.max(4, containerHeight - approxHeight - 6)));
  const openLeft = left + menuWidth + 190 > containerWidth;
  const submenuPosClass = openLeft ? 'right-full mr-[-2px]' : 'left-full ml-[-2px]';

  const rowClass =
    'relative flex items-center justify-between h-[25px] px-2 text-[12px] text-white hover:bg-[#414141] cursor-default';
  const disabledRowClass =
    'flex items-center justify-between h-[25px] px-2 text-[12px] text-[#7a7a7a] cursor-default';
  const dividerClass = 'h-px bg-[#5a5a5a] my-[3px] mx-[8px]';
  const gutterClass = 'w-[22px] shrink-0 flex items-center justify-center mr-1';

  if (targetNode) {
    const isInBin = currentFolderId === 'recycle-bin';
    const isMutable = !targetNode.isSystem;
    const actionIds = selectedIds.includes(targetNode.id) ? selectedIds : [targetNode.id];
    const canRename = isMutable && actionIds.length === 1;

    return (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Folder item context menu"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{ left, top, width: 196 }}
        className="absolute z-40 bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.55)] py-[3px] select-none"
      >
        {!isInBin && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenNode(targetNode);
              onClose();
            }}
            className={`${rowClass} w-full font-semibold`}
          >
            <div className="flex items-center">
              <span className={gutterClass} />
              <span>Open</span>
            </div>
          </button>
        )}

        {isInBin ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onRestoreNodes(actionIds);
              onClose();
            }}
            className={`${rowClass} w-full`}
          >
            <div className="flex items-center">
              <span className={gutterClass} />
              <span>Restore</span>
            </div>
          </button>
        ) : (
          <>
            <div className={dividerClass} />
            {(['cut', 'copy'] as FileClipboardMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                role="menuitem"
                disabled={!(isMutable)}
                className={isMutable ? `${rowClass} w-full` : `${disabledRowClass} w-full`}
                onClick={() => {
                  setFileClipboard(mode, actionIds);
                  onClose();
                }}
              >
                <div className="flex items-center">
                  <span className={gutterClass} />
                  <span>{mode === 'cut' ? 'Cut' : 'Copy'}</span>
                </div>
              </button>
            ))}
            <div className={dividerClass} />
            <button
              type="button"
              role="menuitem"
              disabled={!canRename}
              onClick={() => {
                onRenameNode(targetNode.id);
                onClose();
              }}
              className={canRename ? `${rowClass} w-full` : `${disabledRowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass} />
                <span>Rename</span>
              </div>
            </button>
          </>
        )}

        <button
          type="button"
          role="menuitem"
          disabled={!isMutable}
          onClick={() => {
            if (!isMutable) return;
            onDeleteNodes(actionIds);
            onClose();
          }}
          className={isMutable ? `${rowClass} w-full` : `${disabledRowClass} w-full`}
        >
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>{isInBin ? 'Delete permanently' : 'Delete'}</span>
          </div>
        </button>

        <div className={dividerClass} />

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onShowProperties();
            onClose();
          }}
          className={`${rowClass} w-full`}
        >
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>Properties</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Explorer folder context menu"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left, top, width: menuWidth }}
      className="absolute z-40 bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.55)] py-[3px] select-none"
    >
      {/* View */}
      <div
        role="menuitem"
        aria-haspopup="menu"
        onMouseEnter={() => setOpenSubmenu('view')}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>View</span>
        </div>
        <RightChevron />

        {openSubmenu === 'view' && (
          <div
            role="menu"
            className={`absolute top-[-4px] ${submenuPosClass} w-[188px] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.55)] py-[3px] z-50`}
          >
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="menuitemradio"
                aria-checked={viewMode === mode.id}
                onClick={() => {
                  onChangeViewMode(mode.id);
                  onClose();
                }}
                className={`${rowClass} w-full`}
              >
                <div className="flex items-center">
                  <span className={gutterClass}>{viewMode === mode.id && <RadioDot />}</span>
                  <span>{mode.label}</span>
                </div>
              </button>
            ))}
            <div className={dividerClass} />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onExpandAllGroups();
                onClose();
              }}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass} />
                <span>Expand all groups</span>
              </div>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCollapseAllGroups();
                onClose();
              }}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass} />
                <span>Collapse all groups</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Sort by */}
      <div
        role="menuitem"
        aria-haspopup="menu"
        onMouseEnter={() => setOpenSubmenu('sort')}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Sort by</span>
        </div>
        <RightChevron />

        {openSubmenu === 'sort' && (
          <div
            role="menu"
            className={`absolute top-[-4px] ${submenuPosClass} w-[170px] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.55)] py-[3px] z-50`}
          >
            {SORT_FIELDS.map((field) => (
              <button
                key={field.id}
                type="button"
                role="menuitemradio"
                aria-checked={sortField === field.id}
                onClick={() => {
                  onChangeSortField(field.id);
                  onClose();
                }}
                className={`${rowClass} w-full`}
              >
                <div className="flex items-center">
                  <span className={gutterClass}>{sortField === field.id && <RadioDot />}</span>
                  <span>{field.label}</span>
                </div>
              </button>
            ))}
            <div className={dividerClass} />
            <button
              type="button"
              role="menuitemradio"
              aria-checked={sortOrder === 'asc'}
              onClick={() => {
                onChangeSortOrder('asc');
                onClose();
              }}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{sortOrder === 'asc' && <RadioDot />}</span>
                <span>Ascending</span>
              </div>
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={sortOrder === 'desc'}
              onClick={() => {
                onChangeSortOrder('desc');
                onClose();
              }}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{sortOrder === 'desc' && <RadioDot />}</span>
                <span>Descending</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Group by */}
      <div
        role="menuitem"
        aria-haspopup="menu"
        onMouseEnter={() => setOpenSubmenu('group')}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Group by</span>
        </div>
        <RightChevron />

        {openSubmenu === 'group' && (
          <div
            role="menu"
            className={`absolute top-[-4px] ${submenuPosClass} w-[170px] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.55)] py-[3px] z-50`}
          >
            {SORT_FIELDS.map((field) => (
              <button
                key={`grp-${field.id}`}
                type="button"
                role="menuitemradio"
                aria-checked={groupBy === field.id}
                onClick={() => {
                  onChangeGroupBy(field.id);
                  onClose();
                }}
                className={`${rowClass} w-full`}
              >
                <div className="flex items-center">
                  <span className={gutterClass}>{groupBy === field.id && <RadioDot />}</span>
                  <span>{field.label}</span>
                </div>
              </button>
            ))}
            <div className={dividerClass} />
            <button
              type="button"
              role="menuitemradio"
              aria-checked={groupBy === 'none'}
              onClick={() => {
                onChangeGroupBy('none');
                onClose();
              }}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{groupBy === 'none' && <RadioDot />}</span>
                <span>(None)</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Refresh */}
      <button
        type="button"
        role="menuitem"
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          onRefresh();
          onClose();
        }}
        className={`${rowClass} w-full`}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Refresh</span>
        </div>
      </button>

      <div className={dividerClass} />

      {/* Paste / Paste shortcut / Undo */}
      <button
        type="button"
        role="menuitem"
        disabled={!canPaste}
        onMouseEnter={() => setOpenSubmenu(null)}
        className={canPaste ? `${rowClass} w-full` : `${disabledRowClass} w-full`}
        onClick={() => {
          pasteFiles(currentFolderId);
          onClose();
        }}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Paste</span>
        </div>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!canPaste}
        onMouseEnter={() => setOpenSubmenu(null)}
        className={canPaste ? `${rowClass} w-full` : `${disabledRowClass} w-full`}
        onClick={() => {
          pasteShortcuts(currentFolderId);
          onClose();
        }}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Paste shortcut</span>
        </div>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!canUndo}
        onMouseEnter={() => setOpenSubmenu(null)}
        className={canUndo ? `${rowClass} w-full` : `${disabledRowClass} w-full`}
        onClick={() => {
          undo();
          onClose();
        }}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Undo</span>
        </div>
        <span className="text-[11px] pr-1">Ctrl+Z</span>
      </button>

      <div className={dividerClass} />

      {/* New (in folders/drives) or Add a network location (in This PC) */}
      {canCreate ? (
        <div
          role="menuitem"
          aria-haspopup="menu"
          onMouseEnter={() => setOpenSubmenu('new')}
          className={rowClass}
        >
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>New</span>
          </div>
          <RightChevron />

          {openSubmenu === 'new' && (
            <div
              role="menu"
              className={`absolute top-[-4px] ${submenuPosClass} w-[180px] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.55)] py-[3px] z-50`}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCreateFolder();
                  onClose();
                }}
                className={`${rowClass} w-full`}
              >
                <div className="flex items-center">
                  <span className={gutterClass}>
                    <img src="/assets/icons/folder-win10.png" alt="" className="w-4 h-4 object-contain" />
                  </span>
                  <span>Folder</span>
                </div>
              </button>
              <div className={rowClass} onClick={onClose}>
                <div className="flex items-center">
                  <span className={gutterClass} />
                  <span>Shortcut</span>
                </div>
              </div>
              <div className={dividerClass} />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCreateTextFile();
                  onClose();
                }}
                className={`${rowClass} w-full`}
              >
                <div className="flex items-center">
                  <span className={gutterClass}>
                    <img src="/assets/icons/txt-file.svg" alt="" className="w-4 h-4 object-contain" />
                  </span>
                  <span>Text Document</span>
                </div>
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          role="menuitem"
          onMouseEnter={() => setOpenSubmenu(null)}
          onClick={onClose}
          className={`${rowClass} w-full`}
        >
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>Add a network location</span>
          </div>
        </button>
      )}

      <div className={dividerClass} />

      {/* Properties */}
      <button
        type="button"
        role="menuitem"
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          onShowProperties();
          onClose();
        }}
        className={`${rowClass} w-full`}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Properties</span>
        </div>
      </button>
    </div>
  );
}
