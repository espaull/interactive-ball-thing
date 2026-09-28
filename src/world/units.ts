import type { Vec2Value } from "planck";
import type { Point } from "../geometry/point";

// Planck works in metres; everything outside the world folder works in
// pixels (world pixels, before the camera's zoom). Convert at the boundary.
export const PX_PER_M = 40;

export function toPixels(v: Vec2Value): Point {
  return { x: v.x * PX_PER_M, y: v.y * PX_PER_M };
}

export function toMetres(p: Point): Vec2Value {
  return { x: p.x / PX_PER_M, y: p.y / PX_PER_M };
}
