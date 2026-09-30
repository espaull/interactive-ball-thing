// Closed outlines: shapes drawn round with a finger (rocks and no-drawing
// areas). An outline's last point joins back to its first.
import { tidyPieces } from "./erase";
import {
  boundsOf,
  distance,
  distanceToSegment,
  lerp,
  type Point,
} from "./point";
import { simplify } from "./simplify";
import { smoothStroke } from "./stroke";

// Points closer together than this are merged (Box2D rejects chain
// vertices that are nearly on top of each other).
const MIN_GAP_PX = 0.5;
// Shapes smaller than this across (pixels) are too small to be drawn on
// purpose.
const MIN_SIZE_PX = 16;

// Is `p` inside the outline? (Even-odd, so a shape drawn round twice still
// has an inside.)
export function isInside(p: Point, outline: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i];
    const b = outline[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// Shortest distance from `p` to the outline's edge.
export function distanceToOutline(p: Point, outline: Point[]): number {
  let best = Infinity;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    best = Math.min(best, distanceToSegment(p, outline[j], outline[i]));
  }
  return best;
}

// An outline without points on top of each other (the last one included,
// as it joins back to the first), or null if fewer than three are left.
export function tidyOutline(points: Point[]): Point[] | null {
  const out: Point[] = [];
  for (const p of points) {
    const last = out.at(-1);
    if (!last || distance(p, last) >= MIN_GAP_PX) out.push(p);
  }
  while (out.length > 1 && distance(out[0], out.at(-1)!) < MIN_GAP_PX) {
    out.pop();
  }
  return out.length >= 3 ? out : null;
}

// A shape from a freehand stroke round it: smoothed, with the ends joined
// up. Higher `tolerance` (pixels) leaves fewer, straighter sides. Null if
// it's too small to be a shape.
export function outlineShape(raw: Point[], tolerance: number): Point[] | null {
  const outline = tidyOutline(simplify(smoothStroke(raw), tolerance));
  if (!outline) return null;
  const { left, top, right, bottom } = boundsOf(outline);
  if (right - left < MIN_SIZE_PX || bottom - top < MIN_SIZE_PX) return null;
  return outline;
}

// A roundish shape around `centre`: `bumps` gives how far out each corner
// is (as a fraction of `radius`), going round clockwise from the right.
export function roundShape(
  centre: Point,
  radius: number,
  bumps: number[],
): Point[] {
  return bumps.map((bump, i) => {
    const angle = (i / bumps.length) * Math.PI * 2;
    return lerp(
      centre,
      {
        x: centre.x + Math.cos(angle) * radius,
        y: centre.y + Math.sin(angle) * radius,
      },
      bump,
    );
  });
}

// Where segment p→q crosses segment a→b, as a fraction (0..1) along p→q,
// or null if it doesn't.
function crossing(p: Point, q: Point, a: Point, b: Point): number | null {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const denominator = dx * ey - dy * ex;
  if (denominator === 0) return null;
  const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / denominator;
  const u = ((a.x - p.x) * dy - (a.y - p.y) * dx) / denominator;
  return t > 0 && t < 1 && u >= 0 && u <= 1 ? t : null;
}

// The pieces of a line outside all the outlines, cut exactly at their
// edges. The line itself (the same list) if it doesn't go in any.
export function outsideOutlines(
  points: Point[],
  outlines: Point[][],
): Point[][] {
  const inAny = (p: Point) => outlines.some((o) => isInside(p, o));
  const pieces: Point[][] = [];
  let current: Point[] = [];
  let cut = false;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    // Split the segment where it crosses an edge, then keep each part
    // whose middle is outside (as erasing does).
    const cuts = [0, 1];
    for (const outline of outlines) {
      for (let k = 0, j = outline.length - 1; k < outline.length; j = k++) {
        const t = crossing(p, q, outline[j], outline[k]);
        if (t !== null) cuts.push(t);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let k = 0; k < cuts.length - 1; k++) {
      if (cuts[k + 1] === cuts[k]) continue;
      if (!inAny(lerp(p, q, (cuts[k] + cuts[k + 1]) / 2))) {
        if (current.length === 0) current.push(lerp(p, q, cuts[k]));
        current.push(lerp(p, q, cuts[k + 1]));
      } else {
        cut = true;
        if (current.length > 0) pieces.push(current);
        current = [];
      }
    }
  }
  if (!cut) return [points];
  if (current.length > 0) pieces.push(current);
  return tidyPieces(pieces);
}
