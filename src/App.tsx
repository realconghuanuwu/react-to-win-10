import { useEffect } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { BootScreen } from './components/Boot/BootScreen';
import { Desktop } from './components/Desktop/Desktop';
import { Taskbar } from './components/Taskbar/Taskbar';
import { WindowManager } from './components/Window/WindowManager';
import { SystemOverlays } from './components/System/SystemOverlays';
import { notify } from './store/useNotificationStore';
import { win10Theme } from './theme/win10Theme';
import { playSound } from './utils/soundManager';

interface UsbDeviceLike {
  productName?: string;
}

interface UsbConnectionEventLike extends Event {
  device?: UsbDeviceLike;
}

interface NavigatorWithUsb extends Navigator {
  usb?: EventTarget;
}

export function App() {
  useEffect(() => {
    const preventBrowserSideButtons = (e: MouseEvent) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
      }
    };
    window.addEventListener('mousedown', preventBrowserSideButtons);
    window.addEventListener('mouseup', preventBrowserSideButtons);

    // Real browser hardware events (USB / Gamepad / Audio-Video device changes)
    const onGamepadConnected = (e: GamepadEvent) => {
      playSound('usb-insert');
      notify({
        source: 'Device Manager',
        title: 'Controller connected',
        message: e.gamepad?.id || 'USB game controller detected.',
        kind: 'success',
        sound: false,
      });
    };
    const onGamepadDisconnected = (e: GamepadEvent) => {
      playSound('usb-remove');
      notify({
        source: 'Device Manager',
        title: 'Controller disconnected',
        message: e.gamepad?.id || 'Game controller removed.',
        kind: 'success',
        sound: false,
      });
    };
    window.addEventListener('gamepadconnected', onGamepadConnected);
    window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

    const usb = (navigator as NavigatorWithUsb).usb;
    const onUsbConnect = (e: Event) => {
      const ev = e as UsbConnectionEventLike;
      playSound('usb-insert');
      notify({
        source: 'Device Setup',
        title: 'USB device connected',
        message: ev.device?.productName || 'A USB device was plugged in.',
        kind: 'success',
        sound: false,
      });
    };
    const onUsbDisconnect = (e: Event) => {
      const ev = e as UsbConnectionEventLike;
      playSound('usb-remove');
      notify({
        source: 'Device Setup',
        title: 'USB device removed',
        message: ev.device?.productName || 'A USB device was disconnected.',
        kind: 'success',
        sound: false,
      });
    };
    usb?.addEventListener('connect', onUsbConnect);
    usb?.addEventListener('disconnect', onUsbDisconnect);

    let prevMediaDeviceCount: number | null = null;
    if (navigator.mediaDevices?.enumerateDevices) {
      void navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          prevMediaDeviceCount = list.length;
        })
        .catch(() => undefined);
    }
    const onMediaDeviceChange = () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      void navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          const removed = prevMediaDeviceCount !== null && list.length < prevMediaDeviceCount;
          prevMediaDeviceCount = list.length;
          playSound(removed ? 'usb-remove' : 'usb-insert');
        })
        .catch(() => {
          playSound('usb-insert');
        });
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', onMediaDeviceChange);

    return () => {
      window.removeEventListener('mousedown', preventBrowserSideButtons);
      window.removeEventListener('mouseup', preventBrowserSideButtons);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
      usb?.removeEventListener('connect', onUsbConnect);
      usb?.removeEventListener('disconnect', onUsbDisconnect);
      navigator.mediaDevices?.removeEventListener?.('devicechange', onMediaDeviceChange);
    };
  }, []);

  return (
    <FluentProvider theme={win10Theme}>
      <main
        aria-label="Windows 10 Online Simulator Desktop"
        className="relative w-screen h-screen overflow-hidden"
      >
        <h1 className="sr-only">Windows 10 Online Simulator</h1>
        <Desktop />
        <WindowManager />
        <Taskbar />
        <SystemOverlays />
        <BootScreen />
      </main>
    </FluentProvider>
  );
}

export default App;
