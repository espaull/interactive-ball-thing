import { catmullRom } from "./spline";
import { distance, type Point } from "./point";
import { simplify } from "./simplify";

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
    length += distance(points[i], points[i - 1]);
    i--;
  }
  return { head: points.slice(0, i), tail: points.slice(i) };
}

// Turns the new points into a line's final shape. When joining onto existing
// lines, `lead` is the start line's last stretch (ending where `points`
// begins) and `trail` is the finish line's first stretch (starting where
// `points` finishes); both get re-shaped along with the new points.
export type ShapeBuilder = (
  points: Point[],
  lead: Point[],
  trail: Point[],
) => Point[];

// Freehand: smooth the raw points together with the blended stretches.
export const freehandShape: ShapeBuilder = (points, lead, trail) =>
  // The lead ends where the points start, and the trail starts where they
  // finish, so drop the shared points.
  smoothStroke([
    ...lead,
    ...points.slice(lead.length > 0 ? 1 : 0),
    ...trail.slice(1),
  ]);

// Curve: a spline through the clicked points, anchored on the far ends of the
// blended stretches (not every point of them), so turns into and out of the
// curve are spread out.
export const curveShape: ShapeBuilder = (points, lead, trail) =>
  catmullRom(
    [
      ...(lead.length > 1 ? [lead[0]] : []),
      ...points,
      ...(trail.length > 1 ? [trail.at(-1)!] : []),
    ],
    LINE_SPACING_PX,
  );

// The shape of a new line that may join onto existing lines at either end,
// so it can bridge the gap between two lines. `startLine` must end where
// `points` begins, and `finishLine` must end where `points` finishes (pass
// null for no join). The last ~JOIN_BLEND_PX of each is re-shaped together
// with the new points, so the joins are smooth.
export function joinShape(
  points: Point[],
  startLine: Point[] | null,
  finishLine: Point[] | null,
  build: ShapeBuilder,
): Point[] {
  const start = startLine ? splitTail(startLine) : { head: [], tail: [] };
  const finish = finishLine ? splitTail(finishLine) : { head: [], tail: [] };
  // The finish line is walked back from its joined end.
  const trail = [...finish.tail].reverse();
  const rest = [...finish.head].reverse();
  return [...start.head, ...build(points, start.tail, trail), ...rest];
}
