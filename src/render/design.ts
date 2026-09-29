import type { Point } from "../geometry/point";
import { LINE_COLOR } from "../palette";
import type { Playground } from "../world/playground";
import { drawBoostStrip } from "./boost";
import { drawCannon } from "./cannon";
import { drawCup } from "./cup";
import { drawPortal } from "./portal";

// How thick the drawn lines are, in world pixels.
export const LINE_WIDTH_PX = 4;

export function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: Point[],
): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

// The playground's design (everything but the balls and bubbles), from the
// bottom up: boost strips under the lines so the track stays clear on top,
// then cups, portals and cannons. Used for the screen and for the gallery's
// pictures, which draw their lines thicker when zoomed right out.
export function drawDesign(
  ctx: CanvasRenderingContext2D,
  playground: Playground,
  time: number,
  lineWidth = LINE_WIDTH_PX,
): void {
  for (const boost of playground.boosts) {
    drawBoostStrip(ctx, boost.points, time);
  }

  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = LINE_COLOR;
  for (const line of playground.lines) drawPolyline(ctx, line.points);

  for (const cup of playground.cups) drawCup(ctx, cup);
  for (const { a, b, color } of playground.portalPairs) {
    drawPortal(ctx, a, color, time);
    drawPortal(ctx, b, color, time);
  }
  for (const cannon of playground.cannons) drawCannon(ctx, cannon);
}
