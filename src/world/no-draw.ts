import {
  distanceToOutline,
  isInside,
  outsideOutlines,
} from "../geometry/outline";
import { boundsOf, isNearBox, type Box, type Point } from "../geometry/point";
import type { Part } from "./part";
import { parseOutlines, roundPoint } from "./saved";

// An area nothing can be built in: lines and boosts drawn across it stop
// at its edge, and portals, cups and cannons can't be put (or moved) into
// it. Balls go straight through; it's not a physics body. What's already
// there when it's drawn stays.
export interface NoDrawZone {
  readonly outline: Point[]; // pixels, going round it
  readonly bounds: Box;
  // Part of a level: it can't be rubbed out.
  readonly fixed: boolean;
}

// Each area's outline.
export type SavedNoDraw = Point[][];

export const parseNoDraw: (data: unknown) => SavedNoDraw = parseOutlines;

export class NoDrawZones implements Part<SavedNoDraw> {
  private list: NoDrawZone[] = [];

  constructor(private changed: () => void) {}

  get all(): readonly NoDrawZone[] {
    return this.list;
  }

  get isEmpty(): boolean {
    return this.list.length === 0;
  }

  add(outline: Point[], fixed = false): void {
    if (outline.length < 3) return;
    this.list.push({ outline, bounds: boundsOf(outline), fixed });
    this.changed();
  }

  // Is `p` in an area where nothing can be built?
  covers(p: Point): boolean {
    return this.list.some(
      (zone) => isNearBox(zone.bounds, p, 0) && isInside(p, zone.outline),
    );
  }

  // The pieces of a line outside every area (the line itself, the same
  // list, if it doesn't go in one).
  outside(points: Point[]): Point[][] {
    if (this.list.length === 0 || points.length < 2) return [points];
    const line = boundsOf(points);
    const near = this.list.filter(
      ({ bounds }) =>
        bounds.left <= line.right &&
        bounds.right >= line.left &&
        bounds.top <= line.bottom &&
        bounds.bottom >= line.top,
    );
    return outsideOutlines(
      points,
      near.map((zone) => zone.outline),
    );
  }

  // Rub out any area whose edge the eraser touches (not its inside, so
  // what's drawn inside one can be rubbed out without losing it).
  eraseAt(x: number, y: number, radius: number): void {
    const c = { x, y };
    for (const zone of [...this.list]) {
      if (zone.fixed || !isNearBox(zone.bounds, c, radius)) continue;
      if (distanceToOutline(c, zone.outline) < radius) {
        this.list.splice(this.list.indexOf(zone), 1);
        this.changed();
      }
    }
  }

  extent(add: (p: Point, reach: number) => void): void {
    for (const zone of this.list) {
      for (const p of zone.outline) add(p, 0);
    }
  }

  save(fixed = false): SavedNoDraw {
    return this.list
      .filter((zone) => zone.fixed === fixed)
      .map((zone) => zone.outline.map(roundPoint));
  }

  load(saved: SavedNoDraw, fixed = false): void {
    this.removeAll(fixed);
    for (const outline of saved) this.add(outline, fixed);
  }

  clear(): void {
    this.removeAll(false);
  }

  private removeAll(fixed: boolean): void {
    this.list = this.list.filter((zone) => zone.fixed !== fixed);
    this.changed();
  }
}
