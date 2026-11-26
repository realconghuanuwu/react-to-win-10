import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useDesktopStore, type DesktopIconSize } from '../../store/useDesktopStore';
import { DesktopContextMenu } from './DesktopContextMenu';
import { DesktopIcon } from './DesktopIcon';

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const GRID_CLASSES: Record<DesktopIconSize, string> = {
  small: 'grid-rows-[repeat(auto-fill,64px)] auto-cols-[68px]',
  medium: 'grid-rows-[repeat(auto-fill,76px)] auto-cols-[74px]',
  large: 'grid-rows-[repeat(auto-fill,94px)] auto-cols-[86px]',
};

export function Desktop() {
  const allApps = useDesktopStore((state) => state.apps);
  const apps = allApps.filter((app) => app.showOnDesktop !== false);
  const selectedIds = useDesktopStore((state) => state.selectedIconIds);
  const isRefreshing = useDesktopStore((state) => state.isRefreshing);
  const iconSize = useDesktopStore((state) => state.iconSize);
  const showDesktopIcons = useDesktopStore((state) => state.showDesktopIcons);
  const selectIcon = useDesktopStore((state) => state.selectIcon);
  const setSelectedIconIds = useDesktopStore((state) => state.setSelectedIconIds);
  const clearSelection = useDesktopStore((state) => state.clearSelection);
  const setContextMenuPos = useDesktopStore((state) => state.setContextMenuPos);
  const openApp = useDesktopStore((state) => state.openApp);

  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const iconRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const registerRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) {
      iconRefs.current.set(id, el);
    } else {
      iconRefs.current.delete(id);
    }
  }, []);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (e.target !== containerRef.current && (e.target as HTMLElement).dataset.desktopGrid !== 'true') {
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
    setContextMenuPos({ x: e.clientX, y: e.clientY });
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
      {showDesktopIcons && (
        <div
          data-desktop-grid="true"
          className={[
            'grid grid-flow-col gap-x-2 gap-y-0.5 p-2 h-full max-h-[min(calc(100vh-40px),656px)] w-fit content-start transition-opacity duration-75',
            GRID_CLASSES[iconSize],
            isRefreshing ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
        >
          {apps.map((app) => (
            <DesktopIcon
              key={app.id}
              app={app}
              iconSize={iconSize}
              isSelected={selectedIds.includes(app.id)}
              onSelect={selectIcon}
              onOpen={openApp}
              registerRef={registerRef}
            />
          ))}
        </div>
      )}

      {marqueeStyle && marqueeStyle.width > 3 && marqueeStyle.height > 3 && (
        <div
          style={marqueeStyle}
          className="fixed pointer-events-none bg-[#0078d7]/28 border border-[#0078d7] z-20"
        />
      )}

      <DesktopContextMenu />
    </div>
  );
}
