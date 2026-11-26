import { useState } from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';

export function TaskManagerApp() {
  const windows = useDesktopStore((state) => state.windows);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedWindow = windows.find((w) => w.id === selectedId) ?? null;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#ffffff] text-[#1f1f1f] text-[12px] select-none">
      {/* Tabs */}
      <div className="flex items-center border-b border-[#d9d9d9] bg-[#f3f3f3] px-2 pt-1 gap-1 shrink-0">
        <div className="px-3 py-1.5 bg-white border border-b-0 border-[#d9d9d9] font-medium text-[#000000]">
          Processes
        </div>
        <div className="px-3 py-1.5 text-[#666666]">Performance</div>
        <div className="px-3 py-1.5 text-[#666666]">Startup</div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_90px_90px_90px] border-b border-[#e5e5e5] bg-[#fafafa] px-3 py-1.5 text-[#555555] font-medium shrink-0">
        <div>Name</div>
        <div className="text-right">Status</div>
        <div className="text-right">CPU</div>
        <div className="text-right">Memory</div>
      </div>

      {/* Process Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#f2f2f2]">
        <div className="px-3 py-1 bg-[#f5f5f5] text-[11px] font-semibold text-[#555555]">
          Apps ({windows.length})
        </div>

        {windows.length === 0 ? (
          <div className="px-3 py-4 text-[#777777] text-center">No running apps</div>
        ) : (
          windows.map((win, idx) => {
            const isSelected = selectedId === win.id;
            const memMb = (34.2 + ((win.id.length * 17 + idx * 23) % 85)).toFixed(1);
            const cpuPct = win.isMinimized ? '0.0%' : `${((idx + 1) * 0.4).toFixed(1)}%`;

            return (
              <button
                key={win.id}
                type="button"
                onClick={() => setSelectedId(win.id)}
                onDoubleClick={() => focusWindow(win.id)}
                className={[
                  'w-full grid grid-cols-[1fr_90px_90px_90px] items-center px-3 py-1.5 text-left cursor-default',
                  isSelected ? 'bg-[#cce8ff]' : 'hover:bg-[#e5f3ff]',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img src={win.icon} alt="" className="w-4 h-4 object-contain shrink-0" />
                  <span className="truncate text-[#1a1a1a]">{win.title}</span>
                </div>
                <div className="text-right text-[#555555]">
                  {win.isMinimized ? 'Suspended' : 'Running'}
                </div>
                <div className="text-right tabular-nums text-[#333333]">{cpuPct}</div>
                <div className="text-right tabular-nums text-[#333333]">{memMb} MB</div>
              </button>
            );
          })
        )}

        <div className="px-3 py-1 bg-[#f5f5f5] text-[11px] font-semibold text-[#555555]">
          Windows processes (3)
        </div>
        <div className="grid grid-cols-[1fr_90px_90px_90px] items-center px-3 py-1.5 text-[#333333]">
          <div>Windows Explorer (Shell)</div>
          <div className="text-right text-[#555555]">Running</div>
          <div className="text-right tabular-nums">0.3%</div>
          <div className="text-right tabular-nums">48.6 MB</div>
        </div>
        <div className="grid grid-cols-[1fr_90px_90px_90px] items-center px-3 py-1.5 text-[#333333]">
          <div>Desktop Window Manager</div>
          <div className="text-right text-[#555555]">Running</div>
          <div className="text-right tabular-nums">0.6%</div>
          <div className="text-right tabular-nums">39.2 MB</div>
        </div>
        <div className="grid grid-cols-[1fr_90px_90px_90px] items-center px-3 py-1.5 text-[#333333]">
          <div>IndexedDB Storage Service</div>
          <div className="text-right text-[#555555]">Running</div>
          <div className="text-right tabular-nums">0.1%</div>
          <div className="text-right tabular-nums">18.4 MB</div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-3 py-2 bg-[#f3f3f3] border-t border-[#d9d9d9] shrink-0">
        <span className="text-[#555555]">
          Total running apps: {windows.length}
        </span>
        <button
          type="button"
          disabled={!selectedWindow}
          onClick={() => {
            if (!selectedWindow) return;
            closeWindow(selectedWindow.id);
            setSelectedId(null);
          }}
          className={[
            'px-4 py-1 border text-[12px] cursor-default',
            selectedWindow
              ? 'bg-[#e1e1e1] hover:bg-[#e5f1fb] border-[#adadad] hover:border-[#0078d7] text-black'
              : 'bg-[#f0f0f0] border-[#d0d0d0] text-[#999999]',
          ].join(' ')}
        >
          End task
        </button>
      </footer>
    </div>
  );
}
