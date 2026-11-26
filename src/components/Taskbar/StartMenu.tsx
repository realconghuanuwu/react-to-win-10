import { useEffect, useMemo, useRef, useState } from 'react';
import { START_TILE_GROUPS, type DesktopAppItem } from '../../data/desktopApps';
import { getTaskbarThickness, useDesktopStore } from '../../store/useDesktopStore';

const RECENT_APP_IDS = ['calculator', 'explorer', 'store'];
const ACCESSORIES_IDS = ['notepad', 'paint', 'snip'];

export function StartMenu() {
  const isStartMenuOpen = useDesktopStore((state) => state.isStartMenuOpen);
  const apps = useDesktopStore((state) => state.apps);
  const taskbarSettings = useDesktopStore((state) => state.taskbarSettings);
  const openApp = useDesktopStore((state) => state.openApp);
  const closeStartMenu = useDesktopStore((state) => state.closeStartMenu);
  const minimizeAll = useDesktopStore((state) => state.minimizeAll);

  const [railExpanded, setRailExpanded] = useState(false);
  const [accessoriesOpen, setAccessoriesOpen] = useState(false);
  const [powerMenuOpen, setPowerMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isStartMenuOpen) {
      setRailExpanded(false);
      setPowerMenuOpen(false);
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
        closeStartMenu();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStartMenuOpen, closeStartMenu]);

  const appById = useMemo(() => {
    const map = new Map<string, DesktopAppItem>();
    apps.forEach((app) => map.set(app.id, app));
    return map;
  }, [apps]);

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

  return (
    <aside
      ref={menuRef}
      role="dialog"
      aria-label="Start Menu"
      onContextMenu={(e) => e.preventDefault()}
      style={startMenuPositionStyle}
      className="fixed z-40 flex w-[630px] max-w-[calc(100vw-8px)] h-[590px] max-h-[calc(100vh-48px)] bg-[#1f1f1f]/95 backdrop-blur-2xl border border-white/10 shadow-[4px_-4px_24px_rgba(0,0,0,0.6)] text-white select-none"
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
          <button type="button" aria-label="User account" className={railBtnClass}>
            <span className="w-[48px] flex items-center justify-center shrink-0">
              <span className="w-6 h-6 rounded-full bg-[#3a3a3a] border border-white/25 flex items-center justify-center text-[11px] font-medium">
                U
              </span>
            </span>
            {railExpanded && <span className="text-[12.5px] truncate">User</span>}
          </button>

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
            onClick={() => setPowerMenuOpen((v) => !v)}
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
                onClick={minimizeAll}
                className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
              >
                Sleep
              </button>
              <button
                type="button"
                onClick={minimizeAll}
                className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
              >
                Shut down
              </button>
              <button
                type="button"
                onClick={minimizeAll}
                className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
              >
                Restart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle Column: Alphabetical App List */}
      <div
        aria-label="All apps"
        className="w-[238px] shrink-0 h-full overflow-y-auto px-2 py-2.5 border-r border-white/5"
      >
        <div className="px-2 pb-1 text-[12px] text-white/80 font-normal">Recently added</div>
        <div className="space-y-0.5 mb-3">
          {recentApps.map((app) => (
            <button
              key={`recent-${app.id}`}
              type="button"
              onClick={() => openApp(app.id)}
              className="flex items-center gap-2.5 w-full h-[34px] px-2 hover:bg-white/10 transition-colors cursor-default text-left"
            >
              <img src={app.icon} alt="" className="w-5 h-5 object-contain shrink-0 pointer-events-none" />
              <span className="text-[12.5px] text-white truncate">{app.name}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {alphaGroups.map(([letter, list]) => (
            <div key={letter}>
              <div className="px-2 py-1 text-[12px] text-white/80 font-normal">{letter}</div>
              <div className="space-y-0.5">
                {list.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => openApp(app.id)}
                    className="flex items-center gap-2.5 w-full h-[34px] px-2 hover:bg-white/10 transition-colors cursor-default text-left"
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
                    type="button"
                    onClick={() => openApp(app.id)}
                    className="flex items-center gap-2.5 w-full h-[32px] px-2 hover:bg-white/10 transition-colors cursor-default text-left"
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

      {/* Right Column: Live Tiles */}
      <div aria-label="Pinned tiles" className="flex-1 h-full overflow-y-auto p-3.5 space-y-5">
        {START_TILE_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="text-[12.5px] font-normal text-white/90 mb-2">{group.title}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {group.appIds.map((id) => {
                const app = appById.get(id);
                if (!app) return null;
                return (
                  <button
                    key={`tile-${app.id}`}
                    type="button"
                    onClick={() => openApp(app.id)}
                    className="relative flex flex-col items-center justify-center h-[96px] bg-[#2c2c2c]/90 hover:bg-[#3a3a3a] hover:outline hover:outline-1 hover:outline-white/40 active:scale-[0.98] transition-all cursor-default p-2"
                  >
                    <img
                      src={app.icon}
                      alt={app.name}
                      draggable={false}
                      className="w-9 h-9 object-contain mb-2 pointer-events-none"
                    />
                    <span className="absolute bottom-1.5 left-2 right-2 text-left text-[11px] leading-tight text-white/95 truncate">
                      {app.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
