import type { Point } from "./simplify";

// Minimum gap between output points; Box2D rejects chain vertices that are
// nearly on top of each other.
const MIN_GAP_PX = 2;

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a: Point, b: Point, t0: number, t1: number, t: number): Point {
  const span = t1 - t0;
  const u = span === 0 ? 0 : (t - t0) / span;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

// Centripetal Catmull–Rom spline through every point in `points`, sampled
// roughly every `spacing` pixels. Centripetal (alpha = 0.5) avoids the loops
// and overshoots the plain version makes when points are unevenly spaced.
export function catmullRom(points: Point[], spacing: number): Point[] {
  if (points.length < 2) return points.slice();

  // Mirror the end points so the curve starts and ends exactly on them.
  const first = points[0];
  const last = points[points.length - 1];
  const ctrl = [
    { x: 2 * first.x - points[1].x, y: 2 * first.y - points[1].y },
    ...points,
    { x: 2 * last.x - points[points.length - 2].x, y: 2 * last.y - points[points.length - 2].y },
  ];

  const out: Point[] = [first];
  for (let i = 0; i < ctrl.length - 3; i++) {
    const [p0, p1, p2, p3] = [ctrl[i], ctrl[i + 1], ctrl[i + 2], ctrl[i + 3]];
    const t0 = 0;
    const t1 = t0 + Math.max(Math.sqrt(dist(p0, p1)), 1e-4);
    const t2 = t1 + Math.max(Math.sqrt(dist(p1, p2)), 1e-4);
    const t3 = t2 + Math.max(Math.sqrt(dist(p2, p3)), 1e-4);

    const steps = Math.max(1, Math.ceil(dist(p1, p2) / spacing));
    for (let s = 1; s <= steps; s++) {
      const t = t1 + ((t2 - t1) * s) / steps;
      // Barry–Goldman pyramid evaluation.
      const a1 = lerp(p0, p1, t0, t1, t);
      const a2 = lerp(p1, p2, t1, t2, t);
      const a3 = lerp(p2, p3, t2, t3, t);
      const b1 = lerp(a1, a2, t0, t2, t);
      const b2 = lerp(a2, a3, t1, t3, t);
      const c = lerp(b1, b2, t1, t2, t);
      if (dist(c, out[out.length - 1]) >= MIN_GAP_PX) out.push(c);
    }
  }
  return out;
}
