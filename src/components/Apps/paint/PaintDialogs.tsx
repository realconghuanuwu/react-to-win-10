import { useEffect, useMemo, useRef, useState } from 'react';
import { getFileTypeInfo } from '../../../utils/fileTypes';
import { useFileSystemStore, type FsNode } from '../../../store/useFileSystemStore';
import { clamp, hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from './paintDrawing';

interface ResizeSkewDialogProps {
  width: number;
  height: number;
  onApply: (nextW: number, nextH: number, skewH: number, skewV: number) => void;
  onClose: () => void;
}

export function ResizeSkewDialog({ width, height, onApply, onClose }: ResizeSkewDialogProps) {
  const [unit, setUnit] = useState<'percent' | 'pixels'>('percent');
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [hVal, setHVal] = useState('100');
  const [vVal, setVVal] = useState('100');
  const [skewH, setSkewH] = useState('0');
  const [skewV, setSkewV] = useState('0');

  const aspect = width / Math.max(1, height);

  const handleUnitChange = (nextUnit: 'percent' | 'pixels') => {
    if (nextUnit === unit) return;
    if (nextUnit === 'pixels') {
      const pctH = clamp(Number(hVal) || 100, 1, 500);
      const pctV = clamp(Number(vVal) || 100, 1, 500);
      setHVal(String(Math.max(1, Math.round((width * pctH) / 100))));
      setVVal(String(Math.max(1, Math.round((height * pctV) / 100))));
    } else {
      const pxH = clamp(Number(hVal) || width, 1, 8000);
      const pxV = clamp(Number(vVal) || height, 1, 8000);
      setHVal(String(Math.max(1, Math.round((pxH / Math.max(1, width)) * 100))));
      setVVal(String(Math.max(1, Math.round((pxV / Math.max(1, height)) * 100))));
    }
    setUnit(nextUnit);
  };

  const handleHChange = (val: string) => {
    setHVal(val);
    const num = Number(val);
    if (!maintainAspect || !Number.isFinite(num) || num <= 0) return;
    if (unit === 'percent') {
      setVVal(String(Math.round(num)));
    } else {
      setVVal(String(Math.max(1, Math.round(num / aspect))));
    }
  };

  const handleVChange = (val: string) => {
    setVVal(val);
    const num = Number(val);
    if (!maintainAspect || !Number.isFinite(num) || num <= 0) return;
    if (unit === 'percent') {
      setHVal(String(Math.round(num)));
    } else {
      setHVal(String(Math.max(1, Math.round(num * aspect))));
    }
  };

  const handleSubmit = () => {
    const nh = Number(hVal);
    const nv = Number(vVal);
    const nextW =
      unit === 'percent'
        ? clamp(Math.round((width * (Number.isFinite(nh) && nh > 0 ? nh : 100)) / 100), 1, 4096)
        : clamp(Math.round(Number.isFinite(nh) && nh > 0 ? nh : width), 1, 4096);
    const nextH =
      unit === 'percent'
        ? clamp(Math.round((height * (Number.isFinite(nv) && nv > 0 ? nv : 100)) / 100), 1, 4096)
        : clamp(Math.round(Number.isFinite(nv) && nv > 0 ? nv : height), 1, 4096);
    const sh = clamp(Number(skewH) || 0, -60, 60);
    const sv = clamp(Number(skewV) || 0, -60, 60);
    onApply(nextW, nextH, sh, sv);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
      <div className="w-[330px] bg-[#f0f0f0] border border-[#707070] shadow-xl text-[#1e1e1e] text-[12px]">
        <div className="flex items-center justify-between bg-white px-3 py-1.5 border-b border-[#dadbdc]">
          <span>Resize and Skew</span>
          <button type="button" onClick={onClose} className="px-1.5 hover:bg-[#e81123] hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-3 space-y-3">
          <fieldset className="border border-[#cfcfcf] p-2.5 space-y-2">
            <legend className="px-1 text-[#333]">Resize</legend>
            <div className="flex items-center gap-4">
              <span className="w-16 text-[#444]">By:</span>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={unit === 'percent'}
                  onChange={() => handleUnitChange('percent')}
                />
                Percentage
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={unit === 'pixels'}
                  onChange={() => handleUnitChange('pixels')}
                />
                Pixels
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[#444]">Horizontal:</span>
              <input
                type="number"
                value={hVal}
                onChange={(e) => handleHChange(e.target.value)}
                className="w-24 bg-white border border-[#999] px-1.5 py-0.5 text-[12px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[#444]">Vertical:</span>
              <input
                type="number"
                value={vVal}
                onChange={(e) => handleVChange(e.target.value)}
                className="w-24 bg-white border border-[#999] px-1.5 py-0.5 text-[12px]"
              />
            </div>
            <label className="flex items-center gap-2 pt-0.5">
              <input
                type="checkbox"
                checked={maintainAspect}
                onChange={(e) => setMaintainAspect(e.target.checked)}
              />
              Maintain aspect ratio
            </label>
          </fieldset>

          <fieldset className="border border-[#cfcfcf] p-2.5 space-y-2">
            <legend className="px-1 text-[#333]">Skew (Degrees)</legend>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[#444]">Horizontal:</span>
              <input
                type="number"
                value={skewH}
                onChange={(e) => setSkewH(e.target.value)}
                className="w-24 bg-white border border-[#999] px-1.5 py-0.5 text-[12px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[#444]">Vertical:</span>
              <input
                type="number"
                value={skewV}
                onChange={(e) => setSkewV(e.target.value)}
                className="w-24 bg-white border border-[#999] px-1.5 py-0.5 text-[12px]"
              />
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-1 bg-[#e1e1e1] border border-[#0078d7] hover:bg-[#e5f1fb]"
            >
              OK
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-[#e5f1fb]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditColorsDialogProps {
  initialColor: string;
  customColors: (string | null)[];
  onSelectColor: (hex: string) => void;
  onAddCustomColor: (hex: string) => void;
  onClose: () => void;
}

export function EditColorsDialog({
  initialColor,
  customColors,
  onSelectColor,
  onAddCustomColor,
  onClose,
}: EditColorsDialogProps) {
  const initRgb = hexToRgb(initialColor);
  const initHsv = rgbToHsv(initRgb.r, initRgb.g, initRgb.b);
  const [hsv, setHsv] = useState(initHsv);
  const spectrumRef = useRef<HTMLCanvasElement | null>(null);

  const currentRgb = useMemo(() => hsvToRgb(hsv.h, hsv.s, hsv.v), [hsv]);
  const currentHex = useMemo(
    () => rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b),
    [currentRgb],
  );

  useEffect(() => {
    const canvas = spectrumRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const sat = 1 - y / (h - 1);
      for (let x = 0; x < w; x++) {
        const hue = (x / (w - 1)) * 360;
        const { r, g, b } = hsvToRgb(hue, sat, 1);
        const idx = (y * w + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  const pickSpectrum = (clientX: number, clientY: number) => {
    const canvas = spectrumRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = clamp((clientX - rect.left) / rect.width, 0, 1);
    const ny = clamp((clientY - rect.top) / rect.height, 0, 1);
    setHsv((prev) => ({ ...prev, h: nx * 360, s: 1 - ny }));
  };

  const updateRgbField = (channel: 'r' | 'g' | 'b', val: string) => {
    const next = clamp(Number(val) || 0, 0, 255);
    const updated = { ...currentRgb, [channel]: next };
    setHsv(rgbToHsv(updated.r, updated.g, updated.b));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
      <div className="w-[460px] bg-[#f0f0f0] border border-[#707070] shadow-xl text-[#1e1e1e] text-[12px]">
        <div className="flex items-center justify-between bg-white px-3 py-1.5 border-b border-[#dadbdc]">
          <span>Edit Colors</span>
          <button type="button" onClick={onClose} className="px-1.5 hover:bg-[#e81123] hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="flex gap-3">
            <div className="relative w-[220px] h-[180px] border border-[#888] shrink-0">
              <canvas
                ref={spectrumRef}
                width={220}
                height={180}
                onPointerDown={(e) => {
                  pickSpectrum(e.clientX, e.clientY);
                  const onMove = (ev: PointerEvent) => pickSpectrum(ev.clientX, ev.clientY);
                  const onUp = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                  };
                  window.addEventListener('pointermove', onMove);
                  window.addEventListener('pointerup', onUp);
                }}
                className="w-full h-full cursor-crosshair block"
              />
              <div
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  top: `${(1 - hsv.s) * 100}%`,
                }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 border-2 border-black shadow-[0_0_0_1px_white]"
              />
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="text-[11px] mb-1">Brightness</div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(hsv.v * 100)}
                  onChange={(e) => setHsv((prev) => ({ ...prev, v: Number(e.target.value) / 100 }))}
                  className="w-full accent-[#0078d7]"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <div
                    style={{ backgroundColor: currentHex }}
                    className="w-16 h-12 border border-[#777]"
                  />
                  <div className="text-[11px] text-center font-mono">{currentHex}</div>
                </div>
                <div className="space-y-1.5 flex-1">
                  {(['r', 'g', 'b'] as const).map((ch) => (
                    <div key={ch} className="flex items-center justify-between gap-2">
                      <span className="uppercase text-[#444]">{ch === 'r' ? 'Red' : ch === 'g' ? 'Green' : 'Blue'}:</span>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={currentRgb[ch]}
                        onChange={(e) => updateRgbField(ch, e.target.value)}
                        className="w-16 bg-white border border-[#999] px-1 py-0.5"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onAddCustomColor(currentHex)}
                className="w-full py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-[#e5f1fb]"
              >
                Add to Custom Colors
              </button>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-[#444] mb-1">Custom colors:</div>
            <div className="flex gap-1.5">
              {customColors.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (c) {
                      const rgb = hexToRgb(c);
                      setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
                    }
                  }}
                  style={{ backgroundColor: c ?? '#ffffff' }}
                  className="w-6 h-5 border border-[#888]"
                  title={c ?? 'Empty'}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onSelectColor(currentHex);
                onClose();
              }}
              className="px-5 py-1 bg-[#e1e1e1] border border-[#0078d7] hover:bg-[#e5f1fb]"
            >
              OK
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-[#e5f1fb]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type ImageSaveFormat = 'png' | 'jpeg' | 'bmp' | 'webp';

interface PaintFileDialogProps {
  mode: 'open' | 'saveAs';
  initialFolderId: string;
  initialFileName: string;
  onConfirmOpen: (file: FsNode) => void;
  onConfirmSaveAs: (folderId: string, fileName: string, format: ImageSaveFormat) => void;
  onImportFromPc: () => void;
  onDownloadToPc: (fileName: string, format: ImageSaveFormat) => void;
  onClose: () => void;
}

export function PaintFileDialog({
  mode,
  initialFolderId,
  initialFileName,
  onConfirmOpen,
  onConfirmSaveAs,
  onImportFromPc,
  onDownloadToPc,
  onClose,
}: PaintFileDialogProps) {
  const nodes = useFileSystemStore((state) => state.nodes);
  const [folderId, setFolderId] = useState(
    nodes[initialFolderId] ? initialFolderId : 'pictures',
  );
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState(initialFileName);
  const [format, setFormat] = useState<ImageSaveFormat>('png');

  const writableFolders = useMemo(
    () =>
      Object.values(nodes)
        .filter((n) => n.kind === 'folder' || n.kind === 'drive')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [nodes],
  );

  const filesInFolder = useMemo(
    () =>
      Object.values(nodes)
        .filter((n) => {
          if (n.parentId !== folderId || n.kind !== 'file') return false;
          return getFileTypeInfo(n).category === 'image';
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [nodes, folderId],
  );

  const ensureExt = (raw: string, fmt: ImageSaveFormat) => {
    const clean = raw.trim() || 'Untitled';
    const base = clean.replace(/\.(png|jpe?g|bmp|webp|gif)$/i, '');
    return `${base}.${fmt === 'jpeg' ? 'jpg' : fmt}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[480px] max-w-[92vw] bg-[#f0f0f0] border border-[#707070] shadow-xl text-[#1e1e1e] text-[12px]">
        <div className="flex items-center justify-between bg-white px-3 py-1.5 border-b border-[#dadbdc]">
          <span>{mode === 'open' ? 'Open' : 'Save As'}</span>
          <button type="button" onClick={onClose} className="px-1.5 hover:bg-[#e81123] hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[#444] shrink-0">Folder:</span>
            <select
              value={folderId}
              onChange={(e) => {
                setFolderId(e.target.value);
                setSelectedFileId(null);
              }}
              className="flex-1 bg-white border border-[#999] px-2 py-1"
            >
              {writableFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-[170px] bg-white border border-[#999] overflow-y-auto p-1">
            {filesInFolder.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#777]">
                No image files in this folder
              </div>
            ) : (
              filesInFolder.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    setSelectedFileId(file.id);
                    setFileName(file.name);
                  }}
                  onDoubleClick={() => {
                    if (mode === 'open') onConfirmOpen(file);
                    else onConfirmSaveAs(folderId, ensureExt(file.name, format), format);
                  }}
                  className={[
                    'w-full flex items-center gap-2 px-2 py-1 text-left',
                    selectedFileId === file.id ? 'bg-[#cce8ff] border border-[#99d1ff]' : 'hover:bg-[#e5f3ff]',
                  ].join(' ')}
                >
                  <img src={file.icon} alt="" className="w-4 h-4 object-contain shrink-0" />
                  <span className="truncate">{file.name}</span>
                </button>
              ))
            )}
          </div>

          {mode === 'saveAs' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-20 text-[#444]">File name:</span>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="flex-1 bg-white border border-[#999] px-2 py-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 text-[#444]">Save as type:</span>
                <select
                  value={format}
                  onChange={(e) => {
                    const nextFmt = e.target.value as ImageSaveFormat;
                    setFormat(nextFmt);
                    setFileName((prev) => ensureExt(prev, nextFmt));
                  }}
                  className="flex-1 bg-white border border-[#999] px-2 py-1"
                >
                  <option value="png">PNG (*.png)</option>
                  <option value="jpeg">JPEG (*.jpg)</option>
                  <option value="bmp">24-bit Bitmap (*.bmp)</option>
                  <option value="webp">WebP (*.webp)</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {mode === 'open' ? (
              <button
                type="button"
                onClick={onImportFromPc}
                className="px-3 py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-[#e5f1fb]"
              >
                Import from Computer...
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onDownloadToPc(ensureExt(fileName, format), format)}
                className="px-3 py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-[#e5f1fb]"
              >
                Download to Computer
              </button>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (mode === 'open') {
                    const chosen = filesInFolder.find((f) => f.id === selectedFileId);
                    if (chosen) onConfirmOpen(chosen);
                  } else {
                    onConfirmSaveAs(folderId, ensureExt(fileName, format), format);
                  }
                }}
                disabled={mode === 'open' && !selectedFileId}
                className="px-5 py-1 bg-[#e1e1e1] border border-[#0078d7] hover:bg-[#e5f1fb] disabled:opacity-50"
              >
                {mode === 'open' ? 'Open' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-[#e5f1fb]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ImagePropertiesDialogProps {
  width: number;
  height: number;
  onApply: (nextW: number, nextH: number) => void;
  onClose: () => void;
}

export function ImagePropertiesDialog({ width, height, onApply, onClose }: ImagePropertiesDialogProps) {
  const [wStr, setWStr] = useState(String(width));
  const [hStr, setHStr] = useState(String(height));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
      <div className="w-[320px] bg-[#f0f0f0] border border-[#707070] shadow-xl text-[#1e1e1e] text-[12px]">
        <div className="flex items-center justify-between bg-white px-3 py-1.5 border-b border-[#dadbdc]">
          <span>Image Properties</span>
          <button type="button" onClick={onClose} className="px-1.5 hover:bg-[#e81123] hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="text-[11px] text-[#555]">Units: Pixels · Colors: Full Color (RGBA)</div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5">
              <span>Width:</span>
              <input
                type="number"
                min={1}
                max={4096}
                value={wStr}
                onChange={(e) => setWStr(e.target.value)}
                className="w-20 bg-white border border-[#999] px-1.5 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span>Height:</span>
              <input
                type="number"
                min={1}
                max={4096}
                value={hStr}
                onChange={(e) => setHStr(e.target.value)}
                className="w-20 bg-white border border-[#999] px-1.5 py-0.5"
              />
            </label>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button
              type="button"
              onClick={() => {
                setWStr('800');
                setHStr('500');
              }}
              className="px-3 py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-[#e5f1fb]"
            >
              Default
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  onApply(
                    clamp(Math.round(Number(wStr) || width), 1, 4096),
                    clamp(Math.round(Number(hStr) || height), 1, 4096),
                  )
                }
                className="px-5 py-1 bg-[#e1e1e1] border border-[#0078d7] hover:bg-[#e5f1fb]"
              >
                OK
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-[#e5f1fb]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
