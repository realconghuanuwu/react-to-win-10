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
    id: 'my-computer',
    name: 'My Computer',
    icon: '/assets/icons/my-computer.png',
  },
  {
    id: 'trash-can',
    name: 'Trash can',
    icon: '/assets/icons/trash-can.png',
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
