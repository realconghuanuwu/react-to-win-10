import { useDesktopStore } from '../../store/useDesktopStore';

export function TaskViewOverlay() {
  const isOpen = useDesktopStore((state) => state.isTaskViewOpen);
  const windows = useDesktopStore((state) => state.windows);
  const activeAppId = useDesktopStore((state) => state.activeAppId);
  const setTaskViewOpen = useDesktopStore((state) => state.setTaskViewOpen);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const closeWindow = useDesktopStore((state) => state.closeWindow);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Task View"
      onClick={() => setTaskViewOpen(false)}
      className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-md flex flex-col items-center justify-center p-8 select-none"
    >
      <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6 text-white">
          <h2 className="text-[18px] font-light tracking-wide">Task View — Open Windows</h2>
          <button
            type="button"
            onClick={() => setTaskViewOpen(false)}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-[12px] text-white cursor-default"
          >
            Close
          </button>
        </div>

        {windows.length === 0 ? (
          <div className="py-16 text-center text-white/70 text-[14px] border border-white/10 bg-white/5">
            No open windows right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {windows.map((win) => {
              const isActive = activeAppId === win.id && !win.isMinimized;
              return (
                <div
                  key={win.id}
                  className={[
                    'group relative flex flex-col bg-[#222222] border transition-colors',
                    isActive
                      ? 'border-[#0078d7] ring-1 ring-[#0078d7]'
                      : 'border-white/15 hover:border-white/50',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] border-b border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={win.icon} alt="" className="w-4 h-4 object-contain shrink-0" />
                      <span className="text-[12px] text-white truncate">{win.title}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Close ${win.title}`}
                      onClick={() => closeWindow(win.id)}
                      className="w-6 h-6 flex items-center justify-center text-white/70 hover:bg-[#e81123] hover:text-white cursor-default"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      focusWindow(win.id);
                      setTaskViewOpen(false);
                    }}
                    className="h-[140px] flex flex-col items-center justify-center gap-2 bg-[#2b2b2b] hover:bg-[#333333] cursor-default"
                  >
                    <img src={win.icon} alt="" className="w-12 h-12 object-contain" />
                    <span className="text-[11px] text-white/65">
                      {win.isMinimized ? 'Minimized' : isActive ? 'Active window' : 'Open window'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
