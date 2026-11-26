import type { MouseEvent } from 'react';
import type { DesktopAppItem } from '../../data/desktopApps';
import type { DesktopIconSize } from '../../store/useDesktopStore';

interface DesktopIconProps {
  app: DesktopAppItem;
  iconSize: DesktopIconSize;
  isSelected: boolean;
  onSelect: (id: string, multiSelect: boolean) => void;
  onOpen: (id: string) => void;
  registerRef: (id: string, el: HTMLButtonElement | null) => void;
}

const SIZE_CLASSES: Record<DesktopIconSize, { cell: string; img: string }> = {
  small: { cell: 'w-[68px] h-[64px]', img: 'w-7 h-7' },
  medium: { cell: 'w-[74px] h-[76px]', img: 'w-9 h-9' },
  large: { cell: 'w-[86px] h-[94px]', img: 'w-12 h-12' },
};

export function DesktopIcon({
  app,
  iconSize,
  isSelected,
  onSelect,
  onOpen,
  registerRef,
}: DesktopIconProps) {
  const { cell, img } = SIZE_CLASSES[iconSize];

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onSelect(app.id, e.ctrlKey || e.metaKey);
  };

  return (
    <button
      ref={(el) => registerRef(app.id, el)}
      type="button"
      onClick={handleClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen(app.id);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        onSelect(app.id, false);
      }}
      className={[
        'group flex flex-col items-center justify-start px-1 py-1 rounded-[2px] border transition-colors duration-75 cursor-default outline-none',
        cell,
        isSelected
          ? 'bg-white/22 border-white/45'
          : 'border-transparent hover:bg-white/12 hover:border-white/25',
      ].join(' ')}
    >
      <img
        src={app.icon}
        alt={app.name}
        draggable={false}
        className={`${img} object-contain mb-1 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]`}
      />
      <span
        className="w-full text-center text-[11.5px] leading-[14px] text-white font-normal line-clamp-2 break-words [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_4px_rgba(0,0,0,0.65)]"
      >
        {app.name}
      </span>
    </button>
  );
}
