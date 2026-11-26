import { useEffect, useState, type ComponentProps } from 'react';
import { Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components';
import { CheckmarkCircleRegular, DismissRegular, ErrorCircleRegular } from '@fluentui/react-icons';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Win10ActionCenterIcon } from './Win10Icons';

interface ActionCenterProps {
  positioning: ComponentProps<typeof Popover>['positioning'];
  sizeClass: string;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function ActionCenter({ positioning, sizeClass }: ActionCenterProps) {
  const open = useDesktopStore((state) => state.isActionCenterOpen);
  const setOpen = useDesktopStore((state) => state.setActionCenterOpen);
  const wifiEnabled = useDesktopStore((state) => state.wifiEnabled);
  const bluetoothEnabled = useDesktopStore((state) => state.bluetoothEnabled);
  const nightLightEnabled = useDesktopStore((state) => state.nightLightEnabled);
  const airplaneMode = useDesktopStore((state) => state.airplaneMode);
  const focusAssist = useDesktopStore((state) => state.focusAssist);
  const brightness = useDesktopStore((state) => state.brightness);
  const setBrightness = useDesktopStore((state) => state.setBrightness);
  const accentColor = useDesktopStore((state) => state.personalizationSettings.accentColor);
  const toggleQuickSetting = useDesktopStore((state) => state.toggleQuickSetting);
  const openApp = useDesktopStore((state) => state.openApp);
  const openSettingsTab = useDesktopStore((state) => state.openSettingsTab);

  const [collapsed, setCollapsed] = useState(false);
  const items = useNotificationStore((state) => state.items);
  const unread = items.filter((item) => item.unread).length;

  useEffect(() => {
    if (open && unread) useNotificationStore.getState().markRead();
  }, [open, unread]);

  const quickActions: Array<{
    id: string;
    label: string;
    active: boolean;
    onClick: () => void;
    sub?: string;
  }> = [
    {
      id: 'wifi',
      label: 'Wi-Fi',
      sub: wifiEnabled ? 'Connected' : 'Off',
      active: wifiEnabled,
      onClick: () => toggleQuickSetting('wifiEnabled'),
    },
    {
      id: 'bluetooth',
      label: 'Bluetooth',
      sub: bluetoothEnabled ? 'On' : 'Off',
      active: bluetoothEnabled,
      onClick: () => toggleQuickSetting('bluetoothEnabled'),
    },
    {
      id: 'night-light',
      label: 'Night light',
      sub: nightLightEnabled ? 'On' : 'Off',
      active: nightLightEnabled,
      onClick: () => toggleQuickSetting('nightLightEnabled'),
    },
    {
      id: 'airplane',
      label: 'Airplane mode',
      sub: airplaneMode ? 'On' : 'Off',
      active: airplaneMode,
      onClick: () => toggleQuickSetting('airplaneMode'),
    },
    {
      id: 'focus',
      label: 'Focus assist',
      sub: focusAssist ? 'Alarms only' : 'Off',
      active: focusAssist,
      onClick: () => toggleQuickSetting('focusAssist'),
    },
    {
      id: 'settings',
      label: 'All settings',
      active: false,
      onClick: () => {
        openApp('settings');
        setOpen(false);
      },
    },
    {
      id: 'display',
      label: 'Display',
      active: false,
      onClick: () => {
        openSettingsTab('Display');
        setOpen(false);
      },
    },
    {
      id: 'snip',
      label: 'Screen snip',
      active: false,
      onClick: () => {
        openApp('snip');
        setOpen(false);
      },
    },
  ];

  const visibleActions = collapsed ? quickActions.slice(0, 4) : quickActions;

  return (
    <Popover positioning={positioning} open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <button
          type="button"
          aria-label={unread ? `Action Center, ${unread} unread` : 'Action Center'}
          title={unread ? `${unread} unread notifications` : 'Action Center'}
          className={`relative flex items-center justify-center ${sizeClass} hover:bg-white/12 focus-visible:outline focus-visible:outline-white`}
        >
          <span className="relative">
            <Win10ActionCenterIcon className="text-white/95" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#0078d7] text-white text-[9px] font-semibold flex items-center justify-center ring-1 ring-[#181818]">
                {unread}
              </span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverSurface
        aria-label="Action Center"
        className="!w-[min(380px,calc(100vw-16px))] !rounded-none !border !border-white/20 !bg-[#202020]/98 !p-0 !text-white !shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/15 px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => useNotificationStore.getState().clear()}
              className="px-2 py-1 text-xs text-[#9bd2ff] hover:bg-white/10"
            >
              Clear all
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/70">No new notifications</p>
        ) : (
          <ul className="max-h-[min(320px,42vh)] space-y-2 overflow-y-auto p-3">
            {items.map((item) => {
              const Icon = item.kind === 'error' ? ErrorCircleRegular : CheckmarkCircleRegular;
              return (
                <li key={item.id} className="border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start gap-2">
                    <Icon
                      aria-hidden="true"
                      className={`mt-0.5 shrink-0 text-base ${item.kind === 'error' ? 'text-[#ffa7a7]' : 'text-[#9bd2ff]'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-white/70">
                        <span>{item.source}</span>
                        <time dateTime={new Date(item.createdAt).toISOString()}>
                          {timeFormat.format(item.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold">{item.title}</p>
                      <p className="mt-0.5 break-words text-xs text-white/80">{item.message}</p>
                      {item.target && (
                        <button
                          type="button"
                          className="mt-2 text-xs text-[#9bd2ff] hover:underline"
                          onClick={() => {
                            const { target } = item;
                            if (!target) return;
                            const { openApp: openTargetApp } = useDesktopStore.getState();
                            if ('fileId' in target) {
                              const { nodes } = useFileSystemStore.getState();
                              const parentId = nodes[target.fileId]?.parentId ?? target.folderId;
                              openTargetApp('explorer', nodes[parentId] ? parentId : 'this-pc', target.fileId);
                            } else {
                              openTargetApp(target.appId);
                            }
                            setOpen(false);
                          }}
                        >
                          {'fileId' in item.target ? 'Show in File Explorer' : `Open ${item.source}`}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`Dismiss ${item.title}`}
                      className="grid h-6 w-6 shrink-0 place-items-center hover:bg-white/10"
                      onClick={() => useNotificationStore.getState().dismiss(item.id)}
                    >
                      <DismissRegular aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Quick Actions Footer */}
        <div className="border-t border-white/15 bg-[#181818] p-3">
          <div className="flex items-center justify-between mb-2 text-[11px] text-white/70">
            <span>Quick actions</span>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="text-[#9bd2ff] hover:underline cursor-default"
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {visibleActions.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={act.onClick}
                style={act.active ? { backgroundColor: accentColor } : undefined}
                className={[
                  'h-[54px] px-2 py-1.5 flex flex-col justify-between text-left border transition-colors cursor-default',
                  act.active
                    ? 'border-white/35 text-white'
                    : 'bg-[#2c2c2c] hover:bg-[#383838] border-white/10 text-white/90',
                ].join(' ')}
              >
                <span className="text-[11px] font-medium leading-tight truncate">{act.label}</span>
                {act.sub && <span className="text-[10px] text-white/75 truncate">{act.sub}</span>}
              </button>
            ))}
          </div>

          {/* Brightness Slider */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center gap-2.5">
            <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" className="text-white/85 shrink-0">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6" strokeLinecap="round" />
            </svg>
            <input
              type="range"
              min={20}
              max={100}
              value={brightness}
              aria-label="Screen brightness"
              onChange={(e) => setBrightness(Number(e.target.value))}
              style={{ accentColor }}
              className="flex-1 h-1 cursor-pointer"
            />
            <span className="w-8 text-right text-[11px] text-white/80 tabular-nums">{brightness}%</span>
          </div>
        </div>
      </PopoverSurface>
    </Popover>
  );
}
