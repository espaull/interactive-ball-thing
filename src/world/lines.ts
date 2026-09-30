import { ChainShape, type Body, type World } from "planck";
import { erasePolyline } from "../geometry/erase";
import { boundsOf, isNearBox, type Box, type Point } from "../geometry/point";
import type { Mutable, Part } from "./part";
import { parsePolylines, roundPoint } from "./saved";
import { toMetres } from "./units";

// How far a line reaches from its points (pixels), for the gallery's
// pictures: half its width, and a little more.
const LINE_REACH_PX = 4;

export interface Line {
  readonly body: Body;
  readonly points: Point[]; // pixels, kept for drawing
  readonly bounds: Box;
  // Part of a level: it can't be rubbed out or joined onto.
  readonly fixed: boolean;
}

// One end of a line, for continuing it.
export interface LineEnd {
  line: Line;
  atStart: boolean;
  point: Point;
}

// Each line's points.
export type SavedLines = Point[][];

export const parseLines: (data: unknown) => SavedLines = parsePolylines;

// The drawn lines: each one a chain in the physics world.
export class Lines implements Part<SavedLines> {
  private list: Mutable<Line>[] = [];
  // Each line by its body, for telling lines apart from other bodies.
  private byBody = new Map<Body, Line>();

  constructor(
    private world: World,
    private changed: () => void,
  ) {}

  get all(): readonly Line[] {
    return this.list;
  }

  get isEmpty(): boolean {
    return this.list.length === 0;
  }

  // Is this body a line? (For bubbles bouncing off ceilings.)
  has(body: Body): boolean {
    return this.byBody.has(body);
  }

  // A line's points, or undefined if the body isn't a line.
  pointsOf(body: Body): Point[] | undefined {
    return this.byBody.get(body)?.points;
  }

  // Highest and lowest points of any line (pixels), or ±Infinity if there
  // are none.
  get top(): number {
    return Math.min(...this.list.map((line) => line.bounds.top));
  }

  get bottom(): number {
    return Math.max(...this.list.map((line) => line.bounds.bottom));
  }

  add(points: Point[], fixed = false): void {
    if (points.length < 2) return;
    const line = {
      body: this.createChain(points),
      points,
      bounds: boundsOf(points),
      fixed,
    };
    this.list.push(line);
    this.byBody.set(line.body, line);
    this.changed();
  }

  // Give an existing line a new shape (used when a line is continued), so it
  // stays one smooth chain with no bump at the join.
  replace(line: Line, points: Point[]): void {
    const own = line as Mutable<Line>;
    if (points.length < 2 || own.fixed || !this.list.includes(own)) return;
    this.destroyChain(own.body);
    own.body = this.createChain(points);
    own.points = points;
    own.bounds = boundsOf(points);
    this.byBody.set(own.body, own);
    this.changed();
  }

  remove(line: Line): void {
    const index = this.list.indexOf(line as Mutable<Line>);
    if (index === -1) return;
    this.destroyChain(line.body);
    this.list.splice(index, 1);
    this.changed();
  }

  // Rub out every part of every line inside a circle, splitting lines where
  // the eraser cuts through.
  eraseAt(x: number, y: number, radius: number): void {
    for (const line of [...this.list]) {
      if (line.fixed || !isNearBox(line.bounds, { x, y }, radius)) continue;
      const pieces = erasePolyline(line.points, { x, y }, radius);
      if (!pieces) continue;
      this.remove(line);
      for (const piece of pieces) this.add(piece);
    }
  }

  // The end of one of the player's lines closest to a point, within `radius`
  // pixels, ignoring the ends of `except`. (Fixed lines can't be joined
  // onto, as joining changes the line.)
  endAt(x: number, y: number, radius: number, except?: Line): LineEnd | null {
    let best: LineEnd | null = null;
    let bestDistance = radius;
    for (const line of this.list) {
      if (line === except || line.fixed) continue;
      for (const atStart of [true, false]) {
        const point = atStart ? line.points[0] : line.points.at(-1)!;
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance <= bestDistance) {
          best = { line, atStart, point };
          bestDistance = distance;
        }
      }
    }
    return best;
  }

  extent(add: (p: Point, reach: number) => void): void {
    for (const line of this.list) {
      for (const p of line.points) add(p, LINE_REACH_PX);
    }
  }

  save(fixed = false): SavedLines {
    return this.list
      .filter((line) => line.fixed === fixed)
      .map((line) => line.points.map(roundPoint));
  }

  load(saved: SavedLines, fixed = false): void {
    this.removeAll(fixed);
    for (const points of saved) this.add(points, fixed);
  }

  clear(): void {
    this.removeAll(false);
  }

  private removeAll(fixed: boolean): void {
    for (const line of this.list) {
      if (line.fixed === fixed) this.destroyChain(line.body);
    }
    this.list = this.list.filter((line) => line.fixed !== fixed);
    this.changed();
  }

  private createChain(points: Point[]): Body {
    const body = this.world.createBody({ type: "static" });
    body.createFixture({
      shape: new ChainShape(points.map(toMetres), false),
      friction: 0.6,
    });
    return body;
  }

  private destroyChain(body: Body): void {
    this.byBody.delete(body);
    this.world.destroyBody(body);
  }
}
