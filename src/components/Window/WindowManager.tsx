import { useDesktopStore } from '../../store/useDesktopStore';
import { WindowFrame } from './WindowFrame';

export function WindowManager() {
  const windows = useDesktopStore((state) => state.windows);

  return (
    <div
      aria-label="Open application windows"
      className="fixed top-0 left-0 right-0 bottom-[40px] pointer-events-none z-30 overflow-hidden"
    >
      {windows.map((win) => (
        <WindowFrame key={win.id} win={win} />
      ))}
    </div>
  );
}
