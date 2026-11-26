import { useEffect, useState } from 'react';
import { SetDocZoomRatioCommand } from '@univerjs/preset-docs-core';
import type { createUniver } from '@univerjs/presets';

type UniverAPI = ReturnType<typeof createUniver>['univerAPI'];

interface OfficeBackstageProps {
  mode: 'word' | 'excel';
  documentTitle: string;
  saving: boolean;
  exporting: boolean;
  onClose: () => void;
  onBackHome: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSaveToWin10: () => void;
  onSaveToLocal: () => void;
  onSwitchApp: () => void;
  onStatus: (msg: string) => void;
}

export function OfficeBackstageOverlay({
  mode,
  documentTitle,
  saving,
  exporting,
  onClose,
  onBackHome,
  onNew,
  onOpen,
  onSaveToWin10,
  onSaveToLocal,
  onSwitchApp,
  onStatus,
}: OfficeBackstageProps) {
  const isWord = mode === 'word';
  const brand = isWord ? '#2b579a' : '#217346';
  const hoverBg = isWord ? 'hover:bg-[#1e3f73]' : 'hover:bg-[#165231]';
  const ext = isWord ? '.docx' : '.xlsx';
  const winExt = isWord ? '.unidoc' : '.unisheet';
  const appName = isWord ? 'Word' : 'Excel';
  const [section, setSection] = useState<'info' | 'print'>('info');

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const navBtn =
    `w-full text-left px-5 py-2.5 text-[13px] text-white/95 ${hoverBg} transition-colors cursor-default flex items-center justify-between`;

  return (
    <div
      role="dialog"
      aria-label={`${appName} File Backstage`}
      className="absolute inset-0 z-50 flex bg-[#f3f2f1] text-[#262626] select-none"
    >
      {/* Left Brand Rail */}
      <aside style={{ backgroundColor: brand }} className="w-[180px] shrink-0 text-white flex flex-col py-3">
        <button
          type="button"
          onClick={onClose}
          className={`mx-4 mb-3 w-8 h-8 rounded-full border border-white/50 flex items-center justify-center ${hoverBg} cursor-default`}
          title="Back to document"
        >
          ←
        </button>
        <button type="button" onClick={() => { onBackHome(); onClose(); }} className={navBtn}>
          <span>Home</span>
        </button>
        <button type="button" onClick={() => { onNew(); onClose(); }} className={navBtn}>
          <span>New</span>
        </button>
        <button type="button" onClick={() => { onOpen(); onClose(); }} className={navBtn}>
          <span>Open</span>
        </button>
        <div className="my-2 border-t border-white/20 mx-4" />
        <button
          type="button"
          onClick={() => setSection('info')}
          className={`${navBtn} ${section === 'info' ? 'bg-black/20 font-semibold' : ''}`}
        >
          <span>Info</span>
        </button>
        <button type="button" onClick={() => { onSaveToWin10(); onClose(); }} className={navBtn}>
          <span>{saving ? 'Saving…' : 'Save'}</span>
          <span className="text-[10px] text-white/75">{winExt}</span>
        </button>
        <button type="button" onClick={() => { onSaveToLocal(); onClose(); }} className={navBtn}>
          <span>{exporting ? 'Exporting…' : `Export ${ext}`}</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('print')}
          className={`${navBtn} ${section === 'print' ? 'bg-black/20 font-semibold' : ''}`}
        >
          <span>Print</span>
        </button>
        <div className="mt-auto border-t border-white/20 mx-4 pt-2">
          <button type="button" onClick={() => { onSwitchApp(); onClose(); }} className={navBtn}>
            <span>Switch to {isWord ? 'Excel' : 'Word'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-[#f3f2f1]">
        {section === 'info' ? (
          <div className="max-w-[600px] space-y-5">
            <h2 className="text-[24px] font-light text-[#262626]">Info</h2>
            <div className="bg-white border border-[#d2d0ce] p-5 space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-[#eeeeee]">
                <img src={isWord ? '/assets/icons/word.svg' : '/assets/icons/excel.svg'} alt="" className="w-9 h-9 object-contain" />
                <div>
                  <div className="text-[16px] font-semibold">{documentTitle}</div>
                  <div className="text-[12px] text-[#605e5c]">Microsoft {appName} Document</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-[12.5px]">
                <span className="text-[#605e5c]">Win 10 Format:</span>
                <span>{winExt} (Saved in Documents)</span>
                <span className="text-[#605e5c]">Standard Export:</span>
                <span>{ext} (PC Download)</span>
                <span className="text-[#605e5c]">Author:</span>
                <span>User</span>
              </div>
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { onSaveToWin10(); onClose(); }}
                  style={{ backgroundColor: brand }}
                  className="px-4 py-1.5 text-[12.5px] text-white hover:brightness-110 cursor-default"
                >
                  Save to Win 10
                </button>
                <button
                  type="button"
                  onClick={() => { onSaveToLocal(); onClose(); }}
                  className="px-4 py-1.5 bg-white border border-[#c8c6c4] hover:bg-[#edebe9] text-[12.5px] cursor-default"
                >
                  Download {ext}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-[520px] space-y-4">
            <h2 className="text-[24px] font-light text-[#262626]">Print</h2>
            <div className="bg-white border border-[#d2d0ce] p-5 space-y-3 text-[13px]">
              <p className="text-[#605e5c]">
                Print preview &amp; system print dialog for <strong>{documentTitle}</strong>.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStatus('Opening browser print dialog…');
                    window.setTimeout(() => window.print(), 100);
                  }}
                  style={{ backgroundColor: brand }}
                  className="px-5 py-2 text-white text-[13px] cursor-default"
                >
                  🖨 Print
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white border border-[#c8c6c4] hover:bg-[#edebe9] text-[13px] cursor-default"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface OfficeStatusBarProps {
  mode: 'word' | 'excel';
  univerApi: UniverAPI | null;
  onStatus: (msg: string) => void;
}

export function OfficeStatusBar({ mode, univerApi, onStatus }: OfficeStatusBarProps) {
  const isWord = mode === 'word';
  const [zoomPct, setZoomPct] = useState(100);
  const [viewMode, setViewMode] = useState<string>(isWord ? 'print' : 'normal');
  const [wordStats, setWordStats] = useState<{ words: number; paras: number }>({ words: 0, paras: 1 });
  const [excelStats, setExcelStats] = useState<{ count: number; sum: number; avg: number } | null>(null);

  useEffect(() => {
    if (!univerApi) return;
    const refresh = () => {
      try {
        if (isWord) {
          const doc = univerApi.getActiveDocument();
          if (!doc) return;
          const paras = doc.getParagraphs();
          const text = paras.map((p) => p.getText()).join(' ').trim();
          const words = text ? text.split(/\s+/).length : 0;
          setWordStats({ words, paras: Math.max(1, paras.length) });
        } else {
          const sheet = univerApi.getActiveWorkbook()?.getActiveSheet();
          const vals = sheet?.getActiveRange()?.getValues() ?? [];
          const nums: number[] = [];
          let nonEmpty = 0;
          for (const row of vals) {
            for (const v of row) {
              if (v !== null && v !== undefined && v !== '') {
                nonEmpty += 1;
                if (typeof v === 'number' && Number.isFinite(v)) nums.push(v);
              }
            }
          }
          if (nonEmpty > 1 && nums.length > 0) {
            const sum = nums.reduce((a, b) => a + b, 0);
            setExcelStats({ count: nonEmpty, sum, avg: sum / nums.length });
          } else {
            setExcelStats(null);
          }
        }
      } catch {
        // ignore during mount/dispose
      }
    };

    refresh();
    const id = window.setInterval(refresh, 900);
    return () => window.clearInterval(id);
  }, [univerApi, isWord]);

  const applyZoom = (nextPct: number) => {
    const clamped = Math.max(50, Math.min(200, Math.round(nextPct)));
    setZoomPct(clamped);
    if (!univerApi) return;
    try {
      if (isWord) {
        void univerApi.executeCommand(SetDocZoomRatioCommand.id, { zoomRatio: clamped / 100 });
      } else {
        const sheet = univerApi.getActiveWorkbook()?.getActiveSheet();
        sheet?.zoom(clamped / 100);
      }
    } catch {
      // ignore if command unsupported
    }
  };

  return (
    <footer className="h-[24px] bg-[#f3f2f1] border-t border-[#d2d0ce] px-3 flex items-center justify-between text-[11px] text-[#444444] shrink-0 select-none">
      {/* Left Info */}
      <div className="flex items-center gap-3 min-w-0">
        {isWord ? (
          <>
            <span>Page 1 of {Math.max(1, Math.ceil(wordStats.paras / 25))}</span>
            <span className="border-l border-[#d2d0ce] pl-3 tabular-nums">{wordStats.words} words</span>
            <span className="hidden sm:inline border-l border-[#d2d0ce] pl-3">English (United States)</span>
          </>
        ) : (
          <>
            <span>Ready</span>
            {excelStats && (
              <span className="hidden sm:flex items-center gap-3 border-l border-[#d2d0ce] pl-3 tabular-nums">
                <span>Average: {excelStats.avg.toFixed(2)}</span>
                <span>Count: {excelStats.count}</span>
                <span>Sum: {excelStats.sum}</span>
              </span>
            )}
          </>
        )}
      </div>

      {/* Right View Modes + Zoom Slider */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center border-r border-[#d2d0ce] pr-2 gap-0.5">
          {(isWord
            ? [
                { id: 'read', label: 'Read', title: 'Read Mode' },
                { id: 'print', label: 'Print', title: 'Print Layout' },
                { id: 'web', label: 'Web', title: 'Web Layout' },
              ]
            : [
                { id: 'normal', label: 'Normal', title: 'Normal View' },
                { id: 'page', label: 'Page', title: 'Page Layout' },
                { id: 'break', label: 'Breaks', title: 'Page Break Preview' },
              ]
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              title={v.title}
              onClick={() => {
                setViewMode(v.id);
                onStatus(`View: ${v.title}`);
              }}
              className={`px-1.5 py-0.5 text-[10.5px] cursor-default ${
                viewMode === v.id ? 'bg-[#dedcd9] text-black font-medium' : 'hover:bg-[#e1dfdd]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          title="Zoom out"
          onClick={() => applyZoom(zoomPct - 10)}
          className="px-1 hover:bg-[#e1dfdd] cursor-default"
        >
          −
        </button>
        <input
          type="range"
          min={50}
          max={200}
          step={10}
          value={zoomPct}
          aria-label="Document zoom"
          onChange={(e) => applyZoom(Number(e.target.value))}
          className="w-[82px] h-1 cursor-pointer accent-[#2b579a]"
        />
        <button
          type="button"
          title="Zoom in"
          onClick={() => applyZoom(zoomPct + 10)}
          className="px-1 hover:bg-[#e1dfdd] cursor-default"
        >
          +
        </button>
        <button
          type="button"
          title="Reset zoom to 100%"
          onClick={() => applyZoom(100)}
          className="w-9 text-right tabular-nums hover:bg-[#e1dfdd] px-1 cursor-default"
        >
          {zoomPct}%
        </button>
      </div>
    </footer>
  );
}
