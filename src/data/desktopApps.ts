export interface DesktopAppItem {
  id: string;
  name: string;
  icon: string;
  pinnedToTaskbar?: boolean;
}

/**
 * Windows 10 desktop and taskbar applications.
 */
export const DESKTOP_APPS: DesktopAppItem[] = [
  {
    id: 'recycle-bin',
    name: 'Recycle Bin',
    icon: '/assets/icons/trash-can.png',
  },
  {
    id: 'this-pc',
    name: 'This PC',
    icon: '/assets/icons/my-computer.png',
  },
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
];
