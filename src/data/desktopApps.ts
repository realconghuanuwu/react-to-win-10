export interface DesktopAppItem {
  id: string;
  name: string;
  icon: string;
  pinnedToTaskbar?: boolean;
  showOnDesktop?: boolean;
}

/**
 * Windows 10 desktop, taskbar, and Start Menu applications.
 */
export const DESKTOP_APPS: DesktopAppItem[] = [
  {
    id: 'recycle-bin',
    name: 'Recycle Bin',
    icon: '/assets/icons/trash-can.png',
    showOnDesktop: true,
  },
  {
    id: 'this-pc',
    name: 'This PC',
    icon: '/assets/icons/my-computer.png',
    showOnDesktop: true,
  },
  {
    id: 'explorer',
    name: 'File Explorer',
    icon: '/assets/icons/file-explorer.png',
    pinnedToTaskbar: true,
    showOnDesktop: true,
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: '/assets/icons/calculator.png',
    showOnDesktop: true,
  },
  {
    id: 'store',
    name: 'Microsoft Store',
    icon: '/assets/icons/microsoft-store.png',
    pinnedToTaskbar: true,
    showOnDesktop: true,
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    icon: '/assets/icons/edge.png',
    showOnDesktop: false,
  },
  {
    id: 'notepad',
    name: 'Notepad',
    icon: '/assets/icons/notepad.png',
    showOnDesktop: false,
  },
  {
    id: 'paint',
    name: 'Paint',
    icon: '/assets/icons/paint.png',
    showOnDesktop: false,
  },
  {
    id: 'photos',
    name: 'Photos',
    icon: '/assets/icons/photos.png',
    showOnDesktop: false,
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '/assets/icons/settings.png',
    showOnDesktop: false,
  },
  {
    id: 'snip',
    name: 'Snip & Sketch',
    icon: '/assets/icons/snip.png',
    showOnDesktop: false,
  },
];

export interface StartTileGroup {
  title: string;
  appIds: string[];
}

export const START_TILE_GROUPS: StartTileGroup[] = [
  {
    title: 'Productivity',
    appIds: ['this-pc', 'explorer', 'calculator', 'edge', 'photos', 'notepad'],
  },
  {
    title: 'Explore',
    appIds: ['store', 'settings', 'paint', 'snip', 'recycle-bin'],
  },
];
