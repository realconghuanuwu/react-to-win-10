import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  type PositioningVirtualElement,
} from '@fluentui/react-components';
import {
  ArrowClockwiseRegular,
  ArrowSortRegular,
  DesktopRegular,
  FolderAddRegular,
  GridRegular,
  PaintBrushRegular,
} from '@fluentui/react-icons';
import { DESKTOP_APPS } from '../../data/desktopApps';
import { DesktopIcon } from './DesktopIcon';

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function Desktop() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const iconRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const registerRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) {
      iconRefs.current.set(id, el);
    } else {
      iconRefs.current.delete(id);
    }
  }, []);

  const handleSelectIcon = useCallback((id: string, multiSelect: boolean) => {
    setContextMenuPos(null);
    setSelectedIds((prev) => {
      if (!multiSelect) return [id];
      return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
    });
  }, []);

  const virtualTarget = useMemo<PositioningVirtualElement | undefined>(() => {
    if (!contextMenuPos) return undefined;
    const { x, y } = contextMenuPos;
    return {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        top: y,
        bottom: y,
        left: x,
        right: x,
        x,
        y,
        toJSON: () => ({}),
      }),
    };
  }, [contextMenuPos]);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (e.target !== containerRef.current && (e.target as HTMLElement).dataset.desktopGrid !== 'true') {
      return;
    }
    setContextMenuPos(null);
    setSelectedIds([]);
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
      setSelectedIds(hitIds);
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
  }, [marquee]);

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleRefresh = () => {
    setContextMenuPos(null);
    setIsRefreshing(true);
    window.setTimeout(() => setIsRefreshing(false), 90);
  };

  const marqueeStyle = marquee
    ? {
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{
        backgroundImage: 'url("/assets/wallpapers/win10-hero.jpg")',
      }}
      className="relative w-full h-[calc(100vh-40px)] bg-cover bg-center bg-no-repeat overflow-hidden"
    >
      <div
        data-desktop-grid="true"
        className={[
          'grid grid-flow-col grid-rows-[repeat(auto-fill,76px)] auto-cols-[74px] gap-x-2 gap-y-0.5 p-2 h-full max-h-[min(calc(100vh-40px),656px)] w-fit content-start transition-opacity duration-75',
          isRefreshing ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        {DESKTOP_APPS.map((app) => (
          <DesktopIcon
            key={app.id}
            app={app}
            isSelected={selectedIds.includes(app.id)}
            onSelect={handleSelectIcon}
            registerRef={registerRef}
          />
        ))}
      </div>

      {marqueeStyle && marqueeStyle.width > 3 && marqueeStyle.height > 3 && (
        <div
          style={marqueeStyle}
          className="fixed pointer-events-none bg-[#0078d7]/28 border border-[#0078d7] z-20"
        />
      )}

      <Menu
        open={Boolean(contextMenuPos)}
        onOpenChange={(_, data) => {
          if (!data.open) setContextMenuPos(null);
        }}
        positioning={{
          target: virtualTarget,
          position: 'below',
          align: 'start',
        }}
      >
        <MenuPopover className="!bg-[#2b2b2b] !border !border-[#454545] !rounded-none !shadow-xl !min-w-[200px] !p-1">
          <MenuList>
            <MenuItem icon={<GridRegular />}>View</MenuItem>
            <MenuItem icon={<ArrowSortRegular />}>Sort by</MenuItem>
            <MenuItem icon={<ArrowClockwiseRegular />} onClick={handleRefresh}>
              Refresh
            </MenuItem>
            <MenuDivider />
            <MenuItem icon={<FolderAddRegular />}>New</MenuItem>
            <MenuDivider />
            <MenuItem icon={<DesktopRegular />}>Display settings</MenuItem>
            <MenuItem icon={<PaintBrushRegular />}>Personalize</MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
}
