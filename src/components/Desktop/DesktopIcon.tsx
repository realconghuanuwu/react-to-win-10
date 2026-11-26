import type { MouseEvent } from 'react';
import type { DesktopAppItem } from '../../data/desktopApps';

interface DesktopIconProps {
  app: DesktopAppItem;
  isSelected: boolean;
  onSelect: (id: string, multiSelect: boolean) => void;
  onOpen: (id: string) => void;
  registerRef: (id: string, el: HTMLButtonElement | null) => void;
}

export function DesktopIcon({
  app,
  isSelected,
  onSelect,
  onOpen,
  registerRef,
}: DesktopIconProps) {
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
        'group flex flex-col items-center justify-start w-[74px] h-[76px] px-1 py-1 rounded-[2px] border transition-colors duration-75 cursor-default outline-none',
        isSelected
          ? 'bg-white/22 border-white/45'
          : 'border-transparent hover:bg-white/12 hover:border-white/25',
      ].join(' ')}
    >
      <img
        src={app.icon}
        alt={app.name}
        draggable={false}
        className="w-9 h-9 object-contain mb-1 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
      />
      <span
        className="w-full text-center text-[11.5px] leading-[14px] text-white font-normal line-clamp-2 break-words [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_4px_rgba(0,0,0,0.65)]"
      >
        {app.name}
      </span>
    </button>
  );
}
