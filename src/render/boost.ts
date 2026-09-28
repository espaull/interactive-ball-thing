import type { Point } from "../geometry/point";
import { BOOST_CHEVRON_COLOR, BOOST_COLOR } from "../palette";
import { BOOST_HALF_WIDTH_PX } from "../world/boosts";

// Distance between chevrons along the strip, and how fast they scroll (px/s).
const CHEVRON_SPACING = 32;
const CHEVRON_SPEED = 60;

// A boost strip: a translucent band, with chevrons scrolling along it in the
// direction it pushes. `opacity` is lower for the preview while painting.
export function drawBoostStrip(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  time: number,
  opacity = 1,
): void {
  if (points.length < 2) return;

  ctx.globalAlpha = 0.35 * opacity;
  ctx.strokeStyle = BOOST_COLOR;
  ctx.lineWidth = BOOST_HALF_WIDTH_PX * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();

  // Walk along the strip, placing a chevron every CHEVRON_SPACING pixels,
  // shifted a little further each frame so they appear to move.
  ctx.globalAlpha = 0.9 * opacity;
  ctx.strokeStyle = BOOST_CHEVRON_COLOR;
  ctx.lineWidth = 4;
  let next = (time * CHEVRON_SPEED) % CHEVRON_SPACING;
  let walked = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const dx = (b.x - a.x) / length;
    const dy = (b.y - a.y) / length;
    while (next <= walked + length) {
      const t = next - walked;
      drawChevron(ctx, a.x + dx * t, a.y + dy * t, dx, dy);
      next += CHEVRON_SPACING;
    }
    walked += length;
  }
  ctx.globalAlpha = 1;
}

// A ">" pointing along (dx, dy).
function drawChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
): void {
  const size = 8;
  // Perpendicular to the direction.
  const px = -dy;
  const py = dx;
  ctx.beginPath();
  ctx.moveTo(x - dx * size + px * size, y - dy * size + py * size);
  ctx.lineTo(x, y);
  ctx.lineTo(x - dx * size - px * size, y - dy * size - py * size);
  ctx.stroke();
}
