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
    id: 'chrome',
    name: 'Google Chrome',
    icon: '/assets/icons/chrome.svg',
    pinnedToTaskbar: true,
    showOnDesktop: true,
  },
  {
    id: 'word',
    name: 'Word',
    icon: '/assets/icons/word.svg',
    pinnedToTaskbar: true,
    showOnDesktop: true,
  },
  {
    id: 'excel',
    name: 'Excel',
    icon: '/assets/icons/excel.svg',
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
    id: 'code-studio',
    name: 'Visual Studio Code',
    icon: '/assets/icons/code-studio.svg',
    showOnDesktop: true,
  },
  {
    id: 'paint',
    name: 'Paint',
    icon: '/assets/icons/paint.svg',
    showOnDesktop: true,
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
  {
    id: 'task-manager',
    name: 'Task Manager',
    icon: '/assets/icons/settings.png',
    showOnDesktop: false,
  },
  {
    id: 'yt-downloader',
    name: 'YouTube Downloader',
    icon: '/assets/icons/yt-downloader.svg',
    showOnDesktop: true,
  },
  {
    id: 'media-player',
    name: 'Media Player',
    icon: '/assets/icons/media-file.svg',
    showOnDesktop: false,
  },
  {
    id: 'pdf-tool',
    name: 'PDF Tool',
    icon: '/assets/icons/pdf-tool.svg',
    showOnDesktop: true,
  },
];

export interface StartTileGroup {
  title: string;
  appIds: string[];
}

export const START_TILE_GROUPS: StartTileGroup[] = [
  {
    title: 'Productivity',
    appIds: ['word', 'excel', 'this-pc', 'explorer', 'calculator', 'chrome', 'edge', 'photos', 'notepad'],
  },
  {
    title: 'Explore',
    appIds: ['store', 'settings', 'paint', 'snip', 'recycle-bin'],
  },
];
