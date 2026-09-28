import { distanceToSegment, type Point } from "../geometry/point";

// Half the width of a boost strip, in pixels. A ball counts as on the strip
// when its centre is this close to the painted path. Wide enough that a
// strip painted along a track catches balls rolling on top of it.
export const BOOST_HALF_WIDTH_PX = 28;
// How hard a strip pushes, in m/s². 2.5× gravity, so it can drive a ball
// straight up a wall or round the top of a loop.
export const BOOST_ACCELERATION = 25;
// A strip stops pushing once a ball is going this fast along it (m/s).
export const BOOST_MAX_SPEED = 20;

// A painted strip that pushes balls along it, in the direction it was
// painted. Not a physics body: nothing collides with it.
export class BoostZone {
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  constructor(readonly points: Point[]) {
    for (const p of points) {
      this.minX = Math.min(this.minX, p.x);
      this.minY = Math.min(this.minY, p.y);
      this.maxX = Math.max(this.maxX, p.x);
      this.maxY = Math.max(this.maxY, p.y);
    }
  }

  // Which way the strip points at `p` (a unit vector), or null if `p` isn't
  // on it. Uses the nearest part of the strip, so it follows the curves.
  directionAt(p: Point): Point | null {
    const r = BOOST_HALF_WIDTH_PX;
    // Quick reject: nowhere near the strip at all.
    if (
      p.x < this.minX - r ||
      p.x > this.maxX + r ||
      p.y < this.minY - r ||
      p.y > this.maxY + r
    ) {
      return null;
    }
    let best = r;
    let direction: Point | null = null;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const d = distanceToSegment(p, a, b);
      if (d <= best) {
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length === 0) continue;
        best = d;
        direction = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
      }
    }
    return direction;
  }
}
