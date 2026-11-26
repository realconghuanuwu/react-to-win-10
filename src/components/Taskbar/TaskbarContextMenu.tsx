import { useEffect, useRef, useState } from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';

type SubmenuKey = 'toolbars' | 'search' | null;

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
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <polyline points="2,6.5 4.8,9.2 10,3" />
    </svg>
  );
}

function RadioDot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" aria-hidden="true" />;
}

function SettingsGearIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.7V3.1M8 12.9V14.3M1.7 8H3.1M12.9 8H14.3M3.55 3.55L4.55 4.55M11.45 11.45L12.45 12.45M12.45 3.55L11.45 4.55M4.55 11.45L3.55 12.45" />
    </svg>
  );
}

export function TaskbarContextMenu() {
  const pos = useDesktopStore((state) => state.taskbarContextMenuPos);
  const settings = useDesktopStore((state) => state.taskbarSettings);
  const apps = useDesktopStore((state) => state.apps);
  const windows = useDesktopStore((state) => state.windows);
  const setTaskbarContextMenuPos = useDesktopStore((state) => state.setTaskbarContextMenuPos);
  const updateTaskbarSettings = useDesktopStore((state) => state.updateTaskbarSettings);
  const togglePinToTaskbar = useDesktopStore((state) => state.togglePinToTaskbar);
  const openApp = useDesktopStore((state) => state.openApp);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const cascadeWindows = useDesktopStore((state) => state.cascadeWindows);
  const stackWindows = useDesktopStore((state) => state.stackWindows);
  const sideBySideWindows = useDesktopStore((state) => state.sideBySideWindows);
  const toggleShowDesktop = useDesktopStore((state) => state.toggleShowDesktop);

  const [openSubmenu, setOpenSubmenu] = useState<SubmenuKey>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpenSubmenu(null);
  }, [pos]);

  useEffect(() => {
    if (!pos) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTaskbarContextMenuPos(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTaskbarContextMenuPos(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pos, setTaskbarContextMenuPos]);

  if (!pos) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;

  const rowClass =
    'relative flex items-center justify-between h-[28px] px-2 text-[12px] text-white hover:bg-[#414141] cursor-default w-full text-left';
  const disabledRowClass =
    'flex items-center justify-between h-[28px] px-2 text-[12px] text-[#7a7a7a] cursor-default w-full text-left';
  const dividerClass = 'h-px bg-[#5a5a5a] my-[4px] mx-[10px]';
  const gutterClass = 'w-[24px] shrink-0 flex items-center justify-center mr-1';

  // Jump-list style menu when right-clicking a specific taskbar app button
  if (pos.appId) {
    const app = apps.find((a) => a.id === pos.appId);
    if (!app) return null;
    const isPinned = settings.pinnedAppIds.includes(app.id);
    const isOpen = windows.some((w) => w.id === app.id);
    const menuW = 216;
    const menuH = isOpen ? 104 : 74;
    const left = Math.max(4, Math.min(pos.x, vw - menuW - 4));
    const top = Math.max(4, Math.min(pos.y - menuH, vh - menuH - 4));

    return (
      <div
        ref={menuRef}
        role="menu"
        aria-label={`${app.name} taskbar menu`}
        onContextMenu={(e) => e.preventDefault()}
        style={{ left, top, width: menuW }}
        className="fixed z-[95] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.55)] py-[4px] select-none"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            openApp(app.id);
            setTaskbarContextMenuPos(null);
          }}
          className={rowClass}
        >
          <div className="flex items-center min-w-0">
            <span className={gutterClass}>
              <img src={app.icon} alt="" className="w-4 h-4 object-contain" />
            </span>
            <span className="truncate font-semibold">{app.name}</span>
          </div>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => togglePinToTaskbar(app.id)}
          className={rowClass}
        >
          <div className="flex items-center">
            <span className={gutterClass} />
            <span>{isPinned ? 'Unpin from taskbar' : 'Pin to taskbar'}</span>
          </div>
        </button>

        {isOpen && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeWindow(app.id);
              setTaskbarContextMenuPos(null);
            }}
            className={rowClass}
          >
            <div className="flex items-center">
              <span className={gutterClass} />
              <span>Close window</span>
            </div>
          </button>
        )}
      </div>
    );
  }

  const menuWidth = 276;
  const menuHeight = 460;
  const left = Math.max(4, Math.min(pos.x, vw - menuWidth - 4));
  const top = Math.max(4, Math.min(pos.y - menuHeight, vh - menuHeight - 4));
  const openSubmenuLeft = left + menuWidth + 185 > vw;
  const submenuPositionClass = openSubmenuLeft ? 'right-full mr-[-2px]' : 'left-full ml-[-2px]';

  const hasVisibleWindows = windows.some((w) => !w.isMinimized);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Taskbar context menu"
      onContextMenu={(e) => e.preventDefault()}
      style={{ left, top, width: menuWidth }}
      className="fixed z-[95] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_14px_rgba(0,0,0,0.58)] py-[4px] select-none"
    >
      {/* Toolbars */}
      <div
        role="menuitem"
        aria-haspopup="menu"
        onMouseEnter={() => setOpenSubmenu('toolbars')}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Toolbars</span>
        </div>
        <RightChevron />

        {openSubmenu === 'toolbars' && (
          <div
            role="menu"
            className={`absolute top-[-4px] ${submenuPositionClass} w-[180px] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.55)] py-[4px] z-[98]`}
          >
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={settings.toolbars.address}
              onClick={() =>
                updateTaskbarSettings((prev) => ({
                  ...prev,
                  toolbars: { ...prev.toolbars, address: !prev.toolbars.address },
                }))
              }
              className={rowClass}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{settings.toolbars.address && <CheckMark />}</span>
                <span>Address</span>
              </div>
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={settings.toolbars.links}
              onClick={() =>
                updateTaskbarSettings((prev) => ({
                  ...prev,
                  toolbars: { ...prev.toolbars, links: !prev.toolbars.links },
                }))
              }
              className={rowClass}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{settings.toolbars.links && <CheckMark />}</span>
                <span>Links</span>
              </div>
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={settings.toolbars.desktop}
              onClick={() =>
                updateTaskbarSettings((prev) => ({
                  ...prev,
                  toolbars: { ...prev.toolbars, desktop: !prev.toolbars.desktop },
                }))
              }
              className={rowClass}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{settings.toolbars.desktop && <CheckMark />}</span>
                <span>Desktop</span>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className={dividerClass} />

      {/* Search */}
      <div
        role="menuitem"
        aria-haspopup="menu"
        onMouseEnter={() => setOpenSubmenu('search')}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Search</span>
        </div>
        <RightChevron />

        {openSubmenu === 'search' && (
          <div
            role="menu"
            className={`absolute top-[-4px] ${submenuPositionClass} w-[184px] bg-[#2b2b2b] border border-[#767676] shadow-[2px_4px_12px_rgba(0,0,0,0.55)] py-[4px] z-[98]`}
          >
            <button
              type="button"
              role="menuitemradio"
              aria-checked={settings.searchMode === 'hidden'}
              onClick={() => {
                updateTaskbarSettings({ searchMode: 'hidden' });
                setTaskbarContextMenuPos(null);
              }}
              className={rowClass}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{settings.searchMode === 'hidden' && <RadioDot />}</span>
                <span>Hidden</span>
              </div>
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={settings.searchMode === 'icon'}
              onClick={() => {
                updateTaskbarSettings({ searchMode: 'icon' });
                setTaskbarContextMenuPos(null);
              }}
              className={rowClass}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{settings.searchMode === 'icon' && <RadioDot />}</span>
                <span>Show search icon</span>
              </div>
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={settings.searchMode === 'box'}
              onClick={() => {
                updateTaskbarSettings({ searchMode: 'box' });
                setTaskbarContextMenuPos(null);
              }}
              className={rowClass}
            >
              <div className="flex items-center">
                <span className={gutterClass}>{settings.searchMode === 'box' && <RadioDot />}</span>
                <span>Show search box</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Cortana, Task View, People, Windows Ink, Touch keyboard */}
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={settings.showCortana}
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          updateTaskbarSettings((prev) => ({ ...prev, showCortana: !prev.showCortana }));
          setTaskbarContextMenuPos(null);
        }}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass}>{settings.showCortana && <CheckMark />}</span>
          <span>Show Cortana button</span>
        </div>
      </button>

      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={settings.showTaskView}
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          updateTaskbarSettings((prev) => ({ ...prev, showTaskView: !prev.showTaskView }));
          setTaskbarContextMenuPos(null);
        }}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass}>{settings.showTaskView && <CheckMark />}</span>
          <span>Show Task View button</span>
        </div>
      </button>

      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={settings.showPeople}
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          updateTaskbarSettings((prev) => ({ ...prev, showPeople: !prev.showPeople }));
          setTaskbarContextMenuPos(null);
        }}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass}>{settings.showPeople && <CheckMark />}</span>
          <span>Show People on the taskbar</span>
        </div>
      </button>

      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={settings.showInkWorkspace}
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          updateTaskbarSettings((prev) => ({
            ...prev,
            showInkWorkspace: !prev.showInkWorkspace,
          }));
          setTaskbarContextMenuPos(null);
        }}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass}>{settings.showInkWorkspace && <CheckMark />}</span>
          <span>Show Windows Ink Workspace button</span>
        </div>
      </button>

      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={settings.showTouchKeyboard}
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          updateTaskbarSettings((prev) => ({
            ...prev,
            showTouchKeyboard: !prev.showTouchKeyboard,
          }));
          setTaskbarContextMenuPos(null);
        }}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass}>{settings.showTouchKeyboard && <CheckMark />}</span>
          <span>Show touch keyboard button</span>
        </div>
      </button>

      <div className={dividerClass} />

      {/* Window arrangement */}
      <button
        type="button"
        role="menuitem"
        disabled={!hasVisibleWindows}
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={cascadeWindows}
        className={hasVisibleWindows ? rowClass : disabledRowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Cascade windows</span>
        </div>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!hasVisibleWindows}
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={stackWindows}
        className={hasVisibleWindows ? rowClass : disabledRowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Show windows stacked</span>
        </div>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!hasVisibleWindows}
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={sideBySideWindows}
        className={hasVisibleWindows ? rowClass : disabledRowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Show windows side by side</span>
        </div>
      </button>

      <button
        type="button"
        role="menuitem"
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={toggleShowDesktop}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>{hasVisibleWindows || windows.length === 0 ? 'Show the desktop' : 'Show open windows'}</span>
        </div>
      </button>

      <div className={dividerClass} />

      {/* Task Manager */}
      <button
        type="button"
        role="menuitem"
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          openApp('task-manager');
          setTaskbarContextMenuPos(null);
        }}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass} />
          <span>Task Manager</span>
        </div>
      </button>

      <div className={dividerClass} />

      {/* Lock all taskbars */}
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={settings.locked}
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          updateTaskbarSettings((prev) => ({ ...prev, locked: !prev.locked }));
          setTaskbarContextMenuPos(null);
        }}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass}>{settings.locked && <CheckMark />}</span>
          <span>Lock all taskbars</span>
        </div>
      </button>

      {/* Taskbar settings */}
      <button
        type="button"
        role="menuitem"
        onMouseEnter={() => setOpenSubmenu(null)}
        onClick={() => {
          openApp('settings');
          setTaskbarContextMenuPos(null);
        }}
        className={rowClass}
      >
        <div className="flex items-center">
          <span className={gutterClass}>
            <SettingsGearIcon />
          </span>
          <span>Taskbar settings</span>
        </div>
      </button>
    </div>
  );
}
