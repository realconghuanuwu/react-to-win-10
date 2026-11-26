import { useEffect } from 'react';
import { getTaskbarInsets, useDesktopStore } from '../../store/useDesktopStore';
import { WindowFrame } from './WindowFrame';

export function WindowManager() {
  const windows = useDesktopStore((state) => state.windows);
  const taskbarSettings = useDesktopStore((state) => state.taskbarSettings);
  const isPeekingDesktop = useDesktopStore((state) => state.isPeekingDesktop);
  const snapActiveWindow = useDesktopStore((state) => state.snapActiveWindow);

  useEffect(() => {
    const handleSnapShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.shiftKey) return;
      const useWinKey = event.metaKey && !event.ctrlKey && !event.altKey;
      const useFallback = !event.metaKey && event.ctrlKey && event.altKey && !event.getModifierState('AltGraph');
      if (!useWinKey && !useFallback) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      if (snapActiveWindow(event.key === 'ArrowLeft' ? 'left' : 'right')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleSnapShortcut, true);
    return () => window.removeEventListener('keydown', handleSnapShortcut, true);
  }, [snapActiveWindow]);

  const insets = getTaskbarInsets(taskbarSettings);

  return (
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
      {windows.map((win) => (
        <WindowFrame key={win.id} win={win} />
      ))}
    </div>
  );
}
