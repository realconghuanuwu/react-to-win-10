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
  const [open, setOpen] = useState(false);
  const items = useNotificationStore((state) => state.items);
  const unread = items.filter((item) => item.unread).length;

  useEffect(() => {
    if (open && unread) useNotificationStore.getState().markRead();
  }, [open, unread]);

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
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#69bcff] ring-1 ring-[#222]" />}
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
            <button type="button" onClick={() => useNotificationStore.getState().clear()} className="px-2 py-1 text-xs text-[#9bd2ff] hover:bg-white/10">
              Clear all
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/70">No notifications</p>
        ) : (
          <ul className="max-h-[min(480px,55vh)] space-y-2 overflow-y-auto p-3">
            {items.map((item) => {
              const Icon = item.kind === 'error' ? ErrorCircleRegular : CheckmarkCircleRegular;
              return (
                <li key={item.id} className="border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start gap-2">
                    <Icon aria-hidden="true" className={`mt-0.5 shrink-0 text-base ${item.kind === 'error' ? 'text-[#ffa7a7]' : 'text-[#9bd2ff]'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-white/70">
                        <span>{item.source}</span>
                        <time dateTime={new Date(item.createdAt).toISOString()}>{timeFormat.format(item.createdAt)}</time>
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold">{item.title}</p>
                      <p className="mt-0.5 break-words text-xs text-white/80">{item.message}</p>
                      {item.target && (
                        <button type="button" className="mt-2 text-xs text-[#9bd2ff] hover:underline" onClick={() => {
                          const { target } = item;
                          if (!target) return;
                          const { openApp } = useDesktopStore.getState();
                          if ('fileId' in target) {
                            const { nodes } = useFileSystemStore.getState();
                            const parentId = nodes[target.fileId]?.parentId ?? target.folderId;
                            openApp('explorer', nodes[parentId] ? parentId : 'this-pc', target.fileId);
                          } else {
                            openApp(target.appId);
                          }
                          setOpen(false);
                        }}>
                          {'fileId' in item.target ? 'Show in File Explorer' : `Open ${item.source}`}
                        </button>
                      )}
                    </div>
                    <button type="button" aria-label={`Dismiss ${item.title}`} className="grid h-6 w-6 shrink-0 place-items-center hover:bg-white/10" onClick={() => useNotificationStore.getState().dismiss(item.id)}>
                      <DismissRegular aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverSurface>
    </Popover>
  );
}
