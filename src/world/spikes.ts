import { BoxShape, type Body, type World } from "planck";
import { erasePolyline } from "../geometry/erase";
import { boundsOf, isNearBox, type Box, type Point } from "../geometry/point";
import type { Part } from "./part";
import { parsePolylines, roundPoint } from "./saved";
import { PX_PER_M } from "./units";

// How far the spikes reach either side of their strip (pixels): anything
// that comes this close pops.
export const SPIKE_REACH_PX = 8;

// A strip of spikes along a painted path: balls and bubbles that touch it
// pop. It's solid, so nothing slips through in the moment before.
export interface SpikeStrip {
  readonly points: Point[];
  readonly body: Body;
  readonly bounds: Box;
  // Part of a level: it can't be rubbed out.
  readonly fixed: boolean;
}

// Each strip's points.
export type SavedSpikes = Point[][];

export const parseSpikes: (data: unknown) => SavedSpikes = parsePolylines;

export class Spikes implements Part<SavedSpikes> {
  private list: SpikeStrip[] = [];

  constructor(
    private world: World,
    private changed: () => void,
  ) {}

  get all(): readonly SpikeStrip[] {
    return this.list;
  }

  get isEmpty(): boolean {
    return this.list.length === 0;
  }

  add(points: Point[], fixed = false): void {
    if (points.length < 2) return;
    // A box along each stretch, as wide as the spikes reach.
    const body = this.world.createBody({ type: "static" });
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length === 0) continue;
      body.createFixture({
        shape: new BoxShape(
          length / 2 / PX_PER_M,
          SPIKE_REACH_PX / PX_PER_M,
          { x: (a.x + b.x) / 2 / PX_PER_M, y: (a.y + b.y) / 2 / PX_PER_M },
          Math.atan2(b.y - a.y, b.x - a.x),
        ),
      });
    }
    this.list.push({ points, body, bounds: boundsOf(points), fixed });
    this.changed();
  }

  // Everything touching spikes, after a step. (Read from each strip's
  // contacts as they are now, so nothing's kept between steps.)
  touching(): Set<Body> {
    const bodies = new Set<Body>();
    for (const strip of this.list) {
      for (let e = strip.body.getContactList(); e; e = e.next) {
        if (e.other && e.contact.isTouching()) bodies.add(e.other);
      }
    }
    return bodies;
  }

  // Rub out the parts of strips inside a circle, splitting them where the
  // eraser cuts through.
  eraseAt(x: number, y: number, radius: number): void {
    for (const strip of [...this.list]) {
      if (strip.fixed || !isNearBox(strip.bounds, { x, y }, radius)) continue;
      const pieces = erasePolyline(strip.points, { x, y }, radius);
      if (!pieces) continue;
      this.remove(strip);
      for (const piece of pieces) this.add(piece);
    }
  }

  extent(add: (p: Point, reach: number) => void): void {
    for (const strip of this.list) {
      for (const p of strip.points) add(p, SPIKE_REACH_PX);
    }
  }

  save(fixed = false): SavedSpikes {
    return this.list
      .filter((strip) => strip.fixed === fixed)
      .map((strip) => strip.points.map(roundPoint));
  }

  load(saved: SavedSpikes, fixed = false): void {
    this.removeAll(fixed);
    for (const points of saved) this.add(points, fixed);
  }

  clear(): void {
    this.removeAll(false);
  }

  private remove(strip: SpikeStrip): void {
    this.world.destroyBody(strip.body);
    this.list.splice(this.list.indexOf(strip), 1);
    this.changed();
  }

  private removeAll(fixed: boolean): void {
    for (const strip of this.list) {
      if (strip.fixed === fixed) this.world.destroyBody(strip.body);
    }
    this.list = this.list.filter((strip) => strip.fixed !== fixed);
    this.changed();
  }
}
