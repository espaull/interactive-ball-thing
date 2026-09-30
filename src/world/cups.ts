import { ChainShape, type Body, type World } from "planck";
import type { Point } from "../geometry/point";
import { grab, type Grabbed, type Mutable, type Part } from "./part";
import { isPoint, list, roundPoint } from "./saved";
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
// How far the cup reaches from its centre, for the eraser and for tapping.
export const CUP_RADIUS_PX = 36;

// A goal: balls that drop into it are caught (and removed), and counted.
export class Cup {
  // Balls caught so far.
  caught = 0;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly body: Body,
    // Part of a level (its goal): it can't be rubbed out or moved.
    readonly fixed = false,
  ) {}

  // Is `p` (a ball's centre) down inside the cup? The ball is caught once
  // its centre drops below the rim, between the walls.
  catches(p: Point): boolean {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    return Math.abs(dx) < 24 && dy > -12 && dy < 25;
  }
}

// Where each cup is.
export type SavedCups = Point[];

export function parseCups(data: unknown): SavedCups {
  return list(data).filter(isPoint).map(roundPoint);
}

// The goal cups.
export class Cups implements Part<SavedCups> {
  private list: Cup[] = [];

  constructor(
    private world: World,
    private changed: () => void,
  ) {}

  get all(): readonly Cup[] {
    return this.list;
  }

  get isEmpty(): boolean {
    return this.list.length === 0;
  }

  add(x: number, y: number, fixed = false): Cup {
    // The outline is relative to the body, so moving the body moves the cup.
    const body = this.world.createBody({
      type: "static",
      position: toMetres({ x, y }),
    });
    body.createFixture({
      shape: new ChainShape(CUP_OUTLINE.map(toMetres), false),
      friction: 0.6,
    });
    const cup = new Cup(x, y, body, fixed);
    this.list.push(cup);
    this.changed();
    return cup;
  }

  // The player's cup at a point, if any. The most recently placed one wins,
  // as it's drawn on top.
  at(x: number, y: number): Cup | null {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      if (!c.fixed && Math.hypot(c.x - x, c.y - y) < CUP_RADIUS_PX) return c;
    }
    return null;
  }

  // The cup that has caught a ball at `p`, if any.
  catching(p: Point): Cup | undefined {
    return this.list.find((cup) => cup.catches(p));
  }

  grabAt(x: number, y: number): Grabbed | null {
    const cup = this.at(x, y) as Mutable<Cup> | null;
    if (!cup) return null;
    return grab(cup, (x, y) => {
      cup.x = x;
      cup.y = y;
      cup.body.setPosition(toMetres({ x, y }));
      this.changed();
    });
  }

  eraseAt(x: number, y: number, radius: number): void {
    for (const cup of [...this.list]) {
      if (cup.fixed) continue;
      if (Math.hypot(cup.x - x, cup.y - y) < radius + CUP_RADIUS_PX) {
        this.world.destroyBody(cup.body);
        this.list.splice(this.list.indexOf(cup), 1);
        this.changed();
      }
    }
  }

  extent(add: (p: Point, reach: number) => void): void {
    for (const cup of this.list) add(cup, CUP_RADIUS_PX);
  }

  save(fixed = false): SavedCups {
    return this.list.filter((cup) => cup.fixed === fixed).map(roundPoint);
  }

  // Cups keep their count through a load (for Undo): matched in order if
  // there are as many as before (so one that was moved keeps it), or else
  // by where they are.
  load(saved: SavedCups, fixed = false): void {
    const old = this.list.filter((cup) => cup.fixed === fixed);
    const key = (p: Point) => JSON.stringify(roundPoint(p));
    const caught = new Map(old.map((cup) => [key(cup), cup.caught]));
    this.removeAll(fixed);
    const added = saved.map(({ x, y }) => this.add(x, y, fixed));
    const sameCups = added.length === old.length;
    added.forEach((cup, i) => {
      cup.caught = sameCups ? old[i].caught : (caught.get(key(cup)) ?? 0);
    });
  }

  clear(): void {
    this.removeAll(false);
  }

  private removeAll(fixed: boolean): void {
    for (const cup of this.list) {
      if (cup.fixed === fixed) this.world.destroyBody(cup.body);
    }
    this.list = this.list.filter((cup) => cup.fixed !== fixed);
    this.changed();
  }
}
