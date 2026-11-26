import { useState } from 'react';
import { Tooltip } from '@fluentui/react-components';
import { DESKTOP_APPS } from '../../data/desktopApps';
import { SystemTray } from './SystemTray';
import { Win10SearchIcon, Win10StartLogo } from './Win10Icons';

export function Taskbar() {
  const pinnedApps = DESKTOP_APPS.filter((app) => app.pinnedToTaskbar);
  const [activeAppId, setActiveAppId] = useState<string | null>('chrome');
  const [openAppIds, setOpenAppIds] = useState<string[]>(['chrome']);

  const handleTaskbarAppClick = (id: string) => {
    if (!openAppIds.includes(id)) {
      setOpenAppIds((prev) => [...prev, id]);
      setActiveAppId(id);
      return;
    }
    setActiveAppId((prev) => (prev === id ? null : id));
  };

  return (
    <footer
      aria-label="Windows 10 Taskbar"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed bottom-0 left-0 right-0 h-[40px] bg-[#101010]/85 backdrop-blur-xl border-t border-white/5 flex items-center justify-between z-50"
    >
      <div className="flex items-center h-full">
        <Tooltip content="Start" relationship="label" positioning="above">
          <button
            type="button"
            aria-label="Start"
            className="flex items-center justify-center w-12 h-full text-white hover:bg-white/10 hover:text-[#429ce3] active:bg-white/15 transition-colors cursor-default"
          >
            <Win10StartLogo />
          </button>
        </Tooltip>

        <Tooltip content="Type here to search" relationship="label" positioning="above">
          <button
            type="button"
            aria-label="Search"
            className="flex items-center justify-center w-12 h-full text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-default"
          >
            <Win10SearchIcon />
          </button>
        </Tooltip>

        <nav aria-label="Pinned applications" className="flex items-center h-full">
          {pinnedApps.map((app) => {
            const isOpen = openAppIds.includes(app.id);
            const isActive = activeAppId === app.id;

            return (
              <Tooltip key={app.id} content={app.name} relationship="label" positioning="above">
                <button
                  type="button"
                  aria-label={app.name}
                  onClick={() => handleTaskbarAppClick(app.id)}
                  className={[
                    'relative flex items-center justify-center w-12 h-full transition-colors cursor-default',
                    isActive
                      ? 'bg-white/16 hover:bg-white/22'
                      : 'hover:bg-white/10 active:bg-white/15',
                  ].join(' ')}
                >
                  <img
                    src={app.icon}
                    alt={app.name}
                    draggable={false}
                    className="w-6 h-6 object-contain pointer-events-none"
                  />
                  {isOpen && (
                    <span
                      className={[
                        'absolute bottom-0 h-[2px] bg-[#76b9ed] transition-all duration-150',
                        isActive ? 'w-full' : 'w-10',
                      ].join(' ')}
                    />
                  )}
                </button>
              </Tooltip>
            );
          })}
        </nav>
      </div>

      <SystemTray />
    </footer>
  );
}
