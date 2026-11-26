import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tooltip,
} from '@fluentui/react-components';
import { useDesktopStore } from '../../store/useDesktopStore';
import { ActionCenter } from './ActionCenter';
import {
  Win10ChevronUpIcon,
  Win10InkIcon,
  Win10PeopleIcon,
  Win10TouchKeyboardIcon,
  Win10VolumeIcon,
  Win10WifiIcon,
} from './Win10Icons';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WIFI_NETWORKS = [
  { name: 'Wi-Fi (Home_5G)', security: 'Secured', signal: 'Excellent' },
  { name: 'Office_Guest', security: 'Secured', signal: 'Good' },
  { name: 'Phone Hotspot', security: 'Secured', signal: 'Fair' },
];

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

function dateKeyOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function insertTextIntoFocusedElement(charOrAction: string) {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return;
  const start = active.selectionStart ?? active.value.length;
  const end = active.selectionEnd ?? active.value.length;
  let nextValue = active.value;
  let nextCursor = start;

  if (charOrAction === 'BACKSPACE') {
    if (start !== end) {
      nextValue = active.value.slice(0, start) + active.value.slice(end);
      nextCursor = start;
    } else if (start > 0) {
      nextValue = active.value.slice(0, start - 1) + active.value.slice(end);
      nextCursor = start - 1;
    }
  } else if (charOrAction === 'ENTER') {
    if (active instanceof HTMLTextAreaElement) {
      nextValue = active.value.slice(0, start) + '\n' + active.value.slice(end);
      nextCursor = start + 1;
    } else {
      active.form?.requestSubmit();
      return;
    }
  } else {
    nextValue = active.value.slice(0, start) + charOrAction + active.value.slice(end);
    nextCursor = start + charOrAction.length;
  }

  const proto =
    active instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(active, nextValue);
  else active.value = nextValue;
  active.dispatchEvent(new Event('input', { bubbles: true }));
  active.setSelectionRange(nextCursor, nextCursor);
}

export function SystemTray() {
  const [now, setNow] = useState(() => new Date());
  const [audioDeviceIndex, setAudioDeviceIndex] = useState(0);
  const [showAudioDevices, setShowAudioDevices] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [eventDraft, setEventDraft] = useState('');
  const lastInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const settings = useDesktopStore((state) => state.taskbarSettings);
  const windows = useDesktopStore((state) => state.windows);
  const activeDesktopId = useDesktopStore((state) => state.activeDesktopId);
  const systemVolume = useDesktopStore((state) => state.systemVolume);
  const isSystemMuted = useDesktopStore((state) => state.isSystemMuted);
  const appVolumes = useDesktopStore((state) => state.appVolumes);
  const wifiEnabled = useDesktopStore((state) => state.wifiEnabled);
  const airplaneMode = useDesktopStore((state) => state.airplaneMode);
  const networkName = useDesktopStore((state) => state.networkName);
  const calendarEvents = useDesktopStore((state) => state.calendarEvents);
  const setSystemVolume = useDesktopStore((state) => state.setSystemVolume);
  const toggleSystemMute = useDesktopStore((state) => state.toggleSystemMute);
  const setAppVolume = useDesktopStore((state) => state.setAppVolume);
  const toggleQuickSetting = useDesktopStore((state) => state.toggleQuickSetting);
  const setNetworkName = useDesktopStore((state) => state.setNetworkName);
  const addCalendarEvent = useDesktopStore((state) => state.addCalendarEvent);
  const removeCalendarEvent = useDesktopStore((state) => state.removeCalendarEvent);
  const toggleShowDesktop = useDesktopStore((state) => state.toggleShowDesktop);
  const setPeekingDesktop = useDesktopStore((state) => state.setPeekingDesktop);
  const openApp = useDesktopStore((state) => state.openApp);

  const audioDevices = [
    'Speakers (Realtek(R) Audio)',
    'Headphones (Stereo)',
  ];
  const effectiveVolume = isSystemMuted ? 0 : systemVolume;

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

  useEffect(() => {
    const trackFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        lastInputRef.current = e.target;
      }
    };
    window.addEventListener('focusin', trackFocus);
    return () => window.removeEventListener('focusin', trackFocus);
  }, []);

  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number; isCurrentMonth: boolean }> = [];

    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
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
  }, [viewYear, viewMonth]);

  const timeString = formatTime(now);
  const dateString = formatDate(now);
  const fullClockString = now.toLocaleTimeString('en-GB', { hour12: false });
  const fullDateTitle = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(1);
  };

  const selectedDateKey = dateKeyOf(viewYear, viewMonth, selectedDay);
  const dayEvents = calendarEvents[selectedDateKey] ?? [];
  const activeWindows = windows.filter((w) => w.desktopId === activeDesktopId);

  const btnSizeClass = isVertical ? 'w-full h-7' : 'h-full';

  const handleTouchKey = (token: string) => {
    if (lastInputRef.current && document.body.contains(lastInputRef.current)) {
      lastInputRef.current.focus({ preventScroll: true });
      insertTextIntoFocusedElement(token);
    }
  };

  const handleAddEvent = (e: FormEvent) => {
    e.preventDefault();
    if (!eventDraft.trim()) return;
    addCalendarEvent(selectedDateKey, eventDraft);
    setEventDraft('');
  };

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
          <PopoverSurface className="!bg-[#1b1b1b]/95 !border !border-[#454545] !rounded-none !p-3 !text-white !w-[340px]">
            <div className="text-[11px] text-white/70 mb-2">
              Touch Keyboard (click an input first, then tap keys)
            </div>
            <div className="grid grid-cols-10 gap-1 text-[11px]">
              {'QWERTYUIOPASDFGHJKL;ZXCVBNM,./'.split('').map((k) => (
                <button
                  key={k}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleTouchKey(k.toLowerCase())}
                  className="h-7 flex items-center justify-center bg-[#2f2f2f] hover:bg-[#444] active:bg-[#0078d7] border border-white/10 cursor-default"
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1 text-[11px]">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleTouchKey(' ')}
                className="col-span-2 h-7 flex items-center justify-center bg-[#2f2f2f] hover:bg-[#444] border border-white/10 text-white/80 cursor-default"
              >
                Space
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleTouchKey('BACKSPACE')}
                className="h-7 flex items-center justify-center bg-[#2f2f2f] hover:bg-[#444] border border-white/10 text-white/80 cursor-default"
              >
                ⌫
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleTouchKey('ENTER')}
                className="h-7 flex items-center justify-center bg-[#0078d7] hover:bg-[#1084e0] border border-white/10 text-white cursor-default"
              >
                Enter
              </button>
            </div>
          </PopoverSurface>
        </Popover>
      )}

      {/* Hidden Tray Icons */}
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
        <PopoverSurface className="!bg-[#1f1f1f]/95 !border !border-[#404040] !rounded-none !p-2 !text-white !w-[160px]">
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              title="Windows Security (Protected)"
              onClick={() => openApp('settings')}
              className="h-9 flex items-center justify-center hover:bg-white/10 cursor-default text-[14px]"
            >
              🛡️
            </button>
            <button
              type="button"
              title="Storage Service"
              onClick={() => openApp('explorer', 'this-pc')}
              className="h-9 flex items-center justify-center hover:bg-white/10 cursor-default text-[14px]"
            >
              💾
            </button>
            <button
              type="button"
              title="Task Manager"
              onClick={() => openApp('task-manager')}
              className="h-9 flex items-center justify-center hover:bg-white/10 cursor-default text-[14px]"
            >
              📊
            </button>
          </div>
        </PopoverSurface>
      </Popover>

      {/* Network Flyout */}
      {settings.systemIcons.network && (
        <Popover positioning={popoverPos}>
          <PopoverTrigger disableButtonEnhancement>
            <button
              type="button"
              aria-label="Network status"
              title={
                airplaneMode
                  ? 'Airplane mode is on'
                  : wifiEnabled
                    ? `${networkName}: Internet access`
                    : 'Not connected'
              }
              className={`flex items-center justify-center ${isVertical ? btnSizeClass : 'w-7 h-full'} hover:bg-white/12 transition-colors cursor-default`}
            >
              <Win10WifiIcon className={wifiEnabled && !airplaneMode ? 'text-white/95' : 'text-white/40'} />
            </button>
          </PopoverTrigger>
          <PopoverSurface className="!bg-[#1f1f1f]/95 !backdrop-blur-xl !border !border-[#3d3d3d] !rounded-none !p-0 !w-[300px] !text-white !shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
            <div className="p-3 border-b border-white/10">
              <div className="text-[13px] font-medium">
                {airplaneMode ? 'Airplane mode' : wifiEnabled ? networkName : 'Wi-Fi is turned off'}
              </div>
              <div className="text-[11px] text-white/65">
                {wifiEnabled && !airplaneMode ? 'Connected, secured' : 'No Internet access'}
              </div>
            </div>
            {wifiEnabled && !airplaneMode && (
              <div className="divide-y divide-white/5 max-h-[180px] overflow-y-auto">
                {WIFI_NETWORKS.map((net) => {
                  const active = net.name === networkName;
                  return (
                    <button
                      key={net.name}
                      type="button"
                      onClick={() => setNetworkName(net.name)}
                      className={`w-full text-left px-3 py-2 hover:bg-white/10 cursor-default flex items-center justify-between ${active ? 'bg-[#0078d7]/25' : ''}`}
                    >
                      <div>
                        <div className="text-[12.5px]">{net.name}</div>
                        <div className="text-[10.5px] text-white/60">
                          {active ? 'Connected' : net.security} · {net.signal}
                        </div>
                      </div>
                      {active && <span className="text-[11px] text-[#60cdff]">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5 p-2.5 border-t border-white/10 bg-[#181818]">
              <button
                type="button"
                onClick={() => toggleQuickSetting('wifiEnabled')}
                className={`py-2 px-2 text-left text-[11.5px] border cursor-default ${wifiEnabled ? 'bg-[#0078d7] border-white/30' : 'bg-[#2c2c2c] border-white/10'}`}
              >
                Wi-Fi: {wifiEnabled ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => toggleQuickSetting('airplaneMode')}
                className={`py-2 px-2 text-left text-[11.5px] border cursor-default ${airplaneMode ? 'bg-[#0078d7] border-white/30' : 'bg-[#2c2c2c] border-white/10'}`}
              >
                Airplane: {airplaneMode ? 'On' : 'Off'}
              </button>
            </div>
          </PopoverSurface>
        </Popover>
      )}

      {/* Volume + Scroll Wheel + Mixer */}
      {settings.systemIcons.volume && (
        <Popover positioning={popoverPos}>
          <PopoverTrigger disableButtonEnhancement>
            <button
              type="button"
              aria-label="Volume"
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 4 : -4;
                setSystemVolume(systemVolume + delta);
              }}
              title={
                isSystemMuted || systemVolume === 0
                  ? `${audioDevices[audioDeviceIndex]}: Muted (scroll to adjust)`
                  : `${audioDevices[audioDeviceIndex]}: ${systemVolume}% (scroll to adjust)`
              }
              className={`flex items-center justify-center ${isVertical ? btnSizeClass : 'w-7 h-full'} hover:bg-white/12 transition-colors cursor-default`}
            >
              <Win10VolumeIcon
                muted={isSystemMuted}
                level={systemVolume}
                className="text-white/95"
              />
            </button>
          </PopoverTrigger>
          <PopoverSurface className="!bg-[#1f1f1f]/95 !backdrop-blur-xl !border !border-[#3d3d3d] !rounded-none !p-0 !w-[344px] !text-white !shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col">
              {/* Device header */}
              <button
                type="button"
                onClick={() => setShowAudioDevices((v) => !v)}
                className="flex items-center justify-between w-full px-4 pt-3 pb-2 text-[14px] text-white/95 hover:bg-white/5 transition-colors cursor-default"
              >
                <span className="truncate">{audioDevices[audioDeviceIndex]}</span>
                <span className="text-[11px] text-white/75 ml-2">
                  {showAudioDevices ? '⌄' : '⌃'}
                </span>
              </button>

              {showAudioDevices && (
                <div className="border-t border-b border-white/10 bg-[#181818] py-1">
                  {audioDevices.map((dev, idx) => (
                    <button
                      key={dev}
                      type="button"
                      onClick={() => {
                        setAudioDeviceIndex(idx);
                        setShowAudioDevices(false);
                      }}
                      className={[
                        'w-full text-left px-4 py-2 text-[13px] hover:bg-white/10 transition-colors cursor-default flex items-center justify-between',
                        idx === audioDeviceIndex ? 'text-[#60cdff]' : 'text-white/85',
                      ].join(' ')}
                    >
                      <span className="truncate">{dev}</span>
                      {idx === audioDeviceIndex && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Master volume slider row */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <button
                  type="button"
                  aria-label={isSystemMuted ? 'Unmute' : 'Mute'}
                  title={isSystemMuted ? 'Unmute' : 'Mute'}
                  onClick={toggleSystemMute}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 transition-colors cursor-default shrink-0"
                >
                  <Win10VolumeIcon
                    muted={isSystemMuted}
                    level={systemVolume}
                    width="20"
                    height="20"
                    className="text-white/90"
                  />
                </button>

                <div className="relative flex-1 flex items-center h-6">
                  <div className="w-full h-[2px] bg-[#666666] relative pointer-events-none">
                    <div
                      style={{ width: `${effectiveVolume}%` }}
                      className="h-full bg-[#0078d7]"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={effectiveVolume}
                    aria-label="Master volume"
                    onChange={(e) => setSystemVolume(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    style={{ left: `calc(${effectiveVolume}% - 4px)` }}
                    className="absolute w-[8px] h-[22px] rounded-full bg-[#0078d7] pointer-events-none shadow-sm"
                  />
                </div>

                <span className="w-9 text-right text-[20px] font-light tabular-nums text-white/95 shrink-0">
                  {effectiveVolume}
                </span>
              </div>

              {/* Volume Mixer toggle */}
              <div className="border-t border-white/10 px-4 py-2 bg-[#181818]">
                <button
                  type="button"
                  onClick={() => setShowMixer((v) => !v)}
                  className="text-[11.5px] text-[#9bd2ff] hover:underline cursor-default"
                >
                  {showMixer ? 'Hide Volume Mixer' : 'Open Volume Mixer'}
                </button>
                {showMixer && (
                  <div className="mt-2 space-y-2 max-h-[140px] overflow-y-auto">
                    {activeWindows.length === 0 ? (
                      <div className="text-[11px] text-white/55">No running apps</div>
                    ) : (
                      activeWindows.map((win) => {
                        const val = appVolumes[win.appId ?? win.id] ?? 100;
                        return (
                          <div key={win.id} className="flex items-center gap-2 text-[11px]">
                            <img src={win.icon} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                            <span className="w-24 truncate text-white/85">{win.title}</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={val}
                              onChange={(e) => setAppVolume(win.appId ?? win.id, Number(e.target.value))}
                              className="flex-1 accent-[#0078d7]"
                            />
                            <span className="w-7 text-right tabular-nums text-white/75">{val}%</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </PopoverSurface>
        </Popover>
      )}

      {/* Clock & Calendar */}
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
          <PopoverSurface className="!bg-[#1f1f1f]/95 !backdrop-blur-xl !border !border-[#3d3d3d] !rounded-none !p-4 !w-[320px] !text-white">
            <div className="pb-3 border-b border-white/15">
              <div className="text-4xl font-light tracking-tight tabular-nums">
                {fullClockString}
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewYear(now.getFullYear());
                  setViewMonth(now.getMonth());
                  setSelectedDay(now.getDate());
                }}
                className="text-xs text-[#60cdff] hover:underline mt-1 cursor-default"
              >
                {fullDateTitle}
              </button>
            </div>
            <div className="pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white/90">{monthLabel}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => shiftMonth(-1)}
                    className="w-6 h-6 flex items-center justify-center hover:bg-white/10 text-white/80 cursor-default"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => shiftMonth(1)}
                    className="w-6 h-6 flex items-center justify-center hover:bg-white/10 text-white/80 cursor-default"
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/70 mb-1">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1 font-medium">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {calendarDays.map((cell, idx) => {
                  const isToday =
                    cell.isCurrentMonth &&
                    viewYear === now.getFullYear() &&
                    viewMonth === now.getMonth() &&
                    cell.day === now.getDate();
                  const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
                  const hasEv =
                    cell.isCurrentMonth &&
                    (calendarEvents[dateKeyOf(viewYear, viewMonth, cell.day)]?.length ?? 0) > 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!cell.isCurrentMonth}
                      onClick={() => cell.isCurrentMonth && setSelectedDay(cell.day)}
                      className={[
                        'relative py-1.5 tabular-nums cursor-default',
                        isToday
                          ? 'bg-[#0078d7] text-white font-semibold border border-[#60cdff]'
                          : isSelected
                            ? 'bg-white/15 border border-white/50 text-white'
                            : cell.isCurrentMonth
                              ? 'text-white/90 hover:bg-white/10'
                              : 'text-white/30',
                      ].join(' ')}
                    >
                      {cell.day}
                      {hasEv && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#60cdff]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Agenda / Reminder for selected date */}
              <div className="mt-3 pt-2.5 border-t border-white/15 space-y-1.5">
                <div className="text-[11px] text-white/70">Events for {selectedDateKey}</div>
                {dayEvents.map((ev, i) => (
                  <div
                    key={`${selectedDateKey}-${i}`}
                    className="flex items-center justify-between bg-white/5 px-2 py-1 text-[11.5px]"
                  >
                    <span className="truncate">{ev}</span>
                    <button
                      type="button"
                      onClick={() => removeCalendarEvent(selectedDateKey, i)}
                      className="text-white/55 hover:text-white ml-2 cursor-default"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <form onSubmit={handleAddEvent} className="flex gap-1">
                  <input
                    type="text"
                    value={eventDraft}
                    onChange={(e) => setEventDraft(e.target.value)}
                    placeholder="Add an event or reminder"
                    className="flex-1 h-6 px-2 bg-[#161616] border border-white/20 text-[11px] text-white outline-none focus:border-[#0078d7]"
                  />
                  <button
                    type="submit"
                    className="px-2 h-6 bg-[#0078d7] hover:bg-[#1084e0] text-[11px] cursor-default"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>
          </PopoverSurface>
        </Popover>
      )}

      {settings.systemIcons.actionCenter && (
        <ActionCenter positioning={popoverPos} sizeClass={isVertical ? btnSizeClass : 'w-9 h-full'} />
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
