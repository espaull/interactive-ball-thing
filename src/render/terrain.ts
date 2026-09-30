// Drawing the terrain a level's made of.
import { boundsOf, type Point } from "../geometry/point";
import { ROCK_BOTTOM, ROCK_EDGE, ROCK_TOP } from "../palette";

function tracePath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  closed: boolean,
): void {
  ctx.beginPath();
  points.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  if (closed) ctx.closePath();
}

// A rock: stone shaded lighter on top, with a darker edge. `alpha` fades
// it (for one still being drawn).
export function drawRock(
  ctx: CanvasRenderingContext2D,
  outline: Point[],
  alpha = 1,
): void {
  const { top, bottom } = boundsOf(outline);
  const shade = ctx.createLinearGradient(0, top, 0, bottom);
  shade.addColorStop(0, ROCK_TOP);
  shade.addColorStop(1, ROCK_BOTTOM);
  ctx.save();
  ctx.globalAlpha = alpha;
  tracePath(ctx, outline, true);
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = ROCK_EDGE;
  ctx.stroke();
  ctx.restore();
}
