import type { Body } from "planck";
import { distance, type Point } from "../geometry/point";
import { toMetres, toPixels } from "./units";

// Radius of a portal, in pixels. Something goes in when its centre gets
// within ENTRY_FRACTION of this, so it visibly drops into the portal.
export const PORTAL_RADIUS_PX = 26;
const ENTRY_FRACTION = 0.8;
// Things come out no faster than this (m/s). Without it, a portal below its
// partner makes an endless fall that speeds up every time round.
const MAX_EXIT_SPEED = 25;

// Two linked portals: whatever goes into one comes out of the other.
export interface PortalPair {
  a: Point;
  b: Point;
  color: string;
}

// A trip through a portal, for the effects.
export interface Teleport {
  from: Point;
  to: Point;
  color: string;
}

// Every pair of portals, and moving things through them.
export class Portals {
  readonly pairs: PortalPair[] = [];
  // The portal each body last came out of. It can't go back in until it has
  // left that portal, or it would bounce straight back.
  private arrivedAt = new WeakMap<Body, Point>();

  add(pair: PortalPair): void {
    this.pairs.push(pair);
  }

  // Remove every pair with either end within `radius` of a point (a portal
  // on its own would lead nowhere).
  removeNear(x: number, y: number, radius: number): void {
    const near = (p: Point) =>
      distance(p, { x, y }) < radius + PORTAL_RADIUS_PX;
    for (const pair of [...this.pairs]) {
      if (near(pair.a) || near(pair.b)) {
        this.pairs.splice(this.pairs.indexOf(pair), 1);
      }
    }
  }

  clear(): void {
    this.pairs.length = 0;
  }

  // Move anything that has gone into a portal out of its partner, keeping
  // its speed and direction. Call between physics steps.
  teleport(bodies: Body[]): Teleport[] {
    const teleports: Teleport[] = [];
    for (const body of bodies) {
      const position = toPixels(body.getPosition());

      const arrived = this.arrivedAt.get(body);
      if (arrived) {
        if (distance(position, arrived) < PORTAL_RADIUS_PX) continue;
        this.arrivedAt.delete(body);
      }

      for (const pair of this.pairs) {
        const exit = this.exitFor(pair, position);
        if (!exit) continue;
        body.setPosition(toMetres(exit));
        const v = body.getLinearVelocity();
        const speed = Math.hypot(v.x, v.y);
        if (speed > MAX_EXIT_SPEED) {
          body.setLinearVelocity({
            x: (v.x / speed) * MAX_EXIT_SPEED,
            y: (v.y / speed) * MAX_EXIT_SPEED,
          });
        }
        body.setAwake(true);
        this.arrivedAt.set(body, exit);
        teleports.push({ from: position, to: exit, color: pair.color });
        break;
      }
    }
    return teleports;
  }

  // Where something at `position` comes out, if it's in one of the pair.
  private exitFor(pair: PortalPair, position: Point): Point | null {
    const entry = PORTAL_RADIUS_PX * ENTRY_FRACTION;
    if (distance(position, pair.a) < entry) return pair.b;
    if (distance(position, pair.b) < entry) return pair.a;
    return null;
  }
}
