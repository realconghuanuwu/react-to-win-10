import { useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tooltip,
} from '@fluentui/react-components';
import { resolveDesktopAppIcon } from '../../data/desktopApps';
import { getTaskbarThickness, useDesktopStore, type AppWindow } from '../../store/useDesktopStore';
import { useRecycleBinHasItems } from '../../store/useFileSystemStore';
import type { TaskbarLocation } from '../../db/types';
import { StartMenu } from './StartMenu';
import { SystemTray } from './SystemTray';
import { TaskbarContextMenu } from './TaskbarContextMenu';
import { TaskbarSearch } from './TaskbarSearch';
import { TaskViewOverlay } from './TaskViewOverlay';
import {
  Win10CortanaIcon,
  Win10StartLogo,
  Win10TaskViewIcon,
} from './Win10Icons';

export function Taskbar() {
  const apps = useDesktopStore((state) => state.apps);
  const allWindows = useDesktopStore((state) => state.windows);
  const activeDesktopId = useDesktopStore((state) => state.activeDesktopId);
  const activeAppId = useDesktopStore((state) => state.activeAppId);
  const isStartMenuOpen = useDesktopStore((state) => state.isStartMenuOpen);
  const isTaskViewOpen = useDesktopStore((state) => state.isTaskViewOpen);
  const taskbarContextMenuPos = useDesktopStore((state) => state.taskbarContextMenuPos);
  const settings = useDesktopStore((state) => state.taskbarSettings);
  const binHasItems = useRecycleBinHasItems();
  const toggleTaskbarApp = useDesktopStore((state) => state.toggleTaskbarApp);
  const toggleStartMenu = useDesktopStore((state) => state.toggleStartMenu);
  const toggleTaskView = useDesktopStore((state) => state.toggleTaskView);
  const openApp = useDesktopStore((state) => state.openApp);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const setTaskbarContextMenuPos = useDesktopStore((state) => state.setTaskbarContextMenuPos);
  const setWinXMenuPos = useDesktopStore((state) => state.setWinXMenuPos);
  const reorderPinnedTaskbarApps = useDesktopStore((state) => state.reorderPinnedTaskbarApps);
  const updateTaskbarSettings = useDesktopStore((state) => state.updateTaskbarSettings);

  const [isHovered, setIsHovered] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [addressText, setAddressText] = useState('This PC');
  const [draggedPinnedId, setDraggedPinnedId] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{
    appId: string;
    anchorRect: DOMRect;
  } | null>(null);
  const hidePreviewTimer = useRef<number | null>(null);

  const windows = useMemo(
    () => allWindows.filter((w) => w.desktopId === activeDesktopId),
    [allWindows, activeDesktopId],
  );

  const windowsByAppId = useMemo(() => {
    const map = new Map<string, AppWindow[]>();
    for (const w of windows) {
      const aid = w.appId ?? w.id;
      const list = map.get(aid) ?? [];
      list.push(w);
      map.set(aid, list);
    }
    return map;
  }, [windows]);

  const pinnedSet = useMemo(() => new Set(settings.pinnedAppIds), [settings.pinnedAppIds]);

  const taskbarApps = useMemo(() => {
    const orderedIds: string[] = [];
    for (const pinnedId of settings.pinnedAppIds) {
      if (!orderedIds.includes(pinnedId)) orderedIds.push(pinnedId);
    }
    for (const win of windows) {
      const aid = win.appId ?? win.id;
      if (!orderedIds.includes(aid)) orderedIds.push(aid);
    }
    return orderedIds
      .map((id) => apps.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
  }, [apps, windows, settings.pinnedAppIds]);

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
    Boolean(hoverPreview) ||
    (searchFocused && settings.searchMode !== 'hidden');

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
    else if (q.includes('chrome') || q.includes('web') || q.includes('http')) openApp('chrome');
    else if (q.includes('set')) openApp('settings');
    else openApp('explorer');
  };

  const handleTaskbarDragLocation = (e: ReactPointerEvent<HTMLElement>) => {
    if (settings.locked || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 40) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let nextLoc: TaskbarLocation = settings.location;
      if (ev.clientY < 80) nextLoc = 'top';
      else if (ev.clientY > vh - 80) nextLoc = 'bottom';
      else if (ev.clientX < 120) nextLoc = 'left';
      else if (ev.clientX > vw - 120) nextLoc = 'right';
      if (nextLoc !== settings.location) {
        updateTaskbarSettings({ location: nextLoc });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const showPreviewForApp = (appId: string, el: HTMLElement) => {
    if (hidePreviewTimer.current) {
      window.clearTimeout(hidePreviewTimer.current);
      hidePreviewTimer.current = null;
    }
    const list = windowsByAppId.get(appId);
    if (!list || list.length === 0) {
      setHoverPreview(null);
      return;
    }
    setHoverPreview({ appId, anchorRect: el.getBoundingClientRect() });
  };

  const scheduleHidePreview = () => {
    if (hidePreviewTimer.current) window.clearTimeout(hidePreviewTimer.current);
    hidePreviewTimer.current = window.setTimeout(() => {
      setHoverPreview(null);
    }, 180);
  };

  const previewWindows = hoverPreview ? windowsByAppId.get(hoverPreview.appId) ?? [] : [];

  return (
    <>
      <StartMenu />
      <TaskViewOverlay />
      <TaskbarContextMenu />

      {/* Taskbar Hover Thumbnail Preview */}
      {hoverPreview && previewWindows.length > 0 && (
        <div
          onMouseEnter={() => {
            if (hidePreviewTimer.current) {
              window.clearTimeout(hidePreviewTimer.current);
              hidePreviewTimer.current = null;
            }
          }}
          onMouseLeave={scheduleHidePreview}
          style={{
            left: isVertical
              ? settings.location === 'left'
                ? thickness + 6
                : undefined
              : Math.max(8, Math.min(hoverPreview.anchorRect.left, window.innerWidth - previewWindows.length * 196 - 16)),
            right:
              isVertical && settings.location === 'right' ? thickness + 6 : undefined,
            bottom:
              settings.location === 'bottom'
                ? thickness + 6
                : isVertical
                  ? Math.max(8, window.innerHeight - hoverPreview.anchorRect.bottom)
                  : undefined,
            top: settings.location === 'top' ? thickness + 6 : undefined,
          }}
          className="fixed z-[75] flex gap-2 bg-[#1e1e1e]/95 backdrop-blur-xl border border-white/20 p-2 shadow-2xl select-none"
        >
          {previewWindows.map((win) => (
            <div
              key={`preview-${win.id}`}
              className="w-[184px] bg-[#2a2a2a] border border-white/15 hover:border-[#66baff] flex flex-col transition-colors"
            >
              <div className="flex items-center justify-between px-2 py-1 bg-[#222] border-b border-white/10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <img src={win.icon} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                  <span className="text-[11px] text-white truncate">{win.title}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Close ${win.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWindow(win.id);
                    if (previewWindows.length <= 1) setHoverPreview(null);
                  }}
                  className="w-5 h-5 flex items-center justify-center text-white/75 hover:bg-[#e81123] hover:text-white cursor-default text-[12px]"
                >
                  ×
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  focusWindow(win.id);
                  setHoverPreview(null);
                }}
                className="h-[92px] flex flex-col items-center justify-center gap-1.5 bg-[#1b1b1b] hover:bg-[#252525] cursor-default p-2"
              >
                <img src={win.icon} alt="" className="w-9 h-9 object-contain" />
                <span className="text-[10.5px] text-white/65">
                  {win.isMinimized ? 'Minimized' : win.isMaximized ? 'Maximized' : `${win.width}×${win.height}`}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      <footer
        aria-label="Windows 10 Taskbar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerDown={handleTaskbarDragLocation}
        onContextMenu={(e) => {
          e.preventDefault();
          setTaskbarContextMenuPos({ x: e.clientX, y: e.clientY, appId: null });
        }}
        style={isVertical ? { width: thickness } : { height: thickness }}
        className={[
          'fixed bg-[#101010]/88 backdrop-blur-xl flex items-center justify-between z-50',
          searchFocused ? 'transition-none' : 'transition-transform duration-150',
          !settings.locked ? 'cursor-move' : '',
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
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setWinXMenuPos({ x: e.clientX, y: e.clientY });
              }}
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
          {settings.searchMode !== 'hidden' ? (
            <TaskbarSearch
              key={settings.searchMode === 'box' && !isVertical ? 'box' : 'icon'}
              iconClass={settings.searchMode === 'box' && !isVertical ? undefined : startBtnSize}
              placement={tooltipPos}
              onFocusChange={setSearchFocused}
            />
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
              title="Taskbar unlocked (drag taskbar or reorder pinned icons)"
              className="h-5 w-[6px] mx-1 border-l border-r border-dotted border-white/45 shrink-0"
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
              const matching = windowsByAppId.get(app.id) ?? [];
              const isOpen = matching.length > 0;
              const isActive = matching.some((w) => w.id === activeAppId && !w.isMinimized);
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
                    draggable={isPinned && !settings.locked}
                    onDragStart={() => {
                      if (isPinned) setDraggedPinnedId(app.id);
                    }}
                    onDragOver={(e) => {
                      if (draggedPinnedId && isPinned) e.preventDefault();
                    }}
                    onDrop={() => {
                      if (draggedPinnedId && isPinned && draggedPinnedId !== app.id) {
                        reorderPinnedTaskbarApps(draggedPinnedId, app.id);
                      }
                      setDraggedPinnedId(null);
                    }}
                    onDragEnd={() => setDraggedPinnedId(null)}
                    onMouseEnter={(e) => showPreviewForApp(app.id, e.currentTarget)}
                    onMouseLeave={scheduleHidePreview}
                    onClick={(e) => {
                      setHoverPreview(null);
                      if (e.shiftKey) {
                        openApp(app.id, undefined, undefined, true);
                      } else {
                        toggleTaskbarApp(app.id);
                      }
                    }}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        openApp(app.id, undefined, undefined, true);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setHoverPreview(null);
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
                      matching.length > 1 ? 'border-r border-white/15' : '',
                    ].join(' ')}
                  >
                    <img
                      src={resolveDesktopAppIcon(app, binHasItems)}
                      alt={app.name}
                      draggable={false}
                      className={`${iconSizeClass} object-contain pointer-events-none shrink-0`}
                    />
                    {showLabels && (
                      <span className="text-[12px] text-white truncate">{app.name}</span>
                    )}
                    {settings.showBadges && matching.length > 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1 right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[#0078d7] text-white text-[9px] font-semibold flex items-center justify-center leading-none"
                      >
                        {matching.length}
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
