import type { Point } from "../geometry/point";
import {
  grab,
  TAP_SLACK_PX,
  type Grabbed,
  type Mutable,
  type Part,
} from "./part";
import { isNumber, isPoint, list, roundPoint } from "./saved";
import { PX_PER_M } from "./units";

// Launch speed at the lowest and highest power (m/s).
export const CANNON_MIN_SPEED = 4;
export const CANNON_MAX_SPEED = 24;
// Seconds between shots.
export const CANNON_INTERVAL = 2;
// How far from the cannon's centre a ball comes out (pixels).
export const MUZZLE_DISTANCE_PX = 30;
// How far a cannon reaches from its centre, for the eraser and for tapping.
export const CANNON_RADIUS_PX = 28;
// The world's gravity, in pixels/s², for predicting a shot's path.
const GRAVITY_PX = 10 * PX_PER_M;

// A cannon that fires a ball every CANNON_INTERVAL seconds.
export interface Cannon {
  readonly x: number;
  readonly y: number;
  // Which way it fires, in radians (0 = right; y points down, so negative
  // angles point upwards).
  readonly angle: number;
  // 0 (gentlest) to 1 (strongest).
  readonly power: number;
  // Paused cannons don't fire.
  readonly active: boolean;
  // Being aimed or moved right now; it holds its fire until let go.
  readonly held: boolean;
  // Playground time of its next shot.
  readonly nextShotAt: number;
  // Part of a level: it can't be rubbed out, moved or re-aimed.
  readonly fixed: boolean;
}

// Each cannon, as it's saved.
export type SavedCannons = {
  x: number;
  y: number;
  angle: number;
  power: number;
  active: boolean;
}[];

export function parseCannons(data: unknown): SavedCannons {
  const cannons: SavedCannons = [];
  for (const c of list(data)) {
    if (!isPoint(c) || !isNumber(c.angle) || !isNumber(c.power)) continue;
    cannons.push({
      x: c.x,
      y: c.y,
      angle: c.angle,
      power: Math.max(0, Math.min(1, c.power)),
      active: c.active !== false,
    });
  }
  return cannons;
}

// The cannons.
export class Cannons implements Part<SavedCannons> {
  private list: Mutable<Cannon>[] = [];

  constructor(
    // The playground's time, for scheduling shots.
    private now: () => number,
    private changed: () => void,
  ) {}

  get all(): readonly Cannon[] {
    return this.list;
  }

  get isEmpty(): boolean {
    return this.list.length === 0;
  }

  // A cannon at (x, y) firing along `angle` with `power` (0 to 1). Its first
  // shot comes shortly after it's placed.
  add(
    x: number,
    y: number,
    angle: number,
    power: number,
    active = true,
    fixed = false,
  ): Cannon {
    const cannon = {
      x,
      y,
      angle,
      power,
      active,
      held: false,
      nextShotAt: this.now() + 0.5,
      fixed,
    };
    this.list.push(cannon);
    this.changed();
    return cannon;
  }

  // The player's cannon at a point (with a little slack for fingers), if
  // any. The most recently placed one wins, as it's drawn on top.
  at(x: number, y: number): Cannon | null {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      if (
        !c.fixed &&
        Math.hypot(c.x - x, c.y - y) < CANNON_RADIUS_PX + TAP_SLACK_PX
      ) {
        return c;
      }
    }
    return null;
  }

  aim(cannon: Cannon, angle: number, power: number): void {
    const own = cannon as Mutable<Cannon>;
    own.angle = angle;
    own.power = power;
    this.changed();
  }

  // Pause or restart it.
  setActive(cannon: Cannon, active: boolean): void {
    (cannon as Mutable<Cannon>).active = active;
    this.changed();
  }

  // Hold its fire while it's being aimed or moved.
  hold(cannon: Cannon): void {
    (cannon as Mutable<Cannon>).held = true;
  }

  // Let it go, firing next in `fireIn` seconds (or when it was going to).
  release(cannon: Cannon, fireIn?: number): void {
    const own = cannon as Mutable<Cannon>;
    own.held = false;
    if (fireIn !== undefined) own.nextShotAt = this.now() + fireIn;
  }

  // The cannons whose next shot is due, each then scheduled for the one
  // after.
  due(): Cannon[] {
    const now = this.now();
    const due = this.list.filter(
      (c) => c.active && !c.held && now >= c.nextShotAt,
    );
    for (const cannon of due) cannon.nextShotAt = now + CANNON_INTERVAL;
    return due;
  }

  grabAt(x: number, y: number): Grabbed | null {
    const cannon = this.at(x, y) as Mutable<Cannon> | null;
    if (!cannon) return null;
    this.hold(cannon);
    return grab(
      cannon,
      (x, y) => {
        cannon.x = x;
        cannon.y = y;
        this.changed();
      },
      () => this.release(cannon),
    );
  }

  eraseAt(x: number, y: number, radius: number): void {
    for (const cannon of [...this.list]) {
      if (cannon.fixed) continue;
      if (Math.hypot(cannon.x - x, cannon.y - y) < radius + CANNON_RADIUS_PX) {
        this.list.splice(this.list.indexOf(cannon), 1);
        this.changed();
      }
    }
  }

  extent(add: (p: Point, reach: number) => void): void {
    // Room for the barrel pointing any way.
    for (const cannon of this.list) add(cannon, CANNON_RADIUS_PX + 20);
  }

  save(fixed = false): SavedCannons {
    return this.list
      .filter((cannon) => cannon.fixed === fixed)
      .map(({ x, y, angle, power, active }) => ({
        ...roundPoint({ x, y }),
        angle,
        power,
        active,
      }));
  }

  load(saved: SavedCannons, fixed = false): void {
    this.removeAll(fixed);
    for (const { x, y, angle, power, active } of saved) {
      this.add(x, y, angle, power, active, fixed);
    }
  }

  clear(): void {
    this.removeAll(false);
  }

  private removeAll(fixed: boolean): void {
    this.list = this.list.filter((cannon) => cannon.fixed !== fixed);
    this.changed();
  }
}

export function launchSpeed(power: number): number {
  return CANNON_MIN_SPEED + power * (CANNON_MAX_SPEED - CANNON_MIN_SPEED);
}

// Where a cannon's balls come out.
export function muzzle(cannon: Cannon): Point {
  return {
    x: cannon.x + Math.cos(cannon.angle) * MUZZLE_DISTANCE_PX,
    y: cannon.y + Math.sin(cannon.angle) * MUZZLE_DISTANCE_PX,
  };
}

// A shot's launch velocity, in pixels/s.
export function launchVelocity(cannon: Cannon): Point {
  const speed = launchSpeed(cannon.power) * PX_PER_M;
  return {
    x: Math.cos(cannon.angle) * speed,
    y: Math.sin(cannon.angle) * speed,
  };
}

// Where a shot will fly for the next `seconds`, ignoring anything it might
// hit: points every `step` seconds along the arc.
export function predictPath(
  cannon: Cannon,
  seconds = 1.2,
  step = 0.04,
): Point[] {
  const start = muzzle(cannon);
  const v = launchVelocity(cannon);
  const path: Point[] = [];
  for (let t = 0; t <= seconds; t += step) {
    path.push({
      x: start.x + v.x * t,
      y: start.y + v.y * t + 0.5 * GRAVITY_PX * t * t,
    });
  }
  return path;
}
