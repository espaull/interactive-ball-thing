// A position in pixels. World pixels unless a name says "screen".
export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Shortest distance from `p` to the segment a–b.
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq),
        );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

// Total length along a line through `points`.
export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += distance(points[i - 1], points[i]);
  return total;
}
