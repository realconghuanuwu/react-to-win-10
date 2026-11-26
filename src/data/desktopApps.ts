export interface DesktopAppItem {
  id: string;
  name: string;
  icon: string;
  pinnedToTaskbar?: boolean;
}

/**
 * Built-in Windows 10 applications shown on the Desktop and Taskbar.
 */
export const DESKTOP_APPS: DesktopAppItem[] = [
  {
    id: 'explorer',
    name: 'File Explorer',
    icon: '/assets/icons/file-explorer.png',
    pinnedToTaskbar: true,
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: '/assets/icons/calculator.png',
  },
  {
    id: 'store',
    name: 'Microsoft Store',
    icon: '/assets/icons/microsoft-store.png',
    pinnedToTaskbar: true,
  },
  {
    id: 'weather',
    name: 'Weather',
    icon: '/assets/icons/weather.png',
  },
  {
    id: 'mail',
    name: 'Mail',
    icon: '/assets/icons/mail.png',
    pinnedToTaskbar: true,
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: '/assets/icons/calendar.png',
  },
];
