import { useEffect, useRef, useState } from 'react';
import { findNextFreeSlot, getTaskbarInsets, useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import type { DesktopDisplayItem } from './DesktopIcon';

type SubmenuKey = 'view' | 'sort' | 'new' | null;

const MENU_WIDTH = 224;
const MENU_HEIGHT = 276;

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

function CheckMark() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <polyline points="2,6.5 4.8,9.2 10,3" />
    </svg>
  );
}

function RadioDot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" aria-hidden="true" />;
}

interface DesktopContextMenuProps {
  visibleItems: DesktopDisplayItem[];
  cellStep: { w: number; h: number };
  maxRows: number;
  onOpenItem: (item: DesktopDisplayItem) => void;
}

export function DesktopContextMenu({
  visibleItems,
  cellStep,
  maxRows,
  onOpenItem,
}: DesktopContextMenuProps) {
  const contextMenuPos = useDesktopStore((state) => state.contextMenuPos);
  const iconSize = useDesktopStore((state) => state.iconSize);
  const showDesktopIcons = useDesktopStore((state) => state.showDesktopIcons);
  const sortBy = useDesktopStore((state) => state.sortBy);
  const iconPositions = useDesktopStore((state) => state.iconPositions);
  const taskbarSettings = useDesktopStore((state) => state.taskbarSettings);
  const setContextMenuPos = useDesktopStore((state) => state.setContextMenuPos);
  const triggerRefresh = useDesktopStore((state) => state.triggerRefresh);
  const setIconSize = useDesktopStore((state) => state.setIconSize);
  const toggleShowDesktopIcons = useDesktopStore((state) => state.toggleShowDesktopIcons);
  const sortAppsByName = useDesktopStore((state) => state.sortAppsByName);
  const setIconPosition = useDesktopStore((state) => state.setIconPosition);
  const setRenamingIconId = useDesktopStore((state) => state.setRenamingIconId);
  const setSelectedIconIds = useDesktopStore((state) => state.setSelectedIconIds);

  const nodes = useFileSystemStore((state) => state.nodes);
  const createFolder = useFileSystemStore((state) => state.createFolder);
  const createTextFile = useFileSystemStore((state) => state.createTextFile);
  const deleteNodes = useFileSystemStore((state) => state.deleteNodes);
  const emptyRecycleBin = useFileSystemStore((state) => state.emptyRecycleBin);

  const [openSubmenu, setOpenSubmenu] = useState<SubmenuKey>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpenSubmenu(null);
  }, [contextMenuPos]);

  useEffect(() => {
    if (!contextMenuPos) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenuPos(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenuPos, setContextMenuPos]);

  if (!contextMenuPos) return null;

  const targetItem = contextMenuPos.targetId
    ? visibleItems.find((i) => i.id === contextMenuPos.targetId)
    : null;

  const insets = getTaskbarInsets(taskbarSettings);
  const vw = window.innerWidth - insets.right;
  const vh = window.innerHeight - insets.bottom;
  const effectiveHeight = targetItem ? 180 : MENU_HEIGHT;
  const left = Math.max(insets.left + 4, Math.min(contextMenuPos.x, vw - MENU_WIDTH - 4));
  const top = Math.max(insets.top + 4, Math.min(contextMenuPos.y, vh - effectiveHeight - 4));
  const openSubmenuLeft = left + MENU_WIDTH + 185 > vw;

  const submenuPositionClass = openSubmenuLeft
    ? 'right-full mr-[-2px]'
    : 'left-full ml-[-2px]';

  const rowClass =
    'relative flex items-center justify-between h-[26px] px-2 text-[12px] text-white hover:bg-[#414141] cursor-default';
  const disabledRowClass =
    'flex items-center justify-between h-[26px] px-2 text-[12px] text-[#7a7a7a] cursor-default';
  const dividerClass = 'h-px bg-[#5a5a5a] my-[3px] mx-[8px]';
  const gutterClass = 'w-[24px] shrink-0 flex items-center justify-center mr-1';

  const placeNewDesktopNode = (nodeId: string | null) => {
    if (!nodeId) return;

    const preferredCol = Math.max(0, Math.floor((contextMenuPos.x - 8) / cellStep.w));
    const preferredRow = Math.max(0, Math.min(maxRows - 1, Math.floor((contextMenuPos.y - 8) / cellStep.h)));
    const freeSlot = findNextFreeSlot(
      iconPositions,
      visibleItems.map((i) => i.id),
      maxRows,
      { col: preferredCol, row: preferredRow },
    );

    setIconPosition(nodeId, freeSlot);
    setSelectedIconIds([nodeId]);
    setRenamingIconId(nodeId);
    setContextMenuPos(null);
  };

  const handleCreateDesktopFolder = () => {
    placeNewDesktopNode(createFolder('desktop'));
  };

  const handleCreateDesktopTextFile = () => {
    placeNewDesktopNode(createTextFile('desktop'));
  };

  if (targetItem) {
    const binHasItems = Object.values(nodes).some((n) => n.parentId === 'recycle-bin');
    const isRecycleBin = targetItem.id === 'recycle-bin';
    const isDeletableNode = Boolean((targetItem.isFolder || targetItem.isFile) && !targetItem.isSystem);

    return (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Shortcut context menu"
        onContextMenu={(e) => e.preventDefault()}
        style={{ left, top, width: 205 }}
        className="fixed z-[90] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.5)] py-[3px] select-none"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onOpenItem(targetItem);
            setContextMenuPos(null);
          }}
          className={`${rowClass} w-full font-semibold`}
        >
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>Open</span>
          </div>
        </button>

        {isRecycleBin && (
          <button
            type="button"
            role="menuitem"
            disabled={!binHasItems}
            onClick={() => {
              emptyRecycleBin();
              setContextMenuPos(null);
            }}
            className={binHasItems ? `${rowClass} w-full` : `${disabledRowClass} w-full`}
          >
            <div className="flex items-center">
              <span className={gutterClass} />
              <span>Empty Recycle Bin</span>
            </div>
          </button>
        )}

        <div className={dividerClass} />

        <div role="menuitem" aria-disabled="true" className={disabledRowClass}>
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>Cut</span>
          </div>
        </div>
        <div role="menuitem" aria-disabled="true" className={disabledRowClass}>
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>Copy</span>
          </div>
        </div>

        <div className={dividerClass} />

        <button
          type="button"
          role="menuitem"
          disabled={!isDeletableNode}
          onClick={() => {
            if (!isDeletableNode) return;
            deleteNodes([targetItem.id]);
            setSelectedIconIds([]);
            setContextMenuPos(null);
          }}
          className={isDeletableNode ? `${rowClass} w-full` : `${disabledRowClass} w-full`}
        >
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>Delete</span>
          </div>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setSelectedIconIds([targetItem.id]);
            setRenamingIconId(targetItem.id);
          }}
          className={`${rowClass} w-full`}
        >
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>Rename</span>
          </div>
          <span className="text-[11px] text-white/60 pr-1">F2</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Desktop context menu"
      onContextMenu={(e) => e.preventDefault()}
      style={{ left, top, width: MENU_WIDTH }}
      className="fixed z-[90] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.5)] py-[3px] select-none"
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
            className={`absolute top-[-4px] ${submenuPositionClass} w-[186px] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.5)] py-[3px] z-[95]`}
          >
            <button
              type="button"
              role="menuitemradio"
              aria-checked={iconSize === 'large'}
              onClick={() => setIconSize('large')}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{iconSize === 'large' && <RadioDot />}</span>
                <span>Large icons</span>
              </div>
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={iconSize === 'medium'}
              onClick={() => setIconSize('medium')}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{iconSize === 'medium' && <RadioDot />}</span>
                <span>Medium icons</span>
              </div>
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={iconSize === 'small'}
              onClick={() => setIconSize('small')}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{iconSize === 'small' && <RadioDot />}</span>
                <span>Small icons</span>
              </div>
            </button>
            <div className={dividerClass} />
            <div className={rowClass} onClick={() => setContextMenuPos(null)}>
              <div className="flex items-center">
                <span className={gutterClass}>
                  <CheckMark />
                </span>
                <span>Auto arrange icons</span>
              </div>
            </div>
            <div className={rowClass} onClick={() => setContextMenuPos(null)}>
              <div className="flex items-center">
                <span className={gutterClass}>
                  <CheckMark />
                </span>
                <span>Align icons to grid</span>
              </div>
            </div>
            <div className={dividerClass} />
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={showDesktopIcons}
              onClick={toggleShowDesktopIcons}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{showDesktopIcons && <CheckMark />}</span>
                <span>Show desktop icons</span>
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
            className={`absolute top-[-4px] ${submenuPositionClass} w-[160px] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.5)] py-[3px] z-[95]`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => sortAppsByName(visibleItems.map((i) => i.id))}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{sortBy === 'name' && <RadioDot />}</span>
                <span>Name</span>
              </div>
            </button>
            <div className={rowClass} onClick={() => setContextMenuPos(null)}>
              <div className="flex items-center">
                <span className={gutterClass} />
                <span>Size</span>
              </div>
            </div>
            <div className={rowClass} onClick={() => setContextMenuPos(null)}>
              <div className="flex items-center">
                <span className={gutterClass} />
                <span>Item type</span>
              </div>
            </div>
            <div className={rowClass} onClick={() => setContextMenuPos(null)}>
              <div className="flex items-center">
                <span className={gutterClass} />
                <span>Date modified</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Refresh */}
      <button
        type="button"
        role="menuitem"
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={triggerRefresh}
        className={`${rowClass} w-full`}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Refresh</span>
        </div>
      </button>

      <div className={dividerClass} />

      {/* Paste & Paste shortcut */}
      <div
        role="menuitem"
        aria-disabled="true"
        onMouseEnter={() => setOpenSubmenu(null)}
        className={disabledRowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Paste</span>
        </div>
      </div>

      <div
        role="menuitem"
        aria-disabled="true"
        onMouseEnter={() => setOpenSubmenu(null)}
        className={disabledRowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Paste shortcut</span>
        </div>
      </div>

      <div className={dividerClass} />

      {/* New */}
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
            className={`absolute top-[-4px] ${submenuPositionClass} w-[180px] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.5)] py-[3px] z-[95]`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleCreateDesktopFolder}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>
                  <img
                    src="/assets/icons/folder-win10.png"
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                </span>
                <span>Folder</span>
              </div>
            </button>
            <div className={rowClass} onClick={() => setContextMenuPos(null)}>
              <div className="flex items-center">
                <span className={gutterClass} />
                <span>Shortcut</span>
              </div>
            </div>
            <div className={dividerClass} />
            <button
              type="button"
              role="menuitem"
              onClick={handleCreateDesktopTextFile}
              className={`${rowClass} w-full`}
            >
              <div className="flex items-center">
                <span className={gutterClass}>
                  <img
                    src="/assets/icons/txt-file.svg"
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                </span>
                <span>Text Document</span>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className={dividerClass} />

      {/* Display settings */}
      <button
        type="button"
        role="menuitem"
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => setContextMenuPos(null)}
        className={`${rowClass} w-full`}
      >
        <div className="flex items-center">
          <span className={gutterClass}>
            <img
              src="/assets/icons/display-settings.svg"
              alt=""
              className="w-4 h-4 object-contain"
            />
          </span>
          <span>Display settings</span>
        </div>
      </button>

      {/* Personalize */}
      <button
        type="button"
        role="menuitem"
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => setContextMenuPos(null)}
        className={`${rowClass} w-full`}
      >
        <div className="flex items-center">
          <span className={gutterClass}>
            <img
              src="/assets/icons/personalize.svg"
              alt=""
              className="w-4 h-4 object-contain"
            />
          </span>
          <span>Personalize</span>
        </div>
      </button>
    </div>
  );
}
