// Shared by the tools that make lines (Draw and Curve).
import type { LineEnd, Playground } from "../world/playground";
import type { Point } from "../simplify";
import { joinShape, type ShapeBuilder } from "../stroke";
import type { ToolContext } from "./tool";

// A line's points, reordered so the given end comes last.
function endingAt(end: LineEnd): Point[] {
  return end.atStart ? [...end.line.points].reverse() : end.line.points;
}

// Ends of every line, for the rings a new line can join onto.
export function lineEnds(playground: Playground): Point[] {
  return playground.lines.flatMap((l) => [l.points[0], l.points.at(-1)!]);
}

// Finish a line. It joins onto `start` (the line end it began from, if any)
// and onto any other line end it finishes on, so it can bridge the gap
// between two lines. Never joins a line to itself, which would make a loop.
export function commitLine(
  ctx: ToolContext,
  points: Point[],
  start: LineEnd | null,
  build: ShapeBuilder,
): void {
  if (points.length < 2) return;
  const { playground } = ctx;
  // The start line could have been cleared away in the meantime.
  const startEnd = start && playground.lines.includes(start.line) ? start : null;
  const finishEnd = ctx.findSnap(points.at(-1)!, startEnd?.line);
  // Snap the last point onto the end being joined.
  if (finishEnd) points = [...points.slice(0, -1), finishEnd.point];

  const shape = joinShape(
    points,
    startEnd && endingAt(startEnd),
    finishEnd && endingAt(finishEnd),
    build,
  );
  if (startEnd) playground.replaceLine(startEnd.line, shape);
  else playground.addLine(shape);
  if (finishEnd) playground.removeLine(finishEnd.line);
}
