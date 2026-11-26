import { useEffect, useMemo, useState } from 'react';
import {
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tooltip,
} from '@fluentui/react-components';
import {
  Win10ActionCenterIcon,
  Win10ChevronUpIcon,
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

  return (
    <div className="flex items-center h-full text-white">
      <Popover positioning="above">
        <PopoverTrigger disableButtonEnhancement>
          <button
            type="button"
            aria-label="Show hidden icons"
            className="flex items-center justify-center w-6 h-full hover:bg-white/12 transition-colors cursor-default"
          >
            <Win10ChevronUpIcon className="text-white/90" />
          </button>
        </PopoverTrigger>
        <PopoverSurface className="!bg-[#1f1f1f]/95 !border !border-[#404040] !rounded-none !p-2 !text-white">
          <div className="text-xs text-white/80 px-1 py-0.5">No hidden tray icons</div>
        </PopoverSurface>
      </Popover>

      <Tooltip content="Network: Internet access" relationship="label" positioning="above">
        <button
          type="button"
          aria-label="Network status"
          className="flex items-center justify-center w-7 h-full hover:bg-white/12 transition-colors cursor-default"
        >
          <Win10WifiIcon className="text-white/95" />
        </button>
      </Tooltip>

      <Tooltip content="Speakers: 85%" relationship="label" positioning="above">
        <button
          type="button"
          aria-label="Volume"
          className="flex items-center justify-center w-7 h-full hover:bg-white/12 transition-colors cursor-default"
        >
          <Win10VolumeIcon className="text-white/95" />
        </button>
      </Tooltip>

      <Popover positioning="above">
        <PopoverTrigger disableButtonEnhancement>
          <button
            type="button"
            aria-label="Date and Time"
            className="flex flex-col items-center justify-center px-2.5 h-full text-[11.5px] leading-[14px] hover:bg-white/12 transition-colors cursor-default tabular-nums"
          >
            <span>{timeString}</span>
            <span>{dateString}</span>
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

      <Tooltip content="No new notifications" relationship="label" positioning="above">
        <button
          type="button"
          aria-label="Action Center"
          className="flex items-center justify-center w-9 h-full hover:bg-white/12 transition-colors cursor-default"
        >
          <Win10ActionCenterIcon className="text-white/95" />
        </button>
      </Tooltip>

      <Tooltip content="Show desktop" relationship="label" positioning="above">
        <button
          type="button"
          aria-label="Show desktop"
          className="w-[5px] h-full border-l border-white/25 hover:bg-white/20 transition-colors cursor-default"
        />
      </Tooltip>
    </div>
  );
}
