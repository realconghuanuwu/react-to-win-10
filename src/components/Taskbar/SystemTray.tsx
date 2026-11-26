import { useEffect, useMemo, useState } from 'react';
import {
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tooltip,
} from '@fluentui/react-components';
import { useDesktopStore } from '../../store/useDesktopStore';
import {
  Win10ActionCenterIcon,
  Win10ChevronUpIcon,
  Win10InkIcon,
  Win10PeopleIcon,
  Win10TouchKeyboardIcon,
  Win10VolumeIcon,
  Win10WifiIcon,
} from './Win10Icons';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function SystemTray() {
  const [now, setNow] = useState(() => new Date());
  const settings = useDesktopStore((state) => state.taskbarSettings);
  const toggleShowDesktop = useDesktopStore((state) => state.toggleShowDesktop);
  const setPeekingDesktop = useDesktopStore((state) => state.setPeekingDesktop);
  const openApp = useDesktopStore((state) => state.openApp);

  const isVertical = settings.location === 'left' || settings.location === 'right';
  const popoverPos =
    settings.location === 'top'
      ? 'below'
      : settings.location === 'left'
        ? 'after'
        : settings.location === 'right'
          ? 'before'
          : 'above';

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const calendarDays = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number; isCurrentMonth: boolean }> = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      cells.push({ day: prevMonthDays - i, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, isCurrentMonth: true });
    }
    while (cells.length < 42) {
      cells.push({
        day: cells.length - (firstDayOfWeek + daysInMonth) + 1,
        isCurrentMonth: false,
      });
    }
    return cells;
  }, [now]);

  const timeString = formatTime(now);
  const dateString = formatDate(now);
  const fullClockString = now.toLocaleTimeString('en-GB', { hour12: false });
  const fullDateTitle = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const monthLabel = now.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const btnSizeClass = isVertical ? 'w-full h-7' : 'h-full';

  return (
    <div
      className={[
        'flex items-center text-white shrink-0',
        isVertical ? 'flex-col w-full gap-0.5' : 'flex-row h-full',
      ].join(' ')}
    >
      {/* People */}
      {settings.showPeople && (
        <Popover positioning={popoverPos}>
          <PopoverTrigger disableButtonEnhancement>
            <button
              type="button"
              aria-label="People"
              title="People"
              className={`flex items-center justify-center ${isVertical ? 'w-full h-8' : 'w-8 h-full'} hover:bg-white/12 transition-colors cursor-default`}
            >
              <Win10PeopleIcon className="text-white/95" />
            </button>
          </PopoverTrigger>
          <PopoverSurface className="!bg-[#1f1f1f]/95 !border !border-[#404040] !rounded-none !p-3 !text-white !w-[240px]">
            <div className="text-[13px] font-medium mb-1">People</div>
            <div className="text-[12px] text-white/70">
              Pin your favorite contacts to the taskbar for quick sharing.
            </div>
          </PopoverSurface>
        </Popover>
      )}

      {/* Windows Ink Workspace */}
      {settings.showInkWorkspace && (
        <Popover positioning={popoverPos}>
          <PopoverTrigger disableButtonEnhancement>
            <button
              type="button"
              aria-label="Windows Ink Workspace"
              title="Windows Ink Workspace"
              className={`flex items-center justify-center ${isVertical ? 'w-full h-8' : 'w-8 h-full'} hover:bg-white/12 transition-colors cursor-default`}
            >
              <Win10InkIcon className="text-white/95" />
            </button>
          </PopoverTrigger>
          <PopoverSurface className="!bg-[#1f1f1f]/95 !border !border-[#404040] !rounded-none !p-2 !text-white !w-[220px]">
            <div className="text-[12px] font-medium px-2 py-1 text-white/80">
              Windows Ink Workspace
            </div>
            <button
              type="button"
              onClick={() => openApp('snip')}
              className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-white/10 cursor-default"
            >
              Fullscreen Snip (Snip &amp; Sketch)
            </button>
            <button
              type="button"
              onClick={() => openApp('paint')}
              className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-white/10 cursor-default"
            >
              Whiteboard / Paint
            </button>
          </PopoverSurface>
        </Popover>
      )}

      {/* Touch Keyboard */}
      {settings.showTouchKeyboard && (
        <Popover positioning={popoverPos}>
          <PopoverTrigger disableButtonEnhancement>
            <button
              type="button"
              aria-label="Touch keyboard"
              title="Touch keyboard"
              className={`flex items-center justify-center ${isVertical ? 'w-full h-8' : 'w-8 h-full'} hover:bg-white/12 transition-colors cursor-default`}
            >
              <Win10TouchKeyboardIcon className="text-white/95" />
            </button>
          </PopoverTrigger>
          <PopoverSurface className="!bg-[#1b1b1b]/95 !border !border-[#454545] !rounded-none !p-3 !text-white !w-[320px]">
            <div className="text-[11px] text-white/70 mb-2">Touch Keyboard</div>
            <div className="grid grid-cols-10 gap-1 text-[11px]">
              {'QWERTYUIOPASDFGHJKL;'.split('').map((k) => (
                <div
                  key={k}
                  className="h-7 flex items-center justify-center bg-[#2f2f2f] border border-white/10"
                >
                  {k}
                </div>
              ))}
            </div>
            <div className="mt-1 h-7 flex items-center justify-center bg-[#2f2f2f] border border-white/10 text-[11px] text-white/75">
              Space
            </div>
          </PopoverSurface>
        </Popover>
      )}

      <Popover positioning={popoverPos}>
        <PopoverTrigger disableButtonEnhancement>
          <button
            type="button"
            aria-label="Show hidden icons"
            className={`flex items-center justify-center ${isVertical ? 'w-full h-6' : 'w-6 h-full'} hover:bg-white/12 transition-colors cursor-default`}
          >
            <Win10ChevronUpIcon className="text-white/90" />
          </button>
        </PopoverTrigger>
        <PopoverSurface className="!bg-[#1f1f1f]/95 !border !border-[#404040] !rounded-none !p-2 !text-white">
          <div className="text-xs text-white/80 px-1 py-0.5">No hidden tray icons</div>
        </PopoverSurface>
      </Popover>

      {settings.systemIcons.network && (
        <Tooltip content="Network: Internet access" relationship="label" positioning={popoverPos}>
          <button
            type="button"
            aria-label="Network status"
            className={`flex items-center justify-center ${isVertical ? btnSizeClass : 'w-7 h-full'} hover:bg-white/12 transition-colors cursor-default`}
          >
            <Win10WifiIcon className="text-white/95" />
          </button>
        </Tooltip>
      )}

      {settings.systemIcons.volume && (
        <Tooltip content="Speakers: 85%" relationship="label" positioning={popoverPos}>
          <button
            type="button"
            aria-label="Volume"
            className={`flex items-center justify-center ${isVertical ? btnSizeClass : 'w-7 h-full'} hover:bg-white/12 transition-colors cursor-default`}
          >
            <Win10VolumeIcon className="text-white/95" />
          </button>
        </Tooltip>
      )}

      {settings.systemIcons.clock && (
        <Popover positioning={popoverPos}>
          <PopoverTrigger disableButtonEnhancement>
            <button
              type="button"
              aria-label="Date and Time"
              className={[
                'flex flex-col items-center justify-center hover:bg-white/12 transition-colors cursor-default tabular-nums',
                isVertical
                  ? 'w-full py-1 text-[10px] leading-[12px]'
                  : settings.smallButtons
                    ? 'px-2 h-full text-[11px] leading-[13px]'
                    : 'px-2.5 h-full text-[11.5px] leading-[14px]',
              ].join(' ')}
            >
              <span>{timeString}</span>
              {(!settings.smallButtons || isVertical) && <span>{dateString}</span>}
            </button>
          </PopoverTrigger>
          <PopoverSurface className="!bg-[#1f1f1f]/95 !backdrop-blur-xl !border !border-[#3d3d3d] !rounded-none !p-4 !w-[310px] !text-white">
            <div className="pb-3 border-b border-white/15">
              <div className="text-4xl font-light tracking-tight tabular-nums">
                {fullClockString}
              </div>
              <div className="text-xs text-[#60cdff] mt-1">{fullDateTitle}</div>
            </div>
            <div className="pt-3">
              <div className="text-sm font-medium mb-2 text-white/90">{monthLabel}</div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/70 mb-1">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1 font-medium">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {calendarDays.map((cell, idx) => {
                  const isToday = cell.isCurrentMonth && cell.day === now.getDate();
                  return (
                    <div
                      key={idx}
                      className={[
                        'py-1.5 tabular-nums',
                        isToday
                          ? 'bg-[#0078d7] text-white font-semibold border border-[#60cdff]'
                          : cell.isCurrentMonth
                            ? 'text-white/90 hover:bg-white/10'
                            : 'text-white/35',
                      ].join(' ')}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            </div>
          </PopoverSurface>
        </Popover>
      )}

      {settings.systemIcons.actionCenter && (
        <Tooltip content="No new notifications" relationship="label" positioning={popoverPos}>
          <button
            type="button"
            aria-label="Action Center"
            className={`flex items-center justify-center ${isVertical ? btnSizeClass : 'w-9 h-full'} hover:bg-white/12 transition-colors cursor-default`}
          >
            <Win10ActionCenterIcon className="text-white/95" />
          </button>
        </Tooltip>
      )}

      <Tooltip content="Show desktop" relationship="label" positioning={popoverPos}>
        <button
          type="button"
          aria-label="Show desktop"
          onClick={toggleShowDesktop}
          onMouseEnter={() => {
            if (settings.usePeek) setPeekingDesktop(true);
          }}
          onMouseLeave={() => setPeekingDesktop(false)}
          className={
            isVertical
              ? 'w-full h-[5px] border-t border-white/25 hover:bg-white/20 transition-colors cursor-default'
              : 'w-[5px] h-full border-l border-white/25 hover:bg-white/20 transition-colors cursor-default'
          }
        />
      </Tooltip>
    </div>
  );
}
