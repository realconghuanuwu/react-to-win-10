import { Suspense, lazy, type PointerEvent as ReactPointerEvent } from 'react';
import {
  getTaskbarInsets,
  useDesktopStore,
  type AppWindow,
  type SnapSide,
} from '../../store/useDesktopStore';
import { CalculatorApp } from '../Apps/CalculatorApp';
import { ChromeApp } from '../Apps/ChromeApp';
import { FileExplorerApp } from '../Apps/FileExplorerApp';
import { MediaPlayerApp } from '../Apps/MediaPlayerApp';
import { NotepadApp } from '../Apps/NotepadApp';
import { PaintApp } from '../Apps/PaintApp';
import { PersonalizationSettingsApp } from '../Apps/PersonalizationSettingsApp';
import { TaskManagerApp } from '../Apps/TaskManagerApp';
import { YouTubeDownloaderApp } from '../Apps/YouTubeDownloaderApp';

const OfficeApp = lazy(() =>
  import('../Apps/OfficeApp').then((mod) => ({ default: mod.OfficeApp })),
);
const CodeStudioApp = lazy(() => import('../Apps/CodeStudioApp'));
const PdfToolApp = lazy(() => import('../Apps/pdf/PdfToolApp'));

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const TITLEBAR_HEIGHT = 32;
const SNAP_EDGE_DISTANCE = 16;

const RESIZE_HANDLES: Array<{ dir: ResizeDirection; className: string }> = [
  { dir: 'n', className: 'top-[-3px] left-1.5 right-1.5 h-1.5 cursor-ns-resize' },
  { dir: 's', className: 'bottom-[-3px] left-1.5 right-1.5 h-1.5 cursor-ns-resize' },
  { dir: 'e', className: 'right-[-3px] top-1.5 bottom-1.5 w-1.5 cursor-ew-resize' },
  { dir: 'w', className: 'left-[-3px] top-1.5 bottom-1.5 w-1.5 cursor-ew-resize' },
  { dir: 'nw', className: 'top-[-4px] left-[-4px] w-2.5 h-2.5 cursor-nwse-resize' },
  { dir: 'ne', className: 'top-[-4px] right-[-4px] w-2.5 h-2.5 cursor-nesw-resize' },
  { dir: 'sw', className: 'bottom-[-4px] left-[-4px] w-2.5 h-2.5 cursor-nesw-resize' },
  { dir: 'se', className: 'bottom-[-4px] right-[-4px] w-2.5 h-2.5 cursor-nwse-resize' },
];

interface WindowFrameProps {
  win: AppWindow;
  onSnapPreview: (side: SnapSide | null) => void;
  onSnapDrop: (id: string, side: SnapSide) => void;
}

export function WindowFrame({ win, onSnapPreview, onSnapDrop }: WindowFrameProps) {
  const activeAppId = useDesktopStore((state) => state.activeAppId);
  const explorerStartFolderId = useDesktopStore((state) => state.explorerStartFolderId);
  const taskbarSettings = useDesktopStore((state) => state.taskbarSettings);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const toggleMaximizeWindow = useDesktopStore((state) => state.toggleMaximizeWindow);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const updateWindowBounds = useDesktopStore((state) => state.updateWindowBounds);

  const isActive = activeAppId === win.id;
  const isExplorerApp =
    win.id === 'explorer' || win.id === 'this-pc' || win.id === 'recycle-bin';
  const isDarkApp =
    win.id === 'calculator' ||
    win.id === 'code-studio' ||
    isExplorerApp ||
    win.id === 'settings' ||
    win.id === 'yt-downloader' ||
    win.id === 'pdf-tool' ||
    win.id === 'media-player';
  const handleTitleBarPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as Element).closest('[data-window-control="true"]')) return;

    focusWindow(win.id);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const pointerId = e.pointerId;
    const header = e.currentTarget;
    const grabRatio = (e.clientX - header.getBoundingClientRect().left) / header.clientWidth;
    const restore = win.snapRestoreBounds ?? win;
    const shouldRestore = win.isMaximized || !!win.snapRestoreBounds;
    let dragging = false;
    let previewSide: SnapSide | null = null;

    const getSnapSide = ({ clientX, clientY, pointerType }: PointerEvent): SnapSide | null => {
      if (pointerType !== 'mouse') return null;
      const insets = getTaskbarInsets(useDesktopStore.getState().taskbarSettings);
      if (clientY < insets.top || clientY >= window.innerHeight - insets.bottom) return null;
      const leftDistance = clientX - insets.left;
      const rightDistance = window.innerWidth - insets.right - clientX;
      if (Math.min(leftDistance, rightDistance) > SNAP_EDGE_DISTANCE) return null;
      return leftDistance <= rightDistance ? 'left' : 'right';
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;

      if (!dragging && Math.hypot(dx, dy) < 4) return;
      dragging = true;
      const nextSide = getSnapSide(moveEvent);
      if (nextSide !== previewSide) {
        previewSide = nextSide;
        onSnapPreview(nextSide);
      }

      const insets = getTaskbarInsets(useDesktopStore.getState().taskbarSettings);
      const desktopWidth = window.innerWidth - insets.left - insets.right;
      const desktopHeight = window.innerHeight - insets.top - insets.bottom;

      const x = shouldRestore ? moveEvent.clientX - insets.left - Math.round(restore.width * grabRatio) : win.x + dx;
      const y = shouldRestore ? moveEvent.clientY - insets.top - 16 : win.y + dy;
      const nextX = Math.max(
        -(restore.width - 80),
        Math.min(x, desktopWidth - 80),
      );
      const nextY = Math.max(0, Math.min(y, desktopHeight - TITLEBAR_HEIGHT));

      updateWindowBounds(win.id, {
        x: nextX,
        y: nextY,
        width: restore.width,
        height: restore.height,
      }, shouldRestore);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
      if (header.hasPointerCapture(pointerId)) header.releasePointerCapture(pointerId);
      if (previewSide) onSnapPreview(null);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const side = dragging ? getSnapSide(event) : null;
      cleanup();
      if (side) onSnapDrop(win.id, side);
    };
    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId === pointerId) cleanup();
    };
    const handleWindowBlur = (event: FocusEvent) => {
      if (event.target === window) cleanup();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cleanup();
    };

    header.setPointerCapture(pointerId);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);
  };

  const handleResizePointerDown = (
    dir: ResizeDirection,
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (e.button !== 0 || win.isMaximized) return;
    e.stopPropagation();
    focusWindow(win.id);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = win.x;
    const startY = win.y;
    const startWidth = win.width;
    const startHeight = win.height;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;
      const insets = getTaskbarInsets(taskbarSettings);
      const desktopWidth = window.innerWidth - insets.left - insets.right;
      const desktopHeight = window.innerHeight - insets.top - insets.bottom;

      let nextX = startX;
      let nextY = startY;
      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (dir.includes('e')) {
        nextWidth = Math.max(win.minWidth, Math.min(startWidth + dx, desktopWidth - startX));
      }
      if (dir.includes('s')) {
        nextHeight = Math.max(win.minHeight, Math.min(startHeight + dy, desktopHeight - startY));
      }
      if (dir.includes('w')) {
        const clampedDx = Math.max(-startX, Math.min(dx, startWidth - win.minWidth));
        nextX = startX + clampedDx;
        nextWidth = startWidth - clampedDx;
      }
      if (dir.includes('n')) {
        const clampedDy = Math.max(-startY, Math.min(dy, startHeight - win.minHeight));
        nextY = startY + clampedDy;
        nextHeight = startHeight - clampedDy;
      }

      updateWindowBounds(win.id, {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const frameStyle = win.isMaximized
    ? {
        display: win.isMinimized ? 'none' : 'flex',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex: win.zIndex,
      }
    : {
        display: win.isMinimized ? 'none' : 'flex',
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
      };

  const captionHoverClass = isDarkApp
    ? 'hover:bg-white/10 active:bg-white/15'
    : 'hover:bg-[#e5e5e5] active:bg-[#cccccc]';

  return (
    <section
      role="dialog"
      aria-label={win.title}
      onPointerDown={() => focusWindow(win.id)}
      style={frameStyle}
      className={[
        'pointer-events-auto absolute flex-col select-none',
        isDarkApp ? (isExplorerApp ? 'bg-[#191919]' : 'bg-[#202020]') : 'bg-[#e6e6e6]',
        win.isMaximized
          ? 'border-0 shadow-none'
          : isActive
            ? 'border border-[#1883d7]/75 shadow-[0_10px_30px_rgba(0,0,0,0.42)]'
            : 'border border-[#7a7a7a]/65 shadow-[0_6px_18px_rgba(0,0,0,0.28)]',
      ].join(' ')}
    >
      {!win.isMaximized &&
        RESIZE_HANDLES.map((handle) => (
          <div
            key={handle.dir}
            data-resize-handle={handle.dir}
            onPointerDown={(e) => handleResizePointerDown(handle.dir, e)}
            className={`absolute z-10 ${handle.className}`}
          />
        ))}

      <header
        data-window-titlebar="true"
        onPointerDown={handleTitleBarPointerDown}
        onDoubleClick={() => toggleMaximizeWindow(win.id)}
        className={[
          'flex items-center justify-between h-[32px] shrink-0 pl-3 pr-0',
          isDarkApp
            ? isActive
              ? isExplorerApp
                ? 'bg-[#000000] text-white'
                : 'bg-[#202020] text-white'
              : 'bg-[#202020] text-[#8a8a8a]'
            : isActive
              ? 'bg-white text-[#1f1f1f]'
              : 'bg-white text-[#767676]',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {(isDarkApp ||
            win.id === 'notepad' ||
            win.id === 'paint' ||
            win.id === 'task-manager' ||
            win.id === 'chrome' ||
            win.id === 'word' ||
            win.id === 'excel') && (
            <img
              src={win.icon}
              alt=""
              draggable={false}
              className="w-4 h-4 object-contain shrink-0 pointer-events-none"
            />
          )}
          <span className="text-[12px] font-normal truncate">{win.title}</span>
        </div>

        <div className="flex items-center h-full shrink-0">
          <button
            type="button"
            data-window-control="true"
            aria-label={`Minimize ${win.title}`}
            onClick={(e) => {
              e.stopPropagation();
              minimizeWindow(win.id);
            }}
            className={`flex items-center justify-center w-[46px] h-full transition-colors cursor-default ${captionHoverClass}`}
          >
            <svg viewBox="0 0 10 10" width="10" height="10" stroke="currentColor" strokeWidth="1" fill="none" aria-hidden="true">
              <line x1="0" y1="5" x2="10" y2="5" />
            </svg>
          </button>

          <button
            type="button"
            data-window-control="true"
            aria-label={win.isMaximized ? `Restore ${win.title}` : `Maximize ${win.title}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleMaximizeWindow(win.id);
            }}
            className={`flex items-center justify-center w-[46px] h-full transition-colors cursor-default ${captionHoverClass}`}
          >
            {win.isMaximized ? (
              <svg viewBox="0 0 10 10" width="10" height="10" stroke="currentColor" strokeWidth="1" fill="none" aria-hidden="true">
                <rect x="0.5" y="2.5" width="7" height="7" />
                <polyline points="2.5,2.5 2.5,0.5 9.5,0.5 9.5,7.5 7.5,7.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" width="10" height="10" stroke="currentColor" strokeWidth="1" fill="none" aria-hidden="true">
                <rect x="0.5" y="0.5" width="9" height="9" />
              </svg>
            )}
          </button>

          <button
            type="button"
            data-window-control="true"
            aria-label={`Close ${win.title}`}
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(win.id);
            }}
            className="flex items-center justify-center w-[46px] h-full hover:bg-[#e81123] hover:text-white active:bg-[#f1707a] active:text-white transition-colors cursor-default"
          >
            <svg viewBox="0 0 10 10" width="10" height="10" stroke="currentColor" strokeWidth="1.05" fill="none" aria-hidden="true">
              <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" />
              <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" />
            </svg>
          </button>
        </div>
      </header>

      {win.id === 'calculator' ? (
        <CalculatorApp isActive={isActive} />
      ) : win.id === 'chrome' ? (
        <ChromeApp windowId={win.id} />
      ) : win.id === 'notepad' ? (
        <NotepadApp windowId={win.id} />
      ) : win.id === 'paint' ? (
        <PaintApp windowId={win.id} />
      ) : win.id === 'code-studio' ? (
        <Suspense fallback={<div className="grid flex-1 place-items-center text-sm text-white">Loading editor…</div>}>
          <CodeStudioApp />
        </Suspense>
      ) : win.id === 'word' || win.id === 'excel' ? (
        <Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f3f2f1] text-[#323130] gap-3">
              <img src={win.icon} alt="" className="w-12 h-12 object-contain" />
              <span className="text-[13px] font-medium">
                Starting Microsoft {win.id === 'word' ? 'Word' : 'Excel'}...
              </span>
            </div>
          }
        >
          <OfficeApp mode={win.id} windowId={win.id} />
        </Suspense>
      ) : win.id === 'settings' ? (
        <PersonalizationSettingsApp />
      ) : win.id === 'task-manager' ? (
        <TaskManagerApp />
      ) : win.id === 'yt-downloader' ? (
        <YouTubeDownloaderApp />
      ) : win.id === 'media-player' ? (
        <MediaPlayerApp windowId={win.id} />
      ) : win.id === 'pdf-tool' ? (
        <Suspense fallback={<div className="grid flex-1 place-items-center text-sm text-white">Opening PDF Tool…</div>}>
          <PdfToolApp />
        </Suspense>
      ) : isExplorerApp ? (
        <FileExplorerApp
          windowId={win.id}
          initialFolderId={
            win.id === 'recycle-bin'
              ? 'recycle-bin'
              : win.id === 'explorer'
                ? explorerStartFolderId
                : 'this-pc'
          }
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#e6e6e6] p-6 overflow-hidden">
          <img
            src={win.icon}
            alt={win.title}
            draggable={false}
            className="w-20 h-20 object-contain mb-4 pointer-events-none"
          />
          <p className="text-[19px] font-normal text-[#2b2b2b] tracking-tight text-center">
            {win.title} coming soon
          </p>
        </div>
      )}
    </section>
  );
}
