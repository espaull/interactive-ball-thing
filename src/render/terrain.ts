// Drawing the terrain a level's made of.
import { boundsOf, distance, lerp, type Point } from "../geometry/point";
import {
  ROCK_BOTTOM,
  ROCK_EDGE,
  ROCK_TOP,
  SPIKE_COLOR,
  SPIKE_EDGE,
} from "../palette";
import { SPIKE_REACH_PX } from "../world/spikes";

// Spikes are this far apart along their strip (pixels), and poke out a
// little past where they pop things, so touching them looks fair.
const SPIKE_SPACING_PX = 10;
const SPIKE_HEIGHT_PX = SPIKE_REACH_PX + 3;

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

// Call `at` every `spacing` pixels along a line (starting half a spacing
// in), with the way the line runs there (a unit vector).
function along(
  points: Point[],
  spacing: number,
  at: (p: Point, direction: Point) => void,
): void {
  let next = spacing / 2;
  let travelled = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = distance(a, b);
    if (length === 0) continue;
    const direction = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    while (next <= travelled + length) {
      at(lerp(a, b, (next - travelled) / length), direction);
      next += spacing;
    }
    travelled += length;
  }
}

// A strip of spikes, pointing out both sides. `alpha` fades it (for one
// still being painted).
export function drawSpikes(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  const half = SPIKE_SPACING_PX / 2;
  along(points, SPIKE_SPACING_PX, (p, d) => {
    for (const side of [1, -1]) {
      ctx.moveTo(p.x - d.x * half, p.y - d.y * half);
      ctx.lineTo(
        p.x - d.y * side * SPIKE_HEIGHT_PX,
        p.y + d.x * side * SPIKE_HEIGHT_PX,
      );
      ctx.lineTo(p.x + d.x * half, p.y + d.y * half);
    }
  });
  ctx.fillStyle = SPIKE_COLOR;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = SPIKE_EDGE;
  ctx.stroke();

  // The strip they stick out of.
  tracePath(ctx, points, false);
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}
