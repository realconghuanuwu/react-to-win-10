import { FluentProvider } from '@fluentui/react-components';
import { Desktop } from './components/Desktop/Desktop';
import { Taskbar } from './components/Taskbar/Taskbar';
import { WindowManager } from './components/Window/WindowManager';
import { win10Theme } from './theme/win10Theme';

export function App() {
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
