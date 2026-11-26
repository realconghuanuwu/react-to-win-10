import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveDesktopAppIcon, type DesktopAppItem } from '../../data/desktopApps';
import { getTaskbarThickness, useDesktopStore, type TileSize } from '../../store/useDesktopStore';
import { useRecycleBinHasItems } from '../../store/useFileSystemStore';

const RECENT_APP_IDS = ['calculator', 'explorer', 'store'];
const ACCESSORIES_IDS = ['notepad', 'paint', 'snip'];

interface StartItemContextMenu {
  appId: string;
  x: number;
  y: number;
  isTile: boolean;
}

export function StartMenu() {
  const isStartMenuOpen = useDesktopStore((state) => state.isStartMenuOpen);
  const apps = useDesktopStore((state) => state.apps);
  const taskbarSettings = useDesktopStore((state) => state.taskbarSettings);
  const startMenuSettings = useDesktopStore((state) => state.startMenuSettings);
  const userName = useDesktopStore((state) => state.userName);
  const startMenuTileIds = useDesktopStore((state) => state.startMenuTileIds);
  const binHasItems = useRecycleBinHasItems();
  const tileSizes = useDesktopStore((state) => state.tileSizes);
  const openApp = useDesktopStore((state) => state.openApp);
  const closeStartMenu = useDesktopStore((state) => state.closeStartMenu);
  const setSearchOpen = useDesktopStore((state) => state.setSearchOpen);
  const setLockScreenOpen = useDesktopStore((state) => state.setLockScreenOpen);
  const setPowerState = useDesktopStore((state) => state.setPowerState);
  const openSettingsTab = useDesktopStore((state) => state.openSettingsTab);
  const pinToStart = useDesktopStore((state) => state.pinToStart);
  const unpinFromStart = useDesktopStore((state) => state.unpinFromStart);
  const setTileSize = useDesktopStore((state) => state.setTileSize);
  const reorderStartTiles = useDesktopStore((state) => state.reorderStartTiles);
  const togglePinToTaskbar = useDesktopStore((state) => state.togglePinToTaskbar);

  const [railExpanded, setRailExpanded] = useState(false);
  const [accessoriesOpen, setAccessoriesOpen] = useState(false);
  const [powerMenuOpen, setPowerMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [itemMenu, setItemMenu] = useState<StartItemContextMenu | null>(null);
  const [dragTileId, setDragTileId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isStartMenuOpen) {
      setRailExpanded(false);
      setPowerMenuOpen(false);
      setUserMenuOpen(false);
      setItemMenu(null);
      return;
    }

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-start-trigger="true"]')) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        closeStartMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (itemMenu) {
          setItemMenu(null);
        } else {
          closeStartMenu();
        }
        return;
      }

      // Keyboard navigation in All Apps list
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const listButtons = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-start-nav="true"]') ?? [],
        );
        if (listButtons.length === 0) return;
        e.preventDefault();
        const activeIdx = listButtons.findIndex((b) => b === document.activeElement);
        const nextIdx =
          activeIdx < 0
            ? 0
            : (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + listButtons.length) % listButtons.length;
        listButtons[nextIdx]?.focus();
        return;
      }

      // Type-to-search when Start Menu is open
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !(document.activeElement instanceof HTMLInputElement)
      ) {
        closeStartMenu();
        setSearchOpen(true);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStartMenuOpen, itemMenu, closeStartMenu, setSearchOpen]);

  const appById = useMemo(() => {
    const map = new Map<string, DesktopAppItem>();
    apps.forEach((app) =>
      map.set(app.id, { ...app, icon: resolveDesktopAppIcon(app, binHasItems) }),
    );
    return map;
  }, [apps, binHasItems]);

  const recentApps = useMemo(
    () => RECENT_APP_IDS.map((id) => appById.get(id)).filter((a): a is DesktopAppItem => Boolean(a)),
    [appById],
  );

  const alphaGroups = useMemo(() => {
    const sorted = [...apps].sort((a, b) => a.name.localeCompare(b.name));
    const grouped = new Map<string, DesktopAppItem[]>();
    sorted.forEach((app) => {
      const letter = app.name.charAt(0).toUpperCase();
      const list = grouped.get(letter) ?? [];
      list.push(app);
      grouped.set(letter, list);
    });
    return Array.from(grouped.entries());
  }, [apps]);

  const accessoryApps = useMemo(
    () => ACCESSORIES_IDS.map((id) => appById.get(id)).filter((a): a is DesktopAppItem => Boolean(a)),
    [appById],
  );

  const pinnedTileApps = useMemo(
    () =>
      startMenuTileIds
        .map((id) => appById.get(id))
        .filter((a): a is DesktopAppItem => Boolean(a)),
    [startMenuTileIds, appById],
  );

  if (!isStartMenuOpen) return null;

  const railBtnClass =
    'flex items-center h-[44px] w-full text-white/90 hover:bg-white/10 active:bg-white/15 transition-colors cursor-default shrink-0';

  const thickness = getTaskbarThickness(taskbarSettings);
  const startMenuPositionStyle =
    taskbarSettings.location === 'top'
      ? { top: thickness, left: 0 }
      : taskbarSettings.location === 'left'
        ? { top: 0, left: thickness }
        : taskbarSettings.location === 'right'
          ? { top: 0, right: thickness }
          : { bottom: thickness, left: 0 };

  const openContextMenuForApp = (
    appId: string,
    clientX: number,
    clientY: number,
    isTile: boolean,
  ) => {
    const rect = menuRef.current?.getBoundingClientRect();
    const x = rect ? Math.min(rect.width - 175, Math.max(8, clientX - rect.left)) : 120;
    const y = rect ? Math.min(rect.height - 150, Math.max(8, clientY - rect.top)) : 120;
    setItemMenu({ appId, x, y, isTile });
  };

  return (
    <aside
      ref={menuRef}
      role="dialog"
      aria-label="Start Menu"
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => setItemMenu(null)}
      style={startMenuPositionStyle}
      className={`fixed z-40 flex max-w-[calc(100vw-8px)] h-[590px] max-h-[calc(100vh-48px)] bg-[#1f1f1f]/95 backdrop-blur-2xl border border-white/10 shadow-[4px_-4px_24px_rgba(0,0,0,0.6)] text-white select-none ${
        !startMenuSettings.showAppList
          ? 'w-[410px]'
          : startMenuSettings.showMoreTiles
            ? 'w-[700px]'
            : 'w-[630px]'
      }`}
    >
      {/* Left Navigation Rail */}
      <div
        className={[
          'relative flex flex-col justify-between h-full bg-[#191919]/90 border-r border-white/5 transition-all duration-150 shrink-0 z-20',
          railExpanded ? 'w-[190px]' : 'w-[48px]',
        ].join(' ')}
      >
        <button
          type="button"
          aria-label="Expand Start navigation"
          onClick={() => setRailExpanded((v) => !v)}
          className={railBtnClass}
        >
          <span className="w-[48px] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 16 16" width="16" height="16" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="12" x2="14" y2="12" />
            </svg>
          </span>
          {railExpanded && <span className="text-[13px] font-semibold">START</span>}
        </button>

        <div className="relative flex flex-col pb-1">
          <button
            type="button"
            aria-label="User account"
            onClick={() => {
              setUserMenuOpen((v) => !v);
              setPowerMenuOpen(false);
            }}
            className={railBtnClass}
          >
            <span className="w-[48px] flex items-center justify-center shrink-0">
              <span className="w-6 h-6 rounded-full bg-[#3a3a3a] border border-white/25 flex items-center justify-center text-[11px] font-medium">
                {userName.charAt(0).toUpperCase()}
              </span>
            </span>
            {railExpanded && <span className="text-[12.5px] truncate">{userName}</span>}
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              aria-label="User account options"
              className="absolute bottom-[176px] left-1 w-[170px] bg-[#2b2b2b] border border-[#555555] shadow-xl py-1 text-[12px] z-30"
            >
              <button
                type="button"
                onClick={() => openSettingsTab('Background')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
              >
                Change account settings
              </button>
              <button
                type="button"
                onClick={() => setLockScreenOpen(true)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
              >
                Lock
              </button>
              <button
                type="button"
                onClick={() => setLockScreenOpen(true)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
              >
                Sign out
              </button>
            </div>
          )}

          <button
            type="button"
            aria-label="Documents"
            onClick={() => openApp('explorer', 'documents')}
            className={railBtnClass}
          >
            <span className="w-[48px] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M3.5 1.5H9.5L12.5 4.5V14.5H3.5V1.5Z" />
                <polyline points="9.5,1.5 9.5,4.5 12.5,4.5" />
              </svg>
            </span>
            {railExpanded && <span className="text-[12.5px] truncate">Documents</span>}
          </button>

          <button
            type="button"
            aria-label="Pictures"
            onClick={() => openApp('explorer', 'pictures')}
            className={railBtnClass}
          >
            <span className="w-[48px] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <rect x="2" y="2.5" width="12" height="11" rx="0.5" />
                <circle cx="5.5" cy="6" r="1" fill="currentColor" stroke="none" />
                <polyline points="2.5,12 6.5,8 9.5,11 11.5,9 13.5,12" />
              </svg>
            </span>
            {railExpanded && <span className="text-[12.5px] truncate">Pictures</span>}
          </button>

          <button
            type="button"
            aria-label="Settings"
            onClick={() => openApp('settings')}
            className={railBtnClass}
          >
            <span className="w-[48px] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <circle cx="8" cy="8" r="2.3" />
                <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6" strokeLinecap="round" />
              </svg>
            </span>
            {railExpanded && <span className="text-[12.5px] truncate">Settings</span>}
          </button>

          <button
            type="button"
            aria-label="Power"
            onClick={() => {
              setPowerMenuOpen((v) => !v);
              setUserMenuOpen(false);
            }}
            className={railBtnClass}
          >
            <span className="w-[48px] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
                <path d="M5 3.3A5.5 5.5 0 1 0 11 3.3" strokeLinecap="round" />
                <line x1="8" y1="1.8" x2="8" y2="7.5" strokeLinecap="round" />
              </svg>
            </span>
            {railExpanded && <span className="text-[12.5px] truncate">Power</span>}
          </button>

          {powerMenuOpen && (
            <div
              role="menu"
              aria-label="Power options"
              className="absolute bottom-[44px] left-1 w-[150px] bg-[#2b2b2b] border border-[#555555] shadow-xl py-1 text-[12px] z-30"
            >
              <button
                type="button"
                onClick={() => setPowerState('sleeping')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
              >
                Sleep
              </button>
              <button
                type="button"
                onClick={() => setPowerState('shutting-down')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
              >
                Shut down
              </button>
              <button
                type="button"
                onClick={() => setPowerState('restarting')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
              >
                Restart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle Column: Alphabetical App List */}
      {startMenuSettings.showAppList && (
      <div
        aria-label="All apps"
        className="win10-scroll w-[238px] shrink-0 h-full overflow-y-auto px-2 py-2.5 border-r border-white/5"
      >
        {startMenuSettings.showRecentlyAdded && (
        <>
        <div className="px-2 pb-1 text-[12px] text-white/80 font-normal">Recently added</div>
        <div className="space-y-0.5 mb-3">
          {recentApps.map((app) => (
            <button
              key={`recent-${app.id}`}
              data-start-nav="true"
              type="button"
              onClick={() => openApp(app.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openContextMenuForApp(app.id, e.clientX, e.clientY, false);
              }}
              className="flex items-center gap-2.5 w-full h-[34px] px-2 hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none transition-colors cursor-default text-left"
            >
              <img src={app.icon} alt="" className="w-5 h-5 object-contain shrink-0 pointer-events-none" />
              <span className="text-[12.5px] text-white truncate">{app.name}</span>
            </button>
          ))}
        </div>
        </>
        )}

        <div className="space-y-2">
          {alphaGroups.map(([letter, list]) => (
            <div key={letter}>
              <div className="px-2 py-1 text-[12px] text-white/80 font-normal">{letter}</div>
              <div className="space-y-0.5">
                {list.map((app) => (
                  <button
                    key={app.id}
                    data-start-nav="true"
                    type="button"
                    onClick={() => openApp(app.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openContextMenuForApp(app.id, e.clientX, e.clientY, false);
                    }}
                    className="flex items-center gap-2.5 w-full h-[34px] px-2 hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none transition-colors cursor-default text-left"
                  >
                    <img
                      src={app.icon}
                      alt=""
                      className="w-5 h-5 object-contain shrink-0 pointer-events-none"
                    />
                    <span className="text-[12.5px] text-white truncate">{app.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Expandable Windows Accessories Folder */}
          <div>
            <div className="px-2 py-1 text-[12px] text-white/80 font-normal">W</div>
            <button
              type="button"
              onClick={() => setAccessoriesOpen((v) => !v)}
              className="flex items-center justify-between w-full h-[34px] px-2 hover:bg-white/10 transition-colors cursor-default text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/assets/icons/folder-win10.png"
                  alt=""
                  className="w-5 h-5 object-contain shrink-0 pointer-events-none"
                />
                <span className="text-[12.5px] text-white truncate">Windows Accessories</span>
              </div>
              <span className="text-[10px] text-white/75 shrink-0 ml-1">
                {accessoriesOpen ? '▴' : '▾'}
              </span>
            </button>
            {accessoriesOpen && (
              <div className="pl-4 space-y-0.5">
                {accessoryApps.map((app) => (
                  <button
                    key={`acc-${app.id}`}
                    data-start-nav="true"
                    type="button"
                    onClick={() => openApp(app.id)}
                    className="flex items-center gap-2.5 w-full h-[32px] px-2 hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none transition-colors cursor-default text-left"
                  >
                    <img
                      src={app.icon}
                      alt=""
                      className="w-4 h-4 object-contain shrink-0 pointer-events-none"
                    />
                    <span className="text-[12px] text-white/95 truncate">{app.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Right Column: Live Tiles */}
      <div aria-label="Pinned tiles" className="win10-scroll flex-1 h-full overflow-y-auto p-3.5 space-y-4">
        <div className="text-[12.5px] font-normal text-white/90">Pinned Apps</div>
        <div className={`grid gap-1.5 auto-rows-[96px] ${startMenuSettings.showMoreTiles ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {pinnedTileApps.map((app) => {
            const size = tileSizes[app.id] ?? 'medium';
            const spanClass = size === 'wide' ? 'col-span-2' : '';
            const iconClass = size === 'small' ? 'w-6 h-6 mb-1' : 'w-9 h-9 mb-2';
            return (
              <button
                key={`tile-${app.id}`}
                type="button"
                draggable
                onDragStart={() => setDragTileId(app.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragTileId && dragTileId !== app.id) {
                    reorderStartTiles(dragTileId, app.id);
                  }
                  setDragTileId(null);
                }}
                onDragEnd={() => setDragTileId(null)}
                onClick={() => openApp(app.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openContextMenuForApp(app.id, e.clientX, e.clientY, true);
                }}
                className={`relative flex flex-col items-center justify-center h-[96px] bg-[#2c2c2c]/90 hover:bg-[#3a3a3a] hover:outline hover:outline-1 hover:outline-white/40 active:scale-[0.98] transition-all cursor-default p-2 ${spanClass}`}
              >
                <img
                  src={app.icon}
                  alt={app.name}
                  draggable={false}
                  className={`${iconClass} object-contain pointer-events-none`}
                />
                {size !== 'small' && (
                  <span className="absolute bottom-1.5 left-2 right-2 text-left text-[11px] leading-tight text-white/95 truncate">
                    {app.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Menu Item Context Menu */}
      {itemMenu && (() => {
        const isPinnedToStart = startMenuTileIds.includes(itemMenu.appId);
        const isPinnedToTaskbar = taskbarSettings.pinnedAppIds.includes(itemMenu.appId);
        const curSize = tileSizes[itemMenu.appId] ?? 'medium';
        return (
          <div
            role="menu"
            style={{ left: itemMenu.x, top: itemMenu.y }}
            onClick={(e) => e.stopPropagation()}
            className="absolute z-40 w-[176px] bg-[#2b2b2b] border border-[#666] shadow-2xl py-1 text-[12px]"
          >
            <button
              type="button"
              onClick={() => {
                openApp(itemMenu.appId, undefined, undefined, true);
                setItemMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
            >
              Open new window
            </button>
            <button
              type="button"
              onClick={() => {
                if (isPinnedToStart) unpinFromStart(itemMenu.appId);
                else pinToStart(itemMenu.appId);
                setItemMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
            >
              {isPinnedToStart ? 'Unpin from Start' : 'Pin to Start'}
            </button>
            <button
              type="button"
              onClick={() => {
                togglePinToTaskbar(itemMenu.appId);
                setItemMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
            >
              {isPinnedToTaskbar ? 'Unpin from taskbar' : 'Pin to taskbar'}
            </button>
            {itemMenu.isTile && (
              <>
                <div className="h-px bg-white/15 my-1 mx-2" />
                <div className="px-3 py-1 text-[10.5px] text-white/55">Resize tile</div>
                {(['small', 'medium', 'wide'] as TileSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setTileSize(itemMenu.appId, sz);
                      setItemMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1 hover:bg-[#414141] cursor-default capitalize"
                  >
                    <span>{sz}</span>
                    {curSize === sz && <span>✓</span>}
                  </button>
                ))}
              </>
            )}
          </div>
        );
      })()}
    </aside>
  );
}
