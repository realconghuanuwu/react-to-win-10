import { useEffect, useState } from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';

export function TaskViewOverlay() {
  const isOpen = useDesktopStore((state) => state.isTaskViewOpen);
  const allWindows = useDesktopStore((state) => state.windows);
  const virtualDesktops = useDesktopStore((state) => state.virtualDesktops);
  const activeDesktopId = useDesktopStore((state) => state.activeDesktopId);
  const activeAppId = useDesktopStore((state) => state.activeAppId);
  const setTaskViewOpen = useDesktopStore((state) => state.setTaskViewOpen);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const createVirtualDesktop = useDesktopStore((state) => state.createVirtualDesktop);
  const switchVirtualDesktop = useDesktopStore((state) => state.switchVirtualDesktop);
  const removeVirtualDesktop = useDesktopStore((state) => state.removeVirtualDesktop);
  const moveWindowToDesktop = useDesktopStore((state) => state.moveWindowToDesktop);

  const [dragWinId, setDragWinId] = useState<string | null>(null);
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);

  const windows = allWindows.filter((w) => w.desktopId === activeDesktopId);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCardIdx(0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setTaskViewOpen(false);
        return;
      }
      if (windows.length === 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCardIdx((i) => (i + 1) % windows.length);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCardIdx((i) => (i - 1 + windows.length) % windows.length);
      } else if (e.key === 'Enter') {
        const target = windows[selectedCardIdx];
        if (target) {
          e.preventDefault();
          focusWindow(target.id);
          setTaskViewOpen(false);
        }
      } else if (e.key === 'Delete') {
        const target = windows[selectedCardIdx];
        if (target) {
          e.preventDefault();
          closeWindow(target.id);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, windows, selectedCardIdx, setTaskViewOpen, focusWindow, closeWindow]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Task View"
      onClick={() => setTaskViewOpen(false)}
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-md flex flex-col justify-between p-6 select-none overflow-y-auto"
    >
      {/* Top Virtual Desktops Strip */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl mx-auto flex flex-wrap items-center gap-3 pb-4 border-b border-white/15"
      >
        {virtualDesktops.map((desk) => {
          const isCurrent = desk.id === activeDesktopId;
          const count = allWindows.filter((w) => w.desktopId === desk.id).length;
          return (
            <div
              key={desk.id}
              onDragOver={(e) => {
                if (dragWinId) e.preventDefault();
              }}
              onDrop={() => {
                if (dragWinId) {
                  moveWindowToDesktop(dragWinId, desk.id);
                  setDragWinId(null);
                }
              }}
              className={[
                'group relative flex items-center gap-2 px-3 py-2 border transition-colors cursor-default',
                isCurrent
                  ? 'bg-[#0078d7]/35 border-[#66baff] text-white'
                  : 'bg-[#222]/90 border-white/20 text-white/80 hover:border-white/50',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => switchVirtualDesktop(desk.id)}
                className="flex items-center gap-2 text-[12.5px] cursor-default"
              >
                <span className="font-medium">{desk.name}</span>
                <span className="text-[11px] text-white/60">({count})</span>
              </button>
              {virtualDesktops.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close ${desk.name}`}
                  onClick={() => removeVirtualDesktop(desk.id)}
                  className="w-5 h-5 flex items-center justify-center text-white/65 hover:bg-[#e81123] hover:text-white cursor-default text-[12px]"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            const newId = createVirtualDesktop();
            switchVirtualDesktop(newId);
          }}
          className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-[12.5px] text-white cursor-default"
        >
          + New desktop
        </button>

        <button
          type="button"
          onClick={() => setTaskViewOpen(false)}
          className="ml-auto px-3 py-1.5 bg-white/10 hover:bg-white/20 text-[12px] text-white cursor-default"
        >
          Close (Esc)
        </button>
      </div>

      {/* Main Window Grid */}
      <div className="w-full max-w-6xl mx-auto my-auto py-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[16px] font-light tracking-wide text-white/90 mb-4">
          {virtualDesktops.find((d) => d.id === activeDesktopId)?.name ?? 'Desktop'} — Open Windows
        </h2>

        {windows.length === 0 ? (
          <div className="py-16 text-center text-white/70 text-[14px] border border-white/10 bg-white/5">
            No open windows on this desktop.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {windows.map((win, idx) => {
              const isActive = activeAppId === win.id && !win.isMinimized;
              const isSelected = idx === selectedCardIdx;
              return (
                <div
                  key={win.id}
                  draggable
                  onDragStart={() => setDragWinId(win.id)}
                  onDragEnd={() => setDragWinId(null)}
                  className={[
                    'group relative flex flex-col bg-[#222222] border transition-colors',
                    isSelected || isActive
                      ? 'border-[#66baff] ring-1 ring-[#0078d7]'
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
                      {win.isMinimized ? 'Minimized' : isActive ? 'Active window' : `${win.width}×${win.height}`}
                    </span>
                  </button>
                  {virtualDesktops.length > 1 && (
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-[#1a1a1a] border-t border-white/10 text-[10.5px] text-white/70 overflow-x-auto">
                      <span>Move to:</span>
                      {virtualDesktops
                        .filter((d) => d.id !== win.desktopId)
                        .map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => moveWindowToDesktop(win.id, d.id)}
                            className="px-1.5 py-0.5 bg-white/10 hover:bg-[#0078d7] text-white cursor-default shrink-0"
                          >
                            {d.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-full max-w-6xl mx-auto text-[11px] text-white/55 flex flex-wrap gap-4">
        <span>Drag windows onto a desktop tab above to move them</span>
        <span>Ctrl+Win+Left/Right (or Ctrl+Alt+Shift+Left/Right) to switch desktops</span>
      </div>
    </div>
  );
}
