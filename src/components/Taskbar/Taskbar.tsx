import { useMemo, useState, type FormEvent } from 'react';
import {
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tooltip,
} from '@fluentui/react-components';
import { getTaskbarThickness, useDesktopStore } from '../../store/useDesktopStore';
import { StartMenu } from './StartMenu';
import { SystemTray } from './SystemTray';
import { TaskbarContextMenu } from './TaskbarContextMenu';
import { TaskViewOverlay } from './TaskViewOverlay';
import {
  Win10CortanaIcon,
  Win10SearchIcon,
  Win10StartLogo,
  Win10TaskViewIcon,
} from './Win10Icons';

export function Taskbar() {
  const apps = useDesktopStore((state) => state.apps);
  const windows = useDesktopStore((state) => state.windows);
  const activeAppId = useDesktopStore((state) => state.activeAppId);
  const isStartMenuOpen = useDesktopStore((state) => state.isStartMenuOpen);
  const isTaskViewOpen = useDesktopStore((state) => state.isTaskViewOpen);
  const taskbarContextMenuPos = useDesktopStore((state) => state.taskbarContextMenuPos);
  const settings = useDesktopStore((state) => state.taskbarSettings);
  const toggleTaskbarApp = useDesktopStore((state) => state.toggleTaskbarApp);
  const toggleStartMenu = useDesktopStore((state) => state.toggleStartMenu);
  const toggleTaskView = useDesktopStore((state) => state.toggleTaskView);
  const openApp = useDesktopStore((state) => state.openApp);
  const setTaskbarContextMenuPos = useDesktopStore((state) => state.setTaskbarContextMenuPos);

  const [isHovered, setIsHovered] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [addressText, setAddressText] = useState('This PC');

  const openIds = useMemo(() => new Set(windows.map((w) => w.id)), [windows]);
  const pinnedSet = useMemo(() => new Set(settings.pinnedAppIds), [settings.pinnedAppIds]);

  const taskbarApps = useMemo(() => {
    const orderedIds: string[] = [];
    for (const pinnedId of settings.pinnedAppIds) {
      if (!orderedIds.includes(pinnedId)) orderedIds.push(pinnedId);
    }
    for (const win of windows) {
      if (!orderedIds.includes(win.id)) orderedIds.push(win.id);
    }
    return orderedIds
      .map((id) => apps.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
  }, [apps, windows, settings.pinnedAppIds]);

  const searchMatches = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    return apps.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 6);
  }, [apps, searchText]);

  const thickness = getTaskbarThickness(settings);
  const isVertical = settings.location === 'left' || settings.location === 'right';
  const tooltipPos =
    settings.location === 'top'
      ? 'below'
      : settings.location === 'left'
        ? 'after'
        : settings.location === 'right'
          ? 'before'
          : 'above';

  const keepVisible =
    !settings.autoHide ||
    isHovered ||
    isStartMenuOpen ||
    isTaskViewOpen ||
    Boolean(taskbarContextMenuPos) ||
    searchFocused;

  const positionClass =
    settings.location === 'top'
      ? 'top-0 left-0 right-0 flex-row border-b border-white/10'
      : settings.location === 'left'
        ? 'top-0 bottom-0 left-0 flex-col border-r border-white/10'
        : settings.location === 'right'
          ? 'top-0 bottom-0 right-0 flex-col border-l border-white/10'
          : 'bottom-0 left-0 right-0 flex-row border-t border-white/5';

  const autoHideTransform = keepVisible
    ? 'translate-x-0 translate-y-0'
    : settings.location === 'bottom'
      ? 'translate-y-[calc(100%-3px)]'
      : settings.location === 'top'
        ? '-translate-y-[calc(100%-3px)]'
        : settings.location === 'left'
          ? '-translate-x-[calc(100%-3px)]'
          : 'translate-x-[calc(100%-3px)]';

  const showLabels = !isVertical && settings.combineButtons !== 'always';
  const startBtnSize = isVertical
    ? settings.smallButtons
      ? 'w-full h-9'
      : 'w-full h-11'
    : settings.smallButtons
      ? 'w-9 h-full'
      : 'w-12 h-full';

  const iconSizeClass = settings.smallButtons ? 'w-4 h-4' : 'w-6 h-6';

  const handleAddressSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = addressText.trim().toLowerCase();
    if (!q || q.includes('pc')) openApp('this-pc');
    else if (q.includes('recycle') || q.includes('bin')) openApp('recycle-bin');
    else if (q.includes('doc')) openApp('explorer', 'documents');
    else if (q.includes('down')) openApp('explorer', 'downloads');
    else if (q.includes('pic')) openApp('explorer', 'pictures');
    else if (q.includes('calc')) openApp('calculator');
    else if (q.includes('set')) openApp('settings');
    else openApp('explorer');
  };

  return (
    <>
      <StartMenu />
      <TaskViewOverlay />
      <TaskbarContextMenu />

      <footer
        aria-label="Windows 10 Taskbar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          setTaskbarContextMenuPos({ x: e.clientX, y: e.clientY, appId: null });
        }}
        style={isVertical ? { width: thickness } : { height: thickness }}
        className={[
          'fixed bg-[#101010]/88 backdrop-blur-xl flex items-center justify-between z-50 transition-transform duration-150',
          positionClass,
          autoHideTransform,
        ].join(' ')}
      >
        <div
          className={[
            'flex items-center min-w-0 min-h-0',
            isVertical ? 'flex-col w-full flex-1 overflow-y-auto' : 'flex-row h-full flex-1',
          ].join(' ')}
        >
          {/* Start Button */}
          <Tooltip content="Start" relationship="label" positioning={tooltipPos}>
            <button
              type="button"
              data-start-trigger="true"
              aria-label="Start"
              aria-expanded={isStartMenuOpen}
              onClick={toggleStartMenu}
              className={[
                'flex items-center justify-center shrink-0 hover:bg-white/10 hover:text-[#429ce3] active:bg-white/15 transition-colors cursor-default',
                startBtnSize,
                isStartMenuOpen ? 'bg-white/14 text-[#429ce3]' : 'text-white',
              ].join(' ')}
            >
              <Win10StartLogo className={settings.smallButtons ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
          </Tooltip>

          {/* Search: Box or Icon */}
          {settings.searchMode === 'box' && !isVertical ? (
            <div className="relative h-full flex items-center py-[2px] pr-1">
              <div className="flex items-center h-full w-[240px] bg-[#2a2a2a] hover:bg-[#333333] focus-within:bg-white focus-within:text-black border border-white/15 focus-within:border-[#0078d7] px-2.5 gap-2 transition-colors">
                <Win10SearchIcon className="w-4 h-4 shrink-0 opacity-80" />
                <input
                  type="text"
                  value={searchText}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchMatches.length > 0) {
                      openApp(searchMatches[0].id);
                      setSearchText('');
                      setSearchFocused(false);
                    }
                  }}
                  placeholder="Type here to search"
                  aria-label="Type here to search"
                  className="w-full bg-transparent text-[12px] outline-none placeholder:text-white/65 focus:placeholder:text-black/50"
                />
              </div>

              {searchFocused && searchMatches.length > 0 && (
                <div
                  className={[
                    'absolute left-0 w-[280px] bg-[#1f1f1f] border border-[#555555] shadow-xl py-1 z-[70]',
                    settings.location === 'top' ? 'top-full mt-1' : 'bottom-full mb-1',
                  ].join(' ')}
                >
                  {searchMatches.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        openApp(app.id);
                        setSearchText('');
                        setSearchFocused(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-white hover:bg-white/10 cursor-default text-left"
                    >
                      <img src={app.icon} alt="" className="w-4 h-4 object-contain" />
                      <span>{app.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : settings.searchMode !== 'hidden' ? (
            <Tooltip content="Type here to search" relationship="label" positioning={tooltipPos}>
              <button
                type="button"
                data-start-trigger="true"
                aria-label="Search"
                onClick={toggleStartMenu}
                className={`flex items-center justify-center shrink-0 text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-default ${startBtnSize}`}
              >
                <Win10SearchIcon />
              </button>
            </Tooltip>
          ) : null}

          {/* Cortana Button */}
          {settings.showCortana && (
            <Popover positioning={tooltipPos}>
              <PopoverTrigger disableButtonEnhancement>
                <button
                  type="button"
                  aria-label="Talk to Cortana"
                  title="Talk to Cortana"
                  className={`flex items-center justify-center shrink-0 text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-default ${startBtnSize}`}
                >
                  <Win10CortanaIcon />
                </button>
              </PopoverTrigger>
              <PopoverSurface className="!bg-[#1f1f1f]/95 !border !border-[#404040] !rounded-none !p-4 !text-white !w-[260px]">
                <div className="flex items-center gap-3 mb-2">
                  <Win10CortanaIcon className="w-6 h-6" />
                  <span className="text-[14px] font-medium">Cortana</span>
                </div>
                <p className="text-[12px] text-white/75">
                  Hi! Ask me to open an app or explore your Windows 10 desktop.
                </p>
              </PopoverSurface>
            </Popover>
          )}

          {/* Task View Button */}
          {settings.showTaskView && (
            <Tooltip content="Task View" relationship="label" positioning={tooltipPos}>
              <button
                type="button"
                aria-label="Task View"
                aria-pressed={isTaskViewOpen}
                onClick={toggleTaskView}
                className={[
                  'flex items-center justify-center shrink-0 hover:bg-white/10 active:bg-white/15 transition-colors cursor-default',
                  startBtnSize,
                  isTaskViewOpen ? 'bg-white/15 text-[#60cdff]' : 'text-white',
                ].join(' ')}
              >
                <Win10TaskViewIcon />
              </button>
            </Tooltip>
          )}

          {/* Unlocked grip indicator */}
          {!settings.locked && !isVertical && (
            <div
              title="Taskbar unlocked"
              className="h-5 w-[6px] mx-1 border-l border-r border-dotted border-white/35 shrink-0"
            />
          )}

          {/* Pinned & Running Applications */}
          <nav
            aria-label="Pinned applications"
            className={[
              'flex items-center',
              isVertical ? 'flex-col w-full' : 'flex-row h-full overflow-x-auto',
            ].join(' ')}
          >
            {taskbarApps.map((app) => {
              const isOpen = openIds.has(app.id);
              const isActive = activeAppId === app.id;
              const isPinned = pinnedSet.has(app.id);

              return (
                <Tooltip
                  key={app.id}
                  content={isPinned ? app.name : `${app.name} (running)`}
                  relationship="label"
                  positioning={tooltipPos}
                >
                  <button
                    type="button"
                    aria-label={app.name}
                    onClick={() => toggleTaskbarApp(app.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTaskbarContextMenuPos({
                        x: e.clientX,
                        y: e.clientY,
                        appId: app.id,
                      });
                    }}
                    className={[
                      'relative flex items-center shrink-0 transition-colors cursor-default',
                      showLabels
                        ? 'justify-start px-3 gap-2 w-[152px] h-full'
                        : `justify-center ${startBtnSize}`,
                      isActive
                        ? 'bg-white/16 hover:bg-white/22'
                        : 'hover:bg-white/10 active:bg-white/15',
                    ].join(' ')}
                  >
                    <img
                      src={app.icon}
                      alt={app.name}
                      draggable={false}
                      className={`${iconSizeClass} object-contain pointer-events-none shrink-0`}
                    />
                    {showLabels && (
                      <span className="text-[12px] text-white truncate">{app.name}</span>
                    )}
                    {settings.showBadges && isOpen && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1 right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[#0078d7] text-white text-[9px] font-semibold flex items-center justify-center leading-none"
                      >
                        1
                      </span>
                    )}
                    {isOpen && (
                      <span
                        className={[
                          'absolute bg-[#76b9ed] transition-all duration-150',
                          isVertical
                            ? settings.location === 'left'
                              ? `left-0 w-[2px] ${isActive ? 'h-full' : 'h-7'}`
                              : `right-0 w-[2px] ${isActive ? 'h-full' : 'h-7'}`
                            : settings.location === 'top'
                              ? `top-0 h-[2px] ${isActive ? 'w-full' : 'w-9'}`
                              : `bottom-0 h-[2px] ${isActive ? 'w-full' : 'w-9'}`,
                        ].join(' ')}
                      />
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </nav>
        </div>

        {/* Optional Toolbars (Address / Links / Desktop) */}
        {!isVertical &&
          (settings.toolbars.address || settings.toolbars.links || settings.toolbars.desktop) && (
            <div className="flex items-center h-full gap-2 px-2 border-l border-white/15 text-[11.5px] text-white/90 shrink-0">
              {settings.toolbars.address && (
                <form onSubmit={handleAddressSubmit} className="flex items-center gap-1">
                  <span className="text-white/60">Address</span>
                  <input
                    type="text"
                    value={addressText}
                    onChange={(e) => setAddressText(e.target.value)}
                    aria-label="Address toolbar"
                    className="w-[120px] h-[22px] px-1.5 bg-[#1e1e1e] border border-white/25 text-white text-[11px] outline-none focus:border-[#0078d7]"
                  />
                </form>
              )}

              {settings.toolbars.links && (
                <div className="flex items-center gap-1">
                  <span className="text-white/60">Links</span>
                  <button
                    type="button"
                    onClick={() => openApp('this-pc')}
                    className="px-1.5 py-0.5 hover:bg-white/12 cursor-default"
                  >
                    This PC
                  </button>
                  <button
                    type="button"
                    onClick={() => openApp('explorer', 'documents')}
                    className="px-1.5 py-0.5 hover:bg-white/12 cursor-default"
                  >
                    Docs
                  </button>
                </div>
              )}

              {settings.toolbars.desktop && (
                <Popover positioning={tooltipPos}>
                  <PopoverTrigger disableButtonEnhancement>
                    <button
                      type="button"
                      className="px-1.5 py-0.5 hover:bg-white/12 cursor-default"
                    >
                      Desktop &raquo;
                    </button>
                  </PopoverTrigger>
                  <PopoverSurface className="!bg-[#2b2b2b] !border !border-[#767676] !rounded-none !p-1 !text-white !w-[180px]">
                    {apps
                      .filter((a) => a.showOnDesktop !== false)
                      .map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => openApp(a.id)}
                          className="w-full flex items-center gap-2 px-2 py-1 text-[12px] hover:bg-[#414141] cursor-default text-left"
                        >
                          <img src={a.icon} alt="" className="w-4 h-4 object-contain" />
                          <span>{a.name}</span>
                        </button>
                      ))}
                  </PopoverSurface>
                </Popover>
              )}
            </div>
          )}

        <SystemTray />
      </footer>
    </>
  );
}
