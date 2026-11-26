import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
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
import { resolveDesktopAppIcon } from '../../data/desktopApps';
import { formatStorageBytes, useFileSystemStore, useRecycleBinHasItems } from '../../store/useFileSystemStore';
import { getWallpaperCssProps } from '../Apps/PersonalizationSettingsApp';
import { handleFileClipboardShortcut } from '../../utils/fileClipboardShortcuts';
import { openVirtualFile } from '../../utils/openVirtualFile';
import { getFileTypeInfo } from '../../utils/fileTypes';
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
  small: { w: 80, h: 74 },
  medium: { w: 88, h: 88 },
  large: { w: 102, h: 106 },
};

const PADDING = 8;

export function Desktop() {
  const allApps = useDesktopStore((state) => state.apps);
  const taskbarSettings = useDesktopStore((state) => state.taskbarSettings);
  const shortcutLabels = useDesktopStore((state) => state.shortcutLabels);
  const iconPositions = useDesktopStore((state) => state.iconPositions);
  const freeIconPositions = useDesktopStore((state) => state.freeIconPositions);
  const alignToGrid = useDesktopStore((state) => state.alignToGrid);
  const autoArrangeIcons = useDesktopStore((state) => state.autoArrangeIcons);
  const selectedIds = useDesktopStore((state) => state.selectedIconIds);
  const renamingIconId = useDesktopStore((state) => state.renamingIconId);
  const isRefreshing = useDesktopStore((state) => state.isRefreshing);
  const iconSize = useDesktopStore((state) => state.iconSize);
  const showDesktopIcons = useDesktopStore((state) => state.showDesktopIcons);
  const personalization = useDesktopStore((state) => state.personalizationSettings);
  const desktopPropertiesTargetId = useDesktopStore((state) => state.desktopPropertiesTargetId);
  const shortcutModalOpen = useDesktopStore((state) => state.shortcutModalOpen);
  const selectIcon = useDesktopStore((state) => state.selectIcon);
  const setSelectedIconIds = useDesktopStore((state) => state.setSelectedIconIds);
  const clearSelection = useDesktopStore((state) => state.clearSelection);
  const setContextMenuPos = useDesktopStore((state) => state.setContextMenuPos);
  const moveIconToSlot = useDesktopStore((state) => state.moveIconToSlot);
  const setFreeIconPosition = useDesktopStore((state) => state.setFreeIconPosition);
  const setRenamingIconId = useDesktopStore((state) => state.setRenamingIconId);
  const renameShortcut = useDesktopStore((state) => state.renameShortcut);
  const triggerRefresh = useDesktopStore((state) => state.triggerRefresh);
  const openApp = useDesktopStore((state) => state.openApp);
  const setDesktopPropertiesTargetId = useDesktopStore((state) => state.setDesktopPropertiesTargetId);
  const setShortcutModalOpen = useDesktopStore((state) => state.setShortcutModalOpen);

  const fsNodes = useFileSystemStore((state) => state.nodes);
  const binHasItems = useRecycleBinHasItems();
  const renameFsNode = useFileSystemStore((state) => state.renameNode);
  const clipboard = useFileSystemStore((state) => state.clipboard);
  const deleteFsNodes = useFileSystemStore((state) => state.deleteNodes);
  const deleteNodesPermanently = useFileSystemStore((state) => state.deleteNodesPermanently);
  const moveNodes = useFileSystemStore((state) => state.moveNodes);
  const undoFs = useFileSystemStore((state) => state.undo);
  const createShortcut = useFileSystemStore((state) => state.createShortcut);
  const importHostFiles = useFileSystemStore((state) => state.importHostFiles);

  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isHostDragging, setIsHostDragging] = useState(false);
  const [shortcutTargetAppId, setShortcutTargetAppId] = useState('notepad');
  const [shortcutCustomName, setShortcutCustomName] = useState('Notepad');
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 720,
  );
  const iconRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
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
        icon: resolveDesktopAppIcon(app, binHasItems),
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
        isShortcut: Boolean(node.shortcutTarget),
      }));

    return [...builtIn, ...desktopNodes];
  }, [allApps, shortcutLabels, fsNodes, binHasItems]);

  const resolvedSlots = useMemo(() => {
    const result: Record<string, GridSlot> = {};
    const assignedIds: string[] = [];

    if (autoArrangeIcons) {
      const ordered = [...desktopItems].sort((a, b) => {
        const pa = iconPositions[a.id];
        const pb = iconPositions[b.id];
        if (pa && pb) return pa.col - pb.col || pa.row - pb.row;
        if (pa) return -1;
        if (pb) return 1;
        return 0;
      });
      ordered.forEach((item, index) => {
        result[item.id] = {
          col: Math.floor(index / maxRows),
          row: index % maxRows,
        };
      });
      return result;
    }

    const taken = new Set<string>();
    desktopItems.forEach((item) => {
      const existing = iconPositions[item.id];
      if (existing) {
        const col = Math.max(0, existing.col);
        const row = Math.max(0, Math.min(maxRows - 1, existing.row));
        const key = `${col}:${row}`;
        if (!taken.has(key)) {
          result[item.id] = { col, row };
          taken.add(key);
          assignedIds.push(item.id);
          return;
        }
      }
      const freeSlot = findNextFreeSlot(result, assignedIds, maxRows);
      result[item.id] = freeSlot;
      taken.add(`${freeSlot.col}:${freeSlot.row}`);
      assignedIds.push(item.id);
    });
    return result;
  }, [desktopItems, iconPositions, maxRows, autoArrangeIcons]);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      iconRefs.current.set(id, el);
    } else {
      iconRefs.current.delete(id);
    }
  }, []);

  const handleOpenItem = useCallback(
    (item: DesktopDisplayItem) => {
      if (item.isFile) {
        openVirtualFile(item.id);
      } else if (item.isFolder) {
        openApp('explorer', item.id);
      } else {
        openApp(item.id);
      }
    },
    [openApp],
  );

  // Keyboard shortcuts on Desktop: F2, Delete, Shift+Delete, F5, Ctrl+A, Ctrl+Z, Enter, Arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || renamingIconId) return;
      const desktop = useDesktopStore.getState();
      if (desktop.isStartMenuOpen || desktop.isTaskViewOpen || desktop.isRunDialogOpen || desktop.isLockScreenOpen) return;
      if (desktop.activeAppId && document.activeElement !== containerRef.current && !containerRef.current?.contains(document.activeElement)) {
        return;
      }
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIconIds(desktopItems.map((i) => i.id));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoFs();
        return;
      }

      if (e.key === 'F5') {
        e.preventDefault();
        triggerRefresh();
        return;
      }

      if (e.key === 'F2' && selectedIds.length === 1) {
        e.preventDefault();
        setRenamingIconId(selectedIds[0]);
        return;
      }

      if (e.key === 'Enter' && selectedIds.length > 0) {
        e.preventDefault();
        selectedIds.forEach((id) => {
          const item = desktopItems.find((i) => i.id === id);
          if (item) handleOpenItem(item);
        });
        return;
      }

      if (e.key === 'Delete' && selectedIds.length > 0) {
        const deletable = selectedIds.filter((id) => {
          const item = desktopItems.find((i) => i.id === id);
          return (item?.isFolder || item?.isFile) && !item.isSystem;
        });
        if (deletable.length > 0) {
          e.preventDefault();
          if (e.shiftKey) deleteNodesPermanently(deletable);
          else deleteFsNodes(deletable);
          setSelectedIconIds([]);
        }
        return;
      }

      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        desktopItems.length > 0
      ) {
        e.preventDefault();
        const currentId = selectedIds[selectedIds.length - 1];
        if (!currentId) {
          const first = desktopItems[0].id;
          selectionAnchorRef.current = first;
          setSelectedIconIds([first]);
          return;
        }
        const curSlot = resolvedSlots[currentId] ?? { col: 0, row: 0 };
        let bestId = currentId;
        let bestScore = Infinity;
        for (const item of desktopItems) {
          if (item.id === currentId) continue;
          const s = resolvedSlots[item.id] ?? { col: 0, row: 0 };
          const dx = s.col - curSlot.col;
          const dy = s.row - curSlot.row;
          const valid =
            (e.key === 'ArrowUp' && dy < 0) ||
            (e.key === 'ArrowDown' && dy > 0) ||
            (e.key === 'ArrowLeft' && dx < 0) ||
            (e.key === 'ArrowRight' && dx > 0);
          if (!valid) continue;
          const score =
            e.key === 'ArrowUp' || e.key === 'ArrowDown'
              ? Math.abs(dy) + Math.abs(dx) * 10
              : Math.abs(dx) + Math.abs(dy) * 10;
          if (score < bestScore) {
            bestScore = score;
            bestId = item.id;
          }
        }
        selectionAnchorRef.current = bestId;
        setSelectedIconIds([bestId]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    renamingIconId,
    selectedIds,
    desktopItems,
    resolvedSlots,
    setRenamingIconId,
    deleteFsNodes,
    deleteNodesPermanently,
    setSelectedIconIds,
    triggerRefresh,
    undoFs,
    handleOpenItem,
  ]);

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

  const handleSelectIcon = useCallback(
    (id: string, multiSelect: boolean, rangeSelect: boolean) => {
      if (rangeSelect && selectionAnchorRef.current) {
        const fromIdx = desktopItems.findIndex((i) => i.id === selectionAnchorRef.current);
        const toIdx = desktopItems.findIndex((i) => i.id === id);
        if (fromIdx >= 0 && toIdx >= 0) {
          const rangeIds = desktopItems
            .slice(Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx) + 1)
            .map((i) => i.id);
          setSelectedIconIds(multiSelect ? [...new Set([...selectedIds, ...rangeIds])] : rangeIds);
          return;
        }
      }
      selectionAnchorRef.current = id;
      selectIcon(id, multiSelect);
    },
    [desktopItems, selectedIds, selectIcon, setSelectedIconIds],
  );

  const findDropTargetAtPoint = (clientX: number, clientY: number, draggedIds: Set<string>): string | null => {
    for (const item of desktopItems) {
      if (draggedIds.has(item.id)) continue;
      if (!item.isFolder && item.id !== 'recycle-bin') continue;
      const el = iconRefs.current.get(item.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return item.id;
      }
    }
    return null;
  };

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
    const draggedIds = new Set(
      selectedIds.includes(item.id) ? selectedIds : [item.id],
    );
    const canDropToFolder = [...draggedIds].some((id) => {
      const target = desktopItems.find((d) => d.id === id);
      return (target?.isFolder || target?.isFile) && !target.isSystem;
    });
    let dragging = false;
    let activeDropTarget: string | null = null;

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
      if (canDropToFolder) {
        activeDropTarget = findDropTargetAtPoint(moveEvent.clientX, moveEvent.clientY, draggedIds);
        setDropTargetId(activeDropTarget);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (dragging) {
        if (activeDropTarget && canDropToFolder) {
          const movable = [...draggedIds].filter((id) => {
            const target = desktopItems.find((d) => d.id === id);
            return (target?.isFolder || target?.isFile) && !target.isSystem;
          });
          if (movable.length > 0) {
            moveNodes(movable, activeDropTarget);
            setSelectedIconIds([]);
          }
        } else {
          const dropLeft = upEvent.clientX - offsetX - insets.left;
          const dropTop = upEvent.clientY - offsetY - insets.top;
          if (!alignToGrid) {
            setFreeIconPosition(item.id, {
              x: Math.max(PADDING, Math.round(dropLeft)),
              y: Math.max(PADDING, Math.round(dropTop)),
            });
          } else {
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
          }
        }
        setDragPreview(null);
        setDropTargetId(null);
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

  const handleHostDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      setIsHostDragging(true);
    }
  };

  const handleHostDrop = (e: DragEvent<HTMLDivElement>) => {
    setIsHostDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      void importHostFiles('desktop', e.dataTransfer.files);
    }
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

  const propTargetItem = desktopPropertiesTargetId
    ? desktopItems.find((i) => i.id === desktopPropertiesTargetId) ?? null
    : null;
  const propTargetNode = desktopPropertiesTargetId ? fsNodes[desktopPropertiesTargetId] : undefined;

  const handleCreateShortcutSubmit = (e: FormEvent) => {
    e.preventDefault();
    const app = allApps.find((a) => a.id === shortcutTargetAppId);
    if (!app) return;
    createShortcut(
      'desktop',
      shortcutCustomName.trim() || app.name,
      { kind: 'app', appId: app.id },
      app.icon,
    );
    setShortcutModalOpen(false);
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onPointerDownCapture={(e) => {
        if (e.target instanceof Element && !e.target.closest('input, textarea, [contenteditable]')) {
          e.currentTarget.focus({ preventScroll: true });
        }
      }}
      onKeyDown={(e) => {
        const desktop = useDesktopStore.getState();
        if (!desktop.isStartMenuOpen && !desktop.isTaskViewOpen) {
          handleFileClipboardShortcut(e.nativeEvent, selectedIds, 'desktop');
        }
      }}
      onDragOver={handleHostDragOver}
      onDragLeave={() => setIsHostDragging(false)}
      onDrop={handleHostDrop}
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
      className="fixed overflow-hidden outline-none"
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
            const free = !alignToGrid && !autoArrangeIcons ? freeIconPositions[item.id] : undefined;
            const left = free ? free.x : PADDING + slot.col * cellStep.w;
            const top = free ? free.y : PADDING + slot.row * cellStep.h;
            return (
              <DesktopIcon
                key={item.id}
                item={item}
                iconSize={iconSize}
                left={left}
                top={top}
                isSelected={selectedIds.includes(item.id)}
                isRenaming={renamingIconId === item.id}
                isCut={clipboard?.mode === 'cut' && clipboard.ids.includes(item.id)}
                isDragging={dragPreview?.item.id === item.id}
                isDropTarget={dropTargetId === item.id}
                onSelect={handleSelectIcon}
                onOpen={handleOpenItem}
                onRightClick={(id, x, y) => {
                  if (!selectedIds.includes(id)) selectIcon(id, false);
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

      {isHostDragging && (
        <div className="fixed inset-4 z-30 pointer-events-none border-2 border-dashed border-[#66baff] bg-[#0078d7]/20 flex items-center justify-center text-white text-[15px] font-medium">
          Drop files to copy to Desktop
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

      {/* Desktop Item Properties Modal */}
      {propTargetItem && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/35"
          onClick={() => setDesktopPropertiesTargetId(null)}
        >
          <div
            role="dialog"
            aria-label={`${propTargetItem.name} Properties`}
            onClick={(e) => e.stopPropagation()}
            className="w-[320px] bg-[#242424] border border-[#555] shadow-2xl text-[12px] text-white select-none"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-[#1f1f1f] border-b border-[#3a3a3a]">
              <span className="truncate">{propTargetItem.name} Properties</span>
              <button
                type="button"
                onClick={() => setDesktopPropertiesTargetId(null)}
                className="px-1.5 hover:bg-[#e81123] cursor-default"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="flex items-center gap-3 pb-2 border-b border-[#3a3a3a]">
                <img src={propTargetItem.icon} alt="" className="w-9 h-9 object-contain" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{propTargetItem.name}</div>
                  <div className="text-white/60">
                    {propTargetNode ? getFileTypeInfo(propTargetNode).label : 'System Shortcut'}
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-white/80">
                <span>Location:</span>
                <span>Desktop</span>
              </div>
              {propTargetNode && (
                <>
                  <div className="flex justify-between text-white/80">
                    <span>Size:</span>
                    <span>
                      {formatStorageBytes(propTargetNode.sizeBytes ?? propTargetNode.content?.length ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-white/80">
                    <span>Modified:</span>
                    <span>{new Date(propTargetNode.modifiedAt).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end px-4 py-2.5 bg-[#1f1f1f] border-t border-[#3a3a3a]">
              <button
                type="button"
                onClick={() => setDesktopPropertiesTargetId(null)}
                className="px-4 py-1 bg-[#333] hover:bg-[#444] border border-[#555] cursor-default"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Shortcut Modal */}
      {shortcutModalOpen && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/35"
          onClick={() => setShortcutModalOpen(false)}
        >
          <form
            onSubmit={handleCreateShortcutSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-[340px] bg-[#242424] border border-[#555] shadow-2xl text-[12px] text-white select-none"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-[#1f1f1f] border-b border-[#3a3a3a]">
              <span>Create Shortcut</span>
              <button
                type="button"
                onClick={() => setShortcutModalOpen(false)}
                className="px-1.5 hover:bg-[#e81123] cursor-default"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-white/80 mb-1">Target application</label>
                <select
                  value={shortcutTargetAppId}
                  onChange={(e) => {
                    setShortcutTargetAppId(e.target.value);
                    const found = allApps.find((a) => a.id === e.target.value);
                    if (found) setShortcutCustomName(found.name);
                  }}
                  className="w-full h-[28px] px-2 bg-[#1a1a1a] border border-[#555] text-white outline-none"
                >
                  {allApps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white/80 mb-1">Shortcut name</label>
                <input
                  type="text"
                  value={shortcutCustomName}
                  onChange={(e) => setShortcutCustomName(e.target.value)}
                  className="w-full h-[28px] px-2 bg-[#1a1a1a] border border-[#555] text-white outline-none focus:border-[#0078d7]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-2.5 bg-[#1f1f1f] border-t border-[#3a3a3a]">
              <button
                type="submit"
                className="px-4 py-1 bg-[#0078d7] hover:bg-[#1084e0] text-white cursor-default"
              >
                Finish
              </button>
              <button
                type="button"
                onClick={() => setShortcutModalOpen(false)}
                className="px-4 py-1 bg-[#333] hover:bg-[#444] border border-[#555] cursor-default"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
