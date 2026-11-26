import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { DesktopIconSize } from '../../store/useDesktopStore';

export interface DesktopDisplayItem {
  id: string;
  name: string;
  icon: string;
  isFolder?: boolean;
  isSystem?: boolean;
}

interface DesktopIconProps {
  item: DesktopDisplayItem;
  iconSize: DesktopIconSize;
  left: number;
  top: number;
  isSelected: boolean;
  isRenaming: boolean;
  isDragging?: boolean;
  onSelect: (id: string, multiSelect: boolean) => void;
  onOpen: (item: DesktopDisplayItem) => void;
  onRightClick: (id: string, x: number, y: number) => void;
  onDragStart: (item: DesktopDisplayItem, e: ReactPointerEvent<HTMLDivElement>) => void;
  onCommitRename: (id: string, value: string) => void;
  onCancelRename: () => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

const SIZE_CLASSES: Record<DesktopIconSize, { cell: string; img: string }> = {
  small: { cell: 'w-[68px] h-[64px]', img: 'w-7 h-7' },
  medium: { cell: 'w-[74px] h-[76px]', img: 'w-9 h-9' },
  large: { cell: 'w-[86px] h-[94px]', img: 'w-12 h-12' },
};

export function DesktopIcon({
  item,
  iconSize,
  left,
  top,
  isSelected,
  isRenaming,
  isDragging = false,
  onSelect,
  onOpen,
  onRightClick,
  onDragStart,
  onCommitRename,
  onCancelRename,
  registerRef,
}: DesktopIconProps) {
  const { cell, img } = SIZE_CLASSES[iconSize];
  const [draft, setDraft] = useState(item.name);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isRenaming) {
      setDraft(item.name);
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isRenaming, item.name]);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isRenaming) return;
    onSelect(item.id, e.ctrlKey || e.metaKey);
  };

  return (
    <div
      ref={(el) => registerRef(item.id, el)}
      role="button"
      tabIndex={0}
      aria-label={item.name}
      data-desktop-icon={item.id}
      style={{ left, top }}
      onClick={handleClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isRenaming) return;
        onOpen(item);
      }}
      onPointerDown={(e) => {
        if (isRenaming) return;
        onDragStart(item, e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRightClick(item.id, e.clientX, e.clientY);
      }}
      className={[
        'absolute group flex flex-col items-center justify-start px-1 py-1 rounded-[2px] border transition-colors duration-75 cursor-default outline-none select-none',
        cell,
        isDragging ? 'opacity-40' : 'opacity-100',
        isSelected
          ? 'bg-white/22 border-white/45'
          : 'border-transparent hover:bg-white/12 hover:border-white/25',
      ].join(' ')}
    >
      <img
        src={item.icon}
        alt={item.name}
        draggable={false}
        className={`${img} object-contain mb-1 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]`}
      />
      {isRenaming ? (
        <textarea
          ref={inputRef}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onBlur={() => onCommitRename(item.id, draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommitRename(item.id, draft);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancelRename();
            }
          }}
          className="w-full resize-none bg-white text-black text-[11.5px] leading-[13px] text-center px-0.5 py-0 border border-[#0078d7] outline-none overflow-hidden"
        />
      ) : (
        <span
          className="w-full text-center text-[11.5px] leading-[14px] text-white font-normal line-clamp-2 break-words [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_4px_rgba(0,0,0,0.65)]"
        >
          {item.name}
        </span>
      )}
    </div>
  );
}
