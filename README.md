# React to Windows 10

Ứng dụng web mô phỏng giao diện **Windows 10** được xây dựng bằng **React 19.3**, **TypeScript**, **pnpm 10**, **Zustand**, **Fluent UI v9**, **Tailwind CSS v4** và **Vite**.

## Tech Stack

- **Package Manager:** `pnpm@10.3.0`
- **Framework:** `react@^19.3.0`, `react-dom@^19.3.0`, `typescript@^7.0.2`
- **State Management:** `zustand@^5.1.0`
- **UI & Styling:** `@fluentui/react-components@^9.75.3`, `@fluentui/react-icons@^2.0.347`, `tailwindcss@^4.3.5` (`@tailwindcss/vite`)
- **Bundler:** `vite@^8.3.8`

## Tính năng hiện có

- **Màn hình Desktop Windows 10**
  - Hình nền Hero chuẩn Windows 10 và bộ icon trích xuất chuẩn Windows 10 (`Recycle Bin`, `This PC`, `File Explorer`, `Calculator`, `Microsoft Store`).
  - Hỗ trợ chọn icon (click, `Ctrl+Click`), kéo khung chọn (marquee selection), double-click để mở ứng dụng.
  - **Desktop Context Menu (chuột phải):** Thiết kế giống Windows 10 với các submenu `View ›` (`Large`/`Medium`/`Small icons`, `Show desktop icons`), `Sort by ›`, `Refresh`, `Paste`/`Paste shortcut` (disabled), `New ›`, `Display settings`, `Personalize`.
- **Taskbar & System Tray**
  - Nút Start, Search chuẩn Windows 10, danh sách ứng dụng ghim & đang mở với vạch báo trạng thái active/minimized.
  - System Tray với popover ẩn, Network, Volume, đồng hồ & ngày realtime (`HH:mm` / `dd/MM/yyyy`) kèm lịch Popover, Action Center và nút `Show desktop` thu nhỏ toàn bộ cửa sổ.
- **Hệ thống cửa sổ (Window Manager)**
  - Kéo thả (DnD) bằng thanh tiêu đề, tự khôi phục khi kéo từ trạng thái phóng to, double-click titlebar để Maximize/Restore.
  - Resize 8 hướng (4 cạnh + 4 góc), Maximize/Fullscreen trên vùng Desktop, Minimize xuống Taskbar, Close (`×`) và tự động xếp tầng `zIndex`.
- **Calculator (Dark Mode - Standard)**
  - Hỗ trợ đầy đủ phép tính cơ bản (`+`, `−`, `×`, `÷`), `%`, `1/x`, `x²`, `²√x`, `+/−`, `⌫`, `CE`, `C`, bộ nhớ (`MC`, `MR`, `M+`, `M−`, `MS`, `M▾`), lịch sử phép tính (`History`) và nhập từ bàn phím.
- **File Explorer & Virtual File System (`localStorage`)**
  - Mở được từ `This PC`, `File Explorer` và `Recycle Bin`.
  - Cây thư mục đệ quy bên trái (`Quick access`, `This PC`, `Local Disk (C:)`, `Recycle Bin`), breadcrumb điều hướng, nút Back/Forward/Up, tìm kiếm theo thư mục.
  - Xem dung lượng ổ đĩa `Local Disk (C:)` đo trực tiếp từ dung lượng thực tế đã dùng trong `localStorage` (hạn mức `5.00 MB`).
  - Tạo thư mục mới (`New folder`), đổi tên inline (`Rename`), chuyển vào thùng rác / khôi phục / xóa vĩnh viễn (`Delete`, `Restore`, `Empty Recycle Bin`), dữ liệu lưu bền vững qua `localStorage` (`win10_fs_v1`).

## Cấu trúc thư mục

```text
public/
└── assets/
    ├── icons/              # Bộ icon Windows 10 (desktop, taskbar, explorer, context menu)
    └── wallpapers/         # Hình nền Windows 10 Hero
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
│   │   ├── SystemTray.tsx
│   │   ├── Taskbar.tsx
│   │   └── Win10Icons.tsx
│   └── Window/
│       ├── WindowFrame.tsx
│       └── WindowManager.tsx
├── data/
│   └── desktopApps.ts      # Danh sách ứng dụng mặc định trên Desktop & Taskbar
├── store/
│   ├── useDesktopStore.ts  # Global state Desktop, Taskbar, Windows (Zustand)
│   └── useFileSystemStore.ts # Virtual File System & đo dung lượng localStorage
├── theme/
│   └── win10Theme.ts       # Theme Fluent UI v9 tùy chỉnh cho Windows 10
├── App.tsx
├── index.css
└── main.tsx
```

## Cài đặt & Chạy dự án

```bash
# Cài đặt dependencies
pnpm install

# Chạy môi trường development
pnpm dev

# Kiểm tra TypeScript và build production
pnpm build

# Xem trước bản build production
pnpm preview
```
