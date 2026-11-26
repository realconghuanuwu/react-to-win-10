export type PaintToolId =
  | 'select-rect'
  | 'select-free'
  | 'pencil'
  | 'fill'
  | 'text'
  | 'eraser'
  | 'picker'
  | 'magnifier'
  | 'brush'
  | 'shape';

export type BrushType =
  | 'brush'
  | 'calligraphy1'
  | 'calligraphy2'
  | 'airbrush'
  | 'oil'
  | 'crayon'
  | 'marker'
  | 'natural-pencil'
  | 'watercolor';

export type ShapeType =
  | 'line'
  | 'curve'
  | 'oval'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'polygon'
  | 'triangle'
  | 'right-triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'right-arrow'
  | 'left-arrow'
  | 'up-arrow'
  | 'down-arrow'
  | 'four-point-star'
  | 'five-point-star'
  | 'six-point-star'
  | 'rounded-rect-callout'
  | 'oval-callout'
  | 'cloud-callout'
  | 'heart'
  | 'lightning';

export type ShapeStyleMode =
  | 'none'
  | 'solid'
  | 'crayon'
  | 'marker'
  | 'oil'
  | 'natural-pencil'
  | 'watercolor';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BrushMeta {
  id: BrushType;
  label: string;
  defaultSizeMultiplier: number;
}

export interface ShapeMeta {
  id: ShapeType;
  label: string;
}

export const DEFAULT_PALETTE_COLORS: string[] = [
  // Row 1 (classic MS Paint dark/primary row)
  '#000000',
  '#7f7f7f',
  '#880015',
  '#ed1c24',
  '#ff7f27',
  '#fff200',
  '#22b14c',
  '#00a2e8',
  '#3f48cc',
  '#a349a4',
  // Row 2 (classic MS Paint light/pastel row)
  '#ffffff',
  '#c3c3c3',
  '#b97a57',
  '#ffaec9',
  '#ffc90e',
  '#efe4b0',
  '#b5e61d',
  '#99d9ea',
  '#7092be',
  '#c8bfe7',
];

export const INITIAL_CUSTOM_COLORS: (string | null)[] = Array.from({ length: 10 }, () => null);

export const BRUSH_OPTIONS: BrushMeta[] = [
  { id: 'brush', label: 'Brush', defaultSizeMultiplier: 1 },
  { id: 'calligraphy1', label: 'Calligraphy brush 1', defaultSizeMultiplier: 1.5 },
  { id: 'calligraphy2', label: 'Calligraphy brush 2', defaultSizeMultiplier: 1.5 },
  { id: 'airbrush', label: 'Airbrush', defaultSizeMultiplier: 2.5 },
  { id: 'oil', label: 'Oil brush', defaultSizeMultiplier: 1.8 },
  { id: 'crayon', label: 'Crayon', defaultSizeMultiplier: 1.6 },
  { id: 'marker', label: 'Marker', defaultSizeMultiplier: 2 },
  { id: 'natural-pencil', label: 'Natural pencil', defaultSizeMultiplier: 1 },
  { id: 'watercolor', label: 'Watercolor brush', defaultSizeMultiplier: 2.2 },
];

export const SHAPE_OPTIONS: ShapeMeta[] = [
  { id: 'line', label: 'Line' },
  { id: 'curve', label: 'Curve' },
  { id: 'oval', label: 'Oval' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'rounded-rectangle', label: 'Rounded rectangle' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'right-triangle', label: 'Right triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'right-arrow', label: 'Right arrow' },
  { id: 'left-arrow', label: 'Left arrow' },
  { id: 'up-arrow', label: 'Up arrow' },
  { id: 'down-arrow', label: 'Down arrow' },
  { id: 'four-point-star', label: 'Four-point star' },
  { id: 'five-point-star', label: 'Five-point star' },
  { id: 'six-point-star', label: 'Six-point star' },
  { id: 'rounded-rect-callout', label: 'Rounded rectangular callout' },
  { id: 'oval-callout', label: 'Oval callout' },
  { id: 'cloud-callout', label: 'Cloud callout' },
  { id: 'heart', label: 'Heart' },
  { id: 'lightning', label: 'Lightning' },
];

export const SHAPE_STYLE_OPTIONS: Array<{ id: ShapeStyleMode; label: string }> = [
  { id: 'none', label: 'No outline' },
  { id: 'solid', label: 'Solid color' },
  { id: 'crayon', label: 'Crayon' },
  { id: 'marker', label: 'Marker' },
  { id: 'oil', label: 'Oil' },
  { id: 'natural-pencil', label: 'Natural pencil' },
  { id: 'watercolor', label: 'Watercolor' },
];

export const SIZE_PRESETS = [1, 3, 5, 8] as const;

export const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200, 300, 400, 600, 800] as const;

export interface ActiveSelection {
  rect: Rect;
  imageData: ImageData;
  /** Optional mask for free-form lasso selection */
  maskCanvas?: HTMLCanvasElement;
}

export interface PendingShape {
  shape: ShapeType;
  start: Point;
  end: Point;
  ctrl1?: Point;
  ctrl2?: Point;
  /** Curve creation stage: 'line' -> 'c1' -> 'c2' -> 'ready' */
  curveStage?: 'line' | 'c1' | 'c2' | 'ready';
  /** Polygon vertices in canvas space */
  vertices?: Point[];
  outlineColor: string;
  fillColor: string;
  outlineStyle: ShapeStyleMode;
  fillStyle: ShapeStyleMode;
  lineWidth: number;
}

export interface ActiveTextBox {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  opaque: boolean;
}

export interface HistorySnapshot {
  width: number;
  height: number;
  imageData: ImageData;
}
