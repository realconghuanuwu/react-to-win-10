import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { DESKTOP_APPS } from '../../data/desktopApps';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import { notify } from '../../store/useNotificationStore';

interface SnipAppProps {
  windowId: string;
}

type SnipTool = 'pen' | 'highlighter' | 'eraser';

const PEN_COLORS = ['#e81123', '#0078d7', '#107c10', '#ffb900', '#111111', '#ffffff'];

async function loadImageEl(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderVirtualDesktopCanvas(): Promise<HTMLCanvasElement> {
  const vw = Math.max(800, window.innerWidth);
  const vh = Math.max(500, window.innerHeight);
  const canvas = document.createElement('canvas');
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const state = useDesktopStore.getState();
  const { personalizationSettings, windows, activeDesktopId, iconPositions, iconSize, apps, shortcutLabels } = state;

  ctx.fillStyle = personalizationSettings.solidColor || '#0078d7';
  ctx.fillRect(0, 0, vw, vh);

  if (personalizationSettings.backgroundType === 'picture' && personalizationSettings.wallpaper) {
    const bgImg = await loadImageEl(personalizationSettings.wallpaper);
    if (bgImg) {
      const ratio = Math.max(vw / bgImg.width, vh / bgImg.height);
      const dw = bgImg.width * ratio;
      const dh = bgImg.height * ratio;
      ctx.drawImage(bgImg, (vw - dw) / 2, (vh - dh) / 2, dw, dh);
    }
  }

  // Draw desktop icons
  const stepW = iconSize === 'large' ? 94 : iconSize === 'small' ? 76 : 82;
  const stepH = iconSize === 'large' ? 98 : iconSize === 'small' ? 68 : 80;
  for (const app of apps.filter((a) => a.showOnDesktop !== false)) {
    const slot = iconPositions[app.id];
    if (!slot) continue;
    const x = 8 + slot.col * stepW;
    const y = 8 + slot.row * stepH;
    const iconImg = await loadImageEl(app.icon);
    if (iconImg) {
      ctx.drawImage(iconImg, x + stepW / 2 - 18, y + 6, 36, 36);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    const label = shortcutLabels[app.id] ?? app.name;
    ctx.fillText(label.slice(0, 14), x + stepW / 2 + 1, y + 57);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label.slice(0, 14), x + stepW / 2, y + 56);
  }

  // Draw open windows sorted by zIndex
  const visibleWins = windows
    .filter((w) => w.desktopId === activeDesktopId && !w.isMinimized)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const win of visibleWins) {
    const wx = win.isMaximized ? 0 : win.x;
    const wy = win.isMaximized ? 0 : win.y;
    const ww = win.isMaximized ? vw : win.width;
    const wh = win.isMaximized ? vh - 40 : win.height;
    ctx.fillStyle = '#f3f2f1';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(wx, wy, ww, 32);
    ctx.fillStyle = '#1f1f1f';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(win.title, wx + 12, wy + 20);
  }

  // Draw Taskbar
  ctx.fillStyle = 'rgba(20, 20, 20, 0.92)';
  ctx.fillRect(0, vh - 40, vw, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  ctx.fillText(nowStr, vw - 16, vh - 15);

  return canvas;
}

export function SnipApp({ windowId }: SnipAppProps) {
  const importHostFiles = useFileSystemStore((state) => state.importHostFiles);
  const openPhotoFile = useDesktopStore((state) => state.openPhotoFile);
  const setWindowTitle = useDesktopStore((state) => state.setWindowTitle);
  const accentColor = useDesktopStore((state) => state.personalizationSettings.accentColor);

  const [tool, setTool] = useState<SnipTool>('pen');
  const [color, setColor] = useState('#e81123');
  const [strokeSize, setStrokeSize] = useState(4);
  const [hasCapture, setHasCapture] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [desktopBackdropUrl, setDesktopBackdropUrl] = useState<string | null>(null);
  const [dragBox, setDragBox] = useState<{ sx: number; sy: number; cx: number; cy: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const desktopSnapshotRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const drawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setWindowTitle(windowId, 'Snip & Sketch');
  }, [windowId, setWindowTitle]);

  const pushHistory = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    historyRef.current = [...historyRef.current.slice(-19), ctx.getImageData(0, 0, c.width, c.height)];
  };

  const paintImageToCanvas = (srcCanvas: HTMLCanvasElement | HTMLImageElement, sx = 0, sy = 0, sw?: number, sh?: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const w = sw ?? srcCanvas.width;
    const h = sh ?? srcCanvas.height;
    c.width = Math.max(120, Math.round(w));
    c.height = Math.max(90, Math.round(h));
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(srcCanvas, sx, sy, w, h, 0, 0, c.width, c.height);
    historyRef.current = [ctx.getImageData(0, 0, c.width, c.height)];
    setHasCapture(true);
    setStatusMsg(`Captured ${c.width} × ${c.height}px`);
  };

  const startSnipCapture = async () => {
    const shot = await renderVirtualDesktopCanvas();
    desktopSnapshotRef.current = shot;
    setDesktopBackdropUrl(shot.toDataURL('image/png'));
    setDragBox(null);
    setCapturing(true);
  };

  const finishRegionSnip = (x: number, y: number, w: number, h: number) => {
    const shot = desktopSnapshotRef.current;
    setCapturing(false);
    setDesktopBackdropUrl(null);
    setDragBox(null);
    if (!shot) return;
    if (w < 20 || h < 20) {
      paintImageToCanvas(shot);
    } else {
      paintImageToCanvas(shot, x, y, w, h);
    }
  };

  const handleOpenImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    void loadImageEl(url).then((img) => {
      URL.revokeObjectURL(url);
      if (img) paintImageToCanvas(img);
    });
  };

  const getCanvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  };

  const onCanvasDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!hasCapture) return;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    pushHistory();
    drawingRef.current = true;
    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 1;
      ctx.lineWidth = strokeSize * 3;
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffff00';
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = strokeSize * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1;
      ctx.lineWidth = strokeSize;
    }
  };

  const onCanvasMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const onCanvasUp = () => {
    if (!drawingRef.current || !canvasRef.current) return;
    drawingRef.current = false;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.closePath();
      ctx.globalAlpha = 1;
    }
  };

  const handleUndo = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || historyRef.current.length <= 1) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    ctx.putImageData(prev, 0, 0);
  };

  const saveSnipToPictures = async () => {
    const c = canvasRef.current;
    if (!c || !hasCapture) return;
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `Screenshot_${Date.now()}.png`, { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const ids = await importHostFiles('pictures', dt.files);
    if (ids[0]) {
      setStatusMsg('Saved to Pictures');
      notify({
        kind: 'success',
        source: 'Snip & Sketch',
        title: 'Screenshot saved',
        message: 'Saved to Pictures. Click to open in Photos.',
        target: { folderId: 'pictures', fileId: ids[0] },
      });
    }
  };

  const downloadSnip = () => {
    const c = canvasRef.current;
    if (!c || !hasCapture) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `Screenshot_${Date.now()}.png`;
    a.click();
    setStatusMsg('Downloaded PNG');
  };

  const openLastSnipInPhotos = async () => {
    const c = canvasRef.current;
    if (!c || !hasCapture) return;
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `Snip_${Date.now()}.png`, { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const ids = await importHostFiles('pictures', dt.files);
    if (ids[0]) openPhotoFile(ids[0]);
  };

  const rect = dragBox
    ? {
        x: Math.min(dragBox.sx, dragBox.cx),
        y: Math.min(dragBox.sy, dragBox.cy),
        w: Math.abs(dragBox.cx - dragBox.sx),
        h: Math.abs(dragBox.cy - dragBox.sy),
      }
    : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1b1b1b] text-white select-none">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleOpenImage} className="hidden" />

      {/* Top Toolbar */}
      <div className="h-[44px] bg-[#242424] border-b border-white/10 px-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void startSnipCapture()}
            style={{ backgroundColor: accentColor }}
            className="h-[30px] px-3 text-[12.5px] font-medium text-white hover:brightness-110 flex items-center gap-1.5 cursor-default"
          >
            <span>✂</span>
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-[30px] px-2.5 bg-white/10 hover:bg-white/15 text-[12px] cursor-default"
          >
            Open file
          </button>

          <span className="h-5 w-px bg-white/15 mx-1" />

          {/* Annotation Tools */}
          {(
            [
              { id: 'pen', label: '✎ Pen' },
              { id: 'highlighter', label: '🖍 Highlighter' },
              { id: 'eraser', label: '⌫ Eraser' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!hasCapture}
              onClick={() => setTool(t.id)}
              className={`h-[30px] px-2.5 text-[12px] cursor-default disabled:opacity-40 ${
                tool === t.id && hasCapture ? 'bg-white/20 border border-white/30' : 'hover:bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}

          {tool === 'pen' && hasCapture && (
            <div className="flex items-center gap-1 ml-1">
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-4 h-4 rounded-full border ${color === c ? 'border-white scale-110' : 'border-white/30'}`}
                />
              ))}
              <input
                type="range"
                min={2}
                max={12}
                value={strokeSize}
                onChange={(e) => setStrokeSize(Number(e.target.value))}
                className="w-16 ml-1"
                title="Stroke thickness"
              />
            </div>
          )}

          <button
            type="button"
            disabled={!hasCapture}
            onClick={handleUndo}
            className="h-[30px] px-2.5 hover:bg-white/10 text-[12px] cursor-default disabled:opacity-40"
          >
            ↶ Undo
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[12px]">
          {statusMsg && <span className="text-white/65 mr-1 hidden md:inline">{statusMsg}</span>}
          <button
            type="button"
            disabled={!hasCapture}
            onClick={() => void saveSnipToPictures()}
            className="h-[30px] px-3 bg-white/10 hover:bg-white/15 cursor-default disabled:opacity-40"
          >
            💾 Save to Pictures
          </button>
          <button
            type="button"
            disabled={!hasCapture}
            onClick={() => void openLastSnipInPhotos()}
            className="h-[30px] px-2.5 bg-white/10 hover:bg-white/15 cursor-default disabled:opacity-40 hidden sm:inline-flex items-center"
          >
            Photos
          </button>
          <button
            type="button"
            disabled={!hasCapture}
            onClick={downloadSnip}
            className="h-[30px] px-2.5 bg-white/10 hover:bg-white/15 cursor-default disabled:opacity-40"
          >
            Export PNG
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-auto bg-[#141414]">
        {!hasCapture && (
          <div className="text-center space-y-3 max-w-sm">
            <img
              src={DESKTOP_APPS.find((a) => a.id === 'snip')?.icon}
              alt=""
              className="w-16 h-16 mx-auto opacity-85 object-contain"
            />
            <div className="text-[16px] font-light">Press New to snip your desktop</div>
            <p className="text-[12.5px] text-white/60">
              Drag over any region of the screen to capture a screenshot, annotate with pen or highlighter, and save straight to Pictures.
            </p>
            <button
              type="button"
              onClick={() => void startSnipCapture()}
              style={{ backgroundColor: accentColor }}
              className="px-5 py-2 text-[13px] font-medium text-white cursor-default"
            >
              ✂ New Snip
            </button>
          </div>
        )}
        <canvas
          ref={canvasRef}
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={onCanvasUp}
          onPointerLeave={onCanvasUp}
          className={hasCapture ? 'max-w-full max-h-full shadow-2xl border border-white/15 cursor-crosshair bg-white' : 'hidden'}
        />
      </div>

      {/* Full-Screen Region Capture Overlay */}
      {capturing && desktopBackdropUrl && (
        <div
          role="dialog"
          aria-label="Screen Snip Capture"
          onPointerDown={(e) => setDragBox({ sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY })}
          onPointerMove={(e) => {
            if (!dragBox) return;
            setDragBox((prev) => (prev ? { ...prev, cx: e.clientX, cy: e.clientY } : null));
          }}
          onPointerUp={() => {
            if (!rect) return;
            finishRegionSnip(rect.x, rect.y, rect.w, rect.h);
          }}
          style={{ backgroundImage: `url("${desktopBackdropUrl}")` }}
          className="fixed inset-0 z-[198] bg-cover bg-center cursor-crosshair select-none"
        >
          <div className="absolute inset-0 bg-black/45 pointer-events-none" />

          {/* Floating Capture Toolbar */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-[#242424] border border-white/25 px-2.5 py-1.5 shadow-2xl text-[12px]"
          >
            <span className="text-white/80 px-2">Drag to capture region</span>
            <button
              type="button"
              onClick={() => finishRegionSnip(0, 0, window.innerWidth, window.innerHeight)}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 cursor-default"
            >
              Fullscreen
            </button>
            <button
              type="button"
              onClick={() => { setCapturing(false); setDesktopBackdropUrl(null); setDragBox(null); }}
              className="px-2.5 py-1 bg-white/10 hover:bg-[#e81123] cursor-default"
            >
              Cancel
            </button>
          </div>

          {rect && rect.w > 2 && rect.h > 2 && (
            <div
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              className="absolute z-10 border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none"
            />
          )}
        </div>
      )}
    </div>
  );
}
