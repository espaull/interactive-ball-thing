import { ChainShape, type Body, type World } from "planck";
import type { Point } from "../geometry/point";
import { toMetres } from "./units";

// The cup's outline, relative to where it was placed (pixels, y down): a U
// with slightly flared sides. Wide enough for a ball (32px) to drop in.
export const CUP_OUTLINE: Point[] = [
  { x: -32, y: -24 },
  { x: -27, y: 12 },
  { x: -20, y: 22 },
  { x: 0, y: 25 },
  { x: 20, y: 22 },
  { x: 27, y: 12 },
  { x: 32, y: -24 },
];
// How far the cup reaches from its centre, for the eraser.
export const CUP_RADIUS_PX = 36;

// A goal: balls that drop into it are caught (and removed), and counted.
export class Cup {
  // Balls caught so far.
  caught = 0;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly body: Body,
  ) {}

  // Is `p` (a ball's centre) down inside the cup? The ball is caught once
  // its centre drops below the rim, between the walls.
  catches(p: Point): boolean {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    return Math.abs(dx) < 24 && dy > -12 && dy < 25;
  }
}

export function createCup(world: World, x: number, y: number): Cup {
  const body = world.createBody({ type: "static" });
  body.createFixture({
    shape: new ChainShape(
      CUP_OUTLINE.map((p) => toMetres({ x: x + p.x, y: y + p.y })),
      false,
    ),
    friction: 0.6,
  });
  return new Cup(x, y, body);
}
