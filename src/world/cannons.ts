import type { Point } from "../geometry/point";
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
  x: number;
  y: number;
  // Which way it fires, in radians (0 = right; y points down, so negative
  // angles point upwards).
  angle: number;
  // 0 (gentlest) to 1 (strongest).
  power: number;
  // Paused cannons don't fire.
  active: boolean;
  // Being aimed right now; it holds its fire until let go.
  aiming: boolean;
  // Playground time of its next shot.
  nextShotAt: number;
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
