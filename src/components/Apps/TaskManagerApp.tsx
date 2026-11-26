import { useEffect, useMemo, useState } from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';
import { formatStorageBytes, useFileSystemStore } from '../../store/useFileSystemStore';

type TaskMgrTab = 'processes' | 'performance' | 'startup';
type PerfMetric = 'cpu' | 'memory' | 'disk' | 'wifi';
type SortKey = 'name' | 'status' | 'cpu' | 'memory';

interface StartupEntry {
  id: string;
  name: string;
  publisher: string;
  impact: 'High' | 'Medium' | 'Low' | 'Not measured';
  enabled: boolean;
}

const INITIAL_STARTUP_APPS: StartupEntry[] = [
  { id: 'sec', name: 'Windows Security notification icon', publisher: 'Microsoft Corporation', impact: 'Low', enabled: true },
  { id: 'onedrive', name: 'Microsoft OneDrive', publisher: 'Microsoft Corporation', impact: 'High', enabled: true },
  { id: 'audio', name: 'Realtek HD Audio Universal Service', publisher: 'Realtek Semiconductor', impact: 'Medium', enabled: true },
  { id: 'office', name: 'Microsoft Office Quick Starter', publisher: 'Microsoft Corporation', impact: 'Medium', enabled: false },
  { id: 'idb', name: 'IndexedDB Local Cache Agent', publisher: 'Win10 Web Shell', impact: 'Not measured', enabled: true },
];

function SparkChart({
  data,
  stroke,
  fill,
  height = 170,
}: {
  data: number[];
  stroke: string;
  fill: string;
  height?: number;
}) {
  const width = 460;
  const pts = data.map((val, i) => {
    const x = (i / Math.max(1, data.length - 1)) * width;
    const y = height - (Math.max(0, Math.min(100, val)) / 100) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lineD = `M ${pts.join(' L ')}`;
  const areaD = `${lineD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[170px] border border-[#b5d6e8] bg-white">
      {[20, 40, 60, 80].map((pct) => {
        const y = (pct / 100) * height;
        return <line key={pct} x1="0" y1={y} x2={width} y2={y} stroke="#e9f2f8" strokeWidth="1" />;
      })}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((col) => {
        const x = (col / 10) * width;
        return <line key={col} x1={x} y1="0" x2={x} y2={height} stroke="#e9f2f8" strokeWidth="1" />;
      })}
      <path d={areaD} fill={fill} />
      <path d={lineD} fill="none" stroke={stroke} strokeWidth="1.6" />
    </svg>
  );
}

export function TaskManagerApp() {
  const windows = useDesktopStore((state) => state.windows);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const wifiEnabled = useDesktopStore((state) => state.wifiEnabled);
  const airplaneMode = useDesktopStore((state) => state.airplaneMode);
  const networkName = useDesktopStore((state) => state.networkName);
  const storageUsedBytes = useFileSystemStore((state) => state.storageUsedBytes);
  const storageQuotaBytes = useFileSystemStore((state) => state.storageQuotaBytes);

  const [activeTab, setActiveTab] = useState<TaskMgrTab>('processes');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [perfMetric, setPerfMetric] = useState<PerfMetric>('cpu');
  const [tick, setTick] = useState(0);
  const [cpuSeries, setCpuSeries] = useState<number[]>(() =>
    Array.from({ length: 30 }, (_, i) => 12 + Math.round(Math.sin(i * 0.4) * 5)),
  );
  const [memSeries, setMemSeries] = useState<number[]>(() =>
    Array.from({ length: 30 }, () => 42),
  );
  const [diskSeries, setDiskSeries] = useState<number[]>(() =>
    Array.from({ length: 30 }, (_, i) => (i % 5 === 0 ? 9 : 3)),
  );
  const [wifiSeries, setWifiSeries] = useState<number[]>(() =>
    Array.from({ length: 30 }, (_, i) => 8 + (i % 4) * 3),
  );
  const [startupApps, setStartupApps] = useState<StartupEntry[]>(INITIAL_STARTUP_APPS);
  const [selectedStartupId, setSelectedStartupId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      const baseCpu = Math.min(92, 6 + windows.filter((w) => !w.isMinimized).length * 4.5 + Math.random() * 8);
      const baseMem = Math.min(94, 34 + windows.length * 3.8 + Math.random() * 1.6);
      const baseDisk = Math.min(85, 2 + Math.random() * 8);
      const baseWifi = wifiEnabled && !airplaneMode ? Math.round(4 + Math.random() * 16) : 0;
      setCpuSeries((prev) => [...prev.slice(1), Math.round(baseCpu)]);
      setMemSeries((prev) => [...prev.slice(1), Math.round(baseMem)]);
      setDiskSeries((prev) => [...prev.slice(1), Math.round(baseDisk)]);
      setWifiSeries((prev) => [...prev.slice(1), baseWifi]);
    }, 1500);
    return () => window.clearInterval(id);
  }, [windows, wifiEnabled, airplaneMode]);

  const processRows = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const mapped = windows
      .map((win, idx) => {
        const jitter = ((tick + idx) % 3) * 0.2;
        const cpu = win.isMinimized ? 0 : Number((((idx + 1) * 0.4) + jitter).toFixed(1));
        const mem = Number((34.2 + ((win.id.length * 17 + idx * 23) % 85) + (win.isMaximized ? 12.4 : 0)).toFixed(1));
        return {
          win,
          status: win.isMinimized ? 'Suspended' : 'Running',
          cpu,
          mem,
        };
      })
      .filter((row) => (!q ? true : row.win.title.toLowerCase().includes(q)));

    mapped.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.win.title.localeCompare(b.win.title);
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortBy === 'cpu') cmp = a.cpu - b.cpu;
      else cmp = a.mem - b.mem;
      return sortAsc ? cmp : -cmp;
    });
    return mapped;
  }, [windows, filterQuery, sortBy, sortAsc, tick]);

  const selectedWindow = windows.find((w) => w.id === selectedId) ?? null;
  const selectedStartup = startupApps.find((s) => s.id === selectedStartupId) ?? null;

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc((v) => !v);
    else {
      setSortBy(key);
      setSortAsc(key === 'name' || key === 'status');
    }
  };

  const latestCpu = cpuSeries[cpuSeries.length - 1] ?? 10;
  const latestMem = memSeries[memSeries.length - 1] ?? 42;
  const latestDisk = diskSeries[diskSeries.length - 1] ?? 3;
  const latestWifi = wifiSeries[wifiSeries.length - 1] ?? 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#ffffff] text-[#1f1f1f] text-[12px] select-none">
      {/* Top Tabs + Search */}
      <div className="flex items-center justify-between border-b border-[#d9d9d9] bg-[#f3f3f3] px-2 pt-1 shrink-0 gap-2">
        <div className="flex items-center gap-0.5">
          {(
            [
              { id: 'processes', label: 'Processes' },
              { id: 'performance', label: 'Performance' },
              { id: 'startup', label: 'Startup' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-[12px] cursor-default border ${
                  active
                    ? 'bg-white border-[#d9d9d9] border-b-white -mb-px font-medium text-[#000000]'
                    : 'border-transparent text-[#555555] hover:bg-[#e8e8e8]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'processes' && (
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter processes..."
            className="h-[22px] w-[150px] mb-1 bg-white border border-[#cccccc] px-2 text-[11.5px] outline-none focus:border-[#0078d7]"
          />
        )}
      </div>

      {/* TAB 1: PROCESSES */}
      {activeTab === 'processes' && (
        <>
          <div className="grid grid-cols-[1fr_90px_90px_90px] border-b border-[#e5e5e5] bg-[#fafafa] px-3 py-1.5 text-[#555555] font-medium shrink-0">
            <button type="button" onClick={() => toggleSort('name')} className="text-left hover:text-black cursor-default">
              Name {sortBy === 'name' ? (sortAsc ? '▴' : '▾') : ''}
            </button>
            <button type="button" onClick={() => toggleSort('status')} className="text-right hover:text-black cursor-default">
              Status {sortBy === 'status' ? (sortAsc ? '▴' : '▾') : ''}
            </button>
            <button type="button" onClick={() => toggleSort('cpu')} className="text-right hover:text-black cursor-default">
              CPU {sortBy === 'cpu' ? (sortAsc ? '▴' : '▾') : ''}
            </button>
            <button type="button" onClick={() => toggleSort('memory')} className="text-right hover:text-black cursor-default">
              Memory {sortBy === 'memory' ? (sortAsc ? '▴' : '▾') : ''}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#f2f2f2]">
            <div className="px-3 py-1 bg-[#f5f5f5] text-[11px] font-semibold text-[#555555]">
              Apps ({processRows.length})
            </div>

            {processRows.length === 0 ? (
              <div className="px-3 py-4 text-[#777777] text-center">No matching apps running</div>
            ) : (
              processRows.map(({ win, status, cpu, mem }) => {
                const isSelected = selectedId === win.id;
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
                    <div className="text-right text-[#555555]">{status}</div>
                    <div className="text-right tabular-nums text-[#333333]">{cpu.toFixed(1)}%</div>
                    <div className="text-right tabular-nums text-[#333333]">{mem.toFixed(1)} MB</div>
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

          <footer className="flex items-center justify-between px-3 py-2 bg-[#f3f3f3] border-t border-[#d9d9d9] shrink-0">
            <span className="text-[#555555]">
              Processes: {windows.length + 3} · CPU: {latestCpu}% · Memory: {latestMem}%
            </span>
            <div className="flex items-center gap-2">
              {selectedWindow && (
                <button
                  type="button"
                  onClick={() => focusWindow(selectedWindow.id)}
                  className="px-3 py-1 border bg-[#e1e1e1] hover:bg-[#e5f1fb] border-[#adadad] hover:border-[#0078d7] text-[12px] cursor-default"
                >
                  Switch to
                </button>
              )}
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
            </div>
          </footer>
        </>
      )}

      {/* TAB 2: PERFORMANCE */}
      {activeTab === 'performance' && (
        <div className="flex-1 min-h-0 flex">
          <aside className="w-[180px] shrink-0 border-r border-[#e0e0e0] bg-[#fafafa] p-2 space-y-1 overflow-y-auto">
            {(
              [
                { id: 'cpu', title: 'CPU', sub: `${latestCpu}% · 3.60 GHz` },
                { id: 'memory', title: 'Memory', sub: `${((latestMem / 100) * 16).toFixed(1)}/16.0 GB (${latestMem}%)` },
                { id: 'disk', title: 'Disk 0 (C:)', sub: `Virtual SSD · ${latestDisk}%` },
                { id: 'wifi', title: 'Wi-Fi', sub: wifiEnabled && !airplaneMode ? `${latestWifi} Kbps` : 'Disconnected' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPerfMetric(item.id)}
                className={`w-full text-left px-2.5 py-2 border cursor-default ${
                  perfMetric === item.id
                    ? 'bg-[#e5f3ff] border-[#99d1ff]'
                    : 'bg-transparent border-transparent hover:bg-[#efefef]'
                }`}
              >
                <div className="font-semibold text-[12.5px]">{item.title}</div>
                <div className="text-[11px] text-[#666666] truncate">{item.sub}</div>
              </button>
            ))}
          </aside>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {perfMetric === 'cpu' && (
              <>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[18px] font-light">CPU</h2>
                  <span className="text-[12px] text-[#555]">Virtual x64 4-Core Processor</span>
                </div>
                <SparkChart data={cpuSeries} stroke="#117dbb" fill="rgba(17,125,187,0.14)" />
                <div className="grid grid-cols-3 gap-4 pt-1 text-[12px]">
                  <div><div className="text-[#666] text-[11px]">Utilization</div><div className="text-[16px] font-light tabular-nums">{latestCpu}%</div></div>
                  <div><div className="text-[#666] text-[11px]">Speed</div><div className="text-[16px] font-light">3.60 GHz</div></div>
                  <div><div className="text-[#666] text-[11px]">Processes</div><div className="text-[16px] font-light tabular-nums">{windows.length + 3}</div></div>
                </div>
              </>
            )}

            {perfMetric === 'memory' && (
              <>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[18px] font-light">Memory</h2>
                  <span className="text-[12px] text-[#555]">16.0 GB DDR4</span>
                </div>
                <SparkChart data={memSeries} stroke="#8b12ae" fill="rgba(139,18,174,0.13)" />
                <div className="grid grid-cols-3 gap-4 pt-1 text-[12px]">
                  <div><div className="text-[#666] text-[11px]">In use</div><div className="text-[16px] font-light tabular-nums">{((latestMem / 100) * 16).toFixed(1)} GB</div></div>
                  <div><div className="text-[#666] text-[11px]">Available</div><div className="text-[16px] font-light tabular-nums">{(16 - (latestMem / 100) * 16).toFixed(1)} GB</div></div>
                  <div><div className="text-[#666] text-[11px]">Committed</div><div className="text-[16px] font-light">{latestMem}%</div></div>
                </div>
              </>
            )}

            {perfMetric === 'disk' && (
              <>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[18px] font-light">Disk 0 (C:)</h2>
                  <span className="text-[12px] text-[#555]">IndexedDB Virtual Volume</span>
                </div>
                <SparkChart data={diskSeries} stroke="#36802d" fill="rgba(54,128,45,0.13)" />
                <div className="grid grid-cols-3 gap-4 pt-1 text-[12px]">
                  <div><div className="text-[#666] text-[11px]">Active time</div><div className="text-[16px] font-light tabular-nums">{latestDisk}%</div></div>
                  <div><div className="text-[#666] text-[11px]">Used storage</div><div className="text-[16px] font-light">{formatStorageBytes(storageUsedBytes)}</div></div>
                  <div><div className="text-[#666] text-[11px]">Quota</div><div className="text-[16px] font-light">{formatStorageBytes(storageQuotaBytes)}</div></div>
                </div>
              </>
            )}

            {perfMetric === 'wifi' && (
              <>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[18px] font-light">Wi-Fi</h2>
                  <span className="text-[12px] text-[#555]">{wifiEnabled && !airplaneMode ? networkName : 'Offline'}</span>
                </div>
                <SparkChart data={wifiSeries} stroke="#9a5e00" fill="rgba(154,94,0,0.12)" />
                <div className="grid grid-cols-2 gap-4 pt-1 text-[12px]">
                  <div><div className="text-[#666] text-[11px]">Status</div><div className="text-[16px] font-light">{wifiEnabled && !airplaneMode ? 'Connected' : 'Disconnected'}</div></div>
                  <div><div className="text-[#666] text-[11px]">Throughput</div><div className="text-[16px] font-light tabular-nums">{latestWifi} Kbps</div></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STARTUP */}
      {activeTab === 'startup' && (
        <>
          <div className="grid grid-cols-[1fr_140px_85px_95px] border-b border-[#e5e5e5] bg-[#fafafa] px-3 py-1.5 text-[#555555] font-medium shrink-0">
            <div>Name</div>
            <div>Publisher</div>
            <div>Status</div>
            <div className="text-right">Startup impact</div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#f2f2f2]">
            {startupApps.map((entry) => {
              const isSelected = selectedStartupId === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedStartupId(entry.id)}
                  className={`w-full grid grid-cols-[1fr_140px_85px_95px] items-center px-3 py-2 text-left cursor-default ${
                    isSelected ? 'bg-[#cce8ff]' : 'hover:bg-[#e5f3ff]'
                  }`}
                >
                  <span className="truncate font-medium text-[#1a1a1a]">{entry.name}</span>
                  <span className="truncate text-[#555]">{entry.publisher}</span>
                  <span className={entry.enabled ? 'text-[#107c10]' : 'text-[#777]'}>
                    {entry.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className="text-right text-[#555]">{entry.impact}</span>
                </button>
              );
            })}
          </div>
          <footer className="flex items-center justify-between px-3 py-2 bg-[#f3f3f3] border-t border-[#d9d9d9] shrink-0">
            <span className="text-[#555555]">
              {startupApps.filter((s) => s.enabled).length} of {startupApps.length} startup items enabled
            </span>
            <button
              type="button"
              disabled={!selectedStartup}
              onClick={() => {
                if (!selectedStartup) return;
                setStartupApps((prev) =>
                  prev.map((item) =>
                    item.id === selectedStartup.id ? { ...item, enabled: !item.enabled } : item,
                  ),
                );
              }}
              className={`px-4 py-1 border text-[12px] cursor-default ${
                selectedStartup
                  ? 'bg-[#e1e1e1] hover:bg-[#e5f1fb] border-[#adadad] hover:border-[#0078d7] text-black'
                  : 'bg-[#f0f0f0] border-[#d0d0d0] text-[#999999]'
              }`}
            >
              {selectedStartup?.enabled ? 'Disable' : 'Enable'}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
