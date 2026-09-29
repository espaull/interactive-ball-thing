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

// A rectangle, in pixels.
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// The smallest box around some points (which mustn't be empty).
export function boundsOf(points: Point[]): Box {
  const box = {
    left: Infinity,
    top: Infinity,
    right: -Infinity,
    bottom: -Infinity,
  };
  for (const { x, y } of points) {
    box.left = Math.min(box.left, x);
    box.top = Math.min(box.top, y);
    box.right = Math.max(box.right, x);
    box.bottom = Math.max(box.bottom, y);
  }
  return box;
}

// Could something within `reach` of `p` touch the box?
export function isNearBox(box: Box, p: Point, reach: number): boolean {
  return (
    p.x > box.left - reach &&
    p.x < box.right + reach &&
    p.y > box.top - reach &&
    p.y < box.bottom + reach
  );
}
