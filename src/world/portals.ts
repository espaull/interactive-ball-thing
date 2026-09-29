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

// Below this horizontal speed (m/s), something coming out of an aimed portal
// isn't clearly heading either way, so its spin is left alone.
const MIN_SPIN_FLIP_SPEED = 0.1;

// One end of a pair. `aim` is which way things come out of it, in radians
// (0 is right, and y grows downwards), or null to carry on the way they went
// into its partner.
export interface PortalEnd extends Point {
  aim: number | null;
}

// Two linked portals: whatever goes into one comes out of the other.
export interface PortalPair {
  a: PortalEnd;
  b: PortalEnd;
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

  // The portal end within `slack` pixels of a point's rim, if any. The most
  // recently placed wins, as it's drawn on top.
  endAt(x: number, y: number, slack: number): PortalEnd | null {
    for (let i = this.pairs.length - 1; i >= 0; i--) {
      for (const end of [this.pairs[i].b, this.pairs[i].a]) {
        if (distance(end, { x, y }) < PORTAL_RADIUS_PX + slack) return end;
      }
    }
    return null;
  }

  // Move anything that has gone into a portal out of its partner, keeping
  // its speed. It keeps its direction too, unless the partner is aimed.
  // Call between physics steps.
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
        const speedIn = Math.hypot(v.x, v.y);
        const speed = Math.min(speedIn, MAX_EXIT_SPEED);
        if (exit.aim !== null) {
          body.setLinearVelocity({
            x: Math.cos(exit.aim) * speed,
            y: Math.sin(exit.aim) * speed,
          });
          matchSpin(body);
        } else if (speed < speedIn) {
          body.setLinearVelocity({
            x: (v.x / speedIn) * speed,
            y: (v.y / speedIn) * speed,
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
  private exitFor(pair: PortalPair, position: Point): PortalEnd | null {
    const entry = PORTAL_RADIUS_PX * ENTRY_FRACTION;
    if (distance(position, pair.a) < entry) return pair.b;
    if (distance(position, pair.b) < entry) return pair.a;
    return null;
  }
}

// Turn a body's spin the way it would roll along a floor in the direction
// it's now heading, keeping how fast it spins. Something that rolled in going
// right and was sent out going left would otherwise land spinning backwards,
// and friction would scrub off most of its speed. A floor is the best guess
// at what it'll land on, as gravity pulls it down. (y grows downwards, so a
// positive angular velocity is clockwise on screen, the way a ball rolling
// right turns.)
function matchSpin(body: Body): void {
  const vx = body.getLinearVelocity().x;
  if (Math.abs(vx) < MIN_SPIN_FLIP_SPEED) return;
  body.setAngularVelocity(Math.sign(vx) * Math.abs(body.getAngularVelocity()));
}
