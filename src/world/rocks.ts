import { ChainShape, type Body, type World } from "planck";
import { distanceToOutline, isInside } from "../geometry/outline";
import { boundsOf, isNearBox, type Box, type Point } from "../geometry/point";
import type { Part } from "./part";
import { parseOutlines, roundPoint } from "./saved";
import { toMetres } from "./units";

// Solid terrain: a shape the rider bumps into and rolls over, but can't
// go through. Its edge is a closed chain in the physics world.
export interface Rock {
  readonly outline: Point[]; // pixels, going round it
  readonly body: Body;
  readonly bounds: Box;
  // Part of a level: it can't be rubbed out.
  readonly fixed: boolean;
}

// Each rock's outline.
export type SavedRocks = Point[][];

export const parseRocks: (data: unknown) => SavedRocks = parseOutlines;

export class Rocks implements Part<SavedRocks> {
  private list: Rock[] = [];

  constructor(
    private world: World,
    private changed: () => void,
  ) {}

  get all(): readonly Rock[] {
    return this.list;
  }

  get isEmpty(): boolean {
    return this.list.length === 0;
  }

  // A rock with this outline (at least three points, not on top of each
  // other).
  add(outline: Point[], fixed = false): void {
    if (outline.length < 3) return;
    const body = this.world.createBody({ type: "static" });
    body.createFixture({
      shape: new ChainShape(outline.map(toMetres), true),
      friction: 0.6,
    });
    this.list.push({ outline, body, bounds: boundsOf(outline), fixed });
    this.changed();
  }

  // Rub out any rock the eraser touches: all of it, as half a rock would
  // need a new edge.
  eraseAt(x: number, y: number, radius: number): void {
    const c = { x, y };
    for (const rock of [...this.list]) {
      if (rock.fixed || !isNearBox(rock.bounds, c, radius)) continue;
      if (
        isInside(c, rock.outline) ||
        distanceToOutline(c, rock.outline) < radius
      ) {
        this.remove(rock);
      }
    }
  }

  extent(add: (p: Point, reach: number) => void): void {
    for (const rock of this.list) {
      for (const p of rock.outline) add(p, 0);
    }
  }

  save(fixed = false): SavedRocks {
    return this.list
      .filter((rock) => rock.fixed === fixed)
      .map((rock) => rock.outline.map(roundPoint));
  }

  load(saved: SavedRocks, fixed = false): void {
    this.removeAll(fixed);
    for (const outline of saved) this.add(outline, fixed);
  }

  clear(): void {
    this.removeAll(false);
  }

  private remove(rock: Rock): void {
    this.world.destroyBody(rock.body);
    this.list.splice(this.list.indexOf(rock), 1);
    this.changed();
  }

  private removeAll(fixed: boolean): void {
    for (const rock of this.list) {
      if (rock.fixed === fixed) this.world.destroyBody(rock.body);
    }
    this.list = this.list.filter((rock) => rock.fixed !== fixed);
    this.changed();
  }
}
