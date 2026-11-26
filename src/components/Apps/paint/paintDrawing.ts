import type { BrushType, Point, Rect, ShapeStyleMode, ShapeType } from './paintTypes';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hh < 60) {
    r1 = c;
    g1 = x;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
  } else if (hh < 180) {
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/**
 * Fast iterative scanline flood fill on an HTML5 Canvas 2D context.
 */
export function floodFillCanvas(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillHex: string,
  tolerance = 24,
): boolean {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;

  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const startIdx = (sy * width + sx) * 4;
  const tr = data[startIdx];
  const tg = data[startIdx + 1];
  const tb = data[startIdx + 2];
  const ta = data[startIdx + 3];

  const { r: fr, g: fg, b: fb } = hexToRgb(fillHex);
  const fa = 255;

  if (tr === fr && tg === fg && tb === fb && ta === fa) {
    return false;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];

  const matches = (pixelOffset: number) => {
    const dr = Math.abs(data[pixelOffset] - tr);
    const dg = Math.abs(data[pixelOffset + 1] - tg);
    const db = Math.abs(data[pixelOffset + 2] - tb);
    const da = Math.abs(data[pixelOffset + 3] - ta);
    return dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance;
  };

  const paintPixel = (pixelOffset: number) => {
    data[pixelOffset] = fr;
    data[pixelOffset + 1] = fg;
    data[pixelOffset + 2] = fb;
    data[pixelOffset + 3] = fa;
  };

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    let currX = x;
    let pixelIdx = y * width + currX;
    if (visited[pixelIdx]) continue;

    while (currX >= 0 && !visited[y * width + currX] && matches((y * width + currX) * 4)) {
      currX -= 1;
    }
    currX += 1;

    let spanAbove = false;
    let spanBelow = false;

    while (currX < width) {
      pixelIdx = y * width + currX;
      const offset = pixelIdx * 4;
      if (visited[pixelIdx] || !matches(offset)) break;

      visited[pixelIdx] = 1;
      paintPixel(offset);

      if (y > 0) {
        const aboveIdx = (y - 1) * width + currX;
        const aboveMatches = !visited[aboveIdx] && matches(aboveIdx * 4);
        if (!spanAbove && aboveMatches) {
          stack.push(currX, y - 1);
          spanAbove = true;
        } else if (spanAbove && !aboveMatches) {
          spanAbove = false;
        }
      }

      if (y < height - 1) {
        const belowIdx = (y + 1) * width + currX;
        const belowMatches = !visited[belowIdx] && matches(belowIdx * 4);
        if (!spanBelow && belowMatches) {
          stack.push(currX, y + 1);
          spanBelow = true;
        } else if (spanBelow && !belowMatches) {
          spanBelow = false;
        }
      }

      currX += 1;
    }
  }

  ctx.putImageData(img, 0, 0);
  return true;
}

/**
 * Draw crisp integer-aligned pencil line (Bresenham) for thin sizes or smooth stroke for larger sizes.
 */
export function drawPencilSegment(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  size: number,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (size <= 2) {
    let x0 = Math.round(from.x);
    let y0 = Math.round(from.y);
    const x1 = Math.round(to.x);
    const y1 = Math.round(to.y);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    const half = Math.floor(size / 2);

    while (true) {
      ctx.fillRect(x0 - half, y0 - half, size, size);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  } else {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEraserSegment(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color2: string,
  size: number,
) {
  const boxSize = Math.max(4, size * 2);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(dist));
  ctx.save();
  ctx.fillStyle = color2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(from.x + (to.x - from.x) * t - boxSize / 2);
    const y = Math.round(from.y + (to.y - from.y) * t - boxSize / 2);
    ctx.fillRect(x, y, boxSize, boxSize);
  }
  ctx.restore();
}

export function drawAirbrushBurst(
  ctx: CanvasRenderingContext2D,
  center: Point,
  color: string,
  size: number,
) {
  const radius = Math.max(6, size * 2.5);
  const density = Math.max(18, Math.round(radius * 2.2));
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const px = Math.round(center.x + Math.cos(angle) * r);
    const py = Math.round(center.y + Math.sin(angle) * r);
    ctx.fillRect(px, py, 1.5, 1.5);
  }
  ctx.restore();
}

export function drawBrushSegment(
  ctx: CanvasRenderingContext2D,
  brush: BrushType,
  from: Point,
  to: Point,
  color: string,
  size: number,
) {
  if (brush === 'airbrush') {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / 4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      drawAirbrushBurst(
        ctx,
        { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
        color,
        size,
      );
    }
    return;
  }

  ctx.save();
  const dist = Math.hypot(to.x - from.x, to.y - from.y);

  switch (brush) {
    case 'brush': {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size * 1.4);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      break;
    }
    case 'calligraphy1':
    case 'calligraphy2': {
      const angle = brush === 'calligraphy1' ? -Math.PI / 4 : Math.PI / 4;
      const nibLen = Math.max(4, size * 2.4);
      const dx = Math.cos(angle) * (nibLen / 2);
      const dy = Math.sin(angle) * (nibLen / 2);
      const steps = Math.max(1, Math.ceil(dist));
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, size * 0.45);
      ctx.lineCap = 'round';
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = from.x + (to.x - from.x) * t;
        const cy = from.y + (to.y - from.y) * t;
        ctx.beginPath();
        ctx.moveTo(cx - dx, cy - dy);
        ctx.lineTo(cx + dx, cy + dy);
        ctx.stroke();
      }
      break;
    }
    case 'oil': {
      const width = Math.max(4, size * 2.2);
      const bristles = Math.max(5, Math.round(width));
      const angle = Math.atan2(to.y - from.y, to.x - from.x) + Math.PI / 2;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      for (let b = 0; b < bristles; b++) {
        const offset = ((b / (bristles - 1 || 1)) - 0.5) * width;
        const ox = Math.cos(angle) * offset;
        const oy = Math.sin(angle) * offset;
        ctx.globalAlpha = 0.28 + (b % 3) * 0.16;
        ctx.lineWidth = Math.max(1, width / bristles + 0.6);
        ctx.beginPath();
        ctx.moveTo(from.x + ox, from.y + oy);
        ctx.lineTo(to.x + ox, to.y + oy);
        ctx.stroke();
      }
      break;
    }
    case 'crayon': {
      const radius = Math.max(2, size * 1.4);
      const steps = Math.max(1, Math.ceil(dist / 1.5));
      ctx.fillStyle = color;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = from.x + (to.x - from.x) * t;
        const cy = from.y + (to.y - from.y) * t;
        const grains = Math.max(8, Math.round(radius * 2.4));
        for (let g = 0; g < grains; g++) {
          const rx = (Math.random() - 0.5) * radius * 2;
          const ry = (Math.random() - 0.5) * radius * 2;
          if (rx * rx + ry * ry <= radius * radius) {
            ctx.globalAlpha = 0.4 + Math.random() * 0.55;
            ctx.fillRect(cx + rx, cy + ry, 1.5, 1.5);
          }
        }
      }
      break;
    }
    case 'marker': {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = Math.max(4, size * 2.4);
      ctx.lineCap = 'square';
      ctx.lineJoin = 'bevel';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      break;
    }
    case 'natural-pencil': {
      const radius = Math.max(1, size * 0.8);
      const steps = Math.max(1, Math.ceil(dist));
      ctx.fillStyle = color;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = from.x + (to.x - from.x) * t;
        const cy = from.y + (to.y - from.y) * t;
        const dots = Math.max(3, Math.round(radius * 2));
        for (let d = 0; d < dots; d++) {
          const rx = (Math.random() - 0.5) * radius * 2;
          const ry = (Math.random() - 0.5) * radius * 2;
          ctx.globalAlpha = 0.25 + Math.random() * 0.45;
          ctx.fillRect(cx + rx, cy + ry, 1.2, 1.2);
        }
      }
      break;
    }
    case 'watercolor': {
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = Math.max(6, size * 3);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      ctx.globalAlpha = 0.18;
      ctx.lineWidth = Math.max(3, size * 1.8);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

export function normalizeRect(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

function traceRegularPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number,
  startAngle = -Math.PI / 2,
) {
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i * Math.PI * 2) / sides;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function traceStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points: number,
  innerRatio: number,
) {
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const scale = i % 2 === 0 ? 1 : innerRatio;
    const px = cx + Math.cos(a) * rx * scale;
    const py = cy + Math.sin(a) * ry * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function traceShapePath(
  ctx: CanvasRenderingContext2D,
  shape: ShapeType,
  start: Point,
  end: Point,
  ctrl1?: Point,
  ctrl2?: Point,
  vertices?: Point[],
): boolean {
  const rect = normalizeRect(start, end);
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;

  ctx.beginPath();

  switch (shape) {
    case 'line':
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      return false;

    case 'curve':
      ctx.moveTo(start.x, start.y);
      if (ctrl1 && ctrl2) {
        ctx.bezierCurveTo(ctrl1.x, ctrl1.y, ctrl2.x, ctrl2.y, end.x, end.y);
      } else if (ctrl1) {
        ctx.quadraticCurveTo(ctrl1.x, ctrl1.y, end.x, end.y);
      } else {
        ctx.lineTo(end.x, end.y);
      }
      return false;

    case 'polygon':
      if (vertices && vertices.length >= 2) {
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
          ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();
      }
      return true;

    case 'rectangle':
      ctx.rect(x, y, w, h);
      return true;

    case 'rounded-rectangle': {
      const r = Math.min(w * 0.18, h * 0.18, 24);
      ctx.roundRect(x, y, w, h, r);
      return true;
    }

    case 'oval':
      ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
      return true;

    case 'triangle':
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      return true;

    case 'right-triangle':
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      return true;

    case 'diamond':
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, cy);
      ctx.closePath();
      return true;

    case 'pentagon':
      traceRegularPolygon(ctx, cx, cy, rx, ry, 5);
      return true;

    case 'hexagon':
      traceRegularPolygon(ctx, cx, cy, rx, ry, 6);
      return true;

    case 'right-arrow':
      ctx.moveTo(x, y + h * 0.25);
      ctx.lineTo(x + w * 0.55, y + h * 0.25);
      ctx.lineTo(x + w * 0.55, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(x + w * 0.55, y + h);
      ctx.lineTo(x + w * 0.55, y + h * 0.75);
      ctx.lineTo(x, y + h * 0.75);
      ctx.closePath();
      return true;

    case 'left-arrow':
      ctx.moveTo(x + w, y + h * 0.25);
      ctx.lineTo(x + w * 0.45, y + h * 0.25);
      ctx.lineTo(x + w * 0.45, y);
      ctx.lineTo(x, cy);
      ctx.lineTo(x + w * 0.45, y + h);
      ctx.lineTo(x + w * 0.45, y + h * 0.75);
      ctx.lineTo(x + w, y + h * 0.75);
      ctx.closePath();
      return true;

    case 'up-arrow':
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, y + h * 0.45);
      ctx.lineTo(x + w * 0.75, y + h * 0.45);
      ctx.lineTo(x + w * 0.75, y + h);
      ctx.lineTo(x + w * 0.25, y + h);
      ctx.lineTo(x + w * 0.25, y + h * 0.45);
      ctx.lineTo(x, y + h * 0.45);
      ctx.closePath();
      return true;

    case 'down-arrow':
      ctx.moveTo(x + w * 0.25, y);
      ctx.lineTo(x + w * 0.75, y);
      ctx.lineTo(x + w * 0.75, y + h * 0.55);
      ctx.lineTo(x + w, y + h * 0.55);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, y + h * 0.55);
      ctx.lineTo(x + w * 0.25, y + h * 0.55);
      ctx.closePath();
      return true;

    case 'four-point-star':
      traceStar(ctx, cx, cy, rx, ry, 4, 0.34);
      return true;

    case 'five-point-star':
      traceStar(ctx, cx, cy, rx, ry, 5, 0.38);
      return true;

    case 'six-point-star':
      traceStar(ctx, cx, cy, rx, ry, 6, 0.5);
      return true;

    case 'rounded-rect-callout': {
      const boxH = h * 0.76;
      const r = Math.min(w * 0.14, boxH * 0.18, 16);
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + boxH - r);
      ctx.quadraticCurveTo(x + w, y + boxH, x + w - r, y + boxH);
      ctx.lineTo(x + w * 0.45, y + boxH);
      ctx.lineTo(x + w * 0.22, y + h);
      ctx.lineTo(x + w * 0.28, y + boxH);
      ctx.lineTo(x + r, y + boxH);
      ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      return true;
    }

    case 'oval-callout': {
      const boxH = h * 0.76;
      const ocy = y + boxH / 2;
      const orx = Math.max(1, w / 2);
      const ory = Math.max(1, boxH / 2);
      ctx.ellipse(cx, ocy, orx, ory, 0, 0.68 * Math.PI, 2.52 * Math.PI);
      ctx.lineTo(x + w * 0.2, y + h);
      ctx.closePath();
      return true;
    }

    case 'cloud-callout': {
      const boxH = h * 0.74;
      ctx.moveTo(x + w * 0.25, y + boxH * 0.85);
      ctx.bezierCurveTo(x, y + boxH * 0.85, x, y + boxH * 0.42, x + w * 0.18, y + boxH * 0.35);
      ctx.bezierCurveTo(x + w * 0.15, y + boxH * 0.05, x + w * 0.45, y, x + w * 0.55, y + boxH * 0.14);
      ctx.bezierCurveTo(x + w * 0.72, y, x + w * 0.96, y + boxH * 0.15, x + w * 0.88, y + boxH * 0.42);
      ctx.bezierCurveTo(x + w * 1.02, y + boxH * 0.65, x + w * 0.9, y + boxH * 0.88, x + w * 0.72, y + boxH * 0.85);
      ctx.bezierCurveTo(x + w * 0.58, y + boxH * 0.98, x + w * 0.38, y + boxH * 0.98, x + w * 0.25, y + boxH * 0.85);
      ctx.closePath();
      // Thought bubbles below
      ctx.moveTo(x + w * 0.33, y + h * 0.84);
      ctx.arc(x + w * 0.28, y + h * 0.84, Math.max(2, Math.min(w, h) * 0.05), 0, Math.PI * 2);
      ctx.moveTo(x + w * 0.21, y + h * 0.95);
      ctx.arc(x + w * 0.18, y + h * 0.95, Math.max(1.5, Math.min(w, h) * 0.03), 0, Math.PI * 2);
      return true;
    }

    case 'heart': {
      const topCurveHeight = h * 0.3;
      ctx.moveTo(cx, y + h * 0.28);
      ctx.bezierCurveTo(cx, y, x, y, x, y + topCurveHeight);
      ctx.bezierCurveTo(x, y + h * 0.62, cx, y + h * 0.78, cx, y + h);
      ctx.bezierCurveTo(cx, y + h * 0.78, x + w, y + h * 0.62, x + w, y + topCurveHeight);
      ctx.bezierCurveTo(x + w, y, cx, y, cx, y + h * 0.28);
      ctx.closePath();
      return true;
    }

    case 'lightning': {
      ctx.moveTo(x + w * 0.42, y);
      ctx.lineTo(x + w * 0.85, y);
      ctx.lineTo(x + w * 0.54, y + h * 0.4);
      ctx.lineTo(x + w * 0.88, y + h * 0.4);
      ctx.lineTo(x + w * 0.24, y + h);
      ctx.lineTo(x + w * 0.45, y + h * 0.56);
      ctx.lineTo(x + w * 0.15, y + h * 0.56);
      ctx.closePath();
      return true;
    }
  }
}

function getStyleAlpha(style: ShapeStyleMode): number {
  switch (style) {
    case 'marker':
      return 0.5;
    case 'watercolor':
      return 0.32;
    case 'crayon':
      return 0.82;
    case 'oil':
      return 0.88;
    case 'natural-pencil':
      return 0.68;
    default:
      return 1;
  }
}

export interface DrawShapeOptions {
  shape: ShapeType;
  start: Point;
  end: Point;
  ctrl1?: Point;
  ctrl2?: Point;
  vertices?: Point[];
  outlineColor: string;
  fillColor: string;
  outlineStyle: ShapeStyleMode;
  fillStyle: ShapeStyleMode;
  lineWidth: number;
}

export function drawShapeOnContext(ctx: CanvasRenderingContext2D, opts: DrawShapeOptions) {
  ctx.save();
  const isClosed = traceShapePath(
    ctx,
    opts.shape,
    opts.start,
    opts.end,
    opts.ctrl1,
    opts.ctrl2,
    opts.vertices,
  );

  if (isClosed && opts.fillStyle !== 'none') {
    ctx.save();
    ctx.fillStyle = opts.fillColor;
    ctx.globalAlpha = getStyleAlpha(opts.fillStyle);
    ctx.fill();
    ctx.restore();
  }

  if (opts.outlineStyle !== 'none') {
    ctx.save();
    ctx.strokeStyle = opts.outlineColor;
    ctx.lineWidth = Math.max(1, opts.lineWidth);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = getStyleAlpha(opts.outlineStyle);
    if (opts.outlineStyle === 'crayon' || opts.outlineStyle === 'natural-pencil') {
      ctx.setLineDash([Math.max(2, opts.lineWidth * 1.4), Math.max(1, opts.lineWidth * 0.4)]);
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
