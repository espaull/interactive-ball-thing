import type { Body } from "planck";
import { erasePolyline } from "../geometry/erase";
import {
  boundsOf,
  distanceToSegment,
  isNearBox,
  type Box,
  type Point,
} from "../geometry/point";
import type { Part } from "./part";
import { parsePolylines, roundPoint } from "./saved";
import { toPixels } from "./units";

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
  readonly bounds: Box;

  constructor(
    readonly points: Point[],
    // Part of a level: it can't be rubbed out.
    readonly fixed = false,
  ) {
    this.bounds = boundsOf(points);
  }

  // Which way the strip points at `p` (a unit vector), or null if `p` isn't
  // on it. Uses the nearest part of the strip, so it follows the curves.
  directionAt(p: Point): Point | null {
    const r = BOOST_HALF_WIDTH_PX;
    // Quick reject: nowhere near the strip at all.
    if (!isNearBox(this.bounds, p, r)) return null;
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

// Each strip's points, in the direction it pushes.
export type SavedBoosts = Point[][];

export const parseBoosts: (data: unknown) => SavedBoosts = parsePolylines;

// The painted boost strips.
export class Boosts implements Part<SavedBoosts> {
  private list: BoostZone[] = [];

  constructor(private changed: () => void) {}

  get all(): readonly BoostZone[] {
    return this.list;
  }

  get isEmpty(): boolean {
    return this.list.length === 0;
  }

  // A strip along `points`, pushing balls in the direction they run.
  add(points: Point[], fixed = false): void {
    if (points.length < 2) return;
    this.list.push(new BoostZone(points, fixed));
    this.changed();
  }

  // Push each body (a ball) that's on a strip along it, until it reaches top
  // speed. Only one strip pushes a ball at a time, so overlapping strips
  // don't add up.
  push(bodies: Body[]): void {
    if (this.list.length === 0) return;
    for (const body of bodies) {
      const position = toPixels(body.getPosition());
      for (const boost of this.list) {
        const dir = boost.directionAt(position);
        if (!dir) continue;
        const v = body.getLinearVelocity();
        if (v.x * dir.x + v.y * dir.y < BOOST_MAX_SPEED) {
          const push = body.getMass() * BOOST_ACCELERATION;
          body.applyForceToCenter({ x: dir.x * push, y: dir.y * push }, true);
        }
        break;
      }
    }
  }

  // Rub out the parts of strips inside a circle, splitting them where the
  // eraser cuts through. The pieces keep the order of the points, so they
  // still point the same way.
  eraseAt(x: number, y: number, radius: number): void {
    for (const boost of [...this.list]) {
      if (boost.fixed || !isNearBox(boost.bounds, { x, y }, radius)) continue;
      const pieces = erasePolyline(boost.points, { x, y }, radius);
      if (!pieces) continue;
      this.list.splice(this.list.indexOf(boost), 1);
      this.changed();
      for (const piece of pieces) this.add(piece);
    }
  }

  extent(add: (p: Point, reach: number) => void): void {
    for (const boost of this.list) {
      for (const p of boost.points) add(p, BOOST_HALF_WIDTH_PX);
    }
  }

  save(fixed = false): SavedBoosts {
    return this.list
      .filter((boost) => boost.fixed === fixed)
      .map((boost) => boost.points.map(roundPoint));
  }

  load(saved: SavedBoosts, fixed = false): void {
    this.removeAll(fixed);
    for (const points of saved) this.add(points, fixed);
  }

  clear(): void {
    this.removeAll(false);
  }

  private removeAll(fixed: boolean): void {
    this.list = this.list.filter((boost) => boost.fixed !== fixed);
    this.changed();
  }
}
