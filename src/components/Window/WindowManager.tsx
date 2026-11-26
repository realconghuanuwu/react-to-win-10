import { useEffect, useRef, useState } from 'react';
import {
  getSnapBounds,
  getTaskbarInsets,
  useDesktopStore,
  type AppWindow,
  type SnapSide,
  type WindowBounds,
} from '../../store/useDesktopStore';
import { WindowFrame } from './WindowFrame';

function matchesBounds(win: AppWindow, bounds: WindowBounds | null) {
  return (
    bounds &&
    !win.isMinimized &&
    !win.isMaximized &&
    win.x === bounds.x &&
    win.y === bounds.y &&
    win.width === bounds.width &&
    win.height === bounds.height
  );
}

function TitlebarContextMenu() {
  const menuState = useDesktopStore((s) => s.titlebarMenuState);
  const windows = useDesktopStore((s) => s.windows);
  const virtualDesktops = useDesktopStore((s) => s.virtualDesktops);
  const setTitlebarMenuState = useDesktopStore((s) => s.setTitlebarMenuState);
  const toggleMaximizeWindow = useDesktopStore((s) => s.toggleMaximizeWindow);
  const minimizeWindow = useDesktopStore((s) => s.minimizeWindow);
  const closeWindow = useDesktopStore((s) => s.closeWindow);
  const updateWindowBounds = useDesktopStore((s) => s.updateWindowBounds);
  const moveWindowToDesktop = useDesktopStore((s) => s.moveWindowToDesktop);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuState) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTitlebarMenuState(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTitlebarMenuState(null);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuState, setTitlebarMenuState]);

  if (!menuState) return null;
  const win = windows.find((w) => w.id === menuState.windowId);
  if (!win) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const left = Math.max(4, Math.min(menuState.x, vw - 200));
  const top = Math.max(4, Math.min(menuState.y, vh - 210));
  const canRestore = win.isMaximized || Boolean(win.snapRestoreBounds);

  const rowCls =
    'w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-white hover:bg-[#414141] disabled:text-[#777] disabled:hover:bg-transparent cursor-default text-left';

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Window system menu"
      style={{ left, top, width: 192 }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[105] bg-[#2b2b2b] border border-[#767676] shadow-2xl py-1 select-none"
    >
      <button
        type="button"
        disabled={!canRestore}
        onClick={() => {
          if (win.isMaximized) toggleMaximizeWindow(win.id);
          else if (win.snapRestoreBounds) updateWindowBounds(win.id, win.snapRestoreBounds, true);
          setTitlebarMenuState(null);
        }}
        className={rowCls}
      >
        <span>Restore</span>
      </button>
      <button
        type="button"
        onClick={() => {
          minimizeWindow(win.id);
          setTitlebarMenuState(null);
        }}
        className={rowCls}
      >
        <span>Minimize</span>
      </button>
      <button
        type="button"
        disabled={win.isMaximized}
        onClick={() => {
          toggleMaximizeWindow(win.id);
          setTitlebarMenuState(null);
        }}
        className={rowCls}
      >
        <span>Maximize</span>
      </button>
      {virtualDesktops.length > 1 && (
        <>
          <div className="h-px bg-[#5a5a5a] my-1 mx-2" />
          <div className="px-3 py-1 text-[10.5px] text-white/55">Move to desktop</div>
          {virtualDesktops.map((d) => (
            <button
              key={d.id}
              type="button"
              disabled={win.desktopId === d.id}
              onClick={() => {
                moveWindowToDesktop(win.id, d.id);
                setTitlebarMenuState(null);
              }}
              className={rowCls}
            >
              <span>{d.name}</span>
              {win.desktopId === d.id && <span>✓</span>}
            </button>
          ))}
        </>
      )}
      <div className="h-px bg-[#5a5a5a] my-1 mx-2" />
      <button
        type="button"
        onClick={() => {
          closeWindow(win.id);
          setTitlebarMenuState(null);
        }}
        className={rowCls}
      >
        <span>Close</span>
        <span className="text-[11px] text-white/55">Alt+F4</span>
      </button>
    </div>
  );
}

export function WindowManager() {
  const allWindows = useDesktopStore((state) => state.windows);
  const activeDesktopId = useDesktopStore((state) => state.activeDesktopId);
  const taskbarSettings = useDesktopStore((state) => state.taskbarSettings);
  const isPeekingDesktop = useDesktopStore((state) => state.isPeekingDesktop);
  const snapActiveWindow = useDesktopStore((state) => state.snapActiveWindow);
  const snapWindow = useDesktopStore((state) => state.snapWindow);
  const [previewSide, setPreviewSide] = useState<SnapSide | null>(null);
  const [assist, setAssist] = useState<{ sourceId: string; side: 'left' | 'right' } | null>(null);
  const chooserRef = useRef<HTMLElement>(null);

  const windows = allWindows.filter((w) => w.desktopId === activeDesktopId);

  useEffect(() => {
    const handleSnapShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.shiftKey) return;
      const useWinKey = event.metaKey && !event.ctrlKey && !event.altKey;
      const useFallback =
        !event.metaKey && event.ctrlKey && event.altKey && !event.getModifierState('AltGraph');
      if (!useWinKey && !useFallback) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      if (snapActiveWindow(event.key === 'ArrowLeft' ? 'left' : 'right')) {
        const snapSide = event.key === 'ArrowLeft' ? 'left' : 'right';
        const otherSide = snapSide === 'left' ? 'right' : 'left';
        const st = useDesktopStore.getState();
        const snappedId = st.activeAppId;
        const remaining = st.windows.filter((item) => item.id !== snappedId && item.desktopId === st.activeDesktopId);
        const bounds = getSnapBounds(otherSide, st.taskbarSettings);
        setAssist(
          snappedId && remaining.length && !remaining.some((item) => matchesBounds(item, bounds))
            ? { sourceId: snappedId, side: otherSide }
            : null,
        );
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleSnapShortcut, true);
    return () => window.removeEventListener('keydown', handleSnapShortcut, true);
  }, [snapActiveWindow]);

  const insets = getTaskbarInsets(taskbarSettings);
  const previewBounds = previewSide && getSnapBounds(previewSide, taskbarSettings);
  const assistBounds = assist && getSnapBounds(assist.side, taskbarSettings);
  const sourceBounds =
    assist && getSnapBounds(assist.side === 'left' ? 'right' : 'left', taskbarSettings);
  const source = assist && windows.find((item) => item.id === assist.sourceId);
  const candidates =
    assist && source && matchesBounds(source, sourceBounds)
      ? windows.filter((item) => item.id !== assist.sourceId).sort((a, b) => b.zIndex - a.zIndex)
      : [];
  const showAssist =
    !!assistBounds &&
    !isPeekingDesktop &&
    candidates.length > 0 &&
    !candidates.some((candidate) => matchesBounds(candidate, assistBounds));

  useEffect(() => {
    if (!showAssist) return;
    const dismiss = () => setAssist(null);
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !chooserRef.current?.contains(event.target)) dismiss();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
      }
    };
    chooserRef.current?.querySelector('button')?.focus({ preventScroll: true });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', dismiss);
    };
  }, [showAssist]);

  const handleSnapDrop = (id: string, side: SnapSide) => {
    if (!snapWindow(id, side)) return;
    if (side !== 'left' && side !== 'right') {
      setAssist(null);
      return;
    }
    const otherSide = side === 'left' ? 'right' : 'left';
    const state = useDesktopStore.getState();
    const remaining = state.windows.filter(
      (item) => item.id !== id && item.desktopId === state.activeDesktopId,
    );
    const bounds = getSnapBounds(otherSide, state.taskbarSettings);
    setAssist(
      remaining.length && !remaining.some((item) => matchesBounds(item, bounds))
        ? { sourceId: id, side: otherSide }
        : null,
    );
  };

  return (
    <>
      <TitlebarContextMenu />
      <div
        aria-label="Open application windows"
        style={{
          top: insets.top,
          bottom: insets.bottom,
          left: insets.left,
          right: insets.right,
        }}
        className={[
          'fixed pointer-events-none z-30 overflow-hidden transition-opacity duration-150',
          isPeekingDesktop ? 'opacity-10' : 'opacity-100',
        ].join(' ')}
      >
        <div className="absolute inset-0 z-0">
          {windows.map((win) => (
            <WindowFrame
              key={win.id}
              win={win}
              onSnapPreview={setPreviewSide}
              onSnapDrop={handleSnapDrop}
            />
          ))}
        </div>
        {previewBounds && (
          <div
            aria-hidden="true"
            data-snap-preview={previewSide}
            style={{
              left: previewBounds.x,
              top: previewBounds.y,
              width: previewBounds.width,
              height: previewBounds.height,
            }}
            className="pointer-events-none absolute z-10 border-2 border-[#66baff] bg-[#0078d7]/25 transition-all duration-100"
          />
        )}
        {showAssist && assist && assistBounds && (
          <section
            ref={chooserRef}
            aria-label="Snap Assist"
            style={{
              left: assistBounds.x,
              top: assistBounds.y,
              width: assistBounds.width,
              height: assistBounds.height,
            }}
            className="pointer-events-auto absolute z-20 flex flex-col gap-4 overflow-auto bg-[#1b1b1b]/95 p-5 text-white shadow-lg backdrop-blur-md"
          >
            <h2 className="text-sm font-semibold">Choose a window</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => {
                    snapWindow(candidate.id, assist.side);
                    setAssist(null);
                  }}
                  className="flex min-w-0 items-center gap-3 border border-white/20 bg-white/5 px-3 py-3 text-left text-sm hover:bg-white/15 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#66baff]"
                >
                  <img src={candidate.icon} alt="" className="h-6 w-6 shrink-0 object-contain" />
                  <span className="truncate" title={candidate.title}>
                    {candidate.title}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAssist(null)}
              className="self-start border border-white/20 px-3 py-2 text-sm hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-[#66baff]"
            >
              Dismiss
            </button>
          </section>
        )}
      </div>
    </>
  );
}
