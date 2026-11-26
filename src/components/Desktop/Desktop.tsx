import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  findNextFreeSlot,
  getTaskbarInsets,
  useDesktopStore,
  type DesktopIconSize,
  type GridSlot,
} from '../../store/useDesktopStore';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import { getWallpaperCssProps } from '../Apps/PersonalizationSettingsApp';
import { DesktopContextMenu } from './DesktopContextMenu';
import { DesktopIcon, type DesktopDisplayItem } from './DesktopIcon';

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface DragPreview {
  item: DesktopDisplayItem;
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
}

const CELL_DIMENSIONS: Record<DesktopIconSize, { w: number; h: number }> = {
  small: { w: 76, h: 68 },
  medium: { w: 82, h: 80 },
  large: { w: 94, h: 98 },
};

const PADDING = 8;

export function Desktop() {
  const allApps = useDesktopStore((state) => state.apps);
  const taskbarSettings = useDesktopStore((state) => state.taskbarSettings);
  const shortcutLabels = useDesktopStore((state) => state.shortcutLabels);
  const iconPositions = useDesktopStore((state) => state.iconPositions);
  const selectedIds = useDesktopStore((state) => state.selectedIconIds);
  const renamingIconId = useDesktopStore((state) => state.renamingIconId);
  const isRefreshing = useDesktopStore((state) => state.isRefreshing);
  const iconSize = useDesktopStore((state) => state.iconSize);
  const showDesktopIcons = useDesktopStore((state) => state.showDesktopIcons);
  const personalization = useDesktopStore((state) => state.personalizationSettings);
  const selectIcon = useDesktopStore((state) => state.selectIcon);
  const setSelectedIconIds = useDesktopStore((state) => state.setSelectedIconIds);
  const clearSelection = useDesktopStore((state) => state.clearSelection);
  const setContextMenuPos = useDesktopStore((state) => state.setContextMenuPos);
  const moveIconToSlot = useDesktopStore((state) => state.moveIconToSlot);
  const setRenamingIconId = useDesktopStore((state) => state.setRenamingIconId);
  const renameShortcut = useDesktopStore((state) => state.renameShortcut);
  const openApp = useDesktopStore((state) => state.openApp);
  const openNotepadFile = useDesktopStore((state) => state.openNotepadFile);

  const fsNodes = useFileSystemStore((state) => state.nodes);
  const renameFsNode = useFileSystemStore((state) => state.renameNode);
  const deleteFsNodes = useFileSystemStore((state) => state.deleteNodes);

  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 720,
  );
  const iconRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const insets = getTaskbarInsets(taskbarSettings);
  const cellStep = CELL_DIMENSIONS[iconSize];
  const maxRows = Math.max(
    1,
    Math.floor((viewportH - insets.top - insets.bottom - PADDING * 2) / cellStep.h),
  );

  const desktopItems = useMemo<DesktopDisplayItem[]>(() => {
    const builtIn: DesktopDisplayItem[] = allApps
      .filter((app) => app.showOnDesktop !== false)
      .map((app) => ({
        id: app.id,
        name: shortcutLabels[app.id] ?? app.name,
        icon: app.icon,
        isFolder: false,
        isSystem: true,
      }));

    const desktopNodes: DesktopDisplayItem[] = Object.values(fsNodes)
      .filter(
        (node) =>
          node.parentId === 'desktop' && (node.kind === 'folder' || node.kind === 'file'),
      )
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((node) => ({
        id: node.id,
        name: node.name,
        icon: node.icon,
        isFolder: node.kind === 'folder',
        isFile: node.kind === 'file',
        isSystem: node.isSystem,
      }));

    return [...builtIn, ...desktopNodes];
  }, [allApps, shortcutLabels, fsNodes]);

  const resolvedSlots = useMemo(() => {
    const result: Record<string, GridSlot> = {};
    const assignedIds: string[] = [];

    desktopItems.forEach((item) => {
      const existing = iconPositions[item.id];
      if (existing) {
        result[item.id] = {
          col: Math.max(0, existing.col),
          row: Math.max(0, Math.min(maxRows - 1, existing.row)),
        };
      } else {
        result[item.id] = findNextFreeSlot(
          { ...iconPositions, ...result },
          assignedIds,
          maxRows,
        );
      }
      assignedIds.push(item.id);
    });
    return result;
  }, [desktopItems, iconPositions, maxRows]);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      iconRefs.current.set(id, el);
    } else {
      iconRefs.current.delete(id);
    }
  }, []);

  // Keyboard shortcuts on Desktop: F2 to rename, Delete to move user folders to Recycle Bin
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (renamingIconId) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'F2' && selectedIds.length === 1) {
        e.preventDefault();
        setRenamingIconId(selectedIds[0]);
      } else if (e.key === 'Delete' && selectedIds.length > 0) {
        const deletable = selectedIds.filter((id) => {
          const item = desktopItems.find((i) => i.id === id);
          return (item?.isFolder || item?.isFile) && !item.isSystem;
        });
        if (deletable.length > 0) {
          e.preventDefault();
          deleteFsNodes(deletable);
          setSelectedIconIds([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [renamingIconId, selectedIds, desktopItems, setRenamingIconId, deleteFsNodes, setSelectedIconIds]);

  const handleOpenItem = useCallback(
    (item: DesktopDisplayItem) => {
      if (item.isFile) {
        openNotepadFile(item.id);
      } else if (item.isFolder) {
        openApp('explorer', item.id);
      } else {
        openApp(item.id);
      }
    },
    [openApp, openNotepadFile],
  );

  const handleCommitRename = useCallback(
    (id: string, value: string) => {
      const target = desktopItems.find((i) => i.id === id);
      if (target?.isFolder || target?.isFile) {
        if (value.trim()) {
          renameFsNode(id, value);
        }
        setRenamingIconId(null);
      } else {
        renameShortcut(id, value);
      }
    },
    [desktopItems, renameFsNode, renameShortcut, setRenamingIconId],
  );

  const handleIconDragStart = (
    item: DesktopDisplayItem,
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const el = iconRefs.current.get(item.id);
    const rect = el?.getBoundingClientRect();
    const offsetX = rect ? e.clientX - rect.left : cellStep.w / 2;
    const offsetY = rect ? e.clientY - rect.top : cellStep.h / 2;
    let dragging = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!dragging && dist < 5) return;
      dragging = true;
      suppressNextClickRef.current = true;
      setDragPreview({
        item,
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY,
        offsetX,
        offsetY,
      });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (dragging) {
        const dropLeft = upEvent.clientX - offsetX - insets.left;
        const dropTop = upEvent.clientY - offsetY - insets.top;
        const targetCol = Math.max(0, Math.round((dropLeft - PADDING) / cellStep.w));
        const targetRow = Math.max(
          0,
          Math.min(maxRows - 1, Math.round((dropTop - PADDING) / cellStep.h)),
        );
        moveIconToSlot(
          item.id,
          { col: targetCol, row: targetRow },
          desktopItems.map((i) => i.id),
          maxRows,
        );
        setDragPreview(null);
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 0);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (e.target !== containerRef.current && (e.target as HTMLElement).dataset.desktopCanvas !== 'true') {
      return;
    }
    clearSelection();
    setMarquee({
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  };

  useEffect(() => {
    if (!marquee) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const next = { ...marquee, currentX: e.clientX, currentY: e.clientY };
      setMarquee(next);

      const left = Math.min(next.startX, next.currentX);
      const right = Math.max(next.startX, next.currentX);
      const top = Math.min(next.startY, next.currentY);
      const bottom = Math.max(next.startY, next.currentY);

      const hitIds: string[] = [];
      iconRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        const intersects =
          rect.left < right &&
          rect.right > left &&
          rect.top < bottom &&
          rect.bottom > top;
        if (intersects) hitIds.push(id);
      });
      setSelectedIconIds(hitIds);
    };

    const handleMouseUp = () => {
      setMarquee(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [marquee, setSelectedIconIds]);

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY, targetId: null });
  };

  const marqueeStyle = marquee
    ? {
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  const wallpaperStyle = getWallpaperCssProps(
    personalization.backgroundType,
    personalization.wallpaper,
    personalization.backgroundFit,
    personalization.solidColor,
  );

  return (
    <div
      ref={containerRef}
      data-desktop-canvas="true"
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{
        ...wallpaperStyle,
        top: insets.top,
        bottom: insets.bottom,
        left: insets.left,
        right: insets.right,
      }}
      className="fixed overflow-hidden"
    >
      {showDesktopIcons && (
        <div
          data-desktop-canvas="true"
          className={[
            'relative w-full h-full transition-opacity duration-75',
            isRefreshing ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
        >
          {desktopItems.map((item) => {
            const slot = resolvedSlots[item.id] ?? { col: 0, row: 0 };
            return (
              <DesktopIcon
                key={item.id}
                item={item}
                iconSize={iconSize}
                left={PADDING + slot.col * cellStep.w}
                top={PADDING + slot.row * cellStep.h}
                isSelected={selectedIds.includes(item.id)}
                isRenaming={renamingIconId === item.id}
                isDragging={dragPreview?.item.id === item.id}
                onSelect={(id, multi) => {
                  if (suppressNextClickRef.current) return;
                  selectIcon(id, multi);
                }}
                onOpen={handleOpenItem}
                onRightClick={(id, x, y) => {
                  selectIcon(id, false);
                  setContextMenuPos({ x, y, targetId: id });
                }}
                onDragStart={handleIconDragStart}
                onCommitRename={handleCommitRename}
                onCancelRename={() => setRenamingIconId(null)}
                registerRef={registerRef}
              />
            );
          })}
        </div>
      )}

      {dragPreview && (
        <div
          style={{
            left: dragPreview.clientX - dragPreview.offsetX,
            top: dragPreview.clientY - dragPreview.offsetY,
          }}
          className="fixed pointer-events-none z-25 flex flex-col items-center w-[74px] px-1 py-1 opacity-80"
        >
          <img
            src={dragPreview.item.icon}
            alt=""
            className="w-9 h-9 object-contain mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
          />
          <span className="text-center text-[11.5px] leading-[14px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.95)] line-clamp-2">
            {dragPreview.item.name}
          </span>
        </div>
      )}

      {marqueeStyle && marqueeStyle.width > 3 && marqueeStyle.height > 3 && (
        <div
          style={marqueeStyle}
          className="fixed pointer-events-none bg-[#0078d7]/28 border border-[#0078d7] z-20"
        />
      )}

      <DesktopContextMenu
        visibleItems={desktopItems}
        cellStep={cellStep}
        maxRows={maxRows}
        onOpenItem={handleOpenItem}
      />
    </div>
  );
}
