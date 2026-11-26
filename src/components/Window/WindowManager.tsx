import { getTaskbarInsets, useDesktopStore } from '../../store/useDesktopStore';
import { WindowFrame } from './WindowFrame';

export function WindowManager() {
  const windows = useDesktopStore((state) => state.windows);
  const taskbarSettings = useDesktopStore((state) => state.taskbarSettings);
  const isPeekingDesktop = useDesktopStore((state) => state.isPeekingDesktop);

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
