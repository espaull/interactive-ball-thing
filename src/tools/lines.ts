// Shared by the tools that make lines (Draw and Curve).
import type { LineEnd, Playground } from "../world/playground";
import { distance, type Point } from "../geometry/point";
import { joinShape, type ShapeBuilder } from "../geometry/stroke";
import type { ToolContext } from "./tool";

// A line's points, reordered so the given end comes last.
function endingAt(end: LineEnd): Point[] {
  return end.atStart ? [...end.line.points].reverse() : end.line.points;
}

// Ends of every line a new line can join onto (not fixed ones), for their
// rings.
export function lineEnds(playground: Playground): Point[] {
  return playground.lines.all
    .filter((l) => !l.fixed)
    .flatMap((l) => [l.points[0], l.points.at(-1)!]);
}

// Finish a line. It joins onto `start` (the line end it began from, if any)
// and onto any other line end it finishes on, so it can bridge the gap
// between two lines. Never joins a line to itself, which would make a loop.
// Nothing can be drawn in a no-drawing area, so a line drawn across one
// only keeps its pieces outside it; the first piece still joins at the
// start, and the last at the finish.
export function commitLine(
  ctx: ToolContext,
  points: Point[],
  start: LineEnd | null,
  build: ShapeBuilder,
): void {
  if (points.length < 2) return;
  const shape = build(points, [], []);
  const pieces = ctx.playground.noDraw.outside(shape);
  if (pieces[0] === shape) {
    joinLine(ctx, points, start, true, build);
    return;
  }
  const same = (a: Point, b: Point) => distance(a, b) < 0.01;
  pieces.forEach((piece, i) => {
    const first = i === 0 && same(piece[0], shape[0]);
    const last = i === pieces.length - 1 && same(piece.at(-1)!, shape.at(-1)!);
    joinLine(ctx, piece, first ? start : null, last, build);
  });
}

// Add a line, joined onto `start` (if any) and, if `finish`, onto a line
// end it finishes on.
function joinLine(
  ctx: ToolContext,
  points: Point[],
  start: LineEnd | null,
  finish: boolean,
  build: ShapeBuilder,
): void {
  const { playground } = ctx;
  // The start line could have been cleared away in the meantime.
  const startEnd =
    start && playground.lines.all.includes(start.line) ? start : null;
  const finishEnd = finish
    ? ctx.findSnap(points.at(-1)!, startEnd?.line)
    : null;
  // Snap the last point onto the end being joined.
  if (finishEnd) points = [...points.slice(0, -1), finishEnd.point];

  const shape = joinShape(
    points,
    startEnd && endingAt(startEnd),
    finishEnd && endingAt(finishEnd),
    build,
  );
  if (startEnd) playground.lines.replace(startEnd.line, shape);
  else playground.lines.add(shape);
  if (finishEnd) playground.lines.remove(finishEnd.line);
}
