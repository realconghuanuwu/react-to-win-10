import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { getMediaBlob } from '../../db/win10Db';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore, type FsNode } from '../../store/useFileSystemStore';
import {
  EditColorsDialog,
  ImagePropertiesDialog,
  PaintFileDialog,
  ResizeSkewDialog,
  type ImageSaveFormat,
} from './paint/PaintDialogs';
import { BrushIcon, ShapeIcon, ToolIcon } from './paint/PaintToolIcons';
import {
  clamp,
  drawAirbrushBurst,
  drawBrushSegment,
  drawEraserSegment,
  drawPencilSegment,
  drawShapeOnContext,
  hexToRgb,
  normalizeRect,
  rgbToHex,
  floodFillCanvas,
} from './paint/paintDrawing';
import {
  BRUSH_OPTIONS,
  DEFAULT_PALETTE_COLORS,
  INITIAL_CUSTOM_COLORS,
  SHAPE_OPTIONS,
  SHAPE_STYLE_OPTIONS,
  SIZE_PRESETS,
  ZOOM_LEVELS,
  type ActiveSelection,
  type ActiveTextBox,
  type BrushType,
  type HistorySnapshot,
  type PaintToolId,
  type PendingShape,
  type Point,
  type Rect,
  type ShapeStyleMode,
  type ShapeType,
} from './paint/paintTypes';

interface PaintAppProps {
  windowId: string;
}

type RibbonTab = 'home' | 'view';
type OpenDropdown =
  | 'paste'
  | 'select'
  | 'rotate'
  | 'brushes'
  | 'outline'
  | 'fill'
  | 'size'
  | null;
type OpenDialog = 'open' | 'saveAs' | 'resize' | 'properties' | 'editColors' | 'about' | null;

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 500;
const MAX_HISTORY = 40;

const TEXT_FONTS = [
  'Segoe UI',
  'Arial',
  'Calibri',
  'Times New Roman',
  'Georgia',
  'Consolas',
  'Comic Sans MS',
  'Impact',
];

const TEXT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

function createBmpBlobFromCanvas(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Blob();
  const img = ctx.getImageData(0, 0, w, h).data;
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const pixelArraySize = rowSize * h;
  const fileSize = 54 + pixelArraySize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  // BITMAPFILEHEADER
  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);

  // BITMAPINFOHEADER
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, h, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelArraySize, true);

  const bytes = new Uint8Array(buf);
  for (let y = 0; y < h; y++) {
    const srcRow = h - 1 - y;
    const dstOffset = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const si = (srcRow * w + x) * 4;
      const di = dstOffset + x * 3;
      bytes[di] = img[si + 2];
      bytes[di + 1] = img[si + 1];
      bytes[di + 2] = img[si];
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

async function canvasToBlob(canvas: HTMLCanvasElement, format: ImageSaveFormat): Promise<Blob> {
  if (format === 'bmp') return createBmpBlobFromCanvas(canvas);
  const mime =
    format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to export image'))),
      mime,
      0.92,
    );
  });
}

function makeSelectionCanvas(sel: ActiveSelection, transparentBgHex?: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sel.imageData.width;
  c.height = sel.imageData.height;
  const cctx = c.getContext('2d')!;
  const copy = new ImageData(
    new Uint8ClampedArray(sel.imageData.data),
    sel.imageData.width,
    sel.imageData.height,
  );
  if (transparentBgHex) {
    const bg = hexToRgb(transparentBgHex);
    const d = copy.data;
    for (let i = 0; i < d.length; i += 4) {
      if (
        Math.abs(d[i] - bg.r) <= 12 &&
        Math.abs(d[i + 1] - bg.g) <= 12 &&
        Math.abs(d[i + 2] - bg.b) <= 12
      ) {
        d[i + 3] = 0;
      }
    }
  }
  cctx.putImageData(copy, 0, 0);
  if (sel.maskCanvas) {
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(sel.maskCanvas, 0, 0);
  }
  return c;
}

export function PaintApp({ windowId }: PaintAppProps) {
  const nodes = useFileSystemStore((state) => state.nodes);
  const createMediaFile = useFileSystemStore((state) => state.createMediaFile);
  const updateMediaFile = useFileSystemStore((state) => state.updateMediaFile);

  const paintActiveFileId = useDesktopStore((state) => state.paintActiveFileId);
  const paintOpenNonce = useDesktopStore((state) => state.paintOpenNonce);
  const setWindowTitle = useDesktopStore((state) => state.setWindowTitle);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const localFileInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_WIDTH);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_HEIGHT);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState('Untitled');
  const [isDirty, setIsDirty] = useState(false);

  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  const [activeTool, setActiveTool] = useState<PaintToolId>('pencil');
  const [activeBrush, setActiveBrush] = useState<BrushType>('brush');
  const [activeShape, setActiveShape] = useState<ShapeType>('rectangle');
  const [outlineStyle, setOutlineStyle] = useState<ShapeStyleMode>('solid');
  const [fillStyle, setFillStyle] = useState<ShapeStyleMode>('none');
  const [strokeSize, setStrokeSize] = useState<number>(3);
  const [transparentSelection, setTransparentSelection] = useState(false);

  const [activeColorSlot, setActiveColorSlot] = useState<1 | 2>(1);
  const [color1, setColor1] = useState('#000000');
  const [color2, setColor2] = useState('#ffffff');
  const [customColors, setCustomColors] = useState<(string | null)[]>(INITIAL_CUSTOM_COLORS);

  const [zoom, setZoom] = useState(100);
  const [showRulers, setShowRulers] = useState(false);
  const [showGridlines, setShowGridlines] = useState(false);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [cursorCoords, setCursorCoords] = useState<Point | null>(null);
  const [selection, setSelection] = useState<ActiveSelection | null>(null);
  const [pendingShape, setPendingShape] = useState<PendingShape | null>(null);
  const [textBox, setTextBox] = useState<ActiveTextBox | null>(null);
  const [internalClipboard, setInternalClipboard] = useState<ImageData | null>(null);

  const [textFont, setTextFont] = useState('Segoe UI');
  const [textSize, setTextSize] = useState(18);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  const [textOpaque, setTextOpaque] = useState(false);

  const [resizePreview, setResizePreview] = useState<{ w: number; h: number } | null>(null);

  // History management via refs + state counters for button disabled flags
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIdxRef = useRef<number>(-1);
  const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false });

  // Live drawing interaction refs
  const drawOpRef = useRef<{
    kind:
      | 'stroke'
      | 'marquee-rect'
      | 'marquee-free'
      | 'move-selection'
      | 'resize-selection'
      | 'draw-shape'
      | 'move-shape'
      | 'curve-ctrl'
      | 'text-drag';
    button: number;
    lastPoint: Point;
    startPoint: Point;
    freePoints?: Point[];
    origRect?: Rect;
    handle?: string;
    airbrushTimer?: number;
  } | null>(null);

  const syncHistoryMeta = useCallback(() => {
    setHistoryMeta({
      canUndo: historyIdxRef.current > 0,
      canRedo: historyIdxRef.current < historyRef.current.length - 1,
    });
  }, []);

  const pushHistorySnapshot = useCallback(
    (w?: number, h?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const cw = w ?? canvas.width;
      const ch = h ?? canvas.height;
      const snap: HistorySnapshot = {
        width: cw,
        height: ch,
        imageData: ctx.getImageData(0, 0, cw, ch),
      };
      const next = historyRef.current.slice(0, historyIdxRef.current + 1);
      next.push(snap);
      if (next.length > MAX_HISTORY) next.shift();
      historyRef.current = next;
      historyIdxRef.current = next.length - 1;
      syncHistoryMeta();
    },
    [syncHistoryMeta],
  );

  // Initialize blank white canvas once on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    pushHistorySnapshot(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    initializedRef.current = true;
  }, [pushHistorySnapshot]);

  // Sync window title
  useEffect(() => {
    setWindowTitle(windowId, `${isDirty ? '*' : ''}${currentFileName} - Paint`);
  }, [windowId, currentFileName, isDirty, setWindowTitle]);

  // Close menus on outside pointerdown
  useEffect(() => {
    if (!fileMenuOpen && !openDropdown) return;
    const onOutside = (e: PointerEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
        setOpenDropdown(null);
      }
    };
    window.addEventListener('pointerdown', onOutside);
    return () => window.removeEventListener('pointerdown', onOutside);
  }, [fileMenuOpen, openDropdown]);

  // Helper to resize canvas cleanly and draw an ImageData or Image onto it
  const applySnapshotToCanvas = useCallback((snap: HistorySnapshot) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = snap.width;
    canvas.height = snap.height;
    setCanvasWidth(snap.width);
    setCanvasHeight(snap.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.putImageData(snap.imageData, 0, 0);
    }
  }, []);

  const commitSelection = useCallback(
    (sel: ActiveSelection | null = selection) => {
      if (!sel) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const stamp = makeSelectionCanvas(sel, transparentSelection ? color2 : undefined);
      ctx.drawImage(stamp, sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h);
      setSelection(null);
      setIsDirty(true);
      pushHistorySnapshot();
    },
    [selection, transparentSelection, color2, pushHistorySnapshot],
  );

  const commitPendingShape = useCallback(
    (shapeToCommit: PendingShape | null = pendingShape) => {
      if (!shapeToCommit) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      drawShapeOnContext(ctx, shapeToCommit);
      setPendingShape(null);
      setIsDirty(true);
      pushHistorySnapshot();
    },
    [pendingShape, pushHistorySnapshot],
  );

  const commitTextBox = useCallback(
    (box: ActiveTextBox | null = textBox) => {
      if (!box) return;
      if (box.text.trim().length > 0) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.save();
          if (box.opaque) {
            ctx.fillStyle = color2;
            ctx.fillRect(box.x, box.y, box.w, box.h);
          }
          const fontStyle = `${box.italic ? 'italic ' : ''}${box.bold ? 'bold ' : ''}${box.fontSize}px "${box.fontFamily}", sans-serif`;
          ctx.font = fontStyle;
          ctx.fillStyle = color1;
          ctx.textBaseline = 'top';
          const lineHeight = Math.round(box.fontSize * 1.25);
          const lines = box.text.split('\n');
          let curY = box.y + 4;
          for (const rawLine of lines) {
            // Simple word-wrap inside box width
            const words = rawLine.split(' ');
            let line = '';
            const maxW = Math.max(20, box.w - 8);
            const emitLine = (str: string) => {
              ctx.fillText(str, box.x + 4, curY);
              if (box.underline && str.length > 0) {
                const metrics = ctx.measureText(str);
                ctx.fillRect(box.x + 4, curY + box.fontSize + 1, metrics.width, Math.max(1, box.fontSize / 14));
              }
              curY += lineHeight;
            };
            for (const word of words) {
              const test = line ? `${line} ${word}` : word;
              if (ctx.measureText(test).width > maxW && line) {
                emitLine(line);
                line = word;
              } else {
                line = test;
              }
            }
            emitLine(line);
          }
          ctx.restore();
          setIsDirty(true);
          pushHistorySnapshot();
        }
      }
      setTextBox(null);
    },
    [textBox, color1, color2, pushHistorySnapshot],
  );

  const commitAllFloating = useCallback(() => {
    if (selection) commitSelection(selection);
    if (pendingShape) commitPendingShape(pendingShape);
    if (textBox) commitTextBox(textBox);
  }, [selection, pendingShape, textBox, commitSelection, commitPendingShape, commitTextBox]);

  const handleSelectTool = useCallback(
    (nextTool: PaintToolId) => {
      if (nextTool !== activeTool) {
        commitAllFloating();
      }
      setActiveTool(nextTool);
      setOpenDropdown(null);
    },
    [activeTool, commitAllFloating],
  );

  // Load image blob into canvas
  const loadBlobIntoCanvas = useCallback(
    (blob: Blob, fileName: string, fileId: string | null) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w = clamp(img.naturalWidth || DEFAULT_WIDTH, 1, 4096);
        const h = clamp(img.naturalHeight || DEFAULT_HEIGHT, 1, 4096);
        const canvas = canvasRef.current;
        if (!canvas) return;
        setSelection(null);
        setPendingShape(null);
        setTextBox(null);
        canvas.width = w;
        canvas.height = h;
        setCanvasWidth(w);
        setCanvasHeight(h);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
        }
        historyRef.current = [];
        historyIdxRef.current = -1;
        pushHistorySnapshot(w, h);
        setCurrentFileId(fileId);
        setCurrentFileName(fileName);
        setIsDirty(false);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [pushHistorySnapshot],
  );

  // Sync external file open (from Desktop or File Explorer)
  useEffect(() => {
    if (paintOpenNonce === 0) return;
    if (!paintActiveFileId) return;
    const file = nodes[paintActiveFileId];
    if (!file || file.kind !== 'file' || !file.blobId) return;
    void getMediaBlob(file.blobId).then((blob) => {
      if (blob) loadBlobIntoCanvas(blob, file.name, file.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintActiveFileId, paintOpenNonce]);

  // Redraw interactive overlay whenever floating state changes
  const redrawOverlay = useCallback(
    (extraPreview?: { kind: 'marquee-rect'; rect: Rect } | { kind: 'marquee-free'; points: Point[] }) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (selection) {
        const stamp = makeSelectionCanvas(selection, transparentSelection ? color2 : undefined);
        ctx.drawImage(stamp, selection.rect.x, selection.rect.y, selection.rect.w, selection.rect.h);
        ctx.save();
        ctx.strokeStyle = '#0078d7';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(selection.rect.x + 0.5, selection.rect.y + 0.5, selection.rect.w, selection.rect.h);
        ctx.restore();
      }

      if (pendingShape) {
        drawShapeOnContext(ctx, pendingShape);
        if (pendingShape.shape !== 'polygon' && pendingShape.shape !== 'curve') {
          const r = normalizeRect(pendingShape.start, pendingShape.end);
          ctx.save();
          ctx.strokeStyle = '#0078d7';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
          ctx.restore();
        } else if (pendingShape.shape === 'polygon' && pendingShape.vertices?.length) {
          ctx.save();
          ctx.strokeStyle = pendingShape.outlineColor;
          ctx.lineWidth = pendingShape.lineWidth;
          ctx.beginPath();
          ctx.moveTo(pendingShape.vertices[0].x, pendingShape.vertices[0].y);
          for (let i = 1; i < pendingShape.vertices.length; i++) {
            ctx.lineTo(pendingShape.vertices[i].x, pendingShape.vertices[i].y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      if (extraPreview?.kind === 'marquee-rect') {
        const r = extraPreview.rect;
        ctx.save();
        ctx.strokeStyle = '#0078d7';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
        ctx.restore();
      } else if (extraPreview?.kind === 'marquee-free' && extraPreview.points.length > 1) {
        ctx.save();
        ctx.strokeStyle = '#0078d7';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(extraPreview.points[0].x, extraPreview.points[0].y);
        for (let i = 1; i < extraPreview.points.length; i++) {
          ctx.lineTo(extraPreview.points[i].x, extraPreview.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }
    },
    [selection, pendingShape, transparentSelection, color2],
  );

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay, canvasWidth, canvasHeight]);

  // Undo & Redo
  const handleUndo = useCallback(() => {
    if (textBox) {
      setTextBox(null);
      return;
    }
    if (pendingShape) {
      setPendingShape(null);
      return;
    }
    if (selection) {
      setSelection(null);
      const snap = historyRef.current[historyIdxRef.current];
      if (snap) applySnapshotToCanvas(snap);
      return;
    }
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const snap = historyRef.current[historyIdxRef.current];
    if (snap) applySnapshotToCanvas(snap);
    syncHistoryMeta();
  }, [textBox, pendingShape, selection, applySnapshotToCanvas, syncHistoryMeta]);

  const handleRedo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    commitAllFloating();
    historyIdxRef.current += 1;
    const snap = historyRef.current[historyIdxRef.current];
    if (snap) applySnapshotToCanvas(snap);
    syncHistoryMeta();
  }, [commitAllFloating, applySnapshotToCanvas, syncHistoryMeta]);

  // New / Clear / File actions
  const handleNewCanvas = useCallback(() => {
    setFileMenuOpen(false);
    setSelection(null);
    setPendingShape(null);
    setTextBox(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = DEFAULT_WIDTH;
    canvas.height = DEFAULT_HEIGHT;
    setCanvasWidth(DEFAULT_WIDTH);
    setCanvasHeight(DEFAULT_HEIGHT);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    }
    historyRef.current = [];
    historyIdxRef.current = -1;
    pushHistorySnapshot(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    setCurrentFileId(null);
    setCurrentFileName('Untitled');
    setIsDirty(false);
  }, [pushHistorySnapshot]);

  const handleClearCanvas = useCallback(() => {
    setFileMenuOpen(false);
    setSelection(null);
    setPendingShape(null);
    setTextBox(null);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    ctx.fillStyle = color2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsDirty(true);
    pushHistorySnapshot();
  }, [color2, pushHistorySnapshot]);

  const handleSave = useCallback(async () => {
    setFileMenuOpen(false);
    commitAllFloating();
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (currentFileId && nodes[currentFileId]?.kind === 'file') {
      const lower = currentFileName.toLowerCase();
      const fmt: ImageSaveFormat = lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'jpeg'
        : lower.endsWith('.bmp')
          ? 'bmp'
          : lower.endsWith('.webp')
            ? 'webp'
            : 'png';
      const blob = await canvasToBlob(canvas, fmt);
      await updateMediaFile(currentFileId, blob);
      setIsDirty(false);
      return;
    }
    setOpenDialog('saveAs');
  }, [commitAllFloating, currentFileId, currentFileName, nodes, updateMediaFile]);

  const handleConfirmSaveAs = useCallback(
    async (folderId: string, fileName: string, format: ImageSaveFormat) => {
      commitAllFloating();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const blob = await canvasToBlob(canvas, format);
      const createdId = await createMediaFile(folderId, fileName, blob);
      if (createdId) {
        const createdNode = useFileSystemStore.getState().nodes[createdId];
        setCurrentFileId(createdId);
        setCurrentFileName(createdNode?.name ?? fileName);
        setIsDirty(false);
      }
      setOpenDialog(null);
    },
    [commitAllFloating, createMediaFile],
  );

  const handleDownloadToPc = useCallback(
    async (fileName: string, format: ImageSaveFormat) => {
      commitAllFloating();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const blob = await canvasToBlob(canvas, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpenDialog(null);
    },
    [commitAllFloating],
  );

  const handleConfirmOpenFile = useCallback(
    async (file: FsNode) => {
      if (!file.blobId) return;
      const blob = await getMediaBlob(file.blobId);
      if (blob) {
        loadBlobIntoCanvas(blob, file.name, file.id);
      }
      setOpenDialog(null);
    },
    [loadBlobIntoCanvas],
  );

  const handleLocalFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    loadBlobIntoCanvas(file, file.name, null);
    setOpenDialog(null);
  };

  // Selection operations: Select All, Copy, Cut, Paste, Delete, Crop, Invert
  const handleSelectAll = useCallback(() => {
    commitAllFloating();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSelection({
      rect: { x: 0, y: 0, w: canvas.width, h: canvas.height },
      imageData: imgData,
    });
    setActiveTool('select-rect');
    setOpenDropdown(null);
  }, [commitAllFloating, color2]);

  const handleCopySelection = useCallback(async () => {
    if (!selection) return;
    const stamp = makeSelectionCanvas(selection, transparentSelection ? color2 : undefined);
    const sctx = stamp.getContext('2d')!;
    const imgData = sctx.getImageData(0, 0, stamp.width, stamp.height);
    setInternalClipboard(imgData);
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const blob = await new Promise<Blob | null>((res) => stamp.toBlob(res, 'image/png'));
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        }
      }
    } catch {
      // Internal clipboard still works even if browser denies ClipboardItem write
    }
  }, [selection, transparentSelection, color2]);

  const handleCutSelection = useCallback(async () => {
    if (!selection) return;
    await handleCopySelection();
    setSelection(null);
    setIsDirty(true);
    pushHistorySnapshot();
  }, [selection, handleCopySelection, pushHistorySnapshot]);

  const pasteImageData = useCallback(
    (imgData: ImageData) => {
      commitAllFloating();
      const canvas = canvasRef.current;
      if (canvas && (imgData.width > canvas.width || imgData.height > canvas.height)) {
        const nw = Math.max(canvas.width, imgData.width);
        const nh = Math.max(canvas.height, imgData.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const prev = ctx.getImageData(0, 0, canvas.width, canvas.height);
          canvas.width = nw;
          canvas.height = nh;
          setCanvasWidth(nw);
          setCanvasHeight(nh);
          ctx.fillStyle = color2;
          ctx.fillRect(0, 0, nw, nh);
          ctx.putImageData(prev, 0, 0);
        }
      }
      setSelection({
        rect: { x: 0, y: 0, w: imgData.width, h: imgData.height },
        imageData: imgData,
      });
      setActiveTool('select-rect');
      setOpenDropdown(null);
    },
    [commitAllFloating, color2],
  );

  const handlePaste = useCallback(async () => {
    setOpenDropdown(null);
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(url);
              const tmp = document.createElement('canvas');
              tmp.width = img.naturalWidth;
              tmp.height = img.naturalHeight;
              const tctx = tmp.getContext('2d')!;
              tctx.drawImage(img, 0, 0);
              pasteImageData(tctx.getImageData(0, 0, tmp.width, tmp.height));
            };
            img.src = url;
            return;
          }
        }
      }
    } catch {
      // Fallback to internal clipboard
    }
    if (internalClipboard) {
      pasteImageData(internalClipboard);
    }
  }, [internalClipboard, pasteImageData]);

  const handleDeleteSelection = useCallback(() => {
    if (!selection) return;
    setSelection(null);
    setIsDirty(true);
    pushHistorySnapshot();
  }, [selection, pushHistorySnapshot]);

  const handleCropToSelection = useCallback(() => {
    if (!selection) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const nw = Math.max(1, Math.round(selection.rect.w));
    const nh = Math.max(1, Math.round(selection.rect.h));
    const stamp = makeSelectionCanvas(selection, transparentSelection ? color2 : undefined);
    canvas.width = nw;
    canvas.height = nh;
    setCanvasWidth(nw);
    setCanvasHeight(nh);
    ctx.fillStyle = color2;
    ctx.fillRect(0, 0, nw, nh);
    ctx.drawImage(stamp, 0, 0, nw, nh);
    setSelection(null);
    setIsDirty(true);
    pushHistorySnapshot(nw, nh);
  }, [selection, transparentSelection, color2, pushHistorySnapshot]);

  const handleInvertSelection = useCallback(() => {
    if (!selection) return;
    const next = new ImageData(
      new Uint8ClampedArray(selection.imageData.data),
      selection.imageData.width,
      selection.imageData.height,
    );
    for (let i = 0; i < next.data.length; i += 4) {
      next.data[i] = 255 - next.data[i];
      next.data[i + 1] = 255 - next.data[i + 1];
      next.data[i + 2] = 255 - next.data[i + 2];
    }
    setSelection({ ...selection, imageData: next });
    setOpenDropdown(null);
  }, [selection]);

  // Rotate / Flip (selection if active, else entire canvas)
  const handleRotateFlip = useCallback(
    (op: 'cw90' | 'ccw90' | '180' | 'flipV' | 'flipH') => {
      setOpenDropdown(null);
      if (selection) {
        const src = makeSelectionCanvas(selection);
        const sw = src.width;
        const sh = src.height;
        const dw = op === 'cw90' || op === 'ccw90' ? sh : sw;
        const dh = op === 'cw90' || op === 'ccw90' ? sw : sh;
        const dst = document.createElement('canvas');
        dst.width = dw;
        dst.height = dh;
        const dctx = dst.getContext('2d')!;
        dctx.translate(dw / 2, dh / 2);
        if (op === 'cw90') dctx.rotate(Math.PI / 2);
        else if (op === 'ccw90') dctx.rotate(-Math.PI / 2);
        else if (op === '180') dctx.rotate(Math.PI);
        else if (op === 'flipH') dctx.scale(-1, 1);
        else if (op === 'flipV') dctx.scale(1, -1);
        dctx.drawImage(src, -sw / 2, -sh / 2);
        setSelection({
          rect: { x: selection.rect.x, y: selection.rect.y, w: dw, h: dh },
          imageData: dctx.getImageData(0, 0, dw, dh),
        });
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) return;
      const sw = canvas.width;
      const sh = canvas.height;
      const tmp = document.createElement('canvas');
      tmp.width = sw;
      tmp.height = sh;
      tmp.getContext('2d')!.drawImage(canvas, 0, 0);

      const dw = op === 'cw90' || op === 'ccw90' ? sh : sw;
      const dh = op === 'cw90' || op === 'ccw90' ? sw : sh;
      canvas.width = dw;
      canvas.height = dh;
      setCanvasWidth(dw);
      setCanvasHeight(dh);
      ctx.save();
      ctx.translate(dw / 2, dh / 2);
      if (op === 'cw90') ctx.rotate(Math.PI / 2);
      else if (op === 'ccw90') ctx.rotate(-Math.PI / 2);
      else if (op === '180') ctx.rotate(Math.PI);
      else if (op === 'flipH') ctx.scale(-1, 1);
      else if (op === 'flipV') ctx.scale(1, -1);
      ctx.drawImage(tmp, -sw / 2, -sh / 2);
      ctx.restore();
      setIsDirty(true);
      pushHistorySnapshot(dw, dh);
    },
    [selection, pushHistorySnapshot],
  );

  // Resize & Skew (applies to selection if active, else canvas)
  const handleApplyResizeSkew = useCallback(
    (nextW: number, nextH: number, skewH: number, skewV: number) => {
      setOpenDialog(null);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) return;

      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      tmp.getContext('2d')!.drawImage(canvas, 0, 0);

      const radH = (skewH * Math.PI) / 180;
      const radV = (skewV * Math.PI) / 180;
      const extraW = Math.round(Math.abs(Math.tan(radH)) * nextH);
      const extraH = Math.round(Math.abs(Math.tan(radV)) * nextW);
      const finalW = clamp(nextW + extraW, 1, 4096);
      const finalH = clamp(nextH + extraH, 1, 4096);

      canvas.width = finalW;
      canvas.height = finalH;
      setCanvasWidth(finalW);
      setCanvasHeight(finalH);

      ctx.save();
      ctx.fillStyle = color2;
      ctx.fillRect(0, 0, finalW, finalH);
      const offsetX = skewH < 0 ? extraW : 0;
      const offsetY = skewV < 0 ? extraH : 0;
      ctx.transform(1, Math.tan(radV), Math.tan(radH), 1, offsetX, offsetY);
      ctx.drawImage(tmp, 0, 0, nextW, nextH);
      ctx.restore();

      setIsDirty(true);
      pushHistorySnapshot(finalW, finalH);
    },
    [color2, pushHistorySnapshot],
  );

  // Resize canvas dimensions (cropping/expanding without scaling)
  const resizeCanvasBounds = useCallback(
    (nextW: number, nextH: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) return;
      const cw = clamp(Math.round(nextW), 1, 4096);
      const ch = clamp(Math.round(nextH), 1, 4096);
      if (cw === canvas.width && ch === canvas.height) return;

      commitAllFloating();
      const prev = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = cw;
      canvas.height = ch;
      setCanvasWidth(cw);
      setCanvasHeight(ch);
      ctx.fillStyle = color2;
      ctx.fillRect(0, 0, cw, ch);
      ctx.putImageData(prev, 0, 0);
      setIsDirty(true);
      pushHistorySnapshot(cw, ch);
    },
    [commitAllFloating, color2, pushHistorySnapshot],
  );

  // Keyboard shortcuts scoped to active Paint window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const desktop = useDesktopStore.getState();
      if (desktop.activeAppId !== windowId || desktop.isStartMenuOpen || desktop.isTaskViewOpen) {
        return;
      }
      if (openDialog) {
        if (e.key === 'Escape') setOpenDialog(null);
        return;
      }
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if (textBox && target === textInputRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setTextBox(null);
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          commitTextBox(textBox);
        }
        return;
      }
      if (inInput) return;

      if (e.key === 'Escape') {
        if (isFullScreen) {
          setIsFullScreen(false);
          return;
        }
        setFileMenuOpen(false);
        setOpenDropdown(null);
        if (pendingShape) setPendingShape(null);
        else if (selection) commitSelection(selection);
        return;
      }

      if (e.key === 'Delete' && selection) {
        e.preventDefault();
        handleDeleteSelection();
        return;
      }

      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();

      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          commitAllFloating();
          setOpenDialog('saveAs');
        } else {
          void handleSave();
        }
      } else if (key === 'o') {
        e.preventDefault();
        commitAllFloating();
        setOpenDialog('open');
      } else if (key === 'n') {
        e.preventDefault();
        handleNewCanvas();
      } else if (key === 'a') {
        e.preventDefault();
        handleSelectAll();
      } else if (key === 'c' && selection) {
        e.preventDefault();
        void handleCopySelection();
      } else if (key === 'x' && selection) {
        e.preventDefault();
        void handleCutSelection();
      } else if (key === 'v') {
        e.preventDefault();
        void handlePaste();
      } else if (key === '=' || key === '+') {
        e.preventDefault();
        setZoom((z) => ZOOM_LEVELS.find((l) => l > z) ?? z);
      } else if (key === '-') {
        e.preventDefault();
        setZoom((z) => [...ZOOM_LEVELS].reverse().find((l) => l < z) ?? z);
      } else if (key === '0') {
        e.preventDefault();
        setZoom(100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    windowId,
    openDialog,
    textBox,
    isFullScreen,
    pendingShape,
    selection,
    commitTextBox,
    commitSelection,
    commitAllFloating,
    handleDeleteSelection,
    handleUndo,
    handleRedo,
    handleSave,
    handleNewCanvas,
    handleSelectAll,
    handleCopySelection,
    handleCutSelection,
    handlePaste,
  ]);

  // Convert client pointer position to unzoomed canvas coordinates
  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scale = zoom / 100;
      return {
        x: Math.round((clientX - rect.left) / scale),
        y: Math.round((clientY - rect.top) / scale),
      };
    },
    [zoom],
  );

  const pickColorAt = useCallback(
    (pt: Point, button: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) return;
      const px = clamp(Math.floor(pt.x), 0, canvas.width - 1);
      const py = clamp(Math.floor(pt.y), 0, canvas.height - 1);
      const data = ctx.getImageData(px, py, 1, 1).data;
      const hex = rgbToHex(data[0], data[1], data[2]);
      if (button === 2) setColor2(hex);
      else setColor1(hex);
    },
    [],
  );

  // Main Canvas Pointer Down
  const handleCanvasPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    setFileMenuOpen(false);
    setOpenDropdown(null);

    const pt = toCanvasPoint(e.clientX, e.clientY);
    const activeColor = e.button === 2 ? color2 : color1;
    const altColor = e.button === 2 ? color1 : color2;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    // Commit text box if clicking canvas
    if (textBox) {
      commitTextBox(textBox);
      if (activeTool !== 'text') return;
    }

    // Handle active selection click-outside commit
    if (selection) {
      commitSelection(selection);
    }

    // Handle Curve multi-stage clicks
    if (pendingShape && pendingShape.shape === 'curve') {
      if (pendingShape.curveStage === 'c1') {
        setPendingShape({ ...pendingShape, ctrl1: pt, curveStage: 'c2' });
        drawOpRef.current = { kind: 'curve-ctrl', button: e.button, lastPoint: pt, startPoint: pt };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (pendingShape.curveStage === 'c2') {
        setPendingShape({ ...pendingShape, ctrl2: pt, curveStage: 'ready' });
        drawOpRef.current = { kind: 'curve-ctrl', button: e.button, lastPoint: pt, startPoint: pt };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      commitPendingShape(pendingShape);
    }

    // Handle Polygon vertex addition
    if (pendingShape && pendingShape.shape === 'polygon') {
      const verts = pendingShape.vertices ?? [];
      const first = verts[0];
      if (first && verts.length >= 3 && Math.hypot(pt.x - first.x, pt.y - first.y) <= 8) {
        commitPendingShape(pendingShape);
        return;
      }
      setPendingShape({
        ...pendingShape,
        end: pt,
        vertices: [...verts, pt],
      });
      return;
    }

    if (pendingShape) {
      commitPendingShape(pendingShape);
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    switch (activeTool) {
      case 'pencil': {
        drawPencilSegment(ctx, pt, pt, activeColor, strokeSize);
        drawOpRef.current = { kind: 'stroke', button: e.button, lastPoint: pt, startPoint: pt };
        break;
      }
      case 'brush': {
        if (activeBrush === 'airbrush') {
          drawAirbrushBurst(ctx, pt, activeColor, strokeSize);
          const timer = window.setInterval(() => {
            const op = drawOpRef.current;
            const c = canvasRef.current?.getContext('2d', { willReadFrequently: true });
            if (op && c) {
              drawAirbrushBurst(c, op.lastPoint, op.button === 2 ? color2 : color1, strokeSize);
            }
          }, 45);
          drawOpRef.current = {
            kind: 'stroke',
            button: e.button,
            lastPoint: pt,
            startPoint: pt,
            airbrushTimer: timer,
          };
        } else {
          drawBrushSegment(ctx, activeBrush, pt, pt, activeColor, strokeSize);
          drawOpRef.current = { kind: 'stroke', button: e.button, lastPoint: pt, startPoint: pt };
        }
        break;
      }
      case 'eraser': {
        drawEraserSegment(ctx, pt, pt, color2, strokeSize);
        drawOpRef.current = { kind: 'stroke', button: e.button, lastPoint: pt, startPoint: pt };
        break;
      }
      case 'fill': {
        const changed = floodFillCanvas(ctx, pt.x, pt.y, activeColor);
        if (changed) {
          setIsDirty(true);
          pushHistorySnapshot();
        }
        break;
      }
      case 'picker': {
        pickColorAt(pt, e.button);
        break;
      }
      case 'magnifier': {
        setZoom((z) =>
          e.button === 2
            ? ([...ZOOM_LEVELS].reverse().find((l) => l < z) ?? z)
            : (ZOOM_LEVELS.find((l) => l > z) ?? z),
        );
        break;
      }
      case 'select-rect': {
        drawOpRef.current = { kind: 'marquee-rect', button: e.button, lastPoint: pt, startPoint: pt };
        break;
      }
      case 'select-free': {
        drawOpRef.current = {
          kind: 'marquee-free',
          button: e.button,
          lastPoint: pt,
          startPoint: pt,
          freePoints: [pt],
        };
        break;
      }
      case 'text': {
        drawOpRef.current = { kind: 'text-drag', button: e.button, lastPoint: pt, startPoint: pt };
        break;
      }
      case 'shape': {
        if (activeShape === 'polygon') {
          setPendingShape({
            shape: 'polygon',
            start: pt,
            end: pt,
            vertices: [pt],
            outlineColor: activeColor,
            fillColor: altColor,
            outlineStyle,
            fillStyle,
            lineWidth: strokeSize,
          });
        } else {
          setPendingShape({
            shape: activeShape,
            start: pt,
            end: pt,
            curveStage: activeShape === 'curve' ? 'line' : undefined,
            outlineColor: activeColor,
            fillColor: altColor,
            outlineStyle,
            fillStyle,
            lineWidth: strokeSize,
          });
          drawOpRef.current = { kind: 'draw-shape', button: e.button, lastPoint: pt, startPoint: pt };
        }
        break;
      }
    }
  };

  const handleCanvasPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pt = toCanvasPoint(e.clientX, e.clientY);
    setCursorCoords(pt);

    const op = drawOpRef.current;
    if (!op) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const activeColor = op.button === 2 ? color2 : color1;

    if (op.kind === 'stroke') {
      if (activeTool === 'pencil') {
        drawPencilSegment(ctx, op.lastPoint, pt, activeColor, strokeSize);
      } else if (activeTool === 'eraser') {
        drawEraserSegment(ctx, op.lastPoint, pt, color2, strokeSize);
      } else if (activeTool === 'brush' && activeBrush !== 'airbrush') {
        drawBrushSegment(ctx, activeBrush, op.lastPoint, pt, activeColor, strokeSize);
      }
      op.lastPoint = pt;
    } else if (op.kind === 'marquee-rect') {
      op.lastPoint = pt;
      redrawOverlay({ kind: 'marquee-rect', rect: normalizeRect(op.startPoint, pt) });
    } else if (op.kind === 'marquee-free') {
      op.lastPoint = pt;
      op.freePoints?.push(pt);
      redrawOverlay({ kind: 'marquee-free', points: op.freePoints ?? [] });
    } else if (op.kind === 'draw-shape') {
      op.lastPoint = pt;
      setPendingShape((prev) => (prev ? { ...prev, end: pt } : null));
    } else if (op.kind === 'curve-ctrl') {
      op.lastPoint = pt;
      setPendingShape((prev) => {
        if (!prev) return null;
        if (prev.curveStage === 'c2') return { ...prev, ctrl1: pt };
        return { ...prev, ctrl2: pt };
      });
    }
  };

  const handleCanvasPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const op = drawOpRef.current;
    if (!op) return;
    if (op.airbrushTimer) {
      window.clearInterval(op.airbrushTimer);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    drawOpRef.current = null;

    const pt = toCanvasPoint(e.clientX, e.clientY);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    if (op.kind === 'stroke') {
      setIsDirty(true);
      pushHistorySnapshot();
    } else if (op.kind === 'marquee-rect') {
      redrawOverlay();
      const raw = normalizeRect(op.startPoint, pt);
      const x = clamp(raw.x, 0, canvas.width - 1);
      const y = clamp(raw.y, 0, canvas.height - 1);
      const w = clamp(raw.x + raw.w, 0, canvas.width) - x;
      const h = clamp(raw.y + raw.h, 0, canvas.height) - y;
      if (w >= 2 && h >= 2) {
        const imgData = ctx.getImageData(x, y, w, h);
        ctx.fillStyle = color2;
        ctx.fillRect(x, y, w, h);
        setSelection({ rect: { x, y, w, h }, imageData: imgData });
      }
    } else if (op.kind === 'marquee-free') {
      redrawOverlay();
      const pts = op.freePoints ?? [];
      if (pts.length >= 3) {
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const x = clamp(Math.min(...xs), 0, canvas.width - 1);
        const y = clamp(Math.min(...ys), 0, canvas.height - 1);
        const maxX = clamp(Math.max(...xs), 0, canvas.width);
        const maxY = clamp(Math.max(...ys), 0, canvas.height);
        const w = maxX - x;
        const h = maxY - y;
        if (w >= 2 && h >= 2) {
          const imgData = ctx.getImageData(x, y, w, h);
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = w;
          maskCanvas.height = h;
          const mctx = maskCanvas.getContext('2d')!;
          mctx.beginPath();
          mctx.moveTo(pts[0].x - x, pts[0].y - y);
          for (let i = 1; i < pts.length; i++) {
            mctx.lineTo(pts[i].x - x, pts[i].y - y);
          }
          mctx.closePath();
          mctx.fillStyle = '#000';
          mctx.fill();

          // Erase masked region on canvas with color2
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = color2;
          ctx.fill();
          ctx.restore();

          setSelection({ rect: { x, y, w, h }, imageData: imgData, maskCanvas });
        }
      }
    } else if (op.kind === 'text-drag') {
      const r = normalizeRect(op.startPoint, pt);
      const boxW = Math.max(160, r.w);
      const boxH = Math.max(48, r.h);
      setTextBox({
        x: clamp(r.w < 6 ? op.startPoint.x : r.x, 0, Math.max(0, canvas.width - 60)),
        y: clamp(r.h < 6 ? op.startPoint.y : r.y, 0, Math.max(0, canvas.height - 30)),
        w: boxW,
        h: boxH,
        text: '',
        fontFamily: textFont,
        fontSize: textSize,
        bold: textBold,
        italic: textItalic,
        underline: textUnderline,
        opaque: textOpaque,
      });
      window.setTimeout(() => textInputRef.current?.focus(), 0);
    } else if (op.kind === 'draw-shape') {
      setPendingShape((prev) => {
        if (!prev) return null;
        if (prev.shape === 'curve') {
          return { ...prev, curveStage: 'c1' };
        }
        return prev;
      });
    } else if (op.kind === 'curve-ctrl') {
      setPendingShape((prev) => {
        if (!prev) return null;
        if (prev.curveStage === 'ready') {
          window.setTimeout(() => commitPendingShape(prev), 0);
        }
        return prev;
      });
    }
  };

  // Drag / Resize handlers for active selection box
  const startSelectionDrag = (
    e: ReactPointerEvent<HTMLDivElement>,
    mode: 'move' | 'resize',
    handle?: string,
  ) => {
    if (!selection) return;
    e.stopPropagation();
    e.preventDefault();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const orig = { ...selection.rect };
    const scale = zoom / 100;

    const onMove = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - startClientX) / scale);
      const dy = Math.round((ev.clientY - startClientY) / scale);
      if (mode === 'move') {
        setSelection((prev) =>
          prev ? { ...prev, rect: { ...orig, x: orig.x + dx, y: orig.y + dy } } : null,
        );
      } else if (handle) {
        let { x, y, w, h } = orig;
        if (handle.includes('e')) w = Math.max(4, orig.w + dx);
        if (handle.includes('s')) h = Math.max(4, orig.h + dy);
        if (handle.includes('w')) {
          const nw = Math.max(4, orig.w - dx);
          x = orig.x + (orig.w - nw);
          w = nw;
        }
        if (handle.includes('n')) {
          const nh = Math.max(4, orig.h - dy);
          y = orig.y + (orig.h - nh);
          h = nh;
        }
        setSelection((prev) => (prev ? { ...prev, rect: { x, y, w, h } } : null));
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Drag / Resize handlers for pending shape box
  const startShapeDrag = (
    e: ReactPointerEvent<HTMLDivElement>,
    mode: 'move' | 'resize',
    handle?: string,
  ) => {
    if (!pendingShape) return;
    e.stopPropagation();
    e.preventDefault();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origStart = { ...pendingShape.start };
    const origEnd = { ...pendingShape.end };
    const scale = zoom / 100;

    const onMove = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - startClientX) / scale);
      const dy = Math.round((ev.clientY - startClientY) / scale);
      if (mode === 'move') {
        setPendingShape((prev) =>
          prev
            ? {
                ...prev,
                start: { x: origStart.x + dx, y: origStart.y + dy },
                end: { x: origEnd.x + dx, y: origEnd.y + dy },
              }
            : null,
        );
      } else if (handle) {
        const r = normalizeRect(origStart, origEnd);
        let { x, y, w, h } = r;
        if (handle.includes('e')) w = Math.max(2, r.w + dx);
        if (handle.includes('s')) h = Math.max(2, r.h + dy);
        if (handle.includes('w')) {
          const nw = Math.max(2, r.w - dx);
          x = r.x + (r.w - nw);
          w = nw;
        }
        if (handle.includes('n')) {
          const nh = Math.max(2, r.h - dy);
          y = r.y + (r.h - nh);
          h = nh;
        }
        setPendingShape((prev) =>
          prev ? { ...prev, start: { x, y }, end: { x: x + w, y: y + h } } : null,
        );
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Canvas outer resize handles (right, bottom, bottom-right)
  const startCanvasResize = (
    e: ReactPointerEvent<HTMLDivElement>,
    axis: 'e' | 's' | 'se',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initW = canvasWidth;
    const initH = canvasHeight;
    const scale = zoom / 100;
    let latestW = initW;
    let latestH = initH;

    setResizePreview({ w: initW, h: initH });

    const onMove = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - startX) / scale);
      const dy = Math.round((ev.clientY - startY) / scale);
      latestW = axis.includes('e') ? clamp(initW + dx, 1, 4096) : initW;
      latestH = axis.includes('s') ? clamp(initH + dy, 1, 4096) : initH;
      setResizePreview({ w: latestW, h: latestH });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResizePreview(null);
      resizeCanvasBounds(latestW, latestH);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Keep pendingShape synced with live style/color changes
  useEffect(() => {
    setPendingShape((prev) =>
      prev
        ? {
            ...prev,
            outlineColor: color1,
            fillColor: color2,
            outlineStyle,
            fillStyle,
            lineWidth: strokeSize,
          }
        : null,
    );
  }, [color1, color2, outlineStyle, fillStyle, strokeSize]);

  // Keep textBox synced with toolbar changes
  useEffect(() => {
    setTextBox((prev) =>
      prev
        ? {
            ...prev,
            fontFamily: textFont,
            fontSize: textSize,
            bold: textBold,
            italic: textItalic,
            underline: textUnderline,
            opaque: textOpaque,
          }
        : null,
    );
  }, [textFont, textSize, textBold, textItalic, textUnderline, textOpaque]);

  const handlePaletteColorPick = (hex: string, button: number) => {
    if (button === 2) {
      setColor2(hex);
    } else if (activeColorSlot === 1) {
      setColor1(hex);
    } else {
      setColor2(hex);
    }
  };

  const handleAddCustomColor = (hex: string) => {
    setCustomColors((prev) => {
      const emptyIdx = prev.findIndex((c) => c === null);
      const next = [...prev];
      if (emptyIdx >= 0) next[emptyIdx] = hex;
      else next[0] = hex;
      return next;
    });
  };

  const scale = zoom / 100;
  const scaledW = Math.round(canvasWidth * scale);
  const scaledH = Math.round(canvasHeight * scale);

  const canvasCursor = useMemo(() => {
    switch (activeTool) {
      case 'pencil':
      case 'brush':
      case 'select-rect':
      case 'select-free':
      case 'shape':
      case 'picker':
      case 'fill':
        return 'crosshair';
      case 'text':
        return 'text';
      case 'magnifier':
        return 'zoom-in';
      case 'eraser':
        return 'cell';
    }
  }, [activeTool]);

  const activeBoxRect: Rect | null = selection
    ? selection.rect
    : pendingShape && pendingShape.shape !== 'polygon' && pendingShape.shape !== 'curve'
      ? normalizeRect(pendingShape.start, pendingShape.end)
      : null;

  const statusSelectionSize = selection
    ? `${Math.round(selection.rect.w)} × ${Math.round(selection.rect.h)}px`
    : pendingShape
      ? (() => {
          const r = normalizeRect(pendingShape.start, pendingShape.end);
          return `${Math.round(r.w)} × ${Math.round(r.h)}px`;
        })()
      : resizePreview
        ? `${resizePreview.w} × ${resizePreview.h}px`
        : '';

  const rulerStep = zoom >= 300 ? 20 : zoom >= 100 ? 50 : 100;
  const horizontalTicks = useMemo(() => {
    const arr: number[] = [];
    for (let x = 0; x <= canvasWidth; x += rulerStep) arr.push(x);
    return arr;
  }, [canvasWidth, rulerStep]);
  const verticalTicks = useMemo(() => {
    const arr: number[] = [];
    for (let y = 0; y <= canvasHeight; y += rulerStep) arr.push(y);
    return arr;
  }, [canvasHeight, rulerStep]);

  return (
    <div
      ref={rootRef}
      className="flex flex-col flex-1 min-h-0 bg-[#f5f6f7] text-[#1e1e1e] select-none relative text-[11.5px]"
    >
      {/* Hidden input for importing local images */}
      <input
        ref={localFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLocalFileChange}
      />

      {/* Top Ribbon Tab Bar + Quick Access Toolbar */}
      <div
        ref={menuContainerRef}
        className="shrink-0 bg-white border-b border-[#dadbdc] relative z-30"
      >
        <div className="flex items-center justify-between h-[24px] px-1 border-b border-[#dadbdc] bg-white">
          <div className="flex items-end h-full gap-0.5">
            {/* File button */}
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen((v) => !v);
                setOpenDropdown(null);
              }}
              className="h-[22px] px-4 bg-[#1979ca] hover:bg-[#1f87df] text-white text-[12px] flex items-center cursor-default"
            >
              File
            </button>

            {/* Home Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('home');
                setFileMenuOpen(false);
                if (ribbonCollapsed) setRibbonCollapsed(false);
              }}
              className={[
                'h-[22px] px-3.5 text-[12px] border-t border-x cursor-default',
                activeTab === 'home' && !ribbonCollapsed
                  ? 'bg-[#f5f6f7] border-[#dadbdc] text-[#1e1e1e] -mb-px pb-px'
                  : 'bg-transparent border-transparent text-[#333] hover:bg-[#edf4fc]',
              ].join(' ')}
            >
              Home
            </button>

            {/* View Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('view');
                setFileMenuOpen(false);
                if (ribbonCollapsed) setRibbonCollapsed(false);
              }}
              className={[
                'h-[22px] px-3.5 text-[12px] border-t border-x cursor-default',
                activeTab === 'view' && !ribbonCollapsed
                  ? 'bg-[#f5f6f7] border-[#dadbdc] text-[#1e1e1e] -mb-px pb-px'
                  : 'bg-transparent border-transparent text-[#333] hover:bg-[#edf4fc]',
              ].join(' ')}
            >
              View
            </button>

            {/* Quick Access Toolbar */}
            <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-[#e1e1e1] h-4">
              <button
                type="button"
                title="Save (Ctrl+S)"
                onClick={() => void handleSave()}
                className="w-5 h-5 flex items-center justify-center hover:bg-[#e5f1fb] rounded-[2px] cursor-default"
              >
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <path d="M2,2 h9 l3,3 v9 h-12 z" fill="#4f81bd" stroke="#2f528f" strokeWidth="1" />
                  <rect x="4.5" y="2" width="5.5" height="4" fill="#fff" />
                  <rect x="4" y="8.5" width="8" height="5.5" fill="#fff" />
                </svg>
              </button>
              <button
                type="button"
                title="Undo (Ctrl+Z)"
                disabled={!historyMeta.canUndo && !selection && !pendingShape && !textBox}
                onClick={handleUndo}
                className="w-5 h-5 flex items-center justify-center hover:bg-[#e5f1fb] disabled:opacity-35 rounded-[2px] cursor-default"
              >
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#1e6ab3" strokeWidth="1.6" aria-hidden="true">
                  <path d="M5 6H11a3 3 0 0 1 0 6H7" />
                  <polyline points="7,3.5 4.5,6 7,8.5" />
                </svg>
              </button>
              <button
                type="button"
                title="Redo (Ctrl+Y)"
                disabled={!historyMeta.canRedo}
                onClick={handleRedo}
                className="w-5 h-5 flex items-center justify-center hover:bg-[#e5f1fb] disabled:opacity-35 rounded-[2px] cursor-default"
              >
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#1e6ab3" strokeWidth="1.6" aria-hidden="true">
                  <path d="M11 6H5a3 3 0 0 0 0 6h4" />
                  <polyline points="9,3.5 11.5,6 9,8.5" />
                </svg>
              </button>
            </div>
          </div>

          <button
            type="button"
            title={ribbonCollapsed ? 'Expand the Ribbon' : 'Minimize the Ribbon'}
            onClick={() => setRibbonCollapsed((v) => !v)}
            className="w-6 h-5 flex items-center justify-center hover:bg-[#e5f1fb] text-[#555] cursor-default"
          >
            {ribbonCollapsed ? '▾' : '▴'}
          </button>
        </div>

        {/* File Dropdown Menu */}
        {fileMenuOpen && (
          <div className="absolute left-0 top-[24px] w-[220px] bg-white border border-[#999] shadow-lg z-40 py-1 text-[12px]">
            <button
              type="button"
              onClick={handleNewCanvas}
              className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-[#e5f3ff] text-left cursor-default"
            >
              <span>New</span>
              <span className="text-[#777] text-[11px]">Ctrl+N</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen(false);
                commitAllFloating();
                setOpenDialog('open');
              }}
              className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-[#e5f3ff] text-left cursor-default"
            >
              <span>Open...</span>
              <span className="text-[#777] text-[11px]">Ctrl+O</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-[#e5f3ff] text-left cursor-default"
            >
              <span>Save</span>
              <span className="text-[#777] text-[11px]">Ctrl+S</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen(false);
                commitAllFloating();
                setOpenDialog('saveAs');
              }}
              className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-[#e5f3ff] text-left cursor-default"
            >
              <span>Save as...</span>
              <span className="text-[#777] text-[11px]">Ctrl+Shift+S</span>
            </button>
            <div className="my-1 border-t border-[#e5e5e5]" />
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen(false);
                localFileInputRef.current?.click();
              }}
              className="w-full px-4 py-1.5 hover:bg-[#e5f3ff] text-left cursor-default"
            >
              Import from Computer...
            </button>
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen(false);
                const clean = currentFileName.replace(/\.(png|jpe?g|bmp|webp|gif)$/i, '');
                void handleDownloadToPc(`${clean || 'Untitled'}.png`, 'png');
              }}
              className="w-full px-4 py-1.5 hover:bg-[#e5f3ff] text-left cursor-default"
            >
              Export PNG to Computer
            </button>
            <div className="my-1 border-t border-[#e5e5e5]" />
            <button
              type="button"
              onClick={handleClearCanvas}
              className="w-full px-4 py-1.5 hover:bg-[#e5f3ff] text-left cursor-default"
            >
              Clear canvas
            </button>
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen(false);
                setOpenDialog('properties');
              }}
              className="w-full px-4 py-1.5 hover:bg-[#e5f3ff] text-left cursor-default"
            >
              Properties
            </button>
            <div className="my-1 border-t border-[#e5e5e5]" />
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen(false);
                setOpenDialog('about');
              }}
              className="w-full px-4 py-1.5 hover:bg-[#e5f3ff] text-left cursor-default"
            >
              About Paint
            </button>
          </div>
        )}

        {/* Home Ribbon */}
        {!ribbonCollapsed && activeTab === 'home' && (
          <div className="flex flex-wrap items-stretch min-h-[94px] bg-[#f5f6f7] px-1.5 py-1 gap-y-1">
            {/* CLIPBOARD */}
            <div className="flex flex-col justify-between pr-1.5 border-r border-[#dadbdc] shrink-0 h-[86px]">
              <div className="flex items-center gap-0.5 flex-1">
                <button
                  type="button"
                  onClick={() => void handlePaste()}
                  title="Paste (Ctrl+V)"
                  className="flex flex-col items-center justify-center w-[38px] h-[62px] hover:bg-[#e5f1fb] border border-transparent hover:border-[#a9d0f5] rounded-[2px] cursor-default"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <rect x="5" y="4" width="12" height="16" rx="1" fill="#d9b273" stroke="#7d5c2b" strokeWidth="1.2" />
                    <rect x="8" y="2" width="6" height="3" rx="1" fill="#b8c4d0" stroke="#5a6b7c" strokeWidth="1" />
                    <rect x="10" y="9" width="9" height="12" fill="#fff" stroke="#4f6d8c" strokeWidth="1.2" />
                    <line x1="12" y1="13" x2="17" y2="13" stroke="#666" strokeWidth="1" />
                    <line x1="12" y1="16" x2="17" y2="16" stroke="#666" strokeWidth="1" />
                  </svg>
                  <span className="text-[10.5px] leading-tight mt-0.5">Paste</span>
                </button>

                <div className="flex flex-col justify-center gap-0.5">
                  <button
                    type="button"
                    disabled={!selection}
                    onClick={() => void handleCutSelection()}
                    title="Cut (Ctrl+X)"
                    className="flex items-center gap-1 px-1 py-0.5 hover:bg-[#e5f1fb] disabled:opacity-40 rounded-[2px] cursor-default text-[11px]"
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#3c6082" strokeWidth="1.3" aria-hidden="true">
                      <circle cx="4.5" cy="12" r="2" />
                      <circle cx="11.5" cy="12" r="2" />
                      <line x1="5.8" y1="10.4" x2="11" y2="2.5" />
                      <line x1="10.2" y1="10.4" x2="5" y2="2.5" />
                    </svg>
                    <span>Cut</span>
                  </button>
                  <button
                    type="button"
                    disabled={!selection}
                    onClick={() => void handleCopySelection()}
                    title="Copy (Ctrl+C)"
                    className="flex items-center gap-1 px-1 py-0.5 hover:bg-[#e5f1fb] disabled:opacity-40 rounded-[2px] cursor-default text-[11px]"
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="#fff" stroke="#3c6082" strokeWidth="1.2" aria-hidden="true">
                      <rect x="2.5" y="2" width="7" height="9" />
                      <rect x="6" y="5" width="7.5" height="9" />
                    </svg>
                    <span>Copy</span>
                  </button>
                </div>
              </div>
              <div className="text-center text-[10px] leading-none text-[#666] pt-0.5">Clipboard</div>
            </div>

            {/* IMAGE */}
            <div className="flex flex-col justify-between px-1.5 border-r border-[#dadbdc] shrink-0 h-[86px]">
              <div className="flex items-center gap-0.5 flex-1 relative">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'select' ? null : 'select')}
                    className={[
                      'flex flex-col items-center justify-center w-[42px] h-[62px] border rounded-[2px] cursor-default',
                      activeTool === 'select-rect' || activeTool === 'select-free'
                        ? 'bg-[#cce4f7] border-[#62a2e4]'
                        : 'border-transparent hover:bg-[#e5f1fb] hover:border-[#a9d0f5]',
                    ].join(' ')}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="14"
                        fill="none"
                        stroke="#2b579a"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                      />
                    </svg>
                    <span className="text-[10.5px] leading-tight mt-0.5">Select ▾</span>
                  </button>

                  {openDropdown === 'select' && (
                    <div className="absolute left-0 top-[64px] w-[180px] bg-white border border-[#999] shadow-lg z-50 py-1">
                      <button
                        type="button"
                        onClick={() => handleSelectTool('select-rect')}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] flex items-center justify-between cursor-default"
                      >
                        <span>Rectangular selection</span>
                        {activeTool === 'select-rect' && <span>✓</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTool('select-free')}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] flex items-center justify-between cursor-default"
                      >
                        <span>Free-form selection</span>
                        {activeTool === 'select-free' && <span>✓</span>}
                      </button>
                      <div className="my-1 border-t border-[#e5e5e5]" />
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] cursor-default"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        disabled={!selection}
                        onClick={handleInvertSelection}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] disabled:opacity-40 cursor-default"
                      >
                        Invert color
                      </button>
                      <button
                        type="button"
                        disabled={!selection}
                        onClick={() => {
                          handleDeleteSelection();
                          setOpenDropdown(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] disabled:opacity-40 cursor-default"
                      >
                        Delete
                      </button>
                      <div className="my-1 border-t border-[#e5e5e5]" />
                      <button
                        type="button"
                        onClick={() => {
                          setTransparentSelection((v) => !v);
                          setOpenDropdown(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] flex items-center justify-between cursor-default"
                      >
                        <span>Transparent selection</span>
                        {transparentSelection && <span>✓</span>}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center gap-0.5 text-[11px]">
                  <button
                    type="button"
                    disabled={!selection}
                    onClick={handleCropToSelection}
                    className="flex items-center gap-1 px-1 py-0.5 hover:bg-[#e5f1fb] disabled:opacity-40 rounded-[2px] cursor-default"
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#2c5482" strokeWidth="1.4" aria-hidden="true">
                      <path d="M4 1v10h10M1 4h10v10" />
                    </svg>
                    <span>Crop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      commitAllFloating();
                      setOpenDialog('resize');
                    }}
                    className="flex items-center gap-1 px-1 py-0.5 hover:bg-[#e5f1fb] rounded-[2px] cursor-default"
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#2c5482" strokeWidth="1.2" aria-hidden="true">
                      <rect x="2" y="2" width="12" height="12" strokeDasharray="2 1" />
                      <rect x="2" y="7" width="7" height="7" fill="#dceafa" />
                    </svg>
                    <span>Resize</span>
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'rotate' ? null : 'rotate')}
                      className="flex items-center gap-1 px-1 py-0.5 hover:bg-[#e5f1fb] rounded-[2px] cursor-default"
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#2c5482" strokeWidth="1.3" aria-hidden="true">
                        <path d="M12.5 7.5A4.5 4.5 0 1 1 8 3" />
                        <polyline points="8,1 10.5,3 8,5" />
                      </svg>
                      <span>Rotate ▾</span>
                    </button>
                    {openDropdown === 'rotate' && (
                      <div className="absolute left-0 top-[22px] w-[160px] bg-white border border-[#999] shadow-lg z-50 py-1">
                        <button
                          type="button"
                          onClick={() => handleRotateFlip('cw90')}
                          className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] cursor-default"
                        >
                          Rotate right 90°
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotateFlip('ccw90')}
                          className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] cursor-default"
                        >
                          Rotate left 90°
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotateFlip('180')}
                          className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] cursor-default"
                        >
                          Rotate 180°
                        </button>
                        <div className="my-1 border-t border-[#e5e5e5]" />
                        <button
                          type="button"
                          onClick={() => handleRotateFlip('flipV')}
                          className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] cursor-default"
                        >
                          Flip vertical
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotateFlip('flipH')}
                          className="w-full px-3 py-1.5 text-left hover:bg-[#e5f3ff] cursor-default"
                        >
                          Flip horizontal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-center text-[10px] leading-none text-[#666] pt-0.5">Image</div>
            </div>

            {/* TOOLS (2x3 grid) */}
            <div className="flex flex-col justify-between px-1.5 border-r border-[#dadbdc] shrink-0 h-[86px]">
              <div className="grid grid-cols-3 gap-0.5 my-auto">
                {(
                  [
                    { id: 'pencil', label: 'Pencil' },
                    { id: 'fill', label: 'Fill with color' },
                    { id: 'text', label: 'Text' },
                    { id: 'eraser', label: 'Eraser' },
                    { id: 'picker', label: 'Color picker' },
                    { id: 'magnifier', label: 'Magnifier' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    title={t.label}
                    onClick={() => handleSelectTool(t.id)}
                    className={[
                      'w-[22px] h-[22px] flex items-center justify-center border rounded-[2px] cursor-default',
                      activeTool === t.id
                        ? 'bg-[#cce4f7] border-[#62a2e4]'
                        : 'border-transparent hover:bg-[#e5f1fb] hover:border-[#a9d0f5]',
                    ].join(' ')}
                  >
                    <ToolIcon tool={t.id} />
                  </button>
                ))}
              </div>
              <div className="text-center text-[10px] leading-none text-[#666] pt-0.5">Tools</div>
            </div>

            {/* BRUSHES */}
            <div className="flex flex-col justify-between px-1.5 border-r border-[#dadbdc] shrink-0 relative h-[86px]">
              <div className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (activeTool !== 'brush') {
                      handleSelectTool('brush');
                    } else {
                      setOpenDropdown(openDropdown === 'brushes' ? null : 'brushes');
                    }
                  }}
                  title="Brushes"
                  className={[
                    'flex flex-col items-center justify-center w-[46px] h-[62px] border rounded-[2px] cursor-default',
                    activeTool === 'brush'
                      ? 'bg-[#cce4f7] border-[#62a2e4]'
                      : 'border-transparent hover:bg-[#e5f1fb] hover:border-[#a9d0f5]',
                  ].join(' ')}
                >
                  <BrushIcon brush={activeBrush} size={22} />
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdown(openDropdown === 'brushes' ? null : 'brushes');
                    }}
                    className="text-[10.5px] leading-tight mt-0.5"
                  >
                    Brushes ▾
                  </span>
                </button>
              </div>
              <div className="text-center text-[10px] leading-none text-[#666] pt-0.5">Brushes</div>

              {openDropdown === 'brushes' && (
                <div className="absolute left-0 top-[68px] w-[195px] bg-white border border-[#999] shadow-lg z-50 p-1.5 grid grid-cols-3 gap-1">
                  {BRUSH_OPTIONS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      title={b.label}
                      onClick={() => {
                        setActiveBrush(b.id);
                        handleSelectTool('brush');
                      }}
                      className={[
                        'flex flex-col items-center justify-center p-1.5 border rounded-[2px] cursor-default',
                        activeBrush === b.id && activeTool === 'brush'
                          ? 'bg-[#cce4f7] border-[#62a2e4]'
                          : 'border-transparent hover:bg-[#e5f3ff]',
                      ].join(' ')}
                    >
                      <BrushIcon brush={b.id} size={20} />
                      <span className="text-[9.5px] truncate max-w-full mt-0.5">
                        {b.label.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SHAPES */}
            <div className="flex flex-col justify-between px-1.5 border-r border-[#dadbdc] shrink-0 h-[86px]">
              <div className="flex items-center gap-1 flex-1">
                <div className="grid grid-cols-8 gap-[1px] bg-white border border-[#cfcfcf] p-[3px] h-[60px] content-start">
                  {SHAPE_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      title={s.label}
                      onClick={() => {
                        setActiveShape(s.id);
                        handleSelectTool('shape');
                      }}
                      className={[
                        'w-[18px] h-[17px] flex items-center justify-center border rounded-[1px] cursor-default',
                        activeTool === 'shape' && activeShape === s.id
                          ? 'bg-[#cce4f7] border-[#62a2e4]'
                          : 'border-transparent hover:bg-[#e5f1fb]',
                      ].join(' ')}
                    >
                      <ShapeIcon shape={s.id} />
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-0.5 relative text-[11px]">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'outline' ? null : 'outline')}
                    className="flex items-center justify-between gap-1 px-1.5 py-1 hover:bg-[#e5f1fb] border border-transparent hover:border-[#a9d0f5] rounded-[2px] text-left cursor-default"
                  >
                    <span>Outline ▾</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'fill' ? null : 'fill')}
                    className="flex items-center justify-between gap-1 px-1.5 py-1 hover:bg-[#e5f1fb] border border-transparent hover:border-[#a9d0f5] rounded-[2px] text-left cursor-default"
                  >
                    <span>Fill ▾</span>
                  </button>

                  {(openDropdown === 'outline' || openDropdown === 'fill') && (
                    <div className="absolute left-0 top-[56px] w-[150px] bg-white border border-[#999] shadow-lg z-50 py-1">
                      {SHAPE_STYLE_OPTIONS.map((opt) => {
                        const isOutline = openDropdown === 'outline';
                        const active = isOutline ? outlineStyle === opt.id : fillStyle === opt.id;
                        const label =
                          opt.id === 'none'
                            ? isOutline
                              ? 'No outline'
                              : 'No fill'
                            : opt.label;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (isOutline) setOutlineStyle(opt.id);
                              else setFillStyle(opt.id);
                              setOpenDropdown(null);
                            }}
                            className="w-full px-3 py-1 text-left hover:bg-[#e5f3ff] flex items-center justify-between cursor-default"
                          >
                            <span>{label}</span>
                            {active && <span>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center text-[10px] leading-none text-[#666] pt-0.5">Shapes</div>
            </div>

            {/* SIZE */}
            <div className="flex flex-col justify-between px-1.5 border-r border-[#dadbdc] shrink-0 relative h-[86px]">
              <div className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'size' ? null : 'size')}
                  className="flex flex-col items-center justify-center w-[38px] h-[62px] hover:bg-[#e5f1fb] border border-transparent hover:border-[#a9d0f5] rounded-[2px] cursor-default"
                >
                  <div className="flex flex-col justify-center gap-1 w-5">
                    <div className="h-[1px] bg-[#2c5482]" />
                    <div className="h-[2px] bg-[#2c5482]" />
                    <div className="h-[3.5px] bg-[#2c5482]" />
                    <div className="h-[5px] bg-[#2c5482]" />
                  </div>
                  <span className="text-[10.5px] leading-tight mt-1">Size ▾</span>
                </button>
              </div>
              <div className="text-center text-[10px] leading-none text-[#666] pt-0.5">Size</div>

              {openDropdown === 'size' && (
                <div className="absolute left-0 top-[68px] w-[140px] bg-white border border-[#999] shadow-lg z-50 p-1.5 space-y-1">
                  {SIZE_PRESETS.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        setStrokeSize(sz);
                        setOpenDropdown(null);
                      }}
                      className={[
                        'w-full flex items-center gap-2 px-2 py-1.5 border rounded-[2px] cursor-default',
                        strokeSize === sz
                          ? 'bg-[#cce4f7] border-[#62a2e4]'
                          : 'border-transparent hover:bg-[#e5f3ff]',
                      ].join(' ')}
                    >
                      <div className="flex-1 bg-[#1e1e1e]" style={{ height: sz }} />
                      <span className="text-[10.5px] w-7 text-right">{sz}px</span>
                    </button>
                  ))}
                  <div className="pt-1 border-t border-[#e5e5e5] flex items-center gap-1.5 px-1">
                    <input
                      type="range"
                      min={1}
                      max={40}
                      value={strokeSize}
                      onChange={(e) => setStrokeSize(Number(e.target.value))}
                      className="w-full accent-[#0078d7]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* COLORS */}
            <div className="flex flex-col justify-between pl-1.5 pr-1 shrink-0 h-[86px]">
              <div className="flex items-center gap-1.5 flex-1">
                {/* Color 1 & Color 2 */}
                <button
                  type="button"
                  onClick={() => setActiveColorSlot(1)}
                  className={[
                    'flex flex-col items-center justify-center w-[38px] h-[60px] border rounded-[2px] cursor-default',
                    activeColorSlot === 1
                      ? 'bg-[#cce4f7] border-[#62a2e4]'
                      : 'border-transparent hover:bg-[#e5f1fb]',
                  ].join(' ')}
                >
                  <div className="w-6 h-6 border border-[#7f7f7f] p-0.5 bg-white">
                    <div className="w-full h-full" style={{ backgroundColor: color1 }} />
                  </div>
                  <span className="text-[10px] leading-tight mt-0.5 text-center">Color 1</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveColorSlot(2)}
                  className={[
                    'flex flex-col items-center justify-center w-[38px] h-[60px] border rounded-[2px] cursor-default',
                    activeColorSlot === 2
                      ? 'bg-[#cce4f7] border-[#62a2e4]'
                      : 'border-transparent hover:bg-[#e5f1fb]',
                  ].join(' ')}
                >
                  <div className="w-5 h-5 border border-[#7f7f7f] p-0.5 bg-white mt-0.5">
                    <div className="w-full h-full" style={{ backgroundColor: color2 }} />
                  </div>
                  <span className="text-[10px] leading-tight mt-1 text-center">Color 2</span>
                </button>

                {/* 3x10 Palette Grid */}
                <div className="grid grid-cols-10 gap-[2px] my-auto">
                  {DEFAULT_PALETTE_COLORS.map((hex, i) => (
                    <button
                      key={`p-${i}`}
                      type="button"
                      title={hex}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePaletteColorPick(hex, e.button);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-[16px] h-[16px] border border-[#a0a0a0] p-[1px] bg-white hover:border-[#0078d7] cursor-default"
                    >
                      <div className="w-full h-full" style={{ backgroundColor: hex }} />
                    </button>
                  ))}
                  {customColors.map((hex, i) => (
                    <button
                      key={`c-${i}`}
                      type="button"
                      title={hex ?? 'Custom color'}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (hex) handlePaletteColorPick(hex, e.button);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-[16px] h-[16px] border border-[#b5b5b5] p-[1px] bg-white hover:border-[#0078d7] cursor-default"
                    >
                      <div
                        className="w-full h-full"
                        style={{ backgroundColor: hex ?? '#f5f6f7' }}
                      />
                    </button>
                  ))}
                </div>

                {/* Edit Colors */}
                <button
                  type="button"
                  onClick={() => setOpenDialog('editColors')}
                  className="flex flex-col items-center justify-center w-[42px] h-[60px] hover:bg-[#e5f1fb] border border-transparent hover:border-[#a9d0f5] rounded-[2px] cursor-default"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <defs>
                      <linearGradient id="paint-edit-rainbow" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ff3b30" />
                        <stop offset="25%" stopColor="#ffcc00" />
                        <stop offset="50%" stopColor="#34c759" />
                        <stop offset="75%" stopColor="#007aff" />
                        <stop offset="100%" stopColor="#af52de" />
                      </linearGradient>
                    </defs>
                    <rect x="3" y="3" width="18" height="18" rx="2" fill="url(#paint-edit-rainbow)" stroke="#666" strokeWidth="1" />
                  </svg>
                  <span className="text-[10px] leading-tight mt-0.5 text-center">Edit colors</span>
                </button>
              </div>
              <div className="text-center text-[10px] leading-none text-[#666] pt-0.5">Colors</div>
            </div>
          </div>
        )}

        {/* View Ribbon */}
        {!ribbonCollapsed && activeTab === 'view' && (
          <div className="flex items-stretch h-[92px] bg-[#f5f6f7] px-2 py-1 gap-2">
            {/* Zoom group */}
            <div className="flex flex-col justify-between pr-3 border-r border-[#dadbdc]">
              <div className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => ZOOM_LEVELS.find((l) => l > z) ?? z)}
                  className="flex flex-col items-center justify-center w-[48px] h-[64px] hover:bg-[#e5f1fb] border border-transparent hover:border-[#a9d0f5] rounded-[2px] cursor-default"
                >
                  <span className="text-[18px] font-semibold text-[#1e6ab3]">+</span>
                  <span className="text-[11px]">Zoom in</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => [...ZOOM_LEVELS].reverse().find((l) => l < z) ?? z)}
                  className="flex flex-col items-center justify-center w-[52px] h-[64px] hover:bg-[#e5f1fb] border border-transparent hover:border-[#a9d0f5] rounded-[2px] cursor-default"
                >
                  <span className="text-[18px] font-semibold text-[#1e6ab3]">−</span>
                  <span className="text-[11px]">Zoom out</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="flex flex-col items-center justify-center w-[48px] h-[64px] hover:bg-[#e5f1fb] border border-transparent hover:border-[#a9d0f5] rounded-[2px] cursor-default"
                >
                  <span className="text-[13px] font-semibold text-[#2c5482] border border-[#2c5482] px-1">
                    100%
                  </span>
                  <span className="text-[11px] mt-1">100%</span>
                </button>
              </div>
              <div className="text-center text-[10.5px] text-[#666]">Zoom</div>
            </div>

            {/* Show or hide */}
            <div className="flex flex-col justify-between pr-3 border-r border-[#dadbdc]">
              <div className="flex flex-col justify-center gap-1 flex-1 px-1">
                <label className="flex items-center gap-2 cursor-default">
                  <input
                    type="checkbox"
                    checked={showRulers}
                    onChange={(e) => setShowRulers(e.target.checked)}
                  />
                  <span>Rulers</span>
                </label>
                <label className="flex items-center gap-2 cursor-default">
                  <input
                    type="checkbox"
                    checked={showGridlines}
                    onChange={(e) => setShowGridlines(e.target.checked)}
                  />
                  <span>Gridlines</span>
                </label>
                <label className="flex items-center gap-2 cursor-default">
                  <input
                    type="checkbox"
                    checked={showStatusBar}
                    onChange={(e) => setShowStatusBar(e.target.checked)}
                  />
                  <span>Status bar</span>
                </label>
              </div>
              <div className="text-center text-[10.5px] text-[#666]">Show or hide</div>
            </div>

            {/* Display */}
            <div className="flex flex-col justify-between pr-2">
              <div className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    commitAllFloating();
                    setIsFullScreen(true);
                  }}
                  className="flex flex-col items-center justify-center w-[62px] h-[64px] hover:bg-[#e5f1fb] border border-transparent hover:border-[#a9d0f5] rounded-[2px] cursor-default"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#2c5482" strokeWidth="1.5" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="14" />
                    <path d="M8 21h8M12 18v3" />
                  </svg>
                  <span className="text-[11px] mt-0.5">Full screen</span>
                </button>
              </div>
              <div className="text-center text-[10.5px] text-[#666]">Display</div>
            </div>
          </div>
        )}

        {/* Contextual Text Toolbar when Text tool or TextBox is active */}
        {(activeTool === 'text' || textBox) && (
          <div className="flex items-center gap-2 px-3 py-1 bg-[#eef4fb] border-t border-[#c9daf0] text-[11.5px]">
            <span className="font-semibold text-[#1e4e8c]">Text:</span>
            <select
              value={textFont}
              onChange={(e) => setTextFont(e.target.value)}
              className="bg-white border border-[#999] px-1.5 py-0.5 text-[11.5px]"
            >
              {TEXT_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              className="bg-white border border-[#999] px-1.5 py-0.5 text-[11.5px] w-14"
            >
              {TEXT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setTextBold((v) => !v)}
              className={[
                'w-6 h-6 font-bold border rounded-[2px] cursor-default',
                textBold ? 'bg-[#cce4f7] border-[#62a2e4]' : 'bg-white border-[#bbb]',
              ].join(' ')}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => setTextItalic((v) => !v)}
              className={[
                'w-6 h-6 italic border rounded-[2px] cursor-default',
                textItalic ? 'bg-[#cce4f7] border-[#62a2e4]' : 'bg-white border-[#bbb]',
              ].join(' ')}
            >
              I
            </button>
            <button
              type="button"
              onClick={() => setTextUnderline((v) => !v)}
              className={[
                'w-6 h-6 underline border rounded-[2px] cursor-default',
                textUnderline ? 'bg-[#cce4f7] border-[#62a2e4]' : 'bg-white border-[#bbb]',
              ].join(' ')}
            >
              U
            </button>
            <div className="flex items-center gap-1 ml-2 border-l border-[#c0d0e0] pl-2">
              <button
                type="button"
                onClick={() => setTextOpaque(true)}
                className={[
                  'px-2 py-0.5 border rounded-[2px] cursor-default',
                  textOpaque ? 'bg-[#cce4f7] border-[#62a2e4]' : 'bg-white border-[#bbb]',
                ].join(' ')}
              >
                Opaque
              </button>
              <button
                type="button"
                onClick={() => setTextOpaque(false)}
                className={[
                  'px-2 py-0.5 border rounded-[2px] cursor-default',
                  !textOpaque ? 'bg-[#cce4f7] border-[#62a2e4]' : 'bg-white border-[#bbb]',
                ].join(' ')}
              >
                Transparent
              </button>
            </div>
            {textBox && (
              <button
                type="button"
                onClick={() => commitTextBox(textBox)}
                className="ml-auto px-2.5 py-0.5 bg-[#1979ca] text-white rounded-[2px] cursor-default"
              >
                Apply Text
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Canvas Workspace (MS Paint blue-gray background #cfd9e7) */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto bg-[#cfd9e7] relative"
        onMouseLeave={() => setCursorCoords(null)}
      >
        <div
          className="inline-block relative"
          style={{
            paddingTop: showRulers ? 22 : 8,
            paddingLeft: showRulers ? 24 : 8,
            paddingRight: 28,
            paddingBottom: 28,
          }}
        >
          {/* Top Ruler */}
          {showRulers && (
            <div
              style={{ width: scaledW, left: 24, top: 0 }}
              className="absolute h-[20px] bg-[#f5f6f7] border-b border-[#a8b3c2] overflow-hidden text-[9px] text-[#555]"
            >
              {horizontalTicks.map((x) => (
                <div
                  key={x}
                  style={{ left: Math.round(x * scale) }}
                  className="absolute top-0 bottom-0 border-l border-[#888] pl-0.5 leading-tight"
                >
                  {x}
                </div>
              ))}
            </div>
          )}

          {/* Left Ruler */}
          {showRulers && (
            <div
              style={{ height: scaledH, top: 22, left: 0 }}
              className="absolute w-[22px] bg-[#f5f6f7] border-r border-[#a8b3c2] overflow-hidden text-[9px] text-[#555]"
            >
              {verticalTicks.map((y) => (
                <div
                  key={y}
                  style={{ top: Math.round(y * scale) }}
                  className="absolute left-0 right-0 border-t border-[#888] pt-0.5 text-center leading-none"
                >
                  {y}
                </div>
              ))}
            </div>
          )}

          {/* Canvas Container */}
          <div
            style={{ width: scaledW, height: scaledH }}
            className="relative bg-white shadow-[1px_2px_6px_rgba(0,0,0,0.22)]"
          >
            <canvas
              ref={canvasRef}
              width={DEFAULT_WIDTH}
              height={DEFAULT_HEIGHT}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onDoubleClick={() => {
                if (pendingShape?.shape === 'polygon') {
                  commitPendingShape(pendingShape);
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                width: scaledW,
                height: scaledH,
                cursor: canvasCursor,
                imageRendering: zoom >= 200 ? 'pixelated' : 'auto',
              }}
              className="block touch-none"
            />

            {/* Preview Overlay Canvas */}
            <canvas
              ref={overlayRef}
              width={canvasWidth}
              height={canvasHeight}
              style={{ width: scaledW, height: scaledH, imageRendering: zoom >= 200 ? 'pixelated' : 'auto' }}
              className="pointer-events-none absolute inset-0"
            />

            {/* Gridlines Overlay */}
            {showGridlines && (
              <div
                style={{
                  backgroundSize: `${Math.max(4, (zoom >= 400 ? 1 : 10) * scale)}px ${Math.max(4, (zoom >= 400 ? 1 : 10) * scale)}px`,
                  backgroundImage:
                    'linear-gradient(to right, rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.12) 1px, transparent 1px)',
                }}
                className="pointer-events-none absolute inset-0"
              />
            )}

            {/* Floating Selection / Shape Interactive Box */}
            {activeBoxRect && (
              <div
                onPointerDown={(e) =>
                  selection
                    ? startSelectionDrag(e, 'move')
                    : startShapeDrag(e, 'move')
                }
                style={{
                  left: activeBoxRect.x * scale,
                  top: activeBoxRect.y * scale,
                  width: Math.max(4, activeBoxRect.w * scale),
                  height: Math.max(4, activeBoxRect.h * scale),
                }}
                className="absolute cursor-move"
              >
                {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((h) => {
                  const posClass =
                    h === 'nw'
                      ? '-left-1 -top-1 cursor-nwse-resize'
                      : h === 'n'
                        ? 'left-1/2 -translate-x-1/2 -top-1 cursor-ns-resize'
                        : h === 'ne'
                          ? '-right-1 -top-1 cursor-nesw-resize'
                          : h === 'e'
                            ? '-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize'
                            : h === 'se'
                              ? '-right-1 -bottom-1 cursor-nwse-resize'
                              : h === 's'
                                ? 'left-1/2 -translate-x-1/2 -bottom-1 cursor-ns-resize'
                                : h === 'sw'
                                  ? '-left-1 -bottom-1 cursor-nesw-resize'
                                  : '-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize';
                  return (
                    <div
                      key={h}
                      onPointerDown={(e) =>
                        selection
                          ? startSelectionDrag(e, 'resize', h)
                          : startShapeDrag(e, 'resize', h)
                      }
                      className={`absolute w-2 h-2 bg-white border border-[#0078d7] ${posClass}`}
                    />
                  );
                })}
              </div>
            )}

            {/* Live Text Input Box */}
            {textBox && (
              <textarea
                ref={textInputRef}
                value={textBox.text}
                onChange={(e) =>
                  setTextBox((prev) => (prev ? { ...prev, text: e.target.value } : null))
                }
                style={{
                  left: textBox.x * scale,
                  top: textBox.y * scale,
                  width: Math.max(80, textBox.w * scale),
                  height: Math.max(36, textBox.h * scale),
                  fontFamily: textBox.fontFamily,
                  fontSize: textBox.fontSize * scale,
                  fontWeight: textBox.bold ? 'bold' : 'normal',
                  fontStyle: textBox.italic ? 'italic' : 'normal',
                  textDecoration: textBox.underline ? 'underline' : 'none',
                  color: color1,
                  backgroundColor: textBox.opaque ? color2 : 'transparent',
                }}
                className="absolute border border-dashed border-[#0078d7] p-1 resize outline-none leading-[1.25] overflow-hidden"
              />
            )}

            {/* Canvas Resize Handles (Right, Bottom, Bottom-Right) */}
            <div
              onPointerDown={(e) => startCanvasResize(e, 'e')}
              title="Resize canvas width"
              className="absolute top-1/2 -right-[6px] -translate-y-1/2 w-[5px] h-[5px] bg-white border border-[#555] cursor-ew-resize"
            />
            <div
              onPointerDown={(e) => startCanvasResize(e, 's')}
              title="Resize canvas height"
              className="absolute left-1/2 -bottom-[6px] -translate-x-1/2 w-[5px] h-[5px] bg-white border border-[#555] cursor-ns-resize"
            />
            <div
              onPointerDown={(e) => startCanvasResize(e, 'se')}
              title="Resize canvas"
              className="absolute -right-[6px] -bottom-[6px] w-[5px] h-[5px] bg-white border border-[#555] cursor-nwse-resize"
            />

            {/* Dashed Resize Preview Outline */}
            {resizePreview && (
              <div
                style={{
                  width: Math.round(resizePreview.w * scale),
                  height: Math.round(resizePreview.h * scale),
                }}
                className="pointer-events-none absolute top-0 left-0 border border-dashed border-[#1e6ab3] bg-[#0078d7]/5"
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      {showStatusBar && (
        <footer className="flex items-center justify-between h-[24px] px-2 bg-[#f0f0f0] border-t border-[#dadbdc] text-[11px] text-[#333] shrink-0">
          <div className="flex items-center h-full">
            <div className="w-[125px] flex items-center gap-1.5 border-r border-[#d4d4d4] pr-2 h-4">
              <span className="text-[#555]">⌖</span>
              <span>{cursorCoords ? `${cursorCoords.x}, ${cursorCoords.y}px` : ''}</span>
            </div>
            <div className="w-[125px] flex items-center gap-1.5 border-r border-[#d4d4d4] px-2 h-4">
              <span>{statusSelectionSize}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 h-4">
              <span>
                {canvasWidth} × {canvasHeight}px
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-9 text-right">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => [...ZOOM_LEVELS].reverse().find((l) => l < z) ?? z)}
              className="w-4 h-4 flex items-center justify-center rounded-full border border-[#999] bg-white hover:bg-[#e5f1fb] leading-none cursor-default"
            >
              −
            </button>
            <input
              type="range"
              min={25}
              max={800}
              step={25}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-24 accent-[#0078d7] h-1"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => ZOOM_LEVELS.find((l) => l > z) ?? z)}
              className="w-4 h-4 flex items-center justify-center rounded-full border border-[#999] bg-white hover:bg-[#e5f1fb] leading-none cursor-default"
            >
              +
            </button>
          </div>
        </footer>
      )}

      {/* Full Screen Preview Overlay */}
      {isFullScreen && (
        <div
          onClick={() => setIsFullScreen(false)}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center cursor-pointer"
          title="Click or press Esc to exit full screen"
        >
          <img
            src={canvasRef.current?.toDataURL('image/png') ?? ''}
            alt="Full screen preview"
            className="max-w-full max-h-full object-contain bg-white"
          />
        </div>
      )}

      {/* Dialogs */}
      {openDialog === 'resize' && (
        <ResizeSkewDialog
          width={canvasWidth}
          height={canvasHeight}
          onApply={handleApplyResizeSkew}
          onClose={() => setOpenDialog(null)}
        />
      )}

      {openDialog === 'editColors' && (
        <EditColorsDialog
          initialColor={activeColorSlot === 1 ? color1 : color2}
          customColors={customColors}
          onSelectColor={(hex) => {
            if (activeColorSlot === 1) setColor1(hex);
            else setColor2(hex);
          }}
          onAddCustomColor={handleAddCustomColor}
          onClose={() => setOpenDialog(null)}
        />
      )}

      {(openDialog === 'open' || openDialog === 'saveAs') && (
        <PaintFileDialog
          mode={openDialog}
          initialFolderId={currentFileId && nodes[currentFileId]?.parentId ? nodes[currentFileId].parentId! : 'desktop'}
          initialFileName={currentFileName === 'Untitled' ? 'Untitled.png' : currentFileName}
          onConfirmOpen={(file) => void handleConfirmOpenFile(file)}
          onConfirmSaveAs={(folderId, fileName, format) =>
            void handleConfirmSaveAs(folderId, fileName, format)
          }
          onImportFromPc={() => localFileInputRef.current?.click()}
          onDownloadToPc={(fileName, format) => void handleDownloadToPc(fileName, format)}
          onClose={() => setOpenDialog(null)}
        />
      )}

      {openDialog === 'properties' && (
        <ImagePropertiesDialog
          width={canvasWidth}
          height={canvasHeight}
          onApply={(w, h) => {
            setOpenDialog(null);
            resizeCanvasBounds(w, h);
          }}
          onClose={() => setOpenDialog(null)}
        />
      )}

      {openDialog === 'about' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="w-[340px] bg-[#f0f0f0] border border-[#707070] shadow-xl text-[#1e1e1e] text-[12px]">
            <div className="flex items-center justify-between bg-white px-3 py-1.5 border-b border-[#dadbdc]">
              <span>About Paint</span>
              <button
                type="button"
                onClick={() => setOpenDialog(null)}
                className="px-1.5 hover:bg-[#e81123] hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex gap-3 items-start">
              <img src="/assets/icons/paint.svg" alt="" className="w-12 h-12 object-contain shrink-0" />
              <div className="space-y-1.5">
                <div className="font-semibold text-[13px]">Windows 10 Paint</div>
                <p className="text-[#444] leading-relaxed">
                  Classic Windows 10 Paint built with HTML5 Canvas, supporting brushes, 23 shapes,
                  flood fill, text, selection transforms, and Virtual File System storage.
                </p>
              </div>
            </div>
            <div className="px-4 pb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenDialog(null)}
                className="px-5 py-1 bg-[#e1e1e1] border border-[#0078d7] hover:bg-[#e5f1fb]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
