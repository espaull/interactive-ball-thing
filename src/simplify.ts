export interface Point {
  x: number;
  y: number;
}

// Squared distance from p to the segment a-b.
function segmentDistanceSq(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const ex = p.x - (a.x + t * dx);
  const ey = p.y - (a.y + t * dy);
  return ex * ex + ey * ey;
}

// Ramer–Douglas–Peucker: drop points that deviate less than `tolerance`
// from the straight line between their neighbours.
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points.slice();

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const tolSq = tolerance * tolerance;
  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = segmentDistanceSq(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolSq) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}
