# React to Windows 10

A **Windows 10** desktop environment clone built with **React 19.3**, **TypeScript**, **pnpm 10**, **Zustand**, **Fluent UI v9**, **Tailwind CSS v4**, and **Vite**.

## Tech Stack

- **Package Manager:** `pnpm@10.3.0`
- **Framework:** `react@^19.3.0`, `react-dom@^19.3.0`, `typescript@^7.0.2`
- **State Management:** `zustand@^5.1.0`
- **UI & Styling:** `@fluentui/react-components@^9.75.3`, `@fluentui/react-icons@^2.0.347`, `tailwindcss@^4.3.5` (`@tailwindcss/vite`)
- **Bundler:** `vite@^8.3.8`

## Features

- **Windows 10 Desktop**
  - Authentic Windows 10 Hero wallpaper and icons (`Recycle Bin`, `This PC`, `File Explorer`, `Calculator`, `Microsoft Store`).
  - Single-click and `Ctrl+Click` multi-selection, marquee drag-box selection, and double-click to launch applications.
  - **Windows 10 Desktop Context Menu:** Native dark menu with `View ›` (`Large`/`Medium`/`Small icons`, `Show desktop icons`), `Sort by ›`, `Refresh`, disabled `Paste` / `Paste shortcut`, `New ›`, `Display settings`, and `Personalize`.
- **Taskbar & System Tray**
  - Windows 10 Start and Search buttons, pinned & running application buttons with active/minimized bottom indicators.
  - System Tray featuring hidden icons popover, Network, Volume, live `HH:mm` / `dd/MM/yyyy` clock & interactive calendar popover, Action Center icon, and a `Show desktop` button that minimizes all open windows.
- **Start Menu**
  - 3-column Windows 10 dark acrylic Start Menu anchored above the taskbar.
  - Expandable left navigation rail (`Start`, `User`, `Documents`, `Pictures`, `Settings`, `Power` with `Sleep`/`Shut down`/`Restart`).
  - Alphabetical `All apps` list (`Recently added`, `C`–`W`, plus expandable `Windows Accessories` folder) and `Productivity` / `Explore` Live Tiles.
- **Window Manager**
  - Draggable titlebar (with drag-to-unmaximize from fullscreen and double-click to maximize/restore).
  - 8-direction edge and corner resizing (`320×220` minimum bounds, `320×480` for Calculator, `620×400` for File Explorer).
  - Maximize/Fullscreen above the taskbar, Minimize to taskbar, Close (`×`), and automatic `zIndex` window focus stacking.
- **Standard Calculator (Dark Mode)**
  - Full arithmetic (`+`, `−`, `×`, `÷`), `%`, `1/x`, `x²`, `²√x`, `+/−`, backspace, `CE`/`C`, memory operations (`MC`, `MR`, `M+`, `M−`, `MS`, `M▾`), calculation history drawer, and keyboard input support.
- **File Explorer & `localStorage` Virtual File System**
  - Launched from `This PC`, `File Explorer`, `Recycle Bin`, or Start Menu shortcuts (`Documents`, `Pictures`).
  - Recursive expandable left folder tree (`Quick access`, `This PC`, `Local Disk (C:)`, `Recycle Bin`), clickable breadcrumb bar, Back/Forward/Up navigation, and live folder search.
  - Live `Local Disk (C:)` capacity bar and status readout calculated directly from actual `localStorage` byte usage against a `5.00 MB` quota.
  - Create folders (`New folder`), inline rename (`Rename`), move to Recycle Bin / restore / permanently delete (`Delete`, `Restore`, `Empty Recycle Bin`) persisted in `localStorage` (`win10_fs_v1`).

## Project Structure

```text
public/
└── assets/
    ├── icons/              # Windows 10 icons (desktop, taskbar, start menu, explorer, context menu)
    └── wallpapers/         # Windows 10 Hero wallpaper
src/
├── components/
│   ├── Apps/
│   │   ├── CalculatorApp.tsx
│   │   ├── calculatorEngine.ts
│   │   └── FileExplorerApp.tsx
│   ├── Desktop/
│   │   ├── Desktop.tsx
│   │   ├── DesktopContextMenu.tsx
│   │   └── DesktopIcon.tsx
│   ├── Taskbar/
│   │   ├── StartMenu.tsx
│   │   ├── SystemTray.tsx
│   │   ├── Taskbar.tsx
│   │   └── Win10Icons.tsx
│   └── Window/
│       ├── WindowFrame.tsx
│       └── WindowManager.tsx
├── data/
│   └── desktopApps.ts        # Desktop, taskbar, and Start Menu app registry
├── store/
│   ├── useDesktopStore.ts    # Zustand store for Desktop, Taskbar, Start Menu, and Windows
│   └── useFileSystemStore.ts # Zustand store for localStorage Virtual File System & drive stats
├── theme/
│   └── win10Theme.ts         # Custom Fluent UI v9 Windows 10 dark theme
├── App.tsx
├── index.css
└── main.tsx
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev

# Type-check and build for production
pnpm build

# Preview the production build
pnpm preview
```
