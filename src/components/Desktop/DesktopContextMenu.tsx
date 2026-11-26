import { useEffect, useRef, useState } from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';

type SubmenuKey = 'view' | 'sort' | 'new' | null;

const MENU_WIDTH = 224;
const MENU_HEIGHT = 276;
const TASKBAR_HEIGHT = 40;

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

export function DesktopContextMenu() {
  const contextMenuPos = useDesktopStore((state) => state.contextMenuPos);
  const iconSize = useDesktopStore((state) => state.iconSize);
  const showDesktopIcons = useDesktopStore((state) => state.showDesktopIcons);
  const sortBy = useDesktopStore((state) => state.sortBy);
  const setContextMenuPos = useDesktopStore((state) => state.setContextMenuPos);
  const triggerRefresh = useDesktopStore((state) => state.triggerRefresh);
  const setIconSize = useDesktopStore((state) => state.setIconSize);
  const toggleShowDesktopIcons = useDesktopStore((state) => state.toggleShowDesktopIcons);
  const sortAppsByName = useDesktopStore((state) => state.sortAppsByName);

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

  const vw = window.innerWidth;
  const vh = window.innerHeight - TASKBAR_HEIGHT;
  const left = Math.max(4, Math.min(contextMenuPos.x, vw - MENU_WIDTH - 4));
  const top = Math.max(4, Math.min(contextMenuPos.y, vh - MENU_HEIGHT - 4));
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
              onClick={sortAppsByName}
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
            <div className={rowClass} onClick={() => setContextMenuPos(null)}>
              <div className="flex items-center">
                <span className={gutterClass}>
                  <img
                    src="/assets/icons/folder-win10.svg"
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                </span>
                <span>Folder</span>
              </div>
            </div>
            <div className={rowClass} onClick={() => setContextMenuPos(null)}>
              <div className="flex items-center">
                <span className={gutterClass} />
                <span>Shortcut</span>
              </div>
            </div>
            <div className={dividerClass} />
            <div className={rowClass} onClick={() => setContextMenuPos(null)}>
              <div className="flex items-center">
                <span className={gutterClass} />
                <span>Text Document</span>
              </div>
            </div>
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
