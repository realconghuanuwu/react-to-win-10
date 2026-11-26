import type { BrushType, PaintToolId, ShapeType } from './paintTypes';

export function ToolIcon({ tool }: { tool: Exclude<PaintToolId, 'brush' | 'shape' | 'select-rect' | 'select-free'> }) {
  switch (tool) {
    case 'pencil':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M11.8 1.5l2.7 2.7-8.8 8.8-3.4.7.7-3.4 8.8-8.8z" fill="#f3c64f" stroke="#5d4a1e" strokeWidth="1" />
          <path d="M10.4 2.9l2.7 2.7" stroke="#b5651d" strokeWidth="1" />
          <path d="M2.3 13.7l1.2-.3-.9-.9-.3 1.2z" fill="#2b2b2b" />
        </svg>
      );
    case 'fill':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M3 8.5L7.8 3.7l4.5 4.5-4.8 4.8L3 8.5z" fill="#dce6f2" stroke="#476382" strokeWidth="1" />
          <path d="M6.2 2.4c.8.8 1.6 1.8 1.6 2.8" fill="none" stroke="#476382" strokeWidth="1.2" />
          <path d="M12.5 9.5c1.2 1.4 1.8 2.5 1.8 3.2a1.6 1.6 0 1 1-3.2 0c0-.7.5-1.8 1.4-3.2z" fill="#1e88e5" />
        </svg>
      );
    case 'text':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <text x="8" y="13" textAnchor="middle" fontSize="14" fontFamily="Georgia, serif" fontWeight="bold" fill="#222">
            A
          </text>
        </svg>
      );
    case 'eraser':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <polygon points="3,10 9,4 13.5,8.5 7.5,14.5 3,14.5" fill="#f5b7c2" stroke="#8a4b56" strokeWidth="1" />
          <line x1="6" y1="7" x2="10.5" y2="11.5" stroke="#8a4b56" strokeWidth="0.9" />
        </svg>
      );
    case 'picker':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M10.5 2.5l3 3-1.4 1.4-3-3 1.4-1.4z" fill="#4f6d8c" stroke="#2d4054" strokeWidth="0.8" />
          <path d="M9.5 4.5l2 2-6.5 6.5-2.5.5.5-2.5 6.5-6.5z" fill="#eef4fa" stroke="#4f6d8c" strokeWidth="1" />
        </svg>
      );
    case 'magnifier':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="4.2" fill="#d9eefc" stroke="#3c6082" strokeWidth="1.2" />
          <line x1="9.6" y1="9.6" x2="14" y2="14" stroke="#5b4636" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

export function BrushIcon({ brush, size = 20 }: { brush: BrushType; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {brush === 'airbrush' ? (
        <>
          <rect x="10" y="9" width="8" height="12" rx="1.5" fill="#c9d6e4" stroke="#48637e" strokeWidth="1.2" />
          <rect x="12" y="5" width="4" height="4" fill="#829ab1" stroke="#48637e" strokeWidth="1" />
          <circle cx="5" cy="5" r="0.9" fill="#1d70b8" />
          <circle cx="7.5" cy="4" r="0.8" fill="#1d70b8" />
          <circle cx="6.5" cy="7" r="0.9" fill="#1d70b8" />
          <circle cx="4" cy="8.5" r="0.7" fill="#1d70b8" />
        </>
      ) : brush === 'crayon' ? (
        <>
          <polygon points="5,19 7,14 16,5 19,8 10,17" fill="#e06666" stroke="#7f2b2b" strokeWidth="1.2" />
          <line x1="8" y1="13" x2="11" y2="16" stroke="#333" strokeWidth="1.2" />
          <line x1="14" y1="7" x2="17" y2="10" stroke="#333" strokeWidth="1.2" />
        </>
      ) : brush === 'marker' ? (
        <>
          <polygon points="4,20 7,15 16,6 19,9 10,18" fill="#ffd966" stroke="#7f6000" strokeWidth="1.2" />
          <polygon points="4,20 7,15 8.5,16.5" fill="#2b2b2b" />
        </>
      ) : brush === 'natural-pencil' ? (
        <>
          <polygon points="4,20 6,15 17,4 20,7 9,18" fill="#a67c52" stroke="#4e3822" strokeWidth="1.2" />
          <polygon points="4,20 6,15 8.5,17.5" fill="#d9c2a3" />
        </>
      ) : (
        <>
          <path d="M15.5 3.5l5 5-8.5 8.5-5-5 8.5-8.5z" fill="#c97b3e" stroke="#6c3e1a" strokeWidth="1.1" />
          <path d="M7 12c-2.2 1.2-3.2 3.2-3.2 5.2 0 1.4 1.1 2.5 2.5 2.5 2 0 4-1 5.2-3.2L7 12z" fill="#3a6ea5" stroke="#234569" strokeWidth="1.1" />
          <rect x="11.2" y="8.2" width="4.8" height="2" transform="rotate(45 13.6 9.2)" fill="#cfd8e3" />
        </>
      )}
    </svg>
  );
}

export function ShapeIcon({ shape }: { shape: ShapeType }) {
  const stroke = '#2c5482';
  const fill = '#e5f0fb';
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      {shape === 'line' && <line x1="2.5" y1="13.5" x2="13.5" y2="2.5" stroke={stroke} strokeWidth="1.5" />}
      {shape === 'curve' && (
        <path d="M2 12 C 5 2, 11 14, 14 4" fill="none" stroke={stroke} strokeWidth="1.4" />
      )}
      {shape === 'oval' && <ellipse cx="8" cy="8" rx="5.8" ry="4.4" fill={fill} stroke={stroke} strokeWidth="1.2" />}
      {shape === 'rectangle' && <rect x="2.2" y="3.5" width="11.6" height="9" fill={fill} stroke={stroke} strokeWidth="1.2" />}
      {shape === 'rounded-rectangle' && (
        <rect x="2.2" y="3.5" width="11.6" height="9" rx="2.5" fill={fill} stroke={stroke} strokeWidth="1.2" />
      )}
      {shape === 'polygon' && (
        <polygon points="3,4 9,2.5 13.5,6.5 11,13 4.5,12" fill={fill} stroke={stroke} strokeWidth="1.2" />
      )}
      {shape === 'triangle' && <polygon points="8,2.5 13.8,13.2 2.2,13.2" fill={fill} stroke={stroke} strokeWidth="1.2" />}
      {shape === 'right-triangle' && <polygon points="3,2.5 13.5,13.2 3,13.2" fill={fill} stroke={stroke} strokeWidth="1.2" />}
      {shape === 'diamond' && <polygon points="8,2 14,8 8,14 2,8" fill={fill} stroke={stroke} strokeWidth="1.2" />}
      {shape === 'pentagon' && <polygon points="8,2 14,6.4 11.7,13.5 4.3,13.5 2,6.4" fill={fill} stroke={stroke} strokeWidth="1.2" />}
      {shape === 'hexagon' && <polygon points="8,2 13.2,5 13.2,11 8,14 2.8,11 2.8,5" fill={fill} stroke={stroke} strokeWidth="1.2" />}
      {shape === 'right-arrow' && <polygon points="2,6 9,6 9,3.5 14,8 9,12.5 9,10 2,10" fill={fill} stroke={stroke} strokeWidth="1.1" />}
      {shape === 'left-arrow' && <polygon points="14,6 7,6 7,3.5 2,8 7,12.5 7,10 14,10" fill={fill} stroke={stroke} strokeWidth="1.1" />}
      {shape === 'up-arrow' && <polygon points="8,2 12.5,7 10,7 10,14 6,14 6,7 3.5,7" fill={fill} stroke={stroke} strokeWidth="1.1" />}
      {shape === 'down-arrow' && <polygon points="6,2 10,2 10,9 12.5,9 8,14 3.5,9 6,9" fill={fill} stroke={stroke} strokeWidth="1.1" />}
      {shape === 'four-point-star' && (
        <polygon points="8,1.5 9.8,6.2 14.5,8 9.8,9.8 8,14.5 6.2,9.8 1.5,8 6.2,6.2" fill={fill} stroke={stroke} strokeWidth="1.1" />
      )}
      {shape === 'five-point-star' && (
        <polygon points="8,1.8 9.7,5.8 14,6.2 10.7,9 11.7,13.3 8,11 4.3,13.3 5.3,9 2,6.2 6.3,5.8" fill={fill} stroke={stroke} strokeWidth="1.05" />
      )}
      {shape === 'six-point-star' && (
        <polygon points="8,1.5 9.8,4.9 13.6,4.8 11.6,8 13.6,11.2 9.8,11.1 8,14.5 6.2,11.1 2.4,11.2 4.4,8 2.4,4.8 6.2,4.9" fill={fill} stroke={stroke} strokeWidth="1" />
      )}
      {shape === 'rounded-rect-callout' && (
        <path d="M3.5,2.5 h9 a1.5,1.5 0 0 1 1.5,1.5 v5.5 a1.5,1.5 0 0 1 -1.5,1.5 h-5 l-3,2.8 v-2.8 h-1 a1.5,1.5 0 0 1 -1.5,-1.5 v-5.5 a1.5,1.5 0 0 1 1.5,-1.5 z" fill={fill} stroke={stroke} strokeWidth="1.1" />
      )}
      {shape === 'oval-callout' && (
        <path d="M8,2.5 a6,4.2 0 1 1 -2.8,7.9 l-2.2,2.6 0.6,-3.4 a6,4.2 0 0 1 4.4,-7.1 z" fill={fill} stroke={stroke} strokeWidth="1.1" />
      )}
      {shape === 'cloud-callout' && (
        <path d="M4.2,10.5 C2,10.5 2,7 4,6.5 C3.8,4 7,3.5 8,4.8 C9.5,3.5 13,4.2 12.2,7 C14,8 13.2,10.8 10.8,10.5 Z" fill={fill} stroke={stroke} strokeWidth="1.1" />
      )}
      {shape === 'heart' && (
        <path d="M8,13.5 C4,10.5 2,8 2,5.5 A3,3 0 0 1 8,4.8 A3,3 0 0 1 14,5.5 C14,8 12,10.5 8,13.5 Z" fill={fill} stroke={stroke} strokeWidth="1.1" />
      )}
      {shape === 'lightning' && (
        <polygon points="7.5,2 13,2 9,6.8 13,6.8 5,14 7.5,8.5 4,8.5" fill={fill} stroke={stroke} strokeWidth="1.1" />
      )}
    </svg>
  );
}
