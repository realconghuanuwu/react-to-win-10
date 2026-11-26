import { useEffect } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { Desktop } from './components/Desktop/Desktop';
import { Taskbar } from './components/Taskbar/Taskbar';
import { WindowManager } from './components/Window/WindowManager';
import { win10Theme } from './theme/win10Theme';

export function App() {
  useEffect(() => {
    const preventBrowserSideButtons = (e: MouseEvent) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
      }
    };
    window.addEventListener('mousedown', preventBrowserSideButtons);
    window.addEventListener('mouseup', preventBrowserSideButtons);
    return () => {
      window.removeEventListener('mousedown', preventBrowserSideButtons);
      window.removeEventListener('mouseup', preventBrowserSideButtons);
    };
  }, []);

  return (
    <FluentProvider theme={win10Theme}>
      <main className="relative w-screen h-screen overflow-hidden">
        <Desktop />
        <WindowManager />
        <Taskbar />
      </main>
    </FluentProvider>
  );
}

export default App;
