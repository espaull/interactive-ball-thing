import { distanceToSegment, type Point } from "./point";

// Ramer–Douglas–Peucker: drop points that deviate less than `tolerance`
// from the straight line between their neighbours.
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points.slice();

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegment(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}
