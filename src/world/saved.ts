// Helpers for saving parts of the design and reading them back. Saved data
// comes from storage, so it's checked piece by piece: anything malformed is
// skipped rather than losing the whole save.
import type { Point } from "../geometry/point";

// Tenths of a pixel are plenty, and keep saves small.
export function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function roundPoint({ x, y }: Point): Point {
  return { x: round(x), y: round(y) };
}

export function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

export function isNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function isPoint(
  data: unknown,
): data is Point & Record<string, unknown> {
  return isRecord(data) && isNumber(data.x) && isNumber(data.y);
}

// `data` if it's a list, or an empty one.
export function list(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

// Saved polylines (lines and boost strips): each needs at least two good
// points.
export function parsePolylines(data: unknown): Point[][] {
  const polylines: Point[][] = [];
  for (const item of list(data)) {
    const points = list(item).filter(isPoint).map(roundPoint);
    if (points.length >= 2) polylines.push(points);
  }
  return polylines;
}
