import { catmullRom } from "./curve";
import { simplify, type Point } from "./simplify";

// How many neighbours on each side each point is averaged with. Freehand
// points are at least 4px apart, so 3 smooths over roughly 25px.
const SMOOTHING = 3;
const SIMPLIFY_TOLERANCE_PX = 1.5;
// Distance between the points the smoothed line is turned into.
export const LINE_SPACING_PX = 6;
// When continuing a line, this much of its old end is re-smoothed together
// with the new part, so the join has no corner.
const JOIN_BLEND_PX = 40;

// Average each point with its neighbours. Near the ends the window shrinks,
// so the first and last points stay exactly where they were.
function movingAverage(points: Point[], window: number): Point[] {
  return points.map((_, i) => {
    const k = Math.min(window, i, points.length - 1 - i);
    let x = 0;
    let y = 0;
    for (let j = i - k; j <= i + k; j++) {
      x += points[j].x;
      y += points[j].y;
    }
    return { x: x / (2 * k + 1), y: y / (2 * k + 1) };
  });
}

// Turn a wobbly freehand stroke into a smooth line with the same ends.
export function smoothStroke(raw: Point[]): Point[] {
  if (raw.length < 3) return raw.slice();
  const averaged = movingAverage(raw, SMOOTHING);
  const key = simplify(averaged, SIMPLIFY_TOLERANCE_PX);
  return catmullRom(key, LINE_SPACING_PX);
}

// Split a line's points into the part to keep and its last ~JOIN_BLEND_PX,
// which gets re-smoothed when the line is continued from that end. The two
// parts share no points; `tail` ends with the line's end point.
export function splitTail(points: Point[]): { head: Point[]; tail: Point[] } {
  let length = 0;
  let i = points.length - 1;
  while (i > 0 && length < JOIN_BLEND_PX) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    i--;
  }
  return { head: points.slice(0, i), tail: points.slice(i) };
}
