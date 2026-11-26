export interface DesktopAppItem {
  id: string;
  name: string;
  icon: string;
  pinnedToTaskbar?: boolean;
  isOpenByDefault?: boolean;
}

/**
 * Desktop and taskbar app registry matching the Windows 10 desktop layout.
 */
export const DESKTOP_APPS: DesktopAppItem[] = [
  {
    id: 'chrome',
    name: 'Google Chrome',
    icon: '/assets/icons/chrome.png',
    pinnedToTaskbar: true,
    isOpenByDefault: true,
  },
  {
    id: 'explorer',
    name: 'File Explorer',
    icon: '/assets/icons/file-explorer.png',
    pinnedToTaskbar: true,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    icon: '/assets/icons/spotify.png',
    pinnedToTaskbar: true,
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    icon: '/assets/icons/vscode.png',
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
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: '/assets/icons/calendar.png',
  },
  {
    id: 'git-bash',
    name: 'Git Bash',
    icon: '/assets/icons/git-bash.ico',
    pinnedToTaskbar: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '/assets/icons/github.png',
  },
];
